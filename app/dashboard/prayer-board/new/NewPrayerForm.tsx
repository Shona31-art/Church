"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPrayer } from "./actions";
import { draftPrayerWithAi } from "../actions";
import { Alert, FieldError } from "@/components/ui/Alert";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/** Add-a-prayer form. `aiAvailable` is false on plans without AI writing help (Basic). */
export function NewPrayerForm({ aiAvailable }: { aiAvailable: boolean }) {
  const [state, formAction] = useFormState(createPrayer, null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleDraft() {
    setDrafting(true);
    setAiError(null);
    const result = await callAction(() => draftPrayerWithAi(text, category), { error: CONNECTION_FAILED });
    setDrafting(false);
    if (result.error) setAiError(result.error);
    else if (result.text) setText(result.text);
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <PageHeader title="Add a prayer" back={{ href: "/dashboard/prayer-board", label: "My prayer board" }} />

      {state?.error && (
        <Alert tone="error">{state.error}</Alert>
      )}

      <div>
        <label htmlFor="prayer_text" className="label">
          Your prayer
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        </label>
        <textarea
          id="prayer_text"
          name="prayer_text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your heart? e.g. 'Guide my family and help us grow closer together.'"
          required
          rows={6}
          maxLength={4000}
          className="input"
        />
        {aiAvailable && (
        <div className="flex items-center justify-between mt-2 gap-3">
          <p className="text-xs text-ink/60">
            Not sure how to put it? Jot a few words, then let AI draft a prayer you can edit.
          </p>
          <button
            type="button"
            onClick={handleDraft}
            disabled={drafting || text.trim().length < 3}
            className="btn-secondary btn-sm shrink-0"
          >
            {drafting ? (
              "Drafting…"
            ) : (
              <>
                <Sparkles aria-hidden className="h-3.5 w-3.5" /> Help me write it
              </>
            )}
          </button>
        </div>
        )}
        <FieldError>{aiError}</FieldError>
      </div>

      <div>
        <label htmlFor="category" className="label">
          Category <span className="font-normal text-ink/60">(optional)</span>
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input"
        >
          <option value="">None</option>
          <option value="family">Family</option>
          <option value="career">Career</option>
          <option value="health">Health</option>
          <option value="ministry">Ministry</option>
          <option value="personal">Personal growth</option>
        </select>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="share" className="mt-0.5 h-4 w-4 accent-ember" />
        <span>
          Share this request on the church prayer wall
          <span className="mt-0.5 block text-xs text-ink/60">
            Members of your church will see it and can pray or leave encouragement. You can un-share any time.
          </span>
        </span>
      </label>

      <p className="text-xs text-ink/60">We'll suggest a few relevant Bible verses automatically when you save.</p>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary">
      {pending ? "Saving…" : "Save prayer"}
    </button>
  );
}
