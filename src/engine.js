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
  // Orientation: no random arrivals, events, or bad luck. The UI's preceptor brings in one scripted patient at a time.
  train: { name: 'Orientation', blurb: 'A preceptor walks you through every step. Nothing counts.', walk: 0, ems: 0, alerts: 0, consult: [30, 40], events: [1e9, 1e9], callouts: 0, board: 0.2, sickMax: 0, boarders: 0, shift: 720, train: true },
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
  hosp:   { name: 'Hospitalist', short: 'Hosp', doc: 'Dr. Fenn', mad: x => `I'm not admitting anyone without ${x}. Call me back.` },
  cards:  { name: 'Cardiology', short: 'Cards', doc: 'Dr. Hartwell', mad: x => `You paged cardiology without ${x}?` },
  neuro:  { name: 'Neurology', short: 'Neuro', doc: 'Dr. Sato', mad: x => `I can't decide anything until I see ${x}.` },
  surg:   { name: 'General Surgery', short: 'Surg', doc: 'Dr. Blake', mad: x => `Get me ${x}, then we'll talk.` },
  trauma: { name: 'Trauma Surgery', short: 'Trauma', doc: 'Dr. Voss', mad: x => `Call me when ${x} is done.` },
  ortho:  { name: 'Orthopedics', short: 'Ortho', doc: 'Dr. Bonner', mad: x => `Films first. I need ${x}.` },
  gi:     { name: 'Gastroenterology', short: 'GI', doc: 'Dr. Marsh', mad: x => `What's the hemoglobin? Call back with ${x}.` },
  psych:  { name: 'Psychiatry', short: 'Psych', doc: 'Dr. Lund', mad: x => `Is the patient medically cleared? I need ${x}.` },
  icu:    { name: 'Critical Care', short: 'ICU', doc: 'Dr. Ibarra', mad: x => `Call me back with ${x}.` },
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
  repair:  { label: 'Lac repair', by: 'prov', dur: 8 },
  intub:   { label: 'Intubation', by: 'prov', dur: 10, md: true, rt: true },
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
  stemi: { name: 'STEMI Divert', short: 'STEMI', cost: 0.1, rate: 0.95, when: 'The cath lab is down or full', what: 'STEMI alerts go to another PCI center.', takes: c => c.alert === 'stemi' },
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
  { k: 'refill', cc: 'Out of blood pressure meds', dx: 'Medication refill', esi: 5, src: 'w', age: [40, 80], wt: 3, wk: [], tr: [], dispo: 'home' },
  { k: 'otitis', cc: 'Ear pain', dx: 'Ear infection', esi: 5, src: 'w', age: [1, 9], wt: 3, wk: [], tr: ['meds'], dispo: 'home' },
  { k: 'dental', cc: 'Toothache', dx: 'Dental abscess', esi: 5, src: 'w', age: [18, 60], wt: 2, wk: [], tr: ['meds'], dispo: 'home' },
  { k: 'strep', cc: 'Sore throat', dx: 'Strep throat', esi: 4, src: 'w', age: [5, 40], wt: 4, wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Rapid strep positive' } },
  { k: 'ankle', cc: 'Twisted ankle', dx: 'Ankle sprain', esi: 4, src: 'w', age: [12, 50], wt: 5, wk: ['xr'], tr: ['meds'], dispo: 'home', find: { xr: 'No fracture' } },
  { k: 'lac', cc: 'Cut hand', dx: 'Simple laceration', esi: 4, src: 'b', age: [16, 70], wt: 4, wk: [], tr: ['repair'], dispo: 'home' },
  { k: 'uti', cc: 'Burning with urination', dx: 'Urinary tract infection', esi: 4, src: 'w', age: [18, 70], sex: 'F', wt: 4, wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Urine: nitrite positive' } },
  { k: 'gastro', cc: 'Belly pain, vomiting', dx: 'Gastroenteritis', esi: 3, src: 'b', age: [18, 60], wt: 5, wk: ['lab'], tr: ['fluids', 'meds'], dispo: 'home', find: { lab: 'Mild dehydration' } },
  { k: 'appy', cc: 'Belly pain', dx: 'Appendicitis', esi: 3, src: 'w', age: [12, 45], wt: 3, wk: ['lab', 'ct'], tr: ['meds'], con: 'surg', pre: ['lab', 'ct'], dispo: 'or', find: { lab: 'WBC 15.8', ct: 'Inflamed appendix' } },
  { k: 'chole', cc: 'Belly pain after meals', dx: 'Cholecystitis', esi: 3, src: 'b', age: [30, 70], sex: 'F', wt: 3, wk: ['lab', 'us'], tr: ['meds'], con: 'surg', pre: ['lab', 'us'], dispo: 'admit', find: { lab: 'WBC 13.1, liver tests up', us: 'Gallstones, thick gallbladder wall' } },
  { k: 'hipfx', cc: 'Fell, hip pain', dx: 'Hip fracture', esi: 3, src: 'e', age: [70, 95], wt: 5, wk: ['xr', 'lab'], tr: ['meds'], con: 'ortho', pre: ['xr'], dispo: 'admit', find: { xr: 'Femoral neck fracture', lab: 'Hgb 11.9' } },
  { k: 'pna', cc: 'Cough and fever', dx: 'Pneumonia', esi: 3, src: 'b', age: [50, 90], wt: 4, wk: ['lab', 'xr'], tr: ['abx'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', find: { lab: 'WBC 17.2', xr: 'Right lower lobe infiltrate' } },
  { k: 'copd', cc: 'Short of breath', dx: 'COPD flare', esi: 3, src: 'e', age: [55, 85], wt: 4, wk: ['xr', 'lab'], tr: ['nebs', 'bipap'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', vit: 'SpO2 86%, RR 28, pCO2 58', find: { xr: 'Hyperinflated, no pneumonia', lab: 'VBG pCO2 58' } },
  { k: 'chf', cc: "Short of breath, can't lie flat", dx: 'Heart failure flare', esi: 2, src: 'e', age: [60, 90], wt: 3, wk: ['ecg', 'xr', 'lab'], tr: ['bipap', 'meds'], con: 'hosp', pre: ['lab', 'xr'], dispo: 'admit', vit: 'SpO2 84%, BP 188/104', find: { ecg: 'Sinus tach, old Q waves', xr: 'Pulmonary edema', lab: 'BNP 2,400' } },
  { k: 'stone', cc: 'Flank pain', dx: 'Kidney stone', esi: 3, src: 'w', age: [25, 60], wt: 4, wk: ['lab', 'ct'], tr: ['meds', 'fluids'], dispo: 'home', find: { lab: 'Blood in urine, no infection', ct: '4 mm ureteral stone' } },
  { k: 'dvt', cc: 'Swollen leg', dx: 'Deep vein thrombosis', esi: 3, src: 'w', age: [30, 80], wt: 3, wk: ['us', 'lab'], tr: ['meds'], dispo: 'home', find: { us: 'Femoral vein clot', lab: 'Kidney function normal' } },
  { k: 'migraine', cc: 'Worst headache this month', dx: 'Migraine', esi: 3, src: 'w', age: [18, 50], sex: 'F', wt: 3, wk: [], tr: ['fluids', 'meds'], dispo: 'home' },
  { k: 'tb', cc: 'Cough, night sweats', dx: 'Suspected tuberculosis', esi: 3, src: 'w', age: [25, 70], wt: 1.2, wk: ['xr', 'lab'], tr: [], con: 'hosp', pre: ['xr', 'lab'], dispo: 'admit', iso: 'air', find: { xr: 'Cavity in the upper lobe', lab: 'WBC 11.4' } },
  { k: 'bh', cc: 'Behavioral health crisis', dx: 'Behavioral health emergency', esi: 3, src: 'b', age: [16, 60], wt: 2.5, wk: ['lab'], tr: [], con: 'psych', pre: ['lab'], dispo: 'bh', sitter: true, find: { lab: 'Medically cleared' } },
  { k: 'etoh', cc: 'Intoxicated, found on a bench', dx: 'Alcohol intoxication', esi: 3, src: 'e', age: [25, 65], sex: 'M', wt: 3, wk: ['lab'], tr: ['fluids'], dispo: 'home', ama: 2, find: { lab: 'Ethanol 280, glucose normal' } },
  { k: 'od', cc: 'Found unresponsive, pinpoint pupils', dx: 'Opioid overdose', esi: 2, src: 'e', age: [18, 55], wt: 2, wk: ['lab'], tr: ['nalox'], dispo: 'home', ama: 4, vit: 'RR 6, SpO2 82%', find: { lab: 'Fentanyl positive' } },
  { k: 'cell', cc: 'Red, hot leg', dx: 'Cellulitis', esi: 3, src: 'w', age: [30, 80], wt: 3, wk: ['lab'], tr: ['abx'], con: 'hosp', pre: ['lab'], dispo: 'admit', find: { lab: 'WBC 14.0' } },
  { k: 'syncope', cc: 'Passed out', dx: 'Syncope, low risk', esi: 3, src: 'b', age: [16, 70], wt: 3, wk: ['ecg', 'lab'], tr: [], dispo: 'home', gray: 'syncope', find: { ecg: 'Normal sinus rhythm', lab: 'Normal' } },
  { k: 'synchigh', cc: 'Passed out sitting down', dx: 'Syncope, high risk', esi: 2, src: 'b', age: [60, 90], wt: 1.5, wk: ['ecg', 'lab'], tr: [], dispo: 'obs', gray: 'syncope', find: { ecg: 'New bundle branch block', lab: 'Normal' } },
  { k: 'tia', cc: 'Arm went numb, now fine', dx: 'Transient ischemic attack', esi: 3, src: 'w', age: [55, 88], wt: 1.5, wk: ['ct', 'lab', 'ecg'], tr: [], dispo: 'obs', gray: 'tia', find: { ct: 'No acute findings', lab: 'Normal', ecg: 'Normal sinus rhythm' } },
  { k: 'dehyd', cc: 'Weak and dizzy', dx: 'Dehydration', esi: 3, src: 'e', age: [65, 95], wt: 3, wk: ['lab'], tr: ['fluids'], dispo: 'home', find: { lab: 'BUN 34, creatinine 1.4' } },
  { k: 'cpmod', cc: 'Chest pressure on and off', dx: 'Chest pain, moderate risk', esi: 2, src: 'b', age: [45, 75], wt: 2.5, wk: ['ecg', 'lab', 'xr'], tr: ['meds'], dispo: 'obs', ecg10: true, gray: 'chest', find: { ecg: 'Nonspecific ST changes', lab: 'First troponin negative', xr: 'Clear lungs' } },
  { k: 'cwp', cc: 'Chest pain', dx: 'Chest pain, low risk', esi: 2, src: 'b', age: [25, 60], wt: 4, wk: ['ecg', 'lab', 'xr'], tr: ['meds'], dispo: 'home', ecg10: true, gray: 'chest', find: { ecg: 'Normal sinus rhythm', lab: 'Troponin negative', xr: 'Clear lungs' } },
  { k: 'nstemi', cc: 'Chest pain', dx: 'NSTEMI (heart attack)', esi: 2, src: 'b', age: [50, 85], wt: 2.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg', 'lab'], dispo: 'admit', ecg10: true, find: { ecg: 'ST depression V4–V6', lab: 'Troponin elevated' } },
  { k: 'afib', cc: 'Racing heart', dx: 'A-fib with rapid rate', esi: 2, src: 'b', age: [55, 90], wt: 2.5, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg', 'lab'], dispo: 'admit', vit: 'HR 152, BP 118/76', find: { ecg: 'A-fib, rate 152', lab: 'Troponin negative' } },
  { k: 'gib', cc: 'Vomiting blood', dx: 'Upper GI bleed', esi: 2, src: 'b', age: [40, 85], wt: 2, wk: ['lab'], tr: ['fluids', 'blood'], con: 'gi', pre: ['lab'], dispo: 'admit', bleed: 'prbc', vit: 'HR 122, BP 92/58', find: { lab: 'Hemoglobin 6.8' } },
  { k: 'dka', cc: 'Vomiting, sugar very high', dx: 'Diabetic ketoacidosis', esi: 2, src: 'b', age: [16, 45], wt: 1.5, wk: ['lab'], tr: ['fluids', 'insulin'], con: 'icu', pre: ['lab'], dispo: 'icu', find: { lab: 'Glucose 540, anion gap 26' } },
  { k: 'asthma', cc: 'Wheezing', dx: 'Asthma attack', esi: 2, src: 'w', age: [5, 30], wt: 3, wk: [], tr: ['nebs', 'meds'], dispo: 'home', vit: 'SpO2 91%, can speak 3 words' },
  { k: 'anaph', cc: 'Throat tight after eating shrimp', dx: 'Anaphylaxis', esi: 2, src: 'b', age: [12, 60], wt: 1.5, wk: [], tr: ['epi', 'meds'], dispo: 'home', vit: 'Hives, wheeze, BP 96/60' },
  { k: 'sepsisw', cc: 'Fever and confusion', dx: 'Sepsis (urinary source)', esi: 2, src: 'w', age: [65, 92], wt: 1.2, wk: ['lab'], tr: ['fluids', 'abx'], con: 'hosp', pre: ['lab'], need: ['lab'], dispo: 'admit', alert: 'sepsis', vit: 'Temp 102.9, HR 118, BP 98/60', find: { lab: 'Lactate 3.1, urine positive' } },
  { k: 'strokew', cc: 'Face droop, slurred speech', dx: 'Acute ischemic stroke', esi: 2, src: 'w', age: [55, 88], wt: 1, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], dispo: 'icu', alert: 'stroke', find: { ct: 'No bleed', lab: 'Glucose 118' } },
  // EMS alerts: they ring the Box first
  { k: 'stemi', cc: 'Crushing chest pain', dx: 'Anterior STEMI', esi: 1, src: 'a', age: [45, 80], wt: 3, wk: ['ecg', 'lab'], tr: ['meds'], con: 'cards', pre: ['ecg'], need: ['ecg'], dispo: 'cath', alert: 'stemi', ecg10: true, vit: 'HR 98, BP 142/88, diaphoretic', find: { ecg: 'ST elevation V1–V4', lab: 'Troponin pending' } },
  { k: 'stroke', cc: "Can't move right side", dx: 'Acute ischemic stroke', esi: 2, src: 'a', age: [55, 90], wt: 2, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], dispo: 'icu', alert: 'stroke', find: { ct: 'No bleed', lab: 'Glucose 132' } },
  { k: 'lvo', cc: "Can't speak, eyes deviated", dx: 'Large vessel occlusion stroke', esi: 1, src: 'a', age: [55, 90], wt: 1.2, wk: ['ct', 'lab'], tr: ['tnk'], con: 'neuro', pre: ['ct'], need: ['ct'], ift: 'cct', dispo: 'transfer', alert: 'stroke', txTo: 'the comprehensive stroke center', find: { ct: 'No bleed; CTA shows M1 occlusion', lab: 'Glucose 141' } },
  { k: 'mvc', cc: 'Rollover crash, unrestrained', dx: 'Splenic laceration, hemorrhagic shock', esi: 1, src: 'a', age: [17, 45], wt: 2.2, wk: ['xr', 'lab', 'ct'], tr: ['mtp'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'mtp', vit: 'HR 134, BP 78/40, pale', find: { xr: 'No pneumothorax, FAST positive', lab: 'Hemoglobin 8.1', ct: 'Grade IV splenic laceration' } },
  { k: 'tfall', cc: 'Fell down stairs, on a blood thinner', dx: 'Subdural hematoma', esi: 1, src: 'a', age: [70, 95], wt: 2, wk: ['ct', 'lab'], tr: [], con: 'trauma', pre: [], need: ['ct'], dispo: 'icu', alert: 'trauma', vit: 'GCS 12, BP 168/92', find: { ct: 'Acute subdural hematoma', lab: 'INR 2.9' } },
  { k: 'moto', cc: 'Motorcycle crash, leg deformity', dx: 'Open femur fracture', esi: 1, src: 'a', age: [18, 55], wt: 1.2, wk: ['xr', 'lab'], tr: ['abx', 'blood'], con: 'trauma', pre: [], need: ['xr'], dispo: 'or', alert: 'trauma', bleed: 'prbc', vit: 'HR 118, BP 102/64', find: { xr: 'Open femur fracture', lab: 'Hemoglobin 9.4' } },
  { k: 'arrest', cc: 'Cardiac arrest, CPR in progress', dx: 'Cardiac arrest', esi: 1, src: 'a', age: [45, 85], wt: 1.3, wk: [], tr: [], dispo: 'code', alert: 'arrest', arrest: true, vit: 'Pulseless, VF on the monitor' },
  { k: 'shock', cc: 'Fever, BP 74/40', dx: 'Septic shock', esi: 1, src: 'a', age: [60, 90], wt: 1.8, wk: ['lab'], tr: ['fluids', 'abx'], con: 'icu', pre: ['lab'], need: ['lab'], dispo: 'icu', alert: 'sepsis', vit: 'HR 128, BP 74/40, mottled', find: { lab: 'Lactate 5.4' } },
  { k: 'rsv', cc: 'Infant breathing hard', dx: 'RSV, tiring out', esi: 2, src: 'a', age: [0, 1], wt: 0.8, wk: ['lab'], tr: ['hfnc'], ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'peds', txTo: 'the pediatric ICU', vit: 'RR 72, retractions, SpO2 88%', find: { lab: 'VBG pCO2 61' } },
  { k: 'burn', cc: 'House fire, burns to arms and chest', dx: 'Partial-thickness burns, 25%, airway injury', esi: 2, src: 'a', age: [20, 70], wt: 0.6, wk: ['lab'], tr: ['intub', 'vent', 'fluids', 'meds'], vit: 'Hoarse voice, soot in the mouth, HR 112', ift: 'cct', dispo: 'transfer', need: ['lab'], alert: 'burn', txTo: 'the burn center', find: { lab: 'Carboxyhemoglobin 6%' } },
  // mass casualty
  { k: 'mcimin', cc: 'Bus crash, neck and back pain', dx: 'Minor trauma', esi: 3, src: 'm', age: [18, 70], wt: 1, wk: ['xr', 'ct'], tr: ['meds'], dispo: 'home', find: { xr: 'No fracture', ct: 'No acute injury' } },
  { k: 'mcigrn', cc: 'Bus crash, cuts and bruises', dx: 'Minor injuries', esi: 4, src: 'm', age: [10, 70], wt: 1, wk: [], tr: ['repair'], dispo: 'home' },
];

/* Box consults (online medical direction). a = the right call is to approve. */
const SCEN = {
  national: [
    { q: '64M with crushing chest pain. BP 84/52, HR 58. Requesting nitroglycerin.', a: false, why: 'A systolic BP under 90 is a contraindication to nitroglycerin. Treat the hypotension and consider right-sided involvement.' },
    { q: '58M with chest pain, BP 150/90. He took tadalafil (Cialis) yesterday. Requesting nitroglycerin.', a: false, why: 'Tadalafil within 48 hours plus a nitrate can drop the pressure hard. No nitro.' },
    { q: '81F, unwitnessed arrest. Asystole after 25 minutes of full ALS care, no ROSC, no reversible cause found. Requesting termination of resuscitation.', a: true, why: 'Prolonged asystole after full ALS efforts with no ROSC generally meets termination criteria under protocol.' },
    { q: '34M, alert and oriented, GCS 15, ankle injury. Understands the risks and wants to refuse transport.', a: true, why: 'An adult with decision-making capacity who understands the risks can refuse. Document it and tell him to call back.' },
    { q: '52M diabetic, glucose 38, confused. Refusing treatment and transport.', a: false, why: 'Hypoglycemia takes away capacity. Treat the sugar, then reassess whether he can refuse.' },
    { q: '6-year-old, seizing for 10 minutes, no IV access. Requesting intranasal midazolam.', a: true, why: 'Status epilepticus needs a benzodiazepine now. Intranasal or IM is right when there is no IV.' },
    { q: '40F with a femur fracture. BP 128/80, pain still 9/10 after one dose of fentanyl. Requesting a repeat dose.', a: true, why: 'Stable vital signs and ongoing severe pain: repeat analgesia is appropriate.' },
    { q: '70M with facial droop and aphasia, last known well 45 minutes ago, positive LVO screen. Requesting to bypass to the comprehensive stroke center (+12 min).', a: true, why: 'A suspected large vessel occlusion inside the window does better at a center that can pull the clot.' },
    { q: '66M on dialysis, missed two sessions. Peaked T waves, HR 44. Requesting calcium and albuterol.', a: true, why: 'Suspected hyperkalemia with ECG changes: calcium protects the heart, albuterol shifts potassium into cells.' },
    { q: '25F in anaphylaxis, still wheezing and hypotensive 5 minutes after IM epinephrine. Requesting a repeat dose.', a: true, why: 'Repeat IM epinephrine every 5 to 15 minutes for anaphylaxis that persists.' },
    { q: '45M, intoxicated, GCS 14, scalp laceration after a fall. Wants to refuse.', a: false, why: 'Intoxication plus a head injury makes capacity doubtful. Transport is the safer call.' },
    { q: '60M, HR 34, BP 70/40, no response to atropine. Requesting transcutaneous pacing.', a: true, why: 'Unstable bradycardia that atropine did not fix: pace (or start a chronotropic drip).' },
    { q: '30F in stable SVT at 210, vagal maneuvers failed. Requesting adenosine.', a: true, why: 'Stable narrow-complex SVT after failed vagal maneuvers: adenosine is the next step.' },
    { q: '72M with CHF, crackles to the shoulders, SpO2 84%, BP 190/110. Requesting CPAP and nitroglycerin.', a: true, why: 'Hypertensive pulmonary edema: CPAP plus nitrates take the load off the heart and lungs.' },
  ],
  miemss: [
    { q: '40F with a femur fracture. BP 132/84, HR 104, SpO2 98%. Pain still 9/10 after two doses of fentanyl. Requesting a third dose.', a: true, why: 'Pain Management 4.13-A: doses after the second need consultation. Vitals are stable and pain is uncontrolled, so a third dose is reasonable.' },
    { q: '62M with chest pain and no STEMI on the 12-lead. Three nitroglycerin doses given (1.2 mg). BP 154/92, pain still 6/10. Requesting a fourth dose.', a: true, why: 'Chest Pain 3.9: nitroglycerin beyond 3 doses or 1.2 mg requires consultation. Pressure is good and the pain persists.' },
    { q: '70F with chest pain. BP fell from 150/90 to 118/70 after the first nitroglycerin. Requesting a second dose.', a: false, why: 'Chest Pain 3.9: a drop of more than 20 mmHg after a dose requires consultation before more. A drop that size says she is preload dependent. Hold the nitro.' },
    { q: '58M with tearing chest pain into his back. BP 228/124 in the right arm, 182/100 in the left. Requesting labetalol and a blood pressure target.', a: true, why: 'New in 2026 (Chest Pain 3.9, Labetalol 11.25): for a suspected aortic syndrome with SBP 220 or more and DBP 120 or more, labetalol dosing and the BP target come from consultation.' },
    { q: '74F, Stroke Alert. BP still 232/126 after two 10 mg doses of labetalol. Requesting the 20 mg dose.', a: true, why: 'Stroke 4.17 and Labetalol 11.25: the third dose (20 mg) needs consultation. Pressure is still at or above 220/120, and the total maximum is 80 mg.' },
    { q: '81M, Stroke Alert, BP 84/50. Requesting a fluid bolus on the way to the stroke center.', a: true, why: 'Stroke 4.17: a hypotensive stroke patient requires consultation. A brain at risk needs perfusion pressure, so treat the hypotension.' },
    { q: '28M with severe agitation, temp 104°F, HR 150, fighting restraints. One dose of droperidol already given. Requesting midazolam.', a: true, why: 'Agitation 4.2-A: additional sedative doses require consultation. Hyperthermia plus a struggle against restraints risks sudden death. Sedate and cool him.' },
    { q: '47F hit her head and passed out briefly. She keeps asking the same questions and wants to refuse transport.', a: false, why: 'Patient-Initiated Refusal 2.6: she is not fully oriented, so she lacks capacity, and head injury with loss of consciousness is a shaded high-risk answer. She cannot refuse. Transport.' },
    { q: '16-year-old with an ankle injury at a skate park. No parent or guardian can be reached. He wants to refuse.', a: false, why: 'Patient-Initiated Refusal 2.6: a minor with no authorized decision maker cannot refuse. Keep trying the guardian and transport.' },
    { q: '4-year-old in narrow-complex tachycardia at 260, mottled, adenosine failed. Requesting synchronized cardioversion.', a: true, why: 'Pediatric Tachycardia 3.3-P: cardioversion for narrow-complex tachycardia in a child requires consultation. Poor perfusion after failed adenosine means cardiovert.' },
    { q: '64M with ROSC after a VF arrest. BP 96/60, 12-lead shows a STEMI. Requesting the cardiac interventional center (+10 min).', a: true, why: 'Post-ROSC 3.5-A: every post-arrest patient requires consultation. ROSC with a STEMI belongs at a cardiac interventional center if transport is safe.' },
    { q: '70F with CHF, SpO2 86% on CPAP, BP 170/96. The 12-lead shows inferior ST elevation, plus ST elevation in V4R. Requesting nitroglycerin.', a: false, why: 'CHF 6.3-A: with an inferior MI, consult before nitroglycerin. ST elevation in V4R means right ventricular involvement, and nitrates can drop her pressure hard.' },
    { q: '66F on lisinopril with tongue and lip swelling and a changing voice, no hives. Epinephrine did not help. Requesting TXA.', a: true, why: 'New in 2026 (Angioedema 4.8-A): epinephrine and TXA are given after medical consultation. ACE-inhibitor angioedema is bradykinin-driven, which is why epinephrine often fails.' },
    { q: '52M in severe alcohol withdrawal, tremulous and hallucinating after three IV doses of midazolam. Requesting a fourth.', a: true, why: 'Alcohol Withdrawal 4.3: midazolam beyond three IV doses requires consultation. Untreated severe withdrawal can seize or progress to delirium tremens.' },
    { q: '50M with chest pain and ST elevation, Priority 1. The closest facility is a freestanding ED 5 minutes away; the PCI center is 18 minutes. Requesting the freestanding ED.', a: false, why: 'Freestanding Medical Facility 2.5: Priority 1 and 2 transports there require base station consultation. A STEMI needs a cardiac interventional center, not a freestanding ED.' },
    { q: '6-year-old with diabetes, glucose 52 and still drowsy after one dose of D10. Requesting a second dose.', a: true, why: 'Pediatric Hypoglycemia 4.10: a second D10 dose requires consultation. Still under 70 and symptomatic: give it.' },
    { q: '9-month-old with croup, stridor at rest, and retractions. Requesting nebulized epinephrine.', a: true, why: 'Croup 6.4: nebulized epinephrine dosing for a child under 1 year requires consultation. Stridor at rest is the indication.' },
    { q: '78F with sepsis, BP 82/44 after 30 mL/kg of LR, lungs clear. Requesting more fluid.', a: true, why: 'Sepsis 4.15-A: fluid beyond 30 mL/kg may be approved by online consultation. Clear lungs and persistent hypotension: give more, and be ready for the epinephrine infusion.' },
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
function label(p) { return p.room ? roomName(p.room) : `${p.name.split(' ')[0]} (${p.age}${p.sex})`; }
function clock(t) {
  const m = Math.floor(SHIFT_START + (t == null ? G.t : t));
  const h = ((Math.floor(m / 60) % 24) + 24) % 24, mm = ((m % 60) + 60) % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function hourMul(t) { const h = ((Math.floor((SHIFT_START + t) / 60) % 24) + 24) % 24; return HOUR_MUL[h]; }
function zoneList(zs) { return zs.map(z => ZONE_NAME[z]).join(' + '); }
function genName(sex, age) { const pool = age < 13 ? KIDS[sex] : NAMES[sex]; return pick(pool) + ' ' + INITIALS[randi(0, INITIALS.length - 1)] + '.'; }
const cap = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
const langMul = p => (p.lang && p.interp !== 'on' ? 1.5 : 1);

function care(n, tag) { if (G.pre) return; G.care += n; const k = tag || 'other'; G.ledger[k] = (G.ledger[k] || 0) + n; }
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
  };
  G.staff = ROSTER.map(mkStaff);
  for (const r of G.rooms) if (r.z === 'ft') r.closed = true;  // Fast Track opens at 09:00
  for (const k in SPECS) G.spec[k] = { mood: 0, at: 0 };
  G.nextArr.walk = G.t + expo(60 / (L.walk * hourMul(G.t)));
  G.nextArr.ems = G.t + expo(60 / (L.ems * hourMul(G.t)));
  // You inherit a department that has been running all night.
  let guard = 0;
  while (G.t < 0 && guard++ < 2000) { step(0.25); botStep({}); }
  seedBoarders(L.boarders);
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
  if (G.train) { G.nextArr = { walk: 1e9, ems: 1e9, alert: 1e9 }; G.box.nextC = 1e9; }
  note(`07:00, ${L.name}. ${G.train ? 'Your preceptor has the board with you.' : 'Night shift hands you the board.'}`);
}

/* ---------- main step ---------- */
function step(dt) {
  if (!G || !G.running || G.over || G.card) return;
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
  if (m !== G.lastMin) { G.lastMin = m; minuteTick(); }
  if (!G.pre && G.t >= G.shift) endShift('time');
}

/* ---------- arrivals ---------- */
function pickCase(srcs) { return wpick(CASES.filter(c => srcs.includes(c.src)), c => c.wt); }
function pickLang() { let r = rnd(); for (const [k, w] of LANG_W) { r -= w; if (r < 0) return k; } return null; }
function makePatient(c, src) {
  const sex = c.sex || (chance(0.5) ? 'F' : 'M');
  const age = randi(c.age[0], c.age[1]);
  const p = {
    id: 'p' + (G.nid++), ck: c.k, name: genName(sex, age), age, sex, src,
    cc: c.cc, dx: c.dx, esi: c.esi, alert: c.alert || null, alertOn: false,
    wk: c.wk.slice(), tr: c.tr.slice(), con: c.con || null, pre: (c.pre || []).slice(), need: c.need ? c.need.slice() : null,
    dispo: c.dispo, find: Object.assign({}, c.find || {}), iso: c.iso || null, sitter: !!c.sitter, txTo: c.txTo || null,
    arrest: !!c.arrest, ecg10: !!c.ecg10, vit: c.vit || null, bleed: c.bleed || null, amaMul: c.ama || 1,
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
  G.pts[p.id] = p; G.order.push(p.id);
  return p;
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
function mm(sev, what, why) { if (!G.pre) G.stats.mm.push({ sev, t: G.t, what, why }); }
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
  toast(`${O.msg} Expected back in about ${until - G.t} min.`, 'alert'); sound('alarm');
  if (G.dv[O.fix].on) creditDivert(O.fix);
}
function outageTick() {
  for (const o in G.out) {
    if (G.out[o].until > G.t) continue;
    const O = OUTAGES[o], on = G.dv[O.fix].on;
    delete G.out[o];
    toast(`${O.name}: fixed.${on && !justified(O.fix) ? ` Lift ${DIVERTS[O.fix].name}.` : ''}`, 'good');
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
  note(`${p.unit} at the bay: ${p.age}${p.sex}, ${p.cc}`);
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
    toast(`${ALERTS[p.alert].name} alert at the bay. ${p.unit}: ${p.age}${p.sex}, ${p.cc}`, 'alert');
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
  if (p.esi === 1 && r.kind !== 'resus') return { ok: false, why: 'ESI 1 needs a resus bay' };
  if (p.iso === 'air' && !r.iso) return { ok: false, why: 'Airborne isolation needs Room 8 or 16 (negative pressure)' };
  if (r.kind === 'chair') {
    if (p.iso || p.sitter) return { ok: false, why: 'Isolation and safety patients need a room' };
    if (isBoarder(p) || p.dsp === 'decide') return { ok: false, why: 'Admitted patients need a bed, not a chair' };
    const leaving = p.dsp === 'ready' || p.dsp === 'dc';
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
  toast(`Triage called a ${ALERTS[p.alert].name} alert: ${p.age}${p.sex}, ${p.cc}`, 'alert');
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
  if (s.role === 'app' && (vEsi(p) <= 1 || p.esi <= 1)) return { ok: false, why: 'ESI 1 needs an attending' };
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
  if (p.ev === 'none') {
    p.ev = 'q';
    const dur = (p.pitSeen ? 5 : s.role === 'md' ? 9 : 11) * langMul(p);
    addTask(s, p.arrest ? { type: 'code', pid, dur: 15, label: 'Code' } : { type: 'eval', pid, dur, label: 'Eval' });
  }
  if (p.re === 'need') { p.re = 'q'; addTask(s, { type: 'reassess', pid, dur: 3 * langMul(p), label: 'Recheck' }); }
  queueProcs(p);
  return { ok: true, msg: `${s.name} has ${label(p)}` };
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
    p.ev = 'done'; orders(p); if (p.pitSeen && !p.dxK && allWorkDone(p)) p.dxK = true;
    revealEsi(p, `${s.short}'s exam`);
    if (s.role === 'app' && p.esi <= 2) needCosign(p);
  }
  else if (k.type === 'cosign') { p.cosign = 'done'; if (!G.pre) G.stats.cosign++; }
  else if (k.type === 'code') { p.ev = 'done'; codeOutcome(p); }
  else if (k.type === 'reassess') { p.re = 'done'; p.dxK = true; note(`${label(p)}: ${p.dx}`); }
  else if (k.type === 'proc') { p.treat[k.key].st = 'done'; p.treat[k.key].tDone = G.t; if (k.key === 'intub') { if (!G.pre) G.stats.intub++; if (p.treat.vent) openGate(p.treat.vent, 'vent'); } }
  else if (k.type === 'pit') pitDone(s, p);
  else if (k.type === 'pitdc') { if (p.loc === 'waiting') { G.stats.pitDc++; note(`${s.short} discharged ${p.name} from triage`); leave(p, 'dc'); } }
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
  if (!p.wk.length && !p.dxK) p.dxK = true;
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
    if (!G.pre) { G.stats.rosc++; care(30, 'flow'); }
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
    return { ok: true, msg: `${s.name} is back on the floor` };
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
      const k = s.tq.find(x => { const p = pt(x.pid); return !x.kind && p && (p.loc === 'wall' || p.loc === 'triage') && p.tri === 'q' && regQuick(p); });
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
  if (k.kind === 'ecg' && p.work.ecg && p.work.ecg.st === 'doing') { p.work.ecg.st = 'done'; p.work.ecg.tDone = G.t; goalHit(p, 'ecg10'); return; }
  if (k.kind === 'lab' && p.work.lab && p.work.lab.st === 'doing') labDrawn(p);
}
function treatDone(p, key) {
  const it = p.treat[key]; if (!it) return;
  it.st = 'done'; it.tDone = G.t;
  if (key === 'abx') goalHit(p, 'abx60');
  if (key === 'tnk') goalHit(p, 'dtn60');
  if (key === 'mtp') { p.shock = false; note(`${label(p)}: massive transfusion running, pressure coming up`); }
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
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not on the floor` };
  if (p.tri === 'done' || !(p.loc === 'wall' || p.loc === 'triage')) return { ok: false, why: `${label(p)} is already triaged` };
  if (p.tri !== 'none') { const o = staff(p.triBy); return { ok: false, why: `${o ? o.name : 'A nurse'} already has ${label(p)}` }; }
  if (s.skill === 'new') return { ok: false, why: `${s.name} is a new grad and isn't triage-trained yet` };
  p.tri = 'q'; p.triBy = sid; s.tq.push({ pid });
  return { ok: true, msg: `${s.name} will ${p.loc === 'wall' ? `take report from ${p.unit} and triage` : 'triage'} ${label(p)}${regQuick(p) ? '' : ' once registered'}` };
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
  if (k.kind === 'ecg') { p.work.ecg.st = 'done'; p.work.ecg.tDone = G.t; goalHit(p, 'ecg10'); }
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
    if (it.st === 'verify' && !it.vby) out.push({ p, k, pr: (k === 'tnk' ? -20 : 0) + (p.alertOn ? 0 : 10) + p.esi * 10 + (p.stat ? -15 : 0) });
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
    G.stats.mtpWaste++; care(-10, 'blood');
    note(`MTP cancelled for ${label(p)}: not a hemorrhage. ${uses} units of O-negative wasted.`, 'bad');
    return { ok: false, why: 'The blood bank pushed back: this patient is not bleeding out. Cooler cancelled, O-negative wasted.' };
  }
  p.bb = { st: 'mtp', due: G.t + (uses >= 4 ? 8 : 15), mtp: true };
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
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-10, 'consult'); G.stats.wrongSpec++; provHit(p, 3); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${p.con ? `Why is ${S.name.toLowerCase()} getting this call? Not ours.` : 'This patient does not need a consult. Send them home.'}"` };
  }
  // EMS-activated STEMI, stroke, and trauma alerts can call their team on the field report alone
  const miss = (p.alertOn && ALERTS[p.alert] && ALERTS[p.alert].auto) ? [] : p.pre.filter(k => !(p.work[k] && p.work[k].st === 'done'));
  if (miss.length) {
    m.mood = Math.max(-3, m.mood - 1); m.at = G.t; care(-15, 'consult'); G.stats.angry++; provHit(p, 4); sound('bad');
    return { ok: false, mad: true, why: `${S.doc} (${S.name}): "${S.mad(miss.map(k => MISS_NAME[k]).join(' and '))}"` };
  }
  const base = (spec === 'trauma' ? randi(8, 14) : randi(12, 22)) + (spec === 'trauma' && outActive('or') ? 30 : 0), mult = [1, 1.2, 1.5, 1.9][-m.mood] || 1;
  const mins = Math.round(base * mult);
  p.consult = { st: 'req', spec, due: G.t + mins, t0: G.t };
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
  if (ok) { G.stats.goals.met++; care(30, 'goals'); toast(`${GOALS[key].label}: ${Math.round(el)} min. Goal met · ${label(p)}`, 'good'); sound('good'); }
  else { G.stats.goals.miss++; care(-20, 'goals'); mm(40, `${GOALS[key].label} took ${Math.round(el)} min (goal ${GOALS[key].lim}) for ${p.name}`, goalWhy(p, key)); }
}
function goalMissTick(p) {
  for (const key in p.goals) {
    if (p.goals[key] === null && G.t - p.tArrive > GOALS[key].lim) {
      p.goals[key] = false;
      if (G.pre) continue;
      G.stats.goals.miss++; care(-20, 'goals'); G.stats.goals.list.push({ key, ok: false, el: null, alert: p.alert });
      mm(40, `${GOALS[key].label} went past ${GOALS[key].lim} min for ${p.name}`, goalWhy(p, key));
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
    if ('surg15' in p.goals && p.goals.surg15 === null && p.consult.st === 'here' && p.loc === 'room') goalHit(p, 'surg15', Math.max(p.consult.tArr, p.tRoom));
    goalMissTick(p);
    if (p.loc !== 'room') continue;
    if (p.ev === 'done' && !p.dxK && p.re === 'none' && allWorkDone(p)) {
      const s = staff(p.prov);
      if (s && isProv(s) && present(s) && !s.pit) { p.re = 'q'; addTask(s, { type: 'reassess', pid: p.id, dur: 3 * langMul(p), label: 'Recheck' }); }
      else { p.re = 'need'; p.prov = null; p.tNeed = G.t; }
    }
    if (p.treat.tnk && p.treat.tnk.st === 'wait' && p.consult.st === 'here' && p.work.ct && p.work.ct.st === 'done') openGate(p.treat.tnk, 'tnk');
    if (p.treat.blood && p.treat.blood.st === 'wait' && p.bb && p.bb.st === 'ready') openGate(p.treat.blood, 'blood');
    if (p.treat.mtp && p.treat.mtp.st === 'wait' && p.bb && p.bb.st === 'here') openGate(p.treat.mtp, 'mtp');
    if (p.cosign === 'wait') needCosign(p);
    if (p.dsp === 'none') checkDispo(p); else dspTimers(p);
  }
}
function checkDispo(p) {
  if (p.ev !== 'done' || !p.dxK || p.arrest || p.reg !== 'done') return;
  if (p.cosign === 'need' || p.cosign === 'wait') return;
  if (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done')) return;
  if (p.dispo === 'cath' && outActive('cath')) { p.dispo = 'transfer'; p.txTo = 'another PCI center'; delete p.goals.d2b90; note(`${label(p)} needs a cath lab and ours is down. Transfer them.`, 'bad'); }
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
  if (p.dispo === 'home') p.dsp = 'ready';
  else if (p.dispo === 'transfer') p.dsp = 'readytx';
  else if (p.dispo === 'obs') obsAdmit(p);
  else if (p.dispo === 'admit' || p.dispo === 'icu' || p.dispo === 'bh') {
    const base = p.dispo === 'icu' ? randi(30, 90) : p.dispo === 'bh' ? randi(100, 200) : randi(45, 110);
    p.dsp = 'board'; p.due = G.t + base * L.board; p.tBoard = G.t;
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
  if (pick === g.right) { S.right++; care(8, 'gray'); msg = `Good call. ${risk}.`; }
  else if (g.ok.includes(pick)) { S.ok++; msg = `Defensible. ${risk}: most would pick ${g.right === 'obs' ? 'observation' : g.right}.`; }
  else if (g.right === 'home') { S.over++; care(-6, 'gray'); msg = `${risk} usually goes home. That bed was needed.`; }
  else { S.under++; p.grayUnder = true; msg = `${risk}. Most would keep this patient.`; }
  p.grayPick = pick; p.dispo = pick; p.dsp = 'none';
  setDispo(p);
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
  else if (p.dsp === 'family' && G.t >= p.due) { p.dsp = 'morgue'; p.tReady = G.t; }
  else if (p.dsp === 'morgue' && G.t - (p.tReady || G.t) > 20) leave(p, 'expired');
}
function discharge(pid) {
  const p = pt(pid); if (!p) return { ok: false, why: 'No patient' };
  if (p.dsp !== 'ready') return { ok: false, why: p.dispo === 'home' ? 'Not ready yet. Workup or treatment is still pending.' : 'This patient is not going home' };
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
  if (outcome === 'dc') { S.dc++; care(10, 'flow'); if (p.tDone - p.tArrive <= 120) { care(5, 'flow'); S.quick++; } }
  else if (outcome === 'admit' || outcome === 'icu' || outcome === 'bh' || outcome === 'obs') { S[outcome]++; care(12, 'flow'); }
  else if (outcome === 'or') { S.or++; care(15, 'flow'); toast(`${p.name} is off to the OR`, 'good'); }
  else if (outcome === 'cath') { S.cath++; care(15, 'flow'); toast(`${p.name} is in the cath lab, ${Math.round(p.tDone - p.tArrive)} min after arrival`, 'good'); }
  else if (outcome === 'tx') { S.tx++; care(12, 'flow'); note(`${p.name} transferred to ${p.txTo}`); }
  else if (outcome === 'lwbs') { S.lwbs++; care(-25, 'lwbs'); }
  else if (outcome === 'ama') { S.ama++; care(-15, 'ama'); }
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

/* ---------- 72-hour returns ---------- */
function bounceRoll(p, outcome, wasLoc) {
  if (p.ret || G.train) return;
  let c = outcome === 'ama' ? 0.35 : outcome === 'lwbs' ? 0.12 : 0.02;
  let why = outcome === 'ama' ? 'Left against medical advice' : outcome === 'lwbs' ? 'Left without being seen' : 'Discharged; sometimes it just happens';
  if (outcome === 'dc') {
    const add = (x, w) => { c += x; if (x >= 0.04) why = w; };
    if (p.tRoom != null && p.tDone - p.tRoom < 35 && wasLoc === 'room') add(0.04, `Discharged ${Math.round(p.tDone - p.tRoom)} min after they were roomed`);
    if (p.lang && p.interp !== 'on') add(0.12, `Discharged without a ${LANGS[p.lang]} interpreter`);
    if (p.gray) add(p.grayUnder ? 0.3 : 0.02, p.grayUnder ? `Sent home with a ${p.gray.band}-risk ${p.gray.tool}` : why);
    if (p.missedDx) add(0.35, `Missed on the first visit: ${p.missedDx.by} had ${p.missedDx.n} patients in line`);
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
  G.stats.returns++; care(-20, 'returns');
  mm(35, `${orig.name} came back within 72 hours, sicker`, orig.retWhy || 'Discharged');
  toast(`72-hour return: ${p.name} is back and sicker (${orig.outcome === 'ama' ? 'left against advice' : orig.outcome === 'lwbs' ? 'left without being seen' : 'discharged'} earlier)`, 'bad');
  sound('bad');
}

/* ---------- waiting room, ratios, morale, AMA (once per game minute) ---------- */
/* An active resuscitation (a code, or the first 20 minutes in the bay) takes a nurse and a half. */
function activeResus(p) { return p.esi === 1 && p.dsp === 'none' && p.loc === 'room' && (p.arrest || (p.tRoom != null && G.t - p.tRoom < 20)); }
function weight(p) {
  if (p.dsp === 'family' || p.dsp === 'morgue' || p.dsp === 'morguing') return 1;
  const r = p.room ? room(p.room) : null;
  if (r && r.kind === 'chair') return 0.1;
  const boarding = isBoarder(p);
  if (p.esi === 1) return boarding ? 2 : activeResus(p) ? 6 : 4;
  if (p.esi === 2) return (p.dsp === 'ready' || p.dsp === 'dc' || p.dsp === 'dcing' || (boarding && p.dispo !== 'icu')) ? 1 : 2;
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
function crash(p) {
  const waited = Math.round(G.t - (p.tTriage != null ? p.tTriage : p.tArrive)), shown = vEsi(p);
  const why = p.esiT != null ? `Under-triaged as ESI ${shown} and never rechecked`
    : p.loc === 'triage' ? `Waited ${Math.round(G.t - p.tArrive)} min ${p.reg === 'none' ? 'and nobody registered them' : p.tri === 'none' ? 'and no nurse was sent to triage them' : 'in the triage line'}`
    : `ESI ${p.esi} waited ${waited} min for a bed. ${crowdWhy()}.`;
  mm(60, `${p.name} crashed in the ${p.loc === 'waiting' ? 'waiting room' : 'triage line'}`, why);
  p.esi = 1; p.esiT = null; p.crash = true; p.tCrash = G.t;
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
  mm(95, `${p.name} arrested in the waiting room`, `They crashed ${Math.round(G.t - p.tCrash)} min earlier and never got a resus bay`);
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
function hemorrhageTick(p) {
  if (p.bleed !== 'mtp' || p.bb || p.arrest || p.dsp !== 'none') return;
  const el = G.t - p.tArrive;
  if (el > 15 && !p.shock) {
    p.shock = true; G.stats.shock++; care(-20, 'blood');
    mm(70, `${label(p)} went into hemorrhagic shock`, 'Massive transfusion was not activated in the first 15 min');
    toast(`${label(p)} is in hemorrhagic shock. Activate the massive transfusion protocol!`, 'alert'); sound('alarm');
  }
  if (el > 30) {
    toArrest(p, 'Traumatic arrest after hemorrhage'); p.traumatic = true; p.bleed = null; p.shock = false; care(-60, 'blood');
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
      if (!G.train && p.esi === 2 && !p.crash && !p.alertOn && t - p.tArrive > 20 && chance(0.012)) crash(p);
    }
    if (p.loc === 'waiting') {
      if (p.esi >= 3 && t - p.tTriage > p.patience && !p.pitDcQ) { toast(`${p.name} (ESI ${vEsi(p)}) left without being seen after ${Math.round(t - p.tArrive)} min`, 'bad'); mm(25, `${p.name} (ESI ${vEsi(p)}) left without being seen after ${Math.round(t - p.tArrive)} min`, crowdWhy()); leave(p, 'lwbs'); continue; }
      if (!G.train && p.esi === 2 && !p.crash && !p.alertOn && t - p.tTriage > 30 && chance(0.012)) crash(p);
    }
    if (p.crash && !p.arrest && p.loc !== 'room' && t - p.tCrash > 15) waitingArrest(p);
    hemorrhageTick(p);
    if (G.pre) continue;
    // Patient experience: an hour without an update starts to cost you.
    const heard = p.lastUpdate != null ? p.lastUpdate : (p.loc === 'room' && p.tRoom != null ? p.tRoom : p.tArrive);
    if (t - heard > 60) p.px -= 0.2;
    if (p.loc === 'wall') {
      const w = t - p.tArrive;
      if (w > 30) care(-0.5, 'wall');
      if (w > 60) G.ev.regionDue = true;
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
    if (n && !zoneNurses(z.id).length) { care(-0.5 * n, 'uncovered'); G.stats.uncovered += n; warnOnce('unc' + z.id, `${z.name} has ${n} patient${n > 1 ? 's' : ''} and no nurse. Tap the ${z.name} header.`, 15); }
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
  if (ar.length) { const rn = zoneNurses('resus').length; if (!rn || zoneLoad('resus', hn > 0) / rn > 4) warnOnce('resus2', `Active resuscitation in ${ar.map(p => roomName(p.room)).join(' and ')}. Resus needs another nurse: tap the Resus header and add one.`, 20); }
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
  if (staffSat() < 20) endShift('walkout');
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
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not on the floor` };
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
    else if (s.st === 'away' && t >= s.until) { s.st = 'on'; endCover(s); toast(`${s.name} is back on the floor`, 'good'); }
    else if (s.st === 'pending' && t >= s.until) { s.st = 'on'; s.lastBreak = t; if (s.tag !== 'swing shift' && s.tag !== 'Fast Track 09:00') toast(`${s.name} arrived${s.zones.length ? ' and took ' + zoneList(s.zones) : ''}`, 'good'); }
    if (s.leaveAt != null && t >= s.leaveAt && (s.st === 'on' || s.st === 'break')) {
      const zs = s.zones.slice();
      staffGone(s, 'gone');
      toast(`${s.name}'s mandated hours are up. They went home.`, 'info');
      const unc = zs.filter(z => zoneNurses(z).length === 0 && zonePts(z));
      if (unc.length && !G.card && !G.pre) coverageCard(unc[0], 'Coverage gap', `${s.name} went home. ${ZONE_NAME[unc[0]]} has patients and no nurse.`);
    }
  }
}
function sendBreak(sid) {
  const s = staff(sid); if (!s) return { ok: false, why: 'Unknown staff member' };
  if (s.st !== 'on') return { ok: false, why: `${s.name} is not on the floor` };
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
const scenOf = c => (SCEN[G.pack] || SCEN.national)[c.sc];
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
  toast(`Missed consult. ${c.unit} rolled to another hospital's physician.`, 'bad'); sound('bad');
  G.ev.missedC++; if (G.ev.missedC >= 2) G.ev.regionDue = true;
}
function missNotify(p) {
  p.missN = true;
  if (G.pre) return;
  G.stats.boxN.miss++; care(-20, 'box');
  toast(`Missed the ${ALERTS[p.alert].name} report. ${p.unit} is coming in unannounced.`, 'bad'); sound('bad');
}
function boxNotify() {
  const c = G.box.cur; if (!c || c.kind !== 'notify') return { ok: false, why: 'No report on the line' };
  const p = pt(c.pid); G.box.cur = null;
  p.pren = true; G.stats.boxN.ans++; care(5, 'box');
  return { ok: true, msg: `Report taken: ${ALERTS[p.alert].name}, ${p.age}${p.sex}, ETA ${Math.max(1, Math.round(p.eta - G.t))} min. ${ALERTS[p.alert].team}.${p.bleed === 'mtp' ? ' EMS says pale and hypotensive.' : ''}` };
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
  return { ok: true, sc: scenOf(c), unit: c.unit, doc: s.name, pack: G.pack };
}
function boxDecide(approve) {
  const c = G.box.cur; if (!c || !c.taken) return null;
  const sc = scenOf(c), ok = !!approve === sc.a, mul = surveyMul();
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
    else if (s.k === 'mci') mciArrive();
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
  setCard('ama', 'Leaving against advice', `${roomName(p.room)} nurse`, `${p.name} (${p.age}${p.sex}, ${p.dxK && (!p.alertOn || p.ev === 'done') ? p.dx : p.cc}) is pulling out the IV and wants to leave: "${pick(AMA_LINES)}"${p.lang && p.interp !== 'on' ? ` They speak ${LANGS[p.lang]}, and nobody has an interpreter on.` : ''}`, [
    { k: 'talk', label: talker ? `${talker.name} goes to talk with them` : 'Get a provider to talk with them', sub: 'Usually works. Costs the provider about 5 min.', dis: !talker },
    { k: 'update', label: 'Nurse update, a food tray, and an ETA', sub: 'Works about half the time' },
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
function mciArrive() {
  const units = ['Medic 41', 'Medic 42', 'Engine 12', 'Medic 7'];
  ['mcimin', 'mcimin', 'mcigrn', 'mcigrn'].forEach((k, i) => {
    const p = makePatient(CASES.find(x => x.k === k), 'ems');
    p.unit = units[i]; p.loc = 'wall'; p.tArrive = G.t; onArrive(p);
  });
  toast('The bus crash patients are at the bay: 4 units', 'alert'); sound('siren');
}
function injure(s, how) {
  if (!s) { care(-15, 'safety'); return; }
  revertTask(s); s.st = 'away'; s.until = G.t + 45; s.morale -= 12;
  for (const x of G.staff) if (present(x)) x.morale -= 3;
  G.stats.adverse++; care(-25, 'safety');
  const f = startCover(s);
  toast(`${s.name} ${how} and is off the floor for 45 min.${f ? ` ${f.name} is covering.` : ''}`, 'bad'); sound('bad');
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
      coverageCard(z, 'Call-out', `${s.name} called out sick. ${ZONE_NAME[z]} has no nurse${n ? ` and ${n} patient${n > 1 ? 's' : ''}` : ''}.`);
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
        if (unc.length) coverageCard(unc[0], 'Sick call', `${s.name} is going home with ${why}. ${ZONE_NAME[unc[0]]} has no nurse.`);
        else toast(`${s.name} went home with ${why}`, 'bad');
      } else if (isProv(s)) {
        setCard('provsick', 'Provider down', 'Charge RN', `${s.name} is going home with ${why}.${n ? ` ${n} patient${n > 1 ? 's' : ''} need a new provider.` : ''}`, [
          { k: 'backup', label: 'Call in the backup doc', sub: 'Dr. Novak arrives in about 60 min' },
          { k: 'absorb', label: 'Absorb it', sub: 'Your other providers pick up the slack. Morale drops.' },
        ]);
      } else if (s.role === 'rph') {
        setCard('rphsick', 'No pharmacist', 'Pharmacy', `${s.name} is going home with ${why}. Nobody is verifying ED medications.`, [
          { k: 'remote', label: 'Central pharmacy verifies remotely', sub: 'Slower: about twice as long per order' },
          { k: 'none', label: 'Go without', sub: 'Nurses pull meds on override. Faster, riskier.' },
        ]);
      } else {
        setCard('helpsick', 'Staff down', 'House Supervisor', `${s.title} ${s.name} is going home with ${why}.`, [
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
      setCard('agitated', 'Combative patient', 'Pod nurse', `${p.name} in ${roomName(p.room)} is yelling, pulling at the IV, and swinging at staff.`, [
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
  mci: {
    w: () => (G.t > 60 && G.t < G.shift - 60 && !G.ev.used.mci) ? 0.6 : 0,
    fire() {
      setCard('mci', 'Multiple patients incoming', 'EMS dispatch', 'Bus versus pole on the highway. Four patients coming to you in about 12 minutes: two with neck and back pain, two walking wounded.', [
        { k: 'call', label: 'Call in an extra RN', sub: 'Arrives in about 30 min and takes the hallway' },
        { k: 'ok', label: "We've got it", sub: 'Start clearing beds' },
      ]);
    },
    pick(k) {
      G.sched.push({ t: G.t + 12, k: 'mci' });
      if (k === 'call') { const s = mkStaff({ id: 'rnx' + (G.sid++), role: 'rn', name: 'Morgan (called in)', short: 'Morgan', zones: ['hall'], tag: 'call-in' }); s.st = 'pending'; s.until = G.t + 30; G.staff.push(s); care(-5, 'staffing'); }
    },
  },
  vip: {
    w: () => (G.t > 40 && !G.ev.used.vip) ? 0.6 : 0,
    fire() {
      const c = { k: 'vip', cc: 'Dizzy spell', dx: 'Benign positional vertigo', esi: 4, age: [76, 82], sex: 'F', wk: ['lab'], tr: ['meds'], dispo: 'home', find: { lab: 'Normal' } };
      const p = makePatient(c, 'walk');
      p.name = 'Eleanor V.'; p.lang = null; p.loc = 'waiting'; p.tArrive = G.t; p.tTriage = G.t; p.reg = 'done'; p.tri = 'done'; onArrive(p); p.patience = 1e9;
      setCard('vip', 'VIP in the lobby', 'Hospital CEO', `"The board chair's mother is in your waiting room with a dizzy spell. She's an ESI 4. I trust you'll take care of her. Personally."`, [
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
      setCard('admWait', 'Administrator on the floor', 'VP of Operations', `"${waitingCount()} people in the waiting room? I need that at 6 or fewer in 45 minutes. I'll be back."`, [
        { k: 'yes', label: 'On it', sub: 'Goal: waiting room at 6 or fewer within 45 min. A provider in triage helps.' },
        { k: 'no', label: '"Get me beds upstairs, then we\'ll talk."', sub: 'Staff love it. Admin docks you points.' },
      ]);
    },
    pick(k) { if (k === 'yes') addObj('wait4', 45); else { care(-20, 'admin'); allMorale(4); } },
  },
  tjc: {
    w: () => (G.t > 60 && G.t < G.shift - 90 && !G.ev.used.tjc) ? 0.7 : 0,
    fire() {
      setCard('tjc', 'Accreditation tracer', 'Chief Nursing Officer', '"Accreditation surveyors walk the ED in 30 minutes. No patients in hallway beds while they are here. That\'s 45 minutes after they arrive."', [
        { k: 'ok', label: 'Clear the halls', sub: 'Goal: hallways empty in 30 min and kept empty for 45' },
      ]);
    },
    pick() { addObj('nohall', 30, { until2: G.t + 75 }); },
  },
  flex: {
    w: () => (G.t > 90 && G.t < 400 && !G.ev.used.flex && G.staff.filter(s => s.role === 'pct' && s.st === 'on').length >= 3) ? 0.6 : 0,
    fire() {
      setCard('flex', 'Budget call', 'Chief Financial Officer', '"Our census projections say you are overstaffed on techs. Send one PCT home."', [
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
      setCard('patExp', 'Family complaint', 'Patient Experience', `${p.name}'s daughter says nobody has updated them in hours (${roomName(p.room)}). She's filling out the survey right now.`, [
        { k: 'go', label: 'Send a PCT to update them with warm blankets', sub: 'Ties up a PCT for 6 min' },
        { k: 'no', label: 'Not now', sub: 'Survey scores drop' },
      ]);
    },
    pick(k) { if (k === 'go') { G.errands.push({ label: 'Family update', dur: 6 }); care(10, 'admin'); } else care(-10, 'admin'); },
  },
  noDivert: {
    w: () => ((G.dv.yellow.on || G.dv.red.on || Object.keys(DIVERTS).some(k => G.dv[k].on && !DIVERTS[k].capacity && !justified(k))) && !G.ev.used.noDivert) ? 2 : 0,
    fire() {
      setCard('noDivert', 'Divert pushback', 'VP of Operations', `"Who put us on ${Object.keys(DIVERTS).filter(k => G.dv[k].on).map(k => DIVERTS[k].name).join(' and ') || 'divert'}? EMS volume is our volume. Turn it off."`, [
        { k: 'off', label: 'Turn it off', sub: 'No divert for 90 min' },
        { k: 'keep', label: 'Keep it on', sub: 'Admin docks you points' },
      ]);
    },
    pick(k) { if (k === 'off') { for (const x in DIVERTS) if (DIVERTS[x].capacity || !justified(x)) G.dv[x].on = false; G.mods.noDivert = G.t + 90; } else care(-20, 'admin'); },
  },
  survey: {
    w: () => (G.t > 30 && G.t < G.shift - 70 && !G.ev.used.survey) ? 0.7 : 0,
    fire() {
      setCard('survey', 'Medical control audit', 'EMS medical director', 'The EMS medical director is listening to how your attendings handle the Box for the next hour. Consult points count double, good or bad.', [{ k: 'ok', label: 'Bring it on', sub: '' }]);
    },
    pick() { G.mods.survey = G.t + 60; },
  },
  region: {
    fire() {
      setCard('region', 'EMS system call', 'EMS system coordinator', `"Your hospital has had ambulances on the wall over an hour today${G.ev.missedC >= 2 ? ', and two consults went unanswered' : ''}${Object.keys(DIVERTS).some(k => G.dv[k].on) ? ', and you have been on divert a long time' : ''}. What's the plan?"`, [
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
  if (how === 'walk') { p.loc = 'triage'; G.triageQ.push(p.id); onArrive(p); }
  else if (how === 'ems') { p.unit = o.unit || 'Medic 7'; p.loc = 'wall'; onArrive(p); note(`${p.unit} at the bay: ${p.age}${p.sex}, ${p.cc}`); }
  else if (how === 'alert') {
    p.unit = o.unit || 'Medic 21'; p.loc = 'enroute'; p.eta = G.t + (o.eta || 6); p.alertOn = true; p.dxK = true;
    G.enroute.push(p.id);
    G.box.cur = { kind: 'notify', pid: p.id, unit: p.unit, id: ++G.box.seq, ring: 1e9, left: 1e9, t0: G.t };
    sound('ring');
  } else if (how === 'waiting') {
    p.loc = 'waiting'; p.reg = 'quick'; p.quick = true; p.tri = 'done'; onArrive(p);
    p.tTriage = G.t - (o.waited || 25); p.tArrive = p.tTriage - 8;
    if (o.esiT) p.esiT = o.esiT;
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
  G.box.cur = { kind: 'consult', sc: nextScen(), unit: 'Medic 12', id: ++G.box.seq, ring: 1e9, left: 1e9, t0: G.t };
  sound('ring');
  return true;
}
function trainOutage(k, mins) {
  const O = OUTAGES[k], until = G.t + mins;
  G.out[k] = { t0: G.t, until, credited: false };
  G.stats.outLog.push({ k, t0: G.t, t1: until, divertAt: null, misses: 0, after: 0 });
  if (k === 'ct' || k === 'power') G.img.ct.down = Math.max(G.img.ct.down, until);
  toast(`${O.msg} Expected back in about ${mins} min.`, 'alert'); sound('alarm');
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
const STARS = { easy: [300, 800, 1400], med: [500, 1300, 2000], hard: [400, 1200, 2200], train: [300, 800, 1400] };
function starsFor(c, level) { const s = STARS[level || (G && G.level) || 'med']; return c >= s[2] ? 3 : c >= s[1] ? 2 : c >= s[0] ? 1 : 0; }
function endShift(reason) {
  if (G.over) return;
  if (!G.pre && G.stats.returnsLate) care(-20 * G.stats.returnsLate, 'returns');
  G.over = true; G.running = false; G.fail = reason === 'walkout' ? 'walkout' : null;
  const list = G.order.map(id => G.pts[id]).filter(p => p.tArrive >= 0 && p.loc !== 'enroute' && p.loc !== 'new');
  const ems = list.filter(p => p.src === 'ems');
  const walls = ems.map(p => p.tWall != null ? p.tWall : (p.loc === 'wall' ? G.t - p.tArrive : 0));
  const S = G.stats;
  G.report = {
    level: G.level, pack: G.pack, fail: G.fail, care: Math.round(G.care), wait: Math.round(avgWait()), sat: Math.round(staffSat()),
    stars: G.fail ? 0 : starsFor(G.care, G.level),
    seen: list.length, dc: S.dc, adm: S.admit + S.icu + S.bh, proc: S.or + S.cath, tx: S.tx, lwbs: S.lwbs, ama: S.ama, expired: S.expired,
    returns: S.returns + S.returnsLate, left: active().length,
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
    suspended: S.suspended, quickReg: S.quickReg,
  };
}

/* ---------- autopilot: fills the board before your shift, runs the demo, and drives the tests ---------- */
function botRoom(p) {
  let best = null, bs = 1e9;
  const e = vEsi(p);
  for (const r of G.rooms) {
    if (r.kind === 'chair' || !canPlace(p, r).ok) continue;
    let sc;
    if (e === 1) sc = r.kind === 'resus' ? 0 : 99;
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
    const d = G.staff.filter(s => s.role === 'md' && s.st === 'on').sort((a, x) => a.q.length - x.q.length)[0];
    if (!d || !boxTake(d.id).ok) return false;
    const sc = scenOf(b); boxDecide(chance(o.acc == null ? 0.85 : o.acc) ? sc.a : !sc.a); return true;
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
    if (p.bleed === 'mtp' && !p.bb && o.mtp !== false) add(1, () => !p.bb && activateMTP(p.id).ok);
    if (p.loc === 'wall' || p.loc === 'triage' || p.loc === 'waiting') {
      if (emergent(p)) { add(2, bed(p)); continue; }
      if (p.loc === 'waiting' || (regQuick(p) && p.tri === 'done')) add(5 + vEsi(p) * 0.1, bed(p));
      if (o.intake !== false && p.loc !== 'waiting') {
        if (p.reg === 'none') add(p.loc === 'wall' ? 5.8 : 6, () => { const s = regPick(); return !!s && p.reg === 'none' && register(p.id, s.id).ok; });
        if (p.tri === 'none') add(p.loc === 'wall' ? 6.3 : 6.5, () => { const s = triPick(); return !!s && p.tri === 'none' && triage(p.id, s.id).ok; });
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
    if (needsProv(p) && o.prov !== false) add(vEsi(p) <= 2 ? 4.5 : 7, () => {
      if (!needsProv(p)) return false;
      const opts = G.staff.filter(s => isProv(s) && s.st === 'on' && canAssign(s, p).ok);
      if (!opts.length) return false;
      const cost = s => s.q.length + (s.role === 'md' && p.esi >= 3 ? 1.5 : 0);
      opts.sort((a, x) => cost(a) - cost(x));
      return assign(opts[0].id, p.id).ok;
    });
    if (p.reg === 'none' && o.intake !== false) add(6.2, () => { const s = regPick(); return !!s && p.reg === 'none' && register(p.id, s.id).ok; });
    if (p.con && p.consult.st === 'none' && (p.alertOn || p.ev === 'done') && preDone(p) && (p.dxK || o.early)) add(7.5, () => p.consult.st === 'none' && consult(p.id, p.con).ok);
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
    if (p.dsp === 'decide' && p.loc === 'room' && o.gray !== false) add(3.1, () => { if (p.dsp !== 'decide') return false; let k = p.gray.right; if (!chance(acc)) k = pick(['home', 'obs', 'admit'].filter(x => x !== k)); return grayDispo(p.id, k).ok; });
    if (p.loc === 'waiting' && o.recheck !== false && G.t - (p.lastRecheck != null ? p.lastRecheck : (p.tTriage != null ? p.tTriage : p.tArrive)) > 60) add(8.2, () => { const s = triPick(); return !!s && p.loc === 'waiting' && recheck(p.id, s.id).ok; });
    if (p.loc === 'room' && o.updates !== false && (p.dsp === 'none' || p.dsp === 'board') && G.t - (p.lastUpdate != null ? p.lastUpdate : p.tRoom) > 90) add(9.2, () => updatePt(p.id).ok);
  }
  if (o.updates !== false && waitingCount() >= 4 && G.t - G.wrUpdate >= 30) add(8.8, () => updateWaiting().ok);
  if (o.chairs !== false && waitingCount() >= 3) {
    const free = G.rooms.find(r => r.kind === 'chair' && !r.pid && !r.closed);
    const c = free && inRooms().filter(p => { const r = roomOf(p); return r.kind !== 'chair' && r.kind !== 'resus' && !p.gray && (p.dsp === 'ready' || (p.dsp === 'none' && p.ev === 'done' && p.dispo === 'home')) && canPlace(p, free).ok; }).sort((a, b) => a.tRoom - b.tRoom)[0];
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
    const due = G.staff.find(s => s.st === 'on' && G.t - s.lastBreak > 260 && !G.staff.some(x => x.st === 'break' && x.role === s.role));
    if (due) add(9.5, () => sendBreak(due.id).ok);
  }
  acts.sort((a, x) => a.pr - x.pr || a.n - x.n);
  for (const a of acts) { if (budget <= 0) break; if (a.fn()) budget--; }
}

const OC = {
  hooks, get G() { return G; }, load(g) { G = g; }, newGame, step, botStep,
  LEVELS, ZONES, ZONE_NAME, ROOMS, SPECS, WORK, TREAT, ALERTS, GOALS, SCEN, PACKS, CASES, LANGS,
  pt, room, staff, roomOf, roomName, label, clock, active, inRooms, boarders, isProv, present,
  zoneLoad, zoneNurses, nurseLoad, zonePts, weight, staffSat, avgWait, waitingCount, hallCount, maxWallNow,
  canPlace, canAssign, needsProv, allWorkDone, preDone, treatsDone, pitDcReady,
  place, move, evsTap, assign, consult, discharge, requestTransfer, escalate, toggleStat,
  boxNotify, boxTake, boxDecide, chooseCard, sendBreak, toggleZone, setZoneClosed, callAgency, orderPizza, setYellow, setDivert, starsFor,
  setPit, activateMTP, releaseONeg, requestInterp, overrideRx,
  register, triage, toWaiting, sendUp, bookIFT, IFT, emergent, DIVERTS, OUTAGES, outActive, justified,
  startOutage, grayDispo, fullCapacity, updatePt, updateWaiting, recheck, vEsi, regQuick, isBoarder, holds, holdNurses, ratioCap, activeResus,
  metrics, staffHours, median, crowdWhy, BOARD_ST, holdLoad, trainPatient, trainConsult, trainOutage,
};
root.OC = OC;
if (typeof module !== 'undefined' && module.exports) module.exports = OC;
})(typeof window !== 'undefined' ? window : globalThis);
