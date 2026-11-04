import { CERTIFICATE_INFO, certificateLine, certificateNumber, type CertificateKind } from "@/lib/certificates";

/** A certificate, A4 landscape proportions; the page prints only this (#certificate). */
export function CertificateView({
  kind,
  recipient,
  churchName,
  logoUrl,
  date,
  place,
  courseName,
  parents,
  officiant,
  scripture,
  number,
}: {
  kind: CertificateKind;
  recipient: string;
  churchName: string;
  logoUrl: string | null;
  date: string;
  place?: string | null;
  courseName?: string | null;
  parents?: string | null;
  officiant?: string | null;
  scripture?: string | null;
  number: number | string;
}) {
  const info = CERTIFICATE_INFO[kind];
  return (
        <div className="overflow-x-auto pb-2">
          <article
            id="certificate"
            className="relative mx-auto flex aspect-[297/210] w-[900px] max-w-none flex-col items-center justify-between overflow-hidden rounded-md bg-[#fffdf7] p-[42px] text-center text-[#2b2116] shadow-lg"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-[14px] rounded border-[3px] border-[#b8903c]" />
            <div aria-hidden className="pointer-events-none absolute inset-[22px] rounded border border-[#b8903c]/70" />
            <header className="relative flex flex-col items-center gap-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-20 w-20 object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brand/grace-logo.png" alt="" className="h-14 w-14 object-contain opacity-80" />
              )}
              <p className="text-lg font-semibold uppercase tracking-[0.25em] text-[#6b5530]">{churchName}</p>
            </header>
            <div className="relative flex flex-col items-center">
              <h1 className="text-[52px] font-semibold leading-none text-[#8a6a28]">{info.heading}</h1>
              <p className="mt-5 text-lg italic">This is to certify that</p>
              <p className="mt-2 border-b border-[#b8903c] px-10 pb-1 font-script text-[56px] leading-tight text-[#2b2116]">{recipient}</p>
              <p className="mt-4 max-w-[640px] text-xl">{certificateLine({ kind, recipient, church: churchName, courseName, parents })}</p>
              <p className="mt-1 text-xl">
                on {date}
                {place ? ` at ${place}` : ""}.
              </p>
              <p className="mt-5 max-w-[620px] text-sm italic text-[#5c4a2e]">{scripture || info.scripture}</p>
            </div>
            <footer className="relative flex w-full items-end justify-between px-10 text-sm">
              <div className="w-56 text-center">
                <div className="h-10" />
                <div className="border-t border-[#2b2116]/60 pt-1">{officiant ?? "Pastor"}</div>
              </div>
              <div className="text-xs tracking-widest text-[#6b5530]">{certificateNumber(number)}</div>
              <div className="w-56 text-center">
                <div className="h-10 pt-4 text-base">{date}</div>
                <div className="border-t border-[#2b2116]/60 pt-1">Date</div>
              </div>
            </footer>
          </article>
        </div>
  );
}
