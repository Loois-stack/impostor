import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { CAT } from '../data/categories';
import type { CategoryId, Item } from '../data/types';
import { CardArt } from './GameCard';

/** Versión compacta de carta para comparaciones y opciones. */
export function MiniCard({
  item,
  cat,
  label,
  color,
  onClick,
  state,
  style,
  delay = 0,
  children,
}: {
  item: Item | null;
  cat: CategoryId;
  label?: string;
  color?: string;
  onClick?: () => void;
  state?: 'right' | 'wrong' | 'dim';
  style?: CSSProperties;
  delay?: number;
  children?: ReactNode;
}) {
  const c = CAT[cat];
  const border = state === 'right' ? '#39ff88' : state === 'wrong' ? '#ff2e4d' : color ?? 'rgba(255,255,255,.15)';
  return (
    <motion.button
      initial={{ opacity: 0, y: 40, rotateY: 90 }}
      animate={{ opacity: state === 'dim' ? 0.35 : 1, y: 0, rotateY: 0, scale: state === 'right' ? 1.05 : 1 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 20 }}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      onClick={onClick}
      disabled={!onClick}
      style={{
        position: 'relative',
        borderRadius: 18,
        overflow: 'hidden',
        background: '#0d0b14',
        border: `2px solid ${border}`,
        boxShadow: state === 'right' ? '0 0 30px #39ff8888' : color ? `0 0 26px ${color}55` : '0 10px 30px rgba(0,0,0,.5)',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: 0, paddingBottom: '80%' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ width: '100%', position: 'relative' }} className="mini-art">
            <CardArt item={item} cat={cat} />
          </div>
        </div>
      </div>
      <div style={{ padding: '6px 10px 10px', marginTop: -18, position: 'relative' }}>
        {label && (
          <div className="label" style={{ fontSize: 9.5, color: color ?? c.color }}>
            {label}
          </div>
        )}
        <div className={`display ${c.horror && cat !== 'scp' ? 'horror-font' : ''}`} style={{ fontSize: 22, lineHeight: 0.95 }}>
          {item ? item.name : '??? (sin carta)'}
        </div>
      </div>
      {children}
    </motion.button>
  );
}
