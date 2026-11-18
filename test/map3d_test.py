"""The 3D floor (v0.18): served over http (it loads its models with fetch), a real shift at phone size.
It checks the floor loads, mirrors the game, and that taps in 3D do what taps on the flat map do."""
import os, sys, threading, http.server, functools, socket, time
from playwright.sync_api import sync_playwright
from _browser import launch

ROOT = os.environ.get('ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT); h = type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None}); h = functools.partial(h, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{port}/'

def run():
    os.makedirs(OUT, exist_ok=True); srv, url = serve()
    W, H = int(os.environ.get('VW', 844)), int(os.environ.get('VH', 390))
    with sync_playwright() as pw:
        b = launch(pw) if os.environ.get('BROWSER') else pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=float(os.environ.get('DPR', 1)), is_mobile=True, has_touch=True)
        ctx.add_init_script("try { localStorage.setItem('oc-seen-first', '1'); } catch (e) {}")
        page = ctx.new_page(); page.set_default_timeout(120000)
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' and 'GL Driver' not in m.text and 'favicon' not in m.text else None)
        J = page.evaluate
        page.goto(url + 'index.html'); page.wait_for_timeout(800)
        ok(page.locator('[data-act="three"]').count() == 1 and 'Floor: 3D' in page.locator('[data-act="three"]').inner_text(), 'the menu offers the 3D floor, on by default')
        page.locator('[data-act="mode"][data-arg="rn"]').first.click(); page.locator('button.lvl[data-arg="med"]').first.click()
        t0 = time.time()
        try: page.wait_for_function("() => document.getElementById('map').classList.contains('three')", timeout=240000)
        except Exception: pass
        ok(J("document.getElementById('map').classList.contains('three')"), f'the 3D floor loads ({time.time() - t0:.0f} s here, software graphics)')
        ok(J("!!document.querySelector('#map > canvas.floor3d')") and J("getComputedStyle(document.querySelector('#map svg.floor')).opacity") == '0', 'the canvas shows and the flat map steps aside')
        ok('pulsing icon' in page.locator('#modal').inner_text(), 'the first-shift card describes the 3D floor')
        def clear():   # the first-shift card and event cards pause the shift: answer them
            for _ in range(4):
                if not page.is_visible('#modalWrap'): return
                J("(document.querySelector('#modal [data-act=\"modalOk\"]') || document.querySelector('#modal [data-act=\"card\"]:not([disabled])') || {click(){}}).click()"); page.wait_for_timeout(300)
        for _ in range(8): clear(); page.wait_for_timeout(2500)
        page.wait_for_timeout(4000)
        page.screenshot(path=os.path.join(OUT, 'map3d-shift.png'))
        n = J("(() => { const v = OC3D._view; return { staff: OC.G.staff.filter(s => s.st === 'on').length, rooms: OC.G.rooms.filter(r => r.pid).length }; })()")
        ok(n['staff'] > 10, f"staff on shift: {n['staff']}")
        # a tap on an occupied room opens its patient, the same as on the flat map
        rid = J("(OC.G.rooms.find(r => r.pid && /^\\d+$/.test(r.id)) || {}).id")
        if rid:
            at = J(f"OC3D.screenOf('room', '{rid}')")
            for _try in range(3):   # an event card can pop up between aiming and tapping: clear it and try again
                clear(); at = J(f"OC3D.screenOf('room', '{rid}')"); hit = J(f"JSON.stringify(OC3D.find({at['x']}, {at['y']}))")
                page.touchscreen.tap(at['x'], at['y']); page.wait_for_timeout(1200)
                if J("!!OCUI.U.sheet"): break
                print('room tap retry', hit, J("JSON.stringify({sel: OCUI.U.sel, modal: !!document.querySelector('#modalWrap:not([hidden])'), top: document.elementFromPoint(%f, %f) && document.elementFromPoint(%f, %f).tagName})" % (at['x'], at['y'], at['x'], at['y'])))
            ok(J("!!OCUI.U.sheet"), f'tapping room {rid} in 3D opens its card ({J("OCUI.U.sheet && OCUI.U.sheet.type")})')
            page.screenshot(path=os.path.join(OUT, 'map3d-card.png'))
            J("document.querySelector('.sheet-x') && document.querySelector('.sheet-x').click()"); page.wait_for_timeout(600)
            # a nurse at a pod lane (not inside a room) can be tapped like on the flat map
            sid = J("(OC.G.staff.find(s => s.role === 'rn' && s.st === 'on' && !s.task && !s.zones.includes('triage')) || {}).id")
            if sid:
                for _try in range(3):   # people walk, and a card can pop up: aim again each try
                    clear(); at = J(f"OC3D.screenOf('staff', '{sid}')")
                    if not at: break
                    page.touchscreen.tap(at['x'], at['y'] - 6); page.wait_for_timeout(1200)
                    if J("!!OCUI.U.sheet || !!OCUI.U.sel"): break
                if at: ok(J("!!OCUI.U.sheet || !!OCUI.U.sel"), f'tapping nurse {sid} in 3D opens or selects them ({J("JSON.stringify(OCUI.U.sheet && OCUI.U.sheet.type)")})')
                J("document.querySelector('.sheet-x') && document.querySelector('.sheet-x').click()"); page.wait_for_timeout(500)
            J("document.querySelector('[data-act=\"legend\"], [data-act=\"mapKey\"]') && 0")
        else: ok(False, 'an occupied room to tap')
        # zoom: the + button zooms the 3D camera, the fit button brings the whole floor back
        clear(); page.locator('#mzIn, [data-act="mzoom"][data-arg="in"], button[aria-label*="Zoom in"]').first.click(); page.wait_for_timeout(500)
        ok(J("OC3D.zoomed()"), 'the zoom button zooms the 3D floor')
        page.screenshot(path=os.path.join(OUT, 'map3d-zoom.png'))
        J("mapZoom(0)") if J("typeof mapZoom === 'function'") else None
        # turning it off brings the flat map back
        J("OC && 0"); page.locator('#btnPause, [data-act="pause"]').first.click(); page.wait_for_timeout(500)
        if page.locator('[data-act="three"]').count():
            page.locator('[data-act="three"]').first.click(); page.wait_for_timeout(1500)
            ok(not J("document.getElementById('map').classList.contains('three')"), 'turning the 3D floor off shows the flat map')
        b.close()
    srv.shutdown()

run()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
