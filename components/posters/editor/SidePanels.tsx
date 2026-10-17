"use client";

import { Circle, ImageIcon, Lock, Minus, Square, Triangle, Type, UserRound } from "lucide-react";
import type { PosterDesign, ShapeElement } from "@/lib/posters/design";
import { TEXT_PRESETS } from "@/lib/posters/elements";
import { labelFor } from "./PropertiesPanel";
import { POSTER_ICONS } from "@/lib/posters/icons";

/** "Add" tools: text presets, shapes and an empty photo slot. */
export function InsertPanel({
  onAddText,
  onAddShape,
  onAddPhotoSlot,
  onAddSpeaker,
  onOpenPhotos,
  onAddIcon,
}: {
  onAddText: (preset: keyof typeof TEXT_PRESETS) => void;
  onAddShape: (shape: ShapeElement["shape"]) => void;
  onAddPhotoSlot: () => void;
  onAddSpeaker: () => void;
  onOpenPhotos: () => void;
  onAddIcon: (key: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section aria-labelledby="insert-text">
        <h2 id="insert-text" className="eyebrow mb-2">
          Text
        </h2>
        <div className="space-y-1.5">
          <AddButton onClick={() => onAddText("heading")} className="text-lg font-extrabold">
            <Type aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Add a heading
          </AddButton>
          <AddButton onClick={() => onAddText("subheading")} className="text-base font-semibold">
            <Type aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Add a subheading
          </AddButton>
          <AddButton onClick={() => onAddText("body")} className="text-sm">
            <Type aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Add body text
          </AddButton>
        </div>
      </section>

      <section aria-labelledby="insert-shapes">
        <h2 id="insert-shapes" className="eyebrow mb-2">
          Shapes
        </h2>
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              ["rect", Square, "Rectangle"],
              ["ellipse", Circle, "Circle"],
              ["triangle", Triangle, "Triangle"],
              ["line", Minus, "Line"],
            ] as const
          ).map(([shape, Icon, label]) => (
            <button
              key={shape}
              type="button"
              onClick={() => onAddShape(shape)}
              aria-label={`Add ${label.toLowerCase()}`}
              title={label}
              className="flex aspect-square items-center justify-center rounded-xl border border-line bg-surface hover:border-line-strong hover:bg-surface-raised"
            >
              <Icon aria-hidden className="h-5 w-5 text-ink/60" />
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="insert-icons">
        <h2 id="insert-icons" className="eyebrow mb-2">
          Icons
        </h2>
        <ul className="grid grid-cols-5 gap-1.5">
          {POSTER_ICONS.map((icon) => (
            <li key={icon.key}>
              <button
                type="button"
                onClick={() => onAddIcon(icon.key)}
                aria-label={`Add ${icon.label.toLowerCase()} icon`}
                title={icon.label}
                className="flex aspect-square w-full items-center justify-center rounded-xl border border-line bg-surface p-1.5 hover:border-line-strong hover:bg-surface-raised"
              >
                <svg viewBox="0 0 100 100" aria-hidden className="h-full w-full fill-ink/70">
                  <path d={icon.path} />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="insert-photo">
        <h2 id="insert-photo" className="eyebrow mb-2">
          Photos
        </h2>
        <div className="space-y-1.5">
          <AddButton onClick={onOpenPhotos} className="text-sm">
            <ImageIcon aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Upload or find a photo
          </AddButton>
          <AddButton onClick={onAddPhotoSlot} className="text-sm">
            <Square aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Add an empty photo slot
          </AddButton>
        </div>
      </section>

      <section aria-labelledby="insert-speakers">
        <h2 id="insert-speakers" className="eyebrow mb-2">
          Speakers
        </h2>
        <AddButton onClick={onAddSpeaker} className="text-sm">
          <UserRound aria-hidden className="h-4 w-4 shrink-0 text-ink/45" /> Add a speaker
        </AddButton>
        <p className="hint">Photo, name and title that move together. Add as many as you need.</p>
      </section>
    </div>
  );
}

/** Every element, top layer first, as keyboard-accessible buttons. */
export function LayersPanel({ design, selectedId, onSelect }: { design: PosterDesign; selectedId: string | null; onSelect: (id: string) => void }) {
  const layers = [...design.elements].reverse();
  return (
    <section aria-labelledby="layers-title">
      <h2 id="layers-title" className="eyebrow mb-2">
        Layers <span className="normal-case tracking-normal text-ink/40">(top first)</span>
      </h2>
      {layers.length ? (
        <ul className="space-y-0.5">
          {layers.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect(e.id)}
                aria-pressed={e.id === selectedId}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                  e.id === selectedId ? "bg-surface-raised font-semibold text-ink" : "text-ink/70 hover:bg-ink/[0.04]"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{labelFor(e)}</span>
                <span className="text-xs text-ink/40">{e.type === "shape" ? e.shape : e.type}</span>
                {e.locked && (
                  <>
                    <Lock aria-hidden className="h-3.5 w-3.5 text-ink/40" />
                    <span className="sr-only">(locked)</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/55">Nothing on the poster yet. Add text or shapes above.</p>
      )}
    </section>
  );
}

function AddButton({ onClick, className = "", children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-line-strong hover:bg-surface-raised ${className}`}
    >
      {children}
    </button>
  );
}
