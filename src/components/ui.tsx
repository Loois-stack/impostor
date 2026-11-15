import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { haptic, sfx } from '../audio/sfx';
import type { Player } from '../store/game';
import { Emo } from './Emo';

type BtnProps = HTMLMotionProps<'button'> & { variant?: 'primary' | 'danger' | 'ghost' | 'plain'; small?: boolean; silent?: boolean };

export function Button({ variant = 'primary', small, silent, className = '', onClick, children, ...rest }: BtnProps) {
  return (
    <motion.button
      className={`btn ${variant === 'plain' ? '' : variant} ${small ? 'small' : ''} ${className}`}
      whileTap={{ scale: 0.95, y: 3 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
      onClick={(e) => {
        if (!silent) sfx.tap();
        haptic(8);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({ onClick, children, label }: { onClick: () => void; children: ReactNode; label: string }) {
  return (
    <motion.button
      className="icon-btn"
      aria-label={label}
      whileTap={{ scale: 0.88 }}
      onClick={() => {
        sfx.tap();
        onClick();
      }}
    >
      {children}
    </motion.button>
  );
}

export function TopBar({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="topbar content">
      {onBack && (
        <IconButton label="Atrás" onClick={onBack}>
          ←
        </IconButton>
      )}
      <div className="title">{title}</div>
      {right}
    </div>
  );
}

export function Toggle({ on, onChange, title, desc, emoji }: { on: boolean; onChange: (v: boolean) => void; title: string; desc?: string; emoji?: string }) {
  // Al encenderse, su emoji salta.
  return (
    <motion.button
      className="toggle"
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        sfx.select();
        haptic(10);
        onChange(!on);
      }}
      role="switch"
      aria-checked={on}
    >
      {emoji && (
        <motion.span
          key={String(on)}
          initial={on ? { scale: 0.4, rotate: -30 } : false}
          animate={{ scale: 1, rotate: 0, filter: on ? 'grayscale(0)' : 'grayscale(.7)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 12 }}
          style={{ fontSize: 26, display: 'inline-block' }}
        >
          {on ? <Emo e={emoji} /> : emoji}
        </motion.span>
      )}
      <span className="t">
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`} />
    </motion.button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="seg" style={{ position: 'relative', isolation: 'isolate' }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={o.value === value ? 'on' : ''}
          onClick={() => {
            sfx.select();
            haptic(8);
            onChange(o.value);
          }}
        >
          {o.value === value && <motion.div layoutId={`seg-${id}`} className="pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

const seed = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);

/**
 * Avatar vivo: respira y parpadea solo. `mood` cambia su gesto: habla en su turno, tiembla si
 * lo acusan, salta de gusto si gana. `still` lo deja quieto (eliminados, listas largas).
 */
export function Avatar({
  player,
  size = 44,
  style,
  mood,
  still,
}: {
  player: Player;
  size?: number;
  style?: CSSProperties;
  mood?: 'talk' | 'scared' | 'happy';
  still?: boolean;
}) {
  return (
    <div
      className={`avatar ${mood ?? ''} ${still || size < 26 ? 'still' : ''}`}
      style={{ '--c': player.color, '--av-d': `${-(seed(player.id) % 36) / 10}s`, width: size, height: size, fontSize: size * 0.55, ...style } as CSSProperties}
    >
      <span className="av-face">{player.avatar}</span>
    </div>
  );
}

export function Glitch({ text, hard, className = '', style }: { text: string; hard?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span className={`glitch ${hard ? 'hard' : ''} ${className}`} data-text={text} style={style}>
      {text}
    </span>
  );
}

/** Hoja que sube desde abajo (menús, detalles). Se cierra tocando fuera. */
export function Sheet({ open, onClose, children, z = 40 }: { open: boolean; onClose: () => void; children: ReactNode; z?: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-back" style={{ zIndex: z }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="sheet stack"
            initial={{ y: 500 }}
            animate={{ y: 0 }}
            exit={{ y: 500 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grip" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Escena del teléfono pasando de una mano a otra. */
export function Handoff() {
  return (
    <div className="handoff" aria-hidden>
      <span className="hand l">🫱</span>
      <span className="phone">📱</span>
      <span className="hand r">🫲</span>
    </div>
  );
}

/** Capa oscura a pantalla completa para avisos importantes. */
export function Overlay({ children, z = 40, tint = 'rgba(5,3,10,.86)' }: { children: ReactNode; z?: number; tint?: string }) {
  return (
    <motion.div className="overlay" style={{ zIndex: z, background: tint }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {children}
    </motion.div>
  );
}

/** Transición de pantalla compartida. */
export const screenAnim = {
  initial: { opacity: 0, scale: 1.04, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] as const },
};

export const stagger = (i: number, base = 0.05) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.08 + i * base, type: 'spring' as const, stiffness: 380, damping: 28 },
});
