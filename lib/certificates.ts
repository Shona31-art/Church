// Church certificates (church_life.sql, church_life_v2.sql): kinds, wording,
// designs and colours. Shared by the form, the certificate and its PDF.

export const CERTIFICATE_KINDS = ["baptism", "dedication", "membership", "course", "custom"] as const;
export type CertificateKind = (typeof CERTIFICATE_KINDS)[number];

export const CERTIFICATE_INFO: Record<CertificateKind, { label: string; heading: string; scripture: string }> = {
  baptism: { label: "Baptism", heading: "Certificate of Baptism", scripture: "We were therefore buried with him through baptism into death in order that, just as Christ was raised from the dead, we too may live a new life. — Romans 6:4" },
  dedication: { label: "Baby dedication", heading: "Certificate of Dedication", scripture: "I prayed for this child, and the Lord has granted me what I asked of him. So now I give him to the Lord. — 1 Samuel 1:27–28" },
  membership: { label: "Membership", heading: "Certificate of Membership", scripture: "So in Christ we, though many, form one body, and each member belongs to all the others. — Romans 12:5" },
  course: { label: "Course completion", heading: "Certificate of Completion", scripture: "Study to shew thyself approved unto God, a workman that needeth not to be ashamed. — 2 Timothy 2:15" },
  custom: { label: "Other (type your own)", heading: "Certificate", scripture: "Whatever you do, work at it with all your heart, as working for the Lord. — Colossians 3:23" },
};

export const CERTIFICATE_DESIGNS = ["modern", "banner", "ribbon", "classic", "original"] as const;
export type CertificateDesign = (typeof CERTIFICATE_DESIGNS)[number];
export const DESIGN_LABELS: Record<CertificateDesign, string> = { modern: "Modern", banner: "Banner", ribbon: "Ribbon", classic: "Classic", original: "Original" };

export interface CertificateColour {
  label: string;
  /** Main colour: borders, headings. */
  main: string;
  /** Deep shade: bands and dark backgrounds. */
  deep: string;
  /** Pale tint: paper and panels. */
  pale: string;
  /** Three stops for a foil-like shine. */
  foil: [string, string, string];
}

export const CERTIFICATE_COLOURS = {
  gold: { label: "Gold", main: "#a8822f", deep: "#3d2e12", pale: "#fbf5e6", foil: ["#8a6a28", "#ecd28a", "#a37d2f"] },
  royal: { label: "Royal blue", main: "#1e40af", deep: "#0f1d4d", pale: "#eef3ff", foil: ["#1e3a8a", "#6b9cf5", "#1e40af"] },
  crimson: { label: "Crimson", main: "#9f1239", deep: "#3f0716", pale: "#fff1f3", foil: ["#881337", "#f0718f", "#9f1239"] },
  forest: { label: "Forest green", main: "#166534", deep: "#05250f", pale: "#effbf2", foil: ["#14532d", "#5ccf8a", "#166534"] },
  violet: { label: "Violet", main: "#6d28d9", deep: "#240c4d", pale: "#f5f1ff", foil: ["#5b21b6", "#b597fb", "#6d28d9"] },
  ocean: { label: "Ocean", main: "#0e7490", deep: "#06303c", pale: "#ecfcff", foil: ["#155e75", "#5fd6ec", "#0e7490"] },
  charcoal: { label: "Charcoal", main: "#374151", deep: "#0f141c", pale: "#f5f6f8", foil: ["#1f2937", "#9ca3af", "#374151"] },
  rose: { label: "Rose", main: "#be185d", deep: "#45081f", pale: "#fff1f7", foil: ["#9d174d", "#f58bbd", "#be185d"] },
} satisfies Record<string, CertificateColour>;
export type CertificateColourKey = keyof typeof CERTIFICATE_COLOURS;
export const COLOUR_KEYS = Object.keys(CERTIFICATE_COLOURS) as CertificateColourKey[];

export interface CertificateText {
  kind: CertificateKind;
  recipient: string;
  church: string;
  courseName?: string | null;
  parents?: string | null;
  customTitle?: string | null;
  customLine?: string | null;
}

/** "Certificate of Baptism" → { top: "Certificate", main: "of Baptism" }; custom titles likewise when they start with "Certificate". */
export function certificateHeading(c: Pick<CertificateText, "kind" | "customTitle">): { top: string; main: string } {
  const full = c.kind === "custom" ? (c.customTitle?.trim() || "Certificate") : CERTIFICATE_INFO[c.kind].heading;
  const m = /^certificate\s+(of\s+.+)$/i.exec(full);
  return m ? { top: "Certificate", main: m[1] } : { top: "", main: full };
}

/** The sentence under the name, e.g. "was baptised in the name of …". */
export function certificateLine(c: CertificateText): string {
  switch (c.kind) {
    case "baptism":
      return "was baptised in the name of the Father, and of the Son, and of the Holy Spirit";
    case "dedication":
      return c.parents ? `was dedicated to the Lord by their parents, ${c.parents}` : "was dedicated to the Lord";
    case "membership":
      return `has been welcomed as a member of ${c.church}`;
    case "course":
      return `has successfully completed ${c.courseName ?? "the course"}`;
    case "custom":
      return c.customLine?.trim() || "";
  }
}

export const certificateNumber = (no: number | string) => `No. ${no}`;

/** Splits text into lines of at most `max` characters, at spaces. */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
