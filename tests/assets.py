"""Check font mapping/coverage and authored animation sheets, not substitute images."""
import json,re,math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/font_manifest.json').read_text())
chars=json.loads(re.search(r'const FONT_CHARS=(".*?");',(root/'game.js').read_text()).group(1))
assert chars==manifest['chars'], 'Runtime glyph order differs from atlas manifest'
assert len(chars)==len(set(chars))
im=Image.open(root/'assets/pixel_font.png').convert('RGBA')
w,h,cols=manifest['width'],manifest['height'],manifest['columns']
assert im.size==(w*cols,h*math.ceil(len(chars)/cols))
for ch in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя0123456789':
 i=chars.index(ch);cell=im.crop((i%cols*w,i//cols*h,(i%cols+1)*w,(i//cols+1)*h))
 assert cell.getchannel('A').getbbox(), f'Missing visible glyph {ch}'
for name,size in [('xeno_reforged.png',(8*112,4*22*112)),('marine_reforged.png',(8*80,7*96)),('boss_reforged.png',(8*224,9*176))]:
 a=Image.open(root/'assets'/name)
 assert a.size==size, (name,a.size,size)
 print(name,a.size)
 assert a.getbbox(),name
assert '−' in chars and 'ё' in chars
print('PASS glyph mapping, Cyrillic coverage, visible glyphs and animation assets')
