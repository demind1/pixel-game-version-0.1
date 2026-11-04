"""Record the actual browser, including UI and real gameplay actions.
The video is not an FPS benchmark: Chromium uses the cloud software GPU.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import subprocess,json,base64
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/v12/showcase';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
checks=[]
def check(name,value):
 assert value,name
 checks.append(name);print('PASS',name,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 context=b.new_context(viewport={'width':1280,'height':800})
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/');page.wait_for_function('HIVEBREAK.ready && HIVEBREAK.renderer.charactersReady',timeout=120000)
 page.keyboard.press('Enter');page.keyboard.press('Enter');page.wait_for_function('HIVEBREAK.screen==="playing"')
 page.wait_for_function('HIVEBREAK.music.playing && HIVEBREAK.music.seconds>.2',timeout=30000)
 check('original rock music actually plays in Chromium',page.evaluate('HIVEBREAK.music.style')=='rock' and page.evaluate('HIVEBREAK.music.track')=='rock_stage01')
 page.evaluate('HIVEBREAK.configure({quality3d:0});HIVEBREAK.players[0].inv=100000;HIVEBREAK.players[0].x=320;HIVEBREAK.simulate(210);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0;HIVEBREAK.enemies.forEach(e=>e.hp=e.maxHp=10000)')
 cdp=context.new_cdp_session(page);frames=[];frame_dir=OUT/'frames';frame_dir.mkdir(exist_ok=True)
 def capture(event):
  path=frame_dir/f'frame-{len(frames):05}.jpg';path.write_bytes(base64.b64decode(event['data']));frames.append((path,float(event['metadata']['timestamp'])));cdp.send('Page.screencastFrameAck',{'sessionId':event['sessionId']})
 cdp.on('Page.screencastFrame',capture);cdp.send('Page.startScreencast',{'format':'jpeg','quality':88,'maxWidth':1280,'maxHeight':800,'everyNthFrame':1})
 for k,duration in [('d',550),('a',300),('crawl',700),('j',170),('j',180),('k',650),('q',250),('Space',200),('j',500),('Shift',600),('l',1100)]:
  page.keyboard.down('ControlLeft') if k=='crawl' else None;page.keyboard.down('d' if k=='crawl' else k);page.wait_for_timeout(duration);page.keyboard.up('d' if k=='crawl' else k);page.keyboard.up('ControlLeft') if k=='crawl' else None;page.wait_for_timeout(140)
 # All four distinct models are rendered inside the actual game, not a mock viewer.
 for cls in range(4):
  page.evaluate(f'HIVEBREAK.start({cls});HIVEBREAK.players[0].x=320;HIVEBREAK.players[0].inv=10000;HIVEBREAK.simulate(210);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
  page.wait_for_timeout(350);page.screenshot(path=str(OUT/f'class-{cls}.png'))
  page.keyboard.down('d');page.wait_for_timeout(500);page.keyboard.up('d');page.keyboard.press('j');page.wait_for_timeout(400);page.keyboard.press('k');page.wait_for_timeout(550)
  check(f'class {cls+1} remains playable with skinned animation',page.evaluate('HIVEBREAK.renderer.skinned')>=1 and page.evaluate('HIVEBREAK.screen')=='playing')
 page.wait_for_timeout(200)
 check('recorded movement and attacks have no uncaught errors',not errors)
 cdp.send('Page.stopScreencast')
 page.set_viewport_size({'width':1600,'height':1000})
 page.evaluate('HIVEBREAK.start(0);HIVEBREAK.configure({quality3d:2});HIVEBREAK.players[0].x=320;HIVEBREAK.players[0].inv=10000;HIVEBREAK.simulate(210);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
 page.wait_for_function('HIVEBREAK.renderer.quality===2 && HIVEBREAK.renderer.resolution[0]===1568 && HIVEBREAK.renderer.skinned>=3',timeout=60000)
 page.screenshot(path=str(OUT/'maximum-character-detail.png'))
 check('final maximum-quality character scene renders without errors',not errors)
 context.close();b.close()
check('browser supplied actual video frames',len(frames)>10)
concat=OUT/'frames.txt'
with concat.open('w') as f:
 for i,(path,timestamp) in enumerate(frames):
  f.write("file '"+str(path)+"'\n");duration=frames[i+1][1]-timestamp if i+1<len(frames) else .1;f.write(f'duration {max(.001,duration):.6f}\n')
# Trim loading/menu time and encode a compact review copy of the genuine recording.
subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-an','-c:v','libx264','-preset','fast','-crf','25','-pix_fmt','yuv420p','-vf','fps=15','-movflags','+faststart',str(OUT/'movement-and-combat.mp4')],check=True)
(OUT/'results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'video':'movement-and-combat.mp4','note':'Real browser recording on software GPU; not a hardware FPS benchmark.'},ensure_ascii=False,indent=2));server.shutdown();print('PASS showcase',len(checks),'checks',flush=True)
