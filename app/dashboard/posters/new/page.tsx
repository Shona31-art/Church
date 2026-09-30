"use client";

import { useState } from "react";
import { PosterPreview, PosterData } from "../PosterCanvas";
import { generatePosterTagline, savePoster } from "./actions";

const COLORS = ["#b45309", "#1e3a8a", "#065f46", "#7c2d12", "#4c1d95"];

export default function NewPosterPage() {
  const [form, setForm] = useState({
    churchName: "Our Church",
    eventTitle: "Sunday Service",
    tagline: "",
    speaker: "",
    eventDate: "",
    location: "",
    templateKey: "classic" as PosterData["templateKey"],
    themeColor: COLORS[0],
    format: "square" as PosterData["format"],
  });
  const [generating, setGenerating] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerateTagline() {
    setGenerating(true);
    const { tagline } = await generatePosterTagline({
      eventTitle: form.eventTitle,
      speaker: form.speaker,
      eventDate: form.eventDate,
    });
    update("tagline", tagline);
    setGenerating(false);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">AI Poster Studio</h1>
      <p className="text-xs text-ink/40 mb-6">
        Note: this generates AI copy + a designed template, not a unique AI
        image each time — genuine AI image generation needs a paid API
        (DALL-E/Stable Diffusion), which isn't part of the free-tier stack.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <form action={savePoster} className="space-y-3">
          <input type="hidden" name="event_title" value={form.eventTitle} />
          <input type="hidden" name="tagline" value={form.tagline} />
          <input type="hidden" name="speaker" value={form.speaker} />
          <input type="hidden" name="event_date" value={form.eventDate} />
          <input type="hidden" name="location" value={form.location} />
          <input type="hidden" name="template_key" value={form.templateKey} />
          <input type="hidden" name="theme_color" value={form.themeColor} />
          <input type="hidden" name="format" value={form.format} />

          <input
            placeholder="Church name (shown on poster)"
            value={form.churchName}
            onChange={(e) => update("churchName", e.target.value)}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            placeholder="Event title"
            value={form.eventTitle}
            onChange={(e) => update("eventTitle", e.target.value)}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />

          <div className="flex gap-2">
            <input
              placeholder="Tagline"
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              className="flex-1 border border-ink/20 rounded-lg px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleGenerateTagline}
              disabled={generating}
              className="text-xs bg-ink/5 px-3 py-2 rounded-lg whitespace-nowrap"
            >
              {generating ? "..." : "✨ AI suggest"}
            </button>
          </div>

          <input
            placeholder="Speaker (optional)"
            value={form.speaker}
            onChange={(e) => update("speaker", e.target.value)}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            placeholder="Date/time text, e.g. 'Sunday 10 Aug · 9AM'"
            value={form.eventDate}
            onChange={(e) => update("eventDate", e.target.value)}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />
          <input
            placeholder="Location (optional)"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />

          <div className="flex gap-2">
            {(["classic", "bold", "minimal"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update("templateKey", t)}
                className={`text-xs px-3 py-2 rounded-lg capitalize ${
                  form.templateKey === t ? "bg-ember text-white" : "border border-ink/20"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update("themeColor", c)}
                className="w-7 h-7 rounded-full border-2"
                style={{ backgroundColor: c, borderColor: form.themeColor === c ? "#1c1917" : "transparent" }}
              />
            ))}
          </div>

          <select
            value={form.format}
            onChange={(e) => update("format", e.target.value as PosterData["format"])}
            className="w-full border border-ink/20 rounded-lg px-4 py-2 text-sm"
          >
            <option value="square">Square (Instagram/Facebook)</option>
            <option value="story">Story (WhatsApp/Instagram Story)</option>
            <option value="print">Print (A4 portrait)</option>
          </select>

          <button type="submit" className="w-full bg-ink/5 py-2 rounded-lg text-sm font-medium">
            Save poster
          </button>
        </form>

        <div>
          <PosterPreview
            data={{
              churchName: form.churchName,
              eventTitle: form.eventTitle,
              tagline: form.tagline,
              speaker: form.speaker,
              eventDate: form.eventDate,
              location: form.location,
              templateKey: form.templateKey,
              themeColor: form.themeColor,
              format: form.format,
            }}
          />
        </div>
      </div>
    </div>
  );
}
