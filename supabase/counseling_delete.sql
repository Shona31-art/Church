-- ============================================================================
-- Delete counseling conversations (migration #37)
-- ============================================================================
-- In plain language:
--   1. A member can delete their own counseling conversation, with all its
--      messages. Nobody else can (not pastors, not admins).
--   2. Safety first: a conversation that raised a safety flag can't be deleted
--      while a pastor still hasn't followed it up. Once a pastor has marked it
--      as followed up, the member can delete it.
--
-- Safe to run more than once.
-- ============================================================================

-- Security definer: members can't read escalations themselves (they're for
-- pastors), but the rule needs to know whether one is still open.
create or replace function counseling_has_open_escalation(target_conversation uuid)
returns boolean as $$
  select exists (
    select 1 from counseling_escalations e
    where e.conversation_id = target_conversation and e.acknowledged_at is null
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists counseling_conversations_delete_own on counseling_conversations;
create policy counseling_conversations_delete_own on counseling_conversations
  for delete using (
    member_id = auth.uid()
    and not counseling_has_open_escalation(id)
  );
