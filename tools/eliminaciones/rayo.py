"""Eliminación 1: RAYO. Se juntan nubes de tormenta, chispas giran hacia el jugador y cae un rayo
(cuadro 22 ≈ 0.9 s) con destello, onda expansiva, chispas, humo y brasas que suben."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (FPS, Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, key_alpha, key_fac, key_strength, link, noise_cloud_mat, plane, reset, render, ring)

N = 60
STRIKE = 22
sc = reset(N, seed=11)

gradient_bg('bg', [(0.0, (0.004, 0.004, 0.012)), (0.55, (0.02, 0.015, 0.06)), (1.0, (0.06, 0.03, 0.12))])

# Nubes: tres capas de ruido arriba que se mueven y se iluminan con los relámpagos.
for i, (z, s, col) in enumerate([(8.6, 3.2, (0.16, 0.13, 0.28)), (7.4, 2.4, (0.1, 0.08, 0.2)), (9.4, 4.0, (0.22, 0.18, 0.36))]):
    m, mp, em, dens = noise_cloud_mat(f'cloud{i}', col, density=2.2, scale=1.4 + i * 0.3, strength=0.6, edge=2.0)
    o = plane(f'cloud{i}', 18, 9, (0, 5 - i, z), m)
    for f, x in [(1, -0.4 + i * 0.3), (N, 0.5 - i * 0.2)]:
        mp.inputs['Location'].default_value = (x, 0, 0.2 * i)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    # Destellos previos y el gran relámpago.
    key_strength(em, [(1, 0.4), (8, 0.4), (9, 2.5), (10, 0.5), (14, 0.5), (15, 1.8), (16, 0.5), (STRIKE - 1, 0.6), (STRIKE, 7), (STRIKE + 2, 2), (STRIKE + 3, 5), (STRIKE + 6, 0.8), (N, 0.5)])

# Chispas eléctricas que giran hacia el jugador antes del golpe.
spark = Particles('pre', 'sphere', size=0.07, strength=8)
for k in range(26):
    a0 = random.random() * math.tau
    r0 = 3.2 + random.random() * 1.5
    f0 = 1 + int(random.random() * 8)
    fr = []
    for f in range(f0, STRIKE + 1):
        t = (f - f0) / max(1, STRIKE - f0)
        r = r0 * (1 - t) ** 1.4 + 0.25
        a = a0 + t * 5.5
        fr.append((f, r * math.cos(a), r * math.sin(a) * 1.15, 0.6 + t * 0.8, min(1, t * 3)))
    spark.add(fr, (0.55, 0.8, 1.0))

# El rayo: tubo dentado de arriba al jugador, con ramas.
def bolt(name, pts, width, strength):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = width
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, (x, z) in zip(sp.points, pts):
        p.co = (x, -2, z, 1)
    o = link(bpy.data.objects.new(name, cu))
    m, em, mix = flat_mat(name + '_m', (0.85, 0.92, 1.0), strength)
    o.data.materials.append(m)
    return o, em, mix

pts = [(0.0, 11.0)]
x = 0.6
for i in range(1, 15):
    z = 11 - i * (11 / 14)
    x = x * 0.55 + random.uniform(-1.0, 1.0) * (1 - i / 15)
    pts.append((x, z))
pts[-1] = (0, 0.2)
bolts = [bolt('bolt', pts, 0.05, 40)]
# Halo azul alrededor del rayo.
halo, hem, hmix = bolt('halo', pts, 0.22, 6)
halo.data.materials[0].node_tree.nodes['Emission'].inputs['Color'].default_value = (0.35, 0.5, 1.0, 1)
bolts.append((halo, hem, hmix))
for b in range(3):
    i = random.randint(3, 9)
    bx, bz = pts[i]
    bp = [(bx, bz)]
    for j in range(1, 5):
        bx += random.uniform(0.4, 1.0) * (1 if b % 2 else -1)
        bz -= random.uniform(0.6, 1.1)
        bp.append((bx, bz))
    bolts.append(bolt(f'branch{b}', bp, 0.04, 25))
flicker = [(1, 0), (STRIKE - 1, 0), (STRIKE, 1), (STRIKE + 1, 0.3), (STRIKE + 2, 1), (STRIKE + 3, 0), (STRIKE + 4, 0.9), (STRIKE + 5, 0.4), (STRIKE + 7, 0), (N, 0)]
for o, em, mix in bolts:
    key_fac(mix, [(f, v * (0.35 if o.name == 'halo' else 1)) for f, v in flicker])

# Destello de toda la pantalla.
# Va detrás del rayo y de las chispas (más lejos de la cámara), delante de nubes y fondo.
fm, fem, fmix = flat_mat('flash', (0.55, 0.65, 1.0), 1.0)
plane('flash', 14, 24, (0, 0.5, 0), fm)
key_fac(fmix, [(1, 0), (STRIKE - 1, 0), (STRIKE, 0.55), (STRIKE + 1, 0.15), (STRIKE + 2, 0.4), (STRIKE + 4, 0.05), (STRIKE + 6, 0), (N, 0)])
# Resplandor del impacto alrededor del jugador.
im, iem, iam = glow_mat('impact', (0.7, 0.85, 1.0), 6, power=2.5, edge=1 / 3.2)
disc('impact', 3.2, (0, -1.5, 0), im)
key_alpha(iam, [(1, 0), (STRIKE - 1, 0), (STRIKE, 1.0), (STRIKE + 3, 0.6), (STRIKE + 14, 0), (N, 0)])

# Onda expansiva.
rm, rem, rmix = flat_mat('shock', (0.45, 0.7, 1.0), 4)
sh = ring('shock', 1, 0.012, (0, -3, 0), rm)
for f, s, a in [(1, 0.01, 0), (STRIKE - 1, 0.01, 0), (STRIKE, 0.2, 1), (STRIKE + 6, 3.5, 0.5), (STRIKE + 12, 6.5, 0), (N, 6.5, 0)]:
    sh.scale = (s, s, s)
    sh.keyframe_insert('scale', frame=f)
    rmix.inputs['Fac'].default_value = a
    rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)

# Quemadura en el piso (resplandor naranja que se apaga).
gm, gem, gam = glow_mat('scorch', (1.0, 0.42, 0.08), 4, power=1.6, edge=1 / 2.2)
g = disc('scorch', 2.2, (0, 2, -0.9), gm)
g.scale = (1, 0.3, 1)
key_alpha(gam, [(1, 0), (STRIKE - 1, 0), (STRIKE, 1.0), (STRIKE + 20, 0.45), (N, 0.15)])

# Chispas del impacto.
burst = Particles('spark', 'streak', size=0.13, strength=10)
for k in range(110):
    a = random.uniform(0.05, math.pi - 0.05) if k % 3 else random.uniform(0, math.tau)
    v = random.uniform(5, 15)
    path = ballistic(STRIKE, 0, 0.1, math.cos(a) * v, math.sin(a) * v, random.uniform(0.4, 1.1), gravity=-18, drag=1.2, size=(1.2, 0.2), end=N)
    col = random.choice([(1.0, 0.95, 0.7), (1.0, 0.75, 0.3), (0.7, 0.85, 1.0)])
    burst.add(path, col)

# Brasas que suben.
ember = Particles('ember', 'sphere', size=0.05, strength=6)
for k in range(45):
    f0 = STRIKE + random.randint(2, 20)
    x0 = random.uniform(-1.2, 1.2)
    fr = []
    life = random.randint(18, 34)
    for i in range(life):
        f = f0 + i
        if f > N:
            break
        t = i / life
        fr.append((f, x0 + math.sin(i * 0.4 + k) * 0.3, -0.2 + t * random.uniform(3, 6) + i * 0.02, 1 - t * 0.6, (1 - t) * 0.9))
    if len(fr) > 2:
        ember.add(fr, (1.0, 0.5 + random.random() * 0.3, 0.1))

# Humo que sube y se abre.
for k in range(7):
    m, mp, em, dens = noise_cloud_mat(f'smoke{k}', (0.32, 0.3, 0.34), density=1.2, scale=2.5, strength=0.5)
    o = disc(f'smoke{k}', 1, (0, 1, 0), m)
    f0 = STRIKE + 2 + k * 2
    x0 = random.uniform(-0.8, 0.8)
    for f, z, s, d in [(1, 0, 0.01, 0), (f0 - 1, 0, 0.01, 0), (f0, 0.2, 0.6, 1.4), (N, 3.5 + k * 0.3, 2.4 + random.random(), 0.0)]:
        o.location = (x0 + (z * 0.15 if k % 2 else -z * 0.15), 1 + k * 0.01, z)
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    for f, x in [(f0, k), (N, k + 1.5)]:
        mp.inputs['Location'].default_value = (x, 0, x * 0.5)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)

render(sys.argv[sys.argv.index('--out') + 1])
