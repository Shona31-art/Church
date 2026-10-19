// For client components that call a server action directly (not via a <form>).
//
// Actions report expected problems by returning { error }, but a request that
// fails outright — offline, the app was redeployed mid-session, the server
// crashed — makes the call *throw*. Unhandled, that leaves the button stuck on
// "Saving…" with no message. callAction turns the throw into the same result
// shape the caller already handles.

export const CONNECTION_FAILED = "We couldn't reach the server. Check your internet connection and try again.";

export async function callAction<T>(run: () => Promise<T>, onFail: NoInfer<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error("[action] request failed:", error);
    return onFail;
  }
}
