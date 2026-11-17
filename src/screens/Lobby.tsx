import { AnimatePresence, motion } from 'framer-motion';
import { ElimPicker } from '../components/Elimination';
import { Emo } from '../components/Emo';
import { useState } from 'react';
import { haptic, sfx } from '../audio/sfx';
import { QR } from '../components/QR';
import { Avatar, Button, IconButton, Sheet } from '../components/ui';
import { levelFromXp } from '../engine/scoring';
import { burst } from '../fx/fx';
import { addLocalPlayer, changeAvatar, inviteUrl, kick, leaveRoom, removeLocalPlayer } from '../net/net';
import { isHere, useNet, useSeat } from '../net/state';
import { AVATAR_CHOICES, MAX_PLAYERS, useGame } from '../store/game';

const STATUS = {
  idle: { t: 'Sin conexión', c: '#a6a0bd' },
  connecting: { t: 'Conectando…', c: '#ffb547' },
  open: { t: 'Conectados', c: '#39ff88' },
  reconnecting: { t: 'Reconectando…', c: '#ffb547' },
  error: { t: 'Sin conexión', c: '#ff2e4d' },
} as const;

/** La sala: quién está, cómo invitar a más gente y, para el anfitrión, el botón de empezar. */
export function Lobby() {
  const { players, profiles, round, session, startRound, resumeRound, go } = useGame();
  const { code, status, present } = useNet();
  const { me, host, seats } = useSeat();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const phones = players.filter((p) => !p.owner).length;
  const nameOf = (id?: string) => players.find((p) => p.id === id)?.name;
  const st = STATUS[status];
  const url = code ? inviteUrl(code) : '';
  const hostPlayer = players[0];
  const midRound = round && !round.result;
  const paused = !!midRound && !!round.pausedAt;
  // ¿Hay algún otro teléfono conectado ahora mismo?
  const othersHere = players.some((p) => !p.owner && p.id !== me && present.includes(p.id));

  const share = async () => {
    const text = `Entra a mi sala de IMPOSTOR con el código ${code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Impostor', text, url });
      else {
        await navigator.clipboard.writeText(`${text}: ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
      sfx.select();
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <div className="screen">
      <div className="topbar content">
        <IconButton label="Salir de la sala" onClick={() => setConfirm(true)}>
          ←
        </IconButton>
        <div className="title">Sala</div>
        <div className="chip" style={{ borderColor: st.c }}>
          <span className="dot" style={{ background: st.c }} /> {st.t}
        </div>
      </div>

      <div className="scroll content">
        <div className="stack" style={{ gap: 14 }}>
          {paused && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`panel paused-card ${!othersHere && host ? 'alone' : ''}`}
            >
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} style={{ fontSize: 30 }}>
                  {!othersHere && host ? '📡' : '⏸️'}
                </motion.span>
                <div className="grow">
                  <b>{!othersHere && host ? 'Se desconectaron todos' : `Ronda ${round.n} en pausa`}</b>
                  <div className="dim" style={{ fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>
                    {host
                      ? !othersHere
                        ? `La ronda ${round.n} quedó en pausa y el reloj está detenido. Cuando vuelvan a entrar con el código ${code} o el QR, toca ⏯️ Continuar ronda.`
                        : 'El reloj está detenido. Cuando estén todos, toca ⏯️ Continuar ronda y siguen justo donde se quedaron.'
                      : `${hostPlayer?.name ?? 'El anfitrión'} la va a continuar cuando estén todos. Deja esta pantalla abierta.`}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {code ? (
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="panel room-card">
              <QR text={url} size={132} />
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <div className="label">Código de la sala</div>
                <div className="room-code">
                  {[...code].map((ch, i) => (
                    <motion.span key={i} initial={{ y: -30, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 400, damping: 14 }}>
                      {ch}
                    </motion.span>
                  ))}
                </div>
                <div className="dim" style={{ fontSize: 12, lineHeight: 1.35 }}>
                  Escaneen el QR o entren a la app → <b>Varios teléfonos</b> → escriban el código.
                </div>
                <Button variant="ghost" small onClick={share}>
                  {copied ? '✅ Copiado' : '📤 Compartir enlace'}
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="panel center dim" style={{ minHeight: 120, fontWeight: 700 }}>
              {status === 'error' ? 'No se pudo conectar.' : 'Buscando la sala…'}
            </div>
          )}

          <div className="row">
            <div className="label grow">
              Jugadores · {players.length}/{MAX_PLAYERS}
            </div>
            {players.length < 3 && <div className="label">Mínimo 3</div>}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <AnimatePresence initial={false}>
              {players.map((p, i) => {
                const here = isHere(p, present);
                const mine = seats.includes(p.id);
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -40, scale: 0.9 }}
                    animate={{ opacity: here ? 1 : 0.5, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 60, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="panel row"
                    style={{ padding: '10px 12px', borderColor: p.id === me ? p.color : undefined }}
                  >
                    <motion.button whileTap={host || mine ? { scale: 0.85 } : undefined} disabled={!host && !mine} onClick={() => setEditing(p.id)} aria-label={`Cambiar avatar de ${p.name}`}>
                      <Avatar player={p} size={40} still={!here} />
                    </motion.button>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name} {p.id === me && <span className="dim">(tú)</span>}
                      </div>
                      <div className="dim" style={{ fontSize: 12, fontWeight: 700 }}>
                        {i === 0 ? '👑 Anfitrión · ' : ''}
                        {p.owner ? `📱 En el teléfono de ${nameOf(p.owner) ?? '?'} · ` : ''}
                        {here ? `Nivel ${levelFromXp(profiles[p.id]?.xp ?? 0)}` : '📵 Desconectado'}
                        {session.scores[p.id] ? ` · ${session.scores[p.id]} pts` : ''}
                      </div>
                    </div>
                    {i > 0 && !midRound && (host || (mine && p.owner)) && (
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => (p.owner ? removeLocalPlayer(p.id) : kick(p.id))}
                        className="icon-btn"
                        style={{ width: 38, height: 38, fontSize: 16 }}
                        aria-label={`Sacar a ${p.name}`}
                      >
                        ✕
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {players.length < MAX_PLAYERS && (
              <motion.button whileTap={{ scale: 0.97 }} className="panel row add-local" onClick={() => setAdding(true)}>
                <span style={{ fontSize: 24 }}>➕</span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <b>Alguien juega en este teléfono</b>
                  <small className="dim">Para quien no trae celular: verá su carta y votará pasando este teléfono.</small>
                </span>
              </motion.button>
            )}
            <div className="dim center" style={{ fontSize: 12 }}>
              📱 {phones} {phones === 1 ? 'teléfono' : 'teléfonos'} · 👥 {players.length} jugadores · máximo {MAX_PLAYERS}
            </div>
          </div>
        </div>
      </div>

      <div className="stack content" style={{ paddingTop: 12, gap: 8 }}>
        {host ? (
          <>
            {midRound && (
              <Button variant={othersHere ? 'primary' : 'ghost'} onClick={() => resumeRound()} style={othersHere ? { minHeight: 66, fontSize: 30 } : undefined}>
                ⏯️ Continuar ronda
              </Button>
            )}
            <Button
              variant={midRound ? 'ghost' : 'primary'}
              small={!!midRound}
              disabled={players.length < 3}
              onClick={() => {
                sfx.whoosh();
                haptic(20);
                burst({ kind: 'confetti', count: 60, colors: ['#7c5cff', '#2ee6ff', '#fff'] });
                startRound();
              }}
              style={midRound ? undefined : { minHeight: 66, fontSize: 30 }}
            >
              {players.length < 3 ? `Faltan ${3 - players.length} jugadores` : midRound ? '▶ Empezar otra ronda' : session.round > 0 ? '▶ Siguiente ronda' : '▶ ¡Empezar!'}
            </Button>
            <Button variant="ghost" small onClick={() => go('setup')}>
              ⚙️ Reglas de la partida
            </Button>
          </>
        ) : (
          <div className="panel center" style={{ gap: 6 }}>
            <div style={{ fontSize: 34 }}>
              <Emo e="⏳" />
            </div>
            <b>{paused ? 'Ronda en pausa' : hostPlayer ? `${hostPlayer.name} dará inicio` : 'Entrando a la sala…'}</b>
            <span className="dim" style={{ fontSize: 13 }}>
              Deja esta pantalla abierta.
            </span>
          </div>
        )}
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="h2">{host ? '¿Cerrar la sala?' : '¿Salir de la sala?'}</div>
        <div className="dim" style={{ fontSize: 14, lineHeight: 1.45 }}>
          {host ? 'Todos saldrán de la partida y se perderá el marcador de esta noche.' : 'Puedes volver a entrar con el mismo código mientras la sala siga abierta.'}
        </div>
        <Button variant="danger" onClick={() => void leaveRoom()}>
          {host ? 'Cerrar sala' : 'Salir'}
        </Button>
        <Button variant="ghost" small onClick={() => setConfirm(false)}>
          Quedarme
        </Button>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)}>
        <div className="h2">➕ Jugador en este teléfono</div>
        <div className="dim" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
          Cuando le toque ver su carta, votar o adivinar, la app pedirá pasarle este teléfono. Así pueden jugar aunque haya menos celulares que personas.
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            addLocalPlayer(newName.trim());
            sfx.select();
            burst({ kind: 'sparks', count: 18, colors: ['#7c5cff', '#2ee6ff', '#fff'] });
            setNewName('');
            setAdding(false);
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 16))} placeholder="Nombre" maxLength={16} enterKeyHint="done" className="field" autoFocus />
          <Button type="submit" small style={{ width: 64, minHeight: 54, fontSize: 30 }} disabled={!newName.trim()}>
            +
          </Button>
        </form>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        <div className="h2">Avatar y eliminación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {AVATAR_CHOICES.map((a) => (
            <motion.button
              key={a}
              whileTap={{ scale: 0.8 }}
              onClick={() => {
                if (editing) changeAvatar(editing, a);
                sfx.select();
                setEditing(null);
              }}
              style={{ fontSize: 28, aspectRatio: '1', borderRadius: 12, background: 'var(--panel)' }}
            >
              {a}
            </motion.button>
          ))}
        </div>
        {editing && players.some((p) => p.id === editing) && <ElimPicker player={players.find((p) => p.id === editing)!} />}
      </Sheet>
    </div>
  );
}
