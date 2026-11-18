import bpy, bmesh, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/b/room.png'
SAMPLES = int(sys.argv[sys.argv.index('--') + 2]) if '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 2 else 32
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
COLL = S.collection

# ---------- materials ----------
def mat(name, rgb, rough=.5, metal=0., emit=None, estr=0., alpha=1., trans=0., noise=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    if alpha < 1: b.inputs['Alpha'].default_value = alpha; m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    if trans: b.inputs['Transmission Weight'].default_value = trans
    if noise:  # subtle speckle for vinyl floors
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = noise; r = nt.nodes.new('ShaderNodeValToRGB')
        r.color_ramp.elements[0].color = (*[c * .9 for c in rgb], 1); r.color_ramp.elements[1].color = (*[min(1, c * 1.06) for c in rgb], 1)
        nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    return m
def img_mat(name, path, estr=2.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path)
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Emission Strength'].default_value = estr; b.inputs['Roughness'].default_value = .15
    return m
WALL = mat('wall', (.78, .78, .76), .8, noise=40); CAP = mat('cap', (.32, .34, .37), .6)
FLOOR = mat('floor', (.30, .33, .36), .28, noise=220); HALL = mat('hall', (.40, .42, .44), .25, noise=160)
BASE = mat('baseboard', (.42, .44, .47), .5)
CHROME = mat('chrome', (.86, .87, .88), .18, 1.); STEEL = mat('steel', (.62, .64, .66), .32, 1.)
PLW = mat('plastic_white', (.88, .89, .90), .38); PLG = mat('plastic_grey', (.42, .44, .47), .45); PLD = mat('plastic_dark', (.08, .085, .09), .4)
MATT = mat('mattress', (.10, .12, .16), .45); SHEET = mat('sheet', (.93, .94, .95), .85); BLANK = mat('blanket', (.06, .20, .55), .9)
CURT = mat('curtain', (.02, .28, .34), .9); GLASS = mat('bag', (.85, .92, .95), .05, trans=.85)
RED = mat('sharps', (.65, .06, .06), .4); YEL = mat('yellow', (.85, .7, .1), .4); GRN = mat('o2', (.1, .5, .2), .4); BLK = mat('black', (.02, .02, .02), .5)
SCREEN = img_mat('screen', '/tmp/b/screen.png')
WOOD = mat('wood', (.48, .33, .2), .5); FABRIC = mat('fabric', (.03, .07, .22), .85)

# ---------- helpers ----------
def obj_from(name, m):
    o = bpy.context.active_object; o.name = name
    if m: o.data.materials.append(m)
    return o
def box(name, size, loc, m, bev=.008, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=[math.radians(a) for a in rot]); o = obj_from(name, m)
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    if bev:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bev; b.segments = 3; b.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth_by_angle() if hasattr(bpy.ops.object, 'shade_smooth_by_angle') else None
    return o
def cyl(name, r, depth, loc, m, rot=(0, 0, 0), v=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=[math.radians(a) for a in rot], vertices=v); o = obj_from(name, m)
    bpy.ops.object.shade_smooth(); return o
def tube(name, a, b, r, m):
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=16); o = obj_from(name, m)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y'); bpy.ops.object.shade_smooth(); return o
def sphere(name, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=24, ring_count=12); o = obj_from(name, m); o.scale = scale; bpy.ops.object.shade_smooth(); return o

def build_room(BH, SH, W=3.8, D=3.8):
    # ---------- room shell ----------
    X0, X1, Y0, Y1, HT, LOW, T = -W / 2, W / 2, -D / 2, D / 2, 2.7, .95, .12
    box('floor_room', (X1 - X0, Y1 - Y0, .02), (0, 0, -.01), FLOOR, 0)
    for x in [i * .6 for i in range(-3, 4)]: box('seam', (.004, Y1 - Y0, .002), (x, 0, .001), BASE, 0)
    for x in [i * .6 for i in range(-4, 5)]:
        if Y0 < x < Y1: box('seam', (X1 - X0, .004, .002), (0, x, .001), BASE, 0)
    box('wall_right', (T, Y1 - Y0, SH), (X1 + T / 2, 0, SH / 2), WALL, .004); box('cap_right', (T + .002, Y1 - Y0, .02), (X1 + T / 2, 0, SH), CAP, 0)
    box('wall_back', (X1 - X0 + T, T, BH), (0, Y1 + T / 2, BH / 2), WALL, .004); box('cap_back', (X1 - X0 + T, T + .002, .02), (0, Y1 + T / 2, BH), CAP, 0)
    box('wall_left', (T, Y1 - Y0, SH), (X0 - T / 2, 0, SH / 2), WALL, .004); box('cap_left', (T + .002, Y1 - Y0, .02), (X0 - T / 2, 0, SH), CAP, 0)
    for a, b in [(X0, -.55), (.75, X1)]:  # front wall with a wide glass door opening
        box('wall_front', (b - a, T, LOW), ((a + b) / 2, Y0 - T / 2, LOW / 2), WALL, .004); box('cap_front', (b - a, T + .002, .02), ((a + b) / 2, Y0 - T / 2, LOW), CAP, 0)
    box('door_track', (1.3, .05, .03), (.1, Y0 - T / 2, .01), STEEL, 0)
    for name, (a, b, y, xw) in {'bb_back': (X0, X1, Y1 - .005, None), 'bb_left': (Y0, Y1, None, X0 + .005)}.items():
        if y: box(name, (b - a, .012, .1), ((a + b) / 2, y, .05), BASE, 0)
        else: box(name, (.012, b - a, .1), (xw, (a + b) / 2, .05), BASE, 0)
    # room number plate and call light by the door
    
    # ---------- headwall ----------
    HY = Y1 - .03
    box('headwall', (2.6, .06, .42), (-.2, HY, 1.42), mat('headwall', (.20, .24, .30), .4), .01)
    box('headwall_trim', (2.6, .065, .03), (-.2, HY, 1.64), PLG, .004); box('headwall_trim2', (2.6, .065, .03), (-.2, HY, 1.2), PLG, .004)
    for i, (col, x) in enumerate([(GRN, -1.15), (YEL, -.98), (PLW, -.81), (GRN, .55), (PLW, .72)]):
        cyl('gas_ring', .045, .02, (x, HY - .035, 1.5), col, rot=(90, 0, 0)); cyl('gas_port', .022, .03, (x, HY - .045, 1.5), CHROME, rot=(90, 0, 0))
    for x in [-.55, -.35, .2, .35]:
        box('outlet', (.08, .015, .12), (x, HY - .035, 1.33), PLW, .004); box('slot', (.012, .016, .03), (x - .015, HY - .043, 1.35), BLK, 0); box('slot', (.012, .016, .03), (x + .015, HY - .043, 1.35), BLK, 0)
    # suction regulator and canister
    box('regulator', (.07, .06, .09), (-.81, HY - .07, 1.42), PLW, .006); cyl('canister', .07, .22, (-.81, HY - .1, 1.2), GLASS); cyl('can_lid', .075, .03, (-.81, HY - .1, 1.32), PLG)
    # wall diagnostic set: otoscope and ophthalmoscope
    box('diag_base', (.32, .05, .1), (.98, HY - .03, 1.72), PLG, .01)
    for x in (.9, 1.06): cyl('diag_handle', .018, .16, (x, HY - .07, 1.66), PLD); cyl('diag_head', .025, .05, (x, HY - .07, 1.77), PLW)
    # BP cuff basket
    box('bp_basket', (.22, .1, .12), (1.3, HY - .06, 1.5), STEEL, .006); box('bp_cuff', (.18, .08, .06), (1.3, HY - .06, 1.54), mat('cuff', (.15, .2, .35), .7), .01)
    
    # ---------- monitor on an articulating arm ----------
    box('arm_mount', (.12, .06, .2), (.55, HY - .03, 1.72), STEEL, .01)
    tube('arm1', (.55, HY - .06, 1.72), (.35, HY - .45, 1.72), .03, STEEL); tube('arm2', (.35, HY - .45, 1.72), (.15, HY - .55, 1.68), .03, STEEL)
    mon = box('monitor', (.5, .06, .36), (.1, HY - .6, 1.62), PLG, .02, rot=(-12, 0, -12))
    scr = box('screen', (.44, .01, .3), (.1, HY - .635, 1.62), SCREEN, 0, rot=(-12, 0, -12))
    bpy.ops.object.select_all(action='DESELECT'); scr.select_set(True); bpy.context.view_layer.objects.active = scr
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1.0); bpy.ops.object.mode_set(mode='OBJECT')
    me = scr.data; uv = me.uv_layers.active.data
    for poly in me.polygons:  # map the front face to the full screen image, from the vertex positions
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co; uv[li].uv = (co.x / .44 + .5, co.z / .3 + .5)
    
    # ---------- ED stretcher ----------
    SX, SY = -.25, .35  # centre; head toward the back wall
    for dx in (-.3, .3):
        for dy in (-.75, .85):
            cyl('caster', .065, .045, (SX + dx, SY + dy, .07), PLD, rot=(0, 90, 0)); cyl('hub', .02, .05, (SX + dx, SY + dy, .07), CHROME, rot=(0, 90, 0))
            box('fork', (.03, .05, .1), (SX + dx, SY + dy, .14), STEEL, .004)
    box('base_shroud', (.62, 1.75, .14), (SX, SY + .05, .23), PLW, .04)
    box('base_strip', (.63, 1.76, .02), (SX, SY + .05, .17), PLG, .006)
    for dy in (-.35, .45): box('column', (.24, .2, .32), (SX, SY + dy, .44), PLG, .02)
    box('frame', (.8, 2.05, .07), (SX, SY + .05, .63), STEEL, .01)
    box('mattress_foot', (.74, 1.2, .12), (SX, SY - .35, .73), MATT, .05)
    box('sheet_foot', (.76, 1.18, .015), (SX, SY - .35, .795), SHEET, .006)
    back = box('mattress_back', (.74, .8, .12), (SX, SY + .62, .73), MATT, .05)
    box('sheet_back', (.76, .78, .015), (SX, SY + .6, .795), SHEET, .006)
    box('pillow', (.5, .3, .1), (SX, SY + .86, .85), SHEET, .05)
    # patient under a blanket: torso and legs as soft shapes, head on the pillow
    for side in (-1, 1):  # side rails
        x = SX + side * .42
        tube('rail_top', (x, SY - .15, .98), (x, SY + .75, .98), .014, CHROME); tube('rail_mid', (x, SY - .15, .88), (x, SY + .75, .88), .01, CHROME)
        for y in (-.15, .3, .75): tube('rail_post', (x, SY + y, .66), (x, SY + y, .98), .012, CHROME)
    tube('push_bar', (SX - .38, SY - 1.0, .95), (SX + .38, SY - 1.0, .95), .02, PLG)
    for x in (-.38, .38): tube('push_post', (SX + x, SY - .98, .64), (SX + x, SY - 1.0, .95), .016, STEEL)
    box('footboard', (.8, .04, .2), (SX, SY - .97, .72), PLW, .02)
    # IV pole on the stretcher
    tube('iv_pole', (SX + .38, SY + .95, .64), (SX + .38, SY + .95, 2.15), .013, CHROME)
    for a in range(4): tube('iv_hook', (SX + .38, SY + .95, 2.15), (SX + .38 + .1 * math.cos(a * 1.57), SY + .95 + .1 * math.sin(a * 1.57), 2.2), .006, CHROME)
    box('iv_bag', (.1, .03, .18), (SX + .48, SY + .95, 2.03), GLASS, .02); box('iv_label', (.06, .032, .05), (SX + .48, SY + .95, 2.06), PLW, 0)
    tube('iv_line', (SX + .48, SY + .95, 1.94), (SX + .1, SY + .3, .98), .004, GLASS)
    box('pump', (.14, .1, .2), (SX + .38, SY + .9, 1.45), PLW, .015); box('pump_screen', (.08, .005, .05), (SX + .38, SY + .849, 1.5), mat('pumpscr', (.1, .2, .3), .2, emit=(.4, .7, 1), estr=2), 0)
    
    # ---------- sink and supplies on the left wall ----------
    LX = X0 + .3
    box('cabinet', (.55, 1.1, .82), (LX, -.6, .41), mat('cab', (.12, .22, .40), .45), .01)
    for y in (-.88, -.33): box('cab_door_gap', (.005, .53, .7), (LX + .276, y, .42), BASE, 0); box('handle', (.02, .1, .015), (LX + .29, y + .18, .7), STEEL, .004)
    box('counter', (.6, 1.15, .04), (LX + .02, -.6, .84), mat('counter', (.9, .9, .88), .2), .006)
    box('basin', (.36, .42, .02), (LX + .02, -.6, .861), STEEL, 0)
    tube('faucet', (X0 + .07, -.6, .86), (X0 + .07, -.6, 1.12), .014, CHROME); tube('spout', (X0 + .07, -.6, 1.12), (X0 + .28, -.6, 1.08), .012, CHROME)
    box('soap', (.08, .1, .2), (X0 + .04, -.25, 1.25), PLW, .01); box('sanitizer', (.08, .1, .2), (X0 + .04, -.95, 1.25), PLW, .01)
    for i, c in enumerate([mat('g1', (.35, .45, .75), .6), mat('g2', (.4, .3, .6), .6), mat('g3', (.3, .55, .45), .6)]):
        box('glove_box', (.1, .26, .13), (X0 + .06, -.15 + i * -.0 - .0, 1.5 + i * .15), PLW, .006); box('glove_lab', (.002, .2, .05), (X0 + .112, -.15, 1.5 + i * .15), c, 0)
    box('sharps', (.14, .2, .26), (X0 + .08, -1.2, 1.15), RED, .015); box('sharps_lid', (.15, .21, .04), (X0 + .08, -1.2, 1.3), mat('sharpslid', (.9, .9, .9), .4), .01)
    box('paper_towel', (.1, .28, .3), (X0 + .06, -.6, 1.55), PLW, .015)
    box('whiteboard', (.02, 1.0, .65), (X0 + .01, .9, 1.22), mat('wb', (.97, .97, .97), .15), .004); box('wb_frame', (.025, 1.04, .69), (X0 + .005, .9, 1.22), STEEL, .006)
    # supply cart in the back corner
    box('cart', (.5, .6, .9), (X0 + .35, 1.4, .5), mat('cartc', (.55, .05, .05), .4), .02)
    for k in range(5): box('drawer_gap', (.004, .58, .004), (X0 + .601, 1.4, .2 + k * .16), PLG, 0); box('pull', (.01, .14, .02), (X0 + .61, 1.4, .27 + k * .16), PLG, .004)
    for dy in (-.25, .25):
        for dx in (-.2, .2): cyl('cart_caster', .035, .03, (X0 + .35 + dx, 1.4 + dy, .035), PLD, rot=(0, 90, 0))
    
    # ---------- right side: computer on wheels, chair, bins ----------
    CX, CY = 1.25, -.35
    box('cow_base', (.5, .5, .04), (CX, CY, .08), PLG, .02)
    for dx in (-.2, .2):
        for dy in (-.2, .2): cyl('cow_caster', .03, .03, (CX + dx, CY + dy, .03), PLD, rot=(0, 90, 0))
    tube('cow_pole', (CX, CY, .1), (CX, CY, 1.05), .03, STEEL); box('cow_tray', (.55, .38, .03), (CX, CY - .05, 1.05), PLW, .01)
    box('keyboard', (.4, .14, .015), (CX, CY - .12, 1.075), PLD, .004); box('mouse', (.05, .08, .02), (CX + .24, CY - .12, 1.075), PLD, .01)
    box('cow_screen', (.48, .03, .3), (CX, CY + .08, 1.32), PLD, .01, rot=(-8, 0, 0))
    box('cow_disp', (.44, .005, .26), (CX, CY + .062, 1.32), mat('ehr', (.85, .88, .92), .2, emit=(.8, .85, .9), estr=1.2), 0, rot=(-8, 0, 0))
    box('scanner', (.05, .08, .14), (CX + .3, CY + .05, 1.12), PLD, .01)
    # visitor chair
    VX, VY = 1.3, .9
    box('seat', (.5, .48, .08), (VX, VY, .46), FABRIC, .03); box('chair_back', (.5, .08, .48), (VX + .0, VY + .24, .74), FABRIC, .03, rot=(8, 0, 0))
    for dx in (-.21, .21):
        tube('leg_f', (VX + dx, VY - .2, 0), (VX + dx, VY - .2, .42), .015, STEEL); tube('leg_b', (VX + dx, VY + .2, 0), (VX + dx, VY + .22, .42), .015, STEEL)
        tube('armrest', (VX + dx * 1.15, VY - .2, .64), (VX + dx * 1.15, VY + .2, .64), .02, PLD); tube('arm_post', (VX + dx * 1.15, VY - .15, .46), (VX + dx * 1.15, VY - .15, .64), .015, STEEL)
    # bins by the door
    cyl('trash', .17, .5, (1.6, -1.55, .25), PLG); cyl('trash_lid', .175, .03, (1.6, -1.55, .51), PLD)
    cyl('linen', .17, .55, (1.2, -1.6, .275), mat('linen', (.75, .78, .8), .7)); tube('linen_hoop', (1.2, -1.6, .58), (1.2, -1.6, .58), .17, STEEL)
    
    # ---------- privacy curtain, partly drawn ----------
    bm = bmesh.new(); W_, H_, N = 1.3, 1.9, 60
    verts = [[bm.verts.new((-1.75 + W_ * i / N, -1.55 + .06 * math.sin(i / N * W_ * 26), .5 + H_ * j / 8)) for j in range(9)] for i in range(N + 1)]
    for i in range(N):
        for j in range(8): bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]))
    me = bpy.data.meshes.new('curtain'); bm.to_mesh(me); co = bpy.data.objects.new('curtain', me); bpy.context.view_layer.active_layer_collection.collection.objects.link(co); me.materials.append(CURT)
    for p in me.polygons: p.use_smooth = True
    sol = co.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = .01
    

# ---------- staff and patient: real rigged characters, clothes recoloured ----------
import numpy as np
HUM = '/tmp/x-mesh2motion-app/static/assets/human/variations/'
UNI = {'RN': (.02, .16, .75), 'T': (.0, .40, .12), 'PA': (.50, .0, .06), 'NP': (.30, .02, .50), 'R': (.62, .42, .12), 'EV': (.10, .11, .13), 'PT': (.22, .45, .78), 'EMS': (.03, .05, .13), 'TP': (.36, .2, .07)}
ACT = {}
def action(name):
    if name in ACT: return ACT[name]
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f'/tmp/b/anim/{name}.glb')
    new = [o for o in bpy.data.objects if o not in before]; act = None
    for o in new:
        if o.animation_data and o.animation_data.action: act = o.animation_data.action
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    ACT[name] = act; return act
def recolor(img, rgb):
    px = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(px); p = px.reshape(-1, 4)
    r, g, b = p[:, 0], p[:, 1], p[:, 2]; mx = p[:, :3].max(1); mn = p[:, :3].min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    skin = (r > g) & (g >= b * .85) & (r - b > 22 / 255) & (sat > .12) & (sat < .7) & (mx > .28)
    keep = skin | (mx < .05); lum = .3 * r + .59 * g + .11 * b; k = np.minimum(1.05, .6 + lum * .55)
    for c in range(3): p[:, c] = np.where(keep, p[:, c], np.clip(rgb[c] ** (1 / 2.2) * k, 0, 1))
    img.pixels.foreach_set(p.ravel()); img.update()
def scrub_mat(role):
    m = bpy.data.materials.get('scrub_' + role)
    if m: return m
    m = mat('scrub_' + role, UNI[role], .85); nt = m.node_tree; b = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 900; bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .08
    nt.links.new(n.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal']); return m
def overlay(o, role, gown=False):
    mw = o.matrix_world; pts = [mw @ v.co for v in o.data.vertices]; h = max(p.z for p in pts); sc = mw.to_scale().x
    def keep(p):
        z, ax = p.z / h, abs(p.x) / h
        if gown:
            if .27 < z < .885 and ax < .16: return True
        else:
            if .045 < z < .56 and ax < .13: return True          # pants
            if .5 < z < .885 and ax < .13: return True            # top body
        if .72 < z < .885 and .06 < ax < .21: return True         # short sleeves
        return False
    def vneck(p):
        z = p.z / h; ax = abs(p.x) / h
        return p.y < 0 and z > .84 and ax < (z - .84) * .6 + .004
    o2 = o.copy(); o2.data = o.data.copy(); COLL.objects.link(o2) if o2.name not in COLL.objects else None
    for c in o.users_collection:
        if o2.name not in c.objects: c.objects.link(o2)
    bm = bmesh.new(); bm.from_mesh(o2.data); bm.verts.ensure_lookup_table(); bm.normal_update()
    dead = [v for v in bm.verts if not keep(mw @ v.co) or vneck(mw @ v.co)]
    bmesh.ops.delete(bm, geom=dead, context='VERTS')
    for v in bm.verts: v.co += v.normal * ((.016 if (mw @ v.co).z / h > .68 else .012) / sc)
    bm.to_mesh(o2.data); bm.free()
    o2.data.materials.clear(); o2.data.materials.append(scrub_mat(role))
    for p in o2.data.polygons: p.material_index = 0; p.use_smooth = True
    return o2
def realp(variant, loc, rotz=0, uni=None, anim='idle-a', frame=10, lie=False):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=HUM + variant + '.glb')
    new = [o for o in bpy.data.objects if o not in before]; arm = [o for o in new if o.type == 'ARMATURE'][0]
    for o in new:
        if o.type == 'MESH' and o.name.startswith('Icosphere'): o.hide_render = True
        if o.type == 'MESH' and uni and not o.name.startswith('Icosphere'): overlay(o, uni, gown=(uni == 'PT'))
    act = action(anim)
    if act:
        arm.animation_data_create(); arm.animation_data.action = act
        if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
        FR.append((arm, frame))
    arm.location = loc; arm.rotation_mode = 'XYZ'; arm.rotation_euler = (math.radians(-90) if lie else 0, 0, math.radians(rotz))
    return arm
FR = []
FR = []
