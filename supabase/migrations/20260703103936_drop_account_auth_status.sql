-- Remove the anon-callable email-enumeration oracle. account_auth_status() let an
-- unauthenticated caller learn whether an email had an account and whether it had a
-- password (Google-only vs email). The forgot-password screen now shows generic
-- messaging instead of branching on this, so the function is no longer needed.
drop function if exists public.account_auth_status(text);
