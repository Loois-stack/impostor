import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { useGame } from './store/game';
import './styles.css';

registerSW({ immediate: true });

// Acceso de depuración desde la consola en desarrollo.
if (import.meta.env.DEV) Object.assign(window, { __game: useGame });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
