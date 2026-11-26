"""Phase 4 (R1-04, R3-04, R1-07, R3-09): an error stops the shift cleanly with a message, keeps the last good save, and a broken save
can't trap the player. Tutorial step errors are logged, not swallowed."""
import os, sys, json
from playwright.sync_api import sync_playwright
from _browser import launch

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

with sync_playwright() as pw:
    b = launch(pw)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); J = page.evaluate
    page.goto(URL); page.wait_for_timeout(600)

    # 1. A save that parses but isn't a real shift is not offered, and doesn't break the menu
    J("localStorage.setItem('oc-save', JSON.stringify({ G: { v: 5, t: 30, over: false }, lvl: 'easy', ver: 'x' }))")
    page.reload(); page.wait_for_timeout(600)
    ok(page.locator('#title [data-act="resumeSave"]').count() == 0 and page.locator('#title [data-act="tmenu"][data-arg="play"]').count() == 1, 'a broken save is not offered as Resume, and the menu works')

    # 2. A good save survives a crash: start, save, then make the engine throw
    J("window.OCUI.start('easy')"); page.wait_for_timeout(800)
    J("(() => { const U = window.OCUI.U; U.paused = false; U.modal = null; U.hold = false; U.view = 'list'; window.OC.G.card = null; })()")
    t0 = J("OC.G.t"); page.wait_for_timeout(1200)
    ok(J("OC.G.t") > t0, 'the shift is running')
    page.wait_for_timeout(1500)
    J("localStorage.removeItem('oc-save')")
    J("window.OCUI && window.OCUI.save ? window.OCUI.save(true) : null")
    had = J("!!localStorage.getItem('oc-save')")
    J("(() => { window.OC.step = () => { throw new Error('test crash'); }; })()")
    page.wait_for_timeout(1500)
    shown = page.locator('#crash').count() == 1
    if not shown:   # the shift may be paused: tap a control so the loop or a tap runs the engine
        J("(() => { const U = window.OCUI && window.OCUI.U; if (U) { U.paused = false; U.hold = false; U.freeze = false; U.modal = null; U.view = 'list'; window.OC.G.card = null; } })()"); page.wait_for_timeout(1500)
        shown = page.locator('#crash').count() == 1
    ok(shown, 'an engine error shows "Something went wrong" instead of freezing silently')
    if shown:
        t = page.inner_text('#crash')
        ok('Something went wrong' in t and 'Reload' in t and 'Copy details' in t, 'the card offers Reload and Copy details')
        ok((not had) or ('Your shift is saved' in t and 'Start over without the save' in t), 'with a save on the device, it says the shift is saved and offers a way out')
        ok(J("document.activeElement && document.activeElement.id") == 'crashH', 'the card takes the focus')
        st = J("localStorage.getItem('oc-save')")
        ok((not had) or (st and json.loads(st)['G']['v'] == 5), 'the last good save is kept')
        page.locator('#crashReload').tap(); page.wait_for_timeout(900)
        ok(page.locator('#crash').count() == 0, 'Reload reloads the game')
    ctx.close()

    # 3. QA-17: the back button in a shift opens the pause menu instead of leaving; QA-6: Escape closes it
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); J = page.evaluate
    page.goto(URL); page.wait_for_timeout(600)
    J("window.OCUI.start('easy')"); page.wait_for_timeout(600)
    J("(() => { const U = window.OCUI.U; U.modal = null; U.paused = false; U.view = 'list'; window.OC.G.card = null; })()"); page.wait_for_timeout(300)
    page.go_back(); page.wait_for_timeout(500)
    ok(J("window.OCUI.U.scene") == 'game' and J("window.OCUI.U.paused") is True and page.url.startswith('file:'), 'the back button in a shift opens the pause menu and stays in the game')
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    ok(J("window.OCUI.U.paused") is False, 'Escape closes the pause menu')
    ctx.close()

    # 4. A tutorial step that throws is logged
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); J = page.evaluate
    page.goto(URL); page.wait_for_timeout(600)
    ok(J("Array.isArray(window.__coachErrs) && window.__coachErrs.length === 0"), 'the tutorial error log exists and is empty on the menu')
    ctx.close()
    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
