"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Plus } from "lucide-react";
import { addDuties, createTeam } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { PersonPicker } from "@/components/ui/PersonPicker";

type Person = { id: string; name: string };

export function TeamForm({ people, departments = [] }: { people: Person[]; departments?: Person[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createTeam, null);
  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="h-4 w-4" /> New team
      </button>
    );
  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Team name" htmlFor="name" required>
        <input id="name" name="name" required maxLength={80} list="team-names" defaultValue={state?.values?.name} className="input" placeholder="e.g. Ushers" />
        <datalist id="team-names">
          {["Ushers", "Worship team", "Sound & media", "Kids' church", "Welcome team", "Prayer team", "Cleaning", "Security", "Kitchen"].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FormField>
      {departments.length > 0 && (
        <FormField label="Start with a department" htmlFor="department_id" optional hint="Everyone in it joins the team. You can add or take off people after.">
          <select id="department_id" name="department_id" className="input" defaultValue="">
            <option value="">No — I'll add people myself</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="Leader" htmlFor="leader_id" optional hint="The leader can plan this team's roster too.">
        <PersonPicker id="leader_id" name="leader_id" title="Team leader" placeholder="No leader" options={[{ value: "", label: "No leader" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
      </FormField>
      <FormField label="Description" htmlFor="description" optional>
        <input id="description" name="description" maxLength={500} className="input" />
      </FormField>
      <FormActions>
        <PendingButton pendingLabel="Creating…">Create team</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}

export function DutyForm({ teamId, members, nextSunday }: { teamId: string; members: Person[]; nextSunday: string }) {
  const [state, action] = useFormState(addDuties, null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state?.ok) setKey((k) => k + 1);
  }, [state]);
  return (
    <form key={key} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="team_id" value={teamId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date" htmlFor="duty_date" required>
          <input id="duty_date" name="duty_date" type="date" required defaultValue={nextSunday} className="input" />
        </FormField>
        <FormField label="Duty" htmlFor="role" optional>
          <input id="role" name="role" maxLength={80} className="input" placeholder="e.g. Front door, Keys, Lead vocals" />
        </FormField>
        <FormField label="Who" htmlFor="user_id">
          <select id="user_id" name="user_id" className="input" defaultValue={members.length > 1 ? "rotate" : members[0]?.id ?? ""}>
            {members.length > 1 && <option value="rotate">Take turns (whole team)</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="">Nobody yet</option>
          </select>
        </FormField>
        <FormField label="Repeat" htmlFor="weeks">
          <select id="weeks" name="weeks" className="input" defaultValue="4">
            <option value="1">Just this date</option>
            <option value="4">Every week for 4 weeks</option>
            <option value="8">Every week for 8 weeks</option>
            <option value="13">Every week for 3 months</option>
          </select>
        </FormField>
      </div>
      <PendingButton pendingLabel="Adding…">Add to roster</PendingButton>
    </form>
  );
}
