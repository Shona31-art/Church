import { bookFileUrl, type BookText } from "./books";

// Browser-side loader for the static text files in public/bibles/.
// Keeps each book in memory for the visit, so moving between chapters of the
// same book never refetches. (Offline copies are the service worker's job.)

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
    book = fetch(url, { signal: AbortSignal.timeout(20_000) })
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
