/**
 * Llamada de voz de la sala (micrófono y altavoz en tiempo real).
 *
 * Cada teléfono que entra a la llamada se conecta directo con los demás que también están en
 * ella (WebRTC por PeerJS, la misma vía que ya usa la sala). El anfitrión reparte la lista de
 * quiénes están (`roster`) y, para que cada pareja tenga una sola llamada, marca el teléfono con
 * el id menor. Al entrar se manda silencio; al abrir el micrófono se cambia la pista sin volver a
 * conectar, y silenciar solo apaga la pista. Al salir de la llamada se suelta el micrófono.
 */
import type { MediaConnection, Peer } from 'peerjs';
import { create } from 'zustand';
import { sfx } from '../audio/sfx';
import { useGame } from '../store/game';

export interface VoiceEntry {
  /** Id de PeerJS del teléfono (para llamarlo). */
  peer: string;
  /** Tiene el micrófono abierto. */
  mic: boolean;
}

interface VoiceState {
  /** Este teléfono está en la llamada (escucha y puede hablar). */
  joined: boolean;
  /** Micrófono abierto. */
  mic: boolean;
  /** Esperando el permiso del micrófono. */
  asking: boolean;
  error?: string;
  /** Quiénes están en la llamada: id del teléfono → cómo llamarlo y si tiene el micrófono abierto. */
  roster: Record<string, VoiceEntry>;
  /** Teléfonos que están hablando en este momento. */
  talking: string[];
}

export const useVoice = create<VoiceState>(() => ({
  joined: false,
  mic: false,
  asking: false,
  roster: {},
  talking: [],
}));

/** ¿El navegador permite usar el micrófono? */
export const voiceSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined';

let peer: Peer | null = null;
let me = '';
let publish: (on: boolean, mic: boolean) => void = () => {};
let actx: AudioContext | null = null;
let silent: MediaStreamTrack | null = null;
let micStream: MediaStream | null = null;
let localAn: AnalyserNode | null = null;
let meter = 0;
const calls = new Map<string, MediaConnection>();
const outs = new Map<
  string,
  {
    el: HTMLAudioElement;
    src: MediaStreamAudioSourceNode;
    an: AnalyserNode;
    gain: GainNode;
  }
>();

/** La red avisa que hay una conexión nueva (anfitrión o invitado) y cómo anunciar el estado de la voz. */
export function bindVoice(p: Peer, myId: string, pub: (on: boolean, mic: boolean) => void) {
  peer = p;
  me = myId;
  publish = pub;
  p.on('call', onIncoming);
}

function context() {
  if (!actx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new Ctx();
  }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}

/** Pista muda: se manda mientras el micrófono no se ha abierto. */
function silentTrack() {
  if (!silent || silent.readyState === 'ended') silent = context().createMediaStreamDestination().stream.getAudioTracks()[0];
  return silent;
}

const sendTrack = () => {
  const t = micStream?.getAudioTracks()[0];
  return t && t.readyState === 'live' ? t : silentTrack();
};

/** Cambia lo que se manda en todas las llamadas (sin volver a conectar). */
function swapTracks() {
  const track = sendTrack();
  for (const c of calls.values()) for (const s of c.peerConnection?.getSenders() ?? []) if (s.track?.kind === 'audio' || !s.track) void s.replaceTrack(track).catch(() => {});
}

/** Entra a la llamada (hay que llamarlo desde un toque: abre el audio y pide el micrófono). */
export async function joinVoice(withMic = true) {
  if (useVoice.getState().joined) return withMic ? setMic(true) : undefined;
  context();
  silentTrack();
  useVoice.setState({ joined: true, error: undefined });
  sfx.duck(true);
  startMeter();
  publish(true, false);
  setRoster(useVoice.getState().roster);
  if (withMic) await setMic(true);
}

/** Abre o silencia el micrófono. */
export async function setMic(on: boolean) {
  if (!useVoice.getState().joined) return;
  if (on && (!micStream || micStream.getAudioTracks()[0]?.readyState !== 'live')) {
    if (!voiceSupported())
      return void useVoice.setState({
        error: 'Este navegador no deja usar el micrófono.',
      });
    useVoice.setState({ asking: true, error: undefined });
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      const denied = (e as DOMException)?.name === 'NotAllowedError';
      return void useVoice.setState({
        asking: false,
        error: denied ? 'No diste permiso para usar el micrófono. Actívalo en los permisos del navegador y vuelve a intentar.' : 'No se pudo abrir el micrófono.',
      });
    }
    // Salió de la llamada mientras se pedía el permiso.
    if (!useVoice.getState().joined) return stopMic();
    const ctx = context();
    localAn = ctx.createAnalyser();
    localAn.fftSize = 512;
    ctx.createMediaStreamSource(micStream).connect(localAn);
    useVoice.setState({ asking: false });
  }
  const track = micStream?.getAudioTracks()[0];
  if (track) track.enabled = on;
  swapTracks();
  useVoice.setState({ mic: on && !!track });
  publish(true, on && !!track);
}

/** Sale de la llamada y suelta el micrófono. */
export function leaveVoice() {
  if (!useVoice.getState().joined) return;
  closeAll();
  stopMic();
  clearInterval(meter);
  useVoice.setState({ joined: false, mic: false, talking: [], asking: false });
  sfx.duck(false);
  publish(false, false);
}

/** Al salir de la sala: se cuelga todo sin avisar a nadie. */
export function resetVoice() {
  closeAll();
  stopMic();
  clearInterval(meter);
  peer = null;
  useVoice.setState({
    joined: false,
    mic: false,
    asking: false,
    error: undefined,
    roster: {},
    talking: [],
  });
  sfx.duck(false);
}

function stopMic() {
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  localAn?.disconnect();
  localAn = null;
}

/** El anfitrión mandó la lista de quiénes están en la llamada: se conecta o cuelga a quien haga falta. */
export function setRoster(roster: Record<string, VoiceEntry>) {
  useVoice.setState({ roster });
  const { joined } = useVoice.getState();
  if (!joined || !peer || peer.destroyed) return closeAll();
  for (const [pid, e] of Object.entries(roster)) {
    if (pid === me) continue;
    const c = calls.get(pid);
    // Volvió a entrar con otra conexión: se cuelga la vieja.
    if (c && c.peer !== e.peer) drop(pid);
    if (!calls.has(pid) && me < pid) dialVoice(pid, e.peer);
  }
  for (const pid of [...calls.keys()]) if (!roster[pid]) drop(pid);
}

function dialVoice(pid: string, peerId: string) {
  if (!peer || peer.destroyed || peer.disconnected) return;
  const c = peer.call(peerId, new MediaStream([sendTrack()]), {
    metadata: { pid: me },
  });
  if (c) follow(pid, c);
}

function onIncoming(c: MediaConnection) {
  const pid = (c.metadata as { pid?: unknown } | undefined)?.pid;
  // Solo se contesta a teléfonos de la sala y si este también está en la llamada.
  const known = typeof pid === 'string' && useGame.getState().players.some((p) => p.id === pid && !p.owner);
  if (!known || !useVoice.getState().joined) return c.close();
  const old = calls.get(pid);
  if (old && old !== c) drop(pid);
  c.answer(new MediaStream([sendTrack()]));
  follow(pid, c);
}

function follow(pid: string, c: MediaConnection) {
  calls.set(pid, c);
  c.on('stream', (stream) => listen(pid, stream));
  const end = () => {
    if (calls.get(pid) === c) drop(pid);
  };
  c.on('close', end);
  c.on('error', end);
}

/** Toca la voz de otro teléfono por el altavoz y la mide para saber cuándo habla. */
function listen(pid: string, stream: MediaStream) {
  mute(pid);
  const ctx = context();
  // Chrome solo entrega el audio remoto a Web Audio si un elemento de audio también lo "reproduce" (en silencio).
  const el = new Audio();
  el.muted = true;
  el.autoplay = true;
  el.setAttribute('playsinline', '');
  el.srcObject = stream;
  void el.play().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 512;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  src.connect(an);
  src.connect(gain).connect(ctx.destination);
  outs.set(pid, { el, src, an, gain });
}

function mute(pid: string) {
  const o = outs.get(pid);
  if (!o) return;
  o.src.disconnect();
  o.gain.disconnect();
  o.el.pause();
  o.el.srcObject = null;
  outs.delete(pid);
}

function drop(pid: string) {
  const c = calls.get(pid);
  calls.delete(pid);
  try {
    c?.close();
  } catch {
    /* ya estaba cerrada */
  }
  mute(pid);
}

function closeAll() {
  for (const pid of [...calls.keys()]) drop(pid);
  for (const pid of [...outs.keys()]) mute(pid);
}

/** Mide quién está hablando (para iluminar su avatar). */
function startMeter() {
  clearInterval(meter);
  const buf = new Float32Array(512);
  const level = (an: AnalyserNode) => {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  };
  meter = window.setInterval(() => {
    const st = useVoice.getState();
    const talking: string[] = [];
    if (localAn && st.mic && level(localAn) > 0.02) talking.push(me);
    for (const [pid, o] of outs) if (st.roster[pid]?.mic && level(o.an) > 0.015) talking.push(pid);
    const prev = st.talking;
    if (talking.length !== prev.length || talking.some((x, i) => x !== prev[i])) useVoice.setState({ talking });
  }, 150);
}

/** Para pruebas: llamadas abiertas, con quién y cuánto se oye a cada uno. */
export function voiceDebug() {
  const buf = new Float32Array(512);
  const levels: Record<string, number> = {};
  for (const [pid, o] of outs) {
    o.an.getFloatTimeDomainData(buf);
    levels[pid] = buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  }
  return { calls: [...calls.keys()], outs: [...outs.keys()], levels };
}
