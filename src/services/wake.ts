/**
 * Mantiene la pantalla encendida durante la partida: nada peor que el teléfono se bloquee
 * justo cuando todos esperan la siguiente pista (y en sala, además, corta la conexión).
 */
interface Sentinel {
  release(): Promise<void>;
}
type WakeNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

let sentinel: Sentinel | null = null;
let wanted = false;

async function acquire() {
  const nav = navigator as WakeNav;
  if (!wanted || sentinel || !nav.wakeLock || document.hidden) return;
  try {
    sentinel = await nav.wakeLock.request('screen');
    if (!wanted) void release();
  } catch {
    /* batería baja o navegador sin soporte: no pasa nada */
  }
}

async function release() {
  const s = sentinel;
  sentinel = null;
  await s?.release().catch(() => undefined);
}

export function keepAwake(on: boolean) {
  wanted = on;
  void (on ? acquire() : release());
}

if (typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => {
    // El sistema suelta el bloqueo al salir de la app; al volver se pide de nuevo.
    if (document.hidden) sentinel = null;
    else void acquire();
  });
