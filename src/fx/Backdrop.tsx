import { useEffect, useRef } from 'react';

export type Mood = 'calm' | 'horror' | 'danger';

interface Props {
  c1: string;
  c2: string;
  mood?: Mood;
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
}

/** Fondo vivo: orbes de color que respiran con la categoría + partículas (brasas) que suben. */
export function Backdrop({ c1, c2, mood = 'calm' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef({ c1: hexToRgb(c1), c2: hexToRgb(c2), mood });
  target.current = { c1: hexToRgb(c1), c2: hexToRgb(c2), mood };

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

    const cur = { c1: [...target.current.c1], c2: [...target.current.c2], danger: 0, horror: 0 };
    const parts: Particle[] = [];
    const spawn = (initial = false): Particle => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 0.2,
      life: Math.random(),
      tw: Math.random() * Math.PI * 2,
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

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgb(${7 + cur.danger * 20},${6},${11})`;
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
        const [r, g, b] = cur.danger > 0.3 ? [255, 60, 80] : cur.c1;
        for (const p of parts) {
          p.y -= p.vy * (1 + cur.danger * 2);
          p.x += p.vx + Math.sin(t + p.tw) * 0.1;
          p.life += 0.004;
          if (p.y < -10) Object.assign(p, spawn());
          const a = (0.35 + Math.sin(t * 3 + p.tw) * 0.25) * Math.min(1, (h - p.y) / 60);
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
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
