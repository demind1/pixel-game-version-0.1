import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterMotion } from '../src/character-motion.js';
import { equipCharacter } from '../src/character-equipment.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/character_manifest.json',import.meta.url)));
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
async function load(id,human=false){
 const info=manifest.characters[id],original=fs.readFileSync(new URL('../assets/'+info.file,import.meta.url));
 const len=original.readUInt32LE(12),json=JSON.parse(original.subarray(20,20+len));
 assert(json.materials.some(m=>m.normalTexture),'real normal texture is embedded');
 // Animation/IK unit tests use real meshes/skins but omit images, which need a browser.
 // Real normal maps are covered by the Chromium scene tests.
 for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture}}
 json.images=[];json.textures=[];const raw=Buffer.from(JSON.stringify(json));const j=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(j);const bin=original.subarray(20+len);const all=Buffer.alloc(20+j.length+bin.length);all.writeUInt32LE(0x46546c67,0);all.writeUInt32LE(2,4);all.writeUInt32LE(all.length,8);all.writeUInt32LE(j.length,12);all.writeUInt32LE(0x4e4f534a,16);j.copy(all,20);bin.copy(all,20+j.length);
 const gltf=await new GLTFLoader().parseAsync(all.buffer.slice(all.byteOffset,all.byteOffset+all.length),'');
 const root=new T.Group(),model=gltf.scene;model.scale.setScalar(info.scale);root.add(model);const bones=new Map(),skinned=[];model.traverse(o=>{if(o.isBone)bones.set(o.name,o);if(o.isSkinnedMesh)skinned.push(o)});
 const rig={root,model,bones,skinned,xeno:!human,modelScale:1,unitScale:info.scale,tail:Array.from({length:17},(_,i)=>bones.get('tail'+String(i).padStart(2,'0'))).filter(Boolean)};
 rig.motion=new CharacterMotion(rig,gltf.animations,info.profile,human);return {rig,gltf,info};
}
const {rig,gltf,info}=await load('drone');
const attacks={claw1:{startup:3,active:5,recovery:8},claw2:{startup:4,active:5,recovery:9},claw3:{startup:5,active:6,recovery:14},tail:{startup:9,active:7,recovery:17}};
let time=0;const a={x:100,y:217,z:0,face:1,classId:0,travel:0,moveX:0,moveY:0};
const step=(dt=1/60)=>{time+=dt;rig.motion.update(a,time,attacks,'player');rig.root.updateMatrixWorld(true)};
const pos=n=>rig.bones.get(n).getWorldPosition(new T.Vector3());
check('real GLB has skinned surfaces, normal maps and authored attack clips',()=>{assert(rig.skinned.length>=3);assert(rig.bones.size>=50);for(const n of ['Idle','Walk','Run','Light1','Light2','Light3','Heavy','Reload'].filter(n=>n!=='Reload'))assert(gltf.animations.some(c=>c.name===n));assert(info.polygons<15000)});
check('skin weights normalize and every vertex has a valid bone reference',()=>{for(const m of rig.skinned){const w=m.geometry.attributes.skinWeight,j=m.geometry.attributes.skinIndex;assert(w&&j);for(let i=0;i<w.count;i++){const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);assert(Math.abs(sum-1)<.002);assert(j.getX(i)<m.skeleton.bones.length)}}});
check('root/skin remain finite during animation evaluation',()=>{for(let i=0;i<20;i++)step();for(const b of rig.bones.values())for(const value of b.matrixWorld.elements)assert(Number.isFinite(value))});
check('support foot stays planted while the body translates',()=>{a.moveX=1;step();const start=pos('foot_L');for(let i=0;i<9;i++){a.x+=.6;a.travel+=.6;step()}assert(pos('foot_L').distanceTo(start)<.3,JSON.stringify({start,end:pos('foot_L')}))});
check('repeated renders at unchanged simulation time do not advance the pose',()=>{const before=pos('foot_L');rig.motion.update(a,time,attacks,'player');rig.motion.update(a,time,attacks,'player');assert(pos('foot_L').distanceTo(before)<1e-3)});
check('three claw attacks have distinct hand paths',()=>{const samples=[];a.moveX=0;for(const attack of ['claw1','claw2','claw3']){a.attack=attack;a.attackT=0;step(.12);a.attackT=6;step(.12);samples.push(pos('hand_R').clone())}assert(samples[0].distanceTo(samples[1])>2);assert(samples[1].distanceTo(samples[2])>2)});
check('tail inertia stays bounded and never penetrates the floor',()=>{a.attack=null;a.moveX=1;let stretch=0;for(let i=0;i<120;i++){a.x+=1.4;a.travel+=1.4;step();stretch=Math.max(stretch,rig.motion.tail.diagnostic.stretch);assert(rig.motion.tail.diagnostic.floor>=.79)}assert(stretch<1.3,'tail stretch '+stretch)});
const h=await load('marine',true),human={x:200,y:217,z:0,face:1,travel:0,ai:'aim',fire:0,reload:0};
const hp=n=>h.rig.bones.get(n).getWorldPosition(new T.Vector3());
check('marine rifle aims forward and follows a two-hand firing stance',()=>{h.rig.motion.update(human,0,attacks,'enemy');h.rig.motion.update(human,.2,attacks,'enemy');const d=hp('muzzle').sub(hp('weapon'));assert(d.x>20);assert(Math.abs(d.y)<7,'barrel vertical drift '+d.y)});
check('reload moves the support hand through separate magazine poses',()=>{human.reload=80;h.rig.motion.update(human,.3,attacks,'enemy');human.reload=60;h.rig.motion.update(human,.6,attacks,'enemy');const p=hp('hand_L');human.reload=24;h.rig.motion.update(human,1.0,attacks,'enemy');assert(hp('hand_L').distanceTo(p)>2)});
check('all four classes are different meshes and runner has a lower silhouette',()=>{const profiles=manifest.characters;assert(new Set(['drone','warrior','runner','praetorian'].map(k=>profiles[k].polygons)).size===4);assert(profiles.runner.profile.low>profiles.drone.profile.low);assert(profiles.praetorian.profile.width>profiles.drone.profile.width*1.3)});
check('enemy melee and boss telegraphs sample anticipation then contact poses',()=>{
 human.reload=0;human.wind=30;human.motionWind=30;human.motionClip='Heavy';human.motionRecover=0;
 h.rig.motion.update(human,1.2,attacks,'boss');h.rig.motion.update(human,1.3,attacks,'boss');const before=hp('hand_R');assert.equal(h.rig.motion.debug.clip,'Heavy');
 human.wind=0;human.motionRecover=24;h.rig.motion.update(human,1.45,attacks,'boss');assert(hp('hand_R').distanceTo(before)>5);
 human.motionRecover=0;h.rig.motion.update(human,1.6,attacks,'boss');assert.equal(h.rig.motion.debug.clip,'Aim');
});
check('shield is attached to the animated forearm and releases its geometry',()=>{
 const dispose=equipCharacter(h.rig,'shield'),gear=[];h.rig.root.traverse(o=>{if(o.userData.equipment)gear.push(o)});assert(gear.length>=2);assert(gear.every(o=>o.parent.name==='forearm_L'));
 let freed=0;gear[0].geometry.addEventListener('dispose',()=>freed++);human.face=-1;h.rig.motion.update(human,1.8,attacks,'enemy');for(const o of gear)assert(o.matrixWorld.elements.every(Number.isFinite));dispose();assert.equal(freed,1);assert(gear.every(o=>o.parent===null));
});
const silhouettes=[];
for(let stage=0;stage<6;stage++){
 const model=await load(stage===3||stage===4?'marine':stage===0?'warrior':'praetorian',stage===3||stage===4),dispose=equipCharacter(model.rig,'boss',stage),parts=[];
 model.rig.root.traverse(o=>{if(o.userData.equipment)parts.push([o.parent.name,o.geometry.type,o.geometry.attributes.position.count,...o.position.toArray().map(x=>x.toFixed(2))])});
 assert(parts.length>0);silhouettes.push(JSON.stringify(parts));dispose();model.rig.motion.dispose();
}
check('all six bosses retain different skeletal equipment silhouettes',()=>assert.equal(new Set(silhouettes).size,6));
check('quadruped foreleg remains planted while the torso moves',()=>{a.attack=null;a.moveX=1;a.travel=0;a.x=200;step(.5);step(.2);const p=pos('hand_R');assert.equal(rig.motion.hands.size,2);for(let i=0;i<6;i++){a.x+=.4;a.travel+=.4;step()}assert(pos('hand_R').distanceTo(p)<.5);});
check('slow crawling selects a separate low animation',()=>{a.crawling=true;step(.2);assert.equal(rig.motion.debug.clip,'Crawl');assert(pos('chest').y<40);});
console.log('PASS',passed,'real-asset skeletal and motion checks');
