import { renderGamePage } from "../game-page";

export default function MazePage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("maze", searchParams);
}
