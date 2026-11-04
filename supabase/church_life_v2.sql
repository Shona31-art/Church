-- ============================================================================
-- Church life v2 (migration #62). Run after church_life.sql. Safe to re-run.
-- ============================================================================
-- In plain language:
-- PRAYER CHAIN
--   * Only at set times: a chain can have prayer times (e.g. 05:00, 15:00,
--     18:00) each day instead of round the clock.
--   * Pastors can put church members into a slot (they're told).
--   * Whoever prays can add their prayer to the slot: typed, or recorded.
--     The church sees the prayers on the chain's page.
-- MONDAY REPORT
--   * A church can switch the Monday email off (and on again).
-- CERTIFICATES
--   * Any certificate you like: "Other" with your own title and wording
--     (e.g. "Certificate of Appreciation — for faithful service").
--   * Five designs (Modern, Banner, Ribbon, Classic, Original) and a choice of colours for
--     each certificate. The church remembers the design and colour it used
--     last as its own style.
-- ============================================================================

alter table certificates drop constraint if exists certificates_kind_check;
alter table certificates add constraint certificates_kind_check check (kind in ('baptism', 'dedication', 'membership', 'course', 'custom'));

alter table certificates add column if not exists custom_title text check (char_length(custom_title) <= 80);
alter table certificates add column if not exists custom_line text check (char_length(custom_line) <= 240);
alter table certificates drop constraint if exists certificates_custom_check;
alter table certificates add constraint certificates_custom_check check (kind <> 'custom' or char_length(btrim(coalesce(custom_title, ''))) > 0);

alter table certificates add column if not exists design text not null default 'modern';
alter table certificates add column if not exists colour text not null default 'royal';
alter table certificates drop constraint if exists certificates_design_check;
alter table certificates add constraint certificates_design_check check (design in ('modern', 'banner', 'ribbon', 'classic', 'original'));
alter table certificates drop constraint if exists certificates_colour_check;
alter table certificates add constraint certificates_colour_check check (colour in ('gold', 'royal', 'crimson', 'forest', 'violet', 'ocean', 'charcoal', 'rose'));

-- The church's certificate style (the last one used), so the next certificate starts the same.
alter table churches add column if not exists certificate_design text check (certificate_design in ('modern', 'banner', 'ribbon', 'classic', 'original'));
alter table churches add column if not exists certificate_colour text check (certificate_colour in ('gold', 'royal', 'crimson', 'forest', 'violet', 'ocean', 'charcoal', 'rose'));

-- ---------------------------------------------------------------------------
-- Prayer chain: set times, pastors filling slots, and prayers
-- ---------------------------------------------------------------------------
alter table prayer_chains add column if not exists times text[];
alter table prayer_chains drop constraint if exists prayer_chains_times_check;
alter table prayer_chains add constraint prayer_chains_times_check
  check (times is null or (cardinality(times) between 1 and 24 and array_to_string(times, ',') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*$'));

alter table prayer_chain_slots add column if not exists prayer_text text check (char_length(prayer_text) <= 2000);
alter table prayer_chain_slots add column if not exists prayer_audio_path text check (char_length(prayer_audio_path) <= 300);
alter table prayer_chain_slots add column if not exists prayer_audio_ms integer check (prayer_audio_ms between 0 and 600000);
alter table prayer_chain_slots add column if not exists prayed_at timestamptz;
alter table prayer_chain_slots add column if not exists added_by uuid references app_users(id) on delete set null;

-- A slot is inside its chain, at one of its times (or on a slot boundary), not over, and not full.
create or replace function app_private.check_prayer_slot() returns trigger as $$
declare
  c prayer_chains;
  taken integer;
  local_start timestamp;
begin
  select * into c from prayer_chains where id = new.chain_id;
  if c.id is null or c.church_id <> new.church_id then raise exception 'That prayer chain could not be found'; end if;
  if new.slot_start < c.starts_at - interval '1 day' or new.slot_start >= c.ends_at then raise exception 'That time is not one of the prayer slots'; end if;
  if c.times is not null then
    local_start := new.slot_start at time zone 'Africa/Johannesburg';
    if to_char(local_start, 'HH24:MI') <> all (c.times) or extract(second from local_start) <> 0
       or local_start::date < (c.starts_at at time zone 'Africa/Johannesburg')::date then
      raise exception 'That time is not one of the prayer slots';
    end if;
  elsif new.slot_start < c.starts_at or mod((extract(epoch from (new.slot_start - c.starts_at)))::bigint, c.slot_minutes * 60) <> 0 then
    raise exception 'That time is not one of the prayer slots';
  end if;
  if new.slot_start + make_interval(mins => c.slot_minutes) <= now() then raise exception 'That prayer slot is already over'; end if;
  perform pg_advisory_xact_lock(hashtext(new.chain_id::text || new.slot_start::text));
  select count(*) into taken from prayer_chain_slots where chain_id = new.chain_id and slot_start = new.slot_start;
  if taken >= c.max_per_slot then raise exception 'That prayer slot is full'; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Booking: yourself, or (pastors) anyone in the church.
drop policy if exists prayer_chain_slots_insert on prayer_chain_slots;
create policy prayer_chain_slots_insert on prayer_chain_slots for insert
  with check (church_id = current_church_id() and reminded_at is null and prayer_text is null and prayer_audio_path is null
    and (user_id = auth.uid() or (is_church_shepherd(church_id) and exists (select 1 from app_users u where u.id = user_id and u.church_id = church_id and u.status = 'active'))));
-- Your own slot: add or change your prayer.
drop policy if exists prayer_chain_slots_update on prayer_chain_slots;
create policy prayer_chain_slots_update on prayer_chain_slots for update
  using (church_id = current_church_id() and user_id = auth.uid())
  with check (church_id = current_church_id() and user_id = auth.uid()
    and (prayer_audio_path is null or prayer_audio_path like current_church_id()::text || '/' || chain_id::text || '/' || auth.uid()::text || '/%'));

-- Someone put into a slot by a pastor is told.
create or replace function app_private.on_prayer_slot_added() returns trigger as $$
declare
  c prayer_chains;
begin
  if new.user_id is distinct from auth.uid() and auth.uid() is not null then
    select * into c from prayer_chains where id = new.chain_id;
    perform app_private.notify(array[new.user_id], new.church_id, 'prayer_care', 'prayer_chain.assigned',
      'You''re on the prayer chain at ' || to_char(new.slot_start at time zone 'Africa/Johannesburg', 'HH24:MI'),
      c.title || ' · ' || to_char(new.slot_start at time zone 'Africa/Johannesburg', 'FMDay FMDD FMMonth'), '/dashboard/prayer-chain/' || c.id, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_prayer_slot_added on prayer_chain_slots;
create trigger trg_prayer_slot_added after insert on prayer_chain_slots
  for each row execute function app_private.on_prayer_slot_added();

-- Recorded prayers: prayer-audio/<church>/<chain>/<person>/<file>; the church can listen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prayer-audio', 'prayer-audio', false, 3145728, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists prayer_audio_select on storage.objects;
create policy prayer_audio_select on storage.objects for select to authenticated using (
  bucket_id = 'prayer-audio' and (storage.foldername(name))[1] = current_church_id()::text
);
drop policy if exists prayer_audio_insert on storage.objects;
create policy prayer_audio_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'prayer-audio'
  and (storage.foldername(name))[1] = current_church_id()::text
  and (storage.foldername(name))[3] = auth.uid()::text
);
drop policy if exists prayer_audio_delete on storage.objects;
create policy prayer_audio_delete on storage.objects for delete to authenticated using (
  bucket_id = 'prayer-audio' and (storage.foldername(name))[3] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Monday report on/off for each church (on unless switched off).
-- ---------------------------------------------------------------------------
alter table churches add column if not exists weekly_report_enabled boolean not null default true;
