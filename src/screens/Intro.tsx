import { AnimatePresence, motion } from 'framer-motion';
import { EVENT_SCENE, emojiRain } from '../fx/scene';
import { useEffect, useMemo, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { EventCard } from '../components/EventCard';
import { Button } from '../components/ui';
import { Wheel, type WheelEntry } from '../components/Wheel';
import { BY_ID, playable } from '../data';
import { CAT, CATEGORIES } from '../data/categories';
import { THEME_BY_ID, THEMES } from '../data/themes';
import { makeRng } from '../engine/rng';
import { burst, flash, shake } from '../fx/fx';
import { useSeat } from '../net/state';
import { preload } from '../services/images';
import { useGame } from '../store/game';
import { shownEvent } from '../store/view';

const MIN_SLICES = 8;

/** Ruleta que cae en la categoría (o tema) de la ronda y luego anuncia el evento, si hay. */
export function Intro() {
  const round = useGame((s) => s.round)!;
  const settings = useGame((s) => s.settings);
  const go = useGame((s) => s.go);
  const { host } = useSeat();
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const event = shownEvent(round);
  const [phase, setPhase] = useState<'spin' | 'land' | 'event'>('spin');

  const { entries, target } = useMemo(() => {
    let list: WheelEntry[];
    if (theme) {
      // En Mezcla hay demasiados temas para una ruleta: salen el de la ronda y once más.
      const rng = makeRng(round.n * 9973 + 7);
      const others = rng.shuffle(THEMES.filter((t) => t.id !== theme.id)).slice(0, 11);
      list = rng.shuffle([theme, ...others]).map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, color: t.color, horror: t.horror }));
    } else {
      // Solo las categorías con las que se está jugando.
      const chosen = settings.cats.filter(playable);
      const ids = new Set<string>([...(chosen.length ? chosen : CATEGORIES.map((c) => c.id)), round.cat]);
      list = [...CATEGORIES.map((c) => c.id), 'custom' as const]
        .filter((id) => ids.has(id))
        .map((id) => ({ id, emoji: CAT[id].emoji, name: CAT[id].name, color: CAT[id].color, horror: CAT[id].horror }));
      const base = [...list];
      while (list.length < MIN_SLICES) list = [...list, ...base];
    }
    const c = CAT[round.cat];
    return {
      entries: list,
      target: theme
        ? { id: theme.id, color: theme.color, color2: c.color2, tagline: '🔀 Modo Mezcla: cartas de distintas categorías' }
        : { id: round.cat as string, color: c.color, color2: c.color2, tagline: c.tagline },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.n]);

  useEffect(() => {
    preload([BY_ID[round.civil], ...Object.values(round.decoys ?? {}).map((id) => BY_ID[id]), round.decoy ? BY_ID[round.decoy] : null]);
    sfx.riser(4.2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLand = () => {
    setPhase('land');
    sfx.stamp();
    haptic([40, 30, 60]);
    flash(target.color, 500, 0.45);
    shake(10, 400);
    burst({ kind: 'confetti', colors: [target.color, target.color2, '#fff'], count: 90, y: window.innerHeight * 0.4 });
    const landed = entries.find((e) => e.id === target.id);
    if (landed) emojiRain([landed.emoji], 14);
  };

  useEffect(() => {
    if (phase !== 'land' || !event) return;
    const t = setTimeout(() => {
      setPhase('event');
      sfx.challenge();
      haptic([60, 40, 60, 40, 120]);
      flash(event.color, 600, 0.55);
      shake(16, 600);
      burst({ kind: 'sparks', colors: ['#fff', event.color, '#7c5cff'], count: 70 });
      // Cada evento llega con su propia lluvia (los secretos, con signos de interrogación).
      emojiRain(!event.id ? ['❓', '🤫', '❔'] : (EVENT_SCENE[event.id] ?? ['⚡', '✨']).concat(event.emoji, event.emoji), 28);
    }, 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const ready = (phase === 'land' && !event) || phase === 'event';

  return (
    <div className="screen center">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="label content" style={{ marginBottom: 10 }}>
        Ronda {round.n}
      </motion.div>

      <AnimatePresence mode="wait">
        {phase !== 'event' ? (
          <motion.div key="wheel" exit={{ opacity: 0, scale: 0.7 }} className="content center" style={{ gap: 10, width: '100%' }}>
            <div className="dim" style={{ fontWeight: 800 }}>
              {theme ? '🔀 El tema es…' : 'La categoría es…'}
            </div>
            <Wheel
              entries={entries}
              targetId={target.id}
              seed={round.n * 7919 + round.civil.length}
              onTick={(k) => {
                sfx.spinTick(0.8 + k * 0.6);
                haptic(4);
              }}
              onLand={onLand}
            />
            <motion.div animate={phase === 'land' ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }} className="dim" style={{ fontSize: 15, fontStyle: 'italic', minHeight: 22 }}>
              “{target.tagline}”
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="event"
            initial={{ scale: 2.4, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="content"
            style={{ width: '100%', maxWidth: 380 }}
          >
            <EventCard event={event!} cursedWord={round.cursedWord} accent={round.accent} adult={settings.adult} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="content"
        style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(var(--safe-b) + 16px)' }}
        initial={{ opacity: 0, y: 40 }}
        animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ delay: phase === 'event' ? 0.8 : 0.4 }}
      >
        {host ? (
          <Button
            disabled={!ready}
            onClick={() => {
              sfx.whoosh();
              go('deal');
            }}
          >
            🃏 Repartir cartas
          </Button>
        ) : (
          <div className="dim center" style={{ fontWeight: 700 }}>
            El anfitrión reparte las cartas…
          </div>
        )}
      </motion.div>
    </div>
  );
}
