"""Audit screenshots: every main screen and flow at phone, phone landscape, tablet and desktop sizes.
Serves the repo over http (so the 3D floor loads), drives the game with taps and the OC/OCUI test hooks, and writes PNGs to
docs/audit/screenshots/<size>-<nn>-<name>.png. Run: python3 test/audit_shots.py  (CHROME_PATH optional)."""
import os, sys, threading, http.server, functools, socket, json
from playwright.sync_api import sync_playwright
from _browser import launch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'docs', 'audit', 'screenshots'); os.makedirs(OUT, exist_ok=True)
SIZES = {'phone': (390, 844), 'phone-land': (844, 390), 'tablet': (820, 1180), 'desktop': (1440, 900)}
log = []

def serve():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    h = type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *a: None})
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(h, directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{port}/'

def run(pw, url, size, wh):
    b = launch(pw)
    ctx = b.new_context(viewport={'width': wh[0], 'height': wh[1]}, has_touch=True, is_mobile=size.startswith('phone'), device_scale_factor=1)
    ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => false })")   # the game skips the first-visit About page for automated browsers; look like a person
    page = ctx.new_page(); page.set_default_timeout(20000)
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text[:200]) if m.type == 'error' and 'GL Driver' not in m.text else None)
    n = [0]
    def shot(name):
        n[0] += 1
        p = os.path.join(OUT, f'{size}-{n[0]:02d}-{name}.png')
        try: page.screenshot(path=p); log.append(p)
        except Exception as e: log.append(f'FAILED {p}: {e}')
    def J(js):
        try: return page.evaluate(js)
        except Exception as e: log.append(f'{size} js error: {e}'); return None
    def act(a, arg=None):   # fire a delegated action like a tap would
        sel = f'[data-act="{a}"]' + (f'[data-arg="{arg}"]' if arg is not None else '')
        el = page.locator(sel).first
        try:
            if el.count() and el.is_visible(): el.click(); page.wait_for_timeout(350); return True
        except Exception: pass
        return False
    def wait(ms): page.wait_for_timeout(ms)
    def intro(name):   # the first-shift card: photograph it, then press Start the shift
        b = page.locator('#modal button:has-text("Start the shift")')
        if b.count() and b.first.is_visible(): shot(name); b.first.click(); wait(500)
        elif b.count(): J("(() => { const b = [...document.querySelectorAll('#modal button')].find(x => /Start the shift/.test(x.textContent)); if (b) b.click(); })()"); wait(500)
    def portrait_list():   # a phone held upright gets a "turn sideways" screen; photograph it once, then take the list board
        if size == 'phone' and page.locator('#rotate [data-act="view"]').count() and page.locator('#rotate [data-act="view"]').first.is_visible():
            shot('portrait-turn-sideways-prompt'); page.locator('#rotate [data-act="view"]').first.click(); wait(500)
    def step(mins):   # advance the shift fast, with the autopilot playing the other roles
        J(f"(() => {{ for (let i = 0; i < {int(mins * 10)}; i++) {{ if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); OC.step(0.1); if (OC.G.over) break; }} OCUI.render(); }})()")

    # ---- first visit: the About page shows before the menu
    page.goto(url); wait(2500); shot('first-visit-about')
    J("localStorage.setItem('oc-seen-about', '1')"); page.goto(url); wait(2500)
    shot('title-main-menu')
    act('tmenu', 'play'); shot('menu-play-a-shift')
    act('classCode'); shot('class-code-sheet')
    J("(() => { const i = document.querySelector('#ccIn'); if (i) { i.value = 'ABC-DEX'; i.dispatchEvent(new Event('input', { bubbles: true })); } })()"); wait(200); shot('class-code-bad-code-error')
    act('codeMake', 'med'); shot('class-code-made')
    J("(() => { const i = document.querySelector('#cbCode'); if (i) i.value = document.querySelector('.cc-code') ? document.querySelector('.cc-code').textContent : 'ABC-DEF'; })()")
    page.route('**/rest/v1/rpc/cb_class', lambda r: r.fulfill(status=200, content_type='application/json', body='[]'))
    act('cbShow'); wait(500); shot('class-results-empty')
    def menu(tab):   # back to the main menu, then open a tab with a real tap (showTitle() would reset the tab)
        J("OCUI.U.sheet = null; OCUI.U.modal = null; OCUI.render()"); act('tmenu', 'main'); act('tmenu', tab); wait(300)
    menu('learn'); shot('menu-learn')
    act('lessons'); shot('lessons-list')
    menu('learn'); act('help'); wait(300); shot('how-to-play')
    menu('learn'); act('words'); wait(300); shot('words-glossary')
    menu('set'); shot('menu-settings')
    menu('main')

    # ---- charge nurse shift (Manic Monday)
    J("OCUI.start('med')"); wait(3500); portrait_list(); intro('rn-first-shift-intro'); shot('rn-shift-start')
    step(30); wait(1500); shot('rn-30-min-in')
    J("(() => { const p = OC.inRooms()[0]; if (p) { OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); } })()"); wait(700); shot('rn-patient-card')
    J("OCUI.U.sheet = null; OCUI.render()"); act('needNext'); wait(500); shot('rn-needs-you-next')
    J("OCUI.U.sheet = null; OCUI.U.sel = null; OCUI.render()"); act('team'); wait(400); shot('rn-team-sheet')
    J("OCUI.U.sheet = null; OCUI.render()"); act('yellow'); wait(400); shot('rn-divert-status')
    J("OCUI.U.modal = null; OCUI.U.sheet = null; OCUI.render()"); step(150); wait(1500); shot('rn-busy-midday')
    J("(() => { OCUI.U.view = 'list'; OCUI.U.layKey = null; OCUI.render(); })()"); wait(800); shot('rn-list-board')
    if size != 'phone': J("(() => { OCUI.U.view = 'map'; OCUI.U.layKey = null; OCUI.render(); })()"); wait(500)
    act('pause'); wait(300); shot('rn-pause-menu')
    J("OCUI.U.modal = null; OCUI.render()")
    step(900); wait(2500); shot('rn-end-of-shift-report')
    J("window.scrollTo(0, 0); const r = document.querySelector('#report'); if (r) r.scrollTop = r.scrollHeight / 2"); wait(300); shot('rn-report-middle')

    # ---- attending shift: orders, diagnosis, radio, fired
    J("OCUI.U.mode = 'md'; OCUI.U.scene = 'title'; document.querySelector('#report').hidden = true; OCUI.start('med')"); wait(3000); portrait_list(); intro('md-first-shift-intro'); shot('md-shift-start')
    J("""(() => { const free = OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso);
      const id = OC.trainPatient('appy', 'room', { room: free.id, sex: 'M', age: 30 }); const p = OC.pt(id); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p);
      window.__p = id; OCUI.U.sheet = { type: 'pt', pid: id }; OCUI.render(); })()"""); wait(800); shot('md-order-sheet')
    J("(() => { const m = document.querySelector('#sheet [data-act=\"ordMenu\"]'); if (m) m.click(); })()"); wait(400); shot('md-order-menu-open')
    J("(() => { const p = OC.pt(window.__p); OC.signOrders(p.id, ['cbc', 'bmp', 'ctap'], ['morph']); for (let i = 0; i < 900 && !p.dxq && !p.dxK; i++) OC.step(0.1); OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); })()"); wait(800); shot('md-diagnosis-question')
    J("(() => { OCUI.U.sheet = null; OC.G.box.cur = { kind: 'consult', sc: OC.SCEN.national.findIndex(s => s.opts), pk: 'national', unit: 'Medic 3', id: 99, ring: 99, left: 99, t0: OC.G.t }; OCUI.render(); })()"); wait(800); shot('md-radio-ringing')
    act('boxTake') or J("(() => { const b = document.querySelector('#boxbar button'); if (b) b.click(); })()"); wait(600); shot('md-radio-call-open')
    J("OCUI.U.modal = null; OC.G.box.cur = null; OCUI.render()")
    J("(() => { OC.litAdd(30, 'audit'); OCUI.render(); })()"); wait(600); shot('md-legal-risk-admin-call')
    J("(() => { for (let i = 0; i < 6; i++) { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); OC.litAdd(12, 'audit'); OC.step(0.1); } OCUI.render(); })()"); wait(2500); shot('md-fired-game-over')

    # ---- Orientation and a lesson
    J("OCUI.U.mode = 'rn'; document.querySelector('#report').hidden = true; OCUI.U.scene = 'title'; OCUI.start('train')"); wait(3500); shot('orientation-first-card')
    J("OCUI.U.scene = 'title'; OCUI.showTitle(); OCUI.U.mode = 'md'; OCUI.start('train', 'c_mpe')"); wait(3000); shot('lesson-case-card')
    # ---- the gate (private testing) as a player on the real address sees it, with the database unreachable
    J("localStorage.clear()")
    page.route('https://edcodeblack.com/**', lambda r: r.fulfill(path=os.path.join(ROOT, 'index.html')) if r.request.url.rstrip('/').endswith('.com') or r.request.url.endswith('index.html') else r.abort())
    page.route('**/supabase.co/**', lambda r: r.abort())
    try: page.goto('https://edcodeblack.com/'); wait(2500); shot('gate-cannot-reach-server')
    except Exception as e: log.append(f'{size} gate: {e}')
    log.append(f'{size}: {len(errs)} console/page errors' + (': ' + ' | '.join(sorted(set(errs))[:8]) if errs else ''))
    b.close()

with sync_playwright() as pw:
    url = serve()
    only = sys.argv[1:] or list(SIZES)
    for size in only: run(pw, url, size, SIZES[size])
print('\n'.join(log))
