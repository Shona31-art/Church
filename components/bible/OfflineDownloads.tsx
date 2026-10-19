"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, Download } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { VERSIONS } from "@/lib/bible/versions";
import { downloadStatus, downloadVersion, offlineSupported, removeVersion, type DownloadStatus } from "@/lib/bible/offline";

type Row = { status: DownloadStatus | null; downloading: boolean; failed: boolean; confirmRemove: boolean };

/**
 * "Offline reading": download a whole version to this device, see progress,
 * remove it again. Each version is about 1.3 MB to download.
 */
export function OfflineDownloads() {
  const [supported, setSupported] = useState(true);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(VERSIONS.map((v) => [v.id, { status: null, downloading: false, failed: false, confirmRemove: false }])),
  );
  const [iosTip, setIosTip] = useState(false);
  const aborts = useRef<Record<string, AbortController>>({});

  const update = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  useEffect(() => {
    if (!offlineSupported()) return setSupported(false);
    VERSIONS.forEach((v) => downloadStatus(v.id).then((status) => update(v.id, { status })));
    // iPhone/iPad Safari clears website storage after weeks unused unless the app is on the Home Screen.
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setIosTip(ios && !standalone);
    const pending = aborts.current;
    return () => Object.values(pending).forEach((a) => a.abort());
  }, []);

  async function download(id: string, name: string) {
    const controller = new AbortController();
    aborts.current[id] = controller;
    update(id, { downloading: true, failed: false });
    try {
      await downloadVersion(id, (status) => update(id, { status }), controller.signal);
      showToast(`${name} is available offline.`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") update(id, { failed: true });
    } finally {
      delete aborts.current[id];
      update(id, { downloading: false, status: await downloadStatus(id) });
    }
  }

  async function remove(id: string, name: string) {
    try {
      await removeVersion(id);
      showToast(`${name} removed from this device.`);
    } catch {
      showToast("Couldn't remove it. Try again.", "error");
    }
    update(id, { confirmRemove: false, status: await downloadStatus(id) });
  }

  return (
    <section aria-labelledby="offline-title" className="card-elevated rounded-2xl p-5 sm:p-6">
      <h2 id="offline-title" className="text-xl font-semibold">
        Offline reading
      </h2>
      <p className="mt-1 text-sm text-ink/60">Download a version to read and search it with no internet connection, on this device.</p>

      {!supported ? (
        <p className="mt-4 text-sm text-ink/60">This browser can&apos;t save the Bible for offline use. Try an up-to-date Chrome, Edge, Safari or Firefox.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {VERSIONS.map((v) => {
            const row = rows[v.id];
            const saved = row.status?.saved ?? 0;
            const total = row.status?.total ?? 66;
            const complete = saved >= total;
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {v.name} <span className="font-normal text-ink/60">({v.abbreviation})</span>
                  </p>
                  {row.downloading ? (
                    <div className="mt-1.5 w-48 max-w-full">
                      <div
                        role="progressbar"
                        aria-label={`Downloading ${v.abbreviation}`}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={saved}
                        className="h-1.5 overflow-hidden rounded-full bg-ink/10"
                      >
                        <div className="h-full rounded-full bg-ember transition-[width]" style={{ width: `${(saved / total) * 100}%` }} />
                      </div>
                      <p className="tabular mt-1 text-xs text-ink/60">
                        {saved} of {total} books
                      </p>
                    </div>
                  ) : complete ? (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-success">
                      <CircleCheck aria-hidden className="h-4 w-4" /> Available offline
                    </p>
                  ) : row.failed ? (
                    <p className="mt-0.5 text-sm text-danger" role="alert">
                      Download stopped at {saved} of {total} books. Check your connection and try again.
                    </p>
                  ) : (
                    <p className="tabular mt-0.5 text-sm text-ink/60">
                      {saved > 0 ? `${saved} of ${total} books saved · ` : ""}
                      {(v.downloadBytes / 1_000_000).toFixed(1)} MB
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {row.downloading ? (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => aborts.current[v.id]?.abort()}>
                      Cancel
                    </button>
                  ) : complete ? (
                    row.confirmRemove ? (
                      <div className="flex items-center gap-2" role="group" aria-label={`Remove ${v.abbreviation}?`}>
                        <span className="text-sm text-ink/70">Remove?</span>
                        <button type="button" className="btn-danger btn-sm" onClick={() => remove(v.id, v.name)}>
                          Remove
                        </button>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => update(v.id, { confirmRemove: false })}>
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn-ghost btn-sm" onClick={() => update(v.id, { confirmRemove: true })}>
                        Remove
                      </button>
                    )
                  ) : (
                    <button type="button" className="btn-secondary btn-sm" onClick={() => download(v.id, v.name)} disabled={row.status === null}>
                      <Download aria-hidden className="h-4 w-4" />
                      {row.failed ? "Try again" : saved > 0 ? "Finish download" : "Download"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {iosTip && (
        <p className="mt-4 rounded-xl bg-info-tint px-3 py-2 text-sm text-info">
          On iPhone, tap Share then <strong>Add to Home Screen</strong>, and open the app from there. Otherwise iOS may clear downloads you
          haven&apos;t used for a few weeks.
        </p>
      )}
    </section>
  );
}
