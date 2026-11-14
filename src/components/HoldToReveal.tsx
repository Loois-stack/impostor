import { motion, useAnimationControls } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CardBack, GameCard } from './GameCard';

const HOLD_MS = 380;

/**
 * Mantener presionado para ver la carta; al soltar se oculta. El sonido y la vibración son
 * idénticos para civiles e impostores, para que nadie en la mesa pueda deducir el rol.
 */
export function HoldToReveal({ front, onSeen, hint = 'Mantén presionado' }: { front: ReactNode; onSeen?: () => void; hint?: string }) {
  const [open, setOpen] = useState(false);
  const ring = useAnimationControls();
  const timer = useRef<number>(0);
  const seen = useRef(false);

  const down = () => {
    sfx.unlock();
    ring.set({ pathLength: 0, opacity: 1 });
    void ring.start({ pathLength: 1, transition: { duration: HOLD_MS / 1000, ease: 'linear' } });
    haptic(10);
    timer.current = window.setTimeout(() => {
      setOpen(true);
      sfx.flip();
      sfx.reveal();
      haptic([20, 40, 30]);
      if (!seen.current) {
        seen.current = true;
        onSeen?.();
      }
    }, HOLD_MS);
  };

  const up = () => {
    clearTimeout(timer.current);
    ring.stop();
    ring.set({ pathLength: 0, opacity: 0 });
    if (open) {
      setOpen(false);
      sfx.whoosh();
    }
  };

  return (
    <GameCard
      flipped={open}
      front={front}
      onPointerDown={down}
      onPointerUp={up}
      back={
        <>
          <CardBack hint />
          <div className="hold-hint" style={{ top: 'auto', bottom: 'clamp(30px, 8%, 46px)' }}>
            <svg width="74" height="74" viewBox="0 0 74 74">
              <circle cx="37" cy="37" r="32" fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.18)" strokeWidth="5" />
              <motion.circle
                cx="37"
                cy="37"
                r="32"
                fill="none"
                stroke="#fff"
                strokeWidth="5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={ring}
                style={{ rotate: -90, transformOrigin: '50% 50%' }}
              />
              <text x="37" y="45" textAnchor="middle" fontSize="24">
                👆
              </text>
            </svg>
            <div className="label pulse" style={{ color: '#fff' }}>
              {hint}
            </div>
          </div>
        </>
      }
    />
  );
}
