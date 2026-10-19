"use client";

import dynamic from "next/dynamic";
import { EditorSkeleton } from "./EditorSkeleton";

// Konva draws on a <canvas>, which only exists in the browser, so the editor
// is loaded client-side only. This also keeps the canvas library (~150 KB)
// off every page except the editor.
export const EditorLoader = dynamic(() => import("./Editor").then((m) => m.Editor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
