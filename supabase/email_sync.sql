-- ============================================================================
-- MIGRATION #33 — Keep the app's copy of each person's email in step with
-- their sign-in email. Run after church_move.sql (#32).
-- Plan: docs/plans/email-change.md
--
-- In plain language: members can now change their email from My account.
-- Supabase Auth confirms it by email (with "Secure email change" on: both the
-- old and new address must confirm) and then switches the sign-in address in
-- auth.users. This trigger copies the new address to app_users.email (used in
-- member lists, receipts and card payments) and writes an audit-log entry
-- with both addresses partly hidden. Members still can't edit
-- app_users.email directly (security_fix_app_users.sql blocks it).
-- Safe to re-run.
-- ============================================================================

-- "videshin@gmail.com" → "vi***@gmail.com" (enough to recognise, not to read).
create or replace function app_private.mask_email(address text)
returns text as $$
  select case
    when address is null or position('@' in address) = 0 then null
    else left(split_part(address, '@', 1), 2) || '***@' || split_part(address, '@', 2)
  end;
$$ language sql immutable;

create or replace function app_private.sync_app_user_email()
returns trigger as $$
begin
  if new.email is null or lower(new.email) is not distinct from lower(old.email) then
    return null;
  end if;
  update public.app_users set email = lower(new.email)
   where id = new.id and email is distinct from lower(new.email);
  if found then
    insert into public.audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
    select u.church_id, new.id, 'account.email_changed', 'app_users', new.id,
           jsonb_build_object('from', app_private.mask_email(old.email), 'to', app_private.mask_email(new.email))
      from public.app_users u where u.id = new.id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_sync_app_user_email on auth.users;
create trigger trg_sync_app_user_email after update of email on auth.users
  for each row execute function app_private.sync_app_user_email();

revoke all on all functions in schema app_private from public;
