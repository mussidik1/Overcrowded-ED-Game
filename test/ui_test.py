"""Drive the built page in headless Chrome at phone size (v0.2). Every new system gets at least one real tap."""
import sys, json, os
import os
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
errors, checks = [], []

def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

def run():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        J = page.evaluate

        def tap(sel, timeout=1500):
            for _ in range(3):
                if not sel.startswith('#modal') and page.is_visible('#modalWrap'): clear_modal()
                try:
                    loc = page.locator(sel).first
                    if loc.count() == 0: return False
                    loc.tap(timeout=timeout); page.wait_for_timeout(140); return True
                except Exception:
                    page.wait_for_timeout(150)
            return False

        def clear_modal():
            for _ in range(6):
                if not page.is_visible('#modalWrap'): return
                for sel in ['#modal [data-act="resume"]', '#modal [data-act="modalOk"]', '#modal [data-act="scen"][data-arg="1"]', '#modal .mc-ch button:not([disabled])']:
                    if page.locator(sel).count():
                        try: page.locator(sel).first.tap(timeout=1500)
                        except Exception: pass
                        page.wait_for_timeout(140)
                        break

        def sim(minutes, budget=2, extra=''):
            J('() => { let n = 0; const end = OC.G.t + %s; while (OC.G.t < end && !OC.G.over && n++ < 30000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (%d > 0 && n %% 10 === 0) OC.botStep({budget: %d%s}); } OCUI.U.sel = null; }' % (minutes, budget, budget, extra))
            page.wait_for_timeout(300)

        # ---------- title ----------
        page.goto(URL, wait_until='domcontentloaded'); page.evaluate("() => localStorage.setItem('oc-view', 'list')"); page.goto(URL, wait_until='domcontentloaded')
        page.wait_for_timeout(1500)
        ok(page.locator('[data-act="mode"]').count() == 2 and page.locator('[data-act="pack"]').count() == 0, 'two roles on the title; the charge nurse has no medical-direction pack')
        tap('[data-act="mode"][data-arg="md"]')
        ok(page.locator('.mode.on').inner_text().startswith('Attending') and page.locator('[data-act="pack"]').count() >= 2, 'Attending role shows the medical-direction calls')
        tap('[data-act="pack"][data-arg="miemss"]')
        ok('Maryland' in page.inner_text('.packs:not(.scn) .seg.on'), 'MIEMSS medical-direction pack selectable for the attending')
        page.screenshot(path=f'{OUT}/01b_title_md.png')
        tap('[data-act="mode"][data-arg="rn"]')
        page.screenshot(path=f'{OUT}/01_title.png')

        # ---------- start: first-play help, then the call-out ----------
        tap('button.lvl[data-arg="med"]')
        ok(page.is_visible('#modalWrap') and 'Three things to know' in page.inner_text('#modal') and page.locator('#modal ol.first li').count() == 3 and not page.is_visible('#sheetWrap'), 'the first shift opens with three lines, not the whole manual')
        c0 = J('OC.clock()'); page.wait_for_timeout(700)
        ok(J('OC.clock()') == c0 and page.locator('#modal [data-act="firstTrain"]').count() == 1, 'the clock waits, and Orientation is offered to someone who has not done it')
        tap('#modal [data-act="firstHelp"]')
        ok(page.is_visible('#sheetWrap') and 'How to run the board' in page.inner_text('#sheet'), 'How to play is one tap away')
        tap('.sheet-x'); tap('#modal [data-act="resume"]')
        page.wait_for_timeout(900)
        ok(page.is_visible('#modalWrap'), 'call-out card appears at shift start')
        page.screenshot(path=f'{OUT}/02_callout.png')
        if not tap('#modal [data-act="card"][data-arg="float"]'): clear_modal()
        ok(J('OC.G.pack') == 'miemss' and J('OC.G.shift') == 720 and J("OC.G.rooms.filter(r => r.kind !== 'chair').length") == 32 and page.locator('#zone-rp .room').count() == 6, 'MIEMSS pack, 12-hour shift, 32 beds plus 6 results-pending chairs')
        ok('Opens 09:00' in page.inner_text('#zh-ft'), 'Fast Track header says it opens at 09:00')
        ok(page.inner_text('#clock').startswith('07:'), 'clock starts at 07:00')

        # ---------- intake: direct registration and triage, then bed them ----------
        sim(80, budget=0)
        clear_modal()
        J('window.scrollTo(0, 0)')
        nid = J("() => { const p = OC.active().find(p => (p.loc === 'wall' || p.loc === 'triage') && !OC.emergent(p) && (p.reg === 'none' || p.tri === 'none')); return p ? p.id : null; }")
        if nid: tap(f'#laneEms [data-arg="{nid}"], #laneWait [data-arg="{nid}"]')
        ok(page.locator('#sheet [data-act="regAssign"], #sheet [data-act="triAssign"]').count() > 0, 'tapping a new arrival opens intake: pick a registrar or a triage nurse')
        page.screenshot(path=f'{OUT}/02b_intake_sheet.png')
        tap('.sheet-x')
        tap('#istaff .ic.reg:not(.off)')
        regd = 0
        for _ in range(8):
            if tap('#laneEms .mag.ok, #laneWait .mag.ok'): regd += 1
            else: break
        tap('#selbar [data-act="selCancel"]')
        tap('#istaff .ic.tri:not(.off)')
        trid = 0
        for _ in range(8):
            if tap('#laneEms .mag.ok, #laneWait .mag.ok'): trid += 1
            else: break
        page.screenshot(path=f'{OUT}/02c_triage_mode.png')
        tap('#selbar [data-act="selCancel"]')
        ok(regd >= 2 and trid >= 2, f'registration directed for {regd}, triage for {trid} by tapping')
        sim(30, budget=0)
        clear_modal()
        J('window.scrollTo(0, 0)')
        ok(J("OC.active().filter(p => p.reg === 'quick' || p.reg === 'done').length") >= 2, 'registrars finished the quick registrations')
        placed = 0
        for _ in range(8):
            if not tap('#laneEms .mag.ready, #laneWait .mag:not(.tri):not(.ghost)'): break
            if tap('.room.ok'): placed += 1
            else: tap('#selbar [data-act="selCancel"]')
        ok(placed >= 2, f'placed {placed} triaged patients by tapping')
        tap('#dockProv .pm')
        assigned = 0
        for _ in range(4):
            if tap('.room.ok'): assigned += 1
            else: break
        tap('#selbar [data-act="selCancel"]')
        ok(assigned >= 1, f'assigned {assigned} patients in provider mode')

        # ---------- manual EVS and providers: nothing happens until the player acts ----------
        idle = J("() => { const p = OC.inRooms().find(p => p.ev === 'none' && !p.arrest); return p ? p.id : null; }")
        mv = J("""() => { const p = OC.inRooms().find(p => p.esi >= 3 && p.dsp === 'none' && !p.iso && !p.sitter); if (!p) return null;
            const r = OC.G.rooms.find(r => r.kind === 'main' && !r.pid && r.st === 'clean' && !r.iso && !r.safe && OC.canPlace(p, r).ok); if (!r) return null;
            const old = p.room; return OC.move(p.id, r.id).ok ? old : null; }""")
        sim(10, budget=0)
        if idle: ok(J(f"OC.pt('{idle}').ev") == 'none', 'unassigned patient still waits for the player to assign a provider')
        if mv:
            ok(J(f"OC.room('{mv}').st") == 'dirty' and not J(f"OC.G.evsQ.includes('{mv}')"), 'dirty room waits for the player to send EVS')
            J('window.scrollTo(0, 0)')
            tap(f'#room-{mv}')
            ok(J(f"OC.G.evsQ.includes('{mv}') || OC.room('{mv}').st !== 'dirty'"), 'tapping the dirty room sends EVS')
        else: checks.append('skip  no patient to move for the EVS check')
        J('window.scrollTo(0, 0)')

        # ---------- zone jump bar ----------
        tap('#zbar .zc[data-arg="e"]'); page.wait_for_timeout(500)
        ok(J('window.scrollY') > 300, 'zone bar jumps down the board')
        J('window.scrollTo(0, 0)')

        # ---------- mid-morning board ----------
        sim(200, extra=', interp: 0')
        clear_modal()
        page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/03_board.png')
        page.screenshot(path=f'{OUT}/03b_board_full.png', full_page=True)

        # ---------- gray-zone call ----------
        gid = J("""() => { let n = 0; while (!OC.inRooms().some(p => p.dsp === 'decide') && !OC.G.over && n++ < 30000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, gray: false, interp: 0}); }
            OCUI.U.sel = null; const p = OC.inRooms().find(p => p.dsp === 'decide'); return p ? p.id : null; }""")
        page.wait_for_timeout(300); clear_modal()
        if gid:
            J('window.scrollTo(0, 0)')
            tap('#room-' + J(f"OC.pt('{gid}').room"))
            ok(page.locator('#sheet [data-act="gray"]').count() == 3, 'gray-zone patient card offers home, observation, or admit')
            page.screenshot(path=f'{OUT}/05c_gray_call.png')
            tap('#sheet [data-act="gray"][data-arg$="|obs"]')
            ok(J(f"OC.pt('{gid}').grayPick") == 'obs', 'gray-zone call made from the patient card')
            if page.is_visible('#sheetWrap'): tap('.sheet-x')
        else: ok(False, 'found a gray-zone patient waiting on a call')

        # ---------- the Box: medical direction goes to a doctor ----------
        J("() => { let n = 0; while (!(OC.G.box.cur && OC.G.box.cur.kind === 'consult' && !OC.G.box.cur.taken) && n++ < 8000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); } }")
        page.wait_for_timeout(300); clear_modal()
        ok('Find a doctor' in page.inner_text('#boxbar'), 'a medical-direction call asks the charge nurse to find a doctor')
        page.screenshot(path=f'{OUT}/04a_box_ringing.png')
        tap('#boxbar .bx-btn')
        ok(page.locator('#sheet [data-act="boxDoc"]').count() >= 2, 'Find a doctor lists the attendings')
        page.screenshot(path=f'{OUT}/04b_box_finddoc.png')
        tap('#sheet [data-act="boxDoc"]:not([disabled])')
        ok(not page.is_visible('#modalWrap') and J('!!(OC.G.box.cur && OC.G.box.cur.taken)') and 'on the line' in page.inner_text('#boxbar'), 'the attending takes the call; the charge nurse makes no medical decision')
        page.screenshot(path=f'{OUT}/04c_box_doctor.png')
        J("() => { let n = 0; while (OC.G.stats.boxC.ans < 1 && n++ < 400) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); } }")   # until this call is done; another may ring right behind it
        ok(J('OC.G.stats.boxC.ans >= 1'), 'the attending finishes the call')

        # ---------- interpreter ----------
        rid = None
        for _ in range(8):
            rid = J("() => { const p = OC.inRooms().find(p => p.lang && p.interp === 'none' && p.dsp === 'none'); return p ? p.room : null; }")
            if rid: break
            sim(20, extra=', interp: 0')
        clear_modal()
        if rid:
            tap(f'#room-{rid}')
            page.screenshot(path=f'{OUT}/05_patient_lang.png')
            tap('#sheet [data-act="interp"]')
            ok(J(f"OC.pt(OC.room('{rid}').pid).interp") in ('req', 'on'), 'interpreter requested from the patient card')
            tap('.sheet-x')
        else: ok(False, 'found a patient who needs an interpreter')

        # ---------- pharmacy override ----------
        rid = J("() => { const p = OC.inRooms().find(p => Object.keys(p.treat).some(k => p.treat[k].st === 'verify')); return p ? p.room : null; }")
        if rid:
            tap(f'#room-{rid}')
            page.screenshot(path=f'{OUT}/05b_patient_rx.png')
            tap('#sheet [data-act="override"]')
            ok(J(f"(() => {{ const p = OC.pt(OC.room('{rid}').pid); return !p || !Object.keys(p.treat).some(k => p.treat[k].st === 'verify'); }})()"), 'override releases meds waiting on pharmacy')
            tap('.sheet-x')
        else: checks.append('skip  no meds waiting on pharmacy right now')

        # ---------- provider in triage ----------
        sid = J("() => { const s = OC.G.staff.find(s => s.role === 'app' && s.st === 'on'); return s ? s.id : null; }")
        tap('#dockTeam')
        page.screenshot(path=f'{OUT}/06_team.png')
        tap(f'#sheet [data-act="staffOpen"][data-arg="{sid}"]')
        tap(f'#sheet [data-act="pit"][data-arg="{sid}|1"]')
        ok(J(f"OC.staff('{sid}').pit") is True, 'APP stationed in triage from their card')
        tap('.sheet-x')
        J("""() => { const tri = OC.G.staff.find(s => s.role === 'rn' && s.st === 'on' && s.zones.includes('triage')) || OC.G.staff.find(s => s.role === 'rn' && s.st === 'on' && !s.zones.length);
            let n = 0; const end = OC.G.t + 60; while (OC.G.t < end && OC.G.stats.pitSeen < 1 && n++ < 6000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1);
              for (const p of OC.active()) { if ((p.loc === 'triage' || p.loc === 'wall') && p.reg === 'none') OC.register(p.id, 'reg1'); if (p.loc === 'triage' && p.tri === 'none' && tri) OC.triage(p.id, tri.id); } } }""")
        page.wait_for_timeout(300)
        clear_modal()
        ok(J('OC.G.stats.pitSeen') > 0, f"provider in triage saw {J('OC.G.stats.pitSeen')} waiting patients")
        page.screenshot(path=f'{OUT}/06b_pit.png')

        # ---------- waiting room: walk it, recheck someone, update them ----------
        J('window.scrollTo(0, 0)')
        J('OC.G.wrUpdate = -1e9')
        tap('.lane-h[data-arg="triage"]')
        ok(page.locator('#sheet [data-act="updWait"]').count() == 1, 'the triage sheet offers to walk the waiting room')
        if tap('#sheet [data-act="updWait"]:not([disabled])'):
            ok(abs(J('OC.G.wrUpdate') - J('OC.G.t')) < 1, 'walked the waiting room and updated everyone')
        tap('.sheet-x')
        wid = J("() => { const p = OC.active().find(p => p.loc === 'waiting'); return p ? p.id : null; }")
        if wid:
            tap(f'#laneWait [data-arg="{wid}"]')
            tap('#selbar [data-act="selInfo"]')
            page.screenshot(path=f'{OUT}/06c_waiting_patient.png')
            if tap('#sheet [data-act="recheck"]:not([disabled])'):
                ok(J(f"OC.G.staff.some(s => s.tq.some(k => k.pid === '{wid}' && k.kind === 'recheck') || (s.task && s.task.kind === 'recheck' && s.task.pid === '{wid}')) || OC.pt('{wid}').lastRecheck != null"), 'recheck ordered from the waiting patient card')
            else: checks.append('skip  no nurse free for a recheck')
            J(f"OC.pt('{wid}').lastUpdate = null")
            page.wait_for_timeout(250)
            if tap('#sheet [data-act="upd"]:not([disabled])'):
                ok(J(f"OC.pt('{wid}').lastUpdate") is not None, 'patient updated from their card')
            if page.is_visible('#sheetWrap'): tap('.sheet-x')
            tap('#selbar [data-act="selCancel"]')
        else: checks.append('skip  nobody in the waiting room')

        # ---------- hold nurse ----------
        tap('#dockTeam')
        tap('#sheet [data-act="zone"][data-arg="hold"]')
        ok('Hold nurse' in page.inner_text('#sheet'), 'the team sheet opens the hold nurse picker')
        page.screenshot(path=f'{OUT}/06d_hold_nurse.png')
        tap('#sheet [data-act="zt"][data-arg="rnX|hold"]')
        ok('hold' in J("OC.staff('rnX').zones"), 'resource nurse assigned to the admitted holds')
        J("OC.toggleZone('rnX', 'hold')")
        tap('.sheet-x')

        # ---------- divert ----------
        J("() => { for (const h of OC.G.region.hosps) { h.st = 'open'; h.hold = OC.G.t + 60; } OC.G.region.susp = -1e9; }")
        tap('#btnYellow')
        if page.locator('#sheet [data-act="divertSet"][data-arg="yellow|1"]:not([disabled])').count():
            tap('#sheet [data-act="divertSet"][data-arg="yellow|1"]')
            tap('#sheet [data-act="divertSet"][data-arg="red|1"]')
            ok(J('OC.G.dv.yellow.on && OC.G.dv.red.on'), 'Yellow and Red Alert turn on')
            page.screenshot(path=f'{OUT}/08_divert.png')
            tap('#sheet [data-act="divertSet"][data-arg="yellow|0"]'); tap('#sheet [data-act="divertSet"][data-arg="red|0"]')
            ok(not J('OC.G.dv.yellow.on || OC.G.dv.red.on'), 'divert lifts')
            right0 = J('OC.G.stats.outRight')
            J("() => { for (const k in OC.G.out) OC.G.out[k].until = OC.G.t; OC.G.dv.ct.on = false; OC.startOutage('ct'); }")
            page.wait_for_timeout(300)
            ok(page.locator('#sheet .dv-out').count() == 1, 'divert sheet shows what is broken')
            tap('#sheet [data-act="divertSet"][data-arg="ct|1"]')
            ok(J('OC.G.dv.ct.on') and J('OC.G.stats.outRight') == right0 + 1, 'CT Divert from the sheet, credited for the CT outage')
            page.screenshot(path=f'{OUT}/08d_ct_divert.png')
            tap('#sheet [data-act="divertSet"][data-arg="ct|0"]')
        else: checks.append('skip  administration had blocked divert')
        ok(page.locator('#sheet .dv.fcp').count() == 1 and page.locator('#sheet .dv.region').count() == 1, 'divert sheet shows the region and the full-capacity protocol')
        page.screenshot(path=f'{OUT}/08e_capacity.png', full_page=True)
        tap('.sheet-x')

        # ---------- admitted patient: send them up with a transporter ----------
        J("() => { let n = 0; while (!OC.inRooms().some(p => p.dsp === 'bedready') && !OC.G.over && n++ < 30000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, up: false, interp: 0}); } OCUI.U.sel = null; }")
        page.wait_for_timeout(300); clear_modal()
        rid = J("() => { const p = OC.inRooms().find(p => p.dsp === 'bedready'); return p ? p.room : null; }")
        if rid:
            J('window.scrollTo(0, 0)')
            tap(f'#room-{rid}')
            page.screenshot(path=f'{OUT}/08b_bed_ready.png')
            tap('#sheet [data-act="sendUp"]:not([disabled])')
            ok(J(f"(() => {{ const r = OC.room('{rid}'); const p = r.pid ? OC.pt(r.pid) : null; return !p || p.dsp === 'xportq'; }})()"), 'bed ready: transporter or tech sent from the patient card')
            if page.is_visible('#sheetWrap'): tap('.sheet-x')
        else: ok(False, 'found an admitted patient with a bed ready')

        # ---------- save, reload, resume ----------
        tap('#btnPause')
        t_saved = J('OC.G.t')
        page.reload(wait_until='domcontentloaded'); page.wait_for_timeout(1500)
        ok(page.locator('.lvl.resume').count() == 1, 'title offers to resume the saved shift')
        tap('.lvl.resume')
        ok(abs(J('OC.G.t') - t_saved) < 1, 'saved shift resumes where it paused')
        tap('#modal [data-act="resume"]')

        # ---------- massive transfusion on an inbound trauma ----------
        found = J("""() => { for (let seed = 1; seed < 60; seed++) { OC.newGame('hard', seed, {pack: 'national'}); let n = 0;
            while (n++ < 3000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 2, mtp: false});
              const e = OC.G.enroute.map(OC.pt).find(p => p.bleed === 'mtp'); if (e) return e.id; } } return null; }""")
        page.wait_for_timeout(300); clear_modal()
        if found:
            tap(f'#laneEms [data-arg="{found}"]')
            page.screenshot(path=f'{OUT}/07_mtp_inbound.png')
            tap('#sheet [data-act="mtp"]')
            ok(J(f"!!(OC.pt('{found}').bb && OC.pt('{found}').bb.mtp)"), 'MTP activated from the inbound trauma card')
            tap('.sheet-x')
        else: ok(False, 'found an inbound hemorrhaging trauma')

        # ---------- transfer: book the interfacility ambulance ----------
        tx = J("""() => { for (let seed = 3; seed < 30; seed++) { OC.newGame('hard', seed * 7); let n = 0;
            while (n++ < 7200 && !OC.G.over) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, ift: false});
              const p = OC.inRooms().find(p => p.dsp === 'txok'); if (p) { OCUI.U.sel = null; return p.room; } } } return null; }""")
        page.wait_for_timeout(300); clear_modal()
        if tx:
            J('window.scrollTo(0, 0)')
            tap(f'#room-{tx}')
            page.screenshot(path=f'{OUT}/08c_ift.png')
            tap('#sheet [data-act="ift"][data-arg$="|cct"]')
            ok(J(f"(() => {{ const r = OC.room('{tx}'); const p = r.pid ? OC.pt(r.pid) : null; return !p || p.dsp === 'iftwait'; }})()"), 'interfacility critical care ambulance booked from the patient card')
            if page.is_visible('#sheetWrap'): tap('.sheet-x')
        else: ok(False, 'found a patient accepted for transfer')

        # ---------- finish the shift ----------
        J("() => { let n = 0; while (!OC.G.over && n++ < 90000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 2}); } }")
        page.wait_for_timeout(900)
        ok(page.is_visible('#report'), 'shift report at 19:00')
        rt = page.inner_text('#report')
        ok('Door to provider (median)' in rt and 'Boarding' in rt and 'RN hours' in rt and 'Experience score' in rt, 'report shows ED metrics, patient experience, and staffing hours')
        ok(page.locator('#report .mm li').count() >= 1 or 'Nothing went badly wrong' in rt, 'report walks through the worst moments (M&M)')
        page.screenshot(path=f'{OUT}/09_report.png', full_page=True)
        rep = J('OC.G.report')
        print('report', json.dumps({k: rep[k] for k in ['care', 'wait', 'sat', 'stars', 'seen', 'dc', 'adm', 'lwbs', 'ama', 'returns', 'mtp', 'interp', 'pitSeen']}))

        # ---------- desktop ----------
        tap('#report [data-act="menu"]'); page.wait_for_timeout(500)
        ok(page.is_visible('#title'), 'back to the menu')
        page.set_viewport_size({'width': 1280, 'height': 860})
        tap('button.lvl[data-arg="hard"]'); page.wait_for_timeout(500)
        clear_modal()
        sim(240)
        clear_modal()
        page.wait_for_timeout(400)
        page.screenshot(path=f'{OUT}/10_desktop.png')
        b.close()

try:
    run()
except Exception as e:
    errors.append('TEST FAILURE: ' + repr(e))
print('\n'.join(checks))
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]:
    print(' ', e)
sys.exit(1 if errors else 0)
