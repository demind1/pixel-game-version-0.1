"""Generate supplemental original/remixed sprite frames + compact bitmap type for v0.7.
Original body artwork is supplied by the user. In-between frames use optical-flow
warping between distinct supplied poses; they are not independently hand-drawn.
"""
from pathlib import Path
from PIL import Image, ImageFont, ImageDraw
import numpy as np
import cv2
P=Path(__file__).resolve().parent/'assets'
source=Image.open(P/'xeno_sheet.png').convert('RGBA')
frame=160
images=[]
for row in range(4):
    frames=[]
    for col in range(4):
        x0=round(source.width*col/4);x1=round(source.width*(col+1)/4)
        y0=round(source.height*row/4);y1=round(source.height*(row+1)/4)
        imagesize=(frame,frame)
        frames.append(np.array(source.crop((x0,y0,x1,y1)).resize(imagesize,Image.Resampling.NEAREST)))
    cols=[]
    for pair in range(3):
        a,b=frames[pair],frames[pair+1]
        fa=cv2.cvtColor(a,cv2.COLOR_RGBA2GRAY)
        fb=cv2.cvtColor(b,cv2.COLOR_RGBA2GRAY)
        # Optical flow gives actual intermediate body positions, not a crossfade.
        flowAB=cv2.calcOpticalFlowFarneback(fa,fb,None,.5,4,21,4,5,1.1,0)
        flowBA=cv2.calcOpticalFlowFarneback(fb,fa,None,.5,4,21,4,5,1.1,0)
        yy,xx=np.indices((frame,frame),dtype=np.float32)
        for t in (0,1/3,2/3):
            if t==0:res=a
            else:
                ax=xx-flowAB[:,:,0]*t; ay=yy-flowAB[:,:,1]*t
                bx=xx-flowBA[:,:,0]*(1-t);by=yy-flowBA[:,:,1]*(1-t)
                wa=cv2.remap(a,ax,ay,cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT)
                wb=cv2.remap(b,bx,by,cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT)
                # Blend transparent silhouettes, preserving nearest neighbor pixel edges
                wa=wa.astype(np.float32);wb=wb.astype(np.float32)
                aa=wa[:,:,3:4]/255; ab=wb[:,:,3:4]/255
                alpha=(1-t)*aa+t*ab
                rgb=((1-t)*wa[:,:,:3]*aa+t*wb[:,:,:3]*ab)/np.maximum(alpha,0.0001)
                res=np.uint8(np.clip(np.concatenate((rgb,alpha*255),axis=2),0,255))
                # All partially transparent edge pixels become crisp coverage.
                mask=(res[:,:,3] > 98);res[:,:,3]=np.where(mask,255,0)
                res[:,:,:3]=(res[:,:,:3]//8)*8
            cols.append(res)
    cols.append(frames[-1]);images.append(cols)
atlas=np.zeros((frame*4,frame*10,4),np.uint8)
for r,row in enumerate(images):
    for c,im in enumerate(row):
        atlas[r*frame:(r+1)*frame,c*frame:(c+1)*frame]=im
Image.fromarray(atlas,'RGBA').save(P/'xeno_animation_10x4.png',optimize=True)

# Original 8x12 pixel font derived from a licensed system monospace font.
# Build all printable ASCII characters with binary alpha to remain tack sharp.
chW,chH=9,12
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',11)
fontImg=Image.new('RGBA',(chW*16,chH*6),(0,0,0,0))
draw=ImageDraw.Draw(fontImg)
for index,code in enumerate(range(32,127)):
    ch=chr(code);cx=(index%16)*chW;cy=(index//16)*chH
    draw.text((cx+1,cy-1),ch,font=font,fill=(255,255,255,255),stroke_width=0)
a=np.array(fontImg)
a[:,:,3]=np.where(a[:,:,3]>=128,255,0)
a[:,:,:3]=255
Image.fromarray(a,'RGBA').save(P/'pixel_font.png',optimize=True)
print('sprite atlas',P/'xeno_animation_10x4.png',Image.open(P/'xeno_animation_10x4.png').size)
print('pixel font',P/'pixel_font.png',fontImg.size)
