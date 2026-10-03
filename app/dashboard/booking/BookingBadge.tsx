import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/booking";

const TONE: Record<BookingStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  declined: "danger",
  completed: "neutral",
  cancelled: "neutral",
};

export function BookingBadge({ status }: { status: BookingStatus }) {
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{BOOKING_STATUS_LABELS[status] ?? status}</StatusBadge>;
}
