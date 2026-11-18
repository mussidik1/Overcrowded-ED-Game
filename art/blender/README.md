# 3D department (work in progress)

Blender scripts for the 3D look he approved on Nov 18, 2026. Nothing here is used by the game yet.

- `room.py`: one detailed ED room plus a uniform lineup. Run: `python3 room.py -- out.png SAMPLES`.
- `_head2.py` + `dept2_tail.py`: the whole department laid out like the 2D map. Build with `cat _head2.py dept2_tail.py > dept2.py`, then `python3 dept2.py -- OUTDIR SAMPLES` (`SHOTS=god,lobby,pods,right`).
- Needs `pip install bpy` (Blender 5.3 as a Python module), the human models from `scottpetrovic/mesh2motion-app` (`static/assets/human`, cloned to `/tmp/x-mesh2motion-app`), and the animations decompressed to `/tmp/b/anim/` with `decompress.mjs` (`npm i @gltf-transform/core @gltf-transform/extensions meshoptimizer`).
- `icons/`: the black-and-white state icons. `screen.png`: the monitor screen.

## Real-time export (Nov 18)
- `exp_tail.py`: `cat _head2.py exp_tail.py > exp.py && python3 exp.py -- /tmp/b 1` writes `glb/dept_static.glb` (walls, floors, desks, seats, imaging, break room, EVS, labels), `room_POD_FAR|POD|RES_FAR|RES.glb` (the four room types), `stretcher.glb`, `ambulance.glb`, and `layout.json` (room positions in Blender coordinates, Z up).
- `chars_tail.py`: `cat _head2.py chars_tail.py > chars.py && python3 chars.py` writes `glb/people/*.glb`: every role in uniform (md, pa, np, rn1-4, t1-2, reg1-2, ev1-2, ems1-3, tp, rt, rx) and patients in gowns (pt_*). No animations inside; the game plays the mesh2motion clips on them.
- The exported files are in `/3d` at the repo root (about 9 MB). `art/3d-preview/index.html` is the three.js test scene (needs `node_modules/three` and the mesh2motion `human/` folder beside it).
- Blender to three.js: (x, y, z) becomes (x, z, -y); a rotation about Blender Z is the same angle about three's Y.
