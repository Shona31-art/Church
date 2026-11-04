"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface PickerOption {
  value: string;
  label: string;
  /** Shown under the label, e.g. "Child of Thandi Moyo". */
  hint?: string;
  /** Options with the same group are listed under that heading. */
  group?: string;
}

/**
 * A searchable dropdown for choosing a person (or any long list), in place
 * of a phone's built-in pop-up list — which covers the screen on Android and
 * has no search or Close button. Opens right under the field with a search
 * box and a ✕; closes on a choice, Escape, or tapping anywhere else.
 * Submits like a <select> through a hidden input called `name`.
 */
export function PersonPicker({
  id,
  name,
  options,
  value: controlled,
  defaultValue = "",
  onChange,
  placeholder = "Choose…",
  title = "Choose",
  invalid,
}: {
  id?: string;
  name?: string;
  options: PickerOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, option: PickerOption | undefined) => void;
  placeholder?: string;
  /** Read out to screen readers for the list. */
  title?: string;
  invalid?: boolean;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(term)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    const t = setTimeout(() => {
      searchRef.current?.focus({ preventScroll: true });
      wrapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }
  function choose(o: PickerOption) {
    if (controlled === undefined) setOwn(o.value);
    onChange?.(o.value, o);
    close();
  }

  let lastGroup: string | undefined;
  return (
    <div ref={wrapRef} className="relative min-w-0">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`input flex w-full items-center justify-between gap-2 text-left ${invalid ? "border-danger" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-ink/50"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center gap-1 border-b border-line p-2">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search: ${title}`} className="input py-2 pl-9" />
            </div>
            <button type="button" onClick={close} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink/60 hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          <ul id={listId} className="max-h-64 overflow-y-auto overscroll-contain p-1" role="listbox" aria-label={title}>
            {!shown.length && <li className="px-3 py-4 text-center text-sm text-ink/60">Nobody matches “{q}”.</li>}
            {shown.map((o) => {
              const heading = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <li key={o.value || "__none"}>
                  {heading && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{heading}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => choose(o)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-ink/5 ${o.value === value ? "bg-ember/10" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block truncate text-xs text-ink/60">{o.hint}</span>}
                    </span>
                    {o.value === value && <Check aria-hidden className="h-4 w-4 shrink-0 text-ember" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
