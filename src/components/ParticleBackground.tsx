"use client";
import { useEffect, useRef } from "react";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface TrailCell {
  gx: number;
  gy: number;
  opacity: number;
  hue: number;
}

interface Segment {
  x: number;
  y: number;
}

const SQ = 42;
const SPEED = 0.3;
const MAX_SNAKE = 18;
const TRAIL_FADE = 2200;

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    offset: { x: 0, y: 0 },
    hovered: null as Segment | null,
    snake: [] as Segment[],
    trails: new Map<string, TrailCell>(),
    sparks: [] as Spark[],
    opacity: 0,
    targetOpacity: 0,
    lastTs: 0,
    raf: 0,
    hue: 240,
    mouseX: -1000,
    mouseY: -1000,
    pulsePhase: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    const resize = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.floor(canvas.offsetWidth * dpr);
      canvas.height = Math.floor(canvas.offsetHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnSparks = (x: number, y: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        s.sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.4 + Math.random() * 0.6,
          size: 1 + Math.random() * 2.5,
          hue: s.hue + Math.random() * 60 - 30,
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.mouseX = e.clientX - rect.left;
      s.mouseY = e.clientY - rect.top;
      const sx = Math.floor(s.offset.x / SQ) * SQ;
      const sy = Math.floor(s.offset.y / SQ) * SQ;
      const hx = Math.floor((s.mouseX + s.offset.x - sx) / SQ);
      const hy = Math.floor((s.mouseY + s.offset.y - sy) / SQ);

      if (s.hovered?.x !== hx || s.hovered?.y !== hy) {
        if (s.hovered) {
          s.snake.unshift({ x: s.hovered.x, y: s.hovered.y });
          if (s.snake.length > MAX_SNAKE) s.snake.pop();
          spawnSparks(s.mouseX, s.mouseY, 3);
        }
        s.hovered = { x: hx, y: hy };
        s.targetOpacity = 0.8;
      }
    };

    const onMouseLeave = () => {
      if (s.hovered) {
        const sx = Math.floor(s.offset.x / SQ) * SQ;
        const key = `${s.hovered.x},${s.hovered.y}`;
        s.trails.set(key, {
          gx: s.hovered.x, gy: s.hovered.y,
          opacity: 0.7, hue: s.hue,
        });
        // dump snake to trails
        for (const seg of s.snake) {
          const k = `${seg.x},${seg.y}`;
          s.trails.set(k, { gx: seg.x, gy: seg.y, opacity: 0.5, hue: s.hue });
        }
        s.snake = [];
      }
      s.hovered = null;
      s.targetOpacity = 0;
      s.mouseX = -1000;
      s.mouseY = -1000;
    };

    const draw = (ts: number) => {
      if (!s.lastTs) s.lastTs = ts;
      const dt = Math.min(ts - s.lastTs, 50);
      s.lastTs = ts;

      const logW = canvas.offsetWidth;
      const logH = canvas.offsetHeight;
      const dpr = devicePixelRatio || 1;

      // animate state
      s.hue = (s.hue + dt * 0.008) % 360;
      s.pulsePhase += dt * 0.002;
      const pulse = 0.5 + Math.sin(s.pulsePhase) * 0.5; // 0~1

      if (s.opacity !== s.targetOpacity) {
        s.opacity += (s.targetOpacity - s.opacity) * Math.min(dt / 150, 1);
      }

      // fade trails
      for (const [key, t] of s.trails) {
        t.opacity -= dt / TRAIL_FADE;
        if (t.opacity <= 0) s.trails.delete(key);
      }

      // update sparks
      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const sp = s.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.96;
        sp.vy *= 0.96;
        sp.life -= dt / 1000 / sp.maxLife;
        if (sp.life <= 0) s.sparks.splice(i, 1);
      }

      // move grid
      s.offset.x = (s.offset.x - SPEED + SQ) % SQ;
      s.offset.y = (s.offset.y - SPEED * 0.6 + SQ) % SQ;

      // clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sx = Math.floor(s.offset.x / SQ) * SQ;
      const sy = Math.floor(s.offset.y / SQ) * SQ;
      const ox = s.offset.x % SQ;
      const oy = s.offset.y % SQ;

      // mouse proximity glow (large soft glow under cursor)
      if (s.mouseX > 0) {
        const grd = ctx.createRadialGradient(s.mouseX, s.mouseY, 0, s.mouseX, s.mouseY, 160);
        grd.addColorStop(0, `hsla(${s.hue}, 80%, 65%, 0.12)`);
        grd.addColorStop(0.5, `hsla(${s.hue + 30}, 70%, 50%, 0.04)`);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, logW, logH);
      }

      // draw trail cells
      for (const [, t] of s.trails) {
        const tx = Math.round(t.gx * SQ + sx - ox);
        const ty = Math.round(t.gy * SQ + sy - oy);
        ctx.shadowColor = `hsla(${t.hue}, 80%, 60%, ${t.opacity * 0.6})`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `hsla(${t.hue}, 70%, 55%, ${t.opacity * 0.35})`;
        ctx.fillRect(tx, ty, SQ, SQ);
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // draw snake body
      for (let i = s.snake.length - 1; i >= 0; i--) {
        const seg = s.snake[i];
        const px = Math.round(seg.x * SQ + sx - ox);
        const py = Math.round(seg.y * SQ + sy - oy);
        const factor = Math.pow(0.88, i);
        const h = (s.hue + i * 8) % 360;
        const a = 0.15 + 0.55 * factor;

        ctx.shadowColor = `hsla(${h}, 85%, 65%, ${a * 0.7})`;
        ctx.shadowBlur = 14;
        ctx.fillStyle = `hsla(${h}, 75%, 60%, ${a})`;
        ctx.fillRect(px, py, SQ, SQ);

        // inner bright border
        ctx.strokeStyle = `hsla(${h}, 90%, 75%, ${a * 0.5})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, SQ - 2, SQ - 2);
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // draw hovered cell (head) with strong glow
      if (s.hovered) {
        const hx = Math.round(s.hovered.x * SQ + sx - ox);
        const hy = Math.round(s.hovered.y * SQ + sy - oy);
        ctx.shadowColor = `hsla(${s.hue}, 90%, 70%, 0.8)`;
        ctx.shadowBlur = 25;
        ctx.fillStyle = `hsla(${s.hue}, 85%, 75%, ${s.opacity})`;
        ctx.fillRect(hx, hy, SQ, SQ);
        // bright border
        ctx.strokeStyle = `hsla(${s.hue}, 95%, 85%, ${s.opacity * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx + 1, hy + 1, SQ - 2, SQ - 2);
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // draw grid lines with pulsing near mouse
      ctx.lineWidth = 0.5;
      for (let x = sx; x < logW + SQ; x += SQ) {
        for (let y = sy; y < logH + SQ; y += SQ) {
          const gx = Math.round(x - ox);
          const gy = Math.round(y - oy);

          // proximity brightness
          let alpha = 0.04;
          if (s.mouseX > 0) {
            const cx = gx + SQ / 2;
            const cy = gy + SQ / 2;
            const dist = Math.sqrt((cx - s.mouseX) ** 2 + (cy - s.mouseY) ** 2);
            if (dist < 200) {
              alpha += (1 - dist / 200) * 0.1 * (0.7 + pulse * 0.3);
            }
          }

          ctx.strokeStyle = `hsla(${s.hue}, 60%, 60%, ${alpha})`;
          ctx.strokeRect(gx, gy, SQ, SQ);
        }
      }

      // draw sparks
      for (const sp of s.sparks) {
        const a = sp.life;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * a, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${sp.hue}, 90%, 75%, ${a * 0.9})`;
        ctx.shadowColor = `hsla(${sp.hue}, 90%, 70%, ${a * 0.6})`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // vignette
      const vig = ctx.createRadialGradient(
        logW / 2, logH / 2, logW * 0.15,
        logW / 2, logH / 2, Math.sqrt(logW * logW + logH * logH) / 1.8
      );
      vig.addColorStop(0, "rgba(15, 23, 42, 0)");
      vig.addColorStop(0.6, "rgba(15, 23, 42, 0.25)");
      vig.addColorStop(1, "rgba(15, 23, 42, 0.9)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, logW, logH);

      s.raf = requestAnimationFrame(draw);
    };

    resize();
    s.raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "auto" }}
    />
  );
}
