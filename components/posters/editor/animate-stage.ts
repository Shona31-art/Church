import type Konva from "konva";
import { centredScaleOffset, frameState, travelFor, videoSeconds } from "@/lib/posters/animation";
import type { PosterDesign } from "@/lib/posters/design";

/**
 * Plays a design's entrance animations on the live editor canvas by moving
 * the Konva nodes directly (no React re-render per frame), calling `onFrame`
 * after each drawn frame — the video recorder copies the canvas there.
 * Time comes from the clock, not a frame count, so a slow phone drops frames
 * rather than stretching the video. Every node is put back where the design
 * says when it finishes or is stopped.
 */
export function playOnStage(
  stage: Konva.Stage,
  design: PosterDesign,
  { onFrame, signal }: { onFrame?: (t: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  const travel = travelFor(design.width, design.height);
  const duration = videoSeconds(design.elements.map((e) => e.animation));
  const tracks = design.elements.flatMap((element) => {
    const node = stage.findOne<Konva.Group>(`#${element.id}`);
    return node && element.animation && element.animation.entrance !== "none" ? [{ element, node }] : [];
  });

  const apply = (t: number) => {
    for (const { element, node } of tracks) {
      const s = frameState(element.animation, t, travel);
      const centre = centredScaleOffset(element.width, element.height, element.rotation, s.scale);
      node.setAttrs({
        x: element.x + s.dx + centre.dx,
        y: element.y + s.dy + centre.dy,
        opacity: element.opacity * s.opacity,
        scaleX: s.scale,
        scaleY: s.scale,
      });
    }
    stage.batchDraw();
  };
  const restore = () => {
    for (const { element, node } of tracks) node.setAttrs({ x: element.x, y: element.y, opacity: element.opacity, scaleX: 1, scaleY: 1 });
    stage.batchDraw();
  };

  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      if (signal?.aborted || t >= duration) {
        apply(duration);
        onFrame?.(duration);
        restore();
        resolve();
        return;
      }
      apply(t);
      onFrame?.(t);
      requestAnimationFrame(tick);
    };
    apply(0);
    requestAnimationFrame(tick);
  });
}
