"""Create 4 poses x 8-frame procedural soldier animation atlas.
Frames bend the user-provided opaque suit sprite in discrete nearest-neighbor
pixel positions; not hand-authored artwork.
"""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,math
P=Path(__file__).resolve().parent/'assets'
W,H=120,130
base=np.asarray(Image.open(P/'soldier_tight.png').convert('RGBA').resize((W,H),Image.Resampling.NEAREST))
y,x=np.indices((H,W),dtype=np.float32)
rows=[]
for kind in range(4):
 for k in range(8):
  ph=k/8*2*math.pi
  dx=np.zeros_like(x);dy=np.zeros_like(y)
  if kind==0: # breathing/idle, aim correction
   dx+=(np.sin(ph)*.9)*np.clip((75-y)/75,0,1)
   dy+=np.cos(ph)*.6
  if kind==1: # alternating strides: upper torso steadier than boots
   leg=np.clip((y-60)/65,0,1)
   left=(x<W*.48);right=~left
   dx+=leg*(np.sin(ph)*4.2*left-np.sin(ph)*4.2*right)
   dy+=leg*(np.cos(ph)*2.0*left-np.cos(ph)*2.0*right)
   dy+=np.sin(ph*2)*.6
  if kind==2: # firing/recoil with torso and rifle recoil
   t=(k%4)/4
   dx+=np.clip((88-y)/88,0,1)*(-3.2*math.sin(math.pi*t))
   dx+=np.cos(ph)*.7
   dy+=np.sin(ph)*.7
  if kind==3: # hurt/backward stagger
   dx+=np.clip((90-y)/90,0,1)*(5.3*math.sin(ph))
   dy+=np.clip((y-60)/70,0,1)*(math.cos(ph)*2)
  pix=cv2.remap(base,x-dx,y-dy,cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
  rows.append(pix)
atlas=np.zeros((H*4,W*8,4),np.uint8)
for j,frame in enumerate(rows):atlas[(j//8)*H:(j//8+1)*H,(j%8)*W:(j%8+1)*W]=frame
Image.fromarray(atlas,'RGBA').save(P/'marine_motion_8x4.png',optimize=True)
print('marine_motion_8x4.png',Image.open(P/'marine_motion_8x4.png').size)
