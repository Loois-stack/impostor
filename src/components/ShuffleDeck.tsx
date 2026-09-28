import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { burst, flash } from '../fx/fx';
import { Glitch } from './ui';

const N = 16;
const W = 92;
const H = 129;

type Phase = 'fly' | 'split' | 'merge' | 'split2' | 'merge2' | 'fan' | 'stack' | 'deal';

const TIMELINE: [Phase, number][] = [
  ['fly', 0],
  ['split', 1100],
  ['merge', 1550],
  ['split2', 2150],
  ['merge2', 2600],
  ['fan', 3200],
  ['stack', 4000],
  ['deal', 4500],
];
export const SHUFFLE_MS = 5000;

/** Reverso pequeño de carta para la animación. */
function MiniBack({ glow }: { glow?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 12,
        background: 'radial-gradient(circle at 50% 40%, #2b2150 0%, #0c0914 75%)',
        border: '1.5px solid rgba(255,255,255,.18)',
        boxShadow: glow ? '0 0 30px rgba(255,46,77,.6), 0 12px 24px rgba(0,0,0,.6)' : '0 8px 18px rgba(0,0,0,.55)',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,.12)',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, rgba(255,255,255,.05) 0 2px, transparent 2px 10px)',
        }}
      />
      <span style={{ fontSize: 34, filter: 'drop-shadow(0 0 10px rgba(255,46,77,.7))' }}>👁️</span>
    </div>
  );
}

/**
 * Las cartas llegan volando, se barajan solas (dos "riffles"), se abren en abanico,
 * se juntan y una sale disparada hacia el primer jugador.
 */
export function ShuffleDeck({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('fly');
  const seeds = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        x: (Math.random() - 0.5) * 900,
        y: (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 300),
        r: (Math.random() - 0.5) * 720,
        jitter: (Math.random() - 0.5) * 6,
      })),
    [],
  );

  useEffect(() => {
    const timers = TIMELINE.map(([p, t]) =>
      setTimeout(() => {
        setPhase(p);
        if (p === 'fly') sfx.whoosh();
        if (p === 'split' || p === 'split2') {
          sfx.whoosh();
          haptic(10);
        }
        if (p === 'merge' || p === 'merge2') for (let i = 0; i < N; i++) setTimeout(() => sfx.spinTick(1 + i / N), i * 22);
        if (p === 'fan') {
          sfx.reveal();
          haptic([10, 30, 10]);
        }
        if (p === 'stack') sfx.flip();
        if (p === 'deal') {
          sfx.stamp();
          haptic([30, 20, 60]);
          flash('#7c5cff', 400, 0.35);
          burst({ kind: 'sparks', count: 30, colors: ['#fff', '#7c5cff', '#ff2e4d'] });
        }
      }, t),
    );
    for (let i = 0; i < N; i++) timers.push(setTimeout(() => sfx.spinTick(0.6 + i * 0.03), 60 + i * 55));
    const end = setTimeout(onDone, SHUFFLE_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = (i: number) => {
    const mid = (N - 1) / 2;
    switch (phase) {
      case 'fly':
      case 'stack':
        return { x: seeds[i].jitter, y: -i * 1.2, rotate: seeds[i].jitter, scale: 1 };
      case 'split':
      case 'split2': {
        const left = phase === 'split' ? i % 2 === 0 : i < N / 2;
        return { x: left ? -W * 0.75 : W * 0.75, y: -Math.floor(i / 2) * 1.5 - 10, rotate: left ? -10 : 10, scale: 1 };
      }
      case 'merge':
      case 'merge2':
        return { x: 0, y: -i * 1.2, rotate: (i % 2 ? 1 : -1) * 2, scale: 1 };
      case 'fan': {
        const k = i - mid;
        return { x: k * 13, y: Math.abs(k) * 3 - 20, rotate: k * 7, scale: 1 };
      }
      case 'deal':
        return i === N - 1 ? { x: 0, y: -40, rotate: 0, scale: 2.2 } : { x: 0, y: -i * 1.2 + 260, rotate: 0, scale: 0.8 };
    }
  };

  const delay = (i: number) => {
    if (phase === 'fly') return i * 0.055;
    if (phase === 'merge' || phase === 'merge2') return i * 0.022;
    if (phase === 'fan') return i * 0.02;
    return 0;
  };

  return (
    <div className="grow center" style={{ gap: 26, position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: phase === 'deal' ? 0 : 1, y: 0 }}
        className="display"
        style={{ fontSize: 34 }}
      >
        <Glitch text={phase === 'fan' || phase === 'stack' ? '¡Listas!' : 'Barajando…'} />
      </motion.div>
      <div style={{ position: 'relative', width: W, height: H, transformStyle: 'preserve-3d' }}>
        {seeds.map((sd, i) => (
          <motion.div
            key={i}
            initial={{ x: sd.x, y: sd.y, rotate: sd.r, scale: 0.6, opacity: 0 }}
            animate={{ ...target(i), opacity: phase === 'deal' && i !== N - 1 ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: phase === 'fly' ? 90 : 260, damping: phase === 'fly' ? 14 : 22, delay: delay(i) }}
            style={{ position: 'absolute', inset: 0, zIndex: i, transformOrigin: phase === 'fan' ? '50% 140%' : '50% 50%' }}
          >
            <MiniBack glow={phase === 'deal' && i === N - 1} />
          </motion.div>
        ))}
      </div>
      <motion.div animate={{ opacity: phase === 'deal' ? 0 : 0.8 }} className="dim" style={{ fontSize: 13, marginTop: 30 }}>
        Nadie mire las cartas… 🤫
      </motion.div>
    </div>
  );
}
