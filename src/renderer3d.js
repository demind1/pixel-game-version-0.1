import * as T from 'three';
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
  this.world=new T.Group();this.actors=new T.Group();this.effects=new T.Group();this.scene.add(this.world,this.actors,this.effects);
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
  for(const rig of this.rigs.values())this.actors.remove(rig.root);this.rigs.clear();
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
  for(const rig of this.rigs.values())rig.root.traverse(o=>{
   if(!o.isMesh||!o.visible)return;let parent=o.parent;while(parent&&parent!==rig.root){if(!parent.visible)return;parent=parent.parent}
   const key=o.geometry.uuid+':'+o.material.uuid;let batch=this.actorBatches.get(key);
   if(!batch){batch=new T.InstancedMesh(o.geometry,o.material,384);batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.frustumCulled=false;batch.castShadow=true;batch.receiveShadow=true;this.actorBatchRoot.add(batch);this.actorBatches.set(key,batch)}
   const n=used.get(key)||0;if(n<384){batch.setMatrixAt(n,o.matrixWorld);used.set(key,n+1)}
  });
  for(const [key,b] of this.actorBatches){b.count=used.get(key)||0;b.visible=b.count>0;b.instanceMatrix.needsUpdate=true}
  this.actors.visible=false;
 }
 limb(parent,x,y,z,length,radius,mat){
  const pivot=new T.Group();pivot.position.set(x,y,z);parent.add(pivot);
  this.mesh(pivot,'cylinder',[0,-length/2,0],[radius,length,radius],mat);
  this.ball(pivot,[0,0,0],[radius*1.2,radius*1.2,radius*1.2],mat);
  return pivot;
 }
 xeno(kind=0,boss=false){
  const root=new T.Group(),body=new T.Group();root.add(body);
  const colors=[0x354b59,0x4b4560,0x365d65,0x626756];
  const skin=this.material(colors[kind%4],.62,.3),rib=this.material(0x111c24,.64,.32),edge=this.material(0x8ca5aa,.88,.21),tooth=this.material(0xd0dcc9,.6,.22);
  this.ball(body,[0,36,0],[10,16,8],skin);this.ball(body,[-2,23,0],[8,7,7],rib);
  for(let i=0;i<6;i++){
   this.rod(body,[-8,28+i*3.3,-6],[-1,31+i*3, -9],1.2,edge);
   this.rod(body,[-8,28+i*3.3,6],[-1,31+i*3,9],1.2,edge);
  }
  const neck=new T.Group();neck.position.set(0,52,0);body.add(neck);
  this.ball(neck,[10,12,0],[25,9.5,8.5],skin);this.ball(neck,[12,14,0],[21,6.5,7.8],this.material(0x243943,.6,.23));
  this.ball(neck,[25,7,0],[9,4,6],rib);
  for(let i=0;i<8;i++){
   for(const z of [-5,5])this.mesh(neck,'cone',[19+i*1.8,6,z],[.7,3,.7],tooth,[0,0,Math.PI]);
   if(i<6)this.rod(neck,[-7+i*4,15,-8],[-8+i*4,17,8],.55,edge);
  }
  for(let j=0;j<5;j++){this.ball(body,[4,24+j*3,0],[7.2-j*.3,1.2,7],rib);this.rod(body,[7,23+j*3,-5],[9,24+j*3,5],.65,edge)}
  for(let i=0;i<4;i++){
   const x=-8-i*2;this.rod(body,[x,34+i*4,-5],[x-8,49+i*4,-8],2.1,rib);this.ball(body,[x-8,49+i*4,-8],[2.4,2.4,2.4],edge);
  }
  if(kind===3||boss){
   this.ball(neck,[0,19,0],[23,boss?12:5,19],skin);
   for(let i=0;i<9;i++)this.mesh(neck,'cone',[-15+i*4.5,27,Math.sin(i)*12],[2,10,2],edge,[0,0,-.2]);
  }
  const arms=[],legs=[];
  for(const s of [-1,1]){
   const arm=this.limb(body,1,48,s*8,16,3.3,skin),fore=this.limb(arm,0,-16,0,15,2.4,rib);arms.push({arm,fore});for(let n=0;n<4;n++)this.mesh(fore,'torus',[0,-3-n*3,0],[2.9,2.9,2.9],edge,[Math.PI/2,0,0]);
   for(let j=0;j<3;j++)this.rod(fore,[0,-15,(j-1)*2],[7,-21,(j-1)*3],.65,tooth);
   const leg=this.limb(root,-2,33,s*5.5,17,4,skin),shin=this.limb(leg,0,-17,0,16,2.8,rib);legs.push({leg,shin});
   this.ball(shin,[4,-16,0],[7,2.2,4],skin);for(let j=0;j<3;j++)this.rod(shin,[6,-16,(j-1)*2],[12,-16,(j-1)*2.3],.7,tooth);
  }
  let tailParent=body;const tail=[];
  for(let i=0;i<13;i++){
   const t=new T.Group();t.position.set(i===0?-8:-6,i===0?24:0,0);tailParent.add(t);
   this.mesh(t,'cylinder',[-3,0,0],[Math.max(.6,2.8-i*.15),6,Math.max(.6,2.8-i*.15)],i%2?skin:rib,[0,0,Math.PI/2]);
   this.mesh(t,'cone',[-4,2,0],[1.2,4,1.2],edge,[0,0,-.5]);tail.push(t);tailParent=t;
  }
  this.mesh(tailParent,'cone',[-7,0,0],[3,12,2],edge,[0,0,Math.PI/2]);
  const slash=this.mesh(root,'slash',[22,38,0],[31,31,31],this.material(0xa0ffdf,0,.2,0x6affd0,5,.65),[0,Math.PI/2,0]);slash.visible=false;
  return {root,body,neck,arms,legs,tail,slash,xeno:true,phase:kind*.8};
 }
 marine(type){
  const root=new T.Group(),body=new T.Group();root.add(body);
  const heavy=['heavy','juggernaut','prototype','exosuit'].includes(type),robot=['android','juggernaut','prototype'].includes(type);
  const skin=this.material(robot?0x9ca6ac:0xb4967a,robot?.9:.1,.53),armor=this.material(type==='engineer'?0x9d7844:type==='medic'?0x859c92:robot?0x4e626f:0x455349,.7,.38),dark=this.material(0x19242e,.65,.42),glow=this.material(robot?0xfb674e:0x77d9e8,.5,.2,robot?0xfb674e:0x77d9e8,2);
  this.box(body,[0,40,0],[heavy?21:16,22,13],armor);this.box(body,[3,41,0],[8,17,15],dark);
  this.ball(body,[0,60,0],[7,8,6.5],skin);this.ball(body,[-1,64,0],[8.4,5.6,7.5],armor);
  this.box(body,[6.8,60,0],[1,3,11],glow);this.box(body,[0,26,0],[13,7,11],dark);for(let n=0;n<3;n++)this.box(body,[9,36+n*4,3],[2,2.5,6],armor);this.box(body,[9,47,2],[1,2,6],glow);
  for(const z of [-8,8]){this.ball(body,[0,49,z],[8,6,4],armor);this.box(body,[0,40,z],[7,10,2],armor)}
  const arms=[],legs=[];
  for(const s of [-1,1]){
   const arm=this.limb(body,2,48,s*8,12,3.2,armor),fore=this.limb(arm,0,-12,0,12,2.6,skin);arms.push({arm,fore});
   const leg=this.limb(root,0,27,s*4.5,13,4,armor),shin=this.limb(leg,0,-13,0,12,3,dark);legs.push({leg,shin});this.ball(shin,[2,-1,0],[4,4,4],armor);this.box(shin,[3,-12,0],[11,4,7],dark);
  }
  const gun=new T.Group();gun.position.set(16,40,-6);body.add(gun);
  this.box(gun,[0,0,0],[22,6,6],dark);this.box(gun,[-4,-5,0],[7,8,5],armor);this.rod(gun,[10,0,0],[26,0,0],1.7,armor);
  const flash=this.mesh(gun,'cone',[30,0,0],[5,14,5],this.material(0xffd982,0,.2,0xffc46d,5),[0,0,-Math.PI/2]);flash.visible=false;
  if(type==='shield'){this.box(body,[15,36,10],[4,38,23],armor);this.box(body,[18,47,10],[1,9,17],glow)}
  if(type==='medic')for(const s of [-1,1]){this.box(body,[8,43,s*8],[1,2,8],this.material(0xd4e2d1,.3,.5));this.box(body,[8,43,s*8],[1,8,2],this.material(0xd4e2d1,.3,.5))}
  if(heavy){this.box(body,[-11,37,0],[12,26,22],armor);for(const z of [-13,13])this.box(body,[0,48,z],[15,9,9],armor)}
  return {root,body,arms,legs,gun,flash,xeno:false,phase:0};
 }
 decorateBoss(r,stage){
  const armor=this.material(stage===3?0x698d9d:stage===4?0x655b53:0x4e5a4b,.8,.3),dark=this.material(0x15242c,.7,.3),shine=this.material(stage===3?0x7defff:stage===4?0xffad6a:0xc4ff86,.3,.2,stage===3?0x7defff:stage===4?0xffad6a:0xb1f978,2);
  if(stage===0){for(let i=0;i<5;i++)this.mesh(r.body,'cone',[-11,43+i*4,0],[3,18,3],armor,[0,0,.7]);}
  if(stage===1){for(const a of r.arms){this.box(a.fore,[0,-7,0],[10,19,11],armor);this.box(a.arm,[0,-3,0],[11,9,12],armor)}this.box(r.body,[4,38,0],[13,21,21],armor);}
  if(stage===2){this.ball(r.body,[-9,26,0],[17,12,13],dark);for(const z of [-1,1])for(let i=0;i<5;i++)this.rod(r.neck,[-9+i*3,21,z*11],[-13+i*5,30+i*2,z*(20+i*3)],1.2,armor);}
  if(stage===3){for(const z of [-12,12]){this.mesh(r.body,'cylinder',[-13,39,z],[6,31,6],armor);this.mesh(r.body,'cylinder',[-13,41,z],[6.2,20,6.2],shine)}this.box(r.body,[11,42,0],[4,13,13],shine);for(const a of r.arms)this.box(a.fore,[0,-12,0],[9,19,11],armor);}
  if(stage===4){for(const z of [-17,17]){this.box(r.body,[-3,54,z],[21,17,13],armor);for(let i=0;i<3;i++)this.rod(r.body,[7,51+i*4,z],[13,51+i*4,z],1.4,shine)}this.box(r.body,[-10,45,0],[13,29,26],dark);this.mesh(r.body,'torus',[-17,45,0],[13,13,13],shine,[0,Math.PI/2,0]);}
  if(stage===5){this.ball(r.body,[-4,28,0],[15,13,13],armor);for(const z of [-12,12]){const arm=this.limb(r.body,-2,33,z,17,3.2,armor),fore=this.limb(arm,0,-17,0,16,2.6,dark);r.arms.push({arm,fore});for(let i=0;i<3;i++)this.rod(fore,[0,-15,i*2-2],[9,-19,i*3-3],.8,shine)}for(let i=0;i<8;i++)this.mesh(r.neck,'cone',[-18+i*5,29,0],[2,14,2],armor,[0,0,0]);}
 }
 rig(key,actor,kind){
  let r=this.rigs.get(key);const modelKey=kind+':'+(actor.classId??actor.type??this.stage);if(r&&r.modelKey!==modelKey){this.actors.remove(r.root);this.rigs.delete(key);r=null}if(r)return r;
  if(kind==='player')r=this.xeno(actor.classId);
  else if(kind==='boss')r=this.stage===3||this.stage===4?this.marine('exosuit'):this.xeno(this.stage===0?1:3,true);
  else if(actor.type==='drone'||actor.type==='turret'){
   const root=new T.Group(),body=new T.Group();root.add(body);const m=this.material(0x455b6a,.85,.24),dark=this.material(0x10202d,.8,.4),light=this.material(0x9be6ea,.1,.2,0x66eeff,4);
   this.ball(body,[0,12,0],[13,8,12],m);this.box(body,[10,12,0],[8,3,8],light);
   for(const z of [-18,18]){this.box(body,[0,13,z],[27,2,7],m);this.mesh(body,'torus',[0,14,z],[12,12,12],dark,[Math.PI/2,0,0])}
   if(actor.type==='turret'){this.rod(root,[0,0,0],[0,15,0],4,m);this.box(root,[0,1,0],[31,3,22],dark)}
   r={root,body,rotor:true,phase:0};
  }else r=this.marine(actor.type);
  if(kind==='boss')this.decorateBoss(r,this.stage);
  r.kind=kind;r.modelKey=modelKey;r.root.traverse(o=>{if(o.isMesh&&o.material){o.userData.originalEmissive=o.material.emissiveIntensity||0}});
  if(kind==='boss')r.root.scale.setScalar(this.stage===2?2.3:this.stage>=3?2.5:2.1);
  else if(kind==='player')r.root.scale.setScalar(this.config.classes[actor.classId].scale);
  else r.root.scale.setScalar(this.config.enemies[actor.type]?.scale||1);
  this.actors.add(r.root);this.rigs.set(key,r);return r;
 }
 animateRig(r,a,t,kind){
  r.root.position.set(a.x,a.z||0,(a.y-217)*2);r.root.rotation.y=a.face===-1?Math.PI:0;
  const moving=kind==='player'?Math.hypot(a.moveX||0,a.moveY||0)>.1:a.ai==='approach'||a.ai==='flank';
  const walk=kind==='player'?a.walking*3.2:(a.walk||0)*1.5;
  const stride=moving?Math.sin(walk):Math.sin(t*1.5+r.phase)*.045;
  r.body.position.y=Math.abs(stride)*(r.xeno?1.4:.65);r.body.rotation.z=r.xeno?-.08:0;
  if(r.rotor){r.body.rotation.y=Math.sin(t*3)*.2;r.body.position.y=a.type==='drone'?Math.sin(t*3)*3:0;return}
  r.legs.forEach(({leg,shin},i)=>{leg.rotation.z=stride*(i?1:-1)*.62;shin.rotation.z=.12+Math.max(0,stride*(i?1:-1))*.8});
  r.arms.forEach(({arm,fore},i)=>{arm.rotation.z=(r.xeno?.1:.85)+stride*(i?-1:1)*.45;fore.rotation.z=r.xeno?-.45:.8;arm.rotation.x=(i?1:-1)*.12});
  if(r.xeno){
   r.neck.rotation.z=Math.sin(t*2)*.035;
   r.tail.forEach((tail,i)=>{tail.rotation.z=Math.sin(t*3-i*.4)*.11+(i<4?-.07:.12);tail.rotation.y=Math.sin(t*2-i*.35)*.09});
   if(a.parryT>0){r.arms.forEach(({arm,fore},i)=>{arm.rotation.z=1.7;arm.rotation.x=(i?1:-1)*.45;fore.rotation.z=1.2});r.body.rotation.z=-.15}
   if(a.dodge>0){r.body.rotation.z=-.35;r.body.position.y=-8;r.arms.forEach(({arm})=>arm.rotation.z=-1.1)}
   if(a.airborne){r.legs.forEach(({leg,shin},i)=>{leg.rotation.z=i?.8:-.5;shin.rotation.z=1});r.tail.forEach((tail,i)=>tail.rotation.z=.15+Math.sin(t*6-i*.3)*.08)}
   if(a.attack){
    const atk=this.config.attacks[a.attack],progress=a.attackT/(atk.startup+atk.active+atk.recovery),contact=smooth(0,atk.startup/(atk.startup+atk.active+atk.recovery),progress),recover=smooth(.5,1,progress);
    const strike=contact*(1-recover),combo=a.attack==='claw2'?0:1;
    r.arms.forEach(({arm,fore},i)=>{arm.rotation.z=-.7+strike*(i===combo?3.0:1.7);fore.rotation.z=-.9+strike*.9;arm.rotation.x=(i?1:-1)*(.2+strike*.6)});
    r.body.rotation.z=-.12+strike*.2;r.neck.rotation.z=-strike*.12;
    if(a.attack==='launcher'){r.arms[1].arm.rotation.z=-.6+strike*3.8;r.arms[1].fore.rotation.z=-.5;r.body.position.y=strike*4}
    if(a.attack==='execution'){r.arms.forEach(({arm})=>arm.rotation.z=-.3+strike*3.3);r.neck.rotation.z=-strike*.3}
    if(['tail','finisher','slam','impact','predator'].includes(a.attack))r.tail.forEach((tail,i)=>{tail.rotation.z=-.15+strike*.46;tail.rotation.y=Math.sin(progress*TAU-i*.16)*.45});
    r.slash.visible=a.attackT>=atk.startup&&a.attackT<atk.startup+atk.active;r.slash.scale.setScalar(24+strike*10);r.slash.rotation.set(0,1.2+progress*3,progress*1.2);r.slash.position.set(23,38,0);
   }else r.slash.visible=false;
  }else{
   r.arms.forEach(({arm,fore})=>{arm.rotation.z=.95;fore.rotation.z=1.0});
   r.gun.position.x=16-(a.fire>0?3:0);r.flash.visible=a.fire>0;
   if(a.reload>0){r.gun.rotation.z=-.6;r.arms[0].fore.rotation.z=1.8+Math.sin(t*16)*.2}else r.gun.rotation.z=0;
   if(a.wind>0){r.body.rotation.z=-.07;r.gun.rotation.y=Math.sin(t)*.01}
  }
  if(a.hurt>0||a.stun>0){r.body.rotation.z=-.18;r.body.position.x=-2}else r.body.position.x=0;
  if(a.dead){r.root.rotation.z=-Math.min(1.5,(a.deathT||a.downT||0)/18);r.root.position.y=Math.max(3,(a.z||0));r.root.position.z+=8}
  else r.root.rotation.z=0;
  if(kind==='boss'){
   r.body.position.y+=Math.sin(t*2)*1.1;
   if(a.wind>0)r.arms.forEach(({arm},i)=>arm.rotation.z=1.3+Math.sin(a.wind*.1+i)*.8);
   if(a.dashT>0)r.body.rotation.z=-.35;
  }
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
  const visit=(key,a,kind)=>{if(a.x<g.camera-160||a.x>g.camera+640||a.dead&&(a.deathT||a.downT)>130)return;const r=this.rig(key,a,kind);r.root.visible=true;this.animateRig(r,a,t,kind);used.add(key)};
  g.players.forEach(p=>visit('p'+p.id,p,'player'));g.enemies.forEach(e=>visit('e'+e.id,e,'enemy'));if(g.boss)visit('boss',g.boss,'boss');
  for(const [key,r] of this.rigs){if(!used.has(key)){this.actors.remove(r.root);this.rigs.delete(key)}}
  const ps=g.particles||[];this.particles.count=Math.min(ps.length,540);
  for(let i=0;i<this.particles.count;i++){
   const p=ps[i];this.dummy.position.set(p.x,Math.max(.4,(217-p.y)*1.1),0);this.dummy.scale.setScalar(Math.max(.2,p.size*.5));this.dummy.updateMatrix();this.particles.setMatrixAt(i,this.dummy.matrix);this.color.set(p.color);this.particles.setColorAt(i,this.color);
  }
  this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
  this.drawDynamic(g,t,settings);this.batchActors();
  this.renderer.info.reset();this.composer.render();
  this.stats={backend:'WebGL2',quality:this.quality,resolution:[this.canvas.width,this.canvas.height],drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,rigs:this.rigs.size,reflections:this.mirror.visible,stage:g.level,boss:!!g.boss,revision:'1.0'};
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
  const out=this.render(fake,settings,true);const rig=this.rigs.get('p0');if(rig){rig.root.rotation.y=Math.PI+.3+Math.sin(t*.006)*.2;this.batchActors();this.renderer.info.reset();this.composer.render()}return out;
 }
 dispose(){this.clearWorld();for(const m of this.materials.values())m.dispose();for(const g of Object.values(this.geo))g.dispose();if(this.actorBatches)for(const b of this.actorBatches.values())b.dispose();this.dust.geometry.dispose();this.dust.material.dispose();this.key.shadow.dispose();for(const p of this.composer.passes)p.dispose?.();this.grain.dispose();this.environment.dispose();if(this.signs)for(const m of this.signs.values()){m.map.dispose();m.dispose()}this.composer.dispose();this.renderer.dispose();this.canvas.remove()}
}
window.HiveRenderer=HiveRenderer;
