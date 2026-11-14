import { useEffect, useRef } from 'react';
import type { Skin } from '../store/prefs';
import { SKINS } from './skins';

export type Mood = 'calm' | 'horror' | 'danger';

interface Props {
  c1: string;
  c2: string;
  mood?: Mood;
  skin?: Skin;
}

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

interface Particle {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  life: number;
  tw: number;
  /** Color fijo (confeti) y giro. */
  hue: number;
  rot: number;
}

/** Colores del papel picado del tema Fiesta. */
const PAPEL = [
  [255, 61, 129],
  [255, 157, 0],
  [57, 255, 136],
  [46, 230, 255],
  [255, 210, 61],
  [157, 123, 255],
];

/**
 * Fondo vivo: orbes de color que respiran con la categoría + partículas que dependen del tema
 * visual (brasas que suben, papel picado que cae o polvo dorado que flota).
 */
export function Backdrop({ c1, c2, mood = 'calm', skin = 'neon' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef({ c1: hexToRgb(c1), c2: hexToRgb(c2), mood, skin });
  target.current = { c1: hexToRgb(c1), c2: hexToRgb(c2), mood, skin };

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    const scale = 0.5; // se dibuja a media resolución y se escala: barato y ya se ve difuso
    const resize = () => {
      w = canvas.width = Math.ceil(window.innerWidth * scale);
      h = canvas.height = Math.ceil(window.innerHeight * scale);
    };
    resize();
    window.addEventListener('resize', resize);

    const bg0 = SKINS[target.current.skin].bg;
    const cur = { c1: [...target.current.c1], c2: [...target.current.c2], bg: [...bg0], danger: 0, horror: 0 };
    const parts: Particle[] = [];
    const spawn = (initial = false): Particle => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.2,
      life: Math.random(),
      tw: Math.random() * Math.PI * 2,
      hue: Math.floor(Math.random() * PAPEL.length),
      rot: Math.random() * Math.PI,
    });
    for (let i = 0; i < 70; i++) parts.push(spawn(true));

    let raf = 0;
    let t = 0;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const frame = () => {
      t += 1 / 60;
      const tg = target.current;
      for (let i = 0; i < 3; i++) {
        cur.c1[i] = lerp(cur.c1[i], tg.c1[i], 0.04);
        cur.c2[i] = lerp(cur.c2[i], tg.c2[i], 0.04);
      }
      cur.danger = lerp(cur.danger, tg.mood === 'danger' ? 1 : 0, 0.05);
      cur.horror = lerp(cur.horror, tg.mood === 'horror' ? 1 : 0, 0.03);
      const sk = SKINS[tg.skin];
      for (let i = 0; i < 3; i++) cur.bg[i] = lerp(cur.bg[i], sk.bg[i], 0.04);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgb(${(cur.bg[0] + cur.danger * 20) | 0},${cur.bg[1] | 0},${cur.bg[2] | 0})`;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      const orbs = [
        { c: cur.c1, x: 0.25 + Math.sin(t * 0.21) * 0.18, y: 0.28 + Math.cos(t * 0.17) * 0.12, r: 0.7, a: 0.28 },
        { c: cur.c2, x: 0.78 + Math.cos(t * 0.19) * 0.15, y: 0.72 + Math.sin(t * 0.23) * 0.14, r: 0.8, a: 0.32 },
        { c: cur.c1, x: 0.6 + Math.sin(t * 0.13 + 2) * 0.25, y: 0.5 + Math.cos(t * 0.11) * 0.25, r: 0.5, a: 0.14 },
      ];
      const dim = 1 - cur.horror * 0.55;
      for (const o of orbs) {
        const R = Math.max(w, h) * o.r;
        const g = ctx.createRadialGradient(o.x * w, o.y * h, 0, o.x * w, o.y * h, R);
        const [r, gg, b] = o.c.map((v, i) => (cur.danger > 0.01 ? lerp(v, [255, 30, 60][i], cur.danger) : v));
        g.addColorStop(0, `rgba(${r | 0},${gg | 0},${b | 0},${o.a * dim})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Niebla en rondas de terror
      if (cur.horror > 0.02) {
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 4; i++) {
          const fx = ((t * 0.02 * (i + 1) + i * 0.3) % 1.6 - 0.3) * w;
          const g = ctx.createRadialGradient(fx, h * (0.6 + i * 0.1), 0, fx, h * (0.6 + i * 0.1), w * 0.6);
          g.addColorStop(0, `rgba(180,170,200,${0.05 * cur.horror})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = 'lighter';
      }

      if (!reduced) {
        const dust = cur.horror > 0.5 ? 'embers' : sk.dust;
        const [r, g, b] = cur.danger > 0.3 ? [255, 60, 80] : dust === 'gold' ? [255, 214, 120] : cur.c1;
        for (const p of parts) {
          const fall = dust === 'confetti';
          // El papel picado cae balanceándose; las brasas y el oro suben.
          p.y += (fall ? 1 : -1) * p.vy * (1 + cur.danger * 2) * (dust === 'gold' ? 0.5 : 1);
          p.x += p.vx + Math.sin(t * (fall ? 1.6 : 1) + p.tw) * (fall ? 0.35 : 0.1);
          p.life += 0.004;
          p.rot += 0.03;
          if (fall ? p.y > h + 10 : p.y < -10) Object.assign(p, spawn(), fall ? { y: -10 } : {});
          const edge = fall ? Math.min(1, (p.y + 10) / 60) : Math.min(1, (h - p.y) / 60);
          if (fall) {
            const [pr, pg, pb] = cur.danger > 0.3 ? [255, 60, 80] : PAPEL[p.hue];
            ctx.fillStyle = `rgba(${pr},${pg},${pb},${0.55 * edge})`;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, Math.cos(p.rot * 2));
            ctx.fillRect(-p.r * 1.6, -p.r, p.r * 3.2, p.r * 2);
            ctx.restore();
          } else {
            const a = (0.35 + Math.sin(t * 3 + p.tw) * 0.25) * edge * (dust === 'gold' ? 1.3 : 1);
            ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (dust === 'gold' ? 0.8 : 1), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) frame();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, filter: 'blur(2px)' }} />
      <div className="vignette" />
      <div className="grain" />
    </>
  );
}
