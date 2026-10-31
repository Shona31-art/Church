"use client";

import { useEffect, useRef, useState } from "react";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/lib/brand";
import { HeavenScene, INTRO_EVENT, sceneStartTime } from "./HeavenScene";

export const INTRO_SEEN_KEY = "intro-seen";

/** Runs before paint (app/page.tsx): visitors who've already seen the intro this session never see it flash. */
export const introSeenScript = `try{if(sessionStorage.getItem(${JSON.stringify(INTRO_SEEN_KEY)}))document.documentElement.dataset.introSeen="1"}catch(e){}`;

// When each part appears, in seconds — matched to the scene (globals.css, .hv-*):
// the cross has risen by about 10.4s.
const REVEAL_AT = 9.8;
const READY_AT = 10.6;

/**
 * The opening of the public site, full screen: "Grace-bound Ventures
 * presents" over the floating golden Bible; then the Bible opens, its pages
 * turn, light pours out and the cross rises (the same HeavenScene as the
 * landing hero); then "Grace", the tagline and Enter. The hero underneath
 * waits while this plays. Once per browser session; Skip (or Escape) at any
 * moment; not shown to people who prefer reduced motion (globals.css).
 */
export function EntryIntro() {
  const [stage, setStage] = useState<"presents" | "story" | "reveal" | "ready">("presents");
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.introSeen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      return;
    }
    document.documentElement.style.overflow = "hidden";
    window.dispatchEvent(new CustomEvent(INTRO_EVENT, { detail: { open: true } }));
    // Time each part from when the scene actually started (it may have been
    // drawn before this script ran).
    const elapsed = performance.now() - sceneStartTime(document.querySelector("[data-entry-intro] .hv"));
    const at = (seconds: number) => Math.max(0, seconds * 1000 - elapsed);
    const timers = [
      setTimeout(() => setStage("story"), at(3.2)),
      setTimeout(() => setStage("reveal"), at(REVEAL_AT)),
      setTimeout(() => setStage("ready"), at(READY_AT)),
    ];
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage === "ready") enterRef.current?.focus({ preventScroll: true });
  }, [stage]);

  function finish() {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setLeaving(true);
    document.documentElement.style.overflow = "";
    window.dispatchEvent(new CustomEvent(INTRO_EVENT, { detail: { open: false } }));
    setTimeout(() => setGone(true), 900);
  }

  if (gone) return null;
  const shown = stage === "reveal" || stage === "ready";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome to ${APP_NAME}`}
      data-entry-intro
      className={`scope-dark fixed inset-0 z-[60] overflow-hidden bg-[#050a1c] transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(0.7,0,0.2,1)] ${
        leaving ? "pointer-events-none scale-110 opacity-0 blur-sm" : "opacity-100"
      }`}
    >
      <HeavenScene fit="screen" replay={false} className="[--cy:40%] sm:[--cy:44%]" />
      {/* A dark band at the foot of the screen, so the name and button read clearly over the bright clouds. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[45%] bg-gradient-to-t from-[#050a1c] via-[#050a1c]/85 to-transparent" />

      {/* Act 1: the company presents, over the floating Bible. */}
      <div
        className={`absolute inset-0 z-[7] flex flex-col items-center justify-center bg-[#050a1c]/55 px-6 text-center transition-all duration-1000 ${
          stage === "presents" ? "opacity-100" : "pointer-events-none -translate-y-6 scale-95 opacity-0"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG with embedded fonts */}
        <img
          src="/brand/grace-bound-ventures.svg"
          alt={COMPANY_NAME}
          width={384}
          height={384}
          className="intro-rise w-64 rounded-full bg-[#fdf7f8]/95 p-2 shadow-[0_0_60px_rgba(245,200,106,0.45)] sm:w-80"
        />
        <p className="intro-rise-late mt-5 text-eyebrow font-semibold uppercase tracking-[0.5em] text-[#f5c86a]">presents</p>
      </div>

      {/* Act 2: Grace, beneath the risen cross. */}
      <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[7] flex flex-col items-center px-6 text-center" aria-hidden={!shown}>
        {shown && (
          <>
            <h1 className="intro-write bg-gradient-to-r from-[#fff8e1] via-[#f8d488] to-[#f0b04a] bg-clip-text px-4 pb-3 pt-4 font-script text-[4.25rem] font-normal leading-none text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)] sm:text-[6rem]">
              {APP_NAME}
            </h1>
            <p className="intro-rise-late max-w-sm text-lede text-ink/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">{APP_TAGLINE}</p>
          </>
        )}
        <div className={`mt-6 transition-all duration-700 ${stage === "ready" ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
          <button ref={enterRef} type="button" onClick={finish} className="btn btn-amber btn-lg min-w-[12rem]">
            Enter
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={finish}
        className="btn-ghost btn-sm absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-[8] text-ink/80"
      >
        Skip intro
      </button>
    </div>
  );
}
