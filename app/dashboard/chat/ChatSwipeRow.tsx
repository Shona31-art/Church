"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SwipeActions, type SwipeAction } from "@/components/ui/SwipeActions";
import { showToast } from "@/components/ui/Toaster";
import { setChatMute } from "./actions";

/** A chat-list row with swipe-left shortcuts: mark as read, mute / unmute. The chat's own menu has the same options. */
export function ChatSwipeRow({ channelId, unread, muted, children }: { channelId: string; unread: number; muted: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

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

  return <SwipeActions actions={actions}>{children}</SwipeActions>;
}
