import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import { IN_ROUND, MAX_PLAYERS, syncCustom, useGame, type CustomCard, type Screen } from '../store/game';
import { usePrefs } from '../store/prefs';
import { clock } from './clock';
import { REACTIONS, showReaction } from '../fx/reactions';
import { link, type NetAction } from './link';
import { publicId, useNet } from './state';

/**
 * Multijugador en varios teléfonos.
 *
 * El teléfono que crea la sala es el ANFITRIÓN: ahí vive la partida de verdad. Los demás son
 * invitados: reciben una copia del estado para dibujar las mismas pantallas y le piden al
 * anfitrión lo poco que les toca (marcar listo, pasar su turno, votar, adivinar). El anfitrión
 * valida cada petición, así que un invitado no puede mover la partida de otro.
 *
 * La conexión es directa entre teléfonos (WebRTC, vía PeerJS). Solo hace falta internet para
 * encontrarse; por eso el modo de un solo teléfono sigue siendo el que funciona sin conexión.
 * Es un juego entre amigos: el estado completo viaja a cada teléfono y no se cifra nada extra.
 */

const PROTOCOL = 3;
const PREFIX = 'impostor-quien-miente-';
/** Sin letras ni números que se confundan al dictarlos (0/O, 1/I…). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BEAT_MS = 4000;
const DEAD_MS = 13000;
const GIVE_UP_MS = 120000;

type Snapshot = Pick<ReturnType<typeof useGame.getState>, 'screen' | 'players' | 'profiles' | 'settings' | 'session' | 'round'>;

type HostMsg =
  | { t: 'state'; s: Snapshot; now: number; present: string[] }
  | { t: 'react'; e: string; from: string }
  | { t: 'cards'; cards: CustomCard[] }
  | { t: 'deny'; reason: 'full' | 'version' }
  | { t: 'ping' }
  | { t: 'bye' };
type GuestMsg = { t: 'hello'; v: number; id: string; name: string } | { t: 'act'; a: NetAction } | { t: 'react'; e: string } | { t: 'pong' } | { t: 'bye' };

export const normalizeCode = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);

export const validCode = (code: string) => code.length === 4 && [...code].every((ch) => ALPHABET.includes(ch));

function newCode() {
  const a = new Uint32Array(4);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

/** Enlace para entrar directo a la sala (también va en el QR). */
export const inviteUrl = (code: string) => `${location.origin}${location.pathname}?sala=${code}`;

/** Código que venía en el enlace con el que se abrió la app. */
export const invite = (() => {
  try {
    const code = normalizeCode(new URLSearchParams(location.search).get('sala') ?? '');
    if (!validCode(code)) return '';
    history.replaceState(null, '', location.pathname);
    return code;
  } catch {
    return '';
  }
})();

/** Servidor de encuentro. Por defecto el público de PeerJS; se puede cambiar con variables VITE_PEER_*. */
function peerOptions(): PeerOptions {
  const env = import.meta.env;
  if (!env.VITE_PEER_HOST) return {};
  return {
    host: env.VITE_PEER_HOST,
    port: Number(env.VITE_PEER_PORT ?? 443),
    path: env.VITE_PEER_PATH ?? '/',
    secure: env.VITE_PEER_SECURE !== 'false',
  };
}

let peer: Peer | null = null;
/** Anfitrión: jugador -> su conexión. */
const conns = new Map<string, DataConnection>();
const lastSeen = new Map<string, number>();
/** Invitado: conexión con el anfitrión. */
let hostConn: DataConnection | null = null;
let hostSeen = 0;
let lostAt = 0;
let unsub: (() => void) | null = null;
let beat = 0;
let retry = 0;
let queued = false;

const send = (c: DataConnection | null | undefined, m: HostMsg | GuestMsg) => {
  // Todo viaja como texto JSON: sin sorpresas con `undefined` y PeerJS lo parte en trozos si es grande.
  if (c?.open) c.send(JSON.stringify(m));
};
const parse = (raw: unknown): { t?: unknown } | null => {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : null;
    return m && typeof m === 'object' ? m : null;
  } catch {
    return null;
  }
};

function teardown() {
  unsub?.();
  unsub = null;
  clearInterval(beat);
  clearTimeout(retry);
  conns.clear();
  lastSeen.clear();
  hostConn = null;
  const p = peer;
  peer = null;
  try {
    p?.destroy();
  } catch {
    /* ya estaba cerrada */
  }
}

// ------------------------------------------------------------------ Anfitrión

/** Lo que ven los invitados: las pantallas de la ronda van a la par; lo demás es "la sala". */
const guestScreen = (sc: Screen): Screen => (IN_ROUND.includes(sc) || sc === 'score' || sc === 'awards' ? sc : 'lobby');

function snapshot(): Snapshot {
  const s = useGame.getState();
  const ids = new Set(s.players.map((p) => p.id));
  return {
    screen: guestScreen(s.screen),
    players: s.players,
    profiles: Object.fromEntries(Object.entries(s.profiles).filter(([id]) => ids.has(id))),
    settings: s.settings,
    session: s.session,
    round: s.round,
  };
}

function present(): string[] {
  const me = publicId(usePrefs.getState().deviceId);
  return [me, ...[...conns.entries()].filter(([, c]) => c.open).map(([id]) => id)];
}

function broadcast() {
  queued = false;
  if (useNet.getState().role !== 'host') return;
  const here = present();
  useNet.setState({ present: here });
  const msg: HostMsg = { t: 'state', s: snapshot(), now: Date.now(), present: here };
  for (const c of conns.values()) send(c, msg);
}

/** Agrupa los cambios de un mismo instante en un solo envío. */
function schedule() {
  if (queued) return;
  queued = true;
  setTimeout(broadcast, 0);
}

function onGuest(conn: DataConnection) {
  let pid = '';
  conn.on('data', (raw) => {
    const m = parse(raw) as GuestMsg | null;
    if (!m) return;
    if (m.t === 'hello') {
      if (typeof m.id !== 'string' || !/^[\w-]{6,40}$/.test(m.id) || typeof m.name !== 'string') return;
      if (m.v !== PROTOCOL) return send(conn, { t: 'deny', reason: 'version' });
      // El id del teléfono es secreto; los demás solo conocen el id público derivado.
      const id = publicId(m.id);
      if (!useGame.getState().joinPlayer(id, m.name)) return send(conn, { t: 'deny', reason: 'full' });
      pid = id;
      const old = conns.get(pid);
      conns.set(pid, conn);
      if (old && old !== conn) old.close();
      lastSeen.set(pid, Date.now());
      send(conn, { t: 'cards', cards: useGame.getState().customCards });
      schedule();
      return;
    }
    if (!pid || conns.get(pid) !== conn) return;
    lastSeen.set(pid, Date.now());
    if (m.t === 'act' && m.a && typeof m.a === 'object') useGame.getState().remote(pid, m.a);
    else if (m.t === 'react') relayReaction(m.e, pid);
    else if (m.t === 'bye') {
      conns.delete(pid);
      // Quien se sale entre rondas deja su lugar (con quienes jugaban en su teléfono); a media ronda se conserva.
      const { round } = useGame.getState();
      if (!round || round.result) useGame.getState().removePlayer(pid);
      schedule();
    }
  });
  const gone = () => {
    if (pid && conns.get(pid) === conn) {
      conns.delete(pid);
      schedule();
    }
  };
  conn.on('close', gone);
  conn.on('error', gone);
}

function hostLoop() {
  unsub?.();
  unsub = useGame.subscribe((s, prev) => {
    if (s.customCards !== prev.customCards) for (const c of conns.values()) send(c, { t: 'cards', cards: s.customCards });
    schedule();
  });
  clearInterval(beat);
  beat = window.setInterval(() => {
    const t = Date.now();
    let changed = false;
    for (const [id, c] of conns) {
      if (t - (lastSeen.get(id) ?? 0) > DEAD_MS) {
        conns.delete(id);
        c.close();
        changed = true;
      } else send(c, { t: 'ping' });
    }
    if (changed) schedule();
  }, BEAT_MS);
}

/** Crea una sala (o la reabre con el mismo código tras recargar la página). */
export async function hostRoom(name: string, resumeCode?: string) {
  teardown();
  link.guest = false;
  link.send = () => {};
  clock.offset = 0;
  usePrefs.getState().set({ name });
  const me = publicId(usePrefs.getState().deviceId);
  useNet.setState({ role: 'host', status: 'connecting', error: undefined, code: resumeCode ?? '', present: [me] });
  let PeerCtor: typeof Peer;
  try {
    PeerCtor = (await import('peerjs')).Peer;
  } catch {
    return useNet.setState({ status: 'error', error: 'No se pudo cargar el modo en línea. Revisa tu conexión.' });
  }
  if (useNet.getState().role !== 'host') return;

  let tries = 0;
  const open = (code: string) => {
    const p = new PeerCtor(PREFIX + code, peerOptions());
    peer = p;
    p.on('open', () => {
      useNet.setState({ code, status: 'open', error: undefined });
      if (!useGame.getState().online) useGame.getState().openRoom({ id: me, name });
      hostLoop();
      schedule();
    });
    p.on('connection', onGuest);
    p.on('disconnected', () => {
      if (peer !== p || p.destroyed) return;
      useNet.setState({ status: 'reconnecting' });
      retry = window.setTimeout(() => peer === p && !p.destroyed && p.reconnect(), 1500);
    });
    p.on('error', (err) => {
      if (peer !== p) return;
      if (err.type === 'unavailable-id') {
        p.destroy();
        // Al recargar, el código anterior tarda unos segundos en liberarse.
        if (resumeCode && tries++ < 8) retry = window.setTimeout(() => open(code), 1500);
        else open(newCode());
      } else if (err.type === 'peer-unavailable' || err.type === 'webrtc') {
        /* un invitado que no llegó: no afecta a la sala */
      } else if (useNet.getState().status === 'connecting') {
        useNet.setState({ status: 'error', error: 'No se pudo abrir la sala. Se necesita internet para jugar en varios teléfonos.' });
      } else useNet.setState({ status: 'reconnecting' });
    });
  };
  open(resumeCode ?? newCode());
}

/** Anfitrión: saca a un jugador de la sala. */
export function kick(id: string) {
  const c = conns.get(id);
  send(c, { t: 'bye' });
  conns.delete(id);
  setTimeout(() => c?.close(), 300);
  useGame.getState().removePlayer(id);
}

// ------------------------------------------------------------------ Invitado

function onHost(raw: unknown) {
  const m = parse(raw) as HostMsg | null;
  if (!m) return;
  hostSeen = Date.now();
  lostAt = 0;
  switch (m.t) {
    case 'state':
      clock.offset = m.now - Date.now();
      useNet.setState({ status: 'open', error: undefined, present: m.present });
      useGame.setState({ ...m.s, online: true });
      break;
    case 'cards':
      syncCustom(m.cards);
      break;
    case 'react':
      if (REACTIONS.includes(m.e)) showReaction(m.e, m.from);
      break;
    case 'ping':
      send(hostConn, { t: 'pong' });
      break;
    case 'deny':
      void exitGuest(m.reason === 'full' ? `La sala está llena (máximo ${MAX_PLAYERS} jugadores).` : 'Tu app y la del anfitrión son de versiones distintas. Recarguen la página los dos.');
      break;
    case 'bye':
      void exitGuest('El anfitrión cerró la sala.');
      break;
  }
}

function dial() {
  const p = peer;
  if (!p || p.destroyed || useNet.getState().role !== 'guest') return;
  if (p.disconnected) return p.reconnect();
  const { code } = useNet.getState();
  const prefs = usePrefs.getState();
  const old = hostConn;
  hostConn = null;
  old?.close();
  const c = p.connect(PREFIX + code, { reliable: true });
  hostConn = c;
  c.on('open', () => send(c, { t: 'hello', v: PROTOCOL, id: prefs.deviceId, name: prefs.name }));
  c.on('data', onHost);
  const lost = () => hostConn === c && redial();
  c.on('close', lost);
  c.on('error', lost);
}

function redial() {
  if (useNet.getState().role !== 'guest') return;
  if (!lostAt) lostAt = Date.now();
  if (Date.now() - lostAt > GIVE_UP_MS) return void exitGuest('Se perdió la conexión con la sala.');
  if (useNet.getState().status === 'open') useNet.setState({ status: 'reconnecting' });
  clearTimeout(retry);
  retry = window.setTimeout(dial, 2500);
}

/** Entra a una sala con su código. */
export async function joinRoom(rawCode: string, name: string) {
  const code = normalizeCode(rawCode);
  teardown();
  // Desde aquí este teléfono refleja la partida del anfitrión y deja de guardar la suya.
  link.guest = true;
  link.send = (a) => send(hostConn, { t: 'act', a });
  usePrefs.getState().set({ name });
  useNet.setState({ role: 'guest', code, status: 'connecting', error: undefined, present: [] });
  useGame.setState({ screen: 'lobby', online: true, players: [], round: null });
  hostSeen = Date.now();
  lostAt = 0;
  let PeerCtor: typeof Peer;
  try {
    PeerCtor = (await import('peerjs')).Peer;
  } catch {
    return exitGuest('No se pudo cargar el modo en línea. Revisa tu conexión.');
  }
  if (useNet.getState().role !== 'guest') return;

  const p = new PeerCtor(peerOptions());
  peer = p;
  p.on('open', dial);
  p.on('disconnected', () => peer === p && redial());
  p.on('error', (err) => {
    if (peer !== p) return;
    // La sala no existe (o el anfitrión está recargando): si nunca entramos, se avisa de una vez.
    if (err.type === 'peer-unavailable' && useNet.getState().status === 'connecting')
      return void exitGuest(`No hay ninguna sala con el código ${code}. Revísalo con el anfitrión.`);
    redial();
  });
  clearInterval(beat);
  beat = window.setInterval(() => {
    if (useNet.getState().status === 'open' && Date.now() - hostSeen > DEAD_MS) redial();
  }, BEAT_MS);
}

/** Deja el modo invitado y recupera lo que este teléfono tenía guardado. */
async function exitGuest(error?: string) {
  send(hostConn, { t: 'bye' });
  teardown();
  clock.offset = 0;
  // Orden importante: primero se limpia y se recarga lo guardado, y solo entonces se vuelve a guardar.
  useGame.setState({ players: [], profiles: {}, round: null, online: false, benched: undefined, customCards: [] });
  syncCustom([]);
  await useGame.persist.rehydrate();
  link.guest = false;
  link.send = () => {};
  useNet.setState({ role: 'off', code: '', status: error ? 'error' : 'idle', error, present: [] });
  useGame.setState({ screen: error ? 'online' : 'home', online: false });
}

// ------------------------------------------------------------------ Reacciones

const lastReact = new Map<string, number[]>();

/** Anfitrión: reenvía una reacción a todos (con un límite para que nadie inunde la pantalla). */
function relayReaction(e: unknown, from: string) {
  if (typeof e !== 'string' || !REACTIONS.includes(e)) return;
  const t = Date.now();
  const recent = (lastReact.get(from) ?? []).filter((x) => t - x < 2000);
  if (recent.length >= 5) return;
  lastReact.set(from, [...recent, t]);
  showReaction(e, from);
  for (const c of conns.values()) send(c, { t: 'react', e, from });
}

/** Lanza una reacción: en sala la ven todos los teléfonos; con un solo teléfono, solo este. */
export function react(e: string) {
  const net = useNet.getState();
  const me = publicId(usePrefs.getState().deviceId);
  if (net.role === 'guest') {
    showReaction(e, me);
    send(hostConn, { t: 'react', e });
  } else if (net.role === 'host') relayReaction(e, me);
  else showReaction(e);
}

// ------------------------------------------------------------------ Jugadores sin teléfono

/** Suma a alguien que juega en este teléfono. */
export function addLocalPlayer(name: string) {
  if (link.guest) return link.send({ a: 'addLocal', name });
  useGame.getState().addLocal(publicId(usePrefs.getState().deviceId), name);
}

/** Quita a alguien que jugaba en este teléfono (entre rondas). */
export function removeLocalPlayer(id: string) {
  if (link.guest) return link.send({ a: 'removeLocal', as: id });
  useGame.getState().removePlayer(id);
}

/** Cambia el avatar de un jugador de este teléfono (el anfitrión puede cambiar cualquiera). */
export function changeAvatar(id: string, avatar: string) {
  if (link.guest) return link.send({ a: 'avatar', as: id, avatar });
  useGame.getState().setAvatar(id, avatar);
}

// ------------------------------------------------------------------ Común

/** Salir de la sala (invitado) o cerrarla para todos (anfitrión). */
export async function leaveRoom() {
  const { role } = useNet.getState();
  if (role === 'guest') return exitGuest();
  for (const c of conns.values()) send(c, { t: 'bye' });
  // Un respiro para que el aviso alcance a salir antes de cortar.
  await new Promise((r) => setTimeout(r, 250));
  teardown();
  useNet.setState({ role: 'off', code: '', status: 'idle', error: undefined, present: [] });
  useGame.getState().closeRoom();
}

/** Al abrir la app: vuelve a la sala en la que estaba este teléfono, si había una. */
export function bootNet() {
  const { role, code } = useNet.getState();
  const game = useGame.getState();
  const name = usePrefs.getState().name;
  if (role === 'host' && game.online && validCode(code)) void hostRoom(name, code);
  else if (role === 'guest' && validCode(code)) void joinRoom(code, name);
  else {
    useNet.setState({ role: 'off', code: '', status: 'idle', present: [] });
    if (game.online) game.closeRoom();
  }
  // Al volver a la app (el teléfono se durmió), se revisa la conexión de inmediato.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const net = useNet.getState();
    if (net.role === 'guest' && !hostConn?.open) redial();
    if (net.role === 'host' && peer?.disconnected && !peer.destroyed) peer.reconnect();
  });
}
