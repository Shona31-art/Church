// Who may do what — the single source of truth for role checks in the app.
//
// Pages use these to decide what to show; server actions use the same
// functions to decide what to allow. The database (RLS + triggers in
// supabase/*.sql) enforces the same rules independently, so a mistake here
// shows the wrong button rather than leaking data. When you change a rule,
// change the matching policy too (README "Roles" table lists both).

export const ROLES = ["super_admin", "church_admin", "pastor", "department_leader", "member"] as const;
export type Role = (typeof ROLES)[number];

/** Roles a church can hold. super_admin is platform staff and never belongs to a church. */
export const CHURCH_ROLES = ["church_admin", "pastor", "department_leader", "member"] as const;
export type ChurchRole = (typeof CHURCH_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Platform admin",
  church_admin: "Church admin",
  pastor: "Pastor",
  department_leader: "Department leader",
  member: "Member",
};

export const ACCOUNT_STATUSES = ["active", "invited", "disabled"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  invited: "Invite sent",
  disabled: "Deactivated",
};

const ADMIN: readonly Role[] = ["church_admin"];
const SHEPHERDS: readonly Role[] = ["church_admin", "pastor"];
const LEADERS: readonly Role[] = ["church_admin", "pastor", "department_leader"];
const CHURCH_PEOPLE: readonly Role[] = CHURCH_ROLES;

const CAPABILITIES = {
  // People
  viewMembers: SHEPHERDS,
  manageMembers: SHEPHERDS, // add, edit, deactivate (pastors can't touch church admins — see canEditMemberRole)
  deleteMembers: ADMIN, // permanent POPIA erasure
  exportMemberData: ADMIN,
  manageDepartments: SHEPHERDS,
  deleteDepartments: ADMIN,

  // Church life
  postAnnouncements: LEADERS, // leaders: own department only
  postChurchWide: SHEPHERDS, // church-wide audience, pinning
  createEvents: LEADERS, // leaders: own department only
  manageSermons: SHEPHERDS,
  planServices: SHEPHERDS,
  manageBookings: SHEPHERDS, // approve/decline, availability
  makePosters: LEADERS,
  managePosters: SHEPHERDS, // edit/delete anyone's poster

  // Care (confidential)
  pastoralCare: SHEPHERDS,
  moderatePrayerWall: SHEPHERDS,
  moderateChat: SHEPHERDS, // delete others' messages in church and department channels (never DMs)
  manageChatChannels: SHEPHERDS, // create extra channels, rename them, choose members
  deleteChatChannels: ADMIN, // permanently delete department/extra channels (never General)
  reviewCounseling: SHEPHERDS, // flagged / shared AI-counseling conversations
  configureCounseling: SHEPHERDS,
  manageQuizQuestions: SHEPHERDS,

  // Admin
  manageChurchProfile: ADMIN,
  manageBilling: ADMIN,
  viewGivingReport: ADMIN,
  manageSupportTickets: ADMIN, // status changes on own church's tickets

  // Everyone in a church
  useChurchFeatures: CHURCH_PEOPLE,
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: string | null | undefined, capability: Capability): boolean {
  return Boolean(role && (CAPABILITIES[capability] as readonly string[]).includes(role));
}

export function isShepherd(role: string | null | undefined): boolean {
  return can(role, "pastoralCare");
}

export function isChurchRole(value: unknown): value is ChurchRole {
  return typeof value === "string" && (CHURCH_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role.replaceAll("_", " ");
}

/**
 * Roles `actorRole` may give someone (or take away). Mirrors the
 * protect_app_users_privileged_columns trigger: only a church admin may grant
 * or remove church admin; nobody assigns super_admin from inside a church.
 */
export function assignableRoles(actorRole: string): ChurchRole[] {
  if (actorRole === "church_admin" || actorRole === "super_admin") return [...CHURCH_ROLES];
  if (actorRole === "pastor") return ["pastor", "department_leader", "member"];
  return [];
}

/** Can `actor` change this member's role, status or department? */
export function canEditMemberRole(actor: { id: string; role: string }, target: { id: string; role: string }): boolean {
  if (actor.id === target.id) return false; // nobody changes their own role/status
  if (!can(actor.role, "manageMembers")) return false;
  if (target.role === "church_admin" && actor.role !== "church_admin") return false;
  return true;
}
