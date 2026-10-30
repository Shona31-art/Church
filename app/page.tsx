import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, HandCoins, HandHeart, HeartHandshake, MessagesSquare, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand/BrandMark";
import { Ornament } from "@/components/brand/Ornament";

// Public landing page. Signed-in people go straight to their dashboard.
//
// BRAND PLACEHOLDER: no logo or photography yet — BrandMark draws a stand-in
// mark and Ornament (gold-line artwork) holds the hero photo's place. Replace
// both before this is presented as final.

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

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

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
    <div className="min-h-screen min-h-dvh">
      {/* Obsidian hero: header and headline share one dark, softly lit band. */}
      <div className="scope-dark panel-luxe">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <BrandMark />
          <nav aria-label="Account" className="flex items-center gap-1 sm:gap-3">
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn-gold hidden sm:inline-flex">
              Start free trial
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-20 lg:pb-32">
          <div className="motion-safe:animate-fade-in">
            <p className="eyebrow">For churches of every size</p>
            <h1 className="mt-6 max-w-2xl text-display font-medium sm:text-[58px] sm:leading-[1.02] lg:text-display-lg">
              A church operating system for people, <em className="font-display italic text-gold">not just Sundays.</em>
            </h1>
            <div className="rule-gold mt-8" />
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink/70">
              Pastoral care, prayer, sermons, the Bible and everyday church admin — in one calm, private place for your
              whole congregation.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/register" className="btn-gold btn-lg">
                Begin your 30-day trial
              </Link>
              <Link href="/login" className="btn-secondary btn-lg bg-transparent">
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink/60">No card required for the trial.</p>
          </div>
          <Ornament verse="Let all that you do be done in love." reference="1 Corinthians 16:14" className="aspect-[4/5] w-full max-w-md justify-self-center lg:justify-self-end" />
        </section>
      </div>

      <main>
        <section aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <div className="max-w-2xl">
              <p className="eyebrow">What&apos;s inside</p>
              <h2 id="features-heading" className="mt-4 text-[40px] font-medium leading-[1.08] sm:text-[48px]">
                Everything your church does through the week
              </h2>
              <div className="rule-gold mt-6" />
            </div>
            <ul className="mt-16 grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ title, body, Icon }, i) => (
                <li key={title} className="group bg-surface p-8 transition-colors hover:bg-parchment sm:p-10">
                  <div className="flex items-center justify-between">
                    <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 text-gold-deep transition-colors group-hover:border-gold">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <span aria-hidden className="font-display text-lg italic text-ink/30">{ROMAN[i]}</span>
                  </div>
                  <h3 className="mt-6 text-2xl font-medium">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/65">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="scope-dark panel-luxe hairline-gold grid gap-10 rounded-[28px] p-8 sm:p-14 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <div>
              <p className="eyebrow">Private by design</p>
              <h2 id="privacy-heading" className="mt-4 text-[36px] font-medium leading-[1.1] sm:text-[42px]">
                What&apos;s shared in confidence stays that way.
              </h2>
              <div className="rule-gold mt-6" />
            </div>
            <ul className="divide-y divide-line self-center">
              {PRIVACY_POINTS.map((point) => (
                <li key={point} className="flex gap-4 py-5 text-lede leading-relaxed text-ink/80 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="mx-auto max-w-6xl px-4 pb-28 text-center sm:px-6">
          <p className="eyebrow">Begin</p>
          <h2 id="cta-heading" className="mt-4 text-[40px] font-medium leading-tight sm:text-[48px]">
            Bring your church <em className="italic text-gold-deep">together</em>
          </h2>
          <div className="rule-gold mx-auto mt-6" />
          <p className="mx-auto mt-6 max-w-md text-ink/65">Set up takes a few minutes. Invite your members when you&apos;re ready.</p>
          <Link href="/register" className="btn-primary btn-lg mt-10">
            Start your free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-ink/60 sm:px-6">
          <span className="uppercase tracking-[0.2em]">© {new Date().getFullYear()} Grace-bound</span>
          <span>Bible text: World English Bible and other public-domain versions</span>
        </div>
      </footer>
    </div>
  );
}
