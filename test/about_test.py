"""The first-visit page (v0.22): a new visitor sees what the game is, who it's for, privacy, and credits, then Start.
Automated test browsers skip it (navigator.webdriver), so this test hides that flag to see what a person sees."""
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
    for (w, h, name) in [(390, 844, 'up'), (844, 390, 'side')]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => false });")
        page = ctx.new_page(); J = page.evaluate
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.goto(URL); page.wait_for_timeout(700)
        t = page.inner_text('#title')
        ok('twelve-hour shift' in t and 'Who it’s for' in t and 'Privacy' in t and 'isn’t clinical guidance' in t, f'{name}: a first visit opens on the welcome page')
        ok(page.locator('#title [data-act="mode"]').count() == 0, f'{name}: the menu waits behind it')
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', f'about-{name}-top.png'))
        page.locator('#title .ab-cred summary').tap(); page.wait_for_timeout(200)
        ok('mesh2motion' in page.inner_text('#title .ab-cred') and page.locator('#title .ab-cred li').count() >= 20, f'{name}: credits list the 3D sources and every medical image')
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', f'about-{name}.png'), full_page=False)
        page.locator('#title [data-act="aboutDone"]').tap(); page.wait_for_timeout(400)
        ok(page.locator('#title [data-act="mode"]').count() == 2, f'{name}: Start goes to the menu')
        page.reload(); page.wait_for_timeout(700)
        ok(page.locator('#title [data-act="mode"]').count() == 2, f'{name}: a second visit goes straight to the menu')
        page.locator('#title .t-links [data-arg="about"]').tap(); page.wait_for_timeout(300)
        ok('Who it’s for' in page.inner_text('#title') and page.locator('#title .t-back').count() == 1, f'{name}: About on the menu opens it again, with Back')
        ctx.close()
    b.close()
print('\n'.join(checks))
if errors: print('\n'.join(errors[:20])); sys.exit(1)
print('No errors.')
