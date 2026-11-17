import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { elimSound } from '../audio/eliminations';
import { haptic, sfx } from '../audio/sfx';
import { ELIM_BY_ID, ELIMS, elimFor, elimVideo, type ElimChoice, type ElimStyle } from '../data/eliminations';
import { changeElim } from '../net/net';
import type { Player } from '../store/game';
import { Avatar } from './ui';

/** Píxeles por unidad de la escena de Blender (el video vertical 1:2 cubre la pantalla; 20 unidades de alto). */
const sceneUnit = () => Math.max(window.innerHeight, window.innerWidth * 2) / 20;

type Anim = { animate: TargetAndTransition; transition: Transition; rocket?: boolean };

/** Cómo se mueve el avatar en cada animación, al compás del video. */
function avatarAnim(s: ElimStyle, u: number): Anim {
  const d = s.dur;
  const T = (secs: number[]) => secs.map((x) => Math.min(1, x / d));
  if (s.id === 'rayo') {
    const h = s.hit;
    const jt: number[] = [];
    const jx: number[] = [];
    for (let t = 0, i = 0; t < h; t += 0.06, i++) {
      jt.push(t);
      jx.push((i % 2 ? 1 : -1) * (2 + (8 * t) / h));
    }
    return {
      animate: {
        x: [...jx, 0, 10, -10, 6, 0, 0],
        // Mismas funciones en todos los cuadros (si no, no se pueden mezclar).
        filter: [
          'brightness(1) sepia(0) contrast(1) saturate(1)',
          'brightness(1) sepia(0) contrast(1) saturate(1)',
          'brightness(4) sepia(0) contrast(1) saturate(0)',
          'brightness(0.3) sepia(1) contrast(1.4) saturate(1)',
          'brightness(0.3) sepia(1) contrast(1.4) saturate(1)',
        ],
        scale: [1, 1, 1.18, 1, 1, 0.9],
        scaleY: [1, 1, 0.25],
        y: [0, 0, 0.9 * u],
        opacity: [1, 1, 0],
      },
      transition: {
        x: { duration: d, times: T([...jt, h, h + 0.05, h + 0.1, h + 0.15, h + 0.25, d]) },
        filter: { duration: d, times: T([0, h - 0.01, h, h + 0.25, d]) },
        scale: { duration: d, times: T([0, h, h + 0.05, h + 0.25, 1.5, 2.0]) },
        scaleY: { duration: d, times: T([0, 1.5, 2.0]) },
        y: { duration: d, times: T([0, 1.5, 2.0]) },
        opacity: { duration: d, times: T([0, 1.65, 2.05]) },
      },
    };
  }
  if (s.id === 'agujero') {
    const ts: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const rs: number[] = [];
    const ss: number[] = [];
    const sx: number[] = [];
    const end = s.hit - 0.12;
    for (let i = 0; i <= 28; i++) {
      const t = (end * i) / 28;
      const p = Math.max(0, (t - 0.35) / (end - 0.35));
      const r = 2.2 * u * (p < 0.3 ? p / 0.3 : (1 - p) / 0.7);
      const a = p * Math.PI * 4.5;
      ts.push(t);
      xs.push(r * Math.cos(a));
      ys.push(r * Math.sin(a) * 0.82);
      rs.push(p * 900 + (t < 0.35 ? Math.sin(t * 40) * 8 : 0));
      ss.push(Math.max(0.03, 1 - 0.97 * Math.pow(p, 1.4)));
      sx.push(1 + 0.6 * p);
    }
    return {
      animate: { x: xs, y: ys, rotate: rs, scale: ss, scaleX: sx, opacity: [1, 1, 0] },
      transition: {
        x: { duration: d, times: T(ts) },
        y: { duration: d, times: T(ts) },
        rotate: { duration: d, times: T(ts) },
        scale: { duration: d, times: T(ts) },
        scaleX: { duration: d, times: T(ts) },
        opacity: { duration: d, times: T([0, end - 0.15, end]) },
      },
    };
  }
  if (s.id === 'pinata') {
    const [h1, h2, pop] = [10 / 24, 22 / 24, s.hit];
    const ts: number[] = [];
    const rot: number[] = [];
    for (let t = 0; t < pop; t += 0.08) {
      ts.push(t);
      rot.push(Math.sin(t * 7) * 14 + (Math.abs(t - h1) < 0.1 || Math.abs(t - h2) < 0.1 ? 18 : 0));
    }
    return {
      animate: {
        rotate: [...rot, 0],
        scaleX: [1, 1, 1.3, 1, 1, 1.35, 1, 1, 1.6, 0],
        scaleY: [1, 1, 0.78, 1, 1, 0.74, 1, 1, 1.5, 0],
        opacity: [1, 1, 0],
      },
      transition: {
        rotate: { duration: d, times: T([...ts, pop]) },
        scaleX: { duration: d, times: T([0, h1, h1 + 0.05, h1 + 0.18, h2, h2 + 0.05, h2 + 0.18, pop - 0.02, pop, pop + 0.08]) },
        scaleY: { duration: d, times: T([0, h1, h1 + 0.05, h1 + 0.18, h2, h2 + 0.05, h2 + 0.18, pop - 0.02, pop, pop + 0.08]) },
        opacity: { duration: d, times: T([0, pop + 0.02, pop + 0.1]) },
      },
    };
  }
  // Cohete: tiembla y sale disparado (z = 14·t² unidades, igual que en la escena).
  const launch = s.hit;
  const ts = [0];
  const ys = [0];
  const xs = [0];
  for (let t = 0.05; t < launch; t += 0.05) {
    ts.push(t);
    ys.push(0);
    xs.push(Math.sin(t * 90) * 3);
  }
  for (let t = 0; t <= 1.0; t += 0.05) {
    ts.push(launch + t);
    ys.push(-14 * t * t * u);
    xs.push(Math.sin(t * 30) * 2);
  }
  return {
    animate: { y: ys, x: xs },
    transition: { y: { duration: d, times: T(ts) }, x: { duration: d, times: T(ts) } },
    rocket: true,
  };
}

/**
 * Cada propiedad termina con un cuadro en el tiempo 1 que repite el último valor: si los tiempos
 * acaban antes, Framer sigue de largo la última tendencia (el avatar "reaparecía").
 */
function holdLast(a: Anim): Anim {
  const animate: Record<string, unknown> = { ...a.animate };
  const transition: Record<string, unknown> = { ...(a.transition as Record<string, unknown>) };
  for (const [key, t] of Object.entries(transition)) {
    const vals = animate[key];
    const tt = t as { times?: number[] };
    if (!Array.isArray(vals) || !tt.times?.length) continue;
    const times = tt.times.slice(0, vals.length);
    if (times[times.length - 1] < 1) {
      animate[key] = [...vals, vals[vals.length - 1]];
      transition[key] = { ...tt, times: [...times, 1] };
    }
  }
  return { ...a, animate: animate as TargetAndTransition, transition: transition as Transition };
}

/**
 * Animación de eliminación a pantalla completa: el video de Blender, el avatar encima al compás y
 * su sonido. Un toque la salta.
 */
export function EliminationCutscene({ player, style, onDone }: { player: Player; style: ElimStyle; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [go, setGo] = useState(false);
  const [hit, setHit] = useState(false);
  const u = useMemo(sceneUnit, []);
  const anim = useMemo(() => holdLast(avatarAnim(style, u)), [style, u]);
  const done = useRef(onDone);
  done.current = onDone;

  // Empieza cuando el video ya corre (o de todos modos, si tarda o no carga).
  useEffect(() => {
    const v = video.current;
    const start = () => setGo(true);
    v?.addEventListener('playing', start, { once: true });
    void v?.play().catch(start);
    const t = setTimeout(start, 700);
    return () => {
      clearTimeout(t);
      v?.removeEventListener('playing', start);
    };
  }, []);

  useEffect(() => {
    if (!go) return;
    elimSound(style.id);
    const ts = [
      setTimeout(() => {
        haptic([60, 40, 160]);
        setHit(true);
      }, style.hit * 1000),
      setTimeout(() => done.current(), style.dur * 1000 + 250),
    ];
    return () => ts.forEach(clearTimeout);
  }, [go, style]);

  // Va directo al <body>: así nada (una hoja, la pantalla que tiembla) la encierra.
  return createPortal(
    <motion.div className="elim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => done.current()}>
      <motion.div className="elim-shake" animate={hit ? { x: [0, -14, 12, -8, 6, 0], y: [0, 8, -6, 4, 0, 0] } : undefined} transition={{ duration: 0.45 }}>
        <video ref={video} className="elim-video" src={elimVideo(style.id)} muted playsInline preload="auto" />
        <div className="elim-stage">
          <motion.div key={go ? 'go' : 'wait'} className="elim-avatar" animate={go ? anim.animate : {}} transition={anim.transition}>
            <Avatar player={player} size={Math.round(u * 2.6)} mood="scared" still />
            {anim.rocket && <span className="elim-rocket">🚀</span>}
          </motion.div>
        </div>
        <motion.div className="elim-name" initial={{ opacity: 0, y: 20 }} animate={go ? { opacity: 1, y: 0 } : undefined} transition={{ delay: style.hit + 0.25 }}>
          <span>¡Adiós,</span> <b>{player.name}!</b>
        </motion.div>
      </motion.div>
      <div className="elim-skip">Toca para saltar</div>
    </motion.div>,
    document.body,
  );
}

/** Para escoger con qué animación te eliminan (o sorpresa), con vista previa. */
export function ElimPicker({ player }: { player: Player }) {
  const [preview, setPreview] = useState<ElimStyle | null>(null);
  const current: ElimChoice = player.elim ?? 'random';
  const options: { id: ElimChoice; emoji: string; name: string }[] = [...ELIMS.map((e) => ({ id: e.id as ElimChoice, emoji: e.emoji, name: e.name })), { id: 'random', emoji: '🎲', name: 'Sorpresa' }];
  const desc = current === 'random' ? 'Cada vez una distinta.' : ELIM_BY_ID[current].desc;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="label">💀 Si te eliminan…</div>
      <div className="elim-pick">
        {options.map((o) => (
          <motion.button
            key={o.id}
            whileTap={{ scale: 0.9 }}
            className={current === o.id ? 'on' : ''}
            aria-pressed={current === o.id}
            onClick={() => {
              sfx.select();
              changeElim(player.id, o.id);
            }}
          >
            <span>{o.emoji}</span>
            <small>{o.name}</small>
          </motion.button>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="dim grow" style={{ fontSize: 12.5 }}>
          {desc}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="chip"
          onClick={() => {
            sfx.unlock();
            setPreview(elimFor(current, `${Date.now()}`));
          }}
        >
          ▶ Ver
        </motion.button>
      </div>
      <AnimatePresence>{preview && <EliminationCutscene key={preview.id} player={player} style={preview} onDone={() => setPreview(null)} />}</AnimatePresence>
    </div>
  );
}
