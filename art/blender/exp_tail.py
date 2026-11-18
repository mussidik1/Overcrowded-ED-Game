
# ================= the whole department, laid out like the 2D map =================
import os
OUTD = sys.argv[sys.argv.index('--') + 1]
SAMP = int(sys.argv[sys.argv.index('--') + 2])
VL = bpy.context.view_layer
def make_variant(name, BH, SH, W=3.8, D=3.8):
    c = bpy.data.collections.new(name); S.collection.children.link(c)
    VL.active_layer_collection = VL.layer_collection.children[name]
    build_room(BH, SH, W, D)
    VL.active_layer_collection = VL.layer_collection
    VL.layer_collection.children[name].exclude = True
    return c
V_POD_FAR = make_variant('POD_FAR', 2.7, 1.8); V_POD = make_variant('POD', 1.8, 1.8)
V_RES_FAR = make_variant('RES_FAR', 2.7, 1.8, 4.3, 4.6); V_RES = make_variant('RES', 1.8, 1.8, 4.3, 4.6)
SX, SY, T = -.25, .35, .12
BLANK2 = mat('blanket2', (.06, .20, .55), .9); BOARD = mat('board', (.85, .55, .1), .4); PAD = mat('padm', (.95, .95, .93), .6)
RING = mat('crash_ring', (.9, 0, 0), .4, emit=(1, 0, 0), estr=5)
LIT = mat('call_on', (1, 1, 1), .3, emit=(1, .98, .9), estr=12); UNLIT = mat('call_off', (.45, .47, .5), .4)
LINEN = mat('linen_dirty', (.86, .86, .84), .9); MOPY = mat('bucket', (.95, .75, .05), .4); MOPS = mat('mopstick', (.5, .35, .2), .5)
NAVY = mat('navy', (.04, .07, .2), .8); TEXT = mat('floor_text', (.16, .18, .22), .6); WOOD2 = mat('wood2', (.55, .38, .22), .5)
GLASSW = mat('glass_wall', (.6, .8, .9), .05, trans=.9)

def adopt(E, before):
    for o in bpy.data.objects:
        if o not in before and o.parent is None and o is not E: o.parent = E
ICONS = []
def icon(state, x, y, z=3.4):
    m = bpy.data.materials.get('icon_' + state)
    if not m:
        m = bpy.data.materials.new('icon_' + state); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(f'/tmp/b/icons/{state}.png')
        nt.links.new(t.outputs['Color'], b.inputs['Base Color']); nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
        b.inputs['Emission Strength'].default_value = 1.2
    bpy.ops.mesh.primitive_plane_add(size=1.2, location=(x, y, z)); p = bpy.context.active_object; p.data.materials.append(m); ICONS.append(p)
def label(txt, x, y, size=.7, rotz=0, m=None):
    bpy.ops.object.text_add(location=(x, y, .006)); t = bpy.context.active_object; t.data.body = txt; t.data.size = size; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    t.rotation_euler[2] = math.radians(rotz); t.data.materials.append(m or TEXT); t.data.extrude = .002; return t
def wall(x0, y0, x1, y1, h=1.8, m=None):
    L = math.hypot(x1 - x0, y1 - y0); a = math.degrees(math.atan2(y1 - y0, x1 - x0))
    box('wall', (L + T, T, h), ((x0 + x1) / 2, (y0 + y1) / 2, h / 2), m or WALL, .004, rot=(0, 0, a)); box('wcap', (L + T, T + .002, .02), ((x0 + x1) / 2, (y0 + y1) / 2, h), CAP, 0, rot=(0, 0, a))
def floor(x0, y0, x1, y1, m, z=-.012):
    box('floorzone', (x1 - x0, y1 - y0, .016), ((x0 + x1) / 2, (y0 + y1) / 2, z), m, 0)
def ppl(variant, loc, rotz, uni, anim, frame, lie=False):
    return realp(variant, loc, rotz, uni, anim, frame, lie)
def hstretcher(x, y, rotz=0, pt=None, blanket=True):
    """A plain ED or EMS stretcher, for hallway beds and the wall."""
    bpy.ops.object.empty_add(location=(x, y, 0)); E = bpy.context.active_object; E.rotation_euler[2] = math.radians(rotz); before = set(bpy.data.objects)
    for dx in (-.28, .28):
        for dy in (-.8, .8): cyl('wheel', .06, .04, (dx, dy, .06), PLD, rot=(0, 90, 0))
    box('hs_base', (.56, 1.7, .1), (0, 0, .2), PLW, .03); box('hs_col', (.2, .3, .35), (0, 0, .42), PLG, .02)
    box('hs_frame', (.72, 1.95, .06), (0, 0, .62), STEEL, .01); box('hs_matt', (.68, 1.9, .1), (0, 0, .7), MATT, .04); box('hs_sheet', (.7, 1.88, .012), (0, 0, .756), SHEET, .005)
    for sx in (-.38, .38): tube('hs_rail', (sx, -.4, .92), (sx, .6, .92), .013, CHROME)
    if pt:
        pass
        if blanket: box('hs_blanket', (.74, .95, .16), (0, -.45, .82), BLANK2, .05)
    adopt(E, before); return E
def seat(x, y, rotz=0, m=None):
    bpy.ops.object.empty_add(location=(x, y, 0)); E = bpy.context.active_object; E.rotation_euler[2] = math.radians(rotz); before = set(bpy.data.objects)
    box('seat', (.5, .48, .08), (0, 0, .44), m or NAVY, .03); box('seat_back', (.5, .08, .46), (0, .23, .72), m or NAVY, .03, rot=(8, 0, 0))
    for dx in (-.21, .21):
        for dy in (-.19, .19): tube('seat_leg', (dx, dy, 0), (dx, dy, .4), .014, STEEL)
    adopt(E, before); return E
def recliner(x, y, rotz=0):
    bpy.ops.object.empty_add(location=(x, y, 0)); E = bpy.context.active_object; E.rotation_euler[2] = math.radians(rotz); before = set(bpy.data.objects)
    RC = mat('recl', (.12, .18, .35), .6)
    box('rc_base', (.7, .8, .4), (0, 0, .2), RC, .06); box('rc_back', (.7, .2, .7), (0, .42, .65), RC, .08, rot=(-12, 0, 0)); box('rc_foot', (.6, .4, .1), (0, -.55, .35), RC, .04)
    for dx in (-.38, .38): box('rc_arm', (.12, .8, .2), (dx, 0, .5), RC, .05)
    adopt(E, before); return E
def ambulance(x, y, rotz=0):
    bpy.ops.object.empty_add(location=(x, y, 0)); E = bpy.context.active_object; E.rotation_euler[2] = math.radians(rotz); before = set(bpy.data.objects)
    WHT = mat('amb', (.93, .93, .92), .35); RED_ = mat('ambred', (.75, .03, .05), .4); GL = mat('ambglass', (.15, .2, .25), .1, .3)
    box('amb_box', (2.3, 3.6, 2.4), (0, .8, 1.6), WHT, .08); box('amb_cab', (2.2, 1.9, 1.7), (0, -1.9, 1.2), WHT, .1)
    box('amb_stripe', (2.32, 5.3, .25), (0, -.05, 1.25), RED_, .01); box('amb_wind', (2.0, .05, .7), (0, -2.84, 1.6), GL, .02, rot=(-12, 0, 0))
    box('amb_bar', (1.6, .3, .14), (0, -1.6, 2.12), mat('lightbar', (1, .1, .1), .3, emit=(1, .05, .05), estr=6), .03)
    for sx in (-1.12, 1.12):
        for sy in (-1.9, 1.6): cyl('amb_wheel', .42, .3, (sx, sy, .42), PLD, rot=(0, 90, 0))
    box('amb_star', (.02, .5, .5), (1.16, .8, 2.0), mat('star', (.1, .3, .75), .4), 0)
    adopt(E, before); return E
def tree(x, y, s=1):
    cyl('trunk', .14 * s, 1.6 * s, (x, y, .8 * s), mat('bark', (.3, .2, .12), .8))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.3 * s, location=(x, y, 2.4 * s)); o = bpy.context.active_object; o.data.materials.append(mat('leaf', (.12, .3, .1), .8))

# ---- room placements, from the 2D map (u, v map units -> metres) ----
X = lambda u: (u - 700) * .04
ROOMS = []   # (id, x, y, rot, variant, state, D)
pods = {'a': (490, ['1', '2', '3', '4']), 'b': (707, ['5', '6', '7', '8']), 'c': (924, ['9', '10', '11', '12']),
        'd': (490, ['13', '14', '15', '16']), 'e': (707, ['17', '18', '19', '20']), 'ft': (924, ['FT1', 'FT2', 'FT3', 'FT4'])}
STATE = {'1': 'need', '2': 'calm', '3': 'go', '4': 'dirty', '5': 'board', '6': 'calm', '7': 'empty', '8': 'need', '9': 'calm', '10': 'empty', '11': 'go', '12': 'calm',
         '13': 'calm', '14': 'need', '15': 'dirty', '16': 'board', '17': 'calm', '18': 'empty', '19': 'calm', '20': 'go', 'FT1': 'dirty', 'FT2': 'calm', 'FT3': 'empty', 'FT4': 'need',
         'R1': 'bad', 'R2': 'calm', 'R3': 'empty', 'R4': 'need'}
YT_BACK, YT_FRONT, YB_FRONT, YB_BACK = 11.7, 6.6, -5.4, -10.5
for z, (u0, ids) in pods.items():
    top = z in 'abc'
    for i, rid in enumerate(ids):
        x = X(u0 + 48 + (i % 2) * 104); back = i < 2
        if top: ROOMS.append((rid, x, YT_BACK if back else YT_FRONT, 0, V_POD_FAR if back else V_POD, STATE[rid], 3.8))
        else: ROOMS.append((rid, x, YB_FRONT if back else YB_BACK, 180, V_POD, STATE[rid], 3.8))
for i, rid in enumerate(['R1', 'R2', 'R3', 'R4']):
    ROOMS.append((rid, X(310 + (i % 2) * 114), 12.3 if i < 2 else 7.0, 0, V_RES_FAR if i < 2 else V_RES, STATE[rid], 4.6))
PTV = ['psx-05', 'psx-06', 'psx-15', 'psx-32', 'psx-female-08', 'psx-female-09', 'psx-31-female', 'psx-10']
# ---- department shell ----
XL, XR_, YT, YB = -23.5, 28.2, 14.8, -15.6
floor(XL, YB, XR_, YT, HALL, -.024)
floor(-8.6, 4.6, 17.3, -3.4, mat('hall2', (.46, .48, .5), .25, noise=160))           # main hallway
wall(XL, YT, XR_, YT, 2.7); wall(XR_, YT, XR_, YB); wall(XL, YB, XR_, YB, 1.2)
wall(XL, YT, XL, 2.2, 1.8, GLASSW); wall(XL, 2.2, XL, -10.4); wall(XL, -13.6, XL, YB)   # ambulance doors (glass) and the walk-in door gap
wall(-18.0, YT, -18.0, 2.4); wall(-18.0, -1.9, -10.4, -1.9)                           # the wall | resus; lobby | triage
wall(-8.7, YT, -8.7, 4.7); wall(-8.7, -3.5, -8.7, YB)                                  # resus/lobby | pods
wall(17.4, YT, 17.4, 4.7); wall(17.4, -3.5, 17.4, -12.6)                               # pods | break room, chairs, EVS
wall(17.4, 4.4, XR_, 4.4); wall(17.4, -4.4, XR_, -4.4)
wall(-8.7, -12.6, 17.4, -12.6, 1.2)                                                    # pods | imaging, lab, pharmacy strip
for lab_, x_, y_, s_ in [('THE WALL', -20.8, 13.6, .7), ('TRIAGE', -13.2, -2.5, .6), ('WAITING', -13.2, -6.0, .6), ('DOOR', -21.3, -12.0, .6), ('RESUS', -13.3, 14.1, .6),
                          ('POD A', -4.4, 14.1, .6), ('POD B', 4.3, 14.1, .6), ('POD C', 13.0, 14.1, .6), ('POD D', -4.4, -12.3, .5), ('POD E', 4.3, -12.3, .5), ('FAST TRACK', 13.0, -12.3, .5),
                          ('BREAK ROOM', 22.8, 5.0, .6), ('CHAIRS', 22.8, -3.9, .6), ('EVS', 22.8, -5.0, .6), ('CT', -5.4, -14.9, .5), ('XR', -.4, -14.9, .5), ('LAB', 4.6, -14.9, .5), ('RX', 9.6, -14.9, .5)]:
    label(lab_, x_, y_, s_)

# ---- ambulance bay, the wall, registration, door ----
floor(-40, -20, XL, 25, mat('asphalt', (.12, .12, .13), .7, noise=60), -.03)
for yy in (13.0, 8.0): box('bay_line', (6, .1, .01), (-28, yy - 2.5, -.015), mat('paint', (.9, .9, .85), .5), 0)
box('canopy', (9, 12, .2), (-28.5, 8.0, 4.2), mat('canopy', (.7, .72, .75), .5), .02)
for yy in (2.5, 13.5): cyl('canopy_post', .12, 4.2, (-32.6, yy, 2.1), STEEL)
for j in range(6): box('wall_spot', (2.3, 1.0, .004), (-20.7, 12.4 - j * 1.75, .002), mat('dash', (.55, .58, .62), .5), 0)
box('reg_desk', (4.8, .7, 1.05), (-20.7, -.9, .525), WOOD2, .03); box('reg_top', (5.0, .8, .04), (-20.7, -.9, 1.07), mat('regtop', (.85, .82, .76), .3), .01)
for xx in (-22.0, -19.6): box('reg_mon', (.5, .04, .32), (xx, -.75, 1.3), PLD, .01, rot=(-8, 0, 0))
pass
box('door_frame', (.2, 3.2, 2.4), (XL - .05, -12.0, 1.2), mat('doorglass', (.55, .75, .85), .05, trans=.85), .01)
pass

# ---- triage and waiting ----
floor(-17.9, -5.3, -10.5, -2.0, mat('triage_floor', (.8, .76, .66), .4))
for bx in (-15.6, -12.1):
    box('tri_desk', (1.4, .6, .75), (bx, -2.5, .375), WOOD2, .02); box('tri_vitals', (.3, .25, .3), (bx + .4, -2.5, .9), PLW, .02); seat(bx - .4, -3.9, 180)
box('tri_curtain', (.03, 2.6, 1.9), (-13.85, -3.7, 1.05), CURT, 0)
pass
for r in range(5):
    for c in range(6): seat(-16.8 + c * 1.25, -7.0 - r * 1.35, 180)
for _ in []:
    pass
box('wait_tv', (.06, 1.6, .9), (-8.82, -9.5, 1.9), PLD, .02); box('wait_tv_scr', (.01, 1.5, .8), (-8.86, -9.5, 1.9), mat('tvscr', (.2, .4, .6), .2, emit=(.4, .6, .9), estr=1.5), 0)

# ---- hallway: beds, nurses' station, people ----
for hx_, hid in ((X(538), 'H1'), (X(642), 'H2'), (X(972), 'H3'), (X(1076), 'H4')):
    hstretcher(hx_, 3.6, 90, ('psx-10', 'PT') if hid in ('H1', 'H3') else None); label(hid, hx_ - 1.4, 3.6, .4)
DESKW = mat('desk', (.92, .92, .9), .4); DESKT = mat('desktop', (.08, .2, .38), .3)
for (sx_, sy_, cx_, cy_) in [(8.0, .7, 4.6, 1.8), (.7, 3.2, .95, .55), (.7, 3.2, 8.25, .55)]:
    box('station', (sx_, sy_, 1.05), (cx_, cy_, .525), DESKW, .02); box('station_top', (sx_ + .2, sy_ + .1, .04), (cx_, cy_, 1.07), DESKT, .01)
for xx in (2.0, 3.7, 5.4, 7.1):
    box('st_mon', (.55, .04, .34), (xx, 1.65, 1.32), PLD, .01, rot=(-8, 0, 0)); box('st_scr', (.5, .005, .3), (xx, 1.625, 1.32), mat('ehr2', (.8, .85, .9), .2, emit=(.8, .85, .9), estr=1.2), 0, rot=(-8, 0, 0))
box('the_box', (.12, .1, .3), (.95, 1.2, 1.24), mat('boxred', (.8, .05, .08), .4), .02)
pass
pass
pass
pass

# ---- imaging, lab, pharmacy, elevators ----
floor(-8.6, -15.5, 17.3, -12.7, mat('strip', (.68, .7, .72), .3))
bpy.ops.mesh.primitive_torus_add(major_radius=.9, minor_radius=.35, location=(-6.0, -14.2, 1.05), rotation=(math.radians(90), 0, 0)); o = bpy.context.active_object; o.data.materials.append(PLW); o.scale[1] = 1.6
box('ct_table', (.5, 2.4, .2), (-6.0, -13.0, .8), PLW, .05); box('ct_base', (.4, 1.2, .7), (-6.0, -13.2, .35), PLG, .05)
box('xr_unit', (1.2, 2.0, .7), (-.8, -14.0, .35), PLW, .05); tube('xr_arm', (-.8, -15.2, 0), (-.8, -15.2, 2.2), .08, STEEL); box('xr_tube', (.5, .5, .4), (-.8, -14.4, 2.0), PLG, .05)
box('lab_bench', (3.0, .8, .95), (4.6, -15.0, .475), PLW, .02)
for j in range(5): cyl('tube_rack', .06, .25, (3.6 + j * .45, -14.9, 1.07), [RED, mat('pt', (.5, .4, .7), .4), GRN, YEL, mat('bl', (.2, .4, .8), .4)][j])
box('rx_shelf', (3.2, .5, 2.0), (9.6, -15.2, 1.0), mat('rxs', (.85, .82, .9), .4), .02)
for j in range(7): box('rx_bin', (.36, .4, .25), (8.3 + j * .43, -15.0, 1.4), [PLW, RED, GRN, YEL, mat('bl2', (.3, .5, .9), .4), PLW, mat('or', (.9, .5, .2), .4)][j], .02)
for ex in (13.8, 15.8): box('elevator', (1.6, .1, 2.2), (ex, -15.55, 1.1), STEEL, .01); box('elev_gap', (.02, .11, 2.2), (ex, -15.55, 1.1), PLD, 0)
pass

# ---- break room, chairs, EVS ----
floor(17.5, 4.5, XR_, YT, mat('break_floor', (.55, .42, .3), .5))
box('counter_br', (6.2, .7, .95), (22.6, 14.2, .475), mat('brc', (.85, .85, .83), .3), .02); box('coffee', (.3, .3, .45), (24.0, 14.2, 1.17), PLD, .03)
box('fridge', (.8, .75, 1.9), (26.6, 14.1, .95), mat('fridge', (.85, .87, .9), .3), .03); box('vending', (1.0, .8, 1.9), (27.6, 13.0, .95), mat('vend', (.1, .25, .55), .3), .03)
box('br_table', (2.4, 1.1, .05), (22.4, 10.0, .75), WOOD2, .02); tube('br_tleg', (22.4, 10.0, 0), (22.4, 10.0, .75), .06, STEEL)
for (cx_, cy_, r_) in [(21.6, 10.9, 180), (23.2, 10.9, 180), (21.6, 9.1, 0), (23.2, 9.1, 0)]: seat(cx_, cy_, r_, mat('brseat', (.75, .45, .2), .5))
box('couch', (4.0, .9, .45), (24.0, 5.6, .3), mat('couch', (.15, .22, .4), .7), .08); box('couch_back', (4.0, .25, .5), (24.0, 5.15, .7), mat('couch', (.15, .22, .4), .7), .08)
box('br_tv', (.06, 1.6, .9), (17.55, 10.0, 1.8), PLD, .02); tree(18.4, 5.4, .35)
pass
for j in range(6): recliner(19.6 + (j % 2) * 4.6 + (j // 2) * 1.5 - 1.5, 3.0 - (j // 2) * 2.4, 0)
pass
box('evs_cart', (1.4, .7, 1.0), (20.5, -13.8, .5), mat('evscart', (.85, .7, .1), .4), .03); cyl('evs_bucket', .2, .35, (22.2, -14.2, .18), MOPY)
box('linen_rack', (.6, 3.4, 2.0), (27.7, -9.5, 1.0), STEEL, .02)
for j in range(6): box('linen_stack', (.5, .5, .25), (27.7, -11.0 + j * .6, 1.3), [SHEET, mat('lb', (.6, .75, .9), .8), SHEET, mat('ly', (.9, .85, .5), .8), SHEET, mat('lg', (.6, .85, .65), .8)][j], .04)
pass
for (tx_, ty_, ts_) in [(30.5, 11, 1.1), (31.5, 4, 1.3), (30.2, -3, 1.0), (31.8, -9, 1.2), (30.6, -14, 1.0), (-36, 18, 1.2), (-38, -6, 1.1)]: tree(tx_, ty_, ts_)
S.frame_set(10)


# ================= export =================
import json
EXP = '/tmp/b/glb'; os.makedirs(EXP, exist_ok=True)
def export_sel(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        try: o.select_set(True)
        except Exception: pass
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_lights=False, export_cameras=False, export_animations=False, export_yup=True)
    print('EXPORTED', path, os.path.getsize(path), flush=True)
# text labels become meshes
for o in list(S.objects):
    if o.type == 'FONT':
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); VL.objects.active = o; bpy.ops.object.convert(target='MESH')
static = [o for o in VL.objects if o.type in ('MESH', 'EMPTY') and o.visible_get()]
export_sel(static, f'{EXP}/dept_static.glb')
for name in ('POD_FAR', 'POD', 'RES_FAR', 'RES'):
    lc = VL.layer_collection.children[name]; lc.exclude = False
    export_sel([o for o in bpy.data.collections[name].all_objects if o.type in ('MESH', 'EMPTY')], f'{EXP}/room_{name}.glb')
    lc.exclude = True
# props
E = hstretcher(0, 0, 0); export_sel([E] + list(E.children_recursive), f'{EXP}/stretcher.glb')
E = ambulance(0, 0, 0); export_sel([E] + list(E.children_recursive), f'{EXP}/ambulance.glb')
json.dump({'rooms': [{'id': r[0], 'x': r[1], 'y': r[2], 'rot': r[3], 'variant': r[4].name, 'D': r[6], 'state': r[5]} for r in ROOMS]}, open(f'{EXP}/layout.json', 'w'), indent=1)
print('DONE', flush=True)
