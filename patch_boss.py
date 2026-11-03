from pathlib import Path
p=Path(__file__).resolve().parent/'game.js';s=p.read_text()
def rep(a,b):
 global s
 assert a in s,a[:100];s=s.replace(a,b)
def fn(name,new):
 global s
 i=s.index('function '+name+'(');a=s.index('{',i);lvl=0
 for k in range(a,len(s)):
  if s[k]=='{':lvl+=1
  elif s[k]=='}':
   lvl-=1
   if lvl==0:break
 s=s[:i]+new+s[k+1:]
rep("anim:'xeno_animation_10x4.png',font:'pixel_font.png'", "anim:'xeno_animation_10x4.png',font:'pixel_font.png',bossGuardian:'boss_guardian_8x3.png',bossSiege:'boss_siege_8x3.png',bossQueen:'boss_queen_8x3.png'")
rep("stun:0,vz:0,walk:0,dead:false,deathT:0", "stun:0,vz:0,walk:0,dashT:0,dashVictims:new Set(),dead:false,deathT:0")
fn('updateBoss', '''function updateBoss(){
 const b=game.boss;if(!b)return;
 if(b.dead){if(game.bossDown>0){game.bossDown--;if(game.bossDown%12===0)burst(b.x+rand(-54,49),b.y-rand(20,130),'#d0ff75',11,3);if(game.bossDown===0)finishStage();}return;}
 b.walk+=.075;if(b.flash>0)b.flash--;if(b.hurt>0)b.hurt--;
 const oldPhase=b.phase;b.phase=b.hp<b.maxHp*.28?3:b.hp<b.maxHp*.63?2:1;
 if(oldPhase!==b.phase){b.cool=85;game.flash=17;game.shake=11;game.announcement='PHASE '+b.phase+'  /  '+(b.phase===3?'HIVE FURY':'AGGRESSION');game.announceT=108;burst(b.x,b.y-95,'#b6ff81',60,3.6);synth('boss');}
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
  floating(b.x,b.y-143,{acid:'ACID SPIT!',slam:'GROUND SLAM!',tail:'TAIL SWEEP!',charge:'CHARGE!',summon:'HIVE REINFORCEMENTS!'}[b.attackKind],'#ffdc9b',50);
 }
}
''')
fn('drawBoss', '''function drawBoss(){
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
 if(b.wind>0){const color=b.attackKind==='acid'?'#a7ff72':b.attackKind==='charge'?'#ffaf70':'#ffcd73';T(b.attackKind.toUpperCase(),x,y-h-12,8,color,'center');B(x-27,y-h-4,54,3,1-b.wind/48,color);}
 if(b.flash>0&&game.tick%4<2){ctx.save();ctx.globalAlpha=.12;ellipse(x,y-86,49,70,'#d7ffae');ctx.restore();}
}
''')
# Visual gear ejected from guns, and extra muzzle flash
rep("e.fire=8;burst(x,y,'#ffe080'", "e.fire=8;if(e.type==='gunner'||e.type==='marine'||e.type==='heavy'){for(let k=0;k<2;k++){game.particles.push({x:e.x+e.face*6,y:e.y-44,vx:-e.face*rand(.6,1.9),vy:-rand(1.0,2.1),t:rand(22,42),maxT:42,size:1.4,color:'#cab777',gravity:.15});}}burst(x,y,'#ffe080'")
p.write_text(s)
print('boss patch complete',len(s))
