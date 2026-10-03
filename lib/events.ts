// Calendar constants shared by the event form (client) and actions (server).

export const EVENT_CATEGORIES = ["service", "meeting", "youth", "outreach", "wedding", "funeral", "social", "other"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  service: "Service",
  meeting: "Meeting",
  youth: "Youth",
  outreach: "Outreach",
  wedding: "Wedding",
  funeral: "Funeral",
  social: "Social",
  other: "Other",
};

export const RSVP_LABELS = { going: "Going", maybe: "Maybe", declined: "Can't make it" } as const;
export type RsvpStatus = keyof typeof RSVP_LABELS;
