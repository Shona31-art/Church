"use client";

import { useEffect, useState } from "react";
import { Download, FileImage, Printer, Share2 } from "lucide-react";
import { certificateJpeg, certificatePdf } from "@/lib/certificate-export";
import { isOldAndroidApp, saveBlob } from "@/lib/save-file";
import { graceAndroid } from "@/lib/android";
import { showToast } from "@/components/ui/Toaster";

/** Download the certificate as a PDF or JPG, or share it — works in the Android app, phones and computers. */
export function CertificateActions({ svgId, fileName, title }: { svgId: string; fileName: string; title: string }) {
  const [busy, setBusy] = useState<null | "pdf" | "jpg" | "share" | "print">(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => setCanShareFiles(typeof navigator.canShare === "function"), []);

  const svg = () => document.getElementById(svgId) as SVGSVGElement | null;
  /**
   * Print: in a browser, the print window with just the certificate (landscape
   * A4). The Android app can't print a page, so it saves the PDF and opens it in
   * the phone's PDF viewer, which has Print.
   */
  async function print() {
    const el = svg();
    if (!el || busy) return;
    setBusy("print");
    try {
      await document.fonts?.ready;
      if (graceAndroid() || isOldAndroidApp()) {
        const ok = await saveBlob(await certificatePdf(el, title), `${fileName}.pdf`);
        showToast(ok ? "PDF opened — tap Print in your PDF viewer (⋮ menu)." : "Update the Grace app to print certificates, or open Grace in Chrome.", ok ? "success" : "info");
        return;
      }
      const url = URL.createObjectURL(await certificateJpeg(el));
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open();
      doc.write(`<!doctype html><html><head><title>${title.replace(/</g, "")}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${url}"></body></html>`);
      doc.close();
      const img = doc.querySelector("img")!;
      await new Promise<void>((resolve) => (img.complete ? resolve() : (img.onload = () => resolve())));
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch (error) {
      showToast((error as Error)?.message || "Couldn't open printing — download the PDF and print that instead.", "error");
    } finally {
      setBusy(null);
    }
  }

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
      <button type="button" className="btn-secondary" onClick={print} disabled={busy !== null} aria-busy={busy === "print"}>
        <Printer aria-hidden className="h-4 w-4" /> {busy === "print" ? "Preparing…" : "Print"}
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
