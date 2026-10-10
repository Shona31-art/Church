import { renderGamePage } from "../game-page";

export default function EmojiPage({ searchParams }: { searchParams: { level?: string; mode?: string } }) {
  return renderGamePage("emoji", searchParams);
}
