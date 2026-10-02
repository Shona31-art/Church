// Poster Studio options shared by the editor, the save action and the
// renderer. Stored rows are normalised on read (normalizePosterStyle) so a
// bad value saved by an older version can't crash the poster page.

export const POSTER_TEMPLATES = ["classic", "bold", "minimal"] as const;
export const POSTER_FORMATS = ["square", "story", "print"] as const;
export type PosterTemplate = (typeof POSTER_TEMPLATES)[number];
export type PosterFormat = (typeof POSTER_FORMATS)[number];

export const POSTER_COLORS = [
  { hex: "#b45309", name: "Amber" },
  { hex: "#1e3a8a", name: "Navy" },
  { hex: "#065f46", name: "Green" },
  { hex: "#7c2d12", name: "Rust" },
  { hex: "#4c1d95", name: "Purple" },
] as const;

export const POSTER_ROLES = ["church_admin", "pastor", "department_leader"] as const;

export function isPosterRole(role: string | undefined | null): boolean {
  return (POSTER_ROLES as readonly string[]).includes(role ?? "");
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizePosterStyle(row: { template_key?: string | null; format?: string | null; theme_color?: string | null }) {
  return {
    templateKey: (POSTER_TEMPLATES as readonly string[]).includes(row.template_key ?? "")
      ? (row.template_key as PosterTemplate)
      : "classic",
    format: (POSTER_FORMATS as readonly string[]).includes(row.format ?? "") ? (row.format as PosterFormat) : "square",
    themeColor: row.theme_color && isHexColor(row.theme_color) ? row.theme_color : POSTER_COLORS[0].hex,
  };
}
