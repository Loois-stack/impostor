import { motion } from 'framer-motion';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { leaveRoom } from '../net/net';
import { useSeat } from '../net/state';
import { useGame } from '../store/game';
import { Button, Sheet } from './ui';

/** Sala: "¿Estás seguro?" antes de salir de la partida. */
export function LeaveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const players = useGame((s) => s.players);
  const round = useGame((s) => s.round);
  const { host, me } = useSeat();
  const [leaving, setLeaving] = useState(false);
  const mates = players.filter((p) => p.owner && p.owner === me).map((p) => p.name);
  const inRound = !!round && !round.result;
  return (
    <Sheet open={open} onClose={onClose} z={70}>
      <motion.div initial={{ rotate: -12, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} style={{ fontSize: 48, textAlign: 'center' }}>
        🚪
      </motion.div>
      <div className="h2 center">¿Estás seguro?</div>
      <div className="dim center" style={{ fontSize: 14, lineHeight: 1.45 }}>
        {host
          ? 'Eres el anfitrión: si sales, la sala se cierra para todos y se termina la partida.'
          : inRound
            ? `Vas a salir de la partida.${mates.length ? ` ${mates.join(', ')} también ${mates.length > 1 ? 'saldrán' : 'saldrá'} (${mates.length > 1 ? 'juegan' : 'juega'} en tu teléfono).` : ''} Los demás seguirán jugando sin ti.`
            : 'Vas a salir de la sala. Puedes volver a entrar con el mismo código mientras siga abierta.'}
      </div>
      <Button
        variant="danger"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          sfx.whoosh();
          void leaveRoom();
        }}
      >
        {host ? '🚪 Sí, cerrar la sala' : '🚪 Sí, salir'}
      </Button>
      <Button variant="ghost" small onClick={onClose}>
        No, seguir jugando
      </Button>
    </Sheet>
  );
}

/** Botón para salir, en las pantallas de la partida que no tienen menú propio. */
export function LeaveFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        className="leave-fab"
        aria-label="Salir de la partida"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.85 }}
        onClick={() => {
          sfx.tap();
          setOpen(true);
        }}
      >
        🚪
      </motion.button>
      <LeaveSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
