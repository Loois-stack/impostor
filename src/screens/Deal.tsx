import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { CardBack } from '../components/GameCard';
import { PlayerCard } from '../components/PlayerCard';
import { ShuffleDeck } from '../components/ShuffleDeck';
import { Avatar, Button } from '../components/ui';
import { CAT } from '../data/categories';
import { THEME_BY_ID } from '../data/themes';
import { useNet, useSeat } from '../net/state';
import { useGame } from '../store/game';

export function Deal() {
  const { online } = useSeat();
  return online ? <DealOnline /> : <DealLocal />;
}

/** Un solo teléfono: se pasa de mano en mano y cada quien ve su carta en secreto. */
function DealLocal() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const dealNext = useGame((s) => s.dealNext);
  // Solo se baraja antes de la primera carta de la ronda.
  const [phase, setPhase] = useState<'shuffle' | 'pass' | 'card'>(round.dealIdx === 0 ? 'shuffle' : 'pass');
  const [seen, setSeen] = useState(false);
  const player = players[round.dealIdx];
  if (!player) return null;
  const last = round.dealIdx === players.length - 1;
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const color = theme?.color ?? CAT[round.cat].color;
  const remaining = players.length - round.dealIdx;

  const next = () => {
    sfx.whoosh();
    haptic(15);
    setSeen(false);
    setPhase('pass');
    dealNext();
  };

  return (
    <div className="screen">
      <div className="row content" style={{ justifyContent: 'center', gap: 6, marginBottom: 8 }}>
        {players.map((p, i) => (
          <motion.div
            key={p.id}
            animate={{
              width: i === round.dealIdx ? 26 : 8,
              background: i < round.dealIdx ? color : i === round.dealIdx ? '#fff' : 'rgba(255,255,255,.2)',
            }}
            style={{ height: 8, borderRadius: 8 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'shuffle' ? (
          <motion.div key="shuffle" className="grow center content" exit={{ opacity: 0 }}>
            <ShuffleDeck onDone={() => setPhase('pass')} />
          </motion.div>
        ) : phase === 'pass' ? (
          <motion.div
            key={`pass-${round.dealIdx}`}
            className="grow center content"
            style={{ gap: 18 }}
            initial={{ x: 120, opacity: 0, rotate: 6 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -120, opacity: 0, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div style={{ position: 'relative', width: 70, height: 66, marginBottom: 4 }}>
              {Array.from({ length: Math.min(remaining, 8) }, (_, i) => (
                <motion.div
                  key={i}
                  className="mini-back"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: -i * 2, opacity: 1, rotate: (i % 2 ? 1 : -1) * 3 }}
                  transition={{ delay: i * 0.03 }}
                  style={{ position: 'absolute', left: 12, top: 0, width: 46, height: 64, borderRadius: 7 }}
                >
                  <CardBack small />
                </motion.div>
              ))}
              <div className="label" style={{ position: 'absolute', right: -34, top: 22 }}>
                ×{remaining}
              </div>
            </div>
            <div className="label">Pasa el teléfono a</div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>
              <Avatar player={player} size={120} />
            </motion.div>
            <div className="h1" style={{ color: player.color, textShadow: `0 0 30px ${player.color}88` }}>
              {player.name}
            </div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Que nadie más vea la pantalla. 🤫
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`card-${round.dealIdx}`}
            className="grow center content"
            style={{ gap: 14 }}
            initial={{ y: -420, opacity: 0, scale: 0.4, rotate: -25 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -300, opacity: 0, rotate: -12, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="row" style={{ gap: 8 }}>
              <Avatar player={player} size={30} />
              <b>{player.name}</b>
              <span className="dim">· tu carta secreta</span>
            </div>
            <PlayerCard playerId={player.id} onSeen={() => setSeen(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="content" style={{ paddingTop: 12 }}>
        {phase === 'shuffle' ? (
          <Button variant="ghost" small onClick={() => setPhase('pass')}>
            Saltar animación ⏭
          </Button>
        ) : phase === 'pass' ? (
          <Button
            onClick={() => {
              sfx.flip();
              setPhase('card');
            }}
          >
            Soy {player.name} 👀
          </Button>
        ) : (
          <Button disabled={!seen} onClick={next} variant={last ? 'primary' : 'plain'}>
            {!seen ? 'Primero mira tu carta' : last ? '¡Todos listos! 🔥' : 'Listo, pasar ➜'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Sala: cada quien ve su carta en su propio teléfono, todos al mismo tiempo. */
function DealOnline() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { markReady, beginDiscuss } = useGame();
  const { me, host } = useSeat();
  const present = useNet((s) => s.present);
  const [shuffling, setShuffling] = useState(round.ready.length === 0);
  const [seen, setSeen] = useState(false);
  const playing = !!me && round.order.includes(me);
  const ready = !!me && round.ready.includes(me);
  const waiting = round.order.filter((id) => !round.ready.includes(id));

  return (
    <div className="screen">
      <div className="row content" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {round.order.map((id) => {
          const p = players.find((x) => x.id === id)!;
          const ok = round.ready.includes(id);
          return (
            <motion.div key={id} animate={{ opacity: ok ? 1 : 0.45, scale: ok ? 1 : 0.9 }} style={{ position: 'relative' }}>
              <Avatar player={p} size={30} />
              <span className="badge">{ok ? '✅' : present.includes(id) ? '👀' : '📵'}</span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {shuffling ? (
          <motion.div key="shuffle" className="grow center content" exit={{ opacity: 0 }}>
            <ShuffleDeck onDone={() => setShuffling(false)} />
          </motion.div>
        ) : !playing ? (
          <motion.div key="watch" className="grow center content" style={{ gap: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ fontSize: 64 }}>🍿</div>
            <div className="h2">Entraste a media ronda</div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Mira cómo se acusan entre ellos. Te toca carta en la siguiente ronda.
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="card"
            className="grow center content"
            style={{ gap: 14 }}
            initial={{ y: -420, opacity: 0, scale: 0.4, rotate: -25 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="dim" style={{ fontWeight: 700 }}>
              Tu carta secreta · que nadie más la vea 🤫
            </div>
            <PlayerCard playerId={me!} onSeen={() => setSeen(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        {shuffling ? (
          <Button variant="ghost" small onClick={() => setShuffling(false)}>
            Saltar animación ⏭
          </Button>
        ) : (
          <>
            {playing &&
              (ready ? (
                <div className="dim center" style={{ fontWeight: 700 }}>
                  ✅ Listo. Esperando a {waiting.length ? waiting.map((id) => players.find((p) => p.id === id)?.name).join(', ') : 'todos'}…
                </div>
              ) : (
                <Button
                  disabled={!seen}
                  onClick={() => {
                    sfx.whoosh();
                    haptic(15);
                    markReady(me!);
                  }}
                >
                  {seen ? 'Ya la vi, listo ✔' : 'Primero mira tu carta'}
                </Button>
              ))}
            {host && (ready || !playing) && waiting.length > 0 && (
              <Button variant="ghost" small onClick={() => beginDiscuss()}>
                Empezar sin esperar ⏭
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
