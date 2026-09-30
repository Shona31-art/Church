// Shared constants for the pastoral care log (kept out of the "use server"
// actions file, which may only export async functions).
export const LOG_TYPES = [
  "counseling",
  "hospital_visit",
  "home_visit",
  "follow_up",
  "crisis_session",
  "bereavement",
  "birthday_reachout",
  "other",
] as const;

export type LogType = (typeof LOG_TYPES)[number];

export const LOG_TYPE_LABELS: Record<LogType, string> = {
  counseling: "Counselling",
  hospital_visit: "Hospital visit",
  home_visit: "Home visit",
  follow_up: "Follow-up",
  crisis_session: "Crisis session",
  bereavement: "Bereavement support",
  birthday_reachout: "Birthday reach-out",
  other: "Other",
};
