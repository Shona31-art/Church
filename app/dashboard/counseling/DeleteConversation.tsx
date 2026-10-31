import { Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteConversation } from "./actions";

/** Delete one of your own counseling conversations (asks first). */
export function DeleteConversation({ id, compact = false }: { id: string; compact?: boolean }) {
  return (
    <form action={deleteConversation}>
      <input type="hidden" name="conversation_id" value={id} />
      <ConfirmSubmitButton
        title="Delete this conversation?"
        message="All of its messages will be permanently deleted. This can't be undone."
        confirmLabel="Delete conversation"
        pendingLabel="Deleting…"
        className={compact ? "btn-ghost btn-icon h-9 w-9 text-ink/50 hover:text-danger" : "btn-ghost text-danger"}
      >
        {compact ? (
          <>
            <Trash2 aria-hidden className="h-4 w-4" />
            <span className="sr-only">Delete conversation</span>
          </>
        ) : (
          <>
            <Trash2 aria-hidden className="h-4 w-4" /> Delete
          </>
        )}
      </ConfirmSubmitButton>
    </form>
  );
}
