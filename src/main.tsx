import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fuentes empaquetadas con la app: así se ven igual sin internet.
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/creepster/latin-400.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-900.css';
import { App } from './App';
import { BY_ID } from './data';
import { bootNet } from './net/net';
import { dropLegacyCache } from './services/images';
import { startUpdates } from './services/update';
import { useGame } from './store/game';
import './styles.css';

startUpdates();
dropLegacyCache();
bootNet();

// Acceso de depuración desde la consola en desarrollo.
if (import.meta.env.DEV) {
  Object.assign(window, { __game: useGame, __cards: BY_ID });
  // Para las pruebas de la llamada de voz (la misma instancia que usa la app).
  void import('./net/voice').then((v) => Object.assign(window, { __voice: v }));
  void import('./audio/reactions').then((r) => Object.assign(window, { __rx: r }));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
