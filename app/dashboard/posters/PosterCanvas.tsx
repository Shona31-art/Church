"use client";

import { useRef } from "react";
import { showToast } from "@/components/ui/Toaster";

export interface PosterData {
  churchName: string;
  eventTitle: string;
  tagline?: string;
  speaker?: string;
  eventDate?: string;
  location?: string;
  templateKey: "classic" | "bold" | "minimal";
  themeColor: string;
  format: "square" | "story" | "print";
}

const DIMENSIONS: Record<PosterData["format"], { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  print: { w: 1000, h: 1414 },
};

/** A font size that keeps `text` inside `maxWidth` (never cut off), at most `size`. ~0.6 em per character for bold serif. */
function fitSize(text: string, size: number, maxWidth: number): number {
  return Math.min(size, maxWidth / Math.max(1, text.length * 0.6));
}

export function PosterPreview({ data, showDownload = true }: { data: PosterData; showDownload?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { w, h } = DIMENSIONS[data.format];
  const color = data.themeColor;

  async function downloadPng() {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const link = document.createElement("a");
      link.download = `${data.eventTitle.replace(/\s+/g, "-").toLowerCase()}-poster.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("Your browser couldn't create the image. Try a different browser, or take a screenshot of the preview.", "error");
    };
    img.src = url;
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Poster preview: ${data.eventTitle}${data.eventDate ? `, ${data.eventDate}` : ""}`}
        className="w-full h-auto rounded-lg border border-line"
      >
        <rect width={w} height={h} fill="#faf7f2" />

        {data.templateKey === "bold" && <rect width={w} height={h * 0.4} fill={color} />}
        {data.templateKey === "classic" && <rect x={0} y={h - 24} width={w} height={24} fill={color} />}
        {data.templateKey === "minimal" && <circle cx={w / 2} cy={h * 0.15} r={6} fill={color} />}

        <text
          x={w / 2}
          y={data.templateKey === "bold" ? h * 0.2 : h * 0.35}
          textAnchor="middle"
          fontSize={fitSize(data.churchName, w * 0.045, w * 0.9)}
          fontWeight="700"
          fill={data.templateKey === "bold" ? "#ffffff" : "#1c1917"}
          fontFamily="Georgia, serif"
        >
          {data.churchName}
        </text>

        <text
          x={w / 2}
          y={h * 0.48}
          textAnchor="middle"
          fontSize={fitSize(data.eventTitle, w * 0.075, w * 0.9)}
          fontWeight="800"
          fill="#1c1917"
          fontFamily="Georgia, serif"
        >
          {data.eventTitle}
        </text>

        {data.tagline && (
          <text x={w / 2} y={h * 0.56} textAnchor="middle" fontSize={fitSize(data.tagline ?? "", w * 0.03, w * 0.9)} fill={color} fontStyle="italic">
            {data.tagline}
          </text>
        )}

        {data.speaker && (
          <text x={w / 2} y={h * 0.68} textAnchor="middle" fontSize={fitSize(data.speaker ?? "", w * 0.032, w * 0.9)} fill="#1c1917">
            {data.speaker}
          </text>
        )}

        {data.eventDate && (
          <text x={w / 2} y={h * 0.74} textAnchor="middle" fontSize={fitSize(data.eventDate ?? "", w * 0.028, w * 0.9)} fill="#1c1917aa">
            {data.eventDate}
          </text>
        )}

        {data.location && (
          <text x={w / 2} y={h * 0.78} textAnchor="middle" fontSize={fitSize(data.location ?? "", w * 0.024, w * 0.9)} fill="#1c1917aa">
            {data.location}
          </text>
        )}
      </svg>

      {showDownload && (
        <button
          onClick={downloadPng}
          type="button"
          className="mt-3 btn-primary"
        >
          Download PNG
        </button>
      )}
    </div>
  );
}
