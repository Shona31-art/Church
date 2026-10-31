"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, BookOpen, Gift, HandHeart, MessagesSquare, Smartphone, type LucideIcon } from "lucide-react";
import { Cross } from "@/components/brand/Cross";

const DONE_KEY = "welcome-tour-done";

interface Step {
  /** Shown only if this page is in the person's menu ("" = always). */
  requires: string;
  Icon: LucideIcon;
  title: string;
  body: string;
  link?: { href: string; label: string };
}

const STEPS: Step[] = [
  { requires: "/dashboard/bible", Icon: BookOpen, title: "The Bible, even offline", body: "Read in four translations, highlight verses and keep notes. Download books to read without signal.", link: { href: "/dashboard/bible", label: "Open the Bible" } },
  { requires: "/dashboard/prayer-board", Icon: HandHeart, title: "Pray together", body: "Keep a private prayer board, or share a request with your church and see when people pray for you.", link: { href: "/dashboard/prayer-board/new", label: "Add a prayer" } },
  { requires: "/dashboard/chat", Icon: MessagesSquare, title: "Stay in touch", body: "Your department and church chats, and private messages, all in one place." },
  { requires: "/dashboard/giving", Icon: Gift, title: "Give simply", body: "Tithes and offerings by bank transfer or card, with your giving history kept for you.", link: { href: "/dashboard/giving", label: "See giving" } },
  { requires: "", Icon: BellRing, title: "Don't miss a thing", body: "Turn on notifications for announcements, prayers and messages — and add the app to your home screen.", link: { href: "/dashboard/account#notifications", label: "Notification settings" } },
];

/**
 * A short welcome for someone's first visit (per device): what's here and
 * where to start. Skippable at any point, and never shown again once closed.
 * Steps follow what this person's church and role actually include.
 */
export function WelcomeTour({ availableHrefs, firstName }: { availableHrefs: string[]; firstName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const steps = STEPS.filter((s) => !s.requires || availableHrefs.includes(s.requires));

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) return;
    } catch {
      return; // no storage: don't risk showing it every visit
    }
    // Let the dashboard paint first.
    const timer = setTimeout(() => dialog.current?.showModal(), 600);
    return () => clearTimeout(timer);
  }, []);

  function finish() {
    try {
      localStorage.setItem(DONE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    dialog.current?.close();
  }

  const welcome = index === 0;
  const step = welcome ? null : steps[index - 1];
  const last = index === steps.length;

  return (
    <dialog
      ref={dialog}
      onCancel={finish}
      aria-labelledby="tour-title"
      className="m-0 mt-auto w-full max-w-full rounded-t-[28px] p-0 text-ink shadow-pop backdrop:bg-ink/50 backdrop:backdrop-blur-[2px] motion-safe:animate-modal-in sm:m-auto sm:max-w-md sm:rounded-[28px]"
    >
      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 text-center sm:px-8">
        {welcome ? (
          <>
            <Cross className="mx-auto h-16 w-16" />
            <h2 id="tour-title" className="mt-5 text-title font-medium">
              Welcome, <em className="italic text-rose">{firstName}</em>
            </h2>
            <div className="rule-gold mx-auto mt-4" />
            <p className="mt-4 text-ink/70">Your church, in your pocket. Here&apos;s a quick look at what you can do — it takes 30 seconds.</p>
          </>
        ) : (
          step && (
            <>
              <span aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 text-gold-deep">
                <step.Icon className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <h2 id="tour-title" className="mt-5 text-title-sm font-medium">
                {step.title}
              </h2>
              <p className="mt-3 text-ink/70">{step.body}</p>
              {step.link && (
                <Link href={step.link.href} onClick={finish} className="link mt-3 inline-block text-sm">
                  {step.link.label}
                </Link>
              )}
            </>
          )
        )}

        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {[0, ...steps.map((_, i) => i + 1)].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-gold" : "w-1.5 bg-ink/20"}`} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {index + 1} of {steps.length + 1}
        </p>

        <div className="mt-6 flex gap-2">
          {last ? (
            <button type="button" className="btn-primary flex-1" onClick={finish} autoFocus>
              <Smartphone aria-hidden className="h-4 w-4" /> Start using the app
            </button>
          ) : (
            <>
              <button type="button" className="btn-ghost flex-1" onClick={finish}>
                Skip
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setIndex((i) => i + 1)} autoFocus>
                {welcome ? "Show me" : "Next"}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
