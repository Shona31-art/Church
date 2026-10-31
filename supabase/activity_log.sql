-- ============================================================================
-- #42  activity_log.sql — record every change people make, in every church
--
-- Adds a trigger to the main tables so that each time a signed-in person
-- adds, edits or deletes something, a row lands in audit_logs (who, which
-- church, what, when). Only column NAMES are recorded for edits — never the
-- values — so private content (prayer text, giving amounts, notes) stays out
-- of the log. Private spaces (journal, counseling messages, chat messages,
-- Bible notes) are deliberately not tracked.
--
-- Sign-ins and sign-outs are recorded by the app itself.
-- Safe to run more than once.
-- ============================================================================

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_church_created_idx on public.audit_logs (church_id, created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action text_pattern_ops);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_uid uuid;
  v_row jsonb;
  v_old jsonb;
  v_church uuid;
  v_target uuid;
  v_changed text[];
  v_label text;
  v_op text;
begin
  begin
    v_uid := auth.uid();
    -- System/server writes (no signed-in person) are recorded by the app where they matter.
    if v_uid is null then
      return null;
    end if;

    if tg_op = 'DELETE' then
      v_row := to_jsonb(old);
      v_op := 'deleted';
    else
      v_row := to_jsonb(new);
      v_op := case when tg_op = 'INSERT' then 'created' else 'updated' end;
    end if;

    if tg_op = 'UPDATE' then
      v_old := to_jsonb(old);
      select array_agg(k order by k) into v_changed
      from jsonb_object_keys(v_row) k
      where (v_row -> k) is distinct from (v_old -> k)
        and k not in ('updated_at', 'last_message_at', 'last_seen_at', 'last_active_at', 'last_read_at');
      if v_changed is null then
        return null; -- nothing meaningful changed
      end if;
    end if;

    if tg_table_name = 'churches' then
      v_church := case when tg_op = 'DELETE' then null else (v_row ->> 'id')::uuid end;
    elsif v_row ? 'church_id' then
      v_church := (v_row ->> 'church_id')::uuid;
    end if;
    if v_church is not null and not exists (select 1 from churches where id = v_church) then
      v_church := null;
    end if;

    if (v_row ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_target := (v_row ->> 'id')::uuid;
    end if;

    -- A short name for the thing, only for tables where names aren't private.
    if tg_table_name in ('announcements', 'events', 'departments', 'sermons', 'songs', 'service_plans',
                         'churches', 'plans', 'posters', 'jigsaw_pictures', 'chat_channels', 'app_users') then
      v_label := left(coalesce(v_row ->> 'title', v_row ->> 'name'), 80);
    end if;

    insert into audit_logs (church_id, actor_id, action, target_table, target_id, metadata)
    values (
      v_church,
      (select id from app_users where id = v_uid),
      v_entity || '.' || v_op,
      tg_table_name,
      v_target,
      jsonb_strip_nulls(jsonb_build_object('auto', true, 'label', v_label, 'changed', to_jsonb(v_changed)))
    );
  exception when others then
    -- Never block someone's change because the log couldn't be written.
    raise warning 'audit_row_change(%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('announcements', 'announcement'),
      ('app_users', 'member'),
      ('chat_channels', 'chat_channel'),
      ('chat_channel_members', 'chat_member'),
      ('church_card_giving', 'card_giving'),
      ('church_giving_details', 'giving_details'),
      ('church_modules', 'church_module'),
      ('church_song_settings', 'song_settings'),
      ('church_subscriptions', 'subscription'),
      ('churches', 'church'),
      ('counseling_settings', 'counseling_settings'),
      ('departments', 'department'),
      ('events', 'event'),
      ('event_rsvps', 'rsvp'),
      ('givings', 'giving'),
      ('jigsaw_pictures', 'jigsaw_picture'),
      ('member_birthdays', 'birthday'),
      ('member_chat_restrictions', 'chat_restriction'),
      ('pastor_availability_blocks', 'availability'),
      ('pastor_bookings', 'booking'),
      ('pastoral_care_logs', 'pastoral_care'),
      ('plans', 'plan'),
      ('plan_modules', 'plan_module'),
      ('posters', 'poster'),
      ('prayer_board_items', 'prayer'),
      ('prayer_comments', 'prayer_comment'),
      ('sermons', 'sermon'),
      ('service_plans', 'service_plan'),
      ('service_plan_items', 'service_plan_item'),
      ('songs', 'song'),
      ('support_tickets', 'support_ticket')
    ) as v(tbl, entity)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t.tbl);
      execute format(
        'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row_change(%2$L)',
        t.tbl, t.entity
      );
    end if;
  end loop;
end $$;
