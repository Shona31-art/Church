"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { VERSIONS } from "@/lib/bible/versions";
import { DEFAULT_SETTINGS, type ReaderSettings } from "@/lib/bible/reader-prefs";

type Option<T extends string> = { value: T; label: string };

const SIZE_OPTIONS: Option<ReaderSettings["textSize"]>[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];
const SPACING_OPTIONS: Option<ReaderSettings["lineSpacing"]>[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];
const FONT_OPTIONS: Option<ReaderSettings["font"]>[] = [
  { value: "sans", label: "Modern" },
  { value: "serif", label: "Classic" },
];
const LAYOUT_OPTIONS: Option<ReaderSettings["layout"]>[] = [
  { value: "verses", label: "Verse by verse" },
  { value: "paragraph", label: "Paragraph" },
];

/**
 * Text size, spacing, font, layout and "compare with" for the reader. Changes
 * apply immediately (no Save button) and are remembered on this device.
 */
export function ReaderSettingsDialog({
  open,
  onClose,
  settings,
  onChange,
  currentVersionId,
}: {
  open: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  currentVersionId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => onChange({ ...settings, [key]: value });
  const comparing = Boolean(settings.compareWith && settings.compareWith !== currentVersionId);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="reader-settings-title"
      className="m-0 mt-auto w-full max-w-full rounded-t-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 motion-safe:animate-modal-in md:m-auto md:w-[calc(100%-2rem)] md:max-w-md md:rounded-2xl"
    >
      <div className="max-h-[85vh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="reader-settings-title" className="text-xl font-semibold">
            Reading settings
          </h2>
          <button type="button" onClick={onClose} className="btn-secondary btn-sm h-9 w-9 rounded-full p-0" aria-label="Close">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          <Segmented legend="Text size" options={SIZE_OPTIONS} value={settings.textSize} onChange={(v) => set("textSize", v)} />
          <Segmented legend="Line spacing" options={SPACING_OPTIONS} value={settings.lineSpacing} onChange={(v) => set("lineSpacing", v)} />
          <Segmented legend="Font" options={FONT_OPTIONS} value={settings.font} onChange={(v) => set("font", v)} />
          <div>
            <Segmented legend="Layout" options={LAYOUT_OPTIONS} value={comparing ? "verses" : settings.layout} onChange={(v) => set("layout", v)} disabled={comparing} />
            {comparing && <p className="hint">Comparing shows verse by verse.</p>}
          </div>

          <div>
            <label htmlFor="compare-with" className="label">
              Compare with
            </label>
            <select
              id="compare-with"
              className="input"
              value={comparing ? settings.compareWith! : ""}
              onChange={(e) => set("compareWith", e.target.value || null)}
            >
              <option value="">Off</option>
              {VERSIONS.filter((v) => v.id !== currentVersionId).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.abbreviation})
                </option>
              ))}
            </select>
            <p className="hint">Shows a second version under each verse.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
            Reset to default
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-50">
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface-raised p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-[36px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${
              value === o.value ? "bg-surface text-ink shadow-xs" : "text-ink/60 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
