import { renderGamePage } from "../game-page";

export default function CrosswordPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("crossword", searchParams);
}
