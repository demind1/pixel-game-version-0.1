"""Generate subtle 2D deformable in-betweens for user-supplied boss art.
These are computational variations of existing still art, NOT hand-drawn animation.
"""
from pathlib import Path
from PIL import Image
import numpy as np, cv2, math
assets=Path(__file__).resolve().parent/'assets'
def gen(name,out,head_right,w,h):
 src=Image.open(assets/name).convert('RGBA');img=np.array(src.resize((w,h),Image.Resampling.NEAREST))
 y,x=np.indices((h,w),dtype=np.float32)
 base=img.copy();frames=[]
 for row in range(3):
  for i in range(8):
   t=i/8*math.tau;head=(x/w>.50) if head_right else (x/w<.48)
   tail=(x/w<.35) if head_right else (x/w>.64)
   body=(x/w>.3)&(x/w<.72)
   swing=math.sin(t)*3.2
   # Continuous pixel-offset field, different phase along the flexible tail.
   dx=(head*swing*1.2 + tail*np.sin(t+y/h*6)*5 + body*np.sin(t+.7)*1.4).astype(np.float32)
   dy=(head*np.cos(t)*1.7 + tail*np.cos(t+x/w*6)*4+body*np.sin(t)*1.0).astype(np.float32)
   if row==1: # windup / strike pose
    strike=math.sin(math.pi*(i+1)/9)
    dx+=((-1 if head_right else 1)*-6*strike*head).astype(np.float32)
    dy+=(-6*strike*(body|head)).astype(np.float32)
   if row==2: # hurt / stagger
    dx+=(math.sin(t*2)*3*(head|body)).astype(np.float32)
    dy+=math.sin(t)*5
   result=cv2.remap(base,x-dx,y-dy,cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
   frames.append(result)
 outarr=np.zeros((h*3,w*8,4),np.uint8)
 for k,frame in enumerate(frames):outarr[(k//8)*h:(k//8+1)*h,(k%8)*w:(k%8+1)*w]=frame
 Image.fromarray(outarr,'RGBA').save(assets/out,optimize=True)
 print(out,Image.open(assets/out).size,(assets/out).stat().st_size)
gen('drone_tight.png','boss_guardian_8x3.png',True,200,145)
gen('warrior_tight.png','boss_siege_8x3.png',True,200,145)
gen('praetorian_tight.png','boss_queen_8x3.png',False,180,184)
