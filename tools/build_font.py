"""Build the checked-in monochrome Cyrillic atlas. Requires Pillow and DejaVu Sans Mono.
Glyph order is written to JSON so preview tools use the same mapping as the engine.
The atlas is distributed under the included DejaVu font license.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
root=Path(__file__).resolve().parent.parent
chars=' '+''.join(chr(c) for c in range(0x410,0x430))+'Ё'+''.join(chr(c) for c in range(0x430,0x450))+'ё'+'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?+-*/%()[]{}<>=\"\'№#&_|\\@$—–•▶◀↑↓←→…−'
assert len(chars)==len(set(chars))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',10)
img=Image.new('1',(16*7,((len(chars)+15)//16)*12))
d=ImageDraw.Draw(img)
for i,c in enumerate(chars):
 x=i%16*7;y=i//16*12
 d.text((x,y+10),c,font=font,fill=1,stroke_width=0,anchor='ls')
out=Image.new('RGBA',img.size,(255,255,255,0));out.putalpha(img.convert('L'));out.save(root/'assets/pixel_font.png')
(root/'assets/font_manifest.json').write_text(json.dumps({'chars':chars,'columns':16,'width':7,'height':12,'source':'DejaVu Sans Mono, monochrome raster at 10 px'},ensure_ascii=False,indent=2)+'\n')
print(chars,len(chars),img.size)
