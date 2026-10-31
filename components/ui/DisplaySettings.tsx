"use client";

import { useEffect, useState } from "react";
import { applyHighContrast, applyTextSize, readHighContrast, readTextSize, TEXT_SIZES, type TextSize } from "@/lib/display-prefs";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { haptic, hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";

/** Text size, high contrast, vibration and light/dark — for this device. */
export function DisplaySettings() {
  const [size, setSize] = useState<TextSize | null>(null);
  const [contrast, setContrast] = useState(false);
  const [vibrate, setVibrate] = useState(true);
  useEffect(() => {
    setSize(readTextSize());
    setContrast(readHighContrast());
    setVibrate(hapticsEnabled());
  }, []);

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label">Text size</legend>
        <div className="grid grid-cols-3 gap-2">
          {TEXT_SIZES.map((t, i) => (
            <label
              key={t.value}
              className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-lg border px-2 py-2 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                size === t.value ? "border-gold bg-gold/10 font-semibold" : "border-line-strong hover:bg-surface-raised"
              }`}
            >
              <input
                type="radio"
                name="text-size"
                value={t.value}
                checked={size === t.value}
                onChange={() => {
                  setSize(t.value);
                  applyTextSize(t.value);
                }}
                className="sr-only"
              />
              <span aria-hidden className="font-display leading-none" style={{ fontSize: `${1.1 + i * 0.3}rem` }}>
                Aa
              </span>
              <span className="mt-1 text-xs">{t.label}</span>
            </label>
          ))}
        </div>
        <p className="hint">Makes all text in the app bigger on this device. The Bible reader also has its own size setting.</p>
      </fieldset>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-[rgb(var(--ember))]"
          checked={contrast}
          onChange={(e) => {
            setContrast(e.target.checked);
            applyHighContrast(e.target.checked);
          }}
        />
        <span>
          <span className="block text-sm font-semibold">High contrast</span>
          <span className="hint mt-0.5 block">Darker text and stronger borders, easier to read in sunlight or with low vision.</span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-[rgb(var(--ember))]"
          checked={vibrate}
          onChange={(e) => {
            setVibrate(e.target.checked);
            setHapticsEnabled(e.target.checked);
            if (e.target.checked) haptic("success");
          }}
        />
        <span>
          <span className="block text-sm font-semibold">Vibration</span>
          <span className="hint mt-0.5 block">A gentle buzz when you tap buttons, save something, or answer in a game. iPhones give a lighter tick.</span>
        </span>
      </label>

      <div>
        <p className="label">Colour theme</p>
        <ThemeSwitcher />
      </div>
    </div>
  );
}
