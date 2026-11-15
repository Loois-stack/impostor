import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { giveUp, retryNow } from '../net/net';
import { useNet } from '../net/state';
import { Button, Overlay } from './ui';

/** Después de unos segundos sin conexión ya no basta el aviso de arriba: se ofrece qué hacer. */
const SHOW_AFTER_MS = 8000;

/**
 * Invitado sin conexión con el anfitrión: sigue reintentando solo, pero se puede reintentar ya o
 * volver al menú principal. Si no regresa, al final lo lleva a "Entrar a una sala" con el código puesto.
 */
export function ConnectionLost() {
  const role = useNet((s) => s.role);
  const status = useNet((s) => s.status);
  const lostSince = useNet((s) => s.lostSince);
  const giveUpAt = useNet((s) => s.giveUpAt);
  const code = useNet((s) => s.code);
  const [now, setNow] = useState(() => Date.now());
  const lost = role === 'guest' && status === 'reconnecting' && !!lostSince;

  useEffect(() => {
    if (!lost) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lost]);

  const elapsed = lost ? now - lostSince! : 0;
  const show = lost && elapsed >= SHOW_AFTER_MS;
  const left = Math.max(0, Math.ceil(((giveUpAt ?? now) - now) / 1000));

  return (
    <AnimatePresence>
      {show && (
        <Overlay z={80} tint="rgba(5,3,10,.92)">
          <motion.div animate={{ rotate: [-10, 10, -10], scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ fontSize: 64 }}>
            📡
          </motion.div>
          <div className="h2">Se perdió la conexión con la sala</div>
          <div className="dim" style={{ maxWidth: 320, lineHeight: 1.45, fontSize: 14 }}>
            Seguimos intentando reconectar. Si el anfitrión vuelve, regresas a la partida solo, justo donde ibas.
          </div>
          <div className="chip" style={{ fontSize: 13 }}>
            ⏳ En {left} s te llevamos a volver a entrar{code ? ` a la sala ${code}` : ''}
          </div>
          <div className="stack" style={{ gap: 8, width: '100%', maxWidth: 340 }}>
            <Button onClick={() => retryNow()}>🔄 Reintentar ahora</Button>
            <Button variant="ghost" small onClick={() => giveUp()}>
              🏠 Ir al menú principal
            </Button>
          </div>
        </Overlay>
      )}
    </AnimatePresence>
  );
}
