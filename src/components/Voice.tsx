import { motion } from 'framer-motion';
import { useState, type CSSProperties } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { useSeat } from '../net/state';
import { joinVoice, leaveVoice, setMic, useVoice, voiceSupported } from '../net/voice';
import { useGame, type Player } from '../store/game';
import { Avatar, Button, Sheet } from './ui';

/** ¿Está hablando este jugador? (su teléfono, o el teléfono donde juega). */
export function useTalking(p?: Pick<Player, 'id' | 'owner'>) {
  const talking = useVoice((s) => s.talking);
  return !!p && talking.includes(p.owner ?? p.id);
}

/** Micrófono del jugador en la llamada: abierto, silenciado o fuera de la llamada. */
export function useMicState(p?: Pick<Player, 'id' | 'owner'>): 'on' | 'muted' | null {
  const roster = useVoice((s) => s.roster);
  if (!p) return null;
  const e = roster[p.owner ?? p.id];
  return e ? (e.mic ? 'on' : 'muted') : null;
}

const toggleMic = (on: boolean) => {
  haptic(15);
  if (on) sfx.select();
  else sfx.tap();
  void setMic(on);
};

/** Botones de la llamada: entrar, abrir o silenciar el micrófono y salir. */
export function VoiceControls({ big }: { big?: boolean }) {
  const { joined, mic, asking, error } = useVoice();
  if (!voiceSupported())
    return (
      <div className="dim" style={{ fontSize: 12.5 }}>
        Este navegador no permite usar el micrófono.
      </div>
    );
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!joined ? (
        <div className="row" style={{ gap: 8 }}>
          <Button
            onClick={() => {
              haptic(20);
              void joinVoice(true);
            }}
            style={
              {
                flex: 2,
                fontSize: big ? 20 : 17,
                '--accent': '#1fbf6b',
              } as CSSProperties
            }
          >
            🎙️ Hablar con todos
          </Button>
          <Button variant="ghost" onClick={() => void joinVoice(false)} style={{ flex: 1, fontSize: 15 }}>
            🎧 Solo oír
          </Button>
        </div>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <Button silent className={`mic-btn ${mic ? 'on' : 'off'}`} disabled={asking} aria-pressed={mic} onClick={() => toggleMic(!mic)} style={{ flex: 2, fontSize: big ? 20 : 17 }}>
            {asking ? '⏳ Pidiendo permiso…' : mic ? '🎙️ Micrófono abierto' : '🔇 Silenciado'}
          </Button>
          <Button variant="ghost" onClick={() => leaveVoice()} style={{ flex: 1, fontSize: 15 }}>
            📴 Salir
          </Button>
        </div>
      )}
      {error && (
        <div className="dim" style={{ fontSize: 12.5, color: '#ff8a9a' }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** Quiénes están en la llamada, con su micrófono y si están hablando. */
function CallList() {
  const roster = useVoice((s) => s.roster);
  const talking = useVoice((s) => s.talking);
  const players = useGame((s) => s.players);
  const phones = Object.keys(roster)
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  if (!phones.length)
    return (
      <div className="dim" style={{ fontSize: 13 }}>
        Nadie está en la llamada todavía.
      </div>
    );
  return (
    <div className="call-list">
      {phones.map((p) => (
        <div key={p.id} className={`call-who ${talking.includes(p.id) ? 'talking' : ''}`}>
          <Avatar player={p} size={40} still />
          <small>{p.name}</small>
          <span className="call-mic">{roster[p.id].mic ? '🎙️' : '🔇'}</span>
        </div>
      ))}
    </div>
  );
}

/** Explicación y controles completos de la llamada. */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="h2">📞 Llamada de la sala</div>
      <div className="dim" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
        Hablen en tiempo real por el altavoz, como en una llamada. Ideal si no están en el mismo lugar. Si están juntos, mejor sin llamada: los teléfonos hacen eco.
      </div>
      <CallList />
      <VoiceControls />
      <Button small variant="ghost" onClick={onClose}>
        Listo
      </Button>
    </Sheet>
  );
}

/** Botón flotante de la llamada: entrar, y ya adentro, abrir o silenciar el micrófono con un toque. */
export function VoiceFab() {
  const { joined, mic, asking, roster } = useVoice();
  const { me } = useSeat();
  const talking = useVoice((s) => !!me && s.talking.includes(me));
  const [open, setOpen] = useState(false);
  if (!voiceSupported()) return null;
  const count = Object.keys(roster).length;
  return (
    <>
      <div className={`voice-fab ${joined ? 'joined' : ''}`}>
        {joined && (
          <motion.button className="vf-people" whileTap={{ scale: 0.9 }} onClick={() => setOpen(true)} aria-label="Ver la llamada">
            👥 {count}
          </motion.button>
        )}
        <motion.button
          className={`vf-main ${joined ? (mic ? 'on' : 'off') : ''} ${talking ? 'talking' : ''}`}
          whileTap={{ scale: 0.85 }}
          disabled={asking}
          aria-label={!joined ? 'Llamada de voz' : mic ? 'Silenciar micrófono' : 'Abrir micrófono'}
          aria-pressed={joined ? mic : undefined}
          onClick={() => (joined ? toggleMic(!mic) : setOpen(true))}
        >
          {asking ? '⏳' : !joined ? '📞' : mic ? '🎙️' : '🔇'}
          {!joined && count > 0 && <span className="vf-count">{count}</span>}
        </motion.button>
      </div>
      <VoiceSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
