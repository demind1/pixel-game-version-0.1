/* Campaign integration checks: state transitions run the real simulation; rendering has its own browser suite. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
let source=fs.readFileSync(path.join(root,'game.js'),'utf8').replace(/\}\)\(\);\s*$/,`window.__campaign={LEVELS,ENEMY,startStage,spawnWave,spawnBoss,killEnemy,createEnemy,updateEnemy,spawnShot,updateBoss,updateHazards,updateLevelEvents,recoverEncounter,tickGame,settings,resetInput,setCoop(){coop=true;joined=true;beginRun()}};})();`);
const grad={addColorStop(){}},ctx=new Proxy({createLinearGradient:()=>grad,createRadialGradient:()=>grad,measureText:t=>({width:String(t).length*6})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
class FakeImage{constructor(){this.complete=true;this.naturalWidth=1600;this.naturalHeight=640}set src(v){queueMicrotask(()=>this.onload?.())}}
class FakeAudio{constructor(){this.paused=true;this.volume=0}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
const listeners={},elements={};for(const id of ['game','music','loadout','sound','fullscreen','cabinet'])elements[id]={style:{},addEventListener(){},getContext:()=>ctx,focus(){},getBoundingClientRect:()=>({left:0,top:0,width:960,height:540})};elements.music=new FakeAudio();
const window={addEventListener(k,f){listeners[k]=f}},document={getElementById:id=>elements[id],createElement:()=>({getContext:()=>ctx}),addEventListener(){}};
let now=0,seed=12345;const math=Object.create(Math);math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const env={window,document,navigator:{getGamepads:()=>[]},Image:FakeImage,Audio:FakeAudio,performance:{now:()=>now},requestAnimationFrame(){},console,Math:math,localStorage:{getItem:()=>null,setItem(){}},Map,Set,Uint8ClampedArray};vm.createContext(env);
for(const file of ['localization.js','animation.js'])if(fs.existsSync(path.join(root,file)))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),env);
vm.runInContext(source,env);const api=window.HIVEBREAK,C=window.__campaign;
C.settings.sfx=0;C.settings.music=0;
const start=(level=0)=>{api.start(level%4);C.startStage(level);api.players[0].inv=1e9;C.resetInput();return api.state};
const step=(n=1)=>{for(let i=0;i<n;i++){now+=1000/60;C.tickGame()}};
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name)};
(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();
 test('six distinct mission definitions preserve original three',()=>{assert.equal(C.LEVELS.length,6);assert.deepEqual(Array.from(C.LEVELS,l=>l.id),['research','military','reactor','cryo','dock','hive']);assert.equal(new Set(C.LEVELS.map(l=>l.bossName)).size,6)});
 test('all enemy definitions referenced by campaign exist',()=>{for(const level of C.LEVELS)for(const wave of level.waves)for(const type of wave.types)assert(C.ENEMY[type],type);assert(Object.keys(C.ENEMY).length>=15)});
 for(let lev=0;lev<C.LEVELS.length;lev++)test('mission '+(lev+1)+': all five waves gate progress, recover invalid enemies, and lead to boss',()=>{
  const g=start(lev),p=api.players[0],level=C.LEVELS[lev];
  for(let wi=0;wi<level.waves.length;wi++){
   const wave=level.waves[wi];p.x=wave.x;step();assert(g.waveActive,'wave spawned');assert.equal(g.waveIndex,wi+1);
   const alive=g.enemies.filter(e=>!e.dead);assert.equal(alive.length,wave.types.length);for(const e of alive){assert(e.x>=g.arenaMin&&e.x<=g.gateX,'reachable spawn');assert(e.y>=190&&e.y<=244,'valid lane');}
   // Remaining living opponents must continue to block progress; no timeout auto-kills.
   for(const e of alive.slice(1))C.killEnemy(e,p);step(3);assert(g.waveActive);assert(!g.boss);assert.equal(g.waveIndex,wi+1);
   const survivor=alive[0],hp=survivor.hp;survivor.x=NaN;survivor.y=Infinity;step();assert(Number.isFinite(survivor.x)&&Number.isFinite(survivor.y));assert.equal(survivor.hp,hp,'recovery does not erase opponents');
   C.killEnemy(survivor,p);step(2);assert(!g.waveActive);assert.equal(g.gateX,Infinity);
  }
  p.x=level.length-650;step();assert(g.boss,'boss only after full encounter chain');assert.equal(g.waveIndex,5);assert(!g.waveActive);
  g.boss.hp=g.boss.maxHp*.52;step();assert.equal(g.boss.phase,2);g.boss.hp=g.boss.maxHp*.2;step();assert.equal(g.boss.phase,3);
  api.damageBoss(1e7);step(150);assert.equal(api.screen,'stageclear');api.advance();assert.equal(api.screen,lev===5?'victory':'playing');if(lev<5)assert.equal(api.state.level,lev+1);
 });
 test('wave sequence cannot spawn twice or overlap with an active boss',()=>{const g=start();C.spawnWave(C.LEVELS[0].waves[0]);const count=g.enemies.length;C.spawnWave(C.LEVELS[0].waves[0]);assert.equal(g.enemies.length,count);C.spawnBoss();C.spawnWave(C.LEVELS[0].waves[1]);assert.equal(g.enemies.length,count)});
 test('orphaned grabs release and expired corpses are collected',()=>{const g=start();const e=C.createEnemy('marine',300,220);g.enemies=[e];e.heldBy={dead:true};C.recoverEncounter();assert.equal(e.heldBy,null);C.killEnemy(e,null);e.deathT=151;C.recoverEncounter();assert.equal(g.enemies.length,0)});
 test('enemy magazines empty, reload, and never shoot from outside the camera',()=>{
  const g=start(),e=C.createEnemy('marine',300,221),target={x:180,y:221,z:0};e.spawnT=0;g.camera=0;g.enemies=[e];
  for(let i=0;i<10;i++)C.spawnShot(e,target);assert.equal(e.ammo,0);const count=g.bullets.length;C.spawnShot(e,target);assert.equal(g.bullets.length,count);C.updateEnemy(e);assert(e.reload>0);for(let i=0;i<90;i++)C.updateEnemy(e);assert(e.ammo>0);
  g.camera=1000;const before=g.bullets.length;C.spawnShot(e,target);assert.equal(g.bullets.length,before);
 });
 test('windup locks enemy aim and concurrent threats are limited',()=>{
  const g=start(),p=api.players[0];p.x=100;p.y=220;g.camera=0;g.enemies=[];
  for(let i=0;i<5;i++){const e=C.createEnemy('marine',220+i,220);e.spawnT=0;e.cool=0;g.enemies.push(e);C.updateEnemy(e)}assert(g.enemies.filter(e=>e.wind>0).length<=2);
  const e=g.enemies.find(e=>e.wind>0),face=e.face;e.wind=10;p.x=400;C.updateEnemy(e);assert.equal(e.face,face);
 });
 test('assault melee damages the real player without corrupting hp',()=>{const g=start(),p=api.players[0];p.x=240;p.inv=0;p.stun=0;p.z=0;const e=C.createEnemy('assault',265,p.y);g.enemies=[e];e.spawnT=0;e.wind=1;e.lastTarget={x:p.x,y:p.y,z:0};const hp=p.hp;C.updateEnemy(e);assert(Number.isFinite(p.hp));assert(p.hp<hp)});
 test('cryo vents warn before activation and jumps avoid grounded hazards',()=>{const g=start(3),p=api.players[0],h=g.hazards[0];p.x=h.x;p.y=h.y;p.inv=0;p.z=0;h.timer=h.period-2;g.tick=25;C.updateHazards();assert(h.warning&&!h.active);C.updateHazards();assert(h.active);assert(p.slowT>0);p.inv=0;p.stun=0;p.z=40;const hp=p.hp;C.updateHazards();assert.equal(p.hp,hp)});
 test('level events trigger once and have a bounded lifetime',()=>{const g=start(4);C.updateLevelEvents(900);assert.equal(g.eventIndex,1);assert.equal(g.eventKind,'airlock');C.updateLevelEvents(900);assert.equal(g.eventIndex,1);C.updateLevelEvents(1900);assert.equal(g.eventIndex,2);for(let i=0;i<200;i++)C.updateLevelEvents(1900);assert.equal(g.eventPulse,0)});
 test('boss dash locks direction and stays inside its arena',()=>{const g=start(4);C.spawnBoss();const b=g.boss;b.x=C.LEVELS[4].length-57;b.dashT=20;b.lockFace=1;b.face=1;api.players[0].x=b.x-100;for(let i=0;i<20;i++)C.updateBoss();assert.equal(b.face,1);assert(b.x<=C.LEVELS[4].length-55);assert(b.x>=C.LEVELS[4].length-580)});
 test('boss summons are capped and cannot grow without limit',()=>{const g=start(5);C.spawnBoss();const b=g.boss;b.phase=3;b.hp=100;for(let i=0;i<30;i++){b.attackKind='summon';b.wind=1;b.targetLock={x:2600,y:220};C.updateBoss()}assert(g.enemies.filter(e=>!e.dead).length<=4)});
 test('boss defeat cannot be reversed by surviving summoned enemies',()=>{const g=start(5);C.spawnBoss();const p=api.players[0];p.hp=1;p.inv=0;p.stun=0;g.enemies=[C.createEnemy('prototype',p.x,p.y)];g.enemies[0].spawnT=0;g.enemies[0].wind=1;api.damageBoss(1e7);step(150);assert.equal(api.screen,'stageclear');assert.equal(p.hp,1)});
 test('dead coop partner never pulls the living player backward; stage revival restores hp and life',()=>{C.setCoop();C.startStage(0);const g=api.state,[a,b]=api.players;a.x=100;b.x=2000;b.dead=true;b.lives=0;b.hp=0;step();assert(a.x<200);C.startStage(1);assert(!b.dead);assert(b.hp>0);assert(b.lives>=1);assert(!b.airborne)});
 console.log('PASS',checks,'campaign scenarios; all 30 waves and 6 mission transitions validated.');
})().catch(e=>{console.error(e);process.exitCode=1});
