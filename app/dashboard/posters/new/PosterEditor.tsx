"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { PosterPreview, PosterData } from "../PosterCanvas";
import { generatePosterTagline, savePoster } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { POSTER_COLORS, POSTER_TEMPLATES } from "@/lib/posters";

const field = "w-full border border-ink/20 rounded-lg px-4 py-2 text-sm";

export function PosterEditor({ churchName }: { churchName: string }) {
  const [state, formAction] = useFormState(savePoster, null);
  const [form, setForm] = useState({
    eventTitle: "Sunday Service",
    tagline: "",
    speaker: "",
    eventDate: "",
    location: "",
    templateKey: "classic" as PosterData["templateKey"],
    themeColor: POSTER_COLORS[0].hex as string,
    format: "square" as PosterData["format"],
  });
  const [generating, setGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerateTagline() {
    setGenerating(true);
    setAiNotice(null);
    try {
      const result = await generatePosterTagline({ eventTitle: form.eventTitle, speaker: form.speaker, eventDate: form.eventDate });
      if (result.tagline) update("tagline", result.tagline);
      setAiNotice(result.notice ?? null);
    } catch {
      setAiNotice("Couldn't reach the server — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/posters" className="text-sm text-ink/50 hover:text-ink">← Posters</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Poster Studio</h1>
      <p className="text-xs text-ink/40 mb-6">
        AI can suggest the tagline; the design comes from the template you pick.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="template_key" value={form.templateKey} />
          <input type="hidden" name="theme_color" value={form.themeColor} />

          {state?.error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              ⚠ {state.error}
            </p>
          )}

          <div>
            <label htmlFor="event_title" className="block text-sm font-medium mb-1">Event title</label>
            <input id="event_title" name="event_title" required maxLength={120} value={form.eventTitle} onChange={(e) => update("eventTitle", e.target.value)} className={field} />
          </div>

          <div>
            <label htmlFor="tagline" className="block text-sm font-medium mb-1">
              Tagline <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input id="tagline" name="tagline" maxLength={120} value={form.tagline} onChange={(e) => update("tagline", e.target.value)} className={`${field} flex-1`} />
              <button
                type="button"
                onClick={handleGenerateTagline}
                disabled={generating || !form.eventTitle.trim()}
                className="text-xs bg-ink/5 px-3 py-2 rounded-lg whitespace-nowrap disabled:opacity-40"
              >
                {generating ? "Thinking…" : "✨ AI suggest"}
              </button>
            </div>
            {aiNotice && <p role="status" className="text-xs text-ink/60 mt-1">{aiNotice}</p>}
          </div>

          <div>
            <label htmlFor="speaker" className="block text-sm font-medium mb-1">
              Speaker <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <input id="speaker" name="speaker" maxLength={80} value={form.speaker} onChange={(e) => update("speaker", e.target.value)} className={field} />
          </div>

          <div>
            <label htmlFor="event_date" className="block text-sm font-medium mb-1">
              Date and time <span className="font-normal text-ink/40">(as it should appear)</span>
            </label>
            <input id="event_date" name="event_date" maxLength={80} placeholder="e.g. Sunday 10 Aug · 9AM" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} className={field} />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-1">
              Location <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <input id="location" name="location" maxLength={120} value={form.location} onChange={(e) => update("location", e.target.value)} className={field} />
          </div>

          <fieldset>
            <legend className="text-sm font-medium mb-1">Template</legend>
            <div className="flex gap-2">
              {POSTER_TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={form.templateKey === t}
                  onClick={() => update("templateKey", t)}
                  className={`text-xs px-3 py-2 rounded-lg capitalize ${form.templateKey === t ? "bg-ember text-white" : "border border-ink/20"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium mb-1">Colour</legend>
            <div className="flex gap-2">
              {POSTER_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={form.themeColor === c.hex}
                  title={c.name}
                  onClick={() => update("themeColor", c.hex)}
                  className="w-7 h-7 rounded-full border-2"
                  // Swatch colours are the poster's own palette, not app UI colours.
                  style={{ backgroundColor: c.hex, borderColor: form.themeColor === c.hex ? "#1c1917" : "transparent" }}
                />
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="format" className="block text-sm font-medium mb-1">Size</label>
            <select id="format" name="format" value={form.format} onChange={(e) => update("format", e.target.value as PosterData["format"])} className={field}>
              <option value="square">Square (Instagram/Facebook)</option>
              <option value="story">Story (WhatsApp/Instagram Story)</option>
              <option value="print">Print (A4 portrait)</option>
            </select>
          </div>

          <PendingButton pendingLabel="Saving…" className="w-full bg-ember text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            Save poster
          </PendingButton>
        </form>

        <div>
          <PosterPreview data={{ churchName, ...form }} />
        </div>
      </div>
    </div>
  );
}
