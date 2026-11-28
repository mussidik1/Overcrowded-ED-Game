"""The private testing gate (v0.21.1): on edcodeblack.com the game asks for a password first.
The site is served from this folder under the edcodeblack.com name, and the database's two answers are stubbed."""
import os, sys, json, mimetypes
from playwright.sync_api import sync_playwright
from _browser import launch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

state = {'on': True, 'calls': []}
def site(route):
    path = route.request.url.split('edcodeblack.com/', 1)[1].split('?')[0] or 'index.html'
    f = os.path.join(ROOT, path)
    if path == 'sw.js' or not os.path.isfile(f): route.fulfill(status=404, body=''); return
    route.fulfill(status=200, body=open(f, 'rb').read(), content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
def rpc(route):
    name = route.request.url.rsplit('/', 1)[1]; body = json.loads(route.request.post_data or '{}'); state['calls'].append(name)
    ans = state['on'] if name == 'cb_gate_on' else ((not state['on']) or body.get('p') == 'right-pass')
    route.fulfill(status=200, content_type='application/json', body=json.dumps(ans))

with sync_playwright() as pw:
    b = launch(pw)
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, service_workers='block')
    ctx.add_init_script("try { localStorage.setItem('oc-3d', '0'); } catch (e) {}")
    ctx.route('https://edcodeblack.com/**', site); ctx.route('**/rest/v1/rpc/cb_gate_*', rpc)
    page = ctx.new_page(); J = page.evaluate
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto('https://edcodeblack.com/'); page.wait_for_timeout(900)
    ok(page.is_visible('#gate') and not page.is_visible('#title .t-brand >> nth=0') or (page.is_visible('#gate') and J("getComputedStyle(document.getElementById('title')).visibility") == 'hidden'), 'edcodeblack.com opens on the password screen, with the game hidden')
    ok('private testing' in page.inner_text('#gate'), 'it says the game is in private testing')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'gate.png'))
    for w, h in [(320, 640), (360, 740), (390, 844)]:   # QA-1: the card, its title and Play fit an upright phone
        page.set_viewport_size({'width': w, 'height': h}); page.wait_for_timeout(200)
        fit = J("(() => { const W = innerWidth, r = e => document.querySelector(e).getBoundingClientRect(), c = r('#gate .gate-card'), b = r('#gate button[type=\"submit\"]'), t = r('#gate .t-brand'); return c.left >= 0 && c.right <= W && b.right <= W && b.left >= 0 && t.right <= W && b.height >= 44; })()")
        ok(fit, f'{w}x{h}: the gate card, its title and Play fit the screen, and Play is 44 px tall')
    page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(200)
    page.fill('#gateP', 'nope'); page.click('#gate button[type="submit"]'); page.wait_for_timeout(500)
    ok(page.is_visible('#gate') and 'isn’t right' in page.inner_text('#gate'), 'a wrong password is refused')
    page.fill('#gateP', 'right-pass'); page.click('#gate button[type="submit"]'); page.wait_for_timeout(900)
    ok(not page.locator('#gate').count() and page.is_visible('#title') and J("getComputedStyle(document.getElementById('title')).visibility") == 'visible', 'the right password opens the game')
    page.reload(); page.wait_for_timeout(900)
    ok(not page.locator('#gate').count() and page.is_visible('#title'), 'this device remembers it')
    state['on'] = False; J("localStorage.removeItem('oc-gate')"); page.reload(); page.wait_for_timeout(900)
    ok(not page.locator('#gate').count() and page.is_visible('#title'), 'with the gate switched off in the database, anyone goes straight in')
    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
