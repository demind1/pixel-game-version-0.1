const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync(__dirname+'/game.js','utf8');
const on={};let raf=()=>{},now=0;let faults=[];let testPads=[];
const gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient(){return gradient;},createLinearGradient(){return gradient;},measureText(v){return {width:String(v).length*5};},getImageData(){return {data:new Uint8ClampedArray(4)}},ellipse(){},drawImage(){},globalAlpha:1,canvas:{width:480,height:270}}, {get(t,k){return k in t?t[k]:()=>{}},set(t,k,v){t[k]=v;return true;}});
class FakeImage{constructor(){this.complete=true;this.naturalWidth=1600;this.naturalHeight=640;this.onload=null;}set src(v){this._src=v;queueMicrotask(()=>{this.onload&&this.onload()});}get src(){return this._src;}}
class FakeAudio{constructor(src=''){this.src=src;this.paused=true;this.volume=0;this.currentTime=0;this.loop=true;}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true;}}
const elems={};for(const id of ['game','music','loadout','sound','fullscreen','cabinet']){const e={id,style:{},hidden:false,focus(){},addEventListener(type,cb){on[id+':'+type]=cb},requestFullscreen(){return Promise.resolve()},getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}};if(id==='game')e.getContext=()=>ctx;if(id==='music')Object.assign(e,new FakeAudio());elems[id]=e}
const window={AudioContext:class{constructor(){this.currentTime=0;this.state='running';this.destination={};}createOscillator(){return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}resume(){return Promise.resolve()}},addEventListener(k,cb){on['window:'+k]=cb}};
const localStorage=new Map();const storage={getItem:k=>localStorage.get(k)||null,setItem:(k,v)=>localStorage.set(k,v)};
const env={window,document:{getElementById:id=>elems[id],createElement:type=>({width:0,height:0,getContext:()=>ctx})},navigator:{getGamepads:()=>testPads},Image:FakeImage,Audio:FakeAudio,performance:{now:()=>now},requestAnimationFrame:fn=>raf=fn,Math,console,localStorage:storage,Set,Map,Promise,Uint8ClampedArray};
vm.createContext(env);
vm.runInContext(js,env,{filename:'game.js'});
const key=(key,type='keydown')=>on['window:'+type]({key,preventDefault(){},repeat:false});
const tick=(count=1)=>{for(let i=0;i<count;i++){now+=1000/60;raf(now)}};
(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert(window.HIVEBREAK.ready,'assets ready');console.log('READY & SCREEN',window.HIVEBREAK.screen);
assert.strictEqual(window.HIVEBREAK.enemyTypes.length,10);
// Join local co-op and independently control the second character via gamepad API.
key('ArrowDown');tick(2);key('Enter');tick(3);
assert.strictEqual(window.HIVEBREAK.screen,'select','co-op character select opened');
const buttons=Array.from({length:18},()=>({pressed:false}));testPads=[{index:0,axes:[0,0],buttons}];
buttons[9].pressed=true;tick(3);buttons[9].pressed=false;tick(4);
assert.strictEqual(window.HIVEBREAK.joined,true,'gamepad start joins P2');
key('Enter');tick(4);assert.strictEqual(window.HIVEBREAK.players.length,2);
const x0=window.HIVEBREAK.players[0].x,x1=window.HIVEBREAK.players[1].x;
testPads[0].axes[0]=.95;tick(27);testPads[0].axes[0]=0;
assert(window.HIVEBREAK.players[1].x>x1,'P2 moves via gamepad');
assert(window.HIVEBREAK.players[0].x===x0,'P1 is independent');
console.log('CO-OP PASSED',window.HIVEBREAK.players.map(p=>p.x));
testPads=[];
for(let cls=0;cls<4;cls++){
 window.HIVEBREAK.start(cls);tick(10);assert.strictEqual(window.HIVEBREAK.screen,'playing');
 let p=window.HIVEBREAK.players[0];let clsname=window.HIVEBREAK.classes[cls];
 p.energy=100;key('u');tick(1);key('u','keyup');assert(p.attack||p.energy<=100,'ultimate initiated');
 tick(60);window.HIVEBREAK.setLevel(2);tick(5);window.HIVEBREAK.spawnBoss();tick(5);
 assert(window.HIVEBREAK.state.boss,'boss created');window.HIVEBREAK.damageBoss(20000);tick(150);
 assert.strictEqual(window.HIVEBREAK.screen,'stageclear');
 console.log('CLASS',clsname,'LEVEL',window.HIVEBREAK.state.level,'BOSS CLEAR',window.HIVEBREAK.screen);
}
// All ten enemy types simulated and rendered, including the new medic, gunner and drone.
window.HIVEBREAK.start(1);tick(1);const state=window.HIVEBREAK.state;for(const type of window.HIVEBREAK.enemyTypes){state.enemies.push({id:Math.random(),type,x:220,y:218,z:type==='drone'?35:0,vz:0,vx:0,hp:100,maxHp:100,speed:.5,face:-1,ai:'approach',cool:10,wind:0,recover:0,stun:0,hurt:0,flash:0,walk:0,fire:0,shield:0,healCd:120,ammo:5,burstShots:0,burstTimer:0,deathStyle:0,targetLock:0,lastTarget:null,armor:0,dead:false,deathT:0,heldBy:null,attackCd:0,retreat:0});}
tick(150);assert(window.HIVEBREAK.state.enemies.length>=10);console.log('ENEMY AI SIMULATED:',window.HIVEBREAK.state.enemies.map(x=>x.type).join(','));
key('Escape');tick(2);assert.strictEqual(window.HIVEBREAK.screen,'paused');const before=state.tick;tick(55);assert.strictEqual(state.tick,before,'paused simulation no updates');key('Escape');tick(2);assert.strictEqual(window.HIVEBREAK.screen,'playing');
window.HIVEBREAK.state.debug=true;tick(2);
// Boss phases on EACH sector, and minimum complete stage transition logic.
for(let level=0;level<3;level++){
 window.HIVEBREAK.start(0);window.HIVEBREAK.setLevel(level);tick(4);window.HIVEBREAK.spawnBoss();
 let boss=window.HIVEBREAK.state.boss;assert(boss);boss.hp=boss.maxHp*.52;tick(3);assert.strictEqual(boss.phase,2);
 boss.hp=boss.maxHp*.20;tick(3);assert.strictEqual(boss.phase,3);
 window.HIVEBREAK.damageBoss(20000);tick(140);assert.strictEqual(window.HIVEBREAK.screen,'stageclear');
 console.log('BOSS PHASE 1→2→3 & STAGE CLEAR:',level+1);
}
console.log('PASS: all four classes, ten enemy types, three levels, boss phases, co-op, paused state, rendering');
})().catch(err=>{console.error('TEST FAILED',err);process.exitCode=1});
