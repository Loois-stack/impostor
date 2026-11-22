"""Utilidades comunes para las escenas de eliminación (Blender 5.3, Cycles en CPU).

Cámara ortográfica vertical: X a la derecha, Z hacia arriba, el objetivo (el jugador) en (0, 0).
Visible: X en [-5, 5], Z en [-10, 10]. Todo es emisivo (sin luces), así renderiza rápido.
"""
import math
import random
import sys

import bpy

FPS = 24
W, H = 540, 1080


def reset(frames, seed=7, samples=10):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 0
    sc.cycles.transparent_max_bounces = 64
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.04
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = int(sys.argv[sys.argv.index('--pct') + 1]) if '--pct' in sys.argv else 100
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, frames
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    world = bpy.data.worlds.new('w')
    world.color = (0, 0, 0)
    sc.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    cam.location = (0, -40, 0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 20
    cam.data.clip_end = 200
    sc.camera = cam
    return sc


def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, nt, out


def obj_color_mat(name, strength=4.0):
    """Material emisivo con color y transparencia por objeto (object.color RGBA), para partículas."""
    m, nt, out = node_mat(name)
    info = nt.nodes.new('ShaderNodeObjectInfo')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(info.outputs['Color'], em.inputs['Color'])
    nt.links.new(info.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def flat_mat(name, color, strength=1.0):
    """Material emisivo con su propia transparencia (devuelve el nodo mezcla para animarla)."""
    m, nt, out = node_mat(name)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs['Fac'].default_value = 1.0
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m, em, mix


def key_fac(mix, pairs):
    for f, v in pairs:
        mix.inputs['Fac'].default_value = v
        mix.inputs['Fac'].keyframe_insert('default_value', frame=f)


def key_strength(em, pairs):
    for f, v in pairs:
        em.inputs['Strength'].default_value = v
        em.inputs['Strength'].keyframe_insert('default_value', frame=f)


_eps = [0]


def nudge(o):
    """Separa un poquito cada objeto en profundidad: dos superficies transparentes en el mismo plano
    hacen que Cycles se salte una al azar (salen triángulos con orillas duras)."""
    _eps[0] += 1
    o.location.y += (_eps[0] % 60) * 0.0004
    return o


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def plane(name, w, h, loc, mat, rot_x=math.pi / 2):
    """Plano de frente a la cámara (en el plano XZ)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(rot_x, 0, 0))
    o = bpy.context.object
    o.name = name
    o.scale = (w, h, 1)
    o.data.materials.append(mat)
    return nudge(o)


def disc(name, r, loc, mat, verts=48):
    bpy.ops.mesh.primitive_circle_add(vertices=verts, radius=r, fill_type='NGON', location=loc, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return nudge(o)


def ring(name, r, thick, loc, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=thick, major_segments=64, minor_segments=8, location=loc, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return nudge(o)


def gradient_bg(name, stops, y=20, w=12, h=22, z=0.0):
    """Fondo vertical con degradado: stops = [(posición 0..1 de abajo a arriba, (r, g, b)), ...]."""
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], ramp.inputs['Fac'])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*col, 1)
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return plane(name, w, h, (0, y, z), m), em


def noise_cloud_mat(name, color, density=1.0, scale=2.0, detail=6.0, strength=1.0, edge=1.0):
    """Nube o humo: ruido que decide la transparencia. Devuelve (material, mapping, emisión, mezcla)."""
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = detail
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.75
    # Orillas suaves: degradado esférico del objeto.
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    mult = nt.nodes.new('ShaderNodeMath')
    mult.operation = 'MULTIPLY'
    dens = nt.nodes.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    dens.inputs[1].default_value = density
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    # Planos de tamaño 1 tienen coordenadas ±0.5: se escalan para que la orilla quede en transparente.
    sc_v = nt.nodes.new('ShaderNodeVectorMath')
    sc_v.operation = 'SCALE'
    sc_v.inputs['Scale'].default_value = edge
    nt.links.new(tc.outputs['Object'], sc_v.inputs[0])
    nt.links.new(sc_v.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(ramp.outputs['Color'], mult.inputs[0])
    nt.links.new(grad.outputs['Fac'], mult.inputs[1])
    nt.links.new(mult.outputs[0], dens.inputs[0])
    nt.links.new(dens.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m, mp, em, dens


class Particles:
    """Partículas simuladas en Python: cada una es un objeto con posición, tamaño y color con alfa animados."""

    def __init__(self, name, shape='sphere', size=0.08, strength=4.0, aspect=(3.0, 0.45), mesh=None):
        self.aspect = aspect
        self.mat = obj_color_mat(name + '_mat', strength)
        if mesh is not None:
            # Figura propia (ya de frente a la cámara, en el plano XZ).
            mesh.materials.append(self.mat)
            self.mesh, self.name, self.size, self.shape, self.count = mesh, name, size, shape, 0
            return
        if shape == 'sphere':
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
        else:
            # Plano de frente a la cámara (XZ): se aplica el giro a la malla.
            bpy.ops.mesh.primitive_plane_add(size=2, rotation=(math.pi / 2, 0, 0))
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        base = bpy.context.object
        base.data.materials.append(self.mat)
        self.mesh = base.data
        bpy.data.objects.remove(base)
        self.name = name
        self.size = size
        self.shape = shape
        self.count = 0

    def add(self, frames, color, step=1):
        """frames: lista de (frame, x, z, escala, alfa[, giro]) ya calculada."""
        o = bpy.data.objects.new(f'{self.name}{self.count}', self.mesh)
        self.count += 1
        link(o)
        first = frames[0][0]
        last = frames[-1][0]
        # Invisible antes de nacer y después de morir.
        if first > 1:
            o.color = (*color, 0)
            o.keyframe_insert('color', frame=first - 1)
            o.scale = (0, 0, 0)
            o.keyframe_insert('scale', frame=first - 1)
        depth = -1 - random.random() * 0.5
        for i, fr in enumerate(frames):
            if i % step and fr is not frames[-1]:
                continue
            f, x, z, s, a = fr[:5]
            spin = fr[5] if len(fr) > 5 else 0
            o.location = (x, depth, z)
            o.keyframe_insert('location', frame=f)
            sx = s * self.size
            if self.shape == 'streak':
                # Rayita alargada en la dirección en que se mueve.
                nx = frames[min(i + 1, len(frames) - 1)]
                px = frames[max(i - 1, 0)]
                ang = math.atan2(nx[2] - px[2], nx[1] - px[1]) if nx is not px else 0.0
                o.scale = (sx * self.aspect[0], 1, sx * self.aspect[1])
                o.rotation_euler = (0, -ang, 0)
                o.keyframe_insert('rotation_euler', frame=f)
            else:
                o.scale = (sx, sx, sx)
                if spin:
                    o.rotation_euler = (spin * 0.7, spin * 0.3, spin)
                    o.keyframe_insert('rotation_euler', frame=f)
            o.keyframe_insert('scale', frame=f)
            o.color = (*color, a)
            o.keyframe_insert('color', frame=f)
        o.color = (*color, 0)
        o.keyframe_insert('color', frame=last + 1)
        return o


def ballistic(f0, x, z, vx, vz, life, gravity=-12.0, drag=0.6, size=(1.0, 0.2), alpha=(1.0, 0.0), spin=0.0, end=None):
    """Trayectoria con gravedad y freno; tamaño y alfa van de inicio a fin."""
    out = []
    n = max(2, int(life * FPS))
    dt = 1 / FPS
    rot = 0.0
    for i in range(n + 1):
        f = f0 + i
        if end and f > end:
            break
        t = i / n
        out.append((f, x, z, size[0] + (size[1] - size[0]) * t, alpha[0] + (alpha[1] - alpha[0]) * t, rot))
        vx *= 1 - drag * dt
        vz = vz * (1 - drag * dt) + gravity * dt
        x += vx * dt
        z += vz * dt
        rot += spin * dt
    return out


def hsv(h, s, v):
    import colorsys
    return colorsys.hsv_to_rgb(h % 1, s, v)


def render(out_dir):
    sc = bpy.context.scene
    sc.render.filepath = out_dir.rstrip('/') + '/f'
    only = None
    # Para depurar: --only prefijo1,prefijo2 deja solo esos objetos (y la cámara).
    if '--only' in sys.argv:
        keep = sys.argv[sys.argv.index('--only') + 1].split(',')
        for o in sc.objects:
            if o.type != 'CAMERA' and not any(o.name.startswith(k) for k in keep):
                o.hide_render = True
    if '--frames' in sys.argv:
        only = [int(x) for x in sys.argv[sys.argv.index('--frames') + 1].split(',')]
    if only:
        for f in only:
            sc.frame_set(f)
            sc.render.filepath = f'{out_dir.rstrip("/")}/f{f:04d}'
            bpy.ops.render.render(write_still=True)
    else:
        bpy.ops.render.render(animation=True)


def glow_mat(name, color, strength=3.0, power=2.0, edge=1.0):
    """Resplandor suave y redondo (transparente en la orilla). Devuelve (material, emisión, multiplicador de alfa)."""
    m, nt, out = node_mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sc_v = nt.nodes.new('ShaderNodeVectorMath')
    sc_v.operation = 'SCALE'
    sc_v.inputs['Scale'].default_value = edge
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = power
    am = nt.nodes.new('ShaderNodeMath')
    am.operation = 'MULTIPLY'
    am.inputs[1].default_value = 1.0
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tc.outputs['Object'], sc_v.inputs[0])
    nt.links.new(sc_v.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Fac'], pw.inputs[0])
    nt.links.new(pw.outputs[0], am.inputs[0])
    nt.links.new(am.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m, em, am


def key_alpha(am, pairs):
    for f, v in pairs:
        am.inputs[1].default_value = v
        am.inputs[1].keyframe_insert('default_value', frame=f)


def key_color(o, rgb, pairs):
    """Anima el color y alfa de un objeto con material obj_color_mat: pairs = [(frame, alfa[, (r, g, b)]), ...]."""
    for p in pairs:
        f, a = p[0], p[1]
        col = p[2] if len(p) > 2 else rgb
        o.color = (*col, a)
        o.keyframe_insert('color', frame=f)


def curve_obj(name, pts, width, mat, y=-2.0, taper=None, res=2):
    """Línea gruesa (curva con bisel) que pasa por los puntos (x, z). taper: grosor relativo por punto."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = width
    cu.bevel_resolution = res
    cu.bevel_factor_mapping_end = 'SPLINE'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, (p, (x, z)) in enumerate(zip(sp.points, pts)):
        p.co = (x, y, z, 1)
        if taper:
            p.radius = taper(i / max(1, len(pts) - 1))
    o = nudge(link(bpy.data.objects.new(name, cu)))
    o.data.materials.append(mat)
    return o


def key_grow(o, pairs):
    """Hace crecer una curva a lo largo de su recorrido: pairs = [(frame, 0..1), ...]."""
    for f, v in pairs:
        o.data.bevel_factor_end = v
        o.data.keyframe_insert('bevel_factor_end', frame=f)


def poly_mesh(name, pts, y, mat):
    """Polígono plano (puede ser cóncavo) con los puntos (x, z), de frente a la cámara."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, z) for x, z in pts], [], [list(range(len(pts)))])
    me.update()
    o = nudge(link(bpy.data.objects.new(name, me)))
    o.data.materials.append(mat)
    return o


def fractal(p0, p1, rough=0.25, levels=5):
    """Línea quebrada entre dos puntos (desplazamiento del punto medio): rayos, grietas, arcos."""
    pts = [p0, p1]
    for lvl in range(levels):
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dz = b[0] - a[0], b[1] - a[1]
            ln = math.hypot(dx, dz) or 1
            off = random.gauss(0, 1) * rough * ln
            new += [(mx - dz / ln * off, mz + dx / ln * off), b]
        pts = new
    return pts


def mountains(name, x0, x1, base, top, rough, y, mat, n=40):
    """Silueta de cerros con picos (polígono cerrado desde la base)."""
    pts = [(x0, base)]
    h = (top[0] + top[1]) / 2
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        h += random.gauss(0, rough)
        h = min(top[1], max(top[0], h))
        pts.append((x, h))
    pts.append((x1, base))
    return poly_mesh(name, pts, y, mat)


def flat_mesh(name, polys):
    """Malla plana en XZ con varios polígonos [[(x, z), ...], ...] (para dulces, estrellas, etc.)."""
    verts, faces = [], []
    for poly in polys:
        faces.append(list(range(len(verts), len(verts) + len(poly))))
        verts += [(x, 0, z) for x, z in poly]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    return me


def star_points(n, r_out, r_in, rot=0.0, jitter=0.0):
    """Estrella de n picos (para los golpes de cómic)."""
    pts = []
    for i in range(2 * n):
        r = (r_out if i % 2 == 0 else r_in) * (1 + random.uniform(-jitter, jitter))
        a = rot + i * math.pi / n
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


def text_obj(name, body, size, loc, mat, font=None, extrude=0.0):
    """Texto de frente a la cámara, centrado."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    if font:
        cu.font = bpy.data.fonts.load(font, check_existing=True)
    o = nudge(link(bpy.data.objects.new(name, cu)))
    o.location = (loc[0], loc[1] + o.location.y, loc[2])
    o.rotation_euler = (math.pi / 2, 0, 0)
    o.data.materials.append(mat)
    return o
