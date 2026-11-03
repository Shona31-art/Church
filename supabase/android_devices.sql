-- ============================================================================
-- Grace's Android app (migration #53). Run after chat_v5.sql.
-- ============================================================================
-- In plain language: when someone signs in to the Android app, the app's
-- push address (a Firebase token) is remembered against their account, so a
-- call can ring that phone — full screen, even when Grace is closed — and
-- messages pop up with a number on the app icon.
--
-- Only the server reads or writes this table (no one can see anyone's
-- phones). A token moves to whoever signed in last on that phone, and is
-- forgotten when the app is uninstalled. Safe to run more than once.
-- ============================================================================

create table if not exists android_devices (
  token        text primary key check (char_length(token) between 20 and 4096),
  user_id      uuid not null references app_users(id) on delete cascade,
  app_version  integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_android_devices_user on android_devices(user_id);

-- Row level security on, with no policies: only the server (service role) can use it.
alter table android_devices enable row level security;
