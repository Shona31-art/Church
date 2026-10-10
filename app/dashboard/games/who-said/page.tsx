import { renderGamePage } from "../game-page";

export default function WhoSaidPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("who_said", searchParams);
}
