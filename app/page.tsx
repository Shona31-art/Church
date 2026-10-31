import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, HandCoins, HandHeart, HeartHandshake, MessagesSquare, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BrandMark, Wordmark } from "@/components/brand/BrandMark";
import { Cross } from "@/components/brand/Cross";
import { LightField } from "@/components/entry/LightField";
import { HeavenScene } from "@/components/entry/HeavenScene";
import { EntryIntro, introSeenScript } from "@/components/entry/EntryIntro";
import { APP_NAME, COMPANY_NAME } from "@/lib/brand";

// Public landing page. Signed-in people go straight to their dashboard.
// First visit in a session opens with the animated intro (EntryIntro).

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
      <script dangerouslySetInnerHTML={{ __html: introSeenScript }} />
      <EntryIntro />

      {/* Midnight-and-gold hero: a golden Bible opens above the clouds and a
          radiant cross rises from its light (HeavenScene). Phones: the scene
          sits above the headline; wider screens: beside it. */}
      <div className="scope-dark relative isolate overflow-hidden bg-[#050a1c]">
        {/* Phones: the header sits above the scene, never on it. Wider screens: over it. */}
        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:absolute lg:inset-x-0 lg:top-0">
          <BrandMark onPanel byline />
          <nav aria-label="Account" className="flex items-center gap-1 sm:gap-3">
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-amber hidden sm:inline-flex">
              Start free trial
            </Link>
          </nav>
        </header>
        <div className="relative h-[24rem] min-[420px]:h-[27rem] sm:h-[30rem] lg:absolute lg:inset-0 lg:h-auto">
          <HeavenScene fit="phone" className="[--cy:60%] lg:[--cx:73%] lg:[--cy:58%] lg:[--hv-scale:0.88] xl:[--hv-scale:1]" />
          {/* Fade the scene into the page: into the text below on phones, under the text on wide screens. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050a1c] to-transparent lg:hidden" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#050a1c] to-transparent lg:hidden" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-gradient-to-r from-[#050a1c] via-[#050a1c]/80 to-transparent lg:block" />
        </div>

        <section className="relative z-[7] mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:flex lg:min-h-[46rem] lg:items-center lg:pb-24 lg:pt-28">
          <div className="max-w-xl motion-safe:animate-fade-in">
            <p className="text-eyebrow font-semibold uppercase tracking-[0.3em] text-[#f5c86a]">{COMPANY_NAME} presents</p>
            <h1 className="mt-5 text-display font-medium sm:text-[3.6rem] sm:leading-[1.02] lg:text-[4rem]">
              Run your church with confidence —{" "}
              <em className="bg-gradient-to-r from-[#fff1c4] via-[#f5c86a] to-[#e39a2f] bg-clip-text font-display italic text-transparent">and with grace.</em>
            </h1>
            <div className="mt-8 h-px w-14 bg-gradient-to-r from-[#f5c86a] to-transparent" />
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-ink/85">
              {APP_NAME} brings pastoral care, prayer, sermons, the Bible, giving and church admin into one secure app your whole congregation
              can use — on any phone, every day of the week.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-amber btn-lg">
                Begin your 30-day trial
              </Link>
              <Link href="/login" className="btn btn-lg border border-[#f5c86a]/40 bg-transparent text-ink hover:bg-white/5">
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink/65">No card required for the trial.</p>
          </div>
        </section>
      </div>

      <main>
        <section aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
            <div className="max-w-2xl">
              <p className="eyebrow">What&apos;s inside</p>
              <h2 id="features-heading" className="mt-4 text-[2.5rem] font-medium leading-[1.08] sm:text-[3rem]">
                Everything your church does through the week
              </h2>
              <div className="rule-gold mt-6" />
            </div>
            <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ title, body, Icon }, i) => (
                <li
                  key={title}
                  className="card-interactive group relative overflow-hidden rounded-[24px] p-8"
                >
                  <span aria-hidden className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-opacity group-hover:opacity-100 ${i % 2 ? "bg-ember/10" : "bg-teal/15"} opacity-60`} />
                  <span
                    aria-hidden
                    className={`relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${
                      i % 2 ? "bg-gradient-to-br from-[#7a3a8c] to-[#3a1245] shadow-ember/30" : "bg-gradient-to-br from-[#5fc9d2] to-[#127a88] shadow-teal/30"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.6} />
                  </span>
                  <h3 className="relative mt-6 text-2xl font-medium">{title}</h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-ink/70">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="privacy-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="scope-dark panel-luxe hairline-gold relative isolate grid gap-10 overflow-hidden rounded-[28px] p-8 sm:p-14 lg:grid-cols-[2fr_3fr] lg:gap-16">
            <LightField crosses={1} motes={25} className="-z-10" />
            <div>
              <p className="eyebrow">Private by design</p>
              <h2 id="privacy-heading" className="mt-4 text-[2.25rem] font-medium leading-[1.1] sm:text-[2.6rem]">
                What&apos;s shared in confidence stays that way.
              </h2>
              <div className="rule-gold mt-6" />
            </div>
            <ul className="divide-y divide-line self-center">
              {PRIVACY_POINTS.map((point) => (
                <li key={point} className="flex gap-4 py-5 text-lede leading-relaxed text-ink/85 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="mx-auto max-w-6xl px-4 pb-28 text-center sm:px-6">
          <Cross className="float-slow mx-auto h-16 w-16" />
          <h2 id="cta-heading" className="mt-4 text-[2.5rem] font-medium leading-tight sm:text-[3rem]">
            Bring your church <em className="italic text-rose">together</em>
          </h2>
          <div className="rule-gold mx-auto mt-6" />
          <p className="mx-auto mt-6 max-w-md text-ink/70">Set up takes a few minutes. Invite your members when you&apos;re ready.</p>
          <Link href="/register" className="btn-primary btn-lg mt-10">
            Start your free trial
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-8 text-xs text-ink/60 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG with embedded fonts */}
            <img src="/brand/grace-bound-ventures.svg" alt={COMPANY_NAME} width={64} height={64} className="h-16 w-16 rounded-full bg-[#fdf7f8] p-0.5 shadow-xs" />
            <span>
              {APP_NAME} is made by {COMPANY_NAME}.
              <br />© {new Date().getFullYear()} {COMPANY_NAME}
            </span>
          </div>
          <span>Bible text: World English Bible and other public-domain versions</span>
        </div>
      </footer>
    </div>
  );
}
