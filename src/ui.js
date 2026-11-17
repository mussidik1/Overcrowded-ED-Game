/* Overcrowded ED — phone-first UI v0.2. Reads state from OC.G, sends taps to OC actions. */
(function () {
'use strict';
const E = window.OC;
const $ = (s, r) => (r || document).querySelector(s);
const SPEEDS = [1, 2, 3, 4];
const BASE = 0.4; // game minutes per real second at 1×: a 12-hour shift takes about 30 minutes
const U = { scene: 'title', lvl: 'med', mode: 'rn', ord: null, ordOpen: null, pack: 'national', sel: null, sheet: null, modal: null, speed: 1, paused: false, sound: true, ringId: null, ringT: 0, wide: false, lastSave: 0, hold: false, ff: 0, coachKey: null };
let audio = null;

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function setH(el, h) { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } }
function setC(el, c) { if (el && el.className !== c) el.className = c; }
/* Swap only the top-level sections whose markup changed, so buttons in unchanged sections stay put mid-tap. */
function morph(el, h) {
  if (!el || el._h === h) return;
  el._h = h;
  const tpl = document.createElement('template'); tpl.innerHTML = h;
  const next = Array.from(tpl.content.childNodes), cur = Array.from(el.childNodes);
  for (let i = 0; i < next.length; i++) {
    const n = next[i], c = cur[i], src = n.nodeType === 1 ? n.outerHTML : n.textContent;
    if (c && c._src === src) continue;
    n._src = src;
    if (c) el.replaceChild(n, c); else el.appendChild(n);
  }
  for (let i = next.length; i < cur.length; i++) cur[i].remove();
}
const cap = x => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
const fm = m => { m = Math.max(0, Math.round(m)); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
const fl = v => (Math.round(v * 10) / 10).toString();
const RC = { md: 'r-md', app: 'r-app', rn: 'r-rn', pct: 'r-pct', evs: 'r-evs', rt: 'r-rt', rph: 'r-rph', reg: 'r-reg', tp: 'r-tp' };
const ZSHORT = { resus: 'Resus', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', hall: 'Hall', ft: 'FT', rp: 'Chairs' };
const dxShown = p => (p.dxK && (!p.alertOn || p.ev === 'done')) ? p.dx : null;
const dxOr = p => dxShown(p) || p.cc;
function emoji(p) { const a = p.age; if (a < 2) return '👶'; if (a < 13) return p.sex === 'F' ? '👧' : '👦'; if (a < 60) return p.sex === 'F' ? '👩' : '👨'; return p.sex === 'F' ? '👵' : '👴'; }
const esiKnown = p => p.tri === 'done' || p.alertOn || p.crash || p.arrest || ['room', 'waiting', 'gone'].includes(p.loc);
const ve = p => E.vEsi(p);
function esiChip(p) { return esiKnown(p) ? `<span class="esi e${ve(p)}">${ve(p)}</span>` : '<span class="esi eq">?</span>'; }
const intakeDone = p => p.loc === 'waiting' || p.loc === 'room' || (E.regQuick(p) && p.tri === 'done');
/* Who registration can take next: new arrivals, plus quick-registered patients who still need the full version. */
const regable = p => p.loc !== 'enroute' && (p.reg === 'none' || (p.reg === 'quick' && (p.loc === 'room' || p.loc === 'waiting')));
const hasHold = () => E.holdNurses().length > 0;
const GRAY_GUIDE = { 'HEART score': '0 to 3 is low risk (home). 4 to 6 is moderate (observation). 7 to 10 is high (admit).', 'Canadian Syncope Risk Score': '0 or below is low risk (home). 1 to 3 is medium. 4 to 5 is high (observation). 6 and up is very high (admit).', 'ABCD2 score': '0 to 3 is low risk (home with fast follow-up). 4 to 5 is moderate (observation). 6 to 7 is high (admit or observation).' };
function istChip(lbl, st) { return `<i class="ist ${st === 'done' ? 'done' : st === 'doing' ? 'doing' : st === 'q' ? 'q' : 'need'}">${lbl}</i>`; }
function intakeChips(p) { return istChip('REG', E.regQuick(p) ? 'done' : p.reg) + istChip(p.loc === 'wall' ? 'REPORT' : 'TRIAGE', p.tri); }
function alertTag(p) { return p.alertOn && p.alert ? `<i class="atag a-${p.alert}">${esc(E.ALERTS[p.alert].name)}</i>` : ''; }
function langChip(p) { return p.lang ? `<i class="lg ${p.interp === 'on' ? 'on' : p.interp === 'req' ? 'req' : ''}" title="${esc(E.LANGS[p.lang])}">${p.lang.toUpperCase()}</i>` : ''; }
function stLabel(s) { return { break: 'On break', away: 'Off the floor', sick: 'Went home sick', off: 'Called out', pending: s.tag === 'swing shift' ? 'Starts at 11:00' : s.tag === 'Fast Track 09:00' ? 'Starts at 09:00' : 'On the way', gone: 'Went home' }[s.st] || ''; }
const SKILL = { new: 'new grad', exp: 'resus-trained' };
function g() { return E.G; }
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const aAn = w => (/^[AEIOU]/i.test(w) ? 'an ' : 'a ') + w;
const MD = () => { const G = E.G; return !!(G && G.mode === 'md' && U.scene !== 'title'); };   // game or its report
const isMe = s => !!(s && MD() && s.id === E.G.me);
const mine = p => !!(p && MD() && p.mine && p.prov === E.G.me);
function head(title, sub) { return `<div class="sh-h"><div><h3>${title}</h3>${sub ? `<div class="sh-sub">${sub}</div>` : ''}</div></div>`; }
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
function sfx(n) {
  if (U.scene !== 'game') return;
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

/* ---------- toasts ---------- */
function toast(msg, kind) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast t-' + (kind || 'info'); el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, kind === 'mad' || kind === 'alert' ? 4200 : 3000);
}
E.hooks.toast = (m, k) => { if (U.scene === 'game') toast(m, k); };
E.hooks.sound = n => sfx(n);
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
function render() {
  const G = g(); if (!G) return;
  U.wide = window.matchMedia('(min-width: 1100px)').matches;
  document.body.classList.toggle('md', MD());
  const brand = document.querySelector('.brand small'), role = MD() ? 'Attending' : 'Charge RN';
  if (brand && brand.textContent !== role) brand.textContent = role;
  renderHud(G); renderBox(G); renderObjs(G); renderSel(G); renderZoneBar(G); renderIntakeStaff(G); renderLanes(G); renderBoard(G); renderDock(G); renderSide(G); renderLog(G);
  coachRun();
  renderSheet(G); renderModal(G);
  live(G);
  renderCoach();
  const top = $('#top'); if (top) document.documentElement.style.setProperty('--topH', top.offsetHeight + 'px');
}
function pill(id, val, cls, lbl) { const el = document.getElementById(id); setC(el, 'pill ' + (cls || '')); const b = el.querySelector('b'); if (b.textContent !== val) b.textContent = val; const sp = el.querySelector('span'); if (lbl && sp && sp.textContent !== lbl) sp.textContent = lbl; }
function renderHud(G) {
  const c = E.clock(); if ($('#clock').textContent !== c) $('#clock').textContent = c;
  const w = E.avgWait();
  if (MD()) {
    const act = E.active(), panel = act.filter(mine), calls = panel.filter(p => p.ord === 'need' || p.ord === 'more' || p.dsp === 'mddecide' || p.dsp === 'decide').length;
    const toSee = E.inRooms().filter(p => E.needsProv(p) && !p.prov).length;
    pill('pWait', G.stats.arrived ? fm(w) : '—', !G.stats.arrived ? '' : w <= 30 ? 'good' : w <= 60 ? 'warn' : 'bad', 'Avg wait');
    pill('pCare', String(Math.round(G.care)), G.care < 0 ? 'bad' : G.care >= 1300 ? 'good' : '', 'Score');
    pill('pStaff', String(panel.length), panel.length > 8 ? 'warn' : '', 'Panel');
    pill('pLwbs', String(toSee), toSee > 3 ? 'bad' : toSee ? 'warn' : '', 'To see');
    pill('pWall', String(calls), calls ? 'bad' : '', 'To do');
  } else {
    pill('pWait', G.stats.arrived ? fm(w) : '—', !G.stats.arrived ? '' : w <= 30 ? 'good' : w <= 60 ? 'warn' : 'bad', 'Avg wait');
    pill('pCare', String(Math.round(G.care)), G.care < 0 ? 'bad' : G.care >= 1200 ? 'good' : '', 'Pt mgmt');
    const sat = E.staffSat(); pill('pStaff', Math.round(sat) + '%', sat >= 65 ? 'good' : sat >= 45 ? 'warn' : 'bad', 'Staff');
    pill('pLwbs', String(G.stats.lwbs), G.stats.lwbs ? 'bad' : '', 'LWBS');
    const wall = E.active().filter(p => p.loc === 'wall').length, mw = E.maxWallNow();
    pill('pWall', String(wall), mw > 30 ? 'bad' : wall ? 'warn' : '', 'Wall');
  }
  $('#shiftProg').style.width = Math.min(100, Math.max(0, G.t / G.shift * 100)).toFixed(2) + '%';
  const dv = $('#btnYellow'), on = Object.keys(E.DIVERTS).filter(k => G.dv[k].on);
  setC(dv, 'hb' + (on.some(k => k !== 'yellow') ? ' red' : on.length ? ' on' : '') + (Object.keys(G.out).length && !on.length ? ' alarm' : ''));
  const dt = !on.length ? 'Divert' : on.length === 1 ? E.DIVERTS[on[0]].short : `Divert ×${on.length}`; if (dv.textContent !== dt) dv.textContent = dt;
  const sp = U.speed + '×'; if ($('#btnSpeed').textContent !== sp) $('#btnSpeed').textContent = sp;
  const pz = U.paused ? '▶' : 'II'; if ($('#btnPause').textContent !== pz) $('#btnPause').textContent = pz;
  $('#btnPause').setAttribute('aria-label', U.paused ? 'Resume' : 'Pause');
}
function renderBox(G) {
  const el = $('#boxbar'), b = G.box, c = b.cur, hold = b.q.length;
  let cls = 'boxbar', h;
  if (!c) {
    const S = G.stats.boxC, n = S.ans + S.miss;
    h = `<span class="bx-led"></span><span class="bx-name">The Box</span><span class="bx-idle">Quiet${n ? ` · consults answered ${S.ans}/${n}` : ''}${G.mods.survey > G.t ? ' · audit underway' : ''}</span>`;
  } else if (c.kind === 'notify') {
    const p = E.pt(c.pid); cls += ' notify';
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · ${esc(E.ALERTS[p.alert].name)} alert</span><span class="bx-txt">${esc(c.unit)}: ${p.age}${p.sex}, ${esc(p.cc)} · ETA <span data-cd="${p.eta}"></span>${MD() ? ' · charge nurse taking it' : ''}</span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}${MD() ? '' : '<button type="button" class="bx-btn" data-act="boxAnswer">Take report</button>'}`;
  } else if (c.taken) {
    cls += ' consult';
    const d = E.staff(c.taken);
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · Medical direction</span><span class="bx-txt">${isMe(d) ? 'You are' : esc(d ? d.name : 'An attending') + ' is'} on the line with ${esc(c.unit)}</span></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}`;
  } else {
    cls += ' consult';
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · Medical direction</span><span class="bx-txt">${esc(c.unit)} needs ${MD() ? 'you' : 'an attending'} on the line</span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}<button type="button" class="bx-btn" data-act="boxAnswer">${MD() ? 'Answer' : 'Find a doctor'}</button>`;
  }
  setC(el, cls); setH(el, h);
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
  for (const k of Object.keys(E.DIVERTS)) if (G.dv[k].on) it.push(`<span class="ob ${k === 'yellow' ? 'yellow' : 'red'}">${E.DIVERTS[k].name}</span>`);
  for (const k of Object.keys(G.out)) if (G.out[k].until > t) it.push(`<span class="ob down">${E.OUTAGES[k].short} · <span data-cd="${G.out[k].until}"></span></span>`);
  if (G.mods.lab > t && !G.out.power) it.push(`<span class="ob bad">Lab slow · <span data-cd="${G.mods.lab}"></span></span>`);
  if (G.mods.ehr > t && !G.out.power) it.push(`<span class="ob bad">EHR down · <span data-cd="${G.mods.ehr}"></span></span>`);
  if (G.mods.shortage > t) it.push(`<span class="ob bad">Drug shortage · <span data-cd="${G.mods.shortage}"></span></span>`);
  if (G.mods.bbSlow > t) it.push(`<span class="ob bad">Blood bank slow · <span data-cd="${G.mods.bbSlow}"></span></span>`);
  if (G.mods.interpDown > t) it.push(`<span class="ob bad">Interpreter line down · <span data-cd="${G.mods.interpDown}"></span></span>`);
  if (!G.staff.some(s => s.role === 'rph' && s.st === 'on')) it.push(`<span class="ob bad">${G.mods.remoteRph ? 'Remote pharmacy only' : 'No pharmacist'}</span>`);
  for (const h of G.region.hosps) if (h.st !== 'open') it.push(`<span class="ob warn">${esc(h.name)} on Yellow</span>`);
  if (G.region.susp > t) it.push(`<span class="ob bad">Region: no capacity alerts · <span data-cd="${G.region.susp}"></span></span>`);
  if (G.mods.noReport > t) it.push(`<span class="ob bad">Floors not taking report · <span data-cd="${G.mods.noReport}"></span></span>`);
  if (G.obsUnit.filled >= G.obsUnit.cap) it.push('<span class="ob warn">Obs unit full</span>');
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
    h = `<span><b>${esc(st.name)}</b> selected. Tap patients who need a provider.</span><button type="button" data-act="selInfo">Queue</button><button type="button" data-act="selCancel">Done</button>`;
  } else if (s && (s.type === 'reg' || s.type === 'tri')) {
    const st = E.staff(s.sid);
    h = `<span><b>${esc(st.name)}</b> ${s.type === 'reg' ? 'is registering. Tap patients who need it: a quick registration at the door, the full one at the bedside.' : 'is triaging. Tap patients at the door who need triage.'}</span><button type="button" data-act="selCancel">Done</button>`;
  } else if (s) {
    const p = E.pt(s.pid);
    const wr = s.type === 'pt' && p.loc === 'wall' && ve(p) >= 3 && !p.alertOn && intakeDone(p);
    h = `<span>${s.type === 'move' ? 'Moving' : 'Bedding'} ${emoji(p)} <b>${p.age}${p.sex}</b> ${esiChip(p)} ${esc(p.cc)}. Tap a green room.</span>${wr ? `<button type="button" data-act="toWait" data-arg="${p.id}">Waiting room</button>` : ''}<button type="button" data-act="selInfo">Details</button><button type="button" data-act="selCancel">Cancel</button>`;
  }
  setH(el, h); el.hidden = !h;
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
  morph($('#istaff'), `<span class="ic-l">Register</span>${regs.map(s => chip(s, 'reg')).join('') || '<span class="ic-l">nobody</span>'}<span class="ic-l">Triage</span>${tris.map(s => chip(s, 'tri')).join('') || '<button type="button" class="ic tri off" data-act="zone" data-arg="triage"><b>No triage RN</b><small>Tap to assign</small></button>'}`);
}
function roomNeeds(p, r, G) { const n = nextStep(p, r, G); return /n-act|n-bad|n-code|n-go fl/.test(n.c); }
function renderZoneBar(G) {
  const act = E.active();
  const wall = act.filter(p => p.loc === 'wall').length, wait = act.filter(p => p.loc === 'waiting' || p.loc === 'triage').length;
  let h = `<button type="button" class="zc${wall ? ' warn' : ''}" data-act="jump" data-arg="intake">EMS ${wall}</button><button type="button" class="zc${wait > 6 ? ' warn' : ''}" data-act="jump" data-arg="intake">Wait ${wait}</button>`;
  for (const z of E.ZONES) {
    const ns = E.zoneNurses(z.id), load = E.zoneLoad(z.id, hasHold()), cap = ns.length * 4, n = E.zonePts(z.id);
    const st = !ns.length ? (n ? 'none' : 'empty') : load > cap ? 'over' : 'ok';
    let need = 0; for (const r of G.rooms) if (r.z === z.id && r.pid && roomNeeds(E.pt(r.pid), r, G)) need++;
    h += `<button type="button" class="zc zs-${st}" data-act="jump" data-arg="${z.id}">${ZSHORT[z.id]}${need ? `<i>${need}</i>` : ''}</button>`;
  }
  setH($('#zbar'), h);
}
function magHTML(p) {
  if (p.loc === 'enroute') return `<span class="m-txt"><i class="atag a-${p.alert}">${esc(E.ALERTS[p.alert].name)}</i> <b>${p.age}${p.sex}</b><br>${esc(p.cc)}</span><span class="m-t">ETA <span data-cd="${p.eta}"></span></span>`;
  let sub = esc(p.cc);
  if ((p.loc === 'wall' || p.loc === 'triage') && !intakeDone(p)) sub = `${esc(p.cc)}<br>${intakeChips(p)}`;
  else if (p.loc === 'wall') sub = `${esc(p.cc)}<br><i class="ist done">READY FOR A BED</i>`;
  if (p.loc === 'waiting' && p.pitSeen) sub = `<span class="tags">${tagsHTML(p)}</span>${E.pitDcReady(p) ? '<i class="pitok">Ready to go</i>' : ''}`;
  return `${esiChip(p)}<span class="m-em">${emoji(p)}</span><span class="m-txt"><b>${p.age}${p.sex}</b> ${alertTag(p)}${langChip(p)}${p.ret ? '<i class="rettag">Return</i>' : ''}${p.vip ? '<i class="vip">VIP</i>' : ''}${p.crash ? '<i class="crash">Crashing</i>' : ''}${p.bleed === 'mtp' && !p.bb ? '<i class="crash">Bleeding</i>' : ''}<br>${sub}</span><span class="m-t" data-el="${p.tArrive}"></span>`;
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
    el.setAttribute('aria-label', `${p.age}${p.sex}, ${p.cc}`);
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
  const wi = $('#waitInfo'); setH(wi, `${waiting.length} waiting · ${G.triageQ.length} at the door${tri ? '' : ' · no triage nurse'}${pit ? ` · ${esc(pit.short)} in triage` : ''}${quiet ? ' · no update in an hour' : ''}`); setC(wi, 'lane-i' + (!tri || quiet ? ' bad' : ''));
}
function treatReason(p) {
  const ks = Object.keys(p.treat).filter(k => p.treat[k].st !== 'done');
  if (ks.some(k => p.treat[k].st === 'verify')) return 'Waiting on pharmacy';
  if (ks.some(k => E.TREAT[k].by === 'rt' && p.treat[k].st === 'todo')) return 'Waiting on RT';
  if (ks.includes('blood') && p.treat.blood.st === 'wait') return !p.bb ? 'Labs, then crossmatch' : p.bb.st === 'xm' ? 'Crossmatching blood' : 'O-neg on the way';
  if (ks.includes('mtp') && p.treat.mtp.st === 'wait') return 'MTP cooler coming';
  return 'Treatment underway';
}
const LEAVING = ['dc', 'dcing', 'toproc', 'iftwait', 'iftreport', 'xportq', 'family', 'morgue', 'morguing'];
function nextStep(p, r, G) {
  const pv = p.prov ? E.staff(p.prov) : null, nm = pv ? (isMe(pv) ? 'You' : esc(pv.short)) : '';
  if (mine(p) && !p.arrest) {
    if (p.ev === 'q') return { t: 'In your line', c: 'n-wait' };
    if (p.ev === 'doing') return { t: 'You are in the room', c: 'n-wait' };
    if (p.ord === 'need') return { t: 'Write orders', c: 'n-act fl' };
    if (p.ord === 'more') return { t: 'Add to the workup', c: 'n-act fl' };
    if (p.dsp === 'mddecide' || p.dsp === 'decide') return { t: 'Your call', c: 'n-act fl' };
    if (p.txGap && p.txGap.length && !LEAVING.includes(p.dsp)) return { t: 'Not improving', c: 'n-bad fl' };
  }
  if (p.arrest) return p.ev === 'doing' ? { t: 'Code in progress', c: 'n-code' } : p.ev === 'q' ? { t: 'Code: ' + nm, c: 'n-code' } : { t: MD() ? 'CODE: run it' : 'CODE: send an MD', c: 'n-code fl' };
  if (p.bleed === 'mtp' && !p.bb && p.dsp === 'none') return { t: p.shock ? 'SHOCK: activate MTP' : 'Bleeding: activate MTP', c: 'n-bad fl' };
  if (!E.zoneNurses(r.z).length && !(E.isBoarder(p) && hasHold())) return { t: 'No nurse!', c: 'n-bad fl' };
  if (p.sitter && !r.safe && !p.sitBy) return { t: 'Needs a sitter', c: 'n-bad fl' };
  switch (p.dsp) {
    case 'ready': return { t: 'Ready: discharge', c: 'n-go fl' };
    case 'dc': case 'dcing': return { t: 'Discharge teaching', c: 'n-go' };
    case 'readytx': return { t: 'Request transfer', c: 'n-act fl' };
    case 'txcall': return { t: 'Transfer center…', c: 'n-wait' };
    case 'decide': return { t: `${esc(p.gray.short || 'Risk')} ${p.gray.score}: your call`, c: 'n-act fl' };
    case 'board': return p.obsWait ? { t: 'Obs unit full', c: 'n-board' } : { t: `${p.dispo === 'obs' ? 'Obs' : 'Admitted'} · bed <span data-cd="${p.due}"></span>`, c: 'n-board' };
    case 'callrep': return { t: G.mods.noReport > G.t ? 'Floor won\'t take report' : 'Bed ready: nurse calls report', c: 'n-board' };
    case 'reporting': return { t: 'Calling report', c: 'n-board' };
    case 'bedready': return { t: 'Bed ready: send up', c: 'n-act fl' };
    case 'xportq': { const s = E.staff(p.xBy); return { t: `${s ? esc(s.short) : 'Transport'} taking them up`, c: 'n-board' }; }
    case 'txok': return { t: 'Accepted: book ambulance', c: 'n-act fl' };
    case 'iftwait': return { t: `${E.IFT[p.iftLevel].short} crew <span data-cd="${p.due}"></span>`, c: 'n-wait' };
    case 'iftreport': return p.crewWait != null && !E.treatsDone(p) ? { t: 'Crew waiting on treatment', c: 'n-warn' } : { t: 'Crew taking report', c: 'n-wait' };
    case 'toproc': return { t: p.dispo === 'cath' ? 'To the cath lab' : 'To the OR', c: 'n-go' };
    case 'family': return { t: 'Family at bedside', c: 'n-wait' };
    case 'morgue': case 'morguing': return { t: 'Morgue transport', c: 'n-wait' };
  }
  if (E.needsProv(p)) return p.ev === 'none' ? { t: `Needs a provider · <span data-el="${p.tNeed != null ? Math.max(p.tNeed, p.tRoom) : p.tRoom}"></span>`, c: 'n-act fl' } : { t: 'Needs a provider (recheck)', c: 'n-act fl' };
  if (p.reg !== 'done') return p.reg === 'none' ? { t: 'Needs registration', c: 'n-act fl' } : p.reg === 'quick' ? { t: 'Needs full registration', c: 'n-warn' } : { t: 'Registering', c: 'n-wait' };
  if (p.ev === 'q') { const i = pv ? pv.q.findIndex(k => k.pid === p.id) : -1; return { t: `${nm} · ${i >= 0 ? '#' + (i + 1) + ' in line' : 'queued'}`, c: 'n-wait' }; }
  if (p.ev === 'doing') return { t: `${nm} in the room`, c: 'n-wait' };
  if (p.con && p.consult.st === 'none' && p.dxK) return { t: 'Call a consult', c: 'n-act fl' };
  if (p.consult.st === 'req') return { t: `${E.SPECS[p.consult.spec].short} <span data-cd="${p.consult.due}"></span>`, c: 'n-wait' };
  if (p.re === 'q' || p.re === 'doing') return { t: `${nm} rechecking`, c: 'n-wait' };
  if (p.cosign === 'need' || p.cosign === 'wait') return { t: 'Attending co-sign', c: 'n-wait' };
  if (!p.dxK || (p.need && !p.need.every(k => p.work[k] && p.work[k].st === 'done'))) return { t: 'Workup pending', c: 'n-wait' };
  if (!E.treatsDone(p)) { const why = treatReason(p); return { t: why, c: /pharmacy|RT/.test(why) ? 'n-warn' : 'n-wait' }; }
  return { t: 'Wrapping up', c: 'n-wait' };
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
    + `<span class="who${pv ? ' pv-on' : ''}"><span class="em">${emoji(p)}</span> ${p.age}${p.sex}${p.ret ? ' <i class="rettag">Ret</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}${pv ? `<i class="pv ${RC[pv.role]}${isMe(pv) ? ' me' : ''}">${isMe(pv) ? 'YOU' : esc(pv.short.slice(0, 3))}</i>` : ''}</span>`
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
    setH(h, `<span class="zn">${z.name}</span><span class="zr">${ns.length ? 'RN ' + ns.map(s => esc(s.short)).join(' + ') + ` · <b>${fl(load)}/${cap}</b>` : closed ? shut : n ? 'No nurse — tap to assign' : 'No nurse'}</span>`);
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
    el.setAttribute('aria-label', p ? `${E.roomName(r.id)}: ${p.age}${p.sex}, ${dxOr(p)}` : `${E.roomName(r.id)}: ${r.closed ? 'closed' : r.st}`);
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
function vitals(p) {
  if (p.vit) return p.vit;
  return { 1: 'Unstable', 2: 'HR 112, BP 154/92, SpO2 94%', 3: 'HR 96, BP 138/84, SpO2 97%', 4: 'HR 84, BP 128/78, SpO2 99%', 5: 'HR 78, BP 122/76, SpO2 99%' }[ve(p)];
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
  const m = { callrep: G0().mods.noReport > G0().t ? 'Bed assigned. The floor is in shift change and won\'t take report yet.' : 'Bed assigned. Their nurse is calling report to the floor.', reporting: 'Their nurse is on the phone giving report', ready: 'Ready to go home', dc: 'Discharge teaching (nurse)', dcing: 'Discharge teaching (nurse)', readytx: `Transfer to ${p.txTo}`, txcall: 'Transfer center is calling', txok: `${cap(p.txTo)} accepted. Book an interfacility ambulance.`, iftwait: `${p.iftLevel ? E.IFT[p.iftLevel].name : 'Ambulance'} arrives in <span data-cd="${p.due}"></span>`, iftreport: 'Interfacility crew taking report at the bedside', board: `${p.dispo === 'obs' ? 'Going to the observation unit' : `Admitted to the ${{ admit: 'floor', icu: 'ICU', bh: 'psych unit' }[p.dispo]}`} · bed in <span data-cd="${p.due}"></span>`, bedready: 'Bed ready upstairs. Send them with a transporter or a tech.', xportq: 'Transport is on the way to the room', toproc: p.dispo === 'cath' ? 'Going to the cath lab' : 'Going to the OR', family: 'Family at the bedside', morgue: 'Waiting for transport', morguing: 'Transport underway' };
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
  if (it.st === 'done') return [k === 'mtp' ? 'Running. Pressure is coming up.' : 'Given', 'ok'];
  if (it.st === 'doing') return ['Underway', 'wait'];
  if (it.st === 'verify') return ['Waiting on pharmacist verification', 'warn'];
  if (it.st === 'q') return ['In the provider\'s line', 'wait'];
  if (it.st === 'wait') {
    if (k === 'tnk') return ['Needs neurology at the bedside and a CT with no bleed', 'idle'];
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
  if (p.loc === 'wall' || p.loc === 'triage') rows.push(row(p.loc === 'wall' ? 'Report' : 'Triage', p.tri === 'done' ? `Triaged: ESI ${ve(p)}` : p.tri === 'doing' ? `${nm(p.triBy)} is ${p.loc === 'wall' ? 'taking report from ' + esc(p.unit) : 'triaging'} now` : p.tri === 'q' ? `${nm(p.triBy)} is next${E.regQuick(p) ? '' : ', once registered'}` : p.loc === 'wall' ? `${esc(p.unit)} is waiting to give report` : 'Waiting for a triage nurse', p.tri === 'done' ? 'ok' : p.tri === 'none' ? 'need' : 'wait'));
  rows.push(row('Bed', r ? E.roomName(r.id) : where(p), r ? 'ok' : 'need'));
  rows.push(row('Nurse', p.rn === 'done' ? 'Assessed' : p.rn === 'doing' ? 'Assessing now' : p.rn === 'todo' ? (r && E.zoneNurses(r.z).length ? 'Waiting for the nurse' : 'No nurse covers this room') : 'After rooming', p.rn === 'done' ? 'ok' : p.rn === 'todo' && r && !E.zoneNurses(r.z).length ? 'need' : 'idle'));
  const pitBy = p.pitBy ? E.staff(p.pitBy) : null;
  const cos = p.cosign === 'need' ? '. Waiting on the attending co-sign.' : p.cosign === 'wait' ? '. Needs an attending co-sign; no attending is free.' : p.cosign === 'done' ? '. Attending co-signed.' : '';
  if (mine(p) && (p.ord === 'need' || p.ord === 'more')) rows.push(row('Orders', p.ord === 'need' ? 'Waiting for your orders' : 'The workup is missing something', 'need'));
  rows.push(row('Provider', p.ev === 'done' ? `Seen by ${pv ? (isMe(pv) ? 'you' : esc(pv.name)) : 'a provider'}${cos}` : p.ev === 'doing' ? `${esc(pv ? pv.name : 'Provider')} is in the room` : p.ev === 'q' ? `${esc(pv ? pv.name : '')}, in line` : p.pitSeen ? `Seen in triage by ${esc(pitBy ? pitBy.name : 'the triage provider')}${p.loc === 'room' ? '. Needs a provider here.' : ''}` : p.loc === 'room' ? 'Not assigned yet' : 'After rooming', p.ev === 'done' ? 'ok' : p.ev === 'none' && p.loc === 'room' ? 'need' : p.pitSeen ? 'ok' : 'idle'));
  if (p.lang) rows.push(row('Interpreter', p.interp === 'on' ? `${E.LANGS[p.lang]} interpreter connected` : p.interp === 'req' ? `${E.LANGS[p.lang]} interpreter in <span data-cd="${p.interpDue}"></span>` : `<b>Speaks ${E.LANGS[p.lang]}.</b> Care runs slower and riskier without one.`, p.interp === 'on' ? 'ok' : p.interp === 'req' ? 'wait' : 'need'));
  const keys = p.wk.slice(); if (p.work.ecg && !keys.includes('ecg')) keys.unshift('ecg');
  for (const k of keys) {
    const w = p.work[k], nm = { ecg: 'ECG', lab: 'Labs', xr: 'X-ray', ct: 'CT', us: 'Ultrasound' }[k];
    let v, st = 'idle';
    if (!w) v = 'Ordered after the provider sees them';
    else if (w.st === 'todo') v = k === 'lab' ? (p.loc === 'room' || p.pitSeen ? 'Waiting for a PCT (the nurse draws it if techs are tied up)' : 'Drawn once roomed') : k === 'ecg' ? 'Waiting for a PCT or nurse' : 'In line for the scanner';
    else if (w.st === 'doing') v = k === 'lab' ? 'Drawing now' : k === 'ecg' ? 'Doing it now' : 'Scanning now';
    else if (w.st === 'run') v = `Resulting in <span data-cd="${w.due}"></span>`;
    else { v = `<b>${esc(p.find[k] || 'Resulted')}</b>`; st = 'ok'; }
    rows.push(row(nm, v, st));
  }
  for (const k of p.tr) { const [v, st] = treatText(p, k); rows.push(row(E.TREAT[k].label, v, st)); }
  const cs = p.consult;
  let cv, cst = 'idle';
  if (cs.st === 'none') { if (p.dxK && p.con) { cv = 'Needed. Pick the right service.'; cst = 'need'; } else if (p.dxK && p.loc === 'room' && !p.arrest) cv = 'Not needed'; else cv = 'Unknown until the workup is back'; }
  else if (cs.st === 'req') cv = `${E.SPECS[cs.spec].doc} (${E.SPECS[cs.spec].name}) coming in <span data-cd="${cs.due}"></span>`;
  else { cv = `${E.SPECS[cs.spec].doc} (${E.SPECS[cs.spec].name}) at the bedside`; cst = 'ok'; }
  rows.push(row('Consult', cv, cst));
  rows.push(row('Plan', dispoText(p), p.dsp === 'none' ? 'idle' : 'ok'));
  return rows.join('');
}
function goalRow(p, k) {
  const v = p.goals[k], gl = E.GOALS[k];
  return `<div class="goal ${v === true ? 'ok' : v === false ? 'bad' : ''}"><span>${gl.label} under ${gl.lim} min</span><b>${v === null ? `<span data-cd="${p.tArrive + gl.lim}"></span> left` : v ? 'Met' : 'Missed'}</b></div>`;
}
function primary(p, G) {
  const mtpBtn = p.bleed === 'mtp' && !p.bb ? `<button type="button" class="big bad" data-act="mtp" data-arg="${p.id}">Activate massive transfusion</button>` : '';
  if ((p.loc === 'wall' || p.loc === 'triage') && !intakeDone(p)) return intakeBlock(p, G, mtpBtn);
  if (['wall', 'waiting', 'triage'].includes(p.loc)) return `<div class="prim">${mtpBtn}<button type="button" class="big act" data-act="placeSel" data-arg="${p.id}">Choose a room</button>${p.loc === 'wall' && ve(p) >= 3 && !p.alertOn ? `<button type="button" class="big" data-act="toWait" data-arg="${p.id}">Hand off to the waiting room</button>` : ''}${p.loc === 'waiting' ? recheckBlock(p, G) : ''}</div>`;
  if (p.loc === 'enroute') return `${mtpBtn ? `<div class="prim">${mtpBtn}</div>` : ''}<p class="hint">Inbound, ETA <span data-cd="${p.eta}"></span>. Have a ${p.esi === 1 ? 'resus bay' : 'room'} clean and ready.</p>`;
  if (p.loc !== 'room') return '';
  if (mtpBtn) return `<div class="prim">${mtpBtn}</div>`;
  if (p.dsp === 'ready') return `<div class="prim"><button type="button" class="big go" data-act="dc" data-arg="${p.id}">Discharge home</button></div>`;
  if (p.dsp === 'readytx') return `<div class="prim"><button type="button" class="big act" data-act="tx" data-arg="${p.id}">Request transfer to ${esc(p.txTo)}</button></div>`;
  if (p.dsp === 'decide') return grayBlock(p);
  if (p.dsp === 'board') return p.obsWait ? '<p class="hint">The obs unit is full. The next obs discharge frees a bed for them.</p>' : `<div class="prim"><button type="button" class="big" data-act="esc" data-arg="${p.id}" ${G.house.esc ? '' : 'disabled'}>Push the House Supervisor for a bed (${G.house.esc} left)</button></div>`;
  if (p.dsp === 'callrep' || p.dsp === 'reporting') return `<p class="hint">Their nurse calls report to the floor, then you send them up.${hasHold() ? ' Your hold nurse has them.' : ''}${E.roomOf(p).kind === 'chair' ? ' They are in a chair: move them to a bed if one opens.' : ''}</p>`;
  if (p.dsp === 'bedready') return `<div class="prim"><div class="prim-l">Bed ready upstairs. Who takes them?</div><div class="pgrid">${upButtons(p, G)}</div>${p.dispo === 'icu' ? '<p class="hint" style="margin:0">ICU patient: their nurse goes along for about 10 minutes.</p>' : ''}</div>`;
  if (p.dsp === 'txok') return `<div class="prim"><div class="prim-l">${esc(cap(p.txTo))} accepted. Book the ambulance</div><div class="cgrid">${iftButtons(p, G)}</div><p class="hint" style="margin:0">ICU-level patients need critical care transport. The patient keeps the room until the crew arrives.</p></div>`;
  if (E.needsProv(p)) return `<div class="prim"><div class="prim-l">Assign a provider</div><div class="pgrid">${provButtons(p, G)}</div></div>`;
  if (p.reg === 'none') return `<div class="prim"><div class="prim-l">Register them before they leave the ED</div><div class="pgrid">${regButtons(p, G)}</div></div>`;
  if (p.dxK && p.con && p.consult.st === 'none') return `<div class="prim"><button type="button" class="big act" data-act="consultOpen" data-arg="${p.id}">Call a consult…</button></div>`;
  if (p.reg === 'quick' && p.ev === 'done') return `<div class="prim"><div class="prim-l">Finish their registration</div><div class="pgrid">${regButtons(p, G)}</div><p class="hint" style="margin:0">Registration does this at the bedside when the desk is quiet. They can't leave the ED until it's done.</p></div>`;
  return '';
}
function grayBlock(p) {
  const g = p.gray, b = (k, l, sub) => `<button type="button" class="cbtn" data-act="gray" data-arg="${p.id}|${k}"><b>${l}</b><small>${sub}</small></button>`;
  return `<div class="prim"><div class="prim-l">Your call · ${esc(g.tool)} ${g.score}</div><p class="hint" style="margin:0">${esc(GRAY_GUIDE[g.tool] || '')}</p><div class="cgrid three">${b('home', 'Home', 'Frees the bed now')}${b('obs', 'Observation', `Obs unit ${E.G.obsUnit.filled}/${E.G.obsUnit.cap} full`)}${b('admit', 'Admit', 'Takes an inpatient bed')}</div></div>`;
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
  if (p.reg === 'none') h += `<div class="prim-l">${E.emergent(p) ? '' : '1 · '}Register</div><div class="pgrid">${regButtons(p, G)}</div>`;
  if (p.tri === 'none' && !E.emergent(p)) h += `<div class="prim-l">2 · ${p.loc === 'wall' ? `Take report from ${esc(p.unit)} and triage` : 'Triage'}</div><div class="pgrid">${triButtons(p, G)}</div>`;
  if (p.reg !== 'none' && (p.tri !== 'none' || E.emergent(p)) && !E.emergent(p)) h += '<p class="hint" style="margin:0">Intake is underway. Tap the patient again when they show READY FOR A BED.</p>';
  return h + '</div>';
}
function upButtons(p, G) {
  const tps = G.staff.filter(s => s.role === 'tp' && E.present(s)), pcts = G.staff.filter(s => s.role === 'pct' && s.st === 'on');
  return tps.map(s => { const n = s.q.length + (s.task ? 1 : 0); return staffBtn('sendUp', p.id, s, s.st !== 'on' ? stLabel(s) : `Transporter · ${n ? n + ' ahead' : 'free'}`, s.st !== 'on'); }).join('')
    + pcts.map(s => { const sit = s.task && s.task.kind === 'sit'; return staffBtn('sendUp', p.id, s, sit ? 'Sitting 1:1' : `Tech · ${s.task || s.q.length ? 'after this job' : 'free'}`, sit); }).join('');
}
function iftButtons(p, G) {
  const opt = (k, note, dis) => `<button type="button" class="cbtn" data-act="ift" data-arg="${p.id}|${k}" ${dis ? 'disabled' : ''}><b>${E.IFT[k].name}</b><small>${E.IFT[k].eta[0]}–${E.IFT[k].eta[1]} min${G.mods.iftSlow > G.t && k !== 'air' ? ' (+30 now)' : ''} · ${note}</small></button>`;
  const grounded = G.mods.airWx > G.t;
  return opt('als', 'paramedic crew') + opt('cct', 'critical care crew') + opt('air', grounded ? 'grounded for weather' : 'fastest; weather can turn it back', grounded);
}
function ptSheet(G, p) {
  if (!p) return '';
  if (p.loc === 'gone') return head(esc(p.name), 'No longer in the department') + `<p class="hint">${esc({ dc: 'Discharged home.', obs: 'Went to the observation unit.', admit: 'Went upstairs.', icu: 'Went to the ICU.', bh: 'Went to the psych unit.', or: 'Went to the OR.', cath: 'Went to the cath lab.', tx: 'Transferred out.', lwbs: 'Left without being seen.', ama: 'Left against medical advice.', expired: 'Died in the department.' }[p.outcome] || 'Left.')}</p>`;
  let h = `<div class="ph"><div class="ph-who"><span class="ph-em">${emoji(p)}</span><span><b>${esc(p.name)}</b>, ${p.age}${p.sex} ${esiChip(p)} ${alertTag(p)}${langChip(p)}${p.ret ? ' <i class="rettag">72-hr return</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}<br><span class="ph-sub">${esc(where(p))} · ${p.src === 'ems' ? esc(p.unit || 'EMS') : 'Walk-in'} · ${p.loc === 'enroute' ? `ETA <span data-cd="${p.eta}"></span>` : `in the ED <span data-el="${p.tArrive}"></span>`}</span></span></div></div>`;
  const kv = [['Complaint', esc(p.cc)], ['Vitals', esc(vitals(p))]], dx = dxShown(p);
  if (dx) kv.push(['Diagnosis', `<b>${esc(dx)}</b>`]); else if (p.alertOn && p.alert) kv.push(['Working', `${esc(E.ALERTS[p.alert].name)} alert`]);
  if (p.iso) kv.push(['Isolation', 'Airborne. Room 8 or 16.']);
  if (p.sitter) kv.push(['Safety', 'Needs a safe room (19 or 20) or a 1:1 sitter']);
  if (p.bleed === 'mtp') kv.push(['Bleeding', p.bb ? 'Massive transfusion activated' : '<b>Hemorrhage. Activate MTP.</b>']);
  else if (p.bleed === 'prbc') kv.push(['Blood', 'Needs a transfusion']);
  if (p.ret) kv.push(['Return', 'Seen here earlier today and back sicker']);
  if (p.gray && p.ev === 'done' && p.dxK) kv.push(['Risk', `${esc(p.gray.tool)} ${p.gray.score} · ${esc(p.gray.band)} risk`]);
  if (['room', 'waiting', 'wall', 'triage'].includes(p.loc)) { const px = Math.round(Math.max(0, Math.min(100, p.px))); kv.push(['Experience', `<span class="pxv ${px >= 70 ? 'ok' : px >= 45 ? 'warn' : 'bad'}">${px}%</span> · ${p.lastUpdate != null ? (G.t - p.lastUpdate < 1 ? 'updated just now' : `updated <span data-el="${p.lastUpdate}"></span> ago`) : 'no update yet'}`]); }
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
  if (p.loc === 'room' || p.loc === 'waiting') { const recent = p.lastUpdate != null && G.t - p.lastUpdate < 30; b.push(`<button type="button" data-act="upd" data-arg="${p.id}" ${recent ? 'disabled' : ''}>${recent ? 'Updated recently' : 'Update them on the plan'}</button>`); }
  if (p.loc === 'room' && E.isBoarder(p)) b.push(`<button type="button" data-act="zone" data-arg="hold">${hasHold() ? 'Change the hold nurse…' : 'Assign a hold nurse…'}</button>`);
  if (p.loc === 'room') {
    b.push(`<button type="button" data-act="stat" data-arg="${p.id}">${p.stat ? 'Clear STAT' : 'Mark STAT'}</button>`);
    b.push(`<button type="button" data-act="moveSel" data-arg="${p.id}">Move bed</button>`);
    if (p.consult.st === 'none' && (p.ev === 'done' || p.alertOn) && !(p.dxK && p.con)) b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Consult…</button>`);
    if (!E.needsProv(p) && p.ev !== 'doing' && !p.dsp.match(/^(dc|dcing|toproc|txwait|xporting|morguing)$/)) b.push(`<button type="button" data-act="provOpen" data-arg="${p.id}">Change provider</button>`);
  } else if (p.alertOn && p.con && p.consult.st === 'none') b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Activate a team…</button>`);
  if (MD()) { b.length = 0; if (mine(p) && p.loc === 'room') b.push(`<button type="button" data-act="stat" data-arg="${p.id}">${p.stat ? 'Clear STAT' : 'Mark STAT'}</button>`); }
  if (b.length) h += `<div class="sh-acts">${b.join('')}</div>`;
  return h;
}
/* ---------- physician mode: see, order, decide ---------- */
const ORDER_TESTS = [['ecg', 'ECG'], ['lab', 'Labs'], ['xr', 'X-ray'], ['ct', 'CT'], ['us', 'Ultrasound']];
const ORDER_TX = [['meds', 'Medications', 'Pain, nausea, or the specific drug'], ['fluids', 'IV fluids'], ['abx', 'Antibiotics'], ['insulin', 'Insulin drip'], ['tnk', 'Thrombolytic'], ['epi', 'Epinephrine'], ['nalox', 'Naloxone'], ['nebs', 'Nebulizer'], ['bipap', 'BiPAP'], ['hfnc', 'High-flow oxygen'], ['intub', 'Intubate', 'Then the ventilator'], ['blood', 'Blood transfusion'], ['mtp', 'Massive transfusion'], ['repair', 'Laceration repair', 'You do it']];
function mdPrimary(p, G) {
  const mtpBtn = p.bleed === 'mtp' && !p.bb ? `<button type="button" class="big bad" data-act="mtp" data-arg="${p.id}">Activate massive transfusion</button>` : '';
  if (p.loc === 'enroute') return `${mtpBtn ? `<div class="prim">${mtpBtn}</div>` : ''}<p class="hint">Inbound, ETA <span data-cd="${p.eta}"></span>. The charge nurse is getting a ${p.esi === 1 ? 'resus bay' : 'room'} ready.</p>`;
  if (p.loc !== 'room') return `<p class="hint">The charge nurse is working on a room for ${esc(p.name.split(' ')[0])}.</p>`;
  if (!p.prov && E.needsProv(p)) return `<div class="prim">${mtpBtn}<button type="button" class="big ${p.arrest ? 'bad' : 'act'}" data-act="see" data-arg="${p.id}">${p.arrest ? 'Run the code' : 'See this patient'}</button><p class="hint" style="margin:0">${p.arrest ? 'Every minute without a doctor lowers the odds. Another doctor takes it in a minute if you don\'t.' : 'Leave them too long and another provider picks them up.'}</p></div>`;
  if (!mine(p)) {
    const s = E.staff(p.prov), take = p.ev === 'q' && !p.arrest;
    return `<p class="hint">${s ? esc(s.name) : 'Another provider'} has this patient${take ? ' but hasn\'t started' : ''}.</p>${take ? `<div class="prim"><button type="button" class="big" data-act="see" data-arg="${p.id}">Take over</button></div>` : ''}`;
  }
  if (p.ev === 'q') { const me = E.staff(G.me), i = me.q.findIndex(k => k.pid === p.id); return `<p class="hint">In your line${i > 0 ? `, #${i + 1}` : ''}. You'll see them after what you're doing now.</p>`; }
  if (p.ev === 'doing') return `<p class="hint">${p.arrest ? 'You are running the code.' : 'You are in the room: history and exam.'}</p>`;
  if (p.ord === 'need' || p.ord === 'more') return mtpBtn + ordersBlock(p, G);
  if (p.dsp === 'mddecide' || p.dsp === 'decide') {
    const call = p.dsp === 'mddecide' ? mdDecideBlock(p) : grayBlock(p);
    if ((p.txGap && p.txGap.length) || U.ordOpen === p.id) return ordersBlock(p, G, true) + call;
    return call + `<div class="prim"><button type="button" class="big" data-act="ordOpen" data-arg="${p.id}">Add orders</button></div>`;
  }
  let h = mtpBtn ? `<div class="prim">${mtpBtn}</div>` : '';
  if (p.txGap && p.txGap.length) h += '<p class="hint bad">Not improving. Something they need is not ordered.</p>';
  if (p.ord === 'signed' && !['dc', 'dcing', 'toproc', 'iftwait', 'iftreport', 'xportq', 'family', 'morgue', 'morguing'].includes(p.dsp)) {
    h += (U.ordOpen === p.id || (p.txGap && p.txGap.length)) ? ordersBlock(p, G, true) : `<div class="prim"><button type="button" class="big" data-act="ordOpen" data-arg="${p.id}">Add orders</button></div>`;
  }
  return h;
}
function ordersBlock(p, G, add) {
  if (!U.ord || U.ord.pid !== p.id) U.ord = { pid: p.id, tests: [], treats: [] };
  const o = U.ord;
  const chip = (kind, key, lbl, sub) => {
    const done = kind === 't' ? p.wk.includes(key) : p.tr.includes(key), on = (kind === 't' ? o.tests : o.treats).includes(key);
    return `<button type="button" class="och${done ? ' done' : on ? ' on' : ''}" data-act="ordT" data-arg="${p.id}|${kind}|${key}" ${done ? 'disabled' : ''} aria-pressed="${on}"><b>${lbl}</b>${done ? '<small>Ordered</small>' : sub ? `<small>${sub}</small>` : ''}</button>`;
  };
  const n = o.tests.length + o.treats.length, need = p.ord === 'need';
  const title = p.ord === 'more' ? 'The workup is not complete. Add what is missing.' : add ? 'Add orders' : 'Write orders';
  const lbl = n ? `Sign ${n} order${n > 1 ? 's' : ''}` : need ? 'Sign with no orders' : 'Pick orders to add';
  return `<div class="prim"><div class="prim-l">${title}</div><div class="ogrid">${ORDER_TESTS.map(([k, l]) => chip('t', k, l)).join('')}</div><div class="prim-l">Treatment</div><div class="ogrid">${ORDER_TX.map(([k, l, sub]) => chip('r', k, l, sub)).join('')}</div><button type="button" class="big act" data-act="sign" data-arg="${p.id}" ${n || need ? '' : 'disabled'}>${lbl}</button><p class="hint" style="margin:0">Order what they need and nothing extra. Extra tests cost time, and some treatments hurt people who don't need them.</p></div>`;
}
function mdDecideBlock(p) {
  const b = (k, l, sub) => `<button type="button" class="cbtn" data-act="mdd" data-arg="${p.id}|${k}"><b>${l}</b><small>${sub}</small></button>`;
  return `<div class="prim"><div class="prim-l">Your call · ${esc(p.dx)}</div>${p.txGap && p.txGap.length ? '<p class="hint bad" style="margin:0">Not improving yet. Something they need is not ordered.</p>' : ''}<div class="cgrid three">${b('home', 'Discharge home', 'Safe to go')}${b('consult', 'Admit: call a consult', 'Pick the service')}${b('transfer', 'Transfer', 'Care you lack')}</div></div>`;
}
const MOOD = ['🙂', '😐', '😠', '🤬'];
function consultSheet(G, p) {
  let h = head('Who do you call?', `${esc(p.name)} · ${esc(dxOr(p))}`);
  h += '<p class="hint">Consultants get angry if you call before the results they need are back, or if you call the wrong service. Angry consultants come slower.</p><div class="cgrid">';
  for (const k in E.SPECS) { const S = E.SPECS[k], m = G.spec[k].mood; h += `<button type="button" class="cbtn" data-act="consultSpec" data-arg="${k}"><b>${S.name}</b><small>${S.doc} ${MOOD[-m] || MOOD[0]}</small></button>`; }
  return h + '</div>';
}
function staffStatus(s, G) {
  const t = G.t;
  if (s.st === 'break') return `On break · back in ${fm(s.until - t)}`;
  if (s.st === 'away') return `Off the floor · back in ${fm(s.until - t)}`;
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
  const groups = [[MD() ? 'Providers' : 'Providers (tap a badge to station one in triage)', s => E.isProv(s)], ['Nurses', s => s.role === 'rn'], ['Patient care techs', s => s.role === 'pct'], ['Registration', s => s.role === 'reg'], ['Transport', s => s.role === 'tp'], ['Respiratory therapy', s => s.role === 'rt'], ['Pharmacy', s => s.role === 'rph'], ['Environmental services', s => s.role === 'evs']];
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
    if (E.present(s) && !MD()) h += `<div class="sh-acts">${s.pit ? `<button type="button" data-act="pit" data-arg="${s.id}|0">Bring ${esc(s.short)} back to the floor</button>` : `<button type="button" class="hl" data-act="pit" data-arg="${s.id}|1">Station ${esc(s.short)} in triage</button>`}</div><p class="hint">A provider in triage sees waiting-room patients, starts labs and imaging from there, and sends simple cases home without a bed. They can't take patients in rooms while stationed there.</p>`;
    h += `<h4>In line</h4><ol class="q">${s.q.length ? s.q.map((k, i) => { const p = E.pt(k.pid); return `<li>${i === 0 && k.started ? 'Now: ' : ''}${esc(k.type === 'box' ? 'Box consult' : `${taskLabel(k)} · ${p ? p.age + p.sex + ' ' + dxOr(p) : ''}`)}</li>`; }).join('') : '<li>Nothing in line</li>'}</ol>`;
  }
  return h;
}
function zoneSheet(G, z) {
  const zn = E.ZONE_NAME[z], hold = z === 'hold', load = hold ? E.holdLoad() : E.zoneLoad(z, hasHold()), cap = E.zoneNurses(z).length * (hold ? 5 : 4);
  let h = head(hold ? 'Hold nurse' : `${zn} nurses`, z === 'triage' ? `${G.triageQ.length} in the triage line` : hold ? `${plural(E.holds().length, 'admitted patient')} in ED beds` : `${plural(E.zonePts(z), 'patient')} · load ${fl(load)} of ${cap}`);
  const why = z === 'triage' ? 'Whoever covers Triage triages walk-ins and does waiting-room rechecks. New grads can\'t triage. To put a provider in triage, open a provider from the Team list.'
    : hold ? 'A hold nurse takes every admitted patient still in the ED, wherever they are, at inpatient ratios (5 points). Pod nurses stop counting those patients, and the hold nurse calls report to the floors.'
    : z === 'rp' ? 'Chairs hold patients a provider has already seen who are waiting on results or a ride. They barely count against a nurse, and they free real beds.'
    : `Each nurse handles 4 points: ESI 3 to 5 count 1, ESI 2 counts 2, ESI 1 counts 4, and an active resuscitation counts 6.${z === 'resus' ? ' Two at once needs a third nurse. New grads can\'t take Resus.' : ''} Over that, safety and morale slip.`;
  h += `<p class="hint">${why} Tap a nurse to add or remove them.</p><div class="zgrid">`;
  for (const s of G.staff.filter(x => x.role === 'rn' && ['on', 'break', 'away', 'pending'].includes(x.st))) {
    h += `<button type="button" class="zbtn ${s.zones.includes(z) ? 'on' : ''}" data-act="zt" data-arg="${s.id}|${z}"><b>${esc(s.short)}${SKILL[s.skill] ? ` <i class="stag sk-${s.skill}">${SKILL[s.skill]}</i>` : ''}</b><small>${s.zones.length ? s.zones.map(x => E.ZONE_NAME[x]).join(' + ') : 'Resource (any pod)'}${s.st !== 'on' ? ' · ' + stLabel(s) : ''}<br><span data-load="${s.id}"></span></small></button>`;
  }
  h += '</div>';
  if (hold) h += `<div class="sh-acts"><button type="button" data-act="agency" data-arg="hold" ${G.mods.noAgency ? 'disabled' : ''}>Call an agency RN for holds (~40 min)</button></div>`;
  if (z === 'triage') { const ago = G.t - G.wrUpdate, n = E.active().filter(p => p.loc === 'waiting' || p.loc === 'triage').length; h += `<div class="sh-acts"><button type="button" class="hl" data-act="updWait" ${ago < 30 || !n ? 'disabled' : ''}>${!n ? 'Nobody is waiting' : ago < 30 ? `You walked the room ${fm(ago)} ago` : `Walk the waiting room and update ${n} ${n > 1 ? 'people' : 'person'}`}</button></div><p class="hint">An honest update buys patience: people stay about 20 minutes longer before they walk out.</p>`; }
  else if (z !== 'triage') {
    const closed = G.rooms.some(r => r.z === z && r.closed);
    h += `<div class="sh-acts">${closed ? `<button type="button" data-act="zopen" data-arg="${z}">Reopen ${zn}</button>` : `<button type="button" data-act="zclose" data-arg="${z}" ${E.zonePts(z) ? 'disabled' : ''}>Close ${zn}</button>`}<button type="button" data-act="agency" data-arg="${z}" ${G.mods.noAgency ? 'disabled' : ''}>Call an agency RN (~40 min)</button></div>`;
  }
  return h;
}
function boxDocSheet(G) {
  const c = G.box.cur;
  if (!c || c.kind !== 'consult' || c.taken) return '';
  let h = head('Find a doctor', `${esc(c.unit)} needs medical direction. The ring timer is still running.`);
  h += '<p class="hint">A medic needs orders, and only an attending can give them. Whoever takes the call handles it, and stops what they are doing for about 5 minutes. Pick someone who is not in a code.</p><div class="pgrid">';
  for (const s of G.staff.filter(x => x.role === 'md' && E.present(x))) h += `<button type="button" class="pbtn r-md" data-act="boxDoc" data-arg="${s.id}" ${s.st === 'on' ? '' : 'disabled'}><b>${esc(s.name)}</b><small>${s.st === 'on' ? `<span data-stx="${s.id}"></span>` : stLabel(s)}</small></button>`;
  return h + '</div>';
}
function divertSheet(G) {
  const outs = Object.keys(G.out).filter(k => G.out[k].until > G.t);
  let h = head('Diversion status', 'Tell EMS what this ED cannot take right now');
  h += outs.length ? `<div class="dv-out"><b>Broken right now</b>${outs.map(k => `<span>${E.OUTAGES[k].name} · back in about <span data-cd="${G.out[k].until}"></span></span>`).join('')}</div>` : '<p class="hint">Nothing is broken right now. Use Yellow or Red Alert only when the department is full.</p>';
  const card = k => {
    const D = E.DIVERTS[k], d = G.dv[k], susp = D.capacity && G.region.susp > G.t, blocked = D.capacity && (G.mods.noDivert > G.t || susp) && !d.on;
    return `<div class="dv ${k}${d.on ? ' on' : ''}${D.capacity ? ' cap' : ''}"><b>${D.name}${d.on ? ` · on for ${fm(G.t - d.since)}` : ''}</b><p><i>${D.when}.</i> ${D.what}</p><button type="button" data-act="divertSet" data-arg="${k}|${d.on ? 0 : 1}" ${blocked ? 'disabled' : ''}>${d.on ? `Lift ${D.name}` : susp ? 'The region suspended alerts' : blocked ? 'Administration blocked divert' : `Go on ${D.name}`}</button></div>`;
  };
  h += '<h4>When something breaks</h4>' + ['ct', 'stemi', 'trauma', 'disaster'].map(card).join('');
  h += '<h4>When you are full</h4>' + ['yellow', 'red'].map(card).join('');
  const nb = G.region.hosps.map(x => `${esc(x.name)}: ${x.st === 'open' ? 'open' : 'Yellow'}`).join(' · ');
  h += `<div class="dv region"><b>The region</b><p>${nb}.${G.region.susp > G.t ? ` <b>Capacity alerts are suspended for <span data-cd="${G.region.susp}"></span>.</b>` : ''} Neighbors on alert send you more ambulances. If three hospitals are on capacity alerts at once, the region suspends all of them and everyone takes ambulances.</p></div>`;
  const ready = G.t - G.fcp.last >= 240;
  h += `<div class="dv fcp"><b>Full-capacity protocol</b><p><i>The ED is packed and admitted patients are holding its beds.</i> Up to 4 admitted floor patients go to inpatient hallway beds now. Their nurses still call report. Once every 4 hours; the hospitalists won't love it.</p><button type="button" data-act="fcp" ${ready ? '' : 'disabled'}>${ready ? 'Run the full-capacity protocol' : `Available at ${E.clock(G.fcp.last + 240)}`}</button></div>`;
  return h + '<p class="hint">A diversion that matches what broke costs little, and going on it fast earns points. Lift it as soon as the fix is in. Diverting when nothing is broken, or staying on after the fix, costs a lot and draws calls from administration and the EMS system.</p>';
}
function helpHTML() {
  if ((U.scene === 'game' && MD()) || (U.scene !== 'game' && U.mode === 'md')) return helpMD();
  return head('How to run the board', 'You are the charge nurse from 07:00 to 19:00. Keep patients moving, staff upright, and the Box answered.') + `<ol class="help">
<li><b>Intake.</b> Patients come in two doors: EMS and walk-in. Every one needs a quick registration and triage, and you direct both. Tap a registrar or triage nurse in the intake row, then tap patients; or tap a patient for options. EMS crews wait on the wall to give report until a nurse triages them. Walk-ins go to the waiting room after triage. Alerts and crashing patients can go straight to a room. Full registration happens later at the bedside, and nobody leaves the ED until it's done.</li>
<li><b>The waiting room.</b> Triage isn't perfect: now and then someone is sicker than their ESI says. Have the triage nurse recheck people who have waited a while. Walk the waiting room (tap the lane header) and update people on the wait; fewer walk out.</li>
<li><b>Bed patients.</b> Tap a patient marked READY FOR A BED, or one in the waiting room, then a green room. EMS patients who are ESI 3 to 5 can be handed off to the waiting room instead. ESI 1 goes to Resus. Fast Track opens at 09:00 and takes ESI 4 and 5. Airborne isolation needs Room 8 or 16. Rooms 19 and 20 are safe rooms for behavioral health. The six chairs are for patients a provider has seen who are waiting on results or a ride: move them out of a bed to free it.</li>
<li><b>Get them seen.</b> Nobody sees a provider until you assign one. Tap a provider at the bottom, then tap every patient you want them to take. PAs and NPs take ESI 2 to 5; an attending co-signs their ESI 2 patients. Intubations need an attending and an RT. A provider with a long line makes more mistakes. Station a provider in triage from their card to work the waiting room.</li>
<li><b>Gray-zone calls.</b> Chest pain, fainting, and TIA patients come back with a risk score. You decide: home, observation, or admit. Too cautious wastes beds; too bold brings people back.</li>
<li><b>Answer the Box.</b> Take alert reports so the team is ready. When a medic needs medical direction, find an attending fast: tap Find a doctor and pick one who is not in a code. The doctor gives the orders.</li>
<li><b>Consult at the right time.</b> Results show up on the patient card. Call the right service once the results they need are back, or they get angry and slow.</li>
<li><b>Meds, breathing, blood.</b> The pharmacist verifies most meds before the nurse can give them; override if you have to, at a risk. Respiratory therapy runs nebs, BiPAP, high-flow, and vents. Bleeding trauma needs the massive transfusion protocol fast. Other bleeders get crossmatched blood, or emergency-release O-negative.</li>
<li><b>Interpreters.</b> Patients marked ES, HT, ZH, AR, VI, RU, or ASL need one. Without it, care is slower, they're likelier to leave, and they come back more often.</li>
<li><b>Send them on.</b> When an inpatient bed is assigned, the nurse calls report to the floor; then choose a transporter or one of your techs to take them up. ICU patients take their nurse along. A hold nurse can take every admitted patient in the ED. For transfers, request the transfer as soon as the diagnosis is clear, then book an ALS ambulance, critical care transport, or a helicopter. The patient holds the room until the crew arrives and takes report.</li>
<li><b>Turn rooms.</b> Nothing gets cleaned until you send EVS. Tap a dirty room to put it in the EVS line; tap it again to move it to the front, like a resus bay before a trauma arrives.</li>
<li><b>Watch your nurses.</b> Each nurse handles 4 points, and an active resuscitation takes a nurse and a half. Tap a pod header to move nurses. Casey is your resource nurse. Reyes is a new grad: not ready for Resus or triage. Send people on breaks.</li>
<li><b>Divert.</b> When something breaks, go on the matching diversion: CT Divert when the scanner is down, STEMI Divert when the cath lab is down, Trauma Divert when there's no trauma surgeon or OR, and Internal Disaster when the lab or power fails. Lift it as soon as the fix is in. Yellow Alert (ED saturated) and Red Alert (no monitored beds) are for when you're full. Watch the neighbors: if too many hospitals are on alert, the region suspends everyone. The full-capacity protocol moves admitted patients to inpatient hallways.</li>
<li><b>Your scores.</b> Avg wait is door to provider. Pt mgmt is your patient management score. Staff is worker satisfaction. Avoid LWBS, AMA, 72-hour returns, and ambulances stuck on the wall. The shift report shows the metrics an ED director answers for, and walks you through your three worst moments.</li>
</ol>`;
}
function helpMD() {
  return head('How to work a shift', 'You are an attending from 07:00 to 19:00. The charge nurse runs the board. You run the medicine.') + `<ol class="help">
<li><b>Pick up patients.</b> Rooms marked Needs a provider are waiting for a doctor. Tap one, then See this patient. See the sickest first. Anyone you leave too long goes to another provider.</li>
<li><b>Write orders.</b> After the exam, pick tests and treatment, then Sign. Order what they need and nothing extra: extra tests cost time and points, a CT costs radiation, and some treatments hurt people who don't need them.</li>
<li><b>Close the gaps.</b> If the workup can't make the diagnosis, you'll hear that something is missing. Add it. If a patient isn't improving, they need a treatment you didn't order.</li>
<li><b>Make the call.</b> When the diagnosis is in, send them home, call the right consultant to admit them, or transfer them. Consultants want their results back before you call. Chest pain, fainting, and TIA come with a risk score for home, observation, or admit.</li>
<li><b>Answer the radio.</b> When a medic needs medical direction, tap Answer, read the call, and approve or deny. Only you can do it, and the call rings out if you wait.</li>
<li><b>Alerts.</b> The charge nurse takes STEMI, stroke, and trauma reports and gets the team moving. Your orders and your speed decide the time goals: ECG in 10, CT in 25, needle in 60, balloon in 90. Activate massive transfusion for a trauma that's bleeding out.</li>
<li><b>Your score.</b> Patients you saw, clean orders, right calls, time goals, and medical direction. Patients left waiting on your orders or your decision cost you.</li>
</ol>`;
}
function renderSheet(G) {
  const wrap = $('#sheetWrap'), el = $('#sheet'), s = U.sheet;
  let h = '';
  if (s && U.scene === 'game') {
    if (s.type === 'pt') h = ptSheet(G, E.pt(s.pid));
    else if (s.type === 'consult') { const p = E.pt(s.pid); h = p && p.loc !== 'gone' && p.consult.st === 'none' ? consultSheet(G, p) : ''; }
    else if (s.type === 'prov') { const p = E.pt(s.pid); h = p && p.loc === 'room' ? head('Change provider', esc(p.name)) + `<div class="pgrid">${provButtons(p, G)}</div>` : ''; }
    else if (s.type === 'team') h = head(MD() ? 'The team' : 'Your team', MD() ? 'Who is working today. The charge nurse runs assignments and breaks.' : `Staff satisfaction ${Math.round(E.staffSat())}%`) + teamHTML(G);
    else if (s.type === 'staff') h = staffSheet(G, E.staff(s.sid));
    else if (s.type === 'zone') h = zoneSheet(G, s.z);
    else if (s.type === 'boxdoc') h = boxDocSheet(G);
    else if (s.type === 'divert') h = divertSheet(G);
    else if (s.type === 'help') h = helpHTML();
    if (!h) U.sheet = null;
  } else if (s && s.type === 'help') h = helpHTML();
  if (h && TR()) h = coachHTML('in') + h;
  wrap.hidden = !h; morph(el, h);
}

/* ---------- Orientation: the preceptor ----------
   One scripted patient at a time. Each step spotlights what to tap, holds the clock until the player acts,
   and fast-forwards through the waiting. "Do it for me" performs the step, so nobody gets stuck. */
const TR = () => { const G = g(); return G && G.train && G.tr && U.scene === 'game' ? G.tr : null; };
const tid = k => { const t = TR(); return t && t.ids[k] ? E.pt(t.ids[k]) : null; };
const mag = id => `[data-act="pt"][data-arg="${id}"]`;
const roomSel = p => (p && p.room ? `#room-${p.room}` : '');
const provSel = sid => `#dockProv [data-arg="${sid}"], #sideProv [data-arg="${sid}"]`;
const onSheet = p => !!(p && U.sheet && U.sheet.type === 'pt' && U.sheet.pid === p.id);
const selPt = p => !!(p && U.sel && U.sel.type === 'pt' && U.sel.pid === p.id);
const sheetIs = (type, z) => !!(U.sheet && U.sheet.type === type && (z == null || U.sheet.z === z));
function firstRoom(p, want) {
  const G = g(), ok = G.rooms.filter(r => r.kind !== 'chair' && E.canPlace(p, r).ok);
  return (ok.find(r => r.id === want) || ok[0] || {}).id;
}
const regStep = (key, sid) => ({
  spot: () => { const p = tid(key); if (onSheet(p)) return [`#sheet [data-act="regAssign"][data-arg$="|${sid}"]`]; return U.sel && U.sel.type === 'reg' ? [mag(p.id)] : [`#istaff [data-act="regSel"][data-arg="${sid}"]`]; },
  done: () => tid(key).reg !== 'none',
  auto: () => E.register(tid(key).id, sid),
});
const triStep = (key, sid) => ({
  spot: () => { const p = tid(key); if (onSheet(p)) return [`#sheet [data-act="triAssign"][data-arg$="|${sid}"]`]; return U.sel && U.sel.type === 'tri' ? [mag(p.id)] : [`#istaff [data-act="triSel"][data-arg="${sid}"]`]; },
  done: () => tid(key).tri !== 'none',
  auto: () => E.triage(tid(key).id, sid),
});
const intakeStep = (key, rsid, tsid) => ({
  spot: () => { const p = tid(key); if (!onSheet(p)) return [mag(p.id)]; return p.reg === 'none' ? [`#sheet [data-act="regAssign"][data-arg$="|${rsid}"]`] : [`#sheet [data-act="triAssign"][data-arg$="|${tsid}"]`]; },
  done: () => { const p = tid(key); return p.reg !== 'none' && p.tri !== 'none'; },
  auto: () => { const p = tid(key); if (p.reg === 'none') E.register(p.id, rsid); if (p.tri === 'none') E.triage(p.id, tsid); },
});
const bedStep = (key, rid) => ({
  spot: () => { const p = tid(key); return selPt(p) ? [`#room-${rid}`] : [mag(p.id)]; },
  done: () => ['room', 'gone'].includes(tid(key).loc),
  auto: () => { const p = tid(key); return E.place(p.id, firstRoom(p, rid)); },
});
const provStep = (key, sid) => ({
  spot: () => (U.sel && U.sel.type === 'prov' && U.sel.sid === sid ? [roomSel(tid(key))] : [provSel(sid)]),
  done: () => !!tid(key).prov || tid(key).loc === 'gone',
  auto: () => E.assign(sid, tid(key).id),
});
const roomAct = (key, sel) => ({ spot: () => { const p = tid(key); return onSheet(p) ? [`#sheet ${sel}`] : [roomSel(p)]; } });
const STEPS = [
  { id: 'hi', next: true, title: 'Welcome to Orientation', text: "I'm your preceptor. We'll take one patient at a time, and I'll light up what to tap. The clock only runs when we're waiting on something. Nothing here counts against you." },
  { id: 'top', next: true, title: 'The top of the board', text: 'The clock and your five scores sit up top, next to Divert. Under them is the Box, your EMS radio, and a bar that jumps to each pod.', spot: () => ['#top .hud', '#boxbar'] },
  { id: 'intake', next: true, title: 'Intake', text: 'Registrars are green. Your triage nurse is purple. New patients land in the Ambulance bay or the Waiting room.', spot: () => ['#istaff', '#intake .lane'] },
  { id: 'pods', next: true, title: 'Pods and providers', text: 'Each pod has four rooms and a nurse, and the header shows the nurse’s load. Your providers wait at the bottom. Nobody sees a patient until you send one.', spot: () => ['#zh-a', '#dockProv', '#sideProv'] },

  { id: 'm1', title: 'A walk-in', text: 'Maria, 34, has burning when she pees. Everyone starts with a quick registration: name and date of birth. Tap Tasha, then tap Maria.',
    setup: () => ({ maria: E.trainPatient('uti', 'walk', { name: 'Maria L.', age: 34 }) }), ...regStep('maria', 'reg1') },
  { id: 'm2', wait: true, title: 'Registering', text: 'Tasha takes about two minutes. Full registration happens later at the bedside, and nobody leaves the ED until it is done.', done: () => E.regQuick(tid('maria')) },
  { id: 'm3', title: 'Triage', text: 'Now triage. Tap Bea, then tap Maria.', ...triStep('maria', 'rnT') },
  { id: 'm4', wait: true, title: 'Triaging', text: 'Triage sets the ESI, from 1 (dying) to 5 (can wait). Walk-ins go to the waiting room after triage.', done: () => tid('maria').tri === 'done' },
  { id: 'm5', title: 'Give her a bed', text: 'Maria is ESI 4. Tap her in the waiting room, then tap Room 1. Green rooms are open.', ...bedStep('maria', '1') },
  { id: 'm6', title: 'Send a provider', text: () => `Nobody sees a provider until you send one. Tap Rivera at the bottom, then tap ${E.roomName(tid('maria').room || '1')}.`, ...provStep('maria', 'pa1') },
  { id: 'm7', wait: true, title: 'Workup', text: 'Rivera examines her and orders a urine test. A tech collects it and the lab runs it. The tags on her room show what is pending.', done: () => tid('maria').dxK || tid('maria').loc === 'gone' },
  { id: 'm8', wait: true, title: 'Treatment', text: 'The pharmacist checks the antibiotic, then her nurse gives it. Registration finishes her paperwork at the bedside.', done: () => tid('maria').dsp !== 'none' || tid('maria').loc === 'gone' },
  { id: 'm9', title: 'Discharge', text: 'She is ready to go home. Tap her room, then Discharge home.', ...roomAct('maria', '[data-act="dc"]'),
    done: () => ['dc', 'dcing'].includes(tid('maria').dsp) || tid('maria').loc === 'gone', auto: () => E.discharge(tid('maria').id) },
  { id: 'm10', wait: true, title: 'Discharge teaching', text: 'Her nurse goes over the plan and the warning signs with her.', setup: () => ({ room1: tid('maria').room || '1' }), done: () => tid('maria').loc === 'gone' },
  { id: 'm11', title: 'Turn the room', text: () => `${E.roomName(TR().ids.room1)} is dirty. Nothing gets cleaned until you send EVS. Tap the dirty room.`, spot: () => [`#room-${TR().ids.room1}`],
    done: () => { const r = E.room(TR().ids.room1); return r.st !== 'dirty' || g().evsQ.includes(r.id); }, auto: () => E.evsTap(TR().ids.room1) },

  { id: 'w1', title: 'An ambulance', text: 'Medic 7 brought Walter, 82, after a fall. The crew waits on the wall with him until a nurse takes report. Tap Walter. On his card, pick Miguel to register him, then Bea to take report.',
    setup: () => ({ walter: E.trainPatient('hipfx', 'ems', { name: 'Walter K.', age: 82, sex: 'M', unit: 'Medic 7' }) }), ...intakeStep('walter', 'reg2', 'rnT') },
  { id: 'w2', wait: true, title: 'Taking report', text: 'Every minute on the wall is a crew that can’t take the next call. Try to keep wall time under 30 minutes.', done: () => tid('walter').tri === 'done' && E.regQuick(tid('walter')) },
  { id: 'w3', title: 'Offload', text: 'Tap Walter, then Room 5 in Pod B. When you are full, ESI 3 to 5 EMS patients can go to the waiting room instead.', ...bedStep('walter', '5') },
  { id: 'w4', title: 'An attending', text: () => `Tap Dr. Patel, then tap ${E.roomName(tid('walter').room || '5')}.`, ...provStep('walter', 'md1') },
  { id: 'w5', wait: true, title: 'Results', text: 'An X-ray and labs. Results land on his card. Consultants want them back before you call.', done: () => tid('walter').dxK || tid('walter').consult.st !== 'none' || tid('walter').loc === 'gone' },
  { id: 'w6', title: 'Call the right service', text: 'Walter broke his hip. Tap his room, then Call a consult, then Orthopedics. Call the wrong service, or call before the results are back, and the consultant gets angry and slow.',
    spot: () => { const p = tid('walter'); if (sheetIs('consult')) return ['#sheet [data-act="consultSpec"][data-arg="ortho"]']; return onSheet(p) ? ['#sheet [data-act="consultOpen"]'] : [roomSel(p)]; },
    done: () => tid('walter').consult.st !== 'none' || tid('walter').loc === 'gone', auto: () => E.consult(tid('walter').id, 'ortho') },
  { id: 'w7', wait: true, title: 'Admitted', text: 'Orthopedics sees him and admits him. Now he waits for a bed upstairs. That wait is called boarding, and it is why EDs back up.', done: () => ['callrep', 'reporting', 'bedready', 'xportq'].includes(tid('walter').dsp) || tid('walter').loc === 'gone' },
  { id: 'w8', wait: true, title: 'Calling report', text: 'A bed opened upstairs. His nurse calls report to the floor before he can go.', done: () => ['bedready', 'xportq'].includes(tid('walter').dsp) || tid('walter').loc === 'gone' },
  { id: 'w9', title: 'Send him up', text: 'Tap his room, then Ray from transport. A tech can take him too, but then that tech is off your floor.', ...roomAct('walter', '[data-act="sendUp"][data-arg$="|tp1"]'),
    done: () => tid('walter').dsp === 'xportq' || tid('walter').loc === 'gone', auto: () => E.sendUp(tid('walter').id, 'tp1') },

  { id: 't1', title: 'The Box is ringing', text: 'An ambulance is calling in a trauma alert. Tap Take report so the trauma team is ready when he gets here.',
    setup: () => ({ trauma: E.trainPatient('mvc', 'alert', { name: 'Tyler B.', age: 19, sex: 'M', unit: 'Medic 21', eta: 8 }) }),
    spot: () => ['#boxbar .bx-btn'], done: () => !!tid('trauma').pren, auto: () => E.boxNotify() },
  { id: 't2', title: 'Get blood moving', text: 'He rolled his car. BP 78/40 and pale: he is bleeding out. Tap him in the Ambulance bay, then Activate massive transfusion. Don’t wait for him to arrive.',
    spot: () => { const p = tid('trauma'); return onSheet(p) ? ['#sheet [data-act="mtp"]'] : [mag(p.id)]; }, done: () => !!tid('trauma').bb, auto: () => E.activateMTP(tid('trauma').id) },
  { id: 't3', wait: true, title: 'Inbound', text: 'The blood bank is packing a cooler. Keep a resus bay clean for him.', done: () => tid('trauma').loc !== 'enroute' },
  { id: 't4', title: 'Straight to Resus', text: 'Critical patients skip registration and triage. Tap him, then Resus 1.', ...bedStep('trauma', 'R1') },
  { id: 't5', title: 'Attending only', text: 'ESI 1 needs an attending. Tap Dr. Okafor, then Resus 1.', ...provStep('trauma', 'md2') },
  { id: 't6', title: 'Pull a second nurse', text: 'An active resuscitation takes a nurse and a half. Tap the Resus header, then add Casey, your resource nurse.',
    spot: () => (sheetIs('zone', 'resus') ? ['#sheet [data-act="zt"][data-arg="rnX|resus"]'] : ['#zh-resus']),
    done: () => E.staff('rnX').zones.includes('resus'), auto: () => E.toggleZone('rnX', 'resus') },
  { id: 't7', wait: true, title: 'To the OR', text: 'A tech runs the cooler, his nurse hangs the blood, and the trauma surgeon takes him to the OR. Without blood in the first 15 minutes, he would go into shock.', done: () => tid('trauma').loc === 'gone' },

  { id: 'c1', title: 'Medical direction', text: 'The Box again: a medic needs orders, and only an attending can give medical direction. Tap Find a doctor, then pick Dr. Patel. The doctor handles the call.',
    setup: () => { E.trainConsult(); return null; },
    spot: () => (sheetIs('boxdoc') ? ['#sheet [data-act="boxDoc"][data-arg="md1"]'] : ['#boxbar .bx-btn']),
    done: () => { const c = g().box.cur; return !c || !!c.taken; }, auto: () => E.boxTake('md1') },
  { id: 'c2', wait: true, title: 'On the line', text: 'Dr. Patel gives the medic orders. That takes about 5 minutes of the doctor\u2019s time, so pick a doctor who isn\u2019t in a code.', done: () => !g().box.cur },

  { id: 'g1', title: 'Chest pain at the door', text: 'Grace, 58, walked in with chest pressure. Chest pain gets an ECG within 10 minutes. Tap her, then register and triage her from her card.',
    setup: () => ({ grace: E.trainPatient('cpmod', 'walk', { name: 'Grace T.', age: 58, sex: 'F' }) }), ...intakeStep('grace', 'reg1', 'rnT') },
  { id: 'g2', wait: true, title: 'Triage', text: 'A tech does her ECG while Bea triages.', done: () => tid('grace').tri === 'done' },
  { id: 'g3', title: 'No waiting', text: 'She is ESI 2: a room now, not the waiting room or a hallway. Tap her, then Room 10 in Pod C.', ...bedStep('grace', '10') },
  { id: 'g4', title: 'A PA or NP for ESI 2', text: () => `Tap Chen, then ${E.roomName(tid('grace').room || '10')}. PAs and NPs can take ESI 2. An attending co-signs before she leaves.`, ...provStep('grace', 'np1') },
  { id: 'g5', wait: true, title: 'Workup', text: 'ECG, labs, and a chest X-ray. Then an attending co-signs.', done: () => tid('grace').dsp !== 'none' || tid('grace').loc === 'gone' },
  { id: 'g6', title: 'Your call', text: () => `Her HEART score is ${tid('grace').gray ? tid('grace').gray.score : 5}. Low risk (0 to 3) goes home. Moderate (4 to 6) goes to observation. High (7 and up) gets admitted. Tap her room and choose.`,
    ...roomAct('grace', '[data-act="gray"][data-arg$="|obs"]'), done: () => !!tid('grace').grayPick || tid('grace').loc === 'gone', auto: () => E.grayDispo(tid('grace').id, 'obs') },

  { id: 'h1', title: 'Free a bed', text: 'Jordan was seen and is waiting on a strep test. He doesn’t need a bed for that. Tap his room, then Move bed, then Chair 1 at the bottom of the board.',
    setup: () => ({ jordan: E.trainPatient('strep', 'seat', { room: '9', prov: 'pa1', name: 'Jordan P.', age: 22, sex: 'M', run: { lab: 15 } }) }),
    spot: () => { const p = tid('jordan'); if (U.sel && U.sel.type === 'move' && U.sel.pid === p.id) return ['#room-C1']; return onSheet(p) ? ['#sheet [data-act="moveSel"]'] : [roomSel(p)]; },
    done: () => { const r = E.roomOf(tid('jordan')); return !r || r.kind === 'chair'; }, auto: () => E.move(tid('jordan').id, 'C1') },

  { id: 'r1', title: 'Walk the waiting room', text: 'Two people are waiting. An honest update buys patience, so fewer walk out. Tap the Waiting room header, then Walk the waiting room.',
    setup: () => ({ sofia: E.trainPatient('ankle', 'waiting', { name: 'Sofia R.', age: 27, sex: 'F', waited: 35 }), victor: E.trainPatient('afib', 'waiting', { name: 'Victor S.', age: 71, sex: 'M', waited: 20, esiT: 3, lang: 'es' }) }),
    spot: () => (sheetIs('zone', 'triage') ? ['#sheet [data-act="updWait"]'] : ['.lane-h[data-arg="triage"]']),
    done: () => g().wrUpdate > -1e8, auto: () => E.updateWaiting() },
  { id: 'r2', title: 'Recheck', text: 'Triage called Victor ESI 3. Look at his heart rate. Rechecks catch people who are sicker than their triage. Tap Victor, then Details, then Bea under Recheck vitals.',
    spot: () => { const p = tid('victor'); if (onSheet(p)) return ['#sheet [data-act="recheck"][data-arg$="|rnT"]']; return selPt(p) ? ['#selbar [data-act="selInfo"]'] : [mag(p.id)]; },
    done: () => { const p = tid('victor'), b = E.staff('rnT'); return p.esiT == null || b.tq.some(k => k.pid === p.id && k.kind === 'recheck') || !!(b.task && b.task.kind === 'recheck' && b.task.pid === p.id); },
    auto: () => E.recheck(tid('victor').id, 'rnT') },
  { id: 'r3', wait: true, title: 'Rechecking', text: 'Bea redoes his vitals.', done: () => tid('victor').esiT == null },
  { id: 'r4', title: 'Bed him now', text: 'Victor is really ESI 2: his heart is racing. Tap him, then Room 13 in Pod D.', ...bedStep('victor', '13') },
  { id: 'r5', title: 'Interpreter', text: 'Victor speaks Spanish. Without an interpreter, care is slower and riskier, and he is likelier to come back. Tap his room, then Get a Spanish interpreter.',
    ...roomAct('victor', '[data-act="interp"]'), done: () => tid('victor').interp !== 'none' || tid('victor').loc === 'gone', auto: () => E.requestInterp(tid('victor').id) },

  { id: 's1', title: 'Breaks', text: 'Tired staff slow down, and at the bottom they walk out. Open Team, then send Mo, a tech, on a 30-minute break.',
    spot: () => (sheetIs('team') || U.wide ? ['#sheet [data-act="brk"][data-arg="pct1"]', '#side [data-act="brk"][data-arg="pct1"]'] : ['#dockTeam']),
    done: () => E.staff('pct1').st !== 'on', auto: () => E.sendBreak('pct1') },

  { id: 'd1', title: 'Something broke', text: 'The CT scanner just went down. Strokes and head injuries need a hospital with a working scanner. Tap Divert, then Go on CT Divert.',
    setup: () => { E.trainOutage('ct', 8); return null; },
    spot: () => (sheetIs('divert') ? ['#sheet [data-act="divertSet"][data-arg="ct|1"]'] : ['#btnYellow']),
    done: () => g().dv.ct.on, auto: () => E.setDivert('ct', true) },
  { id: 'd2', wait: true, title: 'Biomed is on it', text: 'While you are on CT Divert, ambulances with strokes and head injuries go elsewhere.', done: () => !E.outActive('ct') },
  { id: 'd3', title: 'Lift it', text: 'CT is back. Staying on divert after the fix costs you. Tap Divert, then Lift CT Divert.',
    spot: () => (sheetIs('divert') ? ['#sheet [data-act="divertSet"][data-arg="ct|0"]'] : ['#btnYellow']),
    done: () => !g().dv.ct.on, auto: () => E.setDivert('ct', false) },

  { id: 'x1', title: 'A transfer', text: 'Zoe, 1, has RSV and is tiring out. She needs a pediatric ICU, and you don’t have one. Tap her room in Resus, then Request transfer.',
    setup: () => ({ zoe: E.trainPatient('rsv', 'seat', { room: 'R2', prov: 'md1', name: 'Zoe N.', age: 1, sex: 'F', dsp: 'readytx' }) }),
    ...roomAct('zoe', '[data-act="tx"]'), done: () => tid('zoe').dsp !== 'readytx', auto: () => E.requestTransfer(tid('zoe').id) },
  { id: 'x2', wait: true, title: 'Calling around', text: 'The transfer center calls the pediatric ICU. RT starts high-flow oxygen meanwhile.', done: () => tid('zoe').dsp !== 'txcall' },
  { id: 'x3', title: 'Book the ambulance', text: 'The PICU said yes. She is ICU-level, so she needs critical care transport; an ALS crew would refuse her. Tap her room, then Critical care transport.',
    ...roomAct('zoe', '[data-act="ift"][data-arg$="|cct"]'), done: () => tid('zoe').dsp !== 'txok', auto: () => E.bookIFT(tid('zoe').id, 'cct') },

  { id: 'end', final: true, title: 'You’re ready', text: 'That’s the job: intake, beds, providers, consults, the Box, blood, the waiting room, nurses, divert, and transfers. A real shift throws all of it at you at once, and every shift report walks you through your three worst moments. Start with Quiet Tuesday.' },
];
const me = () => g().me;
const seeStep = (key) => ({
  spot: () => { const p = tid(key); return onSheet(p) ? ['#sheet [data-act="see"]'] : [roomSel(p)]; },
  done: () => tid(key).prov === me(), auto: () => E.assign(me(), tid(key).id),
});
const ordStep = (key, list) => ({     // list: [['t', 'lab'], ['r', 'meds']]
  spot: () => {
    const p = tid(key); if (!onSheet(p)) return [roomSel(p)];
    const o = U.ord && U.ord.pid === p.id ? U.ord : { tests: [], treats: [] };
    const next = list.find(([k, v]) => !(k === 't' ? o.tests : o.treats).includes(v) && !(k === 't' ? p.wk : p.tr).includes(v));
    return next ? [`#sheet [data-act="ordT"][data-arg="${p.id}|${next[0]}|${next[1]}"]`] : ['#sheet [data-act="sign"]'];
  },
  done: () => { const p = tid(key); return p.ord === 'signed' && list.every(([k, v]) => (k === 't' ? p.wk : p.tr).includes(v)); },
  auto: () => { const p = tid(key); U.ord = null; E.signOrders(p.id, list.filter(x => x[0] === 't').map(x => x[1]), list.filter(x => x[0] === 'r').map(x => x[1])); },
});
const callStep = (key, pick, spec) => ({
  spot: () => { const p = tid(key); if (sheetIs('consult')) return [`#sheet [data-act="consultSpec"][data-arg="${spec}"]`]; return onSheet(p) ? [`#sheet [data-act="mdd"][data-arg="${p.id}|${pick}"]`] : [roomSel(p)]; },
  done: () => { const p = tid(key); return !!p.mdPick || p.consult.st !== 'none' || p.loc === 'gone'; },
  auto: () => { const p = tid(key); return pick === 'consult' ? E.consult(p.id, spec) : E.mdDecide(p.id, pick); },
});
const STEPS_MD = [
  { id: 'hi', next: true, title: 'Welcome, Doctor', text: "You're the attending. The charge nurse runs the board: intake, beds, nurses, EVS. You see patients, write orders, make the call, and answer the radio when a medic needs medical direction. The clock only runs when we're waiting. Nothing counts." },
  { id: 'rack', next: true, title: 'Your board', text: 'Rooms marked Needs a provider are waiting for a doctor. Your patients show YOU. Leave someone too long and another provider picks them up.', spot: () => ['#zh-a', '#zbar'] },
  { id: 'you', next: true, title: 'Your line', text: 'You are Dr. Patel, at the bottom. Your tile shows what you are doing now and how many patients are in your line.', spot: () => ['#dockProv [data-arg="md1"]', '#sideProv [data-arg="md1"]'] },

  { id: 'j1', title: 'Sore throat', text: 'Room 1: Jordan, 22, sore throat and fever. Tap his room, then See this patient.',
    setup: () => ({ jordan: E.trainPatient('strep', 'room', { room: '1', name: 'Jordan P.', age: 22, sex: 'M' }) }), ...seeStep('jordan') },
  { id: 'j2', wait: true, title: 'In the room', text: 'You take a history and examine him.', done: () => tid('jordan').ord === 'need' },
  { id: 'j3', title: 'Write orders', text: 'Order what he needs and nothing extra. Extra tests cost time, and a CT costs radiation. Sore throat with fever: a rapid strep (Labs) and penicillin (Medications). Tap his room, then Labs, Medications, and Sign.', ...ordStep('jordan', [['t', 'lab'], ['r', 'meds']]) },
  { id: 'j4', wait: true, title: 'Results', text: 'A tech swabs him, and you review the result.', done: () => tid('jordan').dsp === 'mddecide' || !!tid('jordan').mdPick },
  { id: 'j5', title: 'Your call', text: 'Strep throat. Tap his room, then Discharge home.', ...callStep('jordan', 'home') },
  { id: 'j6', wait: true, title: 'Going home', text: 'His nurse gives him the prescription and the discharge teaching.', done: () => tid('jordan').loc === 'gone' },

  { id: 'a1', title: 'Vomiting, sugar very high', text: 'Room 5: Aisha, 24, ESI 2. Tap her room, then See this patient.',
    setup: () => ({ aisha: E.trainPatient('dka', 'room', { room: '5', name: 'Aisha K.', age: 24, sex: 'F' }) }), ...seeStep('aisha') },
  { id: 'a2', wait: true, title: 'In the room', text: 'Fruity breath, fast deep breathing, dry mouth.', done: () => tid('aisha').ord === 'need' },
  { id: 'a3', title: 'Treat what you find', text: 'This looks like DKA: labs, IV fluids, and an insulin drip. Tap Labs, IV fluids, and Insulin drip, then Sign.', ...ordStep('aisha', [['t', 'lab'], ['r', 'fluids'], ['r', 'insulin']]) },
  { id: 'a4', wait: true, title: 'Results', text: 'Glucose 540, anion gap 26. Pharmacy checks the insulin, and her nurse starts the drip.', done: () => tid('aisha').dsp === 'mddecide' || !!tid('aisha').mdPick },
  { id: 'a5', title: 'Admit her', text: 'DKA on an insulin drip goes to the ICU. Tap her room, then Admit: call a consult, then Critical Care.', ...callStep('aisha', 'consult', 'icu') },
  { id: 'a6', wait: true, title: 'Admitted', text: 'Critical Care comes down and admits her. The charge nurse handles the bed and the transport.', done: () => E.isBoarder(tid('aisha')) || tid('aisha').loc === 'gone' },

  { id: 'b1', title: 'Belly pain', text: 'Room 9: Sam, 19, belly pain that moved to the right side. Tap his room, then See this patient.',
    setup: () => ({ sam: E.trainPatient('appy', 'room', { room: '9', name: 'Sam O.', age: 19, sex: 'M' }) }), ...seeStep('sam') },
  { id: 'b2', wait: true, title: 'In the room', text: 'Tender over the right lower belly.', done: () => tid('sam').ord === 'need' },
  { id: 'b3', title: 'A thin workup', text: "Let's see what a missing test looks like. Order only Labs and Medications this time, then Sign.", ...ordStep('sam', [['t', 'lab'], ['r', 'meds']]) },
  { id: 'b4', wait: true, title: 'Waiting on labs', text: 'The labs come back.', done: () => tid('sam').ord === 'more' || !!tid('sam').dxK },
  { id: 'b5', title: 'Something is missing', text: 'WBC 15.8, but labs alone cannot diagnose right-sided belly pain. Add the CT, then Sign. Every gap costs time.', ...ordStep('sam', [['t', 'ct']]) },
  { id: 'b6', wait: true, title: 'CT', text: 'The CT shows an inflamed appendix.', done: () => tid('sam').dsp === 'mddecide' || !!tid('sam').mdPick },
  { id: 'b7', title: 'Call surgery', text: 'Appendicitis goes to the OR. Tap his room, then Admit: call a consult, then General Surgery. Consultants get angry if you call before their results are back.', ...callStep('sam', 'consult', 'surg') },

  { id: 'r1', title: 'The radio', text: 'A medic needs orders, and only you can give them. Tap Answer, read the call, then approve or deny.',
    setup: () => { E.trainConsult(); return null; },
    spot: () => { if (U.modal && U.modal.type === 'scen') return ['#modal [data-act="scen"]']; if (U.modal && U.modal.type === 'result') return ['#modal [data-act="modalOk"]']; return ['#boxbar .bx-btn']; },
    done: () => g().stats.boxC.ans >= 1 && !U.modal,
    auto: () => { const c = g().box.cur; let sc = U.modal && U.modal.sc; if (c && c.kind === 'consult') { if (!c.taken) { const r = E.boxTake(me()); sc = r.sc; } E.boxDecide(sc ? sc.a : true); } U.modal = null; U.sheet = null; } },

  { id: 's1', wait: true, title: 'Stroke alert', text: 'The charge nurse took a stroke alert: a man in his 70s who cannot move his right side. Neurology is paged. The charge nurse will have him in a room in a few minutes.',
    setup: () => ({ stroke: E.trainPatient('stroke', 'alert', { name: 'Harold W.', age: 74, sex: 'M', unit: 'Medic 14', eta: 6 }) }), done: () => tid('stroke').loc === 'room' },
  { id: 's2', title: 'Time is brain', text: () => `Every minute costs brain. Tap ${E.roomName(tid('stroke').room || 'R1')}, then See this patient.`, ...seeStep('stroke') },
  { id: 's3', wait: true, title: 'In the room', text: 'Right-sided weakness, slurred speech. Last known well 40 minutes ago.', done: () => tid('stroke').ord === 'need' },
  { id: 's4', title: 'Stroke orders', text: 'A CT to rule out bleeding, labs, and a thrombolytic. The nurse gives it once neurology agrees and the CT is clean. Tap CT, Labs, and Thrombolytic, then Sign.', ...ordStep('stroke', [['t', 'ct'], ['t', 'lab'], ['r', 'tnk']]) },
  { id: 's5', wait: true, title: 'Door to needle', text: 'CT in 25 minutes, thrombolytic in 60. Watch the goals on his card.', done: () => { const p = tid('stroke'); return (p.treat.tnk && p.treat.tnk.st === 'done') || p.loc === 'gone'; } },
  { id: 's6', wait: true, title: 'To the ICU', text: 'Neurology admits him to the ICU.', done: () => E.isBoarder(tid('stroke')) || tid('stroke').loc === 'gone' },

  { id: 'end', final: true, title: 'You’re ready, Doctor', text: 'That’s the job: see the sickest first, order what they need and nothing more, close the gaps, make the call, and answer the radio. Patients waiting on your orders or your decision cost you. Start with Quiet Tuesday.' },
];
const STEPS_NOW = () => (g() && g().mode === 'md' ? STEPS_MD : STEPS);
function coachSafe(fn) { try { return !!fn(); } catch (e) { return false; } }
function coachStep() { const t = TR(), L = STEPS_NOW(); return t ? L[Math.min(t.step, L.length - 1)] : null; }
function coachWaitDone() { const s = coachStep(); return !!(s && s.wait && coachSafe(s.done)); }
function coachAdvance() {
  const t = TR(); if (!t || t.step >= STEPS_NOW().length - 1) return;
  t.step++; t.t0 = g().t; U.sel = null; U.sheet = null; U.coachKey = null;
}
function coachRun() {
  const t = TR();
  if (!t) { U.hold = false; U.ff = 0; return; }
  if (t.t0 == null) t.t0 = g().t;
  for (let guard = 0; guard < 6; guard++) {
    const s = STEPS_NOW()[t.step];
    if (s.setup && !t.setup[s.id]) { t.setup[s.id] = 1; let ids = null; try { ids = s.setup(); } catch (e) { ids = null; } if (ids) Object.assign(t.ids, ids); }
    const stuck = s.wait && g().t - t.t0 > 150;   // a safety valve: never fast-forward forever
    if ((s.done && coachSafe(s.done)) || stuck) { coachAdvance(); continue; }
    break;
  }
  const s = coachStep();
  U.hold = !s.wait; U.ff = s.wait ? 18 : 0;
}
function coachSkip() {
  const s = coachStep(); if (!s) return;
  if (s.wait) {
    let n = 0; while (!coachSafe(s.done) && n++ < 1500 && !g().over) { if (g().card) E.botStep({ budget: 0 }); E.step(0.1); }
    if (!coachSafe(s.done)) coachAdvance();
    return;
  }
  if (s.auto) { try { s.auto(); } catch (e) { /* fall through */ } }
  if (!(s.done && coachSafe(s.done))) coachAdvance();
}
function coachHTML(where) {
  const t = TR(); if (!t) return '';
  const s = coachStep(), n = STEPS_NOW().length;
  const title = typeof s.title === 'function' ? s.title() : s.title;
  let text = ''; try { text = typeof s.text === 'function' ? s.text() : s.text; } catch (e) { text = ''; }
  const btns = s.final ? '<button type="button" data-act="coachDone">Menu</button><button type="button" class="go" data-act="coachEasy">Start Quiet Tuesday</button>'
    : s.next ? '<button type="button" class="skip" data-act="coachExit">Exit</button><button type="button" class="go" data-act="coachNext">Next</button>'
    : s.wait ? '<span class="cff">Fast-forwarding…</span><button type="button" class="skip" data-act="coachSkip">Skip ahead</button>'
    : '<button type="button" class="skip" data-act="coachExit">Exit</button><button type="button" class="skip" data-act="coachSkip">Do it for me</button>';
  return `<div class="coach-c ${where}"><div class="ck">Preceptor · ${t.step + 1} of ${n}</div><h4>${esc(title)}</h4><p>${esc(text)}</p><div class="cb">${btns}</div></div>`;
}
function renderCoach() {
  const el = $('#coach'), t = TR();
  document.body.classList.toggle('training', !!t);
  const inner = !!(U.sheet || U.modal || (g() && g().card) || U.paused);
  const h = t && !inner ? coachHTML('float') : '';
  setH(el, h); el.hidden = !h;
  for (const x of document.querySelectorAll('.coach-spot')) x.classList.remove('coach-spot');
  if (!t) return;
  const s = coachStep(); if (!s || !s.spot) return;
  let sels = []; try { sels = s.spot().filter(Boolean); } catch (e) { sels = []; }
  const els = [];
  for (const q of sels) for (const x of document.querySelectorAll(q)) if (x.offsetParent !== null || getComputedStyle(x).position === 'fixed') els.push(x);
  for (const x of els) x.classList.add('coach-spot');
  const key = t.step + '|' + sels.join(',');
  if (key === U.coachKey || !els.length) return;
  U.coachKey = key;
  const x = els[0];
  if (x.closest('.sheet-body, .modal, .dock, .top, .side')) x.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  else {
    const r = x.getBoundingClientRect(), top = ($('#top') || { offsetHeight: 0 }).offsetHeight;
    if (r.top < top + 8 || r.bottom > window.innerHeight - 250) x.scrollIntoView({ block: 'center' });
  }
}

/* ---------- modals (these pause the shift) ---------- */
function renderModal(G) {
  const wrap = $('#modalWrap'), el = $('#modal');
  let h = '';
  if (U.scene === 'game' && G.card && G.mode !== 'md') {
    const c = G.card;
    h = `<div class="mc-who">${esc(c.who)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><div class="mc-ch">${c.choices.map(x => `<button type="button" data-act="card" data-arg="${x.k}" ${x.dis ? 'disabled' : ''}><b>${esc(x.label)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>`;
  } else if (U.modal && U.modal.type === 'scen') {
    const m = U.modal;
    h = `<div class="mc-who">The Box · ${esc(m.unit)} · ${esc(m.doc)} on the line${m.pack === 'miemss' ? ' · Maryland protocols' : ''}</div><h3>Medical direction</h3><p class="scen">${esc(m.sc.q)}</p><div class="mc-ch two"><button type="button" class="go" data-act="scen" data-arg="1"><b>Approve</b></button><button type="button" class="no" data-act="scen" data-arg="0"><b>Deny</b></button></div>`;
  } else if (U.modal && U.modal.type === 'result') {
    const r = U.modal.r;
    h = `<div class="mc-res ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'Correct' : 'Incorrect'}</div><h3>You ${r.approve ? 'approved' : 'denied'} it</h3><p>${esc(r.sc.why)}</p><div class="mc-ch"><button type="button" data-act="modalOk"><b>Back to the floor</b></button></div>`;
  } else if (U.scene === 'game' && U.paused && !U.sheet) {
    h = `<div class="mc-who">${esc(E.LEVELS[G.level].name)} · ${E.clock()}</div><h3>Paused</h3><p>The department waits for you. It will not wait long. Your shift is saved on this device.</p><div class="mc-ch"><button type="button" data-act="resume"><b>Resume</b></button><button type="button" data-act="help"><b>How to play</b></button><button type="button" data-act="sound"><b>Sound: ${U.sound ? 'on' : 'off'}</b></button><button type="button" data-act="restart"><b>${U.armR && performance.now() - U.armR < 3000 ? 'Tap again to restart' : 'Restart this shift'}</b></button><button type="button" data-act="menu"><b>Quit to menu</b></button></div>`;
  }
  if (h && TR()) h = coachHTML('in') + h;
  wrap.hidden = !h; morph(el, h);
}
function isPaused() { const G = g(); return U.paused || !!U.modal || (G && !!G.card && G.mode !== 'md') || U.scene !== 'game'; }   // the computer charge nurse answers cards for the attending

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
    if (out.ok) { U.sel = null; sfx('tap'); } else toast(out.why, 'bad');
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
  if (r.closed) { toast(`${E.roomName(id)} is closed. Reopen it from the ${E.ZONE_NAME[r.z]} header.`, 'info'); return; }
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
  mdd: a => { const [pid, k] = a.split('|'); if (k === 'consult') { U.sheet = { type: 'consult', pid }; return; } res(E.mdDecide(pid, k), true); },
  mode: m => { U.mode = m === 'md' ? 'md' : 'rn'; store('oc-mode', U.mode); setH($('#title'), titleHTML()); },
  coachNext: () => coachAdvance(),
  coachSkip: () => coachSkip(),
  coachExit: () => { save(true); showTitle(); },
  coachDone: () => { store(trainedKey(g().mode), '1'); store('oc-save', null); showTitle(); },
  coachEasy: () => { store(trainedKey(g().mode), '1'); U.mode = g().mode || 'rn'; start('easy'); },
  recheck: a => { const [pid, sid] = a.split('|'); res(E.recheck(pid, sid)); },
  gray: a => { const [pid, k] = a.split('|'); res(E.grayDispo(pid, k), true); },
  upd: pid => res(E.updatePt(pid)),
  updWait: () => res(E.updateWaiting()),
  fcp: () => res(E.fullCapacity(), true),
  triAssign: a => { const [pid, sid] = a.split('|'); const r = E.triage(pid, sid); res(r, true); },
  toWait: pid => { const r = E.toWaiting(pid); if (r.ok) U.sel = null; res(r, true); },
  sendUp: a => { const [pid, sid] = a.split('|'); res(E.sendUp(pid, sid), true); },
  ift: a => { const [pid, k] = a.split('|'); res(E.bookIFT(pid, k), true); },
  prov: id => { const s = E.staff(id); if (MD() || (s && s.pit)) { U.sheet = { type: 'staff', sid: id }; return; } U.sel = U.sel && U.sel.type === 'prov' && U.sel.sid === id ? null : { type: 'prov', sid: id }; },
  zone: z => { if (MD()) { toast('The charge nurse runs nursing assignments.', 'info'); return; } U.sheet = { type: 'zone', z }; },
  team: () => { U.sheet = { type: 'team' }; },
  staffOpen: id => { U.sheet = { type: 'staff', sid: id }; },
  closeSheet: () => { U.sheet = null; },
  selCancel: () => { U.sel = null; },
  selInfo: () => { const s = U.sel; if (!s) return; U.sheet = s.type === 'prov' ? { type: 'staff', sid: s.sid } : { type: 'pt', pid: s.pid }; },
  boxAnswer: () => {
    const c = g().box.cur; if (!c) return;
    if (c.kind === 'notify') { if (MD()) return; const r = E.boxNotify(); if (r.ok) { toast(r.msg, 'good'); sfx('good'); } }
    else if (c.taken) return;
    else if (MD()) { const r = E.boxTake(g().me); if (!r.ok) { toast(r.why, 'bad'); return; } U.sheet = null; U.modal = { type: 'scen', sc: r.sc, unit: r.unit, doc: 'You', pack: r.pack }; }
    else U.sheet = { type: 'boxdoc' };
  },
  boxDoc: sid => { const r = E.boxTake(sid); if (!r.ok) { toast(r.why, 'bad'); return; } U.sheet = null; toast(`${E.staff(sid).name} is on the line with ${r.unit} and will give the orders`, 'good'); sfx('good'); },
  scen: a => { const r = E.boxDecide(a === '1'); U.modal = r ? { type: 'result', r } : null; if (r) sfx(r.ok ? 'good' : 'bad'); },
  modalOk: () => { U.modal = null; },
  card: k => { E.chooseCard(k); },
  assign: sid => { const s = U.sheet, r = E.assign(sid, s && s.pid); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : 'bad'); if (r.ok) U.sheet = null; },
  consultOpen: pid => { U.sheet = { type: 'consult', pid }; },
  consultSpec: spec => { const pid = U.sheet && U.sheet.pid, r = E.consult(pid, spec); toast(r.ok ? r.msg : r.why, r.ok ? 'good' : r.mad ? 'mad' : 'bad'); U.sheet = r.ok ? null : { type: 'pt', pid }; },
  dc: pid => res(E.discharge(pid), true),
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
  pause: () => { U.paused = !U.paused; if (U.paused) save(true); },
  resume: () => { U.paused = false; },
  speed: () => { U.speed = SPEEDS[(SPEEDS.indexOf(U.speed) + 1) % SPEEDS.length]; toast(`${U.speed}× speed`, 'info'); },
  sound: () => { U.sound = !U.sound; store('oc-sound', U.sound ? '1' : '0'); if (U.sound) ensureAudio(); if (U.scene === 'title') setH($('#title'), titleHTML()); },
  help: () => { U.sheet = { type: 'help' }; },
  pack: k => { U.pack = k; store('oc-pack', k); setH($('#title'), titleHTML()); },
  start: lvl => start(lvl),
  resumeSave: () => resumeSave(),
  restart: () => { const now = performance.now(); if (!U.armR || now - U.armR > 3000) { U.armR = now; render(); return; } U.armR = 0; start(U.lvl); },
  menu: () => { save(true); showTitle(); },
  pill: k => toast((MD() ? PILL_HELP_MD : PILL_HELP)[k], 'info'),
};
const PILL_HELP_MD = {
  wait: 'Average wait: door to doctor, from arrival to a provider, for every patient in the ED.',
  care: 'Your score: patients you saw, clean orders, right calls, time goals, and medical direction. Leaving your patients waiting on you costs points.',
  staff: 'Patients on your panel right now.',
  lwbs: 'Patients in a room with no provider yet. Pick them up before another provider has to.',
  wall: 'To do: your patients waiting on your orders or your decision.',
};
const PILL_HELP = {
  wait: 'Average wait: door to provider, for everyone who arrived this shift (still-waiting patients count too). A provider in triage brings it down.',
  care: 'Patient management score: earned by moving patients, hitting alert times, and good Box calls. Lost to LWBS, AMA, 72-hour returns, wall time, unsafe ratios, and angry consultants.',
  staff: 'Staff satisfaction: average morale. Breaks and backup help. Over-ratio pods, mandates, and missed breaks hurt. Below 20% the staff walk out.',
  lwbs: 'Left without being seen. Each one costs points, and some come back sicker.',
  wall: 'Ambulances waiting on your wall. Offload within 30 minutes or the EMS system will call.',
};

/* ---------- save and resume (this device only) ---------- */
function save(force) {
  const G = g();
  if (U.scene !== 'game' || !G || G.over) return;
  const now = Date.now();
  if (!force && now - U.lastSave < 15000) return;
  U.lastSave = now;
  try { localStorage.setItem('oc-save', JSON.stringify({ G, lvl: U.lvl, pack: G.pack, at: now })); } catch (e) { /* storage full or blocked */ }
}
function readSave() { try { const s = localStorage.getItem('oc-save'); if (!s) return null; const d = JSON.parse(s); return d && d.G && d.G.v === 5 && !d.G.over ? d : null; } catch (e) { return null; } }
function resumeSave() {
  const d = readSave(); if (!d) { toast('No saved shift on this device', 'bad'); return; }
  E.load(d.G); U.lvl = d.lvl; U.mode = d.G.mode || 'rn'; U.scene = 'game'; U.sel = null; U.sheet = null; U.modal = null; U.paused = true; U.speed = 1;
  $('#title').hidden = true; $('#report').hidden = true;
  render();
}

/* ---------- scenes ---------- */
const DOT = { easy: 'var(--e4)', med: 'var(--e3)', hard: 'var(--e1)' };
const BLURB_MD = { easy: 'Fewer patients, fewer radio calls. Learn the orders.', med: 'A normal busy day. The radio keeps ringing.', hard: 'Sicker patients, all at once. Good luck.' };
function bestOf(l, mode) { return +(store('oc-best-' + ((mode || U.mode) === 'md' ? 'md-' : '') + l) || 0); }
const trainedKey = mode => (mode === 'md' ? 'oc-trained-md' : 'oc-trained');
function titleHTML() {
  const md = U.mode === 'md';
  const fresh = !['easy', 'med', 'hard'].some(k => bestOf(k));
  const modes = `<div class="modes" role="group" aria-label="Your role"><button type="button" class="mode${md ? '' : ' on'}" data-act="mode" data-arg="rn" aria-pressed="${!md}"><b>Charge nurse</b><small>Run the board</small></button><button type="button" class="mode${md ? ' on' : ''}" data-act="mode" data-arg="md" aria-pressed="${md}"><b>Attending</b><small>See patients, write orders</small></button></div>`;
  const tb = md ? 'A senior attending walks you through patients, orders, results, the call, and the radio. Nothing counts.' : E.LEVELS.train.blurb;
  const train = `<button type="button" class="lvl train" data-act="start" data-arg="train"><span class="dot" style="background:var(--accent)"></span><span><b>${E.LEVELS.train.name}</b><small>${tb}</small></span>${store(trainedKey(U.mode)) ? '<span class="best">Done ✓</span>' : fresh ? '<span class="best go">Start here</span>' : ''}</button>`;
  const lv = train + ['easy', 'med', 'hard'].map(k => { const L = E.LEVELS[k], b = bestOf(k), st = b ? E.starsFor(b, k, U.mode) : 0; return `<button type="button" class="lvl" data-act="start" data-arg="${k}"><span class="dot" style="background:${DOT[k]}"></span><span><b>${L.name}</b><small>${md && BLURB_MD[k] ? BLURB_MD[k] : L.blurb}</small></span>${b ? `<span class="best">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>` : ''}</button>`; }).join('');
  const sv = readSave();
  const resume = sv ? `<button type="button" class="lvl resume" data-act="resumeSave"><span class="dot" style="background:var(--accent)"></span><span><b>Resume your shift</b><small>${sv.G.mode === 'md' ? 'Attending' : 'Charge nurse'}: ${esc(E.LEVELS[sv.lvl] ? E.LEVELS[sv.lvl].name : '')}, paused at ${E.clock(sv.G.t)}</small></span></button>` : '';
  const packs = Object.entries(E.PACKS).map(([k, P]) => `<button type="button" class="seg${U.pack === k ? ' on' : ''}" data-act="pack" data-arg="${k}" aria-pressed="${U.pack === k}">${esc(P.name)}</button>`).join('');
  return `<div class="card"><div class="t-kicker">An ED shift survival game</div><h1 class="t-brand">Overcrowded</h1><svg class="t-under" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 6 L297 6" stroke="#C8243A" stroke-width="3" fill="none" stroke-linecap="round"/></svg>${modes}<p class="t-sub">${md ? "You're an attending in a 32-bed ED, 07:00 to 19:00. The charge nurse runs the board. You see patients, write the orders, make the calls, and answer the radio when a medic needs medical direction." : "You're the charge nurse for a 32-bed ED, 07:00 to 19:00. Five pods, a resus team, a radio that won't stop ringing, and an administrator who just walked in."}</p><div class="levels">${resume}${lv}</div>${md ? `<div class="packs"><span>Medical direction calls</span><div class="segs">${packs}</div><small>${esc(E.PACKS[U.pack].note)}</small></div>` : ''}<div class="t-links"><button type="button" data-act="help">How to play</button><button type="button" data-act="sound">Sound: ${U.sound ? 'on' : 'off'}</button></div></div>`;
}
function clearToasts() { const b = $('#toasts'); if (b) b.innerHTML = ''; }
function showTitle() {
  clearToasts();
  U.scene = 'title'; U.sel = null; U.sheet = null; U.modal = null; U.paused = false;
  E.newGame('med', 4242);
  for (let i = 0; i < 160; i++) { E.step(0.25); E.botStep({}); }
  $('#report').hidden = true;
  const t = $('#title'); t.hidden = false; setH(t, titleHTML());
  render();
}
function start(lvl) {
  ensureAudio();
  U.lvl = lvl; U.scene = 'game'; U.sel = null; U.sheet = null; U.modal = null; U.paused = false; U.speed = 1;
  store('oc-save', null);
  E.newGame(lvl, lvl === 'train' ? 20261116 : (Math.random() * 2147483647) | 0, { pack: U.pack, mode: U.mode });
  $('#title').hidden = true; $('#report').hidden = true;
  U.coachKey = null;
  const helpKey = 'oc-seen-help2' + (U.mode === 'md' ? '-md' : '');
  if (lvl !== 'train' && !store(helpKey)) { store(helpKey, '1'); U.paused = true; U.sheet = { type: 'help' }; }
  render();
  if (lvl !== 'train') toast(`${E.LEVELS[lvl].name}. ${U.mode === 'md' ? "You're on as the attending." : 'Night shift hands you the board.'}`, 'info');
}
const VERDICT_MD = ['Rough one. Everybody survived the shift, mostly.', 'You kept your patients moving. Tomorrow will be better.', 'Solid shift. The nurses like working with you.', 'Attending of the year. The residents want to copy your orders.'];
const VERDICT = ['Rough one. Everybody survived the shift, mostly.', 'You kept the doors open. Tomorrow will be better.', 'Solid shift. The night charge owes you.', 'Charge nurse of the year. Somebody frame this board.'];
function reportHTML(R) {
  const L = E.LEVELS[R.level], led = g().ledger;
  const LED = { md: 'Patients you saw', orders: 'Orders', harm: 'Harm and untreated patients', dispo: 'Disposition calls', flow: 'Patients moved', goals: 'Alert time goals', box: 'The Box', consult: 'Consults', lwbs: 'Left without being seen', ama: 'Left against advice', returns: '72-hour returns', wall: 'Wall time', ratio: 'Over-ratio nursing', uncovered: 'Uncovered patients', safety: 'Safety events', hall: 'Hallway beds', sitter: 'Missing sitters', waiting: 'Waiting-room crashes', admin: 'Administration', staffing: 'Staffing costs', divert: 'Divert', blood: 'Bleeding and blood', transfer: 'Transfers', gray: 'Gray-zone calls', chair: 'Admitted patients in chairs', experience: 'Complaints' };
  const rows = Object.entries(led).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${LED[k] || k}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${Math.round(v)}</td></tr>`).join('');
  const t = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  return `<div class="card rep"><h2>${R.fail ? 'The staff walked out' : R.mode === 'md' ? 'Attending shift report' : 'Shift report'}</h2><div class="stars" aria-label="${R.stars} of 3 stars">${'★'.repeat(R.stars)}${'☆'.repeat(3 - R.stars)}</div><p class="verdict">${R.fail ? 'Staff satisfaction hit the floor and your nurses went home. Breaks, backup, and fewer mandates keep people around.' : (R.mode === 'md' ? VERDICT_MD : VERDICT)[R.stars]} ${esc(L.name)}${R.mode === 'md' ? `, ${esc(E.PACKS[R.pack].name)} medical direction` : ''}.</p>
<div class="rep-big"><div><b>${R.care}</b><span>${R.mode === 'md' ? 'Score' : 'Pt mgmt'}</span></div><div><b>${R.wait}m</b><span>Avg wait</span></div>${R.mode === 'md' && R.md ? `<div><b>${R.md.seen}</b><span>You saw</span></div>` : `<div><b>${R.sat}%</b><span>Staff sat</span></div>`}</div>
${mmHTML(R)}${mdReportHTML(R, t)}
<h4>Where your points came from</h4><table class="ledger">${rows || t('Nothing yet', '0')}</table>
${metricsHTML(R, t)}
${R.mode === 'md' ? mdDeptHTML(R, t) : `<h4>Patients</h4><table>${t('Arrived this shift', R.seen)}${t('Discharged home', R.dc)}${t('Sent home from triage', R.pitDc)}${t('Admitted upstairs', R.adm)}${t('To the OR or cath lab', R.proc)}${t('Transferred out', R.tx)}${t('Left without being seen', R.lwbs)}${t('Left against medical advice', R.ama)}${t('72-hour returns', R.returns)}${t('Still in the ED at 19:00', R.left)}</table>
<h4>EMS and the Box</h4><table>${t('Average EMS wall time (arrival to hand-off)', R.wallAvg + 'm')}${t('EMS handed off to the waiting room', R.offloads)}${t('Units on the wall over 30 min', R.wallOver)}${t('Medical direction calls sent to a doctor', `${R.boxC.ans} of ${R.boxC.ans + R.boxC.miss}`)}${t('Alert reports taken', `${R.boxN.ans} of ${R.boxN.ans + R.boxN.miss}`)}${t('Alert time goals met', `${R.goalsMet} of ${R.goalsMet + R.goalsMiss}`)}${t('Ambulances diverted', `${R.diverted} (${R.yellowMins}m yellow, ${R.redMins}m red)`)}</table>
<h4>Outages and diversion</h4><table>${R.outages.length ? R.outages.map(o => t(`${esc(E.OUTAGES[o.k].name)} at ${E.clock(o.t0)}`, o.divertAt == null ? `No ${esc(E.DIVERTS[E.OUTAGES[o.k].fix].name)}${o.misses ? ` · ${o.misses} came anyway` : ''}` : `${esc(E.DIVERTS[E.OUTAGES[o.k].fix].short)} divert in ${Math.round(o.divertAt - o.t0)}m${o.misses ? ` · ${o.misses} came first` : ''}${o.after ? ` · ${o.after}m too long` : ''}`)).join('') : t('Nothing broke this shift', '')}${R.divertExtra ? t('Minutes on a specific divert with nothing broken', R.divertExtra) : ''}</table>
<h4>Services</h4><table>${t('Interpreters requested', `${R.interp} for ${R.lep} patients who needed one`)}${t('Massive transfusions', `${R.mtp}${R.mtpWaste ? ` (${R.mtpWaste} not needed)` : ''}`)}${t('Patients who went into shock', R.shock)}${t('O-negative units used', R.oneg)}${t('Meds pulled on override', `${R.overrides} (${R.medErrors} errors)`)}${t('Seen by a provider in triage', R.pitSeen)}${t('Registered / triaged', `${R.registered} / ${R.triaged}`)}${t('Sent upstairs by transporter / tech', `${R.transports.tp} / ${R.transports.pct}`)}${t('Interfacility ambulances', `${R.ift.als} ALS · ${R.ift.cct} CCT · ${R.ift.air} air${R.iftRefused ? ` (${R.iftRefused} wrong level)` : ''}`)}</table>
<h4>Team</h4><table>${t('Angry consultants', R.angry + R.wrongSpec)}${t('Nurse-minutes over ratio', R.ratioMin)}${t('Safety events', R.adverse)}${t('Agency nurses / mandates', `${R.agency} / ${R.mandates}`)}${R.staffH ? t('RN hours (staff / agency / mandated)', `${R.staffH.rn} / ${R.staffH.agency} / ${R.staffH.mandated}`) + t('RN hours per patient', R.staffH.rnPerVisit) + t('Attending / PA and NP hours', `${R.staffH.md} / ${R.staffH.app}`) : ''}</table>`}
<div class="rep-btns"><button type="button" class="big act" data-act="restart">Run it back</button><button type="button" class="big" data-act="menu">Menu</button></div></div>`;
}
/* Morbidity and mortality: the three worst moments of the shift, and the decision behind each. */
function mdDeptHTML(R, t) {
  return `<h4>The department</h4><table>${t('Arrived this shift', R.seen)}${t('Discharged home', R.dc)}${t('Admitted upstairs', R.adm)}${t('To the OR or cath lab', R.proc)}${t('Transferred out', R.tx)}${t('Left without being seen', R.lwbs)}${t('72-hour returns', R.returns)}${t('Still in the ED at 19:00', R.left)}${t('Alert time goals met', `${R.goalsMet} of ${R.goalsMet + R.goalsMiss}`)}</table>`;
}
function mdReportHTML(R, t) {
  if (R.mode !== 'md' || !R.md) return '';
  const m = R.md;
  return `<h4>Your patients</h4><table>${t('Patients you saw', m.seen)}${t('ESI 1 and 2 seen within 10 min of a room', m.fast)}${t('Orders right / extra / missed', `${m.ordRight} / ${m.ordExtra} / ${m.ordMiss}`)}${t('Clean order sets', m.clean)}${t('Workups you had to add to', m.gaps)}${t('Patients hurt by an order', m.harm)}${t('Patients who got worse untreated', m.untreated)}${t('Disposition calls right / wrong', `${m.dispoRight} / ${m.dispoWrong}`)}${t('Medical direction calls answered', `${R.boxC.ans} of ${R.boxC.ans + R.boxC.miss}`)}${t('Medical direction calls right', `${R.boxC.right} of ${R.boxC.ans}`)}</table>`;
}
function mmHTML(R) {
  if (!R.mm) return '';
  if (!R.mm.length) return '<h4>M&amp;M</h4><p class="hint">Nothing went badly wrong this shift. Take the win.</p>';
  return `<h4>M&amp;M · your ${R.mm.length === 3 ? 'three ' : ''}worst moments</h4><ol class="mm">${R.mm.map(x => `<li><time>${E.clock(x.t)}</time><b>${esc(x.what)}</b><span>${esc(x.why)}</span></li>`).join('')}</ol>`;
}
function metricsHTML(R, t) {
  if (!R.m) return '';
  const m = R.m, mn = v => v == null ? '—' : v + 'm', gr = R.gray || {}, gn = (gr.right || 0) + (gr.ok || 0) + (gr.over || 0) + (gr.under || 0);
  return `<h4>ED metrics</h4><table>${t('Door to triage (median)', mn(m.d2t))}${t('Door to provider (median)', mn(m.d2p))}${t('Length of stay, discharged (median)', mn(m.losDc))}${t('Length of stay, admitted (median)', mn(m.losAdm))}${t('Boarding: admit decision to departure (median)', mn(m.board))}${t('Left without being seen', m.lwbsPct + '%')}${t('Left against medical advice', m.amaPct + '%')}${t('Admitted or observed', m.admitPct + '%')}${t('72-hour returns', m.retPct + '%')}${t('Hours on Yellow or Red Alert', m.capHours)}</table>
${R.mode === 'md' ? '' : `<h4>Patient experience</h4><table>${t('Experience score', R.px == null ? '—' : R.px + '%')}${t('Complaints', R.complaints)}${t('Updates you gave', R.updates)}${t('Minutes in hallway beds', R.hallMins)}</table>
<h4>Judgment calls</h4><table>${t('Gray-zone calls (right / defensible / too cautious / too bold)', gn ? `${gr.right} / ${gr.ok} / ${gr.over} / ${gr.under}` : '—')}${t('Went to observation', R.obs)}${t('Under-triaged / caught before harm', `${R.underTriage} / ${R.underCaught}`)}${t('Missed diagnoses from long provider lines', R.missedDx)}${t('Attending co-signs', R.cosign)}${t('Intubations (without an RT)', `${R.intub} (${R.intubNoRT})`)}${t('Moves to chairs', R.chairMoves)}${t('Full-capacity protocol', R.fcp)}${t('Regional diversion suspensions', R.suspended)}</table>`}`;
}
function showReport() {
  const G = g(), R = G.report; if (!R) return;
  U.scene = 'report'; U.sheet = null; U.modal = null; U.sel = null;
  clearToasts();
  store('oc-save', null);
  if (!R.fail && R.care > bestOf(R.level, R.mode)) store('oc-best-' + (R.mode === 'md' ? 'md-' : '') + R.level, String(R.care));
  const el = $('#report'); el.hidden = false; setH(el, reportHTML(R)); el.scrollTop = 0; window.scrollTo(0, 0);
  render();
}

/* ---------- loop ---------- */
let last = 0, lastR = 0, demoAcc = 0;
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - (last || now)) / 1000)); last = now;
  const G = g();
  if (G && U.scene === 'game' && !isPaused() && !G.over && !U.hold && !(U.freeze && !U.ff)) {   // U.freeze: test harness, turn-based play
    let left = dt * (U.ff || U.speed) * BASE;
    while (left > 1e-6) { const s = Math.min(0.1, left); E.step(s); left -= s; if (G.card || G.over) break; if (U.ff && coachWaitDone()) { U.ff = 0; U.hold = true; break; } }
    save(false);
  } else if (G && U.scene === 'title') {
    demoAcc += dt;
    if (demoAcc > 0.5) { demoAcc = 0; for (let i = 0; i < 2; i++) E.step(0.25); E.botStep({}); }
  }
  if (G && U.scene === 'game' && G.over) showReport();
  if (now - lastR > 110) { lastR = now; render(); }
  requestAnimationFrame(frame);
}
function bind() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    const tg = U.tapGuard;   // a double tap: the second tap lands where the first one closed a sheet
    if (el && tg && performance.now() < tg.t && Math.hypot(e.clientX - tg.x, e.clientY - tg.y) < 40 && !el.closest('#sheet, #modal, #coach')) return;
    const hadSheet = !!U.sheet, cx = e.clientX, cy = e.clientY; setTimeout(() => { if (hadSheet && !U.sheet) U.tapGuard = { t: performance.now() + 400, x: cx, y: cy }; }, 0);
    if (!el || el.disabled) return;
    ensureAudio();
    const fn = ACT[el.dataset.act];
    if (fn) { fn(el.dataset.arg, el); render(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (U.sel) U.sel = null; else if (U.sheet) U.sheet = null; render(); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && U.scene === 'game') { U.paused = true; save(true); render(); } });
  window.addEventListener('pagehide', () => save(true));
}
function boot(data) {
  data = data || {};
  if (store('oc-sound') === '0' || data.sound === false) U.sound = false;
  const pk = store('oc-pack'); if (pk && E.PACKS[pk]) U.pack = pk;
  if (store('oc-mode') === 'md') U.mode = 'md';
  buildBoard(); bind();
  for (const [id, txt] of [['laneEms', 'No ambulances waiting'], ['laneWait', 'Waiting room is empty']]) $('#' + id).dataset.empty = txt;
  if (data.G && data.G.v === 5 && data.G.running && !data.G.over) {
    E.load(data.G); U.scene = 'game'; U.mode = data.G.mode || 'rn'; U.lvl = data.lvl || data.G.level; U.speed = data.speed || 1; U.paused = true;
    $('#title').hidden = true;
    render();
  } else showTitle();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (U.scene === 'game' && g() && !g().over ? { G: g(), lvl: U.lvl, speed: U.speed, sound: U.sound } : { sound: U.sound })); } catch (e) { /* ignore */ }
  requestAnimationFrame(frame);
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
window.OCUI = { U, render, start, showTitle, coach: () => { const t = TR(), st = coachStep(); return t && st ? { i: t.step, id: st.id, wait: !!st.wait, next: !!st.next, final: !!st.final, n: STEPS_NOW().length } : null; } };
})();
