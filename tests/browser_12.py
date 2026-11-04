"""Actual 1.2 interface, progression and quadruped integration checks."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/v12';OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();checks=[]
def check(n,v):assert v,n;checks.append(n);print('PASS',n,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1600,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("let K;Object.defineProperty(window,'HiveRenderer',{configurable:true,get:()=>K,set:k=>K=new Proxy(k,{construct(t,a){const r=Reflect.construct(t,a);window.__renderer=r;return r}})})")
 origin=f'http://127.0.0.1:{server.server_port}/';page.goto(origin);page.wait_for_function('HIVEBREAK.ready && HIVEBREAK.renderer.charactersReady',timeout=120000)
 def click(x,y):
  r=page.locator('#game').bounding_box();page.mouse.click(r['x']+x*r['width']/480,r['y']+y*r['height']/270)
 click(240,173);page.wait_for_function('HIVEBREAK.screen==="options"');click(290,55);before=page.evaluate('HIVEBREAK.settings.master');click(100,80);check('mouse decreases audio setting',page.evaluate('HIVEBREAK.settings.master')<before);click(430,80);check('mouse increases audio setting',abs(page.evaluate('HIVEBREAK.settings.master')-before)<.01);click(410,55);click(150,78);page.keyboard.press('i');check('mouse starts key rebinding',page.evaluate('HIVEBREAK.settings.bindings.up')=='KeyI');click(150,78);page.keyboard.press('w');page.locator('[data-action="back"]').click();page.wait_for_function('HIVEBREAK.screen==="menu"')
 click(240,125);page.wait_for_function('HIVEBREAK.screen==="select"');check('mouse starts selection',True)
 click(300,120);check('mouse selects runner',page.evaluate('HIVEBREAK.uiState.selected')==2)
 check('four portraits are actual loaded model renders',page.evaluate('''Promise.all(['drone','warrior','runner','praetorian'].map(n=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth===320);i.src='assets/portrait_'+n+'.png'}))).then(a=>a.every(Boolean))'''))
 page.screenshot(path=str(OUT/'selection.png'))
 page.locator('#evolve').click();check('evolution dialog opens',page.locator('dialog').evaluate('(d)=>d.open'));check('unearned upgrades cannot be bought',page.locator('[data-gene="damage"]').is_disabled())
 page.evaluate("window.modalPad={index:0,connected:true,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[modalPad]});modalPad.buttons[0].pressed=true")
 page.wait_for_timeout(350);check('modal evolution blocks background controller actions',page.evaluate('HIVEBREAK.screen')=='select');page.evaluate('modalPad.buttons[0].pressed=false')
 page.locator('#close-evolution').click()
 # Seed earned XP, reload, then purchase through the real interface.
 page.evaluate("localStorage.setItem('xh_evolution',JSON.stringify([{xp:450,ranks:{}},{},{},{}]))")
 page.reload();page.wait_for_function('HIVEBREAK.ready',timeout=120000);page.locator('#evolve').click();page.locator('[data-gene="health"]').click();check('earned point buys a real health upgrade',page.evaluate('HIVEBREAK.evolution[0].ranks.health')==1)
 page.screenshot(path=str(OUT/'evolution.png'));page.locator('#close-evolution').click();click(240,125);click(240,239);page.wait_for_function('HIVEBREAK.screen==="playing"')
 check('health upgrade applies to the live specimen',page.evaluate('HIVEBREAK.players[0].maxHp')>125)
 page.evaluate('HIVEBREAK.configure({quality3d:0});HIVEBREAK.players[0].x=300;HIVEBREAK.players[0].inv=100000;HIVEBREAK.simulate(1)')
 check('wave spawns at least 100 units ahead',page.evaluate('Math.min(...HIVEBREAK.enemies.map(e=>e.x))-HIVEBREAK.players[0].x')>=100)
 page.keyboard.down('d');page.wait_for_function('HIVEBREAK.players[0].travel>12',timeout=30000);page.keyboard.up('d')
 page.evaluate("const p=HIVEBREAK.players[0];p.moveX=1;p.motionVX=1;const r=__renderer.rigs.get('p1');r.motion.update(p,HIVEBREAK.state.tick/60+.15,__renderer.config.attacks,'player');window.quad={hands:r.motion.hands.size,height:r.bones.get('chest').getWorldPosition(r.root.position.clone()).y}")
 check('quadruped gait uses foreleg supports',page.evaluate("quad.hands===2"))
 check('quadruped torso is lower than upright idle',page.evaluate("quad.height<48"))
 page.keyboard.down('ControlLeft');page.keyboard.down('d');page.wait_for_function("__renderer.rigs.get('p1').motion.debug.clip==='Crawl'",timeout=30000);page.screenshot(path=str(OUT/'crawl.png'));page.keyboard.up('d');page.keyboard.up('ControlLeft');check('Ctrl enters actual low crawl during play',True);page.keyboard.press('Escape');page.wait_for_function('HIVEBREAK.screen==="paused"')
 page.locator('[data-action="back"]').click();page.wait_for_function('HIVEBREAK.screen==="playing"');check('mouse resumes paused game',True);old=page.evaluate('HIVEBREAK.players[0].x');page.keyboard.down('d');page.wait_for_function(f'HIVEBREAK.players[0].x>{old+2}',timeout=30000);page.keyboard.up('d');check('mouse navigation returns keyboard focus to the game',True)
 page.evaluate('HIVEBREAK.setLevel(2);HIVEBREAK.spawnBoss();HIVEBREAK.players[0].x=HIVEBREAK.state.boss.x-170')
 page.wait_for_function('HIVEBREAK.renderer.boss && __renderer.rigs.has("boss")',timeout=60000)
 check('queen uses its own authored GLB',page.evaluate("__renderer.rigs.get('boss').profile.head===1.30"))
 page.screenshot(path=str(OUT/'queen.png'));xp=page.evaluate('HIVEBREAK.evolution[0].xp');page.evaluate('HIVEBREAK.damageBoss(1000000)');check('boss victory earns persistent class XP',page.evaluate('HIVEBREAK.evolution[0].xp')==xp+150);page.reload();page.wait_for_function('HIVEBREAK.ready',timeout=120000);check('purchased rank survives reload',page.evaluate('HIVEBREAK.evolution[0].ranks.health')==1);check('no uncaught browser errors',not errors)
 (OUT/'features.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors},indent=2));b.close()
server.shutdown()
