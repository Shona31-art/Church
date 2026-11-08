import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// The POPIA data export as a readable PDF (app/api/members/[id]/export):
// plain headings, one block per record, real dates, no internal ids. The
// machine-readable JSON stays available beside it.

export interface ExportSection {
  title: string;
  /** Shown when there are no records. */
  empty?: string;
  note?: string;
  items: { label: string; value: string }[][];
}

const PAGE = { w: 595.28, h: 841.89 }; // A4
const M = 50;
const PLUM = rgb(0.29, 0.1, 0.34);
const GREY = rgb(0.4, 0.4, 0.45);

/**
 * The standard PDF fonts only know Western European letters: anything else
 * (emoji, other scripts) becomes "?", and curly quotes and dashes their plain
 * forms, so the export never fails on a message someone typed.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n")
    // Emoji are left out (the fonts can't draw them); other letters become "?".
    .replace(/[\p{Extended_Pictographic}\u200D\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/gu, "?")
    .replace(/ {2,}/g, " ")
    .replace(/ +$/gm, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= width) {
        line = tryLine;
        continue;
      }
      if (line) out.push(line);
      // A single word too long for a line (e.g. a link): cut it.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

export async function buildExportPdf(input: { churchName: string; personName: string; exportedAt: string; sections: ExportSection[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Your information - ${pdfSafe(input.personName)}`);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE.w - 2 * M;

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;
  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - M;
  };
  const need = (h: number) => {
    if (y - h < M + 20) newPage();
  };
  const text = (s: string, font: PDFFont, size: number, color = rgb(0.1, 0.1, 0.12), x = M, w = width, gap = 3) => {
    for (const line of wrap(s, font, size, w - (x - M))) {
      need(size + gap);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  // Title
  text(`Your information at ${input.churchName}`, bold, 20, PLUM);
  y -= 4;
  text(`${input.personName} - prepared ${input.exportedAt}`, regular, 11, GREY);
  y -= 4;
  text("Everything Grace holds about you, as the Protection of Personal Information Act (POPIA) allows you to ask for. A machine-readable copy (JSON) can be downloaded too.", regular, 9.5, GREY);
  y -= 14;

  for (const section of input.sections) {
    need(40);
    y -= 6;
    page.drawRectangle({ x: M, y: y - 22, width, height: 22, color: rgb(0.96, 0.93, 0.97) });
    page.drawText(pdfSafe(section.title), { x: M + 8, y: y - 15.5, size: 12.5, font: bold, color: PLUM });
    y -= 30;
    if (section.note) text(section.note, regular, 9, GREY);
    if (!section.items.length) {
      text(section.empty ?? "Nothing here.", regular, 10, GREY);
      y -= 4;
      continue;
    }
    for (const item of section.items) {
      for (const { label, value } of item) {
        const labelW = 125;
        const lines = wrap(value, regular, 10, width - labelW);
        need(13);
        page.drawText(pdfSafe(label), { x: M, y: y - 10, size: 9, font: bold, color: GREY });
        lines.forEach((line, i) => {
          if (i > 0) need(13);
          page.drawText(line, { x: M + labelW, y: y - 10, size: 10, font: regular, color: rgb(0.1, 0.1, 0.12) });
          y -= 13;
        });
      }
      y -= 4;
      need(8);
      page.drawLine({ start: { x: M, y }, end: { x: M + width, y }, thickness: 0.5, color: rgb(0.88, 0.86, 0.9) });
      y -= 8;
    }
  }

  // Page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE.w - M - 70, y: 25, size: 8.5, font: regular, color: GREY }));
  return doc.save();
}
