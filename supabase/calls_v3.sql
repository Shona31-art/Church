-- ============================================================================
-- WhatsApp-style calls (migration #51). Run after calls_v2.sql.
-- ============================================================================
-- In plain language: each call now remembers
--   * connected_at — when the other person actually picked up (for the call
--     length shown in the chat: "📞 Voice call · 2:34"), and
--   * end_reason — how it ended: hung up, declined, or not answered (so the
--     caller sees "Call declined" / "No answer", and the chat shows
--     "📞 Missed voice call").
-- Only the server writes these. Safe to run more than once.
-- ============================================================================
alter table video_calls add column if not exists connected_at timestamptz;
alter table video_calls add column if not exists end_reason text;
alter table video_calls drop constraint if exists video_calls_end_reason;
alter table video_calls add constraint video_calls_end_reason check (end_reason is null or end_reason in ('ended', 'declined', 'no_answer'));
