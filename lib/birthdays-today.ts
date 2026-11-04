import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_MEDIA_BUCKET } from "@/lib/chat";
import { todayInAppZone } from "@/lib/format";
import { AVATAR_BUCKET } from "@/lib/avatar-path";
import { birthdayPoster, pictureForPoster, posterThemeFor } from "@/lib/birthday-poster";

// On someone's birthday — a member (member_birthdays) or a child
// (member_children) — unless switched off (record_members.sql: announce):
// the church gets a notification, the person (or a child's parents) gets a
// greeting, and a birthday poster goes in the church's General chat, sent as
// the church. Day and month only — never the age. Run by the morning job
// (/api/cron/daily-verse).

type Person = { id: string; name: string; church_id: string; status: string; avatar_path?: string | null; record_only?: boolean; role?: string };

/** Someone celebrated today. */
type Celebrant = {
  name: string;
  churchId: string;
  /** Their photo in the avatars bucket. */
  photoPath: string | null;
  child: boolean;
  /** Who gets the personal greeting: the member (if they use the app) or the child's parents. */
  greet: string[];
  /** Left out of the church-wide notification (they get their own). */
  skip: string[];
};

type ChildRaw = { id: string; name: string; church_id: string; birth_date: string | null; user_id: string; mother_id?: string | null; father_id?: string | null; photo_path?: string | null; announce?: boolean };

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export async function sendBirthdayGreetings(today = todayInAppZone()): Promise<{ churches: number; people: number; posters: number }> {
  const admin = createAdminClient();
  const md = today.slice(5);
  // Leap-day birthdays are celebrated on 28 February in other years.
  const isToday = (birth: string | null | undefined) => Boolean(birth) && (birth!.slice(5) === md || (md === "02-28" && birth!.slice(5) === "02-29" && !isLeap(Number(today.slice(0, 4)))));

  const celebrants: Celebrant[] = [];

  // Members.
  const { data, error } = await admin.from("member_birthdays").select("*, person:app_users!member_birthdays_user_id_fkey(*)").limit(20000);
  if (error) console.error("[birthdays] members failed:", error.message);
  for (const b of (data ?? []) as { birth_date: string; announce?: boolean; person: Person | null }[]) {
    const p = b.person;
    if (!p || !isToday(b.birth_date) || b.announce === false || p.status !== "active") continue;
    celebrants.push({ name: p.name, churchId: p.church_id, photoPath: p.avatar_path ?? null, child: false, greet: p.record_only ? [] : [p.id], skip: [p.id] });
  }

  // Children (their parents get the greeting).
  const { data: kids, error: kidsErr } = await admin.from("member_children").select("*").not("birth_date", "is", null).limit(20000);
  if (kidsErr && kidsErr.code !== "42P01") console.error("[birthdays] children failed:", kidsErr.message);
  for (const c of (kids ?? []) as ChildRaw[]) {
    if (!isToday(c.birth_date) || c.announce === false) continue;
    const parents = [...new Set([c.user_id, c.mother_id, c.father_id].filter((id): id is string => Boolean(id)))];
    celebrants.push({ name: c.name, churchId: c.church_id, photoPath: c.photo_path ?? null, child: true, greet: parents, skip: parents });
  }

  const byChurch = new Map<string, Celebrant[]>();
  for (const c of celebrants) byChurch.set(c.churchId, [...(byChurch.get(c.churchId) ?? []), c]);

  let people = 0;
  let posters = 0;
  let churches = 0;
  for (const [churchId, birthdays] of byChurch) {
    // Once a day per church.
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("church_id", churchId).eq("type", "birthday.today").gte("created_at", `${today}T00:00:00+02:00`);
    if (count) continue;
    churches++;
    const [{ data: church }, { data: everyone }] = await Promise.all([
      admin.from("churches").select("name, logo_url").eq("id", churchId).maybeSingle(),
      admin.from("app_users").select("*").eq("church_id", churchId).eq("status", "active").limit(5000),
    ]);
    const members = ((everyone ?? []) as Person[]).filter((p) => !p.record_only);
    const inApp = new Set(members.map((m) => m.id));
    const churchName = (church as { name?: string } | null)?.name ?? "church";

    // Notifications: the church, and the birthday people (or a child's parents).
    const rows = birthdays.flatMap((b) => {
      const first = b.name.trim().split(/\s+/)[0];
      const skip = new Set(b.skip);
      const base = { church_id: churchId, category: "church_news", type: "birthday.today", link: "/dashboard/chat" };
      return [
        ...members
          .filter((m) => !skip.has(m.id))
          .map((m) => ({ ...base, user_id: m.id, title: `🎂 It's ${b.name}'s birthday today`, body: b.child ? `Wish ${first} a happy birthday!` : `Send ${first} a blessing!` })),
        ...b.greet
          .filter((id) => inApp.has(id))
          .map((id) =>
            b.child
              ? { ...base, user_id: id, title: `🎂 Happy birthday to ${first}!`, body: `Your church family at ${churchName} is celebrating ${first} today.` }
              : { ...base, user_id: id, title: `🎂 Happy birthday, ${first}!`, body: `From your church family at ${churchName} — we're celebrating you today.` },
          ),
      ];
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error: nErr } = await admin.from("notifications").insert(rows.slice(i, i + 500));
      if (nErr) console.error("[birthdays] notifications failed:", nErr.message);
    }
    people += birthdays.length;

    // The poster in General, sent as the church (chat_messages.from_church); the
    // message is carried by a church admin's (or pastor's) account underneath.
    const sender = members.filter((m) => m.role === "church_admin")[0] ?? members.filter((m) => m.role === "pastor")[0];
    const { data: channels } = await admin.from("chat_channels").select("id, name, created_at").eq("church_id", churchId).eq("is_dm", false).is("department_id", null).order("created_at").limit(10);
    const general = ((channels ?? []) as { id: string; name: string | null }[]).find((c) => /general/i.test(c.name ?? "")) ?? (channels ?? [])[0];
    if (!sender || !general) continue;
    const logo = await logoDataUrl((church as { logo_url?: string | null } | null)?.logo_url ?? null);
    for (const [i, b] of birthdays.entries()) {
      try {
        let photo: string | null = null;
        if (b.photoPath) {
          const { data: file } = await admin.storage.from(AVATAR_BUCKET).download(b.photoPath);
          photo = file ? await pictureForPoster(await file.arrayBuffer()) : null;
        }
        const png = await birthdayPoster({
          name: b.name,
          churchName: (church as { name?: string } | null)?.name ?? "",
          photoDataUrl: photo,
          logoDataUrl: logo,
          date: today,
          theme: b.child ? "kids" : posterThemeFor(today, i),
          child: b.child,
        });
        const path = `${churchId}/${general.id}/${sender.id}/${crypto.randomUUID()}.png`;
        const { error: upErr } = await admin.storage.from(CHAT_MEDIA_BUCKET).upload(path, png, { contentType: "image/png" });
        if (upErr) throw new Error(upErr.message);
        const first = b.name.trim().split(/\s+/)[0];
        const message = {
          channel_id: general.id,
          sender_id: sender.id,
          kind: "image",
          media_path: path,
          content: `🎂 Happy birthday, ${first}! Today we celebrate ${b.name} — send your blessings below 🎉`,
        };
        let { error: msgErr } = await admin.from("chat_messages").insert({ ...message, from_church: true });
        // Before record_members.sql adds from_church, post it the old way.
        if (msgErr && /from_church/.test(msgErr.message)) ({ error: msgErr } = await admin.from("chat_messages").insert(message));
        if (msgErr) throw new Error(msgErr.message);
        posters++;
      } catch (e) {
        console.error("[birthdays] poster failed:", (e as Error).message);
      }
    }
  }
  return { churches, people, posters };
}

/** The church logo as a data URL for the poster (null if there isn't one or it won't load). */
async function logoDataUrl(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return null;
    return await pictureForPoster(await res.arrayBuffer(), 240);
  } catch {
    return null;
  }
}
