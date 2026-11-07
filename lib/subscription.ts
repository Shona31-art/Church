// Subscription and plan rules, kept free of database/server imports so they
// can be unit-tested and shared with the billing and super-admin screens.

export const MODULE_KEYS = [
  "members",
  "announcements",
  "calendar",
  "service_planner",
  "pastor_booking",
  "ai_poster",
  "sermon_ai",
  "dept_chats",
  "bible",
  "analytics",
  "multi_campus",
  "ai_counseling",
  "prayer_board",
  "journal",
  "support",
  "bible_games",
  "giving",
  "pastoral_care",
  "bible_study_ai",
  // Switches for costly parts of otherwise free features (plan_basic_v2.sql):
  "ai_assist", // AI helper buttons inside announcements, prayers, quiz questions
  "chat_voice", // voice notes in chat (Storage)
  "chat_photos", // photo sharing in chat (Storage) — in no plan by default
  "video_calls", // voice and video calls in chats and for pastor appointments (built in)
  // church_life.sql (#60):
  "live_sunday",
  "sermon_notes",
  "testimonies",
  "reading_plans",
  "prayer_chain",
  "rosters",
  "certificates",
  "weekly_report",
  // Plans, November 2026 (church_life.sql section 11):
  "sermon_uploads", // uploading sermon audio/video (storage); Grace can still post links
  "priority_support",
  "church_colours",
  // Plans v4 (plans_v4.sql): AI poster pictures, apart from AI writing help.
  "ai_pictures",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Names people see. The `modules` table holds the same list for super admins. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  members: "Member management",
  announcements: "Announcements",
  calendar: "Calendar",
  service_planner: "Service Planner",
  pastor_booking: "Pastor Booking",
  ai_poster: "Poster Studio",
  sermon_ai: "Sermons",
  dept_chats: "Chats",
  bible: "Bible reader",
  analytics: "Analytics",
  multi_campus: "Multiple campuses",
  ai_counseling: "AI Counseling",
  prayer_board: "Prayer Board",
  journal: "Journal",
  support: "Support",
  bible_games: "Bible Games",
  giving: "Giving",
  pastoral_care: "Pastoral Care",
  bible_study_ai: "Bible Study AI",
  ai_assist: "AI writing help",
  chat_voice: "Chat voice notes",
  chat_photos: "Chat photo sharing",
  video_calls: "Voice & video calls",
  live_sunday: "Live Sunday",
  sermon_notes: "Sermon notes",
  testimonies: "Testimonies",
  reading_plans: "Reading plans",
  prayer_chain: "Prayer chain",
  rosters: "Volunteer rosters",
  certificates: "Certificates",
  weekly_report: "Monday report",
  sermon_uploads: "Sermon uploads",
  priority_support: "Priority support",
  church_colours: "Church colours",
  ai_pictures: "AI poster pictures",
};

/**
 * Fuller names for the plan cards on Billing, so churches see what each
 * feature now covers (MODULE_LABELS stays short for menus and messages).
 */
export const PLAN_CARD_LABELS: Partial<Record<ModuleKey, string>> = {
  members: "Members, children & birthdays",
  announcements: "Announcements",
  calendar: "Calendar & events",
  service_planner: "Service planner",
  pastor_booking: "Pastor appointments & counselling bookings",
  ai_poster: "Poster Studio & church flyers (cut-out photos)",
  sermon_ai: "Sermons (YouTube, Facebook & audio links)",
  dept_chats: "Church & group chats",
  bible: "Bible reader, works offline",
  ai_counseling: "AI counselling companion",
  prayer_board: "Prayer wall",
  journal: "Private prayer journal",
  support: "Help & support",
  bible_games: "Bible games, quiz duels & whole-church challenges",
  giving: "Giving (EFT & card)",
  pastoral_care: "Pastoral care follow-ups",
  bible_study_ai: "AI Bible study helper",
  ai_assist: "AI writing help",
  chat_voice: "Voice notes in chat",
  chat_photos: "Photos in chat",
  video_calls: "Voice & video calls (incl. group calls)",
  live_sunday: "Live Sunday: livestream, order of service & lyrics",
  sermon_notes: "Fill-in-the-blank sermon notes",
  testimonies: "Testimonies wall",
  reading_plans: "Bible reading plans with streaks",
  prayer_chain: "24-hour prayer chain with reminders",
  rosters: "Volunteer rosters with reminders & swaps",
  certificates: "Baptism, dedication & membership certificates",
  weekly_report: "Monday morning report by email",
  sermon_uploads: "Upload sermon recordings (audio & video)",
  priority_support: "Priority support — WhatsApp, answered the same day",
  church_colours: "Your church's own colours in the app",
};

/** Not plan switches: in every plan, shown once above the plan cards. */
export const EVERY_PLAN_INCLUDES = [
  "Android app & phone notifications",
  "Worship songs & lyrics",
  "Install on any phone (iPhone too)",
  "Your church's own logo",
];

/** Listed in plans but not built yet: never shown on the plan cards (see app/dashboard/setup). */
export const UNBUILT_MODULES: readonly ModuleKey[] = ["analytics", "multi_campus"];

/** The AI tools: a plan with none of these says "No AI tools". */
export const AI_MODULES: readonly ModuleKey[] = ["ai_counseling", "bible_study_ai", "ai_assist", "ai_pictures"];

export const PLAN_LABELS: Record<string, string> = {
  free_trial: "Free trial",
  basic: "Grace",
  premium: "Grace Plus",
  enterprise: "Unlimited (no longer offered)",
  sponsored: "Sponsored",
};

export type EffectiveStatus = "active" | "trial" | "grace" | "suspended" | "payment_pending";

export interface SubscriptionRow {
  plan_key: string;
  status: string;
  is_lifetime?: boolean | null;
  trial_expires_at?: string | null;
  grace_period_end?: string | null;
}

/**
 * What a church's subscription means *right now*. The stored status can lag
 * behind reality (nothing flips a trial to suspended at midnight), so expiry
 * dates are checked here on every request instead of trusting the column.
 */
export function resolveAccountStatus(sub: SubscriptionRow, now: Date = new Date()): EffectiveStatus {
  if (sub.is_lifetime) return "active";
  if (sub.status === "suspended") return "suspended";

  if (sub.plan_key === "free_trial") {
    if (sub.trial_expires_at && now > new Date(sub.trial_expires_at)) return "suspended";
    return "trial";
  }

  if (sub.status === "grace") {
    if (sub.grace_period_end && now > new Date(sub.grace_period_end)) return "suspended";
    return "grace";
  }

  if (sub.status === "payment_pending") return "payment_pending";
  return "active";
}

/** Whole days left before `iso` (0 on the last day), or null if no date. */
export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}

/**
 * Modules enabled for a church: the plan's defaults, then per-church
 * overrides from a super admin (which win in either direction).
 */
export function enabledModules(
  planModules: readonly string[],
  overrides: readonly { module_key: string; enabled: boolean }[]
): Set<ModuleKey> {
  const enabled = new Set(planModules.filter((k): k is ModuleKey => (MODULE_KEYS as readonly string[]).includes(k)));
  for (const o of overrides) {
    if (!(MODULE_KEYS as readonly string[]).includes(o.module_key)) continue;
    if (o.enabled) enabled.add(o.module_key as ModuleKey);
    else enabled.delete(o.module_key as ModuleKey);
  }
  return enabled;
}
