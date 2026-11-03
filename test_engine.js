/* Deterministic engine integration tests. Canvas/audio are fakes; browser QA is separate. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let js=fs.readFileSync(__dirname+'/game.js','utf8');
// Test-only closure access; no production debug setters or gameplay bypasses are shipped.
js=js.replace(/\}\)\(\);\s*$/,`window.__engine={physicalCode,keyAction,beginAttack,tryAttack,applyPlayer,updateAttack,damagePlayer,updateBullets,captureInputs,queueCommands,releaseGrab,createEnemy,sampleGamepad,resetInput,settings,ATTACKS,LEVELS,hitTarget,impact3D,resetClock(){last=performance.now();acc=0},get frame(){return frame}};})();`);
const on={};let raf=()=>{},now=0,testPads=[];
const gradient={addColorStop(){}};
const ctx=new Proxy({createRadialGradient(){return gradient},createLinearGradient(){return gradient},measureText(v){return {width:String(v).length*5}},getImageData(){return {data:new Uint8ClampedArray(4)}},ellipse(){},drawImage(){},globalAlpha:1,canvas:{width:480,height:270}}, {get(t,k){return k in t?t[k]:()=>{}},set(t,k,v){t[k]=v;return true}});
class FakeImage{constructor(){this.complete=true;this.naturalWidth=1600;this.naturalHeight=640}set src(v){this._src=v;queueMicrotask(()=>this.onload?.())}get src(){return this._src}}
class FakeAudio{constructor(src=''){this.src=src;this.paused=true;this.volume=0;this.currentTime=0;this.loop=true}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
const elems={};for(const id of ['game','music','loadout','sound','fullscreen','cabinet']){const e={id,style:{},hidden:false,focus(){},addEventListener(type,cb){on[id+':'+type]=cb},requestFullscreen(){return Promise.resolve()},getBoundingClientRect(){return {left:0,top:0,width:960,height:540}}};if(id==='game')e.getContext=()=>ctx;if(id==='music'){Object.assign(e,new FakeAudio());e.play=FakeAudio.prototype.play;e.pause=FakeAudio.prototype.pause;}elems[id]=e}
const fakeParam={setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}};
const window={AudioContext:class{constructor(){this.currentTime=0;this.state='running';this.destination={}}createOscillator(){return {type:'',frequency:fakeParam,connect(){},start(){},stop(){}}}createGain(){return {gain:fakeParam,connect(){}}}resume(){return Promise.resolve()}},addEventListener(k,cb){on['window:'+k]=cb}};
const storageMap=new Map(),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v)};
const document={hidden:false,getElementById:id=>elems[id],addEventListener(k,cb){on['document:'+k]=cb},createElement:type=>({width:0,height:0,getContext:()=>ctx})};
const env={window,document,navigator:{getGamepads:()=>testPads},Image:FakeImage,Audio:FakeAudio,performance:{now:()=>now},requestAnimationFrame:fn=>raf=fn,Math,console,localStorage:storage,Set,Map,Promise,Uint8ClampedArray};
vm.createContext(env);
// Load optional local browser modules in index order without hiding missing ones.
for(const file of ['localization.js','animation.js'])if(fs.existsSync(__dirname+'/'+file))vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),env,{filename:file});
vm.runInContext(js,env,{filename:'game.js'});
const api=window.HIVEBREAK,E=window.__engine;
const key=(key,type='keydown',code,repeat=false)=>on['window:'+type]({key,code,repeat,preventDefault(){}});
const press=(k,code)=>{key(k,'keydown',code);tick(1);key(k,'keyup',code)};
const tick=(count=1)=>{for(let i=0;i<count;i++){now+=1000/60;raf(now)}};
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS',name)};
const boot=(classId=0)=>{testPads=[];api.start(classId);E.resetInput();const p=api.players[0];p.inv=100000;api.state.hitStop=0;return p};
const step=(p,input={})=>{now+=1000/60;E.applyPlayer(p,{x:0,y:0,...input})};
(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();
 test('all source images loaded in fake harness',()=>assert(api.ready));
 test('physical key codes ignore active layout; fallback covers Cyrillic',()=>{
  assert.equal(E.physicalCode({key:'в',code:'KeyD'}),'KeyD');
  assert.equal(E.physicalCode({key:'Ц'}),'KeyW');assert.equal(E.physicalCode({key:'о'}),'KeyJ');assert.equal(E.physicalCode({key:'Л'}),'KeyK');assert.equal(E.physicalCode({key:'д'}),'KeyL');
  assert.equal(E.physicalCode({key:'й'}),'KeyQ');assert.equal(E.physicalCode({key:'г'}),'KeyU');
 });
 test('Russian-layout events move and attack using physical keys',()=>{
  const p=boot();const x=p.x;key('в','keydown','KeyD');tick(6);key('в','keyup','KeyD');assert(p.x>x+3);
  press('о','KeyJ');assert.equal(p.attack,'claw1');
 });
 test('movement keys release even if layout changes while held',()=>{
  const p=boot();key('d','keydown','KeyD');tick(3);key('в','keyup','KeyD');const x=p.x;tick(6);assert.equal(p.x,x);
 });
 test('diagonal speed is normalized in world space; analog magnitude preserved',()=>{
  const a=boot();a.x=100;a.y=216;step(a,{x:1});const straight=a.x-100;
  const b=boot();b.x=100;b.y=216;step(b,{x:1,y:1});assert(Math.hypot(b.x-100,(b.y-216)/.6)<=straight+1e-9);
  const c=boot();c.x=100;step(c,{x:.5});assert(Math.abs(c.x-100-straight*.5)<1e-9);
 });
 test('held and repeated jump does not auto-jump after landing',()=>{
  const p=boot();key(' ','keydown','Space');tick(2);assert(p.airborne);for(let i=0;i<60;i++){key(' ','keydown','Space',true);tick(1)}assert(!p.airborne);key(' ','keyup','Space');
 });
 test('jump buffered just before landing executes once',()=>{
  const p=boot();p.airborne=true;p.z=1;p.vz=-2;step(p,{jump:true});assert(!p.airborne);step(p);assert(p.airborne);assert(p.z>1);
 });
 test('combo accepts input in late recovery; stale input expires after 125ms',()=>{
  const p=boot();E.beginAttack(p,'claw1');p.attackT=8;step(p,{light:true});assert.equal(p.attack,'claw1');step(p);assert.equal(p.attack,'claw2');
  E.beginAttack(p,'tail');p.attackT=0;step(p,{light:true});for(let i=0;i<42;i++)step(p);assert.equal(p.attack,null);assert.equal(p.chain,0);
 });
 test('hitstop captures controller/keyboard edge; buffered action survives',()=>{
  const p=boot();E.beginAttack(p,'claw1');p.attackT=10;api.state.hitStop=3;press('j','KeyJ');tick(5);assert.equal(p.attack,'claw2');
 });
 test('attacks charge resources at execution including queued super',()=>{
  for(let c=0;c<4;c++){const p=boot(c);p.energy=79;assert.equal(E.tryAttack(p,'super'),false);assert.equal(p.energy,79);p.energy=80;assert(E.tryAttack(p,'super'));assert.equal(p.energy,0);}
  const p=boot();p.energy=34;assert(!E.beginAttack(p,'acidburst'));assert.equal(p.energy,34);
 });
 test('one attack can damage each target only once',()=>{
  const p=boot();p.x=100;p.y=218;const enemy=E.createEnemy('marine',145,218);enemy.hp=enemy.maxHp=999;api.state.enemies=[enemy];E.beginAttack(p,'claw1');
  for(let i=0;i<8;i++)E.updateAttack(p);assert.equal(enemy.hp,999-Math.round(14));
 });
 test('grab bite damages captive and player hit releases reciprocal grab',()=>{
  const p=boot();p.inv=0;p.x=100;p.y=218;const enemy=E.createEnemy('marine',125,218);enemy.hp=enemy.maxHp=200;api.state.enemies=[enemy];assert(E.tryAttack(p,'grab'));assert.equal(enemy.heldBy,p);assert(E.tryAttack(p,'light'));E.updateAttack(p);E.updateAttack(p);assert(enemy.hp<200);
  E.damagePlayer(p,5,0);assert.equal(p.grabTarget,null);assert.equal(enemy.heldBy,null);
 });
 test('armored counter is a stance until struck and does not double-hit',()=>{
  const p=boot(3);p.inv=0;p.x=100;p.y=218;const enemy=E.createEnemy('marine',145,218);enemy.hp=enemy.maxHp=999;api.state.enemies=[enemy];E.beginAttack(p,'counter');for(let i=0;i<6;i++)E.updateAttack(p);assert.equal(enemy.hp,999);const hp=p.hp;E.damagePlayer(p,20,0);assert.equal(p.hp,hp);const after=enemy.hp;assert(after<999);for(let i=0;i<6;i++)E.updateAttack(p);assert.equal(enemy.hp,after);
 });
 test('perfect dodge rewards only once per dodge',()=>{
  const p=boot();p.inv=0;p.energy=50;step(p,{dash:true});const hp=p.hp;E.damagePlayer(p,10,0);const energy=p.energy;assert.equal(p.hp,hp);assert(energy>54);E.damagePlayer(p,10,0);assert.equal(p.energy,energy);
 });
 test('directional dodge has cooldown, limited invulnerability, and respects gates',()=>{
  const p=boot();p.inv=0;p.x=100;p.y=218;api.state.waveActive=true;api.state.arenaMin=23;api.state.gateX=105;step(p,{x:1,dash:true});for(let i=0;i<12;i++)step(p);assert(p.x<=105);assert.equal(p.inv,0);assert(p.dodgeCd>0);const hp=p.hp;E.damagePlayer(p,5,0);assert(p.hp<hp);assert.equal(p.dodge,0);
  const q=boot();q.x=100;step(q,{y:-1,dash:true});assert.equal(q.x,100);
 });
 test('root-motion attacks cannot escape wave arena bounds',()=>{
  const p=boot(2);p.x=100;api.state.waveActive=true;api.state.arenaMin=98;api.state.gateX=105;E.beginAttack(p,'phantom');for(let i=0;i<30;i++)step(p);assert(p.x<=105&&p.x>=98);
 });
 test('high jumps evade chest-height bullets; grounded player is hit',()=>{
  const p=boot();p.inv=0;p.x=100;p.y=218;p.z=55;p.airborne=true;const bullet=()=>({x:70,y:181,depth:218,vx:40,vy:0,life:10,type:'shot',damage:10});const hp=p.hp;api.state.bullets=[bullet()];E.updateBullets();assert.equal(p.hp,hp);
  p.z=0;p.airborne=false;api.state.bullets=[bullet()];E.updateBullets();assert(p.hp<hp);
 });
 test('focus loss/hidden document pause and clear held keys',()=>{
  const p=boot();key('d','keydown','KeyD');tick(2);on['window:blur']();assert.equal(api.screen,'paused');press('Escape');const x=p.x;tick(3);assert.equal(p.x,x);
  document.hidden=true;on['document:visibilitychange']();assert.equal(api.screen,'paused');document.hidden=false;
 });
 test('gamepad deadzone, press edges and disconnect pause',()=>{
  boot();const buttons=Array.from({length:18},()=>({pressed:false}));const pad={index:0,axes:[.1,.1],buttons};assert.equal(E.sampleGamepad(pad).x,0);buttons[2].pressed=true;assert(E.sampleGamepad(pad).light);assert(!E.sampleGamepad(pad).light);
  testPads=[pad];on['window:gamepaddisconnected']({gamepad:pad});assert.equal(api.screen,'paused');
 });
 // Join co-op through actual menu; keyboard remains exclusive to P1.
 test('co-op controller independently moves player 2',()=>{
  // Return from paused to menu using menu navigation.
  press('ArrowDown');press('ArrowDown');press('ArrowDown');press('Enter');assert.equal(api.screen,'menu');
  on['game:pointerdown']({clientX:480,clientY:298});tick(2);assert.equal(api.screen,'select');
  const buttons=Array.from({length:18},()=>({pressed:false}));testPads=[{index:3,axes:[0,0],buttons}];buttons[9].pressed=true;tick(3);buttons[9].pressed=false;tick(4);assert(api.joined);press('Enter');assert.equal(api.players.length,2);
  const [p1,p2]=api.players,x1=p1.x,x2=p2.x;p1.inv=p2.inv=100000;testPads[0].axes[0]=.95;tick(20);testPads[0].axes[0]=0;assert.equal(p1.x,x1);assert(p2.x>x2+10);testPads=[];
 });
 test('custom binding works and captures same physical Russian key',()=>{
  const p=boot();E.settings.bindings={light:'KeyI'};press('ш','KeyI');assert.equal(p.attack,'claw1');E.settings.bindings={};
 });
 test('keyboard press survives a long GPU stall and executes only once',()=>{
  const p=boot();key('j','keydown','KeyJ');key('j','keyup','KeyJ');now+=400;raf(now);assert.equal(p.attack,'claw1');tick(40);assert.equal(p.attack,null);
 });
 test('parry prevents a frontal hit, rewards energy and readies one riposte',()=>{
  const p=boot();p.inv=0;p.energy=40;p.face=1;p.x=100;assert(E.tryAttack(p,'parry'));assert(!E.tryAttack(p,'parry'));const hp=p.hp;E.damagePlayer(p,20,130);assert.equal(p.hp,hp);assert.equal(p.energy,52);assert(p.riposteT>0);assert.equal(p.parryT,0);
  const e=E.createEnemy('marine',140,p.y);e.hp=e.maxHp=500;api.state.enemies=[e];E.hitTarget(p,e,E.ATTACKS.claw1);assert.equal(e.hp,500-Math.round(14*1.02*1.7));assert.equal(p.riposteT,0);
 });
 test('parry does not protect from behind and has a bounded window',()=>{
  const p=boot();p.inv=0;p.face=1;p.x=100;E.tryAttack(p,'parry');const hp=p.hp;E.damagePlayer(p,10,60);assert(p.hp<hp);
  const q=boot();q.inv=0;E.tryAttack(q,'parry');for(let i=0;i<12;i++)step(q);assert.equal(q.parryT,0);assert(q.parryCd>0);
 });
 test('light then heavy launches a target; juggle impulses diminish',()=>{
  const p=boot();p.x=100;p.chain=1;p.chainTick=40;assert(E.tryAttack(p,'heavy'));assert.equal(p.attack,'launcher');const e=E.createEnemy('marine',140,p.y);e.hp=e.maxHp=1000;api.state.enemies=[e];
  E.hitTarget(p,e,E.ATTACKS.launcher);const first=e.vz;E.hitTarget(p,e,E.ATTACKS.launcher);assert(e.vz<first);assert(e.vz>0);
 });
 test('execution requires a weakened target, costs energy and heals on a single kill',()=>{
  const p=boot();p.x=100;p.hp=50;p.energy=100;const e=E.createEnemy('marine',140,p.y),b=E.createEnemy('marine',145,p.y);api.state.enemies=[e,b];assert(!E.tryAttack(p,'execute'));e.hp=5;assert(E.tryAttack(p,'execute'));assert.equal(p.energy,80);for(let i=0;i<18;i++)E.updateAttack(p);assert(e.dead);assert.equal(b.hp,b.maxHp);assert.equal(p.hp,68);assert(p.executionCd>0);
 });
 test('impact effects are bounded and expire during simulation',()=>{
  boot();for(let i=0;i<100;i++)E.impact3D(100,220);assert.equal(api.state.impacts.length,28);tick(24);assert.equal(api.state.impacts.length,0);
 });
 test('equal simulation speed at 60, 120, 144 and 240Hz rendering',()=>{
  const results=[];
  for(const hz of [60,120,144,240]){
   const p=boot();tick(3);E.resetClock();const x=p.x,t=api.state.tick;
   key('d','keydown','KeyD');
   for(let i=0;i<hz;i++){now+=1000/hz;raf(now)}
   key('d','keyup','KeyD');results.push({ticks:api.state.tick-t,distance:p.x-x});
  }
  const counts=results.map(r=>r.ticks),distances=results.map(r=>r.distance);
  assert(Math.max(...counts)-Math.min(...counts)<=1,JSON.stringify(results));
  assert(Math.max(...distances)-Math.min(...distances)<2.04,JSON.stringify(results));
 });
 test('all four classes, all enemies and all mission boss phases render/simulate',()=>{
  for(let cls=0;cls<4;cls++){const p=boot(cls);p.energy=100;press('u','KeyU');assert(p.attack);tick(60);}
  boot(1);api.state.enemies=api.enemyTypes.map((t,i)=>E.createEnemy(t,180+i*4,212+i%3*8));tick(150);assert.equal(api.enemyTypes.length,15);
  for(let level=0;level<E.LEVELS.length;level++){
   const p=boot();api.setLevel(level);p.inv=100000;tick(4);api.spawnBoss();const boss=api.state.boss;assert(boss);boss.hp=boss.maxHp*.52;tick(3);assert.equal(boss.phase,2);boss.hp=boss.maxHp*.20;tick(3);assert.equal(boss.phase,3);api.damageBoss(20000);tick(150);assert.equal(api.screen,'stageclear');
  }
 });
 console.log(`PASS: ${passed} engine integration tests`);
})().catch(err=>{console.error('TEST FAILED',err);process.exitCode=1});
