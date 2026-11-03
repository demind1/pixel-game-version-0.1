from pathlib import Path
p=Path(__file__).resolve().parent/'game.js';s=p.read_text()
def rep(old,new):
 global s
 assert old in s,old[:100];s=s.replace(old,new)
def fn(name,new):
 global s
 start=s.index('function '+name+'('); b=s.index('{',start);depth=0
 for j in range(b,len(s)):
  if s[j]=='{':depth+=1
  elif s[j]=='}':
   depth-=1
   if depth==0:break
 s=s[:start]+new+s[j+1:]
# Portable zero-dependency software-3D geometry. Only scenic objects use this.
mesh='''
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
   T('SEC',x-35,147,8,'#b9a76b');if(settings.pixel3d)softwareMesh(meshCube,x+38,140,11,tick*.004+i,'#c4a15f');
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
'''
rep('function R(x,y,w,h,color)',mesh+'\nfunction R(x,y,w,h,color)')
# inject sector decorative art before floor, preserve parallax
rep('R(0,176,W,3,\'#a5b8be\');','drawSectorArt(level,camera,tick);\n R(0,176,W,3,\'#a5b8be\');')
# add reflection tiled floor variants + semi-transparent moving shimmer
rep('R(0,267,W,3,\'#050a14\');',"R(0,267,W,3,'#050a14');\n if(settings.ambient>0){for(let i=0;i<8;i++){const px=((i*79-camera*.63)%610+610)%610;const op=.06+.05*Math.sin(tick*.014+i);ctx.save();ctx.globalAlpha=Math.max(0,op);R(px,195+(i%3)*14,24,1,lev.tone);ctx.restore();}}")
# protagonist animation indices 10 frames, distinct timings with recovery
rep('idx=clamp(Math.floor(p.attackT/(atk.startup+atk.active+atk.recovery)*4),0,3);',"idx=clamp(Math.floor(p.attackT/(atk.startup+atk.active+atk.recovery)*10),0,9);")
rep('idx=3-p.dodge%4;', 'idx=9-Math.floor(p.dodge/2)%10;')
rep('idx=p.vz>0?1:2;', 'idx=p.vz>0?3:7;')
rep('idx=Math.floor(p.walking)%4;', 'idx=Math.floor(p.walking*2.4)%10;')
rep('idx=Math.floor(p.anim/18)%4;', 'idx=Math.floor(p.anim/9)%10;')
# draw trails behind body not ahead: add after x,y ... before main atlas, low alpha
rep("let alpha=p.inv>0&&Math.floor(game.tick/4)%2===0?.46:1;drawAtlas(p.classId,row,idx,x,y,p.face,alpha);", "for(const q of p.trail){drawAtlas(p.classId,q.row,q.frame,q.x-game.camera,q.y,p.face,Math.min(.14,q.t*.014),.99);}\n let alpha=p.inv>0&&Math.floor(game.tick/4)%2===0?.46:1;drawAtlas(p.classId,row,idx,x,y,p.face,alpha);")
rep("if(p.attack){const atk=ATTACKS[p.attack];if(p.attackT>=atk.startup", "if(p.attack){const atk=ATTACKS[p.attack];if(p.attackT>=atk.startup")
# make slashes pixelated 3 stroke sweeps better; original effects remain but thinner
rep("ctx.lineWidth=p.attack==='super'?5:2.5;", "ctx.lineWidth=p.attack==='super'?4:2;")
# players' HP lag shader, need text uses original font atlas.
rep("B(x+28,23,max-34,3,p.hp/p.maxHp,p.hp/p.maxHp<.29?'#f65a58':'#d8e56a');", "B(x+28,23,max-34,3,(p.oldHp||p.hp)/p.maxHp,'#b16b54');B(x+28,23,max-34,3,p.hp/p.maxHp,p.hp/p.maxHp<.29?'#f65a58':'#d8e56a');")
# Replace entire sprite drawing for marine with animated counter-poses + special gear.
fn('drawMarine', '''function drawMarine(e){
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
  ctx.filter=ENEMY[e.type].shade;ctx.drawImage(A.soldier,-33*big,-65*big,66*big,65*big);ctx.filter='none';
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
''')
rep('background(g.level,g.camera,g.tick);drawHazards();drawPuddles();drawProps();drawItems();', 'background(g.level,g.camera,g.tick);drawHazards();drawBloodAndDecals();drawPuddles();drawProps();drawItems();')
# HUD avoid severe overflows; safer background and higher contrast option
rep("R(0,0,W,30,'#040b14');", "R(0,0,W,30,settings.hiContrast?'#000000':'#040b14');")
# richer menu with animated 3D hologram and faded moving horizontal sparklines
rep("R(0,0,W,H,'rgba(1,8,18,.72)');glow(240,48,140,'#66d6ed',.11);", "R(0,0,W,H,'rgba(1,8,18,.72)');\n if(settings.pixel3d){softwareMesh(meshOcta,402,90,27,menuTick*.012,'#59dce9','wire');torusRing(403,91,43,18,menuTick*.019,'#4e96ae');}\n for(let i=0;i<7;i++){const yy=27+i*32;R((menuTick*(i%2?-.36:.27)+i*99+1000)%520-30,yy,18,1,'rgba(102,226,231,.18)');}\n glow(240,48,140,'#66d6ed',.11);")
rep("T('ARCADE  //  ORIGINAL RETRO PROJECT  //  BUILD 0.7'", "T('ARCADE  /  ORIGINAL RETRO PROJECT  /  BUILD 0.7'")
# fix originalMusic setting from updateMusic in first patch and xfade fallback
rep("const target=playable.includes(screen)&&settings.music>0?wanted:-1;", "const target=playable.includes(screen)&&settings.music>0?(settings.originalMusic&&wanted===0?-2:wanted):-1;\n if(target===-2){if(music.paused){music.volume=0;music.play().catch(()=>{});}activeTrack=-2;}else if(activeTrack===-2){activeTrack=-1;}")
rep("if(activeTrack>=0){const a=soundtrack[activeTrack];", "if(activeTrack>=0){const a=soundtrack[activeTrack];")
rep("function tickMusic(){for(let i=0;i<soundtrack.length;i++){", "function tickMusic(){const goal=activeTrack===-2?settings.music:0;if(!music.paused){music.volume=clamp(music.volume+(goal-music.volume)*.075,0,1);if(goal===0&&music.volume<.01){music.pause();music.volume=0;}}for(let i=0;i<soundtrack.length;i++){" )
rep("const out={x:Math.abs(x)>.24?x:", "const out={x:Math.abs(x)>.24?x:")
rep("['U / LT','CLASS ULTIMATE (80 ENERGY)']", "['U / LT','CLASS ULTIMATE 80 ENERGY']")
rep("T('SINGLE PLAYER + LOCAL SHARED-SCREEN CO-OP'", "T('SINGLE PLAYER + LOCAL SHARED-SCREEN CO-OP'")
# fix menu width on file; credits mention original assets and synthesized tracks
rep("'ART & AUDIO: USER-SUPPLIED ASSETS'", "'ART: PROVIDED REFERENCES / REMIXED FRAMES'")
rep("'ORIGINAL ARCADE INSPIRED GAMEPLAY'", "'MUSIC: NEW ORIGINAL SYNTH LOOP SET'")
# gamepad right bumper selection of option tabs in settings; and keys already Q/E
rep("if(inp.jump||inp.select)menuChoice();", "if(screen==='options'&&inp.special)shiftOptionTab(1);if(inp.jump||inp.select)menuChoice();")
# debug interface extend coverage
rep("get classes(){return CLASS.map(x=>x.id)}", "get classes(){return CLASS.map(x=>x.id)},get enemyTypes(){return Object.keys(ENEMY)}")
p.write_text(s)
print('visual patch complete',len(s))
