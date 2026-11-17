"""Eliminación 2: AGUJERO NEGRO. Se abre un remolino en el espacio, todo gira y cae hacia el centro
(el jugador se lo traga entre los cuadros 14 y 40), se colapsa en el cuadro 46 con un destello y
una onda, y queda el cielo estrellado."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (FPS, Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, key_alpha, key_fac, node_mat, reset, render, ring, hsv)

N = 64
COLLAPSE = 46
sc = reset(N, seed=23)

gradient_bg('bg', [(0.0, (0.004, 0.002, 0.012)), (0.5, (0.018, 0.006, 0.04)), (1.0, (0.008, 0.004, 0.025))])

# Nebulosa tenue.
neb, nem, nam = glow_mat('nebula', (0.35, 0.12, 0.6), 0.5, power=1.2, edge=1 / 7)
o = disc('nebula', 7, (0, 15, 1.5), neb)
key_alpha(nam, [(1, 0.6), (N, 0.6)])

# Estrellas que titilan.
stars = Particles('star', 'sphere', size=0.035, strength=6)
for k in range(170):
    x, z = random.uniform(-5.2, 5.2), random.uniform(-10.2, 10.2)
    ph = random.random() * math.tau
    b = random.uniform(0.3, 1.0)
    fr = [(f, x, z, random.uniform(0.6, 1.4) if f == 1 else 1.0, b * (0.65 + 0.35 * math.sin(f * 0.35 + ph))) for f in range(1, N + 1, 4)]
    stars.add(fr, random.choice([(1, 1, 1), (0.8, 0.85, 1), (1, 0.9, 0.8)]))


def disk_material():
    """Disco de acreción: anillo brillante con ruido que gira (remolino)."""
    m, nt, out = node_mat('disk')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.25, 0.05, 0.5, 1)
    el[1].position, el[1].color = 1.0, (1.0, 0.95, 0.85, 1)
    e = el.new(0.45)
    e.color = (0.9, 0.3, 0.7, 1)
    e = el.new(0.7)
    e.color = (1.0, 0.6, 0.2, 1)
    alpha = nt.nodes.new('ShaderNodeValToRGB')
    a = alpha.color_ramp.elements
    a[0].position, a[0].color = 0.0, (0, 0, 0, 1)
    a[1].position, a[1].color = 0.75, (1, 1, 1, 1)
    maps = []
    noises = []
    for i, sc_ in enumerate((3.0, 7.0)):
        mp = nt.nodes.new('ShaderNodeMapping')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = sc_
        nz.inputs['Detail'].default_value = 4
        mp.inputs['Scale'].default_value = (0.28, 0.28, 0.28)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
        maps.append(mp)
        noises.append(nz)
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    streak = nt.nodes.new('ShaderNodeMath')
    streak.operation = 'MULTIPLY'
    boost = nt.nodes.new('ShaderNodeMath')
    boost.operation = 'MULTIPLY'
    boost.inputs[1].default_value = 2.2
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 5
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    # El disco mide 3.6 de radio: coordenadas a ±1 para el degradado.
    norm = nt.nodes.new('ShaderNodeVectorMath')
    norm.operation = 'SCALE'
    norm.inputs['Scale'].default_value = 1 / 3.6
    nt.links.new(tc.outputs['Object'], norm.inputs[0])
    nt.links.new(norm.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(grad.outputs['Fac'], alpha.inputs['Fac'])
    nt.links.new(noises[0].outputs['Fac'], streak.inputs[0])
    nt.links.new(noises[1].outputs['Fac'], streak.inputs[1])
    nt.links.new(alpha.outputs['Color'], mul.inputs[0])
    nt.links.new(streak.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], boost.inputs[0])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(boost.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m, maps, em


dm, maps, dem = disk_material()
d = disc('disk', 3.6, (0, -0.5, 0), dm, verts=96)
d.scale = (1, 1, 0.82)
for i, mp in enumerate(maps):
    for f, r in [(1, 0), (N, (8.0 if i == 0 else -5.0))]:
        mp.inputs['Rotation'].default_value = (0, 0, r)
        mp.inputs['Rotation'].keyframe_insert('default_value', frame=f)
for f, s in [(1, 0.02), (12, 1.0), (24, 1.08), (34, 0.96), (COLLAPSE - 4, 1.05), (COLLAPSE, 0.02), (N, 0.0)]:
    d.scale = (s, s, s * 0.82)
    d.keyframe_insert('scale', frame=f)

# Horizonte de sucesos (negro) y anillo de fotones.
hm, hem, hmix = flat_mat('horizon', (0, 0, 0), 0)
h = disc('horizon', 0.75, (0, -2.0, 0), hm)
pm, pem, pmix = flat_mat('photon', (1.0, 0.75, 0.45), 9)
p = ring('photon', 0.78, 0.035, (0, -2.1, 0), pm)
for f, s in [(1, 0.0), (10, 1.0), (COLLAPSE - 4, 1.15), (COLLAPSE, 0.0), (N, 0.0)]:
    for ob in (h, p):
        ob.scale = (s, s, s)
        ob.keyframe_insert('scale', frame=f)

# Lo que cae girando.
fall = Particles('fall', 'streak', size=0.07, strength=9)
for k in range(150):
    f0 = random.randint(3, 30)
    life = random.randint(16, 30)
    r0 = random.uniform(3.2, 6.5)
    a0 = random.random() * math.tau
    col = random.choice([hsv(0.78, 0.6, 1), hsv(0.52, 0.7, 1), hsv(0.92, 0.5, 1), (1, 1, 1), hsv(0.08, 0.6, 1)])
    fr = []
    a = a0
    for i in range(life + 1):
        f = f0 + i
        if f >= COLLAPSE:
            break
        t = i / life
        r = r0 * (1 - t) ** 1.3 + 0.35
        a += 0.9 / r
        fr.append((f, r * math.cos(a), r * math.sin(a) * 0.82, 0.6 + t * 1.2, min(1, t * 4) * (1 - t * 0.3), a))
    if len(fr) > 2:
        fall.add(fr, col)

# Colapso: destello, onda y restos que salen disparados.
gm, gem, gam = glow_mat('collapse', (0.85, 0.75, 1.0), 10, power=3, edge=1 / 4.5)
disc('collapse', 4.5, (0, -2.5, 0), gm)
key_alpha(gam, [(1, 0), (COLLAPSE - 1, 0), (COLLAPSE, 1.0), (COLLAPSE + 3, 0.7), (COLLAPSE + 14, 0), (N, 0)])
rm, rem, rmix = flat_mat('wave', (0.6, 0.5, 1.0), 5)
w = ring('wave', 1, 0.014, (0, -3, 0), rm)
for f, s, a in [(1, 0.01, 0), (COLLAPSE - 1, 0.01, 0), (COLLAPSE, 0.3, 1), (COLLAPSE + 8, 4.5, 0.6), (COLLAPSE + 16, 8, 0), (N, 8, 0)]:
    w.scale = (s, s, s)
    w.keyframe_insert('scale', frame=f)
    rmix.inputs['Fac'].default_value = a
    rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)
debris = Particles('debris', 'streak', size=0.1, strength=10)
for k in range(80):
    a = random.random() * math.tau
    v = random.uniform(6, 16)
    path = ballistic(COLLAPSE, 0, 0, math.cos(a) * v, math.sin(a) * v, random.uniform(0.4, 0.8), gravity=0, drag=2.2, size=(1.4, 0.2), end=N)
    debris.add(path, random.choice([(1, 1, 1), hsv(0.75, 0.5, 1), hsv(0.55, 0.6, 1)]))

render(sys.argv[sys.argv.index('--out') + 1])
