"""The floor plan (v0.8): played sideways on a phone, every tap lands on the floor itself."""
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

        def tap(sel):
            if not sel.startswith('#modal') and not sel.startswith('#rotate'): clear_cards()
            loc = page.locator(sel).first
            if loc.count() == 0: return False
            try:
                loc.tap(timeout=2500); page.wait_for_timeout(200); return True
            except Exception as e:
                why = [ln.strip() for ln in str(e).split("\n") if "intercepts" in ln or "not visible" in ln or "not stable" in ln]; errors.append(f"tap {sel}: " + str(e).split("\n")[0][:100] + (" | " + why[-1][:150] if why else "")); return False

        def focus(sel):   # bring a spot on the floor into view, the way the Orientation does
            J(f"() => {{ const x = document.querySelector('{sel}'); if (x) OCUI.mapFocus(x); }}"); page.wait_for_timeout(120)

        page.goto(URL)
        J("() => { localStorage.removeItem('oc-view'); localStorage.setItem('oc-seen-help2', '1'); localStorage.setItem('oc-seen-help2-md', '1'); }")
        page.goto(URL); page.wait_for_timeout(900)
        ok(J('OCUI.U.view') == 'map', 'the floor plan is the default board')
        tap('[data-act="mode"][data-arg="rn"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        ok(J("getComputedStyle(document.getElementById('map')).display") != 'none' and J("getComputedStyle(document.getElementById('board')).display") == 'none', 'the floor shows and the list board hides')
        ok(J("document.querySelectorAll('#mRooms [data-act=\"room\"]').length") == J('OC.G.rooms.length'), 'every room is on the floor')
        ok(J("document.querySelectorAll('#mPeople .mp').length") >= 20, 'the staff are on the floor')
        ok(J("document.querySelectorAll('#mStatic [data-act=\"zone\"][data-arg=\"triage\"]').length") >= 1, 'the waiting room is tappable')

        # a walk-in at the door and two EMS crews on the wall
        J("() => { OCUI.U.paused = false; OC.trainPatient('uti', 'walk', { name: 'Door P.' }); OC.trainPatient('ankle', 'ems', { unit: 'Medic 3' }); OC.trainPatient('ankle', 'ems', { unit: 'Medic 4' }); OCUI.render(); }")
        page.wait_for_timeout(300)
        door = J("OC.G.triageQ[0]")
        ok(bool(door), 'a walk-in waits at the door')
        ok(J("document.querySelectorAll('#mPts [data-act=\"pt\"]').length") >= 3, 'the door and the wall show people')

        # registration: tap a registrar, then the patient on the floor
        reg = J("OC.G.staff.find(s => s.role === 'reg' && s.st === 'on' && !s.task).id")
        tap(f'#dock [data-act="regSel"][data-arg="{reg}"]')
        ok(J('OCUI.U.sel && OCUI.U.sel.type') == 'reg', 'tapping a registrar selects them')
        focus(f'#mPts [data-arg="{door}"]')
        tap(f'#mPts [data-arg="{door}"]')
        ok(J(f"OC.pt('{door}').reg") != 'none', 'tapping the walk-in on the floor registers them')
        tap('#selbar [data-act="selCancel"]')
        ok(not J('OCUI.U.sel'), 'Done clears the selection')

        # a pod sign opens nurse assignments; nothing behind it fires
        focus('#mzh-a'); tap('#mzh-a')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'zone' and J('OCUI.U.sheet.z') == 'a', 'tapping a pod sign opens its nurses')
        tap('.sheet-x'); page.wait_for_timeout(450)
        ok(not J('OCUI.U.sheet'), 'the sheet closes')

        # the resus sign sits over the resus doorway: the tap reaches the sign, not the bay behind it
        focus('#mzh-resus'); tap('#mzh-resus')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.z") == 'resus', 'the resus sign wins over the bay next to it')
        tap('.sheet-x'); page.wait_for_timeout(450)

        # a wall patient: tap them on the stretcher to open their card
        wall = J("OC.active().find(p => p.loc === 'wall').id")
        focus(f'#mPts [data-arg="{wall}"]'); tap(f'#mPts [data-arg="{wall}"]')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.pid") == wall, 'tapping a crew on the wall opens the patient card')
        tap('.sheet-x'); page.wait_for_timeout(450)

        # drag to pan: the camera moves and nothing opens
        vb0 = J("document.querySelector('#map svg').getAttribute('viewBox')")
        box = page.locator('#map').bounding_box()
        cx, cy = box['x'] + box['width'] * 0.55, box['y'] + box['height'] * 0.5
        cdp = ctx.new_cdp_session(page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': cx, 'y': cy}]})
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': cx - i * 22, 'y': cy - i * 4}]})
            page.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(300)
        ok(J("document.querySelector('#map svg').getAttribute('viewBox')") != vb0, 'dragging pans the floor')
        ok(not J('OCUI.U.sheet') and not J('OCUI.U.sel'), 'a drag is not a tap')

        # more crews than the wall holds: they back up outside, in ambulances
        J("() => { for (let i = 0; i < 8; i++) OC.trainPatient('ankle', 'ems', { unit: 'Medic ' + (20 + i) }); OCUI.render(); }")
        page.wait_for_timeout(200)
        nwall = J("OC.active().filter(p => p.loc === 'wall').length")
        ok(J("document.querySelectorAll('#mAmb [data-act=\"pt\"]').length") == min(4, nwall - 6), 'crews past the sixth wait outside in their ambulances')
        ok('backed up outside' in J("document.getElementById('mAmb').textContent"), 'the bay says how many are backed up')
        page.screenshot(path=f'{OUT}/map_phone.png')

        # turn the phone upright: ask to turn it back, or switch to the list
        page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(400)
        ok(J("getComputedStyle(document.getElementById('rotate')).display") != 'none', 'upright, the floor plan asks to turn sideways')
        tap('#rotate [data-act="view"]'); page.wait_for_timeout(300)
        ok(J('OCUI.U.view') == 'list' and J("localStorage.getItem('oc-view')") == 'list', 'the list board is one tap away, and it sticks')
        ok(J("getComputedStyle(document.getElementById('rotate')).display") == 'none' and J("getComputedStyle(document.getElementById('board')).display") != 'none', 'the list board shows')
        tap('#btnPause'); tap('#modal [data-act="view"]')
        ok(J('OCUI.U.view') == 'map', 'the pause menu switches back to the floor plan')
        ok(J("getComputedStyle(document.getElementById('rotate')).display") != 'none', 'and, still upright, asks to turn sideways again')
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
        tap('#modal [data-act="resume"]')
        ok(not J('OCUI.U.paused'), 'sideways again, the shift resumes')

        # the attending sees the same floor, but the charge nurse runs the pods
        J("() => { OCUI.U.paused = false; OCUI.showTitle(); }"); page.wait_for_timeout(300)
        tap('[data-act="mode"][data-arg="md"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        ok(J('OC.G.mode') == 'md', 'an attending shift starts on the floor plan')
        focus('#mzh-a'); tap('#mzh-a')
        ok(not J('OCUI.U.sheet'), 'the attending cannot reassign nurses from a pod sign')
        page.screenshot(path=f'{OUT}/map_phone_md.png')
        b.close()


try:
    run()
except Exception as e:
    errors.append('crash: ' + repr(e))
print('\n'.join(checks))
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]: print(' ', e)
sys.exit(1 if errors else 0)
