"""Eliminación 5: OVNI (Abducido). Noche en el campo: cerros, granero, cerca y una vaca que mira.
Baja un platillo volador con luces que corren y un extraterrestre en la cúpula; en el cuadro 12 prende
su rayo tractor (anillos que suben, chispas y polvo) y el jugador sube flotando hasta que el platillo
se lo traga (cuadro 48, destello). El rayo se apaga, el platillo hace "¡glup!" y sale disparado
(cuadro 56) dejando una estela y un destello en el cielo."""
import math
import random
import sys

import bpy

sys.path.insert(0, sys.argv[sys.argv.index('--dir') + 1])
from common import (Particles, ballistic, disc, flat_mat, glow_mat, gradient_bg, key_alpha, key_color, key_strength, link, mountains, node_mat, noise_cloud_mat, nudge, obj_color_mat, poly_mesh, reset, render, ring)

N = 72
BEAM = 12
HIT = 48
ZOOM = 56
FEET = -1.3
HOVER = 5.8  # altura del centro del platillo
sc = reset(N, seed=41)

gradient_bg('sky', [(0.0, (0.01, 0.03, 0.035)), (0.45, (0.012, 0.04, 0.06)), (0.7, (0.006, 0.015, 0.04)), (1.0, (0.002, 0.004, 0.018))])
stars = Particles('star', 'sphere', size=0.03, strength=5)
for k in range(110):
    x, z = random.uniform(-5.2, 5.2), random.uniform(-0.5, 10.2)
    ph = random.random() * math.tau
    stars.add([(f, x, z, random.uniform(0.7, 1.3), 0.35 + 0.45 * abs(math.sin(f * 0.2 + ph))) for f in range(1, N + 1, 4)], random.choice([(1, 1, 1), (0.8, 1, 0.95)]))

# Campo: cerros, granero, cerca, pasto y una vaca.
far, _, _ = flat_mat('far', (0.008, 0.022, 0.03), 1)
mountains('far', -6, 6, FEET - 0.3, (-0.4, 1.0), 0.25, 13, far, n=30)
near, _, _ = flat_mat('near', (0.004, 0.01, 0.012), 1)
mountains('near', -6, 6, FEET - 0.3, (-1.0, -0.3), 0.12, 12, near, n=30)
_, gem = gradient_bg('ground', [(0.0, (0.001, 0.0025, 0.002)), (1.0, (0.004, 0.011, 0.008))], y=11, h=9.8, z=FEET - 4.9)
key_strength(gem, [(1, 1.0), (BEAM - 1, 1.0), (BEAM + 3, 1.8), (HIT, 2.0), (HIT + 4, 1.0), (N, 1.0)])
sil, _, _ = flat_mat('sil', (0.002, 0.004, 0.006), 1)
poly_mesh('barn', [(-4.9, FEET - 0.2), (-2.9, FEET - 0.2), (-2.9, 0.4), (-3.9, 1.3), (-4.9, 0.4)], 10, sil)
wm, wem, wmix = flat_mat('barnwin', (1.0, 0.7, 0.3), 2.2)
poly_mesh('barnwin', [(-4.1, -0.1), (-3.7, -0.1), (-3.7, 0.3), (-4.1, 0.3)], 9.9, wm)
for i in range(9):
    x = -2.4 + i * 0.95
    if abs(x) < 1.3:
        continue
    poly_mesh(f'post{i}', [(x, FEET - 0.3), (x + 0.08, FEET - 0.3), (x + 0.08, FEET + 0.45), (x, FEET + 0.45)], 9.5, sil)
for z in (FEET + 0.1, FEET + 0.32):
    for a, b in ((-2.4, -1.3), (1.3, 5.6)):
        poly_mesh(f'rail{a}{z}', [(a, z), (b, z), (b, z + 0.05), (a, z + 0.05)], 9.5, sil)
# Vaca (silueta) que voltea a ver.
cow = [(2.9, FEET - 0.05), (3.0, FEET - 0.05), (3.05, FEET + 0.35), (3.55, FEET + 0.35), (3.6, FEET - 0.05), (3.7, FEET - 0.05), (3.75, FEET + 0.45), (3.75, FEET + 0.85), (3.1, FEET + 0.9), (2.85, FEET + 1.05), (2.55, FEET + 1.0), (2.5, FEET + 0.8), (2.85, FEET + 0.7), (2.9, FEET + 0.45)]
poly_mesh('cow', cow, 9.4, sil)
eye = Particles('coweye', 'sphere', size=0.03, strength=6)
eye.add([(f, 2.66, FEET + 0.92, 1, 0.0 if f < BEAM else 0.9) for f in range(1, N + 1, 2)], (0.7, 1, 0.9))
# Pasto en primer plano.
grass = obj_color_mat('grass', 1)
for k in range(46):
    x = random.uniform(-5.4, 5.4)
    h = random.uniform(0.25, 0.7)
    lean = random.uniform(-0.15, 0.15)
    o = poly_mesh(f'grass{k}', [(x - 0.06, FEET - 0.4), (x + 0.06, FEET - 0.4), (x + lean, FEET - 0.4 + h)], 8 - k * 0.001, grass)
    key_color(o, (0.004, 0.012, 0.01), [(1, 1)])
# Luciérnagas.
fly = Particles('firefly', 'sphere', size=0.035, strength=8)
for k in range(16):
    x0, z0 = random.uniform(-5, 5), random.uniform(FEET - 2, FEET + 1.5)
    ph = random.random() * math.tau
    fly.add([(f, x0 + math.sin(f * 0.08 + ph) * 0.4, z0 + math.cos(f * 0.11 + ph) * 0.25, 1, 0.5 + 0.5 * math.sin(f * 0.4 + ph)) for f in range(1, N + 1, 3)], (0.8, 1, 0.4))

# ---------- El platillo ----------
ufo = link(bpy.data.objects.new('ufo', None))


def place(f):
    """Dónde está el platillo: baja, flota, hace "¡glup!" y sale disparado."""
    if f <= 11:
        u = (f - 1) / 10
        e = 1 - (1 - u) ** 3
        return (2.4 * (1 - e), HOVER + 6 * (1 - e) + math.sin(f * 0.6) * 0.05, 1.0, 0.25 * (1 - e))
    if f < ZOOM:
        jig = 0.08 * math.sin((f - HIT) * 1.6) * math.exp(-(f - HIT) * 0.25) if f >= HIT else 0
        return (math.sin(f * 0.19) * 0.12, HOVER + math.sin(f * 0.27) * 0.12, 1.0 + jig, math.sin(f * 0.23) * 0.04)
    u = min(1.0, (f - ZOOM) / 7)
    e = u * u
    return (4.2 * e, HOVER + 4.6 * e, max(0.0001, 1 - 0.97 * e), -0.35 * e)


for f in range(1, N + 1):
    x, z, s, tilt = place(f)
    ufo.location = (x, -2.0, z)
    ufo.keyframe_insert('location', frame=f)
    ufo.scale = (s * (1 + (0.08 if HIT + 2 <= f <= HIT + 4 else 0)), 1, s * (1 - (0.06 if HIT + 2 <= f <= HIT + 4 else 0)))
    ufo.keyframe_insert('scale', frame=f)
    ufo.rotation_euler = (0, tilt, 0)
    ufo.keyframe_insert('rotation_euler', frame=f)


_n = [0]


def child(o, dy=0.0):
    _n[0] += 1
    o.parent = ufo
    o.location = (o.location.x, dy - 0.0004 * (_n[0] % 40), o.location.z)
    return o


def metal_mat(name, top, bottom, strength=1.0):
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = -1, 1
    el = ramp.color_ramp.elements
    el[0].color, el[1].color = (*bottom, 1), (*top, 1)
    e = el.new(0.62)
    e.color = (*[c * 0.55 + t * 0.45 for c, t in zip(bottom, top)], 1)
    e = el.new(0.8)
    e.color = (min(1, top[0] * 1.3), min(1, top[1] * 1.3), min(1, top[2] * 1.3), 1)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


# Resplandor de abajo, cuerpo, borde, cúpula con el extraterrestre y luces que corren.
bg_, bgem, bgam = glow_mat('ufoglow', (0.4, 1.0, 0.8), 4, power=2, edge=1 / 2.6)
g = child(disc('ufoglow', 2.6, (0, 0, -0.35), bg_), 0.3)
g.scale = (1.3, 0.55, 1)
key_alpha(bgam, [(1, 0.35), (BEAM, 0.5), (BEAM + 2, 1.0), (HIT, 1.0), (HIT + 1, 1.0), (HIT + 5, 0.4), (N, 0.4)])
body = child(disc('body', 1, (0, 0, 0), metal_mat('body', (0.6, 0.66, 0.75), (0.08, 0.09, 0.13), 1.0), verts=64), 0)
body.scale = (2.5, 0.55, 1)
under = child(disc('under', 1, (0, 0, -0.28), metal_mat('under', (0.25, 0.28, 0.35), (0.05, 0.05, 0.08), 1.0), verts=48), -0.02)
under.scale = (1.3, 0.32, 1)
rimm, _, _ = flat_mat('rim', (0.75, 0.82, 0.95), 1.4)
rim = child(disc('rim', 1, (0, 0, 0.02), rimm, verts=64), -0.01)
rim.scale = (2.52, 0.07, 1)
glass, gem2, gmix = flat_mat('dome', (0.35, 0.95, 1.0), 1.2)
dome = child(poly_mesh('dome', [(math.cos(a) * 1.15, 0.15 + math.sin(a) * 1.0) for a in [i / 24 * math.pi for i in range(25)]], 0, glass), 0.03)
gmix.inputs['Fac'].default_value = 0.42
hl, _, _ = flat_mat('domehl', (1, 1, 1), 2)
child(poly_mesh('domehl', [(-0.75, 0.55), (-0.55, 0.95), (-0.35, 1.05), (-0.5, 0.75)], 0, hl), -0.02)
alien, _, _ = flat_mat('alien', (0.35, 0.9, 0.35), 1.1)
child(poly_mesh('alien', [(math.cos(a) * 0.42, 0.62 + math.sin(a) * 0.36) for a in [i / 20 * math.tau for i in range(20)]], 0, alien), 0.05)
child(poly_mesh('neck', [(-0.16, 0.12), (0.16, 0.12), (0.12, 0.36), (-0.12, 0.36)], 0, alien), 0.05)
blk, _, _ = flat_mat('aeye', (0, 0, 0), 0)
for sx in (-1, 1):
    child(poly_mesh(f'aeye{sx}', [(sx * 0.18 + math.cos(a) * 0.12 * (1 + 0.3 * sx * math.cos(a)), 0.66 + math.sin(a) * 0.08) for a in [i / 14 * math.tau for i in range(14)]], 0, blk), 0.045)
lights = []
lmat = obj_color_mat('ufolight', 10)
for i in range(12):
    a = i / 12 * math.tau
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(math.cos(a) * 2.2, 0, math.sin(a) * 0.3 - 0.05))
    o = bpy.context.object
    o.data.materials.append(lmat)
    child(o, -0.05 if math.sin(a) < 0 else 0.05)
    cols = [(1, 0.3, 0.3), (1, 0.9, 0.3), (0.3, 1, 0.6), (0.4, 0.7, 1)]
    for f in range(1, N + 1, 2):
        lit = (f // 2 + i) % 4 == 0
        o.color = (*cols[i % 4], 1.0 if lit else 0.25)
        o.keyframe_insert('color', frame=f)

# ---------- Rayo tractor ----------
beam_root = link(bpy.data.objects.new('beamroot', None))
for f in range(1, N + 1):
    x, z, s, tilt = place(f)
    beam_root.location = (x * 0.4, -1.0, z - 0.45)
    beam_root.keyframe_insert('location', frame=f)
for f, s in [(1, 0.0001), (BEAM - 1, 0.0001), (BEAM + 3, 1.0), (HIT, 1.0), (HIT + 4, 0.0001), (N, 0.0001)]:
    beam_root.scale = (1, 1, s)
    beam_root.keyframe_insert('scale', frame=f)
top_w, bot_w = 1.2, 2.9
length = HOVER - 0.45 - (FEET - 0.3)
for i, (k, a) in enumerate([(1.0, 0.13), (0.75, 0.13), (0.5, 0.16), (0.25, 0.2)]):
    bm, bem, bmix = flat_mat(f'beam{i}', (0.45, 1.0, 0.85), 1.6)
    o = poly_mesh(f'beam{i}', [(-top_w * k, 0), (top_w * k, 0), (bot_w * k, -length), (-bot_w * k, -length)], 0.05 * i, bm)
    o.parent = beam_root
    bmix.inputs['Fac'].default_value = a
    key_strength(bem, [(f, 1.6 + 0.4 * math.sin(f * 0.9)) for f in range(1, N + 1, 3)])
# Charco de luz en el piso.
pm, pem, pam = glow_mat('pool', (0.45, 1.0, 0.85), 3, power=1.3, edge=1 / 3.2)
pool = disc('pool', 3.2, (0, 8.6, FEET - 0.35), pm)
pool.scale = (1.0, 0.25, 1)
key_alpha(pam, [(1, 0), (BEAM, 0), (BEAM + 3, 0.9), (HIT, 0.9), (HIT + 4, 0), (N, 0)])
# Anillos que suben por el rayo.
ringm = obj_color_mat('beamring', 5)
for k in range(10):
    f0 = BEAM + 2 + k * 3.4
    rr = ring(f'bring{k}', 1, 0.035, (0, -2.6, 0), ringm)
    fr = []
    for i in range(12):
        f = round(f0 + i)
        if f > HIT:
            break
        t = i / 11
        z = (FEET - 0.3) + t * length
        w = bot_w + (top_w - bot_w) * t
        x0, zu, *_ = place(f)
        rr.location = (x0 * 0.4 * t, rr.location.y, z)
        rr.keyframe_insert('location', frame=f)
        rr.scale = (w, w * 0.22, w)
        rr.keyframe_insert('scale', frame=f)
        fr.append(f)
    if fr:
        key_color(rr, (0.6, 1, 0.9), [(max(1, fr[0] - 1), 0), (fr[0], 0.8)] + [(f, 0.8 * (1 - (j / len(fr)) ** 2)) for j, f in enumerate(fr)] + [(fr[-1] + 1, 0)])
    else:
        key_color(rr, (0.6, 1, 0.9), [(1, 0)])
# Chispas y polvo que suben.
up = Particles('upspark', 'sphere', size=0.04, strength=10)
dust = Particles('dust', 'quad', size=0.05, strength=1.2)
for k in range(110):
    f0 = random.randint(BEAM + 2, HIT - 6)
    x0 = random.uniform(-2.4, 2.4)
    z0 = FEET - random.uniform(0, 0.4)
    life = random.randint(14, 26)
    fr = []
    for i in range(life):
        f = f0 + i
        if f > HIT + 2:
            break
        t = i / life
        z = z0 + t * (length + 0.2) * random.uniform(0.7, 1.0)
        frac = (z - FEET) / length
        x = x0 * (1 - 0.6 * max(0, min(1, frac))) + math.sin(i * 0.5 + k) * 0.12
        fr.append((f, x, z, 1, min(1, t * 4) * (1 - t * 0.5), i * 0.4))
    if len(fr) > 2:
        (up if k % 3 else dust).add(fr, (0.7, 1, 0.85) if k % 3 else (0.15, 0.3, 0.2))

# El "¡glup!": destello abajo del platillo.
fm, fem, fam = glow_mat('gulp', (0.7, 1.0, 0.9), 9, power=2.5, edge=1 / 2)
gulp = disc('gulp', 2, (0, -2.8, HOVER - 0.6), fm)
key_alpha(fam, [(1, 0), (HIT - 1, 0), (HIT, 1.0), (HIT + 3, 0.3), (HIT + 6, 0), (N, 0)])
gp = Particles('gulpspark', 'streak', size=0.08, strength=10)
for k in range(30):
    a = random.uniform(math.pi * 1.1, math.pi * 1.9)
    v = random.uniform(4, 9)
    gp.add(ballistic(HIT, 0, HOVER - 0.7, math.cos(a) * v, math.sin(a) * v, random.uniform(0.3, 0.6), gravity=-6, drag=2, size=(1.2, 0.2), end=N), (0.7, 1, 0.85))

# Sale disparado: estela y destello en el cielo.
trail = Particles('zoomtrail', 'streak', size=0.12, strength=8, aspect=(6, 0.3))
for f in range(ZOOM, ZOOM + 8):
    x, z, s, _ = place(f)
    trail.add([(f, x, z, max(0.2, s) * 1.6, 0.8), (f + 4, x, z, 0.3, 0.0)], (0.6, 1, 0.9))
tw, twem, twam = glow_mat('twinkle', (0.8, 1.0, 0.95), 10, power=2.5, edge=1.0)
for j, (sx, sz) in enumerate([(1.3, 0.04), (0.04, 1.3), (0.18, 0.18)]):
    o = disc(f'twinkle{j}', 1, (4.2, -3.0, HOVER + 4.6), tw)
    o.scale = (sx, sz, 1)
key_alpha(twam, [(1, 0), (ZOOM + 6, 0), (ZOOM + 8, 1.0), (ZOOM + 11, 0.5), (ZOOM + 14, 0), (N, 0)])

render(sys.argv[sys.argv.index('--out') + 1])
