import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { burst } from '../fx/fx';
import { moreCallStatus, useGame, voteCallStatus, votersOf } from '../store/game';
import { Avatar, Button, Sheet } from './ui';

type CallKind = 'vote' | 'more';

const CALL = {
  vote: {
    off: '🗳️ Votar',
    on: '✋ Pedido',
    ask: '🗳️ ¿Quién quiere votar?',
    yes: '✋ Quiere votar',
    color: '#ff5470',
  },
  more: {
    off: '▶ Otra vuelta',
    on: '👍 Pedido',
    ask: '▶ ¿Quién quiere otra vuelta?',
    yes: '👍 Quiere otra vuelta',
    color: '#39ff88',
  },
} as const;

/**
 * Sala: botón para pedir algo con toda la mesa (votar, u otra vuelta en la reunión). Cuenta uno
 * por jugador; si en el teléfono juegan varios, cada quien decide.
 */
export function CallButton({ kind, seats, style }: { kind: CallKind; seats: string[]; style?: CSSProperties }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const callVote = useGame((s) => s.callVote);
  const callMore = useGame((s) => s.callMore);
  const [pick, setPick] = useState(false);
  const st = kind === 'vote' ? voteCallStatus(round) : moreCallStatus(round);
  const txt = CALL[kind];
  const mine = seats.filter((id) => votersOf(round).includes(id));
  const asked = mine.filter((id) => st.calls.includes(id));
  const on = mine.length > 0 && asked.length === mine.length;
  if (!mine.length) return null;

  const toggle = (id: string, v: boolean) => {
    (kind === 'vote' ? callVote : callMore)(id, v);
    if (v) {
      sfx.stamp();
      haptic([30, 30, 60]);
    } else sfx.whoosh();
  };

  return (
    <>
      <Button
        silent
        variant={kind === 'vote' ? 'danger' : undefined}
        className={`vc-btn ${kind} ${on ? 'on' : ''}`}
        style={kind === 'more' ? ({ '--accent': '#1fbf6b', ...style } as CSSProperties) : style}
        aria-pressed={on}
        onClick={() => (mine.length > 1 ? setPick(true) : toggle(mine[0], !on))}
      >
        <span className="vc-label">{on ? txt.on : txt.off}</span>
        <span className="vc-count">
          {st.calls.length} de {st.need}
        </span>
      </Button>
      <Sheet open={pick} onClose={() => setPick(false)}>
        <div className="h2">{txt.ask}</div>
        <div className="dim" style={{ fontSize: 13, lineHeight: 1.45 }}>
          Cada jugador de este teléfono cuenta por separado.{' '}
          {kind === 'vote' ? `Con ${st.need} de ${st.total} se vota${round.meeting ? ' ya' : ' al terminar la vuelta'}.` : `Con ${st.need} de ${st.total} se juega otra vuelta.`}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {mine.map((id) => {
            const p = players.find((x) => x.id === id)!;
            const yes = st.calls.includes(id);
            return (
              <motion.button key={id} whileTap={{ scale: 0.96 }} className={`panel row vc-seat ${kind} ${yes ? 'on' : ''}`} onClick={() => toggle(id, !yes)} aria-pressed={yes}>
                <Avatar player={p} size={36} />
                <b className="grow" style={{ textAlign: 'left' }}>
                  {p.name}
                </b>
                <span className="label" style={{ color: yes ? txt.color : undefined }}>
                  {yes ? txt.yes : 'Toca para pedir'}
                </span>
              </motion.button>
            );
          })}
        </div>
        <Button small onClick={() => setPick(false)}>
          Listo
        </Button>
      </Sheet>
    </>
  );
}

/** Sala: botón rojo para pedir que se vote (con mayoría se vota al terminar la vuelta). */
export const VoteCallButton = (props: { seats: string[]; style?: CSSProperties }) => <CallButton kind="vote" {...props} />;

/** Sala: cuántos piden votar y qué va a pasar. Solo aparece cuando alguien ya lo pidió. */
export function VoteCallBar() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const st = voteCallStatus(round);
  const prev = useRef(st.ready);

  // Al juntarse la mayoría: aviso para toda la mesa.
  useEffect(() => {
    if (st.ready && !prev.current) {
      sfx.challenge();
      haptic([60, 40, 120]);
      burst({
        kind: 'sparks',
        colors: ['#ff2e4d', '#fff', '#ffb3c0'],
        count: 40,
        y: window.innerHeight * 0.75,
      });
    }
    prev.current = st.ready;
  }, [st.ready]);

  return (
    <AnimatePresence>
      {st.calls.length > 0 && (
        <motion.div
          className={`vc-bar content ${st.ready ? 'ready' : ''}`}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <div className="row" style={{ gap: 8 }}>
            <span className="vc-icon">{st.ready ? '🗳️' : '✋'}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b>{st.ready ? '¡La mayoría quiere votar!' : `${st.calls.length} de ${st.total} quieren votar`}</b>
              <small>
                {st.ready
                  ? 'Se vota al terminar esta vuelta. Si lo piden todos, se vota ya.'
                  : `Con ${st.need} se vota al terminar la vuelta${st.need - st.calls.length === 1 ? ': falta 1' : `: faltan ${st.need - st.calls.length}`}.`}
              </small>
            </div>
            <div className="vc-avatars">
              {st.calls.slice(0, 6).map((id) => {
                const p = players.find((x) => x.id === id);
                return p ? (
                  <motion.span key={id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                    <Avatar player={p} size={24} still />
                  </motion.span>
                ) : null;
              })}
            </div>
          </div>
          <div className="vc-meter">
            <motion.div
              className="vc-fill"
              animate={{
                width: `${Math.min(100, (st.calls.length / st.total) * 100)}%`,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
            <div className="vc-mark" style={{ left: `${(st.need / st.total) * 100}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
