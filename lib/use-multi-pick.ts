"use client";

import { useEffect, useState } from "react";

/**
 * Can this device pick several files at once? Browsers can. Older Grace
 * Android apps only return a file when ONE is picked, so there we pick one at
 * a time; apps with the fix say so (GraceAndroid.canPickMultiple).
 */
export function useCanPickMultiple(): boolean {
  const [multi, setMulti] = useState(false);
  useEffect(() => {
    const bridge = (window as unknown as { GraceAndroid?: { canPickMultiple?: () => boolean } }).GraceAndroid;
    setMulti(!/GraceAndroid\//.test(navigator.userAgent) || typeof bridge?.canPickMultiple === "function");
  }, []);
  return multi;
}
