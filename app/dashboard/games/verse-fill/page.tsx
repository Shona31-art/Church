import { renderGamePage } from "../game-page";

export default function VerseFillPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("verse_fill", searchParams);
}
