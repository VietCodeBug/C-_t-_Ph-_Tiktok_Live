from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os, subprocess, time, uuid, urllib.request

web = Path(__file__).resolve().parents[1]
out = web / 'artifacts' / 'live-studio'
out.mkdir(parents=True, exist_ok=True)
token = uuid.uuid4().hex
port = int(os.environ.get('LIVE_QA_PORT', '5180'))
origin = f'http://127.0.0.1:{port}'
helper = f'http://127.0.0.1:{port+1}'
report = {'checks': [], 'errors': [], 'requests_failed': []}

def check(name, value, detail=None):
    report['checks'].append({'name': name, 'passed': bool(value), 'detail': detail})
    assert value, (name, detail)

def http(path, data=None, fixture=False):
    request = urllib.request.Request((helper if fixture else origin) + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', 'Origin': origin, 'x-test-token': token})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)

def control(action, payload=None, mode='live'):
    return http('/api/control', {'mode': mode, 'action': action, 'payload': payload or {}})

stdout = open(out/'qa-server.stdout.log', 'w', encoding='utf-8')
stderr = open(out/'qa-server.stderr.log', 'w', encoding='utf-8')
process = subprocess.Popen(['node', 'tests/live-browser-server.mjs'], cwd=web,
    env={**os.environ, 'LIVE_QA_TOKEN': token, 'LIVE_QA_PORT': str(port)}, stdout=stdout, stderr=stderr)
try:
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError((out/'qa-server.stderr.log').read_text(encoding='utf-8'))
        try:
            health = http('/api/health')
            break
        except Exception:
            time.sleep(.2)
    else:
        raise RuntimeError('QA server did not become ready')
    check('production-shaped server starts disconnected without synthetic LIVE players', health['connection']['status']!='connected' and len(http('/api/state')['roster'])==0)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('console', lambda msg: report['errors'].append(msg.text) if msg.type=='error' else None)
        page.on('requestfailed', lambda request: report['requests_failed'].append(request.url) if '/api/events' not in request.url and not request.url.endswith('/api/tts') else None)
        page.goto(origin+'/overlay', wait_until='domcontentloaded')
        page.wait_for_function('window.__TYPHI_LIVE__?.ready', timeout=90000)
        check('empty LIVE overlay has zero render actors and a waiting invitation', page.evaluate('window.__TYPHI_LIVE__.actors().length')==0 and page.locator('#live-waiting').is_visible())
        box = page.locator('#game').bounding_box()
        check('LIVE canvas uses9:16 without horizontal overflow', abs(box['width']/box['height']-9/16)<.005 and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(out/'01-empty-live.png'))
        events=[{'type':'member','eventId':f'qa-member-{i}','user':{'id':f'qa-user-{i}','nickname':f'Khách phố {i}'}} for i in range(1,3)]
        http('/source', {'events':events}, True)
        control('pause')
        page.wait_for_function('window.__TYPHI_LIVE__.actors().length===2', timeout=60000)
        check('verified-shaped arrival creates two named actors with their own wallets', len(http('/api/state')['roster'])==2 and page.evaluate('window.__TYPHI_LIVE__.snapshot().game.players.every(p=>p.money===1000)'))
        control('resume')
        page.wait_for_function("window.__TYPHI_LIVE__.snapshot()?.spotlight?.kind==='roll'", timeout=30000)
        control('pause'); page.wait_for_timeout(250)
        check('welcome camera selects the new player and displays a real3D die', page.locator('#live-welcome').is_visible() and page.locator('.dice-webgl').is_visible() and page.locator('.dice-webgl').get_attribute('data-renderer')=='three-webgl')
        style=page.locator('.dice-overlay').evaluate('el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopWidth})')
        check('welcome die has no large white panel',style=={'background':'rgba(0, 0, 0, 0)','border':'0px'},style)
        first=page.evaluate('window.__TYPHI_LIVE__.snapshot().spotlight.seat')
        page.screenshot(path=str(out/'02-welcome-die.png'))
        control('resume')
        http('/advance', {'seconds':4}, True)
        check('welcome rolls exactly once then camera continues to another participant',http('/api/state')['game']['seat']!=first)
        control('pause')
        http('/source', {'events':[{'type':'member','eventId':f'qa-member-{i}','user':{'id':f'qa-user-{i}','nickname':f'Khách phố {i}'}} for i in range(3,101)]}, True)
        page.wait_for_function('window.__TYPHI_LIVE__.actors().length===20 && window.__TYPHI_LIVE__.snapshot().waiting.length===80', timeout=90000)
        check('100 arrivals produce20 sprites and80 lightweight waiting customers',len(http('/api/state')['roster'])==20 and len(http('/api/state')['waiting'])==80 and page.evaluate('window.__TYPHI_LIVE__.stats().actors')==20)
        check('test source remains explicitly not a real TikTok connection',http('/api/state')['realTikTokConnected'] is False)
        before=http('/api/state');leaving=before['roster'][0];promoted=before['waiting'][0]
        unchanged={row['seat']:(row['raceSteps'],row['money']) for row in before['game']['players'] if row['seat']!=leaving['seat']}
        http('/source', {'events':[{'type':'leave','eventId':'qa-leave-first','user':{'id':leaving['userId']}}]},True)
        page.wait_for_function('(seat)=>window.__TYPHI_LIVE__.actors().some(p=>p.seat===seat)',arg=promoted['seat'],timeout=60000)
        after=http('/api/state')
        check('a departing racer is replaced by the oldest waiting user without a ghost',len(after['roster'])==20 and len(after['waiting'])==79 and leaving['seat'] not in [row['seat'] for row in after['roster']] and promoted['seat'] in [row['seat'] for row in after['roster']])
        check('replacement keeps every other wallet and race progress',all((row['raceSteps'],row['money'])==unchanged[row['seat']] for row in after['game']['players'] if row['seat'] in unchanged))
        check('replacement starts its own three-lap race at zero',next(row for row in after['game']['players'] if row['seat']==promoted['seat'])['raceSteps']==0)
        page.screenshot(path=str(out/'03-replacement-queue.png'))
        second=browser.new_page(viewport={'width':390,'height':844})
        second.goto(origin+'/overlay',wait_until='domcontentloaded');second.wait_for_function('window.__TYPHI_LIVE__?.ready',timeout=90000)
        check('opening another overlay does not create another engine or charge money',http('/api/state')['community']['totals']==after['community']['totals'])
        second.close()
        admin=browser.new_page(viewport={'width':1280,'height':950})
        admin.on('pageerror',lambda error:report['errors'].append(str(error)))
        admin.goto(origin+'/admin',wait_until='domcontentloaded')
        admin.wait_for_function('document.querySelector("#active-count").textContent==="20"',timeout=30000)
        check('operator page receives live roster and waiting counts',admin.locator('#active-count').inner_text()=='20' and admin.locator('#waiting-count').inner_text()=='79')
        admin.locator('[data-mode=demo]').click();admin.locator('[data-demo=join-many]').click()
        admin.wait_for_function('document.querySelector("#active-count").textContent==="20"')
        check('demo admission is isolated from actual LIVE room',len(http('/api/state?mode=demo')['roster'])==20 and len(http('/api/state')['roster'])==20 and len(http('/api/state')['waiting'])==79)
        admin.screenshot(path=str(out/'04-admin-demo.png'),full_page=True)
        page.close()
        # Exercise normal rendered event windows against the independent demo room.
        control('pause',mode='demo')
        demo=browser.new_page(viewport={'width':390,'height':844})
        demo.on('pageerror',lambda error:report['errors'].append(str(error)))
        demo.goto(origin+'/demo',wait_until='domcontentloaded');demo.wait_for_function('window.__TYPHI_LIVE__?.ready',timeout=90000)
        demo.wait_for_function('window.__TYPHI_LIVE__.actors().length===20',timeout=90000)
        check('demo overlay is visibly labeled and still capped20',demo.locator('#live-mode').inner_text()=='MÔ PHỎNG' and demo.evaluate('window.__TYPHI_LIVE__.stats().actors')==20)
        control('resume',mode='demo');control('try-event',{'category':'invest'},mode='demo')
        demo.wait_for_function('window.__TYPHI_LIVE__.snapshot()?.community?.modal==="investment"',timeout=30000)
        control('pause',mode='demo');demo.wait_for_timeout(300)
        check('authoritative collective investment renders with a locked movement hold',demo.locator('.community-panel').is_visible() and http('/api/state?mode=demo')['game']['globalHold'])
        check('group window clears the welcome banner and personal-card narration',demo.locator('#live-welcome').is_hidden() and 'Góp' in http('/api/state?mode=demo')['community']['mcLine'])
        with demo.expect_response('**/api/tts',timeout=30000) as speech_response:
            demo.locator('#audio-unlock').click()
        demo.wait_for_function('window.__TYPHI_LIVE__.audio.status.unlocked',timeout=10000)
        check('audio unlock plays only a server-authorized MC packet',speech_response.value.status==200 and speech_response.value.headers.get('content-type','').startswith('audio/'))
        demo.screenshot(path=str(out/'05-live-investment.png'))
        health=http('/api/health')
        check('server reports no runtime errors',not health['errors'],health['errors'])
        check('pages have no JavaScript errors or asset failures',not report['errors'] and not report['requests_failed'],{'errors':report['errors'],'requests':report['requests_failed']})
        browser.close()
    report['status']='PASS'
finally:
    (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    process.terminate()
    try: process.wait(timeout=15)
    except subprocess.TimeoutExpired: process.kill();process.wait()
    stdout.close();stderr.close()
print(json.dumps({'status':report.get('status','FAILED'),'checks':len(report['checks'])}))
