import type { CSSProperties } from 'react';

/** Cómo se mueve un emoji. */
export type Anim = 'bob' | 'wiggle' | 'jelly' | 'float' | 'pulse' | 'shake' | 'hop' | 'swing' | 'flicker' | 'spin' | 'flip' | 'blink' | 'wave' | 'none';

/** Algunos emojis tienen su propia personalidad; el resto se mueve de forma variada. */
const MAP: Record<string, Anim> = {
  '👻': 'float', '🔪': 'shake', '🗡': 'shake', '🎉': 'jelly', '🔥': 'flicker', '⚡': 'flicker', '💀': 'wiggle', '☠': 'wiggle',
  '🤫': 'pulse', '🐸': 'hop', '🦘': 'hop', '🐰': 'hop', '🦖': 'hop', '🐙': 'swing', '🃏': 'swing', '🎭': 'swing', '👑': 'swing',
  '⏰': 'shake', '⏱': 'pulse', '⏳': 'flip', '🗳': 'bob', '👁': 'blink', '👀': 'blink', '🌪': 'spin', '🎡': 'spin', '🎰': 'spin',
  '💰': 'flip', '🪙': 'flip', '🏆': 'jelly', '🥇': 'jelly', '🇲🇽': 'wave', '🏳': 'wave', '🌶': 'wiggle', '🎙': 'wiggle', '📢': 'shake',
  '🤖': 'shake', '❓': 'wiggle', '🔎': 'swing', '🔍': 'swing', '🕵': 'bob', '🩸': 'float', '🕯': 'flicker', '🎺': 'wiggle',
  '🪅': 'swing', '🌮': 'jelly', '💥': 'pulse', '❤': 'pulse', '💖': 'pulse', '🫥': 'blink', '😈': 'wiggle', '😂': 'jelly',
  '😱': 'shake', '🤔': 'bob', '🍿': 'hop', '📱': 'wiggle', '🌙': 'float', '🎲': 'spin', '🧠': 'pulse', '🐕': 'hop', '🦎': 'wiggle',
};
const POOL: Anim[] = ['bob', 'wiggle', 'jelly', 'float'];

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)!) | 0, 7);
const clean = (e: string) => e.replace(/️/g, '');

export function animFor(e: string): Anim {
  const k = clean(e);
  return MAP[k] ?? MAP[[...k][0]] ?? POOL[Math.abs(hash(k)) % POOL.length];
}

/** Emoji animado. Cada uno tiene su propio ritmo para que no se muevan todos al mismo tiempo. */
export function Emo({ e, anim, size, delay, className = '', style }: { e: string; anim?: Anim; size?: number; delay?: number; className?: string; style?: CSSProperties }) {
  const a = anim ?? animFor(e);
  const h = Math.abs(hash(clean(e)));
  return (
    <span
      className={`emo emo-${a} ${className}`}
      style={{ fontSize: size, '--emo-d': `${delay ?? -((h % 1000) / 1000) * 2}s`, '--emo-t': `${2.2 + (h % 7) * 0.25}s`, ...style } as CSSProperties}
      aria-hidden
    >
      {e}
    </span>
  );
}
