"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyThemePreference, readThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Match device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** Three-way Light / Dark / Match-device switch (a radio group for screen readers). */
export function ThemeSwitcher() {
  // Starts as null so the server render and first client render match; the
  // real preference is read after mount.
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  useEffect(() => setTheme(readThemePreference()), []);

  function choose(value: ThemePreference) {
    setTheme(value);
    applyThemePreference(value);
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex rounded-xl border border-line bg-parchment p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={`flex h-7 w-8 items-center justify-center rounded-[10px] ${
              active ? "bg-surface text-ink shadow-xs" : "text-ink/50 hover:text-ink"
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
