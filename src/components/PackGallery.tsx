import { AnimatePresence, motion } from 'framer-motion';
import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../audio/sfx';
import { OPENINGS, openOf, type OpenId } from '../data/openings';
import { GLOWS, PACK_DESIGNS, glowChance, rollPacks, type PackRoll } from '../data/packs';
import { changeOpen } from '../net/net';
import type { Player } from '../store/game';
import { CardBack } from './GameCard';
import { glowHalo, MiniPack, PersonalPack } from './PackOpening';
import { Button, Overlay, Segmented } from './ui';

/** Sobre de prueba: se abre igual que en la partida, pero sale solo el dorso de una carta. */
function DemoPack({ roll, opening, owner = 'Tú', onClose }: { roll: PackRoll; opening?: OpenId; owner?: string; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  const glow = GLOWS.find((g) => g.id === roll.g)!;
  // Va directo al <body>: dentro de una hoja (que se mueve) el fondo no cubriría la pantalla.
  return createPortal(
    <Overlay z={70}>
      <div className="label">Sobre de prueba</div>
      <PersonalPack roll={roll} owner={owner} edition="✨ Edición de prueba" opening={opening} onOpened={() => setOpened(true)}>
        <div className="card-wrap">
          <div className="card-glow" style={{ background: glowHalo(glow) }} />
          <div className="ppack-ghost-face">
            <CardBack />
          </div>
        </div>
      </PersonalPack>
      <motion.div animate={{ opacity: opened ? 1 : 0.6 }} style={{ width: '100%', maxWidth: 360 }}>
        <Button variant={opened ? 'primary' : 'ghost'} small onClick={onClose}>
          {opened ? 'Cerrar' : 'Cancelar'}
        </Button>
      </motion.div>
    </Overlay>,
    document.body,
  );
}

/** Para escoger cómo se abre tu sobre (cortar o fuego azul), con un sobre de prueba. */
export function OpenPicker({ player }: { player: Player }) {
  const [demo, setDemo] = useState<{ roll: PackRoll; n: number } | null>(null);
  const current = openOf(player.open);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="label">🎴 Tu sobre se abre…</div>
      <div className="elim-pick two">
        {OPENINGS.map((o) => (
          <motion.button
            key={o.id}
            whileTap={{ scale: 0.9 }}
            className={current.id === o.id ? 'on' : ''}
            aria-pressed={current.id === o.id}
            onClick={() => {
              sfx.select();
              changeOpen(player.id, o.id);
            }}
          >
            <span>{o.emoji}</span>
            <small>{o.name}</small>
          </motion.button>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="dim grow" style={{ fontSize: 12.5 }}>
          {current.desc}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="chip"
          onClick={() => {
            sfx.unlock();
            sfx.packCrinkle(0.6);
            setDemo((d) => ({ roll: rollPacks(['x'], false).x, n: (d?.n ?? 0) + 1 }));
          }}
        >
          ▶ Probar
        </motion.button>
      </div>
      <AnimatePresence>{demo && <DemoPack key={demo.n} roll={demo.roll} opening={current.id} owner={player.name} onClose={() => setDemo(null)} />}</AnimatePresence>
    </div>
  );
}

/** Ajustes: todos los diseños de sobre, las rarezas del brillo y un sobre de prueba. */
export function PackGallery() {
  const [demo, setDemoState] = useState<{ roll: PackRoll; n: number } | null>(null);
  const [opening, setOpening] = useState<OpenId>('corte');
  const setDemo = (roll: PackRoll | null) => setDemoState((d) => (roll ? { roll, n: (d?.n ?? 0) + 1 } : null));
  return (
    <div className="panel stack" style={{ gap: 12 }}>
      <b>🎴 Sobres y brillos</b>
      <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        En cada ronda, a cada jugador le toca un sobre al azar. Al abrirlo sale un brillo: es pura suerte, igual para civiles e impostores, así que no delata a nadie. Cada quien elige cómo abre el suyo tocando su avatar.
      </div>
      <Segmented id="gallery-open" value={opening} onChange={setOpening} options={OPENINGS.map((o) => ({ value: o.id, label: `${o.emoji} ${o.name}` }))} />
      <div className="pack-gallery">
        {PACK_DESIGNS.map((d, i) => (
          <motion.button
            key={d.id}
            className="pack-gallery-item"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              sfx.packCrinkle(0.6);
              setDemo({ d: d.id, g: rollPacks(['x'], false).x.g });
            }}
            aria-label={`Abrir un sobre ${d.name} de prueba`}
          >
            <MiniPack roll={{ d: d.id, g: 'plata' }} style={{ width: '100%', aspectRatio: '0.62' }} />
            <small>{d.name}</small>
          </motion.button>
        ))}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {GLOWS.map((g) => (
          <div key={g.id} className="glow-row" style={{ '--g1': g.colors[0], '--g2': g.colors[1], '--g4': g.colors[3] ?? g.colors[2] } as CSSProperties}>
            <span className="glow-dot" />
            <b>
              {g.emoji} {g.name}
            </b>
            <span className="dim grow">{g.rarity}</span>
            <span className="label">{Math.round(glowChance(g) * 100)} %</span>
          </div>
        ))}
      </div>
      <Button
        small
        onClick={() => {
          sfx.packCrinkle(0.6);
          setDemo(rollPacks(['x'], false).x);
        }}
      >
        {openOf(opening).emoji} Abrir un sobre de prueba
      </Button>
      <AnimatePresence>{demo && <DemoPack key={demo.n} roll={demo.roll} opening={opening} onClose={() => setDemo(null)} />}</AnimatePresence>
    </div>
  );
}
