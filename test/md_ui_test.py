"""Physician mode at phone size: see a patient, write orders, make the call, answer the radio (v0.7)."""
import os
from playwright.sync_api import sync_playwright

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
errors, checks = [], []

def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

def run():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
        J = page.evaluate

        def tap(sel, timeout=1500):
            for _ in range(3):
                try:
                    loc = page.locator(sel).first
                    if loc.count() == 0: return False
                    loc.tap(timeout=timeout); page.wait_for_timeout(160); return True
                except Exception:
                    page.wait_for_timeout(150)
            return False

        def sim(minutes, until='false'):
            J('() => { let n = 0; const end = OC.G.t + %s; while (OC.G.t < end && !OC.G.over && n++ < 30000) { OC.step(0.1); if (%s) break; } }' % (minutes, until))
            page.wait_for_timeout(250)

        def open_pt(pid):
            if page.is_visible('#sheetWrap'): tap('.sheet-x')
            J('window.scrollTo(0, 0)')
            tap('#room-' + J(f"OC.pt('{pid}').room"))
            page.wait_for_timeout(150)

        # ---------- title: pick the attending ----------
        page.goto(URL, wait_until='domcontentloaded'); page.evaluate("() => localStorage.setItem('oc-view', 'list')"); page.goto(URL, wait_until='domcontentloaded')
        page.wait_for_timeout(1200)
        tap('[data-act="mode"][data-arg="md"]')
        tap('[data-act="pack"][data-arg="national"]')
        tap('button.lvl[data-arg="med"]')
        page.wait_for_timeout(400)
        ok(J('OC.G.mode') == 'md' and J('OC.G.me') == 'md1', 'Manic Monday as the attending')
        ok(page.is_visible('#sheetWrap') and 'Write orders' in page.inner_text('#sheet'), 'first-play help is the attending version')
        page.screenshot(path=f'{OUT}/md_00_help.png')
        tap('.sheet-x')
        for _ in range(10):
            if page.is_visible('#modalWrap'): tap('#modal [data-act="resume"]') or tap('#modal [data-act="modalOk"]')
            elif J('OC.G.running'): break
            page.wait_for_timeout(200)
        page.wait_for_timeout(600)
        ok(J('OC.G.running'), 'the shift is running')
        ok(not page.is_visible('#modalWrap'), 'no charge-nurse decision cards for the attending')
        ok(page.inner_text('.brand small').lower() == 'attending', 'header says Attending')
        ok(not page.is_visible('#btnYellow') and page.locator('#pStaff span').inner_text() == 'Panel', 'attending HUD: panel, not staffing; no yellow button')

        # ---------- see a patient ----------
        sim(60, "OC.inRooms().some(p => OC.needsProv(p) && !p.prov && !p.arrest)")
        pid = J("() => { const p = OC.inRooms().filter(p => OC.needsProv(p) && !p.prov && !p.arrest).sort((a, b) => OC.vEsi(a) - OC.vEsi(b))[0]; return p ? p.id : null; }")
        ok(pid is not None, 'a roomed patient is waiting for a provider')
        if pid is None: raise SystemExit('no patient to see; stopping')
        open_pt(pid)
        ok(page.locator('#sheet [data-act="see"]').count() == 1, 'their card offers See this patient')
        page.screenshot(path=f'{OUT}/md_01_see.png')
        tap('#sheet [data-act="see"]')
        ok(J(f"OC.pt('{pid}').prov") == 'md1', 'you picked them up')
        sim(30, f"OC.pt('{pid}').ord === 'need'")
        ok(J(f"OC.pt('{pid}').ord") == 'need', 'exam done: orders needed')
        open_pt(pid)
        ok(page.locator('#sheet [data-act="ordT"]').count() >= 15, 'the order sheet lists tests and treatments')
        right = J(f"(() => {{ const p = OC.pt('{pid}'); return {{ wk: p.right.wk.filter(k => !p.wk.includes(k)), tr: p.right.tr.filter(k => !p.tr.includes(k)), dx: p.dx }}; }})()")
        for k in right['wk']: tap(f'#sheet [data-act="ordT"][data-arg="{pid}|t|{k}"]')
        for k in right['tr']: tap(f'#sheet [data-act="ordT"][data-arg="{pid}|r|{k}"]')
        n = len(right['wk']) + len(right['tr'])
        ok(page.locator('#sheet .och.on').count() == n, f"picked {n} orders for {right['dx']}")
        page.screenshot(path=f'{OUT}/md_02_orders.png')
        c0 = J('OC.G.care')
        tap('#sheet [data-act="sign"]')
        ok(J(f"OC.pt('{pid}').ord") == 'signed' and J('OC.G.stats.md.clean') >= 1 and J('OC.G.care') > c0, 'signed a clean order set')

        # ---------- make the call ----------
        sim(240, f"(() => {{ const p = OC.pt('{pid}'); return p.dsp === 'mddecide' || p.dsp === 'decide' || !!p.mdPick || p.loc === 'gone'; }})()")
        st = J(f"(() => {{ const p = OC.pt('{pid}'); return {{ dsp: p.dsp, pick: p.mdPick || null, want: p.dispo, con: p.con || null, gray: p.gray ? p.gray.right : null, loc: p.loc }}; }})()")
        if st['dsp'] in ('mddecide', 'decide'):
            open_pt(pid)
            page.screenshot(path=f'{OUT}/md_03_decide.png')
            if st['dsp'] == 'decide':
                tap(f'#sheet [data-act="gray"][data-arg$="|{st["gray"]}"]')
            elif st['want'] == 'home':
                tap(f'#sheet [data-act="mdd"][data-arg="{pid}|home"]')
            elif st['want'] == 'transfer':
                tap(f'#sheet [data-act="mdd"][data-arg="{pid}|transfer"]')
            else:
                tap(f'#sheet [data-act="mdd"][data-arg="{pid}|consult"]')
                ok(page.locator('#sheet [data-act="consultSpec"]').count() >= 3, 'Admit opens the consult list')
                page.screenshot(path=f'{OUT}/md_03b_consult.png')
                tap(f'#sheet [data-act="consultSpec"][data-arg="{st["con"]}"]')
            ok(J('OC.G.stats.md.dispoRight') >= 1, f"made the right call ({st['want']})")
        else:
            ok(st['pick'] is not None or st['loc'] == 'gone', f'decision handled on the way ({st})')
        if page.is_visible('#sheetWrap'): tap('.sheet-x')

        # ---------- the radio ----------
        J('() => { if (OC.G.box.cur) OC.G.box.cur = null; OC.trainConsult(); }')
        page.wait_for_timeout(300)
        ok('Answer' in page.inner_text('#boxbar'), 'medical direction rings for you: Answer')
        tap('#boxbar .bx-btn')
        ok(page.locator('#modal p.scen').count() == 1, 'you read the medic\'s call')
        page.screenshot(path=f'{OUT}/md_04_radio.png')
        a = J('(() => { const m = OCUI.U.modal; return m && m.sc ? !!m.sc.a : null; })()')
        ok(a is not None, 'the call has a right answer')
        tap(f'#modal [data-act="scen"][data-arg="{1 if a else 0}"]')
        ok(J('OC.G.stats.boxC.right') >= 1, 'right order on the radio')
        page.screenshot(path=f'{OUT}/md_04b_radio_result.png')
        tap('#modal [data-act="modalOk"]')
        J("() => { OCUI.U.paused = true; window._al = OC.trainPatient('stemi', 'alert', { eta: 9 }); }")
        page.wait_for_timeout(250)
        ok(page.locator('#boxbar .bx-btn').count() == 0 and 'charge nurse' in page.inner_text('#boxbar'), 'alert reports go to the charge nurse, no button for you')
        J("() => { OCUI.U.paused = false; OCUI.U.modal = null; }")
        sim(3, 'OC.pt(window._al).pren')
        ok(J('!!OC.pt(window._al).pren'), 'the charge nurse took the report')

        # ---------- team and board ----------
        tap('#dockProv [data-arg="md1"], .dock-prov[data-arg="md1"]')
        page.wait_for_timeout(200)
        if page.is_visible('#sheetWrap'): tap('.sheet-x')
        tap('[data-act="team"]')
        if page.is_visible('#sheetWrap'):
            ok(page.locator('#sheet [data-act="brk"]').count() == 0 and page.locator('#sheet [data-act="pizza"]').count() == 0, 'the team sheet has no nurse controls for the attending')
            page.screenshot(path=f'{OUT}/md_05_team.png')
            tap('.sheet-x')
        sim(90)
        J('window.scrollTo(0, 0)')
        page.screenshot(path=f'{OUT}/md_06_board.png')

        # ---------- finish the shift ----------
        J('() => { let n = 0; while (!OC.G.over && n++ < 20000) { OC.step(0.1); if (n % 20 === 0) OC.mdPlay({ budget: 2, acc: 0.8, line: 1 }); } }')
        page.wait_for_timeout(900)
        txt = page.inner_text('#modal') if page.is_visible('#modalWrap') else page.inner_text('body')
        ok('attending shift report' in txt.lower() and 'your patients' in txt.lower() and 'staff sat' not in txt.lower(), 'the attending shift report')
        page.set_viewport_size({'width': 390, 'height': 3200}); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/md_07_report.png', full_page=False)
        page.set_viewport_size({'width': 390, 'height': 844})
        R = J('OC.G.report')
        print('report', {k: R[k] for k in ['care', 'stars', 'wait', 'left']}, R['md'])
        ok(J("localStorage.getItem('oc-best-md-med')") is not None, 'best score kept for the attending')
        b.close()

run()
for c in checks: print(c)
print('ERRORS:\n  ' + '\n  '.join(errors) if errors else 'No errors.')
