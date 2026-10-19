# Moving a member to another church — plan

Status: **PROPOSED** (2026-10-19), awaiting approval. Closes the README gap
"Moving someone to another church leaves their old prayers, messages and gifts
with the old church".

## What actually happens today (checked in the migrations)

Records keep their original church (a database rule freezes `church_id`), and
most access rules follow the person's *current* church, so many things are
already right. The problems are where the **old church** can still see the
person's own information:

| Data | Today after a move | Problem? |
|---|---|---|
| Chats and direct messages | Mover loses access to all old-church chats (access requires the channel's church = current church) | No |
| Journal, Bible notes/highlights | Visible only to the person, wherever they are | No |
| Their gifts | Old church keeps them (it received the money); the person still sees their own history | No — correct |
| Pastoral care notes, counselling records, support tickets, comments, messages | Stay with the old church | No — that church's records |
| **Birthday** | Old church's pastors still see it, and it shows in their "Birthdays this week" | **Yes** |
| **Shared prayer requests / testimonies** | Still on the old church's prayer wall | **Yes** |
| **Pending or upcoming pastor bookings** | Stay in the old pastors' queue | **Yes** |
| **RSVPs to upcoming old-church events** | Old church still sees them as attending | **Yes** |

## Change

One database trigger on `app_users`, fired when `church_id` changes (only the
super admin can change it), so no code path can forget it:

1. **Birthday moves with the person** — the old church's row is removed and
   the same date is recorded under the new church (where the new pastors'
   reminders pick it up). The person isn't asked again.
2. **Shared prayers are taken off the old wall** (`is_shared_request` and
   `is_testimony_shared` set to false). They stay on the person's own private
   board; nothing is deleted.
3. **Pending and approved bookings dated today or later are cancelled.**
   Past and completed bookings stay as the old church's history.
4. **RSVPs to old-church events that haven't started are removed.** Past
   attendance stays.
5. One audit-log entry listing how many of each were changed.

Unchanged on purpose: gifts, pastoral care notes, counselling conversations,
support tickets, prayer comments and chat messages stay with the old church.

## Tests

`tests/db/church-move.test.ts`: move a member with a birthday, a shared
prayer, a private prayer, upcoming and past bookings and RSVPs; check the old
church's pastors no longer see the birthday, shared prayer, booking or RSVP,
the new church's pastors see the birthday, the private prayer and the past
history are untouched, and the audit entry is written. Also: a move to the
same church and a non-church change (name, role) do nothing.

## Files

- `supabase/church_move.sql` (migration #32) + the test above
- README: migration list, remove the Known gap, Super Admin note
