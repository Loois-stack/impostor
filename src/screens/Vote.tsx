import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Emo } from '../components/Emo';
import { useEffect, useRef, useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { Avatar, Button, Glitch, Handoff } from '../components/ui';
import { NOBODY } from '../engine/vote';
import { shake } from '../fx/fx';
import { isHere, useNet, useSeat } from '../net/state';
import { roundStatus, suspectsNeeded, useGame, type Player } from '../store/game';

const HOLD_MS = 1100;

/** Boleta: se eligen `need` sospechosos (o "no hay impostor") y se confirma manteniendo presionado. */
function Ballot({
  players,
  alive,
  need,
  onConfirm,
  holdLabel,
}: {
  players: Player[];
  alive: string[];
  need: number;
  onConfirm: (sel: string[], nobody: boolean) => void;
  holdLabel: string;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [nobody, setNobody] = useState(false);
  const fill = useAnimationControls();
  const timer = useRef(0);
  const beat = useRef(0);
  const ready = nobody || sel.length === need;

  const pick = (id: string) => {
    if (!alive.includes(id)) return;
    sfx.select();
    haptic(12);
    setNobody(false);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : need === 1 ? [id] : s.length >= need ? [...s.slice(1), id] : [...s, id]));
  };

  const holdEnd = () => {
    clearTimeout(timer.current);
    clearInterval(beat.current);
    fill.stop();
    void fill.start({ scaleX: 0, transition: { duration: 0.25 } });
  };
  const holdStart = () => {
    if (!ready) return;
    haptic(10);
    void fill.start({ scaleX: 1, transition: { duration: HOLD_MS / 1000, ease: 'linear' } });
    sfx.heartbeat();
    beat.current = window.setInterval(() => sfx.heartbeat(), 500);
    timer.current = window.setTimeout(() => {
      clearInterval(beat.current);
      shake(16, 500);
      haptic([80, 40, 120]);
      onConfirm(nobody ? [] : sel, nobody);
    }, HOLD_MS);
  };
  useEffect(() => () => {
    clearTimeout(timer.current);
    clearInterval(beat.current);
  }, []);

  return (
    <>
      <div className="scroll content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {players.map((p, i) => {
            const on = sel.includes(p.id);
            const out = !alive.includes(p.id);
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, scale: 0.6, rotate: (i % 2 ? 1 : -1) * 8 }}
                animate={{ opacity: out ? 0.3 : 1, scale: on ? 1.04 : 1, rotate: on ? (i % 2 ? 1.5 : -1.5) : 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 350, damping: 20 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => pick(p.id)}
                className={`suspect ${on ? 'on' : ''} ${out ? 'out' : ''}`}
              >
                <div className="suspect-photo">
                  <Avatar player={p} size={62} mood={on ? 'scared' : undefined} still={out} style={out ? { filter: 'grayscale(1)' } : undefined} />
                  {on && <motion.div className="crosshair" initial={{ scale: 2.4, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} />}
                </div>
                <b style={{ fontSize: 16 }}>{p.name}</b>
                {out && <span className="suspect-tag">💀 Fuera</span>}
                {on && (
                  <motion.span className="suspect-stamp" initial={{ scale: 3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -10 }}>
                    Sospechoso
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            sfx.select();
            setNobody((n) => !n);
            setSel([]);
          }}
          className={`suspect wide ${nobody ? 'on ghost' : ''}`}
        >
          <Emo e="🫥" /> Creo que NO hay impostor
        </motion.button>
      </div>

      <div className="content" style={{ paddingTop: 12 }}>
        <div
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="btn danger"
          role="button"
          style={{ opacity: ready ? 1 : 0.35, touchAction: 'none', userSelect: 'none' }}
        >
          <motion.div initial={{ scaleX: 0 }} animate={fill} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.35)', transformOrigin: 'left' }} />
          <span style={{ position: 'relative' }}>{ready ? holdLabel : need - sel.length === 1 ? 'Elige a 1 sospechoso' : `Elige ${need - sel.length} más`}</span>
        </div>
      </div>
    </>
  );
}

function Header({ n, sub }: { n: number; sub: string }) {
  return (
    <div className="center content" style={{ gap: 6, marginBottom: 14 }}>
      <div className="label">Ronda {n} · Votación</div>
      <div className="h1" style={{ fontSize: 'clamp(40px, 12vw, 58px)' }}>
        <Glitch text="¿Quién miente?" hard />
      </div>
      <div className="dim" style={{ fontSize: 14 }}>
        {sub}
      </div>
    </div>
  );
}

/** Quién ya votó (sin decir por quién). */
function VotedStrip({ players, alive, votes, present }: { players: Player[]; alive: string[]; votes: Record<string, string>; present?: string[] }) {
  return (
    <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
      {alive.map((id) => {
        const p = players.find((x) => x.id === id)!;
        const ok = !!votes[id];
        return (
          <motion.div key={id} animate={{ opacity: ok ? 1 : 0.45, scale: ok ? 1.05 : 0.92 }} className="center" style={{ gap: 4, position: 'relative' }}>
            <Avatar player={p} size={46} />
            <span className="badge">{ok ? '🗳️' : present && !isHere(p, present) ? '📵' : '🤔'}</span>
            <small style={{ fontSize: 11, fontWeight: 700 }}>{p.name}</small>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Vote() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const settings = useGame((s) => s.settings);
  const { vote, castVote, closeVote } = useGame();
  const { online, me, host, seats } = useSeat();
  const present = useNet((s) => s.present);
  const { alive } = roundStatus(round);
  const need = suspectsNeeded(round);
  const shown = round.order.map((id) => players.find((p) => p.id === id)!).filter(Boolean);
  const cast = Object.keys(round.votes).length;

  // --- Sala: cada quien vota en su teléfono ---
  if (online) {
    const myVoters = alive.filter((id) => seats.includes(id));
    const canVote = myVoters.length > 0;
    const pendingHere = myVoters.filter((id) => !round.votes[id]);
    const voted = canVote && pendingHere.length === 0;
    // Varios jugadores en este teléfono: votan pasándoselo, igual que en el modo de un teléfono.
    if (pendingHere.length && (myVoters.length > 1 || pendingHere[0] !== me))
      return <SecretPass players={players} shown={shown} alive={alive} voters={myVoters} />;
    if (pendingHere.length)
      return (
        <div className="screen">
          <Header n={round.n} sub={round.elimination ? `Voto secreto. Quedan ${alive.length}: el más votado sale.` : 'Voto secreto: elige a tu sospechoso.'} />
          <Ballot players={shown} alive={alive} need={1} holdLabel="✊ Mantén para votar" onConfirm={(sel, nobody) => castVote(me!, nobody ? NOBODY : sel[0])} />
        </div>
      );
    return (
      <div className="screen">
        <Header n={round.n} sub={`Han votado ${cast} de ${alive.length}`} />
        <div className="grow center content" style={{ gap: 22 }}>
          <div style={{ fontSize: 70 }}>
            <Emo e={voted ? '🗳️' : canVote ? '🤔' : '👻'} anim={voted ? 'jelly' : undefined} />
          </div>
          <div className="h2">
            {voted ? (myVoters.length > 1 ? 'Votos enviados' : 'Voto enviado') : !round.order.some((id) => seats.includes(id)) ? 'Solo observas esta ronda' : 'Estás fuera: ya no votas'}
          </div>
          <VotedStrip players={players} alive={alive} votes={round.votes} present={present} />
        </div>
        {host && (
          <div className="content" style={{ paddingTop: 12 }}>
            <Button variant="danger" disabled={cast === 0} onClick={() => closeVote()}>
              Cerrar votación ({cast}/{alive.length})
            </Button>
          </div>
        )}
      </div>
    );
  }

  // --- Un teléfono, voto secreto: se pasa de mano en mano ---
  if (settings.voteStyle === 'secret') return <SecretPass players={players} shown={shown} alive={alive} voters={alive} closeWhenDone />;

  // --- Un teléfono, decisión en grupo ---
  return (
    <div className="screen">
      <Header
        n={round.n}
        sub={round.elimination ? `Quedan ${alive.length}. A quien acusen sale del juego.` : `Discutan y elijan juntos ${need === 1 ? 'a 1 sospechoso' : `a ${need} sospechosos`}.`}
      />
      <Ballot players={shown} alive={alive} need={need} holdLabel="✊ Mantén para acusar" onConfirm={(sel, nobody) => vote(sel, nobody)} />
    </div>
  );
}

/**
 * Voto secreto pasando el teléfono entre `voters`. Con un solo teléfono, al terminar se cuentan
 * los votos (`closeWhenDone`); en sala, el anfitrión cierra cuando votaron todos los teléfonos.
 */
function SecretPass({ players, shown, alive, voters, closeWhenDone }: { players: Player[]; shown: Player[]; alive: string[]; voters: string[]; closeWhenDone?: boolean }) {
  const round = useGame((s) => s.round)!;
  const { castVote, closeVote } = useGame();
  const [open, setOpen] = useState(false);
  // Votos ya enviados desde aquí (en sala la confirmación del anfitrión puede tardar un instante).
  const [sent, setSent] = useState<string[]>([]);
  const pending = voters.filter((id) => !round.votes[id] && !sent.includes(id));
  const voter = players.find((p) => p.id === pending[0]);
  const done = alive.filter((id) => round.votes[id] || sent.includes(id)).length;

  // Cuando ya votaron todos, un momento de suspenso y se cuentan.
  useEffect(() => {
    if (voter || !closeWhenDone) return;
    sfx.drumroll(1.2);
    const t = setTimeout(() => closeVote(), 1300);
    return () => clearTimeout(t);
  }, [voter, closeVote, closeWhenDone]);

  return (
    <div className="screen">
      <Header n={round.n} sub={`Voto secreto · ${done} de ${alive.length}`} />
      <AnimatePresence mode="wait">
        {!voter ? (
          <motion.div key="count" className="grow center content" style={{ gap: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} style={{ fontSize: 80 }}>
              🗳️
            </motion.div>
            <div className="h2">{closeWhenDone ? 'Contando votos…' : 'Votos enviados. Esperando a los demás…'}</div>
          </motion.div>
        ) : !open ? (
          <motion.div
            key={`pass-${voter.id}`}
            className="grow center content"
            style={{ gap: 16 }}
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <Handoff />
            <div className="label">Pasa el teléfono a</div>
            <Avatar player={voter} size={110} mood="happy" />
            <div className="h1" style={{ color: voter.color, textShadow: `0 0 30px ${voter.color}88` }}>
              {voter.name}
            </div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Vota sin que nadie vea la pantalla. 🤫
            </div>
            <div style={{ width: '100%', maxWidth: 360 }}>
              <Button
                onClick={() => {
                  sfx.flip();
                  setOpen(true);
                }}
              >
                Soy {voter.name} 🗳️
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key={`ballot-${voter.id}`} className="grow" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Ballot
              players={shown}
              alive={alive}
              need={1}
              holdLabel={`✊ Mantén para votar, ${voter.name}`}
              onConfirm={(sel, nobody) => {
                setOpen(false);
                setSent((l) => [...l, voter.id]);
                castVote(voter.id, nobody ? NOBODY : sel[0]);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
