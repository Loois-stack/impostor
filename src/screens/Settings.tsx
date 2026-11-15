import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { reactionSound } from '../audio/reactions';
import { sfx } from '../audio/sfx';
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
import { usePrefs } from '../store/prefs';

/** Sonidos de las reacciones: cuáles suenan en este teléfono y un tablero para probarlos. */
function ReactionSounds() {
  const mode = usePrefs((s) => s.reactSound);
  const sound = usePrefs((s) => s.sound);
  const set = usePrefs((s) => s.set);
  return (
    <div className="panel stack" style={{ gap: 8 }}>
      <b>😂 Sonidos de las reacciones</b>
      <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
        Cada reacción tiene su propio sonido, hecho desde cero en el teléfono (sin grabaciones). La risa nunca suena igual dos veces. En una sala lo oyen todos.
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
            aria-label={`Escuchar ${e}`}
            onClick={() => {
              sfx.unlock();
              floatReaction(e);
              if (!reactionSound(e, true)) sfx.select();
            }}
          >
            {e}
          </motion.button>
        ))}
      </div>
      <div className="dim" style={{ fontSize: 12 }}>
        {sound ? 'Toca uno para escucharlo.' : 'Prende los efectos de sonido para escucharlos.'}
      </div>
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
        <div className="h2">Elige un avatar</div>
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
      </Sheet>
    </div>
  );
}
