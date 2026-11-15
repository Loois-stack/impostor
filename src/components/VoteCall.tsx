import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { burst } from '../fx/fx';
import { useGame, voteCallStatus, votersOf } from '../store/game';
import { Avatar, Button, Sheet } from './ui';

/**
 * Sala: botón rojo para pedir que se vote. Cuenta uno por jugador; si en el teléfono juegan
 * varios, cada quien decide si lo pide.
 */
export function VoteCallButton({ seats, style }: { seats: string[]; style?: CSSProperties }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const callVote = useGame((s) => s.callVote);
  const [pick, setPick] = useState(false);
  const st = voteCallStatus(round);
  const mine = seats.filter((id) => votersOf(round).includes(id));
  const asked = mine.filter((id) => st.calls.includes(id));
  const on = mine.length > 0 && asked.length === mine.length;
  if (!mine.length) return null;

  const toggle = (id: string, v: boolean) => {
    callVote(id, v);
    if (v) {
      sfx.stamp();
      haptic([30, 30, 60]);
    } else sfx.whoosh();
  };

  return (
    <>
      <Button
        silent
        variant="danger"
        className={`vc-btn ${on ? 'on' : ''}`}
        style={style}
        aria-pressed={on}
        onClick={() => (mine.length > 1 ? setPick(true) : toggle(mine[0], !on))}
      >
        <span className="vc-label">{on ? '✋ Pedido' : '🗳️ Votar'}</span>
        <span className="vc-count">
          {st.calls.length} de {st.need}
        </span>
      </Button>
      <Sheet open={pick} onClose={() => setPick(false)}>
        <div className="h2">🗳️ ¿Quién quiere votar?</div>
        <div className="dim" style={{ fontSize: 13, lineHeight: 1.45 }}>
          Cada jugador de este teléfono cuenta por separado. Con {st.need} de {st.total} se vota al terminar la vuelta.
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {mine.map((id) => {
            const p = players.find((x) => x.id === id)!;
            const yes = st.calls.includes(id);
            return (
              <motion.button key={id} whileTap={{ scale: 0.96 }} className={`panel row vc-seat ${yes ? 'on' : ''}`} onClick={() => toggle(id, !yes)} aria-pressed={yes}>
                <Avatar player={p} size={36} />
                <b className="grow" style={{ textAlign: 'left' }}>
                  {p.name}
                </b>
                <span className="label" style={{ color: yes ? '#ff5470' : undefined }}>
                  {yes ? '✋ Quiere votar' : 'Toca para pedir'}
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
      burst({ kind: 'sparks', colors: ['#ff2e4d', '#fff', '#ffb3c0'], count: 40, y: window.innerHeight * 0.75 });
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
            <motion.div className="vc-fill" animate={{ width: `${Math.min(100, (st.calls.length / st.total) * 100)}%` }} transition={{ type: 'spring', stiffness: 200, damping: 24 }} />
            <div className="vc-mark" style={{ left: `${(st.need / st.total) * 100}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
