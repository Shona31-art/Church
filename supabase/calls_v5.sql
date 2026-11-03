-- ============================================================================
-- Group calls end when everyone has left (migration #55). Run after calls_v4.sql.
-- ============================================================================
-- In plain language: while you're in a call, your phone checks in every 20
-- seconds. When the last person leaves — or everyone's phone stops checking
-- in (app closed, battery died) — the call ends by itself, and the chat's
-- "Join" button goes away. Before this, a group call stayed open until the
-- person who started it ended it, or for three hours.
-- Stores only who is in the call and when their phone last checked in.
-- Safe to run more than once.
-- ============================================================================

alter table video_calls add column if not exists presence jsonb not null default '{}';

-- "I'm in this call" (here = true, every 20 s) or "I left" (here = false).
-- Called only by the server (service role), after it has checked the person
-- can see the call. Returns how many people are still in it.
create or replace function call_presence_write(target uuid, who uuid, here boolean)
returns integer as $$
declare
  remaining integer;
begin
  -- Never from a member's own session (the server calls it with no session).
  if auth.uid() is not null then
    raise exception 'Not allowed.';
  end if;
  if here then
    update video_calls set presence = presence || jsonb_build_object(who::text, now())
      where id = target and ended_at is null;
  else
    update video_calls set presence = presence - who::text
      where id = target and ended_at is null;
  end if;

  -- People whose phones checked in during the last minute.
  select count(*) into remaining
    from video_calls c, jsonb_each_text(c.presence) p
    where c.id = target and p.value::timestamptz > now() - interval '60 seconds';

  -- Last one out: the call is over.
  if not here and remaining = 0 then
    update video_calls set ended_at = now(), end_reason = 'ended' where id = target and ended_at is null;
    update notifications set read_at = now()
      where link = '/dashboard/calls/' || target and type = 'video_call' and read_at is null;
  end if;
  return remaining;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function call_presence_write(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function call_presence_write(uuid, uuid, boolean) to service_role;
