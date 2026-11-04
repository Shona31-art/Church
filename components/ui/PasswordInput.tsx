"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password box with an eye button to show or hide what's typed. Takes the
 * same props as <input> (type is managed here).
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Optional: control showing from outside (e.g. after "Suggest a password"). */
  shown?: boolean;
  onShownChange?: (shown: boolean) => void;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ className = "input", shown: shownProp, onShownChange, ...props }, ref) {
  const [shownState, setShownState] = useState(false);
  const shown = shownProp ?? shownState;
  const setShown = (next: boolean) => {
    setShownState(next);
    onShownChange?.(next);
  };
  return (
    <div className="relative">
      <input ref={ref} {...props} type={shown ? "text" : "password"} className={`${className} pr-12`} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-ink/55 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember"
      >
        {shown ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
      </button>
    </div>
  );
});
