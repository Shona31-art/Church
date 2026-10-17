"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipse, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { ImageSource, PosterDesign, PosterElement } from "@/lib/posters/design";
import { applyResize } from "@/lib/posters/elements";
import { cssFontFamily } from "@/lib/posters/fonts";

/**
 * Draws a poster design with Konva and handles direct manipulation: click to
 * select, drag to move, handles to resize/rotate, double-click text to type.
 * The design is in poster pixels; `scale` fits it to the screen. Exporting
 * at pixelRatio = 1/scale gives the full-resolution image (see Editor).
 */
export function EditorCanvas({
  design,
  scale,
  selectedId,
  editingId,
  readOnly = false,
  fontVersion = 0,
  imageUrls,
  stageRef,
  onSelect,
  onChange,
  onStartEditText,
}: {
  design: PosterDesign;
  scale: number;
  selectedId: string | null;
  editingId: string | null;
  readOnly?: boolean;
  /** Bump after fonts load: the layer is rebuilt so Konva re-measures text with the real font. */
  fontVersion?: number;
  /** Signed URLs for uploaded photos, by storage path (step 4). */
  imageUrls?: Record<string, string>;
  stageRef: React.RefObject<Konva.Stage>;
  onSelect: (id: string | null) => void;
  /** A finished drag/resize: commit as one undo step. */
  onChange: (id: string, changes: Partial<PosterElement>) => void;
  onStartEditText: (id: string) => void;
}) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const selected = design.elements.find((e) => e.id === selectedId);

  // Attach the resize/rotate handles to the selected element (not while typing, or if locked).
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selected && !selected.locked && !readOnly && selected.id !== editingId ? nodes.current.get(selected.id) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, editingId, readOnly, design]);

  const isLine = selected?.type === "shape" && selected.shape === "line";
  // Finger-sized handles on touch screens (the handles are drawn in screen pixels).
  const touch = useCoarsePointer();

  return (
    <Stage
      ref={stageRef}
      width={Math.round(design.width * scale)}
      height={Math.round(design.height * scale)}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        // Clicking empty poster (the background) clears the selection.
        if (e.target === e.target.getStage() || e.target.name() === "background") onSelect(null);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "background") onSelect(null);
      }}
    >
      <Layer key={fontVersion}>
        <Background design={design} imageUrls={imageUrls} />
        {design.elements.map((element) => (
          <ElementNode
            key={element.id}
            element={element}
            readOnly={readOnly}
            hidden={element.id === editingId}
            imageUrls={imageUrls}
            register={(node) => (node ? nodes.current.set(element.id, node) : nodes.current.delete(element.id))}
            onSelect={() => onSelect(element.id)}
            onChange={(changes) => onChange(element.id, changes)}
            onStartEditText={() => onStartEditText(element.id)}
          />
        ))}
        {!readOnly && (
          <Transformer
            ref={transformerRef}
            name="transformer"
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            rotationSnapTolerance={4}
            enabledAnchors={isLine ? ["middle-left", "middle-right"] : undefined}
            anchorSize={touch ? 22 : 10}
            padding={touch ? 6 : 0}
            anchorCornerRadius={5}
            anchorStroke="#a88a4a"
            borderStroke="#a88a4a"
            boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 10 || (!isLine && Math.abs(newBox.height) < 10) ? oldBox : newBox)}
          />
        )}
      </Layer>
    </Stage>
  );
}

function Background({ design, imageUrls }: { design: PosterDesign; imageUrls?: Record<string, string> }) {
  const { width, height, background } = design;
  const image = useLoadedImage(background.image ? imageUrl(background.image.src, imageUrls) : null);
  const gradient = background.gradient ? gradientPoints(background.gradient.angle, width, height) : null;
  return (
    <>
      <Rect
        name="background"
        width={width}
        height={height}
        fill={background.color}
        {...(gradient && background.gradient
          ? {
              fillLinearGradientStartPoint: gradient.start,
              fillLinearGradientEndPoint: gradient.end,
              fillLinearGradientColorStops: [0, background.gradient.from, 1, background.gradient.to],
            }
          : {})}
      />
      {image && <KonvaImage name="background" image={image} {...coverCrop(image, width, height)} width={width} height={height} />}
      {background.image?.overlay && (
        <Rect name="background" width={width} height={height} fill={background.image.overlay.color} opacity={background.image.overlay.opacity} />
      )}
    </>
  );
}

function ElementNode({
  element,
  readOnly,
  hidden,
  imageUrls,
  register,
  onSelect,
  onChange,
  onStartEditText,
}: {
  element: PosterElement;
  readOnly: boolean;
  hidden: boolean;
  imageUrls?: Record<string, string>;
  register: (node: Konva.Group | null) => void;
  onSelect: () => void;
  onChange: (changes: Partial<PosterElement>) => void;
  onStartEditText: () => void;
}) {
  return (
    <Group
      ref={register}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      opacity={hidden ? 0 : element.opacity}
      draggable={!readOnly && !element.locked}
      listening={!readOnly}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDblClick={element.type === "text" ? onStartEditText : undefined}
      onDblTap={element.type === "text" ? onStartEditText : undefined}
      onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({ x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation() * 10) / 10, ...applyResize(element, sx, sy) });
      }}
    >
      <ElementShape element={element} imageUrls={imageUrls} />
    </Group>
  );
}

/** The drawing for one element at its own origin (0, 0). Also used for group children. */
function ElementShape({ element, imageUrls }: { element: PosterElement; imageUrls?: Record<string, string> }) {
  switch (element.type) {
    case "text":
      return (
        <Text
          width={element.width}
          text={element.uppercase ? element.text.toUpperCase() : element.text}
          fontFamily={cssFontFamily(element.fontFamily)}
          fontSize={element.fontSize}
          fontStyle={`${element.italic ? "italic " : ""}${element.fontWeight}`}
          fill={element.fill}
          align={element.align}
          lineHeight={element.lineHeight}
          letterSpacing={element.letterSpacing}
          shadowColor={element.shadow?.color}
          shadowBlur={element.shadow?.blur}
          shadowOffsetX={element.shadow?.offsetX}
          shadowOffsetY={element.shadow?.offsetY}
          shadowOpacity={element.shadow?.opacity}
          stroke={element.stroke?.color}
          strokeWidth={element.stroke?.width}
          fillAfterStrokeEnabled
        />
      );
    case "shape": {
      const fill = element.fill ? withAlpha(element.fill, element.fillOpacity) : undefined;
      const stroke = element.stroke ?? undefined;
      if (element.shape === "ellipse")
        return <Ellipse x={element.width / 2} y={element.height / 2} radiusX={element.width / 2} radiusY={element.height / 2} fill={fill} stroke={stroke} strokeWidth={element.strokeWidth} />;
      if (element.shape === "line")
        return <Line points={[0, 0, element.width, 0]} stroke={stroke ?? fill ?? "#000000"} strokeWidth={Math.max(1, element.strokeWidth)} lineCap="round" hitStrokeWidth={24} />;
      if (element.shape === "triangle")
        return <Line points={[element.width / 2, 0, element.width, element.height, 0, element.height]} closed fill={fill} stroke={stroke} strokeWidth={element.strokeWidth} />;
      return <Rect width={element.width} height={element.height} cornerRadius={element.cornerRadius} fill={fill} stroke={stroke} strokeWidth={element.strokeWidth} />;
    }
    case "image":
      return <ImageShape element={element} imageUrls={imageUrls} />;
    case "icon":
      // Decorative icons arrive in step 5; until then, a neutral marker keeps the layout visible.
      return <Rect width={element.width} height={element.height} fill={withAlpha(element.fill, 0.25)} cornerRadius={8} />;
    case "group":
      return (
        <>
          {/* A transparent hit area so the whole group is easy to grab. */}
          <Rect width={element.width} height={element.height} fill="transparent" />
          {element.children.map((child) => (
            <Group key={child.id} x={child.x} y={child.y} rotation={child.rotation} opacity={child.opacity} listening={false}>
              <ElementShape element={child} imageUrls={imageUrls} />
            </Group>
          ))}
        </>
      );
  }
}

function ImageShape({ element, imageUrls }: { element: Extract<PosterElement, { type: "image" }>; imageUrls?: Record<string, string> }) {
  const image = useLoadedImage(imageUrl(element.src, imageUrls));
  const { width, height } = element;
  const radius = element.shape === "circle" ? Math.min(width, height) / 2 : element.shape === "rounded" ? element.cornerRadius : 0;
  const clip = (ctx: Konva.Context) => {
    if (element.shape === "circle") {
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, radius);
      ctx.closePath();
    }
  };
  return (
    <Group clipFunc={clip}>
      {image ? (
        <KonvaImage image={image} width={width} height={height} {...(element.fit === "cover" ? coverCrop(image, width, height) : {})} />
      ) : (
        <>
          {/* Empty photo slot: clearly labelled so it's obvious it needs a real photo. */}
          <Rect width={width} height={height} fill="#d2d6de" />
          <Text
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            text={element.src.kind === "placeholder" ? element.src.label || "Add a photo" : "Loading photo…"}
            fontSize={Math.max(14, Math.min(width, height) / 9)}
            fill="#5b616e"
            padding={8}
          />
        </>
      )}
      {element.overlay && <Rect width={width} height={height} fill={element.overlay.color} opacity={element.overlay.opacity} />}
      {element.border && element.border.width > 0 && (
        element.shape === "circle" ? (
          <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} stroke={element.border.color} strokeWidth={element.border.width * 2} />
        ) : (
          <Rect width={width} height={height} cornerRadius={radius} stroke={element.border.color} strokeWidth={element.border.width * 2} />
        )
      )}
    </Group>
  );
}

/** The URL to draw an image source from: signed URL for uploads, Pexels URL for stock, none for placeholders. */
function imageUrl(src: ImageSource, imageUrls?: Record<string, string>): string | null {
  if (src.kind === "stock") return src.url;
  if (src.kind === "asset") return imageUrls?.[src.path] ?? null;
  return null;
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return coarse;
}

/** Loads an image for the canvas. crossOrigin keeps the canvas exportable (no "tainted canvas"). */
function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);
  return image;
}

/** Crop so the image fills width × height without stretching (CSS object-fit: cover). */
function coverCrop(image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  return { crop: { x: (image.width - cropWidth) / 2, y: (image.height - cropHeight) / 2, width: cropWidth, height: cropHeight } };
}

/** CSS-style gradient angle (0 = to top, 90 = to right) → start/end points across the poster. */
function gradientPoints(angle: number, width: number, height: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  return {
    start: { x: width / 2 - dx * half, y: height / 2 - dy * half },
    end: { x: width / 2 + dx * half, y: height / 2 + dy * half },
  };
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
