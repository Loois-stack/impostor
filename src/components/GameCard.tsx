import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { CAT } from '../data/categories';
import type { CategoryId, Item } from '../data/types';
import { imageFor } from '../services/images';
import { Glitch } from './ui';

export type CardRole = 'civil' | 'imp' | 'imp-classic' | 'plain';

/** Estilo del arte propio (cartas sin foto) según la categoría. */
const PATTERN: Record<CategoryId, string> = {
  memes: 'halftone',
  creepy: 'scratch',
  scp: 'rays',
  horror: 'scratch',
  cartoons: 'halftone',
  animated: 'bokeh',
  anime: 'speed',
  movies: 'film',
  heroes: 'speed',
  games: 'pixel',
  series: 'film',
  famous: 'spot',
  objects: 'bokeh',
  food: 'bokeh',
  animals: 'bokeh',
  custom: 'bokeh',
};

export function CardArt({ item, cat }: { item: Item | null; cat: CategoryId }) {
  const c = CAT[cat];
  const url = item ? imageFor(item) : null;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const style = { '--c1': c.color2, '--c2': '#0d0b14' } as CSSProperties;

  if (item && item.cat === 'scp') return <Dossier item={item} />;

  return (
    <div className="card-art" style={style}>
      {(!url || failed || !loaded) && (
        <>
          {PATTERN[cat] === 'rays' ? <div className="rays" /> : <div className={`pat pat-${PATTERN[cat]}`} />}
          <div className="watermark">{item?.name ?? '???'}</div>
          <div className="fallback" style={{ filter: `drop-shadow(0 0 28px ${c.color}aa) drop-shadow(0 12px 24px rgba(0,0,0,.5))` }}>
            <span className="float" style={{ display: 'inline-block' }}>
              {item ? item.emoji : '❓'}
            </span>
          </div>
        </>
      )}
      {url && !failed && (
        <motion.img
          src={url}
          alt={item?.name}
          draggable={false}
          initial={{ opacity: 0, scale: 1.15 }}
          animate={loaded ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6 }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0 }}
        />
      )}
      <div className="shade" />
    </div>
  );
}

function Dossier({ item }: { item: Item }) {
  const [num, ...rest] = item.name.split(' ');
  const cls = item.group.split('.')[1].toUpperCase();
  return (
    <div className="card-art">
      <div className="dossier">
        <div style={{ fontFamily: 'var(--display)', fontSize: 44, lineHeight: 1, marginTop: 6 }}>{num}</div>
        <div style={{ fontWeight: 800, marginTop: 2 }}>{rest.join(' ').replace(/"/g, '')}</div>
        <div style={{ marginTop: 10 }}>
          Clase de objeto: <b>{cls}</b>
        </div>
        <div style={{ marginTop: 6, lineHeight: 1.7 }}>
          Procedimientos: <span className="redact">████████ ██ ███</span> contención <span className="redact">██████</span> personal
          Clase-D <span className="redact">████ ███ █████████</span>
        </div>
        <div style={{ position: 'absolute', right: 18, top: 16, fontSize: 64, opacity: 0.9 }}>{item.emoji}</div>
        <div className="stamp">{cls}</div>
      </div>
      <div className="shade" style={{ background: 'linear-gradient(180deg, transparent 60%, #0d0b14 100%)' }} />
    </div>
  );
}

export interface CardNote {
  kind: 'accomplice' | 'detective';
  text: string;
}

export function CardFront({
  item,
  cat,
  role,
  note,
  topic,
}: {
  item: Item | null;
  cat: CategoryId;
  role: CardRole;
  note?: CardNote;
  /** Tema de la ronda en modo Mezcla. */
  topic?: string;
}) {
  const c = CAT[cat];
  return (
    <>
      <div className="cat-chip" style={{ color: c.color }}>
        {c.emoji} {c.name}
      </div>
      <CardArt item={role === 'imp-classic' ? null : item} cat={cat} />
      <div className="card-body">
        <div
          className={`card-name ${c.horror && cat !== 'scp' ? 'horror-font' : ''} ${(item?.name.length ?? 0) > 16 ? 'long' : ''}`}
          style={{ color: role.startsWith('imp') ? '#fff' : undefined }}
        >
          {role === 'imp-classic' ? '???' : item?.name}
        </div>
        {role !== 'imp-classic' && item && <div className="card-ctx">{item.ctx}</div>}
        {note && (
          <div className={`role-banner ${note.kind === 'accomplice' ? 'imp' : 'civil'}`} style={{ background: note.kind === 'accomplice' ? 'rgba(255,138,61,.18)' : 'rgba(57,255,136,.14)', borderColor: note.kind === 'accomplice' ? '#ff8a3d' : '#39ff88', color: '#fff' }}>
            <b>{note.kind === 'accomplice' ? '🤝 Eres el cómplice' : '🔎 Eres el detective'}</b>
            {note.text}
          </div>
        )}
        {role === 'civil' && !note && (
          <div className="role-banner civil">
            <b>🛡️ Eres civil</b>
            Defiende esta carta. El impostor tiene algo <u>parecido</u>.
          </div>
        )}
        {role === 'imp' && (
          <div className="role-banner imp">
            <b>
              <Glitch text="🔪 Eres el impostor" hard />
            </b>
            Los demás tienen algo <u>parecido</u>, no igual. ¡Camúflate!
          </div>
        )}
        {role === 'imp-classic' && (
          <div className="role-banner imp" style={{ marginTop: 0 }}>
            <b>
              <Glitch text="🔪 Eres el impostor" hard />
            </b>
            No sabes la carta. Solo conoces {topic ? 'el tema' : 'la categoría'}:{' '}
            <b style={{ display: 'inline', fontSize: 'inherit', fontFamily: 'inherit' }}>{topic ?? c.name}</b>. Escucha, imita y sobrevive.
          </div>
        )}
      </div>
    </>
  );
}

export function CardBack({ label }: { label?: ReactNode }) {
  return (
    <>
      <div className="back-pattern" />
      <div className="center" style={{ position: 'relative', gap: 8 }}>
        <div style={{ fontSize: 76, filter: 'drop-shadow(0 0 24px rgba(255,46,77,.6))' }}>👁️</div>
        <div className="display" style={{ fontSize: 40 }}>
          <Glitch text="IMPOSTOR" />
        </div>
        {label}
      </div>
    </>
  );
}

/**
 * Carta 3D con volteo por resorte, inclinación que sigue el dedo o el giroscopio,
 * y brillo holográfico. `flipped` = mostrando el frente.
 */
export function GameCard({
  flipped,
  front,
  back,
  onPointerDown,
  onPointerUp,
  glow,
}: {
  flipped: boolean;
  front: ReactNode;
  back?: ReactNode;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  glow?: string;
}) {
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const sx = useSpring(tx, { stiffness: 150, damping: 15 });
  const sy = useSpring(ty, { stiffness: 150, damping: 15 });
  const flip = useSpring(flipped ? 180 : 0, { stiffness: 260, damping: 22 });

  useEffect(() => {
    flip.set(flipped ? 180 : 0);
  }, [flipped, flip]);

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      tx.set(Math.max(-1, Math.min(1, e.gamma / 25)));
      ty.set(Math.max(-1, Math.min(1, (e.beta - 45) / 25)));
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [tx, ty]);

  const rotY = useTransform([flip, sx], ([f, x]: number[]) => f + x * 12);
  const rotX = useTransform(sy, (y) => -y * 12);
  const hx = useTransform(sx, (x) => `${50 + x * 40}%`);
  const hy = useTransform(sy, (y) => `${50 + y * 40}%`);
  const gx = useTransform(sx, (x) => `${50 - x * 50}%`);
  const gy = useTransform(sy, (y) => `${30 - y * 40}%`);
  const holoBg = useMotionTemplate`${hx} ${hy}`;

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    ty.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  return (
    <div
      className="card-wrap"
      onPointerMove={move}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e);
        onPointerDown?.();
      }}
      onPointerUp={() => {
        tx.set(0);
        ty.set(0);
        onPointerUp?.();
      }}
      onPointerCancel={() => onPointerUp?.()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: '-8%',
            borderRadius: 40,
            background: glow,
            filter: 'blur(40px)',
            opacity: 0.55,
          }}
        />
      )}
      <motion.div className="card3d" style={{ rotateY: rotY, rotateX: rotX }}>
        <div className="face back">
          {back ?? <CardBack />}
          <motion.div className="holo" style={{ backgroundPosition: holoBg }} />
        </div>
        <div className="face front">
          {front}
          <motion.div className="holo" style={{ backgroundPosition: holoBg, opacity: 0.3 }} />
          <motion.div className="glare" style={{ '--gx': gx, '--gy': gy } as unknown as CSSProperties} />
        </div>
      </motion.div>
    </div>
  );
}
