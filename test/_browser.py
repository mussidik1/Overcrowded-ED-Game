"""One place to pick the browser the UI tests run in.

BROWSER=chromium (default) uses Chrome: set CHROME_PATH to a local Chrome, or leave it unset to use Playwright's own.
BROWSER=webkit runs the same tests in WebKit, the engine behind Safari (python -m playwright install webkit).
BROWSER=firefox works the same way.
"""
import os


def launch(pw):
    name = (os.environ.get('BROWSER') or 'chromium').lower()
    if name == 'webkit': return pw.webkit.launch()
    if name == 'firefox': return pw.firefox.launch()
    return pw.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])


_DOWN = """([x, y]) => { const t = document.elementFromPoint(x, y) || document.body; window.__finger = { t, x0: x, y0: y, x, y, far: 0 };
  t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1 })); }"""
_MOVE = """([x, y]) => { const f = window.__finger; if (!f) return; f.far = Math.max(f.far, Math.hypot(x - f.x0, y - f.y0)); f.x = x; f.y = y;
  const t = f.t.isConnected ? f.t : (document.elementFromPoint(x, y) || document.body);
  t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: -1, buttons: 1 })); }"""
_UP = """() => { const f = window.__finger; if (!f) return; window.__finger = null;
  const t = f.t.isConnected ? f.t : (document.elementFromPoint(f.x, f.y) || document.body);
  t.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: f.x, clientY: f.y, button: 0, buttons: 0 }));
  if (f.far <= 15) { const c = document.elementFromPoint(f.x0, f.y0); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: f.x0, clientY: f.y0, detail: 1, button: 0 })); } }"""


class Finger:
    """One fingertip: start, move, end.

    In Chrome the touch goes in through DevTools, so the browser itself turns it into pointer events and a click.
    Other engines have no such channel. There the same touch is replayed as the events a browser makes from it:
    pointerdown, pointermove, pointerup on what was under the finger, then a click if it slid 15 px or less.
    That checks the game's own touch handling in that engine, not the engine's handling of real glass.
    """

    def __init__(self, ctx, page):
        self.page = page
        self.cdp = None
        if os.environ.get('FINGER') != 'synthetic':   # FINGER=synthetic replays events in Chrome too, to check the replay itself
            try: self.cdp = ctx.new_cdp_session(page)
            except Exception: self.cdp = None
        self.real = self.cdp is not None

    def start(self, x, y):
        if self.cdp: self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        else: self.page.evaluate(_DOWN, [x, y])

    def move(self, x, y):
        if self.cdp: self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]})
        else: self.page.evaluate(_MOVE, [x, y])

    def end(self):
        if self.cdp: self.cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else: self.page.evaluate(_UP)
