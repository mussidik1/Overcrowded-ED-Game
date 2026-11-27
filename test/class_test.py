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
    reg, reg_plan = [], ['busy', 'full', 'abort', 'ok', 'taken', 'ok']
    CREATED = '2026-11-24T16:00:00+00:00'
    def on_new(route):
        a = _json.loads(route.request.post_data or '{}'); reg.append(a); step = reg_plan.pop(0) if reg_plan else 'ok'
        if step == 'fail': route.fulfill(status=503, body='')
        elif step == '429': route.fulfill(status=429, body='')
        elif step == 'abort': route.abort(); return
        elif step in ('taken', 'busy', 'full', 'invalid'): route.fulfill(status=200, content_type='application/json', body=_json.dumps({'error': step}))
        else: route.fulfill(status=200, content_type='application/json', body=_json.dumps({'ok': True, 'expires': '2026-12-08T16:00:00+00:00', 'created': CREATED}))   # 14 days: what the real function says for a new class
    ok(sorted(['ok', 'expires', 'created']) == sorted(CALL['responses']['cb_class_new']), 'the stubbed registration answer has the keys the contract lists')
    page.route('**/rest/v1/rpc/cb_class_new', on_new)
    names = J("(L) => [L.accept.filter(n => !OCUI.cbClean(n)), L.refuse.filter(n => OCUI.cbClean(n))]", CALL['names'])
    ok(names == [[], []], f'the game accepts and refuses the same names as the contract file says the database does ({names})')
    send = J("(L) => L.map(n => [n, !!OCUI.cbSendable(n)])", ['Sam', 'Ana M.', 'S.K.', 'J.D.', 'Mary-Kate', 'John Smith', 'John Q Smith', 'Ana Maria', 'Fuck', 'Dick', 'Dr. Who', 'Hitler'])
    ok([x[1] for x in send] == [True, True, True, True, True, False, False, False, False, True, False, False], f'Dick is a real first name (QA4-10); the game sends one first name, initials, or a first name and an initial; never a full name or profanity (owner, QA-2, QA-19): {send}')
    src_ui = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'ui.js'), encoding='utf-8').read()
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(700)
    first = reg[0].get('p_code') if reg else ''
    t = page.locator('#sheet .cc-box').nth(1).inner_text()
    ok(page.locator('#sheet .cc-code').count() == 0 and 'No class code yet' in t and 'too many requests' in t and 'mobile data' in t and page.locator('#sheet [data-act="codeReg"]').count() == 1 and page.locator('#sheet [data-act="codeNoRes"]').count() == 0,
       f'busy: no code is shown, the message says why, and Try again is offered; not "Use it without results", since someone else can cause a busy answer and claim the code (audit R3.8-01; {t[-160:]!r})')
    ok(J("getComputedStyle(document.querySelector('#sheet .cb-key.bad small')).color") in ('rgb(165, 29, 47)',) or 'No class code yet' in t, 'the failure reads as an error')
    ok(_re.match(r'^[0-9A-HJKMNP-TV-Z]{16}$', reg[0].get('p_key') or '') and sorted(reg[0].keys()) == sorted(CALL['calls']['cb_class_new'].keys()), f'making a code registers it with a key the game made; the call matches the contract file ({sorted(reg[0].keys())})')
    page.locator('#sheet [data-act="codeReg"]').tap(); page.wait_for_timeout(700)
    t = page.locator('#sheet .cc-box').nth(1).inner_text()
    ok(len(reg) == 2 and reg[1] == reg[0] and page.locator('#sheet .cc-code').count() == 0 and 'whole game' in t and page.locator('#sheet [data-act="codeNoRes"]').count() == 1,
       'full: still no code, the message says it\'s the whole service, and "Use it without results" is offered (nobody can register a code while full; R5.8-01)')
    page.locator('#sheet [data-act="codeReg"]').tap(); page.wait_for_timeout(700)
    ok(len(reg) == 3 and page.locator('#sheet .cc-code').count() == 0 and page.locator('#sheet [data-act="codeNoRes"]').count() == 1, 'a server that can\'t be reached: no code yet, with Try again and "Use it without results"')
    page.locator('#sheet [data-act="codeReg"]').tap(); page.wait_for_timeout(700)
    ok(len(reg) == 4 and reg[3] == reg[0] and page.locator('#sheet .cc-code').inner_text().strip() == first and 'Class results are on' in page.locator('#sheet .cb-key').inner_text(),
       'Try again sends the same code and key (safe to repeat), and the code shows only once the server has it')
    ck = J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c', {}).get(first, {})
    ok(ck.get('t') == J(f"Date.parse('{CREATED}')") and ck.get('e') == J("Date.parse('2026-12-08T16:00:00+00:00')") and ck.get('s') == 1 and not ck.get('p'), f'the device keeps when the server made the class and when it ends ({ck})')
    page.locator('#sheet [data-act="codeMake"][data-arg="rush"]').tap(); page.wait_for_timeout(300)
    ok(page.locator('#sheet #codeAsk').count() == 1 and page.locator('#sheet .cc-code').inner_text().strip() == first and len(reg) == 4, 'a shift tapped while a code is on screen asks first: the code on the projector doesn\'t change on a stray tap')
    page.locator('#sheet [data-act="codeMakeGo"]').tap(); page.wait_for_timeout(900)
    code = page.locator('#sheet .cc-code').inner_text().strip()
    ok(len(reg) == 6 and reg[4]['p_code'] != code and reg[5]['p_code'] == code and reg[5]['p_key'] == reg[4]['p_key'], f'a code another live class has is swapped for another before anyone sees it ({reg[4]["p_code"]} -> {code})')
    KEY = reg[5]['p_key']
    ok(page.locator('#sheet .cb-key-v').count() == 0 and KEY not in page.locator('#sheet').inner_text(), 'the instructor key is not on screen until asked for: the code can be projected')
    page.locator(f'#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(300)
    kv = page.locator('#sheet .cc-made .cb-key-v').inner_text().strip() if page.locator('#sheet .cc-made .cb-key-v').count() else ''
    saved = J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')")
    ok(kv.replace('-', '') == KEY and len(kv) == 19 and ((saved.get('c') or {}).get(code) or {}).get('k') == KEY and saved.get('v') == 1 and not ((saved.get('c') or {}).get(code) or {}).get('p'), f'Show key shows it in groups of four; it is saved on this device, confirmed, in a versioned record ({kv})')
    ok(first in (saved.get('c') or {}), 'the first code\'s key is kept too (it was registered on the retry)')
    page.locator(f'#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(200)
    ok(page.locator('#sheet .cc-made .cb-key-v').count() == 0, 'and Hide key hides it again')
    J("(() => { const o = JSON.parse(localStorage.getItem('oc-ckeys')); for (const c of Object.keys(o.c)) o.c[c].t -= 20 * 864e5; localStorage.setItem('oc-ckeys', JSON.stringify(o)); })()")
    ok(code in J("Object.keys(OCUI.U && JSON.parse(localStorage.getItem('oc-ckeys')).c)") and page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{code}"]').count() == 1, 'a key made 20 days ago is still listed (a class with results lives 30 days)')
    J("(() => { const o = JSON.parse(localStorage.getItem('oc-ckeys')); for (const c of Object.keys(o.c)) o.c[c].t += 20 * 864e5; localStorage.setItem('oc-ckeys', JSON.stringify(o)); })()")
    page.locator(f'#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(150)
    J("OCUI.U.sheet = null; OCUI.render()"); page.locator('#title [data-act="classCode"]').tap(); page.wait_for_timeout(400)
    ok(page.locator('#sheet .cb-key-v').count() == 0, 'a key left showing is hidden again when the sheet is opened again (a projector)')
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
    sent, held, plan = [], [], ['unknown', 'busy', 'fullclass', 'fullall', 'badname', 'hold']
    def on_submit(route):
        sent.append(_json.loads(route.request.post_data or '{}')); step = plan.pop(0) if plan else 'ok'
        if step == 'unknown': route.fulfill(status=200, content_type='application/json', body='{"error": "unknown"}')
        elif step == 'busy': route.fulfill(status=200, content_type='application/json', body='{"error": "busy"}')
        elif step == 'fullclass': route.fulfill(status=200, content_type='application/json', body='{"error": "full", "scope": "class"}')
        elif step == 'fullall': route.fulfill(status=200, content_type='application/json', body='{"error": "full", "scope": "all"}')
        elif step == 'badname': route.fulfill(status=200, content_type='application/json', body='{"error": "invalid", "field": "name"}')
        elif step == 'hold': held.append(route)
        else: route.fulfill(status=200, content_type='application/json', body='{"ok": true}')
    page.route('**/rest/v1/rpc/cb_submit', on_submit)
    sb = page.locator('#report .cb-send')
    ok(page.locator('#report .cb-send input.cb-name').count() == 1 and '/100' in sb.inner_text() and 'developer' in sb.inner_text(), 'a class shift summary offers to send the result, says what is sent (score, stars, minutes) and who can see it')
    nm = J("(() => { const i = document.querySelector('#report input.cb-name'); return { auto: i.getAttribute('autocomplete'), ph: i.placeholder, val: i.value }; })()")
    ok(nm['auto'] == 'off' and 'initials' in nm['ph'] and nm['val'] == '', f'the name box asks for a first name or initials, starts empty, and the browser doesn\'t fill it ({nm})')
    page.locator('#report [data-act="menu"]').tap(); page.wait_for_timeout(300)
    ok(page.is_visible('#report') and 'Not sent yet' in sb.inner_text(), 'leaving the summary with the result unsent asks first, in the Send box')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(300)
    ok('first name or initials' in sb.inner_text() and not sent, 'it asks for a name before sending')
    for bad, why in [('sam@school.edu', 'letters only'), ('ㅤㅤㅤ', 'hidden character'), ('５５５ ５５５', 'No numbers'), ('Bob1', 'No numbers'), ('Abcdefghijklmnopqrstuv', 'At most 20')]:
        page.locator('#report input.cb-name').fill(bad); page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(250)
        ok(why in sb.inner_text() and not sent, f'{bad!r} is refused before anything is sent, saying why ({why})')
    # typed with the keyboard, refused, then fixed: the caret is at the end, so Backspace edits the name (audit R4.6-02)
    page.locator('#report input.cb-name').fill(''); page.locator('#report input.cb-name').press_sequentially('Sam 2', delay=30); page.locator('#report input.cb-name').press('Enter'); page.wait_for_timeout(250)
    ok(J("document.getElementById('cbName').getAttribute('aria-invalid')") == 'true' and J("document.getElementById('cbName').getAttribute('aria-describedby')") == 'cbNameErr', 'a refused name is marked invalid and linked to its message')
    page.keyboard.press('Backspace'); page.keyboard.press('Backspace'); page.wait_for_timeout(100)
    ok(page.locator('#report input.cb-name').input_value() == 'Sam' and J("document.activeElement && document.activeElement.id") == 'cbName' and J("document.getElementById('cbName').getAttribute('aria-invalid')") is None and page.locator('#cbNameErr').count() == 0,
       f'after a refusal the box keeps focus with the caret at the end, and fixing the name clears the refusal ({page.locator("#report input.cb-name").input_value()!r})')
    page.locator('#report input.cb-name').press_sequentially(' 2', delay=30); page.locator('#report input.cb-name').press('Enter'); page.wait_for_timeout(250)
    ok(page.locator('#cbNameErr').count() == 1 and 'No numbers' in page.locator('#cbNameErr').inner_text(), 'the same refused name sent again shows its refusal again (audit R4.8-02)')
    page.locator('#report input.cb-name').fill('')
    page.locator('#report input.cb-name').fill('  Sam   R ')
    with page.expect_request('**/rpc/cb_submit'): page.locator('#report input.cb-name').press('Enter')
    page.wait_for_timeout(400)
    ok(len(sent) == 1 and 'isn’t set up for class results' in sb.inner_text(), 'Enter in the name box sends; a code the server doesn\'t know gets a plain answer')
    ok(J("document.activeElement && document.activeElement.id") == 'cbName', 'and the name box keeps the focus (and the phone its keyboard) after a refusal')
    for want, what in [('too many requests', 'busy'), ('500', 'a full class'), ('whole game', 'the whole service full'), ('didn’t accept that name', 'a name the server refuses')]:
        page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(400)
        ok(want in sb.inner_text(), f'{what} gets its own message ({want!r})')
    page.locator('#report [data-act="cbSend"]').tap(); page.wait_for_timeout(500)
    busy = J("(() => { const b = document.querySelector('#report [data-act=\"cbSend\"]'); return { dis: !!(b && b.disabled), txt: b ? b.textContent : '' }; })()")
    ok(len(sent) == 6 and held and busy['dis'] and 'Sending' in busy['txt'], f'while a send is out, the button is off, so it can\'t be sent twice ({busy})')
    J("document.querySelector('#report [data-act=\"cbSend\"]').click()"); page.wait_for_timeout(300)
    ok(len(sent) == 6, 'a tap on it then does nothing')
    held[0].fulfill(status=200, content_type='application/json', body='{"ok": true}'); page.wait_for_timeout(600)
    s0 = sent[-1]
    ok(s0.get('p_code') == code and s0.get('p_name') == 'Sam R' and s0.get('p_role') == 'rn' and s0.get('p_level') == 'rush' and isinstance(s0.get('p_score'), int) and 0 <= s0['p_score'] <= 100,
       f'it sends the code, the tidied name, role, shift and a 0-100 score ({s0})')
    ok(sorted(s0.keys()) == sorted(CALL['calls']['cb_submit'].keys()) and sorted((s0.get('p_stats') or {}).keys()) == sorted(CALL['calls']['cb_submit']['p_stats'].keys()),
       f'the send call matches the contract file, argument names and stats keys ({sorted((s0.get("p_stats") or {}).keys())})')
    ok(_re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', s0.get('p_cid') or '') and sent[0].get('p_cid') == s0.get('p_cid'), 'with its own id, the same on every try, so the server keeps it once')
    ok(s0.get('p_ver') == J("OC.readCode ? (JSON.parse(localStorage.getItem('oc-last-report')).R.ver) : ''"), f"and the version the shift was played on ({s0.get('p_ver')})")
    ok('Sent to the instructor' in sb.inner_text(), 'and says it went')
    lr = J("JSON.parse(localStorage.getItem('oc-last-report') || '{}')")
    ok(lr.get('sent') is True and lr.get('cid') == s0.get('p_cid') and J("localStorage.getItem('oc-cb-name')") is None and J("OCUI.U.cbName") == '', 'the summary remembers it was sent (no resend after a reload), and the name isn\'t kept, not even for the next student in this tab')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-report.png'))
    U1, U2 = '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
    U3 = '33333333-3333-4333-8333-333333333333'
    rows = [{'id': U1, 'name': 'Sam R', 'role': 'rn', 'level': 'rush', 'score': 88, 'stars': 3, 'real_sec': 330, 'stats': {'wait': 14, 'lwbs': 1, 'expired': 0, 'fast': 60}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:03:00Z'},
            {'id': U2, 'name': 'Ana Maria Lopez-Ruiz', 'role': 'rn', 'level': 'rush', 'score': 61, 'stars': 1, 'real_sec': 290, 'stats': {'wait': 31, 'lwbs': 3, 'expired': 1, 'walkout': 1}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:01:00Z'},
            {'id': U3, 'name': 'Sam R', 'role': 'rn', 'level': 'rush', 'score': 95, 'stars': 3, 'real_sec': 300, 'stats': {'wait': 9, 'lwbs': 0, 'expired': 0}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:05:00Z'},
            {'id': '44444444-4444-4444-8444-444444444444', 'name': 'Ida', 'role': 'md', 'level': 'rush', 'score': 70, 'stars': 2, 'real_sec': 320, 'stats': {'wait': 12, 'lwbs': 1, 'expired': 2, 'mdSeen': 4, 'mdDied': 1, 'dxRight': 3, 'dxWrong': 1, 'harm': 2, 'contra': 1, 'unneeded': 2, 'radioRight': 3, 'radioWrong': 1, 'radioMiss': 1, 'fired': 1, 'endMin': 301}, 'ver': '0.31.0', 'created_at': '2026-11-18T22:06:00Z'},
            # a hostile row: nothing in it may run or become markup, whatever the server sends, and no cell may run as a spreadsheet formula
            {'id': '<b>13</b>', 'name': '=HYPERLINK("x")<img src=x onerror="window.__xss=1">', 'role': 'rn', 'level': 'rush', 'score': '<img src=x onerror="window.__xss=2">', 'stars': '<b>9</b>', 'real_sec': 'x', 'stats': {'wait': '<svg onload="window.__xss=3">', 'lwbs': '<i>1</i>'}, 'ver': '<img src=x onerror="window.__xss=4">', 'created_at': '2026-11-18T22:02:00Z'}]
    asked, dels, read_hold, read_busy, del_busy = [], [], [], [], []
    ok(sorted(rows[0].keys()) == sorted(CALL['responses']['cb_class_read_row']) and sorted(['expires', 'created', 'rows']) == sorted(CALL['responses']['cb_class_read']), 'the stubbed read answer and its rows have the keys the contract lists')
    def on_read(route):
        a = _json.loads(route.request.post_data or '{}'); asked.append(a)
        body = {'expires': '2026-12-24T16:00:00+00:00', 'created': CREATED, 'rows': rows} if a.get('p_key') == KEY and a.get('p_code') == code else {'error': 'key'}
        if read_hold: read_hold.append(route); return
        if read_busy: read_busy.pop(); body = {'error': 'busy'}
        route.fulfill(status=200, content_type='application/json', body=_json.dumps(body))
    def on_del(route):
        a = _json.loads(route.request.post_data or '{}'); dels.append(a)
        if del_busy: del_busy.pop(); route.fulfill(status=200, content_type='application/json', body='{"error": "busy"}'); return
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
    if J("OCUI.U.codeMade") == code:   # the code still on screen: its key buttons are with the code, not in its row (audit R4.9-10)
        ok(page.locator(f'#sheet .cb-codes [data-act="keyShow"][data-arg="{code}"]').count() == 0 and page.locator('#sheet .cc-made [data-act="keyShow"]').count() == 1, 'the code on screen has one Show key, with the code, not a second in its row')
        page.locator('#sheet .cc-made [data-act="keyShow"]').tap(); page.wait_for_timeout(200)
    else: page.locator(f'#sheet .cb-codes [data-act="keyShow"][data-arg="{code}"]').tap(); page.wait_for_timeout(200)
    ok(KEY in page.locator('#sheet').inner_text().replace('-', '') and page.locator('#sheet .cb-key-v').count() == 1, 'Show key shows a saved code\'s key again, after the sheet was closed (once, not twice)')
    page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{code}"]').tap(); page.wait_for_timeout(600)
    lst = page.locator('#sheet .cb-list')
    order = J("[...document.querySelectorAll('#sheet .cb-list .cb-nm')].map(e => e.textContent)")
    ok(asked and asked[-1] == {'p_code': code, 'p_key': KEY} and lst.count() == 1 and lst.locator('li').count() == 5 and order[0].startswith('Ana') and order[1].startswith('=HYPERLINK') and order[2] == 'Sam R (1 of 2 under this name)' and order[3] == 'Sam R (2 of 2 under this name)' and not any(o[:2].strip('. ').isdigit() for o in order),
       f'one tap reads the results with the saved key, in the order they came in, unranked, with a repeated name marked on both rows ({order})')
    ida = lst.locator('li').nth(4).inner_text()
    ok('saw 4 patients (1 of them died)' in ida and 'unsafe orders 3 (complications, partly chance: 1)' in ida and 'radio calls 3 of 5 right, 1 wrong, 1 missed' in ida and 'department:' in ida and 'fired (legal risk)' in ida and 'at 12:01 (these numbers cover only the part played)' in ida,
       f'an attending\'s row: their own patients and deaths, unsafe orders, radio calls out of those offered, the department labelled, and when a fired shift ended ({ida!r})')
    hdr = J("(() => { const h = document.getElementById('cbHead'), r = h && h.getBoundingClientRect(); return r ? [r.top, innerHeight] : null; })()")
    ok(hdr and 0 <= hdr[0] < hdr[1] * 0.4, f'the results scroll in with their header near the top, so the first rows show ({hdr})')
    ok(J("(() => { const h = document.getElementById('cbHead'), r = h && h.getBoundingClientRect(); return !!r && r.top >= 0 && r.top < innerHeight; })()"), 'and the results scroll into view')
    ok(sorted(asked[-1].keys()) == sorted(CALL['calls']['cb_class_read'].keys()), 'the read call matches the contract file')
    page.wait_for_timeout(300)
    ok(J('window.__xss') is None and lst.locator('img, svg, i').count() == 0, 'a hostile result row shows as text: nothing in it runs or becomes markup')
    ok(lst.locator('[data-act="cbDel"]').count() == 4, 'each row with a real id has a delete button (the hostile id gets none)')
    rowh = J("[...document.querySelectorAll('#sheet .cb-row')].map(r => Math.round(r.getBoundingClientRect().height))")
    ok(J("[...document.querySelectorAll('#sheet .cb-row')].every(r => { const d = (r.querySelector('.cb-del') || r.querySelector('.cb-del-gap')).getBoundingClientRect(), m = r.querySelector('.cb-main').getBoundingClientRect(); return m.top < d.bottom && m.left >= d.right; })"),
       f'each ✕ sits beside its name, not on a line of its own ({rowh})')
    txt = page.locator('#sheet .cb-res').inner_text()
    ana = lst.locator('li').nth(0).inner_text()
    ok('Not for grading' in txt and 'no licensed clinician' in txt and '1 died' in ana and 'staff walked out' in ana and 'fired' not in ana and '60% sped up' in txt and 'Radio calls differ' in txt, f'the list says it is not for grading or clinically reviewed (and that radio calls differ), and shows deaths, a staff walkout (not "fired") and sped-up play ({ana!r})')
    box = J("(() => { const s = document.getElementById('sheet').getBoundingClientRect(); return [...document.querySelectorAll('#sheet .cb-del')].every(b => { const r = b.getBoundingClientRect(); return r.right <= s.right + 0.5 && r.width >= 44 && r.height >= 44; }); })()")
    ok(box, 'every delete button is fully on screen and at least 44 px, even next to a long name')
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'class-results.png'))
    with page.expect_download() as dl:
        page.locator('#sheet [data-act="cbCsv"]').tap()
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    ok(page.locator('#sheet .cb-list').count() == 1, 'and the results stay open')
    lines = csv.splitlines()
    ok('Not for grading' in lines[0] and lines[2].startswith('Name,Same name (n of total),Role,Score') and 'Rank' not in csv and 'Sam R' in csv and '"\'=HYPERLINK(""x"")' in csv, f'Download CSV carries the caveats, has no rank, and a name that looks like a formula can\'t run as one ({lines[2][:40] if len(lines) > 2 else csv[:80]})')
    import csv as _csv
    tab = list(_csv.reader(lines[2:])); hd = tab[0]; idr = next(r for r in tab if r and r[0] == 'Ida')
    ok(idr[hd.index('Radio missed')] == '1' and idr[hd.index('Unsafe orders')] == '3' and idr[hd.index('Own patients died (attending)')] == '1' and idr[hd.index('Ended at')] == '12:01', f'the export carries missed radio calls, unsafe orders, the attending\'s own deaths and the end time ({dict(zip(hd, idr))})')
    # a delete the server refuses says so in that row, where the finger is, and the row stays (audit R4.7-04)
    del_busy.append(1); lst.locator(f'[data-act="cbDel"][data-arg="{U3}"]').tap(); page.wait_for_timeout(600)
    page.locator(f'#sheet [data-act="cbDelGo"][data-arg="{U3}"]').tap(); page.wait_for_timeout(600)
    row3 = J(f"(() => {{ const b = document.querySelector('#sheet .cb-row [data-arg=\"{U3}\"]'); const li = b && b.closest('li'); return li ? li.innerText : ''; }})()")
    ok('Nothing was deleted' in row3 and 'too many requests' in row3 and page.locator('#sheet .cb-list li').count() == 5, f'a refused delete says so in its own row, and nothing is removed ({row3[-90:]!r})')
    # a refused Refresh keeps the list on screen (audit R3.6-13)
    read_busy.append(1); page.locator('#sheet [data-act="cbShow"][data-arg="%s"]' % code).last.tap(); page.wait_for_timeout(600)
    ok(page.locator('#sheet .cb-list li').count() == 5 and 'too many requests' in page.locator('#sheet .cb-res').inner_text(), 'a refused Refresh keeps the list and says why')
    n_read, nd0 = len(asked), len(dels)
    lst.locator(f'[data-act="cbDel"][data-arg="{U2}"]').tap()
    #, errors[-3:], J("JSON.stringify({ask: OCUI.U.cbList && OCUI.U.cbList.ask, sheet: OCUI.U.sheet, res: !!document.querySelector('#sheet .cb-res'), txt: document.getElementById('sheet').innerText.slice(0, 300)})"))
    page.wait_for_selector(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]', timeout=2000)
    page.locator(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]').tap(); page.wait_for_timeout(200)   # within half a second of the ✕: a double tap
    ok(len(dels) == nd0 and page.locator(f'#sheet .cb-row .cb-ask [data-act="cbDelGo"][data-arg="{U2}"]').count() == 1, 'a double tap doesn\'t delete; the confirm shows in that row, where the finger is, and ignores a tap in the first half second')
    page.wait_for_timeout(500); page.locator(f'#sheet [data-act="cbDelGo"][data-arg="{U2}"]').tap(); page.wait_for_timeout(600)
    ok(dels and dels[-1] == {'p_code': code, 'p_key': KEY, 'p_id': U2, 'p_all': False} and len(asked) == n_read and page.locator('#sheet .cb-list li').count() == 4,
       f'then deletes that one result by its id, and takes it out of the list without reloading ({dels[-1:]})')
    ok(sorted(dels[-1].keys()) == sorted(CALL['calls']['cb_class_delete'].keys()), 'the delete call matches the contract file')
    page.locator('#sheet .cb-res [data-act="cbDel"][data-arg="all"]').tap(); page.wait_for_timeout(600)
    page.locator('#sheet [data-act="cbDelGo"][data-arg="all"]').tap(); page.wait_for_timeout(600)
    ok(dels[-1] == {'p_code': code, 'p_key': KEY, 'p_all': True} and page.locator('#sheet .cb-list li').count() == 0, 'Delete all asks, then deletes every result for the code')
    # forget a key on this device, while its results are still on their way: the answer must not bring them back (audit R3.6-03)
    page.locator('#sheet [data-act="cbClose"]').tap(); page.wait_for_timeout(200)
    read_hold.append(None)
    page.locator(f'#sheet .cb-codes [data-act="cbShow"][data-arg="{first}"]').tap(); page.wait_for_timeout(300)
    page.locator(f'#sheet .cb-codes [data-act="keyForget"][data-arg="{first}"]').tap(); page.wait_for_timeout(200)
    page.locator(f'#sheet .cb-codes [data-act="keyForgetGo"][data-arg="{first}"]').tap(); page.wait_for_timeout(300)
    for r in read_hold[1:]: r.fulfill(status=200, content_type='application/json', body=_json.dumps({'expires': '2026-12-24T16:00:00+00:00', 'created': CREATED, 'rows': rows}))
    read_hold.clear(); page.wait_for_timeout(400)
    ok(first not in (J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c') or {}) and page.locator(f'#sheet .cb-codes [data-arg="{first}"]').count() == 0 and page.locator('#sheet .cb-list').count() == 0,
       'Forget removes a key from this device, and results that arrive after it don\'t show')
    # another device: the code and the key typed in
    J("localStorage.removeItem('oc-ckeys'); OCUI.U.cbList = null; OCUI.U.cbOpen = false; OCUI.U.reg = null; OCUI.U.codeMade = null; OCUI.render()"); page.wait_for_timeout(300)
    page.locator('#sheet .cb-res [data-act="cbOpen"]').tap(); page.wait_for_timeout(300)
    ok(J("getComputedStyle(document.getElementById('cbKey')).webkitTextSecurity") == 'disc', 'the key box hides what is typed (a projected classroom screen)')
    kb = J("(() => { const k = document.getElementById('cbKey').getBoundingClientRect(), b = document.querySelector('#sheet [data-act=\"cbKeyVis\"]').getBoundingClientRect(), c = document.querySelector('#sheet .cb-res').getBoundingClientRect(); return { kw: Math.round(k.width), cw: Math.round(c.width), bIn: b.right <= c.right + 0.5 && b.left >= k.right, sx: document.getElementById('sheet').scrollWidth - document.getElementById('sheet').clientWidth }; })()")
    ok(kb['kw'] >= kb['cw'] * 0.5 and kb['bIn'] and kb['sx'] <= 0, f'the key box has room to type in, with Show beside it inside the card, and nothing scrolls sideways (audit R4.7-01; {kb})')
    for vw, vh in [(390, 844), (360, 640)]:   # phones held upright, where the form was wider than its card (audit R4.8-01)
        page.set_viewport_size({'width': vw, 'height': vh}); page.wait_for_timeout(300)
        lay = J("(() => { const c = document.querySelector('#sheet .cb-res').getBoundingClientRect(), f = document.querySelector('#sheet .cb-form').getBoundingClientRect(), k = document.getElementById('cbKey').getBoundingClientRect(), b = document.querySelector('#sheet [data-act=\"cbKeyVis\"]').getBoundingClientRect(), sh = document.getElementById('sheet'); return { inCard: f.left >= c.left - 0.5 && f.right <= c.right + 0.5 && b.right <= c.right + 0.5, kw: Math.round(k.width), sx: sh.scrollWidth - sh.clientWidth, left: Math.round(c.left) }; })()")
        ok(lay['inCard'] and lay['kw'] >= 150 and lay['sx'] <= 0 and lay['left'] >= 0, f'at {vw}x{vh} the form and the key row fit the card, with room to type, and nothing scrolls sideways ({lay})')
        page.locator('#sheet #cbKey').fill('MWMW-HNKD-QG0W-8MHN'); page.locator('#sheet [data-act="cbKeyVis"]').tap(); page.wait_for_timeout(250)
        fit = J("(() => { const k = document.getElementById('cbKey'); return { vis: !k.classList.contains('masked'), cw: k.clientWidth, sw: k.scrollWidth, fs: parseFloat(getComputedStyle(k).fontSize) }; })()")
        ok(fit['vis'] and fit['sw'] <= fit['cw'] and fit['fs'] >= 16, f'at {vw}x{vh} a whole 19-character key of wide letters shows at once after Show, at 16 px so iOS does not zoom (audit R4.9-02, R4.10-04; {fit})')
        page.locator('#sheet [data-act="cbKeyVis"]').tap(); page.locator('#sheet #cbKey').fill(''); page.wait_for_timeout(200)
    page.set_viewport_size({'width': 844, 'height': 390}); page.wait_for_timeout(300)
    # typed key by key, then Enter (the phone's Go): the answer shows while the box still has focus (audit R4.6-01)
    page.locator('#sheet #cbCode').press_sequentially(code.lower().replace('-', ''), delay=25); page.keyboard.press('Tab')
    page.keyboard.type('ABCD-EFGH-JKMN-PQRS', delay=25)
    with page.expect_request('**/rpc/cb_class_read'): page.keyboard.press('Enter')
    page.wait_for_timeout(400)
    ok('don’t match' in page.locator('#sheet .cb-res').inner_text() and page.locator('#sheet .cb-list').count() == 0 and J("document.activeElement && document.activeElement.id") == 'cbKey',
       'Enter in the key box: a wrong key shows its message right away, with the box still in focus')
    ok(page.locator('#sheet #cbKey').input_value() == 'ABCD-EFGH-JKMN-PQRS' and page.locator('#sheet #cbCode').input_value() == code.lower().replace('-', ''), 'and keeps what was typed, to fix it')
    page.locator('#sheet #cbKey').fill(''); page.locator('#sheet #cbKey').press_sequentially(KEY.lower()[:4] + '-' + KEY.lower()[4:], delay=20)
    with page.expect_request('**/rpc/cb_class_read') as rq: page.keyboard.press('Enter')
    page.wait_for_timeout(500)
    ok(rq.value.post_data_json == {'p_code': code, 'p_key': KEY} and page.locator('#sheet .cb-list').count() == 1 and page.locator('#sheet #cbKey').count() == 0, 'the key typed in lower case with a dash, then Enter, opens the results (and the form closes)')
    ok(not (J("JSON.parse(localStorage.getItem('oc-ckeys') || '{}')").get('c') or {}), 'a typed key isn\'t remembered unless asked (a shared computer)')
    J("OCUI.U.sheet = null; OCUI.render()"); page.locator('#title [data-act="classCode"]').tap(); page.wait_for_timeout(400)
    ok(page.locator('#sheet .cb-list').count() == 0, 'and its results are gone when the sheet is opened again')
    # a key typed and left (a failed read, or the sheet closed first) is gone for the next person (audit R5.6-01)
    page.locator('#sheet .cb-res [data-act="cbOpen"]').tap(); page.wait_for_timeout(200)
    page.locator('#sheet #cbCode').fill(code); page.locator('#sheet #cbKey').fill(KEY)
    J("OCUI.U.sheet = null; OCUI.render()"); page.locator('#title [data-act="classCode"]').tap(); page.wait_for_timeout(400)
    ok(page.locator('#sheet #cbKey').count() == 0 and KEY not in J("JSON.stringify(OCUI.U.cbForm || {})"), 'a key typed and left in the box is gone when the sheet is opened again (a shared computer)')
    # Copy key's whole line pasted into the code box fills both boxes (audit R5.6-07)
    page.locator('#sheet .cb-res [data-act="cbOpen"]').tap(); page.wait_for_timeout(200)
    page.locator('#sheet #cbCode').fill(f'Code Black instructor key for class code {code}: {KEY[:4]}-{KEY[4:8]}-{KEY[8:12]}-{KEY[12:]}'); page.wait_for_timeout(300)
    ok(page.locator('#sheet #cbCode').input_value() == code and page.locator('#sheet #cbKey').input_value().replace('-', '') == KEY, 'pasting Copy key\'s whole line into a box fills the code and the key')
    # a code from an older version (its check characters no longer match) still opens with its key
    oldc = code[:6] + ('A' if code[6] != 'A' else 'B')
    J("OCUI.U.cbList = null; OCUI.U.cbOpen = true; OCUI.U.cbForm = {}; OCUI.render()"); page.wait_for_timeout(200)
    page.locator('#sheet #cbCode').fill(oldc); page.locator('#sheet #cbKey').fill(KEY); page.locator('.cb-rem input').check()
    with page.expect_request('**/rpc/cb_class_read') as rq: page.locator('#sheet .cb-res [data-act="cbShow"]').first.tap()
    ok(rq.value.post_data_json == {'p_code': oldc, 'p_key': KEY}, f'a code the game can no longer play (another version) still goes to the server with its key ({oldc})')
    # used without results (the server unreachable), then set up from its row: the code on screen says results are on (audit R4.8-03)
    J("OCUI.U.sheet = null; OCUI.U.reg = null; OCUI.U.codeMade = null; OCUI.render()"); page.wait_for_timeout(200)
    J("document.querySelector('#title [data-act=\"classCode\"]').click()"); page.wait_for_timeout(400)
    reg_plan[:] = ['abort', 'ok']
    page.locator('#sheet [data-act="codeMake"][data-arg="easy"]').tap(); page.wait_for_timeout(700)
    page.locator('#sheet [data-act="codeNoRes"]').tap(); page.wait_for_timeout(300)
    off_code = page.locator('#sheet .cc-code').inner_text().strip()
    off_txt = page.locator('#sheet .cc-made').inner_text()
    page.locator(f'#sheet .cb-codes [data-act="codeRegSaved"][data-arg="{off_code}"]').tap(); page.wait_for_timeout(700)
    on_txt = page.locator('#sheet .cc-made').inner_text()
    ok('results are off' in off_txt and 'whoever registers this code first' in off_txt and 'Class results are on' in on_txt and 'not to tap Send' not in on_txt,
       f'a code used without results, then set up from its row, says results are on in its panel too ({off_code})')
    # a 429 can be caused by someone else: no "Use it without results" (audit R3.9-02); a 503 is an outage: offered (audit R4.10-05)
    for st_, word in (('fail', 'had a problem'), ('429', 'too many requests')):
        J("OCUI.U.sheet = null; OCUI.U.reg = null; OCUI.U.codeMade = null; OCUI.render()"); page.wait_for_timeout(200)
        J("document.querySelector('#title [data-act=\"classCode\"]').click()"); page.wait_for_timeout(400)
        reg_plan[:] = [st_]
        page.locator('#sheet [data-act="codeMake"][data-arg="easy"]').tap(); page.wait_for_timeout(700)
        tx = page.locator('#sheet .cc-box').nth(1).inner_text()
        nores = page.locator('#sheet [data-act="codeNoRes"]').count()
        ok(page.locator('#sheet .cc-code').count() == 0 and page.locator('#sheet [data-act="codeReg"]').count() == 1 and word in tx and nores == (1 if st_ == 'fail' else 0),
           f'an HTTP {"503 (the service down, which a classmate can\'t cause): Try again and Use it without results" if st_ == "fail" else "429 (which a classmate can cause): Try again only"} ({word!r}, {nores})')
    # the row refused (busy), then the panel's Try again answered ok: the row's old refusal goes (audit R1.9-03)
    J("OCUI.U.sheet = null; OCUI.U.reg = null; OCUI.U.codeMade = null; OCUI.render()"); page.wait_for_timeout(200)
    J("document.querySelector('#title [data-act=\"classCode\"]').click()"); page.wait_for_timeout(400)
    reg_plan[:] = ['abort', 'busy', 'ok']
    page.locator('#sheet [data-act="codeMake"][data-arg="med"]').tap(); page.wait_for_timeout(700)
    page.locator('#sheet [data-act="codeNoRes"]').tap(); page.wait_for_timeout(300)
    sp_code = page.locator('#sheet .cc-code').inner_text().strip()
    page.locator(f'#sheet .cb-codes [data-act="codeRegSaved"][data-arg="{sp_code}"]').tap(); page.wait_for_timeout(600)
    row_err = page.locator(f'#sheet .cb-codes li:has([data-arg="{sp_code}"]) .cb-err').count()
    page.locator('#sheet .cc-made [data-act="codeReg"]').tap(); page.wait_for_timeout(700)
    row_after = page.locator(f'#sheet .cb-codes li:has([data-arg="{sp_code}"]) .cb-err').count()
    ok(row_err == 1 and row_after == 0 and 'Class results are on' in page.locator('#sheet .cc-made').inner_text(),
       f'a row refused as busy, then the panel set up: the panel says on and the row\'s refusal is gone ({sp_code}: {row_err} -> {row_after})')
    # the verdict is built from what happened (audit R4.9-07, R6.9-03)
    V = lambda r: J(f"OCUI.verdictOf({r})")
    v1 = V("{mode:'md', stars:2, md:{seen:6, died:1, codeLost:1}, mm:[]}")
    v2 = V("{mode:'md', stars:2, md:{seen:6, died:1, codeLost:0}, mm:[{t:1}]}")
    v3 = V("{mode:'md', stars:2, md:{seen:6, died:2, codeLost:1, arrestLeft:1}, mm:[{t:1}]}")
    v4 = V("{mode:'md', stars:1, md:{seen:6, died:0, arrestLeft:1}, mm:[{t:1}]}")
    v5 = V("{mode:'md', stars:3, md:{seen:6, dxWrong:1, contra:1, dispoWrong:2}, mm:[]}")
    ok(v1.startswith('A patient died after a code run by the book') and v2 == 'One of your own patients died. Read the M&M below.'
       and v3 == '2 of your own patients died (1 after a code run by the book), and one was still in cardiac arrest at the end, with no code running. Read the M&M below.'
       and v4 == 'One of your own patients was still in cardiac arrest at the end, with no code running. Read the M&M below.'
       and 'Diagnoses to review</b>, above' in v5 and 'Orders to review</b>, below' in v5 and '2 wrong dispositions' in v5,
       f'the verdict says what happened: a lost code, a death, both with an arrest left, an arrest alone, and the sections to read ({[v1, v2, v3, v4, v5]})')
    # keyboard only: the sheet takes the focus, is named, keeps Tab inside, and confirms don't drop the focus (audit R4.9-03)
    J("OCUI.U.sheet = null; OCUI.U.cbOpen = false; OCUI.U.cbForget = null; OCUI.render()"); page.wait_for_timeout(250)
    J("document.querySelector('#title [data-act=\"classCode\"]').focus()"); page.keyboard.press('Enter'); page.wait_for_timeout(400)
    fo = J("(() => { const b = document.getElementById('sheetBox'), a = document.activeElement; return { inside: b.contains(a), label: b.getAttribute('aria-label') }; })()")
    ok(fo['inside'] and fo['label'] and fo['label'] != 'Details', f'opened from the keyboard, the class sheet takes the focus and is named after its heading ({fo})')
    out = []
    for i in range(40):
        page.keyboard.press('Tab'); out.append(J("document.getElementById('sheetBox').contains(document.activeElement)"))
    page.keyboard.press('Shift+Tab'); page.keyboard.press('Shift+Tab'); out.append(J("document.getElementById('sheetBox').contains(document.activeElement)"))
    ok(all(out), f'Tab and Shift+Tab stay inside the open sheet, a modal dialog ({out.count(False)} of {len(out)} left it)')
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    ok(J("document.getElementById('sheetWrap').hidden && document.activeElement && document.activeElement.getAttribute('data-act')") == 'classCode', 'Escape closes it, and the focus goes back to Class code')
    page.keyboard.press('Enter'); page.wait_for_timeout(400)
    J("document.querySelector('#sheet [data-act=\"cbOpen\"]').focus()"); page.keyboard.press('Enter'); page.wait_for_timeout(300)
    ok(J("document.activeElement && document.activeElement.id") == 'cbCode', 'A code made on another device puts the focus in the Class code box')
    J(f"document.querySelector('#sheet [data-act=\"keyForget\"][data-arg=\"{off_code}\"]').focus()"); page.keyboard.press('Enter'); page.wait_for_timeout(300)
    f1 = J("(() => { const a = document.activeElement; return a && document.getElementById('sheet').contains(a) ? a.getAttribute('data-act') || a.tagName : 'outside: ' + (a && a.tagName); })()")
    J("document.querySelector('#sheet [data-act=\"keyForgetNo\"]').focus()"); page.keyboard.press('Enter'); page.wait_for_timeout(300)
    f2 = J("(() => { const a = document.activeElement; return a && document.getElementById('sheet').contains(a) ? a.getAttribute('data-act') || a.tagName : 'outside: ' + (a && a.tagName); })()")
    ok(f1 == 'keyForgetNo' and f2 == 'keyForget', f'Forget this key puts the focus on Keep, and Keep puts it back on Forget, never on another class\'s Show key (audit R3.10-03; {f1}, {f2})')
    J("OCUI.U.cbOpen = false; OCUI.render()")
    # the privacy notice says where names go
    J("OCUI.U.sheet = null; OCUI.render()"); page.wait_for_timeout(200)
    J("OCUI.showTitle()"); page.wait_for_timeout(300)
    if page.locator('#title .t-links [data-arg="about"]').count(): page.locator('#title .t-links [data-arg="about"]').first.tap(); page.wait_for_timeout(300)
    about = J("document.getElementById('title').innerText")
    ok('only the instructor who made the code' in about and 'can see it too' in about and '30 days' in about and 'keyed hash' in about and 'no licensed clinician has reviewed' in about,
       'the About page says who can read class results (the developer too), for how long, what is kept about networks, and that no licensed clinician has reviewed the content')
    J("OCUI.U.sheet = { type: 'lessons' }; OCUI.render()"); page.wait_for_timeout(300)
    ok('no licensed clinician has reviewed them' in page.locator('#sheet').inner_text(), 'the Lessons page says no licensed clinician has reviewed them (audit R6.6-11)')

    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
