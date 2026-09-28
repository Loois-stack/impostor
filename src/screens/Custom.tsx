import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { MiniCard } from '../components/MiniCard';
import { Button, TopBar } from '../components/ui';
import { BY_ID, MIN_CUSTOM } from '../data';
import { burst } from '../fx/fx';
import { useGame, type CustomCard } from '../store/game';

const MAX_SIDE = 480;

/** Reduce la foto a 480 px en JPEG para que quepa en el almacenamiento del teléfono. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const field = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--line)',
  background: 'rgba(0,0,0,.35)',
  padding: '12px 14px',
  fontSize: 16,
  outline: 'none',
} as const;

function Editor({ card, onClose }: { card: CustomCard; onClose: () => void }) {
  const { saveCustom, removeCustom, customCards } = useGame();
  const [draft, setDraft] = useState(card);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exists = customCards.some((c) => c.id === card.id);
  const valid = draft.name.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
    >
      <motion.div
        initial={{ y: 600 }}
        animate={{ y: 0 }}
        exit={{ y: 600 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '92dvh',
          overflowY: 'auto',
          borderRadius: '26px 26px 0 0',
          padding: '18px 16px calc(var(--safe-b) + 18px)',
          background: '#140f1f',
          border: '1px solid var(--line)',
          gap: 12,
        }}
      >
        <div className="h2">{exists ? 'Editar carta' : 'Nueva carta'}</div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => fileRef.current?.click()}
          style={{
            height: 180,
            borderRadius: 18,
            border: '2px dashed rgba(255,255,255,.25)',
            background: draft.img ? `center/cover no-repeat url(${draft.img})` : 'rgba(255,255,255,.04)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
          }}
        >
          {!draft.img && (
            <div className="stack" style={{ alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 42 }}>{busy ? '⏳' : '📷'}</div>
              <b>Agregar foto (opcional)</b>
              <span className="dim" style={{ fontSize: 12 }}>
                Cámara o galería
              </span>
            </div>
          )}
          {draft.img && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setDraft({ ...draft, img: undefined });
              }}
              className="icon-btn"
              style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, fontSize: 14 }}
            >
              ✕
            </span>
          )}
        </motion.button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            try {
              setDraft((d) => ({ ...d, img: undefined }));
              const img = await shrinkPhoto(f);
              setDraft((d) => ({ ...d, img }));
            } finally {
              setBusy(false);
            }
          }}
        />

        <div className="row">
          <input
            value={draft.emoji}
            onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })}
            placeholder="😀"
            style={{ ...field, width: 64, textAlign: 'center', fontSize: 26 }}
            aria-label="Emoji"
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 40) })}
            placeholder="Nombre (ej. El perro de Luis)"
            style={field}
            aria-label="Nombre"
          />
        </div>
        <textarea
          value={draft.ctx}
          onChange={(e) => setDraft({ ...draft, ctx: e.target.value.slice(0, 200) })}
          placeholder="Contexto: qué es, cómo es, por qué es famoso en su grupo…"
          rows={3}
          style={{ ...field, resize: 'none', lineHeight: 1.4, userSelect: 'text' }}
          aria-label="Contexto"
        />

        <Button
          disabled={!valid || busy}
          onClick={() => {
            saveCustom({ ...draft, name: draft.name.trim(), ctx: draft.ctx.trim() });
            sfx.coin();
            burst({ kind: 'confetti', count: 50, colors: ['#ff9ad5', '#7a1fff', '#fff'] });
            onClose();
          }}
        >
          💾 Guardar carta
        </Button>
        {exists && (
          <Button
            variant="ghost"
            small
            onClick={() => {
              removeCustom(card.id);
              sfx.fail();
              onClose();
            }}
          >
            🗑️ Borrar carta
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

export function Custom() {
  const { customCards, go, settings, setSettings } = useGame();
  const [editing, setEditing] = useState<CustomCard | null>(null);
  const enabled = settings.cats.includes('custom');
  const newCard = (): CustomCard => ({ id: `c_${Math.random().toString(36).slice(2, 9)}`, name: '', ctx: '', emoji: '😀' });

  return (
    <div className="screen" style={{ '--accent': '#ff5fc8' } as React.CSSProperties}>
      <TopBar title="✍️ Mis cartas" onBack={() => go('setup')} right={<div className="label">{customCards.length}</div>} />
      <div className="dim content" style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>
        Crea cartas de chistes internos, amigos, lugares o lo que quieran. Se necesitan al menos {MIN_CUSTOM}. El impostor recibirá otra carta de esta misma
        categoría.
      </div>

      <div className="scroll content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              sfx.select();
              setEditing(newCard());
            }}
            className="panel center"
            style={{ aspectRatio: '4 / 5', gap: 6, borderStyle: 'dashed', borderColor: '#ff9ad5' }}
          >
            <div style={{ fontSize: 34 }}>＋</div>
            <b style={{ fontSize: 13 }}>Nueva carta</b>
          </motion.button>
          {customCards.map((c, i) =>
            BY_ID[c.id] ? (
              <MiniCard key={c.id} item={BY_ID[c.id]} cat="custom" delay={i * 0.03} onClick={() => setEditing(c)} />
            ) : null,
          )}
        </div>
      </div>

      <div className="content" style={{ paddingTop: 12 }}>
        <Button
          disabled={customCards.length < MIN_CUSTOM}
          variant={enabled ? 'ghost' : 'primary'}
          onClick={() => {
            setSettings({ cats: enabled ? settings.cats.filter((c) => c !== 'custom') : [...settings.cats, 'custom'] });
            sfx.select();
          }}
        >
          {customCards.length < MIN_CUSTOM
            ? `Faltan ${MIN_CUSTOM - customCards.length} cartas`
            : enabled
              ? '✅ Incluidas en la partida'
              : '➕ Incluir en la partida'}
        </Button>
      </div>

      <AnimatePresence>{editing && <Editor key={editing.id} card={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
