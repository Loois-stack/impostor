"""Eliminación 4: COHETE. Atardecer; la mecha chispea, en el cuadro 14 sale disparado hacia arriba con
fuego y estela de humo (sale de cuadro hacia el 36) y en el cielo revientan tres fuegos artificiales."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (FPS, Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, key_alpha, noise_cloud_mat, plane, reset, render, hsv)

N = 72
LAUNCH = 14
sc = reset(N, seed=31)

gradient_bg('bg', [(0.0, (0.5, 0.16, 0.05)), (0.22, (0.28, 0.06, 0.18)), (0.5, (0.06, 0.03, 0.16)), (1.0, (0.008, 0.01, 0.05))])
# Cerros oscuros abajo.
hm, hem, hmix = flat_mat('hills', (0.012, 0.006, 0.02), 1)
for i, (x, w, h) in enumerate([(-3.5, 6, 2.6), (2.8, 7, 3.2), (0, 12, 1.6)]):
    d = disc(f'hill{i}', 1, (x, 3 - i * 0.1, -10), hm)
    d.scale = (w / 2, h, 1)

stars = Particles('star', 'sphere', size=0.03, strength=5)
for k in range(70):
    x, z = random.uniform(-5.2, 5.2), random.uniform(0, 10.2)
    ph = random.random() * math.tau
    stars.add([(f, x, z, 1, 0.4 + 0.4 * math.sin(f * 0.3 + ph)) for f in range(1, N + 1, 4)], (1, 1, 1))


def rocket_z(f):
    t = max(0, f - LAUNCH) / FPS
    return 14 * t * t


# Mecha: chispas antes del despegue.
fuse = Particles('fuse', 'streak', size=0.07, strength=10)
for k in range(60):
    f0 = random.randint(1, LAUNCH)
    a = random.uniform(0.3, math.pi - 0.3)
    v = random.uniform(2, 5)
    fuse.add(ballistic(f0, random.uniform(-0.1, 0.1), -1.1, math.cos(a) * v, math.sin(a) * v, random.uniform(0.2, 0.45), gravity=-14, drag=1, size=(1.2, 0.2), end=LAUNCH + 3), (1, 0.8, 0.35))

# Fuego que sigue al cohete.
fm, fem, fam = glow_mat('flame', (1.0, 0.6, 0.15), 9, power=1.8)
flame = disc('flame', 1, (0, -2, -1.2), fm)
for f in range(1, N + 1):
    z = rocket_z(f)
    on = f >= LAUNCH and z < 13
    flame.location = (math.sin(f) * 0.03, -2, z - 1.3)
    flame.keyframe_insert('location', frame=f)
    s = (0.45 + 0.15 * math.sin(f * 2.3)) if on else (0.25 if f < LAUNCH else 0)
    flame.scale = (s * 0.8, s, s * 2.2)
    flame.keyframe_insert('scale', frame=f)
key_alpha(fam, [(1, 0.3), (LAUNCH - 1, 0.4), (LAUNCH, 1.0), (40, 1.0), (42, 0), (N, 0)])

# Estela de humo: bocanadas que se quedan donde pasó el cohete, crecen y se desvanecen.
for k in range(16):
    f0 = LAUNCH + k
    z = rocket_z(f0) - 1.5
    if z > 11:
        break
    m, mp, em, dens = noise_cloud_mat(f'smoke{k}', (0.62, 0.55, 0.6), density=1.1, scale=2.2, strength=0.45)
    o = disc(f'smoke{k}', 1, (0, 1 + k * 0.01, z), m)
    x0 = random.uniform(-0.2, 0.2)
    for f, s, d, dx in [(1, 0.01, 0, 0), (f0 - 1, 0.01, 0, 0), (f0, 0.5, 1.5, 0), (min(N, f0 + 30), 1.8 + random.random(), 0.0, random.uniform(-0.8, 0.8))]:
        o.location = (x0 + dx, 1 + k * 0.01, z)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    mp.inputs['Location'].default_value = (k, 0, 0)
# Humo en la base al despegar.
for k in range(5):
    m, mp, em, dens = noise_cloud_mat(f'base{k}', (0.5, 0.45, 0.5), density=1.3, scale=2.5, strength=0.4)
    o = disc(f'base{k}', 1, (0, 1.5, -1.5), m)
    side = (k - 2) * 0.9
    for f, s, d, x in [(1, 0.01, 0, 0), (LAUNCH - 1, 0.01, 0, 0), (LAUNCH, 0.6, 1.6, side * 0.3), (N, 2.0, 0.0, side * 1.6)]:
        o.location = (x, 1.5 + k * 0.01, -1.5 + abs(side) * 0.1)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s * 0.7, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)

# Chispas de la estela.
trail = Particles('trail', 'streak', size=0.07, strength=10)
for f0 in range(LAUNCH, 36):
    z = rocket_z(f0) - 1.4
    for k in range(3):
        trail.add(ballistic(f0, random.uniform(-0.15, 0.15), z, random.uniform(-2, 2), random.uniform(-6, -2), random.uniform(0.25, 0.5), gravity=-10, drag=1.5, size=(1.1, 0.2), end=N), (1, 0.75, 0.3))


def firework(f0, x, z, hue, count, power=9.0, name='fw'):
    gm, gem, gam = glow_mat(f'{name}_flash', hsv(hue, 0.4, 1), 4, power=3, edge=1 / 2.2)
    disc(f'{name}_flash', 2.2, (x, -2.4, z), gm)
    key_alpha(gam, [(1, 0), (f0 - 1, 0), (f0, 0.8), (f0 + 5, 0), (N, 0)])
    sp = Particles(name, 'streak', size=0.09, strength=11)
    for k in range(count):
        a = k / count * math.tau + random.uniform(-0.05, 0.05)
        v = power * random.uniform(0.85, 1.05)
        path = ballistic(f0, x, z, math.cos(a) * v, math.sin(a) * v, random.uniform(0.9, 1.25), gravity=-4, drag=2.2, size=(1.3, 0.35), end=N)
        # Titileo al final.
        path = [(f, px, pz, s, a_ * (0.5 + 0.5 * math.sin(f * 2.1 + k)) if i > len(path) * 0.6 else a_, r) for i, (f, px, pz, s, a_, r) in enumerate(path)]
        sp.add(path, hsv(hue + random.uniform(-0.04, 0.04), 0.75, 1))
    inner = Particles(name + 'in', 'sphere', size=0.06, strength=12)
    for k in range(count // 3):
        a = random.random() * math.tau
        v = power * random.uniform(0.2, 0.5)
        inner.add(ballistic(f0, x, z, math.cos(a) * v, math.sin(a) * v, random.uniform(0.5, 0.8), gravity=-3, drag=2, size=(1, 0.3), end=N), (1, 1, 0.9))


firework(40, 0.0, 5.6, 0.95, 120, 9.5, 'fwA')
firework(48, -2.3, 3.6, 0.55, 80, 7.0, 'fwB')
firework(54, 2.4, 7.0, 0.13, 90, 7.5, 'fwC')

render(sys.argv[sys.argv.index('--out') + 1])
