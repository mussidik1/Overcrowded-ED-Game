/* ---------- the floor plan (v0.8): a top-down ED with beds, chairs, and people ----------
   SVG on a 1600 x 700 floor. Rooms, pod signs, patients in the waiting room and on the wall,
   and staff are all tappable, and do what the list board's tiles and chips do. People walk
   between spots. Phones held sideways see part of the floor and drag to move around. */
const MW = 1600, MH = 730;
const RM = {};
{
  const put = (id, x, y, w, h) => { RM[id] = { x, y, w, h }; };
  ['R1', 'R2', 'R3', 'R4'].forEach((id, i) => put(id, 340 + (i % 2) * 113, 10 + (i >> 1) * 154, 106, 148));
  const pod = (ids, x0, y0) => ids.forEach((id, i) => put(id, x0 + (i % 2) * 116, y0 + (i >> 1) * 108, 108, 101));
  pod(['1', '2', '3', '4'], 586, 30); pod(['5', '6', '7', '8'], 830, 30); pod(['9', '10', '11', '12'], 1074, 30);
  pod(['13', '14', '15', '16'], 586, 396); pod(['17', '18', '19', '20'], 830, 396); pod(['FT1', 'FT2', 'FT3', 'FT4'], 1074, 396);
  [['H1', 586], ['H2', 700], ['H3', 1074], ['H4', 1188]].forEach(([id, x]) => put(id, x, 248, 108, 44));
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].forEach((id, i) => put(id, 1366 + (i % 2) * 114, 278 + (i >> 1) * 64, 104, 56));
}
// Pod signs: where each zone's label sits (tap it to assign nurses).
const ZSIGN = { resus: [340, 316, 219], a: [586, 6, 224], b: [830, 6, 224], c: [1074, 6, 224], d: [586, 610, 224], e: [830, 610, 224], ft: [1074, 610, 224], hall: [814, 250, 252] };
// Where people stand when they aren't with a patient: two lanes down the hallway, clear of signs and room numbers.
const POD_SPOT = { a: [604, 310], b: [706, 310], c: [1092, 310], hall: [1194, 310], d: [604, 352], e: [706, 352], ft: [1092, 352], hold: [1194, 352], rp: [1478, 472], resus: [500, 362] };
const ROLE_HOME = { evs: [1392, 612], rt: [452, 414], rph: [1124, 664], tp: [1240, 668] };
const TECH_COL = [1322, 262];   // techs line up between Pod C and the results chairs
const PROV_SEATS = [[862, 328], [914, 328], [966, 328], [1018, 328], [862, 366], [914, 366], [966, 366], [1018, 366]];
const TRI_BAYS = [[352, 366, 404], [402, 366, 404]];   // triage booth: [x, nurse y, patient y]
const WAIT_SEATS = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) WAIT_SEATS.push([340 + c * 38, 478 + r * 44]);
const BREAK_SEATS = [[1395, 60], [1455, 52], [1515, 60], [1395, 150], [1455, 158], [1515, 150], [1395, 209], [1445, 209], [1495, 209]];
const WALL_Y = i => 44 + i * 47;
const SKIN = ['#F1C7A5', '#E0A57E', '#C68642', '#8D5524', '#5C3A21'];
const HAIR = ['#2B1D14', '#5A3825', '#8B4A2B', '#D2AE6D', '#1B1B1B', '#A7A7A7'];
const CLOTHES = ['#6E8FB7', '#B5835A', '#7D9A6B', '#A86F8F', '#5C6B7A', '#C29A3B', '#8A6FB0'];
const ESIC = { 1: '#E7A2AB', 2: '#F2BE8F', 3: '#F1DA86', 4: '#A9D6B5', 5: '#A9C3E8' };
const ROLEC = { md: '#22306C', app: '#0D716E', rn: '#66399A', pct: '#9C5418', evs: '#4F5F68', rt: '#1E7896', rph: '#7B4A73', reg: '#5E6C12', tp: '#A3417A', ems: '#1F2A44' };
const hsh = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pickH = (arr, s, salt) => arr[hsh(String(s) + (salt || '')) % arr.length];

/* A person seen from above: shoulders, hands, head, hair. */
function figSVG(o) {
  const skin = pickH(SKIN, o.seed), hair = pickH(HAIR, o.seed, 'h'), body = o.body || '#888', coat = o.coat;
  return `<g class="fg" transform="scale(${o.k || 1.3})">${o.ring ? '<circle r="17" fill="rgba(242,194,48,.35)" stroke="#F2C230" stroke-width="3"/>' : ''}
<ellipse cx="0" cy="3" rx="13" ry="8.5" fill="rgba(0,0,0,.14)"/>
<circle cx="-11" cy="1" r="3.4" fill="${skin}"/><circle cx="11" cy="1" r="3.4" fill="${skin}"/>
<ellipse cx="0" cy="0" rx="11.5" ry="7.5" fill="${coat || body}" stroke="${coat ? '#AEB6C0' : 'rgba(0,0,0,.25)'}" stroke-width="1"/>
${coat ? `<path d="M-4 -6 L0 2 L4 -6" fill="${body}"/>` : ''}${o.stripe ? `<rect x="-11" y="-1.2" width="22" height="2.4" fill="${o.stripe}"/>` : ''}
<circle cx="0" cy="-1" r="6.4" fill="${skin}" stroke="rgba(0,0,0,.2)" stroke-width=".8"/>
<path d="M-6.4 -1.5 A6.4 6.4 0 0 1 6.4 -1.5 A6.4 3.4 0 0 0 -6.4 -1.5Z" fill="${hair}"/>
${o.tag ? `<g transform="translate(0 15.5)"><rect x="-${o.tag.length * 2.9 + 4}" y="-6.5" width="${o.tag.length * 5.8 + 8}" height="12" rx="6" fill="${o.tagFg || '#1B2230'}"/><text x="0" y="3" text-anchor="middle" font-size="9.2" font-weight="700" fill="#FFFFFF">${esc(o.tag)}</text></g>` : ''}</g>`;
}
/* A bed or stretcher, with the patient in it. */
function bedSVG(w, h, p, kind, esi) {
  const horiz = kind === 'hall', bw = kind === 'resus' ? 46 : horiz ? 84 : 42, bh = kind === 'resus' ? 92 : horiz ? 30 : 70;
  const x = (w - bw) / 2, y = (h - bh) / 2 + (horiz ? 0 : 2);
  let s = `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="7" fill="#FFFFFF" stroke="#B9C0CA" stroke-width="1.6"/>`;
  s += horiz ? `<rect x="${x + 4}" y="${y + 6}" width="18" height="${bh - 12}" rx="5" fill="#EEF1F5"/>` : `<rect x="${x + 6}" y="${y + 5}" width="${bw - 12}" height="16" rx="5" fill="#EEF1F5"/>`;
  if (kind === 'resus') s += `<circle cx="${w / 2 - 26}" cy="${y - 2}" r="5" fill="#F7E7A6" stroke="#C9B26A"/><circle cx="${w / 2 + 26}" cy="${y - 2}" r="5" fill="#F7E7A6" stroke="#C9B26A"/>`;
  if (!p) return s;
  const skin = pickH(SKIN, p.id), hair = pickH(HAIR, p.id, 'h'), blanket = esi ? ESIC[esi] : '#D5DAE1';
  if (horiz) {
    s += `<rect x="${x + 30}" y="${y + 3}" width="${bw - 34}" height="${bh - 6}" rx="6" fill="${blanket}"/>`;
    s += `<circle cx="${x + 15}" cy="${y + bh / 2}" r="7.5" fill="${skin}"/><path d="M${x + 8} ${y + bh / 2 - 6} a8 8 0 0 0 0 12 l2 0 a6 7 0 0 1 0 -12z" fill="${hair}"/>`;
  } else {
    s += `<rect x="${x + 3}" y="${y + 24}" width="${bw - 6}" height="${bh - 28}" rx="6" fill="${blanket}"/><path d="M${x + 3} ${y + 30} h${bw - 6}" stroke="rgba(255,255,255,.7)" stroke-width="3"/>`;
    s += `<circle cx="${x + bw / 2}" cy="${y + 15}" r="8" fill="${skin}"/><path d="M${x + bw / 2 - 8} ${y + 13} a8 8 0 0 1 16 0 a8 4 0 0 0 -16 0z" fill="${hair}"/>`;
  }
  return s;
}
function chairSVG(x, y, p, big) {
  const r = big ? 15 : 12;
  let s = `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="${big ? 8 : 5}" fill="${big ? '#8FA3B8' : '#9AA6B4'}"/><rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${big ? 8 : 6}" rx="3" fill="${big ? '#71879E' : '#808D9C'}"/>`;
  if (p) s += `<g transform="translate(${x} ${y + 2})">${figSVG({ seed: p.id, body: pickH(CLOTHES, p.id, 'c') })}</g>`;
  return s;
}
function ambSVG(x, y, rot) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
<rect x="-30" y="-58" width="60" height="116" rx="9" fill="#FFFFFF" stroke="#8C96A3" stroke-width="2"/>
<rect x="-26" y="-50" width="52" height="22" rx="5" fill="#2F3A4A"/>
<rect x="-30" y="2" width="60" height="9" fill="#C8243A"/><rect x="-4" y="16" width="8" height="24" fill="#C8243A"/><rect x="-12" y="24" width="24" height="8" fill="#C8243A"/>
<rect x="-18" y="-25" width="15" height="6" rx="2" fill="#B9BFC8"/><rect x="3" y="-25" width="15" height="6" rx="2" fill="#B9BFC8"/></g>`;
}

/* The building itself: outside, floors, walls, desks, furniture, signs. Drawn once. */
function mapStatic() {
  let s = '';
  s += `<rect x="0" y="0" width="172" height="${MH}" fill="#5C646E"/><rect x="0" y="0" width="172" height="${MH}" fill="url(#asphalt)"/>`;
  s += `<path d="M86 300 V610" stroke="#E9E3C6" stroke-width="3" stroke-dasharray="14 12"/>`;
  s += `<rect x="0" y="628" width="172" height="102" fill="#D8D3C4"/><path d="M0 628 H172" stroke="#BDB6A3" stroke-width="3"/>`;
  s += `<text x="10" y="22" font-size="13" font-weight="700" fill="#F3EFDF" letter-spacing="1">AMBULANCE BAY</text><text x="10" y="720" font-size="12" font-weight="700" fill="#6B6556" letter-spacing="1">FRONT ENTRANCE</text>`;
  s += `<rect x="172" y="0" width="${MW - 172}" height="${MH}" fill="#EDE8DE"/>`;
  s += `<rect x="172" y="0" width="160" height="330" fill="#E4E7EC"/><rect x="332" y="0" width="240" height="330" fill="#E9EEF5"/>`;
  s += `<rect x="172" y="330" width="400" height="${MH - 330}" fill="#F2ECE0"/><rect x="572" y="240" width="778" height="152" fill="#E7E1D4"/>`;
  s += `<rect x="1350" y="0" width="250" height="250" fill="#EFE6D6"/><rect x="1350" y="250" width="250" height="250" fill="#ECEFF2"/><rect x="572" y="626" width="778" height="104" fill="#E9EAEC"/>`;
  const W = d => `<path d="${d}" stroke="#2B3240" stroke-width="5" fill="none" stroke-linecap="square"/>`;
  s += W(`M172 0 V28 M172 312 V634 M172 720 V${MH}`);
  s += W(`M332 0 V330 M172 330 H340 M560 330 H572 M572 0 V240 M572 392 V626`);
  s += W(`M572 626 H1350 M1350 0 V250 M1350 500 V${MH} M1350 250 H1600 M1350 500 H1600 M1350 330 V420`);
  s += `<path d="M172 30 V310" stroke="#8FD0E8" stroke-width="5" stroke-dasharray="44 8"/><path d="M172 636 V718" stroke="#8FD0E8" stroke-width="5" stroke-dasharray="36 6"/>`;
  const L = (x, y, t, a) => `<text x="${x}" y="${y}" font-size="12" font-weight="700" fill="#5E6878" letter-spacing="1.2" text-anchor="${a || 'start'}">${t}</text>`;
  s += L(180, 20, 'THE WALL') + L(1360, 22, 'BREAK ROOM') + L(1360, 270, 'RESULTS CHAIRS');
  s += L(586, 720, 'CT') + L(714, 720, 'X-RAY') + L(822, 720, 'ULTRASOUND') + L(1070, 720, 'PHARMACY') + L(1210, 720, 'TO THE FLOORS') + L(1360, 720, 'EVS + SUPPLY');
  s += `<rect x="182" y="372" width="122" height="20" rx="4" fill="#B98D5E"/><rect x="198" y="374" width="16" height="9" rx="2" fill="#2F3A4A"/><rect x="252" y="374" width="16" height="9" rx="2" fill="#2F3A4A"/>${L(184, 406, 'REGISTRATION')}`;
  s += `<g data-act="zone" data-arg="triage"><rect x="318" y="342" width="110" height="88" rx="6" fill="#F7F3EA" stroke="#C9BFA8" stroke-width="2"/><path d="M318 342 h110" stroke="#7E9CC2" stroke-width="6" stroke-dasharray="8 4"/>${L(326, 424, 'TRIAGE')}</g>`;
  s += `<g data-act="zone" data-arg="triage" id="mWait"><rect x="320" y="440" width="244" height="250" fill="transparent"/>${L(330, 456, 'WAITING ROOM')}`;
  for (const [x, y] of WAIT_SEATS) s += chairSVG(x, y, null);
  s += `</g>`;
  s += `<path d="M822 298 h236 v44 h-18 v-26 h-200 v26 h-18z" fill="#B98D5E"/><text x="940" y="311.5" text-anchor="middle" font-size="10.5" font-weight="700" fill="#FFF6E6" letter-spacing="1.2">NURSES' STATION</text>`;
  s += `<rect x="600" y="644" width="70" height="48" rx="24" fill="#FFFFFF" stroke="#A9B2BE" stroke-width="3"/><circle cx="635" cy="668" r="15" fill="#E9EEF5" stroke="#A9B2BE" stroke-width="3"/>`;
  s += `<rect x="716" y="646" width="60" height="44" rx="4" fill="#FFFFFF" stroke="#A9B2BE" stroke-width="3"/><rect x="824" y="646" width="50" height="40" rx="4" fill="#FFFFFF" stroke="#A9B2BE" stroke-width="3"/>`;
  s += `<rect x="1070" y="634" width="110" height="20" rx="4" fill="#C9B7D6"/><rect x="1210" y="634" width="54" height="58" rx="3" fill="#B7BDC6"/><rect x="1270" y="634" width="54" height="58" rx="3" fill="#B7BDC6"/><path d="M1237 634 v58 M1297 634 v58" stroke="#8E96A1" stroke-width="2"/>`;
  s += `<rect x="1400" y="70" width="110" height="70" rx="12" fill="#C9A77C"/><rect x="1374" y="190" width="150" height="38" rx="10" fill="#7E8FA6"/><rect x="1546" y="40" width="34" height="40" rx="4" fill="#4F5966"/><circle cx="1563" cy="52" r="5" fill="#C8243A"/>`;
  s += `<text x="1563" y="96" text-anchor="middle" font-size="10" fill="#5E6878">coffee</text>`;
  s += `<rect x="1370" y="522" width="90" height="56" rx="6" fill="#C9CED6"/><rect x="1480" y="522" width="90" height="56" rx="6" fill="#C9CED6"/>`;
  return s;
}

/* Where staff go: with their patient, at their pod, at a desk, or in the break room.
   A third value of 'room' means they stand inside a room, so taps there reach the room. */
function staffSpot(s, G, sl) {
  if (s.st === 'break') return sl.brk();
  if (s.st !== 'on') return null;
  const k = E.isProv(s) ? (s.q[0] && s.q[0].started ? s.q[0] : null) : s.task;
  const p = k && k.pid ? E.pt(k.pid) : null;
  if (p) {
    const r = p.room && RM[p.room];
    if (r) { const side = sl.bed(p.id); return [r.x + r.w / 2 + side * 34, r.y + r.h / 2 + 8, 'room']; }
    const at = sl.by.get(p.id);   // beside them on the wall, in a triage bay, or in the waiting room
    if (at && !(s.role === 'reg' && p.loc === 'triage')) { const n = sl.cnt(p.id); return n ? [at[0] + (n % 2 ? 26 : -26), at[1] + 8] : [at[0], at[1]]; }
  }
  if (s.role === 'evs' && s.task && s.task.room && RM[s.task.room]) { const r = RM[s.task.room]; return [r.x + r.w / 2 + 30, r.y + r.h / 2 + 8, 'room']; }
  if (s.role === 'tp' && s.task && s.task.kind === 'trip') return sl.near(ROLE_HOME.tp, 44, 3);
  if (s.role === 'rn') {
    if (s.zones.includes('triage')) { const b = sl.freeBay(); return b != null ? [TRI_BAYS[b][0], TRI_BAYS[b][1]] : sl.near([452, 368]); }
    if (s.zones[0] === 'resus') return sl.near(POD_SPOT.resus, 40, 2);
    return sl.near(POD_SPOT[s.zones[0]] || POD_SPOT.hold, 50, 2);
  }
  if (s.pit) return sl.near([452, 368]);
  if (E.isProv(s)) { const i = sl.prov++; const seat = PROV_SEATS[i % PROV_SEATS.length]; return [seat[0] + Math.floor(i / PROV_SEATS.length) * 12, seat[1]]; }
  if (s.role === 'reg') return sl.near([204, 354], 46, 3);
  if (s.role === 'pct') { const i = sl.tech++; return [TECH_COL[0], TECH_COL[1] + i * 38]; }
  if (s.role === 'evs') return sl.near(ROLE_HOME.evs, 46, 4);
  return sl.near(ROLE_HOME[s.role] || [1322, 440], 44, 3);
}

/* The camera: fit the whole floor, or zoom in on short screens; drag to pan, pinch or wheel to zoom. */
const CAM = { x: 0, y: 0, w: MW, h: MH, set: false };
function camClamp(el) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;   // hidden: leave the camera alone
  const ar = r.width / r.height;
  const wMax = Math.max(MW, MH * ar) * 1.02;   // zoomed all the way out, the whole floor fits
  CAM.w = Math.max(420, Math.min(CAM.w, wMax)); CAM.h = CAM.w / ar;
  CAM.x = MW <= CAM.w ? (MW - CAM.w) / 2 : Math.max(0, Math.min(MW - CAM.w, CAM.x));
  CAM.y = MH <= CAM.h ? (MH - CAM.h) / 2 : Math.max(0, Math.min(MH - CAM.h, CAM.y));
}
function camApply(el) { const svg = el.querySelector('svg.floor'); if (svg && isFinite(CAM.x + CAM.y + CAM.w + CAM.h)) svg.setAttribute('viewBox', `${CAM.x.toFixed(1)} ${CAM.y.toFixed(1)} ${CAM.w.toFixed(1)} ${CAM.h.toFixed(1)}`); }
function camReset(el) {
  const r = el.getBoundingClientRect();
  if (r.height < 420) { CAM.h = 430; CAM.w = 430 * r.width / Math.max(1, r.height); CAM.x = 0; CAM.y = 0; }   // phones: big enough to read
  else { CAM.w = 1e9; CAM.x = 0; CAM.y = 0; }
  camClamp(el); camApply(el); CAM.set = true; CAM.auto = true; CAM.rw = r.width; CAM.rh = r.height;
}
function camBind(el) {
  const pts = new Map(); let st = null;
  const toMap = (cx, cy) => { const r = el.getBoundingClientRect(); return [CAM.x + (cx - r.left) / r.width * CAM.w, CAM.y + (cy - r.top) / r.height * CAM.h]; };
  const zoom = (f, cx, cy) => { const [mx, my] = toMap(cx, cy), r = el.getBoundingClientRect(); CAM.w /= f; camClamp(el); CAM.x = mx - (cx - r.left) / r.width * CAM.w; CAM.y = my - (cy - r.top) / r.height * CAM.h; camClamp(el); camApply(el); };
  el.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); st = { x: CAM.x, y: CAM.y, w: CAM.w, p: Array.from(pts.values()).map(a => a.slice()), moved: false }; });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !st) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const r = el.getBoundingClientRect(), now = Array.from(pts.values());
    if (now.length >= 2 && st.p.length >= 2) {
      const d0 = Math.hypot(st.p[0][0] - st.p[1][0], st.p[0][1] - st.p[1][1]), d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]);
      if (d0 > 10) { CAM.w = st.w; CAM.x = st.x; CAM.y = st.y; camClamp(el); zoom(d1 / d0, (now[0][0] + now[1][0]) / 2, (now[0][1] + now[1][1]) / 2); }
      st.moved = true; CAM.auto = false; U.mapDrag = performance.now() + 250; return;
    }
    const dx = now[0][0] - st.p[0][0], dy = now[0][1] - st.p[0][1];
    if (!st.moved && Math.hypot(dx, dy) < 8) return;
    st.moved = true; CAM.auto = false; U.mapDrag = performance.now() + 250;
    CAM.x = st.x - dx / r.width * CAM.w; CAM.y = st.y - dy / r.height * CAM.h; camClamp(el); camApply(el);
  });
  const end = e => { pts.delete(e.pointerId); st = pts.size ? { x: CAM.x, y: CAM.y, w: CAM.w, p: Array.from(pts.values()).map(a => a.slice()), moved: true } : null; };
  // A tap acts on exactly what is under the finger. (Browsers nudge taps toward nearby big targets, and the floor is full of them.)
  el.addEventListener('pointerup', e => {
    const tap = st && !st.moved && pts.size === 1;
    end(e);
    if (!tap || e.button > 0) return;
    U.mapTap = { t: performance.now() + 600, x: e.clientX, y: e.clientY };   // the browser's own click for this tap is dropped
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find(n => el.contains(n) && n.closest('[data-act]'));
    mapAct(hit ? hit.closest('[data-act]') : null, e.clientX, e.clientY);
  });
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { e.preventDefault(); CAM.auto = false; zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
}
/* Bring something on the floor into view (the Orientation uses this). */
function mapFocus(x) {
  const el = document.getElementById('map'); if (!el || !x) return;
  const m = el.getBoundingClientRect(), r = x.getBoundingClientRect(), pad = 24;
  if (!m.width || !m.height || !r.width) return;
  const free = { left: m.left, right: m.right, top: m.top, bottom: m.bottom };   // the part of the floor the coach card doesn't cover
  const cc = document.getElementById('coach');
  const sb = document.getElementById('selbar');
  if (sb && !sb.hidden) free.top = Math.max(free.top, sb.getBoundingClientRect().bottom + 4);
  if (cc && !cc.hidden) {
    const c = cc.getBoundingClientRect();
    if (c.width && c.top < m.bottom && c.bottom > m.top) {
      if (c.left > m.left + m.width / 3) free.right = Math.min(free.right, c.left - 8);
      else if (c.right < m.right - m.width / 3) free.left = Math.max(free.left, c.right + 8);
      else if (c.top > m.top + m.height / 3) free.bottom = Math.min(free.bottom, c.top - 8);
    }
  }
  if (r.left >= free.left + pad && r.right <= free.right - pad && r.top >= free.top + pad && r.bottom <= free.bottom - pad) return;
  CAM.x += ((r.left + r.right) / 2 - (free.left + free.right) / 2) * CAM.w / m.width;
  CAM.y += ((r.top + r.bottom) / 2 - (free.top + free.bottom) / 2) * CAM.h / m.height;
  camClamp(el); camApply(el);
}

function mapRender(G) {
  const el = document.getElementById('map'); if (!el) return;
  if (!el._built) {
    el.innerHTML = `<svg class="floor" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor plan of the emergency department">
<defs><pattern id="asphalt" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".8" fill="rgba(255,255,255,.08)"/><circle cx="6" cy="6" r=".7" fill="rgba(0,0,0,.12)"/></pattern>
<pattern id="dirt" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="2.2" fill="rgba(140,98,57,.35)"/><circle cx="11" cy="10" r="1.6" fill="rgba(140,98,57,.3)"/></pattern>
<pattern id="closedP" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#E3E5E8"/><rect width="4" height="10" fill="#CDD1D6"/></pattern></defs>
<g id="mStatic">${mapStatic()}</g><g id="mRooms"></g><g id="mSigns"></g><g id="mPts"></g><g id="mAmb"></g><g id="mPeople"></g></svg>`;
    el._built = true; camBind(el);
  }
  const rr = el.getBoundingClientRect();
  if (rr.width && !CAM.set) camReset(el);
  else if (rr.width && (Math.abs(rr.width - CAM.rw) > 2 || Math.abs(rr.height - CAM.rh) > 2)) {   // the screen changed shape: keep looking at the same spot
    const cx = CAM.x + CAM.w / 2, cy = CAM.y + CAM.h / 2, k = CAM.rw ? CAM.w / CAM.rw : 1;
    if (CAM.auto || Math.abs(rr.width - CAM.rw) > 200 || Math.abs(rr.height - CAM.rh) > 200) camReset(el);
    else { CAM.w = rr.width * k; camClamp(el); CAM.x = cx - CAM.w / 2; CAM.y = cy - CAM.h / 2; camClamp(el); camApply(el); CAM.rw = rr.width; CAM.rh = rr.height; }
  }
  const sel = U.sel, selP = sel && sel.pid ? E.pt(sel.pid) : null, selS = sel && sel.type === 'prov' ? E.staff(sel.sid) : null;
  // pod signs: tap to assign nurses
  let signs = '';
  for (const z of Object.keys(ZSIGN)) {
    const [x, y, w] = ZSIGN[z], ns = E.zoneNurses(z), load = E.zoneLoad(z, hasHold()), cap = ns.length * 4, zn = (E.ZONES.find(q => q.id === z) || {}).name || z;
    const over = (!ns.length && E.zonePts(z)) || load > cap, txt = `${zn} · ${ns.length ? ns.map(s => s.short).join(' + ') + ` ${Math.round(load * 10) / 10}/${cap}` : E.zonePts(z) ? 'no nurse!' : 'no nurse'}`;
    signs += `<g class="msign${over ? ' over' : ''}" id="mzh-${z}" data-act="zone" data-arg="${z}" transform="translate(${x} ${y})" role="button" aria-label="${esc(txt)}"><rect x="-4" y="-5" width="${w + 8}" height="30" fill="transparent"/><rect width="${w}" height="20" rx="10" fill="${over ? '#C8243A' : '#FFFFFF'}" stroke="${over ? '#C8243A' : '#8E97A4'}" stroke-width="1.4"/><text x="10" y="14.5" font-size="12.5" font-weight="700" fill="${over ? '#FFFFFF' : '#1B2230'}">${esc(txt)}</text></g>`;
  }
  setH(document.getElementById('mSigns'), signs);
  // rooms: floor, bed and patient, status line, what a selection can do here
  let rooms = '';
  for (const r of G.rooms) {
    const R = RM[r.id]; if (!R) continue;
    const p = r.pid ? E.pt(r.pid) : null, ns = p ? nextStep(p, r, G) : null, esi = p && (p.tri === 'done' || p.room) ? ve(p) : 0;
    let selc = '';
    if (sel && (sel.type === 'pt' || sel.type === 'move') && selP) selc = E.canPlace(selP, r).ok ? ' ok' : ' no';
    else if (sel && sel.type === 'reg') selc = p && regable(p) ? ' ok' : ' no';
    else if (sel && sel.type === 'tri') selc = ' no';
    else if (selS) selc = p && E.needsProv(p) && E.canAssign(selS, p).ok ? ' ok' : ' no';
    const crit = p && (p.crash || p.arrest || p.shock || (p.bleed === 'mtp' && !p.bb)) ? ' crit' : '';
    const fill = r.closed ? 'url(#closedP)' : r.st === 'dirty' ? '#F3EADF' : r.st === 'cleaning' ? '#E6F1F1' : p ? '#FFFFFF' : '#E9F5EC';
    const st = String(ns ? ns.t : r.closed ? 'Closed' : r.st === 'dirty' ? 'Dirty' : r.st === 'cleaning' ? 'Cleaning' : 'Clean').replace(/<[^>]+>/g, '');
    let g = `<g class="mroom${selc}${crit}" id="mroom-${r.id}" data-act="room" data-arg="${r.id}" transform="translate(${R.x} ${R.y})" role="button" aria-label="${esc(E.roomName(r.id))}${p ? `: ${p.age}${p.sex}, ${esc(p.cc)}${esi ? `, ESI ${esi}` : ''}` : ''}. ${esc(st)}">`;
    g += `<rect class="mr-f" width="${R.w}" height="${R.h}" rx="6" fill="${fill}" stroke="${p ? '#2B3240' : r.st === 'clean' && !r.closed ? '#5BA374' : '#8E97A4'}" stroke-width="${p ? 2.4 : 1.6}"/>`;
    if (r.st === 'dirty') g += `<rect width="${R.w}" height="${R.h}" rx="6" fill="url(#dirt)"/>`;
    g += r.kind === 'chair' ? chairSVG(R.w / 2, R.h / 2 - 2, p, true) : bedSVG(R.w, R.h, p, r.kind, esi);
    g += `<text x="6" y="17" font-size="16" font-weight="700" fill="#1B2230">${esc(r.id)}</text>`;
    if (esi) g += `<circle cx="${R.w - 13}" cy="13" r="11" fill="var(--e${esi})"/><text x="${R.w - 13}" y="18" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${esi}</text>`;
    const tone = ns ? (/bad/.test(ns.c) ? '#C8243A' : /act/.test(ns.c) ? '#1E5BC6' : /ok|good/.test(ns.c) ? '#1F8048' : '#5E6878') : r.st === 'dirty' ? '#8C6239' : r.closed ? '#7A8493' : '#1F8048';
    const fl = ns && /fl/.test(ns.c), fs = R.h < 60 ? 11.5 : 13, maxc = Math.floor((R.w - 8) / (fs * 0.5));
    g += `<rect x="2" y="${R.h - 21}" width="${R.w - 4}" height="19" rx="5" fill="${fl ? tone : 'rgba(255,255,255,.9)'}"/><text x="${R.w / 2}" y="${R.h - 7}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${fl ? '#FFFFFF' : tone}">${esc(st.length > maxc ? st.slice(0, maxc - 1) + '…' : st)}</text>`;
    rooms += g + '</g>';
  }
  setH(document.getElementById('mRooms'), rooms);
  // waiting room, the door line, triage bays, the wall, ambulances outside
  const act = E.active();
  const used = {}, beds = {}, by = new Map(), seenPt = {}, bayOf = new Map(), bayUsed = new Set();
  const sl = {
    brkI: 0, prov: 0, tech: 0, by,
    brk() { const b = BREAK_SEATS[this.brkI++ % BREAK_SEATS.length]; return [b[0], b[1]]; },
    near(b, dx, per) { dx = dx || 34; per = per || 4; const k = b.join(','); const n = (used[k] = (used[k] || 0) + 1) - 1; return [b[0] + (n % per) * dx, b[1] + Math.floor(n / per) * 24]; },
    bed(pid) { const n = beds[pid] = (beds[pid] || 0) + 1; return n === 1 ? -1 : n === 2 ? 1 : n === 3 ? -1.8 : 1.8; },
    cnt(pid) { const n = seenPt[pid] || 0; seenPt[pid] = n + 1; return n; },
    freeBay() { for (let i = 0; i < TRI_BAYS.length; i++) if (!bayUsed.has(i)) { bayUsed.add(i); return i; } return null; },
  };
  const ptG = (p, x, y, inner, extra) => {
    const ok = sel && sel.type === 'reg' ? regable(p) : sel && sel.type === 'tri' ? p.tri === 'none' && (p.loc === 'wall' || p.loc === 'triage') : null;
    return `<g class="mpt${ok === true ? ' ok' : ok === false ? ' no' : ''}${sel && sel.pid === p.id ? ' sel' : ''}" data-act="pt" data-arg="${p.id}" transform="translate(${x} ${y})" role="button" aria-label="${esc(p.name)}, ${p.age}${p.sex}, ${esc(p.cc)}${extra || ''}">${inner}</g>`;
  };
  const walker = p => `<rect x="-18" y="-19" width="36" height="40" fill="transparent"/>${figSVG({ seed: p.id, body: pickH(CLOTHES, p.id, 'c'), ring: sel && sel.pid === p.id })}`;
  let pts = '';
  const waiting = act.filter(p => p.loc === 'waiting').sort((a, b) => a.tArrive - b.tArrive);
  waiting.slice(0, WAIT_SEATS.length).forEach((p, i) => {
    const [x, y] = WAIT_SEATS[i];
    by.set(p.id, [x + 6, y + 23]);
    pts += ptG(p, x, y, walker(p) + (p.tri === 'done' ? `<circle cx="12" cy="-12" r="7" fill="var(--e${ve(p)})"/><text x="12" y="-8.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${ve(p)}</text>` : ''), ', waiting room');
  });
  if (waiting.length > WAIT_SEATS.length) pts += `<text x="442" y="${MH - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="#C8243A">+${waiting.length - WAIT_SEATS.length} standing</text>`;
  const triaging = new Set(G.staff.filter(s => s.task && s.task.kind === 'triage').map(s => s.task.pid));
  let door = 0;
  G.triageQ.map(E.pt).filter(Boolean).forEach(p => {
    let at;
    if (triaging.has(p.id) && bayOf.size < TRI_BAYS.length) { const b = bayOf.size; bayOf.set(p.id, b); bayUsed.add(b); at = [TRI_BAYS[b][0], TRI_BAYS[b][2]]; by.set(p.id, [TRI_BAYS[b][0], TRI_BAYS[b][1]]); }
    else { at = [196 + (door % 3) * 38, 438 + Math.floor(door / 3) * 42]; door++; }
    pts += ptG(p, at[0], at[1], walker(p), triaging.has(p.id) ? ', in triage' : ', at the door');
  });
  const wall = act.filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive), inside = wall.slice(0, 6), outside = wall.slice(6);
  inside.forEach((p, i) => {
    const y = WALL_Y(i), esi = p.tri === 'done' ? ve(p) : 0;
    by.set(p.id, [306, y + 4]);
    pts += ptG(p, 186, y - 16, `<rect x="0" y="0" width="140" height="40" fill="transparent"/>`
      + `<rect x="34" y="8" width="96" height="26" rx="6" fill="#FFFFFF" stroke="#8E97A4" stroke-width="1.6"/><circle cx="42" cy="36" r="2.4" fill="#5E6878"/><circle cx="122" cy="36" r="2.4" fill="#5E6878"/>`
      + `<rect x="62" y="11" width="64" height="20" rx="5" fill="${esi ? ESIC[esi] : '#D5DAE1'}"/><circle cx="50" cy="21" r="7.5" fill="${pickH(SKIN, p.id)}"/>`
      + `<g transform="translate(16 21)">${figSVG({ seed: p.id + 'm1', body: ROLEC.ems, stripe: '#E3BA12', ring: sel && sel.pid === p.id })}</g>`
      + `<text x="132" y="6" text-anchor="end" font-size="10.5" font-weight="700" fill="${G.t - p.tArrive > 30 ? '#C8243A' : '#5E6878'}">${esc(p.unit || '')} · ${Math.round(G.t - p.tArrive)}m</text>`
      + (intakeDone(p) ? '<circle cx="132" cy="21" r="8" fill="#1F8048" stroke="#fff" stroke-width="1.5"/><path d="M128 21 l3 3 l5 -6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
        : E.emergent(p) ? '<circle cx="132" cy="21" r="8" fill="#C8243A" stroke="#fff" stroke-width="1.5"/><text x="132" y="25.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">!</text>' : ''),
      `, ${esc(p.unit || 'EMS')} on the wall${intakeDone(p) ? ', ready for a bed' : E.emergent(p) ? ', needs a room now' : ''}`);
  });
  setH(document.getElementById('mPts'), pts);
  let amb = '';
  for (let i = 0; i < Math.min(3, inside.length); i++) amb += ambSVG(96, 84 + i * 76, 90);
  outside.slice(0, 4).forEach((p, i) => { const y = 352 + i * 66; amb += ptG(p, 0, 0, `${ambSVG(96, y, 90)}<rect x="48" y="${y - 9}" width="44" height="18" rx="4" fill="rgba(27,34,48,.82)"/><text x="70" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF">${Math.round(G.t - p.tArrive)}m</text>`, ', backed up outside'); });
  if (outside.length) amb += `<rect x="6" y="304" width="160" height="22" rx="5" fill="#C8243A"/><text x="86" y="319" text-anchor="middle" font-size="11.5" font-weight="700" fill="#FFFFFF">${outside.length} backed up outside</text>`;
  if (outside.length > 4) amb += `<text x="86" y="592" text-anchor="middle" font-size="12" font-weight="700" fill="#FFE08A">+${outside.length - 4} more down the street</text>`;
  G.enroute.map(E.pt).filter(Boolean).slice(0, 2).forEach((p, i) => { const y = 34 + i * 22; amb += ptG(p, 0, 0, `<rect x="6" y="${y}" width="160" height="19" rx="9.5" fill="rgba(200,36,58,.92)"/><circle cx="18" cy="${y + 9.5}" r="4" fill="#FFFFFF" class="lb1"/><text x="28" y="${y + 13.5}" font-size="10.5" font-weight="700" fill="#FFFFFF">${esc(p.unit || 'Inbound')} · ETA ${Math.max(0, Math.round(p.eta - G.t))}m</text>`, ', on the way in'); });
  setH(document.getElementById('mAmb'), amb);
  // staff, keyed so they walk between spots
  const layer = document.getElementById('mPeople'), seen = new Set();
  for (const s of G.staff) {
    const at = staffSpot(s, G, sl); if (!at) continue;
    const id = 's-' + s.id, coat = s.role === 'md' || s.role === 'app' || s.role === 'rph' ? '#FBFBFB' : null;
    const inRoom = at[2] === 'room';
    const svg = (inRoom ? '' : '<circle r="22" fill="transparent"/>') + figSVG({ seed: s.id, body: ROLEC[s.role], coat, tag: isMe(s) ? 'You' : s.short, tagFg: ROLEC[s.role], ring: !!(sel && sel.sid === s.id) });
    const act = E.isProv(s) ? 'prov' : s.role === 'reg' ? 'regSel' : s.role === 'rn' && s.zones.includes('triage') ? 'triSel' : 'staffOpen';
    seen.add(id);
    let n = layer.querySelector(`[data-id="${id}"]`);
    if (!n) { n = document.createElementNS('http://www.w3.org/2000/svg', 'g'); n.setAttribute('data-id', id); n.setAttribute('class', 'mp'); n.style.transform = `translate(${at[0]}px, ${at[1]}px)`; layer.appendChild(n); }
    if (n._svg !== svg) { n.innerHTML = svg; n._svg = svg; }
    if (n.getAttribute('data-act') !== act) n.setAttribute('data-act', act);
    const pe = inRoom ? 'none' : ''; if (n.style.pointerEvents !== pe) n.style.pointerEvents = pe;
    if (n.getAttribute('data-arg') !== s.id) { n.setAttribute('data-arg', s.id); n.setAttribute('role', 'button'); n.setAttribute('aria-label', `${s.name}, ${s.title}`); }
    const tr = `translate(${at[0]}px, ${at[1]}px)`; if (n.style.transform !== tr) n.style.transform = tr;
  }
  for (const n of Array.from(layer.children)) if (!seen.has(n.getAttribute('data-id'))) n.remove();
}
