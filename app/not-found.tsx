import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
      <BrandMark className="self-start" />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="max-w-sm text-center">
          <p className="eyebrow">Error 404</p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight">Page not found</h1>
          <div className="rule-gold mx-auto mt-3" />
          <p className="mt-4 text-sm text-ink/60">That page doesn&apos;t exist or may have moved.</p>
          <Link href="/dashboard" className="btn-primary mt-6">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
