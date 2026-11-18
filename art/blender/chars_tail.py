import os
EXP = '/tmp/b/glb/people'; os.makedirs(EXP, exist_ok=True)
UNI['RT'] = (.0, .36, .44); UNI['RX'] = (.55, .56, .6)
COMBOS = [('psx-26-doctor', None, 'md'), ('psx-female-09', 'PA', 'pa'), ('psx-female-08', 'NP', 'np'),
          ('psx-31-female', 'RN', 'rn1'), ('psx-05', 'RN', 'rn2'), ('psx-06', 'RN', 'rn3'), ('psx-female-09', 'RN', 'rn4'),
          ('psx-10', 'T', 't1'), ('psx-06', 'T', 't2'), ('psx-05', None, 'reg1'), ('psx-female-09', 'R', 'reg2'),
          ('psx-32', 'EV', 'ev1'), ('psx-15', 'EV', 'ev2'), ('psx-21-police', 'EMS', 'ems1'), ('psx-17-female-police', 'EMS', 'ems2'), ('psx-18-police', 'EMS', 'ems3'),
          ('psx-06', 'TP', 'tp'), ('psx-10', 'RT', 'rt'), ('psx-15', 'RX', 'rx')] + \
         [(v, 'PT', 'pt_' + v.replace('psx-', '')) for v in ['psx-05', 'psx-06', 'psx-15', 'psx-32', 'psx-female-08', 'psx-female-09', 'psx-31-female', 'psx-10']]
for v, u, name in COMBOS:
    before = set(bpy.data.objects); arm = realp(v, (0, 0, 0), 0, u, 'idle-a', 1)
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if not o.name.startswith('Icosphere')]
    if arm.animation_data: arm.animation_data.action = None
    bpy.ops.object.select_all(action='DESELECT')
    for o in keep: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=f'{EXP}/{name}.glb', export_format='GLB', use_selection=True, export_apply=False, export_animations=False, export_skins=True, export_yup=True, export_image_format='JPEG', export_image_quality=82)
    print('EXPORTED', name, os.path.getsize(f'{EXP}/{name}.glb'), flush=True)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
print('DONE')
