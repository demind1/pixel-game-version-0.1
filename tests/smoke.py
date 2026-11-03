from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
import base64, json, re
root=Path(__file__).resolve().parent.parent
out=Path('/mnt/data')
html=(root/'index.html').read_text()
style=(root/'style.css').read_text()
js=(root/'game.js').read_text()
data={}
for f in (root/'assets').iterdir():
 if f.suffix.lower() not in ('.png','.jpg'): continue
 # Keyart not essential, yet included to test image loading
 if f.name in ('keyart.png','lab_wall_alt.jpg','drone.png','warrior.png','praetorian.png','soldier.png'):continue
 content=f.read_bytes()
 if f.name=='cover.png':
  im=Image.open(f);im.thumbnail((900,600));bf=BytesIO();im.save(bf,format='PNG',optimize=True);content=bf.getvalue()
 data[f.name]='data:image/'+('jpeg' if f.suffix.lower()=='.jpg' else 'png')+';base64,'+base64.b64encode(content).decode()
html=re.sub(r'<link rel="stylesheet" href="style.css">','<style>'+style+'</style>',html)
html=re.sub(r'<script src="game.js"></script>','<script>window.TEST_ASSETS='+json.dumps(data)+';\n'+js.replace("image.src='assets/'+file;","image.src=window.TEST_ASSETS[file]||'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9YUR/HwAAAABJRU5ErkJggg==';")+'</script>',html)
html=html.replace('src="assets/stage01_music.mp3"','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':1200,'height':750},device_scale_factor=1)
 errors=[];console=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:console.append((m.type,m.text)) if m.type in ('error','warning') else None)
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('HIVEBREAK.ready',timeout=30000)
 page.wait_for_timeout(250)
 print('menu',page.evaluate('HIVEBREAK.screen'))
 page.screenshot(path=str(out/'hive_menu.png'))
 page.keyboard.press('Enter');page.wait_for_timeout(190)
 print('select',page.evaluate('HIVEBREAK.screen'))
 page.screenshot(path=str(out/'hive_select.png'))
 page.keyboard.press('Enter');page.wait_for_timeout(750)
 print('game',page.evaluate('HIVEBREAK.screen'),'players',page.evaluate('HIVEBREAK.players.length'))
 page.screenshot(path=str(out/'hive_game.png'))
 page.keyboard.down('d');page.wait_for_timeout(1800);page.keyboard.up('d');page.wait_for_timeout(300)
 print('after move',page.evaluate('Math.round(HIVEBREAK.players[0].x)'),'enemies',page.evaluate('HIVEBREAK.enemies.length'))
 page.screenshot(path=str(out/'hive_fight.png'))
 for k in ('j','j','k','l','Shift',' '):
  page.keyboard.press(k);page.wait_for_timeout(180)
 page.wait_for_timeout(350)
 print('after combat:',page.evaluate('({score:HIVEBREAK.state.score, hp:HIVEBREAK.players[0].hp, energy:HIVEBREAK.players[0].energy, mode:HIVEBREAK.screen, boss:!!HIVEBREAK.state.boss})'))
 page.evaluate('HIVEBREAK.spawnBoss()');page.wait_for_timeout(200)
 page.screenshot(path=str(out/'hive_boss.png'))
 page.evaluate('HIVEBREAK.damageBoss(3000)');page.wait_for_timeout(2700)
 print('after boss:',page.evaluate('({screen:HIVEBREAK.screen,bossHp:HIVEBREAK.state.boss.hp,down:HIVEBREAK.state.bossDown})'))
 if page.evaluate('HIVEBREAK.screen')=='stageclear':page.screenshot(path=str(out/'hive_clear.png'))
 page.keyboard.press('Escape');page.wait_for_timeout(200)
 print('after escape',page.evaluate('HIVEBREAK.screen'))
 print('ERRORS:',errors[:10]);print('CONSOLE:',console[:10]);
 browser.close()
