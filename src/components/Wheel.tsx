import { animate, motion, useAnimationControls, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { makeRng } from '../engine/rng';

export interface WheelEntry {
  id: string;
  emoji: string;
  name: string;
  color: string;
  horror?: boolean;
}

const R = 90;
const BULBS = 24;
const SPIN_S = 4.6;
const pt = (deg: number, r: number) => {
  const t = (deg * Math.PI) / 180;
  return `${(r * Math.sin(t)).toFixed(2)} ${(-r * Math.cos(t)).toFixed(2)}`;
};

/**
 * Ruleta de verdad: gira, cada casilla hace "clic" contra la lengüeta y frena sobre la
 * categoría de la ronda. `seed` hace que todos los teléfonos de una sala vean el mismo giro.
 */
export function Wheel({
  entries,
  targetId,
  seed,
  onTick,
  onLand,
}: {
  entries: WheelEntry[];
  targetId: string;
  seed: number;
  /** Cada casilla que pasa; `k` va de 0 a 1 según lo avanzado del giro. */
  onTick?: (k: number) => void;
  onLand?: () => void;
}) {
  const n = entries.length;
  const a = 360 / n;
  const targetIdx = Math.max(0, entries.findIndex((e) => e.id === targetId));
  const rot = useMotionValue(0);
  const flap = useAnimationControls();
  const [idx, setIdx] = useState(0);
  const [landed, setLanded] = useState(false);

  const final = useMemo(() => {
    const rng = makeRng(seed);
    // No siempre cae al centro de la casilla: a veces queda "por un pelo".
    return 360 * 5 - targetIdx * a + (rng.next() - 0.5) * a * 0.6;
  }, [seed, targetIdx, a]);

  useEffect(() => {
    let last = 0;
    const ctrl = animate(rot, final, {
      duration: SPIN_S,
      ease: [0.1, 0.55, 0.07, 1],
      onUpdate: (v) => {
        const i = ((Math.round(-v / a) % n) + n) % n;
        if (i === last) return;
        last = i;
        setIdx(i);
        onTick?.(v / final);
        flap.set({ rotate: -24 });
        void flap.start({ rotate: 0, transition: { type: 'spring', stiffness: 700, damping: 12 } });
      },
      onComplete: () => {
        setIdx(targetIdx);
        setLanded(true);
        onLand?.();
      },
    });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slice = (i: number) => `M0 0L${pt(i * a - a / 2, R)}A${R} ${R} 0 0 1 ${pt(i * a + a / 2, R)}Z`;
  const cur = entries[idx];
  const win = entries[targetIdx];

  return (
    <div className="wheel-box">
      <div className={`wheel ${landed ? 'landed' : ''}`}>
        {/* Capa que gira: una capa HTML gira siempre sobre su centro (un <g> de SVG no lo garantiza). */}
        <motion.div className="wheel-spin" style={{ rotate: rot }}>
          <svg viewBox="-100 -100 200 200" width="100%" height="100%" aria-hidden>
            <defs>
              <radialGradient id="wheel-depth">
                <stop offset="0" stopColor="#000" stopOpacity="0.7" />
                <stop offset="0.45" stopColor="#000" stopOpacity="0.25" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            {entries.map((e, i) => (
              <path key={i} d={slice(i)} fill={e.color} stroke="#0b0812" strokeWidth="0.8" />
            ))}
            <circle r={R} fill="url(#wheel-depth)" />
            {landed && (
              <>
                <circle r={R} fill="#05030a" opacity="0.62" />
                <path d={slice(targetIdx)} fill={win.color} stroke="#fff" strokeWidth="1.6" className="wheel-win" />
              </>
            )}
            {entries.map((e, i) => (
              <text
                key={i}
                transform={`rotate(${i * a}) translate(0 ${-R * 0.72})`}
                fontSize={n > 12 ? 15 : 19}
                textAnchor="middle"
                dominantBaseline="central"
                opacity={landed && i !== targetIdx ? 0.35 : 1}
              >
                {e.emoji}
              </text>
            ))}
          </svg>
        </motion.div>
        {/* Capa fija: aro, foquitos y centro. */}
        <svg viewBox="-100 -100 200 200" width="100%" height="100%" aria-hidden style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <radialGradient id="wheel-hub" cx="0.35" cy="0.3">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.5" stopColor="var(--back-accent)" />
              <stop offset="1" stopColor="#1a0a12" />
            </radialGradient>
            <mask id="wheel-rim">
              <rect x="-100" y="-100" width="200" height="200" fill="#fff" />
              <circle r={R} fill="#000" />
            </mask>
          </defs>
          <circle r="99" fill="#0b0812" stroke="var(--back-accent)" strokeWidth="1.5" mask="url(#wheel-rim)" />
          {Array.from({ length: BULBS }, (_, i) => (
            <circle key={i} className={`bulb ${i % 2 ? 'b' : 'a'}`} r="2.3" transform={`translate(${pt((i * 360) / BULBS, 95)})`} />
          ))}
          <circle r="17" fill="url(#wheel-hub)" stroke="#0b0812" strokeWidth="2" />
          <text fontSize="17" textAnchor="middle" dominantBaseline="central">
            👁️
          </text>
        </svg>
        <motion.div className="wheel-flap" animate={flap} />
      </div>

      <motion.div
        key={landed ? 'win' : 'spin'}
        className="wheel-name"
        initial={landed ? { scale: 1.9, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 15 }}
        style={{ color: cur.color, textShadow: landed ? `0 0 34px ${cur.color}` : undefined }}
      >
        <span className={`display ${cur.horror ? 'horror-font' : ''}`}>
          {cur.emoji} {cur.name}
        </span>
      </motion.div>
    </div>
  );
}
