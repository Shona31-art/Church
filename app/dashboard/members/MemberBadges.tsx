import { StatusBadge, type BadgeTone } from "@/components/ui/StatusBadge";
import { ACCOUNT_STATUS_LABELS, type AccountStatus } from "@/lib/permissions";

const TONE: Record<AccountStatus, BadgeTone> = { active: "success", invited: "info", disabled: "neutral" };

export function MemberStatusBadge({ status }: { status: AccountStatus }) {
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{ACCOUNT_STATUS_LABELS[status] ?? status}</StatusBadge>;
}
