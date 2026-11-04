"use client";

import { useEffect, useState } from "react";
import { Download, FileImage, Share2 } from "lucide-react";
import { certificateJpeg, certificatePdf } from "@/lib/certificate-export";
import { isOldAndroidApp, saveBlob } from "@/lib/save-file";
import { showToast } from "@/components/ui/Toaster";

/** Download the certificate as a PDF or JPG, or share it — works in the Android app, phones and computers. */
export function CertificateActions({ svgId, fileName, title }: { svgId: string; fileName: string; title: string }) {
  const [busy, setBusy] = useState<null | "pdf" | "jpg" | "share">(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => setCanShareFiles(typeof navigator.canShare === "function"), []);

  const svg = () => document.getElementById(svgId) as SVGSVGElement | null;
  async function run(kind: "pdf" | "jpg" | "share") {
    const el = svg();
    if (!el || busy) return;
    setBusy(kind);
    try {
      await document.fonts?.ready;
      if (kind === "share") {
        const file = new File([await certificatePdf(el, title)], `${fileName}.pdf`, { type: "application/pdf" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
        else if (!(await saveBlob(file, file.name))) showToast("Update the Grace app to save certificates, or open Grace in Chrome.", "info");
      } else {
        const blob = kind === "pdf" ? await certificatePdf(el, title) : await certificateJpeg(el);
        const ok = await saveBlob(blob, `${fileName}.${kind}`);
        if (!ok) showToast(isOldAndroidApp() ? "Update the Grace app to save certificates (Account → Install the app), or open Grace in Chrome." : "Couldn't save the file.", "info");
        else showToast(kind === "pdf" ? "PDF saved — open it to print." : "Picture saved.", "success");
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") showToast((error as Error)?.message || "Couldn't make the file — please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary" onClick={() => run("pdf")} disabled={busy !== null} aria-busy={busy === "pdf"}>
        <Download aria-hidden className="h-4 w-4" /> {busy === "pdf" ? "Making PDF…" : "Download PDF"}
      </button>
      <button type="button" className="btn-secondary" onClick={() => run("jpg")} disabled={busy !== null} aria-busy={busy === "jpg"}>
        <FileImage aria-hidden className="h-4 w-4" /> {busy === "jpg" ? "Saving…" : "Save as picture"}
      </button>
      {canShareFiles && (
        <button type="button" className="btn-secondary" onClick={() => run("share")} disabled={busy !== null} aria-busy={busy === "share"}>
          <Share2 aria-hidden className="h-4 w-4" /> {busy === "share" ? "Preparing…" : "Share"}
        </button>
      )}
    </div>
  );
}
