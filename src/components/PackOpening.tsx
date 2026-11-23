import { animate, AnimatePresence, motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fireBurn, fireIgnite } from '../audio/fire';
import { haptic, sfx } from '../audio/sfx';
import { openOf, type OpenId } from '../data/openings';
import { DESIGN_BY_ID, GLOW_BY_ID, GLOWS, PACK_DESIGNS, type Glow, type PackDesign, type PackDesignId, type PackRoll } from '../data/packs';
import { startBlueFire, warmBlueFire } from '../fx/bluefire';
import { burst, flash, shake } from '../fx/fx';
import { emojiRain } from '../fx/scene';
import { CardBack } from './GameCard';
import { Glitch } from './ui';

/** Parte de arriba del sobre que se corta (fracción del alto). */
const STRIP = 0.17;
const TEETH = 18;

/** Bordes sellados en zigzag arriba y abajo, como un sobre de verdad. */
const CRIMP = (() => {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= TEETH * 2; i++) {
    const x = (i / (TEETH * 2)) * 100;
    top.push(`${x.toFixed(2)}% ${i % 2 ? 0 : 1.4}%`);
    bottom.push(`${(100 - x).toFixed(2)}% ${i % 2 ? 100 : 98.6}%`);
  }
  return `polygon(${[...top, ...bottom].join(', ')})`;
})();

export const designOf = (roll?: PackRoll) => DESIGN_BY_ID[roll?.d as PackDesignId] ?? PACK_DESIGNS[0];
export const glowOf = (roll?: PackRoll) => GLOW_BY_ID[roll?.g as Glow['id']] ?? GLOWS[0];

/** Halo detrás de la carta: un degradado con los colores del brillo. */
export const glowHalo = (g: Glow) =>
  g.colors.length > 3 ? `conic-gradient(${[...g.colors, g.colors[0]].join(', ')})` : `radial-gradient(circle, ${g.colors[1]}, ${g.colors[2]} 55%, transparent 75%)`;

/** Variables CSS con los colores del brillo. */
const glowVars = (g: Glow) => ({ '--g1': g.colors[0], '--g2': g.colors[1], '--g3': g.colors[2] ?? g.colors[1], '--g4': g.colors[3] ?? g.colors[2] ?? g.colors[1] }) as CSSProperties;

/** Adornos propios de cada diseño de sobre (todo con CSS: sin imágenes, funciona sin internet). */
function Decor({ id }: { id: PackDesignId }) {
  switch (id) {
    case 'clasico':
      return <div className="pack-rosette" />;
    case 'holo':
      return (
        <>
          <div className="holo-swirl" />
          <div className="holo-shards" />
        </>
      );
    case 'misterio':
      return (
        <>
          <div className="mys-qs" />
          <div className="mys-spot" />
        </>
      );
    case 'fiesta':
      return (
        <>
          <div className="fie-confetti" />
          <div className="picado">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </div>
        </>
      );
    case 'expediente':
      return (
        <>
          <div className="exp-print" />
          <div className="exp-stamp">Confidencial</div>
        </>
      );
    case 'galaxia':
      return (
        <>
          <div className="gal-nebula" />
          <div className="gal-stars" />
          <div className="gal-stars b" />
        </>
      );
    case 'arcade':
      return (
        <>
          <div className="arc-sun" />
          <div className="arc-grid" />
        </>
      );
    case 'terror':
      return (
        <>
          <div className="ter-fog" />
          <div className="ter-drips" />
        </>
      );
  }
}

/** Arte del sobre (diseño propio). Se dibuja completo dentro de la tira y del cuerpo para que encajen. */
export function PackArt({ design, owner, edition, small }: { design: PackDesign; owner?: string; edition?: string; small?: boolean }) {
  return (
    <div className={`pack-art pd-${design.id} ${small ? 'small' : ''}`} style={{ '--pc': design.c1, '--pc2': design.c2 } as CSSProperties}>
      <Decor id={design.id} />
      <div className="pack-foil" />
      <div className="pack-crimp top" />
      <div className="pack-crimp bottom" />
      {!small && (
        <div className="pack-badge">
          <b>×1</b>
          <small>carta secreta</small>
        </div>
      )}
      <div className="pack-center">
        <div className="pack-eye">{design.emoji}</div>
        <div className={`display pack-logo ${design.horror ? 'horror-font' : ''}`}>IMPOSTOR</div>
        {!small && <div className="pack-sub">{design.motto}</div>}
      </div>
      {owner && (
        <div className="pack-owner">
          <small>Sobre de</small>
          <b>{owner}</b>
        </div>
      )}
      {edition && <div className="pack-edition">{edition}</div>}
      {!small && <div className="pack-fine">El brillo es pura suerte: no dice quién es impostor.</div>}
    </div>
  );
}

/** Sobre chiquito, para el barajeo y la pila de sobres que quedan. */
export function MiniPack({ roll, style }: { roll?: PackRoll; style?: CSSProperties }) {
  return (
    <div className="mini-pack" style={{ clipPath: CRIMP, ...style }}>
      <PackArt design={designOf(roll)} small />
    </div>
  );
}

type PPhase = 'sealed' | 'charge' | 'burst' | 'card';

/**
 * Sobre personal: el jugador lo corta con el dedo (o, con "fuego azul", lo toca y se quema), se
 * llena de luz y sale su carta girando. El brillo depende solo de la suerte (`roll`), nunca del rol,
 * y la forma de abrirlo la elige cada jugador. Cuando la carta aterriza se muestra `children` (la
 * carta de verdad) exactamente en el mismo lugar.
 */
export function PersonalPack({ roll, owner, edition, opening, onOpened, children }: { roll: PackRoll; owner: string; edition: string; opening?: OpenId; onOpened?: () => void; children?: ReactNode }) {
  const design = designOf(roll);
  const glow = glowOf(roll);
  const style = openOf(opening);
  const fire = style.id === 'fuego';
  const [phase, setPhase] = useState<PPhase>('sealed');
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  // Con fuego: la carta espera DENTRO del contorno del sobre (más chica y centrada en él), así solo
  // se ve por los hoyos que va abriendo el fuego. Crece a su tamaño hasta que ya no queda sobre.
  const [fit, setFit] = useState<{ s: number; x: number; y: number; h: number } | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const torn = useMotionValue(0);
  const stripRot = useTransform(torn, [0, 1], [0, -14]);
  const stripY = useTransform(torn, [0, 1], [0, -8]);
  const tearW = useTransform(torn, (v) => `${Math.min(100, v * 100)}%`);
  const stripCtl = useAnimationControls();
  const packCtl = useAnimationControls();
  const packRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: number } | null>(null);
  const lastSound = useRef(0);
  const lastBuzz = useRef(0);
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  // Más rareza, más suspenso antes del estallido.
  const chargeMs = 520 + glow.level * 230;
  // Con fuego: lo que tarda en quemarse todo el sobre (también con más suspenso si es más raro).
  const burnMs = 2100 + glow.level * 170;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // El sobre cae a la mesa al aparecer.
  useEffect(() => {
    sfx.whoosh();
    at(380, () => {
      sfx.packCrinkle(0.8);
      haptic(12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explode = () => {
    setPhase('burst');
    sfx.glowBurst(glow.level);
    haptic(glow.level >= 4 ? [60, 30, 60, 30, 160] : glow.level >= 3 ? [50, 30, 110] : [40, 20, 70]);
    flash(glow.colors[1], 520, 0.32 + glow.level * 0.07);
    shake(5 + glow.level * 3, 380 + glow.level * 80);
    const r = packRef.current?.getBoundingClientRect();
    if (r) burst({ x: r.left + r.width / 2, y: r.top + r.height * (fire ? 0.5 : STRIP), kind: 'sparks', colors: [...glow.colors, '#fff'], count: 30 + glow.level * 22, power: 1 + glow.level * 0.12 });
    if (glow.level >= 4) {
      burst({ kind: 'confetti', colors: glow.colors, count: 50 + glow.level * 20 });
      emojiRain(glow.level === 5 ? ['🌟', '✨', '💫', '⭐'] : ['✨', '💎', '🌈'], 10 + glow.level * 4);
    }
    at(1250, () => {
      setPhase('card');
      onOpened?.();
    });
  };

  const complete = () => {
    if (done.current) return;
    done.current = true;
    drag.current = null;
    torn.set(1);
    setPhase('charge');
    sfx.packRip();
    haptic([30, 20, 60]);
    shake(6, 300);
    void stripCtl.start({ x: 170, y: -210, rotate: -55, opacity: 0, transition: { duration: 0.65, ease: [0.3, 0.6, 0.4, 1] } });
    // El sobre tiembla cada vez más fuerte mientras se llena de luz.
    const k = 1 + glow.level * 0.6;
    const wobble = [0, -1, 1, -1.5, 1.5, -2, 2, -2.6, 2.6, -3.2, 3.2, 0].map((v) => v * k);
    void packCtl.start({ x: wobble, rotate: wobble.map((v) => v * 0.6), transition: { duration: (chargeMs + 250) / 1000, ease: 'easeIn' } });
    at(250, () => sfx.glowCharge(chargeMs / 1000, glow.level));
    const beats = glow.level + 2;
    for (let i = 0; i < beats; i++) at(250 + (i * chargeMs) / beats, () => haptic(6 + i * 4));
    at(250 + chargeMs, explode);
  };

  /** Fuego azul: prende donde tocaron. */
  const ignite = (clientX: number, clientY: number) => {
    if (done.current || !packRef.current) return;
    done.current = true;
    const r = packRef.current.getBoundingClientRect();
    const x = Math.min(0.92, Math.max(0.08, (clientX - r.left) / r.width));
    const y = Math.min(0.92, Math.max(0.08, (clientY - r.top) / r.height));
    sfx.unlock();
    fireIgnite();
    at(120, () => fireBurn(burnMs / 1000));
    haptic([25, 30, 45]);
    // Cosquilleo mientras se quema, cada vez más seguido.
    for (let ms = 200; ms < burnMs; ms += 210 - (ms / burnMs) * 120) at(ms, () => haptic(5));
    // Medidas sin transformaciones (offset*): el sobre y la carta son hijos de `.ppack`.
    const box = boxRef.current;
    const slot = slotRef.current;
    const card = ghostRef.current;
    if (box && slot && card && card.offsetWidth && card.offsetHeight) {
      const s = Math.min((box.offsetWidth * 0.84) / card.offsetWidth, (box.offsetHeight * 0.86) / card.offsetHeight);
      setFit({
        s,
        x: box.offsetLeft + box.offsetWidth / 2 - (slot.offsetLeft + slot.offsetWidth / 2),
        y: box.offsetTop + box.offsetHeight / 2 - (slot.offsetTop + slot.offsetHeight / 2),
        h: card.offsetHeight,
      });
    }
    setOrigin({ x, y });
    setPhase('charge');
  };

  // Con fuego, el shader se prepara en cuanto aparece el sobre (no hasta que lo tocan).
  useEffect(() => {
    if (!fire || !glCanvas.current) return;
    const id = window.setTimeout(() => glCanvas.current && warmBlueFire(glCanvas.current), 450);
    return () => clearTimeout(id);
  }, [fire]);

  // El fuego se prende una sola vez (sigue mientras haya chispas) y se apaga si el sobre se va.
  useEffect(() => {
    if (!origin || !packRef.current || !glCanvas.current || !fxCanvas.current) return;
    // Cuando ya no queda nada del sobre, un respiro con la carta entre las cenizas y ¡pum!
    return startBlueFire({ pack: packRef.current, glCanvas: glCanvas.current, fxCanvas: fxCanvas.current, origin, duration: burnMs, paper: design.c1, onBurnt: () => at(220, explode) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  const tearBy = (dx: number) => {
    const w = packRef.current?.offsetWidth ?? 220;
    const v = Math.min(1, torn.get() + (dx / w) * 1.15);
    torn.set(v);
    const now = performance.now();
    if (now - lastSound.current > 45) {
      lastSound.current = now;
      sfx.packTear(Math.min(1, dx / 10));
    }
    if (v - lastBuzz.current > 0.1) {
      lastBuzz.current = v;
      haptic(6);
    }
    if (v >= 1) complete();
  };

  /** Si solo tocan la línea, el sobre se corta solo. */
  const autoTear = () => {
    if (done.current) return;
    let prev = torn.get();
    void animate(torn, 1, {
      duration: 0.55 * (1 - prev),
      ease: 'easeIn',
      onUpdate: (v) => {
        const now = performance.now();
        if (now - lastSound.current > 45) {
          lastSound.current = now;
          sfx.packTear(Math.min(1, (v - prev) * 12));
          prev = v;
        }
      },
      onComplete: complete,
    });
  };

  const sealed = phase === 'sealed';
  const out = phase === 'burst' || phase === 'card';
  const rays =
    glow.colors.length > 3 ? `repeating-conic-gradient(${glow.colors.map((c, i) => `${c} ${i * 9}deg ${i * 9 + 5}deg, transparent ${i * 9 + 5}deg ${i * 9 + 9}deg`).join(', ')})` : undefined;

  return (
    <div className="ppack" style={glowVars(glow)}>
      {/* Rayos de luz detrás de todo: estallan al abrir y se quedan girando suaves detrás de la carta. */}
      <AnimatePresence>
        {out && (
          <motion.div
            className="ppack-rays"
            style={rays ? { background: rays } : undefined}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={phase === 'burst' ? { opacity: 1, scale: 1.1 } : { opacity: 0.42, scale: 1 }}
            transition={{ duration: phase === 'burst' ? 0.5 : 1.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <div className="ppack-slot" ref={slotRef}>
        {phase === 'card' ? (
          children
        ) : (
          // Carta "fantasma" (solo el dorso): la que sale girando del sobre. La de verdad la reemplaza al aterrizar.
          <motion.div
            ref={ghostRef}
            className="card-wrap ppack-ghost"
            initial={fire ? { x: 0, y: 0, scale: 0.6, opacity: 0 } : { y: '16%', scale: 0.5, opacity: 0 }}
            animate={
              fire
                ? phase === 'burst'
                  ? {
                      x: [fit?.x ?? 0, 0, 0],
                      y: [fit?.y ?? 0, -0.12 * (fit?.h ?? 400), 0],
                      scale: [fit?.s ?? 0.7, 1.06, 1],
                      rotateY: [0, 360, 720],
                      rotate: [0, -4, 0],
                      opacity: [1, 1, 1],
                    }
                  : phase === 'charge'
                    ? { x: fit?.x ?? 0, y: fit?.y ?? 0, scale: fit?.s ?? 0.7, opacity: 1 }
                    : { x: 0, y: 0, scale: 0.6, opacity: 0 }
                : phase === 'burst'
                  ? { y: ['16%', '-58%', '0%'], scale: [0.5, 0.66, 1], rotateY: [0, 360, 720], rotate: [0, -5, 0], opacity: [1, 1, 1] }
                  : { y: '16%', scale: 0.5, opacity: 0 }
            }
            transition={phase === 'burst' ? { duration: 1.15, times: [0, 0.45, 1], ease: 'easeOut' } : { duration: 0 }}
          >
            {/* Con fuego, la carta se ve detrás mientras se quema: sin el color del brillo hasta el estallido. */}
            <div className={`ppack-ghost-face ${fire && phase === 'charge' ? 'unlit' : ''}`}>
              <CardBack hint />
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {out && (
            <motion.div
              className="glow-tag"
              initial={{ scale: 2.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 420, damping: 16 }}
            >
              <span>{glow.emoji}</span>
              <b>Brillo {glow.name}</b>
              <small>{glow.rarity}</small>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase !== 'card' && (
        <motion.div
          ref={boxRef}
          className="ppack-pack"
          initial={{ y: -480, rotate: -12, opacity: 0 }}
          animate={out ? (fire ? { opacity: 0 } : { y: 520, rotate: 12, opacity: 0, scale: 0.9 }) : { y: 0, rotate: 0, opacity: 1 }}
          transition={out ? (fire ? { delay: 0.55, duration: 0.5 } : { delay: 0.3, duration: 0.6, ease: 'easeIn' }) : { type: 'spring', stiffness: 140, damping: 13 }}
        >
          <div className={sealed || (fire && phase === 'charge') ? 'pack-float' : ''} style={{ position: 'absolute', inset: 0 }}>
            {/* Luz azul del fuego sobre la mesa. */}
            {fire && origin && <div className="fire-light" />}
            {/* Luz que se escapa por la abertura. */}
            {phase === 'charge' && !fire && (
              <motion.div
                className="ppack-leak"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 0.4, 0.3, 0.8, 0.6, 1.1], opacity: [0, 0.7, 0.5, 0.9, 0.7, 1] }}
                transition={{ duration: (chargeMs + 250) / 1000, ease: 'easeIn' }}
              />
            )}
            <motion.div
              ref={packRef}
              className={`pack ${fire && sealed ? 'pack-flammable' : ''}`}
              style={{ clipPath: CRIMP }}
              animate={packCtl}
              whileTap={sealed ? { scaleX: 0.97, scaleY: 1.02 } : undefined}
              onPointerDown={() => sealed && sfx.packCrinkle(0.6)}
              onClick={fire && sealed ? (e) => ignite(e.clientX, e.clientY) : undefined}
              role={fire && sealed ? 'button' : undefined}
              aria-label={fire && sealed ? 'Prenderle fuego al sobre' : undefined}
            >
              {fire ? (
                <div className={`pack-body fire ${sealed ? 'idle' : ''}`}>
                  <PackArt design={design} owner={owner} edition={edition} />
                </div>
              ) : (
                <>
                  <div className={`pack-body ${sealed ? 'idle' : ''}`}>
                    <div className="pack-slice" style={{ top: `${(-STRIP / (1 - STRIP)) * 100}%`, height: `${100 / (1 - STRIP)}%` }}>
                      <PackArt design={design} owner={owner} edition={edition} />
                    </div>
                    {!sealed && <motion.div className="pack-glow" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.6, 0.4, 1] }} transition={{ duration: chargeMs / 1000 }} />}
                  </div>

                  <motion.div className="pack-strip" style={{ rotate: stripRot, y: stripY }} animate={stripCtl}>
                    <div className="pack-slice" style={{ top: 0, height: `${100 / STRIP}%` }}>
                      <PackArt design={design} owner={owner} edition={edition} />
                    </div>
                  </motion.div>

                  <div className="pack-line" />
                  <motion.div className="pack-tear" style={{ width: tearW }} />
                </>
              )}
            </motion.div>
            {fire && (
              <>
                <canvas ref={glCanvas} className="fire-canvas" aria-hidden />
                <canvas ref={fxCanvas} className="fire-canvas" aria-hidden />
              </>
            )}
          </div>

          {/* Zona para cortar: un poco más alta que la línea para que sea fácil con el dedo. */}
          {sealed && !fire && (
            <div
              className="pack-cutzone"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                sfx.unlock();
                sfx.packCrinkle(0.4);
                drag.current = { x: e.clientX, moved: 0 };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const dx = Math.abs(e.clientX - d.x);
                d.x = e.clientX;
                d.moved += dx;
                if (dx > 0) tearBy(dx);
              }}
              onPointerUp={() => {
                const d = drag.current;
                drag.current = null;
                if (d && d.moved < 10) autoTear();
              }}
              onPointerCancel={() => (drag.current = null)}
              role="button"
              aria-label="Cortar el sobre"
            >
              <motion.span className="pack-scissors" animate={{ left: ['2%', '86%'] }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.6, ease: 'easeInOut' }}>
                ✂️
              </motion.span>
            </div>
          )}
        </motion.div>
      )}

      <motion.div className="dim pack-hint ppack-hint" animate={{ opacity: sealed ? 1 : 0 }}>
        {style.hint}
      </motion.div>
    </div>
  );
}

type SPhase = 'in' | 'fan' | 'split' | 'riffle' | 'bridge' | 'square' | 'out';
const MW = 70;
const MH = 113;

/**
 * Al empezar la ronda: los sobres de todos caen a la mesa y se barajan, así nadie sabe cuál es
 * de quién. Luego salen volando, uno para cada jugador.
 */
export function PackShuffle({ rolls, onDone }: { rolls: PackRoll[]; onDone: () => void }) {
  const N = Math.max(3, Math.min(12, rolls.length));
  const [phase, setPhase] = useState<SPhase>('in');
  const timers = useRef<number[]>([]);
  const list = useMemo(() => Array.from({ length: N }, (_, i) => ({ roll: rolls[i % rolls.length], x: (Math.random() - 0.5) * 10, r: (Math.random() - 0.5) * 12 })), [N, rolls]);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    sfx.whoosh();
    for (let i = 0; i < N; i++)
      at(120 + i * 70, () => {
        sfx.cardSlide(0.85 + i * 0.03);
        if (i % 3 === 0) sfx.packCrinkle(0.3);
      });
    let t = 300 + N * 70;
    const step = (ms: number, ph: SPhase, fx?: () => void) => {
      at(t, () => {
        setPhase(ph);
        fx?.();
      });
      t += ms;
    };
    step(620, 'fan', () => {
      sfx.sparkle();
      haptic(10);
    });
    step(340, 'split', () => sfx.whoosh());
    step(600, 'riffle', () => {
      sfx.riffle(0.5);
      sfx.packCrinkle(0.7);
      haptic([4, 20, 4, 20, 4, 20, 4]);
    });
    step(460, 'bridge', () => sfx.cardSlide(0.8));
    step(420, 'square', () => {
      sfx.deckTap();
      at(t + 140, () => sfx.deckTap());
      haptic([15, 60, 15]);
    });
    const out = t;
    step(0, 'out', () => {
      for (let i = 0; i < N; i++) at(out + i * 45, () => sfx.cardSlide(1.1 + i * 0.02));
      sfx.sparkle();
    });
    at(out + N * 45 + 520, onDone);
    const list = timers.current;
    return () => list.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mid = (N - 1) / 2;
  const half = Math.floor(N / 2);
  const target = (i: number) => {
    const k = i - mid;
    const j = list[i];
    const left = i < half;
    switch (phase) {
      case 'in':
        return { x: j.x, y: -i * 1.6, rotate: j.r, opacity: 1, scale: 1 };
      case 'fan':
        return { x: k * 19, y: Math.abs(k) * 5, rotate: k * 7, opacity: 1, scale: 1 };
      case 'split':
        return { x: left ? -78 : 78, y: -(left ? i : i - half) * 1.6, rotate: left ? -12 : 12, opacity: 1, scale: 1 };
      case 'riffle':
        return { x: 0, y: -i * 1.3, rotate: i % 2 ? 1.5 : -1.5, opacity: 1, scale: 1 };
      case 'bridge':
        return { x: k * 9, y: -Math.sin((Math.PI * i) / Math.max(1, N - 1)) * 40, rotate: k * 4, opacity: 1, scale: 1 };
      case 'square':
        return { x: 0, y: -i * 1.3, rotate: 0, opacity: 1, scale: [1, 1.06, 1] };
      case 'out': {
        const a = (i / N) * Math.PI * 2 + 0.4;
        return { x: Math.cos(a) * 300, y: Math.sin(a) * 380, rotate: j.r * 6, opacity: 0, scale: 0.6 };
      }
    }
  };
  const delay = (i: number) => {
    if (phase === 'in') return 0.12 + i * 0.07;
    if (phase === 'fan') return i * 0.02;
    if (phase === 'riffle') return (i < half ? i * 2 : (i - half) * 2 + 1) * 0.04;
    if (phase === 'bridge') return i * 0.012;
    if (phase === 'out') return i * 0.045;
    return 0;
  };

  const caption =
    phase === 'in' ? `${rolls.length} ${rolls.length === 1 ? 'sobre sellado' : 'sobres sellados'}` : phase === 'square' || phase === 'out' ? '¡Uno para cada quien!' : 'Barajando sobres…';

  return (
    <div className="pack-stage">
      <motion.div key={caption} className="display pack-caption" initial={{ opacity: 0, y: -12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <Glitch text={caption} hard={phase === 'out'} />
      </motion.div>
      <div className="shuffle-scene">
        <div className="pack-deck" style={{ top: '50%' }}>
          {list.map((p, i) => (
            <motion.div
              key={i}
              className="pack-card"
              style={{ width: MW, height: MH, marginLeft: -MW / 2, marginTop: -MH / 2, zIndex: i, transformOrigin: phase === 'fan' ? '50% 130%' : '50% 50%' }}
              initial={{ x: 0, y: -520, rotate: -30, opacity: 0 }}
              animate={target(i)}
              transition={{ type: 'spring', stiffness: phase === 'in' ? 160 : 300, damping: phase === 'in' ? 16 : 24, delay: delay(i) }}
            >
              <MiniPack roll={p.roll} style={{ position: 'absolute', inset: 0 }} />
            </motion.div>
          ))}
        </div>
      </div>
      <div className="dim pack-hint">Cada sobre trae una carta secreta. 🤫</div>
    </div>
  );
}
