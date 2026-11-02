import { renderGamePage } from "../game-page";

export default function SpotTheDifferencePage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("differences", searchParams);
}
