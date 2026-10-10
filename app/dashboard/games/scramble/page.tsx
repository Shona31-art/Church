import { renderGamePage } from "../game-page";

export default function ScramblePage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("scramble", searchParams);
}
