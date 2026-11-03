"use client";

import { useEffect } from "react";
import { registerAndroidPhone } from "@/lib/android";

/**
 * Inside Grace's Android app: registers this phone for calls and pop-ups
 * (again whenever the app gets a new push address). Renders nothing.
 */
export function AndroidBridge({ userId }: { userId: string }) {
  useEffect(() => {
    const register = () => void registerAndroidPhone(userId);
    register();
    window.addEventListener("grace-android-token", register);
    window.addEventListener("grace-android-resume", register);
    return () => {
      window.removeEventListener("grace-android-token", register);
      window.removeEventListener("grace-android-resume", register);
    };
  }, [userId]);
  return null;
}
