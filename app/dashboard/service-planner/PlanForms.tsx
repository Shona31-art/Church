"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { addItem, assignItem, createPlan, deletePlan, moveItem, removeItem, setPlanStatus, updatePlan } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import { PersonPicker } from "@/components/ui/PersonPicker";

function ErrorLine({ error }: { error?: string }) {
  return error ? <Alert tone="error" className="mt-2">{error}</Alert> : null;
}

export function NewPlanForm({ today }: { today: string }) {
  const [state, formAction] = useFormState(createPlan, null);
  return (
    <form action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-md">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />
      <FormField label="Service name" htmlFor="title" required>
        <input id="title" name="title" required maxLength={120} defaultValue="Sunday Service" className="input" />
      </FormField>
      <FormField label="Date" htmlFor="service_date" required>
        <input id="service_date" type="date" name="service_date" required min={today} className="input" />
      </FormField>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="use_template" defaultChecked className="mt-1 h-4 w-4" />
        <span>
          Start with the standard running order
          <span className="block text-xs text-ink/60">Worship → Prayer → Offering → Sermon → Announcements → Closing. You can change it after.</span>
        </span>
      </label>
      <FormActions>
        <PendingButton pendingLabel="Creating…">Create service plan</PendingButton>
        <Link href="/dashboard/service-planner" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

export function EditPlanForm({ planId, title, serviceDate }: { planId: string; title: string; serviceDate: string }) {
  const [state, formAction] = useFormState(updatePlan, null);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="plan_id" value={planId} />
      <FormField label="Service name" htmlFor="plan-title">
        <input id="plan-title" name="title" required maxLength={120} defaultValue={title} className="input" />
      </FormField>
      <FormField label="Date" htmlFor="plan-date">
        <input id="plan-date" name="service_date" type="date" required defaultValue={serviceDate} className="input" />
      </FormField>
      <PendingButton className="btn-secondary">Save</PendingButton>
      <div className="sm:col-span-3">
        <ErrorLine error={state?.error} />
      </div>
    </form>
  );
}

export function DeletePlanButton({ planId, title, itemCount }: { planId: string; title: string; itemCount: number }) {
  const [state, formAction] = useFormState(deletePlan, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="plan_id" value={planId} />
      <ConfirmSubmitButton
        title={`Delete “${title}”?`}
        message={`The plan and its ${itemCount} running-order item${itemCount === 1 ? "" : "s"} will be permanently deleted. Volunteers will no longer see it. This can't be undone.`}
        confirmLabel="Delete plan"
        pendingLabel="Deleting…"
      >
        Delete plan
      </ConfirmSubmitButton>
      <ErrorLine error={state?.error} />
    </form>
  );
}

export function PublishButton({ planId, status }: { planId: string; status: "draft" | "published" }) {
  const [state, formAction] = useFormState(setPlanStatus, null);
  const publishing = status === "draft";
  return (
    <form action={formAction}>
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="from" value={status} />
      <input type="hidden" name="to" value={publishing ? "published" : "draft"} />
      {publishing ? (
        <PendingButton pendingLabel="Publishing…">Publish</PendingButton>
      ) : (
        <ConfirmSubmitButton
          title="Unpublish this plan?"
          message="Volunteers will no longer see the running order until you publish it again."
          confirmLabel="Unpublish"
          pendingLabel="Saving…"
          className="btn-secondary"
          tone="primary"
        >
          Unpublish
        </ConfirmSubmitButton>
      )}
      <ErrorLine error={state?.error} />
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
  useEffect(() => {
    if (state?.ok) showToast(`Saved who leads “${itemTitle}”.`);
  }, [state, itemTitle]);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="item_id" value={itemId} />
      <label htmlFor={`assign-${itemId}`} className="sr-only">
        Who leads “{itemTitle}”
      </label>
      <div className="w-56 max-w-full">
        <PersonPicker
          id={`assign-${itemId}`}
          name="assigned_to"
          title={`Who leads ${itemTitle}?`}
          defaultValue={assignedTo ?? ""}
          placeholder="Unassigned"
          options={[{ value: "", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </div>
      <PendingButton className="btn-secondary btn-sm">
        Save<span className="sr-only"> leader for {itemTitle}</span>
      </PendingButton>
      {state?.error && <p role="alert" className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function MoveButtons({ planId, itemId, itemTitle, isFirst, isLast }: { planId: string; itemId: string; itemTitle: string; isFirst: boolean; isLast: boolean }) {
  const [state, formAction] = useFormState(moveItem, null);
  const button = (direction: "up" | "down", disabled: boolean) => (
    <button
      type="submit"
      name="direction"
      value={direction}
      disabled={disabled}
      className="btn-ghost btn-sm px-2"
      aria-label={`Move “${itemTitle}” ${direction}`}
      title={`Move ${direction}`}
    >
      <span aria-hidden>{direction === "up" ? "↑" : "↓"}</span>
    </button>
  );
  return (
    <form action={formAction} className="flex">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="item_id" value={itemId} />
      {button("up", isFirst)}
      {button("down", isLast)}
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
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
        title={`Remove “${itemTitle}”?`}
        message="It will be taken out of this service's running order."
        confirmLabel="Remove item"
        pendingLabel="Removing…"
        className="btn-ghost btn-sm text-danger"
      >
        Remove<span className="sr-only"> {itemTitle}</span>
      </ConfirmSubmitButton>
      {state?.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
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
      <label htmlFor="item_title" className="label">
        Add an item
      </label>
      <div className="flex gap-2">
        <input id="item_title" name="item_title" required maxLength={120} placeholder="e.g. Baby dedication" className="input flex-1" />
        <PendingButton className="btn-secondary" pendingLabel="Adding…">
          Add
        </PendingButton>
      </div>
      <ErrorLine error={state?.error} />
    </form>
  );
}
