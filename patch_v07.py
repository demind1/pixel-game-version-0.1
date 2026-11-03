from pathlib import Path
p=Path(__file__).resolve().parent/'game.js'
s=p.read_text()
def replace(old,new):
 global s
 assert old in s, 'missing '+repr(old[:120]);s=s.replace(old,new)
def repfn(name,new):
 global s
 start=s.index('function '+name+'(')
 brace=s.index('{',start)
 depth=0;end=None
 for pos in range(brace,len(s)):
  ch=s[pos]
  if ch=='{':depth+=1
  elif ch=='}':
   depth-=1
   if depth==0:end=pos+1;break
 assert end is not None,name
 s=s[:start]+new+s[end:]
replace('/* XENOMORPH: HIVEBREAK — ARCADE REMASTER','/* XENOMORPH: HIVEBREAK — ULTIMATE ARCADE REMASTER v0.7')
replace("const music=document.getElementById('music'),loadout=document.getElementById('loadout');", "const music=document.getElementById('music'),loadout=document.getElementById('loadout');")
replace("menuScene:'menu_scene.jpg',soldier:","menuScene:'menu_scene.jpg',anim:'xeno_animation_10x4.png',font:'pixel_font.png',soldier:")
replace("{difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false}","{difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,voice:false}")
replace("{id:'reactor',name:'INFESTED REACTOR CORE'", "{id:'reactor',name:'INFESTED REACTOR CORE'")
replace("['marine','marine','heavy']", "['marine','marine','medic','heavy']")
replace("['marine','shield','marine','grenadier']", "['marine','shield','gunner','grenadier']")
replace("['heavy','marine','flame','marine']", "['heavy','marine','flame','drone']")
replace("['shield','android','grenadier','heavy']", "['shield','android','grenadier','heavy','medic']")
replace("['marine','android','flame','heavy','marine']", "['marine','android','flame','heavy','gunner','drone']")
replace("['marine','heavy','turret']", "['marine','gunner','heavy','turret']")
replace("['shield','marine','grenadier','heavy']", "['shield','medic','grenadier','heavy']")
replace("['flame','marine','android','turret']", "['flame','marine','drone','turret']")
replace("['shield','heavy','grenadier','android']", "['shield','heavy','grenadier','android','medic']")
replace("['heavy','flame','marine','turret','android']", "['heavy','flame','gunner','turret','android','drone']")
replace("['android','marine','flame']", "['android','marine','drone','flame']")
replace("['shield','grenadier','android','heavy']", "['shield','grenadier','android','gunner']")
replace("['turret','marine','flame','shield','grenadier']", "['turret','marine','flame','shield','medic','grenadier']")
replace("['android','heavy','android','flame']", "['android','heavy','drone','flame','gunner']")
replace("['turret','grenadier','heavy','shield','android','marine']", "['turret','grenadier','gunner','shield','android','marine','drone']")
replace("turret:{hp:92,speed:0,damage:11,score:500,range:185,shade:'none',scale:1}","turret:{hp:92,speed:0,damage:11,score:500,range:185,shade:'none',scale:1},\nmedic:{hp:58,speed:.63,damage:5,score:600,range:125,shade:'saturate(.7) hue-rotate(50deg) brightness(1.08)',scale:.96},\ngunner:{hp:118,speed:.34,damage:6.5,score:750,range:185,shade:'brightness(.76) contrast(1.1)',scale:1.18,armor:.20},\ndrone:{hp:63,speed:1.1,damage:8,score:530,range:155,shade:'none',scale:.78}")
replace("super:{startup:16,active:14,recovery:25,damage:90,reach:148,depth:65,knock:38,stun:33,hitstop:6,anim:3}","super:{startup:16,active:14,recovery:25,damage:90,reach:148,depth:65,knock:38,stun:33,hitstop:6,anim:3},\nfinisher:{startup:5,active:8,recovery:17,damage:40,reach:105,depth:32,knock:28,stun:25,hitstop:5,anim:3},\nacidclaw:{startup:8,active:6,recovery:17,damage:53,reach:110,depth:42,knock:15,stun:17,hitstop:4,anim:2},\npredator:{startup:13,active:10,recovery:19,damage:64,reach:128,depth:57,knock:34,stun:27,hitstop:6,anim:3},\nripper:{startup:4,active:25,recovery:14,damage:17,reach:91,depth:36,knock:8,stun:9,hitstop:2,anim:2},\ncounter:{startup:4,active:24,recovery:16,damage:30,reach:78,depth:37,knock:25,stun:18,hitstop:5,anim:3}")
replace("let screen='menu',selected=0,coop=false,joined=false,selected2=1,menuIndex=0,optionIndex=0,menuTick=0,menuCooldown=0;","let screen='menu',selected=0,coop=false,joined=false,selected2=1,menuIndex=0,optionIndex=0,optionTab=0,menuTick=0,menuCooldown=0;")
replace("let audioCtx=null,masterNode=null,sfxNode=null,musicNode=null;", "let audioCtx=null,masterNode=null,sfxNode=null,musicNode=null;\nconst tracks=['stage01','stage02','stage03','boss01','boss02','boss03'];\nconst soundtrack=tracks.map(name=>{const a=new Audio('assets/'+name+'.ogg');a.loop=true;a.preload='none';return a;});\nlet activeTrack=-1,fadeTrack=-1;\nconst OPTION_GROUPS=[['DIFFICULTY','ARCADE VIOLENCE','DAMAGE NUMBERS','RESET ALL SETTINGS','BACK'],['PIXEL 3D SCENERY','PARTICLE QUALITY','AMBIENT EFFECTS','SCREEN SHAKE','SCREEN FLASHES','SCANLINES','HIGH CONTRAST HUD','BACK'],['MUSIC VOLUME','SFX VOLUME','ORIGINAL LEVEL 1 TRACK','BACK']];")
replace("airborne:false,dead:false,downT:0};", "airborne:false,dead:false,downT:0,oldHp:c.hp,trail:[],counterWindow:0,lastHit:0};")
replace("old.players.forEach((p,i)=>{p.x=68+i*43;", "old.players.forEach((p,i)=>{p.x=68+i*43;")
replace("p.chain=0;p.rageT=0;p.dead=false;p.downT=0;if(keepPlayers)","p.chain=0;p.rageT=0;p.dead=false;p.downT=0;p.trail=[];p.counterWindow=0;p.oldHp=p.hp;if(keepPlayers)")
replace("old.players.forEach((p,i)=>{", "old.blood=[];old.decals=[];old.reactorPhase=0;old.players.forEach((p,i)=>{")
replace("game={level:0,players:p,", "game={blood:[],decals:[],level:0,players:p,")
replace("stun:0,hurt:0,flash:0,walk:rand(0,6),fire:0,shield:0", "stun:0,hurt:0,flash:0,walk:rand(0,6),fire:0,shield:0,healCd:210+rand(0,140),ammo:6,burstShots:0,burstTimer:0,deathStyle:Math.floor(rand(0,4)),targetLock:0,lastTarget:null")
replace("type,x,y,z:0,vz:0,vx:0,hp:", "type,x,y,z:type==='drone'?37:0,vz:0,vx:0,hp:")
replace("function spawnBoss(){", "function spawnBoss(){")
replace("g.shake=8;synth('boss');", "g.shake=8;synth('boss');updateMusic();")
replace("g.players.forEach(p=>addScore(p,3000));", "g.players.forEach(p=>addScore(p,3000));updateMusic();")
# New visual effects, original 16+/17+ style (non-photorealistic)
insert_fx='''
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
'''
replace("function damagePlayer(p,damage,from){",insert_fx+"\nfunction damagePlayer(p,damage,from){")
replace("if(p.dead||p.inv>0||p.dodge>0||p.stun>0)return;let amt", "if(p.dead||p.inv>0||p.dodge>0||p.stun>0)return;if(p.counterWindow>0){p.counterWindow=0;p.inv=22;p.attack='counter';p.attackT=ATTACKS.counter.startup;game.shake=Math.max(game.shake,5);synth('tail');floating(p.x,p.y-82,'COUNTER!','#f4e6a7',55);for(const e of game.enemies){if(!e.dead&&Math.abs(e.x-p.x)<95&&Math.abs(e.y-p.y)<38)hitTarget(p,e,{damage:37,stun:25,knock:26,hitstop:4},1);}return;}let amt")
replace("floating(e.x,e.y-54,String(amount),'#fff6b6',39);burst(e.x,e.y-31,amount>30?'#ffc676':'#e9f1ce',9,2.5);", "if(settings.damageNumbers)floating(e.x,e.y-54,String(amount),'#fff6b6',39);burst(e.x,e.y-31,amount>30?'#ffc676':'#e9f1ce',9,2.5);impactVFX(e.x,e.y-31,e.type!=='android'&&e.type!=='turret'&&e.type!=='drone',amount>32?1.2:.75);")
replace("floating(b.x,b.y-128,String(damage),'#fff3c8',46);", "if(settings.damageNumbers)floating(b.x,b.y-128,String(damage),'#fff3c8',46);impactVFX(b.x,b.y-89,true,damage>40?1.3:.65);")
replace("if(name==='super')p.energy=0;else if(['acidburst','impact','phantom','rage'].includes(name))p.energy-=35;", "if(name==='super')p.energy=0;else if(['acidclaw','predator','ripper','counter'].includes(name))p.energy=Math.max(0,p.energy-80);else if(['acidburst','impact','phantom','rage'].includes(name))p.energy-=35;")
replace("if(name==='super')p.energy=0;", "if(name==='super')p.energy=0;")
replace("if(action==='heavy'){name=p.airborne?'slam':'tail';}", "if(action==='heavy'){name=p.airborne?'slam':p.chainTick>0&&p.chain>=2?'finisher':'tail';}")
replace("if(action==='super'){if(p.energy<98)return;name='super';}", "if(action==='super'){if(p.energy<80)return;name=['acidclaw','predator','ripper','counter'][p.classId];}")
replace("if(type==='phantom'&&t>=atk.startup", "if(type==='counter'&&t===1)p.counterWindow=26;\n if(type==='ripper'&&t>=atk.startup&&t<atk.startup+atk.active){p.x+=p.face*1.9;if(t%6===0)p.hitTargets.clear();if(t%4===0)burst(p.x+p.face*24,p.y-35,'#afebf7',5,1.5);}\n if(type==='predator'&&t===atk.startup){game.shake=Math.max(game.shake,8);burst(p.x,p.y-7,'#d9b9ff',27,4);}\n if(type==='acidclaw'&&t===atk.startup){game.puddles.push({x:p.x+p.face*69,y:p.y,radius:35,t:175,lastHit:game.tick,owner:p});burst(p.x+p.face*46,p.y-34,'#adff5a',25,3);}\n if(type==='phantom'&&t>=atk.startup")
replace("if(p.inv>0)p.inv--;", "if(p.inv>0)p.inv--;if(p.counterWindow>0)p.counterWindow--;p.oldHp=lerp(p.oldHp,p.hp,.09);")
replace("p.anim++;", "if(p.attack&&game.tick%4===0&&p.attackT>0&&p.attackT<20)p.trail.push({x:p.x,y:p.y-p.z,t:9,row:ATTACKS[p.attack].anim,frame:clamp(Math.floor(p.attackT/3),0,9)});p.trail=p.trail.filter(a=>--a.t>0).slice(-5);p.anim++;")
# Enemy healer + gunner + drone ranged fire / AI
replace("if(e.type==='grenadier'){", "if(e.type==='grenadier'){")
replace("}else if(e.type==='flame'){", "}else if(e.type==='flame'){")
replace("  for(let i=0;i<(e.type==='heavy'?3:1);i++)", "  for(let i=0;i<(e.type==='heavy'?3:1);i++)")
replace("vx:e.face*(e.type==='heavy'?3.7:3.2)", "vx:e.face*(e.type==='heavy'?3.7:e.type==='gunner'?4.4:3.2)")
replace("if(e.type==='turret'||e.type==='grenadier'||e.type==='marine'||e.type==='heavy'||e.type==='flame'){spawnShot(e,target);}", "if(['turret','grenadier','marine','heavy','flame','gunner','medic','drone'].includes(e.type)){spawnShot(e,target);if(e.type==='gunner'){e.burstShots=5;e.burstTimer=7;}}")
replace("if(e.flash>0)e.flash--;if(e.hurt>0)e.hurt--;if(e.fire>0)e.fire--;e.walk+=.12;", "if(e.flash>0)e.flash--;if(e.hurt>0)e.hurt--;if(e.fire>0)e.fire--;e.walk+=.12;\n if(e.burstShots>0){if(--e.burstTimer<=0){const t=targetPlayer(e);if(t)spawnShot(e,t);e.burstShots--;e.burstTimer=7;}}\n if(e.type==='medic'&&--e.healCd<=0){const ally=game.enemies.filter(a=>a!==e&&!a.dead&&a.hp<a.maxHp*.79&&Math.abs(a.x-e.x)<165).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally){ally.hp=Math.min(ally.maxHp,ally.hp+22);burst(ally.x,ally.y-42,'#a9f7d4',19,1.5);floating(ally.x,ally.y-70,'+MEDIC','#b5ffc8',54);e.ai='healing';e.recover=35;synth('pickup',.55);}e.healCd=160+Math.floor(rand(0,70));}")
replace("if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<=0){e.z=0;e.vz=0;}}e.x+=e.vx;", "if(e.type==='drone'){e.z=35+Math.sin(game.tick*.075+e.id*3)*7;e.vz=0;}else if(e.z>0||e.vz>0){e.z+=e.vz;e.vz-=.3;if(e.z<=0){e.z=0;e.vz=0;}}e.x+=e.vx;")
replace("const desired=melee?30:e.type==='flame'?72:e.type==='grenadier'?132:e.type==='heavy'?93:113;", "const desired=melee?30:e.type==='flame'?72:e.type==='grenadier'?132:e.type==='heavy'?93:e.type==='gunner'?160:e.type==='medic'?145:e.type==='drone'?96:113;")
replace("e.wind=e.type==='heavy'?32:e.type==='android'?24:e.type==='grenadier'?39:e.type==='shield'?23:e.type==='flame'?28:19;", "e.wind=e.type==='gunner'?49:e.type==='heavy'?32:e.type==='android'?24:e.type==='grenadier'?39:e.type==='shield'?23:e.type==='flame'?28:e.type==='drone'?18:19;")
replace("e.recover=e.type==='heavy'?33:e.type==='android'?26:21;", "e.recover=e.type==='gunner'?52:e.type==='heavy'?33:e.type==='android'?26:21;")
replace("if(e.cool<=0&&ad<(melee?54:e.type==='grenadier'?185:165)", "if(e.cool<=0&&ad<(melee?54:e.type==='grenadier'?185:e.type==='gunner'?210:165)")
# fix all source overwrites render should be pure.
replace("if((o.breakT||0)<22){o.breakT=(o.breakT||0)+1;R(x-14,y-9,28,4,'#503f2c');}", "if((o.breakT||0)<22){R(x-14,y-9,28,4,'#503f2c');}")
# Audio and track crossfades
repfn('updateMusic', '''function updateMusic(){
 const playable=['playing','menu','select','stageclear','victory','options','credits','controls'];
 const wanted=game&&['playing','paused','stageclear','gameover'].includes(screen)?(game.boss&&!game.boss.dead?3+game.level:game.level):0;
 const target=playable.includes(screen)&&settings.music>0?wanted:-1;
 if(target!==activeTrack){
   fadeTrack=activeTrack;activeTrack=target;
   if(activeTrack>=0){const a=soundtrack[activeTrack];if(a.paused){a.currentTime=0;a.volume=0;a.play().catch(()=>{});}}
 }
 const button=document.getElementById('sound');button.textContent=settings.music===0&&settings.sfx===0?'♫ OFF':'♫ ON';
}
function tickMusic(){for(let i=0;i<soundtrack.length;i++){const a=soundtrack[i],goal=i===activeTrack?settings.music:0;
 if(i!==activeTrack&&a.paused)continue;
 const next=a.volume+(goal-a.volume)*.075;a.volume=clamp(next,0,1);
 if(i!==activeTrack&&a.volume<.009){a.pause();a.volume=0;}
 }}''')
replace("drawFrame();requestAnimationFrame(loop);", "tickMusic();drawFrame();requestAnimationFrame(loop);")
# Additional source-backed procedural visual text atlas -- exact glyph pixel grid
repfn('T', '''function T(str,x,y,size=7,color='#f1f5ee',align='left'){
 str=String(str).toUpperCase();x=Math.round(x);y=Math.round(y);
 if(activeImage('font')){
   const glyphW=9,glyphH=12,dw=size*glyphW/glyphH,dh=size;
   let width=0;for(const c of str)width+=dw;
   if(align==='center')x-=Math.round(width/2);else if(align==='right')x-=Math.round(width);
   const key=color.toLowerCase();let tinted=fontTints.get(key);
   if(!tinted){tinted=document.createElement('canvas');tinted.width=A.font.naturalWidth;tinted.height=A.font.naturalHeight;
     const tc=tinted.getContext('2d');tc.drawImage(A.font,0,0);tc.globalCompositeOperation='source-in';tc.fillStyle=color;tc.fillRect(0,0,tinted.width,tinted.height);fontTints.set(key,tinted);}
   let cx=x;for(const ch of str){const code=ch.charCodeAt(0);if(code>=32&&code<=126){const ci=code-32;ctx.drawImage(tinted,(ci%16)*glyphW,Math.floor(ci/16)*glyphH,glyphW,glyphH,Math.round(cx),y,Math.ceil(dw),Math.ceil(dh));}
    else if(ch==='▶'){R(cx+2,y+2,dw-4,dh-4,color);}cx+=dw;}
   return;
 }
 ctx.font=`bold ${size}px Consolas,monospace`;ctx.textBaseline='top';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(str,x,y);
}
const fontTints=new Map();''')
# Animation 10 frames per row and pose-dependent glow
repfn('drawAtlas', '''function drawAtlas(classId,row,index,x,y,face=1,opacity=1,extraScale=1){
 const name=activeImage('anim')?'anim':'sheet';if(!activeImage(name))return;
 const im=A[name],cols=name==='anim'?10:4,fw=im.naturalWidth/cols,fh=im.naturalHeight/4;
 const c=CLASS[classId],dw=107*c.scale*extraScale,dh=107*c.scale*extraScale;
 const ci=clamp(Math.floor(index),0,cols-1),ri=clamp(Math.floor(row),0,3);
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(Math.round(x),Math.round(y));ctx.scale(face,1);ctx.filter=`hue-rotate(${c.hue}deg) saturate(${classId===3?1.25:1.11})`;
 ctx.drawImage(im,ci*fw,ri*fh,fw,fh,-Math.round(dw*.64),-Math.round(dh*.87),Math.round(dw),Math.round(dh));ctx.restore();
}''')
# Add blood decal lifetime + particle intensity
replace("for(const o of g.props){if(o.dead)o.breakT=Math.min(30,(o.breakT||0)+1);}","for(const o of g.props){if(o.dead)o.breakT=Math.min(30,(o.breakT||0)+1);}for(let i=g.blood.length-1;i>=0;i--){if(--g.blood[i].t<=0)g.blood.splice(i,1);}for(let i=g.decals.length-1;i>=0;i--){if(--g.decals[i].life<=0)g.decals.splice(i,1);}")
replace("q.vy+=.07;", "q.vy+=q.gravity||.07;")
replace("game.particles.length<420", "game.particles.length<(settings.particles===0?90:settings.particles===1?240:540)")
# Menu polish and display version
replace("BUILD 0.6", "BUILD 0.7")
replace("'16-BIT ARCADE REMASTER'", "'ULTIMATE ARCADE REMASTER'")
replace("T('CONTROLS: J CLAW  K TAIL  L SPECIAL  SHIFT DODGE'", "T('J CLAW  K TAIL  L SPECIAL  U ULTIMATE  SHIFT DODGE'")
# simpler option groups with page switching Q/E
repfn('drawOptions', '''function drawOptions(){menuBackdrop();T('OPTIONS  //  SYSTEM CONFIG',240,21,17,'#ffe2a8','center');
 const tabs=['GAMEPLAY','GRAPHICS','AUDIO'];tabs.forEach((n,i)=>{const x=36+i*140;R(x,48,128,17,i===optionTab?'#345766':'#101e2c');R(x,48,128,1,i===optionTab?'#f4d078':'#345065');T(n,x+64,51,8,i===optionTab?'#f8e4b8':'#94b9c6','center');});
 const groups=OPTION_GROUPS[optionTab];const vals=optionTab===0?[["ROOKIE","ARCADE","NIGHTMARE"][settings.difficulty],["LOW","NORMAL","HIGH"][settings.violence],settings.damageNumbers?'ON':'OFF','CONFIRM','']:optionTab===1?[settings.pixel3d?'ON':'OFF',["LOW","MED","HIGH"][settings.particles],["OFF","LOW","HIGH"][settings.ambient],settings.shake?'ON':'OFF',settings.flashes?'ON':'OFF',settings.scanlines?'ON':'OFF',settings.hiContrast?'ON':'OFF','']:[Math.round(settings.music*100)+'%',Math.round(settings.sfx*100)+'%',settings.originalMusic?'ON':'OFF',''];
 const rowHeight=20,startY=73;groups.forEach((name,i)=>{const y=startY+i*rowHeight;if(optionIndex===i){R(43,y-2,395,19,'rgba(56,101,120,.78)');R(43,y-2,3,19,'#ffe183');}T(name,52,y,8,optionIndex===i?'#ffe5a7':'#bddce6');T(vals[i],427,y,8,optionIndex===i?'#ffffff':'#94d1d5','right');});
 T('Q / E  CHANGE TAB    ◀ ▶  ADJUST',240,242,7,'#b4dddb','center');T('ENTER SELECT  /  ESC BACK',240,254,6,'#8fbfce','center');}
''')
repfn('adjustOption', '''function adjustOption(dir){
 const len=OPTION_GROUPS[optionTab].length;
 if(optionIndex===len-1){if(dir===0){changeScreen(game?'paused':'menu');menuIndex=0;}return;}
 if(optionTab===0){switch(optionIndex){case 0:settings.difficulty=(settings.difficulty+dir+3)%3;break;case 1:settings.violence=(settings.violence+dir+3)%3;break;case 2:settings.damageNumbers=!settings.damageNumbers;break;case 3:if(dir===0)Object.assign(settings,{difficulty:1,music:.37,sfx:.55,shake:true,flashes:true,scanlines:false,violence:1,particles:2,ambient:2,hiContrast:false,damageNumbers:true,pixel3d:true,originalMusic:false});break;}}
 else if(optionTab===1){switch(optionIndex){case 0:settings.pixel3d=!settings.pixel3d;break;case 1:settings.particles=(settings.particles+dir+3)%3;break;case 2:settings.ambient=(settings.ambient+dir+3)%3;break;case 3:settings.shake=!settings.shake;break;case 4:settings.flashes=!settings.flashes;break;case 5:settings.scanlines=!settings.scanlines;break;case 6:settings.hiContrast=!settings.hiContrast;break;}}
 else{switch(optionIndex){case 0:settings.music=clamp(Math.round(settings.music*20+dir)/20,0,1);break;case 1:settings.sfx=clamp(Math.round(settings.sfx*20+dir)/20,0,1);break;case 2:settings.originalMusic=!settings.originalMusic;break;}}
 save('settings',settings);updateMusic();synth('select',.3);
}
function shiftOptionTab(n){optionTab=(optionTab+n+3)%3;optionIndex=0;synth('select',.35);}
''')
replace("else if(screen==='options'){if(optionIndex===6){changeScreen(game?'paused':'menu');menuIndex=0;}else adjustOption(1);}","else if(screen==='options'){if(optionIndex===OPTION_GROUPS[optionTab].length-1){changeScreen(game?'paused':'menu');menuIndex=0;}else adjustOption(0);}")
replace("else if(screen==='options')optionIndex=(optionIndex+dir+7)%7;", "else if(screen==='options')optionIndex=(optionIndex+dir+OPTION_GROUPS[optionTab].length)%OPTION_GROUPS[optionTab].length;")
replace("if(screen==='select'&&key>='1'", "if(screen==='options'&&(key==='q'||key==='Q'||key==='e'||key==='E')){shiftOptionTab(key.toLowerCase()==='q'?-1:1);return;}\n if(screen==='select'&&key>='1'")
replace("if(screen==='options')adjustOption(Math.sign(inp.x));", "if(screen==='options')adjustOption(Math.sign(inp.x));")
replace("else if(screen==='options'){if(y>=68&&y<248){optionIndex=clamp(Math.floor((y-70)/25),0,6);menuChoice();}}", "else if(screen==='options'){if(y>=46&&y<68){optionTab=clamp(Math.floor((x-36)/140),0,2);optionIndex=0;synth('select');}else if(y>=70&&y<238){optionIndex=clamp(Math.floor((y-73)/20),0,OPTION_GROUPS[optionTab].length-1);menuChoice();}}")
replace("T('U / LT','SUPER (100 ENERGY)'", "T('U / LT','CLASS ULTIMATE (80 ENERGY)'") if "T('U / LT','SUPER (100 ENERGY)'" in s else None
replace("['U / LT','SUPER (100 ENERGY)']", "['U / LT','CLASS ULTIMATE (80 ENERGY)']")
# e.g. menu music on return
replace("game=null;changeScreen('menu');", "game=null;changeScreen('menu');")
replace("if(game?.boss&&!game.boss.dead)", "if(game?.boss&&!game.boss.dead)") if False else None
# work out music: user-supplied original stage1 optional toggle
replace("const a=soundtrack[activeTrack];if(a.paused)", "const a=soundtrack[activeTrack];if(a.paused)")
# Save
p.write_text(s)
print('patched',p,len(s))
