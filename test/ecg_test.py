"""v0.34: the 12-lead ECG. On the attending's regular shift an ECG comes up as a drawn tracing marked Requires Physician Signature, with
no written reading, and STEMI / No STEMI (plus Repeat ECG on Arrival for an ambulance ECG). The charge nurse sees the tracing and the
reading. The viewer opens it full screen."""
import os, sys
from playwright.sync_api import sync_playwright
from _browser import launch

URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
errors, checks = [], []
def ok(cond, msg):
    checks.append(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: errors.append('CHECK FAILED: ' + msg)

SETUP = """([k, src]) => { const G = OC.G; G.card = null; const U = OCUI.U; U.modal = null; U.paused = true; U.view = 'list';
  const room = G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso).id;
  const p = OC.pt(OC.trainPatient(k, 'room', { room })); p.unit = 'Medic 9';
  if (src) p.ecgs = [{ src, read: p.find.ecg, t: G.t, pick: null, tSign: null, done: false }];
  else { p.wk = p.wk.includes('ecg') ? p.wk : p.wk.concat('ecg'); p.work.ecg = { st: 'done', tDone: G.t }; }
  U.sheet = { type: 'pt', pid: p.id }; OCUI.render(); return p.id; }"""

with sync_playwright() as pw:
    b = launch(pw)
    page = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1); J = page.evaluate
    page.on('pageerror', lambda e: errors.append('page error: ' + str(e)))
    page.goto(URL); page.wait_for_timeout(500)
    # attending, regular shift
    J("OCUI.U.mode = 'md'; OCUI.start('med')"); page.wait_for_timeout(700)
    pid = J(SETUP, ['stemi', 'ems'])
    page.wait_for_timeout(300)
    box = page.locator('#sheet .ecgbox')
    ok(box.count() == 1 and 'Requires Physician Signature' in box.inner_text(), 'the attending sees the ECG marked Requires Physician Signature')
    t = page.inner_text('#sheet')
    ok('ST elevation' not in t, 'no written reading on the attending\'s regular shift')
    labels = J("[...document.querySelectorAll('#sheet svg.ecg text')].map(x => x.textContent)")
    ok(sorted(set(labels)) == sorted(['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']), f'the tracing has all 12 leads and a rhythm strip ({len(labels)} labels)')
    btns = [x.strip() for x in page.locator('#sheet .ecg-btns button').all_inner_texts()]
    ok(btns == ['STEMI', 'No STEMI', 'Repeat ECG on Arrival'], f'an ambulance ECG offers STEMI, No STEMI and Repeat ECG on Arrival ({btns})')
    hs = J("[...document.querySelectorAll('#sheet .ecg-btns button')].map(b => b.getBoundingClientRect().height)")
    ok(min(hs) >= 44, f'the signature buttons are at least 44 px tall ({hs})')
    page.locator('#sheet .ecg-thumb').tap() if False else page.locator('#sheet .ecg-thumb').click(); page.wait_for_timeout(300)
    ok(page.locator('#viewer svg.ecg').count() == 1 and 'Requires Physician Signature' in page.inner_text('#viewer'), 'the ECG opens full screen, still unsigned and with no reading')
    page.locator('#viewer [data-vw="x"]').click(); page.wait_for_timeout(200)
    ok(page.locator('#viewer').count() == 0, 'Close closes the viewer')
    page.locator('#sheet .ecg-btns button', has_text='STEMI').first.click(); page.wait_for_timeout(300)
    J("OCUI.render()"); page.wait_for_timeout(200)
    ok('Signed: STEMI' in page.inner_text('#sheet .ecgbox') and page.locator('#sheet .ecg-btns').count() == 0, 'signing shows "Signed: STEMI" and the buttons go')
    pid2 = J(SETUP, ['cwp', 'ed']); page.wait_for_timeout(300)
    btns = [x.strip() for x in page.locator('#sheet .ecg-btns button').all_inner_texts()]
    ok(btns == ['STEMI', 'No STEMI'], f'an ECG done here offers STEMI or No STEMI ({btns})')
    # charge nurse: the tracing with its reading
    J("OCUI.U.mode = 'rn'; OCUI.start('med')"); page.wait_for_timeout(700)
    J(SETUP, ['nstemi', None]); page.wait_for_timeout(300)
    bx = page.locator('#sheet .ecgbox')
    ok(bx.count() == 1 and 'ST depression V4–V6' in bx.inner_text() and page.locator('#sheet .ecg-btns').count() == 0, 'the charge nurse sees the tracing with its reading and no signature')
    b.close()

for c in checks: print(c)
if errors: print('\n'.join(errors)); sys.exit(1)
print('No errors.')
