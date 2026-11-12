from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os

out = Path(os.environ.get('ARTIFACT_DIR', str(Path(__file__).resolve().parents[1] / 'artifacts')))
out.mkdir(parents=True, exist_ok=True)
report = {'tests': [], 'errors': [], 'failed_requests': []}

def check(name, condition, detail=None):
    report['tests'].append({'test': name, 'passed': bool(condition), 'detail': detail})
    assert condition, (name, detail)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    page.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
    page.on('requestfailed', lambda r: report['failed_requests'].append({'url': r.url, 'failure': r.failure}))
    page.goto(os.environ.get('WEB_PREVIEW_URL', 'http://127.0.0.1:4173/'), wait_until='networkidle')
    page.wait_for_function('window.__TYPHI__?.ready', timeout=60000)
    page.evaluate("window.__TYPHI__.pause(true); window.__TYPHI__.select(0); window.__TYPHI__.mode('overview')")
    origin = page.evaluate('window.__TYPHI__.snapshot().players[0].position')
    page.get_by_role('button', name='Tiếp tục', exact=True).click()
    page.get_by_role('button', name='Lắc xúc xắc', exact=True).click()
    page.wait_for_function("document.querySelector('.dice-overlay').dataset.state === 'spinning'")
    page.wait_for_timeout(350)
    spinning = page.evaluate('window.__TYPHI__.snapshot()')
    check('manual roll shows spinning die before movement', spinning['phase'] == 'roll' and spinning['roll'] == 0
        and spinning['players'][0]['position'] == origin and page.locator('.dice-overlay').is_visible())
    check('repeat roll is blocked while spinning', page.locator('#roll-dice').is_disabled()
        and page.evaluate('window.__TYPHI__.roll()') is False)
    page.get_by_role('button', name='Tạm dừng', exact=True).click()
    page.wait_for_timeout(50)
    transform = page.locator('.dice-cube').evaluate('(el) => getComputedStyle(el).transform')
    elapsed = page.evaluate('window.__TYPHI__.snapshot().dice.elapsed')
    page.screenshot(path=str(out / 'dice-spinning-mobile.png'), full_page=True)
    page.wait_for_timeout(300)
    check('pause freezes spinning die and its game clock', transform == page.locator('.dice-cube').evaluate('(el) => getComputedStyle(el).transform')
        and elapsed == page.evaluate('window.__TYPHI__.snapshot().dice.elapsed'))
    page.get_by_role('button', name='Tiếp tục', exact=True).click()
    page.wait_for_function("window.__TYPHI__.snapshot().phase === 'roll-result'")
    page.evaluate('window.__TYPHI__.pause(true)')
    page.wait_for_timeout(50)
    revealed = page.evaluate('window.__TYPHI__.snapshot()')
    value = revealed['roll']
    check('revealed 1–6 controls the actual remaining steps', 1 <= value <= 6 and revealed['remaining'] == value
        and revealed['players'][0]['position'] == origin, {'roll': value})
    check('result caption and HUD agree with the die', page.locator('.dice-overlay').get_attribute('data-value') == str(value)
        and page.locator('.dice-caption').inner_text() == f'{value} BƯỚC'
        and page.locator('#roll-display circle').count() == value)
    transform = page.locator('.dice-cube').evaluate('(el) => getComputedStyle(el).transform')
    page.wait_for_timeout(300)
    check('pause also freezes the settling result', transform == page.locator('.dice-cube').evaluate('(el) => getComputedStyle(el).transform'))
    page.evaluate('window.__TYPHI__.pause(false)')
    page.wait_for_function("window.__TYPHI__.snapshot().phase === 'roll-result' && window.__TYPHI__.snapshot().dice.elapsed > .4")
    page.evaluate('window.__TYPHI__.pause(true)')
    page.wait_for_timeout(80)
    page.screenshot(path=str(out / 'dice-result-mobile.png'), full_page=True)
    page.evaluate('window.__TYPHI__.pause(false)')
    page.wait_for_function("window.__TYPHI__.snapshot().phase === 'moving'")
    check('die clears only after result hold, before running', page.locator('.dice-overlay').is_hidden())
    page.wait_for_function("window.__TYPHI__.snapshot().phase === 'arrive'", timeout=60000)
    page.evaluate('window.__TYPHI__.pause(true)')
    arrived = page.evaluate('window.__TYPHI__.snapshot()')
    check('actor stops after exactly the revealed number of tiles', arrived['roll'] == value
        and arrived['stepsCompleted'] == value and arrived['remaining'] == 0
        and len(arrived['visitedNodes']) == value + 1, {'roll': value, 'path': arrived['visitedNodes']})
    check('dice sound file loads', page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.endsWith('/audio/sfx_dice_roll.ogg'))"))
    check('no browser errors or failed requests', not report['errors'] and not report['failed_requests'],
        {'errors': report['errors'], 'failed_requests': report['failed_requests']})
    report['roll'] = value
    browser.close()

report['status'] = 'PASS'
(out / 'dice-browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'checks': len(report['tests']), 'roll': report['roll']}))
