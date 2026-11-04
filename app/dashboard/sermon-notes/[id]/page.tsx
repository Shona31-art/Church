import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FillInNotes } from "../OutlineForms";
import { deleteOutline } from "../actions";

export const metadata = { title: "Sermon notes" };

export default async function SermonNotePage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("sermon_notes");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();
  const me = (await getCurrentAppUser())!;
  const { data: n } = await createClient().from("sermon_outlines").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle();
  if (!n) notFound();
  const manage = can(me.role, "manageSermons");
  const journal = (await checkModuleAccess("journal")).allowed;
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard/sermon-notes", label: "Sermon notes" }}
        title={n.title}
        description={[formatDate(n.sermon_date, { month: "long" }), n.speaker, n.scripture].filter(Boolean).join(" · ")}
        actions={
          manage ? (
            <Link href={`/dashboard/sermon-notes/${n.id}/edit`} className="btn-secondary">
              <Pencil aria-hidden className="h-4 w-4" /> Edit
            </Link>
          ) : undefined
        }
      />
      {!n.published && <Alert tone="info">Draft — only pastors and admins can see these notes until you tick “Show to the church”.</Alert>}
      <FillInNotes id={n.id} body={n.body} journal={journal} />
      {manage && (
        <form action={deleteOutline} className="flex justify-end">
          <input type="hidden" name="id" value={n.id} />
          <ConfirmSubmitButton title="Delete these sermon notes?" message="They'll be removed for the church. Copies people kept in their journals stay." confirmLabel="Delete" pendingLabel="Deleting…">
            Delete notes
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
