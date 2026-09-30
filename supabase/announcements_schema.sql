-- ============================================================================
-- ANNOUNCEMENTS MODULE — schema
-- Member Management needs no new tables: it's built on app_users +
-- departments, which already exist in schema.sql. This file only adds
-- announcements.
-- ============================================================================

create table announcements (
  id            uuid primary key default uuid_generate_v4(),
  church_id     uuid not null references churches(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade, -- null = church-wide
  author_id     uuid not null references app_users(id),

  title         text not null,
  body          text not null,
  image_url     text,
  pinned        boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_announcements_church on announcements(church_id, created_at desc);
create index idx_announcements_department on announcements(department_id);

alter table announcements enable row level security;

-- Visibility: church-wide announcements (department_id is null) are visible
-- to everyone in the church. Department-scoped ones are only visible to
-- that department's members, plus church_admin/pastor who see everything
-- in their church regardless of department.
create policy announcements_select on announcements
  for select using (
    is_super_admin()
    or (
      church_id = current_church_id()
      and (
        department_id is null
        or department_id = (select department_id from app_users where id = auth.uid())
        or exists (
          select 1 from app_users
          where id = auth.uid() and role in ('church_admin', 'pastor')
        )
      )
    )
  );

-- Posting: church_admin/pastor can post church-wide or to any department.
-- department_leader can only post to their own department (never church-wide).
create policy announcements_insert on announcements
  for insert with check (
    church_id = current_church_id()
    and author_id = auth.uid()
    and (
      exists (
        select 1 from app_users
        where id = auth.uid() and role in ('church_admin', 'pastor')
      )
      or (
        department_id is not null
        and department_id = (select department_id from app_users where id = auth.uid())
        and exists (
          select 1 from app_users where id = auth.uid() and role = 'department_leader'
        )
      )
    )
  );

create policy announcements_update on announcements
  for update using (
    author_id = auth.uid()
    or exists (
      select 1 from app_users
      where id = auth.uid() and role in ('church_admin', 'pastor') and church_id = announcements.church_id
    )
  );

create policy announcements_delete on announcements
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from app_users
      where id = auth.uid() and role in ('church_admin', 'pastor') and church_id = announcements.church_id
    )
  );

create trigger trg_announcements_updated_at before update on announcements
  for each row execute function set_updated_at();
