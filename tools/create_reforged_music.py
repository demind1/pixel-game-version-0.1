"""Original sample-free Reforged soundtrack. Requires numpy and ffmpeg.
Existing v0.7 tracks are preserved. Deterministic synthesis with distinct motifs,
stereo echoes, layered bass, metallic percussion and quiet exploratory passages.
"""
from pathlib import Path
import hashlib,json,subprocess,tempfile,wave
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SR=22050
# title, tempo, MIDI root, motif, seed, industrial intensity
SCORES={
 'stage04':('Нулевой градус',104,38,[0,7,14,10,3,12,7,2],401,.35),
 'stage05':('Орбитальный груз',128,33,[0,0,7,10,0,5,3,7],501,.65),
 'stage06':('Сердце колонии',112,36,[0,3,6,7,0,10,7,3],601,.70),
 'boss04':('Криостраж',144,38,[0,12,7,14,10,7,3,2],402,.80),
 'boss05':('Перехватчик',156,33,[0,7,10,12,7,3,5,10],502,.90),
 'boss06':('Владыка улья',136,36,[0,3,6,12,7,10,15,6],602,1.0),
}
def render(name,config):
 title,bpm,root,motif,seed,intensity=config
 rng=np.random.default_rng(seed);beat=60/bpm;beats=64;duration=beats*beat
 length=round(duration*SR);mix=np.zeros((length,2),np.float64)
 boss=name.startswith('boss');kind=int(name[-2:])-4
 def freq(midi):return 440*2**((midi-69)/12)
 def add(start,sig,gain=1,pan=0):
  i=round(start*SR)%length;n=len(sig);left=np.sqrt((1-pan)/2)*gain;right=np.sqrt((1+pan)/2)*gain
  # Wrap tails into the loop so sustained instruments and echoes do not click.
  indices=(i+np.arange(n))%length
  np.add.at(mix[:,0],indices,sig*left);np.add.at(mix[:,1],indices,sig*right)
 def envelope(n,attack=.008,decay=3):
  t=np.arange(n)/SR
  return np.minimum(1,t/max(.0001,attack))*np.exp(-t*decay)*np.minimum(1,np.maximum(0,(n/SR-t)/.03))
 def note(midi,dur,style='bass'):
  t=np.arange(round(dur*SR))/SR;f=freq(midi)
  if style=='bass':s=np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*2*f*t)+.10*np.sin(2*np.pi*3*f*t)
  elif style=='bell':s=np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*2.756*t)*np.exp(-t*10)
  elif style=='pad':s=np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*1.004*t)+.2*np.sin(2*np.pi*2*f*t)
  else:s=np.tanh(2*np.sin(2*np.pi*f*t))*.5+np.sin(2*np.pi*f*2*t)*.15
  return s*envelope(len(t),.2 if style=='pad' else .004,.65 if style=='pad' else 5 if style=='bass' else 3)
 def drum(kind,st,vol,pan=0):
  d=.32 if kind=='kick' else .22 if kind=='snare' else .09;t=np.arange(round(d*SR))/SR
  noise=rng.uniform(-1,1,len(t))
  if kind=='kick':s=np.sin(2*np.pi*(41*t+70*(1-np.exp(-t*35))/35))*np.exp(-t*17)+noise*.09*np.exp(-t*65)
  elif kind=='snare':s=(noise*.6+np.sin(2*np.pi*172*t)*.22)*np.exp(-t*25)
  else:s=(noise-np.roll(noise,1))*.25*np.exp(-t*64)
  add(st,s,vol,pan)
 for step in range(beats*4):
  b=step/4;st=b*beat;bar=int(b)//4;section=bar//4
  # Each composition breathes before its denser four-bar phrases.
  energy=.65 if section%2==0 and not boss else 1
  if step%4==0:
   on=int(b)%4
   if on in (0,2) or boss and on==3:drum('kick',st,.30*energy)
   if on in (1,3):drum('snare',st,.16*energy)
  if step%2==0 and (kind!=0 or boss):drum('hat',st,.055*energy,(-1 if step%4 else 1)*.5)
  if step%4==3 and kind==1:drum('kick',st,.14)
  if step%2==0:
   m=motif[(step//2)%len(motif)]
   if not boss and kind==0 and step%8!=0:continue
   bass=note(root+m%12,beat*.44,'bass');add(st,bass,.19*energy)
  if step%4==0 or boss and step%2==0:
   m=motif[(step//(2 if boss else 4)+bar//4)%len(motif)]
   lead=note(root+24+m,beat*(1.3 if kind==0 else .65),'bell' if kind==0 else 'lead')
   pan=np.sin(b*.6)*.55
   add(st,lead,(.067 if kind==0 else .045)*energy,pan)
   add(st+beat*.75,lead,.018,-pan)
  if step%16==0:
   chord=[0,3,7] if bar%4<2 else [5,8,12]
   for n in chord:add(st,note(root+12+n,beat*4.3,'pad'),.024,(-.5 if n%2 else .5))
  # Organic hive heartbeat and tiny mechanical dock accents.
  if kind==2 and step%8==1:drum('kick',st,.15)
  if kind==1 and step%16==13:
   t=np.arange(round(.18*SR))/SR
   metallic=(np.sin(2*np.pi*890*t)+.3*np.sin(2*np.pi*1411*t))*np.exp(-t*22)
   add(st,metallic,.024,-.65)
 # Gentle saturation leaves headroom for game sound effects.
 mix=np.tanh(mix*1.25)*.75
 peak=float(np.max(np.abs(mix)));rms=float(np.sqrt(np.mean(mix**2)))
 pcm=np.int16(np.clip(mix,-.92,.92)*32767)
 out=ROOT/'assets'/f'{name}.ogg'
 with tempfile.TemporaryDirectory() as tmp:
  wav=Path(tmp)/'track.wav'
  with wave.open(str(wav),'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
  subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(out)],check=True)
 print(name,title,round(duration,2),'s',out.stat().st_size,'bytes')
 return {'file':out.name,'title':title,'bpm':bpm,'duration':duration,'peak':peak,'rms':rms,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'original_synthesis':True}
if __name__=='__main__':
 tracks=[render(name,cfg) for name,cfg in SCORES.items()]
 (ROOT/'assets'/'reforged_music.json').write_text(json.dumps({'generator':'tools/create_reforged_music.py','sample_rate':SR,'tracks':tracks},ensure_ascii=False,indent=2)+'\n')
