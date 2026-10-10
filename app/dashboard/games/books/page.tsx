import { renderGamePage } from "../game-page";

export default function BooksPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("books_order", searchParams);
}
