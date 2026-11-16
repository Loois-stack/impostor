import { AnimatePresence, motion } from 'framer-motion';
import { Emo } from '../components/Emo';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { EventCard } from '../components/EventCard';
import { EventOverlay } from '../components/EventOverlay';
import { LeaveSheet } from '../components/LeaveGame';
import { Meeting } from '../components/Meeting';
import { useTalking } from '../components/Voice';
import { PlayerCard } from '../components/PlayerCard';
import { VoteCallBar, VoteCallButton } from '../components/VoteCall';
import { Avatar, Button, Glitch, IconButton, Overlay, Sheet } from '../components/ui';
import { CAT } from '../data/categories';
import { KIND_META } from '../data/challenges';
import { THEME_BY_ID } from '../data/themes';
import { ACCENT_BY_ID } from '../engine/events';
import { burst, flash, shake } from '../fx/fx';
import { now } from '../net/clock';
import { isHere, useNet, useSeat } from '../net/state';
import { activeTurnEvent, isLastTurn, useGame, type Player } from '../store/game';
import { shownEvent } from '../store/view';

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

/** Reloj de toda la fase de pistas. Se basa en la hora de inicio, así sobrevive a recargas. */
function RoundClock({ endsAt, total, onTimeUp }: { endsAt: number; total: number; onTimeUp: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, (endsAt - now()) / 1000));
  useEffect(() => {
    let lastSec = Math.ceil(left);
    let warned = left <= 60;
    let fired = false;
    const id = setInterval(() => {
      const l = Math.max(0, (endsAt - now()) / 1000);
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
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${Math.min(100, (left / total) * 100)}%`, background: color, transition: 'width .2s linear' }} />
      <span style={{ fontSize: 16 }}>⏱️</span>
      <span className="display" style={{ fontSize: 26, color, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(left)}
      </span>
    </motion.div>
  );
}

/** Aro verde alrededor del avatar de quien está hablando en la llamada. */
function TalkRing({ player, children }: { player: Player; children: ReactNode }) {
  const talking = useTalking(player);
  return <div className={`talk-ring ${talking ? 'talking' : ''}`}>{children}</div>;
}

function PlayerGrid({ players, onPick, marked }: { players: Player[]; onPick: (id: string) => void; marked?: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, maxWidth: 520, width: '100%', margin: '0 auto' }}>
      {players.map((p, i) => {
        const on = marked?.includes(p.id);
        return (
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
            style={{ gap: 6, padding: 12, borderColor: on ? '#ff2e4d' : undefined, background: on ? 'rgba(255,46,77,.2)' : undefined }}
          >
            <Avatar player={p} size={48} />
            <b style={{ fontSize: 14 }}>
              {p.name} {on ? '☠️' : ''}
            </b>
          </motion.button>
        );
      })}
    </div>
  );
}

export function Discuss() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const adult = useGame((s) => s.settings.adult);
  const { nextTurn, dismissChallenge, toggleCursed, go, setModerator, openVote, pauseRound, endMeeting } = useGame();
  const moderatorId = useGame((s) => s.session.moderator);
  const { online, me, host, seats } = useSeat();
  const present = useNet((s) => s.present);
  const [sheet, setSheet] = useState<'cursed' | 'event' | 'menu' | 'pickMod' | 'pickPeek' | 'leave' | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);

  const P = (id: string) => players.find((p) => p.id === id)!;
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const cat = theme ? { emoji: theme.emoji, name: theme.name, color: theme.color, horror: theme.horror } : CAT[round.cat];
  const moderator = players.find((p) => p.id === moderatorId);
  const needsModerator = !online && (!moderator || sheet === 'pickMod');
  const pid = round.order[round.turn];
  const player = P(pid);
  const event = shownEvent(round);
  const accent = round.accent ? ACCENT_BY_ID[round.accent] : undefined;
  const turnKey = `${round.talks}-${round.lap}-${round.turn}`;
  const pending = round.pendingChallenge === pid && !needsModerator;
  const turnEv = pending ? undefined : activeTurnEvent(round, pid);
  const judge = host && turnEv && !turnEv.round;
  // En sala: el turno es "mío" si es de este teléfono (yo o alguien que juega en él).
  const myTurn = online && seats.includes(pid);
  const left = round.left ?? [];
  const myRoundSeats = round.order.filter((id) => seats.includes(id) && !round.accused.includes(id) && !left.includes(id));
  const last = isLastTurn(round);
  const playing = !online || myRoundSeats.length > 0;
  // Efectos públicos que duran toda la ronda (acentos, reglas…), de quien no está en turno.
  const effects = round.order.filter((id) => id !== pid && activeTurnEvent(round, id)?.round);
  const missions = Object.keys(round.missions).length;
  // Sala: al terminar cada vuelta, reunión para discutir (sin turnos).
  const meeting = online && !!round.meeting;

  const onTimeUp = () => {
    setTimeUp(true);
    sfx.impostor();
    haptic([200, 80, 200]);
    flash('#ff2e4d', 700, 0.6);
    shake(18, 600);
    burst({ kind: 'sparks', colors: ['#ff2e4d', '#fff'], count: 50 });
  };

  // Al acabarse el tiempo se pasa solo a votar (lo dispara quien dirige la partida).
  useEffect(() => {
    if (!timeUp || !host) return;
    const t = setTimeout(() => openVote(), 3200);
    return () => clearTimeout(t);
  }, [timeUp, host, openVote]);

  useEffect(() => {
    if (!pending) {
      sfx.whoosh();
      haptic(myTurn ? [30, 40, 60] : 12);
    }
  }, [turnKey, pending, myTurn]);

  const pass = (result?: boolean) => {
    if (result === true) {
      sfx.coin();
      burst({ kind: 'sparks', count: 24, colors: ['#39ff88', '#fff'] });
    } else if (result === false) sfx.fail();
    nextTurn(result);
  };

  return (
    <div className="screen">
      <div className="topbar content">
        <IconButton label="Menú" onClick={() => setSheet('menu')}>
          ☰
        </IconButton>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="label">
            Ronda {round.n} · Vuelta {round.lap}
            {round.laps > 0 ? `/${round.laps}` : ''}
            {round.accused.length ? ` · Quedan ${round.order.length - round.accused.length}` : ''}
            {theme ? ' · 🔀 Mezcla' : ''}
          </div>
          <div className={`display ${cat.horror ? 'horror-font' : ''}`} style={{ fontSize: 24, color: cat.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cat.emoji} {cat.name}
          </div>
        </div>
        {round.clock > 0 && round.startedAt ? (
          <RoundClock key={round.startedAt} endsAt={round.startedAt + round.clock * 1000} total={round.clock} onTimeUp={onTimeUp} />
        ) : null}
      </div>

      <div className="row content" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {moderator && !online && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSheet('pickMod')} className="chip">
            <span>📱</span>
            <Avatar player={moderator} size={20} />
            <b>{moderator.name}</b>
          </motion.button>
        )}
        {event && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSheet('event')}
            className="chip"
            style={{ borderColor: event.color, background: `color-mix(in srgb, ${event.color} 18%, transparent)` }}
          >
            <Emo e={event.emoji} /> <b>{event.title}</b>
            {event.rule ? <span className="dim">· {event.rule}</span> : null}
          </motion.button>
        )}
        {(round.declared > 1 || round.hidden === 'mystery') && (
          <div className="chip" style={{ borderColor: '#ff2e4d88' }}>
            🔪 <b>×{round.declared}{round.hidden === 'mystery' ? '?' : ''}</b> <span className="dim">impostores{round.team ? ' en equipo' : ''}</span>
          </div>
        )}
        {missions > 0 && (
          <div className="chip" title="Misiones secretas en juego">
            🤫 <b>×{missions}</b> <span className="dim">{missions === 1 ? 'misión secreta' : 'misiones secretas'}</span>
          </div>
        )}
      </div>

      {accent && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSheet('event')} className="banner content" style={{ '--ev': '#19c37d' } as CSSProperties}>
          <span style={{ fontSize: 22 }}>
            <Emo e={accent.emoji} anim="hop" />
          </span>
          <span className="grow" style={{ textAlign: 'left' }}>
            <b>Todos hablan como {accent.name}</b>
            <small>{accent.how}</small>
          </span>
          {adult && <span>🌶️</span>}
        </motion.button>
      )}
      {round.cursedWord && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSheet('cursed')} className="banner content" style={{ '--ev': '#ff2e4d' } as CSSProperties}>
          <span style={{ fontSize: 22 }}>
            <Emo e="☠️" />
          </span>
          <span className="grow" style={{ textAlign: 'left' }}>
            <b>
              Palabra maldita: <span style={{ color: '#ff5470' }}>“{round.cursedWord}”</span>
            </b>
            <small>{round.cursed.length ? `La dijeron: ${round.cursed.map((id) => P(id).name).join(', ')}` : 'Toca aquí si alguien la dice'}</small>
          </span>
        </motion.button>
      )}

      {!meeting && (
        <div className="row content" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {round.order.map((id, i) => {
            const p = P(id);
            const done = i < round.turn;
            const out = round.accused.includes(id);
            const gone = left.includes(id);
            const ev = activeTurnEvent(round, id);
            const off = online && !isHere(p, present);
            return (
              <motion.div
                key={id}
                animate={{ scale: i === round.turn ? 1.2 : out || gone ? 0.8 : 1, opacity: i === round.turn ? 1 : out || gone ? 0.25 : done ? 0.4 : 0.75 }}
                style={{ position: 'relative' }}
              >
                <TalkRing player={p}>
                  <Avatar
                    player={p}
                    size={30}
                    style={{ boxShadow: i === round.turn ? `0 0 0 3px #fff, 0 0 16px ${p.color}` : undefined, filter: out ? 'grayscale(1)' : undefined }}
                  />
                </TalkRing>
                {out ? (
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 16 }}>💀</span>
                ) : gone ? (
                  <span className="badge">🚪</span>
                ) : off ? (
                  <span className="badge">📵</span>
                ) : ev ? (
                  <span className="badge">{KIND_META[ev.kind].emoji}</span>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      )}

      {meeting ? (
        <Meeting key={round.meeting!.since} seats={myRoundSeats} />
      ) : (
          <div className="grow center content" style={{ minHeight: 0 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={turnKey}
                className="center"
                style={{ gap: 14 }}
                initial={{ x: 200, opacity: 0, rotateY: -40 }}
                animate={{ x: 0, opacity: 1, rotateY: 0 }}
                exit={{ x: -200, opacity: 0, rotateY: 40 }}
                transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              >
                <div className="label">{myTurn ? (pid === me ? '¡Es tu turno!' : 'Turno de (en tu teléfono)') : 'Turno de'}</div>
                <div style={{ position: 'relative', width: 144, height: 144, display: 'grid', placeItems: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: player.color, filter: 'blur(20px)' }}
                  />
                  <Avatar player={player} size={120} mood={pending ? undefined : 'talk'} />
                  {round.timer > 0 && !pending && <TurnTimer seconds={round.timer} turnKey={turnKey} />}
                </div>
                <div className="h1" style={{ color: player.color, textShadow: `0 0 30px ${player.color}88`, marginTop: round.timer ? 18 : 0 }}>
                  {player.name}
                </div>
                {turnEv ? (
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    className="turn-event"
                    style={{ '--ev': KIND_META[turnEv.kind].color } as CSSProperties}
                  >
                    <div className="label" style={{ color: KIND_META[turnEv.kind].color }}>
                      ⚡ Evento especial · <Emo e={KIND_META[turnEv.kind].emoji} size={14} /> {KIND_META[turnEv.kind].label}
                    </div>
                    <div style={{ fontSize: 16, lineHeight: 1.35, fontWeight: 800 }}>{turnEv.text}</div>
                    <div className="dim" style={{ fontSize: 11.5 }}>
                      {turnEv.round ? '⏳ Le dura toda la ronda' : '⏱️ Se quita cuando pase el turno'}
                    </div>
                  </motion.div>
                ) : (
                  <div style={{ fontSize: 17, lineHeight: 1.4, maxWidth: 300 }}>
                    {round.event === 'mime' ? (
                      <>
                        Da tu pista <b>solo con mímica</b>. Ni una palabra. 🤐
                      </>
                    ) : (
                      <>
                        Di <b>{round.event === 'oneword' ? 'UNA sola palabra' : 'una palabra o frase'}</b> sobre tu carta. Ni muy obvia… ni muy vaga.
                      </>
                    )}
                  </div>
                )}
                {moderator && !online && (
                  <div className="dim" style={{ fontSize: 12.5 }}>
                    📱 {moderator.name} toca {judge ? 'si cumplió o no' : <b>Siguiente</b>} cuando termine
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
      )}

      {effects.length > 0 && !meeting && (
        <div className="stack content" style={{ gap: 4, marginBottom: 8 }}>
          {effects.map((id) => {
            const ev = activeTurnEvent(round, id)!;
            return (
              <div key={id} className="effect" style={{ '--ev': KIND_META[ev.kind].color } as CSSProperties}>
                <Avatar player={P(id)} size={20} />
                <span>
                  <b>{P(id).name}</b> · {ev.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="stack content" style={{ gap: 8 }}>
        {/* En sala, cualquiera pide votar con el botón rojo; con mayoría se vota al terminar la vuelta. */}
        {online && !meeting && <VoteCallBar />}
        {meeting ? null : host ? (
          judge ? (
            <div className="row" style={{ gap: 8 }}>
              <Button silent onClick={() => pass(true)} style={{ flex: 1, fontSize: 22, '--accent': '#1fbf6b' } as CSSProperties}>
                ✅ Cumplió
              </Button>
              <Button silent variant="danger" onClick={() => pass(false)} style={{ flex: 1, fontSize: 22 }}>
                ❌ Falló
              </Button>
              {online ? (
                <VoteCallButton seats={myRoundSeats} style={{ width: 96, flexShrink: 0, minHeight: 60, fontSize: 18 }} />
              ) : (
                <Button variant="ghost" onClick={() => openVote()} style={{ width: 62, flexShrink: 0, minHeight: 60 }} aria-label="Votar ya">
                  🗳️
                </Button>
              )}
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Button onClick={() => pass()} variant={last ? 'danger' : 'plain'} style={{ flex: 2 }}>
                {last ? '🗳️ ¡A votar!' : 'Siguiente ➜'}
              </Button>
              {!last &&
                (online ? (
                  <VoteCallButton seats={myRoundSeats} style={{ flex: 1, fontSize: 22 }} />
                ) : (
                  <Button variant="danger" onClick={() => openVote()} style={{ flex: 1, fontSize: 22 }}>
                    🗳️ Votar
                  </Button>
                ))}
            </div>
          )
        ) : myTurn ? (
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={() => pass()} style={{ flex: 2 }}>
              {pid === me ? 'Terminé mi turno ➜' : `Terminó ${player.name} ➜`}
            </Button>
            <VoteCallButton seats={myRoundSeats} style={{ flex: 1, fontSize: 22 }} />
          </div>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <div className="dim grow" style={{ fontWeight: 700, minHeight: 44, display: 'flex', alignItems: 'center' }}>
              Escucha la pista de {player.name}…
            </div>
            <VoteCallButton seats={myRoundSeats} style={{ flex: '0 0 46%', fontSize: 22 }} />
          </div>
        )}
        {online && playing && (
          <Button variant="ghost" small onClick={() => (myRoundSeats.length > 1 ? setSheet('pickPeek') : setPeek(myRoundSeats[0]))}>
            🃏 {myRoundSeats.length > 1 ? 'Ver una carta de este teléfono' : 'Ver mi carta'}
          </Button>
        )}
      </div>

      <AnimatePresence>
        {pending && round.challenges[pid] && (
          <EventOverlay
            key={turnKey}
            player={player}
            challengeId={round.challenges[pid]}
            onAccept={dismissChallenge}
            canAccept={host || myTurn}
            mine={online && pid === me}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {needsModerator && (
          <Overlay z={45} tint="rgba(5,3,10,.9)">
            <div className="center" style={{ gap: 6 }}>
              <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ fontSize: 56 }}>
                📱
              </motion.div>
              <div className="h2">¿Quién será el encargado?</div>
              <div className="dim" style={{ maxWidth: 320, lineHeight: 1.45, fontSize: 14 }}>
                Esa persona sostiene el teléfono y toca <b>Siguiente</b> cuando cada jugador dé su pista. Ya no hace falta pasarlo.
              </div>
            </div>
            <PlayerGrid
              players={players}
              onPick={(id) => {
                setModerator(id);
                setSheet(null);
              }}
            />
          </Overlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {peek && (
          <Overlay z={47} tint="rgba(5,3,10,.94)">
            <div className="row" style={{ gap: 8 }}>
              <Avatar player={P(peek)} size={30} />
              <b>{P(peek).name}</b>
              <span className="dim">· solo tú 🤫</span>
            </div>
            <PlayerCard playerId={peek} />
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Button variant="ghost" onClick={() => setPeek(null)}>
                Cerrar
              </Button>
            </div>
          </Overlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {timeUp && (
          <Overlay z={46} tint="rgba(40,0,10,.88)">
            <motion.div initial={{ scale: 3, rotate: -15 }} animate={{ scale: 1, rotate: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="center" style={{ gap: 12 }}>
              <div style={{ fontSize: 80 }}>
                <Emo e="⏰" anim="shake" />
              </div>
              <div className="h1" style={{ color: '#ff2e4d', textShadow: '0 0 30px #ff2e4d' }}>
                <Glitch text="¡SE ACABÓ EL TIEMPO!" hard />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Hora de votar…</div>
              {host && (
                <Button variant="danger" onClick={() => openVote()} style={{ maxWidth: 320 }}>
                  🗳️ Votar ahora
                </Button>
              )}
            </motion.div>
          </Overlay>
        )}
      </AnimatePresence>

      <Sheet open={sheet === 'event' && !!event} onClose={() => setSheet(null)}>
        {event && <EventCard event={event} cursedWord={round.cursedWord} accent={round.accent} adult={adult} still />}
        <Button small onClick={() => setSheet(null)}>
          Entendido
        </Button>
      </Sheet>

      <Sheet open={sheet === 'cursed'} onClose={() => setSheet(null)}>
        <div className="h2">
          <Glitch text="☠️ ¿Quién dijo la palabra?" />
        </div>
        <div className="dim" style={{ fontSize: 13 }}>
          Cada uno pierde 50 puntos al final de la ronda.
        </div>
        <PlayerGrid
          players={round.order.map(P)}
          marked={round.cursed}
          onPick={(id) => {
            if (!round.cursed.includes(id)) {
              sfx.fail();
              shake(6, 300);
            }
            toggleCursed(id);
          }}
        />
        <Button small onClick={() => setSheet(null)}>
          Listo
        </Button>
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)}>
        <div className="h2">Pausa</div>
        {!online && (
          <>
            <Button variant="ghost" small onClick={() => setSheet('pickPeek')}>
              🃏 Volver a ver una carta
            </Button>
            <Button variant="ghost" small onClick={() => setSheet('pickMod')}>
              📱 Cambiar al encargado
            </Button>
          </>
        )}
        {host && online && (
          <Button
            variant="ghost"
            small
            onClick={() => {
              setSheet(null);
              openVote();
            }}
          >
            🗳️ Votar ya, sin esperar
          </Button>
        )}
        {host && meeting && (
          <Button
            variant="ghost"
            small
            onClick={() => {
              setSheet(null);
              endMeeting();
            }}
          >
            ▶ Otra vuelta ya, sin esperar
          </Button>
        )}
        {host && (
          <Button variant="ghost" small onClick={() => (online ? pauseRound() : go('home'))}>
            {online ? '🏠 Volver a la sala' : '🏠 Salir al menú'}
          </Button>
        )}
        {online && (
          <Button variant="ghost" small onClick={() => setSheet('leave')}>
            🚪 Salir de la partida
          </Button>
        )}
        <Button small onClick={() => setSheet(null)}>
          Seguir jugando
        </Button>
      </Sheet>

      <LeaveSheet open={sheet === 'leave'} onClose={() => setSheet(null)} />

      <Sheet open={sheet === 'pickPeek'} onClose={() => setSheet(null)}>
        <div className="h2">¿Quién olvidó su carta?</div>
        <div className="dim" style={{ fontSize: 13 }}>
          Pásale el teléfono: solo esa persona debe ver la pantalla.
        </div>
        <PlayerGrid
          players={(online ? myRoundSeats : round.order.filter((id) => !round.accused.includes(id))).map(P)}
          onPick={(id) => {
            setSheet(null);
            setPeek(id);
          }}
        />
      </Sheet>
    </div>
  );
}
