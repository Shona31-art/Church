import { renderGamePage } from "../game-page";

export default function WordSearchPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("word_search", searchParams);
}
