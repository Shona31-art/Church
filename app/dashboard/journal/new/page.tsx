import { moduleGate } from "@/lib/gate";
import { PageHeader } from "@/components/ui/PageHeader";
import { NewEntryForm } from "../JournalForms";

export default async function NewJournalEntryPage() {
  const gate = await moduleGate("journal");
  if (gate) return gate;
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/journal", label: "My journal" }} title="New journal entry" description="Just between you and God. No one else can read this." />
      <NewEntryForm />
    </div>
  );
}
