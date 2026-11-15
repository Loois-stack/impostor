import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGame } from '../store/game';

/** Reacciones permitidas (también es la lista que valida el anfitrión). */
export const REACTIONS = ['😂', '😱', '🤔', '🤨', '🔪', '👀', '🫣', '🤡', '🔥', '👏'];

interface Floating {
  key: number;
  e: string;
  x: number;
  drift: number;
  spin: number;
  avatar?: string;
  color?: string;
}

let push: ((f: Omit<Floating, 'key' | 'x' | 'drift' | 'spin'>) => void) | null = null;
let seq = 0;

/** Muestra una reacción flotando. `from` es el jugador que la mandó (para poner su carita). */
export function showReaction(e: string, from?: string) {
  const p = from ? useGame.getState().players.find((x) => x.id === from) : undefined;
  push?.({ e, avatar: p?.avatar, color: p?.color });
}

/** Capa donde suben las reacciones de todos, como burbujas. */
export function ReactionLayer() {
  const [list, setList] = useState<Floating[]>([]);
  useEffect(() => {
    push = (f) => {
      const item: Floating = { ...f, key: ++seq, x: 8 + Math.random() * 74, drift: (Math.random() - 0.5) * 80, spin: (Math.random() - 0.5) * 50 };
      setList((l) => [...l.slice(-24), item]);
      setTimeout(() => setList((l) => l.filter((x) => x.key !== item.key)), 2600);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div className="reaction-layer" aria-hidden>
      <AnimatePresence>
        {list.map((f) => (
          <motion.div
            key={f.key}
            className="reaction"
            style={{ left: `${f.x}%` }}
            initial={{ y: 0, opacity: 0, scale: 0.3 }}
            animate={{ y: -window.innerHeight * 0.55, x: [0, f.drift * 0.5, f.drift], opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 0.9], rotate: f.spin }}
            transition={{ duration: 2.5, ease: 'easeOut', times: [0, 0.15, 0.75, 1] }}
          >
            <span className="reaction-e">{f.e}</span>
            {f.avatar && (
              <span className="reaction-who" style={{ background: f.color }}>
                {f.avatar}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
