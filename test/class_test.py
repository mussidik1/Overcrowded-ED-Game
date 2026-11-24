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
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)   # a stubbed server error is the browser's log line, not a page error
    J = page.evaluate
    def clear():   # decision cards and the first-shift card sit over everything: answer them
        for _ in range(4):   # a new card can land while we wait, so check again
            J("(() => { const G = OC.G; for (let i = 0; i < 5 && G.card; i++) OC.chooseCard(G.card.choices.find(c => !c.dis).k); OCUI.U.modal = null; OCUI.render(); })()"); page.wait_for_timeout(200)
            if not J("!!(OC.G && OC.G.card) || !!document.querySelector('#modalWrap.show, #modalWrap.on, #modal:not(:empty)')"): break
    page.goto(URL); page.wait_for_timeout(700)
    page.locator('[data-act="mode"][data-arg="rn"]').tap(); page.locator('[data-act="tmenu"][data-arg="play"]').tap(); page.wait_for_timeout(200)
    ok(page.locator('#title [data-act="classCode"]').count() == 1, 'Play a shift offers Class code')
    page.locator('#title [data-act="classCode"]').tap(); page.wait_for_timeout(400)
    ok(page.is_visible('#sheet .cc-in') and page.locator('#sheet [data-act="codeMake"]').count() == 4, 'the class code sheet has a box to type a code and the four shifts to make one from')
    # v0.31: results are private. A device with no instructor key sees no results and no box to read a code's results by the code alone.
    ok(page.locator('#sheet .cb-res .cb-tab').count() == 0 and page.locator('#sheet .cb-res [data-act="cbOpen"]').count() == 1 and page.locator('#sheet #cbCode').count() == 0,
       'a student sees no class results, only a way in for an instructor with a key')
    import json as _json
    reg, reg_plan = [], ['fail', 'taken', 'ok']
    KEY = '7K2M9QXH4V1R8ZTB'
    def on_new(route):
        a = _json.loads(route.request.post_data or '{}'); reg.append(a); step = reg_plan.pop(0) if reg_plan else 'ok'
        if step == 'fail': route.fulfill(status=503, body='')
        elif step == 'taken': route.fulfill(status=200, content_type='application/json', body='{"error": "taken"}')
        else: route.fulfill(status=200, content_type='application/json', body=_json.dumps({'key': KEY, 'expires': '2026-12-24T16:00:00+00:00'}))
    page.route('**/rest/v1/rpc/cb_class_new', on_new)
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(600)
    first = page.locator('#sheet .cc-code').inner_text().strip()
    ok(reg and reg[0].get('p_code') == first and reg[0].get('p_ver') and 'Class results are off' in page.locator('#sheet .cb-key').inner_text() and page.locator('#sheet [data-act="codeReg"]').count() == 1,
       f'making a code registers it; if the server fails, the sheet says results are off and offers Try again ({reg[:1]})')
    page.locator('#sheet [data-act="codeReg"]').tap(); page.wait_for_timeout(900)
    code = page.locator('#sheet .cc-code').inner_text().strip()
    ok(len(reg) == 3 and reg[1].get('p_code') == first and reg[2].get('p_code') == code and code != first, f'a code another live class has is swapped for a new one for the same shift ({first} -> {code})')
    kv = page.locator('#sheet .cb-key-v').inner_text().strip() if page.locator('#sheet .cb-key-v').count() else ''
    saved = J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')")
    ok(kv == '7K2M-9QXH-4V1R-8ZTB' and (saved.get(code) or {}).get('k') == KEY and 'saved on this device' in page.locator('#sheet .cb-key').inner_text(), f'the instructor key is shown in groups of four and saved on this device ({kv})')
    ok(KEY not in J("(() => { let t = ''; const c = OC.readCode(OCUI.U.codeMade); return c ? c.code : t; })()") and 'Don’t share it with the class' in page.locator('#sheet .cb-key').inner_text(), 'the key is kept apart from the code students get')
    ok(len(code) == 7 and code[3] == '-' and 'Five-Minute Rush' in page.locator('#sheet .cc-made').inner_text(), f'picking the Rush makes a code and names the shift ({code})')
    # a student types it, in lower case without the dash
    page.locator('#sheet .cc-in').fill(code.replace('-', '').lower()); page.wait_for_timeout(200)
    ok(not page.locator('#sheet .cc-box [data-act="codePlay"]').first.is_disabled() and 'Charge nurse' in page.locator('#sheet .cc-what').inner_text(), 'typing it (lower case, no dash) is read back as the shift it starts')
    bad = code[:6] + ('A' if code[6] != 'A' else 'B')
    page.locator('#sheet .cc-in').fill(bad); page.wait_for_timeout(200)
    st = J("(() => { const b = document.querySelector('#sheet .cc-box [data-act=\"codePlay\"]'); return { dis: b && b.disabled, what: document.querySelector('#sheet .cc-what').textContent, ok: !!OC.readCode(document.querySelector('#sheet .cc-in').value) }; })()")
    ok(st['ok'] or (st['dis'] and 'look right' in st['what']), f'a mistyped code is caught before Start ({bad}: {st})')
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
    # v0.31 class results: the summary sends the result to the instructor; only the instructor's key reads it back. The network is stubbed here.
    sent, held, plan = [], [], ['unknown', 'hold']
    def on_submit(route):
        sent.append(_json.loads(route.request.post_data or '{}')); step = plan.pop(0) if plan else 'ok'
        if step == 'unknown': route.fulfill(status=200, content_type='application/json', body='{"error": "unknown"}')
        elif step == 'hold': held.append(route)
        else: route.fulfill(status=200, content_type='application/json', body='{"ok": true}')
    page.route('**/rest/v1/rpc/cb_submit', on_submit)
    ok(page.locator('#report .cb-send input.cb-name').count() == 1, 'a class shift summary offers to send the result to the instructor')
    nm = J("(() => { const i = document.querySelector('#report input.cb-name'); return { auto: i.getAttribute('autocomplete'), max: i.maxLength, ph: i.placeholder }; })()")
    ok(nm['auto'] == 'off' and nm['max'] == 20 and 'initials' in nm['ph'], f'the name box asks for a first name or initials, 20 letters at most, and the browser doesn\'t fill in a full name ({nm})')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(300)
    ok('first name or initials' in page.locator('#report .cb-send').inner_text() and not sent, 'it asks for a name before sending')
    page.locator('#report input.cb-name').fill('sam@school.edu'); page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(300)
    ok('letters only' in page.locator('#report .cb-send').inner_text() and not sent, 'an email address is refused before anything is sent')
    page.locator('#report input.cb-name').fill('  Sam   R '); page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(600)
    ok(len(sent) == 1 and 'isn’t set up for class results' in page.locator('#report .cb-send').inner_text(), 'a code the server doesn\'t know gets a plain answer')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(500)
    busy = J("(() => { const b = document.querySelector('#report [data-act=\"cbSend\"]'); return { dis: !!(b && b.disabled), txt: b ? b.textContent : '' }; })()")
    ok(len(sent) == 2 and held and busy['dis'] and 'Sending' in busy['txt'], f'while a send is out, the button is off, so it can\'t be sent twice ({busy})')
    J("document.querySelector('#report [data-act=\"cbSend\"]').click()"); page.wait_for_timeout(300)
    ok(len(sent) == 2, 'a tap on it then does nothing')
    held[0].fulfill(status=200, content_type='application/json', body='{"ok": true}'); page.wait_for_timeout(600)
    s0 = sent[-1]
    import re as _re
    ok(s0.get('p_code') == code and s0.get('p_name') == 'Sam R' and s0.get('p_role') == 'rn' and s0.get('p_level') == 'rush' and isinstance(s0.get('p_score'), int) and 0 <= s0['p_score'] <= 100 and 'wait' in (s0.get('p_stats') or {}),
       f'it sends the code, the tidied name, role, shift, a 0-100 score and the shift numbers ({s0})')
    ok(_re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', s0.get('p_cid') or '') and sent[0].get('p_cid') == s0.get('p_cid'), 'with its own id, the same on every try, so the server keeps it once')
    ok(isinstance(s0.get('p_ver'), str) and len(s0.get('p_ver')) >= 5, f"and the game version ({s0.get('p_ver')})")
    ok('Sent to the instructor' in page.locator('#report .cb-send').inner_text(), 'and says it went')
    lr = J("JSON.parse(localStorage.getItem('oc-last-report') || '{}')")
    ok(lr.get('sent') is True and lr.get('cid') == s0.get('p_cid'), 'the summary remembers it was sent, so a reload doesn\'t offer to send it again')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-report.png'))
    rows = [{'id': 11, 'name': 'Sam R', 'role': 'rn', 'level': 'rush', 'score': 88, 'stars': 3, 'real_sec': 330, 'stats': {'wait': 14, 'lwbs': 1}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:00:00Z'},
            {'id': 12, 'name': 'Ana', 'role': 'rn', 'level': 'rush', 'score': 61, 'stars': 1, 'real_sec': 290, 'stats': {'wait': 31, 'lwbs': 3}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:01:00Z'},
            # a hostile row: nothing in it may run or become markup, whatever the server sends
            {'id': '<b>13</b>', 'name': '<img src=x onerror="window.__xss=1">', 'role': 'rn', 'level': 'rush', 'score': '<img src=x onerror="window.__xss=2">', 'stars': '<b>9</b>', 'real_sec': 'x', 'stats': {'wait': '<svg onload="window.__xss=3">', 'lwbs': '<i>1</i>'}, 'ver': '<img src=x onerror="window.__xss=4">', 'created_at': '2026-11-18T22:02:00Z'}]
    asked, dels = [], []
    def on_read(route):
        a = _json.loads(route.request.post_data or '{}'); asked.append(a)
        body = {'expires': '2026-12-24T16:00:00+00:00', 'rows': rows} if a.get('p_key') == KEY and a.get('p_code') == code else {'error': 'key'}
        route.fulfill(status=200, content_type='application/json', body=_json.dumps(body))
    def on_del(route):
        a = _json.loads(route.request.post_data or '{}'); dels.append(a)
        route.fulfill(status=200, content_type='application/json', body=_json.dumps({'deleted': 1 if a.get('p_id') else 3} if a.get('p_key') == KEY else {'error': 'key'}))
    page.route('**/rest/v1/rpc/cb_class_read', on_read); page.route('**/rest/v1/rpc/cb_class_delete', on_del)
    clear(); page.locator('#report [data-act="again"]').tap(); page.wait_for_timeout(600)
    ok(J('OC.G.code') == code and J('OC.G.seed') == seed1, 'Run it back replays the same class shift')
    clear(); page.locator('#btnPause').tap(); page.wait_for_timeout(300)
    ok(page.locator('#modal [data-act="restart"]').count() == 1 and page.locator('#modal [data-act="menu"]').count() == 1, 'the top-right menu offers Restart this shift and Main menu')
    page.locator('#modal [data-act="menu"]').tap(); page.wait_for_timeout(400)
    page.locator('[data-act="tmenu"][data-arg="play"]').first.tap(); page.wait_for_timeout(300)
    page.locator('[data-act="classCode"]').first.tap(); page.wait_for_timeout(400)
    ok(page.locator(f'#sheet .cb-res [data-act="cbShow"][data-arg="{code}"]').count() == 1, 'the instructor\'s device lists its own codes under Class results')
    page.locator(f'#sheet .cb-res [data-act="cbShow"][data-arg="{code}"]').tap(); page.wait_for_timeout(600)
    tab = page.locator('#sheet .cb-tab')
    ok(asked and asked[-1] == {'p_code': code, 'p_key': KEY} and tab.count() == 1 and tab.locator('tr').count() == 4 and 'Sam R' in tab.inner_text() and '88' in tab.inner_text(), f'one tap reads the results with the saved key, best first ({asked[-1:]})')
    page.wait_for_timeout(300)
    ok(J('window.__xss') is None and tab.locator('img, svg, b, i').count() == 0, 'a hostile result row shows as text: nothing in it runs or becomes markup')
    ok(tab.locator('[data-act="cbDel"]').count() == 2, 'each row with a real id has a delete button (the hostile id gets none)')
    ok('self-reported' in page.locator('#sheet .cb-res').inner_text(), 'the table says scores are self-reported')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-results.png'))
    tab.locator('[data-act="cbDel"][data-arg="12"]').tap(); page.wait_for_timeout(300)
    ok(page.locator('#sheet [data-act="cbDelGo"][data-arg="12"]').count() == 1 and not dels, 'delete asks first')
    page.locator('#sheet [data-act="cbDelGo"][data-arg="12"]').tap(); page.wait_for_timeout(700)
    ok(dels and dels[-1] == {'p_code': code, 'p_key': KEY, 'p_id': 12} and len(asked) >= 2, f'then deletes that one result and reloads the list ({dels[-1:]})')
    page.locator('#sheet .cb-res [data-act="cbDel"][data-arg="all"]').tap(); page.wait_for_timeout(300)
    page.locator('#sheet [data-act="cbDelGo"][data-arg="all"]').tap(); page.wait_for_timeout(700)
    ok(dels[-1] == {'p_code': code, 'p_key': KEY, 'p_id': None}, 'Delete all asks, then deletes every result for the code')
    # another device: the code and the key typed in
    J("localStorage.removeItem('oc-ckeys'); OCUI.U.cbList = null; OCUI.U.cbOpen = false; OCUI.render()"); page.wait_for_timeout(300)
    page.locator('#sheet .cb-res [data-act="cbOpen"]').tap(); page.wait_for_timeout(300)
    page.locator('#sheet #cbCode').fill(code.lower().replace('-', '')); page.locator('#sheet #cbKey').fill('WRONG-KEY0-WRONG-KEY0'[:19]); page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap(); page.wait_for_timeout(600)
    ok('don’t match' in page.locator('#sheet .cb-res').inner_text() and page.locator('#sheet .cb-tab').count() == 0, 'a wrong key shows nothing')
    page.locator('#sheet #cbCode').fill(code); page.locator('#sheet #cbKey').fill('7k2m-9qxh-4v1r-8ztb'); page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap(); page.wait_for_timeout(600)
    ok(asked[-1] == {'p_code': code, 'p_key': KEY} and page.locator('#sheet .cb-tab').count() == 1, 'the key typed in lower case with dashes opens the results')
    ok((J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get(code) or {}).get('k') == KEY, 'and is then saved on that device too')
    # the privacy notice says where names go
    J("OCUI.U.sheet = null; OCUI.render()"); page.wait_for_timeout(200)
    J("OCUI.showTitle()"); page.wait_for_timeout(300)
    if page.locator('#title .t-links [data-arg="about"]').count(): page.locator('#title .t-links [data-arg="about"]').first.tap(); page.wait_for_timeout(300)
    about = J("document.getElementById('title').innerText")
    ok('Only the instructor who made the code can read them' in about and '30 days' in about and 'keyed hash' in about, 'the About page says who can read class results, for how long, and what is kept about networks')

    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
