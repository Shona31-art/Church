"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, BellOff, Bell, EllipsisVertical, Eraser, Pin, PinOff } from "lucide-react";
import { MUTE_OPTIONS, muteLabel, type MuteOption } from "@/lib/chat";
import { showToast } from "@/components/ui/Toaster";
import { blockMember, clearMyChatHistory, setChatMute, setChatPinned, unblockMember } from "../actions";

type Confirming = "clear" | "block" | null;

/**
 * The ⋮ menu at the top of a conversation: pin, mute, clear my copy of the
 * history, and (in a DM) block/unblock. Everything here affects only me.
 */
export function ChatMenu({
  channelId,
  mutedUntil,
  pinned,
  dmWith,
}: {
  channelId: string;
  /** Null when not muted. */
  mutedUntil: string | null;
  pinned: boolean;
  /** Set in a DM: the other person, and whether I've blocked them. */
  dmWith: { id: string; name: string; blockedByMe: boolean } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    items()[0]?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(index + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (confirming) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [confirming]);

  async function run(action: () => Promise<{ error?: string }>, done: string) {
    setOpen(false);
    setConfirming(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.error) return showToast(result.error, "error");
    showToast(done);
    router.refresh();
  }

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink/5 focus-visible:bg-ink/5";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Chat options"
        className="btn-secondary btn-icon rounded-full"
      >
        <EllipsisVertical aria-hidden className="h-4 w-4" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label="Chat options" className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-pop motion-safe:animate-modal-in">
          <button type="button" role="menuitem" className={item} onClick={() => run(() => setChatPinned(channelId, !pinned), pinned ? "Chat unpinned." : "Chat pinned to the top of your list.")}>
            {pinned ? <PinOff aria-hidden className="h-4 w-4 text-ink/50" /> : <Pin aria-hidden className="h-4 w-4 text-ink/50" />}
            {pinned ? "Unpin chat" : "Pin chat"}
          </button>

          {mutedUntil ? (
            <button type="button" role="menuitem" className={item} onClick={() => run(() => setChatMute(channelId, null), "Chat unmuted.")}>
              <Bell aria-hidden className="h-4 w-4 text-ink/50" />
              <span>
                Unmute <span className="block text-xs text-ink/50">{muteLabel(mutedUntil)}</span>
              </span>
            </button>
          ) : (
            <div role="group" aria-label="Mute" className="border-y border-line py-1">
              <p className="flex items-center gap-2.5 px-3 py-1 text-xs font-semibold text-ink/50">
                <BellOff aria-hidden className="h-3.5 w-3.5" /> Mute (hides unread counts)
              </p>
              {MUTE_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="menuitem" className={`${item} pl-9`} onClick={() => run(() => setChatMute(channelId, o.value as MuteOption), "Chat muted.")}>
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <button type="button" role="menuitem" className={item} onClick={() => (setOpen(false), setConfirming("clear"))}>
            <Eraser aria-hidden className="h-4 w-4 text-ink/50" /> Clear my chat history
          </button>

          {dmWith &&
            (dmWith.blockedByMe ? (
              <button type="button" role="menuitem" className={item} onClick={() => run(() => unblockMember(dmWith.id), `${dmWith.name} is unblocked.`)}>
                <Ban aria-hidden className="h-4 w-4 text-ink/50" /> Unblock {dmWith.name}
              </button>
            ) : (
              <button type="button" role="menuitem" className={`${item} text-danger`} onClick={() => (setOpen(false), setConfirming("block"))}>
                <Ban aria-hidden className="h-4 w-4" /> Block {dmWith.name}
              </button>
            ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setConfirming(null)}
        aria-labelledby="chat-confirm-title"
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 shadow-pop backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <h2 id="chat-confirm-title" className="text-xl font-semibold">
            {confirming === "block" ? `Block ${dmWith?.name}?` : "Clear your chat history?"}
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            {confirming === "block"
              ? "Neither of you will be able to send messages in this chat, and they can't start a new one with you. They won't be told. You can unblock them any time."
              : "Messages sent before now will disappear from your view of this chat. Nobody else's copy changes, and this can't be undone."}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus className="btn-secondary" onClick={() => setConfirming(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() =>
                confirming === "block" && dmWith
                  ? run(() => blockMember(dmWith.id), `${dmWith.name} is blocked.`)
                  : run(() => clearMyChatHistory(channelId), "Chat history cleared for you.")
              }
            >
              {confirming === "block" ? "Block" : "Clear history"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
