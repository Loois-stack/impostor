import { AnimatePresence, motion, type TargetAndTransition, type Transition } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { elimSound } from '../audio/eliminations';
import { haptic, sfx } from '../audio/sfx';
import { ELIM_BY_ID, ELIMS, elimFor, elimVideo, type ElimChoice, type ElimStyle } from '../data/eliminations';
import { changeElim } from '../net/net';
import type { Player } from '../store/game';
import { Avatar } from './ui';

/** Píxeles por unidad de la escena de Blender (el video vertical 1:2 cubre la pantalla; 20 unidades de alto). */
const sceneUnit = () => Math.max(window.innerHeight, window.innerWidth * 2) / 20;

/** Algo que se dibuja encima del avatar (la calavera de rayos X, el cohete…), con su propio movimiento. */
type Overlay = { emoji: string; className: string; animate?: TargetAndTransition; transition?: Transition };
type Anim = { animate: TargetAndTransition; transition: Transition; overlay?: Overlay };

/** Prende y apaga en estos intervalos (en segundos): para parpadeos al compás de los cuadros del video. */
function blink(d: number, on: [number, number, number][]) {
  const ts = [0];
  const vs = [0];
  for (const [a, b, v] of on) {
    ts.push(a - 0.002, a, b - 0.002, b);
    vs.push(0, v, v, 0);
  }
  return { values: vs, times: ts.map((x) => Math.min(1, Math.max(0, x / d))) };
}

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
    // Rayos X: la calavera se ve en las descargas (cuadros 22, 24 y 26 del video).
    const f = 1 / 24;
    // Un poco más largos que los destellos del video, para que se alcance a ver el chiste.
    const skull = blink(d, [
      [h, h + 2 * f, 1],
      [h + 3 * f, h + 5 * f, 1],
      [h + 6 * f, h + 7.5 * f, 0.75],
    ]);
    return {
      overlay: { emoji: '💀', className: 'elim-skull', animate: { opacity: skull.values }, transition: { opacity: { duration: d, times: skull.times } } },
      animate: {
        x: [...jx, 0, 10, -10, 6, 0, 0],
        // Mismas funciones en todos los cuadros (si no, no se pueden mezclar). Se carga de electricidad
        // (brillo azul), queda blanco con el rayo y luego carbonizado, con brasas.
        filter: [
          'brightness(1) sepia(0) contrast(1) saturate(1) drop-shadow(0px 0px 0px rgba(130,190,255,0))',
          'brightness(1) sepia(0) contrast(1) saturate(1) drop-shadow(0px 0px 0px rgba(130,190,255,0))',
          'brightness(1.15) sepia(0) contrast(1) saturate(0.8) drop-shadow(0px 0px 18px rgba(130,190,255,0.9))',
          'brightness(4) sepia(0) contrast(1) saturate(0) drop-shadow(0px 0px 30px rgba(210,235,255,1))',
          'brightness(0.3) sepia(1) contrast(1.4) saturate(1) drop-shadow(0px 0px 8px rgba(255,120,40,0.7))',
          'brightness(0.3) sepia(1) contrast(1.4) saturate(1) drop-shadow(0px 0px 3px rgba(255,120,40,0.35))',
        ],
        scale: [1, 1, 1.18, 1, 1, 0.9],
        scaleY: [1, 1, 0.25],
        y: [0, 0, 0.9 * u],
        opacity: [1, 1, 0],
      },
      transition: {
        x: { duration: d, times: T([...jt, h, h + 0.05, h + 0.1, h + 0.15, h + 0.25, d]) },
        filter: { duration: d, times: T([0, 0.42, h - 0.01, h, h + 0.25, d]) },
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
    const fl: string[] = [];
    const end = s.hit - 0.12;
    for (let i = 0; i <= 28; i++) {
      const t = (end * i) / 28;
      const p = Math.max(0, (t - 0.35) / (end - 0.35));
      const r = 2.3 * u * (p < 0.3 ? p / 0.3 : (1 - p) / 0.7);
      const a = p * Math.PI * 4.5;
      ts.push(t);
      xs.push(r * Math.cos(a));
      // Gira casi en el plano del disco: más chico cuando pasa por atrás.
      ys.push(r * Math.sin(a) * 0.42);
      rs.push(p * 900 + (t < 0.35 ? Math.sin(t * 40) * 8 : 0));
      ss.push(Math.max(0.03, (1 - 0.97 * Math.pow(p, 1.4)) * (1 - 0.12 * Math.sin(a) * Math.min(1, p * 4))));
      // Se estira (espaguetización) y se corre al rojo mientras cae.
      sx.push(1 + 0.8 * p);
      fl.push(`hue-rotate(${(-55 * p).toFixed(1)}deg) saturate(${(1 + p).toFixed(2)}) brightness(${(1 - 0.45 * p).toFixed(2)}) blur(${(2.2 * p * p).toFixed(2)}px)`);
    }
    return {
      animate: { x: xs, y: ys, rotate: rs, scale: ss, scaleX: sx, filter: fl, opacity: [1, 1, 0] },
      transition: {
        x: { duration: d, times: T(ts) },
        y: { duration: d, times: T(ts) },
        rotate: { duration: d, times: T(ts) },
        scale: { duration: d, times: T(ts) },
        scaleX: { duration: d, times: T(ts) },
        filter: { duration: d, times: T(ts) },
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
  if (s.id === 'ovni') {
    // Tiembla mirando el platillo, el rayo lo levanta girando (cuadros 14–47) y se lo traga (48).
    const [lift, top] = [14 / 24, s.hit - 0.04];
    const ts: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const rs: number[] = [];
    const ss: number[] = [];
    for (let t = 0; t < lift; t += 0.05) {
      ts.push(t);
      xs.push(Math.sin(t * 70) * 3 * (t / lift));
      ys.push(0);
      rs.push(0);
      ss.push(1);
    }
    for (let i = 0; i <= 24; i++) {
      const p = i / 24;
      const e = p * p * (3 - 2 * p);
      ts.push(lift + (top - lift) * p);
      xs.push(Math.sin(p * 9) * 0.25 * u);
      ys.push(-5.0 * u * e + Math.sin(p * 14) * 0.08 * u);
      rs.push(300 * e + Math.sin(p * 11) * 10);
      ss.push(1 - 0.45 * e);
    }
    ts.push(s.hit, s.hit + 0.08);
    xs.push(0, 0);
    ys.push(-5.25 * u, -5.4 * u);
    rs.push(320, 330);
    ss.push(0.5, 0);
    return {
      animate: {
        x: xs,
        y: ys,
        rotate: rs,
        scale: ss,
        filter: [
          'brightness(1) drop-shadow(0px 0px 0px rgba(120,255,220,0))',
          'brightness(1) drop-shadow(0px 0px 0px rgba(120,255,220,0))',
          'brightness(1.3) drop-shadow(0px 0px 18px rgba(120,255,220,0.95))',
          'brightness(1.5) drop-shadow(0px 0px 24px rgba(160,255,230,1))',
        ],
        opacity: [1, 1, 0],
      },
      transition: {
        x: { duration: d, times: T(ts) },
        y: { duration: d, times: T(ts) },
        rotate: { duration: d, times: T(ts) },
        scale: { duration: d, times: T(ts) },
        filter: { duration: d, times: T([0, 12 / 24, 16 / 24, s.hit]) },
        opacity: { duration: d, times: T([0, s.hit + 0.04, s.hit + 0.1]) },
      },
    };
  }
  if (s.id === 'hielo') {
    // Tirita de frío, se congela (cuadros 10–30), da tironcitos al cuartearse y estalla (40).
    const h = s.hit;
    const ts: number[] = [];
    const xs: number[] = [];
    for (let t = 0; t < 1.25; t += 0.04) {
      ts.push(t);
      xs.push(Math.sin(t * 95) * 5 * Math.max(0, 1 - t / 1.25));
    }
    for (const c of ICE_CRACKS) {
      ts.push(c - 0.01, c, c + 0.04, c + 0.08);
      xs.push(0, 4, -3, 0);
    }
    ts.push(h);
    xs.push(0);
    return {
      animate: {
        x: xs,
        filter: ['saturate(1) brightness(1) contrast(1)', 'saturate(0.8) brightness(1.05) contrast(1)', 'saturate(0.35) brightness(1.18) contrast(0.92)', 'saturate(0.35) brightness(1.18) contrast(0.92)'],
        opacity: [1, 1, 0],
      },
      transition: {
        x: { duration: d, times: T(ts) },
        filter: { duration: d, times: T([0, 10 / 24, 30 / 24, d]) },
        opacity: { duration: d, times: T([0, h - 0.001, h]) },
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
  // Se encoge tantito (agarra vuelo), se estira al salir disparado y vuelve a su forma en el aire.
  const sq = [0, launch * 0.5, launch - 0.02, launch + 0.08, launch + 0.3, d];
  return {
    animate: { y: ys, x: xs, scaleY: [1, 0.86, 0.8, 1.3, 1.08, 1.08], scaleX: [1, 1.08, 1.12, 0.82, 0.95, 0.95] },
    transition: {
      y: { duration: d, times: T(ts) },
      x: { duration: d, times: T(ts) },
      scaleY: { duration: d, times: T(sq) },
      scaleX: { duration: d, times: T(sq) },
    },
    overlay: { emoji: '🚀', className: 'elim-rocket' },
  };
}

/**
 * Framer pasa la opacidad y los filtros a la animación nativa del navegador (WAAPI), que arranca con
 * un reloj viejo: iban ~0.45 s adelantados al video. Con `onUpdate` todo corre en el mismo reloj.
 */
const SAME_CLOCK = { onUpdate: () => {} };

/** Cuándo se cuartea el hielo (cuadros 32, 35 y 38 del video). */
const ICE_CRACKS = [32 / 24, 35 / 24, 38 / 24];
const CRACKS = ['M50 8 L46 30 L55 44 L48 62', 'M14 40 L32 46 L46 30 M55 44 L74 52 L90 46', 'M48 62 L36 78 L40 94 M48 62 L64 80 L70 96'];

/** El bloque de hielo que se forma encima del avatar, con sus grietas. */
function IceBlock({ d, go, still }: { d: number; go: boolean; still?: boolean }) {
  const T = (xs: number[]) => xs.map((x) => Math.min(1, x / d));
  return (
    <motion.div
      className="elim-ice"
      {...SAME_CLOCK}
      initial={still ? false : { scaleY: 0, opacity: 0 }}
      animate={still ? undefined : go ? { scaleY: [0, 0, 1.06, 1], opacity: [0, 0, 1, 1] } : {}}
      transition={{ duration: d, times: T([0, 10 / 24, 28 / 24, 30 / 24]) }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {CRACKS.map((p, i) => (
          <motion.path
            key={i}
            {...SAME_CLOCK}
            d={p}
            initial={still ? false : { pathLength: 0, opacity: 0 }}
            animate={still ? undefined : go ? { pathLength: [0, 0, 1], opacity: [0, 0, 1] } : {}}
            transition={{ duration: d, times: T([0, ICE_CRACKS[i] - 0.002, ICE_CRACKS[i] + 0.07]) }}
          />
        ))}
      </svg>
    </motion.div>
  );
}

/** Pedazos en que estalla el hielo (en % del bloque): salen desde el centro. */
const SHARDS: [number, number][][] = (() => {
  const c: [number, number] = [48, 55];
  const ring: [number, number][] = [
    [0, 20], [0, 0], [30, 0], [75, 0], [100, 0], [100, 30], [100, 75], [100, 100], [65, 100], [20, 100], [0, 100], [0, 70],
  ];
  // Pedazos: centro + tramos del contorno (las esquinas van con su vecino).
  const cuts = [[0, 1, 2], [2, 3], [3, 4, 5], [5, 6], [6, 7, 8], [8, 9], [9, 10, 11], [11, 0]];
  return cuts.map((idx) => [c, ...idx.map((i) => ring[i])]);
})();

function IceShards({ player, size, style }: { player: Player; size: number; style: ElimStyle }) {
  const d = style.dur;
  const h = style.hit;
  const T = (xs: number[]) => xs.map((x) => Math.min(1, x / d));
  return (
    <>
      {SHARDS.map((poly, i) => {
        const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length - 48;
        const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length - 55;
        const len = Math.hypot(cx, cy) || 1;
        const v = size * (1.4 + (i % 3) * 0.35);
        const dx = (cx / len) * v;
        const dy = (cy / len) * v;
        return (
          <motion.div
            key={i}
            className="elim-shard"
            {...SAME_CLOCK}
            style={{ width: size * 1.24, height: size * 1.24 }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0, 1, 1, 0],
              x: [0, 0, dx * 0.55, dx],
              y: [0, 0, dy * 0.55 - size * 0.25, dy + size * 2.2],
              rotate: [0, 0, (i % 2 ? 1 : -1) * 70, (i % 2 ? 1 : -1) * 200],
              scale: [1, 1, 0.95, 0.7],
            }}
            transition={{
              opacity: { duration: d, times: T([0, h - 0.001, h, h + 0.7, h + 1.2]) },
              x: { duration: d, times: T([0, h, h + 0.25, d]) },
              y: { duration: d, times: T([0, h, h + 0.25, d]) },
              rotate: { duration: d, times: T([0, h, h + 0.25, d]) },
              scale: { duration: d, times: T([0, h, h + 0.25, d]) },
            }}
          >
            {/* El recorte va adentro: así el brillo de la orilla (filter) no se corta. */}
            <div className="elim-shard-cut" style={{ clipPath: `polygon(${poly.map(([x, y]) => `${x}% ${y}%`).join(',')})` }}>
              <div className="elim-shard-in" style={{ filter: 'saturate(0.35) brightness(1.18) contrast(0.92)' }}>
                <Avatar player={player} size={size} mood="scared" still />
              </div>
              <IceBlock d={d} go still />
            </div>
          </motion.div>
        );
      })}
    </>
  );
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

  // Empieza cuando ya se ve el primer cuadro del video (o de todos modos, si tarda o no carga).
  // "playing" llega antes de que se pinte el cuadro: con eso el avatar iba unas décimas adelantado.
  useEffect(() => {
    const v = video.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
    const start = () => setGo(true);
    if (v?.requestVideoFrameCallback) v.requestVideoFrameCallback(start);
    else v?.addEventListener('playing', start, { once: true });
    void v?.play().catch(start);
    const t = setTimeout(start, 900);
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
          <motion.div
            key={go ? 'go' : 'wait'}
            {...SAME_CLOCK}
            className="elim-avatar"
            style={{ '--elim-size': `${Math.round(u * 2.6)}px` } as CSSProperties}
            animate={go ? anim.animate : {}}
            transition={anim.transition}
          >
            <Avatar player={player} size={Math.round(u * 2.6)} mood="scared" still />
            {style.id === 'hielo' && <IceBlock d={style.dur} go={go} />}
            {anim.overlay && (
              <motion.span className={anim.overlay.className} {...SAME_CLOCK} animate={go && anim.overlay.animate ? anim.overlay.animate : {}} transition={anim.overlay.transition}>
                {anim.overlay.emoji}
              </motion.span>
            )}
          </motion.div>
          {style.id === 'hielo' && go && <IceShards player={player} size={Math.round(u * 2.6)} style={style} />}
        </div>
        <motion.div className="elim-name" {...SAME_CLOCK} initial={{ opacity: 0, y: 20 }} animate={go ? { opacity: 1, y: 0 } : undefined} transition={{ delay: style.hit + 0.25 }}>
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
