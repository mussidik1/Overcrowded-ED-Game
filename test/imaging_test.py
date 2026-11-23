"""v0.19.1: named orders and the imaging viewer, at phone size. The attending orders a CBC, a BMP and a CT abdomen and
pelvis for appendicitis; when the CT is back, the card shows each result, the CT has a picture, and tapping it opens the
viewer with the finding, what to look for, and the picture's credit."""
import os, sys
from playwright.sync_api import sync_playwright
from _browser import launch

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

with sync_playwright() as pw:
    b = launch(pw)
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("try { localStorage.setItem('oc-seen-first', '1'); localStorage.setItem('oc-view', 'map'); } catch (e) {}")
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    J = page.evaluate
    page.goto(URL); page.wait_for_timeout(700)
    page.locator('[data-act="mode"][data-arg="md"]').tap(); page.locator('[data-act="tmenu"][data-arg="play"]').tap(); page.locator('button.lvl[data-arg="med"]').tap(); page.wait_for_timeout(700)
    J("(document.querySelector('#modal [data-act=\"modalOk\"]') || {click(){}}).click()")
    pid = J("""(() => { const free = OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st !== 'dirty'); const x = OC.trainPatient('appy', 'room', { room: free.id });
      const p = typeof x === 'string' ? OC.pt(x) : x; OC.assign(OC.G.me, p.id); for (let i = 0; i < 4000 && p.ord !== 'need'; i++) OC.step(0.1);
      OCUI.U.paused = true; OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); return p.id; })()""")
    page.wait_for_timeout(500)
    ok(page.locator('#sheet [data-act="ordMenu"][data-arg="lab"]').count() == 1 and page.locator('#sheet [data-act="ordMenu"][data-arg="img"]').count() == 1 and page.locator('#sheet [data-act="ordT"][data-arg$="|t|cbc"]').count() == 1 and page.locator('#sheet [data-act="ordT"][data-arg$="|t|mrib"]').count() == 1, 'the order sheet has Labs and Imaging, with single tests (CBC) and named studies (MRI brain)')
    def otap(kind, k):   # v0.28: orders sit in menus
        sel = f'#sheet [data-act="ordT"][data-arg="{pid}|{kind}|{k}"]'
        for m in J(f"OCUI.omOf('{k}')"):
            h = page.locator(f'#sheet [data-act="ordMenu"][data-arg="{m}"]')
            if not page.locator(sel).is_visible() and h.get_attribute('aria-expanded') != 'true': h.tap(); page.wait_for_timeout(150)
        page.locator(sel).tap(); page.wait_for_timeout(150)
    for k in ['cbc', 'bmp', 'ctap']: otap('t', k)
    otap('r', 'morph')
    page.locator(f'#sheet [data-act="sign"]').tap(); page.wait_for_timeout(400)
    ok(J(f"OC.pt('{pid}').det.join()") == 'cbc,bmp,ctap' and J(f"OC.G.stats.md.clean") >= 1, 'tapping CBC, BMP, CT abdomen and pelvis and Sign orders exactly those, and it is a clean set')
    J(f"(() => {{ const p = OC.pt('{pid}'); for (let i = 0; i < 6000 && !(p.work.ct && p.work.ct.st === 'done' && p.work.lab && p.work.lab.st === 'done'); i++) OC.step(0.1); OCUI.U.sheet = {{ type: 'pt', pid: p.id }}; OCUI.render(); }})()")
    page.wait_for_timeout(600)
    txt = page.locator('#sheet').inner_text()
    ok('WBC 15.8' in txt and 'Appendix 11 mm across, fat stranding around it' in txt and 'CT abdomen and pelvis' in txt, 'each named test has its own result row (WBC 15.8; CT: inflamed appendix)')
    th = page.locator(f'#sheet [data-act="img"][data-arg="{pid}|ctap"]')
    ok(th.count() == 1, 'the CT result has a picture to open')
    page.wait_for_function(f"(() => {{ const i = document.querySelector('#sheet [data-act=\"img\"][data-arg=\"{pid}|ctap\"] img'); return i && i.complete && i.naturalWidth > 0; }})()", timeout=10000)
    th.tap(); page.wait_for_timeout(500)
    ok(page.is_visible('#viewer') and J("(() => { const i = document.querySelector('#viewer img'); return !!(i && i.complete && i.naturalWidth > 200); })()"), 'tapping it opens the study full screen')
    vt = page.locator('#viewer').inner_text()
    ok('Appendix 11 mm across, fat stranding around it' in vt and 'Look for' in vt and 'CC BY-SA' in vt and page.locator('#viewer .vw-cr a[href*="commons.wikimedia.org"]').count() == 1, 'the viewer names the finding, what to look for, and credits the picture with a link to its source')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'imaging-viewer.png'))
    page.locator('#viewer [data-vw="x"]').tap(); page.wait_for_timeout(300)
    ok(not page.is_visible('#viewer'), 'Close closes it')
    missing = J("(() => Object.keys(OCUI.imgCredit || {}).length)")
    b.close()

# every picture a result names is in img/ with a credit, or is knowingly left as text
import json, re
root = os.path.join(os.path.dirname(__file__), '..')
cred = json.load(open(os.path.join(root, 'img', 'credits.json')))
ok(all(os.path.exists(os.path.join(root, 'img', k + '.jpg')) for k in cred), f'every credited picture is in img/ ({len(cred)})')
ok(all(c['license'] in ('CC0', 'Public domain', 'Public domain (US government)', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0') and c['author'] and c['url'] for c in cred.values()), 'every picture has an author, an allowed licence, and a source link')
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
