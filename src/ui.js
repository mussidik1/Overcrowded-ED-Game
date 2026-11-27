/* Emergency Department: Code Black — phone-first UI v0.2. Reads state from OC.G, sends taps to OC actions. */
(function () {
'use strict';
const E = window.OC;
const $ = (s, r) => (r || document).querySelector(s);
const SPEEDS = [1, 2, 3, 4];
const BASE = 0.4; // game minutes per real second at 1×: a 12-hour shift takes about 30 minutes
const U = { tm: 'main', scene: 'title', lvl: 'med', mode: 'rn', view: 'map', three: location.protocol !== 'file:', q3d: 'low', scen: 'none', ord: null, ordOpen: null, pack: 'national', sel: null, sheet: null, modal: null, speed: 1, paused: false, sound: true, ringId: null, ringT: 0, wide: false, lastSave: 0, hold: false, ff: 0, coachKey: null };
let audio = null;

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function setH(el, h) { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } }
function setC(el, c) { if (el && el.className !== c) el.className = c; }
/* Swap only the top-level sections whose markup changed, so buttons in unchanged sections stay put mid-tap. */
function morph(el, h) {
  if (!el || el._h === h) return;
  // A box the player is typing in is kept (replacing it would drop the keyboard after one letter), and only it: everything around
  // it is brought up to date, so an answer, an error or a list shows while the box keeps focus (audit R4.6-01).
  const ae = document.activeElement, typing = ae && el.contains(ae) && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(ae.type)));
  const tpl = document.createElement('template'); tpl.innerHTML = h;
  // a focused button that gets redrawn hands its focus to its replacement: the same action and argument, and the same one of
  // those in order (Refresh and a row's Results share both; audit R4.7-09, R1.8-02)
  const same = (b, a) => b.getAttribute('data-act') === a.getAttribute('data-act') && b.getAttribute('data-arg') === a.getAttribute('data-arg');
  const btn = !typing && ae && el.contains(ae) && ae.getAttribute && ae.getAttribute('data-act') ? ae : null;
  const nth = btn ? Array.from(el.querySelectorAll('[data-act]')).filter(b => same(b, btn)).indexOf(btn) : -1;
  const at = btn ? focusables(el).indexOf(btn) : -1;
  morphKids(el, Array.from(tpl.content.childNodes), typing ? ae : null);
  el._h = h;
  if (btn && !el.contains(btn)) {
    // no replacement (Keep, Delete, Close results...): the control now in its place takes the focus, so the next Tab
    // doesn't start again at the top of the page (audit R4.9-03)
    const f = focusables(el), nb = Array.from(el.querySelectorAll('[data-act]')).filter(b => same(b, btn))[nth] || f[Math.min(at, f.length - 1)];
    if (nb) try { nb.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }
}
const focusables = el => Array.from(el.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter(x => !x.disabled && !x.hidden && x.offsetParent !== null);
const morphSame = (c, n) => c && n && c.nodeType === 1 && n.nodeType === 1 && c.tagName === n.tagName && c.id === n.id && c.getAttribute('class') === n.getAttribute('class');
function morphHeld(c, n, ae, src) {   // the element that holds the focused box: patched in place, down to the box, whose typed value stays
  for (const at of Array.from(c.attributes)) if (!n.hasAttribute(at.name) && !(c === ae && at.name === 'value')) c.removeAttribute(at.name);
  for (const at of Array.from(n.attributes)) if (!(c === ae && at.name === 'value') && c.getAttribute(at.name) !== at.value) c.setAttribute(at.name, at.value);
  if (c !== ae) morphKids(c, Array.from(n.childNodes), ae);
  c._src = src;
}
function morphKids(el, next, ae) {
  const cur = Array.from(el.childNodes), srcOf = n => (n.nodeType === 1 ? n.outerHTML : n.textContent);
  // The branch that holds the focused box is matched by what it is (tag, id and class), not by position, so a list or a message that
  // appears above it doesn't replace it (audit R1.7, R3.7-03). A branch whose shape changed is replaced, and the box goes with it.
  const k = ae ? cur.findIndex(c => c.nodeType === 1 && c.contains(ae)) : -1, j = k < 0 ? -1 : next.findIndex(n => morphSame(cur[k], n));
  if (k >= 0 && j >= 0 && j !== k) {
    const held = cur[k];
    for (const c of cur) if (c !== held) c.remove();
    next.forEach((n, i) => { if (i === j) return; n._src = srcOf(n); if (i < j) el.insertBefore(n, held); else el.appendChild(n); });
    morphHeld(held, next[j], ae, srcOf(next[j]));
    return;
  }
  for (let i = 0; i < next.length; i++) {
    const n = next[i], c = cur[i], src = srcOf(n);
    if (c && c._src === src) continue;
    if (ae && i === k && j === k) { morphHeld(c, n, ae, src); continue; }
    n._src = src;
    if (c) el.replaceChild(n, c); else el.appendChild(n);
  }
  for (let i = cur.length - 1; i >= next.length; i--) cur[i].remove();
}
const cap = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
const fmt = x => esc(x).replace(/\[\[(.+?)\]\]/g, '<b class="pn">$1</b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');   // prompts mark key words with **two stars**, a patient's name with [[two brackets]], and a new line with \n
const plainText = x => String(x).replace(/\*\*|\[\[|\]\]/g, '').replace(/\n/g, ' ');
const fm = m => { m = Math.max(0, Math.round(m)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
const fl = v => (Math.round(v * 10) / 10).toString();
const RC = { md: 'r-md', app: 'r-app', rn: 'r-rn', pct: 'r-pct', evs: 'r-evs', rt: 'r-rt', rph: 'r-rph', reg: 'r-reg', tp: 'r-tp', uc: 'r-uc' };
const ZSHORT = { resus: 'Resus', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', hall: 'Hall', ft: 'FT', rp: 'Chairs' };
const dxShown = p => (p.dxK && (!p.alertOn || p.ev === 'done')) ? (p.dxPick && !(g() && g().train) && p.mine ? p.dxPick : p.dx) : null;   // Phase 6 (R5-05): on a shift the card shows the attending's own call
const dxOr = p => dxShown(p) || p.cc;
function emoji(p) { const a = p.age; if (a < 2) return '👶'; if (a < 13) return p.sex === 'F' ? '👧' : '👦'; if (a < 60) return p.sex === 'F' ? '👩' : '👨'; return p.sex === 'F' ? '👵' : '👴'; }
const esiKnown = p => p.tri === 'done' || p.alertOn || p.crash || p.arrest || ['room', 'waiting', 'gone'].includes(p.loc);
const ve = p => E.vEsi(p);
function esiChip(p) { return esiKnown(p) ? `<span class="esi e${ve(p)}">${ve(p)}</span>` : '<span class="esi eq">?</span>'; }
const intakeDone = p => p.loc === 'waiting' || p.loc === 'room' || (E.regQuick(p) && p.tri === 'done');
/* Who registration can take next: new arrivals, plus quick-registered patients who still need the full version. */
const regable = p => p.loc !== 'enroute' && (p.reg === 'none' || (p.reg === 'quick' && (p.loc === 'room' || p.loc === 'waiting')));
const hasHold = () => E.holdNurses().length > 0;
const GRAY_GUIDE = { 'HEART score': '0 to 3 is low risk (home). 4 to 6 is moderate (observation). 7 to 10 is high (admit).', 'Canadian Syncope Risk Score': '0 or below is low risk (home). 1 to 3 is medium and 4 to 5 high (observation, or admit). 6 and up is very high (admit).', 'ABCD2 score': '0 to 3 is low risk (home with fast follow-up). 4 to 5 is moderate (observation). 6 to 7 is high (admit or observation).', 'CURB-65': 'One point each: Confusion, Urea (BUN) over 19, Respiratory rate 30 or more, Blood pressure under 90/60, age 65 or more. 0 to 1 goes home on pills. 2 is observation or a short admission. 3 or more is admit, and think about the ICU.' };
function istChip(lbl, st) { const k = st === 'done' ? 'done' : st === 'doing' ? 'doing' : st === 'q' ? 'q' : 'need'; return `<i class="ist ${k}">${k === 'need' ? 'NEEDS ' : ''}${lbl}${k === 'done' ? ' ✓' : k === 'doing' ? ' NOW' : k === 'q' ? ' IN LINE' : ''}</i>`; }   // needs it, in line for it, being done, done
function intakeChips(p) { const reg = istChip('REG', E.regQuick(p) ? 'done' : p.reg); return p.loc === 'wall' ? istChip('REPORT', p.tri) + reg : reg + istChip('TRIAGE', p.tri); }   // on the wall, report comes first
function alertTag(p) { return p.alertOn && p.alert ? `<i class="atag a-${p.alert}">${esc(E.ALERTS[p.alert].name)}</i>` : ''; }
const LANG_SHORT = { es: 'Spanish', ht: 'Creole', zh: 'Mandarin', ar: 'Arabic', vi: 'Vietnamese', ru: 'Russian', asl: 'ASL' };   // "HT" and "ES" read as diagnoses
function langChip(p) { return p.lang ? `<i class="lg ${p.interp === 'on' ? 'on' : p.interp === 'req' ? 'req' : ''}" title="Speaks ${esc(E.LANGS[p.lang])}">${LANG_SHORT[p.lang] || esc(E.LANGS[p.lang])}</i>` : ''; }
function tagChip(p) { return p.tag ? `<i class="mtag mt-${p.tag}">${cap(p.tag)} tag</i>` : ''; }
function stLabel(s) { return { break: 'On break', away: 'Away', sick: 'Went home sick', off: 'Called out', pending: s.tag === 'swing shift' ? 'Starts at 11:00' : s.tag === 'Fast Track 09:00' ? 'Starts at 09:00' : 'On the way', gone: 'Went home' }[s.st] || ''; }
const SKILL = { new: 'new grad', exp: 'resus-trained' };
function g() { return E.G; }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const aAn = w => (/^[AEIOU]/i.test(w) ? 'an ' : 'a ') + w;
const MD = () => { const G = E.G; return !!(G && G.mode === 'md' && U.scene !== 'title'); };   // game or its report
const isMe = s => !!(s && MD() && s.id === E.G.me);
const mine = p => !!(p && MD() && p.mine && p.prov === E.G.me);
function head(title, sub) { return `<div class="sh-h"><div><h3>${title}</h3>${sub ? `<div class="sh-sub">${sub}</div>` : ''}</div></div>`; }
const PLAIN = () => store('oc-plain') !== '0';   // plain words under results and radio calls; on unless switched off
const Q3D_NAME = { auto: 'auto', high: 'sharp', med: 'balanced', low: 'battery saver' };
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; }

/* ---------- sound (Web Audio beeps; only after a tap) ---------- */
function ensureAudio() {
  if (!U.sound) return;
  try {
    if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
    if (audio && audio.state === 'suspended') audio.resume();
  } catch (e) { audio = null; }
}
function tone(f, d, type, vol, at) {
  if (!audio || !U.sound) return;
  try {
    const t0 = audio.currentTime + (at || 0), o = audio.createOscillator(), gn = audio.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    gn.gain.setValueAtTime(vol || 0.06, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(gn); gn.connect(audio.destination); o.start(t0); o.stop(t0 + d + 0.03);
  } catch (e) { /* ignore */ }
}
/* A monitor beeping somewhere, faster and sharper when a code is running. Quiet on purpose. */
let ambT = 0, pageT = 0;
function ambient(G, now) {
  if (!audio || !U.sound || U.scene !== 'game' || isPaused() || now - ambT < 1150) return;
  ambT = now;
  const act = E.inRooms();
  if (act.some(p => p.arrest)) { tone(1180, .07, 'square', .016); tone(1180, .07, 'square', .016, .17); }
  else if (act.length) tone(act.some(p => p.crash || p.shock) ? 990 : 880, .045, 'sine', Math.min(.018, .005 + act.length * .0005));
  if (Math.random() < .04) tone(1560, .03, 'sine', .007, .45);   // an IV pump, somewhere
}
function radioBurst() {   // squelch when the Box opens up
  if (!audio || !U.sound) return;
  try {
    const n = Math.floor(audio.sampleRate * .22), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audio.createBufferSource(), bp = audio.createBiquadFilter(), gn = audio.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.2; gn.gain.value = .05;
    src.connect(bp); bp.connect(gn); gn.connect(audio.destination); src.start();
  } catch (e) { /* ignore */ }
}
function page(text) {   // an overhead page: a chime, then a voice if the browser has one
  const now = performance.now();
  if (!U.sound || U.scene !== 'game' || now - pageT < 9000) return;
  pageT = now;
  tone(660, .22, 'sine', .05); tone(523, .34, 'sine', .05, .24);
  try {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const u = new SpeechSynthesisUtterance(text); u.volume = .5; u.rate = 1.02;
    setTimeout(() => { try { if (U.sound && U.scene === 'game') window.speechSynthesis.speak(u); } catch (e) { /* ignore */ } }, 700);
  } catch (e) { /* ignore */ }
}
function hush() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }   // the overhead voice stops when the shift does
function pageFor(msg) {   // which messages go out overhead
  let m;
  if ((m = /^(\w+) alert at the bay/.exec(msg))) return `${m[1] === 'Code' ? 'Code blue' : m[1] + ' alert'}, ambulance bay.`;
  if ((m = /^Report taken: (\w+)/.exec(msg))) return `${m[1]} team to the emergency department.`;
  if (/Massive transfusion/i.test(msg) && /activated/i.test(msg)) return 'Massive transfusion protocol, emergency department.';
  if (/^CODE BLUE in the waiting room/.test(msg)) return 'Code blue, waiting room.';
  if (/lost pulses/.test(msg)) return 'Code blue, emergency department.';
  if (/is crashing in the waiting room/.test(msg)) return 'Rapid response, waiting room.';
  return null;
}
function sfx(n) {
  if (U.scene !== 'game') return;
  if (n === 'ring') radioBurst();
  if (n === 'ring') { tone(880, .11, 'square', .04); tone(660, .11, 'square', .04, .14); tone(880, .11, 'square', .04, .28); vib([70, 50, 70]); }
  else if (n === 'ring2') { tone(880, .09, 'square', .03); tone(660, .09, 'square', .03, .12); }
  else if (n === 'siren') { for (let i = 0; i < 3; i++) { tone(620, .16, 'sawtooth', .025, i * .32); tone(820, .16, 'sawtooth', .025, i * .32 + .16); } }
  else if (n === 'alarm') { for (let i = 0; i < 4; i++) tone(980, .1, 'square', .04, i * .18); vib([120, 60, 120]); }
  else if (n === 'good') { tone(660, .08, 'sine', .06); tone(880, .12, 'sine', .06, .08); }
  else if (n === 'bad') tone(170, .22, 'sawtooth', .04);
  else if (n === 'card') { tone(440, .09, 'triangle', .06); tone(554, .12, 'triangle', .06, .1); }
  else if (n === 'tap') tone(520, .05, 'triangle', .05);
}
function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

/* Where a message sits in the top strip: beside the scores when they have slid left, over them when the strip is too narrow for both, and clear of the preceptor when he is up there. */
function stripLayout() {
  if (U.view !== 'map') return;
  const rs = document.documentElement.style, b = document.body;
  const pl = $('#top .pills'), pr = pl ? pl.getBoundingClientRect() : null, co = $('#coach'), cr = co && !co.hidden && co.classList.contains('beside') ? co.getBoundingClientRect() : null;
  if (!pr || !pr.width) return;
  let l = Math.max(pr.left, cr ? cr.right + 6 : 0);
  if (b.classList.contains('msgon')) {
    const key = window.innerWidth + '|' + Math.round(pr.width);
    if (U.msgOverKey !== key) {   // measured once per strip width: is there room for the numbers and a message side by side?
      b.classList.remove('msgover');
      const ps = pl.querySelectorAll('.pill'), last = ps[ps.length - 1];
      U.msgOver = !last || pr.right - last.getBoundingClientRect().right - 6 < 240; U.msgOverKey = key;
    }
    b.classList.toggle('msgover', !!U.msgOver);
    if (!U.msgOver) { const ps = pl.querySelectorAll('.pill'), last = ps[ps.length - 1]; l = Math.max(l, last.getBoundingClientRect().right + 6); }
  }
  const r = Math.round(Math.max(0, window.innerWidth - pr.right)); l = Math.round(l);
  rs.setProperty('--tsL', l + 'px'); rs.setProperty('--tsR', r + 'px');
  const tb = $('#toasts'); if (tb) tb.classList.toggle('tight', window.innerWidth - l - r < 210);   // a small phone with the Box ringing: three short lines instead of two
}
/* ---------- toasts ---------- */
/* On the floor plan a message rides in the top strip, one at a time. It never covers a room, a card, or what the preceptor is pointing at.
   While one shows, the five scores drop their labels and slide left, so the numbers stay on screen (v0.16.3).
   On a real shift, routine news (a goal met, staff arriving, a patient off to the OR: the engine marks these) skips the strip and is filed under the bell, which counts what is new.
   Bad news, anything to act on, and the answer to a tap still take the strip. */
const TQ = [];
const inStrip = () => document.body.classList.contains('mapmode') && document.body.classList.contains('ingame');   // the toast strip is the game's; menus and the summary get full toasts
function msgOn(on) { const b = document.body; if (b.classList.contains('msgon') !== on) { b.classList.toggle('msgon', on); stripLayout(); } }
function toastShow(msg, kind) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast t-' + (kind || 'info'); el.textContent = msg; el._t0 = performance.now();
  box.appendChild(el);
  if (inStrip()) { msgOn(true); if (el.scrollHeight > el.clientHeight + 1) el.classList.add('long'); }   // a long one gets a third, smaller line before it is cut
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); if (inStrip()) toastPump(); if (!box.children.length) msgOn(false); }, 320); }, kind === 'mad' || kind === 'alert' ? 4200 : 3000);
}
/* Every message the shift sends is kept here, newest first, for the Events list. filed: it skipped the strip. */
function msgLog(msg, kind, filed) { const G = g(), L = U.msgs || (U.msgs = []); L.unshift({ t: G ? G.t : 0, msg: String(msg), kind: kind || 'info', filed: !!filed }); if (L.length > 80) L.length = 80; }
function msgHint() {   // the first time a message is filed, say where it went
  if (store('oc-seen-msgs') || U.msgHinted) return;
  U.msgHinted = true; store('oc-seen-msgs', '1');
  toast('Routine updates go to Events: the bell at the top. Bad news still shows here.', 'info');
}
function toastPump() {
  const box = $('#toasts'); if (!box || !TQ.length) return;
  const cur = box.lastElementChild, age = cur ? performance.now() - cur._t0 : 1e9;
  clearTimeout(toastPump.t);
  if (cur && age < 1500) { toastPump.t = setTimeout(toastPump, 1520 - age); return; }   // each one stays long enough to read
  box.textContent = '';
  const [m, k] = TQ.shift(); toastShow(m, k);
  if (TQ.length) toastPump.t = setTimeout(toastPump, 1520);
}
function toast(msg, kind) {
  const box = $('#toasts'); if (!box) return;
  const pg = pageFor(String(msg)); if (pg) page(pg);   // the big ones go out overhead too
  if (inStrip()) {
    TQ.push([msg, kind]);
    while (TQ.length > 4) { const i = TQ.findIndex(x => !['alert', 'bad', 'mad'].includes(x[1])); TQ.splice(i >= 0 ? i : 0, 1); }   // in a burst, the bad news stays
    toastPump(); return;
  }
  toastShow(msg, kind);
  while (box.children.length > 2) box.firstChild.remove();
}
E.hooks.toast = (m, k, routine) => {
  if (U.scene !== 'game') return;
  const G = g(), msg = U.view === 'map' ? String(m).replace(/ header\b/g, ' sign') : m;
  const filed = inStrip() && !!routine && !!G && !G.train;   // Orientation and lessons show everything: few messages, and each confirms a tap
  msgLog(msg, k, filed);
  if (!filed) { toast(msg, k); return; }
  const pg = pageFor(String(msg)); if (pg) page(pg);
  U.msgNew = (U.msgNew || 0) + 1; msgHint();
};
E.hooks.sound = n => sfx(n);
/* ---------- new arrivals (v0.23) ----------
   Each new patient pops up for a few seconds at the bottom left of the floor, the corner with the door and the bay,
   and goes on the Events list under the bell. Taps go straight through to the floor underneath.
   An alert at the bay already takes the top strip, so it is not shown twice. */
E.hooks.arrive = p => {
  if (U.scene !== 'game') return;
  const ems = p.src === 'ems' || p.loc === 'wall', how = ems ? `${p.unit || 'An ambulance'} at the bay` : 'Walked in';
  msgLog(`New patient: ${p.name}, ${E.ageSex(p)}, ${p.cc}. ${how}.`, 'arr', false);
  if (p.alertOn) return;
  arrPop(p, ems, how);
};
function arrPop(p, ems, how) {
  let box = $('#arrivals');
  if (!box) { box = document.createElement('div'); box.id = 'arrivals'; box.className = 'arrivals'; box.setAttribute('aria-hidden', 'true'); document.body.appendChild(box); }
  const host = $(U.view === 'map' ? '#map' : '#board'), r = host && host.getBoundingClientRect();
  if (!r || !r.width) return;
  box.style.left = (r.left + 8) + 'px'; box.style.bottom = (window.innerHeight - r.bottom + 8) + 'px'; box.style.maxWidth = Math.min(250, r.width - 16) + 'px';
  const el = document.createElement('div');
  el.className = 'arr ' + (ems ? 'k-ems' : 'k-walk');
  el.innerHTML = `${ems ? icoInline('amb', 'act') : icoInline('walkin', 'act')}<span><b>New: ${esc(p.name)}</b>, ${esc(E.ageSex(p))} · ${esc(p.cc)}<small>${esc(how)}</small></span>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3800);
}
function res(r, closeOnOk) { if (!r) return; toast(r.ok ? (r.msg || 'Done') : r.why, r.ok ? 'good' : 'bad'); if (r.ok && closeOnOk) U.sheet = null; }

/* ---------- static board ---------- */
function buildBoard() {
  const b = $('#board'); b.innerHTML = '';
  for (const z of E.ZONES) {
    const sec = document.createElement('section'); sec.className = 'zone z-' + z.id; sec.id = 'zone-' + z.id;
    const h = document.createElement('button'); h.type = 'button'; h.className = 'zh'; h.dataset.act = 'zone'; h.dataset.arg = z.id; h.id = 'zh-' + z.id;
    const grid = document.createElement('div'); grid.className = 'rooms';
    for (const r of E.ROOMS.filter(x => x.z === z.id)) {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'room'; el.dataset.act = 'room'; el.dataset.arg = r.id; el.id = 'room-' + r.id;
      grid.appendChild(el);
    }
    sec.appendChild(h); sec.appendChild(grid); b.appendChild(sec);
  }
}

/* ---------- render ---------- */
/* QA2-4: when a card or a patient sheet opens in a shift, the keyboard's focus goes into it (the sheet only when it was opened from the
   keyboard; a card always, see renderModal), and when it closes the focus goes back to what opened it. Menu sheets keep their own logic. */
function focusMgr() {
  const open = !$('#modalWrap').hidden ? 'modal' : U.scene === 'game' && !$('#sheetWrap').hidden ? 'sheet' : null;
  if (open === U.focOpen) return;
  if (open) {
    const box = open === 'modal' ? $('#modal') : $('#sheetBox'), a = document.activeElement;
    if (!U.focOpen) U.focRet = a && a !== document.body ? a : null;
    if (open === 'sheet' && U.kbd && box && !box.contains(a)) { const f = focusables(box)[0]; if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } }
  } else if (U.focRet && U.focRet.isConnected && !document.querySelector('#modalWrap:not([hidden]), #sheetWrap:not([hidden])')) { try { U.focRet.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } U.focRet = null; }
  U.focOpen = open;
}
function render() {
  const G = g(); if (!G) return;
  U.wide = window.matchMedia('(min-width: 1100px)').matches && U.view !== 'map';   // the floor plan uses the dock at every size
  document.body.classList.toggle('md', MD());
  const brand = document.querySelector('.brand small'), role = MD() ? 'Attending' : 'Charge RN';
  if (brand && brand.textContent !== role) brand.textContent = role;
  document.body.classList.toggle('mapmode', U.view === 'map');
  document.body.classList.toggle('ingame', U.scene === 'game');
  const rails = layoutMode();
  document.body.classList.toggle('rails', rails);
  { const ist = $('#istaff'), want = U.view !== 'map' ? $('#intake') : rails ? $('#railL') : $('#dock');   // in the floor plan, registrars and triage nurses ride in a rail or the dock
    if (ist && want && ist.parentNode !== want) want.insertBefore(ist, want.firstChild); }
  renderHud(G); renderBox(G); renderObjs(G); renderNeed(G); renderSel(G); renderZoneBar(G); renderIntakeStaff(G); renderLanes(G); renderBoard(G); if (U.view === 'map') mapRender(G); renderDock(G); renderSide(G); renderLog(G);
  coachRun();
  renderSheet(G); renderModal(G); focusMgr();
  live(G);
  renderCoach();
  const top = $('#top'); if (top) document.documentElement.style.setProperty('--topH', top.offsetHeight + 'px');
  const dock = $('#dock'), rl = $('#railL'), rs = document.documentElement.style, shown = e => !!e && getComputedStyle(e).display !== 'none';
  rs.setProperty('--dockH', (!rails && shown(dock) ? dock.offsetHeight : 0) + 'px');
  rs.setProperty('--railR', (rails && shown(dock) ? dock.offsetWidth : 0) + 'px');
  rs.setProperty('--railL', (rails && shown(rl) ? rl.offsetWidth : 0) + 'px');
  { const nb = $('#needBtn'); rs.setProperty('--nbW', (U.view === 'map' && nb && !nb.classList.contains('inrail') && shown(nb) ? nb.offsetWidth + 8 : 0) + 'px'); }
  const sb = $('#selbar'); if (sb) rs.setProperty('--selH', (U.view === 'map' && !sb.hidden ? sb.offsetHeight + 8 : 0) + 'px');
  stripLayout();
  const zf = $('#mzFit'); if (zf && U.view === 'map') { const z = mapZoomed(); if (zf.hidden === z) zf.hidden = !z; }
}
/* Side rails on short, wide screens (a phone held sideways); a dock along the bottom otherwise. Whichever leaves the floor bigger. */
function layoutMode() {
  if (U.view !== 'map') return false;
  const W = window.innerWidth, H = window.innerHeight, key = W + 'x' + H + (MD() ? 'm' : 'r');
  if (U.layKey === key) return U.rails;
  const sp = $('#safe'), cs = sp ? getComputedStyle(sp) : null, il = cs ? parseFloat(cs.paddingLeft) || 0 : 0, ir = cs ? parseFloat(cs.paddingRight) || 0 : 0;
  const big = H > 520, top = big ? (W >= 1000 ? 54 : 104) : 40, lw = MD() ? 0 : big ? 86 : 58, rw = big ? 132 : 80, dockH = big ? 76 : 56;
  const sR = Math.min((W - il - ir - lw - rw) / MW, (H - top) / MH), sD = Math.min(W / MW, (H - top - dockH) / MH);
  U.layKey = key; U.rails = sR > sD * (big ? 1.02 : 0.95);   // on a phone, rails unless the dock is clearly better
  const slack = U.rails ? Math.max(0, Math.min(90, W - il - ir - lw - rw - (MW + 14) * sR)) : 0;   // a screen wider than the floor: give the room to the rails
  document.body.style.setProperty('--rlw', (lw + Math.round(slack * (lw ? 0.4 : 0))) + 'px');
  document.body.style.setProperty('--rrw', (rw + Math.round(slack * (lw ? 0.6 : 1))) + 'px');
  return U.rails;
}
const PSHORT = { Patients: 'Pts', Clinical: 'Clin', Diagnoses: 'Dx' };
function pill(id, val, cls, lbl) {
  const el = document.getElementById(id); setC(el, 'pill ' + (cls || ''));
  const b = el.querySelector('b'); if (b.textContent !== val) b.textContent = val;
  const sp = el.querySelector('span'); if (lbl && sp && sp.textContent !== lbl) sp.textContent = lbl;
  if (sp) { const sh = PSHORT[sp.textContent] || sp.textContent; if (sp.dataset.s !== sh) sp.dataset.s = sh; }
}
function renderHud(G) {
  const c = E.clock(); if ($('#clock').textContent !== c) $('#clock').textContent = c;
  const sc = E.scores(), tone = v => (v == null ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad'), pc = v => (v == null ? '—' : v + '%');   // v0.25: four scores, both roles
  if (G.mode === 'md') {   // Phase 6 (R5-03): the attending sees the four scores that grade the attending
    const m = E.mdScores();
    pill('pPat', pc(m.clinical), tone(m.clinical), 'Clinical');
    const dn = (G.stats.md || {}).dxCalled || 0;
    pill('pClin', String(dn), '', 'Diagnoses');   // how many called, not how many right: a live percentage would give each answer away (R5-05)
    pill('pAdm', pc(m.radio), tone(m.radio), 'Radio');
    pill('pStaff', pc(m.legal), tone(m.legal), 'Legal');
  } else {
    pill('pPat', pc(sc.patients), tone(sc.patients), 'Patients');
    pill('pClin', pc(sc.clinical), tone(sc.clinical), 'Clinical');
    pill('pAdm', pc(sc.admin), tone(sc.admin), 'Admin');
    pill('pStaff', pc(sc.staff), tone(sc.staff), 'Staff');
  }
  $('#shiftProg').style.width = Math.min(100, Math.max(0, G.t / G.shift * 100)).toFixed(2) + '%';
  const dv = $('#btnYellow'), on = Object.keys(E.DIVERTS).filter(k => G.dv[k].on);
  setC(dv, 'hb' + (on.some(k => k !== 'yellow') ? ' red' : on.length ? ' on' : '') + (Object.keys(G.out).length && !on.length ? ' alarm' : ''));
  const dt = !on.length ? 'Divert' : on.length === 1 ? E.DIVERTS[on[0]].short : `Divert ×${on.length}`; if (dv.textContent !== dt) dv.textContent = dt;
  const sp = U.speed + '×'; if ($('#btnSpeed').textContent !== sp) $('#btnSpeed').textContent = sp;
  $('#btnPause').classList.toggle('on', !!U.paused);
  const mb = $('#btnMsgs'), mn = $('#msgN');
  if (mb && mn) {
    const show = U.view === 'map', nw = U.msgNew || 0, t = nw ? (nw > 9 ? '9+' : String(nw)) : '';
    if (mb.hidden === show) mb.hidden = !show;
    if (mn.textContent !== t) { mn.textContent = t; mn.style.animation = 'none'; void mn.offsetWidth; mn.style.animation = ''; mb.setAttribute('aria-label', nw ? `Events: ${nw} new` : 'Events'); }
    setC(mb, 'hb hb-msg' + (nw ? ' new' : '') + (U.sheet && U.sheet.type === 'msgs' ? ' on' : ''));
  }
}
function renderBox(G) {
  const el = $('#boxbar'), b = G.box, c = b.cur, hold = b.q.length;
  let cls = 'boxbar', h;
  if (!c) {
    const S = G.stats.boxC, n = S.ans + S.miss;
    h = `<span class="bx-led"></span><span class="bx-name">The Box</span><span class="bx-idle">Quiet${n ? ` · consults answered ${S.ans}/${n}` : ''}${G.mods.survey > G.t ? ' · audit underway' : ''}</span>`;
  } else if (c.kind === 'notify') {
    const p = E.pt(c.pid); cls += ' notify';
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · ${esc(E.ALERTS[p.alert].name)} alert</span><span class="bx-txt">${esc(c.unit)}: ${E.ageSex(p)}, ${esc(p.cc)} · ETA <span data-cd="${p.eta}"></span>${MD() ? ' · charge nurse taking it' : ''}</span><span class="bx-short">${esc(E.ALERTS[p.alert].name)} alert · ETA <span data-cd="${p.eta}"></span></span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}${MD() ? '' : '<button type="button" class="bx-btn" data-act="boxAnswer">Take report</button>'}`;
  } else if (c.taken) {
    cls += ' consult';
    const d = E.staff(c.taken);
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · Medical direction</span><span class="bx-txt">${isMe(d) ? 'You are' : esc(d ? d.name : 'An attending') + ' is'} on the line with ${esc(c.unit)}</span><span class="bx-short">${isMe(d) ? 'You are' : esc(d ? d.short : 'A doctor') + ' is'} on the line</span></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}`;
  } else {
    cls += ' consult';
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · Medical direction</span><span class="bx-txt">${esc(c.unit)} needs ${MD() ? 'you' : 'an attending'} on the line</span><span class="bx-short">${esc(c.unit)} needs ${MD() ? 'you' : 'a doctor'}</span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}<button type="button" class="bx-btn" data-act="boxAnswer">${MD() ? 'Answer' : 'Find a doctor'}</button>`;
  }
  setC(el, cls); setH(el, h);
  document.body.classList.toggle('boxring', !!(c && !c.taken));
  if (c && U.scene === 'game') {
    if (U.ringId !== c.id) { U.ringId = c.id; U.ringT = G.t; }
    else if (G.t - U.ringT > 2 && !isPaused()) { U.ringT = G.t; sfx('ring2'); }
  }
}
const OBJ_LABEL = { wait4: 'VP: waiting room to 6', vip: 'CEO: room the VIP', wall30: 'EMS: no unit on the wall over 30m' };
function renderObjs(G) {
  const t = G.t, it = [];
  for (const o of (MD() ? [] : G.obj)) {   // the charge nurse's goals
    const lbl = o.k === 'nohall' ? (t < o.until ? 'Tracer: clear the hallways' : 'Tracer: keep hallways empty') : OBJ_LABEL[o.k];
    const end = o.k === 'nohall' && t >= o.until ? o.until2 : o.until;
    it.push(`<span class="ob goal"><b>${lbl}</b> · <span data-cd="${end}"></span></span>`);
  }
  if (G.scen && G.scen !== 'none' && E.SCENS[G.scen]) it.push(`<span class="ob scen">Scenario: ${esc(E.SCENS[G.scen].name)}</span>`);
  for (const k of Object.keys(E.DIVERTS)) if (G.dv[k].on) it.push(`<span class="ob ${k === 'yellow' ? 'yellow' : 'red'}">${E.DIVERTS[k].name}</span>`);
  for (const k of Object.keys(G.out)) if (G.out[k].until > t) it.push(`<span class="ob down">${E.OUTAGES[k].short} · <span data-cd="${G.out[k].until}"></span></span>`);
  if (G.mods.lab > t && !G.out.power) it.push(`<span class="ob bad">Lab slow · <span data-cd="${G.mods.lab}"></span></span>`);
  if (G.mods.ehr > t && !G.out.power) it.push(`<span class="ob bad">EHR down · <span data-cd="${G.mods.ehr}"></span></span>`);
  if (G.mods.shortage > t) it.push(`<span class="ob bad">Drug shortage · <span data-cd="${G.mods.shortage}"></span></span>`);
  if (G.mods.bbSlow > t) it.push(`<span class="ob bad">Blood bank slow · <span data-cd="${G.mods.bbSlow}"></span></span>`);
  if (G.mods.interpDown > t) it.push(`<span class="ob bad">Interpreter line down · <span data-cd="${G.mods.interpDown}"></span></span>`);
  if (!G.staff.some(s => s.role === 'rph' && s.st === 'on')) it.push(`<span class="ob bad">${G.mods.remoteRph ? 'Remote pharmacy only' : 'No pharmacist'}</span>`);
  for (const h of G.region.hosps) if (h.st !== 'open') it.push(`<span class="ob warn">${esc(h.name)} on ED Full</span>`);
  if (G.region.susp > t) it.push(`<span class="ob bad">Region: no capacity alerts · <span data-cd="${G.region.susp}"></span></span>`);
  if (G.mods.noReport > t) it.push(`<span class="ob bad">Floors not taking report · <span data-cd="${G.mods.noReport}"></span></span>`);
  if (G.obsUnit.filled >= G.obsUnit.cap) it.push('<span class="ob warn">Obs unit full</span>');
  if (G.mode === 'md' && !G.train) { const L = Math.round(G.lit || 0); it.push(`<span class="ob ${L >= 50 ? 'bad' : L >= 25 ? 'warn' : 'acc'}">Legal risk ${L}%${L >= 50 ? ' · PIP' : L >= 40 ? ' · peer review' : ''}</span>`); }
  if (G.beds) { const full = G.beds.icu.used >= E.UNITS.icu.cap, w = E.bedWait('icu'); it.push(`<button type="button" class="ob ${full ? 'warn' : 'beds'}" data-act="bedsOpen">Beds: ICU ${G.beds.icu.used}/${E.UNITS.icu.cap}${w ? ` · ${w} waiting` : ''}</button>`); }
  if (U.view === 'map' && E.active().some(p => p.iftLevel === 'air' && ((p.dsp === 'iftwait' && p.due - t <= 3 && !p.airAbort) || p.dsp === 'iftreport'))) it.push('<button type="button" class="ob heli" data-act="watchPad">Helicopter on the pad · watch</button>');
  if (G.wx && G.wx !== 'clear') it.push(`<span class="ob wx">${esc(E.WX[G.wx].name)}${E.wxGrounded() ? ' · no flights' : ''}</span>`);
  else if (E.wxGrounded()) it.push('<span class="ob wx">No flights: weather</span>');
  if (G.mods.survey > t) it.push(`<span class="ob warn">Box audit · <span data-cd="${G.mods.survey}"></span></span>`);
  const el = $('#objs'); setH(el, it.join('')); el.hidden = !it.length;
}
function selOk() {
  const s = U.sel; if (!s) return false;
  if (s.type === 'prov') { const st = E.staff(s.sid); return !!st && E.present(st) && !st.pit; }
  if (s.type === 'reg' || s.type === 'tri') { const st = E.staff(s.sid); return !!st && st.st === 'on'; }
  const p = E.pt(s.pid); if (!p) return false;
  return s.type === 'pt' ? ['wall', 'waiting', 'triage'].includes(p.loc) : p.loc === 'room';
}
function renderSel(G) {
  if (U.sel && !selOk()) U.sel = null;
  const s = U.sel, el = $('#selbar'); let h = '';
  if (s && s.type === 'prov') {
    const st = E.staff(s.sid);
    h = `<span><b>${esc(st.name)}</b>${U.view === 'map' ? ': tap who to see.' : ' selected. Tap patients who need a provider.'}</span><button type="button" data-act="selInfo">Queue</button><button type="button" data-act="selCancel">Done</button>`;
  } else if (s && (s.type === 'reg' || s.type === 'tri')) {
    const st = E.staff(s.sid);
    const fp = U.view === 'map';
    h = `<span><b>${esc(st.name)}</b> ${s.type === 'reg' ? (fp ? 'registers: tap the door, the wall, or a room.' : 'is registering. Tap patients who need it: a quick registration at the door, the full one at the bedside.') : fp ? 'triages: tap the door or a crew on the wall.' : 'is triaging. Tap patients at the door who need triage.'}</span><button type="button" data-act="selCancel">Done</button>`;
  } else if (s) {
    const p = E.pt(s.pid);
    const wr = s.type === 'pt' && p.loc === 'wall' && ve(p) >= 3 && !p.alertOn && intakeDone(p);
    let why = s.why || '';
    if (!why) { const open = G.rooms.filter(r => r.kind !== 'chair' && !r.pid && !r.closed && r.st === 'clean'); if (open.length && !open.some(r => E.canPlace(p, r).ok)) why = E.canPlace(p, open[0]).why; }
    h = `<span>${s.type === 'move' ? 'Moving' : 'Bedding'} ${U.view === 'map' ? '' : emoji(p) + ' '}<b>${esc(p.name)}</b>${U.view === 'map' ? '' : `, ${E.ageSex(p)}`} ${esiChip(p)}${U.view === 'map' ? ':' : ' ' + esc(p.cc) + '.'} ${why ? `<b class="sel-why">${esc(why)}.</b>` : `${U.view === 'map' ? 'tap' : 'Tap'} a green room.`}</span>${wr ? `<button type="button" data-act="toWait" data-arg="${p.id}">Waiting room</button>` : ''}<button type="button" data-act="selInfo">Card</button><button type="button" data-act="selCancel">Cancel</button>`;
  }
  setH(el, h); el.hidden = !h;
  document.body.classList.toggle('selon', !!h);
}
function renderIntakeStaff(G) {
  const sel = (t, id) => U.sel && U.sel.type === t && U.sel.sid === id;
  const chip = (s, t) => {
    const n = t === 'reg' ? s.q.length + (s.task ? 1 : 0) : s.tq.length + (s.task && s.task.kind === 'triage' ? 1 : 0);
    const off = s.st !== 'on';
    return `<button type="button" class="ic ${t}${sel(t, s.id) ? ' sel' : ''}${off ? ' off' : ''}" data-act="${t}Sel" data-arg="${s.id}" ${off ? 'disabled' : ''}><b>${esc(s.short)}</b><small>${off ? stLabel(s) : n ? n + ' in line' : 'Free'}</small></button>`;
  };
  const regs = G.staff.filter(s => s.role === 'reg' && !['off', 'sick', 'gone'].includes(s.st));
  const tris = G.staff.filter(s => s.role === 'rn' && s.zones.includes('triage') && !['off', 'sick', 'gone'].includes(s.st));
  const ucs = G.staff.filter(s => s.role === 'uc' && !['off', 'sick', 'gone'].includes(s.st));   // v0.25: the unit secretary: tap for the clerical work
  const open = E.clerkOpen().length;
  const ucChip = s => { const n = s.q.length + (s.task ? 1 : 0), off = s.st !== 'on'; return `<button type="button" class="ic uc${U.sheet && U.sheet.type === 'uc' ? ' sel' : ''}${off ? ' off' : ''}${open && !off ? ' need' : ''}" data-act="ucOpen" data-arg="${s.id}"><b>${esc(s.short)}</b><small>${off ? stLabel(s) : n ? 'Busy' : open ? `${open} to do` : 'Free'}</small></button>`; };
  morph($('#istaff'), `<span class="ic-l">Register</span>${regs.map(s => chip(s, 'reg')).join('') || '<span class="ic-l">nobody</span>'}<span class="ic-l">Triage</span>${tris.map(s => chip(s, 'tri')).join('') || '<button type="button" class="ic tri off" data-act="zone" data-arg="triage"><b>No triage RN</b><small>Tap to assign</small></button>'}${ucs.length ? '<span class="ic-l">Clerk</span>' + ucs.map(ucChip).join('') : ''}`);
}
function roomNeeds(p, r, G) { const n = nextStep(p, r, G); return /n-act|n-bad|n-code|n-go fl/.test(n.c); }
function renderZoneBar(G) {
  const act = E.active();
  const wall = act.filter(p => p.loc === 'wall').length, wait = act.filter(p => p.loc === 'waiting' || p.loc === 'triage').length;
  let h = `<button type="button" class="zc${wall ? ' warn' : ''}" data-act="jump" data-arg="intake">EMS ${wall}</button><button type="button" class="zc${wait > 6 ? ' warn' : ''}" data-act="jump" data-arg="intake" aria-label="${wait} in the waiting room">Lobby ${wait}</button>`;   // R4-05: says what it counts
  for (const z of E.ZONES) {
    const ns = E.zoneNurses(z.id), load = E.zoneLoad(z.id, hasHold()), cap = ns.length * 4, n = E.zonePts(z.id);
    const st = !ns.length ? (n ? 'none' : 'empty') : load > cap ? 'over' : 'ok';
    let need = 0; for (const r of G.rooms) if (r.z === z.id && r.pid && roomNeeds(E.pt(r.pid), r, G)) need++;
    h += `<button type="button" class="zc zs-${st}" data-act="jump" data-arg="${z.id}">${ZSHORT[z.id]}${need ? `<i>${need}</i>` : ''}</button>`;
  }
  setH($('#zbar'), h);
}
function magHTML(p) {
  if (p.loc === 'enroute') return `<span class="m-txt"><i class="atag a-${p.alert}">${esc(E.ALERTS[p.alert].name)}</i>${tagChip(p)} <b class="pn">${esc(p.name)}</b> <b>${E.ageSex(p)}</b><br>${esc(p.cc)}</span><span class="m-t">ETA <span data-cd="${p.eta}"></span></span>`;
  let sub = esc(p.cc);
  if ((p.loc === 'wall' || p.loc === 'triage') && !intakeDone(p)) sub = `${esc(p.cc)}<br>${intakeChips(p)}`;
  else if (p.loc === 'wall') sub = `${esc(p.cc)}<br><i class="ist done">READY FOR A BED</i>`;
  if (p.loc === 'waiting' && p.pitSeen) sub = `<span class="tags">${tagsHTML(p)}</span>${E.pitDcReady(p) ? '<i class="pitok">Ready to go</i>' : ''}`;
  return `${esiChip(p)}<span class="m-em">${emoji(p)}</span><span class="m-txt"><b class="pn">${esc(p.name)}</b> <b>${E.ageSex(p)}</b> ${alertTag(p)}${tagChip(p)}${langChip(p)}${p.ret ? '<i class="rettag">Return</i>' : ''}${p.vip ? '<i class="vip">VIP</i>' : ''}${p.crash ? '<i class="crash">Crashing</i>' : ''}${p.bleed === 'mtp' && !p.bb ? '<i class="crash">Bleeding</i>' : ''}<br>${sub}</span><span class="m-t" data-el="${p.tArrive}"></span>`;
}
function magCls(p, G) {
  let c = 'mag';
  if (p.loc === 'enroute') c += ' ghost';
  if (p.loc === 'triage') c += ' tri';
  if (p.pitSeen) c += ' pit';
  if ((p.loc === 'wall' && G.t - p.tArrive > 30) || (p.loc === 'waiting' && G.t - p.tArrive > 90)) c += ' late';
  if (U.sel && U.sel.type === 'pt' && U.sel.pid === p.id) c += ' sel';
  if (U.sel && U.sel.type === 'reg') c += regable(p) ? ' ok' : ' no';
  if (U.sel && U.sel.type === 'tri') c += p.tri === 'none' && (p.loc === 'wall' || p.loc === 'triage') ? ' ok' : ' no';
  if (p.loc === 'wall' && intakeDone(p)) c += ' ready';
  if (p.crash || p.arrest || p.shock) c += ' crit';
  return c;
}
function syncList(box, items, G) {
  const map = box._m || (box._m = new Map()), seen = new Set();
  let prev = null;
  for (const p of items) {
    seen.add(p.id);
    let el = map.get(p.id);
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.dataset.act = 'pt'; el.dataset.arg = p.id; map.set(p.id, el); }
    setC(el, magCls(p, G)); setH(el, magHTML(p));
    el.setAttribute('aria-label', `${E.ageSex(p)}, ${p.cc}`);
    const want = prev ? prev.nextSibling : box.firstChild;
    if (want !== el) box.insertBefore(el, want);
    prev = el;
  }
  for (const [k, el] of map) if (!seen.has(k)) { el.remove(); map.delete(k); }
}
function renderLanes(G) {
  const act = E.active();
  const wall = act.filter(p => p.loc === 'wall').sort((a, b) => ve(a) - ve(b) || a.tArrive - b.tArrive);
  syncList($('#laneEms'), wall.concat(G.enroute.map(E.pt)), G);
  const waiting = act.filter(p => p.loc === 'waiting').sort((a, b) => ve(a) - ve(b) || a.tArrive - b.tArrive);
  syncList($('#laneWait'), waiting.concat(G.triageQ.map(E.pt).filter(Boolean)), G);
  const mw = E.maxWallNow();
  const rep = wall.filter(p => p.tri !== 'done').length;
  const ei = $('#emsInfo'); setH(ei, `${wall.length ? `${wall.length} on the wall${rep ? ` · ${rep} waiting to give report` : ''} · longest ${fm(mw)}` : 'Clear'}${G.enroute.length ? ` · ${G.enroute.length} inbound` : ''}`); setC(ei, 'lane-i' + (mw > 30 ? ' bad' : ''));
  const tri = E.zoneNurses('triage').length, pit = G.staff.find(s => s.pit && E.present(s));
  const quiet = waiting.some(p => G.t - Math.max(p.tTriage != null ? p.tTriage : (p.tArrive || 0), p.lastUpdate != null ? p.lastUpdate : -1e9, G.wrUpdate) >= 60);
  const wi = $('#waitInfo'); setH(wi, `${waiting.length} in the waiting room · ${G.triageQ.length} at the door${tri ? '' : ' · no triage nurse'}${pit ? ` · ${esc(pit.short)} in triage` : ''}${quiet ? ' · no update in an hour' : ''}`); setC(wi, 'lane-i' + (!tri || quiet ? ' bad' : ''));
}
function treatReason(p) {
  const ks = Object.keys(p.treat).filter(k => p.treat[k].st !== 'done');
  if (ks.some(k => p.treat[k].st === 'verify')) return 'Waiting on pharmacy';
  if (ks.some(k => E.TREAT[k].by === 'rt' && p.treat[k].st === 'todo')) return 'Waiting on RT';
  if (ks.includes('blood') && p.treat.blood.st === 'wait') return !p.bb ? 'Labs, then crossmatch' : p.bb.st === 'xm' ? 'Crossmatching blood' : 'O-neg on the way';
  if (ks.includes('mtp') && p.treat.mtp.st === 'wait') return 'MTP cooler coming';
  if (ks.includes('tnk') && p.treat.tnk.st === 'wait' && p.consult.st === 'here' && p.work.ct && p.work.ct.st === 'done' && !E.bpOkForLytic(p)) return p.treat.bp ? 'Lowering the pressure' : 'Pressure too high for the drug';
  return 'Treatment underway';
}
const LEAVING = ['dc', 'dcing', 'toproc', 'iftwait', 'iftreport', 'xportq', 'family', 'morgue', 'morguing'];
/* How long the attending's own exam or code has left, in game minutes. */
function myLeft(p) { const me = E.staff(g().me), k = me && me.q[0]; return k && k.started && k.pid === p.id ? Math.max(1, Math.ceil(k.left / E.provSpeed(me))) : 0; }
/* What a room needs next: t = words, c = tone, i = the icon the floor plan shows. */
function nextStep(p, r, G) {
  const pv = p.prov ? E.staff(p.prov) : null, nm = pv ? (isMe(pv) ? 'You' : esc(pv.short)) : '';
  if (mine(p) && !p.arrest) {
    if (p.ev === 'q') return { t: 'In your line', c: 'n-wait', i: 'steth' };
    if (p.ev === 'doing') { const n = myLeft(p); return { t: 'You’re in the room' + (n ? ` · ${n} min left` : ''), c: 'n-wait', i: 'steth' }; }
    if (p.ord === 'need') return { t: 'Write orders', c: 'n-act fl', i: 'orders' };
    if (p.ord === 'more') return { t: 'Add to the workup', c: 'n-act fl', i: 'orders' };
    if (p.dxq) return { t: 'Name the diagnosis', c: 'n-act fl', i: 'decide' };   // v0.28.1: on the map and in Next
    if (p.dsp === 'mddecide' || p.dsp === 'decide') return { t: 'Your call', c: 'n-act fl', i: 'decide' };
    if (p.txGap && p.txGap.length && !LEAVING.includes(p.dsp)) return { t: E.vitalsOf(p).trend === 'better' ? 'Missing an order' : 'Not improving', c: 'n-bad fl', i: 'alert' };
  }
  if (p.arrest) return p.ev === 'doing' ? { t: 'Code in progress', c: 'n-code', i: 'code' } : p.ev === 'q' ? { t: 'Code: ' + nm, c: 'n-code', i: 'code' } : { t: MD() ? 'CODE: run it' : 'CODE: send an MD', c: 'n-code fl', i: 'code' };
  if (p.bleed === 'mtp' && !p.bb && p.dsp === 'none') return { t: p.shock ? 'SHOCK: activate MTP' : 'Bleeding: activate MTP', c: 'n-bad fl', i: 'blood' };
  if (!E.zoneNurses(r.z).length && !(E.isBoarder(p) && hasHold())) return { t: 'No nurse!', c: 'n-bad fl', i: 'nurse' };
  if (p.sitter && !r.safe && !p.sitBy) return { t: 'Needs a sitter', c: 'n-bad fl', i: 'eye' };
  switch (p.dsp) {
    case 'ready': return { t: 'Ready: discharge', c: 'n-go fl', i: 'home' };
    case 'watch': return { t: `Watch until ${E.clock(p.due)}`, c: 'n-wait', i: 'wait' };
    case 'dc': case 'dcing': return { t: 'Discharge teaching', c: 'n-go', i: 'home' };
    case 'rehab': { const t = (G.clerk || []).find(x => x.k === 'ride' && x.pid === p.id); return t && t.by ? { t: 'Ride to rehab: calling', c: 'n-wait', i: 'phone' } : { t: 'Rehab: call the ride', c: 'n-act fl', i: 'phone' }; }
    case 'rideeta': return { t: `Ride to rehab <span data-cd="${p.due}"></span>`, c: 'n-wait', i: 'amb' };
    case 'ridehere': return { t: 'Rehab crew here', c: 'n-go', i: 'amb' };
    case 'readytx': return MD() && !mine(p) ? { t: 'Transfer: charge nurse', c: 'n-wait', i: 'amb' } : { t: 'Transfer: find a hospital', c: 'n-act fl', i: 'amb' };
    case 'txcall': { const H = E.HOSPS.find(h => h.k === p.txHosp); return { t: `Calling ${H ? esc(H.short) : 'transfer'}…`, c: 'n-wait', i: 'phone' }; }
    case 'decide': return { t: `${esc(p.gray.short || 'Risk')} ${p.gray.score}: your call`, c: 'n-act fl', i: 'decide' };
    case 'board': return p.obsWait ? { t: 'Obs unit full', c: 'n-board', i: 'bed' } : p.bedU && !p.bedGot ? { t: `Waiting: ${E.UNITS[p.bedU].name} bed`, c: 'n-board', i: 'bed' } : { t: `${p.dispo === 'obs' ? 'Obs' : 'Admitted'} · bed <span data-cd="${p.due}"></span>`, c: 'n-board', i: 'bed' };
    case 'callrep': return { t: G.mods.noReport > G.t ? 'Floor won\'t take report' : 'Bed ready: nurse calls report', c: 'n-board', i: 'talk' };
    case 'reporting': return { t: 'Calling report', c: 'n-board', i: 'talk' };
    case 'bedready': return { t: 'Bed ready: send up', c: 'n-act fl', i: 'up' };
    case 'xportq': { const s = E.staff(p.xBy); return { t: `${s ? esc(s.short) : 'Transport'} taking them up`, c: 'n-board', i: 'up' }; }
    case 'txok': return MD() && !mine(p) ? { t: 'Accepted: booking', c: 'n-wait', i: 'amb' } : { t: 'Accepted: pick transport', c: 'n-act fl', i: 'amb' };
    case 'iftwait': return { t: `${E.IFT[p.iftLevel].short} crew <span data-cd="${p.due}"></span>`, c: 'n-wait', i: 'amb' };
    case 'iftreport': return p.crewWait != null && !E.treatsDone(p) ? { t: 'Crew waiting on treatment', c: 'n-warn', i: 'amb' } : p.iftRep == null && MD() && mine(p) ? { t: 'Crew here: give report', c: 'n-act fl', i: 'talk' } : { t: p.iftRep == null ? 'Crew taking report' : 'Crew packaging', c: 'n-wait', i: 'amb' };
    case 'toproc': return { t: p.dispo === 'cath' ? 'To the cath lab' : 'To the OR', c: 'n-go', i: 'up' };
    case 'family': return { t: 'Family at bedside', c: 'n-wait', i: 'heart' };
    case 'morgue': case 'morguing': return { t: 'Morgue transport', c: 'n-wait', i: 'wait' };
  }
  if (E.needsProv(p)) return p.ev === 'none' ? { t: `Needs a provider · <span data-el="${p.tNeed != null ? Math.max(p.tNeed, p.tRoom) : p.tRoom}"></span>`, c: 'n-act fl', i: 'steth' } : { t: 'Needs a provider (recheck)', c: 'n-act fl', i: 'steth' };
  if (p.reg !== 'done') return p.reg === 'none' ? { t: 'Needs registration', c: 'n-act fl', i: 'card' } : p.reg === 'quick' ? { t: 'Needs full registration', c: 'n-warn', i: 'card' } : { t: 'Registering', c: 'n-wait', i: 'card' };
  if (p.ev === 'q') { const i = pv ? pv.q.findIndex(k => k.pid === p.id) : -1; return { t: `${nm} · ${i >= 0 ? '#' + (i + 1) + ' in line' : 'queued'}`, c: 'n-wait', i: 'steth' }; }
  if (p.ev === 'doing') return { t: `${nm} in the room`, c: 'n-wait', i: 'steth' };
  if (p.con && p.consult.st === 'none' && p.dxK) return { t: 'Call a consult', c: 'n-act fl', i: 'phone' };
  if (p.consult.st === 'req') return { t: `${E.SPECS[p.consult.spec].short} <span data-cd="${p.consult.due}"></span>`, c: 'n-wait', i: 'phone' };
  if (E.con2Open(p)) return MD() && !mine(p) ? { t: 'Second consult: charge nurse', c: 'n-wait', i: 'phone' } : { t: 'Call a 2nd consult', c: 'n-act fl', i: 'phone' };
  if (p.consult2 && p.consult2.st === 'req') return { t: `${E.SPECS[p.consult2.spec].short} <span data-cd="${p.consult2.due}"></span>`, c: 'n-wait', i: 'phone' };
  if (p.re === 'q' || p.re === 'doing') return { t: `${nm} rechecking`, c: 'n-wait', i: 'steth' };
  if (p.cosign === 'need' || p.cosign === 'wait') return { t: 'Attending co-sign', c: 'n-wait', i: 'pen' };
  { const Gi = E.G.img, sc = ['ct', 'xr', 'mri'].find(m => Gi[m] && Gi[m].busy && Gi[m].busy.pid === p.id); if (sc) return { t: `At ${sc === 'xr' ? 'X-ray' : sc.toUpperCase()}`, c: 'n-wait', i: 'flask' }; }   // v0.26: away for a scan
  if (!p.dxK || (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done'))) return { t: 'Workup pending', c: 'n-wait', i: 'flask' };
  if (!E.treatsDone(p)) { const why = treatReason(p); return { t: why, c: /pharmacy|RT|Pressure too high/.test(why) ? 'n-warn' : 'n-wait', i: 'pill' }; }
  return { t: 'Wrapping up', c: 'n-wait', i: 'wait' };
}
function tagsHTML(p) {
  const keys = p.wk.slice(); if (p.work.ecg && !keys.includes('ecg')) keys.unshift('ecg');
  const out = keys.map(k => { const w = p.work[k]; const s = !w ? 'pend' : w.st === 'todo' ? 'todo' : w.st === 'done' ? 'done' : 'run'; return `<i class="tg ${s}">${E.WORK[k].label}</i>`; });
  if (p.lang && p.loc === 'room') out.unshift(`<i class="tg ${p.interp === 'on' ? 'lgo' : p.interp === 'req' ? 'lgr' : 'lgx'}" title="${esc(E.LANGS[p.lang])}">${p.lang.toUpperCase()}</i>`);
  const grp = (pred, lbl) => {
    const ks = p.tr.filter(pred); if (!ks.length) return;
    const its = ks.map(k => p.treat[k]);
    const s = its.every(i => i && i.st === 'done') ? 'done' : its.some(i => i && i.st === 'verify') ? 'ver' : its.some(i => i && i.st !== 'wait') ? 'run' : 'pend';
    out.push(`<i class="tg ${s}">${lbl}</i>`);
  };
  grp(k => E.TREAT[k].by === 'rn' && k !== 'blood' && k !== 'mtp', 'RX');
  grp(k => E.TREAT[k].by === 'rt', 'RT');
  if (p.bleed) {
    const k = p.bleed === 'mtp' ? 'mtp' : 'blood', it = p.treat[k];
    const s = it && it.st === 'done' ? 'done' : p.bleed === 'mtp' && !p.bb ? 'need' : p.bb ? 'run' : 'pend';
    out.push(`<i class="tg ${s}">${p.bleed === 'mtp' ? 'MTP' : 'BLOOD'}</i>`);
  }
  return out.join('');
}
function roomHTML(r, p, G) {
  const tag = r.iso ? '<i class="rt">ISO</i>' : r.safe ? '<i class="rt">Safe</i>' : '';
  if (!p) {
    if (r.closed) return `<span class="rtop"><span class="rid">${r.id}</span>${tag}</span><span class="rs">Closed</span>`;
    if (r.st === 'clean') return `<span class="rtop"><span class="rid">${r.id}</span>${tag}</span><span class="rs">Clean</span>`;
    if (r.st === 'dirty') { const i = G.evsQ.indexOf(r.id); return `<span class="rtop"><span class="rid">${r.id}</span>${tag}</span><span class="rs">${r.dirt === 'term' ? 'Terminal clean' : 'Dirty'}</span><span class="rh">${i === 0 ? 'EVS is next' : i > 0 ? 'EVS line #' + (i + 1) + ' · tap to rush' : 'Tap to send EVS'}</span>`; }
    const s = G.staff.find(x => x.task && x.task.kind === 'clean' && x.task.room === r.id);
    return `<span class="rtop"><span class="rid">${r.id}</span>${tag}</span><span class="rs">Cleaning${s ? ' · ' + esc(s.short) : ''}</span>${s ? `<i class="pb"><i data-fill="${s.task.t0},${s.task.t0 + s.task.dur}"></i></i>` : ''}`;
  }
  const nx = nextStep(p, r, G), pv = p.prov ? E.staff(p.prov) : null;
  return `<span class="rtop"><span class="rid">${r.id}</span>${p.alertOn ? alertTag(p) : tag}${esiChip(p)}</span>`
    + `<span class="who${pv ? ' pv-on' : ''}"><span class="em">${emoji(p)}</span> <b class="pn">${esc(p.name)}</b> ${E.ageSex(p)}${p.tag ? ' ' + tagChip(p) : ''}${p.ret ? ' <i class="rettag">Ret</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}${pv ? `<i class="pv ${RC[pv.role]}${isMe(pv) ? ' me' : ''}">${isMe(pv) ? 'YOU' : esc(pv.short.slice(0, 3))}</i>` : ''}</span>`
    + `<span class="cc${dxShown(p) ? ' dx' : ''}">${esc(dxOr(p))}</span>`
    + `<span class="tags">${tagsHTML(p)}</span>`
    + `<span class="nx ${nx.c}">${nx.t}</span>`;
}
function renderBoard(G) {
  const sel = U.sel, selP = sel && sel.pid ? E.pt(sel.pid) : null, selS = sel && sel.type === 'prov' ? E.staff(sel.sid) : null;
  for (const z of E.ZONES) {
    const h = document.getElementById('zh-' + z.id);
    const ns = E.zoneNurses(z.id), load = E.zoneLoad(z.id, hasHold()), cap = ns.length * 4, n = E.zonePts(z.id);
    const closed = G.rooms.some(r => r.z === z.id && r.closed);
    const st = !ns.length ? (n ? 'none' : 'empty') : load > cap ? 'over' : load === cap ? 'full' : 'ok';
    setC(h, 'zh zs-' + st);
    const shut = z.id === 'ft' && closed && G.t < 120 ? 'Opens 09:00' : 'Closed';
    setH(h, `<span class="zn">${z.name}</span><span class="zr">${ns.length ? 'RN ' + ns.map(s => esc(s.short)).join(' + ') + ` · <b>${fl(load)}/${cap}</b>` : closed ? shut : n ? 'No nurse. Tap to assign' : 'No nurse'}</span>`);
    h.setAttribute('aria-label', `${z.name} nurses`);
  }
  for (const r of G.rooms) {
    const el = document.getElementById('room-' + r.id), p = r.pid ? E.pt(r.pid) : null;
    let cls = 'room';
    if (!p) cls += ' st-' + (r.closed ? 'closed' : r.st);
    else cls += ' st-occ e' + ve(p) + (p.crash || p.arrest || p.shock || (p.bleed === 'mtp' && !p.bb) ? ' crit' : '');
    if (r.kind === 'chair') cls += ' chair';
    if (sel && (sel.type === 'pt' || sel.type === 'move') && selP) cls += E.canPlace(selP, r).ok ? ' ok' : ' no';
    else if (sel && sel.type === 'reg') cls += (p && regable(p)) ? ' ok' : ' no';
    else if (sel && sel.type === 'tri') cls += ' no';
    else if (selS) cls += (p && E.needsProv(p) && E.canAssign(selS, p).ok) ? ' ok' : ' no';
    setC(el, cls); setH(el, roomHTML(r, p, G));
    el.setAttribute('aria-label', p ? `${E.roomName(r.id)}: ${E.ageSex(p)}, ${dxOr(p)}` : `${E.roomName(r.id)}: ${r.closed ? 'closed' : r.st}`);
  }
}
function taskLabel(k) {
  if (k.type === 'box') return 'On the Box';
  const p = E.pt(k.pid);
  return ({ eval: 'Eval', reassess: 'Recheck', proc: k.key === 'intub' ? 'Intubation' : 'Procedure', code: 'CODE', pit: 'Triage exam', pitdc: 'Triage discharge', talk: 'AMA talk', cosign: 'Co-sign' }[k.type] || k.type) + (p && p.room ? ' ' + p.room : '');
}
function provMagnets(box, G) {
  const list = G.staff.filter(s => E.isProv(s) && !['off', 'sick', 'gone', 'pending'].includes(s.st));
  const map = box._m || (box._m = new Map()), seen = new Set();
  let prev = null;
  for (const s of list) {
    seen.add(s.id);
    let el = map.get(s.id);
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.dataset.act = 'prov'; el.dataset.arg = s.id; map.set(s.id, el); }
    const k = s.q[0];
    const task = s.st !== 'on' ? stLabel(s) : k ? taskLabel(k) : s.pit ? 'In triage' : 'Free';
    setC(el, `pm ${RC[s.role]}${s.st !== 'on' ? ' off' : ''}${s.pit ? ' pit' : ''}${U.sel && U.sel.type === 'prov' && U.sel.sid === s.id ? ' sel' : ''}${k && k.type === 'box' ? ' onbox' : ''}`);
    const waiting = s.q.filter(k => !k.started && k.type !== 'box').length;
    setH(el, `<span class="pm-n">${isMe(s) ? 'You' : esc(s.short)}</span><span class="pm-t">${esc(task)}</span>${s.q.length > 1 ? `<span class="pm-q${waiting >= 3 ? ' err' : ''}">+${s.q.length - 1}</span>` : ''}`);
    el.setAttribute('aria-label', `${s.name} (${s.title}): ${task}`);
    const want = prev ? prev.nextSibling : box.firstChild;
    if (want !== el) box.insertBefore(el, want);
    prev = el;
  }
  for (const [id, el] of map) if (!seen.has(id)) { el.remove(); map.delete(id); }
}
function renderDock(G) {
  if (U.wide) return;
  provMagnets($('#dockProv'), G);
  const on = r => G.staff.filter(s => s.role === r && s.st === 'on');
  const pct = on('pct'), evs = on('evs');
  setH($('#dockTeam'), `Team<small>PCT ${pct.filter(s => !s.task).length}/${pct.length}</small><small>EVS ${evs.filter(s => !s.task).length}/${evs.length}</small>`);
}
function renderSide(G) {
  const side = $('#side');
  if (!U.wide) { if (side._built) { side.innerHTML = ''; side._h = ''; side._built = false; } return; }
  const sideKey = MD() ? 'md' : 'rn';
  if (!side._built || side._built !== sideKey) { side.innerHTML = `<h4>${MD() ? 'Providers on now' : 'Providers · tap one, then tap patients'}</h4><div class="dock-prov" id="sideProv"></div><div id="sideTeam"></div>`; side._built = sideKey; }
  provMagnets($('#sideProv'), G);
  morph($('#sideTeam'), teamHTML(G));
}
function renderLog(G) {
  const items = G.log.slice(0, 8).map(l => `<li class="k-${l.kind}"><time>${E.clock(l.t)}</time><span>${esc(l.msg)}</span></li>`).join('');
  setH($('#log'), items || '<li>Nothing yet.</li>');
}

/* ---------- sheets ---------- */
function where(p) {
  if (p.loc === 'room') return E.roomName(p.room);
  return { wall: 'On the wall (EMS stretcher)', waiting: p.pitSeen ? 'Waiting room (seen in triage)' : 'Waiting room', triage: 'Triage line', enroute: 'En route', gone: 'Gone' }[p.loc] || p.loc;
}
/* Vitals now, with the abnormal ones in red and which way they are heading. */
function vitalsHTML(p) {
  const v = E.vitalsOf(p);
  if (v.arrest) return `<span class="vv vbad"><b>${esc(v.text)}</b></span>`;
  if (!v.taken) return `<span class="vna">${esc(v.text)}</span>`;
  const f = v.flags, it = (l, val, bad) => `<span class="vv${bad ? ' vbad' : ''}">${l} <b>${val}</b></span>`;
  const why = whyNot(p), flat = v.trend === 'steady' && v.red && !!why && !v.ems;
  return it('HR', v.hr, f.hr) + it('BP', `${v.sbp}/${v.dbp}`, f.bp) + it('RR', v.rr, f.rr) + it('SpO2', v.spo2 + '%', f.spo2) + it('Temp', v.temp.toFixed(1) + '°F', f.temp)
    + (v.signs.length ? `<span class="vv">${esc(v.signs.join(', '))}</span>` : '')
    + `<i class="vtrend v-${flat ? 'flat' : v.trend}">${v.trend === 'worse' ? '▼ Getting worse' + (why ? ' · ' + why : '') : v.trend === 'better' ? '▲ Improving' : v.ems ? 'From the EMS report' : flat ? 'Not improving · ' + why : 'Steady'}</i>`;
}
/* Why the numbers are not getting better: the next thing that has not happened yet. */
function whyNot(p) {
  if (p.loc === 'wall' || p.loc === 'waiting' || p.loc === 'triage') return 'no bed yet';
  if (p.loc !== 'room') return '';
  if (!p.prov) return 'no provider yet';
  if (p.ev !== 'done') return 'not examined yet';
  if (p.ord === 'need' || p.ord === 'more') return 'waiting on orders';
  if ((p.tr || []).some(k => !(p.treat[k] && p.treat[k].st === 'done'))) return 'treatment not given yet';
  return '';
}
function provButtons(p, G) {
  return G.staff.filter(s => E.isProv(s) && E.present(s)).map(s => {
    const c = E.canAssign(s, p);
    return `<button type="button" class="pbtn ${RC[s.role]}" data-act="assign" data-arg="${s.id}" ${c.ok ? '' : 'disabled'}><b>${esc(s.short)} · ${s.title}</b><small>${s.pit ? 'In triage · ' : s.st !== 'on' ? stLabel(s) + ' · ' : ''}<span data-ql="${s.id}"></span></small></button>`;
  }).join('') + (ve(p) <= 2 ? `<p class="hint" style="grid-column:1/-1;margin:0">${ve(p) === 1 ? 'ESI 1 needs an attending.' : 'A PA or NP can take ESI 2. An attending co-signs before the patient leaves.'}${p.tr.some(k => E.TREAT[k].md) ? ' Intubation needs an attending.' : ''}</p>` : '');
}
function dispoText(p) {
  if (p.dsp === 'decide') return `Your call: home, observation, or admit (${esc(p.gray.tool)} ${p.gray.score})`;
  if (p.dsp === 'board' && p.obsWait) return 'Going to observation. The obs unit is full; next obs discharge frees a bed.';
  if (p.dsp === 'mddecide') return 'Your call: discharge, admit, or transfer';
  const m = { callrep: G0().mods.noReport > G0().t ? 'Bed assigned. The floor is in shift change and won\'t take report yet.' : 'Bed assigned. Their nurse is calling report to the floor.', reporting: 'Their nurse is on the phone giving report', ready: 'Ready to go home', watch: `Treated. Being watched until ${E.clock(p.due)}: ${E.WATCH_WHY[p.ck] || 'not safe to go yet'}.`, dc: 'Discharge teaching (nurse)', dcing: 'Discharge teaching (nurse)', readytx: `Transfer to ${p.txTo}`, txcall: 'Calling a hospital to accept', txok: `${cap(p.txTo)} accepted. Pick the transport.`, iftwait: `${p.iftLevel ? E.IFT[p.iftLevel].name : 'Ambulance'} arrives in <span data-cd="${p.due}"></span>`, iftreport: p.iftRep == null ? 'Transport crew at the bedside, waiting for report' : 'Transport crew packaging them for the trip', board: `${p.dispo === 'obs' ? 'Going to the observation unit' : `Admitted to ${{ admit: p.gray || p.con === 'cards' ? 'a monitored bed' : 'the floor', icu: 'the ICU', bh: 'the psych unit' }[p.dispo]}`} · bed in <span data-cd="${p.due}"></span>`, bedready: 'Bed ready upstairs. Send them with a transporter or a tech.', xportq: 'Transport is on the way to the room', toproc: p.dispo === 'cath' ? 'Going to the cath lab' : 'Going to the OR', family: 'Family at the bedside', morgue: 'Waiting for transport', morguing: 'Transport underway' };
  return m[p.dsp] || 'Not decided yet';
}
function bloodText(p, k) {
  const b = p.bb;
  if (k === 'mtp') return !b ? ['<b>Activate the massive transfusion protocol</b>', 'need'] : b.st === 'mtp' ? [`Blood bank packing cooler 1 (<span data-cd="${b.due}"></span>)`, 'wait'] : b.st === 'cooler' ? ['Cooler ready. Waiting for a tech to run it.', 'wait'] : b.st === 'run' ? ['A tech is running the cooler down', 'wait'] : ['Cooler at the bedside', 'wait'];
  return !b ? ['Type and crossmatch starts when labs are drawn', 'wait'] : b.st === 'xm' ? [`Crossmatching (<span data-cd="${b.due}"></span>). Emergency-release O-neg if you can't wait.`, 'wait'] : b.st === 'erel' ? [`O-negative on the way (<span data-cd="${b.due}"></span>)`, 'wait'] : ['Ready to hang', 'wait'];
}
function treatText(p, k) {
  const it = p.treat[k], T = E.TREAT[k];
  if (!it) return (k === 'mtp' || k === 'blood') ? bloodText(p, k) : ['Ordered after the provider sees them', 'idle'];
  if (it.st === 'done') return [k === 'mtp' ? 'Running. Pressure is coming up.' : k === 'meds' && p.ck && E.rxName ? `Given: ${esc(E.rxName(p))}` : 'Given', 'ok'];
  if (it.st === 'doing') return ['Underway', 'wait'];
  if (it.st === 'verify') return ['Waiting on pharmacist verification', 'warn'];
  if (it.st === 'q') return ['In the provider\'s line', 'wait'];
  if (it.st === 'wait') {
    if (k === 'tnk') {
      const lim = E.LYTIC_BP.join('/'), ready = p.consult.st === 'here' && p.work.ct && p.work.ct.st === 'done';
      if (ready && !E.bpOkForLytic(p)) { const v = E.vitalsOf(p); return [`<b>Held: ${v.sbp}/${v.dbp} is over ${lim}.</b> ${p.treat.bp ? 'It goes in when the pressure comes down.' : 'It needs blood pressure control first.'}`, p.treat.bp ? 'warn' : 'need']; }
      return [`Needs neurology at the bedside, a CT with no bleed, and a pressure under ${lim}`, 'idle'];
    }
    if (k === 'vent') return ['After the intubation', 'idle'];
    if (k === 'mtp' || k === 'blood') return bloodText(p, k);
  }
  if (T.md && it.st === 'todo') return ['Needs an attending, with an RT at the head of the bed', 'need'];
  return [T.by === 'rt' ? 'Waiting on respiratory therapy' : T.by === 'prov' ? 'Provider procedure, in their line' : 'Waiting for the nurse', 'wait'];
}
function pathRows(p, G) {
  const rows = [], row = (k, v, st) => `<li class="pr ${st}"><span class="pk">${k}</span><span class="pv2">${v}</span></li>`;
  const r = E.roomOf(p), pv = p.prov ? E.staff(p.prov) : null, nm = id => { const s = E.staff(id); return s ? esc(s.name) : 'Someone'; };
  const regTxt = { done: 'Registered', quick: 'Quick registration done. Full registration happens at the bedside.', doing: `${nm(p.regBy)} is doing a quick registration`, q: `${nm(p.regBy)} has them in line`, fdoing: `${nm(p.regBy)} is finishing registration at the bedside`, fq: `${nm(p.regBy)} will finish registration at the bedside` }[p.reg] || 'Not registered yet';
  rows.push(row('Registration', regTxt, p.reg === 'done' ? 'ok' : p.reg === 'none' ? 'need' : p.reg === 'quick' ? 'idle' : 'wait'));
  if (p.loc === 'wall' || p.loc === 'triage') rows.push(row(p.loc === 'wall' ? 'Report' : 'Triage', p.tri === 'done' ? `Triaged: ESI ${ve(p)}` : p.tri === 'doing' ? `${nm(p.triBy)} is ${p.loc === 'wall' ? 'taking report from ' + esc(p.unit) : 'triaging'} now` : p.tri === 'q' ? `${nm(p.triBy)} is next${E.regQuick(p) || p.loc === 'wall' ? '' : ', once registered'}` : p.loc === 'wall' ? `${esc(p.unit)} is waiting to give report` : 'Waiting for a triage nurse', p.tri === 'done' ? 'ok' : p.tri === 'none' ? 'need' : 'wait'));
  rows.push(row('Bed', r ? E.roomName(r.id) : where(p), r ? 'ok' : 'need'));
  rows.push(row('Nurse', p.rn === 'done' ? 'Assessed' : p.rn === 'doing' ? 'Assessing now' : p.rn === 'todo' ? (r && E.zoneNurses(r.z).length ? 'Waiting for the nurse' : 'No nurse covers this room') : 'After rooming', p.rn === 'done' ? 'ok' : p.rn === 'todo' && r && !E.zoneNurses(r.z).length ? 'need' : 'idle'));
  const pitBy = p.pitBy ? E.staff(p.pitBy) : null;
  const cos = p.cosign === 'need' ? '. Waiting on the attending co-sign.' : p.cosign === 'wait' ? '. Needs an attending co-sign; no attending is free.' : p.cosign === 'done' ? '. Attending co-signed.' : '';
  if (mine(p) && (p.ord === 'need' || p.ord === 'more')) rows.push(row('Orders', p.ord === 'need' ? 'Waiting for your orders' : 'The workup is missing something', 'need'));
  rows.push(row('Provider', p.ev === 'done' ? `Seen by ${pv ? (isMe(pv) ? 'you' : esc(pv.name)) : 'a provider'}${cos}` : p.ev === 'doing' ? `${esc(pv ? pv.name : 'Provider')} is in the room` : p.ev === 'q' ? `${esc(pv ? pv.name : '')}, in line` : p.pitSeen ? `Seen in triage by ${esc(pitBy ? pitBy.name : 'the triage provider')}${p.loc === 'room' ? '. Needs a provider here.' : ''}` : p.loc === 'room' ? 'Not assigned yet' : 'After rooming', p.ev === 'done' ? 'ok' : p.ev === 'none' && p.loc === 'room' ? 'need' : p.pitSeen ? 'ok' : 'idle'));
  if (p.lang) rows.push(row('Interpreter', p.interp === 'on' ? `${E.LANGS[p.lang]} interpreter connected` : p.interp === 'req' ? `${E.LANGS[p.lang]} interpreter in <span data-cd="${p.interpDue}"></span>` : `<b>Speaks ${E.LANGS[p.lang]}.</b> Care runs slower and riskier without one.`, p.interp === 'on' ? 'ok' : p.interp === 'req' ? 'wait' : 'need'));
  let keys = p.wk.slice(); if (p.work.ecg && !keys.includes('ecg')) keys.unshift('ecg');
  const unwritten = MD() && p.ev !== 'done' && !p.arrest;   // in the attending's game the orders are the player's to work out
  if (unwritten) { keys = keys.filter(k => p.work[k]); if (p.loc === 'room' || p.loc === 'wall' || p.loc === 'waiting' || p.loc === 'triage') rows.push(row('Orders', 'Written after the exam', 'idle')); }
  const named = detShown(p);
  for (const k of keys) {
    const w = p.work[k], nm = { ecg: 'ECG', lab: 'Labs', xr: 'X-ray', ct: 'CT', us: 'Ultrasound', mri: 'MRI' }[k];
    const mineK = named.filter(d => E.DET_KIND(d) === k);
    if (mineK.length) {   // named tests: one row each, with the picture for a study
      const doneK = w && w.st === 'done';
      for (const d of mineK) {
        if (!doneK) { const v = !w ? 'Ordered after the provider sees them' : w.st === 'todo' ? (k === 'lab' ? (p.loc === 'room' || p.pitSeen ? 'Waiting for a PCT to draw it' : 'Drawn once roomed') : k === 'mri' ? 'Waiting for the MRI scanner' : 'In line for the scanner') : w.st === 'doing' ? (k === 'lab' ? 'Drawing now' : 'Scanning now') : `Resulting in <span data-cd="${w.due}"></span>`; rows.push(row(E.DET_NAME(d), v, 'idle')); continue; }
        const [t, img] = (p.dres && p.dres[d]) || E.detResult(p, d), pl = PLAIN() && !dxPending(p) && E.FIND_PLAIN[t];   // v0.29: plain words wait until the diagnosis is named
        rows.push(row(E.DET_NAME(d), `${img && IMG_CREDIT[img] ? `<button type="button" class="rimg" data-act="img" data-arg="${p.id}|${d}" aria-label="Look at the ${esc(E.DET_NAME(d))}"><img src="img/${img}.jpg" alt="" loading="lazy"><span>View</span></button>` : ''}<b>${esc(t)}</b>${pl ? `<small class="dxp">${esc(pl)}</small>` : ''}`, 'ok'));
      }
      continue;
    }
    let v, st = 'idle';
    if (!w) v = 'Ordered after the provider sees them';
    else if (w.st === 'todo') v = k === 'lab' ? (p.loc === 'room' || p.pitSeen ? 'Waiting for a PCT (the nurse draws it if techs are tied up)' : 'Drawn once roomed') : k === 'ecg' ? 'Waiting for a PCT or nurse' : 'In line for the scanner';
    else if (w.st === 'doing') v = k === 'lab' ? 'Drawing now' : k === 'ecg' ? 'Doing it now' : 'Scanning now';
    else if (w.st === 'run') v = `Resulting in <span data-cd="${w.due}"></span>`;
    else { const f = p.find[k] || 'Resulted', pl = PLAIN() && !dxPending(p) && (E.FIND_PLAIN[f] || (/^Normal sinus rhythm/.test(f) ? 'a normal heartbeat' : /^Sinus tachycardia, rate/.test(f) ? 'a fast, regular heartbeat' : /^Sinus bradycardia/.test(f) ? 'a slow, regular heartbeat' : '')); v = `<b>${esc(f)}</b>${pl ? `<small class="dxp">${esc(pl)}</small>` : ''}`; st = 'ok'; }
    rows.push(row(nm, v, st));
  }
  for (const k of p.tr) { if (unwritten && !p.treat[k]) continue; const [v, st] = treatText(p, k); rows.push(row(E.TREAT[k].label, v, st)); }
  const cs = p.consult;
  let cv, cst = 'idle';
  if (cs.st === 'none') { if (MD() && (mine(p) || !p.prov) && !p.alertOn) cv = p.dxK && p.ev === 'done' ? 'Your call' : 'Unknown until the workup is back'; else if (p.dxK && p.con) { cv = 'Needed. Pick the right service.'; cst = 'need'; } else if (p.dxK && p.loc === 'room' && !p.arrest) cv = 'Not needed'; else cv = 'Unknown until the workup is back'; }
  else if (cs.st === 'req') cv = cs.phone ? `Calling ${E.SPECS[cs.spec].doc} to admit by phone: <span data-cd="${cs.due}"></span>` : `${E.SPECS[cs.spec].doc} (${E.SPECS[cs.spec].name}) coming in <span data-cd="${cs.due}"></span>`;
  else { cv = cs.phone ? `${E.SPECS[cs.spec].doc} accepted by phone` : `${E.SPECS[cs.spec].doc} (${E.SPECS[cs.spec].name}) at the bedside`; cst = 'ok'; }
  if (p.conNote && cs.st === 'none') { cv += `<small class="dxp bad">${esc(p.conNote)}</small>`; }
  rows.push(row('Consult', cv, cst));
  if (p.con2 && cs.st === 'here') { const c2 = p.consult2; rows.push(row('Second consult', !c2 ? 'Needed: a second service' : c2.st === 'req' ? `${E.SPECS[c2.spec].doc} (${E.SPECS[c2.spec].name}) coming in <span data-cd="${c2.due}"></span>` : `${E.SPECS[c2.spec].doc} (${E.SPECS[c2.spec].name}) at the bedside`, !c2 ? 'need' : c2.st === 'here' ? 'ok' : 'idle')); }
  if (p.screen) rows.unshift(row('Screening', p.screen === 'pending' ? 'Not screened yet: the first person to see them asks about cough, fever, rash and travel' : `Positive: mask on, ${p.iso === 'air' ? 'airborne isolation (Room 8 or 16)' : 'isolation room with a door'}`, p.screen === 'pending' ? 'need' : 'ok'));
  rows.push(row('Plan', dispoText(p), p.dsp === 'none' ? 'idle' : 'ok'));
  return rows.join('');
}
function goalRow(p, k) {
  const v = p.goals[k], gl = E.GOALS[k];
  return `<div class="goal ${v === true ? 'ok' : v === false ? 'bad' : ''}"><span>${gl.label} under ${gl.lim} min</span><b>${v === null ? `<span data-cd="${p.tArrive + gl.lim}"></span> left` : v ? 'Met' : 'Missed'}</b></div>`;
}
function primary(p, G) { return primary0(p, G) + helpBlock(p); }
function primary0(p, G) {
  const mtpBtn = p.bleed === 'mtp' && !p.bb ? `<button type="button" class="big bad" data-act="mtp" data-arg="${p.id}">Activate massive transfusion</button>` : '';
  if ((p.loc === 'wall' || p.loc === 'triage') && !intakeDone(p)) return intakeBlock(p, G, mtpBtn);
  if (['wall', 'waiting', 'triage'].includes(p.loc)) return `<div class="prim">${mtpBtn}<button type="button" class="big act" data-act="placeSel" data-arg="${p.id}">Choose a room</button>${p.loc === 'wall' && ve(p) >= 3 && !p.alertOn ? `<button type="button" class="big" data-act="toWait" data-arg="${p.id}">Hand off to the waiting room</button>` : ''}${p.loc === 'waiting' ? recheckBlock(p, G) : ''}</div>`;
  if (p.loc === 'enroute') return `${mtpBtn ? `<div class="prim">${mtpBtn}</div>` : ''}<p class="hint">Inbound, ETA <span data-cd="${p.eta}"></span>. Have a ${p.esi === 1 ? 'resus bay' : 'room'} clean and ready.</p>`;
  if (p.loc !== 'room') return '';
  if (mtpBtn) return `<div class="prim">${mtpBtn}</div>`;
  if (p.dsp === 'ready') return `<div class="prim"><div class="pgrid two"><button type="button" class="big go" data-act="dc" data-arg="${p.id}">Discharge home</button><button type="button" class="big" data-act="dcRehab" data-arg="${p.id}">Discharge to rehab</button></div><p class="hint" style="margin:0">Rehab is for someone who can leave the ED but can’t manage at home yet. The exam will tell you.</p></div>`;
  if (p.dsp === 'rehab') { const t = (E.G.clerk || []).find(x => x.k === 'ride' && x.pid === p.id), s = t && t.by ? E.staff(t.by) : null; return `<div class="prim"><div class="prim-l">Going to rehab: someone has to call the ride</div>${s ? `<p class="hint" style="margin:0">${esc(s.name)} is on it.</p>` : `<div class="pgrid">${ucButtons(t)}</div>`}</div>`; }
  if (p.dsp === 'rideeta') return `<p class="hint">Ride to rehab booked. The ambulance is here in <span data-cd="${p.due}"></span>.${E.roomOf(p).kind !== 'chair' ? ' They can wait in a chair to free the bed.' : ''}</p>`;
  if (p.dsp === 'ridehere') return '<p class="hint">The ambulance crew is here to take them to rehab.</p>';
  if (p.dsp === 'watch') return `<p class="hint">Not safe to go until <b>${E.clock(p.due)}</b>. A chair frees this room while they wait.</p><div class="prim"><button type="button" class="big" data-act="dc" data-arg="${p.id}">Discharge early (risky)</button></div>`;
  if (['readytx', 'txcall', 'txok', 'iftreport'].includes(p.dsp)) return txBlock(p, G);
  if (p.dsp === 'decide') return grayBlock(p);
  if (p.dsp === 'board') return boardBlock(p, G);
  if (p.dsp === 'callrep' || p.dsp === 'reporting') return `<p class="hint">Their nurse calls report to the floor, then you send them up.${hasHold() ? ' Your hold nurse has them.' : ''}${E.roomOf(p).kind === 'chair' ? ' They’re in a chair: move them to a bed if one opens.' : ''}</p>`;
  if (p.dsp === 'bedready') return `<div class="prim"><div class="prim-l">Bed ready upstairs. Who takes them?</div><div class="pgrid">${upButtons(p, G)}</div>${p.dispo === 'icu' ? '<p class="hint" style="margin:0">ICU patient: their nurse goes along for about 10 minutes.</p>' : ''}</div>`;
  const regBlk = p.reg === 'none' ? `<div class="prim"><div class="prim-l">Register them at the bedside${p.bedFirst ? '' : ' before they leave the ED'}</div><div class="pgrid">${regButtons(p, G)}</div></div>` : '';
  if (E.needsProv(p)) return `<div class="prim"><div class="prim-l">Assign a provider</div><div class="pgrid">${provButtons(p, G)}</div></div>${regBlk}`;   // bedded first: the registrar is the other thing they need
  if (regBlk) return regBlk;
  if (p.dxK && p.con && p.consult.st === 'none') return `<div class="prim"><button type="button" class="big act" data-act="consultOpen" data-arg="${p.id}">Call a consult…</button></div>`;
  if (E.con2Open(p)) return `<div class="prim"><div class="prim-l">${esc(E.SPECS[p.consult.spec].name)} is on board. A second service is needed.</div><button type="button" class="big act" data-act="consultOpen" data-arg="${p.id}">Call a second consult…</button></div>`;
  if (p.reg === 'quick' && p.ev === 'done') return `<div class="prim"><div class="prim-l">Finish their registration</div><div class="pgrid">${regButtons(p, G)}</div><p class="hint" style="margin:0">Registration does this at the bedside when the desk is quiet. They can't leave the ED until it's done.</p></div>`;
  return '';
}
function grayBlock(p) {
  const g = p.gray, b = (k, l, sub) => `<button type="button" class="cbtn" data-act="gray" data-arg="${p.id}|${k}"><b>${l}</b><small>${sub}</small></button>`;
  return `<div class="prim"><div class="prim-l">Your call · ${esc(g.tool)} ${g.score}</div><p class="hint" style="margin:0">${esc(GRAY_GUIDE[g.tool] || '')}</p>${MD() && mine(p) && p.txGap && p.txGap.length ? `<p class="hint bad" style="margin:0">${gapMsg(p)}</p>` : ''}<div class="cgrid three">${b('home', 'Home', 'Frees the bed now')}${b('obs', 'Observation', `Obs unit ${E.G.obsUnit.filled}/${E.G.obsUnit.cap} full`)}${b('admit', 'Admit', 'Takes an inpatient bed')}</div></div>`;
}
function recheckBlock(p, G) {
  const ns = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.skill !== 'new' && (s.zones.includes('triage') || !s.zones.length));
  const last = p.lastRecheck != null ? p.lastRecheck : p.tTriage;
  if (!ns.length) return '';
  return `<div class="prim-l">Recheck vitals · last check <span data-el="${last}"></span> ago</div><div class="pgrid">${ns.map(s => staffBtn('recheck', p.id, s, s.zones.includes('triage') ? 'Triage nurse' : 'Resource nurse', s.tq.some(k => k.pid === p.id))).join('')}</div>`;
}
function staffBtn(act, pid, s, sub, dis) {
  return `<button type="button" class="pbtn ${RC[s.role]}" data-act="${act}" data-arg="${pid}|${s.id}" ${dis ? 'disabled' : ''}><b>${esc(s.short)}</b><small>${sub}</small></button>`;
}
function G0() { return E.G; }
function regButtons(p, G) {
  return G.staff.filter(s => s.role === 'reg' && E.present(s)).map(s => { const n = s.q.length + (s.task ? 1 : 0); return staffBtn('regAssign', p.id, s, s.st !== 'on' ? stLabel(s) : n ? `${n} in line` : 'Free now', s.st !== 'on'); }).join('');
}
function ucButtons(t) {   // v0.25: hand a clerical task to the unit secretary
  if (!t) return '';
  const ucs = E.G.staff.filter(s => s.role === 'uc' && E.present(s));
  return ucs.length ? ucs.map(s => { const n = s.q.length + (s.task ? 1 : 0); return staffBtn('ucDo', t.id, s, s.st !== 'on' ? stLabel(s) : n ? `${n} in line` : 'Free now', s.st !== 'on'); }).join('') : '<p class="hint" style="margin:0">No unit secretary on right now.</p>';
}
function triButtons(p, G) {
  const rank = s => s.zones.includes('triage') ? 0 : !s.zones.length ? 1 : 2;
  const ns = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.escortUntil <= G.t && s.skill !== 'new').sort((a, b) => rank(a) - rank(b) || E.nurseLoad(a) - E.nurseLoad(b));
  return ns.map(s => {
    const n = s.tq.length + (s.task && s.task.kind === 'triage' ? 1 : 0);
    const where = s.zones.includes('triage') ? 'Triage nurse' : !s.zones.length ? 'Resource nurse' : `${s.zones.map(z => E.ZONE_NAME[z]).join(' + ')} · ${fl(E.nurseLoad(s))}/${E.ratioCap(s)}`;
    return staffBtn('triAssign', p.id, s, `${where}${n ? ` · ${n} to triage` : ''}`);
  }).join('');
}
function intakeBlock(p, G, mtpBtn) {
  let h = `<div class="prim">${mtpBtn}`;
  if (E.emergent(p)) h += `<button type="button" class="big bad" data-act="placeSel" data-arg="${p.id}">Straight to a room</button><p class="hint" style="margin:0">Critical: skip the line. The nurse triages at the bedside. Register them before they leave the ED.</p>`;
  else if (E.sickEnough(p) && p.reg === 'none') h += `<button type="button" class="big act" data-act="placeSel" data-arg="${p.id}">Bed first</button><p class="hint" style="margin:0">${p.tri === 'done' ? `ESI ${E.vEsi(p)}` : '<b>Looks sick.</b> They'} can go to a bed before registration. Then send a registrar to the room: nobody leaves the ED until they’re registered.</p>`;
  const wall = p.loc === 'wall', em = E.emergent(p);   // at the front door registration comes first; on the wall the crew's report does
  const regB = p.reg === 'none' ? `<div class="prim-l">${em ? '' : wall ? '2 · ' : '1 · '}Register</div><div class="pgrid">${regButtons(p, G)}</div>` : '';
  const triB = p.tri === 'none' && !em ? `<div class="prim-l">${wall ? '1' : '2'} · ${wall ? `Take report from ${esc(p.unit)} and triage` : 'Triage'}</div><div class="pgrid">${triButtons(p, G)}</div>` : '';
  h += wall ? triB + regB : regB + triB;
  if (p.reg !== 'none' && (p.tri !== 'none' || E.emergent(p)) && !E.emergent(p)) h += `<p class="hint" style="margin:0">Intake is underway. Tap the patient again when they show ${U.view === 'map' ? 'a green check' : 'READY FOR A BED'}.</p>`;
  return h + '</div>';
}
function upButtons(p, G) {
  const tps = G.staff.filter(s => s.role === 'tp' && E.present(s)), pcts = G.staff.filter(s => s.role === 'pct' && s.st === 'on');
  return tps.map(s => { const n = s.q.length + (s.task ? 1 : 0); return staffBtn('sendUp', p.id, s, s.st !== 'on' ? stLabel(s) : `Transporter · ${n ? n + ' ahead' : 'free'}`, s.st !== 'on'); }).join('')
    + pcts.map(s => { const sit = s.task && s.task.kind === 'sit'; return staffBtn('sendUp', p.id, s, sit ? 'Sitting 1:1' : `Tech · ${s.task || s.q.length ? 'after this job' : 'free'}`, sit); }).join('');
}
function iftButtons(p, G) {   // v0.26: five levels of transport
  const H = E.HOSPS.find(h => h.k === p.txHosp), gr = E.wxGrounded(), m = E.wxOf().gnd || 1, slow = G.mods.iftSlow > G.t ? 30 : 0;
  return ['wc', 'bls', 'als', 'cct', 'air'].map(k => {
    const L = E.IFT[k], air = k === 'air', noPad = air && H && !H.air, dis = air && (gr || noPad);
    const a = air ? L.eta[0] : Math.round(L.eta[0] * m) + slow, b = air ? L.eta[1] : Math.round(L.eta[1] * m) + slow;
    return `<button type="button" class="cbtn" data-act="ift" data-arg="${p.id}|${k}" ${dis ? 'disabled' : ''}><b>${L.name}</b><small>${gr && air ? 'Grounded for weather' : noPad ? 'No helipad there' : `${esc(L.what)} · here in ${a}–${b} min`}</small></button>`;
  }).join('');
}
/* v0.26: a transfer, step by step: find a hospital, call it, pick the transport, give report. */
function txBlock(p, G) {
  const H = E.HOSPS.find(h => h.k === p.txHosp), mineTx = !MD() || mine(p);
  if (p.dsp === 'readytx') return mineTx ? `<div class="prim"><div class="prim-l">Transfer: needs ${esc(E.CAP_NAME[E.txNeedOf(p)].toLowerCase())}</div><button type="button" class="big act" data-act="hospOpen" data-arg="${p.id}">Find a hospital…</button>${p.txNo && p.txNo.length ? `<p class="hint" style="margin:0">Said no: ${p.txNo.map(k => esc((E.HOSPS.find(h => h.k === k) || {}).short || k)).join(', ')}.</p>` : ''}</div>` : '<p class="hint">The charge nurse is finding a hospital.</p>';
  if (p.dsp === 'txcall') return `<p class="hint">Calling ${H ? esc(H.name) : 'the transfer center'}. Their answer comes in <span data-cd="${p.due}"></span>.</p>`;
  if (p.dsp === 'txok') return mineTx ? `<div class="prim"><div class="prim-l">${esc(H ? H.short : cap(p.txTo))} accepted. Which transport?</div><div class="cgrid">${iftButtons(p, G)}</div><p class="hint" style="margin:0">Match the crew to the patient. Too little and they refuse at the bedside; too much ties up a unit someone else needs.${H ? ` The trip: ${H.gnd} min by ground${H.air ? `, ${H.air} by air` : ''}.` : ''}</p></div>` : '<p class="hint">Accepted. The charge nurse is booking the transport.</p>';
  if (p.dsp === 'iftreport') {
    if (p.iftRep == null && MD() && mine(p)) return `<div class="prim"><div class="prim-l">The ${esc(E.IFT[p.iftLevel].short)} crew is at the bedside</div><button type="button" class="big act" data-act="giveRep" data-arg="${p.id}">Give report</button><p class="hint" style="margin:0">They don’t move the patient until the doctor gives report.</p></div>`;
    return `<p class="hint">${p.iftRep == null ? 'The doctor is giving report to the crew.' : 'Report given. The crew is packaging them for the trip.'}</p>`;
  }
  return '';
}
/* v0.26: an admitted patient waiting upstairs: which unit, how full, and the way out when there is no bed. */
function boardBlock(p, G, md) {
  if (p.obsWait) return '<p class="hint">The obs unit is full. The next obs discharge frees a bed for them.</p>';
  const u = p.bedU && E.UNITS[p.bedU], b = u && G.beds[p.bedU];
  let h = !u ? '' : p.bedGot ? `<p class="hint">${u.name} bed assigned. EVS is turning it over: ready in <span data-cd="${p.due}"></span>.</p>` : `<p class="hint">Waiting for a <b>${u.name}</b> bed. ${u.name} is ${b.used}/${u.cap} full; ${E.bedWait(p.bedU)} from the ED in line. <button type="button" class="lnk" data-act="bedsOpen">Beds upstairs</button></p>`;
  const canTx = u && !p.bedGot && ['icu', 'step', 'bh'].includes(p.bedU) && b.used >= u.cap && (!MD() || mine(p));
  const esc1 = !md && !(u && p.bedGot) ? `<button type="button" class="big" data-act="esc" data-arg="${p.id}" ${G.house.esc ? '' : 'disabled'}>Push the House Supervisor for a bed (${G.house.esc} left)</button>` : '';
  const tx = canTx ? `<button type="button" class="big" data-act="txInst" data-arg="${p.id}">Can’t stay: transfer to a hospital with a bed</button>` : '';
  return h + (esc1 || tx ? `<div class="prim">${esc1}${tx}</div>` : '');
}
/* v0.26: help from upstairs for procedures. */
function helpBlock(p) {
  if (!p || p.loc !== 'room' || ['dc', 'dcing', 'iftwait', 'iftreport', 'xportq', 'family', 'morgue', 'morguing', 'toproc', 'ready', 'rehab', 'rideeta', 'ridehere'].includes(p.dsp)) return '';
  if (MD() && !mine(p)) return '';
  if (p.help) { const H = E.HELP[p.help.k]; return `<p class="hint">${p.help.st === 'req' ? `${H.name} is on the way: <span data-cd="${p.help.due}"></span>.` : p.help.st === 'here' ? `${H.doc} (${H.name}) is at the bedside.` : `${H.name} came down to help.`}</p>`; }
  const need = p.hardAirway || p.esi <= 2 || p.crash || p.arrest || p.tr.some(k => ['intub', 'pressor', 'vent'].includes(k));
  if (!need) return '';
  return `<div class="prim"><div class="prim-l">Call for help from upstairs${p.hardAirway ? ' · <b class="hintb">hard airway</b>' : ''}</div><div class="cgrid">${Object.entries(E.HELP).map(([k, H]) => `<button type="button" class="cbtn" data-act="helpCall" data-arg="${p.id}|${k}"><b>${H.name}</b><small>${esc(H.what)}</small></button>`).join('')}</div></div>`;
}
/* v0.26: the hospitals around us. */
function hospSheet(G, p) {
  if (!p) return '';
  const need = E.txNeedOf(p), no = p.txNo || [];
  let h = head('Find a hospital', `${esc(p.name)} needs ${esc(E.CAP_NAME[need].toLowerCase())}`);
  h += '<p class="hint">Call one to accept. A hospital that can’t do it, or one that’s full, says no and costs you time.</p><div class="hlist">';
  for (const H of E.HOSPS) {
    const st = G.hosp[H.k], full = st.full > G.t, said = no.includes(H.k);
    h += `<div class="hrow${said ? ' no' : ''}"><div class="hrow-h"><b>${esc(H.name)}</b><span>${H.gnd} min by ground · ${H.air ? `${H.air} by air` : 'no helipad'}</span></div><div class="caps">${H.caps.map(c => `<i class="cap${c === need ? ' on' : ''}">${esc(E.CAP_NAME[c])}</i>`).join('')}</div><div class="hrow-f"><span class="${full || said ? 'bad' : 'okk'}">${said ? 'Said no' : full ? `Full until ${E.clock(st.full)}` : 'Taking transfers'}</span><button type="button" class="cbtn sm" data-act="callHosp" data-arg="${p.id}|${H.k}" ${said || p.dsp !== 'readytx' ? 'disabled' : ''}>Call</button></div></div>`;
  }
  return h + '</div>';
}
function bedsHTML(G) {
  let h = head('Beds upstairs', 'A bed opens when someone upstairs goes home. Direct admissions from clinics and the OR want them too.');
  const row = (n, used, cap, w, what) => `<div class="brow${used >= cap ? ' full' : ''}"><div class="brow-h"><b>${n}</b><span>${used}/${cap}${w ? ` · ${w} from the ED waiting` : ''}</span></div><span class="bbar"><i style="width:${Math.min(100, Math.round(100 * used / cap))}%"></i></span><small>${esc(what)}</small></div>`;
  h += '<div class="btab">' + Object.entries(E.UNITS).map(([k, u]) => row(u.name, G.beds[k].used, u.cap, E.bedWait(k), u.what)).join('') + row('Observation', G.obsUnit.filled, G.obsUnit.cap, E.active().filter(p => p.obsWait).length, 'Short stays: watch and retest') + '</div>';
  return h + '<p class="hint">No ICU, step-down, or psych bed and a long line? The doctor can transfer the patient to a hospital that has one.</p>';
}
function ptSheet(G, p) {
  if (!p) return '';
  if (p.loc === 'gone') return head(esc(p.name), 'No longer in the department') + `<p class="hint">${esc({ dc: 'Discharged home.', obs: 'Went to the observation unit.', admit: 'Went upstairs.', icu: 'Went to the ICU.', bh: 'Went to the psych unit.', or: 'Went to the OR.', cath: 'Went to the cath lab.', tx: 'Transferred out.', lwbs: 'Left without being seen.', ama: 'Left against medical advice.', expired: 'Died in the department.' }[p.outcome] || 'Left.')}</p>`;
  let h = `<div class="ph"><div class="ph-who"><span class="ph-em">${emoji(p)}</span><span><b>${esc(p.name)}</b>, ${E.ageSex(p)} ${esiChip(p)} ${alertTag(p)}${tagChip(p)}${langChip(p)}${p.ret ? ' <i class="rettag">72-hr return</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}<br><span class="ph-sub">${esc(where(p))} · ${p.src === 'ems' ? esc(p.unit || 'EMS') : 'Walk-in'} · ${p.loc === 'enroute' ? `ETA <span data-cd="${p.eta}"></span>` : `in the ED <span data-el="${p.tArrive}"></span>`}</span></span></div></div>`;
  const kv = [['Complaint', esc(p.cc)], ['Vitals', vitalsHTML(p)]], dx = dxShown(p);
  const ctBack = p.work && p.work.ct && p.work.ct.st === 'done';
  if (dx && p.alert === 'stroke' && !ctBack && !p.ret) kv.push(['Diagnosis', `<b>Stroke</b><small class="dxp">Clot or bleed: not known until the CT.</small>`]);
  else if (dx) kv.push(['Diagnosis', `<b>${esc(dx)}</b>${E.DX_PLAIN[dx] ? `<small class="dxp">${esc(E.DX_PLAIN[dx])}</small>` : ''}`]); else if (p.alertOn && p.alert) kv.push(['Working', `${esc(E.ALERTS[p.alert].name)} alert`]);
  if (p.ev === 'done' && E.examOf(p) && p.loc !== 'gone') kv.push(['Exam', esc(E.examOf(p))]);
  if (p.tag) kv.push(['Field tag', `${cap(p.tag)}: ${{ red: 'immediate', yellow: 'can wait a little', green: 'walking wounded' }[p.tag]}`]);
  if (p.alert === 'stroke' && (p.alertOn || p.ev === 'done')) {   // walk-in strokes too, once seen (Phase 3, R6-02)
    if (p.lkwT != null) kv.push(['Onset', `Last known well <b>${E.clock(p.lkwT)}</b> · ${p.anticoag ? 'check the home meds' : p.strokeKind && p.strokeKind !== 'in' ? 'outside the 4.5-hour window for the thrombolytic' : `the thrombolytic has to be in by ${E.clock(p.lkwT + E.LYTIC_WINDOW)}`}`]);   // no deadline for a patient who can't have it (round 12)
    else kv.push(['Onset', 'Last known well <b>unknown</b>: woke up with it']);
    if (p.anticoag) kv.push(['Home meds', `Takes <b>${esc(p.anticoag)}</b> (a blood thinner)`]);
  }
  if (p.ck === 'afib' && p.dxK) { const h = E.afOnset(p); kv.push(['Onset', h != null ? `Started about <b>${h} hours</b> ago` : 'Not sure when it started: <b>at least a few days</b>']); }
  if (p.iso && p.screen !== 'pending') kv.push(['Isolation', p.iso === 'air' ? 'Airborne. Room 8 or 16.' : 'Droplet. Mask, and a room with a door.']);
  if (p.sitter) kv.push(['Safety', 'Needs a safe room (19 or 20) or a 1:1 sitter']);
  if (p.bleed === 'mtp') kv.push(['Bleeding', p.bb ? 'Massive transfusion activated' : '<b>Hemorrhage. Activate MTP.</b>']);
  else if (p.bleed === 'prbc' && (!MD() || p.treat.blood)) kv.push(['Blood', p.treat.blood && p.treat.blood.st === 'done' ? 'Transfusion given' : MD() ? 'Transfusion ordered' : 'Needs a transfusion']);   // the attending decides that for themselves
  if (p.ret) kv.push(['Return', 'Seen here earlier today and back sicker']);
  if (p.gray && p.ev === 'done' && p.dxK) kv.push(['Risk', `${esc(p.gray.tool)} ${p.gray.score} · ${esc(p.gray.band)} risk${(p.gray.parts || []).length ? `<small> (${p.gray.parts.map(esc).join(', ')})</small>` : ''}`]);   // the parts, so the number can be checked (Phase 3, R6-16)
  if (['room', 'waiting', 'wall', 'triage'].includes(p.loc)) { const px = Math.round(Math.max(0, Math.min(100, p.px))); kv.push(['Experience', `<span class="pxv ${px >= 70 ? 'ok' : px >= 45 ? 'warn' : 'bad'}">${px}%</span> · ${p.lastUpdate != null ? (G.t - p.lastUpdate < 1 ? 'updated just now' : `updated <span data-el="${p.lastUpdate}"></span> ago`) : 'no update yet'}${PLAIN() ? '<small class="dxp">how they feel about the visit; an update raises it</small>' : ''}`]); }
  h += `<div class="ph-cc">${kv.map(([k, v]) => `<div><span>${k}</span><div>${v}</div></div>`).join('')}</div>`;
  if (MD() && p.ck && E.rxName && p.tr.includes('meds') && mine(p)) kv.push(['Medications', esc(E.rxName(p))]);
  h += MD() ? mdPrimary(p, G) : primary(p, G);
  h += `<ol class="path">${pathRows(p, G)}</ol>`;
  const gk = Object.keys(p.goals); if (gk.length && p.loc !== 'enroute') h += `<div class="goals">${gk.map(k => goalRow(p, k)).join('')}</div>`;
  const b = [];
  if (p.lang && p.interp === 'none') b.push(`<button type="button" class="hl" data-act="interp" data-arg="${p.id}">Get ${p.lang === 'asl' ? 'an ASL' : aAn(esc(E.LANGS[p.lang]))} interpreter</button>`);
  if (Object.keys(p.treat).some(k => p.treat[k].st === 'verify')) b.push(`<button type="button" data-act="override" data-arg="${p.id}">Pull meds on override</button>`);
  if (p.bleed === 'prbc' && (!p.bb || p.bb.st === 'xm')) b.push(`<button type="button" data-act="oneg" data-arg="${p.id}">Emergency-release O-neg (${G.blood.oneg} left)</button>`);
  if (p.alert === 'trauma' && !p.bb && p.bleed !== 'mtp') b.push(`<button type="button" data-act="mtp" data-arg="${p.id}">Activate MTP</button>`);
  const dead = ['family', 'morgue', 'morguing'].includes(p.dsp);
  if ((p.loc === 'room' || p.loc === 'waiting') && !dead) { const recent = p.lastUpdate != null && G.t - p.lastUpdate < 30; b.push(`<button type="button" data-act="upd" data-arg="${p.id}" ${recent ? 'disabled' : ''}>${recent ? 'Updated recently' : 'Update them on the plan'}</button>`); }
  if (p.loc === 'room' && E.isBoarder(p)) b.push(`<button type="button" data-act="zone" data-arg="hold">${hasHold() ? 'Change the hold nurse…' : 'Assign a hold nurse…'}</button>`);
  if (p.loc === 'room') {
    b.push(`<button type="button" data-act="stat" data-arg="${p.id}">${p.stat ? 'Clear STAT' : PLAIN() ? 'Mark STAT: first in line' : 'Mark STAT'}</button>`);
    b.push(`<button type="button" data-act="moveSel" data-arg="${p.id}">Move bed</button>`);
    if (p.consult.st === 'none' && (p.ev === 'done' || p.alertOn) && !(p.dxK && p.con)) b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Consult…</button>`);
    if (!E.needsProv(p) && p.ev !== 'doing' && !p.dsp.match(/^(dc|dcing|toproc|txwait|xporting|morguing)$/)) b.push(`<button type="button" data-act="provOpen" data-arg="${p.id}">Change provider</button>`);
  } else if (p.alertOn && p.con && p.consult.st === 'none') b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Activate a team…</button>`);
  if (MD()) { b.length = 0; if (mine(p) && p.loc === 'room') b.push(`<button type="button" data-act="stat" data-arg="${p.id}">${p.stat ? 'Clear STAT' : PLAIN() ? 'Mark STAT: first in line' : 'Mark STAT'}</button>`); }
  if (b.length) h += `<div class="sh-acts">${b.join('')}</div>`;
  return h;
}
/* ---------- physician mode: see, order, decide ---------- */
const ORDER_TX = [['meds', 'Medications', 'Pain, nausea, pills, the usual drug'], ['fluids', 'IV fluids', 'Salt water into a vein'], ['abx', 'Antibiotics', 'By vein, for a serious infection'], ['o2', 'Oxygen', 'Prongs or a mask, for a low SpO2'], ['nebs', 'Nebulizer', 'A mist that opens the airways'], ['bipap', 'BiPAP', 'A mask that pushes air in'], ['hfnc', 'High-flow oxygen', 'Warm, fast oxygen by nose'], ['intub', 'Intubate', 'A breathing tube and ventilator'],
  ['epi', 'Epinephrine', 'For a severe allergic reaction'], ['nalox', 'Naloxone', 'Reverses an opioid overdose'], ['insulin', 'Insulin drip', 'For DKA: steady insulin by vein'], ['pressor', 'Vasopressor', 'Holds the pressure up'], ['pace', 'Atropine and pacing', 'For a heart that is too slow'], ['cardiovert', 'Synchronized cardioversion', 'A timed shock for a fast heart that is crashing'], ['bp', 'Blood pressure control', 'Brings a high pressure down'], ['tnk', 'Thrombolytic', 'The clot drug: a stroke, or a PE that drops the pressure'], ['reverse', 'Reversal agent', 'Undoes a blood thinner'],
  ['blood', 'Blood transfusion', 'Units of blood, one at a time'], ['mtp', 'Massive transfusion', 'Coolers of blood, right now'], ['repair', 'Laceration repair', 'Stitches. You do them']];
function mdPrimary(p, G) { return mdPrimary0(p, G) + helpBlock(p); }
function mdPrimary0(p, G) {
  const mtpBtn = p.bleed === 'mtp' && !p.bb ? `<button type="button" class="big bad" data-act="mtp" data-arg="${p.id}">Activate massive transfusion</button>` : '';
  if (p.loc === 'enroute') return `${mtpBtn ? `<div class="prim">${mtpBtn}</div>` : ''}<p class="hint">Inbound, ETA <span data-cd="${p.eta}"></span>. The charge nurse is getting a ${p.esi === 1 ? 'resus bay' : 'room'} ready.</p>`;
  if (p.loc !== 'room') return `<p class="hint">The charge nurse is working on a room for ${esc(p.name.split(' ')[0])}.</p>`;
  if (!p.prov && E.needsProv(p)) return `<div class="prim">${mtpBtn}<button type="button" class="big ${p.arrest ? 'bad' : 'act'}" data-act="see" data-arg="${p.id}">${p.arrest ? 'Run the code' : 'See this patient'}</button><p class="hint" style="margin:0">${p.arrest ? 'Every minute without a doctor lowers the odds. Another doctor takes it in a minute if you don\'t.' : 'Leave them too long and another provider picks them up.'}</p></div>`;
  if (p.arrest && mine(p)) return p.ev === 'none'   // audit R5-01: your own patient in arrest
    ? `<div class="prim"><button type="button" class="big bad" data-act="see" data-arg="${p.id}">Run the code</button><p class="hint" style="margin:0">Your patient has <b>no pulse</b>. Every minute without a doctor lowers the odds. <b><span data-cd="${(p.tArrest != null ? p.tArrest : p.tArrive) + E.ARREST_NO_TEAM}"></span></b> before they are gone.</p></div>`
    : `<p class="hint">You're running the code. CPR is going.</p>`;
  if (!mine(p)) {
    const s = E.staff(p.prov), take = p.ev === 'q' && !p.arrest;
    return `<p class="hint">${s ? esc(s.name) : 'Another provider'} has this patient${take ? ' but hasn\'t started' : ''}.</p>${take ? `<div class="prim"><button type="button" class="big" data-act="see" data-arg="${p.id}">Take over</button></div>` : ''}`;
  }
  if (p.ev === 'q') { const me = E.staff(G.me), i = me.q.findIndex(k => k.pid === p.id); return `<p class="hint">In your line${i > 0 ? `, #${i + 1}` : ''}. You'll see them after what you're doing now.</p>`; }
  if (p.ev === 'doing') return `<p class="hint">${p.arrest ? 'You’re running the code.' : `You are in the room: history and exam.${myLeft(p) ? ` About <b>${myLeft(p)} min</b> left.` : ''}`}</p>`;
  if (p.dxq) return mtpBtn + dxBlock(p);
  if (p.ord === 'need' || p.ord === 'more') return mtpBtn + ordersBlock(p, G);
  if (p.dsp === 'mddecide' || p.dsp === 'decide') {
    const call = p.dsp === 'mddecide' ? mdDecideBlock(p) : grayBlock(p);
    if ((p.txGap && p.txGap.length) || U.ordOpen === p.id) return call + ordersBlock(p, G, true);   // the call first: it used to sit under 24 order buttons
    return call + `<div class="prim"><button type="button" class="big" data-act="ordOpen" data-arg="${p.id}">Add orders</button></div>`;
  }
  const tb = ['readytx', 'txcall', 'txok', 'iftreport'].includes(p.dsp) ? txBlock(p, G) : p.dsp === 'board' ? boardBlock(p, G, true) : E.con2Open(p) ? `<div class="prim"><div class="prim-l">${esc(E.SPECS[p.consult.spec].name)} is on board. Who else?</div><button type="button" class="big act" data-act="consultOpen" data-arg="${p.id}">Call a second consult…</button></div>` : '';
  let h = (mtpBtn ? `<div class="prim">${mtpBtn}</div>` : '') + tb;
  if (lyticHeld(p)) h += `<p class="hint bad">The nurse is holding the thrombolytic: the pressure is over ${E.LYTIC_BP.join('/')}.</p>`;
  else if (p.txGap && p.txGap.length) h += `<p class="hint bad">${gapMsg(p)}</p>`;
  if (p.ord === 'signed' && !['dc', 'dcing', 'toproc', 'iftwait', 'iftreport', 'xportq', 'family', 'morgue', 'morguing'].includes(p.dsp)) {
    h += (U.ordOpen === p.id || (p.txGap && p.txGap.length)) ? ordersBlock(p, G, true) : `<div class="prim"><button type="button" class="big" data-act="ordOpen" data-arg="${p.id}">Add orders</button></div>`;
  }
  return h;
}
const gapMsg = p => (E.vitalsOf(p).trend === 'better' ? 'Better, but something they need is still not ordered.' : 'Not improving. Something they need isn’t ordered.') + gapHint(p);
/* With Plain words on, a gap names what is still needed. The points are already gone; this is the lesson.
   While the workup is open it names the tests only: naming the drug would give the diagnosis away. */
function gapHint(p) { const m = PLAIN() && g() && g().train ? E.missNow(p, p.ord === 'more') : [];   // Phase 6 (R5-05): the list of what's missing is for Orientation and Lessons only
  return m.length ? ` <b class="hintb">Still needed: ${esc(m.join(', '))}.</b>` : ''; }
const lyticHeld = p => !!(p.treat.tnk && p.treat.tnk.st === 'wait' && !p.treat.bp && p.alert === 'stroke' && !E.bpOkForLytic(p));
/* Tests on the order sheet: the ECG, single labs in their groups, and named studies by kind. */
const IMG_KINDS = [['xr', 'X-ray'], ['ct', 'CT'], ['mri', 'MRI'], ['us', 'Ultrasound']];
/* v0.28: the order sheet is parent menus. Tap one to open it; Medications opens into drug classes.
   Closed menus keep their chips in the page (hidden), so a lit target can name the menu it lives in. */
const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };   // a fair shuffle
const OM_OPEN = () => (U.ordM = U.ordM || new Set());
function omHead(id, label, n, sub) {
  const open = OM_OPEN().has(id);
  return `<button type="button" class="om-h${open ? ' open' : ''}" data-act="ordMenu" data-arg="${id}" aria-expanded="${open}"><b>${label}</b>${n ? `<span class="om-n">${n}</span>` : ''}${sub ? `<small>${sub}</small>` : ''}</button>`;
}
function omBody(id, inner) { return `<div class="om-b" data-m="${id}"${OM_OPEN().has(id) ? '' : ' hidden'}>${inner}</div>`; }
function orderMenus(chip, o) {
  const pl = PLAIN(), labG = {}, picked = k => (o ? o.tests.concat(o.treats) : []).includes(k);
  const cnt = keys => keys.filter(picked).length;
  const M = (id, label, sub, keys, inner) => omHead(id, label, cnt(keys), sub) + omBody(id, inner);
  let h = '';
  const bedside = ['ecg'].concat(Object.keys(E.LABS).filter(k => E.LABS[k].poc));
  h += M('bed', 'ECG and bedside tests', 'ECG, fingerstick, urine dip', bedside, `<div class="ogrid o3">${chip('t', 'ecg', 'ECG', pl ? 'A tracing of the heart rhythm' : '')}${bedside.slice(1).map(k => chip('t', k, E.LABS[k].n, pl ? E.LABS[k].p : '')).join('')}</div>`);
  for (const [k, L] of Object.entries(E.LABS)) if (!L.poc) (labG[L.g] = labG[L.g] || []).push(chip('t', k, L.n, pl ? L.p : ''));
  h += M('lab', 'Labs', 'Blood, urine, cultures', Object.keys(E.LABS).filter(k => !E.LABS[k].poc), Object.entries(labG).map(([g, c]) => `<div class="o-grp">${g}</div><div class="ogrid o3">${c.join('')}</div>`).join(''));
  h += M('img', 'Imaging', 'X-ray, CT, MRI, ultrasound', Object.keys(E.IMGS), IMG_KINDS.map(([m, nm]) => `<div class="o-grp">${nm}</div><div class="ogrid o3">${Object.entries(E.IMGS).filter(([, I]) => I.m === m).map(([k, I]) => chip('t', k, I.n, pl ? I.p : '')).join('')}</div>`).join(''));
  if (!o) return h;
  const dchip = id => chip('r', id, E.DRUGS[id].n, pl && E.G && E.G.train ? E.DRUGS[id].p : '');   // v0.29: what a drug treats shows in Orientation and lessons, not on a real shift
  const byC = c => Object.keys(E.DRUGS).filter(id => E.DRUGS[id].c === c);
  const medIds = E.DRUG_CLASS.flatMap(([c]) => byC(c));
  let med = '';
  for (const [c, nm] of E.DRUG_CLASS) { const ids = byC(c); med += omHead('med:' + c, nm, cnt(ids)) + omBody('med:' + c, `<div class="ogrid o3">${ids.map(dchip).join('')}</div>`); }
  h += M('med', 'Medications', 'By drug class', medIds, `<div class="om-sub">${med}</div>`);
  const resusProc = ['synccv', 'tcp'].filter(k => E.PROC[k]);   // R4.2-05: the shocks and pacing live with the drugs for unstable rhythms too
  h += M('resus', 'Resuscitation', 'Arrest, unstable rhythms, shock', byC('resus').concat(resusProc), `<div class="ogrid o3">${byC('resus').map(dchip).join('')}${resusProc.map(k => chip('r', k, E.PROC[k].n, pl ? E.PROC[k].p : '')).join('')}</div>`);
  for (const [id, nm, keys] of E.ORDER_MENUS) {
    const chips = keys.map(k => E.DRUGS[k] ? dchip(k) : E.PROC[k] ? chip('r', k, E.PROC[k].n, pl ? E.PROC[k].p : '') : chip('r', k, (ORDER_TX.find(x => x[0] === k) || [k, k])[1], pl ? (ORDER_TX.find(x => x[0] === k) || [])[2] || '' : ''));
    h += M(id, nm, '', keys, `<div class="ogrid o3">${chips.join('')}</div>`);
  }
  return h;
}
// Which menu an order lives in (for the preceptor's ring, and the tests).
function omOf(key) {
  if (key === 'ecg' || (E.LABS[key] && E.LABS[key].poc)) return ['bed'];
  if (E.LABS[key]) return ['lab'];
  if (E.IMGS[key]) return ['img'];
  if (E.DRUGS[key]) { const c = E.DRUGS[key].c; if (c === 'resus') return ['resus']; const m = E.ORDER_MENUS.find(x => x[2].includes(key)); return m ? [m[0]] : ['med', 'med:' + c]; }
  const m = E.ORDER_MENUS.find(x => x[2].includes(key)); return m ? [m[0]] : [];
}
/* The imaging viewer: the study full screen, what it shows, what to look for, and whose picture it is.
   LOOK: what to look for, per picture. IMG_CREDIT: filled from img/credits.json at build time. */
const LOOK = {
  cxr_normal: 'Dark, clear lungs out to the edges. A heart less than half the width of the chest.',
  cxr_pna: 'A white, fluffy patch low on the right (circled), where air spaces have filled with pus.',
  cxr_edema: 'Fluid backing up from a failing heart: a big heart, vessels to the upper lungs standing out, short white Kerley B lines at the edges, and fluid at the base. The labels point to each one.',
  cxr_copd: 'Big, dark, over-inflated lungs and a flat diaphragm. No white patch of pneumonia.',
  cxr_tb: 'A hollow ring (a cavity) high in the lung, where tuberculosis has eaten the tissue.',
  xr_hipfx: 'A break across the neck of the femur, just below the ball of the hip.',
  xr_femur: 'The thigh bone broken through the middle.',
  xr_wrist: 'The end of the radius, just above the wrist, broken and bent back.',
  ankle_normal: 'Smooth, unbroken bone edges and an even joint space.',
  hip_normal: 'A smooth curve from the ball of the hip down the neck of the femur.',
  pelvis_normal: 'An unbroken ring of bone. Both hip joints the same, and the joints at the back of the pelvis even on each side.',
  ctcs_normal: 'The fronts of the vertebrae line up in a smooth curve, and so do their backs. No step, no crack, and even gaps between the bones.',
  ctap_normal: 'Liver, kidneys, and bowel all where they belong. No free fluid or air, no swollen appendix. (This is one slice, front to back.)',
  mris_normal: 'The spinal cord and nerves sit in a clear, bright channel of fluid. Nothing pushes into it. (The discs at the bottom are a little worn, which is common.)',
  cthead_normal: 'Gray brain filling the skull evenly. No bright white blood. (This slice is low, at the level of the eyes.)',
  ct_sdh: 'A bright crescent of blood between the skull and the brain, pushing the brain over.',
  cta_normal: 'Bright, unbroken arteries filled with contrast.',
  cta_m1: 'A 3D picture of the arteries, seen from the front (R and L mark the sides). On the left the main artery to the side of the brain stops short at the arrow: the clot. On the right it runs out into its branches.',
  ctpe_normal: 'Lung arteries evenly bright with contrast. No dark clot inside them.',
  ct_appy: 'A swollen appendix with hazy, inflamed fat around it.',
  ct_stone: 'A bright white dot in the ureter, the tube from the kidney, with the kidney swollen above it.',
  mrib_normal: 'Even gray brain. No bright spot.',
  fast_positive: 'A black stripe between the liver and the kidney. Black on ultrasound is fluid: here, blood.',
  fast_negative: 'Liver and kidney touching, with no black stripe between them.',
  us_gallstones: 'Bright stones inside the gallbladder, dark shadows behind them, and a thick wall.',
  ruq_normal: 'A dark, thin-walled gallbladder with no stones.',
  us_dvt: 'Color is moving blood. The clotted femoral vein shows no color: it’s filled with gray clot, between two vessels that still flow.',
  duplex_normal: 'The vein squashes flat under the probe: no clot.',
  pelus_normal: 'A normal uterus and ovaries.',
};
const IMG_CREDIT = /*IMGCREDIT*/{};   // a picture is shown only when it is in the game (and so has a credit)
function openViewer(pid, d) {
  const p = E.pt(pid); if (!p) return;
  const [t, img] = (p.dres && p.dres[d]) || E.detResult(p, d); if (!img || !IMG_CREDIT[img]) return;
  closeViewer(); const v = document.createElement('div'); v.id = 'viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', E.DET_NAME(d));
  const cr = IMG_CREDIT[img], pl = PLAIN() && E.FIND_PLAIN[t];
  v.innerHTML = `<div class="vw-img"><img src="img/${img}.jpg" alt="${esc(E.DET_NAME(d))}: ${esc(t)}"></div><div class="vw-cap"><div class="vw-h"><b>${esc(E.DET_NAME(d))}</b> · ${esc(p.name)}</div><div class="vw-f">${esc(t)}${pl ? ` <small>${esc(pl)}</small>` : ''}</div>${LOOK[img] ? `<div class="vw-look"><b>Look for:</b> ${esc(LOOK[img])}</div>` : ''}${cr ? `<div class="vw-cr">Image: ${cr.u ? `<a href="${esc(cr.u)}" target="_blank" rel="noopener">${esc(cr.t)}</a>` : esc(cr.t)}</div>` : ''}<button type="button" class="big vw-x" data-vw="x">Close</button></div>`;
  v.addEventListener('click', e => { if (e.target.closest('[data-vw="x"]') || !e.target.closest('.vw-cap')) closeViewer(); });
  document.body.appendChild(v); U.viewer = { pid, d };
}
function closeViewer() { const v = document.getElementById('viewer'); if (v) v.remove(); U.viewer = null; }
/* The named tests a card shows: the attending's own orders, or (for the charge nurse) what the provider ordered. */
function detShown(p) {
  if (p.det && p.det.length) return p.det;
  if (MD() && mine(p)) return [];
  return E.needOf(p).n.filter(d => p.wk.includes(E.DET_KIND(d)));
}
function ordersBlock(p, G, add) {
  if (!U.ord || U.ord.pid !== p.id) U.ord = { pid: p.id, tests: [], treats: [] };
  const o = U.ord;
  const chip = (kind, key, lbl, sub) => {
    const done = kind === 't' ? (key === 'ecg' ? p.wk.includes('ecg') : (p.det || []).includes(key)) : (E.DRUGS[key] || E.PROC[key]) ? (p.drugs || []).includes(key) : p.tr.includes(key), on = (kind === 't' ? o.tests : o.treats).includes(key);
    return `<button type="button" class="och${done ? ' done' : on ? ' on' : ''}" data-act="ordT" data-arg="${p.id}|${kind}|${key}" ${done ? 'disabled' : ''} aria-pressed="${on}"><b>${lbl}</b>${done ? '<small>Ordered</small>' : sub ? `<small>${sub}</small>` : ''}</button>`;
  };
  const n = o.tests.length + o.treats.length, need = p.ord === 'need';
  const title = p.ord === 'more' ? `The workup isn’t complete. Add what is missing.${gapHint(p)}` : add ? 'Add orders' : 'Write orders';
  const lbl = n ? `Sign ${n} order${n > 1 ? 's' : ''}` : need ? 'Sign with no orders' : 'Pick orders to add';
  return `<div class="prim"><div class="prim-l">${title}</div><div class="om">${orderMenus(chip, o)}</div><button type="button" class="big act" data-act="sign" data-arg="${p.id}" ${n || need ? '' : 'disabled'}>${lbl}</button><p class="hint" style="margin:0">Order what they need and nothing extra. Extra tests cost time, and some treatments hurt people who don't need them.</p><p class="rep-note">A teaching game, not clinical guidance. No licensed clinician has reviewed it yet.</p></div>`;   // Clinical safety (QA round 2): on the order sheet too
}
// The attending's own patient whose diagnosis isn't named yet: plain-word glosses wait (they'd give it away).
const dxPending = p => MD() && mine(p) && !p.dxK && !(E.G && E.G.train) && !p.gray && !E.NODX.has(p.ck);
/* v0.28: the attending names the diagnosis from the exam and the results. */
function dxBlock(p) {
  const ev = [E.examOf(p)].concat(p.wk.includes('ecg') && p.work.ecg && p.work.ecg.st === 'done' && p.find.ecg ? [`ECG: ${p.find.ecg}`] : [], (p.det || []).map(d => { const r = (p.dres && p.dres[d]) || E.detResult(p, d); return r && r[0] ? `${(E.LABS[d] || E.IMGS[d] || {}).n || d}: ${r[0]}` : null; })).filter(Boolean);
  return `<div class="prim"><div class="prim-l">What’s the diagnosis?</div>${ev.length ? `<ul class="dxev">${ev.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="hint" style="margin:0">A miss costs accuracy and raises your legal risk.</p><div class="cgrid">${p.dxq.map(d => `<button type="button" class="cbtn" data-act="dxPick" data-arg="${p.id}|${esc(d)}"><b>${esc(d)}</b></button>`).join('')}</div></div>`;
}
function mdDecideBlock(p) {
  const b = (k, l, sub) => `<button type="button" class="cbtn" data-act="mdd" data-arg="${p.id}|${k}"><b>${l}</b><small>${sub}</small></button>`;
  const tr = !!g().train;   // QA2-1: on a shift the heading is the attending's own call, and the teaching line waits for the report
  return `<div class="prim"><div class="prim-l">Your call · ${esc(tr ? p.dx : dxOr(p))}</div>${p.txGap && p.txGap.length ? `<p class="hint bad" style="margin:0">${gapMsg(p)}</p>` : tr && E.whyOf(p) ? `<p class="hint why"><b>The workup:</b> ${esc(E.whyOf(p))}${p.ordLog && p.ordLog.extra.length ? ` <span class="xtra">Not needed: ${esc(p.ordLog.extra.join(', '))}.</span>` : ''}${p.ordLog && p.ordLog.fine && p.ordLog.fine.length ? ` <span class="fine">Also reasonable: ${esc(p.ordLog.fine.join(', '))}.</span>` : ''}</p>` : ''}<div class="cgrid three">${b('home', 'Discharge home', 'No admission needed')}${b('consult', 'Admit: call a consult', 'Pick the service')}${b('transfer', 'Transfer', 'Care you lack')}</div></div>`;
}
const MOOD = ['🙂', '😐', '😠', '🤬'];
function consultSheet(G, p) {
  const second = E.con2Open(p);
  let h = head(second ? 'Who else do you call?' : 'Who do you call?', `${esc(p.name)} · ${esc(dxOr(p))}`);
  if (second) h += `<p class="hint">${esc(E.SPECS[p.consult.spec].name)} is on board. Some patients need two services: one to fix the problem, one to manage everything else.</p><div class="cgrid">`;
  else h += `<p class="hint">Consultants get angry if you call before the results they need are back, or if you call the wrong service. Angry consultants come slower.</p><div class="prim"><button type="button" class="cbtn" data-act="consultPhone"><b>Admit by phone: Hospitalist</b><small>You make the admission call. Dr. Fenn accepts without coming down and sees them upstairs. Medical admissions only.</small></button></div><div class="cgrid">`;
  for (const k in E.SPECS) { const S = E.SPECS[k], m = G.spec[k].mood; h += `<button type="button" class="cbtn" data-act="consultSpec" data-arg="${k}"><b>${S.name}</b><small>${S.what} · ${S.doc} ${MOOD[-m] || MOOD[0]}</small></button>`; }
  return h + '</div>';
}
function staffStatus(s, G) {
  const t = G.t;
  if (s.st === 'break') return `On break · back in ${fm(s.until - t)}`;
  if (s.st === 'away') return `Away · back in ${fm(s.until - t)}`;
  if (s.st === 'pending') return s.tag === 'swing shift' ? `Starts at 11:00 (in ${fm(s.until - t)})` : s.tag === 'Fast Track 09:00' ? `Starts at 09:00 (in ${fm(s.until - t)})` : `Arriving in ${fm(s.until - t)}`;
  if (s.st !== 'on') return stLabel(s);
  let x;
  const room = k => { const p = k && k.pid ? E.pt(k.pid) : null; return p && p.room ? ' ' + p.room : ''; };
  if (E.isProv(s)) { const k = s.q[0]; x = (s.pit ? 'Stationed in triage · ' : '') + (k ? taskLabel(k) + (s.q.length > 1 ? ` · ${s.q.length - 1} more in line` : '') : 'Free'); }
  else if (s.role === 'rn') {
    const L = E.nurseLoad(s), cap = E.ratioCap(s), k = s.task, triOnly = s.zones.length === 1 && s.zones[0] === 'triage';
    x = triOnly ? 'Triage' : !s.zones.length ? 'Resource nurse: helps any pod' : `Load ${fl(L)}/${cap}${L > cap ? ' · over ratio' : ''}`;
    if (s.escortUntil > t) x += ' · escorting a patient to the ICU';
    else if (k) x += ` · ${{ triage: 'Triaging', recheck: 'Rechecking', assess: 'Assessing', treat: 'Giving meds', dc: 'Discharging', report: 'Calling report', lab: 'Drawing labs', ecg: 'Doing an ECG' }[k.kind] || ''}${k.kind === 'triage' || k.kind === 'recheck' ? ' ' + (E.pt(k.pid) ? E.label(E.pt(k.pid)) : '') : room(k)}`;
    if (s.tq.length) x += ` · ${s.tq.length} to triage or recheck`;
  } else if (s.role === 'pct') {
    const k = s.task, p = k && k.pid ? E.pt(k.pid) : null;
    x = (!k ? 'Free' : k.kind === 'sit' ? `1:1 sitter in ${p && p.room}` : k.kind === 'errand' || k.kind === 'trip' ? k.label : `${{ ecg: 'ECG', lab: 'Blood draw', xport: 'Transport upstairs', morgue: 'Morgue transport', run: 'Running the MTP cooler' }[k.kind]}${p && p.room ? ' ' + p.room : p ? ' (' + where(p).toLowerCase() + ')' : ''}`) + (s.q.length ? ' · then a transport upstairs' : '');
  } else if (s.role === 'rt') { const k = s.task; x = !k ? 'Free' : k.kind === 'code' ? `At the code${room(k)}` : k.kind === 'airway' ? `Intubation${room(k)}` : `${E.TREAT[k.key].label}${room(k)}`; }
  else if (s.role === 'rph') { const k = s.task, n = E.active().reduce((a, p) => a + Object.keys(p.treat).filter(q => p.treat[q].st === 'verify').length, 0); x = (k ? `Verifying${room(k)}` : 'Free') + (n ? ` · ${n} order${n > 1 ? 's' : ''} waiting` : ''); }
  else if (s.role === 'evs') x = s.task ? `Cleaning ${s.task.room}` : 'Free';
  else if (s.role === 'uc') { const t = s.task ? (E.G.clerk || []).find(c => c.id === s.task.cid) : null; x = t ? E.CLERK[t.k].name + (t.pid && E.pt(t.pid) ? ': ' + E.pt(t.pid).name : '') : 'Free'; }
  else if (s.role === 'reg') { const k = s.task, p = k ? E.pt(k.pid) : null; x = (k ? `${k.full ? 'Finishing registration for' : 'Quick-registering'} ${p ? E.label(p) : ''}` : 'Free') + (s.q.length ? ` · ${s.q.length} in line` : ''); }
  else if (s.role === 'tp') { const k = s.task, p = k && k.pid ? E.pt(k.pid) : null; x = (!k ? 'Free' : k.kind === 'walk' ? `Heading to ${p ? E.label(p) : 'the ED'}` : 'Taking a patient upstairs') + (s.q.length ? ` · ${s.q.length} waiting` : ''); }
  if (t - s.lastBreak > 300) x += ' · needs a break';
  return x;
}
function staffRow(s) {
  const zones = s.role === 'rn' ? `<span class="szones">${s.zones.length ? s.zones.map(z => E.ZONE_NAME[z]).join(' + ') : 'Any pod (resource)'}</span>` : s.pit ? '<span class="szones">Triage</span>' : '';
  const sk = SKILL[s.skill] ? ` <i class="stag sk-${s.skill}">${SKILL[s.skill]}</i>` : '';
  return `<div class="srow ${s.st}"><button type="button" class="mg ${RC[s.role]}" data-act="staffOpen" data-arg="${s.id}" aria-label="${esc(s.name)} details">${isMe(s) ? 'You' : esc(s.short.slice(0, 1) + s.short.slice(1, 2).toLowerCase())}</button><span class="sinfo"><b>${esc(s.name)}${s.tag ? ` <i class="stag">${esc(s.tag)}</i>` : ''}${sk}</b>${zones}<small data-stx="${s.id}"></small><i class="mor"><i data-mor="${s.id}"></i></i></span>${s.st === 'on' && !MD() ? `<button type="button" class="sb" data-act="brk" data-arg="${s.id}">Break</button>` : ''}</div>`;
}
function teamHTML(G) {
  const groups = [[MD() ? 'Providers' : 'Providers (tap a badge to station one in triage)', s => E.isProv(s)], ['Nurses', s => s.role === 'rn'], ['Patient care techs', s => s.role === 'pct'], ['Registration', s => s.role === 'reg'], ['Unit secretary', s => s.role === 'uc'], ['Transport', s => s.role === 'tp'], ['Respiratory therapy', s => s.role === 'rt'], ['Pharmacy', s => s.role === 'rph'], ['Environmental services', s => s.role === 'evs']];
  let h = `<div class="legend"><i></i>Bars show morale.${MD() ? ' The charge nurse runs breaks.' : ' Breaks bring it back up.'}</div>`;
  for (const [title, f] of groups) {
    const list = G.staff.filter(s => f(s) && !['off', 'sick', 'gone'].includes(s.st));
    h += `<h4>${title}</h4><div class="slist">${list.map(staffRow).join('') || '<p class="hint">Nobody.</p>'}</div>`;
  }
  const brd = E.boarders().length, held = E.holds().length, hn = E.holdNurses();
  h += `<h4>Admitted patients in the ED</h4><div class="house">${held} holding ED beds${hn.length ? ` · hold nurse ${hn.map(s => `${esc(s.short)} (load ${fl(E.nurseLoad(s))}/${E.ratioCap(s)})`).join(' + ')}` : ''}</div>${MD() ? '' : `<div class="team-acts"><button type="button" data-act="zone" data-arg="hold">${hn.length ? 'Change the hold nurse' : 'Assign a hold nurse'}</button></div>`}`;
  h += `<h4>House</h4><div class="house">House Supervisor Pat: ${brd} admitted patient${brd === 1 ? '' : 's'} waiting on beds · ${G.house.esc} bed favor${G.house.esc === 1 ? '' : 's'} left<br>Observation unit: ${G.obsUnit.filled} of ${G.obsUnit.cap} beds full<br>Blood bank: ${G.blood.oneg} units of O-negative${G.mods.bbSlow > G.t ? ' · crossmatch slow' : ''}<br>Interpreters: video line ${G.mods.interpDown > G.t ? 'down' : 'up'}, ASL in person<br>Pharmacy: ${G.staff.some(s => s.role === 'rph' && s.st === 'on') ? 'ED pharmacist on' : G.mods.remoteRph ? 'central pharmacy, remote and slow' : 'nobody verifying'}<br>Interfacility ambulances: ground units ${G.mods.iftSlow > G.t ? 'running 30 min slow' : 'normal'} · helicopters ${G.mods.airWx > G.t ? 'grounded' : 'flying'}<br>EVS line: ${G.evsQ.length ? G.evsQ.join(', ') : 'empty'} · Security: ${G.sec.busy > G.t ? 'busy' : 'available'}</div>`;
  if (!MD()) h += `<div class="team-acts"><button type="button" data-act="pizza" ${G.pizza ? 'disabled' : ''}>${G.pizza ? 'Pizza ordered' : 'Buy pizza for the ED'}</button></div>`;
  return h;
}
function staffSheet(G, s) {
  if (!s) return '';
  let h = head(esc(s.name), s.title + (s.tag ? ' · ' + esc(s.tag) : ''));
  h += `<div class="slist">${staffRow(s)}</div>`;
  if (E.isProv(s)) {
    if (E.present(s) && !MD()) h += `<div class="sh-acts">${s.pit ? `<button type="button" data-act="pit" data-arg="${s.id}|0">Bring ${esc(s.short)} back from triage</button>` : `<button type="button" class="hl" data-act="pit" data-arg="${s.id}|1">Station ${esc(s.short)} in triage</button>`}</div><p class="hint">A provider in triage sees waiting-room patients, starts labs and imaging from there, and sends simple cases home without a bed. They can't take patients in rooms while stationed there.</p>`;
    h += `<h4>In line</h4><ol class="q">${s.q.length ? s.q.map((k, i) => { const p = E.pt(k.pid); return `<li>${i === 0 && k.started ? 'Now: ' : ''}${esc(k.type === 'box' ? 'Box consult' : `${taskLabel(k)} · ${p ? p.age + p.sex + ' ' + dxOr(p) : ''}`)}</li>`; }).join('') : '<li>Nothing in line</li>'}</ol>`;
  }
  return h;
}
function zoneSheet(G, z) {
  const zn = E.ZONE_NAME[z], hold = z === 'hold', load = hold ? E.holdLoad() : E.zoneLoad(z, hasHold()), cap = E.zoneNurses(z).length * (hold ? 5 : 4);
  const why = z === 'triage' ? 'The triage nurse triages walk-ins and rechecks the waiting room. A new graduate can\'t triage. To put a provider in triage, open one from Team.'
    : hold ? 'A hold nurse takes every admitted patient still in the ED, up to 5. Pod nurses stop counting them, and the hold nurse calls report upstairs.'
    : z === 'rp' ? 'Chairs are for patients a provider has seen who are waiting on results or a ride. They barely count against a nurse, and they free beds.'
    : `A nurse carries 4 points safely. ESI 3 to 5: 1 point. ESI 2: 2. ESI 1: 4. A resuscitation: 6.${z === 'resus' ? ' Two at once needs a third nurse. A new graduate can\'t take Resus.' : ''} Over 4, safety and morale slip.`;
  let nurses = `<p class="hint">${why} Tap a nurse to add or remove them.</p><div class="zgrid">`;
  for (const s of G.staff.filter(x => x.role === 'rn' && ['on', 'break', 'away', 'pending'].includes(x.st))) {
    nurses += `<button type="button" class="zbtn ${s.zones.includes(z) ? 'on' : ''}" data-act="zt" data-arg="${s.id}|${z}"><b>${esc(s.short)}${SKILL[s.skill] ? ` <i class="stag sk-${s.skill}">${SKILL[s.skill]}</i>` : ''}</b><small>${s.zones.length ? s.zones.map(x => E.ZONE_NAME[x]).join(' + ') : 'Resource (any pod)'}${s.st !== 'on' ? ' · ' + stLabel(s) : ''}<br><span data-load="${s.id}"></span></small></button>`;
  }
  nurses += '</div>';
  if (z === 'triage') {   // the front of the house: pick a person here when the floor plan is zoomed out
    const door = G.triageQ.map(E.pt).filter(Boolean), wait = E.active().filter(p => p.loc === 'waiting').sort((a, b) => ve(a) - ve(b) || a.tArrive - b.tArrive);
    const magB = p => `<div class="mag-row"><button type="button" class="${magCls(p, G)}" data-act="pt" data-arg="${p.id}" aria-label="${esc(p.name)}, ${E.ageSex(p)}, ${esc(p.cc)}">${magHTML(p)}</button><button type="button" class="mag-card" data-act="ptCard" data-arg="${p.id}" aria-label="Open the card for ${esc(p.name)}">Card</button></div>`;
    const wall = wallPts(), atWall = !!(U.sheet && U.sheet.at === 'wall');
    const sec = (t, list, none) => `<div><h4>${t}</h4><div class="mag-list">${list.map(magB).join('') || `<p class="hint" style="margin:0">${none}</p>`}</div></div>`;
    const wallSec = sec('On the wall', wall, 'No ambulance crews are waiting.'), doorSec = sec('At the door', door, 'Nobody at the door.'), waitSec = sec('Waiting room', wait, 'Nobody is waiting.');
    let h = atWall ? head('The wall', `${plural(wall.length, 'ambulance crew')} waiting to hand over`) + wallSec + doorSec + waitSec
      : head('Waiting room', `${wait.length} in the waiting room · ${door.length} at the door`) + doorSec + waitSec + (wall.length && U.view === 'map' ? wallSec : '');
    if (MD()) return h + '<p class="hint">The charge nurse runs intake. Tap a patient to open their card.</p>';
    const ago = G.t - G.wrUpdate, n = wait.length + door.length;
    h += `<div class="sh-acts"><button type="button" class="hl" data-act="updWait" ${ago < 30 || !n ? 'disabled' : ''}>${!n ? 'Nobody is waiting' : ago < 30 ? `You walked the room ${fm(ago)} ago` : `Walk the waiting room and update ${n} ${n > 1 ? 'people' : 'person'}`}</button></div><p class="hint">An honest update buys patience: people stay about 20 minutes longer before they walk out.</p>`;
    return h + `<div><h4>Triage nurses</h4>${nurses}</div>`;
  }
  let h = head(hold ? 'Hold nurse' : `${zn} nurses`, hold ? `${plural(E.holds().length, 'admitted patient')} in ED beds` : `${plural(E.zonePts(z), 'patient')} · load ${fl(load)} of ${cap}`) + nurses;
  if (hold) h += `<div class="sh-acts"><button type="button" data-act="agency" data-arg="hold" ${G.mods.noAgency ? 'disabled' : ''}>Call an agency RN for holds (~40 min)</button></div>`;
  else {
    const closed = G.rooms.some(r => r.z === z && r.closed);
    h += `<div class="sh-acts">${closed ? `<button type="button" data-act="zopen" data-arg="${z}">Reopen ${zn}</button>` : `<button type="button" data-act="zclose" data-arg="${z}" ${E.zonePts(z) ? 'disabled' : ''}>Close ${zn}</button>`}<button type="button" data-act="agency" data-arg="${z}" ${G.mods.noAgency ? 'disabled' : ''}>Call an agency RN (~40 min)</button></div>`;
  }
  return h;
}
function boxDocSheet(G) {
  const c = G.box.cur;
  if (!c || c.kind !== 'consult' || c.taken) return '';
  let h = head('Find a doctor', `${esc(c.unit)} needs medical direction. The ring timer is still running.`);
  h += '<p class="hint">A medic needs orders, and only an attending can give them. Whoever takes the call handles it, and stops what they’re doing for about 5 minutes. Pick someone who isn’t in a code.</p><div class="pgrid">';
  for (const s of G.staff.filter(x => x.role === 'md' && E.present(x))) h += `<button type="button" class="pbtn r-md" data-act="boxDoc" data-arg="${s.id}" ${s.st === 'on' ? '' : 'disabled'}><b>${esc(s.name)}</b><small>${s.st === 'on' ? `<span data-stx="${s.id}"></span>` : stLabel(s)}</small></button>`;
  return h + '</div>';
}
function divertSheet(G) {
  const outs = Object.keys(G.out).filter(k => G.out[k].until > G.t);
  let h = head('Diversion status', 'Tell EMS what this ED can’t take right now');
  h += outs.length ? `<div class="dv-out"><b>Broken right now</b>${outs.map(k => `<span>${E.OUTAGES[k].name} · back in about <span data-cd="${G.out[k].until}"></span></span>`).join('')}</div>` : '<p class="hint">Nothing is broken right now. Use ED Full or No Monitored Beds only when the department is full.</p>';
  const card = k => {
    const D = E.DIVERTS[k], d = G.dv[k], susp = D.capacity && G.region.susp > G.t, blocked = D.capacity && (G.mods.noDivert > G.t || susp) && !d.on;
    return `<div class="dv ${k}${d.on ? ' on' : ''}${D.capacity ? ' cap' : ''}"><b>${D.name}${d.on ? ` · on for ${fm(G.t - d.since)}` : ''}</b><p><i>${D.when}.</i> ${D.what}</p><button type="button" data-act="divertSet" data-arg="${k}|${d.on ? 0 : 1}" ${blocked ? 'disabled' : ''}>${d.on ? `Lift ${D.name}` : susp ? 'The region suspended alerts' : blocked ? 'Administration blocked divert' : `Go on ${D.name}`}</button></div>`;
  };
  h += '<h4>When something breaks</h4>' + ['ct', 'stemi', 'trauma', 'disaster'].map(card).join('');
  h += '<h4>When you’re full</h4>' + ['yellow', 'red'].map(card).join('');
  const nb = G.region.hosps.map(x => `${esc(x.name)}: ${x.st === 'open' ? 'open' : 'ED Full'}`).join(' · ');
  h += `<div class="dv region"><b>The region</b><p>${nb}.${G.region.susp > G.t ? ` <b>Capacity alerts are suspended for <span data-cd="${G.region.susp}"></span>.</b>` : ''} Neighbors on alert send you more ambulances. If three hospitals are on capacity alerts at once, the region suspends all of them and everyone takes ambulances.</p></div>`;
  const ready = G.t - G.fcp.last >= 240;
  h += `<div class="dv fcp"><b>Full-capacity protocol</b><p><i>The ED is packed and admitted patients are holding its beds.</i> Up to 4 admitted floor patients go to inpatient hallway beds now. Their nurses still call report. Once every 4 hours; the hospitalists won't love it.</p><button type="button" data-act="fcp" ${ready ? '' : 'disabled'}>${ready ? 'Run the full-capacity protocol' : `Available at ${E.clock(G.fcp.last + 240)}`}</button></div>`;
  return h + '<p class="hint">A diversion that matches what broke costs little, and going on it fast earns points. Lift it as soon as the fix is in. Diverting when nothing is broken, or staying on after the fix, costs a lot and draws calls from administration and the EMS system.</p>';
}
/* ---------- Words: every short name the game uses, in plain language ----------
   The Orientation explains each one the first time it comes up. This is the whole list, reachable from the preceptor's card,
   How to play, and the pause menu. Nothing here simplifies the game; it only says what the words mean. */
const GLOSS = [
  ['The people', [
    ['Charge nurse', 'The nurse in charge of the whole department for the shift. Decides who goes in which bed and who takes care of them.'],
    ['Attending', 'A fully trained emergency physician. The senior doctor in the department.'],
    ['PA, NP', 'Physician assistant and nurse practitioner. They examine patients and write orders, with an attending behind them.'],
    ['Provider', 'Whoever examines the patient and writes the orders: an attending, a PA, or an NP.'],
    ['RN', 'Registered nurse. Gives the medications, watches the patient, and carries out the orders.'],
    ['Triage nurse', 'The nurse at the front door who decides how sick each new patient is.'],
    ['Resource nurse', 'A nurse with no pod of her own, sent wherever the work is heaviest.'],
    ['Hold nurse', 'A nurse who takes the admitted patients still waiting in the ED, so the pod nurses can take new ones.'],
    ['PCT, tech', 'Patient care technician. Draws blood, does ECGs, moves patients, and helps the nurses.'],
    ['RT', 'Respiratory therapist. Runs the breathing equipment: nebulizers, BiPAP, high-flow oxygen, ventilators.'],
    ['PharmD', 'The pharmacist. Checks each medication order before the nurse gives it.'],
    ['EVS', 'Environmental services. The housekeepers who clean a room between patients.'],
    ['Registrar', 'Takes the patient’s name, date of birth, and insurance, so tests and medications go to the right person.'],
    ['Beds upstairs', 'ICU, step-down, telemetry, med-surg, psych and observation. A bed opens when someone upstairs goes home. Direct admissions from clinics and the OR compete for them. Tap the Beds chip, top right, to see them.'],
    ['Transfer', 'Sending a patient to another hospital for care you don’t have. Find a hospital that can do it, call to get them accepted, pick the transport, give report.'],
    ['Transport levels', 'Wheelchair van: sits up, no care on the way. BLS: EMTs, a stretcher, oxygen. ALS: paramedics with a monitor and IV drugs. Critical care ground: an ICU nurse or medic team for drips and vents. Critical care flight: the same by helicopter, when time matters.'],
    ['Helipad', 'Across the road from the ambulance bay. The helicopter lands, the flight crew comes in for report, and they fly the patient out. Tap “Helicopter on the pad” to watch.'],
    ['Anesthesia', 'The airway experts. Call them for a hard intubation: burns to the airway, swelling in the throat.'],
    ['Critical care team', 'The ICU doctors. Call them for shock: lines, pressors, the ventilator. They also push the ICU bed request.'],
    ['CURB-65', 'A pneumonia risk score. One point each for confusion, a high BUN (urea), breathing 30 or faster, low blood pressure, and age 65 or more. 0 to 1 goes home on pills; 3 or more is admitted.'],
    ['Weather', 'Picked before a shift. Rain and snow bring crashes and falls and slow the ambulances; fog and storms ground the helicopters.'],
    ['UC, unit secretary', 'The ED’s clerk: calls rides, makes calls, and handles paperwork. Tap UC and hand them a task.'],
    ['Transport', 'Staff who wheel patients to their bed upstairs, so nurses and techs can stay in the department.'],
    ['EMS, medic', 'Emergency medical services: the ambulance side of medicine. A medic is a paramedic. “Medic 7” is an ambulance crew.'],
    ['Consultant', 'A specialist, such as a surgeon or cardiologist, called to see a patient and usually to admit them. On the map they come down in the elevator, see the patient, and go back up.'],
    ['Hospitalist', 'The doctor who looks after most patients once they’re admitted. Call the hospitalist for infections, breathing trouble, and heart failure.'],
    ['Cardiology, neurology, and the rest', 'The teams you call to admit. Cardiology: heart. Neurology: brain. General surgery: belly. Trauma: serious injuries. Orthopedics: bones. GI: stomach or bowel bleeding. Psychiatry: mental health. Critical care: the ICU.'],
    ['House Supervisor', 'The nurse who manages beds for the whole hospital. The one to push when no bed opens upstairs.'],
    ['Preceptor', 'The experienced nurse or doctor who trains a new one.'],
    ['New grad', 'A nurse in the first year. Not yet allowed to triage or to take Resus.'],
    ['Resus-trained', 'A nurse trained to run the care of the sickest patients.'],
    ['Biomed', 'The hospital’s equipment engineers.'],
    ['Eval 5, Recheck 2, +1', 'On a provider’s button. Eval 5: examining the patient in Room 5. Recheck 2: back in Room 2 to go over results. +1: one more patient waiting for them.'],
  ]],
  ['The places', [
    ['ED', 'Emergency department.'],
    ['Pod', 'A group of four rooms that share one nurse.'],
    ['Resus', 'Short for resuscitation. The rooms with the most equipment, for patients who could die in minutes.'],
    ['Hallway bed', 'A stretcher in the hall. A last resort when the rooms are full.'],
    ['Fast Track', 'Rooms for quick, minor problems. Opens at 09:00.'],
    ['Chairs', 'Recliners for patients who have been seen and are only waiting on a result or a ride.'],
    ['The wall', 'Where ambulance crews wait with their patient until a nurse takes report. Crews call it holding the wall.'],
    ['The Box', 'The radio that ambulance crews use to call the hospital.'],
    ['Obs', 'The observation unit. A stay of a day or so, to watch a patient and finish testing.'],
    ['ICU, PICU', 'Intensive care unit, for the sickest patients. A PICU is one for children.'],
    ['OR', 'Operating room.'],
    ['Cath lab', 'Where cardiologists open a blocked heart artery.'],
    ['The floor, upstairs', 'The wards upstairs, where admitted patients go. Nurses call them the floor.'],
    ['Rehab', 'A rehab or nursing facility. For someone who can leave the ED but can’t manage at home yet. They need an ambulance ride, which the unit secretary calls.'],
  ]],
  ['Your scores', [
    ['Patients', 'Patient satisfaction: how patients feel about the visit. Long waits with no update pull it down.'],
    ['Clinical', 'Clinical accuracy: the right care, on time. Harm, misses, and returns pull it down.'],
    ['Admin', 'Admin satisfaction: flow and cost. Walkouts, wall time, and needless costs pull it down.'],
    ['Staff', 'How your team is holding up. Tired, overloaded staff slow down, and at the bottom they walk out.'],
    ['Waiting on you', 'The meter by the zoom buttons: patients waiting for your next step. Green is fine. Red and shaking means more than 10.'],
    ['LWBS', 'Left without being seen. People who gave up and walked out of the waiting room.'],
    ['Wall', 'Ambulance crews waiting to hand over a patient.'],
    ['Experience', 'How a patient and the family feel about the visit, as a percent. Long waits with no update pull it down.'],
  ]],
  ['How sick', [
    ['Triage', 'Sorting patients by how sick they are, not by who came first.'],
    ['ESI', 'Emergency Severity Index, the triage level. 1: needs a life-saving action now. 2: high risk, should not wait. 3: stable, needs several tests or treatments. 4: needs one. 5: needs none.'],
    ['Vitals', 'Vital signs: heart rate, blood pressure, breathing rate, oxygen level, and temperature. A number in red is out of range.'],
    ['HR', 'Heart rate, in beats a minute. An adult at rest runs 60 to 100.'],
    ['BP', 'Blood pressure, written as two numbers, about 120/80. A top number under 90 is dangerous.'],
    ['RR', 'Respiratory rate, in breaths a minute. An adult at rest runs 12 to 20.'],
    ['SpO2', 'Oxygen saturation: how much oxygen the blood is carrying. Normal is 95% or more.'],
    ['Temp', 'Temperature, in Fahrenheit. 100.4 or more is a fever.'],
    ['Alert', 'A warning an ambulance calls in for a patient who can’t wait (trauma, stroke, heart attack, sepsis), so the right team is standing in the room.'],
    ['Code', 'A cardiac arrest: the heart has stopped. The team does CPR.'],
    ['CPR', 'Cardiopulmonary resuscitation: hard, fast chest compressions and breaths that keep blood moving while the heart is stopped.'],
    ['VF', 'Ventricular fibrillation: the heart quivers instead of pumping. Shockable: defibrillate right away.'],
    ['Pulseless VT', 'Ventricular tachycardia with no pulse: a fast rhythm that pumps nothing. Shockable, like VF.'],
    ['PEA', 'Pulseless electrical activity: a rhythm on the monitor, but no pulse. Not shockable: CPR, epinephrine, and find the cause.'],
    ['Asystole', 'A flat line on the monitor: no electrical activity. Not shockable.'],
    ['Defibrillation', 'A strong shock that resets a quivering heart (VF or pulseless VT).'],
    ['ROSC', 'Return of spontaneous circulation: the pulse comes back after a cardiac arrest.'],
    ['H’s and T’s', 'The reversible causes of a cardiac arrest. H: hypovolemia (low volume), hypoxia (low oxygen), hydrogen ions (acid), hypo- or hyperkalemia (potassium), hypothermia (cold). T: tension pneumothorax, tamponade, toxins, thrombosis (a clot in the heart or lungs).'],
    ['Tension pneumothorax', 'Air trapped outside a lung, pressing on the heart. Fixed by decompressing the chest with a needle or a cut.'],
    ['Tamponade', 'Fluid around the heart squeezing it so it can’t fill. Fixed by draining it.'],
    ['A-fib', 'Atrial fibrillation: a fast, irregular rhythm from the top of the heart.'],
    ['Synchronized cardioversion', 'A shock timed to the heartbeat, for a fast rhythm that has a pulse but is crashing the blood pressure.'],
    ['PALS', 'Pediatric Advanced Life Support: the children’s version of ACLS. Doses go by weight.'],
    ['ACLS', 'Advanced Cardiovascular Life Support: the adult algorithms for cardiac arrest and dangerous rhythms.'],
    ['Shock', 'Too little blood reaching the organs. Fast heart rate, low blood pressure.'],
    ['Recheck', 'Repeating the vital signs of someone in the waiting room, to catch people who are sicker than their triage level.'],
    ['Complaint', 'What the patient came in for, in a few words.'],
    ['19M, 58F', 'Age and sex: a 19-year-old male, a 58-year-old female.'],
    ['ETA', 'Estimated time of arrival: the minutes until an ambulance gets here.'],
    ['Crashing', 'Suddenly getting much worse.'],
    ['Under-triaged', 'Given an ESI number too low for how sick the patient really is. A recheck catches it.'],
    ['STAT', 'Right now. Marking a patient STAT moves their tests and treatments to the front of the line.'],
    ['GCS', 'Glasgow Coma Scale. How awake someone is, from 3, no response, to 15, fully awake.'],
    ['Last known well', 'The last time anyone saw the patient acting normally. The clot-dissolving drug for a stroke is given within four and a half hours of it. Later needs perfusion imaging, which this game doesn’t model.'],
    ['Red, yellow, green tag', 'At a scene with many patients, crews tag each one. Red: treat now. Yellow: can wait a little. Green: walking wounded.'],
  ]],
  ['Tests', [
    ['Workup', 'The set of tests that finds out what is wrong.'],
    ['Labs', 'Blood and urine tests. The attending orders them one at a time.'],
    ['CBC', 'Complete blood count: white cells (infection), hemoglobin (blood loss), platelets (clotting).'],
    ['BMP', 'Basic metabolic panel: sodium, potassium, kidney function, and blood sugar.'],
    ['Lipase', 'An enzyme from the pancreas. High when the pancreas is inflamed.'],
    ['BNP', 'A hormone the heart releases when it’s stretched. High in heart failure.'],
    ['D-dimer', 'A clot breakdown product. A low one helps rule out a clot; a high one proves nothing.'],
    ['Blood cultures', 'Blood put in bottles to grow any bacteria. Drawn before antibiotics, read in a day or two.'],
    ['Blood gas (VBG)', 'How acid the blood is and how much carbon dioxide it holds. It also gives the carbon monoxide level.'],
    ['Coags (PT/INR)', 'How fast blood clots. The INR is high on the blood thinner warfarin.'],
    ['Type and screen', 'The blood type and a check for antibodies, so the blood bank can match blood quickly.'],
    ['Urinalysis', 'A urine test for infection and blood.'],
    ['CK', 'Creatine kinase. Released by damaged muscle, after a long time on the floor or a crush.'],
    ['FAST', 'Focused assessment with sonography in trauma: a bedside ultrasound for blood in the belly or around the heart.'],
    ['CT angiogram (CTA)', 'A CT with dye in the arteries. It shows a blocked artery (a stroke) or a clot in the lungs.'],
    ['MRI', 'Magnetic pictures with fine detail, best for the brain and spinal cord. It takes about an hour and the patient leaves the department.'],
    ['Flank', 'The side of the back, over the kidney.'],
    ['Guarding', 'Belly muscles that tighten when pressed. A sign of something serious inside.'],
    ['Crackles', 'A wet, crackling sound in the lungs: fluid or infection.'],
    ['ECG', 'Electrocardiogram. A tracing of the heart’s electrical activity. It can show a heart attack.'],
    ['X-ray', 'A picture of the bones or the chest.'],
    ['CT', 'A scanner that takes detailed pictures inside the body. It finds bleeding in the head, appendicitis, and much else.'],
    ['Ultrasound', 'Pictures made with sound waves.'],
    ['Troponin', 'A blood test that rises when heart muscle is damaged.'],
    ['History', 'The patient’s own account of what happened.'],
    ['Normal sinus rhythm', 'A normal heartbeat on the ECG.'],
    ['Anion gap', 'A lab number that rises when acid builds up in the blood. Normal is under 12.'],
    ['Risk scores', 'Checklists that turn findings into a number: HEART for chest pain, the Canadian Syncope score for fainting, ABCD2 after a TIA.'],
    ['WBC', 'White blood cell count. It rises with infection. Normal is under 11.'],
    ['Hemoglobin, Hgb', 'The blood count. A low number means blood has been lost. Normal is about 12 to 16.'],
    ['Lactate', 'A blood test that rises when the organs are short of oxygen. High in sepsis and shock.'],
    ['HEART score', 'A 0 to 10 score for chest pain: History, ECG, Age, Risk factors, Troponin. 0 to 3 is low risk, 4 to 6 moderate, 7 and up high.'],
    ['Gray zone', 'Patients who could reasonably go home, stay for observation, or be admitted. A risk score helps you choose.'],
  ]],
  ['Treatments', [
    ['Orders', 'A provider’s instructions: which tests to run and which treatments to give.'],
    ['IV fluids', 'Salt water given into a vein.'],
    ['Antibiotics', 'Drugs that kill bacteria.'],
    ['MTP', 'Massive transfusion protocol. The blood bank sends coolers of blood at once, for a patient who is bleeding to death.'],
    ['O-negative', 'The blood type that can be given to anyone, before their own type is known.'],
    ['Thrombolytic', 'A drug that dissolves the clot in a stroke. It only works in the first few hours.'],
    ['Naloxone', 'The drug that reverses an opioid overdose.'],
    ['Aspirin', 'Keeps a clot in a heart artery from growing. Given for chest pain that may be the heart. It’s inside the Medications order.'],
    ['Analgesia', 'Pain control.'],
    ['Epinephrine', 'Adrenaline. A shot in the thigh for a severe allergic reaction; 1 mg by vein every 3 to 5 minutes in a cardiac arrest (0.01 mg/kg in a child).'],
    ['Insulin drip', 'Insulin given steadily into a vein, for dangerously high blood sugar.'],
    ['Nebulizer', 'A mist of medicine to breathe in, for asthma and COPD.'],
    ['BiPAP', 'A tight mask that pushes air in, to help a tired patient breathe.'],
    ['High-flow oxygen', 'Warm, fast oxygen through the nose. Often used for babies.'],
    ['Intubation, ventilator', 'A breathing tube in the windpipe, and the machine that breathes for the patient.'],
    ['Oxygen', 'Extra oxygen through small prongs in the nose or a mask, for a low oxygen level.'],
    ['Vasopressor', 'A drug given by drip that tightens the blood vessels to hold the blood pressure up, when fluids alone aren’t enough.'],
    ['Atropine and pacing', 'For a heart beating far too slowly: a drug to speed it up, and pads on the chest that make it beat on time.'],
    ['Blood pressure control', 'A drug that brings a dangerously high pressure down. A stroke patient has to be under 185/110 before the thrombolytic can go in.'],
    ['Reversal agent', 'Undoes a blood thinner, so a patient who is bleeding can clot again.'],
    ['Override', 'Giving a medication before the pharmacist has checked the order. Faster, with a small chance of a mistake.'],
  ]],
  ['Diagnoses', [
    ['UTI', 'Urinary tract infection.'],
    ['Sepsis', 'The body’s reaction to an infection, out of control. Antibiotics are due within the hour.'],
    ['Hemorrhage', 'Bleeding, usually heavy.'],
    ['Hypotensive', 'With a low blood pressure.'],
    ['STEMI', 'The kind of heart attack that needs a blocked artery opened in the cath lab right away.'],
    ['Stroke, LVO', 'A blocked or burst blood vessel in the brain. An LVO, large-vessel occlusion, is a big clot that may need to be pulled out.'],
    ['TIA', 'A stroke that clears up on its own within minutes. A warning sign.'],
    ['DKA', 'Diabetic ketoacidosis. Very high blood sugar with acid in the blood.'],
    ['RSV', 'A virus that clogs a baby’s small airways.'],
    ['COPD', 'Chronic lung disease, usually from smoking.'],
    ['GI bleed', 'Bleeding in the stomach or gut.'],
    ['Trauma', 'Serious injury: crashes, falls, wounds.'],
    ['Heart block', 'The heart’s wiring fails, and the beat slows to 30 or 40 a minute.'],
    ['Heart failure', 'A weak heart. Fluid backs up into the lungs: wet, crackling breathing, worse lying flat.'],
    ['Pneumonia', 'A lung infection: fever, cough, and often a low oxygen level.'],
    ['Opioid overdose', 'Too much heroin, fentanyl, or a strong painkiller. It slows the breathing until it stops. Naloxone reverses it.'],
    ['Anaphylaxis', 'A severe allergic reaction: swelling, wheezing, and a falling blood pressure. Epinephrine treats it.'],
    ['Cholecystitis', 'An inflamed gallbladder. Pain after meals, under the right ribs. An ultrasound shows it.'],
  ]],
  ['Where patients go next', [
    ['Disposition', 'Where the patient goes next: home, observation, admitted, or transferred.'],
    ['Discharge', 'Sending the patient home.'],
    ['Consult', 'Calling a specialist to see the patient. About one consulted patient in five needs a second service: a broken hip in an older patient gets orthopedics and the hospitalist.'],
    ['Clinical accuracy', 'The attending’s share of right calls: diagnoses named right and orders right, against everything called and ordered.'],
    ['Legal risk', 'How exposed you are after today’s misses. Harm and missed must-not-miss diagnoses count most. 25%: the administrator calls. 40%: peer review. 50%: a performance improvement plan, and lawyers call. 75%: the group lets you go.'],
    ['Peer review', 'Colleagues read a doctor’s charts and decide if the care met the standard.'],
    ['PIP', 'Performance improvement plan: closer review of your charts, with goals to meet.'],
    ['Risk management', 'The hospital office that handles lawsuits and complaints. Lawyers go to them, not to you.'],
    ['Must not miss', 'A diagnosis that kills or disables if it’s missed: heart attack, stroke, sepsis, a bleed.'],
    ['Resuscitation drugs', 'The drugs for an arrest, an unstable rhythm, or shock: epinephrine, amiodarone, adenosine, atropine, calcium, bicarbonate, vasopressors.'],
    ['Read-back', 'The medic repeats a radio order back so the doctor can confirm it. It catches a wrong dose.'],
    ['Admit by phone', 'The ED doctor makes the admission call and the hospitalist accepts without coming down first. Faster, for straightforward medical admissions. A surgical or heart problem still needs its specialist to see them.'],
    ['Point-of-care test', 'A test done at the bedside in a minute: a fingerstick sugar, a urine dip. It still works when the lab is down. Check the sugar early on any stroke.'],
    ['Screening', 'At the door, the first person to talk to a patient asks about cough, fever, rash and travel. A positive screen means a mask and an isolation room. Miss it, and others in the waiting room are exposed.'],
    ['Admit', 'The patient stays in the hospital, on a unit upstairs.'],
    ['Monitored bed', 'A hospital bed where the heart rhythm is watched around the clock. Also called telemetry.'],
    ['Boarding', 'An admitted patient still in an ED bed because no bed is open upstairs. The main reason emergency departments back up.'],
    ['Report', 'The hand-off from one nurse or crew to the next: who the patient is, what was found, what was done.'],
    ['Transfer center', 'The hospital office that calls other hospitals to find a bed for a patient you can’t treat here.'],
    ['Offload', 'Moving an ambulance patient off the crew’s stretcher into your bed or waiting room.'],
    ['Transfer', 'Sending the patient to another hospital that has what they need.'],
    ['ALS, critical care transport', 'Ambulances for a transfer. ALS, advanced life support, has paramedics. Critical care transport adds a nurse and ICU equipment.'],
    ['AMA', 'Against medical advice. A patient who chooses to leave after hearing the risks.'],
    ['72-hour return', 'A patient who was sent home and comes back within three days, sicker.'],
    ['Watch', 'A set time in the ED after treatment, before going home. Naloxone and epinephrine wear off; the problem can come back.'],
    ['Co-sign', 'An attending reviews a PA’s or NP’s patient and signs off.'],
    ['Medical direction', 'A doctor giving orders by radio to a paramedic in the field. Only an attending can.'],
    ['Capacity', 'Being able to understand a decision and its risks. An adult with capacity may refuse care. Someone confused, drunk, or head-injured may not have it.'],
    ['Door to needle, door to balloon', 'Time goals that start at arrival. Needle: the clot drug for a stroke, in 60 minutes. Balloon: a blocked heart artery opened, in 90.'],
  ]],
  ['When the department is in trouble', [
    ['Divert', 'Asking ambulances to take some or all patients to another hospital.'],
    ['ED Full, No Monitored Beds', 'Capacity alerts. ED Full: no room for more ambulance patients. No Monitored Beds: no beds with heart monitors left. Both ask ambulances to go elsewhere. Other places call them Yellow and Red Alert, or advisory levels.'],
    ['CT, STEMI, Trauma Divert', 'Sending one kind of patient elsewhere because what they need is broken or busy.'],
    ['Internal Disaster', 'The hospital itself is in trouble, such as no power or no lab. Almost every ambulance goes elsewhere.'],
    ['Full-capacity protocol', 'Moving admitted patients to hallways upstairs, to free ED beds.'],
    ['Ratio, load', 'How many points of work one nurse is carrying. Four is the safe limit, and sicker patients are more points. Over-ratio means over four.'],
    ['Call-out', 'A staff member who calls in sick.'],
    ['Agency, mandate', 'Ways to fill a hole in the schedule: hiring a temporary nurse, or ordering someone to stay late.'],
    ['Interpreter', 'A trained medical translator: in person, by phone, or by video. The two-letter tag on a patient is their language.'],
    ['Isolation', 'A room with special airflow, for infections that spread through the air. Rooms 8 and 16: orange dashes on the floor plan, ISO on the list board.'],
    ['Safe room, sitter', 'For a patient who might hurt themselves: a room with nothing dangerous in it (blue dots on the floor plan), or a staff member who stays with them.'],
    ['Multiple-casualty incident', 'One event with more patients than a normal day brings, such as a bus crash. EMS asks each hospital how many it can take.'],
    ['Bed huddle', 'A short meeting with the hospital to find beds upstairs.'],
    ['Saturated', 'Full. No more patients can be taken safely.'],
    ['Swing shift', 'Staff who start late in the morning and stay into the evening.'],
    ['M&M', 'Morbidity and mortality review. Going over what went wrong, to learn from it.'],
  ]],
];
function wordsHTML() {
  const q = (U.wq || '').trim().toLowerCase(), hit = (t, d) => !q || (t + ' ' + d).toLowerCase().includes(q);
  let n = 0;
  const body = GLOSS.map(([g, list]) => { const k = list.filter(([t, d]) => hit(t, d)).length; n += k; return `<div class="gl"${k ? '' : ' hidden'}><h4>${esc(g)}</h4><dl>${list.map(([t, d]) => `<div${hit(t, d) ? '' : ' hidden'}><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></div>`; }).join('');
  return head('Words', 'Every short name in the game, in plain language.') + `<div class="wsearch"><input type="search" id="wq" data-wq placeholder="Search the words" aria-label="Search the words" autocomplete="off" autocapitalize="off" spellcheck="false"></div><p class="hint wnone"${n ? ' hidden' : ''}>Nothing matches. Try a shorter word.</p>` + body + `<div class="wlink wplain"><button type="button" data-act="plain">Plain words under results and radio calls: ${PLAIN() ? 'on' : 'off'}</button></div>`;
}
/* What the floor plan's icons mean. */
function msgsHTML(s) {
  const L = U.msgs || []; let nw = s.nw || 0;
  const rows = L.map(m => { const isNew = m.filed && nw > 0; if (isNew) nw--; return `<li class="k-${m.kind}${isNew ? ' new' : ''}"><time>${E.clock(m.t)}</time><span>${esc(m.msg)}${isNew ? ' <i class="mnew">new</i>' : ''}</span></li>`; }).join('');
  return head('Events', 'Everything this shift, newest first.') + `<p class="hint" style="margin-bottom:6px"><b>Bad news</b> and anything you need to act on also shows at the top of the screen. <b>Routine news</b> (a goal met, staff arriving, a patient off to the OR) comes only here, and the bell counts it. <b>New patients</b> pop up at the bottom left of the floor and are listed here too.</p>` + (rows ? `<ol class="log msgl">${rows}</ol>` : '<p class="hint">No messages yet.</p>');
}
function legendHTML(md) {
  const rows = md ? [['steth', 'act fl', 'Waiting for a doctor'], ['orders', 'act fl', 'Write orders'], ['decide', 'act fl', 'Your call to make'], ['alert', 'bad fl', 'Not improving'], ['code', 'code fl', 'Code'], ['blood', 'bad fl', 'Bleeding: activate MTP'], ['phone', 'wait', 'Consultant on the way'], ['steth', 'wait', 'You or another doctor is with them'], ['flask', 'wait', 'Workup pending'], ['pill', 'wait', 'Treatment underway'], ['bed', 'board', 'Admitted, waiting for a bed'], ['home', 'go', 'Ready to go home'], ['broom', 'dirtyq', 'Dirty room'], ['sparkle', 'clean', 'Being cleaned'], ['lock', 'off', 'Closed']]
    : [['steth', 'act fl', 'Needs a provider'], ['phone', 'act fl', 'Call a consult'], ['decide', 'act fl', 'Your call: home, obs, admit'], ['home', 'go fl', 'Ready to discharge'], ['up', 'act fl', 'Bed ready: send them up'], ['amb', 'act fl', 'Transfer: request or book'], ['card', 'act fl', 'Needs registration'], ['alert', 'bad fl', 'Trouble in the room'], ['blood', 'bad fl', 'Bleeding: activate MTP'], ['code', 'code fl', 'Code'], ['steth', 'wait', 'A provider has them'], ['bed', 'board', 'Admitted, waiting for a bed'], ['flask', 'wait', 'Workup pending'], ['pill', 'wait', 'Treatment underway'], ['broom', 'dirty fl', 'Dirty: tap to send EVS'], ['sparkle', 'clean', 'Being cleaned'], ['lock', 'off', 'Closed']];
  const tiles = [['#1648C8', 'Blue', 'needs you'], ['#D11A2F', 'Red', 'trouble: go now'], ['#12813A', 'Green', 'ready to go'], ['#7A4A1E', 'Brown', 'dirty'], ['#E3D7FA', 'Purple', 'admitted, waiting for a bed upstairs'], ['#FFFFFF', 'White', 'someone else has it'], ['#E7EAEE', 'Gray', 'empty']];
  const who = [['MD', 'md', 'Attending: a fully trained emergency doctor'], ['PA', 'app', 'Physician assistant'], ['NP', 'app', 'Nurse practitioner'], ['RN', 'rn', 'Nurse'], ['T', 'pct', 'Tech: the nurses’ extra hands'], ['R', 'reg', 'Registration'], ['UC', 'uc', 'Unit secretary: calls and paperwork'], ['EV', 'evs', 'EVS: housekeeping'], ['RT', 'rt', 'Respiratory therapist'], ['Rx', 'rph', 'Pharmacist'], ['TP', 'tp', 'Transport'], ['HM', 'cons', 'Consultant from upstairs. The letters are the service (HM hospitalist, CA cardiology)'], ['AN', 'help', 'Help from upstairs: AN anesthesia, CC critical care'], ['FL', 'flt', 'Flight crew']];
  if (floor3d()) {   // the 3D floor: since v0.20 the flat map's colours on each room's floor and badge, plus icons, the call light, the red ring, and uniforms
    const uni = [['#F4F4F2', 'MD', 'white coat: attending'], ['#7A0A1A', 'PA', 'burgundy scrubs'], ['#4F1580', 'NP', 'purple scrubs'], ['#0B2DBF', 'RN', 'royal blue scrubs: nurse'], ['#0A6B24', 'T', 'green scrubs: tech'], ['#9C7A3A', 'R', 'shirt and slacks: registration'], ['#9C7A3A', 'UC', 'shirt and slacks: unit secretary'], ['#2B2E34', 'EV', 'charcoal: EVS'], ['#0F5F70', 'RT', 'teal: respiratory'], ['#5E2F14', 'TP', 'brown: transport'], ['#0A1430', 'EMS', 'navy: ambulance crews']];
    return `<h4 class="lgh">Rooms</h4><p class="hint" style="margin:0 0 4px">Each room shows its <b>number</b>, the patient’s <b>ESI</b> and <b>name</b>, and an <b>icon</b> for what’s next. A <b>shaking</b> icon is waiting on you. A <b>flashing red ring</b> is a patient crashing. Rooms that can take a selected patient <b>glow green</b>.</p>`
      + `<h4 class="lgh">Icons</h4><div class="lgd">${rows.map(([k, c, t]) => `<span>${icoInline(k, c.replace(' fl', ''))}${t}</span>`).join('')}</div>`
      + `<h4 class="lgh">People</h4><p class="hint" style="margin:0 0 4px">A <b>tag</b> and the <b>uniform</b> show each person’s role. Patients on their feet carry their <b>ESI</b> (<b>?</b> before triage).</p><div class="lgd">${uni.map(([c, l, t]) => `<span><i class="lgsw" style="background:${c}"></i><b>${l}</b>&nbsp;${t}</span>`).join('')}</div>`
      + `<p class="hint">Drag to move. Pinch or use <b>+</b> and <b>−</b> to zoom.</p>`;
  }
  return `<h4 class="lgh">Rooms</h4><p class="hint" style="margin:0 0 4px">A room’s <b>colour</b> is its state. A <b>solid</b> colour is waiting on you.</p><div class="lgd">${tiles.map(([c, n, t]) => `<span><i class="lgsw" style="background:${c}"></i><b>${n}</b>&nbsp;${t}</span>`).join('')}</div>`
    + `<h4 class="lgh">Icons</h4><p class="hint" style="margin:0 0 4px">The <b>icon</b> says what’s next. Zoom in for words.</p><div class="lgd">${rows.map(([k, c, t]) => `<span>${icoInline(k, c.replace(' fl', ''))}${t}</span>`).join('')}</div>`
    + `<h4 class="lgh">People</h4><p class="hint" style="margin:0 0 4px">Staff are <b>pills with letters</b>. Patients on their feet are <b>circles</b>: the number is the ESI, and <b>?</b> means not triaged yet.</p><div class="lgd">${who.map(([l, r, t]) => `<span>${chipInline(l, r)}${t}</span>`).join('')}<span>${ptChipInline(0)}Patient, not triaged</span><span>${ptChipInline(3)}Patient, ESI 3</span></div>`;
}
const WORDS_BTN = '<p class="wlink"><button type="button" data-act="words">New to the ED? What the words mean</button></p>';
const shiftSpan = () => { const G = g(); return `07:00 to ${U.scene === 'game' && G && !G.train ? E.clock(G.shift) : '19:00'}`; };
function helpHTML() {
  if ((U.scene === 'game' && MD()) || (U.scene !== 'game' && U.mode === 'md')) return helpMD();
  const fp = U.view === 'map';
  return head('How to run the board', `You’re the charge nurse, ${shiftSpan()}. Keep patients moving, staff happy, and the Box answered.`) + WORDS_BTN + (fp ? legendHTML(false) : '') + `<ol class="help">
<li><b>Intake.</b> Everyone needs quick registration and triage. Tap a registrar or triage nurse ${fp ? (U.rails ? 'on the left' : 'at the bottom left') : 'in the intake row'}, then a patient. Ambulance crews wait on the wall until a nurse takes report.</li>
<li><b>Bed first.</b> A very sick patient (ESI 1 or 2) can get a bed before registration. Send a registrar later. Nobody leaves unregistered.</li>
<li><b>The waiting room.</b> Recheck people who’ve waited a while. Some are sicker than they looked. Walk the waiting room to keep people from leaving.</li>
<li><b>Beds.</b> Tap a patient, then a green room. ESI 1 goes to Resus. Fast Track (from 09:00) takes ESI 4 and 5. Rooms 8 and 16 are isolation. 19 and 20 are safe rooms. Chairs free a bed for someone just waiting on results.</li>
<li><b>Providers.</b> Nobody is seen until you send a provider. Tap one ${SIDE()}, then the patients. PAs and NPs take ESI 2–5. A long line means more mistakes.</li>
<li><b>Gray-zone calls.</b> Chest pain, fainting, TIA and mild pneumonia (CURB-65) get a risk score. You pick home, observation, or admit.</li>
<li><b>The Box.</b> Take alert reports. When a medic needs medical direction, tap Find a doctor and pick one who isn’t in a code.</li>
<li><b>Consults.</b> Call the right service once their results are back.</li>
<li><b>Meds and blood.</b> The pharmacist checks most meds first. Bleeding trauma needs massive transfusion fast.</li>
<li><b>Interpreters.</b> A language tag means get one. Without it, care is slower and riskier.</li>
<li><b>Admits.</b> Admitted patients wait for a bed upstairs on their unit: ICU, step-down, telemetry, med-surg, psych. The <b>Beds</b> chip, top right, shows how full the ICU is. Tap it for every unit. When a bed is ready, the nurse calls report, then pick a transporter or tech.</li>
<li><b>Transfers.</b> Find a hospital that can do what the patient needs, call it to accept, then pick the transport: wheelchair van, BLS, ALS, critical care ground, or flight. Too little crew refuses at the bedside; too much wastes a unit.</li>
<li><b>Help from upstairs.</b> Hard airway? Call anesthesia. Shock? Call critical care.</li>
<li><b>Screening.</b> Registration or triage screens everyone for contagious illness. Get to coughing walk-ins fast: unscreened, they expose the waiting room. Screened-positive patients need an isolation room.</li>
<li><b>Two consults.</b> Some patients need a second service before they can go upstairs. The card says so.</li>
<li><b>Cleaning.</b> EVS only cleans when you tap a dirty room. Tap again to move it to the front.</li>
<li><b>Nurses.</b> Each nurse handles 4 points. Tap a pod ${fp ? 'sign' : 'header'} to move nurses. Casey floats. Reyes is new: no Resus or triage. Give breaks.</li>
<li><b>Divert.</b> Match the divert to what broke: CT, STEMI (cath lab), Trauma, or Internal Disaster (lab or power). Lift it once fixed. ED Full and No Monitored Beds are for when you’re full.</li>
<li><b>Rehab.</b> Some older patients can leave but can’t manage at home. Discharge them to rehab, then have the unit secretary (<b>UC</b>, on the left) call the ride.</li>
<li><b>Scores.</b> Four: Patients, Clinical, Admin, Staff. The meter by the zoom buttons counts patients waiting on their next step. Your summary rates each score and shows your three worst moments.</li>
</ol>`;
}
function helpMD() {
  return head('How to work a shift', `You’re an attending, ${shiftSpan()}. The charge nurse runs the board. You run the medicine.`) + WORDS_BTN + (U.view === 'map' ? legendHTML(true) : '') + `<ol class="help">
<li><b>Pick up patients.</b> ${U.view === 'map' ? (floor3d() ? 'A stethoscope' : 'A blue stethoscope') : 'Needs a provider'} means waiting for a doctor. Tap the room, then See this patient. Sickest first.</li>
<li><b>Write orders.</b> Pick tests and treatment, then Sign. Order what they need, nothing extra. Extra tests cost time and points. Tap a scan on the card to see it.</li>
<li><b>Close the gaps.</b> Missing a test? You’ll hear about it. Not improving? A treatment is missing. Read the vitals.</li>
<li><b>Make the call.</b> Home, rehab (can leave, can’t manage alone: the exam says so), admit (call the right consultant once results are back), or transfer. Chest pain, fainting, TIA and mild pneumonia (CURB-65) get a risk score.</li>
<li><b>Transfers.</b> Pick a hospital that has what they need, call it to accept, pick the transport, and give the crew report. No ICU bed here? An ICU patient can’t stay: transfer them.</li>
<li><b>Help from upstairs.</b> Hard airway: anesthesia. Shock: critical care. Call them before the procedure, not after.</li>
<li><b>Orders sit in menus.</b> Tap Labs, Imaging, Medications, Resuscitation drugs, and the rest to open them. Medications open into drug classes. Pick the drug: the wrong one doesn’t count and the patient stays untreated.</li>
<li><b>You make the diagnosis.</b> When results are back, pick it from four. A miss costs <b>accuracy</b> and adds <b>legal risk</b>: 25% brings a call from the administrator, 40% peer review, 50% a PIP and lawyers calling (send them to risk management), 75% and you’re fired.</li>
<li><b>Radio orders.</b> Some crews ask for a dose or an order, not a yes or no. Pick the drug, dose, and route.</li>
<li><b>Admit by phone.</b> For a straightforward medical admission, admit to the hospitalist by phone instead of waiting for them to come down. Some patients need a second consult; the card says so.</li>
<li><b>Bedside tests.</b> A fingerstick glucose or urine dip reads in a minute and works when the lab is down. Check the sugar early on every stroke.</li>
<li><b>Answer the radio.</b> Tap Answer, read the call, approve or deny. Only you can.</li>
<li><b>Alerts.</b> Time goals: ECG in 10, CT in 25, needle in 60, balloon in 90.</li>
<li><b>Your scores.</b> Patients, Clinical (your own patients), Admin, Staff. The meter counts patients waiting on their next step.</li>
</ol>`;
}
function renderSheet(G) {
  const wrap = $('#sheetWrap'), el = $('#sheet'), s = U.sheet;
  let h = '';
  if (s && U.scene === 'game') {
    if (s.type === 'pt') h = ptSheet(G, E.pt(s.pid));
    else if (s.type === 'consult') { const p = E.pt(s.pid); h = p && p.loc !== 'gone' && (p.consult.st === 'none' || E.con2Open(p)) ? consultSheet(G, p) : ''; }
    else if (s.type === 'prov') { const p = E.pt(s.pid); h = p && p.loc === 'room' ? head('Change provider', esc(p.name)) + `<div class="pgrid">${provButtons(p, G)}</div>` : ''; }
    else if (s.type === 'team') h = head(MD() ? 'The team' : 'Your team', MD() ? 'Who is working today. The charge nurse runs assignments and breaks.' : `Staff satisfaction ${Math.round(E.staffSat())}%`) + teamHTML(G);
    else if (s.type === 'staff') h = staffSheet(G, E.staff(s.sid));
    else if (s.type === 'zone') h = zoneSheet(G, s.z);
    else if (s.type === 'boxdoc') h = boxDocSheet(G);
    else if (s.type === 'divert') h = divertSheet(G);
    else if (s.type === 'help') h = helpHTML();
    else if (s.type === 'words') h = wordsHTML();
    else if (s.type === 'msgs') h = msgsHTML(s);
    else if (s.type === 'queue') h = queueHTML(G);
    else if (s.type === 'uc') h = ucSheet(G, E.staff(s.sid));
    else if (s.type === 'hosp') h = hospSheet(G, E.pt(s.pid));
    else if (s.type === 'beds') h = bedsHTML(G);
    else if (s.type === 'legend') h = head('What the map shows') + legendHTML(MD()) + `<p class="hint">The <b>circle</b> is the ESI: 1 is sickest. <b>Orange dashes</b>: isolation. <b>Blue dots</b>: safe room.${MD() ? ' <b>Gold ring</b>: your patient. <b>Gold star</b>: you.' : ''}</p><p class="hint"><b>The bell</b> holds every event this shift.</p><p class="hint"><b>Pod signs.</b> Each <b>dot</b> is a nurse. <b>3/4</b> is workload over safe capacity. <b>Orange</b>: full. <b>Red</b>: over.</p><div class="wlink"><button type="button" data-act="words">What the words mean</button></div>`;
    if (!h) U.sheet = null;
  } else if (s && s.type === 'help') h = helpHTML();
  else if (s && s.type === 'words') h = wordsHTML();
  else if (s && s.type === 'chapters') h = chaptersHTML();
  else if (s && s.type === 'lessons') h = lessonsHTML();
  else if (s && s.type === 'class') h = classHTML();
  if (h && TR() && s.type !== 'words' && !coachBeside()) h = coachHTML('in') + h;
  const key = h ? s.type + '|' + (s.pid || s.sid || s.z || '') : '';
  wrap.hidden = !h; morph(el, h);
  if (key !== U.sheetKey) {
    const was = U.sheetKey; U.sheetKey = key; el.scrollTop = 0;
    const box = $('#sheetBox'), t = el.querySelector('h3, h2');
    if (box) box.setAttribute('aria-label', (t && t.textContent.trim()) || 'Details');   // a screen reader names the dialog (audit R4.9-03)
    // the sheet takes the focus when it opens, unless the player is already in it; in a shift, only from a keyboard (a tap on the map keeps its place)
    const ae = document.activeElement;
    if (box && h && !was && !box.contains(ae) && (U.scene !== 'game' || U.kbd)) { U.opener = ae && ae !== document.body ? ae : null; try { box.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } }
    // closed: the button that opened it gets the focus back
    if (!h && was && (!ae || ae === document.body || (box && box.contains(ae))) && U.opener && document.contains(U.opener)) try { U.opener.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    if (!h) U.opener = null;
  }
  if (U.focusTo) { const f = $(U.focusTo); U.focusTo = null; if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* old browsers */ } }
  document.body.classList.toggle('sheeton', !!h);
}

/* ---------- Orientation: the preceptor ----------
   One scripted patient at a time. Each step spotlights what to tap, holds the clock until the player acts,
   and fast-forwards through the waiting. "Do it for me" performs the step, so nobody gets stuck. */
const TR = () => { const G = g(); return G && G.train && G.tr && U.scene === 'game' ? G.tr : null; };
const tid = k => { const t = TR(); return t && t.ids[k] ? E.pt(t.ids[k]) : null; };
const mag = id => `[data-act="pt"][data-arg="${id}"]`;
const mapFar = () => U.view === 'map' && camFar();
const wallPts = () => E.active().filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive);
const ptSpot = p => {   // zoomed out, people at the door, on the wall, and in the waiting room are picked from a list
  if (p && mapFar() && (p.loc === 'waiting' || p.loc === 'triage' || p.loc === 'wall')) return sheetIs('zone', 'triage') ? [`#sheet ${mag(p.id)}`] : [p.loc === 'waiting' ? '#mWait' : p.loc === 'wall' ? '#mWall' : '#mDoor'];
  return [mag(p.id)];
};
const SIDE = () => (U.view === 'map' && U.rails ? 'on the right' : 'at the bottom');
const roomSel = p => (p && p.room ? `#room-${p.room}, #mroom-${p.room}` : '');
const provSel = sid => `#dockProv [data-arg="${sid}"], #sideProv [data-arg="${sid}"]`;
const onSheet = p => !!(p && U.sheet && U.sheet.type === 'pt' && U.sheet.pid === p.id);
const selPt = p => !!(p && U.sel && U.sel.type === 'pt' && U.sel.pid === p.id);
const sheetIs = (type, z) => !!(U.sheet && U.sheet.type === type && (z == null || U.sheet.z === z));
function firstRoom(p, want) {
  const G = g(), ok = G.rooms.filter(r => r.kind !== 'chair' && E.canPlace(p, r).ok);
  return (ok.find(r => r.id === want) || ok[0] || {}).id;
}
const regStep = (key, sid) => ({
  spot: () => { const p = tid(key); if (onSheet(p)) return [`#sheet [data-act="regAssign"][data-arg$="|${sid}"]`]; return U.sel && U.sel.type === 'reg' ? ptSpot(p) : [`#istaff [data-act="regSel"][data-arg="${sid}"]`]; },
  done: () => tid(key).reg !== 'none',
  auto: () => E.register(tid(key).id, sid),
});
const triStep = (key, sid) => ({
  spot: () => { const p = tid(key); if (onSheet(p)) return [`#sheet [data-act="triAssign"][data-arg$="|${sid}"]`]; return U.sel && U.sel.type === 'tri' ? ptSpot(p) : [`#istaff [data-act="triSel"][data-arg="${sid}"]`]; },
  done: () => tid(key).tri !== 'none',
  auto: () => E.triage(tid(key).id, sid),
});
const intakeStep = (key, rsid, tsid) => ({
  spot: () => { const p = tid(key); if (!onSheet(p)) return ptSpot(p); const reg = [`#sheet [data-act="regAssign"][data-arg$="|${rsid}"]`], tri = [`#sheet [data-act="triAssign"][data-arg$="|${tsid}"]`]; return p.loc === 'wall' ? (p.tri === 'none' ? tri : reg) : (p.reg === 'none' ? reg : tri); },
  done: () => { const p = tid(key); return p.reg !== 'none' && p.tri !== 'none'; },
  auto: () => { const p = tid(key); if (p.reg === 'none') E.register(p.id, rsid); if (p.tri === 'none') E.triage(p.id, tsid); },
});
const FP = () => U.view === 'map';   // words that differ between the floor plan and the list board
const TD = () => FP() && floor3d();   // and the few that differ on the 3D floor
const bedStep = (key, rid) => ({
  spot: () => { const p = tid(key); return selPt(p) ? [`#room-${rid}, #mroom-${rid}`] : ptSpot(p); },
  done: () => ['room', 'gone'].includes(tid(key).loc),
  auto: () => { const p = tid(key); return E.place(p.id, firstRoom(p, rid)); },
});
const provStep = (key, sid) => ({
  spot: () => (U.sel && U.sel.type === 'prov' && U.sel.sid === sid ? [roomSel(tid(key))] : [provSel(sid)]),
  done: () => !!tid(key).prov || tid(key).loc === 'gone',
  auto: () => E.assign(sid, tid(key).id),
});
const roomAct = (key, sel) => ({ spot: () => { const p = tid(key); return onSheet(p) ? [`#sheet ${sel}`] : [roomSel(p)]; } });
const far = (a, b) => (mapFar() ? a : b);   // zoomed out on the floor plan, people at the door and in the waiting room are picked from a list
const STEPS = [
  { id: 'hi', next: true, title: 'Welcome to Orientation', text: `I’m your **preceptor**. Today you learn to be the **charge nurse** of this **ED**, the emergency department.\nYou decide who gets which bed, nurse, and doctor.\nTap whatever I **light up**.`},
  { id: 'words', next: true, title: 'The words', text: `We use a lot of short names. **ESI** is how sick someone is. **EMS** is ambulance crews. An **RN** is a nurse. **EVS** is housekeeping.\nNo need to memorize. **Words** has the list.`, spot: () => ['#coach [data-act="words"]'] },
  { id: 'ui1', next: true, title: 'The menu', text: () => `**☰**, top right, is the **menu**: pause, restart, How to play, and settings.${FP() ? `\n**3D floor: on/off** in there switches between the 3D and flat map.${TD() ? ' The flat map shows first while 3D loads.' : ''}` : ''}`, spot: () => ['#btnPause'] },
  { id: 'ui2', next: true, title: 'Events and the key', text: () => (FP() ? `The **bell** is **Events**: everything that happened this shift. New patients also pop up at the bottom left.\n**?** shows what every colour and icon means.` : `Messages show at the top. **How to play** in the menu explains the whole board.`), spot: () => (FP() ? ['#btnMsgs', '#mzoom [data-act="legend"]'] : ['#btnPause']) },
  { id: 'intake', next: true, title: 'The front door', text: () => `Walk-ins line up at the door. **Ambulance crews** wait ${FP() ? 'at the wall' : 'in the Ambulance bay'}.\n**Registrars**${FP() ? ' (the **R** chips)' : ''} take names. The **triage nurse** checks how sick they are.`, spot: () => ['#istaff', '#intake .lane', '#mWait', '#mDoor'] },
  { id: 'm1', title: 'A walk-in', text: () => `[[Maria]], 34, says it burns when she pees.\nFirst, **quick registration**: name and birth date.\nTap **Tasha**, a registrar. Then tap ${far('**the line at the door**', '[[Maria]]')}.`,
    setup: () => ({ maria: E.trainPatient('uti', 'walk', { name: 'Maria L.', age: 34 }) }), ...regStep('maria', 'reg1') },
  { id: 'm2', wait: true, title: 'Registering', text: `Two minutes. The rest of her paperwork happens **in her room** later.`, done: () => E.regQuick(tid('maria')) },
  { id: 'm3', title: 'Triage', text: () => `Now **triage**: sorting people by how sick they are, not who came first.\nTap **Bea**, your triage nurse. Then tap ${far('**the line at the door**', '[[Maria]]')}.`, ...triStep('maria', 'rnT') },
  { id: 'm4', wait: true, title: 'Her ESI', text: `Triage gives an **ESI** number:\n**1**: needs life-saving help now.\n**2**: high risk, can’t wait.\n**3**: can wait, needs several tests.\n**4**: needs one thing.\n**5**: needs nothing.\nThen she waits in the waiting room.`, done: () => tid('maria').tri === 'done' },
  { id: 'pods', next: true, title: 'Rooms, pods, and nurses', text: () => `A **pod** is four rooms and one **RN**.\nThe ${FP() ? 'sign' : 'header'} shows her **load**. **3/4** means 3 points of work out of a safe 4. Sicker patients count more.`, spot: () => ['#zh-a, #mzh-a'] },
  { id: 'm5', title: 'Give her a bed', text: () => `Maria is **ESI 4**: stable, one test.\n${far('Tap **the waiting room**, pick [[Maria]]', 'Tap [[Maria]] in the waiting room')}, then **Room 1**. ${FP() ? 'Rooms that can take her turn **green**.' : 'Green rooms are open.'}`, ...bedStep('maria', '1') },
  { id: 'm5a', title: 'Read the room', text: () => `${E.roomName(tid('maria').room || '1')} shows **her name**, her **ESI**, and ${FP() ? 'an **icon** for what’s next. The stethoscope means she needs a provider. **Blue** means it’s on you' : 'what she needs next'}.\nTap **the room** to open her card.`,
    spot: () => [roomSel(tid('maria'))], done: () => onSheet(tid('maria')) || tid('maria').loc === 'gone', auto: () => { U.sel = null; U.sheet = { type: 'pt', pid: tid('maria').id }; } },
  { id: 'm5b', next: true, keep: true, title: 'Her vital signs', text: `**Vitals**, normal for an adult:\n**HR** (heart rate) 60–100\n**BP** (blood pressure) about 120/80\n**RR** (breaths a minute) 12–20\n**SpO2** (oxygen) 95%+\n**Temp** 100.4+ is a fever\n**Red** is out of range. Hers are fine.`, spot: () => ['#sheet .ph-cc'] },
  { id: 'provs', next: true, title: 'Providers', text: () => `**Providers** examine patients and write **orders** for tests and treatment.\n**Attendings**${FP() ? ' (**MD**)' : ''} are ER doctors. **PAs and NPs** are physician assistants and nurse practitioners.\nThey wait ${SIDE()} until you send them.`, spot: () => ['#dockProv', '#sideProv'] },

  { id: 'm6', title: 'Send a provider', text: () => `Tap **Rivera**, a PA, ${SIDE()}. Then tap **${E.roomName(tid('maria').room || '1')}**.`, ...provStep('maria', 'pa1') },
  { id: 'ic1', next: true, title: 'What the colours mean', text: () => (TD() ? `Her room went **white**. Rivera has her now.\nA **coloured floor** wants you: **blue** is a next step, **green** is ready to go, **brown** is dirty.\n**No colour** is someone else’s move. **Purple** is waiting for a bed upstairs.` : FP() ? `Her room went **white**. Rivera has her now.\n**Solid colour** wants you: **blue** is a next step, **green** is ready to go, **brown** is dirty.\n**White** is someone else’s move. **Purple** is waiting for a bed upstairs.` : `Her room turned **gray**. Rivera has her now.\n**Blue** needs you. **Gray** waits on someone else. **Green** is ready to go. **Purple** waits for a bed upstairs.`), spot: () => [roomSel(tid('maria'))] },
  { id: 'ic2', title: 'Zoom in', text: () => (TD() ? `**+** zooms in. Badges grow into labels with **names**.\nTap **+** until they do.` : `**+** zooms in. Icons turn into **words**.\nTap **+** until they do.`), spot: () => ['#mzoom [data-arg="in"]'], done: () => !FP() || (TD() ? !!(window.OC3D && OC3D.full && OC3D.full()) : !CAM.far), auto: () => { for (let i = 0; i < 6 && (TD() ? !(window.OC3D && OC3D.full()) : CAM.far); i++) mapZoom(1.5); } },
  { id: 'ic3', title: 'The whole department', text: () => `${TD() ? 'Now you can read every room.' : 'Now every room says what it needs.'} Drag to look around.\nTap **⤢** to see it all again.`, spot: () => ['#mzFit'], done: () => !FP() || !mapZoomed(), auto: () => mapZoom(0) },
  { id: 'm7', wait: true, title: 'The workup', text: `Rivera orders a urine test. Tests like this are the **workup**.\nA **tech** (a **PCT**, patient care technician) collects it. Techs are the nurses’ extra hands.`, done: () => tid('maria').dxK || tid('maria').loc === 'gone' },
  { id: 'rest', next: true, title: 'The rest of the department', text: () => `**H1–H4**: **hallway beds** for when rooms are full.\n**Fast Track**: four rooms for minor problems, open at 09:00.\n**Chairs**: for patients just waiting on results.\n${TD() ? '**Isolation rooms** are for airborne infections. **Safe rooms** are for patients who might hurt themselves.' : `${FP() ? '**Orange dashes**' : '**ISO**'}: isolation, for airborne infections. ${FP() ? '**Blue dots**' : '**Safe**'}: for patients who might hurt themselves.`}${FP() && !TD() ? '\nAlong the bottom: **CT**, **XR** (X-ray), **LAB**, **RX** (pharmacy).' : ''}`, spot: () => ['#zh-hall, #mzh-hall', '#zh-ft, #mzh-ft', '#zh-rp, #mzh-rp'] },
  { id: 'm8', wait: true, title: 'Treatment', text: `It’s a **UTI**, a urinary tract infection.\nThe **pharmacist** checks the antibiotic, then her nurse gives it.`, done: () => tid('maria').dsp !== 'none' || tid('maria').loc === 'gone' },
  { id: 'm9', title: 'Discharge', text: `She can go home. That’s a **discharge**.\nTap **her room**, then **Discharge home**.`, ...roomAct('maria', '[data-act="dc"]'),
    done: () => ['dc', 'dcing'].includes(tid('maria').dsp) || tid('maria').loc === 'gone', auto: () => E.discharge(tid('maria').id) },
  { id: 'm10', wait: true, title: 'Discharge teaching', text: `Her nurse goes over the antibiotic and the **warning signs** to come back for.`, setup: () => ({ room1: tid('maria').room || '1' }), done: () => tid('maria').loc === 'gone' },
  { id: 'top', next: true, title: 'The clock and your scores', text: () => `The shift runs **07:00 to 19:00**. Four scores grade you:\n**Patients**: how they feel about the visit.\n**Clinical**: the right care, on time.\n**Admin**: flow and cost.\n**Staff**: team morale.${FP() ? '\nThe **meter** by the zoom buttons counts patients waiting on their next step.' : ''}`, spot: () => ['#top .pills', '#waitMeter'] },
  { id: 'n1', title: 'What needs you', text: () => `${E.roomName(TR().ids.room1)} stays **dirty** until you send someone.\n**Next**, ${FP() ? (U.rails ? 'bottom left' : 'in the corner') : 'bottom right'}, counts what’s waiting on you and jumps to the most urgent.\nTap **Next**.`,
    setup: () => { TR().need = 1; return null; }, spot: () => ['#needBtn'], done: () => (TR().nx || 0) >= 1 || E.room(TR().ids.room1).st !== 'dirty' || g().evsQ.includes(TR().ids.room1), auto: () => { TR().nx = 1; } },
  { id: 'm11', title: 'Clean the room', text: () => `Here’s ${E.roomName(TR().ids.room1)}.\n**EVS**, the housekeepers, only clean when you send them.\nTap **the dirty room**.`, spot: () => [`#room-${TR().ids.room1}, #mroom-${TR().ids.room1}`],
    done: () => { const r = E.room(TR().ids.room1); return r.st !== 'dirty' || g().evsQ.includes(r.id); }, auto: () => E.evsTap(TR().ids.room1) },

  { id: 'box', next: true, title: 'The Box and Divert', text: `**The Box** is the radio ambulance crews (**EMS**) call on.\n**Divert** sends ambulances to other hospitals when you’re overwhelmed.`, spot: () => ['#boxbar', '#btnYellow'] },
  { id: 'w1', title: 'An ambulance', text: () => `**Medic 7** brought in [[Walter]], 82. He fell at home.\nThe crew waits at the wall until a nurse takes **report**, their hand-off.\n${far('Tap **the wall**, then [[Walter]]', 'Tap [[Walter]]')}. Pick **Bea** for report, then **Miguel** to register him.`,
    setup: () => ({ walter: E.trainPatient('hipfx', 'ems', { name: 'Walter K.', age: 82, sex: 'M', unit: 'Medic 7' }) }), ...intakeStep('walter', 'reg2', 'rnT') },
  { id: 'w2', wait: true, title: 'Taking report', text: `While they wait, that crew can’t take the next 911 call. Keep it **under 30 minutes**.`, done: () => tid('walter').tri === 'done' && E.regQuick(tid('walter')) },
  { id: 'w3', title: 'Offload', text: () => `Moving him into your bed is **offload**.\n${far('Tap **the wall**, pick [[Walter]]', 'Tap [[Walter]]')}, then **Room 5**.\nTip: ambulance patients who are ESI 3–5 can go to the waiting room.`, ...bedStep('walter', '5') },
  { id: 'w4', title: 'An attending', text: () => `He’s 82 and may need surgery. Give him a doctor.\nTap **Dr. Patel**, then **${E.roomName(tid('walter').room || '5')}**.`, ...provStep('walter', 'md1') },
  { id: 'w5', wait: true, title: 'Results', text: `Dr. Patel orders an **X-ray** and **labs** (blood tests). Results land on his card.`, done: () => tid('walter').dxK || tid('walter').consult.st !== 'none' || tid('walter').loc === 'gone' },
  { id: 'w6', title: 'Call the right service', text: `It’s a **broken hip**. Calling a specialist is a **consult**. Bones go to **Orthopedics**.\nTap **his room**, **Call a consult**, then **Orthopedics**.\nThe wrong service, or calling too early, slows things down.`,
    spot: () => { const p = tid('walter'); if (sheetIs('consult')) return ['#sheet [data-act="consultSpec"][data-arg="ortho"]']; return onSheet(p) ? ['#sheet [data-act="consultOpen"]'] : [roomSel(p)]; },
    done: () => tid('walter').consult.st !== 'none' || tid('walter').loc === 'gone', auto: () => E.consult(tid('walter').id, 'ortho') },
  { id: 'w7', wait: true, title: 'Admitted', text: `Orthopedics **admits** him. He keeps your bed until one opens upstairs. That wait is **boarding**, the main reason EDs back up.`, done: () => ['callrep', 'reporting', 'bedready', 'xportq'].includes(tid('walter').dsp) || tid('walter').loc === 'gone' },
  { id: 'w8', wait: true, title: 'Calling report', text: `A bed opened upstairs (we call it **the floor**). His nurse **calls report** to his new nurse.`, done: () => ['bedready', 'xportq'].includes(tid('walter').dsp) || tid('walter').loc === 'gone' },
  { id: 'w9', title: 'Send him up', text: `Tap **his room**, then **Ray** from transport.\n**Transporters** move patients so your staff can stay put.`, ...roomAct('walter', '[data-act="sendUp"][data-arg$="|tp1"]'),
    done: () => tid('walter').dsp === 'xportq' || tid('walter').loc === 'gone', auto: () => E.sendUp(tid('walter').id, 'tp1') },

  { id: 't1', title: 'The Box is ringing', text: `An ambulance is calling ahead: a **trauma alert**, someone badly hurt and minutes away.\nTap **Take report**.`,
    setup: () => ({ trauma: E.trainPatient('mvc', 'alert', { name: 'Tyler B.', age: 19, sex: 'M', unit: 'Medic 21', eta: 8 }) }),
    spot: () => ['#boxbar .bx-btn'], done: () => !!tid('trauma').pren, auto: () => E.boxNotify() },
  { id: 't2', title: 'Get blood moving', text: () => `[[Tyler]], 19, rolled his car. BP **78/40**, far too low. He’s **bleeding inside**.\n**MTP**, massive transfusion, gets blood coming now.\nTap **${FP() ? 'the ambulance with flashing lights' : 'him in the Ambulance bay'}**, then **Activate massive transfusion**.`,
    spot: () => { const p = tid('trauma'); return onSheet(p) ? ['#sheet [data-act="mtp"]'] : [mag(p.id)]; }, done: () => !!tid('trauma').bb, auto: () => E.activateMTP(tid('trauma').id) },
  { id: 't3', wait: true, title: 'Inbound', text: `Blood is on the way. Keep a **Resus** room ready.\n**Resus** (resuscitation) rooms are for patients who could die in minutes.`, done: () => tid('trauma').loc !== 'enroute' },
  { id: 't4', title: 'Straight to Resus', text: () => `He’s here. The sickest **skip registration and triage**.\n${far('Tap **the wall**, pick [[Tyler]]', 'Tap [[Tyler]]')}, then **Resus 1**.`, ...bedStep('trauma', 'R1') },
  { id: 't5', title: 'Attending only', text: `**ESI 1**, the sickest, gets an **attending**.\nTap **Dr. Okafor**, then **Resus 1**.`, ...provStep('trauma', 'md2') },
  { id: 't6', title: 'Pull a second nurse', text: () => `He needs two nurses. **Casey**, your **resource nurse**, has no pod. She goes where the work is.\nTap the **Resus ${FP() ? 'sign' : 'header'}**, then add **Casey**.`,
    spot: () => (sheetIs('zone', 'resus') ? ['#sheet [data-act="zt"][data-arg="rnX|resus"]'] : ['#zh-resus, #mzh-resus']),
    done: () => E.staff('rnX').zones.includes('resus'), auto: () => E.toggleZone('rnX', 'resus') },
  { id: 't7', wait: true, title: 'To the OR', text: `A tech brings the blood and his nurse starts it. He goes to the **OR**, the operating room.\nHe’s in **shock**: not enough blood reaching his organs. Fast blood keeps him alive.`, done: () => tid('trauma').loc === 'gone' },

  { id: 'c1', title: 'Medical direction', text: `The Box again. A paramedic needs a **doctor’s OK** to give a drug. That’s **medical direction**. Only an attending can give it.\nTap **Find a doctor**, then **Dr. Patel**.`,
    setup: () => { E.trainConsult(); return null; },
    spot: () => (sheetIs('boxdoc') ? ['#sheet [data-act="boxDoc"][data-arg="md1"]'] : ['#boxbar .bx-btn']),
    done: () => { const c = g().box.cur; return !c || !!c.taken; }, auto: () => E.boxTake('md1') },
  { id: 'c2', wait: true, title: 'On the line', text: `It ties the doctor up about 5 minutes. Don’t pick one running a **code** (a cardiac arrest).`, done: () => !g().box.cur },

  { id: 'g1', title: 'Chest pain at the door', text: () => `[[Grace]], 58, has chest pressure. Could be a heart attack, so she needs an **ECG** (heart tracing) **within 10 minutes**.\n${far('Tap **the line at the door**, pick [[Grace]]', 'Tap [[Grace]]')}. Pick **Tasha** to register her and **Bea** to triage her.`,
    setup: () => ({ grace: E.trainPatient('cpmod', 'walk', { name: 'Grace T.', age: 58, sex: 'F' }) }), ...intakeStep('grace', 'reg1', 'rnT') },
  { id: 'g2', wait: true, title: 'Triage', text: `A tech does her **ECG** while Bea triages.`, done: () => tid('grace').tri === 'done' },
  { id: 'g3', title: 'No waiting', text: () => `She’s **ESI 2**, high risk. She gets a **room now**, not the waiting room.\n${far('Tap **the waiting room**, pick [[Grace]]', 'Tap [[Grace]]')}, then **Room 10**.`, ...bedStep('grace', '10') },
  { id: 'g4', title: 'A PA or NP for ESI 2', text: () => `Tap **Chen**, an NP. Then **${E.roomName(tid('grace').room || '10')}**.\nPAs and NPs see ESI 2–5. For ESI 2, an attending signs off too: a **co-sign**.`, ...provStep('grace', 'np1') },
  { id: 'g5', wait: true, title: 'Workup', text: `She gets an ECG, labs, and a chest X-ray. **Troponin**, a lab, rises when heart muscle is hurt.`, done: () => tid('grace').dsp !== 'none' || tid('grace').loc === 'gone' },
  { id: 'g6', title: 'Your call', text: () => `No heart attack so far. The **HEART score** rates her risk, 0–10. Hers is **${tid('grace').gray ? tid('grace').gray.score : 5}**.\n**0–3**: home. **4–6**: **observation**, a day to watch her. **7+**: admit.\nTap **her room**, then **Observation**.`,
    ...roomAct('grace', '[data-act="gray"][data-arg$="|obs"]'), done: () => !!tid('grace').grayPick || tid('grace').loc === 'gone', auto: () => E.grayDispo(tid('grace').id, 'obs') },

  { id: 'h1', title: 'Free a bed', text: () => `[[Jordan]], 22, has been seen and only waits on a strep test. He doesn’t need a bed.\nTap **his room**, **Move bed**, then **Chair 1**.`,
    setup: () => ({ jordan: E.trainPatient('strep', 'seat', { room: '9', prov: 'pa1', name: 'Jordan P.', age: 22, sex: 'M', run: { lab: 15 } }) }),
    spot: () => { const p = tid('jordan'); if (U.sel && U.sel.type === 'move' && U.sel.pid === p.id) return ['#room-C1, #mroom-C1']; return onSheet(p) ? ['#sheet [data-act="moveSel"]'] : [roomSel(p)]; },
    done: () => { const r = E.roomOf(tid('jordan')); return !r || r.kind === 'chair'; }, auto: () => E.move(tid('jordan').id, 'C1') },

  { id: 'r1', title: 'Walk the waiting room', text: () => `People who feel forgotten **walk out**, and some are sick. A quick update buys patience. **Experience** on each card shows how they feel.\nTap the **${FP() ? 'waiting room' : 'Waiting room header'}**, then **Walk the waiting room**.`,
    setup: () => ({ sofia: E.trainPatient('ankle', 'waiting', { name: 'Sofia R.', age: 27, sex: 'F', waited: 35 }), victor: E.trainPatient('afib', 'waiting', { name: 'Victor S.', age: 71, sex: 'M', waited: 20, esiT: 3, lang: 'es' }) }),
    spot: () => (sheetIs('zone', 'triage') ? ['#sheet [data-act="updWait"]'] : ['.lane-h[data-arg="triage"], #mWait']),
    done: () => g().wrUpdate > -1e8, auto: () => E.updateWaiting() },
  { id: 'r2', title: 'Recheck', text: () => `[[Victor]] was triaged ESI 3, but his heart rate is about **150** (normal is 60–100).\nA **recheck** repeats vitals and catches people sicker than they looked.\n${far('Tap **the waiting room**, then **Card** beside Victor', FP() ? 'Tap [[Victor]], then **Card** in the blue bar' : 'Tap [[Victor]], then **Card**')}. Then tap **Bea** under Recheck vitals.`,
    spot: () => { const p = tid('victor'); if (onSheet(p)) return ['#sheet [data-act="recheck"][data-arg$="|rnT"]']; if (sheetIs('zone', 'triage')) return [`#sheet [data-act="ptCard"][data-arg="${p.id}"]`]; return selPt(p) ? ['#selbar [data-act="selInfo"]'] : ptSpot(p); },
    done: () => { const p = tid('victor'), b = E.staff('rnT'); return p.esiT == null || b.tq.some(k => k.pid === p.id && k.kind === 'recheck') || !!(b.task && b.task.kind === 'recheck' && b.task.pid === p.id); },
    auto: () => E.recheck(tid('victor').id, 'rnT') },
  { id: 'r3', wait: true, title: 'Rechecking', text: `Bea rechecks his vitals.`, done: () => tid('victor').esiT == null },
  { id: 'r4', title: 'Bed him now', text: () => `Victor is really **ESI 2**. A heart that fast can give out.\n${far('Tap **the waiting room**, pick [[Victor]]', 'Tap [[Victor]]')}, then **Room 13**.`, ...bedStep('victor', '13') },
  { id: 'r5', title: 'Interpreter', text: `Victor speaks **Spanish**. Without an **interpreter**, his care is slower and riskier.\nTap **his room**, then **Get a Spanish interpreter**.`,
    ...roomAct('victor', '[data-act="interp"]'), done: () => tid('victor').interp !== 'none' || tid('victor').loc === 'gone', auto: () => E.requestInterp(tid('victor').id) },

  { id: 's1', title: 'Breaks', text: `**Staff** is morale. Tired people slow down. If it hits bottom, they walk out.\nOpen **Team** and send **Mo**, a tech, on a 30-minute break.`,
    spot: () => (sheetIs('team') || U.wide ? ['#sheet [data-act="brk"][data-arg="pct1"]', '#side [data-act="brk"][data-arg="pct1"]'] : ['#dockTeam']),
    done: () => E.staff('pct1').st !== 'on', auto: () => E.sendBreak('pct1') },
  { id: 's2', title: 'A decision', text: `Now and then a **card** like this stops the clock for a decision. Every choice **costs** something: points, time, or morale.\nPick either one.`,
    setup: () => { E.trainCard(); return null; }, spot: () => ['#modal .mc-ch button'], done: () => !!g().trPick, auto: () => { if (g().card) E.chooseCard('yes'); else g().trPick = 'yes'; } },

  { id: 'd1', title: 'Something broke', text: `The **CT scanner** is down. Without it you can’t check a head injury or a **stroke**.\nTap **Divert**, then **Go on CT Divert** to send those ambulances elsewhere.`,
    setup: () => { E.trainOutage('ct', 8); return null; },
    spot: () => (sheetIs('divert') ? ['#sheet [data-act="divertSet"][data-arg="ct|1"]'] : ['#btnYellow']),
    done: () => g().dv.ct.on, auto: () => E.setDivert('ct', true) },
  { id: 'd2', wait: true, title: 'Biomed is on it', text: `**Biomed**, the equipment engineers, are fixing it. Strokes and head injuries go elsewhere until then.`, done: () => !E.outActive('ct') },
  { id: 'd3', title: 'Lift it', text: `CT is back. Staying on divert now sends patients away for nothing and **costs points**.\nTap the red **CT** button, then **Lift CT Divert**.`,
    spot: () => (sheetIs('divert') ? ['#sheet [data-act="divertSet"][data-arg="ct|0"]'] : ['#btnYellow']),
    done: () => !g().dv.ct.on, auto: () => E.setDivert('ct', false) },

  { id: 'x1', title: 'A transfer', text: `[[Zoe]], 1, has **RSV**, a virus that clogs a baby’s airways. She’s tiring out.\nShe needs a **PICU** (children’s ICU). You don’t have one.\nTap **her room**, **Find a hospital**, then **Call** beside **Children’s Hospital**.`,
    setup: () => ({ zoe: E.trainPatient('rsv', 'seat', { room: 'R2', prov: 'md1', name: 'Zoe N.', age: 1, sex: 'F', dsp: 'readytx' }) }),
    spot: () => { const p = tid('zoe'); return sheetIs('hosp') ? ['#sheet [data-act="callHosp"][data-arg$="|kids"]'] : onSheet(p) ? ['#sheet [data-act="hospOpen"]'] : [roomSel(p)]; },
    done: () => tid('zoe').dsp !== 'readytx', auto: () => E.callHosp(tid('zoe').id, 'kids') },
  { id: 'x2', wait: true, title: 'Calling', text: `Children’s is deciding. Meanwhile **RT**, the respiratory therapist, starts **high-flow oxygen**.`, done: () => tid('zoe').dsp !== 'txcall' },
  { id: 'x3', title: 'Pick the ride', text: `They said yes. Now the ride.\n**BLS** is EMTs. **ALS** is paramedics. **Critical care** adds an ICU nurse and gear. A **flight** is for when time is the problem.\nShe needs **Critical care ground**. Tap **her room**, then that.`,
    ...roomAct('zoe', '[data-act="ift"][data-arg$="|cct"]'), done: () => tid('zoe').dsp !== 'txok', auto: () => E.bookIFT(tid('zoe').id, 'cct') },

  { id: 'k1', next: true, title: 'Alerts you will hear', text: `Other alerts on the Box, each with a **time goal**:\n**STEMI**: a heart attack. The **cath lab** opens the artery.\n**Stroke**: a clot or bleed in the brain.\n**Sepsis**: an infection taking over. Antibiotics within the hour.\n**Code**: the heart has stopped.`},
  { id: 'k2', next: true, title: 'People who leave', text: `Three bad ways to leave, and each costs you:\n**LWBS**: left without being seen.\n**AMA**: left against medical advice.\n**72-hour return**: sent home, came back sicker.\nThe first two are usually about waiting.`},
  { id: 'k3', next: true, title: 'When you’re full', text: `**ED Full** tells ambulances you have no room. **No Monitored Beds** means no beds with heart monitors left.\nUse them only when you really are full.\n**Words** lives in the **menu**, top right.`, spot: () => ['#needBtn'] },
  { id: 'end', final: true, title: 'You’re ready', text: `That’s the job. A real shift throws it all at once. Your summary shows your **three worst moments**. That’s where you learn most.\nStart with **Quiet Tuesday**.`},
];
const me = () => g().me;
const seeStep = (key) => ({
  spot: () => { const p = tid(key); return onSheet(p) ? ['#sheet [data-act="see"]'] : [roomSel(p)]; },
  done: () => tid(key).prov === me(), auto: () => E.assign(me(), tid(key).id),
});
/* list: [['t', 'lab'], ['r', 'meds']]. A kind of test (lab, xr, ct, us) means the named tests this patient's case needs of
   that kind (a CBC and a BMP, the CT abdomen and pelvis), so the preceptor lights each one in turn. */
const ordList = (p, list) => list.flatMap(([k, v]) => (k === 't' && v !== 'ecg' && E.WORK[v] ? E.needOf(p).n.filter(d => E.DET_KIND(d) === v).map(d => ['t', d]) : k === 'r' && E.drugsFor(p, v).length ? E.drugsFor(p, v).map(d => ['r', d]) : k === 'r' && v === 'pace' ? [['r', 'tcp']] : [[k, v]]));
const ordHas = (p, k, v) => (k === 't' ? (v === 'ecg' ? p.wk.includes('ecg') : (p.det || []).includes(v)) : (p.drugs || []).includes(v) || p.tr.includes(v));
// The ring goes on the closed menu first, then on the order inside it.
const omSpot = key => { const S = OM_OPEN(), m = omOf(key).find(x => !S.has(x)); return m ? `#sheet [data-act="ordMenu"][data-arg="${m}"]` : null; };
const ordStep = (key, list) => ({
  spot: () => {
    const p = tid(key); if (!onSheet(p)) return [roomSel(p)];
    const o = U.ord && U.ord.pid === p.id ? U.ord : { tests: [], treats: [] };
    const next = ordList(p, list).find(([k, v]) => !(k === 't' ? o.tests : o.treats).includes(v) && !ordHas(p, k, v));
    return next ? [omSpot(next[1]) || `#sheet [data-act="ordT"][data-arg="${p.id}|${next[0]}|${next[1]}"]`] : ['#sheet [data-act="sign"]'];
  },
  done: () => { const p = tid(key); return p.ord === 'signed' && ordList(p, list).every(([k, v]) => ordHas(p, k, v)); },
  auto: () => { const p = tid(key), L = ordList(p, list); U.ord = null; E.signOrders(p.id, L.filter(x => x[0] === 't').map(x => x[1]), L.filter(x => x[0] === 'r').map(x => x[1])); },
});
const callStep = (key, pick, spec) => ({
  spot: () => { const p = tid(key); if (sheetIs('consult')) return [`#sheet [data-act="consultSpec"][data-arg="${spec}"]`]; return onSheet(p) ? [`#sheet [data-act="mdd"][data-arg="${p.id}|${pick}"]`] : [roomSel(p)]; },
  done: () => { const p = tid(key); return !!p.mdPick || p.consult.st !== 'none' || p.loc === 'gone'; },
  auto: () => { const p = tid(key); return pick === 'consult' ? E.consult(p.id, spec) : E.mdDecide(p.id, pick); },
});
const STEPS_MD = [
  { id: 'hi', next: true, title: 'Welcome, Doctor', text: `I’m your **preceptor**. You’re the **attending**, the ER doctor, in this **ED**.\nThe **charge nurse** runs beds and nurses. You **see patients, write orders, and decide where they go**. You also answer the radio.\nTap what I light up.`},
  { id: 'words', next: true, title: 'The words', text: `Medicine loves short names: **ESI, DKA, CT, ICU**. I’ll explain each as we go. **Words** has the list.`, spot: () => ['#coach [data-act="words"]'] },
  { id: 'ui1', next: true, title: 'The menu', text: () => `**☰**, top right, is the **menu**: pause, restart, How to play, and settings.${FP() ? `\n**3D floor: on/off** in there switches between the 3D and flat map.${TD() ? ' The flat map shows first while 3D loads.' : ''}` : ''}`, spot: () => ['#btnPause'] },
  { id: 'ui2', next: true, title: 'Events and the key', text: () => (FP() ? `The **bell** is **Events**: everything that happened this shift. New patients also pop up at the bottom left.\n**?** shows what every colour and icon means.` : `Messages show at the top. **How to play** in the menu explains the whole board.`), spot: () => (FP() ? ['#btnMsgs', '#mzoom [data-act="legend"]'] : ['#btnPause']) },
  { id: 'rack', next: true, title: 'Who needs you', text: () => (FP() ? 'A **blue** room is waiting for a doctor. Yours get a **gold ring**.' : 'Rooms marked **Needs a provider** are waiting for a doctor. Yours show **YOU**.') + '\nA **pod** is four rooms and one nurse.\nThe circle is the **ESI**: **1** needs life-saving help now, **5** is minor.\nWait too long and another doctor takes them.', spot: () => ['#zh-a, #mzh-a', '#zbar'] },
  { id: 'you', next: true, title: 'Your line', text: () => `You’re **Dr. Patel**, ${SIDE()}. Your button shows what you’re doing and who’s waiting on you.\nThe others are another attending and the **PAs and NPs**.`, spot: () => ['#dockProv [data-arg="md1"]', '#sideProv [data-arg="md1"]'] },

  { id: 'top', next: true, title: 'Your scores', text: () => `Four scores grade you:\n**Patients**: how they feel about the visit.\n**Clinical**: your care, right and on time.\n**Admin**: flow and cost.\n**Staff**: team morale.${FP() ? '\nThe **meter** by the zoom buttons counts patients waiting on their next step.' : ''}`, spot: () => ['#top .pills', '#waitMeter'] },

  { id: 'j1', title: 'Sore throat', text: `**Room 1**: [[Jordan]], 22, sore throat and fever.\nTap **his room**, then **See this patient**.`,
    setup: () => ({ jordan: E.trainPatient('strep', 'room', { room: '1', name: 'Jordan P.', age: 22, sex: 'M' }) }), ...seeStep('jordan') },
  { id: 'j2', wait: true, title: 'In the room', text: `You take his **history**, his story of what happened, and examine him.`, done: () => tid('jordan').ord === 'need' },
  { id: 'jv', title: 'His card', text: `Everything about him is on his **card**.\nTap **his room** to open it.`, spot: () => [roomSel(tid('jordan'))], done: () => onSheet(tid('jordan')), auto: () => { U.sel = null; U.sheet = { type: 'pt', pid: tid('jordan').id }; } },
  { id: 'jv2', next: true, keep: true, title: 'Vital signs', text: `**Vitals**, normal for an adult:\n**HR** (heart rate) 60–100\n**BP** (blood pressure) about 120/80\n**RR** (breaths a minute) 12–20\n**SpO2** (oxygen) 95%+\n**Temp** 100.4+ is a fever\n**Red** is out of range, like his fever.`, spot: () => ['#sheet .ph-cc'] },
  { id: 'j3', keep: true, title: 'Write orders', text: `**Orders** are the tests (the **workup**) and treatments. Order what he needs, **nothing extra**.\nHe needs a **rapid strep** and **penicillin** pills. Orders sit in menus: tap a menu to open it.\nTap **Labs**, **Rapid strep**, then **Medications**, **Antibiotics by mouth**, **Penicillin VK**, and **Sign**.`, ...ordStep('jordan', [['t', 'lab'], ['r', 'meds']]) },
  { id: 'j4', wait: true, title: 'Results', text: `A **tech** swabs his throat. The result comes to you.`, done: () => tid('jordan').dsp === 'mddecide' || !!tid('jordan').mdPick },
  { id: 'j5', title: 'Your call', text: `It’s **strep throat**.\nWhere he goes next is the **disposition**: **home**, **admit**, or **transfer**. Your call.\nTap **his room**, then **Discharge home**.`, ...callStep('jordan', 'home') },
  { id: 'j6', wait: true, title: 'Going home', text: `His nurse gives him the prescription and the **warning signs** to come back for.`, done: () => tid('jordan').loc === 'gone' },

  { id: 'a1', title: 'Vomiting, sugar very high', text: `**Room 5**: [[Aisha]], 24, **ESI 2**. She’s vomiting and her sugar is very high.\nTap **her room**, then **See this patient**.`,
    setup: () => ({ aisha: E.trainPatient('dka', 'room', { room: '5', name: 'Aisha K.', age: 24, sex: 'F' }) }), ...seeStep('aisha') },
  { id: 'a2', wait: true, title: 'In the room', text: `Her breath smells **fruity**. She’s breathing **fast and deep**. Her mouth is dry.`, done: () => tid('aisha').ord === 'need' },
  { id: 'a3', title: 'Treat what you find', text: `This looks like **DKA**: without **insulin**, the body burns fat and the blood turns acid.\nOrder a **BMP** (sugar and **potassium**), a **blood gas** (how acid), a **pregnancy test** (any woman who could be pregnant), **fluids**, an **insulin drip**, and **potassium** (insulin lowers it).\nTap **her room**. **BMP**, **Blood gas**, **Pregnancy test**, **Normal saline** (Fluids and blood), **Insulin drip** and **Potassium** (Medications, Sugar and electrolytes), **Sign**.`, ...ordStep('aisha', [['t', 'lab'], ['r', 'fluids'], ['r', 'insulin'], ['r', 'meds']]) },
  { id: 'a4', wait: true, title: 'Results', text: `**Glucose 540** (normal about 100). **Anion gap 26**: acid in the blood (normal under 12).\n**Potassium 4.8**: safe for insulin, which drops potassium.\nIt’s DKA. Her nurse starts the drip.`, done: () => tid('aisha').dsp === 'mddecide' || !!tid('aisha').mdPick },
  { id: 'a5', title: 'Admit her', text: `An insulin drip needs hourly checks, so she goes to the **ICU**.\nTo admit, you call a **consult**, the team that takes over.\nTap **her room**, **Admit: call a consult**, then **Critical Care**.`, ...callStep('aisha', 'consult', 'icu') },
  { id: 'a6', wait: true, title: 'Admitted', text: `Critical Care **admits** her. The charge nurse handles the bed upstairs.`, done: () => E.isBoarder(tid('aisha')) || tid('aisha').loc === 'gone' },

  { id: 'b1', title: 'Belly pain', text: `**Room 9**: [[Sam]], 19. Belly pain that moved to the lower right.\nTap **his room**, then **See this patient**.`,
    setup: () => ({ sam: E.trainPatient('appy', 'room', { room: '9', name: 'Sam O.', age: 19, sex: 'M' }) }), ...seeStep('sam') },
  { id: 'b2', wait: true, title: 'In the room', text: `His lower right belly hurts to press. That’s where the **appendix** is.`, done: () => tid('sam').ord === 'need' },
  { id: 'b3', title: 'A thin workup', text: `Let’s see what a missing test does.\nOrder only a **CBC**, a **BMP**, and **morphine** for pain (Medications, Pain), then **Sign**.`, ...ordStep('sam', [['t', 'lab'], ['r', 'meds']]) },
  { id: 'b4', wait: true, title: 'Waiting on labs', text: `The labs come back.`, done: () => tid('sam').ord === 'more' || !!tid('sam').dxK },
  { id: 'b5', title: 'Something is missing', text: `His **WBC** (white count) is 15.8, high with infection. But blood tests can’t say which organ. A **CT** scan can.\nTap **his room**, add **CT abdomen and pelvis**, then **Sign**. Gaps like this cost time.`, ...ordStep('sam', [['t', 'ct']]) },
  { id: 'b6', wait: true, title: 'CT', text: `The CT shows **appendicitis**.`, done: () => tid('sam').dsp === 'mddecide' || !!tid('sam').mdPick },
  { id: 'b7', title: 'Call surgery', text: `That gets fixed in the **OR**.\nTap **his room**, **Admit: call a consult**, then **General Surgery**.\nCall before results are back and they get grumpy and slow.`, ...callStep('sam', 'consult', 'surg') },

  { id: 'r1', title: 'The radio', text: `The radio (**the Box**) is ringing. A crew needs a **doctor’s OK**: **medical direction**.\nTap **Answer**. **Approve** if it’s right. **Deny** if it could hurt them.\nHere’s the rule: an adult who’s thinking clearly **may refuse** care.`,
    setup: () => { E.trainConsult(); return null; },
    spot: () => { if (U.modal && U.modal.type === 'scen') return ['#modal [data-act="scen"]']; if (U.modal && U.modal.type === 'result') return ['#modal [data-act="modalOk"]']; return ['#boxbar .bx-btn']; },
    done: () => g().stats.boxC.ans >= 1 && !U.modal,
    auto: () => { const c = g().box.cur; let sc = U.modal && U.modal.sc; if (c && c.kind === 'consult') { if (!c.taken) { const r = E.boxTake(me()); sc = r.sc; } E.boxDecide(sc ? (sc.opts ? sc.r : sc.a) : true); } U.modal = null; U.sheet = null; } },

  { id: 's1', wait: true, title: 'Stroke alert', text: `A **stroke alert**: a man in his 70s who can’t move his right side.\nA **stroke** is a brain blood vessel that’s blocked or burst. The alert calls **neurology**.`,
    setup: () => ({ stroke: E.trainPatient('stroke', 'alert', { name: 'Harold W.', age: 74, sex: 'M', unit: 'Medic 14', eta: 6, lkw: 40 }) }), done: () => tid('stroke').loc === 'room' },
  { id: 's2', title: 'Time is brain', text: () => `Brain dies every minute it’s blocked. A **thrombolytic** can dissolve the clot, but only in the first hours.\nTap **${E.roomName(tid('stroke').room || 'R1')}**, then **See this patient**.`, ...seeStep('stroke') },
  { id: 's3', wait: true, title: 'In the room', text: () => `Right side weak, speech slurred.\n**Last known well: ${E.clock(tid('stroke').lkwT)}**, the last time anyone saw him normal. It decides what treatments are still possible.`, done: () => tid('stroke').ord === 'need' },
  { id: 's4a', next: true, title: 'CT first', text: `The clot drug is dangerous if it’s a **bleed**, so **CT comes first**. The nurse gives it once CT is clear and neurology agrees.`},
  { id: 's4', title: 'Stroke orders', text: `His BP is under **185/110**, the drug’s limit. Over that, you’d add **blood pressure control** first.\nTap **his room**, **CT head**, **BMP**, then **Tenecteplase** (Medications, Clots), and **Sign**.`, ...ordStep('stroke', [['t', 'ct'], ['t', 'lab'], ['r', 'tnk']]) },
  { id: 's5', wait: true, title: 'Door to needle', text: `Two goals: **CT within 25 minutes**, drug **within 60** (**door to needle**). Both are on his card.`, done: () => { const p = tid('stroke'); return (p.treat.tnk && p.treat.tnk.st === 'done') || p.loc === 'gone'; } },
  { id: 's6', wait: true, title: 'To the ICU', text: `Neurology admits him to the **ICU** to watch for bleeding.`, done: () => E.isBoarder(tid('stroke')) || tid('stroke').loc === 'gone' },

  { id: 'k0', next: true, title: 'A few last things', text: () => `**Next** jumps to what’s waiting on you.\n**Not improving** means a treatment is missing.\nSome chest pain and fainting get a **risk score**: home, **observation**, or admit.${FP() ? '\n**+** zooms in to show words.' : ''}`, spot: () => ['#needBtn'] },
  { id: 'k1', next: true, title: 'Words for a real shift', text: `**STEMI**: heart attack. The **cath lab** opens the artery.\n**Sepsis**: infection taking over. Antibiotics within the hour.\n**MTP**: blood fast for a bleeding patient.\n**Code**: heart stopped.\n**Intubation**: a breathing tube.\n**Words**, in the menu, has the rest.`},
  { id: 'kdx', next: true, title: 'On a real shift: you name it', text: `When results are back, **you name the diagnosis** from four choices. Read the **exam and results** first.\nA miss costs **accuracy** and raises **legal risk**. At 25% administration calls; at 75% you’re let go.\nA drug that can hurt the patient counts as **harm**.` },
  { id: 'end', final: true, title: 'You’re ready, Doctor', text: `That’s the job. Sickest first. Order what they need, no more. Make the call. Answer the radio.\nPatients waiting on you **cost points**.\nStart with **Quiet Tuesday**.`},
];
/* ---------- Lessons: one condition, one patient, about two minutes each. The player is the attending. ----------
   Same preceptor, same rules as Orientation: it lights up what to tap, holds the clock until the player acts, and fast-forwards the waiting.
   Each lesson stands alone: it explains every term it uses, and ends with the short version and what the charge nurse does. */
const LP = () => tid('pt');
const lRoom = () => E.roomName((LP() && LP().room) || 'R1');
const lBP = () => { const v = E.vitalsOf(LP()); return `${v.sbp}/${v.dbp}`; };
const lRoomed = () => LP().loc === 'room';
const lExamined = () => LP().ord === 'need';
const lResulted = () => { const p = LP(); return p.dsp === 'mddecide' || !!p.mdPick || p.loc === 'gone' || E.isBoarder(p); };
const lLeft = () => LP().loc === 'gone' || E.isBoarder(LP());
const lCard = { spot: () => [roomSel(LP())], done: () => onSheet(LP()), auto: () => { U.sel = null; U.sheet = { type: 'pt', pid: LP().id }; } };
// A practice radio call: answer, decide, read why. n: how many calls answered when it's done.
const radioStep = n => ({
  spot: () => { if (U.modal && U.modal.type === 'scen') return ['#modal [data-act="scen"]']; if (U.modal && U.modal.type === 'result') return ['#modal [data-act="modalOk"]']; return ['#boxbar .bx-btn']; },
  done: () => g().stats.boxC.ans >= n && !U.modal,
  auto: () => { const c = g().box.cur; let sc = U.modal && U.modal.sc; if (c && c.kind === 'consult') { if (!c.taken) { const r = E.boxTake(me()); sc = r.sc; } E.boxDecide(sc ? (sc.opts ? sc.r : sc.a) : true); } U.modal = null; U.sheet = null; },
});
// v0.28: lessons for the attending sit under body systems, in the order of the EM Model.
const LESSON_SYS = [['cardio', 'Cardiovascular'], ['resp', 'Respiratory'], ['neuro', 'Nervous system'], ['gi', 'Abdominal and GI'], ['endo', 'Endocrine and metabolic'], ['gu', 'Renal and genitourinary'], ['obgyn', 'Obstetrics and gynecology'], ['infect', 'Infections and sepsis'], ['tox', 'Toxicology'], ['trauma', 'Trauma'], ['ems', 'EMS medical direction']];
const LESSONS = {
  radio: { name: 'Giving medical direction', sys: 'ems', blurb: 'Take the report, give a clear order, hear it read back, know when to say no.', steps: [
    { id: 'm0', next: true, title: 'Medical direction', text: `Paramedics work from **protocols**. Some steps need a **doctor’s order** by radio: **medical direction**.\nYour order is a medical order. You’re responsible for it, just like one you write in the ED.` },
    { id: 'm1', next: true, title: 'Hear the whole report', text: `Listen for **age and weight**, the **problem**, **vitals**, what they’ve **done**, and what they **want**.\nMissing something? **Ask.** A dose for a child needs a weight.` },
    { id: 'm2', title: 'Yes or no', text: `The Box is ringing. A man with a twisted ankle wants to refuse the ride.\nAn adult who’s **thinking clearly** and understands the risks **may refuse**.\nTap **Answer**, then decide.`,
      setup: () => { E.trainConsult('train'); return null; }, ...radioStep(1) },
    { id: 'm3', next: true, title: 'Giving an order', text: `A good order has **four parts**: the **drug**, the **dose**, the **route**, and **how often**.\n“Midazolam **10 mg IM**, once.”\nChildren: the dose is **per kilogram**. Do the math out loud.` },
    { id: 'm4', title: 'A dose for a child', text: `A crew has a seizing **20 kg** child, no IV. They want intranasal **midazolam**: **0.2 mg/kg**.\nTap **Answer**, then pick the dose.`,
      setup: () => { E.trainConsult('tdose'); return null; }, ...radioStep(2) },
    { id: 'm5', next: true, title: 'Read-back', text: `The medic **reads the order back**. You say “**correct**” or fix it.\nThis is **closed-loop communication**. It catches a wrong dose before it reaches the patient.` },
    { id: 'm6', title: 'An order to act', text: `Some calls ask for a **procedure**, not a drug. Decide fast: some can’t wait for the hospital.\nTap **Answer**, then give the order.`,
      setup: () => { E.trainConsult('tord'); return null; }, ...radioStep(3) },
    { id: 'm7', next: true, title: 'When to say no', text: `**Deny** a request that could hurt: nitro with a **systolic under 90**, or after **sildenafil or tadalafil**.\nThen say what to do instead: “No nitro. **Fluids** and transport.”\nYou also pick **where they go**: a stroke center, a cath lab, a trauma center.` },
    { id: 'm8', final: true, title: 'Medical direction: the short version', text: `**Listen**: age, weight, problem, vitals, what’s done, what they want.\n**Order**: drug, dose, route, how often.\n**Read-back**: hear it repeated, then confirm.\n**Say no** when it could hurt, and **say what to do instead**.` },
  ] },
  stroke: { name: 'Stroke', sys: 'neuro', blurb: 'Clot or bleed. The 185/110 limit. Door to needle.', steps: [
    { id: 'k0', next: true, title: 'Stroke', text: `A **stroke** is a brain blood vessel that’s blocked or burst.\nIt hits **suddenly**: face droop, a weak arm or leg, slurred speech.\nA blocked one can be reopened, but only in the **first few hours**.`},
    { id: 'k1', wait: true, title: 'Stroke alert', text: `An ambulance is bringing [[Helen]], 68. She can’t move her right side.\nThe **stroke alert** calls **neurology** and saves the **CT** scanner for her.`,
      setup: () => ({ pt: E.trainPatient('stroke', 'alert', { name: 'Helen V.', age: 68, sex: 'F', unit: 'Medic 14', eta: 4, lkw: 50, bpOver: true }) }), done: lRoomed },
    { id: 'k2', title: 'Time is brain', text: () => `Every minute blocked, brain dies.\nTap **${lRoom()}**, then **See this patient**.`, ...seeStep('pt') },
    { id: 'k3', wait: true, title: 'In the room', text: () => `Right side weak, speech slurred.\n**Last known well: ${E.clock(LP().lkwT)}**. The clot drug must go in within **4½ hours** of that (later needs perfusion imaging, which this game doesn’t model).`, done: lExamined },
    { id: 'k4', next: true, title: 'Clot or bleed', text: `A **CT** shows if it’s a **clot** or a **bleed**.\nA **thrombolytic** dissolves clots, but it makes a bleed worse. So **CT first**.`},
    { id: 'k5', next: true, title: 'Her pressure is too high', text: () => `Her BP is **${lBP()}**. The clot drug’s limit is **185/110**.\nAbove that, the brain can bleed. Add **blood pressure control**. The nurse waits until it’s down.`},
    { id: 'k6', title: 'Stroke orders', text: `Tap **her room**. Then **CT head**, **BMP**, **Labetalol** (Medications, Heart and blood pressure), **Tenecteplase** (Clots), **Sign**.\nThe BMP checks sugar. Low sugar can look just like a stroke.`, ...ordStep('pt', [['t', 'ct'], ['t', 'lab'], ['r', 'bp'], ['r', 'tnk']]) },
    { id: 'k7', wait: true, title: 'Two clocks', text: `**Door to CT: 25 minutes.**\n**Door to needle: 60 minutes.**\nThe drug goes in once CT shows no bleed, neurology agrees, and BP is under 185/110.`,
      done: () => { const p = LP(); return !!(p.treat.tnk && p.treat.tnk.st === 'done') || p.loc === 'gone'; } },
    { id: 'k8', wait: true, title: 'After the drug', text: `Neurology admits her to the **ICU** to watch for bleeding.`, done: lLeft },
    { id: 'k8b', next: true, title: 'Not every stroke gets it', text: `**No clot drug** if they:\n• arrived **over 4½ hours** after last known well,\n• **woke up** with it (onset unknown counts as too late),\n• take a **blood thinner** like apixaban (check **Home meds**).\nThen there is no door-to-needle clock. **Let the pressure run** up to **220/120**, unless a large-vessel stroke goes for **clot removal**.` },
    { id: 'k9', final: true, title: 'Stroke: the short version', text: `**Looks like**: sudden face droop, weak arm or leg, slurred speech.\n**Order**: CT, labs, thrombolytic. BP control if over 185/110.\n**No drug** if late, woke up with it, or on a blood thinner: pressure up to 220/120 is fine.\n**Clock**: CT in 25, drug in 60.\n**Charge nurse**: room her now, keep CT free.` },
  ] },
  arrest: { name: 'Cardiac arrest', sys: 'cardio', blurb: 'Shockable or not. Epinephrine, amiodarone, the H’s and T’s. Children and injuries.', steps: [
    { id: 'ca0', next: true, title: 'No pulse', text: `**Cardiac arrest**: the heart has stopped pumping. No pulse, not breathing.\nThe team starts **CPR** at once: push **hard** (2 inches, 5 cm) and **fast** (100 to 120 a minute), let the chest **come back up**, keep **pauses under 10 seconds**, and swap compressors **every 2 minutes**. The attending **runs the code**.` },
    { id: 'ca1', next: true, title: 'Read the monitor', text: `The **rhythm** picks the path.\n**Shockable:** **VF** (a quivering heart) or **pulseless VT**. **Not shockable:** **PEA** (a rhythm with no pulse) or **asystole** (a flat line).` },
    { id: 'ca2', next: true, title: 'Shockable', text: `**VF:** shock (**defibrillate**) right away, then **2 minutes of CPR**.\nStill VF? Shock again, then **epinephrine 1 mg IV** every 3 to 5 minutes. After the third shock: **amiodarone 300 mg**.` },
    { id: 'ca3', next: true, title: 'Not shockable', text: `**PEA or asystole:** no shock. CPR, and **epinephrine 1 mg IV** as soon as you can.\nThen find the cause, the **H’s and T’s**: low **volume**, low **oxygen**, **acid**, **potassium**, **cold**; **tension** pneumothorax, **tamponade**, **toxins**, a **clot**.` },
    { id: 'ca4', next: true, title: 'Children and injuries', text: `**Children** get doses **by weight**: epinephrine **0.01 mg/kg**, shocks **2, then 4 J/kg**. Most child arrests start with **breathing**.\n**Injury:** fix the causes **all at once**: stop the bleeding, give **blood**, secure the airway, **decompress the chest**.` },
    { id: 'ca5', final: true, title: 'Cardiac arrest: the short version', text: `Your patient loses their pulse? Tap **Run the code**. Each **rhythm check** is a card, about two minutes apart.\nRight calls and a fast start raise the odds of **ROSC** (a pulse coming back). Nobody runs it for 20 minutes, and they die.` },
  ] },
  tachy: { name: 'A fast heart that’s crashing', sys: 'cardio', blurb: 'A-fib: stable or unstable. Slow it, or shock it in time.', steps: [
    { id: 'ta0', next: true, title: 'A fast heart', text: `**A-fib** (atrial fibrillation) is a fast, irregular rhythm. Most patients are **stable**: the pressure holds.\nStable: **slow the rate** with **diltiazem** or **metoprolol**, and think about a **blood thinner**.` },
    { id: 'ta1', next: true, title: 'Unstable', text: `**Unstable** means the rhythm is hurting them: **low pressure**, **chest pain**, **confusion**, **short of breath**.\nNow the drugs that slow the heart can drop the pressure further: **don’t give them**.` },
    { id: 'ta2', next: true, title: 'Shock it', text: `Unstable: **synchronized cardioversion**, a shock **timed to the heartbeat**, with sedation if there’s time.\nIt’s on the order sheet, under **Procedures**.` },
    { id: 'ta3', final: true, title: 'A fast heart: the short version', text: `Stable A-fib that started **under 48 hours** ago can be shocked back too.\nLonger, or **not sure** when it started? A clot may be waiting in the heart: **three weeks of a blood thinner**, or a **TEE** (an ultrasound through the esophagus) to rule out a clot, before a shock.` },
  ] },
  heart: { name: 'Heart attack', sys: 'cardio', blurb: 'The ECG. A STEMI alert. Door to balloon.', steps: [
    { id: 'h0', next: true, title: 'Heart attack', text: `A **heart attack** is a blocked heart artery. The muscle behind it starts to die.\nIt feels like **chest pressure**, often with sweating or arm or jaw pain.\nFirst test: an **ECG**, a quick heart tracing.`},
    { id: 'h1', wait: true, title: 'STEMI alert', text: `The paramedics’ ECG shows a **STEMI**: an artery fully blocked.\nThey’re bringing [[Frank]], 58.\nThe alert calls **cardiology** and opens the **cath lab**, where a thin tube reopens the artery.`,
      setup: () => ({ pt: E.trainPatient('stemi', 'alert', { name: 'Frank D.', age: 58, sex: 'M', unit: 'Medic 9', eta: 4 }) }), done: lRoomed },
    { id: 'h2', title: 'See him now', text: () => `He’s **ESI 1**, the sickest.\nTap **${lRoom()}**, then **See this patient**.`, ...seeStep('pt') },
    { id: 'h3', wait: true, title: 'In the room', text: `He’s gray and sweating. The pressure runs down his left arm.\nGoal: **ECG within 10 minutes** of arrival. Done.`, done: lExamined },
    { id: 'h4', title: 'Heart attack orders', text: `The ECG already made the call.\n**Troponin** (heart damage) gets ordered, but don’t wait on it.\nHe needs **aspirin** now.\nTap **his room**, **Troponin**, then **Aspirin** (Medications, Heart and blood pressure), and **Sign**.`, ...ordStep('pt', [['t', 'lab'], ['r', 'meds']]) },
    { id: 'h5', wait: true, title: 'Door to balloon', text: `Cardiology takes him to the cath lab.\nGoal: **door to balloon in 90 minutes**, arrival to artery open.`, done: lLeft },
    { id: 'h6', next: true, title: 'Most chest pain isn’t this', text: `Most chest pain is **not** a STEMI. It still gets an ECG, labs, a **chest X-ray**, and medicine.\nThen the **HEART score** (0–10):\n**0–3**: home. **4–6**: **observation**. **7+**: admit.`},
    { id: 'h7', final: true, title: 'Heart attack: the short version', text: `**Looks like**: chest pressure, sweating, arm or jaw pain.\n**Order**: ECG, labs, **aspirin**. Not a STEMI: add a **chest X-ray**.\n**Clock**: ECG in 10, artery open in 90.\n**Charge nurse**: ECG at the door, room now.` },
  ] },
  sepsis: { name: 'Sepsis', sys: 'infect', blurb: 'Infection and a low pressure. Antibiotics within the hour.', steps: [
    { id: 'p0', next: true, title: 'Sepsis', text: `**Sepsis** is the body overreacting to an infection. Pressure drops and organs starve.\nLook for **fever**, a **fast heart**, **fast breathing**, **confusion**.\nAdd very low pressure: **septic shock**.`},
    { id: 'p1', wait: true, title: 'Sepsis alert', text: `An ambulance is bringing [[Rosa]], 71. Fever, confused, BP **74/40**.\nThe **sepsis alert** starts a clock: **antibiotics within the hour**.`,
      setup: () => ({ pt: E.trainPatient('shock', 'alert', { name: 'Rosa M.', age: 71, sex: 'F', unit: 'Medic 3', eta: 4 }) }), done: lRoomed },
    { id: 'p2', title: 'See her now', text: () => `She’s **ESI 1**.\nTap **${lRoom()}**, then **See this patient**.`, ...seeStep('pt') },
    { id: 'p3', wait: true, title: 'In the room', text: `She’s **hot and blotchy**, **breathing fast**, and doesn’t know the day.`, done: lExamined },
    { id: 'p4', next: true, title: 'What she needs', text: `She needs:\n**IV fluids** to lift the pressure.\n**Antibiotics** for the infection.\n**Vasopressor**, a drug that squeezes vessels, if fluids aren’t enough.\n**Oxygen**: hers is low.\n**Labs** to find the germ.` },
    { id: 'p5', title: 'Sepsis orders', text: `Tap **her room**. **Lactate**, **Blood cultures**, **CBC**, **BMP**, **Oxygen**, **Normal saline**, **Piperacillin-tazobactam** and **Vancomycin** (Antibiotics by vein: one broad, one for MRSA), **Norepinephrine** (Resuscitation drugs), **Sign**.\nCultures go before antibiotics, so the germ still grows.`, ...ordStep('pt', [['t', 'lab'], ['r', 'o2'], ['r', 'fluids'], ['r', 'abx'], ['r', 'pressor']]) },
    { id: 'p6', wait: true, title: 'Watch the pressure', text: `Her **pressure climbs** and her oxygen comes up. The **pharmacist** checks the drugs first.`, done: lResulted },
    { id: 'p7', title: 'Admit her', text: `A vasopressor drip needs the **ICU**.\nTap **her room**, **Admit: call a consult**, then **Critical Care**.`, ...callStep('pt', 'consult', 'icu') },
    { id: 'p8', final: true, title: 'Sepsis: the short version', text: `**Looks like**: infection plus fast heart, fast breathing, confusion, or low pressure.\n**Order**: labs, fluids, antibiotics. Oxygen if low. Vasopressor if pressure stays low.\n**Clock**: antibiotics in 60.\n**Charge nurse**: Resus room and a second nurse.` },
  ] },
  bleed: { name: 'Bleeding trauma', sys: 'trauma', blurb: 'Shock. Blood before he arrives. To the OR.', steps: [
    { id: 't0', next: true, title: 'Bleeding inside', text: `After a crash or fall, the hidden danger is **bleeding inside** the belly or chest.\nLook for a **fast heart**, **falling pressure**, **pale, cold skin**. That’s **shock**.`},
    { id: 't1', wait: true, title: 'Trauma alert', text: `A **trauma alert**: [[Devon]], 27, rolled his car. BP **78/40**.\nThe alert calls the **trauma surgeon**.`,
      setup: () => ({ pt: E.trainPatient('mvc', 'alert', { name: 'Devon B.', age: 27, sex: 'M', unit: 'Medic 21', eta: 6 }) }), done: () => !!LP().pren || LP().loc !== 'enroute' },
    { id: 't2', title: 'Blood, before he arrives', text: () => `He needs **blood**. Ask now, before he arrives.\n**MTP**, massive transfusion, sends blood without waiting on tests.\nTap **${FP() ? 'the ambulance with flashing lights' : 'him in the Ambulance bay'}**, then **Activate massive transfusion**.`,
      spot: () => { const p = LP(); return onSheet(p) ? ['#sheet [data-act="mtp"]'] : p.loc === 'enroute' ? [mag(p.id)] : [roomSel(p)]; }, done: () => !!LP().bb, auto: () => E.activateMTP(LP().id) },
    { id: 't3', wait: true, title: 'Inbound', text: `The **blood bank** is packing it. A tech will run it over.`, done: lRoomed },
    { id: 't4', title: 'See him now', text: () => `He’s in **${lRoom()}**.\nTap **his room**, then **See this patient**.`, ...seeStep('pt') },
    { id: 't5', wait: true, title: 'In the room', text: `Belly **hard and tender**, heart racing, **pale and cold**. The surgeon is here.`, done: lExamined },
    { id: 't6', title: 'Trauma orders', text: `A **chest X-ray** and **FAST** (bedside ultrasound) look for blood. **Type and screen** matches his blood. **CBC** counts it.\n**No CT**: he’s too unstable to leave.\nTap **his room**, **Chest X-ray**, **FAST exam**, **CBC**, **Type and screen**, **Sign**.`, ...ordStep('pt', [['t', 'xr'], ['t', 'us'], ['t', 'lab']]) },
    { id: 't7', wait: true, title: 'To the OR', text: `The blood goes in and his pressure comes up.\nUltrasound shows **blood in his belly**. Straight to the **OR**.`, done: lLeft },
    { id: 't8', final: true, title: 'Bleeding trauma: the short version', text: `**Looks like**: injury plus fast heart, falling pressure, pale skin.\n**Order**: MTP first. Then X-ray and labs. **No CT** while pressure is low.\n**Clock**: surgeon at bedside in 15.\n**Charge nurse**: Resus room, second nurse.` },
  ] },
  breath: { name: 'Trouble breathing', sys: 'resp', blurb: 'Wheezing, wet lungs, or infection. Each needs something different.', steps: [
    { id: 'b0', next: true, title: 'Trouble breathing', text: `Three common causes, three different fixes:\n**Wheezing**: tight airways. Asthma or **COPD** (smoker’s lungs).\n**Wet lungs, can’t lie flat**: **heart failure**.\n**Fever and cough**: **pneumonia**.`},
    { id: 'b1', title: 'Short of breath', text: `**Room 5**: [[Earl]], 68, has COPD. Short of breath since last night.\nTap **his room**, then **See this patient**.`,
      setup: () => ({ pt: E.trainPatient('copd', 'room', { room: '5', name: 'Earl J.', age: 68, sex: 'M' }) }), ...seeStep('pt') },
    { id: 'b2', wait: true, title: 'In the room', text: `He’s **wheezing**, leaning forward, talking a few words at a time.`, done: lExamined },
    { id: 'b3', title: 'Read his numbers', text: `Tap **his room** to open his card.`, ...lCard },
    { id: 'b4', next: true, keep: true, title: 'Two numbers', text: () => { const v = E.vitalsOf(LP()); return `**SpO2** (oxygen): **${v.spo2}%**. Normal is 95+.\n**RR** (breaths a minute): **${v.rr}**. Normal is 12–20.\nHe’s **tiring**. That’s what worries me.`; }, spot: () => ['#sheet .ph-cc'] },
    { id: 'b5', keep: true, title: 'Breathing orders', text: `**A nebulizer**: medicine mist to open airways.\n**BiPAP**: a tight mask that helps each breath.\n**Chest X-ray** and **Blood gas** check for pneumonia and CO2.\nA **steroid** calms the airways; an **antibiotic** treats the flare.\nTap **Chest X-ray**, **Blood gas**, **Ipratropium-albuterol neb** (Medications, Breathing), **Methylprednisolone** (Allergy and steroids), **Azithromycin** (Antibiotics by mouth), **BiPAP** (Airway and breathing), **Sign**.`, ...ordStep('pt', [['t', 'xr'], ['t', 'lab'], ['r', 'nebs'], ['r', 'meds'], ['r', 'abx'], ['r', 'bipap']]) },
    { id: 'b6', wait: true, title: 'Watch him settle', text: `**RT** fits the mask. His oxygen rises and his breathing slows.`, done: lResulted },
    { id: 'b7', title: 'Admit him', text: `He needs the mask for hours, so he stays. The **hospitalist** cares for admitted patients.\nTap **his room**, **Admit: call a consult**, then **Hospitalist**.`, ...callStep('pt', 'consult', 'hosp') },
    { id: 'b8', final: true, title: 'Trouble breathing: the short version', text: `**Wheezing**: nebulizer. BiPAP if tiring.\n**Wet lungs**: BiPAP and medications.\n**Fever and cough**: X-ray, labs, oxygen, **Antibiotics** (not Medications).\n**Charge nurse**: ESI 2. Room now.` },
  ] },
  od: { name: 'Overdose', sys: 'tox', blurb: 'Slow breathing, pinpoint pupils. Naloxone wears off first.', steps: [
    { id: 'o0', next: true, title: 'Opioid overdose', text: `**Opioids** (heroin, fentanyl, oxycodone) can **stop breathing**.\nLook for **hard to wake**, **slow breaths**, **pinpoint pupils**.\n**Naloxone** (Narcan) reverses it in minutes.`},
    { id: 'o1', title: 'Found unresponsive', text: `**Room 9**: [[Kevin]], 31, found unresponsive. Paramedics gave **naloxone** and he woke.\nTap **his room**, then **See this patient**.`,
      setup: () => ({ pt: E.trainPatient('od', 'room', { room: '9', name: 'Kevin S.', age: 31, sex: 'M' }) }), ...seeStep('pt') },
    { id: 'o2', wait: true, title: 'In the room', text: () => `He’s drowsy again, breathing **${E.vitalsOf(LP()).rr} times a minute** (normal 12–20).\nThe catch: naloxone **wears off before the opioid does**.`, done: lExamined },
    { id: 'o3', title: 'Overdose orders', text: `More **naloxone**, and a **tox screen** for other drugs.\nTap **his room**, **Tox screen**, **Naloxone** (Medications, Antidotes), **Sign**.`, ...ordStep('pt', [['t', 'lab'], ['r', 'nalox']]) },
    { id: 'o4', wait: true, title: 'Watch him', text: `His breathing picks up. Now we **watch** him until he stays awake on his own.`, done: lResulted },
    { id: 'o5', title: 'Your call', text: `He’s awake, walking, breathing fine.\nTap **his room**, then **Discharge home**.`, ...callStep('pt', 'home') },
    { id: 'o6', final: true, title: 'Overdose: the short version', text: `**Looks like**: hard to wake, slow breathing, pinpoint pupils.\n**Order**: naloxone, labs. Oxygen if low.\n**Watch**: naloxone wears off first.\n**Charge nurse**: ESI 2, a room his nurse can see.` },
  ] },
  belly: { name: 'Belly pain', sys: 'gi', blurb: 'Where it hurts picks the test: ultrasound, CT, or neither.', steps: [
    { id: 'y0', next: true, title: 'Belly pain', text: `Where it hurts points to the organ. The organ picks the test.\n**Upper right, after meals**: **gallbladder**. **Ultrasound**.\n**Lower right**: **appendix**. **CT**.\n**Flank, can’t sit still**: **kidney stone**. **CT**.\n**Soft belly, vomiting**: stomach bug. **Labs**, no scan.` },
    { id: 'y1', title: 'Pain after meals', text: `**Room 5**: [[Maria]], 44. Pain under her right ribs since dinner.\nTap **her room**, then **See this patient**.`,
      setup: () => ({ pt: E.trainPatient('chole', 'room', { room: '5', name: 'Maria G.', age: 44, sex: 'F' }) }), ...seeStep('pt') },
    { id: 'y2', wait: true, title: 'In the room', text: `Tender **under the right ribs**. Her breath catches when you press. That’s the **gallbladder**.`, done: lExamined },
    { id: 'y3', title: 'Gallbladder orders', text: `**Ultrasound** first for the gallbladder, **not CT**. Add **CBC**, **liver tests**, **lipase**, and a **pregnancy test**: she’s 44, so she could be pregnant.\nTap **her room**, those four, the **ultrasound**, **Morphine** for pain (Medications, Pain), **Sign**.`, ...ordStep('pt', [['t', 'lab'], ['t', 'us'], ['r', 'meds']]) },
    { id: 'y4', wait: true, title: 'Results', text: `Ultrasound: **gallstones, thick wall**. White count up.\nAn inflamed gallbladder: **cholecystitis**.`, done: lResulted },
    { id: 'y5', title: 'Call surgery', text: `It has to come out.\nTap **her room**, **Admit: call a consult**, then **General Surgery**.`, ...callStep('pt', 'consult', 'surg') },
    { id: 'y6', final: true, title: 'Belly pain: the short version', text: `**Upper right**: labs, **ultrasound**, Surgery.\n**Lower right**: labs, **CT**, Surgery.\n**Flank**: labs, **CT**, usually home.\n**Soft belly, vomiting**: labs, fluids. **No CT.**\n**Charge nurse**: mostly ESI 3. A rigid belly doesn’t wait.` },
  ] },
  falls: { name: 'Falls', sys: 'trauma', blurb: 'The hip, the head, and the blood thinner.', steps: [
    { id: 'f0', next: true, title: 'Falls', text: `A fall in an older adult hides three things:\n**The hip**: a **short, turned-out leg** is broken until proven otherwise. **X-ray**.\n**The head**: on a **blood thinner**, a small bump can bleed. **CT**.\n**The reason**: a faint needs an **ECG**.` },
    { id: 'f1', title: 'Fell, hip pain', text: `**Room 9**: [[Dorothy]], 81. Fell in her kitchen, couldn’t get up.\nTap **her room**, then **See this patient**.`,
      setup: () => ({ pt: E.trainPatient('hipfx', 'room', { room: '9', name: 'Dorothy K.', age: 81, sex: 'F' }) }), ...seeStep('pt') },
    { id: 'f2', wait: true, title: 'In the room', text: `Her leg is **short and turned out**. She can’t lift it. She tripped on a rug and didn’t hit her head.`, done: lExamined },
    { id: 'f3', title: 'Hip orders', text: `**Hip X-ray** for the break. **CBC**, **BMP**, **type and screen** for surgery. **Fentanyl** for pain.\nTap **her room**, **Hip X-ray**, those three, **Fentanyl** (Medications, Pain), **Sign**.`, ...ordStep('pt', [['t', 'xr'], ['t', 'lab'], ['r', 'meds']]) },
    { id: 'f4', wait: true, title: 'Results', text: `X-ray: a **femoral neck fracture**, the top of the thigh bone. A **broken hip**.`, done: lResulted },
    { id: 'f5', title: 'Call Orthopedics', text: `**Orthopedics** fixes it in the OR.\nTap **her room**, **Admit: call a consult**, then **Orthopedics**.`, ...callStep('pt', 'consult', 'ortho') },
    { id: 'f6', final: true, title: 'Falls: the short version', text: `**Short, turned-out leg**: X-ray, labs, pain control. **Orthopedics**.\n**Head bump on a thinner**: **CT**, labs. **Neurosurgery**.\n**Twisted ankle**: X-ray. No break: home.\n**Charge nurse**: hip is ESI 3. Head on a thinner **doesn’t wait**.` },
  ] },
};
// v0.29: a short card lesson for each high-yield condition, built from the case itself.
(function caseLessons() {
  const names = ks => ks.map(k => (E.LABS[k] || E.IMGS[k] || {}).n || k);
  const and = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  for (const [k, L] of Object.entries(E.LESSON_CASE)) {
    const c = E.CASES.find(x => x.k === k), N = E.NEED[k] || { n: [] }, RX = E.RXOK[k] || {};
    const REQ = E.RXREQ[k] || {};
    const drugs = c.tr.flatMap(t => REQ[t] ? REQ[t].map(g => and(g.map(d => E.DRUGS[d].n)).replace(/ and /g, ' or ')) : RX[t] ? [E.DRUGS[RX[t][0]].n] : []);
    const acts = c.tr.filter(t => !RX[t] && !REQ[t]).map(t => (E.PROC[t] ? E.PROC[t].n : E.TREAT[t].label));
    const give = and(drugs.map(x => `**${x}**`));
    const contra = [...new Set(E.contraOf({ ck: k }))].slice(0, 5).map(d => E.DRUGS[d].n);
    const where = c.dispo === 'transfer' ? `transfer to ${c.txTo}` : E.DISPO_NAME[c.dispo];
    LESSONS['c_' + k] = { name: L.name, sys: L.sys, blurb: c.cc + '.', steps: [
      { id: k + '1', next: true, title: 'Who comes in', text: `The story: **${c.cc.toLowerCase()}**.\nThe exam: ${E.EXAM[k]}${c.vit ? `\nVitals: ${c.vit}.` : ''}` },
      { id: k + '2', next: true, title: 'Think of it', text: L.pearl },
      { id: k + '3', next: true, title: 'The workup', text: `Order ${and((c.wk.includes('ecg') ? ['an ECG'] : []).concat(names(N.n)).map(x => `**${x}**`)) || '**nothing first**: the **exam** decides'}.\n${E.ORD_WHY[k]}` },
      { id: k + '4', next: true, title: 'Treat and decide', text: `${give ? `Give ${give}.` : ''}${acts.length ? ` Start: ${and(acts.map(x => `**${x}**`))}.` : ''}${c.con ? ` Call **${E.SPECS[c.con].name}**.` : ''} Then **${where}**.${contra.length ? `\nDon’t give: ${contra.join(', ')}.` : ''}` },
      { id: k + '5', final: true, title: `${L.name}: the short version`, text: `${L.pitfall}\nOn a shift, you’ll name it from the **exam and results**.` },
    ] };
  }
})();
const LESSON_KEYS = Object.keys(LESSONS);
/* Orientation comes in chapters. Each starts with its own patient, so a player can stop after one and come back to the next. */
const CHAPTERS = { rn: [['hi', 'The basics'], ['w1', 'Ambulances and admissions'], ['t1', 'Alerts and the Box'], ['h1', 'A full department']], md: [['hi', 'The basics'], ['a1', 'Sicker patients'], ['r1', 'The radio and a stroke']] };
const chMode = () => (g() && g().mode === 'md' ? 'md' : 'rn');
const chKey = (mode, k) => `oc-ch-${mode}-${k}`;
function chList(mode) { const L = mode === 'md' ? STEPS_MD : STEPS; return CHAPTERS[mode].map(([id, name], k, a) => { const at = L.findIndex(s => s.id === id), end = k + 1 < a.length ? L.findIndex(s => s.id === a[k + 1][0]) : L.length; return { k, name, at, n: end - at }; }); }
function chOf(i) { if (lessonKey()) return null; const C = chList(chMode()); let c = C[0]; for (const x of C) if (i >= x.at) c = x; return Object.assign({ count: C.length }, c); }
const chDone = (mode, k) => !!store(chKey(mode, k)) || !!store(mode === 'md' ? 'oc-trained-md' : 'oc-trained');
function chaptersHTML() {
  const mode = U.mode === 'md' ? 'md' : 'rn', C = chList(mode);
  return head('Orientation', 'Four short chapters. Do the first, play a Quiet Tuesday, then come back for the rest.'.replace('Four', C.length === 3 ? 'Three' : 'Four'))
    + `<div class="cgrid lsn">${C.map(c => `<button type="button" class="cbtn" data-act="chapter" data-arg="${c.k}"><b>${c.k + 1}. ${esc(c.name)}${chDone(mode, c.k) ? ' <i class="lsn-ok">✓</i>' : ''}</b><small>${c.n} steps</small></button>`).join('')}</div>`;
}
const lessonKey = () => { const t = g() && g().tr; return t && t.lesson && LESSONS[t.lesson] ? t.lesson : null; };
const lessonDone = k => !!store('oc-lesson-' + k);
const GAME_V = '/*GAMEV*/';   // the build puts the version here: a code gives the same shift only on the same version
// v0.29.1: codes carry the version. PAST_V holds only the version just before this one ('' is v0.29.0 and earlier, before codes
// carried one): each entry is another 1-in-64 chance that a mistyped code reads as stale, so each release replaces it, never appends.
// The check is 6 bits, so about 1 code in 64 from another version still reads as current: refused almost always, not always.
const PAST_V = ['0.32.0'];   // v0.33.0 replaces v0.32.0 on the live site
E.setCodeVersion(GAME_V, PAST_V);
const staleWhy = () => `That code looks mistyped, or it was made on another version of the game (this is v${GAME_V}). Check each letter. If it’s right, ask your instructor for a new code.`;
/* Class codes: an instructor makes one, students enter it, and everyone plays the same shift (same arrivals and events). */
const codeDesc = c => `${c.mode === 'md' ? 'Attending' : 'Charge nurse'} · ${E.LEVELS[c.level].name}${c.scen !== 'none' ? ' · ' + E.SCENS[c.scen].name + ' scenario' : ''}${c.mode === 'md' ? ' · ' + E.PACKS[c.pack].name + ' radio calls' : ''}`;
function classHTML() {
  const typed = (c => (c && !c.stale ? c : null))(E.readCode(U.codeIn || '')), made = U.codeMade ? E.readCode(U.codeMade) : null, R = U.reg, saving = !!(R && R.st === 'saving');
  const lv = ['rush', 'easy', 'med', 'hard'].map(k => `<button type="button" class="cbtn" data-act="codeMake" data-arg="${k}"${saving ? ' disabled' : ''}><b>${esc(E.LEVELS[k].name)}</b></button>`).join('');
  const fail = R && !made && (R.st === 'none' || R.st === 'fail') ? `<div class="cc-made"><div class="cb-key bad" role="alert"><b>${R.st === 'none' ? 'No class code was made.' : 'No class code yet.'}</b><small>${esc(R.why)}${R.st === 'fail' ? ' A code is shown only once its class results are set up, so it never changes in front of a class.' : ''}</small>`
    + (R.st === 'fail' && !R.hard ? `<div class="cc-row"><button type="button" class="big" data-act="codeReg">Try again</button>${R.net || R.full ? '<button type="button" class="big" data-act="codeNoRes">Use it without results</button>' : ''}</div>` : '') + '</div></div>' : '';
  const ask = U.codeAsk && made ? `<div class="cb-ask" id="codeAsk" role="alert"><span>Make a new code for ${esc(E.LEVELS[U.codeAsk].name)}? ${esc(made.code)} goes off the screen${cbKeys()[made.code] ? ' (it stays in your saved codes below)' : ''}.</span><button type="button" class="big act" data-act="codeAskNo">Keep ${esc(made.code)}</button><button type="button" class="big" data-act="codeMakeGo" data-arg="${esc(U.codeAsk)}">New code</button></div>` : '';
  return head('Class code', `<small class="t-warn">A teaching game, not clinical guidance. No licensed clinician has reviewed it yet.</small>Everyone who enters the same code plays the same shift: the same patients and events, at the same times, on the same game version (this is v${GAME_V}). The attending’s radio calls can differ between players. What each player does with the shift is theirs.`)
    + `<div class="cc-box"><label for="ccIn"><b>Play a code</b></label><div class="cc-row"><input id="ccIn" class="cc-in" data-pick="code" type="text" inputmode="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="20" placeholder="ABC-DEF" value="${esc(U.codeIn || '')}" aria-describedby="ccWhat"><button type="button" class="big act" data-act="codePlay" ${typed ? '' : 'disabled'}>Start</button></div><small id="ccWhat" class="cc-what">${esc(codeHint(U.codeIn || ''))}</small></div>`
    + `<div class="cc-box"><b>Make one (instructors)</b><small>It uses the role${U.mode === 'md' ? ', radio calls' : ''} and scenario set on the menu (now: ${esc(codeDesc({ mode: U.mode, level: 'med', scen: U.scen, pack: U.pack }).replace(/ · Manic Monday/, ''))}). Pick the shift:</small><div class="cgrid cc-lv">${lv}</div>`
    + (!made && saving ? '<div class="cc-made"><small role="status">Making a class code…</small></div>' : '')
    + fail
    + (made && R && R.st === 'lost' && R.code === made.code ? `<div class="cc-made"><div class="cc-code lost">${esc(made.code)}</div>${cbRegHTML(made.code)}</div>`   // another class has it: not shareable (audit R3.7-04)
      : made ? `<div class="cc-made"><div class="cc-code">${esc(made.code)}</div><small>${esc(codeDesc(made))}</small><div class="cc-row"><button type="button" class="big" data-act="codeCopy">Copy</button>${navigator.share ? '<button type="button" class="big" data-act="codeShare">Share</button>' : ''}<button type="button" class="big act" data-act="codePlay" data-arg="${esc(made.code)}">Play it</button></div><small>Students: Play a shift, then Class code. Each summary shows the code, the real time played and the speed used, and has a Send button that sends you the result.</small>${cbRegHTML(made.code)}</div>` : '')
    + ask   // under the code, so the projected code doesn't move when a stray tap asks (audit R5.8-09)
    + '</div>'
    + cbListHTML();
}
/* ---------- class results (v0.21, private since v0.31): a student sends a class-code shift's result to the instructor who made the code ----------
   Supabase (the project shared with Case Room; src/backend.json, put here by build.js). The key is the publishable one, public by
   design: it can only call the cb_ functions in supabase/migrations/. The results sit in a schema the API doesn't expose. Making a
   code registers it with an instructor key this device makes; only that key reads or deletes the code's results. A code and its
   results are deleted when the class ends: 30 days after the code was made, or 14 if nobody sends a result (a student's first result in
   the 30-day hold that follows starts it again). An ended code is held 30 days for its key. supabase/tests/client_call.json is the contract:
   the calls, the errors each can give, and the names both sides accept. */
const CB = '/*BACKEND*/', CB_WAIT = 8000, CB_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', CB_LIFE = 30 * 864e5, CB_KEEP = 74 * 864e5;   // a class's longest life; how long the device keeps its key (the life plus the server's 30-day hold)
// Every call gives up after 8 seconds, so no screen says "Sending…" forever. A failure says which kind it was (for the message).
function cbFetch(path, body) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null; let timer = 0;
  const fail = (kind, status) => Object.assign(new Error(kind + (status ? ' ' + status : '')), { kind, status: status || 0 });
  const late = new Promise((ok, no) => { timer = setTimeout(() => { if (ctl) ctl.abort(); no(fail('timeout')); }, CB_WAIT); });
  const go = fetch(CB.url + path, { method: 'POST', headers: { apikey: CB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(r => r, () => { throw fail('network'); })
    .then(r => { if (!r.ok) throw fail('http', r.status); return r.status === 204 ? null : r.text().then(t => { try { return t ? JSON.parse(t) : null; } catch (e) { throw fail('bad'); } }); });
  return Promise.race([go, late]).then(v => { clearTimeout(timer); return v; }, e => { clearTimeout(timer); throw e; });
}
const cbRpc = (fn, args) => cbFetch('/rest/v1/rpc/' + fn, args).then(r => (r && typeof r === 'object' && !Array.isArray(r) ? r : {}));
const cbNet = e => (e && e.kind === 'timeout' ? 'The server didn’t answer in time. Try again.'
  : e && e.kind === 'network' ? 'Couldn’t reach the server. Check the connection and try again.'
  : e && e.kind === 'http' && e.status === 404 ? 'Class results aren’t available right now: the server isn’t set up for this version of the game yet. Try again later.'
  : 'The server had a problem. Try again in a minute.');
const CB_BUSY = 'Your network has made too many requests to class results for now. Try again in an hour (or tomorrow, if it has hit its daily limit).';
const CB_FULL = 'Class results are full across the whole game right now, not just for you. It may take days to clear.';
// A first name or initials, as codeblack.clean_name (supabase/migrations/20261125120000_codeblack_round6.sql): up to three words, each a
// letter, then letters with their marks (any script), periods, hyphens, apostrophes and middle dots; 20 characters. A zero-width
// non-joiner or joiner may follow a letter or mark of the scripts that use them (U+0600 to U+0DFF: Persian, Urdu, Sinhala), before a letter. Refused: any number, invisible characters, enclosing marks,
// full-width forms, circled, squared and math letters. The server's Unicode version may be older than the browser's: a letter added
// since passes here and is refused there (the game says so). The contract file's name lists are checked against both.
const CB_BADCH = /[\p{N}\p{Me}\p{Default_Ignorable_Code_Point}\uFF01-\uFF5E\u2460-\u24FF\u{1F100}-\u{1F1FF}\u{1D400}-\u{1D7FF}]/u;
const CB_NAME = /^\p{L}[\p{L}\p{M}.'\u00B7\u2027\u30FB\u05BE\u05F3\u05F4\u0F0B-]*( \p{L}[\p{L}\p{M}.'\u00B7\u2027\u30FB\u05BE\u05F3\u05F4\u0F0B-]*){0,2}$/u;
const cbClean = v => {
  const n = String(v || '').normalize('NFC').replace(/’/g, "'").trim().replace(/\s+/g, ' '), len = [...n].length;
  const t = n.replace(/([\u0600-\u0DFF])[\u200C\u200D](?=\p{L})/gu, '$1').replace(/([\u0980-\u09FF])\u200D(?=\u09CD)/gu, '$1').replace(/([\u0D00-\u0D7F])\u200D(?= |$)/gu, '$1');   // and a Bengali joiner before the virama (R5.8-07)   // a joiner after a letter or mark of a script that uses one (Arabic to Sinhala), before a letter; or ending a Malayalam word (a chillu)
  return len >= 1 && len <= 20 && CB_NAME.test(t) && !CB_BADCH.test(t) ? n : null;
};
const cbNameWhy = v => { const n = String(v || '').trim(), c = cbClean(n); return !n ? 'Type your first name or initials.' : c && cbRude(c) ? 'Please use your first name or initials.' : c && !cbOneName(c) ? 'Your first name only, or with an initial, like Ana M. or S.K. No last names.' : [...n.normalize('NFC')].length > 20 ? 'At most 20 characters: try your first name or initials.'
  : /\p{Default_Ignorable_Code_Point}/u.test(n) ? 'Your keyboard added a hidden character: type the name again, or use your initials.'
  : /\p{N}/u.test(n) ? 'No numbers: use your first name or initials, like Sam, Ana M. or S.K.' : n.split(/\s+/).length > 3 ? 'At most three words, like Mary Ann K.' : 'Use your first name or initials: letters only, like Sam, Ana M. or S.K.'; };
// The owner's decisions (Nov 26, 2026; QA-2, QA-19): on top of the server's rule, the game sends only one first name, initials, or a first
// name plus initials ("Ana", "S.K.", "Ana M."), never two full words (a full name), and refuses common profanity. Game only: the server's
// rule (cbClean above, matched to the contract file) is unchanged.
const cbInitial = w => /^(\p{L}\.?)+$/u.test(w) && [...w.replace(/\./g, '')].length <= 3 && (w.includes('.') || [...w].length <= 2);
const cbOneName = n => n.split(' ').filter(w => !cbInitial(w)).length <= 1;
const CB_RUDE = /(fuck|shit|cunt|bitch|whore|slut|nigg|fag|asshole|wank|bollock|twat|piss)/, CB_RUDE_W = /^(ass|arse|dick|cock|cum|tits?|prick|bastard|crap|damn|hell|sex|porn|nazi|poop|butt|penis|vagina|boob)$/;
const cbRude = n => { const t = n.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); return CB_RUDE.test(t.replace(/[^a-z]/g, '')) || t.split(/[^a-z]+/).some(w => CB_RUDE_W.test(w)); };
const cbSendable = v => { const n = cbClean(v); return n && cbOneName(n) && !cbRude(n) ? n : null; };
const cbAlpha = v => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const cbCodeNorm = v => { const t = cbAlpha(v); return /^[0-9A-HJKMNP-TV-Z]{6}$/.test(t) ? t.slice(0, 3) + '-' + t.slice(3) : null; };   // any well-formed code, whatever its version
const cbKeyNorm = v => { const t = cbAlpha(v); return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(t) ? t : null; };
const cbKeyShow = k => String(k || '').replace(/(.{4})(?=.)/g, '$1-');
const cbNewKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => CB_ABC[x & 31]).join('');   // 16 × 5 bits = 80 bits
function cbUuid() {   // the result's own id: sent with it, so a result sent twice is kept once; the instructor deletes by it
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* not a secure context */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const CB_DF = [];   // two date formats, made once (a list of 500 results formats 500 dates)
const cbDate = (at, time) => { const d = new Date(at); if (isNaN(d)) return ''; const f = CB_DF.length ? CB_DF : CB_DF.push(new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }), new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })) && CB_DF; return f[0].format(d) + (time ? ' ' + f[1].format(d) : ''); };
function storeOk(k, v) { try { localStorage.setItem(k, v); return localStorage.getItem(k) === v; } catch (e) { return false; } }
// Instructor keys kept on this device: oc-ckeys = { v: 1, c: { code: { k: key, t: when the server made the class (ms), p: 1 while
// registration is unconfirmed, s: 1 once the code was shown, e: when the server last said the class ends (ms), x: 1 once the server
// said the class has ended, g: 1 once the server said another class has its code } } }. A key is kept 74 days after its class was made: a first result up to day 44 can start an unused class again for 30
// days (audit drift check); the server holds an ended class's code 30 days for this key (so Turn results back on still works, and the instructor sees that the class ended).
function cbKeys() {
  let o = null; try { o = JSON.parse(store('oc-ckeys') || 'null'); } catch (e) { o = null; }
  const c = o && typeof o === 'object' && o.v === 1 && o.c && typeof o.c === 'object' ? o.c : {}, out = {};
  for (const code of Object.keys(c)) { const x = c[code]; if (x && typeof x === 'object' && cbCodeNorm(code) === code && cbKeyNorm(x.k) === x.k && +x.t > 0 && +x.t + CB_KEEP > Date.now()) out[code] = { k: x.k, t: +x.t, p: x.p ? 1 : 0, s: x.s || !x.p ? 1 : 0, e: +x.e > 0 ? +x.e : 0, x: x.x ? 1 : 0, g: x.g ? 1 : 0 }; }
  return out;
}
function cbKeySave(code, v) { const c = cbKeys(); if (v) c[code] = v; else delete c[code]; return storeOk('oc-ckeys', JSON.stringify({ v: 1, c })) && (!v || !!cbKeys()[code]); }
const cbKeyOf = code => (U.reg && U.reg.code === code && U.reg.key) || (cbKeys()[code] || {}).k || (U.cbList && U.cbList.code === code ? U.cbList.key : null);
const cbScroll = (sel, block) => setTimeout(() => { const el = $(sel || '#sheet .cc-made'); if (el && el.scrollIntoView) el.scrollIntoView({ block: block || 'nearest' }); }, 60);
// Registering is safe to repeat: the key is made here, so a retry after a lost answer is the same request. The key is saved before the
// call (marked unconfirmed), so it isn't lost if the answer is. A new code shows once the server has answered, so it never changes
// after the class has seen it; a code another class has is swapped for another before it shows, and never shown.
function cbDraw(c) {   // a new code for this setup, never one this device already holds a key for (audit R3.6-11)
  const keys = cbKeys(); let code = null;
  for (let i = 0; i < 12 && (!code || keys[code]); i++) code = E.classCode({ mode: c.mode, level: c.level, scen: c.scen, pack: c.pack, seed: (Math.random() * 131072) | 0 });
  return code;
}
function cbRegister(code, key, tries) {
  const seq = U.regSeq = (U.regSeq || 0) + 1, shown = U.codeMade === code, old = cbKeys()[code], t = (old && old.t) || Date.now();
  U.reg = { code, key, st: 'saving' };
  cbKeySave(code, { k: key, t, p: 1, s: shown ? 1 : 0 });
  const why = e => (e === 'busy' ? CB_BUSY + ' Or turn off Wi-Fi and tap Try again on mobile data (another network): same code, same key.' : e === 'full' ? CB_FULL : e === 'invalid' ? 'The server turned this code down. Tap a shift to make another.' : 'The server didn’t say why.');
  cbRpc('cb_class_new', { p_code: code, p_key: key, p_ver: GAME_V }).then(r => {
    if (seq !== U.regSeq) return;   // forgotten, or another code made, since
    if (r.ok) { U.reg = { code, key, st: 'ok', exp: r.expires, made: Date.parse(r.created) || t, saved: cbKeySave(code, { k: key, t: Date.parse(r.created) || t, e: Date.parse(r.expires) || 0, s: 1 }) }; U.codeMade = code; if (U.regRows) delete U.regRows[code]; }   // the row's old refusal goes, and its late answer is dropped (audit R1.9-03)
    else if (r.error === 'taken') {
      cbKeySave(code, null);
      if (!shown && tries < 4) { cbRegister(cbDraw(E.readCode(code)), key, tries + 1); return; }
      U.reg = shown ? { code, key, st: 'lost' } : { code: null, st: 'none', why: 'Every code tried was taken. Try again in a minute.' };
    } else {
      if (r.error === 'invalid') cbKeySave(code, null);
      U.reg = { code, key, st: shown ? 'off' : 'fail', why: why(r.error), hard: r.error === 'invalid', full: r.error === 'full' };   // a code the server didn't accept is never shown (audit R3.6-06)
    }
    render(); cbScroll();
  }).catch(e => {
    if (seq !== U.regSeq) return;
    // only a network that can't reach the server offers "Use it without results": an error status from the platform in front of it (a 429
    // or 503) is the kind of answer someone else can cause, like busy (audit R3.9-02)
    // a 5xx is the service down, which a classmate can't cause: the fallback is offered then too, so a class still gets its code (R4.10-05)
    const net = !!e && (e.kind === 'network' || e.kind === 'timeout' || (e.kind === 'http' && e.status >= 500)), busy = !!e && e.kind === 'http' && e.status === 429;
    U.reg = { code, key, st: shown ? 'off' : 'fail', net, why: busy ? why('busy') : cbNet(e) }; render(); cbScroll();
  });
}
function cbRegHTML(code) {
  const R = U.reg && U.reg.code === code ? U.reg : null;
  if (!R) return '';
  if (R.st === 'saving') return '<div class="cb-key"><small role="status">Setting up class results…</small></div>';
  if (R.st === 'lost') return `<div class="cb-key bad" role="alert"><b>${esc(code)} can’t get class results.</b><small>Another class has that code on the server, so a result sent to it would go to that class. <b>Tell students not to tap Send.</b> Make a new code for class results.</small></div>`;
  if (R.st === 'off') return `<div class="cb-key bad" role="alert"><b>Class results are off for this code.</b><small>${esc(R.why || '')} Students can play it. <b>Tell them not to tap Send</b> until results are set up: until then, whoever registers this code first gets what students send. Try again sets results up for this same code.</small>${R.hard ? '' : '<div class="cc-row"><button type="button" class="big" data-act="codeReg">Try again</button></div>'}</div>`;
  const show = U.showKey === code, made = R.made || Date.now();
  return `<div class="cb-key"><b>Class results are on.</b><small>Students’ results come to you (and the game’s developer, who runs the database, can see them). Your <b>instructor key</b> opens them: keep it private, like a password, and don’t show it to the class. ${R.saved ? 'It’s saved on this device' : '<b>This device can’t save it</b>'}; copy it somewhere safe too. A lost key can’t be recovered. Results are deleted on ${esc(cbDate(made + CB_LIFE))} once a student sends one. If none has by ${esc(cbDate(Date.parse(R.exp) || made + 14 * 864e5))}, the class ends, but a student’s first result before ${esc(cbDate((Date.parse(R.exp) || made + 14 * 864e5) + 30 * 864e5))} starts it again for 30 days: a code made ahead of a class still works then, on this version of the game (v${esc(GAME_V)}; a game update needs a new code). Once a class ends, its code is held 30 days with only its key’s hash, so another class can’t simply take it over.</small>`
    + (show ? `<div class="cb-key-v">${esc(cbKeyShow(R.key))}</div>` : '')
    + `<div class="cc-row"><button type="button" class="big" data-act="keyShow" data-arg="${esc(code)}" aria-expanded="${show}">${show ? 'Hide key' : 'Show key'}</button><button type="button" class="big" data-act="keyCopy" data-arg="${esc(code)}">Copy key</button></div><small class="cb-warn"><b>Not for grading:</b> scores are self-reported, and no licensed clinician has reviewed the game. Class results, below, says more.</small></div>`;
}
// What a result says, for the instructor's list and the export. Every field is forced to a number or shown as text, whatever came back.
const cbNum = v => (Number.isFinite(+v) ? Math.round(+v) : null);
function cbRow(r) {
  const s = (r.stats && typeof r.stats === 'object') ? r.stats : {}, f = cbNum(s.fast);
  return { id: typeof r.id === 'string' && /^[0-9a-f-]{36}$/i.test(r.id) ? r.id : null, name: String(r.name == null ? '' : r.name), md: r.role === 'md', score: cbNum(r.score), stars: Math.max(0, Math.min(3, cbNum(r.stars) || 0)),
    min: Math.round((cbNum(r.real_sec) || 0) / 60), fast: f == null ? null : Math.max(0, Math.min(100, f)), wait: cbNum(s.wait), lwbs: cbNum(s.lwbs), died: cbNum(s.expired), arr: cbNum(s.seen), ama: cbNum(s.ama), bedFirst: cbNum(s.bedFirst),
    fired: cbNum(s.fired) === 1, walkout: cbNum(s.walkout) === 1, end: cbNum(s.endMin),
    seen: cbNum(s.mdSeen), mdDied: cbNum(s.mdDied), codeLost: cbNum(s.mdCodeLost), arrOpen: cbNum(s.mdArrestOpen), dxR: cbNum(s.dxRight), dxW: cbNum(s.dxWrong), harm: cbNum(s.harm), contra: cbNum(s.contra), unneeded: cbNum(s.unneeded), rR: cbNum(s.radioRight), rW: cbNum(s.radioWrong), rM: cbNum(s.radioMiss),
    ver: typeof r.ver === 'string' ? r.ver : '', at: typeof r.created_at === 'string' ? r.created_at : '' };
}
// The list is in the order results arrived, not ranked: for an attending the score mostly measures the department the computer runs.
// Worked out once per answer, not every frame (a class can hold 500 results).
function cbRows(L) {
  if (L._of === L.rows) return L._rows;
  const rows = L.rows.map(cbRow).sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0)), nm = r => r.name.replace(/[\u200C\u200D]/g, '').normalize('NFKC').toLowerCase(), tot = {}, seen = {};
  for (const r of rows) tot[nm(r)] = (tot[nm(r)] || 0) + 1;
  for (const r of rows) { const k = nm(r); seen[k] = (seen[k] || 0) + 1; r.nth = seen[k]; r.of = tot[k]; r.det = cbDet(r); r.when = cbDate(r.at, true); }
  L._of = L.rows; L._rows = rows; return rows;
}
const CB_NOTE = 'Not for grading: scores are self-reported, anyone with the code can send a result under any name (a repeated name may be a retry or another student), and it is a teaching game, not clinical guidance: no licensed clinician has reviewed its clinical content.';
const CB_MDNOTE = 'Attending: the score and stars mostly reflect the department the computer runs. The attending’s own work is the patients they saw (and how many of them died), their diagnoses, unsafe orders and radio calls. Radio calls differ between players, and complications are partly chance. Many patients who arrest die even after a well-run code (the list says which deaths came after a code run by the book: every rhythm check right, the code started within 5 minutes).';
const cbClock = m => { const t = 7 * 60 + (m || 0); return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
function cbDet(r) {   // the second line of a result: the student's own numbers first
  const q = v => (v == null ? '?' : v), parts = [`${r.min} min played${r.fast ? ` (${r.fast}% sped up)` : ''}`];
  if (r.md) {
    const calls = (r.rR || 0) + (r.rW || 0) + (r.rM || 0);
    parts.push(`saw ${q(r.seen)} patient${r.seen === 1 ? '' : 's'}${r.mdDied ? ` (${r.mdDied} of them died${r.codeLost ? `, ${r.codeLost === r.mdDied ? '' : r.codeLost + ' '}after a code run by the book` : ''})` : ''}${r.arrOpen ? `, ${r.arrOpen} left in cardiac arrest 5+ min with no code running at the end` : ''}`, `diagnoses ${q(r.dxR)} right, ${q(r.dxW)} wrong`,
      r.contra == null && r.unneeded == null ? `harm from orders ${q(r.harm)}` : `unsafe orders ${(r.contra || 0) + (r.unneeded || 0)}${r.harm != null && r.harm - (r.contra || 0) > 0 ? ` (complications, partly chance: ${r.harm - (r.contra || 0)})` : ''}`,
      `radio calls ${q(r.rR)} of ${calls} right${r.rW ? `, ${r.rW} wrong` : ''}${r.rM ? `, ${r.rM} missed` : ''}`,
      `department: mean door-to-provider wait ${q(r.wait)} min (all arrivals), ${q(r.lwbs)} left without being seen, ${q(r.died)} died`);
  } else parts.push(`${q(r.arr)} arrivals`, `mean door-to-provider wait ${q(r.wait)} min (all arrivals)`, `${q(r.lwbs)} left without being seen`, `${q(r.ama)} left against advice`, `${q(r.bedFirst)} bedded before registration`, `${q(r.died)} died`);
  const end = r.fired ? 'fired (legal risk)' : r.walkout ? 'staff walked out, shift ended early' : '';
  return esc(parts.join(' · ')) + (end ? ` · <b>${end}</b>${r.end != null ? esc(` at ${cbClock(r.end)} (these numbers cover only the part played)`) : ''}` : '');
}
function cbListHTML() {
  const keys = cbKeys(), mine = Object.keys(keys).filter(c => keys[c].s || !keys[c].p).sort((a, b) => keys[b].t - keys[a].t), L = U.cbList, F = U.cbForm || {}, RR = U.regRows || {};
  let h = `<div class="cc-box cb-res"><b>Class results (instructors)</b><small>What students send for a code is seen in the game only by the instructor who made it, with the code’s instructor key (and by the game’s developer, who runs the database).</small>`;
  if (mine.length) h += `<ul class="cb-codes">${mine.map(c => {
    const r = E.readCode(c), K = keys[c], old = !r || r.stale, show = U.showKey === c && U.codeMade !== c, ask = U.cbForget === c, open = L && L.code === c, row = RR[c] || null;
    // What the device last heard (audit R1.9-06, R3.9-05, R4.9-05, R5.9-01, R5.9-04). A class that had a result ends for good at e, 30 days
    // after it was made, and its code is held 30 more days. One that had none by e (14 days) is held 30 days too, and a student's first result
    // in that time starts it again, so only the server knows: Results asks it. Past the hold the code is released.
    const now = Date.now(), used = K.e && K.e - K.t >= 20 * 864e5, gone = K.e && now >= K.e + 30 * 864e5, ended = K.x || (used && K.e <= now);
    const when = old ? '' : K.p ? '<b>results not set up yet</b>'
      : ended ? `<b>class ended</b>${K.e && used ? `: results deleted ${esc(cbDate(K.e))}` : ''}${gone ? `; code released ${esc(cbDate(K.e + 30 * 864e5))}` : ''}`
      : K.e && K.e <= now ? `<b>ended ${esc(cbDate(K.e))} with no results</b>, unless a student has sent one since${gone ? ` (the code was released ${esc(cbDate(K.e + 30 * 864e5))} if not)` : ` (a first result before ${esc(cbDate(K.e + 30 * 864e5))} starts it again)`}: Results checks`
      : K.e ? `results until ${esc(cbDate(K.e))}${used ? '' : ` (${esc(cbDate(K.t + CB_LIFE))} once a student sends)`}` : '';
    const main = ended || K.p ? (old || K.g || (row && row.taken) ? '' : `<button type="button" class="big act" data-act="codeRegSaved" data-arg="${esc(c)}"${row && row.st === 'saving' ? ' disabled' : ''}>${K.p ? 'Set up results' : 'Turn results back on'}</button>`)
      : `<button type="button" class="big act" data-act="cbShow" data-arg="${esc(c)}">Results</button>`
        + (K.e && K.e <= now && !old && !K.g && !(row && row.taken) ? `<button type="button" class="big" data-act="codeRegSaved" data-arg="${esc(c)}"${row && row.st === 'saving' ? ' disabled' : ''}>Turn results back on</button>` : '');   // an unused class past its end: check, or start it again yourself (audit R5.10-01)
    return `<li class="${open ? 'open' : ''}"${open ? ' aria-current="true"' : ''}><div><b>${esc(c)}</b> <small>${r && !r.stale ? esc(codeDesc(r)) : r ? `v${esc(r.stale)} · ${esc(codeDesc(r))}` : 'an older version of the game'} · made ${esc(cbDate(K.t, true))}${when ? ' · ' + when : ''}</small></div>${show ? `<div class="cb-key-v sm">${esc(cbKeyShow(K.k))}</div>` : ''}`
      + (row && row.st === 'saving' ? '<small role="status">Setting up class results…</small>' : row && row.why ? `<small class="cb-err" role="alert">${esc(row.why)}</small>` : '')
      + (old && (K.x || K.p) ? '<small>Made on an older version of the game: make a new code.</small>' : '')
      + (K.g && !(row && row.why) ? `<small class="cb-err">Another class has ${esc(c)} on the server now. Forget it and make a new code.</small>` : '')
      + (ask ? `<div class="cb-ask" role="alert"><span>Forget the key for ${esc(c)} on this device? Without it, nobody can read or delete ${esc(c)}’s results.</span><button type="button" class="big" data-act="keyForgetNo">Keep</button><button type="button" class="big danger" data-act="keyForgetGo" data-arg="${esc(c)}">Forget</button></div>`
        : `<div class="cc-row">${main}${U.codeMade === c ? (K.p ? '' : '<small>Its key: use Show key and Copy key with the code above.</small>') : `<button type="button" class="big" data-act="keyShow" data-arg="${esc(c)}" aria-expanded="${show}">${show ? 'Hide key' : 'Show key'}</button><button type="button" class="big" data-act="keyCopy" data-arg="${esc(c)}">Copy key</button>`}</div><div class="cc-row"><button type="button" class="cb-link" data-act="keyForget" data-arg="${esc(c)}">Forget this key on this device</button></div>`)
      + '</li>'; }).join('')}</ul><small>Results show every student’s name and score: not on a projected screen. On a shared computer, forget your keys when you’re done, and delete any results file you downloaded.</small>`;
  h += U.cbOpen ? `<div class="cb-form"><label for="cbCode">Class code</label><input id="cbCode" class="cb-code" data-pick="cbcode" type="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ABC-DEF" value="${esc(F.code || '')}">`
    + `<label for="cbKey">Instructor key <small>(hidden as you type, for a projected screen)</small></label><div class="cc-row cb-keyrow"><input id="cbKey" class="cb-code cb-keyin${U.cbKeyVis ? '' : ' masked'}" data-pick="cbkey" type="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(F.key || '')}"><button type="button" class="big" data-act="cbKeyVis">${U.cbKeyVis ? 'Hide' : 'Show'}</button></div>`
    + `<label class="cb-rem"><input type="checkbox" data-pick="cbrem"${F.rem ? ' checked' : ''}> Remember the key on this device (not on a shared computer)</label>${mine.length ? '' : '<small>On a shared computer, delete any results file you download when you’re done.</small>'}<div class="cc-row"><button type="button" class="big act" data-act="cbShow">Show results</button></div><small>Results show every student’s name and score: not on a projected screen.</small></div>`
    : `<div class="cc-row"><button type="button" class="big" data-act="cbOpen">${mine.length ? 'A code made on another device' : 'Open with an instructor key'}</button></div>`;
  const err = L && L.err ? `<small class="cb-err" id="cbErr" role="alert">${esc(L.err)}</small>` : '';
  if (!(L && L.rows)) h += err;
  if (L && L.loading && !L.rows) h += '<small role="status" id="cbLoad">Loading…</small>';
  if (L && L.rows) {
    const c = E.readCode(L.code), rows = cbRows(L), ask = L.ask, n = rows.length, md = (c && !c.stale && c.mode === 'md') || rows.some(r => r.md);
    const conf = (what, arg, id) => `<div class="cb-ask" id="${id || 'cbAskRow'}" role="alert"><span>${what}</span><button type="button" class="big" data-act="cbDelNo">Keep</button><button type="button" class="big danger" data-act="cbDelGo" data-arg="${esc(arg)}">Delete</button></div>`;
    h += `<div class="cb-head" id="cbHead" role="status" tabindex="-1"><b>Results for ${esc(L.code)}</b>${c && !c.stale ? ' · ' + esc(codeDesc(c)) : ''} · ${n ? `${n} result${n === 1 ? '' : 's'}, in the order they came in` : 'no results'}${L.ended ? '' : L.exp ? ' · deleted on ' + esc(cbDate(L.exp)) : ''}${L.loading ? ' · loading…' : ''}</div>`
      + (L.ended ? `<small class="cb-err" role="alert">The class has ended, and the server has deleted its results. Below is the copy this screen loaded: Copy table or Download CSV keeps it.</small>` : '')
      + `<small class="cb-warn"><b>${esc(CB_NOTE.split(':')[0])}:</b>${esc(CB_NOTE.slice(CB_NOTE.indexOf(':') + 1))}${md ? ' ' + esc(CB_MDNOTE) : ''}</small>`;
    if (n) h += `<ol class="cb-list">${rows.map(r => `<li class="cb-row">${r.id && !L.ended ? `<button type="button" class="cb-del" data-act="cbDel" data-arg="${esc(r.id)}" aria-label="Delete ${esc(r.name)}’s result">✕</button>` : '<span class="cb-del-gap"></span>'}<div class="cb-main"><div class="cb-top"><span class="cb-nm">${esc(r.name)}${r.of > 1 ? ` <small>(${r.nth} of ${r.of} under this name)</small>` : ''}</span>${r.ver && r.ver !== GAME_V ? ` <small>v${esc(r.ver)}</small>` : ''}<span class="cb-sc">${r.score == null ? '' : r.score}<small>/100</small> <span aria-label="${r.stars} stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</span></span></div>`
      + `<small class="cb-det">${r.det} · sent ${esc(r.when)}</small></div>`
      + (ask && ask === r.id ? conf(`Delete ${esc(r.name)}’s result (${r.score == null ? '?' : r.score}/100, sent ${esc(r.when)})?`, r.id) : '')
      + (L.deleting === r.id ? '<small role="status">Deleting…</small>' : '')
      + (L.delErr && L.delErr.id === r.id ? `<small class="cb-err" id="cbDelErr" role="alert">${esc(L.delErr.msg)}</small>` : '') + '</li>').join('')}</ol>`   // ✕ on the left: the sheet's close button sits over the right edge
      + err
      + `<div class="cc-row">${L.ended ? '' : `<button type="button" class="big" data-act="cbShow" data-arg="${esc(L.code)}">Refresh</button>`}<button type="button" class="big" data-act="cbCopyTab">Copy table</button><button type="button" class="big" data-act="cbCsv">Download CSV</button><button type="button" class="big" data-act="cbClose">Close results</button></div>`
      + (L.ended ? '' : ask === 'all' ? conf(`Delete every result for ${esc(L.code)}, including any sent since you opened the list?`, 'all', 'cbAskAll') : `<div class="cc-row"><button type="button" class="cb-link" data-act="cbDel" data-arg="all">Delete all results for ${esc(L.code)}</button></div>`);
    else h += `${err}<p class="hint">No results for this code right now.</p><div class="cc-row"><button type="button" class="big" data-act="cbShow" data-arg="${esc(L.code)}">Refresh</button><button type="button" class="big" data-act="cbClose">Close results</button></div>`;
  }
  return h + '</div>';
}
function cbTable(L) {   // for Copy table and Download CSV: the caveats travel with the data
  const head = ['Name', 'Same name (n of total)', 'Role', 'Score (0-100)', 'Stars', 'Minutes played', 'Sped up %', 'Patients seen (attending)', 'Own patients died (attending)', 'Of them, after a code run by the book', 'Own patients left in an unrun arrest 5+ min (attending)', 'Diagnoses right', 'Diagnoses wrong', 'Unsafe orders', 'Complications (partly chance)', 'Radio right', 'Radio wrong', 'Radio missed',
    'Arrivals (dept.)', 'Mean door-to-provider wait, all arrivals (min, dept.)', 'Left without being seen (dept.)', 'Left against advice (dept.)', 'Bedded before registration (dept.)', 'Died (dept.)', 'Ended early', 'Ended at', 'Version', 'Sent (UTC)'];
  const a = (r, v) => (r.md ? v : '');
  return [[`Code Black class results for ${L.code}. ${CB_NOTE}${L.rows.some(r => r.role === 'md') ? ' ' + CB_MDNOTE : ''}`], [], head]
    .concat(cbRows(L).map(r => [r.name, r.of > 1 ? `${r.nth} of ${r.of}` : '', r.md ? 'Attending' : 'Charge nurse', r.score, r.stars, r.min, r.fast, a(r, r.seen), a(r, r.mdDied), a(r, r.codeLost), a(r, r.arrOpen), a(r, r.dxR), a(r, r.dxW), a(r, r.contra == null && r.unneeded == null ? null : (r.contra || 0) + (r.unneeded || 0)), a(r, r.harm == null ? null : r.contra == null ? r.harm : Math.max(0, r.harm - r.contra)), a(r, r.rR), a(r, r.rW), a(r, r.rM),
      r.arr, r.wait, r.lwbs, r.ama, r.bedFirst, r.died, r.fired ? 'fired (legal risk)' : r.walkout ? 'staff walked out' : '', (r.fired || r.walkout) && r.end != null ? cbClock(r.end) : '', r.ver, r.at.replace('T', ' ').slice(0, 16)]));
}
const cbCell = v => { let t = String(v == null ? '' : v); if (/^\s*[=+\-@＝＋－＠]/.test(t)) t = "'" + t; return t.replace(/[\t\r\n]+/g, ' '); };   // no cell can run as a spreadsheet formula
// What a student's Send sends: the same names and keys as supabase/tests/client_call.json.
function cbArgs(R, name, cid) {
  const n = v => (Number.isFinite(+v) && +v >= 0 ? Math.min(999999, Math.round(+v)) : null), sp = R.spdSec || {}, tot = Object.keys(sp).reduce((a, k) => a + (+sp[k] || 0), 0), md = R.mode === 'md', bx = R.boxC || {};
  return { p_code: R.code, p_cid: cid, p_name: name, p_role: md ? 'md' : 'rn', p_level: R.level,
    p_score: Math.max(0, Math.min(100, Math.round(+R.avg || 0))), p_stars: Math.max(0, Math.min(3, R.stars | 0)), p_real_sec: Math.max(0, Math.min(86400, R.realSec | 0)),
    p_stats: { wait: n(R.wait), lwbs: n(R.lwbs), seen: n(R.seen), ama: n(R.ama), expired: n(R.expired), bedFirst: n(R.bedFirst), fired: R.fail === 'fired' ? 1 : 0, walkout: R.fail === 'walkout' ? 1 : 0,
      fast: tot > 0 ? Math.min(100, Math.round((tot - (+sp['1'] || 0)) / tot * 100)) : null, dxRight: md ? n(R.dxRight) : null, dxWrong: md ? n(R.dxWrong) : null, mdSeen: md ? n(R.mdSeen) : null, harm: md ? n(R.mdHarm) : null,
      radioRight: md ? n(bx.right) : null, radioWrong: md ? n(bx.wrong) : null, radioMiss: md ? n(bx.miss) : null,
      mdDied: md ? n(R.mdDied) : null, contra: md ? n(R.mdContra) : null, unneeded: md ? n(R.mdUnneeded) : null, mdArrestOpen: md ? n(R.mdArrestOpen) : null, mdCodeLost: md ? n(R.mdCodeLost) : null, endMin: R.fail ? n(R.endMin) : null },
    p_ver: /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(R.ver || '') ? R.ver : GAME_V };
}
const cbWhat = R => `score ${Math.max(0, Math.min(100, Math.round(+R.avg || 0)))}/100 · ${'★'.repeat(R.stars | 0)}${'☆'.repeat(3 - (R.stars | 0))} · ${Math.round((R.realSec || 0) / 60)} min played`;
const cbWhatAll = R => (R.mode === 'md' ? 'your role and shift; your patients (how many died, how many of those after a code run by the book (every rhythm check right, the code started within 5 minutes), and how many were left in cardiac arrest 5+ minutes with no code running), diagnoses, unsafe and unneeded orders, complications, and radio calls; ' : '')   // every number sent (audit R2.9-03)
  + 'the department’s mean door-to-provider wait, arrivals, patients who left without being seen or against advice, patients bedded before registration, and deaths; whether the shift ended early (and when); how much was sped up; and the game version';
const CB_WHO = 'Only they, and the game’s developer who runs the database, can see it. It’s deleted when the class ends, within 30 days of the class’s first result.';
function cbSendHTML(R, at) {
  if (!R.code || R.level === 'train' || at == null) return '';
  const d = lastReport(), st = d && String(d.at) === String(at) && d.sent ? 'sent' : (U.cbSent || {})[at] || null;
  if (st === 'sent') return `<div class="cb-send ok" role="status"><b>Sent to the instructor for ${esc(R.code)}:</b> ${esc(cbWhat(R))}. ${CB_WHO}</div>`;
  const busy = st === 'sending', bad = !!(U.cbBadName || {})[at];
  return `<div class="cb-send" id="cbSendBox"><label for="cbName"><b>Send this to your instructor</b></label>`
    + (U.repLost === at ? '<small class="cb-err">This device couldn’t keep this summary: send it now, before you leave this page.</small>' : '')
    + (U.leaveAsk === at ? `<small class="cb-err" role="alert">Not sent yet. Tap Send first, or tap Menu or Run it back again to leave without sending.</small>` : '')
    + `<div class="cc-row"><input id="cbName" class="cb-name" data-pick="cbname" data-at="${esc(String(at))}" type="text" maxlength="40" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="First name or initials" value="${esc(U.cbName || '')}"${busy ? ' disabled' : ''}${st && !busy && bad ? ' aria-invalid="true" aria-describedby="cbNameErr"' : ''}><button type="button" class="big act" data-act="cbSend" data-arg="${esc(String(at))}"${busy ? ' disabled' : ''}>${busy ? 'Sending…' : 'Send'}</button></div>`
    + (st && !busy ? `<small class="cb-err" id="${bad ? 'cbNameErr' : 'cbSendErr'}" role="alert">${esc(st)}</small>` : '')
    + `<small>Sends your first name or initials, <b>${esc(cbWhat(R))}</b> (the score is the average of your four scores), and these numbers: ${esc(cbWhatAll(R))}, to the instructor who made ${esc(R.code)}. The full list is in About, under Privacy. ${CB_WHO}</small></div>`;   // the box first, the small print after it (audit R5.7-09e)
}
function cbRedraw(focus) {   // the summary is drawn once; the send box redraws it when its state changes, keeping the scroll and the typing focus
  const d = lastReport(), el = $('#report'); if (!d || !el || el.hidden) return;
  const y = el.scrollTop, typing = focus || (document.activeElement && document.activeElement.id === 'cbName');
  setH(el, reportHTML(d.R, d.led, d.at)); el.scrollTop = y;
  if (typing) { const i = $('#cbName'); if (i && !i.disabled) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* not a text box */ } } }   // the caret at the end, ready to fix the name
}
const codeHint = v => { const c = E.readCode(v); return c && c.stale ? staleWhy(c) : c ? codeDesc(c) : v.replace(/[^0-9a-z]/gi, '').length >= 6 ? 'That code doesn’t look right. Check each letter. If it’s right, reload the game: it may be from a newer version.' : 'Six letters and numbers, from your instructor.'; };
const codeText = c => `Code Black class code ${c.code} (v${GAME_V}): ${codeDesc(c)}. Play at ${location.origin}${location.pathname}, then Play a shift, then Class code.`;
// Resolves true only once the text is really on the clipboard (the async API, else the old copy command), so "Copied" is never shown for a copy that failed.
function copyText(t) {
  const old = () => { try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = !!(document.execCommand && document.execCommand('copy')); ta.remove(); return ok; } catch (e) { return false; } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => old()); } catch (e) { /* no clipboard */ }
  return Promise.resolve(old());
}
const LSN_KIND = k => (k.startsWith('c_') ? 'Case cards' : ['arrest', 'tachy'].includes(k) ? 'Read-through' : 'On a patient');   // QA2-5: each lesson says what kind it is
function lessonsHTML() {
  const n = LESSON_KEYS.filter(lessonDone).length;
  return head('Lessons', `Nine of the first lessons put you on a patient as the doctor, about two minutes each; cardiac arrest and fast heart rhythms are read-through cards (the rhythm-check cards themselves come up on a shift). The case cards (five short cards) teach one must-not-miss condition: how it looks, what to order, what to give and what not to. A teaching game, not clinical guidance. Written with AI: <b>no licensed clinician has reviewed them yet</b>.${n ? ` ${n} of ${LESSON_KEYS.length} done.` : ''}`)
    + LESSON_SYS.filter(([sy]) => LESSON_KEYS.some(k => LESSONS[k].sys === sy)).map(([sy, nm]) => `<div class="o-sec lsn-sys">${esc(nm)}</div><div class="cgrid lsn">${LESSON_KEYS.filter(k => LESSONS[k].sys === sy).map(k => `<button type="button" class="cbtn" data-act="lesson" data-arg="${k}"><b>${esc(LESSONS[k].name)}${lessonDone(k) ? ' <i class="lsn-ok">✓</i>' : ''}</b><small><i class="lsn-kind">${LSN_KIND(k)}</i> · ${esc(LESSONS[k].blurb)}</small></button>`).join('')}</div>`).join('');
}
const STEPS_NOW = () => { const k = lessonKey(); return k ? LESSONS[k].steps : (g() && g().mode === 'md' ? STEPS_MD : STEPS); };
// R1-04: a broken tutorial step is no longer silent. Each distinct error is logged once (window.__coachErrs, read by the tests).
const COACH_ERRS = (window.__coachErrs = window.__coachErrs || []);
function coachErr(e, where) {
  const m = `${where} ${(TR() && coachStep() && coachStep().id) || '?'}: ${(e && e.message) || e}`;
  if (!COACH_ERRS.includes(m) && COACH_ERRS.length < 50) { COACH_ERRS.push(m); try { console.warn('Tutorial step error:', m); } catch (x) { /* no console */ } }
}
function coachSafe(fn) { try { return !!fn(); } catch (e) { coachErr(e, 'done'); return false; } }
function coachStep() { const t = TR(), L = STEPS_NOW(); return t ? L[Math.min(t.step, L.length - 1)] : null; }
function coachWaitDone() { const s = coachStep(); return !!(s && s.wait && coachSafe(s.done)); }
function coachAdvance() {
  const t = TR(); if (!t || t.step >= STEPS_NOW().length - 1) return;
  t.step++; t.t0 = g().t; U.coachKey = null; t.held = null;
  const C = chOf(t.step); if (C && C.k > 0 && C.at === t.step) { t.brk = C.k; store(chKey(chMode(), C.k - 1), '1'); }   // a chapter just ended: stop and say so
  if (!STEPS_NOW()[t.step].keep) { U.sel = null; U.sheet = null; }   // a step that explains the open card leaves it open
}
function coachRun() {
  const t = TR();
  if (!t) { U.hold = false; U.ff = 0; return; }
  if (t.t0 == null) t.t0 = g().t;
  if (t.brk != null) { U.hold = true; U.ff = 0; return; }   // between chapters nothing moves, and the next patient has not arrived
  for (let guard = 0; guard < 6; guard++) {
    const s = STEPS_NOW()[t.step];
    if (s.setup && !t.setup[s.id]) { t.setup[s.id] = 1; let ids = null; try { ids = s.setup(); } catch (e) { coachErr(e, 'setup'); ids = null; } if (ids) Object.assign(t.ids, ids); }
    const stuck = s.wait && g().t - t.t0 > 150;   // a safety valve: never fast-forward forever
    if (U.coachSeen !== t.step) { U.coachSeen = t.step; U.coachAt = performance.now(); }
    if ((s.done && coachSafe(s.done)) || stuck) {
      // A wait that is over before anyone could read the card (the lab was already back, the bed was already ready) does not flash past:
      // the card stays, with a Next button, until the player has read it.
      if (s.wait && !stuck && (t.held === t.step || performance.now() - U.coachAt < coachReadMs(s))) { t.held = t.step; break; }
      coachAdvance(); if (t.brk != null) break;
      continue;
    }
    break;
  }
  if (t.brk != null) { U.hold = true; U.ff = 0; return; }   // a chapter just ended: its card shows before the next patient arrives
  const s = coachStep(), held = t.held === t.step;
  U.hold = !s.wait || held; U.ff = s.wait && !held ? 18 : 0;
}
function coachReadMs(s) {   // about a quarter second a word, between 3.5 and 11 seconds
  let text = ''; try { text = typeof s.text === 'function' ? s.text() : s.text; } catch (e) { coachErr(e, 'text'); text = ''; }
  return Math.max(3500, Math.min(11000, plainText(text).split(/\s+/).length * 260));
}
function coachSkip() {
  const s = coachStep(); if (!s) return;
  if (s.wait) {
    let n = 0; while (!coachSafe(s.done) && n++ < 1500 && !g().over) { if (g().card) E.botStep({ budget: 0 }); E.step(0.1); }
    coachAdvance();   // they asked to skip: no holding the card for reading time
    return;
  }
  if (s.auto) { try { s.auto(); } catch (e) { coachErr(e, 'auto'); } }
  if (!(s.done && coachSafe(s.done))) coachAdvance();
}
function coachHTML(where) {
  const t = TR(); if (!t) return '';
  const s = coachStep(), n = STEPS_NOW().length, C = chOf(t.step);
  if (t.brk != null && C) {   // the card between two chapters
    const prev = chList(chMode())[C.k - 1], first = C.k === 1;
    return `<div class="coach-c ${where}"><div class="ck">Preceptor · chapter ${C.k} of ${C.count} done</div><h4>${esc(prev.name)}: done</h4><p>${fmt(first ? (chMode() === 'md' ? `You can now **see, treat, and discharge** a simple patient.\nTry a **Quiet Tuesday**, or **keep going**: ${C.name}, ${C.n} steps.` : `You can now **room, treat, and discharge** a walk-in.\nTry a **Quiet Tuesday** (tap **Next** when unsure), or **keep going**: ${C.name}, ${C.n} steps.`) : `Next: **${C.name}**, ${C.n} steps.\n**Keep going**, play a **Quiet Tuesday**, or **Menu**. Your place is kept.`)}</p><div class="cb"><button type="button" class="skip" data-act="coachExit">Menu</button><button type="button"${first ? ' class="go"' : ''} data-act="coachEasy">Play Quiet Tuesday</button><button type="button"${first ? '' : ' class="go"'} data-act="coachNext">Keep going</button></div></div>`;
  }
  const title = typeof s.title === 'function' ? s.title() : s.title;
  let text = ''; try { text = typeof s.text === 'function' ? s.text() : s.text; } catch (e) { coachErr(e, 'text'); text = ''; }
  const W = '<button type="button" class="skip" data-act="words">Words</button>';
  const lk = lessonKey(), nextL = lk ? LESSON_KEYS[LESSON_KEYS.indexOf(lk) + 1] : null;
  const btns = s.final && lk ? W + `<button type="button" ${nextL ? '' : 'class="go" '}data-act="coachDone">Menu</button>${nextL ? `<button type="button" class="go" data-act="lessonNext">Next: ${esc(LESSONS[nextL].name)}</button>` : ''}`
    : s.final ? W + '<button type="button" data-act="coachDone">Menu</button><button type="button" class="go" data-act="coachEasy">Start Quiet Tuesday</button>'
    : s.next || t.held === t.step ? '<button type="button" class="skip" data-act="coachExit">Exit</button>' + W + '<button type="button" class="go" data-act="coachNext">Got it</button>'
    : s.wait ? '<span class="cff">Fast-forwarding…</span>' + W + '<button type="button" class="skip" data-act="coachSkip">Skip ahead</button>'
    : '<button type="button" class="skip" data-act="coachExit">Exit</button>' + W + '<button type="button" class="skip" data-act="coachSkip">Do it for me</button>';
  return `<div class="coach-c ${where}"><div class="ck">${lk ? `${esc(LESSONS[lk].name)} · ${t.step + 1} of ${n}` : `${C.k + 1}. ${esc(C.name)} · ${t.step - C.at + 1} of ${C.n}`}</div><h4>${esc(title)}</h4><p>${fmt(text)}</p><div class="cb">${btns}</div></div>`;
}
/* On a phone held sideways a card is a drawer on the right, and it is too short to hold the preceptor as well:
   what to tap would end up below the fold. So the preceptor stays outside it, on the left, and the card opens at its top. */
const DRAWER = window.matchMedia('(max-height: 520px) and (orientation: landscape)');
function coachBeside() { return !!TR() && DRAWER.matches && !!U.sheet && !U.modal && !(g() && g().card) && !U.paused; }
function renderCoach() {
  const el = $('#coach'), t = TR();
  document.body.classList.toggle('training', !!t);
  const beside = coachBeside();
  const inner = !beside && !!(U.sheet || U.modal || (g() && g().card) || U.paused);
  const h = t && !inner ? coachHTML('float') : '';
  setH(el, h); el.hidden = !h; el.classList.toggle('beside', beside);
  for (const x of document.querySelectorAll('.coach-spot')) x.classList.remove('coach-spot');
  const s = t && t.brk == null ? coachStep() : null;
  if (!s || !s.spot) { if (U.view === 'map') mapSpot([]); el.classList.remove('ctop'); return; }
  let sels = []; try { sels = s.spot().filter(Boolean); } catch (e) { coachErr(e, 'spot'); sels = []; }
  const els = [];
  for (const q of sels) for (const x of document.querySelectorAll(q)) if (x.getClientRects().length && (x.offsetParent !== null || getComputedStyle(x).position === 'fixed')) els.push(x);   // on screen, not merely in the page
  for (const x of els) x.classList.add('coach-spot');
  if (U.view === 'map') mapSpot(els);
  const key = t.step + '|' + sels.join(',');
  if (key === U.coachKey || !els.length) return;
  U.coachKey = key;
  const x = els[0];
  if (U.view !== 'map' && !beside) {   // the list board: the card lives at the bottom, and so do a few buttons. If it sits on the one it is pointing at, it moves to the top.
    el.classList.remove('ctop');
    const c = el.getBoundingClientRect(), r = x.getBoundingClientRect();
    el.classList.toggle('ctop', getComputedStyle(x).position === 'fixed' && !!c.width && !(r.right < c.left || r.left > c.right || r.bottom < c.top || r.top > c.bottom));
  }
  if (U.view === 'map' && !beside && !x.closest('#sheet, #modal')) coachDodge(el, x);
  if (x.closest('#map')) mapFocus(x);   // zoomed in: the camera brings the target into the clear
  else if (x.closest('.sheet-body, .modal, .dock, .top, .side')) x.scrollIntoView({ block: beside ? 'center' : 'nearest', inline: 'nearest' });
  else {
    const r = x.getBoundingClientRect(), top = ($('#top') || { offsetHeight: 0 }).offsetHeight;
    if (r.top < top + 8 || r.bottom > window.innerHeight - 250) x.scrollIntoView({ block: 'center' });
  }
}

/* One tap, from anywhere: the floor plan calls this with what is exactly under the finger. */
function mapAct(el, cx, cy) {
  const tg = U.tapGuard;   // a double tap: the second tap lands where the first one closed a sheet
  if (el && tg && performance.now() < tg.t && Math.hypot(cx - tg.x, cy - tg.y) < 40 && !el.closest('#sheet, #modal, #coach')) return;
  const hadSheet = !!U.sheet; setTimeout(() => { if (hadSheet && !U.sheet) U.tapGuard = { t: performance.now() + 400, x: cx, y: cy }; }, 0);
  if (el && el.dataset.act === 'closeSheet') { const nb = $('#needBtn'), r = nb ? nb.getBoundingClientRect() : null; if (r && r.width && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) el = nb; }   // Next shows through the dimmed side of an open card: a tap there goes to the next thing, not just the card closing
  if (!el || el.disabled) return;
  if (U.startGuard && performance.now() < U.startGuard && U.scene === 'game' && !el.closest('#modal, #coach')) return;
  ensureAudio();
  const fn = ACT[el.dataset.act];
  if (fn) { try { fn(el.dataset.arg, el); render(); } catch (e) { if (U.scene === 'game') crash(e, 'tap ' + el.dataset.act); else throw e; } }
}

/* On the floor plan the preceptor's card keeps off what it points at: the far side first, then the other end of the screen. */
function coachDodge(el, x) {
  const r = mapRect(x), left = (r.left + r.right) / 2 > window.innerWidth / 2;
  const hits = () => { const c = el.getBoundingClientRect(); return !!c.width && !(r.right < c.left - 6 || r.left > c.right + 6 || r.bottom < c.top - 6 || r.top > c.bottom + 6); };
  for (const [l, alt] of [[left, false], [!left, false], [left, true], [!left, true]]) { el.classList.toggle('cleft', l); el.classList.toggle('calt', alt); if (!hits()) return; }
  el.classList.toggle('cleft', left); el.classList.remove('calt');
}

/* ---------- modals (these pause the shift) ---------- */
function renderModal(G) {
  const wrap = $('#modalWrap'), el = $('#modal');
  let h = '';
  if (U.scene === 'game' && G.card && (G.mode !== 'md' || G.card.mine)) {
    const c = G.card;
    h = `<div class="mc-who">${esc(c.who)}</div><h3>${esc(c.title)}</h3><p>${fmt(c.text)}</p><div class="mc-ch">${c.choices.map(x => `<button type="button" data-act="card" data-arg="${x.k}" ${x.dis ? 'disabled' : ''}><b>${esc(x.label)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>${/^code/.test(c.eid) ? '<p class="rep-note">A teaching game, not clinical guidance. No licensed clinician has reviewed it yet.</p>' : ''}`;
  } else if (U.modal && U.modal.type === 'scen') {
    const m = U.modal;
    h = `<div class="mc-who">The Box · ${esc(m.unit)} · ${esc(m.doc)} on the line${m.pack === 'miemss' ? ' · Maryland protocols' : ''}</div><h3>Medical direction</h3><p class="scen">${esc(m.sc.q)}</p>${PLAIN() && m.sc.plain ? `<p class="scen-p"><b>In plain words:</b> ${esc(m.sc.plain)}</p>` : ''}${m.sc.opts ? `<div class="mc-ch">${(m.opt || m.sc.opts.map((x, i) => i)).map(i => `<button type="button" data-act="scen" data-arg="o${i}"><b>${esc(m.sc.opts[i])}</b></button>`).join('')}</div>` : `<div class="mc-ch two"><button type="button"${m.sc.btn ? '' : ' class="go"'} data-act="scen" data-arg="1"><b>${esc((m.sc.btn || ['Approve'])[0])}</b></button><button type="button"${m.sc.btn ? '' : ' class="no"'} data-act="scen" data-arg="0"><b>${esc((m.sc.btn || [0, 'Deny'])[1])}</b></button></div>`}`;   // named choices are not green and red: neither is the "yes" answer
  } else if (U.modal && U.modal.type === 'result') {
    const r = U.modal.r;
    h = `<div class="mc-res ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'Correct' : 'Incorrect'}</div><h3>${r.sc.opts ? `You ordered: ${esc(r.sc.opts[r.approve])}` : r.sc.btn ? `You said: ${esc(r.sc.btn[r.approve ? 0 : 1])}` : `You ${r.approve ? 'approved' : 'denied'} it`}</h3>${r.sc.opts && !r.ok ? `<p><b>The order:</b> ${esc(r.sc.opts[r.sc.r])}</p>` : ''}${PLAIN() && r.sc.pwhy ? `<p><b>${esc(r.sc.pwhy)}</b></p><p class="scen-c">${esc(r.sc.why)}</p>` : `<p>${esc(r.sc.why)}</p>`}<div class="mc-ch"><button type="button" data-act="modalOk"><b>Back to the shift</b></button></div>`;
  } else if (U.modal && U.modal.type === 'first') {
    const md = MD(), lines = md
      ? [U.view === 'map' && floor3d() ? 'A **stethoscope** means waiting for a doctor. Tap the room, then **See this patient**.' : U.view === 'map' ? 'A **blue room** is waiting for a doctor. Tap it, then **See this patient**.' : '**Needs a provider** means waiting for a doctor. Tap it, then **See this patient**.', '**Write orders**, then **make the call** when results are back.', 'Lost? Tap **Next**.']
      : [U.view === 'map' && floor3d() ? 'A **shaking icon** is waiting on you. A **flashing red ring** is a patient crashing.' : U.view === 'map' ? 'A **solid-coloured room** is waiting on you.' : '**Blue** words are waiting on you.', `**Next**${U.view === 'map' && U.rails ? ', bottom left,' : ''} jumps to the most urgent thing.`, 'A **card that stops the clock** needs a decision. Every choice costs something.'];
    h = `<div class="mc-who">${esc(E.LEVELS[G.level].name)} · your first shift as ${md ? 'the attending' : 'charge nurse'}</div><h3>Three things to know</h3><ol class="first">${lines.map(x => `<li>${fmt(x)}</li>`).join('')}</ol><div class="mc-ch"><button type="button" class="go" data-act="modalOk"><b>Start the shift</b></button><button type="button" data-act="firstHelp"><b>How to play</b><small>The full guide</small></button>${store(trainedKey(md ? 'md' : 'rn')) ? '' : '<button type="button" data-act="firstTrain"><b>Do Orientation first</b><small>A preceptor walks you through it</small></button>'}</div>`;
  } else if (U.scene === 'game' && U.paused && !U.sheet) {
    h = `<div class="mc-who">${lessonKey() ? 'Lesson: ' + esc(LESSONS[lessonKey()].name) : esc(E.LEVELS[G.level].name)}${G.scen && G.scen !== 'none' && E.SCENS[G.scen] ? ' · ' + esc(E.SCENS[G.scen].name) + ' scenario' : ''} · ${E.clock()}</div><h3>Menu</h3><p>The shift is paused and saved on this device.</p><div class="mc-ch"><button type="button" data-act="resume"><b>Resume</b></button><button type="button" data-act="restart"><b>${U.armR && performance.now() - U.armR < 3000 ? 'Tap again to restart' : 'Restart this shift'}</b></button><button type="button" data-act="menu"><b>Main menu</b></button><button type="button" data-act="help"><b>How to play</b></button><button type="button" data-act="words"><b>What the words mean</b></button><button type="button" data-act="sound"><b>Sound: ${U.sound ? 'on' : 'off'}</b></button><button type="button" data-act="plain"><b>Plain words: ${PLAIN() ? 'on' : 'off'}</b></button><button type="button" data-act="view"><b>${U.view === 'map' ? 'Switch to the list board' : 'Switch to the floor plan'}</b></button>${U.view === 'map' ? `<button type="button" data-act="three"><b>${U.three ? '3D floor: on' : '3D floor: off'}</b></button>` : ''}${U.view === 'map' && U.three ? `<button type="button" data-act="q3d"><b>3D detail: ${Q3D_NAME[U.q3d]}</b></button>` : ''}${document.fullscreenEnabled ? `<button type="button" data-act="fullscreen"><b>${document.fullscreenElement ? 'Leave full screen' : 'Full screen'}</b></button>` : ''}</div>`;
  }
  if (h && TR()) h = coachHTML('in') + h;
  const was = wrap.hidden;
  wrap.hidden = !h; morph(el, h);
  // QA-5: the board behind the menu, a report or an open card can't be reached by keyboard, and a card that opens takes the focus
  const app = $('.app'), block = U.scene !== 'game' || !!h; if (app && app.inert !== block) app.inert = block;
  if (h && was && !wrap.contains(document.activeElement)) { const f = el.querySelector('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
}
const ROT = window.matchMedia('(orientation: portrait) and (max-width: 700px)');   // the same test the "Turn your phone sideways" card uses
function isPaused() { const G = g(); return U.paused || !!U.modal || (G && !!G.card && (G.mode !== 'md' || G.card.mine)) || U.scene !== 'game' || (U.view === 'map' && ROT.matches); }   // the computer charge nurse answers cards for the attending

/* ---------- live timers ---------- */
function live(G) {
  const t = G.t;
  for (const el of document.querySelectorAll('[data-el]')) { const v = fm(t - el.dataset.el); if (el.textContent !== v) el.textContent = v; }
  for (const el of document.querySelectorAll('[data-cd]')) { const v = fm(el.dataset.cd - t); if (el.textContent !== v) el.textContent = v; }
  for (const el of document.querySelectorAll('[data-bar],[data-fill]')) {
    const [a, b] = (el.dataset.bar || el.dataset.fill).split(',').map(Number);
    let f = Math.max(0, Math.min(1, (t - a) / (b - a)));
    if (el.dataset.bar) f = 1 - f;
    el.style.width = (f * 100).toFixed(1) + '%';
  }
  for (const el of document.querySelectorAll('[data-mor]')) { const s = E.staff(el.dataset.mor); if (!s) continue; const m = Math.round(s.morale); el.style.width = m + '%'; setC(el, m >= 65 ? 'm-good' : m >= 40 ? 'm-warn' : 'm-bad'); }
  for (const el of document.querySelectorAll('[data-stx]')) { const s = E.staff(el.dataset.stx); if (!s) continue; const v = staffStatus(s, G); if (el.textContent !== v) el.textContent = v; }
  for (const el of document.querySelectorAll('[data-ql]')) { const s = E.staff(el.dataset.ql); if (!s) continue; const n = s.q.length; const v = n ? `${n} in line` : 'Free now'; if (el.textContent !== v) el.textContent = v; }
  for (const el of document.querySelectorAll('[data-load]')) { const s = E.staff(el.dataset.load); if (!s) continue; const v = `Load ${fl(E.nurseLoad(s))}/${E.ratioCap(s)}`; if (el.textContent !== v) el.textContent = v; }
}

/* ---------- "Needs you": everything waiting on the player right now, most urgent first ---------- */
function needList(G) {
  const out = [], md = MD(), c = G.box.cur;
  if (c && !c.taken && !(md && c.kind === 'notify')) out.push({ k: 'box', id: 'box', pr: 0, s: 'The Box', what: md ? 'The radio is ringing' : c.kind === 'notify' ? 'The Box: take report' : 'The Box: find a doctor' });
  for (const r of G.rooms) {
    const p = r.pid ? E.pt(r.pid) : null;
    if (p) {
      const ns = nextStep(p, r, G), fl = /\bfl\b/.test(ns.c);
      let pr = /n-code/.test(ns.c) && fl ? 1 : /n-bad/.test(ns.c) ? 2 : /n-act/.test(ns.c) ? 4 : /n-go/.test(ns.c) && fl ? 5 : 0;
      if (md && pr && !(mine(p) || (E.needsProv(p) && !p.prov) || pr === 1)) pr = 0;   // the charge nurse has the rest
      if (pr >= 4 && pr < 5 && ve(p) === 1) pr = 2.6;   // the sickest level waiting on you is urgent: the button turns red
      if (pr) out.push({ k: 'room', id: r.id, pid: p.id, pr: pr + ve(p) / 10, s: E.roomName(r.id), what: `${E.roomName(r.id)}: ${ns.t.replace(/<[^>]+>/g, '').replace(/ · $/, '')}` });
    } else if (!md && r.st === 'dirty' && !r.closed && G.evsQ.indexOf(r.id) < 0) out.push({ k: 'dirty', id: r.id, pr: 8, s: E.roomName(r.id), what: `${E.roomName(r.id)} is dirty` });
  }
  if (!md) {
    for (const p of E.active()) {
      if (p.loc !== 'wall') continue;
      const u = p.unit || 'EMS', v = E.vitalsOf(p), sick = v.taken && !v.arrest && Object.values(v.flags || {}).filter(Boolean).length >= 2;   // two numbers in red: they go ahead of routine work
      if (E.emergent(p)) out.push({ k: 'pt', id: p.id, pid: p.id, pr: 1.5, s: p.name, what: `${u}: ${p.name} needs a room now` });
      else if (intakeDone(p)) out.push({ k: 'pt', id: p.id, pid: p.id, pr: (sick ? 3.2 : 6) - Math.min(0.9, (G.t - p.tArrive) / 90), s: p.name, what: `${u}: ${p.name} is ready for a bed` });
      else if (p.reg === 'none' || p.tri === 'none') out.push({ k: 'pt', id: p.id, pid: p.id, pr: sick ? 3.4 : 6.5, s: p.name, what: `${u}: ${p.name} needs ${p.tri === 'none' ? 'report taken' : 'registration'}` });
    }
    for (const p of E.active()) if (p.arrest && (p.loc === 'waiting' || p.loc === 'triage')) out.push({ k: 'pt', id: p.id, pid: p.id, pr: 1.2, s: p.name, what: `CODE: ${p.name} has no pulse in the ${p.loc === 'waiting' ? 'waiting room' : 'triage line'}. Room them now` });   // R5.2-03
    const door = G.triageQ.map(E.pt).filter(p => p && (p.reg === 'none' || p.tri === 'none')).length;
    if (door) out.push({ k: 'door', id: 'door', pr: 7, s: 'The door', what: `${door} at the door need${door === 1 ? 's' : ''} registration or triage` });
    const wait = E.active().filter(p => p.loc === 'waiting' && !p.pitSeen).length;
    if (wait && G.rooms.some(r => !r.pid && r.st === 'clean' && !r.closed && r.kind !== 'chair' && r.kind !== 'resus')) out.push({ k: 'wait', id: 'wait', pr: 6.2, s: 'Waiting room', what: `${wait} in the waiting room, and a bed is open` });
  }
  return out.sort((a, b) => a.pr - b.pr);
}
/* What the next tap goes to: the most urgent thing you have not just been to. Something urgent comes back around in seconds, the rest in half a minute. */
function needPick(list) {
  if (!list.length) return null;
  const now = performance.now(), seen = U.needSeen || (U.needSeen = {});
  for (const k of Object.keys(seen)) { const it = list.find(x => String(x.id) === k); if (!it || now - seen[k] > (it.pr < 3 ? 4000 : 25000)) delete seen[k]; }
  return list.find(x => !(String(x.id) in seen)) || list[0];
}
function needEl(it) {   // where it is on the board
  const fp = U.view === 'map';
  if (it.k === 'room' || it.k === 'dirty') return document.getElementById((fp ? 'mroom-' : 'room-') + it.id);
  if (it.k === 'pt') return fp ? document.querySelector(`#mPts [data-arg="${it.pid}"], #mAmbs [data-arg="${it.pid}"]`) : document.querySelector(`#laneEms [data-arg="${it.pid}"]`);
  if (it.k === 'door') return fp ? document.getElementById('mDoor') : document.getElementById('laneWait');
  if (it.k === 'wait') return fp ? document.getElementById('mWait') : document.getElementById('laneWait');
  return fp ? document.getElementById('mBox') : document.getElementById('boxbar');
}
const needOn = G => !G.train || !!(G.tr && G.tr.need);   // in Orientation the button appears when the preceptor introduces it
function renderNeed(G) {
  const el = $('#needBtn'); if (!el) return;
  document.body.classList.toggle('needon', !!(G && G.train && G.tr && G.tr.need));
  const rail = $('#railL'), inRail = !!(rail && U.view === 'map' && U.rails && !MD() && U.scene === 'game');
  if (rail) { const home = inRail ? rail : rail.parentNode; if (el.parentNode !== home) { if (inRail) home.appendChild(el); else home.insertBefore(el, rail); } }
  const list = U.scene === 'game' && needOn(G) ? needList(G) : [], n = list.length, nx = needPick(list);
  const h = n ? `<span class="nb-n"><b>${n}</b> Next</span><span class="nb-w">${esc(nx.s)}</span>` : '<span class="nb-n"><b>✓</b> Clear</span>';
  setH(el, h); setC(el, 'needbtn' + (n ? ' on' : '') + (n && nx.pr < 3 ? ' hot' : '') + (inRail ? ' inrail' : ''));
  el.setAttribute('aria-label', n ? `${n} ${n === 1 ? 'thing needs' : 'things need'} you. Go to the next one: ${nx.what}` : 'Nothing is waiting on you');
  if (U.view === 'map') { const r = U.needRing, it = r && performance.now() < r.until ? list.find(x => x.id === r.id) : null, x = it ? needEl(it) : null; mapSpot(x ? [x] : [], 'mNeed', 'needring'); }
  renderMeter(G, U.scene === 'game' && G ? (needOn(G) ? list : needList(G)) : []);
}
/* v0.25: the waiting meter. How many patients are waiting on you for their next step: green at 1 or 2, through yellow,
   to red, shaking and pulsing past 10. Tap it for the list; tap a row to go there. */
const qCount = list => list.reduce((n, it) => n + (it.k === 'room' || it.k === 'pt' ? 1 : it.k === 'door' || it.k === 'wait' ? (+(String(it.what).match(/^\d+/) || [1])[0]) : 0), 0);
function renderMeter(G, list) {
  let m = $('#waitMeter');
  if (!m) { m = document.createElement('button'); m.type = 'button'; m.id = 'waitMeter'; m.className = 'wmeter'; m.dataset.act = 'queue'; document.body.appendChild(m); }
  const on = U.scene === 'game' && G && !G.over && !U.sel && !U.sheet, host = on && $(U.view === 'map' ? '#map' : '#board'), r = host && host.getBoundingClientRect();
  if (!r || !r.width) { if (!m.hidden) m.hidden = true; return; }
  if (m.hidden) m.hidden = false;
  const n = qCount(list), hue = n <= 2 ? 130 : n >= 10 ? 0 : Math.round(120 - (n - 2) / 8 * 120);
  const z = U.view === 'map' && $('#mzoom'), zr = z && getComputedStyle(z).display !== 'none' ? z.getBoundingClientRect() : null;   // beside the zoom buttons, out of the way of the rooms
  if (zr && zr.width) { m.style.left = 'auto'; m.style.top = 'auto'; m.style.right = (window.innerWidth - zr.left + 8) + 'px'; m.style.bottom = (window.innerHeight - zr.bottom) + 'px'; }
  else { m.style.right = 'auto'; m.style.bottom = 'auto'; m.style.left = (r.left + 8) + 'px'; m.style.top = (r.top + 8) + 'px'; }
  m.style.setProperty('--wm', `hsl(${hue} 72% ${n >= 10 ? 44 : 40}%)`);
  setC(m, 'wmeter' + (n > 10 ? ' crit' : n >= 7 ? ' hot' : ''));
  const h = `<b>${n}</b><span>waiting on<br>a next step</span>`; setH(m, h);   // R4-05: not the waiting room; patients whose next step is yours
  m.setAttribute('aria-label', `${n} patient${n === 1 ? '' : 's'} waiting on a next step. Tap for the list.`);
}
function ucSheet(G, s) {   // v0.25: what the unit secretary is doing, and the clerical work waiting
  if (!s) return '';
  const cur = s.task ? (G.clerk || []).find(x => x.id === s.task.cid) : null, nm = t => E.CLERK[t.k].name + (t.pid && E.pt(t.pid) ? ': ' + E.pt(t.pid).name : '');
  const queued = s.q.map(id => (G.clerk || []).find(x => x.id === id)).filter(Boolean), open = E.clerkOpen();
  return head(`${esc(s.name)}, unit secretary`, 'Calls, rides and paperwork. One thing at a time.') + `<p class="hint">${s.st !== 'on' ? stLabel(s) : cur ? `Now: ${esc(nm(cur))} · <span data-cd="${s.task.until}"></span>` : 'Free now.'}${queued.length ? ` Next: ${queued.map(t => esc(nm(t))).join(', ')}.` : ''}</p>`
    + `<div class="qlist">${open.map(t => `<button type="button" class="qrow hot" data-act="ucDo" data-arg="${t.id}|${s.id}"><b>${esc(E.CLERK[t.k].name)}</b><span>${t.pid && E.pt(t.pid) ? esc(E.pt(t.pid).name) + ' · ' : ''}waiting <span data-el="${t.t0}"></span></span></button>`).join('')}`
    + `${(G.clerk || []).some(t => t.k === 'family') ? '' : `<button type="button" class="qrow" data-act="ucDo" data-arg="family|${s.id}"><b>${E.CLERK.family.name}</b><span>The three unhappiest patients hear what’s happening</span></button>`}</div>`;
}
function queueHTML(G) {
  const list = needList(G).filter(it => it.k !== 'dirty');
  return head('Patients waiting', list.length ? 'Most urgent first. Tap one to go there.' : 'Nobody is waiting right now.') + `<div class="qlist">${list.map(it => `<button type="button" class="qrow${it.pr < 3 ? ' hot' : ''}" data-act="needGo" data-arg="${esc(String(it.id))}"><b>${esc(it.s)}</b><span>${esc(it.what.replace(it.s + ': ', ''))}</span></button>`).join('')}</div>`;
}

function needGo(it) {   // go to one thing that needs the player (the Next button, or a row in the waiting list)
    (U.needSeen || (U.needSeen = {}))[String(it.id)] = performance.now();
    U.needLast = it.id; U.needRing = { id: it.id, until: performance.now() + 6000 }; U.sel = null; U.sheet = null;
    const x = needEl(it);
    if (x && U.view === 'map') mapFocus(x); else if (x) x.scrollIntoView({ block: 'center' });
    if (it.k === 'box') ACT.boxTap();
    else if (it.k === 'room') U.sheet = { type: 'pt', pid: it.pid };
    else if (it.k === 'pt') tapPt(it.pid);
    else if (it.k === 'door' || it.k === 'wait') U.sheet = { type: 'zone', z: 'triage', at: it.k };
    else toast(`${it.what}. Tap it to send EVS.`, 'info');   // a card says what it is; a dirty room has no card, so say it
  
}
/* ---------- taps ---------- */
function tapRoom(id) {
  const r = E.room(id), s = U.sel;
  if (MD()) {
    if (r.pid) { U.sheet = { type: 'pt', pid: r.pid }; return; }
    toast(r.st === 'dirty' ? 'The charge nurse sends EVS to dirty rooms.' : `${E.roomName(id)} is ${r.closed ? 'closed' : r.st}. The charge nurse places patients.`, 'info');
    return;
  }
  if (s && s.type === 'reg') {
    if (!r.pid) { toast('Tap a patient who needs registration', 'info'); return; }
    const out = E.register(r.pid, s.sid); if (out.ok) sfx('tap'); else toast(out.why, 'bad');
    return;
  }
  if (s && s.type === 'tri') { toast('Triage happens at the door. Tap a patient in the ambulance bay or waiting room.', 'info'); return; }
  if (s && (s.type === 'pt' || s.type === 'move')) {
    const out = s.type === 'pt' ? E.place(s.pid, id) : E.move(s.pid, id);
    if (out.ok) { U.sel = null; sfx('tap'); } else { s.why = out.why; toast(out.why, 'bad'); }   // the reason stays on the bar: a passing message was easy to miss
    return;
  }
  if (s && s.type === 'prov') {
    if (!r.pid) { toast('Pick a room with a patient in it', 'info'); return; }
    const out = E.assign(s.sid, r.pid);
    if (out.ok) sfx('tap'); else toast(out.why, 'bad');
    return;
  }
  if (r.pid) { U.sheet = { type: 'pt', pid: r.pid }; return; }
  if (r.st === 'dirty') { const out = E.evsTap(id); toast(out.ok ? out.msg : out.why, 'info'); return; }
  if (r.closed) { toast(`${E.roomName(id)} is closed. Reopen it from the ${E.ZONE_NAME[r.z]} ${U.view === 'map' ? 'sign' : 'header'}.`, 'info'); return; }
  toast(r.st === 'cleaning' ? 'EVS is cleaning it now' : `${E.roomName(id)} is clean. Tap a patient, then this room.`, 'info');
}
function tapPt(id) {
  const p = E.pt(id); if (!p) return;
  if (MD()) { U.sel = null; U.sheet = { type: 'pt', pid: id }; return; }
  const s = U.sel;
  if (s && (s.type === 'reg' || s.type === 'tri')) {
    const out = s.type === 'reg' ? E.register(id, s.sid) : E.triage(id, s.sid);
    if (out.ok) sfx('tap'); else toast(out.why, 'bad');
    return;
  }
  if (p.loc === 'enroute') { U.sheet = { type: 'pt', pid: id }; return; }
  if (s && s.type === 'pt' && s.pid === id) { U.sel = null; return; }
  if (!intakeDone(p) && !E.emergent(p)) { U.sel = null; U.sheet = { type: 'pt', pid: id }; return; }
  U.sel = { type: 'pt', pid: id };
  if (U.sheet && U.sheet.type === 'zone') U.sheet = null;   // picked from the waiting room list: now tap a room
}
function jump(z) {
  const el = z === 'intake' ? $('#intake') : document.getElementById('zone-' + z);
  if (el) el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
const ACT = {
  room: tapRoom, pt: tapPt, jump,
  regSel: id => { U.sel = U.sel && U.sel.type === 'reg' && U.sel.sid === id ? null : { type: 'reg', sid: id }; },
  triSel: id => { U.sel = U.sel && U.sel.type === 'tri' && U.sel.sid === id ? null : { type: 'tri', sid: id }; },
  regAssign: a => { const [pid, sid] = a.split('|'); res(E.register(pid, sid)); },
  see: pid => res(E.assign(g().me, pid), true),
  ordT: a => {
    const [pid, kind, key] = a.split('|');
    if (!U.ord || U.ord.pid !== pid) U.ord = { pid, tests: [], treats: [] };
    const list = kind === 't' ? U.ord.tests : U.ord.treats, i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
  },
  sign: pid => { const o = U.ord && U.ord.pid === pid ? U.ord : { tests: [], treats: [] }; const r = E.signOrders(pid, o.tests, o.treats); if (r.ok) { U.ord = null; U.ordOpen = null; } res(r, r.ok); },
  ordOpen: pid => { U.ordOpen = pid; U.ord = null; },
  dxPick: a => { const i = a.indexOf('|'), r = E.dxPick(a.slice(0, i), a.slice(i + 1)); if (r.ok) { toast(r.msg, r.right ? 'good' : 'bad'); sfx(r.right ? 'good' : 'bad'); } else res(r); },
  ordMenu: id => { const S = OM_OPEN(); if (S.has(id)) { S.delete(id); for (const k of [...S]) if (k.startsWith(id + ':')) S.delete(k); } else { if (!id.includes(':')) for (const k of [...S]) if (!k.includes(':')) S.delete(k); S.add(id); } },
  mdd: a => { const [pid, k] = a.split('|'); if (k === 'consult') { U.sheet = { type: 'consult', pid }; return; } res(E.mdDecide(pid, k), true); },
  staleOk: () => { try { localStorage.removeItem('oc-save'); } catch (e) { /* storage blocked */ } if (U.scene === 'title') setH($('#title'), titleHTML()); },
  aboutDone: () => { store('oc-seen-about', '1'); ACT.tmenu('main'); },
  tmenu: a => { U.tm = a || 'main'; if (U.scene === 'title') { setH($('#title'), titleHTML()); $('#title').scrollTop = 0; if (U.kbd) { const f = $('#title .t-back') || focusables($('#title'))[0]; if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } } } },   // QA2-4: the focus follows a menu change
  img: a => { const [pid, d] = a.split('|'); openViewer(pid, d); },
  q3d: () => { const o = ['low', 'med', 'high', 'auto']; U.q3d = o[(o.indexOf(U.q3d) + 1) % o.length]; store('oc-3dq', U.q3d); if (window.OC3D && OC3D.quality) OC3D.quality(U.q3d); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  three: () => { U.three = !U.three; store('oc-3d', U.three ? '1' : '0'); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  view: v => { U.view = v === 'list' || v === 'map' ? v : U.view === 'map' ? 'list' : 'map'; store('oc-view', U.view); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  mode: m => { U.mode = m === 'md' ? 'md' : 'rn'; store('oc-mode', U.mode); setH($('#title'), titleHTML()); },
  scenario: k => { U.scen = E.SCENS[k] ? k : 'none'; store('oc-scen', U.scen); setH($('#title'), titleHTML()); },
  print: () => { document.querySelectorAll('details.rep-more').forEach(d => { d.open = true; }); try { window.print(); } catch (e) { toast('Printing isn’t available here. Open the game in your browser to print.', 'info'); } },
  coachNext: () => { const t = TR(); if (t && t.brk != null) { t.brk = null; t.t0 = g().t; U.coachKey = null; } else coachAdvance(); },
  chapter: k => { start('train', null, +k || 0); },
  chapters: () => { U.sheet = { type: 'chapters' }; },
  coachSkip: () => coachSkip(),
  coachExit: () => { const t = TR(); if (t && t.brk != null) { store('oc-save', null); showTitle(); } else { save(true); showTitle(); } },   // between chapters there is nothing to resume: the next one is on the menu
  coachDone: () => { const k = lessonKey(); if (!k) { const C = chOf(TR().step); if (C) store(chKey(chMode(), C.k), '1'); } store(k ? 'oc-lesson-' + k : trainedKey(g().mode), '1'); store('oc-save', null); showTitle(); },
  coachEasy: () => { const t = TR(), s = coachStep(); if (!t || (t.brk == null && s && s.final)) store(trainedKey(g().mode), '1'); U.mode = g().mode || 'rn'; start('easy'); },
  lessons: () => { U.sheet = { type: 'lessons' }; },
  classCode: () => {   // a fresh look each time: no key left showing or typed, no results opened with a key this device wasn't asked to keep
    U.sheet = { type: 'class' }; U.showKey = null; U.cbForget = null; U.cbOpen = false; U.cbForm = null; U.cbKeyVis = false; U.codeAsk = null;
    if (U.cbList && U.cbList.typed && !cbKeys()[U.cbList.code]) { U.cbList = null; U.cbSeq = (U.cbSeq || 0) + 1; }   // and an answer still on its way is dropped
    if (U.cbList) U.cbList.ask = null;
    const K = cbKeys(); for (const c of Object.keys(K)) if (K[c].p && !K[c].s && !(U.reg && U.reg.code === c && (U.reg.st === 'saving' || U.reg.st === 'fail'))) cbKeySave(c, null);   // codes never shown: nobody has them (audit R3.7-01)
  },
  codeMake: lvl => {   // the code shows once the server has registered it: it never changes after the class has seen it
    if (U.reg && U.reg.st === 'saving') return;
    if (U.codeMade) { U.codeAsk = lvl; U.focusTo = '#codeAsk [data-act="codeAskNo"]'; cbScroll('#codeAsk'); return; }   // the focus goes to the question, not the next button (audit R4.10-03)   // a code is on the screen: ask before replacing it
    ACT.codeMakeGo(lvl);
  },
  codeMakeGo: lvl => {
    if (!E.LEVELS[lvl] || (U.reg && U.reg.st === 'saving')) return;
    if (U.reg && U.reg.code && U.reg.code !== U.codeMade && U.reg.st !== 'ok') cbKeySave(U.reg.code, null);   // a code that never showed: nobody has it
    U.codeAsk = null; U.codeMade = null; U.showKey = null;
    cbRegister(cbDraw({ mode: U.mode, level: lvl, scen: U.scen, pack: U.pack }), cbNewKey(), 0); cbScroll();
  },
  codeAskNo: () => { if (U.codeAsk) U.focusTo = `#sheet [data-act="codeMake"][data-arg="${U.codeAsk}"]`; U.codeAsk = null; },
  codeReg: () => { const R = U.reg; if (R && R.code && R.key && (R.code === U.codeMade || R.st === 'fail')) cbRegister(R.code, R.key, 0); },   // the same code and key: safe to repeat
  codeNoRes: () => {   // the server couldn't be reached: the class can still play the code; the key is kept, so Try again can still set them up.
    // Or when class results are full, when nobody can register a code. Not for busy: someone else can cause it, then register the code
    // first and receive the class's results (audit R3.8-01, R5.8-01).
    const R = U.reg; if (!R || R.st !== 'fail' || !(R.net || R.full) || !R.code || !R.key) return;
    U.codeMade = R.code; R.st = 'off'; const K = cbKeys()[R.code];
    R.saved = cbKeySave(R.code, Object.assign({ k: R.key, t: Date.now(), p: 1 }, K, { s: 1 }));
  },
  codeRegSaved: c => {   // a listed code whose registration never confirmed, or whose class has ended: in its own row, the screen's code untouched
    const K = cbKeys()[c], r = E.readCode(c), RR = U.regRows = U.regRows || {}; if (!K || !r || r.stale || (RR[c] && RR[c].st === 'saving')) return;
    const seq = (U.rowSeq = (U.rowSeq || 0) + 1); RR[c] = { st: 'saving', seq };   // each row its own request: two at once don't drop each other (audit R1.7-07)
    const mine = () => RR[c] && RR[c].seq === seq && cbKeys()[c];
    cbRpc('cb_class_new', { p_code: c, p_key: K.k, p_ver: GAME_V }).then(x => {
      if (!mine()) return;
      if (x.ok) {
        const made = Date.parse(x.created) || K.t, saved = cbKeySave(c, { k: K.k, t: made, e: Date.parse(x.expires) || 0, s: 1 }); delete RR[c];
        if (U.reg && U.reg.code === c) { U.reg = { code: c, key: K.k, st: 'ok', exp: x.expires, made, saved }; U.regSeq = (U.regSeq || 0) + 1; }   // the code on screen says so too (audit R1.8-03), and the panel's own late answer is dropped (audit R1.9-03)
        res({ ok: true, msg: `Class results are on for ${c}` });
      }
      else if (x.error === 'taken') { cbKeySave(c, Object.assign({}, K, { x: 1, p: 0, g: 1 })); RR[c] = { st: 'fail', seq, taken: true, why: `Another class has ${c} on the server now. Forget it and make a new code.` }; }   // kept, so the row still says so after the sheet is reopened (audit R5.9-06)
      else RR[c] = { st: 'fail', seq, taken: x.error === 'taken', why: x.error === 'taken' ? `Another class has ${c} on the server now. Forget it and make a new code.` : x.error === 'busy' ? CB_BUSY + ' Or turn off Wi-Fi and tap it again on mobile data (another network).' : x.error === 'full' ? CB_FULL : 'The server turned this code down. Make a new one.' };
      render();
    }).catch(e => { if (!mine()) return; RR[c] = { st: 'fail', seq, why: cbNet(e) }; render(); });
  },
  keyShow: c => { U.showKey = U.showKey === c ? null : c; },
  keyCopy: c => { const k = cbKeyOf(c); if (k) copyText(`Code Black instructor key for class code ${c}: ${cbKeyShow(k)}`).then(ok => { if (ok) U.keyCopied = c; res(ok ? { ok: true, msg: `Copied the instructor key for ${c}, with its code. Keep it private.` } : { ok: false, why: 'Copy didn’t work here. Tap Show key and write it down.' }); render(); }); },
  keyForget: c => { U.cbForget = c; U.focusTo = '#sheet .cb-codes .cb-ask [data-act="keyForgetNo"]'; },   // the focus goes to the question (audit R3.10-03)
  keyForgetNo: () => { if (U.cbForget) U.focusTo = `#sheet [data-act="keyForget"][data-arg="${U.cbForget}"]`; U.cbForget = null; },
  keyForgetGo: c => {   // forgotten everywhere on this device: storage, the open results, the code just made, and any answer on its way
    cbKeySave(c, null); U.cbForget = null; U.showKey = null; U.focusTo = '#sheetBox';   // the row is gone: the focus goes to the sheet, not another class's Show key (audit R3.10-03)
    if (U.keyCopied === c) { U.keyCopied = null; copyText(' '); }   // the key this page copied leaves the clipboard too (a shared computer; audit R5.7-04)
    if (U.cbList && U.cbList.code === c) { U.cbList = null; U.cbSeq = (U.cbSeq || 0) + 1; }
    if (U.reg && U.reg.code === c) { U.reg = null; U.codeMade = null; U.codeAsk = null; U.regSeq = (U.regSeq || 0) + 1; }
    if (U.regRows) delete U.regRows[c];
    res({ ok: true, msg: `This device has forgotten the key for ${c}` });
  },
  codeCopy: () => { const c = E.readCode(U.codeMade); if (c) copyText(codeText(c)).then(ok => { res(ok ? { ok: true, msg: `Copied ${c.code} and how to play it` } : { ok: false, why: `Copy didn’t work here. The code is ${c.code}.` }); render(); }); },
  codeShare: () => { const c = E.readCode(U.codeMade); if (c && navigator.share) navigator.share({ title: 'Code Black class code', text: codeText(c) }).catch(() => {}); },
  codePlay: a => {
    const c = E.readCode(a || U.codeIn); if (!c) { res({ ok: false, why: 'That code doesn’t look right. It’s six letters and numbers, like ABC-DEF.' }); return; }
    if (c.stale) { res({ ok: false, why: staleWhy(c) }); return; }
    U.mode = c.mode; U.scen = c.scen; U.pack = c.pack; store('oc-mode', c.mode); store('oc-scen', c.scen); store('oc-pack', c.pack);
    U.sheet = null; start(c.level, null, null, c);
  },
  cbSend: at => {
    const d = lastReport(); if (!d || String(d.at) !== String(at) || !d.R.code || d.sent) return;
    U.cbSent = U.cbSent || {}; if (U.cbSent[at] === 'sending') return;   // one send at a time
    const name = cbSendable(U.cbName), focus = !!(document.activeElement && document.activeElement.id === 'cbName');
    U.cbBadName = U.cbBadName || {}; delete U.cbBadName[at];
    if (!name) { U.cbSent[at] = cbNameWhy(U.cbName); U.cbBadName[at] = 1; cbRedraw(true); return; }
    if (!d.cid) { d.cid = cbUuid(); saveRep(d); }   // kept with the report, so a resend after a reload is the same result
    U.cbSent[at] = 'sending'; U.leaveAsk = null; cbRedraw();
    const R = d.R, WHY = { unknown: `${R.code} isn’t set up for class results: its class may have ended, or been made on another version of the game. Show your instructor this summary instead.`, busy: CB_BUSY };
    const back = () => focus && (!document.activeElement || document.activeElement === document.body);   // focus comes back only if the student hasn't moved on
    cbRpc('cb_submit', cbArgs(R, name, d.cid)).then(r => {
      if (r.ok) { d.sent = true; saveRep(d); U.cbSent[at] = 'sent'; U.cbName = ''; cbRedraw(); return; }   // the next student on this device starts with an empty box
      if (r.error === 'invalid' && r.field === 'name') U.cbBadName[at] = 1;   // only a refused name marks the box invalid (audit R4.9-11)
      U.cbSent[at] = r.error === 'invalid' ? (r.field === 'name' ? 'The server didn’t accept that name. Try your initials, like S.K.' : `The server turned this result down (${String(r.field || 'data').slice(0, 12)}). Show your instructor this summary instead.`)
        : r.error === 'full' ? (r.scope === 'class' ? 'This class has all the results it can take (500). Tell your instructor.' : CB_FULL) : WHY[r.error] || 'The server turned this result down.';
      cbRedraw(back());
    }).catch(e => { U.cbSent[at] = cbNet(e); cbRedraw(back()); });
  },
  cbOpen: () => { U.cbOpen = true; U.cbForm = U.cbForm || {}; U.focusTo = '#cbCode'; },   // the box takes the focus (audit R4.9-03)
  cbKeyVis: () => { U.cbKeyVis = !U.cbKeyVis; },
  cbShow: a => {
    let code, key, rem = true;
    if (a) { code = cbCodeNorm(a); key = cbKeyOf(code); }
    else { if (!U.cbOpen) return; const F = U.cbForm || {}; code = cbCodeNorm(F.code); key = cbKeyNorm(F.key); rem = !!F.rem; }
    if (!code) { U.cbList = { err: 'A class code is six letters and numbers, like ABC-DEF.' }; return; }
    if (!key) { U.cbList = { code, err: 'An instructor key is 16 letters and numbers. It’s on the device that made the code.' }; return; }
    const seq = U.cbSeq = (U.cbSeq || 0) + 1, prev = U.cbList && U.cbList.code === code && U.cbList.rows ? U.cbList : null, typed = !a;
    U.cbList = { code, key, typed, exp: prev && prev.exp, rows: prev && prev.rows, loading: true };   // the old list stays while the new one loads: no jump to the top
    if (!prev) cbScroll('#cbLoad');
    cbRpc('cb_class_read', { p_code: code, p_key: key }).then(r => {
      if (seq !== U.cbSeq) return;   // a newer request, Close results, or Forget, since
      if (!typed && !cbKeys()[code] && !(U.reg && U.reg.code === code)) return;   // its key was forgotten while the answer was on its way
      if (Array.isArray(r.rows)) {
        const saved = cbKeys()[code];
        if (typed ? rem : saved) cbKeySave(code, { k: key, t: Date.parse(r.created) || (saved && saved.t) || Date.now(), e: Date.parse(r.expires) || 0, s: 1 });   // a typed key only if asked; a read confirms a registration and says when the class ends
        U.cbList = { code, key, typed, exp: r.expires, rows: r.rows.filter(x => x && typeof x === 'object') };
        if (typed) { U.cbOpen = false; U.cbForm = null; U.cbKeyVis = false; }
        if (!prev) cbScroll('#cbHead', 'start');
      } else if (r.error === 'busy' && prev) U.cbList = Object.assign({}, prev, { loading: false, err: CB_BUSY });   // a refused refresh keeps the list
      else {
        const saved = !typed && r.error === 'key' ? cbKeys()[code] : null;
        // an unused class in its hold isn't marked ended: a student's first result can still start it again, and Results checks (audit R5.10-01)
        const unused = saved && saved.e && saved.e - saved.t < 20 * 864e5 && Date.now() < saved.e + 30 * 864e5;
        if (saved && !unused) cbKeySave(code, Object.assign({}, saved, { x: 1, p: 0 }));   // this device's own key no longer opens it: the class has ended
        U.cbList = { code, typed, err: r.error === 'busy' ? CB_BUSY : saved ? `The server has no class for ${code} now: it ended, or its results were never set up. Turn results back on to use the code again.`
          : 'That code and key don’t match, or the class has ended (its results are deleted 30 days after the code was made, or 14 if nobody sent one, unless a student’s first result started it again).' };
        U.cbKeyVis = false; cbScroll('#cbErr');
      }
      render();
    }).catch(e => { if (seq !== U.cbSeq) return; U.cbKeyVis = false; U.cbList = { code, key, typed, exp: prev && prev.exp, rows: prev && prev.rows, err: cbNet(e) }; render(); cbScroll('#cbErr'); });
  },
  cbClose: () => { U.cbList = null; U.cbSeq = (U.cbSeq || 0) + 1; },
  cbDel: a => { const L = U.cbList; if (L && L.rows) { L.ask = a; L.askAt = Date.now(); L.delErr = null; U.focusTo = `${a === 'all' ? '#cbAskAll' : '#cbAskRow'} [data-act="cbDelNo"]`; cbScroll(a === 'all' ? '#cbAskAll' : '#cbAskRow'); } },   // the focus goes to Keep, never to another student's ✕ (audit R4.10-03)
  cbDelNo: () => { const L = U.cbList; if (L && L.ask) U.focusTo = `#sheet [data-act="cbDel"][data-arg="${L.ask}"]`; if (L) L.ask = null; },
  cbDelGo: a => {
    const L = U.cbList; if (!L || !L.key || L.ask !== a || Date.now() - (L.askAt || 0) < 450) return;   // a double tap on ✕ doesn't also tap Delete
    L.ask = null; L.err = null; L.delErr = null; L.deleting = a; const all = a === 'all'; U.focusTo = '#cbHead';
    const fail = (now, msg) => { if (!now) return; if (all) { now.err = msg; cbScroll('#cbErr'); } else { now.delErr = { id: a, msg }; cbScroll('#cbDelErr'); } };   // the message where the finger is
    cbRpc('cb_class_delete', all ? { p_code: L.code, p_key: L.key, p_all: true } : { p_code: L.code, p_key: L.key, p_id: a, p_all: false }).then(r => {
      const now = U.cbList && U.cbList.code === L.code ? U.cbList : null; if (now) now.deleting = null;
      U.focusTo = '#cbHead';   // the answer redraws the heading: the focus goes back to it, not to the page (audit R4.11-01)
      if (typeof r.deleted === 'number') {
        if (now && now.rows) now.rows = all ? [] : now.rows.filter(x => x.id !== a);   // removed in place: the list keeps its scroll
        res({ ok: true, msg: r.deleted === 1 ? 'Deleted 1 result' : `Deleted ${r.deleted} results` });
      } else {
        if (r.error === 'key') {   // the class has ended since the list opened: the server deleted its results, and the list is only this screen's copy (audit R4.9-04)
          const sv = cbKeys()[L.code]; if (sv) cbKeySave(L.code, Object.assign({}, sv, { x: 1, p: 0 }));
          if (now) now.ended = true;
        }
        fail(now, 'Nothing was deleted. ' + (r.error === 'busy' ? CB_BUSY : r.error === 'key' ? 'The class has ended, and the server has deleted all its results.' : 'The server turned this down. Refresh and try again.'));
      }
      render();
    }).catch(e => { const now = U.cbList && U.cbList.code === L.code ? U.cbList : null; if (now) now.deleting = null; fail(now, 'Nothing was deleted. ' + cbNet(e)); render(); });
  },
  cbCopyTab: () => { const L = U.cbList; if (!L || !L.rows) return; copyText(cbTable(L).map(r => r.map(cbCell).join('\t')).join('\n')).then(ok => { res(ok ? { ok: true, msg: 'Copied the table. Paste it into a spreadsheet.' } : { ok: false, why: 'Copy didn’t work here. Use Download CSV.' }); render(); }); },
  cbCsv: () => {
    const L = U.cbList; if (!L || !L.rows) return;
    const cell = v => { const t = cbCell(v); return /[",]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const url = URL.createObjectURL(new Blob(['\ufeff' + cbTable(L).map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `code-black-${L.code}.csv`; link.addEventListener('click', e => e.stopPropagation());   // not a tap outside the sheet
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  shareResult: () => {
    const d = lastReport(); if (!d) return; const R = d.R, L = E.LEVELS[R.level];
    const t = `ED: Code Black${R.code ? ' · class ' + R.code : ''} · ${R.mode === 'md' ? 'Attending' : 'Charge nurse'}, ${L.name}${R.scen && R.scen !== 'none' ? ', ' + E.SCENS[R.scen].name : ''} · ${R.mode === 'md' && R.own ? `clinical ${R.own.clinical}%, diagnoses ${R.own.dx == null ? '—' : R.own.dx + '%'}, radio ${R.own.radio == null ? '—' : R.own.radio + '%'}, legal ${R.own.legal}%` : R.sc ? `patients ${R.sc.patients == null ? '—' : R.sc.patients + '%'}, clinical ${R.sc.clinical}%, admin ${R.sc.admin}%, staff ${R.sc.staff}%` : R.care + ' points'} ${'★'.repeat(R.stars)}${'☆'.repeat(3 - R.stars)}${R.realSec ? ' · ' + realTxt(R) : ''}`;
    if (navigator.share) navigator.share({ title: 'Code Black shift summary', text: t }).catch(() => {}); else copyText(t).then(ok => { res(ok ? { ok: true, msg: 'Copied your result' } : { ok: false, why: t }, true); render(); });
  },
  legend: () => { U.sheet = U.sheet && U.sheet.type === 'legend' ? null : { type: 'legend' }; },
  msgs: () => { U.sel = null; U.sheet = U.sheet && U.sheet.type === 'msgs' ? null : { type: 'msgs', nw: U.msgNew || 0 }; U.msgNew = 0; },
  lesson: k => { if (LESSONS[k]) start('train', k); },
  lessonNext: () => { const k = lessonKey(), nx = k ? LESSON_KEYS[LESSON_KEYS.indexOf(k) + 1] : null; if (k) store('oc-lesson-' + k, '1'); if (nx) start('train', nx); else showTitle(); },
  recheck: a => { const [pid, sid] = a.split('|'); res(E.recheck(pid, sid)); },
  gray: a => { const [pid, k] = a.split('|'); res(E.grayDispo(pid, k), true); },
  upd: pid => res(E.updatePt(pid)),
  updWait: () => res(E.updateWaiting()),
  fcp: () => res(E.fullCapacity(), true),
  triAssign: a => { const [pid, sid] = a.split('|'); const r = E.triage(pid, sid), p = E.pt(pid); res(r, !(p && p.reg === 'none' && p.loc !== 'gone')); },
  toWait: pid => { const r = E.toWaiting(pid); if (r.ok) U.sel = null; res(r, true); },
  sendUp: a => { const [pid, sid] = a.split('|'); res(E.sendUp(pid, sid), true); },
  ift: a => { const [pid, k] = a.split('|'); res(E.bookIFT(pid, k), true); },
  hospOpen: pid => { U.sel = null; U.sheet = { type: 'hosp', pid }; },
  callHosp: a => { const [pid, k] = a.split('|'); const r = E.callHosp(pid, k); res(r, false); if (r.ok) U.sheet = { type: 'pt', pid }; },
  giveRep: pid => res(E.giveReport(pid), true),
  txInst: pid => { const r = E.txInstead(pid); res(r, false); if (r.ok) U.sheet = { type: 'hosp', pid }; },
  helpCall: a => { const [pid, k] = a.split('|'); res(E.helpCall(pid, k), true); },
  bedsOpen: () => { U.sel = null; U.sheet = { type: 'beds' }; },
  watchPad: () => { U.sheet = null; U.sel = null; watchPad(); },
  weather: k => { U.wx = E.WX[k] ? k : 'clear'; store('oc-wx', U.wx); setH($('#title'), titleHTML()); },
  prov: id => { const s = E.staff(id); if (MD() || (s && s.pit)) { U.sheet = { type: 'staff', sid: id }; return; } U.sel = U.sel && U.sel.type === 'prov' && U.sel.sid === id ? null : { type: 'prov', sid: id }; },
  zone: z => { if (MD() && z !== 'triage') { toast('The charge nurse runs nursing assignments.', 'info'); return; } U.sheet = { type: 'zone', z }; },
  cluster: k => {   // the line at the door, the wall, or the waiting room
    const G = g(), s = U.sel;
    if ((k === 'door' || k === 'wall') && s && (s.type === 'reg' || s.type === 'tri') && !MD()) {   // send them to the next person who needs it
      const list = k === 'door' ? G.triageQ.map(E.pt).filter(Boolean) : wallPts();
      for (const p of list) {
        const out = s.type === 'reg' ? (p.reg === 'none' ? E.register(p.id, s.sid) : { ok: false }) : (p.tri === 'none' ? E.triage(p.id, s.sid) : { ok: false });
        if (out.ok) { sfx('tap'); return; }
      }
      const where = k === 'door' ? 'at the door' : 'on the wall';
      toast(s.type === 'reg' ? `Nobody ${where} needs registering` : `Nobody ${where} needs ${k === 'door' ? 'triage' : 'report taken'}`, 'info'); return;
    }
    U.sheet = { type: 'zone', z: 'triage', at: k };
  },
  zoom: k => { mapZoom(k === 'in' ? 1.5 : k === 'out' ? 1 / 1.5 : 0); },
  needNext: () => {   // jump to the next thing that needs the player: exactly the one the button names
    const G = g(), list = needOn(G) ? needList(G) : [];
    const t = TR(); if (t) t.nx = (t.nx || 0) + 1;
    if (!list.length) { toast('Nothing is waiting on you right now', 'good'); return; }
    needGo(needPick(list));
  },
  needGo: id => { const G = g(), it = (needOn(G) ? needList(G) : []).find(x => String(x.id) === String(id)); if (it) needGo(it); else U.sheet = null; },
  queue: () => { U.sel = null; U.sheet = U.sheet && U.sheet.type === 'queue' ? null : { type: 'queue' }; },
  boxTap: () => { const b = $('#boxbar .bx-btn'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b.dataset.arg, b); else { const c = g().box.cur; toast(!c ? 'The Box is quiet' : c.kind === 'notify' ? (MD() ? 'An alert report. The charge nurse is taking it.' : 'An alert report is coming in') : 'A doctor is on the line with the medic', 'info'); } },
  fullscreen: () => {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement) { d.exitFullscreen(); return; }
    if (!el.requestFullscreen) { toast('Full screen isn’t available in this browser', 'info'); return; }
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (U.view === 'map' && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => toast('Full screen isn’t available here', 'info'));
  },
  team: () => { U.sheet = { type: 'team' }; },
  staffOpen: id => { U.sheet = { type: 'staff', sid: id }; },
  closeSheet: () => { U.sheet = (U.sheet && U.sheet.back) || null; },
  words: () => { if (!(U.sheet && U.sheet.type === 'words')) { U.wq = ''; U.sheet = { type: 'words', back: U.sheet || null }; } },
  selCancel: () => { U.sel = null; },
  ptCard: pid => { U.sel = null; U.sheet = { type: 'pt', pid }; },
  selInfo: () => { const s = U.sel; if (!s) return; U.sheet = s.type === 'prov' ? { type: 'staff', sid: s.sid } : { type: 'pt', pid: s.pid }; },
  boxAnswer: () => {
    const c = g().box.cur; if (!c) return;
    if (c.kind === 'notify') { if (MD()) return; const r = E.boxNotify(); if (r.ok) { toast(r.msg, 'good'); sfx('good'); } }
    else if (c.taken) return;
    else if (MD()) { const r = E.boxTake(g().me); if (!r.ok) { toast(r.why, 'bad'); return; } U.sheet = null; U.modal = { type: 'scen', sc: r.sc, unit: r.unit, doc: 'You', pack: r.pack, opt: r.sc.opts ? shuf(r.sc.opts.map((x, i) => i)) : null }; }
    else U.sheet = { type: 'boxdoc' };
  },
  boxDoc: sid => { const r = E.boxTake(sid); if (!r.ok) { toast(r.why, 'bad'); return; } U.sheet = null; toast(`${E.staff(sid).name} is on the line with ${r.unit} and will give the orders`, 'good'); sfx('good'); },
  scen: a => { const r = E.boxDecide(a[0] === 'o' ? Number(a.slice(1)) : a === '1'); U.modal = r ? { type: 'result', r } : null; if (r) sfx(r.ok ? 'good' : 'bad'); },
  modalOk: () => { U.modal = null; },
  firstHelp: () => { U.modal = null; U.paused = true; U.sheet = { type: 'help' }; },
  firstTrain: () => { U.modal = null; start('train'); },
  card: k => { E.chooseCard(k); },
  assign: sid => { const s = U.sheet, r = E.assign(sid, s && s.pid); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : 'bad'); if (r.ok) U.sheet = null; },
  consultOpen: pid => { U.sheet = { type: 'consult', pid }; },
  consultPhone: () => { const pid = U.sheet && U.sheet.pid, r = E.consult(pid, 'hosp', { phone: true }); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : r.mad ? 'mad' : 'bad'); U.sheet = r.ok ? null : { type: 'pt', pid }; },
  consultSpec: spec => { const pid = U.sheet && U.sheet.pid, r = E.consult(pid, spec); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : r.mad ? 'mad' : 'bad'); U.sheet = r.ok ? null : { type: 'pt', pid }; },
  dc: pid => res(E.discharge(pid), true),
  dcRehab: pid => res(E.dischargeRehab(pid), true),
  ucDo: a => { const [tid, sid] = String(a).split('|'); res(E.ucDo(tid, sid), true); },
  ucOpen: sid => { U.sel = null; U.sheet = { type: 'uc', sid }; },
  tx: pid => res(E.requestTransfer(pid), true),
  esc: pid => res(E.escalate(pid)),
  stat: pid => res(E.toggleStat(pid)),
  mtp: pid => { const r = E.activateMTP(pid); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : 'bad'); if (r.ok) sfx('good'); },
  oneg: pid => res(E.releaseONeg(pid)),
  interp: pid => res(E.requestInterp(pid)),
  override: pid => res(E.overrideRx(pid)),
  pit: a => { const [sid, on] = a.split('|'); res(E.setPit(sid, on === '1')); },
  moveSel: pid => { U.sel = { type: 'move', pid }; U.sheet = null; },
  placeSel: pid => { U.sel = { type: 'pt', pid }; U.sheet = null; },
  provOpen: pid => { U.sheet = { type: 'prov', pid }; },
  brk: sid => res(E.sendBreak(sid)),
  zt: a => { const [sid, z] = a.split('|'); res(E.toggleZone(sid, z)); },
  zclose: z => res(E.setZoneClosed(z, true)),
  zopen: z => res(E.setZoneClosed(z, false)),
  agency: z => res(E.callAgency(z)),
  pizza: () => res(E.orderPizza()),
  yellow: () => { U.sheet = { type: 'divert' }; },
  divertSet: a => { const [k, on] = a.split('|'); res(E.setDivert(k, on === '1')); },
  pause: () => { U.paused = !U.paused; if (U.paused) { U.sheet = null; save(true); hush(); } },   // the menu: it closes any open card so it can show
  resume: () => { U.paused = false; },
  speed: () => { U.speed = SPEEDS[(SPEEDS.indexOf(U.speed) + 1) % SPEEDS.length]; toast(`${U.speed}× speed`, 'info'); },
  plain: () => { store('oc-plain', PLAIN() ? '0' : '1'); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  sound: () => { U.sound = !U.sound; store('oc-sound', U.sound ? '1' : '0'); if (U.sound) ensureAudio(); else hush(); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  help: () => { U.sheet = { type: 'help' }; },
  pack: k => { U.pack = k; store('oc-pack', k); setH($('#title'), titleHTML()); },
  start: lvl => { start(lvl); U.startGuard = performance.now() + 600; },   // QA-18: the second tap of a double tap doesn't land on the new board
  resumeSave: () => resumeSave(),
  restart: () => { const now = performance.now(); if (!U.armR || now - U.armR > 3000) { U.armR = now; render(); return; } U.armR = 0; start(U.lvl); },
  menu: () => { if (unsentGuard()) return; save(true); showTitle(); },
  // From the report: one tap runs the same shift again (a class shift as the same class shift). A class code from another version
  // can't be replayed: say so instead of quietly starting a different shift.
  again: () => { if (unsentGuard()) return; U.armR = 0; const R = lastReport(), c = R && R.R && R.R.code ? E.readCode(R.R.code) : null; if (R && R.R && R.R.code && (!c || c.stale)) { res({ ok: false, why: `Class code ${R.R.code} was made on another version of the game, so it can’t be replayed. Ask your instructor for a new code.` }); return; } start(U.lvl, null, null, c); },
  lastReport: () => showLastReport(),
  pill: k => toast((g() && g().mode === 'md' && PILL_HELP_MD[k]) || PILL_HELP[k], 'info'),
};
const PILL_HELP = {   // v0.25
  pat: 'Patients: how they feel about the visit. Long waits with no update pull it down. Leaving without being seen hurts most.',
  clin: 'Clinical: the right care at the right time. Time goals, right calls and safe staffing raise it. Harm, misses and returns lower it.',
  adm: 'Admin: flow and cost. Moving patients and offloading ambulances raise it. Walkouts, wall time, needless diverts and extra costs lower it.',
  staff: 'Staff: average morale. Breaks help. Over-ratio pods and mandates hurt. Below 20% the staff walk out.',
};
const PILL_HELP_MD = {   // the attending's own four (Phase 6, R5-03): these set the attending's stars
  pat: 'Clinical: your own patients. The right orders on time and the right call raise it. Misses, harm and slow care lower it.',
  clin: 'Diagnoses: how many you have called. How many were right shows at the end of the shift, and counts toward your stars.',
  adm: 'Radio: medical-direction calls you answered right. A call that rings out counts as wrong. Blank until the first call.',
  staff: 'Legal: 100 minus your legal risk. Harm, missed must-not-miss diagnoses and deaths raise the risk.',
};

/* ---------- save and resume (this device only) ---------- */
function save(force) {
  const G = g();
  if (U.scene !== 'game' || !G || G.over) return;
  const now = Date.now();
  if (!force && now - U.lastSave < 15000) return;
  U.lastSave = now;
  let txt;
  try { txt = JSON.stringify({ G, lvl: U.lvl, pack: G.pack, at: now, ver: GAME_V }); } catch (e) { return; }
  if (txt.length > SAVE_MAX) { if (!U.saveBig) { U.saveBig = true; toast('This shift is too big to save on this device. Finish it here.', 'bad'); } return; }   // R3-18: a hard ceiling (a full shift is about 0.3 MB)
  try { localStorage.setItem('oc-save', txt); } catch (e) { /* storage full or blocked */ }
}
// R1-07 / R3-09: a save is checked before it is offered or loaded, so a broken or foreign save can't trap the player on the menu or
// freeze the game on Resume. MIGRATE[v] turns an older save format into v + 1; none exists yet (every save since v0.20 is format 5).
const SAVE_MAX = 3e6, SAVE_V = 5, MIGRATE = {};
function saveShape(G) {
  return !!(G && typeof G === 'object' && G.v === SAVE_V && typeof G.t === 'number' && isFinite(G.t) && G.pts && typeof G.pts === 'object' && !Array.isArray(G.pts)
    && Array.isArray(G.order) && Array.isArray(G.rooms) && Array.isArray(G.staff) && G.stats && typeof G.stats === 'object' && G.rng != null && E.LEVELS[G.level]);
}
function migrateSave(d) {
  if (!d || !d.G) return null;
  for (let n = 0; d.G.v !== SAVE_V && MIGRATE[d.G.v] && n < 10; n++) d.G = MIGRATE[d.G.v](d.G);
  return saveShape(d.G) ? d : null;
}
// v0.29.1: saves carry the version. A class shift saved on another version is not resumed: it would no longer be the class's shift.
function readSave() { try { const s = localStorage.getItem('oc-save'); if (!s) return null; const d = migrateSave(JSON.parse(s)); return d && !d.G.over && !(d.G.code && d.ver !== GAME_V) ? d : null; } catch (e) { return null; } }
// Round 3 (R3.3-03): a class shift saved on another version can't resume (the shift would change). The main menu says so, in full, until
// the player taps Got it (a toast was cut off on a phone and gone in 3 seconds).
function staleClassSave() {
  try { const d = JSON.parse(localStorage.getItem('oc-save') || 'null'); return d && d.G && !d.G.over && d.G.code && d.ver !== GAME_V ? d : null; } catch (e) { return null; }
}
function staleClassHTML() {
  const d = staleClassSave(); if (!d) return '';
  return `<div class="t-note" role="status"><p>Your class shift (code <b>${esc(d.G.code)}</b>) was saved on ${d.ver ? 'v' + esc(d.ver) : 'an older version'} and can’t continue on v${GAME_V}: the shift would change. Ask your instructor for a new code made on v${GAME_V}.</p><button type="button" data-act="staleOk">Got it</button></div>`;
}
function resumeSave() {
  const d = readSave(); if (!d) { toast('No saved shift on this device', 'bad'); return; }
  try {
    backTrap(); E.load(d.G); U.lvl = d.lvl; U.mode = d.G.mode || 'rn'; U.scene = 'game'; U.sel = null; U.sheet = null; U.modal = null; U.paused = true; U.speed = 1; U.msgs = []; U.msgNew = 0;
    $('#title').hidden = true; $('#report').hidden = true;
    render();
  } catch (e) {   // a save that loads but can't be drawn: drop it rather than fail again on every Resume
    try { console.error('Saved shift could not be opened:', e); } catch (x) { /* no console */ }
    store('oc-save', null); U.scene = 'title'; showTitle(); toast('That saved shift couldn’t be opened, so it was removed. Start a new one.', 'bad');
  }
}

/* ---------- scenes ---------- */
const DOT = { easy: 'var(--e4)', med: 'var(--e3)', hard: 'var(--e1)', rush: '#7B4A9E' };
const BLURB_MD = { easy: 'Fewer patients, fewer radio calls. Learn the orders.', med: 'A normal busy day. The radio keeps ringing.', hard: 'Sicker patients, all at once. Good luck.' };
function bestOf(l, mode) { return +(store('oc-best4-' + ((mode || U.mode) === 'md' ? 'md-' : '') + l) || 0); }   // v0.25: the best average of the four scores
const trainedKey = mode => (mode === 'md' ? 'oc-trained-md' : 'oc-trained');
const IOS_TIP = /iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone && !document.fullscreenEnabled;
function titleHTML() {
  const md = U.mode === 'md';
  const fresh = !['easy', 'med', 'hard'].some(k => bestOf(k));
  const modes = `<p class="t-role" id="roleLab">Select role:</p><div class="modes" role="group" aria-labelledby="roleLab"><button type="button" class="mode${md ? '' : ' on'}" data-act="mode" data-arg="rn" aria-pressed="${!md}"><b>Charge nurse</b><small>Manage ED flow</small></button><button type="button" class="mode${md ? ' on' : ''}" data-act="mode" data-arg="md" aria-pressed="${md}"><b>Attending</b><small>See patients, write orders</small></button></div>`;
  const tb = (md ? 'A preceptor walks you through it.' : E.LEVELS.train.blurb) + ' A teaching game, not clinical guidance.';   // QA-7: Orientation is reachable from the main menu too
  const chM = md ? 'md' : 'rn', chN = chList(chM).length, chD = chList(chM).filter(c => chDone(chM, c.k)).length;   // once a chapter is done, the row opens the chapter list
  const train = `<button type="button" class="lvl train" ${chD ? 'data-act="chapters"' : 'data-act="start" data-arg="train"'}><span class="dot" style="background:var(--accent)"></span><span><b>${E.LEVELS.train.name}</b><small>${tb}</small></span>${store(trainedKey(U.mode)) ? '<span class="best">Done ✓</span>' : chD ? `<span class="best">${chD} of ${chN}</span>` : fresh ? '<span class="best go">Start here</span>' : ''}</button>`;
  const nL = LESSON_KEYS.filter(lessonDone).length;
  const lessons = `<button type="button" class="lvl lsn" data-act="lessons"><span class="dot" style="background:#0D716E"></span><span><b>Lessons</b><small>Next: manage disease-specific conditions like chest pain, stroke and sepsis.</small></span>${nL ? `<span class="best">${nL} of ${LESSON_KEYS.length} ✓</span>` : ''}</button>`;
  const lv = ['rush', 'easy', 'med', 'hard'].map(k => { const L = E.LEVELS[k], b = bestOf(k), st = b ? E.scoreStars(b) : 0; return `<button type="button" class="lvl" data-act="start" data-arg="${k}"><span class="dot" style="background:${DOT[k]}"></span><span><b>${L.name}</b><small>${md && BLURB_MD[k] ? BLURB_MD[k] : L.blurb}</small></span>${b ? `<span class="best">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>` : ''}</button>`; }).join('');
  const sv = readSave();
  const resume = sv ? `<button type="button" class="lvl resume" data-act="resumeSave"><span class="dot" style="background:var(--accent)"></span><span><b>Resume your shift</b><small>${sv.G.mode === 'md' ? 'Attending' : 'Charge nurse'}: ${sv.G.tr && LESSONS[sv.G.tr.lesson] ? 'Lesson: ' + esc(LESSONS[sv.G.tr.lesson].name) : esc(E.LEVELS[sv.lvl] ? E.LEVELS[sv.lvl].name : '')}, paused at ${E.clock(sv.G.t)}</small></span></button>` : '';
  const scens = `<div class="packs scn"><span id="scnLab">Scenario<i class="scn-for"> (for class or practice)</i></span><div class="segs s5">${Object.entries(E.SCENS).map(([k, S]) => `<button type="button" class="seg${U.scen === k ? ' on' : ''}" data-act="scenario" data-arg="${k}" aria-pressed="${U.scen === k}">${k === 'none' ? 'None' : esc(S.name)}</button>`).join('')}</div><select class="scn-sel" data-pick="scenario" aria-labelledby="scnLab">${Object.entries(E.SCENS).map(([k, S]) => `<option value="${k}"${U.scen === k ? ' selected' : ''}>${k === 'none' ? 'None' : esc(S.name)}</option>`).join('')}</select><small>${esc(E.SCENS[U.scen].blurb)}${U.scen !== 'none' ? ' <span class="scn-note">Not counted in your bests.</span>' : ''}</small></div>`;
  const packs = Object.entries(E.PACKS).map(([k, P]) => `<button type="button" class="seg${U.pack === k ? ' on' : ''}" data-act="pack" data-arg="${k}" aria-pressed="${U.pack === k}">${esc(P.name)}</button>`).join('');
  const brand = `<div class="t-kicker">Emergency Department</div><h1 class="t-brand">Code Black</h1><svg class="t-under" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 6 L297 6" stroke="#C8243A" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  const head = (t, s) => `<div class="t-head"><button type="button" class="t-back" data-act="tmenu" data-arg="main" aria-label="Back to the menu">‹ Back</button><h2>${t}</h2>${s ? `<p class="t-sub">${s}</p>` : ''}</div>`;
  const row = (arg, dot, name, sub, badge) => `<button type="button" class="lvl t-go" data-act="tmenu" data-arg="${arg}"><span class="dot" style="background:${dot}"></span><span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span>${badge || ''}<span class="t-chev" aria-hidden="true">›</span></button>`;
  const set = (act, label, on) => `<button type="button" class="t-set" data-act="${act}"><span>${label}</span><b>${on}</b></button>`;
  const role = md ? 'Attending' : 'Charge nurse';
  if (U.tm === 'about') return aboutHTML(store('oc-seen-about') ? head('About Code Black') : '');
  const wxs = `<div class="packs wxp"><span id="wxLab">Weather</span><div class="segs s5">${Object.entries(E.WX).map(([k, W]) => `<button type="button" class="seg${(U.wx || 'clear') === k ? ' on' : ''}" data-act="weather" data-arg="${k}" aria-pressed="${(U.wx || 'clear') === k}">${esc(W.name.split(' ')[0])}</button>`).join('')}</div><select class="wx-sel" data-pick="weather" aria-labelledby="wxLab">${Object.entries(E.WX).map(([k, W]) => `<option value="${k}"${(U.wx || 'clear') === k ? ' selected' : ''}>${esc(W.name)}</option>`).join('')}</select><small>${esc(E.WX[U.wx || 'clear'].blurb)}</small></div>`;
  if (U.tm === 'play') return `<div class="card t-sub-menu">${head('Play a shift', role + ', 07:00 to 19:00. <small class="t-warn">A teaching game, not clinical guidance. No licensed clinician has reviewed it yet.</small>')}<div class="levels">${lv}<button type="button" class="lvl t-go cc-go" data-act="classCode"><span class="dot" style="background:#4F5A6B"></span><span><b>Class code</b><small>Play your instructor's shift, or make one for a class.</small></span><span class="t-chev" aria-hidden="true">›</span></button></div>${scens}${wxs}${md ? `<div class="packs"><span>Medical direction calls</span><div class="segs">${packs}</div><small>${esc(E.PACKS[U.pack].note)}</small></div>` : ''}</div>`;
  if (U.tm === 'learn') return `<div class="card t-sub-menu">${head('Learn', 'Start with the introductory orientation. Then learn to manage disease-specific conditions. <small class="t-warn">A teaching game, not clinical guidance. Written with AI: <b>no licensed clinician has reviewed it yet</b>.</small>')}<div class="levels">${train}${lessons}</div><div class="t-links"><button type="button" data-act="help">How to play</button><button type="button" data-act="words">What the words mean</button></div></div>`;
  if (U.tm === 'set') return `<div class="card t-sub-menu">${head('Settings')}<div class="t-sets">${set('view', 'Board', U.view === 'map' ? 'floor plan' : 'list')}${U.view === 'map' ? set('three', 'Floor', U.three ? '3D' : 'flat') : ''}${U.view === 'map' && U.three ? set('q3d', '3D detail', Q3D_NAME[U.q3d]) : ''}${set('sound', 'Sound', U.sound ? 'on' : 'off')}${set('plain', 'Plain words', PLAIN() ? 'on' : 'off')}${document.fullscreenEnabled && matchMedia('(pointer: coarse)').matches ? set('fullscreen', 'Full screen', document.fullscreenElement ? 'on' : 'off') : ''}</div>${IOS_TIP ? '<p class="t-tip">On an iPhone, add this page to your Home Screen (Share, then Add to Home Screen) to play full screen.</p>' : ''}</div>`;
  const stars = ['easy', 'med', 'hard'].reduce((n, k) => n + (bestOf(k) ? E.scoreStars(bestOf(k)) : 0), 0);
  const learnBadge = store(trainedKey(U.mode)) ? '<span class="best">Done ✓</span>' : chD ? `<span class="best">${chD} of ${chN}</span>` : fresh ? '<span class="best go">Start here</span>' : '';
  const play = row('play', DOT.med, 'Play a shift', 'Four shifts, plus class scenarios.', stars ? `<span class="best">${stars} ★</span>` : '');
  const learn = row('learn', 'var(--accent)', 'Learn', 'Introductory orientation, then managing disease-specific conditions.', learnBadge);
  return `<div class="card t-main">${staleClassHTML()}${brand}${modes}<p class="t-sub">${md ? 'You see patients, write the orders, and answer the radio.' : 'You manage the flow of a 32-bed ED.'}</p>${rankLine(U.mode)}<div class="levels">${resume}${fresh ? learn + play : play + learn}${row('set', '#6B7280', 'Settings', '')}</div><div class="t-links"><button type="button" data-act="help">How to play</button>${lastReport() ? '<button type="button" data-act="lastReport">Last summary</button>' : ''}<button type="button" data-act="tmenu" data-arg="about">About</button></div></div>`;
}
function clearToasts() { const b = $('#toasts'); if (b) b.innerHTML = ''; TQ.length = 0; clearTimeout(toastPump.t); msgOn(false); }
/* ---------- the first-visit page (v0.22): what this is, who it's for, privacy, credits. Later it's About on the menu. ---------- */
function aboutHTML(head) {
  const first = !head;
  const imgs = Object.entries(IMG_CREDIT).map(([k, c]) => `<li>${c.f ? `<i>${esc(c.f.replace(/\.(jpe?g|png)$/i, ""))}</i>. ` : ""}${esc(c.t)}${c.u ? ` <a href="${esc(c.u)}" target="_blank" rel="noopener">source</a>` : ''}${c.l ? ` <a href="${esc(c.l)}" target="_blank" rel="noopener">licence</a>` : ''}</li>`).join('');
  return `<div class="card t-sub-menu t-about">${head || '<div class="t-kicker">Emergency Department</div><h1 class="t-brand">Code Black</h1>'}`
    + `<p class="ab-lead">Run a busy ER for one twelve-hour shift.</p>`
    + `<p>Be the <b>charge nurse</b>: beds, staff, ambulances, the radio. Or the <b>attending</b>: see patients, order tests, make the call.</p>`
    + `<h3>Who it’s for</h3><p>Nurses, doctors, medics, students, and anyone curious. No medical background needed. Orientation teaches you.</p>`
    + `<h3>A game, not a protocol</h3><p>It’s a teaching game and isn’t clinical guidance. At work, follow your own protocols. It was written with AI, and <b>no licensed clinician has reviewed its clinical content yet</b>.</p>`
    + `<h3>Privacy</h3><p>No accounts, ads, or tracking. Your shifts, progress and settings stay on this device.</p>`
    + `<p><b>Class results.</b> After a class-code shift, <b>Send</b> sends:</p><ul class="ab-list">`
    + `<li><b>You:</b> your first name or initials (not kept on this device).</li>`
    + `<li><b>Your result:</b> the class code, role, shift, score, stars, minutes played, how much was sped up, and whether and when the shift ended early (fired, or the staff walked out).</li>`
    + `<li><b>The department:</b> mean door-to-provider wait, arrivals, patients who left without being seen or against advice, patients bedded before registration, and deaths.</li>`
    + `<li><b>An attending’s own work:</b> patients seen, how many died (and how many of those after a code run by the book), how many were left in cardiac arrest at the end 5+ minutes with no code running, diagnoses right and wrong, unsafe and unneeded orders, complications, and radio calls right, wrong and missed.</li>`
    + `<li><b>Bookkeeping:</b> the game version, a random id for the result, and the time it arrived.</li></ul>`
    + `<p><b>Who sees it:</b> in the game, only the instructor who made the code, with its instructor key. The game’s developer runs the database (on Supabase, in the US) and can see it too. It’s used only to show the instructor the class’s results; copies the instructor makes are theirs.</p>`
    + `<p><b>How long:</b> deleted when the class ends: 30 days after the code was made, or, for a code first used more than 14 days after it was made, 30 days after that first result. Either way, within 30 days of the class’s first result. <b>Sooner:</b> ask your instructor, who can delete any result${CB.contact ? `, or write to ${esc(CB.contact)}` : ''}.</p>`
    + `<p><b>Network addresses.</b> To stop floods of fake results, the database counts requests per network for up to two days, by a keyed hash that changes every day, never the address itself. Supabase’s own request logs also see the address, for the time its plan sets (a day on its free plan). The website itself is hosted on GitHub Pages, which, like any web host, logs the address of every visit.${gatedHost() ? ' On this private test site, opening the game checks the test password with the same database.' : ''}</p>`
    + `<details class="ab-cred"><summary>Credits</summary><p>3D people and animations from <a href="https://github.com/scottpetrovic/mesh2motion-app" target="_blank" rel="noopener">mesh2motion</a> (CC0). The rooms, furniture, ambulances and the department were built in Blender for this game. Drawn with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT) and meshoptimizer by Arseny Kapoulkine (MIT). Set in Cardo by David Perry (SIL Open Font License 1.1). Their notices are in <a href="THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">THIRD_PARTY_NOTICES.txt</a>. Medical images are resized and saved as JPEG (two are cropped); a CC BY-SA picture stays under that licence.</p><p>Medical images:</p><ul>${imgs}</ul></details>`
    + `<div class="levels"><button type="button" class="big act ab-go" data-act="aboutDone">${first ? 'Start' : 'Back to the menu'}</button></div></div>`;
}
function showTitle() {
  clearToasts(); hush();
  let wasTrain = false; try { wasTrain = U.scene === 'game' && !!(g() && g().train); } catch (e) { /* no game yet */ }
  U.tm = wasTrain ? 'learn' : (!store('oc-seen-about') && !navigator.webdriver ? 'about' : 'main');   // back from Orientation or a lesson: the Learn menu; a first visit: the welcome page (automated test browsers skip it)
  U.scene = 'title'; U.sel = null; U.sheet = null; U.modal = null; U.paused = false;
  E.newGame('med', 4242);
  for (let i = 0; i < 160; i++) { E.step(0.25); E.botStep({}); }
  $('#report').hidden = true;
  const t = $('#title'); t.hidden = false; setH(t, titleHTML());
  render();
}
const backTrap = () => { try { if (!(history.state && history.state.cb)) history.pushState({ cb: 1 }, ''); } catch (e) { /* history blocked */ } };   // QA-17
function start(lvl, lesson, chapter, code) {
  backTrap();
  U.cbName = '';   // a class result's name box starts empty for whoever plays next on this device
  ensureAudio();
  if (!LESSONS[lesson]) lesson = null;
  U.lvl = lvl; U.scene = 'game'; U.sel = null; U.sheet = null; U.modal = null; U.paused = false; U.speed = 1;
  U.needSeen = {}; U.needLast = null; U.needRing = null; U.msgs = []; U.msgNew = 0;
  store('oc-save', null);
  E.newGame(lvl, lvl === 'train' ? 20261116 : code ? code.seed : (Math.random() * 2147483647) | 0, { pack: U.pack, mode: lesson ? 'md' : U.mode, scen: lesson ? 'none' : U.scen, wx: lesson || code ? 'clear' : (U.wx || 'clear'), code: code ? code.code : null });
  if (lesson) g().tr.lesson = lesson;   // kept with the game, so a saved lesson resumes as that lesson
  else if (lvl === 'train' && chapter > 0) { const C = chList(chMode())[chapter]; if (C) { g().tr.step = C.at; g().tr.need = 1; } }   // a later chapter: the Next button is already known
  $('#title').hidden = true; $('#report').hidden = true;
  U.coachKey = null;
  try { if (mapZoomed()) mapZoom(0); } catch (e) { /* the floor is not drawn yet */ }   // a new shift starts with the whole floor in view
  const helpKey = 'oc-seen-help2' + (U.mode === 'md' ? '-md' : '');
  if (lvl !== 'train' && !store(helpKey)) { store(helpKey, '1'); U.modal = { type: 'first' }; }   // the full How to play is one tap away, and in the pause menu
  render();
  const sc = g().scen;
  if (sc && sc !== 'none' && E.SCENS[sc]) toast(`Scenario: ${E.SCENS[sc].name}. ${E.SCENS[sc].blurb}`, 'warn');   // first: on the floor plan messages show one at a time
  if (lvl !== 'train') toast(`${E.LEVELS[lvl].name}. ${U.mode === 'md' ? "You're on as the attending." : 'Night shift hands you the board.'}`, 'info');
}
const verdictOf = R => {   // the stars are the owner's scoring; the words mustn't praise what went wrong (audit R6.6-09, R5.8-05, R6.8-05)
  const m = R.mode === 'md' && R.md;
  if (m && !m.seen) return 'You saw no patients this shift: the stars come from the radio calls and the department the computer ran.';
  const d = m ? m.died || 0 : 0, cl = m ? m.codeLost || 0 : 0, hd = m ? m.handed || 0 : 0, left = m ? (m.arrestLeft || 0) + (m.codeLate || 0) : 0, see = (R.mm || []).length ? 'Read the M&M below.' : 'Read the worst moments below.';
  if (m && (d - cl - hd > 0 || left)) {   // a death after another doctor's prompt code isn't the student's (R6.11-03); a late code at the end is (R6.11-02)   // built from what happened, so one patient doesn't read as two (audit R4.9-07)
    const a = d ? `${d === 1 ? 'One of your own patients' : `${d} of your own patients`} died${cl ? ` (${cl === d ? (d === 1 ? 'after a code run by the book' : 'all after codes run by the book') : `${cl} after a code run by the book`})` : ''}` : '';
    const b = left ? (a ? `, and ${left === 1 ? 'one was' : `${left} were`}` : `${left === 1 ? 'One of your own patients was' : `${left} of your own patients were`}`) + ' still in cardiac arrest at the end, with no code running' : '';
    return `${a}${b}. ${see}`;
  }
  if (m && (cl || hd) && R.stars >= 2) return `${cl + hd === 1 ? 'A patient' : `${cl + hd} patients`} died after ${cl ? 'a code run by the book' : 'a code another doctor started at once'}${cl && hd ? ' or one another doctor started at once' : ''}: many arrests don’t come back, even when the code is run well.`;
  if (m && R.stars === 3) {   // name the sections to read (audit R4.9-07)
    const go = [m.dxWrong ? '<b>Diagnoses to review</b>, above' : '', (m.contra || m.unneeded || m.untreated) ? '<b>Orders to review</b>, below' : '', m.dispoWrong ? `your ${m.dispoWrong === 1 ? 'wrong disposition' : `${m.dispoWrong} wrong dispositions`}` : ''].filter(Boolean);
    if (go.length) return `Three stars. Now read ${go.length > 1 ? go.slice(0, -1).join(', ') + ' and ' + go[go.length - 1] : go[0]}.`;
  }
  return (R.mode === 'md' ? VERDICT_MD : VERDICT)[R.stars];
};
const VERDICT_MD = ['Rough one. Read the worst moments below, then try again.', 'Some good calls, and some to review below. Tomorrow will be better.', 'Solid shift. Your calls held up.', 'Attending of the year. The residents want to copy your orders.'];   // graded on the attending's own calls (Phase 6)
const VERDICT = ['Rough one. Read the worst moments below, then try again.', 'You kept the doors open. Tomorrow will be better.', 'Solid shift. The night charge owes you.', 'Charge nurse of the year. Somebody frame this board.'];
// The last summary, kept in storage so a reload brings it back. U.lastRep holds it too, so Send works when storage is full or blocked.
function lastReport() {
  let d = null; try { d = JSON.parse(store('oc-last-report') || 'null'); } catch (e) { d = null; }
  if (!(d && d.R && E.LEVELS[d.R.level])) d = null;
  return U.lastRep || d;   // memory is always the newest copy (storage can refuse a later write)
}
function saveRep(d) { U.lastRep = d; const ok = storeOk('oc-last-report', JSON.stringify(d)); if (!ok) U.repLost = d.at; return ok; }
// Leaving a class shift's summary with the result unsent: the first tap says so; a second tap leaves.
function unsentGuard() {
  if (U.scene !== 'report') return false;
  const d = lastReport(); if (!d || !d.R.code || d.R.level === 'train' || d.sent || U.leaveAsk === d.at) return false;
  U.leaveAsk = d.at; cbRedraw(); const box = $('#cbSendBox'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'center' }); return true;   // the warning sits in the Send box
}
/* Real time played, and how much of it at each speed. */
function realTxt(R) {
  const m = Math.floor(R.realSec / 60), s = R.realSec % 60, sp = R.spdSec || {}, tot = Object.values(sp).reduce((a, b) => a + b, 0) || 1;
  const parts = ['1', '2', '3', '4'].filter(k => sp[k] > 0.5).map(k => `${k}× ${Math.round(sp[k] / tot * 100)}%`);
  return `played in ${m}:${String(s).padStart(2, '0')}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
}
function reportHTML(R, ledger, at) {
  const L = E.LEVELS[R.level], led = ledger || g().ledger;
  const LED = { md: 'Patients you saw', orders: 'Orders', harm: 'Unsafe orders, complications and untreated patients', dispo: 'Disposition calls', flow: 'Patients moved', goals: 'Alert time goals', box: 'The Box', consult: 'Consults', lwbs: 'Left without being seen', ama: 'Left against advice', returns: '72-hour returns', wall: 'Wall time', ratio: 'Over-ratio nursing', uncovered: 'Uncovered patients', safety: 'Safety events', hall: 'Hallway beds', sitter: 'Missing sitters', waiting: 'Waiting-room crashes', admin: 'Administration <small>goals executives set, and requests you refused</small>', staffing: 'Staffing costs', divert: 'Divert', blood: 'Bleeding and blood', transfer: 'Transfers', gray: 'Gray-zone calls', chair: 'Admitted patients in chairs', experience: 'Complaints' };
  const rows = Object.entries(led).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${LED[k] || k}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${Math.round(v)}</td></tr>`).join('');
  const t = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  return `<div class="card rep"><h2>${R.fail === 'fired' ? 'Your group let you go' : R.fail ? 'The staff walked out' : R.mode === 'md' ? 'Attending shift summary' : 'Shift summary'}</h2>${scoreCardsHTML(R, led, LED)}${U.career ? `<p class="rank-gain">${U.career.up ? `<b>Promoted: ${esc(U.career.rank.name)}.</b> ` : ''}+${U.career.gain} rank point${U.career.gain === 1 ? '' : 's'}. Rank: <b>${esc(U.career.rank.name)}</b>${U.career.rank.next ? `, ${U.career.rank.need} to ${esc(U.career.rank.next)}` : ''}.</p>` : ''}${litHTML(R)}<p class="verdict">${R.fail === 'fired' ? 'Legal risk reached 75%, and the group ended your contract mid-shift. "What raised your legal risk", above, lists every reason.' : R.fail ? 'Staff satisfaction hit bottom and your nurses went home. Breaks, backup, and fewer mandates keep people around.' : (R.expired ? `${R.expired} patient${R.expired === 1 ? '' : 's'} died in the department. ${R.stars >= 2 && !(R.mode === 'md' && R.md && (!R.md.seen || R.md.died || R.md.arrestLeft || R.md.codeLost || R.md.handed || R.md.codeLate || R.md.dxWrong || R.md.dispoWrong || R.md.contra || R.md.unneeded || R.md.untreated)) ? 'The numbers were good; read the worst moments below.' : verdictOf(R)}` : verdictOf(R))} ${esc(L.name)}${R.scen && R.scen !== 'none' ? `, ${esc(E.SCENS[R.scen].name)} scenario` : ''}${R.mode === 'md' ? `, ${esc(E.PACKS[R.pack].name)} medical direction` : ''}.</p>
<p class="rep-meta">${R.mode === 'md' ? 'Attending' : 'Charge nurse'} · ${esc(L.name)}${R.scen && R.scen !== 'none' ? ' · ' + esc(E.SCENS[R.scen].name) : ''} · ${new Date(at || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · Name: <span class="rep-name">&nbsp;</span></p>${R.code || R.realSec ? `<p class="rep-meta rep-class">${R.code ? `Class code <b>${esc(R.code)}</b>` : ''}${R.code && R.realSec ? ' · ' : ''}${R.realSec ? esc(realTxt(R).replace(/^played/, 'Played')) : ''}${R.bedFirst ? ` · ${R.bedFirst} bedded before registration` : ''}</p>` : ''}
<p class="rep-note">A teaching game, not clinical guidance. No licensed clinician has reviewed its clinical content yet.</p>
${cbSendHTML(R, at)}${mmHTML(R)}${mdReportHTML(R, t)}
<h4>Where your points came from</h4><table class="ledger">${rows || t('Nothing yet', '0')}</table>
<details class="rep-more"><summary>All the numbers</summary>
${metricsHTML(R, t)}
${R.mode === 'md' ? mdDeptHTML(R, t) : `<h4>Patients</h4><table>${t('Arrived this shift', R.seen)}${t('Died in the department', R.expired || 0)}${t('Discharged home', R.dc)}${t('Sent home from triage', R.pitDc)}${t('Admitted upstairs', R.adm)}${t('To the OR or cath lab', R.proc)}${t('Transferred out', R.tx)}${t('Left without being seen', R.lwbs)}${t('Left against medical advice', R.ama)}${t('72-hour returns', R.returns)}${t(`Still in the ED at ${E.clock(E.LEVELS[R.level] ? E.LEVELS[R.level].shift : 720)}`, R.left)}</table>
<h4>EMS and the Box</h4><table>${t('Average EMS wall time (arrival to hand-off)', R.wallAvg + 'm')}${t('EMS handed off to the waiting room', R.offloads)}${t('Units on the wall over 30 min', R.wallOver)}${t('Medical direction calls sent to a doctor', `${R.boxC.ans} of ${R.boxC.ans + R.boxC.miss}`)}${t('Alert reports taken', `${R.boxN.ans} of ${R.boxN.ans + R.boxN.miss}`)}${t('Alert time goals met', `${R.goalsMet} of ${R.goalsMet + R.goalsMiss}`)}${t('Ambulances diverted', `${R.diverted} (${R.yellowMins}m yellow, ${R.redMins}m red)`)}</table>
<h4>Outages and diversion</h4><table>${R.outages.length ? R.outages.map(o => t(`${esc(E.OUTAGES[o.k].name)} at ${E.clock(o.t0)}`, o.divertAt == null ? `No ${esc(E.DIVERTS[E.OUTAGES[o.k].fix].name)}${o.misses ? ` · ${o.misses} came anyway` : ''}` : `${esc(E.DIVERTS[E.OUTAGES[o.k].fix].short)} divert in ${Math.round(o.divertAt - o.t0)}m${o.misses ? ` · ${o.misses} came first` : ''}${o.after ? ` · ${o.after}m too long` : ''}`)).join('') : t('Nothing broke this shift', '')}${R.divertExtra ? t('Minutes on a specific divert with nothing broken', R.divertExtra) : ''}</table>
<h4>Services</h4><table>${t('Interpreters requested', `${R.interp} for ${R.lep} patient${R.lep === 1 ? '' : 's'} who needed one`)}${t('Massive transfusions', `${R.mtp}${R.mtpWaste ? ` (${R.mtpWaste} not needed)` : ''}`)}${t('Patients who went into shock', R.shock)}${t('O-negative units used', R.oneg)}${t('Meds pulled on override', `${R.overrides} (${R.medErrors} errors)`)}${t('Seen by a provider in triage', R.pitSeen)}${t('Registered / triaged', `${R.registered} / ${R.triaged}`)}${t('Sent upstairs by transporter / tech', `${R.transports.tp} / ${R.transports.pct}`)}${t('Interfacility ambulances', `${R.ift.als} ALS · ${R.ift.cct} CCT · ${R.ift.air} air${R.iftRefused ? ` (${R.iftRefused} wrong level)` : ''}`)}</table>
<h4>Team</h4><table>${t('Angry consultants', R.angry + R.wrongSpec)}${t('Nurse-minutes over ratio', R.ratioMin)}${t('Safety events', R.adverse)}${t('Agency nurses / mandates', `${R.agency} / ${R.mandates}`)}${R.staffH ? t('RN hours (staff / agency / mandated)', `${R.staffH.rn} / ${R.staffH.agency} / ${R.staffH.mandated}`) + t('RN hours per patient', R.staffH.rnPerVisit) + t('Attending / PA and NP hours', `${R.staffH.md} / ${R.staffH.app}`) : ''}</table>`}
</details>
<div class="rep-btns"><button type="button" class="big act" data-act="again">Run it back</button><button type="button" class="big" data-act="menu">Menu</button><button type="button" class="big" data-act="shareResult">Share result</button><button type="button" class="big" data-act="print">Print or save as PDF</button></div></div>`;
}
/* Morbidity and mortality: the three worst moments of the shift, and the decision behind each. */
function mdDeptHTML(R, t) {
  return `<h4>The department</h4><table>${t('Arrived this shift', R.seen)}${t('Died in the department', R.expired || 0)}${t('Discharged home', R.dc)}${t('Admitted upstairs', R.adm)}${t('To the OR or cath lab', R.proc)}${t('Transferred out', R.tx)}${t('Left without being seen', R.lwbs)}${t('72-hour returns', R.returns)}${t(`Still in the ED at ${E.clock(E.LEVELS[R.level] ? E.LEVELS[R.level].shift : 720)}`, R.left)}${t('Alert time goals met', `${R.goalsMet} of ${R.goalsMet + R.goalsMiss}`)}</table>`;
}
/* v0.25: how the shift went in each of the four scores, with what moved each one most. */
const SC_TAGS = { clinical: ['md', 'orders', 'harm', 'dispo', 'gray', 'blood', 'safety', 'returns', 'box', 'boxn', 'consult', 'sitter', 'goals', 'ratio', 'uncovered', 'waiting'], admin: ['admin', 'divert', 'wall', 'flow', 'staffing', 'lwbs', 'ama', 'hall', 'chair', 'transfer', 'experience'] };
/* v0.28: the attending's accuracy, legal risk, and the diagnoses missed. */
function litHTML(R) {
  if (R.mode !== 'md' || R.acc == null) return '';
  const L = R.lit || 0, ST = ['No action', 'Call from administration', 'Peer review', 'Performance improvement plan'];
  // the stage the player reached in the shift, not the number: risk added at the end has no call (audit R5.9-03)
  const stage = R.fail === 'fired' ? 'Fired' : R.litStage != null ? ST[Math.min(3, R.litStage)] : L >= 75 ? 'Fired' : L >= 50 ? ST[3] : L >= 40 ? ST[2] : L >= 25 ? ST[1] : ST[0];
  const miss = (R.dxLog || []).map(d => `<li><b>${esc(d.name)}</b>: you called ${esc(d.said)}. It was <b>${esc(d.dx)}</b>${d.must ? ' (must not miss)' : ''}.</li>`).join('');
  return `<div class="litbox"><div class="lit-row"><div><b>${R.acc}%</b><small>Clinical accuracy</small></div><div><b>${R.dxRight} of ${R.dxRight + R.dxWrong}</b><small>Diagnoses right</small></div><div class="${L >= 50 ? 'bad' : L >= 25 ? 'warn' : ''}"><b>${L}%</b><small>Legal risk · ${stage}</small></div></div>${miss ? `<h4>Diagnoses to review</h4><ul class="dxmiss">${miss}</ul>` : ''}${(R.litLog || []).length ? `<details><summary>What raised your legal risk</summary><ul>${R.litLog.map(x => `<li>+${x.n}: ${esc(x.why)}</li>`).join('')}</ul></details>` : ''}${R.lawCalls ? `<p class="hint">Lawyers called ${R.lawCalls} time${R.lawCalls > 1 ? 's' : ''}.</p>` : ''}</div>`;
}
function scoreCardsHTML(R, led, LED) {
  if (!R.sc) return '';
  const st = v => '★'.repeat(E.scoreStars(v)) + '☆'.repeat(3 - E.scoreStars(v));
  const why = c => { const e = Object.entries(led).filter(([k, v]) => SC_TAGS[c].includes(k) && Math.abs(v) >= 1); const lo = e.filter(x => x[1] < 0).sort((a, b) => a[1] - b[1])[0], hi = e.filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
    return `${hi ? `<small>Best: ${(LED[hi[0]] || hi[0]).replace(/<small>.*<\/small>/, '').trim()}</small>` : ''}${lo ? `<small class="neg">Hurt most: ${(LED[lo[0]] || lo[0]).replace(/<small>.*<\/small>/, '').trim()}</small>` : ''}`; };
  const card = (name, v, extra) => `<div class="scard ${v == null ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad'}"><span>${name}</span><b>${v == null ? '—' : v + '%'}</b><i aria-label="${E.scoreStars(v)} of 3 stars">${st(v)}</i>${extra || ''}</div>`;
  const dept = `<div class="scards">${card('Patients', R.sc.patients, `<small>${R.lwbs ? `${R.lwbs} left without being seen` : 'How they felt about the visit'}</small>`)}${card('Clinical', R.sc.clinical, why('clinical'))}${card('Admin', R.sc.admin, why('admin'))}${card('Staff', R.sc.staff, '')}</div>`;
  if (R.mode === 'md' && R.own) {   // Phase 6 (R5-03): the attending's stars come from the attending's own four; the department's are context
    const o = R.own, B = R.boxC || {};
    return `<div class="scards">${card('Clinical', o.clinical, `<small>Your own patients</small>${why('clinical')}`)}${card('Diagnoses', o.dx, `<small>${R.dxRight} of ${R.dxRight + R.dxWrong} right</small>`)}${card('Radio calls', o.radio, `<small>${B.right || 0} of ${(B.right || 0) + (B.wrong || 0) + (B.miss || 0)} right</small>`)}${card('Legal', o.legal, `<small>Legal risk ${R.lit}%</small>`)}</div>`
      + `<details class="dept"><summary>The department today (not your grade)</summary>${dept}</details>`;
  }
  const pace = R.pace ? `<p class="hint pace"><b>Rush pace:</b> ${R.pace.wait} min from the door to a provider, on average. ★★★ needs ${R.pace.lim[0]} or under, ★★ ${R.pace.lim[1]}, ★ ${R.pace.lim[2]}. In the Rush, your stars can’t beat your pace.</p>` : '';
  return pace + `<div class="scards">${card('Patients', R.sc.patients, `<small>${R.lwbs ? `${R.lwbs} left without being seen` : 'How they felt about the visit'}</small>`)}${card('Clinical', R.sc.clinical, why('clinical'))}${card('Admin', R.sc.admin, why('admin'))}${card('Staff', R.sc.staff, `<small>${R.fail === 'walkout' ? 'They walked out' : 'Average morale'}</small>`)}</div>`;
}
/* What each star takes, and how far the next one is. */
/* Orders the attending missed or did not need, patient by patient, with the reason. */
function ordLogHTML(m) {
  const all = (m.log || []).filter(x => x && (x.miss.length || x.extra.length || (x.unsafe || []).length)); if (!all.length) return '';
  const bad = all.filter(x => (x.unsafe || []).length), L = bad.concat(all.filter(x => !(x.unsafe || []).length));   // an order that can hurt comes first and is never cut off (audit R4.9-01)
  return `<h4>Orders to review</h4><ul class="ordlog">${L.slice(0, Math.max(12, bad.length)).map(x => `<li><b>${esc(x.name)}</b> · ${esc(x.dx || '')}${x.miss.length ? `<span class="ol-m">Missed: ${esc(x.miss.join(', '))}</span>` : ''}${(x.unsafe || []).length ? `<span class="ol-m">Can hurt them: ${esc(x.unsafe.join('; '))}</span>` : ''}${x.extra.length ? `<span class="ol-x">Not needed: ${esc(x.extra.join(', '))}</span>` : ''}${x.fine && x.fine.length ? `<span class="ol-f">Also reasonable: ${esc(x.fine.join(', '))}</span>` : ''}${x.why ? `<span class="ol-w">${esc(x.why)}</span>` : ''}</li>`).join('')}</ul>${L.length > 12 ? `<p class="hint">And ${L.length - 12} more.</p>` : ''}`;
}
/* Radio calls the attending got wrong or let ring out, with the plain reason. */
function radioLogHTML(R) {
  const L = (R.radioLog || []); if (!L.length) return '';
  return `<h4>Radio calls to review</h4><ul class="ordlog">${L.slice(0, 8).map(x => `<li>${esc(x.q)}<span class="ol-m">${x.miss ? 'Rang out. ' : 'You got it wrong. '}Right answer: ${esc(x.right || (x.btn ? x.btn[x.a ? 0 : 1] : x.a ? 'Approve' : 'Deny'))}${x.said ? ` (you ordered ${esc(x.said)})` : ''}</span><span class="ol-w">${esc(x.why)}</span></li>`).join('')}</ul>`;
}
/* Every patient who came back within 72 hours, and what would have prevented it. */
function returnsHTML(R) {
  const L = (R.returnList || []); if (!L.length) return '';
  return `<h4>72-hour returns</h4><ul class="ordlog">${L.map(x => `<li><b>${esc(x.name)}</b> · ${esc(x.dx || '')}<span class="ol-m">${esc(x.why)}</span></li>`).join('')}</ul>`;
}
function mdReportHTML(R, t) {
  if (R.mode !== 'md' || !R.md) return returnsHTML(R);
  const m = R.md;
  return ordLogHTML(m) + radioLogHTML(R) + returnsHTML(R) + `<h4>Your patients</h4><table>${t('Patients you saw', m.seen)}${t('ESI 1 and 2 seen within 10 min of a room', m.fast)}${t('Orders right / extra / missed', `${m.ordRight} / ${m.ordExtra} / ${m.ordMiss}`)}${t('Clean order sets', m.clean)}${t('Workups you had to add to', m.gaps)}${t('Unsafe orders (a drug that can hurt this patient, or a risky treatment with no reason for it)', (m.contra || 0) + (m.unneeded || 0))}${t('Complications (partly chance)', Math.max(0, (m.harm || 0) - (m.contra || 0)))}${t('Your own patients who died', m.died || 0)}${m.codeLost ? t('Of them, after a code run by the book', m.codeLost) : ''}${m.arrestOpen ? t('Your own patients still in cardiac arrest at the end, with no code running', m.arrestOpen) : ''}${t('Patients who got worse untreated', m.untreated)}${t('Disposition calls right / wrong', `${m.dispoRight} / ${m.dispoWrong}`)}${t('Medical direction calls answered', `${R.boxC.ans} of ${R.boxC.ans + R.boxC.miss}`)}${t('Medical direction calls right (of those you answered)', `${R.boxC.right} of ${R.boxC.ans}`)}</table>`;
}
function mmHTML(R) {
  if (!R.mm) return '';
  if (!R.mm.length) return `<h4>M&amp;M</h4><p class="hint">${R.fail === 'fired' ? 'No single moment stood out. What raised your legal risk, above, lists every reason.' : R.fail ? 'No single moment stood out: staff morale ended the shift.' : 'Nothing went badly wrong this shift. Take the win.'}</p>`;
  return `<h4>M&amp;M · your ${R.mm.length === 3 ? 'three ' : ''}worst moments</h4><ol class="mm">${R.mm.map(x => `<li><time>${E.clock(x.t)}</time><b>${esc(x.what)}</b><span>${esc(x.why)}</span></li>`).join('')}</ol>`;
}
function metricsHTML(R, t) {
  if (!R.m) return '';
  const m = R.m, mn = v => v == null ? '—' : v + 'm', gr = R.gray || {}, gn = (gr.right || 0) + (gr.ok || 0) + (gr.over || 0) + (gr.under || 0);
  return `<h4>ED metrics</h4><table>${t('Door to triage (median)', mn(m.d2t))}${t('Door to provider (median)', mn(m.d2p))}${t('Length of stay, discharged (median)', mn(m.losDc))}${t('Length of stay, admitted (median)', mn(m.losAdm))}${t('Boarding: admit decision to departure (median)', mn(m.board))}${t('Left without being seen', m.lwbsPct + '%')}${t('Left against medical advice', m.amaPct + '%')}${t('Admitted or observed', m.admitPct + '%')}${t('72-hour returns', m.retPct + '%')}${t('Hours on Yellow or Red Alert', m.capHours)}</table>
${R.mode === 'md' ? '' : `<h4>Patient experience</h4><table>${t('Experience score', R.px == null ? '—' : R.px + '%')}${t('Complaints', R.complaints)}${t('Updates you gave', R.updates)}${t('Minutes in hallway beds', R.hallMins)}</table>
<h4>Judgment calls</h4><table>${t('Gray-zone calls (right / defensible / too cautious / too bold)', gn ? `${gr.right} / ${gr.ok} / ${gr.over} / ${gr.under}` : '—')}${t('Went to observation', R.obs)}${t('Under-triaged / caught before harm', `${R.underTriage} / ${R.underCaught}`)}${t('Missed diagnoses from long provider lines', R.missedDx)}${t('Attending co-signs', R.cosign)}${t('Intubations (without an RT)', `${R.intub} (${R.intubNoRT})`)}${t('Moves to chairs', R.chairMoves)}${t('Full-capacity protocol', R.fcp)}${t('Regional diversion suspensions', R.suspended)}</table>`}`;
}
/* Phase 6 (the owner's decision): a career rank per role, from the stars earned across shifts. On this device only. A full shift's star
   counts 2 points, a Rush star 1 (it is a sixth as long). The thresholds are in points. */
const RANKS = {
  rn: ['New grad', 'Staff nurse', 'Preceptor', 'Relief charge', 'Charge nurse', 'Nurse manager', 'Director of emergency nursing'],
  md: ['Intern', 'Resident', 'Senior resident', 'Chief resident', 'Attending', 'Associate director', 'Department chair'],
};
const RANK_AT = [0, 6, 16, 30, 50, 80, 120];
function career() { try { const c = JSON.parse(store('oc-career') || 'null'); if (c && c.v === 1) return c; } catch (e) { /* a broken record starts again */ } return { v: 1, rn: { pts: 0, n: 0 }, md: { pts: 0, n: 0 }, last: 0 }; }
function rankOf(mode, pts) {
  let i = 0; while (i + 1 < RANK_AT.length && pts >= RANK_AT[i + 1]) i++;
  const L = RANKS[mode === 'md' ? 'md' : 'rn'];
  return { name: L[i], next: i + 1 < L.length ? L[i + 1] : null, need: i + 1 < RANK_AT.length ? RANK_AT[i + 1] - pts : 0, i };
}
// counts a finished shift once (a report shown again doesn't count twice); Orientation and lessons don't count
function careerAdd(R, at) {
  if (!R || R.level === 'train' || !E.LEVELS[R.level]) return null;
  const c = career(), m = R.mode === 'md' ? 'md' : 'rn'; if (c.last && c.last >= at) return null;
  const before = rankOf(m, c[m].pts), gain = (R.stars | 0) * (R.level === 'rush' ? 1 : 2);
  c[m].pts += gain; c[m].n++; c.last = at; store('oc-career', JSON.stringify(c));
  const after = rankOf(m, c[m].pts);
  return { gain, rank: after, up: after.i > before.i };
}
function rankLine(mode) {
  const c = career(), m = mode === 'md' ? 'md' : 'rn', r = rankOf(m, c[m].pts);
  return `<p class="t-rank">Rank: <b>${esc(r.name)}</b>${r.next ? ` · ${r.need} point${r.need === 1 ? '' : 's'} to ${esc(r.next)}` : ''}</p>`;
}
function showReport() {
  const G = g(), R = G.report; if (!R) return;
  U.scene = 'report'; U.sheet = null; U.modal = null; U.sel = null;
  clearToasts(); hush();
  store('oc-save', null);
  if (!R.fail && (!R.scen || R.scen === 'none') && (R.avg || 0) > bestOf(R.level, R.mode)) store('oc-best4-' + (R.mode === 'md' ? 'md-' : '') + R.level, String(R.avg));
  const at = Date.now();
  U.career = careerAdd(R, at);
  U.cbName = ''; U.leaveAsk = null;
  saveRep({ v: 1, R: Object.assign({}, R, { ver: GAME_V, mdSeen: (G.stats.md || {}).seen || 0, mdHarm: (G.stats.md || {}).harm || 0, mdDied: (R.md || {}).died || 0, mdArrestOpen: (R.md || {}).arrestLeft || 0, mdCodeLost: (R.md || {}).codeLost || 0, mdContra: (G.stats.md || {}).contra || 0, mdUnneeded: (G.stats.md || {}).unneeded || 0 }), led: G.ledger, at });   // a full or blocked store: the summary and Send still work now (U.lastRep)
  const el = $('#report'); el.hidden = false; setH(el, reportHTML(R, undefined, at)); el.scrollTop = 0; window.scrollTo(0, 0);
  render();
}
function showLastReport() {
  const d = lastReport(); if (!d) return;
  U.career = null;
  U.scene = 'report'; U.sheet = null; U.modal = null; U.sel = null; U.lvl = d.R.level; U.mode = d.R.mode === 'md' ? 'md' : 'rn';
  $('#title').hidden = true;
  const el = $('#report'); el.hidden = false; setH(el, reportHTML(d.R, d.led, d.at)); el.scrollTop = 0; window.scrollTo(0, 0);
  render();
}

/* ---------- loop ---------- */
let last = 0, lastR = 0, demoAcc = 0;
/* R1-04 / R3-04: one error used to freeze the shift for good, with no message. Now the loop stops cleanly, keeps the last good save (it
   doesn't save the state the error left half-done), and says so, with Reload, Copy details, and a way out if the save itself is broken. */
let crashed = null;
function crash(e, where) {
  if (crashed) return;
  crashed = { where, msg: String((e && e.message) || e).slice(0, 300), stack: String((e && e.stack) || '').split('\n').slice(0, 6).join('\n'), v: GAME_V, t: g() ? Math.round(g().t * 10) / 10 : null };
  try { console.error('Code Black stopped:', e); } catch (x) { /* no console */ }
  const saved = !!readSave();
  const d = document.createElement('div');
  d.id = 'crash'; d.className = 'modal-wrap'; d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'crashH');
  d.innerHTML = `<div class="modal"><h3 id="crashH" tabindex="-1">Something went wrong</h3><p>${saved ? 'The game stopped. <b>Your shift is saved</b> up to the last few seconds. Reload to pick it up.' : 'The game stopped. Reload to start again.'}</p>`
    + `<div class="crash-btns"><button type="button" class="big act" id="crashReload">Reload</button><button type="button" class="big" id="crashCopy">Copy details</button>${saved ? '<button type="button" class="big" id="crashDrop">Start over without the save</button>' : ''}</div>`
    + `<p class="crash-note">If it happens again, Copy details and send them with the class code or level you were playing.</p></div>`;
  document.body.appendChild(d);
  const det = () => `Code Black v${crashed.v}, ${crashed.where}, game minute ${crashed.t}: ${crashed.msg}\n${crashed.stack}`;
  $('#crashReload').addEventListener('click', () => location.reload());
  $('#crashCopy').addEventListener('click', () => { const b = $('#crashCopy'); try { navigator.clipboard.writeText(det()).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Couldn’t copy'; }); } catch (x) { b.textContent = 'Couldn’t copy'; } });
  const dr = $('#crashDrop'); if (dr) dr.addEventListener('click', () => { store('oc-save', null); location.reload(); });
  try { $('#crashH').focus(); } catch (x) { /* focus is a nicety */ }
}
function frame(now) {
  if (crashed) return;
  try { frameBody(now); } catch (e) { crash(e, 'frame'); return; }
  requestAnimationFrame(frame);
}
function frameBody(now) {
  const dt = Math.min(0.25, Math.max(0, (now - (last || now)) / 1000)); last = now;
  const G = g();
  if (G && U.scene === 'game' && !isPaused() && !G.over && !U.hold && !(U.freeze && !U.ff)) {   // U.freeze: test harness, turn-based play
    if (!U.ff && !G.train) { const S = G.stats; S.realSec = (S.realSec || 0) + dt; const sp = S.spdSec || (S.spdSec = {}); sp[U.speed] = (sp[U.speed] || 0) + dt; }   // real time played, for the summary
    let left = dt * (U.ff || U.speed) * BASE;
    while (left > 1e-6) { const s = Math.min(0.1, left); E.step(s); left -= s; if (G.card || G.over) break; if (U.ff && coachWaitDone()) { U.ff = 0; U.hold = true; break; } }
    save(false);
  } else if (G && U.scene === 'title') {
    demoAcc += dt;
    if (demoAcc > 0.5) { demoAcc = 0; for (let i = 0; i < 2; i++) E.step(0.25); E.botStep({}); }
  }
  if (G && U.scene === 'game' && G.over) showReport();
  if (G && U.scene === 'game') ambient(G, now);
  if (now - lastR > 110) { lastR = now; render(); }
}
function bind() {
  document.addEventListener('click', e => {
    const mt = U.mapTap;   // the floor plan already acted on this tap (and what it opened may now sit under the finger)
    if (mt && e.detail !== 0 && performance.now() < mt.t && (Math.hypot(e.clientX - mt.x, e.clientY - mt.y) < 32 || Math.hypot(e.clientX - mt.x0, e.clientY - mt.y0) < 32)) { U.mapTap = null; return; }
    const el = e.target.closest('[data-act]');
    if (el && U.mapDrag && performance.now() < U.mapDrag && el.closest('#map')) return;   // that was a drag across the floor plan, not a tap
    mapAct(el, e.clientX, e.clientY);
  });
  document.addEventListener('input', e => {   // the class code box: check it as it is typed, without redrawing the box
    const el = e.target && e.target.matches && e.target.matches('input[data-pick="code"]') ? e.target : null; if (!el) return;
    U.codeIn = el.value; const c = E.readCode(el.value), box = el.closest('.cc-box');
    const go = box && box.querySelector('[data-act="codePlay"]'), w = box && box.querySelector('.cc-what');
    if (go) go.disabled = !c || !!c.stale;
    if (w) w.textContent = codeHint(el.value);
  });
  document.addEventListener('error', e => { const el = e.target; if (el && el.tagName === 'IMG' && el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('rimg')) el.parentNode.classList.add('none'); }, true);   // a missing picture hides its View button (no inline handler: the page's CSP forbids them)
  document.addEventListener('input', e => {   // the class results boxes: what was typed survives each redraw (the name is never stored)
    const el = e.target; if (!el || !el.matches) return;
    if (el.matches('input[data-pick="cbname"]')) {
      U.cbName = el.value;
      const at = el.getAttribute('data-at'), st = U.cbSent && U.cbSent[at];   // typing again clears the last refusal (audit R4.7-11d)
      if (st && st !== 'sending' && st !== 'sent' && (U.cbBadName || {})[at]) { delete U.cbSent[at]; delete U.cbBadName[at]; el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); const e = $('#cbNameErr'); if (e) e.remove(); const rep = $('#report'); if (rep) rep._h = null; }   // the summary must redraw on the next refusal, even an identical one (audit R4.8-02)
    }
    else if (el.matches('input[data-pick="cbcode"], input[data-pick="cbkey"]')) {
      // Copy key's whole line ("…class code ABC-DEF: XXXX-XXXX-XXXX-XXXX") pasted into either box fills both (audit R5.6-07)
      const m = /([0-9A-Za-z]{3}-?[0-9A-Za-z]{3})\W+([0-9A-Za-z]{4}-?[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}-?[0-9A-Za-z]{4})\b/.exec(el.value), code = m && cbCodeNorm(m[1]), key = m && cbKeyNorm(m[2]);
      if (code && key) { U.cbForm = Object.assign(U.cbForm || {}, { code, key: cbKeyShow(key) }); el.value = el.matches('[data-pick="cbcode"]') ? code : cbKeyShow(key); }
      else if (el.matches('[data-pick="cbcode"]') && !cbCodeNorm(el.value) && cbKeyNorm(el.value)) {   // a key pasted into the code box goes to the (hidden) key box, not onto the projector (audit R5.7-07)
        U.cbForm = Object.assign(U.cbForm || {}, { key: cbKeyShow(cbKeyNorm(el.value)), code: '' }); el.value = ''; const k = $('#cbKey'); if (k) k.value = U.cbForm.key;
      }
      else U.cbForm = Object.assign(U.cbForm || {}, el.matches('[data-pick="cbcode"]') ? { code: el.value } : { key: el.value });
    }
  });
  document.addEventListener('change', e => { const el = e.target; if (el && el.matches && el.matches('input[data-pick="cbrem"]')) U.cbForm = Object.assign(U.cbForm || {}, { rem: el.checked }); });
  document.addEventListener('keydown', e => { const el = e.target; if (e.key === 'Enter' && el && el.matches && el.matches('input[data-pick="cbname"]')) { e.preventDefault(); ACT.cbSend(el.getAttribute('data-at')); } });
  store('oc-cb-name', null);   // v0.31: a name typed for class results is no longer kept (a shared classroom device would offer it to the next student)
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('input[data-pick="cbcode"], input[data-pick="cbkey"]')) { e.preventDefault(); ACT.cbShow(); render(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('input[data-pick="code"]')) { const c = E.readCode(e.target.value); if (c && !c.stale) ACT.codePlay(c.code); } });
  document.addEventListener('input', e => {   // the Words search: hide what does not match, without redrawing the box being typed in
    const el = e.target && e.target.matches && e.target.matches('input[data-wq]') ? e.target : null; if (!el) return;
    U.wq = el.value; const q = el.value.trim().toLowerCase(); let n = 0;
    const root = el.closest('.sheet, #sheet, .card') || document;
    root.querySelectorAll('.gl').forEach(gl => { let k = 0; gl.querySelectorAll('dl > div').forEach(d => { const on = !q || d.textContent.toLowerCase().includes(q); d.hidden = !on; if (on) k++; }); gl.hidden = !k; n += k; });
    const none = root.querySelector('.wnone'); if (none) none.hidden = !!n;
  });
  document.addEventListener('change', e => {   // the scenario menu on a sideways phone
    const el = e.target && e.target.closest ? e.target.closest('select[data-pick]') : null;
    if (el && ACT[el.dataset.pick]) ACT[el.dataset.pick](el.value);
  });
  document.addEventListener('pointerdown', () => { U.kbd = false; }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') U.kbd = true;
    // Tab stays inside an open menu sheet, which is a modal dialog (audit R4.9-03). In a shift the board stays reachable.
    if (e.key === 'Tab' && U.scene !== 'game' && !$('#sheetWrap').hidden) {
      const f = focusables($('#sheetBox')), i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i < 0 || i === f.length - 1)) { e.preventDefault(); try { (e.shiftKey ? f[f.length - 1] : f[0]).focus(); } catch (er) { /* old browsers */ } }
      return;
    }
    // QA2-4: Tab stays inside an open card (a modal dialog) in a shift too
    if (e.key === 'Tab' && !$('#modalWrap').hidden) {
      const f = focusables($('#modal')), i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i < 0 || i === f.length - 1)) { e.preventDefault(); try { (e.shiftKey ? f[f.length - 1] : f[0]).focus(); } catch (er) { /* old browsers */ } }
      return;
    }
    // QA2-4: a room or patient on the floor plan opens with Enter or Space, like a button
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-act]:not(button):not(input):not(a):not(select)')) { e.preventDefault(); mapAct(e.target, 0, 0); render(); return; }
    if (e.key === 'Escape') {   // a question open in the class sheet is answered "no" first; then the sheet closes
      if (U.sel) U.sel = null;
      else if (U.sheet && U.sheet.type === 'class' && ((U.cbList && U.cbList.ask) || U.cbForget || U.codeAsk)) { if (U.cbList && U.cbList.ask) ACT.cbDelNo(); else if (U.cbForget) ACT.keyForgetNo(); else ACT.codeAskNo(); }
      else if (U.sheet) U.sheet = null;
      else if (U.scene === 'game' && U.paused && !U.modal) ACT.pause();   // QA-6: Escape closes the pause menu
      render();
    }
    else if ((e.key === 'n' || e.key === 'N') && U.scene === 'game' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) { ACT.needNext(); render(); }
  });
  // QA-17: in a shift, the phone's back button closes what is open (a selection, a sheet), or opens the pause menu, instead of leaving the game
  window.addEventListener('popstate', () => {
    if (U.scene !== 'game') return;
    if (U.sel) U.sel = null; else if (U.sheet) U.sheet = null; else if (!U.paused && !U.modal) ACT.pause();
    try { history.pushState({ cb: 1 }, ''); } catch (e) { /* history blocked */ }
    render();
  });
  document.addEventListener('fullscreenchange', () => { if (U.scene === 'title') setH($('#title'), titleHTML()); else render(); });
  window.addEventListener('resize', () => { U.layKey = null; if (U.scene === 'game') render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hush(); if (document.hidden && U.scene === 'game') { U.paused = true; save(true); render(); } });
  window.addEventListener('pagehide', () => save(true));
}
/* ---------- private testing gate (v0.21.1) ----------
   On edcodeblack.com the game asks for a password before it starts. The password is checked by the database
   (cb_gate_check; only its bcrypt hash is stored) and the switch is there too (cb_gate_on), so the gate comes
   down at launch without a new release. A device that has the right password remembers it and plays offline.
   The game's files still load first, so this keeps out visitors, not someone set on reading the code. */
function gatedHost() { return /(^|\.)edcodeblack\.(com|net)$/i.test(location.hostname) || /\.github\.io$/i.test(location.hostname); }   // a declaration: the About page reads it before this line runs
const GATED = gatedHost();
function gate(go) {
  if (!GATED) { go(); return; }
  document.body.classList.add('gated');
  const el = document.createElement('div'); el.id = 'gate'; el.className = 'gate'; document.body.appendChild(el);
  const open = () => { el.remove(); document.body.classList.remove('gated'); go(); };
  const form = (msg, bad) => {
    el.innerHTML = `<div class="gate-card"><div class="t-kicker">Emergency Department</div><h1 class="t-brand">Code Black</h1><p>In private testing. Enter the password to play.</p>`
      + `<form id="gateF" autocomplete="on"><input id="gateP" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" maxlength="200"><button type="submit" class="big act">Play</button></form>`
      + `<p class="gate-msg${bad ? ' bad' : ''}" role="status">${esc(msg || '')}</p></div>`;
    const p = el.querySelector('#gateP'); try { p.focus(); } catch (e) { /* no focus on some phones */ }
    el.querySelector('#gateF').addEventListener('submit', ev => {
      ev.preventDefault(); const v = p.value.trim(); if (!v) return;
      el.querySelector('.gate-msg').textContent = 'Checking…';
      cbFetch('/rest/v1/rpc/cb_gate_check', { p: v }).then(ok => { if (ok === true) { store('oc-gate', v); open(); } else form('That password isn’t right.', true); })
        .catch(() => form('Can’t reach the server. Check the connection and try again.', true));
    });
  };
  const kept = store('oc-gate');
  if (kept) cbFetch('/rest/v1/rpc/cb_gate_check', { p: kept }).then(ok => { if (ok === true) open(); else { store('oc-gate', null); form('The password has changed. Enter the new one.', true); } }).catch(open);   // offline: this device already got in
  else cbFetch('/rest/v1/rpc/cb_gate_on', {}).then(on => (on === false ? open() : form())).catch(() => form('Can’t reach the server. Check the connection and try again.', true));
}
function boot(data) { gate(() => boot2(data)); }
function boot2(data) {
  data = data || {};
  if (store('oc-sound') === '0' || data.sound === false) U.sound = false;
  const pk = store('oc-pack'); if (pk && E.PACKS[pk]) U.pack = pk;
  if (store('oc-mode') === 'md') U.mode = 'md';
  if (store('oc-view') === 'list') U.view = 'list';
  if (store('oc-3d') === '0') U.three = false;
  if (Q3D_NAME[store('oc-3dq')]) U.q3d = store('oc-3dq');
  if (E.SCENS[store('oc-scen')]) U.scen = store('oc-scen');
  if (E.WX[store('oc-wx')]) U.wx = store('oc-wx');
  if (/^https?:$/.test(location.protocol) && window.top === window.self) {   // on the web (not inside another page): a home-screen icon and a full-screen app
    const link = (rel, href) => { const l = document.createElement('link'); l.rel = rel; l.href = href; document.head.appendChild(l); };
    link('manifest', 'manifest.webmanifest'); link('apple-touch-icon', 'apple-touch-icon.png'); link('icon', 'icons/icon-192.png');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});   // plays offline once it has loaded once
  }
  buildBoard(); bind();
  for (const [id, txt] of [['laneEms', 'No ambulances waiting'], ['laneWait', 'Waiting room is empty']]) $('#' + id).dataset.empty = txt;
  if (data.G && saveShape(data.G) && data.G.running && !data.G.over) {
    E.load(data.G); U.scene = 'game'; U.mode = data.G.mode || 'rn'; U.lvl = data.lvl || data.G.level; U.speed = data.speed || 1; U.paused = true;
    $('#title').hidden = true;
    render();
  } else showTitle();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (U.scene === 'game' && g() && !g().over ? { G: g(), lvl: U.lvl, speed: U.speed, sound: U.sound } : { sound: U.sound })); } catch (e) { /* ignore */ }
  requestAnimationFrame(frame);
}
/*MAP*/
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
window.OCUI = { U, render, save: f => save(f), cbClean, cbSendable, verdictOf, start, omOf: k => omOf(k), showTitle, mapFocus, tgt3d: x => tgt3d(x), mapRect: x => { const r = mapRect(x); return { left: r.left, top: r.top, width: r.width, height: r.height }; }, cam: () => ({ far: CAM.far, x: CAM.x, y: CAM.y, w: CAM.w, h: CAM.h }), coach: () => { const t = TR(), st = coachStep(); return t && st ? { lesson: lessonKey(), i: t.step, id: st.id, wait: t.brk == null && !!st.wait && t.held !== t.step, next: t.brk != null || !!st.next || t.held === t.step, final: t.brk == null && !!st.final, n: STEPS_NOW().length, brk: t.brk != null ? t.brk : null, ch: (chOf(t.step) || {}).k } : null; } };
})();
