/* Overcrowded: the 3D floor (v0.18). A renderer only: map.js still decides where everyone is and what each room shows,
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
const BAY_AMB = [[-27, 10.2, 90], [-27, 5.4, 90], [-27, 0.6, 90]], OUT_AMB = k => [-33.5, 2.0 - k * 6.6, 180], IN_AMB = k => [-33.5, -22 - k * 7, 180];
const CPOS = { wall: [-20.7, 13.9], wait: [-13.2, -5.5], door: [-21.2, -13.2], out: [-27.5, -2.0], in: [-27.5, -9.0], box: [1.0, 1.4], ct: [-6.0, -14.2], lab: [4.6, -14.6] };
const SX = -0.25, SY = 0.35;   // the bed in a room's own frame
const BEDSIDE = [[-35, -5], [35, -5], [-35, 15], [35, 15], [-35, 5], [35, 5]];
const BEDSIDE3 = [[0.5, 0.3, -90], [-0.95, 0.2, 90], [0.5, -0.6, -90], [-0.95, -0.6, 90], [0.5, 1.0, -90], [-0.95, 1.0, 90]];

/* ---------- module state ---------- */
let R, S, CAM, HUD, el, api, L = null, ready = false, failed = false, dpr = 1, W = 0, H = 0, raf = 0;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), cache = {};
const load = u => (cache[u] ||= loader.loadAsync(BASE + u));
const GL = {}, ROOM = {}, ENT = new Map(), AMB = new Map(), ROOMX = {}, LBL = new Map(), ANIM = {};
const view = { tx: 2, ty: -1, dist: 60, fit: 60, tilt: 52 * DEG };
let snap = null, clock = new THREE.Clock(), lastPick = [];

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
  L = await (await fetch(BASE + 'layout.json')).json();
  const st = (await load('dept_static.glb')).scene; shade(st); S.add(st);
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
  GL.amb = await load('ambulance.glb'); people.length;
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
function moveTo(e, want, from2, to2) {
  const cur = e.root.position, start = [cur.x, -cur.z];
  const pts = from2 && to2 ? routeFor(e, from2, to2, want) : [[want.x, want.y]];
  e.path = [start].concat(pts); e.seg = 0; e.want = want; e.walking = true;
  e.inner.rotation.set(0, 0, 0); play(e, 'walk');
}
function stepMovers(dt) {
  const speed = 3.2 * (api.speed ? api.speed() : 1);
  for (const e of ENT.values()) {
    if (!e.walking || !e.root) continue;
    let left = speed * dt;
    while (left > 0 && e.seg < e.path.length - 1) {
      const a = e.path[e.seg], b = e.path[e.seg + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
      const p = e.root.position, cx = p.x, cy = -p.z, rem = Math.hypot(b[0] - cx, b[1] - cy);
      if (rem <= left || d < 1e-4) { p.x = b[0]; p.z = -b[1]; e.seg++; left -= rem; }
      else { p.x += (b[0] - cx) / rem * left; p.z -= (b[1] - cy) / rem * left; left = 0; }
      if (d > 1e-4) e.root.rotation.y = Math.atan2(dx, dy) + Math.PI;   // face the way they walk (models face -y)
    }
    if (e.seg >= e.path.length - 1) { e.walking = false; const w = e.want; e.root.position.copy(B2T(w.x, w.y, w.z || 0)); setPose(e, w); }
  }
}

/* ---------- the snapshot from map.js ---------- */
function apply(sn) {
  const seen = new Set();
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
    R2.tint.material.color.set(rm.selc === 'ok' ? '#2fd36a' : '#000000'); R2.tintOn = rm.selc === 'ok';
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
    if (e.where !== where) { moveTo(e, want, e.at2, [p.x, p.y]); e.where = where; e.at2 = [p.x, p.y]; }
    else if (!e.walking) { e.want = want; e.root.position.copy(B2T(want.x, want.y, want.z || 0)); setPose(e, want); }
  }
  for (const [key, e] of Array.from(ENT)) if (!seen.has(key)) {
    if (e.leaving) continue;
    if (e.meta && e.meta.kind === 'pt' && e.root && sn.left && sn.left[e.meta.id]) {   // walking out, or rolling up to the elevators or out to an ambulance
      const how = sn.left[e.meta.id], dest = how === 'up' ? { x: 14.8, y: -14.6, anim: 'idle-a', rot: 0 } : how === 'bay' ? { x: -24.5, y: 8.0, anim: 'idle-a', rot: 0 } : { x: -24.6, y: -12.0, anim: 'idle-a', rot: 0 };
      e.leaving = true; moveTo(e, dest, e.at2, e.at2); setTimeout(() => { S.remove(e.root); ENT.delete(key); }, 9000); continue;
    }
    if (e.root) S.remove(e.root); ENT.delete(key);
  }
  // ambulances: at the bay, waiting on the drive, on the way in
  const aseen = new Set();
  for (const a of sn.amb) {
    aseen.add(a.pid); let o = AMB.get(a.pid);
    const at = a.mode === 'bay' ? BAY_AMB[a.i % 3] : a.mode === 'out' ? OUT_AMB(a.i) : IN_AMB(a.i);
    if (!o) { o = { g: GL.amb.scene.clone(true) }; shade(o.g); S.add(o.g); o.g.position.copy(B2T(at[0], at[1] - 14)); AMB.set(a.pid, o); }
    o.to = at; o.meta = a; o.g.rotation.y = at[2] * DEG;
  }
  for (const [pid, o] of Array.from(AMB)) if (!aseen.has(pid)) { o.gone = (o.gone || 0) + 1; if (o.gone > 1) { S.remove(o.g); AMB.delete(pid); } }
  snap = sn;
}

/* ---------- labels and markers ---------- */
function labels() {
  for (const l of LBL.values()) l.seen = false;
  const near = view.dist < view.fit * 0.45;
  if (snap) {
    for (const rm of snap.rooms) {
      const R2 = ROOM[rm.id], sm = R2 ? null : smallSpot(rm.id); if (!R2 && !sm) continue;
      if (!rm.ico && !rm.name && !near) continue;   // zoomed out, an empty clean room says nothing
      const [x, y] = R2 ? [R2.r.x, R2.r.y] : [sm.x, sm.y];
      const l = sprite('r' + rm.id), icon = rm.ico, fl = rm.fl, name = rm.name || '', esi = rm.esi || 0;
      const key = [rm.id, icon, fl, name, esi, rm.crit, rm.mine, near].join('|');
      const wName = name ? Math.min(230, 26 + name.length * 13) : 0, w = 104 + (esi ? 52 : 0) + wName, h = 64;
      setSprite(l, key, w * 2, h * 2, near ? 30 : 19, (g) => {
        g.scale(2, 2);
        pill(g, 2, 2, w - 4, h - 4, 14, 'rgba(255,255,255,.94)', rm.mine ? '#F2C230' : '#1B2230', rm.mine ? 6 : 2.5);
        g.fillStyle = '#1B2230'; g.font = FONT(28); g.textBaseline = 'middle'; g.fillText(rm.lab || rm.id, 12, h / 2 + 1);
        let x0 = 12 + g.measureText(rm.lab || rm.id).width + 8;
        if (icon) { const img = iconImg(icon); if (img.complete) g.drawImage(img, x0, 8, 48, 48); x0 += 54; }
        if (esi) { g.beginPath(); g.arc(x0 + 22, h / 2, 21, 0, 7); g.fillStyle = ['', '#C8243A', '#E46A1C', '#F2C230', '#2FA35B', '#3B74C4'][esi] || '#5E6878'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = esi === 3 ? '#3A2F00' : '#fff'; g.font = FONT(26); g.textAlign = 'center'; g.fillText(esi, x0 + 22, h / 2 + 2); g.textAlign = 'left'; x0 += 50; }
        if (name) { pill(g, x0, 12, wName - 6, h - 24, 8, rm.crit ? '#C8243A' : '#1B2230'); g.fillStyle = '#fff'; g.font = FONT(22); g.fillText(name, x0 + 8, h / 2 + 1); }
      });
      const pulse = fl ? 1 + 0.08 * Math.sin(performance.now() / 160) : 1; l.px *= pulse;
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

/* ---------- camera: the whole floor by default, drag to pan, pinch or wheel to zoom ---------- */
const BOUNDS = { x0: -29, x1: 29, y0: -16.5, y1: 15 };
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
function clampView() { view.dist = Math.max(7, Math.min(view.fit, view.dist)); view.tx = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, view.tx)); view.ty = Math.max(BOUNDS.y0 - 6, Math.min(BOUNDS.y1, view.ty)); }
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
function find(cx, cy) {
  const r = el.getBoundingClientRect(), v = new THREE.Vector3(); let best = null;
  const far = view.dist > view.fit * 0.6;
  const consider = (pos, tap, rad, lift) => { if (!tap) return; v.copy(pos); if (lift) v.y += lift; v.project(CAM); if (v.z > 1) return; const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height, d = Math.hypot(sx - cx, sy - cy); if (d < rad && (!best || d < best.d)) best = { d, tap }; };
  for (const l of LBL.values()) if (l.tap && l.s.visible && l.tap.kind !== 'room') consider(l.s.position, l.tap, l.tap.kind === 'staff' || l.tap.kind === 'pt' ? 26 : 30);
  for (const e of ENT.values()) if (e.meta && e.meta.tap && e.root && e.root.visible) consider(e.root.position, { kind: e.meta.kind, id: e.meta.id }, 30, 0.9);
  for (const [pid, o] of AMB) if (o.meta && o.meta.mode !== 'bay') consider(o.g.position, { kind: 'pt', id: pid }, 44, 1.2);
  if (!best) for (const l of LBL.values()) if (l.tap && l.tap.kind === 'room') consider(l.s.position, l.tap, 34);
  if (best) return { ...best.tap, far };
  const g = groundAt(cx, cy); if (!g) return { kind: null, far };
  const hit = (kind, id) => ({ kind, id, far });
  for (const R2 of Object.values(ROOM)) { const [lx, ly] = (() => { const c = Math.cos(-R2.r.rot * DEG), s = Math.sin(-R2.r.rot * DEG), dx = g[0] - R2.r.x, dy = g[1] - R2.r.y; return [dx * c - dy * s, dx * s + dy * c]; })(); if (Math.abs(lx) <= 1.95 && Math.abs(ly) <= R2.d / 2 + 0.05) return hit('room', R2.r.id); }
  for (const id of Object.keys(HALL3)) { const sm = smallSpot(id); if (Math.abs(g[0] - sm.x) < 1.3 && Math.abs(g[1] - sm.y) < 0.6) return hit('room', id); }
  for (let j = 0; j < 6; j++) { const [x, y] = CHAIR3(j); if (Math.abs(g[0] - x) < 0.7 && Math.abs(g[1] - y) < 0.8) return hit('room', 'C' + (j + 1)); }
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
function frame() {
  raf = requestAnimationFrame(frame);
  if (!ready || !el.isConnected || document.hidden) return;
  if (!resize()) return;
  const dt = Math.min(0.1, clock.getDelta());
  for (const e of ENT.values()) if (e.mixer) e.mixer.update(dt);
  stepMovers(dt);
  for (const o of AMB.values()) { const p = o.g.position, t = B2T(o.to[0], o.to[1]); p.lerp(t, Math.min(1, dt * 1.5)); }
  const blink = (Math.sin(performance.now() / 180) + 1) / 2;
  RING.emissiveIntensity = 0.6 + 2.6 * blink;
  for (const R2 of Object.values(ROOM)) { R2.tint.material.opacity = R2.tintOn ? 0.18 + 0.14 * blink : 0; }
  labels();
  R.render(S, CAM); R.autoClear = false; R.clearDepth(); R.render(HUD, CAM); R.autoClear = true;
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
    dpr = Math.min(window.devicePixelRatio || 1, 2); R.setPixelRatio(dpr);
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.AgXToneMapping; R.toneMappingExposure = 0.86; R.outputColorSpace = THREE.SRGBColorSpace;
    R.domElement.className = 'floor3d'; el.appendChild(R.domElement);
    S = new THREE.Scene(); HUD = new THREE.Scene(); S.background = new THREE.Color('#5d6066');
    S.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture; S.environmentIntensity = 0.3;
    S.add(new THREE.HemisphereLight('#ffffff', '#8a8f96', 0.75));
    const sun = new THREE.DirectionalLight('#fff6ea', 2.0); sun.position.set(-20, 45, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.target.position.set(2, 0, 0); S.add(sun, sun.target);
    CAM = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    bindInput(); build().catch(err => { failed = true; console.error('3D floor failed to load', err); if (api.fail) api.fail(err); });
    raf = requestAnimationFrame(frame); return true;
  },
  ready: () => ready, failed: () => failed,
  sync(sn) { if (ready) { try { apply(sn); } catch (err) { console.warn('3D floor', err); } } },
  zoom(f) { if (!ready) return; if (!f) camReset(); else zoomAt(f); },
  zoomed: () => !!(view.fit && view.dist < view.fit * 0.97),
  far: () => !view.fit || view.dist > view.fit * 0.6,
  reset() { for (const e of ENT.values()) if (e.root) S.remove(e.root); ENT.clear(); for (const o of AMB.values()) S.remove(o.g); AMB.clear(); camReset(); },
  // where something is on screen (for the Next button and the Orientation): kind 'room' or 'pt' or 'staff'
  screenOf(kind, id) {
    if (!ready) return null; const r = el.getBoundingClientRect(), v = new THREE.Vector3();
    if (kind === 'room' && ROOM[id]) v.copy(B2T(ROOM[id].r.x, ROOM[id].r.y, 1)); else { const e = ENT.get((kind === 'staff' ? 's' : 'p') + id); if (!e || !e.root) return null; v.copy(e.root.position); v.y += 1; }
    v.project(CAM); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
  _view: view, find: (x, y) => find(x, y),
};
