"""Bundle source and assets as one browser-openable HTML page (no fetch)."""
from pathlib import Path
from html import escape
import base64,json,re
root=Path(__file__).resolve().parent
assets=root/'assets'
source=(root/'index.html').read_text()
css=(root/'style.css').read_text()
js=(root/'game.js').read_text()
images=['xeno_sheet.png','xeno_animation_10x4.png','pixel_font.png','marine_motion_8x4.png','lab_wall.jpg','lab_wall_alt.jpg','cover.png','menu_scene.jpg','soldier_tight.png','drone_tight.png','warrior_tight.png','praetorian_tight.png','boss_guardian_8x3.png','boss_siege_8x3.png','boss_queen_8x3.png']
audios=[f'{kind}{i:02}.ogg' for kind in ('stage','boss') for i in range(1,4)]
mapdata={}
for name in images+audios:
 mime='image/jpeg' if name.endswith('.jpg') else 'image/png' if name.endswith('.png') else 'audio/ogg'
 mapdata[name]='data:'+mime+';base64,'+base64.b64encode((assets/name).read_bytes()).decode('ascii')
source=source.replace('<link rel="stylesheet" href="style.css">','<style>\n'+css+'\n</style>')
audio='data:audio/mpeg;base64,'+base64.b64encode((assets/'stage01_music.mp3').read_bytes()).decode('ascii')
source=source.replace('src="assets/stage01_music.mp3"','src="'+audio+'"')
js=js.replace("image.src='assets/'+file;","image.src=window.HIVE_ASSETS[file]||'assets/'+file;")
js=js.replace("new Audio('assets/'+name+'.ogg')","new Audio(window.HIVE_ASSETS[name+'.ogg']||'assets/'+name+'.ogg')")
prefix='<script>window.HIVE_ASSETS='+json.dumps(mapdata,separators=(',',':'))+';</script>'
source=source.replace('<script src="game.js"></script>',prefix+'\n<script>\n'+js+'\n</script>')
output=root.parent/'XENOMORPH_HIVEBREAK_v07_PLAY.html'
output.write_text(source)
print(output,output.stat().st_size,'bytes, embedded',len(mapdata),'assets')
