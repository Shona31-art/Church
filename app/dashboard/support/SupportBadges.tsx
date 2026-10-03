import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  open: { tone: "info", label: "Open" },
  in_progress: { tone: "warning", label: "In progress" },
  closed: { tone: "neutral", label: "Closed" },
};

export function TicketStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as const, label: status };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "high") return <StatusBadge tone="danger">High priority</StatusBadge>;
  if (priority === "low") return <StatusBadge tone="neutral">Low priority</StatusBadge>;
  return null;
}
