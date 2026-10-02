-- ============================================================================
-- PASTOR BOOKING — security fix (run after church_os_features_schema.sql)
--
-- What this changes, in plain language:
--   1. A booking request can only be *created* as "pending" with no decline
--      reason. Before, a member could insert a request that was already
--      "approved" straight from the browser console, skipping the pastor.
--   2. The pastor a request is addressed to must be a pastor/church admin in
--      the requester's own church (before: any user id, any church).
--   3. Availability blocks can only be written into your own church, only for
--      a pastor/church admin of that church, and only by that pastor or a
--      church admin. Before, any signed-in user could write a block for
--      themselves into any church's calendar.
--
-- Safe to re-run: drops and recreates only the policies it owns.
-- Existing data is not modified.
-- ============================================================================

-- True when `uid` is a pastor or church admin of `church`. security definer so
-- the check works regardless of the caller's own app_users visibility.
create or replace function is_shepherd_of(uid uuid, church uuid)
returns boolean as $$
  select exists (
    select 1 from app_users
    where id = uid and church_id = church and role in ('pastor', 'church_admin')
  );
$$ language sql stable security definer set search_path = public;

-- 1 + 2: requests start pending, addressed to a pastor in your own church.
drop policy if exists pastor_bookings_insert on pastor_bookings;
create policy pastor_bookings_insert on pastor_bookings
  for insert with check (
    church_id = current_church_id()
    and requested_by = auth.uid()
    and status = 'pending'
    and decline_reason is null
    and (pastor_id is null or is_shepherd_of(pastor_id, church_id))
  );

-- Update stays pastor/church_admin of that church only; `with check` also
-- stops a shepherd re-pointing a booking at someone outside the church.
drop policy if exists pastor_bookings_update on pastor_bookings;
create policy pastor_bookings_update on pastor_bookings
  for update using (
    church_id = current_church_id() and is_shepherd_of(auth.uid(), church_id)
  )
  with check (
    church_id = current_church_id()
    and is_shepherd_of(auth.uid(), church_id)
    and (pastor_id is null or is_shepherd_of(pastor_id, church_id))
  );

-- 3: availability blocks.
drop policy if exists pastor_availability_write on pastor_availability_blocks;
create policy pastor_availability_write on pastor_availability_blocks
  for all using (
    church_id = current_church_id()
    and (
      pastor_id = auth.uid()
      or exists (select 1 from app_users where id = auth.uid() and role = 'church_admin' and church_id = pastor_availability_blocks.church_id)
    )
  )
  with check (
    church_id = current_church_id()
    and is_shepherd_of(pastor_id, church_id)
    and (
      pastor_id = auth.uid()
      or exists (select 1 from app_users where id = auth.uid() and role = 'church_admin' and church_id = pastor_availability_blocks.church_id)
    )
  );
