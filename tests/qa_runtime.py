from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
import base64,json,re,time
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text();style=(root/'style.css').read_text();js=(root/'game.js').read_text();data={}
for filename in ('xeno_sheet.png','soldier_tight.png','praetorian_tight.png','lab_wall.jpg','lab_wall_alt.jpg','menu_scene.jpg','cover.png'):
 f=root/'assets'/filename
 content=f.read_bytes()
 data[filename]='data:image/'+('jpeg' if filename.endswith('.jpg') else 'png')+';base64,'+base64.b64encode(content).decode()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+style+'</style>')
html=html.replace('<script src="game.js"></script>','<script>window.TEST_ASSETS='+json.dumps(data)+';\n'+js.replace("image.src='assets/'+file;","image.src=window.TEST_ASSETS[file]||'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9YUR/HwAAAABJRU5ErkJggg==';")+'</script>')
html=html.replace('src="assets/stage01_music.mp3"','')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1200,'height':750});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('HIVEBREAK.ready')
 def jsget(code):return page.evaluate(code)
 def test(name,condition):
  print(('PASS' if condition else 'FAIL')+' '+name)
  if not condition:raise AssertionError(name)
 page.keyboard.press('Enter');page.keyboard.press('Enter');page.wait_for_timeout(350)
 test('solo starts with one player',jsget('HIVEBREAK.screen')=='playing' and jsget('HIVEBREAK.players.length')==1)
 p_x=jsget('HIVEBREAK.players[0].x');page.keyboard.down('d');page.wait_for_timeout(420);page.keyboard.up('d');page.wait_for_timeout(150)
 test('keyboard movement',jsget('HIVEBREAK.players[0].x')>p_x+10)
 # Activate wave and put enemy in actual range; verify delayed attack damage.
 page.evaluate('HIVEBREAK.players[0].x=280');page.wait_for_timeout(100)
 test('wave spawns',jsget('HIVEBREAK.enemies.length')>0)
 page.evaluate('''() => {let e=HIVEBREAK.enemies.find(e=>!e.dead),p=HIVEBREAK.players[0];p.x=e.x-44;p.y=e.y;p.face=1;p.stun=0;p.inv=0;p.attack=null;p.chain=0;}''')
 enemyHP=jsget('HIVEBREAK.enemies.find(e=>!e.dead).hp')
 page.keyboard.press('j');page.wait_for_timeout(330)
 test('melee hit damages enemy',jsget('HIVEBREAK.enemies.find(e=>!e.dead).hp')<enemyHP)
 test('successful hit awards score',jsget('HIVEBREAK.state.score')>0)
 p=jsget('HIVEBREAK.players[0].x');page.keyboard.press('Escape');page.wait_for_timeout(200)
 test('escape pauses',jsget('HIVEBREAK.screen')=='paused')
 page.keyboard.down('d');page.wait_for_timeout(350);page.keyboard.up('d');test('pause freezes world',abs(jsget('HIVEBREAK.players[0].x')-p)<1)
 page.keyboard.press('Escape');page.wait_for_timeout(130);test('escape resumes',jsget('HIVEBREAK.screen')=='playing')
 # Boss phase + full victory pipeline
 for lev in range(3):
  page.evaluate('HIVEBREAK.spawnBoss()');page.wait_for_timeout(100)
  page.evaluate('''() => {let b=HIVEBREAK.state.boss,p=HIVEBREAK.players[0];p.x=b.x-155;p.y=b.y;p.hp=p.maxHp;p.inv=200;}''')
  page.wait_for_timeout(150)
  if lev==0:page.screenshot(path='/mnt/data/hive_boss_near.png')
  bossHP=jsget('HIVEBREAK.state.boss.maxHp')
  page.evaluate('HIVEBREAK.damageBoss('+str(int(bossHP*.45))+')');page.wait_for_timeout(130)
  test('boss phase 2, level '+str(lev+1),jsget('HIVEBREAK.state.boss.phase')>=2)
  page.evaluate('HIVEBREAK.damageBoss('+str(int(bossHP*1.1))+')');page.wait_for_timeout(2450)
  test('boss elimination advances to result level '+str(lev+1),jsget('HIVEBREAK.screen')=='stageclear')
  page.keyboard.press('Enter');page.wait_for_timeout(170)
  if lev<2:test('next level '+str(lev+2),jsget('HIVEBREAK.state.level')==lev+1 and jsget('HIVEBREAK.screen')=='playing')
 test('final victory',jsget('HIVEBREAK.screen')=='victory')
 # Four distinct classes; energy costs and special attacks
 for cl in range(4):
  page.evaluate('HIVEBREAK.start('+str(cl)+')');page.wait_for_timeout(120)
  page.keyboard.press('l');page.wait_for_timeout(120)
  state=jsget('({name:HIVEBREAK.players[0].attack,energy:HIVEBREAK.players[0].energy})')
  test('class '+str(cl)+' unique special '+str(state['name']),state['energy']<70.5)
 # Local two-player join & independent gamepad movement
 page.keyboard.press('Escape');page.keyboard.press('Escape');page.wait_for_timeout(180)
 # menu, select CO-OP using keyboard
 if jsget('HIVEBREAK.screen')!='menu':page.evaluate('HIVEBREAK.start(0)')
 page.evaluate('HIVEBREAK.start(0)');page.keyboard.press('Escape');page.wait_for_timeout(150)
 page.keyboard.press('ArrowDown');page.keyboard.press('ArrowDown');page.keyboard.press('ArrowDown');page.keyboard.press('Enter');page.wait_for_timeout(160)
 test('main menu recovery',jsget('HIVEBREAK.screen')=='menu')
 # pick CO-OP with pointer (menu index may vary)
 rect=page.locator('#game').bounding_box();page.mouse.click(rect['x']+rect['width']*.5,rect['y']+rect['height']*(149/270))
 test('co-op select',jsget('HIVEBREAK.screen')=='select')
 print('COOP pre join:',jsget('({screen:HIVEBREAK.screen,coop:HIVEBREAK.coop,joined:HIVEBREAK.joined})'))
 # mock Gamepad object, press Start for >one update tick
 page.evaluate('''() => {window.fakepad={index:0,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.fakepad]});window.fakepad.buttons[9].pressed=true;}''')
 page.wait_for_timeout(110)
 page.evaluate('fakepad.buttons[9].pressed=false')
 page.wait_for_timeout(70)
 page.keyboard.press('Enter');page.wait_for_timeout(160)
 print('COOP after join:',jsget('({screen:HIVEBREAK.screen,coop:HIVEBREAK.coop,joined:HIVEBREAK.joined,players:HIVEBREAK.players.length})'))
 test('co-op started with two players',jsget('HIVEBREAK.players.length')==2)
 pos=jsget('HIVEBREAK.players[1].x');page.evaluate('fakepad.axes[0]=1');page.wait_for_timeout(380);page.evaluate('fakepad.axes[0]=0')
 test('player 2 can independently move using controller',jsget('HIVEBREAK.players[1].x')>pos+10)
 test('no uncaught JS errors',len(errors)==0)
 print('ALL QA PASS. Errors:',errors)
 b.close()
