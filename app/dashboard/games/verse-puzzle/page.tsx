import { renderGamePage } from "../game-page";

export default function VersePuzzlePage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("verse_puzzle", searchParams);
}
