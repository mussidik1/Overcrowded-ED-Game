"""Clean phone screenshots for sharing (toasts hidden; they are transient)."""
import os
from playwright.sync_api import sync_playwright
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
os.makedirs(OUT, exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
    page = ctx.new_page()
    J = page.evaluate
    page.goto(URL); page.wait_for_timeout(1200)
    page.add_style_tag(content='#toasts{display:none!important}')
    J("localStorage.setItem('oc-seen-help2','1')")
    J("""() => { OC.newGame('med', 20261116, {pack: 'miemss'}); OCUI.U.scene = 'game'; document.getElementById('title').hidden = true;
      let n = 0; while (OC.G.t < 190 && n++ < 30000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, interp: 0.4}); }
      n = 0; while (n++ < 4000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, interp: 0.4, intake: false, up: false});
        const door = OC.active().filter(p => (p.loc === 'wall' || p.loc === 'triage') && p.tri !== 'done').length;
        if (door >= 3 && OC.inRooms().some(p => p.dsp === 'bedready')) break; }
      OCUI.U.sel = null; OCUI.U.speed = 1; }""")
    page.wait_for_timeout(400)
    J('window.scrollTo(0, 0)')
    page.screenshot(path=f'{OUT}/n1_board.png')
    pid = J("() => { const p = OC.active().find(p => p.loc === 'wall' && p.reg === 'none' && !OC.emergent(p)) || OC.active().find(p => (p.loc === 'wall' || p.loc === 'triage') && p.tri === 'none' && !OC.emergent(p)); return p ? p.id : null; }")
    if pid:
        page.locator(f'[data-act="pt"][data-arg="{pid}"]').first.tap(); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/n2_intake.png')
        page.locator('.sheet-x').tap(); page.wait_for_timeout(150)
    rid = J("() => { const p = OC.inRooms().find(p => p.dsp === 'bedready'); return p ? p.room : null; }")
    if rid:
        page.locator(f'#room-{rid}').tap(); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/n3_bedready.png')
        page.locator('.sheet-x').tap(); page.wait_for_timeout(150)
    tx = J("""() => { for (let seed = 3; seed < 30; seed++) { OC.newGame('hard', seed * 7, {pack: 'miemss'}); let n = 0;
        while (n++ < 7200 && !OC.G.over) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, ift: false});
          const p = OC.inRooms().find(p => p.dsp === 'txok'); if (p) { OCUI.U.sel = null; return p.room; } } } return null; }""")
    page.wait_for_timeout(400)
    if tx:
        J('window.scrollTo(0, 0)')
        page.locator(f'#room-{tx}').tap(); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/n4_ift.png')
    print('intake', pid, 'bedready', rid, 'ift', tx)
    b.close()
