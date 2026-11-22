"""Eliminación 2: AGUJERO NEGRO. En el espacio se abre un agujero negro: horizonte negro, anillo de
fotones, disco de acreción inclinado que gira (más brillante del lado que se acerca) y su imagen
curvada por la gravedad alrededor del horizonte. Las estrellas cercanas se deforman, el gas cae en
brazos espirales y salen dos chorros de energía mientras se traga al jugador (cuadros 14–43). En el
cuadro 46 se colapsa: destello, anillos de colores, nebulosa que se expande y queda una estrellita."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, hsv, key_alpha, key_fac, link, node_mat, noise_cloud_mat, nudge, reset, render, ring)

N = 64
COLLAPSE = 46
R = 1.15  # radio del horizonte (tamaño completo)
TILT = 0.22  # qué tan inclinado se ve el disco
sc = reset(N, seed=23)


def size_at(f):
    """Tamaño del agujero en cada cuadro: se abre, palpita mientras traga y se colapsa."""
    if f <= 12:
        u = (f - 1) / 11
        return 1 - (1 - u) ** 3
    if f <= COLLAPSE - 5:
        return 1 + 0.06 * math.sin((f - 12) * 0.45) + 0.004 * (f - 12)
    u = min(1, (f - (COLLAPSE - 5)) / 5)
    return (1 + 0.06 * math.sin((COLLAPSE - 17) * 0.45) + 0.12) * (1 - u ** 2.2)


gradient_bg('bg', [(0.0, (0.002, 0.001, 0.006)), (0.5, (0.006, 0.002, 0.016)), (1.0, (0.002, 0.002, 0.01))])

# Nebulosas de fondo (dos colores) que se mueven muy lento.
for i, (x, z, w, col, sc_) in enumerate([(-2.5, 5.5, 9, (0.32, 0.08, 0.5), 1.3), (3, -5, 10, (0.06, 0.22, 0.45), 1.1), (0, 0, 12, (0.25, 0.05, 0.3), 0.9)]):
    m, mp, em, dens = noise_cloud_mat(f'neb{i}', col, density=0.9, scale=sc_, strength=0.35, edge=2.0)
    o = disc(f'neb{i}', w / 2, (x, 16 - i * 0.3, z), m)
    for f, v in [(1, i), (N, i + 0.3)]:
        mp.inputs['Location'].default_value = (v, v * 0.5, 0)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)

# Estrellas: su imagen se desplaza hacia afuera cerca del agujero (lente gravitacional).
stars = Particles('star', 'sphere', size=0.032, strength=6)
for k in range(230):
    x, z = random.uniform(-5.3, 5.3), random.uniform(-10.3, 10.3)
    r = math.hypot(x, z) or 0.01
    ph = random.random() * math.tau
    b = random.uniform(0.3, 1.0)
    big = random.random() < 0.06
    fr = []
    for f in range(1, N + 1, 2):
        e = 1.5 * R * size_at(f)
        r2 = (r + math.sqrt(r * r + 4 * e * e)) / 2
        s = (1.0 if not big else 2.0) * (1 + 0.6 * max(0, 1 - (r2 - e) / 1.5))
        fr.append((f, x * r2 / r, z * r2 / r, s, b * (0.65 + 0.35 * math.sin(f * 0.35 + ph))))
    stars.add(fr, random.choice([(1, 1, 1), (0.8, 0.85, 1), (1, 0.9, 0.8), (0.85, 0.8, 1)]))
# Estrellas grandes con destello en cruz.
for k, (x, z) in enumerate([(-3.6, 7.4), (3.9, -6.8), (2.6, 8.6), (-4.0, -3.1)]):
    gm, gem, gam = glow_mat(f'flare{k}', (0.85, 0.9, 1.0), 9, power=2.2, edge=1.0)
    for j, (sx, sz) in enumerate([(1.1, 0.035), (0.035, 1.1), (0.1, 0.1)]):
        o = disc(f'flare{k}_{j}', 1, (x, 12, z), gm)
        o.scale = (sx, sz, 1)
    key_alpha(gam, [(f, 0.45 + 0.35 * math.sin(f * 0.3 + k * 2)) for f in range(1, N + 1, 4)])

# ---------- El agujero negro (todo cuelga de un "pivote" que crece y se colapsa) ----------
pivot = link(bpy.data.objects.new('pivot', None))
for f in range(1, N + 1):
    s = max(0.0001, size_at(f)) if f < COLLAPSE else 0.0001
    pivot.scale = (s, s, s)
    pivot.keyframe_insert('scale', frame=f)


def hang(o):
    o.parent = pivot
    return o


def annulus(name, r0, r1, a0, a1, y, mat, seg=72):
    """Anillo plano (o parte de él) de frente a la cámara."""
    me = bpy.data.meshes.new(name)
    verts, faces = [], []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        verts += [(math.cos(a) * r0, 0, math.sin(a) * r0), (math.cos(a) * r1, 0, math.sin(a) * r1)]
        if i:
            j = 2 * i
            faces.append((j - 2, j - 1, j + 1, j))
    me.from_pydata(verts, [], faces)
    me.update()
    o = nudge(link(bpy.data.objects.new(name, me)))
    o.location.y += y
    o.data.materials.append(mat)
    return hang(o)


def disk_mat(name, r0, r1, strength, k=2.2, m=9.0, vert=0.0):
    """Gas que gira: vetas en círculos (ruido en coordenadas polares sin costura), orilla interior
    nítida, más brillante del lado que se acerca (izquierda). vert > 0 aclara la parte de arriba."""
    mat, nt, out = node_mat(name)
    N_ = nt.nodes.new
    L = nt.links.new
    tc = N_('ShaderNodeTexCoord')
    mp = N_('ShaderNodeMapping')
    L(tc.outputs['Object'], mp.inputs['Vector'])
    sep = N_('ShaderNodeSeparateXYZ')
    L(mp.outputs['Vector'], sep.inputs[0])
    sep0 = N_('ShaderNodeSeparateXYZ')
    L(tc.outputs['Object'], sep0.inputs[0])
    ln = N_('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    L(tc.outputs['Object'], ln.inputs[0])
    r = ln.outputs['Value']

    def math_(op, a, b):
        n = N_('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L(v, n.inputs[i])
        return n.outputs[0]

    def mrange(v, a, b, c, d):
        n = N_('ShaderNodeMapRange')
        n.clamp = True
        L(v, n.inputs['Value'])
        n.inputs['From Min'].default_value, n.inputs['From Max'].default_value = a, b
        n.inputs['To Min'].default_value, n.inputs['To Max'].default_value = c, d
        return n.outputs['Result']

    comb = N_('ShaderNodeCombineXYZ')
    L(math_('MULTIPLY', math_('DIVIDE', sep.outputs['X'], r), k), comb.inputs['X'])
    L(math_('MULTIPLY', math_('DIVIDE', sep.outputs['Z'], r), k), comb.inputs['Y'])
    L(math_('MULTIPLY', r, m), comb.inputs['Z'])
    nz = N_('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 6
    nz.inputs['Roughness'].default_value = 0.62
    L(comb.outputs[0], nz.inputs['Vector'])
    streak = mrange(nz.outputs['Fac'], 0.3, 0.75, 0.15, 1.0)
    fall = math_('POWER', mrange(r, r0, r1, 1, 0), 1.6)
    edge = mrange(r, r0, r0 + (r1 - r0) * 0.08, 0, 1)
    dop = mrange(sep0.outputs['X'], -r1, r1, 1.8, 0.45)
    bright = math_('MULTIPLY', math_('MULTIPLY', streak, fall), math_('MULTIPLY', edge, dop))
    if vert:
        bright = math_('MULTIPLY', bright, mrange(sep0.outputs['Z'], -r1, r1, 1 - vert, 1 + vert))
    ramp = N_('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.5, 0.03, 0.12, 1)
    el[1].position, el[1].color = 1.0, (1.0, 0.97, 0.9, 1)
    for pos, col in [(0.35, (0.95, 0.25, 0.08, 1)), (0.7, (1.0, 0.62, 0.2, 1))]:
        e = el.new(pos)
        e.color = col
    L(fall, ramp.inputs['Fac'])
    em = N_('ShaderNodeEmission')
    L(ramp.outputs['Color'], em.inputs['Color'])
    gain = N_('ShaderNodeMath')
    gain.operation = 'MULTIPLY'
    gain.inputs[1].default_value = strength
    L(bright, gain.inputs[0])
    L(gain.outputs[0], em.inputs['Strength'])
    tr = N_('ShaderNodeBsdfTransparent')
    mix = N_('ShaderNodeMixShader')
    L(math_('MINIMUM', math_('MULTIPLY', bright, 2.5), 1.0), mix.inputs['Fac'])
    L(tr.outputs[0], mix.inputs[1])
    L(em.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs['Surface'])
    return mat, mp, gain


def spin(mp, turns_fn):
    for f in range(1, N + 1, 2):
        mp.inputs['Rotation'].default_value = (0, turns_fn(f), 0)
        mp.inputs['Rotation'].keyframe_insert('default_value', frame=f)


# Gira más rápido justo antes de colapsarse.
ang = lambda f: 0.11 * f + (0.0 if f < COLLAPSE - 8 else 0.05 * (f - COLLAPSE + 8) ** 2)

# Disco de acreción: mitad de enfrente (pasa delante del horizonte) y mitad de atrás.
dmat, dmp, dgain = disk_mat('disk', 1.35 * R, 4.2 * R, 7.0)
spin(dmp, ang)
for name, a0, a1, y in [('diskback', 0, math.pi, -1.6), ('diskfront', math.pi, math.tau, -2.4)]:
    o = annulus(name, 1.35 * R, 4.2 * R, a0, a1, y, dmat, seg=90)
    o.scale = (1, 1, TILT)
# Imagen del disco curvada por la gravedad: un aro alrededor del horizonte, más grueso arriba.
hmat, hmp, hgain = disk_mat('lensed', 1.02 * R, 1.95 * R, 6.0, k=2.6, m=12, vert=0.6)
spin(hmp, ang)
annulus('lensed', 1.02 * R, 1.95 * R, 0, math.tau, -1.75, hmat, seg=96)
# Horizonte negro y anillo de fotones.
bm, bem, bmix = flat_mat('horizon', (0, 0, 0), 0)
hang(disc('horizon', R, (0, -2.0, 0), bm, verts=96))
pm, pem, pmix = flat_mat('photon', (1.0, 0.85, 0.6), 12)
hang(ring('photon', R * 1.01, 0.022, (0, -2.05, 0), pm))
# Resplandor cálido alrededor.
gm, gem, gam = glow_mat('aura', (1.0, 0.45, 0.2), 2.2, power=2.2, edge=1 / (5 * R))
hang(disc('aura', 5 * R, (0, -1.0, 0), gm))
key_alpha(gam, [(1, 0.22), (COLLAPSE - 4, 0.4), (N, 0.4)])

# Al abrirse: una onda que rasga el espacio.
om, oem, omix = flat_mat('open', (0.8, 0.7, 1.0), 6)
op = ring('open', 1, 0.015, (0, -2.6, 0), om)
for f, s, a in [(1, 0.05, 1), (12, 3.2, 0.5), (20, 5.5, 0), (N, 5.5, 0)]:
    op.scale = (s, s, s)
    op.keyframe_insert('scale', frame=f)
    omix.inputs['Fac'].default_value = a
    omix.inputs['Fac'].keyframe_insert('default_value', frame=f)

# ---------- Chorros de energía por los polos (mientras se traga al jugador) ----------
jm, jem, jam = glow_mat('jet', (0.55, 0.65, 1.0), 6, power=1.6, edge=1.0)
jm2, jem2, jam2 = glow_mat('jetcore', (0.9, 0.95, 1.0), 10, power=2.5, edge=1.0)
for sgn in (1,):
    for mat, sx, sz in [(jm, 0.38, 9.5), (jm2, 0.08, 8.0)]:
        o = disc(f'jet{sgn}{sx}', 1, (0, -1.3, 0), mat)
        o.scale = (sx, sz, 1)
jet_keys = [(1, 0), (16, 0), (20, 0.9), (24, 0.6), (28, 1.0), (32, 0.7), (36, 1.0), (COLLAPSE - 3, 1.0), (COLLAPSE, 0), (N, 0)]
key_alpha(jam, jet_keys)
key_alpha(jam2, [(f, v * 0.65) for f, v in jet_keys])
knots = Particles('knot', 'streak', size=0.08, strength=12, aspect=(5.0, 0.5))
for k in range(70):
    f0 = random.randint(17, COLLAPSE - 4)
    sgn = random.choice((1, -1))
    v = random.uniform(18, 30)
    x0 = random.uniform(-0.08, 0.08)
    knots.add([(f, x0 * (1 + (f - f0) * 0.3), sgn * (1.2 + (f - f0) * v / 24), 1.0, 0.9 * (1 - (f - f0) / 10)) for f in range(f0, min(N, f0 + 10))], (0.75, 0.85, 1.0))

# ---------- Gas que cae en brazos espirales ----------
fall = Particles('fall', 'streak', size=0.06, strength=9, aspect=(3.6, 0.32))
for k in range(240):
    arm = k % 3
    f0 = random.randint(2, 34)
    life = random.randint(14, 26)
    r0 = random.uniform(3.5, 7.0)
    a_arm = arm * math.tau / 3 + random.gauss(0, 0.18)
    col = random.choice([hsv(0.06, 0.7, 1), hsv(0.92, 0.55, 1), hsv(0.75, 0.5, 1), (1, 0.9, 0.75)]) if arm < 2 else random.choice([hsv(0.55, 0.6, 1), (0.9, 0.9, 1)])
    fr = []
    for i in range(life + 1):
        f = f0 + i
        if f >= COLLAPSE:
            break
        t = i / life
        r = r0 * (1 - t) ** 1.25 + 1.3 * R
        a = a_arm + 2.1 * math.log(r0 / r) + 0.11 * f
        fr.append((f, r * math.cos(a), r * math.sin(a) * 0.5, 0.6 + t * 1.3, min(1, t * 4) * (1 - t * 0.4)))
    if len(fr) > 2:
        fall.add(fr, col)

# ---------- Colapso: destello, anillos, nebulosa que se expande y una estrellita ----------
gm, gem, gam = glow_mat('collapse', (0.9, 0.82, 1.0), 12, power=3, edge=1 / 3.6)
disc('collapse', 3.6, (0, -2.6, 0), gm)
key_alpha(gam, [(1, 0), (COLLAPSE - 2, 0), (COLLAPSE - 1, 0.35), (COLLAPSE, 1.0), (COLLAPSE + 1, 0.6), (COLLAPSE + 3, 0.3), (COLLAPSE + 9, 0), (N, 0)])
for i, (col, speed, th, delay) in enumerate([((1, 1, 1), 9.0, 0.016, 0), ((1.0, 0.45, 0.85), 6.0, 0.03, 1), ((0.4, 0.7, 1.0), 4.2, 0.028, 2)]):
    rm, rem, rmix = flat_mat(f'wave{i}', col, 6)
    w = ring(f'wave{i}', 1, th, (0, -3 - i * 0.05, 0), rm)
    f0 = COLLAPSE + delay
    for f, s, a in [(1, 0.01, 0), (f0 - 1, 0.01, 0), (f0, 0.3, 1), (f0 + 8, 0.3 + speed * 0.5, 0.6), (f0 + 16, 0.3 + speed, 0), (N, 0.3 + speed, 0)]:
        w.scale = (s, s * (1 if i == 0 else 0.92), s)
        w.keyframe_insert('scale', frame=f)
        rmix.inputs['Fac'].default_value = a
        rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)
for i, (col, s1) in enumerate([((0.9, 0.3, 0.7), 5.5), ((0.3, 0.55, 1.0), 4.5), ((1.0, 0.6, 0.35), 3.2)]):
    m, mp, em, dens = noise_cloud_mat(f'burst{i}', col, density=1.6, scale=2.2 + i * 0.6, strength=1.6)
    o = disc(f'burst{i}', 1, (0, -0.8 - i * 0.1, 0), m)
    for f, s, d in [(1, 0.01, 0), (COLLAPSE - 1, 0.01, 0), (COLLAPSE, 0.5, 1.4), (COLLAPSE + 8, s1 * 0.7, 1.0), (N, s1, 0.0)]:
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
    for f, v in [(COLLAPSE, i), (N, i + 0.6)]:
        mp.inputs['Rotation'].default_value = (0, 0, v * (1 if i % 2 else -1))
        mp.inputs['Rotation'].keyframe_insert('default_value', frame=f)
debris = Particles('debris', 'streak', size=0.1, strength=11)
for k in range(110):
    a = random.random() * math.tau
    v = random.uniform(6, 18)
    path = ballistic(COLLAPSE, 0, 0, math.cos(a) * v, math.sin(a) * v, random.uniform(0.4, 0.8), gravity=0, drag=2.2, size=(1.4, 0.2), end=N)
    debris.add(path, random.choice([(1, 1, 1), hsv(0.75, 0.5, 1), hsv(0.55, 0.6, 1), hsv(0.9, 0.5, 1), hsv(0.08, 0.5, 1)]))
# Lo que queda: una estrellita que titila.
sm, sem, sam = glow_mat('remnant', (0.9, 0.9, 1.0), 9, power=3, edge=1.0)
for j, (sx, sz) in enumerate([(1.6, 0.045), (0.045, 1.6), (0.3, 0.3)]):
    o = disc(f'remnant{j}', 1, (0, -3.2, 0), sm)
    o.scale = (sx, sz, 1)
key_alpha(sam, [(1, 0), (COLLAPSE + 3, 0), (COLLAPSE + 7, 1.0)] + [(f, 0.6 + 0.4 * math.sin(f * 0.8)) for f in range(COLLAPSE + 9, N + 1, 2)])

render(sys.argv[sys.argv.index('--out') + 1])
