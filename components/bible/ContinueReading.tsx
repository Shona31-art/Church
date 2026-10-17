"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BOOKS, readerHref } from "@/lib/bible/books";
import { versionById } from "@/lib/bible/versions";
import { readLastPlace, type LastPlace } from "@/lib/bible/reader-prefs";

/** "Continue reading John 3" from this device's last place, or "Start reading" for a first visit. */
export function ContinueReading() {
  const [last, setLast] = useState<LastPlace | null | undefined>(undefined);
  useEffect(() => setLast(readLastPlace()), []);

  const place = last && BOOKS[last.bookIndex] ? last : null;
  const href = place ? readerHref({ versionId: place.versionId, bookIndex: place.bookIndex, chapter: place.chapter }) : readerHref({ bookIndex: BOOKS.findIndex((b) => b.name === "John"), chapter: 1 });

  return (
    <Link href={href} className="card-interactive flex h-full items-start gap-4 rounded-2xl p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember text-on-ember">
        <BookOpen aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="eyebrow block">{place ? "Continue reading" : "Start reading"}</span>
        <span className="mt-1 block text-xl font-semibold">
          {last === undefined ? "…" : place ? `${BOOKS[place.bookIndex].name} ${place.chapter}` : "John 1"}
        </span>
        <span className="mt-0.5 block text-sm text-ink/55">
          {place ? versionById(place.versionId).name : "A good place to begin: the Gospel of John"}
        </span>
      </span>
    </Link>
  );
}
