/* XENOMORPH: HIVEBREAK — ULTIMATE ARCADE REFORGED v1.2
 * Canvas 2D, deterministic 60 Hz gameplay simulation, offline friendly.
 * Assets supplied by the project owner. No external network calls.
 */
(()=>{'use strict';
const W=480,H=270,TICK=1000/60,TAU=Math.PI*2;
let RENDER_SCALE=3;
let renderer3d=null,rendererAttempted=false,rendererError='';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d',{alpha:true});
ctx.imageSmoothingEnabled=false;
const music=document.getElementById('music'),loadout=document.getElementById('loadout');
const assetURL=name=>window.HIVE_ASSETS?.[name]||'assets/'+name;
const A={}; const assetList={sheet:'xeno_sheet.png',wall:'lab_wall.jpg',wall2:'lab_wall_alt.jpg',cover:'cover.png',menuScene:'menu_scene.jpg',anim:'xeno_animation_10x4.png',font:'pixel_font.png',marineAnim:'marine_motion_8x4.png',bossGuardian:'boss_guardian_8x3.png',bossSiege:'boss_siege_8x3.png',bossQueen:'boss_queen_8x3.png',soldier:'soldier_tight.png',drone:'drone_tight.png',warrior:'warrior_tight.png',queen:'praetorian_tight.png'};
Object.assign(assetList,{portrait0:'portrait_drone.png',portrait1:'portrait_warrior.png',portrait2:'portrait_runner.png',portrait3:'portrait_praetorian.png',reforged:'xeno_reforged.png',marineReforged:'marine_reforged.png',bossReforged:'boss_reforged.png'});
let ready=false; let loadErrors=[];
Promise.all(Object.entries(assetList).map(([name,file])=>new Promise(resolve=>{
  const image=new Image();A[name]=image;image.onload=()=>resolve(true);image.onerror=()=>{loadErrors.push(file);resolve(false)};image.src=assetURL(file);
}))).then(()=>{ready=true;loadout.hidden=loadErrors.length===0;if(loadErrors.length){loadout.textContent='ЧАСТЬ ГРАФИКИ НЕДОСТУПНА. ВКЛЮЧЕНА РЕЗЕРВНАЯ ОТРИСОВКА.';console.warn('Optional images unavailable:',loadErrors);}});
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const activeImage=name=>A[name]&&A[name].complete&&A[name].naturalWidth>0;
const persisted=(key,fallback)=>{try{const raw=localStorage.getItem('xh_'+key);return raw===null?fallback:JSON.parse(raw)}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem('xh_'+key,JSON.stringify(value))}catch{}};
const progression=window.HiveProgression;
let evolution=Array.from({length:4},(_,i)=>progression?.clean(persisted('evolution',[])?.[i]||{}));
const traits=p=>evolution[p.classId]?.ranks||{};
function awardXP(p,n){if(!progression||!p)return;const e=evolution[p.classId],before=progression.level(e);e.xp=Math.min(1000000,e.xp+n);save('evolution',evolution);if(progression.level(e)>before)floating(p.x,p.y-90,'НОВАЯ АДАПТАЦИЯ!','#abffe1',90);}
function upgrade(id,key){if(!progression||!['select','paused','stageclear','menu'].includes(screen))return false;if(!progression.buy(evolution[id],key))return false;save('evolution',evolution);for(const p of game?.players||[])if(p.classId===id){const max=CLASS[id].hp*(1+(traits(p).health||0)*.06);p.hp=Math.min(max,p.hp+max-p.maxHp);p.maxHp=max;}return true;}
const settings=Object.assign({difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,voice:false},persisted('settings',{}));
for(const [key,value] of Object.entries({threeD:true,quality3d:1,reflections:true,bloom:true}))if(settings[key]===undefined)settings[key]=value;
if(!['rock','legacy'].includes(settings.musicStyle)){settings.musicStyle='rock';settings.originalMusic=false;}
// Migrate corrupted / old settings without clearing records.
for(const [key,min,max,def] of [['difficulty',0,2,1],['violence',0,2,1],['particles',0,2,2],['ambient',0,2,2],['quality3d',0,2,1],['music',0,1,.37],['sfx',0,1,.55],['master',0,1,.8],['ambientAudio',0,1,.35]]){
 const n=Number(settings[key]);settings[key]=Number.isFinite(n)?clamp(n,min,max):def;if(max===2)settings[key]=Math.round(settings[key]);}
for(const [key,def] of [['shake',true],['flashes',true],['scanlines',false],['hiContrast',false],['damageNumbers',true],['pixel3d',true],['pixelPerfect',true],['originalMusic',false]])if(typeof settings[key]!=='boolean')settings[key]=def;

const records=Object.assign({high:0,wins:0,maxCombo:0,stage:1},persisted('records',{}));
const CLASS=[
{id:'drone',name:'КСЕНО-ДРОН',title:'УНИВЕРСАЛ',hp:125,speed:2.03,power:1.02,scale:1.0,hue:0,special:'КИСЛОТА',color:'#8af3f0',desc:'КИСЛОТА / БАЛАНС'},
{id:'warrior',name:'КСЕНО-ВОИН',title:'ТЯЖЁЛЫЙ БОЕЦ',hp:162,speed:1.70,power:1.26,scale:1.10,hue:36,special:'УДАР ХВОСТОМ',color:'#c7b0ff',desc:'ДЛИННЫЙ ХВОСТ / ОТБРОС'},
{id:'runner',name:'КСЕНО-РАННЕР',title:'СПРИНТЕР',hp:108,speed:2.65,power:.87,scale:.92,hue:137,special:'РЫВОК',color:'#79e5ff',desc:'РЫВОК / КОМБО'},
{id:'praetorian',name:'КСЕНО-ПРЕТОРИАНЕЦ',title:'ТЯЖЁЛЫЙ СТРАЖ',hp:190,speed:1.47,power:1.16,scale:1.17,hue:285,special:'ЯРОСТЬ',color:'#ffe09a',desc:'БРОНЯ / РЕЖИМ ЯРОСТИ'}
];
const LEVELS=[
{id:'research',name:'КОЛОНИАЛЬНАЯ ИССЛЕДОВАТЕЛЬСКАЯ ЛАБОРАТОРИЯ',sector:'СЕКТОР 01',length:2600,wall:'wall',tone:'#62d9e9',fog:'#0b2337',bossName:'СТРАЖ УЛЬЯ',bossHp:700,bossFilter:'none',banners:['НАРУШЕНА ИЗОЛЯЦИЯ УЛЬЯ','НАУЧНЫЙ СЕКТОР ПРОРВАН'],waves:[
{x:275,types:['marine','marine','medic','heavy']},{x:650,types:['marine','shield','gunner','grenadier']},{x:1070,types:['heavy','marine','flame','drone']},{x:1480,types:['shield','android','grenadier','heavy','medic']},{x:1850,types:['marine','android','flame','heavy','gunner','drone']}]},
{id:'military',name:'КОЛОНИАЛЬНЫЙ ВОЕННЫЙ КОМПЛЕКС',sector:'СЕКТОР 02',length:2700,wall:'wall2',tone:'#e6ae60',fog:'#2b1926',bossName:'ОСАДНЫЙ ПРЕТОРИАНЕЦ',bossHp:890,bossFilter:'hue-rotate(43deg) saturate(1.15)',banners:['ПЕРИМЕТР ЗАКРЫТ','ОРУЖЕЙНЫЙ БЛОК ПРОРВАН'],waves:[
{x:290,types:['marine','gunner','heavy','turret']},{x:665,types:['shield','medic','grenadier','heavy']},{x:1070,types:['flame','marine','drone','turret']},{x:1480,types:['shield','heavy','grenadier','android','medic']},{x:1920,types:['heavy','flame','gunner','turret','android','drone']}]},
{id:'reactor',name:'ЗАРАЖЁННОЕ ЯДРО РЕАКТОРА',sector:'СЕКТОР 03',length:2900,wall:'wall',tone:'#c86dc7',fog:'#290c25',bossName:'КОРОЛЕВА КСЕНОМОРФОВ',bossHp:1150,bossFilter:'hue-rotate(-22deg) saturate(1.3)',banners:['УГРОЗА РАСПЛАВЛЕНИЯ РЕАКТОРА','ОБНАРУЖЕН УЛЕЙ-УЗЕЛ'],waves:[
{x:300,types:['android','marine','drone','flame']},{x:700,types:['shield','grenadier','android','gunner']},{x:1110,types:['turret','marine','flame','shield','medic','grenadier']},{x:1550,types:['android','heavy','drone','flame','gunner']},{x:2050,types:['turret','grenadier','gunner','shield','android','marine','drone']}]},
{id:'cryo',name:'КРИОГЕННЫЙ СКЛАД',sector:'СЕКТОР 04',length:2740,wall:'wall2',tone:'#88dcff',fog:'#0b273e',bossName:'КРИОСТРАЖ',bossKind:'cryo',bossHp:1080,bossFilter:'none',banners:['ПРОТОКОЛ РАЗМОРОЗКИ ЗАПУЩЕН','КРИОКАМЕРЫ РАЗГЕРМЕТИЗИРОВАНЫ'],events:[{x:850,text:'СБРОС ДАВЛЕНИЯ: БЕРЕГИСЬ ПАРА',kind:'pressure'},{x:1730,text:'ЭКСПЕРИМЕНТАЛЬНЫЙ ОБРАЗЕЦ АКТИВЕН',kind:'alarm'}],waves:[
{x:275,types:['assault','marine','engineer','drone']},{x:670,types:['shield','assault','flame','medic']},{x:1080,types:['juggernaut','engineer','drone','grenadier']},{x:1510,types:['prototype','assault','medic']},{x:1980,types:['juggernaut','gunner','shield','engineer','drone']}]},
{id:'dock',name:'ОРБИТАЛЬНЫЙ ДОК',sector:'СЕКТОР 05',length:2820,wall:'wall2',tone:'#ffbd78',fog:'#171c33',bossName:'СТРАЖ ОРБИТАЛЬНОГО ДОКА',bossKind:'sentinel',bossHp:1260,bossFilter:'none',banners:['ВЫХОД В ГРУЗОВОЙ ТЕРМИНАЛ','ШЛЮЗЫ ЗАКРЫТЫ: ПОДКРЕПЛЕНИЕ'],events:[{x:850,text:'ВНИМАНИЕ: РАЗГЕРМЕТИЗАЦИЯ ШЛЮЗА',kind:'airlock'},{x:1750,text:'БОЕВОЙ ЭКЗОСКЕЛЕТ НА ПЛАТФОРМЕ',kind:'alarm'}],waves:[
{x:275,types:['assault','engineer','drone','drone']},{x:690,types:['gunner','shield','assault','grenadier']},{x:1110,types:['juggernaut','turret','engineer','drone']},{x:1540,types:['exosuit','assault','engineer']},{x:2040,types:['assault','gunner','shield','grenadier','drone']}]},
{id:'hive',name:'ЦЕНТРАЛЬНЫЙ УЛЕЙ',sector:'СЕКТОР 06',length:2940,wall:'wall',tone:'#b9ff6b',fog:'#16201d',bossName:'ВЛАДЫКА ЦЕНТРАЛЬНОГО УЛЬЯ',bossKind:'overlord',bossHp:1540,bossFilter:'none',banners:['СЕРДЦЕ УЛЬЯ ОБНАРУЖЕНО','ПОСЛЕДНИЙ РУБЕЖ'],events:[{x:870,text:'КИСЛОТНЫЕ КАНАЛЫ ПОД ДАВЛЕНИЕМ',kind:'acid'},{x:1780,text:'УЛЕЙ ПРОБУЖДАЕТ СВОЮ СТРАЖУ',kind:'alarm'}],waves:[
{x:290,types:['android','assault','drone','engineer']},{x:720,types:['juggernaut','flame','grenadier','medic']},{x:1150,types:['prototype','shield','drone']},{x:1590,types:['exosuit','assault','engineer']},{x:2130,types:['juggernaut','gunner','grenadier','shield','drone']}]}
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
drone:{hp:63,speed:1.1,damage:8,score:530,range:155,shade:'none',scale:.78},
assault:{name:'ШТУРМОВОЙ МОРПЕХ',hp:74,speed:1.03,damage:7,score:650,range:138,shade:'none',scale:1,role:'assault',magazine:9},
engineer:{name:'ИНЖЕНЕР ОХРАНЫ',hp:68,speed:.58,damage:6,score:700,range:150,shade:'none',scale:1,role:'engineer',magazine:4},
juggernaut:{name:'ТЯЖЁЛЫЙ АНДРОИД',hp:180,speed:.43,damage:21,score:950,range:68,shade:'none',scale:1.28,armor:.35,role:'juggernaut'},
prototype:{name:'ЭКСПЕРИМЕНТАЛЬНЫЙ АНДРОИД',hp:340,speed:.73,damage:24,score:1800,range:95,shade:'none',scale:1.48,armor:.28,role:'prototype',elite:true},
exosuit:{name:'ВОЕННЫЙ ЭКЗОСКЕЛЕТ',hp:390,speed:.33,damage:17,score:2200,range:190,shade:'none',scale:1.5,armor:.32,role:'exosuit',elite:true,magazine:4}
};
const DIFIC=[{damage:.7,hp:.78,frequency:1.2},{damage:1,hp:1,frequency:1},{damage:1.38,hp:1.28,frequency:.78}];
const ATTACKS={
launcher:{startup:6,active:5,recovery:14,damage:25,reach:72,depth:28,knock:5,stun:25,launch:5.4,hitstop:4,anim:3},
execution:{startup:12,active:5,recovery:24,damage:180,reach:78,depth:28,knock:24,stun:35,launch:2.2,hitstop:8,anim:3},
claw1:{startup:3,active:5,recovery:8,damage:14,reach:50,depth:18,knock:4,stun:8,hitstop:2,anim:2},
claw2:{startup:4,active:5,recovery:9,damage:17,reach:56,depth:19,knock:8,stun:10,hitstop:2,anim:2},
claw3:{startup:5,active:6,recovery:14,damage:27,reach:64,depth:23,knock:22,stun:22,launch:1.8,hitstop:4,anim:2},
tail:{startup:9,active:7,recovery:17,damage:35,reach:92,depth:32,knock:25,stun:23,hitstop:4,anim:3},
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
const tracks=['stage01','stage02','stage03','stage04','stage05','stage06','boss01','boss02','boss03','boss04','boss05','boss06'];
const soundtrack=tracks.map(name=>{const a=new Audio(assetURL((settings.musicStyle==='legacy'?'':'rock_')+name+'.ogg'));a.loop=true;a.preload='none';return a;});
let activeTrack=-1,fadeTrack=-1;
// Russian UI catalog. Edit copy here; sprite glyph order is independent of text.
const RU=Object.freeze({
 "loading": "ЗАГРУЗКА РЕСУРСОВ...",
 "gameTitle": "КСЕНОМОРФ",
 "gameSubtitle": "ПРОРЫВ УЛЬЯ",
 "selectTitle": "ВЫБЕРИ СВОЙ ОБРАЗЕЦ",
 "settingsTitle": "НАСТРОЙКИ",
 "controlsTitle": "УПРАВЛЕНИЕ",
 "recordsTitle": "РЕКОРДЫ И ТИТРЫ",
 "pauseTitle": "ПАУЗА",
 "stageClearTitle": "УРОВЕНЬ ПРОЙДЕН",
 "gameOverTitle": "ОБРАЗЕЦ ПОТЕРЯН",
 "gameOverSubtitle": "КОЛОНИЯ ПАЛА",
 "victoryTitle": "УЛЕЙ ПОБЕЖДЁН!",
 "thanks": "СПАСИБО ЗА ИГРУ",
 "back": "ESC / ENTER  НАЗАД",
 "bindPrompt": "НАЖМИ НОВУЮ КЛАВИШУ",
 "bindCancel": "ESC — ОТМЕНА • ФИЗИЧЕСКАЯ РАСКЛАДКА",
 "optionsHelp": "Q/E ВКЛАДКИ • МЫШЬ −/+ • КОЛЕСО ПРОКРУТКА",
 "optionsSaved": "ESC НАЗАД • ПАРАМЕТРЫ СОХРАНЯЮТСЯ АВТОМАТИЧЕСКИ",
 "rebindingHelp": "ПЕРЕНАЗНАЧЕНИЕ: НАСТРОЙКИ → КЛАВИШИ",
 "keyboardHelp": "РУ / EN: ОДНИ И ТЕ ЖЕ КЛАВИШИ • ESC НАЗАД",
 "cabinetIdentity": "КОЛОНИЯ КЕПЛЕР • СИГНАЛ БЕДСТВИЯ",
 "edition": "ОБЪЁМНЫЙ РЕМАСТЕР • ВЕРСИЯ 1.2",
 "controllerHelp": "1 ИГРОК / 2 ИГРОКА  •  ПОДДЕРЖКА ГЕЙМПАДА",
 "creditsTitle": "КСЕНОМОРФ: ПРОРЫВ УЛЬЯ",
 "creditsBase": "ОСНОВА: ПРЕДОСТАВЛЕННЫЙ ПРОЕКТ 0.7.1",
 "creditsEngine": "ШРИФТ: DEJAVU SANS MONO • 2D CANVAS • 60 ГЦ",
 "creditsCoop": "ОДИН ИГРОК И ЛОКАЛЬНЫЙ КООПЕРАТИВ",
 "restartHelp": "ENTER — ПОВТОР    ESC — ГЛАВНОЕ МЕНЮ",
 "victoryHelp": "ENTER ПЕРЕЗАПУСК     ESC МЕНЮ"
});
const OPTION_GROUPS=[
 ['СЛОЖНОСТЬ','УРОВЕНЬ ЖЕСТОКОСТИ','ЧИСЛА УРОНА','СБРОС НАСТРОЕК','НАЗАД'],
 ['НАСТОЯЩАЯ 3D-ГРАФИКА','ЧАСТИЦЫ','ФОНОВЫЕ ЭФФЕКТЫ','ТРЯСКА КАМЕРЫ','ВСПЫШКИ','СКАНЛИНИИ','КОНТРАСТ ИНТЕРФЕЙСА','ЦЕЛЫЕ ПИКСЕЛИ','ПОЛНЫЙ ЭКРАН','КАЧЕСТВО 3D','ОТРАЖЕНИЯ','СВЕЧЕНИЕ','ЛЁГКАЯ ПИКСЕЛИЗАЦИЯ','НАЗАД'],
 ['ОБЩАЯ ГРОМКОСТЬ','ГРОМКОСТЬ МУЗЫКИ','ГРОМКОСТЬ ЭФФЕКТОВ','ГРОМКОСТЬ ОКРУЖЕНИЯ','СТИЛЬ МУЗЫКИ','ИСХОДНЫЙ ТРЕК СЕКТОРА 1','НАЗАД'],
 ['ВВЕРХ','ВНИЗ','ВЛЕВО','ВПРАВО','ЛЁГКАЯ АТАКА','ТЯЖЁЛАЯ АТАКА','СПОСОБНОСТЬ','ПРЫЖОК','РЫВОК','ЗАХВАТ / БРОСОК','СУПЕРПРИЁМ','ПАРИРОВАНИЕ','ДОБИВАНИЕ','МЁРТВАЯ ЗОНА СТИКА','СБРОС УПРАВЛЕНИЯ','НАЗАД']
];
const BINDING_ACTIONS=['up','down','left','right','light','heavy','special','jump','dash','grab','super','parry','execute'];

const BUTTONS=['НАЧАТЬ ИГРУ','КООПЕРАТИВ','НАСТРОЙКИ','УПРАВЛЕНИЕ','РЕКОРДЫ И ТИТРЫ'];
const DEFAULT_BINDINGS=Object.freeze({left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',light:'KeyJ',heavy:'KeyK',special:'KeyL',jump:'Space',dash:'ShiftLeft',grab:'KeyE',super:'KeyU',parry:'KeyQ',execute:'KeyR'});
const KEY_FALLBACK={ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',' ':'Space',Spacebar:'Space',Shift:'ShiftLeft',Enter:'Enter',Escape:'Escape',F3:'F3'};
const RU_PHYSICAL='фисвуапршолдьтщзйкыегмцчнях';
const EN_PHYSICAL='abcdefghijklmnopqrstuvwxyz';
function physicalCode(event){
 if(event.code&&event.code!=='Unidentified')return event.code;
 const key=event.key||'';if(KEY_FALLBACK[key])return KEY_FALLBACK[key];
 const lower=key.toLowerCase();let idx=RU_PHYSICAL.indexOf(lower);
 if(lower.length===1&&idx>=0)return 'Key'+EN_PHYSICAL[idx].toUpperCase();
 if(/^[a-z]$/.test(lower))return 'Key'+lower.toUpperCase();
 if(/^[0-9]$/.test(key))return 'Digit'+key;return key;
}
function bindingCode(action){const value=settings.bindings?.[action];return typeof value==='string'?value:DEFAULT_BINDINGS[action];}
function bindingLabel(action){const code=bindingCode(action);return ({Space:'ПРОБЕЛ',ShiftLeft:'SHIFT',ShiftRight:'SHIFT',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'})[code]||code.replace(/^Key|^Digit/,'');}
let bindingAction=null;
const held=new Set(),pending=new Map();let gpPrev=new Map();
const INPUT_BUFFER_MS=125;
const ACTIONS=['parry','execute','dash','jump','grab','light','heavy','special','super'];
const getGP=()=>{try{return Array.from(navigator.getGamepads?.()||[]).filter(Boolean)}catch{return []}};
function keyAction(code){
 const arrow={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[code];if(arrow)return arrow;
 if(code==='ShiftRight'&&bindingCode('dash')==='ShiftLeft')return 'dash';
 return Object.keys(DEFAULT_BINDINGS).find(action=>bindingCode(action)===code)||null;
}
function edge(name){const at=pending.get(name);pending.delete(name);return at!==undefined;}
function sampleKeyboard(){let h=action=>[...held].some(code=>keyAction(code)===action);return {crawl:held.has('ControlLeft')||held.has('ControlRight'),x:Number(h('right'))-Number(h('left')),y:Number(h('down'))-Number(h('up')),light:edge('light'),heavy:edge('heavy'),special:edge('special'),jump:edge('jump'),dash:edge('dash'),grab:edge('grab'),super:edge('super'),parry:edge('parry'),execute:edge('execute')};}
function sampleGamepad(gp){if(!gp)return {x:0,y:0};const b=i=>!!gp.buttons?.[i]?.pressed;const prev=gpPrev.get(gp.index)||[];const just=i=>b(i)&&!prev[i];
 const ax=clamp(gp.axes?.[0]||0,-1,1),ay=clamp(gp.axes?.[1]||0,-1,1),len=Math.hypot(ax,ay),deadzone=clamp(Number(settings.deadzone)||.24,.10,.4);
 const scale=len>deadzone?Math.min(1,(len-deadzone)/(1-deadzone))/len:0;
 const out={crawl:b(10),x:scale?ax*scale:(Number(b(15))-Number(b(14))),y:scale?ay*scale:(Number(b(13))-Number(b(12))),jump:just(0),special:just(1),light:just(2),heavy:just(3),grab:just(4),dash:just(5),super:just(6),parry:just(7),execute:just(11),pause:just(9),select:just(9)};
 gpPrev.set(gp.index,Array.from({length:18},(_,i)=>b(i)));return out;
}
function captureInputs(){const kb=sampleKeyboard();const gps=getGP();const active=new Set(gps.map(p=>p.index));for(const i of gpPrev.keys())if(!active.has(i))gpPrev.delete(i);const pads=gps.map(sampleGamepad);
 if(game&&coop&&joined){return [kb,pads[0]||{x:0,y:0}];}
 if(game&&pads[0]){return [mergeInput(kb,pads[0])];}
 return [kb];}
function mergeInput(a,b){return {x:Math.abs(a.x)>.1?a.x:b.x,y:Math.abs(a.y)>.1?a.y:b.y,light:a.light||b.light,heavy:a.heavy||b.heavy,special:a.special||b.special,jump:a.jump||b.jump,dash:a.dash||b.dash,grab:a.grab||b.grab,super:a.super||b.super,parry:a.parry||b.parry,execute:a.execute||b.execute,pause:b.pause};}
function resetInput(){held.clear();pending.clear();if(game)for(const p of game.players){p.inputQueue=null;p.buffer=null;}}
function queueCommands(p,input){if(!p.inputQueue)p.inputQueue=new Map();for(const action of ACTIONS)if(input[action])p.inputQueue.set(action,performance.now()+INPUT_BUFFER_MS);}
function releaseGrab(p){if(p.grabTarget){p.grabTarget.heldBy=null;p.grabTarget.stun=Math.max(p.grabTarget.stun,18);p.grabTarget=null;}p.grabTick=0;}
// Original layered SFX: each voice combines a pitched transient and filtered noise.
// No external samples. Bound voice count + retrigger spacing keep crowds listenable.
const SFX_PROFILES={
 claw:[210,58,.14,.085,'triangle',.85,2200], tail:[105,32,.23,.12,'sawtooth',.65,850],
 hit:[94,36,.13,.13,'triangle',.9,1600], heavy:[66,24,.32,.16,'sine',1,900],
 hurt:[135,43,.27,.10,'sawtooth',.45,1500], acid:[780,105,.42,.075,'sawtooth',1,3100],
 shoot:[170,42,.09,.075,'square',1,4700], rifle:[190,48,.095,.07,'square',1,5100],
 gunner:[125,32,.13,.09,'square',1,3800], turret:[390,90,.11,.08,'triangle',.75,6000],
 flame:[110,65,.3,.075,'sawtooth',1,1300], electric:[980,145,.24,.07,'square',.75,4200],
 grenade:[85,28,.4,.13,'sine',1,1100], boom:[60,21,.58,.18,'sine',1,740],
 jump:[185,420,.17,.055,'triangle',.3,1700], land:[75,30,.17,.07,'sine',.8,1000],
 pickup:[440,880,.25,.065,'triangle',.08,4500], select:[660,480,.065,.05,'triangle',0,3000],
 boss:[110,37,.85,.14,'sawtooth',.65,1300], die:[190,38,.48,.095,'sawtooth',.7,1900],
 dash:[440,95,.17,.055,'triangle',1,3500], step:[82,30,.06,.028,'sine',.8,950],
 hiss:[950,230,.4,.035,'sine',1,2800], reload:[700,250,.15,.04,'square',.75,5200],
 steam:[240,100,.7,.028,'sine',1,2100], door:[90,35,.8,.035,'sawtooth',.6,680],
 parry:[1400,380,.19,.10,'triangle',.55,6400],execute:[110,28,.38,.18,'sawtooth',.75,2200],launcher:[130,280,.16,.08,'sawtooth',.45,2700],
 metal:[980,172,.32,.06,'triangle',.45,5100], glass:[2200,490,.25,.045,'triangle',1,6500]
};
let audioUnlocked=false,noiseBuffer=null,lastAudioFrame=0,lastAmbientTick=-1000;
const audioVoices=[],audioRetriggers=new Map();
function setMusicStyle(style){settings.musicStyle=style==='legacy'?'legacy':'rock';settings.originalMusic=false;for(let i=0;i<soundtrack.length;i++){const a=soundtrack[i];a.pause();a.src=assetURL((settings.musicStyle==='legacy'?'':'rock_')+tracks[i]+'.ogg');a.currentTime=0;}activeTrack=-1;updateMusic();save('settings',settings);}
function masterVolume(){return clamp(Number.isFinite(settings.master)?settings.master:.8,0,1);}
function synth(type,vol=1){
 if(!audioCtx||!audioUnlocked||settings.sfx<=0||masterVolume()<=0)return;
 const now=audioCtx.currentTime;
 for(let i=audioVoices.length-1;i>=0;i--)if(audioVoices[i].until<=now)audioVoices.splice(i,1);
 if(audioVoices.length>=16||now-(audioRetriggers.get(type)??-100)<.022)return;
 audioRetriggers.set(type,now);
 const [f,end,d,v,w,n,cut]=SFX_PROFILES[type]||SFX_PROFILES.hit;
 const gain=audioCtx.createGain(),osc=audioCtx.createOscillator();
 const level=Math.max(.0001,v*clamp(vol,0,1.5));
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(level,now+.004);
 gain.gain.exponentialRampToValueAtTime(.0001,now+d);
 gain.connect(sfxNode||audioCtx.destination);
 osc.type=w;osc.frequency.setValueAtTime(f*rand(.96,1.04),now);
 osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+d);
 osc.connect(gain);osc.start(now);osc.stop(now+d+.015);
 const nodes=[osc,gain];
 if(n&&audioCtx.createBuffer&&audioCtx.createBufferSource&&audioCtx.createBiquadFilter){
  if(!noiseBuffer){noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate||44100,audioCtx.sampleRate||44100);const data=noiseBuffer.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;data[i]=white-.4*previous;previous=white;}}
  const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),ng=audioCtx.createGain();
  src.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.setValueAtTime(cut,now);filter.Q.value=.65;
  ng.gain.setValueAtTime(level*n*.8,now);ng.gain.exponentialRampToValueAtTime(.0001,now+d);
  src.connect(filter);filter.connect(ng);ng.connect(sfxNode||audioCtx.destination);
  src.start(now,Math.random()*.2);src.stop(now+d);nodes.push(src,filter,ng);
 }
 const voice={until:now+d+.02,nodes};audioVoices.push(voice);
 osc.onended=()=>{for(const node of nodes)node.disconnect?.();const i=audioVoices.indexOf(voice);if(i>=0)audioVoices.splice(i,1);};
}
function ensureAudio(){
 try{
  if(!audioCtx){
   audioCtx=new (window.AudioContext||window.webkitAudioContext)();
   masterNode=audioCtx.createGain();sfxNode=audioCtx.createGain();sfxNode.connect(masterNode);
   if(audioCtx.createDynamicsCompressor){const limiter=audioCtx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.16;masterNode.connect(limiter);limiter.connect(audioCtx.destination);}else masterNode.connect(audioCtx.destination);
  }
  audioUnlocked=true;
  if(audioCtx.state==='suspended')audioCtx.resume().catch?.(()=>{});
  masterNode.gain.setValueAtTime(masterVolume(),audioCtx.currentTime);
  sfxNode.gain.setValueAtTime(clamp(settings.sfx,0,1),audioCtx.currentTime);
  updateMusic();
 }catch(e){console.info('Звук недоступен:',e?.message||e);}
}
function updateMusic(){
 const playable=['playing','menu','select','stageclear','victory','options','credits','controls'];
 const level=clamp(game?.level||0,0,5);
 const wanted=game&&['playing','paused','stageclear','gameover'].includes(screen)?(game.boss&&!game.boss.dead?6+level:level):0;
 const target=audioUnlocked&&playable.includes(screen)&&settings.music>0&&masterVolume()>0?(settings.originalMusic&&wanted===0?-2:wanted):-1;
 if(target===-2){if(music.paused){music.volume=0;music.play().catch(()=>{});}activeTrack=-2;}
 if(target!==activeTrack){
  fadeTrack=activeTrack;activeTrack=target;
  if(activeTrack>=0){const a=soundtrack[activeTrack];if(a.paused){if(fadeTrack>=0)a.currentTime=0;a.volume=0;a.play().catch(()=>{});}}
 }
 if(screen==='paused'||screen==='gameover'){
  music.pause();music.volume=0;
  for(const a of soundtrack){a.pause();a.volume=0;}
  for(const voice of audioVoices){for(const node of voice.nodes){try{node.stop?.();}catch{}node.disconnect?.();}}
  audioVoices.length=0;
 }
 const button=document.getElementById('sound');button.textContent=settings.music===0&&settings.sfx===0?'♫ ВЫКЛ':'♫ ВКЛ';
}
function tickMusic(){
 const now=performance.now(),dt=lastAudioFrame?clamp((now-lastAudioFrame)/1000,0,.1):1/60;lastAudioFrame=now;
 const fade=1-Math.exp(-dt*5),master=masterVolume();
 if(masterNode){const level=screen==='paused'||screen==='gameover'?0:master;if(masterNode.gain.setTargetAtTime)masterNode.gain.setTargetAtTime(level,audioCtx.currentTime,.035);else masterNode.gain.setValueAtTime(level,audioCtx.currentTime);sfxNode.gain.setValueAtTime(clamp(settings.sfx,0,1),audioCtx.currentTime);}
 const intensity=screen==='playing'?(game?.boss&&!game.boss.dead?1:game?.waveActive?.88:.58):screen==='stageclear'||screen==='victory'?.82:.58;
 const volume=audioUnlocked?clamp(settings.music*master*intensity*.72,0,1):0;
 const goal=activeTrack===-2?volume:0;
 if(!music.paused){music.volume=clamp(music.volume+(goal-music.volume)*fade,0,1);if(goal===0&&music.volume<.005){music.pause();music.volume=0;}}
 for(let i=0;i<soundtrack.length;i++){
  const a=soundtrack[i],target=i===activeTrack?volume:0;
  if(i!==activeTrack&&a.paused)continue;
  a.volume=clamp(a.volume+(target-a.volume)*fade,0,1);
  if(i!==activeTrack&&a.volume<.005){a.pause();a.volume=0;}
 }
 if(screen==='playing'&&game&&(settings.ambientAudio??.35)>0){
  if(game.tick<lastAmbientTick)lastAmbientTick=-1000;
  if(game.tick-lastAmbientTick>360){lastAmbientTick=game.tick;synth(game.level===2||game.level===5?'electric':game.level===4?'door':'steam',clamp(settings.ambientAudio??.35,0,1));}
 }
}
function changeScreen(s){screen=s;menuTick=0;menuCooldown=14;pending.clear();updateMusic();}
function resetRecordsIfNeeded(){records.high=Number(records.high)||0;records.stage=clamp(Number(records.stage)||1,1,LEVELS.length);}resetRecordsIfNeeded();
// ------------------------------ WORLD STATE --------------------------------
function makePlayer(id,classId,x,y){const c=CLASS[classId],health=c.hp*(1+(evolution[classId]?.ranks.health||0)*.06);return {id,classId,x,y,z:0,vz:0,vx:0,face:1,hp:health,maxHp:health,lives:3,energy:100,score:0,kills:0,inv:0,stun:0,dodge:0,dodgeCd:0,attack:null,attackT:0,hitTargets:new Set(),buffer:null,chain:0,chainTick:0,rageT:0,grabTarget:null,grabTick:0,moveX:0,moveY:0,anim:0,walking:0,airborne:false,dead:false,downT:0,oldHp:c.hp,trail:[],counterWindow:0,lastHit:0};}
function makeProps(level){const props=[];const n=LEVELS[level].length;
 for(let i=0;i<Math.floor(n/190);i++){let x=255+i*190+Math.floor(rand(-25,25));const type=i%5===3?'barrel':i%7===5?'terminal':'crate';props.push({x,y:205+((i*31)%31),type,hp:type==='barrel'?2:type==='terminal'?3:3,maxHp:3,dead:false,phase:rand(0,TAU)});}return props;}
function makeHazards(level){
 const sets=[
  [{x:1160,y:208,type:'steam',timer:0}],
  [{x:930,y:215,type:'steam',timer:0},{x:1640,y:223,type:'electric',timer:42},{x:2090,y:210,type:'steam',timer:80}],
  [{x:775,y:219,type:'electric',timer:14},{x:1220,y:225,type:'steam',timer:40},{x:1740,y:212,type:'electric',timer:71},{x:2295,y:226,type:'electric',timer:24}],
  [{x:880,y:213,type:'steam',timer:150,color:'#a9eaff',label:'КРИОПАР',period:240,activeTicks:55,damage:8,slow:65},{x:1280,y:232,type:'electric',timer:70},{x:1750,y:204,type:'steam',timer:180,color:'#a9eaff',label:'КРИОПАР',period:240,activeTicks:55,damage:8,slow:65},{x:2200,y:223,type:'steam',timer:50,color:'#a9eaff',label:'КРИОПАР',period:240,activeTicks:55,damage:8,slow:65}],
  [{x:910,y:224,type:'electric',timer:140,label:'ШЛЮЗ',period:260,activeTicks:60,damage:11},{x:1430,y:200,type:'steam',timer:70},{x:1820,y:232,type:'electric',timer:140,label:'ШЛЮЗ',period:260,activeTicks:60,damage:11},{x:2310,y:211,type:'electric',timer:40}],
  [{x:930,y:214,type:'steam',timer:200,color:'#baff69',label:'КИСЛОТА',period:230,activeTicks:58,damage:12},{x:1350,y:237,type:'electric',timer:140},{x:1820,y:201,type:'steam',timer:200,color:'#baff69',label:'КИСЛОТА',period:230,activeTicks:58,damage:12},{x:2420,y:222,type:'steam',timer:80,color:'#baff69',label:'КИСЛОТА',period:230,activeTicks:58,damage:12}]
 ];return (sets[level]||[]).map(h=>({...h,active:false,warning:false}));
}
function beginRun(){ensureAudio();const p=[makePlayer(1,selected,66,221)];if(coop&&joined)p.push(makePlayer(2,selected2,106,233));game={impacts:[],blood:[],decals:[],level:0,players:p,inputDevice:'keyboard',camera:0,camTarget:0,tick:0,score:0,kills:0,maxCombo:0,combo:0,comboTimer:0,hitStop:0,shake:0,flash:0,particles:[],texts:[],bullets:[],puddles:[],items:[],enemies:[],props:[],hazards:[],boss:null,bossDown:0,waveIndex:0,waveActive:false,gateX:Infinity,stageBanner:185,announcement:'КОЛОНИАЛЬНАЯ ИССЛЕДОВАТЕЛЬСКАЯ ЛАБОРАТОРИЯ',announceT:155,levelTime:0,damageTaken:0,uniqueItems:0,stageKills:0,stageBonus:0,stageDamageTaken:0,finished:false,stats:[],debug:false};
 startStage(0,false);changeScreen('playing');updateMusic();}
function startStage(index,keepPlayers=true){const old=game;const level=LEVELS[index];if(!old)return;
 if(!level)return;old.impacts=[];old.level=index;old.camera=0;old.arenaMin=23;old.waveTick=0;old.eventIndex=0;old.eventPulse=0;old.eventKind='';old.tick=0;old.levelTime=0;old.waveIndex=0;old.waveActive=false;old.gateX=Infinity;old.stageBanner=180;old.announcement=level.banners[0];old.announceT=130;old.enemies=[];old.bullets=[];old.puddles=[];old.items=[];old.particles=[];old.texts=[];old.props=makeProps(index);old.hazards=makeHazards(index);old.boss=null;old.bossDown=0;old.stageKills=0;old.stageBonus=0;old.stageDamageTaken=0;old.finished=false;old.combo=0;old.comboTimer=0;old.hitStop=0;old.flash=0;old.shake=0;
 old.blood=[];old.decals=[];old.reactorPhase=0;old.players.forEach((p,i)=>{p.celebrating=false;p.travel=0;p.motionVX=0;p.motionVY=0;p.x=68+i*43;p.y=214+i*18;p.z=0;p.vz=0;p.vx=0;p.airborne=false;p.slowT=0;p.face=1;p.inv=100;p.stun=0;p.dodge=0;p.dodgeCd=0;p.attack=null;p.attackT=0;p.buffer=null;p.inputQueue=null;p.grabTarget=null;p.grabTick=0;p.chain=0;p.rageT=0;p.dead=false;p.downT=0;p.trail=[];p.counterWindow=0;p.oldHp=p.hp;if(keepPlayers){p.lives=Math.max(1,p.lives);p.hp=Math.max(p.maxHp*.48,Math.min(p.maxHp,p.hp+p.maxHp*.48));p.energy=Math.min(100,p.energy+35);} });
 if(index===0){spawnWavePreview();}else{floating(240,100,'СЕКТОР '+String(index+1).padStart(2,'0'),'#ffdf88',120,true);} }
function spawnWavePreview(){// The first encounter is activated by its own explicit world position.
}
function createEnemy(type,x,y){type=ENEMY[type]?type:'marine';const cfg=ENEMY[type],dif=DIFIC[settings.difficulty];return {id:Math.random(),type,x,y,z:type==='drone'?37:0,vz:0,vx:0,hp:Math.round(cfg.hp*dif.hp),maxHp:Math.round(cfg.hp*dif.hp),speed:cfg.speed*rand(.9,1.08),face:-1,ai:'approach',cool:Math.floor(rand(24,68)),wind:0,recover:0,stun:0,hurt:0,flash:0,walk:rand(0,6),fire:0,shield:0,healCd:210+rand(0,140),ammo:cfg.magazine||6,reload:0,spawnT:28,stuckT:0,lastX:x,lastY:y,burstShots:0,burstTimer:0,deathStyle:Math.floor(rand(0,4)),targetLock:0,lastTarget:null,armor:cfg.armor||0,dead:false,deathT:0,heldBy:null,attackCd:0,retreat:0};}
function spawnWave(wave){const g=game;if(!wave||g.waveActive||g.boss)return;g.waveActive=true;g.waveTick=0;g.arenaMin=Math.max(23,wave.x-160);g.gateX=Math.min(LEVELS[g.level].length-45,Math.max(wave.x+285,Math.max(...g.players.filter(p=>!p.dead).map(p=>p.x))+210));g.announcement=wave.types.some(t=>ENEMY[t].elite)?'ОПАСНОСТЬ: ЭЛИТНЫЙ ОТРЯД':'КОНТАКТ С ПРОТИВНИКОМ / ВОЛНА '+(g.waveIndex+1);g.announceT=92;
 const types=wave.types.slice();if(coop&&joined)types.push(pick(['marine','assault','heavy','android']));
 types.forEach((type,i)=>{const px=clamp(Math.max(wave.x+115,Math.max(...g.players.filter(p=>!p.dead).map(p=>p.x))+110)+(i%4)*34,g.arenaMin+35,g.gateX-22),py=196+((i*19)%45);g.enemies.push(createEnemy(type,px,py));});g.waveIndex++;synth('boss',.18);}
function spawnBoss(){const g=game,lev=LEVELS[g.level];if(g.boss)return;g.waveActive=false;g.gateX=Infinity;g.arenaMin=lev.length-580;const hp=Math.round(lev.bossHp*DIFIC[settings.difficulty].hp*(coop&&joined?1.35:1));g.boss={x:lev.length-160,y:221,z:0,hp,maxHp:hp,face:-1,phase:1,ai:'stalk',cool:100,wind:0,attackKind:'',lockFace:-1,targetLock:null,telegraph:null,flash:0,hurt:0,stun:0,vz:0,walk:0,dashT:0,dashVictims:new Set(),dead:false,deathT:0};g.announcement='ВНИМАНИЕ  //  '+lev.bossName;g.announceT=185;g.stageBanner=0;g.flash=12;g.shake=8;synth('boss');updateMusic();floating(g.boss.x,g.boss.y-120,'БОСС ПРИБЛИЖАЕТСЯ','#ffdc7e',110);}
function addScore(p,n){p.score+=n;game.score+=n;if(game.score>records.high){records.high=game.score;save('records',records)}}
function killEnemy(e,killer){if(e.dead)return;e.dead=true;e.hp=0;e.deathT=0;e.vz=Math.max(e.vz,1.2);e.ai='dead';game.kills++;game.stageKills++;if(killer){awardXP(killer,ENEMY[e.type].elite?70:25);if(killer.classId===0)killer.hp=Math.min(killer.maxHp,killer.hp+(traits(killer).passive||0)*2);killer.kills++;addScore(killer,ENEMY[e.type].score);}
 game.shake=Math.max(game.shake,e.type==='heavy'?4:1.5);burst(e.x,e.y-28,e.type==='android'?'#a1eaf1':'#df4242',e.type==='heavy'?22:13,2.9);floating(e.x,e.y-65,'+'+ENEMY[e.type].score,'#ffe08b',65);synth('die',.75);
 if(Math.random()<.23||game.stageKills%6===0){const type=pick(['med','energy','bonus','bonus','bonus','shield']);game.items.push({x:e.x,y:e.y-4,type,t:1100,bob:rand(0,TAU)});} }
function killBoss(){const g=game;if(!g.boss||g.boss.dead)return;g.boss.dead=true;g.boss.hp=0;g.bossDown=130;g.announcement='ЧУДОВИЩЕ УЛЬЯ УНИЧТОЖЕНО';g.announceT=125;g.shake=14;g.flash=22;g.players.forEach(p=>{awardXP(p,150);addScore(p,3000)});updateMusic();burst(g.boss.x,g.boss.y-75,'#a9fc78',70,5);synth('boom',1.4);}
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

function impact3D(x,y,z=35,kind='hit',force=1){if(!game)return;if(!game.impacts)game.impacts=[];game.impacts.push({x,y,z,kind,force,t:18,maxT:18});if(game.impacts.length>28)game.impacts.shift()}
function damagePlayer(p,damage,from){if(p.dead)return;
 if(p.parryT>0&&p.inv<=0&&(from-p.x)*p.face>=-8){
  p.parryT=0;p.riposteT=90;p.inv=12;p.energy=clamp(p.energy+12,0,100);game.hitStop=5;game.shake=Math.max(game.shake,3);
  for(const e of game.enemies)if(!e.dead&&Math.abs(e.x-p.x)<100&&Math.abs(e.y-p.y)<32){e.stun=28;e.wind=0;e.vx=p.face*2}
  impact3D(p.x+p.face*22,p.y,41,'guard',1.2);floating(p.x,p.y-95,'ПАРИРОВАНИЕ!','#c0ffeb',58);synth('parry',.7);return;
 }if(p.inv>0){if(p.dodge>7&&!p.perfectDodge){p.perfectDodge=true;p.energy=clamp(p.energy+5,0,100);floating(p.x,p.y-83,'ИДЕАЛЬНОЕ УКЛОНЕНИЕ','#b8f7ed',55);synth('dash',.35);}return;}if(p.stun>0)return;if(p.counterWindow>0){p.counterWindow=0;p.counterTriggered=true;p.inv=22;p.attack='counter';p.attackT=ATTACKS.counter.startup;p.hitTargets.clear();game.shake=Math.max(game.shake,5);synth('tail');floating(p.x,p.y-82,'КОНТРААТАКА!','#f4e6a7',55);for(const e of game.enemies){if(!e.dead&&Math.abs(e.x-p.x)<95&&Math.abs(e.y-p.y)<38)if(hitTarget(p,e,{damage:37,stun:25,knock:26,hitstop:4},1))p.hitTargets.add(e.id);}return;}let amt=damage*(1-([1,3].includes(p.classId)?(traits(p).passive||0)*.04:0))*DIFIC[settings.difficulty].damage;if(p.rageT>0)amt*=.48;if(CLASS[p.classId].id==='praetorian')amt*=.85;amt=Math.ceil(amt);p.hp=Math.max(0,p.hp-amt);game.damageTaken+=amt;game.stageDamageTaken+=amt;p.inv=47;p.stun=17;p.vx=(p.x>=from?1:-1)*3.3;p.dodge=0;releaseGrab(p);p.attack=null;p.chain=0;p.buffer=null;p.inputQueue=null;game.combo=0;game.comboTimer=0;game.shake=Math.max(game.shake,5);burst(p.x,p.y-34,'#ff865c',13,2.9);floating(p.x,p.y-69,'-'+amt,'#ff8c7d',46);synth('hurt');
 if(p.hp<=0){p.lives--;if(p.lives>0){p.hp=Math.round(p.maxHp*.58);p.stun=65;p.inv=130;floating(p.x,p.y-105,'ВОЗВРАЩЕНИЕ','#a6f8e8',84);}else{p.dead=true;p.downT=0;floating(p.x,p.y-106,'ИГРОК '+p.id+' ПАЛ','#ff8d7d',125);if(game.players.every(pl=>pl.dead)){game.finished=true;changeScreen('gameover');}}}}
function hitTarget(p,e,atk,scale=1){if(e.dead||e.heldBy)return false;const facing=e.x-p.x;const blocked=e.type==='shield'&&facing*e.face<0&&atk.damage<35&&Math.random()<.75;if(blocked){burst(e.x,e.y-30,'#79d9ff',8,1.6);floating(e.x,e.y-56,'БЛОК','#b8e9ff',33);synth('tail',.3);return false;}
 const riposte=p.riposteT>0?1.7:1;if(p.riposteT>0){p.riposteT=0;floating(p.x,p.y-85,'ОТВЕТНЫЙ УДАР','#d9ffb1',45)}
 let amount=Math.round(atk.damage*(1+(traits(p).damage||0)*.04)*CLASS[p.classId].power*(p.rageT>0?1.35:1)*scale*riposte);if(e.armor)amount=Math.round(amount*(1-e.armor));e.hp-=amount;e.flash=7;e.hurt=13;e.stun=atk.stun;e.ai='stun';const mass=({heavy:1.8,gunner:1.6,shield:1.5,juggernaut:2.4,prototype:2.1,exosuit:2.8})[e.type]||1;e.vx=p.face*atk.knock*.24/mass;e.hitKind=p.attack;e.hitStrength=atk.knock/mass;if(atk.launch){e.juggleHits=(e.juggleHits||0)+1;e.vz=atk.launch*Math.pow(.83,Math.max(0,e.juggleHits-1))}else if(e.z>4&&(e.juggleHits||0)<4){e.juggleHits=(e.juggleHits||0)+1;e.vz=Math.max(e.vz,1.5)}
 impact3D(e.x,e.y,32+(e.z||0),atk===ATTACKS.execution?'execute':'hit',amount>30?1.4:.8);
 game.combo++;game.comboTimer=118;game.maxCombo=Math.max(game.maxCombo,game.combo);records.maxCombo=Math.max(records.maxCombo,game.combo);p.energy=clamp(p.energy+4.8,0,100);addScore(p,Math.round(55*Math.min(8,1+game.combo*.25)));game.hitStop=Math.max(game.hitStop,atk.hitstop||2);game.shake=Math.max(game.shake,atk.hitstop>=4?4:2.2);
 if(settings.damageNumbers)floating(e.x,e.y-54,String(amount),'#fff6b6',39);burst(e.x,e.y-31,amount>30?'#ffc676':'#e9f1ce',9,2.5);impactVFX(e.x,e.y-31,e.type!=='android'&&e.type!=='turret'&&e.type!=='drone',amount>32?1.2:.75);synth(atk.damage>=30?'heavy':'hit',.8);
 if(e.hp<=0){killEnemy(e,p);if(p.attack==='execution'){p.hp=Math.min(p.maxHp,p.hp+18);p.executionCd=120;addScore(p,500);floating(p.x,p.y-85,'ДОБИВАНИЕ +18 ОЗ','#d3ffab',65)}}return true;}
function hitBoss(p,atk,scale=1){const b=game.boss;if(!b||b.dead)return false;const damage=Math.max(1,Math.round(atk.damage*(1+(traits(p).damage||0)*.04)*CLASS[p.classId].power*scale*(p.rageT>0?1.35:1)*.82));b.hp=Math.max(0,b.hp-damage);impact3D(b.x,b.y,85,'hit',1.6);b.flash=9;b.hurt=11;game.combo++;game.comboTimer=115;game.maxCombo=Math.max(game.maxCombo,game.combo);p.energy=clamp(p.energy+5.5,0,100);addScore(p,Math.round(100+game.combo*13));game.hitStop=Math.max(game.hitStop,atk.hitstop||2);game.shake=Math.max(game.shake,4);burst(b.x,b.y-83,'#b9f7a3',14,3.2);if(settings.damageNumbers)floating(b.x,b.y-128,String(damage),'#fff3c8',46);impactVFX(b.x,b.y-89,true,damage>40?1.3:.65);synth('hit');if(b.hp<=0)killBoss();return true;}
function attackProps(p,atk){for(const object of game.props){if(object.dead)continue;const dx=object.x-p.x;if(dx*p.face>-15&&dx*p.face<atk.reach+10&&Math.abs(object.y-p.y)<36){object.hp--;burst(object.x,object.y-16,'#ffd89b',8,2);if(object.hp<=0){object.dead=true;object.breakT=0;synth('boom',.6);addScore(p,80);floating(object.x,object.y-34,'+80','#ffde83',45);burst(object.x,object.y-20,object.type==='terminal'?'#7de4ef':'#dfab74',28,3.2);if(object.type==='barrel')explode(object.x,object.y,71,29,p);else if(Math.random()<.42)game.items.push({x:object.x,y:object.y,type:pick(['med','energy','bonus']),t:900,bob:0});}}}}
function explode(x,y,radius,damage,source){game.flash=Math.max(game.flash,8);game.shake=Math.max(game.shake,7);burst(x,y-25,'#ffb74a',45,4.5);burst(x,y-25,'#e4ee93',10,2.5);synth('boom');for(const e of game.enemies){if(!e.dead&&Math.hypot(e.x-x,(e.y-y)*1.7)<radius){if(source)hitTarget(source,e,{damage,stun:21,knock:22,hitstop:3},1);else{e.hp-=damage;e.stun=26;if(e.hp<=0)killEnemy(e,null);}}}for(const p of game.players){if(!p.dead&&Math.hypot(p.x-x,(p.y-y)*1.7)<radius)damagePlayer(p,damage*.55,x);}for(const obj of game.props){if(obj.type==='barrel'&&!obj.dead&&Math.abs(obj.x-x)<radius*.75){obj.hp=0;obj.dead=true;obj.breakT=0;}}}
// ---------------------------- PLAYER COMBAT --------------------------------
function beginAttack(p,name){const atk=ATTACKS[name];if(!atk||p.dead||p.stun>0||p.dodge>0)return false;
 const cost=(p.classId===2?1-(traits(p).passive||0)*.06:1)*(['acidclaw','predator','ripper','counter'].includes(name)?80:['acidburst','impact','phantom','rage'].includes(name)?35:name==='super'?100:name==='execution'?20:0);
 if(p.energy<cost)return false;p.energy=Math.max(0,p.energy-cost);
 p.recoveryHaste=traits(p).haste||0;p.attack=name;p.attackT=0;p.hitTargets.clear();p.buffer=null;if(name==='counter')p.counterTriggered=false;
 if(name==='claw1'||name==='claw2'||name==='claw3'){p.chain=Number(name.slice(-1));p.chainTick=55;}else if(name!=='air')p.chainTick=Math.min(p.chainTick,28);
 synth(name==='execution'?'execute':name==='launcher'?'launcher':name==='tail'||name==='impact'?'tail':name==='acidburst'?'acid':'claw',.65);return true;}
function tryAttack(p,action){if(p.dead||p.stun>0||p.dodge>0)return false;
 if(action==='parry'){
  if(p.airborne||p.parryCd>0||p.grabTarget||p.attack)return false;
  p.parryT=10;p.parryCd=42;impact3D(p.x+p.face*17,p.y,37,'guard',.6);synth('tail',.25);return true;
 }
 if(action==='execute'){
  if(p.attack||p.airborne||p.grabTarget||p.executionCd>0||p.energy<20)return false;
  const target=game.enemies.find(e=>!e.dead&&!e.heldBy&&e.hp/e.maxHp<=.25&&Math.abs(e.x-p.x)<65&&Math.abs(e.y-p.y)<24&&(e.x-p.x)*p.face>=-8&&e.z<12);
  if(!target)return false;p.executionTarget=target.id;if(!beginAttack(p,'execution'))return false;p.executionCd=90;p.inv=Math.max(p.inv,18);floating(p.x,p.y-88,'ДОБИВАНИЕ','#ffddb2',45);return true;
 }
 const current=p.attack&&ATTACKS[p.attack];
 const recovering=current&&p.attackT>=current.startup+current.active;
 if(action==='dash'){
  if(p.dodgeCd>0||p.airborne||p.grabTarget||(current&&!recovering))return false;
  p.dodge=16;p.perfectDodge=false;p.dodgeCd=Math.round(55*(1-(traits(p).mobility||0)*.04));p.inv=Math.max(p.inv,9);p.attack=null;p.buffer=null;p.dashX=Math.hypot(p.moveX||0,p.moveY||0)>.1?p.moveX:p.face;p.dashY=p.moveY||0;
  const n=Math.max(1,Math.hypot(p.dashX,p.dashY));p.dashX/=n;p.dashY/=n;
  synth('dash');burst(p.x,p.y-15,CLASS[p.classId].color,9,1.7);return true;
 }
 if(action==='jump'){
  if(p.airborne||p.grabTarget||(current&&!recovering))return false;
  p.attack=null;p.vz=5.7;p.airborne=true;p.z=.5;synth('jump');return true;
 }
 if(current){
  // Only late recovery can be cancelled into a combo, never its active hit frames.
  if(!['light','heavy'].includes(action)||!recovering||p.attackT<current.startup+current.active+Math.max(0,current.recovery-7))return false;
 }
 if(action==='grab'){
  if(p.airborne)return false;
  if(p.grabTarget){const e=p.grabTarget;releaseGrab(p);e.stun=22;e.vx=p.face*8;e.vz=3.1;e.thrownBy=p;e.throwT=20;p.throwT=12;e.hp-=23;burst(e.x,e.y-35,'#ffd985',13,3);floating(e.x,e.y-56,'БРОСОК!','#ffe790',40);if(e.hp<=0)killEnemy(e,p);synth('heavy');return true;}
  const e=game.enemies.find(e=>!e.dead&&!e.heldBy&&e.z<8&&(e.x-p.x)*p.face>-8&&Math.abs(e.x-p.x)<34&&Math.abs(e.y-p.y)<23&&e.type!=='turret'&&e.type!=='heavy');
  if(!e)return false;p.grabTarget=e;p.grabTick=100;e.heldBy=p;e.stun=100;floating(e.x,e.y-67,'ЗАХВАТ','#afe9ff',50);synth('select');return true;
 }
 if(p.grabTarget){if(action==='light')return beginAttack(p,'grabbite');if(action==='heavy'||action==='special')return tryAttack(p,'grab');return false;}
 let name=null;
 if(action==='light')name=p.airborne?'air':'claw'+(p.chainTick>0?(p.chain%3)+1:1);
 if(action==='heavy')name=p.airborne?'slam':p.chainTick>0&&p.chain>=2?'finisher':p.chainTick>0&&p.chain===1?'launcher':'tail';
 if(action==='special')name=['acidburst','impact','phantom','rage'][p.classId];
 if(action==='super')name=['acidclaw','predator','ripper','counter'][p.classId];
 return name?beginAttack(p,name):false;
}
function updateAttack(p){if(!p.attack)return;const type=p.attack,atk=ATTACKS[type],t=++p.attackT;
 if(type==='counter'&&t===1)p.counterWindow=26;
 if(type==='ripper'&&t>=atk.startup&&t<atk.startup+atk.active){p.x+=p.face*1.9;if(t%6===0)p.hitTargets.clear();if(t%4===0)burst(p.x+p.face*24,p.y-35,'#afebf7',5,1.5);}
 if(type==='predator'&&t===atk.startup){game.shake=Math.max(game.shake,8);burst(p.x,p.y-7,'#d9b9ff',27,4);}
 if(type==='acidclaw'&&t===atk.startup){game.puddles.push({x:p.x+p.face*69,y:p.y,radius:35,t:175,lastHit:game.tick,owner:p});burst(p.x+p.face*46,p.y-34,'#adff5a',25,3);}
 if(type==='phantom'&&t>=atk.startup&&t<atk.startup+atk.active){p.x+=p.face*5.2;p.inv=Math.max(p.inv,4);if(t%3===0)burst(p.x-p.face*22,p.y-31,CLASS[p.classId].color,3,1.4);}
 if(type==='rage'&&t===atk.startup){p.rageT=360;floating(p.x,p.y-86,'ЯРОСТЬ УЛЬЯ!','#ffdf7b',80);game.flash=8;}
 if(type==='acidburst'&&t===atk.startup){for(let i=-1;i<=1;i++){game.bullets.push({x:p.x+p.face*30,y:p.y-37,depth:p.y+i*11,vx:p.face*(4.8+Math.abs(i)*.2),vy:i*.14,life:75,type:'bioacid',damage:24,owner:p,trail:[]});}burst(p.x+p.face*32,p.y-39,'#acff63',22,2.6);}
 if(type==='grabbite'&&t===atk.startup&&p.grabTarget){const victim=p.grabTarget;victim.heldBy=null;hitTarget(p,victim,atk);if(victim.dead)releaseGrab(p);else victim.heldBy=p;}
 if(t>=atk.startup&&t<atk.startup+atk.active&&(type!=='counter'||p.counterTriggered)){
  for(const e of game.enemies){if(e.dead||p.hitTargets.has(e.id)||type==='execution'&&e.id!==p.executionTarget)continue;const dx=(e.x-p.x)*p.face;const strikeY=p.y-p.z-30,targetFeet=e.y-(e.z||0);if(dx<-18||dx>atk.reach+(p.classId===0?5:0)||Math.abs(e.y-p.y)>atk.depth+(p.classId===0?2:0)||strikeY<targetFeet-76||strikeY>targetFeet+3)continue;p.hitTargets.add(e.id);hitTarget(p,e,atk,type==='phantom'?.78:1);}
  const b=game.boss;if(type!=='execution'&&b&&!b.dead&&!p.hitTargets.has('boss')){const dx=(b.x-p.x)*p.face;if(dx>-63&&dx<atk.reach+48&&Math.abs(b.y-p.y)<atk.depth+25){p.hitTargets.add('boss');hitBoss(p,atk);}}
  if(t===atk.startup+1){attackProps(p,atk);if(type==='super'){game.flash=12;burst(p.x+p.face*70,p.y-33,CLASS[p.classId].color,50,5);}}
 }
 const end=atk.startup+atk.active+atk.recovery-(traits(p).haste||0);
 if(t>=end){p.attack=null;p.attackT=0;}
}
function applyPlayer(p,input){const oldX=p.x,oldY=p.y;const cls=CLASS[p.classId];if(p.dead){releaseGrab(p);p.inputQueue=null;p.downT++;return;}
 if(p.parryT>0)p.parryT--;if(p.parryCd>0)p.parryCd--;if(p.riposteT>0)p.riposteT--;if(p.executionCd>0)p.executionCd--;
 if(p.inv>0)p.inv--;if(p.counterWindow>0)p.counterWindow--;p.oldHp=lerp(p.oldHp,p.hp,.09);if(p.stun>0)p.stun--;if(p.dodgeCd>0)p.dodgeCd--;if(p.rageT>0)p.rageT--;if(p.chainTick>0)p.chainTick--;else p.chain=0;
 p.energy=clamp(p.energy+(p.rageT>0?.045:.058)*(1+(traits(p).mobility||0)*.08),0,100);
 if(p.grabTarget){const e=p.grabTarget;if(e.dead||e.heldBy!==p){releaseGrab(p);}else{p.grabTick--;e.x=p.x+p.face*25;e.y=p.y+3;e.z=0;if(p.grabTick<=0)releaseGrab(p);}}
 let mx=clamp(input.x||0,-1,1),my=clamp(input.y||0,-1,1);const magnitude=Math.max(1,Math.hypot(mx,my));mx/=magnitude;my/=magnitude;
 p.crawling=!!input.crawl&&!p.airborne;p.moveX=mx;p.moveY=my;if(Math.abs(mx)>.16&&!p.attack&&!p.dodge)p.face=mx>0?1:-1;
 queueCommands(p,input);
 for(const [action,until] of p.inputQueue){if(performance.now()>until||tryAttack(p,action))p.inputQueue.delete(action);}
 if(p.dodge>0){p.dodge--;p.z=Math.sin((16-p.dodge)/16*Math.PI)*4;p.x+=(p.dashX??p.face)*4.0;p.y+=(p.dashY||0)*2.4;if(p.dodge%3===0)burst(p.x,p.y-14,'#a3dceb',2,.75);}
 else if(p.stun>0){if(!p.airborne)p.z=0;p.x+=p.vx;p.vx*=.84;}
 else{if(!p.airborne)p.z=0;const mult=(p.attack?.62:1)*(p.crawling?.52:1);const slow=(p.grabTarget?.6:1)*(p.slowT>0?.65:1);p.x+=mx*cls.speed*(1+(traits(p).speed||0)*.03)*mult*slow;p.y+=my*cls.speed*(1+(traits(p).speed||0)*.03)*.60*mult*slow;p.walking+=Math.hypot(mx,my)*.21;}
 if(p.airborne){p.z+=p.vz;p.vz-=.29;if(p.z<=0){p.z=0;p.vz=0;p.airborne=false;p.landingT=7;synth('land',.45);burst(p.x,p.y-2,'#89999c',5,1);}}
 if(p.landingT>0)p.landingT--;if(p.throwT>0)p.throwT--;if(p.slowT>0)p.slowT--;
 updateAttack(p);
 // Clamp after attack-root motion too: phantom/ripper may never move through gates.
 const lev=LEVELS[game.level],cap=game.waveActive?game.gateX:lev.length-40;
 const floor=game.waveActive&&Number.isFinite(game.arenaMin)?Math.max(23,game.arenaMin):game.boss&&!game.boss.dead?Math.max(23,lev.length-580):23;
 p.x=clamp(p.x,floor,Math.min(lev.length-40,cap));p.y=clamp(p.y,190,244);
 if(p.attack&&game.tick%4===0&&p.attackT>0&&p.attackT<20)p.trail.push({x:p.x,y:p.y-p.z,t:9,row:ATTACKS[p.attack].anim,frame:clamp(Math.floor(p.attackT/3),0,9)});p.trail=p.trail.filter(a=>--a.t>0).slice(-5);p.anim++;p.motionVX=p.x-oldX;p.motionVY=p.y-oldY;if(!p.airborne&&!p.attack&&!p.dodge&&!p.stun){const stride=[.86,.82,1.18,.78][p.classId]*44*cls.scale,old=p.travel||0;p.travel=old+Math.hypot(p.motionVX,p.motionVY*2);if(Math.floor(old/stride)!==Math.floor(p.travel/stride))synth('step',p.classId===3?.25:.16);}
}
// ------------------------------ ENEMY AI -----------------------------------
function targetPlayer(e){let best=null,dist=Infinity;for(const p of game.players){if(p.dead)continue;const d=Math.abs(p.x-e.x)+Math.abs(p.y-e.y)*1.6;if(d<dist){dist=d;best=p;}}return best;}
function spawnShot(e,t){
 if(e.reload>0||e.ammo<=0||e.x<game.camera+8||e.x>game.camera+W-8||Math.abs(t.x-e.x)>225)return;
 const cfg=ENEMY[e.type];e.ammo--;const x=e.x+e.face*36,y=e.y-50;
 if(e.type==='grenadier'||e.type==='exosuit'){
  game.bullets.push({x,y,depth:e.y,vx:e.face*2.25,vy:(t.y-e.y)/58,life:65,type:'grenade',damage:cfg.damage,owner:null,explosionX:clamp(t.x,game.arenaMin||23,Math.min(LEVELS[game.level].length-35,game.gateX)),explosionY:t.y,gravity:0,flight:0});
 }else if(e.type==='flame'){
  for(let i=-2;i<=2;i++)game.bullets.push({x,y:y+i*2,depth:e.y+i*10,vx:e.face*(2.5+Math.abs(i)*.25),vy:i*.17,life:37,type:'fire',damage:cfg.damage/3,owner:null});
 }else{
  for(let i=0;i<(e.type==='heavy'?3:1);i++)game.bullets.push({x:x+i*e.face*3,y:y+i*1.5,depth:lerp(e.y,t.y,.75),vx:e.face*(e.type==='heavy'?3.7:e.type==='gunner'?4.4:3.2),vy:(t.y-e.y)*.012,life:95,type:'shot',damage:cfg.damage*(e.type==='heavy'?.46:1),owner:null});
 }
 e.fire=8;if(['gunner','marine','heavy','assault'].includes(e.type)){for(let k=0;k<2&&game.particles.length<300;k++)game.particles.push({x:e.x+e.face*6,y:e.y-44,vx:-e.face*rand(.6,1.9),vy:-rand(1,2.1),t:rand(22,42),maxT:42,size:1.4,color:'#cab777',gravity:.15});}
 burst(x,y,'#ffe080',e.type==='flame'?12:5,1.6);synth(({flame:'flame',gunner:'gunner',turret:'turret',grenadier:'grenade',exosuit:'grenade'}[e.type]||'rifle'),.48);
}
function enemyAttack(e,target){
 const cfg=ENEMY[e.type],victim=targetPlayer(e),dx=(victim||target).x-e.x,dy=(victim||target).y-e.y;
 if(['juggernaut','prototype'].includes(e.type)){
  const radius=e.type==='prototype'?95:68;burst(e.x,e.y-8,e.type==='prototype'?'#7ef5ff':'#ffb96c',24,3);synth(e.type==='prototype'?'electric':'heavy',.7);
  for(const p of game.players)if(!p.dead&&p.z<20&&Math.abs(p.x-e.x)<radius&&Math.abs(p.y-e.y)<30)damagePlayer(p,cfg.damage,e.x);
 }else if(['turret','grenadier','marine','heavy','flame','gunner','medic','drone','assault','engineer','exosuit'].includes(e.type)){
  if(e.type==='assault'&&Math.abs(dx)<42&&Math.abs(dy)<24){if(victim&&victim.z<20)damagePlayer(victim,cfg.damage+4,e.x);synth('heavy',.45);}
  else{spawnShot(e,target);if(['gunner','assault','exosuit'].includes(e.type)){e.burstShots=Math.min(e.ammo,e.type==='gunner'?5:e.type==='exosuit'?1:2);e.burstTimer=e.type==='exosuit'?22:9;}}
 }else if(victim&&Math.abs(dx)<54&&Math.abs(dy)<29&&victim.z<25){damagePlayer(victim,cfg.damage,e.x);if(e.type==='android')burst(e.x+e.face*25,e.y-31,'#75ecff',18,2);}
}
function updateEnemy(e){
 if(e.dead){e.deathT++;if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<0){e.z=0;e.vz=0;}}return;}
 const level=LEVELS[game.level],min=game.waveActive||game.boss&&!game.boss.dead?game.arenaMin:23,max=game.waveActive?game.gateX:level.length-23;
 // Recover invalid positions and enemies knocked out of an encounter without silently killing them.
 if(!Number.isFinite(e.x)||!Number.isFinite(e.y)){e.x=clamp(game.camera+W-65,min,max);e.y=220;e.vx=0;e.stun=25;}
 e.x=clamp(e.x,min,max);e.y=clamp(e.y,191,243);
 if(e.heldBy)return;
 const cfg=ENEMY[e.type];
 if(e.flash>0)e.flash--;if(e.hurt>0)e.hurt--;if(e.fire>0)e.fire--;if(e.motionRecover>0)e.motionRecover--;e.walk+=.12;
 if(e.spawnT>0){e.spawnT--;return;}
 if(e.type==='drone'){e.z=35+Math.sin(game.tick*.075+e.id*3)*7;e.vz=0;}else if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<=0){e.z=0;e.vz=0;e.juggleHits=0;}}
 e.x=clamp(e.x+e.vx,min,max);e.vx*=.78;
 if(e.throwT>0&&e.thrownBy){if(e.throwT===20)e.throwHits=new Set();e.throwT--;for(const other of game.enemies)if(other!==e&&!other.dead&&!other.heldBy&&!e.throwHits?.has(other.id)&&Math.abs(other.x-e.x)<28&&Math.abs(other.y-e.y)<20){e.throwHits?.add(other.id);hitTarget(e.thrownBy,other,{damage:18,stun:20,knock:12,hitstop:2},1);}if(e.throwT===0)e.thrownBy=null;}
 if(e.stun>0){e.stun--;e.ai='stun';e.burstShots=0;e.wind=0;e.motionClip=null;e.motionRecover=0;return;}
 if(e.reload>0){e.ai='reload';if(--e.reload===0)e.ammo=cfg.magazine||(e.type==='gunner'?18:6);return;}
 if(e.burstShots>0){if(--e.burstTimer<=0){spawnShot(e,e.lastTarget||targetPlayer(e));e.burstShots--;e.burstTimer=e.type==='exosuit'?22:9;}return;}
 if(e.ammo<=0){e.reload=e.type==='gunner'?105:e.type==='exosuit'?125:80;e.ai='reload';synth('reload',.35);return;}
 if(['medic','engineer'].includes(e.type)&&--e.healCd<=0){
  const ally=game.enemies.filter(a=>a!==e&&!a.dead&&a.hp<a.maxHp*.79&&Math.abs(a.x-e.x)<165&&(e.type==='medic'||['android','turret','drone','juggernaut','prototype','exosuit'].includes(a.type))).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  if(ally){ally.hp=Math.min(ally.maxHp,ally.hp+(e.type==='engineer'?30:22));burst(ally.x,ally.y-42,e.type==='engineer'?'#a9eaff':'#a9f7d4',19,1.5);floating(ally.x,ally.y-70,e.type==='engineer'?'РЕМОНТ +30':'+МЕДИК','#b5ffc8',54);e.ai='healing';e.recover=35;synth('pickup',.45);}e.healCd=190+Math.floor(rand(0,70));
 }
 const target=targetPlayer(e);if(!target)return;
 const dx=target.x-e.x,ad=Math.abs(dx),dy=target.y-e.y;
 if(e.cool>0)e.cool--;if(e.recover>0){e.recover--;e.ai='recover';return;}
 if(e.wind>0){e.wind--;e.ai='windup';if(e.wind<=0){enemyAttack(e,e.lastTarget||target);if(e.motionClip)e.motionRecover=18;e.recover=cfg.elite?50:e.type==='gunner'?52:e.type==='heavy'?33:25;e.cool=Math.round(rand(75,120)*DIFIC[settings.difficulty].frequency);}return;}
 e.face=dx<0?-1:1;
 const visible=e.x>=game.camera+12&&e.x<=game.camera+W-12;
 const attacking=game.enemies.filter(a=>a!==e&&!a.dead&&(a.wind>0||a.burstShots>0)).length;
 const canAttack=visible&&attacking<(game.players.filter(p=>!p.dead).length>1?3:2);
 if(e.type==='turret'){e.ai='aim';if(e.cool<=0&&ad<205&&Math.abs(dy)<43&&canAttack){e.wind=32;e.lastTarget={x:target.x,y:target.y,z:target.z};e.ai='windup';}return;}
 const melee=['shield','android','juggernaut','prototype'].includes(e.type),desired=melee?(cfg.range>54?cfg.range-15:30):e.type==='flame'?72:e.type==='grenadier'?132:e.type==='heavy'?93:e.type==='gunner'?160:['medic','engineer'].includes(e.type)?145:e.type==='drone'?96:e.type==='exosuit'?170:e.type==='assault'?85:113;
 if(ad>desired+18){e.ai='approach';e.x+=Math.sign(dx)*e.speed;if(Math.abs(dy)>10)e.y+=Math.sign(dy)*e.speed*.35;}
 else if(ad<desired-25&&!melee){e.ai='retreat';e.x-=Math.sign(dx)*e.speed*.67;if(Math.abs(dy)>22)e.y+=Math.sign(dy)*e.speed*.35;}
 else{e.ai='position';if(Math.abs(dy)>9)e.y+=Math.sign(dy)*e.speed*.28;else if(melee&&ad<14)e.x-=Math.sign(dx)*.25;}
 // Light separation preserves lanes without ever turning actors into impassable walls.
 for(const other of game.enemies){if(other===e||other.dead||other.heldBy)continue;const sx=e.x-other.x,sy=e.y-other.y;if(Math.abs(sx)<20&&Math.abs(sy)<10){e.y+=(sy>=0?1:-1)*.18;e.x+=(sx>=0?1:-1)*.12;}}
 if(e.cool<=0&&canAttack&&ad<(melee?cfg.range:e.type==='grenadier'?185:e.type==='gunner'?210:190)&&Math.abs(dy)<(melee?27:39)){
  e.wind=e.type==='prototype'?52:e.type==='juggernaut'?43:e.type==='exosuit'?55:e.type==='gunner'?49:e.type==='heavy'?32:e.type==='android'?27:e.type==='grenadier'?39:e.type==='shield'?26:e.type==='flame'?30:25;e.lastTarget={x:target.x,y:target.y,z:target.z};e.ai='windup';e.cool=50;e.motionWind=e.wind;e.motionClip=['shield','android','juggernaut','prototype'].includes(e.type)||e.type==='assault'&&ad<42?(['juggernaut','prototype'].includes(e.type)?'Heavy':'Light1'):null;
 }
 e.x=clamp(e.x,min,max);e.y=clamp(e.y,191,243);
}
function bossProjectile(b,target,phase,kind='acid'){
 const count=kind==='barrage'?5:phase===1?1:3,color=kind==='frost'?'#b7edff':kind==='barrage'?'#ffac60':'#baff6f';
 for(let i=0;i<count;i++){const offset=i-(count-1)/2;game.bullets.push({x:b.x+b.face*35,y:target.y-37+offset*3,depth:clamp(target.y+offset*18,190,244),vx:b.face*(kind==='barrage'?3.7:kind==='frost'?2.7:3.25),vy:0,life:125,type:kind==='frost'?'frost':kind==='barrage'?'rocket':'bossAcid',damage:phase===3?18:14,color,owner:null});}
 burst(b.x+b.face*40,b.y-68,color,19,2.5);synth(kind==='frost'?'electric':kind==='barrage'?'grenade':'acid',.7);
}
function updateBoss(){
 const b=game.boss;if(!b)return;
 if(b.dead){b.deathT=(b.deathT||0)+1;if(game.bossDown>0){game.bossDown--;if(game.bossDown%12===0)burst(b.x+rand(-54,49),b.y-rand(20,130),'#d0ff75',11,3);if(game.bossDown===0)finishStage();}return;}
 const lev=LEVELS[game.level],kind=lev.bossKind||(game.level===1?'siege':game.level===2?'queen':'guardian'),min=lev.length-580,max=lev.length-55;
 b.x=clamp(Number.isFinite(b.x)?b.x:lev.length-160,min,max);b.y=clamp(Number.isFinite(b.y)?b.y:221,192,242);
 b.walk+=.075;if(b.motionRecover>0)b.motionRecover--;if(b.flash>0)b.flash--;if(b.hurt>0)b.hurt--;if(b.telegraph)b.telegraph.ticks=Math.max(0,b.wind);
 const oldPhase=b.phase;b.phase=b.hp<b.maxHp*.28?3:b.hp<b.maxHp*.63?2:1;
 if(oldPhase!==b.phase){b.cool=85;game.flash=17;game.shake=11;game.announcement='ФАЗА '+b.phase+' / '+(b.phase===3?'ГНЕВ УЛЬЯ':'АГРЕССИЯ');game.announceT=108;burst(b.x,b.y-95,'#b6ff81',42,3.6);synth('boss');}
 const target=targetPlayer(b);if(!target)return;const dx=target.x-b.x,dy=target.y-b.y;
 if(b.dashT>0){b.face=b.lockFace;b.dashT--;b.x=clamp(b.x+b.face*(kind==='siege'||kind==='sentinel'?6.8:5.3),min,max);
  if(game.tick%3===0)burst(b.x-b.face*30,b.y-25,kind==='sentinel'?'#f1aa69':'#acff76',5,1.7);
  for(const p of game.players)if(!p.dead&&p.z<35&&!b.dashVictims.has(p.id)&&Math.abs(p.x-b.x)<55&&Math.abs(p.y-b.y)<30){b.dashVictims.add(p.id);damagePlayer(p,kind==='siege'||kind==='sentinel'?24:18,b.x);}
  return;
 }
 if(b.cool>0)b.cool--;
 if(b.wind>0){b.face=b.lockFace;b.wind--;if(b.wind===0){const aim=b.targetLock||target;
  if(['acid','frost','barrage'].includes(b.attackKind))bossProjectile(b,aim,b.phase,b.attackKind);
  else if(b.attackKind==='slam'||b.attackKind==='rupture'){
   const rupture=b.attackKind==='rupture',cx=rupture?aim.x:b.x+b.face*40,cy=rupture?aim.y:b.y,radius=rupture?76:100;
   game.shake=9;game.flash=7;burst(cx,cy-8,rupture?'#baff6b':'#b7e6a3',34,3.8);synth('heavy',.8);
   for(const p of game.players)if(!p.dead&&p.z<23&&Math.abs(p.x-cx)<radius&&Math.abs(p.y-cy)<29)damagePlayer(p,b.phase===3?27:21,b.x);
  }else if(b.attackKind==='tail'){for(const p of game.players)if(!p.dead&&p.z<32&&(p.x-b.x)*b.face>-25&&(p.x-b.x)*b.face<133&&Math.abs(p.y-b.y)<30)damagePlayer(p,20,b.x);}
  else if(b.attackKind==='charge'){b.dashVictims.clear();b.dashT=kind==='siege'||kind==='sentinel'?31:25;game.shake=Math.max(game.shake,6);synth('heavy');}
  else if(b.attackKind==='summon'){
   const active=game.enemies.filter(e=>!e.dead).length;if(active<4){for(let i=0;i<Math.min(2,4-active);i++)game.enemies.push(createEnemy(i===0?'drone':kind==='overlord'?'juggernaut':'android',clamp(b.x+b.face*(100+i*60),min+20,max-20),205+i*22));}burst(b.x,b.y-110,'#be7dff',32,3);
  }
  b.motionRecover=24;b.telegraph=null;b.cool=b.phase===3?88:b.phase===2?110:135;
 }return;}
 b.face=dx<0?-1:1;
 if(Math.abs(dx)>94)b.x=clamp(b.x+Math.sign(dx)*(.36+b.phase*.12),min,max);
 if(Math.abs(dy)>8)b.y=clamp(b.y+Math.sign(dy)*.23,193,241);
 // Bosses move into view before threatening the player; windup locks direction and aim.
 if(b.cool<=0&&b.x>=game.camera-35&&b.x<=game.camera+W+35){
  const near=Math.abs(dx)<122,roll=Math.random();
  if(kind==='cryo')b.attackKind=near?(roll>.45?'slam':'tail'):(b.phase>=2&&roll>.65?'charge':'frost');
  else if(kind==='sentinel')b.attackKind=roll>.62?'charge':near?'slam':'barrage';
  else if(kind==='overlord')b.attackKind=b.phase>=2&&roll>.79?'summon':roll>.4?'rupture':near?'tail':'acid';
  else if(kind==='guardian'&&b.phase>=2&&roll>.64)b.attackKind='charge';
  else if(kind==='siege'&&roll>.58)b.attackKind='charge';
  else if(kind==='queen'&&b.phase>=2&&roll>.76)b.attackKind='summon';
  else b.attackKind=near?(b.phase>=2&&roll>.42?'slam':'tail'):(b.phase>=2&&roll>.73?'slam':'acid');
  b.wind=b.attackKind==='rupture'?58:b.attackKind==='slam'?43:b.attackKind==='tail'?31:b.attackKind==='charge'?40:b.attackKind==='summon'?48:43;
  b.motionWind=b.wind;b.motionClip=({acid:'Special',frost:'Special',barrage:'Special',rupture:'Ultimate',slam:'Heavy',tail:'Heavy',charge:'Heavy',summon:'Victory'})[b.attackKind];b.lockFace=b.face;b.targetLock={x:target.x,y:target.y,z:target.z};
  if(b.attackKind==='slam'||b.attackKind==='rupture')b.telegraph={x:b.attackKind==='rupture'?target.x:b.x+b.face*40,y:b.attackKind==='rupture'?target.y:b.y,kind:b.attackKind,ticks:b.wind};
  floating(b.x,b.y-143,{acid:'КИСЛОТА!',frost:'КРИОЗАЛП!',barrage:'РАКЕТНЫЙ ЗАЛП!',rupture:'КИСЛОТНЫЙ РАЗЛОМ!',slam:'УДАР О ЗЕМЛЮ!',tail:'ВЗМАХ ХВОСТОМ!',charge:'ТАРАН!',summon:'ПОДКРЕПЛЕНИЕ УЛЬЯ!'}[b.attackKind],'#ffdc9b',50);
 }
}
function damageBullet(b){if(b.type==='grenade'){explode(b.explosionX,b.explosionY,70,b.damage,null);return;}if(b.type==='bioacid'){game.puddles.push({x:b.x,y:b.depth,radius:32,t:160,lastHit:-100,owner:b.owner});burst(b.x,b.y,'#baff6b',20,2);return;}}
function updateBullets(){const g=game;
 for(let i=g.bullets.length-1;i>=0;i--){const b=g.bullets[i],oldX=b.x;b.x+=b.vx;b.y+=b.vy||0;b.life--;
  if(b.type==='grenade'){b.flight++;b.y-=Math.sin(Math.PI*b.flight/65)*.18;}
  if((b.type==='bioacid'||b.type==='bossAcid')&&g.tick%3===0)burst(b.x,b.y,'#bbff72',2,.6);
  if(b.type==='grenade'&&b.life<=0){damageBullet(b);g.bullets.splice(i,1);continue;}
  const crossed=(x,r)=>x>=Math.min(oldX,b.x)-r&&x<=Math.max(oldX,b.x)+r;
  let consumed=false;
  if(b.type==='bioacid'){
   for(const e of g.enemies){if(!e.dead&&crossed(e.x,17)&&Math.abs(e.y-b.depth)<26&&Math.abs(b.y-(e.y-(e.z||0)-32))<38){hitTarget(b.owner,e,{damage:b.damage,stun:9,knock:8,hitstop:2},1);consumed=true;break;}}
   const boss=g.boss;if(!consumed&&boss&&!boss.dead&&crossed(boss.x,60)&&Math.abs(boss.y-b.depth)<48&&Math.abs(b.y-(boss.y-(boss.z||0)-70))<75){hitBoss(b.owner,{damage:b.damage,stun:4,knock:0,hitstop:2},.85);consumed=true;}
   if(consumed||b.life<=0){damageBullet(b);g.bullets.splice(i,1);continue;}
  }else if(b.type!=='grenade'){
   for(const p of g.players){
    // World depth (y) and jump height (z) are independent. A high jump clears a chest-height shot.
    const feet=p.y-(p.z||0),top=feet-(p.crawling?40:64);
    if(!p.dead&&crossed(p.x,p.classId===0?16:14)&&Math.abs((b.depth??p.y)-p.y)<23&&b.y>=top&&b.y<=feet-5){
     damagePlayer(p,b.damage,oldX);burst(b.x,b.y,b.type==='fire'?'#ffbd56':'#b8ff79',7,2);consumed=true;
     if(b.type==='rocket')explode(b.x,b.depth??p.y,48,b.damage*.6,null);break;
    }
   }
  }
  if(consumed||b.life<=0||b.x<g.camera-110||b.x>g.camera+W+150)g.bullets.splice(i,1);
 }
 if(g.bullets.length>240)g.bullets.splice(0,g.bullets.length-240);
}
function updatePuddles(){for(let i=game.puddles.length-1;i>=0;i--){const a=game.puddles[i];a.t--;if(a.t<0){game.puddles.splice(i,1);continue;}if(game.tick%26===0){for(const e of game.enemies){if(!e.dead&&Math.abs(e.x-a.x)<a.radius&&Math.abs(e.y-a.y)<22){e.hp-=8;e.hurt=5;burst(e.x,e.y-6,'#b7fd6b',4,1);if(e.hp<=0)killEnemy(e,a.owner);}}}}}
function updateHazards(){for(const h of game.hazards){
 h.timer++;const period=h.period||190,activeTicks=h.activeTicks||(h.type==='steam'?58:45),cycle=h.timer%period;
 h.active=cycle<activeTicks;h.warning=cycle>=period-35;
 if(cycle===0&&Math.abs(h.x-(game.camera+W/2))<W/2)synth(h.type==='steam'?'steam':'electric',.3);
 if(h.active&&game.tick%25===0)for(const p of game.players){if(!p.dead&&p.z<23&&Math.abs(p.x-h.x)<(h.type==='electric'?32:24)&&Math.abs(p.y-h.y)<26){damagePlayer(p,h.damage||(h.type==='electric'?10:7),h.x);if(h.slow)p.slowT=Math.max(p.slowT||0,h.slow);}}
}}
function updateLevelEvents(center){
 const g=game,level=LEVELS[g.level],events=level.events||[{x:850,text:level.banners[1],kind:g.level===2?'acid':'alarm'}];
 if(g.eventPulse>0)g.eventPulse--;
 const event=events[g.eventIndex||0];if(!event||center<event.x)return;
 g.eventIndex=(g.eventIndex||0)+1;g.eventPulse=160;g.eventKind=event.kind;g.eventText=event.text;g.announcement=event.text;g.announceT=120;synth(event.kind==='airlock'?'door':'boss',.35);
 // Local pressure/energy change is announced before any nearby vent becomes active.
 for(const h of g.hazards)if(Math.abs(h.x-event.x)<240)h.timer=(h.period||190)-35;
 burst(event.x,190,event.kind==='acid'?'#baff72':event.kind==='pressure'?'#a9eaff':'#ffd78b',15,1.7);
}
function recoverEncounter(){
 const g=game;if(g.waveActive)g.waveTick=(g.waveTick||0)+1;
 for(const e of g.enemies){
  if(!ENEMY[e.type]){e.type='marine';e.armor=0;}
  if(e.dead)continue;
  if(!Number.isFinite(e.hp)){e.hp=e.maxHp||ENEMY[e.type].hp;e.stun=30;}
  if(e.hp<=0){killEnemy(e,null);continue;}
  if(e.heldBy&&(e.heldBy.dead||e.heldBy.grabTarget!==e)){e.heldBy=null;e.stun=25;}
  if(!Number.isFinite(e.x)||!Number.isFinite(e.y)){e.x=clamp(g.camera+W-65,g.arenaMin||23,g.waveActive?g.gateX:LEVELS[g.level].length-35);e.y=220;e.vx=0;e.stun=30;}
 }
 // Corpse retention is bounded independently from live enemy count.
 g.enemies=g.enemies.filter(e=>!e.dead||e.deathT<150);
}
function updateItems(){for(let i=game.items.length-1;i>=0;i--){const it=game.items[i];it.t--;it.bob+=.065;if(it.t<=0){game.items.splice(i,1);continue;}for(const p of game.players){if(p.dead||Math.abs(p.x-it.x)>23||Math.abs(p.y-it.y)>21)continue;
 switch(it.type){case 'med':p.hp=Math.min(p.maxHp,p.hp+Math.ceil(p.maxHp*.28));break;case 'energy':p.energy=clamp(p.energy+48,0,100);break;case 'bonus':addScore(p,1000);break;case 'shield':p.inv=Math.max(p.inv,125);break;}
 floating(it.x,it.y-40,{med:'АПТЕЧКА +HP',energy:'БИО-ЭНЕРГИЯ',bonus:'ДАННЫЕ +1000',shield:'ВРЕМЕННЫЙ ЩИТ'}[it.type],'#e8ff99',62);game.uniqueItems++;synth('pickup');game.items.splice(i,1);break;
 }} }
function updateEffects(){const g=game;if(g.impacts)g.impacts=g.impacts.filter(h=>--h.t>0);for(const o of g.props){if(o.dead)o.breakT=Math.min(30,(o.breakT||0)+1);}for(let i=g.blood.length-1;i>=0;i--){if(--g.blood[i].t<=0)g.blood.splice(i,1);}for(let i=g.decals.length-1;i>=0;i--){if(--g.decals[i].life<=0)g.decals.splice(i,1);} for(let i=g.particles.length-1;i>=0;i--){const q=g.particles[i];q.x+=q.vx;q.y+=q.vy;q.vy+=q.gravity||.07;q.vx*=.986;q.t--;if(q.t<=0)g.particles.splice(i,1);}for(let i=g.texts.length-1;i>=0;i--){const t=g.texts[i];t.y-=.38;t.t--;if(t.t<=0)g.texts.splice(i,1);}g.shake*=.86;if(g.shake<.25)g.shake=0;if(g.flash>0)g.flash--;if(g.announceT>0)g.announceT--;if(g.stageBanner>0)g.stageBanner--;if(g.comboTimer>0)g.comboTimer--;else g.combo=0;
 if(g.tick%60===0){records.maxCombo=Math.max(records.maxCombo,g.maxCombo);}
}
function finishStage(){if(game.finished)return;game.finished=true;const g=game;g.stageBonus=Math.round(Math.max(0,7000-g.levelTime*2.1));const living=g.players.filter(p=>!p.dead);const bonusTo= living.length?living:g.players;bonusTo.forEach(p=>addScore(p,Math.round(g.stageBonus/bonusTo.length)));g.players.forEach(p=>p.celebrating=true);g.stats.push({name:LEVELS[g.level].name,time:Math.round(g.levelTime/60),kills:g.stageKills,score:g.score,combo:g.maxCombo});records.stage=Math.max(records.stage,g.level+1);records.wins++;save('records',records);changeScreen('stageclear');synth('pickup',1.3);}
function advanceStage(){if(!game)return;if(game.level<LEVELS.length-1){startStage(game.level+1);changeScreen('playing');}else{changeScreen('victory');}}
function resolveBodyContacts(){
 const g=game,alive=g.enemies.filter(e=>!e.dead&&!e.heldBy&&(e.z||0)<12);
 for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
  const a=alive[i],b=alive[j],dx=b.x-a.x,dy=(b.y-a.y)*2,d=Math.hypot(dx,dy),r=18+((ENEMY[a.type].scale||1)+(ENEMY[b.type].scale||1)-2)*5;
  if(d>=r)continue;const push=Math.min(1.4,(r-d)*.25),nx=d>.001?dx/d:(i%2?1:-1),ny=d>.001?dy/d:.5;
  if(a.type!=='turret'){a.x-=nx*push;a.y-=ny*push*.5}if(b.type!=='turret'){b.x+=nx*push;b.y+=ny*push*.5}
 }
 for(const p of g.players){
  if(p.dead||p.airborne||p.z>12||p.dodge>0||p.attack==='phantom')continue;
  for(const e of alive){const dx=e.x-p.x,dy=(e.y-p.y)*2,d=Math.hypot(dx,dy),radius=17+(ENEMY[e.type].scale||1)*2;if(d>=radius)continue;
   const nx=d>.01?dx/d:p.face,ny=d>.01?dy/d:0,push=Math.min(2.0,(radius-d)*.45),fixed=e.type==='turret',heavy=['heavy','juggernaut','prototype','exosuit'].includes(e.type),share=fixed?1:heavy?.4:.12;
   p.x-=nx*push*share;p.y-=ny*push*share*.5;if(!fixed){e.x+=nx*push*(1-share);e.y+=ny*push*(1-share)*.5}
  }
  const min=g.waveActive||g.boss&&!g.boss.dead?g.arenaMin:23,max=g.waveActive?g.gateX:LEVELS[g.level].length-40;p.x=clamp(p.x,min,max);p.y=clamp(p.y,190,244);
 }
 for(const e of alive){const min=g.waveActive||g.boss&&!g.boss.dead?g.arenaMin:23,max=g.waveActive?g.gateX:LEVELS[g.level].length-23;e.x=clamp(e.x,min,max);e.y=clamp(e.y,191,243)}
}
function tickGame(){if(!game)return;const g=game;if(screen!=='playing')return;g.tick++;g.levelTime++;
 const ins=captureInputs();if(ins.some(v=>v.pause)){changeScreen('paused');menuIndex=0;resetInput();return;}
 if(g.hitStop>0){g.players.forEach((p,i)=>queueCommands(p,ins[i]||{}));g.hitStop--;updateEffects();return;}
 g.players.forEach((p,i)=>applyPlayer(p,ins[i]||{x:0,y:0}));
 if(g.boss?.dead){updateBoss();updateEffects();return;}
 const center=g.players.filter(p=>!p.dead).reduce((sum,p)=>sum+p.x,0)/Math.max(1,g.players.filter(p=>!p.dead).length);
 if(coop&&joined&&g.players.length===2&&g.players.every(p=>!p.dead)){let [a,b]=g.players;if(Math.abs(a.x-b.x)>370){const leader=a.x>b.x?a:b,lagger=a.x>b.x?b:a;leader.x=clamp(leader.x,lagger.x-370,lagger.x+370);}}
 const lvl=LEVELS[g.level];updateLevelEvents(center);recoverEncounter();const wave=lvl.waves[g.waveIndex];
 if(!g.waveActive&&!g.boss&&wave&&center>=wave.x)spawnWave(wave);
 for(const e of g.enemies){const x=e.x,y=e.y;updateEnemy(e);e.motionVX=e.x-x;e.motionVY=e.y-y;if(!e.dead&&!e.stun)e.travel=(e.travel||0)+Math.hypot(e.motionVX,e.motionVY*2);}
 resolveBodyContacts();if(g.waveActive&&g.enemies.every(e=>e.dead)){g.waveActive=false;g.gateX=Infinity;g.arenaMin=23;g.announcement='СЕКТОР ОЧИЩЕН  //  ВПЕРЁД';g.announceT=62;g.players.forEach(p=>addScore(p,350));synth('pickup');}
 if(g.enemies.length>48)g.enemies=g.enemies.filter(e=>!e.dead||e.deathT<120);
 if(g.waveIndex>=lvl.waves.length&&!g.waveActive&&!g.boss&&center>lvl.length-690)spawnBoss();
 const bossOld= g.boss?{x:g.boss.x,y:g.boss.y}:null;updateBoss();if(g.boss&&bossOld){g.boss.motionVX=g.boss.x-bossOld.x;g.boss.motionVY=g.boss.y-bossOld.y;g.boss.travel=(g.boss.travel||0)+Math.hypot(g.boss.motionVX,g.boss.motionVY*2);}updateBullets();updatePuddles();updateHazards();updateItems();updateEffects();
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
 const mov=camera*.32,wrap=(v,period)=>((v%period)+period)%period;
 if(level===0){
  // Containment glass with fixed rivets and animated specimen holograms.
  for(let i=0;i<4;i++){
   const x=wrap(i*210-mov,840)-105;
   R(x-37,48,75,123,'#07131e');R(x-34,51,69,116,'#193c4a');R(x-30,55,61,107,'#082735');
   R(x-28,57,2,102,'#4b8f9e');R(x+27,57,2,102,'#386f7a');
   for(let n=0;n<5;n++){R(x-31+n*15,49,2,2,'#8aa4ad');R(x-31+n*15,168,2,2,'#728b91');}
   ellipse(x,146,24,5,'#1b5160');R(x-23,145,46,2,'#4f9ba8');
   if(settings.pixel3d)softwareMesh(meshOcta,x,101,16,tick*.009+i,'#69d6db','wire');
   else{R(x-8,83,16,34,'#23566c');R(x-5,80,10,6,'#54a6ad');}
   L(x-24,58,x+10,58,'#8fc7cd');L(x+25,60,x+25,139,'#447584');
   for(let n=0;n<4;n++)R(x-20,155+n*2,12+n*4,1,n===0?'#82d2c4':'#386877');
  }
 }else if(level===1){
  // Weapon cages, ammunition elevators and amber inspection bars.
  for(let i=0;i<5;i++){
   const x=wrap(i*190-mov,950)-92;
   R(x-39,65,80,105,'#0b1723');R(x-36,68,74,99,'#28333c');
   for(let row=0;row<3;row++){
    const y=75+row*28;R(x-33,y+20,68,3,'#62727a');R(x-33,y+23,68,2,'#121e28');
    for(let n=0;n<3;n++){const xx=x-27+n*23;R(xx,y+6,15,14,'#514d37');R(xx+2,y+7,11,2,'#b5a166');R(xx+5,y+1,4,8,'#7a7e73');R(xx+5,y+10,5,6,'#313d43');}
   }
   for(let n=0;n<5;n++)R(x-36+n*17,69,1,97,'#14242c');
   R(x-40,62,82,4,'#8b784e');R(x-29,54,59,6,'#a3673e');R(x-25,55,51,2,'#efc274');
   if(settings.pixel3d)softwareMesh(meshCube,x+51,137,10,tick*.004+i,'#c4a15f');
  }
 }else if(level===2){
  for(let i=0;i<4;i++){
   const x=wrap(i*260-mov,1040)-110;
   R(x-47,54,94,117,'#100e20');R(x-43,58,86,110,'#2b2035');R(x-37,65,74,97,'#131b2a');
   for(let n=0;n<5;n++){R(x-40,64+n*21,6,3,'#ae6c9b');R(x+35,64+n*21,6,3,'#ae6c9b');}
   if(settings.pixel3d){torusRing(x,108,32,24,tick*.019+i,'#b361ac');torusRing(x,108,21,13,-tick*.027-i,'#5fe5bf');softwareMesh(meshCube,x,108,13,tick*.015+i,'#9de7bd','wire');}
   else{ellipse(x,106,24,32,'#3a3050');ellipse(x,106,17,24,'#163b3f');R(x-4,82,8,48,'#66bd9c');}
   if(settings.ambient>0)glow(x,105,44,'#af54a8',.11);
  }
  for(let i=0;i<8;i++){const x=wrap(i*141-camera*.41,1128)-35;ctx.strokeStyle=i%2?'#5e275e':'#203f3c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x,177);ctx.bezierCurveTo(x-30,123,x+37,93,x+3,46);ctx.stroke();}
 }else if(level===3){
  // Recessed cryogenic sarcophagi. Ice stays on the glass; the lane stays clear.
  for(let i=0;i<6;i++){
   const x=wrap(i*128-mov,768)-64;
   R(x-28,47,57,125,'#091a2a');R(x-25,50,51,119,'#52788a');R(x-21,54,43,108,'#123449');
   R(x-19,57,39,3,'#b3e6ea');R(x-18,61,2,92,'#79b8c6');R(x+16,63,2,86,'#386f85');
   ellipse(x,88,8,10,'#254f65');R(x-9,98,18,34,'#28536b');R(x-8,131,6,22,'#1b3c51');R(x+2,131,6,22,'#1b3c51');
   for(let n=0;n<6;n++){const yy=65+n*15;L(x-18,yy,x-8+(n%3)*3,yy+8,'#79b3c5');L(x+18,yy+3,x+9,yy+11,'#438196');}
   R(x-25,160,51,8,'#173341');R(x-18,162,17,2,'#9edbd3');R(x+10,162,5,2,'#8ddbe0');
   if(settings.ambient>0){ctx.save();ctx.globalAlpha=.10;ellipse(x,138-Math.sin(tick*.012+i)*12,19,26,'#c2e9ec');ctx.restore();}
  }
  if(settings.pixel3d)softwareMesh(meshOcta,wrap(396-mov*.7,680)-70,78,12,tick*.009,'#8cdde9','wire');
 }else if(level===4){
  // Observation dock: a slow planet and stars beyond a reinforced gantry.
  R(0,41,W,126,'#050b1c');
  for(let i=0;i<40;i++){const x=wrap(i*73-camera*.035,W+10)-5,y=47+(i*31)%109;R(x,y,i%11===0?2:1,1,i%3?'#526b8b':'#c7d6e6');}
  ellipse(372-camera*.015%170,105,66,47,'#172b47');ellipse(364-camera*.015%170,99,61,42,'#2b4d65');
  for(let i=0;i<7;i++)L(330-camera*.015%170+i*5,74+i*7,394-camera*.015%170,84+i*7,'#32586d',2);
  for(let i=0;i<5;i++){
   const x=wrap(i*180-mov,900)-50;
   R(x,38,10,136,'#152332');R(x+2,40,3,130,'#5c7080');L(x+9,48,x+172,158,'#1b2c3b',5);L(x+12,48,x+172,156,'#3c5264',1);
   R(x-9,163,165,8,'#111e2b');R(x-9,163,165,2,'#6f8390');
   if(settings.pixel3d)softwareMesh(meshCube,x+70,127,18,.23+i*.47,'#778c9b');
   else{R(x+51,110,38,34,'#344a5a');R(x+53,112,34,3,'#82939d');R(x+56,119,3,20,'#172d3b');}
   R(x+35,61,57,6,'#8d5e32');R(x+38,62,51,2,'#ffd08b');
  }
 }else{
  // Organic vault: asymmetrical ribs and a pulsing heart deep behind the lane.
  R(0,42,W,132,'#110f1b');
  for(let i=0;i<7;i++){
   const x=wrap(i*116-mov,812)-60;
   ctx.lineWidth=11;ctx.strokeStyle='#28303b';ctx.beginPath();ctx.moveTo(x-39,173);ctx.bezierCurveTo(x-45,125,x-27,68,x+3,48);ctx.stroke();
   ctx.lineWidth=3;ctx.strokeStyle='#646375';ctx.beginPath();ctx.moveTo(x-42,169);ctx.bezierCurveTo(x-45,124,x-24,67,x+4,48);ctx.stroke();
   for(let n=0;n<5;n++){const yy=81+n*17;L(x-39,yy,x-27,yy+3,'#343648',2);}
   ellipse(x+17,149,14,23,'#22242b');ellipse(x+15,146,10,19,'#39403d');L(x+13,129,x+19,150,'#7d8054',2);L(x+19,150,x+13,165,'#5e7656',1);
   if(settings.ambient>0)glow(x+12,147,27,'#a4b861',.08);
  }
  const xx=wrap(310-mov*.45,800)-90,beat=1+Math.sin(tick*.045)*.025;
  ellipse(xx,107,25*beat,39*beat,'#37443b');ellipse(xx-5,103,14*beat,28*beat,'#55705b');
  for(let n=0;n<5;n++)L(xx-18,85+n*10,xx+14,90+n*10,'#172d28',2);
  if(settings.pixel3d)softwareMesh(meshOcta,xx,106,10,tick*.006,'#97b579','wire');
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
// Monochrome Cyrillic atlas: fixed baseline, exact codepoint mapping and integer scale.
const FONT_COLS=16;
const FONT_CHARS=" АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯЁабвгдежзийклмнопрстуфхцчшщъыьэюяёABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?+-*/%()[]{}<>=\"'№#&_|\\@$—–•▶◀↑↓←→…−";
const FONT_INDEX=Object.fromEntries(Array.from(FONT_CHARS).map((ch,i)=>[ch,i]));
const fontTints=new Map();
function getFontTint(color){
 const key=color.toLowerCase();let tinted=fontTints.get(key);
 if(!tinted){tinted=document.createElement('canvas');tinted.width=A.font.naturalWidth;tinted.height=A.font.naturalHeight;
 const tc=tinted.getContext('2d');tc.imageSmoothingEnabled=false;tc.drawImage(A.font,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle=color;tc.fillRect(0,0,tinted.width,tinted.height);
 if(fontTints.size>=48)fontTints.delete(fontTints.keys().next().value);fontTints.set(key,tinted);}
 return tinted;
}
function textScale(size){return size>=26?3:size>=17?2:1;}
function textWidth(str,size=7){return Array.from(String(str)).length*7*textScale(size);}
function T(str,x,y,size=7,color='#f1f5ee',align='left'){
 str=String(str);x=Math.round(x);y=Math.round(y);const mult=textScale(size),dw=7*mult,dh=12*mult;
 const width=textWidth(str,size);if(align==='center')x-=Math.round(width/2);else if(align==='right')x-=width;
 if(activeImage('font')){const tinted=getFontTint(color),shadow=getFontTint('#030810');ctx.imageSmoothingEnabled=false;
 for(const ch of str){const ci=FONT_INDEX[ch]??FONT_INDEX['?'],sx=ci%FONT_COLS*7,sy=Math.floor(ci/FONT_COLS)*12;
 ctx.drawImage(shadow,sx,sy,7,12,x+mult,y+mult,dw,dh);ctx.drawImage(tinted,sx,sy,7,12,x,y,dw,dh);x+=dw;}return;}
 ctx.textBaseline='top';ctx.textAlign='left';ctx.font=`${10*mult}px "DejaVu Sans Mono",monospace`;ctx.fillStyle=color;ctx.fillText(str,x,y);
}
function wrappedText(str,x,y,maxWidth,size=7,color='#d8e9e9',align='left'){
 const maxChars=Math.max(1,Math.floor(maxWidth/(7*textScale(size))));let line='',row=0;
 for(const word of String(str).split(' ')){if(line&&(line+' '+word).length>maxChars){T(line,x,y+row*13*textScale(size),size,color,align);row++;line=word;}else line+=(line?' ':'')+word;}
 if(line)T(line,x,y+row*13*textScale(size),size,color,align);return row+1;
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
function background(level,camera,tick,menu=false){
 const lev=LEVELS[level];R(0,0,W,H,'#04101b');const name=lev.wall;
 if(activeImage(name)){const im=A[name],tw=500,th=223,start=-((camera*.24)%tw);for(let x=start-tw;x<W+tw;x+=tw)ctx.drawImage(im,Math.round(x),4,tw,th);}
 else{for(let i=0;i<10;i++){R(i*60,19,48,167,'#1a3543');R(i*60+6,20,4,155,'#5b7381');}}
 const tint=['rgba(0,28,41,.25)','rgba(39,19,11,.27)','rgba(57,6,38,.30)','rgba(8,38,67,.38)','rgba(6,12,29,.50)','rgba(22,26,23,.55)'][level]||'rgba(0,28,41,.25)';
 R(0,34,W,143,tint);drawSectorArt(level,camera,tick);
 // Nearer cable trays and ceiling beams create a separate parallax plane.
 R(0,29,W,8,'#07121e');R(0,37,W,2,'#47616f');
 for(let i=0;i<7;i++){
  const x=((i*141-camera*.57)%987+987)%987-80;
  R(x,39,7,134,'#0b1e2c');R(x+1,39,2,132,'#4e6979');R(x+7,39,2,134,'#07121c');
  R(x-3,54,13,3,'#69828d');R(x-3,149,13,3,'#405563');
  L(x+9,42,x+53,42,'#182c38',2);L(x+53,42,x+57,53,'#182c38',2);
  R(x+14,38,33,4,'#283b47');R(x+19,39,23,1,lev.tone);
 }
 R(0,176,W,3,'#91a6af');R(0,179,W,3,'#152b3a');
 const offset=Math.floor(camera)%floorCanvas.width;ctx.drawImage(floorCanvas,-offset,181);ctx.drawImage(floorCanvas,floorCanvas.width-offset,181);
 if(level===3)R(0,185,W,63,'rgba(103,173,200,.12)');
 if(level===5)R(0,185,W,63,'rgba(56,67,37,.18)');
 for(let x=-(camera%46);x<W;x+=46){R(x,182,22,3,level===3?'#7ba9bb':'#b99c55');R(x+22,182,24,3,'#111d2c');}
 R(0,248,W,22,'#0c202f');R(0,248,W,2,'#8baebd');
 for(let x=-(camera%20);x<W;x+=20){R(x,251,3,17,'#324e60');R(x+5,254,12,2,'#5d7b8c');R(x+6,263,9,2,'#213b50');}
 R(0,267,W,3,'#050a14');
 if(settings.ambient>0){
  // Thin floor reflections are below actors and cannot hide their silhouettes.
  for(let i=0;i<7;i++){const px=((i*79-camera*.63)%610+610)%610;ctx.save();ctx.globalAlpha=.04+.025*Math.sin(tick*.014+i);R(px,195+(i%3)*14,21,1,lev.tone);ctx.restore();}
  if(level!==4)for(let i=0;i<4;i++){
   const px=((i*271-camera*.3)%810+810)%810-40,t=(tick+i*41)%180;
   if(t<51){ctx.save();ctx.globalAlpha=(51-t)/(level===3?360:550);ellipse(px,154-t*.37,10+t*.1,17,level===5?'#8fa996':'#baf3ee');ctx.restore();}
  }
  if(level===1)glow(250,75,140,'#ad6d32',.05);
 }
}
function drawProps(){const camera=game.camera;for(const o of game.props){const x=o.x-camera,y=o.y;if(x<-55||x>W+55)continue;if(o.dead){if((o.breakT||0)<22){R(x-14,y-9,28,4,'#503f2c');}continue;}
 ellipse(x,y+1,23,5,'rgba(0,0,0,.4)');if(o.type==='crate'){R(x-19,y-33,38,33,'#33251e');R(x-18,y-32,36,30,'#966039');R(x-16,y-30,32,26,'#704426');R(x-17,y-31,34,2,'#efbf78');R(x-16,y-3,32,2,'#20160d');L(x-15,y-29,x+15,y-5,'#e1b37a',2);L(x+15,y-29,x-15,y-5,'#392b28',2);R(x-1,y-31,3,26,'#442b19');R(x-17,y-18,34,3,'#614329');}
 else if(o.type==='barrel'){R(x-13,y-33,26,34,'#121e24');R(x-12,y-31,24,30,'#385765');R(x-11,y-29,22,3,'#637e87');R(x-11,y-8,22,3,'#172934');R(x-6,y-20,12,10,'#cbac45');T('!',x,y-22,9,'#1e2b30','center');glow(x,y-12,25,'#c7a74c',.06);}
 else{R(x-15,y-34,31,36,'#17252f');R(x-13,y-32,27,29,'#577787');R(x-11,y-29,22,16,'#071f2c');for(let j=0;j<4;j++){R(x-8+(j%2)*11,y-27+Math.floor(j/2)*7,8,3,((game.tick+j*17)%70)<35?'#64ece6':'#356474');}R(x-10,y-5,21,2,'#8bb3a0');}
 }}
function drawHazards(){for(const h of game.hazards){let x=h.x-game.camera,y=h.y;if(x<-40||x>W+40)continue;ellipse(x,y+1,22,5,'rgba(0,0,0,.3)');R(x-14,y-6,29,6,'#0c2330');R(x-14,y-6,29,2,'#91b4bb');if(h.active){if(h.type==='steam'||h.type==='cryo'||h.type==='acid'){for(let i=0;i<4;i++){const yy=y-8-(game.tick*3+i*17)%90;ctx.save();ctx.globalAlpha=.23;ellipse(x+Math.sin(game.tick*.11+i)*6,yy,5+i,12+i*2,h.color||'#b8e8e8');ctx.restore();}}
 else{for(let i=0;i<6;i++){const xx=x+Math.sin(game.tick*.29+i*3)*17,yy=y-12-i*9;L(xx,yy,xx+Math.cos(i+game.tick)*7,yy-10,h.color||'#77e4fa',2);}glow(x,y-32,32,'#7cebfb',.22);}}
 else if(Math.floor(game.tick/14)%2){R(x-3,y-8,6,2,h.color||'#deba61');if(h.warning)T('!',x,y-24,8,h.color||'#deba61','center');}
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
  if(activeImage('marineReforged')){const im=A.marineReforged,row=e.hurt>0?5:e.ai==='reload'?4:e.fire>0?3:e.ai==='windup'?2:walking?1:0;
    const fi=Math.floor(walking?e.walk*3.8:e.ai==='reload'?game.tick/5:e.fire>0?(8-e.fire):game.tick/12)%8;
    ctx.drawImage(im,Math.max(0,fi)*80,row*96,80,96,-29*big,-68*big,58*big,70*big);
  }else if(activeImage('marineAnim')){const im=A.marineAnim,row=e.hurt>0?3:e.fire>0||e.ai==='windup'?2:walking?1:0;
    const fi=Math.floor(walking?e.walk*4.2:game.tick/15)%8;
    ctx.drawImage(im,fi*120,row*130,120,130,-33*big,-65*big,66*big,65*big);
  }else ctx.drawImage(A.soldier,-33*big,-65*big,66*big,65*big);ctx.filter='none';
  // Separate animated weapon for variant troops, visibly responding to firing.
  if(e.type==='gunner'){
    R(-30,-46,13,12,'#1b2534');R(8,-48,13,12,'#283342');R(-28,-44,9,3,'#788a9b');
    R(-32,-32,55,10,'#18232d');R(-27,-34,42,4,'#576875');R(-31,-26,53,2,'#a3acaf');
    for(let k=0;k<3;k++)R(-55,-34+k*3+(game.tick%3===0?1:0),32,2,k===1?'#a4b9c4':'#344756');
    R(14,-49,13,19,'#465b63');R(16,-47,9,10,'#91a9ad');
  }else if(e.type==='assault'){
    R(-17,-60,23,7,'#182c43');R(-14,-58,17,2,'#ebaa51');R(-8,-43,21,16,'#354f69');R(-6,-40,17,2,'#95b8c4');
  }else if(e.type==='engineer'){
    R(15,-49,19,23,'#d6aa53');R(17,-46,15,17,'#61482a');R(21,-43,3,12,'#d5dfcb');R(18,-40,10,3,'#d5dfcb');
  }else if(['juggernaut','prototype','exosuit'].includes(e.type)){
    const col=e.type==='prototype'?'#75dbe7':e.type==='exosuit'?'#dfb36b':'#b6c4cb';
    R(-27,-58,19,18,'#263c50');R(10,-58,22,18,'#263c50');R(-25,-56,16,4,col);R(12,-56,17,4,col);
    R(-13,-41,28,18,'#182d43');R(-10,-38,22,4,col);R(-25,-23,14,19,'#253e53');R(11,-23,14,19,'#253e53');
    if(e.type==='exosuit'){R(17,-67,15,11,'#1b2d40');for(let j=0;j<3;j++)R(19+j*4,-65,2,6,'#e7bc75');}
    if(e.type==='prototype'){softwareMesh(meshOcta,-1,-36,7,game.tick*.025,col,'wire');}
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
 if(e.fire>0){const tt=8-e.fire;R(x-e.face*(8+tt*2),y-45-tt*2+tt*tt*.3,3,1,'#d9bb69');glow(x+e.face*36,y-42,18,'#ffc24b',.42);R(x+e.face*34-2,y-46,8,7,'#ff9b23');R(x+e.face*36-2,y-44,4,3,'#fff6b6');}
 if(e.ai==='windup'){R(x-14,y-75,28,4,'#6c2f2b');R(x-14,y-75,Math.max(1,28*e.wind/(e.type==='gunner'?49:40)),4,'#ffce68');T('!',x,y-88,10,'#ffe17d','center');}
 if(e.hp<e.maxHp)B(x-18,y-68,36,3,e.hp/e.maxHp,e.type==='heavy'||e.type==='gunner'?'#dbb064':'#b2df73');
 if(e.flash>0&&game.tick%3<2){ctx.save();ctx.globalAlpha=.19;R(x-19,y-62,38,55,'#fffbea');ctx.restore();}
}

// Frame-authored articulated poses. Animation time is simulation time, so
// pausing/repeated renders never advance a pose. Contact keys coincide with
// ATTACKS active windows; gameplay remains the authority for damage.
const POSE_STATES=['idle','walk','run','dash','jumpstart','rising','falling','landing','claw1','claw2','claw3','heavy','tail','air','special','ultimate','grab','throw','hurt','stun','death','victory'];
const POSE_CLIPS=Object.fromEntries(POSE_STATES.map((id,row)=>[id,{id,row,frames:8,durations:id==='idle'?[9,9,9,9,9,9,9,9]:[4,4,4,4,4,4,4,4],loop:['idle','walk','run','stun'].includes(id),priority:id==='death'?100:id==='hurt'?90:id==='dash'?80:id.startsWith('claw')?60:20,interruptible:!['death','hurt'].includes(id),events:id.startsWith('claw')||id==='tail'?{3:'contact'}:{}}]));
function playerPose(p){
 let name='idle',frame=0;
 if(p.dead){name='death';frame=clamp(Math.floor(p.downT/7),0,7);}
 else if(p.stun>0){name=p.stun>10?'hurt':'stun';frame=Math.floor(p.anim/4)%8;}
 else if(p.dodge>0){name='dash';frame=clamp(7-Math.floor(p.dodge/2),0,7);}
 else if(p.throwT>0){name='throw';frame=clamp(7-Math.floor(p.throwT/2),0,7);}
 else if(p.attack){
  name=({claw1:'claw1',claw2:'claw2',claw3:'claw3',tail:'tail',impact:'heavy',finisher:'claw3',air:'air',slam:'heavy',grabbite:'grab',acidburst:'special',phantom:'dash',rage:'ultimate',acidclaw:'claw3',predator:'heavy',ripper:'claw2',counter:'ultimate',super:'ultimate'})[p.attack]||'special';
  const a=ATTACKS[p.attack],t=p.attackT;
  frame=t<a.startup?Math.min(2,Math.floor(t/Math.max(1,a.startup)*3)):t<a.startup+a.active?3+Math.min(1,Math.floor((t-a.startup)/Math.max(1,a.active)*2)):5+Math.min(2,Math.floor((t-a.startup-a.active)/Math.max(1,a.recovery)*3));
 }
 else if(p.airborne){name=p.z<9&&p.vz>0?'jumpstart':p.vz>0?'rising':'falling';frame=Math.floor(p.anim/4)%8;}
 else if(p.landingT>0){name='landing';frame=clamp(7-p.landingT,0,7);}
 else if(p.grabTarget){name='grab';frame=Math.floor(p.anim/5)%8;}
 else if(screen==='victory'||screen==='stageclear'){name='victory';frame=Math.floor(p.anim/6)%8;}
 else if(Math.abs(p.moveX)+Math.abs(p.moveY)>.15){name=p.classId===2?'run':'walk';frame=Math.floor(p.walking*2.5)%8;}
 else frame=Math.floor(p.anim/9)%8;
 return {clip:POSE_CLIPS[name],frame};
}
function drawPose(p,x,y,alpha=1){
 const {clip,frame}=playerPose(p),im=A.reforged,c=CLASS[p.classId];
 if(!activeImage('reforged')){drawAtlas(p.classId,0,frame,x,y,p.face,alpha);return;}
 const dw=107*c.scale,dh=107*c.scale;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y));ctx.scale(p.face,1);ctx.filter=`hue-rotate(${c.hue}deg) saturate(1.07)`;
 ctx.drawImage(im,frame*112,(p.classId*POSE_STATES.length+clip.row)*112,112,112,-Math.round(dw*.54),-Math.round(dh*.92),Math.round(dw),Math.round(dh));ctx.restore();
}
function drawPlayer(p){
 const x=p.x-game.camera,y=p.y-p.z,c=CLASS[p.classId];
 ellipse(x,p.y,Math.max(5,27*c.scale*(1-p.z/150)),Math.max(2,5*c.scale*(1-p.z/200)),'rgba(0,0,0,.55)');
 if(p.dodge>0){for(let i=1;i<=2;i++)drawPose(p,x-p.face*i*13,y,.08*(3-i));}
 const alpha=p.dead?.55:p.inv>0&&Math.floor(game.tick/4)%2===0?.46:1;
 drawPose(p,x,y,alpha);
 if(p.rageT>0){glow(x,y-47,57,'#e2ac64',.09);}
 if(p.attack){const atk=ATTACKS[p.attack];if(p.attackT>=atk.startup&&p.attackT<atk.startup+atk.active){
  const tail=['tail','impact','predator'].includes(p.attack),slash=p.attack==='acidburst'?'#b3ff69':tail?'#91d5ff':c.color;
  ctx.save();ctx.translate(Math.round(x),Math.round(y-36));ctx.scale(p.face,1);ctx.strokeStyle=slash;ctx.lineWidth=p.attack==='claw3'?3:1;ctx.globalAlpha=.72;
  const radius=tail?58:36;ctx.beginPath();ctx.arc(25,0,radius,-1.07+(p.attack==='claw2'?.4:0),.93);ctx.stroke();ctx.restore();
 }}
 if(game.players.length>1)T('И'+p.id,x,y-109,7,p.id===1?'#62eeff':'#ffc970','center');
}

function drawBoss(){
 const b=game.boss;if(!b)return;const x=b.x-game.camera,y=b.y,lev=LEVELS[game.level];
 if(x<-175||x>W+175)return;
 const newBoss=game.level>=3,sheetName=newBoss?'bossReforged':['bossGuardian','bossSiege','bossQueen'][game.level];const src=A[sheetName],valid=activeImage(sheetName),w=newBoss?214:game.level===2?196:211,h=newBoss?168:game.level===2?192:155;
 ellipse(x,y+1,game.level===2?70:61,10,'rgba(0,0,0,.58)');
 const frame=Math.floor(b.walk*2.2)%8;
 if(valid){ctx.save();ctx.translate(Math.round(x),Math.round(y+Math.sin(b.walk)*1.5));ctx.scale(-b.face,1);
  const row=(newBoss?(game.level-3)*3:0)+(b.dead||b.hurt>0?2:b.wind>0||b.dashT>0?1:0);const fw=src.naturalWidth/8,fh=src.naturalHeight/(newBoss?9:3);
  if(b.dead){ctx.globalAlpha=Math.max(.35,game.bossDown/130);ctx.rotate(-Math.min(.40,(130-game.bossDown)/140*.33));}
  ctx.filter=newBoss?'none':game.level===0?'hue-rotate(0deg)':game.level===1?'hue-rotate(24deg) saturate(1.12)':'hue-rotate(-6deg)';
  ctx.drawImage(src,fw*frame,fh*row,fw,fh,-Math.round(w*.52),-h+2,w,h);ctx.restore();
 }else drawAtlas(3,0,frame,x,y,b.face,1,1.72);
 if(game.level===1&&!b.dead){R(x-39,y-91,17,7,'#69677d');R(x-36,y-87,9,3,'#e3ba89');glow(x,y-90,32,'#ffb06b',.08);}
 if(b.phase>=2&&!b.dead)glow(x,y-87,83,b.phase===3?'#eb8fe1':'#b7ff82',.11);
 if(b.telegraph&&!b.dead){const a=b.telegraph,tx=a.x-game.camera,col=a.kind==='frost'?'#83e7fa':a.kind==='rupture'?'#b4ed76':'#efb26f';ctx.save();ctx.globalAlpha=.35+.2*Math.sin(game.tick*.35);ellipse(tx,a.y,49,12,col);L(tx-33,a.y,tx+33,a.y,col);L(tx,a.y-8,tx,a.y+8,col);ctx.restore();}
 if(b.wind>0){const color=b.attackKind==='acid'?'#a7ff72':b.attackKind==='charge'?'#ffaf70':'#ffcd73';T(({acid:'КИСЛОТА',slam:'УДАР',tail:'ХВОСТ',charge:'ТАРАН',summon:'ПОДМОГА',frost:'КРИОЗАЛП',barrage:'РАКЕТНЫЙ ЗАЛП',rupture:'КИСЛОТНЫЙ РАЗЛОМ'}[b.attackKind]||b.attackKind),x,y-h-12,8,color,'center');B(x-27,y-h-4,54,3,1-b.wind/48,color);}
 if(b.flash>0&&game.tick%4<2){ctx.save();ctx.globalAlpha=.12;ellipse(x,y-86,49,70,'#d7ffae');ctx.restore();}
}

function drawProjectiles(){for(const b of game.bullets){let x=b.x-game.camera;if(x<-20||x>W+20)continue;let y=b.y;if(b.type==='grenade'){const base=b.explosionY-8,progress=b.flight/65;y=base-Math.sin(Math.PI*progress)*55;ellipse(x,b.explosionY,10,3,'rgba(251,198,99,.25)');R(x-4,y-4,8,8,'#2d3737');R(x-3,y-3,6,5,'#c1c5ab');if(b.life<20&&b.life%6<3)R(x-2,y-2,4,4,'#ffee6b');}
 else if(b.type==='shot'){R(x-5,y-1,11,3,'#ffc05a');R(x-3,y,5,1,'#fff7c1');}
 else if(b.type==='fire'){R(x-5,y-3,10,6,'#ff852c');R(x-2,y-3,5,4,'#ffee8d');}
 else{R(x-5,y-3,11,7,b.type==='bossAcid'?'#baff6f':'#91ff42');R(x-2,y-5,4,11,'#c8fb87');glow(x,y,20,'#a5ff63',.18);}}
}
function drawFX(){for(const q of game.particles){ctx.save();ctx.globalAlpha=clamp(q.t/q.maxT,0,1);R(q.x-game.camera,q.y,q.size,q.size,q.color);ctx.restore();}for(const q of game.texts){ctx.save();ctx.globalAlpha=Math.min(1,q.t/12);T(q.message,q.screenSpace?q.x:q.x-game.camera,q.y,q.t>72?8:7,q.color,'center');ctx.restore();}}
function hud(){const g=game,multiple=g.players.length>1;R(0,0,W,52,settings.hiContrast?'#000000':'#040b14');R(0,51,W,1,'#5b8190');
 for(let i=0;i<g.players.length;i++){const p=g.players[i],c=CLASS[p.classId],x=multiple?i*240+5:6,max=multiple?230:230;
 R(x,3,max,45,'#243d48');R(x+1,4,max-2,43,'#091823');R(x+3,5,26,39,'#132a34');
 if(activeImage('sheet')){ctx.save();ctx.filter=`hue-rotate(${c.hue}deg)`;ctx.drawImage(A.sheet,190,24,82,92,x+4,8,24,27);ctx.restore();}
 T('И'+p.id+' '+c.name.replace('КСЕНО-',''),x+34,4,7,c.color);T(String(p.score).padStart(6,'0'),x+max-5,16,7,'#f0f3ec','right');
 T('ЖИЗНИ '+p.lives,x+34,16,7,p.hp/p.maxHp<.29?'#ff9b83':'#d1e4e1');
 const health=p.hp/p.maxHp;B(x+34,31,max-42,5,(p.oldHp??p.hp)/p.maxHp,'#ae7455');R(x+34,31,(max-42)*health,5,health<.29?'#fa675f':'#c6e77d');
 B(x+34,41,max-42,3,p.energy/100,p.energy>=80?'#d9f9a1':'#6cdcc9');
 if(p.energy>=80)T('!',x+17,32,7,'#e5ffbd');
 }
 if(!multiple){T(LEVELS[g.level].sector,251,4,7,'#b6dfe2');T('РЕКОРД '+String(records.high).padStart(7,'0'),251,17,7,'#ffdc97');T(g.players[0].energy>=80?'СУПЕРПРИЁМ ГОТОВ [U]':'ЭНЕРГИЯ '+Math.floor(g.players[0].energy)+'%',251,33,7,'#a2f3da');}
 if(g.combo>1&&g.comboTimer>0){R(169,56,142,27,'rgba(7,14,23,.93)');T(g.combo+' УДАРОВ',240,57,10,g.combo>=14?'#fff1a3':'#ffdb87','center');T(g.combo>=20?'СМЕРТЕЛЬНО':g.combo>=14?'СВИРЕПО':g.combo>=9?'ХИЩНИК':g.combo>=5?'ЖЕСТОКО':'КОМБО',240,70,7,'#aeead3','center');}
 if(g.boss){R(25,238,430,30,'rgba(2,6,15,.96)');T(LEVELS[g.level].bossName,34,240,8,'#ffe39b');T('ФАЗА '+g.boss.phase,446,240,6,'#d1edf3','right');B(35,257,410,7,g.boss.hp/g.boss.maxHp,'#e5e34e');}
 else{R(6,252,205,15,'rgba(2,9,17,.9)');T('ВРАГИ '+g.stageKills+' • ВОЛНА '+Math.min(g.waveIndex+(g.waveActive?0:1),LEVELS[g.level].waves.length),10,253,6,'#c1dee6');R(310,252,164,15,'rgba(2,9,17,.9)');T('ОЧКИ '+String(g.score).padStart(7,'0'),469,253,6,'#ffd778','right');}
 if(g.announceT>0){ctx.save();ctx.globalAlpha=clamp(g.announceT/22,0,1);R(32,88,416,32,'rgba(4,12,21,.94)');R(32,88,416,1,'#b28d48');wrappedText(g.announcement,240,92,390,8,'#ffe2a2','center');ctx.restore();}
 if(g.stageBanner>0){ctx.save();ctx.globalAlpha=clamp(g.stageBanner/35,0,1);R(45,127,390,48,'rgba(3,10,19,.92)');T('УРОВЕНЬ '+String(g.level+1).padStart(2,'0'),240,130,11,'#f8e7a0','center');wrappedText(LEVELS[g.level].name,240,146,365,7,'#d8f4f6','center');ctx.restore();}
 if(g.debug){R(1,83,210,58,'rgba(0,0,0,.88)');T('ОТЛАДКА 60ГЦ • ТИК '+g.tick,5,85,7,'#8ef6be');T('ВРАГИ '+g.enemies.filter(e=>!e.dead).length+' • ПУЛИ '+g.bullets.length,5,99,7,'#d9edf8');T('ЭФФЕКТЫ '+g.particles.length+' • ВОЛНА '+g.waveIndex,5,113,7,'#d9edf8');}
}

function render3D(g,menu=false){
 if(settings.threeD===false||!window.HiveRenderer){if(renderer3d)renderer3d.canvas.hidden=true;return null;}
 if(renderer3d?.needsRecreate){try{renderer3d.dispose()}catch{}renderer3d=null;rendererAttempted=false}
 if(!rendererAttempted){rendererAttempted=true;try{renderer3d=new window.HiveRenderer({classes:CLASS,enemies:ENEMY,attacks:ATTACKS,levels:LEVELS,assetURL});renderer3d.canvas.className='scene3d';document.getElementById('cabinet').insertBefore?.(renderer3d.canvas,canvas);resizeCabinet()}catch(e){rendererError=String(e.message);console.warn('3D недоступно, включён 2D-режим:',rendererError)}}
 if(!renderer3d||renderer3d.failed||renderer3d.lost){if(renderer3d)renderer3d.canvas.hidden=true;return null;}renderer3d.canvas.hidden=false;if(!renderer3d.ready){loadout.hidden=false;loadout.textContent='ЗАГРУЗКА 3D-ПЕРСОНАЖЕЙ...'}else if(!loadErrors.length)loadout.hidden=true;
 try{return menu?renderer3d.renderMenu(menuTick,settings,screen==='select'?selected:3):renderer3d.render(g,settings)}catch(e){rendererError=String(e.message);renderer3d.failed=true;renderer3d.canvas.hidden=true;console.error('Ошибка 3D-рендера, включён 2D-режим:',e);return null}
}
function hud3D(g){
 for(let i=0;i<g.players.length;i++){
  const p=g.players[i],x=i?294:8,w=178,c=CLASS[p.classId];
  R(x,6,w,32,'rgba(3,12,21,.9)');R(x,6,2,32,c.color);T(c.name.replace('КСЕНО-',''),x+8,7,7,c.color);
  T('Ж '+p.lives,x+w-7,7,7,'#e8dab2','right');B(x+8,23,w-16,4,p.hp/p.maxHp,'#a9dd9b');B(x+8,33,w-16,2,p.energy/100,'#5ddfdd');
 }
 if(g.players.length===1){T(LEVELS[g.level].sector,465,8,7,'#b1d5dc','right');T(String(g.score).padStart(7,'0'),465,22,7,'#f7d39e','right')}
 if(g.combo>1&&g.comboTimer>0){T(g.combo+' УДАРОВ',240,8,7,'#f4deb2','center')}
 if(g.announceT>0){ctx.save();ctx.globalAlpha=clamp(g.announceT/20,0,1);R(55,49,370,19,'rgba(3,12,21,.86)');wrappedText(g.announcement,240,51,350,7,'#f2d29c','center');ctx.restore()}
 if(g.stageBanner>0){ctx.save();ctx.globalAlpha=clamp(g.stageBanner/30,0,1);R(70,91,340,34,'rgba(3,12,21,.8)');T('СЕКТОР '+(g.level+1)+' / 06',240,93,7,'#7ce3dd','center');wrappedText(LEVELS[g.level].name,240,108,320,7,'#dfe9e7','center');ctx.restore()}
 if(g.boss){R(66,242,348,24,'rgba(3,9,15,.88)');T(LEVELS[g.level].bossName,240,243,7,'#f5d4a8','center');B(77,260,326,3,g.boss.hp/g.boss.maxHp,'#e9a77d')}
 else {R(8,252,190,15,'rgba(3,12,21,.82)');T('ВОЛНА '+Math.min(g.waveIndex+(g.waveActive?0:1),LEVELS[g.level].waves.length)+' / 05',15,253,7,'#c1d9d6');T('Q ПАРИРОВАНИЕ • R ДОБИВАНИЕ',465,253,7,'#adc9c9','right')}
}
function draw3DOverlay(g){
 for(const q of g.texts){const pos=q.screenSpace?{x:q.x,y:q.y}:renderer3d.project(q.x,217,217-q.y);ctx.save();ctx.globalAlpha=Math.min(1,q.t/12);T(q.message,pos.x,pos.y,7,q.color,'center');ctx.restore()}
 for(const e of g.enemies){if(e.dead||e.hp>=e.maxHp)continue;const pos=renderer3d.project(e.x,e.y,76);B(pos.x-16,pos.y,32,2,e.hp/e.maxHp,e.hp/e.maxHp<=.25?'#f8b174':'#a5d6a0');if(e.hp/e.maxHp<=.25)T('R',pos.x,pos.y-13,7,'#ffe4a0','center')}
 if(g.flash>0&&settings.flashes){ctx.save();ctx.globalAlpha=Math.min(.12,g.flash/100);R(0,0,W,H,'#d5ffe2');ctx.restore()}
 hud3D(g);drawScanlines();
}
function drawGame(){if(!game)return;const g=game;const image=render3D(g);if(image){draw3DOverlay(g);return;}ctx.save();if(g.shake>1&&settings.shake)ctx.translate(Math.round(rand(-g.shake/2,g.shake/2)),Math.round(rand(-g.shake/2,g.shake/2)));
 background(g.level,g.camera,g.tick);drawHazards();drawBloodAndDecals();drawPuddles();drawProps();drawItems();
 const actors=[];for(const e of g.enemies){if(e.dead&&e.deathT>130)continue;actors.push({y:e.y,fn:()=>drawMarine(e)});}for(const p of g.players)actors.push({y:p.y,fn:()=>drawPlayer(p)});if(g.boss)actors.push({y:g.boss.y,fn:drawBoss});actors.sort((a,b)=>a.y-b.y).forEach(a=>a.fn());drawProjectiles();drawFX();ctx.restore();
 if(g.flash>0&&settings.flashes){ctx.save();ctx.globalAlpha=Math.min(.18,g.flash/65);R(0,0,W,H,'#d5ffe2');ctx.restore();}
 hud();drawScanlines();}
function drawScanlines(){if(!settings.scanlines)return;ctx.save();ctx.globalAlpha=.12;for(let y=0;y<H;y+=3)R(0,y,W,1,'#061321');ctx.restore();}
// ------------------------------ MENUS & UX ---------------------------------
function menuBackdrop(){const volume=render3D(null,true);if(volume){}else if(activeImage('menuScene')){ctx.drawImage(A.menuScene,0,0,W,H);}else if(activeImage('cover')){ctx.drawImage(A.cover,0,0,W,H);}else background(0,(menuTick*.25)%650,menuTick,true);
 R(0,0,W,H,volume?'rgba(1,8,18,.28)':'rgba(1,8,18,.72)');
 if(settings.pixel3d&&!volume){softwareMesh(meshOcta,402,90,27,menuTick*.012,'#59dce9','wire');torusRing(403,91,43,18,menuTick*.019,'#4e96ae');}
 for(let i=0;i<7;i++){const yy=27+i*32;R((menuTick*(i%2?-.36:.27)+i*99+1000)%520-30,yy,18,1,'rgba(102,226,231,.18)');}
 glow(240,48,140,'#66d6ed',.11);R(0,0,W,27,'rgba(2,8,15,.87)');T(RU.cabinetIdentity,240,8,6,'#a6c1d3','center');
 if(menuTick%170<4)R(0,0,W,H,'rgba(116,208,225,.035)');drawScanlines();}
function titleArt(y=31){T(RU.gameTitle,240,y,27,'#baf0f6','center');T(RU.gameSubtitle,240,y+34,23,'#f9d273','center');R(130,y+62,220,1,'#6eb8c0');T(RU.edition,240,y+65,7,'#97c2d0','center')}
function drawMenu(){menuBackdrop();titleArt(30);const y0=121;BUTTONS.forEach((v,i)=>{const yy=y0+i*24,active=menuIndex===i;if(active){R(144,yy-2,192,21,'rgba(63,102,120,.55)');R(144,yy-2,3,21,'#f7d36c');T('▶',159,yy+2,9,'#ffe47b');}T(v,240,yy+1,10,active?'#fff0b7':'#b4d2de','center')});
 T(RU.controllerHelp,240,248,6,'#8dbdc5','center');}
function drawSelect(){menuBackdrop();T(RU.selectTitle,240,20,17,'#e5f6eb','center');T(coop?'ИГРОК 1: КЛАВИАТУРА • ИГРОК 2: ГЕЙМПАД':'ОДИН ИГРОК • КЛАВИАТУРА ИЛИ ГЕЙМПАД',240,45,7,'#f4d788','center');const start=10;
 CLASS.forEach((c,i)=>{const x=start+i*118,active=selected===i,active2=coop&&joined&&selected2===i;R(x-2,70,110,148,active?'#f0d479':active2?'#88f3e5':'#3f6279');R(x,72,106,144,'#081622');R(x+3,75,100,77,'#0b2030');
 if(activeImage('portrait'+i)){ctx.drawImage(A['portrait'+i],x+3,75,100,77);}else if(activeImage('sheet')){const sx=Math.round(313.5*1);ctx.save();ctx.filter=`hue-rotate(${c.hue}deg) saturate(1.2)`;ctx.drawImage(A.sheet,sx,6,313,304,x+6,74,91,80);ctx.restore();}else T('?',x+50,93,36,c.color,'center');
 if(active)T('И1',x+7,76,8,'#ffdc7c');if(active2)T('И2',x+82,76,8,'#7dfde2');T(c.name.replace('КСЕНО-',''),x+53,157,8,c.color,'center');T(c.title,x+53,170,5,'#9bbccb','center');T('ОЗ',x+5,182,5,'#afcddb');B(x+22,183,75,4,c.hp/200,'#b5db75');T('СКР',x+5,193,5,'#afcddb');B(x+22,194,75,4,c.speed/2.9,'#8dc9f0');T(c.special.replace('УДАР ХВОСТОМ','ХВОСТ'),x+53,205,6,'#f7db8c','center');});
 R(17,225,446,37,'rgba(2,8,16,.93)');if(coop){T(joined?'ИГРОК 2 ПОДКЛЮЧЁН • ◀ ▶ ВЫБОР КЛАССА':'START НА ГЕЙМПАДЕ • ПОДКЛЮЧИТЬ ИГРОКА 2',240,229,7,joined?'#a1f9e8':'#ffe38b','center');T('И1: ◀ ▶ / 1–4 • ENTER НАЧАТЬ • ESC НАЗАД',240,244,7,'#d5eaf0','center');}
 else{T('◀ ▶ / 1–4  ВЫБОР КЛАССА    ENTER СТАРТ',240,232,8,'#ffe5a8','center');T('J КОГТИ • K ХВОСТ • L НАВЫК • U СУПЕРПРИЁМ',240,247,6,'#a6d1de','center');}}
function optionValues(){const yn=v=>v?'ВКЛ':'ВЫКЛ';
 if(optionTab===0)return [['НОВИЧОК','АРКАДА','КОШМАР'][settings.difficulty],['БЕЗ КРОВИ','УМЕРЕННЫЙ','ПОЛНЫЙ'][settings.violence],yn(settings.damageNumbers),'ENTER',''];
 if(optionTab===1)return [yn(settings.threeD),['НИЗКО','СРЕДНЕ','ВЫСОКО'][settings.particles],['ВЫКЛ','НИЗКО','ВЫСОКО'][settings.ambient],yn(settings.shake),yn(settings.flashes),yn(settings.scanlines),yn(settings.hiContrast),yn(settings.pixelPerfect),document.fullscreenElement?'ВЫКЛЮЧИТЬ':'ВКЛЮЧИТЬ',['ЭКОНОМ','БАЛАНС','МАКСИМУМ'][settings.quality3d??1],yn(settings.reflections),yn(settings.bloom),yn(settings.pixelization!==false),''];
 if(optionTab===2)return [Math.round(settings.master*100)+'%',Math.round(settings.music*100)+'%',Math.round(settings.sfx*100)+'%',Math.round(settings.ambientAudio*100)+'%',settings.musicStyle==='rock'?'ТЯЖЁЛЫЙ РОК':'ЭЛЕКТРОНИКА',yn(settings.originalMusic),''];
 return [...BINDING_ACTIONS.map(a=>typeof bindingLabel==='function'?bindingLabel(a):a),Math.round((settings.deadzone??.24)*100)+'%','ENTER',''];
}
function optionScroll(){return Math.max(0,Math.min(optionIndex-6,OPTION_GROUPS[optionTab].length-8));}
function drawOptions(){menuBackdrop();T(RU.settingsTitle,240,19,20,'#ffe2a8','center');
 const tabs=['ИГРА','ГРАФИКА','ЗВУК','КЛАВИШИ'];tabs.forEach((n,i)=>{const x=24+i*110;R(x,48,104,17,i===optionTab?'#345766':'#101e2c');R(x,48,104,1,i===optionTab?'#f4d078':'#345065');T(n,x+52,49,8,i===optionTab?'#fff1cc':'#b5d4de','center');});
 const vals=optionValues(),offset=optionScroll();OPTION_GROUPS[optionTab].slice(offset,offset+8).forEach((name,j)=>{const i=offset+j,y=73+j*20;
 if(optionIndex===i){R(28,y-2,424,19,'rgba(56,101,120,.9)');R(28,y-2,3,19,'#ffe183');}T(name,38,y,8,optionIndex===i?'#ffe5a7':'#bddce6');T(vals[i]||'',442,y,8,optionIndex===i?'#ffffff':'#94d1d5','right');});
 const count=OPTION_GROUPS[optionTab].length;if(count>8){R(456,73,2,152,'#142d38');R(456,73+Math.round(offset/(count-8)*100),2,52,'#cce2c7');}
 if(typeof bindingAction!=='undefined'&&bindingAction){R(27,105,426,55,'#040b14');T(RU.bindPrompt,240,113,17,'#ffe2a8','center');T(RU.bindCancel,240,142,7,'#c5e8ed','center');}
 else{T(RU.optionsHelp,240,239,7,'#d9ebde','center');T(optionTab===3?'ГЕЙМПАДОВ: '+getGP().length+' • РАСКЛАДКА РУ / EN':'ESC НАЗАД • ПАРАМЕТРЫ СОХРАНЯЮТСЯ АВТОМАТИЧЕСКИ',240,253,6,'#a4cad3','center');}
}
function optionPointer(x,y){if(y>=46&&y<68){optionTab=clamp(Math.floor((x-24)/110),0,3);optionIndex=0;synth('select');}
 else if(y>=71&&y<232){optionIndex=clamp(optionScroll()+Math.floor((y-73)/20),0,OPTION_GROUPS[optionTab].length-1);menuChoice();}}

function drawControls(){menuBackdrop();T(RU.controlsTitle,240,21,20,'#ffe4ad','center');
 const rows=[['WASD / СТРЕЛКИ','ДВИЖЕНИЕ'],['J / X','КОМБО КОГТЯМИ'],['K / Y','УДАР ХВОСТОМ'],['L / B','СПОСОБНОСТЬ'],['SPACE / A','ПРЫЖОК'],['SHIFT / RB','УКЛОНЕНИЕ'],['E / LB','ЗАХВАТ / БРОСОК'],['U / LT','СУПЕРПРИЁМ: 80 ЭНЕРГИИ'],['Q / RT','ПАРИРОВАНИЕ'],['R / R3','ДОБИВАНИЕ'],['CTRL / L3','НИЗКОЕ ПОЛЗАНИЕ'],['ESC / START','ПАУЗА']];
 rows.forEach((row,i)=>{const y=45+i*16;if(i%2===0)R(27,y-1,426,18,'rgba(53,84,103,.4)');T(row[0],37,y,8,'#b7e8ed');T(row[1],443,y,8,'#ffe2a4','right');});
 T(RU.rebindingHelp,240,232,7,'#b2e4dc','center');T(RU.keyboardHelp,240,248,7,'#eef0c1','center');}
function drawCredits(){menuBackdrop();T(RU.recordsTitle,240,26,20,'#d3eff0','center');
 const rows=[['ЛУЧШИЙ СЧЁТ',String(records.high).padStart(8,'0')],['ЛУЧШЕЕ КОМБО',records.maxCombo],['ПРОЙДЕНО СЕКТОРОВ',records.wins],['ОТКРЫТЫЙ СЕКТОР',records.stage]];
 rows.forEach((r,i)=>{const y=66+i*21;T(r[0],49,y,8,'#aedce4');T(r[1],430,y,8,'#ffe2a4','right');});
 T(RU.creditsTitle,240,163,8,'#cde9ee','center');T(RU.creditsBase,240,181,7,'#b5d8df','center');T(RU.creditsEngine,240,199,7,'#b5d8df','center');T(RU.creditsCoop,240,217,7,'#95ead6','center');T(RU.back,240,247,8,'#ffe6a9','center');}

function dimOverlay(){ctx.fillStyle='rgba(1,6,14,.82)';ctx.fillRect(0,0,W,H);}
function drawPaused(){drawGame();dimOverlay();T(RU.pauseTitle,240,51,23,'#ffe6a7','center');['ПРОДОЛЖИТЬ','ПЕРЕЗАПУСТИТЬ УРОВЕНЬ','НАСТРОЙКИ','ГЛАВНОЕ МЕНЮ'].forEach((text,i)=>{const y=111+i*27;if(menuIndex===i){R(139,y-4,204,22,'rgba(57,107,120,.7)');R(139,y-4,3,22,'#f5ce77');}T(text,240,y,10,i===menuIndex?'#fff3d5':'#afcfdb','center');});}
function levelResult(){const g=game,bonus=g.stageBonus,score=g.score;const grade=g.stageDamageTaken<80&&g.maxCombo>14?'S':g.maxCombo>=12?'A':g.maxCombo>=8?'B':g.maxCombo>=4?'C':'D';return {bonus,score,grade};}
function drawStageClear(){drawGame();dimOverlay();const g=game,r=levelResult();T(RU.stageClearTitle,240,31,21,'#d5ff9c','center');wrappedText(LEVELS[g.level].name,240,60,420,8,'#fbdb96','center');const stats=[['ВРЕМЯ',Math.floor(g.levelTime/3600)+':'+String(Math.floor((g.levelTime/60)%60)).padStart(2,'0')],['ВРАГИ',g.stageKills],['МАКС. КОМБО',g.maxCombo],['БОНУС',r.bonus],['ОЧКИ КОМАНДЫ',r.score]];stats.forEach((a,i)=>{const y=92+i*21;T(a[0],119,y,9,'#a9d7e2');T(a[1],362,y,9,'#fff1c1','right');});T('РАНГ  '+r.grade,240,203,16,'#ffe794','center');T(g.level<LEVELS.length-1?'ENTER  /  СЛЕДУЮЩИЙ СЕКТОР':'ENTER  /  ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ',240,241,9,'#aaf4e9','center');}
function drawGameOver(){drawGame();dimOverlay();T(RU.gameOverTitle,240,64,20,'#ff887c','center');T(RU.gameOverSubtitle,240,103,10,'#e2e5e5','center');T('ОЧКИ КОМАНДЫ  '+String(game.score).padStart(7,'0'),240,148,10,'#ffe4a6','center');T(RU.restartHelp,240,206,9,'#c0e0eb','center');}
function drawVictory(){menuBackdrop();T(RU.victoryTitle,240,49,22,'#d7ff92','center');T('ВСЕ '+LEVELS.length+' СЕКТОРОВ ЗАЧИЩЕНЫ',240,90,11,'#f5d993','center');T('ОБЩИЙ СЧЁТ  '+String(game.score).padStart(8,'0'),240,129,12,'#e4f5f4','center');T('ЛУЧШЕЕ КОМБО  '+game.maxCombo+'      УБИЙСТВА  '+game.kills,240,159,9,'#abe8e1','center');T(RU.thanks,240,195,9,'#ffcfa0','center');T(RU.victoryHelp,240,239,8,'#c3e5f1','center');}
function drawFrame(){ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);if(!ready){R(0,0,W,H,'#06131f');T(RU.loading,W/2,H/2,11,'#b3f0e8','center');return;}
 switch(screen){case 'menu':drawMenu();break;case 'select':drawSelect();break;case 'options':drawOptions();break;case 'controls':drawControls();break;case 'credits':drawCredits();break;case 'playing':drawGame();break;case 'paused':drawPaused();break;case 'stageclear':drawStageClear();break;case 'gameover':drawGameOver();break;case 'victory':drawVictory();break;default:drawMenu();}}
function menuChoice(){ensureAudio();if(!ready||settings.threeD!==false&&window.HiveRenderer&&(!rendererAttempted||renderer3d&&!renderer3d.ready&&!renderer3d.failed))return;synth('select');if(screen==='menu'){
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
 const len=OPTION_GROUPS[optionTab].length,n=dir||1;
 if(optionIndex===len-1){if(dir===0){changeScreen(game?'paused':'menu');menuIndex=0;}return;}
 if(optionTab===0){switch(optionIndex){case 0:settings.difficulty=(settings.difficulty+n+3)%3;break;case 1:settings.violence=(settings.violence+n+3)%3;break;case 2:settings.damageNumbers=!settings.damageNumbers;break;case 3:if(dir===0){Object.assign(settings,{difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,originalMusic:false,pixelPerfect:true,deadzone:.24,master:.8,ambientAudio:.35,musicStyle:'rock',threeD:true,quality3d:1,reflections:true,bloom:true,bindings:{...DEFAULT_BINDINGS}});bindingAction=null;resetInput();resizeCabinet();}break;}}
 else if(optionTab===1){switch(optionIndex){case 0:settings.threeD=!settings.threeD;break;case 1:settings.particles=(settings.particles+n+3)%3;break;case 2:settings.ambient=(settings.ambient+n+3)%3;break;case 3:settings.shake=!settings.shake;break;case 4:settings.flashes=!settings.flashes;break;case 5:settings.scanlines=!settings.scanlines;break;case 6:settings.hiContrast=!settings.hiContrast;break;case 7:settings.pixelPerfect=!settings.pixelPerfect;resizeCabinet();break;case 8:toggleFullscreen();break;case 9:settings.quality3d=((settings.quality3d??1)+n+3)%3;break;case 10:settings.reflections=!settings.reflections;break;case 11:settings.bloom=!settings.bloom;break;case 12:settings.pixelization=settings.pixelization===false;break;}}
 else if(optionTab===2){if(optionIndex<4){const key=['master','music','sfx','ambientAudio'][optionIndex];settings[key]=clamp(Math.round(settings[key]*20+n)/20,0,1);}else if(optionIndex===4)setMusicStyle(settings.musicStyle==='rock'?'legacy':'rock');else if(optionIndex===5)settings.originalMusic=!settings.originalMusic;}

 else if(optionTab===3){if(optionIndex<BINDING_ACTIONS.length){if(dir===0)bindingAction=BINDING_ACTIONS[optionIndex];}
 else if(optionIndex===BINDING_ACTIONS.length)settings.deadzone=clamp(Math.round(((settings.deadzone??.24)+n*.02)*100)/100,.08,.4);
 else if(optionIndex===BINDING_ACTIONS.length+1&&dir===0){settings.bindings={...DEFAULT_BINDINGS};resetInput();}}
 save('settings',settings);updateMusic();synth('select',.3);
}
function shiftOptionTab(n){optionTab=(optionTab+n+OPTION_GROUPS.length)%OPTION_GROUPS.length;optionIndex=0;synth('select',.35);}

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
 const code=physicalCode(e),act=keyAction(code);
 if(bindingAction&&screen==='options'){
  e.preventDefault();if(e.repeat)return;
  if(code==='Escape'){bindingAction=null;return;}
  if(!/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight)$/.test(code)||['KeyF','KeyM'].includes(code))return;
  const action=bindingAction;const old=bindingCode(action);settings.bindings={...DEFAULT_BINDINGS,...settings.bindings};
  const duplicate=Object.keys(DEFAULT_BINDINGS).find(a=>a!==action&&bindingCode(a)===code);if(duplicate)settings.bindings[duplicate]=old;
  settings.bindings[action]=code;bindingAction=null;save('settings',settings);resetInput();synth('select');return;
 }
 if(act||['Escape','Enter','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))e.preventDefault();
 if(code==='KeyM'){if(e.repeat)return;if(settings.music>0||settings.sfx>0){settings._lastMusic=settings.music||.37;settings._lastSfx=settings.sfx||.55;settings.music=0;settings.sfx=0;}else{settings.music=settings._lastMusic||.37;settings.sfx=settings._lastSfx||.55;}save('settings',settings);updateMusic();return;}
 if(code==='KeyF'){if(!e.repeat)toggleFullscreen();return;}
 if(code==='F3'){if(game&&!e.repeat)game.debug=!game.debug;return;}
 if(code==='Escape'){if(!e.repeat)goBack();return;}
 if(screen==='playing'){if(!e.repeat&&!held.has(code)&&act)pending.set(act,performance.now());held.add(code);return;}
 if(e.repeat)return;
 if(screen==='options'&&(code==='KeyQ'||code==='KeyE')){shiftOptionTab(code==='KeyQ'?-1:1);return;}
 if(screen==='select'&&/^Digit[1-4]$/.test(code)){selected=Number(code.slice(-1))-1;synth('select');return;}
 if(code==='ArrowDown'||code==='KeyS'){moveMenu(1);return;}
 if(code==='ArrowUp'||code==='KeyW'){moveMenu(-1);return;}
 if(code==='ArrowRight'||code==='KeyD'){if(screen==='options')adjustOption(1);else if(screen==='select')moveMenu(1);return;}
 if(code==='ArrowLeft'||code==='KeyA'){if(screen==='options')adjustOption(-1);else if(screen==='select')moveMenu(-1);return;}
 if(code==='Enter'||code==='Space'){menuChoice();return;}
});
window.addEventListener('keyup',e=>held.delete(physicalCode(e)));
window.addEventListener('blur',()=>{resetInput();if(screen==='playing')goBack();});
window.addEventListener('gamepaddisconnected',e=>{gpPrev.delete(e.gamepad?.index);if(screen==='playing'){resetInput();game.announcement='ГЕЙМПАД ОТКЛЮЧЁН';game.announceT=180;goBack();}});
if(document.addEventListener)document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(screen==='playing')goBack();}});
canvas.addEventListener('pointerdown',e=>{canvas.focus();ensureAudio();const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
 if(screen==='menu'){if(x>=144&&x<=336&&y>=119&&y<239){menuIndex=clamp(Math.floor((y-121)/24),0,BUTTONS.length-1);menuChoice();}}
 else if(screen==='select'){if(y>70&&y<220){selected=clamp(Math.floor((x-10)/118),0,3);synth('select');}else if(y>226)menuChoice();}
 else if(screen==='options'){if(y>=71&&y<232&&x>=28&&x<=452){optionIndex=clamp(optionScroll()+Math.floor((y-73)/20),0,OPTION_GROUPS[optionTab].length-1);if(optionIndex===OPTION_GROUPS[optionTab].length-1||optionTab===3&&optionIndex!==BINDING_ACTIONS.length||optionTab===0&&optionIndex===3)menuChoice();else adjustOption(x<240?-1:1);}else optionPointer(x,y);}
 else if(screen==='paused'){if(x>=139&&x<=343&&y>106&&y<216){menuIndex=clamp(Math.floor((y-109)/27),0,3);menuChoice();}}
 else if(screen==='controls'||screen==='credits')goBack();else if(screen==='stageclear'||screen==='gameover'||screen==='victory')menuChoice();
});

canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;canvas.style.cursor=screen==='playing'?'default':'pointer';if(screen==='menu'&&x>=144&&x<=336&&y>=119&&y<239)menuIndex=clamp(Math.floor((y-121)/24),0,4);if(screen==='paused'&&x>=139&&x<=343&&y>106&&y<216)menuIndex=clamp(Math.floor((y-109)/27),0,3);});
canvas.addEventListener('wheel',e=>{if(screen==='options'){e.preventDefault();moveMenu(e.deltaY>0?1:-1);}},{passive:false});

function resizeCabinet(){
 const el=document.getElementById('cabinet');const full=!!document.fullscreenElement;
 const vw=Math.max(240,(window.innerWidth||960)-(full?0:24)),vh=Math.max(135,(window.innerHeight||620)-(full?0:150));
 const fit=Math.min(vw/W,vh/H);const scale=settings.pixelPerfect&&fit>=1?Math.max(1,Math.floor(fit)):fit;
 if(!full){el.style.width=Math.floor(W*scale)+'px';el.style.height=Math.floor(H*scale)+'px';}
 canvas.style.width=Math.floor(W*scale)+'px';canvas.style.height=Math.floor(H*scale)+'px';if(renderer3d){renderer3d.canvas.style.width=canvas.style.width;renderer3d.canvas.style.height=canvas.style.height;}
 const bufferScale=Math.max(1,Math.min(8,Math.ceil(scale*(window.devicePixelRatio||1))));if(bufferScale!==RENDER_SCALE||canvas.width!==W*bufferScale){RENDER_SCALE=bufferScale;canvas.width=W*bufferScale;canvas.height=H*bufferScale;ctx.imageSmoothingEnabled=false;}
}
window.addEventListener('resize',resizeCabinet);window.addEventListener('fullscreenchange',resizeCabinet);resizeCabinet();
function toggleFullscreen(){const el=document.getElementById('cabinet');if(!document.fullscreenElement){el.requestFullscreen?.().catch(()=>{});}else document.exitFullscreen?.().catch(()=>{});}
document.getElementById('fullscreen').addEventListener('click',toggleFullscreen);
document.getElementById('sound').addEventListener('click',()=>{ensureAudio();settings._lastMusic=settings._lastMusic||.37;settings._lastSfx=settings._lastSfx||.55;if(settings.music>0||settings.sfx>0){settings._lastMusic=settings.music;settings._lastSfx=settings.sfx;settings.music=0;settings.sfx=0;}else{settings.music=settings._lastMusic;settings.sfx=settings._lastSfx;}save('settings',settings);updateMusic();});
// 60 Hz fixed simulation; catch up at most five ticks after a long browser stall.
function loop(ts){if(!last)last=ts;const elapsed=clamp(ts-last,0,83.35);last=ts;acc=Math.min(acc+elapsed,TICK*5);let steps=0;
 while(acc>=TICK&&steps<5){frame++;menuTick++;if(screen==='playing')tickGame();else tickMenu();acc-=TICK;steps++;}
 tickMusic();drawFrame();requestAnimationFrame(loop);}
requestAnimationFrame(loop);updateMusic();
// Safe diagnostic interface for automated smoke tests and future level building.
window.HIVEBREAK={get evolution(){return evolution},upgrade,ui(action,value){ensureAudio();if(action==='back')goBack();else if(action==='choose')menuChoice();else if(action==='class'&&screen==='select')selected=clamp(value,0,3);else if(action==='tab'&&screen==='options'){optionTab=value;optionIndex=0;}else if(action==='option'&&screen==='options'){optionIndex=value.index;adjustOption(value.dir);}else if(action==='pause'&&screen==='playing')goBack();},get uiState(){return {screen,selected,optionTab,optionIndex,options:OPTION_GROUPS[optionTab],values:optionValues(),points:progression?progression.points(evolution[selected]):0}},get music(){return {playing:activeTrack>=0&&!soundtrack[activeTrack].paused,seconds:activeTrack>=0?soundtrack[activeTrack].currentTime:0,style:settings.musicStyle,track:activeTrack>=0?(settings.musicStyle==='rock'?'rock_':'')+tracks[activeTrack]:null}},get renderer(){const active=!!renderer3d&&!renderer3d.failed&&!renderer3d.lost&&settings.threeD!==false;return {...renderer3d?.stats,active,error:rendererError,backend:active?'WebGL2':'Canvas2D'}},get screen(){return screen},get coop(){return coop},get joined(){return joined},get state(){return game},get classes(){return CLASS.map(x=>x.id)},get enemyTypes(){return Object.keys(ENEMY)},get levels(){return LEVELS.map(({id,name,length,waves,bossName})=>({id,name,length,waves,bossName}))},get assetErrors(){return [...loadErrors]},get ready(){return ready&&(!window.HiveRenderer||settings.threeD===false||rendererAttempted&&(!renderer3d||renderer3d.failed||renderer3d.ready))},get settings(){return Object.assign({},settings)},simulate(ticks=1){for(let i=0;i<Math.min(600,Math.max(0,Math.floor(ticks)));i++)if(screen==='playing')tickGame()},configure(options={}){for(const key of ['threeD','reflections','bloom','pixelization','shake','flashes'])if(typeof options[key]==='boolean')settings[key]=options[key];if(Number.isInteger(options.quality3d))settings.quality3d=clamp(options.quality3d,0,2);save('settings',settings);resizeCabinet()},start(classId=0){selected=clamp(classId,0,3);coop=false;joined=false;beginRun()},select(classId){selected=clamp(classId,0,3)},setLevel(i){if(game&&i>=0&&i<LEVELS.length)startStage(i)},spawnBoss(){if(game)spawnBoss()},damageBoss(amount){if(game?.boss&&!game.boss.dead){game.boss.hp-=amount;if(game.boss.hp<=0)killBoss()}},advance(){if(game)advanceStage()},get enemies(){return game?.enemies||[]},get players(){return game?.players||[]}};
})();
