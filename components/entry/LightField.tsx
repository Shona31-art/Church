"use client";

import { useEffect, useRef } from "react";

/**
 * A quiet, living background for the brand panels: soft motes of teal (and a
 * little rose) light and a few glowing crosses that drift slowly, turn gently
 * and ease away from the pointer or a finger, which leaves a faint trail of
 * light. One canvas, paused when the tab is hidden, a still scene for people
 * who prefer reduced motion. Purely decorative: aria-hidden, no input needed.
 */
export function LightField({ crosses = 3, motes = 40, className = "" }: { crosses?: number; motes?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const TEAL = [63, 182, 194];
    const ROSE = [232, 103, 155];
    const dots = Array.from({ length: motes }, () => ({
      x: rand(0, width),
      y: rand(0, height),
      r: rand(0.6, 2.2),
      vx: rand(-0.08, 0.08),
      vy: rand(-0.25, -0.04),
      hue: Math.random() < 0.75 ? TEAL : ROSE,
      twinkle: rand(0, Math.PI * 2),
    }));
    const marks = Array.from({ length: crosses }, () => ({
      x: rand(width * 0.1, width * 0.9),
      y: rand(height * 0.15, height * 0.85),
      size: rand(26, 46) * (width < 640 ? 0.8 : 1),
      vx: rand(-0.18, 0.18),
      vy: rand(-0.14, 0.14),
      tilt: rand(-0.25, 0.25),
      sway: rand(0, Math.PI * 2),
      alpha: rand(0.45, 0.8),
    }));
    const sparks: { x: number; y: number; life: number; vx: number; vy: number }[] = [];
    const pointer = { x: -9999, y: -9999, active: false };

    function drawCross(m: (typeof marks)[number]) {
      if (!ctx) return;
      const s = m.size / 100;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.tilt + Math.sin(m.sway) * 0.08);
      ctx.scale(s, s);
      ctx.translate(-50, -50);
      ctx.globalAlpha = m.alpha;
      ctx.shadowColor = "rgba(63,182,194,0.8)";
      ctx.shadowBlur = 24;
      const g = ctx.createLinearGradient(0, 9, 0, 91);
      g.addColorStop(0, "#9fe3e7");
      g.addColorStop(0.45, "#3fb6c2");
      g.addColorStop(1, "#136f80");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(45.5, 9, 9, 82, 4.5);
      ctx.roundRect(25, 31.5, 50, 9, 4.5);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f39ac0";
      ctx.beginPath();
      ctx.moveTo(50, 30.2);
      ctx.lineTo(55.8, 36);
      ctx.lineTo(50, 41.8);
      ctx.lineTo(44.2, 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    let last = performance.now();
    let frame = 0;
    function tick(now: number) {
      if (!ctx) return;
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const d of dots) {
        if (!still) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.twinkle += 0.025 * dt;
          if (d.y < -10) (d.y = height + 10), (d.x = rand(0, width));
          if (d.x < -10) d.x = width + 10;
          if (d.x > width + 10) d.x = -10;
        }
        const a = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(d.twinkle));
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 6);
        g.addColorStop(0, `rgba(${d.hue.join(",")},${a})`);
        g.addColorStop(1, `rgba(${d.hue.join(",")},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= 0.025 * dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(${TEAL.join(",")},${s.life * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.2 + s.life * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      for (const m of marks) {
        if (!still) {
          // Drift, ease away from the pointer, and turn back from the edges.
          const dx = m.x - pointer.x;
          const dy = m.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (pointer.active && dist < 160 && dist > 0) {
            m.vx += (dx / dist) * 0.04 * dt;
            m.vy += (dy / dist) * 0.04 * dt;
          }
          const speed = Math.hypot(m.vx, m.vy);
          if (speed > 0.9) (m.vx *= 0.9 / speed), (m.vy *= 0.9 / speed);
          m.vx *= 0.995;
          m.vy *= 0.995;
          if (speed < 0.08) (m.vx += rand(-0.02, 0.02)), (m.vy += rand(-0.02, 0.02));
          if (m.x < 40 || m.x > width - 40) m.vx += (width / 2 - m.x) * 0.0004 * dt;
          if (m.y < 40 || m.y > height - 40) m.vy += (height / 2 - m.y) * 0.0004 * dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.sway += 0.012 * dt;
        }
        drawCross(m);
      }
      frame = still ? 0 : requestAnimationFrame(tick);
    }

    const onMove = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = x - rect.left;
      pointer.y = y - rect.top;
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      if (pointer.active && !still && sparks.length < 60) sparks.push({ x: pointer.x, y: pointer.y, life: 1, vx: rand(-0.4, 0.4), vy: rand(-0.6, 0.1) });
    };
    const mouse = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const touch = (e: TouchEvent) => e.touches[0] && onMove(e.touches[0].clientX, e.touches[0].clientY);
    const leave = () => (pointer.active = false);
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !still) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", mouse, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", mouse);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [crosses, motes]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
