import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Public landing page. Signed-in people go straight to their dashboard.
//
// BRAND PLACEHOLDER: no logo or photography yet — the square below is a
// stand-in mark. Replace with the church/product logo (SVG in /public) and
// real imagery before this is presented as final.

const FEATURES = [
  { title: "Prayer board & wall", body: "Keep a private prayer board, share requests with your church, and celebrate answered prayers as testimonies." },
  { title: "Sermons & Bible study", body: "AI sermon summaries with small-group questions, a full Bible reader, and guided study: explanations, devotionals and reading plans." },
  { title: "Pastoral care", body: "A confidential care log, follow-up reminders and birthday reach-outs — visible only to pastors." },
  { title: "Church life", body: "Announcements, calendar & RSVPs, department chats, service planning, pastor bookings and event posters." },
  { title: "Giving", body: "Record tithes and offerings with a clear giving report for every member." },
  { title: "Private by design", body: "Journals are encrypted and never readable by admins. Every church's data is isolated from every other." },
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block w-3 h-3 bg-ember rounded-sm" />
          <span className="font-semibold">Grace-bound</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="px-3 py-2 rounded-lg hover:bg-ink/5">Sign in</Link>
          <Link href="/register" className="bg-ember text-white px-4 py-2 rounded-lg font-medium">
            Start free trial
          </Link>
        </nav>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20">
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight max-w-2xl">
          A church operating system for people, not just Sundays.
        </h1>
        <div className="rule-gold mt-5" />
        <p className="mt-6 text-lg text-ink/60 max-w-xl">
          Pastoral care, prayer, sermons, the Bible and everyday church admin — in one calm, private place for
          your whole congregation.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
            Start your 30-day free trial
          </Link>
          <Link href="/login" className="border border-ink/15 px-6 py-3 rounded-lg font-medium hover:bg-ink/5">
            I already have an account
          </Link>
        </div>
        <p className="mt-3 text-xs text-ink/40">No card required for the trial.</p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24" aria-labelledby="features-heading">
        <h2 id="features-heading" className="sr-only">Features</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-elevated rounded-2xl p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-ink/60 mt-2 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-ink/40">
          © {new Date().getFullYear()} Grace-bound · Bible text: World English Bible (public domain)
        </div>
      </footer>
    </main>
  );
}
