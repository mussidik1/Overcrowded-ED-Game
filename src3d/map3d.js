/* Emergency Department: Code Black: the 3D floor (v0.18). A renderer only: map.js still decides where everyone is and what each room shows,
   and hands this module a snapshot every frame (OC3D.sync). Taps come back to map.js as (kind, id), so every action
   runs through the same code as the flat map. Models are made in Blender (art/blender) and live in /3d. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SU from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BASE = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/[^/]*$/, '') : '3d/');
const DEG = Math.PI / 180;
const B2T = (x, y, z = 0) => new THREE.Vector3(x, z, -y);   // Blender (Z up) to three (Y up)

/* ---------- 2D floor units (1400 x 712) to Blender metres ---------- */
const X = u => (u - 700) * 0.04;
const YK = [[0, 14.8], [44, 13.6], [244, 4.7], [404, -3.5], [446, -3.5], [642, -12.4], [652, -12.7], [712, -15.6]];
const Y = v => { if (v <= YK[0][0]) return YK[0][1]; for (let i = 1; i < YK.length; i++) { const [a, ya] = YK[i - 1], [b, yb] = YK[i]; if (v <= b) return ya + (yb - ya) * (v - a) / (b - a); } return YK[YK.length - 1][1]; };
const VINV = y => { for (let i = 1; i < YK.length; i++) { const [a, ya] = YK[i - 1], [b, yb] = YK[i]; if ((y <= ya && y >= yb) && ya !== yb) return a + (b - a) * (ya - y) / (ya - yb); } return y > YK[0][1] ? 0 : 712; };
const g2b = (u, v) => [X(u), Y(v)];

/* Fixed spots in the 3D building (Blender metres), matching the 2D map's spot lists. */
const SEAT3 = i => { const c = i % 6, r = Math.floor(i / 6); return [-16.8 + c * 1.25, -7.0 - r * 1.35]; };
const WALL3 = i => [-20.7, 12.4 - i * 1.75];
const BAY3 = [[-15.6, -3.0, -16.0, -3.95], [-12.1, -3.0, -12.5, -3.95]];   // nurse x, y, patient x, y
const REG3 = i => [-22.0 + 2.4 * i, -0.15];
const BRK3 = [[21.6, 10.9, 180, 1], [23.2, 10.9, 180, 1], [21.6, 9.1, 0, 1], [23.2, 9.1, 0, 1], [23.0, 5.75, 180, 1], [25.0, 5.75, 180, 1], [21.0, 13.2, 180, 0], [22.5, 13.2, 180, 0], [24.0, 13.2, 180, 0]];
const CHAIR3 = j => [19.6 + (j % 2) * 4.6 + Math.floor(j / 2) * 1.5 - 1.5, 3.0 - Math.floor(j / 2) * 2.4];
const HALL3 = { H1: 538, H2: 642, H3: 972, H4: 1076 };
const BAY_AMB = [[-27, 10.2, -90], [-27, 5.4, -90], [-27, 0.6, -90]], OUT_AMB = k => [-33.5, 2.0 - k * 6.6, 180], IN_AMB = k => [-33.5, -22 - k * 7, 180];   // in the bay they are backed in: the back doors face the building
const CPOS = { wall: [-20.7, 13.9], wait: [-13.2, -5.5], door: [-21.2, -13.2], out: [-27.5, -2.0], in: [-27.5, -9.0], box: [1.0, 1.4], ct: [-6.0, -14.2], lab: [4.6, -14.6] };
const SX = -0.25, SY = 0.35;   // the bed in a room's own frame
const BEDSIDE = [[-35, -5], [35, -5], [-35, 15], [35, 15], [-35, 5], [35, 5]];
const BEDSIDE3 = [[0.5, 0.3, -90], [-0.95, 0.2, 90], [0.5, -0.6, -90], [-0.95, -0.6, 90], [0.5, 1.0, -90], [-0.95, 1.0, 90]];

/* ---------- module state ---------- */
let R, S, CAM, HUD, el, api, L = null, ready = false, failed = false, dpr = 1, W = 0, H = 0, raf = 0;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), cache = {};
/* Models load from 3d/ by fetch. Where plain files can't be served (the private Claude link), the same models come
   packed in script files (3d/pack-index.js lists them; made by tools/pack3d.js), and are read from there. */
const PACK = window.OC3DPACK || (window.OC3DPACK = {});
const b64buf = s => { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; };
const script = src => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
async function packs() {
  try { const r = await fetch(BASE + 'layout.json', { method: 'HEAD' }); if (r.ok) return; } catch (e) { /* not served here: use the packs */ }
  if (!(await script(BASE + 'pack-index.js')) || !window.OC3DPACKS) return; for (const f of window.OC3DPACKS) await script(BASE + f); }
const buf = async u => PACK[u] ? b64buf(PACK[u]) : (await fetch(BASE + u)).arrayBuffer();
const load = u => (cache[u] ||= buf(u).then(b => loader.parseAsync(b, BASE)));
const GL = {}, ROOM = {}, ENT = new Map(), AMB = new Map(), ROOMX = {}, LBL = new Map(), ANIM = {};
const view = { tx: 2, ty: -1, dist: 60, fit: 60, tilt: 60 * DEG };   // v0.24.1: a little more top-down, so the floor fills a phone
let ambLive = false, ambK = 1, snap = null, clock = new THREE.Clock(), lastPick = [], SUN = null;
/* Quality. auto starts balanced on a phone (sharp on a computer) and steps down while frames run slow. */
const QL = { high: { dpr: 2, shadow: 2048, soft: true, fps: 60 }, med: { dpr: 1.5, shadow: 1024, soft: false, fps: 60 }, low: { dpr: 2, shadow: 0, soft: false, fps: 30 } };   // v0.23.1: battery saver keeps a sharp picture (pixel ratio 1 was blurry on a 3x phone); it saves with no shadows and 30 frames a second
const TOUCH = matchMedia('(pointer: coarse)').matches;
let qWant = 'auto', qNow = '', perf = { t: 0, n: 0, slow: 0 }, lastDraw = 0;
function setQuality(q) {
  if (!R) return; const lv = QL[q] || QL.med; qNow = q;
  dpr = Math.min(window.devicePixelRatio || 1, lv.dpr); R.setPixelRatio(dpr); W = 0;
  R.shadowMap.enabled = lv.shadow > 0; R.shadowMap.type = lv.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (SUN) { SUN.castShadow = lv.shadow > 0; if (lv.shadow && SUN.shadow.mapSize.x !== lv.shadow) { SUN.shadow.mapSize.set(lv.shadow, lv.shadow); if (SUN.shadow.map) { SUN.shadow.map.dispose(); SUN.shadow.map = null; } } }
  S.traverse(m => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { x.needsUpdate = true; }); });
  perf = { t: 0, n: 0, slow: 0 };
}
const qStart = () => (qWant === 'auto' ? (TOUCH ? 'med' : 'high') : qWant);

const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o));
const shade = o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
const hsh = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

/* ---------- labels: canvas sprites at a fixed size on screen ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const FONT = (px, b = 700) => `${b} ${px}px Cardo, Georgia, serif`;
function pill(g, x, y, w, h, r, fill, stroke, lw) { g.beginPath(); g.roundRect(x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw || 4; g.strokeStyle = stroke; g.stroke(); } }
const ICONC = {};
function iconImg(key) {   // the same glyphs as the flat map's icons, white on a black badge
  if (ICONC[key]) return ICONC[key];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -15 30 30" width="128" height="128"><rect x="-14" y="-14" width="28" height="28" rx="7" fill="#101215" stroke="#fff" stroke-width="2"/><g color="#ffffff" style="color:#ffffff">${(api.icon(key) || '').replace(/currentColor/g, '#ffffff')}</g></svg>`;
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); ICONC[key] = img; img.onload = () => { for (const l of LBL.values()) if (l.icon === key) l.key = ''; }; return img;
}
/* A sprite that keeps its size on screen. px: its height in CSS pixels. */
function sprite(id) {
  let l = LBL.get(id);
  if (!l) { const m = new THREE.SpriteMaterial({ depthTest: false, transparent: true }); l = { s: new THREE.Sprite(m), key: '', px: 30, aspect: 1 }; l.s.renderOrder = 20; l.s.material.sizeAttenuation = false; HUD.add(l.s); LBL.set(id, l); }
  l.seen = true; return l;
}
function setSprite(l, key, w, h, px, draw) {
  if (l.key !== key) { if (l.s.material.map) l.s.material.map.dispose(); l.s.material.map = canvasTex(w, h, draw); l.s.material.needsUpdate = true; l.key = key; l.aspect = w / h; }
  l.px = px;
}
function sizeSprites() {
  const f = 1 / Math.tan(CAM.fov * DEG / 2);
  for (const l of LBL.values()) { const sc = l.px * 2 / (H * f); l.s.scale.set(sc * l.aspect, sc, 1); }
}

/* ---------- loading ---------- */
async function build() {
  await packs();
  L = PACK['layout.json'] ? JSON.parse(atob(PACK['layout.json'])) : await (await fetch(BASE + 'layout.json')).json();
  const st = (await load('dept_static.glb')).scene; shade(st); S.add(st);
  { const gnd = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#bdb8ae', roughness: 1 })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.06; gnd.receiveShadow = true; S.add(gnd); }   // v0.24.1: plain ground all round, so there's no gray void past the building
  st.traverse(o => { if (/^canopy/.test(o.name)) o.visible = false; });   // the bay's roof would hide the ambulances from above
  for (const r of L.rooms) {
    const g = new THREE.Group(); g.position.copy(B2T(r.x, r.y)); g.rotation.y = r.rot * DEG; S.add(g);
    const inst = (await load(`room_${r.variant}.glb`)).scene.clone(true); shade(inst); g.add(inst);
    const call = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), M('#8d9298', { roughness: 0.4 })); call.position.copy(B2T(1.05, -r.D / 2 - 0.14, 0.78)); g.add(call);
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(3.6, r.D - 0.2), new THREE.MeshBasicMaterial({ color: '#2fd36a', transparent: true, opacity: 0, depthWrite: false })); tint.rotation.x = -Math.PI / 2; tint.position.y = 0.02; tint.renderOrder = 2; g.add(tint);
    ROOM[r.id] = { g, r, call, tint, w: 3.8, d: r.D };
  }
  const people = Object.values(MODEL).flatMap(f => [f({ id: 'a', title: 'PA' }), f({ id: 'b', title: 'NP' })]);
  const all = ['md', 'pa', 'np', 'rn1', 'rn2', 'rn3', 'rn4', 't1', 't2', 'reg1', 'reg2', 'ev1', 'ev2', 'rt', 'rx', 'tp', 'ems1', 'ems2', 'ems3'].concat(PTG).map(n => 'people/' + n + '.glb').concat(RAW.map(n => 'people/raw/' + n + '.glb'));
  const anims = ['walk', 'idle-a', 'idle-talking', 'interact', 'sitting-idle'];
  await Promise.all(all.concat(anims.map(a => `anim/${a}.glb`), ['stretcher.glb', 'ambulance.glb']).map(u => load(u)));
  for (const a of anims) ANIM[a] = (await load(`anim/${a}.glb`)).animations[0];
  for (const u of all) GL[u.replace(/^people\//, '').replace(/\.glb$/, '')] = await load(u);
  GL.amb = await load('ambulance.glb'); GL.str = await load('stretcher.glb'); people.length;
  ready = true;
}
const RING = M('#ff1010', { emissive: '#ff0000', emissiveIntensity: 2.4 }), BLANK = M('#10347f', { roughness: 0.9 }), CALL_ON = M('#ffffff', { emissive: '#fff6e0', emissiveIntensity: 3 }), CALL_OFF = M('#8d9298', { roughness: 0.4 });
const GOLD = new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.9, depthWrite: false });

/* ---------- people ---------- */
const MODEL = {
  md: () => 'md', app: s => (s.title === 'NP' ? 'np' : 'pa'), rn: s => 'rn' + (1 + hsh(s.id) % 4), pct: s => 't' + (1 + hsh(s.id) % 2), reg: s => 'reg' + (1 + hsh(s.id) % 2),
  evs: s => 'ev' + (1 + hsh(s.id) % 2), rt: () => 'rt', rph: () => 'rx', tp: () => 'tp',
};
const PTG = ['pt_05', 'pt_06', 'pt_15', 'pt_32', 'pt_female-08', 'pt_female-09', 'pt_31-female', 'pt_10'];
const RAW = ['psx-05', 'psx-06', 'psx-10', 'psx-15', 'psx-32', 'psx-female-08', 'psx-female-09', 'psx-31-female'];
function spawn(model) {
  const g = GL[model.startsWith('raw:') ? 'raw/' + model.slice(4) : model] || GL.rn1;
  const o = SU.clone(g.scene); shade(o);
  o.traverse(m => { if (m.isMesh) { m.frustumCulled = false; if (m.name.startsWith('Icosphere')) m.visible = false; } });
  const inner = new THREE.Group(); inner.add(o); const root = new THREE.Group(); root.add(inner);
  const mixer = new THREE.AnimationMixer(o);
  return { root, inner, o, mixer, acts: {}, anim: '' };
}
function play(e, name) {
  if (e.anim === name) return; const clip = ANIM[name]; if (!clip) return;
  const a = e.acts[name] || (e.acts[name] = e.mixer.clipAction(clip));
  a.reset().play(); a.time = (hsh(e.key) % 100) / 100 * clip.duration;
  if (e.acts[e.anim]) e.acts[e.anim].crossFadeTo(a, 0.25, false);
  e.anim = name;
}
/* Where an entity should be: Blender x, y, z, facing (deg), pose, and what it lies on. */
function placeFor(want) { return want; }

function roomAt(u, v) {
  for (const [id, R2] of Object.entries(api.RM)) if (u >= R2.x && u <= R2.x + R2.w && v >= R2.y && v <= R2.y + R2.h) return id;
  return null;
}
const lerp = (a, b, t) => a + (b - a) * t;
/* A spot in a room's own frame to Blender world. */
function roomPt(id, lx, ly) { const r = ROOM[id].r, c = Math.cos(r.rot * DEG), s = Math.sin(r.rot * DEG); return [r.x + lx * c - ly * s, r.y + lx * s + ly * c]; }
/* A bed or a chair outside the rooms (hallway beds H1 to H4, chairs C1 to C6). */
function smallSpot(id) {
  if (HALL3[id]) return { x: X(HALL3[id]), y: 3.6, rot: 90, kind: 'hall' };
  if (/^C\d$/.test(id)) { const [x, y] = CHAIR3(+id.slice(1) - 1); return { x, y, rot: 0, kind: 'chair' }; }
  return null;
}

function staffWant(s) {
  const [u, v, mode] = s.at; let x, y, rot = 180, anim = 'idle-a';
  if (s.brk != null) { const b = BRK3[s.brk % BRK3.length]; return { x: b[0], y: b[1], rot: b[2], anim: b[3] ? 'sitting-idle' : 'idle-talking' }; }
  if (mode === 'room') {
    const id = roomAt(u, v);
    if (id && ROOM[id]) {
      const R2 = api.RM[id], dx = Math.round(u - (R2.x + R2.w / 2)), dy = Math.round(v - (R2.y + R2.h / 2));
      let k = BEDSIDE.findIndex(b => b[0] === dx && b[1] === dy), loc = k >= 0 ? BEDSIDE3[k] : dx === 32 && dy === 10 ? [0.5, -0.7, 40] : [0.6, -0.4, -60];
      const [wx, wy] = roomPt(id, loc[0], loc[1]); return { x: wx, y: wy, rot: loc[2] + ROOM[id].r.rot, anim: s.role === 'evs' ? 'idle-a' : 'interact', room: id };
    }
    const sm = id && smallSpot(id); if (sm) return { x: sm.x + (sm.kind === 'hall' ? 0.6 : 0.7), y: sm.y - 0.7, rot: 30, anim: 'interact' };
  }
  if (mode === 'seat') { const i = s.seat || 0; return { x: 2.4 + (i % 4) * 1.55, y: i < 4 ? 0.95 : -0.25, rot: 0, anim: 'idle-talking' }; }
  if (s.role === 'reg' && Math.abs(v - 356) < 1) { const [rx, ry] = REG3(Math.round((u - 150) / 54)); return { x: rx, y: ry, rot: 180, anim: 'idle-a' }; }
  if (s.role === 'rn' && Math.abs(v - 436) < 1) { const b = BAY3[u > 400 ? 1 : 0]; return { x: b[0], y: b[1], rot: 180, anim: 'idle-talking' }; }
  [x, y] = g2b(u, v);
  if (mode === 'with') anim = 'idle-talking';
  return { x, y, rot, anim };
}
function ptWant(p) {
  const [u, v] = [p.x, p.y];
  if (p.kind === 'room') {
    if (ROOM[p.room]) { const [x, y] = roomPt(p.room, SX, SY - 0.95); return { x, y, z: 0.83, rot: ROOM[p.room].r.rot, anim: 'idle-a', lie: true, gown: true, room: p.room }; }
    const sm = smallSpot(p.room);
    if (sm && sm.kind === 'hall') return { x: sm.x + 0.86, y: sm.y, z: 0.77, rot: sm.rot, anim: 'idle-a', lie: true, gown: true };
    if (sm) return { x: sm.x, y: sm.y + 0.05, z: 0.08, rot: 0, anim: 'sitting-idle', gown: true };
  }
  if (p.kind === 'wall') { const i = Math.round((v - 62) / 46); const [x, y] = WALL3(Math.max(0, Math.min(5, i))); return { x: x + 0.86, y, z: 0.77, rot: 90, anim: 'idle-a', lie: true, stretcher: true }; }
  if (p.kind === 'seat') { const c = Math.round((u - 276) / 36), r = Math.round((v - 537) / 37); const [x, y] = SEAT3(r * 6 + c); return { x, y: y + 0.05, rot: 180, anim: 'sitting-idle' }; }
  if (p.kind === 'door') {
    if (Math.abs(v - 468) < 1) { const b = BAY3[u > 400 ? 1 : 0]; return { x: b[2], y: b[3], rot: 180, anim: 'sitting-idle' }; }
    if (Math.abs(v - 416) < 1) { const [rx] = REG3(Math.round((u - 150) / 54)); return { x: rx, y: -1.6, rot: 0, anim: 'idle-talking' }; }
    const k = Math.round((u - 138) / 44) + 3 * Math.round((584 - v) / 46); return { x: -22.2 + (k % 3) * 0.8, y: -11.6 + Math.floor(k / 3) * 1.0, rot: 0, anim: 'idle-a' };
  }
  const [x, y] = g2b(u, v); return { x, y, rot: 0, anim: 'idle-a' };
}

/* Movement: along the flat map's own route (through the openings and down the hallway), at walking pace. */
function routeFor(e, from2, to2, dest) {
  const pts = (api.route(from2, to2) || []).slice(0, -1).map(([u, v]) => g2b(u, v));
  pts.push([dest.x, dest.y]); return pts;
}
function entity(key, model) {
  let e = ENT.get(key);
  if (e && e.model !== model && !e.busy) { S.remove(e.root); ENT.delete(key); e = null; }
  if (e) return e;
  e = { key, model, path: [], seen: true }; ENT.set(key, e);
  Object.assign(e, spawn(model)); S.add(e.root); e.root.visible = false; return e;
}
function setPose(e, want) {
  e.inner.rotation.set(want.lie ? -Math.PI / 2 : 0, 0, 0);
  e.root.rotation.y = (want.rot || 0) * DEG;
  play(e, want.anim);
}
/* roll: a patient who is lying down goes on a stretcher, still lying, and the stretcher goes with them. */
function moveTo(e, want, from2, to2, roll) {
  const cur = e.root.position, start = [cur.x, -cur.z];
  const pts = from2 && to2 ? routeFor(e, from2, to2, want) : [[want.x, want.y]];
  e.path = [start].concat(pts); e.seg = 0; e.want = want; e.walking = true; e.rolling = !!roll;
  if (roll) {
    if (!e.str && GL.str) { e.str = GL.str.scene.clone(true); shade(e.str); e.str.position.set(0, -0.77, -0.86); e.root.add(e.str); }
    if (e.str) e.str.visible = true; cur.y = 0.77; e.inner.rotation.set(-Math.PI / 2, 0, 0); play(e, 'idle-a');
  } else { if (e.str) e.str.visible = false; cur.y = 0; e.inner.rotation.set(0, 0, 0); play(e, 'walk'); }
}
function stepMovers(dt) {
  const speed = 3.2 * (api.speed ? api.speed() : 1);
  for (const e of ENT.values()) {
    if (!e.walking || !e.root) continue;
    let left = speed * dt * (e.rolling ? 0.8 : 1);
    while (left > 0 && e.seg < e.path.length - 1) {
      const a = e.path[e.seg], b = e.path[e.seg + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      const p = e.root.position, cx = p.x, cy = -p.z, rem = Math.hypot(b[0] - cx, b[1] - cy);
      if (rem <= left || d < 1e-4) { p.x = b[0]; p.z = -b[1]; e.seg++; left -= rem; }
      else { p.x += (b[0] - cx) / rem * left; p.z -= (b[1] - cy) / rem * left; left = 0; }
      if (d > 1e-4) e.root.rotation.y = Math.atan2(dx, dy) + Math.PI;   // face the way they walk (models face -y)
    }
    if (e.seg >= e.path.length - 1) { e.walking = false; const w = e.want; e.root.position.copy(B2T(w.x, w.y, w.z || 0)); setPose(e, w); if (e.str) e.str.visible = !!w.keepStr; }
  }
}

/* ---------- the snapshot from map.js ---------- */
/* The light through the day (the flat map's dayTint, as a sun): warm morning, plain day, gold late afternoon, dusk
   by 19:00. A power failure runs the department on generator light: dimmer, cooler. */
const C1 = new THREE.Color(), C2 = new THREE.Color(), SKY = new THREE.Color();
let HEMI = null, lightKey = '';
function light(t, power) {
  const k = Math.round(t / 3) + (power ? 'p' : ''); if (k === lightKey || !SUN) return; lightKey = k;
  const day = '#fff6ea', warm = '#ffc07a', gold = '#ff9a48', dusk = '#7f86c8';
  let col, f = 0, sun = 2.0, sky = '#5d6066';
  if (t < 90) { f = 1 - t / 90; col = C1.set(day).lerp(C2.set(warm), f); sun = 2.0 - 0.4 * f; }
  else if (t < 540) col = C1.set(day);
  else if (t < 660) { f = (t - 540) / 120; col = C1.set(day).lerp(C2.set(gold), f * 0.8); }
  else { f = Math.min(1, (t - 660) / 60); col = C1.set(gold).lerp(C2.set(dusk), f); sun = 2.0 - 1.1 * f; sky = '#' + SKY.set('#5d6066').lerp(C2.set('#242a44'), f).getHexString(); }
  SUN.color.copy(col); SUN.intensity = sun; S.background = SKY.set(sky).clone();
  if (power) { SUN.intensity *= 0.55; HEMI.intensity = 0.42; HEMI.color.set('#c8d4ff'); R.toneMappingExposure = 0.7; }
  else { HEMI.intensity = 0.75; HEMI.color.set('#ffffff'); R.toneMappingExposure = 0.86; }
}
/* ---------- ambulances drive ----------
   A new one comes up the road from the south with its lights going, pulls past its stall, swings its nose out,
   and backs in so the back doors face the building. Leaving, it pulls out and heads back down the far lane.
   A path is a list of legs; each leg is a cubic curve in floor metres, driven forward or in reverse. */
const ROAD_X = -33.5, EXIT_X = -35.2;   // the far lane clears the tree at the south end
const cub = (P, t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]; };
const cubD = (P, t) => { const u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t; return [a * (P[1][0] - P[0][0]) + b * (P[2][0] - P[1][0]) + c * (P[3][0] - P[2][0]), a * (P[1][1] - P[0][1]) + b * (P[2][1] - P[1][1]) + c * (P[3][1] - P[2][1])]; };
const cubLen = P => { let s = 0, q = P[0]; for (let i = 1; i <= 16; i++) { const r = cub(P, i / 16); s += Math.hypot(r[0] - q[0], r[1] - q[1]); q = r; } return s; };
const fwdOf = h => [Math.sin(h), -Math.cos(h)];   // heading (three's rotation.y) to the way the cab points, on the floor
const add2 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
function leg(P, rev, speed, ease) {   // with a length table, so the ease is over distance: the curve's own pace is uneven
  const tab = [0]; let s = 0, q = P[0];
  for (let i = 1; i <= 40; i++) { const r = cub(P, i / 40); s += Math.hypot(r[0] - q[0], r[1] - q[1]); tab.push(s); q = r; }
  return { P, rev, ease, tab, len: s, dur: Math.max(0.9, s / speed) };
}
function uAt(L, f) {   // the curve parameter at a fraction of the leg's length
  const want = f * L.len, T = L.tab; let i = 1; while (i < 40 && T[i] < want) i++;
  const a = T[i - 1], b = T[i]; return (i - 1 + (b > a ? (want - a) / (b - a) : 0)) / 40;
}
function ambPlan(o, at, mode) {
  const cur = o.b, f = fwdOf(o.h), P3 = [at[0], at[1]];
  if (Math.hypot(P3[0] - cur[0], P3[1] - cur[1]) < 0.3) { o.path = null; return; }
  if (mode === 'bay') {   // forward past the stall, nose out to the left; then back in
    const nw = [-0.9, 0.44], A = [ROAD_X, at[1] - 1], P2 = [ROAD_X - 3.3, at[1] + 4.1], far = cur[1] < at[1] - 12;   // a short swing: the tree at the north end is close
    const run = Math.hypot(A[0] - cur[0], A[1] - cur[1]);
    o.path = [];
    if (run > 1) o.path.push(leg([cur, add2(cur, f, run / 3), [A[0], A[1] - run / 3], A], false, 9, far ? 'none' : 'in'));   // up the road at speed
    o.path.push(leg([run > 1 ? A : cur, add2(run > 1 ? A : cur, run > 1 ? [0, 1] : f, 2.6), add2(P2, nw, -2.6), P2], false, run > 1 && far ? 4.5 : 3, 'out'));   // swing the nose out and stop
    o.path.push(leg([P2, add2(P2, nw, -2.6), [at[0] - 4.6, at[1]], P3], true, 2.6, 'inout'));   // back in
  } else {   // a spot in line on the road: drive up to it
    const run = Math.hypot(P3[0] - cur[0], P3[1] - cur[1]);
    o.path = [leg([cur, add2(cur, f, run / 3), [P3[0], P3[1] - run / 3], P3], false, 9, cur[1] < P3[1] - 20 ? 'out' : 'inout')];
  }
  o.leg = 0; o.t = 0;
}
function ambLeave(o) {
  const cur = o.b, f = fwdOf(o.h), y1 = cur[1] - 6;
  o.leaving = true; o.leg = 0; o.t = 0;
  o.path = [leg([cur, add2(cur, f, 4), [EXIT_X, cur[1] - 1], [EXIT_X, y1]], false, 4, 'in'),
            leg([[EXIT_X, y1], [EXIT_X, y1 - 10], [EXIT_X, -60], [EXIT_X, -75]], false, 11, 'none')];
}
const EASE = { none: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inout: t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t) };
function stepAmb(dt, blink) {
  for (const [pid, o] of Array.from(AMB)) {
    let moving = false;
    if (o.path) {
      const L = o.path[o.leg]; o.t += dt;
      const u = uAt(L, EASE[L.ease](Math.min(1, o.t / L.dur))), q = cub(L.P, u), d = cubD(L.P, Math.max(0.002, Math.min(0.998, u)));
      o.b = q; if (Math.hypot(d[0], d[1]) > 1e-4) o.h = Math.atan2(L.rev ? -d[0] : d[0], L.rev ? d[1] : -d[1]);
      moving = true;
      if (o.t >= L.dur) { o.leg++; o.t = 0; if (o.leg >= o.path.length) { o.path = null; if (o.leaving) { S.remove(o.g); AMB.delete(pid); continue; } } }
    }
    o.g.position.copy(B2T(o.b[0], o.b[1])); o.g.rotation.y = o.h;
    const hot = moving && !o.leaving;
    for (const m of o.bar) m.emissiveIntensity = hot ? 0.4 + 5.6 * (blink > 0.5 ? 1 : 0) : 0.5;   // lights going on the way in
  }
}
function apply(sn) {
  const seen = new Set();
  if (sn.t != null) light(sn.t, sn.power);
  // rooms
  for (const rm of sn.rooms) {
    const R2 = ROOM[rm.id]; if (!R2) continue;
    const bad = rm.cat === 'bad', need = rm.cat === 'need' || bad;
    R2.call.material = need ? CALL_ON : CALL_OFF;
    if (bad && !R2.ring) { R2.ring = new THREE.Group(); for (const [rad, w] of [[1.32, 0.07], [1.12, 0.03]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rad, w, 8, 96), RING); t.rotation.x = Math.PI / 2; t.scale.z = 0.15; R2.ring.add(t); } R2.ring.position.copy(B2T(SX, SY, 0.015)); R2.g.add(R2.ring); }
    if (R2.ring) R2.ring.visible = bad;
    const blanket = rm.pid && rm.cat !== 'bad' && !rm.arrest;
    if (blanket && !R2.blanket) { R2.blanket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 1.05), BLANK); R2.blanket.position.copy(B2T(SX, SY - 0.55, 0.9)); R2.blanket.castShadow = true; R2.g.add(R2.blanket); }
    if (R2.blanket) R2.blanket.visible = !!blanket;
    const tc = rm.selc === 'ok' ? '#2fd36a' : CAT_C[rm.cat] || null;   // v0.20: the floor carries the flat map's colours, so "a blue room" means the same thing in 3D
    R2.tint.material.color.set(tc || '#000000'); R2.tintOn = rm.selc === 'ok' ? 'blink' : tc ? (rm.fl ? 'fl' : 'on') : '';
    R2.state = rm;
  }
  // people: staff
  for (const s of sn.staff) {
    const key = 's' + s.id, model = (MODEL[s.role] || (() => 'rn1'))(s), want = staffWant(s); seen.add(key);
    const e = entity(key, model);
    e.meta = { kind: 'staff', id: s.id, tap: !s.inRoom, label: s.label, me: s.me, sel: s.sel, role: s.role };
    if (!e.placed) { e.root.position.copy(B2T(want.x, want.y)); setPose(e, want); e.placed = true; e.root.visible = true; e.at2 = s.at; e.want = want; continue; }
    if (e.at2[0] !== s.at[0] || e.at2[1] !== s.at[1]) { moveTo(e, want, e.at2, s.at); e.at2 = s.at; }
    else if (!e.walking) { e.want = want; setPose(e, want); }
  }
  // people: patients
  for (const p of sn.pts) {
    const key = 'p' + p.id, want = ptWant(p); seen.add(key);
    const model = want.gown ? PTG[hsh(p.id) % PTG.length] : 'raw:' + RAW[hsh(p.id) % RAW.length];
    const e = entity(key, model);
    e.meta = { kind: 'pt', id: p.id, tap: p.kind !== 'room', esi: p.esi, name: p.name, sel: p.sel, ok: p.ok, kindAt: p.kind };
    const where = p.kind + '|' + (p.room || '') + '|' + Math.round(p.x) + ',' + Math.round(p.y);
    if (!e.placed) {
      const fresh = p.kind === 'door' && p.fresh;
      e.root.visible = true; e.placed = true; e.where = where; e.at2 = [p.x, p.y]; e.want = want;
      if (fresh) { e.root.position.copy(B2T(-24.2, -12.0)); moveTo(e, want, null, null); }
      else { e.root.position.copy(B2T(want.x, want.y, want.z || 0)); setPose(e, want); }
      continue;
    }
    if (e.where !== where) { moveTo(e, want, e.at2, [p.x, p.y], !!(e.want && e.want.lie)); e.where = where; e.at2 = [p.x, p.y]; }
    else if (!e.walking) { e.want = want; e.root.position.copy(B2T(want.x, want.y, want.z || 0)); setPose(e, want); }
  }
  for (const [key, e] of Array.from(ENT)) if (!seen.has(key)) {
    if (e.leaving) continue;
    if (e.meta && e.meta.kind === 'pt' && e.root && sn.left && sn.left[e.meta.id]) {   // walking out, or rolling up to the elevators or out to an ambulance
      const how = sn.left[e.meta.id], roll = how === 'up' || how === 'bay';   // admitted and transferred patients go on a stretcher
      const dest = how === 'up' ? { x: 14.8, y: -14.6, anim: 'idle-a', rot: 0 } : how === 'bay' ? { x: -24.5, y: 8.0, anim: 'idle-a', rot: 0 } : { x: -24.6, y: -12.0, anim: 'idle-a', rot: 0 };
      if (roll) Object.assign(dest, { z: 0.77, lie: true, keepStr: true });
      e.leaving = true; moveTo(e, dest, e.at2, e.at2, roll); setTimeout(() => { S.remove(e.root); ENT.delete(key); }, 9000); continue;
    }
    if (e.root) S.remove(e.root); ENT.delete(key);
  }
  // ambulances: at the bay, waiting on the drive, on the way in
  const aseen = new Set(), taken = new Set();
  for (const a of sn.amb) { const o = AMB.get(a.pid); if (a.mode === 'bay' && o && o.stall != null && !taken.has(o.stall)) taken.add(o.stall); else if (o && a.mode !== 'bay') o.stall = null; }   // a parked ambulance keeps its stall
  for (const a of sn.amb) {
    aseen.add(a.pid); let o = AMB.get(a.pid);
    if (a.mode === 'bay' && (!o || o.stall == null)) { let k = 0; while (taken.has(k) && k < 2) k++; taken.add(k); if (o) o.stall = k; else a.stall = k; }
    const at = a.mode === 'bay' ? BAY_AMB[(o && o.stall != null ? o.stall : a.stall) % 3] : a.mode === 'out' ? OUT_AMB(a.i) : IN_AMB(a.i);
    if (!o) {
      o = { g: GL.amb.scene.clone(true), bar: [], stall: a.mode === 'bay' ? a.stall : null }; shade(o.g); S.add(o.g); AMB.set(a.pid, o);
      o.g.traverse(m => { if (m.isMesh && /amb_bar/.test(m.name)) { m.material = m.material.clone(); o.bar.push(m.material); } });   // each one's light bar flashes on its own
      if (ambLive) { o.b = [ROAD_X, at[1] - 26]; o.h = Math.PI; } else { o.b = [at[0], at[1]]; o.h = at[2] * DEG; }
    }
    const key = a.mode + at.join(',');
    if (o.key !== key) { o.key = key; if (ambLive) ambPlan(o, at, a.mode); else { o.b = [at[0], at[1]]; o.h = at[2] * DEG; o.path = null; } }
    o.to = at; o.meta = a;
  }
  for (const [pid, o] of Array.from(AMB)) if (!aseen.has(pid) && !o.leaving) { o.gone = (o.gone || 0) + 1; if (o.gone > 1) { if (o.meta && o.meta.mode === 'bay' && ambLive) ambLeave(o); else { S.remove(o.g); AMB.delete(pid); } } }
  ambLive = true;   // after the first picture, new ambulances drive in; the ones already there when the floor loads are simply parked
  snap = sn;
}

/* ---------- labels and markers ---------- */
const CAT_C = { need: '#1648C8', bad: '#D11A2F', go: '#12813A', warn: '#B45309', dirty: '#7A4A1E', board: '#7B4FD0' };   // the flat map's solid tile colours (purple: admitted, waiting upstairs)
const edgeOf = rm => (rm.mine ? ['#F2C230', 6] : rm.crit ? ['#C8243A', 6] : CAT_C[rm.cat] ? [CAT_C[rm.cat], 6] : ['#1B2230', 3]);
let fullLbl = false;
function labels() {
  for (const l of LBL.values()) l.seen = false;
  const near = view.dist < view.fit * 0.45;
  // a room's width on screen decides the label: the full one (number, icon, ESI, name) needs about 150 px;
  // below that, a compact badge that fits inside the room (icon, ESI dot, number). Names come back as you zoom in.
  const roomPx = 3.8 * H / (2 * Math.tan(CAM.fov * DEG / 2) * view.dist);
  fullLbl = fullLbl ? roomPx > 135 : roomPx > 150;
  if (snap) {
    for (const rm of snap.rooms) {
      const R2 = ROOM[rm.id], sm = R2 ? null : smallSpot(rm.id); if (!R2 && !sm) continue;
      if (!rm.ico && !rm.name && !near) continue;   // zoomed out, an empty clean room says nothing
      const [x, y] = R2 ? [R2.r.x, R2.r.y] : [sm.x, sm.y];
      const l = sprite('r' + rm.id), icon = rm.ico, fl = rm.fl, name = rm.name || '', esi = rm.esi || 0;
      if (!fullLbl) { compactLabel(l, rm, roomPx * (R2 ? 1 : 0.7)); nudge(l, fl, 0.3); l.s.position.copy(B2T(x, y, R2 ? 3.2 : 1.9)); l.tap = { kind: 'room', id: rm.id }; continue; }
      const img0 = icon ? iconImg(icon) : null, key = [rm.id, icon, img0 && img0.complete, fl, name, esi, rm.crit, rm.mine, rm.cat, near].join('|'); l.icon = icon;
      const wName = name ? Math.min(230, 26 + name.length * 13) : 0, w = 104 + (esi ? 52 : 0) + wName, h = 64;
      setSprite(l, key, w * 2, h * 2, near ? 30 : 19, (g) => {
        g.scale(2, 2);
        const [ec, ew] = edgeOf(rm); pill(g, 2, 2, w - 4, h - 4, 14, 'rgba(255,255,255,.94)', ec, ew === 3 ? 2.5 : ew);
        g.fillStyle = '#1B2230'; g.font = FONT(28); g.textBaseline = 'middle'; g.fillText(rm.lab || rm.id, 12, h / 2 + 1);
        let x0 = 12 + g.measureText(rm.lab || rm.id).width + 8;
        if (icon) { const img = iconImg(icon); if (img.complete) g.drawImage(img, x0, 8, 48, 48); x0 += 54; }
        if (esi) { g.beginPath(); g.arc(x0 + 22, h / 2, 21, 0, 7); g.fillStyle = ['', '#C8243A', '#E46A1C', '#F2C230', '#2FA35B', '#3B74C4'][esi] || '#5E6878'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = esi === 3 ? '#3A2F00' : '#fff'; g.font = FONT(26); g.textAlign = 'center'; g.fillText(esi, x0 + 22, h / 2 + 2); g.textAlign = 'left'; x0 += 50; }
        if (name) { pill(g, x0, 12, wName - 6, h - 24, 8, rm.crit ? '#C8243A' : '#1B2230'); g.fillStyle = '#fff'; g.font = FONT(22); g.fillText(name, x0 + 8, h / 2 + 1); }
      });
      nudge(l, fl, 0.12);
      l.s.position.copy(B2T(x, y, R2 ? 3.2 : 1.9)); l.tap = { kind: 'room', id: rm.id };
    }
    for (const sg of snap.signs) {
      const l = sprite('z' + sg.z), key = [sg.text, sg.over, sg.full].join('|'), w = 30 + sg.text.length * 15;
      setSprite(l, key, w * 2, 84, near ? 22 : 15, g => { g.scale(2, 2); pill(g, 2, 2, w - 4, 38, 19, sg.over ? '#C8243A' : '#FFFFFF', sg.over ? '#C8243A' : sg.full ? '#B76E00' : '#8E97A4', sg.full ? 4 : 2.5); g.fillStyle = sg.over ? '#fff' : '#1B2230'; g.font = FONT(22); g.textBaseline = 'middle'; g.fillText(sg.text, 14, 22); });
      const [x, y] = g2b(sg.x + sg.w / 2, sg.y + (sg.y > 400 ? 0 : 0)); l.s.position.copy(B2T(x, sg.y > 400 ? -12.2 : sg.z === 'hall' ? 2.6 : 14.4, 3.0)); l.tap = { kind: 'zone', id: sg.z };
    }
    for (const c of snap.counts) {
      const l = sprite('c' + c.id), w = 26 + c.text.length * 15;
      setSprite(l, c.text + c.bad, w * 2, 80, near ? 22 : 16, g => { g.scale(2, 2); pill(g, 2, 2, w - 4, 36, 18, c.bad ? '#C8243A' : '#1B2230', '#FFFFFF', 2.5); g.fillStyle = '#fff'; g.font = FONT(21); g.textBaseline = 'middle'; g.fillText(c.text, 13, 21); });
      const cp = CPOS[c.id] || [0, 0]; l.s.position.copy(B2T(cp[0], cp[1], 2.6)); l.tap = c.tap ? { kind: 'clu', id: c.tap } : null;
    }
  }
  for (const e of ENT.values()) {
    if (!e.meta || !e.root || !e.root.visible) continue;
    const m = e.meta, l = sprite('e' + e.key);
    if (m.kind === 'staff') {
      const t = m.label, w = 22 + t.length * 17;
      setSprite(l, t + m.me + m.sel, w * 2, 84, near ? 24 : 14, g => { g.scale(2, 2); pill(g, 2, 2, w - 4, 38, 10, '#101215', m.sel ? '#F2C230' : m.me ? '#F2C230' : '#FFFFFF', m.sel || m.me ? 5 : 2.5); g.fillStyle = '#fff'; g.font = FONT(25); g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(t, w / 2, 22); });
    } else {
      if (m.kindAt === 'room') { l.s.visible = false; continue; }
      const t = m.esi ? String(m.esi) : '?', w = 44;
      setSprite(l, t + m.sel + m.ok, 88, 88, near ? 22 : 13, g => { g.scale(2, 2); g.beginPath(); g.arc(22, 22, 19, 0, 7); g.fillStyle = m.esi ? ['', '#C8243A', '#E46A1C', '#F2C230', '#2FA35B', '#3B74C4'][m.esi] : '#5E6878'; g.fill(); g.lineWidth = m.sel || m.ok ? 5 : 3; g.strokeStyle = m.sel ? '#F2C230' : m.ok ? '#2fd36a' : '#fff'; g.stroke(); g.fillStyle = m.esi === 3 ? '#3A2F00' : '#fff'; g.font = FONT(24); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 22, 24); });
    }
    l.s.visible = true; const p = e.root.position; l.s.position.set(p.x, p.y + (e.want && e.want.lie ? 1.0 : 2.2), p.z); l.tap = m.tap ? { kind: m.kind, id: m.id } : null;
  }
  for (const [id, l] of Array.from(LBL)) if (!l.seen) { HUD.remove(l.s); if (l.s.material.map) l.s.material.map.dispose(); LBL.delete(id); }
  sizeSprites();
}

/* Zoomed out: the room's icon with its ESI dot on the corner, and the room number under it, in a badge narrower than
   the room. A critical patient's badge has a red edge; the attending's own rooms a gold one. */
/* Something for you to do: the badge swells a little all the time and gives a quick shake every couple of seconds (v0.23). */
function nudge(l, on, amp) {
  if (!on) { l.s.material.rotation = 0; return; }
  const t = performance.now() / 1000, ph = t % 2.2, sh = ph < 0.5 ? Math.sin(Math.PI * ph / 0.5) : 0;
  l.px *= 1 + 0.06 * Math.sin(t * 6) + 0.16 * sh;
  l.s.material.rotation = amp * sh * Math.sin(ph * 2 * Math.PI * 6);
}
function compactLabel(l, rm, roomPx) {
  const icon = rm.ico, esi = rm.esi || 0, lab = String(rm.lab || rm.id), w = 100, h = 72;
  const img = icon ? iconImg(icon) : null, key = ['c', rm.id, icon, img && img.complete, esi, rm.crit, rm.mine, rm.cat, lab].join('|'); l.icon = icon;
  setSprite(l, key, w * 2, h * 2, Math.max(16, Math.min(30, roomPx * 0.55)), g => {
    g.scale(2, 2);
    const [ec, ew] = edgeOf(rm); pill(g, 3, 3, w - 6, h - 6, 12, 'rgba(255,255,255,.95)', ec, ew);
    if (img && img.complete) g.drawImage(img, 7, 7, 58, 58);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (esi) { g.beginPath(); g.arc(w - 18, 21, 14, 0, 7); g.fillStyle = ['', '#C8243A', '#E46A1C', '#F2C230', '#2FA35B', '#3B74C4'][esi] || '#5E6878'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = esi === 3 ? '#3A2F00' : '#fff'; g.font = FONT(19); g.fillText(esi, w - 18, 22); }
    g.fillStyle = '#1B2230'; g.font = FONT(lab.length > 2 ? 15 : 20); g.fillText(lab, w - 18, esi ? 53 : h / 2);
  });
}

/* ---------- camera: the whole floor by default, drag to pan, pinch or wheel to zoom ---------- */
const BOUNDS = { x0: -30.2, x1: 28.4, y0: -15.8, y1: 15.0 };   // v0.24.1: the building and the ambulance stalls, nothing more
function camSet() {
  const t = new THREE.Vector3(view.tx, 0, -view.ty);
  CAM.position.set(t.x, Math.sin(view.tilt) * view.dist, t.z + Math.cos(view.tilt) * view.dist); CAM.lookAt(t);
}
function fitDist() {
  let d = 20; const v = new THREE.Vector3(), save = { ...view };
  view.tx = (BOUNDS.x0 + BOUNDS.x1) / 2; view.ty = (BOUNDS.y0 + BOUNDS.y1) / 2;
  for (; d < 400; d *= 1.04) {
    view.dist = d; camSet(); CAM.updateMatrixWorld();
    const ok = [[BOUNDS.x0, BOUNDS.y0], [BOUNDS.x1, BOUNDS.y0], [BOUNDS.x0, BOUNDS.y1], [BOUNDS.x1, BOUNDS.y1]].every(([x, y]) => { v.copy(B2T(x, y)).project(CAM); return Math.abs(v.x) <= 0.98 && Math.abs(v.y) <= 0.96; });
    if (ok) break;
  }
  Object.assign(view, save); return d;
}
function camReset() { view.fit = fitDist(); view.dist = view.fit; view.tx = (BOUNDS.x0 + BOUNDS.x1) / 2; view.ty = (BOUNDS.y0 + BOUNDS.y1) / 2; camSet(); }
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  const r = el.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), CAM);
  const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? [p.x, -p.z] : null;
}
function clampView() {   // v0.24.1: zoomed in, you can pan to the edge of the department but not past it
  view.dist = Math.max(7, Math.min(view.fit, view.dist));
  const k = view.dist / view.fit, hx = (BOUNDS.x1 - BOUNDS.x0) / 2 * k, hy = (BOUNDS.y1 - BOUNDS.y0) / 2 * k;
  view.tx = Math.max(BOUNDS.x0 + hx, Math.min(BOUNDS.x1 - hx, view.tx)); view.ty = Math.max(BOUNDS.y0 + hy, Math.min(BOUNDS.y1 - hy, view.ty));
}
function zoomAt(f, cx, cy) {
  const before = cx != null ? groundAt(cx, cy) : null;
  view.dist /= f; clampView(); camSet(); CAM.updateMatrixWorld();
  if (before) { const after = groundAt(cx, cy); if (after) { view.tx += before[0] - after[0]; view.ty += before[1] - after[1]; clampView(); camSet(); } }
}
function bindInput() {
  const pts = new Map(); let st = null;
  const stop = e => e.stopPropagation();
  el.addEventListener('pointerdown', e => {
    stop(e); if (e.isPrimary) pts.clear();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), far: 0, slop: e.pointerType === 'mouse' ? 6 : 16 });
    st = { moved: false, view: { ...view }, g: groundAt(e.clientX, e.clientY), p: Array.from(pts.values()).map(a => [a.x, a.y]) };
  });
  el.addEventListener('pointermove', e => {
    stop(e); const me = pts.get(e.pointerId); if (!me || !st) return;
    me.x = e.clientX; me.y = e.clientY; me.far = Math.max(me.far, Math.hypot(me.x - me.x0, me.y - me.y0));
    const now = Array.from(pts.values());
    if (now.length >= 2 && st.p.length >= 2) {
      const d0 = Math.hypot(st.p[0][0] - st.p[1][0], st.p[0][1] - st.p[1][1]), d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
      if (!st.moved && Math.abs(d1 - d0) < 12 && me.far < me.slop) return;
      Object.assign(view, st.view); camSet(); CAM.updateMatrixWorld(); if (d0 > 10) zoomAt(d1 / d0, (now[0].x + now[1].x) / 2, (now[0].y + now[1].y) / 2);
      st.moved = true; api.drag(); return;
    }
    if (now.length === 1 && st.p.length >= 2) { st = { moved: true, view: { ...view }, g: groundAt(me.x, me.y), p: [[me.x, me.y]] }; return; }
    if (!st.moved && me.far < me.slop) return;
    st.moved = true; api.drag();
    Object.assign(view, st.view); camSet(); CAM.updateMatrixWorld();
    const g = groundAt(me.x, me.y); if (g && st.g) { view.tx -= g[0] - st.g[0]; view.ty -= g[1] - st.g[1]; clampView(); camSet(); }
  });
  const end = e => { pts.delete(e.pointerId); if (!pts.size) st = null; else st = { moved: true, view: { ...view }, g: null, p: Array.from(pts.values()).map(a => [a.x, a.y]) }; };
  el.addEventListener('pointerup', e => {
    stop(e); const me = pts.get(e.pointerId);
    const quick = !!(me && st && st.moved && pts.size === 1 && st.p.length === 1 && e.pointerType !== 'mouse' && performance.now() - me.t0 < 300 && me.far < 30);
    if (quick) { Object.assign(view, st.view); camSet(); }
    const tap = !!(me && st && (quick || (!st.moved && me.far < me.slop)));
    end(e); if (!tap || e.button > 0) return;
    pick(me.x0, me.y0);
  });
  el.addEventListener('pointercancel', e => { stop(e); end(e); });
  el.addEventListener('click', stop);
  el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
}
/* A tap: the nearest tappable marker or person under the finger, else the room or area of the floor it landed on. */
function pick(cx, cy) { const t = find(cx, cy); api.tap(t.kind, t.id, cx, cy, t.far); }
/* The room, hallway bed, or chair under a point on the floor (Blender x, y). */
function roomAtGround(g) {
  for (const R2 of Object.values(ROOM)) { const c = Math.cos(-R2.r.rot * DEG), s = Math.sin(-R2.r.rot * DEG), dx = g[0] - R2.r.x, dy = g[1] - R2.r.y, lx = dx * c - dy * s, ly = dx * s + dy * c; if (Math.abs(lx) <= 1.95 && Math.abs(ly) <= R2.d / 2 + 0.05) return R2.r.id; }
  for (const id of Object.keys(HALL3)) { const sm = smallSpot(id); if (Math.abs(g[0] - sm.x) < 1.3 && Math.abs(g[1] - sm.y) < 0.6) return id; }
  for (let j = 0; j < 6; j++) { const [x, y] = CHAIR3(j); if (Math.abs(g[0] - x) < 0.7 && Math.abs(g[1] - y) < 0.8) return 'C' + (j + 1); }
  return null;
}
function find(cx, cy) {
  const r = el.getBoundingClientRect(), v = new THREE.Vector3(); let best = null;
  const far = view.dist > view.fit * 0.6;
  const consider = (pos, tap, rad, lift) => { if (!tap) return; v.copy(pos); if (lift) v.y += lift; v.project(CAM); if (v.z > 1) return; const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height, d = Math.hypot(sx - cx, sy - cy); if (d < rad && (!best || d < best.d)) best = { d, tap }; };
  for (const l of LBL.values()) if (l.tap && l.s.visible && l.tap.kind !== 'room') consider(l.s.position, l.tap, l.tap.kind === 'staff' || l.tap.kind === 'pt' ? 26 : 30);
  for (const e of ENT.values()) if (e.meta && e.meta.tap && e.root && e.root.visible) consider(e.root.position, { kind: e.meta.kind, id: e.meta.id }, 30, 0.9);
  for (const [pid, o] of AMB) if (o.meta && o.meta.mode !== 'bay') consider(o.g.position, { kind: 'pt', id: pid }, 44, 1.2);
  // v0.21: a person standing in a room only wins the tap when the finger is right on them (or their tag).
  // Anywhere else in the room, or on its badge, opens the room: a nurse at the bedside no longer steals "tap her room".
  if (best && (best.tap.kind === 'staff' || best.tap.kind === 'pt') && best.d > 12) {
    const g0 = groundAt(cx, cy), inRoom = g0 && roomAtGround(g0);
    let badge = null; if (!inRoom) { const keep = best; best = null; for (const l of LBL.values()) if (l.tap && l.tap.kind === 'room') consider(l.s.position, l.tap, 34); badge = best; best = keep; }
    if (inRoom) return { kind: 'room', id: inRoom, far };
    if (badge) return { ...badge.tap, far };
  }
  if (!best) for (const l of LBL.values()) if (l.tap && l.tap.kind === 'room') consider(l.s.position, l.tap, 34);
  if (best) return { ...best.tap, far };
  const g = groundAt(cx, cy); if (!g) return { kind: null, far };
  const hit = (kind, id) => ({ kind, id, far });
  const rid = roomAtGround(g); if (rid) return hit('room', rid);
  if (g[0] > -23.5 && g[0] < -18 && g[1] > 2.5) return hit('clu', 'mWall');
  if (g[0] > -18 && g[0] < -8.7 && g[1] < -5.4) return hit('clu', 'mWait');
  if (g[0] > -23.5 && g[0] < -18 && g[1] < -2) return hit('clu', 'mDoor');
  if (g[0] > 0.5 && g[0] < 1.5 && g[1] > 0.9 && g[1] < 1.6) return hit('box', 'mBox');
  return { kind: null, far };
}

/* ---------- the loop ---------- */
function resize() {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
  if (r.width === W && r.height === H) return true;
  W = r.width; H = r.height; R.setSize(W, H, false); CAM.aspect = W / H; CAM.updateProjectionMatrix();
  const keep = view.fit && view.dist < view.fit * 0.99; const old = { ...view };
  view.fit = fitDist(); if (keep) { Object.assign(view, old, { fit: view.fit }); clampView(); camSet(); } else camReset();
  return true;
}
function frame(now) {
  raf = requestAnimationFrame(frame);
  if (!ready || !el.isConnected || document.hidden) return;
  const lv = QL[qNow] || QL.med, idle = api.live && !api.live();   // behind the menu or the pause card: two frames a second
  const fps = capFps ? Math.min(capFps, lv.fps) : lv.fps;
  if (idle ? now - lastDraw < 500 : fps < 60 && now - lastDraw < 1000 / fps - 4) return;
  const gap = lastDraw ? now - lastDraw : 16; lastDraw = now;
  if (!resize()) return;
  const dt = Math.min(0.1, clock.getDelta());
  if (qWant === 'auto' && qNow !== 'low' && gap < 400 && !idle) {   // 4 s of slow frames: one step down
    perf.t += gap; perf.n++; if (gap > 1000 / 38) perf.slow++;
    if (perf.t > 4000) { if (perf.slow > perf.n * 0.5) setQuality(qNow === 'high' ? 'med' : 'low'); perf = { t: 0, n: 0, slow: 0 }; }
  }
  for (const e of ENT.values()) if (e.mixer) e.mixer.update(dt);
  stepMovers(dt);
  const blink = (Math.sin(performance.now() / 180) + 1) / 2;
  stepAmb(Math.min(0.25, gap / 1000) * ambK, (Math.sin(performance.now() / 90) + 1) / 2);   // real time: a slow frame does not slow the drive
  RING.emissiveIntensity = 0.6 + 2.6 * blink;
  for (const R2 of Object.values(ROOM)) { R2.tint.material.opacity = R2.tintOn === 'blink' ? 0.18 + 0.14 * blink : R2.tintOn === 'fl' ? 0.26 + 0.16 * blink : R2.tintOn === 'on' ? 0.3 : 0; }
  labels();
  placeSpots();
  R.info.reset(); R.render(S, CAM); R.autoClear = false; R.clearDepth(); R.render(HUD, CAM); R.autoClear = true;
}

/* ---------- rings around what the preceptor or the Next button points at (v0.20) ----------
   map.js names each target (a room, a patient, a staff member, a pod sign, a count); the ring is an outline on top
   of the canvas, placed every frame, so it follows the camera and people who walk. */
const SPOTS = {};   // layer -> { list, cls, divs }
let capFps = 0;   // tests on software graphics cap the frame rate so the page can still answer
function rectOf(t) {
  if (!ready || !t) return null;
  const r = el.getBoundingClientRect(), v = new THREE.Vector3(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
  const put = (sx, sy, hw, hh) => { x0 = Math.min(x0, sx - hw); x1 = Math.max(x1, sx + hw); y0 = Math.min(y0, sy - hh); y1 = Math.max(y1, sy + hh); any = true; };
  const add = (p, pad = 0) => { v.copy(p).project(CAM); if (v.z > 1) return; put(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, pad, pad); };
  const addL = id => { const l = LBL.get(id); if (!l || !l.s.visible) return; v.copy(l.s.position).project(CAM); if (v.z > 1) return; put(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, l.px * l.aspect / 2, l.px / 2); };
  if (t.kind === 'room') {
    const R2 = ROOM[t.id];
    if (R2) { const c = Math.cos(R2.r.rot * DEG), s = Math.sin(R2.r.rot * DEG); for (const [lx, ly] of [[-1.9, -R2.d / 2], [1.9, -R2.d / 2], [-1.9, R2.d / 2], [1.9, R2.d / 2]]) add(B2T(R2.r.x + lx * c - ly * s, R2.r.y + lx * s + ly * c)); }
    else { const sm = smallSpot(t.id); if (sm) for (const [dx, dy] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) add(B2T(sm.x + dx, sm.y + dy)); }
    addL('r' + t.id);
  } else if (t.kind === 'pt' || t.kind === 'staff') {
    const e = ENT.get((t.kind === 'staff' ? 's' : 'p') + t.id);
    if (e && e.root && e.root.visible) { add(e.root.position, 12); const top = e.root.position.clone(); top.y += 2.2; add(top, 12); addL('e' + e.key); }
    else { const o = AMB.get(t.id); if (o) { add(o.g.position, 26); const top = o.g.position.clone(); top.y += 2.4; add(top, 26); } }
  } else if (t.kind === 'zone') addL('z' + t.id);
  else if (t.kind === 'count') addL('c' + t.id);
  return any ? { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 } : null;
}
function placeSpots() {
  for (const sp of Object.values(SPOTS)) {
    while (sp.divs.length < sp.list.length) { const d = document.createElement('div'); d.className = 'ring3d ' + sp.cls; document.body.appendChild(d); sp.divs.push(d); }
    sp.divs.forEach((d, i) => {
      const rc = i < sp.list.length ? rectOf(sp.list[i]) : null;
      if (!rc) { d.hidden = true; return; }
      const pad = 6; d.hidden = false; d.className = 'ring3d ' + sp.cls;
      d.style.cssText = `left:${(rc.left - pad).toFixed(0)}px;top:${(rc.top - pad).toFixed(0)}px;width:${(rc.width + 2 * pad).toFixed(0)}px;height:${(rc.height + 2 * pad).toFixed(0)}px`;
    });
  }
}
/* Pan so a target sits in the part of the floor the coach card leaves clear. */
function bring(t, free) {
  const rc = rectOf(t); if (!rc) return false;
  const pad = 16; if (rc.left >= free.left + pad && rc.right <= free.right - pad && rc.top >= free.top + pad && rc.bottom <= free.bottom - pad) return false;
  const a = groundAt((rc.left + rc.right) / 2, (rc.top + rc.bottom) / 2), b = groundAt((free.left + free.right) / 2, (free.top + free.bottom) / 2);
  if (!a || !b) return false;
  view.tx += a[0] - b[0]; view.ty += a[1] - b[1]; clampView(); camSet(); CAM.updateMatrixWorld(); placeSpots(); return true;
}

/* ---------- the public face ---------- */
window.OC3D = {
  ok: (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })(),
  init(container, hooks) {
    if (el === container) return true;
    if (!this.ok) return false;
    el = container; api = hooks;
    try {
      R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { failed = true; return false; }
    R.info.autoReset = false; R.toneMapping = THREE.AgXToneMapping; R.toneMappingExposure = 0.86; R.outputColorSpace = THREE.SRGBColorSpace;
    R.domElement.className = 'floor3d'; el.appendChild(R.domElement);
    // the 3D floor acts on pointerup; the click a browser makes afterwards would land on whatever just opened (and close it)
    R.domElement.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    S = new THREE.Scene(); HUD = new THREE.Scene(); S.background = new THREE.Color('#5d6066');
    S.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture; S.environmentIntensity = 0.3;
    HEMI = new THREE.HemisphereLight('#ffffff', '#8a8f96', 0.75); S.add(HEMI);
    const sun = SUN = new THREE.DirectionalLight('#fff6ea', 2.0); sun.position.set(-20, 45, 25);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.target.position.set(2, 0, 0); S.add(sun, sun.target);
    setQuality(qStart());
    CAM = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    bindInput(); build().catch(err => { failed = true; console.error('3D floor failed to load', err); if (api.fail) api.fail(err); });
    raf = requestAnimationFrame(frame); return true;
  },
  ready: () => ready, failed: () => failed,
  sync(sn) { if (ready) { try { apply(sn); } catch (err) { console.warn('3D floor', err); } } },
  zoom(f) { if (!ready) return; if (!f) camReset(); else zoomAt(f); },
  zoomed: () => !!(view.fit && view.dist < view.fit * 0.97),
  far: () => !view.fit || view.dist > view.fit * 0.6,
  reset() { for (const e of ENT.values()) if (e.root) S.remove(e.root); ENT.clear(); for (const o of AMB.values()) S.remove(o.g); AMB.clear(); ambLive = false; camReset(); },
  // where something is on screen (for the Next button and the Orientation): kind 'room' or 'pt' or 'staff'
  screenOf(kind, id) {
    if (!ready) return null; const r = el.getBoundingClientRect(), v = new THREE.Vector3();
    if (kind === 'room' && ROOM[id]) v.copy(B2T(ROOM[id].r.x, ROOM[id].r.y, 1)); else { const e = ENT.get((kind === 'staff' ? 's' : 'p') + id); if (!e || !e.root) return null; v.copy(e.root.position); v.y += 1; }
    v.project(CAM); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
  // v0.20: rings and camera moves for the Orientation, lessons, and the Next button
  spot(layer, list, cls) { const sp = SPOTS[layer] || (SPOTS[layer] = { list: [], cls: cls || 'spotring', divs: [] }); sp.list = list || []; sp.cls = cls || sp.cls; if (!sp.list.length) for (const d of sp.divs) d.hidden = true; else if (ready) placeSpots(); },
  rectOf: t => rectOf(t),
  bring: (t, free) => (ready ? bring(t, free) : false),
  full: () => fullLbl,
  fps(n) { capFps = n || 0; },
  hideSpots() { for (const sp of Object.values(SPOTS)) { sp.list = []; for (const d of sp.divs) d.hidden = true; } },
  quality(q) { if (q) { qWant = q; if (R) setQuality(qStart()); } return { want: qWant, now: qNow }; },
  info: () => (R ? { calls: R.info.render.calls, tris: R.info.render.triangles, dpr, q: qNow } : null),
  _view: view, _cam(o) { Object.assign(view, o); clampView(); camSet(); }, _amb: () => AMB, _ambK(k) { ambK = k; }, _ambStep(s) { stepAmb(s, 1); }, ambParked(id) { const o = AMB.get(id); return !!(o && !o.path && !o.leaving && o.meta && o.meta.mode === 'bay'); }, find: (x, y) => find(x, y), _scene: () => S, _ent: () => ENT,
};
