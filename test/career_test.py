"""Phase 6: the career rank. The menu shows the rank for the chosen role; a finished shift adds its stars (two points each, one in the
Rush) once; Orientation doesn't count; the attending has its own rank."""
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
    page = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page(); J = page.evaluate
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(URL); page.wait_for_timeout(600)
    ok('Rank: New grad' in page.inner_text('#title') and '6 points to Staff nurse' in page.inner_text('#title'), 'a new player is a New grad, 6 points from Staff nurse')
    J("localStorage.setItem('oc-career', JSON.stringify({ v: 1, rn: { pts: 31, n: 9 }, md: { pts: 0, n: 0 }, last: 0 }))"); page.reload(); page.wait_for_timeout(500)
    ok('Rank: Relief charge' in page.inner_text('#title'), 'the rank follows the points')
    page.locator('#title [data-act="mode"][data-arg="md"]').tap(); page.wait_for_timeout(300)
    ok('Rank: Intern' in page.inner_text('#title'), 'the attending has a rank of its own')
    page.locator('#title [data-act="mode"][data-arg="rn"]').tap(); page.wait_for_timeout(300)
    # finish a Rush shift
    J("window.OCUI.start('rush')"); page.wait_for_timeout(500)
    J("(() => { const U = window.OCUI.U; U.modal = null; U.paused = false; U.view = 'list'; window.OC.G.card = null; window.OC.G.t = window.OC.G.shift - 0.2; })()")
    for _ in range(40):
        if J("window.OCUI.U.scene") == 'report': break
        J("(() => { window.OC.G.card = null; window.OCUI.U.modal = null; })()"); page.wait_for_timeout(250)
    ok(J("window.OCUI.U.scene") == 'report', 'the Rush ends on its report')
    stars = J("window.OC.G.report.stars"); c = json.loads(J("localStorage.getItem('oc-career')"))
    ok(c['rn']['pts'] == 31 + stars and c['rn']['n'] == 10, f'the Rush adds its stars as points once ({stars} stars, now {c["rn"]["pts"]})')
    ok('rank point' in page.inner_text('#report') and 'Rank:' in page.inner_text('#report'), 'the report says what the shift added to the rank')
    J("(() => { window.OCUI.showTitle(); })()"); page.wait_for_timeout(300)
    c2 = json.loads(J("localStorage.getItem('oc-career')"))
    ok(c2['rn']['pts'] == c['rn']['pts'], 'going back to the menu doesn\'t count the shift again')
    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
