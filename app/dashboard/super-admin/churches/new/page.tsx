import Link from "next/link";
import { getCurrentAppUser } from "@/lib/current-user";
import { ChurchForm } from "./ChurchForm";

export default async function NewChurchPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return <p className="text-ink/60">Super Admin access only.</p>;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/dashboard/super-admin/churches" className="text-sm text-ember">
        ← All churches
      </Link>
      <ChurchForm />
    </div>
  );
}
