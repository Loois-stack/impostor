import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CardBack } from '../components/GameCard';
import { MiniCard } from '../components/MiniCard';
import { Avatar, Button, Glitch } from '../components/ui';
import { BY_ID } from '../data';
import type { Item } from '../data/types';
import { PTS } from '../engine/scoring';
import { burst, flash, shake } from '../fx/fx';
import { emojiRain } from '../fx/scene';
import { useSeat } from '../net/state';
import { useGame, type Player } from '../store/game';

const COLS = 3;

/** Mira de francotirador que se fija sobre el impostor atrapado. */
function Crosshair({ locked, small }: { locked: boolean; small?: boolean }) {
  return (
    <motion.svg
      className={`lc-cross ${small ? 'small' : ''}`}
      viewBox="0 0 200 200"
      initial={small ? false : { scale: 3.4, rotate: -160, opacity: 0 }}
      animate={locked ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 1.7, rotate: -50, opacity: 0.9 }}
      transition={locked ? { type: 'spring', stiffness: 420, damping: 16 } : { duration: 0.9, ease: 'easeOut', delay: 0.3 }}
    >
      <circle cx="100" cy="100" r="88" fill="none" stroke="#ffd23d" strokeWidth="5" strokeDasharray="22 10" />
      <circle cx="100" cy="100" r="64" fill="none" stroke="#ff2e4d" strokeWidth="3" opacity="0.9" />
      {[0, 90, 180, 270].map((a) => (
        <line key={a} x1="100" y1="0" x2="100" y2="30" stroke="#ffd23d" strokeWidth="7" strokeLinecap="round" transform={`rotate(${a} 100 100)`} />
      ))}
    </motion.svg>
  );
}

/**
 * Entrada a la última oportunidad: se apaga la luz, cae el impostor atrapado bajo un reflector,
 * la mira se fija sobre él y golpea el título. Luego lo manda a elegir.
 */
function LastChanceIntro({ player, note, onDone }: { player: Player; note?: ReactNode; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    sfx.whoosh();
    onDone();
  };

  useEffect(() => {
    const ts: number[] = [];
    const at = (ms: number, fn: () => void) => ts.push(window.setTimeout(fn, ms));
    sfx.heartbeat();
    sfx.riser(1.1);
    haptic(30);
    at(700, () => sfx.heartbeat());
    at(1050, () => {
      setStep(1);
      sfx.lockOn();
      haptic([20, 40, 60]);
    });
    at(1400, () => {
      setStep(2);
      sfx.slam();
      shake(16, 500);
      flash('#ffd23d', 450, 0.45);
      burst({ kind: 'sparks', colors: ['#ffd23d', '#ff2e4d', '#fff'], count: 70, y: window.innerHeight * 0.55 });
    });
    at(1950, () => setStep(3));
    at(2300, () => sfx.heartbeat());
    at(3000, () => sfx.heartbeat());
    at(3700, finish);
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="lc-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
      transition={{ duration: 0.35 }}
      onClick={() => step >= 2 && finish()}
    >
      <motion.div className="lc-spot" initial={{ opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.1, duration: 0.5 }} />
      <motion.div className="lc-hero" initial={{ y: -340, scale: 0.6 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}>
        <Avatar player={player} size={128} mood={step >= 3 ? 'happy' : 'scared'} />
        <Crosshair locked={step >= 1} />
      </motion.div>
      <motion.b className="display lc-name" style={{ color: player.color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        {player.name}
      </motion.b>
      <div className="lc-title-slot">
        {step >= 2 && (
          <motion.div className="display lc-title" initial={{ scale: 3, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
            <Glitch text="ÚLTIMA OPORTUNIDAD" hard />
          </motion.div>
        )}
      </div>
      <motion.div className="lc-sub" initial={{ opacity: 0, y: 14 }} animate={step >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}>
        <div>
          Te atraparon… pero si adivinas <b>la carta de los civiles</b>, te llevas <b className="lc-gold">+{PTS.impGuess}</b>.
        </div>
        {note}
      </motion.div>
      <motion.div className="lc-skip" animate={{ opacity: step >= 2 ? 0.7 : 0 }}>
        Toca para continuar
      </motion.div>
    </motion.div>
  );
}

/** Opción que llega volando bocabajo y se voltea. */
function DealtOption({ i, children }: { i: number; children: ReactNode }) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return (
    <motion.div
      style={{ position: 'relative', perspective: 800 }}
      initial={{ x: `${(1 - col) * 108}%`, y: `${(1 - row) * 60 + 90}%`, scale: 0.3, rotate: (col - 1) * 16, opacity: 0 }}
      animate={{ x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
      transition={{ delay: i * 0.09, type: 'spring', stiffness: 250, damping: 22 }}
    >
      <motion.div style={{ position: 'relative', transformStyle: 'preserve-3d' }} initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ delay: 0.75 + i * 0.09, duration: 0.5 }}>
        <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>{children}</div>
        <div className="lc-back">
          <CardBack small />
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Última oportunidad: cada impostor atrapado elige cuál era la carta de los civiles, ANTES de
 * ver la verdad. Si hay varios, lo que elige cada uno queda guardado en secreto y se revela al
 * final para que el primero no le diga la respuesta a los demás.
 */
export function LastChance({ options }: { options: Item[] }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { guess, nextGuess } = useGame();
  const { online, me, host, seats } = useSeat();
  const P = (id: string) => players.find((p) => p.id === id)!;
  const caught = round.impostors.filter((i) => round.accused.includes(i));
  const guesser = caught[round.guessIdx];
  const picks = round.guessPicks ?? {};
  const picked = picks[guesser] ?? round.guessPick;
  const allPicked = caught.length > 0 && caught.every((id) => picks[id]);
  const mine = !online || seats.includes(guesser);
  const civil = BY_ID[round.civil];
  const nextName = caught[round.guessIdx + 1] ? P(caught[round.guessIdx + 1]).name : '';

  // La intro sale una vez por impostor (este componente se monta de nuevo para cada uno).
  const [intro, setIntro] = useState(!picked);
  const [dealt, setDealt] = useState(!!picked);
  const [result, setResult] = useState(false);

  // Las cartas llegan volando y se voltean una por una.
  useEffect(() => {
    if (intro || dealt) return;
    const ts = options.map((_, i) => window.setTimeout(() => sfx.cardSlide(1 + i * 0.04), i * 90));
    options.forEach((_, i) => ts.push(window.setTimeout(() => sfx.flip(), 800 + i * 90)));
    ts.push(window.setTimeout(() => setDealt(true), 900 + options.length * 90 + 250));
    return () => ts.forEach(clearTimeout);
  }, [intro, dealt, options]);

  // Al elegir: candado. Si ya eligieron todos, redoble y se revela quién acertó.
  useEffect(() => {
    if (!picked) return;
    sfx.stamp();
    haptic(40);
  }, [picked]);
  useEffect(() => {
    if (!allPicked) return;
    sfx.drumroll(1.5);
    const beats = [0, 500, 1000].map((t) => window.setTimeout(() => haptic(25), t + 200));
    const t = window.setTimeout(() => {
      setResult(true);
      if (caught.some((id) => round.guessed[id])) {
        sfx.fanfare();
        emojiRain(['🧠', '🎯', '😈']);
        burst({ kind: 'confetti', colors: ['#ff2e4d', '#ffd23d', '#fff'], count: 120 });
        flash('#ffd23d', 500, 0.4);
        haptic([40, 40, 40, 40, 120]);
      } else {
        sfx.fail();
        shake(12, 400);
        emojiRain(['😅', '🫠', '❌'], 16);
        haptic([200]);
      }
    }, 1750);
    return () => {
      clearTimeout(t);
      beats.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPicked]);

  if (!guesser) return null;
  const canPick = mine && dealt && !picked && !intro;
  const stateOf = (id: string): 'right' | 'wrong' | 'dim' | 'chosen' | undefined => {
    if (result) return id === civil.id ? 'right' : Object.values(picks).includes(id) ? 'wrong' : 'dim';
    if (picked) return id === picked ? 'chosen' : 'dim';
    return undefined;
  };
  const whoPicked = (id: string) =>
    result
      ? caught
          .filter((c) => picks[c] === id)
          .map((c) => P(c).name)
          .join(', ')
      : undefined;

  const handoff = !online ? (
    <div className="chip lc-pass">📱 Dale el teléfono a {P(guesser).name}</div>
  ) : me === guesser ? (
    <div className="chip lc-pass">🎯 ¡Te toca a ti!</div>
  ) : !mine ? (
    <div className="chip lc-pass">👀 Mira cómo elige</div>
  ) : (
    <div className="chip lc-pass">📱 Pásale el teléfono a {P(guesser).name}</div>
  );

  return (
    <motion.div className="grow stack content" style={{ gap: 12, minHeight: 0 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -80 }}>
      <AnimatePresence>{intro && <LastChanceIntro key="intro" player={P(guesser)} note={handoff} onDone={() => setIntro(false)} />}</AnimatePresence>

      <div className="row" style={{ gap: 14 }}>
        <div style={{ position: 'relative' }}>
          <Avatar player={P(guesser)} size={52} mood={result ? (round.guessed[guesser] ? 'happy' : 'scared') : 'talk'} />
          {!result && <Crosshair locked small />}
        </div>
        <div className="grow">
          <div className="label" style={{ color: '#ffd23d' }}>
            🎯 Última oportunidad{caught.length > 1 ? ` · ${round.guessIdx + 1} de ${caught.length}` : ''}
          </div>
          <div className="h2" style={{ fontSize: 27, lineHeight: 1.05 }}>
            {result ? 'La carta de los civiles era…' : `${P(guesser).name}, ¿cuál era la carta de los civiles?`}
          </div>
        </div>
      </div>
      {!result && (
        <div className="dim" style={{ fontSize: 13 }}>
          Una sola oportunidad. Si acierta, gana +{PTS.impGuess} aunque lo hayan atrapado.
        </div>
      )}

      <div className="scroll">
        {!intro && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gap: 8 }}>
            {options.map((o, i) => (
              <DealtOption key={o.id} i={i}>
                <MiniCard still style={{ width: '100%' }} item={o} cat={o.cat} label={whoPicked(o.id) || undefined} onClick={canPick ? () => guess(o.id) : undefined} state={stateOf(o.id)} />
              </DealtOption>
            ))}
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 10, minHeight: 64 }}>
        {intro ? null : !picked ? (
          canPick ? (
            <motion.div className="center label pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: '#ffd23d', fontSize: 14 }}>
              👆 Toca la carta que crees que tenían
            </motion.div>
          ) : (
            <div className="dim center" style={{ fontWeight: 700 }}>
              {dealt ? `${P(guesser).name} está eligiendo…` : 'Repartiendo opciones…'}
            </div>
          )
        ) : !allPicked ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
            <div className="panel center" style={{ gap: 4 }}>
              <b>🔒 Elección guardada</b>
              <span className="dim" style={{ fontSize: 13 }}>
                Nadie sabrá si acertó hasta que elijan todos.
              </span>
            </div>
            {host ? <Button onClick={() => nextGuess()}>🎯 Sigue {nextName}</Button> : <div className="dim center">Esperando al anfitrión…</div>}
          </motion.div>
        ) : !result ? (
          <motion.div className="center display" animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ fontSize: 30 }}>
            {caught.length > 1 ? '¿Alguno adivinó…?' : '¿Adivinó…?'}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
            <div className="stack" style={{ gap: 6 }}>
              {caught.map((id) => (
                <div key={id} className="row" style={{ gap: 8, justifyContent: 'center' }}>
                  <Avatar player={P(id)} size={26} />
                  <b>{P(id).name}</b>
                  <span className="display" style={{ fontSize: 24, color: round.guessed[id] ? '#39ff88' : '#ff5470' }}>
                    {round.guessed[id] ? `¡ADIVINÓ! +${PTS.impGuess}` : '¡FALLÓ!'}
                  </span>
                </div>
              ))}
            </div>
            {host ? <Button onClick={() => nextGuess()}>Ver la verdad 👁️</Button> : <div className="dim center">Esperando al anfitrión…</div>}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
