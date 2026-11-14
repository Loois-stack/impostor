import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { ACCENT_BY_ID, MX_ADULT_RULE } from '../engine/events';
import type { ShownEvent } from '../store/view';
import { Glitch } from './ui';

/**
 * Tarjeta de evento de ronda. Es la misma en la ruleta, en el recordatorio durante las pistas
 * y en la vista previa del catálogo, para que lo que se anuncia sea exactamente lo que se juega.
 */
export function EventCard({
  event,
  cursedWord,
  accent,
  adult,
  label,
  still,
}: {
  event: ShownEvent;
  cursedWord?: string;
  accent?: string;
  adult?: boolean;
  label?: string;
  /** Sin animaciones en bucle (para listas y vistas previas pequeñas). */
  still?: boolean;
}) {
  const acc = accent ? ACCENT_BY_ID[accent] : undefined;
  return (
    <div className="event-card" style={{ '--ev': event.color } as CSSProperties}>
      <div className="event-rays" />
      <div className="label" style={{ color: '#fff', position: 'relative' }}>
        {label ?? (event.id ? '⚡ Evento de ronda ⚡' : '🤫 Algo cambió 🤫')}
      </div>
      <motion.div
        animate={still ? undefined : { rotate: [0, -10, 10, 0], scale: [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
        style={{ fontSize: 72, lineHeight: 1, position: 'relative' }}
      >
        {event.emoji}
      </motion.div>
      <div className="h2" style={{ fontSize: 'clamp(34px, 11vw, 44px)', position: 'relative' }}>
        <Glitch text={event.title} hard={!still} />
      </div>
      <div style={{ lineHeight: 1.45, fontSize: 15.5, position: 'relative' }}>{event.desc}</div>
      {cursedWord && (
        <div className="display" style={{ fontSize: 40, color: '#ff2e4d', textShadow: '0 0 20px #ff2e4d', position: 'relative' }}>
          ☠️ “{cursedWord.toUpperCase()}”
        </div>
      )}
      {acc && (
        <div className="event-extra">
          <div className="display" style={{ fontSize: 30 }}>
            {acc.emoji} {acc.name}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>{acc.how}</div>
          {adult && <div className="spicy">🌶️ {MX_ADULT_RULE}</div>}
        </div>
      )}
    </div>
  );
}
