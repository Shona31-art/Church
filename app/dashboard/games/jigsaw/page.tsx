import { renderGamePage } from "../game-page";

export default function JigsawPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("jigsaw", searchParams);
}
