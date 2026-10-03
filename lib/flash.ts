import "server-only";
import { cookies } from "next/headers";

/**
 * Queue a toast for the next screen the user sees. Call from a server action
 * (before redirect() or revalidatePath()); components/ui/Toaster.tsx shows it.
 * Readable by JavaScript on purpose — it only ever holds the message text.
 */
export function flash(message: string, tone: "success" | "error" | "info" = "success") {
  cookies().set("flash", encodeURIComponent(JSON.stringify({ m: message, t: tone })), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false,
  });
}
