import { animate, motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { burst, flash, shake } from '../fx/fx';
import { CardBack } from './GameCard';
import { Glitch } from './ui';

/** Fases: sellado → abierto → salen las cartas → abanico → riffle → puente → corte → emparejar → repartir. */
type Phase = 'sealed' | 'open' | 'emerge' | 'fan' | 'split' | 'riffle' | 'bridge' | 'cascade' | 'cut' | 'cutBack' | 'square' | 'deal';

/** Parte de arriba del sobre que se corta (fracción del alto). */
const STRIP = 0.17;
const CW = 84;
const CH = 118;
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

/** Arte del sobre (diseño propio). Se dibuja completo dentro de la tira y del cuerpo para que encajen. */
function PackArt({ title, emoji, count }: { title: string; emoji: string; count: number }) {
  return (
    <div className="pack-art">
      <div className="pack-foil" />
      <div className="pack-crimp top" />
      <div className="pack-crimp bottom" />
      <div className="pack-rosette" />
      <div className="pack-badge">
        <b>×{count}</b>
        <small>cartas</small>
      </div>
      <div className="pack-center">
        <div className="pack-eye">👁️</div>
        <div className="display pack-logo">IMPOSTOR</div>
        <div className="pack-sub">¿Quién miente?</div>
      </div>
      <div className="pack-edition">
        <span>{emoji}</span> Sobre de {title}
      </div>
      <div className="pack-fine">Contiene un impostor… o varios. O ninguno.</div>
    </div>
  );
}

/**
 * Sobre de cartas: se corta deslizando el dedo por la línea punteada (o tocándola), las cartas
 * salen y se barajan frente a todos. `onDone` se llama cuando la primera carta sale disparada.
 */
export function PackOpening({ count, color, color2, title, emoji, onDone }: { count: number; color: string; color2: string; title: string; emoji: string; onDone: () => void }) {
  const N = Math.max(5, Math.min(12, count));
  const [phase, setPhase] = useState<Phase>('sealed');
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
  const jitter = useMemo(() => Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 10, r: (Math.random() - 0.5) * 10 })), [N]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // El sobre cae a la mesa al aparecer.
  useEffect(() => {
    sfx.whoosh();
    const t = window.setTimeout(() => {
      sfx.packCrinkle(0.8);
      haptic(12);
    }, 380);
    timers.current.push(t);
  }, []);

  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const complete = () => {
    if (done.current) return;
    done.current = true;
    drag.current = null;
    torn.set(1);
    setPhase('open');
    sfx.packRip();
    haptic([30, 20, 80]);
    shake(10, 380);
    const r = packRef.current?.getBoundingClientRect();
    flash(color, 380, 0.35);
    if (r) burst({ x: r.left + r.width / 2, y: r.top + r.height * STRIP, kind: 'sparks', colors: ['#fff', color, color2], count: 46 });
    void stripCtl.start({ x: 170, y: -210, rotate: -55, opacity: 0, transition: { duration: 0.65, ease: [0.3, 0.6, 0.4, 1] } });
    void packCtl.start({ rotate: [0, -3, 3, -1.5, 0], scale: [1, 1.04, 1], transition: { duration: 0.45 } });

    const emerge = 420;
    at(emerge, () => setPhase('emerge'));
    for (let i = 0; i < N; i++) at(emerge + i * 85, () => sfx.cardSlide(1 + i * 0.03));
    let t = emerge + N * 85 + 450;
    const step = (ms: number, ph: Phase, fx?: () => void) => {
      at(t, () => {
        setPhase(ph);
        fx?.();
      });
      t += ms;
    };
    step(600, 'fan', () => {
      sfx.sparkle();
      haptic(10);
    });
    step(320, 'split', () => sfx.whoosh());
    step(650, 'riffle', () => {
      sfx.riffle(0.55);
      haptic([4, 20, 4, 20, 4, 20, 4]);
    });
    step(420, 'bridge', () => sfx.cardSlide(0.8));
    step(460, 'cascade', () => sfx.riffle(0.38));
    step(300, 'cut', () => sfx.cardSlide(1.1));
    step(320, 'cutBack', () => sfx.deckTap());
    step(420, 'square', () => {
      sfx.deckTap();
      at(t + 140, () => sfx.deckTap());
      haptic([15, 60, 15]);
    });
    step(460, 'deal', () => {
      sfx.flip();
      sfx.sparkle();
      haptic([30, 20, 60]);
      flash(color, 400, 0.35);
      burst({ kind: 'sparks', count: 30, colors: ['#fff', color, color2] });
    });
    at(t, onDone);
  };

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
  const mid = (N - 1) / 2;
  const half = Math.floor(N / 2);
  const afterCut = phase === 'cutBack' || phase === 'square' || phase === 'deal';
  // Tras el corte, la mitad de arriba pasa abajo: la carta de hasta arriba es la última de la otra mitad.
  const z = (i: number) => (afterCut ? (i >= half ? i - half : i + (N - half)) : i);
  const top = half - 1;

  const target = (i: number) => {
    const k = i - mid;
    const j = jitter[i];
    const left = i < half;
    switch (phase) {
      case 'sealed':
      case 'open':
        return { x: 0, y: 70, rotate: 0, scale: 0.85, opacity: 1, rotateY: 0 };
      case 'emerge':
        return { x: j.x * 0.6, y: -100 - i * 2.2, rotate: j.r * 0.5, scale: 1, opacity: 1, rotateY: 0 };
      case 'fan':
        return { x: k * 22, y: -60 + Math.abs(k) * 5, rotate: k * 7, scale: 1, opacity: 1, rotateY: [0, 28, 0] };
      case 'split':
        return { x: left ? -70 : 70, y: -55 - (left ? i : i - half) * 1.6, rotate: left ? -13 : 13, scale: 1, opacity: 1, rotateY: 0 };
      case 'riffle':
      case 'cascade':
      case 'cutBack':
      case 'square':
        return { x: 0, y: -55 - z(i) * 1.2, rotate: phase === 'riffle' ? (i % 2 ? 1.5 : -1.5) : 0, scale: phase === 'square' ? [1, 1.05, 1] : 1, opacity: 1, rotateY: 0 };
      case 'bridge':
        return { x: k * 10, y: -65 - Math.sin((Math.PI * i) / Math.max(1, N - 1)) * 42, rotate: k * 4, scale: 1, opacity: 1, rotateY: 0 };
      case 'cut':
        return i >= half ? { x: 70, y: -95 - i * 1.2, rotate: 9, scale: 1, opacity: 1, rotateY: 0 } : { x: -6, y: -55 - i * 1.2, rotate: -2, scale: 1, opacity: 1, rotateY: 0 };
      case 'deal':
        return i === top ? { x: 0, y: -30, rotate: 0, scale: 1.8, opacity: 1, rotateY: [0, 180, 360] } : { x: 0, y: 220, rotate: 0, scale: 0.8, opacity: 0, rotateY: 0 };
    }
  };

  const delay = (i: number) => {
    if (phase === 'emerge') return i * 0.085;
    if (phase === 'fan') return i * 0.02;
    if (phase === 'riffle') {
      // Las dos mitades se intercalan carta por carta.
      const order = i < half ? i * 2 : (i - half) * 2 + 1;
      return order * 0.04;
    }
    if (phase === 'bridge') return i * 0.012;
    if (phase === 'cascade') return (N - 1 - i) * 0.03;
    return 0;
  };

  const caption = sealed ? 'Abre el sobre' : phase === 'open' || phase === 'emerge' ? '¡Nuevas cartas!' : phase === 'deal' ? '¡Listas!' : 'Barajando…';

  return (
    <div className="pack-stage">
      <motion.div key={caption} className="display pack-caption" initial={{ opacity: 0, y: -12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <Glitch text={caption} hard={phase === 'deal'} />
      </motion.div>

      <div className="pack-scene">
        {/* Cartas: detrás del cuerpo del sobre, así parece que salen de adentro. */}
        <div className="pack-deck" style={{ top: `calc(var(--pack-top) + var(--pack-h) * ${STRIP})` }}>
          {jitter.map((_, i) => (
            <motion.div
              key={i}
              className="pack-card"
              style={{ width: CW, height: CH, marginLeft: -CW / 2, marginTop: -CH / 2, zIndex: z(i), transformOrigin: phase === 'fan' ? '50% 130%' : '50% 50%' }}
              initial={{ x: 0, y: 70, scale: 0.85, opacity: 1 }}
              animate={target(i)}
              transition={{ type: 'spring', stiffness: phase === 'emerge' ? 140 : 300, damping: phase === 'emerge' ? 15 : 24, delay: delay(i) }}
            >
              <div className="mini-back" style={{ position: 'absolute', inset: 0, borderRadius: 10 }}>
                <CardBack small />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="pack-wrap"
          initial={{ y: -420, rotate: -12, opacity: 0 }}
          animate={phase === 'fan' || phase === 'split' || ['riffle', 'bridge', 'cascade', 'cut', 'cutBack', 'square', 'deal'].includes(phase) ? { y: 420, rotate: 14, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
          transition={phase === 'sealed' ? { type: 'spring', stiffness: 140, damping: 13 } : { duration: 0.6, ease: 'easeIn' }}
        >
          <div className={sealed ? 'pack-float' : ''} style={{ position: 'absolute', inset: 0 }}>
          <motion.div
            ref={packRef}
            className="pack"
            style={{ '--pc': color, '--pc2': color2, clipPath: CRIMP } as CSSProperties}
            animate={packCtl}
            whileTap={sealed ? { scaleX: 0.97, scaleY: 1.02 } : undefined}
            onPointerDown={() => sealed && sfx.packCrinkle(0.6)}
          >
            <motion.div className={`pack-body ${sealed ? 'idle' : ''}`}>
              <div className="pack-slice" style={{ top: `${(-STRIP / (1 - STRIP)) * 100}%`, height: `${100 / (1 - STRIP)}%` }}>
                <PackArt title={title} emoji={emoji} count={count} />
              </div>
              {!sealed && <motion.div className="pack-glow" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.55] }} transition={{ duration: 0.9 }} />}
            </motion.div>

            <motion.div className="pack-strip" style={{ rotate: stripRot, y: stripY }} animate={stripCtl}>
              <div className="pack-slice" style={{ top: 0, height: `${100 / STRIP}%` }}>
                <PackArt title={title} emoji={emoji} count={count} />
              </div>
            </motion.div>

            <div className="pack-line" />
            <motion.div className="pack-tear" style={{ width: tearW }} />
          </motion.div>
          </div>

          {/* Zona para cortar: un poco más alta que la línea para que sea fácil con el dedo. */}
          {sealed && (
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
      </div>

      <motion.div className="dim pack-hint" animate={{ opacity: sealed ? 1 : 0 }}>
        Desliza el dedo por la línea punteada para cortarlo ✂️
      </motion.div>
    </div>
  );
}
