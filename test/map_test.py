"""The floor plan (v0.9 to v0.11): the whole department on a phone held sideways. Every tap lands on the floor itself."""
import os, sys
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
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        J = page.evaluate

        def clear_cards():   # event cards (call-outs and the like) pause the shift; answer them and move on
            for _ in range(4):
                if not J("!!(OC.G && OC.G.card)") or not page.is_visible('#modalWrap'): return
                page.locator('#modal [data-act="card"]:not([disabled])').first.tap(); page.wait_for_timeout(200)

        def tap(sel, **kw):
            if not sel.startswith('#modal') and not sel.startswith('#rotate'): clear_cards()
            loc = page.locator(sel).first
            if loc.count() == 0: errors.append(f'tap {sel}: not found'); return False
            try:
                loc.tap(timeout=2500, **kw); page.wait_for_timeout(200); return True
            except Exception as e:
                why = [ln.strip() for ln in str(e).split("\n") if "intercepts" in ln or "not visible" in ln or "not stable" in ln]
                errors.append(f"tap {sel}: " + str(e).split("\n")[0][:100] + (" | " + why[-1][:150] if why else "")); return False

        def close_sheet():
            if J('!!OCUI.U.sheet'): tap('.sheet-x'); page.wait_for_timeout(450)

        box = lambda sel: page.locator(sel).first.bounding_box()

        page.goto(URL)
        J("() => { localStorage.removeItem('oc-view'); localStorage.setItem('oc-seen-help2', '1'); localStorage.setItem('oc-seen-help2-md', '1'); }")
        page.goto(URL); page.wait_for_timeout(900)
        ok(J('OCUI.U.view') == 'map', 'the floor plan is the default board')
        ok(box('#title .card')['height'] <= 390, 'the menu fits a sideways phone without scrolling')
        tap('[data-act="mode"][data-arg="rn"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        J("() => { OCUI.U.freeze = true; }")   # hold the clock so the checks don't race the shift

        # the layout: one strip on top, rails at the sides, the whole floor between
        ok(J("document.body.classList.contains('rails')"), 'a sideways phone gets side rails')
        m, top = box('#map'), box('#top')
        ok(top['height'] <= 44, f"the top strip is one slim line ({round(top['height'])}px)")
        ok(m['height'] >= 390 - 46 and m['width'] >= 600, f"the floor gets the rest of the screen ({round(m['width'])}x{round(m['height'])})")
        cam = J('OCUI.cam()')
        ok(cam['x'] <= 0 and cam['y'] <= 0 and cam['x'] + cam['w'] >= 1400 and cam['y'] + cam['h'] >= 712, 'the whole floor is on screen, no dragging needed')
        ok(cam['far'] and J("getComputedStyle(document.querySelector('#mRooms .nearonly')).display") == 'none', 'zoomed out, rooms show icons, not words')
        rl, rr = box('#railL'), box('#dock')
        ok(rl['x'] == 0 and rl['width'] < 110 and J("document.querySelectorAll('#railL .ic').length") >= 3, 'registrars and the triage nurse ride the left rail')
        ok(rr['x'] + rr['width'] >= 843 and rr['width'] < 170 and J("document.querySelectorAll('#dock .pm').length") >= 4, 'providers ride the right rail')
        ok(J("document.querySelectorAll('#mRooms [data-act=\"room\"]').length") == J('OC.G.rooms.length'), 'every room is on the floor')
        r1 = box('#mroom-1')
        ok(r1['width'] >= 40 and r1['height'] >= 38, f"rooms are big enough to tap ({round(r1['width'])}x{round(r1['height'])})")
        ok(J("document.querySelectorAll('#mPeople .mp').length") >= 20, 'the staff are on the floor')

        # a walk-in at the door and two EMS crews on the wall
        J("() => { OC.trainPatient('uti', 'walk', { name: 'Door P.' }); OC.trainPatient('ankle', 'ems', { unit: 'Medic 3' }); OC.trainPatient('ankle', 'ems', { unit: 'Medic 4' }); OCUI.render(); }")
        page.wait_for_timeout(300)
        ok(J("OC.G.triageQ.length") >= 1, 'a walk-in waits at the door')
        ok(J("document.querySelectorAll('#mPts [data-act=\"pt\"]').length") >= 3, 'the door and the wall show people')
        ok(J("document.querySelectorAll('#mAmbs .mamb').length") >= 2, 'their ambulances are parked at the bay')

        # registration: tap a registrar on the rail, then the line at the door
        reg = J("OC.G.staff.find(s => s.role === 'reg' && s.st === 'on').id")
        tap(f'#railL [data-act="regSel"][data-arg="{reg}"]')
        ok(J('OCUI.U.sel && OCUI.U.sel.type') == 'reg', 'tapping a registrar selects them')
        n0 = J("OC.G.triageQ.map(OC.pt).filter(p => p.reg === 'none').length")
        tap('#mDoor', position={'x': 10, 'y': 60})
        ok(n0 >= 1 and J("OC.G.triageQ.map(OC.pt).filter(p => p.reg === 'none').length") == n0 - 1, 'tapping the line at the door registers the next person in it')
        tap('#selbar [data-act="selCancel"]')
        ok(not J('OCUI.U.sel'), 'Done clears the selection')

        # the waiting room is one target when zoomed out: it opens a list to pick from
        wid = J("OC.trainPatient('ankle', 'waiting', { name: 'Wait R.' })")
        J("() => OCUI.render()")
        tap('#mWait', position={'x': 60, 'y': 60})
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'zone' and J('OCUI.U.sheet.z') == 'triage', 'tapping the waiting room opens its list')
        ok(page.locator(f'#sheet .mag[data-arg="{wid}"]').count() == 1, 'the list shows who is waiting')
        tap(f'#sheet .mag[data-arg="{wid}"]'); page.wait_for_timeout(300)
        ok(J("OCUI.U.sel && OCUI.U.sel.pid") == wid and not J('OCUI.U.sheet'), 'picking someone selects them and closes the list')
        free = J("(OC.G.rooms.find(r => !r.pid && r.st === 'clean' && !r.closed && r.kind === 'main') || {}).id")
        if free:
            tap(f'#mroom-{free}')
            ok(J(f"OC.pt('{wid}').room") == free, 'then a tap on a green room beds them')
        else:
            tap('#selbar [data-act="selCancel"]')

        # a pod sign opens nurse assignments; the resus sign wins over the bay next to it
        tap('#mzh-a')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'zone' and J('OCUI.U.sheet.z') == 'a', 'tapping a pod sign opens its nurses')
        close_sheet()
        ok(not J('OCUI.U.sheet'), 'the sheet closes')
        tap('#mzh-resus')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.z") == 'resus', 'the resus sign wins over the bay next to it')
        close_sheet()

        # a wall patient: tap the crew to open the patient card (a drawer on the right, so the floor stays in view)
        wall = J("OC.active().filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive)[0].id")
        tap(f'#mPts [data-arg="{wall}"]')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.pid") == wall, 'tapping a crew on the wall opens the patient card')
        sh = box('.sheet')
        ok(sh['x'] > 250 and sh['height'] >= 380, 'cards slide in from the right on a sideways phone')
        ok(page.locator('#sheet .vv').count() == 5 and page.locator('#sheet .vtrend').count() == 1 and '°F' in page.locator('#sheet .ph-cc').inner_text(), 'the card shows all five vitals, the temperature in Fahrenheit, and which way they are heading')
        close_sheet()

        # patient names: a highlighted tag in every occupied room, at both zoom levels, drawn above the staff
        occ = J("OC.G.rooms.filter(r => r.pid).length")
        ok(occ >= 3 and page.locator('#mNames .mname.faronly').count() == occ and page.locator('#mNames .mname.nearonly').count() == occ, f'every occupied room carries its patient\'s name ({occ})')
        nm = J("(() => { const r = OC.G.rooms.find(r => r.pid && /^\\d+$/.test(r.id)); return [OC.pt(r.pid).name, r.id]; })()")
        ok(nm[0] in J("Array.from(document.querySelectorAll('#mNames .mname.faronly text')).map(t => t.textContent)") and nm[0] in J(f"document.getElementById('mroom-{nm[1]}').getAttribute('aria-label')"), f'the tag reads the patient\'s name ({nm[0]})')
        tb = page.locator('#mNames .mname.faronly text').first.bounding_box()
        ok(tb['height'] >= 6.5 and page.locator('#mNames .mname.faronly').first.is_visible() and not page.locator('#mNames .mname.nearonly').first.is_visible(), f'zoomed out, the name is still readable ({tb["height"]:.1f}px)')
        ok(J("getComputedStyle(document.getElementById('mNames')).pointerEvents") == 'none', 'and it never blocks a tap on the room')

        # a real fingertip slides during a tap: the floor still takes it
        cdp = ctx.new_cdp_session(page)
        def finger(sel, dx, dy):
            bb = page.locator(sel).first.bounding_box(); x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); page.wait_for_timeout(30)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx / 2, 'y': y + dy / 2}]}); page.wait_for_timeout(25)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx, 'y': y + dy}]}); page.wait_for_timeout(40)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(350)
        finger(f'#mroom-{nm[1]}', 9, 8)
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'pt', 'a tap that slides 12 px still opens the room')
        close_sheet(); page.wait_for_timeout(450)
        finger(f'#mroom-{nm[1]}', 17, 14)
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'pt', 'so does a hurried one that slides 22 px')
        close_sheet(); page.wait_for_timeout(450)

        # "Needs you": a count of what is waiting, and each tap goes to the next one
        need = J("document.querySelector('#needBtn b').textContent")
        ok(need.isdigit() and int(need) >= 2 and J("document.getElementById('needBtn').classList.contains('on')"), f'the Needs you button counts what is waiting ({need})')
        nb = box('#needBtn')
        ok(J("!!document.querySelector('#railL #needBtn')") and nb['x'] + nb['width'] <= box('#map')['x'] + 1 and nb['height'] >= 40, 'on a sideways phone it rides at the foot of the left rail, off the floor')
        said = J("document.getElementById('needBtn').getAttribute('aria-label')")
        named = J("document.querySelector('#needBtn .nb-w').textContent")
        ok(bool(named) and 'Go to the next one' in said, f'it names where the next tap goes ({named})')
        n0 = page.locator('.toast').count()
        tap('#needBtn'); page.wait_for_timeout(300)
        first = J('OCUI.U.needLast')
        went = J("(() => { const s = OCUI.U.sheet, sel = OCUI.U.sel; if (s && s.type === 'pt') { const p = OC.pt(s.pid); return [p.name, p.room ? OC.roomName(p.room) : '']; } if (s && s.type === 'boxdoc') return ['The Box']; if (s && s.type === 'zone') return ['The door', 'Waiting room']; if (sel && sel.pid) return [OC.pt(sel.pid).name]; return []; })()")
        ok(bool(first) and named in went and page.locator('#mNeed .needring').count() == 1, f'a tap goes exactly where it said, and rings it on the floor ({named} -> {went})')
        ok(not J('!!OCUI.U.sheet') or page.locator('.toast').count() == n0, 'no pop-up lands on the card it just opened')
        close_sheet(); J("() => { OCUI.U.sel = null; OCUI.render(); }")
        tap('#needBtn'); page.wait_for_timeout(300)
        ok(J('OCUI.U.needLast') != first, 'the next tap goes on to the next one')
        close_sheet(); J("() => { OCUI.U.sel = null; OCUI.render(); }")
        # the radio outranks everything: with the Box ringing, the button turns red, names it, and goes there
        J("() => { const G = OC.G; if (!G.box.cur) OC.trainConsult(); OCUI.render(); }"); page.wait_for_timeout(250)
        if J('!!OC.G.box.cur && !OC.G.box.cur.taken'):
            ok(J("document.getElementById('needBtn').classList.contains('hot')") and J("document.querySelector('#needBtn .nb-w').textContent") == 'The Box', 'when the Box rings, the button is red and says so')
            tap('#needBtn'); page.wait_for_timeout(300)
            ok(J("OCUI.U.sheet && OCUI.U.sheet.type") in ('boxdoc',) or J("!!(OCUI.U.modal)") or J('!!OC.G.box.cur.taken'), 'and one tap answers it')
            close_sheet(); J("() => { OCUI.U.modal = null; OCUI.U.sel = null; OCUI.render(); }")
        # the waiting list: tap a row to bed them, or Card to read their card
        J("() => { OCUI.U.sheet = { type: 'zone', z: 'triage' }; OCUI.render(); }"); page.wait_for_timeout(250)
        if page.locator('#sheet [data-act="ptCard"]').count():
            pidc = page.locator('#sheet [data-act="ptCard"]').first.get_attribute('data-arg')
            tap('#sheet [data-act="ptCard"]')
            ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'pt' and J('OCUI.U.sheet.pid') == pidc and not J('!!OCUI.U.sel'), 'Card beside a name in the waiting list opens that card')
        close_sheet(); J("() => { OCUI.U.sel = null; OCUI.render(); }")

        # zoom in: the words come back, and dragging pans without tapping anything
        tap('#mzoom [data-arg="in"]'); tap('#mzoom [data-arg="in"]'); page.wait_for_timeout(200)
        ok(not J('OCUI.cam().far') and J("getComputedStyle(document.querySelector('#mRooms .nearonly')).display") != 'none', 'zoomed in, rooms show words')
        vb0 = J("document.querySelector('#map svg').getAttribute('viewBox')")
        mb = box('#map'); cx, cy = mb['x'] + mb['width'] * 0.55, mb['y'] + mb['height'] * 0.5
        cdp = ctx.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': cx, 'y': cy}]})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': cx - i * 22, 'y': cy - i * 4}]})
            page.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(300)
        ok(J("document.querySelector('#map svg').getAttribute('viewBox')") != vb0, 'dragging pans the floor')
        ok(not J('OCUI.U.sheet') and not J('OCUI.U.sel'), 'a drag is not a tap')
        tap('#mzFit'); page.wait_for_timeout(200)
        ok(J('OCUI.cam().far') and J("document.getElementById('mzFit').hidden"), 'one tap shows the whole floor again')

        # more crews than the wall holds: they back up outside, in their ambulances
        J("() => { for (let i = 0; i < 8; i++) OC.trainPatient('ankle', 'ems', { unit: 'Medic ' + (20 + i) }); OCUI.render(); }")
        page.wait_for_timeout(300)
        nwall = J("OC.active().filter(p => p.loc === 'wall').length")
        ok(J("document.querySelectorAll('#mAmbs .mamb[data-act=\"pt\"]').length") == min(4, nwall - 6), 'crews past the sixth wait outside in their ambulances')
        ok('outside' in J("document.getElementById('mAmb').textContent"), 'the bay says how many are backed up')
        outp = J("OC.active().filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive)[6].id")
        tap(f'#mAmbs [data-arg="{outp}"]')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.pid") == outp, 'tapping a backed-up ambulance opens its patient')
        close_sheet()
        page.screenshot(path=f'{OUT}/map_phone.png')

        # turn the phone upright: ask to turn it back, or switch to the list
        J("() => { OCUI.U.freeze = false; }")
        page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(400)
        ok(J("getComputedStyle(document.getElementById('rotate')).display") != 'none', 'upright, the floor plan asks to turn sideways')
        J("() => { OCUI.U.freeze = false; OCUI.U.paused = false; OCUI.U.sheet = null; OCUI.U.modal = null; if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); }")
        t0 = J('OC.G.t'); page.wait_for_timeout(2600); t1 = J('OC.G.t')
        ok(t1 - t0 < 0.05, f'and the clock holds while the board is covered ({t1 - t0:.2f} min in 2.6 s)')
        J("() => { OCUI.U.freeze = true; }")
        tap('#rotate [data-act="view"]'); page.wait_for_timeout(300)
        ok(J('OCUI.U.view') == 'list' and J("localStorage.getItem('oc-view')") == 'list', 'the list board is one tap away, and it sticks')
        ok(J("getComputedStyle(document.getElementById('rotate')).display") == 'none' and J("getComputedStyle(document.getElementById('board')).display") != 'none', 'the list board shows')
        ok(J("document.getElementById('istaff').parentNode.id") == 'intake', 'intake staff go back to the list board')
        tap('#btnPause'); tap('#modal [data-act="view"]')
        ok(J('OCUI.U.view') == 'map', 'the pause menu switches back to the floor plan')
        ok(J("getComputedStyle(document.getElementById('rotate')).display") != 'none', 'and, still upright, asks to turn sideways again')
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
        tap('#modal [data-act="resume"]')
        ok(not J('OCUI.U.paused'), 'sideways again, the shift resumes')

        # a short browser window (address bar showing) and other phones still fit the floor
        J("() => { OCUI.U.freeze = true; }")
        for (w, h) in [(844, 340), (667, 375), (915, 412)]:
            page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(350)
            cam = J('OCUI.cam()'); r1 = box('#mroom-1')
            ok(cam['x'] <= 0 and cam['x'] + cam['w'] >= 1400 and cam['y'] <= 0 and cam['y'] + cam['h'] >= 712 and r1['width'] >= 34, f"{w}x{h}: the whole floor fits (rooms {round(r1['width'])}px)")
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)

        # the attending sees the same floor, but the charge nurse runs the pods
        J("() => { OCUI.U.freeze = false; OCUI.U.paused = false; OCUI.showTitle(); }"); page.wait_for_timeout(300)
        tap('[data-act="mode"][data-arg="md"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        ok(J('OC.G.mode') == 'md', 'an attending shift starts on the floor plan')
        ok(J("getComputedStyle(document.getElementById('railL')).display") == 'none', 'the attending has no intake rail')
        tap('#mzh-a')
        ok(not J('OCUI.U.sheet'), 'the attending cannot reassign nurses from a pod sign')
        page.screenshot(path=f'{OUT}/map_phone_md.png')

        # a laptop: a dock along the bottom, and words on the rooms
        page.set_viewport_size({'width': 1366, 'height': 800}); page.wait_for_timeout(400)
        ok(not J("document.body.classList.contains('rails')") and not J('OCUI.cam().far'), 'a laptop keeps the dock and shows words')

        # class tools: the five-minute shift with a scenario, and a report to print
        J("() => { OCUI.U.paused = false; OCUI.showTitle(); }"); page.wait_for_timeout(300)
        ok(page.locator('[data-act="scenario"]').count() == 5 and page.is_visible('[data-act="scenario"][data-arg="mci"]') and not page.is_visible('.scn-sel'), 'on a laptop the scenarios are buttons')
        tap('[data-act="scenario"][data-arg="mci"]')
        ok(J('OCUI.U.scen') == 'mci' and J("document.querySelector('[data-act=\"scenario\"][data-arg=\"mci\"]').classList.contains('on')"), 'and a tap picks one')
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
        tap('[data-act="mode"][data-arg="rn"]')
        ok(page.locator('button.lvl[data-arg="rush"]').count() == 1 and page.locator('.scn-sel option').count() == 5 and page.is_visible('.scn-sel') and not page.is_visible('[data-act="scenario"]'), 'the menu offers the five-minute shift, and scenarios in a short menu')
        fits = lambda: J("(() => { const t = document.getElementById('title'); return t.scrollHeight <= t.clientHeight + 1; })()")
        ok(fits(), 'the whole menu fits a sideways phone')
        page.select_option('.scn-sel', 'ct'); page.wait_for_timeout(250)
        ok(J("localStorage.getItem('oc-scen')") == 'ct' and J("document.querySelector('.scn-sel').value") == 'ct' and 'CT' in page.locator('.packs.scn small').inner_text() and fits(), 'a scenario is picked and remembered, and the menu still fits')
        tap('button.lvl[data-arg="rush"]'); page.wait_for_timeout(500)
        ok(J('OC.G.level') == 'rush' and J('OC.G.scen') == 'ct' and J('OC.G.shift') == 120, 'the shift starts with the scenario')
        ok('Scenario: CT down' in page.locator('#toasts').inner_text() and 'Scenario: CT down' in page.locator('#objs').inner_text(), 'and says so: a message at the start, and a tag for the whole shift')
        J("() => { OCUI.U.freeze = true; }"); clear_cards(); J("() => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); OCUI.U.paused = true; OCUI.render(); }"); page.wait_for_timeout(250)
        ok('ct down scenario' in page.locator('#modal .mc-who').text_content().lower() and page.locator('#modal [data-act="words"]').count() == 1, 'the pause menu names the scenario and has the word list')
        tap('#modal [data-act="words"]'); page.wait_for_timeout(250)
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'words' and page.locator('#sheet .gl dt').count() >= 80 and 'Emergency Severity Index' in page.locator('#sheet').inner_text(), 'Words lists every short name in plain language')
        close_sheet(); J("() => { OCUI.U.paused = false; OCUI.U.freeze = false; OCUI.render(); }")
        J("() => { OCUI.U.freeze = true; for (let i = 0; i < 260; i++) { OC.step(0.1); if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); } OCUI.render(); }")
        page.wait_for_timeout(300)
        ok(J('!!OC.G.out.ct') and page.locator('#mSvc circle[fill="#C8243A"]').count() >= 1, 'the CT goes down on schedule, and the floor shows it')
        best0 = J("localStorage.getItem('oc-best-rush')")
        J("() => { for (let i = 0; i < 1300 && !OC.G.over; i++) { OC.step(0.1); if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); if (i % 20 === 0) OC.botStep({ budget: 2 }); } OCUI.U.freeze = false; }")
        page.wait_for_timeout(900)
        ok(J('OCUI.U.scene') == 'report' and page.locator('#report [data-act="print"]').count() == 1, 'the shift report has a print or save-as-PDF button')
        ok('CT down' in page.locator('#report .verdict').inner_text() and J("localStorage.getItem('oc-best-rush')") == best0, 'the report names the scenario, and scenario scores stay out of the bests')
        page.emulate_media(media='print'); page.wait_for_timeout(200)
        ok(J("getComputedStyle(document.querySelector('#report .rep-btns')).display") == 'none' and J("getComputedStyle(document.querySelector('#report .rep-meta')).display") != 'none' and J("getComputedStyle(document.querySelector('.app')).display") == 'none', 'on paper it is just the report, with a line for a name')
        page.emulate_media(media='screen')
        # the report is kept: leave it, and it is still one tap away on the menu
        tap('#report [data-act="menu"]'); page.wait_for_timeout(400)
        ok(J('OCUI.U.scene') == 'title' and page.locator('#title [data-act="lastReport"]').count() == 1, 'after leaving the report, the menu offers the last report')
        page.reload(); page.wait_for_timeout(700)
        tap('#title [data-act="lastReport"]'); page.wait_for_timeout(400)
        ok(J('OCUI.U.scene') == 'report' and 'CT down' in page.locator('#report .verdict').inner_text() and page.locator('#report [data-act="print"]').count() == 1, 'it survives a reload, scenario and all, and can still be printed')
        tap('#report [data-act="again"]'); page.wait_for_timeout(500)
        ok(J('OCUI.U.scene') == 'game' and J('OC.G.level') == 'rush' and J('OC.G.t') < 2, 'Run it back starts the same shift again in one tap')
        J("() => localStorage.removeItem('oc-scen')")
        b.close()


try:
    run()
except Exception as e:
    errors.append('crash: ' + repr(e))
print('\n'.join(checks))
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]: print(' ', e)
sys.exit(1 if errors else 0)
