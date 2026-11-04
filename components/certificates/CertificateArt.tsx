import {
  CERTIFICATE_COLOURS,
  CERTIFICATE_INFO,
  certificateHeading,
  certificateLine,
  certificateNumber,
  wrapText,
  type CertificateColourKey,
  type CertificateDesign,
  type CertificateKind,
} from "@/lib/certificates";

// A certificate drawn as one SVG (A4 landscape, 1123 × 794): the same picture
// on screen, in the form's preview, and in the PDF/JPG download
// (lib/certificate-export.ts turns this SVG into an image). Fonts are the
// app's own poster fonts (/fonts/poster), so nothing is fetched from outside.

export const CERT_W = 1123;
export const CERT_H = 794;

/** Fonts used, by family name → file. The export inlines these. */
export const CERT_FONTS: Record<string, string> = {
  "Cert Cinzel": "/fonts/poster/cinzel.woff2",
  "Cert Script": "/fonts/poster/great-vibes.woff2",
  "Cert Serif": "/fonts/poster/cormorant-garamond.woff2",
  "Cert Sans": "/fonts/poster/montserrat.woff2",
  "Cert Display": "/fonts/poster/playfair-display.woff2",
  "Cert Lora": "/fonts/poster/lora.woff2",
};

export interface CertificateArtProps {
  kind: CertificateKind;
  design: CertificateDesign;
  colour: CertificateColourKey;
  recipient: string;
  churchName: string;
  logoUrl: string | null;
  date: string;
  place?: string | null;
  courseName?: string | null;
  parents?: string | null;
  customTitle?: string | null;
  customLine?: string | null;
  officiant?: string | null;
  scripture?: string | null;
  number?: number | string | null;
  className?: string;
  id?: string;
}

const fontFaces = Object.entries(CERT_FONTS)
  .map(([family, url]) => `@font-face{font-family:"${family}";src:url("${url}") format("woff2");font-display:block;}`)
  .join("");

/** A small cross, centred on (x, y). */
function Cross({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  const w = size * 0.22;
  return (
    <g fill={fill}>
      <rect x={x - w / 2} y={y - size / 2} width={w} height={size} rx={w / 4} />
      <rect x={x - size * 0.36} y={y - size * 0.2} width={size * 0.72} height={w} rx={w / 4} />
    </g>
  );
}

/** The round seal: the church logo (or a cross) inside rings. */
function Seal({ x, y, r, ring, inner, logoUrl, clipId }: { x: number; y: number; r: number; ring: string; inner: string; logoUrl: string | null; clipId: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={inner} stroke={ring} strokeWidth={3} />
      <circle cx={x} cy={y} r={r - 7} fill="none" stroke={ring} strokeWidth={1} strokeDasharray="2 4" />
      {logoUrl ? (
        <>
          <clipPath id={clipId}>
            <circle cx={x} cy={y} r={r - 12} />
          </clipPath>
          <image href={logoUrl} x={x - (r - 12)} y={y - (r - 12)} width={(r - 12) * 2} height={(r - 12) * 2} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${clipId})`} />
        </>
      ) : (
        <Cross x={x} y={y} size={r} fill={ring} />
      )}
    </g>
  );
}

/** A centred block of lines starting at y; returns the y after it. */
function Lines({ lines, x, y, gap, ...text }: { lines: string[]; x: number; y: number; gap: number } & React.SVGProps<SVGTextElement>) {
  return (
    <text x={x} y={y} textAnchor="middle" {...text}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : gap}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function CertificateArt(p: CertificateArtProps) {
  const c = CERTIFICATE_COLOURS[p.colour] ?? CERTIFICATE_COLOURS.gold;
  const heading = certificateHeading({ kind: p.kind, customTitle: p.customTitle });
  const line = certificateLine({ kind: p.kind, recipient: p.recipient, church: p.churchName, courseName: p.courseName, parents: p.parents, customTitle: p.customTitle, customLine: p.customLine });
  const when = `on ${p.date}${p.place ? ` at ${p.place}` : ""}`;
  const verse = (p.scripture?.trim() || CERTIFICATE_INFO[p.kind].scripture) ?? "";
  const name = p.recipient.trim() || "Full name";
  const nameSize = name.length > 26 ? 58 : name.length > 18 ? 70 : 82;
  const uid = (p.id ?? "cert").replace(/[^a-z0-9]/gi, "");
  const svgProps = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${CERT_W} ${CERT_H}`,
    width: "100%",
    role: "img",
    "aria-label": `${heading.top} ${heading.main} — ${name}`,
    className: p.className,
    id: p.id,
    style: { display: "block", height: "auto" },
  } as const;
  const signature = (x: number, label: string, value: string | null | undefined, ink: string, rule: string, font = "Cert Serif") => (
    <g>
      <text x={x} y={CERT_H - 122} textAnchor="middle" fontFamily={font} fontSize={20} fill={ink}>
        {value ?? ""}
      </text>
      <line x1={x - 130} x2={x + 130} y1={CERT_H - 110} y2={CERT_H - 110} stroke={rule} strokeWidth={1.2} />
      <text x={x} y={CERT_H - 88} textAnchor="middle" fontFamily={font} fontSize={15} letterSpacing={2} fill={ink} opacity={0.75}>
        {label}
      </text>
    </g>
  );

  if (p.design === "modern") {
    const band = 300;
    const cx = band + (CERT_W - band) / 2;
    return (
      <svg {...svgProps}>
        <defs>
          <style>{fontFaces}</style>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.main} />
            <stop offset="1" stopColor={c.deep} />
          </linearGradient>
          <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={c.foil[0]} />
            <stop offset="0.5" stopColor={c.foil[1]} />
            <stop offset="1" stopColor={c.foil[2]} />
          </linearGradient>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill="#ffffff" />
        <rect width={band} height={CERT_H} fill={`url(#${uid}-band)`} />
        <polygon points={`${band},0 ${band + 90},0 ${band},${CERT_H * 0.42}`} fill={c.main} opacity={0.18} />
        <polygon points={`${CERT_W},${CERT_H} ${CERT_W - 260},${CERT_H} ${CERT_W},${CERT_H - 170}`} fill={c.main} opacity={0.12} />
        <polygon points={`${CERT_W},${CERT_H} ${CERT_W - 140},${CERT_H} ${CERT_W},${CERT_H - 90}`} fill={c.main} opacity={0.25} />
        <rect x={band} y={0} width={8} height={CERT_H} fill={`url(#${uid}-foil)`} />
        <Seal x={band / 2} y={190} r={78} ring="#ffffff" inner="rgba(255,255,255,0.12)" logoUrl={p.logoUrl} clipId={`${uid}-seal`} />
        <Lines lines={wrapText(p.churchName.toUpperCase(), 17)} x={band / 2} y={320} gap={26} fontFamily="Cert Sans" fontWeight={700} fontSize={16} letterSpacing={2} fill="#ffffff" />
        <text x={band / 2} y={CERT_H - 60} textAnchor="middle" fontFamily="Cert Sans" fontSize={14} letterSpacing={3} fill="#ffffff" opacity={0.8}>
          {p.number != null ? certificateNumber(p.number).toUpperCase() : ""}
        </text>

        {heading.top && (
          <text x={cx} y={150} textAnchor="middle" fontFamily="Cert Sans" fontWeight={600} fontSize={22} letterSpacing={10} fill={c.main}>
            {heading.top.toUpperCase()}
          </text>
        )}
        <Lines lines={wrapText(heading.main.toUpperCase(), 24)} x={cx} y={heading.top ? 212 : 180} gap={56} fontFamily="Cert Sans" fontWeight={800} fontSize={50} letterSpacing={4} fill={c.deep} />
        <rect x={cx - 60} y={heading.main.length > 24 ? 290 : 240} width={120} height={5} rx={2.5} fill={`url(#${uid}-foil)`} />
        <text x={cx} y={heading.main.length > 24 ? 340 : 296} textAnchor="middle" fontFamily="Cert Sans" fontSize={19} letterSpacing={2} fill="#555">
          THIS IS PROUDLY PRESENTED TO
        </text>
        <text x={cx} y={heading.main.length > 24 ? 420 : 386} textAnchor="middle" fontFamily="Cert Script" fontSize={nameSize} fill={c.deep}>
          {name}
        </text>
        <Lines lines={wrapText(line, 58)} x={cx} y={heading.main.length > 24 ? 470 : 446} gap={30} fontFamily="Cert Lora" fontSize={21} fill="#333" />
        <text x={cx} y={heading.main.length > 24 ? 470 + wrapText(line, 58).length * 30 : 446 + wrapText(line, 58).length * 30} textAnchor="middle" fontFamily="Cert Lora" fontSize={21} fill="#333">
          {when}
        </text>
        <Lines lines={wrapText(verse, 80)} x={cx} y={CERT_H - 190} gap={20} fontFamily="Cert Lora" fontStyle="italic" fontSize={14} fill="#666" />
        {signature(band + 190, "SIGNED", p.officiant ?? "", "#333", c.main, "Cert Sans")}
        {signature(CERT_W - 190, "DATE", p.date, "#333", c.main, "Cert Sans")}
      </svg>
    );
  }

  if (p.design === "original") {
    // The first Grace certificate: cream paper, double border, big logo, one-line heading.
    const cx = CERT_W / 2;
    const ink = "#2b2116";
    const full = [heading.top, heading.main].filter(Boolean).join(" ");
    const lineLines = wrapText(line, 66);
    return (
      <svg {...svgProps}>
        <defs>
          <style>{fontFaces}</style>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill="#fffdf7" />
        <rect x={14} y={14} width={CERT_W - 28} height={CERT_H - 28} rx={4} fill="none" stroke={c.main} strokeWidth={3} />
        <rect x={22} y={22} width={CERT_W - 44} height={CERT_H - 44} rx={4} fill="none" stroke={c.main} strokeOpacity={0.7} strokeWidth={1} />
        {p.logoUrl ? (
          <image href={p.logoUrl} x={cx - 50} y={44} width={100} height={100} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <Cross x={cx} y={94} size={60} fill={c.main} />
        )}
        <text x={cx} y={178} textAnchor="middle" fontFamily="Cert Serif" fontWeight={600} fontSize={p.churchName.length > 40 ? 17 : 20} letterSpacing={5} fill={c.deep}>
          {p.churchName.toUpperCase()}
        </text>
        <text x={cx} y={268} textAnchor="middle" fontFamily="Cert Serif" fontWeight={600} fontSize={full.length > 28 ? 46 : 56} fill={c.main}>
          {full}
        </text>
        <text x={cx} y={326} textAnchor="middle" fontFamily="Cert Serif" fontStyle="italic" fontSize={22} fill={ink}>
          This is to certify that
        </text>
        <text x={cx} y={404} textAnchor="middle" fontFamily="Cert Script" fontSize={Math.min(nameSize, 72)} fill={ink}>
          {name}
        </text>
        <line x1={cx - 230} x2={cx + 230} y1={424} y2={424} stroke={c.main} strokeWidth={1.3} />
        <Lines lines={lineLines} x={cx} y={466} gap={30} fontFamily="Cert Serif" fontSize={24} fill={ink} />
        <text x={cx} y={466 + lineLines.length * 30} textAnchor="middle" fontFamily="Cert Serif" fontSize={24} fill={ink}>
          {when}.
        </text>
        <Lines lines={wrapText(verse, 96)} x={cx} y={CERT_H - 196} gap={19} fontFamily="Cert Serif" fontStyle="italic" fontSize={15} fill="#5c4a2e" />
        {signature(230, "", p.officiant ?? "Pastor", ink, ink)}
        {signature(CERT_W - 230, "Date", p.date, ink, ink)}
        <text x={cx} y={CERT_H - 92} textAnchor="middle" fontFamily="Cert Serif" fontSize={14} letterSpacing={3} fill={c.deep}>
          {p.number != null ? certificateNumber(p.number) : ""}
        </text>
      </svg>
    );
  }

  if (p.design === "banner") {
    const cx = CERT_W / 2;
    const top = 210;
    const lineLines = wrapText(line, 62);
    return (
      <svg {...svgProps}>
        <defs>
          <style>{fontFaces}</style>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={c.deep} />
            <stop offset="1" stopColor={c.main} />
          </linearGradient>
          <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={c.foil[0]} />
            <stop offset="0.5" stopColor={c.foil[1]} />
            <stop offset="1" stopColor={c.foil[2]} />
          </linearGradient>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill="#ffffff" />
        <polygon points={`0,0 ${CERT_W},0 ${CERT_W},${top - 40} 0,${top}`} fill={`url(#${uid}-band)`} />
        <polygon points={`0,${top} ${CERT_W},${top - 40} ${CERT_W},${top - 30} 0,${top + 10}`} fill={`url(#${uid}-foil)`} />
        <polygon points={`${CERT_W - 360},0 ${CERT_W},0 ${CERT_W},${top - 40} ${CERT_W - 180},${top - 60}`} fill="#ffffff" opacity={0.07} />
        <Seal x={110} y={112} r={62} ring="#ffffff" inner="rgba(255,255,255,0.12)" logoUrl={p.logoUrl} clipId={`${uid}-seal`} />
        <Lines lines={wrapText(p.churchName.toUpperCase(), 34)} x={196} y={102} gap={28} textAnchor="start" fontFamily="Cert Sans" fontWeight={700} fontSize={22} letterSpacing={3} fill="#ffffff" />
        {heading.top && (
          <text x={cx} y={top + 62} textAnchor="middle" fontFamily="Cert Sans" fontWeight={600} fontSize={20} letterSpacing={10} fill={c.main}>
            {heading.top.toUpperCase()}
          </text>
        )}
        <text x={cx} y={top + (heading.top ? 114 : 92)} textAnchor="middle" fontFamily="Cert Sans" fontWeight={800} fontSize={heading.main.length > 24 ? 38 : 48} letterSpacing={4} fill={c.deep}>
          {heading.main.toUpperCase()}
        </text>
        <text x={cx} y={top + 158} textAnchor="middle" fontFamily="Cert Sans" fontSize={17} letterSpacing={3} fill="#666">
          THIS IS PROUDLY PRESENTED TO
        </text>
        <text x={cx} y={top + 236} textAnchor="middle" fontFamily="Cert Script" fontSize={nameSize} fill={c.deep}>
          {name}
        </text>
        <rect x={cx - 220} y={top + 256} width={440} height={2} fill={`url(#${uid}-foil)`} />
        <Lines lines={lineLines} x={cx} y={top + 294} gap={28} fontFamily="Cert Lora" fontSize={20} fill="#333" />
        <text x={cx} y={top + 294 + lineLines.length * 28} textAnchor="middle" fontFamily="Cert Lora" fontSize={20} fill="#333">
          {when}
        </text>
        <Lines lines={wrapText(verse, 96)} x={cx} y={CERT_H - 176} gap={18} fontFamily="Cert Lora" fontStyle="italic" fontSize={13} fill="#777" />
        {signature(240, "SIGNED", p.officiant ?? "", "#333", c.main, "Cert Sans")}
        {signature(CERT_W - 240, "DATE", p.date, "#333", c.main, "Cert Sans")}
        <rect x={0} y={CERT_H - 14} width={CERT_W} height={14} fill={`url(#${uid}-band)`} />
        <text x={cx} y={CERT_H - 30} textAnchor="middle" fontFamily="Cert Sans" fontSize={12} letterSpacing={3} fill="#999">
          {p.number != null ? certificateNumber(p.number).toUpperCase() : ""}
        </text>
      </svg>
    );
  }

  if (p.design === "ribbon") {
    const cx = CERT_W / 2;
    const lineLines = wrapText(line, 64);
    return (
      <svg {...svgProps}>
        <defs>
          <style>{fontFaces}</style>
          <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.main} />
            <stop offset="1" stopColor={c.deep} />
          </linearGradient>
          <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.foil[0]} />
            <stop offset="0.5" stopColor={c.foil[1]} />
            <stop offset="1" stopColor={c.foil[2]} />
          </linearGradient>
        </defs>
        <rect width={CERT_W} height={CERT_H} fill="#ffffff" />
        {/* Angled corners */}
        <polygon points={`0,0 300,0 0,230`} fill={`url(#${uid}-band)`} />
        <polygon points={`300,0 340,0 0,262 0,230`} fill={`url(#${uid}-foil)`} />
        <polygon points={`0,0 170,0 0,130`} fill="#ffffff" opacity={0.1} />
        <polygon points={`${CERT_W},${CERT_H} ${CERT_W - 300},${CERT_H} ${CERT_W},${CERT_H - 230}`} fill={`url(#${uid}-band)`} />
        <polygon points={`${CERT_W - 300},${CERT_H} ${CERT_W - 340},${CERT_H} ${CERT_W},${CERT_H - 262} ${CERT_W},${CERT_H - 230}`} fill={`url(#${uid}-foil)`} />
        <rect x={24} y={24} width={CERT_W - 48} height={CERT_H - 48} fill="none" stroke={c.main} strokeOpacity={0.25} strokeWidth={1.5} />
        {/* Rosette with ribbon tails */}
        <g>
          <polygon points={`${CERT_W - 150},150 ${CERT_W - 178},250 ${CERT_W - 160},238 ${CERT_W - 146},258`} fill={c.deep} />
          <polygon points={`${CERT_W - 122},150 ${CERT_W - 94},250 ${CERT_W - 112},238 ${CERT_W - 126},258`} fill={c.main} />
          <circle cx={CERT_W - 136} cy={128} r={66} fill={`url(#${uid}-foil)`} />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <circle key={i} cx={CERT_W - 136 + Math.cos(a) * 66} cy={128 + Math.sin(a) * 66} r={7} fill={`url(#${uid}-foil)`} />;
          })}
          <Seal x={CERT_W - 136} y={128} r={52} ring="#ffffff" inner={c.deep} logoUrl={p.logoUrl} clipId={`${uid}-seal`} />
        </g>
        <Lines lines={wrapText(p.churchName.toUpperCase(), 40)} x={cx - 40} y={p.churchName.length > 40 ? 92 : 108} gap={24} fontFamily="Cert Sans" fontWeight={700} fontSize={16} letterSpacing={4} fill={c.deep} />
        {heading.top && (
          <text x={cx} y={196} textAnchor="middle" fontFamily="Cert Sans" fontWeight={800} fontSize={58} letterSpacing={8} fill={c.deep}>
            {heading.top.toUpperCase()}
          </text>
        )}
        <text x={cx} y={heading.top ? 244 : 210} textAnchor="middle" fontFamily="Cert Sans" fontWeight={600} fontSize={heading.main.length > 26 ? 24 : 28} letterSpacing={6} fill={c.main}>
          {heading.main.toUpperCase()}
        </text>
        <text x={cx} y={312} textAnchor="middle" fontFamily="Cert Sans" fontSize={17} letterSpacing={3} fill="#666">
          THIS IS PROUDLY PRESENTED TO
        </text>
        <text x={cx} y={398} textAnchor="middle" fontFamily="Cert Script" fontSize={nameSize} fill={c.deep}>
          {name}
        </text>
        <rect x={cx - 240} y={420} width={480} height={2} fill={`url(#${uid}-foil)`} />
        <Lines lines={lineLines} x={cx} y={462} gap={28} fontFamily="Cert Lora" fontSize={20} fill="#333" />
        <text x={cx} y={462 + lineLines.length * 28} textAnchor="middle" fontFamily="Cert Lora" fontSize={20} fill="#333">
          {when}
        </text>
        <Lines lines={wrapText(verse, 92)} x={cx} y={CERT_H - 168} gap={18} fontFamily="Cert Lora" fontStyle="italic" fontSize={13} fill="#777" />
        {signature(300, "SIGNED", p.officiant ?? "", "#333", c.main, "Cert Sans")}
        {signature(CERT_W - 380, "DATE", p.date, "#333", c.main, "Cert Sans")}
        <text x={70} y={CERT_H - 52} fontFamily="Cert Sans" fontSize={12} letterSpacing={3} fill={c.deep}>
          {p.number != null ? certificateNumber(p.number).toUpperCase() : ""}
        </text>
      </svg>
    );
  }

  // Classic: warm paper, double border, corner flourishes, seal.
  const cx = CERT_W / 2;
  const corner = (x: number, y: number, sx: number, sy: number, key: string) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke={c.main} strokeWidth={2}>
      <path d="M0 70 C0 30 30 0 70 0" />
      <path d="M12 70 C12 38 38 12 70 12" strokeWidth={1} />
      <circle cx={18} cy={18} r={6} fill={c.main} />
    </g>
  );
  return (
    <svg {...svgProps}>
      <defs>
        <style>{fontFaces}</style>
        <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c.foil[0]} />
          <stop offset="0.5" stopColor={c.foil[1]} />
          <stop offset="1" stopColor={c.foil[2]} />
        </linearGradient>
        <radialGradient id={`${uid}-paper`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={c.pale} />
        </radialGradient>
      </defs>
      <rect width={CERT_W} height={CERT_H} fill={`url(#${uid}-paper)`} />
      <rect x={18} y={18} width={CERT_W - 36} height={CERT_H - 36} fill="none" stroke={`url(#${uid}-foil)`} strokeWidth={6} />
      <rect x={32} y={32} width={CERT_W - 64} height={CERT_H - 64} fill="none" stroke={c.main} strokeWidth={1.2} />
      {corner(44, 44, 1, 1, "tl")}
      {corner(CERT_W - 44, 44, -1, 1, "tr")}
      {corner(44, CERT_H - 44, 1, -1, "bl")}
      {corner(CERT_W - 44, CERT_H - 44, -1, -1, "br")}
      {p.logoUrl ? (
        <image href={p.logoUrl} x={cx - 40} y={58} width={80} height={80} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <Cross x={cx} y={98} size={56} fill={c.main} />
      )}
      <text x={cx} y={168} textAnchor="middle" fontFamily="Cert Cinzel" fontWeight={600} fontSize={20} letterSpacing={5} fill={c.deep}>
        {p.churchName.toUpperCase()}
      </text>
      {heading.top && (
        <text x={cx} y={238} textAnchor="middle" fontFamily="Cert Cinzel" fontWeight={700} fontSize={46} letterSpacing={8} fill={`url(#${uid}-foil)`}>
          {heading.top.toUpperCase()}
        </text>
      )}
      <text x={cx} y={heading.top ? 292 : 262} textAnchor="middle" fontFamily="Cert Serif" fontStyle="italic" fontWeight={600} fontSize={heading.main.length > 28 ? 34 : 42} fill={c.deep}>
        {heading.main}
      </text>
      <text x={cx} y={344} textAnchor="middle" fontFamily="Cert Serif" fontStyle="italic" fontSize={22} fill="#3b2f20">
        This is to certify that
      </text>
      <text x={cx} y={424} textAnchor="middle" fontFamily="Cert Script" fontSize={nameSize} fill="#22180c">
        {name}
      </text>
      <line x1={cx - 280} x2={cx + 280} y1={446} y2={446} stroke={`url(#${uid}-foil)`} strokeWidth={1.5} />
      <Lines lines={wrapText(line, 70)} x={cx} y={484} gap={30} fontFamily="Cert Serif" fontSize={24} fill="#2b2116" />
      <text x={cx} y={484 + wrapText(line, 70).length * 30} textAnchor="middle" fontFamily="Cert Serif" fontSize={24} fill="#2b2116">
        {when}
      </text>
      <Lines lines={wrapText(verse, 96)} x={cx} y={CERT_H - 196} gap={19} fontFamily="Cert Serif" fontStyle="italic" fontSize={15} fill="#5c4a2e" />
      {signature(250, "SIGNATURE", p.officiant ?? "", "#2b2116", c.main)}
      {signature(CERT_W - 250, "DATE", p.date, "#2b2116", c.main)}
      <Seal x={cx} y={CERT_H - 118} r={46} ring={c.main} inner={c.pale} logoUrl={null} clipId={`${uid}-seal`} />
      <text x={cx} y={CERT_H - 52} textAnchor="middle" fontFamily="Cert Cinzel" fontSize={12} letterSpacing={3} fill={c.deep}>
        {p.number != null ? certificateNumber(p.number).toUpperCase() : ""}
      </text>
    </svg>
  );
}
