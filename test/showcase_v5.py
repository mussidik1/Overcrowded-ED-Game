"""README screenshots for v0.5: a gray-zone call, chairs on the board, the capacity sheet, and the M&M report."""
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
    # 1. a gray-zone call
    gid = J("""() => { for (let seed = 11; seed < 60; seed++) { OC.newGame('med', seed * 13); OCUI.U.scene = 'game'; document.getElementById('title').hidden = true;
        let n = 0; while (n++ < 30000 && !OC.G.over) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, gray: false, interp: 0.5});
          const p = OC.inRooms().find(p => p.dsp === 'decide' && p.gray.short === 'HEART' && p.gray.band === 'moderate'); if (p && OC.G.t > 150) { OCUI.U.sel = null; return p.id; } } } return null; }""")
    page.wait_for_timeout(400)
    if gid:
        J('window.scrollTo(0, 0)')
        page.locator('#room-' + J(f"OC.pt('{gid}').room")).tap(); page.wait_for_timeout(400)
        page.screenshot(path=f'{OUT}/v5_gray.png')
        page.locator('.sheet-x').tap(); page.wait_for_timeout(200)
    # 2. chairs in use on the board
    J("""() => { for (let seed = 5; seed < 40; seed++) { OC.newGame('hard', seed * 17); let n = 0;
        while (n++ < 6000 && !OC.G.over && OC.G.t < 600) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 3, interp: 0.5});
          if (OC.G.rooms.filter(r => r.kind === 'chair' && r.pid).length >= 4 && OC.G.t > 200) { OCUI.U.sel = null; return; } } } }""")
    page.wait_for_timeout(400)
    J("document.getElementById('zone-ft').scrollIntoView({block: 'start'}); window.scrollBy(0, -130)")
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/v5_chairs.png')
    # 3. the capacity sheet: the region and the full-capacity protocol
    J("() => { OC.G.region.hosps[1].st = 'yellow'; OC.G.region.hosps[1].hold = OC.G.t + 60; }")
    J('window.scrollTo(0, 0)')
    page.locator('#btnYellow').tap(); page.wait_for_timeout(400)
    J("() => { const el = document.querySelector('#sheet .dv.yellow'); if (el) el.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/v5_capacity.png')
    page.locator('.sheet-x').tap(); page.wait_for_timeout(200)
    # 4. the shift report: M&M first
    J("""() => { let n = 0; while (!OC.G.over && n++ < 90000) { if (OC.G.card) OC.botStep({budget: 0}); OC.step(0.1); if (n % 10 === 0) OC.botStep({budget: 1, acc: 0.7}); } }""")
    page.wait_for_timeout(1200)
    J("() => { const el = document.querySelector('#report .rep-big'); if (el) el.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/v5_report.png')
    J("() => { const el = [...document.querySelectorAll('#report h4')].find(h => /ED metrics/.test(h.textContent)); if (el) el.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/v5_metrics.png')
    b.close()
print('done')
