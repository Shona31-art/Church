-- ============================================================================
-- MIGRATION #32 — Tidy up when a member moves to another church. Run after
-- paystack_card_giving.sql (#31). Plan: docs/plans/church-move-cleanup.md
--
-- In plain language: when someone's church changes (only the platform admin
-- can do that), the OLD church stops seeing the person's own information:
--   * their birthday moves to the new church (same date, not asked again);
--   * prayers they'd shared come off the old church's prayer wall (they stay on
--     the person's private board — nothing is deleted);
--   * their pending/approved bookings for today or later are cancelled
--     (silently — cancelling sends no notification);
--   * their RSVPs to old-church events that haven't started are removed.
-- One audit-log entry records what changed. Gifts, pastoral care notes,
-- counselling records, support tickets, comments and chat messages stay with
-- the old church on purpose: they're that church's records. Chats already
-- become unreadable after a move (access requires the current church).
-- Safe to re-run.
-- ============================================================================

create or replace function app_private.on_member_church_changed()
returns trigger as $$
declare
  -- Bookings use calendar dates; current_date is fine at this precision.
  today date := current_date;
  birthday date;
  n_birthday int := 0;
  n_prayers int := 0;
  n_bookings int := 0;
  n_rsvps int := 0;
begin
  if old.church_id is null or new.church_id is not distinct from old.church_id then
    return null;
  end if;

  -- 1. Birthday follows the person (church_id is frozen, so remove + re-add).
  delete from member_birthdays where user_id = new.id and church_id = old.church_id returning birth_date into birthday;
  if birthday is not null and new.church_id is not null then
    insert into member_birthdays (user_id, church_id, birth_date, updated_by)
    values (new.id, new.church_id, birthday, auth.uid())
    on conflict (user_id) do nothing;
    n_birthday := 1;
  end if;

  -- 2. Off the old prayer wall; still on their own board.
  update prayer_board_items
     set is_shared_request = false, is_testimony_shared = false
   where user_id = new.id and church_id = old.church_id and (is_shared_request or is_testimony_shared);
  get diagnostics n_prayers = row_count;

  -- 3. Upcoming bookings with the old church's pastors.
  update pastor_bookings
     set status = 'cancelled'
   where requested_by = new.id and church_id = old.church_id
     and status in ('pending', 'approved') and preferred_date >= today;
  get diagnostics n_bookings = row_count;

  -- 4. RSVPs to old-church events that haven't started.
  delete from event_rsvps r
   using events e
   where r.event_id = e.id and r.user_id = new.id and e.church_id = old.church_id and e.start_time > now();
  get diagnostics n_rsvps = row_count;

  insert into audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
  values (old.church_id, auth.uid(), 'user.church_move_cleanup', 'app_users', new.id,
          jsonb_build_object('to_church_id', new.church_id, 'birthday_moved', n_birthday = 1,
                             'prayers_unshared', n_prayers, 'bookings_cancelled', n_bookings, 'rsvps_removed', n_rsvps));
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_member_church_changed on app_users;
create trigger trg_member_church_changed after update of church_id on app_users
  for each row execute function app_private.on_member_church_changed();

revoke all on all functions in schema app_private from public;
