"""The floor plan (v0.9 to v0.12): the whole department on a phone held sideways. Every tap lands on the floor itself."""
import os, sys
from playwright.sync_api import sync_playwright
from _browser import launch, Finger

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
errors, checks = [], []


def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)


def run():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        b = launch(pw)
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
        tap('[data-act="mode"][data-arg="rn"]'); tap('[data-act="tmenu"][data-arg="play"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        J("() => { OCUI.U.freeze = true; }")   # hold the clock so the checks don't race the shift

        # the layout: one strip on top, rails at the sides, the whole floor between
        ok(J("document.body.classList.contains('rails')"), 'a sideways phone gets side rails')
        m, top = box('#map'), box('#top')
        ok(top['height'] <= 52, f"the top strip is one line with 44 px controls (owner, Nov 26) ({round(top['height'])}px)")
        ok(m['height'] >= 390 - 52 and m['width'] >= 600, f"the floor gets the rest of the screen ({round(m['width'])}x{round(m['height'])})")
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

        # a wall patient: zoomed out, the stretchers are small, so a tap on the wall opens the list; Card opens the patient card (a drawer on the right, so the floor stays in view)
        wall = J("OC.active().filter(p => p.loc === 'wall').sort((a, b) => a.tArrive - b.tArrive)[0].id")
        nwall = J("OC.active().filter(p => p.loc === 'wall').length")
        tap(f'#mPts [data-arg="{wall}"]')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'zone' and J("OCUI.U.sheet.at") == 'wall' and page.locator('#sheet .mag-row').count() >= nwall and 'The wall' in page.locator('#sheet').inner_text(), 'zoomed out, a tap on the wall opens the list of crews')
        tap(f'#sheet [data-act="ptCard"][data-arg="{wall}"]')
        ok(J("OCUI.U.sheet && OCUI.U.sheet.pid") == wall, 'and Card opens the patient card')
        sh = box('.sheet'); th = J("document.getElementById('top').offsetHeight")
        ok(sh['x'] > 250 and sh['height'] >= 340 and abs(sh['y'] - th) <= 2, 'cards slide in from the right on a sideways phone, under the top strip')
        bx = box('#boxbar')
        ok(J(f"(() => {{ const e = document.elementFromPoint({bx['x'] + bx['width'] / 2}, {bx['y'] + bx['height'] / 2}); return !!(e && e.closest('#boxbar')); }})()") and J("(() => { const e = document.elementFromPoint(40, 18); return !!(e && e.closest('#top')); })()"), 'with a card open, the clock and the Box stay in view and in reach')
        ok(page.locator('#sheet .vv').count() == 5 and page.locator('#sheet .vtrend').count() == 1 and '°F' in page.locator('#sheet .ph-cc').inner_text(), 'the card shows all five vitals, the temperature in Fahrenheit, and which way they are heading')
        # v0.16.2: Next shows through the dimmed side of an open card. A tap there goes to the next thing; it does not just close the card.
        nb = box('#needBtn'); J("() => { OCUI.U.needLast = null; }")
        if nb and J("document.getElementById('needBtn').classList.contains('on')"):
            page.touchscreen.tap(nb['x'] + nb['width'] / 2, nb['y'] + nb['height'] / 2); page.wait_for_timeout(450)
            ok(J("OCUI.U.needLast != null && !!(OCUI.U.sheet || OCUI.U.sel || document.getElementById('toasts').textContent)"), 'with a card open, a tap on Next goes to the next thing')
            J("() => { OCUI.U.sel = null; OCUI.U.sheet = null; OCUI.render(); }"); page.wait_for_timeout(450)
        close_sheet()
        ok(J("document.querySelectorAll('#mRooms .mico rect.ib').length") >= 1 and J("document.querySelectorAll('#mRooms .mico circle.ib').length") == 0, 'room icons are rounded squares, so a blue icon is not read as an ESI circle')
        J(f"() => {{ OCUI.U.sel = {{ type: 'pt', pid: '{wall}' }}; OCUI.render(); }}"); page.wait_for_timeout(350); J("OCUI.render()"); page.wait_for_timeout(150)
        sbx = box('#selbar'); r19 = box('#mroom-19')
        ok(sbx and sbx['height'] <= 36 and sbx['y'] >= r19['y'] + r19['height'] - 1, f"the bedding bar is one line under the bottom row of rooms (bar top {round(sbx['y'])}, room 19 bottom {round(r19['y'] + r19['height'])})")
        J("() => { OCUI.U.sel = null; OCUI.U.sheet = { type: 'zone', z: 'triage', at: 'door' }; OCUI.render(); }"); page.wait_for_timeout(350)
        chips = J("[...document.querySelectorAll('#sheet .ist')].map(e => e.textContent)")
        ok(len(chips) >= 2 and all(('✓' in c) or c.startswith('NEEDS ') or c.endswith(' NOW') or c.endswith(' IN LINE') for c in chips), f'intake tags say their state in words ({chips[:4]})')
        lb = J("(() => { const a = document.getElementById('mDoorL').getBoundingClientRect(), w = document.getElementById('mWaitL').getBoundingClientRect(), hit = (r, sel) => [...document.querySelectorAll(sel)].some(n => { const b = n.getBoundingClientRect(); return b.width && !(b.right < r.left || b.left > r.right || b.bottom < r.top + 1 || b.top > r.bottom - 1); }); return { door: hit(a, '#mPtsWalk .wk, #mPeople .wk'), wait: hit(w, '#mPtsWalk .wk, #mPeople .wk') }; })()")
        ok(not lb['door'] and not lb['wait'], 'nobody stands on the DOOR or WAITING label')
        close_sheet()

        # patient names: a highlighted tag in every occupied room, at both zoom levels, drawn above the staff
        occ = J("OC.G.rooms.filter(r => r.pid).length")
        ok(occ >= 3 and page.locator('#mNames .mname.faronly').count() == occ and page.locator('#mNames .mname.nearonly').count() == occ, f'every occupied room carries its patient\'s name ({occ})')
        nm = J("(() => { const r = OC.G.rooms.find(r => r.pid && /^\\d+$/.test(r.id)); return [OC.pt(r.pid).name, r.id]; })()")
        ok(any(t.startswith(nm[0][:6]) for t in J("Array.from(document.querySelectorAll('#mNames .mname.faronly text')).map(t => t.textContent)")) and nm[0] in J(f"document.getElementById('mroom-{nm[1]}').getAttribute('aria-label')"), f'the tag reads the patient\'s name ({nm[0]})')
        tb = page.locator('#mNames .mname.faronly text').first.bounding_box()
        ok(tb['height'] >= 6.5 and page.locator('#mNames .mname.faronly').first.is_visible() and not page.locator('#mNames .mname.nearonly').first.is_visible(), f'zoomed out, the name is still readable ({tb["height"]:.1f}px)')
        ok(J("getComputedStyle(document.getElementById('mNames')).pointerEvents") == 'none', 'and it never blocks a tap on the room')

        # a real fingertip slides during a tap: the floor still takes it
        fg = Finger(ctx, page)
        def finger(sel, dx, dy):
            bb = page.locator(sel).first.bounding_box(); x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
            fg.start(x, y); page.wait_for_timeout(30)
            fg.move(x + dx / 2, y + dy / 2); page.wait_for_timeout(25)
            fg.move(x + dx, y + dy); page.wait_for_timeout(40)
            fg.end(); page.wait_for_timeout(350)
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

        # messages ride in the top strip, one at a time: never over a room. The strip stays one line, and the scores keep their labels, even with the Box ringing
        J("() => { OC.G.box.cur = null; OC.G.box.q = []; OC.trainConsult(); OCUI.render(); }"); page.wait_for_timeout(250)
        J("() => { OC.hooks.toast('Dr. Hartwell (Cardiology) is at the bedside in Room 7', 'info'); OC.hooks.toast('Room 12 is clean', 'good'); }"); page.wait_for_timeout(250)
        tb, th = box('#toasts .toast'), J("document.getElementById('top').offsetHeight")
        ok(page.locator('#toasts .toast').count() == 1 and tb and tb['y'] >= 0 and tb['y'] + tb['height'] <= th + 1, f"a message shows inside the top strip, one at a time ({round(tb['y'] + tb['height'])} of {th}px)")
        r1 = box('#mroom-1')
        ok(tb['y'] + tb['height'] <= r1['y'], 'and covers no room')
        page.wait_for_timeout(1700)
        ok('Room 12 is clean' in page.locator('#toasts').inner_text(), 'the next message follows the first')
        lbl = J("(() => { const s = document.querySelector('#pPat span'); return getComputedStyle(s, '::after').content + '|' + getComputedStyle(s).display; })()")
        ok('Pts' in lbl and 'none' not in lbl and th <= 52, f'with the Box ringing, the scores keep their labels and the strip stays one line ({th}px)')
        for (w, h) in [(667, 375)]:
            page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(350)
            th2 = J("document.getElementById('top').offsetHeight"); bx = box('#boxbar .bx-btn')
            ok(th2 <= 52 and bx and bx['x'] + bx['width'] <= w + 1, f'{w}x{h}: the ringing Box stays in the strip ({th2}px) with its button on screen')
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
        J("() => { OC.G.box.cur = null; OC.G.box.q = []; document.getElementById('toasts').innerHTML = ''; OCUI.render(); }")
        # v0.16.3: while a message shows, the scores are five numbers beside it. Routine news skips the strip and waits under the bell.
        page.wait_for_timeout(4200)
        J("() => { OCUI.U.msgNew = 0; OCUI.U.msgs = []; localStorage.setItem('oc-seen-msgs', '1'); document.getElementById('toasts').innerHTML = ''; document.body.classList.remove('msgon'); OCUI.render(); }"); page.wait_for_timeout(200)
        J("() => { OC.hooks.toast('Blood bank: only 2 units of O-negative left', 'bad'); }"); page.wait_for_timeout(350)
        st = J("(() => { const t = document.querySelector('#toasts .toast').getBoundingClientRect(), ps = [...document.querySelectorAll('#top .pill')], last = ps[ps.length - 1].getBoundingClientRect(); return { on: document.body.classList.contains('msgon') && !document.body.classList.contains('msgover'), gap: Math.round(t.left - last.right), lbl: getComputedStyle(document.querySelector('#pPat span')).display, nums: ps.every(p => { const b = p.querySelector('b').getBoundingClientRect(); return b.width > 0 && b.right <= t.left; }), w: Math.round(t.width), top: document.getElementById('top').offsetHeight, train: !!OC.G.train }; })()")
        ok(st['on'] and st['gap'] >= 0 and st['lbl'] == 'none' and st['nums'] and st['w'] >= 240 and st['top'] == th, f"while a message shows, the five scores stay on screen as numbers beside it (message {st['w']}px wide, strip {st['top']}px)")
        page.wait_for_timeout(3700)
        ok(not J("document.body.classList.contains('msgon')") and J("getComputedStyle(document.querySelector('#pPat span')).display") != 'none', 'when the message ends, the scores get their labels back')
        J("() => { OC.hooks.toast('Door to ECG: 3 min. Goal met · Room 4', 'good', true); OC.hooks.toast('Hana is back', 'good', true); OCUI.render(); }"); page.wait_for_timeout(300)
        ok(not st['train'] and page.locator('#toasts .toast').count() == 0 and J('OCUI.U.msgNew') == 2 and page.locator('#msgN').inner_text() == '2' and page.is_visible('#btnMsgs'), 'routine news skips the strip, and the bell counts it')
        tap('#btnMsgs'); page.wait_for_timeout(300)
        ok(J("OCUI.U.sheet && OCUI.U.sheet.type") == 'msgs' and page.locator('#sheet .msgl li.new').count() == 2 and 'Blood bank' in page.locator('#sheet .msgl').inner_text() and page.locator('#sheet .msgl li').first.inner_text().find('Hana is back') >= 0 and J('OCUI.U.msgNew') == 0 and page.locator('#msgN').inner_text() == '', 'the bell opens every message, newest first, with the unread ones marked, and the count clears')
        close_sheet()

        # touch areas: the zoom buttons, and a pod sign that reaches a little past its outline
        zb = box('#mzoom [data-arg="in"]'); sg = box('#mzh-d rect')
        ok(zb['width'] >= 38 and zb['height'] >= 38 and sg['height'] >= 30, f"zoom buttons are {round(zb['width'])}px and a pod sign's touch area is {round(sg['height'])}px tall")

        # zoom in: the words come back, and dragging pans without tapping anything
        tap('#mzoom [data-arg="in"]'); tap('#mzoom [data-arg="in"]'); page.wait_for_timeout(200)
        ok(not J('OCUI.cam().far') and J("getComputedStyle(document.querySelector('#mRooms .nearonly')).display") != 'none', 'zoomed in, rooms show words')
        cut = J("[...document.querySelectorAll('#mRooms g[id^=mroom-]')].filter(g => !/^mroom-(H|C)/.test(g.id)).map(g => [...g.querySelectorAll('.nearonly text')].map(t => t.textContent).join(' / ')).filter(t => /…/.test(t))")
        two = J("[...document.querySelectorAll('#mRooms g[id^=mroom-]')].filter(g => g.querySelectorAll('.nearonly > text').length === 2).length")
        ok(len(cut) == 0, f'room words wrap onto a second line instead of being cut off ({two} rooms on two lines; cut: {cut[:3]})')
        vb0 = J("document.querySelector('#map svg').getAttribute('viewBox')")
        mb = box('#map'); cx, cy = mb['x'] + mb['width'] * 0.55, mb['y'] + mb['height'] * 0.5
        fg = Finger(ctx, page)
        fg.start(cx, cy)
        for i in range(1, 9):
            fg.move(cx - i * 22, cy - i * 4)
            page.wait_for_timeout(16)
        fg.end(); page.wait_for_timeout(300)
        ok(J("document.querySelector('#map svg').getAttribute('viewBox')") != vb0, 'dragging pans the floor')
        ok(not J('OCUI.U.sheet') and not J('OCUI.U.sel'), 'a drag is not a tap')
        page.wait_for_timeout(350)   # let the browser finish the drag gesture before the next tap
        tap('#mzFit'); page.wait_for_timeout(250)
        if not J('OCUI.cam().far'): page.wait_for_timeout(400); tap('#mzFit'); page.wait_for_timeout(250); checks.append('note  the first tap after the drag was swallowed by the browser')
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
        tap('[data-act="mode"][data-arg="md"]'); tap('[data-act="tmenu"][data-arg="play"]'); tap('button.lvl[data-arg="med"]'); page.wait_for_timeout(500)
        ok(J('OC.G.mode') == 'md', 'an attending shift starts on the floor plan')
        ok(J("getComputedStyle(document.getElementById('railL')).display") == 'none', 'the attending has no intake rail')
        tap('#mzh-a')
        ok(not J('OCUI.U.sheet'), 'the attending cannot reassign nurses from a pod sign')
        J("() => { OCUI.U.freeze = true; const r = OC.G.rooms.find(x => !x.pid && x.st === 'clean' && x.kind === 'main'); const p = OC.pt(OC.trainPatient('gib', 'room', { room: r.id, age: 60, name: 'Gina B.' })); window.__g = p.id; OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); }"); page.wait_for_timeout(300)
        txt = page.locator('#sheet').inner_text()
        ok('Written after the exam' in txt and 'IV fluids' not in txt and 'transfusion' not in txt.lower() and 'Labs' not in txt, "before the exam, the attending's card does not list the plan")
        J("() => { const r = OC.G.rooms.find(x => !x.pid && x.st === 'clean' && x.kind === 'resus'); const p = OC.pt(OC.trainPatient('stroke', 'room', { room: r.id, age: 70, name: 'Stan K.', bpOver: true })); p.alertOn = true; p.dxK = true; OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); }"); page.wait_for_timeout(300)
        txt = page.locator('#sheet').inner_text()
        ok('Last known well' in txt and 'has to be in by' in txt, 'a stroke card shows last known well and when the window closes')
        J("() => { const p = OC.pt(OC.trainPatient('mciyel', 'ems', { age: 40, name: 'Yara T.' })); OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); }"); page.wait_for_timeout(300)
        ok(page.locator('#sheet .mtag.mt-yellow').count() == 1 and 'field tag' in page.locator('#sheet').inner_text().lower(), 'a bus-crash patient carries the field tag')
        J("() => { OCUI.U.sheet = null; OCUI.U.freeze = false; OCUI.render(); }")
        page.screenshot(path=f'{OUT}/map_phone_md.png')

        # the Words search takes typing one letter at a time and keeps the keyboard
        J("() => { OCUI.U.wq = ''; OCUI.U.sheet = { type: 'words' }; OCUI.render(); }"); page.wait_for_timeout(350)
        if page.locator('#wq').count():
            page.locator('#wq').tap(); page.wait_for_timeout(150); page.keyboard.type('tropo', delay=260); page.wait_for_timeout(400)
            shown = J("[...document.querySelectorAll('#sheet .gl dl > div')].filter(d => d.getClientRects().length).length")
            ok(J("document.querySelector('#wq').value") == 'tropo' and J("document.activeElement && document.activeElement.id") == 'wq' and 0 < shown < 10, f'typing in the Words search keeps the box in focus and narrows the list ({shown} shown)')
        else: ok(False, 'the Words sheet has a search box')
        J("() => { OCUI.U.sheet = null; OCUI.render(); }"); page.wait_for_timeout(200)
        # a laptop: a dock along the bottom, and words on the rooms
        page.set_viewport_size({'width': 1366, 'height': 800}); page.wait_for_timeout(400)
        ok(not J("document.body.classList.contains('rails')") and not J('OCUI.cam().far'), 'a laptop keeps the dock and shows words')

        # class tools: the five-minute shift with a scenario, and a report to print
        J("() => { OCUI.U.paused = false; OCUI.showTitle(); }"); page.wait_for_timeout(300)
        ok(page.locator('#title [data-act="tmenu"]:not([data-arg="about"])').count() == 3 and page.locator('#title button.lvl[data-arg="med"]').count() == 0, 'the menu has three parts: Play a shift, Learn, Settings')
        tap('[data-act="tmenu"][data-arg="play"]')
        ok(page.locator('[data-act="scenario"]').count() == 5 and page.is_visible('[data-act="scenario"][data-arg="mci"]') and not page.is_visible('.scn-sel'), 'on a laptop the scenarios are buttons')
        tap('[data-act="scenario"][data-arg="mci"]')
        ok(J('OCUI.U.scen') == 'mci' and J("document.querySelector('[data-act=\"scenario\"][data-arg=\"mci\"]').classList.contains('on')"), 'and a tap picks one')
        page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
        tap('.t-back'); tap('[data-act="mode"][data-arg="rn"]'); tap('[data-act="tmenu"][data-arg="play"]')
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
