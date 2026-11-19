"""Arrivals, nudges and ambulances (v0.23), on the flat floor at phone size.
A new patient pops up at the bottom left and goes on the Events list; icons that need you shake;
an ambulance drives up the lane, pulls past its stall, and backs in; one leaving drives off."""
import os, sys
from playwright.sync_api import sync_playwright
from _browser import launch

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

AMB_ANIMS = "document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('mamb'))"

with sync_playwright() as pw:
    b = launch(pw)
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("try { localStorage.setItem('oc-seen-first', '1'); localStorage.setItem('oc-3d', '0'); } catch (e) {}")
    page = ctx.new_page(); J = page.evaluate
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(URL); page.wait_for_timeout(700)
    page.locator('[data-act="mode"][data-arg="rn"]').tap(); page.locator('[data-act="tmenu"][data-arg="play"]').tap(); page.locator('button.lvl[data-arg="med"]').tap(); page.wait_for_timeout(800)
    def clear():
        for _ in range(5):
            J("(document.querySelector('#modal [data-act=\"modalOk\"]') || document.querySelector('#modal [data-act=\"card\"]:not([disabled])') || {click(){}}).click()"); page.wait_for_timeout(250)
    clear(); page.wait_for_timeout(3000); clear()

    # a walk-in and an ambulance
    J("OC.trainPatient('uti', 'walk', { name: 'Maria L.', age: 34, sex: 'F' }); OCUI.render()"); page.wait_for_timeout(150)
    J("OC.trainPatient('hipfx', 'ems', { name: 'Walter K.', age: 82, sex: 'M', unit: 'Medic 7' }); OCUI.render()"); page.wait_for_timeout(250)
    pops = page.locator('#arrivals .arr')
    ok(pops.count() == 2 and 'Maria L.' in pops.nth(0).inner_text() and 'Walked in' in pops.nth(0).inner_text() and 'Medic 7 at the bay' in pops.nth(1).inner_text(), 'each new patient pops up: name, age, complaint, and how they came')
    m, r = J("(() => { const a = document.getElementById('map').getBoundingClientRect(), b = document.getElementById('arrivals').getBoundingClientRect(); return [[a.left, a.bottom], [b.left, b.bottom]]; })()")
    ok(abs(r[0] - m[0] - 8) < 2 and abs(m[1] - r[1] - 8) < 2, 'at the bottom left of the floor, by the door and the bay')
    ok(J("getComputedStyle(document.getElementById('arrivals')).pointerEvents") == 'none', 'and taps go straight through it')
    page.screenshot(path=os.path.join(OUT, 'events-pop.png'))

    # the ambulance drives in: a keyframed move that ends parked in a stall, facing left (back doors to the building)
    an = J(f"{AMB_ANIMS}.length")
    ok(an >= 1, 'the ambulance drives in (an animation, not a jump)')
    rots = J(f"{AMB_ANIMS}.map(a => a.effect.getKeyframes().map(k => k.transform))")
    ok(any(any('rotate(90deg)' in t for t in ks) and ks[-1].endswith('rotate(0deg)') for ks in rots), f'it drives up facing the way it goes, then turns to park ({rots[:1]})')
    ok(any(len(ks) >= 3 for ks in rots), 'and pulls past its stall before backing in')
    walter = J("Object.values(OC.G.pts).find(p => p.name === 'Walter K.').id")
    WALL_PT = f"!!document.querySelector('.mpt[data-act=\"pt\"][data-arg=\"{walter}\"]')"
    ok(not J(WALL_PT), 'the crew and patient stay out of sight while the ambulance pulls in')
    J(f"{AMB_ANIMS}.forEach(a => a.finish())"); page.wait_for_timeout(500); J("OCUI.render()"); page.wait_for_timeout(100)
    ok(J(WALL_PT), 'and show on the wall once it has parked')
    tr = J(f"document.querySelector('#mAmbs [data-id=\"a-{walter}\"]').style.transform")
    ok('rotate(0deg)' in tr and 'translate(56px' in tr, f'parked in a stall ({tr})')

    # a stall is kept: when the ambulance ahead leaves, this one stays put
    J("OC.trainPatient('stemi', 'ems', { name: 'Ed B.', age: 60, sex: 'M', unit: 'Medic 9' }); OCUI.render()"); page.wait_for_timeout(150)
    J(f"{AMB_ANIMS}.forEach(a => a.finish())")
    ed = J("(Object.values(OC.G.pts).find(p => p.name === 'Ed B.') || {}).id")
    if ed:
        tEd = J(f"document.querySelector('#mAmbs [data-id=\"a-{ed}\"]').style.transform")
        J(f"OC.G.pts[{walter!r}].loc = 'gone'; OCUI.render()"); page.wait_for_timeout(150)
        ok(J(f"document.querySelector('#mAmbs [data-id=\"a-{ed}\"]').style.transform") == tEd, 'a parked ambulance keeps its stall when the one ahead leaves')
        ok(J(f"{AMB_ANIMS}.some(a => a.effect.target.getAttribute('data-id') === '')"), 'and the one that left drives off')
    else: ok(False, 'a second ambulance arrives')

    # the Events list: arrivals are on it
    page.wait_for_timeout(4500)
    ok(J("!Array.from(document.querySelectorAll('#arrivals .arr')).some(e => /Maria L\\.|Walter K\\./.test(e.textContent))"), 'the pop-ups go after a few seconds')
    page.locator('#btnMsgs').tap(); page.wait_for_timeout(300)
    t = page.inner_text('#sheet')
    ok('Events' in t and 'New patient: Maria L.' in t and 'New patient: Walter K.' in t, 'the bell opens Events, and the arrivals are listed there')
    page.locator('#btnMsgs').tap(); page.wait_for_timeout(200)

    # icons that need you shake
    J("(() => { const r = OC.G.rooms.find(r => !r.pid && !r.closed && r.st === 'clean'); r.st = 'dirty'; OC.G.evsQ = OC.G.evsQ.filter(x => x !== r.id); OCUI.render(); })()"); page.wait_for_timeout(200)   # a dirty room nobody has been sent to: yours to act on
    fl = J("Array.from(document.querySelectorAll('#mRooms .mico.fl .iw')).map(g => getComputedStyle(g).animationName)")
    ok(len(fl) >= 1 and all(n == 'icoShake' for n in fl), f'an icon that needs you shakes every couple of seconds ({len(fl)} now)')
    ok(J("Array.from(document.querySelectorAll('#mRooms .mico:not(.fl) .iw')).every(g => getComputedStyle(g).animationName === 'none')"), 'and the others keep still')
    b.close()

print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
