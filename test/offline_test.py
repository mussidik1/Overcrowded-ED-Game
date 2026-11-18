"""Offline (v0.10): served over http, the game installs a service worker and then loads with the network off."""
import os, sys, subprocess, time, socket
from playwright.sync_api import sync_playwright
from _browser import launch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
errors, checks = [], []


def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)


def run():
    with socket.socket() as s: s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):   # wait until the server answers (a cold Python start can take a few seconds)
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=0.3): break
            except OSError: time.sleep(0.2)
        url = f'http://127.0.0.1:{port}/'
        with sync_playwright() as pw:
            b = launch(pw)
            ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
            # other apps share this site's storage; an old copy of this game does too
            page.goto(url + 'no-such-page', wait_until='domcontentloaded')   # any page on this site will do, even its 'not found' page: the game itself must not load before the old caches are planted
            page.evaluate("() => Promise.all([caches.open('another-app-v1').then(c => c.put('/another-app/index.html', new Response('theirs'))), caches.open('overcrowded-0.0.0-old').then(c => c.put('index.html', new Response('stale')))])")
            read_theirs = "() => caches.open('another-app-v1').then(c => c.match('/another-app/index.html')).then(r => r ? r.text() : null)"
            planted = page.evaluate(read_theirs) == 'theirs'
            # Does the entry outlive a plain page change, with the game and its service worker never loaded? If not, the engine dropped it, not the game.
            page.goto(url + 'still-no-such-page', wait_until='domcontentloaded')
            kept = page.evaluate(read_theirs) == 'theirs'
            page.goto(url); page.wait_for_timeout(600)
            ok(page.locator('link[rel="manifest"]').count() == 1 and page.locator('link[rel="apple-touch-icon"]').count() == 1, 'on the web, the page links its manifest and home-screen icon')
            ready = page.evaluate("() => Promise.race([navigator.serviceWorker.ready.then(r => !!r.active), new Promise(r => setTimeout(() => r(false), 8000))])")
            ok(ready, 'the service worker installs')
            page.wait_for_timeout(800)
            keys = page.evaluate("() => caches.keys()")
            mine = [k for k in keys if k.startswith('overcrowded-')]
            ok(len(mine) == 1 and 'overcrowded-0.0.0-old' not in keys, 'an old copy of the game is cleared')
            theirs = page.evaluate("() => caches.open('another-app-v1').then(c => Promise.all([c.match('/another-app/index.html').then(r => r ? r.text() : null), c.keys().then(a => a.map(q => q.url))]))")
            ok('another-app-v1' in keys and (theirs[0] == 'theirs' or not kept), f"another app's saved files on the same site are left alone (caches: {keys}; its file reads {theirs[0]!r}; its entries: {theirs[1]}; planted: {planted}; still there after a page change, before the game loaded: {kept})")
            if not kept: print('note: this engine dropped the planted entry on a plain page change, before the game or its service worker loaded; only the cache name could be checked')
            n = page.evaluate("(k) => caches.open(k).then(c => c.keys()).then(a => a.length)", mine[0] if mine else '')
            ok(n >= 5, f'it keeps a copy of the game ({n} files)')
            ctx.set_offline(True)
            page.reload(); page.wait_for_timeout(900)
            ok(page.locator('#title .t-brand').count() == 1 and 'Overcrowded' in page.locator('#title .t-brand').inner_text(), 'with the network off, the game still loads')
            page.locator('[data-act="tmenu"][data-arg="play"]').tap(); page.wait_for_timeout(300); page.locator('button.lvl[data-arg="rush"]').tap(); page.wait_for_timeout(600)
            ok(page.evaluate("OC.G.level") == 'rush' and page.evaluate("document.querySelectorAll('#mRooms [data-act=\"room\"]').length") >= 38, 'and a shift starts offline')
            b.close()
    finally:
        srv.terminate()


try:
    run()
except Exception as e:
    errors.append('crash: ' + repr(e))
print('\n'.join(checks))
print('ERRORS:' if errors else 'No errors.')
for e in errors[:20]: print(' ', e)
sys.exit(1 if errors else 0)
