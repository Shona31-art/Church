-- ============================================================================
-- Built-in calls (migration #50). Run after chat_v4.sql.
-- ============================================================================
-- In plain language: voice and video calls no longer use an outside service
-- (Daily.co). Phones connect straight to each other (WebRTC). To find each
-- other they exchange a few short set-up messages over a private Supabase
-- Realtime channel named after the call ("call:<id>").
--
-- This file makes that channel private to the call: only people who can see
-- the call — exactly those who can see its chat or appointment
-- (video_calls.sql) — can join it, listen or send, and only while the call
-- is open. Sound and video never pass through Supabase; they go between the
-- phones, encrypted by WebRTC, and nothing is recorded.
--
-- Also: Supabase → Project Settings → Realtime: keep "Allow public access" on
-- for now (the chat's "typing…" indicator uses public channels); the call
-- channels are private either way because the app asks for a private channel.
-- Safe to run more than once.
-- ============================================================================

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'Realtime authorization is not available here; skipped.';
    return;
  end if;

  execute 'drop policy if exists "call participants can listen" on realtime.messages';
  execute $p$
    create policy "call participants can listen" on realtime.messages
      for select to authenticated
      using (
        realtime.topic() like 'call:%'
        and exists (
          select 1 from public.video_calls c
          where 'call:' || c.id::text = realtime.topic()
            and c.ended_at is null
            and c.expires_at > now()
        )
      )
  $p$;

  execute 'drop policy if exists "call participants can send" on realtime.messages';
  execute $p$
    create policy "call participants can send" on realtime.messages
      for insert to authenticated
      with check (
        realtime.topic() like 'call:%'
        and exists (
          select 1 from public.video_calls c
          where 'call:' || c.id::text = realtime.topic()
            and c.ended_at is null
            and c.expires_at > now()
        )
      )
  $p$;
end $$;

-- Calls are no longer Daily rooms: room_url now holds "builtin:<size limit>".
comment on column video_calls.room_url is 'Built-in calls: "builtin:<max people>" (the call screen keeps the limit).';
