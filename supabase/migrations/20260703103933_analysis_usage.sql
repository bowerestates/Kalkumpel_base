-- Per-user daily quota for the AI meal-analysis Edge Function (closes the
-- "unmetered paid API" half of the Anthropic-proxy hardening). The Edge Function
-- (service role) calls bump_meal_analysis() once per request; clients never touch
-- this table directly, so RLS is enabled with NO policies and NO grants — only the
-- service role (which bypasses RLS) reaches it.

create table public.meal_analysis_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  date_key text not null,                 -- UTC 'YYYY-MM-DD' bucket for the cap
  count    int  not null default 0,
  primary key (user_id, date_key)
);

alter table public.meal_analysis_usage enable row level security;
-- Intentionally no policies and no grants to anon/authenticated: service-role only.

-- Atomic check-and-increment: a single upsert returns the post-increment count, so
-- parallel invocations can't race a read-then-update. Over the cap it raises, which
-- rolls back the increment (count never climbs past the cap) and surfaces to the
-- function as an error -> 429.
create or replace function public.bump_meal_analysis(p_user uuid, p_cap int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.meal_analysis_usage as u (user_id, date_key, count)
  values (p_user, to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD'), 1)
  on conflict (user_id, date_key)
  do update set count = u.count + 1
  returning u.count into v_count;

  if v_count > p_cap then
    raise exception 'daily analysis limit reached' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- Only the Edge Function's service role should call this.
revoke all on function public.bump_meal_analysis(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_meal_analysis(uuid, int) to service_role;
