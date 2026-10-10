import { renderGamePage } from "../game-page";

export default function QuizPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("quiz", searchParams);
}
