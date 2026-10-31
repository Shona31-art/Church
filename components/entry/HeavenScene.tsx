"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * The landing page's hero scene: a golden Bible floats above a sea of
 * clouds under a starry midnight sky, opens, light bursts from its pages,
 * and a radiant cross rises with gold ribbons swirling around it. Then it
 * rests on the cross, glowing.
 *
 * The book, light and cross are CSS (globals.css, `.hv-*`); the sky, clouds,
 * ribbons and rising sparks are one canvas. Plays once (Replay restarts
 * it), pauses when scrolled away or while the opening intro covers it, and
 * shows the finished scene still for people who prefer reduced motion.
 * `fit` sizes the book and cross to the screen on phones and in the intro.
 * Decorative: aria-hidden.
 */
export const INTRO_EVENT = "grace:intro";

/**
 * When the scene's timeline began (document-timeline ms, comparable with
 * performance.now()). CSS animations start when the page is drawn, which can
 * be well before the scripts run, so timers sync to this rather than to
 * "now".
 */
export function sceneStartTime(root: Element | null): number {
  const first = root?.querySelector(".hv-cross")?.getAnimations?.()[0];
  const start = first?.startTime;
  return typeof start === "number" ? start : performance.now();
}

export function HeavenScene({ className = "", fit = "none", replay = true }: { className?: string; fit?: "none" | "phone" | "screen"; replay?: boolean }) {
  const [run, setRun] = useState(0);
  return (
    <div className={`hv ${className}`} data-fit={fit} aria-hidden>
      <SceneBody key={run} />
      {replay && (
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="hv-replay pointer-events-auto absolute bottom-4 right-4 z-[8] inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-[#ffe9b0] backdrop-blur-sm hover:bg-black/45"
        tabIndex={-1}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Replay
      </button>
      )}
    </div>
  );
}

function SceneBody() {
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const back = backRef.current;
    const front = frontRef.current;
    const root = back?.parentElement;
    const bx = back?.getContext("2d");
    const fx = front?.getContext("2d");
    if (!back || !front || !root || !bx || !fx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const R = (a: number, b: number) => a + Math.random() * (b - a);

    let W = 0;
    let H = 0;
    let cloudLayer: HTMLCanvasElement | null = null;
    let cloudW = 0;
    let drift = 0;

    // Cloud sea: drawn once into an off-screen layer (soft, blurred billows
    // lit gold from above), then drifted slowly every frame.
    const buildClouds = () => {
      // A hidden scene (e.g. the intro for a returning visitor) has no size:
      // a zero-sized canvas can't be drawn, so wait until there's room.
      if (W < 1 || H < 1) {
        cloudLayer = null;
        return;
      }
      cloudW = Math.ceil(W * 1.6);
      const ch = Math.max(1, Math.ceil(H * 0.5));
      const c = document.createElement("canvas");
      c.width = cloudW;
      c.height = ch;
      const g = c.getContext("2d")!;
      const step = 90;
      const clumps = Array.from({ length: Math.ceil(cloudW / step) }, (_, i) => ({ x: i * step + R(-30, 30), y: R(0.18, 0.42) * ch, s: R(0.7, 1.3) }));
      for (let row = 0; row < 3; row++)
        for (const k of clumps)
          for (let j = 0; j < 10 + row * 4; j++) {
            const r = R(26, 70) * k.s * (1 + row * 0.35) * Math.min(1, W / 900 + 0.3);
            const x = k.x + R(-70, 70);
            const y = k.y + row * ch * 0.18 + R(-10, 30) + Math.abs(R(-1, 1)) * 25;
            const top = row === 0 ? 1 : row === 1 ? 0.8 : 0.6;
            const gr = g.createRadialGradient(x, y - r * 0.45, r * 0.1, x, y, r);
            gr.addColorStop(0, `rgba(255,${238 - row * 10},${190 - row * 25},${0.55 * top})`);
            gr.addColorStop(0.45, `rgba(${246 - row * 12},${190 - row * 20},${110 - row * 15},${0.45 * top})`);
            gr.addColorStop(0.85, `rgba(${120 - row * 20},${80 - row * 10},70,0.35)`);
            gr.addColorStop(1, "rgba(40,30,60,0)");
            g.fillStyle = gr;
            g.beginPath();
            g.arc(x, y, r, 0, Math.PI * 2);
            g.fill();
          }
      const b = document.createElement("canvas");
      b.width = cloudW;
      b.height = ch;
      const bg = b.getContext("2d")!;
      bg.filter = "blur(5px)";
      bg.drawImage(c, 0, 0);
      bg.filter = "none";
      const shade = bg.createLinearGradient(0, 0, 0, ch);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(0.75, "rgba(10,8,30,0.15)");
      shade.addColorStop(1, "rgba(10,8,30,0.45)");
      bg.globalCompositeOperation = "source-atop";
      bg.fillStyle = shade;
      bg.fillRect(0, 0, cloudW, ch);
      cloudLayer = b;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = root.clientWidth;
      H = root.clientHeight;
      // Size the book and cross to the space: phones (below the lg breakpoint) or a full screen.
      const fit = root.dataset.fit;
      if (fit === "screen" || (fit === "phone" && window.innerWidth < 1024)) {
        const scale = Math.min(1, Math.max(0.4, Math.min(W / 640, H / (fit === "screen" ? 980 : 760))));
        root.style.setProperty("--hv-scale", scale.toFixed(3));
      } else root.style.removeProperty("--hv-scale");
      for (const c of [back, front]) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildClouds();
    };
    resize();

    const stars = Array.from({ length: 220 }, () => ({ x: R(0, 1), y: R(0, 0.62), r: R(0.3, 1.5), t: R(0, 6), c: Math.random() < 0.35 ? "170,205,255" : "255,250,230" }));
    const bright = Array.from({ length: 10 }, () => ({ x: R(0.05, 0.95), y: R(0.05, 0.5), s: R(5, 11), t: R(0, 6) }));
    const band = Array.from({ length: 140 }, () => {
      const u = R(0, 1);
      return { x: 0.25 + u * 0.75, y: 0.05 + u * 0.32 + R(-0.05, 0.05), r: R(10, 40), a: R(0.02, 0.06) };
    });
    const motes = Array.from({ length: 50 }, () => ({ x: R(0, 1), y: R(0, 1), r: R(0.6, 2), v: R(0.0003, 0.0012) }));
    const cssNumber = (name: string, fallback: number) => {
      const value = parseFloat(getComputedStyle(root).getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const centreX = () => (W * cssNumber("--cx", 50)) / 100;
    const centreY = () => (H * cssNumber("--cy", 58)) / 100;
    const stageScale = () => cssNumber("--hv-scale", 1);

    const halo = (t: number, cx: number) => {
      const rx = Math.min(W * 0.42, 620);
      bx.save();
      bx.translate(cx, H * 0.22);
      bx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        bx.beginPath();
        bx.ellipse(0, 0, rx + i * 14, rx * 0.15 + 4 + i * 6, 0, 0, Math.PI * 2);
        bx.strokeStyle = `rgba(255,200,110,${0.28 - i * 0.06})`;
        bx.lineWidth = 2 - i * 0.3;
        bx.shadowColor = "rgba(255,180,80,0.9)";
        bx.shadowBlur = 14;
        bx.stroke();
      }
      for (let i = 0; i < 24; i++) {
        const a = t * 0.15 + (i / 24) * Math.PI * 2;
        bx.fillStyle = `rgba(255,230,160,${0.5 + 0.4 * Math.sin(t * 2 + i)})`;
        bx.beginPath();
        bx.arc(Math.cos(a) * (rx + 8), Math.sin(a) * (rx * 0.15 + 10), 1.6, 0, Math.PI * 2);
        bx.fill();
      }
      bx.restore();
    };

    const ribbons = (t: number, cx: number, cy: number) => {
      const p = Math.min(1, Math.max(0, (t - 9.8) / 2.4));
      if (!p) return;
      const sc = stageScale();
      fx.save();
      fx.globalCompositeOperation = "lighter";
      fx.lineCap = "round";
      for (const side of [-1, 1])
        for (let k = 0; k < 4; k++) {
          const sway = Math.sin(t * 0.7 + k * 0.8) * 10 * sc;
          fx.beginPath();
          fx.moveTo(cx + side * (10 + k * 6) * sc, cy);
          fx.bezierCurveTo(
            cx + side * (240 + k * 26) * sc, cy - (40 + k * 14) * sc + sway,
            cx + side * (290 + k * 18) * sc, cy - (270 + k * 22) * sc,
            cx + side * (70 + k * 14) * sc, cy - (330 + k * 8) * sc + sway,
          );
          fx.setLineDash([1100 * p * sc, 3000]);
          fx.strokeStyle = k === 0 ? "rgba(255,248,215,0.9)" : `rgba(255,${200 + k * 10},${110 + k * 20},${0.5 - k * 0.09})`;
          fx.lineWidth = (k === 0 ? 4 : 9 - k * 2) * sc;
          fx.shadowColor = "rgba(255,190,80,1)";
          fx.shadowBlur = 22;
          fx.stroke();
        }
      fx.restore();
    };

    const start = sceneStartTime(root);
    let frame = 0;
    let visible = true;
    let covered = false; // the opening intro is on top of this scene
    const draw = (now: number) => {
      if (W < 1 || H < 1) return;
      // Reduced motion: draw the finished scene once.
      const t = still ? 20 : (now - start) / 1000;
      const cx = centreX();
      const cy = centreY();
      bx.clearRect(0, 0, W, H);
      bx.globalCompositeOperation = "lighter";
      for (const b of band) {
        const g = bx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r);
        g.addColorStop(0, `rgba(150,170,230,${b.a})`);
        g.addColorStop(1, "rgba(150,170,230,0)");
        bx.fillStyle = g;
        bx.beginPath();
        bx.arc(b.x * W, b.y * H, b.r, 0, Math.PI * 2);
        bx.fill();
      }
      for (const s of stars) {
        s.t += 0.03;
        bx.fillStyle = `rgba(${s.c},${0.35 + 0.45 * Math.sin(s.t)})`;
        bx.beginPath();
        bx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        bx.fill();
      }
      for (const b of bright) {
        b.t += 0.02;
        const a = 0.5 + 0.5 * Math.sin(b.t);
        const x = b.x * W;
        const y = b.y * H;
        const s = b.s * (0.7 + 0.3 * a);
        bx.strokeStyle = `rgba(255,240,200,${0.6 * a})`;
        bx.lineWidth = 1;
        bx.beginPath();
        bx.moveTo(x - s, y);
        bx.lineTo(x + s, y);
        bx.moveTo(x, y - s);
        bx.lineTo(x, y + s);
        bx.stroke();
      }
      halo(t, cx);
      bx.globalCompositeOperation = "source-over";

      const burst = Math.min(1, Math.max(0, (t - 7.4) / 2));
      if (cloudLayer) {
        if (!still) drift = (drift + 0.12) % cloudW;
        const top = H * 0.58;
        bx.drawImage(cloudLayer, -drift, top);
        bx.drawImage(cloudLayer, cloudW - drift, top);
      }
      bx.save();
      bx.globalCompositeOperation = "lighter";
      const glow = bx.createRadialGradient(cx, H * 0.66, 0, cx, H * 0.66, W * 0.45);
      glow.addColorStop(0, `rgba(255,200,110,${0.25 + 0.35 * burst})`);
      glow.addColorStop(1, "rgba(255,200,110,0)");
      bx.fillStyle = glow;
      bx.fillRect(0, 0, W, H);
      bx.restore();

      fx.clearRect(0, 0, W, H);
      ribbons(t, cx, cy - 10 * stageScale());
      fx.globalCompositeOperation = "lighter";
      for (const m of motes) {
        if (!still) m.y -= m.v * (1 + burst);
        if (m.y < -0.05) (m.y = 1.05), (m.x = R(0, 1));
        const x = m.x * W;
        const y = m.y * H;
        const g = fx.createRadialGradient(x, y, 0, x, y, m.r * 5);
        g.addColorStop(0, "rgba(255,226,150,0.8)");
        g.addColorStop(1, "rgba(255,226,150,0)");
        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(x, y, m.r * 5, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalCompositeOperation = "source-over";
      if (!still && visible && !covered) frame = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(performance.now());
    });
    ro.observe(root);
    // Pause while the hero is scrolled out of view.
    const restart = () => {
      cancelAnimationFrame(frame);
      if (visible && !covered && !still) frame = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    });
    io.observe(root);
    // A scene underneath the opening intro waits; the intro's own scene never does.
    const inIntro = Boolean(root.closest("[data-entry-intro]"));
    const onIntro = (e: Event) => {
      if (inIntro) return;
      covered = Boolean((e as CustomEvent<{ open: boolean }>).detail?.open);
      restart();
    };
    window.addEventListener(INTRO_EVENT, onIntro);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener(INTRO_EVENT, onIntro);
    };
  }, []);

  return (
    <>
      <canvas ref={backRef} className="hv-back" />
      <div className="hv-stage">
        <div className="hv-burst" />
        <div className="hv-persp">
          <div className="hv-float">
            <div className="hv-book">
              <div className="hv-f hv-backc" />
              <div className="hv-f hv-spine" />
              <div className="hv-f hv-edge-r" />
              <div className="hv-f hv-edge-b" />
              <div className="hv-f hv-pages" />
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="hv-leaf"
                  style={{ "--delay": `${6 + i * 0.35}s`, "--to": `${-177 + i * 0.5}deg`, "--zr": `${(5 - i) * 0.2}px` } as React.CSSProperties}
                >
                  <div className="hv-leaf-a" />
                  <div className="hv-leaf-b" />
                </div>
              ))}
              <div className="hv-cover">
                <div className="hv-f hv-cover-out">
                  <svg viewBox="0 0 220 300" fill="none">
                    <defs>
                      <linearGradient id="hv-g1" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#fff6d0" />
                        <stop offset="0.5" stopColor="#f2c35f" />
                        <stop offset="1" stopColor="#b37a26" />
                      </linearGradient>
                    </defs>
                    <g stroke="#f0c66a" strokeWidth="1.2" opacity="0.85">
                      <rect x="16" y="16" width="188" height="268" rx="4" />
                      <path d="M16 54c0-22 16-38 38-38M16 40c8 0 14-6 14-14M166 16c22 0 38 16 38 38M190 16c0 8 6 14 14 14M16 246c0 22 16 38 38 38M16 260c8 0 14 6 14 14M204 246c0 22-16 38-38 38M190 284c0-8 6-14 14-14" />
                    </g>
                    <path d="M100 62h20v58h46v20h-46v94h-20v-94H54v-20h46z" fill="url(#hv-g1)" stroke="#fff3c8" strokeWidth="1.2" />
                    <path d="M110 112l9 18-9 18-9-18z" fill="#fffbe8" />
                  </svg>
                </div>
                <div className="hv-f hv-cover-in" />
              </div>
            </div>
          </div>
        </div>
        <svg className="hv-cross" viewBox="0 0 190 300" fill="none">
          <defs>
            <linearGradient id="hv-g2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fffdf0" />
              <stop offset="0.5" stopColor="#ffe08a" />
              <stop offset="1" stopColor="#f3b440" />
            </linearGradient>
          </defs>
          <path d="M80 6h30v84h74v30h-74v174H80V120H6V90h74z" fill="rgba(255,236,170,.55)" stroke="url(#hv-g2)" strokeWidth="5" strokeLinejoin="round" />
          <path d="M88 16h14v80h76v14h-76v176H88V110H12V96h76z" stroke="#fffbe8" strokeWidth="1.5" opacity="0.9" />
          <path d="M95 92l13 13-13 13-13-13z" fill="#fffef6" />
          <path d="M95 97l8 8-8 8-8-8z" fill="#ffe7a0" />
        </svg>
      </div>
      <canvas ref={frontRef} className="hv-front" />
    </>
  );
}
