import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { ChallengeOverlay } from '../components/ChallengeOverlay';
import { Avatar, Button, Glitch, IconButton } from '../components/ui';
import { CAT } from '../data/categories';
import { CHALLENGES, KIND_META } from '../data/challenges';
import { EVENTS } from '../engine/events';
import { THEME_BY_ID } from '../data/themes';
import { burst, flash, shake } from '../fx/fx';
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

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Reloj de toda la ronda de pistas. Se basa en la hora de inicio, así sobrevive a recargas. */
function RoundClock({ endsAt, total, onTimeUp }: { endsAt: number; total: number; onTimeUp: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, (endsAt - Date.now()) / 1000));
  useEffect(() => {
    let lastSec = Math.ceil(left);
    let warned = left <= 60;
    let fired = false;
    const id = setInterval(() => {
      const l = Math.max(0, (endsAt - Date.now()) / 1000);
      setLeft(l);
      const sec = Math.ceil(l);
      if (sec !== lastSec) {
        lastSec = sec;
        if (!warned && sec <= 60 && total > 60) {
          warned = true;
          sfx.riser(1);
          haptic([60, 40, 60]);
        }
        if (sec <= 10 && sec > 0) {
          sfx.tick(true);
          haptic(20);
        }
      }
      if (l <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        onTimeUp();
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  const urgent = left <= 10;
  const warn = left <= 60;
  const color = urgent ? '#ff2e4d' : warn ? '#ffb547' : '#fff';
  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={urgent ? { repeat: Infinity, duration: 1 } : undefined}
      className="panel row"
      style={{ padding: '6px 12px', gap: 8, borderColor: color, boxShadow: warn ? `0 0 20px ${color}66` : undefined, position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${(left / total) * 100}%`, background: color, transition: 'width .2s linear' }} />
      <span style={{ fontSize: 16 }}>⏱️</span>
      <span className="display" style={{ fontSize: 26, color, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(left)}
      </span>
    </motion.div>
  );
}

function ModeratorPicker({ onPick }: { onPick: (id: string) => void }) {
  const players = useGame((s) => s.players);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        background: 'rgba(5,3,10,.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 16px calc(var(--safe-b) + 16px)',
        gap: 16,
      }}
    >
      <div className="center" style={{ gap: 6 }}>
        <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ fontSize: 56 }}>
          📱
        </motion.div>
        <div className="h2">¿Quién será el encargado?</div>
        <div className="dim" style={{ maxWidth: 320, lineHeight: 1.45, fontSize: 14 }}>
          Esa persona sostiene el teléfono y toca <b>Siguiente</b> cuando cada jugador dé su pista. Ya no hace falta pasarlo.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxWidth: 520, width: '100%', margin: '0 auto' }}>
        {players.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sfx.select();
              haptic(15);
              onPick(p.id);
            }}
            className="panel center"
            style={{ gap: 6, padding: 12 }}
          >
            <Avatar player={p} size={48} />
            <b style={{ fontSize: 14 }}>{p.name}</b>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

export function Discuss() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { nextTurn, dismissChallenge, toggleCursed, go, setModerator } = useGame();
  const moderatorId = useGame((s) => s.session.moderator);
  const [cursedSheet, setCursedSheet] = useState(false);
  const [pickMod, setPickMod] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const cat = theme ? { emoji: theme.emoji, name: theme.name, color: theme.color, horror: theme.horror } : CAT[round.cat];
  const moderator = players.find((p) => p.id === moderatorId);
  const needsModerator = !moderator || pickMod;
  const pid = round.order[round.turn];
  const player = players.find((p) => p.id === pid)!;
  const event = round.event && !EVENTS[round.event].secret ? EVENTS[round.event] : undefined;
  const turnKey = `${round.lap}-${round.turn}`;
  const activeCh = round.challenges[pid] ? CHALLENGES.find((c) => c.id === round.challenges[pid]) : undefined;
  const isLastTurn = round.laps > 0 && round.lap === round.laps && round.turn === round.order.length - 1;
  const pending = round.pendingChallenge === pid && !needsModerator;

  const onTimeUp = () => {
    setTimeUp(true);
    sfx.impostor();
    haptic([200, 80, 200]);
    flash('#ff2e4d', 700, 0.6);
    shake(18, 600);
    burst({ kind: 'sparks', colors: ['#ff2e4d', '#fff'], count: 50 });
  };

  // Al acabarse el tiempo se pasa solo a votar (se cancela si ya salieron de la pantalla).
  useEffect(() => {
    if (!timeUp) return;
    const t = setTimeout(() => go('vote'), 3200);
    return () => clearTimeout(t);
  }, [timeUp, go]);

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
            Ronda {round.n} · Vuelta {round.lap}
            {round.laps > 0 ? `/${round.laps}` : ''}
            {round.accused.length ? ` · Quedan ${round.order.length - round.accused.length}` : ''}
            {theme ? ' · 🔀 Mezcla' : ''}
          </div>
          <div className={`display ${cat.horror ? 'horror-font' : ''}`} style={{ fontSize: 24, color: cat.color }}>
            {cat.emoji} {cat.name}
          </div>
        </div>
        {round.roundTime > 0 && round.startedAt ? (
          <RoundClock endsAt={round.startedAt + round.roundTime * 1000} total={round.roundTime} onTimeUp={onTimeUp} />
        ) : null}
      </div>

      <div className="row content" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {moderator && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPickMod(true)} className="panel row" style={{ padding: '5px 10px', gap: 6, fontSize: 12 }}>
            <span>📱</span>
            <Avatar player={moderator} size={22} />
            <b>{moderator.name}</b>
            <span className="dim">controla</span>
          </motion.button>
        )}
        {event && (
          <div className="panel" style={{ padding: '6px 10px', fontSize: 12, fontWeight: 800 }}>
            {event.emoji} {event.title}
          </div>
        )}
      </div>

      {round.event === 'oneword' && (
        <div className="panel row content" style={{ padding: '10px 14px', marginBottom: 8, borderColor: 'var(--accent)' }}>
          <span style={{ fontSize: 22 }}>☝️</span>
          <b style={{ fontSize: 13 }}>Esta ronda: pistas de UNA sola palabra</b>
        </div>
      )}
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
          const done = i < round.turn;
          const out = round.accused.includes(id);
          return (
            <motion.div
              key={id}
              animate={{ scale: i === round.turn ? 1.2 : out ? 0.8 : 1, opacity: i === round.turn ? 1 : out ? 0.25 : done ? 0.35 : 0.7 }}
              style={{ position: 'relative' }}
            >
              <Avatar
                player={p}
                size={30}
                style={{ boxShadow: i === round.turn ? `0 0 0 3px #fff, 0 0 16px ${p.color}` : undefined, filter: out ? 'grayscale(1)' : undefined }}
              />
              {out && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 16 }}>💀</span>}
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
              Di <b>{round.event === 'oneword' ? 'UNA sola palabra' : 'una palabra o frase'}</b> sobre tu carta. Ni muy obvia… ni muy vaga.
            </div>
            {moderator && (
              <div className="dim" style={{ fontSize: 12.5 }}>
                📱 {moderator.name} toca <b>Siguiente</b> cuando termine
              </div>
            )}
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

      <div className="row content" style={{ gap: 8 }}>
        <Button onClick={() => nextTurn()} variant={isLastTurn ? 'danger' : 'plain'} style={{ flex: 2 }}>
          {isLastTurn ? '🗳️ ¡A votar!' : 'Siguiente ➜'}
        </Button>
        {!isLastTurn && (
          <Button variant="danger" onClick={() => go('vote')} style={{ flex: 1, fontSize: 22 }}>
            🗳️ Votar
          </Button>
        )}
      </div>

      <AnimatePresence>
        {pending && round.challenges[pid] && (
          <ChallengeOverlay key={turnKey} player={player} challengeId={round.challenges[pid]} onAccept={dismissChallenge} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {needsModerator && (
          <ModeratorPicker
            onPick={(id) => {
              setModerator(id);
              setPickMod(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {timeUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'fixed', inset: 0, zIndex: 46, background: 'rgba(40,0,10,.85)', display: 'grid', placeItems: 'center', padding: 16 }}
          >
            <motion.div initial={{ scale: 3, rotate: -15 }} animate={{ scale: 1, rotate: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="center" style={{ gap: 12 }}>
              <div style={{ fontSize: 80 }}>⏰</div>
              <div className="h1" style={{ color: '#ff2e4d', textShadow: '0 0 30px #ff2e4d' }}>
                <Glitch text="¡SE ACABÓ EL TIEMPO!" hard />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Hora de votar…</div>
              <Button variant="danger" onClick={() => go('vote')} style={{ maxWidth: 320 }}>
                🗳️ Votar ahora
              </Button>
            </motion.div>
          </motion.div>
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
