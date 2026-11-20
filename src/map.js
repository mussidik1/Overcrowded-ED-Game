/* ---------- the floor plan (v0.9): a top-down ED with beds, chairs, and people ----------
   SVG on a 1400 x 712 floor, sized so the whole department fits a phone held sideways.
   Zoomed out ("far"), rooms show an icon for what they need. Zoomed in ("near"), they show
   the words, and people get name tags. Rooms, pod signs, patients, and staff are tappable
   and do what the list board's tiles and chips do. People walk between spots. */
const MW = 1400, MH = 712;
const LOD_NEAR = 0.62;   // screen pixels per floor unit; below this, icons instead of words
const RM = {};
{
  const put = (id, x, y, w, h) => { RM[id] = { x, y, w, h }; };
  ['R1', 'R2', 'R3', 'R4'].forEach((id, i) => put(id, 256 + (i % 2) * 114, 44 + (i >> 1) * 142, 108, 136));
  // rooms 96 x 94 with 8 between them; 17 between pods, so four rooms read as one group
  const pod = (ids, x0, y0) => ids.forEach((id, i) => put(id, x0 + (i % 2) * 104, y0 + (i >> 1) * 102, 96, 94));
  pod(['1', '2', '3', '4'], 490, 44); pod(['5', '6', '7', '8'], 707, 44); pod(['9', '10', '11', '12'], 924, 44);
  pod(['13', '14', '15', '16'], 490, 446); pod(['17', '18', '19', '20'], 707, 446); pod(['FT1', 'FT2', 'FT3', 'FT4'], 924, 446);
  [['H1', 490], ['H2', 594], ['H3', 924], ['H4', 1028]].forEach(([id, x]) => put(id, x, 250, 96, 46));
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].forEach((id, i) => put(id, 1160 + (i % 2) * 118, 278 + (i >> 1) * 60, 112, 56));
}
// Pod signs: where each zone's label sits (tap it to assign nurses).
const ZSIGN = { resus: [256, 8, 222], a: [490, 8, 200], b: [707, 8, 200], c: [924, 8, 200], hall: [707, 254, 200], d: [490, 410, 200], e: [707, 410, 200], ft: [924, 410, 200], rp: [1160, 244, 230] };
const ZRANGE = { a: '1–4', b: '5–8', c: '9–12', d: '13–16', e: '17–20' };   // which rooms a pod holds, on its sign
const ZSHORTN = { resus: 'Resus', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', hall: 'Hall', ft: 'Fast', rp: 'Chairs' };
const TAGC = { red: '#E0293F', yellow: '#F2C230', green: '#2FA35B' };   // field triage tags from a multiple-casualty call
// One line is all a hallway bed or a chair has when zoomed in: the same thing, said shorter.
const WORDS_SHORT = [[/^Needs a provider( \(recheck\))?.*/, 'Needs provider'], [/^Bed ready: nurse calls report/, 'Report next'], [/^Floor won't take report/, 'Report waits'], [/^Bed ready: send up/, 'Send up'], [/^Accepted: book ambulance/, 'Book a ride'],
  [/^Crew waiting on treatment/, 'Crew waiting'], [/^Crew taking report/, 'Crew report'], [/^Needs full registration/, 'Finish reg'], [/^Needs registration/, 'Register'], [/^Discharge teaching/, 'Teaching'], [/^Ready: discharge/, 'Discharge'],
  [/^Admitted · bed.*/, 'Admitted'], [/^Obs · bed.*/, 'To obs'], [/^Treatment underway/, 'Treating'], [/^Waiting on pharmacy/, 'Pharmacy'], [/^Waiting on RT/, 'Needs RT'], [/^Workup pending/, 'Workup'], [/^Request transfer/, 'Transfer'], [/ taking them up$/, ' taking up'], [/^Attending co-sign/, 'Co-sign'], [/^Call a consult/, 'Consult']];
// Where people stand when they aren't with a patient: two lanes down the hallway, clear of signs and room numbers.
const POD_SPOT = { a: [512, 322], b: [650, 322], c: [940, 322], hall: [1032, 322], d: [512, 376], e: [650, 376], ft: [940, 376], hold: [1032, 376], rp: [1180, 470], resus: [286, 366] };
const POD_PER = { a: 3, d: 3, b: 2, e: 2, c: 2, ft: 2, hall: 1, hold: 1, rp: 4, resus: 3 };
const ROLE_HOME = { evs: [1190, 566], rt: [404, 366], rph: [924, 682], tp: [1054, 682] };
const TECH_SPOTS = [[1071, 322], [1120, 322], [1071, 376], [1120, 376]];
const PROV_SEATS = [[752, 334], [796, 334], [840, 334], [884, 334], [752, 372], [796, 372], [840, 372], [884, 372]];
const TRI_BAYS = [[340, 436, 468], [436, 436, 468]];   // triage booth: [x, nurse y, patient y]
const WAIT_SEATS = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) WAIT_SEATS.push([276 + c * 36, 537 + r * 37]);
const BREAK_SEATS = [[1236, 78], [1276, 78], [1236, 148], [1276, 148], [1198, 113], [1314, 113], [1262, 204], [1312, 204], [1362, 204]];
const BEDSIDE = [[-35, -5], [35, -5], [-35, 15], [35, 15], [-35, 5], [35, 5]];   // either side of the big icon: never on the top row, the icon or the name tag
const BEDSIDE_S = [[2, 0], [-18, 4], [22, 4], [2, 8]];   // a hallway bed or a chair is short: stand over the stretcher, clear of the label, the ESI and the icon
const WALL_Y = i => 62 + i * 46;
const SKIN = ['#F1C7A5', '#E0A57E', '#C68642', '#8D5524', '#5C3A21'];
const HAIR = ['#2B1D14', '#5A3825', '#8B4A2B', '#D2AE6D', '#1B1B1B', '#A7A7A7'];
const ESIC = { 1: '#E7A2AB', 2: '#F2BE8F', 3: '#F1DA86', 4: '#A9D6B5', 5: '#A9C3E8' };
const ROLEC = { md: '#1A2B8F', app: '#007A70', rn: '#7A2BC4', pct: '#C24400', evs: '#37474F', rt: '#0E7490', rph: '#7A1F3D', reg: '#B5126F', tp: '#6B4423', ems: '#1F2A44', uc: '#7A5C00', cons: '#4B6E1F', help: '#3D5A80', flt: '#2E4A7A' };   // one strong colour a role; the side buttons use the same ones (style.css)
const ROLE_LAB = { md: 'MD', rn: 'RN', pct: 'T', reg: 'R', evs: 'EV', rt: 'RT', rph: 'Rx', tp: 'TP', uc: 'UC' };
const roleLab = s => (s.role === 'app' ? (s.title === 'NP' ? 'NP' : 'PA') : ROLE_LAB[s.role] || '?');   // what a staff chip says
/* A room is a tile. Its colour is its state: [fill, outline, solid]. Solid tiles are the ones waiting on the player. */
const TILE = { need: ['#1648C8', '#0A2470', 1], bad: ['#D11A2F', '#7A0A17', 1], go: ['#12813A', '#07461E', 1], warn: ['#B45309', '#6B3005', 1], dirty: ['#7A4A1E', '#40250D', 1],
  board: ['#E3D7FA', '#6D3FC0', 0], calm: ['#FFFFFF', '#1B2230', 0], empty: ['#E7EAEE', '#B8C0CA', 0], dirtyq: ['#EADCC4', '#9A7B55', 0], cleaning: ['#D5F0EE', '#2A9D94', 0], closed: ['url(#closedP)', '#7F8A99', 0] };
const hsh = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pickH = (arr, s, salt) => arr[hsh(String(s) + (salt || '')) % arr.length];
const SEAT = new Map();   // waiting-room seats stay put: patient id -> seat number

/* Status icons, drawn in an 18-unit box around 0,0. The floor plan and the help sheet share them. */
const ICO = {
  steth: '<path d="M-6 -8 v5.5 a4.5 4.5 0 0 0 9 0 V-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M-1.5 2 v2 a4 4 0 0 0 8 0 v-1.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6.5" cy="0.6" r="2.3" fill="currentColor"/>',
  orders: '<rect x="-6.5" y="-7" width="13" height="15.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="-3" y="-9.3" width="6" height="3.6" rx="1.2" fill="currentColor"/><path d="M-3.5 -1.5 h7 M-3.5 2 h7 M-3.5 5.3 h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  decide: '<text y="6.6" text-anchor="middle" font-size="19" font-weight="700" fill="currentColor">?</text>',
  alert: '<text y="6.6" text-anchor="middle" font-size="19" font-weight="700" fill="currentColor">!</text>',
  code: '<path d="M0 8 C-11 0.5 -8.5 -8.5 0 -3.2 C8.5 -8.5 11 0.5 0 8Z" fill="currentColor"/><path class="icut" d="M-6.5 0.3 h3.2 l1.6 -3.4 l2.6 6.6 l1.6 -3.2 h3.4" fill="none" stroke-width="1.5" stroke-linejoin="round"/>',
  blood: '<path d="M0 -9 C4.5 -2.5 6.6 0.6 6.6 3.4 A6.6 6.6 0 0 1 -6.6 3.4 C-6.6 0.6 -4.5 -2.5 0 -9Z" fill="currentColor"/>',
  nurse: '<path d="M-8 4.5 L-6 -5.5 H6 L8 4.5Z" fill="currentColor"/><path class="icut" d="M0 -3.6 v6.2 M-3.1 -0.5 h6.2" fill="none" stroke-width="1.9"/>',
  eye: '<path d="M-9 0 Q0 -8.5 9 0 Q0 8.5 -9 0Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle r="2.8" fill="currentColor"/>',
  home: '<path d="M-8.5 0.5 L0 -8 L8.5 0.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M-5.5 -0.5 V7.5 H5.5 V-0.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="-1.6" y="2.2" width="3.2" height="5.3" fill="currentColor"/>',
  amb: '<path d="M-9.5 -5 h12 v10.5 h-12z" fill="currentColor"/><path d="M3.5 -1.5 h3.2 l2.8 3.4 v3.6 h-6z" fill="currentColor"/><circle class="iwh" cx="-5" cy="6" r="2.3" fill="currentColor"/><circle class="iwh" cx="5.2" cy="6" r="2.3" fill="currentColor"/><path class="icut" d="M-3.5 -3 v5.4 M-6.2 -0.3 h5.4" fill="none" stroke-width="1.6"/>',
  phone: '<path d="M-6.2 -8.3 c-2.2 1.2 -2.4 3.4 -1.2 5.9 c2.2 4.6 5.7 8 10.3 10.2 c2.5 1.2 4.7 1 5.9 -1.2 l-3.4 -3.3 l-2.4 1.5 c-2.3 -1.2 -4.4 -3.3 -5.6 -5.6 l1.5 -2.4z" fill="currentColor"/>',
  up: '<path d="M0 -8.5 L7.5 0 H3.2 V8 H-3.2 V0 H-7.5Z" fill="currentColor"/>',
  bed: '<path d="M-9 -5.5 V6.5 M-9 2.5 H9 V6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M-3.5 2.5 v-4 h8 a4.5 4.5 0 0 1 4.5 4z" fill="currentColor"/><circle cx="-5.8" cy="-0.8" r="2" fill="currentColor"/>',
  talk: '<path d="M-8.5 -7 h17 v10.5 h-9.5 l-4.5 4.2 v-4.2 h-3z" fill="currentColor"/><path class="icut" d="M-4.6 -1.8 h.1 M0 -1.8 h.1 M4.6 -1.8 h.1" fill="none" stroke-width="2.4" stroke-linecap="round"/>',
  card: '<rect x="-8.5" y="-6" width="17" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="-3.8" cy="-1.4" r="2.1" fill="currentColor"/><path d="M-7 4.6 a3.2 3.2 0 0 1 6.4 0z" fill="currentColor"/><path d="M1.6 -2.4 h4.6 M1.6 1.4 h4.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  pen: '<path d="M-8 8 l1.6 -5.6 l8.8 -8.8 l4 4 l-8.8 8.8z" fill="currentColor"/>',
  flask: '<path d="M-2.8 -8.5 h5.6 M-1.7 -8.5 v5.2 l-5.6 9.6 a1.6 1.6 0 0 0 1.4 2.4 h11.8 a1.6 1.6 0 0 0 1.4 -2.4 l-5.6 -9.6 v-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M-4.6 2.6 h9.2 l2.6 4.6 h-14.4z" fill="currentColor"/>',
  pill: '<g transform="rotate(-40)"><rect x="-8.5" y="-3.8" width="17" height="7.6" rx="3.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M0 -3.8 h4.7 a3.8 3.8 0 0 1 0 7.6 h-4.7z" fill="currentColor"/></g>',
  walkin: '<circle cx="0.6" cy="-7.2" r="2.7" fill="currentColor"/><path d="M-0.6 -3.6 L-2 2.6 L-5.2 8.2 M-1.6 0.6 L2.6 3.4 L3.6 8.4 M-0.4 -3.2 L-4.6 -0.6 M0.2 -3.2 L4 -1.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  wait: '<path d="M-5.8 -8.5 h11.6 v1.8 l-4.3 6.7 l4.3 6.7 v1.8 h-11.6 v-1.8 l4.3 -6.7 l-4.3 -6.7z" fill="currentColor"/>',
  heart: '<path d="M0 8 C-11 0.5 -8.5 -8.5 0 -3.2 C8.5 -8.5 11 0.5 0 8Z" fill="currentColor"/>',
  broom: '<path d="M7.5 -8.5 L-0.5 0.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M-3.4 -1.8 l5.4 5.4 l-3.2 4.9 l-7.8 -4z" fill="currentColor"/>',
  sparkle: '<path d="M-1.5 -8.5 L0.4 -2.6 L6.3 -0.7 L0.4 1.2 L-1.5 7.1 L-3.4 1.2 L-9.3 -0.7 L-3.4 -2.6Z" fill="currentColor"/><path d="M6 3 l.9 2.3 l2.3 .9 l-2.3 .9 l-.9 2.3 l-.9 -2.3 l-2.3 -.9 l2.3 -.9z" fill="currentColor"/>',
  lock: '<rect x="-6" y="-1.5" width="12" height="9.5" rx="2" fill="currentColor"/><path d="M-3.6 -1.5 v-3 a3.6 3.6 0 0 1 7.2 0 v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  check: '<path d="M-6 0.5 l4 4.2 l8 -9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
};
const icoSVG = (key, cx, cy, r, cls) => `<g class="mico ${cls}" transform="translate(${cx} ${cy})">${/\bfl\b/.test(cls) ? `<rect class="ir" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="${(r * 0.36).toFixed(1)}"/>` : ''}<g class="iw"><rect class="ib" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="${(r * 0.36).toFixed(1)}"/><g transform="scale(${(r / 13.5).toFixed(2)})">${ICO[key] || ICO.wait}</g></g></g>`;
/* The same icon as a small picture for sheets and help. */
const icoInline = (key, cls) => `<svg class="lgi" viewBox="-15 -15 30 30" aria-hidden="true">${icoSVG(key, 0, 0, 14, cls)}</svg>`;
const toneOf = c => (/n-code/.test(c) ? 'code' : /n-bad/.test(c) ? 'bad' : /n-act/.test(c) ? 'act' : /n-go/.test(c) ? 'go' : /n-warn/.test(c) ? 'warn' : /n-board/.test(c) ? 'board' : 'wait') + (/\bfl\b/.test(c) ? ' fl' : '');

/* People are chips. Staff: a pill in the role's colour with its letters (MD, RN, T). The player's own chip has a gold edge and a star. */
function chipSVG(o) {
  const t = o.label || '', w = t.length > 2 ? 42 : t.length === 2 ? 35 : 27, h = 24;
  let s = '<g class="fg">';
  if (o.ring) s += `<rect x="${-w / 2 - 6}" y="${-h / 2 - 6}" width="${w + 12}" height="${h + 12}" rx="${h / 2 + 6}" fill="rgba(242,194,48,.4)" stroke="#F2C230" stroke-width="3"/>`;
  s += `<rect x="${-w / 2 + 1.5}" y="${-h / 2 + 3}" width="${w}" height="${h}" rx="${h / 2}" fill="rgba(0,0,0,.25)"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${o.body || '#444'}" stroke="${o.me ? '#F2C230' : '#FFFFFF'}" stroke-width="${o.me ? 3.4 : 2.4}"/>`;
  s += `<text y="${t.length > 2 ? 4.8 : 5.8}" text-anchor="middle" font-size="${t.length > 2 ? 13 : t.length === 2 ? 16 : 17.5}" font-weight="700" fill="#FFFFFF">${esc(t)}</text>`;
  if (o.me) s += '<path d="M0 -27 l2.4 4.9 5.4.7 -4 3.8 1 5.4 -4.8 -2.5 -4.8 2.5 1 -5.4 -4 -3.8 5.4 -.7z" fill="#F2C230" stroke="#8A6400" stroke-width=".9"/>';
  if (o.tag) s += `<g class="nearonly" transform="translate(0 21)"><rect x="-${o.tag.length * 2.6 + 3.5}" y="-6" width="${o.tag.length * 5.2 + 7}" height="11.5" rx="5.7" fill="${o.tagFg || '#1B2230'}"/><text x="0" y="3" text-anchor="middle" font-size="8.6" font-weight="700" fill="#FFFFFF">${esc(o.tag)}</text></g>`;
  return s + '</g>';
}
/* The same chips as small pictures for the map key. */
const chipInline = (label, role) => `<svg class="lgc" viewBox="-25 -16 50 34" aria-hidden="true">${chipSVG({ label, body: ROLEC[role] })}</svg>`;
const ptChipInline = (e) => `<svg class="lgc" viewBox="-25 -16 50 34" aria-hidden="true">${ptChipSVG({ tri: e ? 'done' : 'none', acu: e, esi: e, vesi: e, _key: e })}</svg>`;
/* A patient on their feet (the door, the waiting room, walking to a bed): a circle with the triage level, or ? before triage. */
function ptChipSVG(p, ring) {
  const tri = p.tri === 'done' || !!p.room, e = !tri ? 0 : p._key != null ? p._key : E.vEsi(p);
  return `${ring ? '<circle r="18.5" fill="rgba(242,194,48,.4)" stroke="#F2C230" stroke-width="3"/>' : ''}<circle cx="1.5" cy="2.8" r="12.5" fill="rgba(0,0,0,.24)"/><circle r="12.5" fill="${tri ? `var(--e${e})` : '#77818F'}" stroke="#FFFFFF" stroke-width="2.4"/><text y="5.7" text-anchor="middle" font-size="16.5" font-weight="700" fill="${e === 3 ? '#3A2F00' : '#FFFFFF'}">${tri ? e : '?'}</text>`;
}
/* An ambulance crew member: a dark chip with the yellow stripe of a turnout coat. */
function crewSVG(ring, body) {
  return `${ring ? '<circle r="17" fill="rgba(242,194,48,.4)" stroke="#F2C230" stroke-width="3"/>' : ''}<circle cx="1.2" cy="2.4" r="11" fill="rgba(0,0,0,.24)"/><circle r="11" fill="${body || ROLEC.ems}" stroke="#FFFFFF" stroke-width="2.2"/>${body ? '' : '<rect x="-9.6" y="-2.2" width="19.2" height="4.4" rx="1.5" fill="#E3BA12"/>'}`;
}
/* A stretcher on its wheels, head to the left. */
function stretcherSVG(x, y, w, h, p, esi) {
  let s = [[7, -1], [w - 7, -1], [7, h + 1], [w - 7, h + 1]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.6" fill="#5E6878"/>`).join('');
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#FFFFFF" stroke="#8E97A4" stroke-width="1.6"/><rect x="${x + 3}" y="${y + 4}" width="13" height="${h - 8}" rx="4" fill="#E9EDF3"/>`;
  if (!p) return s;
  s += `<rect x="${x + 21}" y="${y + 2.5}" width="${w - 24}" height="${h - 5}" rx="5" fill="${esi ? ESIC[esi] : '#D5DAE1'}"/>`;
  return s + `<circle cx="${x + 11}" cy="${y + h / 2}" r="7" fill="${pickH(SKIN, p.id)}" stroke="rgba(0,0,0,.18)" stroke-width=".7"/><path d="M${x + 9.5} ${y + h / 2 - 7} a7 7 0 0 0 0 14 a3.5 7 0 0 1 0 -14z" fill="${pickH(HAIR, p.id, 'h')}"/>`;
}
const unitCode = p => String(p.unit || '').replace(/^Medic\s*/, 'M').replace(/^Ambulance\s*/, 'A').replace(/\s+/g, '').slice(0, 4);
/* Ambulances drive (v0.23). One coming in drives along the lane facing the way it goes, pulls past its spot,
   and backs in so the back doors face the building. One leaving swings its nose round and drives off the top.
   Each move is a short keyframed animation; the element's own transform is set to where it ends up. */
const AMB_STALL = new Map();
const ambTr = (x, y, r) => `translate(${x}px, ${y}px) rotate(${r}deg)`;
function ambDrive(n, at) {
  const from = n._pos || [56, at ? at[1] : 0, 0], calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (n._anim) { n._anim.cancel(); n._anim = null; }
  if (!at) {   // leaving
    const y = from[1], end = ambTr(56, -120, 90);
    n.style.transition = 'none'; n.style.transform = end; n.style.opacity = '0';
    if (calm || !n.animate) { setTimeout(() => n.remove(), 300); return; }
    n._anim = n.animate([{ transform: ambTr(...from), opacity: 1 }, { transform: ambTr(48, y - 26, 90), opacity: 1, offset: 0.35, easing: 'ease-in' }, { transform: ambTr(56, Math.min(y - 60, 40), 90), opacity: 1, offset: 0.6 }, { transform: end, opacity: 0 }], { duration: 1500 + y * 1.5, easing: 'linear' });
    n._anim.onfinish = () => n.remove(); return;
  }
  const to = [at[0], at[1], 0], fin = ambTr(...to); n._pos = to;
  n.style.transition = 'none'; n.style.transform = fin;
  const dy = to[1] - from[1];
  if (calm || !n.animate || Math.abs(dy) < 3) { requestAnimationFrame(() => { n.style.transition = ''; }); return; }
  const up = dy < 0, face = up ? 90 : -90, park = at[2] !== 'in';   // facing the way it drives (the cab is drawn on the left)
  const over = park ? to[1] + (up ? -30 : 30) : to[1], turn = from[2] === face ? null : [56, from[1] + (up ? -14 : 14), face];
  const k = [{ transform: ambTr(...from) }];
  const run = Math.abs(over - (turn ? turn[1] : from[1])), tTurn = turn ? 450 : 0, tRun = Math.max(350, run * 3.2), tBack = park ? 1100 : 350, T = tTurn + tRun + tBack;
  if (turn) k.push({ transform: ambTr(...turn), offset: tTurn / T, easing: 'linear' });
  k.push({ transform: ambTr(56, over, face), offset: (tTurn + tRun) / T, easing: park ? 'ease-in-out' : 'ease-out' });
  k.push({ transform: fin });
  k[0].easing = turn ? 'ease-in' : (Math.abs(from[1]) > MH ? 'linear' : 'ease-in');
  n._anim = n.animate(k, { duration: T, easing: 'linear' });
  n._anim.onfinish = () => { n._anim = null; n.style.transition = ''; };
}
/* v0.26: a helicopter from above, nose to the right, the rotor turning. */
function heliSVG() {
  return '<g class="heli"><ellipse cx="6" cy="10" rx="46" ry="18" fill="rgba(0,0,0,.22)"/><rect x="-72" y="-4" width="56" height="8" rx="3" fill="#E8EAED" stroke="#8C96A3" stroke-width="1.5"/><rect x="-80" y="-15" width="7" height="30" rx="2" fill="#C8243A"/>'
    + '<rect x="-28" y="-24" width="50" height="4" rx="2" fill="#5E6878"/><rect x="-28" y="20" width="50" height="4" rx="2" fill="#5E6878"/><path d="M-34 0 C-34 -20 30 -24 40 -6 C44 2 38 20 14 20 C-14 20 -34 16 -34 0z" fill="#C8243A" stroke="#7A1420" stroke-width="2"/>'
    + '<path d="M16 -13 C33 -13 40 -4 40 0 L16 0z" fill="#9FC3EA"/><rect x="-14" y="-6" width="16" height="12" rx="2" fill="#FFFFFF"/><path d="M-6 -4 v8 M-10 0 h8" stroke="#C8243A" stroke-width="2.4"/>'
    + '<g class="rotor"><rect x="-66" y="-3" width="132" height="6" rx="3" fill="#2B3240" opacity=".8"/><rect x="-3" y="-66" width="6" height="132" rx="3" fill="#2B3240" opacity=".8"/><circle r="6" fill="#2B3240"/></g></g>';
}
/* v0.26: weather drawn over the map: rain streaks, snow, fog, a storm's flashes. */
function wxSVG(wx) {
  if (wx === 'clear' || !WXDEF[wx]) return '';
  return WXDEF[wx];
}
const WXDEF = (() => {
  const R = (n, f) => { let o = ''; for (let i = 0; i < n; i++) o += f((i * 97) % 1900 - 500, (i * 61) % 1500 - 400, i); return o; };
  const rain = `<g class="wxr">${R(260, (x, y) => `<path d="M${x} ${y} l-9 26" stroke="rgba(90,120,170,.45)" stroke-width="2" stroke-linecap="round"/>`)}</g>`;
  return {
    rain,
    storm: rain + '<rect class="wxf" x="-900" y="-700" width="3200" height="2112" fill="#fff" opacity="0"/>',
    snow: `<g class="wxs">${R(220, (x, y, i) => `<circle cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="rgba(255,255,255,.85)"/>`)}</g>`,
    fog: '<rect class="wxg" x="-900" y="-700" width="3200" height="2112" fill="#E9EDF1" opacity=".38"/>',
  };
})();
/* An ambulance seen from above, cab to the left, back doors toward the building. */
function ambSVG(o) {
  let s = `<g class="ambg${o.ghost ? ' ghost' : ''}"><rect x="-56" y="-28" width="118" height="56" fill="transparent"/><ellipse cx="3" cy="5" rx="51" ry="25" fill="rgba(0,0,0,.2)"/>`;
  s += '<rect x="-48" y="-23" width="96" height="46" rx="8" fill="#FBFBFB" stroke="#8C96A3" stroke-width="1.6"/><rect x="-45.5" y="-19" width="19" height="38" rx="5" fill="#2F3A4A"/><rect x="-24" y="-22" width="5" height="44" fill="#D5DAE1"/>';
  s += '<rect x="-19" y="-22.2" width="66" height="6.5" fill="#E4572E"/><rect x="-19" y="15.7" width="66" height="6.5" fill="#E4572E"/>';
  s += '<rect x="14.5" y="-10" width="7" height="20" rx="1.5" fill="#C8243A"/><rect x="8" y="-3.5" width="20" height="7" rx="1.5" fill="#C8243A"/>';
  s += `<g class="lb${o.hot ? ' hot' : ''}"><rect class="lbr" x="-26" y="-18" width="6.5" height="15" rx="2.5" fill="#C8243A"/><rect class="lbb" x="-26" y="3" width="6.5" height="15" rx="2.5" fill="#2B62C9"/></g>`;
  if (o.open) s += '<path d="M48 -20 l13 -7 M48 20 l13 7" stroke="#8C96A3" stroke-width="3.5" stroke-linecap="round"/>';
  if (o.code && !o.pill) s += `<text class="nearonly" x="-5" y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#2B3240">${esc(o.code)}</text>`;
  if (o.pill) s += `<rect x="-17" y="-11.5" width="58" height="23" rx="11.5" fill="${o.pillBad ? '#C8243A' : 'rgba(27,34,48,.88)'}" stroke="#fff" stroke-width="1.2"/><text x="12" y="6" text-anchor="middle" font-size="16.5" font-weight="700" fill="#fff">${esc(o.pill)}</text>`;
  return s + '</g>';
}

/* The building itself: outside, floors, walls, desks, furniture, signs. Drawn once. */
function mapStatic() {
  const R = (x, y, w, h, f, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${a ? ' ' + a : ''}/>`;
  const L = (x, y, t, fs, a) => `<text x="${x}" y="${y}" font-size="${fs || 14}" font-weight="700" fill="#4F5A6B" letter-spacing="1"${a ? ` text-anchor="${a}"` : ''}>${t}</text>`;
  const tree = (x, y, r) => `<ellipse cx="${x + 5}" cy="${y + 7}" rx="${r}" ry="${r * 0.9}" fill="rgba(0,0,0,.14)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#6F9A5B"/><circle cx="${x - r * 0.28}" cy="${y - r * 0.3}" r="${r * 0.52}" fill="#8AB673"/>`;
  const plant = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#B5835A"/><circle cx="${x}" cy="${y}" r="7.2" fill="#5E9A55"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="3.2" fill="#86BD77"/>`;
  const seat = (x, y) => `<rect x="${x - 11}" y="${y - 10}" width="22" height="21" rx="5" fill="#9AA6B4"/><rect x="${x - 11}" y="${y - 10}" width="22" height="6" rx="3" fill="#7F8C9B"/>`;
  let s = '';
  // outside: grass, the road, trees
  s += R(-900, -700, MW + 1800, MH + 1400, '#BFCBA6');
  s += R(-900, -700, 1012, MH + 1400, '#5C646E') + R(-900, -700, 1012, MH + 1400, 'url(#asphalt)');
  s += `<path d="M-150 -700 V${MH + 700}" stroke="#E9E3C6" stroke-width="4" stroke-dasharray="28 24" opacity=".65"/><path d="M0 -700 V604" stroke="rgba(255,255,255,.3)" stroke-width="3"/>`;
  for (const x of [230, 430, 650, 870, 1090, 1310]) s += tree(x, -54, 28) + tree(x + 60, MH + 58, 26);
  for (const y of [70, 260, 450, 640]) s += tree(MW + 60, y, 27);
  // v0.26: the helipad on a lawn across the road, with a wind sock
  s += `<rect x="-480" y="110" width="285" height="300" rx="8" fill="#BFCBA6"/><path d="M-195 250 H-150" stroke="#D8D3C4" stroke-width="14"/>`;
  s += `<rect x="${PAD[0] - 78}" y="${PAD[1] - 78}" width="156" height="156" rx="10" fill="#C9CCD1" stroke="#9AA0A8" stroke-width="3"/><circle cx="${PAD[0]}" cy="${PAD[1]}" r="62" fill="none" stroke="#F2C230" stroke-width="7"/><text x="${PAD[0]}" y="${PAD[1] + 26}" font-size="74" font-weight="700" fill="#F7F7F2" stroke="#8E949C" stroke-width="1.5" text-anchor="middle">H</text>`;
  s += `<path d="M${PAD[0] + 96} ${PAD[1] - 100} v40" stroke="#5E6878" stroke-width="3"/><path d="M${PAD[0] + 96} ${PAD[1] - 100} l22 4 v8 l-22 4z" fill="#F08A24"/>` + L(PAD[0], PAD[1] + 102, 'HELIPAD', 16, 'middle');
  // the ambulance bay: three stalls under a canopy, then the driveway
  s += '<rect x="3" y="62" width="109" height="180" rx="5" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-dasharray="7 6"/>';
  s += '<path d="M10 68 H106 M10 124 H106 M10 180 H106 M10 236 H106" stroke="#E9E3C6" stroke-width="2.5" opacity=".8"/><path d="M56 286 V596" stroke="#E9E3C6" stroke-width="3" stroke-dasharray="14 12" opacity=".7"/>';
  // the front walk
  s += R(-60, 604, 172, 808, '#D8D3C4') + '<path d="M-60 604 H112" stroke="#BDB6A3" stroke-width="3"/>' + plant(22, 622) + plant(84, 622);
  // floors
  s += R(112, 0, MW - 112, MH, '#F3EFE6');
  s += R(112, 0, 138, 342, '#E2E6EC') + R(250, 0, 234, 404, '#E5EBF4');
  s += R(112, 342, 138, 370, '#F1E8D7') + R(250, 404, 234, 308, '#F1E8D7') + R(254, 494, 226, 214, 'url(#carpet)');
  s += R(484, 0, 659, 652, '#F5F2EB') + R(484, 244, 659, 162, '#ECE6D9') + R(484, 652, 659, 60, '#E3E7EC');
  s += R(1143, 0, 257, 236, '#EAD9BD') + R(1143, 0, 257, 236, 'url(#plank)') + R(1143, 236, 257, 252, '#EDF0F3') + R(1143, 488, 257, 224, '#DEE1E5');
  s += R(112, 0, 372, 404, 'url(#tile)') + R(484, 0, 659, 652, 'url(#tile)');
  // walls and glass doors
  const W = (d, w) => `<path d="${d}" stroke="#2B3240" stroke-width="${w || 5}" fill="none" stroke-linecap="square"/>`;
  s += W(`M112 0 H${MW} V${MH} H112`, 6) + W('M112 0 V24 M112 320 V626 M112 700 V712', 6);
  s += '<path d="M112 28 V316" stroke="#8FD0E8" stroke-width="5" stroke-dasharray="44 8"/><path d="M112 630 V696" stroke="#8FD0E8" stroke-width="5" stroke-dasharray="30 6"/>';
  s += W('M250 0 V298 M112 342 H196 M250 404 H438 M484 0 V244 M484 404 V712 M1143 0 V244 M1143 404 V652 M1180 236 H1400 M1180 488 H1400');
  s += '<path d="M484 652 H1143" stroke="#9AA3AF" stroke-width="2.5"/>';
  // a tray under each pod, sign included
  for (const [x0, y0, hh] of [[490, 2, 240], [707, 2, 240], [924, 2, 240], [490, 406, 242], [707, 406, 242], [924, 406, 242]]) s += `<rect x="${x0 - 5}" y="${y0}" width="210" height="${hh}" rx="13" fill="#E6E0D2" stroke="#B5AD9B" stroke-width="2"/>`;
  s += '<rect x="251" y="2" width="232" height="328" rx="13" fill="#D9E1EE" stroke="#A9B4C6" stroke-width="2"/>';
  // the wall: six stretcher spots. Its label, the waiting room's, and the door's carry a count.
  s += '<text id="mWallL" x="181" y="27" font-size="20" font-weight="700" fill="#4F5A6B" letter-spacing="1" text-anchor="middle">THE WALL</text>';
  for (let i = 0; i < 6; i++) s += `<rect x="150" y="${WALL_Y(i) - 16}" width="94" height="32" rx="6" fill="none" stroke="#8A94A3" stroke-width="2" stroke-dasharray="5 5"/>`;
  s += `<g id="mWall" data-act="cluster" data-arg="wall" role="button" aria-label="The wall: ambulance crews waiting to hand over"><rect x="114" y="8" width="134" height="${WALL_Y(5) + 26 - 8}" fill="transparent"/></g>`;   // zoomed out, the stretchers are too small to pick: one tap opens the list
  // resus alcove: crash cart, supply cart
  s += '<rect x="262" y="384" width="26" height="16" rx="3" fill="#C8243A"/><rect x="262" y="389" width="26" height="3" fill="#F3D5D9"/><rect x="294" y="386" width="22" height="14" rx="3" fill="#AEB7C2"/>';
  // check-in desk, the line at the door, the front door
  s += '<rect x="122" y="374" width="120" height="20" rx="5" fill="#B98D5E"/><rect x="122" y="374" width="120" height="5" rx="2.5" fill="#D3AE82"/><rect x="142" y="380" width="16" height="10" rx="2" fill="#2F3A4A"/><rect x="196" y="380" width="16" height="10" rx="2" fill="#2F3A4A"/>';
  s += '<g id="mDoor" data-act="cluster" data-arg="door" role="button" aria-label="The line at the door"><rect x="116" y="398" width="132" height="232" fill="transparent"/><path d="M130 664 H162 V434" fill="none" stroke="#C9B48F" stroke-width="2.5" stroke-dasharray="3 7" stroke-linecap="round"/><text id="mDoorL" x="172" y="624" font-size="16" font-weight="700" fill="#4F5A6B" letter-spacing="1">DOOR</text></g>';
  s += R(115, 634, 26, 58, '#8C5A4A', 'rx="3"') + plant(232, 694) + '<rect x="156" y="688" width="46" height="19" rx="3" fill="#33507A"/><rect x="160" y="691" width="26" height="13" rx="2" fill="#9FC3EA"/>';
  // triage booth: two bays behind a curtain
  s += '<g data-act="zone" data-arg="triage" role="button" aria-label="Triage"><rect x="258" y="410" width="220" height="78" rx="7" fill="#F8F4EA" stroke="#C9BFA8" stroke-width="2"/><path d="M388 414 V484" stroke="#9CCFC8" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/>';
  s += '<rect x="266" y="418" width="36" height="14" rx="3" fill="#C9A77C"/><rect x="270" y="421" width="12" height="8" rx="1.5" fill="#2F3A4A"/><rect x="396" y="418" width="14" height="14" rx="3" fill="#C9A77C"/>' + L(262, 482, 'TRIAGE', 15) + '</g>';
  // waiting room
  s += `<g id="mWait" data-act="cluster" data-arg="wait" role="button" aria-label="Waiting room"><rect x="254" y="494" width="226" height="216" fill="transparent"/><text id="mWaitL" x="262" y="510" font-size="16" font-weight="700" fill="#4F5A6B" letter-spacing="1">WAITING</text>`;
  for (const [x, y] of WAIT_SEATS) s += seat(x, y);
  s += '<rect x="474.5" y="566" width="5" height="60" rx="2" fill="#1E2633"/><path class="tvglow" d="M474 566 l-14 -6 v72 l14 -6z" fill="rgba(143,208,240,.3)"/></g>';
  // nurses' station: a desk around the provider seats, with the Box on it
  s += '<path d="M716 300 h198 v98 h-70 v-10 h60 v-76 h-178 v76 h60 v10 h-70z" fill="#B98D5E" stroke="#8E6A43" stroke-width="1.5"/><path d="M718 302 h194 v3 h-194z" fill="#D3AE82"/>';
  for (const x of [745, 789, 833, 877]) s += `<rect x="${x}" y="302.5" width="14" height="8" rx="1.5" fill="#263042"/><rect x="${x + 1.5}" y="304" width="11" height="5" rx="1" fill="#7FB6E6"/>`;
  for (const [x, y] of PROV_SEATS) s += `<circle cx="${x}" cy="${y + 2}" r="9" fill="#5E6878" opacity=".3"/>`;
  s += '<g id="mBox" data-act="boxTap" role="button" aria-label="The Box"><rect x="706" y="334" width="30" height="34" fill="transparent"/><path d="M721 341 v-8" stroke="#2B3240" stroke-width="1.6" stroke-linecap="round"/><rect x="716.5" y="340" width="9" height="20" rx="2.5" fill="#C8243A"/><circle cx="721" cy="346" r="1.7" fill="#FFE07A"/></g>';
  // imaging, lab, pharmacy, elevators
  s += '<rect x="500" y="660" width="58" height="46" rx="12" fill="#FFFFFF" stroke="#A9B2BE" stroke-width="2.5"/><circle cx="529" cy="683" r="14" fill="#DDE4EE" stroke="#A9B2BE" stroke-width="2.5"/><rect x="556" y="675" width="40" height="16" rx="5" fill="#C9D2DE" stroke="#A9B2BE" stroke-width="1.5"/>' + L(604, 690, 'CT', 19);
  s += '<rect x="652" y="664" width="44" height="40" rx="5" fill="#FFFFFF" stroke="#A9B2BE" stroke-width="2.5"/><rect x="662" y="672" width="24" height="24" rx="3" fill="#2F3A4A" opacity=".75"/>' + L(704, 690, 'XR', 19);
  s += '<rect x="752" y="658" width="76" height="20" rx="4" fill="#C9D2DE"/>' + ['#C8243A', '#8A6FB0', '#3B8E6E', '#E0A21A', '#3B74C4'].map((c, i) => `<rect x="${758 + i * 9}" y="661" width="5" height="13" rx="2.5" fill="${c}"/>`).join('') + '<rect x="806" y="660" width="18" height="15" rx="2" fill="#5E6878"/>' + L(752, 703, 'LAB', 19);
  s += '<rect x="872" y="656" width="104" height="14" rx="3" fill="#CDB9DA"/>' + ['#F2F2F2', '#E7A2AB', '#A9D6B5', '#F1DA86', '#A9C3E8', '#F2F2F2', '#F2BE8F'].map((c, i) => `<rect x="${877 + i * 14}" y="658.5" width="10" height="9" rx="2" fill="${c}"/>`).join('') + L(984, 690, 'RX', 19);
  for (const x of [1030, 1086]) s += `<rect x="${x}" y="654" width="48" height="56" rx="3" fill="#B7BDC6" stroke="#8E96A1" stroke-width="1.5"/><path d="M${x + 24} 654 v56" stroke="#8E96A1" stroke-width="2"/><path d="M${x + 24} 660 l5 6 h-10z" fill="#5E6878"/>`;
  // break room: counter, coffee, fridge, vending, a table, a couch, a TV
  s += '<rect x="1156" y="5" width="156" height="20" rx="4" fill="#D5DAE1" stroke="#AEB6C0" stroke-width="1"/><ellipse cx="1184" cy="15" rx="10" ry="6" fill="#B8C2CE"/><rect x="1210" y="8" width="24" height="14" rx="2" fill="#4F5966"/><rect x="1212" y="10" width="14" height="10" rx="1" fill="#9FC3EA" opacity=".6"/>';
  s += '<rect x="1280" y="7" width="18" height="16" rx="3" fill="#3A3F48"/><circle cx="1289" cy="15" r="4.6" fill="#6B4A2F"/><g transform="translate(1289 15)"><circle class="steam" r="3" fill="none" stroke="#FFFFFF" stroke-width="1.2"/></g>';
  s += '<rect x="1322" y="5" width="30" height="28" rx="3" fill="#E9EDF2" stroke="#AEB6C0" stroke-width="1"/><path d="M1337 5 v28" stroke="#AEB6C0" stroke-width="1"/><rect x="1358" y="5" width="34" height="28" rx="3" fill="#33507A"/>' + [0, 1, 2].map(i => `<circle cx="${1366 + i * 9}" cy="14" r="3" fill="${['#E7A2AB', '#F1DA86', '#A9D6B5'][i]}"/>`).join('');
  s += '<rect x="1194" y="72" width="124" height="82" rx="24" fill="#F3E8D2" opacity=".85"/><rect x="1214" y="92" width="84" height="42" rx="10" fill="#C9A77C" stroke="#A98456" stroke-width="1.5"/>';
  for (const [x, y] of BREAK_SEATS.slice(0, 6)) s += `<rect x="${x - 9}" y="${y - 7}" width="18" height="18" rx="5" fill="#8C6F4E" opacity=".45"/>`;
  s += '<rect x="1232" y="188" width="160" height="40" rx="10" fill="#7E8FA6"/><rect x="1232" y="214" width="160" height="14" rx="7" fill="#687A92"/><path d="M1286 192 v22 M1338 192 v22" stroke="#687A92" stroke-width="2"/>';
  s += '<rect x="1146" y="84" width="5" height="56" rx="2" fill="#1E2633"/><path class="tvglow" d="M1151 84 l20 -8 v72 l-20 -8z" fill="rgba(143,208,240,.3)"/>' + L(1160, 181, 'BREAK ROOM', 18) + plant(1160, 222);
  // EVS and supply
  s += L(1160, 514, 'EVS', 18) + '<rect x="1160" y="640" width="58" height="28" rx="5" fill="#E3C23B"/><circle cx="1178" cy="654" r="9" fill="#6FA8C9"/><path d="M1204 642 v-20" stroke="#8E6A43" stroke-width="3" stroke-linecap="round"/><rect x="1236" y="640" width="40" height="30" rx="6" fill="#C9D2DE"/><rect x="1241" y="645" width="30" height="20" rx="4" fill="#EEF1F5"/>';
  s += '<rect x="1372" y="498" width="22" height="206" rx="3" fill="#B7BDC6"/>' + [0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="1375" y="${504 + i * 28}" width="16" height="21" rx="2" fill="${['#EEF1F5', '#A9C3E8', '#F1DA86', '#EEF1F5', '#A9D6B5', '#F2BE8F', '#EEF1F5'][i]}"/>`).join('');
  return s;
}

/* Where staff go: with their patient, at their pod, at a desk, or in the break room.
   A third value of 'room' or 'with' means they stand in a room or beside a patient, so taps there reach the room or the patient. */
function staffSpot(s, G, sl) {
  if (s.st === 'break') return sl.brk();
  if (s.st !== 'on') return null;
  if (s.role === 'rph') return ROLE_HOME.rph;
  const k = E.isProv(s) ? (s.q[0] && s.q[0].started ? s.q[0] : null) : s.task;
  const p = k && k.pid ? E.pt(k.pid) : null;
  if (p) {
    const r = p.room && RM[p.room];
    if (r) { const o = sl.bed(p.id, r.h < 60); return [r.x + r.w / 2 + o[0], r.y + r.h / 2 + o[1], 'room']; }
    const at = sl.by.get(p.id);   // beside them on the wall, in a triage bay, or in the waiting room
    if (at && !(s.role === 'reg' && p.loc === 'triage')) { const n = sl.cnt(p.id); return [at[0] + (n ? (n % 2 ? 34 : -34) : 0), at[1], 'with']; }
  }
  if (s.role === 'evs' && s.task && s.task.room && RM[s.task.room]) { const r = RM[s.task.room]; return [r.x + r.w / 2 + 32, r.y + r.h / 2 + 10, 'room']; }
  if (s.role === 'tp') return sl.near(ROLE_HOME.tp, 56, 2);
  if (s.role === 'uc') return [918, 352];   // v0.25: the unit secretary works from the end of the nurses' station
  if (s.role === 'rn') {
    if (s.zones.includes('triage')) { const b = sl.freeBay(); return b != null ? [TRI_BAYS[b][0], TRI_BAYS[b][1]] : sl.near([388, 452], 30, 3); }
    const z = POD_SPOT[s.zones[0]] ? s.zones[0] : 'hold';
    return sl.near(POD_SPOT[z], 46, POD_PER[z]);
  }
  if (s.pit) return sl.near([388, 452], 30, 3);
  if (E.isProv(s)) { const i = sl.prov++; const seat = PROV_SEATS[i % PROV_SEATS.length]; return [seat[0] + Math.floor(i / PROV_SEATS.length) * 14, seat[1], 'seat']; }
  if (s.role === 'reg') return [150 + 54 * Math.max(0, sl.regs.indexOf(s.id)), 356];
  if (s.role === 'pct') { const t = TECH_SPOTS[sl.tech++ % TECH_SPOTS.length]; return [t[0], t[1]]; }
  if (s.role === 'rt') return sl.near(ROLE_HOME.rt, 52, 2);
  if (s.role === 'evs') return sl.near(ROLE_HOME.evs, 50, 3);
  return sl.near([1190, 610], 46, 4);
}

/* ---------- patients who move ----------
   Walk-ins walk from the door to check-in, a triage bay, a seat. When someone is bedded, moved, or leaves,
   a walker or a stretcher makes the trip through the hallway. LAST remembers where each patient was drawn. */
/* v0.23.1: a crew that just pulled in stays out of sight until its ambulance has parked, then shows on the wall.
   HELD: patient id -> when the hold began. WALLSEEN: everyone already shown on the wall (held once at most). */
const HELD = new Map(), WALLSEEN = new Set();
function ambParked(id, on3d) {
  if (on3d) return !!(window.OC3D && OC3D.ambParked && OC3D.ambParked(id));
  const n = document.querySelector(`#mAmbs [data-id="a-${id}"]`);
  return !!(n && !n._anim);
}
const LAST = new Map(), ARRIVE = new Map(), SVGNS = 'http://www.w3.org/2000/svg';
let LASTKEY = null, LASTT = null;
const NOMOTION = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const GATE = [476, 349], HALL_Y = 349;
const CONS_LAB = { hosp: 'HM', cards: 'CA', neuro: 'NE', surg: 'GS', trauma: 'TS', ortho: 'OR', gi: 'GI', psych: 'PY', icu: 'CC' };
const LIFT = [1086, 680];   // the elevators: consultants come down and go back up this way
const PAD = [-337, 260], PAD_X0 = -470;   // v0.26: the helipad, across the road from the ambulance bay; the camera may pan left to it
const BAY_IN = [[64, 190], [126, 200]];
/* Where a visitor comes in from, and the way back out. */
function pathIn(from, at) {
  if (from === 'pad') return [PAD, [-150, 250], [60, 250]].concat(BAY_IN.slice(1), routeTo(BAY_IN[1], at));
  if (from === 'bay') return BAY_IN.concat(routeTo(BAY_IN[1], at));
  return [LIFT, [1150, 676], [1150, HALL_Y]].concat(routeTo([1150, HALL_Y], at));
}
const pathOut = (from, at) => [at].concat(routeOut(at, from === 'pad' ? 'pad' : from === 'bay' ? 'bay' : 'up'));
const AMB_LINGER = new Map(), HELI = new Map();
/* Walk a figure along a path with WAAPI; its own transform is already where it ends. */
function walkPath(n, path, then) {
  const segs = []; let len = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(d); len += d; }
  if (len < 10 || NOMOTION.matches || !n.animate) { if (then) setTimeout(then, 300); return; }
  const dur = Math.max(900, Math.min(4200, len / 0.32)); let acc = 0;
  const frames = path.map((pt, i) => { if (i) acc += segs[i - 1]; return { transform: `translate(${pt[0]}px, ${pt[1]}px)`, offset: Math.min(1, acc / len) }; });
  n.style.transition = 'none'; n.classList.add('walk');
  try { const a = n.animate(frames, { duration: dur, easing: 'linear' }); a.onfinish = () => { n.classList.remove('walk'); n.style.transition = ''; if (then) then(); }; } catch (e) { if (then) then(); }
}
function routeTo(from, to) {   // through the openings and down the hallway, not through the walls
  const pts = [], lobby = from[0] < 484 && from[1] > 404, wallSide = from[0] < 250 && from[1] < 342;
  if (wallSide) pts.push([224, 336]);
  if (to[0] < 484 && to[1] < 330) { if (lobby) pts.push([458, 414], GATE); else if (from[0] >= 484) pts.push([from[0], HALL_Y], GATE); pts.push([366, 362]); }   // into Resus through the alcove
  else if (to[0] >= 484) { if (lobby) pts.push([458, 414]); pts.push(from[0] < 484 ? GATE : [from[0], HALL_Y], [to[0], HALL_Y]); }
  pts.push(to); return pts;
}
function routeOut(from, how) {   // 'door': walks out the front. 'up': to the elevators. 'bay': out to an ambulance.
  const pts = [];
  if (from[0] >= 484) pts.push([from[0], HALL_Y]);
  if (how === 'up') { if (from[0] < 484) pts.push(GATE); pts.push([1150, HALL_Y], [1150, 676], [1086, 680]); return pts; }
  if (from[0] >= 484) pts.push(GATE);
  if (how === 'bay') { pts.push([224, 336], [150, 190], [64, 190]); return pts; }
  if (how === 'pad') { pts.push([224, 336], [150, 250], [60, 250], [-150, 250], [PAD[0] + 40, PAD[1]]); return pts; }
  if (from[0] >= 250 || from[1] < 404) pts.push([458, 414]);
  pts.push([196, 612], [126, 663], [30, 663]); return pts;
}
function mapMove(from, pts, kind, p, pusher) {
  const layer = document.getElementById('mMove'); if (!layer || layer.childElementCount > 12) return 0;
  const path = [from].concat(pts), segs = []; let len = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(d); len += d; }
  if (len < 10) return 0;
  const dur = Math.max(650, Math.min(2800, len / 0.45));
  const n = document.createElementNS(SVGNS, 'g'); n.setAttribute('class', 'mmove');
  const esi = p.tri === 'done' || p.room ? ve(p) : 0;
  n.innerHTML = kind === 'stretcher' ? `<g transform="translate(-32 0)">${crewSVG(false, pusher)}</g>${stretcherSVG(-16, -11, 54, 22, p, esi)}` : `<g class="wk">${ptChipSVG(p)}</g>`;
  n.style.transform = `translate(${from[0]}px, ${from[1]}px)`;
  layer.appendChild(n);
  let acc = 0;
  const frames = path.map((pt, i) => { if (i) acc += segs[i - 1]; return { transform: `translate(${pt[0]}px, ${pt[1]}px)`, offset: Math.min(1, acc / len) }; });
  try { n.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }); } catch (e) { n.remove(); return 0; }
  setTimeout(() => n.remove(), dur + 60);
  return dur;
}
/* Morning light, plain daylight, a golden late afternoon, dusk by 19:00. */
function dayTint(t) {
  if (t < 90) return ['#FFBE6E', 0.15 * (1 - t / 90)];
  if (t < 540) return ['#FFBE6E', 0];
  if (t < 660) return ['#FF9A3C', 0.13 * (t - 540) / 120];
  const f = Math.min(1, (t - 660) / 60);
  return [`rgb(${Math.round(255 - 195 * f)},${Math.round(154 - 94 * f)},${Math.round(60 + 70 * f)})`, 0.13 + 0.09 * f];
}

/* The camera: the whole floor fits by default; drag to pan, pinch or wheel to zoom. */
const CAM = { x: 0, y: 0, w: MW, h: MH, set: false, far: true };
function camClamp(el) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;   // hidden: leave the camera alone
  const ar = r.width / r.height;
  const wMax = Math.max(MW + 14, (MH + 14) * ar);   // zoomed all the way out, the whole floor fits
  CAM.w = Math.max(300, Math.min(CAM.w, wMax)); CAM.h = CAM.w / ar;
  CAM.x = MW <= CAM.w ? (MW - CAM.w) / 2 : Math.max(PAD_X0, Math.min(MW - CAM.w, CAM.x));
  CAM.y = MH <= CAM.h ? (MH - CAM.h) / 2 : Math.max(0, Math.min(MH - CAM.h, CAM.y));
}
function camApply(el) {
  const svg = el.querySelector('svg.floor'); if (!svg || !isFinite(CAM.x + CAM.y + CAM.w + CAM.h)) return;
  svg.setAttribute('viewBox', `${CAM.x.toFixed(1)} ${CAM.y.toFixed(1)} ${CAM.w.toFixed(1)} ${CAM.h.toFixed(1)}`);
  const r = el.getBoundingClientRect();
  if (r.width) { CAM.far = r.width / CAM.w < LOD_NEAR; svg.classList.toggle('far', CAM.far); }
}
function camReset(el) {
  const r = el.getBoundingClientRect();
  CAM.w = 1e9; CAM.x = 0; CAM.y = 0;
  camClamp(el); camApply(el); CAM.set = true; CAM.auto = true; CAM.rw = r.width; CAM.rh = r.height;
}
function camBind(el) {
  const pts = new Map(); let st = null;   // pts: every finger on the floor, with where and when it came down and how far it has strayed
  const toMap = (cx, cy) => { const r = el.getBoundingClientRect(); return [CAM.x + (cx - r.left) / r.width * CAM.w, CAM.y + (cy - r.top) / r.height * CAM.h]; };
  const zoom = (f, cx, cy) => { const [mx, my] = toMap(cx, cy), r = el.getBoundingClientRect(); CAM.w /= f; camClamp(el); CAM.x = mx - (cx - r.left) / r.width * CAM.w; CAM.y = my - (cy - r.top) / r.height * CAM.h; camClamp(el); camApply(el); };
  const snap = moved => ({ x: CAM.x, y: CAM.y, w: CAM.w, p: Array.from(pts.values()).map(a => [a.x, a.y]), moved: !!moved });
  el.addEventListener('pointerdown', e => {
    if (e.isPrimary) pts.clear();   // a first finger down means no other finger is: forget any touch whose lift we never heard about
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), far: 0, slop: e.pointerType === 'mouse' ? 6 : 16 });
    st = snap(false);
  });
  el.addEventListener('pointermove', e => {
    const me = pts.get(e.pointerId); if (!me || !st) return;
    me.x = e.clientX; me.y = e.clientY; me.far = Math.max(me.far, Math.hypot(me.x - me.x0, me.y - me.y0));
    const r = el.getBoundingClientRect(), now = Array.from(pts.values());
    if (now.length >= 2 && st.p.length >= 2) {
      const d0 = Math.hypot(st.p[0][0] - st.p[1][0], st.p[0][1] - st.p[1][1]), d1 = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
      if (!st.moved && Math.abs(d1 - d0) < 12 && me.far < me.slop) return;   // a thumb resting on the glass is not a pinch
      if (d0 > 10) { CAM.w = st.w; CAM.x = st.x; CAM.y = st.y; camClamp(el); zoom(d1 / d0, (now[0].x + now[1].x) / 2, (now[0].y + now[1].y) / 2); }
      st.moved = true; CAM.auto = false; U.mapDrag = performance.now() + 250; return;
    }
    const dx = now[0].x - st.p[0][0], dy = now[0].y - st.p[0][1];
    if (!st.moved && Math.hypot(dx, dy) < me.slop) return;   // a real fingertip slides a little during a tap
    st.moved = true; U.mapDrag = performance.now() + 250;
    const x0 = CAM.x, y0 = CAM.y;
    CAM.x = st.x - dx / r.width * CAM.w; CAM.y = st.y - dy / r.height * CAM.h; camClamp(el); camApply(el);
    if (CAM.x !== x0 || CAM.y !== y0) CAM.auto = false;
  });
  const end = e => { pts.delete(e.pointerId); st = pts.size ? snap(true) : null; };
  // A tap acts on exactly what was under the finger when it came down. (Browsers nudge taps toward nearby big targets, and the floor is full of them.)
  el.addEventListener('pointerup', e => {
    const me = pts.get(e.pointerId);
    // A tap is a touch that stayed put, or a quick one that slid less than a fingertip's width (a hurried thumb). A drag is slower or goes farther.
    const quick = !!(me && st && st.moved && pts.size === 1 && st.p.length === 1 && e.pointerType !== 'mouse' && performance.now() - me.t0 < 300 && me.far < 30);
    if (quick) { CAM.x = st.x; CAM.y = st.y; CAM.w = st.w; camClamp(el); camApply(el); U.mapDrag = 0; }   // put the floor back where it was
    const tap = !!(me && st && (quick || (!st.moved && me.far < me.slop)));
    end(e);
    if (!tap || e.button > 0) return;
    U.mapTap = { t: performance.now() + 600, x: e.clientX, y: e.clientY, x0: me.x0, y0: me.y0 };   // the browser's own click for this tap is dropped
    const hit = document.elementsFromPoint(me.x0, me.y0).find(n => el.contains(n) && n.closest('[data-act]'));
    let tgt = hit ? hit.closest('[data-act]') : null;
    if (tgt && CAM.far && tgt.dataset.clu) tgt = document.getElementById(tgt.dataset.clu) || tgt;   // zoomed out, people at the door and in the waiting room are too small to pick: open the list
    mapAct(tgt, me.x0, me.y0);
  });
  el.addEventListener('pointercancel', end);
  window.addEventListener('pointerup', e => { if (pts.has(e.pointerId) && !el.contains(e.target)) end(e); });   // lifted somewhere off the floor
  window.addEventListener('pointercancel', e => { if (pts.has(e.pointerId) && !el.contains(e.target)) end(e); });
  window.addEventListener('blur', () => { pts.clear(); st = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); CAM.auto = false; zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
}
/* v0.26: pan to the helipad to watch the helicopter. */
function watchPad() {
  if (on3dNow()) { if (OC3D.lookPad) OC3D.lookPad(); return; }
  const el = document.getElementById('map'); if (!el) return;
  const r = el.getBoundingClientRect(), ar = r.width / Math.max(1, r.height);
  CAM.w = 560; CAM.h = CAM.w / ar; CAM.x = PAD[0] - 150; CAM.y = PAD[1] - CAM.h / 2; CAM.set = true; camClamp(el); camApply(el);
}
function mapZoom(f) {
  const el = document.getElementById('map'); if (!el) return;
  if (el.classList.contains('three') && window.OC3D) { OC3D.zoom(f); return; }
  if (!f) { camReset(el); return; }
  const cx = CAM.x + CAM.w / 2, cy = CAM.y + CAM.h / 2;
  CAM.w /= f; camClamp(el); CAM.x = cx - CAM.w / 2; CAM.y = cy - CAM.h / 2; camClamp(el); camApply(el); CAM.auto = false;
}
const mapZoomed = () => { const el = document.getElementById('map'), r = el && el.getBoundingClientRect(); if (el && el.classList.contains('three') && window.OC3D) return OC3D.zoomed(); return !!(r && r.width && CAM.w < Math.max(MW + 14, (MH + 14) * r.width / r.height) * 0.97); };
/* On the 3D floor the flat map is still laid out underneath, invisible. These name what a flat-map element stands for,
   so the 3D floor can ring it, frame it, and say where it is on screen. */
const on3dNow = () => { const el = document.getElementById('map'); return !!(el && el.classList.contains('three') && window.OC3D && OC3D.ready()); };
function tgt3d(x) {
  if (!x || !x.closest) return null; let n;
  if ((n = x.closest('[data-act="pt"][data-arg]'))) return { kind: 'pt', id: n.dataset.arg };
  if ((n = x.closest('[data-id^="s-"]'))) return { kind: 'staff', id: n.dataset.id.slice(2) };
  if ((n = x.closest('[id^="mroom-"]'))) return { kind: 'room', id: n.id.slice(6) };
  if ((n = x.closest('[id^="mzh-"]'))) return { kind: 'zone', id: n.id.slice(4) };
  if ((n = x.closest('#mWait, #mWall, #mDoor, #mBox'))) return { kind: 'count', id: { mWait: 'wait', mWall: 'wall', mDoor: 'door', mBox: 'box' }[n.id] };
  return null;
}
/* Where a flat-map element is on screen: on the 3D floor, where its 3D stand-in is. */
function mapRect(x) {
  if (x && x.closest && x.closest('#map') && on3dNow()) { const r = OC3D.rectOf(tgt3d(x)); if (r) return r; }
  return x.getBoundingClientRect();
}
const camFar = () => (on3dNow() ? OC3D.far() : CAM.far);
/* Bring something on the floor into view (the Orientation uses this). */
function mapFocus(x) {
  const el = document.getElementById('map'); if (!el || !x) return;
  const m = el.getBoundingClientRect(), r = mapRect(x), pad = 16;
  if (!m.width || !m.height || !r.width) return;
  const free = { left: m.left, right: m.right, top: m.top, bottom: m.bottom };   // the part of the floor the coach card doesn't cover
  const cc = document.getElementById('coach');
  if (cc && !cc.hidden) {
    const c = cc.getBoundingClientRect();
    if (c.width && c.top < m.bottom && c.bottom > m.top) {
      if (c.left > m.left + m.width / 3) free.right = Math.min(free.right, c.left - 8);
      else if (c.right < m.right - m.width / 3) free.left = Math.max(free.left, c.right + 8);
      else if (c.top > m.top + m.height / 3) free.bottom = Math.min(free.bottom, c.top - 8);
    }
  }
  if (on3dNow()) { OC3D.bring(tgt3d(x), free); return; }
  if (r.left >= free.left + pad && r.right <= free.right - pad && r.top >= free.top + pad && r.bottom <= free.bottom - pad) return;
  CAM.x += ((r.left + r.right) / 2 - (free.left + free.right) / 2) * CAM.w / m.width;
  CAM.y += ((r.top + r.bottom) / 2 - (free.top + free.bottom) / 2) * CAM.h / m.height;
  camClamp(el); camApply(el);
}
/* The Orientation's spotlight: a ring around each lit target on the floor. */
function mapSpot(els, layerId, cls) {
  const el = document.getElementById('map'), layer = document.getElementById(layerId || 'mSpot'); if (!el || !layer) return;
  if (window.OC3D && OC3D.spot) OC3D.spot(layerId || 'mSpot', on3dNow() ? els.map(tgt3d).filter(Boolean) : [], cls || 'spotring');   // the 3D floor draws its own rings
  if (on3dNow()) { setH(layer, ''); return; }
  const m = el.getBoundingClientRect(); let h = '';
  if (m.width) for (const x of els) {
    if (!x.closest || !x.closest('#map')) continue;
    const r = x.getBoundingClientRect(); if (!r.width) continue;
    const k = CAM.w / m.width, pad = 5 * k;
    h += `<rect class="${cls || 'spotring'}" x="${(CAM.x + (r.left - m.left) * k - pad).toFixed(0)}" y="${(CAM.y + (r.top - m.top) * k - pad).toFixed(0)}" width="${(r.width * k + 2 * pad).toFixed(0)}" height="${(r.height * k + 2 * pad).toFixed(0)}" rx="${(9 * k).toFixed(1)}"/>`;
  }
  setH(layer, h);
}

/* ---------- the 3D floor (v0.18): src3d/map3d.js, loaded on demand from 3d/map3d.js ----------
   The flat map keeps deciding everything; the 3D floor draws it. Since v0.20 the Orientation and lessons use it too:
   the preceptor's rings and camera moves go through OC3D.spot and OC3D.bring. If WebGL or the files are missing, the flat map shows as before. */
const D3 = { want: null, loading: false, failed: false };
function use3d(G) {
  if (!U.three || !G || D3.failed || U.view !== 'map') { const m = document.getElementById('map'); if (m) m.classList.remove('ld3d'); return false; }
  if (U.scene !== 'game' && !window.OC3D) return false;   // not behind the menu: loading it there stalls the menu's taps
  const ld = on => { const m = document.getElementById('map'); if (m && m.classList.contains('ld3d') !== on) m.classList.toggle('ld3d', on); };   // v0.24.1: say so while 3D loads, so the switch isn't a surprise
  if (!window.OC3D) { load3d(); ld(!D3.failed); return false; }
  const el = document.getElementById('map'); if (!el || !OC3D.ok) { ld(false); return false; }
  if (!el.querySelector('canvas.floor3d')) { if (!OC3D.init(el, H3D)) { D3.failed = true; return false; } if (OC3D.quality) OC3D.quality(U.q3d); }
  if (!el.classList.contains('three')) el.classList.add('three');
  const r = OC3D.ready(); ld(!r); return r;
}
function load3d() {
  if (D3.loading || window.OC3D) return; D3.loading = true;
  const s = document.createElement('script'); s.src = '3d/map3d.js'; s.async = true;
  s.onerror = () => { D3.failed = true; }; document.head.appendChild(s);
}
const floor3d = () => !!(U.three && U.view === 'map' && !D3.failed);   // the 3D floor is (or is about to be) what the player sees
function off3d() { const el = document.getElementById('map'); if (el) el.classList.remove('three'); if (window.OC3D && OC3D.hideSpots) OC3D.hideSpots(); }
const H3D = {
  RM, icon: k => ICO[k] || ICO.wait, route: (a, b) => routeTo(a, b), routeIn: (to, from) => pathIn(from || 'lift', to).slice(1), routeUp: (at, from) => pathOut(from || 'lift', at).slice(1), entry: from => pathIn(from || 'lift', [600, 349])[0], PAD, speed: () => Math.min(4, U.speed || 1),
  drag: () => { U.mapDrag = performance.now() + 250; },
  live: () => U.scene === 'game' && !U.paused && !U.modal,
  fail: () => { D3.failed = true; off3d(); },
  tap(kind, id, cx, cy, far) {
    let n = null;
    if (kind === 'room') n = document.getElementById('mroom-' + id);
    else if (kind === 'zone') n = document.getElementById('mzh-' + id);
    else if (kind === 'clu' || kind === 'box') n = document.getElementById(id);
    else if (kind === 'pt') n = document.querySelector(`#map [data-act="pt"][data-arg="${id}"]`);
    else if (kind === 'staff') n = document.querySelector(`#map [data-id="s-${id}"]`);
    if (n && far && n.dataset && n.dataset.clu) n = document.getElementById(n.dataset.clu) || n;   // zoomed out, a crowd opens its list
    U.mapTap = { t: performance.now() + 1500, x: cx, y: cy, x0: cx, y0: cy };   // the browser's own click for this tap comes later and lands on whatever opened: drop it (a busy 3D frame can delay it)
    mapAct(n, cx, cy);
  },
};

function mapRender(G) {
  const el = document.getElementById('map'); if (!el) return;
  if (!el._built) {
    el.innerHTML = `<svg class="floor far" viewBox="0 0 ${MW} ${MH}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Floor plan of the emergency department">
<defs><pattern id="asphalt" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".8" fill="rgba(255,255,255,.08)"/><circle cx="6" cy="6" r=".7" fill="rgba(0,0,0,.12)"/></pattern>
<pattern id="dirt" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="5" r="2.2" fill="rgba(140,98,57,.35)"/><circle cx="11" cy="10" r="1.6" fill="rgba(140,98,57,.3)"/></pattern>
<pattern id="closedP" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#E3E5E8"/><rect width="4" height="10" fill="#CDD1D6"/></pattern>
<pattern id="tile" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0 V26 H0" fill="none" stroke="rgba(27,34,48,.05)" stroke-width="1"/></pattern>
<pattern id="plank" width="46" height="14" patternUnits="userSpaceOnUse"><path d="M0 14 H46 M18 0 V14" fill="none" stroke="rgba(110,78,40,.13)" stroke-width="1"/></pattern>
<pattern id="carpet" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#E6DECF"/><circle cx="3" cy="3" r="1.1" fill="rgba(110,96,70,.2)"/><circle cx="9" cy="9" r="1.1" fill="rgba(110,96,70,.2)"/></pattern></defs>
<g id="mStatic">${mapStatic()}</g><g id="mSvc"></g><g id="mRooms">${G.rooms.filter(r => RM[r.id]).map(r => `<g id="mroom-${r.id}" data-act="room" data-arg="${r.id}" transform="translate(${RM[r.id].x} ${RM[r.id].y})" role="button"></g>`).join('')}</g><g id="mSigns"></g><g id="mAmbs"></g><g id="mHeli"></g><g id="mScan" pointer-events="none"></g><g id="mWx" pointer-events="none"></g><g id="mPts"><g id="mPtsWall"></g><g id="mPtsWalk"></g></g><g id="mAmb"></g><g id="mMove"></g><g id="mPeople"></g><g id="mNames"></g><g id="mFx"></g><g id="mNeed"></g><g id="mSpot"></g></svg>`;
    el._built = true; camBind(el);
  }
  const on3d = use3d(G); if (!on3d) off3d();
  const rr = el.getBoundingClientRect();
  if (rr.width && !CAM.set) camReset(el);
  else if (rr.width && (Math.abs(rr.width - CAM.rw) > 2 || Math.abs(rr.height - CAM.rh) > 2)) {   // the screen changed shape: keep looking at the same spot
    const cx = CAM.x + CAM.w / 2, cy = CAM.y + CAM.h / 2, k = CAM.rw ? CAM.w / CAM.rw : 1;
    if (CAM.auto || Math.abs(rr.width - CAM.rw) > 200 || Math.abs(rr.height - CAM.rh) > 200) camReset(el);
    else { CAM.w = rr.width * k; camClamp(el); CAM.x = cx - CAM.w / 2; CAM.y = cy - CAM.h / 2; camClamp(el); camApply(el); CAM.rw = rr.width; CAM.rh = rr.height; }
  }
  const sel = U.sel, selP = sel && sel.pid ? E.pt(sel.pid) : null, selS = sel && sel.type === 'prov' ? E.staff(sel.sid) : null;
  const act = E.active(), md = MD();
  const setA = (n, k, v) => { const c = n._a || (n._a = {}); if (c[k] !== v) { n.setAttribute(k, v); c[k] = v; } };
  const SN = on3d ? { rooms: [], staff: [], pts: [], amb: [], signs: [], counts: [], left: {}, heli: [], wx: 'clear', t: G.t, power: !!(G.out && G.out.power && G.out.power.until > G.t) } : null;   // what the 3D floor draws this frame

  // a new shift or a loaded save: forget where people were
  const nowMs = performance.now(), key = G.seed + '|' + G.level + '|' + G.mode;
  if (key !== LASTKEY || (LASTT != null && G.t < LASTT - 0.5)) { LAST.clear(); ARRIVE.clear(); SEAT.clear(); HELD.clear(); WALLSEEN.clear(); const mv = document.getElementById('mMove'); if (mv) mv.innerHTML = ''; }
  LASTKEY = key; LASTT = G.t;
  const motion = !NOMOTION.matches && !U.ff && U.speed <= 2 && U.scene === 'game' && !document.hidden;
  const posNow = new Map();
  for (const r of G.rooms) {
    const R = RM[r.id]; if (!R || !r.pid) continue;
    const c = [R.x + R.w / 2, R.y + R.h / 2], prev = LAST.get(r.pid), p = E.pt(r.pid);
    posNow.set(r.pid, { x: c[0], y: c[1], kind: 'room', room: r.id });
    if (SN && p) SN.pts.push({ id: p.id, kind: 'room', room: r.id, x: c[0], y: c[1], esi: p.tri === 'done' || p.room ? ve(p) : 0, name: p.name });
    if (motion && p && prev && (prev.kind !== 'room' || prev.room !== r.id) && !ARRIVE.has(r.pid)) {   // walking or rolling to the bed
      const roll = prev.kind === 'wall' || prev.kind === 'amb' || (prev.kind === 'room' && ve(p) <= 2);
      const d = mapMove([prev.x, prev.y], routeTo([prev.x, prev.y], c), roll ? 'stretcher' : 'walk', p, prev.kind === 'room' ? ROLEC.rn : null);
      if (d) ARRIVE.set(r.pid, nowMs + d);
    }
  }
  for (const [id, until] of Array.from(ARRIVE)) if (until < nowMs) ARRIVE.delete(id);

  // pod signs: tap to assign nurses
  let signs = '';
  for (const z of Object.keys(ZSIGN)) {
    const [x, y, w] = ZSIGN[z], ns = E.zoneNurses(z), load = E.zoneLoad(z, hasHold()), cap = ns.length * 4, n = E.zonePts(z), zn = E.ZONE_NAME[z] || z;
    const closed = G.rooms.some(r => r.z === z && r.closed);
    const over = (!ns.length && n > 0) || load > cap, full = ns.length && load === cap;
    const lt = ns.length ? `${fl(load)}/${cap}` : closed ? (z === 'ft' && G.t < 120 ? '09:00' : 'closed') : n ? 'no RN!' : 'no RN';
    const fg = over ? '#FFFFFF' : '#1B2230';
    if (SN) SN.signs.push({ z, x, y, w, over, full: !!full, text: `${ZSHORTN[z]}${ZRANGE[z] ? ' ' + ZRANGE[z] : ''} · ${lt}` });
    signs += `<g class="msign${over ? ' over' : ''}" id="mzh-${z}" data-act="zone" data-arg="${z}" transform="translate(${x} ${y})" role="button" aria-label="${esc(zn)}: ${ns.length ? esc(ns.map(s => s.short).join(' and ')) + `, load ${fl(load)} of ${cap}` : 'no nurse'}"><rect x="-3" y="${y > 400 ? -26 : -8}" width="${w + 6}" height="${y < 100 ? 58 : y > 400 ? 64 : 46}" fill="transparent"/>`
      + `<rect width="${w}" height="30" rx="15" fill="${over ? '#C8243A' : closed && !ns.length ? '#E6E8EB' : '#FFFFFF'}" stroke="${over ? '#C8243A' : full ? '#B76E00' : '#8E97A4'}" stroke-width="${full ? 2.4 : 1.6}"/>`
      + `<g class="faronly"><text x="12" y="22" font-size="20" font-weight="700" fill="${fg}">${ZSHORTN[z]}${ZRANGE[z] ? `<tspan dx="7" font-size="17" fill="${over ? '#FFE3E6' : '#3D4757'}">${ZRANGE[z]}</tspan>` : ''}</text>${ns.slice(0, 3).map((s, i) => `<circle cx="${w - 88 - i * 15}" cy="15" r="6" fill="${over ? '#FFFFFF' : ROLEC.rn}"/>`).join('')}<text x="${w - 12}" y="21.5" text-anchor="end" font-size="18" font-weight="700" fill="${fg}">${lt}</text></g>`
      + `<text class="nearonly" x="12" y="20" font-size="14" font-weight="700" fill="${fg}">${esc(zn)} · ${ns.length ? esc(ns.map(s => s.short).join(' + ')) + ' ' : ''}${lt}</text></g>`;
  }
  setH(document.getElementById('mSigns'), signs);

  // rooms: floor, bed and patient, what they need next, what a selection can do here
  let names = '';
  for (const r of G.rooms) {
    const R = RM[r.id], n = R && document.getElementById('mroom-' + r.id); if (!n) continue;
    const p = r.pid ? E.pt(r.pid) : null, ns = p ? nextStep(p, r, G) : null, esi = p && (p.tri === 'done' || p.room) ? ve(p) : 0;
    const w = R.w, h = R.h, cx = w / 2, kind = r.kind, empty = !p, dirty = empty && r.st === 'dirty' && !r.closed;
    let selc = '';
    if (sel && (sel.type === 'pt' || sel.type === 'move') && selP) selc = E.canPlace(selP, r).ok ? ' ok' : ' no';
    else if (sel && sel.type === 'reg') selc = p && regable(p) ? ' ok' : ' no';
    else if (sel && sel.type === 'tri') selc = ' no';
    else if (selS) selc = p && E.needsProv(p) && E.canAssign(selS, p).ok ? ' ok' : ' no';
    const crit = p && (p.crash || p.arrest || p.shock || (p.bleed === 'mtp' && !p.bb));
    const nfl = !!(ns && /\bfl\b/.test(ns.c)), ntn = ns ? toneOf(ns.c).replace(' fl', '') : '';
    const cat = r.closed ? 'closed' : p ? (!nfl ? (ntn === 'board' ? 'board' : 'calm') : ntn === 'bad' || ntn === 'code' ? 'bad' : ntn === 'go' ? 'go' : ntn === 'warn' ? 'warn' : ntn === 'act' ? 'need' : ntn === 'board' ? 'board' : 'calm')
      : dirty ? (G.evsQ.indexOf(r.id) < 0 && !md ? 'dirty' : 'dirtyq') : r.st === 'cleaning' ? 'cleaning' : 'empty';
    const TL = TILE[cat], solid = !!TL[2], fill = TL[0];
    const words = String(ns ? ns.t : r.closed ? 'Closed' : r.st === 'dirty' ? (G.evsQ.indexOf(r.id) >= 0 ? 'EVS line #' + (G.evsQ.indexOf(r.id) + 1) : 'Dirty') : r.st === 'cleaning' ? 'Cleaning' : 'Clean');
    const plain = words.replace(/<[^>]+>/g, '');
    const sw = solid ? 4 : cat === 'empty' ? 2 : 3, hallE = kind === 'hall' && !p && !r.closed && r.st === 'clean';
    let g = `<rect class="mr-f" x="${sw / 2}" y="${sw / 2}" width="${w - sw}" height="${h - sw}" rx="9" fill="${hallE ? 'rgba(255,255,255,.4)' : fill}" stroke="${hallE ? '#8A94A3' : TL[1]}" stroke-width="${sw}"${hallE ? ' stroke-dasharray="7 5"' : ''}/>`;
    if (cat === 'dirtyq') g += `<rect width="${w}" height="${h}" rx="9" fill="url(#dirt)"/>`;
    if (r.safe) g += `<rect x="3.5" y="3.5" width="${w - 7}" height="${h - 7}" rx="5" fill="none" stroke="#3F7FC4" stroke-width="3.6" stroke-dasharray="3 5"/>`;
    if (r.iso) g += `<rect x="3.5" y="3.5" width="${w - 7}" height="${h - 7}" rx="5" fill="none" stroke="#E0A21A" stroke-width="2.4" stroke-dasharray="7 5"/>`;
    if (p && p.arrest) g += `<rect class="codefl" width="${w}" height="${h}" rx="7" fill="#C8243A"/>`;
    if (md && p && mine(p)) g += `<rect x="5.5" y="5.5" width="${w - 11}" height="${h - 11}" rx="4" fill="none" stroke="#F2C230" stroke-width="4.5"/><path d="M0 ${h - 30} V${h - 7} a7 7 0 0 0 7 7 H30Z" fill="#F2C230"/>`;
    const vt = p ? E.vitalsOf(p) : null;
    if (p && p.arrest) g += `<g class="beacon" transform="translate(${w - 13} ${h - 13})"><circle r="8" fill="#C8243A" stroke="#fff" stroke-width="1.2"/><path class="bspin" d="M0 0 L8 -3.4 A8.7 8.7 0 0 1 8 3.4Z" fill="#FFE3E6"/></g>`;
    // the info band: number, what it needs, ESI
    const small = kind === 'hall' || kind === 'chair', idf = small ? 19 : String(r.id).length > 2 ? 17 : 22;   // hallway beds and chairs read as large as they can in a short tile
    const rlab = kind === 'chair' ? 'Ch' + String(r.id).slice(1) : r.id;   // chairs are Ch1 to Ch6 on the map, so they are not read as Pod C
    g += `<text x="6" y="${small ? 20 : String(r.id).length > 2 ? 21 : 23}" font-size="${idf}" font-weight="700" fill="${solid ? '#FFFFFF' : cat === 'empty' ? '#8A94A3' : '#1B2230'}">${esc(rlab)}</text>`;
    if (esi) g += small ? `<circle cx="${w - 12}" cy="12" r="10" fill="var(--e${esi})" stroke="#FFFFFF" stroke-width="1.8"/><text x="${w - 12}" y="17" text-anchor="middle" font-size="14" font-weight="700" fill="${esi === 3 ? '#3A2F00' : '#fff'}">${esi}</text>`
      : `<circle cx="${w - 16}" cy="17" r="13" fill="var(--e${esi})" stroke="#FFFFFF" stroke-width="2.2"/><text x="${w - 16}" y="23" text-anchor="middle" font-size="17" font-weight="700" fill="${esi === 3 ? '#3A2F00' : '#fff'}">${esi}</text>`;
    if (vt && vt.taken && !vt.arrest && vt.trend === 'worse' && vt.s >= 1.15) g += `<path d="M-6.5 -4 H6.5 L0 6.5Z" transform="translate(${small ? w - 27 : w - 33} ${small ? 23 : 31})" fill="#C8243A" stroke="#fff" stroke-width="1.4"/>`;   // vitals heading the wrong way
    let ico = null, tone = '';
    if (p) { ico = ns.i || 'wait'; tone = toneOf(ns.c); }
    else if (r.closed) { ico = 'lock'; tone = 'off'; }
    else if (r.st === 'dirty') { ico = 'broom'; tone = G.evsQ.indexOf(r.id) < 0 && !md ? 'dirty fl' : 'dirtyq'; }
    else if (r.st === 'cleaning') { ico = 'sparkle'; tone = 'clean'; }
    if (solid) tone = `inv t-${cat}${/\bfl\b/.test(tone) ? ' fl' : ''}`;   // on a solid tile the icon is white with the tile's colour inside
    const tall = h > 120;   // zoomed out, one big icon in the middle of the tile; zoomed in, a small one on the top row, over the name and the words
    if (ico) g += small ? icoSVG(ico, w - 13, h - 14, 11.5, tone) : `<g class="faronly">${icoSVG(ico, cx, tall ? h / 2 - 4 : 48, tall ? 24 : 19, tone)}</g><g class="nearonly">${icoSVG(ico, cx + 2, 18, 16, tone)}</g>`;
    // zoomed in: the words. A room wraps them onto two lines before it cuts them off; a hallway bed or a chair has one line and says it shorter.
    const tcol = ns ? (/n-bad|n-code/.test(ns.c) ? '#C8243A' : /n-act/.test(ns.c) ? '#1E5BC6' : /n-go/.test(ns.c) ? '#1F8048' : /n-warn/.test(ns.c) ? '#96590A' : '#5E6878') : r.st === 'dirty' ? '#8C6239' : r.closed ? '#7A8493' : '#1F8048';
    const flw = ns && /\bfl\b/.test(ns.c), fs = small ? 11.5 : 13, maxc = Math.floor((w - (small ? 30 : 8)) / (fs * 0.5));
    const tsp = x => x.replace(/<span /g, '<tspan ').replace(/<\/span>/g, '</tspan>'), len = x => x.replace(/<span[^>]*><\/span>/g, '0:00').replace(/<[^>]+>/g, '').length;
    let lines = [words];
    if (len(words) > maxc) {
      if (small) { let sh = plain; for (const [a, b] of WORDS_SHORT) sh = sh.replace(a, b); lines = [sh.length > maxc ? sh.slice(0, maxc - 1) + '…' : sh]; }
      else {
        const mc2 = Math.floor((w - 8) / 5.5), cuts = [];
        for (let i = 0, d = 0; i < words.length; i++) { const ch = words[i]; if (ch === '<') d++; else if (ch === '>') d--; else if (ch === ' ' && !d) cuts.push(i); }
        let best = null;
        for (const i of cuts) { const a = words.slice(0, i), b = words.slice(i + 1), sc = Math.max(len(a), len(b)); if (!best || sc < best.sc) best = { a, b, sc }; }
        if (best) { best.a = best.a.replace(/ ·$/, ''); best.b = best.b.replace(/^· /, ''); }   // the dot that joined them is not needed once they are on two lines
        lines = best ? [best.a, len(best.b) > mc2 ? best.b.replace(/<[^>]+>/g, '').slice(0, mc2 - 1) + '…' : best.b] : [plain.slice(0, maxc - 1) + '…'];
      }
    }
    const two = lines.length > 1, lh = 12.5, wy = h - 21 - (two ? lh : 0), wfs = two ? 11 : fs, wx = small ? (w - 26) / 2 : cx;
    g += `<g class="nearonly"><rect x="2" y="${wy}" width="${w - (small ? 28 : 4)}" height="${19 + (two ? lh : 0)}" rx="5" fill="${solid ? '#FFFFFF' : flw ? tcol : 'rgba(255,255,255,.92)'}"/>${lines.map((ln, i) => `<text x="${wx}" y="${h - 7 - (two && !i ? lh : 0)}" text-anchor="middle" font-size="${wfs}" font-weight="700" fill="${solid ? TL[0] : flw ? '#FFFFFF' : tcol}">${tsp(ln)}</text>`).join('')}</g>`;
    // the patient's name, highlighted, so a message that names someone can be matched to a room. A bus-crash patient's tag colour rides on it.
    if (p) {
      const nfill = crit ? '#C8243A' : '#1B2230', tc = p.tag ? TAGC[p.tag] : null;
      const tagN = (x, y, tw, th, fs, cls) => { const mc = Math.max(3, Math.floor((tw - 6 - (tc ? 9 : 0)) / (fs * 0.54))), nm = p.name.length > mc ? p.name.slice(0, mc - 1) + '…' : p.name; return `<g class="mname ${cls}"><rect x="${R.x + x}" y="${R.y + y}" width="${tw}" height="${th}" rx="${Math.min(6, th / 2)}" fill="${nfill}"/>${tc ? `<rect x="${R.x + x + 2.5}" y="${R.y + y + 2.5}" width="8" height="${th - 5}" rx="2.5" fill="${tc}" stroke="#fff" stroke-width="1.1"/>` : ''}<text x="${R.x + x + tw / 2 + (tc ? 4.5 : 0)}" y="${R.y + y + th / 2 + fs * 0.35}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#FFFFFF">${esc(nm)}</text></g>`; };
      if (small) names += tagN(3, h - 19, w - 30, 17, 13, 'faronly') + tagN(26, 2, w - 52, 14, 11, 'nearonly');
      else names += tagN(3, h - 25, w - 6, 22, 16.5, 'faronly') + tagN(5, h - 41 - (two ? lh : 0), w - 10, 17, 13, 'nearonly');
    }
    if (SN) SN.rooms.push({ id: r.id, cat, ico, fl: /\bfl\b/.test(tone), pid: r.pid || null, name: p ? p.name : '', esi, crit: !!crit, arrest: !!(p && p.arrest), selc: selc.trim(), mine: !!(md && p && mine(p)), lab: rlab });
    setA(n, 'class', `mroom${selc}${crit ? ' crit' : ''}`);
    setA(n, 'aria-label', `${E.roomName(r.id)}${p ? `: ${p.name}, ${E.ageSex(p)}, ${p.cc}${esi ? `, ESI ${esi}` : ''}` : ''}. ${plain}`);
    setH(n, g);
  }
  setH(document.getElementById('mNames'), names);

  // who stands where: helpers for the people layers
  const used = {}, beds = {}, by = new Map(), seenPt = {}, bayOf = new Map(), bayUsed = new Set();
  const regIds = G.staff.filter(s => s.role === 'reg').map(s => s.id);
  const sl = {
    brkI: 0, prov: 0, tech: 0, by, regs: regIds,
    brk() { const b = BREAK_SEATS[this.brkI++ % BREAK_SEATS.length]; return [b[0], b[1]]; },
    near(b, dx, per) { dx = dx || 34; per = per || 4; const k = b.join(','); const n = (used[k] = (used[k] || 0) + 1) - 1; return [b[0] + (n % per) * dx, b[1] + Math.floor(n / per) * 24]; },
    bed(pid, small) { const n = beds[pid] = (beds[pid] || 0) + 1, B = small ? BEDSIDE_S : BEDSIDE; return B[Math.min(n, B.length) - 1]; },
    cnt(pid) { const n = seenPt[pid] || 0; seenPt[pid] = n + 1; return n; },
    freeBay() { for (let i = 0; i < TRI_BAYS.length; i++) if (!bayUsed.has(i)) { bayUsed.add(i); return i; } return null; },
  };
  const ptG = (p, x, y, inner, extra, clu) => {
    const ok = sel && sel.type === 'reg' ? regable(p) : sel && sel.type === 'tri' ? p.tri === 'none' && (p.loc === 'wall' || p.loc === 'triage') : null;
    return `<g class="mpt${ok === true ? ' ok' : ok === false ? ' no' : ''}${sel && sel.pid === p.id ? ' sel' : ''}" data-act="pt" data-arg="${p.id}"${clu ? ` data-clu="${clu}"` : ''} transform="translate(${x} ${y})" role="button" aria-label="${esc(p.name)}, ${E.ageSex(p)}, ${esc(p.cc)}${extra || ''}">${inner}</g>`;
  };
  const walker = p => `<rect x="-18" y="-19" width="36" height="40" fill="transparent"/><g class="wk">${ptChipSVG(p, !!(sel && sel.pid === p.id))}</g>`;
  const walkers = [];   // people on their feet at the door and in the waiting room: keyed, so they walk between spots

  // the waiting room: everyone keeps their seat
  let pts = '';
  const waiting = act.filter(p => p.loc === 'waiting').sort((a, b) => a.tArrive - b.tArrive), wIds = new Set(waiting.map(p => p.id));
  for (const id of Array.from(SEAT.keys())) if (!wIds.has(id)) SEAT.delete(id);
  { const taken = new Set(SEAT.values()); let next = 0;
    for (const p of waiting) if (!SEAT.has(p.id)) { while (taken.has(next)) next++; if (next < WAIT_SEATS.length) { SEAT.set(p.id, next); taken.add(next); } } }
  let standing = 0;
  for (const p of waiting) {
    if (!SEAT.has(p.id)) { standing++; continue; }
    const [x, y] = WAIT_SEATS[SEAT.get(p.id)];
    by.set(p.id, [x + 8, y + 16]);
    walkers.push({ p, x, y, extra: ', waiting room', clu: 'mWait', dot: p.tri === 'done' });
    posNow.set(p.id, { x, y, kind: 'seat' });
  }
  if (standing) pts += `<text x="470" y="511" text-anchor="end" font-size="14" font-weight="700" fill="#C8243A">+${standing} standing</text>`;

  // the door: in a triage bay, at the check-in desk, or in line
  const triaging = new Set(G.staff.filter(s => s.task && s.task.kind === 'triage').map(s => s.task.pid));
  const regBy = new Map(); for (const s of G.staff) if (s.role === 'reg' && s.task && s.task.kind === 'reg' && s.task.pid) regBy.set(s.task.pid, Math.max(0, regIds.indexOf(s.id)));
  let door = 0;
  for (const p of G.triageQ.map(E.pt).filter(Boolean)) {
    let at, extra = ', at the door';
    if (triaging.has(p.id) && bayOf.size < TRI_BAYS.length) { const b = bayOf.size; bayOf.set(p.id, b); bayUsed.add(b); at = [TRI_BAYS[b][0], TRI_BAYS[b][2]]; by.set(p.id, [TRI_BAYS[b][0], TRI_BAYS[b][1]]); extra = ', in triage'; }
    else if (regBy.has(p.id)) { at = [150 + 54 * regBy.get(p.id), 416]; extra = ', checking in'; }
    else if (door < 12) { at = [138 + (door % 3) * 44, 584 - Math.floor(door / 3) * 46]; door++; }   // the line forms at the door and grows toward the desk
    else continue;   // the count on the DOOR label covers the ones not drawn
    walkers.push({ p, x: at[0], y: at[1], extra, clu: 'mDoor' });
    posNow.set(p.id, { x: at[0], y: at[1], kind: 'door' });
  }

  // the wall: a crew and a stretcher in each spot, with how long they've held it
  const wall = act.filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive), inside = wall.slice(0, 6), outside = wall.slice(6);
  const lab = (id, t) => { const n = document.getElementById(id); if (n && n.textContent !== t) n.textContent = t; };
  lab('mWallL', wall.length ? `WALL · ${wall.length}` : 'THE WALL');   // with a count it drops THE, so it stays clear of the Resus tray lab('mWaitL', waiting.length ? `WAITING · ${waiting.length}` : 'WAITING'); lab('mDoorL', G.triageQ.length ? `DOOR · ${G.triageQ.length}` : 'DOOR');
  const nowW = performance.now();
  inside.forEach((p, i) => {
    if (!WALLSEEN.has(p.id)) { WALLSEEN.add(p.id); if (i < 3 && motion && !G.train && G.t - p.tArrive < 1) HELD.set(p.id, nowW); }   // only someone who just arrived, with an ambulance to wait for
    if (HELD.has(p.id)) { if (nowW - HELD.get(p.id) > 12000 || (nowW - HELD.get(p.id) > 300 && ambParked(p.id, on3d))) HELD.delete(p.id); else return; }
    const y = WALL_Y(i), esi = p.tri === 'done' ? ve(p) : 0, mins = Math.round(G.t - p.tArrive);
    by.set(p.id, [196, y + 4]);
    posNow.set(p.id, { x: 195, y, kind: 'wall' });
    if (SN) SN.pts.push({ id: p.id, kind: 'wall', x: 195, y, esi, name: p.name, sel: !!(sel && sel.pid === p.id) });
    const badge = intakeDone(p) ? `<g transform="translate(240 ${y + 9})"><circle r="9" fill="#1F8048" stroke="#fff" stroke-width="1.5"/><g transform="scale(.82)" style="color:#fff">${ICO.check}</g></g>`
      : E.emergent(p) ? icoSVG('alert', 240, y + 9, 9, 'bad fl') : '';
    pts += ptG(p, 0, 0, `<rect x="116" y="${y - 23}" width="132" height="46" fill="transparent"/><g transform="translate(134 ${y})">${crewSVG(!!(sel && sel.pid === p.id))}</g>`
      + stretcherSVG(152, y - 13, 86, 26, p, esi) + (p.tag ? `<rect x="148" y="${y - 12}" width="9" height="24" rx="3" fill="${TAGC[p.tag]}" stroke="#fff" stroke-width="1.3"/>` : '')
      + `<g class="nearonly"><rect x="174" y="${y - 7}" width="62" height="14" rx="5" fill="#1B2230"/><text x="205" y="${y + 3.6}" text-anchor="middle" font-size="10" font-weight="700" fill="#FFFFFF">${esc(p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name)}</text><text x="170" y="${y - 15.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#2B3240">${esc(p.unit || '')}</text></g>`
      + `<g transform="translate(226 ${y - 15})"><rect x="-20" y="-9.5" width="40" height="19" rx="9.5" fill="${mins > 30 ? '#C8243A' : mins > 15 ? '#B76E00' : '#5E6878'}" stroke="#fff" stroke-width="1"/><text y="5.2" text-anchor="middle" font-size="14.5" font-weight="700" fill="#fff">${mins}m</text></g>${badge}`,
      `, ${esc(p.unit || 'EMS')} on the wall for ${mins} minutes${intakeDone(p) ? ', ready for a bed' : E.emergent(p) ? ', needs a room now' : ''}`, 'mWall');
  });
  setH(document.getElementById('mPtsWall'), pts);
  const wl = document.getElementById('mPtsWalk'), seenW = new Set();
  for (const w of walkers) {
    const p = w.p, id = 'w-' + p.id, tr = `translate(${w.x}px, ${w.y}px)`; seenW.add(id);
    const ok = sel && sel.type === 'reg' ? regable(p) : sel && sel.type === 'tri' ? p.tri === 'none' && (p.loc === 'wall' || p.loc === 'triage') : null;
    if (SN) { const pk = posNow.get(p.id); SN.pts.push({ id: p.id, kind: pk ? pk.kind : 'door', x: w.x, y: w.y, esi: p.tri === 'done' ? ve(p) : 0, name: p.name, sel: !!(sel && sel.pid === p.id), ok: ok === true, fresh: !LAST.get(p.id) && p.loc === 'triage' && G.t - p.tArrive < 3 }); }
    let n = wl.querySelector(`[data-id="${id}"]`);
    if (!n) {
      n = document.createElementNS(SVGNS, 'g'); n.setAttribute('data-id', id); n.setAttribute('data-act', 'pt'); n.setAttribute('data-arg', p.id); n.setAttribute('role', 'button');
      const prev = LAST.get(p.id);   // new at the door: they come in through the front door
      n.style.transform = !motion ? tr : prev ? `translate(${prev.x}px, ${prev.y}px)` : p.loc === 'triage' && G.t - p.tArrive < 3 ? 'translate(124px, 663px)' : tr;
      wl.appendChild(n); n.getBoundingClientRect();
    }
    const inner = walker(p);
    if (n._svg !== inner) { n.innerHTML = inner; n._svg = inner; }
    const cls = `mpt mwalk${ok === true ? ' ok' : ok === false ? ' no' : ''}${sel && sel.pid === p.id ? ' sel' : ''}`;
    if (n._c !== cls) { n.setAttribute('class', cls); n._c = cls; }
    setA(n, 'data-clu', w.clu); setA(n, 'aria-label', `${p.name}, ${E.ageSex(p)}, ${p.cc}${w.extra || ''}`);
    if (n.style.transform !== tr) { n.style.transform = tr; n.classList.add('walk'); clearTimeout(n._wt); n._wt = setTimeout(() => n.classList.remove('walk'), 950); }
  }
  for (const n of Array.from(wl.children)) if (!seenW.has(n.getAttribute('data-id'))) n.remove();

  // outside: the bay, the driveway, who's inbound
  let amb = '';
  if (outside.length) amb += `<rect x="8" y="250" width="96" height="26" rx="13" fill="#C8243A" stroke="#fff" stroke-width="1.2"/><text x="56" y="268.5" text-anchor="middle" font-size="16" font-weight="700" fill="#FFFFFF">${outside.length} outside</text>`;
  if (outside.length > 4) amb += `<text x="56" y="524" text-anchor="middle" font-size="15" font-weight="700" fill="#FFE08A">+${outside.length - 4} more</text>`;
  if (G.enroute.length > 2) amb += `<text x="100" y="64" text-anchor="end" font-size="13" font-weight="700" fill="#FFD0D5">+${G.enroute.length - 2} inbound</text>`;
  setH(document.getElementById('mAmb'), amb);
  const ambAt = new Map();
  const lingNow = performance.now();
  for (const [pid, until] of Array.from(AMB_LINGER)) if (until < lingNow) AMB_LINGER.delete(pid);
  const picks = E.active().filter(p => p.dsp === 'ridehere' || (p.iftLevel && p.iftLevel !== 'air' && (p.dsp === 'iftreport' || (p.dsp === 'iftwait' && p.due - G.t <= 1.5))))   // v0.25: a rehab ride; v0.26: a transfer crew
    .concat(Array.from(AMB_LINGER.keys()).map(E.pt).filter(Boolean));   // the ambulance waits for its stretcher before it drives off
  const bayIds = wall.slice(0, 3).map(p => p.id).concat(picks.map(p => p.id)).slice(0, 3), stallUsed = new Set();   // a parked ambulance keeps its stall when the one ahead of it leaves
  for (const id of Array.from(AMB_STALL.keys())) if (!bayIds.includes(id)) AMB_STALL.delete(id);
  for (const id of bayIds) if (AMB_STALL.has(id)) stallUsed.add(AMB_STALL.get(id));
  for (const id of bayIds) if (!AMB_STALL.has(id)) { let k = 0; while (stallUsed.has(k)) k++; stallUsed.add(k); AMB_STALL.set(id, k); }
  picks.forEach((p, i) => { if (AMB_STALL.has(p.id)) ambAt.set(p.id, [56, 96 + AMB_STALL.get(p.id) * 56, 'bay', 'pick']); });
  wall.forEach((p, i) => { if (i < 3 && AMB_STALL.has(p.id)) ambAt.set(p.id, [56, 96 + AMB_STALL.get(p.id) * 56, 'bay']); else if (i >= 6 && i < 10) { ambAt.set(p.id, [56, 306 + (i - 6) * 56, 'out']); posNow.set(p.id, { x: 56, y: 306 + (i - 6) * 56, kind: 'amb' }); } });
  G.enroute.map(E.pt).filter(Boolean).slice(0, 2).forEach((p, i) => ambAt.set(p.id, [56, i ? 562 : 32, 'in']));
  const ambL = document.getElementById('mAmbs'), seenA = new Set();
  if (SN) { const k = { bay: 0, out: 0, in: 0 }; for (const [pid, at] of ambAt) SN.amb.push({ pid, mode: at[2], i: k[at[2]]++, pick: at[3] === 'pick' }); }
  for (const [pid, at] of ambAt) {
    const p = E.pt(pid), id = 'a-' + pid, mins = Math.round(G.t - p.tArrive); seenA.add(id);
    let n = ambL.querySelector(`[data-id="${id}"]`);
    if (!n) { n = document.createElementNS('http://www.w3.org/2000/svg', 'g'); n.setAttribute('data-id', id); n.setAttribute('class', 'mamb'); const y0 = at[2] === 'in' && at[1] < 300 ? -70 : MH + 70; n._pos = [56, y0, y0 < 0 ? -90 : 90]; n.style.transform = ambTr(...n._pos); ambL.appendChild(n); }
    const svg = ambSVG({ code: at[3] === 'pick' ? (p.iftLevel ? E.IFT[p.iftLevel].short : 'BLS') : unitCode(p), hot: !at[3] && (at[2] === 'in' || E.emergent(p) || mins < 3), open: at[2] === 'bay', ghost: at[2] === 'in', pill: at[2] === 'out' ? mins + 'm' : at[2] === 'in' ? '▸' + Math.max(0, Math.round(p.eta - G.t)) + 'm' : '', pillBad: at[2] === 'in' || mins > 30 });
    if (n._svg !== svg) { n.innerHTML = svg; n._svg = svg; }
    const put = (k, v) => { if (n.getAttribute(k) !== v) n.setAttribute(k, v); };
    if (at[2] === 'bay') { if (n.hasAttribute('data-act')) { n.removeAttribute('data-act'); n.removeAttribute('data-arg'); n.removeAttribute('role'); } n.style.pointerEvents = 'none'; }
    else { put('data-act', 'pt'); put('data-arg', pid); put('role', 'button'); n.style.pointerEvents = ''; }
    put('aria-label', `${p.unit || 'Ambulance'}: ${E.ageSex(p)}, ${p.cc}${at[2] === 'out' ? `, backed up outside for ${mins} minutes` : at[2] === 'in' ? ', on the way in' : ', at the bay'}`);
    if (!n._pos || n._pos[0] !== at[0] || n._pos[1] !== at[1]) ambDrive(n, at);
  }
  for (const n of Array.from(ambL.children)) if (!n._gone && !seenA.has(n.getAttribute('data-id'))) {
    n._gone = true; n.setAttribute('data-id', ''); n.removeAttribute('data-act'); n.style.pointerEvents = 'none'; ambDrive(n, null);
  }

  // the building's own signals: what's down, the Box ringing, pizza on the table
  const out = k => G.out[k] && G.out[k].until > G.t;
  const outTag = (x, y) => `<g transform="translate(${x} ${y})"><circle r="13" fill="#C8243A" stroke="#fff" stroke-width="2"/><path d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></g>`;
  let svc = '';
  if (out('ct') || out('power')) svc += outTag(529, 683);
  else if (act.some(p => p.work && p.work.ct && (p.work.ct.st === 'doing' || p.work.ct.st === 'run'))) svc += '<circle class="ctglow" cx="529" cy="683" r="14" fill="none" stroke="#3B9AE1" stroke-width="3.5"/>';
  if (out('lab')) svc += outTag(790, 668);
  if (G.pizza) svc += '<rect x="1240" y="100" width="32" height="26" rx="2" fill="#E9DCC0" stroke="#B89B6A"/><circle cx="1256" cy="113" r="9.5" fill="#E8B04A"/><circle cx="1252.5" cy="110" r="2" fill="#C8243A"/><circle cx="1259.5" cy="115.5" r="2" fill="#C8243A"/><circle cx="1258" cy="108.5" r="1.6" fill="#C8243A"/>';
  if (G.box.cur && !G.box.cur.taken) svc += '<g class="boxring" transform="translate(721 350)"><circle r="10"/><circle class="r2" r="10"/></g>';
  setH(document.getElementById('mSvc'), svc);
  if (SN) {
    SN.counts.push({ id: 'wall', text: wall.length ? `WALL · ${wall.length}` : 'THE WALL', bad: wall.length > 5, tap: 'mWall' }, { id: 'wait', text: waiting.length ? `WAITING · ${waiting.length}` : 'WAITING', bad: false, tap: 'mWait' }, { id: 'door', text: G.triageQ.length ? `DOOR · ${G.triageQ.length}` : 'DOOR', bad: false, tap: 'mDoor' });
    if (outside.length) SN.counts.push({ id: 'out', text: `${outside.length} outside`, bad: true });
    if (G.enroute.length) SN.counts.push({ id: 'in', text: `${G.enroute.length} inbound`, bad: false });
    if (G.box.cur && !G.box.cur.taken) SN.counts.push({ id: 'box', text: 'The Box is ringing', bad: true, tap: 'mBox' });
    if (out('ct') || out('power')) SN.counts.push({ id: 'ct', text: 'CT down', bad: true });
    if (out('lab')) SN.counts.push({ id: 'lab', text: 'Lab down', bad: true });
  }
  const [tc, ta] = dayTint(G.t);   // the light changes through the day
  setH(document.getElementById('mFx'), (ta > 0.004 ? `<rect x="-900" y="-700" width="${MW + 1800}" height="${MH + 1400}" fill="${tc}" opacity="${ta.toFixed(2)}" pointer-events="none"/>` : '') + (out('power') ? `<rect x="112" y="0" width="${MW - 112}" height="${MH}" fill="#0A1024" opacity=".3" pointer-events="none"/>` : ''));

  // v0.26: the helicopter: it lands, waits with the rotor turning while the crew goes in, and lifts off with the patient
  const hl = document.getElementById('mHeli'), heliWant = new Set();
  if (hl) {
    for (const p of act) if (p.iftLevel === 'air' && ((p.dsp === 'iftwait' && p.due - G.t <= 3 && !p.airAbort) || p.dsp === 'iftreport')) {
      const id = 'h-' + p.id; heliWant.add(id);
      if (SN) SN.heli.push({ pid: p.id, phase: p.dsp === 'iftreport' ? 'pad' : 'in' });
      let n = hl.querySelector(`[data-id="${id}"]`);
      if (!n) {
        n = document.createElementNS(SVGNS, 'g'); n.setAttribute('data-id', id); n.setAttribute('class', 'mheli'); n.innerHTML = heliSVG(); hl.appendChild(n);
        const end = `translate(${PAD[0]}px, ${PAD[1]}px) scale(1)`; n.style.transform = end;
        if (!NOMOTION.matches && n.animate) n.animate([{ transform: `translate(${PAD[0] - 520}px, ${PAD[1] - 380}px) scale(1.9) rotate(-25deg)`, opacity: 0.2 }, { transform: `translate(${PAD[0] - 60}px, ${PAD[1] - 50}px) scale(1.25) rotate(-5deg)`, opacity: 1, offset: 0.7 }, { transform: end, opacity: 1 }], { duration: 3400, easing: 'ease-out' });
      }
      n.classList.toggle('idle', p.dsp === 'iftreport');
    }
    for (const n of Array.from(hl.children)) {
      if (heliWant.has(n.getAttribute('data-id')) || n._leaving) continue;
      n._leaving = true; n.classList.remove('idle');
      const pp = E.pt(n.getAttribute('data-id').slice(2)), wait = pp && pp.loc === 'gone' ? 2800 : 300;
      setTimeout(() => {
        if (NOMOTION.matches || !n.animate) { n.remove(); return; }
        const a = n.animate([{ transform: `translate(${PAD[0]}px, ${PAD[1]}px) scale(1)` }, { transform: `translate(${PAD[0] - 40}px, ${PAD[1] - 60}px) scale(1.3)`, offset: 0.35 }, { transform: `translate(${PAD[0] - 600}px, ${PAD[1] - 420}px) scale(2) rotate(-30deg)`, opacity: 0 }], { duration: 3200, easing: 'ease-in', fill: 'forwards' });
        a.onfinish = () => n.remove();
      }, wait);
    }
  }
  // v0.26: weather over the whole map
  const wx = G.wx || 'clear', wxl = document.getElementById('mWx');
  if (wxl && wxl._wx !== wx) { wxl._wx = wx; setH(wxl, wxSVG(wx)); }
  if (SN) { SN.wx = wx; SN.grounded = E.wxGrounded(); }
  // v0.26: patients away for a scan lie on the table
  let scan = '';
  for (const [m, xy] of [['ct', [540, 672]], ['xr', [646, 673]], ['mri', [540, 672]]]) {
    const b = G.img[m] && G.img[m].busy, sp = b && E.pt(b.pid);
    if (!sp || sp.loc !== 'room') continue;
    scan += `<g class="mscan">${stretcherSVG(xy[0], xy[1], 54, 22, sp, ve(sp))}</g>`;
    if (SN) { const q = SN.pts.find(x => x.id === sp.id); if (q) Object.assign(q, { kind: 'scan', x: xy[0] + 27, y: xy[1] + 11 }); }
  }
  const scl = document.getElementById('mScan'); if (scl) setH(scl, scan);

  // staff, keyed so they walk between spots
  const layer = document.getElementById('mPeople'), seen = new Set();
  for (const s of G.staff) {
    const at = staffSpot(s, G, sl); if (!at) continue;
    const id = 's-' + s.id, inRoom = at[2] === 'room' || at[2] === 'with', me = isMe(s);
    const svg = (inRoom ? '' : '<circle r="22" fill="transparent"/>') + '<g class="wk">' + chipSVG({ label: roleLab(s), body: ROLEC[s.role], tag: at[2] === 'seat' ? '' : me ? 'You' : s.short, tagFg: ROLEC[s.role], ring: !!(sel && sel.sid === s.id), me }) + '</g>';
    const actn = E.isProv(s) ? 'prov' : s.role === 'reg' ? 'regSel' : s.role === 'uc' ? 'ucOpen' : s.role === 'rn' && s.zones.includes('triage') ? 'triSel' : 'staffOpen';
    if (SN) SN.staff.push({ id: s.id, role: s.role, title: s.title, label: roleLab(s), at: [at[0], at[1], at[2] || ''], inRoom, me, sel: !!(sel && sel.sid === s.id), seat: at[2] === 'seat' ? Math.max(0, PROV_SEATS.findIndex(q => q[1] === at[1] && Math.abs(q[0] - at[0]) % 14 === 0 && at[0] >= q[0])) : null, brk: s.st === 'break' ? Math.max(0, BREAK_SEATS.findIndex(q => q[0] === at[0] && q[1] === at[1])) : null });
    seen.add(id);
    let n = layer.querySelector(`[data-id="${id}"]`);
    if (!n) { n = document.createElementNS('http://www.w3.org/2000/svg', 'g'); n.setAttribute('data-id', id); n.setAttribute('class', 'mp'); n.style.transform = `translate(${at[0]}px, ${at[1]}px)`; layer.appendChild(n); }
    if (n._svg !== svg) { n.innerHTML = svg; n._svg = svg; }
    setA(n, 'data-act', actn);
    const pe = inRoom ? 'none' : ''; if (n.style.pointerEvents !== pe) n.style.pointerEvents = pe;
    if (n.getAttribute('data-arg') !== s.id) { n.setAttribute('data-arg', s.id); n.setAttribute('role', 'button'); n.setAttribute('aria-label', `${s.name}, ${s.title}`); }
    const tr = `translate(${at[0]}px, ${at[1]}px)`;
    if (n.style.transform !== tr) { n.style.transform = tr; n.classList.add('walk'); clearTimeout(n._wt); n._wt = setTimeout(() => n.classList.remove('walk'), 950); }
  }
  // v0.25: consultants come down in the elevator, see the patient at the bedside, and go back up.
  // v0.26: help from upstairs does the same; transport crews come in from the bay or the helipad.
  const visit = (id, p, lab, body, from, sn, crew) => {
    const r = RM[p.room]; if (!r) return;
    const o = sl.bed(p.id, r.h < 60), at = [r.x + r.w / 2 + o[0], r.y + r.h / 2 + o[1]];
    const svg = '<g class="wk">' + (crew ? crewSVG(false) : chipSVG({ label: lab, body, tag: sn.tag, tagFg: body })) + '</g>';
    if (SN) SN.staff.push({ id: 'v' + id, role: sn.role, title: sn.title, label: lab, at: [at[0], at[1], 'room'], inRoom: true, visitor: true, from, pid: p.id, me: false, sel: false, seat: null, brk: null });
    seen.add(id);
    let n = layer.querySelector(`[data-id="${id}"]`);
    if (!n) {
      n = document.createElementNS(SVGNS, 'g'); n.setAttribute('data-id', id); n.setAttribute('class', 'mp cons'); n.style.pointerEvents = 'none'; n.setAttribute('aria-label', sn.title);
      n.style.transition = 'none'; n.style.transform = `translate(${at[0]}px, ${at[1]}px)`; layer.appendChild(n); n._at = at; n._from = from; n._pid = p.id;
      walkPath(n, pathIn(from, at));
    }
    if (n._svg !== svg) { n.innerHTML = svg; n._svg = svg; }
  };
  for (const p of act) {
    if (p.loc !== 'room') continue;
    const c = p.consult;
    if (c && c.tVisit != null && G.t - c.tVisit < E.CONS_VISIT) { const sp = E.SPECS[c.spec] || {}; visit('c-' + p.id, p, CONS_LAB[c.spec] || 'Dr', ROLEC.cons, 'lift', { role: 'cons', title: `${sp.doc || 'A consultant'}, ${sp.name || 'consultant'}`, tag: sp.short || 'Consult' }); }
    const c2 = p.consult2;
    if (c2 && c2.tVisit != null && G.t - c2.tVisit < E.CONS_VISIT) { const sp = E.SPECS[c2.spec] || {}; visit('d-' + p.id, p, CONS_LAB[c2.spec] || 'Dr', ROLEC.cons, 'lift', { role: 'cons', title: `${sp.doc}, ${sp.name}`, tag: sp.short || 'Consult' }); }
    const h = p.help;
    if (h && h.tVisit != null && h.st !== 'req' && G.t - h.tVisit < 15) { const H = E.HELP[h.k]; visit('h-' + p.id, p, H.short, ROLEC.help, 'lift', { role: 'help', title: `${H.doc}, ${H.name}`, tag: H.name.split(' ')[0] }); }
    if (p.dsp === 'iftreport' && p.iftLevel) {
      const air = p.iftLevel === 'air', from = air ? 'pad' : 'bay', L = E.IFT[p.iftLevel];
      for (const k of [1, 2]) visit(`t${k}-` + p.id, p, air ? 'FL' : '', ROLEC.flt, from, { role: 'ems', title: `${L.name} crew`, tag: air ? 'Flight' : L.short }, !air);
    }
  }
  for (const n of Array.from(layer.children)) {
    const nid = n.getAttribute('data-id'); if (seen.has(nid)) continue;
    if (n._at && !n._out) {   // the visit is over: back the way they came. A crew that leaves with its patient goes with the stretcher.
      const pp = E.pt(n._pid);
      if (n._from !== 'lift' && (!pp || pp.loc === 'gone')) { n.remove(); continue; }
      const out = pathOut(n._from, n._at), end = out[out.length - 1];
      n._out = true; n.style.transition = 'none'; n.style.transform = `translate(${end[0]}px, ${end[1]}px)`;
      walkPath(n, out, () => n.remove()); continue;
    }
    if (!n._out) n.remove();
  }

  // people who left since the last frame walk or roll out; then remember where everyone is
  for (const [pid, prev] of Array.from(LAST)) {
    if (posNow.has(pid)) continue;
    const p = E.pt(pid);
    if (motion && p && p.loc === 'gone' && p.outcome && p.outcome !== 'expired') {
      const how = p.dcTo === 'rehab' ? 'bay' : ['dc', 'lwbs', 'ama'].includes(p.outcome) ? 'door' : p.outcome === 'tx' ? (p.iftLevel === 'air' ? 'pad' : 'bay') : 'up';
      if (how === 'bay') AMB_LINGER.set(pid, performance.now() + 2600);
      if (SN) SN.left[pid] = how;
      mapMove([prev.x, prev.y], routeOut([prev.x, prev.y], how), how === 'door' ? 'walk' : 'stretcher', p, how === 'bay' ? null : ROLEC.tp);
    }
    LAST.delete(pid);
  }
  for (const [pid, at] of posNow) LAST.set(pid, at);
  if (SN) window.OC3D.sync(SN);
}
