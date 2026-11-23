import { useEffect, useRef } from 'react';
import { perf } from '../services/perf';

/** Efectos imperativos globales: explosiones de partículas, destellos y sacudidas de pantalla. */

type Kind = 'confetti' | 'sparks' | 'shards' | 'embers';

interface BurstOpts {
  x?: number;
  y?: number;
  colors?: string[];
  count?: number;
  kind?: Kind;
  power?: number;
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  max: number;
  kind: Kind;
  g: number;
  drag: number;
}

let push: ((opts: BurstOpts) => void) | null = null;
let flashEl: HTMLDivElement | null = null;

export function burst(opts: BurstOpts = {}) {
  push?.(opts);
}

export function flash(color = '#fff', duration = 450, opacity = 0.85) {
  flashEl?.animate([{ opacity, background: color }, { opacity: 0, background: color }], {
    duration,
    easing: 'cubic-bezier(.2,.7,.3,1)',
  });
}

export function shake(intensity = 12, duration = 500) {
  const el = document.querySelector('.app') as HTMLElement | null;
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const frames: Keyframe[] = [];
  for (let i = 0; i < 10; i++) {
    const k = 1 - i / 10;
    frames.push({
      transform: `translate(${(Math.random() - 0.5) * intensity * 2 * k}px, ${(Math.random() - 0.5) * intensity * 2 * k}px) rotate(${(Math.random() - 0.5) * k * 1.5}deg)`,
    });
  }
  frames.push({ transform: 'none' });
  el.animate(frames, { duration, easing: 'ease-out' });
}

export function FxLayer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    flashEl = flashRef.current;
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const dpr = Math.min(perf.lite ? 1 : 2, window.devicePixelRatio || 1);
    const resize = () => {
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const parts: P[] = [];
    let raf = 0;
    let running = false;
    let lastFrame = 0;

    /** Borra TODO el lienzo (en píxeles reales, no con el tamaño de ventana de ahora, que en iPhone cambia sin avisar). */
    const wipe = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.restore();
    };
    // Sin partículas el lienzo se esconde: en iPhone un lienzo que ya no se redibuja podía quedarse
    // mostrando su último cuadro (chispas "congeladas" que parecían la pantalla estrellada).
    const show = (on: boolean) => {
      cv.style.display = on ? 'block' : 'none';
    };
    show(false);
    const stop = () => {
      cancelAnimationFrame(raf);
      running = false;
      parts.length = 0;
      wipe();
      show(false);
    };

    const draw = () => {
      wipe();
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const a = 1 - p.life / p.max;
        if (a <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        if (p.kind === 'confetti') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.life * 0.2));
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else if (p.kind === 'sparks') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else if (p.kind === 'shards') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.6, p.size);
          ctx.lineTo(-p.size * 0.6, p.size * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, p.size * a), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      lastFrame = performance.now();
      try {
        draw();
      } catch {
        // Si algo falla a medio cuadro, se limpia y se apaga (nunca deja partículas pegadas).
        stop();
        return;
      }
      if (parts.length) raf = requestAnimationFrame(loop);
      else stop();
    };

    push = ({ x = window.innerWidth / 2, y = window.innerHeight / 2, colors = ['#fff'], count = 60, kind = 'confetti', power = 1 }) => {
      if (document.hidden) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) count = Math.min(count, 12);
      else if (perf.lite) count = Math.ceil(count * 0.45);
      for (let i = 0; i < count; i++) {
        const ang = kind === 'confetti' ? -Math.PI / 2 + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2;
        const sp = (kind === 'confetti' ? 8 + Math.random() * 10 : 3 + Math.random() * 11) * power;
        parts.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          size: kind === 'confetti' ? 8 + Math.random() * 8 : kind === 'shards' ? 5 + Math.random() * 9 : 2 + Math.random() * 3,
          color: colors[i % colors.length] ?? '#fff',
          life: 0,
          max: kind === 'confetti' ? 120 + Math.random() * 60 : 40 + Math.random() * 40,
          kind,
          g: kind === 'confetti' ? 0.28 : kind === 'embers' ? -0.05 : 0.15,
          drag: kind === 'confetti' ? 0.975 : 0.94,
        });
      }
      if (parts.length > 900) parts.splice(0, parts.length - 900);
      // Si el ciclo se quedó parado (el navegador dejó de llamarlo), se arranca de nuevo.
      if (running && performance.now() - lastFrame > 400) {
        cancelAnimationFrame(raf);
        running = false;
      }
      if (!running) {
        running = true;
        lastFrame = performance.now();
        show(true);
        raf = requestAnimationFrame(loop);
      }
    };
    // Al salir de la app (cambiar de app, bloquear el teléfono) se tiran las partículas: al volver
    // ya no tienen caso y así nunca se quedan dibujadas.
    const onVis = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', stop);
    return () => {
      push = null;
      flashEl = null;
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', stop);
    };
  }, []);

  return (
    <>
      <div ref={flashRef} className="flash" style={{ opacity: 0 }} />
      <canvas ref={canvas} className="fx-layer" style={{ width: '100%', height: '100%' }} />
    </>
  );
}
