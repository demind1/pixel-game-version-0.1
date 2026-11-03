/* XENOMORPH: HIVEBREAK — ULTIMATE ARCADE REMASTER v0.7
 * Canvas 2D, deterministic 60 Hz gameplay simulation, offline friendly.
 * Assets supplied by the project owner. No external network calls.
 */
(()=>{'use strict';
const W=480,H=270,TICK=1000/60,TAU=Math.PI*2;
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=false;
const music=document.getElementById('music'),loadout=document.getElementById('loadout');
const A={}; const assetList={sheet:'xeno_sheet.png',wall:'lab_wall.jpg',wall2:'lab_wall_alt.jpg',cover:'cover.png',menuScene:'menu_scene.jpg',anim:'xeno_animation_10x4.png',font:'pixel_font.png',marineAnim:'marine_motion_8x4.png',bossGuardian:'boss_guardian_8x3.png',bossSiege:'boss_siege_8x3.png',bossQueen:'boss_queen_8x3.png',soldier:'soldier_tight.png',drone:'drone_tight.png',warrior:'warrior_tight.png',queen:'praetorian_tight.png'};
let ready=false; let loadErrors=[];
Promise.all(Object.entries(assetList).map(([name,file])=>new Promise(resolve=>{
  const image=new Image();A[name]=image;image.onload=()=>resolve(true);image.onerror=()=>{loadErrors.push(file);resolve(false)};image.src='assets/'+file;
}))).then(()=>{ready=true;loadout.hidden=true; if(loadErrors.length)console.warn('Optional images unavailable:',loadErrors);});
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const activeImage=name=>A[name]&&A[name].complete&&A[name].naturalWidth>0;
const persisted=(key,fallback)=>{try{const raw=localStorage.getItem('xh_'+key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem('xh_'+key,JSON.stringify(value))}catch{}};
const settings=Object.assign({difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,voice:false},persisted('settings',{}));
const records=Object.assign({high:0,wins:0,maxCombo:0,stage:1},persisted('records',{}));
const CLASS=[
{id:'drone',name:'КСЕНО-ДРОН',title:'УНИВЕРСАЛ',hp:125,speed:2.03,power:1.02,scale:1.0,hue:0,special:'КИСЛОТА',color:'#8af3f0',desc:'КИСЛОТА / БАЛАНС'},
{id:'warrior',name:'КСЕНО-ВОИН',title:'ТЯЖЁЛЫЙ БОЕЦ',hp:162,speed:1.70,power:1.26,scale:1.10,hue:36,special:'УДАР ХВОСТОМ',color:'#c7b0ff',desc:'ДЛИННЫЙ ХВОСТ / ОТБРОС'},
{id:'runner',name:'КСЕНО-РАННЕР',title:'СПРИНТЕР',hp:108,speed:2.65,power:.87,scale:.92,hue:137,special:'РЫВОК',color:'#79e5ff',desc:'РЫВОК / КОМБО'},
{id:'praetorian',name:'КСЕНО-ПРЕТОРИАНЕЦ',title:'ТЯЖЁЛЫЙ СТРАЖ',hp:190,speed:1.47,power:1.16,scale:1.17,hue:285,special:'ЯРОСТЬ',color:'#ffe09a',desc:'БРОНЯ / РЕЖИМ ЯРОСТИ'}
];
const LEVELS=[
{id:'research',name:'КОЛОНИАЛЬНАЯ ИССЛЕДОВАТЕЛЬСКАЯ ЛАБОРАТОРИЯ',sector:'СЕКТОР 01',length:2600,wall:'wall',tone:'#62d9e9',fog:'#0b2337',bossName:'СТРАЖ УЛЬЯ',bossHp:700,bossFilter:'none',banners:['НАРУШЕН КОНТЕЙНМЕНТ УЛЬЯ','НАУЧНЫЙ СЕКТОР ПРОРВАН'],waves:[
{x:275,types:['marine','marine','medic','heavy']},{x:650,types:['marine','shield','gunner','grenadier']},{x:1070,types:['heavy','marine','flame','drone']},{x:1480,types:['shield','android','grenadier','heavy','medic']},{x:1850,types:['marine','android','flame','heavy','gunner','drone']}]},
{id:'military',name:'КОЛОНИАЛЬНЫЙ ВОЕННЫЙ КОМПЛЕКС',sector:'СЕКТОР 02',length:2700,wall:'wall2',tone:'#e6ae60',fog:'#2b1926',bossName:'ОСАДНЫЙ ПРЕТОРИАНЕЦ',bossHp:890,bossFilter:'hue-rotate(43deg) saturate(1.15)',banners:['ПЕРИМЕТР ЗАКРЫТ','ОРУЖЕЙНЫЙ БЛОК ПРОРВАН'],waves:[
{x:290,types:['marine','gunner','heavy','turret']},{x:665,types:['shield','medic','grenadier','heavy']},{x:1070,types:['flame','marine','drone','turret']},{x:1480,types:['shield','heavy','grenadier','android','medic']},{x:1920,types:['heavy','flame','gunner','turret','android','drone']}]},
{id:'reactor',name:'ЗАРАЖЁННОЕ ЯДРО РЕАКТОРА',sector:'СЕКТОР 03',length:2900,wall:'wall',tone:'#c86dc7',fog:'#290c25',bossName:'КОРОЛЕВА КСЕНОМОРФОВ',bossHp:1150,bossFilter:'hue-rotate(-22deg) saturate(1.3)',banners:['УГРОЗА РАСПЛАВЛЕНИЯ РЕАКТОРА','ОБНАРУЖЕН УЛЕЙ-УЗЕЛ'],waves:[
{x:300,types:['android','marine','drone','flame']},{x:700,types:['shield','grenadier','android','gunner']},{x:1110,types:['turret','marine','flame','shield','medic','grenadier']},{x:1550,types:['android','heavy','drone','flame','gunner']},{x:2050,types:['turret','grenadier','gunner','shield','android','marine','drone']}]}
];
const ENEMY={
marine:{hp:48,speed:.70,damage:8,score:250,range:130,shade:'none',scale:1},
heavy:{hp:110,speed:.40,damage:13,score:550,range:104,shade:'brightness(.8) saturate(1.3)',scale:1.22,armor:.3},
shield:{hp:96,speed:.48,damage:10,score:500,range:52,shade:'hue-rotate(48deg)',scale:1.1,armor:.18},
flame:{hp:72,speed:.48,damage:12,score:525,range:85,shade:'sepia(.65) saturate(2)',scale:1.05},
grenadier:{hp:65,speed:.53,damage:15,score:450,range:165,shade:'hue-rotate(130deg) saturate(1.3)',scale:1},
android:{hp:135,speed:.74,damage:14,score:650,range:51,shade:'grayscale(.7) brightness(1.2) hue-rotate(135deg)',scale:1.12,armor:.24},
turret:{hp:92,speed:0,damage:11,score:500,range:185,shade:'none',scale:1},
medic:{hp:58,speed:.63,damage:5,score:600,range:125,shade:'saturate(.7) hue-rotate(50deg) brightness(1.08)',scale:.96},
gunner:{hp:118,speed:.34,damage:6.5,score:750,range:185,shade:'brightness(.76) contrast(1.1)',scale:1.18,armor:.20},
drone:{hp:63,speed:1.1,damage:8,score:530,range:155,shade:'none',scale:.78}
};
const DIFIC=[{damage:.7,hp:.78,frequency:1.2},{damage:1,hp:1,frequency:1},{damage:1.38,hp:1.28,frequency:.78}];
const ATTACKS={
claw1:{startup:3,active:5,recovery:8,damage:14,reach:64,depth:25,knock:4,stun:8,hitstop:2,anim:2},
claw2:{startup:4,active:5,recovery:9,damage:17,reach:69,depth:27,knock:8,stun:10,hitstop:2,anim:2},
claw3:{startup:5,active:6,recovery:14,damage:27,reach:82,depth:31,knock:22,stun:22,launch:1.8,hitstop:4,anim:2},
tail:{startup:9,active:7,recovery:17,damage:35,reach:108,depth:38,knock:25,stun:23,hitstop:4,anim:3},
air:{startup:3,active:8,recovery:8,damage:19,reach:66,depth:32,knock:11,stun:9,hitstop:2,anim:2},
slam:{startup:6,active:7,recovery:17,damage:34,reach:73,depth:42,knock:24,stun:18,hitstop:3,anim:3},
grabbite:{startup:2,active:4,recovery:9,damage:24,reach:36,depth:25,knock:2,stun:20,hitstop:3,anim:2},
acidburst:{startup:12,active:2,recovery:20,damage:42,reach:104,depth:41,knock:9,stun:12,hitstop:3,anim:2},
impact:{startup:13,active:8,recovery:24,damage:64,reach:130,depth:62,knock:37,stun:28,hitstop:5,anim:3},
phantom:{startup:5,active:20,recovery:14,damage:39,reach:40,depth:37,knock:19,stun:17,hitstop:3,anim:1},
rage:{startup:14,active:9,recovery:22,damage:35,reach:110,depth:56,knock:25,stun:19,hitstop:4,anim:3},
super:{startup:16,active:14,recovery:25,damage:90,reach:148,depth:65,knock:38,stun:33,hitstop:6,anim:3},
finisher:{startup:5,active:8,recovery:17,damage:40,reach:105,depth:32,knock:28,stun:25,hitstop:5,anim:3},
acidclaw:{startup:8,active:6,recovery:17,damage:53,reach:110,depth:42,knock:15,stun:17,hitstop:4,anim:2},
predator:{startup:13,active:10,recovery:19,damage:64,reach:128,depth:57,knock:34,stun:27,hitstop:6,anim:3},
ripper:{startup:4,active:25,recovery:14,damage:17,reach:91,depth:36,knock:8,stun:9,hitstop:2,anim:2},
counter:{startup:4,active:24,recovery:16,damage:30,reach:78,depth:37,knock:25,stun:18,hitstop:5,anim:3}
};
let screen='menu',selected=0,coop=false,joined=false,selected2=1,menuIndex=0,optionIndex=0,optionTab=0,menuTick=0,menuCooldown=0;
let game=null,frame=0,acc=0,last=0,slowMo=0,loading=false;
let audioCtx=null,masterNode=null,sfxNode=null,musicNode=null;
const tracks=['stage01','stage02','stage03','boss01','boss02','boss03'];
const soundtrack=tracks.map(name=>{const a=new Audio('assets/'+name+'.ogg');a.loop=true;a.preload='none';return a;});
let activeTrack=-1,fadeTrack=-1;
const OPTION_GROUPS=[['СЛОЖНОСТЬ','АРКАДНАЯ ЖЕСТОКОСТЬ','ЧИСЛА УРОНА','СБРОСИТЬ ВСЕ НАСТРОЙКИ','НАЗАД'],['ПСЕВДО-3D ДЕКОР','КАЧЕСТВО ЧАСТИЦ','ФОНОВЫЕ ЭФФЕКТЫ','ТРЯСКА ЭКРАНА','ВСПЫШКИ ЭКРАНА','СКАНЛИНИИ','КОНТРАСТНЫЙ HUD','НАЗАД'],['ГРОМКОСТЬ МУЗЫКИ','ГРОМКОСТЬ ЭФФЕКТОВ','ОРИГИНАЛЬНЫЙ ТРЕК УР. 1','НАЗАД']];
const BUTTONS=['НАЧАТЬ ИГРУ','КООП','НАСТРОЙКИ','УПРАВЛЕНИЕ','ТИТРЫ'];
const KEYBINDS={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',j:'light',k:'heavy',l:'special',' ':'jump',Shift:'dash',e:'grab',u:'super'};
const held=new Set(),pending=new Set();let gpPrev=new Map();
const getGP=()=>{try{return Array.from(navigator.getGamepads?.()||[]).filter(Boolean)}catch{return []}};
function keyAction(k){return KEYBINDS[k]||KEYBINDS[k.toLowerCase?.()]||null;}
function edge(name){let result=pending.has(name);pending.delete(name);return result;}
function sampleKeyboard(){let h=action=>[...held].some(key=>keyAction(key)===action);return {x:Number(h('right'))-Number(h('left')),y:Number(h('down'))-Number(h('up')),light:edge('light'),heavy:edge('heavy'),special:edge('special'),jump:edge('jump'),dash:edge('dash'),grab:edge('grab'),super:edge('super')};}
function sampleGamepad(gp){if(!gp)return {x:0,y:0};const b=i=>!!gp.buttons?.[i]?.pressed;const prev=gpPrev.get(gp.index)||[];const just=i=>b(i)&&!prev[i];const x=clamp(gp.axes?.[0]||0,-1,1),y=clamp(gp.axes?.[1]||0,-1,1);const out={x:Math.abs(x)>.24?x:(Number(b(15))-Number(b(14))),y:Math.abs(y)>.24?y:(Number(b(13))-Number(b(12))),jump:just(0),special:just(1),light:just(2),heavy:just(3),grab:just(4),dash:just(5),super:just(6),pause:just(9),select:just(9)};gpPrev.set(gp.index,Array.from({length:18},(_,i)=>b(i)));return out;}
function captureInputs(){const kb=sampleKeyboard();const gps=getGP();const pads=gps.map(sampleGamepad);
 if(game&&coop&&joined){return [kb,pads[0]||{x:0,y:0}];}
 if(game&&pads[0]){return [mergeInput(kb,pads[0])];}
 return [kb];}
function mergeInput(a,b){return {x:Math.abs(a.x)>.1?a.x:b.x,y:Math.abs(a.y)>.1?a.y:b.y,light:a.light||b.light,heavy:a.heavy||b.heavy,special:a.special||b.special,jump:a.jump||b.jump,dash:a.dash||b.dash,grab:a.grab||b.grab,super:a.super||b.super,pause:b.pause};}
function resetInput(){held.clear();pending.clear();gpPrev.clear()}
function synth(type,vol=1){if(!audioCtx||settings.sfx<=0)return;const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();let f=170,d=.1,v=.13,w='square';
 switch(type){case 'claw':f=145;d=.08;v=.08;break;case 'tail':f=90;d=.15;v=.12;w='sawtooth';break;case 'hit':f=65;d=.09;v=.16;w='triangle';break;case 'heavy':f=50;d=.2;v=.20;w='sawtooth';break;case 'hurt':f=65;d=.17;v=.12;w='sawtooth';break;case 'acid':f=500;d=.35;v=.10;w='sawtooth';break;case 'shoot':f=180;d=.055;v=.09;break;case 'boom':f=38;d=.4;v=.25;w='sawtooth';break;case 'jump':f=280;d=.12;v=.07;break;case 'pickup':f=580;d=.17;v=.08;w='triangle';break;case 'select':f=530;d=.07;v=.07;break;case 'boss':f=65;d=.75;v=.19;w='sawtooth';break;case 'die':f=120;d=.4;v=.13;break;case 'dash':f=380;d=.10;v=.06;w='triangle';break;}
 osc.type=w;osc.frequency.setValueAtTime(f*rand(.94,1.06),now);osc.frequency.exponentialRampToValueAtTime(Math.max(25,f*.28),now+d);gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(Math.max(.001,v*vol*settings.sfx),now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+d);osc.connect(gain);gain.connect(audioCtx.destination);osc.start(now);osc.stop(now+d+.02);
}
function ensureAudio(){try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();}if(audioCtx.state==='suspended')audioCtx.resume();}catch(e){console.info('Web Audio not available',e)}}
function updateMusic(){
 const playable=['playing','menu','select','stageclear','victory','options','credits','controls'];
 const wanted=game&&['playing','paused','stageclear','gameover'].includes(screen)?(game.boss&&!game.boss.dead?3+game.level:game.level):0;
 const target=playable.includes(screen)&&settings.music>0?(settings.originalMusic&&wanted===0?-2:wanted):-1;
 if(target===-2){if(music.paused){music.volume=0;music.play().catch(()=>{});}activeTrack=-2;}else if(activeTrack===-2){activeTrack=-1;}
 if(target!==activeTrack){
   fadeTrack=activeTrack;activeTrack=target;
   if(activeTrack>=0){const a=soundtrack[activeTrack];if(a.paused){a.currentTime=0;a.volume=0;a.play().catch(()=>{});}}
 }
 const button=document.getElementById('sound');button.textContent=settings.music===0&&settings.sfx===0?'♫ ВЫКЛ':'♫ ВКЛ';
}
function tickMusic(){const goal=activeTrack===-2?settings.music:0;if(!music.paused){music.volume=clamp(music.volume+(goal-music.volume)*.075,0,1);if(goal===0&&music.volume<.01){music.pause();music.volume=0;}}for(let i=0;i<soundtrack.length;i++){const a=soundtrack[i],goal=i===activeTrack?settings.music:0;
 if(i!==activeTrack&&a.paused)continue;
 const next=a.volume+(goal-a.volume)*.075;a.volume=clamp(next,0,1);
 if(i!==activeTrack&&a.volume<.009){a.pause();a.volume=0;}
 }}
function changeScreen(s){screen=s;menuTick=0;menuCooldown=14;pending.clear();updateMusic();}
function resetRecordsIfNeeded(){records.high=Number(records.high)||0;records.stage=clamp(Number(records.stage)||1,1,LEVELS.length);}resetRecordsIfNeeded();
// ------------------------------ WORLD STATE --------------------------------
function makePlayer(id,classId,x,y){const c=CLASS[classId];return {id,classId,x,y,z:0,vz:0,vx:0,face:1,hp:c.hp,maxHp:c.hp,lives:3,energy:100,score:0,kills:0,inv:0,stun:0,dodge:0,dodgeCd:0,attack:null,attackT:0,hitTargets:new Set(),buffer:null,chain:0,chainTick:0,rageT:0,grabTarget:null,grabTick:0,moveX:0,moveY:0,anim:0,walking:0,airborne:false,dead:false,downT:0,oldHp:c.hp,trail:[],counterWindow:0,lastHit:0};}
function makeProps(level){const props=[];const n=LEVELS[level].length;
 for(let i=0;i<Math.floor(n/190);i++){let x=255+i*190+Math.floor(rand(-25,25));const type=i%5===3?'barrel':i%7===5?'terminal':'crate';props.push({x,y:205+((i*31)%31),type,hp:type==='barrel'?2:type==='terminal'?3:3,maxHp:3,dead:false,phase:rand(0,TAU)});}return props;}
function makeHazards(level){if(level===0)return [{x:1160,y:208,type:'steam',timer:0}];if(level===1)return [{x:930,y:215,type:'steam',timer:0},{x:1640,y:223,type:'electric',timer:42},{x:2090,y:210,type:'steam',timer:80}];return [{x:775,y:219,type:'electric',timer:14},{x:1220,y:225,type:'steam',timer:40},{x:1740,y:212,type:'electric',timer:71},{x:2295,y:226,type:'electric',timer:24}];}
function beginRun(){ensureAudio();const p=[makePlayer(1,selected,66,221)];if(coop&&joined)p.push(makePlayer(2,selected2,106,233));game={blood:[],decals:[],level:0,players:p,inputDevice:'keyboard',camera:0,camTarget:0,tick:0,score:0,kills:0,maxCombo:0,combo:0,comboTimer:0,hitStop:0,shake:0,flash:0,particles:[],texts:[],bullets:[],puddles:[],items:[],enemies:[],props:[],hazards:[],boss:null,bossDown:0,waveIndex:0,waveActive:false,gateX:Infinity,stageBanner:185,announcement:'КОЛОНИАЛЬНАЯ ИССЛЕДОВАТЕЛЬСКАЯ ЛАБОРАТОРИЯ',announceT:155,levelTime:0,damageTaken:0,uniqueItems:0,stageKills:0,stageBonus:0,stageDamageTaken:0,finished:false,stats:[],debug:false};
 startStage(0,false);changeScreen('playing');updateMusic();}
function startStage(index,keepPlayers=true){const old=game;const level=LEVELS[index];if(!old)return;
 old.level=index;old.camera=0;old.tick=0;old.levelTime=0;old.waveIndex=0;old.waveActive=false;old.gateX=Infinity;old.stageBanner=180;old.announcement=level.banners[0];old.announceT=130;old.enemies=[];old.bullets=[];old.puddles=[];old.items=[];old.particles=[];old.texts=[];old.props=makeProps(index);old.hazards=makeHazards(index);old.boss=null;old.bossDown=0;old.stageKills=0;old.stageBonus=0;old.stageDamageTaken=0;old.finished=false;old.combo=0;old.comboTimer=0;old.hitStop=0;old.flash=0;old.shake=0;
 old.blood=[];old.decals=[];old.reactorPhase=0;old.players.forEach((p,i)=>{p.x=68+i*43;p.y=214+i*18;p.z=0;p.vz=0;p.vx=0;p.face=1;p.inv=100;p.stun=0;p.dodge=0;p.dodgeCd=0;p.attack=null;p.attackT=0;p.buffer=null;p.grabTarget=null;p.grabTick=0;p.chain=0;p.rageT=0;p.dead=false;p.downT=0;p.trail=[];p.counterWindow=0;p.oldHp=p.hp;if(keepPlayers){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.48);p.energy=Math.min(100,p.energy+35);} });
 if(index===0){spawnWavePreview();}else{floating(240,100,'СЕКТОР '+String(index+1).padStart(2,'0'),'#ffdf88',120,true);} }
function spawnWavePreview(){// The first encounter is activated by its own explicit world position.
}
function createEnemy(type,x,y){const cfg=ENEMY[type]||ENEMY.marine,dif=DIFIC[settings.difficulty];return {id:Math.random(),type,x,y,z:type==='drone'?37:0,vz:0,vx:0,hp:Math.round(cfg.hp*dif.hp),maxHp:Math.round(cfg.hp*dif.hp),speed:cfg.speed*rand(.9,1.08),face:-1,ai:'approach',cool:Math.floor(rand(24,68)),wind:0,recover:0,stun:0,hurt:0,flash:0,walk:rand(0,6),fire:0,shield:0,healCd:210+rand(0,140),ammo:6,burstShots:0,burstTimer:0,deathStyle:Math.floor(rand(0,4)),targetLock:0,lastTarget:null,armor:cfg.armor||0,dead:false,deathT:0,heldBy:null,attackCd:0,retreat:0};}
function spawnWave(wave){const g=game;g.waveActive=true;g.gateX=wave.x+150;g.announcement='КОНТАКТ С ПРОТИВНИКОМ  /  ВОЛНА '+(g.waveIndex+1);g.announceT=92;
 const types=wave.types.slice();if(coop&&joined)types.push(pick(['marine','marine','heavy','android']));
 types.forEach((type,i)=>{let px=wave.x+115+i*37+rand(-13,14),py=196+((i*19)%45);g.enemies.push(createEnemy(type,px,py));});g.waveIndex++;synth('boss',.18);}
function spawnBoss(){const g=game,lev=LEVELS[g.level];if(g.boss)return;const hp=Math.round(lev.bossHp*DIFIC[settings.difficulty].hp*(coop&&joined?1.35:1));g.boss={x:lev.length-160,y:221,z:0,hp,maxHp:hp,face:-1,phase:1,ai:'stalk',cool:100,wind:0,attackKind:'',flash:0,hurt:0,stun:0,vz:0,walk:0,dashT:0,dashVictims:new Set(),dead:false,deathT:0};g.announcement='ВНИМАНИЕ  //  '+lev.bossName;g.announceT=185;g.stageBanner=0;g.flash=12;g.shake=8;synth('boss');updateMusic();floating(g.boss.x,g.boss.y-120,'БОСС ПРИБЛИЖАЕТСЯ','#ffdc7e',110);}
function addScore(p,n){p.score+=n;game.score+=n;if(game.score>records.high){records.high=game.score;save('records',records)}}
function killEnemy(e,killer){if(e.dead)return;e.dead=true;e.hp=0;e.deathT=0;e.vz=Math.max(e.vz,1.2);e.ai='dead';game.kills++;game.stageKills++;if(killer){killer.kills++;addScore(killer,ENEMY[e.type].score);}
 game.shake=Math.max(game.shake,e.type==='heavy'?4:1.5);burst(e.x,e.y-28,e.type==='android'?'#a1eaf1':'#df4242',e.type==='heavy'?22:13,2.9);floating(e.x,e.y-65,'+'+ENEMY[e.type].score,'#ffe08b',65);synth('die',.75);
 if(Math.random()<.23||game.stageKills%6===0){const type=pick(['med','energy','bonus','bonus','bonus','shield']);game.items.push({x:e.x,y:e.y-4,type,t:1100,bob:rand(0,TAU)});} }
function killBoss(){const g=game;if(!g.boss||g.boss.dead)return;g.boss.dead=true;g.boss.hp=0;g.bossDown=130;g.announcement='ЧУДОВИЩЕ УЛЬЯ УНИЧТОЖЕНО';g.announceT=125;g.shake=14;g.flash=22;g.players.forEach(p=>addScore(p,3000));updateMusic();burst(g.boss.x,g.boss.y-75,'#a9fc78',70,5);synth('boom',1.4);}
function floating(x,y,message,color='#ffde8a',t=45,screenSpace=false){if(!game)return;game.texts.push({x,y,message,color,t,maxT:t,screenSpace});if(game.texts.length>80)game.texts.shift()}
function burst(x,y,color,n=8,power=2){if(!game)return;for(let i=0;i<n&&game.particles.length<(settings.particles===0?90:settings.particles===1?240:540);i++){const a=rand(0,TAU),speed=rand(.25,power);game.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-.5,t:rand(13,43),maxT:43,size:rand(.9,3),color});}}

function impactVFX(x,y,organic=true,force=1){
 if(!game)return;
 const color=organic?'#dc3c4d':'#8bd9f6';
 if(organic&&settings.violence>0){
   const n=Math.round((settings.violence===2?17:8)*Math.min(1.6,force));
   for(let i=0;i<n&&game.particles.length<540;i++){
     const a=rand(-Math.PI*.90,-.08),v=rand(.6,2.9)*force;
     game.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:rand(16,36),maxT:36,size:rand(1,2.5),color:pick(['#cc243a','#8c192f','#ea5164']),gravity:.10,kind:'blood'});
   }
   if(game.blood.length<70&&Math.random()<(settings.violence===2?.66:.36))game.blood.push({x,y:y+30,r:rand(3,settings.violence===2?9:5),t:1000});
 }else if(!organic){burst(x,y,'#90d6f1',12,3);burst(x,y,'#ffc86b',5,2);}
 // A thin three-pronged arc, not an overbright full-screen flash.
 game.decals.push({x,y,life:13,max:13,kind:'slash',size:force});
 if(game.decals.length>80)game.decals.shift();
}

function damagePlayer(p,damage,from){if(p.dead||p.inv>0||p.dodge>0||p.stun>0)return;if(p.counterWindow>0){p.counterWindow=0;p.inv=22;p.attack='counter';p.attackT=ATTACKS.counter.startup;game.shake=Math.max(game.shake,5);synth('tail');floating(p.x,p.y-82,'КОНТРААТАКА!','#f4e6a7',55);for(const e of game.enemies){if(!e.dead&&Math.abs(e.x-p.x)<95&&Math.abs(e.y-p.y)<38)hitTarget(p,e,{damage:37,stun:25,knock:26,hitstop:4},1);}return;}let amt=damage*DIFIC[settings.difficulty].damage;if(p.rageT>0)amt*=.48;if(CLASS[p.classId].id==='praetorian')amt*=.85;amt=Math.ceil(amt);p.hp=Math.max(0,p.hp-amt);game.damageTaken+=amt;game.stageDamageTaken+=amt;p.inv=47;p.stun=17;p.vx=(p.x>=from?1:-1)*3.3;p.grabTarget=null;p.attack=null;p.chain=0;p.buffer=null;game.combo=0;game.comboTimer=0;game.shake=Math.max(game.shake,5);burst(p.x,p.y-34,'#ff865c',13,2.9);floating(p.x,p.y-69,'-'+amt,'#ff8c7d',46);synth('hurt');
 if(p.hp<=0){p.lives--;if(p.lives>0){p.hp=Math.round(p.maxHp*.58);p.stun=65;p.inv=130;floating(p.x,p.y-105,'ВОЗВРАЩЕНИЕ','#a6f8e8',84);}else{p.dead=true;p.downT=0;floating(p.x,p.y-106,'ИГРОК '+p.id+' ПАЛ','#ff8d7d',125);if(game.players.every(pl=>pl.dead)){game.finished=true;changeScreen('gameover');}}}}
function hitTarget(p,e,atk,scale=1){if(e.dead||e.heldBy)return false;const facing=e.x-p.x;const blocked=e.type==='shield'&&facing*e.face<0&&atk.damage<35&&Math.random()<.75;if(blocked){burst(e.x,e.y-30,'#79d9ff',8,1.6);floating(e.x,e.y-56,'БЛОК','#b8e9ff',33);synth('tail',.3);return false;}
 let amount=Math.round(atk.damage*CLASS[p.classId].power*(p.rageT>0?1.35:1)*scale);if(e.armor)amount=Math.round(amount*(1-e.armor));e.hp-=amount;e.flash=7;e.hurt=13;e.stun=atk.stun;e.ai='stun';e.vx=p.face*atk.knock*(e.type==='heavy'?.42:.55);e.vz=atk.launch||0;
 game.combo++;game.comboTimer=118;game.maxCombo=Math.max(game.maxCombo,game.combo);records.maxCombo=Math.max(records.maxCombo,game.combo);p.energy=clamp(p.energy+4.8,0,100);addScore(p,Math.round(55*Math.min(8,1+game.combo*.25)));game.hitStop=Math.max(game.hitStop,atk.hitstop||2);game.shake=Math.max(game.shake,atk.hitstop>=4?4:2.2);
 if(settings.damageNumbers)floating(e.x,e.y-54,String(amount),'#fff6b6',39);burst(e.x,e.y-31,amount>30?'#ffc676':'#e9f1ce',9,2.5);impactVFX(e.x,e.y-31,e.type!=='android'&&e.type!=='turret'&&e.type!=='drone',amount>32?1.2:.75);synth(atk.damage>=30?'heavy':'hit',.8);
 if(e.hp<=0)killEnemy(e,p);return true;}
function hitBoss(p,atk,scale=1){const b=game.boss;if(!b||b.dead)return false;const damage=Math.max(1,Math.round(atk.damage*CLASS[p.classId].power*scale*(p.rageT>0?1.35:1)*.82));b.hp=Math.max(0,b.hp-damage);b.flash=9;b.hurt=11;game.combo++;game.comboTimer=115;game.maxCombo=Math.max(game.maxCombo,game.combo);p.energy=clamp(p.energy+5.5,0,100);addScore(p,Math.round(100+game.combo*13));game.hitStop=Math.max(game.hitStop,atk.hitstop||2);game.shake=Math.max(game.shake,4);burst(b.x,b.y-83,'#b9f7a3',14,3.2);if(settings.damageNumbers)floating(b.x,b.y-128,String(damage),'#fff3c8',46);impactVFX(b.x,b.y-89,true,damage>40?1.3:.65);synth('hit');if(b.hp<=0)killBoss();return true;}
function attackProps(p,atk){for(const object of game.props){if(object.dead)continue;const dx=object.x-p.x;if(dx*p.face>-15&&dx*p.face<atk.reach+10&&Math.abs(object.y-p.y)<36){object.hp--;burst(object.x,object.y-16,'#ffd89b',8,2);if(object.hp<=0){object.dead=true;object.breakT=0;synth('boom',.6);addScore(p,80);floating(object.x,object.y-34,'+80','#ffde83',45);burst(object.x,object.y-20,object.type==='terminal'?'#7de4ef':'#dfab74',28,3.2);if(object.type==='barrel')explode(object.x,object.y,71,29,p);else if(Math.random()<.42)game.items.push({x:object.x,y:object.y,type:pick(['med','energy','bonus']),t:900,bob:0});}}}}
function explode(x,y,radius,damage,source){game.flash=Math.max(game.flash,8);game.shake=Math.max(game.shake,7);burst(x,y-25,'#ffb74a',45,4.5);burst(x,y-25,'#e4ee93',10,2.5);synth('boom');for(const e of game.enemies){if(!e.dead&&Math.hypot(e.x-x,(e.y-y)*1.7)<radius){if(source)hitTarget(source,e,{damage,stun:21,knock:22,hitstop:3},1);else{e.hp-=damage;e.stun=26;if(e.hp<=0)killEnemy(e,null);}}}for(const p of game.players){if(!p.dead&&Math.hypot(p.x-x,(p.y-y)*1.7)<radius)damagePlayer(p,damage*.55,x);}for(const obj of game.props){if(obj.type==='barrel'&&!obj.dead&&Math.abs(obj.x-x)<radius*.75){obj.hp=0;obj.dead=true;obj.breakT=0;}}}
// ---------------------------- PLAYER COMBAT --------------------------------
function beginAttack(p,name){const atk=ATTACKS[name];if(!atk||p.dead||p.stun>0||p.dodge>0)return false;
 p.attack=name;p.attackT=0;p.hitTargets.clear();p.buffer=null;if(name==='claw1'||name==='claw2'||name==='claw3'){p.chain=Number(name.slice(-1));p.chainTick=55;}else if(name!=='air')p.chainTick=Math.min(p.chainTick,28);
 if(name==='super')p.energy=0;else if(['acidclaw','predator','ripper','counter'].includes(name))p.energy=Math.max(0,p.energy-80);else if(['acidburst','impact','phantom','rage'].includes(name))p.energy-=35;
 synth(name==='tail'||name==='impact'?'tail':name==='acidburst'?'acid':'claw',.65);return true;}
function tryAttack(p,action){if(p.dead||p.stun>0)return;
 if(action==='grab'){if(p.grabTarget){const e=p.grabTarget;p.grabTarget=null;e.heldBy=null;e.stun=22;e.vx=p.face*8;e.vz=3.1;e.hp-=23;burst(e.x,e.y-35,'#ffd985',13,3);floating(e.x,e.y-56,'БРОСОК!','#ffe790',40);if(e.hp<=0)killEnemy(e,p);synth('heavy');return;}const e=game.enemies.find(e=>!e.dead&&!e.heldBy&&Math.abs(e.x-p.x)<34&&Math.abs(e.y-p.y)<23&&e.type!=='turret'&&e.type!=='heavy');if(e){p.grabTarget=e;p.grabTick=100;e.heldBy=p;e.stun=100;floating(e.x,e.y-67,'ЗАХВАТ','#afe9ff',50);synth('select');}return;}
 if(p.grabTarget){if(action==='light')beginAttack(p,'grabbite');else if(action==='heavy'||action==='special')tryAttack(p,'grab');return;}
 if(action==='dash'){if(p.dodgeCd>0||p.airborne)return;p.dodge=16;p.dodgeCd=55;p.inv=16;p.attack=null;p.buffer=null;synth('dash');burst(p.x,p.y-15,CLASS[p.classId].color,9,1.7);return;}
 if(action==='jump'){if(!p.airborne){p.vz=5.7;p.airborne=true;p.z=.5;synth('jump');}return;}
 let name=null;
 if(action==='light'){if(p.airborne)name='air';else name='claw'+(p.chainTick>0?(p.chain%3)+1:1);}
 if(action==='heavy'){name=p.airborne?'slam':p.chainTick>0&&p.chain>=2?'finisher':'tail';}
 if(action==='special'){if(p.energy<35)return;name=['acidburst','impact','phantom','rage'][p.classId];}
 if(action==='super'){if(p.energy<80)return;name=['acidclaw','predator','ripper','counter'][p.classId];}
 if(!name)return;
 if(p.attack){p.buffer={name,expires:29};return;}
 beginAttack(p,name);
}
function updateAttack(p){if(!p.attack)return;const type=p.attack,atk=ATTACKS[type],t=++p.attackT;
 if(type==='counter'&&t===1)p.counterWindow=26;
 if(type==='ripper'&&t>=atk.startup&&t<atk.startup+atk.active){p.x+=p.face*1.9;if(t%6===0)p.hitTargets.clear();if(t%4===0)burst(p.x+p.face*24,p.y-35,'#afebf7',5,1.5);}
 if(type==='predator'&&t===atk.startup){game.shake=Math.max(game.shake,8);burst(p.x,p.y-7,'#d9b9ff',27,4);}
 if(type==='acidclaw'&&t===atk.startup){game.puddles.push({x:p.x+p.face*69,y:p.y,radius:35,t:175,lastHit:game.tick,owner:p});burst(p.x+p.face*46,p.y-34,'#adff5a',25,3);}
 if(type==='phantom'&&t>=atk.startup&&t<atk.startup+atk.active){p.x+=p.face*5.2;p.inv=Math.max(p.inv,4);if(t%3===0)burst(p.x-p.face*22,p.y-31,CLASS[p.classId].color,3,1.4);}
 if(type==='rage'&&t===atk.startup){p.rageT=360;floating(p.x,p.y-86,'ЯРОСТЬ УЛЬЯ!','#ffdf7b',80);game.flash=8;}
 if(type==='acidburst'&&t===atk.startup){for(let i=-1;i<=1;i++){game.bullets.push({x:p.x+p.face*30,y:p.y-37,depth:p.y+i*11,vx:p.face*(4.8+Math.abs(i)*.2),vy:i*.14,life:75,type:'bioacid',damage:24,owner:p,trail:[]});}burst(p.x+p.face*32,p.y-39,'#acff63',22,2.6);}
 if(t>=atk.startup&&t<atk.startup+atk.active){
  for(const e of game.enemies){if(e.dead||p.hitTargets.has(e.id))continue;const dx=(e.x-p.x)*p.face;if(dx<-18||dx>atk.reach||Math.abs(e.y-p.y)>atk.depth||(!p.airborne&&e.z>38))continue;p.hitTargets.add(e.id);hitTarget(p,e,atk,type==='phantom'?.78:1);}
  const b=game.boss;if(b&&!b.dead&&!p.hitTargets.has('boss')){const dx=(b.x-p.x)*p.face;if(dx>-63&&dx<atk.reach+48&&Math.abs(b.y-p.y)<atk.depth+25){p.hitTargets.add('boss');hitBoss(p,atk);}}
  if(t===atk.startup+1){attackProps(p,atk);if(type==='super'){game.flash=12;burst(p.x+p.face*70,p.y-33,CLASS[p.classId].color,50,5);}}
 }
 const end=atk.startup+atk.active+atk.recovery;
 if(t>=end){p.attack=null;p.attackT=0;if(p.buffer){const next=p.buffer.name;p.buffer=null;if((next==='acidburst'||next==='impact'||next==='phantom'||next==='rage')&&p.energy<35)return;beginAttack(p,next);}}
}
function applyPlayer(p,input){const cls=CLASS[p.classId];if(p.dead){p.downT++;return;}
 if(p.inv>0)p.inv--;if(p.counterWindow>0)p.counterWindow--;p.oldHp=lerp(p.oldHp,p.hp,.09);if(p.stun>0)p.stun--;if(p.dodgeCd>0)p.dodgeCd--;if(p.rageT>0)p.rageT--;if(p.chainTick>0)p.chainTick--;else p.chain=0;
 p.energy=clamp(p.energy+(p.rageT>0?.045:.058),0,100);
 if(p.buffer&&--p.buffer.expires<=0)p.buffer=null;
 if(p.grabTarget){const e=p.grabTarget;if(!e||e.dead){p.grabTarget=null;}else{p.grabTick--;e.x=p.x+p.face*25;e.y=p.y+3;e.z=0;if(p.grabTick<=0){e.heldBy=null;p.grabTarget=null;e.stun=35;}}}
 if(input.dash)tryAttack(p,'dash');if(input.jump)tryAttack(p,'jump');if(input.grab)tryAttack(p,'grab');if(input.light)tryAttack(p,'light');if(input.heavy)tryAttack(p,'heavy');if(input.special)tryAttack(p,'special');if(input.super)tryAttack(p,'super');
 const mx=clamp(input.x||0,-1,1),my=clamp(input.y||0,-1,1);p.moveX=mx;p.moveY=my;if(Math.abs(mx)>.16)p.face=mx>0?1:-1;
 if(p.dodge>0){p.dodge--;p.x+=p.face*4.0;p.inv=Math.max(p.inv,p.dodge>4?2:0);if(p.dodge%3===0)burst(p.x,p.y-14,'#a3dceb',2,.75);}else if(p.stun>0){p.x+=p.vx;p.vx*=.84;}else{const mult=p.attack?.62:1;const slow=p.grabTarget?.6:1;p.x+=mx*cls.speed*mult*slow;p.y+=my*cls.speed*.60*mult*slow;p.walking+=Math.hypot(mx,my)*.21;}
 const lev=LEVELS[game.level],cap=game.waveActive?game.gateX:lev.length-45;p.x=clamp(p.x,23,Math.min(lev.length-40,cap));p.y=clamp(p.y,190,244);
 if(p.airborne){p.z+=p.vz;p.vz-=.29;if(p.z<=0){p.z=0;p.vz=0;p.airborne=false;burst(p.x,p.y-2,'#89999c',5,1);}}
 updateAttack(p);if(p.attack&&game.tick%4===0&&p.attackT>0&&p.attackT<20)p.trail.push({x:p.x,y:p.y-p.z,t:9,row:ATTACKS[p.attack].anim,frame:clamp(Math.floor(p.attackT/3),0,9)});p.trail=p.trail.filter(a=>--a.t>0).slice(-5);p.anim++;
}
// ------------------------------ ENEMY AI -----------------------------------
function targetPlayer(e){let best=null,dist=Infinity;for(const p of game.players){if(p.dead)continue;const d=Math.abs(p.x-e.x)+Math.abs(p.y-e.y)*1.6;if(d<dist){dist=d;best=p;}}return best;}
function spawnShot(e,t){let x=e.x+e.face*26,y=e.y-39;const cfg=ENEMY[e.type],diff=DIFIC[settings.difficulty];
 if(e.type==='grenadier'){
  game.bullets.push({x,y,depth:e.y,vx:e.face*2.25,vy:(t.y-e.y)/58,life:65,type:'grenade',damage:cfg.damage,owner:null,explosionX:clamp(t.x,23,LEVELS[game.level].length-35),explosionY:t.y,gravity:0,flight:0});
 }else if(e.type==='flame'){
  for(let i=-2;i<=2;i++)game.bullets.push({x,y:y+i*2,depth:e.y+i*10,vx:e.face*(2.5+Math.abs(i)*.25),vy:i*.17,life:37,type:'fire',damage:cfg.damage/3,owner:null});
 }else{
  for(let i=0;i<(e.type==='heavy'?3:1);i++)game.bullets.push({x:x+i*e.face*3,y:y+i*1.5,depth:lerp(e.y,t.y,.75),vx:e.face*(e.type==='heavy'?3.7:e.type==='gunner'?4.4:3.2),vy:(t.y-e.y)*.012,life:95,type:'shot',damage:cfg.damage*(e.type==='heavy'?.46:1),owner:null});
 }e.fire=8;if(e.type==='gunner'||e.type==='marine'||e.type==='heavy'){for(let k=0;k<2;k++){game.particles.push({x:e.x+e.face*6,y:e.y-44,vx:-e.face*rand(.6,1.9),vy:-rand(1.0,2.1),t:rand(22,42),maxT:42,size:1.4,color:'#cab777',gravity:.15});}}burst(x,y,'#ffe080',e.type==='flame'?12:5,1.6);synth(e.type==='flame'?'acid':'shoot',.48);}
function enemyAttack(e,target){const dX=target.x-e.x,dY=target.y-e.y;if(['turret','grenadier','marine','heavy','flame','gunner','medic','drone'].includes(e.type)){spawnShot(e,target);if(e.type==='gunner'){e.burstShots=5;e.burstTimer=7;}}
 else if(Math.abs(dX)<54&&Math.abs(dY)<29){damagePlayer(target,ENEMY[e.type].damage,e.x);if(e.type==='android')burst(e.x+e.face*25,e.y-31,'#75ecff',18,2);}
}
function updateEnemy(e){if(e.dead){e.deathT++;if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<0){e.z=0;e.vz=0;}}return;}
 if(e.heldBy)return;
 if(e.flash>0)e.flash--;if(e.hurt>0)e.hurt--;if(e.fire>0)e.fire--;e.walk+=.12;
 if(e.burstShots>0){if(--e.burstTimer<=0){const t=targetPlayer(e);if(t)spawnShot(e,t);e.burstShots--;e.burstTimer=7;}}
 if(e.type==='medic'&&--e.healCd<=0){const ally=game.enemies.filter(a=>a!==e&&!a.dead&&a.hp<a.maxHp*.79&&Math.abs(a.x-e.x)<165).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally){ally.hp=Math.min(ally.maxHp,ally.hp+22);burst(ally.x,ally.y-42,'#a9f7d4',19,1.5);floating(ally.x,ally.y-70,'+МЕДИК','#b5ffc8',54);e.ai='healing';e.recover=35;synth('pickup',.55);}e.healCd=160+Math.floor(rand(0,70));}
 if(e.type==='drone'){e.z=35+Math.sin(game.tick*.075+e.id*3)*7;e.vz=0;}else if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<=0){e.z=0;e.vz=0;}}e.x+=e.vx;e.vx*=.78;
 if(e.stun>0){e.stun--;e.ai='stun';return;}
 const target=targetPlayer(e);if(!target)return;
 const dx=target.x-e.x,ad=Math.abs(dx),dy=target.y-e.y;e.face=dx<0?-1:1;
 if(e.cool>0)e.cool--;if(e.recover>0){e.recover--;e.ai='recover';return;}
 if(e.wind>0){e.wind--;e.ai='windup';if(e.wind<=0){enemyAttack(e,target);e.recover=e.type==='gunner'?52:e.type==='heavy'?33:e.type==='android'?26:21;e.cool=Math.round(rand(65,110)*DIFIC[settings.difficulty].frequency);}return;}
 const cfg=ENEMY[e.type];if(e.type==='turret'){e.ai='aim';if(e.cool<=0&&ad<205&&Math.abs(dy)<65){e.wind=25;e.ai='windup';}return;}
 // Ranged enemies keep useful distance. Melee fighters flank the target.
 const melee=e.type==='shield'||e.type==='android';const desired=melee?30:e.type==='flame'?72:e.type==='grenadier'?132:e.type==='heavy'?93:e.type==='gunner'?160:e.type==='medic'?145:e.type==='drone'?96:113;
 if(ad>desired+18){e.ai='approach';e.x+=Math.sign(dx)*e.speed;if(Math.abs(dy)>10)e.y+=Math.sign(dy)*e.speed*.35;}
 else if(ad<desired-25&&!melee){e.ai='retreat';e.x-=Math.sign(dx)*e.speed*.67;if(Math.abs(dy)>22)e.y+=Math.sign(dy)*e.speed*.35;}
 else {e.ai='position';if(Math.abs(dy)>9)e.y+=Math.sign(dy)*e.speed*.28;else if(melee&&ad<14)e.x-=Math.sign(dx)*.25;}
 if(e.cool<=0&&ad<(melee?54:e.type==='grenadier'?185:e.type==='gunner'?210:165)&&Math.abs(dy)<(melee?24:43)){e.wind=e.type==='gunner'?49:e.type==='heavy'?32:e.type==='android'?24:e.type==='grenadier'?39:e.type==='shield'?23:e.type==='flame'?28:e.type==='drone'?18:19;e.ai='windup';e.cool=50;}
 const limit=LEVELS[game.level].length;e.x=clamp(e.x,15,limit-18);e.y=clamp(e.y,191,243);
}
function bossProjectile(b,target,phase){if(phase===1){game.bullets.push({x:b.x+b.face*35,y:b.y-92,depth:target.y,vx:b.face*3.25,vy:0,life:120,type:'bossAcid',damage:14,owner:null});}
 else{for(let i=-1;i<=1;i++)game.bullets.push({x:b.x+b.face*31,y:b.y-95+i*7,depth:target.y+i*20,vx:b.face*(3.3+Math.abs(i)*.2),vy:i*.23,life:127,type:'bossAcid',damage:phase===3?18:14,owner:null});}
 burst(b.x+b.face*40,b.y-91,'#a2ff67',19,2.5);synth('acid');}
function updateBoss(){
 const b=game.boss;if(!b)return;
 if(b.dead){if(game.bossDown>0){game.bossDown--;if(game.bossDown%12===0)burst(b.x+rand(-54,49),b.y-rand(20,130),'#d0ff75',11,3);if(game.bossDown===0)finishStage();}return;}
 b.walk+=.075;if(b.flash>0)b.flash--;if(b.hurt>0)b.hurt--;
 const oldPhase=b.phase;b.phase=b.hp<b.maxHp*.28?3:b.hp<b.maxHp*.63?2:1;
 if(oldPhase!==b.phase){b.cool=85;game.flash=17;game.shake=11;game.announcement='ФАЗА '+b.phase+'  /  '+(b.phase===3?'ГНЕВ УЛЬЯ':'АГРЕССИЯ');game.announceT=108;burst(b.x,b.y-95,'#b6ff81',60,3.6);synth('boss');}
 const target=targetPlayer(b);if(!target)return;const dx=target.x-b.x,dy=target.y-b.y;b.face=dx<0?-1:1;
 if(b.dashT>0){b.dashT--;b.x=clamp(b.x+b.face*(game.level===1?6.8:5.3),35,LEVELS[game.level].length-42);
   if(game.tick%3===0)burst(b.x-b.face*30,b.y-25,game.level===1?'#f1aa69':'#acff76',5,1.7);
   for(const p of game.players){if(!p.dead&&!b.dashVictims.has(p.id)&&Math.abs(p.x-b.x)<55&&Math.abs(p.y-b.y)<46){b.dashVictims.add(p.id);damagePlayer(p,game.level===1?24:18,b.x);}}return;
 }
 if(b.cool>0)b.cool--;
 if(b.wind>0){b.wind--;if(b.wind===0){
   if(b.attackKind==='acid'){bossProjectile(b,target,b.phase);}
   else if(b.attackKind==='slam'){game.shake=9;game.flash=7;burst(b.x+b.face*34,b.y-16,'#b7e6a3',34,3.8);for(const p of game.players){if(!p.dead&&Math.abs(p.x-b.x)<125&&Math.abs(p.y-b.y)<46)damagePlayer(p,b.phase===3?27:21,b.x);}}
   else if(b.attackKind==='tail'){for(const p of game.players){if(!p.dead&&Math.abs(p.x-b.x)<133&&Math.abs(p.y-b.y)<38)damagePlayer(p,20,b.x);}}
   else if(b.attackKind==='charge'){b.dashVictims.clear();b.dashT=game.level===1?31:25;game.shake=Math.max(game.shake,6);synth('heavy');}
   else if(b.attackKind==='summon'){const active=game.enemies.filter(e=>!e.dead).length;if(active<5){for(let i=0;i<Math.min(2,5-active);i++)game.enemies.push(createEnemy(i===0?'drone':'android',clamp(b.x+b.face*(100+i*60),30,LEVELS[game.level].length-40),211+i*18));}burst(b.x,b.y-110,'#be7dff',32,3);}
   b.cool=b.phase===3?86:b.phase===2?108:130;
  }return;}
 if(Math.abs(dx)>94)b.x+=Math.sign(dx)*(.36+b.phase*.12);
 if(b.cool<=0){const near=Math.abs(dx)<122;const roll=Math.random(),lvl=game.level;
  if(lvl===0&&b.phase>=2&&roll>.64)b.attackKind='charge';
  else if(lvl===1&&roll>.58)b.attackKind='charge';
  else if(lvl===2&&b.phase>=2&&roll>.76)b.attackKind='summon';
  else b.attackKind=near?(b.phase>=2&&roll>.42?'slam':'tail'):(b.phase>=2&&roll>.73?'slam':'acid');
  b.wind=b.attackKind==='slam'?43:b.attackKind==='tail'?31:b.attackKind==='charge'?35:b.attackKind==='summon'?48:37;
  floating(b.x,b.y-143,{acid:'КИСЛОТА!',slam:'УДАР О ЗЕМЛЮ!',tail:'ВЗМАХ ХВОСТОМ!',charge:'ТАРАН!',summon:'ПОДКРЕПЛЕНИЕ УЛЬЯ!'}[b.attackKind],'#ffdc9b',50);
 }
}

function damageBullet(b){if(b.type==='grenade'){explode(b.explosionX,b.explosionY,70,b.damage,null);return;}if(b.type==='bioacid'){game.puddles.push({x:b.x,y:b.depth,radius:32,t:160,lastHit:-100,owner:b.owner});burst(b.x,b.y,'#baff6b',20,2);return;}}
function updateBullets(){const g=game;for(let i=g.bullets.length-1;i>=0;i--){const b=g.bullets[i];b.x+=b.vx;b.y+=b.vy||0;b.life--;if(b.type==='grenade'){b.flight++;b.y-=Math.sin(Math.PI*b.flight/65)*.18;}
  if((b.type==='bioacid'||b.type==='bossAcid')&&g.tick%3===0)burst(b.x,b.y,'#bbff72',2,.6);
  if(b.type==='grenade'&&b.life<=0){damageBullet(b);g.bullets.splice(i,1);continue;}
  if(b.type==='bioacid'){
    let struck=false;for(const e of g.enemies){if(!e.dead&&Math.abs(e.x-b.x)<17&&Math.abs(e.y-b.depth)<26){hitTarget(b.owner,e,{damage:b.damage,stun:9,knock:8,hitstop:2},1);struck=true;}}
    const boss=g.boss;if(boss&&!boss.dead&&Math.abs(boss.x-b.x)<60&&Math.abs(boss.y-b.depth)<48){hitBoss(b.owner,{damage:b.damage,stun:4,knock:0,hitstop:2},.85);struck=true;}
    if(struck||b.life<=0){damageBullet(b);g.bullets.splice(i,1);continue;}
  }else if(b.type!=='grenade'){
   for(const p of g.players){if(!p.dead&&Math.abs(b.x-p.x)<14&&Math.abs((b.depth||p.y)-p.y)<23&&Math.abs(b.y-(p.y-37))<46){damagePlayer(p,b.damage,b.x);burst(b.x,b.y,b.type==='fire'?'#ffbd56':'#b8ff79',7,2);g.bullets.splice(i,1);break;}}
  }
  if(i<g.bullets.length&&g.bullets[i]===b&&(b.life<=0||b.x<g.camera-110||b.x>g.camera+W+150))g.bullets.splice(i,1);
 }
 if(g.bullets.length>240)g.bullets.splice(0,g.bullets.length-240);
}
function updatePuddles(){for(let i=game.puddles.length-1;i>=0;i--){const a=game.puddles[i];a.t--;if(a.t<0){game.puddles.splice(i,1);continue;}if(game.tick%26===0){for(const e of game.enemies){if(!e.dead&&Math.abs(e.x-a.x)<a.radius&&Math.abs(e.y-a.y)<22){e.hp-=8;e.hurt=5;burst(e.x,e.y-6,'#b7fd6b',4,1);if(e.hp<=0)killEnemy(e,a.owner);}}}}}
function updateHazards(){for(const h of game.hazards){h.timer++;const active=(h.timer%190)<(h.type==='steam'?58:45);h.active=active;if(active&&game.tick%25===0){for(const p of game.players){if(!p.dead&&Math.abs(p.x-h.x)<(h.type==='electric'?32:24)&&Math.abs(p.y-h.y)<26)damagePlayer(p,h.type==='electric'?10:7,h.x);}}}}
function updateItems(){for(let i=game.items.length-1;i>=0;i--){const it=game.items[i];it.t--;it.bob+=.065;if(it.t<=0){game.items.splice(i,1);continue;}for(const p of game.players){if(p.dead||Math.abs(p.x-it.x)>23||Math.abs(p.y-it.y)>21)continue;
 switch(it.type){case 'med':p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.28));break;case 'energy':p.energy=clamp(p.energy+48,0,100);break;case 'bonus':addScore(p,1000);break;case 'shield':p.inv=Math.max(p.inv,125);break;}
 floating(it.x,it.y-40,{med:'АПТЕЧКА +HP',energy:'БИО-ЭНЕРГИЯ',bonus:'ДАННЫЕ +1000',shield:'ВРЕМЕННЫЙ ЩИТ'}[it.type],'#e8ff99',62);game.uniqueItems++;synth('pickup');game.items.splice(i,1);break;
 }} }
function updateEffects(){const g=game;for(const o of g.props){if(o.dead)o.breakT=Math.min(30,(o.breakT||0)+1);}for(let i=g.blood.length-1;i>=0;i--){if(--g.blood[i].t<=0)g.blood.splice(i,1);}for(let i=g.decals.length-1;i>=0;i--){if(--g.decals[i].life<=0)g.decals.splice(i,1);} for(let i=g.particles.length-1;i>=0;i--){const q=g.particles[i];q.x+=q.vx;q.y+=q.vy;q.vy+=q.gravity||.07;q.vx*=.986;q.t--;if(q.t<=0)g.particles.splice(i,1);}for(let i=g.texts.length-1;i>=0;i--){const t=g.texts[i];t.y-=.38;t.t--;if(t.t<=0)g.texts.splice(i,1);}g.shake*=.86;if(g.shake<.25)g.shake=0;if(g.flash>0)g.flash--;if(g.announceT>0)g.announceT--;if(g.stageBanner>0)g.stageBanner--;if(g.comboTimer>0)g.comboTimer--;else g.combo=0;
 if(g.tick%60===0){records.maxCombo=Math.max(records.maxCombo,g.maxCombo);}
}
function finishStage(){if(game.finished)return;game.finished=true;const g=game;g.stageBonus=Math.round(Math.max(0,7000-g.levelTime*2.1));const living=g.players.filter(p=>!p.dead);const bonusTo= living.length?living:g.players;bonusTo.forEach(p=>addScore(p,Math.round(g.stageBonus/bonusTo.length)));g.stats.push({name:LEVELS[g.level].name,time:Math.round(g.levelTime/60),kills:g.stageKills,score:g.score,combo:g.maxCombo});records.stage=Math.max(records.stage,g.level+1);records.wins++;save('records',records);changeScreen('stageclear');synth('pickup',1.3);}
function advanceStage(){if(!game)return;if(game.level<LEVELS.length-1){startStage(game.level+1);changeScreen('playing');}else{changeScreen('victory');}}
function tickGame(){if(!game)return;const g=game;if(screen!=='playing')return;g.tick++;g.levelTime++;
 if(g.hitStop>0){g.hitStop--;updateEffects();return;}
 const ins=captureInputs();if(ins.some(v=>v.pause)){changeScreen('paused');menuIndex=0;resetInput();return;}g.players.forEach((p,i)=>applyPlayer(p,ins[i]||{x:0,y:0}));
 const center=g.players.filter(p=>!p.dead).reduce((sum,p)=>sum+p.x,0)/Math.max(1,g.players.filter(p=>!p.dead).length);
 if(coop&&joined&&g.players.length===2){let [a,b]=g.players;if(Math.abs(a.x-b.x)>370){const leader=a.x>b.x?a:b,lagger=a.x>b.x?b:a;leader.x=clamp(leader.x,lagger.x-370,lagger.x+370);}}
 const lvl=LEVELS[g.level];const wave=lvl.waves[g.waveIndex];
 if(!g.waveActive&&!g.boss&&wave&&center>=wave.x)spawnWave(wave);
 for(const e of g.enemies)updateEnemy(e);
 if(g.waveActive&&g.enemies.every(e=>e.dead)){g.waveActive=false;g.gateX=Infinity;g.announcement='СЕКТОР ОЧИЩЕН  //  ВПЕРЁД';g.announceT=62;g.players.forEach(p=>addScore(p,350));synth('pickup');}
 if(g.enemies.length>48)g.enemies=g.enemies.filter(e=>!e.dead||e.deathT<120);
 if(g.waveIndex>=lvl.waves.length&&!g.waveActive&&!g.boss&&center>lvl.length-690)spawnBoss();
 updateBoss();updateBullets();updatePuddles();updateHazards();updateItems();updateEffects();
 const xs=g.players.filter(p=>!p.dead).map(p=>p.x);let target=(xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:320)-W*.39;
 /* Do not pull the camera away from the active player just because a boss spawned. */g.camTarget=clamp(target,0,lvl.length-W);g.camera=lerp(g.camera,g.camTarget,.115);
 if(g.players.every(p=>p.dead)&&!g.finished){g.finished=true;changeScreen('gameover');}
}
// ----------------------------- RENDER SYSTEM -------------------------------

// Small real 3D meshes rendered into the pixel-perfect Canvas with a software
// perspective projection. The combat and characters remain 2.5D sprites.
const meshCube={
  verts:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
  faces:[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]]
};
const meshOcta={verts:[[0,-1.15,0],[1,0,0],[0,0,1],[0,1.15,0],[-1,0,0],[0,0,-1]],faces:[[0,1,2],[0,2,4],[0,4,5],[0,5,1],[3,2,1],[3,4,2],[3,5,4],[3,1,5]]};
function transformVertex(v,rx,ry){
 const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry);
 const x=v[0]*cy+v[2]*sy,z=-v[0]*sy+v[2]*cy;
 return [x,v[1]*cx-z*sx,v[1]*sx+z*cx];
}
function softwareMesh(mesh,x,y,size,t,color='#7decef',mode='solid'){
 if(!settings.pixel3d)return;
 const verts=mesh.verts.map(v=>transformVertex(v,t*.47,t*.83));
 const project=v=>[Math.round(x+v[0]*size/(1+v[2]*.21)),Math.round(y+v[1]*size*.88/(1+v[2]*.21))];
 const faces=mesh.faces.map((f,i)=>({idx:i,z:f.reduce((a,j)=>a+verts[j][2],0)/f.length,xy:f.map(j=>project(verts[j]))})).sort((a,b)=>b.z-a.z);
 faces.forEach(f=>{const xy=f.xy;ctx.beginPath();ctx.moveTo(xy[0][0],xy[0][1]);for(let i=1;i<xy.length;i++)ctx.lineTo(xy[i][0],xy[i][1]);ctx.closePath();if(mode==='solid'){ctx.globalAlpha=.68;ctx.fillStyle=[color,'#1a5770','#0d2b42','#3795a8','#235a74','#70c3ca','#7bdada','#1b5470'][f.idx%8];ctx.fill();ctx.globalAlpha=1;}ctx.strokeStyle=color;ctx.lineWidth=mode==='wire'?.8:1;ctx.stroke();});
}
function torusRing(x,y,rx,ry,t,color){if(!settings.pixel3d)return;
 const pts=[];for(let i=0;i<=22;i++){let a=i/22*TAU,xx=Math.cos(a)*rx,zz=Math.sin(a)*rx, yy=Math.sin(a*2+t)*ry*.16;
 pts.push([x+xx*Math.cos(t)-zz*Math.sin(t)*.56,y+yy+zz*.29]);}
 ctx.beginPath();pts.forEach(([px,py],i)=>i?ctx.lineTo(Math.round(px),Math.round(py)):ctx.moveTo(Math.round(px),Math.round(py)));ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
 for(let k=0;k<4;k++){const a=t+k*Math.PI/2;const px=x+Math.cos(a)*rx*.74;R(px,y+Math.sin(a)*ry*.8,2,2,'#e5fff2');}
}
function drawSectorArt(level,camera,tick){
 const mov=camera*.32;
 if(level===0){
  for(let i=0;i<4;i++){
   const x=((i*235-mov)%830+830)%830-110;const yy=69;
   R(x-36,50,72,115,'rgba(1,10,22,.50)');R(x-34,52,68,109,'rgba(21,100,118,.22)');
   R(x-38,49,76,4,'#356473');R(x-37,156,74,7,'#183744');R(x-32,55,3,100,'#56a1b5');
   L(x+25,58,x+25,151,'rgba(113,241,245,.25)');
   if(settings.pixel3d){softwareMesh(meshOcta,x,102,13,tick*.009+i,'#69d6db','wire');}
   R(x-34,145,68,2,'#447681');
  }
 }else if(level===1){
  for(let i=0;i<5;i++){const x=((i*217-mov)%835+835)%835-105;
   R(x-44,72,95,93,'#101b2a');R(x-40,77,86,3,'#637789');R(x-40,109,86,3,'#394f5a');R(x-40,140,86,3,'#394f5a');
   for(let n=0;n<3;n++){let xx=x-27+n*26;R(xx,83,18,23,'#3b4650');R(xx+2,85,14,19,'#77755c');R(xx,114,18,20,'#393e4a');R(xx+2,116,14,16,'#8a684e');}
   T('СЕК',x-35,147,8,'#b9a76b');if(settings.pixel3d)softwareMesh(meshCube,x+38,140,11,tick*.004+i,'#c4a15f');
  }
  for(let x=44-(mov%205);x<W+100;x+=205){R(x,37,57,11,'#57372b');R(x+3,39,51,6,'#b57b46');R(x+12,42,29,1,'#ffe0aa');}
 }else{
  for(let i=0;i<4;i++){const x=((i*282-mov)%870+870)%870-85;
   R(x-48,61,96,115,'#100c22');R(x-43,65,85,109,'#281332');R(x-39,68,75,101,'rgba(111,29,100,.19)');
   if(settings.pixel3d){torusRing(x,104,32,24,tick*.019+i,'#b361ac');torusRing(x,104,21,13,-tick*.027-i,'#5fe5bf');softwareMesh(meshCube,x,104,13,tick*.015+i,'#9de7bd','wire');}
   for(let k=0;k<6;k++){const xx=x-45+k*17;R(xx,67+Math.sin(k*2+i)*7,3,44+(k%3)*8,'#492447');}
   glow(x,102,50,'#af54a8',.13);
  }
  // Twisted living tubes under the glass.
  for(let i=0;i<8;i++){const x=((i*141-camera*.41)%760+760)%760-35;ctx.strokeStyle=i%2?'#5e275e':'#203f3c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,177);ctx.bezierCurveTo(x-30,123,x+37,93,x+3,46);ctx.stroke();}
 }
}
function drawDrone3D(e,x,y){
 ellipse(x,e.y,18,4,'rgba(0,0,0,.34)');
 const t=game.tick*.055+e.id;
 if(settings.pixel3d){softwareMesh(meshOcta,x,y-24,15,t,'#77d9e1');softwareMesh(meshCube,x,y-24,10,t*.8+1.3,'#153e59','wire');}
 else{ellipse(x,y-24,16,10,'#23516c');R(x-11,y-31,22,13,'#4a8294');}
 for(let d of [-1,1]){const xx=x+d*18;R(xx-4,y-25,8,3,'#507a88');R(xx-2,y-31,4,7,'#7c8e9b');
  L(xx-12,y-30+Math.sin(t*3+d)*2,xx+12,y-30+Math.cos(t*3+d)*2,'#a8faff',2);}
 R(x-4,y-29,8,5,e.ai==='windup'?'#ffbe55':'#63edf4');glow(x,y-27,19,'#5ff4f0',.17);
 R(x+e.face*10,y-20,10,4,'#314c60');if(e.fire>0)glow(x+e.face*18,y-19,11,'#ffc55a',.4);
 if(e.hp<e.maxHp)B(x-17,y-48,34,3,e.hp/e.maxHp,'#a7ddea');
 if(e.flash>0)glow(x,y-24,21,'#fff6c3',.3);
}
function drawBloodAndDecals(){if(!game)return;
 if(settings.violence>0){for(const q of game.blood){let x=q.x-game.camera;if(x<-20||x>W+20)continue;ctx.save();ctx.globalAlpha=Math.min(.5,q.t/500*.4);ellipse(x,q.y,q.r,2,'#892238');ctx.restore();}}
 for(const q of game.decals){const x=q.x-game.camera;if(x<-30||x>W+30)continue;ctx.save();ctx.globalAlpha=(q.life/q.max)*.55;for(let i=-1;i<=1;i++){L(x-10+i*5,q.y-12-i*2,x+9+i*7,q.y+8-i*2,i===0?'#edfad8':'#b8f6f3',1);}ctx.restore();}
}

function R(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(0,Math.round(w)),Math.max(0,Math.round(h)));}
function L(x,y,X,Y,color='#ffffff',width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(x),Math.round(y));ctx.lineTo(Math.round(X),Math.round(Y));ctx.stroke();}
const FONT_COLS=16;
const FONT_CHARS=" АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?+-*/%()[]{}<>=\"'№#&_|\\@";
const FONT_INDEX=Object.fromEntries(Array.from(FONT_CHARS).map((ch,i)=>[ch,i]));
const fontTints=new Map();
function getFontTint(color){
 const key=color.toLowerCase();let tinted=fontTints.get(key);
 if(!tinted){tinted=document.createElement('canvas');tinted.width=A.font.naturalWidth;tinted.height=A.font.naturalHeight;
  const tc=tinted.getContext('2d');tc.imageSmoothingEnabled=false;tc.drawImage(A.font,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle=color;tc.fillRect(0,0,tinted.width,tinted.height);fontTints.set(key,tinted);}
 return tinted;
}
function T(str,x,y,size=7,color='#f1f5ee',align='left'){
 str=String(str).toUpperCase();x=Math.round(x);y=Math.round(y);
 if(activeImage('font')){
   const glyphW=7,glyphH=9,mult=size>=20?3:size>=10?2:1,dw=glyphW*mult,dh=glyphH*mult,step=dw;
   let width=0;for(const c of str)width+=step;
   if(align==='center')x-=Math.round(width/2);else if(align==='right')x-=Math.round(width);
   const tinted=getFontTint(color),shadow=getFontTint('#08111b');
   let cx=x;for(const ch of str){const ci=FONT_INDEX[ch];if(ci!==undefined){const sx=(ci%FONT_COLS)*glyphW,sy=Math.floor(ci/FONT_COLS)*glyphH;ctx.drawImage(shadow,sx,sy,glyphW,glyphH,Math.round(cx)+1,y+1,dw,dh);ctx.drawImage(tinted,sx,sy,glyphW,glyphH,Math.round(cx),y,dw,dh);}
    else if(ch==='▶'||ch==='◀'){const right=ch==='▶';ctx.fillStyle='#08111b';ctx.beginPath();ctx.moveTo(Math.round(cx+(right?3:dw-2))+1,Math.round(y+1)+1);ctx.lineTo(Math.round(cx+(right?dw-2:2))+1,Math.round(y+dh/2)+1);ctx.lineTo(Math.round(cx+(right?3:dw-2))+1,Math.round(y+dh-2)+1);ctx.closePath();ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(Math.round(cx+(right?3:dw-2)),Math.round(y+1));ctx.lineTo(Math.round(cx+(right?dw-2:2)),Math.round(y+dh/2));ctx.lineTo(Math.round(cx+(right?3:dw-2)),Math.round(y+dh-2));ctx.closePath();ctx.fill();}
    else if(ch==='—'||ch==='–'){R(cx+2,y+Math.round(dh/2)+1,dw-3,1,'#08111b');R(cx+1,y+Math.round(dh/2),dw-3,1,color);}
    else if(ch==='•'){R(cx+Math.round(dw/2)+1,y+Math.round(dh/2)+1,2,2,'#08111b');R(cx+Math.round(dw/2),y+Math.round(dh/2),2,2,color);}
    cx+=step;}
   return;
 }
 ctx.textBaseline='top';ctx.textAlign=align;ctx.font=`bold ${Math.round(size)+1}px "PT Mono","DejaVu Sans Mono",monospace`;ctx.fillStyle='#08111b';ctx.fillText(str,x+1,y+1);ctx.fillStyle=color;ctx.fillText(str,x,y);
}

function B(x,y,w,h,value,color='#e4dd6c'){const f=clamp(value,0,1);R(x-1,y-1,w+2,h+2,'#09111f');R(x-2,y-2,w+4,h+4,'#748593');R(x,y,w,h,'#671c2a');R(x,y,w*f,h,color);R(x,y,w*f,1,'#fffdcb')}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y),Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);ctx.fill()}
function glow(x,y,r,color,alpha=.18){ctx.save();ctx.globalAlpha=alpha;const a=ctx.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,color);a.addColorStop(1,'transparent');ctx.fillStyle=a;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore()}
function sprite(name,x,y,w,h,flip=1,filter='none',alpha=1){if(!activeImage(name))return false;const im=A[name];ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y));ctx.scale(flip,1);ctx.filter=filter;ctx.drawImage(im,flip===1?0:-w,0,w,h);ctx.restore();return true}
function drawAtlas(classId,row,index,x,y,face=1,opacity=1,extraScale=1){
 const name=activeImage('anim')?'anim':'sheet';if(!activeImage(name))return;
 const im=A[name],cols=name==='anim'?10:4,fw=im.naturalWidth/cols,fh=im.naturalHeight/4;
 const c=CLASS[classId],dw=107*c.scale*extraScale,dh=107*c.scale*extraScale;
 const ci=clamp(Math.floor(index),0,cols-1),ri=clamp(Math.floor(row),0,3);
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(Math.round(x),Math.round(y));ctx.scale(face,1);ctx.filter=`hue-rotate(${c.hue}deg) saturate(${classId===3?1.25:1.11})`;
 ctx.drawImage(im,ci*fw,ri*fh,fw,fh,-Math.round(dw*.64),-Math.round(dh*.87),Math.round(dw),Math.round(dh));ctx.restore();
}
const floorCanvas=document.createElement('canvas');floorCanvas.width=960;floorCanvas.height=92;const fc=floorCanvas.getContext('2d');
(()=>{let seed=129563;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 fc.fillStyle='#263f53';fc.fillRect(0,0,960,92);
 for(let j=0;j<5;j++){const yy=j*20;fc.fillStyle=j%2?'#315069':'#304961';fc.fillRect(0,yy,960,20);fc.fillStyle='#102638';fc.fillRect(0,yy,960,2);fc.fillStyle='#58748a';fc.fillRect(0,yy+2,960,1);
  for(let i=0;i<18;i++){let xx=((i*58+(j%2)*28)%960);fc.fillStyle='#112c40';fc.fillRect(xx,yy+3,1,16);fc.fillStyle='#7190a2';fc.fillRect(xx+1,yy+4,1,13);fc.fillStyle='#9bb3b8';fc.fillRect(xx+3,yy+5,2,1);fc.fillRect(xx+49,yy+14,2,1);}
 }
 for(let i=0;i<1500;i++){fc.fillStyle=rnd()>.74?'#7894a1':'#152a3e';fc.globalAlpha=.11+rnd()*.17;fc.fillRect(Math.floor(rnd()*960),Math.floor(rnd()*92),1+Math.floor(rnd()*3),1);}fc.globalAlpha=1;
})();
function background(level,camera,tick,menu=false){const lev=LEVELS[level];R(0,0,W,H,'#04101b');const name=lev.wall;
 if(activeImage(name)){let im=A[name],tw=500,th=223,speed=.24;let start=-((camera*speed)%tw);for(let x=start-tw;x<W+tw;x+=tw)ctx.drawImage(im,Math.round(x),4,tw,th);}
 else{for(let i=0;i<10;i++){R(i*60,19,48,167,'#1a3543');R(i*60+6,20,4,155,'#5b7381');}}
 R(0,34,W,143,level===2?'rgba(57,6,38,.3)':level===1?'rgba(39,19,11,.17)':'rgba(0,28,41,.15)');
 // Complex repeating foreground cables, columns and piping.
 for(let i=0;i<12;i++){let x=((i*95-camera*.49)%710+710)%710-68;R(x,38,9,119,'#0c2234');R(x+2,38,3,119,'#426075');R(x+9,38,2,119,'#081624');R(x-3,56,16,4,'#6a8593');R(x-3,136,16,4,'#445c6a');}
 for(let i=0;i<12;i++){const x=((i*73-camera*.59)%680+680)%680-35;const flick=(Math.sin(tick*.07+i*3)+1)/2;R(x,91+i%4*15,6,3,flick>.4?lev.tone:'#143f42');R(x+2,91+i%4*15,2,1,'#e2fff6');if(flick>.9)glow(x+3,90+i%4*15,20,lev.tone,.09);}
 drawSectorArt(level,camera,tick);
 R(0,176,W,3,'#a5b8be');R(0,179,W,3,'#192f3f');
 const offset=Math.floor(camera)%floorCanvas.width;ctx.drawImage(floorCanvas,-offset,181);ctx.drawImage(floorCanvas,floorCanvas.width-offset,181);
 // Hazard stripes along the top ledge and industrial grate at the near edge.
 for(let x=-(camera%46);x<W;x+=46){R(x,182,22,3,'#c7a054');R(x+22,182,24,3,'#111d2c');}
 R(0,248,W,22,'#0c202f');R(0,248,W,2,'#8baebd');for(let x=-(camera%20);x<W;x+=20){R(x,251,3,17,'#324e60');R(x+5,254,12,2,'#5d7b8c');R(x+6,263,9,2,'#213b50');}
 R(0,267,W,3,'#050a14');
 if(settings.ambient>0){for(let i=0;i<8;i++){const px=((i*79-camera*.63)%610+610)%610;const op=.06+.05*Math.sin(tick*.014+i);ctx.save();ctx.globalAlpha=Math.max(0,op);R(px,195+(i%3)*14,24,1,lev.tone);ctx.restore();}}
 if(level===2){ctx.fillStyle='rgba(121,28,90,.12)';ctx.fillRect(0,0,W,H);}if(level===1)glow(250,75,180,'#ad6d32',.06);
 // Steam vents and warning lights remain deterministic under pause.
 for(let i=0;i<5;i++){const px=((i*357-camera*.3)%660+660)%660-40;const t=(tick+i*41)%180;if(t<51){ctx.save();ctx.globalAlpha=(51-t)/330;ellipse(px,131-t*.37,11+t*.11,26,'#baf3ee');ctx.restore();}}
}
function drawProps(){const camera=game.camera;for(const o of game.props){const x=o.x-camera,y=o.y;if(x<-55||x>W+55)continue;if(o.dead){if((o.breakT||0)<22){R(x-14,y-9,28,4,'#503f2c');}continue;}
 ellipse(x,y+1,23,5,'rgba(0,0,0,.4)');if(o.type==='crate'){R(x-19,y-33,38,33,'#33251e');R(x-18,y-32,36,30,'#966039');R(x-16,y-30,32,26,'#704426');R(x-17,y-31,34,2,'#efbf78');R(x-16,y-3,32,2,'#20160d');L(x-15,y-29,x+15,y-5,'#e1b37a',2);L(x+15,y-29,x-15,y-5,'#392b28',2);R(x-1,y-31,3,26,'#442b19');R(x-17,y-18,34,3,'#614329');}
 else if(o.type==='barrel'){R(x-13,y-33,26,34,'#121e24');R(x-12,y-31,24,30,'#385765');R(x-11,y-29,22,3,'#637e87');R(x-11,y-8,22,3,'#172934');R(x-6,y-20,12,10,'#cbac45');T('!',x,y-22,9,'#1e2b30','center');glow(x,y-12,25,'#c7a74c',.06);}
 else{R(x-15,y-34,31,36,'#17252f');R(x-13,y-32,27,29,'#577787');R(x-11,y-29,22,16,'#071f2c');for(let j=0;j<4;j++){R(x-8+(j%2)*11,y-27+Math.floor(j/2)*7,8,3,((game.tick+j*17)%70)<35?'#64ece6':'#356474');}R(x-10,y-5,21,2,'#8bb3a0');}
 }}
function drawHazards(){for(const h of game.hazards){let x=h.x-game.camera,y=h.y;if(x<-40||x>W+40)continue;ellipse(x,y+1,22,5,'rgba(0,0,0,.3)');R(x-14,y-6,29,6,'#0c2330');R(x-14,y-6,29,2,'#91b4bb');if(h.active){if(h.type==='steam'){for(let i=0;i<4;i++){const yy=y-8-(game.tick*3+i*17)%90;ctx.save();ctx.globalAlpha=.23;ellipse(x+Math.sin(game.tick*.11+i)*6,yy,5+i,12+i*2,'#b8e8e8');ctx.restore();}}
 else{for(let i=0;i<6;i++){const xx=x+Math.sin(game.tick*.29+i*3)*17,yy=y-12-i*9;L(xx,yy,xx+Math.cos(i+game.tick)*7,yy-10,'#77e4fa',2);}glow(x,y-32,32,'#7cebfb',.22);}}
 else if(Math.floor(game.tick/14)%2)R(x-3,y-8,6,2,'#deba61');
 }}
function drawPuddles(){for(const a of game.puddles){const x=a.x-game.camera;ctx.save();ctx.globalAlpha=.45*(a.t/160);ellipse(x,a.y-2,a.radius,5,'#89e955');ellipse(x,a.y-3,a.radius*.52,2,'#e6ff92');ctx.restore();if(game.tick%13===0)glow(x,a.y-3,25,'#b7ff58',.13);}}
function drawItems(){for(const o of game.items){const x=o.x-game.camera,y=o.y-13+Math.sin(o.bob)*3;if(x<-30||x>W+30)continue;const colors={med:'#f4f2e8',energy:'#91f7ee',bonus:'#ffda6c',shield:'#9dc7ff'};ellipse(x,o.y,10,3,'rgba(0,0,0,.4)');R(x-7,y-8,14,14,'#0a1728');R(x-6,y-7,12,12,colors[o.type]);R(x-4,y-5,8,8,'#142437');T({med:'+',energy:'E',bonus:'$',shield:'S'}[o.type],x,y-5,8,colors[o.type],'center');if(game.tick%17===0)glow(x,y,20,colors[o.type],.18);}}
function drawMarine(e){
 const x=e.x-game.camera,y=e.y-e.z,big=ENEMY[e.type].scale,fac=e.face;
 if(x<-95||x>W+100)return;
 if(e.type==='drone'){drawDrone3D(e,x,y);return;}
 ellipse(x,e.y,21*big,4.5,'rgba(0,0,0,.49)');
 if(e.dead){ctx.save();ctx.globalAlpha=Math.max(0,1-e.deathT/180);ctx.translate(Math.round(x),Math.round(y+Math.min(16,e.deathT*.45)));
   const angle=[-.16,.21,-.31,.13][e.deathStyle]||.1;ctx.rotate(angle*Math.min(1,e.deathT/25));ctx.scale(-fac,Math.max(.48,1-Math.min(1,e.deathT/20)*.45));
   if(activeImage('soldier')){ctx.filter=ENEMY[e.type].shade;ctx.drawImage(A.soldier,-33*big,-65*big,66*big,65*big);}ctx.restore();return;}
 if(e.type==='turret'){R(x-15,y-26,30,22,'#1f3847');R(x-13,y-24,26,17,'#536b77');R(x-10,y-7,20,4,'#0e2938');
  R(x-4,y-36,8,14,'#b4a474');R(x+(e.face>0?5:-36),y-33,36,7,'#252d35');R(x+(e.face>0?27:-38),y-34,10,2,'#a7bac5');}
 else if(activeImage('soldier')){ctx.save();
  const walking=e.ai==='approach'||e.ai==='retreat',step=Math.sin(e.walk*3.1),recoil=e.fire>0?Math.sin((8-e.fire)/8*Math.PI)*2:0;
  const yOffset=walking?Math.sin(e.walk*6.2)*1.4:Math.sin(e.walk*.4)*.32;
  ctx.translate(Math.round(x-recoil*fac),Math.round(y+yOffset));ctx.scale(-fac,1);
  ctx.filter=ENEMY[e.type].shade;
  if(activeImage('marineAnim')){const im=A.marineAnim,row=e.hurt>0?3:e.fire>0||e.ai==='windup'?2:walking?1:0;
    const fi=(Math.floor(walking?e.walk*4.2:e.fire>0?game.tick*.38:game.tick/15))%8;
    ctx.drawImage(im,fi*120,row*130,120,130,-33*big,-65*big,66*big,65*big);
  }else ctx.drawImage(A.soldier,-33*big,-65*big,66*big,65*big);ctx.filter='none';
  // Separate animated weapon for variant troops, visibly responding to firing.
  if(e.type==='gunner'){
    R(-30,-46,13,12,'#1b2534');R(8,-48,13,12,'#283342');R(-28,-44,9,3,'#788a9b');
    R(-32,-32,55,10,'#18232d');R(-27,-34,42,4,'#576875');R(-31,-26,53,2,'#a3acaf');
    for(let k=0;k<3;k++)R(-55,-34+k*3+(game.tick%3===0?1:0),32,2,k===1?'#a4b9c4':'#344756');
    R(14,-49,13,19,'#465b63');R(16,-47,9,10,'#91a9ad');
  }else if(e.type==='medic'){
    R(16,-50,18,22,'#c5d7c9');R(18,-48,14,17,'#e4f1e8');R(24,-46,3,13,'#b32e3e');R(19,-41,13,3,'#b32e3e');R(-3,-46,9,7,'#dcead7');R(0,-44,3,4,'#ad3145');
  }else if(e.type==='shield'){R(-33,-51,20,42,'#1b303b');R(-30,-48,16,36,'#7d98a6');R(-28,-45,11,31,'#355465');R(-27,-39,9,3,'#d3c27a');}
  else if(e.type==='flame'){R(-30,-43,34,7,'#8e6e45');R(-31,-41,25,4,'#ad9873');R(17,-52,10,13,'#c47e46');}
  else if(e.type==='android'){R(7,-57,14,9,'#63a6b1');R(14,-54,3,3,'#b5ffff');}
  ctx.restore();
 }else{R(x-9,y-52,18,40,'#6c7951');R(x-6,y-61,13,12,'#b59d69');}
 if(e.type==='flame')glow(x+e.face*22,y-37,17,'#fbb755',.14);
 if(e.type==='android'&&game.tick%45<5)glow(x,y-39,27,'#8bddff',.16);
 if(e.type==='medic'&&e.ai==='healing'){glow(x,y-43,27,'#b0ffc9',.15);T('+',x,y-75,10,'#abf4cc','center');}
 if(e.type==='gunner'&&e.ai==='windup'){L(x+e.face*15,y-37,x+e.face*120,y-37,'rgba(255,195,101,.35)');}
 if(e.fire>0){glow(x+e.face*36,y-42,18,'#ffc24b',.42);R(x+e.face*34-2,y-46,8,7,'#ff9b23');R(x+e.face*36-2,y-44,4,3,'#fff6b6');}
 if(e.ai==='windup'){R(x-14,y-75,28,4,'#6c2f2b');R(x-14,y-75,Math.max(1,28*e.wind/(e.type==='gunner'?49:40)),4,'#ffce68');T('!',x,y-88,10,'#ffe17d','center');}
 if(e.hp<e.maxHp)B(x-18,y-68,36,3,e.hp/e.maxHp,e.type==='heavy'||e.type==='gunner'?'#dbb064':'#b2df73');
 if(e.flash>0&&game.tick%3<2){ctx.save();ctx.globalAlpha=.19;R(x-19,y-62,38,55,'#fffbea');ctx.restore();}
}

function drawPlayer(p){let x=p.x-game.camera,y=p.y-p.z;const c=CLASS[p.classId];ellipse(x,p.y,27*c.scale*(1-p.z/150),5*c.scale*(1-p.z/200),'rgba(0,0,0,.55)');if(p.dead){drawAtlas(p.classId,3,2,x,y-3,p.face,.37,.95);return;}
 let row=0,idx=0;if(p.attack){const atk=ATTACKS[p.attack];row=atk.anim;idx=clamp(Math.floor(p.attackT/(atk.startup+atk.active+atk.recovery)*10),0,9);}else if(p.dodge>0){row=1;idx=9-Math.floor(p.dodge/2)%10;}else if(p.airborne){row=3;idx=p.vz>0?3:7;}else if(Math.abs(p.moveX)+Math.abs(p.moveY)>.15){row=1;idx=Math.floor(p.walking*2.4)%10;}else{row=0;idx=Math.floor(p.anim/9)%10;}
 for(const q of p.trail){drawAtlas(p.classId,q.row,q.frame,q.x-game.camera,q.y,p.face,Math.min(.14,q.t*.014),.99);}
 let alpha=p.inv>0&&Math.floor(game.tick/4)%2===0?.46:1;drawAtlas(p.classId,row,idx,x,y,p.face,alpha);
 if(p.rageT>0){ctx.save();ctx.globalAlpha=.15+.10*Math.sin(game.tick*.21);ellipse(x,y-47,34,53,c.color);ctx.restore();glow(x,y-47,57,'#e2ac64',.09);}
 if(p.attack){const atk=ATTACKS[p.attack];if(p.attackT>=atk.startup&&p.attackT<atk.startup+atk.active){const slash=p.attack==='acidburst'?'#b3ff69':p.attack==='super'?'#ffdc66':p.attack==='tail'||p.attack==='impact'?'#91d5ff':c.color;
 ctx.save();ctx.strokeStyle=slash;ctx.lineWidth=p.attack==='super'?4:2;ctx.globalAlpha=.7;ctx.beginPath();const rx=x+p.face*(p.attack==='tail'||p.attack==='impact'?54:36);ctx.arc(rx,y-37,35,-1.13,1.05);ctx.stroke();ctx.globalAlpha=.29;ctx.lineWidth=7;ctx.beginPath();ctx.arc(rx,y-37,40,-1.1,1.01);ctx.stroke();ctx.restore();}}
 if(game.players.length>1){T(p.id+'P',x,y-106,7,p.id===1?'#62eeff':'#ffc970','center');}
}
function drawBoss(){
 const b=game.boss;if(!b)return;const x=b.x-game.camera,y=b.y,lev=LEVELS[game.level];
 if(x<-175||x>W+175)return;
 const sheetName=['bossGuardian','bossSiege','bossQueen'][game.level];const src=A[sheetName],valid=activeImage(sheetName),w=game.level===2?196:211,h=game.level===2?192:155;
 ellipse(x,y+1,game.level===2?70:61,10,'rgba(0,0,0,.58)');
 const frame=Math.floor(b.walk*2.2)%8;
 if(valid){ctx.save();ctx.translate(Math.round(x),Math.round(y+Math.sin(b.walk)*1.5));ctx.scale(-b.face,1);
  const row=b.dead||b.hurt>0?2:b.wind>0||b.dashT>0?1:0;const fw=src.naturalWidth/8,fh=src.naturalHeight/3;
  if(b.dead){ctx.globalAlpha=Math.max(.35,game.bossDown/130);ctx.rotate(-Math.min(.40,(130-game.bossDown)/140*.33));}
  ctx.filter=game.level===0?'hue-rotate(0deg)':game.level===1?'hue-rotate(24deg) saturate(1.12)':'hue-rotate(-6deg)';
  ctx.drawImage(src,fw*frame,fh*row,fw,fh,-Math.round(w*.52),-h+2,w,h);ctx.restore();
 }else drawAtlas(3,0,frame,x,y,b.face,1,1.72);
 if(game.level===1&&!b.dead){R(x-39,y-91,17,7,'#69677d');R(x-36,y-87,9,3,'#e3ba89');glow(x,y-90,32,'#ffb06b',.08);}
 if(b.phase>=2&&!b.dead)glow(x,y-87,83,b.phase===3?'#eb8fe1':'#b7ff82',.11);
 if(b.wind>0){const color=b.attackKind==='acid'?'#a7ff72':b.attackKind==='charge'?'#ffaf70':'#ffcd73';T(({acid:'КИСЛОТА',slam:'УДАР',tail:'ХВОСТ',charge:'ТАРАН',summon:'ПОДМОГА'}[b.attackKind]||b.attackKind),x,y-h-12,8,color,'center');B(x-27,y-h-4,54,3,1-b.wind/48,color);}
 if(b.flash>0&&game.tick%4<2){ctx.save();ctx.globalAlpha=.12;ellipse(x,y-86,49,70,'#d7ffae');ctx.restore();}
}

function drawProjectiles(){for(const b of game.bullets){let x=b.x-game.camera;if(x<-20||x>W+20)continue;let y=b.y;if(b.type==='grenade'){const base=b.explosionY-8,progress=b.flight/65;y=base-Math.sin(Math.PI*progress)*55;ellipse(x,b.explosionY,10,3,'rgba(251,198,99,.25)');R(x-4,y-4,8,8,'#2d3737');R(x-3,y-3,6,5,'#c1c5ab');if(b.life<20&&b.life%6<3)R(x-2,y-2,4,4,'#ffee6b');}
 else if(b.type==='shot'){R(x-5,y-1,11,3,'#ffc05a');R(x-3,y,5,1,'#fff7c1');}
 else if(b.type==='fire'){R(x-5,y-3,10,6,'#ff852c');R(x-2,y-3,5,4,'#ffee8d');}
 else{R(x-5,y-3,11,7,b.type==='bossAcid'?'#baff6f':'#91ff42');R(x-2,y-5,4,11,'#c8fb87');glow(x,y,20,'#a5ff63',.18);}}
}
function drawFX(){for(const q of game.particles){ctx.save();ctx.globalAlpha=clamp(q.t/q.maxT,0,1);R(q.x-game.camera,q.y,q.size,q.size,q.color);ctx.restore();}for(const q of game.texts){ctx.save();ctx.globalAlpha=Math.min(1,q.t/12);T(q.message,q.screenSpace?q.x:q.x-game.camera,q.y,q.t>72?8:7,q.color,'center');ctx.restore();}}
function hud(){const g=game;R(0,0,W,30,settings.hiContrast?'#000000':'#040b14');R(0,29,W,2,'#5b8190');
 const multiple=g.players.length>1;for(let i=0;i<g.players.length;i++){const p=g.players[i],c=CLASS[p.classId],x=multiple?i*239+6:7;const max=multiple?227:220;
 R(x,3,max,23,'#162734');R(x+1,4,max-2,21,'#081823');if(activeImage('sheet')){ctx.save();ctx.filter=`hue-rotate(${c.hue}deg)`;ctx.drawImage(A.sheet,190,24,82,92,x+2,5,22,19);ctx.restore();}
 T(p.id+'P',x+28,4,7,p.id===1?'#7eeeff':'#ffdf81');T(c.name.replace('КСЕНО-','').substring(0,multiple?13:16),x+28,13,6,'#ffdc7e');T(String(p.score).padStart(6,'0'),x+max-5,4,7,'#f0f3ec','right');B(x+28,23,max-34,3,(p.oldHp||p.hp)/p.maxHp,'#b16b54');B(x+28,23,max-34,3,p.hp/p.maxHp,p.hp/p.maxHp<.29?'#f65a58':'#d8e56a');}
 if(!multiple){R(239,3,235,23,'#091a27');T(LEVELS[g.level].sector+'  //  УР.'+(g.level+1),249,5,6,'#87bccc');T('ЖИЗНИ '+g.players[0].lives+'   РЕКОРД '+String(records.high).padStart(6,'0'),469,5,6,'#ffdc97','right');T('ЭНЕРГИЯ',249,16,6,'#8de9df');B(315,18,152,4,g.players[0].energy/100,'#82f9d9');}
 else{g.players.forEach((p,i)=>{const x=i*239+8;T('ЖИЗНИ '+p.lives+'  ЭНЕРГИЯ',x,34,6,'#b9dce0');B(x+108,35,117,4,p.energy/100,'#8ceee1');});}
 if(g.combo>1&&g.comboTimer>0){R(179,44,123,21,'rgba(7,14,23,.84)');T(g.combo+' УДАРОВ',240,47,10,g.combo>=14?'#fff1a3':'#ffdb87','center');T(g.combo>=20?'S  СМЕРТЕЛЬНЫЙ':g.combo>=14?'A  СВИРЕПЫЙ':g.combo>=9?'B  ХИЩНИК':g.combo>=5?'C  ЖЕСТОКИЙ':'D  БАЗОВЫЙ',240,59,5,'#aeead3','center');}
 if(g.boss){R(29,241,422,26,'rgba(2,6,15,.95)');T(LEVELS[g.level].bossName,36,244,8,'#ffe39b');T('ФАЗА '+g.boss.phase,444,245,6,'#d1edf3','right');B(37,256,407,7,g.boss.hp/g.boss.maxHp,'#e5e34e');}
 else {R(6,254,145,11,'rgba(2,9,17,.75)');T('ВРАГИ '+g.stageKills+' / ВОЛНА '+Math.min(g.waveIndex+1,LEVELS[g.level].waves.length),10,257,6,'#b3d3e2');R(324,254,149,11,'rgba(2,9,17,.75)');T('ОЧКИ '+String(g.score).padStart(7,'0'),469,257,6,'#ffd778','right');}
 if(g.announceT>0){const a=clamp(g.announceT/22,0,1);ctx.save();ctx.globalAlpha=a;R(57,75,366,24,'rgba(4,12,21,.87)');R(57,75,366,1,'#b28d48');T(g.announcement,240,82,8,'#ffe2a2','center');ctx.restore();}
 if(g.stageBanner>0){const a=clamp(g.stageBanner/35,0,1);ctx.save();ctx.globalAlpha=a;R(85,116,310,36,'rgba(3,10,19,.86)');T('УРОВЕНЬ '+String(g.level+1).padStart(2,'0'),240,119,11,'#f8e7a0','center');T(LEVELS[g.level].name,240,137,7,'#d8f4f6','center');ctx.restore();}
 if(g.debug){R(1,66,181,58,'rgba(0,0,0,.76)');T('ОТЛАДКА 60ГЦ  ТИК '+g.tick,5,70,7,'#8ef6be');T('ВРАГИ '+g.enemies.filter(e=>!e.dead).length+'  ПУЛИ '+g.bullets.length,5,81,7,'#d9edf8');T('ЭФФЕКТЫ '+g.particles.length+'  ВОЛНА '+g.waveIndex,5,92,7,'#d9edf8');for(const p of g.players){L(p.x-g.camera-10,p.y,p.x-g.camera+10,p.y,'#94f564',1);L(p.x-g.camera,p.y-10,p.x-g.camera,p.y+2,'#94f564',1);}}
}
function drawGame(){if(!game)return;const g=game;ctx.save();if(g.shake>1&&settings.shake)ctx.translate(Math.round(rand(-g.shake/2,g.shake/2)),Math.round(rand(-g.shake/2,g.shake/2)));
 background(g.level,g.camera,g.tick);drawHazards();drawBloodAndDecals();drawPuddles();drawProps();drawItems();
 const actors=[];for(const e of g.enemies){if(e.dead&&e.deathT>130)continue;actors.push({y:e.y,fn:()=>drawMarine(e)});}for(const p of g.players)actors.push({y:p.y,fn:()=>drawPlayer(p)});if(g.boss)actors.push({y:g.boss.y,fn:drawBoss});actors.sort((a,b)=>a.y-b.y).forEach(a=>a.fn());drawProjectiles();drawFX();ctx.restore();
 if(g.flash>0&&settings.flashes){ctx.save();ctx.globalAlpha=Math.min(.18,g.flash/65);R(0,0,W,H,'#d5ffe2');ctx.restore();}
 hud();drawScanlines();}
function drawScanlines(){if(!settings.scanlines)return;ctx.save();ctx.globalAlpha=.12;for(let y=0;y<H;y+=3)R(0,y,W,1,'#061321');ctx.restore();}
// ------------------------------ MENUS & UX ---------------------------------
function menuBackdrop(){if(activeImage('menuScene')){ctx.drawImage(A.menuScene,0,0,W,H);}else if(activeImage('cover')){ctx.drawImage(A.cover,0,0,W,H);}else background(0,(menuTick*.25)%650,menuTick,true);
 R(0,0,W,H,'rgba(1,8,18,.72)');
 if(settings.pixel3d){softwareMesh(meshOcta,402,90,27,menuTick*.012,'#59dce9','wire');torusRing(403,91,43,18,menuTick*.019,'#4e96ae');}
 for(let i=0;i<7;i++){const yy=27+i*32;R((menuTick*(i%2?-.36:.27)+i*99+1000)%520-30,yy,18,1,'rgba(102,226,231,.18)');}
 glow(240,48,140,'#66d6ed',.11);R(0,0,W,27,'rgba(2,8,15,.87)');T('АРКАДА  /  РЕТРО-ПРОЕКТ  /  СБОРКА 0.7',240,8,6,'#a6c1d3','center');
 if(menuTick%170<4)R(0,0,W,H,'rgba(116,208,225,.035)');drawScanlines();}
function titleArt(y=31){T('КСЕНОМОРФ',240,y,27,'#baf0f6','center');T('ПРОРЫВ УЛЬЯ',240,y+29,23,'#f9d273','center');R(130,y+57,220,1,'#6eb8c0');T('АРКАДНЫЙ РЕМАСТЕР • ВЕРСИЯ 0.7.1',240,y+63,7,'#97c2d0','center')}
function drawMenu(){menuBackdrop();titleArt(30);const y0=121;BUTTONS.forEach((v,i)=>{const yy=y0+i*24,active=menuIndex===i;if(active){R(144,yy-2,192,21,'rgba(63,102,120,.55)');R(144,yy-2,3,21,'#f7d36c');T('▶',159,yy+2,9,'#ffe47b');}T(v,240,yy+2,10,active?'#fff0b7':'#b4d2de','center')});
 T('1 ИГРОК / 2 ИГРОКА  •  ПОДДЕРЖКА ГЕЙМПАДА',240,248,6,'#8dbdc5','center');}
function drawSelect(){menuBackdrop();T('ВЫБЕРИ СВОЙ ОБРАЗЕЦ',240,22,16,'#e5f6eb','center');T(coop?'КООП  //  ИГРОК 1: КЛАВИАТУРА  •  ИГРОК 2: ГЕЙМПАД':'СОЛО  //  КЛАВИАТУРА ИЛИ ГЕЙМПАД',240,45,7,'#f4d788','center');const start=10;
 CLASS.forEach((c,i)=>{const x=start+i*118,active=selected===i,active2=coop&&joined&&selected2===i;R(x-2,70,110,148,active?'#f0d479':active2?'#88f3e5':'#3f6279');R(x,72,106,144,'#081622');R(x+3,75,100,77,'#0b2030');
 if(activeImage('sheet')){const sx=Math.round(313.5*1);ctx.save();ctx.filter=`hue-rotate(${c.hue}deg) saturate(1.2)`;ctx.drawImage(A.sheet,sx,6,313,304,x+6,74,91,80);ctx.restore();}else T('?',x+50,93,36,c.color,'center');
 if(active)T('1P',x+7,76,8,'#ffdc7c');if(active2)T('2P',x+82,76,8,'#7dfde2');T(c.name.replace('КСЕНО-',''),x+53,157,8,c.color,'center');T(c.title,x+53,170,5,'#9bbccb','center');T('ОЗ',x+5,182,5,'#afcddb');B(x+22,183,75,4,c.hp/200,'#b5db75');T('СКР',x+5,193,5,'#afcddb');B(x+22,194,75,4,c.speed/2.9,'#8dc9f0');T(c.special,x+53,205,6,'#f7db8c','center');});
 R(17,225,446,37,'rgba(2,8,16,.93)');if(coop){T(joined?'2P ПОДКЛЮЧЁН  —  ГЕЙМПАД ◀ ▶ МЕНЯЕТ КЛАСС':'НАЖМИ START НА ГЕЙМПАДЕ ДЛЯ ПОДКЛЮЧЕНИЯ 2P',240,229,7,joined?'#a1f9e8':'#ffe38b','center');T('1P: ◀ ▶ / 1–4    ENTER СТАРТ    ESC НАЗАД',240,244,7,'#d5eaf0','center');}
 else{T('◀ ▶ / 1–4  ВЫБОР КЛАССА    ENTER СТАРТ',240,232,8,'#ffe5a8','center');T('J КОГТИ  K ХВОСТ  L НАВЫК  U УЛЬТА  SHIFT РЫВОК',240,247,6,'#a6d1de','center');}}
function drawOptions(){menuBackdrop();T('НАСТРОЙКИ  //  КОНФИГ',240,21,17,'#ffe2a8','center');
 const tabs=['ГЕЙМПЛЕЙ','ГРАФИКА','АУДИО'];tabs.forEach((n,i)=>{const x=36+i*140;R(x,48,128,17,i===optionTab?'#345766':'#101e2c');R(x,48,128,1,i===optionTab?'#f4d078':'#345065');T(n,x+64,51,8,i===optionTab?'#f8e4b8':'#94b9c6','center');});
 const groups=OPTION_GROUPS[optionTab];const vals=optionTab===0?[["НОВИЧОК","АРКАДА","КОШМАР"][settings.difficulty],["НИЗКО","НОРМА","ВЫСОКО"][settings.violence],settings.damageNumbers?'ВКЛ':'ВЫКЛ','ПОДТВЕРДИТЬ','']:optionTab===1?[settings.pixel3d?'ВКЛ':'ВЫКЛ',["НИЗ","СРЕД","ВЫС"][settings.particles],["ВЫКЛ","НИЗ","ВЫС"][settings.ambient],settings.shake?'ВКЛ':'ВЫКЛ',settings.flashes?'ВКЛ':'ВЫКЛ',settings.scanlines?'ВКЛ':'ВЫКЛ',settings.hiContrast?'ВКЛ':'ВЫКЛ','']:[Math.round(settings.music*100)+'%',Math.round(settings.sfx*100)+'%',settings.originalMusic?'ВКЛ':'ВЫКЛ',''];
 const rowHeight=20,startY=73;groups.forEach((name,i)=>{const y=startY+i*rowHeight;if(optionIndex===i){R(43,y-2,395,19,'rgba(56,101,120,.78)');R(43,y-2,3,19,'#ffe183');}T(name,52,y,8,optionIndex===i?'#ffe5a7':'#bddce6');T(vals[i],427,y,8,optionIndex===i?'#ffffff':'#94d1d5','right');});
 T('Q / E  СМЕНА ВКЛАДКИ    ◀ ▶  ИЗМЕНИТЬ',240,242,7,'#b4dddb','center');T('ENTER ВЫБРАТЬ  /  ESC НАЗАД',240,254,6,'#8fbfce','center');}

function drawControls(){menuBackdrop();T('УПРАВЛЕНИЕ',240,26,20,'#ffe4ad','center');const rows=[['WASD / СТРЕЛКИ','ДВИЖЕНИЕ'],['J / КНОПКА X','КОМБО КОГТЯМИ'],['K / КНОПКА Y','ТЯЖЁЛЫЙ ХВОСТ'],['L / КНОПКА B','КЛАССОВЫЙ НАВЫК'],['SPACE / КНОПКА A','ПРЫЖОК / ВОЗДУШНАЯ АТАКА'],['SHIFT / RB','РЫВОК'],['E / LB','ЗАХВАТ / БРОСОК'],['U / LT','УЛЬТА КЛАССА, 80 ЭНЕРГИИ'],['ESC / START','ПАУЗА']];rows.forEach((row,i)=>{let y=66+i*18;if(i%2===0)R(41,y-2,398,17,'rgba(53,84,103,.25)');T(row[0],57,y,8,'#a8dfec');T(row[1],425,y,8,'#ffe2a4','right');});T('ESC / ENTER  НАЗАД',240,245,8,'#eef0c1','center');}
function drawCredits(){menuBackdrop();T('КСЕНОМОРФ: ПРОРЫВ УЛЬЯ',240,38,17,'#d3eff0','center');T('АРКАДНЫЙ РЕМАСТЕР  //  ОФФЛАЙН-ИЗДАНИЕ',240,71,8,'#f7d489','center');T('ДВИЖОК: 2D CANVAS  /  СИМУЛЯЦИЯ 60 ГЦ',240,97,8,'#a8d6dc','center');T('ГРАФИКА: ОСНОВА ИЗ РЕФЕРЕНСОВ / ДОРАБОТАННЫЕ КАДРЫ',240,118,8,'#a8d6dc','center');T('МУЗЫКА: НОВЫЙ НАБОР ОРИГИНАЛЬНЫХ СИНТ-ЛУПОВ',240,139,8,'#a8d6dc','center');T('ОДИН ИГРОК + ЛОКАЛЬНЫЙ КООП НА ОДНОМ ЭКРАНЕ',240,160,7,'#8bf0dc','center');T('ESC / ENTER  НАЗАД',240,240,8,'#ffe6a9','center');}
function dimOverlay(){ctx.fillStyle='rgba(1,6,14,.82)';ctx.fillRect(0,0,W,H);}
function drawPaused(){drawGame();dimOverlay();T('ПАУЗА',240,51,23,'#ffe6a7','center');['ПРОДОЛЖИТЬ','ПЕРЕЗАПУСТИТЬ УРОВЕНЬ','НАСТРОЙКИ','ГЛАВНОЕ МЕНЮ'].forEach((text,i)=>{const y=111+i*27;if(menuIndex===i){R(139,y-4,204,22,'rgba(57,107,120,.7)');R(139,y-4,3,22,'#f5ce77');}T(text,240,y,10,i===menuIndex?'#fff3d5':'#afcfdb','center');});}
function levelResult(){const g=game,bonus=g.stageBonus,score=g.score;const grade=g.stageDamageTaken<80&&g.maxCombo>14?'S':g.maxCombo>=12?'A':g.maxCombo>=8?'B':g.maxCombo>=4?'C':'D';return {bonus,score,grade};}
function drawStageClear(){drawGame();dimOverlay();const g=game,r=levelResult();T('УРОВЕНЬ ПРОЙДЕН',240,31,21,'#d5ff9c','center');T(LEVELS[g.level].name,240,65,8,'#fbdb96','center');const stats=[['ВРЕМЯ',Math.floor(g.levelTime/3600)+':'+String(Math.floor((g.levelTime/60)%60)).padStart(2,'0')],['ВРАГИ',g.stageKills],['МАКС. КОМБО',g.maxCombo],['БОНУС',r.bonus],['ОЧКИ КОМАНДЫ',r.score]];stats.forEach((a,i)=>{const y=92+i*21;T(a[0],119,y,9,'#a9d7e2');T(a[1],362,y,9,'#fff1c1','right');});T('РАНГ  '+r.grade,240,203,16,'#ffe794','center');T(g.level<LEVELS.length-1?'ENTER  /  СЛЕДУЮЩИЙ СЕКТОР':'ENTER  /  ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ',240,241,9,'#aaf4e9','center');}
function drawGameOver(){drawGame();dimOverlay();T('ОБРАЗЕЦ ПОТЕРЯН',240,64,20,'#ff887c','center');T('КОЛОНИЯ ПАЛА',240,103,10,'#e2e5e5','center');T('ОЧКИ КОМАНДЫ  '+String(game.score).padStart(7,'0'),240,148,10,'#ffe4a6','center');T('ENTER — ПОВТОР    ESC — ГЛАВНОЕ МЕНЮ',240,206,9,'#c0e0eb','center');}
function drawVictory(){menuBackdrop();T('УЛЕЙ ПОБЕЖДЁН!',240,49,22,'#d7ff92','center');T('ВСЕ 3 СЕКТОРА ЗАЧИЩЕНЫ',240,90,11,'#f5d993','center');T('ОБЩИЙ СЧЁТ  '+String(game.score).padStart(8,'0'),240,129,12,'#e4f5f4','center');T('ЛУЧШЕЕ КОМБО  '+game.maxCombo+'      УБИЙСТВА  '+game.kills,240,159,9,'#abe8e1','center');T('СПАСИБО ЗА ИГРУ',240,195,9,'#ffcfa0','center');T('ENTER ПЕРЕЗАПУСК     ESC МЕНЮ',240,239,8,'#c3e5f1','center');}
function drawFrame(){ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);if(!ready){R(0,0,W,H,'#06131f');T('ЗАГРУЗКА РЕСУРСОВ...',W/2,H/2,11,'#b3f0e8','center');return;}
 switch(screen){case 'menu':drawMenu();break;case 'select':drawSelect();break;case 'options':drawOptions();break;case 'controls':drawControls();break;case 'credits':drawCredits();break;case 'playing':drawGame();break;case 'paused':drawPaused();break;case 'stageclear':drawStageClear();break;case 'gameover':drawGameOver();break;case 'victory':drawVictory();break;default:drawMenu();}}
function menuChoice(){ensureAudio();synth('select');if(screen==='menu'){
 switch(menuIndex){case 0:coop=false;joined=false;changeScreen('select');break;case 1:coop=true;joined=false;changeScreen('select');break;case 2:optionIndex=0;changeScreen('options');break;case 3:changeScreen('controls');break;case 4:changeScreen('credits');break;}}
 else if(screen==='select'){if(!coop||joined)beginRun();else{floating(240,240,'ПОДКЛЮЧИ ГЕЙМПАД','#ffcd7e',40,true);}}
 else if(screen==='paused'){switch(menuIndex){case 0:changeScreen('playing');resetInput();break;case 1:startStage(game.level);changeScreen('playing');break;case 2:optionIndex=0;changeScreen('options');break;case 3:game=null;changeScreen('menu');break;}}
 else if(screen==='options'){if(optionIndex===OPTION_GROUPS[optionTab].length-1){changeScreen(game?'paused':'menu');menuIndex=0;}else adjustOption(0);}
 else if(screen==='controls'||screen==='credits'){changeScreen('menu');}
 else if(screen==='stageclear'){advanceStage();}
 else if(screen==='gameover'||screen==='victory'){beginRun();}
}
function goBack(){synth('select',.7);if(screen==='playing'){changeScreen('paused');menuIndex=0;resetInput();}
 else if(screen==='paused'){changeScreen('playing');resetInput();}
 else if(screen==='select'||screen==='controls'||screen==='credits'){changeScreen('menu');}
 else if(screen==='options'){changeScreen(game?'paused':'menu');menuIndex=0;}
 else if(screen==='gameover'||screen==='victory'){game=null;changeScreen('menu');}
 else if(screen==='stageclear'){advanceStage();}}
function adjustOption(dir){
 const len=OPTION_GROUPS[optionTab].length;
 if(optionIndex===len-1){if(dir===0){changeScreen(game?'paused':'menu');menuIndex=0;}return;}
 if(optionTab===0){switch(optionIndex){case 0:settings.difficulty=(settings.difficulty+dir+3)%3;break;case 1:settings.violence=(settings.violence+dir+3)%3;break;case 2:settings.damageNumbers=!settings.damageNumbers;break;case 3:if(dir===0)Object.assign(settings,{difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,originalMusic:false});break;}}
 else if(optionTab===1){switch(optionIndex){case 0:settings.pixel3d=!settings.pixel3d;break;case 1:settings.particles=(settings.particles+dir+3)%3;break;case 2:settings.ambient=(settings.ambient+dir+3)%3;break;case 3:settings.shake=!settings.shake;break;case 4:settings.flashes=!settings.flashes;break;case 5:settings.scanlines=!settings.scanlines;break;case 6:settings.hiContrast=!settings.hiContrast;break;}}
 else{switch(optionIndex){case 0:settings.music=clamp(Math.round(settings.music*20+dir)/20,0,1);break;case 1:settings.sfx=clamp(Math.round(settings.sfx*20+dir)/20,0,1);break;case 2:settings.originalMusic=!settings.originalMusic;break;}}
 save('settings',settings);updateMusic();synth('select',.3);
}
function shiftOptionTab(n){optionTab=(optionTab+n+3)%3;optionIndex=0;synth('select',.35);}

function moveMenu(dir){if(screen==='menu')menuIndex=(menuIndex+dir+BUTTONS.length)%BUTTONS.length;
 else if(screen==='paused')menuIndex=(menuIndex+dir+4)%4;
 else if(screen==='options')optionIndex=(optionIndex+dir+OPTION_GROUPS[optionTab].length)%OPTION_GROUPS[optionTab].length;
 else if(screen==='select')selected=(selected+dir+4)%4;synth('select',.4);}
function tickMenu(){if(menuCooldown>0)menuCooldown--;const gp=getGP()[0];if(!gp)return;const inp=sampleGamepad(gp);
 if(screen==='select'&&coop&&!joined&&inp.select){joined=true;synth('pickup');return;}
 if(screen==='select'&&coop&&joined){if(menuCooldown<=0&&Math.abs(inp.x)>.55){selected2=(selected2+Math.sign(inp.x)+4)%4;menuCooldown=11;synth('select',.4);}if(inp.light||inp.jump){if(joined)beginRun();}return;}
 if(screen==='playing'){if(inp.pause)goBack();return;}
 if(menuCooldown<=0&&Math.abs(inp.y)>.65){moveMenu(Math.sign(inp.y));menuCooldown=10;}
 if(menuCooldown<=0&&Math.abs(inp.x)>.65){if(screen==='options')adjustOption(Math.sign(inp.x));else if(screen==='select')moveMenu(Math.sign(inp.x));menuCooldown=11;}
 if(screen==='options'&&inp.special)shiftOptionTab(1);if(inp.jump||inp.select)menuChoice();if(inp.special&&screen!=='menu'&&screen!=='options')goBack();}
// --------------------------------- EVENTS ----------------------------------
window.addEventListener('keydown',e=>{
 const key=e.key;const act=keyAction(key);if(act||['Escape','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))e.preventDefault();
 if(key==='m'||key==='M'){if(settings.music>0||settings.sfx>0){settings._lastMusic=settings.music||.37;settings._lastSfx=settings.sfx||.55;settings.music=0;settings.sfx=0;}else{settings.music=settings._lastMusic||.37;settings.sfx=settings._lastSfx||.55;}save('settings',settings);updateMusic();return;}
 if(key==='f'||key==='F'){toggleFullscreen();return;}
 if(key==='F3'){if(game)game.debug=!game.debug;return;}
 if(key==='Escape'){if(!e.repeat)goBack();return;}
 if(screen==='playing'){if(!held.has(key)&&act)pending.add(act);held.add(key);return;}
 if(e.repeat)return;
 if(screen==='options'&&(key==='q'||key==='Q'||key==='e'||key==='E')){shiftOptionTab(key.toLowerCase()==='q'?-1:1);return;}
 if(screen==='select'&&key>='1'&&key<='4'){selected=Number(key)-1;synth('select');return;}
 if(key==='ArrowDown'||key==='s'||key==='S'){moveMenu(1);return;}
 if(key==='ArrowUp'||key==='w'||key==='W'){moveMenu(-1);return;}
 if(key==='ArrowRight'||key==='d'||key==='D'){if(screen==='options')adjustOption(1);else if(screen==='select')moveMenu(1);return;}
 if(key==='ArrowLeft'||key==='a'||key==='A'){if(screen==='options')adjustOption(-1);else if(screen==='select')moveMenu(-1);return;}
 if(key==='Enter'||key===' '){menuChoice();return;}
});
window.addEventListener('keyup',e=>held.delete(e.key));
window.addEventListener('blur',()=>{resetInput();if(screen==='playing')goBack();});
canvas.addEventListener('pointerdown',e=>{canvas.focus();ensureAudio();const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
 if(screen==='menu'){if(y>=116&&y<239){menuIndex=clamp(Math.floor((y-121)/24),0,BUTTONS.length-1);menuChoice();}}
 else if(screen==='select'){if(y>70&&y<220){selected=clamp(Math.floor((x-10)/118),0,3);synth('select');}else if(y>226)menuChoice();}
 else if(screen==='options'){if(y>=46&&y<68){optionTab=clamp(Math.floor((x-36)/140),0,2);optionIndex=0;synth('select');}else if(y>=70&&y<238){optionIndex=clamp(Math.floor((y-73)/20),0,OPTION_GROUPS[optionTab].length-1);menuChoice();}}
 else if(screen==='paused'){if(y>106&&y<216){menuIndex=clamp(Math.floor((y-109)/27),0,3);menuChoice();}}
 else if(screen==='stageclear'||screen==='gameover'||screen==='victory')menuChoice();
});
function toggleFullscreen(){const el=document.getElementById('cabinet');if(!document.fullscreenElement){el.requestFullscreen?.().catch(()=>{});}else document.exitFullscreen?.().catch(()=>{});}
document.getElementById('fullscreen').addEventListener('click',toggleFullscreen);
document.getElementById('sound').addEventListener('click',()=>{ensureAudio();settings._lastMusic=settings._lastMusic||.37;settings._lastSfx=settings._lastSfx||.55;if(settings.music>0||settings.sfx>0){settings._lastMusic=settings.music;settings._lastSfx=settings.sfx;settings.music=0;settings.sfx=0;}else{settings.music=settings._lastMusic;settings.sfx=settings._lastSfx;}save('settings',settings);updateMusic();});
// 60 Hz fixed simulation; catch up at most five ticks after a long browser stall.
function loop(ts){if(!last)last=ts;const elapsed=clamp(ts-last,0,83.35);last=ts;acc=Math.min(acc+elapsed,TICK*5);let steps=0;
 while(acc>=TICK&&steps<5){frame++;menuTick++;if(screen==='playing')tickGame();else tickMenu();acc-=TICK;steps++;}
 tickMusic();drawFrame();requestAnimationFrame(loop);}
requestAnimationFrame(loop);updateMusic();
// Safe diagnostic interface for automated smoke tests and future level building.
window.HIVEBREAK={get screen(){return screen},get coop(){return coop},get joined(){return joined},get state(){return game},get classes(){return CLASS.map(x=>x.id)},get enemyTypes(){return Object.keys(ENEMY)},get ready(){return ready},get settings(){return Object.assign({},settings)},start(classId=0){selected=clamp(classId,0,3);coop=false;joined=false;beginRun()},select(classId){selected=clamp(classId,0,3)},setLevel(i){if(game&&i>=0&&i<LEVELS.length)startStage(i)},spawnBoss(){if(game)spawnBoss()},damageBoss(amount){if(game?.boss&&!game.boss.dead){game.boss.hp-=amount;if(game.boss.hp<=0)killBoss()}},advance(){if(game)advanceStage()},get enemies(){return game?.enemies||[]},get players(){return game?.players||[]}};
})();
