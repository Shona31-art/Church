"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { deleteAnnouncement, setAnnouncementStatus } from "../actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";

export function AnnouncementActions({ id, title, status }: { id: string; title: string; status: string }) {
  const [statusState, statusAction] = useFormState(setAnnouncementStatus, null);
  const [deleteState, deleteAction] = useFormState(deleteAnnouncement, null);

  const statusForm = (to: string, label: string, className: string, pendingLabel: string) => (
    <form action={statusAction}>
      <input type="hidden" name="announcement_id" value={id} />
      <input type="hidden" name="to" value={to} />
      <PendingButton className={className} pendingLabel={pendingLabel}>
        {label}
      </PendingButton>
    </form>
  );

  return (
    <div className="space-y-3">
      {(statusState?.error || deleteState?.error) && <Alert tone="error">{statusState?.error ?? deleteState?.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && statusForm("published", "Publish", "btn-primary", "Publishing…")}
        <Link href={`/dashboard/announcements/${id}/edit`} className={status === "draft" ? "btn-secondary" : "btn-primary"}>
          Edit
        </Link>
        {status === "published" && statusForm("archived", "Archive", "btn-secondary", "Archiving…")}
        {status === "archived" && statusForm("draft", "Restore to drafts", "btn-secondary", "Restoring…")}
        <form action={deleteAction}>
          <input type="hidden" name="announcement_id" value={id} />
          <ConfirmSubmitButton
            title="Delete this announcement?"
            message={
              <>
                <p>
                  &ldquo;{title}&rdquo; will be permanently removed for everyone. This can&apos;t be undone.
                </p>
                {status === "published" && <p className="mt-2">To hide it but keep a record, archive it instead.</p>}
              </>
            }
            confirmLabel="Delete announcement"
            pendingLabel="Deleting…"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
