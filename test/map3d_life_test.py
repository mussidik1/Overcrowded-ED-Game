"""Phase 4 (R5-06, R1-16, R3-05): the 3D floor's loop stops when 3D is switched off and starts again when it's back on; a lost WebGL
context falls back to the flat map with a message instead of a blank floor. Served over http, like map3d_test.py, but short."""
import os, sys, threading, http.server, functools, socket
from playwright.sync_api import sync_playwright
from _browser import launch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)
def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    h = type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None}); h = functools.partial(h, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}/'

srv, url = serve()
with sync_playwright() as pw:
    b = launch(pw)
    page = b.new_page(viewport={'width': 844, 'height': 390}); J = page.evaluate
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.goto(url); page.wait_for_timeout(800)
    J("window.OCUI.start('easy')"); page.wait_for_timeout(500)
    J("(() => { const U = window.OCUI.U; U.modal = null; U.paused = false; U.view = 'map'; U.three = true; })()")
    for _ in range(480):
        if J("!!(window.OC3D && window.OC3D.ready())"): break
        page.wait_for_timeout(500)
    ok(J("!!(window.OC3D && window.OC3D.ready())"), 'the 3D floor loads')
    ok(J("OC3D._running()"), 'the 3D loop runs while the floor shows')
    J("(() => { window.OCUI.U.three = false; })()"); page.wait_for_timeout(1500)
    ok(not J("OC3D._running()"), 'switching 3D off stops its loop')
    J("(() => { window.OCUI.U.three = true; })()"); page.wait_for_timeout(1500)
    ok(J("OC3D._running()"), 'switching it back on starts the loop again')
    lost = J("OC3D._loseContext()"); page.wait_for_timeout(1500)
    if lost:
        ok(not J("document.getElementById('map').classList.contains('three')"), 'a lost WebGL context falls back to the flat map')
        ok('3D floor stopped' in page.inner_text('body'), 'and says so')
        ok(not J("OC3D._running()"), 'and the 3D loop stops')
    else: checks.append('skip this browser has no WEBGL_lose_context')
    b.close()
srv.shutdown()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
