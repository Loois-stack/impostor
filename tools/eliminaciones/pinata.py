"""Eliminación 3: PIÑATA (Piñatazo). Fiesta de noche con papel picado, foquitos y luces desenfocadas;
el jugador cuelga de una cuerda como piñata y se mece. Un palo forrado de colores le pega dos veces
(cuadros 10 y 22, "¡PUM!" y "¡PAS!" de cómic) y al tercer golpe (cuadro 34, "¡CRAC!") revienta:
la cuerda se rompe, salen confeti, tiras de papel, dulces envueltos, serpentinas y chispas doradas."""
import math
import random
import sys

import bpy

DIR = sys.argv[sys.argv.index('--dir') + 1]
sys.path.insert(0, DIR)
from common import (Particles, ballistic, curve_obj, disc, flat_mat, flat_mesh, glow_mat, gradient_bg, hsv, key_alpha, key_color, link, node_mat, nudge, obj_color_mat, plane, reset, render, ring, star_points, text_obj)

N = 72
HITS = (10, 22)
POP = 34
AV = 1.3  # radio del avatar en unidades de la escena
FONT = f'{DIR}/BebasNeue.ttf'
sc = reset(N, seed=5)

gradient_bg('bg', [(0.0, (0.02, 0.003, 0.02)), (0.45, (0.09, 0.01, 0.06)), (0.8, (0.2, 0.035, 0.07)), (1.0, (0.3, 0.07, 0.05))])
lm, lem, lam = glow_mat('light', (1.0, 0.55, 0.25), 1.0, power=1.6, edge=1 / 7)
disc('light', 7, (0, 12, 2), lm)
key_alpha(lam, [(1, 0.35), (POP, 0.35), (POP + 2, 0.9), (POP + 16, 0.45), (N, 0.4)])
# Haz de luz sobre la piñata.
bm, bem, bam = glow_mat('beam', (1.0, 0.85, 0.6), 1.2, power=1.2, edge=1.0)
b = disc('beam', 1, (0, 11, 3.5), bm)
b.scale = (2.2, 8.0, 1)
key_alpha(bam, [(1, 0.22), (POP, 0.22), (POP + 1, 0.5), (POP + 10, 0.15), (N, 0.15)])

# Luces desenfocadas al fondo.
for k in range(16):
    col = random.choice([(1.0, 0.6, 0.2), (1.0, 0.3, 0.5), (0.4, 0.6, 1.0), (1.0, 0.85, 0.3), (0.6, 1.0, 0.5)])
    r = random.uniform(0.35, 1.0)
    gm, gem, gam = glow_mat(f'bokeh{k}', col, 1.4, power=0.5, edge=1 / r)
    x, z = random.uniform(-5, 5), random.uniform(-9, 5)
    o = disc(f'bokeh{k}', r, (x, 13, z), gm)
    for f, dz in [(1, 0), (N, random.uniform(0.3, 0.9))]:
        o.location = (x, o.location.y, z + dz)
        o.keyframe_insert('location', frame=f)
    ph = random.random() * math.tau
    key_alpha(gam, [(f, 0.12 + 0.08 * math.sin(f * 0.2 + ph)) for f in range(1, N + 1, 6)])


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
    em.inputs['Strength'].default_value = 0.85
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    nt.links.new(vo.outputs['Distance'], th.inputs[0])
    nt.links.new(th.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


# Papel picado: dos tiras de banderitas que se mecen, con su hilo.
COLORS = [hsv(h, 0.9, 1) for h in (0.0, 0.08, 0.15, 0.33, 0.5, 0.6, 0.8, 0.92)]
thread = obj_color_mat('thread', 0.6)
for row, (z0, sag) in enumerate([(9.2, 0.8), (7.6, 1.0)]):
    n = 9
    pts = [(-5.6 + 11.2 * i / 20, z0 - sag * math.sin(i / 20 * math.pi)) for i in range(21)]
    o = curve_obj(f'thread{row}', pts, 0.012, thread, y=6 + row - 0.1)
    key_color(o, (0.9, 0.85, 0.75), [(1, 1)])
    for i in range(n):
        u = (i + 0.5) / n
        x = -5.4 + u * 10.8
        z = z0 - sag * math.sin(u * math.pi)
        m = picado_mat(f'flag{row}_{i}', COLORS[(i + row * 3) % len(COLORS)])
        o = plane(f'flag{row}_{i}', 0.82, 1.05, (x, 6 + row, z - 0.6), m)
        for f in range(1, N + 1, 6):
            o.rotation_euler = (math.pi / 2, math.sin(f * 0.25 + i + row) * 0.12, 0)
            o.keyframe_insert('rotation_euler', frame=f)

# Foquitos de colores en otra tira (titilan y brillan más al reventar).
bulbs = Particles('bulb', 'sphere', size=0.09, strength=7)
glows = Particles('bulbglow', 'sphere', size=0.32, strength=2)
pts = [(-5.6 + 11.2 * i / 20, 6.0 - 0.8 * math.sin(i / 20 * math.pi)) for i in range(21)]
o = curve_obj('bulbline', pts, 0.012, thread, y=5.2)
key_color(o, (0.5, 0.45, 0.4), [(1, 1)])
for i in range(12):
    u = (i + 0.5) / 12
    x = -5.6 + 11.2 * u
    z = 6.0 - 0.8 * math.sin(u * math.pi) - 0.22
    col = [(1, 0.35, 0.3), (1, 0.85, 0.3), (0.4, 1, 0.5), (0.4, 0.7, 1), (1, 0.5, 1)][i % 5]
    ph = i * 1.7
    bulbs.add([(f, x, z, 1, 0.75 + 0.25 * math.sin(f * 0.5 + ph)) for f in range(1, N + 1, 2)], col)
    glows.add([(f, x, z, 1 + (0.5 if POP <= f < POP + 8 else 0), 0.18 + 0.1 * math.sin(f * 0.5 + ph) + (0.25 if POP <= f < POP + 8 else 0)) for f in range(1, N + 1, 2)], col)


# ---------- La cuerda (sigue al avatar, que se mece) ----------
def avatar_rot(f):
    """Igual que en la app: se mece y da un tirón con cada golpe (grados, a favor del reloj)."""
    t = (f - 1) / 24
    h1, h2 = HITS[0] / 24, HITS[1] / 24
    return math.sin(t * 7) * 14 + (18 if abs(t - h1) < 0.1 or abs(t - h2) < 0.1 else 0)


rope_mat = obj_color_mat('rope', 1.0)
cu = bpy.data.curves.new('rope', 'CURVE')
cu.dimensions = '3D'
cu.bevel_depth = 0.045
sp = cu.splines.new('POLY')
sp.points.add(1)
sp.points[0].co = (0, 1.5, 10.6, 1)
rope = nudge(link(bpy.data.objects.new('rope', cu)))
rope.data.materials.append(rope_mat)
key_color(rope, (0.62, 0.46, 0.26), [(1, 1)])
# Pedacito de piñata que se queda colgando de la cuerda rota.
piece = Particles('piece', 'mesh', size=0.5, strength=1.2, mesh=flat_mesh('piece', [[(-0.5, 0), (0.5, 0), (0, -1.1)], [(-0.55, 0.05), (0.55, 0.05), (0.55, -0.12), (-0.55, -0.12)]]))
piece_frames = []
for f in range(1, N + 1):
    if f < POP:
        a = math.radians(avatar_rot(f))
        end = (AV * math.sin(a), AV * math.cos(a) - 0.05)
    else:
        # Se rompe: el pedazo de arriba rebota hacia arriba y queda columpiándose.
        u = f - POP
        swing = math.sin(u * 0.45) * 0.6 * math.exp(-u * 0.05)
        lift = 4.6 * (1 - math.exp(-u * 0.5))
        end = (0.35 * math.sin(u * 0.3) + swing, AV + lift + 0.4 * math.sin(u * 0.9) * math.exp(-u * 0.1))
    sp.points[1].co = (end[0], 1.5, end[1], 1)
    sp.points[1].keyframe_insert('co', frame=f)
    if f >= POP:
        piece_frames.append((f, end[0], end[1], 1, 1, math.sin((f - POP) * 0.45) * 0.4))
piece.add(piece_frames, (0.95, 0.2, 0.55))

# ---------- El palo (forrado con cinta de colores) ----------
def stick_mat():
    m, nt, out = node_mat('stick')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.bands_direction = 'DIAGONAL'
    wv.inputs['Scale'].default_value = 0.9
    wv.inputs['Distortion'].default_value = 0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.interpolation = 'CONSTANT'
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (1.0, 0.12, 0.2, 1)
    el[1].position, el[1].color = 0.75, (0.15, 0.45, 1.0, 1)
    e = el.new(0.25)
    e.color = (1.0, 0.95, 0.9, 1)
    e = el.new(0.5)
    e.color = (1.0, 0.8, 0.1, 1)
    # Sombra en las orillas para que se vea redondo.
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ab = nt.nodes.new('ShaderNodeMath')
    ab.operation = 'ABSOLUTE'
    shade = nt.nodes.new('ShaderNodeMapRange')
    shade.inputs['From Min'].default_value, shade.inputs['From Max'].default_value = 0.0, 0.24
    shade.inputs['To Min'].default_value, shade.inputs['To Max'].default_value = 1.15, 0.35
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ab.inputs[0])
    nt.links.new(ab.outputs[0], shade.inputs['Value'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(shade.outputs['Result'], em.inputs['Strength'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


smat = stick_mat()
L = 9.6
for side, hits in [(-1, HITS), (1, (POP,))]:
    piv = link(bpy.data.objects.new(f'pivot{side}', None))
    piv.location = (side * 8.5, -2.6, -4.5)
    me = flat_mesh(f'stick{side}', [[(0, -0.24), (-side * L, -0.24), (-side * (L + 0.16), 0), (-side * L, 0.24), (0, 0.24)]])
    st = nudge(link(bpy.data.objects.new(f'stick{side}', me)))
    st.data.materials.append(smat)
    st.parent = piv
    contact = math.degrees(math.atan2(4.5, 8.5))
    keys = [(1, -55)]
    for h in hits:
        keys += [(h - 6, -55), (h - 3, -66), (h - 1, contact - 9), (h, contact), (h + 1, contact - 7), (h + 3, contact - 16), (h + 9, -58)]
    keys.append((N, -58))
    for f, deg in keys:
        # El de la izquierda sube girando contra el reloj (Y negativo) y el de la derecha al revés.
        piv.rotation_euler = (0, math.radians(deg) * side, 0)
        piv.keyframe_insert('rotation_euler', frame=f)
# Desenfoque de movimiento de verdad: el palo, el confeti y los dulces se barren al moverse.
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.6

# ---------- Golpes de cómic: estrella y letrero ----------
red = flat_mat('comic_red', (1.0, 0.18, 0.1), 1.3)[0]
yel = flat_mat('comic_yel', (1.0, 0.88, 0.15), 1.4)[0]
ink = flat_mat('comic_ink', (0.18, 0.02, 0.22), 1.0)[0]
whi = flat_mat('comic_white', (1, 1, 1), 1.2)[0]
for i, (f0, word, x, z, size, rot) in enumerate([(HITS[0], '¡PUM!', -2.5, 3.0, 1.0, 0.25), (HITS[1], '¡PAS!', 2.6, 2.7, 1.0, -0.2), (POP, '¡CRAC!', 0.1, 4.4, 1.45, 0.08)]):
    root = link(bpy.data.objects.new(f'comic{i}', None))
    root.location = (x, -3.0, z)
    parts = [
        (flat_mesh(f'cw{i}', [star_points(13, 1.72, 1.12, 0.1, 0.12)]), whi, 0.02),
        (flat_mesh(f'cr{i}', [star_points(13, 1.6, 1.02, 0.1, 0.12)]), red, -0.01),
        (flat_mesh(f'cy{i}', [star_points(13, 1.25, 0.86, 0.35, 0.1)]), yel, -0.04),
    ]
    for me, mat, dy in parts:
        o = link(bpy.data.objects.new(me.name, me))
        o.data.materials.append(mat)
        o.location = (0, dy, 0)
        o.parent = root
    t = text_obj(f'word{i}', word, 0.95, (0, -0.08, -0.05), ink, FONT)
    t.parent = root
    t.location = (0, -0.08, -0.05)
    for f, s in [(1, 0), (f0 - 1, 0), (f0, 1.3), (f0 + 2, 0.95), (f0 + 4, 1.05), (f0 + 9, 1.0), (f0 + 11, 0)]:
        root.scale = (s * size, s * size, s * size)
        root.keyframe_insert('scale', frame=f)
    for f, r in [(f0, rot - 0.15), (f0 + 11, rot + 0.1)]:
        root.rotation_euler = (0, r, 0)
        root.keyframe_insert('rotation_euler', frame=f)

# Destellos de los golpes y chispitas.
star = Particles('hitspark', 'streak', size=0.12, strength=9)
for hi, f0 in enumerate(HITS + (POP,)):
    rad = 3.4 if f0 == POP else 1.6
    gm, gem, gam = glow_mat(f'hit{hi}', (1.0, 0.95, 0.65), 8, power=3, edge=1 / rad)
    disc(f'hit{hi}', rad, (0, -2.5, 0), gm)
    key_alpha(gam, [(1, 0), (f0 - 1, 0), (f0, 1.0), (f0 + 4, 0), (N, 0)])
    for k in range(12 if f0 != POP else 0):
        a = k / 12 * math.tau + random.random() * 0.3
        star.add(ballistic(f0, -0.8, 0.3, math.cos(a) * 9, math.sin(a) * 9, 0.25, gravity=0, drag=4, size=(1.3, 0.3)), (1, 0.95, 0.7))

# Onda dorada del reventón.
rm, rem, rmix = flat_mat('wave', (1.0, 0.8, 0.3), 5)
w = ring('wave', 1, 0.016, (0, -3, 0), rm)
for f, s, a in [(1, 0.01, 0), (POP - 1, 0.01, 0), (POP, 0.3, 1), (POP + 7, 4.0, 0.5), (POP + 14, 7, 0), (N, 7, 0)]:
    w.scale = (s, s, s)
    w.keyframe_insert('scale', frame=f)
    rmix.inputs['Fac'].default_value = a
    rmix.inputs['Fac'].keyframe_insert('default_value', frame=f)

# ---------- Lo que sale de la piñata ----------
conf = Particles('conf', 'quad', size=0.11, strength=2.0)
for k in range(260):
    a = random.uniform(0, math.tau)
    v = random.uniform(5, 15)
    path = ballistic(POP, random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), math.cos(a) * v, math.sin(a) * v + 4, random.uniform(1.2, 1.6), gravity=-9, drag=2.6, size=(1.0, 0.85), alpha=(1.0, 0.9), spin=random.uniform(-14, 14), end=N)
    conf.add(path, random.choice(COLORS))
# Tiras de papel de china (el forro de la piñata).
strip = Particles('strip', 'mesh', size=0.2, strength=1.8, mesh=flat_mesh('strip', [[(-1, -0.2), (1, -0.2), (1, 0.2), (-1, 0.2)]]))
for k in range(70):
    a = random.uniform(0, math.tau)
    v = random.uniform(4, 11)
    path = ballistic(POP, random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), math.cos(a) * v, math.sin(a) * v + 3, random.uniform(1.3, 1.6), gravity=-6, drag=3.2, size=(1.0, 1.0), alpha=(1.0, 1.0), spin=random.uniform(-9, 9), end=N)
    strip.add(path, random.choice(COLORS))
# Dulces envueltos (más pesados: caen más rápido y dan vueltas).
candy_shape = flat_mesh('candy', [[(math.cos(i / 10 * math.tau), math.sin(i / 10 * math.tau)) for i in range(10)], [(-0.85, 0), (-1.9, 0.75), (-1.9, -0.75)], [(0.85, 0), (1.9, 0.75), (1.9, -0.75)]])
candy = Particles('candy', 'mesh', size=0.15, strength=2.4, mesh=candy_shape)
for k in range(52):
    a = random.uniform(0.15, math.pi - 0.15)
    v = random.uniform(6, 12)
    path = ballistic(POP, random.uniform(-0.3, 0.3), 0, math.cos(a) * v, math.sin(a) * v, random.uniform(1.0, 1.5), gravity=-20, drag=0.5, size=(1.0, 1.0), alpha=(1.0, 1.0), spin=random.uniform(-9, 9), end=N)
    candy.add(path, random.choice([(1, 0.2, 0.3), (1, 0.85, 0.1), (0.2, 0.9, 0.5), (0.3, 0.6, 1), (1, 1, 1), (1, 0.45, 0.1)]))
# Serpentinas: rizos que caen despacio y se mecen.
for k in range(12):
    col = COLORS[k % len(COLORS)]
    m = obj_color_mat(f'serp{k}', 1.8)
    turns = random.uniform(2.5, 4)
    pts = []
    for j in range(60):
        t = j / 59 * turns * math.tau
        pts.append((0.28 * math.cos(t) + 0.02 * t, -0.11 * t + 0.28 * math.sin(t)))
    o = curve_obj(f'serp{k}', pts, 0.028, m, y=-1.6 - k * 0.01)
    key_color(o, col, [(1, 1)])
    a = random.uniform(0.3, math.pi - 0.3)
    v = random.uniform(5, 8)
    path = ballistic(POP, 0, 0.4, math.cos(a) * v, math.sin(a) * v, (N - POP) / 24, gravity=-4, drag=2.4, size=(1, 1), alpha=(1, 1), end=N)
    for f, x, z, s, al, r in path[::2] + [path[-1]]:
        o.location = (x, o.location.y, z)
        o.keyframe_insert('location', frame=f)
        o.rotation_euler = (0, math.sin(f * 0.25 + k) * 0.5, 0)
        o.keyframe_insert('rotation_euler', frame=f)
    o.scale = (0, 0, 0)
    o.keyframe_insert('scale', frame=POP - 1)
    o.scale = (1, 1, 1)
    o.keyframe_insert('scale', frame=POP + 3)
# Chispas doradas.
gold = Particles('gold', 'streak', size=0.1, strength=10)
for k in range(80):
    a = random.uniform(0, math.tau)
    v = random.uniform(9, 18)
    gold.add(ballistic(POP, 0, 0, math.cos(a) * v, math.sin(a) * v, random.uniform(0.35, 0.7), gravity=-10, drag=2.5, size=(1.3, 0.1), end=N), (1, 0.85, 0.4))

render(sys.argv[sys.argv.index('--out') + 1])
