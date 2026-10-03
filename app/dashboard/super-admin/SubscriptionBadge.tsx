import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

const MAP: Record<string, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  trial: { tone: "info", label: "Trial" },
  grace: { tone: "warning", label: "Payment failed" },
  payment_pending: { tone: "warning", label: "Payment pending" },
  suspended: { tone: "danger", label: "Suspended" },
  none: { tone: "neutral", label: "No subscription" },
};

export function SubscriptionBadge({ status }: { status: string }) {
  const s = MAP[status] ?? MAP.none;
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
