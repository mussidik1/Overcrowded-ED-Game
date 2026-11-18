/* Shrinks the Blender exports for phones: node tools/opt3d.mjs IN_DIR OUT_DIR
   - glass loses KHR_materials_transmission (three.js renders the whole scene a second time for it) and becomes see-through
   - the department and the rooms: the bay's canopy is removed (the 3D floor hides it anyway), solid colours go into
     one small palette texture, and parts with the same material are merged, so a room is a few draw calls, not 178
   - everything: duplicate data removed, meshopt compression (three.js's MeshoptDecoder reads it)
   People keep their skins and textures; animations are copied as they are (already compressed).
   Needs @gltf-transform/core, extensions, functions and meshoptimizer (npm i --no-save them in a scratch folder). */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, flatten, join, weld, palette, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
import path from 'path';

const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT) { console.error('usage: node tools/opt3d.mjs IN_DIR OUT_DIR'); process.exit(1); }
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

function noGlass(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const t = m.getExtension('KHR_materials_transmission'); if (!t) continue;
    const f = t.getTransmissionFactor(); m.setExtension('KHR_materials_transmission', null);
    const c = m.getBaseColorFactor(); m.setBaseColorFactor([c[0], c[1], c[2], Math.max(0.18, 1 - f * 0.8)]); m.setAlphaMode('BLEND');
  }
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_materials_transmission') e.dispose();
}
function dropNodes(doc, re) {
  for (const n of doc.getRoot().listNodes()) if (re.test(n.getName())) { for (const c of n.listChildren()) c.dispose(); n.dispose(); }
}

let before = 0, after = 0;
const files = [];
(function walk(d) { for (const f of fs.readdirSync(path.join(IN, d))) { const p = path.join(d, f); if (fs.statSync(path.join(IN, p)).isDirectory()) walk(p); else files.push(p); } })('');
for (const f of files) {
  const src = path.join(IN, f), dst = path.join(OUT, f); fs.mkdirSync(path.dirname(dst), { recursive: true });
  before += fs.statSync(src).size;
  if (!f.endsWith('.glb') || f.startsWith('anim/')) { fs.copyFileSync(src, dst); after += fs.statSync(dst).size; continue; }
  const doc = await io.read(src);
  noGlass(doc);
  const merge = f === 'dept_static.glb' || f.startsWith('room_') || f === 'stretcher.glb' || f === 'ambulance.glb';
  if (merge) {
    if (f === 'dept_static.glb') dropNodes(doc, /^canopy/);
    await doc.transform(dedup(), prune(), palette({ min: 2 }), flatten(), join(), weld());
  }
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(dst, doc);
  after += fs.statSync(dst).size;
  const r = doc.getRoot(); let prims = 0; for (const m of r.listMeshes()) prims += m.listPrimitives().length;
  console.log(f.padEnd(28), (fs.statSync(src).size / 1024 | 0) + 'K ->', (fs.statSync(dst).size / 1024 | 0) + 'K', merge ? `draw calls ${prims}` : '');
}
console.log(`total ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
