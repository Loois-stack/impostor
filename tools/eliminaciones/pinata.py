"""Eliminación 3: PIÑATA. Fondo de fiesta con papel picado; el jugador recibe dos golpes (cuadros 10
y 22, destellos en estrella) y al tercero (cuadro 34) revienta en confeti y dulces que caen."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (FPS, Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, key_alpha, key_fac, node_mat, plane, reset, render, ring, hsv)

N = 72
HITS = (10, 22)
POP = 34
sc = reset(N, seed=5)

gradient_bg('bg', [(0.0, (0.09, 0.01, 0.06)), (0.45, (0.32, 0.03, 0.2)), (1.0, (0.6, 0.12, 0.08))])
lm, lem, lam = glow_mat('light', (1.0, 0.55, 0.25), 1.2, power=1.4, edge=1 / 7)
disc('light', 7, (0, 12, 1), lm)
key_alpha(lam, [(1, 0.55), (POP, 0.55), (POP + 2, 1.0), (POP + 16, 0.6), (N, 0.6)])

def picado_mat(name, color):
    """Papel picado: color con agujeritos (Voronoi) para que se vea perforado."""
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = 5.5
    th = nt.nodes.new('ShaderNodeMath')
    th.operation = 'GREATER_THAN'
    th.inputs[1].default_value = 0.16
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = 0.95
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    nt.links.new(vo.outputs['Distance'], th.inputs[0])
    nt.links.new(th.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


# Papel picado: dos tiras de banderitas que se mecen.
COLORS = [hsv(h, 0.9, 1) for h in (0.0, 0.08, 0.15, 0.33, 0.5, 0.6, 0.8, 0.92)]
for row, (z0, sag) in enumerate([(9.2, 0.8), (7.6, 1.0)]):
    n = 9
    for i in range(n):
        u = (i + 0.5) / n
        x = -5.4 + u * 10.8
        z = z0 - sag * math.sin(u * math.pi)
        m = picado_mat(f'flag{row}_{i}', COLORS[(i + row * 3) % len(COLORS)])
        o = plane(f'flag{row}_{i}', 0.82, 1.05, (x, 6 + row, z - 0.6), m)
        for f in range(1, N + 1, 6):
            o.rotation_euler = (math.pi / 2, math.sin(f * 0.25 + i + row) * 0.12, 0)
            o.keyframe_insert('rotation_euler', frame=f)

# Golpes: destello en estrella y unas chispas.
star = Particles('hitspark', 'streak', size=0.12, strength=9)
for hi, f0 in enumerate(HITS + (POP,)):
    rad = 3.2 if f0 == POP else 1.8
    gm, gem, gam = glow_mat(f'hit{hi}', (1.0, 0.95, 0.6), 8, power=3, edge=1 / rad)
    disc(f'hit{hi}', rad, (0, -2.5, 0), gm)
    key_alpha(gam, [(1, 0), (f0 - 1, 0), (f0, 1.0), (f0 + 4, 0), (N, 0)])
    for k in range(10 if f0 != POP else 0):
        a = k / 10 * math.tau + random.random() * 0.3
        star.add(ballistic(f0, 0, 0, math.cos(a) * 9, math.sin(a) * 9, 0.25, gravity=0, drag=4, size=(1.3, 0.3)), (1, 0.95, 0.7))

# Onda dorada del reventón.
rm, rem, rmix = flat_mat('wave', (1.0, 0.8, 0.3), 5)
w = ring('wave', 1, 0.016, (0, -3, 0), rm)
for f, s, a in [(1, 0.01, 0), (POP - 1, 0.01, 0), (POP, 0.3, 1), (POP + 7, 4.0, 0.5), (POP + 14, 7, 0), (N, 7, 0)]:
    w.scale = (s, s, s)
    w.keyframe_insert('scale', frame=f)
    rmix.inputs['Fac'].default_value = a
    rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)

# Confeti: papelitos que giran, frenan con el aire y caen.
conf = Particles('conf', 'quad', size=0.11, strength=2.2)
for k in range(260):
    a = random.uniform(0, math.tau)
    v = random.uniform(5, 15)
    vz = math.sin(a) * v + 4
    path = ballistic(POP, random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), math.cos(a) * v, vz, random.uniform(1.2, 1.6), gravity=-9, drag=2.6, size=(1.0, 0.85), alpha=(1.0, 0.9), spin=random.uniform(-14, 14), end=N)
    conf.add(path, random.choice(COLORS))

# Dulces: más pesados, caen más rápido.
candy = Particles('candy', 'sphere', size=0.17, strength=2.6)
for k in range(46):
    a = random.uniform(0.1, math.pi - 0.1)
    v = random.uniform(6, 12)
    path = ballistic(POP, 0, 0, math.cos(a) * v, math.sin(a) * v, random.uniform(1.0, 1.5), gravity=-20, drag=0.5, size=(1.0, 1.0), alpha=(1.0, 1.0), spin=random.uniform(-8, 8), end=N)
    candy.add(path, random.choice([(1, 0.2, 0.3), (1, 0.85, 0.1), (0.2, 0.9, 0.5), (0.3, 0.6, 1), (1, 1, 1)]))

# Chispas doradas.
gold = Particles('gold', 'streak', size=0.1, strength=10)
for k in range(70):
    a = random.uniform(0, math.tau)
    v = random.uniform(9, 18)
    gold.add(ballistic(POP, 0, 0, math.cos(a) * v, math.sin(a) * v, random.uniform(0.35, 0.7), gravity=-10, drag=2.5, size=(1.3, 0.1), end=N), (1, 0.85, 0.4))

render(sys.argv[sys.argv.index('--out') + 1])
