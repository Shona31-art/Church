-- ============================================================================
-- MIGRATION #58 — Children: mother and father. Run after church_challenges.sql.
--
-- In plain language:
--   * Each child can now have a mother and a father: either a member (picked
--     from the church's members) or just a name, for a parent who isn't in
--     the app.
--   * Both parents who are members can see and manage the child from My
--     account — not only the one who added them. Pastors and church admins
--     see every child on the Members page → Children.
--   * Who else can see children: nobody (as before).
--   * Birthdays: people may now save just the day and month. The app stores
--     the year 1904 to mean "no year", and never shows anyone's birth year or
--     age to other people.
-- Safe to re-run.
-- ============================================================================

alter table member_children add column if not exists mother_id uuid references app_users(id) on delete set null;
alter table member_children add column if not exists father_id uuid references app_users(id) on delete set null;
alter table member_children add column if not exists mother_name text;
alter table member_children add column if not exists father_name text;

alter table member_children drop constraint if exists member_children_mother_name;
alter table member_children add constraint member_children_mother_name check (mother_name is null or char_length(btrim(mother_name)) between 1 and 80);
alter table member_children drop constraint if exists member_children_father_name;
alter table member_children add constraint member_children_father_name check (father_name is null or char_length(btrim(father_name)) between 1 and 80);
alter table member_children drop constraint if exists member_children_two_parents;
alter table member_children add constraint member_children_two_parents check (mother_id is null or father_id is null or mother_id <> father_id);

create index if not exists idx_member_children_mother on member_children(mother_id) where mother_id is not null;
create index if not exists idx_member_children_father on member_children(father_id) where father_id is not null;

-- Seen by: whoever added the child, either parent, and the church's shepherds.
drop policy if exists member_children_select on member_children;
create policy member_children_select on member_children
  for select using (
    (select auth.uid()) in (user_id, mother_id, father_id) or is_church_shepherd(church_id)
  );

-- Changed by the same people; every member linked to the child must belong
-- to the church the child is filed under.
drop policy if exists member_children_write on member_children;
create policy member_children_write on member_children
  for all using (
    ((select auth.uid()) in (user_id, mother_id, father_id) and church_id = current_church_id()) or is_church_shepherd(church_id)
  ) with check (
    (((select auth.uid()) in (user_id, mother_id, father_id) and church_id = current_church_id()) or is_church_shepherd(church_id))
    and exists (select 1 from app_users u where u.id = member_children.user_id and u.church_id = member_children.church_id)
    and (mother_id is null or exists (select 1 from app_users u where u.id = member_children.mother_id and u.church_id = member_children.church_id))
    and (father_id is null or exists (select 1 from app_users u where u.id = member_children.father_id and u.church_id = member_children.church_id))
  );
