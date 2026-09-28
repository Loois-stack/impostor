import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { ChallengeOverlay } from '../components/ChallengeOverlay';
import { Avatar, Button, Glitch, IconButton } from '../components/ui';
import { CAT } from '../data/categories';
import { CHALLENGES, KIND_META } from '../data/challenges';
import { EVENTS } from '../engine/events';
import { shake } from '../fx/fx';
import { useGame } from '../store/game';

function TurnTimer({ seconds, turnKey }: { seconds: number; turnKey: string }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const start = Date.now();
    let lastSec = seconds;
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - start) / 1000);
      setLeft(l);
      const s = Math.ceil(l);
      if (s !== lastSec) {
        lastSec = s;
        if (s <= 5 && s > 0) {
          sfx.tick(true);
          haptic(15);
        } else if (s > 0) sfx.tick();
        if (s === 0) {
          sfx.fail();
          haptic([100, 50, 100]);
          shake(8, 400);
        }
      }
      if (l <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [seconds, turnKey]);

  const R = 70;
  const C = 2 * Math.PI * R;
  const urgent = left <= 5;
  return (
    <svg width="168" height="168" viewBox="0 0 168 168" style={{ position: 'absolute', inset: -12 }}>
      <circle cx="84" cy="84" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
      <circle
        cx="84"
        cy="84"
        r={R}
        fill="none"
        stroke={urgent ? '#ff2e4d' : 'var(--accent)'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - left / seconds)}
        transform="rotate(-90 84 84)"
        style={{ transition: 'stroke-dashoffset .1s linear, stroke .3s', filter: `drop-shadow(0 0 8px ${urgent ? '#ff2e4d' : 'var(--accent)'})` }}
      />
      <text x="84" y="160" textAnchor="middle" fill={urgent ? '#ff2e4d' : '#fff'} fontSize="18" fontWeight="900" fontFamily="Inter">
        {left > 0 ? Math.ceil(left) : '¡TIEMPO!'}
      </text>
    </svg>
  );
}

export function Discuss() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { nextTurn, dismissChallenge, toggleCursed, go } = useGame();
  const [cursedSheet, setCursedSheet] = useState(false);
  const cat = CAT[round.cat];
  const pid = round.order[round.turn];
  const player = players.find((p) => p.id === pid)!;
  const event = round.event && !EVENTS[round.event].secret ? EVENTS[round.event] : undefined;
  const turnKey = `${round.lap}-${round.turn}`;
  const activeCh = round.challenges[pid] ? CHALLENGES.find((c) => c.id === round.challenges[pid]) : undefined;
  const isLastTurn = round.lap === round.laps && round.turn === round.order.length - 1;
  const canVote = round.lap > 1 || round.turn === round.order.length - 1;
  const pending = round.pendingChallenge === pid;

  useEffect(() => {
    if (!pending) {
      sfx.whoosh();
      haptic(12);
    }
  }, [turnKey, pending]);

  return (
    <div className="screen">
      <div className="topbar content">
        <IconButton label="Salir al menú" onClick={() => go('home')}>
          ☰
        </IconButton>
        <div className="grow">
          <div className="label">
            Ronda {round.n} · Vuelta {round.lap}/{round.laps}
          </div>
          <div className={`display ${cat.horror ? 'horror-font' : ''}`} style={{ fontSize: 24, color: cat.color }}>
            {cat.emoji} {cat.name}
          </div>
        </div>
        {event && (
          <div className="panel" style={{ padding: '6px 10px', fontSize: 12, fontWeight: 800 }}>
            {event.emoji} {event.title}
          </div>
        )}
      </div>

      {round.cursedWord && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setCursedSheet(true)}
          className="panel row content"
          style={{ padding: '10px 14px', borderColor: '#ff2e4d88', background: 'rgba(255,46,77,.12)', marginBottom: 8 }}
        >
          <span style={{ fontSize: 22 }}>☠️</span>
          <span className="grow" style={{ textAlign: 'left', fontSize: 13 }}>
            Palabra maldita: <b style={{ color: '#ff5470' }}>“{round.cursedWord}”</b>
          </span>
          <span className="label" style={{ color: '#fff' }}>
            ¿Alguien la dijo?
          </span>
        </motion.button>
      )}

      <div className="row content" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {round.order.map((id, i) => {
          const p = players.find((x) => x.id === id)!;
          const done = round.lap > 1 ? i < round.turn || round.lap > round.laps : i < round.turn;
          return (
            <motion.div key={id} animate={{ scale: i === round.turn ? 1.2 : 1, opacity: i === round.turn ? 1 : done ? 0.35 : 0.7 }}>
              <Avatar player={p} size={30} style={{ boxShadow: i === round.turn ? `0 0 0 3px #fff, 0 0 16px ${p.color}` : undefined }} />
            </motion.div>
          );
        })}
      </div>

      <div className="grow center content">
        <AnimatePresence mode="wait">
          <motion.div
            key={turnKey}
            className="center"
            style={{ gap: 16 }}
            initial={{ x: 200, opacity: 0, rotateY: -40 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            exit={{ x: -200, opacity: 0, rotateY: 40 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          >
            <div className="label">Turno de</div>
            <div style={{ position: 'relative', width: 144, height: 144, display: 'grid', placeItems: 'center' }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: player.color, filter: 'blur(20px)' }}
              />
              <Avatar player={player} size={120} />
              {round.timer > 0 && !pending && <TurnTimer seconds={round.timer} turnKey={turnKey} />}
            </div>
            <div className="h1" style={{ color: player.color, textShadow: `0 0 30px ${player.color}88`, marginTop: round.timer ? 18 : 0 }}>
              {player.name}
            </div>
            <div style={{ fontSize: 17, lineHeight: 1.4, maxWidth: 300 }}>
              Di <b>una palabra o frase</b> sobre tu carta. Ni muy obvia… ni muy vaga.
            </div>
            {activeCh && !pending && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="panel row"
                style={{ padding: '8px 12px', borderColor: KIND_META[activeCh.kind].color, fontSize: 13, maxWidth: 330, textAlign: 'left' }}
              >
                <span style={{ fontSize: 20 }}>{KIND_META[activeCh.kind].emoji}</span>
                <span>{activeCh.secret ? 'Tiene un reto secreto activo 🤫' : activeCh.text}</span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="stack content" style={{ gap: 8 }}>
        <Button onClick={() => nextTurn()} variant={isLastTurn ? 'danger' : 'plain'}>
          {isLastTurn ? '🗳️ ¡A votar!' : 'Siguiente ➜'}
        </Button>
        {canVote && !isLastTurn && (
          <Button variant="ghost" small onClick={() => go('vote')}>
            🗳️ Votar ya
          </Button>
        )}
      </div>

      <AnimatePresence>
        {pending && round.challenges[pid] && (
          <ChallengeOverlay key={turnKey} player={player} challengeId={round.challenges[pid]} onAccept={dismissChallenge} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cursedSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCursedSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end' }}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="panel stack"
              style={{ width: '100%', maxWidth: 560, margin: '0 auto', borderRadius: '26px 26px 0 0', padding: '20px 16px calc(var(--safe-b) + 20px)', background: '#140f1f' }}
            >
              <div className="h2">
                <Glitch text="☠️ ¿Quién dijo la palabra?" />
              </div>
              <div className="dim" style={{ fontSize: 13 }}>
                Cada uno pierde 50 puntos al final de la ronda.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {players.map((p) => {
                  const on = round.cursed.includes(p.id);
                  return (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        toggleCursed(p.id);
                        if (!on) {
                          sfx.fail();
                          shake(6, 300);
                        } else sfx.tap();
                      }}
                      className="panel row"
                      style={{ padding: 10, borderColor: on ? '#ff2e4d' : undefined, background: on ? 'rgba(255,46,77,.2)' : undefined }}
                    >
                      <Avatar player={p} size={30} />
                      <b style={{ fontSize: 14 }}>{p.name}</b>
                      {on && <span style={{ marginLeft: 'auto' }}>☠️</span>}
                    </motion.button>
                  );
                })}
              </div>
              <Button small onClick={() => setCursedSheet(false)}>
                Listo
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
