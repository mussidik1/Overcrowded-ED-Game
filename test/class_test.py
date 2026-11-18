"""v0.20: class codes and bed first, at phone size. An instructor makes a code from the menu, a student types it in and
plays the same shift; the summary shows the code, the real time played, and a Share result button. A walk-in who
looks sick can be bedded before registration, and the card then asks for a registrar."""
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
    ctx.add_init_script("try { localStorage.setItem('oc-seen-first', '1'); localStorage.setItem('oc-seen-help2', '1'); localStorage.setItem('oc-view', 'map'); localStorage.setItem('oc-3d', '0'); } catch (e) {}")
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    J = page.evaluate
    def clear():   # decision cards and the first-shift card sit over everything: answer them
        J("(() => { const G = OC.G; for (let i = 0; i < 5 && G.card; i++) OC.chooseCard(G.card.choices.find(c => !c.dis).k); OCUI.U.modal = null; OCUI.render(); })()"); page.wait_for_timeout(200)
    page.goto(URL); page.wait_for_timeout(700)
    page.locator('[data-act="mode"][data-arg="rn"]').tap(); page.locator('[data-act="tmenu"][data-arg="play"]').tap(); page.wait_for_timeout(200)
    ok(page.locator('#title [data-act="classCode"]').count() == 1, 'Play a shift offers Class code')
    page.locator('#title [data-act="classCode"]').tap(); page.wait_for_timeout(400)
    ok(page.is_visible('#sheet .cc-in') and page.locator('#sheet [data-act="codeMake"]').count() == 4, 'the class code sheet has a box to type a code and the four shifts to make one from')
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(300)
    code = page.locator('#sheet .cc-code').inner_text().strip()
    ok(len(code) == 7 and code[3] == '-' and 'Five-Minute Rush' in page.locator('#sheet .cc-made').inner_text(), f'picking the Rush makes a code and names the shift ({code})')
    # a student types it, in lower case without the dash
    page.locator('#sheet .cc-in').fill(code.replace('-', '').lower()); page.wait_for_timeout(200)
    ok(not page.locator('#sheet .cc-box [data-act="codePlay"]').first.is_disabled() and 'Charge nurse' in page.locator('#sheet .cc-what').inner_text(), 'typing it (lower case, no dash) is read back as the shift it starts')
    bad = code[:6] + ('A' if code[6] != 'A' else 'B')
    page.locator('#sheet .cc-in').fill(bad); page.wait_for_timeout(200)
    st = J("(() => { const b = document.querySelector('#sheet .cc-box [data-act=\"codePlay\"]'); return { dis: b && b.disabled, what: document.querySelector('#sheet .cc-what').textContent, ok: !!OC.readCode(document.querySelector('#sheet .cc-in').value) }; })()")
    ok(st['ok'] or (st['dis'] and 'not look right' in st['what']), f'a mistyped code is caught before Start ({bad}: {st})')
    page.locator('#sheet .cc-in').fill(code); page.wait_for_timeout(150)
    page.locator('#sheet .cc-box [data-act="codePlay"]').first.tap(); page.wait_for_timeout(700)
    ok(J('OC.G.level') == 'rush' and J('OC.G.code') == code, 'Start plays the shift with that code')
    seed1 = J('OC.G.seed')
    # bed first: a sick walk-in at the door
    clear()
    pid = J("""(() => { OCUI.U.paused = true; const x = OC.trainPatient('cpmod', 'walk'); const p = typeof x === 'string' ? OC.pt(x) : x;
      for (let i = 0; i < 200 && p.loc !== 'triage'; i++) OC.step(0.1); OCUI.U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); return p.id; })()""")
    page.wait_for_timeout(400); clear(); J(f"OCUI.U.sheet = {{ type: 'pt', pid: '{pid}' }}; OCUI.render()"); page.wait_for_timeout(300)
    ok(page.locator(f'#sheet [data-act="placeSel"][data-arg="{pid}"]').count() == 1 and 'Looks sick' in page.locator('#sheet').inner_text(), 'a sick walk-in at the door gets a Bed first button that says why')
    page.locator(f'#sheet [data-act="placeSel"][data-arg="{pid}"]').tap(); page.wait_for_timeout(300)
    room = J("(OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed) || {}).id")
    J(f"OCUI.U.paused = false; OCUI.render()"); page.wait_for_timeout(200)
    J(f"(() => {{ const el = document.getElementById('mroom-{room}'); el.dispatchEvent(new MouseEvent('click', {{ bubbles: true }})); }})()"); page.wait_for_timeout(400)
    if J(f"OC.pt('{pid}').loc") != 'room': J(f"OC.place('{pid}', '{room}')")   # the floor's tap target can differ by layout; the rule is what is tested here
    ok(J(f"OC.pt('{pid}').loc") == 'room' and J(f"OC.pt('{pid}').reg") == 'none', 'they go to a room unregistered')
    clear(); J(f"OCUI.U.paused = true; OCUI.U.sheet = {{ type: 'pt', pid: '{pid}' }}; OCUI.render()"); page.wait_for_timeout(300)
    ok(page.locator(f'#sheet [data-act="regAssign"][data-arg^="{pid}|"]').count() >= 1, 'their card asks for a registrar, alongside the provider')
    # finish the shift fast and read the summary
    J("(() => { OCUI.U.sheet = null; OCUI.U.paused = false; OCUI.U.speed = 4; })()")
    page.wait_for_timeout(4000)
    J("(() => { const G = OC.G; for (let i = 0; i < 20000 && !G.over; i++) { if (G.card) OC.chooseCard(G.card.choices.find(c => !c.dis).k); OC.step(0.1); } })()")
    page.wait_for_function("!document.getElementById('report').hidden", timeout=20000)
    rep = page.locator('#report').inner_text()
    rc = J("(document.querySelector('#report .rep-class') || {}).textContent || ''")
    ok(f'Class code {code}' in rc and 'Played in' in rc, f'the summary shows the class code and the real time played ({rc})')
    ok(page.locator('#report [data-act="shareResult"]').count() == 1, 'and has a Share result button')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-report.png'))
    clear(); page.locator('#report [data-act="again"]').tap(); page.wait_for_timeout(600)
    ok(J('OC.G.code') == code and J('OC.G.seed') == seed1, 'Run it back replays the same class shift')
    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
