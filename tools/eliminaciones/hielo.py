"""Eliminación 6: HIELO (Congelado). Noche polar con aurora, cerros de hielo y nieve que cae. Sopla
una ventisca hacia el jugador (cuadros 1–12), la escarcha crece desde las orillas de la pantalla como
en un vidrio y brotan picos de hielo del piso. El jugador queda congelado en un bloque de hielo
(eso lo dibuja la app encima, cuadros 10–30), se cuartea y en el cuadro 40 estalla en mil pedazos:
destello, onda, astillas que giran y brillan, polvo de nieve y brillitos que se quedan flotando."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (Particles, ballistic, curve_obj, disc, flat_mat, flat_mesh, glow_mat, gradient_bg, key_alpha, key_color, key_grow, key_strength, mountains, node_mat, noise_cloud_mat, obj_color_mat, plane, reset, render, ring)

N = 72
FREEZE = 10
SOLID = 30
SHATTER = 40
FEET = -1.3
sc = reset(N, seed=53)

_, sky = gradient_bg('sky', [(0.0, (0.02, 0.05, 0.09)), (0.45, (0.012, 0.035, 0.07)), (0.75, (0.004, 0.012, 0.035)), (1.0, (0.002, 0.004, 0.018))])
key_strength(sky, [(1, 1.0), (SHATTER - 1, 1.0), (SHATTER, 2.2), (SHATTER + 6, 1.1), (N, 1.0)])
stars = Particles('star', 'sphere', size=0.028, strength=5)
for k in range(90):
    x, z = random.uniform(-5.2, 5.2), random.uniform(1, 10.2)
    ph = random.random() * math.tau
    stars.add([(f, x, z, 1, 0.3 + 0.4 * abs(math.sin(f * 0.2 + ph))) for f in range(1, N + 1, 4)], (0.85, 0.95, 1))
# Aurora: cortinas de luz verde y turquesa que ondulan.
for i, (z, col, sc_) in enumerate([(7.6, (0.15, 1.0, 0.6), 1.2), (8.6, (0.1, 0.7, 1.0), 0.9), (6.8, (0.5, 0.3, 1.0), 1.5)]):
    m, mp, em, dens = noise_cloud_mat(f'aurora{i}', col, density=1.5, scale=sc_, detail=3, strength=1.1, edge=2.3)
    els = m.node_tree.nodes['Color Ramp'].color_ramp.elements
    els[0].position, els[1].position = 0.4, 0.85
    o = plane(f'aurora{i}', 14, 3.0, (0, 15 - i * 0.2, z), m)
    o.rotation_euler = (math.pi / 2, 0.18 - i * 0.16, 0)
    mp.inputs['Scale'].default_value = (3.0, 0.35, 1)
    for f, v in [(1, i), (N, i + 0.9)]:
        mp.inputs['Location'].default_value = (v, v * 0.3, 0)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    key_strength(em, [(1, 1.0), (SHATTER, 1.0), (SHATTER + 2, 2.0), (SHATTER + 10, 1.1), (N, 1.0)])

# Cerros de hielo y piso nevado.
far, fem_, _ = flat_mat('far', (0.04, 0.08, 0.14), 1)
mountains('far', -6, 6, FEET - 0.3, (0.4, 3.2), 0.6, 13, far, n=22)
near, nem_, _ = flat_mat('near', (0.02, 0.045, 0.085), 1)
mountains('near', -6, 6, FEET - 0.3, (-0.6, 1.0), 0.35, 12, near, n=26)
_, gem = gradient_bg('ground', [(0.0, (0.006, 0.012, 0.025)), (0.85, (0.03, 0.055, 0.1)), (1.0, (0.06, 0.1, 0.16))], y=11, h=9.8, z=FEET - 4.9)
key_strength(gem, [(1, 1.0), (SHATTER - 1, 1.0), (SHATTER, 2.0), (SHATTER + 8, 1.0), (N, 1.0)])
# Brillo frío que crece alrededor del jugador mientras se congela.
cm, cem, cam = glow_mat('cold', (0.5, 0.85, 1.0), 2.5, power=1.6, edge=1 / 3.4)
disc('cold', 3.4, (0, 5, 0.2), cm)
key_alpha(cam, [(1, 0), (FREEZE, 0.1), (SOLID, 0.35), (SHATTER - 1, 0.45), (SHATTER, 0.6), (SHATTER + 10, 0.12), (N, 0.06)])

# ---------- Nieve: cae con viento; al principio se arremolina hacia el jugador ----------
snow = Particles('snow', 'sphere', size=0.035, strength=3)
for k in range(260):
    f0 = random.randint(-30, N)
    x0, z0 = random.uniform(-6, 8), 11
    vx, vz = random.uniform(-2.6, -1.4), random.uniform(-3.2, -2.0)
    fr = []
    x, z = x0, z0
    for i in range(0, 110, 3):
        f = f0 + i
        if z < -10.5:
            break
        if 1 <= f <= N + 2:
            fr.append((f, x + math.sin(i * 0.1 + k) * 0.25, z, random.uniform(0.8, 1.3), 0.7))
        x += vx * 3 / 24
        z += vz * 3 / 24
    if len(fr) > 1:
        snow.add(fr, (0.9, 0.95, 1.0))
gust = Particles('gust', 'streak', size=0.05, strength=4, aspect=(5, 0.25))
for k in range(90):
    f0 = random.randint(1, SOLID - 8)
    a0 = random.random() * math.tau
    r0 = random.uniform(3.5, 6)
    fr = []
    for i in range(14):
        f = f0 + i
        t = i / 13
        r = r0 * (1 - t) + 0.9
        a = a0 + t * 2.6
        fr.append((f, r * math.cos(a), r * math.sin(a) * 0.9, 1, 0.7 * math.sin(t * math.pi)))
    gust.add(fr, (0.8, 0.92, 1.0))

# ---------- Escarcha que crece desde las orillas (como en un vidrio) ----------
frost = obj_color_mat('frost', 3)


def fern(name, p, ang, length, depth, f0, f1, width):
    end = (p[0] + math.cos(ang) * length, p[1] + math.sin(ang) * length)
    pts = [(p[0] + (end[0] - p[0]) * i / 6 + random.gauss(0, 0.02), p[1] + (end[1] - p[1]) * i / 6 + random.gauss(0, 0.02)) for i in range(7)]
    o = curve_obj(name, pts, width, frost, y=-3.5, taper=lambda u: 1 - 0.8 * u)
    key_grow(o, [(1, 0), (f0, 0), (f1, 1)])
    key_color(o, (0.8, 0.93, 1.0), [(1, 0.0), (f0, 0.3), (SHATTER - 1, 0.38), (SHATTER, 0.8), (SHATTER + 6, 0.35), (N, 0.3)])
    if depth == 0:
        return
    n = 4
    for j in range(1, n + 1):
        u = j / (n + 1)
        q = (p[0] + (end[0] - p[0]) * u, p[1] + (end[1] - p[1]) * u)
        fj = f0 + (f1 - f0) * u
        for side in (-1, 1):
            fern(f'{name}_{j}{side}', q, ang + side * math.radians(60), length * (0.42 - 0.06 * j), depth - 1, round(fj), round(fj + (f1 - f0) * 0.5), width * 0.6)


seeds = [(-5.05, z) for z in (8.5, 4.0, -2.5, -7.5)] + [(5.05, z) for z in (7.0, 1.5, -4.5, -8.8)] + [(x, 10.1) for x in (-2.5, 1.8)] + [(x, -10.1) for x in (-1.5, 3.0)]
for i, (x, z) in enumerate(seeds):
    inward = math.atan2(-z * 0.3, -x) if abs(x) > 5 else (-math.pi / 2 if z > 0 else math.pi / 2)
    for b in range(2):
        f0 = random.randint(4, 12)
        fern(f'fern{i}{b}', (x, z), inward + random.uniform(-0.6, 0.6), random.uniform(1.1, 1.9), 2, f0, f0 + random.randint(14, 22), 0.016)

# ---------- Picos de hielo que brotan del piso ----------
def ice_mat(name):
    """Hielo: degradado de abajo (azul) a la punta (casi blanco), un poco transparente."""
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].color, el[1].color = (0.12, 0.35, 0.65, 1), (0.85, 0.97, 1.0, 1)
    e = el.new(0.55)
    e.color = (0.35, 0.7, 0.95, 1)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 1.6
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 0.85
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m, em


imat, iem = ice_mat('spike')
key_strength(iem, [(1, 1.6), (SHATTER - 1, 1.8), (SHATTER, 4.0), (SHATTER + 6, 1.8), (N, 1.6)])
facet, _, _ = flat_mat('facet', (0.9, 1.0, 1.0), 2.5)
for k in range(15):
    x = (k / 14 - 0.5) * 6.4 + random.uniform(-0.2, 0.2)
    h = (2.6 - abs(x) * 0.55) * random.uniform(0.6, 1.1) + 0.3
    w = random.uniform(0.25, 0.5)
    lean = -x * 0.08 + random.uniform(-0.1, 0.1)
    base = FEET - 0.1 - random.uniform(0, 0.25)
    root = bpy.data.objects.new(f'spikeroot{k}', None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (x, 2.0 + random.uniform(0, 0.4), base)
    me = flat_mesh(f'spike{k}', [[(-w, 0), (w, 0), (w * 0.7 + lean * h, h * 0.8), (lean * h, h), (-w * 0.7 + lean * h, h * 0.8)]])
    o = bpy.data.objects.new(f'spike{k}', me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(imat)
    o.parent = root
    ln = flat_mesh(f'facet{k}', [[(lean * h - 0.015, h * 0.98), (lean * h + 0.015, h * 0.98), (0.03, 0.05), (-0.03, 0.05)]])
    lo = bpy.data.objects.new(f'facet{k}', ln)
    bpy.context.scene.collection.objects.link(lo)
    lo.data.materials.append(facet)
    lo.parent = root
    lo.location = (0, -0.01, 0)
    f0 = FREEZE + abs(x) * 2.2 + random.uniform(0, 3)
    for f, s in [(1, 0.0001), (round(f0), 0.0001), (round(f0) + 3, 1.15), (round(f0) + 5, 1.0), (N, 1.0)]:
        root.scale = (1, 1, s)
        root.keyframe_insert('scale', frame=f)
# Neblina helada en el piso.
for k in range(5):
    m, mp, em, dens = noise_cloud_mat(f'mist{k}', (0.6, 0.8, 1.0), density=0.9, scale=1.8, strength=0.5)
    o = disc(f'mist{k}', 1, (0, 1.5 + k * 0.02, FEET - 0.3), m)
    x0 = (k - 2) * 2.2
    for f, x, s in [(1, x0 + 1.5, 1.6), (N, x0 - 1.5, 2.0)]:
        o.location = (x, o.location.y, FEET - 0.2)
        o.keyframe_insert('location', frame=f)
        o.scale = (s * 1.6, s * 0.6, 1)
        o.keyframe_insert('scale', frame=f)
    for f, v in [(1, k), (N, k + 1)]:
        mp.inputs['Location'].default_value = (v, 0, 0)
        mp.inputs['Location'].keyframe_insert('default_value', frame=f)

# ---------- ¡Se rompe! ----------
fm, fem, fam = glow_mat('shatter', (0.8, 0.95, 1.0), 10, power=2.6, edge=1 / 3.2)
disc('shatter', 3.2, (0, -2.4, 0), fm)
key_alpha(fam, [(1, 0), (SHATTER - 1, 0), (SHATTER, 1.0), (SHATTER + 2, 0.5), (SHATTER + 7, 0), (N, 0)])
rm, rem, rmix = flat_mat('wave', (0.7, 0.92, 1.0), 6)
w = ring('wave', 1, 0.018, (0, -3, 0), rm)
for f, s, a in [(1, 0.01, 0), (SHATTER - 1, 0.01, 0), (SHATTER, 0.4, 1), (SHATTER + 7, 4.2, 0.5), (SHATTER + 14, 7, 0), (N, 7, 0)]:
    w.scale = (s, s, s)
    w.keyframe_insert('scale', frame=f)
    rmix.inputs['Fac'].default_value = a
    rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)
# Astillas de hielo: triángulos que giran en 3D (brillan cuando les da la luz) y caen al piso.
shards = []
for j in range(4):
    pts = [(random.uniform(-1, -0.3), random.uniform(-1, -0.2)), (random.uniform(0.3, 1), random.uniform(-0.8, 0)), (random.uniform(-0.3, 0.4), random.uniform(0.6, 1.3))]
    shards.append(Particles(f'shard{j}', 'mesh', size=0.24, strength=2.2, mesh=flat_mesh(f'shard{j}', [pts])))
glint = Particles('glint', 'sphere', size=0.05, strength=14)
for k in range(150):
    a = random.uniform(0, math.tau)
    v = random.uniform(4, 14)
    floor = FEET - random.uniform(0.0, 2.8)
    path = ballistic(SHATTER, random.uniform(-0.7, 0.7), random.uniform(-0.8, 0.9), math.cos(a) * v, math.sin(a) * v + 3, (N - SHATTER) / 24, gravity=-16, drag=1.0, size=(random.uniform(0.6, 1.5),) * 2, alpha=(0.9, 0.8), spin=random.uniform(-14, 14), end=N)
    out = []
    landed = None
    for f, x, z, s, al, r in path:
        if landed:
            x = landed[0] + (x - landed[0]) * 0.15
            z, r = floor, landed[1]
        elif z < floor and f > SHATTER + 3:
            landed = (x, r)
            z = floor
        out.append((f, x, z, s, al, r))
    col = random.choice([(0.7, 0.9, 1.0), (0.55, 0.8, 1.0), (0.85, 0.97, 1.0)])
    shards[k % 4].add(out, col)
    # Destellos cuando la astilla "voltea" hacia la luz.
    for f, x, z, s, al, r in out[2::5]:
        if random.random() < 0.3:
            glint.add([(f, x, z, 1.4, 1.0), (f + 1, x, z, 0.5, 0.0)], (1, 1, 1))
# Polvo de hielo y nieve.
dust = Particles('icedust', 'sphere', size=0.035, strength=7)
for k in range(140):
    a = random.uniform(0, math.tau)
    v = random.uniform(3, 12)
    dust.add(ballistic(SHATTER, 0, 0.2, math.cos(a) * v, math.sin(a) * v, random.uniform(0.5, 1.2), gravity=-3, drag=2.6, size=(1.0, 0.4), end=N), (0.85, 0.95, 1.0))
for k in range(6):
    m, mp, em, dens = noise_cloud_mat(f'powder{k}', (0.8, 0.9, 1.0), density=1.5, scale=2.4, strength=1.0)
    o = disc(f'powder{k}', 1, (0, -1.2 - k * 0.02, 0), m)
    a = k / 6 * math.tau
    for f, s, d, r in [(1, 0.01, 0, 0), (SHATTER - 1, 0.01, 0, 0), (SHATTER, 0.6, 1.5, 0.3), (SHATTER + 10, 1.8, 1.0, 1.6), (N, 2.6, 0.0, 2.4)]:
        o.location = (math.cos(a) * r, o.location.y, 0.2 + math.sin(a) * r * 0.8 - (0.5 if f > SHATTER + 10 else 0))
        o.keyframe_insert('location', frame=f)
        o.scale = (s, s, s)
        o.keyframe_insert('scale', frame=f)
        dens.inputs[1].default_value = d
        dens.inputs[1].keyframe_insert('default_value', frame=f)
# Brillitos en cruz que se quedan flotando.
spark = obj_color_mat('xspark', 12)
for k in range(14):
    f0 = SHATTER + random.randint(2, 20)
    x, z = random.uniform(-3, 3), random.uniform(-2.5, 3.5)
    s = random.uniform(0.18, 0.35)
    cross = flat_mesh(f'xs{k}', [[(-s, 0), (0, s * 0.12), (s, 0), (0, -s * 0.12)], [(0, -s), (s * 0.12, 0), (0, s), (-s * 0.12, 0)]])
    o = bpy.data.objects.new(f'xspark{k}', cross)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(spark)
    o.location = (x, -3.2 - k * 0.01, z)
    key_color(o, (0.9, 0.97, 1.0), [(1, 0), (f0, 0), (f0 + 2, 1), (f0 + 6, 0.2), (f0 + 9, 0), (N, 0)])
    for f, r in [(f0, 0), (f0 + 9, 0.8)]:
        o.rotation_euler = (0, r, 0)
        o.keyframe_insert('rotation_euler', frame=f)

render(sys.argv[sys.argv.index('--out') + 1])
