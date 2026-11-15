import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { PlayerCard } from '../components/PlayerCard';
import { glowHalo, glowOf, MiniPack, PackShuffle, PersonalPack } from '../components/PackOpening';
import { Avatar, Button, Handoff } from '../components/ui';
import { CAT } from '../data/categories';
import { fallbackPack, type PackRoll } from '../data/packs';
import { THEME_BY_ID } from '../data/themes';
import { isHere, useNet, useSeat } from '../net/state';
import { useGame, type Round } from '../store/game';

export function Deal() {
  const { online } = useSeat();
  return online ? <DealOnline /> : <DealLocal />;
}

/** El sobre que le tocó a un jugador (las rondas viejas, sin sobres guardados, usan uno de respaldo). */
const rollFor = (round: Round, id: string): PackRoll => round.packs?.[id] ?? fallbackPack(round.n, round.order, id);

/** Al empezar la ronda: los sobres de todos se barajan frente a la mesa. */
function RoundShuffle({ onDone }: { onDone: () => void }) {
  const round = useGame((s) => s.round)!;
  // Revueltos: el orden en que caen no dice de quién es cada sobre.
  // Se calcula una sola vez: en sala la ronda cambia cada vez que alguien marca "listo".
  const [rolls] = useState(() => [...round.order].sort(() => Math.random() - 0.5).map((id) => rollFor(round, id)));
  return <PackShuffle rolls={rolls} onDone={onDone} />;
}

/** El sobre personal de un jugador; al abrirlo, su carta secreta aparece en el mismo lugar. */
function PlayerPack({ playerId, onSeen, onOpened }: { playerId: string; onSeen: () => void; onOpened: () => void }) {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const roll = rollFor(round, playerId);
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const c = CAT[round.cat];
  const edition = theme ? `${theme.emoji} Edición ${theme.name}` : `${c.emoji} Edición ${c.name}`;
  return (
    <PersonalPack roll={roll} owner={players.find((p) => p.id === playerId)?.name ?? ''} edition={edition} onOpened={onOpened}>
      <PlayerCard playerId={playerId} onSeen={onSeen} glow={glowHalo(glowOf(roll))} />
    </PersonalPack>
  );
}

/** Pila de sobres que faltan por abrir. */
function PackPile({ rolls }: { rolls: PackRoll[] }) {
  const shown = rolls.slice(0, 6).reverse();
  return (
    <div style={{ position: 'relative', width: 96, height: 100, marginBottom: 4 }}>
      {shown.map((r, i) => (
        <motion.div
          key={i}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: -i * 3, opacity: 1, rotate: (i % 2 ? 1 : -1) * 4 }}
          transition={{ delay: i * 0.04 }}
          style={{ position: 'absolute', left: 22, top: 8, width: 54, height: 87 }}
        >
          <MiniPack roll={r} style={{ position: 'absolute', inset: 0 }} />
        </motion.div>
      ))}
      <div className="label" style={{ position: 'absolute', right: -30, top: 38 }}>
        ×{rolls.length}
      </div>
    </div>
  );
}

/** Lo que va abajo mientras alguien tiene su sobre en la mano. */
function CardButtonText({ opened, seen, done }: { opened: boolean; seen: boolean; done: string }) {
  return <>{!opened ? 'Primero abre tu sobre ✂️' : !seen ? 'Primero mira tu carta' : done}</>;
}

/** Un solo teléfono: se pasa de mano en mano y cada quien ve su carta en secreto. */
function DealLocal() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const dealNext = useGame((s) => s.dealNext);
  // Solo se baraja antes de la primera carta de la ronda.
  const [phase, setPhase] = useState<'shuffle' | 'pass' | 'card'>(round.dealIdx === 0 ? 'shuffle' : 'pass');
  const [opened, setOpened] = useState(false);
  const [seen, setSeen] = useState(false);
  const player = players[round.dealIdx];
  if (!player) return null;
  const last = round.dealIdx === players.length - 1;
  const theme = round.theme ? THEME_BY_ID[round.theme] : undefined;
  const color = theme?.color ?? CAT[round.cat].color;
  const left = players.slice(round.dealIdx).map((p) => rollFor(round, p.id));

  const next = () => {
    sfx.whoosh();
    haptic(15);
    setSeen(false);
    setOpened(false);
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
            <RoundShuffle onDone={() => setPhase('pass')} />
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
            <PackPile rolls={left} />
            <Handoff />
            <div className="label">Pasa el teléfono a</div>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 14 }}>
              <Avatar player={player} size={120} mood="happy" />
            </motion.div>
            <div className="h1" style={{ color: player.color, textShadow: `0 0 30px ${player.color}88` }}>
              {player.name}
            </div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Tiene un sobre esperándole. Que nadie más vea la pantalla. 🤫
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`card-${round.dealIdx}`}
            className="grow center content"
            style={{ gap: 14 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ y: -300, opacity: 0, rotate: -12, scale: 0.8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="row" style={{ gap: 8 }}>
              <Avatar player={player} size={30} />
              <b>{player.name}</b>
              <span className="dim">· {opened ? 'tu carta secreta' : 'tu sobre'}</span>
            </div>
            <PlayerPack playerId={player.id} onSeen={() => setSeen(true)} onOpened={() => setOpened(true)} />
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
            <CardButtonText opened={opened} seen={seen} done={last ? '¡Todos listos! 🔥' : 'Listo, pasar ➜'} />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Sala: cada quien ve su carta en su propio teléfono, todos al mismo tiempo. Si en un teléfono
 * juegan varias personas, se lo van pasando como en el modo de un solo teléfono.
 */
function DealOnline() {
  const round = useGame((s) => s.round)!;
  const players = useGame((s) => s.players);
  const { markReady, beginDiscuss } = useGame();
  const { me, host, seats } = useSeat();
  const present = useNet((s) => s.present);
  const [shuffling, setShuffling] = useState(round.ready.length === 0);
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  // Marcados como listos en este teléfono (por si la confirmación del anfitrión tarda un momento).
  const [sent, setSent] = useState<string[]>([]);
  const mine = round.order.filter((id) => seats.includes(id));
  const pending = mine.filter((id) => !round.ready.includes(id) && !sent.includes(id));
  const current = pending[0];
  const P = (id: string) => players.find((p) => p.id === id)!;
  const waiting = round.order.filter((id) => !round.ready.includes(id));
  // A quien es dueño del teléfono se le muestra directo; a los demás, primero "pásale el teléfono".
  const needsPass = !!current && (current !== me || mine.length > 1) && !open;

  const done = () => {
    if (!current) return;
    sfx.whoosh();
    haptic(15);
    setSent((l) => [...l, current]);
    setSeen(false);
    setOpen(false);
    setOpened(false);
    markReady(current);
  };

  return (
    <div className="screen">
      <div className="row content" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {round.order.map((id) => {
          const p = P(id);
          const ok = round.ready.includes(id);
          return (
            <motion.div key={id} animate={{ opacity: ok ? 1 : 0.45, scale: ok ? 1 : 0.9 }} style={{ position: 'relative' }}>
              <Avatar player={p} size={30} />
              <span className="badge">{ok ? '✅' : isHere(p, present) ? '👀' : '📵'}</span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {shuffling ? (
          <motion.div key="shuffle" className="grow center content" exit={{ opacity: 0 }}>
            <RoundShuffle onDone={() => setShuffling(false)} />
          </motion.div>
        ) : !mine.length ? (
          <motion.div key="watch" className="grow center content" style={{ gap: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ fontSize: 64 }}>🍿</div>
            <div className="h2">Entraste a media ronda</div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Mira cómo se acusan entre ellos. Te toca carta en la siguiente ronda.
            </div>
          </motion.div>
        ) : !current ? (
          <motion.div key="ready" className="grow center content" style={{ gap: 12 }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} style={{ fontSize: 64 }}>
              🃏
            </motion.div>
            <div className="h2">{mine.length > 1 ? 'Todos en este teléfono están listos' : '¡Listo!'}</div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Esperando a {waiting.length ? waiting.map((id) => P(id).name).join(', ') : 'todos'}…
            </div>
          </motion.div>
        ) : needsPass ? (
          <motion.div
            key={`pass-${current}`}
            className="grow center content"
            style={{ gap: 16 }}
            initial={{ x: 120, opacity: 0, rotate: 6 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: -120, opacity: 0, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <PackPile rolls={pending.map((id) => rollFor(round, id))} />
            {current !== me && <Handoff />}
            <div className="label">{current === me ? 'Tu sobre' : 'Pasa el teléfono a'}</div>
            <Avatar player={P(current)} size={110} mood="happy" />
            <div className="h1" style={{ color: P(current).color, textShadow: `0 0 30px ${P(current).color}88` }}>
              {P(current).name}
            </div>
            <div className="dim" style={{ maxWidth: 300, lineHeight: 1.45 }}>
              Que nadie más vea la pantalla. 🤫
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`card-${current}`}
            className="grow center content"
            style={{ gap: 14 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ y: -300, opacity: 0, rotate: -12, scale: 0.8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="row dim" style={{ fontWeight: 700, gap: 8 }}>
              <Avatar player={P(current)} size={26} />
              {current === me ? (opened ? 'Tu carta secreta · que nadie más la vea 🤫' : 'Tu sobre · ábrelo sin que nadie vea 🤫') : `${opened ? 'Carta' : 'Sobre'} de ${P(current).name} 🤫`}
            </div>
            <PlayerPack playerId={current} onSeen={() => setSeen(true)} onOpened={() => setOpened(true)} />
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
            {current &&
              (needsPass ? (
                <Button
                  onClick={() => {
                    sfx.flip();
                    setOpen(true);
                  }}
                >
                  Soy {P(current).name} 👀
                </Button>
              ) : (
                <Button disabled={!seen} onClick={done}>
                  <CardButtonText opened={opened} seen={seen} done={pending.length > 1 ? 'Listo, pasar ➜' : 'Ya la vi, listo ✔'} />
                </Button>
              ))}
            {host && !current && waiting.length > 0 && (
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
