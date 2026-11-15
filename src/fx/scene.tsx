import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CategoryId } from '../data/types';
import type { EventId } from '../engine/events';
import { haptic, sfx } from '../audio/sfx';
import { REACTIONS } from './reactions';

/**
 * Emojis de ambiente por categoría. Son fijos para cada categoría (no dependen de la carta de la
 * ronda), así que no dan pistas a nadie.
 */
const CAT_SCENE: Record<CategoryId, string[]> = {
  memes: ['🐸', '😂', '💯', '🤣', '📱', '🗿'],
  creepy: ['🩸', '🕯️', '🌑', '🦇', '🕸️', '👁️'],
  scp: ['🔒', '☣️', '📁', '⚠️', '🧪', '🚨'],
  horror: ['🔪', '🩸', '🕯️', '👻', '🌕', '🕸️'],
  cartoons: ['📺', '⭐', '💥', '🎈', '🍿', '✏️'],
  animated: ['🎞️', '✨', '🏰', '🎬', '🌈', '🎨'],
  anime: ['🍥', '⚔️', '🌸', '✨', '🍜', '💥'],
  movies: ['🎬', '🍿', '🎥', '⭐', '🎟️', '🎞️'],
  heroes: ['🦸', '💥', '⚡', '🛡️', '🦹', '🌃'],
  games: ['🎮', '👾', '🕹️', '⭐', '🍄', '💎'],
  series: ['🍿', '📺', '🎬', '⭐', '🛋️', '📼'],
  famous: ['⭐', '📸', '🎤', '💎', '🕶️', '🎙️'],
  objects: ['🧸', '💡', '⏰', '🔑', '📦', '🪑'],
  food: ['🍕', '🌮', '🍔', '🍩', '🌶️', '🍉'],
  animals: ['🐾', '🦜', '🐼', '🐙', '🦋', '🐢'],
  custom: ['✍️', '📸', '💖', '⭐', '😎', '🎉'],
};

export const EVENT_SCENE: Partial<Record<EventId, string[]>> = {
  mexican: ['🇲🇽', '🌮', '🌶️', '🎺', '🪅', '💀', '🌵'],
  bounty: ['💰', '🪙', '💎', '🤑', '✨'],
  mime: ['🎭', '🤐', '🎬', '🤫', '🎩'],
  whisper: ['🤫', '🫢', '💬', '🌙', '👂'],
  terror: ['🩸', '👻', '🕯️', '🔪', '🦇'],
  cursed: ['☠️', '🚫', '🤐', '💀'],
  jester: ['🃏', '🤡', '🎪', '🎭'],
};

export const SCENES = {
  menu: ['🃏', '🔪', '👁️', '🎭', '🤫', '🕵️', '🗳️', '💀', '❓'],
  vote: ['🗳️', '❓', '🕵️', '👀', '🔪', '🤔'],
  score: ['🏆', '⭐', '🎉', '🔥', '🥇', '✨'],
  awards: ['🏆', '👑', '🎉', '🥇', '🌟', '🎊'],
};

export function sceneFor(opts: { screen: string; cat?: CategoryId; event?: EventId; themeEmoji?: string }): string[] {
  if (opts.screen === 'vote') return SCENES.vote;
  if (opts.screen === 'score') return SCENES.score;
  if (opts.screen === 'awards') return SCENES.awards;
  if (opts.event && EVENT_SCENE[opts.event]) return EVENT_SCENE[opts.event]!;
  if (opts.themeEmoji) return [opts.themeEmoji, '🔀', '✨', opts.themeEmoji, '❓', '🎲'];
  if (opts.cat) return CAT_SCENE[opts.cat];
  return SCENES.menu;
}

/** Emojis grandes y tenues que cruzan el fondo de la pantalla. */
export function Scene({ emojis, faint }: { emojis: string[]; faint?: boolean }) {
  const key = emojis.join('');
  const items = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        e: emojis[i % emojis.length],
        x: (i * 11.3 + Math.random() * 8) % 96,
        size: 30 + Math.random() * 36,
        t: 16 + Math.random() * 12,
        d: -Math.random() * 28,
        sx: (Math.random() - 0.5) * 120,
        r0: (Math.random() - 0.5) * 60,
        r1: (Math.random() - 0.5) * 80,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return (
    <AnimatePresence>
      <motion.div key={key} className="scene" initial={{ opacity: 0 }} animate={{ opacity: faint ? 0.6 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} aria-hidden>
        {items.map((it, i) => (
          <span
            key={i}
            className="scene-e"
            style={{ left: `${it.x}%`, fontSize: it.size, '--t': `${it.t}s`, '--d': `${it.d}s`, '--sx': `${it.sx}px`, '--r0': `${it.r0}deg`, '--r1': `${it.r1}deg` } as CSSProperties}
          >
            {it.e}
          </span>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

export interface SceneTitle {
  key: string;
  text: string;
  emoji: string;
  color: string;
}

/** Banda con el nombre de la fase que barre la pantalla (no bloquea los toques). */
export function SceneCard({ title }: { title: SceneTitle | null }) {
  return (
    <AnimatePresence>
      {title && (
        <motion.div key={title.key} className="scene-card" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }} aria-hidden>
          <motion.div
            className="scene-band"
            style={{ '--sc': title.color } as CSSProperties}
            initial={{ x: '-110%', skewX: -20 }}
            animate={{ x: ['-110%', '0%', '0%', '110%'], skewX: [-20, 0, 0, 20] }}
            transition={{ duration: 1.35, times: [0, 0.28, 0.72, 1], ease: 'easeInOut' }}
          >
            <span className="display">
              <span style={{ display: 'inline-block', marginRight: 10 }}>{title.emoji}</span>
              {title.text}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- Lluvia de emojis

interface Drop {
  id: number;
  e: string;
  x: number;
  size: number;
  t: number;
  d: number;
  r: number;
}
let rainPush: ((drops: Drop[]) => void) | null = null;
let rid = 0;

/** Llueven emojis desde arriba (celebraciones, sustos, el evento de la ronda…). */
export function emojiRain(emojis: string[], count = 26) {
  if (!rainPush || typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  rainPush(
    Array.from({ length: count }, (_, i) => ({
      id: ++rid,
      e: emojis[i % emojis.length],
      x: Math.random() * 96,
      size: 26 + Math.random() * 30,
      t: 1.8 + Math.random() * 1.4,
      d: Math.random() * 0.9,
      r: (Math.random() - 0.5) * 540,
    })),
  );
}

export function RainLayer() {
  const [drops, setDrops] = useState<Drop[]>([]);
  useEffect(() => {
    rainPush = (d) => {
      setDrops((l) => [...l.slice(-80), ...d]);
      const ids = new Set(d.map((x) => x.id));
      setTimeout(() => setDrops((l) => l.filter((x) => !ids.has(x.id))), 4200);
    };
    return () => {
      rainPush = null;
    };
  }, []);
  if (!drops.length) return null;
  return (
    <div className="rain" aria-hidden>
      {drops.map((d) => (
        <span key={d.id} style={{ left: `${d.x}%`, fontSize: d.size, '--t': `${d.t}s`, '--d': `${d.d}s`, '--r': `${d.r}deg` } as CSSProperties}>
          {d.e}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Botón de reacciones

/** Botón flotante para lanzar reacciones (en sala las ven todos los teléfonos). */
export function ReactFab({ onReact }: { onReact: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const keepOpen = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 4000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="react-fab">
      <motion.button
        whileTap={{ scale: 0.85 }}
        aria-label="Reaccionar"
        aria-expanded={open}
        onClick={() => {
          sfx.tap();
          setOpen((o) => !o);
          keepOpen();
        }}
      >
        {open ? '✕' : '😂'}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div className="react-list" initial={{ opacity: 0, x: 30, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 30, scale: 0.8 }}>
            {REACTIONS.map((e, i) => (
              <motion.button
                key={e}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.025, type: 'spring', stiffness: 500, damping: 18 }}
                whileTap={{ scale: 1.4 }}
                onClick={() => {
                  haptic(8);
                  sfx.select();
                  onReact(e);
                  keepOpen();
                }}
                aria-label={`Reaccionar ${e}`}
              >
                {e}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
