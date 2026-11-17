import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { ElimPicker } from '../components/Elimination';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { Avatar, Button, Sheet, TopBar } from '../components/ui';
import { levelFromXp } from '../engine/scoring';
import { burst } from '../fx/fx';
import { AVATAR_CHOICES, MAX_PLAYERS, useGame, type Player } from '../store/game';

function Row({ p, onRemove, onAvatar }: { p: Player; onRemove: () => void; onAvatar: () => void }) {
  const controls = useDragControls();
  const xp = useGame((s) => s.profiles[p.id]?.xp ?? 0);
  return (
    <Reorder.Item
      value={p}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, x: -40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.8 }}
      whileDrag={{ scale: 1.04, boxShadow: '0 16px 40px rgba(0,0,0,.5)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="panel row"
      style={{ padding: '10px 12px', listStyle: 'none', position: 'relative' }}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: 'none', padding: '8px 4px', color: 'var(--dim)', fontSize: 20, cursor: 'grab' }}
        aria-label="Arrastrar"
      >
        ⠿
      </span>
      <motion.button whileTap={{ scale: 0.85 }} onClick={onAvatar} aria-label={`Cambiar avatar de ${p.name}`}>
        <Avatar player={p} size={40} />
      </motion.button>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div className="dim" style={{ fontSize: 12, fontWeight: 700 }}>
          Nivel {levelFromXp(xp)}
        </div>
      </div>
      <motion.button whileTap={{ scale: 0.8 }} onClick={onRemove} className="icon-btn" style={{ width: 38, height: 38, fontSize: 16 }} aria-label={`Quitar a ${p.name}`}>
        ✕
      </motion.button>
    </Reorder.Item>
  );
}

export function Players() {
  const { players, addPlayer, removePlayer, setAvatar, go } = useGame();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const add = () => {
    if (!name.trim()) return;
    addPlayer(name);
    setName('');
    sfx.select();
    burst({ y: 160, kind: 'sparks', count: 18, colors: ['#7c5cff', '#2ee6ff', '#fff'] });
  };

  return (
    <div className="screen">
      <TopBar title="Jugadores" onBack={() => go('home')} right={<div className="label">{players.length}/{MAX_PLAYERS}</div>} />

      <form
        className="row content"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        style={{ marginBottom: 10 }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del jugador"
          maxLength={16}
          enterKeyHint="done"
          style={{
            flex: 1,
            minWidth: 0,
            height: 54,
            borderRadius: 16,
            border: '1px solid var(--line)',
            background: 'rgba(0,0,0,.35)',
            padding: '0 16px',
            fontSize: 17,
            fontWeight: 600,
            outline: 'none',
          }}
        />
        <Button type="submit" small style={{ width: 64, minHeight: 54, fontSize: 30 }} disabled={!name.trim() || players.length >= MAX_PLAYERS}>
          +
        </Button>
      </form>
      <div className="dim content" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.4 }}>
        Ordénalos como están sentados en círculo (arrastra ⠿). Así se reparten las cartas y los turnos. Toca un avatar para cambiarlo.
      </div>

      <div className="scroll content">
        <Reorder.Group axis="y" values={players} onReorder={(v) => useGame.setState({ players: v })} className="stack" style={{ padding: 0, margin: 0 }}>
          <AnimatePresence initial={false}>
            {players.map((p) => (
              <Row key={p.id} p={p} onRemove={() => removePlayer(p.id)} onAvatar={() => setEditing(p.id)} />
            ))}
          </AnimatePresence>
        </Reorder.Group>
        {players.length === 0 && (
          <div className="center dim" style={{ padding: 40, gap: 8 }}>
            <div style={{ fontSize: 48 }} className="float">
              👥
            </div>
            Agrega al menos 3 jugadores
          </div>
        )}
      </div>

      <div className="content" style={{ paddingTop: 12 }}>
        <Button disabled={players.length < 3} onClick={() => go('setup')}>
          {players.length < 3 ? `Faltan ${3 - players.length}` : 'Continuar ➜'}
        </Button>
      </div>

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
