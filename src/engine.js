/* Overcrowded ED — simulation engine v0.2 (no DOM). All state lives in one plain-JSON object, G. */
(function (root) {
'use strict';

let G = null;
const hooks = { toast() {}, sound() {} };

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
  train: { name: 'Orientation', blurb: 'A preceptor walks you through every step. Nothing counts.', walk: 0, ems: 0, alerts: 0, consult: [30, 40], events: [1e9, 1e9], callouts: 0, board: 0.2, sickMax: 0, boarders: 0, shift: 720, train: true },
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

const TITLE = { md: 'MD', app: 'APP', rn: 'RN', pct: 'PCT', evs: 'EVS', rt: 'RT', rph: 'PharmD', reg: 'Registration', tp: 'Transport' };
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
  { id: 'reg1', role: 'reg', name: 'Tasha' }, { id: 'reg2', role: 'reg', name: 'Miguel' },
  { id: 'tp1', role: 'tp', name: 'Ray' }, { id: 'tp2', role: 'tp', name: 'Lou' },
];

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
  lab: { label: 'LAB', by: 'pct', dur: 4 },
  xr:  { label: 'XR', by: 'img', scan: 6, read: 8 },
  ct:  { label: 'CT', by: 'img', scan: 7, read: 10 },
  us:  { label: 'US', by: 'img', scan: 12, read: 6 },
};
const MISS_NAME = { ecg: 'an ECG', lab: 'labs', xr: 'the X-ray', ct: 'the CT', us: 'the ultrasound' };
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
};

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

/* Diversion statuses. Capacity ones (Yellow, Red) are for a full ED. The specific ones match something that broke. */
const DIVERTS = {
  yellow: { name: 'Yellow Alert', short: 'Yellow', capacity: true, cost: 0.3, rate: 0.6, when: 'The ED is saturated', what: 'Ambulances take non-critical patients elsewhere. Alerts still come.', takes: c => c.esi >= 3 && !c.alert },
  red: { name: 'Red Alert', short: 'Red', capacity: true, cost: 0.4, rate: 0.5, when: 'No monitored or ICU beds', what: 'Ambulances take critical medical patients elsewhere when they can. Trauma still comes.', takes: c => c.esi <= 2 && c.alert !== 'trauma' && c.alert !== 'arrest' },
  ct: { name: 'CT Divert', short: 'CT', cost: 0.1, rate: 0.95, when: 'The CT scanner is down', what: 'Stroke alerts and head-injury trauma go to a hospital with a working scanner.', takes: c => c.alert === 'stroke' || (c.alert === 'trauma' && c.wk.includes('ct')) },
  stemi: { name: 'STEMI Divert', short: 'STEMI', cost: 0.1, rate: 0.95, when: 'The cath lab is down or full', what: 'STEMI alerts go to another hospital with a cath lab.', takes: c => c.alert === 'stemi' },
  trauma: { name: 'Trauma Divert', short: 'Trauma', cost: 0.1, rate: 0.95, when: 'No trauma surgeon or OR', what: 'Trauma alerts go to another trauma center.', takes: c => c.alert === 'trauma' },
  disaster: { name: 'Internal Disaster', short: 'Closed', cost: 0.1, rate: 0.95, when: 'The lab, power, or building has failed', what: 'All ambulances go elsewhere. Walk-ins still come, and patients in cardiac arrest still go to the closest ED.', takes: c => c.alert !== 'arrest' },
};
/* Things that break. Each has one right diversion. */
const OUTAGES = {
  ct: { name: 'CT scanner down', short: 'CT down', during: 'the CT scanner is down', mins: [45, 75], fix: 'ct', msg: 'The CT scanner is down. Biomed is working on it.', hits: c => c.alert === 'stroke' || (c.alert === 'trauma' && c.wk.includes('ct')) },
  cath: { name: 'Cath lab down', short: 'Cath lab down', during: 'the cath lab is down', mins: [60, 90], fix: 'stemi', msg: 'The cath lab C-arm failed. No cath cases until it is fixed.', hits: c => c.alert === 'stemi' },
  or: { name: 'No trauma surgeon or OR', short: 'No trauma OR', during: 'there is no trauma surgeon or OR', mins: [60, 90], fix: 'trauma', msg: 'Both ORs are running and the trauma surgeon is scrubbed in on a long case.', hits: c => c.alert === 'trauma' },
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
  { k: 'appy', cc: 'Belly pain', dx: 'Appendicitis', esi: 3, src: 'w', age: [12, 45], wt: 3, wk: ['lab', 'ct'], tr: ['meds'], con: 'surg', pre: ['lab', 'ct'], dispo: 'or', find: { lab: 'WBC 15.8', ct: 'Inflamed appendix' }, ok: ['abx'] },
  { k: 'chole', cc: 'Belly pain after meals', dx: 'Cholecystitis', esi: 3, src: 'b', age: [30, 70], sex: 'F', wt: 3, wk: ['lab', 'us'], tr: ['meds'], con: 'surg', pre: ['lab', 'us'], dispo: 'admit', find: { lab: 'WBC 13.1, liver tests up', us: 'Gallstones, thick gallbladder wall' }, ok: ['abx'] },
  { k: 'hipfx', cc: 'Fell, hip pain', dx: 'Hip fracture', esi: 3, src: 'e', age: [70, 95], wt: 5, wk: ['xr', 'lab'], tr: ['meds'], con: 'ortho', pre: ['xr'], dispo: 'admit', find: { xr: 'Femoral neck fracture', lab: 'Hgb 11.9' }, ok: ['ecg'] },
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
  { k: 'afib', cc: 'Racing heart', dx: 'A-fib with rapid rate', esi: 2, src: 'b', age: [55, 90], wt: 2.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg', 'lab'], dispo: 'admit', vit: 'HR 152, BP 118/76', find: { ecg: 'A-fib, rate 152', lab: 'Troponin negative' } },
  { k: 'chb', cc: 'Dizzy, nearly passed out', dx: 'Complete heart block', esi: 1, src: 'b', age: [60, 90], wt: 1.2, wk: ['ecg', 'lab'], tr: ['pace'], con: 'cards', pre: ['ecg'], dispo: 'icu', ecg10: true, vit: 'HR 38, BP 102/60, lightheaded', find: { ecg: 'Third-degree heart block, rate 38', lab: 'Potassium 4.4, troponin negative' } },
  { k: 'gib', cc: 'Vomiting blood', dx: 'Upper GI bleed', esi: 2, src: 'b', age: [40, 85], wt: 2, wk: ['lab'], tr: ['fluids', 'blood'], con: 'gi', pre: ['lab'], dispo: 'admit', bleed: 'prbc', vit: 'HR 122, BP 92/58', find: { lab: 'Hemoglobin 6.8' } },
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
  { k: 'tfall', cc: 'Fell down stairs, on a blood thinner', dx: 'Subdural hematoma', esi: 1, src: 'a', age: [70, 95], wt: 2, wk: ['ct', 'lab'], tr: ['reverse'], con: 'trauma', pre: [], need: ['ct'], dispo: 'icu', alert: 'trauma', vit: 'GCS 12, BP 168/92', find: { ct: 'Acute subdural hematoma', lab: 'INR 2.9' } },
  { k: 'moto', cc: 'Motorcycle crash, leg deformity', dx: 'Open femur fracture', esi: 1, src: 'a', age: [18, 55], wt: 1.2, wk: ['xr', 'lab'], tr: ['abx', 'blood'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'prbc', vit: 'HR 118, BP 102/64', find: { xr: 'Open femur fracture', lab: 'Hemoglobin 9.4' }, ok: ['meds'] },
  { k: 'arrest', cc: 'Cardiac arrest, CPR in progress', dx: 'Cardiac arrest', esi: 1, src: 'a', age: [45, 85], wt: 1.3, wk: [], tr: [], dispo: 'code', alert: 'arrest', arrest: true, vit: 'Pulseless, VF on the monitor' },
  { k: 'shock', cc: 'Fever, BP 74/40', dx: 'Septic shock', esi: 1, src: 'a', age: [60, 90], wt: 1.8, wk: ['lab'], tr: ['o2', 'fluids', 'abx', 'pressor'], con: 'icu', pre: ['lab'], need: ['lab'], dispo: 'icu', alert: 'sepsis', vit: 'HR 128, BP 74/40, mottled', find: { lab: 'Lactate 5.4' }, ok: ['xr'] },
  { k: 'rsv', cc: 'Infant breathing hard', dx: 'RSV, tiring out', esi: 2, src: 'a', age: [0, 1], wt: 0.8, wk: ['lab'], tr: ['hfnc'], ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'peds', txTo: 'the pediatric ICU', vit: 'HR 168, RR 66, ribs pulling in, SpO2 91%', find: { lab: 'VBG pCO2 61' } },
  { k: 'burn', cc: 'House fire, burns to arms and chest', dx: 'Partial-thickness burns, 25%, airway injury', esi: 1, src: 'a', age: [20, 70], wt: 0.6, wk: ['lab'], tr: ['intub', 'vent', 'fluids', 'meds'], vit: 'Hoarse voice, soot in the mouth, HR 112', ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'burn', txTo: 'the burn center', find: { lab: 'Carboxyhemoglobin 6%' } },
  // mass casualty: the field's triage tag comes with each patient. Red is immediate, yellow can wait a little, green is walking wounded.
  { k: 'mcired', cc: 'Bus crash: pinned under a seat, belly rigid', dx: 'Liver laceration, hemorrhagic shock', esi: 1, src: 'm', age: [20, 60], wt: 1, wk: ['xr', 'lab'], tr: ['mtp'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'mtp', tag: 'red', vit: 'HR 136, BP 80/44, pale', find: { xr: 'No pneumothorax, FAST positive', lab: 'Hemoglobin 7.9', ct: 'Grade IV liver laceration' } },
  { k: 'mciyel', cc: 'Bus crash: thigh deformity, cannot walk', dx: 'Closed femur fracture', esi: 2, src: 'm', age: [18, 70], wt: 1, wk: ['xr', 'lab'], tr: ['meds', 'fluids'], con: 'ortho', pre: ['xr'], dispo: 'admit', tag: 'yellow', vit: 'HR 112, BP 112/70', find: { xr: 'Midshaft femur fracture', lab: 'Hemoglobin 11.2' } },
  { k: 'mcimin', cc: 'Bus crash: neck pain, walked off the bus', dx: 'Neck strain', esi: 3, src: 'm', age: [18, 70], wt: 1, wk: ['ct'], ok: ['xr'], tr: ['meds'], dispo: 'home', tag: 'green', find: { xr: 'No fracture', ct: 'No acute injury' } },
  { k: 'mcigrn', cc: 'Bus crash: cuts and bruises', dx: 'Minor injuries', esi: 4, src: 'm', age: [10, 70], wt: 1, wk: [], tr: ['repair'], dispo: 'home', tag: 'green' },
  { k: 'mciwr', cc: 'Bus crash: wrist pain', dx: 'Wrist fracture', esi: 4, src: 'm', age: [12, 70], wt: 1, wk: ['xr'], tr: ['meds'], dispo: 'home', tag: 'green', find: { xr: 'Distal radius fracture' } },
];

/* Box consults (online medical direction). a = the right call is to approve. */
const SCEN = {
  national: [
    { q: '64M with crushing chest pain. BP 84/52, HR 58. Requesting nitroglycerin.', a: false, why: 'A systolic BP under 90 is a contraindication to nitroglycerin. Treat the hypotension and consider right-sided involvement.' },
    { q: '58M with chest pain, BP 150/90. He took tadalafil (Cialis) yesterday. Requesting nitroglycerin.', a: false, why: 'Tadalafil within 48 hours plus a nitrate can drop the pressure hard. No nitro.' },
    { q: '81F, unwitnessed arrest. Asystole after 25 minutes of full ALS care, no ROSC, no reversible cause found. Requesting termination of resuscitation.', a: true, why: 'Prolonged asystole after full ALS efforts with no ROSC generally meets termination criteria under protocol.' },
    { q: '34M, alert and oriented, GCS 15, ankle injury. Understands the risks and wants to refuse transport. Can he refuse?', a: true, why: 'An adult with decision-making capacity who understands the risks can refuse. Document it and tell him to call back.' },
    { q: '52M diabetic, glucose 38, confused. Refusing treatment and transport. Can he refuse?', a: false, why: 'Hypoglycemia takes away capacity. Treat the sugar, then reassess whether he can refuse.' },
    { q: '6-year-old, still seizing 5 minutes after intranasal midazolam, no IV access. Requesting a second dose.', a: true, why: 'Status epilepticus has to be stopped. A second benzodiazepine dose is right when the first fails. Watch the breathing.' },
    { q: '40F with a femur fracture. BP 128/80, pain still 9/10 after one dose of fentanyl. Requesting a repeat dose.', a: true, why: 'Stable vital signs and ongoing severe pain: repeat analgesia is appropriate.' },
    { q: '70M with facial droop and aphasia, last known well 45 minutes ago, positive LVO screen. Requesting to bypass to the comprehensive stroke center (+12 min).', a: true, why: 'A suspected large vessel occlusion inside the window does better at a center that can pull the clot.' },
    { q: '66M on dialysis, missed two sessions. Peaked T waves, HR 44. Requesting calcium and albuterol.', a: true, why: 'Suspected hyperkalemia with ECG changes: calcium protects the heart, albuterol shifts potassium into cells.' },
    { q: '25F in anaphylaxis, still wheezing and hypotensive 5 minutes after IM epinephrine. Requesting a repeat dose.', a: true, why: 'Repeat IM epinephrine every 5 to 15 minutes for anaphylaxis that persists.' },
    { q: '45M, intoxicated, GCS 14, scalp laceration after a fall. Wants to refuse. Can he refuse?', a: false, why: 'Intoxication plus a head injury makes capacity doubtful. Transport is the safer call.' },
    { q: '60M, HR 34, BP 70/40, no response to atropine. Requesting transcutaneous pacing.', a: true, why: 'Unstable bradycardia that atropine did not fix: pace (or start a chronotropic drip).' },
    { q: '30F in stable SVT at 210, vagal maneuvers failed. Requesting adenosine.', a: true, why: 'Stable narrow-complex SVT after failed vagal maneuvers: adenosine is the next step.' },
    { q: '72M with CHF, crackles to the shoulders, SpO2 84%, BP 190/110. Requesting CPAP and nitroglycerin.', a: true, why: 'Hypertensive pulmonary edema: CPAP plus nitrates take the load off the heart and lungs.' },
  ],
  miemss: [
    { q: '40F with a femur fracture. BP 132/84, HR 104, SpO2 98%. Pain still 9/10 after two doses of fentanyl. Requesting a third dose.', a: true, why: 'Pain Management 4.13-A: doses after the second need consultation. Vitals are stable and pain is uncontrolled, so a third dose is reasonable.' },
    { q: '62M with chest pain and no STEMI on the 12-lead. Three nitroglycerin doses given (1.2 mg). BP 154/92, pain still 6/10. Requesting a fourth dose.', a: true, why: 'Chest Pain 3.9: nitroglycerin beyond 3 doses or 1.2 mg requires consultation. Pressure is good and the pain persists.' },
    { q: '70F with chest pain. BP fell from 150/90 to 118/70 after the first nitroglycerin. HR 88, pain now 4/10. Requesting a second dose.', a: false, why: 'Chest Pain 3.9: a drop of more than 20 mmHg after a dose requires consultation before more. A drop that size says she is preload dependent. Hold the nitro.' },
    { q: '58M with tearing chest pain into his back. BP 228/124 in the right arm, 182/100 in the left. Requesting labetalol and a blood pressure target.', a: true, why: 'New in 2026 (Chest Pain 3.9, Labetalol 11.25): for a suspected aortic syndrome with SBP 220 or more and DBP 120 or more, labetalol dosing and the BP target come from consultation.' },
    { q: '74F, Stroke Alert. BP still 232/126 after two 10 mg doses of labetalol. Requesting the 20 mg dose.', a: true, why: 'Stroke 4.17 and Labetalol 11.25: the third dose (20 mg) needs consultation. Pressure is still at or above 220/120, and the total maximum is 80 mg.' },
    { q: '81M, Stroke Alert, BP 84/50. Requesting a fluid bolus on the way to the stroke center.', a: true, why: 'Stroke 4.17: a hypotensive stroke patient requires consultation. A brain at risk needs perfusion pressure, so treat the hypotension, and look for a cause other than stroke.' },
    { q: '28M with severe agitation, temp 104°F, HR 150, fighting restraints. One dose of droperidol already given. Requesting midazolam.', a: true, why: 'Agitation 4.2-A: additional sedative doses require consultation. Hyperthermia plus a struggle against restraints risks sudden death. Sedate and cool him.' },
    { q: '47F hit her head and passed out briefly. She keeps asking the same questions and wants to refuse transport. Can she refuse?', a: false, why: 'Patient-Initiated Refusal 2.6: she is not fully oriented, so she lacks capacity, and head injury with loss of consciousness is a high-risk finding on the refusal form. She cannot refuse. Transport.' },
    { q: '16-year-old with an ankle injury at a skate park. No parent or guardian can be reached. He wants to refuse. Can he refuse?', a: false, why: 'Patient-Initiated Refusal 2.6: a minor with no authorized decision maker cannot refuse. Keep trying the guardian and transport.' },
    { q: '4-year-old in narrow-complex tachycardia at 260, mottled, adenosine failed. Requesting synchronized cardioversion.', a: true, why: 'Pediatric Tachycardia 3.3-P: cardioversion for narrow-complex tachycardia in a child requires consultation. Poor perfusion after failed adenosine means cardiovert.' },
    { q: '64M with ROSC after a VF arrest. BP 96/60, 12-lead shows a STEMI. Requesting the cardiac interventional center (+10 min).', a: true, why: 'Post-ROSC 3.5-A: every post-arrest patient requires consultation. ROSC with a STEMI belongs at a cardiac interventional center if transport is safe.' },
    { q: '70F with CHF, SpO2 90% on CPAP, BP 112/70. The 12-lead shows inferior ST elevation, plus ST elevation in V4R. Requesting nitroglycerin.', a: false, why: 'CHF 6.3-A: with an inferior MI, consult before nitroglycerin. ST elevation in V4R means right ventricular involvement, and nitrates can drop her pressure hard.' },
    { q: '66F on lisinopril with tongue and lip swelling and a changing voice, no hives. Epinephrine did not help. Requesting TXA.', a: true, why: 'New in 2026 (Angioedema 4.8-A): epinephrine and TXA are given after medical consultation. ACE-inhibitor angioedema is bradykinin-driven, which is why epinephrine often fails. A changing voice means the airway is closing: do not delay transport.' },
    { q: '52M in severe alcohol withdrawal, tremulous and hallucinating after three IV doses of midazolam. Requesting a fourth.', a: true, why: 'Alcohol Withdrawal 4.3: midazolam beyond three IV doses requires consultation. Untreated severe withdrawal can seize or progress to delirium tremens.' },
    { q: 'A crew on scene: 50M with chest pain and ST elevation, Priority 1. The closest facility is a freestanding ED 5 minutes away; the PCI center is 18 minutes. Requesting the freestanding ED.', a: false, why: 'Freestanding Medical Facility 2.5: Priority 1 and 2 transports there require base station consultation. A STEMI needs a cardiac interventional center, not a freestanding ED.' },
    { q: '6-year-old with diabetes, glucose 52 and still drowsy after one dose of D10. Requesting a second dose.', a: true, why: 'Pediatric Hypoglycemia 4.10: a second D10 dose requires consultation. Still under 70 and symptomatic: give it.' },
    { q: '9-month-old with croup, stridor at rest, and retractions. Requesting nebulized epinephrine.', a: true, why: 'Croup 6.4: nebulized epinephrine dosing for a child under 1 year requires consultation. Stridor at rest is the indication.' },
    { q: '78F with sepsis, BP 82/44 after 30 mL/kg of LR, lungs clear. Requesting more fluid.', a: true, why: 'Sepsis 4.15-A: fluid beyond 30 mL/kg may be approved by online consultation. Approve a bolus and start the epinephrine infusion: hypotension after 30 mL/kg is septic shock.' },
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
function care(n, tag, p) {
  if (G.pre) return;
  const k = tag || 'other';
  if (G.mode === 'md' && (!MD_TAGS.has(k) || (PT_TAGS.has(k) && !(p && p.mine)))) return;
  G.care += n; G.ledger[k] = (G.ledger[k] || 0) + n;
}
const mdMine = p => !!(p && G.mode === 'md' && p.mine && p.prov === G.me);
function note(msg, kind) { if (G.pre) return; G.log.unshift({ t: G.t, msg, kind: kind || 'info' }); if (G.log.length > 60) G.log.length = 60; }
function toast(msg, kind) { if (G.pre) return; note(msg, kind); hooks.toast(msg, kind || 'info'); }
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
    registered: 0, triaged: 0, offloads: 0, transports: { tp: 0, pct: 0 }, ift: { als: 0, cct: 0, air: 0 }, iftRefused: 0, airAbort: 0,
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
    seed: seed | 0, rng: (seed | 0) || 7, t: -PREROLL, running: true, over: false, fail: null, pre: true,
    shift: L.shift, nid: 1, tid: 1, sid: 1, lastMin: Math.floor(-PREROLL),
    rooms: ROOMS.map(r => ({ id: r.id, z: r.z, kind: r.kind, iso: !!r.iso, safe: !!r.safe, st: 'clean', pid: null, dirt: 'std', closed: false })),
    pts: {}, order: [], enroute: [], triageQ: [], evsQ: [], errands: [],
    staff: [],
    img: { xr: { busy: null, q: [], down: -1e9 }, ct: { busy: null, q: [], down: -1e9 }, us: { busy: null, q: [], down: -1e9 } },
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
    pizza: false, sec: { busy: -1e9 }, agN: 0, report: null,
    nextArr: { walk: 0, ems: 0, alert: 1e9 },
    stats: freshStats(), care: 0, ledger: {}, log: [],
    train: !!L.train, tr: L.train ? { step: 0, ids: {}, setup: {} } : null,
    mode: opts.mode === 'md' ? 'md' : 'rn', me: opts.mode === 'md' ? 'md1' : null,
    scen: SCENS[opts.scen] && !L.train ? opts.scen : 'none',
  };
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
    p.dsp = 'board'; p.due = G.t + randi(40, 200); p.tBoard = p.tRoom + 120; p.overnight = true;
  }
}
function startShift() {
  const L = LEVELS[G.level];
  G.pre = false; G.t = Math.max(G.t, 0); G.lastMin = Math.floor(G.t);
  G.stats = freshStats(); G.care = 0; G.ledger = {}; G.log = []; G.warn = {};
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
  if (G.card && G.mode === 'md' && !G.pre) aiCard();
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
  tpTick(dt);
  rtTick(dt);
  rphTick(dt);
  evsTick(dt);
  imgTick(dt);
  resultTick();
  bloodTick();
  interpTick();
  consultTick();
  flowTick();
  const m = Math.floor(G.t);
  if (m !== G.lastMin) { G.lastMin = m; minuteTick(); if (G.mode === 'md' && !G.pre && !G.over) aiTick(); }
  if (!G.pre && G.t >= G.shift) endShift('time');
}

/* ---------- arrivals ---------- */
function pickCase(srcs) { return wpick(CASES.filter(c => srcs.includes(c.src)), c => c.wt); }
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
  pna: { temp: 101.6, hr: 98, rr: 24, spo2: 92.6 }, copd: { hr: 98 }, stone: { hr: 106, sbp: 152, dbp: 92 }, dvt: { hr: 84, sbp: 130, dbp: 80, spo2: 98 },
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
const VONSET = { nalox: 3, epi: 6, intub: 4, vent: 6, nebs: 12, bipap: 10, hfnc: 10, mtp: 15, blood: 20, fluids: 20, meds: 20, tnk: 30, insulin: 40, abx: 360, repair: 5, o2: 3, bp: 10, pressor: 8, pace: 2, reverse: 30 };
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
    consult: { st: 'none', spec: null, due: 0 }, dsp: 'none', due: 0, goals: {},
    stat: false, vip: false, pren: false, missN: false, crash: false, tCrash: 0, sitBy: null, triaging: false, outcome: null,
    lang: age < 2 ? null : pickLang(), interp: 'none', interpDue: 0,
    bb: null, shock: false, pitSeen: false, pitQ: false, pitDcQ: false, ret: false, amaSafe: 0,
    reg: 'none', regBy: null, tri: 'none', triBy: null, offload: false, needCC: c.ift === 'cct', iftLevel: null, xBy: null,
    px: 85, esiT: null, gray: c.gray ? grayScore(c) : null, grayPick: null, cosign: null, lastUpdate: null, lastRecheck: null, quick: false, missedDx: null, outHit: null,
  };
  if (p.alert) for (const g of ALERTS[p.alert].goals) p.goals[g] = null;
  if (p.ecg10 && !('ecg10' in p.goals)) p.goals.ecg10 = null;
  if (p.alert === 'stroke') strokeSetup(p);
  G.pts[p.id] = p; G.order.push(p.id);
  return p;
}
/* A stroke's own facts. Last known well sets the window for the thrombolytic (4.5 hours). The pressure at the door is either under the limit
   for the drug (185/110) or over it, and over it the pressure has to come down before the drug goes in. Both come from the patient's id, not the dice. */
const LYTIC_BP = [185, 110], LYTIC_WINDOW = 270;
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
  const g = (tool, score, band, right, ok) => ({ tool, short: { 'HEART score': 'HEART', 'Canadian Syncope Risk Score': 'CSRS', 'ABCD2 score': 'ABCD2' }[tool], score, band, right, ok: ok || [] });
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
  if (!G.pre) { G.stats.arrived++; if (p.lang) G.stats.lep++; }
  if (p.ecg10 && !p.work.ecg) p.work.ecg = { st: 'todo', tOrd: G.t };
  p.patience = p.esi >= 5 ? randi(80, 150) : p.esi === 4 ? randi(110, 190) : p.esi === 3 ? randi(150, 250) : 1e9;
}
function arrivals() {
  const L = LEVELS[G.level], t = G.t, hm = hourMul(t);
  let guard = 0;
  while (t >= G.nextArr.walk && guard++ < 5) { spawnWalk(); G.nextArr.walk += expo(60 / (L.walk * hm)); }
  const surge = (G.mods.surge > t ? 1.6 : 1) * (1 + 0.12 * G.region.hosps.filter(h => h.st !== 'open').length);
  guard = 0;
  while (t >= G.nextArr.ems && guard++ < 5) { spawnEms(); G.nextArr.ems += expo(60 / (L.ems * hm * surge)); }
  if (!G.pre) { guard = 0; while (t >= G.nextArr.alert && guard++ < 3) { spawnAlert(); G.nextArr.alert += expo(60 / (L.alerts * hm)); } }
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
  const p = makePatient(pickCase(['w', 'b']), 'walk');
  p.loc = 'triage'; p.tArrive = G.t; G.triageQ.push(p.id); onArrive(p);
}
function spawnEms() {
  const c = pickCase(['e', 'b']);
  const dk = diverted(c);
  if (dk) { G.stats.diverted++; note(`An ambulance went elsewhere (${DIVERTS[dk].name}): ${c.cc}`); return; }
  const p = makePatient(c, 'ems');
  p.unit = unitName(); p.loc = 'wall'; p.tArrive = G.t; onArrive(p);
  outageMiss(c, p);
  note(`${p.unit} at the bay: ${ageSex(p)}, ${p.cc}`);
}
function spawnAlert() {
  const c = pickCase(['a']);
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
function canPlace(p, r) {
  if (!p) return { ok: false, why: 'Pick a patient first' };
  if (!r) return { ok: false, why: 'Pick a room' };
  if (r.pid === p.id) return { ok: false, why: 'Already in that room' };
  if ((p.loc === 'wall' || p.loc === 'triage') && !emergent(p)) {
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
    const leaving = p.dsp === 'ready' || p.dsp === 'dc' || p.dsp === 'watch';
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
  if (!p || !(p.loc === 'wall' || p.loc === 'waiting' || p.loc === 'triage')) return { ok: false, why: 'That patient is not waiting for a bed' };
  const c = canPlace(p, r); if (!c.ok) return c;
  if (p.loc === 'triage' || p.tri !== 'done') bedsideTriage(p);
  if (p.loc === 'wall') { p.tWall = G.t - p.tArrive; wallMM(p); }
  p.loc = 'room'; p.room = r.id; r.pid = p.id; r.st = 'occ';
  if (p.tRoom == null) p.tRoom = G.t;
  if (p.rn === 'none') p.rn = 'todo';
  if (p.arrest && r.kind === 'resus') goalHit(p, 'resus5');
  if (p.sitter && r.safe && p.sitBy) releaseSitter(p);
  return { ok: true, msg: `${p.name} to ${roomName(r.id)}` };
}
function move(pid, rid) {
  const p = pt(pid), r = room(rid);
  if (!p || p.loc !== 'room') return { ok: false, why: 'That patient is not in a room' };
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
  if (!r || r.st !== 'dirty') return { ok: false, why: 'That room is not dirty' };
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
  if (!present(s)) return { ok: false, why: `${s.name} is not here` };
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
    p.re = 'done'; p.dxK = true; note(`${label(p)}: ${p.dx}`);
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
  rash: 'Red, itchy patches where a new watch band sits. Lips and throat are not swollen.',
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
  stroke: 'Right arm and leg do not move. Right face droops. Speech is hard to follow.',
  lvo: 'Eyes pulled to one side. No speech. One side does not move.',
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
  lvo: 'CT rules out a bleed, and a CT angiogram finds the blocked artery. Glucose rules out a mimic. Clot-busting drug, then transfer to a center that removes clots.',
  stemi: 'The ECG is the diagnosis. Labs go, but do not wait for the troponin. Aspirin and heparin. Cardiology and the cath lab.',
  mvc: 'X-ray and a bedside ultrasound look for blood in the chest and belly. Labs with a blood type. Massive transfusion. CT only if blood brings the pressure up. If it stays down: straight to the OR.',
  tfall: 'Head CT finds the bleed. Labs with an INR show the blood thinner. Reverse it. Trauma.',
  moto: 'X-ray shows the break. Labs with a blood type. Early antibiotics for bone through skin. Blood. Trauma and the OR.',
  arrest: 'No orders. Run the code.',
  shock: 'Lactate. Oxygen, fluids, antibiotics. A pressor when fluids are not enough. ICU.',
  rsv: 'A blood gas shows the baby is tiring. High-flow oxygen. Transfer to a children\'s hospital.',
  burn: 'Secure the airway before it swells shut: intubate, then the ventilator. Labs check for carbon monoxide. Fluids and pain control. Burn center.',
  mcired: 'X-ray and a bedside ultrasound look for blood in the chest and belly. Labs with a blood type. Massive transfusion. CT only if blood brings the pressure up. If it stays down: straight to the OR.',
  mciyel: 'X-ray shows the break. Labs get the patient ready for surgery. Pain control and fluids. Orthopedics.',
  mcimin: 'Tender on the neck bones means a CT. Clean: pain control and home.',
  mcigrn: 'No tests. Clean and close the cuts.',
  mciwr: 'X-ray shows the break. A splint, pain control, and home.',
};
// Test results in plain words. Shown after the result when "Plain words" is on.
const FIND_PLAIN = {
  'Rapid strep positive': 'strep bacteria found', 'No fracture': 'no broken bone', 'Urine: nitrite positive': 'bacteria in the urine',
  'WBC 15.8': 'white cells high: infection or inflammation', 'Inflamed appendix': 'appendicitis',
  'WBC 13.1, liver tests up': 'white cells high; the liver is irritated', 'Gallstones, thick gallbladder wall': 'an inflamed gallbladder',
  'Femoral neck fracture': 'a broken hip', 'Hgb 11.9': 'blood count a little low', 'WBC 17.2': 'white cells high: infection',
  'Right lower lobe infiltrate': 'pneumonia low in the right lung', 'Hyperinflated, no pneumonia': 'over-full lungs, no infection',
  'VBG pCO2 58': 'CO2 building up: not breathing enough out', 'Sinus tach, old Q waves': 'fast and regular; a scar from an old heart attack',
  'Pulmonary edema': 'fluid in the lungs', 'BNP 2,400': 'heart strain marker very high', '4 mm ureteral stone': 'a small stone; most pass on their own',
  'Femoral vein clot': 'a clot in the big thigh vein', 'Cavity in the upper lobe': 'a hole in the lung: classic for TB', 'WBC 11.4': 'white cells a little high',
  'Labs normal': 'no medical cause found', 'Ethanol 280, glucose normal': 'very drunk; sugar is fine', 'Fentanyl positive': 'an opioid, confirmed',
  'WBC 14.0': 'white cells high: infection', 'Normal sinus rhythm': 'a normal heartbeat', 'New bundle branch block': 'a new fault in the heart\'s wiring',
  'No acute findings': 'nothing new or dangerous', 'BUN 34, creatinine 1.4': 'the kidneys are dry', 'Nonspecific ST changes': 'not normal, not a clear heart attack',
  'First troponin negative': 'no heart damage yet; it gets repeated', 'Troponin negative': 'no heart damage so far', 'ST depression V4–V6': 'heart muscle short of blood',
  'Troponin elevated': 'heart muscle damage', 'A-fib, rate 152': 'a fast, irregular heartbeat', 'Third-degree heart block, rate 38': 'top and bottom of the heart out of step; very slow',
  'Potassium 4.4, troponin negative': 'potassium normal; no heart damage', 'Hemoglobin 6.8': 'blood count dangerously low', 'Glucose 540, anion gap 26, potassium 4.8': 'sugar very high; acid in the blood; potassium safe for insulin', 'Sinus tachycardia, T waves normal': 'fast and regular; no sign of high potassium',
  'Lactate 3.1, urine positive': 'organs short of oxygen; infection in the urine', 'No bleed': 'no bleeding in the brain',
  'Glucose 118': 'sugar is not the cause', 'Glucose 132': 'sugar is not the cause', 'Glucose 141': 'sugar is not the cause',
  'ST elevation V1–V4': 'a heart attack at the front of the heart', 'Troponin pending': 'not back yet; do not wait for it',
  'No bleed; CTA shows M1 occlusion': 'no bleeding; a big brain artery is blocked', 'No pneumothorax, FAST positive': 'lungs are up; blood in the belly',
  'Hemoglobin 8.1': 'blood count low and falling', 'Hemoglobin 7.9': 'blood count low and falling', 'Grade IV splenic laceration': 'a deep tear in the spleen',
  'Acute subdural hematoma': 'bleeding on the surface of the brain', 'INR 2.9': 'thin blood: it clots slowly', 'Open femur fracture': 'a broken thigh bone, through the skin',
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
    ['A clear-headed adult with a hurt ankle does not want to go. They ask if he can refuse.', 'An adult who understands the risk can say no.'],
    ['His sugar is dangerously low and he is confused. He says no. They ask if he can refuse.', 'A brain without sugar cannot make the decision. Fix the sugar first.'],
    ['A child is still seizing after one dose up the nose. No IV. They want a second dose.', 'A seizure this long has to stop. Repeat the dose and watch the breathing.'],
    ['A broken thigh bone, still in severe pain. Vital signs fine. They want more pain medication.', 'Stable and still hurting: treat the pain.'],
    ['Signs of a big stroke, 45 minutes old. They want to drive 12 more minutes to a center that removes clots.', 'A big clot needs a center that can pull it out. The extra minutes are worth it.'],
    ['A dialysis patient missed two sessions. The heart tracing shows high potassium. They want two drugs for it.', 'High potassium can stop the heart. Calcium shields it. Albuterol lowers the potassium.'],
    ['A severe allergic reaction. Still wheezing, pressure still low, 5 minutes after an epinephrine shot. They want a second shot.', 'Still wheezing with a low pressure: give epinephrine again.'],
    ['Drunk, with a head cut after a fall. He wants to go home. They ask if he can refuse.', 'Alcohol plus a head injury: he cannot judge the risk.'],
    ['A very slow heart and a low pressure. The first drug failed. They want to pace the heart from outside.', 'Too slow to hold a pressure, and the drug failed: pace.'],
    ['A very fast, regular heartbeat. Pressure fine. Simple maneuvers failed. They want the drug that resets it.', 'Adenosine resets this rhythm. It is the next step.'],
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
    ['She hit her head, passed out, and repeats herself. She wants to go home. They ask if she can refuse.', 'Repeating questions means her brain is not working right. She cannot refuse.'],
    ['A 16-year-old with a hurt ankle. No parent can be reached. They ask if he can refuse.', 'A minor cannot refuse on his own.'],
    ['A 4-year-old with a racing heart and poor color. The drug failed. They want to shock the rhythm.', 'Poor blood flow and a failed drug: shock.'],
    ['His heart restarted after an arrest. The tracing shows a heart attack. They want a hospital with a cath lab.', 'A blocked artery likely caused the arrest. A cath lab opens it.'],
    ['Heart failure, but the tracing shows a heart attack on the right side. They want nitroglycerin.', 'A right-sided heart attack needs its filling pressure. Nitroglycerin takes that away.'],
    ['Tongue and lip swelling from a blood pressure pill, and her voice is changing. Epinephrine did not work. They want TXA.', 'This swelling is not an allergy, so epinephrine often fails. TXA may help. Watch the airway.'],
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
  'Appendicitis': 'An inflamed appendix. It comes out in surgery', 'Cholecystitis': 'An inflamed gallbladder', 'Hip fracture': 'A broken hip. It needs surgery', 'Pneumonia': 'A lung infection',
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
  'Femur fracture with hemorrhagic shock': 'A broken thigh bone, bleeding heavily', 'ROSC after cardiac arrest': 'The heart is beating again after it stopped', 'Resuscitation unsuccessful': 'The team could not restart the heart',
};
const WK_NAME = { ecg: 'ECG', lab: 'Labs', xr: 'X-ray', ct: 'CT', us: 'Ultrasound' };
const NORMAL = { ecg: 'Normal sinus rhythm', lab: 'Normal', xr: 'No acute findings', ct: 'No acute findings', us: 'Normal' };
const DISPO_NAME = { home: 'discharge home', admit: 'admission', icu: 'the ICU', or: 'the OR', cath: 'the cath lab', bh: 'psychiatric admission', transfer: 'a transfer', obs: 'observation' };
// What the drug in "Medications" was, for each case that needs one.
const RX = { refill: 'a dose of the usual pill', tia: 'aspirin', copd: 'a steroid', moto: 'pain control', rash: 'an antihistamine and steroid cream', otitis: 'amoxicillin', dental: 'an antibiotic and pain control', strep: 'penicillin', ankle: 'ibuprofen', uti: 'an antibiotic for the UTI',
  gastro: 'ondansetron', appy: 'pain control', chole: 'pain control', hipfx: 'pain control', chf: 'nitroglycerin and a diuretic', stone: 'ketorolac', dvt: 'an anticoagulant', migraine: 'prochlorperazine and diphenhydramine',
  cwp: 'ibuprofen', cpmod: 'aspirin', nstemi: 'aspirin and heparin', afib: 'diltiazem', asthma: 'a steroid', anaph: 'an antihistamine and a steroid', stemi: 'aspirin and heparin', burn: 'pain control', mcimin: 'pain control', mciyel: 'pain control', mciwr: 'a splint and pain control', vip: 'meclizine' };
const rxName = p => RX[p.ck] || 'symptom treatment';
// An order with no indication can hurt someone: [chance, points, what happened].
const HARM = { tnk: [0.5, 50, 'bled after a thrombolytic they did not need'], insulin: [0.5, 25, 'dropped their blood sugar on an insulin drip they did not need'],
  epi: [0.35, 20, 'went into a fast rhythm from epinephrine they did not need'], intub: [0.3, 25, 'had a complication from an intubation they did not need'],
  blood: [0.15, 15, 'reacted to blood they did not need'], nalox: [0.3, 8, 'went into withdrawal from naloxone they did not need'], bipap: [0.1, 5, 'vomited on BiPAP they did not need'],
  pressor: [0.25, 15, 'had a dangerous spike in blood pressure from a vasopressor they did not need'], reverse: [0.15, 20, 'had a clot from a reversal agent they did not need'],
  bp: [0.25, 12, 'dropped their blood pressure on a drug they did not need'], pace: [0.2, 8, 'was paced without needing it'] };
function awaitOrders(p) {
  if (!p.right) p.right = { wk: p.wk.slice(), tr: p.tr.filter(k => k !== 'vent'), ok: ((CASES.find(c => c.k === p.ck) || {}).ok || []).slice() };
  p.wk = p.wk.filter(k => p.work[k]);          // anything triage already started stays (an ECG for chest pain)
  p.tr = p.tr.filter(k => p.treat[k] || (k === 'mtp' && p.bb && p.bb.mtp));
  p.ord = 'need';
  if (!G.pre) note(`${label(p)}: you've seen them. Write orders.`);
}
/* What the right order set still lacks, by the names on the order sheet. Medications names its drug. */
const trName = (p, k) => (k === 'meds' ? `Medications (${rxName(p)})` : TREAT[k].label);
function missNow(p, testsOnly) { const R = p.right; return R ? R.wk.filter(k => !p.wk.includes(k)).map(k => WK_NAME[k]).concat(testsOnly ? [] : R.tr.filter(k => !p.tr.includes(k)).map(k => trName(p, k))) : []; }
function signOrders(pid, tests, treats) {
  const p = pt(pid);
  if (!p || !mdMine(p)) return { ok: false, why: 'That is not your patient' };
  if (p.ev !== 'done') return { ok: false, why: 'See the patient first' };
  const R = p.right, S = G.stats.md, first = p.ord === 'need';
  const newT = (tests || []).filter(k => WORK[k] && !p.wk.includes(k));
  const newR = (treats || []).filter(k => TREAT[k] && k !== 'vent' && !p.tr.includes(k));
  if (!newT.length && !newR.length && !(first && R.wk.every(k => p.wk.includes(k)) && !R.tr.length)) return { ok: false, why: 'Pick at least one order' };
  let pts = 0, extra = 0;
  const xl = [], fl = [], OKL = R.ok || [];   // fl: reasonable orders. Not required, not counted against you.
  for (const k of newT) {
    p.wk.push(k);
    if (R.wk.includes(k)) { pts += 2; S.ordRight++; } else if (OKL.includes(k)) { fl.push(WK_NAME[k]); if (!p.find[k]) p.find[k] = NORMAL[k]; } else { pts -= k === 'ct' ? 8 : 3; extra++; S.ordExtra++; xl.push(WK_NAME[k]); if (!p.find[k]) p.find[k] = NORMAL[k]; }
  }
  for (const k of newR) {
    if (k === 'mtp') { const r = activateMTP(p.id); if (!r.ok && p.bleed !== 'mtp') { pts -= 3; extra++; S.ordExtra++; xl.push(TREAT[k].label); continue; } }
    p.tr.push(k);
    if (k === 'intub' && !p.tr.includes('vent')) p.tr.push('vent');
    if (R.tr.includes(k)) { pts += 3; S.ordRight++; }
    else if (k === 'o2' && vitalsOf(p).spo2 < 94) { /* a low sat gets oxygen: never wrong, even when something else will fix it */ }
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
    const miss = R.wk.filter(k => !p.wk.includes(k)).length + R.tr.filter(k => !p.tr.includes(k)).length;
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
  else if (!p.wk.length && !R.wk.length) { p.dxK = true; note(`${label(p)}: ${p.dx}`); treatGap(p); }
  else if (!p.wk.length) workGap(p);
  if (p.txGap) p.txGap = R.tr.filter(k => !p.tr.includes(k));
  if (p.txGap && !p.txGap.length) p.txGap = null;
  if (newT.length && (p.dsp === 'mddecide' || p.dsp === 'decide')) p.dsp = 'none';
  const n = newT.length + newR.length;
  return { ok: true, msg: `${n} order${n === 1 ? '' : 's'} signed for ${label(p)}${newR.includes('meds') ? ` (${rxName(p)})` : ''}${held ? '.' + held : ''}`, held: !!held };
}
// A workup that is missing a test the plan needs: the diagnosis waits until it's ordered.
function workGap(p) {
  const miss = p.right.wk.filter(k => !p.wk.includes(k));
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
  if (!mdMine(p) || !p.extraTr || !p.extraTr.includes(k) || G.pre) return;
  const h = HARM[k]; if (!h || !chance(h[0])) return;
  G.stats.md.harm++; care(-h[1], 'harm', p);
  mm(55, `${p.name} ${h[2]}`, `${TREAT[k].label} was ordered without an indication`, true);
  toast(`${p.name} ${h[2]}.`, 'bad'); sound('bad');
}
/* The disposition call, once the diagnosis is in. Consults go through consult(). */
function mdDecide(pid, pick) {
  const p = pt(pid);
  if (!p || !mdMine(p) || p.dsp !== 'mddecide') return { ok: false, why: 'There is no decision waiting for this patient' };
  const want = p.dispo, S = G.stats.md;
  if (pick === 'home') {
    if (want === 'home') { S.dispoRight++; care(12, 'dispo', p); }
    else { S.dispoWrong++; care(-25, 'dispo', p); p.wrongHome = want; mm(65, `${p.name} went home with ${(/^[A-Z][a-z]/.test(p.dx) ? p.dx.charAt(0).toLowerCase() + p.dx.slice(1) : p.dx)}`, `They needed ${DISPO_NAME[want] || 'admission'}`, true); }
    p.mdPick = 'home'; p.dispo = 'home'; p.dsp = 'none';
    return { ok: true, msg: `${label(p)} is going home once treatment is done.` };
  }
  if (pick === 'transfer') {
    if (want !== 'transfer') { S.dispoWrong++; care(-10, 'dispo', p); return { ok: false, why: `The receiving hospital declined: ${p.name} can be cared for here.` }; }
    S.dispoRight++; care(12, 'dispo', p); p.mdPick = 'transfer'; p.dsp = 'readytx';
    return { ok: true, msg: `Transfer to ${p.txTo}. The charge nurse calls the transfer center and books the ambulance.` };
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
}
function codeOutcome(p) {
  const traumatic = p.alert === 'trauma' || !!p.bleed || !!p.traumatic;
  let odds = traumatic ? 0.12 : (p.goals.resus5 === true ? 0.45 : 0.3);
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
    toast(`Code called at ${clock()} in ${roomName(p.room)}. The chaplain is with the family.`, 'info');
  }
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
  if (key === 'abx') goalHit(p, 'abx60');
  if (key === 'tnk') goalHit(p, 'dtn60');
  if (key === 'mtp') { p.shock = false; note(`${label(p)}: massive transfusion running, pressure coming up`); }
  if (key === 'blood' && p.shock) { p.shock = false; note(`${label(p)}: blood is in, pressure coming up`); }
}
function finishTriage(p, s) {
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
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not at the desk` };
  if (p.reg === 'done') return { ok: false, why: `${label(p)} is already registered` };
  if (p.reg !== 'none' && p.reg !== 'quick') { const o = staff(p.regBy); return { ok: false, why: `${o ? o.name : 'Registration'} already has ${label(p)}` }; }
  if (!['wall', 'triage', 'waiting', 'room', 'enroute'].includes(p.loc)) return { ok: false, why: 'That patient is not here' };
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
      }
      continue;
    }
    const k = s.q.find(x => { const p = pt(x.pid); return p && (p.reg === 'q' || p.reg === 'fq') && ['wall', 'triage', 'waiting', 'room'].includes(p.loc); });
    let p = null, full = false;
    if (k) { s.q.splice(s.q.indexOf(k), 1); p = pt(k.pid); full = p.reg === 'fq'; }
    else {
      // Nothing waiting at the door: finish someone's registration at the bedside.
      p = active().filter(x => (x.reg === 'quick' && (x.loc === 'room' || x.loc === 'waiting')) || (x.reg === 'none' && x.loc === 'room')).sort((a, b) => (b.ev === 'done') - (a.ev === 'done') || a.tArrive - b.tArrive)[0];
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
  if (!p || p.dsp !== 'bedready') return { ok: false, why: 'Their bed upstairs is not ready yet' };
  if (!s || !(s.role === 'tp' || s.role === 'pct')) return { ok: false, why: 'Pick a transporter or a tech' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not available` };
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

/* ---------- interfacility ambulances ---------- */
const IFT = {
  als: { name: 'ALS ambulance', short: 'ALS', eta: [30, 50] },
  cct: { name: 'Critical care transport', short: 'CCT', eta: [45, 80] },
  air: { name: 'Helicopter', short: 'Air', eta: [20, 30] },
};
function bookIFT(pid, level) {
  const p = pt(pid), L = IFT[level];
  if (!p || p.dsp !== 'txok') return { ok: false, why: 'The receiving hospital has not accepted yet' };
  if (!L) return { ok: false, why: 'Pick a service' };
  if (level === 'air' && G.mods.airWx > G.t) return { ok: false, why: 'Helicopters are grounded for weather' };
  let eta = randi(L.eta[0], L.eta[1]);
  if (level !== 'air' && G.mods.iftSlow > G.t) eta += 30;
  p.dsp = 'iftwait'; p.iftLevel = level; p.due = G.t + eta; p.airAbort = level === 'air' && chance(0.2);
  if (!G.pre) G.stats.ift[level]++;
  return { ok: true, msg: `${L.name} booked for ${label(p)}, about ${eta} min out. The patient holds the room until the crew arrives.` };
}

/* ---------- patient care techs ---------- */
function pctItems(sitSlots) {
  const out = [];
  for (const p of active()) {
    const inRoom = p.loc === 'room';
    if (inRoom && p.sitter && !p.sitBy && !roomOf(p).safe && sitSlots > 0) { out.push({ kind: 'sit', p, pr: 0 }); sitSlots--; }
    if (p.bb && p.bb.st === 'cooler') out.push({ kind: 'run', p, pr: 0.5, dur: 4 });
    const e = p.work.ecg; if (e && e.st === 'todo') out.push({ kind: 'ecg', p, pr: (p.alertOn || p.ecg10) ? 1 : 4, dur: 3 });
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
    if (it.kind === 'lab') p.work.lab.st = 'doing';
    if (it.kind === 'morgue') p.dsp = 'morguing';
    if (it.kind === 'run') p.bb.st = 'run';
    s.task = { kind: it.kind, pid: p.id, left: it.dur, dur: it.dur, t0: G.t };
  }
}
function labTat(p) { let m = (p.alertOn || p.stat || p.esi <= 2) ? 10 : 16; if (G.mods.lab > G.t) m *= 2; return m; }
function labDrawn(p) {
  p.work.lab.st = 'run'; p.work.lab.due = G.t + labTat(p);
  if (p.bleed === 'prbc' && !p.bb) p.bb = { st: 'xm', due: G.t + (G.mods.bbSlow > G.t ? 60 : 30) };
}
function pctDone(k, p) {
  if (k.kind === 'ecg') { p.work.ecg.st = 'done'; p.work.ecg.tDone = G.t; ecgRead(p); goalHit(p, 'ecg10'); }
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
    return { ok: false, why: 'The blood bank pushed back: this patient is not bleeding out. Cooler cancelled, O-negative wasted.' };
  }
  p.bb = { st: 'mtp', due: G.t + (uses >= 4 ? 8 : 15), mtp: true };
  if (mdMine(p) && p.ev === 'done' && !p.tr.includes('mtp')) { p.tr.push('mtp'); orders(p); if (p.txGap) { p.txGap = p.txGap.filter(k => k !== 'mtp'); if (!p.txGap.length) p.txGap = null; } }
  if (G.blood.oneg <= 4) toast(`Blood bank: only ${G.blood.oneg} units of O-negative left`, 'bad');
  return { ok: true, msg: `MTP activated for ${label(p)}. The first cooler is ready in about ${uses >= 4 ? 8 : 15} min, and a tech will run it.` };
}
function releaseONeg(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.bleed !== 'prbc') return { ok: false, why: p.bleed === 'mtp' ? 'This patient needs the massive transfusion protocol' : 'This patient does not need blood' };
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
  for (const m of ['xr', 'ct', 'us']) {
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
    const c = p.consult;
    if (c.st === 'req' && G.t >= c.due) {
      c.st = 'here'; c.tArr = G.t;
      const S = SPECS[c.spec];
      if (p.loc === 'room') note(`${S.doc} (${S.name}) is at the bedside in ${roomName(p.room)}`);
      else toast(`${S.doc} (${S.name}) is here, but ${p.name} still has no room`, 'bad');
    }
  }
}
function consult(pid, spec) {
  const p = pt(pid), S = SPECS[spec];
  if (!p || !S) return { ok: false, why: 'Pick a patient and a service' };
  if (!p.alertOn) {
    if (p.loc !== 'room') return { ok: false, why: 'Put the patient in a room first' };
    if (p.ev !== 'done') return { ok: false, why: 'A provider has to see the patient before you consult' };
  }
  if (p.consult.st !== 'none') return { ok: false, why: `${SPECS[p.consult.spec].name} is already involved` };
  const m = G.spec[spec];
  if (p.con !== spec) {
    if (mdMine(p) && !p.con) G.stats.md.dispoWrong++;
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-10, 'consult', p); G.stats.wrongSpec++; provHit(p, 3); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${p.con ? (p.conNote = `${S.name} declined. Try ${SPECS[p.con].name}.`, note(`${S.name} declined ${label(p)}: not theirs. Try ${SPECS[p.con].name}.`, 'bad'), `Why is ${S.name.toLowerCase()} getting this call? Not ours. Call ${SPECS[p.con].name}.`) : 'This patient does not need a consult. Send them home.'}"` };
  }
  // EMS-activated STEMI, stroke, and trauma alerts can call their team on the field report alone
  const miss = (p.alertOn && ALERTS[p.alert] && ALERTS[p.alert].auto) ? [] : p.pre.filter(k => !(p.work[k] && p.work[k].st === 'done'));
  if (miss.length) {
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-15, 'consult', p); G.stats.angry++; provHit(p, 4); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${S.mad(miss.map(k => MISS_NAME[k]).join(' and '))}"` };
  }
  const base = (spec === 'trauma' ? randi(8, 14) : randi(12, 22)) + (spec === 'trauma' && outActive('or') ? 30 : 0), mult = [1, 1.2, 1.5, 1.9][-m.mood] || 1;
  const mins = Math.round(base * mult);
  p.consult = { st: 'req', spec, due: G.t + mins, t0: G.t };
  if (mdMine(p) && !p.mdPick) { p.mdPick = 'consult'; if (p.dsp === 'mddecide') p.dsp = 'none'; G.stats.md.dispoRight++; care(12, 'dispo', p); }
  return { ok: true, msg: `${S.doc} (${S.name}) will see ${label(p)} in about ${mins} min` };
}
function provHit(p, n) { const s = staff(p.prov); if (s) s.morale -= n; }

/* ---------- goals ---------- */
function goalHit(p, key, when) {
  if (!(key in p.goals) || p.goals[key] !== null) return;
  const el = (when == null ? G.t : when) - p.tArrive;
  const ok = el <= GOALS[key].lim + 1e-9;
  p.goals[key] = ok;
  if (G.pre) return;
  G.stats.goals.list.push({ key, ok, el: Math.round(el), alert: p.alert });
  if (ok) { G.stats.goals.met++; care(30, 'goals', p); toast(`${GOALS[key].label}: ${Math.round(el)} min. Goal met · ${label(p)}`, 'good'); sound('good'); }
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
    if (mdMine(p) && p.treat.tnk && p.treat.tnk.st === 'wait' && p.extraTr && p.extraTr.includes('tnk')) openGate(p.treat.tnk, 'tnk');
    if ('surg15' in p.goals && p.goals.surg15 === null && p.consult.st === 'here' && p.loc === 'room') goalHit(p, 'surg15', Math.max(p.consult.tArr, p.tRoom));
    goalMissTick(p);
    if (p.loc !== 'room') continue;
    if (p.ev === 'done' && !p.dxK && p.re === 'none' && allWorkDone(p) && !(mdMine(p) && p.ord !== 'signed')) {
      const s = staff(p.prov);
      if (s && isProv(s) && present(s) && !s.pit) { p.re = 'q'; addTask(s, { type: 'reassess', pid: p.id, dur: 3 * langMul(p), label: 'Recheck' }); }
      else { p.re = 'need'; p.prov = null; p.tNeed = G.t; }
    }
    if (p.treat.tnk && p.treat.tnk.st === 'wait' && p.consult.st === 'here' && p.work.ct && p.work.ct.st === 'done' && bpOkForLytic(p)) openGate(p.treat.tnk, 'tnk');
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
      p.dispo = 'transfer'; p.txTo = cath ? 'another hospital with a cath lab' : 'another trauma center'; if (!cath) p.needCC = true; else delete p.goals.d2b90;
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
    if (p.mdPick === 'consult' && p.consult.st !== 'here') return;
    if (!treatsDone(p)) return;
    setDispo(p);
    return;
  }
  if (p.ev !== 'done' || !p.dxK || p.arrest || p.reg !== 'done') return;
  if (p.cosign === 'need' || p.cosign === 'wait') return;
  if (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done')) return;
  if (p.dispo === 'cath' && outActive('cath')) { p.dispo = 'transfer'; p.txTo = 'another hospital with a cath lab'; delete p.goals.d2b90; note(`${label(p)} needs a cath lab and ours is down. Transfer them.`, 'bad'); }
  if (p.dispo === 'or' && p.alert === 'trauma' && outActive('or')) { p.dispo = 'transfer'; p.txTo = 'another trauma center'; p.needCC = true; note(`${label(p)} needs an OR and there isn't one. Transfer them.`, 'bad'); }
  // Transfers get called in as soon as the diagnosis is clear. Treatment keeps going while the crew drives in.
  if (p.dispo === 'transfer') { p.dsp = 'readytx'; return; }
  if (p.con && p.consult.st !== 'here') return;
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
    const base = p.dispo === 'icu' ? randi(30, 90) : p.dispo === 'bh' ? randi(100, 200) : randi(45, 110);
    p.dsp = 'board'; p.due = G.t + base * L.board * (G.scen === 'board' ? 1.6 : 1); p.tBoard = G.t;
    note(`${label(p)} admitted. Waiting on an inpatient bed.`);
  } else if (p.dispo === 'or' || p.dispo === 'cath') { p.dsp = 'toproc'; p.due = G.t + 4; }
}
/* Gray zone: the player makes the home / observation / admit call. */
function grayDispo(pid, pick) {
  const p = pt(pid);
  if (!p || p.dsp !== 'decide') return { ok: false, why: 'There is no decision waiting for this patient' };
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
  if (waitingCount() < 6 && active().filter(p => p.loc === 'wall').length < 2) return { ok: false, why: 'The ED is not full enough. The protocol needs a packed waiting room or ambulances stuck on the wall.' };
  const list = inRooms().filter(p => p.dsp === 'board' && p.dispo === 'admit' && !p.obsWait).sort((a, b) => a.tBoard - b.tBoard);
  if (list.length < 3) return { ok: false, why: 'It needs at least 3 admitted floor patients waiting for beds' };
  const n = Math.min(4, list.length);
  for (const p of list.slice(0, n)) { p.due = G.t; p.fcp = true; }
  G.fcp.last = G.t; G.stats.fcp++; care(-5, 'admin');
  G.spec.hosp.mood = Math.min(G.spec.hosp.mood, -1); G.spec.hosp.at = G.t;
  return { ok: true, msg: `Full-capacity protocol: ${n} admitted patients go to inpatient hallway beds now. Their nurses still have to call report. The hospitalists are not thrilled.` };
}
function dspTimers(p) {
  if (p.dsp === 'board' && G.t >= p.due) { p.dsp = 'callrep'; p.tBed = G.t; note(`Bed assigned upstairs for ${label(p)}. Their nurse needs to call report.`); }
  else if (p.dsp === 'toproc' && G.t >= p.due) leave(p, p.dispo);
  else if (p.dsp === 'txcall' && G.t >= p.due) { p.dsp = 'txok'; note(`${cap(p.txTo)} accepted ${label(p)}. Book an interfacility ambulance.`); }
  else if (p.dsp === 'iftwait' && p.airAbort && G.t >= p.due - 8) { p.dsp = 'txok'; p.airAbort = false; G.stats.airAbort++; toast(`The helicopter for ${label(p)} turned back for weather. Book ground transport.`, 'bad'); }
  else if (p.dsp === 'iftwait' && G.t >= p.due) {
    if (p.needCC && p.iftLevel === 'als') { p.dsp = 'txok'; care(-10, 'transfer'); G.stats.iftRefused++; toast(`The ALS crew can't take ${label(p)}: this patient needs critical care transport. Book again.`, 'bad'); }
    else { p.dsp = 'iftreport'; p.due = G.t + 5; note(`${IFT[p.iftLevel].name} crew is at the bedside in ${label(p)}, taking report`); }
  }
  else if (p.dsp === 'iftreport' && G.t >= p.due) {
    const owed = p.tr.filter(k => !p.treat[k] || p.treat[k].st !== 'done').map(k => TREAT[k].label.toLowerCase()).join(', ');
    if (treatsDone(p)) leave(p, 'tx');
    else if (p.crewWait == null) { p.crewWait = G.t; note(`The ${IFT[p.iftLevel].short} crew in ${label(p)} is waiting on ${owed} before they go`, 'bad'); }
    else if (G.t - p.crewWait > 20) {
      // A crew can't hold a room forever. They go, and the receiving team finishes the job.
      care(-10, 'transfer');
      mm(30, `The ${IFT[p.iftLevel].short} crew left with ${p.name} before ${owed} was done`, 'Treatment was still pending when the crew was ready to go');
      toast(`The ${IFT[p.iftLevel].short} crew couldn't wait any longer and left with ${label(p)} (${owed} not done)`, 'bad');
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
  else if (p.dsp !== 'ready') return { ok: false, why: p.dispo === 'home' ? 'Not ready yet. Workup or treatment is still pending.' : 'This patient is not going home' };
  p.dsp = 'dc';
  return { ok: true, msg: `Discharge started for ${label(p)}. The nurse will do the teaching.` };
}
function requestTransfer(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.dsp !== 'readytx') return { ok: false, why: 'Not ready for transfer yet' };
  p.dsp = 'txcall'; p.due = G.t + randi(8, 15); goalHit(p, 'tx45');
  return { ok: true, msg: `Transfer center is calling ${p.txTo} for ${label(p)}` };
}
function escalate(pid) {
  const p = pt(pid);
  if (!p || p.dsp !== 'board') return { ok: false, why: 'Only admitted patients waiting for a bed can be escalated' };
  if (p.obsWait) return { ok: false, why: 'The obs unit is full. Its next discharge frees a bed.' };
  if (G.house.esc <= 0) return { ok: false, why: 'The House Supervisor is out of favors for this shift' };
  G.house.esc--; p.due = G.t + (p.due - G.t) * 0.45;
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
  if (outcome === 'cath') goalHit(p, 'd2b90', G.t + randi(15, 25));  // balloon inflation, about 20 min after they reach the lab
  if (G.pre) return;
  const S = G.stats;
  if (outcome === 'dc') { S.dc++; care(10, 'flow', p); if (p.tDone - p.tArrive <= 120) { care(5, 'flow', p); S.quick++; } }
  else if (outcome === 'admit' || outcome === 'icu' || outcome === 'bh' || outcome === 'obs') { S[outcome]++; care(12, 'flow', p); }
  else if (outcome === 'or') { S.or++; care(15, 'flow', p); toast(`${p.name} is off to the OR`, 'good'); }
  else if (outcome === 'cath') { S.cath++; care(15, 'flow', p); toast(`${p.name} is in the cath lab, ${Math.round(p.tDone - p.tArrive)} min after arrival`, 'good'); }
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
    if (p.tRoom != null && p.tDone - p.tRoom < 35 && wasLoc === 'room') add(0.04, `Discharged ${Math.round(p.tDone - p.tRoom)} min after they were roomed`);
    if (p.lang && p.interp !== 'on') add(0.12, `Discharged without a ${LANGS[p.lang]} interpreter`);
    if (p.gray) add(p.grayUnder ? 0.3 : 0.02, p.grayUnder ? `Sent home with a ${p.gray.band}-risk ${p.gray.tool}` : why);
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
  afib:    { v: { hr: 174, sbp: 80, dbp: 50, rr: 24, spo2: 94 }, sign: 'chest pain, about to pass out', dx: 'A-fib with rapid rate, unstable', add: ['fluids'], con: 'cards', dispo: 'icu' },
  chb:     { v: { hr: 28, sbp: 72, dbp: 40, rr: 22, spo2: 94 }, sign: 'gray and sweaty', dx: 'Complete heart block, unstable', add: [], con: 'cards', dispo: 'icu' },
  gib:     { v: { hr: 138, sbp: 74, dbp: 46, rr: 26, spo2: 96 }, sign: 'pale, vomiting blood again', dx: 'Upper GI bleed with hemorrhagic shock', add: [], con: 'gi', dispo: 'icu' },
  dka:     { v: { hr: 136, sbp: 84, dbp: 48, rr: 34, spo2: 98 }, sign: 'deep fast breathing, hard to wake', dx: 'Severe diabetic ketoacidosis', add: [], con: 'icu', dispo: 'icu' },
  asthma:  { v: { hr: 142, sbp: 132, dbp: 84, rr: 36, spo2: 84 }, sign: 'cannot speak, tiring out', dx: 'Asthma attack with respiratory failure', add: ['bipap'], con: 'icu', dispo: 'icu' },
  copd:    { v: { hr: 122, sbp: 148, dbp: 88, rr: 34, spo2: 80 }, sign: 'drowsy, barely moving air', dx: 'COPD flare with respiratory failure', add: [], con: 'icu', dispo: 'icu' },
  chf:     { v: { hr: 126, sbp: 198, dbp: 114, rr: 36, spo2: 82 }, sign: 'pink frothy sputum, bolt upright', dx: 'Flash pulmonary edema', add: [], con: 'icu', dispo: 'icu' },
  od:      { v: { hr: 54, sbp: 96, dbp: 58, rr: 5, spo2: 80 }, sign: 'blue lips, will not wake', dx: 'Opioid overdose: the naloxone wore off', add: ['o2'], con: 'hosp', dispo: 'admit' },
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
  else if (/^A-fib, rate/.test(f)) p.find.ecg = `A-fib, rate ${hr}`;
  else if (/^Third-degree heart block/.test(f)) p.find.ecg = `Third-degree heart block, rate ${hr}`;
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
  if (p.prov) { const s = staff(p.prov); if (s) s.q = s.q.filter(k => k.pid !== p.id || k.started); }
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
    mm(70, `${label(p)} went into hemorrhagic shock`, 'Massive transfusion was not activated in the first 15 min', !p.prov || !!p.mine);
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
  const t = G.t;
  let amaCand = null;
  obsTick();
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
    if (p.crash && !p.arrest && p.loc !== 'room' && t - p.tCrash > 15) waitingArrest(p);
    hemorrhageTick(p);
    if (G.pre) continue;
    if (mdMine(p)) {
      if ((p.ord === 'need' || p.ord === 'more') && p.loc === 'room') { p.ordWait = (p.ordWait || 0) + 1; if (p.ordWait > 15) care(-0.3, 'md'); }
      if (p.dsp === 'mddecide' || p.dsp === 'decide') { p.decWait = (p.decWait || 0) + 1; if (p.decWait > 15) care(-0.3, 'md'); }
      if (p.ev === 'q' && p.loc === 'room') { p.queueWait = (p.queueWait || 0) + 1; if (p.queueWait > 30) care(-0.2, 'md'); }
    }
    if (mdMine(p) && p.txGap && p.txGap.length && !p.txHarm && t - p.tGap > 20) {
      p.txHarm = true; G.stats.md.untreated++; care(-20, 'harm', p);
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
function regionTick() {
  if (G.train) return;
  const R = G.region, t = G.t;
  for (const h of R.hosps) {
    if (h.st === 'open') { if (t > R.susp && chance(0.002)) { h.st = 'yellow'; h.since = t; h.hold = t + 30; note(`${h.name} went on Yellow Alert. Expect more ambulances.`); } }
    else if (t > h.hold && chance(0.02)) { h.st = 'open'; note(`${h.name} came off Yellow Alert`); }
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
    else if (s.st === 'away' && t >= s.until) { s.st = 'on'; endCover(s); toast(`${s.name} is back`, 'good'); }
    else if (s.st === 'pending' && t >= s.until) { s.st = 'on'; s.lastBreak = t; if (s.tag !== 'swing shift' && s.tag !== 'Fast Track 09:00') { for (const z of s.zones) if (z !== 'ft' && G.rooms.some(r => r.z === z && r.closed)) setZoneClosed(z, false); toast(`${s.name} arrived${s.zones.length ? ' and took ' + zoneList(s.zones) + ', and it is open' : ''}`, 'good'); } }
    if (s.leaveAt != null && t >= s.leaveAt && (s.st === 'on' || s.st === 'break')) {
      const zs = s.zones.slice();
      staffGone(s, 'gone');
      toast(`${s.name}'s mandated hours are up. They went home.`, 'info');
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
  if (s.role === 'rph') extra = '. Med verification stops until they are back (override if you must).';
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
const TRAIN_SCEN = { q: '34M with a twisted ankle. He is awake, thinking clearly, and understands the risks. He wants to refuse the ride to the hospital. Accept the refusal?', a: true,
  why: 'An adult who is thinking clearly and understands the risks may refuse care. The medic writes it down and tells him to call back if it gets worse.' };
const scenOf = c => (c.sc === 'train' ? TRAIN_SCEN : (SCEN[G.pack] || SCEN.national)[c.sc]);
function surveyMul() { return G.mods.survey > G.t ? 2 : 1; }
function boxTick(dt) {
  const b = G.box, L = LEVELS[G.level];
  if (G.t >= b.nextC) { b.q.push({ kind: 'consult', sc: nextScen(), unit: 'Medic ' + randi(2, 49), id: ++b.seq }); b.nextC = G.t + randi(L.consult[0], L.consult[1]); }
  if (!b.cur && b.q.length) { const c = b.q.shift(); c.ring = c.kind === 'notify' ? 20 : 10; c.left = c.ring; c.t0 = G.t; b.cur = c; sound('ring'); }
  if (b.cur && !b.cur.taken) { b.cur.left -= dt; if (b.cur.left <= 0) missBox(); }
}
function missBox() {
  const c = G.box.cur; G.box.cur = null;
  if (!c) return;
  if (c.kind === 'notify') { const p = pt(c.pid); if (p) missNotify(p); return; }
  G.stats.boxC.miss++; care(-30 * surveyMul(), 'box');
  (G.stats.radioLog = G.stats.radioLog || []).push({ q: scenOf(c).plain || scenOf(c).q, miss: true, a: scenOf(c).a, why: scenOf(c).pwhy || scenOf(c).why, btn: scenOf(c).btn || null });
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
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not available` };
  const cur = s.q[0];
  if (cur && cur.started && (cur.type === 'code' || (cur.pid && pt(cur.pid) && pt(cur.pid).esi === 1))) s.morale -= 4;
  c.taken = sid;
  addTask(s, { type: 'box', dur: 5, label: 'Box consult' });
  if (G.mode !== 'md' && !G.pre) care(10, 'box');   // the charge nurse's job is getting a doctor on the line fast
  return { ok: true, sc: scenOf(c), unit: c.unit, doc: s.name, pack: G.pack };
}
function boxDecide(approve) {
  const c = G.box.cur; if (!c || !c.taken || G.mode !== 'md') return null;   // the charge nurse routes the call; the doctor decides
  const sc = scenOf(c), ok = !!approve === sc.a, mul = surveyMul();
  if (!ok && c.sc !== 'train') (G.stats.radioLog = G.stats.radioLog || []).push({ q: sc.plain || sc.q, miss: false, a: sc.a, why: sc.pwhy || sc.why, btn: sc.btn || null });
  G.box.cur = null; G.stats.boxC.ans++;
  if (ok) { G.stats.boxC.right++; care(20 * mul, 'box'); } else { G.stats.boxC.wrong++; care(-15 * mul, 'box'); }
  note(`Box: ${c.unit} ${approve ? 'approved' : 'denied'} (${ok ? 'correct' : 'incorrect'})`, ok ? 'good' : 'bad');
  return { ok, sc, approve: !!approve };
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
    else if (s.k === 'swing') toast('11:00: Dr. Nguyen and PA Brooks are on for the swing shift', 'good');
    else if (s.k === 'ftopen') { for (const r of G.rooms) if (r.z === 'ft') r.closed = false; toast('09:00: Fast Track is open. Lee has it.', 'good'); }
  }
}
function eventsTick() {
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
    toast(`Bus crash, yellow tag at the bay. ${p.unit}: ${ageSex(p)}, thigh deformity, cannot walk`, 'alert'); sound('siren');
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
      const pool = G.staff.filter(s => s.st === 'on' && !s.tag && s.id !== 'rnF');
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
  surge: { w: () => (G.t > 40 && G.mods.surge < G.t && G.region.hosps.some(h => h.st === 'open')) ? 0.8 : 0, fire() { const h = pick(G.region.hosps.filter(x => x.st === 'open')); h.st = 'yellow'; h.since = G.t; h.hold = G.t + 60; G.mods.surge = G.t + 60; toast(`${h.name} went on Yellow Alert. Expect extra ambulances for an hour.`, 'alert'); } },
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
      setCard('trainpick', 'A tech wants to leave early', 'Jules, tech', '"My son has a game tonight. Can I **leave an hour early**? It is quiet right now."', [
        { k: 'yes', label: 'Let her go', sub: 'The team is happier. You are a tech short for the last hour.' },
        { k: 'no', label: 'Ask her to stay', sub: 'You keep the tech. She is not happy about it.' },
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
      setCard('tjc', 'Accreditation tracer', 'Chief Nursing Officer', '"Accreditation surveyors walk the ED in **30 minutes**. They stay 45. **No patients in hallway beds** while they are here."', [
        { k: 'ok', label: 'Clear the halls', sub: 'Goal: hallways empty in 30 min and kept empty for 45' },
      ]);
    },
    pick() { addObj('nohall', 30, { until2: G.t + 75 }); },
  },
  flex: {
    w: () => (G.t > 90 && G.t < 400 && !G.ev.used.flex && G.staff.filter(s => s.role === 'pct' && s.st === 'on').length >= 3) ? 0.6 : 0,
    fire() {
      setCard('flex', 'Budget call', 'Chief Financial Officer', '"Our projections say you are overstaffed on techs. **Send one tech home.**"', [
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
      setCard('region', 'EMS system call', 'EMS system coordinator', `"${(why.length ? why : ['We are hearing from crews about your department']).join('. ')}. What's the plan?"`, [
        { k: 'commit', label: 'Offload every unit within 30 min', sub: 'A goal for the next hour' },
        { k: 'yellow', label: 'Go on Yellow Alert', sub: 'Fewer ambulances. Admin will notice.', dis: G.mods.noDivert > G.t || G.dv.yellow.on },
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
function trainConsult() {
  if (G.box.cur) return false;
  G.box.cur = { kind: 'consult', sc: 'train', unit: 'Medic 12', id: ++G.box.seq, ring: 1e9, left: 1e9, t0: G.t };
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
  G.over = true; G.running = false; G.fail = reason === 'walkout' ? 'walkout' : null;
  const list = G.order.map(id => G.pts[id]).filter(p => p.tArrive >= 0 && p.loc !== 'enroute' && p.loc !== 'new');
  const ems = list.filter(p => p.src === 'ems');
  const walls = ems.map(p => p.tWall != null ? p.tWall : (p.loc === 'wall' ? G.t - p.tArrive : 0));
  const S = G.stats;
  G.report = {
    level: G.level, scen: G.scen || 'none', pack: G.pack, fail: G.fail, care: Math.round(G.care), wait: Math.round(avgWait()), sat: Math.round(staffSat()),
    stars: G.fail ? 0 : starsFor(G.care, G.level),
    seen: list.length, dc: S.dc, adm: S.admit + S.icu + S.bh, proc: S.or + S.cath, tx: S.tx, lwbs: S.lwbs, ama: S.ama, expired: S.expired,
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
    m: metrics(), staffH: staffHours(), px: S.pxN ? Math.round(S.pxSum / S.pxN) : null, complaints: S.complaints, updates: S.updates,
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
  if (G.card) { const ch = G.card.choices.find(c => !c.dis) || G.card.choices[0]; chooseCard(ch.k); }
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
    if (p.dsp === 'ready') add(3, () => discharge(p.id).ok);
    if (p.dsp === 'readytx') add(3.2, () => requestTransfer(p.id).ok);
    if (p.dsp === 'txok' && o.ift !== false) add(3.3, () => bookIFT(p.id, p.needCC ? 'cct' : 'als').ok);
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
  const c = G.box.cur;
  if (c && c.kind === 'consult' && !c.taken) act(() => { const r = boxTake(G.me); if (!r.ok) return false; boxDecide(chance(acc) ? r.sc.a : !r.sc.a); return true; });
  for (const p of active()) {
    if (!mdMine(p)) continue;
    if (p.ord === 'need' || p.ord === 'more') act(() => {
      const R = p.right; let tests = R.wk.slice(), treats = R.tr.slice();
      if (p.ord === 'need' && !chance(acc)) { if (chance(0.5) && tests.length) tests.pop(); else tests.push(pick(['lab', 'xr', 'ct'].filter(k => !tests.includes(k))) || 'lab'); }
      return signOrders(p.id, tests, treats).ok;
    });
    else if (p.txGap && p.txGap.length) act(() => signOrders(p.id, [], p.txGap).ok);
    if (p.dsp === 'mddecide') act(() => {
      const want = chance(acc) ? p.dispo : pick(['home', 'admit']);
      if (want === 'home') return mdDecide(p.id, 'home').ok;
      if (want === 'transfer') return mdDecide(p.id, 'transfer').ok;
      return p.con && preDone(p) ? consult(p.id, p.con).ok : false;
    });
    if (p.dsp === 'decide') act(() => grayDispo(p.id, chance(acc) ? p.gray.right : 'home').ok);
  }
  const line = me.q.filter(k => !k.started && k.type !== 'box').length;
  if (line < (o.line || 2) && me.st === 'on') {
    const next = inRooms().filter(p => needsProv(p) && !p.prov && p.ev === 'none').sort((a, b) => (b.arrest - a.arrest) || vEsi(a) - vEsi(b) || a.tRoom - b.tRoom)[0];
    if (next) act(() => assign(G.me, next.id).ok);
  }
}

const OC = {
  hooks, get G() { return G; }, load(g) { G = g; }, newGame, step, botStep,
  LEVELS, STARS, STARS_MD, ZONES, ZONE_NAME, ROOMS, SPECS, WORK, TREAT, ALERTS, GOALS, SCEN, PACKS, CASES, LANGS,
  pt, room, staff, roomOf, roomName, label, clock, active, inRooms, boarders, isProv, present,
  zoneLoad, zoneNurses, nurseLoad, zonePts, weight, staffSat, avgWait, waitingCount, hallCount, maxWallNow,
  canPlace, canAssign, needsProv, allWorkDone, preDone, treatsDone, pitDcReady,
  place, move, evsTap, assign, consult, discharge, requestTransfer, escalate, toggleStat,
  boxNotify, boxTake, boxDecide, chooseCard, sendBreak, toggleZone, setZoneClosed, callAgency, orderPizza, setYellow, setDivert, starsFor,
  setPit, activateMTP, releaseONeg, requestInterp, overrideRx,
  register, triage, toWaiting, sendUp, bookIFT, IFT, emergent, DIVERTS, OUTAGES, outActive, justified,
  startOutage, grayDispo, fullCapacity, updatePt, updateWaiting, recheck, vEsi, regQuick, isBoarder, holds, holdNurses, ratioCap, activeResus,
  metrics, staffHours, median, crowdWhy, BOARD_ST, holdLoad, trainPatient, trainConsult, trainOutage, vitalsOf, SCENS,
  signOrders, mdDecide, mdPlay, mdMine, rxName, DISPO_NAME,
  ageSex, npo, bpOkForLytic, LYTIC_BP, LYTIC_WINDOW, CRASH, needsTx, strokeSetup, DX_PLAIN,
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
Object.assign(OC, { WATCH_WHY, missNow, EXAM, ORD_WHY, FIND_PLAIN, examOf: p => (p && EXAM[p.ck]) || '', whyOf: p => (p && ORD_WHY[p.ck]) || '' });
if (typeof module !== 'undefined' && module.exports) module.exports = OC;
})(typeof window !== 'undefined' ? window : globalThis);
