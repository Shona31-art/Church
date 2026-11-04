import Link from "next/link";
import { Baby, Users } from "lucide-react";

/** Members | Children, at the top of the Members pages. */
export function MembersTabs({ active }: { active: "members" | "children" }) {
  const tab = (key: "members" | "children", href: string, label: string, Icon: typeof Users) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:flex-none ${active === key ? "bg-surface text-ink shadow-xs" : "text-ink/60 hover:text-ink"}`}
    >
      <Icon aria-hidden className="h-4 w-4" /> {label}
    </Link>
  );
  return (
    <nav aria-label="Members sections" className="mb-6 flex w-full gap-1 rounded-xl border border-line bg-surface-raised p-1 sm:w-fit">
      {tab("members", "/dashboard/members", "Members", Users)}
      {tab("children", "/dashboard/members/children", "Children", Baby)}
    </nav>
  );
}
