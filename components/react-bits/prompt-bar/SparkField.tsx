'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { useIsomorphicLayoutEffect } from './utils';

interface Spark {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  life: number;
  span: number;
}

interface SparkFieldProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Only runs while the top effort step is selected and motion is allowed. */
  active: boolean;
  color: string;
  sparkBoost: number;
  /** Increments once per keystroke; the sparks react to it. */
  strokes: number;
}

/**
 * Drifting sparks behind the field at the top effort step. They rise faster and
 * glow brighter with typing speed, and flash on each keystroke.
 */
export function SparkField({
  canvasRef,
  active,
  color,
  sparkBoost,
  strokes,
}: SparkFieldProps) {
  const typing = useRef({ energy: 0, strokes: 0 });
  const boost = useRef(sparkBoost);

  // Keeps the loop's boost current without restarting it.
  useIsomorphicLayoutEffect(() => {
    boost.current = sparkBoost;
  });

  // A keystroke feeds the field: faster rise and a brighter glow.
  useEffect(() => {
    if (strokes === 0) return;
    typing.current.energy = Math.min(1.6, typing.current.energy + 0.22);
    typing.current.strokes = Math.min(4, typing.current.strokes + 1);
  }, [strokes]);

  useEffect(() => {
    if (!active) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let raf = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let due = 0;
    let speed = 1;
    let pulse = 0;
    const parts: Spark[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (burst: boolean) => {
      parts.push({
        x: Math.random() * w,
        y: burst ? h * (0.2 + Math.random() * 0.8) : h + 3,
        r: 0.9 + Math.random() * 1.1,
        vy: -(7 + Math.random() * 9),
        sway: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
        life: burst ? Math.random() * 1.2 : 0,
        span: 2.4 + Math.random() * 2.4,
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const typed = typing.current;
      const gain = boost.current;
      typed.energy *= Math.exp(-dt / 0.8);
      pulse *= Math.exp(-dt / 0.16);
      if (typed.strokes > 0) {
        typed.strokes = 0;
        if (gain > 0) pulse = 1;
      }
      const energy = typed.energy * gain;
      speed += (1 + energy * 6 - speed) * (1 - Math.exp(-dt / 0.15));
      due += dt;
      while (due > 0.14) {
        due -= 0.14;
        if (parts.length < 30) spawn(false);
      }
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 + energy * 10 + pulse * 6;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.span) {
          parts.splice(i, 1);
          continue;
        }
        const k = p.life / p.span;
        const twinkle = 0.7 + 0.3 * Math.sin((now / 160) * (1 + energy) + p.phase);
        p.y += p.vy * dt * speed;
        if (p.y < -4) {
          p.y = h + 3;
          p.x = Math.random() * w;
        }
        const edge = Math.min(
          1,
          Math.max(0, p.y / 14),
          Math.max(0, (h - p.y) / 14),
        );
        ctx.globalAlpha =
          Math.min(1, Math.sin(k * Math.PI) * (0.9 + energy * 0.25) * twinkle) *
          edge;
        ctx.beginPath();
        ctx.arc(
          p.x + Math.sin((now / 900) * (1 + energy * 0.8) + p.phase) * p.sway,
          p.y,
          p.r * twinkle * (1 + energy * 0.35),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    for (let i = 0; i < 26; i += 1) spawn(true);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      ctx.clearRect(0, 0, w, h);
    };
  }, [active, color, canvasRef, typing, boost]);

  return <canvas ref={canvasRef} className="prompt-bar__sparks" aria-hidden="true" />;
}
