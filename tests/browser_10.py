"""1.1 WebGL integration/visual checks. Actual shaders, models and bundled assets.
The CI browser uses a software GPU; reported timings are not hardware FPS claims.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import argparse,json,hashlib,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'artifacts/v1');parser.add_argument('--portable',type=Path)
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
checks=[]
def check(name,value):
 assert value,name
 checks.append(name);print('PASS',name,flush=True)
hook="""(() => {let value;Object.defineProperty(window,'HiveRenderer',{configurable:true,get:()=>value,set:klass=>{value=new Proxy(klass,{construct(target,args){const obj=Reflect.construct(target,args);window.__renderer=obj;return obj}})}})})()"""
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1600,'height':1000});page.add_init_script(hook)
 errors=[];missing=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:missing.append(r.url) if r.status>=400 and r.url.endswith(('.js','.png','.ogg','.mp3','.glb')) else None)
 page.goto(base);page.wait_for_function('HIVEBREAK.ready && HIVEBREAK.renderer.active && HIVEBREAK.renderer.drawCalls>1',timeout=120000)
 check('real WebGL2 backend initializes',page.evaluate('HIVEBREAK.renderer.backend')=='WebGL2')
 check('high resolution presentation canvas',page.locator('#game').evaluate('(c)=>c.width>=1440 && c.height>=810'))
 check('3D scene draws genuine geometry',page.evaluate('HIVEBREAK.renderer.triangles')>10000)
 page.screenshot(path=str(args.output/'menu-1.0.png'))
 page.keyboard.press('Enter');page.keyboard.press('Enter');page.wait_for_function('HIVEBREAK.screen==="playing"',timeout=30000)
 page.evaluate('HIVEBREAK.players[0].inv=10000;HIVEBREAK.simulate(200)')
 x=page.evaluate('HIVEBREAK.players[0].x');page.keyboard.down('d');page.wait_for_function(f'HIVEBREAK.players[0].x>{x+5}',timeout=30000);page.keyboard.up('d')
 check('3D gameplay responds to keyboard movement',page.evaluate('HIVEBREAK.players[0].x')>x+5)
 page.evaluate('HIVEBREAK.configure({quality3d:0});HIVEBREAK.players[0].x=320;HIVEBREAK.simulate(50)')
 page.wait_for_function('HIVEBREAK.renderer.quality===0',timeout=30000)
 check('low quality keeps genuine 3D running',page.evaluate('HIVEBREAK.renderer.active && HIVEBREAK.renderer.resolution[0]===640'))
 page.evaluate('HIVEBREAK.simulate(60)');page.keyboard.press('q');page.wait_for_function('HIVEBREAK.players[0].parryCd>0',timeout=30000)
 check('physical Q reaches parry in real browser',page.evaluate('HIVEBREAK.players[0].parryCd')>0)
 page.evaluate('HIVEBREAK.simulate(60)');page.keyboard.press('j');page.wait_for_function('HIVEBREAK.players[0].attack!==null',timeout=30000)
 check('attack drives a jointed 3D rig',page.evaluate('''() => {const p=HIVEBREAK.players[0],r=__renderer.rigs.get('p1'),t=HIVEBREAK.state.tick/60;p.attack=null;r.motion.update(p,t+.10,__renderer.config.attacks,'player');const idle=r.bones.get('hand_R').getWorldPosition(r.root.position.clone());p.attack='claw1';p.attackT=5;r.motion.update(p,t+.25,__renderer.config.attacks,'player');const moved=r.bones.get('hand_R').getWorldPosition(idle.clone());return r.skeletal&&r.tail.length===17&&r.skinned.length>=3&&moved.distanceTo(idle)>1}'''))
 page.evaluate('HIVEBREAK.configure({quality3d:1});HIVEBREAK.simulate(100);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
 page.wait_for_function('HIVEBREAK.renderer.quality===1',timeout=30000);page.screenshot(path=str(args.output/'fight-1.0.png'))
 page.keyboard.press('Escape');page.wait_for_function('HIVEBREAK.screen==="paused"')
 page.evaluate('HIVEBREAK.configure({reflections:true})');page.wait_for_function('HIVEBREAK.renderer.reflections===true')
 a=page.screenshot()
 page.evaluate('HIVEBREAK.configure({reflections:false})');page.wait_for_function('HIVEBREAK.renderer.reflections===false')
 c=page.screenshot();check('reflection pass changes rendered image',hashlib.sha256(a).digest()!=hashlib.sha256(c).digest())
 page.evaluate('HIVEBREAK.configure({reflections:true})');page.keyboard.press('Escape')
 for level in range(6):
  page.evaluate(f'HIVEBREAK.start(0);HIVEBREAK.configure({{quality3d:0}});HIVEBREAK.setLevel({level});HIVEBREAK.players[0].inv=10000;HIVEBREAK.players[0].x=320;HIVEBREAK.simulate(205);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
  page.wait_for_function(f'HIVEBREAK.renderer.stage==={level} && HIVEBREAK.renderer.rigs>=3',timeout=60000)
  check(f'mission {level+1} has a working 3D environment',page.evaluate('HIVEBREAK.renderer.active'))
  page.screenshot(path=str(args.output/f'sector-{level+1}.png'))
  page.evaluate('HIVEBREAK.spawnBoss();HIVEBREAK.players[0].x=HIVEBREAK.state.boss.x-110;HIVEBREAK.simulate(100);HIVEBREAK.state.announceT=0')
  page.wait_for_function('HIVEBREAK.renderer.boss===true',timeout=30000)
  check(f'boss {level+1} has an articulated 3D model',page.evaluate('__renderer.rigs.has("boss")'))
  check(f'boss {level+1} keeps its own skeletal equipment',page.evaluate(f'__renderer.rigs.get("boss").equipment.stage==={level} && __renderer.rigs.get("boss").equipment.count>0'))
  page.screenshot(path=str(args.output/f'boss-{level+1}.png'))
  page.evaluate('HIVEBREAK.damageBoss(100000);HIVEBREAK.simulate(150)')
  check(f'boss {level+1} defeat still advances gameplay',page.evaluate('HIVEBREAK.screen')=='stageclear')
 for w,h in [(1280,720),(1920,1080),(2560,1440),(3840,2160)]:
  page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
  rect=page.locator('#game').bounding_box()
  check(f'presentation fits {w}x{h}',rect['x']>=-1 and rect['y']>=-1 and rect['x']+rect['width']<=w+1 and rect['y']+rect['height']<=h+1)
  check(f'UI backing buffer follows {w}x{h}',page.locator('#game').evaluate('(c)=>c.width>=c.getBoundingClientRect().width-1'))
 # Genuine browser context loss switches to Canvas; restoration rebuilds GPU resources.
 page.evaluate('window.__lose=__renderer.renderer.getContext().getExtension("WEBGL_lose_context");__lose.loseContext()')
 page.wait_for_function('!HIVEBREAK.renderer.active',timeout=30000)
 check('context loss activates fallback',not page.evaluate('HIVEBREAK.renderer.active'))
 page.evaluate('__lose.restoreContext()')
 page.wait_for_function('HIVEBREAK.renderer.active && HIVEBREAK.renderer.charactersReady && HIVEBREAK.renderer.skinned>0 && !__renderer.needsRecreate',timeout=120000)
 check('context restoration recreates the renderer',page.evaluate('HIVEBREAK.renderer.active'))
 check('no uncaught 3D exceptions',not errors);check('no missing game dependencies',not missing)
 # The fallback is tested by actually denying creation of WebGL contexts.
 fallback=b.new_page();fallback.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).startsWith('webgl'))return null;return original.call(this,type,...args)}")
 fallback.goto(base);fallback.wait_for_function('HIVEBREAK.ready')
 fallback.keyboard.press('Enter');fallback.keyboard.press('Enter');fallback.wait_for_function('HIVEBREAK.screen==="playing"')
 check('denied WebGL keeps 2D campaign playable',not fallback.evaluate('HIVEBREAK.renderer.active'))
 page.close();fallback.close()
 if args.portable:
  p=b.new_page(viewport={'width':1280,'height':800});p.add_init_script(hook);requests=[]
  def fulfill(route):
   if route.request.url=='http://portable.test/':route.fulfill(path=str(args.portable),content_type='text/html')
   else:requests.append(route.request.url);route.abort()
  p.route('**/*',fulfill);p.goto('http://portable.test/',wait_until='domcontentloaded',timeout=120000);p.wait_for_function('HIVEBREAK.ready && HIVEBREAK.renderer.active',timeout=120000)
  p.keyboard.press('Enter');p.keyboard.press('Enter');p.wait_for_function('HIVEBREAK.screen==="playing"');check('portable HTML runs 3D without external requests',not requests)
 result={'passed':len(checks),'checks':checks,'errors':errors,'missing':missing,'GPU':'Chromium software WebGL (SwiftShader)'}
 (args.output/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));b.close()
server.shutdown();print('PASS',len(checks),'WebGL/browser assertions',flush=True)
