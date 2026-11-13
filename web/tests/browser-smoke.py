from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,math,os

out=Path(os.environ.get('ARTIFACT_DIR', str(Path(__file__).resolve().parents[1]/'artifacts')));out.mkdir(parents=True,exist_ok=True)
report={'tests':[],'errors':[],'failed_requests':[],'renderer':'headless Chromium with software WebGL fallback; not target-device FPS evidence'}
def check(name,condition,detail=None):
 report['tests'].append({'test':name,'passed':bool(condition),'detail':detail})
 assert condition,(name,detail)

def wait_for_phase(page, phase, timeout=60, resolve_choices=False):
 deadline=time.monotonic()+timeout
 while time.monotonic()<deadline:
  snapshot=page.evaluate('window.__TYPHI__.snapshot()')
  if snapshot['phase']==phase:return snapshot
  if resolve_choices and snapshot['phase']=='fork-choice':
   page.locator('#branch-options [data-direction="left"]').click()
  elif resolve_choices and snapshot['phase']=='event-choice':
   page.locator('#event-options button:not([disabled])').first.click()
  page.wait_for_timeout(80)
 raise AssertionError(('phase timeout',phase,page.evaluate('window.__TYPHI__.snapshot()')))
with sync_playwright() as p:
 executable=os.environ.get('CHROMIUM_PATH')
 if not executable and Path('/usr/bin/chromium').exists(): executable='/usr/bin/chromium'
 options={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']}
 if executable: options['executable_path']=executable
 browser=p.chromium.launch(**options)
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
 page.on('requestfailed',lambda r:report['failed_requests'].append({'url':r.url,'failure':r.failure}))
 page.goto(os.environ.get('WEB_PREVIEW_URL', 'http://127.0.0.1:4173/?mode=classic'),wait_until='networkidle')
 page.wait_for_function('window.__TYPHI__?.ready',timeout=60000)
 initial=page.evaluate('window.__TYPHI__.snapshot()')
 check('real v2.3 assets and ten sprites',initial['spriteVersion']=='2.3' and len(initial['players'])==10)
 check('expanded map and seeded interactive scenario',initial['nodeCount']==138 and initial['seed'] is not None and initial['randomizeRounds'] and initial['interactiveChoices'])
 check('no invalid geometry',page.evaluate('window.__TYPHI__.geometryAudit()')==[])
 page.evaluate('window.__TYPHI__.select(0);window.__TYPHI__.pause(false)')
 wait_for_phase(page,'moving',resolve_choices=True)
 before=page.evaluate('window.__TYPHI__.snapshot()')
 page.wait_for_timeout(700)
 after=page.evaluate('window.__TYPHI__.snapshot()')
 a,b=before['players'][before['active']],after['players'][after['active']]
 movement=math.dist(a['position'],b['position'])
 check('actor actually moves',movement>.01,{'distance':movement})
 check('normal movement uses relaxed walk artwork',before['players'][before['active']]['clip']=='walk' and after['players'][after['active']]['clip']=='walk')
 check('animation advances while moving',a['frame']!=b['frame'],{'before':a['frame'],'after':b['frame'],'clip':b['clip']})
 check('automatic mode enters third-person view',after['cameraView']=='follow')
 page.wait_for_timeout(2000)
 snap=page.evaluate('window.__TYPHI__.snapshot()');actor=snap['players'][snap['active']]
 offset=[snap['camera']['position'][i]-actor['position'][i] for i in range(3)]
 behind=offset[0]*actor['heading'][0]+offset[2]*actor['heading'][2]
 check('third-person camera remains behind and outside the actor',snap['camera']['distanceToPlayer']>2 and behind<0,{'distance':snap['camera']['distanceToPlayer'],'behind_dot':behind})
 page.screenshot(path=str(out/'desktop-follow.png'),full_page=True)
 page.get_by_role('button',name='Toàn bàn Thấy đủ 10 người').click()
 page.evaluate('window.__TYPHI__.pause(true);window.__TYPHI__.select(0)')
 page.wait_for_timeout(2500)
 snap=page.evaluate('window.__TYPHI__.snapshot()')
 check('overview camera control',snap['mode']=='overview' and snap['cameraView']=='overview' and snap['camera']['position'][1]>28)
 page.screenshot(path=str(out/'desktop-overview.png'),full_page=True)
 before_orbit=page.evaluate('window.__TYPHI__.snapshot().camera.position')
 orbit_rect=page.locator('#game').bounding_box()
 orbit_x=orbit_rect['x']+orbit_rect['width']*.2
 orbit_y=orbit_rect['y']+orbit_rect['height']*.55
 page.mouse.move(orbit_x,orbit_y);page.mouse.down();page.mouse.move(orbit_x+210,orbit_y,steps=20);page.mouse.up()
 page.wait_for_timeout(1800)
 after_orbit=page.evaluate('window.__TYPHI__.snapshot().camera.position')
 check('drag rotates overview camera',math.dist(before_orbit,after_orbit)>5)
 page.screenshot(path=str(out/'desktop-orbit.png'),full_page=True)
 frozen=page.evaluate('window.__TYPHI__.snapshot()')
 page.wait_for_timeout(450)
 frozen2=page.evaluate('window.__TYPHI__.snapshot()')
 check('pause stops root motion and animation',frozen['players']==frozen2['players'])
 page.locator('.player-row[data-seat="3"]').click()
 check('seat selection uses the real character',page.evaluate('window.__TYPHI__.snapshot().seat')=='D')
 page.locator('#next-turn').click()
 check('next-turn button advances seat',page.evaluate('window.__TYPHI__.snapshot().seat')=='E')
 page.locator('#map-select').select_option('PHO_GIAO_HANG')
 page.wait_for_function("window.__TYPHI__.snapshot().map === 'PHO_GIAO_HANG' && document.querySelector('#loading').classList.contains('hidden')",timeout=30000)
 check('second map loads with valid geometry',page.evaluate('window.__TYPHI__.geometryAudit()')==[])
 page.wait_for_timeout(800)
 page.screenshot(path=str(out/'desktop-delivery.png'),full_page=True)
 page.locator('#map-select').select_option('BEN_SONG')
 page.wait_for_function("window.__TYPHI__.snapshot().map === 'BEN_SONG' && !window.__TYPHI__.snapshot().loading",timeout=30000)
 check('riverside map loads with valid geometry',page.evaluate('window.__TYPHI__.geometryAudit()')==[])
 seed=page.evaluate('window.__TYPHI__.snapshot().seed')
 page.locator('#new-town').click()
 page.wait_for_function('(previous)=>window.__TYPHI__.snapshot().seed!==previous && !window.__TYPHI__.snapshot().loading',arg=seed,timeout=30000)
 check('new-town control regenerates the current neighborhood',page.evaluate('window.__TYPHI__.snapshot().seed')!=seed and page.evaluate('window.__TYPHI__.snapshot().map')=='BEN_SONG')
 for i in range(5): page.evaluate('window.__TYPHI__.regenerate()')
 check('repeated map regeneration keeps valid geometry',page.evaluate('window.__TYPHI__.geometryAudit()')==[])
 page.locator('#map-select').select_option('CHO_VIA_HE')
 page.wait_for_function("window.__TYPHI__.snapshot().map === 'CHO_VIA_HE' && document.querySelector('#loading').classList.contains('hidden')",timeout=30000)
 page.set_viewport_size({'width':390,'height':844})
 page.wait_for_timeout(700)
 rect=page.locator('#game').bounding_box()
 check('portrait viewport keeps 9:16',abs(rect['width']/rect['height']-9/16)<.005,rect)
 check('mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
 page.locator('[data-mobile-mode="follow"]').click()
 page.evaluate('window.__TYPHI__.select(0);window.__TYPHI__.pause(false)')
 wait_for_phase(page,'moving',resolve_choices=True)
 page.wait_for_timeout(1800)
 page.screenshot(path=str(out/'mobile-follow.png'),full_page=True)
 check('mobile third-person control works',page.evaluate("window.__TYPHI__.snapshot().cameraView === 'follow'"))
 page.locator('.mobile-seat[data-seat="7"]').click()
 check('mobile character selection',page.evaluate('window.__TYPHI__.snapshot().seat')=='H')
 page.evaluate('window.__TYPHI__.pause(true)')
 page.set_viewport_size({'width':1440,'height':1000})
 page.wait_for_timeout(500)
 with page.expect_download() as info:page.locator('#capture').click()
 download=info.value;download.save_as(str(out/'capture-1080x1920.png'))
 from PIL import Image
 with Image.open(out/'capture-1080x1920.png') as image:check('screenshot export is exactly 1080x1920',image.size==(1080,1920))
 check('no browser app errors',not report['errors'],report['errors'])
 check('no failed requests',not report['failed_requests'],report['failed_requests'])
 report['final_snapshot']=page.evaluate('window.__TYPHI__.snapshot()')
 browser.close()
report['status']='PASS'
(out/'browser-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'PASS','checks':len(report['tests']),'screenshots':6,'errors':report['errors']}))
