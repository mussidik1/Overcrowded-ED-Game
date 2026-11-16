/* Overcrowded ED — phone-first UI v0.2. Reads state from OC.G, sends taps to OC actions. */
(function () {
'use strict';
const E = window.OC;
const $ = (s, r) => (r || document).querySelector(s);
const SPEEDS = [1, 2, 3, 4];
const BASE = 0.4; // game minutes per real second at 1×: a 12-hour shift takes about 30 minutes
const U = { scene: 'title', lvl: 'med', pack: 'national', sel: null, sheet: null, modal: null, speed: 1, paused: false, sound: true, ringId: null, ringT: 0, wide: false, lastSave: 0 };
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
const ZSHORT = { resus: 'Resus', a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', hall: 'Hall', ft: 'FT' };
const dxShown = p => (p.dxK && (!p.alertOn || p.ev === 'done')) ? p.dx : null;
const dxOr = p => dxShown(p) || p.cc;
function emoji(p) { const a = p.age; if (a < 2) return '👶'; if (a < 13) return p.sex === 'F' ? '👧' : '👦'; if (a < 60) return p.sex === 'F' ? '👩' : '👨'; return p.sex === 'F' ? '👵' : '👴'; }
const esiKnown = p => p.tri === 'done' || p.alertOn || p.crash || p.arrest || ['room', 'waiting', 'gone'].includes(p.loc);
function esiChip(p) { return esiKnown(p) ? `<span class="esi e${p.esi}">${p.esi}</span>` : '<span class="esi eq">?</span>'; }
const intakeDone = p => p.loc === 'waiting' || p.loc === 'room' || (p.reg === 'done' && p.tri === 'done');
function istChip(lbl, st) { return `<i class="ist ${st === 'done' ? 'done' : st === 'doing' ? 'doing' : st === 'q' ? 'q' : 'need'}">${lbl}</i>`; }
function intakeChips(p) { return istChip('REG', p.reg) + istChip(p.loc === 'wall' ? 'REPORT' : 'TRIAGE', p.tri); }
function alertTag(p) { return p.alertOn && p.alert ? `<i class="atag a-${p.alert}">${esc(E.ALERTS[p.alert].name)}</i>` : ''; }
function langChip(p) { return p.lang ? `<i class="lg ${p.interp === 'on' ? 'on' : p.interp === 'req' ? 'req' : ''}" title="${esc(E.LANGS[p.lang])}">${p.lang.toUpperCase()}</i>` : ''; }
function stLabel(s) { return { break: 'On break', away: 'Off the floor', sick: 'Went home sick', off: 'Called out', pending: s.tag === 'swing shift' ? 'Starts at 11:00' : 'On the way', gone: 'Went home' }[s.st] || ''; }
function g() { return E.G; }
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
  renderHud(G); renderBox(G); renderObjs(G); renderSel(G); renderZoneBar(G); renderIntakeStaff(G); renderLanes(G); renderBoard(G); renderDock(G); renderSide(G); renderLog(G);
  renderSheet(G); renderModal(G);
  live(G);
  const top = $('#top'); if (top) document.documentElement.style.setProperty('--topH', top.offsetHeight + 'px');
}
function pill(id, val, cls) { const el = document.getElementById(id); setC(el, 'pill ' + (cls || '')); const b = el.querySelector('b'); if (b.textContent !== val) b.textContent = val; }
function renderHud(G) {
  const c = E.clock(); if ($('#clock').textContent !== c) $('#clock').textContent = c;
  const w = E.avgWait();
  pill('pWait', G.stats.arrived ? fm(w) : '—', !G.stats.arrived ? '' : w <= 30 ? 'good' : w <= 60 ? 'warn' : 'bad');
  pill('pCare', String(Math.round(G.care)), G.care < 0 ? 'bad' : G.care >= 1200 ? 'good' : '');
  const sat = E.staffSat(); pill('pStaff', Math.round(sat) + '%', sat >= 65 ? 'good' : sat >= 45 ? 'warn' : 'bad');
  pill('pLwbs', String(G.stats.lwbs), G.stats.lwbs ? 'bad' : '');
  const wall = E.active().filter(p => p.loc === 'wall').length, mw = E.maxWallNow();
  pill('pWall', String(wall), mw > 30 ? 'bad' : wall ? 'warn' : '');
  $('#shiftProg').style.width = Math.min(100, Math.max(0, G.t / G.shift * 100)).toFixed(2) + '%';
  const dv = $('#btnYellow');
  setC(dv, 'hb' + (G.red.on ? ' red' : G.yellow.on ? ' on' : ''));
  const dt = G.red.on ? 'Red' : G.yellow.on ? 'Yellow' : 'Divert'; if (dv.textContent !== dt) dv.textContent = dt;
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
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · ${esc(E.ALERTS[p.alert].name)} alert</span><span class="bx-txt">${esc(c.unit)}: ${p.age}${p.sex}, ${esc(p.cc)} · ETA <span data-cd="${p.eta}"></span></span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}<button type="button" class="bx-btn" data-act="boxAnswer">Take report</button>`;
  } else {
    cls += ' consult';
    h = `<span class="bx-led"></span><span class="bx-main"><span class="bx-name">The Box · Medical consult</span><span class="bx-txt">${esc(c.unit)} needs an attending on the line</span><i class="bx-bar"><i data-bar="${c.t0},${c.t0 + c.ring}"></i></i></span>${hold ? `<span class="bx-hold">+${hold}</span>` : ''}<button type="button" class="bx-btn" data-act="boxAnswer">Answer</button>`;
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
  for (const o of G.obj) {
    const lbl = o.k === 'nohall' ? (t < o.until ? 'Tracer: clear the hallways' : 'Tracer: keep hallways empty') : OBJ_LABEL[o.k];
    const end = o.k === 'nohall' && t >= o.until ? o.until2 : o.until;
    it.push(`<span class="ob goal"><b>${lbl}</b> · <span data-cd="${end}"></span></span>`);
  }
  if (G.red.on) it.push('<span class="ob red">Red Alert</span>');
  if (G.yellow.on) it.push('<span class="ob yellow">Yellow Alert</span>');
  if (G.img.ct.down > t) it.push(`<span class="ob bad">CT down · <span data-cd="${G.img.ct.down}"></span></span>`);
  if (G.mods.lab > t) it.push(`<span class="ob bad">Lab slow · <span data-cd="${G.mods.lab}"></span></span>`);
  if (G.mods.ehr > t) it.push(`<span class="ob bad">EHR down · <span data-cd="${G.mods.ehr}"></span></span>`);
  if (G.mods.shortage > t) it.push(`<span class="ob bad">Drug shortage · <span data-cd="${G.mods.shortage}"></span></span>`);
  if (G.mods.bbSlow > t) it.push(`<span class="ob bad">Blood bank slow · <span data-cd="${G.mods.bbSlow}"></span></span>`);
  if (G.mods.interpDown > t) it.push(`<span class="ob bad">Interpreter line down · <span data-cd="${G.mods.interpDown}"></span></span>`);
  if (!G.staff.some(s => s.role === 'rph' && s.st === 'on')) it.push(`<span class="ob bad">${G.mods.remoteRph ? 'Remote pharmacy only' : 'No pharmacist'}</span>`);
  if (G.mods.surge > t) it.push(`<span class="ob warn">EMS surge · <span data-cd="${G.mods.surge}"></span></span>`);
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
    h = `<span><b>${esc(st.name)}</b> ${s.type === 'reg' ? 'is registering. Tap patients who need registration (green).' : 'is triaging. Tap patients at the door who need triage (green).'}</span><button type="button" data-act="selCancel">Done</button>`;
  } else if (s) {
    const p = E.pt(s.pid);
    const wr = s.type === 'pt' && p.loc === 'wall' && p.esi >= 3 && !p.alertOn && intakeDone(p);
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
    const ns = E.zoneNurses(z.id), load = E.zoneLoad(z.id), cap = ns.length * 4, n = E.zonePts(z.id);
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
  if (U.sel && U.sel.type === 'reg') c += p.reg === 'none' && p.loc !== 'enroute' ? ' ok' : ' no';
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
  const wall = act.filter(p => p.loc === 'wall').sort((a, b) => a.esi - b.esi || a.tArrive - b.tArrive);
  syncList($('#laneEms'), wall.concat(G.enroute.map(E.pt)), G);
  const waiting = act.filter(p => p.loc === 'waiting').sort((a, b) => a.esi - b.esi || a.tArrive - b.tArrive);
  syncList($('#laneWait'), waiting.concat(G.triageQ.map(E.pt).filter(Boolean)), G);
  const mw = E.maxWallNow();
  const rep = wall.filter(p => p.tri !== 'done').length;
  const ei = $('#emsInfo'); setH(ei, `${wall.length ? `${wall.length} on the wall${rep ? ` · ${rep} waiting to give report` : ''} · longest ${fm(mw)}` : 'Clear'}${G.enroute.length ? ` · ${G.enroute.length} inbound` : ''}`); setC(ei, 'lane-i' + (mw > 30 ? ' bad' : ''));
  const tri = E.zoneNurses('triage').length, pit = G.staff.find(s => s.pit && E.present(s));
  const wi = $('#waitInfo'); setH(wi, `${waiting.length} waiting · ${G.triageQ.length} at the door${tri ? '' : ' · no triage nurse'}${pit ? ` · ${esc(pit.short)} in triage` : ''}`); setC(wi, 'lane-i' + (!tri ? ' bad' : ''));
}
function treatReason(p) {
  const ks = Object.keys(p.treat).filter(k => p.treat[k].st !== 'done');
  if (ks.some(k => p.treat[k].st === 'verify')) return 'Waiting on pharmacy';
  if (ks.some(k => E.TREAT[k].by === 'rt' && p.treat[k].st === 'todo')) return 'Waiting on RT';
  if (ks.includes('blood') && p.treat.blood.st === 'wait') return !p.bb ? 'Labs, then crossmatch' : p.bb.st === 'xm' ? 'Crossmatching blood' : 'O-neg on the way';
  if (ks.includes('mtp') && p.treat.mtp.st === 'wait') return 'MTP cooler coming';
  return 'Treatment underway';
}
function nextStep(p, r, G) {
  const pv = p.prov ? E.staff(p.prov) : null, nm = pv ? esc(pv.short) : '';
  if (p.arrest) return p.ev === 'doing' ? { t: 'Code in progress', c: 'n-code' } : p.ev === 'q' ? { t: 'Code: ' + nm, c: 'n-code' } : { t: 'CODE: send an MD', c: 'n-code fl' };
  if (p.bleed === 'mtp' && !p.bb && p.dsp === 'none') return { t: p.shock ? 'SHOCK: activate MTP' : 'Bleeding: activate MTP', c: 'n-bad fl' };
  if (!E.zoneNurses(r.z).length) return { t: 'No nurse!', c: 'n-bad fl' };
  if (p.sitter && !r.safe && !p.sitBy) return { t: 'Needs a sitter', c: 'n-bad fl' };
  switch (p.dsp) {
    case 'ready': return { t: 'Ready: discharge', c: 'n-go fl' };
    case 'dc': case 'dcing': return { t: 'Discharge teaching', c: 'n-go' };
    case 'readytx': return { t: 'Request transfer', c: 'n-act fl' };
    case 'txcall': return { t: 'Transfer center…', c: 'n-wait' };
    case 'board': return { t: `Admitted · bed <span data-cd="${p.due}"></span>`, c: 'n-board' };
    case 'bedready': return { t: 'Bed ready: send up', c: 'n-act fl' };
    case 'xportq': { const s = E.staff(p.xBy); return { t: `${s ? esc(s.short) : 'Transport'} taking them up`, c: 'n-board' }; }
    case 'txok': return { t: 'Accepted: book ambulance', c: 'n-act fl' };
    case 'iftwait': return { t: `${E.IFT[p.iftLevel].short} crew <span data-cd="${p.due}"></span>`, c: 'n-wait' };
    case 'iftreport': return { t: 'Crew taking report', c: 'n-wait' };
    case 'toproc': return { t: p.dispo === 'cath' ? 'To the cath lab' : 'To the OR', c: 'n-go' };
    case 'family': return { t: 'Family at bedside', c: 'n-wait' };
    case 'morgue': case 'morguing': return { t: 'Morgue transport', c: 'n-wait' };
  }
  if (E.needsProv(p)) return p.ev === 'none' ? { t: `Needs a provider · <span data-el="${p.tNeed != null ? Math.max(p.tNeed, p.tRoom) : p.tRoom}"></span>`, c: 'n-act fl' } : { t: 'Needs a provider (recheck)', c: 'n-act fl' };
  if (p.reg !== 'done') return p.reg === 'none' ? { t: 'Needs registration', c: 'n-act fl' } : { t: 'Registering', c: 'n-wait' };
  if (p.ev === 'q') { const i = pv ? pv.q.findIndex(k => k.pid === p.id) : -1; return { t: `${nm} · ${i >= 0 ? '#' + (i + 1) + ' in line' : 'queued'}`, c: 'n-wait' }; }
  if (p.ev === 'doing') return { t: `${nm} in the room`, c: 'n-wait' };
  if (p.con && p.consult.st === 'none' && p.dxK) return { t: 'Call a consult', c: 'n-act fl' };
  if (p.consult.st === 'req') return { t: `${E.SPECS[p.consult.spec].short} <span data-cd="${p.consult.due}"></span>`, c: 'n-wait' };
  if (p.re === 'q' || p.re === 'doing') return { t: `${nm} rechecking`, c: 'n-wait' };
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
    + `<span class="who">${emoji(p)} ${p.age}${p.sex}${p.ret ? ' <i class="rettag">Ret</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}${pv ? `<i class="pv ${RC[pv.role]}">${esc(pv.short.slice(0, 3))}</i>` : ''}</span>`
    + `<span class="cc${dxShown(p) ? ' dx' : ''}">${esc(dxOr(p))}</span>`
    + `<span class="tags">${tagsHTML(p)}</span>`
    + `<span class="nx ${nx.c}">${nx.t}</span>`;
}
function renderBoard(G) {
  const sel = U.sel, selP = sel && sel.pid ? E.pt(sel.pid) : null, selS = sel && sel.type === 'prov' ? E.staff(sel.sid) : null;
  for (const z of E.ZONES) {
    const h = document.getElementById('zh-' + z.id);
    const ns = E.zoneNurses(z.id), load = E.zoneLoad(z.id), cap = ns.length * 4, n = E.zonePts(z.id);
    const closed = G.rooms.some(r => r.z === z.id && r.closed);
    const st = !ns.length ? (n ? 'none' : 'empty') : load > cap ? 'over' : load === cap ? 'full' : 'ok';
    setC(h, 'zh zs-' + st);
    setH(h, `<span class="zn">${z.name}</span><span class="zr">${ns.length ? 'RN ' + ns.map(s => esc(s.short)).join(' + ') + ` · <b>${fl(load)}/${cap}</b>` : closed ? 'Closed' : n ? 'No nurse — tap to assign' : 'No nurse'}</span>`);
    h.setAttribute('aria-label', `${z.name} nurses`);
  }
  for (const r of G.rooms) {
    const el = document.getElementById('room-' + r.id), p = r.pid ? E.pt(r.pid) : null;
    let cls = 'room';
    if (!p) cls += ' st-' + (r.closed ? 'closed' : r.st);
    else cls += ' st-occ e' + p.esi + (p.crash || p.arrest || p.shock || (p.bleed === 'mtp' && !p.bb) ? ' crit' : '');
    if (sel && (sel.type === 'pt' || sel.type === 'move') && selP) cls += E.canPlace(selP, r).ok ? ' ok' : ' no';
    else if (sel && sel.type === 'reg') cls += (p && p.reg === 'none') ? ' ok' : ' no';
    else if (sel && sel.type === 'tri') cls += ' no';
    else if (selS) cls += (p && E.needsProv(p) && E.canAssign(selS, p).ok) ? ' ok' : ' no';
    setC(el, cls); setH(el, roomHTML(r, p, G));
    el.setAttribute('aria-label', p ? `${E.roomName(r.id)}: ${p.age}${p.sex}, ${dxOr(p)}` : `${E.roomName(r.id)}: ${r.closed ? 'closed' : r.st}`);
  }
}
function taskLabel(k) {
  if (k.type === 'box') return 'On the Box';
  const p = E.pt(k.pid);
  return ({ eval: 'Eval', reassess: 'Recheck', proc: 'Procedure', code: 'CODE', pit: 'Triage exam', pitdc: 'Triage discharge', talk: 'AMA talk' }[k.type] || k.type) + (p && p.room ? ' ' + p.room : '');
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
    setH(el, `<span class="pm-n">${esc(s.short)}</span><span class="pm-t">${esc(task)}</span>${s.q.length > 1 ? `<span class="pm-q">+${s.q.length - 1}</span>` : ''}`);
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
  if (!side._built) { side.innerHTML = '<h4>Providers · tap one, then tap patients</h4><div class="dock-prov" id="sideProv"></div><div id="sideTeam"></div>'; side._built = true; }
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
  return { 1: 'Unstable', 2: 'HR 112, BP 154/92, SpO2 94%', 3: 'HR 96, BP 138/84, SpO2 97%', 4: 'HR 84, BP 128/78, SpO2 99%', 5: 'HR 78, BP 122/76, SpO2 99%' }[p.esi];
}
function provButtons(p, G) {
  return G.staff.filter(s => E.isProv(s) && E.present(s)).map(s => {
    const c = E.canAssign(s, p);
    return `<button type="button" class="pbtn ${RC[s.role]}" data-act="assign" data-arg="${s.id}" ${c.ok ? '' : 'disabled'}><b>${esc(s.short)} · ${s.title}</b><small>${s.pit ? 'In triage · ' : s.st !== 'on' ? stLabel(s) + ' · ' : ''}<span data-ql="${s.id}"></span></small></button>`;
  }).join('') + (p.esi <= 2 ? '<p class="hint" style="grid-column:1/-1;margin:0">ESI 1 and 2 need an attending. PAs and NPs take ESI 3 to 5.</p>' : '');
}
function dispoText(p) {
  const m = { ready: 'Ready to go home', dc: 'Discharge teaching (nurse)', dcing: 'Discharge teaching (nurse)', readytx: `Transfer to ${p.txTo}`, txcall: 'Transfer center is calling', txok: `${cap(p.txTo)} accepted. Book an interfacility ambulance.`, iftwait: `${p.iftLevel ? E.IFT[p.iftLevel].name : 'Ambulance'} arrives in <span data-cd="${p.due}"></span>`, iftreport: 'Interfacility crew taking report at the bedside', board: `Admitted to the ${{ admit: 'floor', icu: 'ICU', bh: 'psych unit' }[p.dispo]} · bed in <span data-cd="${p.due}"></span>`, bedready: 'Bed ready upstairs. Send them with a transporter or a tech.', xportq: 'Transport is on the way to the room', toproc: p.dispo === 'cath' ? 'Going to the cath lab' : 'Going to the OR', family: 'Family at the bedside', morgue: 'Waiting for transport', morguing: 'Transport underway' };
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
    if (k === 'mtp' || k === 'blood') return bloodText(p, k);
  }
  return [T.by === 'rt' ? 'Waiting on respiratory therapy' : T.by === 'prov' ? 'Provider procedure, in their line' : 'Waiting for the nurse', 'wait'];
}
function pathRows(p, G) {
  const rows = [], row = (k, v, st) => `<li class="pr ${st}"><span class="pk">${k}</span><span class="pv2">${v}</span></li>`;
  const r = E.roomOf(p), pv = p.prov ? E.staff(p.prov) : null, nm = id => { const s = E.staff(id); return s ? esc(s.name) : 'Someone'; };
  rows.push(row('Registration', p.reg === 'done' ? 'Registered' : p.reg === 'doing' ? `${nm(p.regBy)} is registering them now` : p.reg === 'q' ? `${nm(p.regBy)} has them in line` : 'Not registered yet', p.reg === 'done' ? 'ok' : p.reg === 'none' ? 'need' : 'wait'));
  if (p.loc === 'wall' || p.loc === 'triage') rows.push(row(p.loc === 'wall' ? 'Report' : 'Triage', p.tri === 'done' ? `Triaged: ESI ${p.esi}` : p.tri === 'doing' ? `${nm(p.triBy)} is ${p.loc === 'wall' ? 'taking report from ' + esc(p.unit) : 'triaging'} now` : p.tri === 'q' ? `${nm(p.triBy)} is next${p.reg === 'done' ? '' : ', once registered'}` : p.loc === 'wall' ? `${esc(p.unit)} is waiting to give report` : 'Waiting for a triage nurse', p.tri === 'done' ? 'ok' : p.tri === 'none' ? 'need' : 'wait'));
  rows.push(row('Bed', r ? E.roomName(r.id) : where(p), r ? 'ok' : 'need'));
  rows.push(row('Nurse', p.rn === 'done' ? 'Assessed' : p.rn === 'doing' ? 'Assessing now' : p.rn === 'todo' ? (r && E.zoneNurses(r.z).length ? 'Waiting for the nurse' : 'No nurse covers this room') : 'After rooming', p.rn === 'done' ? 'ok' : p.rn === 'todo' && r && !E.zoneNurses(r.z).length ? 'need' : 'idle'));
  const pitBy = p.pitBy ? E.staff(p.pitBy) : null;
  rows.push(row('Provider', p.ev === 'done' ? `Seen by ${pv ? esc(pv.name) : 'a provider'}` : p.ev === 'doing' ? `${esc(pv ? pv.name : 'Provider')} is in the room` : p.ev === 'q' ? `${esc(pv ? pv.name : '')}, in line` : p.pitSeen ? `Seen in triage by ${esc(pitBy ? pitBy.name : 'the triage provider')}${p.loc === 'room' ? '. Needs a provider here.' : ''}` : p.loc === 'room' ? 'Not assigned yet' : 'After rooming', p.ev === 'done' ? 'ok' : p.ev === 'none' && p.loc === 'room' ? 'need' : p.pitSeen ? 'ok' : 'idle'));
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
  if (['wall', 'waiting', 'triage'].includes(p.loc)) return `<div class="prim">${mtpBtn}<button type="button" class="big act" data-act="placeSel" data-arg="${p.id}">Choose a room</button>${p.loc === 'wall' && p.esi >= 3 && !p.alertOn ? `<button type="button" class="big" data-act="toWait" data-arg="${p.id}">Hand off to the waiting room</button>` : ''}</div>`;
  if (p.loc === 'enroute') return `${mtpBtn ? `<div class="prim">${mtpBtn}</div>` : ''}<p class="hint">Inbound, ETA <span data-cd="${p.eta}"></span>. Have a ${p.esi === 1 ? 'resus bay' : 'room'} clean and ready.</p>`;
  if (p.loc !== 'room') return '';
  if (mtpBtn) return `<div class="prim">${mtpBtn}</div>`;
  if (p.dsp === 'ready') return `<div class="prim"><button type="button" class="big go" data-act="dc" data-arg="${p.id}">Discharge home</button></div>`;
  if (p.dsp === 'readytx') return `<div class="prim"><button type="button" class="big act" data-act="tx" data-arg="${p.id}">Request transfer to ${esc(p.txTo)}</button></div>`;
  if (p.dsp === 'board') return `<div class="prim"><button type="button" class="big" data-act="esc" data-arg="${p.id}" ${G.house.esc ? '' : 'disabled'}>Push the House Supervisor for a bed (${G.house.esc} left)</button></div>`;
  if (p.dsp === 'bedready') return `<div class="prim"><div class="prim-l">Bed ready upstairs. Who takes them?</div><div class="pgrid">${upButtons(p, G)}</div>${p.dispo === 'icu' ? '<p class="hint" style="margin:0">ICU patient: their nurse goes along for about 10 minutes.</p>' : ''}</div>`;
  if (p.dsp === 'txok') return `<div class="prim"><div class="prim-l">${esc(cap(p.txTo))} accepted. Book the ambulance</div><div class="cgrid">${iftButtons(p, G)}</div><p class="hint" style="margin:0">ICU-level patients need critical care transport. The patient keeps the room until the crew arrives.</p></div>`;
  if (E.needsProv(p)) return `<div class="prim"><div class="prim-l">Assign a provider</div><div class="pgrid">${provButtons(p, G)}</div></div>`;
  if (p.reg === 'none') return `<div class="prim"><div class="prim-l">Register them before they leave the ED</div><div class="pgrid">${regButtons(p, G)}</div></div>`;
  if (p.dxK && p.con && p.consult.st === 'none') return `<div class="prim"><button type="button" class="big act" data-act="consultOpen" data-arg="${p.id}">Call a consult…</button></div>`;
  return '';
}
function staffBtn(act, pid, s, sub, dis) {
  return `<button type="button" class="pbtn ${RC[s.role]}" data-act="${act}" data-arg="${pid}|${s.id}" ${dis ? 'disabled' : ''}><b>${esc(s.short)}</b><small>${sub}</small></button>`;
}
function regButtons(p, G) {
  return G.staff.filter(s => s.role === 'reg' && E.present(s)).map(s => { const n = s.q.length + (s.task ? 1 : 0); return staffBtn('regAssign', p.id, s, s.st !== 'on' ? stLabel(s) : n ? `${n} in line` : 'Free now', s.st !== 'on'); }).join('');
}
function triButtons(p, G) {
  const rank = s => s.zones.includes('triage') ? 0 : !s.zones.length ? 1 : 2;
  const ns = G.staff.filter(s => s.role === 'rn' && s.st === 'on' && s.escortUntil <= G.t).sort((a, b) => rank(a) - rank(b) || E.nurseLoad(a) - E.nurseLoad(b));
  return ns.map(s => {
    const n = s.tq.length + (s.task && s.task.kind === 'triage' ? 1 : 0);
    const where = s.zones.includes('triage') ? 'Triage nurse' : !s.zones.length ? 'Resource nurse' : `${s.zones.map(z => E.ZONE_NAME[z]).join(' + ')} · ${fl(E.nurseLoad(s))}/4`;
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
  if (p.loc === 'gone') return head(esc(p.name), 'No longer in the department') + `<p class="hint">${esc({ dc: 'Discharged home.', admit: 'Went upstairs.', icu: 'Went to the ICU.', bh: 'Went to the psych unit.', or: 'Went to the OR.', cath: 'Went to the cath lab.', tx: 'Transferred out.', lwbs: 'Left without being seen.', ama: 'Left against medical advice.', expired: 'Died in the department.' }[p.outcome] || 'Left.')}</p>`;
  let h = `<div class="ph"><div class="ph-who"><span class="ph-em">${emoji(p)}</span><span><b>${esc(p.name)}</b>, ${p.age}${p.sex} ${esiChip(p)} ${alertTag(p)}${langChip(p)}${p.ret ? ' <i class="rettag">72-hr return</i>' : ''}${p.vip ? ' <i class="vip">VIP</i>' : ''}${p.stat ? ' <i class="stat">Stat</i>' : ''}<br><span class="ph-sub">${esc(where(p))} · ${p.src === 'ems' ? esc(p.unit || 'EMS') : 'Walk-in'} · ${p.loc === 'enroute' ? `ETA <span data-cd="${p.eta}"></span>` : `in the ED <span data-el="${p.tArrive}"></span>`}</span></span></div></div>`;
  const kv = [['Complaint', esc(p.cc)], ['Vitals', esc(vitals(p))]], dx = dxShown(p);
  if (dx) kv.push(['Diagnosis', `<b>${esc(dx)}</b>`]); else if (p.alertOn && p.alert) kv.push(['Working', `${esc(E.ALERTS[p.alert].name)} alert`]);
  if (p.iso) kv.push(['Isolation', 'Airborne. Room 8 or 16.']);
  if (p.sitter) kv.push(['Safety', 'Needs a safe room (19 or 20) or a 1:1 sitter']);
  if (p.bleed === 'mtp') kv.push(['Bleeding', p.bb ? 'Massive transfusion activated' : '<b>Hemorrhage. Activate MTP.</b>']);
  else if (p.bleed === 'prbc') kv.push(['Blood', 'Needs a transfusion']);
  if (p.ret) kv.push(['Return', 'Seen here earlier today and back sicker']);
  h += `<div class="ph-cc">${kv.map(([k, v]) => `<div><span>${k}</span><div>${v}</div></div>`).join('')}</div>`;
  h += primary(p, G);
  h += `<ol class="path">${pathRows(p, G)}</ol>`;
  const gk = Object.keys(p.goals); if (gk.length && p.loc !== 'enroute') h += `<div class="goals">${gk.map(k => goalRow(p, k)).join('')}</div>`;
  const b = [];
  if (p.lang && p.interp === 'none') b.push(`<button type="button" class="hl" data-act="interp" data-arg="${p.id}">Get a ${p.lang === 'asl' ? 'ASL' : esc(E.LANGS[p.lang])} interpreter</button>`);
  if (Object.keys(p.treat).some(k => p.treat[k].st === 'verify')) b.push(`<button type="button" data-act="override" data-arg="${p.id}">Pull meds on override</button>`);
  if (p.bleed === 'prbc' && (!p.bb || p.bb.st === 'xm')) b.push(`<button type="button" data-act="oneg" data-arg="${p.id}">Emergency-release O-neg (${G.blood.oneg} left)</button>`);
  if (p.alert === 'trauma' && !p.bb && p.bleed !== 'mtp') b.push(`<button type="button" data-act="mtp" data-arg="${p.id}">Activate MTP</button>`);
  if (p.loc === 'room') {
    b.push(`<button type="button" data-act="stat" data-arg="${p.id}">${p.stat ? 'Clear STAT' : 'Mark STAT'}</button>`);
    b.push(`<button type="button" data-act="moveSel" data-arg="${p.id}">Move bed</button>`);
    if (p.consult.st === 'none' && (p.ev === 'done' || p.alertOn) && !(p.dxK && p.con)) b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Consult…</button>`);
    if (!E.needsProv(p) && p.ev !== 'doing' && !p.dsp.match(/^(dc|dcing|toproc|txwait|xporting|morguing)$/)) b.push(`<button type="button" data-act="provOpen" data-arg="${p.id}">Change provider</button>`);
  } else if (p.alertOn && p.con && p.consult.st === 'none') b.push(`<button type="button" data-act="consultOpen" data-arg="${p.id}">Activate a team…</button>`);
  if (b.length) h += `<div class="sh-acts">${b.join('')}</div>`;
  return h;
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
  if (s.st === 'pending') return s.tag === 'swing shift' ? `Starts at 11:00 (in ${fm(s.until - t)})` : `Arriving in ${fm(s.until - t)}`;
  if (s.st !== 'on') return stLabel(s);
  let x;
  const room = k => { const p = k && k.pid ? E.pt(k.pid) : null; return p && p.room ? ' ' + p.room : ''; };
  if (E.isProv(s)) { const k = s.q[0]; x = (s.pit ? 'Stationed in triage · ' : '') + (k ? taskLabel(k) + (s.q.length > 1 ? ` · ${s.q.length - 1} more in line` : '') : 'Free'); }
  else if (s.role === 'rn') {
    const L = E.nurseLoad(s), k = s.task, triOnly = s.zones.length === 1 && s.zones[0] === 'triage';
    x = triOnly ? 'Triage' : !s.zones.length ? 'Resource nurse: helps any pod' : `Load ${fl(L)}/4${L > 4 ? ' · over ratio' : ''}`;
    if (s.escortUntil > t) x += ' · escorting a patient to the ICU';
    else if (k) x += ` · ${{ triage: 'Triaging', assess: 'Assessing', treat: 'Giving meds', dc: 'Discharging', lab: 'Drawing labs', ecg: 'Doing an ECG' }[k.kind] || ''}${k.kind === 'triage' ? ' ' + (E.pt(k.pid) ? E.label(E.pt(k.pid)) : '') : room(k)}`;
    if (s.tq.length) x += ` · ${s.tq.length} to triage`;
  } else if (s.role === 'pct') {
    const k = s.task, p = k && k.pid ? E.pt(k.pid) : null;
    x = (!k ? 'Free' : k.kind === 'sit' ? `1:1 sitter in ${p && p.room}` : k.kind === 'errand' || k.kind === 'trip' ? k.label : `${{ ecg: 'ECG', lab: 'Blood draw', xport: 'Transport upstairs', morgue: 'Morgue transport', run: 'Running the MTP cooler' }[k.kind]}${p && p.room ? ' ' + p.room : p ? ' (' + where(p).toLowerCase() + ')' : ''}`) + (s.q.length ? ' · then a transport upstairs' : '');
  } else if (s.role === 'rt') { const k = s.task; x = !k ? 'Free' : k.kind === 'code' ? `At the code${room(k)}` : `${E.TREAT[k.key].label}${room(k)}`; }
  else if (s.role === 'rph') { const k = s.task, n = E.active().reduce((a, p) => a + Object.keys(p.treat).filter(q => p.treat[q].st === 'verify').length, 0); x = (k ? `Verifying${room(k)}` : 'Free') + (n ? ` · ${n} order${n > 1 ? 's' : ''} waiting` : ''); }
  else if (s.role === 'evs') x = s.task ? `Cleaning ${s.task.room}` : 'Free';
  else if (s.role === 'reg') { const k = s.task, p = k ? E.pt(k.pid) : null; x = (k ? `Registering ${p ? E.label(p) : ''}` : 'Free') + (s.q.length ? ` · ${s.q.length} in line` : ''); }
  else if (s.role === 'tp') { const k = s.task, p = k && k.pid ? E.pt(k.pid) : null; x = (!k ? 'Free' : k.kind === 'walk' ? `Heading to ${p ? E.label(p) : 'the ED'}` : 'Taking a patient upstairs') + (s.q.length ? ` · ${s.q.length} waiting` : ''); }
  if (t - s.lastBreak > 300) x += ' · needs a break';
  return x;
}
function staffRow(s) {
  const zones = s.role === 'rn' ? `<span class="szones">${s.zones.length ? s.zones.map(z => E.ZONE_NAME[z]).join(' + ') : 'Any pod (resource)'}</span>` : s.pit ? '<span class="szones">Triage</span>' : '';
  return `<div class="srow ${s.st}"><button type="button" class="mg ${RC[s.role]}" data-act="staffOpen" data-arg="${s.id}" aria-label="${esc(s.name)} details">${esc(s.short.slice(0, 2))}</button><span class="sinfo"><b>${esc(s.name)}${s.tag ? ` <i class="stag">${esc(s.tag)}</i>` : ''}</b>${zones}<small data-stx="${s.id}"></small><i class="mor"><i data-mor="${s.id}"></i></i></span>${s.st === 'on' ? `<button type="button" class="sb" data-act="brk" data-arg="${s.id}">Break</button>` : ''}</div>`;
}
function teamHTML(G) {
  const groups = [['Providers (tap a badge to station one in triage)', s => E.isProv(s)], ['Nurses', s => s.role === 'rn'], ['Patient care techs', s => s.role === 'pct'], ['Registration', s => s.role === 'reg'], ['Transport', s => s.role === 'tp'], ['Respiratory therapy', s => s.role === 'rt'], ['Pharmacy', s => s.role === 'rph'], ['Environmental services', s => s.role === 'evs']];
  let h = '<div class="legend"><i></i>Bars show morale. Breaks bring it back up.</div>';
  for (const [title, f] of groups) {
    const list = G.staff.filter(s => f(s) && !['off', 'sick', 'gone'].includes(s.st));
    h += `<h4>${title}</h4><div class="slist">${list.map(staffRow).join('') || '<p class="hint">Nobody.</p>'}</div>`;
  }
  const brd = E.boarders().length;
  h += `<h4>House</h4><div class="house">House Supervisor Pat: ${brd} admitted patient${brd === 1 ? '' : 's'} waiting on beds · ${G.house.esc} bed favor${G.house.esc === 1 ? '' : 's'} left<br>Blood bank: ${G.blood.oneg} units of O-negative${G.mods.bbSlow > G.t ? ' · crossmatch slow' : ''}<br>Interpreters: video line ${G.mods.interpDown > G.t ? 'down' : 'up'}, ASL in person<br>Pharmacy: ${G.staff.some(s => s.role === 'rph' && s.st === 'on') ? 'ED pharmacist on' : G.mods.remoteRph ? 'central pharmacy, remote and slow' : 'nobody verifying'}<br>Interfacility ambulances: ground units ${G.mods.iftSlow > G.t ? 'running 30 min slow' : 'normal'} · helicopters ${G.mods.airWx > G.t ? 'grounded' : 'flying'}<br>EVS line: ${G.evsQ.length ? G.evsQ.join(', ') : 'empty'} · Security: ${G.sec.busy > G.t ? 'busy' : 'available'}</div>`;
  h += `<div class="team-acts"><button type="button" data-act="pizza" ${G.pizza ? 'disabled' : ''}>${G.pizza ? 'Pizza ordered' : 'Buy pizza for the ED'}</button></div>`;
  return h;
}
function staffSheet(G, s) {
  if (!s) return '';
  let h = head(esc(s.name), s.title + (s.tag ? ' · ' + esc(s.tag) : ''));
  h += `<div class="slist">${staffRow(s)}</div>`;
  if (E.isProv(s)) {
    if (E.present(s)) h += `<div class="sh-acts">${s.pit ? `<button type="button" data-act="pit" data-arg="${s.id}|0">Bring ${esc(s.short)} back to the floor</button>` : `<button type="button" class="hl" data-act="pit" data-arg="${s.id}|1">Station ${esc(s.short)} in triage</button>`}</div><p class="hint">A provider in triage sees waiting-room patients, starts labs and imaging from there, and sends simple cases home without a bed. They can't take patients in rooms while stationed there.</p>`;
    h += `<h4>In line</h4><ol class="q">${s.q.length ? s.q.map((k, i) => { const p = E.pt(k.pid); return `<li>${i === 0 && k.started ? 'Now: ' : ''}${esc(k.type === 'box' ? 'Box consult' : `${taskLabel(k)} · ${p ? p.age + p.sex + ' ' + dxOr(p) : ''}`)}</li>`; }).join('') : '<li>Nothing in line</li>'}</ol>`;
  }
  return h;
}
function zoneSheet(G, z) {
  const zn = E.ZONE_NAME[z], load = E.zoneLoad(z), cap = E.zoneNurses(z).length * 4;
  let h = head(`${zn} nurses`, z === 'triage' ? `${G.triageQ.length} in the triage line` : `${E.zonePts(z)} patients · load ${fl(load)} of ${cap}`);
  h += `<p class="hint">${z === 'triage' ? 'Whoever covers Triage triages walk-ins before anything else. To put a provider in triage, open a provider from the Team list.' : 'Each nurse handles 4 points: ESI 3 to 5 count 1, ESI 2 counts 2, ESI 1 counts 4. Over that, safety and morale slip.'} Tap a nurse to add or remove them.</p><div class="zgrid">`;
  for (const s of G.staff.filter(x => x.role === 'rn' && ['on', 'break', 'away', 'pending'].includes(x.st))) {
    h += `<button type="button" class="zbtn ${s.zones.includes(z) ? 'on' : ''}" data-act="zt" data-arg="${s.id}|${z}"><b>${esc(s.short)}</b><small>${s.zones.length ? s.zones.map(x => E.ZONE_NAME[x]).join(' + ') : 'Resource (any pod)'}${s.st !== 'on' ? ' · ' + stLabel(s) : ''}<br><span data-load="${s.id}"></span></small></button>`;
  }
  h += '</div>';
  if (z !== 'triage') {
    const closed = G.rooms.some(r => r.z === z && r.closed);
    h += `<div class="sh-acts">${closed ? `<button type="button" data-act="zopen" data-arg="${z}">Reopen ${zn}</button>` : `<button type="button" data-act="zclose" data-arg="${z}" ${E.zonePts(z) ? 'disabled' : ''}>Close ${zn}</button>`}<button type="button" data-act="agency" data-arg="${z}" ${G.mods.noAgency ? 'disabled' : ''}>Call an agency RN (~40 min)</button></div>`;
  }
  return h;
}
function boxDocSheet(G) {
  const c = G.box.cur;
  if (!c || c.kind !== 'consult' || c.taken) return '';
  let h = head('Who takes the consult?', `${esc(c.unit)} is on the line. The ring timer is still running.`);
  h += '<p class="hint">Only an attending can give medical direction. Whoever takes it stops what they are doing for about 5 minutes.</p><div class="pgrid">';
  for (const s of G.staff.filter(x => x.role === 'md' && E.present(x))) h += `<button type="button" class="pbtn r-md" data-act="boxDoc" data-arg="${s.id}" ${s.st === 'on' ? '' : 'disabled'}><b>${esc(s.name)}</b><small>${s.st === 'on' ? `<span data-stx="${s.id}"></span>` : stLabel(s)}</small></button>`;
  return h + '</div>';
}
function divertSheet(G) {
  const blocked = G.mods.noDivert > G.t;
  const card = (kind, title, txt, on) => `<div class="dv ${kind}${on ? ' on' : ''}"><b>${title}${on ? ` · on for ${fm(G.t - G[kind].since)}` : ''}</b><p>${txt}</p><button type="button" data-act="divertSet" data-arg="${kind}|${on ? 0 : 1}" ${!on && blocked ? 'disabled' : ''}>${on ? `Lift ${title}` : blocked ? 'Administration blocked divert' : `Go on ${title}`}</button></div>`;
  return head('Divert status', 'Tell EMS where not to bring patients') + card('yellow', 'Yellow Alert', 'The ED is saturated. Ambulances take non-critical patients to other hospitals; alerts still come to you. Costs a few points every minute.', G.yellow.on) + card('red', 'Red Alert', 'No monitored or ICU beds. Ambulances take critical medical patients elsewhere when they can. Trauma still comes. Costs more points every minute.', G.red.on) + '<p class="hint">Administration and the EMS system both notice when divert drags on past 90 minutes.</p>';
}
function helpHTML() {
  return head('How to run the board', 'You are the charge nurse from 07:00 to 19:00. Keep patients moving, staff upright, and the Box answered.') + `<ol class="help">
<li><b>Intake.</b> Patients come in two doors: EMS and walk-in. Every one needs registration and triage, and you direct both. Tap a registrar or triage nurse in the intake row, then tap patients; or tap a patient for options, including pulling a pod nurse to triage. EMS crews wait on the wall to give report until a nurse triages them. Walk-ins go to the waiting room after triage. Alerts and crashing patients can go straight to a room.</li>
<li><b>Bed patients.</b> Tap a patient marked READY FOR A BED, or one in the waiting room, then a green room. EMS patients who are ESI 3 to 5 can be handed off to the waiting room instead. ESI 1 goes to Resus. Fast Track takes ESI 4 and 5. Airborne isolation needs Room 8 or 16. Rooms 19 and 20 are safe rooms for behavioral health.</li>
<li><b>Get them seen.</b> Nobody sees a provider until you assign one. Tap a provider at the bottom, then tap every patient you want them to take. PAs and NPs take ESI 3 to 5. Station a provider in triage from their card to work the waiting room.</li>
<li><b>Answer the Box.</b> Alert reports let the team get ready. Medical consults need an attending, and you make the call. Pick General or Maryland (MIEMSS) consults on the start screen.</li>
<li><b>Consult at the right time.</b> Results show up on the patient card. Call the right service once the results they need are back, or they get angry and slow.</li>
<li><b>Meds, breathing, blood.</b> The pharmacist verifies most meds before the nurse can give them; override if you have to, at a risk. Respiratory therapy runs nebs, BiPAP, high-flow, and vents. Bleeding trauma needs the massive transfusion protocol fast. Other bleeders get crossmatched blood, or emergency-release O-negative.</li>
<li><b>Interpreters.</b> Patients marked ES, HT, ZH, AR, VI, RU, or ASL need one. Without it, care is slower, they're likelier to leave, and they come back more often.</li>
<li><b>Send them on.</b> When an inpatient bed is ready, choose a transporter or one of your techs to take them up; ICU patients take their nurse along. For transfers, book an ALS ambulance, critical care transport, or a helicopter. The patient holds the room until the crew arrives and takes report.</li>
<li><b>Turn rooms.</b> Nothing gets cleaned until you send EVS. Tap a dirty room to put it in the EVS line; tap it again to move it to the front, like a resus bay before a trauma arrives.</li>
<li><b>Watch your nurses.</b> Each nurse handles 4 points. Tap a pod header to move nurses. Casey is your resource nurse. Send people on breaks.</li>
<li><b>Divert.</b> Yellow Alert (ED saturated) and Red Alert (no monitored beds) cut ambulance traffic, at a cost.</li>
<li><b>Your scores.</b> Avg wait is door to provider. Pt mgmt is your patient management score. Staff is worker satisfaction. Avoid LWBS, AMA, 72-hour returns, and ambulances stuck on the wall.</li>
</ol>`;
}
function renderSheet(G) {
  const wrap = $('#sheetWrap'), el = $('#sheet'), s = U.sheet;
  let h = '';
  if (s && U.scene === 'game') {
    if (s.type === 'pt') h = ptSheet(G, E.pt(s.pid));
    else if (s.type === 'consult') { const p = E.pt(s.pid); h = p && p.loc !== 'gone' && p.consult.st === 'none' ? consultSheet(G, p) : ''; }
    else if (s.type === 'prov') { const p = E.pt(s.pid); h = p && p.loc === 'room' ? head('Change provider', esc(p.name)) + `<div class="pgrid">${provButtons(p, G)}</div>` : ''; }
    else if (s.type === 'team') h = head('Your team', `Staff satisfaction ${Math.round(E.staffSat())}%`) + teamHTML(G);
    else if (s.type === 'staff') h = staffSheet(G, E.staff(s.sid));
    else if (s.type === 'zone') h = zoneSheet(G, s.z);
    else if (s.type === 'boxdoc') h = boxDocSheet(G);
    else if (s.type === 'divert') h = divertSheet(G);
    else if (s.type === 'help') h = helpHTML();
    if (!h) U.sheet = null;
  } else if (s && s.type === 'help') h = helpHTML();
  wrap.hidden = !h; morph(el, h);
}

/* ---------- modals (these pause the shift) ---------- */
function renderModal(G) {
  const wrap = $('#modalWrap'), el = $('#modal');
  let h = '';
  if (U.scene === 'game' && G.card) {
    const c = G.card;
    h = `<div class="mc-who">${esc(c.who)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><div class="mc-ch">${c.choices.map(x => `<button type="button" data-act="card" data-arg="${x.k}" ${x.dis ? 'disabled' : ''}><b>${esc(x.label)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>`;
  } else if (U.modal && U.modal.type === 'scen') {
    const m = U.modal;
    h = `<div class="mc-who">The Box · ${esc(m.unit)} · ${esc(m.doc)} on the line${m.pack === 'miemss' ? ' · Maryland protocols' : ''}</div><h3>Medical direction</h3><p class="scen">${esc(m.sc.q)}</p><div class="mc-ch two"><button type="button" class="go" data-act="scen" data-arg="1"><b>Approve</b></button><button type="button" class="no" data-act="scen" data-arg="0"><b>Deny</b></button></div>`;
  } else if (U.modal && U.modal.type === 'result') {
    const r = U.modal.r;
    h = `<div class="mc-res ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'Correct' : 'Incorrect'}</div><h3>You ${r.approve ? 'approved' : 'denied'} it</h3><p>${esc(r.sc.why)}</p><div class="mc-ch"><button type="button" data-act="modalOk"><b>Back to the floor</b></button></div>`;
  } else if (U.scene === 'game' && U.paused && !U.sheet) {
    h = `<div class="mc-who">${esc(E.LEVELS[G.level].name)} · ${E.clock()}</div><h3>Paused</h3><p>The department waits for you. It will not wait long. Your shift is saved on this device.</p><div class="mc-ch"><button type="button" data-act="resume"><b>Resume</b></button><button type="button" data-act="help"><b>How to play</b></button><button type="button" data-act="sound"><b>Sound: ${U.sound ? 'on' : 'off'}</b></button><button type="button" data-act="restart"><b>Restart this shift</b></button><button type="button" data-act="menu"><b>Quit to menu</b></button></div>`;
  }
  wrap.hidden = !h; morph(el, h);
}
function isPaused() { const G = g(); return U.paused || !!U.modal || (G && !!G.card) || U.scene !== 'game'; }

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
  for (const el of document.querySelectorAll('[data-load]')) { const s = E.staff(el.dataset.load); if (!s) continue; const v = `Load ${fl(E.nurseLoad(s))}/4`; if (el.textContent !== v) el.textContent = v; }
}

/* ---------- taps ---------- */
function tapRoom(id) {
  const r = E.room(id), s = U.sel;
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
  triAssign: a => { const [pid, sid] = a.split('|'); const r = E.triage(pid, sid); res(r, true); },
  toWait: pid => { const r = E.toWaiting(pid); if (r.ok) U.sel = null; res(r, true); },
  sendUp: a => { const [pid, sid] = a.split('|'); res(E.sendUp(pid, sid), true); },
  ift: a => { const [pid, k] = a.split('|'); res(E.bookIFT(pid, k), true); },
  prov: id => { const s = E.staff(id); if (s && s.pit) { U.sheet = { type: 'staff', sid: id }; return; } U.sel = U.sel && U.sel.type === 'prov' && U.sel.sid === id ? null : { type: 'prov', sid: id }; },
  zone: z => { U.sheet = { type: 'zone', z }; },
  team: () => { U.sheet = { type: 'team' }; },
  staffOpen: id => { U.sheet = { type: 'staff', sid: id }; },
  closeSheet: () => { U.sheet = null; },
  selCancel: () => { U.sel = null; },
  selInfo: () => { const s = U.sel; if (!s) return; U.sheet = s.type === 'prov' ? { type: 'staff', sid: s.sid } : { type: 'pt', pid: s.pid }; },
  boxAnswer: () => {
    const c = g().box.cur; if (!c) return;
    if (c.kind === 'notify') { const r = E.boxNotify(); if (r.ok) { toast(r.msg, 'good'); sfx('good'); } }
    else U.sheet = { type: 'boxdoc' };
  },
  boxDoc: sid => { const r = E.boxTake(sid); if (!r.ok) { toast(r.why, 'bad'); return; } U.sheet = null; U.modal = { type: 'scen', sc: r.sc, unit: r.unit, doc: r.doc, pack: r.pack }; },
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
  restart: () => start(U.lvl),
  menu: () => { save(true); showTitle(); },
  pill: k => toast(PILL_HELP[k], 'info'),
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
function readSave() { try { const s = localStorage.getItem('oc-save'); if (!s) return null; const d = JSON.parse(s); return d && d.G && d.G.v === 3 && !d.G.over ? d : null; } catch (e) { return null; } }
function resumeSave() {
  const d = readSave(); if (!d) { toast('No saved shift on this device', 'bad'); return; }
  E.load(d.G); U.lvl = d.lvl; U.scene = 'game'; U.sel = null; U.sheet = null; U.modal = null; U.paused = true; U.speed = 1;
  $('#title').hidden = true; $('#report').hidden = true;
  render();
}

/* ---------- scenes ---------- */
const DOT = { easy: 'var(--e4)', med: 'var(--e3)', hard: 'var(--e1)' };
function bestOf(l) { return +(store('oc-best-' + l) || 0); }
function titleHTML() {
  const lv = ['easy', 'med', 'hard'].map(k => { const L = E.LEVELS[k], b = bestOf(k), st = b ? E.starsFor(b, k) : 0; return `<button type="button" class="lvl" data-act="start" data-arg="${k}"><span class="dot" style="background:${DOT[k]}"></span><span><b>${L.name}</b><small>${L.blurb}</small></span>${b ? `<span class="best">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>` : ''}</button>`; }).join('');
  const sv = readSave();
  const resume = sv ? `<button type="button" class="lvl resume" data-act="resumeSave"><span class="dot" style="background:var(--accent)"></span><span><b>Resume your shift</b><small>${esc(E.LEVELS[sv.lvl] ? E.LEVELS[sv.lvl].name : '')}, paused at ${E.clock(sv.G.t)}</small></span></button>` : '';
  const packs = Object.entries(E.PACKS).map(([k, P]) => `<button type="button" class="seg${U.pack === k ? ' on' : ''}" data-act="pack" data-arg="${k}" aria-pressed="${U.pack === k}">${esc(P.name)}</button>`).join('');
  return `<div class="card"><div class="t-kicker">An ED shift survival game</div><h1 class="t-brand">Overcrowded</h1><svg class="t-under" viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 6 L297 6" stroke="#C8243A" stroke-width="3" fill="none" stroke-linecap="round"/></svg><p class="t-sub">You're the charge nurse for a 32-bed ED, 07:00 to 19:00. Five pods, a resus team, a radio that won't stop ringing, and an administrator who just walked in.</p><div class="levels">${resume}${lv}</div><div class="packs"><span>Box consults</span><div class="segs">${packs}</div><small>${esc(E.PACKS[U.pack].note)}</small></div><div class="t-links"><button type="button" data-act="help">How to play</button><button type="button" data-act="sound">Sound: ${U.sound ? 'on' : 'off'}</button></div></div>`;
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
  E.newGame(lvl, (Math.random() * 2147483647) | 0, { pack: U.pack });
  $('#title').hidden = true; $('#report').hidden = true;
  if (!store('oc-seen-help2')) { store('oc-seen-help2', '1'); U.paused = true; U.sheet = { type: 'help' }; }
  render();
  toast(`${E.LEVELS[lvl].name}. Night shift hands you the board.`, 'info');
}
const VERDICT = ['Rough one. Everybody survived the shift, mostly.', 'You kept the doors open. Tomorrow will be better.', 'Solid shift. The night charge owes you.', 'Charge nurse of the year. Somebody frame this board.'];
function reportHTML(R) {
  const L = E.LEVELS[R.level], led = g().ledger;
  const LED = { flow: 'Patients moved', goals: 'Alert time goals', box: 'The Box', consult: 'Consults', lwbs: 'Left without being seen', ama: 'Left against advice', returns: '72-hour returns', wall: 'Wall time', ratio: 'Over-ratio nursing', uncovered: 'Uncovered patients', safety: 'Safety events', hall: 'Hallway beds', sitter: 'Missing sitters', waiting: 'Waiting-room crashes', admin: 'Administration', staffing: 'Staffing costs', divert: 'Divert', blood: 'Bleeding and blood' };
  const rows = Object.entries(led).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${LED[k] || k}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${Math.round(v)}</td></tr>`).join('');
  const t = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  return `<div class="card rep"><h2>${R.fail ? 'The staff walked out' : 'Shift report'}</h2><div class="stars" aria-label="${R.stars} of 3 stars">${'★'.repeat(R.stars)}${'☆'.repeat(3 - R.stars)}</div><p class="verdict">${R.fail ? 'Staff satisfaction hit the floor and your nurses went home. Breaks, backup, and fewer mandates keep people around.' : VERDICT[R.stars]} ${esc(L.name)}, ${esc(E.PACKS[R.pack].name)} Box consults.</p>
<div class="rep-big"><div><b>${R.care}</b><span>Pt mgmt</span></div><div><b>${R.wait}m</b><span>Avg wait</span></div><div><b>${R.sat}%</b><span>Staff sat</span></div></div>
<h4>Where your points came from</h4><table class="ledger">${rows || t('Nothing yet', '0')}</table>
<h4>Patients</h4><table>${t('Arrived this shift', R.seen)}${t('Discharged home', R.dc)}${t('Sent home from triage', R.pitDc)}${t('Admitted upstairs', R.adm)}${t('To the OR or cath lab', R.proc)}${t('Transferred out', R.tx)}${t('Left without being seen', R.lwbs)}${t('Left against medical advice', R.ama)}${t('72-hour returns', R.returns)}${t('Still in the ED at 19:00', R.left)}</table>
<h4>EMS and the Box</h4><table>${t('Average EMS wall time (arrival to hand-off)', R.wallAvg + 'm')}${t('EMS handed off to the waiting room', R.offloads)}${t('Units on the wall over 30 min', R.wallOver)}${t('Consults answered', `${R.boxC.ans} of ${R.boxC.ans + R.boxC.miss}`)}${t('Medical direction calls right', `${R.boxC.right} of ${R.boxC.ans}`)}${t('Alert reports taken', `${R.boxN.ans} of ${R.boxN.ans + R.boxN.miss}`)}${t('Alert time goals met', `${R.goalsMet} of ${R.goalsMet + R.goalsMiss}`)}${t('Ambulances diverted', `${R.diverted} (${R.yellowMins}m yellow, ${R.redMins}m red)`)}</table>
<h4>Services</h4><table>${t('Interpreters requested', `${R.interp} for ${R.lep} patients who needed one`)}${t('Massive transfusions', `${R.mtp}${R.mtpWaste ? ` (${R.mtpWaste} not needed)` : ''}`)}${t('Patients who went into shock', R.shock)}${t('O-negative units used', R.oneg)}${t('Meds pulled on override', `${R.overrides} (${R.medErrors} errors)`)}${t('Seen by a provider in triage', R.pitSeen)}${t('Registered / triaged', `${R.registered} / ${R.triaged}`)}${t('Sent upstairs by transporter / tech', `${R.transports.tp} / ${R.transports.pct}`)}${t('Interfacility ambulances', `${R.ift.als} ALS · ${R.ift.cct} CCT · ${R.ift.air} air${R.iftRefused ? ` (${R.iftRefused} wrong level)` : ''}`)}</table>
<h4>Team</h4><table>${t('Angry consultants', R.angry + R.wrongSpec)}${t('Nurse-minutes over ratio', R.ratioMin)}${t('Safety events', R.adverse)}${t('Agency nurses / mandates', `${R.agency} / ${R.mandates}`)}</table>
<div class="rep-btns"><button type="button" class="big act" data-act="restart">Run it back</button><button type="button" class="big" data-act="menu">Menu</button></div></div>`;
}
function showReport() {
  const G = g(), R = G.report; if (!R) return;
  U.scene = 'report'; U.sheet = null; U.modal = null; U.sel = null;
  clearToasts();
  store('oc-save', null);
  if (!R.fail && R.care > bestOf(R.level)) store('oc-best-' + R.level, String(R.care));
  const el = $('#report'); el.hidden = false; setH(el, reportHTML(R));
  render();
}

/* ---------- loop ---------- */
let last = 0, lastR = 0, demoAcc = 0;
function frame(now) {
  const dt = Math.min(0.25, Math.max(0, (now - (last || now)) / 1000)); last = now;
  const G = g();
  if (G && U.scene === 'game' && !isPaused() && !G.over) {
    let left = dt * U.speed * BASE;
    while (left > 1e-6) { const s = Math.min(0.1, left); E.step(s); left -= s; if (G.card || G.over) break; }
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
  buildBoard(); bind();
  for (const [id, txt] of [['laneEms', 'No ambulances waiting'], ['laneWait', 'Waiting room is empty']]) $('#' + id).dataset.empty = txt;
  if (data.G && data.G.v === 3 && data.G.running && !data.G.over) {
    E.load(data.G); U.scene = 'game'; U.lvl = data.lvl || data.G.level; U.speed = data.speed || 1; U.paused = true;
    $('#title').hidden = true;
    render();
  } else showTitle();
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => (U.scene === 'game' && g() && !g().over ? { G: g(), lvl: U.lvl, speed: U.speed, sound: U.sound } : { sound: U.sound })); } catch (e) { /* ignore */ }
  requestAnimationFrame(frame);
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
window.OCUI = { U, render, start, showTitle };
})();
