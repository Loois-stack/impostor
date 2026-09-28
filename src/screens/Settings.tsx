import { motion } from 'framer-motion';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { Avatar, Button, Toggle, TopBar } from '../components/ui';
import { ITEMS } from '../data';
import { ACHIEVEMENTS } from '../engine/achievements';
import { levelFromXp } from '../engine/scoring';
import { downloadAll, imageCount } from '../services/images';
import { useGame } from '../store/game';

export function SettingsScreen() {
  const { settings, setSettings, go, history, clearHistory, players, profiles } = useGame();
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null);
  const seen = Object.keys(history.itemUse).length;

  return (
    <div className="screen">
      <TopBar title="Ajustes" onBack={() => go('home')} />
      <div className="scroll content">
        <div className="stack" style={{ gap: 10 }}>
          <Toggle
            emoji="🔊"
            on={settings.sound}
            onChange={(sound) => {
              setSettings({ sound });
              sfx.enabled = sound;
              if (sound) sfx.select();
            }}
            title="Sonido"
          />
          <Toggle emoji="📳" on={settings.vibration} onChange={(vibration) => setSettings({ vibration })} title="Vibración" />

          <div className="panel stack" style={{ gap: 10 }}>
            <b>📶 Jugar sin internet</b>
            <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
              Descarga las {imageCount()} imágenes de las cartas para jugar en cualquier lugar (≈ 25 MB).
            </div>
            {dl && (
              <div style={{ height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
                <motion.div animate={{ width: `${(dl.done / dl.total) * 100}%` }} style={{ height: '100%', background: 'var(--accent)' }} />
              </div>
            )}
            <Button
              small
              variant="ghost"
              disabled={!!dl && dl.done < dl.total}
              onClick={() => {
                setDl({ done: 0, total: imageCount() });
                void downloadAll((done, total) => setDl({ done, total }));
              }}
            >
              {dl ? (dl.done < dl.total ? `Descargando ${dl.done}/${dl.total}…` : '✅ Listo para offline') : '⬇️ Descargar imágenes'}
            </Button>
          </div>

          <div className="panel stack" style={{ gap: 8 }}>
            <b>🧠 Memoria anti-repetición</b>
            <div className="dim" style={{ fontSize: 13, lineHeight: 1.4 }}>
              Has visto {seen} de {ITEMS.length} cartas en {history.round} rondas. El juego evita repetirlas hasta recorrer la mayoría de cada categoría.
            </div>
            <Button
              small
              variant="ghost"
              onClick={() => {
                if (confirm('¿Olvidar todas las cartas jugadas?')) clearHistory();
              }}
            >
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
                    <Avatar player={p} size={36} />
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
            </div>
          )}

          <div className="dim center" style={{ fontSize: 11, padding: 12, lineHeight: 1.5 }}>
            Imágenes de Wikipedia/Wikimedia Commons. Personajes y marcas pertenecen a sus dueños. Juego de uso personal.
          </div>
        </div>
      </div>
    </div>
  );
}
