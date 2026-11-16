import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { burst, shake } from '../fx/fx';
import { now } from '../net/clock';
import { useSeat } from '../net/state';
import { MEETING_MS, moreCallStatus, useGame, voteCallStatus, votersOf, type Player } from '../store/game';
import { Avatar } from './ui';
import { useMicState, useTalking, VoiceControls } from './Voice';
import { CallButton } from './VoteCall';

/** Un jugador en la reunión: si está hablando, su micrófono y qué pidió. */
function Seat({ p, wants }: { p: Player; wants: 'vote' | 'more' | null }) {
  const talking = useTalking(p);
  const mic = useMicState(p);
  return (
    <motion.div layout className={`mt-seat ${talking ? 'talking' : ''}`}>
      <div style={{ position: 'relative' }}>
        <Avatar player={p} size={46} mood={talking ? 'talk' : undefined} />
        {mic && <span className="mt-mic">{mic === 'on' ? '🎙️' : '🔇'}</span>}
        <AnimatePresence>
          {wants && (
            <motion.span
              key={wants}
              className={`mt-wants ${wants}`}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
            >
              {wants === 'vote' ? '🗳️' : '▶'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <small>{p.name}</small>
    </motion.div>
  );
}

/** Cuenta regresiva de la reunión (con el reloj de la sala). */
function useLeft(ends: number) {
  const [left, setLeft] = useState(() => Math.max(0, ends - now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, ends - now())), 250);
    return () => clearInterval(id);
  }, [ends]);
  return left;
}

/**
 * Sala: reunión al terminar cada vuelta. Todos discuten (con la llamada de voz, si quieren) y la
 * mayoría decide: otra vuelta de pistas o votar ya.
 */
export function Meeting({ seats }: { seats: string[] }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const settleMeeting = useGame((s) => s.settleMeeting);
  const { host } = useSeat();
  const m = round.meeting!;
  const left = useLeft(m.ends);
  const [splash, setSplash] = useState(true);
  const v = voteCallStatus(round);
  const more = moreCallStatus(round);
  const voters = votersOf(round);
  const P = (id: string) => players.find((p) => p.id === id)!;
  const playing = seats.some((id) => voters.includes(id));
  const secs = Math.ceil(left / 1000);

  // Entrada: golpe y aviso para toda la mesa.
  useEffect(() => {
    sfx.slam();
    haptic([80, 50, 140]);
    shake(10, 400);
    burst({
      kind: 'sparks',
      colors: ['#ffd23f', '#fff', '#ff8a3d'],
      count: 40,
    });
    const t = setTimeout(() => setSplash(false), 1500);
    return () => clearTimeout(t);
  }, [m.since]);

  // El anfitrión cierra la reunión cuando se acaba el tiempo.
  useEffect(() => {
    if (!host) return;
    const t = setTimeout(() => settleMeeting(true), Math.max(0, m.ends - Date.now()) + 200);
    return () => clearTimeout(t);
  }, [host, m.ends, settleMeeting]);

  // Últimos segundos: tic tac.
  useEffect(() => {
    if (secs > 0 && secs <= 5) sfx.tick(true);
  }, [secs]);

  return (
    <div className="meeting content grow">
      <AnimatePresence>
        {splash && (
          <motion.div className="mt-splash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.15 }}>
            <motion.div initial={{ scale: 3, rotate: -18 }} animate={{ scale: 1, rotate: -4 }} transition={{ type: 'spring', stiffness: 320, damping: 13 }} className="center" style={{ gap: 6 }}>
              <div style={{ fontSize: 76 }}>📢</div>
              <div className="h1 mt-title">¡A DISCUTIR!</div>
              <div style={{ fontWeight: 800 }}>Terminó la vuelta {round.lap - 1}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="stack" style={{ gap: 10 }} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="mt-head">
          <span style={{ fontSize: 30 }}>🗣️</span>
          <div className="grow" style={{ minWidth: 0 }}>
            <b>Reunión · ¿quién es el impostor?</b>
            <small>Discutan lo que oyeron. Decidan: otra vuelta de pistas o votar ya.</small>
          </div>
          <div className={`mt-clock ${secs <= 10 ? 'urgent' : ''}`}>
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          </div>
        </div>
        <div className="mt-bar">
          <motion.div className="mt-fill" animate={{ width: `${(left / MEETING_MS) * 100}%` }} transition={{ ease: 'linear', duration: 0.25 }} />
        </div>

        <div className="mt-grid">
          {voters.map((id) => (
            <Seat key={id} p={P(id)} wants={v.calls.includes(id) ? 'vote' : more.calls.includes(id) ? 'more' : null} />
          ))}
        </div>

        <div className="panel stack" style={{ gap: 8, padding: 12 }}>
          <div className="label">📞 Hablen por el micrófono</div>
          <VoiceControls big />
        </div>

        <div className="mt-tally">
          <span>
            ▶ <b>{more.calls.length}</b> otra vuelta
          </span>
          <span className="dim">
            Con {v.need} de {v.total} se decide
          </span>
          <span>
            🗳️ <b>{v.calls.length}</b> votar
          </span>
        </div>
        {playing ? (
          <div className="row" style={{ gap: 8 }}>
            <CallButton kind="more" seats={seats} style={{ flex: 1, fontSize: 19 }} />
            <CallButton kind="vote" seats={seats} style={{ flex: 1, fontSize: 19 }} />
          </div>
        ) : (
          <div className="dim center" style={{ fontSize: 13 }}>
            Ya no juegas esta ronda: solo puedes escuchar y opinar.
          </div>
        )}
        <div className="dim center" style={{ fontSize: 11.5 }}>
          Si se acaba el tiempo, gana lo que más se pidió; si empatan, se juega otra vuelta.
        </div>
      </motion.div>
    </div>
  );
}
