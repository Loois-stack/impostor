import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Button, Glitch } from '../components/ui';
import { BY_ID } from '../data';
import { CAT, CATEGORIES } from '../data/categories';
import { THEME_BY_ID, THEMES } from '../data/themes';
import { EVENTS } from '../engine/events';
import { burst, flash, shake } from '../fx/fx';
import { preload } from '../services/images';
import { useGame } from '../store/game';

const ITEM_H = 92;
const LOOPS = 4;

/** Ruleta tipo tragamonedas que aterriza en la categoría de la ronda, luego anuncia eventos. */
export function Intro() {
  const round = useGame((s) => s.round)!;
  const go = useGame((s) => s.go);
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  // En Mezcla la ruleta gira por temas; si no, por categorías.
  const entries = theme
    ? THEMES.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, color: t.color, horror: t.horror }))
    : CATEGORIES.map((c) => ({ id: c.id as string, emoji: c.emoji, name: c.name, color: c.color, horror: c.horror }));
  const target = theme
    ? { id: theme.id, color: theme.color, color2: CAT[round.cat].color2, tagline: '🔀 Modo Mezcla: cartas de distintas categorías' }
    : { id: round.cat as string, color: CAT[round.cat].color, color2: CAT[round.cat].color2, tagline: CAT[round.cat].tagline };
  const cat = target;
  const event = round.event ? EVENTS[round.event] : undefined;
  const showEvent = event && !event.secret;
  const [phase, setPhase] = useState<'spin' | 'land' | 'event'>('spin');
  const y = useMotionValue(0);

  const reel = useMemo(() => {
    const list = [];
    for (let l = 0; l < LOOPS; l++) list.push(...entries);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const targetIdx = (LOOPS - 1) * entries.length + entries.findIndex((c) => c.id === target.id);

  useEffect(() => {
    preload([BY_ID[round.civil], round.decoy ? BY_ID[round.decoy] : null]);
    sfx.riser(2.2);
    let last = 0;
    const ctrl = animate(y, -targetIdx * ITEM_H, {
      duration: 2.4,
      ease: [0.12, 0.8, 0.18, 1],
      onUpdate: (v) => {
        const idx = Math.floor(-v / ITEM_H);
        if (idx !== last) {
          last = idx;
          sfx.spinTick(0.8 + (idx / targetIdx) * 0.6);
          haptic(4);
        }
      },
      onComplete: () => {
        setPhase('land');
        sfx.stamp();
        haptic([40, 30, 60]);
        flash(cat.color, 500, 0.45);
        shake(10, 400);
        burst({ kind: 'confetti', colors: [cat.color, cat.color2, '#fff'], count: 80, y: window.innerHeight * 0.45 });
        if (showEvent)
          setTimeout(() => {
            setPhase('event');
            sfx.challenge();
            haptic([60, 40, 60, 40, 120]);
            flash(round.event === 'terror' ? '#8a0020' : '#7c5cff', 600, 0.6);
            shake(16, 600);
            burst({ kind: 'sparks', colors: ['#fff', '#ff2e4d', '#7c5cff'], count: 70 });
          }, 1400);
      },
    });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen center">
      <motion.div {...{ initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } }} className="label content" style={{ marginBottom: 18 }}>
        Ronda {round.n}
      </motion.div>

      <AnimatePresence mode="wait">
        {phase !== 'event' ? (
          <motion.div key="reel" exit={{ opacity: 0, scale: 0.7, filter: 'blur(10px)' }} className="content center" style={{ gap: 20, width: '100%' }}>
            <div className="dim" style={{ fontWeight: 800 }}>
              {theme ? '🔀 El tema es…' : 'La categoría es…'}
            </div>
            <div
              style={{
                height: ITEM_H * 3,
                width: '100%',
                maxWidth: 380,
                overflow: 'hidden',
                position: 'relative',
                maskImage: 'linear-gradient(transparent, #000 30%, #000 70%, transparent)',
                WebkitMaskImage: 'linear-gradient(transparent, #000 30%, #000 70%, transparent)',
              }}
            >
              <motion.div style={{ y, paddingTop: ITEM_H }}>
                {reel.map((c, i) => (
                  <div key={i} className="row" style={{ height: ITEM_H, justifyContent: 'center', gap: 14 }}>
                    <span style={{ fontSize: 46 }}>{c.emoji}</span>
                    <span className={`display ${c.horror ? 'horror-font' : ''}`} style={{ fontSize: 34, color: c.color }}>
                      {c.name}
                    </span>
                  </div>
                ))}
              </motion.div>
              <motion.div
                animate={phase === 'land' ? { opacity: [0, 1, 0.6], scale: [1.2, 1] } : { opacity: 0.35 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: ITEM_H,
                  height: ITEM_H,
                  borderRadius: 20,
                  border: `2px solid ${cat.color}`,
                  boxShadow: `0 0 40px ${cat.color}66, inset 0 0 30px ${cat.color}33`,
                }}
              />
            </div>
            <motion.div
              animate={phase === 'land' ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              className="dim"
              style={{ fontSize: 15, fontStyle: 'italic' }}
            >
              “{cat.tagline}”
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="event"
            initial={{ scale: 2.4, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="panel content center"
            style={{
              gap: 12,
              padding: 26,
              maxWidth: 360,
              border: '2px solid rgba(255,255,255,.3)',
              background: 'linear-gradient(160deg, rgba(124,92,255,.35), rgba(255,46,77,.25))',
              boxShadow: '0 30px 80px rgba(0,0,0,.6), 0 0 60px rgba(124,92,255,.4)',
            }}
          >
            <div className="label" style={{ color: '#fff' }}>
              ⚡ Evento sorpresa ⚡
            </div>
            <motion.div animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ fontSize: 72 }}>
              {event!.emoji}
            </motion.div>
            <div className="h2" style={{ fontSize: 44 }}>
              <Glitch text={event!.title} hard />
            </div>
            <div style={{ lineHeight: 1.45, fontSize: 15.5 }}>{event!.desc}</div>
            {round.cursedWord && (
              <div className="display" style={{ fontSize: 40, color: '#ff2e4d', textShadow: '0 0 20px #ff2e4d' }}>
                ☠️ “{round.cursedWord.toUpperCase()}”
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="content"
        style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-b) + 16px)' }}
        initial={{ opacity: 0, y: 40 }}
        animate={(phase === 'land' && !showEvent) || phase === 'event' ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ delay: phase === 'event' ? 0.8 : 0.4 }}
      >
        <Button
          onClick={() => {
            sfx.whoosh();
            go('deal');
          }}
        >
          🃏 Repartir cartas
        </Button>
      </motion.div>
    </div>
  );
}
