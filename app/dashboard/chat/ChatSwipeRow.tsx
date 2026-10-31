"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { SwipeActions, type SwipeAction } from "@/components/ui/SwipeActions";
import { showToast } from "@/components/ui/Toaster";
import { hideChatForMe, setChatMute } from "./actions";

/**
 * A chat-list row with swipe-left shortcuts: mark as read, mute / unmute and,
 * for private chats, delete (for me). Private chats also get a visible delete
 * button. The chat's own ⋮ menu has the same options.
 */
export function ChatSwipeRow({
  channelId,
  unread,
  muted,
  dmName,
  children,
}: {
  channelId: string;
  unread: number;
  muted: boolean;
  /** Set for a private chat: the other person's name. Enables "Delete". */
  dmName?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [confirm, confirmDialog] = useConfirm();

  async function deleteForMe() {
    const ok = await confirm({
      title: `Delete your chat with ${dmName}?`,
      message: `It disappears from your list and your copy of the messages is cleared. ${dmName} keeps theirs. If they message you again, the chat comes back with just the new messages.`,
      confirmLabel: "Delete for me",
    });
    if (!ok) return;
    const result = await hideChatForMe(channelId);
    if (result.error) return showToast(result.error, "error");
    showToast("Chat deleted for you.", "success");
    router.refresh();
  }

  const actions: SwipeAction[] = [];
  if (unread > 0) {
    actions.push({
      label: "Read",
      icon: <CheckCheck className="h-5 w-5" />,
      onAction: async () => {
        const { error } = await supabase.rpc("mark_chat_read", { target_channel: channelId });
        if (error) showToast("Couldn't mark it read — try again.", "error");
        router.refresh();
      },
    });
  }
  actions.push({
    label: muted ? "Unmute" : "Mute",
    icon: muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />,
    tone: "gold",
    onAction: async () => {
      const result = await setChatMute(channelId, muted ? null : "8h");
      if (result.error) return showToast(result.error, "error");
      showToast(muted ? "Notifications back on." : "Muted for 8 hours.", "success");
      router.refresh();
    },
  });

  if (dmName) {
    actions.push({ label: "Delete", icon: <Trash2 className="h-5 w-5" />, onAction: deleteForMe });
  }

  return (
    <>
      <SwipeActions actions={actions}>
        {dmName ? (
          <div className="flex items-center">
            <div className="min-w-0 flex-1">{children}</div>
            <button
              type="button"
              onClick={deleteForMe}
              className="btn-ghost btn-icon mr-1 shrink-0 text-ink/50 hover:text-danger"
              aria-label={`Delete chat with ${dmName}`}
              title="Delete chat"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : (
          children
        )}
      </SwipeActions>
      {confirmDialog}
    </>
  );
}
