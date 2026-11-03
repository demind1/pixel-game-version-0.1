"""Real Chromium regression: actual HTML, scripts, images and audio over HTTP.

No asset substitution. Diagnostic hooks position actors/finish bosses; this tests
systems and campaign transitions, not the subjective difficulty of a full run.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import argparse
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT / 'artifacts')
parser.add_argument('--portable', type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
checks = []
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS', name, flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    # This suite validates retained Canvas gameplay. browser_10.py covers WebGL.
    page.add_init_script("try{const s=JSON.parse(localStorage.getItem('xh_settings')||'{}');s.threeD=false;localStorage.setItem('xh_settings',JSON.stringify(s))}catch{}")
    errors, missing = [], []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('response', lambda res: missing.append(res.url) if res.status >= 400 and '/assets/' in res.url else None)
    page.goto(origin)
    page.wait_for_function('window.HIVEBREAK?.ready')
    check('menu and real assets load', page.evaluate('HIVEBREAK.screen') == 'menu' and not missing)
    page.screenshot(path=str(args.output / 'menu-after.png'))
    page.keyboard.press('ArrowDown');page.keyboard.press('ArrowDown');page.keyboard.press('Enter')
    check('settings open', page.evaluate('HIVEBREAK.screen') == 'options')
    for tab in range(4):
        page.screenshot(path=str(args.output / f'settings-{tab}.png'))
        page.keyboard.press('e')
    page.keyboard.press('e');page.keyboard.press('e')
    master=page.evaluate('HIVEBREAK.settings.master')
    page.keyboard.press('ArrowLeft')
    check('master volume setting changes', page.evaluate('HIVEBREAK.settings.master') < master)
    page.keyboard.press('e')  # controls: remap physical movement up
    page.keyboard.press('Enter');page.keyboard.press('i')
    check('physical key binding saved', page.evaluate('HIVEBREAK.settings.bindings.up') == 'KeyI')
    page.reload();page.wait_for_function('HIVEBREAK.ready')
    check('settings persist after reload', page.evaluate('HIVEBREAK.settings.bindings.up') == 'KeyI')
    # Return to factory bindings for the following controls tests.
    page.evaluate("localStorage.removeItem('xh_settings')")
    page.reload();page.wait_for_function('HIVEBREAK.ready')
    page.keyboard.press('Enter')
    page.screenshot(path=str(args.output / 'select.png'))
    page.keyboard.press('Enter')
    page.wait_for_function('HIVEBREAK.screen === "playing"')
    page.wait_for_timeout(100)
    x = page.evaluate('HIVEBREAK.players[0].x')
    page.keyboard.down('d'); page.wait_for_timeout(200); page.keyboard.up('d')
    check('English physical movement', page.evaluate('HIVEBREAK.players[0].x') > x + 8)
    x = page.evaluate('HIVEBREAK.players[0].x')
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'в',code:'KeyD'}))")
    page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{key:'в',code:'KeyD'}))")
    check('Russian layout physical movement', page.evaluate('HIVEBREAK.players[0].x') > x + 8)
    page.keyboard.press('Space'); page.wait_for_timeout(100)
    check('jump rises above ground', page.evaluate('HIVEBREAK.players[0].z') > 0)
    page.wait_for_timeout(700)
    check('jump lands on ground', page.evaluate('HIVEBREAK.players[0].z') == 0)
    for cls in range(4):
        page.evaluate(f'HIVEBREAK.start({cls})')
        page.keyboard.press('l'); page.wait_for_timeout(100)
        check(f'class {cls + 1} special spends energy', page.evaluate('HIVEBREAK.players[0].energy') < 75)
        page.wait_for_timeout(900)
        page.evaluate('HIVEBREAK.players[0].energy=100')
        page.keyboard.press('u'); page.wait_for_timeout(100)
        check(f'class {cls + 1} ultimate spends energy', page.evaluate('HIVEBREAK.players[0].energy') < 35)
    page.evaluate('HIVEBREAK.start(0)')
    page.keyboard.press('Escape')
    tick = page.evaluate('HIVEBREAK.state.tick')
    page.wait_for_timeout(200)
    check('pause freezes simulation', page.evaluate('HIVEBREAK.state.tick') == tick)
    page.keyboard.press('Escape')
    page.keyboard.down('d')
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    check('focus loss pauses', page.evaluate('HIVEBREAK.screen') == 'paused')
    page.keyboard.up('d'); page.keyboard.press('Escape')
    x = page.evaluate('HIVEBREAK.players[0].x'); page.wait_for_timeout(150)
    check('focus loss clears held movement', abs(page.evaluate('HIVEBREAK.players[0].x') - x) < 1)

    # All six actual level renderers, boss AI and phases, and result transitions.
    for level in range(6):
        page.evaluate(f'HIVEBREAK.start(0);HIVEBREAK.setLevel({level})')
        check(f'mission {level+1} exists', page.evaluate('HIVEBREAK.state.level') == level)
        page.evaluate('HIVEBREAK.players[0].inv=10000;HIVEBREAK.players[0].x=320')
        page.wait_for_timeout(100)
        check(f'mission {level+1} starts waves', page.evaluate('HIVEBREAK.enemies.length') > 0)
        page.wait_for_timeout(3100)
        page.screenshot(path=str(args.output / f'mission-{level+1}.png'))
        page.evaluate('HIVEBREAK.spawnBoss();HIVEBREAK.players[0].x=HIVEBREAK.state.boss.x-110;HIVEBREAK.players[0].y=221')
        page.wait_for_timeout(800)
        check(f'boss {level+1} camera reaches arena', page.evaluate('Math.abs(HIVEBREAK.players[0].x-HIVEBREAK.state.camera-187)') < 35)
        page.screenshot(path=str(args.output / f'boss-{level+1}.png'))
        page.evaluate('HIVEBREAK.state.boss.hp=HIVEBREAK.state.boss.maxHp*.52')
        page.wait_for_timeout(100)
        check(f'boss {level+1} phase two', page.evaluate('HIVEBREAK.state.boss.phase') == 2)
        page.evaluate('HIVEBREAK.state.boss.hp=HIVEBREAK.state.boss.maxHp*.20')
        page.wait_for_timeout(100)
        check(f'boss {level+1} phase three', page.evaluate('HIVEBREAK.state.boss.phase') == 3)
        page.evaluate('HIVEBREAK.damageBoss(100000)')
        page.wait_for_function('HIVEBREAK.screen==="stageclear"', timeout=10000)
        page.keyboard.press('Enter')
        expected = 'victory' if level == 5 else 'playing'
        check(f'mission {level+1} result advances', page.evaluate('HIVEBREAK.screen') == expected)
    page.screenshot(path=str(args.output / 'victory.png'))

    # Independent co-op through a Gamepad API fixture. No physical controller is claimed.
    page.keyboard.press('Escape'); page.keyboard.press('ArrowDown'); page.keyboard.press('Enter')
    check('co-op selection opens', page.evaluate('HIVEBREAK.coop && HIVEBREAK.screen==="select"'))
    page.evaluate('''() => {window.pad={index:0,connected:true,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false,value:0}))};
        Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});pad.buttons[9].pressed=true;}''')
    page.wait_for_timeout(100); page.evaluate('pad.buttons[9].pressed=false'); page.wait_for_timeout(100)
    page.keyboard.press('Enter'); page.wait_for_timeout(100)
    check('co-op joins second player', page.evaluate('HIVEBREAK.players.length') == 2)
    x1, x2 = page.evaluate('HIVEBREAK.players.map(p=>p.x)')
    page.evaluate('pad.axes[0]=1'); page.wait_for_timeout(220); page.evaluate('pad.axes[0]=0')
    positions = page.evaluate('HIVEBREAK.players.map(p=>p.x)')
    check('controller moves only player two', abs(positions[0]-x1) < 1 and positions[1] > x2+8)
    page.screenshot(path=str(args.output / 'coop.png'))

    for width, height in [(1280,720),(1920,1080),(2560,1440),(3840,2160),(1024,768)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(80)
        bounds = page.locator('#game').bounding_box()
        check(f'canvas fits {width}x{height}', bounds['x'] >= -1 and bounds['y'] >= -1 and
            bounds['x']+bounds['width'] <= width+1 and bounds['y']+bounds['height'] <= height+1 and
            abs(bounds['width']/bounds['height']-16/9) < .02)
        page.screenshot(path=str(args.output / f'resolution-{width}.png'))

    check('no uncaught browser exceptions', not errors)
    check('no missing requested assets', not missing)
    # Bounded crowded scene in the real renderer, with both players and boss.
    page.set_viewport_size({'width':1280,'height':720})
    page.evaluate('''() => {
        HIVEBREAK.setLevel(5);HIVEBREAK.players.forEach(p=>{p.x=320;p.inv=10000});
    }''')
    page.wait_for_timeout(100)
    page.evaluate('''() => {
        const g=HIVEBREAK.state,base=g.enemies[0];
        g.enemies=HIVEBREAK.enemyTypes.map((type,i)=>({...base,id:i+.123,type,x:360+i%4*20,y:200+i%3*17,hp:500,maxHp:500,dead:false,heldBy:null}));
        g.particles=Array.from({length:540},(_,i)=>({x:300+i%50,y:100+i%100,vx:.01,vy:0,t:500,maxT:500,size:2,color:'#9dceac'}));
        HIVEBREAK.spawnBoss();g.boss.x=570;g.camera=130;
        window.frameCosts=[];
        const native=window.requestAnimationFrame;
        window.requestAnimationFrame=cb=>native.call(window,t=>{const a=performance.now();cb(t);frameCosts.push(performance.now()-a)});
    }''')
    page.wait_for_timeout(1800)
    performance_result=page.evaluate('''() => {
        const a=frameCosts.sort((x,y)=>x-y);
        return {frames:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],
            particles:HIVEBREAK.state.particles.length,enemies:HIVEBREAK.enemies.length};
    }''')
    check('crowded scene renders without exceptions', performance_result['frames'] > 5 and not errors)
    (args.output/'performance.json').write_text(json.dumps(performance_result,indent=2))
    fallback=browser.new_page()
    fallback_errors=[]
    fallback.on('pageerror',lambda err:fallback_errors.append(str(err)))
    fallback.route('**/assets/xeno_reforged.png',lambda route:route.abort())
    fallback.goto(origin);fallback.wait_for_function('HIVEBREAK.ready')
    fallback.keyboard.press('Enter');fallback.keyboard.press('Enter')
    fallback.wait_for_timeout(200)
    check('missing optional art uses playable fallback',fallback.evaluate('HIVEBREAK.screen')=='playing' and not fallback_errors)
    font=browser.new_page(viewport={'width':1400,'height':800})
    font.goto(origin+'/typography.html')
    font.wait_for_function('window.FONT_QA')
    font.screenshot(path=str(args.output/'font-preview.png'))
    check('Cyrillic font specimen renders',font.evaluate('FONT_QA.missing.length===0'))
    if args.portable:
        portable = browser.new_page()
        # A route fulfills the generated document; every resource must be embedded.
        await_requests = []
        portable.route('**/*', lambda route: route.fulfill(path=str(args.portable), content_type='text/html')
            if route.request.url == 'http://portable.test/' else (await_requests.append(route.request.url),route.abort())[1])
        portable.on('pageerror', lambda err: errors.append(str(err)))
        portable.goto('http://portable.test/')
        portable.wait_for_function('HIVEBREAK.ready')
        portable.keyboard.press('Enter'); portable.keyboard.press('Enter')
        portable.wait_for_function('HIVEBREAK.screen === "playing"')
        check('portable HTML boots without external assets', not await_requests and not errors)
    (args.output/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,
        'errors':errors,'missing':missing},ensure_ascii=False,indent=2))
    browser.close()
server.shutdown()
print(f'PASS: {len(checks)} browser assertions')
