// Audio component contract: no gesture/autoplay, bounded voices, independent mix,
// six unique boss themes and immediate pause silence. No sound device needed.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../game.js','utf8');
let time=0,plays=0,stops=0;
const param=()=>({value:0,setValueAtTime(v){this.value=v},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v}});
const node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){stops++}});
class AudioContext {constructor(){this.currentTime=0;this.destination={};this.state='running'}createGain(){return node()}createOscillator(){return node()}resume(){return Promise.resolve()}}
class Audio {constructor(src){this.src=src;this.paused=true;this.volume=0;this.currentTime=0}play(){plays++;this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
const env={assetURL:n=>'assets/'+n,Math,Number,Map,Set,Audio,window:{AudioContext},performance:{now:()=>time},document:{getElementById:()=>({})},console,settings:{music:.5,sfx:.5,master:.8,ambientAudio:0,musicStyle:'rock'},save(){},game:null,screen:'menu',music:new Audio(),clamp:(n,l,h)=>Math.min(h,Math.max(l,n)),rand:(a,b)=>(a+b)/2};
vm.createContext(env);
const vars=source.slice(source.indexOf('let audioCtx='),source.indexOf('const OPTION_GROUPS='));
const funcs=source.slice(source.indexOf('// Original layered SFX:'),source.indexOf('function changeScreen('));
vm.runInContext(vars+'\n'+funcs,env);
const run=s=>vm.runInContext(s,env);
run('updateMusic();tickMusic()');assert.equal(plays,0,'nothing plays before user gesture');
run('ensureAudio()');assert.equal(plays,1,'user action unlocks music');
run('synth("claw");synth("claw")');assert.equal(run('audioVoices.length'),1,'identical simultaneous sounds are rate limited');
for(let i=0;i<40;i++)run(`audioCtx.currentTime=${i*.023};synth('boss')`);
assert(run('audioVoices.length')<=16,'sound crowd is bounded');
env.game={level:5,boss:{dead:false},waveActive:true,tick:0};env.screen='playing';run('updateMusic()');assert.equal(run('activeTrack'),11,'sixth boss has its own final theme');
for(let i=0;i<60;i++){time+=17;run('tickMusic()')}
assert(run('soundtrack[11].volume')>0,'music fades in');assert(run('soundtrack[11].volume')<=.5*.8*.72,'music respects independent master gain and headroom');
env.screen='paused';run('updateMusic()');assert(run('soundtrack.every(a=>a.paused&&a.volume===0)'),'pause silences all streams immediately');assert.equal(run('audioVoices.length'),0,'pause clears transient voices');
env.screen='playing';env.settings.master=0;run('updateMusic();tickMusic();synth("boom")');assert.equal(run('audioVoices.length'),0,'zero master suppresses effects');
assert(stops>0,'audio sources receive scheduled stop');
env.settings.master=.8;run('setMusicStyle("legacy")');assert(run('soundtrack[11].src.endsWith("/boss06.ogg")'));assert.equal(run('activeTrack'),11);
run('setMusicStyle("rock")');assert(run('soundtrack.every(a=>a.src.includes("/rock_"))'));assert.equal(run('settings.originalMusic'),false);
env.screen='paused';run('setMusicStyle("legacy")');assert(run('soundtrack.every(a=>a.paused)'),'changing music style cannot unpause the game');
console.log('PASS audio: gesture gate, polyphony/retrigger limits, six boss tracks, master gain, fades, style switching and pause silence');
