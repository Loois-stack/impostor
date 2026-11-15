import { motion } from 'framer-motion';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { Button, TopBar } from '../components/ui';
import { hostRoom, invite, joinRoom, normalizeCode, validCode } from '../net/net';
import { useNet } from '../net/state';
import { useGame } from '../store/game';
import { usePrefs } from '../store/prefs';

const field = {
  width: '100%',
  height: 56,
  borderRadius: 16,
  border: '1px solid var(--line)',
  background: 'rgba(0,0,0,.35)',
  padding: '0 16px',
  fontSize: 18,
  fontWeight: 700,
  outline: 'none',
} as const;

/** Crear una sala o entrar a una: cada jugador con su propio teléfono. */
export function Online() {
  const go = useGame((s) => s.go);
  const saved = usePrefs((s) => s.name);
  const { status, error, lastCode } = useNet();
  const [name, setName] = useState(saved);
  // Con el código del enlace o, si se cayó la conexión, el de la última sala: volver es un toque.
  const [code, setCode] = useState(invite || lastCode || '');
  const busy = status === 'connecting';
  const named = name.trim().length > 0;

  return (
    <div className="screen">
      <TopBar title="📡 Varios teléfonos" onBack={() => go('home')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 16 }}>
          <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
            Cada quien juega desde su teléfono: ve su carta en privado, vota en secreto y nadie tiene que pasar nada. Estén juntos o en videollamada.
          </div>

          <label className="stack" style={{ gap: 6 }}>
            <span className="label">Tu nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="¿Cómo te dicen?" maxLength={16} enterKeyHint="done" style={field} />
          </label>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="panel" style={{ borderColor: '#ff2e4d', background: 'rgba(255,46,77,.12)', fontSize: 14, lineHeight: 1.4 }}>
              ⚠️ {error}
            </motion.div>
          )}

          <div className="panel stack" style={{ gap: 10 }}>
            <div className="display" style={{ fontSize: 26 }}>
              🏠 Crear una sala
            </div>
            <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
              Tú diriges la partida: eliges las reglas y das inicio. Los demás entran con un código o escaneando un QR.
            </div>
            <Button
              disabled={!named || busy}
              onClick={() => {
                sfx.whoosh();
                void hostRoom(name.trim());
              }}
            >
              {busy ? 'Abriendo…' : 'Crear sala'}
            </Button>
          </div>

          <div className="panel stack" style={{ gap: 10 }}>
            <div className="display" style={{ fontSize: 26 }}>
              🚪 Entrar a una sala
            </div>
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="CÓDIGO"
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-label="Código de la sala"
              className="code-input"
            />
            <Button
              variant="plain"
              disabled={!named || busy || !validCode(code)}
              onClick={() => {
                sfx.whoosh();
                void joinRoom(code, name.trim());
              }}
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </Button>
          </div>

          <div className="dim center" style={{ fontSize: 12, lineHeight: 1.5, padding: '0 8px 8px' }}>
            Este modo necesita internet. ¿Sin señal? Jueguen con un solo teléfono: ese modo funciona sin conexión.
          </div>
        </div>
      </div>
    </div>
  );
}
