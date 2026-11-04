import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import manifest from '../assets/character_manifest.json' with {type:'json'};
import { CharacterMotion } from './character-motion.js';
import { equipCharacter } from './character-equipment.js';

export class CharacterLibrary {
 constructor(assetURL){this.templates=new Map();this.ready=false;const loader=new GLTFLoader();this.promise=Promise.all(Object.entries(manifest.characters).map(async([id,info])=>{const gltf=await loader.loadAsync(assetURL(info.file));this.templates.set(id,{gltf,info});})).then(()=>this.ready=true);}
 create(id,kind,type='marine',classScale=1,stage=null){
  const template=this.templates.get(id);if(!template)return null;
  const model=clone(template.gltf.scene),root=new T.Group();root.add(model);model.scale.setScalar(template.info.scale);const bones=new Map(),materials=new Map(),skinned=[];
  model.traverse(o=>{if(o.isBone)bones.set(o.name,o);if(o.isSkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;skinned.push(o);const original=o.material;if(!materials.has(original)){const m=original.clone();if(id==='marine'&&m.name.includes('armor')){if(type==='medic')m.color.setHex(0x556b55);if(type==='engineer')m.color.setHex(0x6c5935);if(type==='flame')m.color.setHex(0x5c4330)}materials.set(original,m)}o.material=materials.get(original)}});
  const arms=['L','R'].map(side=>({arm:bones.get('upperArm_'+side),fore:bones.get('forearm_'+side)}));
  const tail=Array.from({length:17},(_,i)=>bones.get('tail'+String(i).padStart(2,'0'))).filter(Boolean);
  // Tail segment lengths are authored in metres, before the model's game-unit scale.
  for(let i=0;i<tail.length;i++)tail[i].userData.segmentLength=.13;
  const rig={root,model,bones,arms,tail,skinned,body:bones.get('chest'),neck:bones.get('neck'),xeno:id!=='marine',skeletal:true,unitScale:template.info.scale,modelScale:classScale,kind,profile:template.info.profile};
  if(id==='marine'){
   const muzzle=bones.get('muzzle');if(muzzle){const geom=new T.ConeGeometry(.045,.22,6),mat=new T.MeshBasicMaterial({color:0xffcf8a,toneMapped:false});const flash=new T.Mesh(geom,mat);flash.position.y=.08;flash.visible=false;muzzle.add(flash);rig.flash=flash;rig.flashResources={geom,mat};}
  }
  const disposeEquipment=kind==='player'?()=>{}:equipCharacter(rig,type,stage);
  rig.motion=new CharacterMotion(rig,template.gltf.animations,template.info.profile,id==='marine');
  rig.dispose=()=>{disposeEquipment();rig.motion.dispose();for(const m of materials.values())m.dispose();for(const skeleton of new Set(skinned.map(s=>s.skeleton)))skeleton.dispose();rig.flashResources?.geom.dispose();rig.flashResources?.mat.dispose();root.removeFromParent()};
  return rig;
 }
 dispose(){for(const {gltf} of this.templates.values())gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const mat of (Array.isArray(o.material)?o.material:[o.material])){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose();}}});this.templates.clear();}
}
