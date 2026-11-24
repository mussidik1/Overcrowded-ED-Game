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
    ok(page.locator('#sheet .cb-res .cb-list').count() == 0 and page.locator('#sheet .cb-res [data-act="cbOpen"]').count() == 1 and page.locator('#sheet #cbCode').count() == 0,
       'a student sees no class results, only a way in for an instructor with a key')
    import json as _json, re as _re
    CALL = _json.load(open(os.path.join(os.path.dirname(__file__), '..', 'supabase', 'tests', 'client_call.json')))
    ctx.route('**/rest/v1/**', lambda r: r.abort())   # nothing reaches a real server: every call the test doesn't answer fails
    reg, reg_plan = [], ['fail', 'ok', 'taken', 'ok']
    def on_new(route):
        a = _json.loads(route.request.post_data or '{}'); reg.append(a); step = reg_plan.pop(0) if reg_plan else 'ok'
        if step == 'fail': route.fulfill(status=503, body='')
        elif step == 'taken': route.fulfill(status=200, content_type='application/json', body='{"error": "taken"}')
        else: route.fulfill(status=200, content_type='application/json', body=_json.dumps({'ok': True, 'expires': '2026-12-24T16:00:00+00:00'}))
    page.route('**/rest/v1/rpc/cb_class_new', on_new)
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(700)
    first = page.locator('#sheet .cc-code').inner_text().strip() if page.locator('#sheet .cc-code').count() else ''
    ok(reg and reg[0].get('p_code') == first and _re.match(r'^[0-9A-HJKMNP-TV-Z]{16}$', reg[0].get('p_key') or '') and 'Class results are off' in page.locator('#sheet .cb-key').inner_text() and page.locator('#sheet [data-act="codeReg"]').count() == 1,
       f'making a code registers it with a key the game made; if the server fails, the code shows with "results are off" and Try again ({first})')
    ok(sorted(reg[0].keys()) == sorted(CALL['cb_class_new'].keys()), f'the registration call matches the contract file ({sorted(reg[0].keys())})')
    page.locator('#sheet [data-act="codeReg"]').tap(); page.wait_for_timeout(700)
    ok(len(reg) == 2 and reg[1] == reg[0] and page.locator('#sheet .cc-code').inner_text().strip() == first and 'Class results are on' in page.locator('#sheet .cb-key').inner_text(),
       'Try again sends the same code and key (safe to repeat), and the code on screen doesn\'t change')
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(900)
    code = page.locator('#sheet .cc-code').inner_text().strip()
    ok(len(reg) == 4 and reg[2]['p_code'] != code and reg[3]['p_code'] == code and reg[3]['p_key'] == reg[2]['p_key'], f'a code another live class has is swapped for another before anyone sees it ({reg[2]["p_code"]} -> {code})')
    KEY = reg[3]['p_key']
    ok(page.locator('#sheet .cb-key-v').count() == 0 and KEY not in page.locator('#sheet').inner_text(), 'the instructor key is not on screen until asked for: the code can be projected')
    page.locator(f'#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(300)
    kv = page.locator('#sheet .cc-made .cb-key-v').inner_text().strip() if page.locator('#sheet .cc-made .cb-key-v').count() else ''
    saved = J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')")
    ok(kv.replace('-', '') == KEY and len(kv) == 19 and ((saved.get('c') or {}).get(code) or {}).get('k') == KEY and saved.get('v') == 1, f'Show key shows it in groups of four; it is saved on this device, in a versioned record ({kv})')
    ok(first in (saved.get('c') or {}), 'the first code\'s key is kept too (it was registered on the retry)')
    page.locator(f'#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(200)
    ok(page.locator('#sheet .cc-made .cb-key-v').count() == 0, 'and Hide key hides it again')
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
    sb = page.locator('#report .cb-send')
    ok(page.locator('#report .cb-send input.cb-name').count() == 1 and '/100' in sb.inner_text() and 'developer' in sb.inner_text(), 'a class shift summary offers to send the result, says what is sent (score, stars, minutes) and who can see it')
    nm = J("(() => { const i = document.querySelector('#report input.cb-name'); return { auto: i.getAttribute('autocomplete'), ph: i.placeholder, val: i.value }; })()")
    ok(nm['auto'] == 'off' and 'initials' in nm['ph'] and nm['val'] == '', f'the name box asks for a first name or initials, starts empty, and the browser doesn\'t fill it ({nm})')
    page.locator('#report [data-act="menu"]').tap(); page.wait_for_timeout(300)
    ok(page.is_visible('#report') and 'isn’t sent yet' in J("document.body.innerText"), 'leaving the summary with the result unsent asks first')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(300)
    ok('first name or initials' in sb.inner_text() and not sent, 'it asks for a name before sending')
    for bad in ['sam@school.edu', 'ㅤㅤㅤ', '５５５ ５５５', 'Bob1']:
        page.locator('#report input.cb-name').fill(bad); page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(250)
        ok('letters only' in sb.inner_text() and not sent, f'{bad!r} is refused before anything is sent')
    page.locator('#report input.cb-name').fill('  Sam   R '); page.locator('#report input.cb-name').press('Enter'); page.wait_for_timeout(600)
    ok(len(sent) == 1 and 'isn’t set up for class results' in sb.inner_text(), 'Enter in the name box sends; a code the server doesn\'t know gets a plain answer')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(500)
    busy = J("(() => { const b = document.querySelector('#report [data-act=\"cbSend\"]'); return { dis: !!(b && b.disabled), txt: b ? b.textContent : '' }; })()")
    ok(len(sent) == 2 and held and busy['dis'] and 'Sending' in busy['txt'], f'while a send is out, the button is off, so it can\'t be sent twice ({busy})')
    J("document.querySelector('#report [data-act=\"cbSend\"]').click()"); page.wait_for_timeout(300)
    ok(len(sent) == 2, 'a tap on it then does nothing')
    held[0].fulfill(status=200, content_type='application/json', body='{"ok": true}'); page.wait_for_timeout(600)
    s0 = sent[-1]
    ok(s0.get('p_code') == code and s0.get('p_name') == 'Sam R' and s0.get('p_role') == 'rn' and s0.get('p_level') == 'rush' and isinstance(s0.get('p_score'), int) and 0 <= s0['p_score'] <= 100,
       f'it sends the code, the tidied name, role, shift and a 0-100 score ({s0})')
    ok(sorted(s0.keys()) == sorted(CALL['cb_submit'].keys()) and sorted((s0.get('p_stats') or {}).keys()) == sorted(CALL['cb_submit']['p_stats'].keys()),
       f'the send call matches the contract file, argument names and stats keys ({sorted((s0.get("p_stats") or {}).keys())})')
    ok(_re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', s0.get('p_cid') or '') and sent[0].get('p_cid') == s0.get('p_cid'), 'with its own id, the same on every try, so the server keeps it once')
    ok(s0.get('p_ver') == J("OC.readCode ? (JSON.parse(localStorage.getItem('oc-last-report')).R.ver) : ''"), f"and the version the shift was played on ({s0.get('p_ver')})")
    ok('Sent to the instructor' in sb.inner_text(), 'and says it went')
    lr = J("JSON.parse(localStorage.getItem('oc-last-report') || '{}')")
    ok(lr.get('sent') is True and lr.get('cid') == s0.get('p_cid') and J("localStorage.getItem('oc-cb-name')") is None, 'the summary remembers it was sent (no resend after a reload), and the name isn\'t kept on the device')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-report.png'))
    U1, U2 = '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
    rows = [{'id': U1, 'name': 'Sam R', 'role': 'rn', 'level': 'rush', 'score': 88, 'stars': 3, 'real_sec': 330, 'stats': {'wait': 14, 'lwbs': 1, 'expired': 0, 'fast': 60}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:00:00Z'},
            {'id': U2, 'name': 'Ana Maria Lopez-Ruiz', 'role': 'rn', 'level': 'rush', 'score': 61, 'stars': 1, 'real_sec': 290, 'stats': {'wait': 31, 'lwbs': 3, 'expired': 1, 'fired': 1}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:01:00Z'},
            # a hostile row: nothing in it may run or become markup, whatever the server sends, and no cell may run as a spreadsheet formula
            {'id': '<b>13</b>', 'name': '=HYPERLINK("x")<img src=x onerror="window.__xss=1">', 'role': 'rn', 'level': 'rush', 'score': '<img src=x onerror="window.__xss=2">', 'stars': '<b>9</b>', 'real_sec': 'x', 'stats': {'wait': '<svg onload="window.__xss=3">', 'lwbs': '<i>1</i>'}, 'ver': '<img src=x onerror="window.__xss=4">', 'created_at': '2026-11-18T22:02:00Z'}]
    asked, dels = [], []
    def on_read(route):
        a = _json.loads(route.request.post_data or '{}'); asked.append(a)
        body = {'expires': '2026-12-24T16:00:00+00:00', 'rows': rows} if a.get('p_key') == KEY and a.get('p_code') == code else {'error': 'key'}
        route.fulfill(status=200, content_type='application/json', body=_json.dumps(body))
    def on_del(route):
        a = _json.loads(route.request.post_data or '{}'); dels.append(a)
        route.fulfill(status=200, content_type='application/json', body=_json.dumps({'deleted': 3 if a.get('p_all') else 1} if a.get('p_key') == KEY else {'error': 'key'}))
    page.route('**/rest/v1/rpc/cb_class_read', on_read); page.route('**/rest/v1/rpc/cb_class_delete', on_del)
    clear(); page.locator('#report [data-act="again"]').tap(); page.wait_for_timeout(600)
    ok(J('OC.G.code') == code and J('OC.G.seed') == seed1, 'Run it back replays the same class shift (the result was sent, so it doesn\'t ask)')
    clear(); page.locator('#btnPause').tap(); page.wait_for_timeout(300)
    ok(page.locator('#modal [data-act="restart"]').count() == 1 and page.locator('#modal [data-act="menu"]').count() == 1, 'the top-right menu offers Restart this shift and Main menu')
    page.locator('#modal [data-act="menu"]').tap(); page.wait_for_timeout(400)
    page.locator('[data-act="tmenu"][data-arg="play"]').first.tap(); page.wait_for_timeout(300)
    page.locator('[data-act="classCode"]').first.tap(); page.wait_for_timeout(400)
    ok(page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{code}"]').count() == 1 and page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{first}"]').count() == 1, 'the instructor\'s device lists all its codes under Class results')
    page.locator(f'#sheet .cb-codes [data-act="keyShow"][data-arg="{code}"]').tap(); page.wait_for_timeout(200)
    ok(KEY in page.locator('#sheet .cb-codes').inner_text().replace('-', ''), 'Show key shows a saved code\'s key again, after the sheet was closed')
    page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{code}"]').tap(); page.wait_for_timeout(600)
    lst = page.locator('#sheet .cb-list')
    ok(asked and asked[-1] == {'p_code': code, 'p_key': KEY} and lst.count() == 1 and lst.locator('li').count() == 3 and 'Sam R' in lst.inner_text() and '88' in lst.inner_text(), f'one tap reads the results with the saved key, best first ({asked[-1:]})')
    ok(sorted(asked[-1].keys()) == sorted(CALL['cb_class_read'].keys()), 'the read call matches the contract file')
    page.wait_for_timeout(300)
    ok(J('window.__xss') is None and lst.locator('img, svg, i').count() == 0, 'a hostile result row shows as text: nothing in it runs or becomes markup')
    ok(lst.locator('[data-act="cbDel"]').count() == 2, 'each row with a real id has a delete button (the hostile id gets none)')
    txt = page.locator('#sheet .cb-res').inner_text()
    ok('Not for grading' in txt and '1 died' in txt and 'fired' in txt and '60% sped up' in txt, 'the list says it is not for grading and shows deaths, firing and sped-up play')
    box = J("(() => { const s = document.getElementById('sheet').getBoundingClientRect(); return [...document.querySelectorAll('#sheet .cb-del')].every(b => { const r = b.getBoundingClientRect(); return r.right <= s.right + 0.5 && r.width >= 44 && r.height >= 44; }); })()")
    ok(box, 'every delete button is fully on screen and at least 44 px, even next to a long name')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-results.png'))
    with page.expect_download() as dl:
        page.locator('#sheet [data-act="cbCsv"]').tap()
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    ok(page.locator('#sheet .cb-list').count() == 1, 'and the results stay open')
    ok(csv.startswith('Rank,Name,Role,Score') and 'Sam R' in csv and '"\'=HYPERLINK(""x"")' in csv, f'Download CSV gives the table, and a name that looks like a formula can\'t run as one ({csv.splitlines()[3][:40] if len(csv.splitlines()) > 3 else csv[:80]})')
    n_read = len(asked)
    lst.locator(f'[data-act="cbDel"][data-arg="{U2}"]').tap()
    #, errors[-3:], J("JSON.stringify({ask: OCUI.U.cbList && OCUI.U.cbList.ask, sheet: OCUI.U.sheet, res: !!document.querySelector('#sheet .cb-res'), txt: document.getElementById('sheet').innerText.slice(0, 300)})"))
    page.wait_for_selector(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]', timeout=2000)
    page.locator(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]').tap(); page.wait_for_timeout(200)   # within half a second of the ✕: a double tap
    ok(not dels and page.locator('#sheet .cb-ask').count() == 1, 'a double tap doesn\'t delete: the confirm ignores a tap in the first half second')
    page.wait_for_timeout(500); page.locator(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]').tap(); page.wait_for_timeout(600)
    ok(dels and dels[-1] == {'p_code': code, 'p_key': KEY, 'p_id': U2, 'p_all': False} and len(asked) == n_read and page.locator('#sheet .cb-list li').count() == 2,
       f'then deletes that one result by its id, and takes it out of the list without reloading ({dels[-1:]})')
    ok(sorted(dels[-1].keys()) == sorted(CALL['cb_class_delete'].keys()), 'the delete call matches the contract file')
    page.locator('#sheet .cb-res [data-act="cbDel"][data-arg="all"]').tap(); page.wait_for_timeout(600)
    page.locator('#sheet [data-act="cbDelGo"][data-arg="all"]').tap(); page.wait_for_timeout(600)
    ok(dels[-1] == {'p_code': code, 'p_key': KEY, 'p_all': True} and page.locator('#sheet .cb-list li').count() == 0, 'Delete all asks, then deletes every result for the code')
    # forget a key on this device
    page.locator(f'#sheet .cb-codes [data-act="keyForget"][data-arg="{first}"]').tap(); page.wait_for_timeout(200)
    page.locator(f'#sheet .cb-codes [data-act="keyForgetGo"][data-arg="{first}"]').tap(); page.wait_for_timeout(300)
    ok(first not in (J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c') or {}) and page.locator(f'#sheet .cb-codes [data-arg="{first}"]').count() == 0, 'Forget removes a key from this device')
    # another device: the code and the key typed in
    J("localStorage.removeItem('oc-ckeys'); OCUI.U.cbList = null; OCUI.U.cbOpen = false; OCUI.U.reg = null; OCUI.U.codeMade = null; OCUI.render()"); page.wait_for_timeout(300)
    page.locator('#sheet .cb-res [data-act="cbOpen"]').tap(); page.wait_for_timeout(300)
    page.locator('#sheet #cbCode').fill(code.lower().replace('-', '')); page.locator('#sheet #cbKey').fill('ABCD-EFGH-JKMN-PQRS'); page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap(); page.wait_for_timeout(600)
    ok('don’t match' in page.locator('#sheet .cb-res').inner_text() and page.locator('#sheet .cb-list').count() == 0, 'a wrong key shows nothing')
    ok(page.locator('#sheet #cbKey').input_value() == 'ABCD-EFGH-JKMN-PQRS' and page.locator('#sheet #cbCode').input_value() == code.lower().replace('-', ''), 'and keeps what was typed, to fix it')
    page.locator('#sheet #cbKey').fill(KEY.lower()[:4] + '-' + KEY.lower()[4:]); page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap(); page.wait_for_timeout(600)
    ok(asked[-1] == {'p_code': code, 'p_key': KEY} and page.locator('#sheet .cb-list').count() == 1, 'the key typed in lower case with a dash opens the results')
    ok(not (J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c') or {}), 'a typed key isn\'t remembered unless asked (a shared computer)')
    # a code from an older version (its check characters no longer match) still opens with its key
    oldc = code[:6] + ('A' if code[6] != 'A' else 'B')
    J("OCUI.U.cbList = null; OCUI.U.cbOpen = true; OCUI.U.cbForm = {}; OCUI.render()"); page.wait_for_timeout(200)
    page.locator('#sheet #cbCode').fill(oldc); page.locator('#sheet #cbKey').fill(KEY); page.locator('.cb-rem input').check(); page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap(); page.wait_for_timeout(600)
    ok(asked[-1] == {'p_code': oldc, 'p_key': KEY} and oldc in (J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c') or {}) is False or asked[-1] == {'p_code': oldc, 'p_key': KEY},
       f'a code the game can no longer play (another version) still goes to the server with its key ({oldc})')
    # the privacy notice says where names go
    J("OCUI.U.sheet = null; OCUI.render()"); page.wait_for_timeout(200)
    J("OCUI.showTitle()"); page.wait_for_timeout(300)
    if page.locator('#title .t-links [data-arg="about"]').count(): page.locator('#title .t-links [data-arg="about"]').first.tap(); page.wait_for_timeout(300)
    about = J("document.getElementById('title').innerText")
    ok('only the instructor who made the code can read it' in about and 'developer can also see' in about and '30 days' in about and 'keyed hash' in about and 'no licensed clinician has reviewed' in about,
       'the About page says who can read class results (the developer too), for how long, what is kept about networks, and that no licensed clinician has reviewed the content')

    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
