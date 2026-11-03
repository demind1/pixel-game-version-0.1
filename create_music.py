"""Synthesize original sci-fi/industrial loops for the three sectors and bosses.
No samples, existing music, or outside sound assets are copied.
"""
from pathlib import Path
import math, tempfile, subprocess, wave
import numpy as np
from scipy.signal import butter,sosfilt
P=Path(__file__).resolve().parent/'assets'
SR=22050
NOTES={s:i for i,s in enumerate('C C# D D# E F F# G G# A A# B'.split())}
def midi(note):
 s=note[:-1];octave=int(note[-1]);return 440*2**(((octave+1)*12+NOTES[s]-69)/12)
def make(song,config):
 tempo,root,scale,seed,amount=config
 rng=np.random.default_rng(seed)
 beat=60/tempo
 beats=64 if song.startswith('stage') else 48
 dur=beats*beat
 count=int(dur*SR)
 mix=np.zeros(count,np.float32)
 def add(start,signal,vol=1):
  i=int(start*SR);n=min(len(signal),count-i)
  if i>=0 and n>0:mix[i:i+n]+=signal[:n]*vol
 def osc(freq,dur,wave='saw',detune=0):
  t=np.arange(max(1,int(SR*dur)),dtype=np.float32)/SR
  phase=2*np.pi*(freq*t+detune*t*t/2)
  if wave=='tri': return (2/np.pi*np.arcsin(np.sin(phase))).astype(np.float32)
  if wave=='square':return np.tanh(4*np.sin(phase)).astype(np.float32)
  if wave=='saw':return (2*((phase/(2*np.pi))%1)-1).astype(np.float32)
  return np.sin(phase).astype(np.float32)
 def env(sig,attack=0.008,release=.15):
  n=len(sig);a=max(1,int(attack*SR));r=max(1,min(int(release*SR),n//2));out=sig.copy()
  out[:a]*=np.linspace(0,1,a);out[-r:]*=np.linspace(1,0,r)**1.5
  return out
 def tone(start,note,duration,volume,w='saw',lp=1500):
  freq=midi(note)
  s=osc(freq,duration,w)*.72+osc(freq*1.004,duration,'tri')*.28
  sos=butter(2,min(9000,max(200,lp))/(SR/2),output='sos')
  s=sosfilt(sos,s)
  add(start,env(s,0.012,min(.21,duration*.37)),volume)
 def percussion(start,kind,vol):
  if kind=='kick':
   t=np.arange(int(.31*SR))/SR
   phase=2*np.pi*(42*t+95*(1-np.exp(-t*47))/47)
   s=np.sin(phase)*np.exp(-t*18)+rng.normal(0,.22,len(t))*np.exp(-t*80)
  elif kind=='snare':
   t=np.arange(int(.20*SR))/SR
   noise=rng.normal(0,1,len(t));s=(noise*.47+np.sin(2*np.pi*180*t)*.3)*np.exp(-t*19)
  else:
   t=np.arange(int(.105*SR))/SR
   noise=rng.normal(0,1,len(t));s=noise*np.exp(-t*52)
   sos=butter(2,2500/(SR/2),btype='highpass',output='sos');s=sosfilt(sos,s)
  add(start,s.astype(np.float32),vol)
 # Keys: dark industrial minor, each stage has distinct arrangement and palette
 roots=['D','F#','C#']
 key=roots[root]
 root_oct={'D':2,'F#':2,'C#':2}[key]
 root_freq=midi(f'{key}{root_oct}')
 chord_intervals=[(0,3,7),(5,8,12),(7,10,14),(3,7,10)]
 variants={
 'stage01':[0,0,7,0,3,0,5,7,0,0,7,10,5,3,7,0],
 'stage02':[0,7,0,12,3,10,7,5,0,7,10,12,5,3,0,7],
 'stage03':[0,3,0,8,7,10,3,7,0,3,10,8,7,5,3,0],
 'boss01':[0,12,7,3,12,10,7,0,5,12,3,7,10,7,0,12],
 'boss02':[0,7,12,14,7,3,10,12,0,14,12,7,3,7,10,12],
 'boss03':[0,3,7,10,12,15,10,7,0,10,7,3,12,10,7,0]}
 pat=variants[song]
 scale_notes=[0,3,5,7,10,12,15,17,19]
 for step in range(beats*2):
  bi=step/2;st=bi*beat
  if step%2==0:
   if int(bi)%4 in (0,2):percussion(st,'kick',.18+amount*.05)
   else:percussion(st,'snare',.12+amount*.035)
  if step%4==3:percussion(st,'kick',.09)
  percussion(st,'hat',.024+amount*.013)
  if step%2==0 and step%8 in (0,4):
   pitch=scale_notes[pat[(step//2)%16]%len(scale_notes)] if song.startswith('boss') else pat[(step//2)%16]
   freq=root_freq*2**(pitch/12)
   s=osc(freq,beat*.42,'saw')*.55+osc(freq*.5,beat*.42,'square')*.45
   t=np.arange(len(s))/SR;s=s*(.45+.55*np.exp(-t*13))
   sos=butter(2,(800 if song=='stage03' else 1050)/(SR/2),output='sos');s=sosfilt(sos,s)
   add(st,env(s,release=.06),.13+amount*.04)
  if step%2==0:
   idx=pat[(step//2)%len(pat)]%len(scale_notes)
   if step%8 in (0,4):idx=(idx+2)%len(scale_notes)
   freq=root_freq*4*2**(scale_notes[idx]/12)
   s=osc(freq,beat*.31,'tri')*.65+osc(freq*2,beat*.31,'square')*.19
   add(st+.06*beat,env(s,.005,.12),.037+(0.025 if song.startswith('boss') else 0))
 # Four-chord airy pad filtered; not a reproduction of any known track.
 for bar in range(beats//4):
  chord=chord_intervals[bar%4]
  for off in chord:
   t=bar*beat*4;freq=root_freq*2**(off/12)*2
   s=osc(freq,beat*4,'tri')*.46+osc(freq*.501,beat*4,'saw')*.20
   sos=butter(2,(550 if song=='stage03' else 870)/(SR/2),output='sos');s=sosfilt(sos,s)
   add(t,env(s,.3,.7),.017)
 # periodic alarm/acid accent
 for bar in range(1,beats//4,4):
  st=bar*4*beat;freq=430 if root==2 else 580
  t=np.arange(int(.58*SR))/SR
  s=np.sin(2*np.pi*(freq*t+20*t*t))*np.exp(-t*4)
  add(st,s,.024)
 # slight fading to avoid click at loop edges
 out=np.tanh(mix*1.8)*.65
 fade=int(.10*SR);out[:fade]*=np.linspace(0,1,fade);out[-fade:]*=np.linspace(1,0,fade)
 pcm=np.int16(np.clip(out,-.97,.97)*32767)
 with tempfile.TemporaryDirectory() as tmp:
  wavpath=Path(tmp)/'raw.wav'
  with wave.open(str(wavpath),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
  output=P/f'{song}.ogg'
  subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y','-i',str(wavpath),'-c:a','libvorbis','-q:a','3',str(output)],check=True)
 print(song,'duration',round(dur,2),'seconds','size',output.stat().st_size)
for key,args in {
 'stage01':(126,0,None,1,.2),
 'stage02':(138,1,None,2,.45),
 'stage03':(114,2,None,3,.3),
 'boss01':(145,0,None,4,.68),
 'boss02':(155,1,None,5,.72),
 'boss03':(139,2,None,6,.8),
}.items():make(key,args)
