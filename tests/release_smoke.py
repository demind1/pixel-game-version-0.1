"""Focused final portable build check: two players, max quality, compositor."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('html',type=Path);p.add_argument('--output',type=Path,default=Path('artifacts/release'));a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,value):
 assert value,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':800});errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if r.request.url=='http://offline.test/':r.fulfill(path=str(a.html),content_type='text/html')
  else:requests.append(r.request.url);r.abort()
 page.route('**/*',route);page.goto('http://offline.test/',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('HIVEBREAK.ready && HIVEBREAK.renderer.active',timeout=120000)
 check('latest standalone release boots in 3D offline',not requests)
 page.keyboard.press('ArrowDown');page.keyboard.press('Enter');page.wait_for_function('HIVEBREAK.coop && HIVEBREAK.screen==="select"')
 page.evaluate('''window.pad={index:0,connected:true,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[pad]});pad.buttons[9].pressed=true''')
 page.wait_for_function('HIVEBREAK.joined');page.evaluate('pad.buttons[9].pressed=false');page.keyboard.press('Enter')
 page.wait_for_function('HIVEBREAK.players.length===2 && HIVEBREAK.renderer.rigs>=2',timeout=30000)
 check('two independent players render in 3D co-op',page.evaluate('HIVEBREAK.players.length')==2)
 old=page.evaluate('HIVEBREAK.players[1].x');page.evaluate('pad.axes[0]=1')
 page.wait_for_function(f'HIVEBREAK.players[1].x>{old+6}',timeout=30000);page.evaluate('pad.axes[0]=0')
 check('controller moves second 3D player',page.evaluate('HIVEBREAK.players[1].x')>old+6)
 page.evaluate('HIVEBREAK.configure({quality3d:2})');page.wait_for_function('HIVEBREAK.renderer.quality===2 && HIVEBREAK.renderer.resolution[0]===1248',timeout=60000)
 check('maximum quality increases actual 3D resolution',page.evaluate('HIVEBREAK.renderer.resolution[0]')==1248)
 page.set_viewport_size({'width':3840,'height':2160})
 page.wait_for_function('HIVEBREAK.renderer.resolution[0]===2560',timeout=60000)
 check('4K viewport requests capped 2560-wide 3D target',page.evaluate('HIVEBREAK.renderer.resolution[0]')==2560)
 rects=page.evaluate('''[document.getElementById('game'),document.querySelector('.scene3d')].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})''')
 check('GPU canvas and HUD align at 4K',all(abs(rects[0][k]-rects[1][k])<=1 for k in ['x','y','w','h']))
 check('single composited WebGL layer',page.locator('.scene3d').count()==1)
 page.set_viewport_size({'width':1600,'height':1000});page.evaluate('HIVEBREAK.players.forEach(p=>p.inv=10000);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
 page.wait_for_function('HIVEBREAK.renderer.resolution[0]===1568',timeout=60000)
 page.screenshot(path=str(a.output/'coop-maximum.png'))
 check('no uncaught errors or external requests',not errors and not requests)
 (a.output/'release-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'requests':requests},ensure_ascii=False,indent=2));b.close()
print('PASS',len(checks),'final release checks',flush=True)
