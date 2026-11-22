"""Eliminación 1: RAYO (Fulminado). Noche de tormenta con lluvia, cerros y relámpagos lejanos. Las
nubes giran sobre el jugador y se cargan de electricidad; un rayo guía baja a tientas (cuadros 17–21)
y en el cuadro 22 cae el rayo de verdad, con varias descargas. El suelo se agrieta al rojo vivo,
vuelan piedras y chispas, quedan arcos eléctricos y humo, y el jugador se desmorona en cenizas
(cuadros 40–50) que dejan un montoncito humeante."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (Particles, ballistic, curve_obj, disc, flat_mat, fractal, glow_mat, gradient_bg, key_alpha, key_color, key_fac, key_grow, key_strength, mountains, noise_cloud_mat, obj_color_mat, plane, reset, render, ring)

N = 60
STRIKE = 22
GZ = -1.15  # el piso, a los pies del jugador
sc = reset(N, seed=11)

# Qué tanto se ilumina todo en cada cuadro (relámpagos lejanos en 9 y 15, el rayo y sus descargas).
FLASH = {9: 0.35, 10: 0.1, 15: 0.25, 16: 0.08, STRIKE: 1.0, STRIKE + 1: 0.35, STRIKE + 2: 0.85, STRIKE + 3: 0.2, STRIKE + 4: 0.6, STRIKE + 5: 0.25, STRIKE + 6: 0.1, STRIKE + 7: 0.04}
flash_at = lambda f: FLASH.get(f, 0.0)


def flash_keys(base, peak, extra=()):
    """Llaves de intensidad que siguen a los relámpagos."""
    keys = {f: base for f in (1, N)}
    for f in range(1, N + 1):
        if flash_at(f) or flash_at(f - 1) or flash_at(f + 1):
            keys[f] = base + (peak - base) * flash_at(f)
    for f, v in extra:
        keys[f] = v
    return sorted(keys.items())


# ---------- Cielo, cerros y piso ----------
_, sky = gradient_bg('sky', [(0.0, (0.02, 0.018, 0.045)), (0.45, (0.03, 0.025, 0.065)), (0.7, (0.01, 0.009, 0.028)), (1.0, (0.004, 0.004, 0.012))])
key_strength(sky, flash_keys(1.0, 5.0))
# El destello del cielo va detrás de los cerros: se recortan negros contra la luz.
fm, fem, fmix = flat_mat('flash', (0.62, 0.7, 1.0), 1.0)
plane('flash', 14, 24, (0, 15, 0), fm)
key_fac(fmix, [(f, 0.6 * v) for f, v in flash_keys(0.0, 1.0)])
mfar, efar, _ = flat_mat('mfar', (0.012, 0.011, 0.028), 1)
mountains('mfar', -6, 6, GZ - 0.5, (0.2, 2.2), 0.45, 13, mfar, n=36)
key_strength(efar, flash_keys(1.0, 3.0))
mnear, enear, _ = flat_mat('mnear', (0.004, 0.0035, 0.01), 1)
mountains('mnear', -6, 6, GZ - 0.5, (-0.6, 0.6), 0.3, 11, mnear, n=50)
_, ground = gradient_bg('ground', [(0.0, (0.0015, 0.0015, 0.004)), (0.85, (0.006, 0.005, 0.013)), (1.0, (0.012, 0.01, 0.024))], y=10, h=9.6, z=GZ - 4.8)
key_strength(ground, flash_keys(1.0, 6.0))
# Charcos que reflejan el cielo.
pm, pem, pam = glow_mat('puddle', (0.3, 0.36, 0.6), 1.0, power=1.6, edge=1.0)
for i, (x, z, w) in enumerate([(-3.4, GZ - 1.0, 1.8), (3.0, GZ - 2.2, 2.4), (-2.0, GZ - 4.4, 2.8), (3.2, GZ - 6.6, 2.2), (-3.6, GZ - 7.8, 1.6)]):
    d = disc(f'puddle{i}', 0.5, (x, 9.5, z), pm)
    d.scale = (w, 0.12 * w, 1)
key_alpha(pam, flash_keys(0.03, 0.6))

# ---------- Nubes de tormenta: remolino sobre el jugador ----------
clouds = []
for i, (x, z, w, h, col, sp) in enumerate([
    (0, 9.6, 20, 7, (0.13, 0.11, 0.24), 0.25),
    (-3, 8.2, 12, 5, (0.1, 0.085, 0.19), -0.35),
    (3.5, 7.6, 12, 5, (0.11, 0.09, 0.2), 0.3),
    (0, 7.0, 9, 3.6, (0.08, 0.07, 0.16), 0.5),
    (0, 10.4, 22, 6, (0.18, 0.15, 0.32), -0.15),
]):
    m, mp, em, dens = noise_cloud_mat(f'cloud{i}', col, density=1.8, scale=1.6 + i * 0.25, strength=0.7, edge=2.0)
    els = m.node_tree.nodes['Color Ramp'].color_ramp.elements
    els[0].position, els[1].position = 0.32, 0.8
    o = plane(f'cloud{i}', w, h, (x, 5.1 - i * 0.37, z), m)
    for f, r in [(1, 0), (N, sp)]:
        mp.inputs['Rotation'].default_value = (0, 0, r)
        mp.inputs['Rotation'].keyframe_insert('default_value', frame=f)
        mp.inputs['Location'].default_value = (r * 0.6, i * 0.7, 0)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    key_strength(em, flash_keys(0.32, 5.0, [(12, 0.32), (STRIKE - 1, 0.6)]))
    clouds.append(em)
# Brillo que se carga dentro de las nubes, justo donde nace el rayo.
cm, cem, cam = glow_mat('charge', (0.55, 0.7, 1.0), 3, power=1.6, edge=1 / 3)
disc('charge', 3, (1.2, 4.5, 9.0), cm)
key_alpha(cam, [(1, 0), (10, 0.05), (14, 0.25), (17, 0.3), (18, 0.55), (19, 0.35), (20, 0.7), (21, 0.9), (STRIKE, 1), (STRIKE + 6, 0.2), (N, 0.05)])
# Relámpagos dentro de las nubes (destellos sueltos).
for i, (f, x, z) in enumerate([(5, -3.5, 9.3), (9, -2.6, 8.4), (12, 3.6, 9.6), (15, 3.0, 8.6), (19, -1.5, 9.8)]):
    gm, gem, gam = glow_mat(f'cflash{i}', (0.6, 0.7, 1.0), 4, power=1.4, edge=1 / 2.6)
    disc(f'cflash{i}', 2.6, (x, 4.2, z), gm)
    key_alpha(gam, [(1, 0), (f - 1, 0), (f, 0.9), (f + 1, 0.2), (f + 2, 0), (N, 0)])

# ---------- Rayos lejanos (detrás de los cerros) ----------
far_mat = obj_color_mat('farbolt', 12)
for i, (f, x0, x1) in enumerate([(9, -3.4, -2.2), (15, 3.6, 2.6)]):
    pts = fractal((x0, 8.2), (x1, -0.2), 0.18, 5)
    o = curve_obj(f'farbolt{i}', pts, 0.02, far_mat, y=14)
    key_color(o, (0.8, 0.85, 1.0), [(1, 0), (f - 1, 0), (f, 1), (f + 1, 0.3), (f + 2, 0), (N, 0)])
    for b in range(2):
        j = random.randint(6, 20)
        bp = fractal(pts[j], (pts[j][0] + random.uniform(-1.5, 1.5), pts[j][1] - random.uniform(1.2, 2.4)), 0.2, 3)
        ob = curve_obj(f'farbr{i}{b}', bp, 0.012, far_mat, y=14)
        key_color(ob, (0.7, 0.8, 1.0), [(1, 0), (f - 1, 0), (f, 0.8), (f + 1, 0), (N, 0)])

# ---------- Lluvia ----------
rain = Particles('rain', 'streak', size=0.1, strength=1.4, aspect=(7.0, 0.1))
key_strength(rain.mat.node_tree.nodes['Emission'], flash_keys(1.4, 6.0))
splash = Particles('splash', 'sphere', size=0.035, strength=2)
for k in range(420):
    f0 = random.randint(-22, N)
    x0, z0 = random.uniform(-6, 7), 11.5
    vx, vz = -3.2, -27.0
    zend = random.uniform(-10.5, GZ - 0.2) if random.random() < 0.75 else -11
    life = (z0 - zend) / -vz
    f1 = f0 + life * 24
    rain.add([(f0, x0, z0, 1.0, 0.17), (round(f1), x0 + vx * life, zend, 1.0, 0.17)], (0.62, 0.7, 0.95))
    if zend > -10.5 and 1 <= f1 <= N:
        f1 = round(f1)
        sx = x0 + vx * life
        splash.add([(f1, sx, zend, 1.0, 0.45), (f1 + 1, sx, zend + 0.06, 1.6, 0.2), (f1 + 2, sx, zend + 0.08, 2.0, 0.0)], (0.7, 0.78, 1.0))

# ---------- Antes del golpe: chispas en espiral y arcos que suben de intensidad ----------
spark = Particles('pre', 'streak', size=0.06, strength=9)
for k in range(40):
    a0 = random.random() * math.tau
    r0 = 3.0 + random.random() * 1.8
    f0 = 1 + int(random.random() * 10)
    fr = []
    for f in range(f0, STRIKE + 1):
        t = (f - f0) / max(1, STRIKE - f0)
        r = r0 * (1 - t) ** 1.4 + 0.3
        a = a0 + t * 6.0
        fr.append((f, r * math.cos(a), r * math.sin(a) * 1.15, 0.6 + t * 0.9, min(1, t * 3)))
    spark.add(fr, random.choice([(0.55, 0.8, 1.0), (0.75, 0.9, 1.0), (0.6, 0.6, 1.0)]))

arc_mat = obj_color_mat('arc', 16)


def arc(name, f, cx, cz, r0, r1, length, alpha=1.0, width=0.016):
    """Arco eléctrico corto que vive un cuadro."""
    a = random.random() * math.tau
    r = random.uniform(r0, r1)
    p0 = (cx + math.cos(a) * r, cz + math.sin(a) * r)
    b = a + random.uniform(-1.2, 1.2)
    p1 = (p0[0] + math.cos(b) * length, p0[1] + math.sin(b) * length)
    o = curve_obj(name, fractal(p0, p1, 0.3, 3), width, arc_mat, y=-2.2, taper=lambda u: 1.2 - 0.8 * abs(u - 0.5) * 2)
    key_color(o, (0.7, 0.88, 1.0), [(max(1, f - 1), 0), (f, alpha), (f + 1, 0)])


n_arc = 0
for f in range(11, STRIKE):
    for _ in range(1 + (f - 11) // 3):
        arc(f'prearc{n_arc}', f, 0, 0, 1.0, 1.7, random.uniform(0.4, 0.9), 0.6 + 0.4 * (f - 11) / 10)
        n_arc += 1

# ---------- El rayo ----------
core_mat = obj_color_mat('boltcore', 45)
halo_mat = obj_color_mat('bolthalo', 7)
TOP = (1.4, 11.6)
HEAD = (0.0, 0.95)
main = fractal(TOP, HEAD, 0.13, 5)
paths = [(main, 1.0)]
for b in range(5):
    i = random.randint(4, 22)
    sx, sz = main[i]
    side = random.choice((-1, 1))
    end = (sx + side * random.uniform(1.4, 3.2), sz - random.uniform(1.6, 3.4))
    bp = fractal((sx, sz), end, 0.24, 4)
    paths.append((bp, 0.55))
    for c in range(2):
        j = random.randint(3, 12)
        cx, cz = bp[j]
        paths.append((fractal((cx, cz), (cx + side * random.uniform(0.5, 1.2), cz - random.uniform(0.6, 1.3)), 0.28, 3), 0.3))
REST = [(1, 0), (STRIKE - 1, 0), (STRIKE, 1), (STRIKE + 1, 0.25), (STRIKE + 2, 0.95), (STRIKE + 3, 0.1), (STRIKE + 4, 0.75), (STRIKE + 5, 0.3), (STRIKE + 6, 0.08), (STRIKE + 7, 0), (N, 0)]
for k, (pts, w) in enumerate(paths):
    taper = (lambda u: 1.0 - 0.45 * u) if k == 0 else (lambda u: 1.0 - 0.85 * u)
    core = curve_obj(f'bolt{k}', pts, 0.055 * w, core_mat, y=-2.0, taper=taper)
    halo = curve_obj(f'halo{k}', pts, 0.24 * w, halo_mat, y=-1.9, taper=taper)
    # Las ramas chicas se apagan antes que el canal principal.
    fade = 1.0 if k == 0 else (0.8 if w > 0.4 else 0.6)
    key_color(core, (0.92, 0.96, 1.0), [(f, v * (fade if f > STRIKE else 1)) for f, v in REST])
    key_color(halo, (0.4, 0.55, 1.0), [(f, v * 0.38 * (fade if f > STRIKE else 1)) for f, v in REST])
    # Rayo guía: baja a tientas (más delgado) antes del golpe.
    if w > 0.4:
        lead = curve_obj(f'lead{k}', pts, 0.02 * w + 0.008, core_mat, y=-2.05, taper=taper)
        start = 0 if k == 0 else (main.index(pts[0]) / len(main))
        key_color(lead, (0.75, 0.85, 1.0), [(1, 0), (16, 0), (17, 0.7), (19, 0.5), (20, 0.8), (21, 0.9), (STRIKE, 0), (N, 0)])
        if k == 0:
            key_grow(lead, [(1, 0), (16, 0), (17, 0.2), (18, 0.38), (19, 0.55), (20, 0.72), (21, 0.86)])
        else:
            key_grow(lead, [(1, 0), (int(17 + start * 5), 0), (21, 0.7)])
# Chispa que sube desde el jugador a encontrarse con el rayo.
up = curve_obj('streamer', fractal(HEAD, (0.4, 2.6), 0.25, 3), 0.025, core_mat, y=-2.05)
key_color(up, (0.8, 0.9, 1.0), [(1, 0), (20, 0), (21, 1), (STRIKE, 0), (N, 0)])
# Punta brillante del rayo guía.
tm, tem, tam = glow_mat('tip', (0.7, 0.85, 1.0), 6, power=2, edge=1 / 0.6)
tip = disc('tip', 0.6, (0, -2.3, 0), tm)
for f, u in [(17, 0.2), (18, 0.38), (19, 0.55), (20, 0.72), (21, 0.86)]:
    x, z = main[min(len(main) - 1, int(u * (len(main) - 1)))]
    tip.location = (x, -2.3, z)
    tip.keyframe_insert('location', frame=f)
key_alpha(tam, [(1, 0), (16, 0), (17, 0.8), (21, 1), (STRIKE, 0), (N, 0)])

# ---------- Impacto ----------
im, iem, iam = glow_mat('impact', (0.75, 0.88, 1.0), 7, power=2.4, edge=1 / 3.4)
disc('impact', 3.4, (0, -1.5, 0.4), im)
key_alpha(iam, [(1, 0), (STRIKE - 1, 0), (STRIKE, 1.0), (STRIKE + 1, 0.5), (STRIKE + 2, 0.9), (STRIKE + 4, 0.6), (STRIKE + 14, 0), (N, 0)])
# Luz en el piso alrededor de los pies.
lm, lem, lam = glow_mat('groundlight', (0.6, 0.75, 1.0), 4, power=1.4, edge=1 / 3)
gl = disc('groundlight', 3, (0, 9.2, GZ - 0.2), lm)
gl.scale = (2.0, 0.4, 1)
key_alpha(lam, [(1, 0), (STRIKE - 1, 0), (STRIKE, 1.0), (STRIKE + 3, 0.5), (STRIKE + 10, 0), (N, 0)])

# Ondas: una en el aire y otra que corre por el piso.
rm, rem, rmix = flat_mat('shock', (0.5, 0.72, 1.0), 5)
sh = ring('shock', 1, 0.012, (0, -3, 0.3), rm)
rm2, rem2, rmix2 = flat_mat('shock2', (0.75, 0.85, 1.0), 3)
sh2 = ring('shock2', 1, 0.02, (0, -2.9, GZ), rm2)
for ob, mix, keys, flat in [
    (sh, rmix, [(1, 0.01, 0), (STRIKE - 1, 0.01, 0), (STRIKE, 0.2, 1), (STRIKE + 5, 3.4, 0.55), (STRIKE + 11, 6.5, 0), (N, 6.5, 0)], 1.0),
    (sh2, rmix2, [(1, 0.01, 0), (STRIKE, 0.01, 0), (STRIKE + 1, 0.4, 0.9), (STRIKE + 8, 4.5, 0.4), (STRIKE + 16, 7.5, 0), (N, 7.5, 0)], 0.22),
]:
    for f, s, a in keys:
        ob.scale = (s, s * flat, s)
        ob.keyframe_insert('scale', frame=f)
        mix.inputs['Fac'].default_value = a
        mix.inputs['Fac'].keyframe_insert('default_value', frame=f)

# Quemadura y grietas al rojo vivo que se van enfriando.
gm, gem, gam = glow_mat('scorch', (1.0, 0.42, 0.08), 4, power=1.5, edge=1 / 2.4)
g = disc('scorch', 2.4, (0, 2, GZ + 0.05), gm)
g.scale = (1, 0.28, 1)
key_alpha(gam, [(1, 0), (STRIKE - 1, 0), (STRIKE, 1.0), (STRIKE + 20, 0.5), (N, 0.22)])
crack_mat = obj_color_mat('crack', 9)
for k in range(13):
    th = (k + random.uniform(0.1, 0.9)) / 13 * (math.pi + 0.5) - 0.25
    r1 = random.uniform(2.0, 5.0)
    to = lambda r: (math.cos(th) * r, GZ - 0.05 - 0.3 * r * math.sin(th))
    pts = fractal(to(0.35), to(r1), 0.16, 4)
    o = curve_obj(f'crack{k}', pts, 0.03, crack_mat, y=1.5, taper=lambda u: 1 - 0.85 * u)
    key_grow(o, [(1, 0), (STRIKE, 0), (STRIKE + 1, 0.35), (STRIKE + 3, 0.8), (STRIKE + 5, 1)])
    key_color(o, None, [(1, 0, (1, 1, 1)), (STRIKE, 1, (1, 0.95, 0.8)), (STRIKE + 6, 1, (1, 0.6, 0.15)), (STRIKE + 24, 0.9, (0.9, 0.22, 0.04)), (N, 0.65, (0.5, 0.06, 0.02))])
    for c in range(2):
        j = random.randint(3, len(pts) - 4)
        cx, cz = pts[j]
        sub = fractal((cx, cz), (cx + random.uniform(-0.9, 0.9), cz - random.uniform(0.1, 0.5)), 0.2, 3)
        so = curve_obj(f'crack{k}_{c}', sub, 0.018, crack_mat, y=1.5, taper=lambda u: 1 - 0.8 * u)
        key_grow(so, [(1, 0), (STRIKE + 2, 0), (STRIKE + 5, 1)])
        key_color(so, None, [(1, 0, (1, 1, 1)), (STRIKE + 2, 1, (1, 0.9, 0.6)), (STRIKE + 8, 1, (1, 0.5, 0.12)), (STRIKE + 24, 0.8, (0.8, 0.18, 0.03)), (N, 0.5, (0.45, 0.05, 0.02))])

# Chispas del impacto (algunas rebotan en el piso).
burst = Particles('spark', 'streak', size=0.12, strength=10)
for k in range(130):
    a = random.uniform(0.05, math.pi - 0.05) if k % 3 else random.uniform(0, math.tau)
    v = random.uniform(5, 16)
    path = ballistic(STRIKE, 0, 0.2, math.cos(a) * v, math.sin(a) * v, random.uniform(0.45, 1.2), gravity=-18, drag=1.2, size=(1.2, 0.2), end=N)
    floor = GZ - random.uniform(0, 2.5)
    out, vz_sign = [], 1
    for i, (f, x, z, s, al, r) in enumerate(path):
        if z < floor:
            z = floor + (floor - z) * 0.3
        out.append((f, x, z, s, al, r))
    burst.add(out, random.choice([(1.0, 0.95, 0.75), (1.0, 0.75, 0.3), (0.7, 0.85, 1.0), (1.0, 0.85, 0.5)]))

# Piedras que salen volando.
rock = Particles('rock', 'sphere', size=0.13, strength=1.2)
for k in range(26):
    a = random.uniform(0.35, math.pi - 0.35)
    v = random.uniform(5, 10)
    path = ballistic(STRIKE, random.uniform(-0.5, 0.5), GZ + 0.1, math.cos(a) * v, math.sin(a) * v, random.uniform(0.8, 1.3), gravity=-22, drag=0.4, size=(random.uniform(0.6, 1.3),) * 2, alpha=(1, 1), spin=random.uniform(-12, 12), end=N)
    floor = GZ - random.uniform(0.2, 3)
    path = [(f, x, max(z, floor), s, al if z > floor - 0.01 or i < 3 else al, r) for i, (f, x, z, s, al, r) in enumerate(path)]
    rock.add(path, random.choice([(0.32, 0.17, 0.09), (0.25, 0.2, 0.2), (0.45, 0.22, 0.08)]))

# Brasas que suben.
ember = Particles('ember', 'sphere', size=0.05, strength=7)
for k in range(55):
    f0 = STRIKE + random.randint(2, 26)
    x0 = random.uniform(-1.3, 1.3)
    fr = []
    life = random.randint(16, 32)
    for i in range(life):
        f = f0 + i
        if f > N:
            break
        t = i / life
        fr.append((f, x0 + math.sin(i * 0.4 + k) * 0.3 - i * 0.03, GZ + 0.3 + t * random.uniform(3, 6) + i * 0.02, 1 - t * 0.6, (1 - t) * 0.9))
    if len(fr) > 2:
        ember.add(fr, (1.0, 0.45 + random.random() * 0.35, 0.1))

# Arcos que quedan chisporroteando sobre el jugador y el piso.
for f in range(STRIKE + 1, 47):
    for _ in range(max(1, (47 - f) // 6) if random.random() < 0.85 else 0):
        if random.random() < 0.6:
            arc(f'postarc{n_arc}', f, 0, 0.1, 0.4, 1.3, random.uniform(0.3, 0.8), random.uniform(0.6, 1.0))
        else:
            arc(f'postarc{n_arc}', f, random.uniform(-1.5, 1.5), GZ - random.uniform(0, 0.8), 0, 0.3, random.uniform(0.3, 0.7), random.uniform(0.5, 0.9), 0.012)
        n_arc += 1

# Humo que sube, iluminado desde abajo, y se lo lleva el viento.
for k in range(9):
    lower = k < 4
    m, mp, em, dens = noise_cloud_mat(f'smoke{k}', (0.42, 0.28, 0.24) if lower else (0.3, 0.29, 0.34), density=1.3, scale=2.4, strength=0.55)
    o = disc(f'smoke{k}', 1, (0, 1, 0), m)
    f0 = STRIKE + 2 + k * 2
    x0 = random.uniform(-0.8, 0.8)
    for f, z, s, d in [(1, 0, 0.01, 0), (f0 - 1, 0, 0.01, 0), (f0, 0.1, 0.7, 1.5), (N, 3.6 + k * 0.35, 2.4 + random.random(), 0.0)]:
        o.location = (x0 - z * 0.35, 1 + k * 0.01, z)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    key_strength(em, [(1, 1.2 if lower else 0.6), (STRIKE + 12, 0.9 if lower else 0.5), (N, 0.45)])
    for f, x in [(f0, k), (N, k + 1.5)]:
        mp.inputs['Location'].default_value = (x, 0, x * 0.5)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)

# ---------- Se desmorona en cenizas (al compás del avatar, 1.65–2.05 s) ----------
ash = Particles('ash', 'quad', size=0.06, strength=1.0)
glowash = Particles('glowash', 'sphere', size=0.04, strength=8)
for k in range(150):
    f0 = random.randint(38, 50)
    # La figura se va aplastando hacia el piso: las cenizas salen de lo que queda.
    top = 1.2 - (f0 - 38) / 12 * 1.9
    x0 = random.uniform(-1.0, 1.0) * (0.6 + 0.4 * random.random())
    z0 = random.uniform(GZ + 0.15, max(GZ + 0.3, top))
    path = ballistic(f0, x0, z0, random.uniform(-1.6, 0.6), random.uniform(-0.5, 1.2), random.uniform(0.5, 0.9), gravity=-5, drag=1.5, size=(1.0, 0.5), alpha=(0.95, 0.0), spin=random.uniform(-10, 10), end=N)
    path = [(f, x, max(z, GZ - 0.25), s, a, r) for f, x, z, s, a, r in path]
    if k % 4 == 0:
        glowash.add(path, (1.0, 0.5, 0.12))
    else:
        ash.add(path, random.choice([(0.2, 0.19, 0.19), (0.28, 0.26, 0.25), (0.14, 0.13, 0.14)]))
# Montoncito de ceniza con brasas que palpitan.
pm2, pem2, pmix2 = flat_mat('pile', (0.09, 0.085, 0.09), 1)
pile = disc('pile', 1, (0, -1.2, GZ - 0.05), pm2)
for f, s in [(1, 0), (40, 0), (48, 0.75), (N, 0.85)]:
    pile.scale = (s, s * 0.3, 1)
    pile.keyframe_insert('scale', frame=f)
dots = Particles('piledot', 'sphere', size=0.045, strength=9)
for k in range(12):
    x = random.uniform(-0.6, 0.6)
    z = GZ - 0.05 + random.uniform(-0.12, 0.12)
    ph = random.random() * math.tau
    dots.add([(f, x, z, 1, 0.45 + 0.45 * math.sin(f * 0.7 + ph)) for f in range(46 + k % 4, N + 1, 2)], (1.0, 0.45, 0.1))
wisp = Particles('wisp', 'sphere', size=0.16, strength=0.6)
for k in range(14):
    f0 = random.randint(44, 56)
    x0 = random.uniform(-0.5, 0.5)
    wisp.add([(f0 + i, x0 + math.sin(i * 0.5 + k) * 0.2 - i * 0.03, GZ + i * 0.13, 0.6 + i * 0.12, 0.35 * (1 - i / 12)) for i in range(12) if f0 + i <= N], (0.45, 0.43, 0.48))

render(sys.argv[sys.argv.index('--out') + 1])
