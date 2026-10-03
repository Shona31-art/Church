"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addItem, assignItem, createPlan, removeItem, setPlanStatus } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

function ErrorLine({ error, className = "text-sm" }: { error?: string; className?: string }) {
  return error ? <p role="alert" className={`${className} text-red-700`}>⚠ {error}</p> : null;
}

export function NewPlanForm() {
  const [state, formAction] = useFormState(createPlan, null);
  const field = "w-full border border-ink/20 rounded-lg px-4 py-3";
  return (
    <form action={formAction} className="max-w-md space-y-4">
      <ErrorLine error={state?.error} />
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">Service name</label>
        <input id="title" name="title" required maxLength={120} defaultValue="Sunday Service" className={field} />
      </div>
      <div>
        <label htmlFor="service_date" className="block text-sm font-medium mb-1">Date</label>
        <input id="service_date" type="date" name="service_date" required className={field} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="use_template" defaultChecked className="mt-1" />
        <span>
          Start with the standard running order
          <span className="block text-xs text-ink/40">Worship → Prayer → Offering → Sermon → Announcements → Closing. You can remove or add items after.</span>
        </span>
      </label>
      <PendingButton pendingLabel="Creating…" className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">
        Create service plan
      </PendingButton>
    </form>
  );
}

export function PublishButton({ planId, status }: { planId: string; status: "draft" | "published" }) {
  const [state, formAction] = useFormState(setPlanStatus, null);
  const publishing = status === "draft";
  return (
    <form action={formAction} className="text-right">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="from" value={status} />
      <input type="hidden" name="to" value={publishing ? "published" : "draft"} />
      {publishing ? (
        <PendingButton pendingLabel="Publishing…" className="text-sm px-3 py-1.5 rounded-lg bg-ember text-white disabled:opacity-50">
          Publish
        </PendingButton>
      ) : (
        <ConfirmSubmitButton
          message="Unpublish this plan? Volunteers will no longer see the running order."
          pendingLabel="Saving…"
          className="text-sm px-3 py-1.5 rounded-lg border border-ink/20 disabled:opacity-50"
        >
          Unpublish
        </ConfirmSubmitButton>
      )}
      <ErrorLine error={state?.error} className="text-xs mt-1" />
    </form>
  );
}

export function AssignForm({
  planId,
  itemId,
  itemTitle,
  assignedTo,
  members,
}: {
  planId: string;
  itemId: string;
  itemTitle: string;
  assignedTo: string | null;
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(assignItem, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="item_id" value={itemId} />
      <label htmlFor={`assign-${itemId}`} className="sr-only">Who leads “{itemTitle}”</label>
      <select id={`assign-${itemId}`} name="assigned_to" defaultValue={assignedTo ?? ""} className="text-sm border border-ink/20 rounded px-2 py-1 max-w-[12rem]">
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <PendingButton pendingLabel="Saving…" className="text-xs text-ember disabled:opacity-50">Save</PendingButton>
      {state?.ok && <span role="status" className="text-xs text-green-800">✓ Saved</span>}
      <ErrorLine error={state?.error} className="text-xs w-full" />
    </form>
  );
}

export function RemoveItemButton({ planId, itemId, itemTitle }: { planId: string; itemId: string; itemTitle: string }) {
  const [state, formAction] = useFormState(removeItem, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="item_id" value={itemId} />
      <ConfirmSubmitButton
        message={`Remove “${itemTitle}” from this service?`}
        pendingLabel="Removing…"
        className="text-xs text-red-700 disabled:opacity-50"
      >
        Remove<span className="sr-only"> {itemTitle}</span>
      </ConfirmSubmitButton>
      <ErrorLine error={state?.error} className="text-xs" />
    </form>
  );
}

export function AddItemForm({ planId }: { planId: string }) {
  const [state, formAction] = useFormState(addItem, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="space-y-1">
      <input type="hidden" name="plan_id" value={planId} />
      <label htmlFor="item_title" className="block text-sm font-medium">Add an item</label>
      <div className="flex gap-2">
        <input id="item_title" name="item_title" required maxLength={120} placeholder="e.g. Baby Dedication" className="flex-1 border border-ink/20 rounded-lg px-4 py-2 text-sm" />
        <PendingButton pendingLabel="Adding…" className="bg-ink/5 px-4 py-2 rounded-lg text-sm disabled:opacity-50">Add</PendingButton>
      </div>
      <ErrorLine error={state?.error} />
    </form>
  );
}
