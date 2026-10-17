import { bookFileUrl, type BookText } from "./books";
import { TEXT_CACHE, offlineSupported } from "./offline";

/** A downloaded copy (lib/bible/offline.ts), if there is one. */
async function fromOfflineCopy(url: string): Promise<Response | undefined> {
  if (!offlineSupported()) return undefined;
  try {
    return await (await caches.open(TEXT_CACHE)).match(url);
  } catch {
    return undefined;
  }
}

// Browser-side loader for the static text files in public/bibles/.
// Keeps each book in memory for the visit, so moving between chapters of the
// same book never refetches. Reads a downloaded copy first when there is one.

const loaded = new Map<string, Promise<BookText>>();

export class BookLoadError extends Error {
  constructor(readonly offline: boolean) {
    super(offline ? "offline" : "load failed");
  }
}

export function loadBook(versionId: string, bookIndex: number): Promise<BookText> {
  const url = bookFileUrl(versionId, bookIndex);
  let book = loaded.get(url);
  if (!book) {
    book = fromOfflineCopy(url)
      .then((saved) => saved ?? fetch(url, { signal: AbortSignal.timeout(20_000) }))
      .then((res) => {
        if (!res.ok) throw new BookLoadError(false);
        return res.json() as Promise<BookText>;
      })
      .catch((error) => {
        loaded.delete(url); // let "Try again" refetch instead of replaying the failure
        if (error instanceof BookLoadError) throw error;
        throw new BookLoadError(typeof navigator !== "undefined" && !navigator.onLine);
      });
    loaded.set(url, book);
  }
  return book;
}
