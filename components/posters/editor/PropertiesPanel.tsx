"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Lock, LockOpen, Trash2, type LucideIcon } from "lucide-react";
import type { PosterDesign, PosterElement, ShapeElement, TextElement } from "@/lib/posters/design";
import { POSTER_FONTS } from "@/lib/posters/fonts";

type Change = (changes: Partial<PosterElement>, key: string) => void;

/**
 * Settings for the selected element (or the background when nothing is
 * selected). Every value the canvas can change by hand can also be set here
 * with labelled form fields, which is also the keyboard/screen-reader route
 * for editing a poster.
 */
export function PropertiesPanel({
  design,
  element,
  onChange,
  onBackgroundChange,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  design: PosterDesign;
  element: PosterElement | undefined;
  onChange: Change;
  onBackgroundChange: (background: PosterDesign["background"], key: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (where: "forward" | "backward") => void;
}) {
  if (!element) return <BackgroundSettings design={design} onChange={onBackgroundChange} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-semibold">{element.name ?? labelFor(element)}</h2>
        <div className="flex gap-0.5">
          <IconButton label="Bring forward" onClick={() => onReorder("forward")} icon={ArrowUp} />
          <IconButton label="Send backward" onClick={() => onReorder("backward")} icon={ArrowDown} />
          <IconButton label={element.locked ? "Unlock" : "Lock in place"} onClick={() => onChange({ locked: !element.locked }, "")} icon={element.locked ? Lock : LockOpen} pressed={Boolean(element.locked)} />
          <IconButton label="Duplicate" onClick={onDuplicate} icon={Copy} />
          <IconButton label="Delete" onClick={onDelete} icon={Trash2} danger />
        </div>
      </div>

      {element.type === "text" && <TextSettings element={element} onChange={onChange} />}
      {element.type === "shape" && <ShapeSettings element={element} onChange={onChange} />}
      {element.type === "image" && element.src.kind === "placeholder" && (
        <Field label="Photo slot label" id="prop-placeholder">
          <input
            id="prop-placeholder"
            className="input py-2"
            value={element.src.label}
            maxLength={60}
            onChange={(e) => onChange({ src: { kind: "placeholder", label: e.target.value } } as Partial<PosterElement>, `${element.id}:label`)}
          />
          <p className="hint">Adding real photos arrives with the Photos panel.</p>
        </Field>
      )}

      <fieldset className="space-y-3 border-t border-line pt-4">
        <legend className="eyebrow mb-2">Position and size</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={element.x} onChange={(x) => onChange({ x }, `${element.id}:x`)} />
          <NumberField label="Y" value={element.y} onChange={(y) => onChange({ y }, `${element.id}:y`)} />
          <NumberField label="Width" value={element.width} min={5} onChange={(width) => onChange({ width }, `${element.id}:w`)} />
          {!(element.type === "shape" && element.shape === "line") && element.type !== "text" && (
            <NumberField label="Height" value={element.height} min={5} onChange={(height) => onChange({ height }, `${element.id}:h`)} />
          )}
          <NumberField label="Rotation (°)" value={element.rotation} min={-360} max={360} onChange={(rotation) => onChange({ rotation }, `${element.id}:rot`)} />
        </div>
        <RangeField label="Opacity" value={element.opacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => onChange({ opacity }, `${element.id}:opacity`)} />
      </fieldset>
    </div>
  );
}

function TextSettings({ element, onChange }: { element: TextElement; onChange: Change }) {
  const font = POSTER_FONTS.find((f) => f.name === element.fontFamily) ?? POSTER_FONTS[0];
  const set = (changes: Partial<TextElement>, key: string) => onChange(changes as Partial<PosterElement>, `${element.id}:${key}`);
  return (
    <div className="space-y-4">
      <Field label="Text" id="prop-text">
        <textarea id="prop-text" className="input min-h-[5rem] resize-y py-2" value={element.text} maxLength={1000} onChange={(e) => set({ text: e.target.value }, "text")} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font" id="prop-font">
          <select
            id="prop-font"
            className="input py-2"
            value={font.name}
            onChange={(e) => {
              const next = POSTER_FONTS.find((f) => f.name === e.target.value)!;
              // Keep the weight if the new font has it; otherwise the nearest one it does have.
              const weight = next.weights.includes(element.fontWeight) ? element.fontWeight : nearest(next.weights, element.fontWeight);
              set({ fontFamily: next.name, fontWeight: weight as TextElement["fontWeight"] }, "font");
            }}
          >
            {POSTER_FONTS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Weight" id="prop-weight">
          <select id="prop-weight" className="input py-2" value={element.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) as TextElement["fontWeight"] }, "weight")}>
            {font.weights.map((w) => (
              <option key={w} value={w}>
                {WEIGHT_NAMES[w] ?? w}
              </option>
            ))}
          </select>
        </Field>
        <NumberField label="Size" value={element.fontSize} min={6} max={1200} onChange={(fontSize) => set({ fontSize }, "size")} />
        <ColorField label="Colour" id="prop-fill" value={element.fill} onChange={(fill) => set({ fill }, "fill")} />
      </div>

      <fieldset>
        <legend className="label">Alignment</legend>
        <div className="flex gap-1">
          {(
            [
              ["left", AlignLeft, "Align left"],
              ["center", AlignCenter, "Centre"],
              ["right", AlignRight, "Align right"],
            ] as const
          ).map(([value, Icon, label]) => (
            <IconButton key={value} label={label} icon={Icon} pressed={element.align === value} onClick={() => set({ align: value }, "align")} />
          ))}
          <span className="mx-1 w-px bg-line" />
          <ToggleButton label="Italic" pressed={element.italic} onClick={() => set({ italic: !element.italic }, "italic")}>
            <span className="font-serif italic">I</span>
          </ToggleButton>
          <ToggleButton label="All capitals" pressed={element.uppercase} onClick={() => set({ uppercase: !element.uppercase }, "upper")}>
            AA
          </ToggleButton>
        </div>
      </fieldset>

      <RangeField label="Line spacing" value={element.lineHeight} min={0.6} max={2.5} step={0.05} format={(v) => v.toFixed(2)} onChange={(lineHeight) => set({ lineHeight }, "lh")} />
      <RangeField label="Letter spacing" value={element.letterSpacing} min={-10} max={60} step={1} format={(v) => `${v}`} onChange={(letterSpacing) => set({ letterSpacing }, "ls")} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(element.shadow)}
            onChange={(e) =>
              set({ shadow: e.target.checked ? { color: "#000000", blur: Math.round(element.fontSize / 6), offsetX: 0, offsetY: Math.round(element.fontSize / 20), opacity: 0.45 } : undefined }, "shadow")
            }
          />
          Shadow
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(element.stroke)}
            onChange={(e) => set({ stroke: e.target.checked ? { color: "#000000", width: Math.max(1, Math.round(element.fontSize / 30)) } : undefined }, "stroke")}
          />
          Outline
        </label>
      </div>
      {element.stroke && (
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Outline colour" id="prop-stroke" value={element.stroke.color} onChange={(color) => set({ stroke: { ...element.stroke!, color } }, "strokec")} />
          <NumberField label="Outline width" value={element.stroke.width} min={0} max={50} onChange={(width) => set({ stroke: { ...element.stroke!, width } }, "strokew")} />
        </div>
      )}
    </div>
  );
}

function ShapeSettings({ element, onChange }: { element: ShapeElement; onChange: Change }) {
  const set = (changes: Partial<ShapeElement>, key: string) => onChange(changes as Partial<PosterElement>, `${element.id}:${key}`);
  const isLine = element.shape === "line";
  return (
    <div className="space-y-4">
      {!isLine && (
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Fill" id="prop-shape-fill" value={element.fill ?? "#ffffff"} onChange={(fill) => set({ fill }, "fill")} />
          <RangeField label="Fill opacity" value={element.fillOpacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(fillOpacity) => set({ fillOpacity }, "fo")} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <ColorField label={isLine ? "Colour" : "Border colour"} id="prop-shape-stroke" value={element.stroke ?? "#000000"} onChange={(stroke) => set({ stroke }, "stroke")} />
        <NumberField label={isLine ? "Thickness" : "Border width"} value={element.strokeWidth} min={0} max={200} onChange={(strokeWidth) => set({ strokeWidth, stroke: element.stroke ?? "#000000" }, "sw")} />
      </div>
      {element.shape === "rect" && (
        <NumberField label="Corner rounding" value={element.cornerRadius} min={0} max={2000} onChange={(cornerRadius) => set({ cornerRadius }, "radius")} />
      )}
    </div>
  );
}

function BackgroundSettings({ design, onChange }: { design: PosterDesign; onChange: (bg: PosterDesign["background"], key: string) => void }) {
  const bg = design.background;
  return (
    <div className="space-y-4">
      <h2 className="font-sans text-sm font-semibold">Background</h2>
      <p className="text-sm text-ink/55">Select something on the poster to edit it, or change the background here.</p>
      <ColorField label="Colour" id="prop-bg" value={bg.color} onChange={(color) => onChange({ ...bg, color }, "bg:color")} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(bg.gradient)}
          onChange={(e) => onChange({ ...bg, gradient: e.target.checked ? { from: bg.color, to: "#000000", angle: 180 } : undefined }, "bg:gradient")}
        />
        Gradient
      </label>
      {bg.gradient && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="From" id="prop-bg-from" value={bg.gradient.from} onChange={(from) => onChange({ ...bg, gradient: { ...bg.gradient!, from } }, "bg:from")} />
            <ColorField label="To" id="prop-bg-to" value={bg.gradient.to} onChange={(to) => onChange({ ...bg, gradient: { ...bg.gradient!, to } }, "bg:to")} />
          </div>
          <RangeField label="Direction" value={bg.gradient.angle} min={0} max={360} step={5} format={(v) => `${v}°`} onChange={(angle) => onChange({ ...bg, gradient: { ...bg.gradient!, angle } }, "bg:angle")} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small labelled controls

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label text-xs">
        {label}
      </label>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, min = -20000, max = 20000 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const id = `prop-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Field label={label} id={id}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="input tabular py-2"
        value={Math.round(value * 10) / 10}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </Field>
  );
}

function RangeField({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  const id = `prop-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <label htmlFor={id} className="label mb-0 text-xs">
          {label}
        </label>
        <span className="tabular text-xs text-ink/55">{format(value)}</span>
      </div>
      <input id={id} type="range" className="w-full accent-[rgb(var(--ember))]" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function ColorField({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} id={id}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-0.5" />
        <input
          id={id}
          className="input tabular py-2 uppercase"
          defaultValue={value}
          key={value}
          maxLength={7}
          onBlur={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value.toLowerCase())}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </Field>
  );
}

function IconButton({ label, icon: Icon, onClick, pressed, danger }: { label: string; icon: LucideIcon; onClick: () => void; pressed?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${pressed ? "bg-surface-raised text-ink" : danger ? "text-danger hover:bg-danger-tint" : "text-ink/60 hover:bg-ink/5 hover:text-ink"}`}
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}

function ToggleButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold ${pressed ? "bg-surface-raised text-ink" : "text-ink/60 hover:bg-ink/5"}`}
    >
      {children}
    </button>
  );
}

const WEIGHT_NAMES: Record<number, string> = { 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };

function nearest(options: readonly number[], target: number) {
  return options.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), options[0]);
}

export function labelFor(element: PosterElement): string {
  if (element.name) return element.name;
  if (element.type === "text") return element.text.split("\n")[0].slice(0, 30) || "Text";
  if (element.type === "image") return "Photo";
  if (element.type === "group") return element.role === "speaker" ? "Speaker" : "Group";
  if (element.type === "icon") return "Icon";
  return { rect: "Rectangle", ellipse: "Circle", line: "Line", triangle: "Triangle" }[element.shape];
}
