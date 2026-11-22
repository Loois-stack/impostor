"""Eliminación 4: COHETE (Al espacio). Atardecer sobre una ciudad con ventanas encendidas; el jugador
está en una plataforma con luces de aviso. La mecha chispea y en el cuadro 14 despega con una llama en
capas (núcleo blanco y diamantes de choque), una nube de humo que se abre por el piso y estela con
chispas (sale de cuadro hacia el 36). Luego suben y revientan los fuegos artificiales: peonía con
brillitos (40), sauce dorado (47), corazón (53) y anillo (58)."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (FPS, Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, hsv, key_alpha, key_color, key_strength, noise_cloud_mat, obj_color_mat, poly_mesh, reset, render)

N = 72
LAUNCH = 14
FEET = -1.35
sc = reset(N, seed=31)

_, sky = gradient_bg('bg', [(0.0, (0.42, 0.12, 0.04)), (0.2, (0.24, 0.05, 0.14)), (0.48, (0.05, 0.025, 0.13)), (1.0, (0.006, 0.008, 0.04))])
key_strength(sky, [(1, 1.0), (LAUNCH - 1, 1.0), (LAUNCH + 1, 1.35), (LAUNCH + 12, 1.05), (N, 1.0)])
stars = Particles('star', 'sphere', size=0.03, strength=5)
for k in range(80):
    x, z = random.uniform(-5.2, 5.2), random.uniform(0, 10.2)
    ph = random.random() * math.tau
    stars.add([(f, x, z, 1, 0.4 + 0.4 * math.sin(f * 0.3 + ph)) for f in range(1, N + 1, 4)], (1, 1, 1))
# Luna.
mm, mem, mam = glow_mat('moon', (1.0, 0.95, 0.85), 2.2, power=0.4, edge=1 / 0.55)
disc('moon', 0.55, (3.4, 17, 8.2), mm)
key_alpha(mam, [(1, 1)])
hm_, hem_, ham_ = glow_mat('moonhalo', (0.8, 0.8, 1.0), 0.8, power=2, edge=1 / 1.8)
disc('moonhalo', 1.8, (3.4, 17.5, 8.2), hm_)
key_alpha(ham_, [(1, 0.35)])

# ---------- Cerros, ciudad y plataforma ----------
hm, hem, hmix = flat_mat('hills', (0.03, 0.012, 0.035), 1)
for i, (x, w, h) in enumerate([(-3.5, 6, 3.0), (2.8, 7, 3.6)]):
    d = disc(f'hill{i}', 1, (x, 12 - i * 0.1, -9.6), hm)
    d.scale = (w / 2, h, 1)
city, cem, cmix = flat_mat('city', (0.012, 0.006, 0.02), 1)
pts = [(-5.6, -10.5)]
x = -5.6
win = Particles('window', 'quad', size=0.055, strength=3.5)
while x < 5.6:
    w = random.uniform(0.5, 1.2)
    h = random.uniform(-7.4, -4.6) if abs(x + w / 2) > 1.4 else random.uniform(-8.6, -7.6)
    pts += [(x, h), (x + w, h)]
    for wx in [x + 0.15 + j * 0.24 for j in range(int((w - 0.2) / 0.24))]:
        for wz in [h - 0.3 - j * 0.32 for j in range(int((h + 10.2) / 0.32))]:
            if random.random() < 0.38:
                on = random.random() < 0.85
                col = random.choice([(1, 0.8, 0.4), (1, 0.7, 0.3), (0.7, 0.85, 1)])
                flick = random.random() < 0.08
                win.add([(f, wx, wz, 1, (0.9 if on else 0) if not flick else (0.9 if (f // 8) % 2 else 0.1)) for f in range(1, N + 1, 8)], col)
    x += w + random.uniform(0.02, 0.15)
pts.append((5.6, -10.5))
poly_mesh('city', pts, 8, city)
# Plataforma de lanzamiento con torre y luces de aviso.
pad, pem, pmix = flat_mat('pad', (0.03, 0.02, 0.035), 1)
poly_mesh('pad', [(-1.8, FEET - 0.05), (1.8, FEET - 0.05), (1.6, FEET - 0.4), (-1.6, FEET - 0.4)], 3, pad)
leg, lem_, lmix_ = flat_mat('leg', (0.012, 0.008, 0.018), 1)
for lx in (-1.3, 1.0):
    poly_mesh(f'leg{lx}', [(lx, FEET - 0.4), (lx + 0.3, FEET - 0.4), (lx + 0.45, -10.5), (lx - 0.15, -10.5)], 3.2, leg)
tower, tem, tmix = flat_mat('tower', (0.04, 0.03, 0.05), 1)
poly_mesh('tower', [(-2.35, FEET), (-1.95, FEET), (-1.95, 2.4), (-2.35, 2.4)], 3.1, tower)
for j in range(7):
    z0 = FEET + j * 0.55
    poly_mesh(f'brace{j}', [(-2.35, z0), (-2.3, z0), (-1.95, z0 + 0.5), (-2.0, z0 + 0.5)], 3.05, tower)
warn = Particles('warn', 'sphere', size=0.07, strength=10)
for k, (wx, wz) in enumerate([(-1.55, FEET - 0.15), (1.55, FEET - 0.15), (-2.15, 2.5)]):
    warn.add([(f, wx, wz, 1.4 if (f // 4 + k) % 2 else 0.8, 1.0 if (f // 4 + k) % 2 else 0.25) for f in range(1, N + 1)], (1, 0.25, 0.1))


def rocket_z(f):
    t = max(0, f - LAUNCH) / FPS
    return 14 * t * t


# Mecha: chispas antes del despegue.
fuse = Particles('fuse', 'streak', size=0.07, strength=10)
for k in range(70):
    f0 = random.randint(1, LAUNCH)
    a = random.uniform(0.3, math.pi - 0.3)
    v = random.uniform(2, 5.5)
    fuse.add(ballistic(f0, random.uniform(-0.12, 0.12), FEET + 0.2, math.cos(a) * v, math.sin(a) * v, random.uniform(0.2, 0.45), gravity=-14, drag=1, size=(1.2, 0.2), end=LAUNCH + 3), (1, 0.8, 0.35))

# ---------- Llama en capas que sigue al cohete ----------
layers = []
for name, col, strength, w, h in [('flame_out', (1.0, 0.42, 0.08), 6, 0.6, 1.15), ('flame_mid', (1.0, 0.75, 0.25), 9, 0.38, 0.8), ('flame_core', (1.0, 0.97, 0.9), 14, 0.19, 0.46)]:
    fm, fem, fam = glow_mat(name, col, strength, power=1.6)
    o = disc(name, 1, (0, -2.0 - len(layers) * 0.02, 0), fm)
    layers.append((o, fam, w, h))
diamond, dem, dam = glow_mat('diamond', (1.0, 0.95, 0.85), 12, power=2)
dia = [disc(f'dia{i}', 1, (0, -2.1 - i * 0.01, 0), diamond) for i in range(3)]
for f in range(1, N + 1):
    z = rocket_z(f)
    on = f >= LAUNCH and z < 13
    fl = 1 + 0.18 * math.sin(f * 2.3) + 0.1 * math.sin(f * 5.1)
    for o, fam, w, h in layers:
        hh = h * fl * (1.25 if on else 0.3) * (1 + min(1, (f - LAUNCH) / 6) * 0.4 if on else 1)
        o.location = (math.sin(f) * 0.03, o.location.y, z + FEET + 0.1 - hh)
        o.keyframe_insert('location', frame=f)
        o.scale = (w * (1 if on else 0.6), hh, 1)
        o.keyframe_insert('scale', frame=f)
    for i, o in enumerate(dia):
        o.location = (0, o.location.y, z + FEET - 0.45 - i * 0.48)
        o.keyframe_insert('location', frame=f)
        s = (0.15 - i * 0.03) if on else 0
        o.scale = (s, s * 0.55, 1)
        o.keyframe_insert('scale', frame=f)
for o, fam, w, h in layers:
    key_alpha(fam, [(1, 0.35), (LAUNCH - 1, 0.45), (LAUNCH, 1.0), (40, 1.0), (42, 0), (N, 0)])
key_alpha(dam, [(1, 0), (LAUNCH, 0), (LAUNCH + 1, 1), (40, 1), (41, 0), (N, 0)])
# Luz del despegue sobre la plataforma y la ciudad.
gm, gem, gam = glow_mat('launchlight', (1.0, 0.6, 0.25), 4, power=1.4, edge=1 / 4)
g = disc('launchlight', 4, (0, 2.5, FEET - 0.6), gm)
g.scale = (1.5, 1.0, 1)
key_alpha(gam, [(1, 0.08), (LAUNCH - 1, 0.12), (LAUNCH, 0.55), (LAUNCH + 4, 0.4), (LAUNCH + 24, 0.06), (N, 0.04)])

# ---------- Humo ----------
for k in range(18):
    f0 = LAUNCH + k
    z = rocket_z(f0) + FEET - 0.6
    if z > 11:
        break
    m, mp, em, dens = noise_cloud_mat(f'smoke{k}', (0.66, 0.58, 0.62), density=1.15, scale=2.2, strength=0.45)
    o = disc(f'smoke{k}', 1, (0, 1 + k * 0.01, z), m)
    x0 = random.uniform(-0.2, 0.2)
    for f, s, d, dx in [(1, 0.01, 0, 0), (f0 - 1, 0.01, 0, 0), (f0, 0.55, 1.5, 0), (min(N, f0 + 30), 1.9 + random.random(), 0.0, random.uniform(-0.9, 0.9))]:
        o.location = (x0 + dx, o.location.y, z)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    mp.inputs['Location'].default_value = (k, 0, 0)
# Nube del despegue: se abre por el piso a los lados, iluminada de naranja abajo.
for k in range(10):
    m, mp, em, dens = noise_cloud_mat(f'base{k}', (0.62, 0.48, 0.45) if k % 2 else (0.5, 0.45, 0.52), density=1.4, scale=2.4, strength=0.5)
    o = disc(f'base{k}', 1, (0, 1.5 + k * 0.01, FEET - 0.4), m)
    side = (k - 4.5) / 4.5
    for f, s, d, x, z in [(1, 0.01, 0, 0, FEET), (LAUNCH - 1, 0.01, 0, 0, FEET), (LAUNCH, 0.6, 1.6, side * 0.3, FEET - 0.3), (LAUNCH + 14, 1.5, 1.3, side * 2.6, FEET - 0.2 + abs(side) * 0.2), (N, 2.3, 0.0, side * 4.0, FEET + 0.4 + abs(side) * 0.3)]:
        o.location = (x, o.location.y, z)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s * 0.7, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    key_strength(em, [(1, 0.5), (LAUNCH, 1.4), (LAUNCH + 20, 0.6), (N, 0.45)])
# Chispas de la estela.
trail = Particles('trail', 'streak', size=0.07, strength=10)
for f0 in range(LAUNCH, 36):
    z = rocket_z(f0) + FEET - 0.5
    for k in range(4):
        trail.add(ballistic(f0, random.uniform(-0.15, 0.15), z, random.uniform(-2.2, 2.2), random.uniform(-7, -2), random.uniform(0.25, 0.55), gravity=-10, drag=1.5, size=(1.1, 0.2), end=N), random.choice([(1, 0.75, 0.3), (1, 0.9, 0.6)]))


# ---------- Fuegos artificiales ----------
def shell(f0, x, z, col, name):
    """El cohetito que sube antes de reventar (con su estela)."""
    sp = Particles(name + 'up', 'streak', size=0.06, strength=10)
    x0 = x + random.uniform(-0.6, 0.6)
    z0 = -8.0
    n = 9
    fr = [(f0 - n + i, x0 + (x - x0) * (i / n), z0 + (z - z0) * (1 - (1 - i / n) ** 2), 1.0, 0.95) for i in range(n + 1)]
    sp.add(fr, col)
    for i, (f, px, pz, _, _) in enumerate(fr[:-1]):
        sp.add([(f, px, pz, 0.8, 0.6), (f + 3, px + random.uniform(-0.1, 0.1), pz - 0.5, 0.3, 0.0)], (1, 0.8, 0.5))


def flash(f0, x, z, col, rad, name):
    gm, gem, gam = glow_mat(f'{name}_flash', col, 4, power=3, edge=1 / rad)
    disc(f'{name}_flash', rad, (x, -2.4, z), gm)
    key_alpha(gam, [(1, 0), (f0 - 1, 0), (f0, 0.8), (f0 + 5, 0), (N, 0)])
    # El cielo se ilumina del color del fuego.
    sm, sem, sam = glow_mat(f'{name}_sky', col, 1.0, power=1.2, edge=1 / 6)
    disc(f'{name}_sky', 6, (x, 15, z), sm)
    key_alpha(sam, [(1, 0), (f0 - 1, 0), (f0, 0.4), (f0 + 10, 0), (N, 0)])


def peony(f0, x, z, hue, count, power, name):
    shell(f0, x, z, hsv(hue, 0.3, 1), name)
    flash(f0, x, z, hsv(hue, 0.4, 1), 2.0, name)
    sp = Particles(name, 'streak', size=0.09, strength=11, aspect=(4.0, 0.4))
    glit = Particles(name + 'gl', 'sphere', size=0.05, strength=14)
    for k in range(count):
        a = k / count * math.tau + random.uniform(-0.05, 0.05)
        v = power * random.uniform(0.85, 1.05)
        path = ballistic(f0, x, z, math.cos(a) * v, math.sin(a) * v, random.uniform(0.9, 1.25), gravity=-4, drag=2.2, size=(1.3, 0.35), end=N)
        sp.add(path, hsv(hue + random.uniform(-0.04, 0.04), 0.75, 1))
        # Brillitos que crepitan al final del recorrido.
        if k % 2 == 0:
            for (f, px, pz, *_r) in path[len(path) // 2::3]:
                if random.random() < 0.5:
                    glit.add([(f, px, pz, 1.2, 1.0), (f + 1, px, pz - 0.05, 0.6, 0.0)], (1, 1, 0.9))


def willow(f0, x, z, count, name):
    shell(f0, x, z, (1, 0.85, 0.5), name)
    flash(f0, x, z, (1.0, 0.8, 0.4), 2.2, name)
    sp = Particles(name, 'streak', size=0.07, strength=9, aspect=(5.0, 0.35))
    for k in range(count):
        a = k / count * math.tau + random.uniform(-0.05, 0.05)
        v = random.uniform(5.5, 7.5)
        path = ballistic(f0, x, z, math.cos(a) * v, math.sin(a) * v + 1, (N - f0) / 24 + 0.2, gravity=-5.5, drag=1.6, size=(1.2, 0.7), alpha=(1.0, 0.15), end=N)
        sp.add(path, random.choice([(1, 0.78, 0.35), (1, 0.85, 0.5), (1, 0.7, 0.25)]))
        # Estela dorada que cuelga (el "sauce").
        for (f, px, pz, *_r) in path[2::2]:
            sp.add([(f, px, pz, 0.7, 0.55), (f + 6, px, pz - 0.35, 0.4, 0.0)], (1, 0.7, 0.3))


def heart(f0, x, z, name):
    shell(f0, x, z, (1, 0.6, 0.8), name)
    flash(f0, x, z, (1, 0.5, 0.75), 2.0, name)
    sp = Particles(name, 'sphere', size=0.08, strength=12)
    for k in range(70):
        t = k / 70 * math.tau
        hx = 16 * math.sin(t) ** 3 / 16
        hz = (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) / 16
        fr = []
        for i in range(30):
            f = f0 + i
            if f > N:
                break
            u = 1 - math.exp(-i * 0.28)
            fr.append((f, x + hx * 2.0 * u, z + hz * 2.0 * u - 0.012 * i * i, 1.0 - 0.4 * i / 30, 1.0 if i < 18 else (1 - (i - 18) / 12) * (0.6 + 0.4 * math.sin(i * 2 + k))))
        sp.add(fr, (1, 0.35, 0.6) if k % 3 else (1, 0.8, 0.9))


def ring_fw(f0, x, z, hue, name):
    shell(f0, x, z, hsv(hue, 0.3, 1), name)
    flash(f0, x, z, hsv(hue, 0.4, 1), 1.6, name)
    sp = Particles(name, 'streak', size=0.08, strength=11, aspect=(3.5, 0.4))
    tilt = 0.45
    for k in range(48):
        a = k / 48 * math.tau
        v = 6.5
        path = ballistic(f0, x, z, math.cos(a) * v, math.sin(a) * v * tilt, random.uniform(0.7, 0.85), gravity=-3, drag=2.5, size=(1.3, 0.3), end=N)
        sp.add(path, hsv(hue + (0.5 if k % 6 == 0 else 0), 0.7, 1))


peony(40, 0.0, 5.6, 0.95, 120, 9.5, 'fwA')
willow(47, -2.2, 3.4, 60, 'fwB')
heart(53, 2.2, 6.6, 'fwC')
ring_fw(58, -1.6, 7.6, 0.5, 'fwD')

render(sys.argv[sys.argv.index('--out') + 1])
