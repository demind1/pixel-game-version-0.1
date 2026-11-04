import * as T from 'three';
import { CharacterLibrary } from './characters.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TAU=Math.PI*2;
const PALETTES=[
 {base:0x14242e,trim:0x41616c,light:0x5de6e4,accent:0xffb35d,fog:0x06121c},
 {base:0x272c2c,trim:0x59625d,light:0xffb95e,accent:0x6bc6ed,fog:0x13151b},
 {base:0x25202f,trim:0x5f526e,light:0xd787ff,accent:0x84e8bd,fog:0x120d20},
 {base:0x162c3c,trim:0x5b8b9c,light:0x74e5ff,accent:0xe0faff,fog:0x071824},
 {base:0x242b3c,trim:0x627084,light:0xffb674,accent:0x6aa8ff,fog:0x0a1123},
 {base:0x232b27,trim:0x586354,light:0xb1f873,accent:0xf8c070,fog:0x0a1512}
];
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};

class HiveRenderer {
 constructor(config){
  this.config=config;this.failed=false;this.lost=false;this.stage=-1;this.rigs=new Map();this.clock=0;this.quality=-1;
  this.canvas=document.createElement('canvas');
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
  this.renderer.info.autoReset=false;this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x06101a);
  this.camera=new T.PerspectiveCamera(23.8,16/9,2,1800);
  this.scene.add(new T.HemisphereLight(0xa1c7e7,0x151c20,1.0));
  const pmrem=new T.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
  this.key=new T.DirectionalLight(0xc9e7ff,2.7);this.key.castShadow=true;this.key.shadow.mapSize.set(1024,1024);
  Object.assign(this.key.shadow.camera,{left:-310,right:310,top:270,bottom:-170,near:1,far:900});this.key.shadow.normalBias=.4;this.key.shadow.bias=-.0001;
  this.scene.add(this.key,this.key.target);
  this.rim=new T.PointLight(0x58d9e6,19000,450,2);this.scene.add(this.rim);
  this.warm=new T.PointLight(0xff9c4f,9500,300,2);this.scene.add(this.warm);
  this.hitLight=new T.PointLight(0xbaffc7,0,200,2);this.scene.add(this.hitLight);
  this.world=new T.Group();this.actors=new T.Group();this.skeletalActors=new T.Group();this.effects=new T.Group();this.scene.add(this.world,this.actors,this.skeletalActors,this.effects);
  this.ready=false;this.characters=new CharacterLibrary(config.assetURL);this.characters.promise.then(()=>this.ready=true).catch(e=>{this.failed=true;this.assetError=String(e.message);console.error('Не удалось загрузить персонажей:',e)});
  this.geo={box:new T.BoxGeometry(1,1,1),sphere:new T.SphereGeometry(1,16,12),cylinder:new T.CylinderGeometry(1,1,1,10),cone:new T.ConeGeometry(1,1,10),torus:new T.TorusGeometry(1,.12,6,32),plane:new T.PlaneGeometry(1,1),slash:new T.TorusGeometry(1,.026,4,40,Math.PI*1.05)};
  this.materials=new Map();this.dynamic=[];
  const grain=new Uint8Array(128*128*4);for(let i=0;i<128*128;i++){const x=i%128,y=Math.floor(i/128),v=165+((i*1597+Math.floor(i/17)*197)%75);grain[i*4]=grain[i*4+1]=grain[i*4+2]=(x%32===0||y%32===0)?90:v;grain[i*4+3]=255}
  this.grain=new T.DataTexture(grain,128,128);this.grain.wrapS=this.grain.wrapT=T.RepeatWrapping;this.grain.magFilter=T.LinearFilter;this.grain.minFilter=T.LinearFilter;this.grain.needsUpdate=true;

  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.bloom=new UnrealBloomPass(new T.Vector2(960,540),.42,.55,1.0);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.particles=new T.InstancedMesh(this.geo.sphere,new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),540);
  this.particles.instanceMatrix.setUsage(T.DynamicDrawUsage);this.particles.frustumCulled=false;this.effects.add(this.particles);
  const dustPositions=new Float32Array(72*3);for(let i=0;i<72;i++){dustPositions[i*3]=(i*71)%700;dustPositions[i*3+1]=10+(i*37)%140;dustPositions[i*3+2]=-90+(i*19)%150}const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3));this.dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0x98cbd6,size:1.2,transparent:true,opacity:.22,depthWrite:false}));this.scene.add(this.dust);
  this.dummy=new T.Object3D();this.color=new T.Color();this.temp=new T.Vector3();
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.failed=true;this.needsRecreate=true});
 }
 material(color,metal=.65,rough=.36,emit=0,intensity=0,opacity=1){
  const key=[color,metal,rough,emit,intensity,opacity].join(':');if(this.materials.has(key))return this.materials.get(key);
  const m=new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:emit,emissiveIntensity:intensity,transparent:opacity<1,opacity});
  if(!intensity&&opacity===1){m.bumpMap=this.grain;m.bumpScale=.045;m.roughnessMap=this.grain}this.materials.set(key,m);return m;
 }
 mesh(parent,kind,pos,size,mat,rot){
  const m=new T.Mesh(this.geo[kind],mat);m.position.set(...pos);m.scale.set(...size);if(rot)m.rotation.set(...rot);
  m.castShadow=kind!=='plane'&&(!mat.transparent);m.receiveShadow=true;parent.add(m);return m;
 }
 box(parent,pos,size,mat,rot){return this.mesh(parent,'box',pos,size,mat,rot)}
 ball(parent,pos,size,mat){return this.mesh(parent,'sphere',pos,size,mat)}
 rod(parent,a,b,r,mat){const v=new T.Vector3(...b).sub(new T.Vector3(...a));const m=this.mesh(parent,'cylinder',[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[r,v.length(),r],mat);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m}
 clearWorld(){
  for(const d of this.dynamic)if(d.dispose)d.dispose();this.dynamic=[];
  while(this.world.children.length)this.world.remove(this.world.children[0]);
  for(const rig of this.rigs.values()){rig.dispose?.();rig.root.removeFromParent()}this.rigs.clear();
 }
 buildStage(index){
  this.clearWorld();this.stage=index;this.palette=PALETTES[index];const p=this.palette,len=this.config.levels[index].length;
  this.scene.background.setHex(p.fog);this.scene.fog=new T.Fog(p.fog,630,1250);
  const wall=this.material(p.base,.74,.43),steel=this.material(p.trim,.8,.3),dark=this.material(0x0b151d,.65,.47),light=this.material(p.light,.25,.3,p.light,3),amber=this.material(p.accent,.25,.3,p.accent,2.3);
  // A real mirrored render pass. Characters, moving equipment and muzzle light
  // appear in the floor from the reflected camera; no flipped 2D screenshot.
  const reflector=new Reflector(new T.PlaneGeometry(len+1200,480),{textureWidth:512,textureHeight:256,color:0x344855,multisample:0,clipBias:.002});
  reflector.rotation.x=-Math.PI/2;reflector.position.set(len/2,-.06,20);
  reflector.material.fragmentShader=reflector.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',`
    vec2 uv = vUv.xy / vUv.w;
    float ripple = sin(uv.x*420.0)*sin(uv.y*350.0)*0.014;
    vec3 wet = mix(vec3(0.025,0.052,0.071), blendOverlay(base.rgb,color), 0.42 + ripple);
    gl_FragColor = vec4(wet,1.0);`);
  this.world.add(reflector);this.mirror=reflector;this.dynamic.push({dispose:()=>{reflector.geometry.dispose();reflector.dispose()}});
  const shadow=new T.Mesh(new T.PlaneGeometry(len+1200,480),new T.ShadowMaterial({color:0x000711,opacity:.42}));shadow.rotation.x=-Math.PI/2;shadow.position.copy(reflector.position);shadow.position.y=.03;shadow.receiveShadow=true;this.world.add(shadow);this.shadowFloor=shadow;this.dynamic.push({dispose:()=>{shadow.geometry.dispose();shadow.material.dispose()}});
  this.box(this.world,[len/2,-2,-60],[len+1200,2,380],this.material(0x11222a,.7,.3));
  // Floor divisions, drainage channels, warning strips and emissive guide rails.
  for(let x=-320;x<len+650;x+=80){
   this.box(this.world,[x,.08,18],[.7,.12,280],dark);
   for(const z of [-68,76])this.box(this.world,[x+40,.12,z],[77,.2,.8],steel);
   for(const z of [-88,95])this.box(this.world,[x+40,.2,z],[63,.35,1.3],light);
   for(let j=0;j<7;j++)this.box(this.world,[x+j*10,0,-78],[4,.4,8],j%2?dark:this.material(0x887546,.5,.5));
  }
  for(let x=-240;x<len+480;x+=160){
   const room=new T.Group();room.position.x=x;this.world.add(room);
   this.box(room,[80,81,-110],[158,166,8],wall);
   this.box(room,[0,83,-100],[10,172,14],steel);
   this.box(room,[80,166,-75],[160,9,72],dark);
   this.box(room,[80,137,-102],[125,3,4],steel);
   this.box(room,[80,128,-102],[113,2,2],light);
   if(x%320===0){const sign=this.makeSign(['ЛАБОРАТОРИЯ','ОХРАНА ПЕРИМЕТРА','ЯДРО РЕАКТОРА','КРИОГЕННЫЙ БЛОК','ОРБИТАЛЬНЫЙ ДОК','СЕРДЦЕ УЛЬЯ'][index]);const board=this.mesh(room,'plane',[80,115,-94],[86,12,1],sign);board.castShadow=false;}
   this.box(room,[80,17,-103],[133,25,8],dark);
   for(let j=0;j<5;j++)this.box(room,[26+j*25,19,-97],[15,2,2],steel);
   // Cable routes and pipe couplings have actual geometry and cast shadows.
   for(let j=0;j<3;j++){
    this.rod(room,[5,148+j*5,-91],[155,148+j*5,-91],1.6,j===1?steel:dark);
    this.box(room,[36+j*44,148+j*5,-90],[3,8,6],steel);
   }
   this.box(room,[76,161,-35],[72,3,10],dark);this.box(room,[76,159,-35],[65,1.2,7],light);
   if(index===0){
    this.box(room,[77,78,-101],[111,86,5],dark);this.box(room,[77,78,-96],[96,70,2],this.material(0x0c3443,.5,.2,0x154859,.4));
    for(let j=0;j<3;j++){this.box(room,[44+j*33,79,-92],[1,70,2],steel);this.box(room,[44+j*33,55,-90],[16,2,1],light)}
    this.box(room,[135,60,-82],[14,28,12],steel);this.box(room,[135,67,-75],[10,11,1],light);
   }else if(index===1){
    this.box(room,[77,79,-101],[109,102,7],dark);
    for(let j=0;j<5;j++)this.box(room,[77,42+j*17,-95],[99,12,5],j%2?steel:wall);
    for(const side of [25,130])this.box(room,[side,81,-87],[3,93,3],amber);
   }else if(index===2){
    this.box(room,[80,77,-94],[92,109,22],dark);
    const core=this.ball(room,[80,77,-76],[21,34,17],this.material(0x8d6eb2,.5,.17,p.light,1.4));
    for(let j=0;j<3;j++){
     const ring=this.mesh(room,'torus',[80,77,-76],[34+j*7,34+j*7,34+j*7],j===1?light:steel,[j*.5,j*.4,0]);ring.userData.dynamic=true;this.dynamic.push({ring,spin:.15+j*.12});
    }
   }else if(index===3){
    for(let j=0;j<2;j++){
     const xx=43+j*70;this.mesh(room,'cylinder',[xx,75,-78],[19,91,19],this.material(0x63929f,.1,.15,0x184659,.2,.25));
     for(const yy of [27,122])this.mesh(room,'cylinder',[xx,yy,-78],[23,6,23],steel);
     this.ball(room,[xx,86,-79],[7,12,7],dark);this.ball(room,[xx,64,-79],[11,17,7],dark);
     this.box(room,[xx,120,-55],[28,2,2],light);
    }
   }else if(index===4){
    this.box(room,[80,91,-106],[133,105,3],this.material(0x030913,.1,.6));
    for(let j=0;j<12;j++)this.ball(room,[18+j*11,66+Math.sin(x+j*23)*39,-103],[.7,.7,.7],light);
    this.box(room,[80,87,-101],[3,107,4],steel);this.box(room,[80,88,-99],[131,3,3],steel);
    this.box(room,[43,26,-62],[42,48,40],this.material(0x5e4534,.6,.5));this.box(room,[112,17,-59],[62,29,45],steel);
    this.rod(room,[4,164,-45],[60,124,-45],3,steel);
   }else{
    for(let j=0;j<3;j++){
     const xx=26+j*52;this.rod(room,[xx-13,0,-86],[xx,67,-82],6,steel);this.rod(room,[xx,67,-82],[xx-14,137,-94],5,steel);
     for(let n=0;n<6;n++)this.rod(room,[xx-14,20+n*16,-77],[xx+7,27+n*16,-78],1.6,dark);
     const sac=this.ball(room,[xx+13,47,-79],[12,23,14],this.material(0x658759,.2,.32,p.light,.3));sac.userData.dynamic=true;this.dynamic.push({sac,phase:xx});
    }
   }
  }
  this.batchWorld();this.rim.color.setHex(p.light);this.warm.color.setHex(p.accent);
 }
 makeSign(label){
  if(!this.signs)this.signs=new Map();if(this.signs.has(label))return this.signs.get(label);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#0b1b25';c.fillRect(0,0,512,64);c.strokeStyle='#75969c';c.strokeRect(1,1,510,62);c.fillStyle='#bbdbd5';c.font='bold 26px monospace';c.textAlign='center';c.fillText(label,256,41);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const material=new T.MeshBasicMaterial({map:texture,color:0x9cb4b2});this.signs.set(label,material);return material;
 }
 batchWorld(){
  this.world.updateMatrixWorld(true);const groups=new Map(),remove=[];
  this.world.traverse(o=>{if(!o.isMesh||o.isReflector||o===this.shadowFloor||o.userData.dynamic)return;
   const key=o.material.uuid;let entry=groups.get(key);if(!entry){entry={material:o.material,geos:[]};groups.set(key,entry)}
   entry.geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));remove.push(o);
  });
  remove.forEach(o=>o.parent.remove(o));
  for(const {material,geos} of groups.values()){
   const geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(!geometry)continue;
   const mesh=new T.Mesh(geometry,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;this.world.add(mesh);this.dynamic.push({dispose:()=>geometry.dispose()});
  }
 }
 batchActors(){
  if(!this.actorBatches){this.actorBatches=new Map();this.actorBatchRoot=new T.Group();this.scene.add(this.actorBatchRoot)}
  const used=new Map();this.actors.updateMatrixWorld(true);
  for(const rig of this.rigs.values()){if(rig.skeletal)continue;rig.root.traverse(o=>{
   if(!o.isMesh||!o.visible)return;let parent=o.parent;while(parent&&parent!==rig.root){if(!parent.visible)return;parent=parent.parent}
   const key=o.geometry.uuid+':'+o.material.uuid;let batch=this.actorBatches.get(key);
   if(!batch){batch=new T.InstancedMesh(o.geometry,o.material,384);batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.frustumCulled=false;batch.castShadow=true;batch.receiveShadow=true;this.actorBatchRoot.add(batch);this.actorBatches.set(key,batch)}
   const n=used.get(key)||0;if(n<384){batch.setMatrixAt(n,o.matrixWorld);used.set(key,n+1)}
  });}
  for(const [key,b] of this.actorBatches){b.count=used.get(key)||0;b.visible=b.count>0;b.instanceMatrix.needsUpdate=true}
  this.actors.visible=false;
 }
 rig(key,actor,kind){
  let r=this.rigs.get(key);const modelKey=kind+':'+(actor.classId??actor.type??this.stage);if(r&&r.modelKey!==modelKey){r.dispose?.();r.root.removeFromParent();this.rigs.delete(key);r=null}if(r)return r;
  if(kind==='player'||kind==='boss'||!['drone','turret'].includes(actor.type)){
   if(!this.characters.ready)return null;
   const id=kind==='player'?['drone','warrior','runner','praetorian'][actor.classId]:kind==='boss'?(this.stage===3||this.stage===4?'marine':this.stage===0?'warrior':'praetorian'):'marine';
   const scale=kind==='player'?this.config.classes[actor.classId].scale:kind==='boss'?(this.stage>=3?1.9:1.8):(this.config.enemies[actor.type]?.scale||1);
   r=this.characters.create(id,kind,actor.type,scale,kind==='boss'?this.stage:null);r.root.scale.setScalar(scale);r.modelKey=modelKey;r.kind=kind;
   this.skeletalActors.add(r.root);this.rigs.set(key,r);return r;
  }
   const root=new T.Group(),body=new T.Group();root.add(body);const m=this.material(0x455b6a,.85,.24),dark=this.material(0x10202d,.8,.4),light=this.material(0x9be6ea,.1,.2,0x66eeff,4);
   this.ball(body,[0,12,0],[13,8,12],m);this.box(body,[10,12,0],[8,3,8],light);
   for(const z of [-18,18]){this.box(body,[0,13,z],[27,2,7],m);this.mesh(body,'torus',[0,14,z],[12,12,12],dark,[Math.PI/2,0,0])}
   if(actor.type==='turret'){this.rod(root,[0,0,0],[0,15,0],4,m);this.box(root,[0,1,0],[31,3,22],dark)}
   r={root,body,rotor:true,phase:0};

  r.kind=kind;r.modelKey=modelKey;r.root.traverse(o=>{if(o.isMesh&&o.material){o.userData.originalEmissive=o.material.emissiveIntensity||0}});
  r.root.scale.setScalar(this.config.enemies[actor.type]?.scale||1);
  this.actors.add(r.root);this.rigs.set(key,r);return r;
 }
 animateRig(r,a,t,kind){
  if(r.skeletal){r.motion.update(a,t,this.config.attacks,kind);return;}
  r.root.position.set(a.x,a.z||0,(a.y-217)*2);r.root.rotation.y=a.face===-1?Math.PI:0;
  const moving=kind==='player'?Math.hypot(a.moveX||0,a.moveY||0)>.1:a.ai==='approach'||a.ai==='flank';
  const walk=kind==='player'?a.walking*3.2:(a.walk||0)*1.5;
  const stride=moving?Math.sin(walk):Math.sin(t*1.5+r.phase)*.045;
  r.body.position.y=Math.abs(stride)*(r.xeno?1.4:.65);r.body.rotation.z=r.xeno?-.08:0;
  if(r.rotor){r.body.rotation.y=Math.sin(t*3)*.2;r.body.position.y=a.type==='drone'?Math.sin(t*3)*3:0;return}
 }
 setQuality(settings){
  const q=settings.quality3d??1;const width=q===2?Math.min(2560,Math.max(960,Math.floor((window.innerWidth-24)/16)*16)):[640,960][q];if(q===this.quality&&this.canvas.width===width)return;this.quality=q;
  this.renderer.setSize(width,width*9/16,false);this.composer.setSize(width,width*9/16);
  this.renderer.shadowMap.enabled=q>0;this.key.shadow.mapSize.set(q===2?1024:512,q===2?1024:512);this.bloom.enabled=q>0;
 }
 render(g,settings,menu=false){
  if(this.failed||this.lost)return null;
  this.setQuality(settings);if(this.stage!==g.level)this.buildStage(g.level);
  const t=g.tick/60;this.clock=t;this.mirror.visible=settings.reflections!==false&&this.quality>0;
  this.bloom.strength=settings.bloom===false?0:.38;
  this.dust.position.x=g.camera-80;this.dust.position.y=Math.sin(t*.2)*4;this.dust.visible=settings.ambient>0;
  const cx=g.camera+240,shake=settings.shake?g.shake||0:0;
  this.camera.position.set(cx+Math.sin(t*53)*shake*.2,385+Math.sin(t*47)*shake*.15,600);
  this.camera.lookAt(cx,90,0);this.camera.updateMatrixWorld();
  this.key.position.set(cx-140,265,150);this.key.target.position.set(cx,0,0);this.key.target.updateMatrixWorld();
  this.rim.position.set(cx+100,105,-75);this.warm.position.set(cx-160,55,45);
  for(const d of this.dynamic){if(d.ring)d.ring.rotation.y=t*d.spin;if(d.sac)d.sac.scale.y=23*(1+Math.sin(t*2+d.phase)*.04)}
  const used=new Set();
  const visit=(key,a,kind)=>{if(a.x<g.camera-160||a.x>g.camera+640||a.dead&&(a.deathT||a.downT)>130)return;const r=this.rig(key,a,kind);if(!r)return;r.root.visible=true;this.animateRig(r,a,t,kind);used.add(key)};
  g.players.forEach(p=>visit('p'+p.id,p,'player'));g.enemies.forEach(e=>visit('e'+e.id,e,'enemy'));if(g.boss)visit('boss',g.boss,'boss');
  for(const [key,r] of this.rigs){if(!used.has(key)){r.dispose?.();r.root.removeFromParent();this.rigs.delete(key)}}
  const ps=g.particles||[];this.particles.count=Math.min(ps.length,540);
  for(let i=0;i<this.particles.count;i++){
   const p=ps[i];this.dummy.position.set(p.x,Math.max(.4,(217-p.y)*1.1),0);this.dummy.scale.setScalar(Math.max(.2,p.size*.5));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);this.color.set(p.color);this.particles.setColorAt(i,this.color);
  }
  this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
  if(menu){const rig=this.rigs.get('p0');if(rig)rig.root.rotation.y=Math.PI+.3+Math.sin(g.tick*.006)*.2}
  this.drawDynamic(g,t,settings);this.batchActors();
  this.renderer.info.reset();this.composer.render();
  this.stats={backend:'WebGL2',quality:this.quality,resolution:[this.canvas.width,this.canvas.height],drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,rigs:this.rigs.size,reflections:this.mirror.visible,stage:g.level,boss:!!g.boss,charactersReady:this.characters.ready,skinned:[...this.rigs.values()].filter(r=>r.skeletal).length,revision:'1.1'};
  return this.canvas;
 }
 drawDynamic(g,t,settings){
  if(!this.projectiles)this.projectiles=[];
  // Small reusable pool for bullets/items/hazards and impact rings.
  if(!this.objectPool)this.objectPool=[];let n=0;
  const obj=(kind,pos,size,color,emission=2)=>{
   let m=this.objectPool[n];if(!m){m=new T.Mesh(this.geo[kind],this.material(color,.2,.35,color,emission));this.effects.add(m);this.objectPool[n]=m}
   m.geometry=this.geo[kind];m.material=this.material(color,.2,.35,color,emission);m.visible=true;m.position.set(...pos);m.scale.set(...size);m.rotation.set(0,0,0);n++;return m;
  };
  for(const b of g.bullets||[]){const color=b.type==='shot'?0xffc581:b.type==='fire'?0xff7735:b.type==='frost'?0x7deeff:0x9cff69;obj('sphere',[b.x,Math.max(3,(b.depth||217)-b.y),(b.depth-217)*2],[b.type==='shot'?6:3,1.2,1.2],color,5)}
  for(const h of g.hazards||[]){if(h.x<g.camera-50||h.x>g.camera+530)continue;
   obj('box',[h.x,1,(h.y-217)*2],[26,2,12],0x263a47,0);
   if(h.warning||h.active){const r=obj('torus',[h.x,.7,(h.y-217)*2],[22,22,22],h.active?0xff8855:0xffce6c,2);r.rotation.x=Math.PI/2;
    if(h.active)for(let i=0;i<3;i++)obj('sphere',[h.x+Math.sin(t*3+i)*7,15+(t*29+i*17)%66,(h.y-217)*2],[5,12,5],h.type==='acid'?0x75bb53:0x4a6671,.12);
   }
  }
  for(const item of g.items||[]){const yy=12+Math.sin(t*3)*3,zz=(item.y-217)*2,col=item.type==='med'?0x8de4b1:item.type==='bonus'?0xffcb70:0x81c5ff;const m=obj(item.type==='energy'?'sphere':'box',[item.x,yy,zz],[10,10,10],col,1.4);m.rotation.y=t;if(item.type==='med'){obj('box',[item.x,yy,zz+6],[7,2,1],0xd7ffe7,.6);obj('box',[item.x,yy,zz+6],[2,7,1],0xd7ffe7,.6)}}
  if(settings.violence>0&&g.blood)for(const stain of g.blood){if(stain.x<g.camera-40||stain.x>g.camera+520)continue;obj('sphere',[stain.x,.13,(stain.y-217)*2],[stain.r,.1,stain.r*.65],0x682e39,0);}

  for(const p of g.puddles||[]){const ring=obj('sphere',[p.x,.2,(p.y-217)*2],[p.radius,.7,12],0x77cb38,1.4)}
  for(const o of g.props||[]){if(o.dead||o.x<g.camera-80||o.x>g.camera+560)continue;
   const pos=[o.x,o.type==='barrel'?15:14,(o.y-217)*2];
   obj(o.type==='barrel'?'cylinder':'box',pos,o.type==='barrel'?[12,30,12]:[27,27,23],o.type==='barrel'?0x556847:0x52616a,0);
   obj('box',[o.x,pos[1]+8,pos[2]+12],[18,2,1],o.type==='barrel'?0xffb55e:0x78c7cd,.5);
  }
  this.hitLight.intensity=0;const firing=g.enemies?.find(e=>!e.dead&&e.fire>0&&e.x>g.camera&&e.x<g.camera+480);if(firing){this.hitLight.position.set(firing.x+firing.face*40,40,(firing.y-217)*2);this.hitLight.color.setHex(0xffb677);this.hitLight.intensity=6500;}
  for(const hit of g.impacts||[]){const life=hit.t/hit.maxT,size=7+(1-life)*28,color=hit.kind==='acid'?0x9fff61:hit.kind==='guard'?0x7edeff:0xffd09b;
   const ring=obj('torus',[hit.x,hit.z||35,(hit.y-217)*2],[size,size,size],color,life*4);ring.rotation.x=-.4;
   if(life>.7){this.hitLight.position.set(hit.x,hit.z||35,(hit.y-217)*2+12);this.hitLight.color.setHex(color);this.hitLight.intensity=14000*life}
  }
  if(g.boss?.telegraph){const a=g.boss.telegraph;const r=obj('torus',[a.x,.6,(a.y-217)*2],[45,45,45],a.kind==='frost'?0x71e9ff:0xff8767,2);r.rotation.x=Math.PI/2}
  for(let i=n;i<this.objectPool.length;i++)this.objectPool[i].visible=false;
 }
 project(x,y,z=35){this.temp.set(x,z,(y-217)*2).project(this.camera);return {x:(this.temp.x*.5+.5)*480,y:(-.5*this.temp.y+.5)*270}}
 renderMenu(t,settings,classId=3){
  const fake={level:0,camera:0,tick:t,shake:0,players:[{id:0,classId,x:365,y:217,z:0,face:-1,walking:t*.01,anim:t,moveX:0,moveY:0,hp:190}],enemies:[],particles:[],props:[],hazards:[],items:[],puddles:[],bullets:[]};
  return this.render(fake,settings,true);
 }
 dispose(){this.clearWorld();for(const m of this.materials.values())m.dispose();for(const g of Object.values(this.geo))g.dispose();if(this.actorBatches)for(const b of this.actorBatches.values())b.dispose();this.dust.geometry.dispose();this.dust.material.dispose();this.key.shadow.dispose();for(const p of this.composer.passes)p.dispose?.();this.characters.dispose();this.grain.dispose();this.environment.dispose();if(this.signs)for(const m of this.signs.values()){m.map.dispose();m.dispose()}this.composer.dispose();this.renderer.dispose();this.canvas.remove()}
}
window.HiveRenderer=HiveRenderer;
