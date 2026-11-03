"""Reproducible articulated pixel poses. No optical flow or warped source frames.
Keeps supplied xenomorph head/chest; new arms, claw silhouettes, legs and tail
are authored with joint coordinates and layered pixel outlines. Four silhouettes
share the animation vocabulary, while armor/crest and proportions differ.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math
P=Path(__file__).resolve().parent.parent/'assets'
S=112
STATES=['idle','walk','run','dash','jumpstart','rising','falling','landing','claw1','claw2','claw3','heavy','tail','air','special','ultimate','grab','throw','hurt','stun','death','victory']
source=Image.open(P/'xeno_sheet.png').convert('RGBA')
base=source.crop((0,0,round(source.width/4),round(source.height/4))).resize((112,112),Image.Resampling.NEAREST)
core=Image.new('RGBA',(S,S)); mask=Image.new('L',(S,S));md=ImageDraw.Draw(mask)
# The torso/biomechanical dome is retained. Limbs/tail are replaced, not warped.
md.polygon([(46,9),(83,4),(102,18),(105,39),(85,50),(75,73),(52,71),(45,55),(47,43),(37,38),(38,21)],fill=255)
core.paste(base,(0,0),mask)
core.putalpha(Image.composite(base.getchannel('A'),Image.new('L',(S,S)),mask))
OUT='#080e1c'; DARK='#142334'; MID='#2b4052'; LIT='#556679'; EDGE='#8c9ca7'
def limb(d,points,width,shade=MID):
 points=[(round(x),round(y)) for x,y in points]
 d.line(points,fill=OUT,width=width+4)
 for x,y in points: d.ellipse((x-width//2-1,y-width//2-1,x+width//2+1,y+width//2+1),fill=OUT)
 d.line(points,fill=shade,width=width)
 d.line([(x-1,y-1) for x,y in points],fill=LIT,width=max(1,width//3))
 for x,y in points[1:-1]:
  d.ellipse((x-3,y-3,x+2,y+2),fill=DARK,outline=EDGE)

def pose(state,k,cls):
 im=Image.new('RGBA',(S,S));d=ImageDraw.Draw(im)
 phase=k/8*math.tau; stride=math.sin(phase)
 running=state in ['run','dash']; walking=state in ['walk','run']
 bob=round(math.sin(phase*2)*1.5) if walking else (1 if k in [3,4,5] else 0)
 hip=(60,70+bob); shoulder=(71,46+bob)
 # Five deliberately different attack key silhouettes: coil, windup, contact,
 # follow-through, recovery. Attack clocks select these directly at hit windows.
 amount=[0,.25,.75,1,1,.65,.2,0][k]
 left=[(53,74+bob),(42-stride*(12 if walking else 0),87),(44-stride*(17 if walking else 0),100)]
 right=[(66,73+bob),(76+stride*(10 if walking else 0),87),(73+stride*(17 if walking else 0),100)]
 arms=[[(58,46+bob),(49,60+bob),(61,68+bob)],[(74,47+bob),(83,59+bob),(78,72+bob)]]
 tail=[(52,69+bob),(33,76),(19,69),(11,48),(17,28),(28,21)]
 tail=[(x,y+math.sin(phase+i*.9)*2) for i,(x,y) in enumerate(tail)]
 if state in ['dash','jumpstart','landing']:
  left=[(52,75),(36,85),(47,98)];right=[(65,73),(84,79),(72,99)]
  arms=[[(58,51),(40,61),(27,65)],[(73,51),(92,62),(105,65)]]
  tail=[(52,70),(32,61),(15,55),(3,49),(0,40)]
 if state in ['rising','falling','air']:
  left=[(53,73),(42,87),(48,96)];right=[(65,72),(83,78),(77,88)]
  arms=[[(58,45),(48,57),(36,49)],[(73,45),(84,54),(99,47)]]
  tail=[(52,70),(35,79),(26,91),(17,105),(4,107)]
 if state=='claw1': arms[1]=[(73,47),(81+amount*8,56-amount*11),(69+amount*38,70-amount*22)]
 if state=='claw2': arms[0]=[(58,46),(51+amount*35,40),(53+amount*49,29+amount*39)]
 if state in ['claw3','ultimate','special']:
  arms=[[(58,46),(56+amount*24,34+amount*21),(66+amount*38,23+amount*34)],[(73,47),(81+amount*12,35+amount*20),(90+amount*17,22+amount*33)]]
  if state=='special': arms[1]=[(73,47),(83,51),(105,45)]
 if state in ['heavy','tail','throw']:
  tail=[(52,70),(35,69-amount*30),(23+amount*22,52-amount*33),(15+amount*63,28-amount*4),(28+amount*76,21+amount*38)]
  arms=[[(58,46),(45,58),(43,69)],[(73,47),(83,58),(97,55)]]
 if state=='grab': arms=[[(58,46),(69,55),(88,57)],[(73,47),(87,55),(104,54)]]
 if state in ['hurt','stun']:
  arms=[[(58,46),(42,43),(36,58)],[(73,47),(83,65),(76,78)]]
  left=[(53,74),(45,83),(32,101)];right=[(65,73),(69,89),(82,100)]
 if state=='victory': arms=[[(58,46),(43,30),(48,12)],[(73,47),(87,30),(85,12)]]
 # Far limbs and tail are drawn behind the original chest.
 limb(d,tail,5,DARK)
 for i in range(len(tail)-1):
  a,b=tail[i],tail[i+1]
  for t in [.2,.5,.8]:
   x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
   d.line((round(x),round(y),round(x-2),round(y-3)),fill=EDGE,width=1)
 tip=tail[-1];d.polygon([(tip[0]-4,tip[1]+3),(tip[0]+5,tip[1]-5),(tip[0]+2,tip[1]+5)],fill=LIT,outline=OUT)
 for leg in [left,right]:
  limb(d,leg,7)
  fx,fy=leg[-1];d.polygon([(fx-4,fy-1),(fx+8,fy),(fx+12,fy+3),(fx-5,fy+3)],fill=MID,outline=OUT)
  for t in [3,7,11]:d.line((fx+t,fy+1,fx+t+2,fy+3),fill=EDGE,width=1)
 limb(d,arms[0],5,DARK)
 im.alpha_composite(core,(0,bob))
 d=ImageDraw.Draw(im)
 # Six rib plates and separate highlights bind the new joints to the chest.
 for i in range(5):
  x=53+i//2;y=53+i*3+bob
  d.line([(x,y),(x+9,y+2),(x+15,y)],fill=LIT,width=1)
 if cls==1: # Warrior: shoulder blades, heavier joint armor.
  for x in [49,73]:d.polygon([(x,44+bob),(x-6,34+bob),(x+6,39+bob),(x+10,49+bob)],fill=MID,outline=EDGE)
 if cls==3: # Praetorian: a separate crown, not merely a hue change.
  for x in range(56,87,7):d.polygon([(x,17),(x-5,0),(x+7,11),(x+12,28)],fill=DARK,outline=LIT)
 if cls==2:
  for x,y in [(44,39),(43,47),(45,55)]:d.polygon([(x,y),(x-12,y-8),(x+3,y-4)],fill=DARK,outline=LIT)
 limb(d,arms[1],6)
 # Hands and three discrete fingers reach farther at contact.
 for arm in arms:
  hx,hy=arm[-1]
  d.ellipse((hx-4,hy-3,hx+4,hy+3),fill=MID,outline=EDGE)
  for finger in range(3):
   yy=hy-3+finger*3
   d.line([(hx+2,yy),(hx+7,yy+1),(hx+8,yy+4)],fill=LIT,width=1)
 if state=='death':
  im=im.rotate(-k*9,resample=Image.Resampling.NEAREST,center=(60,80))
 return im
atlas=Image.new('RGBA',(S*8,S*len(STATES)*4))
for cls in range(4):
 for row,state in enumerate(STATES):
  for k in range(8):atlas.alpha_composite(pose(state,k,cls),(k*S,(cls*len(STATES)+row)*S))
atlas.save(P/'xeno_reforged.png',optimize=True)
# Soldier poses are fully articulated original armor geometry, preserving palette
# and a compact human silhouette. Weapons and limbs move independently.
soldierBase=Image.open(P/'soldier_tight.png').convert('RGBA').resize((80,87),Image.Resampling.NEAREST)
soldierMask=Image.new('L',(80,87));ImageDraw.Draw(soldierMask).polygon([(29,4),(60,0),(68,27),(68,47),(47,60),(32,48),(34,26)],fill=255)
soldierCore=Image.new('RGBA',(80,87));soldierCore.paste(soldierBase,(0,0),soldierMask);soldierCore.putalpha(Image.composite(soldierBase.getchannel('A'),Image.new('L',(80,87)),soldierMask))
def marine(state,k):
 im=Image.new('RGBA',(80,96));d=ImageDraw.Draw(im);a=k/8*math.tau
 step=math.sin(a)*10 if state=='walk' else 0
 dy=round(abs(math.sin(a))*2) if state=='walk' else 0
 recoil=(5-k)*1.2 if state=='fire' and k<4 else 0
 x=39-recoil;y=34+dy
 limb(d,[(x-5,y+23),(30-step,y+38),(29-step,y+54)],9,'#536149')
 limb(d,[(x+5,y+23),(47+step,y+37),(49+step,y+54)],9,'#68734e')
 for xx in [29-step,49+step]:d.rectangle((xx-6,y+52,xx+8,y+57),fill='#1b2630');d.line((xx-5,y+52,xx+6,y+52),fill='#8c9b83')
 d.polygon([(x-12,y-3),(x+12,y-3),(x+15,y+20),(x+6,y+28),(x-12,y+23)],fill='#273a3a',outline='#101c2a')
 for n in range(4):d.rectangle((x-10+n*6,y,x-6+n*6,y+15),fill=['#61734e','#9a9c67'][n%2])
 d.rectangle((x-10,y+20,x+12,y+24),fill='#182730');d.rectangle((x-7,y+21,x-3,y+23),fill='#afb08b')
 d.ellipse((x-9,y-20,x+10,y-2),fill='#bb9470',outline='#192532')
 d.polygon([(x-11,y-13),(x-8,y-24),(x+7,y-24),(x+13,y-14)],fill='#596947',outline='#15232c')
 d.line((x-8,y-21,x+6,y-22),fill='#a8b28a',width=2);d.rectangle((x-8,y-12,x+9,y-8),fill='#132330');d.rectangle((x+2,y-11,x+8,y-10),fill='#a0e6d6')
 aim=state in ['aim','fire']; gunY=y+4 if aim else y+13
 if state=='reload':gunY=y+6+k%4
 limb(d,[(x-10,y+2),(x-15,gunY+7),(x+4,gunY+7)],7,'#9b8960')
 limb(d,[(x+10,y+2),(x+17,gunY+7),(x+26,gunY+1)],7,'#a89469')
 d.rectangle((x-4,gunY-2,x+34,gunY+5),fill='#101c2b');d.rectangle((x-2,gunY-3,x+23,gunY),fill='#697c83');d.rectangle((x+19,gunY+1,x+37,gunY+3),fill='#c0c6b0');d.rectangle((x+10,gunY+5,x+16,gunY+14),fill='#253843')
 if state=='hurt':im=im.rotate(-7,resample=Image.Resampling.NEAREST,center=(40,70))
 if state=='death':im=im.rotate(-min(85,k*14),resample=Image.Resampling.NEAREST,center=(40,70))
 im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
 if state!='death':im.alpha_composite(soldierCore,(-4,4+dy))
 return im
marine_states=['idle','walk','aim','fire','reload','hurt','death']
atlas=Image.new('RGBA',(80*8,96*len(marine_states)))
for row,state in enumerate(marine_states):
 for k in range(8):atlas.alpha_composite(marine(state,k),(k*80,row*96))
atlas.save(P/'marine_reforged.png',optimize=True)
print('Generated',len(STATES)*8*4,'xenomorph and',len(marine_states)*8,'marine poses')
# Three new silhouettes, with articulated limbs and explicit windup/contact poses.
def boss(kind,state,k):
 im=Image.new('RGBA',(224,176));d=ImageDraw.Draw(im)
 t=k/8*math.tau; stride=math.sin(t)*5;active=state==1;attack=[0,.2,.5,1,1,.6,.2,0][k] if active else 0
 if kind==0: # Cryogenic loader: bipedal pressure vessel, tank shoulders and claws.
  for side in [-1,1]:
   x=112+side*39
   limb(d,[(x,103),(x+side*7,133+side*stride),(x+side*12,162)],18,'#405869')
   d.rounded_rectangle((x-15,150,x+23,170),3,fill='#132635',outline='#81a9ba',width=2)
   d.rounded_rectangle((x-17,44,x+17,96),8,fill='#254253',outline='#7799a6',width=3)
   for j in range(3):d.rectangle((x-13,55+j*12,x+13,59+j*12),fill='#99c9d0')
   arm=[(x+side*7,70),(x+side*(20+attack*9),104-attack*25),(x+side*(35+attack*9),122-attack*43)]
   limb(d,arm,14,'#3a596b');hx,hy=arm[-1]
   for dx in [-8,8]:d.polygon([(hx+dx,hy),(hx+dx*1.7,hy+19),(hx,hy+25),(hx+dx*.4,hy+12)],fill='#8ed4df',outline='#183645')
  d.polygon([(80,41),(145,41),(152,117),(132,131),(89,123),(73,93)],fill='#183041',outline='#799ba7')
  d.rounded_rectangle((91,53,132,108),8,fill='#12323e',outline='#9bcfd8',width=3)
  for i in range(6):d.line((97,59+i*7,126,62+i*7),fill=['#56adc5','#b4f2ea'][i%2],width=3)
  d.rectangle((97,22,130,44),fill='#405b6b',outline='#a0bcc6',width=2);d.rectangle((101,29,127,35),fill='#72e2f3')
  for x in [88,139]:d.line((x,44,x,20),fill='#83c4d5',width=5)
 elif kind==1: # Dock sentinel: floating reactor with four separate metal arms.
  for side in [-1,1]:
   for j in range(2):
    start=(112+side*31,65+j*29)
    points=[start,(112+side*(68+attack*5),45+j*65+stride),(112+side*(88+attack*8),24+j*110-attack*20)]
    limb(d,points,12,'#4d576a');x,y=points[-1]
    d.rectangle((x-11,y-8,x+11,y+10),fill='#1c2c42',outline='#b2c1c7',width=2)
    for n in range(3):d.rectangle((x-7+n*5,y-4,x-5+n*5,y+4),fill='#e0a260')
  d.polygon([(112,21),(157,45),(160,107),(112,138),(64,108),(66,47)],fill='#1a2c43',outline='#96acb8')
  for inset,col in [(7,'#394a61'),(15,'#1c3449'),(23,'#72aebe')]:
   d.polygon([(112,21+inset),(157-inset*.7,45+inset*.5),(160-inset,107-inset*.4),(112,138-inset),(64+inset,108-inset*.4),(66+inset*.7,47+inset*.5)],outline=col,width=3)
  d.ellipse((88,57,136,107),fill='#081c2f',outline='#dfb573',width=3)
  for n in range(8):
   a=n/8*math.tau+t;x=112+math.cos(a)*18;y=82+math.sin(a)*18
   d.rectangle((x-3,y-3,x+3,y+3),fill='#ffe3a4')
  d.ellipse((104,74,120,90),fill='#d4ffff');d.rectangle((99,133,125,145),fill='#344c5f')
  for n in range(3):d.line((103+n*9,146,100+n*11,164+(k%3)*2),fill='#69cbdc',width=3)
 else: # Hive overlord: broad rib-cage, sweeping limbs, crown and mandibles.
  for side in [-1,1]:
   limb(d,[(112+side*23,109),(112+side*(42+stride),142),(112+side*61,168)],17,'#3a3450')
   for j in range(3):
    points=[(112+side*28,63+j*18),(112+side*(58+attack*10),54+j*27),(112+side*(87+attack*11),35+j*39+attack*15)]
    limb(d,points,10 if j==0 else 7,'#40344f');x,y=points[-1]
    d.polygon([(x,y),(x+side*13,y+8),(x+side*7,y+25),(x+side*4,y+11)],fill='#9b8fa2',outline='#1f2335')
  d.ellipse((72,36,151,129),fill='#1b2534',outline='#7c657d',width=3)
  for j in range(9):
   yy=51+j*7;wid=31-abs(j-4)*3
   d.line([(112-wid,yy),(112,yy+6),(112+wid,yy)],fill='#696076',width=3)
   d.line([(113-wid,yy-1),(112,yy+3),(111+wid,yy-1)],fill='#a095a9',width=1)
  for n in range(7):
   x=73+n*13;d.polygon([(x,39),(x-9,2+(n%2)*11),(x+14,17),(x+13,47)],fill='#2a2c40',outline='#87758f')
  d.ellipse((90,25,138,63),fill='#272d41',outline='#b7a1b9',width=2)
  d.line((98,39,130,39),fill='#dca362',width=2)
  for side in [-1,1]:d.polygon([(112+side*14,51),(112+side*27,62+attack*8),(112+side*8,79+attack*7),(112+side*11,64)],fill='#beb3ae',outline='#323042')
  for n in range(4):d.rectangle((106+n*4,52,108+n*4,64),fill='#d9d6c0')
 if state==2:
  wash=Image.new('RGBA',im.size,(0,0,0,0));wd=ImageDraw.Draw(wash);wd.line((20,10,207,165),fill='#b6d5cc',width=1);im.alpha_composite(wash)
 return im
atlas=Image.new('RGBA',(224*8,176*9))
for kind in range(3):
 for state in range(3):
  for k in range(8):atlas.alpha_composite(boss(kind,state,k),(224*k,176*(kind*3+state)))
atlas.save(P/'boss_reforged.png',optimize=True)
print('Generated 72 new boss poses')
