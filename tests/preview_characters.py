from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/characters';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
s=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1600,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:print(m.type,m.text[:200],flush=True) if m.type=='error' else None)
 page.add_init_script('''let klass;Object.defineProperty(window,'HiveRenderer',{configurable:true,get:()=>klass,set:k=>klass=new Proxy(k,{construct(t,a){const r=Reflect.construct(t,a);window.__renderer=r;return r}})})''')
 page.goto(f'http://127.0.0.1:{s.server_port}/');page.wait_for_function('HIVEBREAK.renderer.charactersReady && HIVEBREAK.ready',timeout=120000)
 page.screenshot(path=str(OUT/'menu.png'));print('MODELS READY',page.evaluate('HIVEBREAK.renderer'),flush=True)
 page.evaluate('HIVEBREAK.start(0);HIVEBREAK.configure({quality3d:0});HIVEBREAK.players[0].x=320;HIVEBREAK.players[0].inv=10000;HIVEBREAK.simulate(210);HIVEBREAK.state.stageBanner=0;HIVEBREAK.state.announceT=0')
 page.wait_for_function('HIVEBREAK.renderer.skinned>=3',timeout=60000)
 page.screenshot(path=str(OUT/'battle.png'))
 print('POSE',page.evaluate('__renderer.rigs.get("p1").motion.debug'),flush=True)
 print('ERRORS',errors,flush=True);b.close()
s.shutdown()
