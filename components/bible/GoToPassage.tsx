"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FieldError } from "@/components/ui/Alert";
import { readerHref } from "@/lib/bible/books";
import { parseReference } from "@/lib/bible/reference";

/** Type "jn 3:16" (or "Psalm 23", "1 cor 13:4-7") and go straight there in the reader. */
export function GoToPassage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = parseReference(value);
    if (!ref) return setError("We couldn't find that. Try something like John 3:16 or Psalm 23.");
    router.push(readerHref({ ...ref }));
  }

  return (
    <form onSubmit={submit} className="card-elevated flex h-full flex-col justify-center rounded-2xl p-5">
      <label htmlFor="go-to-passage" className="eyebrow mb-2 block">
        Go to a passage
      </label>
      <div className="flex gap-2">
        <input
          id="go-to-passage"
          className="input"
          placeholder="e.g. John 3:16"
          autoComplete="off"
          enterKeyHint="go"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "go-to-passage-error" : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="btn-primary btn-icon shrink-0" aria-label="Go">
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <FieldError id="go-to-passage-error">{error}</FieldError>
    </form>
  );
}
