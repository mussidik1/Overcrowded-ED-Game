"""Orientation the way a real finger plays it (v0.11): people animating, real time, and touches that slide a little, as a thumb does.
   Fails if a step sticks or if the floor ignores a tap. MODE=md plays the attending. DRIFT sets how far the finger slides (default 12 px)."""
import os, sys, math, random
from playwright.sync_api import sync_playwright
from _browser import launch, Finger
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
URL = 'file://' + ROOT + '/index.html'
MODE = os.environ.get('MODE', 'rn'); VIEW = os.environ.get('VIEW', 'map')
W = int(os.environ.get('VW', '844')); H = int(os.environ.get('VH', '390'))
DRIFT = float(os.environ.get('DRIFT', '12')); SEED = int(os.environ.get('SEED', '7')); PAUSE = int(os.environ.get('PAUSE', '450'))
random.seed(SEED)
errors, log = [], []
with sync_playwright() as pw:
    b = launch(pw)
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page(); fg = Finger(ctx, page)
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    J = page.evaluate
    def finger(x, y, drift=DRIFT):
        a = random.random() * 2 * math.pi; r = drift * (0.5 + random.random() * 0.5)
        fg.start(x, y)
        page.wait_for_timeout(35)
        if drift:
            fg.move(x + math.cos(a) * r / 2, y + math.sin(a) * r / 2)
            page.wait_for_timeout(25)
            fg.move(x + math.cos(a) * r, y + math.sin(a) * r)
        page.wait_for_timeout(45)
        fg.end()
    def tap_sel(sel):
        bb = page.locator(sel).first.bounding_box()
        finger(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    page.goto(URL); J(f"() => localStorage.setItem('oc-view', '{VIEW}')"); page.goto(URL); page.wait_for_timeout(1200)
    tap_sel(f'[data-act="mode"][data-arg="{MODE}"]'); page.wait_for_timeout(400)
    LESSON = os.environ.get('LESSON')   # one of the eight lessons instead of Orientation
    if LESSON: tap_sel('#title [data-act="lessons"]'); page.wait_for_timeout(500); tap_sel(f'#sheet [data-act="lesson"][data-arg="{LESSON}"]'); page.wait_for_timeout(700)
    else: tap_sel('button.lvl[data-arg="train"]'); page.wait_for_timeout(700)
    if J('OC.G.level') != 'train': errors.append('Orientation did not start')
    last, tries, total_taps, slow = None, 0, 0, []
    for it in range(1400):
        c = J('OCUI.coach()')
        if not c: errors.append('preceptor vanished'); break
        if (c['i'], c.get('brk')) != last:
            if last is not None and tries > 4: slow.append((log[-1], tries))
            log.append(f"{c['i'] + 1:>2}/{c['n']} {c['id']}" + (f" (after chapter {c['brk']})" if c.get('brk') is not None else '')); last, tries = (c['i'], c.get('brk')), 0
            if os.environ.get('TRACE'): print(log[-1], flush=True)
        if c['final']: break
        if c['wait']: page.wait_for_timeout(300); continue
        if tries > 14:
            what = J("(() => { const e = document.querySelector('.coach-spot'); return e ? e.outerHTML.slice(0, 120) : 'no spot'; })()")
            errors.append(f"STUCK on step {c['i'] + 1} ({c['id']}): {tries} taps did nothing. Lit: {what}")
            J("OCUI.U.sheet = null; OCUI.U.sel = null"); page.locator('[data-act="coachSkip"]').first.tap(); page.wait_for_timeout(300); tries = 0; continue
        sel = '[data-act="coachNext"]' if c['next'] else '.coach-spot'
        loc = page.locator(sel)
        if loc.count() == 0: page.wait_for_timeout(200); tries += 0.25; continue
        bb = loc.first.bounding_box()
        if not bb or bb['width'] < 1: page.wait_for_timeout(200); tries += 0.25; continue
        # a person aims near the middle of what is lit, not exactly at it
        x = bb['x'] + bb['width'] * (0.5 + (random.random() - 0.5) * 0.3); y = bb['y'] + bb['height'] * (0.5 + (random.random() - 0.5) * 0.3)
        before = J("JSON.stringify([OCUI.coach().i, OCUI.coach().brk, !!OCUI.U.sheet, OCUI.U.sheet && OCUI.U.sheet.type, JSON.stringify(OCUI.U.sel), document.querySelector('.coach-spot') ? document.querySelector('.coach-spot').outerHTML.slice(0, 60) : ''])")
        finger(x, y); total_taps += 1; tries += 1
        page.wait_for_timeout(PAUSE + int(random.random() * 250))
        after = J("JSON.stringify([OCUI.coach().i, OCUI.coach().brk, !!OCUI.U.sheet, OCUI.U.sheet && OCUI.U.sheet.type, JSON.stringify(OCUI.U.sel), document.querySelector('.coach-spot') ? document.querySelector('.coach-spot').outerHTML.slice(0, 60) : ''])")
        if after == before:
            where = J("(sel) => { const e = document.querySelector(sel); return e ? [(e.id || e.getAttribute('data-act') + ':' + e.getAttribute('data-arg')), !!e.closest('#map')] : ['none', false]; }", sel)
            log.append(f"    tap at {x:.0f},{y:.0f} did nothing ({'floor' if where[1] else 'button'}: {where[0]})")
            if os.environ.get('TRACE'): print(log[-1], flush=True)
    c = J('OCUI.coach()')
    if not c or not c['final']: errors.append('did not reach the last step')
    dead = [l for l in log if 'did nothing' in l]; floor = [l for l in dead if '(floor:' in l]
    # The floor does its own tap handling, so it must take every sliding tap. Ordinary buttons inside a scrolling card follow the browser: a slide there can start a scroll.
    if floor: errors.append(f'the floor ignored {len(floor)} sliding taps: ' + '; '.join(x.strip() for x in floor[:4]))
    if len(dead) - len(floor) > 12: errors.append(f'{len(dead) - len(floor)} taps on ordinary buttons did nothing')
    print(f"{MODE} {VIEW} {W}x{H}, finger slides up to {DRIFT:.0f}px: {last[0] + 1} steps, {total_taps} taps, floor ignored {len(floor)}, buttons ignored {len(dead) - len(floor)}")
    if os.environ.get('SHOW'): print('\n'.join(log))
    b.close()
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]: print(' ', e)
sys.exit(1 if errors else 0)
