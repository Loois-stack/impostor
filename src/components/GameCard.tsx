import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { BY_CAT } from '../data';
import { CAT } from '../data/categories';
import { CH_BY_ID } from '../data/challenges';
import type { CategoryId, Item } from '../data/types';
import { PTS } from '../engine/scoring';
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
          // Con CORS la respuesta se puede guardar de verdad para jugar sin internet.
          crossOrigin={url.startsWith('data:') ? undefined : 'anonymous'}
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
  kind: 'accomplice' | 'detective' | 'jester';
  text: string;
}

const NOTE_META: Record<CardNote['kind'], { icon: string; title: string; cls: string }> = {
  accomplice: { icon: '🤝', title: 'Eres el cómplice', cls: 'ally' },
  detective: { icon: '🔎', title: 'Eres el detective', cls: 'det' },
  jester: { icon: '🃏', title: 'Eres el bufón', cls: 'jest' },
};

function RoleBanner({ cls, icon, title, children, glitch }: { cls: string; icon: string; title: string; children: ReactNode; glitch?: boolean }) {
  return (
    <div className={`role-banner ${cls}`}>
      <span className="role-icon">{icon}</span>
      <span className="role-text">
        <b>{glitch ? <Glitch text={title} hard /> : title}</b>
        {children}
      </span>
    </div>
  );
}

export function CardFront({
  item,
  cat,
  role,
  note,
  topic,
  mission,
}: {
  item: Item | null;
  cat: CategoryId;
  role: CardRole;
  note?: CardNote;
  /** Tema de la ronda en modo Mezcla. */
  topic?: string;
  /** Id de la misión secreta que le tocó a este jugador. */
  mission?: string;
}) {
  const c = CAT[cat];
  const hidden = role === 'imp-classic';
  const pool = BY_CAT[cat] ?? [];
  const num = item ? pool.findIndex((i) => i.id === item.id) + 1 : 0;
  const ms = mission ? CH_BY_ID[mission] : undefined;
  return (
    <div className="card-inner" style={{ '--cc': c.color, '--cc2': c.color2 } as CSSProperties}>
      <div className="cat-chip" style={{ color: hidden && topic ? '#fff' : c.color }}>
        {hidden && topic ? `🔀 ${topic}` : `${c.emoji} ${c.name}`}
      </div>
      {num > 0 && !hidden && (
        <div className="card-num">
          {String(num).padStart(2, '0')}
          <small>/{pool.length}</small>
        </div>
      )}
      <CardArt item={hidden ? null : item} cat={cat} />
      <div className="card-body">
        <div className={`card-name ${c.horror && cat !== 'scp' ? 'horror-font' : ''} ${(item?.name.length ?? 0) > 16 ? 'long' : ''}`}>
          {hidden ? '???' : item?.name}
        </div>
        <div className="card-rule" />
        {!hidden && item && <div className={`card-ctx ${ms ? 'short' : ''}`}>{item.ctx}</div>}
        {ms && (
          <div className="mission">
            <b>🤫 Misión secreta · +{PTS.missionDone}</b>
            {ms.text}
          </div>
        )}
        {note && (
          <RoleBanner cls={NOTE_META[note.kind].cls} icon={NOTE_META[note.kind].icon} title={NOTE_META[note.kind].title}>
            {note.text}
          </RoleBanner>
        )}
        {role === 'civil' && !note && (
          <RoleBanner cls="civil" icon="🛡️" title="Eres civil">
            Defiende esta carta. El impostor tiene algo <u>parecido</u>.
          </RoleBanner>
        )}
        {role === 'imp' && (
          <RoleBanner cls="imp" icon="🔪" title="Eres el impostor" glitch>
            Los demás tienen algo <u>parecido</u>, no igual. ¡Camúflate!
          </RoleBanner>
        )}
        {hidden && (
          <RoleBanner cls="imp" icon="🔪" title="Eres el impostor" glitch>
            No sabes la carta. Solo conoces {topic ? 'el tema' : 'la categoría'}: <strong>{topic ?? c.name}</strong>. Escucha, imita y sobrevive.
          </RoleBanner>
        )}
      </div>
    </div>
  );
}

/** Reverso de la carta. Sus colores salen del tema visual elegido. */
export function CardBack({ label, small, hint }: { label?: ReactNode; small?: boolean; /** Deja libre la parte de abajo para la instrucción. */ hint?: boolean }) {
  return (
    <div className={`card-back ${small ? 'small' : ''} ${hint ? 'with-hint' : ''}`}>
      <div className="back-frame" />
      <div className="back-rosette" />
      <span className="pip tl">?</span>
      {!hint && <span className="pip br">?</span>}
      <div className="back-emblem">
        <span className="back-eye">👁️</span>
        {!small && (
          <div className="display back-title">
            <Glitch text="IMPOSTOR" />
          </div>
        )}
        {label}
      </div>
    </div>
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
  const lift = useTransform(flip, [0, 90, 180], [1, 1.06, 1]);
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
      {glow && <div className="card-glow" style={{ background: glow }} />}
      <motion.div className="card3d" style={{ rotateY: rotY, rotateX: rotX, scale: lift }}>
        <div className="face back">
          {back ?? <CardBack />}
          <motion.div className="holo" style={{ backgroundPosition: holoBg }} />
        </div>
        <div className="face front">
          {front}
          <motion.div className="holo" style={{ backgroundPosition: holoBg, opacity: 0.28 }} />
          <motion.div className="glare" style={{ '--gx': gx, '--gy': gy } as unknown as CSSProperties} />
        </div>
      </motion.div>
    </div>
  );
}
