import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, asUser } from "./harness";

// chat_v2.sql. Every query runs as a real end user with RLS on — what someone
// could do from the browser console with the public anon key.

const CHURCH_A = "00000000-0000-0000-0000-00000000000a";
const CHURCH_B = "00000000-0000-0000-0000-00000000000b";
const YOUTH = "30000000-0000-0000-0000-000000000001";
const ADMIN = "10000000-0000-0000-0000-000000000001";
const PASTOR = "10000000-0000-0000-0000-000000000002";
const ALICE = "10000000-0000-0000-0000-000000000003";
const BOB = "10000000-0000-0000-0000-000000000004";
const LEADER = "10000000-0000-0000-0000-000000000005";
const CAROL = "10000000-0000-0000-0000-000000000006";
const OUTSIDER = "20000000-0000-0000-0000-000000000001";
const GENERAL = "40000000-0000-0000-0000-000000000001";
const YOUTH_CHANNEL = "40000000-0000-0000-0000-000000000002";

let db: PGlite;

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query<any>(sql, params)).rows;
}

/** Runs as `user`; resolves to the error message, or null if it succeeded. */
async function attempt(user: string, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await asUser(db, user, () => rows(sql, params));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

async function send(user: string, channel: string, content: string, kind = "text", mediaPath: string | null = null) {
  const [row] = await asUser(db, user, () =>
    rows(`insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, $3, $4, $5) returning id`, [
      channel,
      user,
      content,
      kind,
      mediaPath,
    ])
  );
  return row.id as string;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.exec(`
    insert into churches (id, name) values ('${CHURCH_A}', 'Church A'), ('${CHURCH_B}', 'Church B');
    insert into departments (id, church_id, name) values ('${YOUTH}', '${CHURCH_A}', 'Youth');
    insert into auth.users (id) values ('${ADMIN}'), ('${PASTOR}'), ('${ALICE}'), ('${BOB}'), ('${LEADER}'), ('${CAROL}'), ('${OUTSIDER}');
    insert into app_users (id, church_id, department_id, name, email, role, status) values
      ('${ADMIN}',    '${CHURCH_A}', null,       'Admin',    'a@a.test', 'church_admin',      'active'),
      ('${PASTOR}',   '${CHURCH_A}', null,       'Pastor',   'p@a.test', 'pastor',            'active'),
      ('${ALICE}',    '${CHURCH_A}', null,       'Alice',    'al@a.test','member',            'active'),
      ('${BOB}',      '${CHURCH_A}', null,       'Bob',      'b@a.test', 'member',            'active'),
      ('${LEADER}',   '${CHURCH_A}', '${YOUTH}', 'Leader',   'l@a.test', 'department_leader', 'active'),
      ('${CAROL}',    '${CHURCH_A}', null,       'Carol',    'c@a.test', 'member',            'active'),
      ('${OUTSIDER}', '${CHURCH_B}', null,       'Outsider', 'o@b.test', 'member',            'active');
    -- Premium: voice notes are a plan feature (plan_basic_v2.sql).
    insert into church_subscriptions (church_id, plan_key, status) values ('${CHURCH_A}', 'premium', 'active');
    insert into chat_channels (id, church_id, department_id, name, is_dm) values
      ('${GENERAL}', '${CHURCH_A}', null, 'General', false),
      ('${YOUTH_CHANNEL}', '${CHURCH_A}', '${YOUTH}', 'Youth', false);
  `);
}, 120_000);

describe("profile settings", () => {
  test("a member can set their own About, DM privacy and photo", async () => {
    const error = await attempt(
      ALICE,
      `update app_users set about = 'Worship team · Alto', dm_privacy = 'leaders', avatar_path = $2 where id = $1`,
      [ALICE, `${CHURCH_A}/${ALICE}/photo.webp`]
    );
    expect(error).toBeNull();
  });

  test("a photo outside your own folder is rejected", async () => {
    const error = await attempt(ALICE, `update app_users set avatar_path = $2 where id = $1`, [ALICE, `${CHURCH_A}/${BOB}/x.webp`]);
    expect(error).toMatch(/own folder/);
  });

  test("a pastor can't change someone else's privacy settings", async () => {
    const error = await attempt(PASTOR, `update app_users set dm_privacy = 'everyone' where id = $1`, [ALICE]);
    expect(error).toMatch(/Only the member/);
  });

  test("a pastor can remove someone's photo but not set one", async () => {
    expect(await attempt(PASTOR, `update app_users set avatar_path = null where id = $1`, [ALICE])).toBeNull();
    const error = await attempt(PASTOR, `update app_users set avatar_path = $2 where id = $1`, [ALICE, `${CHURCH_A}/${ALICE}/p.webp`]);
    expect(error).toMatch(/Only the member/);
  });
});

describe("starting DMs: privacy and blocks", () => {
  test("'leaders only' blocks members but lets department leaders in", async () => {
    // Alice set dm_privacy = 'leaders' above.
    expect(await attempt(BOB, `select start_direct_message($1)`, [ALICE])).toMatch(/isn't accepting/);
    expect(await attempt(LEADER, `select start_direct_message($1)`, [ALICE])).toBeNull();
  });

  test("'nobody' still lets pastors and church admins start a DM", async () => {
    await asUser(db, CAROL, () => rows(`update app_users set dm_privacy = 'nobody' where id = $1`, [CAROL]));
    expect(await attempt(BOB, `select start_direct_message($1)`, [CAROL])).toMatch(/isn't accepting/);
    expect(await attempt(PASTOR, `select start_direct_message($1)`, [CAROL])).toBeNull();
    expect(await attempt(ADMIN, `select start_direct_message($1)`, [CAROL])).toBeNull();
  });

  test("a block stops everyone, pastors included, and stops messages in an existing DM", async () => {
    const [{ dm }] = await asUser(db, PASTOR, () => rows(`select start_direct_message($1) as dm`, [BOB]));
    await send(PASTOR, dm, "Checking in");

    await asUser(db, BOB, () => rows(`insert into chat_blocks (blocker_id, blocked_id) values ($1, $2)`, [BOB, PASTOR]));
    const sendError = await attempt(PASTOR, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hi')`, [dm, PASTOR]);
    expect(sendError).toMatch(/row-level security/);

    // The blocked person can't see the block exists.
    expect(await asUser(db, PASTOR, () => rows(`select * from chat_blocks`))).toHaveLength(0);
    await asUser(db, BOB, () => rows(`delete from chat_blocks where blocker_id = $1`, [BOB]));
  });
});

describe("editing and deleting", () => {
  let mine: string;

  test("you can edit your own text message, and it's marked edited", async () => {
    mine = await send(BOB, GENERAL, "Helo all");
    expect(await attempt(BOB, `select edit_chat_message($1, 'Hello all')`, [mine])).toBeNull();
    const [m] = await rows(`select content, edited_at from chat_messages where id = $1`, [mine]);
    expect(m.content).toBe("Hello all");
    expect(m.edited_at).not.toBeNull();
  });

  test("you can't edit someone else's message", async () => {
    expect(await attempt(ALICE, `select edit_chat_message($1, 'hacked')`, [mine])).toMatch(/own messages/);
  });

  test("editing closes after 15 minutes", async () => {
    await db.query(`update chat_messages set created_at = now() - interval '16 minutes' where id = $1`, [mine]);
    expect(await attempt(BOB, `select edit_chat_message($1, 'late edit')`, [mine])).toMatch(/15 minutes/);
  });

  test("direct UPDATE and DELETE from the browser do nothing", async () => {
    await asUser(db, BOB, () => rows(`update chat_messages set content = 'sneaky' where id = $1`, [mine]));
    await asUser(db, BOB, () => rows(`delete from chat_messages where id = $1`, [mine]));
    const [m] = await rows(`select content from chat_messages where id = $1`, [mine]);
    expect(m.content).toBe("Hello all");
  });

  test("deleting leaves a placeholder with the text wiped", async () => {
    expect(await attempt(BOB, `select delete_chat_message($1)`, [mine])).toBeNull();
    const [m] = await rows(`select content, deleted_at, deleted_by from chat_messages where id = $1`, [mine]);
    expect(m).toMatchObject({ content: "", deleted_by: BOB });
    expect(m.deleted_at).not.toBeNull();
  });

  test("members can't delete other people's messages", async () => {
    const theirs = await send(ALICE, GENERAL, "Morning!");
    expect(await attempt(BOB, `select delete_chat_message($1)`, [theirs])).toMatch(/own messages/);
  });

  test("pastors can moderate group channels but never DMs", async () => {
    const groupMessage = await send(ALICE, GENERAL, "Off-topic");
    expect(await attempt(PASTOR, `select delete_chat_message($1)`, [groupMessage])).toBeNull();

    const [{ dm }] = await asUser(db, LEADER, () => rows(`select start_direct_message($1) as dm`, [BOB]));
    const dmMessage = await send(BOB, dm, "Private");
    expect(await attempt(PASTOR, `select delete_chat_message($1)`, [dmMessage])).toMatch(/own messages/);
  });
});

describe("replies and reactions", () => {
  test("a reply must quote a message from the same conversation", async () => {
    const youthMessage = await send(LEADER, YOUTH_CHANNEL, "Youth only");
    const error = await attempt(BOB, `insert into chat_messages (channel_id, sender_id, content, reply_to_id) values ($1, $2, 're', $3)`, [
      GENERAL,
      BOB,
      youthMessage,
    ]);
    expect(error).toMatch(/same conversation/);
  });

  test("one reaction per person, from the allowed set", async () => {
    const message = await send(ALICE, GENERAL, "Prayer meeting at 7");
    const react = (emoji: string) =>
      attempt(
        BOB,
        `insert into chat_message_reactions (message_id, user_id, channel_id, emoji) values ($1, $2, $3, $4)
         on conflict (message_id, user_id) do update set emoji = excluded.emoji`,
        [message, BOB, GENERAL, emoji]
      );
    expect(await react("🙏")).toBeNull();
    expect(await react("❤️")).toBeNull();
    expect(await react("🍕")).toMatch(/check constraint/);
    expect(await rows(`select emoji from chat_message_reactions where message_id = $1`, [message])).toEqual([{ emoji: "❤️" }]);
  });

  test("you can't react in a channel you can't see", async () => {
    const youthMessage = await send(LEADER, YOUTH_CHANNEL, "Camp list");
    const error = await attempt(BOB, `insert into chat_message_reactions (message_id, user_id, channel_id, emoji) values ($1, $2, $3, '👍')`, [
      youthMessage,
      BOB,
      YOUTH_CHANNEL,
    ]);
    expect(error).toMatch(/row-level security/);
  });
});

describe("admin restrictions", () => {
  test("members can't restrict anyone", async () => {
    const error = await attempt(ALICE, `insert into member_chat_restrictions (church_id, user_id, kind, reason, created_by) values ($1, $2, 'group_mute', 'spam', $3)`, [
      CHURCH_A,
      BOB,
      ALICE,
    ]);
    expect(error).toMatch(/row-level security/);
  });

  test("a pastor can't restrict a church admin", async () => {
    const error = await attempt(PASTOR, `insert into member_chat_restrictions (church_id, user_id, kind, reason, created_by) values ($1, $2, 'group_mute', 'test', $3)`, [
      CHURCH_A,
      ADMIN,
      PASTOR,
    ]);
    expect(error).toMatch(/row-level security/);
  });

  test("a group mute stops group posts but not DMs; voice-off stops voice notes", async () => {
    await asUser(db, PASTOR, () =>
      rows(
        `insert into member_chat_restrictions (church_id, user_id, kind, reason, created_by) values
         ($1, $2, 'group_mute', 'Repeated off-topic posts', $3), ($1, $2, 'no_voice', 'Inappropriate audio', $3)`,
        [CHURCH_A, CAROL, PASTOR]
      )
    );
    expect(await attempt(CAROL, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'hi')`, [GENERAL, CAROL])).toMatch(/row-level security/);

    const [{ dm }] = await asUser(db, PASTOR, () => rows(`select start_direct_message($1) as dm`, [CAROL]));
    expect(await attempt(CAROL, `insert into chat_messages (channel_id, sender_id, content) values ($1, $2, 'sorry')`, [dm, CAROL])).toBeNull();
    const voiceError = await attempt(CAROL, `insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, '', 'voice', $3)`, [
      dm,
      CAROL,
      `${CHURCH_A}/${dm}/${CAROL}/note.webm`,
    ]);
    expect(voiceError).toMatch(/row-level security/);

    // The member can see why.
    expect(await asUser(db, CAROL, () => rows(`select kind from member_chat_restrictions order by kind`))).toEqual([{ kind: "group_mute" }, { kind: "no_voice" }]);
  });
});

describe("voice notes and photos", () => {
  test("a voice note's file must be in this conversation's folder", async () => {
    const error = await attempt(BOB, `insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, '', 'voice', $3)`, [
      GENERAL,
      BOB,
      `${CHURCH_A}/${YOUTH_CHANNEL}/${BOB}/note.webm`,
    ]);
    expect(error).toMatch(/conversation's folder/);
    expect(await send(BOB, GENERAL, "", "voice", `${CHURCH_A}/${GENERAL}/${BOB}/note.webm`)).toBeTruthy();
  });

  test("the nightly job (service role) can expire a voice note; members can't fake one", async () => {
    const note = await send(ALICE, GENERAL, "", "voice", `${CHURCH_A}/${GENERAL}/${ALICE}/old.webm`);
    await asUser(db, null, () => rows(`update chat_messages set media_path = null, media_expired_at = now() where id = $1`, [note]));
    const [m] = await rows(`select media_path, media_expired_at from chat_messages where id = $1`, [note]);
    expect(m.media_path).toBeNull();
    expect(m.media_expired_at).not.toBeNull();

    // A voice note with no file, sent as already-expired, is refused.
    const fake = await attempt(ALICE, `insert into chat_messages (channel_id, sender_id, content, kind, media_expired_at) values ($1, $2, '', 'voice', now())`, [GENERAL, ALICE]);
    expect(fake).toMatch(/row-level security/);
  });

  test("photos are refused until the church has photo sharing switched on", async () => {
    const photo = `${CHURCH_A}/${GENERAL}/${BOB}/pic.webp`;
    const sql = `insert into chat_messages (channel_id, sender_id, content, kind, media_path) values ($1, $2, '', 'image', $3)`;
    expect(await attempt(BOB, sql, [GENERAL, BOB, photo])).toMatch(/row-level security/);

    await db.query(`insert into church_modules (church_id, module_key, enabled) values ($1, 'chat_photos', true)`, [CHURCH_A]);
    expect(await attempt(BOB, sql, [GENERAL, BOB, photo])).toBeNull();
  });

  test("chat files: you can upload only into a chat you're in, as yourself", async () => {
    const upload = (path: string) => attempt(BOB, `insert into storage.objects (bucket_id, name) values ('chat-media', $1)`, [path]);
    expect(await upload(`${CHURCH_A}/${GENERAL}/${BOB}/ok.webm`)).toBeNull();
    expect(await upload(`${CHURCH_A}/${YOUTH_CHANNEL}/${BOB}/no.webm`)).toMatch(/row-level security/);
    expect(await upload(`${CHURCH_A}/${GENERAL}/${ALICE}/spoof.webm`)).toMatch(/row-level security/);
    expect(await upload(`${CHURCH_A}/not-a-uuid/${BOB}/x.webm`)).toMatch(/row-level security/);
  });

  test("profile photos are visible inside the church only", async () => {
    await asUser(db, ALICE, () => rows(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${CHURCH_A}/${ALICE}/me.webp`]));
    expect(await asUser(db, BOB, () => rows(`select name from storage.objects where bucket_id = 'avatars'`))).toHaveLength(1);
    expect(await asUser(db, OUTSIDER, () => rows(`select name from storage.objects where bucket_id = 'avatars'`))).toHaveLength(0);
    expect(await attempt(BOB, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${CHURCH_A}/${ALICE}/fake.webp`])).toMatch(
      /row-level security/
    );
  });
});

describe("read receipts", () => {
  test("receipts are shared only by — and with — people who have them on", async () => {
    const [{ dm }] = await asUser(db, ALICE, () => rows(`select start_direct_message($1) as dm`, [LEADER]));
    await asUser(db, LEADER, () => rows(`select mark_chat_read($1)`, [dm]));
    expect(await asUser(db, ALICE, () => rows(`select user_id from chat_read_receipts where channel_id = $1`, [dm]))).toEqual([{ user_id: LEADER }]);

    // Alice turns receipts off: she stops seeing others', and hers are withdrawn.
    await asUser(db, ALICE, () => rows(`select mark_chat_read($1)`, [dm]));
    await asUser(db, ALICE, () => rows(`update app_users set share_read_receipts = false where id = $1`, [ALICE]));
    expect(await asUser(db, ALICE, () => rows(`select * from chat_read_receipts where channel_id = $1`, [dm]))).toHaveLength(0);
    expect(await asUser(db, LEADER, () => rows(`select user_id from chat_read_receipts where channel_id = $1`, [dm]))).toEqual([{ user_id: LEADER }]);
  });

  test("your private 'last read' is visible only to you", async () => {
    await asUser(db, BOB, () => rows(`select mark_chat_read($1)`, [GENERAL]));
    expect(await asUser(db, ALICE, () => rows(`select * from chat_member_settings where user_id = $1`, [BOB]))).toHaveLength(0);
    expect(await asUser(db, BOB, () => rows(`select last_read_at from chat_member_settings where channel_id = $1`, [GENERAL]))).toHaveLength(1);
  });

  test("chat settings: your own only, and only for chats you're in", async () => {
    const save = (user: string, channel: string) =>
      attempt(user, `insert into chat_member_settings (channel_id, user_id, pinned_at) values ($1, $2, now())
                     on conflict (channel_id, user_id) do update set pinned_at = excluded.pinned_at`, [channel, user]);
    expect(await save(BOB, GENERAL)).toBeNull();
    expect(await save(BOB, YOUTH_CHANNEL)).toMatch(/row-level security/);
    expect(await attempt(BOB, `insert into chat_member_settings (channel_id, user_id) values ($1, $2)`, [GENERAL, ALICE])).toMatch(/row-level security/);
  });

  test("outsiders can't mark another church's chat read", async () => {
    expect(await attempt(OUTSIDER, `select mark_chat_read($1)`, [GENERAL])).toMatch(/access/);
  });
});
