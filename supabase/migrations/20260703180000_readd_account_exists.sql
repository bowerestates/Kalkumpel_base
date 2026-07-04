-- Re-add an account-existence probe for the forgot-password screen so unknown emails
-- are rejected before a reset code is sent (product decision).
--
-- ⚠️ This intentionally RE-OPENS the email-enumeration surface that
-- 20260703103936_drop_account_auth_status.sql closed. Mitigate with Auth CAPTCHA
-- (guards the UI) but note it does NOT fully cover this: the function is granted to
-- `anon`, so it can be called directly on the PostgREST endpoint, outside Supabase's
-- auth rate limits. Add a DB-side rate limit / drop the `anon` grant if scraping is a
-- concern (see supabase/config.toml). Scoped to existence only (no has_password /
-- provider hint) to minimize what's exposed.
create or replace function public.account_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(p_email));
$$;
revoke all on function public.account_exists(text) from public;
grant execute on function public.account_exists(text) to anon, authenticated;
