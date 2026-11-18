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
