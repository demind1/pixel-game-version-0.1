"""Sample-free industrial rock: physical string loops, double tracking, drums.
Original riffs. No recordings, copyrighted melodies or third-party samples.
"""
from pathlib import Path
import math,json,hashlib,wave,tempfile,subprocess
import numpy as np
from scipy.signal import butter,sosfilt
ROOT=Path(__file__).resolve().parents[1];SR=22050
SCORES=[('stage01',142,38,[0,0,7,0,3,0,5,6]),('stage02',156,36,[0,0,3,0,7,6,5,3]),('stage03',146,33,[0,3,0,6,7,0,10,6]),('stage04',138,38,[0,7,0,3,2,0,6,5]),('stage05',162,36,[0,0,7,10,0,3,6,5]),('stage06',150,33,[0,6,0,3,7,6,10,3]),('boss01',168,38,[0,0,3,7,0,6,5,3]),('boss02',176,36,[0,7,0,3,6,0,10,7]),('boss03',172,33,[0,3,6,0,7,10,6,3]),('boss04',166,38,[0,7,6,3,0,2,5,6]),('boss05',182,36,[0,0,7,6,0,10,7,3]),('boss06',174,33,[0,6,3,0,7,6,10,12])]
def render(index,config):
 name,bpm,root,riff=config;beat=60/bpm;beats=64;n=round(beats*beat*SR);mix=np.zeros((n,2));rng=np.random.default_rng(1100+index);cache={};boss=name.startswith('boss')
 def add(st,signal,volume,pan=0):
  at=(round(st*SR)+np.arange(len(signal)))%n;np.add.at(mix[:,0],at,signal*volume*math.sqrt((1-pan)/2));np.add.at(mix[:,1],at,signal*volume*math.sqrt((1+pan)/2))
 def string(midi,side):
  key=(midi,side)
  if key in cache:return cache[key]
  f=440*2**((midi-69)/12)*(1+.003*side);delay=round(SR/f);count=round(1.1*SR)
  wave=np.zeros(count);wave[:delay]=rng.uniform(-1,1,delay);previous=wave[:delay].copy()
  for start in range(delay,count,delay):
   previous=.996*(previous+np.roll(previous,-1))*.5;size=min(delay,count-start);wave[start:start+size]=previous[:size]
  t=np.arange(count)/SR;wave*=np.minimum(1,t/.002)
  cache[key]=wave;return wave
 def guitar(midi,duration,side,muted):
  count=round(duration*SR);t=np.arange(count)/SR
  raw=string(midi,side)[:count]*.68+string(midi+7,side)[:count]*.36+string(midi+12,side)[:count]*.22
  raw*=np.exp(-t*(17 if muted else 2.7))*np.minimum(1,np.maximum(0,(duration-t)/.018))
  raw=np.tanh(raw*7.5)+.18*np.tanh(raw*2.1)
  raw=sosfilt(butter(2,85,fs=SR,btype='highpass',output='sos'),raw)
  raw=sosfilt(butter(3,3700,fs=SR,output='sos'),raw)
  return raw
 def drum(st,kind,volume,pan=0):
  d={'kick':.32,'snare':.28,'hat':.10,'crash':1.05,'tom':.38}[kind];t=np.arange(round(d*SR))/SR;noise=rng.uniform(-1,1,len(t))
  if kind=='kick':sig=(np.sin(TAU*(42*t+95*(1-np.exp(-t*35))/35))*.85*np.exp(-t*17)+noise*.10*np.exp(-t*150))
  elif kind=='snare':sig=(sosfilt(butter(2,[1100,8500],fs=SR,btype='bandpass',output='sos'),noise)*.65+np.sin(TAU*186*t)*.3)*np.exp(-t*19)
  elif kind=='tom':sig=(np.sin(TAU*(82*t+25*(1-np.exp(-t*15))/15))*.7+noise*.12)*np.exp(-t*14)
  else:
   sig=sosfilt(butter(2,6200,fs=SR,btype='highpass',output='sos'),noise)
   sig*=np.exp(-t*(44 if kind=='hat' else 5))
  sig*=np.minimum(1,t/.0015);add(st,sig,volume,pan)
 TAU=math.tau
 for step in range(beats*4):
  st=step*beat/4;bar=step//16;position=step%16
  if position in (0,8) or boss and position in (6,10,14):drum(st,'kick',.36)
  if position in (4,12):drum(st,'snare',.26)
  if step%2==0:drum(st,'hat',.10 if position%4 else .065,.4 if step%4 else -.4)
  if position==0 and bar%4==0:drum(st,'crash',.16,-.4 if bar%8 else .4)
  if bar%4==3 and position in (13,14,15):drum(st,'tom',.15,(position-14)*.5)
  if step%2==0:
   note=root+riff[(step//2+bar//4)%len(riff)]
   # Distinct open power chord at the end of phrases; syncopated palm-muted chugs elsewhere.
   muted=position not in (0,12) or bar%2==0;duration=beat*(.40 if muted else .95)
   for side in [-1,1]:add(st+(0 if side<0 else .003),guitar(note,duration,side,muted),.21,side*.85)
   t=np.arange(round(duration*SR))/SR;f=440*2**((note-12-69)/12)
   bass=np.tanh((np.sin(TAU*f*t)+.22*np.sin(TAU*f*2*t))*1.4)*np.exp(-t*5)*np.minimum(1,t/.004)
   add(st,bass,.17)
  # Original higher octave call, sparse enough to leave room for the action.
  if bar%4==2 and position in (0,6,10):
   note=root+24+riff[(position//2+index)%len(riff)];lead=guitar(note,beat*.65,1,False)
   add(st,lead,.075,.2);add(st+beat*.75,lead,.022,-.3)
 mix=np.tanh(mix*1.05);peak=float(abs(mix).max());mix*=.82/max(.82,peak);rms=float(np.sqrt(np.mean(mix**2)));peak=float(abs(mix).max())
 out=ROOT/'assets'/('rock_'+name+'.ogg')
 with tempfile.TemporaryDirectory() as temp:
  path=Path(temp)/'music.wav'
  with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(np.int16(mix*32767).tobytes())
  subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-i',str(path),'-c:a','libvorbis','-q:a','4',str(out)],check=True)
 result=dict(file=out.name,bpm=bpm,seconds=n/SR,peak=peak,rms=rms,sha256=hashlib.sha256(out.read_bytes()).hexdigest());print(result,flush=True);return result
if __name__=='__main__':
 report=[render(i,c) for i,c in enumerate(SCORES)]
 (ROOT/'assets'/'rock_music_manifest.json').write_text(json.dumps(dict(style='original industrial rock',sample_free=True,method='Karplus-Strong strings, double-tracked power chords, cabinet filtering, original synthesized drums',tracks=report),indent=2)+'\n')
