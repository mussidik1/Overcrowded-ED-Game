"""Play Orientation end to end at phone size by tapping whatever the preceptor lights up."""
import os, sys
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)
errors, log = [], []
VIEW = os.environ.get('VIEW', 'map')   # the floor plan is played sideways; the list board upright
W = int(os.environ.get('VW', '844' if VIEW == 'map' else '390')); H = int(os.environ.get('VH', '390' if VIEW == 'map' else '844'))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=W < 900, has_touch=True, reduced_motion='reduce')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    J = page.evaluate
    MODE = os.environ.get('MODE', 'rn'); LESSON = os.environ.get('LESSON')   # LESSON=stroke|heart|sepsis|bleed|breath|od plays one lesson, started from either role
    page.goto(URL); page.evaluate(f"() => localStorage.setItem('oc-view', '{VIEW}')"); page.goto(URL); page.wait_for_timeout(1200)
    page.locator(f'[data-act="mode"][data-arg="{MODE}"]').tap(); page.wait_for_timeout(300)
    if LESSON:
        page.locator('#title [data-act="lessons"]').tap(); page.wait_for_timeout(400)
        if page.locator('#sheet [data-act="lesson"]').count() != 8: errors.append('the Lessons list does not show eight lessons')
        page.locator(f'#sheet [data-act="lesson"][data-arg="{LESSON}"]').tap(); page.wait_for_timeout(500)
        ok_start = J('OC.G.level') == 'train' and J('OC.G.mode') == 'md' and J('OCUI.coach().lesson') == LESSON and J('OC.active().length') == 0 and J('OCUI.U.mode') == MODE
        if not ok_start: errors.append(f'the {LESSON} lesson did not start as the attending on an empty board, leaving the title role alone')
    elif os.environ.get('CHAPTER'):
        # CHAPTER=2 starts at the second chapter, from the chapter list a returning player sees
        ch = int(os.environ['CHAPTER']) - 1
        J(f"localStorage.setItem('oc-ch-{MODE}-0', '1')"); page.goto(URL); page.wait_for_timeout(1000)
        page.locator(f'[data-act="mode"][data-arg="{MODE}"]').tap(); page.wait_for_timeout(300)
        page.locator('#title [data-act="chapters"]').tap(); page.wait_for_timeout(400)
        want = 3 if MODE == 'md' else 4
        if page.locator('#sheet [data-act="chapter"]').count() != want: errors.append(f'the chapter list does not show {want} chapters')
        page.locator(f'#sheet [data-act="chapter"][data-arg="{ch}"]').tap(); page.wait_for_timeout(500)
        c0 = J('OCUI.coach()')
        if not (J('OC.G.level') == 'train' and J('OC.G.mode') == MODE and c0 and c0['ch'] == ch and J('OC.active().length') <= 2): errors.append(f'chapter {ch + 1} did not start at its own first step')   # its own patient may already be here
    else:
        page.locator('button.lvl[data-arg="train"]').tap(); page.wait_for_timeout(500)
        ok_start = J('OC.G.level') == 'train' and J('OC.G.mode') == MODE and J('OC.active().length') == 0
        if not ok_start: errors.append('Orientation did not start on an empty board')
    last, same, taps, shots, words = None, 0, 0, set(), []
    for it in range(600):
        c = J('OCUI.coach()')
        if not c: errors.append('preceptor vanished'); break
        if (c['i'], c.get('brk')) != last:
            log.append(f"{c['i'] + 1:>2}/{c['n']} {c['id']}" + (f" (after chapter {c['brk']})" if c.get('brk') is not None else '')); last, same = (c['i'], c.get('brk')), 0
            if os.environ.get('TRACE'): print(log[-1], flush=True)
            # every prompt is drawn with its key words in bold: no stars or brackets left showing, and no card with nothing bold in it
            card = J("(() => { const p = document.querySelector('.coach-c p'); return p ? { t: p.innerText, b: p.querySelectorAll('b').length } : null; })()")
            if card and ('**' in card['t'] or '[[' in card['t'] or ']]' in card['t']): errors.append(f"step {c['id']}: a formatting mark is showing: {card['t'][:80]}")
            if card and not card['b'] and len(card['t'].split()) > 12: errors.append(f"step {c['id']}: nothing is bold in a {len(card['t'].split())}-word card")
            if card: words.append(len(card['t'].split()))
            if c['id'] in ('m1', 'w6', 't2', 'g6', 'h1', 'r2', 'd1', 'j3', 'a3', 'b5', 'r1', 's4', 'end') and c['id'] not in shots:
                shots.add(c['id']); page.wait_for_timeout(250); page.screenshot(path=f"{OUT}/train_{MODE}_{VIEW}_{c['id']}.png")
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
            el.evaluate("e => { if (!e.closest('.sheet-body, .modal, .dock, .top, .side, #map')) e.scrollIntoView({block: 'center'}); }")
            el.tap(timeout=2500); taps += 1
        except Exception as e:
            why = [ln.strip() for ln in str(e).split('\n') if 'intercepts' in ln or 'not visible' in ln or 'outside of the viewport' in ln or 'not stable' in ln]
            what = ''
            if os.environ.get('TRACE'):
                try: what = el.evaluate("e => e.outerHTML.slice(0, 90) + ' @' + JSON.stringify(Object.values(e.getBoundingClientRect().toJSON()).slice(0, 4).map(Math.round))")
                except Exception: what = '?'
            log.append('  tap failed: ' + str(e).split('\n')[0][:120] + (' | ' + why[-1][:140] if why else '') + (' | ' + what if what else ''))
            if os.environ.get('TRACE'): print(log[-1], flush=True)
        page.wait_for_timeout(180)
    c = J('OCUI.coach()')
    if not c or not c['final']: errors.append('did not reach the last step')
    page.screenshot(path=f'{OUT}/train_{LESSON or MODE}_final.png')
    if LESSON and c and c['final']:
        # the goals a lesson teaches are met when the player follows it, and finishing marks it done on the title
        goals = J("(() => { const t = OC.G.tr; const p = OC.pt(t.ids.pt); return p ? p.goals : null; })()") or {}
        missed = [k for k, v in goals.items() if v is False]
        if missed: errors.append(f'following the {LESSON} lesson missed a time goal: {missed}')
        nxt = page.locator('[data-act="lessonNext"]')
        page.locator('[data-act="coachDone"]').first.tap(); page.wait_for_timeout(500)
        if not (J("localStorage.getItem('oc-lesson-" + LESSON + "')") == '1' and page.is_visible('#title') and '1 of 8' in page.inner_text('#title [data-act="lessons"]')): errors.append('finishing the lesson did not mark it done on the title')
        if J("localStorage.getItem('oc-trained-md')") or J("localStorage.getItem('oc-trained')"): errors.append('a lesson marked Orientation as done')
        print('goals:', goals)
    print('\n'.join(log))
    print(f'taps: {taps}, game clock: {J("OC.clock()")}, care {J("Math.round(OC.G.care)")}, cards read {len(words)}, words {sum(words)}, longest {max(words or [0])}')
    if words and max(words) > 70: errors.append(f'a preceptor card runs {max(words)} words: over 70')
    b.close()
print('ERRORS:' if errors else 'No errors.')
for e in errors[:30]: print(' ', e)
sys.exit(1 if errors else 0)
