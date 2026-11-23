/**
 * Fuego azul para abrir el sobre: el sobre de verdad (el diseño que te tocó) se quema desde donde
 * lo tocaste. Tres capas, todas calculadas en vivo (sin videos ni imágenes):
 *
 * 1. Un "campo de quemado" fijo (distancia al punto de encendido + ruido): cada punto del sobre se
 *    quema cuando el avance `p` pasa su valor. Se calcula una vez en la CPU.
 * 2. Una máscara (`mask-image`) que borra del sobre lo que ya se quemó (mismo campo, baja resolución).
 * 3. Un shader de WebGL encima: papel que se carboniza con grietas que brillan, orilla al rojo azul
 *    y llamas azules que suben; y un lienzo 2D con chispas y ceniza que flota.
 *
 * Si no hay WebGL, la orilla y lo carbonizado se dibujan en el lienzo 2D (sin llamas).
 */

import { perf } from '../services/perf';

/** Cuánto se sale el lienzo del sobre (fracción del ancho o alto del sobre): arriba hay espacio para las llamas. */
export const FIRE_EXT = { l: 0.32, r: 0.32, t: 0.58, b: 0.14 };

/** Ruido de valor con su propio generador (enteros): da lo mismo en todos los teléfonos. */
function hash2(i: number, j: number, seed: number) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  let fx = x - i;
  let fy = y - j;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, seed);
  const b = hash2(i + 1, j, seed);
  const c = hash2(i, j + 1, seed);
  const d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number, seed: number) {
  let s = 0;
  let amp = 0.5;
  for (let o = 0; o < 4; o++) {
    s += amp * vnoise(x, y, seed + o * 17);
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return s / 0.9375;
}

/**
 * Valor de quemado de cada celda (0 = se quema primero, ~0.97 = al último). `ox`, `oy`: punto de
 * encendido (0..1). `aspect`: alto/ancho del sobre. Cerca del punto de encendido no hay ruido, así
 * que el fuego siempre empieza justo donde tocaste.
 */
export function burnField(cols: number, rows: number, ox: number, oy: number, aspect: number, seed: number): Float32Array {
  const out = new Float32Array(cols * rows);
  let maxD = 0;
  for (const [cx, cy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ])
    maxD = Math.max(maxD, Math.hypot(cx - ox, (cy - oy) * aspect));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols;
      const v = (j + 0.5) / rows;
      const dist = Math.hypot(u - ox, (v - oy) * aspect) / maxD;
      const n = fbm(u * 3.4, v * 3.4 * aspect, seed);
      const n2 = fbm(u * 9, v * 9 * aspect, seed + 101);
      out[j * cols + i] = Math.max(0, dist * 0.74 + ((n - 0.5) * 0.36 + (n2 - 0.5) * 0.09) * Math.min(1, dist * 5));
    }
  }
  // Se escala (sin recortar) para que lo último en quemarse llegue a 0.97: si se recortara, quedaría
  // una zona pareja que desaparecería de golpe con orillas rectas.
  let top = 0;
  for (const v of out) top = Math.max(top, v);
  if (top > 0) for (let k = 0; k < out.length; k++) out[k] = (out[k] / top) * 0.97;
  return out;
}

/** Avance del fuego según el tiempo (0..1): prende despacio y luego corre. Pasa de 1 al final. */
export const burnProgress = (t: number, top = 0.97) => -0.03 + (top + 0.08) * Math.pow(Math.min(1, Math.max(0, t)), 1.2);

/** Qué tanto se ve el sobre en un punto según cuánto le falta para quemarse (`d` = campo − avance). */
export const maskAlpha = (d: number) => (d <= -0.006 ? 0 : d >= 0.016 ? 1 : (d + 0.006) / 0.022);

const VERT = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `precision highp float;
#ifndef STEPS
#define STEPS 10
#endif
varying vec2 vUv;
uniform sampler2D uField;
uniform vec4 uRect;
uniform vec2 uRes;
uniform float uP, uT, uFlame;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= .5; } return s / .9375; }
float field(vec2 uv){
  vec2 f = (uv - uRect.xy) / uRect.zw;
  if (f.x < 0. || f.x > 1. || f.y < 0. || f.y > 1.) return 9.;
  vec4 t = texture2D(uField, f);
  return t.r + t.g / 255.;
}
// Orilla encendida: brilla desde un poquito ya quemado hasta un poquito antes.
float rim(float d){ return smoothstep(-0.045, 0., d) * (1. - smoothstep(0., 0.08, d)); }
void main(){
  vec2 uv = vUv;
  float ar = uRes.y / uRes.x;
  vec2 sq = vec2(uv.x, uv.y * ar);
  float f = field(uv);
  float d = f - uP;
  vec3 col = vec3(0.);
  float a = 0.;
  if (f < 8.) {
    // Papel que se carboniza antes de quemarse: primero se tuesta y luego queda negro, con manchas.
    float c = (1. - smoothstep(0.03, 0.2, d)) * step(0., d);
    c *= 0.75 + 0.25 * vn(sq * 55.);
    float burnt = 1. - smoothstep(0.02, 0.1, d);
    a = 0.97 * pow(c, 0.9);
    col = mix(vec3(0.09, 0.06, 0.1), vec3(0.006, 0.008, 0.025), burnt) * a;
    // Más adelante, el papel apenas se tuesta con el calor.
    float toast = (1. - smoothstep(0.18, 0.34, d)) * step(0.15, d) * (0.6 + 0.4 * vn(sq * 20.));
    col += vec3(0.03, 0.03, 0.06) * toast * 0.35;
    a = max(a, toast * 0.35);
    // Grietas que brillan en lo carbonizado.
    float r = 1. - abs(2. * fbm(sq * 16. + vec2(0., uT * .15)) - 1.);
    float crack = pow(r, 9.) * (1. - smoothstep(0.0, 0.15, d)) * step(0., d);
    col += vec3(0.25, 0.55, 1.) * crack * 1.5;
    a = max(a, crack);
    // Brasitas que titilan.
    float sp = vn(sq * 85. + vec2(uT * 2.3, -uT * 1.7));
    float ember = smoothstep(0.86, 0.97, sp) * (1. - smoothstep(0.0, 0.07, d)) * step(0., d);
    col += vec3(0.55, 0.8, 1.) * ember;
    a = max(a, ember);
    // La orilla: blanco azulado en el centro, azul eléctrico alrededor.
    float e = pow(rim(d), 1.2) * (0.8 + 0.45 * vn(sq * 40. + uT * 4.));
    e = min(e, 1.);
    vec3 ec = mix(vec3(0.1, 0.3, 1.), vec3(0.9, 0.97, 1.), smoothstep(0.55, 1., e));
    col = col * (1. - e) + ec * e;
    a = a * (1. - e) + e;
  }
  // Llamas: miran hacia abajo buscando la orilla y suben con turbulencia, en lenguas.
  float wob = fbm(vec2(uv.x * 7., uv.y * 5. + uT * 2.4)) - .5;
  float tongue = 0.3 + 1.3 * vn(vec2(uv.x * 17., uT * 2.2)) * vn(vec2(uv.x * 31. + 4., uT * 3.1));
  float fl = 0.;
  float halo = 0.;
  for (int k = 0; k < STEPS; k++) {
    float s = float(k) / float(STEPS - 1) * 0.24 * tongue;
    vec2 q = vec2(uv.x + wob * 0.08 * (s / 0.24), uv.y + s);
    float eq = rim(field(q) - uP);
    fl += eq * (1. - float(k) / float(STEPS)) * (12. / float(STEPS));
    halo += eq * (12. / float(STEPS));
  }
  float turb = fbm(vec2(uv.x * 14., uv.y * 9. + uT * 4.5));
  fl = clamp(fl * 0.3 * uFlame * (0.2 + 1.4 * turb * turb), 0., 1.);
  halo = clamp(halo * 0.05 * uFlame, 0., 0.5);
  vec3 fc = mix(vec3(0.05, 0.1, 0.85), vec3(0.15, 0.48, 1.), smoothstep(0.08, 0.45, fl));
  fc = mix(fc, vec3(0.8, 0.94, 1.), smoothstep(0.6, 0.98, fl));
  float fa = max(smoothstep(0.04, 0.75, fl) * 0.93, halo * 0.45);
  fc = mix(vec3(0.1, 0.25, 1.), fc, smoothstep(0.0, 0.2, fl));
  col = col * (1. - fa) + fc * fa;
  a = a * (1. - fa) + fa;
  gl_FragColor = vec4(col, a);
}`;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  ash: boolean;
  rot: number;
  vr: number;
}

export interface BlueFireOptions {
  /** El sobre (se le pone la máscara). */
  pack: HTMLElement;
  /** Lienzo para WebGL y lienzo 2D, encima del sobre y del tamaño de `FIRE_EXT`. */
  glCanvas: HTMLCanvasElement;
  fxCanvas: HTMLCanvasElement;
  /** Punto de encendido (0..1 del sobre). */
  origin: { x: number; y: number };
  /** Cuánto tarda en quemarse todo (ms). */
  duration: number;
  seed?: number;
  /** Color del papel (los pedazos que se desprenden empiezan de ese color y se carbonizan). */
  paper?: string;
  /** Cuando ya no queda nada del sobre (ni la orilla encendida). */
  onBurnt?: () => void;
  /** Cuando se apagó la última chispa. */
  onEnd?: () => void;
}

const COLS = 72;

interface FireGL {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
}
const compiled = new WeakMap<HTMLCanvasElement, FireGL | null>();

/** Prepara el shader del fuego en ese lienzo (una sola vez; compilarlo tarda y daba un tirón al tocar). */
function compileFire(canvas: HTMLCanvasElement): FireGL | null {
  if (compiled.has(canvas)) return compiled.get(canvas)!;
  let out: FireGL | null = null;
  try {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) as WebGLRenderingContext | null;
    if (gl) {
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `${perf.lite ? '#define STEPS 6\n' : ''}${FRAG}`));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const ap = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      const loc: FireGL['loc'] = {};
      for (const u of ['uField', 'uRect', 'uRes', 'uP', 'uT', 'uFlame']) loc[u] = gl.getUniformLocation(prog, u);
      out = { gl, prog, loc };
    }
  } catch {
    out = null;
  }
  compiled.set(canvas, out);
  return out;
}

/**
 * Deja listo el fuego antes de que lo toquen: compila el shader y dibuja una vez en chiquito (muchos
 * teléfonos terminan de compilar hasta el primer dibujo).
 */
export function warmBlueFire(canvas: HTMLCanvasElement) {
  const f = compileFire(canvas);
  if (!f) return;
  const { gl, loc } = f;
  canvas.width = canvas.height = 2;
  gl.viewport(0, 0, 2, 2);
  gl.uniform1f(loc.uP, -1);
  gl.uniform1f(loc.uFlame, 0);
  gl.uniform4f(loc.uRect, 0, 0, 1, 1);
  gl.uniform2f(loc.uRes, 2, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

/** Prende el fuego. Devuelve una función para apagarlo y limpiar. */
export function startBlueFire(o: BlueFireOptions): () => void {
  const { pack, glCanvas, fxCanvas } = o;
  const pw = pack.offsetWidth || 240;
  const ph = pack.offsetHeight || 387;
  const aspect = ph / pw;
  const rows = Math.round(COLS * aspect);
  const field = burnField(COLS, rows, o.origin.x, o.origin.y, aspect, o.seed ?? Math.floor(Math.random() * 1e6));
  let top = 0;
  for (const v of field) top = Math.max(top, v);

  // Tamaño de los lienzos (CSS) y del sobre dentro de ellos.
  const cw = pw * (1 + FIRE_EXT.l + FIRE_EXT.r);
  const chh = ph * (1 + FIRE_EXT.t + FIRE_EXT.b);
  const rect = [FIRE_EXT.l / (1 + FIRE_EXT.l + FIRE_EXT.r), FIRE_EXT.t / (1 + FIRE_EXT.t + FIRE_EXT.b), 1 / (1 + FIRE_EXT.l + FIRE_EXT.r), 1 / (1 + FIRE_EXT.t + FIRE_EXT.b)];
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  // ---------- Máscara del sobre ----------
  const mcan = document.createElement('canvas');
  mcan.width = COLS;
  mcan.height = rows;
  const mctx = mcan.getContext('2d');
  const mimg = mctx?.createImageData(COLS, rows);
  const st = pack.style as CSSStyleDeclaration & { webkitMaskImage: string; webkitMaskSize: string; webkitMaskRepeat: string };
  st.webkitMaskSize = st.maskSize = '100% 100%';
  st.webkitMaskRepeat = st.maskRepeat = 'no-repeat';
  let maskBusy = false;
  // Avance de la máscara que ya se ve: las llamas y la orilla se dibujan con ese mismo avance, así
  // nunca hay sobre sin borrar fuera de la orilla (la máscara tarda uno o dos cuadros en aplicarse).
  let shownP = -1;
  const pushMask = (p: number) => {
    if (maskBusy || !mctx || !mimg) return;
    maskBusy = true;
    const px = mimg.data;
    for (let k = 0; k < field.length; k++) {
      px[k * 4] = px[k * 4 + 1] = px[k * 4 + 2] = 255;
      px[k * 4 + 3] = Math.round(maskAlpha(field[k] - p) * 255);
    }
    mctx.putImageData(mimg, 0, 0);
    const url = mcan.toDataURL();
    const img = new Image();
    img.src = url;
    // Se aplica ya decodificada: así el sobre nunca parpadea completo ni desaparece de golpe. Si el
    // navegador tarda en decodificarla (o nunca avisa, como a veces en iPhone), se aplica igual.
    const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    void Promise.race([decoded, new Promise((r) => window.setTimeout(r, 150))])
      .then(() => {
        if (stopped) return;
        st.webkitMaskImage = st.maskImage = `url(${url})`;
        shownP = p;
        maskBusy = false;
      });
  };

  // ---------- WebGL ----------
  // El fuego es borroso por naturaleza: se calcula a menos resolución y el navegador lo estira.
  // Si aun así el teléfono no alcanza, baja solo (ver `adapt`).
  let glScale = perf.lite ? 0.4 : 0.6;
  glCanvas.width = Math.round(cw * glScale);
  glCanvas.height = Math.round(chh * glScale);
  const ready = compileFire(glCanvas);
  const gl = ready?.gl ?? null;
  const prog = ready?.prog ?? null;
  const loc = ready?.loc ?? {};
  if (gl) {
    try {
      // Campo en una textura: rojo = parte gruesa, verde = parte fina (se mezclan bien al interpolar).
      const tex = new Uint8Array(COLS * rows * 4);
      for (let k = 0; k < field.length; k++) {
        const v = field[k] * 255;
        const hi = Math.floor(v);
        tex[k * 4] = hi;
        tex[k * 4 + 1] = Math.round((v - hi) * 255);
        tex[k * 4 + 3] = 255;
      }
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, COLS, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(loc.uField, 0);
      gl.uniform4f(loc.uRect, rect[0], rect[1], rect[2], rect[3]);
      gl.uniform2f(loc.uRes, glCanvas.width, glCanvas.height);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.clearColor(0, 0, 0, 0);
    } catch {
      /* sin textura: no se dibuja el fuego de WebGL */
    }
  }

  // ---------- Chispas y ceniza (2D) ----------
  fxCanvas.width = Math.round(cw * dpr);
  fxCanvas.height = Math.round(chh * dpr);
  const ctx = fxCanvas.getContext('2d');
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const sg = sprite.getContext('2d');
  if (sg) {
    const g = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(170,215,255,0.95)');
    g.addColorStop(0.6, 'rgba(60,120,255,0.35)');
    g.addColorStop(1, 'rgba(20,40,255,0)');
    sg.fillStyle = g;
    sg.fillRect(0, 0, 32, 32);
  }
  // Respaldo sin WebGL: la orilla y lo carbonizado en una imagen chiquita que se estira.
  const low = gl ? null : document.createElement('canvas');
  const lctx = low?.getContext('2d') ?? null;
  const limg = lctx?.createImageData(COLS, rows) ?? null;
  if (low) {
    low.width = COLS;
    low.height = rows;
  }
  const sparks: Spark[] = [];
  const hex = /^#([0-9a-f]{6})$/i.exec(o.paper ?? '');
  const paper = hex ? [0, 2, 4].map((k) => parseInt(hex[1].slice(k, k + 2), 16)) : [120, 90, 200];
  // De unidades del sobre (0..1) a píxeles del lienzo 2D.
  const toPx = (u: number, v: number) => [(FIRE_EXT.l + u) * pw * dpr, (FIRE_EXT.t + v) * ph * dpr];

  const spawn = (p: number, dt: number, rate: number) => {
    const tries = Math.round((perf.lite ? 30 : 70) * dt * 60 * rate);
    for (let k = 0; k < tries; k++) {
      const i = Math.floor(Math.random() * COLS);
      const j = Math.floor(Math.random() * rows);
      const d = field[j * COLS + i] - p;
      const ash = d > -0.035 && d < 0;
      const spark = d >= 0 && d < 0.03;
      if (!ash && !spark) continue;
      if (ash && Math.random() > 0.5) continue;
      const [x, y] = toPx((i + Math.random()) / COLS, (j + Math.random()) / rows);
      sparks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 50 * dpr,
        vy: -(ash ? 30 + Math.random() * 50 : 60 + Math.random() * 120) * dpr,
        age: 0,
        life: ash ? 1.1 + Math.random() * 0.9 : 0.35 + Math.random() * 0.6,
        size: (ash ? 2.5 + Math.random() * 5.5 : 1.2 + Math.random() * 2.2) * dpr,
        ash,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
      });
    }
    const cap = perf.lite ? 150 : 380;
    if (sparks.length > cap) sparks.splice(0, sparks.length - cap);
  };

  const drawFallback = (p: number) => {
    if (!lctx || !limg || !low || !ctx) return;
    const px = limg.data;
    for (let k = 0; k < field.length; k++) {
      const d = field[k] - p;
      const e = d > -0.03 && d < 0.055 ? (d < 0 ? (d + 0.03) / 0.03 : 1 - d / 0.055) : 0;
      const c = d >= 0 && d < 0.17 ? Math.pow(1 - Math.max(0, d - 0.035) / 0.135, 2) * 0.9 : 0;
      const a = Math.max(e, c);
      px[k * 4] = Math.round(255 * (0.1 + 0.8 * e * e) * (e > 0 ? 1 : 0.05));
      px[k * 4 + 1] = Math.round(255 * (0.3 + 0.65 * e * e) * (e > 0 ? 1 : 0.06));
      px[k * 4 + 2] = Math.round(255 * (e > 0 ? 1 : 0.15));
      px[k * 4 + 3] = Math.round(255 * a);
    }
    lctx.putImageData(limg, 0, 0);
    const [x0, y0] = toPx(0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(low, x0, y0, pw * dpr, ph * dpr);
  };

  // Si los cuadros tardan, baja la resolución del fuego (hasta dos veces).
  const times: number[] = [];
  let downs = 0;
  const adapt = (dt: number) => {
    if (!gl || downs >= 2) return;
    times.push(dt);
    if (times.length < 14) return;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    times.length = 0;
    if (avg > 0.026) {
      downs++;
      glScale *= 0.72;
      glCanvas.width = Math.round(cw * glScale);
      glCanvas.height = Math.round(chh * glScale);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.uniform2f(loc.uRes, glCanvas.width, glCanvas.height);
    }
  };
  // El sobre en su propia capa: así cambiar la máscara no obliga a repintar todo su dibujo.
  pack.style.willChange = 'transform';

  let stopped = false;
  let ended = false;
  let raf = 0;
  const t0 = performance.now();
  let last = t0;
  let burnt = false;
  const fadeMs = 900;

  /** Borra los dos lienzos y los esconde: nunca se queda un cuadro viejo pegado en la pantalla. */
  const wipe = () => {
    try {
      if (gl && !gl.isContextLost()) gl.clear(gl.COLOR_BUFFER_BIT);
    } catch {
      /* contexto perdido */
    }
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }
    glCanvas.style.visibility = fxCanvas.style.visibility = 'hidden';
  };
  /** Se acabó (o algo falló): limpia y avisa, una sola vez. */
  const finish = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    wipe();
    if (!burnt) {
      burnt = true;
      o.onBurnt?.();
    }
    o.onEnd?.();
  };
  glCanvas.style.visibility = fxCanvas.style.visibility = 'visible';

  const frame = (now: number) => {
    if (stopped || ended) return;
    try {
      step(now);
    } catch {
      finish();
    }
  };
  const step = (now: number) => {
    // Hasta 0.1 s por cuadro: en un teléfono lento las chispas se apagan a tiempo.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    adapt(dt);
    const el = now - t0;
    const t = el / o.duration;
    const target = burnProgress(t, top) + Math.max(0, el - o.duration) / 4000;
    pushMask(target);
    const p = shownP < 0 ? Math.min(target, -0.02) : shownP;
    // Ya no queda sobre cuando lo último pasó la orilla encendida (`rim` brilla hasta 0.045 después).
    if (!burnt && (p >= top + 0.045 || t >= 1.35)) {
      burnt = true;
      o.onBurnt?.();
    }
    // Las llamas crecen al prender y se apagan al terminar.
    const flame = Math.min(1, t / 0.12) * (t < 1 ? 1 : Math.max(0, 1 - (el - o.duration) / (fadeMs * 0.6)));
    if (gl && prog) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(loc.uP, p);
      gl.uniform1f(loc.uT, el / 1000);
      gl.uniform1f(loc.uFlame, flame);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (ctx) {
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      if (!gl) drawFallback(p);
      if (t < 1.05) spawn(p, dt, 0.6 + 0.6 * Math.min(1, t * 2));
      for (const s of sparks) {
        s.age += dt;
        if (s.ash) {
          s.vx += Math.sin(s.age * 6 + s.rot * 3) * 30 * dpr * dt;
          s.vy *= 1 - 0.4 * dt;
        } else {
          s.vy -= 90 * dpr * dt;
          s.vx += (Math.random() - 0.5) * 120 * dpr * dt;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vr * dt;
      }
      for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k].age >= sparks[k].life) sparks.splice(k, 1);
      // Ceniza: pedacitos oscuros con la orilla todavía encendida, que se enfrían al subir.
      ctx.globalCompositeOperation = 'source-over';
      for (const s of sparks) {
        if (!s.ash) continue;
        const u = s.age / s.life;
        const hot = Math.max(0, 1 - u * 2.2);
        // Del color del sobre a carbón.
        const pc = Math.max(0, 1 - u * 3.5);
        const mix = (c: number, k: number) => Math.round(c * pc * 0.8 + (14 + hot * k) * (1 - pc));
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(1, 0.55 + 0.45 * Math.cos(s.age * 7 + s.rot));
        ctx.globalAlpha = (1 - u) * 0.95;
        ctx.fillStyle = `rgb(${mix(paper[0], 30)},${mix(paper[1], 60)},${mix(paper[2], 150)})`;
        ctx.beginPath();
        ctx.moveTo(-s.size / 2, -s.size * 0.4);
        ctx.lineTo(s.size * 0.45, -s.size * 0.5);
        ctx.lineTo(s.size / 2, s.size * 0.3);
        ctx.lineTo(-s.size * 0.2, s.size * 0.45);
        ctx.closePath();
        ctx.fill();
        if (hot > 0) {
          ctx.strokeStyle = `rgba(130,200,255,${hot})`;
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
        }
        ctx.restore();
      }
      // Chispas: puntitos de luz azul que suben titilando.
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        if (s.ash) continue;
        const u = s.age / s.life;
        ctx.globalAlpha = (1 - u) * (0.6 + 0.4 * Math.sin(s.age * 40 + s.rot * 9));
        const r = s.size * (3.2 - u * 1.5);
        ctx.drawImage(sprite, s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if ((el > o.duration + fadeMs && sparks.length === 0) || el > o.duration + fadeMs + 1500) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    wipe();
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    compiled.delete(glCanvas);
    // Suelta la memoria de los lienzos ya (iPhone tiene un tope de memoria para lienzos).
    glCanvas.width = glCanvas.height = fxCanvas.width = fxCanvas.height = 0;
    mcan.width = mcan.height = 0;
  };
}
