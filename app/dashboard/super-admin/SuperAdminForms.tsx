"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormState } from "react-dom";
import {
  addChurch,
  createPlatformUser,
  deletePlatformUser,
  setModuleOverride,
  setPlatformUserPassword,
  setPlatformUserStatus,
  updatePlatformUser,
  updateSubscription,
} from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { CHURCH_ROLES, ROLE_LABELS } from "@/lib/permissions";

type Option = { id: string; name: string };
type Dept = Option & { church_id: string };

// --------------------------------------------------------------- churches

export function AddChurchForm() {
  const [state, action] = useFormState(addChurch, null);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-xl" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />
      <FormField label="Church name" htmlFor="church_name" required error={fe.church_name}>
        <input id="church_name" name="church_name" required maxLength={200} defaultValue={v.church_name} className="input" />
      </FormField>
      <FormField label="First church admin's name" htmlFor="admin_name" required error={fe.admin_name}>
        <input id="admin_name" name="admin_name" required maxLength={120} defaultValue={v.admin_name} className="input" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Admin's email" htmlFor="email" required error={fe.email}>
          <input id="email" name="email" type="email" required defaultValue={v.email} className="input" />
        </FormField>
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={v.phone} className="input" />
        </FormField>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Initial password" htmlFor="password" required error={fe.password} hint="8+ characters, letters and numbers.">
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm_password" required error={fe.confirm_password}>
          <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required className="input" />
        </FormField>
      </div>
      <FormActions>
        <PendingButton pendingLabel="Creating church…">Create church</PendingButton>
        <Link href="/dashboard/super-admin/churches" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

export function SubscriptionForm({
  churchId,
  churchName,
  sub,
}: {
  churchId: string;
  churchName: string;
  sub: { plan_key: string; status: string; is_lifetime: boolean; trial_expires_at: string | null; grace_period_end: string | null; price_override: number | null; notes: string | null } | null;
}) {
  const [state, action] = useFormState(updateSubscription, null);
  const [status, setStatus] = useState(sub?.status ?? "trial");
  const fe = state?.fieldErrors ?? {};
  const suspending = status === "suspended" && sub?.status !== "suspended";
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="church_id" value={churchId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Plan" htmlFor="plan_key">
          <select id="plan_key" name="plan_key" defaultValue={sub?.plan_key ?? "free_trial"} className="input">
            <option value="free_trial">Free trial</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
            <option value="sponsored">Sponsored (free)</option>
          </select>
        </FormField>
        <FormField label="Account status" htmlFor="status">
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="payment_pending">Payment pending</option>
            <option value="grace">Grace period</option>
            <option value="suspended">Suspended</option>
          </select>
        </FormField>
        <FormField label="Trial ends" htmlFor="trial_expires_at" optional>
          <input id="trial_expires_at" name="trial_expires_at" type="date" defaultValue={sub?.trial_expires_at?.slice(0, 10) ?? ""} className="input" />
        </FormField>
        <FormField label="Grace period ends" htmlFor="grace_period_end" optional>
          <input id="grace_period_end" name="grace_period_end" type="date" defaultValue={sub?.grace_period_end?.slice(0, 10) ?? ""} className="input" />
        </FormField>
        <FormField label="Price override (R/month)" htmlFor="price_override" optional error={fe.price_override} hint="Leave empty to use the plan price.">
          <input id="price_override" name="price_override" inputMode="decimal" defaultValue={sub?.price_override ?? ""} className="input" />
        </FormField>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="is_lifetime" defaultChecked={sub?.is_lifetime} className="mt-1 h-4 w-4" />
        <span>
          Lifetime access
          <span className="block text-xs text-ink/60">Never expires and overrides every status check. Use for sponsored partners only.</span>
        </span>
      </label>
      <FormField label="Internal notes" htmlFor="notes" optional hint="Only platform admins see this.">
        <textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={sub?.notes ?? ""} className="input" />
      </FormField>
      {suspending ? (
        <ConfirmSubmitButton
          title={`Suspend ${churchName}?`}
          message="Everyone in this church immediately loses access to every feature. Their data is kept and access returns as soon as the status changes back."
          confirmLabel="Suspend church"
          pendingLabel="Saving…"
          className="btn-danger"
        >
          Save and suspend
        </ConfirmSubmitButton>
      ) : (
        <PendingButton>Save subscription</PendingButton>
      )}
    </form>
  );
}

export function ModuleOverrideControl({ churchId, moduleKey, moduleName, mode, planIncludes }: { churchId: string; moduleKey: string; moduleName: string; mode: "on" | "off" | "plan"; planIncludes: boolean }) {
  const [state, action] = useFormState(setModuleOverride, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="flex items-center gap-2">
      <input type="hidden" name="church_id" value={churchId} />
      <input type="hidden" name="module_key" value={moduleKey} />
      <label htmlFor={`m-${moduleKey}`} className="sr-only">
        {moduleName} access
      </label>
      <select id={`m-${moduleKey}`} name="mode" defaultValue={mode} onChange={() => ref.current?.requestSubmit()} className="input w-auto py-1.5 text-base sm:text-xs">
        <option value="plan">Follow plan ({planIncludes ? "on" : "off"})</option>
        <option value="on">Force on</option>
        <option value="off">Force off</option>
      </select>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

// ------------------------------------------------------------------- users

function DepartmentSelect({ departments, churchId, defaultValue, error }: { departments: Dept[]; churchId: string; defaultValue?: string | null; error?: string }) {
  const options = departments.filter((d) => d.church_id === churchId);
  return (
    <FormField label="Department" htmlFor="department_id" optional error={error} hint={churchId && !options.length ? "This church has no departments yet." : undefined}>
      <select id="department_id" name="department_id" defaultValue={defaultValue ?? ""} className="input">
        <option value="">No department</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function CreateUserForm({ churches, departments, defaultChurchId }: { churches: Option[]; departments: Dept[]; defaultChurchId?: string }) {
  const [state, action] = useFormState(createPlatformUser, null);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const [churchId, setChurchId] = useState(v.church_id ?? defaultChurchId ?? "");
  return (
    <form key={JSON.stringify(v)} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-xl" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />
      <FormField label="Full name" htmlFor="name" required error={fe.name}>
        <input id="name" name="name" required defaultValue={v.name} className="input" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email" required error={fe.email}>
          <input id="email" name="email" type="email" required defaultValue={v.email} className="input" />
        </FormField>
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={v.phone} className="input" />
        </FormField>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Church" htmlFor="church_id" required error={fe.church_id}>
          <select id="church_id" name="church_id" required value={churchId} onChange={(e) => setChurchId(e.target.value)} className="input">
            <option value="" disabled>
              Choose a church…
            </option>
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Role" htmlFor="role" required error={fe.role}>
          <select id="role" name="role" defaultValue={v.role ?? "member"} className="input">
            {CHURCH_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <DepartmentSelect departments={departments} churchId={churchId} defaultValue={v.department_id} error={fe.department_id} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Initial password" htmlFor="password" required error={fe.password} hint="8+ characters, letters and numbers.">
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm_password" required error={fe.confirm_password}>
          <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required className="input" />
        </FormField>
      </div>
      <FormActions>
        <PendingButton pendingLabel="Creating…">Create user</PendingButton>
        <Link href="/dashboard/super-admin/users" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

export function EditUserForm({
  user,
  churches,
  departments,
}: {
  user: { id: string; name: string; phone: string | null; church_id: string; role: string; department_id: string | null };
  churches: Option[];
  departments: Dept[];
}) {
  const [state, action] = useFormState(updatePlatformUser, null);
  const [churchId, setChurchId] = useState(user.church_id);
  const fe = state?.fieldErrors ?? {};
  const moving = churchId !== user.church_id;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="user_id" value={user.id} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Full name" htmlFor="name" required error={fe.name}>
          <input id="name" name="name" required defaultValue={user.name} className="input" />
        </FormField>
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} className="input" />
        </FormField>
        <FormField label="Church" htmlFor="church_id" required>
          <select id="church_id" name="church_id" value={churchId} onChange={(e) => setChurchId(e.target.value)} className="input">
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Role" htmlFor="role" required>
          <select id="role" name="role" defaultValue={user.role} className="input">
            {CHURCH_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <DepartmentSelect departments={departments} churchId={churchId} defaultValue={moving ? "" : user.department_id} error={fe.department_id} />
      {moving ? (
        <ConfirmSubmitButton
          title="Move this person to another church?"
          message="They'll see the new church from their next page load and lose access to the old church. Their birthday moves with them; prayers they shared come off the old church's wall (kept privately); their upcoming bookings and event RSVPs with the old church are cancelled. Gifts, care notes and messages stay with the old church."
          confirmLabel="Move and save"
          tone="primary"
          className="btn-primary"
          pendingLabel="Saving…"
        >
          Save changes
        </ConfirmSubmitButton>
      ) : (
        <PendingButton>Save changes</PendingButton>
      )}
    </form>
  );
}

export function UserStatusButton({ userId, name, status }: { userId: string; name: string; status: string }) {
  const [state, action] = useFormState(setPlatformUserStatus, null);
  const disabling = status !== "disabled";
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="to" value={disabling ? "disabled" : "active"} />
      <ConfirmSubmitButton
        title={disabling ? `Disable ${name}?` : `Enable ${name}?`}
        message={disabling ? "They'll be signed out and can't sign in. Their data is kept." : "They'll be able to sign in again."}
        confirmLabel={disabling ? "Disable account" : "Enable account"}
        tone={disabling ? "danger" : "primary"}
        className={disabling ? "btn-danger-outline" : "btn-secondary"}
        pendingLabel="Saving…"
      >
        {disabling ? "Disable account" : "Enable account"}
      </ConfirmSubmitButton>
      {state?.error && <Alert tone="error" className="mt-2">{state.error}</Alert>}
    </form>
  );
}

export function SetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useFormState(setPlatformUserPassword, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <input type="hidden" name="user_id" value={userId} />
      <FormField label="New password" htmlFor="new_password">
        <input id="new_password" name="password" type="password" autoComplete="new-password" required className="input" />
      </FormField>
      <FormField label="Confirm" htmlFor="confirm_new_password">
        <input id="confirm_new_password" name="confirm_password" type="password" autoComplete="new-password" required className="input" />
      </FormField>
      <PendingButton className="btn-secondary">Set password</PendingButton>
      {state?.error && <Alert tone="error" className="sm:col-span-3">{state.error}</Alert>}
    </form>
  );
}

export function DeleteUserForm({ userId, name }: { userId: string; name: string }) {
  const [state, action] = useFormState(deletePlatformUser, null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn-danger-outline" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog">
        Delete account…
      </button>
      <dialog ref={dialogRef} aria-labelledby="del-user-title" className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-ink shadow-xl backdrop:bg-ink/40">
        <form action={action} className="p-6 space-y-4">
          <input type="hidden" name="user_id" value={userId} />
          <h2 id="del-user-title" className="text-lg font-semibold">
            Permanently delete {name}?
          </h2>
          <p className="text-sm text-ink/70">Their login and personal data are erased (POPIA). Giving records stay with the church, de-identified. This can&apos;t be undone.</p>
          {state?.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
          <FormField label="Type DELETE to confirm" htmlFor="confirm_text" error={state?.fieldErrors?.confirm_text}>
            <input id="confirm_text" name="confirm_text" autoComplete="off" className="input" />
          </FormField>
          <div className="flex justify-end gap-2">
            <button type="button" autoFocus className="btn-secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <PendingButton className="btn-danger" pendingLabel="Deleting…">
              Delete permanently
            </PendingButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
