"use client";

import { useRef } from "react";

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

function wrapLine(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
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
    img.src = url;
  }

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto rounded-lg border border-ink/10"
      >
        <rect width={w} height={h} fill="#faf7f2" />

        {data.templateKey === "bold" && <rect width={w} height={h * 0.4} fill={color} />}
        {data.templateKey === "classic" && <rect x={0} y={h - 24} width={w} height={24} fill={color} />}
        {data.templateKey === "minimal" && <circle cx={w / 2} cy={h * 0.15} r={6} fill={color} />}

        <text
          x={w / 2}
          y={data.templateKey === "bold" ? h * 0.2 : h * 0.35}
          textAnchor="middle"
          fontSize={w * 0.045}
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
          fontSize={w * 0.075}
          fontWeight="800"
          fill="#1c1917"
          fontFamily="Georgia, serif"
        >
          {wrapLine(data.eventTitle, 22)}
        </text>

        {data.tagline && (
          <text x={w / 2} y={h * 0.56} textAnchor="middle" fontSize={w * 0.03} fill={color} fontStyle="italic">
            {data.tagline}
          </text>
        )}

        {data.speaker && (
          <text x={w / 2} y={h * 0.68} textAnchor="middle" fontSize={w * 0.032} fill="#1c1917">
            {data.speaker}
          </text>
        )}

        {data.eventDate && (
          <text x={w / 2} y={h * 0.74} textAnchor="middle" fontSize={w * 0.028} fill="#1c1917aa">
            {data.eventDate}
          </text>
        )}

        {data.location && (
          <text x={w / 2} y={h * 0.78} textAnchor="middle" fontSize={w * 0.024} fill="#1c1917aa">
            {data.location}
          </text>
        )}
      </svg>

      {showDownload && (
        <button
          onClick={downloadPng}
          type="button"
          className="mt-3 bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Download PNG
        </button>
      )}
    </div>
  );
}
