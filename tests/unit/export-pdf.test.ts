import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { buildExportPdf, pdfSafe } from "@/lib/export-pdf";

describe("data export PDF", () => {
  test("text the PDF fonts can't show becomes safe instead of failing", () => {
    expect(pdfSafe("Praise God 🙏 – “amen”…")).toBe('Praise God - "amen"...');
    expect(pdfSafe("Happy birthday 🎂🎉")).toBe("Happy birthday");
    expect(pdfSafe("שלום")).toBe("????");
    expect(pdfSafe("Café Zoë")).toBe("Café Zoë");
  });

  test("builds a readable, paginated document from many records", async () => {
    const long = "A long message that goes on and on. ".repeat(40) + "https://example.com/" + "x".repeat(200);
    const bytes = await buildExportPdf({
      churchName: "Kingdom Awakening Ministries International",
      personName: "Vishona",
      exportedAt: "8 November 2026, 09:57",
      sections: [
        { title: "Your profile", items: [[{ label: "Name", value: "Vishona" }, { label: "Email", value: "v@example.com" }]] },
        { title: "Your chat messages", note: "The newest 1000 are listed.", items: Array.from({ length: 120 }, (_, i) => [{ label: "Sent", value: "8 November 2026" }, { label: "Content", value: i === 3 ? long : `Message ${i} 🎉` }]) },
        { title: "Your prayers", items: [], empty: "Nothing." },
      ],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(3);
    if (process.env.EXPORT_PDF_OUT) (await import("fs")).writeFileSync(process.env.EXPORT_PDF_OUT, bytes);
  });
});
