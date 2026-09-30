-- ============================================================================
-- DEPARTMENTS — missing write policies
-- schema.sql only defined SELECT for departments. Run this to add the
-- write policies needed for the Departments management UI.
-- ============================================================================

create policy departments_insert on departments
  for insert with check (
    church_id = current_church_id()
    and exists (
      select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor')
    )
  );

create policy departments_update on departments
  for update using (
    church_id = current_church_id()
    and exists (
      select 1 from app_users where id = auth.uid() and role in ('church_admin', 'pastor')
    )
  );

create policy departments_delete on departments
  for delete using (
    church_id = current_church_id()
    and exists (
      select 1 from app_users where id = auth.uid() and role = 'church_admin'
    )
  );
