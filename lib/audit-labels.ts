/**
 * Plain-English wording for audit log entries ("department.created" →
 * "Added a department"). Shared by the platform audit log and the overview.
 */

/** Filter groups: the action prefix → what it's called. */
export const AUDIT_CATEGORIES: Record<string, string> = {
  auth: "Sign-ins",
  member: "Members",
  user: "Platform users",
  church: "Church profile",
  department: "Departments",
  announcement: "Announcements",
  event: "Events",
  rsvp: "Event RSVPs",
  sermon: "Sermons",
  song: "Songs",
  song_settings: "Worship team",
  songs: "Song imports",
  service_plan: "Service plans",
  service_plan_item: "Service plan items",
  poster: "Posters",
  prayer: "Prayer wall",
  prayer_wall: "Prayer wall moderation",
  prayer_comment: "Prayer comments",
  pastoral_care: "Pastoral care",
  availability: "Pastor time away",
  booking: "Bookings",
  giving: "Giving",
  giving_details: "Giving bank details",
  card_giving: "Card giving",
  chat: "Chat",
  chat_channel: "Chat groups",
  chat_member: "Chat group members",
  chat_restriction: "Chat restrictions",
  counseling: "Counseling",
  counseling_settings: "Counseling settings",
  birthday: "Birthdays",
  jigsaw_picture: "Jigsaw pictures",
  billing: "Billing",
  subscription: "Subscriptions",
  church_module: "Church features",
  plan: "Plans & prices",
  plan_module: "Plan features",
  support_ticket: "Support tickets",
  account: "Account",
};

const NOUNS: Record<string, string> = {
  member: "member",
  church: "church",
  department: "department",
  announcement: "announcement",
  event: "event",
  rsvp: "event RSVP",
  sermon: "sermon",
  song: "song",
  song_settings: "worship team settings",
  service_plan: "service plan",
  service_plan_item: "service plan item",
  poster: "poster",
  prayer: "prayer request",
  prayer_comment: "prayer comment",
  pastoral_care: "pastoral care note",
  availability: "time away",
  booking: "booking",
  giving: "giving record",
  giving_details: "giving bank details",
  card_giving: "card giving settings",
  chat_channel: "chat group",
  chat_member: "chat group member",
  chat_restriction: "chat restriction",
  counseling_settings: "counseling settings",
  birthday: "birthday",
  jigsaw_picture: "jigsaw picture",
  subscription: "subscription",
  church_module: "church feature",
  plan: "plan",
  plan_module: "plan feature",
  support_ticket: "support ticket",
};

const SPECIFIC: Record<string, string> = {
  "auth.signed_in": "Signed in",
  "auth.signed_out": "Signed out",
  "member.role_changed": "Changed a member's role",
  "member.password_set": "Set a member's password",
  "member.invite_resent": "Resent an invite",
  "member.photo_removed": "Removed a member's photo",
  "member.chat_restricted": "Restricted a member from chat",
  "member.chat_restriction_lifted": "Lifted a chat restriction",
  "user.created_by_platform": "Created a user (platform)",
  "user.deleted_by_platform": "Deleted a user (platform)",
  "user.password_set_by_platform": "Set a user's password (platform)",
  "church.profile_updated": "Updated the church profile",
  "church.logo_updated": "Changed the church logo",
  "church.logo_removed": "Removed the church logo",
  "chat.dm_deleted": "Deleted a direct message chat",
  "chat.channel_deleted": "Deleted a chat group",
  "chat.message_removed": "Removed a chat message",
  "prayer_wall.removed": "Removed a prayer from the wall",
  "counseling.crisis_flagged": "Crisis language flagged",
  "counseling.escalation_acknowledged": "Followed up a counseling flag",
  "counseling.settings_changed": "Changed counseling settings",
  "giving.exported": "Exported giving records",
  "card_giving.enabled": "Turned on card giving",
  "card_giving.disabled": "Turned off card giving",
  "billing.subscribed": "Subscribed to a plan",
  "billing.renewed": "Subscription renewed",
  "billing.payment_failed": "Payment failed",
  "billing.cancelled": "Cancelled the subscription",
  "billing.ended_after_cancel": "Subscription ended",
  "subscription.updated": "Subscription changed",
  "songs.imported": "Imported songs",
  "plan.updated": "Changed a plan's price or details",
  "account.email_change_requested": "Asked to change their email",
  "booking_cancelled_by_requester": "Cancelled a booking",
};

const VERBS: Record<string, string> = { created: "Added", updated: "Edited", deleted: "Deleted" };

function humanize(text: string) {
  const s = text.replace(/[._]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "department.created" → "Added a department". */
export function describeAction(action: string): string {
  if (SPECIFIC[action]) return SPECIFIC[action];
  const dot = action.lastIndexOf(".");
  if (dot > 0) {
    const entity = action.slice(0, dot);
    const verb = VERBS[action.slice(dot + 1)];
    const noun = NOUNS[entity];
    if (verb && noun) {
      const article = /(settings|details)$/.test(noun) ? "the" : /^[aeiou]/.test(noun) ? "an" : "a";
      return `${verb} ${article} ${noun}`;
    }
  }
  return humanize(action);
}

/** The filter group an action belongs to. */
export function actionCategory(action: string): string {
  const dot = action.indexOf(".");
  return dot > 0 ? action.slice(0, dot) : action;
}

/** Column names → readable "title, start time" (for "what changed" on edits). */
export function describeChangedFields(fields: unknown): string | null {
  if (!Array.isArray(fields) || !fields.length) return null;
  return fields
    .filter((f): f is string => typeof f === "string")
    .map((f) => f.replace(/_id$/, "").replace(/_/g, " "))
    .join(", ");
}

/** A short device description from a user-agent ("Android · Chrome"). */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
    ? "Android"
    : /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
    ? "Mac"
    : /Linux/.test(ua)
    ? "Linux"
    : "Other";
  const browser = /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
    ? "Opera"
    : /Firefox|FxiOS/.test(ua)
    ? "Firefox"
    : /Chrome|CriOS/.test(ua)
    ? "Chrome"
    : /Safari/.test(ua)
    ? "Safari"
    : "Browser";
  return `${os} · ${browser}`;
}
