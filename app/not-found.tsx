import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <div className="rule-gold mx-auto mt-2" />
        <p className="text-sm text-ink/60 mt-4">That page doesn't exist or may have moved.</p>
        <Link href="/dashboard" className="inline-block mt-6 bg-ember text-white px-5 py-2.5 rounded-lg text-sm font-medium">
          Back to home
        </Link>
      </div>
    </main>
  );
}
