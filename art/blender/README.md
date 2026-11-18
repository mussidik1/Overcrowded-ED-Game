# 3D department (work in progress)

Blender scripts for the 3D look he approved on Nov 18, 2026. Nothing here is used by the game yet.

- `room.py`: one detailed ED room plus a uniform lineup. Run: `python3 room.py -- out.png SAMPLES`.
- `_head2.py` + `dept2_tail.py`: the whole department laid out like the 2D map. Build with `cat _head2.py dept2_tail.py > dept2.py`, then `python3 dept2.py -- OUTDIR SAMPLES` (`SHOTS=god,lobby,pods,right`).
- Needs `pip install bpy` (Blender 5.3 as a Python module), the human models from `scottpetrovic/mesh2motion-app` (`static/assets/human`, cloned to `/tmp/x-mesh2motion-app`), and the animations decompressed to `/tmp/b/anim/` with `decompress.mjs` (`npm i @gltf-transform/core @gltf-transform/extensions meshoptimizer`).
- `icons/`: the black-and-white state icons. `screen.png`: the monitor screen.
