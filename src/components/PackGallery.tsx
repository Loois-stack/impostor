import { AnimatePresence, motion } from 'framer-motion';
import { useState, type CSSProperties } from 'react';
import { sfx } from '../audio/sfx';
import { GLOWS, PACK_DESIGNS, glowChance, rollPacks, type PackRoll } from '../data/packs';
import { CardBack } from './GameCard';
import { glowHalo, MiniPack, PersonalPack } from './PackOpening';
import { Button, Overlay } from './ui';

/** Sobre de prueba: se abre igual que en la partida, pero sale solo el dorso de una carta. */
function DemoPack({ roll, onClose }: { roll: PackRoll; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  const glow = GLOWS.find((g) => g.id === roll.g)!;
  return (
    <Overlay z={70}>
      <div className="label">Sobre de prueba</div>
      <PersonalPack roll={roll} owner="Tú" edition="✨ Edición de prueba" onOpened={() => setOpened(true)}>
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
    </Overlay>
  );
}

/** Ajustes: todos los diseños de sobre, las rarezas del brillo y un sobre de prueba. */
export function PackGallery() {
  const [demo, setDemoState] = useState<{ roll: PackRoll; n: number } | null>(null);
  const setDemo = (roll: PackRoll | null) => setDemoState((d) => (roll ? { roll, n: (d?.n ?? 0) + 1 } : null));
  return (
    <div className="panel stack" style={{ gap: 12 }}>
      <b>🎴 Sobres y brillos</b>
      <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        En cada ronda, a cada jugador le toca un sobre al azar. Al cortarlo sale un brillo: es pura suerte, igual para civiles e impostores, así que no delata a nadie.
      </div>
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
        ✂️ Abrir un sobre de prueba
      </Button>
      <AnimatePresence>{demo && <DemoPack key={demo.n} roll={demo.roll} onClose={() => setDemo(null)} />}</AnimatePresence>
    </div>
  );
}
