import { motion } from 'framer-motion';
import { ElimPicker } from '../components/Elimination';
import { useEffect, useRef, useState } from 'react';
import { canRecord, recordSound, type Recording } from '../audio/recordings';
import { reactionSound } from '../audio/reactions';
import { haptic, sfx } from '../audio/sfx';
import { CardBack } from '../components/GameCard';
import { PackGallery } from '../components/PackGallery';
import { Avatar, Button, Segmented, Sheet, Toggle, TopBar } from '../components/ui';
import { ITEMS } from '../data';
import { ACHIEVEMENTS } from '../engine/achievements';
import { levelFromXp } from '../engine/scoring';
import { floatReaction, REACTIONS } from '../fx/reactions';
import { SKIN_IDS, SKINS, skinVars } from '../fx/skins';
import { downloadAll, offlineStatus, type OfflineStatus } from '../services/images';
import { AVATAR_CHOICES, useGame } from '../store/game';
import { publicId } from '../net/state';
import { usePrefs } from '../store/prefs';

/** Qué decirle a quien graba, según la reacción. */
const REC_HINT: Record<string, string> = {
  '😂': '¡ríete!',
  '🤣': '¡carcajada!',
  '😱': '¡grita!',
  '😭': '¡llora!',
  '🐔': '¡cacarea!',
  '😴': '¡ronca!',
  '🤫': '¡shhh!',
  '👏': '¡aplaude!',
  '🫵': '¡acusa!',
  '🤔': '¡piénsale!',
};

/** Graba tu voz para una reacción: esa reacción suena con ella (en una sala, en todos los teléfonos). */
function SoundRecorder({ e }: { e: string }) {
  const mine = usePrefs((s) => s.sounds[e]);
  const set = usePrefs((s) => s.set);
  const [rec, setRec] = useState<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string>();
  useEffect(() => setErr(undefined), [e]);
  const play = () => {
    sfx.unlock();
    floatReaction(e);
    reactionSound(e, undefined, true, true);
  };
  const save = (d: string | undefined) => {
    const sounds = { ...usePrefs.getState().sounds };
    if (d) sounds[e] = d;
    else delete sounds[e];
    set({ sounds });
  };
  const start = async () => {
    setErr(undefined);
    sfx.unlock();
    let r: Recording;
    try {
      r = await recordSound();
    } catch (x) {
      const denied = (x as DOMException)?.name === 'NotAllowedError';
      return setErr(denied ? 'No diste permiso para usar el micrófono. Actívalo en los permisos del navegador.' : 'No se pudo abrir el micrófono.');
    }
    haptic(20);
    setRec(r);
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    try {
      const d = await r.done;
      if (!d) setErr('No se oyó nada. Acércate al micrófono y hazlo con ganas.');
      else {
        save(d);
        setTimeout(play, 150);
      }
    } catch {
      setErr('No se pudo guardar la grabación. Intenta otra vez.');
    } finally {
      clearInterval(id);
      setRec(null);
      setElapsed(0);
    }
  };
  return (
    <div className="laugh-rec stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ fontSize: 36 }}>{e}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{mine ? 'Suena con tu voz' : 'Suena con el sonido del juego'}</b>
          <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.35 }}>
            {mine ? 'En una sala, todos oyen tu grabación cuando la mandas.' : `Graba tu voz (hasta 3 segundos) para que ${e} suene como tú.`}
          </div>
        </div>
      </div>
      {rec ? (
        <Button variant="danger" onClick={() => rec.stop()} className="rec-btn">
          <span className="rec-dot" /> Grabando… {REC_HINT[e] ?? '¡ahora!'} · {Math.max(0, 3 - elapsed).toFixed(1)} s
          <span className="rec-bar" style={{ width: `${Math.min(100, (elapsed / 3) * 100)}%` }} />
        </Button>
      ) : mine ? (
        <div className="row" style={{ gap: 6 }}>
          <Button small onClick={play} style={{ flex: 1 }}>
            ▶ Escuchar
          </Button>
          <Button small variant="ghost" onClick={() => void start()} style={{ flex: 1 }}>
            🔁 Otra vez
          </Button>
          <Button small variant="ghost" onClick={() => save(undefined)} style={{ flex: 1 }}>
            🗑️ Quitar
          </Button>
        </div>
      ) : (
        <Button onClick={() => void start()}>🎙️ Grabar mi voz para {e}</Button>
      )}
      {err && (
        <div className="dim" style={{ fontSize: 12.5, color: '#ff8a9a' }}>
          {err}
        </div>
      )}
    </div>
  );
}

/** Sonidos de las reacciones: cuáles suenan en este teléfono, probarlos y grabar los tuyos. */
function ReactionSounds() {
  const mode = usePrefs((s) => s.reactSound);
  const sound = usePrefs((s) => s.sound);
  const sounds = usePrefs((s) => s.sounds);
  const set = usePrefs((s) => s.set);
  const [pick, setPick] = useState('😂');
  const recorded = Object.keys(sounds).length;
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <b>😂 Sonidos de las reacciones</b>
      <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
        Cada reacción tiene su propio sonido, hecho desde cero en el teléfono. Cada jugador tiene su propia voz y la risa nunca sale igual dos veces. También puedes grabar tu voz para cada una. En una sala lo oyen todos.
      </div>
      <Segmented
        id="reactSound"
        value={mode}
        onChange={(reactSound) => set({ reactSound })}
        options={[
          { value: 'all', label: 'De todos' },
          { value: 'mine', label: 'Solo mías' },
          { value: 'off', label: 'Apagados' },
        ]}
      />
      <div className="rx-try">
        {REACTIONS.map((e) => (
          <motion.button
            key={e}
            whileTap={{ scale: 1.3 }}
            className={`${pick === e ? 'on' : ''} ${sounds[e] ? 'rec' : ''}`}
            aria-label={`Escuchar ${e}`}
            aria-pressed={pick === e}
            onClick={() => {
              setPick(e);
              sfx.unlock();
              floatReaction(e);
              if (!reactionSound(e, publicId(usePrefs.getState().deviceId), true, true)) sfx.select();
            }}
          >
            {e}
          </motion.button>
        ))}
      </div>
      <div className="dim" style={{ fontSize: 12 }}>
        {sound ? `Toca uno para escucharlo y elegirlo.${recorded ? ` 🎤 = con tu voz (${recorded}).` : ''}` : 'Prende los efectos de sonido para escucharlos.'}
      </div>
      {canRecord() && <SoundRecorder e={pick} />}
    </div>
  );
}

/** Descarga de imágenes para jugar sin internet, con pausa y progreso que se conserva. */
function OfflinePanel() {
  const [st, setSt] = useState<OfflineStatus | null>(null);
  const [run, setRun] = useState<{ failed: number } | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    void offlineStatus().then(setSt);
    return () => {
      stop.current = true;
    };
  }, []);

  const start = async () => {
    stop.current = false;
    setRun({ failed: 0 });
    await downloadAll(
      ({ done, total, failed }) => {
        setSt((s) => ({ ...s, done, total }));
        setRun({ failed });
      },
      () => stop.current,
    );
    const fresh = await offlineStatus();
    setSt(fresh);
    setRun((r) => (r?.failed ? { failed: r.failed } : null));
    if (fresh.done === fresh.total) sfx.fanfare();
  };

  const complete = !!st && st.done >= st.total;
  const downloading = !!run && !stop.current && !complete;
  const pctDone = st ? Math.round((st.done / st.total) * 100) : 0;

  return (
    <div className="panel stack" style={{ gap: 10 }}>
      <div className="row">
        <b className="grow">📶 Jugar sin internet</b>
        <span className="chip" style={{ borderColor: complete ? '#39ff88' : undefined }}>
          <span className="dot" style={{ background: complete ? '#39ff88' : '#ffb547' }} />
          {complete ? 'Todo listo' : 'App lista · faltan fotos'}
        </span>
      </div>
      <div className="dim" style={{ fontSize: 13, lineHeight: 1.45 }}>
        El juego, las fuentes y los sonidos ya funcionan sin conexión. Las fotos de las cartas se guardan al verlas; descárgalas todas de una vez para tenerlas
        en cualquier lugar (unos 80 MB, mejor con Wi-Fi). Sin foto, la carta usa su arte propio.
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pctDone}%` }} style={{ height: '100%', background: complete ? '#39ff88' : 'var(--accent)' }} />
      </div>
      <div className="row dim" style={{ fontSize: 12, fontWeight: 700 }}>
        <span className="grow">{st ? `${st.done} de ${st.total} fotos guardadas (${pctDone} %)` : 'Revisando…'}</span>
        {st?.mb !== undefined && <span>{st.mb} MB en uso</span>}
      </div>
      {run && run.failed > 0 && !downloading && (
        <div style={{ fontSize: 12.5, color: '#ffb547' }}>
          {run.failed} fotos no se pudieron bajar (¿sin señal?). Vuelve a intentarlo: lo ya guardado no se repite.
        </div>
      )}
      {!complete &&
        (downloading ? (
          <Button
            small
            variant="ghost"
            onClick={() => {
              stop.current = true;
              setRun(null);
            }}
          >
            ⏸ Pausar descarga
          </Button>
        ) : (
          <Button small variant="ghost" disabled={!st} onClick={() => void start()}>
            {st && st.done > 0 ? '⬇️ Descargar las que faltan' : '⬇️ Descargar todas las fotos'}
          </Button>
        ))}
    </div>
  );
}

export function SettingsScreen() {
  const { go, history, clearHistory, players, profiles, setAvatar, online } = useGame();
  const prefs = usePrefs();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const seen = Object.keys(history.itemUse).length;

  return (
    <div className="screen">
      <TopBar title="Ajustes" onBack={() => go('home')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 10 }}>
          <div className="label">🎨 Tema visual</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {SKIN_IDS.map((id) => {
              const sk = SKINS[id];
              const on = prefs.skin === id;
              return (
                <motion.button
                  key={id}
                  whileTap={{ scale: 0.94 }}
                  animate={{ scale: on ? 1 : 0.96 }}
                  onClick={() => {
                    prefs.set({ skin: id });
                    sfx.flip();
                  }}
                  className={`skin-tile ${on ? 'on' : ''}`}
                  style={{ ...skinVars(id), background: `radial-gradient(circle at 20% 10%, ${sk.c1}66, transparent 60%), radial-gradient(circle at 90% 100%, ${sk.c2}66, transparent 60%), var(--bg)` }}
                  aria-pressed={on}
                >
                  <div className="mini-back skin-card">
                    <CardBack small />
                  </div>
                  <b>
                    {sk.emoji} {sk.name}
                  </b>
                  <small>{sk.desc}</small>
                  {on && <span className="cat-check">✓</span>}
                </motion.button>
              );
            })}
          </div>

          <PackGallery />

          <div className="label" style={{ marginTop: 8 }}>
            🔊 Sonido
          </div>
          <Toggle
            emoji="🔊"
            on={prefs.sound}
            onChange={(sound) => {
              prefs.set({ sound });
              sfx.enabled = sound;
              if (sound) sfx.select();
            }}
            title="Efectos de sonido"
          />
          <Toggle emoji="🎵" on={prefs.music} onChange={(music) => prefs.set({ music })} title="Música de fondo" desc="Generada en vivo: cambia en el menú, la partida, la votación y el terror." />
          <Toggle emoji="📳" on={prefs.vibration} onChange={(vibration) => prefs.set({ vibration })} title="Vibración" />
          <Toggle
            emoji="🎬"
            on={prefs.elimFx}
            onChange={(elimFx) => prefs.set({ elimFx })}
            title="Animaciones de eliminación"
            desc="Rayo, agujero negro, piñata o cohete. Cada jugador elige la suya tocando su avatar."
          />
          <ReactionSounds />

          <OfflinePanel />

          <div className="panel stack" style={{ gap: 8 }}>
            <b>🧠 Memoria anti-repetición</b>
            <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
              Has visto {seen} de {ITEMS.length} cartas en {history.round} rondas. El juego evita repetirlas hasta recorrer la mayoría de cada categoría.
            </div>
            <Button small variant="ghost" onClick={() => setConfirmReset(true)}>
              Reiniciar memoria
            </Button>
          </div>

          {players.length > 0 && (
            <div className="panel stack" style={{ gap: 10 }}>
              <b>🏅 Perfiles y logros</b>
              {players.map((p) => {
                const pr = profiles[p.id];
                return (
                  <div key={p.id} className="row" style={{ alignItems: 'flex-start' }}>
                    <motion.button whileTap={online ? undefined : { scale: 0.85 }} disabled={online} onClick={() => setEditing(p.id)} aria-label={`Cambiar avatar de ${p.name}`}>
                      <Avatar player={p} size={36} />
                    </motion.button>
                    <div className="grow">
                      <div>
                        <b>{p.name}</b> <span className="dim">· Nv {levelFromXp(pr?.xp ?? 0)}</span>
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>
                        {pr?.stats.rounds ?? 0} rondas · {pr?.stats.impWins ?? 0} victorias de impostor · {pr?.stats.civWins ?? 0} atrapadas
                      </div>
                      <div style={{ fontSize: 20, marginTop: 4, letterSpacing: 2 }}>
                        {ACHIEVEMENTS.map((a) => (
                          <span key={a.id} title={`${a.name}: ${a.desc}`} style={{ opacity: pr?.achievements.includes(a.id) ? 1 : 0.15 }}>
                            {a.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!online && (
                <div className="dim" style={{ fontSize: 12 }}>
                  Toca un avatar para cambiarlo.
                </div>
              )}
            </div>
          )}

          <div className="dim center" style={{ fontSize: 11, padding: 12, lineHeight: 1.5 }}>
            Imágenes de Wikipedia/Wikimedia Commons. Personajes y marcas pertenecen a sus dueños. Juego de uso personal.
          </div>
        </div>
      </div>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)}>
        <div className="h2">¿Olvidar las cartas jugadas?</div>
        <div className="dim" style={{ fontSize: 14, lineHeight: 1.45 }}>
          Las cartas que ya salieron podrán volver a aparecer. No se borran puntos, niveles ni logros.
        </div>
        <Button
          variant="danger"
          onClick={() => {
            clearHistory();
            setConfirmReset(false);
          }}
        >
          Reiniciar memoria
        </Button>
        <Button variant="ghost" small onClick={() => setConfirmReset(false)}>
          Cancelar
        </Button>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        <div className="h2">Avatar y eliminación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {AVATAR_CHOICES.map((a) => (
            <motion.button
              key={a}
              whileTap={{ scale: 0.8 }}
              onClick={() => {
                if (editing) setAvatar(editing, a);
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
