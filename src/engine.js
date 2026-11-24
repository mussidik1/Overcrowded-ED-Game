/* Emergency Department: Code Black — simulation engine v0.2 (no DOM). All state lives in one plain-JSON object, G. */
(function (root) {
'use strict';

let G = null;
const hooks = { toast() {}, sound() {}, arrive() {} };

/* ---------- random (seeded, stored in G so a snapshot resumes exactly) ---------- */
function rnd() {
  G.rng = (G.rng + 0x6D2B79F5) | 0;
  let t = G.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randi = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const expo = mean => -Math.log(1 - rnd()) * mean;
/* v0.20: arrivals and random events draw from their own streams, so two students on the same class code get the same
   patients at the same times, whatever each one does. Everything else (outcomes, delays) uses the main stream. */
/* Class codes: six characters (shown as ABC-DEF) that carry the role, the shift, the scenario, the radio-call pack and a
   seed. Everyone who enters the same code plays the same shift: the same arrivals and events at the same times. */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', CODE_LV = ['rush', 'easy', 'med', 'hard'];
function classCode(o) {
  const lv = CODE_LV.indexOf(o.level), sc = Object.keys(SCENS).indexOf(o.scen || 'none'), pk = Object.keys(PACKS).indexOf(o.pack || 'national');
  if (lv < 0 || sc < 0 || pk < 0) return null;
  const seed = (o.seed >>> 0) % 131072;
  let n = (o.mode === 'md' ? 1 : 0) | (lv << 1) | (sc << 3) | (pk << 6) | (seed << 7);   // 24 bits
  n = n * 64 + codeSum(n);   // 30 bits with a 6-bit check: a mistyped code is refused about 63 times in 64
  let s = ''; for (let i = 0; i < 6; i++) { s = B32[n % 32] + s; n = Math.floor(n / 32); }
  return s.slice(0, 3) + '-' + s.slice(3);
}
/* v0.29.1: the game version is folded into the check characters. A code made on another version would give a different
   shift (arrivals change between versions), so it is refused instead. The UI sets the version (setCodeVersion); with none set
   (Node tests, v0.29.0 and earlier) the check is the old one. Codes from listed past versions are recognised as stale. */
let CODE_V = '', CODE_PAST = [];
function setCodeVersion(v, past) { CODE_V = String(v || ''); CODE_PAST = (past || []).map(String).filter(x => x !== CODE_V); }
function verSalt(v) { let h = 0; for (const ch of String(v || '')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193); return v ? (h | 1) : 0; }
function codeSum(n, v) { let h = n ^ 0x5bd1e995 ^ verSalt(v == null ? CODE_V : v); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) % 64; }
function readCode(str) {
  const s = String(str || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (s.length !== 6) return null;
  let n = 0; for (const ch of s) { const v = B32.indexOf(ch); if (v < 0) return null; n = n * 32 + v; }
  const sum = n % 64; n = Math.floor(n / 64);
  let stale = null;
  if (codeSum(n) !== sum) { stale = CODE_PAST.find(v => codeSum(n, v) === sum); if (stale == null) return null; }
  const lv = CODE_LV[(n >> 1) & 3], sc = Object.keys(SCENS)[(n >> 3) & 7], pk = Object.keys(PACKS)[(n >> 6) & 1];
  if (!lv || !sc || !pk) return null;
  const c = { mode: n & 1 ? 'md' : 'rn', level: lv, scen: sc, pack: pk, seed: n >>> 7, code: s.slice(0, 3) + '-' + s.slice(3) };
  if (stale != null) c.stale = stale || 'an older version';   // '' is v0.29.0 and earlier, before codes carried a version
  return c;
}
function seedOf(seed, k) { let h = (seed | 0) ^ Math.imul(k, 0x9E3779B1); h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35); return (h ^ (h >>> 16)) | 0 || k; }
function inStream(k, fn) {
  if (G[k] == null) G[k] = seedOf(G.seed, { rngA: 1, rngE: 2, rngM: 3, rngL: 4 }[k] || 5);   // made on first use, from the shift's seed
  const main = G.rng; G.rng = G[k];
  try { return fn(); } finally { G[k] = G.rng; G.rng = main; }
}
function wpick(list, wf) {
  let tot = 0;
  for (const x of list) tot += Math.max(0, wf(x));
  if (tot <= 0) return list[0];
  let r = rnd() * tot;
  for (const x of list) { r -= Math.max(0, wf(x)); if (r <= 0) return x; }
  return list[list.length - 1];
}

/* ---------- static data ---------- */
const SHIFT_START = 7 * 60;   // 07:00
const PREROLL = 120;          // the night shift's last two hours, simulated
// arrivals by hour of day (0..23); 1.0 = the level's base rate
const HOUR_MUL = [0.45, 0.4, 0.35, 0.35, 0.35, 0.4, 0.45, 0.55, 0.7, 0.85, 0.95, 1.05, 1.1, 1.15, 1.15, 1.15, 1.1, 1.1, 1.05, 1.0, 0.95, 0.85, 0.7, 0.55];

const LEVELS = {
  easy: { name: 'Quiet Tuesday', blurb: 'Fewer ambulances, no call-outs. Learn the board.', walk: 3.6, ems: 1.8, alerts: 0.6, consult: [42, 64], events: [52, 76], callouts: 0, board: 0.85, sickMax: 1, boarders: 2, shift: 720 },
  med:  { name: 'Manic Monday', blurb: 'A normal busy day. Somebody always calls out.', walk: 4.8, ems: 2.4, alerts: 0.85, consult: [32, 50], events: [40, 60], callouts: 1, board: 1, sickMax: 2, boarders: 3, shift: 720 },
  hard: { name: 'Full Moon Friday', blurb: 'Everything, all at once. Good luck.', walk: 6.2, ems: 3.1, alerts: 1.15, consult: [26, 40], events: [32, 50], callouts: 2, board: 1.15, sickMax: 3, boarders: 4, shift: 720 },
  // A short shift for demos and class: two packed hours, about five minutes at normal speed.
  rush: { name: 'Five-Minute Rush', blurb: 'Two packed hours, 07:00 to 09:00. About five minutes.', walk: 8.5, ems: 4.4, alerts: 1.7, consult: [14, 22], events: [16, 26], callouts: 1, board: 1.1, sickMax: 1, boarders: 5, shift: 120 },
  // Orientation: no random arrivals, events, or bad luck. The UI's preceptor brings in one scripted patient at a time.
  train: { name: 'Orientation', blurb: 'A preceptor walks you through it.', walk: 0, ems: 0, alerts: 0, consult: [30, 40], events: [1e9, 1e9], callouts: 0, board: 0.2, sickMax: 0, boarders: 0, shift: 720, train: true },
};

/* Preset scenarios for teaching: one named problem, at a set point in the shift. */
const SCENS = {
  none: { name: 'No scenario', blurb: 'A regular shift.' },
  ct: { name: 'CT down', blurb: 'The CT scanner fails early in the shift.' },
  mci: { name: 'Bus crash', blurb: 'A multiple-casualty call comes in early in the shift.' },
  board: { name: 'Boarding', blurb: 'You start with extra admitted patients, and beds upstairs are slow.' },
  short: { name: 'Short-staffed', blurb: 'Two more people call out at the start.' },
};

const ZONES = [
  { id: 'resus', name: 'Resus' }, { id: 'a', name: 'Pod A' }, { id: 'b', name: 'Pod B' }, { id: 'c', name: 'Pod C' },
  { id: 'd', name: 'Pod D' }, { id: 'e', name: 'Pod E' }, { id: 'hall', name: 'Hallway' }, { id: 'ft', name: 'Fast Track' },
  { id: 'rp', name: 'Chairs' },
];
const ZONE_NAME = { resus: 'Resus', a: 'Pod A', b: 'Pod B', c: 'Pod C', d: 'Pod D', e: 'Pod E', hall: 'Hallway', ft: 'Fast Track', rp: 'Chairs', triage: 'Triage', hold: 'Admitted holds' };
const ZONE_NB = { resus: ['a', 'b'], a: ['b', 'c'], b: ['a', 'c'], c: ['b', 'd'], d: ['c', 'e'], e: ['d', 'c'], hall: ['e', 'd'], ft: ['e', 'a'], rp: ['hall', 'ft'], triage: ['ft', 'a'] };
const ROOMS = [
  { id: 'R1', z: 'resus', kind: 'resus' }, { id: 'R2', z: 'resus', kind: 'resus' }, { id: 'R3', z: 'resus', kind: 'resus' }, { id: 'R4', z: 'resus', kind: 'resus' },
  { id: '1', z: 'a', kind: 'main' }, { id: '2', z: 'a', kind: 'main' }, { id: '3', z: 'a', kind: 'main' }, { id: '4', z: 'a', kind: 'main' },
  { id: '5', z: 'b', kind: 'main' }, { id: '6', z: 'b', kind: 'main' }, { id: '7', z: 'b', kind: 'main' }, { id: '8', z: 'b', kind: 'main', iso: true },
  { id: '9', z: 'c', kind: 'main' }, { id: '10', z: 'c', kind: 'main' }, { id: '11', z: 'c', kind: 'main' }, { id: '12', z: 'c', kind: 'main' },
  { id: '13', z: 'd', kind: 'main' }, { id: '14', z: 'd', kind: 'main' }, { id: '15', z: 'd', kind: 'main' }, { id: '16', z: 'd', kind: 'main', iso: true },
  { id: '17', z: 'e', kind: 'main' }, { id: '18', z: 'e', kind: 'main' }, { id: '19', z: 'e', kind: 'main', safe: true }, { id: '20', z: 'e', kind: 'main', safe: true },
  { id: 'H1', z: 'hall', kind: 'hall' }, { id: 'H2', z: 'hall', kind: 'hall' }, { id: 'H3', z: 'hall', kind: 'hall' }, { id: 'H4', z: 'hall', kind: 'hall' },
  { id: 'FT1', z: 'ft', kind: 'ft' }, { id: 'FT2', z: 'ft', kind: 'ft' }, { id: 'FT3', z: 'ft', kind: 'ft' }, { id: 'FT4', z: 'ft', kind: 'ft' },
  { id: 'C1', z: 'rp', kind: 'chair' }, { id: 'C2', z: 'rp', kind: 'chair' }, { id: 'C3', z: 'rp', kind: 'chair' },
  { id: 'C4', z: 'rp', kind: 'chair' }, { id: 'C5', z: 'rp', kind: 'chair' }, { id: 'C6', z: 'rp', kind: 'chair' },
];

const TITLE = { md: 'MD', app: 'APP', rn: 'RN', pct: 'PCT', evs: 'EVS', rt: 'RT', rph: 'PharmD', reg: 'Registration', tp: 'Transport', uc: 'Unit secretary' };
const ROSTER = [
  { id: 'md1', role: 'md', name: 'Dr. Patel', short: 'Patel' },
  { id: 'md2', role: 'md', name: 'Dr. Okafor', short: 'Okafor' },
  { id: 'md3', role: 'md', name: 'Dr. Nguyen', short: 'Nguyen', start: 240 },
  { id: 'pa1', role: 'app', title: 'PA', name: 'PA Rivera', short: 'Rivera' },
  { id: 'np1', role: 'app', title: 'NP', name: 'NP Chen', short: 'Chen' },
  { id: 'pa2', role: 'app', title: 'PA', name: 'PA Brooks', short: 'Brooks', start: 240 },
  { id: 'rnT', role: 'rn', name: 'Bea', zones: ['triage'] },
  { id: 'rnR1', role: 'rn', name: 'Jordan', zones: ['resus'], skill: 'exp' },
  { id: 'rnR2', role: 'rn', name: 'Alex', zones: ['resus'], skill: 'exp' },
  { id: 'rnA', role: 'rn', name: 'Kim', zones: ['a'] },
  { id: 'rnB', role: 'rn', name: 'Diaz', zones: ['b'] },
  { id: 'rnC', role: 'rn', name: 'Okoro', zones: ['c'] },
  { id: 'rnD', role: 'rn', name: 'Reyes', zones: ['d'], skill: 'new' },
  { id: 'rnE', role: 'rn', name: 'Walsh', zones: ['e'] },
  { id: 'rnF', role: 'rn', name: 'Sam', zones: ['hall', 'rp'], float: true },
  { id: 'rnX', role: 'rn', name: 'Casey', zones: [], float: true, tag: 'resource' },
  { id: 'rnFT', role: 'rn', name: 'Lee', zones: ['ft'], start: 120, tag: 'Fast Track 09:00' },
  { id: 'pct1', role: 'pct', name: 'Mo' }, { id: 'pct2', role: 'pct', name: 'Ava' },
  { id: 'pct3', role: 'pct', name: 'Jules' }, { id: 'pct4', role: 'pct', name: 'Dev' },
  { id: 'evs1', role: 'evs', name: 'Luis' }, { id: 'evs2', role: 'evs', name: 'Grace' }, { id: 'evs3', role: 'evs', name: 'Tomas' },
  { id: 'rt1', role: 'rt', name: 'Hana' }, { id: 'rt2', role: 'rt', name: 'Marcus' },
  { id: 'rph1', role: 'rph', name: 'Wells', short: 'Wells' },
  { id: 'reg1', role: 'reg', name: 'Tasha' }, { id: 'reg2', role: 'reg', name: 'Miguel' }, { id: 'uc1', role: 'uc', name: 'Lena' },
  { id: 'tp1', role: 'tp', name: 'Ray' }, { id: 'tp2', role: 'tp', name: 'Lou' },
];

const CONS_VISIT = 12;   // v0.25: game minutes a consultant spends at the bedside on the map
const SPECS = {
  hosp:   { name: 'Hospitalist', what: 'Admits most medical patients', short: 'Hosp', doc: 'Dr. Fenn', mad: x => `I'm not admitting anyone without ${x}. Call me back.` },
  cards:  { name: 'Cardiology', what: 'The heart', short: 'Cards', doc: 'Dr. Hartwell', mad: x => `You paged cardiology without ${x}?` },
  neuro:  { name: 'Neurology', what: 'The brain: stroke', short: 'Neuro', doc: 'Dr. Sato', mad: x => `I can't decide anything until I see ${x}.` },
  surg:   { name: 'General Surgery', what: 'The belly: appendix, gallbladder', short: 'Surg', doc: 'Dr. Blake', mad: x => `Get me ${x}, then we'll talk.` },
  trauma: { name: 'Trauma Surgery', what: 'Serious injuries and bleeding', short: 'Trauma', doc: 'Dr. Voss', mad: x => `Call me when ${x} is done.` },
  ortho:  { name: 'Orthopedics', what: 'Bones and joints', short: 'Ortho', doc: 'Dr. Bonner', mad: x => `Films first. I need ${x}.` },
  gi:     { name: 'Gastroenterology', what: 'Bleeding in the stomach or bowel', short: 'GI', doc: 'Dr. Marsh', mad: x => `What's the hemoglobin? Call back with ${x}.` },
  psych:  { name: 'Psychiatry', what: 'Mental health emergencies', short: 'Psych', doc: 'Dr. Lund', mad: x => `Is the patient medically cleared? I need ${x}.` },
  icu:    { name: 'Critical Care', what: 'The ICU: the sickest patients', short: 'ICU', doc: 'Dr. Ibarra', mad: x => `Call me back with ${x}.` },
};

const WORK = {
  ecg: { label: 'ECG', by: 'pct', dur: 3 },
  poc: { label: 'POC', by: 'pct', dur: 2 },   // v0.27: bedside tests: a fingerstick, a urine dip. Results in a minute, even when the lab is down
  lab: { label: 'LAB', by: 'pct', dur: 4 },
  xr:  { label: 'XR', by: 'img', scan: 6, read: 8 },
  ct:  { label: 'CT', by: 'img', scan: 7, read: 10 },
  us:  { label: 'US', by: 'img', scan: 12, read: 6 },
  mri: { label: 'MRI', by: 'img', scan: 40, read: 25 },
};
const MISS_NAME = { poc: 'a bedside test', ecg: 'an ECG', lab: 'labs', xr: 'the X-ray', ct: 'the CT', us: 'the ultrasound', mri: 'the MRI' };

/* ---------- v0.19: the attending orders single tests and named studies ----------
   The engine still runs work by kind (lab, xr, ct, us, mri: one draw or one trip to the scanner covers everything of that
   kind ordered together). The attending picks the tests inside each kind, and each case scores the ones it needs.
   g: the group on the order sheet. p: a plain line. Imaging m: the kind of work it is. */
const LABS = {
  gluc: { n: 'Fingerstick glucose', g: 'Bedside (point of care)', p: 'Blood sugar in a minute, at the bedside', poc: true },
  udip: { n: 'Urine dip', g: 'Bedside (point of care)', p: 'Infection or blood in the urine, in a minute', poc: true },
  cbc: { n: 'CBC', g: 'Blood counts and chemistry', p: 'White count, hemoglobin, platelets' },
  bmp: { n: 'BMP', g: 'Blood counts and chemistry', p: 'Sodium, potassium, kidneys, sugar' },
  lft: { n: 'Liver tests', g: 'Blood counts and chemistry', p: 'Liver enzymes and bilirubin' },
  lip: { n: 'Lipase', g: 'Blood counts and chemistry', p: 'The pancreas' },
  trop: { n: 'Troponin', g: 'Heart and clots', p: 'Heart muscle damage' },
  bnp: { n: 'BNP', g: 'Heart and clots', p: 'A strained, failing heart' },
  ddim: { n: 'D-dimer', g: 'Heart and clots', p: 'Rules out a clot when it’s low' },
  lact: { n: 'Lactate', g: 'Infection and breathing', p: 'Tissues short of oxygen: shock' },
  bcx: { n: 'Blood cultures', g: 'Infection and breathing', p: 'Bacteria in the blood, before antibiotics' },
  vbg: { n: 'Blood gas (VBG)', g: 'Infection and breathing', p: 'Acid and CO2; carbon monoxide level' },
  resp: { n: 'Viral swab', g: 'Infection and breathing', p: 'Flu, COVID, RSV' },
  strep: { n: 'Rapid strep', g: 'Infection and breathing', p: 'Strep throat' },
  coag: { n: 'Coags (PT/INR)', g: 'Bleeding', p: 'How fast blood clots; blood thinners' },
  ts: { n: 'Type and screen', g: 'Bleeding', p: 'Blood type, so blood can be given' },
  ua: { n: 'Urinalysis', g: 'Urine and other', p: 'Infection, blood in the urine' },
  hcg: { n: 'Pregnancy test', g: 'Urine and other', p: 'Before a CT or some drugs' },
  tox: { n: 'Tox screen and ethanol', g: 'Urine and other', p: 'Alcohol and drugs' },
  ck: { n: 'CK', g: 'Urine and other', p: 'Muscle breakdown' },
};
const IMGS = {
  cxr: { n: 'Chest X-ray', m: 'xr', p: 'Lungs, heart size, air outside the lung' },
  pelxr: { n: 'Pelvis X-ray', m: 'xr', p: 'A broken pelvis in trauma' },
  hipxr: { n: 'Hip X-ray', m: 'xr', p: 'A broken hip' },
  extxr: { n: 'Limb X-ray', m: 'xr', p: 'The injured arm or leg' },
  cthead: { n: 'CT head', m: 'ct', p: 'Bleeding in the brain' },
  cta: { n: 'CT angiogram, head and neck', m: 'ct', p: 'A blocked artery to the brain' },
  ctcs: { n: 'CT neck (C-spine)', m: 'ct', p: 'A broken neck' },
  ctpe: { n: 'CT angiogram, chest', m: 'ct', p: 'A clot in the lungs (PE)' },
  ctap: { n: 'CT abdomen and pelvis', m: 'ct', p: 'Appendix, kidney stones, the bowel' },
  mrib: { n: 'MRI brain', m: 'mri', p: 'A small stroke; takes about an hour' },
  mris: { n: 'MRI spine', m: 'mri', p: 'The spinal cord; takes about an hour' },
  fast: { n: 'FAST exam', m: 'us', p: 'Bedside: blood in the belly or around the heart' },
  ruq: { n: 'Gallbladder ultrasound', m: 'us', p: 'Gallstones, an inflamed gallbladder' },
  duplex: { n: 'Leg vein ultrasound', m: 'us', p: 'A clot in a leg vein (DVT)' },
  pelus: { n: 'Pelvic ultrasound', m: 'us', p: 'Pregnancy, ovaries' },
};
const DET_KIND = id => (LABS[id] ? (LABS[id].poc ? 'poc' : 'lab') : IMGS[id] ? IMGS[id].m : WORK[id] ? id : null);
const DET_NAME = id => (LABS[id] ? LABS[id].n : IMGS[id] ? IMGS[id].n : WK_NAME[id] || id);
const DET_EXTRA = { lab: 1, xr: 2, us: 2, ct: 6, mri: 8, ecg: 3 };   // points off for a test the patient did not need
const DET_RIGHT = { poc: 1, lab: 1, xr: 2, us: 2, ct: 2, mri: 2, ecg: 2 };
/* What each case needs (n) and what is reasonable but not needed (ok). Anything else costs DET_EXTRA. */
const NEED = {
  strep: { n: ['strep'] }, ankle: { n: ['extxr'] }, uti: { n: ['ua'], ok: ['hcg'] }, gastro: { n: ['bmp'], ok: ['cbc', 'lip', 'ua', 'hcg'] },
  appy: { n: ['cbc', 'bmp', 'ctap'], ok: ['lip', 'lft', 'ua', 'hcg'] }, chole: { n: ['cbc', 'lft', 'lip', 'ruq'], ok: ['bmp', 'hcg', 'ua'] },
  hipfx: { n: ['cbc', 'bmp', 'ts', 'hipxr'], ok: ['coag', 'ck', 'ua', 'pelxr', 'cxr'] }, pna: { n: ['cbc', 'bmp', 'cxr'], ok: ['lact', 'bcx', 'resp', 'vbg'] }, pnalow: { n: ['cbc', 'bmp', 'cxr'], ok: ['resp'] }, flu: { n: ['resp'], ok: ['cbc', 'bmp'] },
  copd: { n: ['vbg', 'cxr'], ok: ['cbc', 'bmp', 'bnp', 'resp', 'trop'] }, chf: { n: ['bnp', 'bmp', 'cxr'], ok: ['trop', 'cbc'] },
  stone: { n: ['ua', 'bmp', 'ctap'], ok: ['cbc', 'hcg'] }, dvt: { n: ['bmp', 'duplex'], ok: ['cbc', 'coag'] }, tb: { n: ['cbc', 'cxr'], ok: ['bmp', 'resp'] },
  bh: { n: ['tox'], ok: ['cbc', 'bmp', 'hcg', 'ua', 'ck'] }, etoh: { n: ['tox', 'bmp'], ok: ['cbc'] }, od: { n: ['tox'], ok: ['bmp', 'cbc', 'vbg', 'ck'] },
  cell: { n: ['cbc'], ok: ['bmp', 'lact', 'bcx'] }, syncope: { n: ['cbc', 'bmp'], ok: ['trop', 'hcg'] }, synchigh: { n: ['cbc', 'bmp', 'trop'], ok: ['bnp', 'hcg'] },
  tia: { n: ['cbc', 'bmp', 'cthead'], ok: ['coag', 'trop', 'cta', 'mrib'] }, dehyd: { n: ['bmp'], ok: ['cbc', 'ua'] },
  cpmod: { n: ['trop', 'cbc', 'bmp', 'cxr'], ok: ['bnp', 'coag', 'lip'] }, cwp: { n: ['trop', 'cxr'], ok: ['cbc', 'bmp', 'ddim'] },
  nstemi: { n: ['trop', 'cbc', 'bmp'], ok: ['coag', 'bnp', 'cxr'] }, afib: { n: ['bmp', 'trop'], ok: ['cbc', 'bnp', 'coag', 'cxr'] },
  chb: { n: ['bmp', 'trop'], ok: ['cbc', 'cxr'] }, gib: { n: ['cbc', 'ts', 'coag'], ok: ['bmp', 'lft', 'lact'] },
  dka: { n: ['bmp', 'vbg'], ok: ['cbc', 'ua', 'lact', 'hcg', 'bcx'] }, sepsisw: { n: ['lact', 'bcx', 'ua', 'cbc'], ok: ['bmp', 'lft', 'cxr'] },
  strokew: { n: ['bmp', 'cthead'], ok: ['cbc', 'coag', 'trop', 'cta'] }, stroke: { n: ['bmp', 'cthead'], ok: ['cbc', 'coag', 'trop', 'cta'] },
  lvo: { n: ['bmp', 'cthead', 'cta'], ok: ['cbc', 'coag'] }, stemi: { n: ['trop'], ok: ['cbc', 'bmp', 'coag', 'ts'] },
  mvc: { n: ['cbc', 'ts', 'cxr', 'fast'], ok: ['pelxr', 'coag', 'lact'] }, tfall: { n: ['coag', 'cbc', 'cthead'], ok: ['bmp', 'ts', 'ctcs'] },
  moto: { n: ['cbc', 'ts', 'extxr'], ok: ['bmp', 'coag', 'pelxr', 'cxr', 'lact'] }, shock: { n: ['lact', 'bcx', 'cbc', 'bmp'], ok: ['ua', 'lft', 'vbg', 'coag', 'cxr'] },
  rsv: { n: ['vbg'], ok: ['resp', 'cxr'] }, burn: { n: ['vbg'], ok: ['cbc', 'bmp', 'ck', 'lact', 'cxr'] },
  mcired: { n: ['cbc', 'ts', 'cxr', 'fast'], ok: ['pelxr', 'coag'] }, mciyel: { n: ['cbc', 'extxr'], ok: ['ts', 'bmp', 'coag', 'pelxr'] },
  mcimin: { n: ['ctcs'] }, mciwr: { n: ['extxr'] },
};
/* Results. Defaults are normal; each case names what is not. img: a picture in img/ (see img/CREDITS.md). */
const LAB_NORMAL = { gluc: 'Glucose 104', udip: 'Negative: no blood, no infection', cbc: 'WBC 8.1, Hgb 13.8, platelets 241', bmp: 'Na 139, K 4.1, creatinine 0.9, glucose 104', lft: 'Liver tests normal', lip: 'Lipase 32 (normal)', trop: 'Troponin below the cutoff', bnp: 'BNP 60 (normal)', ddim: 'D-dimer negative', lact: 'Lactate 1.1 (normal)', bcx: 'Sent. Results in 1 to 2 days', vbg: 'pH 7.39, pCO2 42', resp: 'Flu, COVID, RSV negative', strep: 'Rapid strep negative', coag: 'INR 1.0', ts: 'O positive, antibody screen negative', ua: 'No blood, no infection', hcg: 'Not pregnant', tox: 'Ethanol none, drug screen negative', ck: 'CK 140 (normal)' };
const IMG_NORMAL = { cxr: ['Clear lungs', 'cxr_normal'], pelxr: ['No fracture', 'pelvis_normal'], hipxr: ['No fracture', 'hip_normal'], extxr: ['No fracture', 'ankle_normal'], cthead: ['No bleed, no acute findings', 'cthead_normal'], cta: ['Arteries open', 'cta_normal'], ctcs: ['No fracture', 'ctcs_normal'], ctpe: ['No clot in the lungs', 'ctpe_normal'], ctap: ['No acute findings', 'ctap_normal'], mrib: ['No stroke, no acute findings', 'mrib_normal'], mris: ['No acute findings', 'mris_normal'], fast: ['No free fluid', 'fast_negative'], ruq: ['Normal gallbladder', 'ruq_normal'], duplex: ['No clot', 'duplex_normal'], pelus: ['Normal ovaries and uterus', 'pelus_normal'] };
const RES = {
  strep: { strep: 'Rapid strep positive' }, ankle: { extxr: ['No fracture', 'ankle_normal'] }, uti: { ua: 'Nitrite positive, white cells, bacteria' }, gastro: { bmp: 'Na 136, K 3.6, BUN 24, creatinine 1.0: mildly dry' },
  appy: { cbc: 'WBC 15.8, Hgb 13.9, platelets 280', ctap: ['Appendix 11 mm across, fat stranding around it', 'ct_appy'] }, chole: { cbc: 'WBC 13.1, Hgb 14.0, platelets 260', lft: 'ALT 88, alk phos 210, bilirubin 1.6', ruq: ['Gallstones, thick gallbladder wall', 'us_gallstones'] },
  hipfx: { cbc: 'WBC 9.0, Hgb 11.9, platelets 220', hipxr: ['Femoral neck fracture', 'xr_hipfx'] }, pna: { cbc: 'WBC 17.2, Hgb 13.1, platelets 310', bmp: 'Na 134, K 4.0, creatinine 1.1, glucose 140', cxr: ['Right lower lobe consolidation with air bronchograms', 'cxr_pna'] }, flu: { resp: 'Influenza A positive' }, pnalow: { cbc: 'WBC 13.1, Hgb 14.0, platelets 260', bmp: 'Na 139, K 4.1, BUN 14, creatinine 0.9', cxr: ['Small right lower lobe pneumonia', 'cxr_pna'] },
  copd: { vbg: 'pH 7.31, pCO2 58', cxr: ['Hyperinflated, no pneumonia', 'cxr_copd'] }, chf: { bnp: 'BNP 2,400', bmp: 'Na 133, K 4.6, creatinine 1.5', cxr: ['Pulmonary edema', 'cxr_edema'] },
  stone: { ua: 'Blood in the urine, no infection', ctap: ['4 mm stone in the ureter', 'ct_stone'] }, dvt: { duplex: ['Clot in the femoral vein', 'us_dvt'] }, tb: { cbc: 'WBC 11.4, Hgb 11.8, platelets 300', cxr: ['Cavity in the upper lobe', 'cxr_tb'] },
  etoh: { tox: 'Ethanol 280, drug screen negative', bmp: 'Glucose 96, Na 140, K 3.9' }, od: { tox: 'Fentanyl positive' }, cell: { cbc: 'WBC 14.0, Hgb 13.5, platelets 250' },
  dehyd: { bmp: 'BUN 34, creatinine 1.4, Na 146' }, cpmod: { trop: 'First troponin below the cutoff; repeat in 3 hours' }, nstemi: { trop: 'Troponin elevated: 0.84' },
  afib: { bmp: 'K 3.9, Mg 1.9, creatinine 1.0' }, chb: { bmp: 'K 4.4, creatinine 1.2' }, gib: { cbc: 'WBC 10.2, Hgb 6.8, platelets 190', coag: 'INR 1.3' },
  dka: { bmp: 'Glucose 540, Na 131, K 4.8, bicarb 8, anion gap 26', vbg: 'pH 7.08, pCO2 22' }, sepsisw: { lact: 'Lactate 3.1', ua: 'Nitrite positive, many white cells', cbc: 'WBC 19.6, Hgb 12.4, platelets 160' },
  strokew: { bmp: 'Glucose 118' }, stroke: { bmp: 'Glucose 132' }, lvo: { bmp: 'Glucose 141', cta: ['Left M1 occlusion', 'cta_m1'] }, stemi: { trop: 'Pending (don’t wait for it)' },
  mvc: { cbc: 'WBC 13.0, Hgb 8.1, platelets 180', fast: ['Blood in the belly (positive FAST)', 'fast_positive'], cxr: ['No pneumothorax', 'cxr_normal'], ctap: ['Grade IV splenic laceration', null] },
  tfall: { coag: 'INR 2.9', cthead: ['A crescent of fresh blood over the left brain, 8 mm, slight shift', 'ct_sdh'] }, moto: { cbc: 'Hgb 9.4', extxr: ['Open femur fracture', 'xr_femur'] },
  shock: { lact: 'Lactate 5.4', cbc: 'WBC 22.1, Hgb 11.9, platelets 98', bmp: 'Creatinine 2.1, bicarb 15' }, rsv: { vbg: 'pH 7.27, pCO2 61', resp: 'RSV positive' }, burn: { vbg: 'Carboxyhemoglobin 6%' },
  mcired: { cbc: 'Hgb 7.9', fast: ['Blood in the belly (positive FAST)', 'fast_positive'], cxr: ['No pneumothorax', 'cxr_normal'] }, mciyel: { cbc: 'Hgb 11.2', extxr: ['Midshaft femur fracture', 'xr_femur'] },
  mcimin: { ctcs: ['No fracture', 'ctcs_normal'] }, mciwr: { extxr: ['Distal radius fracture', 'xr_wrist'] },
};
/* Each named test has a result: [text, picture or null]. */
const POC_RES = { gluc: { dka: 'Glucose HI (over 500)', strokew: 'Glucose 141', stroke: 'Glucose 148', lvo: 'Glucose 141', od: 'Glucose 96', etoh: 'Glucose 72', syncope: 'Glucose 98', synchigh: 'Glucose 110', tia: 'Glucose 122' },
  udip: { uti: 'Leukocytes and nitrites positive', stone: 'Blood 3+, no infection', appy: 'Trace white cells', dehyd: 'Ketones 2+, concentrated' } };
for (const [ks, t] of [[['stroke', 'strokew', 'lvo', 'dka', 'syncope', 'synchigh', 'od', 'etoh', 'tia', 'tfall'], 'gluc'], [['uti', 'stone', 'appy', 'dehyd', 'pnalow'], 'udip']]) for (const k of ks) if (NEED[k]) NEED[k].ok = (NEED[k].ok || []).concat(t);
function detResult(p, id) {
  if (POC_RES[id] && POC_RES[id][p.ck]) return [POC_RES[id][p.ck], null];
  const r = (RES[p.ck] || {})[id];
  if (r) return Array.isArray(r) ? r : [r, null];
  if (id === 'hcg' && p.sex === 'M') return ['Not done: male patient', null];
  if (LABS[id]) return [LAB_NORMAL[id], null];
  return IMG_NORMAL[id] ? IMG_NORMAL[id].slice() : ['No acute findings', null];
}
/* What the case needs, in named tests: the attending's game. */
/* v0.29.1: a woman who could be pregnant gets a pregnancy test before a CT, some drugs, or a decision that pregnancy changes:
   required in these cases for women 12 to 55, not just allowed. */
const HCG_CASES = new Set(['appy', 'chole', 'gastro', 'stone', 'pe', 'mpe', 'sbo', 'syncope', 'uti', 'od', 'apapod', 'salod', 'tcaod', 'dka', 'mesisch', 'dissect']);
const hcgDue = p => !!(p && p.sex === 'F' && p.age >= 12 && p.age <= 55 && HCG_CASES.has(p.ck));
function needOf(p) {
  const N = NEED[p.ck], c = CASES.find(x => x.k === p.ck) || {};
  if (N) { const n = N.n.slice(), ok = (N.ok || []).filter(k => !(k === 'hcg' && hcgDue(p))); if (hcgDue(p) && !n.includes('hcg')) n.push('hcg'); return { n, ok }; }
  // a case with no table (a return visit, an IFT): its kinds, as their usual tests
  const n = []; for (const k of (c.wk || p.wk || [])) if (k !== 'ecg') n.push(...(DEFAULT_DET[k] || []));
  return { n, ok: [] };
}
const DEFAULT_DET = { lab: ['cbc', 'bmp'], xr: ['cxr'], ct: ['cthead'], us: ['fast'], mri: ['mrib'] };
/* by: who gives it. rx: pharmacist verifies first. gate: waits for something else. */
const TREAT = {
  meds:    { label: 'Meds', by: 'rn', dur: 3, rx: true },
  fluids:  { label: 'IV fluids', by: 'rn', dur: 4 },
  abx:     { label: 'Antibiotics', by: 'rn', dur: 3, rx: true },
  insulin: { label: 'Insulin drip', by: 'rn', dur: 4, rx: true },
  tnk:     { label: 'Thrombolytic', by: 'rn', dur: 4, rx: true, gate: 'tnk' },
  epi:     { label: 'Epinephrine', by: 'rn', dur: 2 },
  nalox:   { label: 'Naloxone', by: 'rn', dur: 2 },
  nebs:    { label: 'Nebulizer', by: 'rt', dur: 4 },
  bipap:   { label: 'BiPAP', by: 'rt', dur: 6 },
  hfnc:    { label: 'High-flow oxygen', by: 'rt', dur: 5 },
  vent:    { label: 'Ventilator', by: 'rt', dur: 8 },
  blood:   { label: 'Blood transfusion', by: 'rn', dur: 6, gate: 'blood' },
  mtp:     { label: 'Massive transfusion', by: 'rn', dur: 10, gate: 'mtp' },
  repair:  { label: 'Stitches', by: 'prov', dur: 8 },
  intub:   { label: 'Intubation', by: 'prov', dur: 10, md: true, rt: true },
  o2:      { label: 'Oxygen', by: 'rn', dur: 1 },
  bp:      { label: 'Blood pressure control', by: 'rn', dur: 3, rx: true },
  pressor: { label: 'Vasopressor', by: 'rn', dur: 3, rx: true },
  pace:    { label: 'Atropine and pacing', by: 'rn', dur: 4 },
  reverse: { label: 'Reversal agent', by: 'rn', dur: 4, rx: true },
  cardiovert: { label: 'Synchronized cardioversion', by: 'prov', dur: 3 },   // audit phase 1 (R6-06)
};

/* ---------- v0.28: drugs by class, a resuscitation set, and procedures ----------
   Each drug gives one of the engine's treatments (tx). A case that needs that treatment may name the drugs that count
   (RXOK); another drug that gives the same treatment is the wrong drug: the order is wasted and the gap stays open. */
const DRUG_CLASS = [
  ['analg', 'Pain'], ['emet', 'Nausea'], ['abxo', 'Antibiotics by mouth'], ['abxi', 'Antibiotics by vein'], ['abxm', 'Antibiotics by shot in the muscle (IM)'], ['allergy', 'Allergy and steroids'],
  ['cardiac', 'Heart and blood pressure'], ['clot', 'Clots, bleeding, and reversal'], ['resp', 'Breathing'], ['endo', 'Sugar and electrolytes'],
  ['tox', 'Antidotes'], ['neuro', 'Seizures, agitation, and sedation'], ['other', 'Other'],
];
const DRUGS = {
  apap: { n: 'Acetaminophen', c: 'analg', tx: ['meds'], p: 'Mild pain and fever, by mouth' },
  ibu: { n: 'Ibuprofen', c: 'analg', tx: ['meds'], p: 'Pain and swelling, by mouth' },
  ketor: { n: 'Ketorolac', c: 'analg', tx: ['meds'], p: 'Strong anti-inflammatory, by vein' },
  morph: { n: 'Morphine', c: 'analg', tx: ['meds'], p: 'Opioid, by vein' },
  fent: { n: 'Fentanyl', c: 'analg', tx: ['meds'], p: 'Fast, short opioid, by vein' },
  hydro: { n: 'Hydromorphone', c: 'analg', tx: ['meds'], p: 'Strong opioid, by vein' },
  ondan: { n: 'Ondansetron', c: 'emet', tx: ['meds'], p: 'Nausea and vomiting' },
  reglan: { n: 'Metoclopramide', c: 'emet', tx: ['meds'], p: 'Nausea; also helps migraine' },
  prochlor: { n: 'Prochlorperazine', c: 'emet', tx: ['meds'], p: 'Nausea; first choice for migraine' },
  mecliz: { n: 'Meclizine', c: 'emet', tx: ['meds'], p: 'Dizziness and motion sickness' },
  amox: { n: 'Amoxicillin', c: 'abxo', tx: ['meds', 'abx'], p: 'Ear, throat, and mild lung infections' },
  amoxclav: { n: 'Amoxicillin-clavulanate', c: 'abxo', tx: ['meds', 'abx'], p: 'Bites, dental, sinus infections' },
  penvk: { n: 'Penicillin VK', c: 'abxo', tx: ['meds'], p: 'Strep throat' },
  cephalex: { n: 'Cephalexin', c: 'abxo', tx: ['meds', 'abx'], p: 'Skin and urine infections' },
  nitrof: { n: 'Nitrofurantoin', c: 'abxo', tx: ['meds'], p: 'A simple bladder infection' },
  doxy: { n: 'Doxycycline', c: 'abxo', tx: ['meds', 'abx'], p: 'Lung infections, tick bites, MRSA skin' },
  azith: { n: 'Azithromycin', c: 'abxo', tx: ['meds', 'abx'], p: 'Atypical pneumonia' },
  osel: { n: 'Oseltamivir', c: 'abxo', tx: ['meds'], p: 'Flu antiviral, best in the first 48 hours' },
  bicillin: { n: 'Penicillin G benzathine (IM only)', c: 'abxm', tx: ['meds'], p: 'One shot in the muscle for strep. Never by vein: it can stop the heart' },   // audit R6-07: FDA boxed warning
  ctx: { n: 'Ceftriaxone', c: 'abxi', tx: ['abx'], p: 'Broad, once a day: pneumonia, urine, meningitis' },
  cefaz: { n: 'Cefazolin', c: 'abxi', tx: ['abx'], p: 'Skin infection, open fractures' },
  piptazo: { n: 'Piperacillin-tazobactam', c: 'abxi', tx: ['abx'], p: 'Very broad: sepsis, belly infections' },
  vanc: { n: 'Vancomycin', c: 'abxi', tx: ['abx'], p: 'Covers MRSA' },
  metro: { n: 'Metronidazole', c: 'abxi', tx: ['abx'], p: 'Gut bacteria that live without air' },
  diphen: { n: 'Diphenhydramine', c: 'allergy', tx: ['meds'], p: 'Antihistamine: itch, hives' },
  famot: { n: 'Famotidine', c: 'allergy', tx: ['meds'], p: 'Second antihistamine (H2); also stomach acid' },
  methylpred: { n: 'Methylprednisolone', c: 'allergy', tx: ['meds'], p: 'Steroid by vein' },
  pred: { n: 'Prednisone', c: 'allergy', tx: ['meds'], p: 'Steroid by mouth' },
  dexa: { n: 'Dexamethasone', c: 'allergy', tx: ['meds'], p: 'Long-acting steroid: asthma, croup' },
  tricream: { n: 'Triamcinolone cream', c: 'allergy', tx: ['meds'], p: 'Steroid cream for a rash' },
  epiim: { n: 'Epinephrine 0.5 mg IM', c: 'allergy', tx: ['epi'], p: 'Anaphylaxis: in the thigh, now' },
  asa: { n: 'Aspirin', c: 'cardiac', tx: ['meds'], p: 'Chewed, for a heart attack or TIA' },
  ntg: { n: 'Nitroglycerin', c: 'cardiac', tx: ['meds'], p: 'Chest pain; heart failure with high pressure' },
  furo: { n: 'Furosemide', c: 'cardiac', tx: ['meds'], p: 'Diuretic: pulls off fluid' },
  metop: { n: 'Metoprolol', c: 'cardiac', tx: ['meds'], p: 'Beta blocker: slows the heart' },
  dilt: { n: 'Diltiazem', c: 'cardiac', tx: ['meds'], p: 'Slows a fast atrial fibrillation' },
  labet: { n: 'Labetalol', c: 'cardiac', tx: ['bp'], p: 'Lowers blood pressure, by vein' },
  nicard: { n: 'Nicardipine drip', c: 'cardiac', tx: ['bp'], p: 'Lowers blood pressure, steady drip' },
  heparin: { n: 'Heparin', c: 'clot', tx: ['meds'], p: 'Blood thinner drip' },
  enox: { n: 'Enoxaparin', c: 'clot', tx: ['meds'], p: 'Blood thinner shot' },
  apixa: { n: 'Apixaban', c: 'clot', tx: ['meds'], p: 'Blood thinner pill' },
  tnk: { n: 'Tenecteplase', c: 'clot', tx: ['tnk'], p: 'Clot buster: a stroke, or a PE that drops the pressure' },
  pcc: { n: '4-factor PCC', c: 'clot', tx: ['reverse'], p: 'Reverses warfarin and factor Xa blood thinners' },
  vitk: { n: 'Vitamin K', c: 'clot', tx: ['reverse'], p: 'Slow warfarin reversal, given with PCC' },
  txa: { n: 'Tranexamic acid', c: 'clot', tx: ['meds'], p: 'Helps blood clot in trauma bleeding' },
  albut: { n: 'Albuterol neb', c: 'resp', tx: ['nebs'], p: 'Opens tight airways' },
  duoneb: { n: 'Ipratropium-albuterol neb', c: 'resp', tx: ['nebs'], p: 'Two bronchodilators: COPD, bad asthma' },
  mag: { n: 'Magnesium sulfate', c: 'resp', tx: ['meds'], p: 'Severe asthma; torsades' },
  insdrip: { n: 'Insulin drip', c: 'endo', tx: ['insulin'], p: 'For DKA, after potassium is checked' },
  d50: { n: 'Dextrose', c: 'endo', tx: ['meds'], p: 'Low blood sugar' },
  kcl: { n: 'Potassium', c: 'endo', tx: ['meds'], p: 'Low potassium' },
  nalox: { n: 'Naloxone', c: 'tox', tx: ['nalox'], p: 'Reverses opioids' },
  nac: { n: 'N-acetylcysteine', c: 'tox', tx: ['meds'], p: 'Acetaminophen overdose' },
  charcoal: { n: 'Activated charcoal', c: 'tox', tx: ['meds'], p: 'Binds some pills in the gut, early only' },
  loraz: { n: 'Lorazepam', c: 'neuro', tx: ['meds'], p: 'Seizures, alcohol withdrawal, anxiety' },
  halo: { n: 'Haloperidol', c: 'neuro', tx: ['meds'], p: 'Agitation, psychosis' },
  olanz: { n: 'Olanzapine', c: 'neuro', tx: ['meds'], p: 'Agitation, psychosis' },
  ketamine: { n: 'Ketamine', c: 'neuro', tx: ['meds'], p: 'Sedation and strong pain control' },
  glucagon: { n: 'Glucagon', c: 'endo', tx: ['meds'], p: 'Low sugar with no IV; beta blocker overdose' },
  thiamine: { n: 'Thiamine', c: 'endo', tx: ['meds'], p: 'Before sugar in heavy drinkers' },
  panto: { n: 'Pantoprazole', c: 'other', tx: ['meds'], p: 'Acid blocker by vein: ulcer bleeding' },
  octreo: { n: 'Octreotide', c: 'other', tx: ['meds'], p: 'Variceal bleeding' },
  acyclo: { n: 'Acyclovir', c: 'abxi', tx: ['abx'], p: 'Herpes encephalitis, shingles' },
  cefepime: { n: 'Cefepime', c: 'abxi', tx: ['abx'], p: 'Broad, covers Pseudomonas' },
  tmpsmx: { n: 'Trimethoprim-sulfamethoxazole', c: 'abxo', tx: ['meds', 'abx'], p: 'MRSA skin, some urine infections' },
  lido: { n: 'Lidocaine', c: 'analg', tx: ['meds'], p: 'Numbs the skin; a nerve block' },
  mannitol: { n: 'Mannitol', c: 'neuro', tx: ['meds'], p: 'Brain swelling about to herniate' },
  hts: { n: 'Hypertonic saline', c: 'neuro', tx: ['meds'], p: 'Brain swelling; very low sodium with seizures' },
  etomidate: { n: 'Etomidate', c: 'neuro', tx: ['intub'], p: 'Sedation to intubate (RSI)' },
  propofol: { n: 'Propofol', c: 'neuro', tx: ['intub'], p: 'Sedation to intubate; sedation on the vent' },
  succ: { n: 'Succinylcholine', c: 'neuro', tx: ['intub'], p: 'Fast paralytic for intubation; not with high potassium' },
  roc: { n: 'Rocuronium', c: 'neuro', tx: ['intub'], p: 'Paralytic for intubation' },
  procain: { n: 'Procainamide', c: 'resus', tx: ['meds'], p: 'Stable wide-complex tachycardia' },
  homemed: { n: 'Home medication dose', c: 'other', tx: ['meds'], p: 'A dose of the pill they ran out of' },
  ns: { n: 'Normal saline bolus', c: 'fluid', tx: ['fluids'], p: 'Salt water into a vein' },
  lr: { n: 'Lactated Ringer’s bolus', c: 'fluid', tx: ['fluids'], p: 'Balanced fluid into a vein' },
  // the resuscitation set: its own menu
  epiarr: { n: 'Epinephrine 1 mg IV', c: 'resus', tx: ['epi'], p: 'Cardiac arrest, every 3 to 5 minutes' },
  amio: { n: 'Amiodarone', c: 'resus', tx: ['meds'], p: 'VF and VT; some fast rhythms' },
  adeno: { n: 'Adenosine', c: 'resus', tx: ['meds'], p: 'Breaks SVT: a fast push' },
  atropine: { n: 'Atropine', c: 'resus', tx: ['pace'], p: 'A slow heart rate' },
  calc: { n: 'Calcium chloride', c: 'resus', tx: ['meds'], p: 'High potassium; calcium channel blocker overdose' },
  bicarb: { n: 'Sodium bicarbonate', c: 'resus', tx: ['meds'], p: 'Some overdoses; severe acidosis' },
  norepi: { n: 'Norepinephrine drip', c: 'resus', tx: ['pressor'], p: 'First vasopressor for shock' },
  pushepi: { n: 'Push-dose epinephrine', c: 'resus', tx: ['pressor'], p: 'A quick bridge for low pressure' },
};
// The right drug, by case and treatment. A case or treatment not listed takes any drug that gives it.
const RXOK = {
  rash: { meds: ['diphen', 'tricream', 'pred', 'methylpred'] }, refill: { meds: ['homemed'] }, otitis: { meds: ['amox', 'amoxclav'] },
  dental: { meds: ['amoxclav', 'amox', 'penvk', 'ibu', 'apap'] }, strep: { meds: ['penvk', 'amox', 'bicillin'] }, ankle: { meds: ['ibu', 'apap', 'ketor'] },
  uti: { meds: ['nitrof', 'cephalex'] }, gastro: { meds: ['ondan', 'reglan', 'prochlor'] }, flu: { meds: ['osel', 'apap', 'ibu'] },
  appy: { meds: ['morph', 'fent', 'hydro', 'apap', 'ketor', 'ondan'], abx: ['piptazo', 'ctx', 'metro'] }, chole: { meds: ['morph', 'fent', 'hydro', 'ketor', 'ondan', 'apap'], abx: ['piptazo', 'ctx', 'metro'] },
  hipfx: { meds: ['fent', 'morph', 'hydro', 'apap'] }, pnalow: { abx: ['amox', 'doxy', 'azith', 'amoxclav'] }, pna: { abx: ['ctx', 'azith'] },
  copd: { meds: ['methylpred', 'pred'], nebs: ['duoneb', 'albut'] }, chf: { meds: ['ntg', 'furo'] }, stone: { meds: ['ketor', 'ibu', 'morph', 'fent', 'hydro'] },
  dvt: { meds: ['apixa', 'enox', 'heparin'] }, migraine: { meds: ['prochlor', 'reglan', 'ketor', 'diphen'] }, cell: { abx: ['cefaz', 'vanc', 'ctx', 'cephalex'] },
  tia: { meds: ['asa'] }, cpmod: { meds: ['asa'] }, cwp: { meds: ['asa', 'apap', 'ibu', 'ketor'] }, nstemi: { meds: ['asa', 'heparin', 'enox'] }, afib: { meds: ['dilt', 'metop'] },
  asthma: { meds: ['dexa', 'pred', 'methylpred', 'mag'], nebs: ['albut', 'duoneb'] }, anaph: { meds: ['diphen', 'methylpred', 'famot'], epi: ['epiim'] },
  sepsisw: { abx: ['ctx', 'piptazo'] }, stemi: { meds: ['asa', 'heparin'] }, burn: { meds: ['fent', 'morph', 'ketamine'] },
  mciyel: { meds: ['fent', 'morph', 'hydro'] }, mcimin: { meds: ['ibu', 'apap'] }, mciwr: { meds: ['ibu', 'apap', 'ketor'] },
  moto: { meds: ['fent', 'morph', 'hydro', 'ketamine'], abx: ['cefaz', 'ctx'] }, shock: { abx: ['piptazo', 'vanc', 'ctx'], pressor: ['norepi', 'pushepi'] },
  tfall: { reverse: ['pcc', 'vitk'] }, chb: { pace: ['atropine'] }, vip: { meds: ['mecliz'] },
};
// The drug a preceptor or a bot picks for a treatment: the case's first right drug, or the usual one.
// v0.28.1: drugs that can hurt this patient. Ordering one is harm, not just an extra.
const CONTRA = { gib: ['@bleed'], tfall: ['@bleed'], mvc: ['@bleed'], mcired: ['@bleed'], moto: ['@bleed'],
  cpmod: ['ntg'], nstemi: ['ntg'], stemi: ['ntg'], cwp: ['ibu', 'ketor'], afib: ['dilt', 'metop'],
  stroke: ['heparin', 'enox', 'tnk'], strokew: ['heparin', 'enox', 'tnk'], lvo: ['heparin', 'enox', 'tnk'], anaph: ['epiarr'], asthma: ['metop'], copd: ['metop'], dka: ['d50'], chb: ['metop', 'dilt'], od: ['loraz'], shock: ['labet', 'nicard', 'metop', 'furo'], sepsisw: ['furo', 'labet'] };
// v0.29.1: CONTRA_IF[case][drug] says when a listed drug is contraindicated. Tenecteplase in PE: only when the pressure holds (SBP 90
// or more). A clot that drops the pressure is massive PE, and the clot buster is the treatment. Unknown vitals count as contraindicated.
const CONTRA_IF = { pe: { tnk: p => { const v = p.id && G ? vRaw(p, G.t).v : null; return !(v && v.sbp < 90); } } };   // the underlying pressure, not the five-minute wobble; unknown counts as contraindicated
// Audit phase 1 (R6-01): a thrombolytic for stroke only inside 4.5 hours of last known well (AHA/ASA 2019). After that it is harm.
for (const k of ['stroke', 'strokew', 'lvo']) CONTRA_IF[k] = { tnk: p => !lyticWindowOk(p) };
// Audit phase 1 (R6-08): nitroglycerin is out when the pressure is under 90. NSAIDs (ibuprofen, ketorolac) are out in chest pain until the
// troponin is back and normal (ACC/AHA: NSAIDs other than aspirin are harmful in ACS). Aspirin is the first drug for chest pain.
const sbpUnder = (p, n) => { const v = p.id && G ? vRaw(p, G.t).v : null; return !!(v && v.sbp < n); };
const tropBack = p => !!(p.work && p.work.lab && p.work.lab.st === 'done');
for (const k of ['cpmod', 'nstemi', 'stemi']) CONTRA_IF[k] = { ntg: p => sbpUnder(p, 90) };
CONTRA_IF.afib = { dilt: p => !!p.crash, metop: p => !!p.crash };   // audit R6-06: no negative inotropes once the pressure has fallen
CONTRA_IF.cwp = { ibu: p => !tropBack(p), ketor: p => !tropBack(p) };
// When a listed contraindication doesn't apply (an unstable PE), the treatment is the right call, not an extra.
const treatOkNow = (p, k) => Object.entries(CONTRA_IF[p.ck] || {}).some(([d, f]) => DRUGS[d] && DRUGS[d].tx.includes(k) && !f(p));
const contraOf = p => (CONTRA[p.ck] || []).flatMap(d => (d === '@bleed' ? BLEED_RISK : [d])).filter(d => { const f = (CONTRA_IF[p.ck] || {})[d]; return !f || !p.id || f(p); });
const DRUG_DEF = { fluids: 'ns', nebs: 'albut', epi: 'epiim', nalox: 'nalox', insulin: 'insdrip', tnk: 'tnk', bp: 'labet', pressor: 'norepi', reverse: 'pcc', abx: 'ctx', pace: 'atropine' };
// v0.29.1: some treatments need more than one drug (aspirin AND heparin). RXREQ[case][tx] lists groups: one drug from every group.
// ALSO[case]: standard add-ons that are fine to give (albuterol in hyperkalemia), never counted as extra or wrong.
const RXREQ = { stemi: { meds: [['asa'], ['heparin', 'enox']] }, nstemi: { meds: [['asa'], ['heparin', 'enox']] }, tfall: { reverse: [['pcc'], ['vitk']] } };
const ALSO = { dka: ['kcl'], arrest: ['epiarr', 'amio', 'calc', 'bicarb', 'ns', 'lr'],   // v0.29.1: potassium in DKA (K 4.8) is reasonable, not required
  // Audit phase 1 (R6-08): in suspected ACS, nitroglycerin for ongoing pain is standard care (ACC/AHA NSTE-ACS, Class I). Morphine and a
  // beta-blocker are judgment calls (morphine IIb; IV beta-blockade harms patients at risk of shock): neutral, pending clinician review.
  cpmod: ['ntg', 'morph', 'metop'], nstemi: ['ntg', 'morph', 'metop'], stemi: ['ntg', 'morph', 'metop'] };
// v0.29.1: drugs that are never wrong to give, unless this patient has a reason not to (CONTRA): nausea, and fever or pain.
const NEVER_WRONG = new Set(['ondan', 'apap']);
// v0.29.1: drugs that do the same job in the same way. When a case's right drug is in one of these groups, another drug from the
// same group "works, but isn't the first choice": it doesn't fill the order and isn't scored as wrong. The groups are narrow on
// purpose (opioids, not "pain"; benzodiazepines, not "neuro"): a drug from a different group is still wrong.
const SAME_CLASS_OK = [['morph', 'fent', 'hydro'], ['ketor', 'ibu'], ['ondan', 'reglan', 'prochlor'], ['methylpred', 'pred', 'dexa'],
  ['loraz', 'midaz'], ['levet', 'fosphen'], ['albut', 'duoneb'], ['ns', 'lr']];
function sameClassAlt(p, k, t) {
  const grp = SAME_CLASS_OK.find(g => g.includes(k)); if (!grp) return false;
  const right = ((RXOK[p.ck] || {})[t] || []).concat(...((RXREQ[p.ck] || {})[t] || []));
  return right.some(r => r !== k && grp.includes(r));
}
// Drugs that make bleeding worse, as one class for the harm lists.
const BLEED_RISK = ['heparin', 'enox', 'apixa', 'tnk', 'asa', 'ketor', 'ibu'];
// v0.29.1: REQ_AGE adds a required drug by age: ampicillin (Listeria) in meningitis over 50.
const REQ_AGE = { mening: { abx: { over: 50, add: ['ampi'] } } };
const reqOf = (p, tx) => { const g = (RXREQ[p.ck] || {})[tx], a = ((REQ_AGE[p.ck] || {})[tx]); return g && a && p.age > a.over ? g.concat([a.add]) : g; };
const reqLeft = (p, tx) => { const g = reqOf(p, tx); if (!g) return null; const got = ((p.rxg || {})[tx]) || []; return g.filter((x, i) => !got.includes(i)); };
const drugsFor = (p, tx) => { const left = reqLeft(p, tx); return left ? left.map(g => g[0]) : [drugFor(p, tx)].filter(Boolean); };
const drugFor = (p, tx) => { const g = reqOf(p, tx); return g ? g[0][0] : ((RXOK[p.ck] || {})[tx] || [])[0] || DRUG_DEF[tx] || null; };
const rxOk = (p, tx, id) => { const g = reqOf(p, tx); if (g && g.some(x => x.includes(id))) return true; const L = (RXOK[p.ck] || {})[tx]; return L ? L.includes(id) : !g && DRUGS[id].tx.includes(tx); };
// Not drugs: the order sheet's other menus. Each is an engine treatment.
const ORDER_MENUS = [
  ['air', 'Airway and breathing', ['o2', 'hfnc', 'bipap', 'intub']],
  ['fluid', 'Fluids and blood', ['ns', 'lr', 'blood', 'mtp']],
  ['proc', 'Procedures', ['repair', 'tcp', 'synccv']],
];
const PROC = { tcp: { n: 'Transcutaneous pacing', tx: 'pace', p: 'Pads that pace a slow heart' },
  synccv: { n: 'Synchronized cardioversion', tx: 'cardiovert', p: 'A timed shock for a fast rhythm with a crashing pressure' } };   // audit phase 1 (R6-06): ACLS tachycardia algorithm

/* ---------- v0.28: the diagnosis is the attending's call, clinical accuracy, and litigation risk ----------
   When the results are back, the attending names the diagnosis from four choices: the right one and three it could have been.
   A wrong call still shows the real diagnosis (the shift goes on), but it costs accuracy and adds litigation risk. */
const DDX = {
  rash: ['Cellulitis', 'Shingles', 'Scabies'], refill: ['Hypertensive emergency', 'Medication side effect', 'Anxiety'], otitis: ['Mastoiditis', 'Swimmer’s ear', 'Strep throat'],
  dental: ['Ludwig’s angina', 'Peritonsillar abscess', 'Trigeminal neuralgia'], strep: ['Viral pharyngitis', 'Peritonsillar abscess', 'Mononucleosis'], ankle: ['Ankle fracture', 'Achilles tendon rupture', 'Gout'],
  lac: ['Tendon laceration', 'Retained foreign body', 'Abscess'], uti: ['Pyelonephritis', 'Kidney stone', 'Vaginitis'], gastro: ['Appendicitis', 'Bowel obstruction', 'Pancreatitis'],
  appy: ['Ovarian torsion', 'Kidney stone', 'Gastroenteritis'], chole: ['Biliary colic', 'Pancreatitis', 'Inferior MI'], hipfx: ['Hip contusion', 'Pelvic fracture', 'Hip dislocation'],
  flu: ['COVID-19', 'Pneumonia', 'Strep throat'], pnalow: ['Bronchitis', 'Pulmonary embolism', 'Heart failure flare'], pna: ['Pulmonary embolism', 'Heart failure flare', 'Lung cancer'],
  copd: ['Pneumonia', 'Pneumothorax', 'Heart failure flare'], chf: ['COPD flare', 'Pneumonia', 'Pulmonary embolism'], stone: ['Pyelonephritis', 'Abdominal aortic aneurysm', 'Appendicitis'],
  dvt: ['Cellulitis', 'Baker’s cyst rupture', 'Muscle strain'], migraine: ['Subarachnoid hemorrhage', 'Meningitis', 'Tension headache'], tb: ['Lung cancer', 'Pneumonia', 'Sarcoidosis'],
  bh: ['Delirium', 'Intoxication', 'Hypoglycemia'], etoh: ['Head injury', 'Hypoglycemia', 'Opioid overdose'], od: ['Hypoglycemia', 'Stroke', 'Alcohol intoxication'],
  cell: ['Abscess', 'Deep vein thrombosis', 'Necrotizing fasciitis'], syncope: ['Arrhythmia', 'Pulmonary embolism', 'Seizure'], synchigh: ['Vasovagal syncope', 'Seizure', 'Dehydration'],
  tia: ['Stroke', 'Hypoglycemia', 'Complicated migraine'], dehyd: ['DKA', 'Sepsis', 'Kidney failure'], cpmod: ['Pulmonary embolism', 'Aortic dissection', 'GERD'],
  cwp: ['Acute coronary syndrome', 'Pulmonary embolism', 'Pneumothorax'], nstemi: ['Unstable angina', 'Pulmonary embolism', 'Aortic dissection'], afib: ['SVT', 'Atrial flutter', 'Sinus tachycardia'],
  chb: ['Sinus bradycardia', 'Hyperkalemia', 'Beta blocker overdose'], gib: ['Lower GI bleed', 'Esophagitis', 'Gastritis'], dka: ['Hyperosmolar hyperglycemic state', 'Alcoholic ketoacidosis', 'Sepsis'],
  asthma: ['COPD flare', 'Anaphylaxis', 'Pneumonia'], anaph: ['Angioedema from an ACE inhibitor', 'Asthma attack', 'Panic attack'], sepsisw: ['Pyelonephritis', 'Kidney stone', 'Dehydration'],
  strokew: ['Hypoglycemia', 'Bell’s palsy', 'Todd’s paralysis after a seizure'], stroke: ['Hypoglycemia', 'Complicated migraine', 'Intracerebral hemorrhage'], lvo: ['Intracerebral hemorrhage', 'Todd’s paralysis after a seizure', 'Hypoglycemia'],
  stemi: ['Pericarditis', 'Aortic dissection', 'Pulmonary embolism'], mvc: ['Liver laceration', 'Pelvic fracture', 'Tension pneumothorax'], tfall: ['Epidural hematoma', 'Concussion', 'Stroke'],
  moto: ['Hip dislocation', 'Pelvic fracture', 'Knee dislocation'], shock: ['Cardiogenic shock', 'Hemorrhagic shock', 'Anaphylactic shock'], rsv: ['Asthma', 'Pneumonia', 'Foreign body'],
  burn: ['Superficial burns', 'Carbon monoxide poisoning', 'Cyanide poisoning'], mcired: ['Splenic laceration', 'Kidney injury', 'Pelvic fracture'],
  mciyel: ['Hip fracture', 'Knee dislocation', 'Thigh contusion'], mcimin: ['Cervical spine fracture', 'Concussion', 'Shoulder strain'], mcigrn: ['Fracture', 'Tendon injury', 'Burn'],
  mciwr: ['Wrist sprain', 'Scaphoid fracture', 'Elbow fracture'], vip: ['Posterior stroke', 'Inner ear infection', 'Low blood pressure'],
};
// Must not miss: a wrong call here is the kind that ends in court.
const MUST = new Set(['stemi', 'nstemi', 'lvo', 'stroke', 'strokew', 'tia', 'sepsisw', 'shock', 'dka', 'gib', 'appy', 'chb', 'synchigh', 'mvc', 'mcired', 'tfall', 'od', 'anaph', 'moto', 'burn', 'rsv']);
const LIT_STEPS = [
  { at: 25, k: 'admin', title: 'A call from the hospital administrator', who: 'Hospital administration', text: 'Risk management flagged some of today’s charts. The administrator wants to know what happened before families start calling.', choices: [{ k: 'ok', label: 'Walk them through it', sub: 'Honest, factual, and you’ll review the cases' }] },
  { at: 40, k: 'peer', title: 'Peer review', who: 'Your group’s medical director', text: 'Today’s cases go to **peer review**. Colleagues will read the charts and decide if the care met the standard. It’s how groups catch problems before they get worse.', choices: [{ k: 'ok', label: 'Understood', sub: 'Your cases are on the list' }] },
  { at: 50, k: 'pip', title: 'Performance improvement plan', who: 'Your group’s medical director', text: 'You’re on a **performance improvement plan (PIP)**: closer chart review and a list of goals. Lawyers have started calling about today’s patients. **Don’t discuss a case with a lawyer.** Send them to risk management.', choices: [{ k: 'ok', label: 'Understood', sub: 'Every chart counts now' }] },
];
function litAdd(n, why, p) {
  if (G.pre || G.mode !== 'md' || G.train || !n) return;
  G.lit = Math.max(0, Math.min(100, (G.lit || 0) + n));
  if (n > 0) (G.stats.litLog = G.stats.litLog || []).push({ t: G.t, n, why: (p ? p.name + ': ' : '') + why, who: p ? p.name : null });
  litCheck();
}
function litCheck() {
  G.litStage = G.litStage || 0;
  if (G.lit >= 75 && !G.over) { G.fireNow = true; return; }   // ends at the end of this step, after the caller finishes (and its M&M is in)
  const s = LIT_STEPS.find((x, i) => i >= G.litStage && G.lit >= x.at);
  if (!s || G.card) return;
  G.litStage = LIT_STEPS.indexOf(s) + 1;
  if (s.k === 'pip') G.lawNext = G.t + randi(15, 30);
  setCard('lit', s.title, s.who, s.text, s.choices.map(c => Object.assign({}, c)), { step: s.k }); G.card.mine = true;
}
const LAWYER = { title: 'A lawyer is on the phone', who: 'Outside line', choices: [
  { k: 'risk', label: 'Refer them to risk management', sub: 'Polite, no details about the patient' },
  { k: 'talk', label: 'Explain what happened', sub: 'Tell your side of the story' },
  { k: 'skip', label: 'Don’t take the call', sub: 'They’ll call back' },
] };
function lawTick() {
  if (G.mode === 'md' && !G.pre && !G.card && G.lit >= ((LIT_STEPS[G.litStage || 0] || {}).at || 1e9)) litCheck();
  if (G.mode === 'md' && !G.pre && G.lit > 0 && G.lastMin % 20 === 0) { const last = (G.stats.litLog || []).slice(-1)[0]; if (!last || G.t - last.t >= 20) G.lit = Math.max(0, G.lit - 1); }   // clean time brings it down slowly
  if (G.mode !== 'md' || G.pre || G.train || G.lawNext == null || G.t < G.lawNext || G.card) return;
  const log = (G.stats.litLog || []).filter(x => x.who), who = log.length ? log[Math.floor(rnd() * log.length)].who : 'one of your patients';
  setCard('law', LAWYER.title, LAWYER.who, `A lawyer says they represent the family of **${who}** and want to ask you a few questions about the visit.`, LAWYER.choices.map(c => Object.assign({}, c)), { who }); G.card.mine = true;
  G.lawNext = G.t + randi(40, 70);
}
function litPick(eid, k) {
  if (eid === 'law') {
    G.stats.lawCalls = (G.stats.lawCalls || 0) + 1;
    if (k === 'risk') { G.lit = Math.max(0, G.lit - 2); toast('Right call: risk management handles lawyers. Never discuss a case without them.', 'good'); }
    else if (k === 'talk') { litAdd(6, 'discussed a case with a lawyer'); toast('Never discuss a case with a lawyer on your own. Anything you say can be used. Refer them to risk management.', 'bad'); }
    else { G.lawNext = G.t + randi(10, 20); toast('They’ll call back. Refer them to risk management when they do.', 'warn'); }
  }
  litCheck();
}
// v0.29: the quiz names diagnoses in one plain style, and skips gray-zone calls (the risk score is their call) and non-diagnoses.
const DXQ = { nstemi: 'NSTEMI', sepsisw: 'Sepsis', rsv: 'RSV bronchiolitis', burn: 'Inhalation injury', afib: 'Atrial fibrillation', ptx: 'Pneumothorax', ectopic: 'Ectopic pregnancy', aaa: 'Ruptured AAA', tcaod: 'Tricyclic overdose', lvo: 'Large vessel occlusion stroke', tfall: 'Subdural hematoma', moto: 'Open femur fracture' };
const NODX = new Set(['refill', 'bh', 'mcigrn', 'lac', 'mvc', 'mcired']);   // unstable trauma: the call is the OR, made on the FAST
const dxName = k => DXQ[k] || (CASES.find(c => c.k === k) || {}).dx;
function needsDx(p) { return mdMine(p) && !G.pre && !G.train && !p.dxK && !p.dxPick && !p.dxq && !p.arrest && !p.gray && !NODX.has(p.ck); }
function dxAsk(p) {
  const me = dxName(p.ck), d = (DDX[p.ck] || []).filter(x => x !== me && x !== p.dx).slice(0, 3);
  if (d.length < 3) { const pool = CASES.filter(c => c.k !== p.ck && !c.gray && !NODX.has(c.k) && !d.includes(dxName(c.k)) && dxName(c.k) !== me); while (d.length < 3 && pool.length) d.push(dxName(pool.splice(Math.floor(rnd() * pool.length), 1)[0].k)); }
  const ch = [me].concat(d);
  for (let i = ch.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ch[i], ch[j]] = [ch[j], ch[i]]; }
  p.dxq = ch;
  note(`${label(p)}: results are back. What’s the diagnosis?`);
}
function dxPick(pid, pick) {
  const p = pt(pid); if (!p || !p.dxq) return { ok: false, why: 'No diagnosis to make for this patient' };
  const S = G.stats.md, right = pick === dxName(p.ck) || pick === p.dx;
  p.dxPick = pick; p.dxq = null; p.dxK = true;
  if (right) { S.dxRight = (S.dxRight || 0) + 1; care(8, 'md', p); }
  else {
    S.dxWrong = (S.dxWrong || 0) + 1; care(MUST.has(p.ck) ? -20 : -8, 'md', p);
    (S.dxLog = S.dxLog || []).push({ name: p.name, said: pick, dx: p.dx, must: MUST.has(p.ck) });
    if (MUST.has(p.ck)) mm(60, `${p.name}: called ${pick}. It was ${p.dx}`, 'A must-not-miss diagnosis', true);
    litAdd(MUST.has(p.ck) ? 5 : 2, `missed ${p.dx}${MUST.has(p.ck) ? ' (must not miss)' : ''}`, p);
  }
  if (!p.txGap) treatGap(p);
  return { ok: true, right, msg: right ? `Right: ${p.dx}.` : `Not ${pick}. It’s ${p.dx}.` };
}
// Clinical accuracy: diagnoses called right and orders right, against everything called or ordered. Starts at 100.
function accuracy() {
  const S = G.stats.md || {}, good = (S.dxRight || 0) * 3 + (S.ordRight || 0), bad = (S.dxWrong || 0) * 3 + (S.ordMiss || 0) + (S.ordExtra || 0) + (S.harm || 0) * 3 + (S.dispoWrong || 0) * 2;
  return Math.round(100 * (good + 10) / (good + bad + 10));
}

const ALERTS = {
  stemi:  { name: 'STEMI', goals: ['ecg10', 'd2b90'], auto: true, team: 'Cath lab activated' },
  stroke: { name: 'Stroke', goals: ['ct25', 'dtn60'], auto: true, team: 'Stroke team paged' },
  trauma: { name: 'Trauma', goals: ['surg15'], auto: true, team: 'Trauma team activated' },
  sepsis: { name: 'Sepsis', goals: ['abx60'], team: 'Sepsis bundle ready' },
  arrest: { name: 'Code', goals: ['resus5'], team: 'Code team ready' },
  peds:   { name: 'Peds', goals: ['tx45'], team: 'Peds team aware' },
  burn:   { name: 'Burn', goals: ['tx45'], team: 'Burn supplies out' },
};
const GOALS = {
  ecg10:  { label: 'Door to ECG', lim: 10 },
  d2b90:  { label: 'Door to balloon', lim: 90 },
  ct25:   { label: 'Door to CT', lim: 25 },
  dtn60:  { label: 'Door to needle', lim: 60 },
  surg15: { label: 'Surgeon at bedside', lim: 15 },
  abx60:  { label: 'Door to antibiotics', lim: 60 },
  resus5: { label: 'Into a resus bay', lim: 5 },
  tx45:   { label: 'Transfer requested', lim: 45 },
};

/* Diversion statuses. Capacity ones (ED Full, No Monitored Beds; keys 'yellow' and 'red' kept for saves) are for a full ED. The specific ones match something that broke. */
const DIVERTS = {
  yellow: { name: 'ED Full', short: 'Full', capacity: true, cost: 0.3, rate: 0.6, when: 'The ED is saturated', what: 'Ambulances take non-critical patients elsewhere. Alerts still come.', takes: c => c.esi >= 3 && !c.alert },
  red: { name: 'No Monitored Beds', short: 'No monitors', capacity: true, cost: 0.4, rate: 0.5, when: 'No monitored or ICU beds', what: 'Ambulances take critical medical patients elsewhere when they can. Trauma still comes.', takes: c => c.esi <= 2 && c.alert !== 'trauma' && c.alert !== 'arrest' },
  ct: { name: 'CT Divert', short: 'CT', cost: 0.1, rate: 0.95, when: 'The CT scanner is down', what: 'Stroke alerts and head-injury trauma go to a hospital with a working scanner.', takes: c => c.alert === 'stroke' || (c.alert === 'trauma' && c.wk.includes('ct')) },
  stemi: { name: 'STEMI Divert', short: 'STEMI', cost: 0.1, rate: 0.95, when: 'The cath lab is down or full', what: 'STEMI alerts go to another hospital with a cath lab.', takes: c => c.alert === 'stemi' },
  trauma: { name: 'Trauma Divert', short: 'Trauma', cost: 0.1, rate: 0.95, when: 'No trauma surgeon or OR', what: 'Trauma alerts go to another trauma center.', takes: c => c.alert === 'trauma' },
  disaster: { name: 'Internal Disaster', short: 'Closed', cost: 0.1, rate: 0.95, when: 'The lab, power, or building has failed', what: 'All ambulances go elsewhere. Walk-ins still come, and patients in cardiac arrest still go to the closest ED.', takes: c => c.alert !== 'arrest' },
};
/* Things that break. Each has one right diversion. */
const OUTAGES = {
  ct: { name: 'CT scanner down', short: 'CT down', during: 'the CT scanner is down', mins: [45, 75], fix: 'ct', msg: 'The CT scanner is down. Biomed is working on it.', hits: c => c.alert === 'stroke' || (c.alert === 'trauma' && c.wk.includes('ct')) },
  cath: { name: 'Cath lab down', short: 'Cath lab down', during: 'the cath lab is down', mins: [60, 90], fix: 'stemi', msg: 'The cath lab C-arm failed. No cath cases until it’s fixed.', hits: c => c.alert === 'stemi' },
  or: { name: 'No trauma surgeon or OR', short: 'No trauma OR', during: 'there’s no trauma surgeon or OR', mins: [60, 90], fix: 'trauma', msg: 'Both ORs are running and the trauma surgeon is scrubbed in on a long case.', hits: c => c.alert === 'trauma' },
  lab: { name: 'Lab down', short: 'Lab down', during: 'the lab is down', mins: [40, 60], fix: 'disaster', msg: 'The lab is down hard: no chemistry, no hematology, no blood gases. Point-of-care testing only.', hits: c => c.esi <= 2 && c.wk.includes('lab') },
  power: { name: 'Power failure', short: 'On generator', during: 'the ED is on generator power', mins: [30, 45], fix: 'disaster', msg: 'Power failure. The ED is on generator: CT is down, the lab is crawling, and the EHR is offline.', hits: c => c.esi <= 2 && c.alert !== 'arrest' },
};

const LANGS = { es: 'Spanish', ht: 'Haitian Creole', zh: 'Mandarin', ar: 'Arabic', vi: 'Vietnamese', ru: 'Russian', asl: 'ASL' };
const LANG_W = [['es', 0.065], ['ht', 0.012], ['zh', 0.012], ['ar', 0.012], ['vi', 0.01], ['ru', 0.006], ['asl', 0.006]];

/* src: w = walk-in, e = EMS, b = both, a = EMS alert, m = mass casualty only */
const CASES = [
  { k: 'rash', cc: 'Itchy rash', dx: 'Contact dermatitis', esi: 5, src: 'w', age: [6, 55], wt: 4, wk: [], tr: ['meds'], dispo: 'home' },
  { k: 'refill', cc: 'Out of blood pressure meds', dx: 'Medication refill', esi: 5, src: 'w', age: [40, 80], wt: 3, wk: [], tr: [], dispo: 'home', ok: ['meds'] },
  { k: 'otitis', cc: 'Ear pain', dx: 'Ear infection', esi: 5, src: 'w', age: [1, 9], wt: 3, wk: [], tr: ['meds'], dispo: 'home' },
  { k: 'dental', cc: 'Toothache', dx: 'Dental abscess', esi: 5, src: 'w', age: [18, 60], wt: 2, wk: [], tr: ['meds'], dispo: 'home' },
  { k: 'strep', cc: 'Sore throat', dx: 'Strep throat', esi: 4, src: 'w', age: [5, 40], wt: 4, wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Rapid strep positive' } },
  { k: 'ankle', cc: 'Twisted ankle', dx: 'Ankle sprain', esi: 4, src: 'w', age: [12, 50], wt: 5, wk: ['xr'], tr: ['meds'], dispo: 'home', find: { xr: 'No fracture' } },
  { k: 'lac', cc: 'Cut hand', dx: 'Simple laceration', esi: 4, src: 'b', age: [16, 70], wt: 4, wk: [], tr: ['repair'], dispo: 'home' },
  { k: 'uti', cc: 'Burning with urination', dx: 'Urinary tract infection', esi: 4, src: 'w', age: [18, 70], sex: 'F', wt: 4, wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Urine: nitrite positive' } },
  { k: 'gastro', cc: 'Belly pain, vomiting', dx: 'Gastroenteritis', esi: 3, src: 'b', age: [18, 60], wt: 5, wk: ['lab'], tr: ['fluids', 'meds'], dispo: 'home', find: { lab: 'Mild dehydration' } },
  { k: 'appy', cc: 'Belly pain', dx: 'Appendicitis', esi: 3, src: 'w', age: [12, 45], wt: 3, wk: ['lab', 'ct'], tr: ['meds'], con: 'surg', pre: ['lab', 'ct'], dispo: 'or', find: { lab: 'WBC 15.8', ct: 'Appendix 11 mm across, fat stranding around it' }, ok: ['abx'] },
  { k: 'chole', cc: 'Belly pain after meals', dx: 'Cholecystitis', esi: 3, src: 'b', age: [30, 70], sex: 'F', wt: 3, wk: ['lab', 'us'], tr: ['meds'], con: 'surg', pre: ['lab', 'us'], dispo: 'admit', find: { lab: 'WBC 13.1, liver tests up', us: 'Gallstones, thick gallbladder wall' }, ok: ['abx'] },
  { k: 'hipfx', con2: 'hosp', cc: 'Fell, hip pain', dx: 'Hip fracture', esi: 3, src: 'e', age: [70, 95], wt: 5, wk: ['xr', 'lab'], tr: ['meds'], con: 'ortho', pre: ['xr'], dispo: 'admit', find: { xr: 'Femoral neck fracture', lab: 'Hgb 11.9' }, ok: ['ecg'] },
  { k: 'flu', cc: 'Fever, cough, body aches', dx: 'Influenza', esi: 4, src: 'w', age: [18, 75], wt: 2, wk: ['lab'], tr: ['meds'], dispo: 'home', iso: 'drop', find: { lab: 'Flu A positive' } },
  { k: 'pnalow', cc: 'Cough and fever for three days', dx: 'Pneumonia, low risk', esi: 3, src: 'w', age: [25, 64], wt: 2, wk: ['lab', 'xr'], tr: ['abx'], dispo: 'home', gray: 'pna', find: { lab: 'WBC 13.1', xr: 'Small right lower lobe infiltrate' } },
  { k: 'pna', cc: 'Cough and fever', dx: 'Pneumonia', esi: 3, src: 'b', age: [50, 90], wt: 4, wk: ['lab', 'xr'], tr: ['o2', 'abx'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', find: { lab: 'WBC 17.2', xr: 'Right lower lobe infiltrate' } },
  { k: 'copd', cc: 'Short of breath', dx: 'COPD flare', esi: 1, anyRoom: true, src: 'e', age: [55, 85], wt: 4, wk: ['xr', 'lab'], tr: ['nebs', 'bipap'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', vit: 'SpO2 90%, RR 24, wheezing', find: { xr: 'Hyperinflated, no pneumonia', lab: 'VBG pCO2 58' }, ok: ['meds'] },
  { k: 'chf', cc: "Short of breath, can't lie flat", dx: 'Heart failure flare', esi: 2, src: 'e', age: [60, 90], wt: 3, wk: ['ecg', 'xr', 'lab'], tr: ['bipap', 'meds'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', vit: 'SpO2 91%, BP 178/102', find: { ecg: 'Sinus tach, old Q waves', xr: 'Pulmonary edema', lab: 'BNP 2,400' } },
  { k: 'stone', cc: 'Flank pain', dx: 'Kidney stone', esi: 3, src: 'w', age: [25, 60], wt: 4, wk: ['lab', 'ct'], tr: ['meds', 'fluids'], dispo: 'home', find: { lab: 'Blood in urine, no infection', ct: '4 mm ureteral stone' } },
  { k: 'dvt', cc: 'Swollen leg', dx: 'Deep vein thrombosis', esi: 3, src: 'w', age: [30, 80], wt: 3, wk: ['us', 'lab'], tr: ['meds'], dispo: 'home', find: { us: 'Femoral vein clot', lab: 'Kidney function normal' } },
  { k: 'migraine', cc: 'Worst headache this month', dx: 'Migraine', esi: 3, src: 'w', age: [18, 50], sex: 'F', wt: 3, wk: [], tr: ['fluids', 'meds'], dispo: 'home' },
  { k: 'tb', cc: 'Cough, night sweats', dx: 'Suspected tuberculosis', esi: 3, src: 'w', age: [25, 70], wt: 1.2, wk: ['xr', 'lab'], tr: [], con: 'hosp', pre: ['xr', 'lab'], dispo: 'admit', iso: 'air', find: { xr: 'Cavity in the upper lobe', lab: 'WBC 11.4' } },
  { k: 'bh', cc: 'Behavioral health crisis', dx: 'Behavioral health emergency', esi: 2, src: 'b', age: [16, 60], wt: 2.5, wk: ['lab'], tr: [], con: 'psych', pre: ['lab'], dispo: 'bh', sitter: true, find: { lab: 'Labs normal' } },
  { k: 'etoh', cc: 'Intoxicated, found on a bench', dx: 'Alcohol intoxication', esi: 3, src: 'e', age: [25, 65], sex: 'M', wt: 3, wk: ['lab'], tr: ['fluids'], dispo: 'home', ama: 2, find: { lab: 'Ethanol 280, glucose normal' } },
  { k: 'od', cc: 'Found unresponsive, pinpoint pupils', dx: 'Opioid overdose', esi: 1, src: 'e', age: [18, 55], wt: 2, wk: ['lab'], tr: ['nalox'], dispo: 'home', ama: 4, vit: 'RR 10, SpO2 91%, drowsy after naloxone in the field', find: { lab: 'Fentanyl positive' }, watch: 120, anyRoom: true },
  { k: 'cell', cc: 'Red, hot leg', dx: 'Cellulitis', esi: 3, src: 'w', age: [30, 80], wt: 3, wk: ['lab'], tr: ['abx'], con: 'hosp', pre: ['lab'], dispo: 'admit', find: { lab: 'WBC 14.0' } },
  { k: 'syncope', cc: 'Passed out', dx: 'Syncope, low risk', esi: 3, src: 'b', age: [16, 70], wt: 3, wk: ['ecg', 'lab'], tr: [], dispo: 'home', gray: 'syncope', find: { ecg: 'Normal sinus rhythm', lab: 'Normal' } },
  { k: 'synchigh', cc: 'Passed out sitting down', dx: 'Syncope, high risk', esi: 2, src: 'b', age: [60, 90], wt: 1.5, wk: ['ecg', 'lab'], tr: [], dispo: 'obs', gray: 'syncope', find: { ecg: 'New bundle branch block', lab: 'Normal' } },
  { k: 'tia', cc: 'Arm went numb, now fine', dx: 'Transient ischemic attack', esi: 2, src: 'w', age: [55, 88], wt: 1.5, wk: ['ct', 'lab', 'ecg'], tr: [], dispo: 'obs', gray: 'tia', find: { ct: 'No acute findings', lab: 'Normal', ecg: 'Normal sinus rhythm' }, ok: ['meds'] },
  { k: 'dehyd', cc: 'Weak and dizzy', dx: 'Dehydration', esi: 3, src: 'e', age: [65, 95], wt: 3, wk: ['lab'], tr: ['fluids'], dispo: 'home', find: { lab: 'BUN 34, creatinine 1.4' } },
  { k: 'cpmod', cc: 'Chest pressure on and off', dx: 'Chest pain, moderate risk', esi: 2, src: 'b', age: [45, 75], wt: 2.5, wk: ['ecg', 'lab', 'xr'], tr: ['meds'], dispo: 'obs', ecg10: true, gray: 'chest', find: { ecg: 'Nonspecific ST changes', lab: 'First troponin negative', xr: 'Clear lungs' } },
  { k: 'cwp', cc: 'Chest pain', dx: 'Chest pain, low risk', esi: 2, src: 'b', age: [25, 60], wt: 4, wk: ['ecg', 'lab', 'xr'], tr: ['meds'], dispo: 'home', ecg10: true, gray: 'chest', find: { ecg: 'Normal sinus rhythm', lab: 'Troponin negative', xr: 'Clear lungs' } },
  { k: 'nstemi', cc: 'Chest pain', dx: 'NSTEMI (heart attack)', esi: 2, src: 'b', age: [50, 85], wt: 2.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg', 'lab'], dispo: 'admit', ecg10: true, find: { ecg: 'ST depression V4–V6', lab: 'Troponin elevated' }, ok: ['xr'] },
  { k: 'afib', cc: 'Racing heart', dx: 'A-fib with rapid rate', esi: 2, src: 'b', age: [55, 90], wt: 2.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg', 'lab'], dispo: 'admit', vit: 'HR 152, BP 118/76', find: { ecg: 'Irregularly irregular, no P waves, rate 152', lab: 'Troponin negative' } },
  { k: 'chb', cc: 'Dizzy, nearly passed out', dx: 'Complete heart block', esi: 1, src: 'b', age: [60, 90], wt: 1.2, wk: ['ecg', 'lab'], tr: ['pace'], con: 'cards', pre: ['ecg'], dispo: 'icu', ecg10: true, vit: 'HR 38, BP 102/60, lightheaded', find: { ecg: 'P waves march through, unrelated to the QRS; rate 38', lab: 'Potassium 4.4, troponin negative' } },
  { k: 'gib', con2: 'hosp', cc: 'Vomiting blood', dx: 'Upper GI bleed', esi: 2, src: 'b', age: [40, 85], wt: 2, wk: ['lab'], tr: ['fluids', 'blood'], con: 'gi', pre: ['lab'], dispo: 'admit', bleed: 'prbc', vit: 'HR 122, BP 92/58', find: { lab: 'Hemoglobin 6.8' } },
  { k: 'dka', cc: 'Vomiting, sugar very high', dx: 'Diabetic ketoacidosis', esi: 2, src: 'b', age: [16, 45], wt: 1.5, wk: ['lab'], tr: ['fluids', 'insulin'], con: 'icu', pre: ['lab'], dispo: 'icu', ok: ['ecg'], find: { lab: 'Glucose 540, anion gap 26, potassium 4.8', ecg: 'Sinus tachycardia, T waves normal' } },
  { k: 'asthma', cc: 'Wheezing', dx: 'Asthma attack', esi: 2, src: 'w', age: [5, 30], wt: 3, wk: [], tr: ['nebs', 'meds'], dispo: 'home', vit: 'SpO2 91%, can speak 3 words', watch: 60 },
  { k: 'anaph', cc: 'Throat tight after eating shrimp', dx: 'Anaphylaxis', esi: 1, anyRoom: true, src: 'b', age: [12, 60], wt: 1.5, wk: [], tr: ['epi', 'meds'], dispo: 'home', vit: 'Hives, wheeze, BP 96/60', watch: 240 },
  { k: 'sepsisw', cc: 'Fever and confusion', dx: 'Sepsis (urinary source)', esi: 2, src: 'w', age: [65, 92], wt: 1.2, wk: ['lab'], tr: ['fluids', 'abx'], con: 'hosp', pre: ['lab'], need: ['lab'], dispo: 'admit', alert: 'sepsis', vit: 'Temp 102.9, HR 118, BP 98/60', find: { lab: 'Lactate 3.1, urine positive' }, ok: ['xr'] },
  { k: 'strokew', cc: 'Face droop, slurred speech', dx: 'Acute ischemic stroke', esi: 2, src: 'w', age: [55, 88], wt: 1, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], dispo: 'icu', alert: 'stroke', find: { ct: 'No bleed', lab: 'Glucose 118' }, ok: ['ecg'] },
  // EMS alerts: they ring the Box first
  { k: 'stemi', cc: 'Crushing chest pain', dx: 'Anterior STEMI', esi: 1, src: 'a', age: [45, 80], wt: 3, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg'], need: ['ecg'], dispo: 'cath', alert: 'stemi', ecg10: true, vit: 'HR 98, BP 142/88, sweating', find: { ecg: 'ST elevation V1–V4', lab: 'Troponin pending' } },
  { k: 'stroke', cc: "Can't move right side", dx: 'Acute ischemic stroke', esi: 2, src: 'a', age: [55, 90], wt: 2, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], dispo: 'icu', alert: 'stroke', find: { ct: 'No bleed', lab: 'Glucose 132' }, ok: ['ecg'] },
  { k: 'lvo', cc: "Can't speak, eyes deviated", dx: 'Large vessel occlusion stroke', esi: 1, src: 'a', age: [55, 90], wt: 1.2, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], ift: 'cct', dispo: 'transfer', alert: 'stroke', txTo: 'the comprehensive stroke center', find: { ct: 'No bleed; CTA shows M1 occlusion', lab: 'Glucose 141' }, ok: ['ecg'] },
  { k: 'mvc', cc: 'Rollover crash, no seat belt', dx: 'Splenic laceration, hemorrhagic shock', esi: 1, src: 'a', age: [17, 45], wt: 2.2, wk: ['xr', 'lab'], tr: ['mtp'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'mtp', vit: 'HR 134, BP 78/40, pale', find: { xr: 'No pneumothorax, FAST positive', lab: 'Hemoglobin 8.1', ct: 'Grade IV splenic laceration' } },
  { k: 'tfall', cc: 'Fell down stairs, on a blood thinner', dx: 'Subdural hematoma', esi: 1, src: 'a', age: [70, 95], wt: 2, wk: ['ct', 'lab'], tr: ['reverse'], con: 'nsurg', pre: [], need: ['ct'], dispo: 'icu', alert: 'trauma', vit: 'GCS 12, BP 168/92', find: { ct: 'A crescent of fresh blood over the left brain, 8 mm, slight shift', lab: 'INR 2.9' } },
  { k: 'moto', cc: 'Motorcycle crash, leg deformity', dx: 'Open femur fracture', esi: 1, src: 'a', age: [18, 55], wt: 1.2, wk: ['xr', 'lab'], tr: ['abx', 'blood'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'prbc', vit: 'HR 118, BP 102/64', find: { xr: 'Open femur fracture', lab: 'Hemoglobin 9.4' }, ok: ['meds'] },
  { k: 'arrest', cc: 'Cardiac arrest, CPR in progress', dx: 'Cardiac arrest', esi: 1, src: 'a', age: [45, 85], wt: 1.3, wk: [], tr: [], dispo: 'code', alert: 'arrest', arrest: true, vit: 'Pulseless, VF on the monitor' },
  { k: 'shock', cc: 'Fever, BP 74/40', dx: 'Septic shock', esi: 1, src: 'a', age: [60, 90], wt: 1.8, wk: ['lab'], tr: ['o2', 'fluids', 'abx', 'pressor'], con: 'icu', pre: ['lab'], need: ['lab'], dispo: 'icu', alert: 'sepsis', vit: 'HR 128, BP 74/40, mottled', find: { lab: 'Lactate 5.4' }, ok: ['xr'] },
  { k: 'rsv', cc: 'Infant breathing hard', dx: 'RSV, tiring out', esi: 2, src: 'a', age: [0, 1], wt: 0.8, wk: ['lab'], tr: ['hfnc'], ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'peds', txTo: 'the pediatric ICU', vit: 'HR 168, RR 66, ribs pulling in, SpO2 91%', find: { lab: 'VBG pCO2 61' } },
  { k: 'burn', cc: 'House fire, burns to arms and chest', dx: 'Partial-thickness burns, 25%, airway injury', esi: 1, src: 'a', age: [20, 70], wt: 0.6, wk: ['lab'], tr: ['intub', 'vent', 'fluids', 'meds'], vit: 'Hoarse voice, soot in the mouth, HR 112', ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'burn', txTo: 'the burn center', find: { lab: 'Carboxyhemoglobin 6%' } },
  // mass casualty: the field's triage tag comes with each patient. Red is immediate, yellow can wait a little, green is walking wounded.
  { k: 'mcired', cc: 'Bus crash: pinned under a seat, belly rigid', dx: 'Liver laceration, hemorrhagic shock', esi: 1, src: 'm', age: [20, 60], wt: 1, wk: ['xr', 'lab'], tr: ['mtp'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'mtp', tag: 'red', vit: 'HR 136, BP 80/44, pale', find: { xr: 'No pneumothorax, FAST positive', lab: 'Hemoglobin 7.9', ct: 'Grade IV liver laceration' } },
  { k: 'mciyel', cc: 'Bus crash: thigh deformity, can’t walk', dx: 'Closed femur fracture', esi: 2, src: 'm', age: [18, 70], wt: 1, wk: ['xr', 'lab'], tr: ['meds', 'fluids'], con: 'ortho', pre: ['xr'], dispo: 'admit', tag: 'yellow', vit: 'HR 112, BP 112/70', find: { xr: 'Midshaft femur fracture', lab: 'Hemoglobin 11.2' } },
  { k: 'mcimin', cc: 'Bus crash: neck pain, walked off the bus', dx: 'Neck strain', esi: 3, src: 'm', age: [18, 70], wt: 1, wk: ['ct'], ok: ['xr'], tr: ['meds'], dispo: 'home', tag: 'green', find: { xr: 'No fracture', ct: 'No acute injury' } },
  { k: 'mcigrn', cc: 'Bus crash: cuts and bruises', dx: 'Minor injuries', esi: 4, src: 'm', age: [10, 70], wt: 1, wk: [], tr: ['repair'], dispo: 'home', tag: 'green' },
  { k: 'mciwr', cc: 'Bus crash: wrist pain', dx: 'Wrist fracture', esi: 4, src: 'm', age: [12, 70], wt: 1, wk: ['xr'], tr: ['meds'], dispo: 'home', tag: 'green', find: { xr: 'Distal radius fracture' } },
];

/* Box consults (online medical direction). a = the right call is to approve. */
const SCEN = {
  national: [
    { q: '64-year-old male with crushing chest pain. BP is 84/52, heart rate 58. I’d like to give nitroglycerin.', a: false, why: 'A systolic BP under 90 is a contraindication to nitroglycerin. Treat the hypotension and consider right-sided involvement.' },
    { q: '58-year-old male with chest pain, BP 150/90. He tells me he took tadalafil, Cialis, yesterday. I’d like to give nitroglycerin.', a: false, why: 'Tadalafil within 48 hours plus a nitrate can drop the pressure hard. No nitro.' },
    { q: '81-year-old female, unwitnessed arrest. She’s been in asystole through 25 minutes of full ALS care. No ROSC, and we haven’t found a reversible cause. We’re asking to terminate resuscitation.', a: true, why: 'Prolonged asystole after full ALS efforts with no ROSC generally meets termination criteria under protocol.' },
    { q: '34-year-old male with an ankle injury. He’s alert and oriented, GCS 15. He understands the risks and doesn’t want to go. Can he refuse?', a: true, why: 'An adult with decision-making capacity who understands the risks can refuse. Document it and tell him to call back.' },
    { q: '52-year-old male, diabetic. His glucose is 38 and he’s confused. He’s refusing treatment and transport. Can he refuse?', a: false, why: 'Hypoglycemia takes away capacity. Treat the sugar, then reassess whether he can refuse.' },
    { q: '6-year-old, still seizing 5 minutes after intranasal midazolam. We can’t get an IV. I’d like to give a second dose.', a: true, why: 'Status epilepticus has to be stopped. A second benzodiazepine dose is right when the first fails. Watch the breathing.' },
    { q: '40-year-old female with a femur fracture. BP 128/80. Her pain is still 9 out of 10 after one dose of fentanyl. I’d like to repeat it.', a: true, why: 'Stable vital signs and ongoing severe pain: repeat analgesia is appropriate.' },
    { q: '70-year-old male with facial droop and aphasia. Last known well was 45 minutes ago, and his LVO screen is positive. We’d like to bypass to the comprehensive stroke center. It adds 12 minutes.', a: true, why: 'A suspected large vessel occlusion inside the window does better at a center that can pull the clot.' },
    { q: '66-year-old male on dialysis who missed two sessions. He has peaked T waves and a heart rate of 44. I’d like to give calcium and albuterol.', a: true, why: 'Suspected hyperkalemia with ECG changes: calcium protects the heart, albuterol shifts potassium into cells.' },
    { q: '25-year-old female in anaphylaxis. She’s still wheezing and hypotensive 5 minutes after IM epinephrine. I’d like to give a second dose.', a: true, why: 'Repeat IM epinephrine every 5 to 15 minutes for anaphylaxis that persists.' },
    { q: '45-year-old male, intoxicated, GCS 14, with a scalp laceration from a fall. He wants to refuse. Can he refuse?', a: false, why: 'Intoxication plus a head injury makes capacity doubtful. Transport is the safer call.' },
    { q: '60-year-old male, heart rate 34, BP 70/40. Atropine did nothing. I’d like to start transcutaneous pacing.', a: true, why: 'Unstable bradycardia that atropine didn’t fix: pace (or start a chronotropic drip).' },
    { q: '30-year-old female in SVT at 210. She’s stable, and vagal maneuvers didn’t work. I’d like to give adenosine.', a: true, why: 'Stable narrow-complex SVT after failed vagal maneuvers: adenosine is the next step.' },
    { q: '72-year-old male with CHF. Crackles up to the shoulders, SpO2 84%, BP 190/110. I’d like to start CPAP and give nitroglycerin.', a: true, why: 'Hypertensive pulmonary edema: CPAP plus nitrates take the load off the heart and lungs.' },
    // v0.28: calls that ask for a dose or an order. Multiple choice: opts, with r the right one.
    { q: '45-year-old male, about 80 kg, seizing for 8 minutes. No IV yet. Requesting midazolam. What dose?', opts: ['10 mg IM', '5 mg IM', '2 mg IM', '20 mg IM'], r: 0, why: 'Over 40 kg, midazolam 10 mg IM stops status seizures as well as IV drugs, and faster when there’s no line (the RAMPART trial).', plain: 'A man has been seizing for 8 minutes. They ask how much of the seizure drug to give.', pwhy: '10 mg in the muscle: the full adult dose works without an IV.' },
    { q: '5-year-old, about 20 kg, seizing for 6 minutes. No IV. Requesting intranasal midazolam. What dose?', opts: ['4 mg intranasal', '2 mg intranasal', '8 mg intranasal', '10 mg intranasal'], r: 0, why: 'Intranasal midazolam is 0.2 mg/kg, here 4 mg, split between the nostrils. Seizures past 5 minutes get treated.', plain: 'A child is seizing. They ask how much of the drug to give in the nose.', pwhy: '0.2 mg per kg: 4 mg for a 20 kg child.' },
    { q: '30-year-old female, bee sting, lips swelling, BP 78/40. She got 0.5 mg epinephrine IM 5 minutes ago. Still hypotensive. What next?', opts: ['Repeat epinephrine 0.5 mg IM (1 mg/mL)', 'Epinephrine 0.5 mg IV push (1 mg/mL)', 'Diphenhydramine 50 mg IV and a fluid bolus', 'Methylprednisolone 125 mg IV, then reassess'], r: 0, why: 'Anaphylaxis that isn’t better gets another 0.5 mg IM every 5 to 15 minutes, with fluids. An IV push of 1 mg/mL (arrest-strength) epinephrine in someone with a pulse causes arrhythmias and strokes.', plain: 'Severe allergy, still low pressure after one shot. They ask what to do next.', pwhy: 'Another shot in the thigh. Never push the arrest dose into a vein when there’s a pulse.' },
    { q: '28-year-old female, narrow regular tachycardia at 190. BP 118/74, talking. Vagal maneuvers failed. Requesting adenosine. What dose?', opts: ['6 mg rapid IV push with a flush', '6 mg slow IV push over 2 minutes', '12 mg slow IV push over 2 minutes', '1 mg rapid IV push with a flush'], r: 0, why: 'Adenosine lasts seconds: 6 mg pushed fast through a big IV close to the heart, flushed right away. 12 mg is the second dose, also fast.', plain: 'A fast, steady heart rhythm in a stable patient. They ask how much adenosine to give.', pwhy: '6 mg, pushed fast with a flush.' },
    { q: '72-year-old male, heart rate 34, BP 70/40, dizzy and pale. Requesting atropine. What dose?', opts: ['1 mg IV, repeat every 3 to 5 minutes up to 3 mg', '0.2 mg IV, repeat every 3 to 5 minutes', '3 mg IV at once', '1 mg IV every minute until the rate is over 60'], r: 0, why: 'Symptomatic bradycardia: atropine 1 mg IV every 3 to 5 minutes, up to 3 mg. If it fails, pace or start a drip.', plain: 'A very slow heart and low pressure. They ask how much atropine to give.', pwhy: '1 mg, repeated up to 3 mg. Too little can slow the heart more.' },
    { q: '60-year-old male, wide regular tachycardia at 180 with a pulse. BP 72/40, confused. What do you order?', opts: ['Synchronized cardioversion', 'Unsynchronized defibrillation', 'Adenosine 6 mg rapid IV push', 'Amiodarone 150 mg IV over 10 minutes'], r: 0, why: 'Unstable VT with a pulse gets synchronized cardioversion now. Unsynchronized shocks are for no pulse. Drugs are for stable patients.', plain: 'A fast, dangerous rhythm with a pulse and signs of shock. They ask what to do.', pwhy: 'Shock it, timed to the heartbeat: synchronized cardioversion.' },
    { q: '55-year-old diabetic, unresponsive, glucose 38. IV in place. What do you order?', opts: ['Dextrose 25 g IV', 'Glucagon 1 mg IM', 'Oral glucose 15 g', 'Dextrose 5 g IV'], r: 0, why: 'With an IV, dextrose (25 g, as D10 or D50) works in minutes. Glucagon is for no IV. Nothing by mouth in someone who can’t protect the airway. 5 g is a fifth of the dose.', plain: 'Very low sugar, unresponsive, IV in. They ask what to give.', pwhy: 'Sugar into the vein. Nothing by mouth when they can’t swallow.' },
    { q: '24-year-old male, pinpoint pupils, breathing 4 a minute, we’re bagging him. Requesting naloxone. What dose?', opts: ['0.4 to 2 mg IV or IN, titrated to breathing', '2 mg IV every 2 minutes until he’s awake', '0.04 mg IV once', 'Naloxone 2 mg IV, then stop bagging'], r: 0, why: 'Titrate naloxone to breathing, not to waking up. Small doses avoid sudden, violent withdrawal. Keep bagging until he breathes on his own.', plain: 'Opioid overdose, barely breathing. They ask how much naloxone to give.', pwhy: 'Small doses, repeated, until they breathe.' },
    { q: '35-year-old male, about 80 kg, deformed femur after a fall. BP 132/80. Requesting fentanyl. What dose?', opts: ['1 mcg/kg IV: about 80 mcg', '3 mcg/kg IV: about 250 mcg', '0.1 mcg/kg IV: about 8 mcg', '1 mg/kg IV: about 80 mg'], r: 0, why: 'Fentanyl 1 mcg/kg IV, repeated as needed, controls fracture pain safely. Watch the units: micrograms, not milligrams.', plain: 'A broken thigh bone, stable. They ask how much fentanyl to give.', pwhy: '1 microgram per kilogram: about 80 for him.' },
    { q: 'Stabbed in the right chest. No breath sounds on the right, trachea shifted left, BP 70/30. What do you order?', opts: ['Needle decompression of the right chest', 'Needle decompression of the left chest', 'High-flow oxygen and a fast transport', 'CPAP'], r: 0, why: 'Tension pneumothorax is a clinical diagnosis. Decompress now: it kills before an X-ray can be taken. CPAP makes it worse.', plain: 'A collapsed lung under pressure, shock. They ask what to do.', pwhy: 'Let the air out with a needle, now.' }
  ],
  miemss: [
    { q: '40-year-old female with a femur fracture. BP 132/84, heart rate 104, SpO2 98%. Her pain is still 9 out of 10 after two doses of fentanyl. I’d like to give a third.', a: true, why: 'Pain Management 4.13-A: doses after the second need consultation. Vitals are stable and pain is uncontrolled, so a third dose is reasonable.' },
    { q: '62-year-old male with chest pain, no STEMI on the 12-lead. He’s had three nitroglycerin, 1.2 mg total. BP is 154/92 and the pain is still 6 out of 10. I’d like to give a fourth.', a: true, why: 'Chest Pain 3.9: nitroglycerin beyond 3 doses or 1.2 mg requires consultation. Pressure is good and the pain persists.' },
    { q: '70-year-old female with chest pain. Her pressure fell from 150/90 to 118/70 after the first nitroglycerin. Heart rate 88, pain down to 4 out of 10. I’d like to give a second.', a: false, why: 'Chest Pain 3.9: a drop of more than 20 mmHg after a dose requires consultation before more. A drop that size says she is preload dependent. Hold the nitro.' },
    { q: '58-year-old male with tearing chest pain going into his back. BP is 228/124 in the right arm and 182/100 in the left. I’d like labetalol and a blood pressure target.', a: true, why: 'New in 2026 (Chest Pain 3.9, Labetalol 11.25): for a suspected aortic syndrome with SBP 220 or more and DBP 120 or more, labetalol dosing and the BP target come from consultation.' },
    { q: '74-year-old female, Stroke Alert. Her BP is still 232/126 after two 10 mg doses of labetalol. I’d like to give the 20 mg dose.', a: true, why: 'Stroke 4.17 and Labetalol 11.25: the third dose (20 mg) needs consultation. Pressure is still at or above 220/120, and the total maximum is 80 mg.' },
    { q: '81-year-old male, Stroke Alert, BP 84/50. I’d like to give a fluid bolus on the way to the stroke center.', a: true, why: 'Stroke 4.17: a hypotensive stroke patient requires consultation. A brain at risk needs perfusion pressure, so treat the hypotension, and look for a cause other than stroke.' },
    { q: '28-year-old male, severely agitated. Temp 104°F, heart rate 150, and he’s fighting the restraints. He’s had one dose of droperidol. I’d like to give midazolam.', a: true, why: 'Agitation 4.2-A: additional sedative doses require consultation. Hyperthermia plus a struggle against restraints risks sudden death. Sedate and cool him.' },
    { q: '47-year-old female who hit her head and passed out briefly. She keeps asking me the same questions, and she wants to refuse transport. Can she refuse?', a: false, why: 'Patient-Initiated Refusal 2.6: she isn’t fully oriented, so she lacks capacity, and head injury with loss of consciousness is a high-risk finding on the refusal form. She can’t refuse. Transport.' },
    { q: '16-year-old with an ankle injury at a skate park. We can’t reach a parent or guardian, and he wants to refuse. Can he refuse?', a: false, why: 'Patient-Initiated Refusal 2.6: a minor with no authorized decision maker can’t refuse. Keep trying the guardian and transport.' },
    { q: '4-year-old in a narrow-complex tachycardia at 260. Mottled, and adenosine didn’t work. I’d like to do synchronized cardioversion.', a: true, why: 'Pediatric Tachycardia 3.3-P: cardioversion for narrow-complex tachycardia in a child requires consultation. Poor perfusion after failed adenosine means cardiovert.' },
    { q: '64-year-old male with ROSC after a VF arrest. BP 96/60, and the 12-lead shows a STEMI. We’d like to go to the cardiac interventional center. It adds 10 minutes.', a: true, why: 'Post-ROSC 3.5-A: every post-arrest patient requires consultation. ROSC with a STEMI belongs at a cardiac interventional center if transport is safe.' },
    { q: '70-year-old female with CHF. SpO2 90% on CPAP, BP 112/70. The 12-lead shows inferior ST elevation, and there’s ST elevation in V4R too. I’d like to give nitroglycerin.', a: false, why: 'CHF 6.3-A: with an inferior MI, consult before nitroglycerin. ST elevation in V4R means right ventricular involvement, and nitrates can drop her pressure hard.' },
    { q: '66-year-old female on lisinopril. Her tongue and lips are swelling and her voice is changing. No hives. Epinephrine didn’t help. I’d like to give TXA.', a: true, why: 'New in 2026 (Angioedema 4.8-A): epinephrine and TXA are given after medical consultation. ACE-inhibitor angioedema is bradykinin-driven, which is why epinephrine often fails. A changing voice means the airway is closing: don’t delay transport.' },
    { q: '52-year-old male in severe alcohol withdrawal. He’s still tremulous and hallucinating after three IV doses of midazolam. I’d like to give a fourth.', a: true, why: 'Alcohol Withdrawal 4.3: midazolam beyond three IV doses requires consultation. Untreated severe withdrawal can seize or progress to delirium tremens.' },
    { q: 'A crew on scene: 50-year-old male with chest pain and ST elevation, Priority 1. The closest facility is a freestanding ED 5 minutes out. The PCI center is 18. We’d like to go to the freestanding ED.', a: false, why: 'Freestanding Medical Facility 2.5: Priority 1 and 2 transports there require base station consultation. A STEMI needs a cardiac interventional center, not a freestanding ED.' },
    { q: '6-year-old with diabetes. Glucose is 52, still drowsy after one dose of D10. I’d like to give a second.', a: true, why: 'Pediatric Hypoglycemia 4.10: a second D10 dose requires consultation. Still under 70 and symptomatic: give it.' },
    { q: '9-month-old with croup. Stridor at rest and retractions. I’d like to give nebulized epinephrine.', a: true, why: 'Croup 6.4: nebulized epinephrine dosing for a child under 1 year requires consultation. Stridor at rest is the indication.' },
    { q: '78-year-old female with sepsis. BP is 82/44 after 30 mL/kg of LR, and her lungs are clear. I’d like to give more fluid.', a: true, why: 'Sepsis 4.15-A: fluid beyond 30 mL/kg may be approved by online consultation. Approve a bolus and start the epinephrine infusion: hypotension after 30 mL/kg is septic shock.' },
  ],
};
const PACKS = {
  national: { name: 'General', note: 'Common online medical control questions, not tied to any one state.' },
  miemss: { name: 'Maryland (MIEMSS)', note: 'Written to the 2026 Maryland Medical Protocols for EMS (effective July 1, 2026). A teaching tool, not a protocol reference.' },
};

const NAMES = {
  F: ['Dorothy', 'Maria', 'Aisha', 'Linda', 'Grace', 'Fatima', 'Rosa', 'Jen', 'Tamika', 'Priya', 'Helen', 'Ana', 'Keisha', 'Mei', 'Brenda', 'Olga', 'Shanice', 'Ruth', 'Sofia', 'Nadia', 'Carmen', 'Joyce', 'Lucia', 'Thi', 'Yara'],
  M: ['Frank', 'Luis', 'Andre', 'Tom', 'Raj', 'Darnell', 'Kevin', 'Omar', 'Walt', 'Dmitri', 'Marcus', 'Hector', 'Jim', 'Kwame', 'Earl', 'Tyler', 'Sam', 'Ivan', 'Jamal', 'Bill', 'Ray', 'Malik', 'Minh', 'Jean', 'Wei'],
};
const KIDS = { F: ['Mia', 'Zoe', 'Ava', 'Aria', 'Lily', 'Nora'], M: ['Liam', 'Noah', 'Eli', 'Leo', 'Mateo', 'Owen'] };
const INITIALS = 'ABCDEFGHJKLMNPRSTVW';
const AMA_LINES = ["I've been here hours and nobody tells me anything.", 'I have to pick up my kids.', 'I feel fine now. I\'m going home.', 'I can\'t miss another shift at work.', 'This place is a zoo. I\'m out.'];

/* ---------- small helpers ---------- */
const pt = id => (G && id ? G.pts[id] : null);
const room = id => G.rooms.find(r => r.id === id) || null;
const staff = id => G.staff.find(s => s.id === id) || null;
const roomOf = p => (p && p.room ? room(p.room) : null);
const isProv = s => !!s && (s.role === 'md' || s.role === 'app');
const present = s => !!s && (s.st === 'on' || s.st === 'break' || s.st === 'away');
function active() { const out = []; for (const id of G.order) { const p = G.pts[id]; if (p.loc !== 'gone' && p.loc !== 'enroute') out.push(p); } return out; }
function inRooms() { const out = []; for (const r of G.rooms) if (r.pid) out.push(G.pts[r.pid]); return out; }
function boarders() { return inRooms().filter(p => p.dsp === 'board'); }
function roomName(id) {
  if (/^\d+$/.test(id)) return 'Room ' + id;
  if (id[0] === 'R') return 'Resus ' + id.slice(1);
  if (id[0] === 'H') return 'Hall ' + id.slice(1);
  if (id[0] === 'C') return 'Chair ' + id.slice(1);
  return 'Fast Track ' + id.slice(2);
}
function label(p) { return p.room ? roomName(p.room) : `${p.name.split(' ')[0]} (${ageSex(p)})`; }
function clock(t) {
  const m = Math.floor(SHIFT_START + (t == null ? G.t : t));
  const h = ((Math.floor(m / 60) % 24) + 24) % 24, mm = ((m % 60) + 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function hourMul(t) { const h = ((Math.floor((SHIFT_START + t) / 60) % 24) + 24) % 24; return HOUR_MUL[h]; }
function zoneList(zs) { return zs.map(z => ZONE_NAME[z]).join(' + '); }
function genName(sex, age) {
  const pool = age < 13 ? KIDS[sex] : NAMES[sex], used = G.names || (G.names = []);
  const staffFirst = new Set(G.staff ? G.staff.flatMap(x => [x.name.split(' ')[0], x.short]) : []);
  let n = '';
  for (let i = 0; i < 25; i++) {
    n = pick(pool) + ' ' + INITIALS[randi(0, INITIALS.length - 1)] + '.';
    if (!used.includes(n) && !used.some(u => u.split(' ')[0] === n.split(' ')[0] && i < 12) && !staffFirst.has(n.split(' ')[0])) break;
  }
  used.push(n); if (used.length > 400) used.shift();
  return n;
}
const cap = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
const langMul = p => (p.lang && p.interp !== 'on' ? 1.5 : 1);

/* In physician mode the player answers only for physician work, and only for their own patients. */
const MD_TAGS = new Set(['md', 'orders', 'harm', 'dispo', 'box', 'consult', 'flow', 'goals', 'returns', 'gray', 'blood']);
const PT_TAGS = new Set(['flow', 'goals', 'returns', 'gray', 'blood', 'consult']);
/* v0.25: the four scores. Clinical and admin rise and fall with the same events that move points, sorted by the ledger's tag.
   Patients is how they felt about the visit (their experience). Staff is morale. Each reads 0 to 100. */
const SC_OF = {};
for (const k of ['md', 'orders', 'harm', 'dispo', 'gray', 'blood', 'safety', 'returns', 'box', 'boxn', 'consult', 'sitter', 'goals', 'ratio', 'uncovered', 'waiting']) SC_OF[k] = 'clinical';
for (const k of ['admin', 'divert', 'wall', 'flow', 'staffing', 'lwbs', 'ama', 'hall', 'chair', 'transfer', 'experience']) SC_OF[k] = 'admin';
const freshSc = () => ({ clinical: { g: 0, b: 0 }, admin: { g: 0, b: 0 } });
const SC_PRIOR = 150;   // a clean start reads 100%, and the first mistake doesn't sink it
function scoreOf(c) { const s = (G.sc || (G.sc = freshSc()))[c]; return Math.round(100 * (s.g + SC_PRIOR) / (s.g + s.b + SC_PRIOR)); }
function patientScore() {
  const S = G.stats; let sum = S.pxSum || 0, n = S.pxN || 0;
  for (const p of active()) if (['room', 'waiting', 'wall', 'triage'].includes(p.loc)) { sum += Math.max(0, Math.min(100, p.px)); n++; }
  return n ? Math.round(sum / n) : null;
}
function scores() { return { patients: patientScore(), clinical: scoreOf('clinical'), admin: scoreOf('admin'), staff: Math.round(staffSat()) }; }
function avgScore() { const s = scores(), v = [s.patients, s.clinical, s.admin, s.staff].filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0; }
function overallStars() { const s = scores(); return Math.round([s.patients, s.clinical, s.admin, s.staff].reduce((n, v) => n + scoreStars(v == null ? 100 : v), 0) / 4); }
const scoreStars = v => (v == null ? 0 : v >= 85 ? 3 : v >= 70 ? 2 : v >= 55 ? 1 : 0);
function care(n, tag, p) {
  if (G.pre) return;
  const k = tag || 'other', sc = SC_OF[k];
  if (sc && !(sc === 'clinical' && G.mode === 'md' && (!MD_TAGS.has(k) || (PT_TAGS.has(k) && !(p && p.mine))))) { const s = (G.sc || (G.sc = freshSc()))[sc]; if (n > 0) s.g += n; else s.b -= n; }   // clinical counts only the attending's own work
  if (G.mode === 'md' && (!MD_TAGS.has(k) || (PT_TAGS.has(k) && !(p && p.mine)))) return;
  G.care += n; G.ledger[k] = (G.ledger[k] || 0) + n;
}
const mdMine = p => !!(p && G.mode === 'md' && p.mine && p.prov === G.me);
function note(msg, kind) { if (G.pre) return; G.log.unshift({ t: G.t, msg, kind: kind || 'info' }); if (G.log.length > 60) G.log.length = 60; }
function toast(msg, kind, routine) { if (G.pre) return; note(msg, kind); hooks.toast(msg, kind || 'info', !!routine); }   // routine: good to know, nothing to do. The floor plan files it under the bell.
function sound(n) { if (!G.pre) hooks.sound(n); }
function warnOnce(key, msg, every) {
  const w = G.warn[key];
  if (w != null && G.t - w < (every || 20)) return;
  G.warn[key] = G.t; toast(msg, 'bad');
}

function freshStats() {
  return { arrived: 0, dc: 0, admit: 0, icu: 0, bh: 0, or: 0, cath: 0, tx: 0, lwbs: 0, ama: 0, expired: 0, rosc: 0, quick: 0,
    wrCrash: 0, wrCodes: 0, ratioMin: 0, uncovered: 0, angry: 0, wrongSpec: 0, adverse: 0, agency: 0, mandates: 0,
    objOk: 0, objFail: 0, boxC: { ans: 0, miss: 0, right: 0, wrong: 0 }, boxN: { ans: 0, miss: 0 }, goals: { met: 0, miss: 0, list: [] }, events: 0,
    registered: 0, triaged: 0, offloads: 0, transports: { tp: 0, pct: 0 }, ift: { wc: 0, bls: 0, als: 0, cct: 0, air: 0 }, iftRefused: 0, airAbort: 0, txInstead: 0,
    outLog: [], outRight: 0, outMiss: 0, divertExtra: 0, divertAny: 0, obs: 0, quickReg: 0, intub: 0, intubNoRT: 0,
    gray: { right: 0, ok: 0, under: 0, over: 0 }, mm: [], fcp: 0, updates: 0, complaints: 0, hallMins: 0, underTriage: 0, underCaught: 0,
    cosign: 0, missedDx: 0, chairMoves: 0, staffMins: {}, suspended: 0,
    md: { seen: 0, fast: 0, ordRight: 0, ordExtra: 0, ordMiss: 0, clean: 0, gaps: 0, harm: 0, untreated: 0, dispoRight: 0, dispoWrong: 0 },
    returns: 0, returnsLate: 0, lep: 0, interp: 0, mtp: 0, mtpWaste: 0, oneg: 0, overrides: 0, medErrors: 0, pitDc: 0, pitSeen: 0, diverted: 0, shock: 0 };
}
function mkStaff(r) {
  const s = { id: r.id, role: r.role, name: r.role === 'rph' ? 'PharmD ' + r.name : r.name, short: r.short || r.name, title: r.title || TITLE[r.role],
    zones: (r.zones || []).slice(), float: !!r.float, st: 'on', until: 0, q: [], task: null,
    morale: 72 + randi(0, 16), lastBreak: 0, done: 0, cover: [], tag: r.tag || '', leaveAt: null, pit: false, tq: [], escortUntil: -1e9,
    skill: r.skill || (r.tag === 'agency' ? 'agency' : 'std') };
  if (r.start) { s.st = 'pending'; s.until = r.start; s.tag = s.tag || 'swing shift'; }
  return s;
}

/* ---------- game setup ---------- */
function newGame(level, seed, opts) {
  opts = opts || {};
  const L = LEVELS[level] || LEVELS.med;
  G = {
    v: 5, level: LEVELS[level] ? level : 'med', pack: PACKS[opts.pack] ? opts.pack : 'national',
    seed: seed | 0, rng: (seed | 0) || 7, rngA: seedOf(seed, 1), rngE: seedOf(seed, 2), rngM: seedOf(seed, 3), rngL: seedOf(seed, 4), rngS: seedOf(seed, 6), code: opts.code || null, t: -PREROLL, running: true, over: false, fail: null, pre: true,
    shift: L.shift, nid: 1, tid: 1, sid: 1, lastMin: Math.floor(-PREROLL),
    rooms: ROOMS.map(r => ({ id: r.id, z: r.z, kind: r.kind, iso: !!r.iso, safe: !!r.safe, st: 'clean', pid: null, dirt: 'std', closed: false })),
    pts: {}, order: [], enroute: [], triageQ: [], evsQ: [], errands: [],
    staff: [],
    img: { xr: { busy: null, q: [], down: -1e9 }, ct: { busy: null, q: [], down: -1e9 }, us: { busy: null, q: [], down: -1e9 }, mri: { busy: null, q: [], down: -1e9 } },
    box: { cur: null, q: [], nextC: 1e9, seq: 0, scen: [] },
    spec: {}, ev: { next: 1e9, used: {}, sick: 0, regionDue: false, regionFired: false, missedC: 0, lastAma: -1e9 },
    card: null, obj: [], sched: [], warn: {},
    house: { esc: 4 },
    blood: { oneg: 12 },
    remote: null,
    mods: { lab: -1e9, ehr: -1e9, surge: -1e9, survey: -1e9, noDivert: -1e9, noAgency: false, shortage: -1e9, bbSlow: -1e9, interpDown: -1e9, remoteRph: false, noReport: -1e9 },
    obsUnit: { cap: 8, filled: 6, nextOut: -60 }, fcp: { last: -1e9 },
    region: { hosps: [{ name: 'Mercy', st: 'open', since: 0, hold: 0 }, { name: "St. Luke's", st: 'open', since: 0, hold: 0 }, { name: 'County General', st: 'open', since: 0, hold: 0 }], susp: -1e9 },
    wrUpdate: -1e9,
    dv: Object.fromEntries(Object.keys(DIVERTS).map(k => [k, { on: false, mins: 0, since: 0, unjust: 0 }])), out: {},
    pizza: false, sec: { busy: -1e9 }, agN: 0, report: null, lit: 0, litStage: 0, lawNext: null,
    nextArr: { walk: 0, ems: 0, alert: 1e9 },
    stats: freshStats(), care: 0, ledger: {}, log: [], sc: freshSc(), clerk: [], clerkN: 0,
    train: !!L.train, tr: L.train ? { step: 0, ids: {}, setup: {} } : null,
    mode: opts.mode === 'md' ? 'md' : 'rn', me: opts.mode === 'md' ? 'md1' : null,
    scen: SCENS[opts.scen] && !L.train ? opts.scen : 'none',
    wx: WX[opts.wx] && !L.train ? opts.wx : 'clear', wxAir: [],
  };
  bedInit();
  if (G.wx === 'fog') G.wxAir = WX.fog.air.map(x => x.slice());
  if (G.wx === 'storm') { const a = randi(60, 200), b = randi(330, 520); G.wxAir = [[a, a + randi(60, 100)], [b, b + randi(60, 100)]]; }
  G.staff = ROSTER.map(mkStaff);
  for (const r of G.rooms) if (r.z === 'ft') r.closed = true;  // Fast Track opens at 09:00
  for (const k in SPECS) G.spec[k] = { mood: 0, at: 0 };
  G.nextArr.walk = G.t + expo(60 / (L.walk * hourMul(G.t)));
  G.nextArr.ems = G.t + expo(60 / (L.ems * hourMul(G.t)));
  // You inherit a department that has been running all night.
  let guard = 0;
  while (G.t < 0 && guard++ < 2000) { step(0.25); botStep({}); }
  seedBoarders(L.boarders + (G.scen === 'board' ? 5 : 0));
  startShift();
  return G;
}
function seedBoarders(n) {
  const kinds = ['pna', 'hipfx', 'cell', 'copd', 'chf', 'nstemi'];
  for (let i = 0; i < n; i++) {
    const r = G.rooms.find(x => x.kind === 'main' && !x.pid && x.st === 'clean' && !x.safe && !x.iso);
    if (!r) return;
    const ck = pick(kinds), c = CASES.find(x => x.k === ck);
    const p = makePatient(c, 'ems');
    p.unit = 'Overnight'; p.tArrive = -randi(300, 600); p.tTriage = p.tArrive; p.tRoom = p.tArrive + randi(20, 90); p.tProv = p.tRoom + 10;
    p.loc = 'room'; p.room = r.id; r.pid = p.id; r.st = 'occ';
    p.rn = 'done'; p.ev = 'done'; p.dxK = true; p.prov = null; p.reg = 'done'; p.tri = 'done';
    for (const w of p.wk) p.work[w] = { st: 'done', tDone: p.tRoom + 60 };
    for (const k of p.tr) p.treat[k] = { st: 'done' };
    p.goals = {};
    if (p.con) p.consult = { st: 'here', spec: p.con, due: p.tRoom + 90, tArr: p.tRoom + 100 };
    p.dsp = 'board'; p.due = 1e9; p.tBoard = p.tRoom + 120; p.overnight = true; p.bedU = unitOf(p); p.bedGot = false;
  }
}
function startShift() {
  const L = LEVELS[G.level];
  G.pre = false; G.t = Math.max(G.t, 0); G.lastMin = Math.floor(G.t);
  G.stats = freshStats(); G.care = 0; G.ledger = {}; G.log = []; G.warn = {}; G.sc = freshSc();
  for (const s of G.staff) { s.lastBreak = 0; s.done = 0; }
  G.box.nextC = G.t + randi(8, 16);
  G.nextArr.alert = G.t + 5 + expo(60 / (L.alerts * hourMul(G.t)));
  G.ev.next = G.t + randi(L.events[0], L.events[1]);
  for (let i = 0; i < L.callouts; i++) G.sched.push({ t: G.t + 0.3 + i * 0.3, k: 'callout' });
  G.sched.push({ t: 240, k: 'swing' });
  G.sched.push({ t: 120, k: 'ftopen' });
  const at = Math.round(Math.min(45, G.shift * 0.17));   // a scenario's problem lands early, once the player has their feet under them
  if (G.scen === 'ct') G.sched.push({ t: at, k: 'scenct' });
  if (G.scen === 'mci') G.sched.push({ t: at, k: 'scenmci' });
  if (G.scen === 'short') for (let i = 0; i < 2; i++) G.sched.push({ t: G.t + 1.5 + i * 0.4, k: 'callout' });
  if (G.train) { G.nextArr = { walk: 1e9, ems: 1e9, alert: 1e9 }; G.box.nextC = 1e9; }
  if (G.mode === 'md') { const me = staff(G.me); orphanPatients(me); me.morale = 85; }  // the night doc signed out to the team
  note(`07:00, ${L.name}. ${G.train ? 'Your preceptor has the board with you.' : 'Night shift hands you the board.'}`);
}

/* ---------- main step ---------- */
function step(dt) {
  if (!G || !G.running || G.over) return;
  try { stepInner(dt); } finally { if (G.fireNow && !G.over) { G.fireNow = false; toast('Your group has let you go. The shift is over.', 'bad'); sound('bad'); endShift('fired'); } }
}
function stepInner(dt) {
  if (G.card && G.mode === 'md' && !G.pre && !G.card.mine) aiCard();
  if (G.card) return;
  G.t += dt;
  arrivals();
  scheduled(); if (G.card) return;
  if (!G.pre) { boxTick(dt); eventsTick(); if (G.card) return; objTick(); }
  staffTick();
  enrouteTick();
  provTick(dt);
  rnTick(dt);
  pctTick(dt);
  regTick(dt);
  ucTick();
  tpTick(dt);
  rtTick(dt);
  rphTick(dt);
  evsTick(dt);
  imgTick(dt);
  resultTick();
  bloodTick();
  interpTick();
  consultTick();
  helpTick();
  flowTick();
  const m = Math.floor(G.t);
  if (m !== G.lastMin) { G.lastMin = m; minuteTick(); if (G.mode === 'md' && !G.pre && !G.over) aiTick(); }
  if (!G.pre && G.t >= G.shift) endShift('time');
}

/* ---------- arrivals ---------- */
/* Which case comes through the door. A case that just came is unlikely to come again for 45 minutes, and less likely for two hours,
   so a shift does not bring three hip fractures before 08:00. The weights are otherwise untouched: common cases stay common across the day. */
/* Each arrival stream keeps its own spacing log and looks only at streams no player can change (walk-ins look at walk-ins only),
   so the same class code brings the same patients whatever the player does. */
const CASE_SEES = { walk: ['walk'], ems: ['ems', 'walk'], surge: ['surge', 'ems', 'walk'], alert: ['alert'] };
function pickCase(srcs, log) {
  log = log || 'x';
  const C = G.caseLog || (G.caseLog = {}), lg = k => C['_' + k] || (C['_' + k] = {}), L = lg(log), sees = (CASE_SEES[log] || [log]).map(lg);
  const mix = wxOf().mix || {};
  const c = wpick(CASES.filter(c => srcs.includes(c.src)), c => { const w = c.wt * (mix[c.k] || 1); let last = null; for (const S of sees) if (S[c.k] && (last == null || S[c.k].t > last)) last = S[c.k].t; if (last == null) return w; const ago = G.t - last; return w * (ago < 45 ? 0.1 : ago < 120 ? 0.4 : 1); });
  L[c.k] = { n: (L[c.k] ? L[c.k].n : 0) + 1, t: G.t };
  return c;
}
function pickLang() { let r = rnd(); for (const [k, w] of LANG_W) { r -= w; if (r < 0) return k; } return null; }
/* ---------- vitals: they drift while a patient waits and settle as treatment lands ----------
   Computed from the patient's state and the clock, so nothing here changes how a shift plays out.
   The numbers follow what the engine already knows: true acuity, time untreated, treatments done, crashing, shock. */
const VDOOR = { 1: { hr: 124, sbp: 94, dbp: 56, rr: 24, spo2: 95 }, 2: { hr: 104, sbp: 142, dbp: 86, rr: 20, spo2: 97 }, 3: { hr: 94, sbp: 136, dbp: 84, rr: 18, spo2: 97 }, 4: { hr: 84, sbp: 128, dbp: 78, rr: 16, spo2: 99 }, 5: { hr: 78, sbp: 122, dbp: 76, rr: 16, spo2: 99 } };
/* What each case looks like at the door, where the acuity alone would get it wrong. Written for an adult; a child's are scaled from their own normals.
   Oxygen is low only when breathing is the problem: a stroke, a bleed, or DKA arrives with a normal sat. */
const VCASE = {
  refill: { sbp: 164, dbp: 98 }, otitis: { temp: 101.3 }, strep: { temp: 101.5, hr: 100 }, uti: { temp: 99.8 },
  gastro: { hr: 106, sbp: 108, dbp: 66, spo2: 98 }, appy: { temp: 100.6, hr: 102 }, chole: { temp: 100.4, hr: 98 }, hipfx: { hr: 96, sbp: 148, dbp: 86 },
  pna: { temp: 101.6, hr: 98, rr: 24, spo2: 92.6 }, pnalow: { temp: 100.9, hr: 92, rr: 20, spo2: 96 }, flu: { temp: 102.1, hr: 104, rr: 18, spo2: 97 }, copd: { hr: 98 }, stone: { hr: 106, sbp: 152, dbp: 92 }, dvt: { hr: 84, sbp: 130, dbp: 80, spo2: 98 },
  migraine: { sbp: 140, dbp: 86 }, tb: { temp: 100.8, spo2: 95 }, bh: { hr: 98 }, etoh: { hr: 104 }, cell: { temp: 100.9 },
  syncope: { hr: 62, sbp: 108, dbp: 64, spo2: 98 }, tia: { hr: 80, sbp: 172, dbp: 96 }, dehyd: { hr: 104, sbp: 106, dbp: 64 }, mcimin: { hr: 100, sbp: 138, dbp: 84 }, mcigrn: { hr: 98 }, mciwr: { hr: 96, sbp: 134, dbp: 82 }, mcired: { rr: 28, spo2: 94 }, mciyel: { rr: 20 },
  chf: { hr: 108, rr: 26 }, od: { hr: 64, sbp: 104, dbp: 62 }, synchigh: { hr: 70, sbp: 124, dbp: 74, rr: 16, spo2: 97 }, chb: { rr: 18, spo2: 97 },
  cpmod: { hr: 88, sbp: 146, dbp: 88, rr: 18 }, cwp: { hr: 84, sbp: 136, dbp: 84, rr: 18, spo2: 98 }, nstemi: { hr: 94, sbp: 150, dbp: 90 },
  afib: { rr: 20, spo2: 96 }, gib: { rr: 22 }, dka: { hr: 118, rr: 28, sbp: 104, dbp: 62, spo2: 99 }, asthma: { hr: 118, rr: 28, sbp: 138, dbp: 84 },
  anaph: { hr: 126, rr: 26, spo2: 92 }, sepsisw: { rr: 24, spo2: 94 }, strokew: { hr: 84, sbp: 168, dbp: 92, rr: 18 }, stroke: { hr: 86, sbp: 172, dbp: 94, rr: 18 },
  rsv: { temp: 100.6 }, burn: { rr: 24, sbp: 148, dbp: 90 },
  stemi: { rr: 20, spo2: 95 }, lvo: { hr: 88, sbp: 176, dbp: 98, rr: 18, spo2: 95 }, mvc: { rr: 28, spo2: 93 }, tfall: { hr: 58, rr: 14, spo2: 96 },
  moto: { rr: 22, spo2: 96 }, shock: { temp: 102.6, rr: 28, spo2: 92 },
};
/* These do not go pale and fast when they get worse. A head bleed's pressure climbs while the heart slows; a stroke's pressure stays up;
   an overdose stops breathing; heart failure drowns with the pressure still high. */
const VHOLD = new Set(['tfall', 'strokew', 'stroke', 'lvo', 'tia', 'chf', 'od']);
const VADULT = { hr: 78, sbp: 122, dbp: 76, rr: 16 };
const vhash = s => { let h = 9; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; };
function vNormal(age) {
  if (age < 2) return { hr: 130, sbp: 90, dbp: 55, rr: 36, spo2: 98, temp: 98.6 };
  if (age < 6) return { hr: 110, sbp: 96, dbp: 58, rr: 26, spo2: 98, temp: 98.6 };
  if (age < 13) return { hr: 94, sbp: 104, dbp: 64, rr: 20, spo2: 98, temp: 98.6 };
  return { hr: age > 75 ? 74 : 78, sbp: age > 75 ? 132 : 122, dbp: 76, rr: 16, spo2: 98, temp: 98.4 };
}
function vDoor(p) {   // the numbers at arrival, and the signs that go with them
  const n = vNormal(p.age), d = Object.assign({}, n), signs = [], kid = p.age < 13;
  const scale = (k, val) => (kid && k in VADULT ? n[k] + (val - VADULT[k]) * (k === 'sbp' || k === 'dbp' ? 0.3 : 1) : val);   // a child's version of an adult number
  const base = VDOOR[p.esi] || VDOOR[4];
  for (const k of ['hr', 'sbp', 'dbp', 'rr']) d[k] = scale(k, base[k]);
  d.spo2 = Math.min(n.spo2, base.spo2);
  for (const [k, val] of Object.entries(VCASE[p.ck] || {})) d[k] = scale(k, val);
  for (const part of String(p.vit || '').split(',').map(x => x.trim()).filter(Boolean)) {   // a case's own numbers are already right for its age
    let m;
    if ((m = /^HR (\d+)/.exec(part))) d.hr = +m[1];
    else if ((m = /^BP (\d+)\/(\d+)/.exec(part))) { d.sbp = +m[1]; d.dbp = +m[2]; }
    else if ((m = /^RR (\d+)/.exec(part))) d.rr = +m[1];
    else if ((m = /^SpO2 (\d+)/.exec(part))) d.spo2 = +m[1];
    else if ((m = /^Temp ([\d.]+)/.exec(part))) d.temp = +m[1];
    else signs.push(part);
  }
  return { d, n, signs };
}
/* Minutes for a treatment to show in the numbers. Naloxone and epinephrine work while you watch. An insulin drip takes most of an hour.
   Antibiotics stop the clock but take hours to move a heart rate or a fever: they get no credit they have not earned. */
const VONSET = { nalox: 3, epi: 6, intub: 4, vent: 6, nebs: 12, bipap: 10, hfnc: 10, mtp: 15, blood: 20, fluids: 20, meds: 20, tnk: 30, insulin: 40, abx: 360, repair: 5, o2: 3, bp: 10, pressor: 8, pace: 2, reverse: 30, cardiovert: 2 };
function vRelief(p, t) {   // 0: nothing has been done. 1: every treatment has had time to work.
  const ks = Object.keys(p.treat || {}), total = Math.max(ks.length, (p.tr || []).length, 1);
  let r = 0;
  for (const k of ks) { const x = p.treat[k]; if (x.st !== 'done') continue; const at = x.tDone != null ? x.tDone : p.tRoom != null ? p.tRoom : p.tArrive; if (at <= t) r += Math.min(1, (t - at) / (VONSET[k] || 20)) / total; }
  return Math.min(1, r);
}
/* How sick they look right now: 1 is how they came in, above 1 is worse, toward 0 is back to normal. */
function sickAt(p, t) {
  const rate = { 1: 0.010, 2: 0.005, 3: 0.002, 4: 0.0005 }[p.esi] || 0;
  const at = x => (x.tDone != null ? x.tDone : p.tRoom != null ? p.tRoom : p.tArrive);
  const done = Object.values(p.treat || {}).filter(x => x.st === 'done' && at(x) <= t);
  const first = done.length ? Math.min(...done.map(at)) : null;
  let s = Math.min(1.45, 1 + rate * Math.max(0, Math.min((first != null ? first : t) - p.tArrive, 120)));   // worse the longer nothing is done, up to two hours
  if (p.crash && (!p.tCrash || p.tCrash <= t)) s = Math.max(s, 1.4);
  if (p.shock) s = Math.max(s, 1.5);
  s *= 1 - 0.75 * vRelief(p, t);
  if (!(p.tr || []).length && p.dxK) s *= 0.85;   // nothing to treat, and now they know what it is
  return s;
}
/* The numbers before rounding and wobble, at any minute. */
const needsTx = (p, k) => (p.right ? p.right.tr : p.tr || []).includes(k) || (p.tr || []).includes(k);
function vRaw(p, t) {
  const { d, n, signs } = vDoor(p), s = sickAt(p, t), rel = vRelief(p, t);
  const kid = p.age < 13, stroke = p.alert === 'stroke', hold = VHOLD.has(p.ck) || stroke;
  const doneBy = k => { const x = p.treat && p.treat[k]; return !!(x && x.st === 'done' && (x.tDone == null || x.tDone <= t)); };
  const v = {};
  for (const k of ['hr', 'rr', 'spo2']) v[k] = n[k] + (d[k] - n[k]) * s;
  v.sbp = n.sbp + (d.sbp - n.sbp) * s; v.dbp = n.dbp + (d.dbp - n.dbp) * s;
  v.temp = n.temp + (d.temp - n.temp) * Math.min(s, 1.15);   // a fever does not climb the way a heart rate does
  const crashed = p.crash && (!p.tCrash || p.tCrash <= t);
  let sg = signs;
  if (crashed && p.crashV) {   // a crash looks like what is wrong: a bleed goes pale and fast, an airway goes blue, a blocked heart goes slow
    const f = 1 - 0.85 * rel;
    for (const k of ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp']) if (p.crashV[k] != null) v[k] = n[k] + (p.crashV[k] - n[k]) * f;
    if (p.crashV.sign) sg = [p.crashV.sign];
  } else if ((p.shock || crashed) && !hold) {   // out of reserve: fast, pale, and the pressure is gone, until treatment brings it back
    const lowS = kid ? n.sbp - 22 : p.shock ? 74 : 84, lowD = kid ? n.dbp - 14 : p.shock ? 42 : 50, hiH = kid ? n.hr + 50 : p.shock ? 131 : 126;
    v.sbp = Math.min(v.sbp, lowS + (n.sbp - lowS) * rel); v.dbp = Math.min(v.dbp, lowD + (n.dbp - lowD) * rel);
    v.hr = Math.max(v.hr, hiH + (n.hr - hiH) * rel); v.rr = Math.max(v.rr, n.rr + 10 * (1 - rel));
  }
  if (stroke && p.bp0) {   // a stroke's pressure stays where it came in until someone treats it. The thrombolytic does not lower it.
    const x = p.treat && p.treat.bp, at = x && x.st === 'done' ? (x.tDone != null ? x.tDone : t) : null;
    const k = at != null && at <= t ? Math.min(1, (t - at) / VONSET.bp) : 0;
    const tg = [Math.min(p.bp0[0], 166), Math.min(p.bp0[1], 92)];
    v.sbp = p.bp0[0] + (tg[0] - p.bp0[0]) * k; v.dbp = p.bp0[1] + (tg[1] - p.bp0[1]) * k;
  }
  if (needsTx(p, 'pressor') && !doneBy('pressor')) { v.sbp = Math.min(v.sbp, 86); v.dbp = Math.min(v.dbp, 50); }   // fluids alone do not fix this kind of shock
  // Oxygen: ordered, or put on by the nurse who assessed a low sat. The attending's own patients wait for the order.
  const device = ['bipap', 'hfnc', 'vent', 'intub'].some(doneBy);
  const o2 = !device && (doneBy('o2') || (!mdMine(p) && !needsTx(p, 'o2') && p.loc === 'room' && p.rn === 'done' && d.spo2 < 94));
  if (o2) v.spo2 = Math.max(v.spo2, p.ck === 'copd' ? 91 : kid ? 95 : 94);
  return { v, n, d, s, signs: sg, kid, o2, capS: 240, capD: 130 };
}
/* How far from normal, in steps a person would notice on the monitor: 5 beats, 6 of pressure, 2 breaths, 1.5 points of oxygen, half a degree. */
const vFar = (v, n) => Math.abs(v.hr - n.hr) / 5 + Math.abs(v.sbp - n.sbp) / 6 + Math.abs(v.rr - n.rr) / 2 + Math.abs(v.spo2 - n.spo2) / 1.5 + Math.abs(v.temp - n.temp) / 0.5;
function vitalsOf(p, when) {
  const t = when != null ? when : G.t;
  if (p.arrest) return { arrest: true, taken: true, text: 'No pulse. CPR in progress', signs: [], flags: {}, trend: 'worse', s: 2 };
  const ems = p.src === 'ems' || !!p.unit;
  if (!ems && p.tri !== 'done' && p.loc !== 'room') return { taken: false, text: 'Not taken yet. Triage takes the first set.', signs: [], flags: {}, trend: 'steady', s: 1 };
  const R = vRaw(p, t), R0 = vRaw(p, t - 15), { n, s, kid } = R, v = Object.assign({}, R.v);
  const jit = k => (vhash(p.id + k + Math.floor(t / 5)) - 0.5) * 2;   // small wobble, new every five minutes
  const hrMax = p.age < 2 ? 210 : p.age < 6 ? 200 : p.age < 13 ? 190 : p.age >= 65 ? 170 : 180;
  v.hr = Math.round(Math.max(30, Math.min(hrMax, v.hr + jit('h') * 3)));
  v.sbp = Math.round(Math.max(56, Math.min(R.capS, v.sbp + jit('s') * 4)));
  v.dbp = Math.round(Math.max(30, Math.min(v.sbp - 16, R.capD, v.dbp + jit('d') * 3)));
  v.rr = Math.round(Math.max(4, Math.min(Math.max(44, Math.min(72, n.rr * 2)), v.rr + jit('r'))));   // a baby can breathe 70 times a minute; an adult cannot
  v.spo2 = Math.round(Math.max(62, Math.min(100, v.spo2 + jit('o') * 0.8)));
  v.temp = Math.round(Math.max(95, Math.min(105.5, v.temp + jit('t') * 0.2)) * 10) / 10;
  const flags = kid
    ? { hr: v.hr > n.hr + 30 || v.hr < n.hr - 35, bp: v.sbp < n.sbp - 16, rr: v.rr > n.rr + 10 || v.rr < n.rr - 8, spo2: v.spo2 < 94, temp: v.temp >= 100.4 }
    : { hr: v.hr > 100 || v.hr < 50, bp: v.sbp < 100 || v.sbp > 180, rr: v.rr > 21 || v.rr < 10, spo2: v.spo2 < 94, temp: v.temp >= 100.4 };
  // The trend is read off the numbers themselves: worse or better only when a person watching the monitor would see it move.
  const moved = vFar(R.v, n) - vFar(R0.v, R0.n);
  const trend = moved >= 1 ? 'worse' : moved <= -1 ? 'better' : 'steady';
  const showSigns = (s > 0.6 ? R.signs : []).concat(R.o2 ? ['on oxygen'] : []);
  const text = `HR ${v.hr}, BP ${v.sbp}/${v.dbp}, RR ${v.rr}, SpO2 ${v.spo2}%${flags.temp || v.temp >= 99.5 ? `, Temp ${v.temp.toFixed(1)}°F` : ''}${showSigns.length ? ', ' + showSigns.join(', ') : ''}`;
  return Object.assign(v, { taken: true, ems: ems && p.loc !== 'room' && p.tri !== 'done', signs: showSigns, flags, trend, s, o2: R.o2, red: Object.values(flags).some(Boolean), text });
}

function makePatient(c, src) {
  const sex = c.sex || (chance(0.5) ? 'F' : 'M');
  const age = randi(c.age[0], c.age[1]);
  const p = {
    id: 'p' + (G.nid++), ck: c.k, name: genName(sex, age), age, sex, src,
    cc: c.cc, dx: c.dx, esi: c.esi, alert: c.alert || null, alertOn: false, anyRoom: !!c.anyRoom,   // anyRoom: an ESI 1 who needs one drug now, not a resus bay (an overdose)
    wk: c.wk.slice(), tr: c.tr.slice(), con: c.con || null, pre: (c.pre || []).slice(), need: c.need ? c.need.slice() : null,
    dispo: c.dispo, find: Object.assign({}, c.find || {}), iso: c.iso || null, sitter: !!c.sitter, txTo: c.txTo || null,
    arrest: !!c.arrest, ecg10: !!c.ecg10, vit: c.vit || null, bleed: c.bleed || null, amaMul: c.ama || 1, tag: c.tag || null,
    loc: 'new', room: null, unit: null, eta: 0, tArrive: G.t, tTriage: null, tRoom: null, tProv: null, tDone: null, tWall: null,
    patience: 1e9, rn: 'none', prov: null, ev: 'none', re: 'none', work: {}, treat: {}, dxK: false,
    consult: { st: 'none', spec: null, due: 0 }, con2: null, consult2: null, dsp: 'none', due: 0, goals: {},
    stat: false, vip: false, pren: false, missN: false, crash: false, tCrash: 0, sitBy: null, triaging: false, outcome: null,
    lang: age < 2 ? null : pickLang(), interp: 'none', interpDue: 0,
    bb: null, shock: false, pitSeen: false, pitQ: false, pitDcQ: false, ret: false, amaSafe: 0,
    reg: 'none', regBy: null, tri: 'none', triBy: null, offload: false, needCC: c.ift === 'cct', iftLevel: null, xBy: null,
    con2x: c.con2 || null, px: 85, esiT: null, hardAirway: HARD_AIRWAY.has(c.k), screen: c.iso ? 'pending' : null, gray: c.gray ? grayScore(c) : null, grayPick: null, cosign: null, lastUpdate: null, lastRecheck: null, quick: false, missedDx: null, outHit: null,
  };
  if (p.alert) for (const g of ALERTS[p.alert].goals) p.goals[g] = null;
  if (p.ecg10 && !('ecg10' in p.goals)) p.goals.ecg10 = null;
  p.rehab = !G.train && c.dispo === 'home' && age >= 70 && vhash(p.id + 'rehab') < 0.45;
  if (c.con2 && !G.train && vhash(p.id + 'con2') < 0.6) p.con2 = c.con2;   // v0.27: about one consulted patient in five needs a second service   // v0.25: safe to leave the ED, not safe to go home alone
  if (p.alert === 'stroke') strokeSetup(p);
  G.pts[p.id] = p; G.order.push(p.id);
  return p;
}
/* A stroke's own facts. Last known well sets the window for the thrombolytic (4.5 hours). The pressure at the door is either under the limit
   for the drug (185/110) or over it, and over it the pressure has to come down before the drug goes in. Both come from the patient's id, not the dice. */
const LYTIC_BP = [185, 110], LYTIC_WINDOW = 270;
// Inside the window (4.5 hours from last known well)? A patient with no onset time on record isn't a stroke patient: the window doesn't apply.
function lyticWindowOk(p) { return !p || p.lkwT == null || !G || G.t - p.lkwT <= LYTIC_WINDOW; }
function strokeSetup(p, o) {
  o = o || {};
  const over = o.over != null ? !!o.over : vhash(p.id + 'bp') < 0.45;
  p.lkw = o.lkw != null ? o.lkw : 35 + Math.round(vhash(p.id + 'lkw') * 110);   // minutes before they reached us
  p.lkwT = G.t - p.lkw;
  const a = vhash(p.id + 'bq'), b = vhash(p.id + 'br');
  p.bp0 = over ? [192 + Math.round(a * 20), 100 + Math.round(b * 14)] : [158 + Math.round(a * 16), 86 + Math.round(b * 10)];
  p.tr = p.tr.filter(k => k !== 'bp');
  if (over) p.tr.unshift('bp');
}
/* Is the pressure low enough for the thrombolytic right now? A small margin, so the number on the card never disagrees. */
function bpOkForLytic(p) {
  if (p.alert !== 'stroke' || !p.bp0) return true;
  const v = vRaw(p, G.t).v;
  return v.sbp <= LYTIC_BP[0] - 4 && v.dbp <= LYTIC_BP[1] - 3;
}
/* Age the way a chart writes it: months under two years, "5 yo F" for a child, "72M" for everyone else. "2M" reads as two months. */
function ageSex(p) {
  if (p.age < 2) return `${p.age * 12 + 1 + Math.floor(vhash(p.id + 'mo') * 11)} mo ${p.sex}`;
  return p.age < 13 ? `${p.age} yo ${p.sex}` : `${p.age}${p.sex}`;
}
/* Nothing by mouth: headed for the OR or the cath lab, a surgical or GI problem, a stroke before a swallow screen, or a mask on the face. */
function npo(p) {
  return ['or', 'cath'].includes(p.dispo) || ['surg', 'trauma', 'gi'].includes(p.con) || p.alert === 'stroke' || ['gastro', 'dka', 'appy', 'chole', 'gib'].includes(p.ck)
    || ['bipap', 'intub', 'vent'].some(k => p.treat[k]);
}
/* Gray-zone patients: a validated risk score, the usual right call, and calls that are also defensible. */
function grayScore(c) {
  const g = (tool, score, band, right, ok) => ({ tool, short: { 'HEART score': 'HEART', 'Canadian Syncope Risk Score': 'CSRS', 'ABCD2 score': 'ABCD2', 'CURB-65': 'CURB-65' }[tool], score, band, right, ok: ok || [] });
  if (c.gray === 'pna') { const s = chance(0.7) ? randi(0, 1) : 2; return s <= 1 ? g('CURB-65', s, 'low', 'home') : g('CURB-65', s, 'moderate', 'obs', ['admit']); }   // v0.26: confusion, BUN, breathing rate, blood pressure, age 65 or more
  if (c.gray === 'chest') { const s = c.k === 'cpmod' ? randi(4, 6) : randi(1, 3); return s <= 3 ? g('HEART score', s, 'low', 'home') : g('HEART score', s, 'moderate', 'obs', ['admit']); }
  if (c.gray === 'syncope') {
    if (c.k !== 'synchigh') return g('Canadian Syncope Risk Score', randi(-2, 0), 'low', 'home');
    const s = randi(4, 7); return s <= 5 ? g('Canadian Syncope Risk Score', s, 'high', 'obs', ['admit']) : g('Canadian Syncope Risk Score', s, 'very high', 'admit', ['obs']);
  }
  if (c.gray === 'tia') { const s = randi(2, 6); return s <= 3 ? g('ABCD2 score', s, 'low', 'home') : s <= 5 ? g('ABCD2 score', s, 'moderate', 'obs', ['admit']) : g('ABCD2 score', s, 'high', 'admit', ['obs']); }
  return null;
}
const vEsi = p => (p.esiT != null ? p.esiT : p.esi);
const regQuick = p => ['quick', 'fq', 'fdoing', 'done'].includes(p.reg);
const BOARD_ST = ['board', 'callrep', 'reporting', 'bedready', 'xportq', 'obsq'];
const isBoarder = p => BOARD_ST.includes(p.dsp);
// own: the attending player's responsibility. In physician mode, M&M only lists those.
function mm(sev, what, why, own) { if (G.pre || (G.mode === 'md' && !own)) return; G.stats.mm.push({ sev, t: G.t, what, why }); }
function unitName() { return (chance(0.85) ? 'Medic ' : 'Ambulance ') + randi(2, 49); }
function onArrive(p) {
  if (!G.pre) { G.stats.arrived++; if (p.lang) G.stats.lep++; hooks.arrive(p); }
  if (p.ecg10 && !p.work.ecg) p.work.ecg = { st: 'todo', tOrd: G.t };
  p.patience = p.esi >= 5 ? randi(80, 150) : p.esi === 4 ? randi(110, 190) : p.esi === 3 ? randi(150, 250) : 1e9;
}
function arrivals() { arrivals0(); }
/* Each arrival takes exactly one number from the arrival stream and builds the patient from its own sub-stream, so a
   diverted ambulance (built, then sent elsewhere) leaves the next arrival unchanged. */
function sub(fn) { const s = (rnd() * 2147483647) | 0 || 1, keep = G.rng; G.rng = s; try { fn(); } finally { G.rng = keep; } }
function arrivals0() {
  const L = LEVELS[G.level], t = G.t, hm = hourMul(t);
  let guard = 0;
  inStream('rngA', () => { while (t >= G.nextArr.walk && guard++ < 5) { sub(spawnWalk); G.nextArr.walk += expo(60 / (L.walk * (wxOf().walk || 1) * hm)); } });
  const surge = (G.mods.surge > t ? 1.6 : 1) * (1 + 0.12 * G.region.hosps.filter(h => h.st !== 'open').length);
  guard = 0;
  inStream('rngM', () => { while (t >= G.nextArr.ems && guard++ < 5) { sub(spawnEms); G.nextArr.ems += expo(60 / (L.ems * hm)); } });
  // a surge (neighbors on alert, a surge event) brings extra ambulances on their own stream, on top of the scheduled ones
  const extra = surge - 1;
  if (extra > 0.01) inStream('rngS', () => {
    const gap = () => expo(60 / (L.ems * hm * extra));
    if (G.nextArr.surge == null) G.nextArr.surge = t + gap();
    guard = 0; while (t >= G.nextArr.surge && guard++ < 5) { sub(() => spawnEms(true)); G.nextArr.surge += gap(); }
  });
  else G.nextArr.surge = null;
  if (!G.pre) { guard = 0; inStream('rngL', () => { while (t >= G.nextArr.alert && guard++ < 3) { sub(spawnAlert); G.nextArr.alert += expo(60 / (L.alerts * hm)); } }); }
}
function diverted(c) {
  if (G.pre) return null;
  for (const k in DIVERTS) if (G.dv[k].on && DIVERTS[k].takes(c) && chance(DIVERTS[k].rate)) return k;
  return null;
}
const outActive = k => !!G.out[k] && G.out[k].until > G.t;
function justified(k) {
  for (const o in G.out) if (outActive(o) && (OUTAGES[o].fix === k || (k === 'ct' && o === 'power'))) return true;
  return false;
}
function outLogFor(o) { for (let i = G.stats.outLog.length - 1; i >= 0; i--) if (G.stats.outLog[i].k === o) return G.stats.outLog[i]; return null; }
function outageMiss(c, p) {
  if (G.pre) return;
  for (const o in G.out) {
    const O = OUTAGES[o];
    if (!outActive(o) || !O.hits(c) || G.dv[O.fix].on) continue;
    care(-15, 'divert'); G.stats.outMiss++; p.outHit = o;
    const log = outLogFor(o); if (log) log.misses++;
    mm(45, `${p.unit} brought ${p.alertOn ? 'a ' + ALERTS[p.alert].name + ' alert' : 'a critical patient'} while ${O.during}`, `${DIVERTS[O.fix].name} was off`);
    toast(`${p.unit} brought ${p.alertOn ? 'a ' + ALERTS[p.alert].name + ' alert' : 'a critical patient'} here while ${O.during}. ${DIVERTS[O.fix].name} would have sent them where they can be treated.`, 'bad');
    return;
  }
}
function startOutage(k) {
  const O = OUTAGES[k], until = G.t + randi(O.mins[0], O.mins[1]);
  G.out[k] = { t0: G.t, until, credited: false };
  G.stats.outLog.push({ k, t0: G.t, t1: until, divertAt: null, misses: 0, after: 0 });
  if (k === 'ct' || k === 'power') G.img.ct.down = Math.max(G.img.ct.down, until);
  if (k === 'power') { G.mods.lab = Math.max(G.mods.lab, until); G.mods.ehr = Math.max(G.mods.ehr, until); }
  toast(`${O.msg} Expected back in about ${Math.round(until - G.t)} min.`, 'alert'); sound('alarm');
  if (G.dv[O.fix].on) creditDivert(O.fix);
}
function outageTick() {
  for (const o in G.out) {
    if (G.out[o].until > G.t) continue;
    const O = OUTAGES[o], on = G.dv[O.fix].on;
    delete G.out[o];
    toast(`${O.name}: fixed.${on && !justified(O.fix) && G.mode !== 'md' ? ` Lift ${DIVERTS[O.fix].name}.` : ''}`, 'good');
  }
}
function creditDivert(kind) {
  for (const o in G.out) {
    const O = OUTAGES[o], st = G.out[o];
    if (O.fix !== kind || st.credited || !outActive(o)) continue;
    st.credited = true;
    const log = outLogFor(o); if (log) log.divertAt = G.t;
    const fast = G.t - st.t0 <= 10;
    if (!G.pre) { care(fast ? 20 : 8, 'divert'); G.stats.outRight++; }
    note(`${DIVERTS[kind].name} for ${O.during}: right call${fast ? ', and fast' : ''}`, 'good');
  }
}
function spawnWalk() {
  const p = makePatient(pickCase(['w', 'b'], 'walk'), 'walk'); p.sched = true;   // a scheduled arrival (not a return or an event)
  p.loc = 'triage'; p.tArrive = G.t; G.triageQ.push(p.id); onArrive(p);
}
function spawnEms(extra) {
  const c = pickCase(['e', 'b'], extra ? 'surge' : 'ems');
  const dk = diverted(c);
  if (dk) { G.stats.diverted++; if (!extra) (G.divLog = G.divLog || []).push(c.k + '@' + Math.round(G.t)); note(`An ambulance went elsewhere (${DIVERTS[dk].name}): ${c.cc}`); return; }
  const p = makePatient(c, 'ems'); p.sched = !extra;
  p.unit = unitName(); p.loc = 'wall'; p.tArrive = G.t; onArrive(p);
  outageMiss(c, p);
  note(`${p.unit} at the bay: ${ageSex(p)}, ${p.cc}`);
}
function spawnAlert() {
  const c = pickCase(['a'], 'alert');
  const dk = diverted(c);
  if (dk) { G.stats.diverted++; note(`A ${ALERTS[c.alert].name} alert went elsewhere (${DIVERTS[dk].name})`); return; }
  const p = makePatient(c, 'ems');
  p.unit = unitName(); p.loc = 'enroute'; p.eta = G.t + randi(7, 12); p.alertOn = true; p.dxK = true;
  outageMiss(c, p);
  G.enroute.push(p.id);
  G.box.q.push({ kind: 'notify', pid: p.id, unit: p.unit, id: ++G.box.seq });
}
function enrouteTick() {
  if (!G.enroute.length) return;
  G.enroute = G.enroute.filter(id => {
    const p = pt(id);
    if (G.t < p.eta) return true;
    p.loc = 'wall'; p.tArrive = G.t; onArrive(p);
    const b = G.box;
    if (b.cur && b.cur.pid === p.id) { b.cur = null; missNotify(p); }
    else { const i = b.q.findIndex(x => x.pid === p.id); if (i >= 0) { b.q.splice(i, 1); missNotify(p); } }
    if (p.pren && ALERTS[p.alert].auto) autoConsult(p);
    toast(`${ALERTS[p.alert].name} alert at the bay. ${p.unit}: ${ageSex(p)}, ${p.cc}`, 'alert');
    sound('siren');
    return false;
  });
}
function autoConsult(p) {
  if (!p.con || p.consult.st !== 'none') return;
  p.consult = { st: 'req', spec: p.con, due: G.t + (p.alert === 'trauma' ? randi(4, 9) : randi(6, 12)) + (p.con === 'trauma' && outActive('or') ? 30 : 0), t0: G.t, auto: true };
}

/* ---------- placement ---------- */
/* v0.20: bed first. A patient sick enough for a bed now (an alert, ESI 1 or 2 by triage, or one who looks that sick at the
   door or on the wall before anyone has triaged them) can go straight to a room. Registration is still needed: the
   player sends a registrar to the bedside, and nobody can be discharged, admitted or transferred until it is done. */
function sickEnough(p) { return emergent(p) || (p.tri === 'done' ? vEsi(p) <= 2 : p.esi <= 2); }
const looksSick = p => (p.loc === 'triage' || p.loc === 'wall') && p.tri !== 'done' && p.esi <= 2;
function canPlace(p, r) {
  if (!p) return { ok: false, why: 'Pick a patient first' };
  if (!r) return { ok: false, why: 'Pick a room' };
  if (r.pid === p.id) return { ok: false, why: 'Already in that room' };
  if ((p.loc === 'wall' || p.loc === 'triage') && !sickEnough(p)) {
    if (!regQuick(p)) return { ok: false, why: 'Register them first' };
    if (p.tri !== 'done') return { ok: false, why: p.loc === 'wall' ? 'A nurse has to take report and triage first' : 'Triage them first' };
  }
  if (r.closed) return { ok: false, why: `${roomName(r.id)} is closed` };
  if (r.pid) return { ok: false, why: `${roomName(r.id)} is occupied` };
  if (r.st === 'dirty') return { ok: false, why: `${roomName(r.id)} is dirty. Tap it to send EVS.` };
  if (r.st === 'cleaning') return { ok: false, why: `EVS is still cleaning ${roomName(r.id)}` };
  if (p.esi === 1 && r.kind !== 'resus' && !p.anyRoom && !(p.dsp === 'watch' || p.dsp === 'ready' || p.dsp === 'dc')) return { ok: false, why: 'ESI 1 needs a resus bay' };   // once treated and only being watched, they can step down
  if (p.iso === 'air' && !r.iso) return { ok: false, why: 'Airborne isolation needs Room 8 or 16 (negative pressure)' };
  if (r.kind === 'chair') {
    if (p.iso || p.sitter) return { ok: false, why: 'Isolation and safety patients need a room' };
    if (isBoarder(p) || p.dsp === 'decide') return { ok: false, why: 'Admitted patients need a bed, not a chair' };
    const leaving = p.dsp === 'ready' || p.dsp === 'dc' || p.dsp === 'watch' || RIDE.has(p.dsp);
    if (vEsi(p) <= 2 && !leaving) return { ok: false, why: 'Chairs are for ESI 3 to 5, or patients being discharged' };
    if (!(p.ev === 'done' || p.pitSeen || leaving)) return { ok: false, why: 'Chairs are for patients a provider has already seen' };
  }
  if (r.kind === 'ft' && vEsi(p) < 4) return { ok: false, why: 'Fast Track only takes ESI 4 and 5' };
  if (r.kind === 'hall' && vEsi(p) < 3) return { ok: false, why: 'No ESI 1 or 2 in the hallway' };
  if (r.kind === 'hall' && p.iso) return { ok: false, why: 'Isolation patients need a room with a door' };
  return { ok: true };
}
function emergent(p) { return p.alertOn || p.esi === 1 || p.crash || p.arrest; }
function bedsideTriage(p) {
  const i = G.triageQ.indexOf(p.id); if (i >= 0) G.triageQ.splice(i, 1);
  for (const s of G.staff) { if (s.task && s.task.kind === 'triage' && s.task.pid === p.id) s.task = null; if (s.tq.length) s.tq = s.tq.filter(k => k.pid !== p.id); }
  p.triaging = false; if (p.tTriage == null) p.tTriage = G.t;
  if (p.tri !== 'done') { p.tri = 'done'; p.triBy = null; }
  callWalkinAlert(p);
}
function callWalkinAlert(p) {
  if (!p.alert || p.alertOn) return;
  p.alertOn = true; p.dxK = true; p.pren = true;
  if (ALERTS[p.alert].auto) autoConsult(p);
  toast(`Triage called a ${ALERTS[p.alert].name} alert: ${ageSex(p)}, ${p.cc}`, 'alert');
  sound('siren');
}
function place(pid, rid) {
  const p = pt(pid), r = room(rid);
  if (!p || !(p.loc === 'wall' || p.loc === 'waiting' || p.loc === 'triage')) return { ok: false, why: 'That patient isn’t waiting for a bed' };
  const c = canPlace(p, r); if (!c.ok) return c;
  if (p.loc === 'triage' || p.tri !== 'done') bedsideTriage(p);
  if (p.loc === 'wall') { p.tWall = G.t - p.tArrive; wallMM(p); }
  p.loc = 'room'; p.room = r.id; r.pid = p.id; r.st = 'occ';
  if (p.tRoom == null) p.tRoom = G.t;
  if (p.rn === 'none') p.rn = 'todo';
  if (p.arrest && r.kind === 'resus') goalHit(p, 'resus5');
  if (p.sitter && r.safe && p.sitBy) releaseSitter(p);
  const unreg = p.reg === 'none' && !emergent(p);   // alerts and codes were always roomed first, and a registrar comes on their own
  if (unreg) { p.bedFirst = true; if (!G.pre) G.stats.bedFirst = (G.stats.bedFirst || 0) + 1; }
  return { ok: true, msg: `${p.name} to ${roomName(r.id)}${unreg ? '. Send a registrar to the room.' : ''}` };
}
function move(pid, rid) {
  const p = pt(pid), r = room(rid);
  if (!p || p.loc !== 'room') return { ok: false, why: 'That patient isn’t in a room' };
  const c = canPlace(p, r); if (!c.ok) return c;
  const old = roomOf(p);
  old.pid = null; old.st = old.kind === 'chair' ? 'clean' : 'dirty'; old.dirt = p.iso ? 'term' : 'std';
  p.room = r.id; r.pid = p.id; r.st = 'occ';
  if (r.kind === 'chair' && !G.pre) G.stats.chairMoves++;
  if (p.sitter && r.safe && p.sitBy) releaseSitter(p);
  if (p.arrest && r.kind === 'resus') goalHit(p, 'resus5');
  return { ok: true, msg: `${p.name} moved to ${roomName(r.id)}.${old.kind === 'chair' ? '' : ` ${roomName(old.id)} needs cleaning.`}` };
}
function wallMM(p) {
  if (p.tWall <= 45) return;
  const triWait = Math.round((p.tTriage != null ? p.tTriage : G.t) - p.tArrive);
  mm(30 + Math.min(30, (p.tWall - 45) / 2), `${p.unit} waited ${Math.round(p.tWall)} min to hand off ${p.name}`, triWait > 20 ? `Nobody took report for ${triWait} min` : `No bed for ${Math.round(p.tWall)} min`);
}
function releaseSitter(p) {
  const s = staff(p.sitBy);
  if (s && s.task && s.task.kind === 'sit' && s.task.pid === p.id) s.task = null;
  p.sitBy = null;
}

/* ---------- EVS ---------- */
function evsTap(rid) {
  const r = room(rid);
  if (!r || r.st !== 'dirty') return { ok: false, why: 'That room isn’t dirty' };
  const i = G.evsQ.indexOf(rid);
  if (i === 0) return { ok: true, msg: `${roomName(rid)} is already next for EVS` };
  if (i > 0) { G.evsQ.splice(i, 1); G.evsQ.unshift(rid); return { ok: true, msg: `${roomName(rid)} moved to the front of the EVS line` }; }
  G.evsQ.push(rid);
  const free = G.staff.some(s => s.role === 'evs' && s.st === 'on' && !s.task);
  return { ok: true, msg: free && G.evsQ.length === 1 ? `EVS is headed to ${roomName(rid)}` : `${roomName(rid)} is #${G.evsQ.length} in the EVS line` };
}
function evsTick(dt) {
  for (const s of G.staff) {
    if (s.role !== 'evs' || s.st !== 'on') continue;
    if (s.task) {
      s.task.left -= dt;
      if (s.task.left <= 0) { const r = room(s.task.room); s.task = null; s.done++; if (r && r.st === 'cleaning') { r.st = 'clean'; r.dirt = 'std'; } }
      continue;
    }
    while (G.evsQ.length) {
      const rid = G.evsQ.shift(), r = room(rid);
      if (!r || r.st !== 'dirty') continue;
      const dur = r.dirt === 'term' ? 16 : 8;
      r.st = 'cleaning'; s.task = { kind: 'clean', room: rid, left: dur, dur, t0: G.t };
      break;
    }
  }
}

/* ---------- providers ---------- */
function needsProv(p) {
  return !!p && p.loc === 'room' && (p.ev === 'none' || p.re === 'need' || p.tr.some(k => TREAT[k].by === 'prov' && p.treat[k] && p.treat[k].st === 'todo'));
}
function canAssign(s, p) {
  if (!s || !isProv(s)) return { ok: false, why: 'Pick a provider' };
  if (!p) return { ok: false, why: 'Pick a patient' };
  if (!present(s)) return { ok: false, why: `${s.name} isn’t here` };
  if (s.pit) return { ok: false, why: `${s.name} is stationed in triage. Bring them back from their card first.` };
  if (p.loc !== 'room') return { ok: false, why: 'Put the patient in a room first' };
  if (s.role === 'app' && (vEsi(p) <= 1 || p.esi <= 1) && !(p.anyRoom && !p.arrest && !p.crash)) return { ok: false, why: 'ESI 1 needs an attending' };   // an ESI 1 that needs one treatment now (an overdose, BiPAP, epinephrine) may go to a PA or NP, with a co-sign
  if (s.role === 'app' && p.tr.some(k => TREAT[k].md && (!p.treat[k] || p.treat[k].st !== 'done'))) return { ok: false, why: `${p.tr.filter(k => TREAT[k].md).map(k => TREAT[k].label).join(', ')} needs an attending` };
  if (p.prov === s.id && !needsProv(p)) return { ok: false, why: `Already ${s.short}'s patient` };
  if (p.prov && p.prov !== s.id) { const o = staff(p.prov); if (o && o.q.some(k => k.pid === p.id && k.started)) return { ok: false, why: `${o.name} is with this patient right now` }; }
  return { ok: true };
}
function unassign(p) {
  const o = staff(p.prov); if (!o) return;
  o.q = o.q.filter(k => {
    if (k.pid !== p.id || k.started) return true;
    if (k.type === 'eval' || k.type === 'code') p.ev = 'none';
    if (k.type === 'reassess') p.re = 'need';
    if (k.type === 'proc' && p.treat[k.key]) p.treat[k.key].st = 'todo';
    return false;
  });
}
function assign(sid, pid) {
  const s = staff(sid), p = pt(pid);
  const c = canAssign(s, p); if (!c.ok) return c;
  if (p.prov && p.prov !== sid) unassign(p);
  p.prov = sid;
  if (G.mode === 'md' && sid === G.me && !p.mine) {
    p.mine = true;
    if (!G.pre) { G.stats.md.seen++; care(5, 'md'); if (vEsi(p) <= 2 && p.tRoom != null && G.t - p.tRoom <= 10) { G.stats.md.fast++; care(5, 'md'); } }
  }
  if (p.ev === 'none') {
    p.ev = 'q';
    const dur = (p.pitSeen ? 5 : s.role === 'md' ? 9 : 11) * langMul(p);
    addTask(s, p.arrest ? { type: 'code', pid, dur: 15, label: 'Code' } : { type: 'eval', pid, dur, label: 'Eval' });
  }
  if (p.re === 'need') { p.re = 'q'; addTask(s, { type: 'reassess', pid, dur: 3 * langMul(p), label: 'Recheck' }); }
  queueProcs(p);
  return { ok: true, msg: G.mode === 'md' && sid === G.me ? `You picked up ${label(p)}` : `${s.name} has ${label(p)}` };
}
function taskPr(k) {
  if (k.type === 'box') return -100;
  if (k.type === 'code') return -90;
  if (k.type === 'talk') return -50;
  if (k.type === 'cosign') return -40;
  const p = pt(k.pid); if (!p) return 999;
  return (p.alertOn ? 0 : 10) + p.esi * 10 + (p.stat ? -15 : 0) + (p.vip ? -4 : 0) + (k.type === 'reassess' ? 2 : k.type === 'proc' ? 4 : 0);
}
function qRank(k) { return (k.type === 'box' || k.type === 'code') ? 0 : k.started ? 1 : 2; }
function sortQ(s) { for (const k of s.q) if (!k.started) k.pr = taskPr(k); s.q.sort((a, b) => qRank(a) - qRank(b) || a.pr - b.pr || a.id - b.id); }
function addTask(s, k) { k.id = G.tid++; k.left = k.dur; k.started = false; k.pr = taskPr(k); s.q.push(k); sortQ(s); }
function queueProcs(p) {
  const s = staff(p.prov); if (!s || !isProv(s) || !present(s)) return;
  for (const k of p.tr) {
    const it = p.treat[k];
    if (TREAT[k].by === 'prov' && it && it.st === 'todo' && !(TREAT[k].md && s.role !== 'md')) { it.st = 'q'; addTask(s, { type: 'proc', pid: p.id, key: k, dur: TREAT[k].dur, label: TREAT[k].label }); }
  }
}
function provSpeed(s) { let m = 1; if (G.mods.ehr > G.t) m /= 1.35; if (s.morale < 30) m /= 1.25; return m; }
function taskOk(k) {
  if (k.type === 'box') return true;
  const p = pt(k.pid);
  if (!p) return false;
  if (k.type === 'pit' || k.type === 'pitdc') return p.loc === 'waiting';
  if (p.loc !== 'room') return false;
  if (k.type === 'proc') return !!p.treat[k.key] && (p.treat[k.key].st === 'q' || p.treat[k.key].st === 'doing');
  if (k.type === 'cosign') return p.cosign === 'need';
  return true;
}
function provTick(dt) {
  for (const s of G.staff) {
    if (!isProv(s) || s.st !== 'on') continue;
    while (s.q.length && !taskOk(s.q[0])) { const k = s.q.shift(); if (k.type === 'pit') { const p = pt(k.pid); if (p) p.pitQ = false; } }
    if (!s.q.length && s.pit) { const k = pitNext(s); if (k) addTask(s, k); }
    const k = s.q[0]; if (!k) continue;
    if (!k.started) { k.started = true; taskStart(s, k); }
    k.left -= dt * provSpeed(s);
    if (k.left <= 0) { s.q.shift(); s.done++; taskDone(s, k); }
  }
}
function taskStart(s, k) {
  const p = k.pid ? pt(k.pid) : null;
  if (k.type === 'eval' || k.type === 'code') {
    p.ev = 'doing'; if (p.tProv == null) p.tProv = G.t; if (k.type === 'code') codeTeam(p);
    const waiting = s.q.filter(x => !x.started && x.type !== 'box').length;
    if (!G.train && k.type === 'eval' && waiting >= 3 && chance(Math.min(0.15, 0.03 * (waiting - 2)))) { p.missedDx = { by: s.short, n: waiting + 1 }; if (!G.pre) G.stats.missedDx++; }
  }
  else if (k.type === 'reassess') p.re = 'doing';
  else if (k.type === 'proc') {
    p.treat[k.key].st = 'doing';
    if (TREAT[k.key].rt) {
      let rt = G.staff.find(x => x.role === 'rt' && x.st === 'on' && !x.task);
      if (!rt) {
        rt = G.staff.find(x => x.role === 'rt' && x.st === 'on' && x.task && x.task.kind === 'rt' && x.task.key !== 'vent');
        if (rt) { const q = pt(rt.task.pid), it = q && q.treat[rt.task.key]; if (it && it.st === 'doing') it.st = 'todo'; note(`RT ${rt.name} left a ${TREAT[rt.task.key].label.toLowerCase()} to help intubate in ${label(p)}`); rt.task = null; }
      }
      if (rt) rt.task = { kind: 'airway', pid: p.id, left: k.dur, dur: k.dur, t0: G.t };
      else { k.left *= 1.75; k.dur *= 1.75; if (!G.pre) G.stats.intubNoRT++; mm(25, `${label(p)} was intubated without an RT`, 'Both RTs were tied up or away'); note(`No RT free for the intubation in ${label(p)}. ${s.short} goes without one, and it takes longer.`, 'bad'); }
    }
  }
  else if (k.type === 'pit') { if (p.tProv == null) p.tProv = G.t; }
}
function taskDone(s, k) {
  const p = k.pid ? pt(k.pid) : null;
  if (k.type === 'eval') {
    p.ev = 'done';
    if (mdMine(p)) awaitOrders(p);
    else { orders(p); if (p.pitSeen && !p.dxK && allWorkDone(p)) p.dxK = true; }
    revealEsi(p, `${s.short}'s exam`);
    if (s.role === 'app' && p.esi <= 2) needCosign(p);
  }
  else if (k.type === 'cosign') { p.cosign = 'done'; if (!G.pre) G.stats.cosign++; }
  else if (k.type === 'code') { p.ev = 'done'; codeOutcome(p); }
  else if (k.type === 'reassess') {
    if (mdMine(p) && workGap(p)) return;
    p.re = 'done';
    if (needsDx(p)) { dxAsk(p); treatGap(p); return; }   // v0.28: the attending names it; untreated harm keeps counting meanwhile
    p.dxK = true; note(`${label(p)}: ${p.dx}`);
    if (mdMine(p)) treatGap(p);
  }
  else if (k.type === 'proc') { p.treat[k.key].st = 'done'; p.treat[k.key].tDone = G.t; harmCheck(p, k.key); if (k.key === 'intub') { if (!G.pre) G.stats.intub++; if (p.treat.vent) openGate(p.treat.vent, 'vent'); } }
  else if (k.type === 'box' && G.mode !== 'md') autoDirection(s);
  else if (k.type === 'pit') pitDone(s, p);
  else if (k.type === 'pitdc') { if (p.loc === 'waiting') { G.stats.pitDc++; note(`${s.short} discharged ${p.name} from triage`); leave(p, 'dc'); } }
}
/* ---------- physician mode: the player writes the orders ---------- */
// What the attending finds at the bedside, one line per case. Shown on the card after the exam.
const EXAM = {
  rash: 'Red, itchy patches where a new watch band sits. Lips and throat aren’t swollen.',
  refill: 'Feels fine. Blood pressure a little high. No headache, no chest pain.',
  otitis: 'Red, bulging eardrum. No swelling behind the ear.',
  dental: 'Swollen gum beside a broken molar. Mouth opens fully. Swallows fine.',
  strep: 'Red throat, white patches on the tonsils, tender neck glands. No cough.',
  ankle: 'Swollen outer ankle, tender on the bone. Limps.',
  lac: 'A 3 cm clean cut on the palm. Fingers move and feel normal.',
  uti: 'Tender low over the bladder. No flank pain. No fever.',
  gastro: 'Soft belly, mildly tender all over. Dry mouth. No guarding.',
  appy: 'Tender in the right lower belly. Worse when you let go.',
  chole: 'Tender under the right ribs. The breath catches when you press there.',
  hipfx: 'Leg shortened and turned outward. Cannot lift it. Foot pulse is good. Tripped on a rug. Did not pass out.',
  pna: 'Crackles at the right base. Breathing fast. Looks tired.',
  pnalow: 'Crackles at the right base. Talking in full sentences, alert, eating and drinking.',
  flu: 'Feverish and achy, dry cough. Lungs clear. Drinking fine.',
  copd: 'Wheezing, long breath out, neck muscles working. Drowsy.',
  chf: 'Crackles halfway up both lungs. Swollen legs. Neck veins up.',
  stone: 'Cannot hold still. Tender in the flank. Belly soft.',
  dvt: 'One calf swollen, warm, and tender. Breathing is easy.',
  migraine: 'Light hurts. Neck moves freely. Strength, speech, and vision normal. Feels like past migraines.',
  tb: 'Thin. Crackles at the top of one lung. Blood-streaked sputum.',
  bh: 'Tearful and cooperative. No injuries. Vital signs normal.',
  etoh: 'Smells of alcohol. Slurred speech. Wakes to voice. No head injury found.',
  od: 'Slow, shallow breathing. Pinpoint pupils. Wakes to a firm rub, then drifts off.',
  cell: 'Red, hot, swollen shin with spreading edges. Fever. Three days of pills failed. No pus pocket.',
  syncope: 'Fainted after standing a long time and felt it coming. Heart and nerve exam normal.',
  synchigh: 'Passed out with no warning. Heart sounds normal. Nerve exam normal.',
  tia: 'Strength, speech, and face are normal now. The numbness lasted 20 minutes.',
  dehyd: 'Dry mouth. Dizzy on standing, and the pulse jumps. Belly soft.',
  cpmod: 'Pain free now. Lungs clear. Has diabetes and high blood pressure.',
  cwp: 'Sharp pain, worse when you press on the chest wall. Lungs clear.',
  nstemi: 'Pale and sweating. The pressure spreads to the left arm. Lungs clear.',
  afib: 'Fast, irregular pulse. Lungs clear. Blood pressure holding.',
  chb: 'Very slow pulse. Pale. Lightheaded sitting up. Lungs clear.',
  gib: 'Pale. Fast pulse. Tender high in the middle of the belly.',
  dka: 'Deep, fast breathing. Fruity breath. Very dry mouth.',
  asthma: 'Wheezing on both sides. Speaks in short phrases. Chest muscles working.',
  anaph: 'Hives, swollen lips, hoarse voice, wheezing.',
  sepsisw: 'Hot and confused. Fast pulse. Tender over the bladder.',
  strokew: 'One side of the face droops. Slurred speech. One arm drifts down.',
  stemi: 'Gray, sweating, clutching the chest. Lungs clear.',
  stroke: 'Right arm and leg don’t move. Right face droops. Speech is hard to follow.',
  lvo: 'Eyes pulled to one side. No speech. One side doesn’t move.',
  mvc: 'Pale, cold skin. Belly hard and tender on the left. Fast, weak pulse.',
  tfall: 'Bruise over the temple. Getting sleepier. One pupil larger than the other.',
  moto: 'Thigh bent, bone through the skin. Foot pulse weak. Pale.',
  arrest: 'No pulse. CPR in progress.',
  shock: 'Hot, mottled skin. Confused. Fast, weak pulse.',
  rsv: 'Ribs pulling in, nose flaring, grunting. Feeding poorly.',
  burn: 'Soot in the nose and mouth. Hoarse voice. Blistered burns on the arms and chest.',
  mcired: 'Belly rigid, tender under the right ribs. Pale and cold.',
  mciyel: 'Thigh swollen and bent. Skin intact. Foot pulse good.',
  mcimin: 'Tender on the bones in the middle of the neck. Arms and legs strong.',
  mcigrn: 'Shallow cuts on the forearm. Bruised shoulder that moves fully.',
  mciwr: 'Swollen, tender wrist with a bend near the thumb side. Fingers move and feel normal.',
};
// Why the right order set is the right one, one line per case. Shown once the diagnosis is known and on the shift report.
const ORD_WHY = {
  rash: 'No tests. A contact rash gets a steroid cream and an antihistamine.',
  refill: 'Nothing to order. No symptoms: the refill is written at discharge.',
  otitis: 'No tests. You can see the infection. Amoxicillin.',
  dental: 'No tests. An antibiotic and pain control, then a dentist.',
  strep: 'A rapid strep swab proves it. Then penicillin.',
  ankle: 'Tender on the bone means an X-ray. No fracture: ibuprofen and home.',
  lac: 'No tests. Clean it and stitch it.',
  uti: 'A urine test confirms it. Then an antibiotic. No scan without flank pain or fever.',
  gastro: 'Labs check for dehydration. Fluids and nausea medication. A soft belly needs no CT.',
  appy: 'Labs and a CT find the appendix. Pain control, then General Surgery. Antibiotics are reasonable.',
  chole: 'Ultrasound first, not CT. Labs show infection and the liver. Pain control, then General Surgery. Antibiotics are reasonable.',
  hipfx: 'X-ray shows the break. Labs get the patient ready for surgery; an ECG is reasonable. Pain control, then Orthopedics.',
  pna: 'Chest X-ray finds it. Labs show how sick. Oxygen for the low level, and antibiotics.',
  flu: 'A respiratory swab confirms flu. Fever medicine and fluids at home. Mask and an isolation room while they are here.',
  pnalow: 'Chest X-ray finds it. The BUN from the labs feeds the CURB-65 score. Antibiotics; most go home on pills.',
  copd: 'X-ray rules out pneumonia. A blood gas shows CO2 building up. Breathing treatments and BiPAP. A steroid is reasonable.',
  chf: 'ECG looks for a heart attack as the cause. X-ray shows the fluid. Labs check the heart and kidneys. BiPAP, nitroglycerin, and a water pill.',
  stone: 'Urine shows blood. A CT finds the stone. Ketorolac for the pain, and fluids.',
  dvt: 'Ultrasound finds the clot. Labs check the kidneys. Then a blood thinner.',
  migraine: 'No tests. A usual migraine with a normal nerve exam gets fluids and medication.',
  tb: 'Chest X-ray and labs. Isolate first. Treatment starts upstairs.',
  bh: 'Labs look for a medical cause. Then Psychiatry.',
  etoh: 'Labs check the alcohol level and the sugar. Fluids and time. A CT only with a head injury.',
  od: 'Naloxone first. Labs after. Then watch: naloxone wears off before the opioid does.',
  cell: 'Labs show how sick. Pills failed, so antibiotics by vein. No scan without a pus pocket.',
  syncope: 'Every faint gets an ECG. Labs look for anemia or a salt problem. Both normal, with a warning beforehand: home.',
  synchigh: 'Every faint gets an ECG. Labs look for another cause. A new block with no warning is the heart until proven otherwise: observe.',
  tia: 'CT rules out a bleed. ECG looks for A-fib. Labs check the sugar. Observe: stroke risk is highest in the first two days. Aspirin is reasonable.',
  dehyd: 'Labs show the kidneys are dry. Fluids fix it.',
  cpmod: 'ECG, troponin, and a chest X-ray. Aspirin. The risk factors earn a second troponin in observation.',
  cwp: 'ECG, troponin, and a chest X-ray: all normal. Pain you can press on is the chest wall. Ibuprofen and home.',
  nstemi: 'ECG and troponin make the diagnosis. Aspirin and heparin. Cardiology. A chest X-ray is reasonable.',
  afib: 'ECG names the rhythm. Labs look for a cause. Diltiazem slows the rate. Cardiology.',
  chb: 'ECG shows the block. Labs check the potassium. Pace now. Cardiology.',
  gib: 'Labs with a blood type. Fluids, then blood. GI for a scope.',
  dka: 'Labs show the sugar, the acid, and the potassium. Fluids first. Insulin once the potassium is known. ICU.',
  asthma: 'No tests. Breathing treatments and a steroid. Then watch that the wheezing stays away.',
  anaph: 'No tests. Epinephrine first. Then an antihistamine and a steroid. Then watch: the reaction can come back.',
  sepsisw: 'Labs with a lactate. Fluids and antibiotics inside the hour.',
  strokew: 'CT rules out a bleed. Glucose rules out a mimic. Then the clot-busting drug. Neurology. An ECG is reasonable.',
  stroke: 'CT rules out a bleed. Glucose rules out a mimic. Then the clot-busting drug. Neurology. An ECG is reasonable.',
  lvo: 'CT rules out a bleed. A CT angiogram finds the blocked artery. Glucose rules out a mimic. Clot drug, then transfer to a center that pulls clots.',
  stemi: 'The ECG is the diagnosis. Labs go, but don’t wait for the troponin. Aspirin and heparin. Cardiology and the cath lab.',
  mvc: 'X-ray and bedside ultrasound look for blood in the chest and belly. Labs and a blood type. Massive transfusion. CT only if the pressure comes up. If not, the OR.',
  tfall: 'Head CT finds the bleed. Labs with an INR show the blood thinner. Reverse it. Neurosurgery.',
  moto: 'X-ray shows the break. Labs with a blood type. Early antibiotics for bone through skin. Blood. Trauma and the OR.',
  arrest: 'No orders. Run the code.',
  shock: 'Lactate. Oxygen, fluids, antibiotics. A pressor when fluids aren’t enough. ICU.',
  rsv: 'A blood gas shows the baby is tiring. High-flow oxygen. Transfer to a children\'s hospital.',
  burn: 'Secure the airway before it swells shut: intubate, then the ventilator. Labs check for carbon monoxide. Fluids and pain control. Burn center.',
  mcired: 'X-ray and bedside ultrasound look for blood in the chest and belly. Labs and a blood type. Massive transfusion. CT only if the pressure comes up. If not, the OR.',
  mciyel: 'X-ray shows the break. Labs get the patient ready for surgery. Pain control and fluids. Orthopedics.',
  mcimin: 'Tender on the neck bones means a CT. Clean: pain control and home.',
  mcigrn: 'No tests. Clean and close the cuts.',
  mciwr: 'X-ray shows the break. A splint, pain control, and home.',
};
// Test results in plain words. Shown after the result when "Plain words" is on.
const FIND_PLAIN = {
  'Rapid strep positive': 'strep bacteria found', 'No fracture': 'no broken bone', 'Urine: nitrite positive': 'bacteria in the urine',
  'WBC 15.8': 'white cells high: infection or inflammation', 'Appendix 11 mm across, fat stranding around it': 'appendicitis',
  'WBC 13.1, liver tests up': 'white cells high; the liver is irritated', 'Gallstones, thick gallbladder wall': 'an inflamed gallbladder',
  'Femoral neck fracture': 'a broken hip', 'Hgb 11.9': 'blood count a little low', 'WBC 17.2': 'white cells high: infection',
  'Right lower lobe infiltrate': 'pneumonia low in the right lung', 'WBC 13.1': 'white cells a little high: infection', 'Flu A positive': 'the flu virus', 'Small right lower lobe infiltrate': 'a small pneumonia low in the right lung', 'Hyperinflated, no pneumonia': 'over-full lungs, no infection',
  'VBG pCO2 58': 'CO2 building up: not breathing enough out', 'Sinus tach, old Q waves': 'fast and regular; a scar from an old heart attack',
  'Pulmonary edema': 'fluid in the lungs', 'BNP 2,400': 'heart strain marker very high', '4 mm ureteral stone': 'a small stone; most pass on their own',
  'Femoral vein clot': 'a clot in the big thigh vein', 'Cavity in the upper lobe': 'a hole in the lung: classic for TB', 'WBC 11.4': 'white cells a little high',
  'Labs normal': 'no medical cause found', 'Ethanol 280, glucose normal': 'very drunk; sugar is fine', 'Fentanyl positive': 'an opioid, confirmed',
  'WBC 14.0': 'white cells high: infection', 'Normal sinus rhythm': 'a normal heartbeat', 'New bundle branch block': 'a new fault in the heart\'s wiring',
  'No acute findings': 'nothing new or dangerous', 'BUN 34, creatinine 1.4': 'the kidneys are dry', 'Nonspecific ST changes': 'not normal, not a clear heart attack',
  'First troponin negative': 'no heart damage yet; it gets repeated', 'Troponin negative': 'no heart damage so far', 'ST depression V4–V6': 'heart muscle short of blood',
  'Troponin elevated': 'heart muscle damage', 'Irregularly irregular, no P waves, rate 152': 'a fast, irregular heartbeat', 'P waves march through, unrelated to the QRS; rate 38': 'top and bottom of the heart out of step; very slow',
  'Potassium 4.4, troponin negative': 'potassium normal; no heart damage', 'Hemoglobin 6.8': 'blood count dangerously low', 'Glucose 540, anion gap 26, potassium 4.8': 'sugar very high; acid in the blood; potassium safe for insulin', 'Sinus tachycardia, T waves normal': 'fast and regular; no sign of high potassium',
  'Lactate 3.1, urine positive': 'organs short of oxygen; infection in the urine', 'No bleed': 'no bleeding in the brain',
  'Glucose 118': 'sugar isn’t the cause', 'Glucose 132': 'sugar isn’t the cause', 'Glucose 141': 'sugar isn’t the cause',
  'ST elevation V1–V4': 'a heart attack at the front of the heart', 'Troponin pending': 'not back yet; don’t wait for it',
  'No bleed; CTA shows M1 occlusion': 'no bleeding; a big brain artery is blocked', 'No pneumothorax, FAST positive': 'lungs are up; blood in the belly',
  'Hemoglobin 8.1': 'blood count low and falling', 'Hemoglobin 7.9': 'blood count low and falling', 'Grade IV splenic laceration': 'a deep tear in the spleen',
  'A crescent of fresh blood over the left brain, 8 mm, slight shift': 'bleeding on the surface of the brain', 'INR 2.9': 'thin blood: it clots slowly', 'Open femur fracture': 'a broken thigh bone, through the skin',
  'Hemoglobin 9.4': 'blood count low', 'Lactate 5.4': 'organs badly short of oxygen', 'VBG pCO2 61': 'CO2 building up: tiring out',
  'Carboxyhemoglobin 6%': 'some carbon monoxide from the smoke', 'Grade IV liver laceration': 'a deep tear in the liver', 'Midshaft femur fracture': 'a broken thigh bone',
  'Hemoglobin 11.2': 'blood count a little low', 'No acute injury': 'no injury seen', 'Distal radius fracture': 'a broken wrist',
};
// Radio calls in plain words: [what they are asking, the plain reason]. Same order as the calls in SCEN.
const RADIO_PLAIN = {
  national: [
    ['Chest pain with a low blood pressure. They want a drug that lowers pressure.', 'The pressure is already too low. Nitroglycerin drops it further.'],
    ['Chest pain. He took an erection drug yesterday. They want nitroglycerin.', 'The two drugs together can crash the blood pressure.'],
    ['No heartbeat after 25 minutes of full effort. They ask to stop.', 'A flat line that long, with everything tried, almost never comes back.'],
    ['A clear-headed adult with a hurt ankle doesn’t want to go. They ask if he can refuse.', 'An adult who understands the risk can say no.'],
    ['His sugar is dangerously low and he is confused. He says no. They ask if he can refuse.', 'A brain without sugar can’t make the decision. Fix the sugar first.'],
    ['A child is still seizing after one dose up the nose. No IV. They want a second dose.', 'A seizure this long has to stop. Repeat the dose and watch the breathing.'],
    ['A broken thigh bone, still in severe pain. Vital signs fine. They want more pain medication.', 'Stable and still hurting: treat the pain.'],
    ['Signs of a big stroke, 45 minutes old. They want to drive 12 more minutes to a center that removes clots.', 'A big clot needs a center that can pull it out. The extra minutes are worth it.'],
    ['A dialysis patient missed two sessions. The heart tracing shows high potassium. They want two drugs for it.', 'High potassium can stop the heart. Calcium shields it. Albuterol lowers the potassium.'],
    ['A severe allergic reaction. Still wheezing, pressure still low, 5 minutes after an epinephrine shot. They want a second shot.', 'Still wheezing with a low pressure: give epinephrine again.'],
    ['Drunk, with a head cut after a fall. He wants to go home. They ask if he can refuse.', 'Alcohol plus a head injury: he can’t judge the risk.'],
    ['A very slow heart and a low pressure. The first drug failed. They want to pace the heart from outside.', 'Too slow to hold a pressure, and the drug failed: pace.'],
    ['A very fast, regular heartbeat. Pressure fine. Simple maneuvers failed. They want the drug that resets it.', 'Adenosine resets this rhythm. It’s the next step.'],
    ['Heart failure with fluid in the lungs and a very high pressure. They want a pressure mask and nitroglycerin, which lowers pressure.', 'A pressure mask and nitroglycerin push the fluid back and ease the heart.'],
  ],
  miemss: [
    ['A broken thigh bone, still 9 out of 10 after two doses. Vital signs fine. They want a third dose.', 'Stable and still hurting: approve the third dose.'],
    ['Chest pain after three nitroglycerin doses. Pressure still high. They want a fourth.', 'The pressure can take another dose, and the pain is still there.'],
    ['Her pressure fell a lot after one nitroglycerin. They want a second.', 'A big drop after one dose warns of a bigger drop after the next.'],
    ['Tearing chest pain into the back. The two arms have different pressures. Very high pressure. They want a drug to lower it.', 'This looks like a tear in the body\'s main artery. Lowering the pressure protects it.'],
    ['A stroke patient whose pressure is still very high after two doses. They want the next dose.', 'Still over the limit: approve the dose. The aim is a little lower, not normal.'],
    ['A stroke patient with a low pressure. They want fluid.', 'A brain short of blood needs pressure. Give the fluid.'],
    ['Wildly agitated, overheated, fighting restraints. One sedative given. They want a second kind.', 'Heat plus a fight against restraints can kill. Sedate, cool, and watch his breathing.'],
    ['She hit her head, passed out, and repeats herself. She wants to go home. They ask if she can refuse.', 'Repeating questions means her brain isn’t working right. She can’t refuse.'],
    ['A 16-year-old with a hurt ankle. No parent can be reached. They ask if he can refuse.', 'A minor can’t refuse on his own.'],
    ['A 4-year-old with a racing heart and poor color. The drug failed. They want to shock the rhythm.', 'Poor blood flow and a failed drug: shock.'],
    ['His heart restarted after an arrest. The tracing shows a heart attack. They want a hospital with a cath lab.', 'A blocked artery likely caused the arrest. A cath lab opens it.'],
    ['Heart failure, but the tracing shows a heart attack on the right side. They want nitroglycerin.', 'A right-sided heart attack needs its filling pressure. Nitroglycerin takes that away.'],
    ['Tongue and lip swelling from a blood pressure pill, and her voice is changing. Epinephrine didn’t work. They want TXA.', 'This swelling isn’t an allergy, so epinephrine often fails. TXA may help. Watch the airway.'],
    ['Severe alcohol withdrawal, still shaking and seeing things after three doses. They want a fourth.', 'Untreated, this leads to seizures. Approve another dose.'],
    ['A crew on scene with a heart attack patient. They want the nearest place, a small ED with no cath lab.', 'A heart attack needs a cath lab. Drive the extra 13 minutes.'],
    ['A diabetic child, sugar still low and still drowsy after one dose of sugar. They want a second dose.', 'Still low and still drowsy: give sugar again.'],
    ['A baby with croup: noisy breathing at rest, ribs pulling in. They want epinephrine mist.', 'Noisy breathing at rest means a tight airway. Epinephrine mist opens it.'],
    ['Severe infection, pressure still low after a full fluid load. Lungs clear. They want more fluid.', 'Clear lungs can take one more bolus. A pressure this low also needs a pressor.'],
  ],
};
const DX_PLAIN = {
  'Contact dermatitis': 'A skin reaction to something touched', 'Medication refill': 'Ran out of a regular medicine', 'Dental abscess': 'A pocket of infection at a tooth', 'Strep throat': 'A bacterial throat infection',
  'Ankle sprain': 'Stretched ligaments, no break', 'Simple laceration': 'A cut that needs stitches', 'Urinary tract infection': 'A bladder infection', 'Gastroenteritis': 'A stomach bug',
  'Appendicitis': 'An inflamed appendix. It comes out in surgery', 'Cholecystitis': 'An inflamed gallbladder', 'Hip fracture': 'A broken hip. It needs surgery', 'Influenza': 'The flu: a virus. Most people get better at home', 'Pneumonia, low risk': 'A lung infection mild enough to treat at home with pills', 'Pneumonia': 'A lung infection',
  'COPD flare': 'Lungs damaged by smoking, flaring up', 'Heart failure flare': 'A weak heart, with fluid backing up into the lungs', 'Kidney stone': 'A small stone stuck on its way out of the kidney',
  'Deep vein thrombosis': 'A blood clot in a leg vein', 'Migraine': 'A severe headache that comes in attacks', 'Suspected tuberculosis': 'A lung infection that spreads through the air',
  'Behavioral health emergency': 'A mental health crisis', 'Alcohol intoxication': 'Drunk, and watched until sober', 'Opioid overdose': 'Too much of an opioid. It slows the breathing', 'Cellulitis': 'A skin infection',
  'Syncope, low risk': 'Fainting, with nothing worrying found', 'Syncope, high risk': 'Fainting that may come from the heart', 'Transient ischemic attack': 'A stroke that cleared on its own. A warning',
  'Dehydration': 'Low on fluids', 'Chest pain, moderate risk': 'No heart attack found yet, but not in the clear', 'Chest pain, low risk': 'Not the heart, as far as the tests can tell',
  'NSTEMI (heart attack)': 'A heart attack with the artery partly blocked', 'A-fib with rapid rate': 'An irregular, racing heartbeat', 'Complete heart block': 'The heart’s wiring has failed. It beats too slowly',
  'Upper GI bleed': 'Bleeding in the stomach or gullet', 'Diabetic ketoacidosis': 'No insulin, so the blood turns acid', 'Asthma attack': 'Airways squeezed tight', 'Anaphylaxis': 'A severe allergic reaction',
  'Sepsis (urinary source)': 'A urine infection, and the body is overreacting to it', 'Acute ischemic stroke': 'A clot blocking a blood vessel in the brain', 'Anterior STEMI': 'A heart attack: an artery fully blocked',
  'Large vessel occlusion stroke': 'A clot in a main brain artery. Some centers can pull it out', 'Splenic laceration, hemorrhagic shock': 'A torn spleen, bleeding into the belly',
  'Subdural hematoma': 'Bleeding between the skull and the brain', 'Open femur fracture': 'A broken thigh bone, through the skin', 'Cardiac arrest': 'The heart has stopped', 'Septic shock': 'An infection that has dropped the blood pressure',
  'RSV, tiring out': 'A virus clogging a baby’s small airways', 'Partial-thickness burns, 25%, airway injury': 'Deep burns over a quarter of the body, and a burned airway',
  'Liver laceration, hemorrhagic shock': 'A torn liver, bleeding into the belly', 'Closed femur fracture': 'A broken thigh bone', 'Neck strain': 'A pulled neck muscle, no break', 'Wrist fracture': 'A broken wrist',
  'NSTEMI with cardiogenic shock': 'A heart attack, and the heart is failing to pump', 'A-fib with rapid rate, unstable': 'A racing heartbeat that is dropping the pressure', 'Complete heart block, unstable': 'A heart too slow to hold a pressure',
  'Upper GI bleed with hemorrhagic shock': 'Stomach bleeding, with too little blood left', 'Severe diabetic ketoacidosis': 'No insulin, and the blood is dangerously acid', 'Asthma attack with respiratory failure': 'Airways so tight the breathing is failing',
  'COPD flare with respiratory failure': 'Damaged lungs that can no longer keep up', 'Flash pulmonary edema': 'The lungs suddenly filling with fluid', 'Opioid overdose: the naloxone wore off': 'The opioid outlasted the drug that reversed it',
  'Anaphylactic shock': 'An allergic reaction that has dropped the blood pressure', 'Septic shock (urinary source)': 'A bladder infection that has dropped the blood pressure', 'Acute ischemic stroke, getting worse': 'A brain clot, and more brain is being lost',
  'Femur fracture with hemorrhagic shock': 'A broken thigh bone, bleeding heavily', 'ROSC after cardiac arrest': 'The heart is beating again after it stopped', 'Resuscitation unsuccessful': 'The team couldn’t restart the heart',
};
const WK_NAME = { ecg: 'ECG', lab: 'Labs', xr: 'X-ray', ct: 'CT', us: 'Ultrasound', mri: 'MRI' };
const NORMAL = { ecg: 'Normal sinus rhythm', lab: 'Normal', xr: 'No acute findings', ct: 'No acute findings', us: 'Normal', mri: 'No acute findings' };
const DISPO_NAME = { home: 'discharge home', admit: 'admission', icu: 'the ICU', or: 'the OR', cath: 'the cath lab', bh: 'psychiatric admission', transfer: 'a transfer', obs: 'observation' };
// What the drug in "Medications" was, for each case that needs one.
const RX = { refill: 'a dose of the usual pill', tia: 'aspirin', copd: 'a steroid', moto: 'pain control', rash: 'an antihistamine and steroid cream', otitis: 'amoxicillin', dental: 'an antibiotic and pain control', strep: 'penicillin', ankle: 'ibuprofen', uti: 'an antibiotic for the UTI',
  gastro: 'ondansetron', appy: 'pain control', chole: 'pain control', hipfx: 'pain control', chf: 'nitroglycerin and a diuretic', stone: 'ketorolac', dvt: 'an anticoagulant', migraine: 'prochlorperazine and diphenhydramine',
  cwp: 'ibuprofen', cpmod: 'aspirin', nstemi: 'aspirin and heparin', afib: 'diltiazem', asthma: 'a steroid', anaph: 'an antihistamine and a steroid', stemi: 'aspirin and heparin', burn: 'pain control', mcimin: 'pain control', mciyel: 'pain control', mciwr: 'a splint and pain control', vip: 'meclizine' };
const rxName = p => { const L = (RXOK[p.ck] || {}).meds, got = (p.drugs || []).find(d => L ? L.includes(d) : DRUGS[d] && DRUGS[d].tx.includes('meds')); return got ? DRUGS[got].n.toLowerCase() : RX[p.ck] || 'symptom treatment'; };
// An order with no indication can hurt someone: [chance, points, what happened].
const HARM = { cardiovert: [0.3, 15, 'was shocked without needing it'], tnk: [0.5, 50, 'bled after a thrombolytic they didn’t need'], insulin: [0.5, 25, 'dropped their blood sugar on an insulin drip they didn’t need'],
  epi: [0.35, 20, 'went into a fast rhythm from epinephrine they didn’t need'], intub: [0.3, 25, 'had a complication from an intubation they didn’t need'],
  blood: [0.15, 15, 'reacted to blood they didn’t need'], nalox: [0.3, 8, 'went into withdrawal from naloxone they didn’t need'], bipap: [0.1, 5, 'vomited on BiPAP they didn’t need'],
  pressor: [0.25, 15, 'had a dangerous spike in blood pressure from a vasopressor they didn’t need'], reverse: [0.15, 20, 'had a clot from a reversal agent they didn’t need'],
  bp: [0.25, 12, 'dropped their blood pressure on a drug they didn’t need'], pace: [0.2, 8, 'was paced without needing it'] };
function awaitOrders(p) {
  if (!p.right) {
    const N = needOf(p), kinds = new Set(N.n.map(DET_KIND));
    if (p.wk.includes('ecg')) kinds.add('ecg');
    p.right = { wk: Array.from(kinds), tr: p.tr.filter(k => k !== 'vent'), ok: ((CASES.find(c => c.k === p.ck) || {}).ok || []).slice(), det: N.n, detOk: N.ok };
  }
  p.det = p.det || [];
  p.wk = p.wk.filter(k => p.work[k]);          // anything triage already started stays (an ECG for chest pain)
  p.tr = p.tr.filter(k => p.treat[k] || (k === 'mtp' && p.bb && p.bb.mtp));
  p.ord = 'need';
  if (!G.pre) note(`${label(p)}: you've seen them. Write orders.`);
}
/* What the right order set still lacks, by the names on the order sheet. Medications names its drug. */
const andList = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const trName = (p, k) => { const left = reqLeft(p, k); if (left && left.length) return `${k === 'meds' ? 'Medications' : TREAT[k].label} (${andList(left.map(g => DRUGS[g[0]].n.toLowerCase()))})`; return k === 'meds' ? `Medications (${rxName(p)})` : TREAT[k].label; };
/* Named tests still missing (the ECG counts as one). Old saves without named tests fall back to kinds. */
const detMiss = p => { const R = p.right; if (!R) return []; if (!R.det) return R.wk.filter(k => !p.wk.includes(k)); return (R.wk.includes('ecg') && !p.wk.includes('ecg') ? ['ecg'] : []).concat(R.det.filter(d => !(p.det || []).includes(d))); };
function missNow(p, testsOnly) { const R = p.right; return R ? detMiss(p).map(DET_NAME).concat(testsOnly ? [] : R.tr.filter(k => !p.tr.includes(k)).map(k => trName(p, k))) : []; }
function signOrders(pid, tests, treats) {
  const p = pt(pid);
  if (!p || !mdMine(p)) return { ok: false, why: 'That isn’t your patient' };
  if (p.ev !== 'done') return { ok: false, why: 'See the patient first' };
  const R = p.right, S = G.stats.md, first = p.ord === 'need';
  if (!R.det) { R.det = needOf(p).n; R.detOk = needOf(p).ok; }
  p.det = p.det || [];
  // tests: named tests (cbc, ctap) from the order sheet; a kind (lab, ct) means its usual tests for this case
  const want = [];
  for (const k of tests || []) {
    if (k === 'ecg' || LABS[k] || IMGS[k]) want.push(k);
    else if (WORK[k]) { const mine2 = R.det.filter(d => DET_KIND(d) === k); want.push(...(mine2.length ? mine2 : DEFAULT_DET[k] || [])); }
  }
  const newT = Array.from(new Set(want)).filter(k => (k === 'ecg' ? !p.wk.includes('ecg') : !p.det.includes(k)));
  // v0.28: drugs and procedures resolve to treatments. The right drug fills the need; a wrong one is wasted and counted.
  const drugX = [], drugOk = [], contraX = [];
  p.drugs = p.drugs || [];
  const tk = [];
  for (const k of treats || []) {
    if (PROC[k]) { if (p.drugs.includes(k)) continue; p.drugs.push(k); if (p.tr.includes(PROC[k].tx)) drugOk.push(PROC[k].n); else tk.push(PROC[k].tx); continue; }
    if (!DRUGS[k]) { tk.push(k); continue; }
    if (p.drugs.includes(k)) continue;
    p.drugs.push(k);
    if (contraOf(p).includes(k)) { contraX.push(k); continue; }   // v0.29.1: harm, counted once (not also a wrong drug and an extra)
    const D = DRUGS[k];
    { const t = D.tx.find(t => reqOf(p, t) && R.tr.includes(t) && reqOf(p, t).some(g => g.includes(k)));   // one part of a combination
      if (t) { const g = reqOf(p, t), i = g.findIndex(x => x.includes(k)); p.rxg = p.rxg || {}; const got = p.rxg[t] = p.rxg[t] || []; if (!got.includes(i)) got.push(i);
        if (got.length >= g.length && !p.tr.includes(t) && !tk.includes(t)) tk.push(t); else drugOk.push(D.n); continue; } }
    if ((ALSO[p.ck] || []).includes(k)) { drugOk.push(D.n); continue; }
    const need = D.tx.find(t => R.tr.includes(t) && !p.tr.includes(t) && !tk.includes(t) && rxOk(p, t, k));
    if (need) { tk.push(need); continue; }
    const wrong = D.tx.find(t => R.tr.includes(t) && !rxOk(p, t, k));
    const fine = D.tx.find(t => (R.tr.includes(t) && rxOk(p, t, k)) || ((R.ok || []).includes(t) && ((RXOK[p.ck] || {})[t] || []).includes(k)));
    if (fine) { drugOk.push(D.n); continue; }
    // v0.29.1: standard care is not scored as wrong (contraindicated drugs never get here)
    if (NEVER_WRONG.has(k)) { drugOk.push(D.n); continue; }
    if (wrong && sameClassAlt(p, k, wrong)) { drugOk.push(D.n + ' (works, but not the first choice)'); G.stats.md.altDrug = (G.stats.md.altDrug || 0) + 1; continue; }
    if (wrong) { drugX.push(D.n + ' (wrong drug)'); G.stats.md.wrongDrug = (G.stats.md.wrongDrug || 0) + 1; continue; }
    if ((R.ok || []).includes(D.tx[0])) { drugX.push(D.n); continue; }   // a reasonable treatment, but not with this drug
    tk.push(D.tx[0]); if (TREAT[D.tx[0]] && p.tr.includes(D.tx[0])) drugX.push(D.n);
  }
  const newR = Array.from(new Set(tk)).filter(k => TREAT[k] && k !== 'vent' && !p.tr.includes(k));
  if (!newT.length && !newR.length && !drugX.length && !drugOk.length && !contraX.length && !(first && !detMiss(p).length && !R.tr.length)) return { ok: false, why: 'Pick at least one order' };
  let pts = 0, extra = 0;
  const xl = [], fl = [], OKL = R.ok || [], OKD = R.detOk || [];   // fl: reasonable orders. Not required, not counted against you.
  for (const nm of drugX) { pts -= 3; extra++; S.ordExtra++; xl.push(nm); }
  for (const k of contraX) { S.harm++; care(-20, 'harm', p); litAdd(10, `given ${DRUGS[k].n.toLowerCase()}, which can hurt them`, p); mm(55, `${p.name} was given ${DRUGS[k].n.toLowerCase()}`, 'A drug that can hurt this patient', true); toast(`${DRUGS[k].n} can hurt ${p.name}: ${p.dx.toLowerCase()}.`, 'bad'); }
  fl.push(...drugOk);
  for (const k of newT) {
    const kind = DET_KIND(k), nm = DET_NAME(k);
    if (k !== 'ecg') { p.det.push(k); const r = detResult(p, k); (p.dres = p.dres || {})[k] = r; }
    if (!p.wk.includes(kind)) p.wk.push(kind);
    else if (p.work[kind] && p.work[kind].st !== 'todo') delete p.work[kind];   // more of a kind after the first draw or scan: another one
    const need = k === 'ecg' ? R.wk.includes('ecg') : R.det.includes(k);
    const fine = k === 'ecg' ? OKL.includes('ecg') : OKD.includes(k) || (k === 'hcg' && p.sex === 'F' && p.age >= 12 && p.age <= 55);
    if (need) { pts += DET_RIGHT[kind] || 1; S.ordRight++; }
    else if (fine) { fl.push(nm); if (!p.find[kind]) p.find[kind] = NORMAL[kind]; }
    else { pts -= DET_EXTRA[kind] || 2; extra++; S.ordExtra++; xl.push(nm); if (!p.find[kind]) p.find[kind] = NORMAL[kind]; }
  }
  for (const k of newR) {
    if (k === 'mtp') { const r = activateMTP(p.id); if (!r.ok && p.bleed !== 'mtp') { pts -= 3; extra++; S.ordExtra++; xl.push(TREAT[k].label); continue; } }
    p.tr.push(k);
    if (k === 'intub' && !p.tr.includes('vent')) p.tr.push('vent');
    if (R.tr.includes(k)) { pts += 3; S.ordRight++; }
    else if (k === 'o2' && vitalsOf(p).spo2 < 94) { /* a low sat gets oxygen: never wrong, even when something else will fix it */ }
    else if (treatOkNow(p, k)) { fl.push(trName(p, k)); }   // v0.29.1: tenecteplase for a PE whose pressure has fallen
    else if (OKL.includes(k)) { fl.push(trName(p, k)); }
    else { pts -= 3; extra++; S.ordExtra++; xl.push(TREAT[k].label); (p.extraTr = p.extraTr || []).push(k); if (k === 'blood' && !p.bb) p.bb = { st: 'xm', due: G.t + 30 }; }
  }
  let held = '';
  if (newR.includes('tnk') && R.tr.includes('tnk') && !p.tr.includes('bp') && !bpOkForLytic(p)) {   // the nurse will not push it over the limit
    const v = vitalsOf(p); pts -= 8; S.lyticHigh = (S.lyticHigh || 0) + 1;
    held = ` The nurse is holding the thrombolytic: ${v.sbp}/${v.dbp} is over ${LYTIC_BP[0]}/${LYTIC_BP[1]}. Order blood pressure control.`;
    note(`${label(p)}: thrombolytic ordered with the pressure over ${LYTIC_BP[0]}/${LYTIC_BP[1]}. The nurse is holding it.`, 'bad');
  }
  if (first) {
    const miss = detMiss(p).length + R.tr.filter(k => !p.tr.includes(k)).length;
    S.ordMiss += miss;
    if (!miss && !extra) { pts += 10; S.clean++; }
    p.ordLog = { name: p.name, dx: p.dx, miss: missNow(p), extra: xl.slice(), fine: fl.slice(), why: ORD_WHY[p.ck] || '' };
    if (p.ordLog.miss.length || xl.length) (S.log = S.log || []).push(p.ordLog);
  } else if (p.ordLog) {
    if (xl.length && !p.ordLog.miss.length && !p.ordLog.extra.length) (S.log = S.log || []).push(p.ordLog);
    p.ordLog.extra.push(...xl); p.ordLog.fine.push(...fl);
    p.ordLog.miss = missNow(p);   // what is still missing, for the hint and the report
  }
  care(pts, 'orders', p);
  p.ord = 'signed';
  orders(p);
  if (p.dxK) { if (!workGap(p)) treatGap(p); }   // field diagnoses (alerts) are known already, so gaps show now
  else if (!p.wk.length && !R.wk.length) { if (needsDx(p)) { dxAsk(p); treatGap(p); } else { p.dxK = true; note(`${label(p)}: ${p.dx}`); treatGap(p); } }
  else if (!p.wk.length) workGap(p);
  if (p.txGap) p.txGap = R.tr.filter(k => !p.tr.includes(k));
  if (p.txGap && !p.txGap.length) p.txGap = null;
  if (newT.length && (p.dsp === 'mddecide' || p.dsp === 'decide')) p.dsp = 'none';
  const n = newT.length + newR.length;
  if (newT.some(k => DET_KIND(k) === 'mri')) note(`${label(p)}: MRI ordered. It takes about an hour, and the patient leaves the department for it.`);
  return { ok: true, msg: `${n} order${n === 1 ? '' : 's'} signed for ${label(p)}${newR.includes('meds') ? ` (${rxName(p)})` : ''}${held ? '.' + held : ''}`, held: !!held };
}
// A workup that is missing a test the plan needs: the diagnosis waits until it's ordered.
function workGap(p) {
  const miss = detMiss(p);
  if (!miss.length) return false;
  p.re = 'none'; p.ord = 'more';
  if (!G.pre) { G.stats.md.gaps++; care(-5 * miss.length, 'orders', p); note(`${label(p)}: the workup isn't complete. Something the plan needs is missing.`, 'bad'); }
  return true;
}
function treatGap(p) {
  const gap = p.right.tr.filter(k => !p.tr.includes(k));
  if (gap.length) { p.txGap = gap; p.tGap = G.t; if (!G.pre) note(`${label(p)} isn't improving. Something isn't treated.`, 'bad'); }
}
function harmCheck(p, k) {
  if (!mdMine(p) || !p.extraTr || !p.extraTr.includes(k) || G.pre || p.arrest) return;   // audit R6-03: epinephrine in cardiac arrest is the treatment, never harm
  const h = HARM[k]; if (!h || !chance(h[0])) return;
  G.stats.md.harm++; care(-h[1], 'harm', p); litAdd(10, `harmed by ${TREAT[k].label.toLowerCase()} without an indication`, p);
  mm(55, `${p.name} ${h[2]}`, `${TREAT[k].label} was ordered without an indication`, true);
  toast(`${p.name} ${h[2]}.`, 'bad'); sound('bad');
}
/* The disposition call, once the diagnosis is in. Consults go through consult(). */
function mdDecide(pid, pick) {
  const p = pt(pid);
  if (!p || !mdMine(p) || p.dsp !== 'mddecide') return { ok: false, why: 'There’s no decision waiting for this patient' };
  let want = p.dispo; const S = G.stats.md;
  if (pick === 'home') {
    if (want === 'home') { S.dispoRight++; care(12, 'dispo', p); }
    else { S.dispoWrong++; care(-25, 'dispo', p); p.wrongHome = want; litAdd(MUST.has(p.ck) ? 10 : 5, `sent home when they needed ${DISPO_NAME[want] || 'admission'}`, p); mm(65, `${p.name} went home with ${(/^[A-Z][a-z]/.test(p.dx) ? p.dx.charAt(0).toLowerCase() + p.dx.slice(1) : p.dx)}`, `They needed ${DISPO_NAME[want] || 'admission'}`, true); }
    p.mdPick = 'home'; p.dispo = 'home'; p.dsp = 'none';
    return { ok: true, msg: `${label(p)} is going home once treatment is done.` };
  }
  if (pick === 'transfer') {
    if (want === 'icu' && G.beds && G.beds.icu.used >= UNITS.icu.cap) { p.txNeed = 'icu'; p.needCC = true; p.txTo = 'a hospital with an open ICU bed'; p.dispo = 'transfer'; want = 'transfer'; }   // v0.26: no ICU bed here, so they can't stay
    if (want !== 'transfer') { S.dispoWrong++; care(-10, 'dispo', p); return { ok: false, why: `The receiving hospital declined: ${p.name} can be cared for here.` }; }
    S.dispoRight++; care(12, 'dispo', p); p.mdPick = 'transfer'; p.dsp = 'readytx';
    return { ok: true, msg: `Transfer to ${p.txTo}. Find a hospital that can take them.` };
  }
  return { ok: false, why: 'Pick home, a consult, or a transfer' };
}
/* Charge-nurse mode: the attending who takes a medical-direction call handles it. */
function autoDirection(s) {
  const c = G.box.cur; if (!c || c.kind !== 'consult' || c.taken !== s.id) return;
  G.box.cur = null; G.stats.boxC.ans++;
  if (chance(s.morale < 30 ? 0.75 : 0.93)) G.stats.boxC.right++; else G.stats.boxC.wrong++;
  note(`${s.name} finished medical direction with ${c.unit}`);
}
/* Physician mode: the computer runs the charge nurse's side of the board. */
function aiTick() {
  const o = G.train ? { budget: 6, prov: false, divert: false, breaks: false, updates: false, recheck: false, chairs: false, fcp: false, zones: false, pit: false }
    : { budget: 4, acc: 0.85, breaks: true, pit: true, interp: 0.8 };
  botStep(o);
}
function aiCard() {
  const c = G.card, ch = c.choices.find(x => !x.dis) || c.choices[0];
  note(`Charge nurse · ${c.title}: ${ch.label}`);
  chooseCard(ch.k);
}
function needCosign(p) {
  const md = G.staff.filter(x => x.role === 'md' && x.st === 'on').sort((a, b) => a.q.length - b.q.length)[0];
  if (md) { p.cosign = 'need'; addTask(md, { type: 'cosign', pid: p.id, dur: 2, label: 'Co-sign' }); }
  else p.cosign = 'wait';
}
function revealEsi(p, how) {
  if (p.esiT == null || p.esiT === p.esi) { p.esiT = null; return; }
  const was = p.esiT; p.esiT = null;
  if (!G.pre) G.stats.underCaught++;
  toast(`${how}: ${label(p)} is really ESI ${p.esi}, not ESI ${was}. Under-triaged.`, 'bad');
}
function newTreat(k) { const T = TREAT[k]; return T.gate ? { st: 'wait' } : T.rx ? { st: 'verify' } : { st: 'todo', tOrd: G.t }; }
// Audit phase 1 (R6-01): 4.5 hours have passed and the thrombolytic isn't in. It can't be given now: take it off the orders and the answer key,
// and count the missed window. Thrombectomy selection beyond the window isn't modelled.
function lyticWindowClosed(p) {
  const ordered = p.tr.includes('tnk');
  p.tr = p.tr.filter(k => k !== 'tnk'); delete p.treat.tnk;
  if (p.right) p.right.tr = p.right.tr.filter(k => k !== 'tnk');
  p.lyticLate = true; G.stats.lyticLate = (G.stats.lyticLate || 0) + 1;
  if (p.prov === G.me || p.mine || G.mode !== 'md') {
    mm(45, `${p.name}: the thrombolytic window closed`, ordered ? 'Ordered, but not in within 4.5 hours of last known well' : 'Not given within 4.5 hours of last known well', true);
    note(`${label(p)}: 4.5 hours since last known well. The thrombolytic can't be given now.`, 'bad');
  }
}
function openGate(it, k) { if (it.st !== 'wait') return; if (TREAT[k].rx) it.st = 'verify'; else { it.st = 'todo'; it.tOrd = G.t; } }
function orders(p) {
  for (const w of p.wk) {
    if (!p.work[w]) p.work[w] = { st: 'todo', tOrd: G.t };
    if (WORK[w].by === 'img' && p.work[w].st === 'todo' && !G.img[w].q.includes(p.id)) G.img[w].q.push(p.id);
  }
  for (const k of p.tr) if (!p.treat[k]) p.treat[k] = newTreat(k);
  if (p.treat.intub && p.treat.intub.st !== 'done' && p.treat.vent && p.treat.vent.st !== 'done') p.treat.vent = { st: 'wait' };
  queueProcs(p);
  if (!p.wk.length && !p.dxK && !mdMine(p)) p.dxK = true;   // the attending's diagnosis waits for signed orders and results
}
function codeTeam(p) {
  const rt = G.staff.find(s => s.role === 'rt' && s.st === 'on' && !s.task);
  if (rt) { rt.task = { kind: 'code', pid: p.id, left: 15, dur: 15, t0: G.t }; p.rtCode = true; }
  if (!p.code) codeStart(p);
}
/* Audit phase 1 (R6-04): a cardiac arrest is run the ACLS way (AHA adult cardiac arrest algorithm). The rhythm decides the path:
   VF (shockable): shock, CPR, epinephrine after the second shock, amiodarone after the third. PEA or asystole (not shockable): CPR and
   epinephrine early, then the reversible causes. A traumatic arrest: fix the bleeding and the chest. When the attending runs the code,
   each rhythm check is a card; the answers, the rhythm and the minutes before the team got there set the odds of a pulse coming back.
   The rhythm and the cause come from the patient's id, not the dice, so everyone on a class code sees the same arrest. */
const CODE_WHY = {
  shock: 'VF is shockable: shock as soon as the pads are on, then straight back to 2 minutes of CPR.',
  epiFirst: 'In VF the shock comes first. Epinephrine goes in after the second shock.',
  longCheck: 'A pulse check takes under 10 seconds. Every pause stops blood flow to the brain.',
  syncVf: 'Synchronized cardioversion needs a QRS to time the shock to. VF has none: defibrillate (an unsynchronized shock).',
  shock2: 'Still VF: shock every time, and start epinephrine 1 mg every 3 to 5 minutes.',
  drugNoShock: 'Shock every time the rhythm is VF. Drugs support the shocks; they don\'t replace them.',
  stopTube: 'Keep compressions going. A bag-mask works; a tube can go in without stopping CPR.',
  bicarbAll: 'Bicarbonate is for specific causes (high potassium, some overdoses), not every arrest.',
  amio: 'VF that keeps coming back after shocks: amiodarone 300 mg IV (lidocaine is the other choice). Keep shocking every 2 minutes.',
  adeno: 'Adenosine is for SVT in a patient with a pulse.',
  callEarly: 'Far too early to stop. VF is the rhythm most likely to come back.',
  atropineArr: 'Atropine is for a slow heart with a pulse. It was taken out of the cardiac arrest algorithm in 2010.',
  epiNow: 'Not shockable: CPR, and epinephrine 1 mg IV as soon as possible, then every 3 to 5 minutes.',
  shockPea: 'PEA and asystole are not shockable. A shock only pauses CPR. (A flat line: check the leads and the gain first.)',
  waitRt: 'Compressions start now, with whoever is in the room.',
  hsts: 'PEA usually has a cause. Hunt the H\'s and T\'s: low volume, low oxygen, acid, potassium, cold, tension pneumothorax, tamponade, toxins, clot.',
  noHunt: 'Repeating epinephrine without looking for the cause rarely ends well.',
  shockMaybe: 'Only shock a shockable rhythm. Check it every 2 minutes.',
  amioPea: 'Amiodarone is for VF and pulseless VT, not PEA or asystole.',
  hyperk: 'High potassium in arrest: calcium chloride to protect the heart, and sodium bicarbonate, while CPR goes on.',
  slowK: 'An insulin drip takes too long. In arrest, calcium first.',
  hypox: 'Fix the airway: reposition, a two-person bag-mask, then an advanced airway, all without stopping compressions.',
  stopForTube: 'Stopping compressions to place a tube costs more than it gains.',
  hypovol: 'They bled out slowly: fluids and blood, wide open.',
  tnkWrong: 'A clot buster in a bleeding patient makes it worse.',
  traumaFix: 'A traumatic arrest is fixed by treating the cause: stop the bleeding, give blood, and decompress the chest. Epinephrine and CPR do little without volume.',
  epiOnly: 'In a traumatic arrest, drugs alone don\'t replace lost blood.',
  saline: 'Blood, not liters of saline: saline thins what is left.',
  decomp: 'No pulse after blood: decompress both sides of the chest. A tension pneumothorax is a fast, fixable cause.',
};
const CODE_Q = {
  vf: [
    { t: 'The monitor shows **ventricular fibrillation (VF)**: a shockable rhythm. What first?', c: [['Shock now (defibrillate), then straight back to CPR', 'shock', 1], ['Epinephrine 1 mg first, then shock', 'epiFirst'], ['Stop CPR and feel for a pulse for a full minute', 'longCheck'], ['Synchronized cardioversion', 'syncVf']] },
    { t: 'Two minutes of CPR. Rhythm check: **still VF**.', c: [['Shock again, then epinephrine 1 mg IV every 3 to 5 minutes', 'shock2', 1], ['Amiodarone instead of a second shock', 'drugNoShock'], ['Stop compressions to intubate', 'stopTube'], ['Sodium bicarbonate, as in every arrest', 'bicarbAll']] },
    { t: 'Two more minutes. **Still VF** after two shocks and epinephrine.', c: [['Shock, then amiodarone 300 mg IV', 'amio', 1], ['Adenosine 6 mg rapid push', 'adeno'], ['Call the code: it has been 4 minutes', 'callEarly'], ['Atropine 1 mg IV', 'atropineArr']] },
  ],
  pea: [
    { t: 'The monitor shows **a rhythm but no pulse (PEA)**: not shockable. What first?', c: [['Keep CPR going; epinephrine 1 mg IV now', 'epiNow', 1], ['Shock it', 'shockPea'], ['Atropine 1 mg IV', 'atropineArr'], ['Wait for respiratory therapy before compressions', 'waitRt']] },
    { t: 'Two minutes later, **still no pulse**. What are you hunting for?', c: [['The reversible causes: the H\'s and T\'s', 'hsts', 1], ['Nothing: keep repeating epinephrine', 'noHunt'], ['A shock every 2 minutes in case it turns to VF', 'shockMaybe'], ['Amiodarone 300 mg', 'amioPea']] },
  ],
  asys: [
    { t: 'The monitor shows **a flat line (asystole)**: not shockable. What first?', c: [['Keep CPR going; epinephrine 1 mg IV now', 'epiNow', 1], ['Shock it', 'shockPea'], ['Atropine 1 mg IV', 'atropineArr'], ['Wait for respiratory therapy before compressions', 'waitRt']] },
    { t: 'Two minutes later, **still asystole**. What are you hunting for?', c: [['The reversible causes: the H\'s and T\'s', 'hsts', 1], ['Nothing: keep repeating epinephrine', 'noHunt'], ['A shock every 2 minutes in case it turns to VF', 'shockMaybe'], ['Amiodarone 300 mg', 'amioPea']] },
  ],
  trauma: [
    { t: 'A traumatic arrest after bleeding: **no pulse, PEA** on the monitor. What first?', c: [['Stop the bleeding, give blood fast, decompress the chest', 'traumaFix', 1], ['Epinephrine every 3 minutes and nothing else', 'epiOnly'], ['Shock it', 'shockPea'], ['Normal saline, six liters', 'saline']] },
    { t: 'Two units in, **still no pulse**. Next?', c: [['Decompress both sides of the chest', 'decomp', 1], ['Amiodarone 300 mg', 'amioPea'], ['Synchronized cardioversion', 'syncVf'], ['Sodium bicarbonate, as in every arrest', 'bicarbAll']] },
  ],
};
const CODE_CAUSE = {   // the third rhythm check in PEA or asystole: the cause they find
  k: { t: 'The blood gas is back: **potassium 7.9**.', c: [['Calcium chloride and sodium bicarbonate; keep CPR going', 'hyperk', 1], ['Start an insulin drip and recheck in an hour', 'slowK'], ['Shock it', 'shockPea'], ['Nothing changes: epinephrine only', 'noHunt']] },
  air: { t: 'The bag-mask **isn\'t moving the chest** well.', c: [['Reposition, two-person bag-mask, then an advanced airway, without stopping CPR', 'hypox', 1], ['Stop CPR until the tube is in', 'stopForTube'], ['A double dose of epinephrine', 'noHunt'], ['More sodium bicarbonate', 'bicarbAll']] },
  vol: { t: 'The family says **black stools for days**. Hemoglobin on the gas: 5.', c: [['Fluids and blood, wide open', 'hypovol', 1], ['Tenecteplase', 'tnkWrong'], ['Shock it', 'shockPea'], ['Nothing changes: epinephrine only', 'noHunt']] },
};
const CODE_BASE = { vf: 0.5, pea: 0.25, asys: 0.1, trauma: 0.15 };   // the best odds of a pulse coming back, everything done right and fast
const CODE_NAME = { vf: 'VF', pea: 'PEA', asys: 'asystole', trauma: 'traumatic PEA' };
function codeRhythm(p) {
  if (p.alert === 'trauma' || p.traumatic || p.bleed) return 'trauma';
  if (p.ck === 'arrest') return 'vf';   // the case is written as VF on the monitor
  const h = vhash(p.id + 'rhythm');
  return h < 0.4 ? 'vf' : h < 0.78 ? 'pea' : 'asys';
}
function codeSteps(p) {
  const r = p.code.r, q = CODE_Q[r].slice();
  if (r === 'pea' || r === 'asys') q.push(CODE_CAUSE[['k', 'air', 'vol'][Math.floor(vhash(p.id + 'cause') * 3)]]);
  return q;
}
function codeStart(p) {
  const ref = p.tArrest != null ? p.tArrest : p.tArrive;   // minutes of CPR before a doctor took over: from the arrest, or from the door
  p.code = { r: codeRhythm(p), step: 0, right: 0, n: 0, wait: Math.max(0, Math.round(G.t - ref)), me: G.mode === 'md' && p.prov === G.me && !G.pre && !G.train };
  if (p.code.me) codeCard(p);
}
function codeCard(p) {
  const C = p.code, q = codeSteps(p)[C.step];
  if (!q || G.card) return;
  const order = q.c.map((x, i) => [vhash(p.id + 'cq' + C.step + i), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);   // shuffled, the same for everyone
  setCard('code', `Code blue: ${CODE_NAME[C.r]}`, `${roomName(p.room)} · ${p.name} · rhythm check ${C.step + 1} of ${codeSteps(p).length}`, q.t,
    order.map(i => ({ k: String(i), label: q.c[i][0] })), { pid: p.id, step: C.step });
  G.card.mine = true;
}
function codePick(k, ctx) {
  const p = pt(ctx.pid); if (!p || !p.code || p.code.step !== ctx.step) return;
  const q = codeSteps(p)[ctx.step], ch = q.c[+k]; if (!ch) return;
  const right = q.c.find(x => x[2]);
  p.code.n++; p.code.step++;
  if (ch[2]) { p.code.right++; G.stats.md.codeRight = (G.stats.md.codeRight || 0) + 1; care(4, 'md', p); toast(`Right. ${CODE_WHY[ch[1]]}`, 'good'); }
  else {
    G.stats.md.codeWrong = (G.stats.md.codeWrong || 0) + 1; care(-4, 'md', p);
    mm(40, `Code for ${p.name}: ${ch[0].toLowerCase()}`, `${CODE_WHY[ch[1]]} The call: ${right[0].toLowerCase()}.`, true);
    toast(`Not this one. ${CODE_WHY[ch[1]]}`, 'bad');
  }
  if (p.code.step < codeSteps(p).length) codeCard(p);
}
function codeOutcome(p) {
  if (!p.code) codeStart(p);
  const C = p.code, n = codeSteps(p).length;
  const q = C.me ? C.right / n : 0.85;   // a doctor run by the game knows the algorithm, mostly
  const late = Math.min(0.7, Math.max(0, C.wait - 3) * 0.05);   // each minute without a team after the first three costs 5% of the odds
  let odds = CODE_BASE[C.r] * (0.35 + 0.65 * q) * (1 - late);
  if (p.rtCode) odds += 0.05;
  if (chance(odds)) {
    p.arrest = false; p.dx = 'ROSC after cardiac arrest'; p.dxK = true; p.con = 'icu'; p.pre = []; p.need = null; p.dispo = 'icu';
    p.consult = { st: 'none', spec: null, due: 0 };
    const tubed = p.treat.intub && p.treat.intub.st === 'done';
    for (const k of ['intub', 'vent']) if (!p.tr.includes(k)) p.tr.push(k);
    if (!tubed) p.treat.intub = newTreat('intub');
    p.treat.vent = tubed ? newTreat('vent') : { st: 'wait' }; queueProcs(p);
    if (mdMine(p)) { p.ord = 'signed'; p.right = { wk: p.wk.slice(), tr: ['intub'] }; p.txGap = null; }   // post-arrest orders are standard; the ICU call is yours
    if (!G.pre) { G.stats.rosc++; care(30, 'flow', p); }
    toast(`ROSC in ${roomName(p.room)}! Intubate (attending and RT), then the vent. Get Critical Care down here.`, 'good'); sound('good');
  } else {
    p.arrest = false; p.dx = 'Resuscitation unsuccessful'; p.dxK = true; p.dsp = 'family'; p.due = G.t + 15;
    if (C.me && !G.pre) mm(30, `${p.name} died after a ${CODE_NAME[C.r]} arrest`, `${C.right} of ${n} rhythm checks right; the team got there ${C.wait} min after the arrest`, true);
    toast(`Code called at ${clock()} in ${roomName(p.room)}. The chaplain is with the family.`, 'info');
  }
}
/* Audit phase 1 (R5-02): nobody ran the code. After 20 minutes of CPR with no doctor, the patient is pronounced dead, and it counts. */
const ARREST_NO_TEAM = 20;
function arrestNoTeam(p) {
  if (!p.arrest || p.ev === 'doing' || p.code) return;
  const ref = p.tArrest != null ? p.tArrest : p.tArrive;
  if (ref == null || G.t < ref || G.t - ref < ARREST_NO_TEAM) return;
  for (const s of G.staff) if (s.q) s.q = s.q.filter(k => k.pid !== p.id || k.started);
  p.arrest = false; p.ev = 'done'; p.dx = 'Died in cardiac arrest: no code team'; p.dxK = true;
  mm(90, `${p.name} died in cardiac arrest with no code team`, `${ARREST_NO_TEAM} minutes of CPR and no doctor ever ran the code`, true);
  if (!G.pre) { G.stats.noTeam = (G.stats.noTeam || 0) + 1; care(-40, 'safety'); toast(`${p.name} died in cardiac arrest. Nobody ran the code.`, 'bad'); sound('bad'); }
  if (p.loc === 'room') { p.dsp = 'family'; p.due = G.t + 15; } else leave(p, 'expired');
}

/* ---------- provider in triage ---------- */
function pitDcReady(p) { return p.dispo === 'home' && !p.con && !p.gray && allWorkDone(p) && p.tr.every(k => k === 'meds'); }
function pitNext(s) {
  for (const p of active()) if (p.loc === 'waiting' && p.pitSeen && !p.pitDcQ && pitDcReady(p)) { p.pitDcQ = true; return { type: 'pitdc', pid: p.id, dur: 3 * langMul(p), label: 'Discharge from triage' }; }
  const c = active().filter(p => p.loc === 'waiting' && !p.pitSeen && !p.pitQ && !p.alertOn).sort((a, b) => a.esi - b.esi || a.tArrive - b.tArrive)[0];
  if (c) { c.pitQ = true; return { type: 'pit', pid: c.id, dur: 5 * langMul(c), label: 'Triage exam' }; }
  return null;
}
function pitDone(s, p) {
  if (p.loc !== 'waiting') return;
  p.pitSeen = true; p.pitBy = s.id; G.stats.pitSeen++;
  revealEsi(p, `${s.short} in triage`);
  for (const w of p.wk) {
    if (!p.work[w]) p.work[w] = { st: 'todo', tOrd: G.t };
    if (WORK[w].by === 'img' && p.work[w].st === 'todo' && !G.img[w].q.includes(p.id)) G.img[w].q.push(p.id);
  }
  if (p.esi >= 4 && !p.wk.length && pitDcReady(p)) { G.stats.pitDc++; note(`${s.short} treated and released ${p.name} from triage`); leave(p, 'dc'); }
}
function setPit(sid, on) {
  const s = staff(sid);
  if (!isProv(s) || !present(s)) return { ok: false, why: 'Pick a provider who is here' };
  if (s.pit === on) return { ok: true, msg: on ? `${s.name} is already in triage` : `${s.name} is already on the floor` };
  s.pit = on;
  if (!on) {
    for (const k of s.q) if (!k.started && (k.type === 'pit' || k.type === 'pitdc')) { const p = pt(k.pid); if (p) { p.pitQ = false; p.pitDcQ = false; } }
    s.q = s.q.filter(k => k.started || (k.type !== 'pit' && k.type !== 'pitdc'));
    return { ok: true, msg: `${s.name} is back` };
  }
  // Their unstarted room work goes back on the board for someone else.
  let freed = 0;
  s.q = s.q.filter(k => {
    if (k.started || k.type === 'box' || k.type === 'talk') return true;
    const p = pt(k.pid);
    if (p) {
      if (k.type === 'eval' || k.type === 'code') { p.ev = 'none'; p.tNeed = G.t; }
      else if (k.type === 'reassess') { p.re = 'need'; p.tNeed = G.t; }
      else if (k.type === 'proc' && p.treat[k.key]) p.treat[k.key].st = 'todo';
      if (p.prov === s.id) p.prov = null;
      freed++;
    }
    return false;
  });
  return { ok: true, msg: `${s.name} is now the provider in triage. They see waiting patients, start their workup, and send simple ones home.${freed ? ` ${freed} patient${freed > 1 ? 's' : ''} in rooms went back on the board for another provider.` : ''}` };
}

/* ---------- nurses ---------- */
function rnSpeed(s) { let m = s.skill === 'new' ? 0.8 : s.skill === 'agency' ? 0.9 : s.skill === 'exp' ? 1.1 : 1; if (G.mods.ehr > G.t) m /= 1.3; if (s.morale < 30) m /= 1.2; return m; }
function rnTick(dt) {
  for (const s of G.staff) {
    if (s.role !== 'rn' || s.st !== 'on') continue;
    if (s.escortUntil > G.t) continue;
    if (s.task) {
      const p = pt(s.task.pid);
      if (!p || p.loc === 'gone') s.task = null;
      else {
        s.task.left -= dt * rnSpeed(s);
        if (s.task.left <= 0) { const k = s.task; s.task = null; s.done++; rnDone(s, k, p); }
        continue;
      }
    }
    if (s.tq.length) {
      s.tq = s.tq.filter(x => x.kind !== 'recheck' || (pt(x.pid) && pt(x.pid).loc === 'waiting'));
      const k = s.tq.find(x => { const p = pt(x.pid); return !x.kind && p && (p.loc === 'wall' || p.loc === 'triage') && p.tri === 'q' && (p.loc === 'wall' || regQuick(p)); });
      if (k) {
        const p = pt(k.pid); s.tq.splice(s.tq.indexOf(k), 1);
        p.tri = 'doing'; p.triaging = true;
        const d = (p.loc === 'wall' ? 5 : 4) * langMul(p);
        s.task = { kind: 'triage', pid: p.id, left: d, dur: d, t0: G.t };
        continue;
      }
      const rk = s.tq.find(x => x.kind === 'recheck');
      if (rk) { s.tq.splice(s.tq.indexOf(rk), 1); s.task = { kind: 'recheck', pid: rk.pid, left: 2, dur: 2, t0: G.t }; continue; }
    }
    const b = rnPick(s);
    if (b) {
      const p = b.p;
      if (b.kind === 'assess') p.rn = 'doing';
      else if (b.kind === 'treat') p.treat[b.key].st = 'doing';
      else if (b.kind === 'dc') p.dsp = 'dcing';
      else if (b.kind === 'report') p.dsp = 'reporting';
      else if (b.kind === 'lab' || b.kind === 'ecg') p.work[b.kind].st = 'doing';
      s.task = { kind: b.kind, key: b.key, pid: p.id, left: b.dur, dur: b.dur, t0: G.t };
    }
  }
}
function rnPick(s) {
  let best = null;
  const helper = s.zones.length === 0, hold = s.zones.includes('hold'), holdOn = hold || holdNurses().length > 0;
  for (const r of G.rooms) {
    if (!r.pid) continue;
    const p = pt(r.pid), boarder = isBoarder(p);
    if (!helper && !s.zones.includes(r.z) && !(hold && boarder)) continue;
    if (holdOn && boarder && !hold && !helper) continue;
    const lm = langMul(p);
    const base = (p.alertOn ? 0 : 10) + p.esi * 10 + (p.stat ? -15 : 0) + (p.vip ? -3 : 0) + (helper ? 5 : 0);
    const consider = (kind, key, dur, rank) => {
      const pr = base + rank;
      if (!best || pr < best.pr || (pr === best.pr && p.tArrive < best.p.tArrive)) best = { kind, key, dur, pr, p };
    };
    if (p.rn === 'todo') consider('assess', null, 4 * lm, 0);
    for (const k in p.treat) {
      const it = p.treat[k];
      if (it.st !== 'todo') continue;
      if (TREAT[k].by === 'rn') consider('treat', k, TREAT[k].dur, 1);
      else if (k === 'nebs' && G.t - (it.tOrd || 0) > 10) consider('treat', k, TREAT[k].dur, 2);
    }
    if (p.dsp === 'dc') consider('dc', null, 4 * lm, 3);
    if (p.dsp === 'callrep' && G.mods.noReport <= G.t) consider('report', null, 5 * lm, 0.8);
    const e = p.work.ecg; if (e && e.st === 'todo' && G.t - (e.tOrd || 0) > 5) consider('ecg', null, 3, 0.5);
    const l = p.work.lab; if (l && l.st === 'todo' && G.t - (l.tOrd || 0) > 8) consider('lab', null, 4, 2);
  }
  return best;
}
function rnDone(s, k, p) {
  if (k.kind === 'triage') { if (p.loc === 'triage' || p.loc === 'wall') finishTriage(p, s); return; }
  if (k.kind === 'recheck') { p.lastRecheck = G.t; if (p.esiT != null && p.esiT !== p.esi) revealEsi(p, 'Recheck'); else note(`Recheck: ${p.name} is stable, still ESI ${vEsi(p)}`); return; }
  if (k.kind === 'report') { if (p.dsp === 'reporting') { p.dsp = 'bedready'; p.tReady = G.t; note(`Report called on ${label(p)}. Send them up.`); } return; }
  if (k.kind === 'assess') { if (p.rn === 'doing') p.rn = 'done'; return; }
  if (k.kind === 'treat') { treatDone(p, k.key); return; }
  if (k.kind === 'dc' && p.loc === 'room') { leave(p, 'dc'); return; }
  if (k.kind === 'ecg' && p.work.ecg && p.work.ecg.st === 'doing') { p.work.ecg.st = 'done'; p.work.ecg.tDone = G.t; ecgRead(p); goalHit(p, 'ecg10'); return; }
  if (k.kind === 'lab' && p.work.lab && p.work.lab.st === 'doing') labDrawn(p);
}
function treatDone(p, key) {
  const it = p.treat[key]; if (!it) return;
  it.st = 'done'; it.tDone = G.t;
  harmCheck(p, key);
  if (key === 'intub' && p.hardAirway && !G.train && !G.pre) {   // v0.26: a hard airway goes better with anesthesia in the room
    if (helpHere(p, 'anes')) note(`${label(p)}: anesthesia got the tube on the first pass`);
    else if (chance(0.4)) { care(-12, 'harm', p); mm(45, `${p.name}’s oxygen dropped into the 70s during a hard intubation`, 'A difficult airway, and nobody called anesthesia', true); toast(`${p.name} desaturated during a hard intubation. Anesthesia could have helped.`, 'bad'); }
  }
  if (key === 'abx') goalHit(p, 'abx60');
  if (key === 'tnk') goalHit(p, 'dtn60');
  if (key === 'mtp') { p.shock = false; note(`${label(p)}: massive transfusion running, pressure coming up`); }
  if (key === 'blood' && p.shock) { p.shock = false; note(`${label(p)}: blood is in, pressure coming up`); }
}
/* v0.27: screening at the door. The first person to talk to them (quick registration or triage) asks about cough, fever, rash and travel. */
function screenDone(p, who) {
  if (p.screen !== 'pending') return;
  p.screen = 'pos'; p.mask = true;
  toast(`${who} screened ${label(p)}: ${p.iso === 'air' ? 'cough and night sweats' : 'cough and fever'}. Mask on, and an isolation room${p.iso === 'air' ? ' (8 or 16)' : ''}.`, 'alert');
}
function screenTick(p) {   // nobody asked: they sat coughing near everyone else
  if (p.screen !== 'pending' || p.exposed || G.pre || G.train) return;
  if (['triage', 'waiting', 'wall'].includes(p.loc) && G.t - p.tArrive > 12) {
    p.exposed = true; care(-6, 'safety', p); if (!G.pre) G.stats.exposed = (G.stats.exposed || 0) + 1;
    for (const st of G.staff) if (st.st === 'on' && (st.role === 'reg' || (st.role === 'rn' && st.zones.includes('triage')))) st.morale -= 2;
    mm(25, `${p.name} sat unscreened in the waiting area for ${Math.round(G.t - p.tArrive)} min with ${p.iso === 'air' ? 'possible TB' : 'a contagious illness'}`, 'Nobody screened them at the door', false);
    toast(`${p.name} waited ${Math.round(G.t - p.tArrive)} min unscreened with ${p.iso === 'air' ? 'possible TB' : 'a contagious illness'}. Others were exposed.`, 'bad');
  }
}
function finishTriage(p, s) {
  screenDone(p, 'Triage');
  p.tri = 'done'; p.triBy = null; p.tTriage = G.t; p.triaging = false;
  if (!G.pre) G.stats.triaged++;
  const risk = (s && (s.skill === 'new' || s.skill === 'agency') ? 0.1 : 0.05) * (p.lang && p.interp !== 'on' ? 1.5 : 1);
  if (!G.train && p.esi >= 2 && p.esi <= 3 && !p.alert && chance(risk)) { p.esiT = p.esi + 1; if (!G.pre) G.stats.underTriage++; }
  if (p.loc === 'triage') { p.loc = 'waiting'; const i = G.triageQ.indexOf(p.id); if (i >= 0) G.triageQ.splice(i, 1); }
  callWalkinAlert(p);
}

/* ---------- intake: registration, triage, EMS hand-off ---------- */
function register(pid, sid) {
  const p = pt(pid), s = staff(sid);
  if (!p) return { ok: false, why: 'No patient' };
  if (!s || s.role !== 'reg') return { ok: false, why: 'Pick a registrar' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} isn’t at the desk` };
  if (p.reg === 'done') return { ok: false, why: `${label(p)} is already registered` };
  if (p.reg !== 'none' && p.reg !== 'quick') { const o = staff(p.regBy); return { ok: false, why: `${o ? o.name : 'Registration'} already has ${label(p)}` }; }
  if (!['wall', 'triage', 'waiting', 'room', 'enroute'].includes(p.loc)) return { ok: false, why: 'That patient isn’t here' };
  const full = p.reg === 'quick' || p.loc === 'room';
  p.reg = full ? 'fq' : 'q'; p.regBy = sid; s.q.push({ pid, full });
  const n = s.q.length + (s.task ? 1 : 0);
  const what = full ? `finish registering ${label(p)} at the bedside` : `quick-register ${label(p)}`;
  return { ok: true, msg: n > 1 ? `${s.name} will ${what} (#${n} in line)` : `${s.name} will ${what} now` };
}
function regTick(dt) {
  for (const s of G.staff) {
    if (s.role !== 'reg' || s.st !== 'on') continue;
    if (s.task) {
      const p = pt(s.task.pid);
      if (!p || p.loc === 'gone') { s.task = null; continue; }
      s.task.left -= dt * (G.mods.ehr > G.t ? 1 / 1.5 : 1);
      if (s.task.left <= 0) {
        const full = s.task.full; s.task = null; s.done++; p.regBy = null;
        if (full) { p.reg = 'done'; if (!G.pre) G.stats.registered++; } else { p.reg = 'quick'; p.quick = true; if (!G.pre) G.stats.quickReg++; }
        screenDone(p, 'Registration');
      }
      continue;
    }
    const k = s.q.find(x => { const p = pt(x.pid); return p && (p.reg === 'q' || p.reg === 'fq') && ['wall', 'triage', 'waiting', 'room'].includes(p.loc); });
    let p = null, full = false;
    if (k) { s.q.splice(s.q.indexOf(k), 1); p = pt(k.pid); full = p.reg === 'fq'; }
    else {
      // Nothing waiting at the door: finish someone's registration at the bedside.
      p = active().filter(x => (x.reg === 'quick' && (x.loc === 'room' || x.loc === 'waiting')) || (x.reg === 'none' && x.loc === 'room' && !x.bedFirst)).sort((a, b) => (b.ev === 'done') - (a.ev === 'done') || a.tArrive - b.tArrive)[0];
      full = true;
      if (!p) continue;
      p.regBy = s.id;
    }
    p.reg = full ? 'fdoing' : 'doing';
    const d = (full ? 4 : 2) * langMul(p);
    s.task = { kind: 'reg', pid: p.id, left: d, dur: d, t0: G.t, full };
  }
}
function triage(pid, sid) {
  const p = pt(pid), s = staff(sid);
  if (!p) return { ok: false, why: 'No patient' };
  if (!s || s.role !== 'rn') return { ok: false, why: 'Pick a nurse' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} is away` };
  if (p.tri === 'done' || !(p.loc === 'wall' || p.loc === 'triage')) return { ok: false, why: `${label(p)} is already triaged` };
  if (p.tri !== 'none') { const o = staff(p.triBy); return { ok: false, why: `${o ? o.name : 'A nurse'} already has ${label(p)}` }; }
  if (s.skill === 'new') return { ok: false, why: `${s.name} is a new grad and isn't triage-trained yet` };
  p.tri = 'q'; p.triBy = sid; s.tq.push({ pid });
  return { ok: true, msg: `${s.name} will ${p.loc === 'wall' ? `take report from ${p.unit} and triage` : 'triage'} ${label(p)}${regQuick(p) || p.loc === 'wall' ? '' : ' once registered'}` };
}
function toWaiting(pid) {
  const p = pt(pid);
  if (!p || p.loc !== 'wall') return { ok: false, why: 'Only EMS patients on the wall' };
  if (!regQuick(p) || p.tri !== 'done') return { ok: false, why: 'Register and triage them first' };
  if (p.alertOn || vEsi(p) <= 2) return { ok: false, why: `ESI ${vEsi(p)} needs a bed, not the waiting room` };
  p.loc = 'waiting'; p.tWall = G.t - p.tArrive; p.offload = true; wallMM(p);
  if (!G.pre) G.stats.offloads++;
  return { ok: true, msg: `${p.unit} handed ${p.name} off to the waiting room` };
}
function releaseQueues(s) {
  for (const k of s.tq) { const p = pt(k.pid); if (p && p.tri === 'q') { p.tri = 'none'; p.triBy = null; } }
  s.tq = [];
  if (s.role === 'reg' || s.role === 'tp' || s.role === 'pct') {
    for (const k of s.q) {
      const p = pt(k.pid); if (!p) continue;
      if (s.role === 'reg' && p.reg === 'q') { p.reg = 'none'; p.regBy = null; }
      if (s.role === 'reg' && p.reg === 'fq') { p.reg = p.quick ? 'quick' : 'none'; p.regBy = null; }
      if ((s.role === 'tp' || s.role === 'pct') && p.dsp === 'xportq') { p.dsp = 'bedready'; p.xBy = null; }
    }
    s.q = [];
  }
}

/* ---------- getting admitted patients upstairs ---------- */
function sendUp(pid, sid) {
  const p = pt(pid), s = staff(sid);
  if (!p || p.dsp !== 'bedready') return { ok: false, why: 'Their bed upstairs isn’t ready yet' };
  if (!s || !(s.role === 'tp' || s.role === 'pct')) return { ok: false, why: 'Pick a transporter or a tech' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} isn’t available` };
  if (s.role === 'pct' && s.task && s.task.kind === 'sit') return { ok: false, why: `${s.name} is sitting 1:1 with a patient` };
  p.dsp = 'xportq'; p.xBy = sid; s.q.push({ pid, kind: 'xport' });
  const busy = s.q.length > 1 || !!s.task;
  return { ok: true, msg: `${s.role === 'tp' ? 'Transporter' : 'Tech'} ${s.name} will take ${label(p)} up${busy ? ' after their current job' : ''}${p.dispo === 'icu' ? '. Their nurse goes along.' : ''}` };
}
function departUp(p, s) {
  const r = roomOf(p), z = r ? r.z : null, icu = p.dispo === 'icu';
  if (!G.pre) G.stats.transports[s.role]++;
  leave(p, p.dispo);
  s.task = { kind: 'trip', left: 10, dur: 10, t0: G.t, label: 'Taking a patient upstairs' };
  if (icu && z) {
    const pool = holdNurses().length ? holdNurses() : zoneNurses(z);
    const n = pool.sort((a, b) => nurseLoad(a) - nurseLoad(b))[0];
    if (n) { n.escortUntil = G.t + 10; note(`${n.name} is escorting an ICU patient upstairs (10 min)`); }
  }
}
function tpTick(dt) {
  for (const s of G.staff) {
    if (s.role !== 'tp' || s.st !== 'on') continue;
    if (s.task) {
      s.task.left -= dt;
      if (s.task.left > 0) continue;
      const k = s.task; s.task = null; s.done++;
      if (k.kind === 'walk') { const p = pt(k.pid); if (p && p.dsp === 'xportq' && p.loc === 'room') departUp(p, s); }
      continue;
    }
    const job = s.q.find(k => { const p = pt(k.pid); return p && p.dsp === 'xportq'; });
    if (job) { s.q.splice(s.q.indexOf(job), 1); s.task = { kind: 'walk', pid: job.pid, left: 3, dur: 3, t0: G.t }; }
    else s.q = [];
  }
}

/* ---------- interfacility transport (v0.26: five levels) ---------- */
const IFT = {
  wc: { name: 'Wheelchair van', short: 'Van', eta: [15, 30], lv: 0, what: 'Sits up, walks, needs no care on the way' },
  bls: { name: 'BLS ambulance', short: 'BLS', eta: [20, 40], lv: 1, what: 'EMTs: a stretcher, oxygen, no monitor or IV drugs' },
  als: { name: 'ALS ambulance', short: 'ALS', eta: [30, 50], lv: 2, what: 'Paramedics: a monitor, IV drugs, an airway' },
  cct: { name: 'Critical care ground', short: 'CCT', eta: [45, 80], lv: 3, what: 'A nurse or medic team for drips, a vent, ICU care' },
  air: { name: 'Critical care flight', short: 'Flight', eta: [20, 30], lv: 3, what: 'ICU care at speed, when time is the problem' },
};
const IFT_LV = ['wc', 'bls', 'als', 'cct'];
/* v0.26: the hospitals around us: what each can do and how long the trip takes (minutes by ground and by air). */
const HOSPS = [
  { k: 'valley', name: 'Valley Community Hospital', short: 'Valley', caps: ['icu', 'pci'], gnd: 18, air: null },
  { k: 'heart', name: 'Riverside Heart Institute', short: 'Riverside', caps: ['pci', 'stroke', 'icu'], gnd: 24, air: 9 },
  { k: 'metro', name: 'Metro Trauma Center', short: 'Metro', caps: ['trauma', 'neuro', 'burn', 'pci', 'icu'], gnd: 38, air: 13 },
  { k: 'univ', name: 'University Medical Center', short: 'University', caps: ['stroke', 'pci', 'trauma', 'neuro', 'picu', 'icu', 'ob'], gnd: 48, air: 16 },
  { k: 'kids', name: 'Children’s Hospital', short: 'Children’s', caps: ['picu', 'peds'], gnd: 55, air: 18 },
  { k: 'lake', name: 'Lakeview Behavioral Health', short: 'Lakeview', caps: ['psych'], gnd: 30, air: null },
];
const CAP_NAME = { pci: 'Cath lab', stroke: 'Stroke clot removal', trauma: 'Level I trauma', neuro: 'Neurosurgery', burn: 'Burn center', picu: 'Pediatric ICU', peds: 'Kids’ floor', icu: 'Adult ICU', ob: 'Labor and delivery', psych: 'Psych beds' };
const TX_NEED = { lvo: 'stroke', rsv: 'picu', burn: 'burn' };
const TX_FAST = new Set(['stroke', 'pci', 'trauma', 'burn']);
function txNeedOf(p) { return p.txNeed || TX_NEED[p.ck] || 'icu'; }
function iftNeed(p) {   // the least crew that can safely take them
  const c = CASES.find(x => x.k === p.ck) || {};
  if (p.needCC || c.ift === 'cct' || txNeedOf(p) === 'icu' || p.arrest || p.crash) return 3;
  if (txNeedOf(p) === 'psych') return 1;
  return 2;
}
const txFast = p => TX_FAST.has(txNeedOf(p));
const crewOf = p => (p.iftLevel === 'air' ? 'flight' : IFT[p.iftLevel].short);
/* v0.26: the beds upstairs. A bed opens when someone upstairs goes home; direct admissions from clinics and the OR want them too. */
const UNITS = {
  icu: { name: 'ICU', cap: 10, fill: 9, out: 100, what: 'Vents, drips, the sickest' },
  step: { name: 'Step-down', cap: 8, fill: 7, out: 85, what: 'Sick but not ICU sick' },
  tele: { name: 'Telemetry', cap: 16, fill: 15, out: 55, what: 'Heart monitors: chest pain, fainting, A-fib' },
  med: { name: 'Med-surg', cap: 28, fill: 26, out: 32, what: 'The general floor' },
  bh: { name: 'Psych', cap: 6, fill: 6, out: 190, what: 'Mental health beds' },
};
function unitOf(p) {
  if (p.dispo === 'icu') return 'icu';
  if (p.dispo === 'bh') return 'bh';
  if (p.con === 'cards' || p.gray) return 'tele';
  return p.esi <= 2 ? 'step' : 'med';
}
/* v0.26: weather. It changes who comes in, how fast ambulances drive, and whether the helicopters fly. */
const WX = {
  clear: { name: 'Clear', blurb: 'A normal day.' },
  rain: { name: 'Rain', blurb: 'More crashes. Ground ambulances a little slower.', gnd: 1.15, abort: 0.15, mix: { mvc: 1.5, moto: 0.6 } },
  snow: { name: 'Snow and ice', blurb: 'Falls and crashes. Roads slow. Fewer walk-ins.', gnd: 1.5, abort: 0.3, walk: 0.85, mix: { hipfx: 1.8, tfall: 1.8, mvc: 1.6, moto: 0.3 } },
  fog: { name: 'Fog', blurb: 'No helicopters until it lifts mid-morning.', gnd: 1.1, air: [[-1e9, 210]] },
  storm: { name: 'Thunderstorms', blurb: 'Helicopters grounded while storms pass.', gnd: 1.2, abort: 0.25, mix: { mvc: 1.3 } },
};
const wxOf = () => WX[(G && G.wx) || 'clear'] || WX.clear;
function wxGrounded() { return G.mods.airWx > G.t || (G.wxAir || []).some(([a, b]) => G.t >= a && G.t < b); }
/* v0.26: help from upstairs for procedures. */
const HELP = {
  anes: { name: 'Anesthesia', short: 'AN', doc: 'Dr. Reyes-Kim', what: 'A hard airway: they intubate with you', for: ['intub'] },
  icu: { name: 'Critical care', short: 'CC', doc: 'Dr. Okonjo', what: 'Shock: lines, pressors, the vent. They take the ICU bed request.', for: ['pressor', 'vent', 'intub'] },
};
const HARD_AIRWAY = new Set(['burn', 'anaph']);
const HELP_STAY = 15;
function bookIFT(pid, level) {
  const p = pt(pid), L = IFT[level];
  if (!p || p.dsp !== 'txok') return { ok: false, why: 'The receiving hospital hasn’t accepted yet' };
  if (!L) return { ok: false, why: 'Pick a service' };
  const H = HOSPS.find(h => h.k === p.txHosp);
  if (level === 'air' && wxGrounded()) return { ok: false, why: 'Helicopters are grounded for weather' };
  if (level === 'air' && H && !H.air) return { ok: false, why: `${H.short} has no helipad. Send them by ground.` };
  let eta = randi(L.eta[0], L.eta[1]);
  if (level !== 'air') { if (G.mods.iftSlow > G.t) eta += 30; eta = Math.round(eta * (wxOf().gnd || 1)); }
  p.dsp = 'iftwait'; p.iftLevel = level; p.due = G.t + eta; p.airAbort = level === 'air' && chance(wxOf().abort || 0.06); p.iftT0 = null; p.iftRep = null;
  if (!G.pre) G.stats.ift[level] = (G.stats.ift[level] || 0) + 1;
  // v0.26: the right crew for the patient. Too little and they refuse at the bedside; too much ties up a scarce unit.
  const need = iftNeed(p); let why = '';
  p.iftMiss = L.lv < need;
  if (!p.iftMiss) {
    if (L.lv > need) { care(-3 * (L.lv - need), 'admin', p); why = ` More crew than ${p.name} needs: that unit can’t run a sicker call.`; }
    else care(3, 'transfer', p);
    if (level === 'air') {
      if (!txFast(p)) { care(-6, 'admin', p); why = ' A flight for a patient who isn’t time-critical is expensive and risky.'; }
      else if (H && H.gnd >= 30) { care(5, 'dispo', p); why = ` Flight saves about ${H.gnd - H.air} min for a time-critical patient.`; }
    } else if (txFast(p) && H && H.air && H.gnd >= 40 && !wxGrounded()) why = ` By ground it’s ${H.gnd} min; a flight would be ${H.air}.`;
  }
  return { ok: true, msg: `${L.name} booked for ${label(p)}, about ${eta} min out.${why}` };
}
/* v0.26: the doctor calls a hospital to accept the patient. */
function callHosp(pid, hk) {
  const p = pt(pid), H = HOSPS.find(h => h.k === hk);
  if (!p || p.dsp !== 'readytx') return { ok: false, why: 'Not ready for transfer yet' };
  if (!H) return { ok: false, why: 'Pick a hospital' };
  if ((p.txNo || []).includes(hk)) return { ok: false, why: `${H.short} already said no` };
  const need = txNeedOf(p), st = G.hosp && G.hosp[hk];
  p.txYes = !H.caps.includes(need) ? 'cap' : st && st.full > G.t ? 'full' : !G.train && chance(0.1) ? 'busy' : 'yes';
  p.dsp = 'txcall'; p.txHosp = hk; p.due = G.t + randi(5, 12); goalHit(p, 'tx45');
  return { ok: true, msg: `Calling ${H.name} to accept ${label(p)}` };
}
function bestHosp(p) {
  const need = txNeedOf(p), no = p.txNo || [];
  const ok = HOSPS.filter(h => h.caps.includes(need) && !no.includes(h.k) && !(G.hosp && G.hosp[h.k] && G.hosp[h.k].full > G.t));
  return ok.sort((a, b) => a.gnd - b.gnd)[0] || HOSPS.filter(h => h.caps.includes(need) && !no.includes(h.k))[0] || null;
}
/* v0.26: report to the transport crew. The doctor gives it on their own patients; otherwise the provider does it. */
function giveReport(pid) {
  const p = pt(pid);
  if (!p || p.dsp !== 'iftreport') return { ok: false, why: 'No crew is waiting for report' };
  if (p.iftRep != null) return { ok: false, why: 'Report is done. They’re packaging.' };
  p.iftRep = G.t; if (p.iftNag == null) care(2, 'dispo', p);
  return { ok: true, msg: `Report given to the ${crewOf(p)} crew. They’re packaging ${p.name} for the trip.` };
}
/* v0.26: a patient who can’t stay: no bed of the kind they need, so they go to a hospital that has one. */
function txInstead(pid) {
  const p = pt(pid);
  if (!p || p.dsp !== 'board' || !p.bedU || p.bedGot) return { ok: false, why: 'Only an admitted patient still waiting for a bed can be transferred instead' };
  if (G.mode === 'md' && !mdMine(p)) return { ok: false, why: 'That’s another doctor’s patient' };
  const u = UNITS[p.bedU], b = G.beds[p.bedU];
  if (!['icu', 'step', 'bh'].includes(p.bedU)) return { ok: false, why: `${u.name} beds turn over fast. Wait for one.` };
  if (b.used < u.cap) return { ok: false, why: `The ${u.name} has a bed. Wait for it.` };
  p.dispo = 'transfer'; p.txNeed = p.bedU === 'bh' ? 'psych' : 'icu'; p.needCC = p.bedU === 'icu'; p.txInst = p.bedU;
  p.txTo = p.bedU === 'bh' ? 'a psych hospital' : `a hospital with an open ${u.name} bed`; p.dsp = 'readytx'; p.mdPick = 'transfer';
  care(4, 'flow', p); if (!G.pre) G.stats.txInstead = (G.stats.txInstead || 0) + 1;
  return { ok: true, msg: `${label(p)} can’t stay: no ${u.name} bed. Find a hospital that has one.` };
}
/* v0.26: call anesthesia or critical care to the bedside. */
function helpCall(pid, k) {
  const p = pt(pid), H = HELP[k];
  if (!p || !H) return { ok: false, why: 'Pick who to call' };
  if (p.loc !== 'room') return { ok: false, why: 'Put the patient in a room first' };
  if (p.help && p.help.st !== 'done') return { ok: false, why: `${HELP[p.help.k].name} is already coming` };
  p.help = { k, st: 'req', due: G.t + randi(6, 12), t0: G.t };
  const useful = H.for.some(x => p.tr.includes(x) || (p.treat[x] && p.treat[x].st !== 'done')) || (k === 'icu' && p.dispo === 'icu');
  if (!useful) { care(-4, 'admin', p); p.help.waste = true; }
  return { ok: true, msg: `${H.name} paged for ${label(p)}. ${H.doc} is coming down.` };
}
const helpHere = (p, k) => !!(p.help && p.help.k === k && (p.help.st === 'here' || p.help.st === 'done'));
function helpTick() {
  for (const p of active()) {
    const h = p.help; if (!h) continue;
    if (h.st === 'req' && G.t >= h.due) {
      h.st = 'here'; h.tVisit = p.loc === 'room' ? G.t : null; const H = HELP[h.k];
      if (!h.waste) { care(p.hardAirway && h.k === 'anes' && !(p.treat.intub && p.treat.intub.st === 'done') ? 6 : 3, 'dispo', p); if (h.k === 'icu') p.bedPri = true; }
      note(`${H.doc} (${H.name}) is at the bedside with ${label(p)}${h.waste ? '. Nothing for them to do here' : ''}`, h.waste ? 'bad' : undefined);
    } else if (h.st === 'here') { if (h.tVisit == null && p.loc === 'room') h.tVisit = G.t; if (h.tVisit != null && G.t - h.tVisit >= HELP_STAY) h.st = 'done'; }
  }
}
/* v0.26: the beds upstairs. */
function bedInit() {
  G.beds = {}; for (const k in UNITS) G.beds[k] = { used: G.train ? Math.max(0, UNITS[k].cap - 4) : UNITS[k].fill, next: G.t + randi(5, UNITS[k].out) };   // Orientation has room upstairs
  G.hosp = {}; for (const h of HOSPS) G.hosp[h.k] = { full: !G.train && chance(0.15) ? randi(60, 240) : -1e9 };
}
function bedOut(k) {   // how long until the next person upstairs goes home: few before 10:00, most around midday
  const L = LEVELS[G.level], t = G.t, tod = t < 180 ? 1.6 : t < 540 ? 0.8 : 1.1;
  return UNITS[k].out * L.board * (G.scen === 'board' ? 1.6 : 1) * tod * (0.6 + rnd() * 0.8);
}
function bedGive(p) {
  const b = G.beds[p.bedU]; b.used++; p.bedGot = true; p.due = G.t + randi(8, 18);
  note(`${UNITS[p.bedU].name} bed assigned for ${label(p)}. EVS is turning it over.`);
}
function bedTick() {
  if (!G.beds) bedInit();
  for (const k in UNITS) {
    const u = UNITS[k], b = G.beds[k];
    if (G.t >= b.next) { b.next = G.t + bedOut(k); if (b.used > 0) b.used--; if (b.used < u.cap && chance(0.35)) b.used++; }   // a direct admission can take the open bed first
    while (b.used < u.cap) {
      const w = active().filter(p => p.dsp === 'board' && p.bedU === k && !p.bedGot).sort((a, x) => (x.bedPri ? 1 : 0) - (a.bedPri ? 1 : 0) || a.tBoard - x.tBoard)[0];
      if (!w) break; bedGive(w);
    }
  }
  for (const h of HOSPS) { const st = G.hosp[h.k]; if (st.full < G.t && G.t > 0 && !G.train && chance(0.0015)) st.full = G.t + randi(60, 180); }
}
const bedWait = k => active().filter(p => p.dsp === 'board' && p.bedU === k && !p.bedGot).length;

/* ---------- patient care techs ---------- */
function pctItems(sitSlots) {
  const out = [];
  for (const p of active()) {
    const inRoom = p.loc === 'room';
    if (inRoom && p.sitter && !p.sitBy && !roomOf(p).safe && sitSlots > 0) { out.push({ kind: 'sit', p, pr: 0 }); sitSlots--; }
    if (p.bb && p.bb.st === 'cooler') out.push({ kind: 'run', p, pr: 0.5, dur: 4 });
    const e = p.work.ecg; if (e && e.st === 'todo') out.push({ kind: 'ecg', p, pr: (p.alertOn || p.ecg10) ? 1 : 4, dur: 3 });
    const pc = p.work.poc; if (pc && pc.st === 'todo' && inRoom) out.push({ kind: 'poc', p, pr: (p.alertOn || p.esi <= 2) ? 1 : 3, dur: 2 });
    const l = p.work.lab; if (l && l.st === 'todo' && (inRoom || (p.loc === 'waiting' && p.pitSeen))) out.push({ kind: 'lab', p, pr: (p.alertOn || p.esi <= 2 || p.stat) ? 2 : 5, dur: 4 });
    if (p.dsp === 'morgue') out.push({ kind: 'morgue', p, pr: 6, dur: 8 });
  }
  for (const e of G.errands) out.push({ kind: 'errand', e, pr: 7, dur: e.dur });
  out.sort((a, b) => a.pr - b.pr || ((a.p ? a.p.tArrive : 0) - (b.p ? b.p.tArrive : 0)));
  return out;
}
function pctTick(dt) {
  const free = [];
  for (const s of G.staff) {
    if (s.role !== 'pct' || s.st !== 'on') continue;
    const k = s.task;
    if (k) {
      const p = k.pid ? pt(k.pid) : null;
      if (k.kind === 'sit') {
        const r = p && p.loc === 'room' ? roomOf(p) : null;
        if (!r || r.safe) { if (p && p.sitBy === s.id) p.sitBy = null; s.task = null; }
      } else if (k.kind !== 'errand' && k.kind !== 'trip' && (!p || p.loc === 'gone')) {
        s.task = null;
      } else {
        k.left -= dt * rnSpeed(s);
        if (k.left <= 0) { s.task = null; s.done++; pctDone(k, p); }
      }
    }
    if (!s.task) free.push(s);
  }
  if (!free.length) return;
  const techs = G.staff.filter(s => s.role === 'pct' && s.st === 'on');
  let sitting = techs.filter(s => s.task && s.task.kind === 'sit').length;
  if (sitting && sitting === techs.length && pctItems(0).some(it => it.p && G.t - ((it.p.work[it.kind] && it.p.work[it.kind].tOrd) || it.p.tReady || G.t) > 10)) {
    const s = techs.filter(x => x.task && x.task.kind === 'sit').pop(), p = pt(s.task.pid);
    if (p) { p.sitBy = null; toast(`${s.name} had to leave the sitter post in ${roomName(p.room)}. Nobody else could do tech work.`, 'bad'); }
    s.task = null; free.push(s); sitting--;
  }
  const items = pctItems(Math.max(0, techs.length - 1 - sitting));
  for (const s of free) {
    const job = s.q.find(k => { const p = pt(k.pid); return p && p.dsp === 'xportq' && p.loc === 'room'; });
    if (job) { s.q.splice(s.q.indexOf(job), 1); departUp(pt(job.pid), s); continue; }
    if (s.q.length) s.q = [];
    const it = items.shift(); if (!it) continue;
    const p = it.p;
    if (it.kind === 'sit') { p.sitBy = s.id; s.task = { kind: 'sit', pid: p.id, left: 1e9, dur: 1e9, t0: G.t }; continue; }
    if (it.kind === 'errand') { G.errands.splice(G.errands.indexOf(it.e), 1); s.task = { kind: 'errand', label: it.e.label, left: it.dur, dur: it.dur, t0: G.t }; continue; }
    if (it.kind === 'ecg') p.work.ecg.st = 'doing';
    if (it.kind === 'poc') p.work.poc.st = 'doing';
    if (it.kind === 'lab') p.work.lab.st = 'doing';
    if (it.kind === 'morgue') p.dsp = 'morguing';
    if (it.kind === 'run') p.bb.st = 'run';
    s.task = { kind: it.kind, pid: p.id, left: it.dur, dur: it.dur, t0: G.t };
  }
}
/* v0.27: a bedside test reads in a minute. A sugar checked early on a stroke, or a DKA sugar confirmed at once, earns a little. */
function pocDone(p) {
  const w = p.work.poc; if (!w) return;
  w.st = 'done'; w.tDone = G.t;
  if (!G.pre && p.det && p.det.includes('gluc') && !p.pocCredit) {
    if (p.alert === 'stroke' && !(p.work.ct && p.work.ct.st === 'done')) { p.pocCredit = true; care(2, 'dispo', p); note(`${label(p)}: sugar checked at the bedside before the CT. Low sugar can look like a stroke.`); }
    else if (p.ck === 'dka') { p.pocCredit = true; care(2, 'dispo', p); note(`${label(p)}: the fingerstick reads HI in a minute. Start the DKA care now.`); }
  }
}
function labTat(p) { let m = (p.alertOn || p.stat || p.esi <= 2) ? 10 : 16; if (G.mods.lab > G.t) m *= 2; return m; }
function labDrawn(p) {
  p.work.lab.st = 'run'; p.work.lab.due = G.t + labTat(p);
  if (p.bleed === 'prbc' && !p.bb) p.bb = { st: 'xm', due: G.t + (G.mods.bbSlow > G.t ? 60 : 30) };
}
function pctDone(k, p) {
  if (k.kind === 'ecg') { p.work.ecg.st = 'done'; p.work.ecg.tDone = G.t; ecgRead(p); goalHit(p, 'ecg10'); }
  else if (k.kind === 'poc') pocDone(p);
  else if (k.kind === 'lab') labDrawn(p);
  else if (k.kind === 'morgue') leave(p, 'expired');
  else if (k.kind === 'run') { if (p.bb) { p.bb.st = 'here'; note(`MTP cooler is at the bedside in ${label(p)}`); } }
}

/* ---------- respiratory therapy ---------- */
function rtTick(dt) {
  for (const s of G.staff) {
    if (s.role !== 'rt' || s.st !== 'on') continue;
    if (s.task) {
      const p = pt(s.task.pid);
      if (!p || p.loc === 'gone') { s.task = null; continue; }
      s.task.left -= dt * rnSpeed(s);
      if (s.task.left <= 0) { const k = s.task; s.task = null; s.done++; if (k.kind === 'rt') treatDone(p, k.key); }
      continue;
    }
    let best = null;
    for (const p of inRooms()) {
      for (const k in p.treat) {
        const it = p.treat[k];
        if (it.st !== 'todo' || TREAT[k].by !== 'rt') continue;
        const pr = (p.alertOn ? 0 : 10) + p.esi * 10 + (p.stat ? -15 : 0) + (k === 'vent' ? -5 : 0);
        if (!best || pr < best.pr) best = { p, k, pr };
      }
    }
    if (best) { best.p.treat[best.k].st = 'doing'; s.task = { kind: 'rt', pid: best.p.id, key: best.k, left: TREAT[best.k].dur, dur: TREAT[best.k].dur, t0: G.t }; }
  }
}

/* ---------- pharmacy ---------- */
function verifyItems() {
  const out = [];
  for (const p of active()) for (const k in p.treat) {
    const it = p.treat[k];
    if (it.st === 'verify' && !it.vby) out.push({ p, k, pr: (k === 'tnk' || k === 'bp' ? -20 : 0) + (p.alertOn ? 0 : 10) + p.esi * 10 + (p.stat ? -15 : 0) });
  }
  out.sort((a, b) => a.pr - b.pr || a.p.tArrive - b.p.tArrive);
  return out;
}
function verifyDur(k) { return (k === 'tnk' ? 4 : 2) * (G.mods.shortage > G.t ? 2 : 1); }
function verified(p, k) { const it = p.treat[k]; if (it && it.st === 'verify') { it.st = 'todo'; it.tOrd = G.t; } if (it) it.vby = null; }
function rphTick(dt) {
  let anyOn = false;
  for (const s of G.staff) {
    if (s.role !== 'rph' || s.st !== 'on') continue;
    anyOn = true;
    if (s.task) {
      const p = pt(s.task.pid);
      if (!p || p.loc === 'gone') { s.task = null; continue; }
      s.task.left -= dt;
      if (s.task.left <= 0) { const k = s.task; s.task = null; s.done++; verified(p, k.key); }
      continue;
    }
    const v = verifyItems()[0];
    if (v) { v.p.treat[v.k].vby = s.id; const d = verifyDur(v.k); s.task = { kind: 'verify', pid: v.p.id, key: v.k, left: d, dur: d, t0: G.t }; }
  }
  if (!anyOn && G.mods.remoteRph) {
    if (G.remote) {
      const p = pt(G.remote.pid);
      G.remote.left -= dt;
      if (!p || p.loc === 'gone') G.remote = null;
      else if (G.remote.left <= 0) { verified(p, G.remote.key); G.remote = null; }
    } else {
      const v = verifyItems()[0];
      if (v) { v.p.treat[v.k].vby = 'remote'; G.remote = { pid: v.p.id, key: v.k, left: verifyDur(v.k) * 2 }; }
    }
  }
}
function overrideRx(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  const items = Object.keys(p.treat).filter(k => p.treat[k].st === 'verify');
  if (!items.length) return { ok: false, why: 'Nothing is waiting on pharmacy for this patient' };
  let errors = 0;
  for (const k of items) {
    for (const s of G.staff) if (s.task && s.task.kind === 'verify' && s.task.pid === p.id && s.task.key === k) s.task = null;
    if (G.remote && G.remote.pid === p.id && G.remote.key === k) G.remote = null;
    verified(p, k);
    G.stats.overrides++;
    if (chance(0.07)) errors++;
  }
  if (errors) {
    G.stats.medErrors += errors; G.stats.adverse += errors; care(-30 * errors, 'safety');
    toast(`Medication error in ${label(p)}: an overridden dose was wrong for her kidney function. Pharmacy would have caught it.`.replace('her', p.sex === 'M' ? 'his' : 'her'), 'bad'); sound('bad');
    return { ok: true, msg: 'Pulled on override. One dose went wrong.' };
  }
  return { ok: true, msg: `Pulled ${items.length} med${items.length > 1 ? 's' : ''} on override for ${label(p)}. Faster, without a pharmacist's check.` };
}

/* ---------- blood bank ---------- */
function activateMTP(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.bb && (p.bb.mtp || p.bb.st === 'here')) return { ok: false, why: 'Massive transfusion is already running for this patient' };
  G.stats.mtp++;
  const uses = Math.min(4, G.blood.oneg);
  G.blood.oneg -= uses; G.stats.oneg += uses;
  if (p.bleed !== 'mtp') {
    G.stats.mtpWaste++; care(-10, 'blood', p);
    note(`MTP cancelled for ${label(p)}: not a hemorrhage. ${uses} units of O-negative wasted.`, 'bad');
    return { ok: false, why: 'The blood bank pushed back: this patient isn’t bleeding out. Cooler cancelled, O-negative wasted.' };
  }
  p.bb = { st: 'mtp', due: G.t + (uses >= 4 ? 8 : 15), mtp: true };
  if (mdMine(p) && p.ev === 'done' && !p.tr.includes('mtp')) { p.tr.push('mtp'); orders(p); if (p.txGap) { p.txGap = p.txGap.filter(k => k !== 'mtp'); if (!p.txGap.length) p.txGap = null; } }
  if (G.blood.oneg <= 4) toast(`Blood bank: only ${G.blood.oneg} units of O-negative left`, 'bad');
  return { ok: true, msg: `MTP activated for ${label(p)}. The first cooler is ready in about ${uses >= 4 ? 8 : 15} min, and a tech will run it.` };
}
function releaseONeg(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.bleed !== 'prbc') return { ok: false, why: p.bleed === 'mtp' ? 'This patient needs the massive transfusion protocol' : 'This patient doesn’t need blood' };
  if (p.bb && (p.bb.st === 'ready' || p.bb.st === 'erel')) return { ok: false, why: 'Blood is already ready or on the way' };
  if (G.blood.oneg < 2) return { ok: false, why: 'The blood bank is out of O-negative. Wait for the crossmatch.' };
  G.blood.oneg -= 2; G.stats.oneg += 2;
  p.bb = { st: 'erel', due: G.t + 5 };
  return { ok: true, msg: `2 units of O-negative on the way for ${label(p)} (about 5 min). ${G.blood.oneg} left in the blood bank.` };
}
function bloodTick() {
  for (const p of active()) {
    const b = p.bb; if (!b) continue;
    if ((b.st === 'xm' || b.st === 'erel') && G.t >= b.due) { b.st = 'ready'; note(`Blood is ready for ${label(p)}`); }
    else if (b.st === 'mtp' && G.t >= b.due) { b.st = 'cooler'; b.coolerAt = G.t; }
    else if (b.st === 'cooler' && G.t - b.coolerAt > 8) { b.st = 'here'; note(`The blood bank ran the MTP cooler to ${label(p)} themselves`); }
  }
}

/* ---------- interpreters ---------- */
function requestInterp(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (!p.lang) return { ok: false, why: 'This patient speaks English' };
  if (p.interp !== 'none') return { ok: false, why: p.interp === 'on' ? 'The interpreter is already connected' : 'The interpreter is already on the way' };
  const slow = G.mods.interpDown > G.t ? 15 : 0;
  const mins = (p.lang === 'asl' ? randi(15, 25) : randi(2, 6)) + slow;
  p.interp = 'req'; p.interpDue = G.t + mins; G.stats.interp++;
  return { ok: true, msg: `${p.lang === 'asl' ? 'ASL interpreter' : LANGS[p.lang] + ' video interpreter'} for ${label(p)} in about ${mins} min` };
}
function interpTick() {
  for (const p of active()) if (p.interp === 'req' && G.t >= p.interpDue) { p.interp = 'on'; note(`${LANGS[p.lang]} interpreter connected for ${label(p)}`); }
}

/* ---------- imaging, results, consults ---------- */
function imgTick(dt) {
  if (!G.img.mri) G.img.mri = { busy: null, q: [], down: -1e9 };   // a save from before v0.19
  for (const m of ['xr', 'ct', 'us', 'mri']) {
    const S = G.img[m];
    if (S.down > G.t || (m === 'ct' && (outActive('ct') || outActive('power')))) continue;
    if (S.busy) {
      S.busy.left -= dt * (G.mods.ehr > G.t ? 1 / 1.3 : 1);
      if (S.busy.left <= 0) {
        const p = pt(S.busy.pid); S.busy = null;
        if (p && p.work[m] && p.work[m].st === 'doing') {
          p.work[m].st = 'run'; p.work[m].due = G.t + WORK[m].read * (p.alertOn || p.stat ? 0.5 : 1);
          if (m === 'ct') goalHit(p, 'ct25');
        }
      }
      continue;
    }
    S.q = S.q.filter(id => { const p = pt(id); return p && p.loc !== 'gone' && p.work[m] && p.work[m].st === 'todo'; });
    let bestId = null, bestPr = 1e9;
    for (const id of S.q) {
      const p = pt(id);
      if (!(p.loc === 'room' || (p.loc === 'waiting' && p.pitSeen))) continue;
      const pr = (p.alertOn ? 0 : 20) + (p.stat ? -10 : 0) + p.esi * 4 + p.tArrive / 1000;
      if (pr < bestPr) { bestPr = pr; bestId = id; }
    }
    if (!bestId) continue;
    S.q.splice(S.q.indexOf(bestId), 1);
    pt(bestId).work[m].st = 'doing';
    S.busy = { pid: bestId, left: WORK[m].scan, dur: WORK[m].scan, t0: G.t };
  }
}
function resultTick() {
  for (const p of active()) {
    for (const k in p.work) {
      const w = p.work[k];
      if (w.st === 'run' && G.t >= w.due && !(k === 'lab' && outActive('lab'))) { w.st = 'done'; w.tDone = G.t; if (p.alertOn && p.find[k]) note(`${label(p)} ${WORK[k].label}: ${p.find[k]}`); }
    }
  }
}
function consultTick() {
  for (const p of active()) {
    const c2 = p.consult2;   // v0.27: a second service
    if (c2 && c2.st === 'req' && G.t >= c2.due) { c2.st = 'here'; c2.tArr = G.t; const S2 = SPECS[c2.spec]; note(`${S2.doc} (${S2.name}) is at the bedside in ${label(p)} too`); }
    if (c2 && c2.st === 'here' && c2.tVisit == null && p.loc === 'room') c2.tVisit = G.t;
    const c = p.consult;
    if (c.st === 'req' && G.t >= c.due) {
      c.st = 'here'; c.tArr = G.t;
      const S = SPECS[c.spec];
      if (c.phone) { note(S.phone ? `${S.doc} (${S.name}) accepted ${label(p)} by phone. Transfer them for surgery.` : `${S.doc} accepted ${label(p)} by phone. They'll see them upstairs.`); c.tVisit = -1e9; }
      else if (p.loc === 'room') note(`${S.doc} (${S.name}) is at the bedside in ${roomName(p.room)}`);
      else toast(`${S.doc} (${S.name}) is here, but ${p.name} still has no room`, 'bad');
      if (p.con2 && !p.consult2) note(`${label(p)} also needs ${SPECS[p.con2].name}: ${CON2_WHY[p.ck] || 'a second service'}.`);
    }
    if (c.st === 'here' && c.tVisit == null && p.loc === 'room') c.tVisit = G.t;   // v0.25: the consultant walks in, sees the patient, and walks out (map)
  }
}
const CON2_WHY = { hipfx: 'an older patient going to surgery needs medicine to manage everything else', gib: 'GI scopes them; the hospitalist admits them' };
function consult(pid, spec, o) {
  o = o || {};
  const p = pt(pid), S = SPECS[spec];
  if (!p || !S) return { ok: false, why: 'Pick a patient and a service' };
  if (!p.alertOn) {
    if (p.loc !== 'room') return { ok: false, why: 'Put the patient in a room first' };
    if (p.ev !== 'done') return { ok: false, why: 'A provider has to see the patient before you consult' };
  }
  if (p.consult.st !== 'none' && p.con2 && !p.consult2 && !o.phone) {   // v0.27: the second service
    if (spec === p.consult.spec) return { ok: false, why: `${S.name} is already involved` };
    const m2 = G.spec[spec];
    if (spec !== p.con2) { m2.mood = Math.max(-3, m2.mood - 1); m2.at = G.t; care(-6, 'consult', p); G.stats.wrongSpec++; return { ok: false, mad: true, why: `${S.doc} (${S.name}): "Not ours. ${SPECS[p.con2].name} should co-manage this one."` }; }
    const mins2 = Math.round(randi(10, 18) * ([1, 1.2, 1.5, 1.9][-m2.mood] || 1));
    p.consult2 = { st: 'req', spec, due: G.t + mins2, t0: G.t }; care(3, 'dispo', p); G.stats.con2 = (G.stats.con2 || 0) + 1;
    return { ok: true, msg: `${S.doc} (${S.name}) will also see ${label(p)} in about ${mins2} min` };
  }
  if (p.consult.st !== 'none') return { ok: false, why: `${SPECS[p.consult.spec].name} is already involved` };
  if (o.phone && spec === 'hosp' && p.con !== 'hosp') { care(-4, 'consult', p); return { ok: false, mad: true, why: `${S.doc} (Hospitalist): "I can't take this one sight unseen. ${p.con ? SPECS[p.con].name + ' needs to see them.' : 'They don’t need admission.'}"` }; }
  const m = G.spec[spec];
  if (p.con !== spec) {
    if (mdMine(p) && !p.con) G.stats.md.dispoWrong++;
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-10, 'consult', p); G.stats.wrongSpec++; provHit(p, 3); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${p.con ? (p.conNote = `${S.name} declined. Try ${SPECS[p.con].name}.`, note(`${S.name} declined ${label(p)}: not theirs. Try ${SPECS[p.con].name}.`, 'bad'), `Why is ${S.name.toLowerCase()} getting this call? Not ours. Call ${SPECS[p.con].name}.`) : 'This patient doesn’t need a consult. Send them home.'}"` };
  }
  // EMS-activated STEMI, stroke, and trauma alerts can call their team on the field report alone
  const miss = (p.alertOn && ALERTS[p.alert] && ALERTS[p.alert].auto) ? [] : p.pre.filter(k => !(p.work[k] && p.work[k].st === 'done'));
  if (miss.length) {
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-15, 'consult', p); G.stats.angry++; provHit(p, 4); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${S.mad(miss.map(k => MISS_NAME[k]).join(' and '))}"` };
  }
  const phone = (!!o.phone && spec === 'hosp') || !!S.phone;   // v0.27: the ED doctor admits by phone; the hospitalist sees them upstairs. v0.29.1: a service this hospital doesn't have (S.phone) only ever takes the call by phone
  const base = phone ? randi(3, 6) : (spec === 'trauma' ? randi(8, 14) : randi(12, 22)) + (spec === 'trauma' && outActive('or') ? 30 : 0), mult = phone ? 1 : [1, 1.2, 1.5, 1.9][-m.mood] || 1;
  const mins = Math.round(base * mult);
  p.consult = { st: 'req', spec, due: G.t + mins, t0: G.t, phone };
  if (phone && !S.phone) { care(4, 'flow', p); G.stats.phoneAdmit = (G.stats.phoneAdmit || 0) + 1; }
  if (mdMine(p) && !p.mdPick) { p.mdPick = 'consult'; if (p.dsp === 'mddecide') p.dsp = 'none'; G.stats.md.dispoRight++; care(12, 'dispo', p); }
  return { ok: true, msg: S.phone ? `Calling ${S.doc} (${S.name}) at the receiving hospital: about ${mins} min` : phone ? `Calling ${S.doc} to admit ${label(p)} by phone: about ${mins} min` : `${S.doc} (${S.name}) will see ${label(p)} in about ${mins} min` };
}
const con2Open = p => !!(p.con2 && p.consult.st === 'here' && !p.consult2);
const con2Wait = p => !!(p.con2 && !(p.consult2 && p.consult2.st === 'here'));
function provHit(p, n) { const s = staff(p.prov); if (s) s.morale -= n; }

/* ---------- goals ---------- */
function goalHit(p, key, when) {
  if (!(key in p.goals) || p.goals[key] !== null) return;
  const el = (when == null ? G.t : when) - p.tArrive;
  const ok = el <= GOALS[key].lim + 1e-9;
  p.goals[key] = ok;
  if (G.pre) return;
  G.stats.goals.list.push({ key, ok, el: Math.round(el), alert: p.alert });
  if (ok) { G.stats.goals.met++; care(30, 'goals', p); toast(`${GOALS[key].label}: ${Math.round(el)} min. Goal met · ${label(p)}`, 'good', true); sound('good'); }
  else { G.stats.goals.miss++; care(-20, 'goals', p); mm(40, `${GOALS[key].label} took ${Math.round(el)} min (goal ${GOALS[key].lim}) for ${p.name}`, goalWhy(p, key), !!p.mine); }
}
function goalMissTick(p) {
  for (const key in p.goals) {
    if (p.goals[key] === null && G.t - p.tArrive > GOALS[key].lim) {
      p.goals[key] = false;
      if (G.pre) continue;
      G.stats.goals.miss++; care(-20, 'goals', p); G.stats.goals.list.push({ key, ok: false, el: null, alert: p.alert });
      mm(40, `${GOALS[key].label} went past ${GOALS[key].lim} min for ${p.name}`, goalWhy(p, key), !!p.mine);
      toast(`Missed: ${GOALS[key].label} under ${GOALS[key].lim} min · ${label(p)}`, 'bad');
    }
  }
}

function goalWhy(p, key) {
  const roomed = p.tRoom != null ? p.tRoom : G.t, bed = roomed - p.tArrive;
  if (bed > 10) return `${Math.round(bed)} min to get a bed. ${crowdWhy()}.`;
  const prov = (p.tProv != null ? p.tProv : G.t) - roomed;
  if (prov > 10) return `No provider for ${Math.round(prov)} min after they were roomed`;
  if ((key === 'ct25' || key === 'dtn60') && (outActive('ct') || outActive('power'))) return 'The CT scanner was down';
  if (key === 'dtn60' && p.bp0 && p.bp0[0] > LYTIC_BP[0] && !(p.treat.bp && p.treat.bp.st === 'done')) return `The pressure was over ${LYTIC_BP[0]}/${LYTIC_BP[1]} and was never brought down`;
  const why = { ct25: 'Waited in the CT line', dtn60: 'The thrombolytic waited on CT, neurology, or pharmacy', abx60: 'Antibiotics waited on pharmacy or a nurse', ecg10: 'Nobody was free to do the ECG',
    d2b90: 'The cath lab handoff took too long', surg15: 'The surgeon came late', tx45: 'The transfer call went out late', resus5: 'No resus bay was ready' };
  return why[key] || 'Workup and treatment took too long';
}
/* What the department looked like at the moment something went wrong. */
function crowdWhy() {
  const open = G.rooms.filter(r => !r.pid && r.st === 'clean' && !r.closed && r.kind !== 'chair').length;
  const dirty = G.rooms.filter(r => r.st === 'dirty' || r.st === 'cleaning').length;
  const held = holds().length;
  if (open >= 2) return `${open} clean beds were open at the time`;
  if (dirty >= 3) return `${dirty} rooms were waiting on EVS`;
  if (held >= 4) return `${held} admitted patients were holding ED beds`;
  return 'Every bed was full';
}

/* ---------- flow, dispositions ---------- */
const allWorkDone = p => p.wk.every(k => p.work[k] && p.work[k].st === 'done');
const preDone = p => p.pre.every(k => p.work[k] && p.work[k].st === 'done');
const treatsDone = p => p.tr.every(k => p.treat[k] && p.treat[k].st === 'done');
function flowTick() {
  for (const p of active()) {
    if (p.arrest) { arrestNoTeam(p); if (p.loc === 'gone') continue; }
    if (p.code && p.code.me && p.code.step < codeSteps(p).length && p.ev === 'doing' && !G.card && !G.pre) codeCard(p);   // a rhythm check put off by another card
    if (p.dsp === 'rideeta' && G.t >= p.due) { p.dsp = 'ridehere'; p.due = G.t + 6; toast(`The ambulance for ${label(p)} is here to take them to rehab`, 'info', true); }
    else if (p.dsp === 'ridehere' && G.t >= p.due) { G.stats.rehab = (G.stats.rehab || 0) + 1; leave(p, 'dc'); continue; }
    if (mdMine(p) && p.treat.tnk && p.treat.tnk.st === 'wait' && p.extraTr && p.extraTr.includes('tnk')) openGate(p.treat.tnk, 'tnk');
    if ('surg15' in p.goals && p.goals.surg15 === null && p.consult.st === 'here' && p.loc === 'room') goalHit(p, 'surg15', Math.max(p.consult.tArr, p.tRoom));
    goalMissTick(p);
    if (p.loc !== 'room') continue;
    if (p.ev === 'done' && !p.dxK && p.re === 'none' && allWorkDone(p) && !(mdMine(p) && p.ord !== 'signed')) {
      const s = staff(p.prov);
      if (s && isProv(s) && present(s) && !s.pit) { p.re = 'q'; addTask(s, { type: 'reassess', pid: p.id, dur: 3 * langMul(p), label: 'Recheck' }); }
      else { p.re = 'need'; p.prov = null; p.tNeed = G.t; }
    }
    if (p.lkwT != null && !lyticWindowOk(p) && (p.tr.includes('tnk') || (p.right && p.right.tr.includes('tnk'))) && !(p.treat.tnk && (p.treat.tnk.st === 'doing' || p.treat.tnk.st === 'done'))) lyticWindowClosed(p);
    if (p.treat.tnk && p.treat.tnk.st === 'wait' && p.consult.st === 'here' && (w => w && w.st === 'done')(p.work[p.ck === 'mpe' ? 'us' : 'ct']) && bpOkForLytic(p) && lyticWindowOk(p)) openGate(p.treat.tnk, 'tnk');   // v0.29.1: massive PE goes on the bedside ultrasound
    if (p.treat.blood && p.treat.blood.st === 'wait' && p.bb && p.bb.st === 'ready') openGate(p.treat.blood, 'blood');
    if (p.treat.mtp && p.treat.mtp.st === 'wait' && p.bb && p.bb.st === 'here') openGate(p.treat.mtp, 'mtp');
    if (p.cosign === 'wait') needCosign(p);
    if (p.dsp === 'none') checkDispo(p); else dspTimers(p);
  }
}
function checkDispo(p) {
  if (mdMine(p)) {
    if (p.ev !== 'done' || !p.dxK || p.arrest || p.ord !== 'signed' || !allWorkDone(p)) return;
    if (p.mdPick !== 'transfer' && ((p.dispo === 'cath' && outActive('cath')) || (p.dispo === 'or' && p.alert === 'trauma' && outActive('or')))) {
      const cath = p.dispo === 'cath';
      p.dispo = 'transfer'; p.txTo = cath ? 'another hospital with a cath lab' : 'another trauma center'; p.txNeed = cath ? 'pci' : 'trauma'; if (!cath) p.needCC = true; else delete p.goals.d2b90;
      p.mdPick = 'transfer'; p.dsp = 'readytx';
      note(`${label(p)} needs ${cath ? 'a cath lab' : 'an OR'} and ours is down. The charge nurse is calling the transfer center.`, 'bad');
      return;
    }
    if (!p.mdPick) {
      // Teams the field activated (STEMI, stroke, trauma) take the patient. Otherwise it's your call.
      if (p.consult.st !== 'none' && p.dispo !== 'transfer') p.mdPick = 'consult';
      else { const st = p.gray ? 'decide' : 'mddecide'; if (p.dsp !== st) { p.dsp = st; note(`${label(p)}: ${p.dx}. Your call.`); } return; }
    }
    if (p.reg !== 'done') return;
    if (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done')) return;
    if (p.mdPick === 'consult' && (p.consult.st !== 'here' || con2Wait(p))) return;
    if (!treatsDone(p)) return;
    setDispo(p);
    return;
  }
  if (p.ev !== 'done' || !p.dxK || p.arrest || p.reg !== 'done') return;
  if (p.cosign === 'need' || p.cosign === 'wait') return;
  if (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done')) return;
  if (p.dispo === 'cath' && outActive('cath')) { p.dispo = 'transfer'; p.txTo = 'another hospital with a cath lab'; p.txNeed = 'pci'; delete p.goals.d2b90; note(`${label(p)} needs a cath lab and ours is down. Transfer them.`, 'bad'); }
  if (p.dispo === 'or' && p.alert === 'trauma' && outActive('or')) { p.dispo = 'transfer'; p.txTo = 'another trauma center'; p.txNeed = 'trauma'; p.needCC = true; note(`${label(p)} needs an OR and there isn't one. Transfer them.`, 'bad'); }
  // Transfers get called in as soon as the diagnosis is clear. Treatment keeps going while the crew drives in.
  if (p.dispo === 'transfer') { p.dsp = 'readytx'; return; }
  if (p.con && (p.consult.st !== 'here' || con2Wait(p))) return;
  if (!treatsDone(p)) return;
  if (p.gray && !p.grayPick) { p.dsp = 'decide'; note(`${label(p)}: ${p.gray.tool} ${p.gray.score} (${p.gray.band} risk). Your call: home, observation, or admit.`); return; }
  setDispo(p);
}
function setDispo(p) {
  const L = LEVELS[G.level];
  if (p.dispo === 'home') {
    const w = !G.train && !p.ret && (CASES.find(c => c.k === p.ck) || {}).watch;
    if (w && !p.watched) { p.dsp = 'watch'; p.due = G.t + w; p.watchFor = w; p.watched = true; note(`${label(p)} is treated. Watch until ${clock(p.due)} before they go home.`); }
    else p.dsp = 'ready';
  }
  else if (p.dispo === 'transfer') p.dsp = 'readytx';
  else if (p.dispo === 'obs') obsAdmit(p);
  else if (p.dispo === 'admit' || p.dispo === 'icu' || p.dispo === 'bh') {
    if (!G.beds) bedInit();
    p.dsp = 'board'; p.due = 1e9; p.tBoard = G.t; p.bedU = unitOf(p); p.bedGot = false;
    const u = UNITS[p.bedU], b = G.beds[p.bedU];
    if (b.used < u.cap) bedGive(p);
    else note(`${label(p)} admitted to ${u.name}. ${u.name} is full (${b.used}/${u.cap}): they wait for a bed.`);
  } else if (p.dispo === 'or' || p.dispo === 'cath') { p.dsp = 'toproc'; p.due = G.t + 4; }
}
/* Gray zone: the player makes the home / observation / admit call. */
function grayDispo(pid, pick) {
  const p = pt(pid);
  if (!p || p.dsp !== 'decide') return { ok: false, why: 'There’s no decision waiting for this patient' };
  if (!['home', 'obs', 'admit'].includes(pick)) return { ok: false, why: 'Pick home, observation, or admit' };
  const g = p.gray, S = G.stats.gray, risk = `${cap(g.band)}-risk ${g.tool} (${g.score})`;
  let msg;
  if (pick === g.right) { S.right++; care(8, 'gray', p); msg = `Good call. ${risk}.`; }
  else if (g.ok.includes(pick)) { S.ok++; msg = `Defensible. ${risk}: most would pick ${g.right === 'obs' ? 'observation' : g.right}.`; }
  else if (g.right === 'home') { S.over++; care(-6, 'gray', p); msg = `${risk} usually goes home. That bed was needed.`; }
  else { S.under++; p.grayUnder = true; msg = `${risk}. Most would keep this patient.`; }
  p.grayPick = pick; p.dispo = pick; p.dsp = 'none';
  if (mdMine(p)) { p.mdPick = pick; if (pick === g.right || g.ok.includes(pick)) G.stats.md.dispoRight++; else G.stats.md.dispoWrong++; } else setDispo(p);
  return { ok: true, msg: `${label(p)}: ${pick === 'home' ? 'going home' : pick === 'obs' ? 'observation' : 'admitted'}. ${msg}` };
}
/* The observation unit: short stays, its own beds, its own turnover. */
function obsAdmit(p) {
  const O = G.obsUnit;
  p.dsp = 'board'; p.tBoard = G.t;
  if (O.filled < O.cap) { O.filled++; p.obsWait = false; p.due = G.t + randi(5, 15); note(`${label(p)} goes to observation. An obs bed is assigned.`); }
  else { p.obsWait = true; p.due = 1e9; note(`${label(p)} goes to observation. The obs unit is full; they wait for the next obs discharge.`); }
}
function obsTick() {
  const O = G.obsUnit;
  if (G.t < O.nextOut) return;
  O.nextOut = G.t + randi(45, 90);
  if (O.filled > 0) O.filled--;
  const w = active().filter(p => p.obsWait && p.dsp === 'board').sort((a, b) => a.tBoard - b.tBoard)[0];
  if (w && O.filled < O.cap) { O.filled++; w.obsWait = false; w.due = G.t + 5; note(`An obs bed opened for ${label(w)}`); }
  else if (O.filled < O.cap && chance(0.7)) O.filled++;  // direct admissions from clinics and the floors use the unit too
}
/* Full-capacity protocol: admitted patients go to inpatient hallways so the ED can see new patients. */
function fullCapacity() {
  if (G.t - G.fcp.last < 240) return { ok: false, why: `The full-capacity protocol can run again at ${clock(G.fcp.last + 240)}` };
  if (waitingCount() < 6 && active().filter(p => p.loc === 'wall').length < 2) return { ok: false, why: 'The ED isn’t full enough. The protocol needs a packed waiting room or ambulances stuck on the wall.' };
  const list = inRooms().filter(p => p.dsp === 'board' && p.dispo === 'admit' && !p.obsWait).sort((a, b) => a.tBoard - b.tBoard);
  if (list.length < 3) return { ok: false, why: 'It needs at least 3 admitted floor patients waiting for beds' };
  const n = Math.min(4, list.length);
  for (const p of list.slice(0, n)) { p.due = G.t; p.fcp = true; p.bedGot = true; }
  G.fcp.last = G.t; G.stats.fcp++; care(-5, 'admin');
  G.spec.hosp.mood = Math.min(G.spec.hosp.mood, -1); G.spec.hosp.at = G.t;
  return { ok: true, msg: `Full-capacity protocol: ${n} admitted patients go to inpatient hallway beds now. Their nurses still have to call report. The hospitalists aren’t thrilled.` };
}
function dspTimers(p) {
  if (p.dsp === 'board' && G.t >= p.due) { p.dsp = 'callrep'; p.tBed = G.t; note(`Bed assigned upstairs for ${label(p)}. Their nurse needs to call report.`); }
  else if (p.dsp === 'toproc' && G.t >= p.due) leave(p, p.dispo);
  else if (p.dsp === 'txcall' && G.t >= p.due) {
    const H = HOSPS.find(h => h.k === p.txHosp);
    if (!H || !p.txYes || p.txYes === 'yes') { if (H) p.txTo = H.name; p.dsp = 'txok'; note(`${cap(p.txTo)} accepted ${label(p)}. Pick the transport.`); }
    else {
      (p.txNo = p.txNo || []).push(H.k); p.dsp = 'readytx';
      const why = p.txYes === 'cap' ? `doesn’t have ${CAP_NAME[txNeedOf(p)].toLowerCase()}` : p.txYes === 'full' ? 'is full and not taking transfers' : 'has no bed right now';
      if (p.txYes !== 'busy') care(-3, 'transfer', p);
      toast(`${H.short} declined ${label(p)}: it ${why}. Call another hospital.`, 'bad');
    }
  }
  else if (p.dsp === 'iftwait' && p.airAbort && G.t >= p.due - 8) { p.dsp = 'txok'; p.airAbort = false; G.stats.airAbort++; toast(`The helicopter for ${label(p)} turned back for weather. Book ground transport.`, 'bad'); }
  else if (p.dsp === 'iftwait' && G.t >= p.due) {
    if (p.iftMiss || (p.needCC && IFT[p.iftLevel].lv < 3)) { p.dsp = 'txok'; p.iftMiss = false; care(-10, 'transfer'); G.stats.iftRefused++; toast(`The ${crewOf(p)} crew can't take ${label(p)}: this patient needs ${IFT[IFT_LV[iftNeed(p)]].name.toLowerCase()} or more. Book again.`, 'bad'); }
    else { p.dsp = 'iftreport'; p.iftT0 = G.t; p.iftRep = null; p.due = 1e9; note(`${IFT[p.iftLevel].name} crew is at the bedside in ${label(p)}. ${mdMine(p) ? 'Give them report.' : 'Taking report.'}`); }
  }
  else if (p.dsp === 'iftreport' && p.iftRep == null) {
    if (p.iftT0 == null) p.iftT0 = G.t;
    if (!mdMine(p) && G.t - p.iftT0 >= 2) p.iftRep = G.t;
    else if (G.t - p.iftT0 >= 12 && p.iftNag == null) { p.iftNag = G.t; care(-4, 'transfer', p); toast(`The ${crewOf(p)} crew in ${label(p)} is still waiting for your report`, 'bad'); }
  }
  else if (p.dsp === 'iftreport' && G.t >= p.iftRep + 6) {
    const owed = p.tr.filter(k => !p.treat[k] || p.treat[k].st !== 'done').map(k => TREAT[k].label.toLowerCase()).join(', ');
    if (treatsDone(p)) leave(p, 'tx');
    else if (p.crewWait == null) { p.crewWait = G.t; note(`The ${crewOf(p)} crew in ${label(p)} is waiting on ${owed} before they go`, 'bad'); }
    else if (G.t - p.crewWait > 20) {
      // A crew can't hold a room forever. They go, and the receiving team finishes the job.
      care(-10, 'transfer');
      mm(30, `The ${crewOf(p)} crew left with ${p.name} before ${owed} was done`, 'Treatment was still pending when the crew was ready to go');
      toast(`The ${crewOf(p)} crew couldn't wait any longer and left with ${label(p)} (${owed} not done)`, 'bad');
      leave(p, 'tx');
    }
  }
  else if (p.dsp === 'watch' && G.t >= p.due) { p.dsp = 'ready'; note(`${label(p)} has been watched long enough. Ready to go home.`); }
  else if (p.dsp === 'family' && G.t >= p.due) { p.dsp = 'morgue'; p.tReady = G.t; }
  else if (p.dsp === 'morgue' && G.t - (p.tReady || G.t) > 20) leave(p, 'expired');
}
function discharge(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.dsp === 'watch') p.earlyDc = { left: Math.max(1, Math.round(p.due - G.t)), why: WATCH_WHY[p.ck] || 'they were still being watched' };   // the player may send them early; the risk is theirs
  else if (p.dsp !== 'ready') return { ok: false, why: p.dispo === 'home' ? 'Not ready yet. Workup or treatment is still pending.' : 'This patient isn’t going home' };
  p.dsp = 'dc';
  if (p.rehab) { p.unsafeHome = true; care(-12, 'dispo', p); }   // they couldn't manage at home
  return { ok: true, msg: `Discharge started for ${label(p)}. The nurse will do the teaching.` };
}
/* v0.25: discharge to rehab. The patient keeps the room (or a chair) until a ride comes: the unit secretary has to call it first. */
function dischargeRehab(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.dsp !== 'ready' && p.dsp !== 'watch') return { ok: false, why: p.dispo === 'home' ? 'Not ready yet. Workup or treatment is still pending.' : 'This patient isn’t being discharged' };
  if (p.dsp === 'watch') p.earlyDc = { left: Math.max(1, Math.round(p.due - G.t)), why: WATCH_WHY[p.ck] || 'they were still being watched' };
  p.dsp = 'rehab'; p.dcTo = 'rehab';
  if (p.rehab) care(6, 'dispo', p); else care(-6, 'admin', p);   // a rehab bed for someone who could have gone home costs the hospital
  clerkAdd('ride', p.id);
  return { ok: true, msg: `${label(p)} is going to rehab. The unit secretary needs to call a ride.` };
}
/* v0.25: the unit secretary's clerical work. Tasks wait in a list until the player hands one to the secretary (or the computer does, for the attending). */
const RIDE = new Set(['rehab', 'rideeta', 'ridehere']);
const CLERK = { ride: { name: 'Call a ride to rehab', min: 4 }, family: { name: 'Call families with an update', min: 3 } };
function clerkAdd(k, pid) { if (G.clerk.some(x => x.k === k && x.pid === pid)) return null; const t = { id: 'c' + (++G.clerkN), k, pid: pid || null, t0: G.t }; G.clerk.push(t); return t; }
function clerkOpen() { return (G.clerk || []).filter(x => !x.by); }
function ucDo(tid, sid) {
  const t = G.clerk.find(x => x.id === tid) || (tid === 'family' ? clerkAdd('family') : null); if (!t) return { ok: false, why: 'That task is done' };
  const s = sid ? staff(sid) : G.staff.find(x => x.role === 'uc' && present(x)); if (!s || s.role !== 'uc' || !present(s)) return { ok: false, why: 'No unit secretary on' };
  if (t.by) return { ok: false, why: 'Already on it' };
  t.by = s.id; s.q.push(t.id);
  return { ok: true, msg: `${s.name}: ${CLERK[t.k].name.toLowerCase()}${t.pid && pt(t.pid) ? ' for ' + label(pt(t.pid)) : ''}` };
}
function ucTick() {
  if (!G.clerk) { G.clerk = []; G.clerkN = 0; }   // an older save
  for (const s of G.staff) {
    if (s.role !== 'uc' || !present(s) || s.st !== 'on') continue;
    if (G.mode === 'md' || G.auto) for (const t of clerkOpen()) { t.by = s.id; s.q.push(t.id); }   // the attending doesn't run the desk: the computer charge nurse does
    if (s.task && G.t >= s.task.until) { const t = G.clerk.find(x => x.id === s.task.cid); s.task = null; if (t) { clerkDone(t); G.clerk.splice(G.clerk.indexOf(t), 1); } s.done++; }
    if (!s.task && s.q.length) { const id = s.q.shift(), t = G.clerk.find(x => x.id === id); if (t) s.task = { kind: 'clerk', cid: t.id, pid: t.pid, until: G.t + CLERK[t.k].min }; }
  }
}
function clerkDone(t) {
  const p = t.pid ? pt(t.pid) : null;
  if (t.k === 'ride' && p && p.dsp === 'rehab') { p.dsp = 'rideeta'; p.due = G.t + Math.round(randi(25, 40) * (wxOf().gnd || 1)); toast(`Ride to rehab booked for ${label(p)}: here in about ${Math.round(p.due - G.t)} min`, 'info', true); }
  if (t.k === 'family') {
    const list = active().filter(x => ['room', 'waiting', 'wall'].includes(x.loc)).sort((a, b) => a.px - b.px).slice(0, 3);
    for (const x of list) x.px = Math.min(100, x.px + 7);
    if (list.length) toast(`Families updated: ${list.map(x => x.name).join(', ')}`, 'good', true);
  }
}
function requestTransfer(pid) {   // the transfer center picks the nearest hospital that can take them
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.dsp !== 'readytx') return { ok: false, why: 'Not ready for transfer yet' };
  const H = bestHosp(p); if (!H) return { ok: false, why: 'No hospital nearby can take them' };
  return callHosp(pid, H.k);
}
function escalate(pid) {
  const p = pt(pid);
  if (!p || p.dsp !== 'board') return { ok: false, why: 'Only admitted patients waiting for a bed can be escalated' };
  if (p.obsWait) return { ok: false, why: 'The obs unit is full. Its next discharge frees a bed.' };
  if (G.house.esc <= 0) return { ok: false, why: 'The House Supervisor is out of favors for this shift' };
  G.house.esc--;
  if (p.bedU && !p.bedGot) { p.bedGot = true; p.due = G.t + randi(10, 20); return { ok: true, msg: `House Sup pulled a discharge forward: a ${UNITS[p.bedU].name} bed for ${label(p)} (${G.house.esc} favors left)` }; }
  p.due = G.t + (p.due - G.t) * 0.45;
  return { ok: true, msg: `House Sup is pushing a bed for ${label(p)} (${G.house.esc} favors left)` };
}
function toggleStat(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  p.stat = !p.stat;
  for (const s of G.staff) if (isProv(s)) sortQ(s);
  return { ok: true, msg: p.stat ? `${label(p)} marked STAT. Everyone works it first.` : `STAT cleared for ${label(p)}` };
}
function leave(p, outcome) {
  const r = roomOf(p);
  if (r) { r.pid = null; if (r.kind === 'chair') r.st = 'clean'; else { r.st = 'dirty'; r.dirt = (p.iso || outcome === 'expired') ? 'term' : 'std'; } }
  if (p.loc === 'triage') { const i = G.triageQ.indexOf(p.id); if (i >= 0) G.triageQ.splice(i, 1); }
  if (p.sitBy) releaseSitter(p);
  for (const s of G.staff) {
    if (s.q.length) s.q = s.q.filter(k => k.pid !== p.id);
    if (s.tq.length) s.tq = s.tq.filter(k => k.pid !== p.id);
    if (s.task && s.task.pid === p.id) s.task = null;
  }
  if (G.remote && G.remote.pid === p.id) G.remote = null;
  const wasLoc = p.loc;
  p.loc = 'gone'; p.tDone = G.t; p.outcome = outcome; p.room = null;
  const bal = outcome === 'cath' ? randi(15, 25) : 0, d2b = bal && 'd2b90' in p.goals && p.goals.d2b90 === null;   // balloon inflation, about 20 min after they reach the lab
  if (bal) goalHit(p, 'd2b90', G.t + bal);
  if (G.pre) return;
  const S = G.stats;
  if (outcome === 'dc') { S.dc++; care(10, 'flow', p); if (p.tDone - p.tArrive <= 120) { care(5, 'flow', p); S.quick++; } }
  else if (outcome === 'admit' || outcome === 'icu' || outcome === 'bh' || outcome === 'obs') { S[outcome]++; care(12, 'flow', p); }
  else if (outcome === 'or') { S.or++; care(15, 'flow', p); toast(`${p.name} is off to the OR`, 'good', true); }
  else if (outcome === 'cath') { S.cath++; care(15, 'flow', p); toast(`${p.name} left for the cath lab ${Math.round(p.tDone - p.tArrive)} min after arrival${d2b ? `. The artery opens about ${bal} min later: that is the door-to-balloon time` : ''}`, 'good', true); }   // one time for leaving, one for the balloon: say which is which
  else if (outcome === 'tx') { S.tx++; care(12, 'flow', p); note(`${p.name} transferred to ${p.txTo}`); }
  else if (outcome === 'lwbs') { S.lwbs++; care(-25, 'lwbs'); }
  else if (outcome === 'ama') { S.ama++; care(-15, 'ama'); if (G.mode === 'md' && p.mine) care(-15, 'md'); }
  else if (outcome === 'expired') S.expired++;
  if (outcome !== 'expired' && p.tArrive >= 0) {
    if (outcome === 'lwbs') p.px = Math.min(p.px, 20);
    else if (outcome === 'ama') p.px = Math.min(p.px, 30);
    else if (outcome === 'dc' && p.tDone - p.tArrive <= 120) p.px = Math.min(100, p.px + 5);
    S.pxN = (S.pxN || 0) + 1; S.pxSum = (S.pxSum || 0) + clamp(p.px, 0, 100);
    if (p.px < 40 && outcome !== 'lwbs' && outcome !== 'ama') { S.complaints++; care(-5, 'experience'); }
  }
  if (outcome === 'dc' || outcome === 'lwbs' || outcome === 'ama') bounceRoll(p, outcome, wasLoc);
}

const WATCH_WHY = { od: 'naloxone wears off before the opioid does', asthma: 'wheezing can come back as the treatment wears off', anaph: 'the reaction can come back hours later' };
/* ---------- 72-hour returns ---------- */
function bounceRoll(p, outcome, wasLoc) {
  if (p.ret || G.train || (G.mode === 'md' && !p.mine)) return;
  let c = outcome === 'ama' ? 0.35 : outcome === 'lwbs' ? 0.12 : 0.02;
  let why = outcome === 'ama' ? 'Left against medical advice' : outcome === 'lwbs' ? 'Left without being seen' : 'Discharged; sometimes it just happens';
  if (outcome === 'dc') {
    const add = (x, w) => { c += x; if (x >= 0.04) why = w; };
    if (p.tRoom != null && p.tDone - p.tRoom < 35 && wasLoc === 'room' && p.dcTo !== 'rehab') add(0.04, `Discharged ${Math.round(p.tDone - p.tRoom)} min after they were roomed`);
    if (p.lang && p.interp !== 'on') add(0.12, `Discharged without a ${LANGS[p.lang]} interpreter`);
    if (p.gray) add(p.grayUnder ? 0.3 : 0.02, p.grayUnder ? `Sent home with a ${p.gray.band}-risk ${p.gray.tool}` : why);
    if (p.unsafeHome) add(0.5, 'Sent home when they couldn’t manage alone: they needed rehab');
    if (p.missedDx) add(0.35, `Missed on the first visit: ${p.missedDx.by} had ${p.missedDx.n} patients in line`);
    if (p.wrongHome) add(0.6, `Sent home when they needed ${DISPO_NAME[p.wrongHome] || 'admission'}`);
    if (p.earlyDc) add(0.6, `Sent home ${p.earlyDc.left} min early: ${p.earlyDc.why}`);
    if (p.txGap && p.txGap.length) add(0.3, `Went home without ${p.txGap.map(k => TREAT[k].label.toLowerCase()).join(' or ')}`);
  }
  if (!chance(c)) return;
  p.retWhy = why;
  const back = G.t + randi(60, 240);
  if (back >= G.shift) { G.stats.returnsLate++; return; }
  G.sched.push({ t: back, k: 'return', pid: p.id });
}
function returnVisit(orig) {
  const c = { k: orig.ck, cc: 'Back again: ' + orig.cc.toLowerCase(), dx: orig.dx + ', worse', esi: Math.max(2, orig.esi - 1), age: [orig.age, orig.age], sex: orig.sex,
    wk: Array.from(new Set(orig.wk.concat(['lab']))), tr: ['fluids', 'meds'], con: 'hosp', pre: ['lab'], dispo: 'admit', find: Object.assign({}, orig.find, { lab: (orig.find.lab || 'Labs') + '; worse than last visit' }) };
  const p = makePatient(c, orig.src === 'ems' || chance(0.4) ? 'ems' : 'walk');
  p.name = orig.name; p.lang = orig.lang; p.ret = true; p.retOf = orig.id;
  p.tArrive = G.t;
  if (p.src === 'ems') { p.unit = unitName(); p.loc = 'wall'; } else { p.loc = 'triage'; G.triageQ.push(p.id); }
  onArrive(p);
  G.stats.returns++; care(-20, 'returns', orig);
  (G.stats.returnList = G.stats.returnList || []).push({ name: orig.name, dx: orig.dx, why: orig.retWhy || 'Discharged' });
  mm(35, `${orig.name} came back within 72 hours, sicker`, orig.retWhy || 'Discharged', !!orig.mine);
  toast(`72-hour return: ${p.name} is back and sicker (${orig.outcome === 'ama' ? 'left against advice' : orig.outcome === 'lwbs' ? 'left without being seen' : 'discharged'} earlier)`, 'bad');
  sound('bad');
}

/* ---------- waiting room, ratios, morale, AMA (once per game minute) ---------- */
/* An active resuscitation (a code, or the first 20 minutes in the bay) takes a nurse and a half. */
function activeResus(p) { return p.esi === 1 && p.dsp === 'none' && p.loc === 'room' && (p.arrest || (!p.anyRoom && p.tRoom != null && G.t - p.tRoom < 20)); }   // anyRoom: one treatment now, not a resuscitation team
function weight(p) {
  if (p.dsp === 'family' || p.dsp === 'morgue' || p.dsp === 'morguing') return 1;
  const r = p.room ? room(p.room) : null;
  if (r && r.kind === 'chair') return 0.1;
  const boarding = isBoarder(p);
  if (RIDE.has(p.dsp)) return 1;   // waiting on a ride: light work
  if (p.esi === 1) return (p.dsp === 'watch' || p.dsp === 'ready' || p.dsp === 'dc' || p.dsp === 'dcing') ? 1 : boarding ? 2 : activeResus(p) ? 6 : 4;   // treated and only being watched: light work
  if (p.esi === 2) return (p.dsp === 'ready' || p.dsp === 'watch' || p.dsp === 'dc' || p.dsp === 'dcing' || (boarding && p.dispo !== 'icu')) ? 1 : 2;
  return 1;
}
function holdNurses() { return G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.zones.includes('hold')); }
function holds() { return inRooms().filter(isBoarder); }
function zoneLoad(z, skipHolds) { let L = 0; for (const r of G.rooms) if (r.z === z && r.pid) { const p = G.pts[r.pid]; if (skipHolds && isBoarder(p)) continue; L += weight(p); } return L; }
function holdLoad() { let L = 0; for (const p of holds()) L += weight(p); return L; }
function zonePts(z) { let n = 0; for (const r of G.rooms) if (r.z === z && r.pid) n++; return n; }
function zoneNurses(z) { return G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.zones.includes(z)); }
function nurseLoad(s) {
  const hn = holdNurses().length;
  let L = 0;
  for (const z of s.zones) {
    if (z === 'triage') continue;
    if (z === 'hold') { L += holdLoad() / (hn || 1); continue; }
    const n = zoneNurses(z).length || 1; L += zoneLoad(z, hn > 0) / n;
  }
  return L;
}
/* A hold nurse runs inpatient ratios (1:5). Everyone else runs ED ratios (1:4). */
function ratioCap(s) { return s.zones.length && s.zones.every(z => z === 'hold') ? 5 : 4; }
/* A crash is not one thing. What the monitor shows, what it turns out to be, and what the patient now needs all follow from what was wrong.
   Nobody who crashed goes home afterwards. */
const CRASH = {
  nstemi:  { v: { hr: 118, sbp: 82, dbp: 54, rr: 26, spo2: 90 }, sign: 'cool and clammy', dx: 'NSTEMI with cardiogenic shock', add: ['o2', 'pressor'], con: 'cards', dispo: 'icu' },
  // audit phase 1 (R6-06): unstable A-fib (low pressure, chest pain) gets synchronized cardioversion, not fluids; rate-control drugs are out
  afib:    { v: { hr: 174, sbp: 80, dbp: 50, rr: 24, spo2: 94 }, sign: 'chest pain, about to pass out', dx: 'A-fib with rapid rate, unstable', add: ['cardiovert'], drop: ['meds'], con: 'cards', dispo: 'icu' },
  chb:     { v: { hr: 28, sbp: 72, dbp: 40, rr: 22, spo2: 94 }, sign: 'gray and sweaty', dx: 'Complete heart block, unstable', add: [], con: 'cards', dispo: 'icu' },
  gib:     { v: { hr: 138, sbp: 74, dbp: 46, rr: 26, spo2: 96 }, sign: 'pale, vomiting blood again', dx: 'Upper GI bleed with hemorrhagic shock', add: [], con: 'gi', dispo: 'icu' },
  dka:     { v: { hr: 136, sbp: 84, dbp: 48, rr: 34, spo2: 98 }, sign: 'deep fast breathing, hard to wake', dx: 'Severe diabetic ketoacidosis', add: [], con: 'icu', dispo: 'icu' },
  asthma:  { v: { hr: 142, sbp: 132, dbp: 84, rr: 36, spo2: 84 }, sign: 'can’t speak, tiring out', dx: 'Asthma attack with respiratory failure', add: ['bipap'], con: 'icu', dispo: 'icu' },
  copd:    { v: { hr: 122, sbp: 148, dbp: 88, rr: 34, spo2: 80 }, sign: 'drowsy, barely moving air', dx: 'COPD flare with respiratory failure', add: [], con: 'icu', dispo: 'icu' },
  chf:     { v: { hr: 126, sbp: 198, dbp: 114, rr: 36, spo2: 82 }, sign: 'pink frothy sputum, bolt upright', dx: 'Flash pulmonary edema', add: [], con: 'icu', dispo: 'icu' },
  od:      { v: { hr: 54, sbp: 96, dbp: 58, rr: 5, spo2: 80 }, sign: 'blue lips, won’t wake', dx: 'Opioid overdose: the naloxone wore off', add: ['o2'], con: 'hosp', dispo: 'admit' },
  anaph:   { v: { hr: 138, sbp: 72, dbp: 40, rr: 30, spo2: 88 }, sign: 'stridor, swollen tongue', dx: 'Anaphylactic shock', add: ['o2', 'fluids'], con: 'hosp', dispo: 'admit' },
  sepsisw: { v: { hr: 132, sbp: 76, dbp: 42, rr: 28, spo2: 91, temp: 103.1 }, sign: 'mottled, confused', dx: 'Septic shock (urinary source)', add: ['o2', 'pressor'], con: 'icu', dispo: 'icu' },
  strokew: { v: { hr: 58, rr: 12, spo2: 95 }, sign: 'now hard to wake', dx: 'Acute ischemic stroke, getting worse', add: [], dispo: 'icu', bp: [212, 116] },
  mciyel:  { v: { hr: 134, sbp: 82, dbp: 50, rr: 26, spo2: 95 }, sign: 'pale, thigh swelling fast', dx: 'Femur fracture with hemorrhagic shock', add: ['blood'], con: 'trauma', dispo: 'icu', bleed: 'prbc' },
};
const CRASH_ANY = { v: { hr: 128, sbp: 84, dbp: 50, rr: 26, spo2: 93 }, sign: 'pale and sweaty' };
function crashSetup(p) {
  const c = CRASH[p.ck] || CRASH_ANY, n = vNormal(p.age), kid = p.age < 13, v = {};
  for (const k in c.v) v[k] = kid && k in VADULT ? n[k] + (c.v[k] - VADULT[k]) * (k === 'sbp' || k === 'dbp' ? 0.3 : 1) : c.v[k];
  v.sign = c.sign; p.crashV = v;
  p.dx = c.dx || `${p.dx}, now unstable`;
  for (const k of c.add || []) if (!p.tr.includes(k)) p.tr.push(k);
  if (c.drop) { p.tr = p.tr.filter(k => !c.drop.includes(k) || (p.treat[k] && p.treat[k].st === 'done')); if (p.right) p.right.tr = p.right.tr.filter(k => !c.drop.includes(k)); }
  if (c.add && p.right) for (const k of c.add) if (!p.right.tr.includes(k)) p.right.tr.push(k);
  if (c.con) p.con = c.con; else if (!p.con) p.con = 'hosp';
  p.dispo = c.dispo || (p.dispo === 'home' || p.dispo === 'obs' ? 'admit' : p.dispo);
  if (c.bleed && !p.bleed) p.bleed = c.bleed;
  if (c.bp) { p.bp0 = c.bp.slice(); if (!p.tr.includes('bp')) p.tr.unshift('bp'); }
  p.amaMul = 1;
}
/* The rhythm line has to agree with the monitor: a rate of 127 is not "normal sinus rhythm". */
function ecgRead(p) {
  const hr = Math.round(vRaw(p, G.t).v.hr), f = p.find.ecg || NORMAL.ecg;
  if (/^Normal sinus rhythm/.test(f)) p.find.ecg = hr > 100 ? `Sinus tachycardia, rate ${hr}` : hr < 60 ? `Sinus bradycardia, rate ${hr}` : `Normal sinus rhythm, rate ${hr}`;
  else if (/rate \d+/.test(f)) p.find.ecg = f.replace(/rate \d+/, `rate ${hr}`);
  else if (/^Sinus tachycardia \d+/.test(f)) p.find.ecg = f.replace(/^Sinus tachycardia \d+/, `Sinus tachycardia ${hr}`);
  else if (/^Sinus tach, /.test(f) && hr <= 100) p.find.ecg = f.replace('Sinus tach, ', 'Sinus rhythm, ');
}
function crash(p) {
  const waited = Math.round(G.t - (p.tTriage != null ? p.tTriage : p.tArrive)), shown = vEsi(p);
  const why = p.esiT != null ? `Under-triaged as ESI ${shown} and never rechecked`
    : p.loc === 'triage' ? `Waited ${Math.round(G.t - p.tArrive)} min ${p.reg === 'none' ? 'and nobody registered them' : p.tri === 'none' ? 'and no nurse was sent to triage them' : 'in the triage line'}`
    : `ESI ${p.esi} waited ${waited} min for a bed. ${crowdWhy()}.`;
  mm(60, `${p.name} crashed in the ${p.loc === 'waiting' ? 'waiting room' : 'triage line'}`, why);
  p.esi = 1; p.esiT = null; p.crash = true; p.tCrash = G.t;
  crashSetup(p);
  if (G.pre) return;
  G.stats.wrCrash++; care(-20, 'waiting');
  toast(`${p.name} is crashing in the waiting room. Get them into a resus bay.`, 'alert'); sound('alarm');
}
function toArrest(p, where) {
  p.arrest = true; p.alert = 'arrest'; p.alertOn = true; p.dxK = true; p.cc = where; p.dx = 'Cardiac arrest';
  p.wk = []; p.tr = []; p.con = null; p.pre = []; p.need = null; p.dispo = 'code'; p.ev = 'none'; p.dsp = 'none';
  p.tArrest = G.t; p.code = null; p.ord = null; p.right = null; p.txGap = null; p.dxq = null;
  if (p.prov) {
    const s = staff(p.prov); if (s) s.q = s.q.filter(k => k.pid !== p.id || k.started);
    // Audit phase 1 (R5-01): the provider who has the patient runs the code. Another provider queues it at once; the attending's own
    // patient shows "Run the code" on the card. Someone not here (gone home, on a break) leaves the patient for anyone to take.
    if (!s || !present(s) || p.loc !== 'room') p.prov = null;
    else if (!(G.mode === 'md' && s.id === G.me)) { p.ev = 'q'; addTask(s, { type: 'code', pid: p.id, dur: 15, label: 'Code' }); }
  }
}
function waitingArrest(p) {
  toArrest(p, 'Arrested in the waiting room');
  mm(95, `${p.name} went into cardiac arrest in the waiting room`, `They crashed ${Math.round(G.t - p.tCrash)} min earlier and never got a resus bay`);
  if (G.pre) return;
  G.stats.wrCodes++; care(-60, 'waiting');
  toast(`CODE BLUE in the waiting room: ${p.name}`, 'alert'); sound('alarm');
}
function adverse(s) {
  const all = G.rooms.filter(r => r.pid && s.zones.includes(r.z)).map(r => G.pts[r.pid]);
  const list = all.filter(p => !p.fell);
  if (!list.length) return;
  const p = pick(list); p.fell = true;
  G.stats.adverse++; care(-30, 'safety'); s.morale -= 5;
  mm(50, `${p.name} fell in ${roomName(p.room)}`, `${s.name} was covering ${zoneList(s.zones.filter(z => z !== 'triage'))} with a load of ${nurseLoad(s).toFixed(1)} against a limit of ${ratioCap(s)}`);
  toast(`Safety event: ${p.name} in ${roomName(p.room)} fell getting up alone. ${s.name} had too many patients.`, 'bad'); sound('bad');
}
/* A bleed that needs blood (not the massive protocol) and gets nothing: no fluids, no labs drawn, no blood on the way.
   Shock at 75 minutes, arrest at two hours. With ordinary care this never fires. */
function bleedNeglect(p) {
  if (p.bleed !== 'prbc' || p.arrest || p.dsp !== 'none' || G.pre || G.train || p.bb) return;
  const it = k => p.treat[k] && (p.treat[k].st === 'done' || p.treat[k].st === 'doing');
  if (it('fluids') || it('blood') || it('mtp')) return;
  const el = G.t - p.tArrive, own = !p.prov || !!p.mine;
  if (el > 75 && !p.shock) {
    p.shock = true; G.stats.shock++; care(-20, 'blood', p);
    if (p.loc !== 'room') { p.esi = 1; p.esiT = null; }
    mm(70, `${label(p)} went into hemorrhagic shock`, `The bleeding went ${Math.round(el)} min with no fluids and no blood`, own);
    toast(`${label(p)} is in hemorrhagic shock. ${p.loc === 'room' ? 'They need fluids and blood now.' : 'Get them into a resus bay.'}`, 'alert'); sound('alarm');
  }
  if (el > 120) {
    toArrest(p, 'Arrested after an untreated bleed'); p.bleed = null; p.shock = false; care(-60, 'blood', p);
    mm(95, `${p.name} bled until their heart stopped`, 'Two hours with no fluids and no blood', own);
    toast(`${label(p)} lost pulses. The bleeding was never treated.`, 'alert'); sound('alarm');
  }
}
function hemorrhageTick(p) {
  bleedNeglect(p);
  if (p.bleed !== 'mtp' || p.bb || p.arrest || p.dsp !== 'none') return;
  const el = G.t - p.tArrive;
  if (el > 15 && !p.shock) {
    p.shock = true; G.stats.shock++; care(-20, 'blood', p);
    mm(70, `${label(p)} went into hemorrhagic shock`, 'Massive transfusion wasn’t activated in the first 15 min', !p.prov || !!p.mine);
    toast(`${label(p)} is in hemorrhagic shock. Activate the massive transfusion protocol!`, 'alert'); sound('alarm');
  }
  if (el > 30) {
    toArrest(p, 'Traumatic arrest after hemorrhage'); p.traumatic = true; p.bleed = null; p.shock = false; care(-60, 'blood', p);
    toast(`${label(p)} lost pulses: traumatic arrest. They needed blood.`, 'alert'); sound('alarm');
  }
}
function amaRisk(p) {
  if (G.train) return 0;
  if (p.loc !== 'room' || p.alertOn || p.esi <= 1 || p.arrest || p.vip) return 0;
  if (!(p.dsp === 'none' || p.dsp === 'board' || p.dsp === 'decide')) return 0;
  if (G.t < p.amaSafe) return 0;
  const waited = G.t - p.tRoom;
  if (waited < 90 && !(p.ck === 'od' && p.treat.nalox && p.treat.nalox.st === 'done')) return 0;
  return 0.0008 * Math.min(3, 1 + Math.max(0, waited - 90) / 60) * p.amaMul * (p.lang && p.interp !== 'on' ? 1.5 : 1) * (p.dsp === 'board' ? 0.7 : 1);
}
function minuteTick() {
  lawTick();
  const t = G.t;
  let amaCand = null;
  obsTick();
  bedTick();
  regionTick();
  for (const p of active()) {
    if (p.loc === 'triage') {
      if (p.esi >= 3 && p.tri !== 'doing' && t - p.tArrive > p.patience * 0.8) { toast(`${p.name} left before triage after ${Math.round(t - p.tArrive)} min`, 'bad'); mm(22, `${p.name} left before triage after ${Math.round(t - p.tArrive)} min`, p.reg === 'none' ? 'Nobody registered them' : 'No nurse got to their triage'); leave(p, 'lwbs'); continue; }
      if (!G.train && p.esi === 2 && !p.crash && !p.alertOn && t - p.tArrive > 20 && chance(0.012) && !p.gray && p.ck !== 'bh') crash(p);   // a gray-zone patient (sent home or to obs on a risk score) does not crash
    }
    if (p.loc === 'waiting') {
      if (p.esi >= 3 && t - p.tTriage > p.patience && !p.pitDcQ) { toast(`${p.name} (ESI ${vEsi(p)}) left without being seen after ${Math.round(t - p.tArrive)} min`, 'bad'); mm(25, `${p.name} (ESI ${vEsi(p)}) left without being seen after ${Math.round(t - p.tArrive)} min`, crowdWhy()); leave(p, 'lwbs'); continue; }
      if (!G.train && p.esi === 2 && !p.crash && !p.alertOn && t - p.tTriage > 30 && chance(0.012) && !p.gray && p.ck !== 'bh') crash(p);
    }
    screenTick(p);
    if (p.crash && !p.arrest && p.loc !== 'room' && t - p.tCrash > 15) waitingArrest(p);
    hemorrhageTick(p);
    if (G.pre) continue;
    if (mdMine(p)) {
      if ((p.ord === 'need' || p.ord === 'more') && p.loc === 'room') { p.ordWait = (p.ordWait || 0) + 1; if (p.ordWait > 15) care(-0.3, 'md'); }
      if (p.dsp === 'mddecide' || p.dsp === 'decide' || p.dxq) { p.decWait = (p.decWait || 0) + 1; if (p.decWait > 15) care(-0.3, 'md'); }
      if (p.ev === 'q' && p.loc === 'room') { p.queueWait = (p.queueWait || 0) + 1; if (p.queueWait > 30) care(-0.2, 'md'); }
    }
    if (mdMine(p) && p.txGap && p.txGap.length && !p.txHarm && t - p.tGap > 20) {
      p.txHarm = true; G.stats.md.untreated++; care(-20, 'harm', p); litAdd(MUST.has(p.ck) ? 10 : 5, 'left untreated for 20 minutes', p);
      mm(50, `${p.name} got worse without ${p.txGap.map(k => TREAT[k].label.toLowerCase()).join(' or ')}`, 'It was never ordered', true);
      toast(`${label(p)} is getting worse. Something they need was never ordered.`, 'bad'); sound('bad');
    }
    // Patient experience: an hour without an update starts to cost you.
    const heard = p.lastUpdate != null ? p.lastUpdate : (p.loc === 'room' && p.tRoom != null ? p.tRoom : p.tArrive);
    if (t - heard > 60) p.px -= 0.2;
    if (p.loc === 'wall') {
      const w = t - p.tArrive;
      if (w > 30) care(-0.5, 'wall');
      if (w > 60) { G.ev.regionDue = true; G.ev.wall60 = true; }
    } else if (p.loc === 'room') {
      const r = roomOf(p);
      if (p.sitter && !r.safe && !p.sitBy) { care(-0.5, 'sitter'); warnOnce('sit' + p.id, `${roomName(r.id)} needs a sitter and no PCT is free`, 30); }
      if (r.kind === 'hall') { care(-0.1, 'hall'); p.px -= 0.05; G.stats.hallMins++; }
      if (r.kind === 'chair' && isBoarder(p)) { care(-0.15, 'chair'); warnOnce('chb' + p.id, `${p.name} is admitted and sitting in a chair. Get them a bed.`, 30); }
      if (!amaCand && chance(amaRisk(p))) amaCand = p;
    }
  }
  if (G.pre) return;
  if (amaCand && !G.card && t - G.ev.lastAma > 45) amaCard(amaCand);
  const SM = G.stats.staffMins;
  for (const s of G.staff) if (present(s)) { const k = s.role === 'rn' ? (s.tag === 'agency' ? 'rnAgency' : s.tag === 'mandated' ? 'rnMandated' : 'rn') : s.role; SM[k] = (SM[k] || 0) + 1; }
  for (const s of G.staff) {
    if (s.role !== 'rn' || s.st !== 'on') continue;
    const over = nurseLoad(s) - ratioCap(s);
    if (over > 0.01) { care(-0.15 * over, 'ratio'); s.morale -= 0.12 * over; G.stats.ratioMin += over; if (!G.train && chance(0.002 * over)) adverse(s); }
  }
  const hn = holdNurses().length;
  for (const z of ZONES) {
    let n = 0; for (const r of G.rooms) if (r.z === z.id && r.pid && !(hn && isBoarder(G.pts[r.pid]))) n++;
    if (n && !zoneNurses(z.id).length) { care(-0.5 * n, 'uncovered'); G.stats.uncovered += n; if (G.mode !== 'md') warnOnce('unc' + z.id, `${z.name} has ${n} patient${n > 1 ? 's' : ''} and no nurse. Tap the ${z.name} header.`, 15); }
  }
  for (const s of G.staff) {
    if (!present(s)) continue;
    if (s.st === 'break') s.morale += 0.5;
    else {
      if (t - s.lastBreak > 300) s.morale -= 0.06;
      if (isProv(s) && s.q.length > 5) s.morale -= 0.04 * (s.q.length - 5);
      if (s.morale < 70) s.morale += 0.015;
    }
    s.morale = clamp(s.morale, 0, 100);
  }
  const ar = inRooms().filter(activeResus);
  if (ar.length) { const rn = zoneNurses('resus').length; if ((!rn || zoneLoad('resus', hn > 0) / rn > 4) && G.mode !== 'md') warnOnce('resus2', `Active resuscitation in ${ar.map(p => roomName(p.room)).join(' and ')}. Resus needs another nurse: tap the Resus header and add one.`, 20); }
  for (const k in G.spec) { const m = G.spec[k]; if (m.mood < 0 && t - m.at > 60) { m.mood++; m.at = t; } }
  outageTick();
  for (const k in DIVERTS) {
    const d = G.dv[k], D = DIVERTS[k];
    if (!d.on) continue;
    d.mins++;
    if (D.capacity) { care(-D.cost, 'divert'); if (t - d.since > 90) G.ev.regionDue = true; continue; }
    if (justified(k)) { care(-D.cost, 'divert'); d.unjust = 0; continue; }
    care(-0.6, 'divert'); d.unjust++; G.stats.divertExtra++;
    const log = G.stats.outLog.slice().reverse().find(x => OUTAGES[x.k].fix === k); if (log && log.t1 <= t) log.after++;
    if (d.unjust === 10) toast(`${D.name} is still on and nothing is broken. Ambulances are driving past you.`, 'bad');
    if (d.unjust > 20) G.ev.regionDue = true;
  }
  if (staffSat() < 20 && G.mode !== 'md') endShift('walkout');   // the attending doesn't run staffing
}
/* ---------- keeping people informed ---------- */
function updatePt(pid) {
  const p = pt(pid);
  if (!p || !['room', 'waiting'].includes(p.loc)) return { ok: false, why: 'Pick a patient in a room or the waiting room' };
  if (p.lastUpdate != null && G.t - p.lastUpdate < 30) return { ok: false, why: `${p.name} got an update ${Math.round(G.t - p.lastUpdate)} min ago` };
  p.lastUpdate = G.t; p.px = Math.min(100, p.px + 8); p.amaSafe = Math.max(p.amaSafe, G.t + 45);
  if (!G.pre) G.stats.updates++;
  return { ok: true, msg: `You updated ${label(p)} on the plan and the wait. They feel heard.` };
}
function updateWaiting() {
  const list = active().filter(p => p.loc === 'waiting' || p.loc === 'triage');
  if (!list.length) return { ok: false, why: 'Nobody is waiting' };
  if (G.t - G.wrUpdate < 30) return { ok: false, why: `You walked the waiting room ${Math.round(G.t - G.wrUpdate)} min ago` };
  G.wrUpdate = G.t;
  for (const p of list) { p.lastUpdate = G.t; p.px = Math.min(100, p.px + 5); p.patience += 20; }
  if (!G.pre) G.stats.updates++;
  return { ok: true, msg: `You walked the waiting room and gave ${list.length} ${list.length > 1 ? 'people' : 'person'} an honest update. Fewer will walk out.` };
}
/* A triage nurse rechecks someone in the waiting room. This is how under-triage gets caught. */
function recheck(pid, sid) {
  const p = pt(pid), s = staff(sid);
  if (!p || p.loc !== 'waiting') return { ok: false, why: 'Rechecks are for patients in the waiting room' };
  if (!s || s.role !== 'rn') return { ok: false, why: 'Pick a nurse' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} is away` };
  if (s.skill === 'new') return { ok: false, why: `${s.name} is a new grad and isn't triage-trained yet` };
  if (s.tq.some(k => k.pid === pid && k.kind === 'recheck')) return { ok: false, why: `${s.name} already has that recheck` };
  if (p.lastRecheck != null && G.t - p.lastRecheck < 20) return { ok: false, why: `${p.name} was rechecked ${Math.round(G.t - p.lastRecheck)} min ago` };
  s.tq.push({ pid, kind: 'recheck' });
  return { ok: true, msg: `${s.name} will recheck ${p.name}'s vitals` };
}
/* Neighboring hospitals go on and off alert. If too many are on at once, the region suspends everyone. */
function regionTick() { inStream('rngE', regionTick0); }
function regionTick0() {
  if (G.train) return;
  const R = G.region, t = G.t;
  for (const h of R.hosps) {
    if (h.st === 'open') { if (t > R.susp && chance(0.002)) { h.st = 'yellow'; h.since = t; h.hold = t + 30; note(`${h.name} went on ED Full. Expect more ambulances.`); } }
    else if (t > h.hold && chance(0.02)) { h.st = 'open'; note(`${h.name} came off ED Full`); }
  }
  if (G.pre) return;
  const mine = G.dv.yellow.on || G.dv.red.on;
  const n = R.hosps.filter(h => h.st !== 'open').length + (mine ? 1 : 0);
  if (n >= 3 && R.susp < t) {
    R.susp = t + 60;
    for (const h of R.hosps) { h.st = 'open'; h.hold = 0; }
    G.dv.yellow.on = false; G.dv.red.on = false;
    G.stats.suspended++;
    toast(`Regional suspension: ${n} of ${R.hosps.length + 1} hospitals were on capacity alerts. The region lifted them all for 60 min. Everyone takes ambulances.`, 'alert'); sound('alarm');
  }
}
function staffSat() { let n = 0, sum = 0; for (const s of G.staff) if (present(s)) { n++; sum += s.morale; } return n ? sum / n : 0; }

/* ---------- staff status: breaks, absences, arrivals ---------- */
function startCover(s) {
  if (s.role !== 'rn' || !s.zones.length) return null;
  const fl = G.staff.filter(x => x.role === 'rn' && x.float && x.id !== s.id && x.st === 'on').sort((a, b) => a.zones.length - b.zones.length);
  const f = fl[0]; if (!f) return null;
  const add = s.zones.filter(z => !f.zones.includes(z));
  if (add.length) { f.zones.push(...add); f.cover.push({ from: s.id, zones: add }); }
  return f;
}
function endCover(s) {
  for (const f of G.staff) {
    if (!f.cover.length) continue;
    f.cover = f.cover.filter(c => { if (c.from !== s.id) return true; f.zones = f.zones.filter(z => !c.zones.includes(z)); return false; });
  }
}
function revertTask(s) {
  releaseQueues(s);
  const k = s.task; s.task = null;
  if (!k) return;
  if (k.kind === 'clean') { const r = room(k.room); if (r && r.st === 'cleaning') { r.st = 'dirty'; if (!G.evsQ.includes(r.id)) G.evsQ.unshift(r.id); } return; }
  const p = k.pid ? pt(k.pid) : null;
  if (!p) return;
  if (k.kind === 'assess' && p.rn === 'doing') p.rn = 'todo';
  if ((k.kind === 'treat' || k.kind === 'rt') && p.treat[k.key] && p.treat[k.key].st === 'doing') p.treat[k.key].st = 'todo';
  if (k.kind === 'verify' && p.treat[k.key]) p.treat[k.key].vby = null;
  if (k.kind === 'dc' && p.dsp === 'dcing') p.dsp = 'dc';
  if (k.kind === 'triage') p.triaging = false;
  if (k.kind === 'ecg' && p.work.ecg && p.work.ecg.st === 'doing') p.work.ecg.st = 'todo';
  if (k.kind === 'poc' && p.work.poc && p.work.poc.st === 'doing') p.work.poc.st = 'todo';
  if (k.kind === 'lab' && p.work.lab && p.work.lab.st === 'doing') p.work.lab.st = 'todo';
  if (k.kind === 'walk' && p.dsp === 'xportq') p.dsp = 'bedready';
  if (k.kind === 'reg' && p.reg === 'doing') { p.reg = 'none'; p.regBy = null; }
  if (k.kind === 'reg' && p.reg === 'fdoing') { p.reg = p.quick ? 'quick' : 'none'; p.regBy = null; }
  if (k.kind === 'report' && p.dsp === 'reporting') p.dsp = 'callrep';
  if (k.kind === 'recheck') return;
  if (k.kind === 'triage' && p.tri === 'doing') { p.tri = 'none'; p.triBy = null; }
  if (k.kind === 'morgue' && p.dsp === 'morguing') p.dsp = 'morgue';
  if (k.kind === 'run' && p.bb && p.bb.st === 'run') p.bb.st = 'cooler';
  if (k.kind === 'sit' && p.sitBy === s.id) p.sitBy = null;
}
function orphanPatients(s) {
  for (const k of s.q) {
    const p = k.pid ? pt(k.pid) : null; if (!p) continue;
    if ((k.type === 'eval' || k.type === 'code') && (p.ev === 'q' || p.ev === 'doing')) { p.ev = 'none'; p.tNeed = G.t; }
    if (k.type === 'reassess' && (p.re === 'q' || p.re === 'doing')) { p.re = 'need'; p.tNeed = G.t; }
    if (k.type === 'proc' && p.treat[k.key] && (p.treat[k.key].st === 'q' || p.treat[k.key].st === 'doing')) p.treat[k.key].st = 'todo';
    if (k.type === 'pit') p.pitQ = false;
    if (k.type === 'pitdc') p.pitDcQ = false;
    if (k.type === 'cosign' && p.cosign === 'need') p.cosign = 'wait';
  }
  s.q = [];
  for (const p of active()) if (p.prov === s.id) { p.prov = null; if (p.loc === 'room' && p.ev === 'done' && !p.dxK && (p.re === 'q' || p.re === 'doing')) p.re = 'need'; }
}
function staffGone(s, newSt) {
  revertTask(s);
  if (isProv(s)) orphanPatients(s);
  s.st = newSt; s.q = []; s.pit = false;
}
function staffTick() {
  const t = G.t;
  for (const s of G.staff) {
    if (s.st === 'break' && t >= s.until) { s.st = 'on'; s.lastBreak = t; endCover(s); note(`${s.name} is back from break`); }
    else if (s.st === 'away' && t >= s.until) { s.st = 'on'; endCover(s); toast(`${s.name} is back`, 'good', true); }
    else if (s.st === 'pending' && t >= s.until) { s.st = 'on'; s.lastBreak = t; if (s.tag !== 'swing shift' && s.tag !== 'Fast Track 09:00') { for (const z of s.zones) if (z !== 'ft' && G.rooms.some(r => r.z === z && r.closed)) setZoneClosed(z, false); toast(`${s.name} arrived${s.zones.length ? ' and took ' + zoneList(s.zones) + ', and it’s open' : ''}`, 'good', true); } }
    if (s.leaveAt != null && t >= s.leaveAt && (s.st === 'on' || s.st === 'break')) {
      const zs = s.zones.slice();
      staffGone(s, 'gone');
      toast(`${s.name}'s mandated hours are up. They went home.`, 'info', true);
      const unc = zs.filter(z => zoneNurses(z).length === 0 && zonePts(z));
      if (unc.length && !G.card && !G.pre) coverageCard(unc[0], 'Coverage gap', `**${s.name}** went home. **${ZONE_NAME[unc[0]]}** has patients and **no nurse**.`);
    }
  }
}
function sendBreak(sid) {
  const s = staff(sid); if (!s) return { ok: false, why: 'Unknown staff member' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} is away` };
  if (isProv(s) && s.q[0] && s.q[0].started) return { ok: false, why: `${s.name} is with a patient. Try again in a minute.` };
  revertTask(s);
  s.st = 'break'; s.until = G.t + 30;
  const f = s.role === 'rn' ? startCover(s) : null;
  let extra = '';
  if (s.role === 'rn') extra = f ? `. ${f.name} is covering.` : '. Nobody is covering their patients.';
  if (s.role === 'rph') extra = '. Med verification stops until they’re back (override if you must).';
  return { ok: true, msg: `${s.name} is on break for 30 min${extra}` };
}
function toggleZone(sid, z) {
  const s = staff(sid); if (!s || s.role !== 'rn') return { ok: false, why: 'Only nurses cover zones' };
  if (s.zones.includes(z)) { s.zones = s.zones.filter(x => x !== z); return { ok: true, msg: `${s.name} no longer covers ${ZONE_NAME[z]}` }; }
  if (s.skill === 'new' && (z === 'resus' || z === 'triage')) return { ok: false, why: `${s.name} is a new grad and isn't ${z === 'resus' ? 'resus' : 'triage'}-trained yet` };
  s.zones.push(z);
  return { ok: true, msg: `${s.name} now covers ${ZONE_NAME[z]}` };
}
function setZoneClosed(z, closed) {
  if (closed && zonePts(z)) return { ok: false, why: 'Move the patients out first' };
  for (const r of G.rooms) if (r.z === z) r.closed = closed;
  return { ok: true, msg: `${ZONE_NAME[z]} ${closed ? 'closed' : 'reopened'}` };
}
function callAgency(z) {
  if (G.mods.noAgency) return { ok: false, why: 'The CFO froze agency spending' };
  const nm = ['Taylor', 'Morgan', 'Riley', 'Jamie', 'Avery'][G.agN % 5]; G.agN++;
  const s = mkStaff({ id: 'ag' + (G.sid++), role: 'rn', name: nm + ' (agency)', short: nm, zones: [z], tag: 'agency' });
  s.st = 'pending'; s.until = G.t + 40; s.morale = 75;
  G.staff.push(s); G.stats.agency++; care(-10, 'staffing');
  return { ok: true, msg: `Agency RN ${nm} is on the way for ${ZONE_NAME[z]} (about 40 min)` };
}
function mandate(z) {
  const nm = ['Ellis', 'Quinn', 'Harper', 'Drew'][G.stats.mandates % 4];
  const s = mkStaff({ id: 'mn' + (G.sid++), role: 'rn', name: nm + ' (mandated)', short: nm, zones: [z], tag: 'mandated' });
  s.morale = 32; s.leaveAt = G.t + 240;
  G.staff.push(s); G.stats.mandates++;
  for (const x of G.staff) if (present(x)) x.morale -= 4;
  toast(`${nm} was mandated to stay for ${ZONE_NAME[z]}. Nobody is happy about it.`, 'info');
}
function orderPizza() {
  if (G.pizza) return { ok: false, why: 'You already bought pizza this shift' };
  G.pizza = true;
  for (const s of G.staff) if (present(s)) s.morale = Math.min(100, s.morale + 10);
  return { ok: true, msg: 'Pizza for the department, on your card. Morale up.' };
}
function setDivert(kind, on) {
  const D = DIVERTS[kind], d = G.dv[kind];
  if (!D) return { ok: false, why: 'Unknown status' };
  if (on && D.capacity && G.region.susp > G.t) return { ok: false, why: `The region suspended capacity alerts until ${clock(G.region.susp)}` };
  if (on && D.capacity && G.mods.noDivert > G.t) return { ok: false, why: 'Administration ordered no divert right now' };
  if (d.on === on) return { ok: true, msg: on ? `Already on ${D.name}` : `${D.name} is off` };
  d.on = on; d.unjust = 0; if (on) d.since = G.t;
  if (!on) return { ok: true, msg: `${D.name} lifted` };
  if (!D.capacity) creditDivert(kind);
  return { ok: true, msg: `${D.name}: ${D.what}` };
}
function setYellow(on) { return setDivert('yellow', on); }

/* ---------- the Box ---------- */
function nextScen() {
  const list = SCEN[G.pack] || SCEN.national;
  if (!G.box.scen.length) {
    const idx = list.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    G.box.scen = idx;
  }
  return G.box.scen.pop();
}
const TRAIN_SCEN = { q: '34-year-old male with a twisted ankle. He’s awake, thinking clearly, and understands the risks. He doesn’t want the ride to the hospital. OK to accept the refusal?', a: true,
  why: 'An adult who is thinking clearly and understands the risks may refuse care. The medic writes it down and tells him to call back if it gets worse.' };
const TRAIN_SCENS = { train: TRAIN_SCEN,
  tdose: { q: '5-year-old, 20 kg, seizing for 6 minutes. No IV. Requesting intranasal midazolam, 0.2 mg per kg. What dose?', opts: ['4 mg intranasal', '2 mg intranasal', '8 mg intranasal', '10 mg intranasal'], r: 0, why: '0.2 mg/kg × 20 kg = 4 mg, split between the nostrils. Say the math out loud and have the medic read it back.' },
  tord: { q: 'Stabbed in the right chest. No breath sounds on the right, trachea shifted left, BP 70/30. What do you order?', opts: ['Needle decompression of the right chest', 'Needle decompression of the left chest', 'High-flow oxygen and a fast transport', 'CPAP'], r: 0, why: 'Tension pneumothorax is diagnosed at the bedside, not on an X-ray. Decompress now. CPAP pushes more air into the chest and makes it worse.' } };
const scenOf = c => (TRAIN_SCENS[c.sc] || (SCEN[c.pk || G.pack] || SCEN.national)[c.sc] || SCEN.national[c.sc] || SCEN.national[0]);
function surveyMul() { return G.mods.survey > G.t ? 2 : 1; }
function boxTick(dt) {
  const b = G.box, L = LEVELS[G.level];
  if (G.t >= b.nextC) { b.q.push({ kind: 'consult', sc: nextScen(), pk: G.pack, unit: 'Medic ' + randi(2, 49), id: ++b.seq }); b.nextC = G.t + randi(L.consult[0], L.consult[1]); }
  if (!b.cur && b.q.length) { const c = b.q.shift(); c.ring = c.kind === 'notify' ? 20 : 10; c.left = c.ring; c.t0 = G.t; b.cur = c; sound('ring'); }
  if (b.cur && !b.cur.taken) { b.cur.left -= dt; if (b.cur.left <= 0) missBox(); }
}
function missBox() {
  const c = G.box.cur; G.box.cur = null;
  if (!c) return;
  if (c.kind === 'notify') { const p = pt(c.pid); if (p) missNotify(p); return; }
  G.stats.boxC.miss++; care(-30 * surveyMul(), 'box');
  { const sc = scenOf(c); (G.stats.radioLog = G.stats.radioLog || []).push({ q: sc.plain || sc.q, miss: true, a: sc.a, why: sc.pwhy || sc.why, btn: sc.btn || null, right: sc.opts ? sc.opts[sc.r] : null }); }
  toast(`Missed radio call. ${c.unit} rolled to another hospital's physician.`, 'bad'); sound('bad');
  G.ev.missedC++; if (G.ev.missedC >= 2) G.ev.regionDue = true;
}
function missNotify(p) {
  p.missN = true;
  if (G.pre) return;
  G.stats.boxN.miss++; care(-20, G.mode === 'md' ? 'boxn' : 'box');
  toast(`Missed the ${ALERTS[p.alert].name} report. ${p.unit} is coming in unannounced.`, 'bad'); sound('bad');
}
function boxNotify() {
  const c = G.box.cur; if (!c || c.kind !== 'notify') return { ok: false, why: 'No report on the line' };
  const p = pt(c.pid); G.box.cur = null;
  p.pren = true; G.stats.boxN.ans++; care(5, G.mode === 'md' ? 'boxn' : 'box');
  return { ok: true, msg: `Report taken: ${ALERTS[p.alert].name}, ${ageSex(p)}, ETA ${Math.max(1, Math.round(p.eta - G.t))} min. ${ALERTS[p.alert].team}.${p.tag ? ` ${p.tag.charAt(0).toUpperCase() + p.tag.slice(1)} tag from the bus crash.` : ''}${p.bleed === 'mtp' ? ' EMS says pale and hypotensive.' : ''}${p.lkwT != null ? ` Last known well ${clock(p.lkwT)}.` : ''}` };
}
function boxTake(sid) {
  const c = G.box.cur, s = staff(sid);
  if (!c || c.kind !== 'consult' || c.taken) return { ok: false, why: 'No consult on the line' };
  if (!s || s.role !== 'md') return { ok: false, why: 'Only an attending can give medical direction' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} isn’t available` };
  const cur = s.q[0];
  if (cur && cur.started && (cur.type === 'code' || (cur.pid && pt(cur.pid) && pt(cur.pid).esi === 1))) s.morale -= 4;
  c.taken = sid;
  addTask(s, { type: 'box', dur: 5, label: 'Box consult' });
  if (G.mode !== 'md' && !G.pre) care(10, 'box');   // the charge nurse's job is getting a doctor on the line fast
  return { ok: true, sc: scenOf(c), unit: c.unit, doc: s.name, pack: G.pack };
}
function boxDecide(approve) {
  const c = G.box.cur; if (!c || !c.taken || G.mode !== 'md') return null;   // the charge nurse routes the call; the doctor decides
  const sc = scenOf(c), mul = surveyMul(), ok = sc.opts ? Number(approve) === sc.r : !!approve === sc.a;
  if (!ok && !TRAIN_SCENS[c.sc]) (G.stats.radioLog = G.stats.radioLog || []).push({ q: sc.plain || sc.q, miss: false, a: sc.a, why: sc.pwhy || sc.why, btn: sc.btn || null, said: sc.opts ? sc.opts[Number(approve)] : null, right: sc.opts ? sc.opts[sc.r] : null });
  if (!ok && !TRAIN_SCENS[c.sc]) litAdd(3, 'a wrong medical direction order');
  G.box.cur = null; G.stats.boxC.ans++;
  if (ok) { G.stats.boxC.right++; care(20 * mul, 'box'); } else { G.stats.boxC.wrong++; care(-15 * mul, 'box'); }
  note(`Box: ${c.unit} ${sc.opts ? 'ordered ' + sc.opts[Number(approve)] : approve ? 'approved' : 'denied'} (${ok ? 'correct' : 'incorrect'})`, ok ? 'good' : 'bad');
  return { ok, sc, approve: sc.opts ? Number(approve) : !!approve };
}

/* ---------- objectives ---------- */
const OBJ = {
  wait4: { label: 'Waiting room down to 6', tick(o) { if (waitingCount() <= 6) return 'ok'; return G.t >= o.until ? 'fail' : null; } },
  vip: { label: 'VIP roomed', tick(o) { const p = pt(o.pid); if (!p || p.loc === 'gone') return 'fail'; if (p.loc === 'room') return 'ok'; return G.t >= o.until ? 'fail' : null; } },
  nohall: { label: 'Hallways empty for the surveyors', tick(o) { if (G.t < o.until) return null; if (hallCount() > 0) return 'fail'; return G.t >= o.until2 ? 'ok' : null; } },
  wall30: { label: 'No ambulance on the wall over 30 min', tick(o) { if (G.t > o.t0 + 15 && maxWallNow() > 30) return 'fail'; return G.t >= o.until ? 'ok' : null; } },
};
function addObj(k, mins, extra) { G.obj.push(Object.assign({ k, t0: G.t, until: G.t + mins }, extra || {})); }
function objTick() {
  if (!G.obj.length) return;
  G.obj = G.obj.filter(o => {
    const r = OBJ[o.k].tick(o);
    if (!r) return true;
    if (r === 'ok') { care(40, 'admin'); G.stats.objOk++; toast(`Done: ${OBJ[o.k].label}`, 'good'); sound('good'); }
    else { care(-40, 'admin'); G.stats.objFail++; for (const s of G.staff) if (present(s)) s.morale -= 3; toast(`Missed: ${OBJ[o.k].label}`, 'bad'); sound('bad'); }
    return false;
  });
}
function waitingCount() { let n = 0; for (const p of active()) if (p.loc === 'waiting' || p.loc === 'triage') n++; return n; }
function hallCount() { return G.rooms.filter(r => r.kind === 'hall' && r.pid).length; }
function maxWallNow() { let m = 0; for (const p of active()) if (p.loc === 'wall') m = Math.max(m, G.t - p.tArrive); return m; }

/* ---------- events ---------- */
function setCard(eid, title, who, text, choices, ctx) { G.card = { eid, title, who, text, choices, ctx: ctx || {} }; sound('card'); }
function chooseCard(k) {
  const c = G.card; if (!c) return;
  const ch = c.choices.find(x => x.k === k);
  if (!ch || ch.dis) return;
  G.card = null;
  if (EV[c.eid] && EV[c.eid].pick) EV[c.eid].pick(k, c.ctx);
  else if (c.eid === 'lit' || c.eid === 'law') litPick(c.eid, k);
  else if (c.eid === 'code') codePick(k, c.ctx);
}
function fireEv(k) { G.ev.used[k] = (G.ev.used[k] || 0) + 1; G.stats.events++; EV[k].fire(); }
function scheduled() {
  if (!G.sched.length) return;
  G.sched.sort((a, b) => a.t - b.t);
  while (G.sched.length && G.sched[0].t <= G.t && !G.card) {
    const s = G.sched.shift();
    if (G.pre && s.k !== 'return') continue;
    if (s.k === 'callout') fireEv('callout');
    else if (s.k === 'mci') mciArrive(s.part);
    else if (s.k === 'scenct') { if (!G.out.ct) startOutage('ct'); }
    else if (s.k === 'scenmci') { if (!G.ev.used.mci) fireEv('mci'); }
    else if (s.k === 'return') { const o = pt(s.pid); if (o) returnVisit(o); }
    else if (s.k === 'swing') toast('11:00: Dr. Nguyen and PA Brooks are on for the swing shift', 'good', true);
    else if (s.k === 'ftopen') { for (const r of G.rooms) if (r.z === 'ft') r.closed = false; toast('09:00: Fast Track is open. Lee has it.', 'good', true); }
  }
}
function eventsTick() { inStream('rngE', eventsTick0); }
function eventsTick0() {
  if (G.card || G.train) return;
  if (G.ev.regionDue && !G.ev.regionFired) { G.ev.regionFired = true; fireEv('region'); return; }
  if (G.t < G.ev.next) return;
  const L = LEVELS[G.level];
  G.ev.next = G.t + randi(L.events[0], L.events[1]);
  const pool = Object.keys(EV).filter(k => EV[k].w && EV[k].w() > 0);
  if (pool.length) fireEv(wpick(pool, k => EV[k].w()));
}
function amaCard(p) {
  G.ev.lastAma = G.t;
  const pv = p.prov ? staff(p.prov) : null;
  const talker = pv && present(pv) && !pv.pit ? pv : G.staff.find(s => s.role === 'md' && s.st === 'on');
  setCard('ama', 'Leaving against advice', `${roomName(p.room)} nurse`, `[[${p.name}]] (${ageSex(p)}, ${p.dxK && (!p.alertOn || p.ev === 'done') ? p.dx : p.cc}) is pulling out the IV and wants to **leave**: "${pick(AMA_LINES)}"${p.lang && p.interp !== 'on' ? ` They speak **${LANGS[p.lang]}**. No interpreter is on.` : ''}`, [
    { k: 'talk', label: talker ? `${talker.name} goes to talk with them` : 'Get a provider to talk with them', sub: 'Usually works. Costs the provider about 5 min.', dis: !talker },
    { k: 'update', label: npo(p) ? 'Nurse update, a warm blanket, and an ETA' : 'Nurse update, a food tray, and an ETA', sub: 'Works about half the time' },
    { k: 'sign', label: 'Have them sign out AMA', sub: 'They leave now. High chance they come back sicker.' },
  ], { pid: p.id, talker: talker ? talker.id : null });
}
function coverageCard(z, title, text) {
  const fls = G.staff.filter(s => s.role === 'rn' && s.float && s.st === 'on' && !s.zones.includes(z)).sort((a, b) => a.zones.length - b.zones.length);
  const fl = fls[0];
  const nb = [];
  for (const n of ZONE_NB[z] || []) { const s = zoneNurses(n).find(x => !x.zones.includes(z) && !nb.includes(x) && !x.float); if (s) nb.push(s); }
  const ch = [];
  if (fl) ch.push({ k: 'float', label: `Float RN ${fl.name} picks up ${ZONE_NAME[z]}`, sub: fl.zones.length ? `${fl.name} keeps ${zoneList(fl.zones)} too, so they run heavy` : 'Your resource nurse is free' });
  if (nb.length) ch.push({ k: 'split', label: nb.length > 1 ? `Split it: ${nb[0].name} and ${nb[1].name}` : `${nb[0].name} covers it too`, sub: nb.length > 1 ? 'Both run heavy (up to 1:6)' : 'Up to 1:8 when full' });
  ch.push({ k: 'agency', label: 'Call an agency nurse', sub: G.mods.noAgency ? 'The CFO froze agency spending' : 'Arrives in about 40 min and costs points', dis: G.mods.noAgency });
  ch.push({ k: 'mandate', label: 'Mandate a night-shift RN to stay 4 hours', sub: "Covered now. Everyone's morale drops." });
  if (!zonePts(z) && z !== 'triage') ch.push({ k: 'close', label: `Close ${ZONE_NAME[z]}`, sub: `Lose ${G.rooms.filter(r => r.z === z).length} beds until you reopen it` });
  setCard('cover', title, 'House Supervisor', text, ch, { z, nb: nb.slice(0, 2).map(s => s.id), fl: fl ? fl.id : null });
}
/* The bus crash comes in the order the field sends it: the red first and by radio, then the yellow, then the walking wounded. */
function mciArrive(part) {
  const mk = (k, unit) => { const p = makePatient(CASES.find(x => x.k === k), 'ems'); p.unit = unit; return p; };
  if (!part || part === 'red') {
    const p = mk('mcired', 'Medic 41');
    p.loc = 'enroute'; p.eta = G.t + 5; p.alertOn = true; p.dxK = true;
    G.enroute.push(p.id); G.box.q.push({ kind: 'notify', pid: p.id, unit: p.unit, id: ++G.box.seq });
  }
  if (!part || part === 'yel') {
    const p = mk('mciyel', 'Medic 42'); p.loc = 'wall'; p.tArrive = G.t; onArrive(p);
    toast(`Bus crash, yellow tag at the bay. ${p.unit}: ${ageSex(p)}, thigh deformity, can’t walk`, 'alert'); sound('siren');
  }
  if (!part || part === 'grn') {
    ['mcigrn', 'mcimin', 'mciwr', 'mcigrn'].forEach((k, i) => { const p = mk(k, ['Medic 7', 'Engine 12', 'Ambulance 15', 'Ambulance 22'][i]); p.loc = 'wall'; p.tArrive = G.t; onArrive(p); });
    toast('Bus crash: four green tags at the bay', 'alert'); sound('siren');
  }
}
function injure(s, how) {
  if (!s) { care(-15, 'safety'); return; }
  revertTask(s); s.st = 'away'; s.until = G.t + 45; s.morale -= 12;
  for (const x of G.staff) if (present(x)) x.morale -= 3;
  G.stats.adverse++; care(-25, 'safety');
  const f = startCover(s);
  toast(`${s.name} ${how} and is away for 45 min.${f ? ` ${f.name} is covering.` : ''}`, 'bad'); sound('bad');
}
function allMorale(n) { for (const s of G.staff) if (present(s)) s.morale = clamp(s.morale + n, 0, 100); }
function awayEv(role, mins, msg) {
  const pool = G.staff.filter(s => s.role === role && s.st === 'on');
  if (!pool.length) return;
  const s = pick(pool); revertTask(s); s.st = 'away'; s.until = G.t + mins;
  toast(msg(s), 'bad');
}

const EV = {
  callout: {
    fire() {
      const cands = G.staff.filter(s => ['rnA', 'rnB', 'rnC', 'rnD', 'rnE'].includes(s.id) && s.st === 'on');
      if (!cands.length) return;
      const s = pick(cands), z = s.zones.find(x => x !== 'triage') || 'b', n = zonePts(z);
      staffGone(s, 'off');
      coverageCard(z, 'Call-out', `**${s.name}** called out sick. **${ZONE_NAME[z]}** has **no nurse**${n ? ` and ${n} patient${n > 1 ? 's' : ''}` : ''}.`);
    },
  },
  cover: {
    pick(k, ctx) {
      const z = ctx.z;
      if (k === 'float') { const f = staff(ctx.fl); if (f && f.st === 'on' && !f.zones.includes(z)) { f.zones.push(z); toast(`${f.name} picked up ${ZONE_NAME[z]}`, 'info'); } }
      else if (k === 'split') { for (const id of ctx.nb) { const s = staff(id); if (s && !s.zones.includes(z)) s.zones.push(z); } toast(`${ctx.nb.map(id => staff(id).name).join(' and ')} picked up ${ZONE_NAME[z]}`, 'info'); }
      else if (k === 'agency') { const r = callAgency(z); toast(r.ok ? r.msg : r.why, r.ok ? 'info' : 'bad'); }
      else if (k === 'mandate') mandate(z);
      else if (k === 'close') { setZoneClosed(z, true); toast(`${ZONE_NAME[z]} closed`, 'info'); }
    },
  },
  ama: {
    pick(k, ctx) {
      const p = pt(ctx.pid);
      if (!p || p.loc !== 'room') return;
      const stay = k === 'talk' ? 0.75 : k === 'update' ? 0.5 : 0;
      if (k === 'talk') { const s = staff(ctx.talker); if (s) addTask(s, { type: 'talk', pid: p.id, dur: 5, label: 'AMA talk' }); }
      if (k === 'update') G.errands.push({ label: 'Food tray and update', dur: 3 });
      if (chance(stay * (p.lang && p.interp !== 'on' ? 0.75 : 1))) { p.amaSafe = G.t + 90; toast(`${p.name} agreed to stay`, 'good'); return; }
      toast(k === 'sign' ? `${p.name} signed out against medical advice` : `${p.name} left against medical advice anyway`, 'bad');
      leave(p, 'ama');
    },
  },
  sick: {
    w: () => (G.t > 25 && G.t < G.shift - 40 && G.ev.sick < LEVELS[G.level].sickMax) ? 1.1 : 0,
    fire() {
      const pool = G.staff.filter(s => s.st === 'on' && !s.tag && s.id !== 'rnF' && s.id !== G.me);   // the player never calls out sick on themselves
      if (!pool.length) return;
      const s = wpick(pool, x => ({ rn: 3, pct: 2, evs: 2, app: 1.2, md: 0.7, rt: 1, rph: 0.6, reg: 1, tp: 0.8 })[x.role] || 0);
      G.ev.sick++;
      const why = pick(['a migraine', 'a fever', 'vomiting', 'a family emergency', 'a back injury from boosting a patient']);
      const zs = s.zones.slice(), n = isProv(s) ? active().filter(p => p.prov === s.id).length : 0;
      staffGone(s, 'sick');
      if (s.role === 'rn') {
        const unc = zs.filter(z => zoneNurses(z).length === 0);
        if (unc.length) coverageCard(unc[0], 'Sick call', `**${s.name}** is going home with ${why}. **${ZONE_NAME[unc[0]]}** has **no nurse**.`);
        else toast(`${s.name} went home with ${why}`, 'bad');
      } else if (isProv(s)) {
        setCard('provsick', 'Provider down', 'Charge RN', `**${s.name}** is going home with ${why}.${n ? ` **${n} patient${n > 1 ? 's' : ''}** need${n > 1 ? '' : 's'} a new provider.` : ''}`, [
          { k: 'backup', label: 'Call in the backup doc', sub: 'Dr. Novak arrives in about 60 min' },
          { k: 'absorb', label: 'Absorb it', sub: 'Your other providers pick up the slack. Morale drops.' },
        ]);
      } else if (s.role === 'rph') {
        setCard('rphsick', 'No pharmacist', 'Pharmacy', `**${s.name}**, your pharmacist, is going home with ${why}. **Nobody is verifying medication orders.**`, [
          { k: 'remote', label: 'Central pharmacy verifies remotely', sub: 'Slower: about twice as long per order' },
          { k: 'none', label: 'Go without', sub: 'Nurses pull meds on override. Faster, riskier.' },
        ]);
      } else {
        setCard('helpsick', 'Staff down', 'House Supervisor', `${s.title} **${s.name}** is going home with ${why}.`, [
          { k: 'float', label: `Ask for a float ${s.title}`, sub: 'Arrives in about 50 min' },
          { k: 'none', label: 'Go without', sub: s.role === 'reg' ? 'One registrar for every patient' : s.role === 'tp' ? 'Your techs carry more transports' : s.role === 'evs' ? 'Rooms turn over slower' : s.role === 'rt' ? 'Breathing treatments wait longer' : 'ECGs, blood draws, and transports slow down' },
        ], { role: s.role });
      }
    },
  },
  provsick: {
    pick(k) {
      if (k === 'backup') { const s = mkStaff({ id: 'md' + (G.sid++ + 10), role: 'md', name: 'Dr. Novak', short: 'Novak', tag: 'backup' }); s.st = 'pending'; s.until = G.t + 60; G.staff.push(s); care(-5, 'staffing'); toast('Dr. Novak is coming in (about 60 min)', 'info'); }
      else for (const s of G.staff) if (isProv(s) && present(s)) s.morale -= 5;
    },
  },
  rphsick: { pick(k) { if (k === 'remote') { G.mods.remoteRph = true; toast('Central pharmacy is verifying ED orders remotely', 'info'); } } },
  helpsick: {
    pick(k, ctx) {
      if (k !== 'float') return;
      const nm = { evs: 'Bo', rt: 'Nia', reg: 'Jo', tp: 'Sal' }[ctx.role] || 'Kai';
      const s = mkStaff({ id: ctx.role + 'f' + (G.sid++), role: ctx.role, name: nm + ' (float)', short: nm, tag: 'float' });
      s.st = 'pending'; s.until = G.t + 50; G.staff.push(s);
      toast(`Float ${TITLE[ctx.role]} ${nm} arrives in about 50 min`, 'info');
    },
  },
  needle: {
    w: () => G.t > 20 ? 0.8 : 0,
    fire() {
      const pool = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && !s.zones.includes('triage') && s.zones.length);
      if (!pool.length) return;
      const s = pick(pool); revertTask(s); s.st = 'away'; s.until = G.t + 30;
      const f = startCover(s);
      toast(`${s.name} got a needlestick and is at Employee Health for 30 min.${f ? ` ${f.name} is covering.` : ' Nobody is covering.'}`, 'bad');
    },
  },
  evsPull: { w: () => G.t > 30 ? 0.6 : 0, fire() { awayEv('evs', 35, s => `EVS ${s.name} got pulled to the OR for a spill. Back in about 35 min.`); } },
  rtPull: { w: () => G.t > 30 ? 0.7 : 0, fire() { awayEv('rt', 20, s => `RT ${s.name} got pulled to a rapid response upstairs. Back in about 20 min.`); } },
  rphPull: { w: () => G.t > 40 && !G.ev.used.rphPull ? 0.5 : 0, fire() { awayEv('rph', 20, s => `${s.name} got called to a code upstairs. Med verification stops for about 20 min.`); } },
  regPull: { w: () => G.t > 30 ? 0.5 : 0, fire() { awayEv('reg', 20, s => `Registrar ${s.name} got pulled to the main lobby. Back in about 20 min.`); } },
  tpBacklog: {
    w: () => (G.t > 60 && !G.ev.used.tpBacklog) ? 0.6 : 0,
    fire() { for (const s of G.staff) if (s.role === 'tp' && s.st === 'on') { revertTask(s); s.st = 'away'; s.until = G.t + 30; } toast('Transport is backed up upstairs. No transporters for about 30 min. Your techs can carry patients up.', 'bad'); },
  },
  airWx: { w: () => (G.t > 60 && !G.ev.used.airWx) ? 0.4 : 0, fire() { G.mods.airWx = G.t + 120; toast('Weather grounded the helicopters for the next 2 hours', 'bad'); } },
  iftSlow: { w: () => (G.t > 90 && !G.ev.used.iftSlow) ? 0.4 : 0, fire() { G.mods.iftSlow = G.t + 60; toast('Interfacility ambulances are stretched thin: ground units are 30 min slower for an hour', 'bad'); } },
  shortage: { w: () => (G.t > 40 && !G.ev.used.shortage) ? 0.6 : 0, fire() { G.mods.shortage = G.t + 45; toast('Drug shortage: pharmacy is substituting. Verification takes twice as long for 45 min.', 'bad'); } },
  oneglow: { w: () => (G.t > 60 && !G.ev.used.oneglow) ? 0.5 : 0, fire() { G.blood.oneg = Math.max(0, G.blood.oneg - 5); toast(`Blood bank: O-negative is short regionwide. ${G.blood.oneg} units left.`, 'bad'); } },
  bbDown: { w: () => (G.t > 60 && !G.ev.used.bbDown) ? 0.4 : 0, fire() { G.mods.bbSlow = G.t + 60; toast('Blood bank analyzer down: crossmatches take an hour. Emergency-release O-negative if you have to.', 'bad'); } },
  interpDown: { w: () => (G.t > 60 && !G.ev.used.interpDown) ? 0.4 : 0, fire() { G.mods.interpDown = G.t + 30; toast('The video interpreter line is down for 30 min. Requests take longer.', 'bad'); } },
  ctDown: { w: () => (G.t > 30 && !G.ev.used.ctDown && !Object.keys(G.out).length) ? 0.8 : 0, fire() { startOutage('ct'); } },
  cathDown: { w: () => (G.t > 45 && !G.ev.used.cathDown && !Object.keys(G.out).length) ? 0.5 : 0, fire() { startOutage('cath'); } },
  orDown: { w: () => (G.t > 45 && !G.ev.used.orDown && !Object.keys(G.out).length) ? 0.5 : 0, fire() { startOutage('or'); } },
  labOut: { w: () => (G.t > 60 && !G.ev.used.labOut && !Object.keys(G.out).length) ? 0.4 : 0, fire() { startOutage('lab'); } },
  powerOut: { w: () => (G.t > 90 && !G.ev.used.powerOut && !Object.keys(G.out).length) ? 0.3 : 0, fire() { startOutage('power'); } },
  labDown: { w: () => (G.t > 30 && !G.ev.used.labDown) ? 0.7 : 0, fire() { G.mods.lab = G.t + 40; toast('One lab analyzer is down. Results take twice as long for 40 min.', 'bad'); } },
  ehrDown: { w: () => (G.t > 60 && !G.ev.used.ehrDown) ? 0.6 : 0, fire() { G.mods.ehr = G.t + 30; toast('EHR downtime: paper charts for 30 min. Everything is slower.', 'bad'); } },
  surge: { w: () => (G.t > 40 && G.mods.surge < G.t && G.region.hosps.some(h => h.st === 'open')) ? 0.8 : 0, fire() { const h = pick(G.region.hosps.filter(x => x.st === 'open')); h.st = 'yellow'; h.since = G.t; h.hold = G.t + 60; G.mods.surge = G.t + 60; toast(`${h.name} went on ED Full. Expect extra ambulances for an hour.`, 'alert'); } },
  huddle: { w: () => boarders().length >= 2 ? 1 : 0, fire() { for (const p of boarders()) p.due = G.t + (p.due - G.t) * 0.6; toast('Bed huddle: upstairs found beds. Your admitted patients move faster.', 'good'); } },
  floors: { w: () => inRooms().filter(isBoarder).length >= 2 && G.mods.noReport < G.t ? 0.7 : 0, fire() { G.mods.noReport = G.t + 35; toast("The floors are in shift change and won't take report for 35 min.", 'bad'); } },
  cnoPizza: { w: () => (staffSat() < 55 && !G.ev.used.cnoPizza) ? 1.5 : 0, fire() { allMorale(8); toast('The CNO sent pizza to the ED. Morale up.', 'good'); } },
  agitated: {
    w: () => G.t > 30 ? 0.9 : 0,
    fire() {
      const cands = inRooms().filter(p => p.esi >= 3 && ['none', 'board'].includes(p.dsp));
      if (!cands.length) return;
      const p = cands.find(x => x.ck === 'etoh' || x.ck === 'bh') || pick(cands);
      const secFree = G.sec.busy < G.t;
      setCard('agitated', 'Combative patient', 'Pod nurse', `[[${p.name}]] in **${roomName(p.room)}** is yelling, pulling at the IV, and **swinging at staff**.`, [
        { k: 'sec', label: 'Call security', sub: secFree ? 'Officer Reed responds and is busy for 20 min' : 'Security is tied up elsewhere', dis: !secFree },
        { k: 'talk', label: 'De-escalate it yourself', sub: 'Usually works. Not always.' },
        { k: 'wait', label: 'Let the nurse handle it', sub: 'Risky' },
      ], { pid: p.id });
    },
    pick(k, ctx) {
      const p = pt(ctx.pid), r = p ? roomOf(p) : null, nurse = r ? zoneNurses(r.z)[0] : null;
      if (k === 'sec') { G.sec.busy = G.t + 20; allMorale(2); toast('Security calmed it down. Staff feel backed up.', 'good'); }
      else if (k === 'talk') { if (chance(0.65)) { toast('You talked them down. Crisis over.', 'good'); if (nurse) nurse.morale += 3; } else injure(nurse, 'got hit while you were de-escalating'); }
      else if (chance(0.7)) injure(nurse, 'got punched');
      else toast('It settled down on its own. This time.', 'info');
    },
  },
  // Orientation only: one decision card, so the first real one is not a surprise. Nothing rides on the answer.
  trainpick: {
    w: () => 0,
    fire() {
      setCard('trainpick', 'A tech wants to leave early', 'Jules, tech', '"My son has a game tonight. Can I **leave an hour early**? It’s quiet right now."', [
        { k: 'yes', label: 'Let her go', sub: 'The team is happier. You’re a tech short for the last hour.' },
        { k: 'no', label: 'Ask her to stay', sub: 'You keep the tech. She isn’t happy about it.' },
      ]);
    },
    pick(k) { G.trPick = k; allMorale(k === 'yes' ? 2 : -1); note(k === 'yes' ? 'Jules will leave an hour early.' : 'Jules is staying.'); },
  },
  mci: {
    w: () => (G.t > 60 && G.t < G.shift - 60 && !G.ev.used.mci) ? 0.6 : 0,
    fire() {
      setCard('mci', 'Multiple-casualty incident', 'EMS communications', 'A **bus rolled over** on the highway. About 20 people were on board. EMS is asking every hospital what it can take.\nYour share: **1 red tag, 1 yellow, and 4 greens**, here in about **10 minutes**.\nRed is critical. Yellow is serious. Green can walk.', [
        { k: 'call', label: 'Take all six and call in an extra RN', sub: 'She arrives in about 30 min and takes the hallway' },
        { k: 'ok', label: 'Take all six', sub: 'Clear a resus bay and start moving people out' },
        { k: 'green', label: 'Greens only', sub: 'The red and the yellow ride 15 minutes farther. Costs points.' },
      ]);
    },
    pick(k) {
      if (k === 'green') { care(-12, 'divert'); note('You told EMS: greens only. The red and the yellow went to the next hospital.', 'bad'); }
      else { G.sched.push({ t: G.t + 5, k: 'mci', part: 'red' }); G.sched.push({ t: G.t + 11, k: 'mci', part: 'yel' }); }
      G.sched.push({ t: G.t + 13, k: 'mci', part: 'grn' });
      if (k === 'call') { const s = mkStaff({ id: 'rnx' + (G.sid++), role: 'rn', name: 'Morgan (called in)', short: 'Morgan', zones: ['hall'], tag: 'call-in' }); s.st = 'pending'; s.until = G.t + 30; G.staff.push(s); care(-5, 'staffing'); }
    },
  },
  vip: {
    w: () => (G.t > 40 && !G.ev.used.vip) ? 0.6 : 0,
    fire() {
      const c = { k: 'vip', cc: 'Dizzy spell', dx: 'Benign positional vertigo', esi: 4, age: [76, 82], sex: 'F', wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Normal' } };
      const p = makePatient(c, 'walk');
      p.name = 'Eleanor V.'; p.lang = null; p.loc = 'waiting'; p.tArrive = G.t; p.tTriage = G.t; p.reg = 'done'; p.tri = 'done'; onArrive(p); p.patience = 1e9;
      setCard('vip', 'VIP in the lobby', 'Hospital CEO', `"The **board chair's mother** is in your waiting room with a dizzy spell. She's an **ESI 4**. I trust you'll take care of her. Personally."`, [
        { k: 'room', label: 'Room her next', sub: 'The CEO is happy. Your staff will notice.' },
        { k: 'acuity', label: 'She waits her turn by acuity', sub: 'The CEO docks you points. Your staff respect it.' },
      ], { pid: p.id });
    },
    pick(k, ctx) {
      const p = pt(ctx.pid);
      if (k === 'room') { p.vip = true; addObj('vip', 15, { pid: p.id }); allMorale(-2); }
      else { care(-15, 'admin'); allMorale(2); }
    },
  },
  admWait: {
    w: () => (G.t > 45 && waitingCount() >= 10 && !G.ev.used.admWait) ? 2.5 : 0,
    fire() {
      setCard('admWait', 'Administrator on the floor', 'VP of Operations', `"**${waitingCount()} people** in the waiting room? I need that at **6 or fewer in 45 minutes**. I'll be back."`, [
        { k: 'yes', label: 'On it', sub: 'Goal: waiting room at 6 or fewer within 45 min. A provider in triage helps.' },
        { k: 'no', label: '"Get me beds upstairs, then we\'ll talk."', sub: 'Staff love it. Admin docks you points.' },
      ]);
    },
    pick(k) { if (k === 'yes') addObj('wait4', 45); else { care(-20, 'admin'); allMorale(4); } },
  },
  tjc: {
    w: () => (G.t > 60 && G.t < G.shift - 90 && !G.ev.used.tjc) ? 0.7 : 0,
    fire() {
      setCard('tjc', 'Accreditation tracer', 'Chief Nursing Officer', '"Accreditation surveyors walk the ED in **30 minutes**. They stay 45. **No patients in hallway beds** while they’re here."', [
        { k: 'ok', label: 'Clear the halls', sub: 'Goal: hallways empty in 30 min and kept empty for 45' },
      ]);
    },
    pick() { addObj('nohall', 30, { until2: G.t + 75 }); },
  },
  flex: {
    w: () => (G.t > 90 && G.t < 400 && !G.ev.used.flex && G.staff.filter(s => s.role === 'pct' && s.st === 'on').length >= 3) ? 0.6 : 0,
    fire() {
      setCard('flex', 'Budget call', 'Chief Financial Officer', '"Our projections say you’re overstaffed on techs. **Send one tech home.**"', [
        { k: 'send', label: 'Send a PCT home', sub: 'Admin gives you points. One fewer tech.' },
        { k: 'refuse', label: 'Refuse', sub: 'Admin docks you points' },
      ]);
    },
    pick(k) {
      if (k === 'send') {
        const s = G.staff.filter(x => x.role === 'pct' && x.st === 'on').sort((a, b) => (a.task ? 1 : 0) - (b.task ? 1 : 0))[0];
        if (s) { staffGone(s, 'gone'); care(10, 'admin'); toast(`${s.name} was sent home`, 'info'); }
      } else care(-15, 'admin');
    },
  },
  patExp: {
    w: () => (G.t > 50 && inRooms().some(p => G.t - p.tArrive > 150)) ? 0.8 : 0,
    fire() {
      const p = inRooms().filter(x => G.t - x.tArrive > 150).sort((a, b) => a.tArrive - b.tArrive)[0];
      if (!p) return;
      setCard('patExp', 'Family complaint', 'Patient Experience', `[[${p.name}]]'s daughter, in **${roomName(p.room)}**, says **nobody has updated them in hours**. She's filling out the survey right now.`, [
        { k: 'go', label: 'Send a PCT to update them with warm blankets', sub: 'Ties up a PCT for 6 min' },
        { k: 'no', label: 'Not now', sub: 'Survey scores drop' },
      ]);
    },
    pick(k) { if (k === 'go') { G.errands.push({ label: 'Family update', dur: 6 }); care(10, 'admin'); } else care(-10, 'admin'); },
  },
  noDivert: {
    w: () => ((G.dv.yellow.on || G.dv.red.on || Object.keys(DIVERTS).some(k => G.dv[k].on && !DIVERTS[k].capacity && !justified(k))) && !G.ev.used.noDivert) ? 2 : 0,
    fire() {
      setCard('noDivert', 'Divert pushback', 'VP of Operations', `"Who put us on **${Object.keys(DIVERTS).filter(k => G.dv[k].on).map(k => DIVERTS[k].name).join(' and ') || 'divert'}**? EMS volume is our volume. **Turn it off.**"`, [
        { k: 'off', label: 'Turn it off', sub: 'No divert for 90 min' },
        { k: 'keep', label: 'Keep it on', sub: 'Admin docks you points' },
      ]);
    },
    pick(k) { if (k === 'off') { for (const x in DIVERTS) if (DIVERTS[x].capacity || !justified(x)) G.dv[x].on = false; G.mods.noDivert = G.t + 90; } else care(-20, 'admin'); },
  },
  survey: {
    w: () => (G.t > 30 && G.t < G.shift - 70 && !G.ev.used.survey) ? 0.7 : 0,
    fire() {
      setCard('survey', 'Medical control audit', 'EMS medical director', 'The EMS medical director is listening to how your attendings handle the Box for the **next hour**. Medical direction calls **count double**, good or bad.', [{ k: 'ok', label: 'Bring it on', sub: '' }]);
    },
    pick() { G.mods.survey = G.t + 60; },
  },
  region: {
    fire() {
      // say only what actually happened
      const why = [G.ev.wall60 ? 'Your ambulances have waited on the wall over an hour today' : '', G.ev.missedC >= 2 ? 'Two calls for medical direction went unanswered' : '', Object.keys(DIVERTS).some(k => G.dv[k].on && G.t - G.dv[k].since > 20) ? 'You have been on divert a long time' : ''].filter(Boolean);
      setCard('region', 'EMS system call', 'EMS system coordinator', `"${(why.length ? why : ['We’re hearing from crews about your department']).join('. ')}. What's the plan?"`, [
        { k: 'commit', label: 'Offload every unit within 30 min', sub: 'A goal for the next hour' },
        { k: 'yellow', label: 'Go on ED Full', sub: 'Fewer ambulances. Admin will notice.', dis: G.mods.noDivert > G.t || G.dv.yellow.on },
        { k: 'blame', label: '"It\'s the boarding."', sub: 'True, but it costs you points' },
      ]);
    },
    pick(k) { if (k === 'commit') addObj('wall30', 60); else if (k === 'yellow') { const r = setDivert('yellow', true); toast(r.ok ? r.msg : r.why, 'info'); } else care(-15, 'admin'); },
  },
};

/* ---------- Orientation: scripted patients, Box calls, and outages ---------- */
function trainPatient(k, how, o) {
  o = o || {};
  const c = CASES.find(x => x.k === k);
  if (!c) return null;
  const p = makePatient(c, how === 'walk' || how === 'waiting' ? 'walk' : 'ems');
  if (o.name) p.name = o.name;
  if (o.age != null) p.age = o.age;
  if (o.sex) p.sex = o.sex;
  p.lang = o.lang || null; p.tArrive = G.t;
  if (p.alert === 'stroke') strokeSetup(p, { over: !!o.bpOver, lkw: o.lkw != null ? o.lkw : 50 });   // scripted strokes are under the limit unless asked
  if (how === 'walk') { p.loc = 'triage'; G.triageQ.push(p.id); onArrive(p); }
  else if (how === 'ems') { p.unit = o.unit || 'Medic 7'; p.loc = 'wall'; onArrive(p); note(`${p.unit} at the bay: ${ageSex(p)}, ${p.cc}`); }
  else if (how === 'alert') {
    p.unit = o.unit || 'Medic 21'; p.loc = 'enroute'; p.eta = G.t + (o.eta || 6); p.alertOn = true; p.dxK = true;
    G.enroute.push(p.id);
    G.box.cur = { kind: 'notify', pid: p.id, unit: p.unit, id: ++G.box.seq, ring: 1e9, left: 1e9, t0: G.t };
    sound('ring');
  } else if (how === 'waiting') {
    p.loc = 'waiting'; p.reg = 'quick'; p.quick = true; p.tri = 'done'; onArrive(p);
    p.tTriage = G.t - (o.waited || 25); p.tArrive = p.tTriage - 8;
    if (o.esiT) p.esiT = o.esiT;
  } else if (how === 'room') {
    // Already roomed by the charge nurse, waiting for a provider (physician Orientation).
    const r = room(o.room);
    if (!r || r.pid) return null;
    p.loc = 'room'; p.room = r.id; r.pid = p.id; r.st = 'occ'; onArrive(p);
    p.tArrive = G.t - 25; p.tTriage = G.t - 20; p.tRoom = G.t - 3; p.tWall = 0;
    p.reg = 'done'; p.tri = 'done'; p.rn = 'done';
  } else if (how === 'seat') {
    const r = room(o.room);
    if (!r || r.pid) return null;
    p.loc = 'room'; p.room = r.id; r.pid = p.id; r.st = 'occ'; onArrive(p);
    p.tArrive = G.t - 45; p.tTriage = G.t - 40; p.tRoom = G.t - 35; p.tProv = G.t - 25; p.tWall = 0;
    p.reg = 'done'; p.tri = 'done'; p.rn = 'done'; p.ev = 'done'; p.prov = o.prov || null;
    const run = o.run || {};
    for (const w of p.wk) p.work[w] = run[w] ? { st: 'run', tOrd: G.t - 20, due: G.t + run[w] } : { st: 'done', tOrd: G.t - 25, tDone: G.t - 5 };
    for (const k2 of p.tr) p.treat[k2] = newTreat(k2);
    p.dxK = !Object.keys(run).length;
    if (p.alert) p.alertOn = true;
    p.goals = {};
    if (o.dsp) p.dsp = o.dsp;
  }
  p.patience = 1e9; p.amaSafe = 1e9;
  return p.id;
}
function trainConsult(which) {
  if (G.box.cur) return false;
  G.box.cur = { kind: 'consult', sc: which || 'train', unit: 'Medic 12', id: ++G.box.seq, ring: 1e9, left: 1e9, t0: G.t };
  sound('ring');
  return true;
}
function trainOutage(k, mins) {
  const O = OUTAGES[k], until = G.t + mins;
  G.out[k] = { t0: G.t, until, credited: false };
  G.stats.outLog.push({ k, t0: G.t, t1: until, divertAt: null, misses: 0, after: 0 });
  if (k === 'ct' || k === 'power') G.img.ct.down = Math.max(G.img.ct.down, until);
  toast(`${O.msg} Expected back in about ${Math.round(mins)} min.`, 'alert'); sound('alarm');
}

/* ---------- end of shift ---------- */
function avgWait() {
  let n = 0, sum = 0;
  for (const id of G.order) {
    const p = G.pts[id];
    if (p.tArrive < 0 || p.loc === 'enroute' || p.loc === 'new') continue;
    const end = p.tProv != null ? p.tProv : p.loc === 'gone' ? p.tDone : G.t;
    sum += end - p.tArrive; n++;
  }
  return n ? sum / n : 0;
}
function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); }
/* The numbers an ED director actually gets judged on. */
function metrics() {
  const list = G.order.map(id => G.pts[id]).filter(p => p.tArrive >= 0 && p.loc !== 'enroute' && p.loc !== 'new');
  const gone = list.filter(p => p.loc === 'gone'), up = ['admit', 'icu', 'bh', 'obs'];
  const n = list.length || 1, S = G.stats, pct = x => Math.round(1000 * x / n) / 10;
  const capMins = Object.keys(DIVERTS).reduce((a, k) => a + (DIVERTS[k].capacity ? G.dv[k].mins : 0), 0);
  return {
    d2p: median(list.filter(p => p.tProv != null).map(p => p.tProv - p.tArrive)),
    d2t: median(list.filter(p => p.tTriage != null).map(p => p.tTriage - p.tArrive)),
    losDc: median(gone.filter(p => p.outcome === 'dc').map(p => p.tDone - p.tArrive)),
    losAdm: median(gone.filter(p => up.includes(p.outcome)).map(p => p.tDone - p.tArrive)),
    board: median(gone.filter(p => up.includes(p.outcome) && p.tBoard != null).map(p => p.tDone - p.tBoard)),
    lwbsPct: pct(S.lwbs), amaPct: pct(S.ama), admitPct: pct(S.admit + S.icu + S.bh + S.obs), retPct: pct(S.returns + S.returnsLate),
    capHours: Math.round(capMins / 6) / 10,
  };
}
function staffHours() {
  const SM = G.stats.staffMins, h = k => Math.round((SM[k] || 0) / 6) / 10;
  const rn = h('rn'), agency = h('rnAgency'), mandated = h('rnMandated');
  const seen = G.order.filter(id => G.pts[id].tArrive >= 0 && G.pts[id].loc !== 'enroute' && G.pts[id].loc !== 'new').length || 1;
  return { rn, agency, mandated, md: h('md'), app: h('app'), pct: h('pct'), rt: h('rt'), rnPerVisit: Math.round(100 * (rn + agency + mandated) / seen) / 100 };
}
const STARS = { easy: [300, 800, 1400], med: [500, 1300, 2000], hard: [400, 1200, 2000], train: [300, 800, 1400], rush: [100, 240, 340] };
const STARS_MD = { easy: [600, 1200, 1800], med: [600, 1300, 2000], hard: [600, 1300, 2000], train: [300, 800, 1400], rush: [120, 240, 310] };
function starsFor(c, level, mode) { const s = ((mode || (G && G.mode)) === 'md' ? STARS_MD : STARS)[level || (G && G.level) || 'med']; return c >= s[2] ? 3 : c >= s[1] ? 2 : c >= s[0] ? 1 : 0; }
function endShift(reason) {
  if (G.over) return;
  if (!G.pre && G.stats.returnsLate && G.mode !== 'md') care(-20 * G.stats.returnsLate, 'returns');
  G.over = true; G.running = false; G.fail = reason === 'walkout' || reason === 'fired' ? reason : null;
  const list = G.order.map(id => G.pts[id]).filter(p => p.tArrive >= 0 && p.loc !== 'enroute' && p.loc !== 'new');
  const ems = list.filter(p => p.src === 'ems');
  const walls = ems.map(p => p.tWall != null ? p.tWall : (p.loc === 'wall' ? G.t - p.tArrive : 0));
  const S = G.stats;
  G.report = {
    level: G.level, scen: G.scen || 'none', pack: G.pack, code: G.code || null, realSec: Math.round(S.realSec || 0), spdSec: S.spdSec || null, bedFirst: S.bedFirst || 0, fail: G.fail, care: Math.round(G.care), wait: Math.round(avgWait()), sat: Math.round(staffSat()),
    stars: G.fail ? 0 : overallStars(), avg: avgScore(),
    seen: list.length, dc: S.dc, adm: S.admit + S.icu + S.bh, proc: S.or + S.cath, tx: S.tx, lwbs: S.lwbs, ama: S.ama,
    expired: S.expired + list.filter(p => p.loc !== 'gone' && ['family', 'morgue', 'morguing'].includes(p.dsp)).length,   // audit R5-02: the dead who haven't left yet count too
    noTeam: S.noTeam || 0, lyticLate: S.lyticLate || 0,
    lit: Math.round(G.lit || 0), acc: G.mode === 'md' ? accuracy() : null, dxRight: (S.md && S.md.dxRight) || 0, dxWrong: (S.md && S.md.dxWrong) || 0, dxLog: ((S.md && S.md.dxLog) || []).slice(), litLog: (S.litLog || []).slice(), lawCalls: S.lawCalls || 0, wrongDrug: (S.md && S.md.wrongDrug) || 0,
    returns: S.returns + S.returnsLate, returnList: (S.returnList || []).slice(), radioLog: (S.radioLog || []).slice(), left: active().length,
    wallAvg: walls.length ? Math.round(walls.reduce((a, b) => a + b, 0) / walls.length) : 0,
    wallMax: walls.length ? Math.round(Math.max(...walls)) : 0, wallOver: walls.filter(w => w > 30).length,
    boxC: Object.assign({}, S.boxC), boxN: Object.assign({}, S.boxN), goalsMet: S.goals.met, goalsMiss: S.goals.miss,
    angry: S.angry, wrongSpec: S.wrongSpec, ratioMin: Math.round(S.ratioMin), adverse: S.adverse, wrCodes: S.wrCodes,
    objOk: S.objOk, objFail: S.objFail, agency: S.agency, mandates: S.mandates, rosc: S.rosc,
    lep: S.lep, interp: S.interp, mtp: S.mtp, mtpWaste: S.mtpWaste, oneg: S.oneg, shock: S.shock, overrides: S.overrides, medErrors: S.medErrors,
    registered: S.registered, triaged: S.triaged, offloads: S.offloads, transports: Object.assign({}, S.transports), ift: Object.assign({}, S.ift), iftRefused: S.iftRefused, airAbort: S.airAbort,
    pitSeen: S.pitSeen, pitDc: S.pitDc, diverted: S.diverted, yellowMins: G.dv.yellow.mins, redMins: G.dv.red.mins, divertMins: Object.fromEntries(Object.keys(DIVERTS).map(k => [k, G.dv[k].mins])),
    outages: S.outLog.map(x => Object.assign({}, x)), outRight: S.outRight, outMiss: S.outMiss, divertExtra: S.divertExtra,
    sc: scores(), m: metrics(), staffH: staffHours(), px: S.pxN ? Math.round(S.pxSum / S.pxN) : null, complaints: S.complaints, updates: S.updates,
    mm: S.mm.slice().sort((a, b) => b.sev - a.sev || a.t - b.t).filter((x, i, arr) => arr.findIndex(y => y.what === x.what) === i).slice(0, 3).map(x => Object.assign({}, x, { t: Math.round(x.t) })),
    gray: Object.assign({}, S.gray), obs: S.obs, fcp: S.fcp, chairMoves: S.chairMoves, hallMins: S.hallMins,
    underTriage: S.underTriage, underCaught: S.underCaught, cosign: S.cosign, missedDx: S.missedDx, intub: S.intub, intubNoRT: S.intubNoRT,
    suspended: S.suspended, quickReg: S.quickReg, mode: G.mode, md: Object.assign({}, S.md),
  };
}

/* ---------- autopilot: fills the board before your shift, runs the demo, and drives the tests ---------- */
function botRoom(p) {
  let best = null, bs = 1e9;
  const e = vEsi(p);
  for (const r of G.rooms) {
    if (r.kind === 'chair' || !canPlace(p, r).ok) continue;
    let sc;
    if (e === 1 && p.anyRoom) sc = { main: 0, resus: 1, hall: 99, ft: 99 }[r.kind];
    else if (e === 1) sc = r.kind === 'resus' ? 0 : 99;
    else if (e >= 4) sc = { ft: 0, main: 2, hall: 3, resus: 8 }[r.kind];
    else if (e === 3) sc = { main: 0, hall: 3, resus: 6, ft: 99 }[r.kind];
    else sc = { main: 0, resus: 2, hall: 99, ft: 99 }[r.kind];
    if (r.iso && !p.iso) sc += 0.6;
    if (r.safe) sc += p.sitter ? -1 : 0.4;
    if (sc < bs) { bs = sc; best = r; }
  }
  return bs < 50 ? best : null;
}
function botStep(o) {
  // A charge nurse with limited hands: list every useful move, do the most urgent ones first.
  o = o || {};
  let budget = o.budget == null ? 1e9 : o.budget;
  if (G.card && !G.card.mine) { const ch = G.card.choices.find(c => !c.dis) || G.card.choices[0]; chooseCard(ch.k); }
  const acts = [], add = (pr, fn) => acts.push({ pr, fn, n: acts.length });
  const load = s => s.q.length + s.tq.length + (s.task ? 1 : 0);
  const b = G.box.cur;
  if (b && !b.taken && o.box !== false) add(0, () => {
    if (b !== G.box.cur) return false;
    if (b.kind === 'notify') return boxNotify().ok;
    if (G.mode === 'md') return false;   // medical direction is the attending player's call
    const d = G.staff.filter(s => s.role === 'md' && s.st === 'on').sort((a, x) => a.q.length - x.q.length)[0];
    return !!d && boxTake(d.id).ok;
  });
  for (const t of clerkOpen()) if (t.k === 'ride') add(2.5, () => ucDo(t.id).ok);   // the unit secretary calls the rides
  const regPick = () => G.staff.filter(s => s.role === 'reg' && s.st === 'on').sort((a, x) => load(a) - load(x))[0];
  const triPick = () => {
    let t = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.zones.includes('triage'));
    if (!t.length) t = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && !s.zones.length);
    return t.sort((a, x) => load(a) - load(x))[0];
  };
  const bed = p => () => {
    if (!(p.loc === 'wall' || p.loc === 'waiting' || p.loc === 'triage')) return false;
    const r = botRoom(p);
    if (r) return place(p.id, r.id).ok;
    return p.loc === 'wall' && p.esi >= 4 ? toWaiting(p.id).ok : false;
  };
  if (o.divert !== false) {
    for (const x in G.out) { const k = OUTAGES[x].fix; if (outActive(x) && !G.dv[k].on) add(0.6, () => !G.dv[k].on && setDivert(k, true).ok); }
    for (const k in DIVERTS) if (!DIVERTS[k].capacity && G.dv[k].on && !justified(k)) add(0.6, () => G.dv[k].on && setDivert(k, false).ok);
  }
  for (const r of G.rooms) if (r.st === 'dirty' && !G.evsQ.includes(r.id)) add(4, () => r.st === 'dirty' && !G.evsQ.includes(r.id) && evsTap(r.id).ok);
  for (const p of active()) {
    if (p.bleed === 'mtp' && !p.bb && o.mtp !== false && (G.mode !== 'md' || (p.prov && p.prov !== G.me))) add(1, () => !p.bb && activateMTP(p.id).ok);
    if (p.loc === 'wall' || p.loc === 'triage' || p.loc === 'waiting') {
      if (emergent(p)) { add(2, bed(p)); continue; }
      if (p.loc === 'waiting' || (regQuick(p) && p.tri === 'done')) add(5 + vEsi(p) * 0.1, bed(p));
      if (o.intake !== false && p.loc !== 'waiting') {
        if (p.reg === 'none') add(p.loc === 'wall' ? 6.3 : 6, () => { const s = regPick(); return !!s && p.reg === 'none' && register(p.id, s.id).ok; });
        if (p.tri === 'none') add(p.loc === 'wall' ? 5.8 - (vEsi(p) <= 2 ? 0.7 : 0) : 6.5, () => { const s = triPick(); return !!s && p.tri === 'none' && triage(p.id, s.id).ok; });
      }
      continue;
    }
    if (p.loc !== 'room') continue;
    if (p.dsp === 'ready') add(3, () => (p.rehab ? dischargeRehab(p.id) : discharge(p.id)).ok);   // the bot reads the exam
    if (p.dsp === 'readytx' && !mdMine(p)) add(3.2, () => requestTransfer(p.id).ok);
    if (p.dsp === 'txok' && o.ift !== false && !mdMine(p)) add(3.3, () => bookIFT(p.id, IFT_LV[iftNeed(p)]).ok);
    if (p.dsp === 'bedready' && o.up !== false) add(3.4, () => {
      if (p.dsp !== 'bedready') return false;
      const tp = G.staff.filter(s => s.role === 'tp' && s.st === 'on').sort((a, x) => load(a) - load(x))[0];
      const pc = G.staff.find(s => s.role === 'pct' && s.st === 'on' && !s.task && !s.q.length);
      const who = tp && load(tp) < 2 ? tp : (pc || tp);
      return !!who && sendUp(p.id, who.id).ok;
    });
    const mdWait = G.mode === 'md' && !(p.prov && p.prov !== G.me) && G.t - (p.tNeed != null ? Math.max(p.tNeed, p.tRoom) : p.tRoom) < (p.arrest ? 1 : vEsi(p) <= 2 ? 6 : 15);
    if (needsProv(p) && o.prov !== false && !(G.mode === 'md' && p.prov === G.me) && !mdWait) add(vEsi(p) <= 2 ? 4.5 : 7, () => {
      if (!needsProv(p)) return false;
      const opts = G.staff.filter(s => isProv(s) && s.st === 'on' && s.id !== G.me && canAssign(s, p).ok);
      if (!opts.length) return false;
      const cost = s => s.q.length + (s.role === 'md' && p.esi >= 3 ? 1.5 : 0);
      opts.sort((a, x) => cost(a) - cost(x));
      return assign(opts[0].id, p.id).ok;
    });
    if (p.reg === 'none' && o.intake !== false) add(6.2, () => { const s = regPick(); return !!s && p.reg === 'none' && register(p.id, s.id).ok; });
    if (con2Open(p) && !mdMine(p)) add(7.4, () => con2Open(p) && consult(p.id, p.con2).ok);
    if (p.con && p.consult.st === 'none' && !mdMine(p) && !(G.mode === 'md' && !p.prov) && (p.alertOn || p.ev === 'done') && preDone(p) && (p.dxK || o.early)) add(7.5, () => p.consult.st === 'none' && consult(p.id, p.con).ok);
    if (p.lang && p.interp === 'none' && (o.interp == null || chance(o.interp))) add(8, () => requestInterp(p.id).ok);
    if (!G.staff.some(s => s.role === 'rph' && s.st === 'on') && !G.mods.remoteRph && Object.keys(p.treat).some(k => p.treat[k].st === 'verify')) add(8.5, () => overrideRx(p.id).ok);
  }
  if (o.pit) {
    const w = waitingCount(), pit = G.staff.find(s => s.pit && s.st === 'on');
    if (!pit && w >= 8) { const a = G.staff.find(s => s.role === 'app' && s.st === 'on' && !s.q.length); if (a) add(9, () => setPit(a.id, true).ok); }
    else if (pit && w <= 2) add(9, () => setPit(pit.id, false).ok);
  }
  // Gray-zone calls, rechecks, updates, chairs, the capacity levers, and where Casey works.
  const acc = o.acc == null ? 0.85 : o.acc;
  for (const p of active()) {
    if (p.dsp === 'decide' && p.loc === 'room' && o.gray !== false && !mdMine(p)) add(3.1, () => { if (p.dsp !== 'decide') return false; let k = p.gray.right; if (!chance(acc)) k = pick(['home', 'obs', 'admit'].filter(x => x !== k)); return grayDispo(p.id, k).ok; });
    if (p.loc === 'waiting' && o.recheck !== false && G.t - (p.lastRecheck != null ? p.lastRecheck : (p.tTriage != null ? p.tTriage : p.tArrive)) > 60) add(8.2, () => { const s = triPick(); return !!s && p.loc === 'waiting' && recheck(p.id, s.id).ok; });
    if (p.loc === 'room' && o.updates !== false && (p.dsp === 'none' || p.dsp === 'board') && G.t - (p.lastUpdate != null ? p.lastUpdate : p.tRoom) > 90) add(9.2, () => updatePt(p.id).ok);
  }
  if (o.updates !== false && waitingCount() >= 4 && G.t - G.wrUpdate >= 30) add(8.8, () => updateWaiting().ok);
  if (o.chairs !== false && waitingCount() >= 3) {
    const free = G.rooms.find(r => r.kind === 'chair' && !r.pid && !r.closed);
    const c = free && inRooms().filter(p => { const r = roomOf(p); return r.kind !== 'chair' && (r.kind !== 'resus' || p.dsp === 'watch') && !p.gray && (p.dsp === 'ready' || p.dsp === 'watch' || (p.dsp === 'none' && p.ev === 'done' && p.dispo === 'home')) && canPlace(p, free).ok; }).sort((a, b) => (b.dsp === 'watch') - (a.dsp === 'watch') || a.tRoom - b.tRoom)[0];   // a patient being watched frees a room (and a resus bay) first
    if (c) add(5.2, () => !free.pid && move(c.id, free.id).ok);
  }
  for (const p of holds()) {
    if (roomOf(p).kind !== 'chair') continue;
    const bed = G.rooms.find(r => r.kind === 'main' && !r.pid && r.st === 'clean' && !r.closed && !r.iso && !r.safe);
    if (bed) add(5.1, () => p.loc === 'room' && roomOf(p).kind === 'chair' && !bed.pid && move(p.id, bed.id).ok);
  }
  if (o.fcp !== false && waitingCount() >= 8 && inRooms().filter(p => p.dsp === 'board' && p.dispo === 'admit').length >= 4 && G.t - G.fcp.last >= 240) add(3.6, () => fullCapacity().ok);
  const cx = staff('rnX');
  if (cx && cx.st === 'on' && o.zones !== false) {
    const rn = zoneNurses('resus').filter(s => s.id !== 'rnX').length || 1;
    const want = zoneLoad('resus', holdNurses().length > 0) / rn > 4.5;
    const has = cx.zones.includes('resus') && !cx.cover.some(c => c.zones.includes('resus'));
    if (want !== has && (want ? !cx.zones.length : true)) add(2.5, () => toggleZone('rnX', 'resus').ok);
  }
  if (o.breaks && G.t > 180) {
    const due = G.staff.find(s => s.st === 'on' && !(G.mode === 'md' && s.id === G.me) && G.t - s.lastBreak > 260 && !G.staff.some(x => x.st === 'break' && x.role === s.role));
    if (due) add(9.5, () => sendBreak(due.id).ok);
  }
  acts.sort((a, x) => a.pr - x.pr || a.n - x.n);
  for (const a of acts) { if (budget <= 0) break; if (a.fn()) budget--; }
}

function mdPlay(o) {
  // Plays the attending: answers the radio, picks up the sickest patients, writes orders, makes the calls.
  o = o || {};
  const acc = o.acc == null ? 0.85 : o.acc, me = staff(G.me);
  let budget = o.budget == null ? 1e9 : o.budget;
  const act = fn => { if (budget > 0 && fn()) budget--; };
  if (!me || G.mode !== 'md') return;
  if (G.card && G.card.mine && G.card.eid === 'code') act(() => {   // a rhythm check in a code: right as often as the bot is accurate
    const c = G.card, q = codeSteps(pt(c.ctx.pid))[c.ctx.step], r = String(q.c.findIndex(x => x[2]));
    chooseCard(chance(acc) ? r : (c.choices.find(x => x.k !== r) || c.choices[0]).k); return true; });
  else if (G.card && G.card.mine) { act(() => { chooseCard(G.card.choices[0].k); return true; }); }   // v0.28: the call from administration, or a lawyer: refer to risk management
  const c = G.box.cur;
  if (c && c.kind === 'consult' && !c.taken) act(() => { const r = boxTake(G.me); if (!r.ok) return false; boxDecide(r.sc.opts ? (chance(acc) ? r.sc.r : (r.sc.r + 1) % r.sc.opts.length) : chance(acc) ? r.sc.a : !r.sc.a); return true; });
  for (const p of active()) {
    if (!mdMine(p)) continue;
    if (p.ord === 'need' || p.ord === 'more') act(() => {
      const R = p.right; let tests = R.wk.slice(), treats = R.tr.slice();
      if (p.ord === 'need' && !chance(acc)) { if (chance(0.5) && tests.length) tests.pop(); else tests.push(pick(['lab', 'xr', 'ct'].filter(k => !tests.includes(k))) || 'lab'); }
      // v0.28: the bot picks drugs too, and sometimes the wrong one in the right class
      const asDrug = t => { const d = drugFor(p, t); if (!d) return t; if (chance(acc)) return d; const alt = Object.keys(DRUGS).filter(id => id !== d && DRUGS[id].c === DRUGS[d].c && DRUGS[id].tx.includes(t) && !rxOk(p, t, id) && !(CONTRA[p.ck] || []).includes(id)); return alt.length ? pick(alt) : d; };
      return signOrders(p.id, tests, treats.flatMap(t => (reqOf(p, t) ? (chance(acc) ? drugsFor(p, t) : drugsFor(p, t).slice(0, 1)) : [asDrug(t)]))).ok;
    });
    else if (p.txGap && p.txGap.length) act(() => signOrders(p.id, [], p.txGap.flatMap(t => { const d = drugsFor(p, t); return d.length ? d : [t]; })).ok);
    if (p.dxq) act(() => dxPick(p.id, chance(acc) ? dxName(p.ck) : pick(p.dxq.filter(x => x !== dxName(p.ck)))).ok);
    if (p.dsp === 'mddecide') act(() => {
      const want = chance(acc) ? p.dispo : pick(['home', 'admit']);
      if (want === 'home') return mdDecide(p.id, 'home').ok;
      if (want === 'transfer') return mdDecide(p.id, 'transfer').ok;
      return p.con && preDone(p) ? consult(p.id, p.con).ok : false;
    });
    if (p.dsp === 'decide') act(() => grayDispo(p.id, chance(acc) ? p.gray.right : 'home').ok);
    if (con2Open(p)) act(() => consult(p.id, p.con2).ok);   // v0.27: the second service
    if (p.dsp === 'readytx') act(() => requestTransfer(p.id).ok);   // v0.26: find a hospital, pick the crew, give report
    if (p.dsp === 'txok') act(() => bookIFT(p.id, IFT_LV[iftNeed(p)]).ok);
    if (p.dsp === 'iftreport' && p.iftRep == null) act(() => giveReport(p.id).ok);
  }
  for (const p of inRooms()) if (mdMine(p) && p.arrest && p.ev === 'none') act(() => assign(G.me, p.id).ok);   // your own patient arrested: run the code
  const line = me.q.filter(k => !k.started && k.type !== 'box').length;
  if (line < (o.line || 2) && me.st === 'on') {
    const next = inRooms().filter(p => needsProv(p) && !p.prov && p.ev === 'none').sort((a, b) => (b.arrest - a.arrest) || vEsi(a) - vEsi(b) || a.tRoom - b.tRoom)[0];
    if (next) act(() => assign(G.me, next.id).ok);
  }
}

/* ---------- v0.29: high-yield, must-not-miss conditions from the 2022 EM Model ----------
   The compact case format: one entry carries everything a case needs, and addCase() files it into the engine's tables
   (CASES, NEED, RES, VCASE, EXAM, ORD_WHY, FIND_PLAIN, DX_PLAIN, RXOK, DDX, MUST, CONTRA, RX, LESSON_CASE).
   Results are written as findings, the way a report reads, so the diagnosis is the doctor's call. */
const LESSON_CASE = {};
const CASE_FIELDS = ['need', 'res', 'vc', 'exam', 'why', 'plain', 'dxp', 'rx', 'req', 'also', 'ddx', 'must', 'contra', 'rxn', 'sys', 'pearl', 'pitfall', 'lname'];
const LESSON_SYSTEMS = ['cardio', 'resp', 'neuro', 'gi', 'endo', 'gu', 'obgyn', 'infect', 'tox', 'trauma', 'ems'];
function addCase(d) {
  // v0.29.1: a case that can't be finished, or that points at something missing, fails at load instead of in a shift
  const bad = [];
  if (CASES.some(c => c.k === d.k)) bad.push('duplicate key');
  if (!d.exam || !d.why || !d.dxp || !d.pearl || !d.pitfall) bad.push('missing text');
  if (!LESSON_SYSTEMS.includes(d.sys)) bad.push('unknown body system ' + d.sys);
  if (d.con && !SPECS[d.con]) bad.push('unknown specialist ' + d.con);
  if (['obs'].includes(d.dispo) && !d.gray) bad.push('observation needs a gray-zone call');
  if (['admit', 'icu', 'or', 'transfer'].includes(d.dispo) && !d.con) bad.push('needs a specialist for ' + d.dispo);
  if (d.dispo === 'transfer' && !d.txTo) bad.push('transfer without a destination');
  for (const t of d.tr || []) if (!TREAT[t]) bad.push('unknown treatment ' + t);
  for (const t of (d.need || {}).n || []) if (!LABS[t] && !IMGS[t]) bad.push('unknown test ' + t);
  for (const l of Object.values(d.rx || {}).concat(...Object.values(d.req || {}))) for (const x of l) if (!DRUGS[x]) bad.push('unknown drug ' + x);
  for (const x of (d.contra || []).concat(d.also || [])) if (x !== '@bleed' && !DRUGS[x]) bad.push('unknown drug ' + x);
  if ((d.ddx || []).length !== 3) bad.push('needs three wrong choices');
  if (bad.length) throw new Error(`addCase ${d.k}: ${bad.join('; ')}`);
  const c = Object.assign({}, d); c.wt = (d.wt == null ? 1 : d.wt) * 0.4;   /* rare, as in real life */ for (const k of CASE_FIELDS) delete c[k];
  CASES.push(c);
  if (d.need) NEED[d.k] = d.need;
  if (d.res) RES[d.k] = d.res;
  if (d.vc) VCASE[d.k] = d.vc;
  EXAM[d.k] = d.exam; ORD_WHY[d.k] = d.why; DX_PLAIN[d.dx] = d.dxp;
  Object.assign(FIND_PLAIN, d.plain || {});
  if (d.rx) RXOK[d.k] = d.rx;
  if (d.req) RXREQ[d.k] = d.req;
  if (d.also) ALSO[d.k] = d.also;
  // each test's own result gets the plain words of the finding it belongs to
  for (const [t, r] of Object.entries(d.res || {})) { const txt = Array.isArray(r) ? r[0] : r, f = (d.find || {})[DET_KIND(t)]; if (!FIND_PLAIN[txt] && f && FIND_PLAIN[f]) FIND_PLAIN[txt] = FIND_PLAIN[f]; }
  if (d.ddx) DDX[d.k] = d.ddx;
  if (d.must) MUST.add(d.k);
  if (d.contra) CONTRA[d.k] = d.contra;
  if (d.rxn) RX[d.k] = d.rxn;
  LESSON_CASE[d.k] = { sys: d.sys, name: d.lname || d.dx, pearl: d.pearl, pitfall: d.pitfall };
  if (d.lname) DXQ[d.k] = DXQ[d.k] || d.lname;
}
Object.assign(LABS, {
  lp: { n: 'Lumbar puncture (CSF)', g: 'Infection and breathing', p: 'Spinal fluid: meningitis, bleeding' },
  crp: { n: 'ESR and CRP', g: 'Infection and breathing', p: 'Inflammation markers' },
  apaplev: { n: 'Acetaminophen level', g: 'Urine and other', p: 'Best timed 4 hours or more after the dose' },
  sal: { n: 'Salicylate level', g: 'Urine and other', p: 'Aspirin and other salicylates in the blood' },
});
Object.assign(LAB_NORMAL, { lp: 'CSF: WBC 2, glucose 64, protein 32 (normal)', crp: 'ESR 8, CRP 0.4 (normal)', apaplev: 'Acetaminophen not detected', sal: 'Salicylate not detected' });
IMGS.scrotus = { n: 'Scrotal ultrasound', m: 'us', p: 'Blood flow to the testicles' };
IMGS.aous = { n: 'Bedside aorta ultrasound', m: 'us', p: 'The size of the abdominal aorta' };
IMGS.ctaorta = { n: 'CT angiogram, aorta', m: 'ct', p: 'The aorta from chest to pelvis' };
IMGS.ctaabd = { n: 'CT angiogram, abdomen', m: 'ct', p: 'The arteries to the bowel and kidneys' };
LABS.bscan = { n: 'Bladder scan', g: 'Bedside (point of care)', p: 'Urine left in the bladder', poc: true };
LAB_NORMAL.bscan = 'About 40 mL left after voiding';
IMGS.echo = { n: 'Bedside heart ultrasound', m: 'us', p: 'How the heart squeezes; a strained right side' };
IMG_NORMAL.echo = ['Normal squeeze, normal right side, no fluid around the heart', null];
IMG_NORMAL.scrotus = ['Normal flow to both testicles', null]; IMG_NORMAL.aous = ['Aorta 1.9 cm, normal', null]; IMG_NORMAL.ctaorta = ['Normal aorta', null]; IMG_NORMAL.ctaabd = ['Arteries to the bowel open', null];
Object.assign(SPECS, {
  cts: { name: 'Cardiothoracic Surgery', what: 'The heart and the aorta in the chest. Not at this hospital: by phone', short: 'CT Surg', phone: true, doc: 'Dr. Rahimi', mad: x => `Is ${x} back? I need the images.` },
  vasc: { name: 'Vascular Surgery', what: 'The aorta and big arteries', short: 'Vasc', doc: 'Dr. Okafor', mad: x => `I need ${x} before I can plan anything.` },
  nsurg: { name: 'Neurosurgery', what: 'Bleeding in the head, the spine', short: 'NSurg', doc: 'Dr. Lindqvist', mad: x => `Send me ${x} first.` },
  obgyn: { name: 'OB/GYN', what: 'Pregnancy, the uterus and ovaries', short: 'OB', doc: 'Dr. Adeyemi', mad: x => `Is she pregnant? I need ${x}.` },
  uro: { name: 'Urology', what: 'Kidneys, bladder, testicles', short: 'Uro', doc: 'Dr. Castellano', mad: x => `Call me back with ${x}.` },
});
TREAT.ctube = { label: 'Chest tube', by: 'prov', dur: 10 };
PROC.ctube = { n: 'Chest tube', tx: 'ctube', p: 'Drains air or blood from around the lung' };
HARM.ctube = [0.3, 15, 'had a collapsed lung from a chest tube they didn’t need'];
ORDER_MENUS.find(m => m[0] === 'proc')[2].push('ctube');
Object.assign(DRUGS, {
  esmolol: { n: 'Esmolol drip', c: 'cardiac', tx: ['bp'], p: 'Short-acting beta blocker: heart rate first in a dissection' },
  insreg: { n: 'Regular insulin 10 units IV', c: 'endo', tx: ['insulin'], p: 'Pushes potassium into cells; give dextrose with it' },
  levet: { n: 'Levetiracetam', c: 'neuro', tx: ['meds'], p: 'Second drug for seizures that won’t stop' },
  clinda: { n: 'Clindamycin', c: 'abxi', tx: ['abx'], p: 'Turns off toxin in flesh-eating infections' },
  ampi: { n: 'Ampicillin', c: 'abxi', tx: ['abx'], p: 'Covers Listeria in meningitis over 50' },
  midaz: { n: 'Midazolam', c: 'neuro', tx: ['meds'], p: 'Seizures and agitation; works IM or in the nose' },
  fosphen: { n: 'Fosphenytoin', c: 'neuro', tx: ['meds'], p: 'Second drug for seizures that won’t stop' },
  calcgluc: { n: 'Calcium gluconate', c: 'endo', tx: ['meds'], p: 'Protects the heart in high potassium; gentler on veins' },
  rhogam: { n: 'Anti-D immune globulin', c: 'other', tx: ['meds'], p: 'For an Rh-negative mother who is bleeding' },
});
RXOK.dka = Object.assign({}, RXOK.dka, { insulin: ['insdrip'] });
[
  { k: 'pe', sys: 'cardio', cc: 'Short of breath, chest hurts on a deep breath', dx: 'Pulmonary embolism', esi: 2, src: 'b', age: [30, 80], wt: 1.4, wk: ['ecg', 'lab', 'ct'], tr: ['o2', 'meds'], con: 'hosp', pre: ['ct'], dispo: 'admit', vit: 'HR 118, SpO2 90%',
    need: { n: ['ctpe', 'trop', 'bmp'], ok: ['cbc', 'bnp', 'cxr', 'coag', 'hcg'] }, res: { ctpe: ['Filling defects in both lower lobe arteries', null], trop: 'Troponin 0.04, just above the cutoff', bmp: 'Na 138, K 4.0, creatinine 0.9' },
    find: { ecg: 'Sinus tachycardia 118, S wave in I, T inversion in III', lab: 'Troponin just above the cutoff', ct: 'Filling defects in both lower lobe arteries' },
    plain: { 'Sinus tachycardia 118, S wave in I, T inversion in III': 'a fast heart with a strain pattern', 'Troponin just above the cutoff': 'a little heart strain', 'Filling defects in both lower lobe arteries': 'something blocking the lung arteries' },
    vc: { hr: 118, rr: 24, spo2: 90.5, sbp: 124, dbp: 78 }, exam: 'Breathing fast with clear lungs. The right calf is swollen and tender.', why: 'A CT angiogram of the chest finds the clot. Troponin and a BMP check heart strain and the kidneys. Oxygen and a blood thinner; admit.',
    rx: { meds: ['heparin', 'enox'] }, rxn: 'heparin', contra: ['tnk'], ddx: ['Pneumonia', 'Pneumothorax', 'NSTEMI'], must: true, dxp: 'A blood clot in the arteries of the lungs',
    pearl: 'Clear lungs, a fast heart and low oxygen with a swollen leg is a **clot** until proven otherwise.', pitfall: 'A **D-dimer** only helps when the risk is low. With a high risk, go straight to the **CT angiogram**.' },
  // v0.29.1: the clot that drops the pressure. Here tenecteplase is required, not contraindicated.
  { k: 'mpe', sys: 'cardio', cc: 'Passed out, short of breath, gray', dx: 'Massive pulmonary embolism', lname: 'Massive PE', esi: 1, src: 'e', age: [35, 80], wt: 0.5, wk: ['ecg', 'lab', 'us'], tr: ['o2', 'tnk'], con: 'icu', pre: ['us'], dispo: 'icu', vit: 'HR 132, BP 78/48, SpO2 86%',
    need: { n: ['echo', 'trop', 'bmp'], ok: ['cbc', 'bnp', 'cxr', 'coag', 'lact', 'hcg', 'ts', 'duplex'] }, res: { echo: ['Right ventricle large and barely squeezing; the left side small and fast; no fluid around the heart', null], trop: 'Troponin 0.31, high', bmp: 'Na 137, K 4.3, creatinine 1.2' },
    find: { ecg: 'Sinus tachycardia 132, new right bundle branch block', lab: 'Troponin 0.31, high', us: 'Right ventricle large and barely squeezing; the left side small and fast; no fluid around the heart' },
    plain: { 'Sinus tachycardia 132, new right bundle branch block': 'a fast heart; the right side is straining', 'Troponin 0.31, high': 'the heart muscle is being damaged', 'Right ventricle large and barely squeezing; the left side small and fast; no fluid around the heart': 'the right side of the heart is failing against a blocked lung; no fluid squeezing the heart' },
    vc: { hr: 132, sbp: 78, dbp: 48, rr: 30, spo2: 86 }, exam: 'Gray and sweaty. Neck veins full. Clear lungs. The left leg is swollen.',
    why: 'Too unstable for the scanner. A bedside heart ultrasound shows a failing right heart with a pressure under 90: that is massive PE. The clot buster (tenecteplase) now, and oxygen. ICU.',
    rx: { tnk: ['tnk'] }, also: ['heparin', 'enox', 'norepi', 'pushepi', 'ns', 'lr'], rxn: 'tenecteplase', ddx: ['Septic shock', 'STEMI', 'Cardiac tamponade'], must: true, dxp: 'A clot big enough to block the lungs and fail the heart',
    pearl: 'A clot with a pressure under **90** is massive PE: the **clot buster** is the treatment.', pitfall: 'Don’t send a pressure of 78 to the **CT scanner**: the **bedside ultrasound** makes the call. In a stable PE the clot buster does more harm than good.' },
  { k: 'dissect', sys: 'cardio', cc: 'Tearing chest pain into the back', dx: 'Aortic dissection', esi: 1, src: 'e', age: [50, 85], wt: 0.7, wk: ['ecg', 'lab', 'ct'], tr: ['bp', 'meds'], con: 'cts', pre: ['ct'], ift: 'cct', dispo: 'transfer', txTo: 'a hospital with cardiac surgery', vit: 'Pressure much higher in the right arm',
    need: { n: ['ctaorta', 'trop', 'ts'], ok: ['cbc', 'bmp', 'cxr', 'coag'] }, res: { ctaorta: ['A flap inside the ascending aorta, running to the arch', null], trop: 'Troponin below the cutoff', ts: 'A positive, antibody screen negative' },
    find: { ecg: 'Sinus rhythm, left ventricular hypertrophy', lab: 'Troponin below the cutoff', ct: 'A flap inside the ascending aorta, running to the arch' },
    plain: { 'Sinus rhythm, left ventricular hypertrophy': 'a thick heart muscle from years of high pressure', 'Troponin below the cutoff': 'no heart muscle damage', 'A flap inside the ascending aorta, running to the arch': 'the wall of the aorta has split' },
    vc: { hr: 104, sbp: 188, dbp: 104, rr: 20 }, exam: 'The pressure differs between the arms. A new soft murmur after the second heart sound.', why: 'A CT angiogram of the aorta shows the flap. Slow the heart first (esmolol or labetalol), then lower the pressure. Pain control. Type and screen for surgery. Cardiothoracic surgery takes the call by phone; transfer to a hospital with cardiac surgery.',
    req: { bp: [['esmolol', 'labet']] }, rx: { meds: ['fent', 'morph', 'hydro'] }, also: ['nicard'], rxn: 'pain control', contra: ['@bleed', 'apixa'], ddx: ['NSTEMI', 'Pulmonary embolism', 'Pericarditis'], must: true, dxp: 'A tear in the wall of the aorta',
    pearl: 'Sudden **tearing** pain to the back, a **pressure difference** between the arms, or a new murmur: think of the aorta.', pitfall: 'Never give **blood thinners** or a clot buster for chest pain until dissection is off the table. Rate first, then pressure.' },
  { k: 'aaa', sys: 'cardio', cc: 'Sudden back pain, then passed out', dx: 'Ruptured abdominal aortic aneurysm', lname: 'Ruptured AAA', esi: 1, src: 'e', age: [60, 90], wt: 0.6, wk: ['us', 'lab'], tr: ['mtp'], con: 'vasc', pre: ['us'], dispo: 'or', bleed: 'mtp', vit: 'HR 124, BP 82/50',
    need: { n: ['aous', 'ts', 'cbc'], ok: ['bmp', 'coag', 'lact', 'fast'] }, res: { aous: ['Aorta 7.2 cm across, fluid beside it', null], cbc: 'WBC 12.0, Hgb 8.9, platelets 210', ts: 'O positive, antibody screen negative' },
    find: { us: 'Aorta 7.2 cm across, fluid beside it', lab: 'Hgb 8.9' }, plain: { 'Aorta 7.2 cm across, fluid beside it': 'a huge aorta with blood around it', 'Hgb 8.9': 'blood count low' },
    vc: { hr: 124, sbp: 82, dbp: 50 }, exam: 'A pulsing mass above the belly button. Pale and sweaty.', why: 'A bedside aorta ultrasound finds it. Massive transfusion, type and screen, and vascular surgery to the OR. No CT for an unstable patient.',
    contra: ['@bleed'], ddx: ['Kidney stone', 'Perforated ulcer', 'Mesenteric ischemia'], must: true, dxp: 'A ballooned main artery in the belly that burst',
    pearl: 'An older man with **back or flank pain and low pressure** has a burst aorta until the ultrasound says no.', pitfall: 'It’s often called a **kidney stone**. Look at the **aorta** with the bedside ultrasound before anyone goes to CT, and keep the pressure low, not normal.' },
  { k: 'hyperk', sys: 'endo', cc: 'Weak legs, missed dialysis twice', dx: 'Hyperkalemia', esi: 2, src: 'e', age: [40, 85], wt: 1.1, wk: ['ecg', 'lab'], tr: ['meds', 'insulin'], con: 'hosp', pre: ['lab'], dispo: 'admit', vit: 'HR 52',
    need: { n: ['bmp'], ok: ['cbc', 'vbg', 'trop', 'gluc'] }, res: { bmp: 'Na 135, K 7.1, BUN 92, creatinine 9.8' },
    find: { ecg: 'Peaked T waves, QRS 130 ms, rate 52', lab: 'K 7.1, creatinine 9.8' }, plain: { 'Peaked T waves, QRS 130 ms, rate 52': 'tall pointed T waves and slow, wide beats', 'K 7.1, creatinine 9.8': 'potassium dangerously high; the kidneys aren’t working' },
    vc: { hr: 52, sbp: 162, dbp: 90 }, exam: 'Weak legs. A dialysis fistula in the left arm.', why: 'The ECG shows the danger before the lab does. Calcium protects the heart; insulin with dextrose pushes potassium into cells; then dialysis.',
    req: { meds: [['calc', 'calcgluc'], ['d50']], insulin: [['insreg']] }, also: ['albut', 'bicarb', 'furo'], rxn: 'calcium and dextrose', contra: ['succ', 'kcl'], ddx: ['Hypoglycemia', 'Beta blocker overdose', 'Sick sinus syndrome'], must: true, dxp: 'Too much potassium in the blood. The heart can stop',
    pearl: 'A dialysis patient who missed sessions, weak and slow: get the **ECG first**. Peaked T waves and a wide QRS mean treat now.', pitfall: '**Calcium** doesn’t lower potassium; it buys time. Insulin with **dextrose** (watch the sugar), then dialysis.' },
  { k: 'sah', sys: 'neuro', cc: 'Sudden, worst headache of my life', dx: 'Subarachnoid hemorrhage', esi: 2, src: 'b', age: [30, 70], wt: 0.9, wk: ['ct', 'lab'], tr: ['bp', 'meds'], con: 'nsurg', pre: ['ct'], dispo: 'icu',
    need: { n: ['cthead', 'coag', 'bmp'], ok: ['cta', 'cbc', 'ts'] }, res: { cthead: ['Bright blood in the basal cisterns and sylvian fissures', null], coag: 'INR 1.0', bmp: 'Na 138, K 3.9, glucose 128' },
    find: { ct: 'Bright blood in the basal cisterns and sylvian fissures', lab: 'INR 1.0' }, plain: { 'Bright blood in the basal cisterns and sylvian fissures': 'fresh blood around the base of the brain', 'INR 1.0': 'clotting normal' },
    vc: { sbp: 178, dbp: 98, hr: 88 }, exam: 'Stiff neck. Awake but slow to answer. Pupils equal.', why: 'CT head within 6 hours finds most of these bleeds. Keep the systolic under 160, treat pain and nausea. Neurosurgery admits to the ICU.',
    rx: { bp: ['nicard', 'labet'], meds: ['ondan', 'fent', 'apap'] }, rxn: 'pain and nausea control', contra: ['@bleed', 'apixa'], ddx: ['Migraine', 'Bacterial meningitis', 'Hypertensive emergency'], must: true, dxp: 'Bleeding around the brain, often from a burst aneurysm',
    pearl: 'A **thunderclap** headache, worst at the start, is a bleed until proven otherwise.', pitfall: 'A normal CT after **6 hours** doesn’t rule it out: a lumbar puncture or CT angiogram comes next.' },
  { k: 'mening', sys: 'infect', cc: 'Fever, headache, stiff neck', dx: 'Bacterial meningitis', esi: 2, src: 'b', age: [18, 70], wt: 0.9, wk: ['lab'], tr: ['abx', 'meds'], con: 'icu', pre: ['lab'], dispo: 'icu', iso: 'drop',
    need: { n: ['bcx', 'lp', 'cbc'], ok: ['cthead', 'bmp', 'lact', 'coag'] }, res: { lp: 'CSF: WBC 2,400 (90% neutrophils), glucose 22, protein 310', cbc: 'WBC 19.4, Hgb 13.2, platelets 140', bcx: 'Sent. Results in 1 to 2 days' },
    find: { lab: 'CSF WBC 2,400, glucose 22' }, plain: { 'CSF WBC 2,400, glucose 22': 'pus in the spinal fluid; germs eating the sugar' },
    vc: { temp: 103.1, hr: 116, sbp: 112, dbp: 66, rr: 22 }, exam: 'Neck stiff; light hurts the eyes. A few purple spots on the legs.', why: 'Blood cultures, then antibiotics right away: don’t wait for the CT or the LP. Ceftriaxone and vancomycin, with dexamethasone; over 50, add ampicillin for Listeria. Droplet isolation.',
    req: { abx: [['ctx', 'cefepime'], ['vanc']], meds: [['dexa']] }, also: ['acyclo', 'ampi'], rxn: 'dexamethasone', ddx: ['Viral meningitis', 'Subarachnoid hemorrhage', 'Encephalitis'], must: true, dxp: 'An infection of the lining of the brain',
    pearl: 'Fever, headache and a stiff neck: **antibiotics first**, tests second.', pitfall: 'A CT before the LP is fine, but **never hold antibiotics** waiting for it.' },
  { k: 'status', sys: 'neuro', cc: 'Seizing for 10 minutes', dx: 'Status epilepticus', esi: 1, src: 'e', age: [18, 70], wt: 0.9, wk: ['lab', 'poc'], tr: ['meds'], con: 'neuro', pre: ['lab'], dispo: 'icu', vit: 'Still seizing, jaw clenched',
    need: { n: ['gluc', 'bmp'], ok: ['cbc', 'tox', 'cthead', 'ck'] }, res: { gluc: 'Glucose 112', bmp: 'Na 137, K 4.2, creatinine 1.1' },
    find: { lab: 'Sodium 137', poc: 'Glucose 112' }, plain: { 'Sodium 137': 'sodium normal', 'Glucose 112': 'sugar normal' },
    vc: { hr: 132, sbp: 168, dbp: 96, rr: 12, spo2: 92 }, exam: 'Rhythmic jerking of all four limbs. Eyes open, not responding.', why: 'Check the sugar first. Lorazepam IV now, then a second drug (levetiracetam). Then look for the cause.',
    req: { meds: [['loraz', 'midaz'], ['levet', 'fosphen']] }, also: ['d50', 'thiamine'], rxn: 'a benzodiazepine, then a second drug', ddx: ['Hypoglycemia', 'Alcohol withdrawal seizure', 'Psychogenic seizure'], must: true, dxp: 'A seizure that won’t stop on its own',
    pearl: 'A seizure past **5 minutes** won’t stop on its own. **Benzodiazepine** now, a second drug by 20 minutes.', pitfall: 'Always check the **fingerstick**: low sugar seizes too, and lorazepam won’t fix it.' },
  { k: 'cauda', sys: 'neuro', cc: 'Back pain, can’t pee', dx: 'Cauda equina syndrome', esi: 2, src: 'w', age: [30, 65], wt: 0.7, wk: ['mri', 'poc'], tr: ['meds'], con: 'nsurg', pre: ['mri'], dispo: 'or',
    need: { n: ['mris', 'bscan'], ok: ['bmp', 'cbc', 'udip', 'ua'] }, res: { mris: ['A large L4–L5 disc pressing on the nerve roots', null], bscan: '800 mL left after trying to pee' },
    find: { mri: 'A large L4–L5 disc pressing on the nerve roots', poc: '800 mL left after trying to pee' }, plain: { 'A large L4–L5 disc pressing on the nerve roots': 'a slipped disc squeezing the nerves', '800 mL left after trying to pee': 'the bladder isn’t emptying' },
    vc: {}, exam: 'Numb between the legs. Weak ankle push. Feels full but can’t pee.', why: 'A bladder scan shows retention; saddle numbness and retention need an MRI now. Neurosurgery takes them to the OR. Pain control meanwhile.',
    rx: { meds: ['morph', 'fent', 'hydro', 'ketor', 'apap'] }, rxn: 'pain control', ddx: ['Muscle strain', 'Kidney stone', 'Sciatica'], must: true, dxp: 'The nerves at the bottom of the spine are squeezed',
    pearl: 'Back pain with **saddle numbness**, retention or new weakness is an emergency MRI.', pitfall: 'Check a **bladder scan** after they try to pee. Retention is often the only clue.' },
  { k: 'ectopic', sys: 'obgyn', cc: 'Belly pain, missed period, dizzy', dx: 'Ruptured ectopic pregnancy', esi: 1, src: 'b', age: [18, 40], sex: 'F', wt: 0.9, wk: ['lab', 'us'], tr: ['mtp'], con: 'obgyn', pre: ['lab'], dispo: 'or', bleed: 'mtp', vit: 'HR 126, BP 86/52',
    need: { n: ['hcg', 'fast', 'ts', 'cbc'], ok: ['pelus', 'bmp', 'coag'] }, res: { hcg: 'Positive', fast: ['Free fluid in the pelvis and beside the liver', null], cbc: 'WBC 11.0, Hgb 8.4, platelets 230', ts: 'O negative, antibody screen negative' },
    find: { lab: 'Pregnancy test positive, Hgb 8.4', us: 'Free fluid in the pelvis and beside the liver' }, plain: { 'Pregnancy test positive, Hgb 8.4': 'pregnant, and the blood count is low', 'Free fluid in the pelvis and beside the liver': 'blood in the belly' },
    vc: { hr: 126, sbp: 86, dbp: 52 }, exam: 'Belly rigid, worst low on the left. Her shoulder hurts.', why: 'A pregnancy test and bedside ultrasound with free fluid: ruptured ectopic until proven otherwise. Massive transfusion, type and screen, OB/GYN to the OR.',
    also: ['rhogam'], contra: ['@bleed'], ddx: ['Ovarian cyst rupture', 'Appendicitis', 'Miscarriage'], must: true, dxp: 'A pregnancy outside the womb that burst and is bleeding',
    pearl: 'Every woman who could be pregnant gets a **pregnancy test**. Positive plus pain plus low pressure is a burst ectopic.', pitfall: 'She’s **Rh negative**: she’ll need anti-D immune globulin. Don’t wait for a formal ultrasound when she’s unstable.' },
  { k: 'ttorsion', sys: 'gu', cc: 'Sudden testicle pain, vomiting', dx: 'Testicular torsion', esi: 2, src: 'w', age: [12, 25], sex: 'M', wt: 0.7, wk: [], tr: ['meds'], con: 'uro', pre: [], dispo: 'or',
    need: { n: [], ok: ['scrotus', 'ua', 'udip', 'cbc'] }, res: { scrotus: ['Left testicle: no flow on Doppler; the cord swirls', null] },
    find: { us: 'Left testicle: no flow on Doppler; the cord swirls' }, plain: { 'Left testicle: no flow on Doppler; the cord swirls': 'no blood reaching the testicle; the cord is twisted' },
    vc: { hr: 108 }, exam: 'The left testicle sits high and sideways. No cremasteric reflex.', why: 'Call urology now: every hour counts. Ultrasound only if it won’t delay surgery. Pain control and an antiemetic.',
    rx: { meds: ['morph', 'fent', 'hydro', 'ondan', 'ketor'] }, rxn: 'pain control', ddx: ['Epididymitis', 'Inguinal hernia', 'Kidney stone'], must: true, dxp: 'A twisted testicle with its blood supply cut off',
    pearl: 'Sudden testicle pain in a young male is **torsion** until proven otherwise. The clock is about **6 hours**.', pitfall: 'Don’t let the ultrasound delay **urology**. A high, sideways testicle with no reflex is enough to call.' },
  { k: 'ovtorsion', sys: 'obgyn', cc: 'Sudden one-sided pelvic pain, vomiting', dx: 'Ovarian torsion', esi: 2, src: 'w', age: [14, 45], sex: 'F', wt: 0.7, wk: ['lab', 'us'], tr: ['meds'], con: 'obgyn', pre: ['us'], dispo: 'or',
    need: { n: ['hcg', 'pelus'], ok: ['cbc', 'ua', 'udip', 'bmp'] }, res: { hcg: 'Negative', pelus: ['Right ovary 9 cm with a cyst; no flow on Doppler', null] },
    find: { lab: 'Pregnancy test negative', us: 'Right ovary 9 cm with a cyst; no flow on Doppler' }, plain: { 'Pregnancy test negative': 'not pregnant', 'Right ovary 9 cm with a cyst; no flow on Doppler': 'a swollen ovary with no blood flow' },
    vc: { hr: 104 }, exam: 'Tender low on the right, no rebound. Vomited twice.', why: 'A pregnancy test, then a pelvic ultrasound with Doppler. OB/GYN to the OR to untwist it.',
    rx: { meds: ['morph', 'fent', 'hydro', 'ondan', 'ketor'] }, rxn: 'pain control', ddx: ['Appendicitis', 'Ectopic pregnancy', 'Kidney stone'], must: true, dxp: 'A twisted ovary with its blood supply cut off',
    pearl: 'Sudden one-sided pelvic pain with **vomiting**, often with a known cyst: think torsion.', pitfall: 'Doppler **flow doesn’t rule it out**. When the story fits, OB/GYN should look anyway.' },
  { k: 'sbo', sys: 'gi', cc: 'Belly swollen, vomiting, no gas', dx: 'Small bowel obstruction', esi: 3, src: 'b', age: [45, 85], wt: 1.3, wk: ['lab', 'ct'], tr: ['fluids', 'meds'], con: 'surg', pre: ['ct'], dispo: 'admit',
    need: { n: ['ctap', 'bmp', 'cbc'], ok: ['lact', 'lip', 'ua'] }, res: { ctap: ['Dilated small bowel to a transition point; the colon is empty', null], bmp: 'Na 134, K 3.2, creatinine 1.3', cbc: 'WBC 11.8, Hgb 14.6, platelets 300' },
    find: { ct: 'Dilated small bowel to a transition point; the colon is empty', lab: 'K 3.2, creatinine 1.3' }, plain: { 'Dilated small bowel to a transition point; the colon is empty': 'the bowel is blocked at one spot', 'K 3.2, creatinine 1.3': 'potassium low, a little dry' },
    vc: { hr: 108, sbp: 118, dbp: 72 }, exam: 'Belly swollen, tinkling bowel sounds. Old surgery scars.', why: 'CT finds the blockage. Fluids, an antiemetic, a tube to drain the stomach, and General Surgery.',
    rx: { meds: ['ondan', 'prochlor'] }, also: ['morph', 'fent', 'hydro', 'kcl'], contra: ['reglan'], rxn: 'an antiemetic', ddx: ['Gastroenteritis', 'Constipation', 'Pancreatitis'], dxp: 'The small intestine is blocked',
    pearl: 'Vomiting, a swollen belly and **old surgery scars**: adhesions block the bowel.', pitfall: 'Fever, a high lactate or pain out of proportion means the bowel may be **dying**: surgery today. No **metoclopramide**: it pushes the gut against the blockage.' },
  { k: 'mesisch', sys: 'gi', cc: 'Sudden severe belly pain', dx: 'Mesenteric ischemia', esi: 2, src: 'b', age: [65, 92], wt: 0.6, wk: ['ecg', 'lab', 'ct'], tr: ['fluids', 'meds'], con: 'surg', pre: ['ct'], dispo: 'or',
    need: { n: ['ctaabd', 'lact', 'cbc', 'bmp'], ok: ['lip', 'trop', 'coag', 'ts'] }, res: { ctaabd: ['No contrast in the superior mesenteric artery; thick small bowel wall', null], lact: 'Lactate 4.6', cbc: 'WBC 17.0, Hgb 13.1, platelets 260', bmp: 'Na 140, K 4.4, bicarbonate 17' },
    find: { ecg: 'Irregularly irregular, no P waves, rate 110', ct: 'No contrast in the superior mesenteric artery; thick small bowel wall', lab: 'Lactate 4.6' },
    plain: { 'Irregularly irregular, no P waves, rate 110': 'an irregular rhythm that throws clots', 'No contrast in the superior mesenteric artery; thick small bowel wall': 'the bowel’s main artery is blocked', 'Lactate 4.6': 'tissue starved of oxygen' },
    vc: { hr: 110, sbp: 128, dbp: 76 }, exam: 'In terrible pain, yet the belly is soft: pain out of proportion. An irregular pulse.', why: 'Pain out of proportion in an older patient with an irregular rhythm: CT angiogram and lactate. Heparin, fluids, pain control, and surgery.',
    req: { meds: [['heparin']] }, also: ['morph', 'fent', 'hydro'], rxn: 'heparin', ddx: ['Gastroenteritis', 'Kidney stone', 'Diverticulitis'], must: true, dxp: 'The bowel isn’t getting blood and dies within hours',
    pearl: 'Pain **out of proportion** to a soft belly in an older patient with A-fib is the bowel’s artery until proven otherwise.', pitfall: 'A **normal lactate** early doesn’t rule it out. Get the CT angiogram.' },
  { k: 'apapod', sys: 'tox', cc: 'Took a lot of pills 6 hours ago', dx: 'Acetaminophen overdose', esi: 2, src: 'b', age: [16, 45], wt: 0.9, wk: ['ecg', 'lab'], tr: ['meds'], con: 'hosp', pre: ['lab'], dispo: 'admit', sitter: true,
    need: { n: ['apaplev', 'sal', 'lft', 'coag', 'bmp'], ok: ['tox', 'hcg', 'cbc', 'vbg'] }, res: { apaplev: 'Acetaminophen 260 at 6 hours', sal: 'Salicylate not detected', lft: 'ALT 48, bilirubin 0.8', coag: 'INR 1.1', bmp: 'Na 139, K 3.8, creatinine 0.8' },
    find: { ecg: 'Normal sinus rhythm', lab: 'Acetaminophen 260 at 6 hours' }, plain: { 'Acetaminophen 260 at 6 hours': 'a level high enough to injure the liver' },
    vc: {}, exam: 'Looks well. Mild nausea. Took a bottle of acetaminophen after a fight.', why: 'The level at 4 hours or later decides treatment: here, N-acetylcysteine. Check aspirin and the liver too. A sitter for safety, then psychiatry.',
    rx: { meds: ['nac'] }, also: ['ondan', 'charcoal'], rxn: 'N-acetylcysteine', contra: ['apap'], ddx: ['Salicylate overdose', 'Alcohol intoxication', 'Acute hepatitis'], must: true, dxp: 'Too much acetaminophen. It injures the liver days later',
    pearl: 'They look **well** for the first day. The **4-hour level** decides treatment, not how they look.', pitfall: 'Always check an **aspirin level** too, and keep them safe: a sitter, then psychiatry.' },
  { k: 'salod', sys: 'tox', cc: 'Confused, breathing fast', dx: 'Salicylate overdose', esi: 1, src: 'e', age: [18, 60], wt: 0.5, wk: ['lab'], tr: ['fluids', 'meds'], con: 'icu', pre: ['lab'], dispo: 'icu',
    need: { n: ['sal', 'vbg', 'bmp'], ok: ['apaplev', 'tox', 'gluc', 'coag'] }, res: { sal: 'Salicylate 82', vbg: 'pH 7.46, pCO2 24', bmp: 'Na 140, K 3.4, bicarbonate 17, anion gap 21' },
    find: { lab: 'Salicylate 82, anion gap 21' }, plain: { 'Salicylate 82, anion gap 21': 'a very high aspirin level; acid building in the blood' },
    vc: { rr: 32, hr: 118, temp: 100.4 }, exam: 'Breathing deep and fast. Sweaty and confused. Ears ringing. An empty bottle of aspirin.', why: 'The level, a blood gas and chemistry. Sodium bicarbonate pushes it into the urine; fluids; dialysis when it’s this severe. Avoid intubating if you can; if you must, keep the breathing fast.',
    req: { meds: [['bicarb']] }, also: ['charcoal', 'kcl', 'd50'], rxn: 'sodium bicarbonate', contra: ['asa'], ddx: ['DKA', 'Sepsis', 'Panic attack'], must: true, dxp: 'Too much aspirin. The blood turns acid',
    pearl: 'Fast deep breathing, **ringing ears** and confusion: check a salicylate level.', pitfall: 'Their fast breathing is keeping them alive. **Intubation** can kill. If you must, match the breathing rate.' },
  { k: 'tcaod', sys: 'tox', cc: 'Drowsy after an overdose, heart racing', dx: 'Tricyclic antidepressant overdose', lname: 'Tricyclic overdose', esi: 1, src: 'e', age: [18, 60], wt: 0.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'icu', pre: ['ecg'], dispo: 'icu',
    need: { n: ['tox', 'bmp'], ok: ['apaplev', 'sal', 'vbg', 'gluc'] }, res: { tox: 'Ethanol 40; screen sent', bmp: 'Na 138, K 3.9, creatinine 1.0' },
    find: { ecg: 'Sinus tachycardia 128, QRS 140 ms, tall R wave in aVR', lab: 'Ethanol 40; screen sent' }, plain: { 'Sinus tachycardia 128, QRS 140 ms, tall R wave in aVR': 'fast, wide beats: the heart’s wiring is poisoned', 'Ethanol 40; screen sent': 'a little alcohol; the drug screen is pending' },
    vc: { hr: 128, sbp: 96, dbp: 58 }, exam: 'Drowsy, dry skin, big pupils, no bowel sounds.', why: 'The ECG decides: a QRS over 100 ms needs sodium bicarbonate now. Benzodiazepines for seizures.',
    req: { meds: [['bicarb']] }, also: ['loraz', 'midaz'], rxn: 'sodium bicarbonate', contra: ['procain', 'amio', 'ondan'], ddx: ['Opioid overdose', 'Alcohol intoxication', 'Sepsis'], must: true, dxp: 'An antidepressant overdose that poisons the heart’s wiring',
    pearl: 'Drowsy, dry, big pupils and a **wide QRS**: a sodium channel poison.', pitfall: '**Sodium bicarbonate** is the antidote. Class IA and III antiarrhythmics (procainamide, amiodarone) make it worse.' },
  { k: 'hypogly', sys: 'endo', cc: 'Confused and sweaty, diabetic', dx: 'Hypoglycemia', esi: 2, src: 'e', age: [40, 85], wt: 1.1, wk: ['poc'], tr: ['meds'], con: 'hosp', pre: ['poc'], dispo: 'admit',
    need: { n: ['gluc'], ok: ['bmp', 'cbc'] }, res: { gluc: 'Glucose 34' }, find: { poc: 'Glucose 34' }, plain: { 'Glucose 34': 'blood sugar dangerously low' },
    vc: { hr: 104 }, exam: 'Sweaty and confused, can’t follow commands. Takes glipizide.', why: 'Fingerstick first. Dextrose IV now (glucagon if there’s no IV), then food. On a sulfonylurea it comes back: admit and watch overnight.',
    rx: { meds: ['d50', 'glucagon'] }, also: ['octreo', 'thiamine'], rxn: 'dextrose', contra: ['insreg', 'insdrip'], ddx: ['Acute ischemic stroke', 'Alcohol intoxication', 'Hyponatremia'], dxp: 'Blood sugar too low for the brain',
    pearl: 'Anyone confused, seizing or with stroke signs gets a **fingerstick** in the first minutes.', pitfall: 'On a **sulfonylurea** (glipizide), the low comes back for a day: watch them, don’t send them home.' },
  { k: 'ptx', sys: 'resp', cc: 'Sudden one-sided chest pain, short of breath', dx: 'Spontaneous pneumothorax', lname: 'Pneumothorax', esi: 2, src: 'w', age: [18, 35], wt: 0.9, wk: ['xr'], tr: ['o2', 'ctube'], con: 'surg', pre: ['xr'], dispo: 'admit',
    need: { n: ['cxr'], ok: ['vbg'] }, res: { cxr: ['The right lung edge sits 4 cm off the chest wall, no markings beyond it', null] },
    find: { xr: 'The right lung edge sits 4 cm off the chest wall, no markings beyond it' }, plain: { 'The right lung edge sits 4 cm off the chest wall, no markings beyond it': 'air around the right lung' },
    vc: { hr: 110, rr: 24, spo2: 93 }, exam: 'Tall and thin. Fewer breath sounds on the right. Trachea in the middle.', why: 'The chest X-ray shows it. A large one needs a chest tube (or a small catheter) and oxygen.',
    ddx: ['Pulmonary embolism', 'Pneumonia', 'Pericarditis'], dxp: 'Air leaked around the lung and it collapsed',
    pearl: 'A tall, thin young man with sudden one-sided chest pain: **pneumothorax**.', pitfall: 'Low pressure, a shifted trachea or no breath sounds is **tension**: decompress now, don’t wait for the X-ray.' },
  { k: 'necfasc', sys: 'infect', cc: 'Leg pain and fever, getting worse fast', dx: 'Necrotizing fasciitis', esi: 2, src: 'b', age: [35, 75], wt: 0.6, wk: ['lab'], tr: ['fluids', 'abx'], con: 'surg', pre: ['lab'], dispo: 'or',
    need: { n: ['cbc', 'bmp', 'lact', 'bcx'], ok: ['ck', 'crp', 'extxr', 'coag'] }, res: { cbc: 'WBC 24.1, Hgb 12.2, platelets 190', bmp: 'Na 129, creatinine 1.8, glucose 260', lact: 'Lactate 3.8', bcx: 'Sent. Results in 1 to 2 days' },
    find: { lab: 'WBC 24.1, sodium 129, lactate 3.8' }, plain: { 'WBC 24.1, sodium 129, lactate 3.8': 'a severe infection with shock starting' },
    vc: { temp: 102.4, hr: 122, sbp: 98, dbp: 58 }, exam: 'Pain past the edge of the redness. Dusky skin that crackles when pressed.', why: 'Labs support it but can’t rule it out. Broad antibiotics (vancomycin, piperacillin-tazobactam, clindamycin), fluids, and surgery now.',
    req: { abx: [['vanc'], ['piptazo', 'cefepime'], ['clinda']] }, rxn: 'vancomycin, piperacillin-tazobactam and clindamycin', ddx: ['Cellulitis', 'Deep vein thrombosis', 'Gout'], must: true, dxp: 'A fast, flesh-eating infection. It needs surgery',
    pearl: '**Pain out of proportion**, pain past the redness, crackling skin: it’s deeper than cellulitis.', pitfall: 'Imaging and scores can’t clear it. When you suspect it, **surgery** decides.' },
  { k: 'sea', sys: 'neuro', cc: 'Back pain and fever, uses IV drugs', dx: 'Spinal epidural abscess', esi: 2, src: 'w', age: [30, 70], wt: 0.6, wk: ['lab', 'mri'], tr: ['abx'], con: 'nsurg', pre: ['mri'], dispo: 'admit',
    need: { n: ['mris', 'cbc', 'bcx', 'crp'], ok: ['bmp', 'lact', 'ua'] }, res: { mris: ['A rim-enhancing collection behind the cord, T10 to T12', null], cbc: 'WBC 14.6, Hgb 12.8, platelets 300', crp: 'ESR 88, CRP 21', bcx: 'Sent. Results in 1 to 2 days' },
    find: { mri: 'A rim-enhancing collection behind the cord, T10 to T12', lab: 'ESR 88, CRP 21' }, plain: { 'A rim-enhancing collection behind the cord, T10 to T12': 'a pocket of pus pressing on the spinal cord', 'ESR 88, CRP 21': 'a lot of inflammation' },
    vc: { temp: 101.2, hr: 104 }, exam: 'Tender over the middle of the back. Legs a little weak. Needle marks on the arms.', why: 'Fever, back pain and a risk factor: MRI of the whole spine, cultures, then vancomycin and ceftriaxone. Neurosurgery admits.',
    req: { abx: [['vanc'], ['ctx', 'cefepime']] }, rxn: 'vancomycin and ceftriaxone', ddx: ['Muscle strain', 'Pyelonephritis', 'Cauda equina syndrome'], must: true, dxp: 'An infection pressing on the spinal cord',
    pearl: 'Back pain with **fever** and a risk (IV drugs, diabetes, a recent procedure): MRI the spine.', pitfall: 'Weakness comes late. A high **ESR/CRP** with back pain should push you to the MRI before it does.' },
].forEach(addCase);

/* v0.29.1: every case, old or new, is checked once at load. Data that points at something missing (a drug, a test, a specialist)
   or that can't be finished stops the game here, with a list, instead of surfacing in somebody's shift. */
function lintCases() {
  const bad = [], seen = new Set(), drug = (k, where) => { if (k !== '@bleed' && !DRUGS[k]) bad.push(`${where}: unknown drug ${k}`); };
  for (const c of CASES) {
    const w = 'case ' + c.k;
    if (seen.has(c.k)) bad.push(`${w}: duplicate key`); seen.add(c.k);
    if (c.con && !SPECS[c.con]) bad.push(`${w}: unknown specialist ${c.con}`);
    if (c.con2 && !SPECS[c.con2]) bad.push(`${w}: unknown second specialist ${c.con2}`);
    for (const t of c.tr || []) if (!TREAT[t]) bad.push(`${w}: unknown treatment ${t}`);
    for (const t of c.ok || []) if (!TREAT[t] && !WORK[t]) bad.push(`${w}: unknown allowed order ${t}`);
    for (const k of c.wk || []) if (!WORK[k]) bad.push(`${w}: unknown work ${k}`);
    if (c.dispo === 'transfer' && !c.txTo && !c.ift) bad.push(`${w}: transfer without a destination`);
    const N = NEED[c.k]; if (N) for (const t of N.n.concat(N.ok || [])) if (!LABS[t] && !IMGS[t]) bad.push(`${w}: unknown test ${t}`);
    const D = DDX[c.k]; if (D && (D.length !== 3 || D.includes(c.dx))) bad.push(`${w}: the wrong choices must be three, without the diagnosis`);
    for (const [tx, L] of Object.entries(RXOK[c.k] || {})) for (const d of L) { drug(d, w); if (DRUGS[d] && !DRUGS[d].tx.includes(tx)) bad.push(`${w}: ${d} doesn't give ${tx}`); }
    for (const [tx, G2] of Object.entries(RXREQ[c.k] || {})) for (const g of G2) for (const d of g) { drug(d, w); if (DRUGS[d] && !DRUGS[d].tx.includes(tx)) bad.push(`${w}: ${d} doesn't give ${tx}`); }
    for (const d of (CONTRA[c.k] || []).concat(ALSO[c.k] || [])) drug(d, w);
    for (const t of c.tr || []) if (DRUG_DEF[t] && !drugFor({ ck: c.k }, t)) bad.push(`${w}: no drug gives ${t}`);
    for (const [tx, L] of Object.entries(RXOK[c.k] || {})) if (L.some(d => (CONTRA[c.k] || []).includes(d) && !(CONTRA_IF[c.k] || {})[d])) bad.push(`${w}: a right drug for ${tx} is also contraindicated`);
  }
  for (const [k, T] of Object.entries(CONTRA_IF)) for (const d of Object.keys(T)) if (!(CONTRA[k] || []).includes(d)) bad.push(`CONTRA_IF ${k}: ${d} isn't in CONTRA`);
  for (const k of HCG_CASES) if (!CASES.some(c => c.k === k)) bad.push(`HCG_CASES: no case ${k}`);
  for (const d of NEVER_WRONG) drug(d, 'NEVER_WRONG');
  for (const g of SAME_CLASS_OK) for (const d of g) drug(d, 'SAME_CLASS_OK');
  for (const [k, T] of Object.entries(REQ_AGE)) for (const tx of Object.keys(T)) { if (!(RXREQ[k] || {})[tx]) bad.push(`REQ_AGE ${k}: ${tx} has no RXREQ group to add to`); for (const d of T[tx].add) drug(d, 'REQ_AGE ' + k); }
  if (bad.length) throw new Error('Case data problems:\n' + bad.join('\n'));
}
lintCases();
const OC = {
  hooks, get G() { return G; }, load(g) { G = g; if (G && G.spec) for (const k in SPECS) if (!G.spec[k]) G.spec[k] = { mood: 0, at: 0 }; }, newGame, step, botStep,
  LEVELS, STARS, STARS_MD, ZONES, ZONE_NAME, ROOMS, SPECS, WORK, TREAT, ALERTS, GOALS, SCEN, PACKS, CASES, LANGS,
  LABS, IMGS, NEED, RES, IMG_NORMAL, detResult, DET_KIND, DET_NAME, needOf,
  pt, room, staff, roomOf, roomName, label, clock, active, inRooms, boarders, isProv, present,
  zoneLoad, zoneNurses, nurseLoad, zonePts, weight, staffSat, scores, scoreStars, avgWait, waitingCount, hallCount, maxWallNow,
  canPlace, canAssign, needsProv, allWorkDone, preDone, treatsDone, pitDcReady,
  CONS_VISIT, place, move, evsTap, assign, consult, discharge, dischargeRehab, ucDo, clerkOpen, CLERK, RIDE, requestTransfer, escalate, toggleStat,
  boxNotify, boxTake, boxDecide, chooseCard, sendBreak, toggleZone, setZoneClosed, callAgency, orderPizza, setYellow, setDivert, starsFor,
  setPit, activateMTP, releaseONeg, requestInterp, overrideRx,
  register, triage, toWaiting, sendUp, bookIFT, IFT, IFT_LV, HOSPS, CAP_NAME, UNITS, WX, HELP, con2Open, con2Wait, POC_RES, setDispo, awaitOrders, callHosp, giveReport, txInstead, helpCall, helpHere, txNeedOf, iftNeed, txFast, wxGrounded, wxOf, bedWait, emergent, DIVERTS, OUTAGES, outActive, justified,
  startOutage, sickEnough, looksSick, classCode, readCode, setCodeVersion, grayDispo, fullCapacity, updatePt, updateWaiting, recheck, vEsi, regQuick, isBoarder, holds, holdNurses, ratioCap, activeResus,
  metrics, staffHours, median, crowdWhy, BOARD_ST, holdLoad, trainPatient, trainConsult, trainOutage, vitalsOf, SCENS,
  lintCases, HCG_CASES, hcgDue, CONTRA_IF, REQ_AGE, NEVER_WRONG, SAME_CLASS_OK, sameClassAlt, signOrders, mdDecide, mdPlay, mdMine, rxName, DISPO_NAME, DRUGS, DRUG_CLASS, RXOK, RXREQ, ALSO, BLEED_RISK, contraOf, drugFor, drugsFor, reqLeft, rxOk, ORDER_MENUS, PROC, DDX, MUST, dxPick, dxName, DXQ, NODX, accuracy, litAdd, LIT_STEPS,
  LESSON_CASE, CONTRA, ageSex, npo, bpOkForLytic, LYTIC_BP, LYTIC_WINDOW, lyticWindowOk, ARREST_NO_TEAM, CODE_Q, CODE_CAUSE, codeSteps, codeRhythm, toArrest, harmCheck, CRASH, needsTx, strokeSetup, DX_PLAIN,
  crashNow(id) { const p = pt(id); if (p && !p.crash) crash(p); return p; }, fireEvent(k) { if (EV[k] && EV[k].fire) fireEv(k); }, eventKeys: () => Object.keys(EV), eventReady: k => !!(EV[k] && EV[k].fire && EV[k].w && EV[k].w() > 0),
  trainCard() { if (G.card || !G.train) return false; EV.trainpick.fire(); return true; },
};
root.OC = OC;
// What the two buttons say when Approve and Deny would read oddly: [yes, no], by call number (from 0).
const RADIO_BTN = {
  national: { 2: ['Stop', 'Keep going'], 3: ['He may refuse', 'No: transport'], 4: ['He may refuse', 'No: transport'], 7: ['Stroke center', 'Closest hospital'], 10: ['He may refuse', 'No: transport'] },
  miemss: { 7: ['She may refuse', 'No: transport'], 8: ['He may refuse', 'No: transport'], 10: ['Cath lab hospital', 'Closest hospital'], 14: ['Closest ED', 'Cath lab hospital'] },
};
for (const k of Object.keys(RADIO_PLAIN)) (SCEN[k] || []).forEach((s, i) => { const x = RADIO_PLAIN[k][i]; if (x) { s.plain = x[0]; s.pwhy = x[1]; } const b = (RADIO_BTN[k] || {})[i]; if (b) s.btn = b; });
Object.assign(OC, { WATCH_WHY, missNow, provSpeed, EXAM, ORD_WHY, FIND_PLAIN, examOf: p => ((p && EXAM[p.ck]) || '') + (p && p.rehab ? ' Lives alone and is unsteady on their feet: not safe to go home yet.' : ''), whyOf: p => (p && ORD_WHY[p.ck]) || '' });
if (typeof module !== 'undefined' && module.exports) module.exports = OC;
})(typeof window !== 'undefined' ? window : globalThis);
