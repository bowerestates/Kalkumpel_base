-- MacroLens auth + cloud sync schema.
-- One profiles row per user (demographics + calorie/macro goals + onboarded flag),
-- plus per-user entries (meals) and weights. All RLS-protected to auth.uid().

-- profiles --------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  onboarded     boolean not null default false,
  sex           text    not null default 'male'     check (sex in ('male','female')),
  age           int     not null default 30,
  height_cm     numeric not null default 175,
  weight_kg     numeric not null default 75,
  activity      text    not null default 'moderate' check (activity in ('sedentary','light','moderate','very','extra')),
  goal          text    not null default 'maintain' check (goal in ('lose','maintain','gain','muscle')),
  units         text    not null default 'metric'   check (units in ('metric','imperial')),
  goal_calories int     not null default 2000,
  goal_protein  int     not null default 150,
  goal_carbs    int     not null default 200,
  goal_fat      int     not null default 65,
  updated_at    timestamptz not null default now()
);

-- entries (meals) -------------------------------------------------------------
create table public.entries (
  id         text primary key,                              -- client-generated id
  user_id    uuid not null references auth.users (id) on delete cascade,
  date_key   text not null,                                 -- 'YYYY-MM-DD'
  ts         bigint not null,                               -- Entry.timestamp (ms epoch)
  name       text not null,
  calories   int not null default 0,
  protein    int not null default 0,
  carbs      int not null default 0,
  fat        int not null default 0,
  photo_uri  text,                                          -- v1: local device uri
  items      text[],
  created_at timestamptz not null default now()
);
create index entries_user_date_idx on public.entries (user_id, date_key);

-- weights (one per user per day) ----------------------------------------------
create table public.weights (
  user_id  uuid not null references auth.users (id) on delete cascade,
  date_key text not null,
  id       text not null,
  ts       bigint not null,
  kg       numeric not null,
  primary key (user_id, date_key)
);

-- RLS -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.weights  enable row level security;

create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete" on public.profiles for delete using (auth.uid() = id);

create policy "entries_select" on public.entries for select using (auth.uid() = user_id);
create policy "entries_insert" on public.entries for insert with check (auth.uid() = user_id);
create policy "entries_update" on public.entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_delete" on public.entries for delete using (auth.uid() = user_id);

create policy "weights_select" on public.weights for select using (auth.uid() = user_id);
create policy "weights_insert" on public.weights for insert with check (auth.uid() = user_id);
create policy "weights_update" on public.weights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weights_delete" on public.weights for delete using (auth.uid() = user_id);

-- Grants — RLS alone is not enough; the Data API needs explicit table grants.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.entries  to authenticated;
grant select, insert, update, delete on public.weights  to authenticated;

-- Auto-create a profiles row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Account self-deletion (clients can't call auth.admin). Deletes only the caller;
-- the on-delete-cascade FKs remove their profile/entries/weights.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- Backs forgot-password validation: does an account exist for this email, and was
-- it created with a password (vs Google-only)? Granted to anon (pre-auth screen).
-- NOTE: this exposes account existence (email enumeration) — enable Supabase Auth
-- CAPTCHA / rate limiting to mitigate.
create or replace function public.account_auth_status(p_email text)
returns table (account_exists boolean, has_password boolean)
language sql
security definer
set search_path = ''
as $$
  select
    exists (select 1 from auth.users u where u.email = lower(p_email)),
    exists (
      select 1
      from auth.users u
      join auth.identities i on i.user_id = u.id
      where u.email = lower(p_email) and i.provider = 'email'
    );
$$;
revoke all on function public.account_auth_status(text) from public;
grant execute on function public.account_auth_status(text) to anon, authenticated;
