import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, HandCoins, HandHeart, HeartHandshake, MessagesSquare, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand/BrandMark";
import { PhotoPlaceholder } from "@/components/brand/PhotoPlaceholder";

// Public landing page. Signed-in people go straight to their dashboard.
//
// BRAND PLACEHOLDER: no logo or photography yet — BrandMark draws a stand-in
// mark and PhotoPlaceholder marks where the hero photo goes. Replace both
// before this is presented as final.

const FEATURES: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: "Prayer board & wall",
    body: "Keep a private prayer board, share requests with your church, and celebrate answered prayers as testimonies.",
    Icon: HandHeart,
  },
  {
    title: "Sermons & the Bible",
    body: "Sermon summaries with small-group questions, a full Bible reader with notes and highlights, and guided study.",
    Icon: BookOpen,
  },
  {
    title: "Pastoral care",
    body: "A confidential care log, follow-up reminders and birthday reach-outs — visible only to pastors.",
    Icon: HeartHandshake,
  },
  {
    title: "Church life",
    body: "Announcements, the calendar and RSVPs, service planning, pastor bookings and event posters.",
    Icon: CalendarDays,
  },
  {
    title: "Messages",
    body: "Department channels and direct messages, with notifications on the phone when something needs you.",
    Icon: MessagesSquare,
  },
  {
    title: "Giving",
    body: "Record tithes and offerings, with a clear giving report for every member.",
    Icon: HandCoins,
  },
];

const PRIVACY_POINTS = [
  "Personal journals are encrypted — not even your pastor or church admin can read them.",
  "The pastoral care log is visible only to your church's pastors and admins.",
  "Every church's data is kept separate from every other church's.",
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <BrandMark />
        <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Start free trial
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-2 lg:gap-16 lg:pb-28">
          <div className="motion-safe:animate-fade-in">
            <p className="eyebrow">For churches of every size</p>
            <h1 className="mt-4 max-w-xl text-[40px] font-semibold leading-[1.1] sm:text-5xl lg:text-[56px]">
              A church operating system for people, not just Sundays.
            </h1>
            <div className="rule-gold mt-6" />
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/65">
              Pastoral care, prayer, sermons, the Bible and everyday church admin — in one calm, private place for your
              whole congregation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary btn-lg">
                Start your 30-day free trial
              </Link>
              <Link href="/login" className="btn-secondary btn-lg">
                I already have an account
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink/60">No card required for the trial.</p>
          </div>
          <PhotoPlaceholder label="Awaiting church photo — 1600×1200" className="aspect-[4/3] w-full" />
        </section>

        <section aria-labelledby="features-heading" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="eyebrow">What&apos;s inside</p>
            <h2 id="features-heading" className="mt-3 max-w-xl text-3xl font-semibold leading-tight sm:text-[34px]">
              Everything your church does through the week
            </h2>
            <div className="rule-gold mt-5" />
            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ title, body, Icon }) => (
                <li key={title}>
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-parchment text-gold">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 rounded-3xl bg-panel p-8 text-on-panel sm:p-12 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-panel/60">Private by design</p>
              <h2 id="privacy-heading" className="mt-3 text-3xl font-semibold leading-tight">
                What&apos;s shared in confidence stays that way.
              </h2>
              <div className="rule-gold mt-5" />
            </div>
            <ul className="space-y-5 self-center">
              {PRIVACY_POINTS.map((point) => (
                <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-on-panel/85">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="mx-auto max-w-6xl px-4 pb-24 text-center sm:px-6">
          <h2 id="cta-heading" className="text-3xl font-semibold">
            Bring your church together
          </h2>
          <p className="mx-auto mt-3 max-w-md text-ink/60">Set up takes a few minutes. Invite your members when you&apos;re ready.</p>
          <Link href="/register" className="btn-primary btn-lg mt-8">
            Start your free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink/60 sm:px-6">
          <span>© {new Date().getFullYear()} Grace-bound</span>
          <span>Bible text: World English Bible and other public-domain versions</span>
        </div>
      </footer>
    </div>
  );
}
