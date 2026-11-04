import * as T from 'three';

// Rigid equipment follows the same authored skeleton as the deforming body.
// Coordinates are in model metres, so attachments also follow class/boss scaling.
export function equipCharacter(rig,type,stage=null){
 const geometries=new Set(),materials=new Set(),objects=[];
 const material=(color,metal=.45,rough=.42,glow=0)=>{const m=new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:glow,emissiveIntensity:glow?1.8:0});materials.add(m);return m};
 const robotic=['android','juggernaut','prototype','exosuit'].includes(type),heavy=['heavy','gunner','juggernaut','prototype','exosuit'].includes(type)||stage===1||stage===3||stage===4;
 const armor=material(stage===3?0x527787:stage===4?0x625446:robotic?0x52636a:0x344333),steel=material(0x18242c,.75,.32),edge=material(0x657579,.6,.3),glow=material(stage===3?0x83e7ff:0xff9e54,.2,.27,stage===3?0x55cfff:0xff7833);
 rig.root.updateMatrixWorld(true);
 const modelInverse=rig.model.matrixWorld.clone().invert();
 const anchor=name=>rig.bones.get(name).getWorldPosition(new T.Vector3()).applyMatrix4(modelInverse);
 const attach=(name,geometry,position,mat,rotation=[0,0,0])=>{
  const bone=rig.bones.get(name);if(!bone)return;
  geometries.add(geometry);const mesh=new T.Mesh(geometry,mat),q=new T.Quaternion().setFromEuler(new T.Euler(...rotation));
  const modelMatrix=new T.Matrix4().compose(position,q,new T.Vector3(1,1,1));
  const local=bone.matrixWorld.clone().invert().multiply(rig.model.matrixWorld).multiply(modelMatrix);local.decompose(mesh.position,mesh.quaternion,mesh.scale);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.equipment=true;bone.add(mesh);objects.push(mesh);return mesh;
 };
 const panel=(name,offset,width,height,depth,mat=armor,rotation=[0,0,0])=>{
  const s=new T.Shape(),w=width/2,h=height/2,r=Math.min(w,h)*.22;
  s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r);s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h);
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2,steps:1,curveSegments:3});g.translate(0,0,-depth/2);
  return attach(name,g,anchor(name).add(new T.Vector3(...offset)),mat,rotation);
 };
 const tube=(name,points,radius,mat=steel)=>{const origin=anchor(name),curve=new T.CatmullRomCurve3(points.map(p=>origin.clone().add(new T.Vector3(...p))));return attach(name,new T.TubeGeometry(curve,12,radius,7,false),new T.Vector3(),mat)};
 const cylinder=(name,offset,radius,length,mat=steel,rotation=[0,0,0])=>attach(name,new T.CylinderGeometry(radius,radius,length,12),anchor(name).add(new T.Vector3(...offset)),mat,rotation);
 const blade=(name,offset,width,height,mat=armor)=>{
  const s=new T.Shape();s.moveTo(-width*.55,0);s.quadraticCurveTo(-width*.8,height*.7,-width*.65,height);s.quadraticCurveTo(width*.35,height*.7,width*.5,.12);s.lineTo(width*.4,0);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelThickness:.01,bevelSize:.008,bevelSegments:2,steps:1,curveSegments:8});
  return attach(name,g,anchor(name).add(new T.Vector3(...offset)),mat);
 };
 if(!rig.xeno){
  if(robotic){for(const surface of rig.skinned){const m=surface.material;if(m.name.includes('Human skin')){m.color.setHex(0x72818a);m.metalness=.8;m.roughness=.32}if(m.name.includes('fabric'))m.color.setHex(0x27343a)}}
  if(heavy){
   for(const side of ['L','R']){const sign=side==='L'?-1:1;panel('upperArm_'+side,[0,0,sign*.075],.26,.24,.09);panel('shin_'+side,[.075,-.07,0],.15,.21,.07,armor,[0,Math.PI/2,0]);}
   panel('chest',[.21,-.11,0],.38,.36,.08,armor,[0,Math.PI/2,0]);
   panel('chest',[-.24,-.08,0],.34,.38,.16,steel,[0,Math.PI/2,0]);
   cylinder('weapon',[.39,.06,0],.038,.40,steel,[0,0,Math.PI/2]);
  }
  if(type==='shield'){
   panel('forearm_L',[.12,-.06,-.10],.36,.77,.065,armor,[0,Math.PI/2,0]);
   panel('forearm_L',[.158,.15,-.10],.24,.085,.012,glow,[0,Math.PI/2,0]);
  }
  if(type==='medic'){
   const white=material(0xcbd7ca,.15,.65);panel('chest',[.218,-.07,0],.14,.036,.012,white,[0,Math.PI/2,0]);panel('chest',[.22,-.07,0],.036,.14,.014,white,[0,Math.PI/2,0]);
   cylinder('chest',[-.28,-.08,-.12],.05,.30,white);cylinder('chest',[-.28,-.08,.12],.05,.30,white);
  }
  if(type==='flame'||stage===3){
   for(const sign of [-1,1]){cylinder('chest',[-.29,-.05,sign*.17],.075,.40,armor);cylinder('chest',[-.29,-.03,sign*.17],.079,.25,stage===3?glow:steel);}
   tube('chest',[[-.28,-.22,.17],[-.13,-.34,.27],[.18,-.31,.24],[.43,-.19,.06]],.023,steel);
  }
  if(type==='grenadier'||type==='engineer'){for(let i=0;i<4;i++)cylinder('hips',[.18,.16,(i-1.5)*.09],.031,.12,type==='engineer'?edge:armor);}
  if(type==='exosuit'||type==='prototype'||stage===3||stage===4){
   for(const side of ['L','R']){const sign=side==='L'?-1:1;panel('upperArm_'+side,[-.01,.04,sign*.08],.32,.30,.16);tube('thigh_'+side,[[-.09,.04,sign*.09],[-.12,-.22,sign*.12],[.01,-.39,sign*.09]],.025,edge);tube('forearm_'+side,[[-.06,.02,sign*.06],[.02,-.12,sign*.07],[.12,-.25,sign*.04]],.027,edge);}
   panel('chest',[.262,-.10,0],.13,.14,.025,glow,[0,Math.PI/2,0]);
  }
  if(stage===4){
   for(const sign of [-1,1]){
    panel('chest',[-.08,.23,sign*.32],.32,.26,.35,armor,[0,Math.PI/2,0]);
    for(let n=0;n<3;n++)cylinder('chest',[.12,.15+n*.075,sign*.32],.025,.08,glow,[0,0,Math.PI/2]);
   }
  }
 }else if(stage!==null){
  if(stage===0){for(let n=0;n<5;n++)blade('chest',[-.21,-.14+n*.09,-.025],.14,.29,armor);}
  if(stage===1){for(const side of ['L','R']){panel('forearm_'+side,[.03,-.04,0],.25,.30,.23);panel('upperArm_'+side,[0,0,0],.32,.22,.28);}panel('chest',[.17,-.15,0],.4,.35,.07,armor,[0,Math.PI/2,0]);}
  if(stage===2||stage===5){
   for(const sign of [-1,1])for(let n=0;n<5;n++){
    const b=blade('head',[-.62+n*.18,.08,sign*(.18+n*.018)],.23,.25+n*.025,stage===5?edge:armor);if(b)b.rotation.x+=sign*.32;
   }
  }
  if(stage===5){
   // Additional grasping tendrils are curved continuous tubes, attached to chest motion.
   for(const sign of [-1,1]){tube('chest',[[-.08,-.1,sign*.26],[.11,-.25,sign*.42],[.37,-.32,sign*.40],[.59,-.21,sign*.31]],.04,armor);for(let n=0;n<3;n++)tube('chest',[[.55,-.22,sign*.31],[.68,-.24+n*.04,sign*(.29+n*.025)],[.75,-.27+n*.05,sign*(.27+n*.03)]],.012,edge);}
  }
 }
 rig.equipment={type,stage,count:objects.length};
 return ()=>{objects.forEach(o=>o.removeFromParent());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())};
}
