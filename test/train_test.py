"""Play Orientation end to end at phone size by tapping whatever the preceptor lights up."""
import os, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)
errors, log = [], []
W = int(os.environ.get('VW', '390')); H = int(os.environ.get('VH', '844'))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=W < 900, has_touch=True, reduced_motion='reduce')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    J = page.evaluate
    MODE = os.environ.get('MODE', 'rn')
    page.goto(URL); page.wait_for_timeout(1200)
    page.locator(f'[data-act="mode"][data-arg="{MODE}"]').tap(); page.wait_for_timeout(300)
    page.locator('button.lvl[data-arg="train"]').tap(); page.wait_for_timeout(500)
    ok_start = J('OC.G.level') == 'train' and J('OC.G.mode') == MODE and J('OC.active().length') == 0
    if not ok_start: errors.append('Orientation did not start on an empty board')
    last, same, taps, shots = -1, 0, 0, set()
    for it in range(600):
        c = J('OCUI.coach()')
        if not c: errors.append('preceptor vanished'); break
        if c['i'] != last:
            log.append(f"{c['i'] + 1:>2}/{c['n']} {c['id']}"); last, same = c['i'], 0
            if c['id'] in ('m1', 'w6', 't2', 'g6', 'h1', 'r2', 'd1', 'j3', 'a3', 'b5', 'r1', 's4', 'end') and c['id'] not in shots:
                shots.add(c['id']); page.wait_for_timeout(250); page.screenshot(path=f"{OUT}/train_{MODE}_{c['id']}.png")
        else: same += 1
        if c['final']: break
        if same > 40:
            errors.append(f"stuck on step {c['i'] + 1} ({c['id']})"); J("OCUI.U.sheet = null; OCUI.U.sel = null")
            page.locator('[data-act="coachSkip"]').first.tap(); same = 0; continue
        if c['next']:
            page.locator('[data-act="coachNext"]').first.tap(); page.wait_for_timeout(150); continue
        if c['wait']:
            page.wait_for_timeout(250); continue
        spots = page.locator('.coach-spot')
        if spots.count() == 0:
            page.wait_for_timeout(150); continue
        el = spots.first
        try:
            el.evaluate("e => { if (!e.closest('.sheet-body, .modal, .dock, .top, .side')) e.scrollIntoView({block: 'center'}); }")
            el.tap(timeout=2500); taps += 1
        except Exception as e:
            log.append('  tap failed: ' + str(e).split('\n')[0][:120])
        page.wait_for_timeout(180)
    c = J('OCUI.coach()')
    if not c or not c['final']: errors.append('did not reach the last step')
    page.screenshot(path=f'{OUT}/train_{MODE}_final.png')
    print('\n'.join(log))
    print(f'taps: {taps}, game clock: {J("OC.clock()")}, care {J("Math.round(OC.G.care)")}')
    b.close()
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]: print(' ', e)
sys.exit(1 if errors else 0)
