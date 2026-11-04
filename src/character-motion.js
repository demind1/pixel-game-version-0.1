import * as T from 'three';
const UP=new T.Vector3(0,1,0),TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ATTACK_CLIPS={claw1:'Light1',claw2:'Light2',claw3:'Light3',tail:'Heavy',finisher:'Light3',launcher:'Launcher',air:'Air',slam:'Heavy',grabbite:'Grab',execution:'Ultimate',acidburst:'Special',impact:'Heavy',phantom:'Dash',rage:'Ultimate',acidclaw:'Light3',predator:'Heavy',ripper:'Light2',counter:'Parry',super:'Ultimate'};
const point=(bone)=>bone.getWorldPosition(new T.Vector3());
function alignBone(bone,child,target){
 const start=point(bone),direction=point(child).sub(start).normalize(),desired=target.clone().sub(start).normalize();
 if(direction.lengthSq()<.5||desired.lengthSq()<.5)return;
 const world=bone.getWorldQuaternion(new T.Quaternion()),delta=new T.Quaternion().setFromUnitVectors(direction,desired);
 const parent=bone.parent.getWorldQuaternion(new T.Quaternion());bone.quaternion.copy(parent.invert().multiply(delta.multiply(world)));bone.updateMatrixWorld(true);
}
export function solveLeg(hip,knee,ankle,target,pole){
 const a=point(hip),b=point(knee),c=point(ankle),l1=a.distanceTo(b),l2=b.distanceTo(c),v=target.clone().sub(a);
 const d=clamp(v.length(),Math.abs(l1-l2)+.002,l1+l2-.002),axis=v.normalize(),u=pole.clone().sub(a);u.addScaledVector(axis,-u.dot(axis));if(u.lengthSq()<1e-5)u.set(1,0,0);u.normalize();
 const h=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-h*h));
 const joint=a.clone().addScaledVector(axis,h).addScaledVector(u,bend);alignBone(hip,knee,joint);alignBone(knee,ankle,target);
 return point(ankle).distanceTo(target);
}

export class TailDynamics {
 constructor(bones){this.bones=bones;this.positions=null;this.previous=null;this.lengths=[];this.diagnostic={floor:1,stretch:0};}
 reset(){this.positions=null;this.previous=null;}
 update(dt,stiff=false){
  const bones=this.bones;if(bones.length<2)return;
  const goals=bones.map(point);const last=bones.at(-1),tip=new T.Vector3(0,last.userData.segmentLength||.13,0).applyMatrix4(last.matrixWorld);goals.push(tip);
  if(!this.positions){this.positions=goals.map(p=>p.clone());this.previous=goals.map(p=>p.clone());this.lengths=goals.slice(1).map((p,i)=>p.distanceTo(goals[i]));}
  const ps=this.positions,prev=this.previous;
  if(ps[0].distanceTo(goals[0])>90){this.reset();return this.update(dt,stiff)}
  const steps=dt>0?clamp(Math.round(dt*60),1,6):0;
  for(let step=0;step<steps;step++){
   ps[0].copy(goals[0]);
   for(let i=1;i<ps.length;i++){
    const old=ps[i].clone(),vel=ps[i].clone().sub(prev[i]).multiplyScalar(.82);
    ps[i].add(vel).lerp(goals[i],stiff?.62:Math.max(.045,.23-i*.009));ps[i].y-=.011;prev[i].copy(old);
   }
   for(let repeat=0;repeat<7;repeat++){
    ps[0].copy(goals[0]);
    for(let i=1;i<ps.length;i++){
     const delta=ps[i].clone().sub(ps[i-1]),d=Math.max(.001,delta.length()),error=(d-this.lengths[i-1])/d;
     if(i===1)ps[i].addScaledVector(delta,-error);else {ps[i-1].addScaledVector(delta,error*.5);ps[i].addScaledVector(delta,-error*.5)}
     ps[i].y=Math.max(.8,ps[i].y);
    }
   }
  }
  // Match the simulated chain with bone rotations; skin deforms continuously.
  let stretch=0;
  for(let i=0;i<bones.length-1;i++){alignBone(bones[i],bones[i+1],ps[i+1]);stretch=Math.max(stretch,Math.abs(ps[i].distanceTo(ps[i+1])-this.lengths[i]));}
  this.diagnostic={floor:Math.min(...ps.map(p=>p.y)),stretch};
 }
}

export class CharacterMotion {
 constructor(rig,clips,profile,human=false){
  this.rig=rig;this.human=human;this.profile=profile;this.mixer=new T.AnimationMixer(rig.model);this.actions=new Map();
  for(const clip of clips){const action=this.mixer.clipAction(clip);action.setEffectiveWeight(0);action.play();this.actions.set(clip.name,action)}
  this.state='';this.lastTime=null;this.turn=0;this.previousFace=1;this.hands=new Map();this.feet=new Map();this.tail=new TailDynamics(rig.tail);this.lastDistance=0;this.poseTime=0;this.footErrors=[];this.debug={};
  this.legLengths=new Map();for(const side of ['L','R']){const b=rig.bones;this.legLengths.set(side,{hip:b.get('thigh_'+side),knee:b.get('shin_'+side),ankle:b.get('foot_'+side)})}
 }
 choose(a,kind){
  if(a.dead)return 'Death';if(a.celebrating)return 'Victory';if(a.stun>0||a.hurt>0)return 'Hurt';
  if(a.dodge>0||a.dashT>0)return 'Dash';if(a.throwT>0)return kind==='player'?'Throw':'Hurt';
  if(a.attack)return ATTACK_CLIPS[a.attack]||'Special';
  if(a.motionClip&&(a.wind>0||a.motionRecover>0))return a.motionClip;
  if(a.parryT>0)return 'Parry';if(a.airborne||a.z>7&&!this.human)return 'Jump';if(a.landingT>0)return 'Landing';
  if(a.grabTarget)return 'Grab';if(a.heldBy)return 'Hurt';
  if(this.human){if(a.reload>0)return 'Reload';if(a.fire>0)return 'Fire';if(a.wind>0)return 'Aim'}
  const moving=Math.hypot(a.moveX||a.motionVX||0,a.moveY||a.motionVY||0)>.08||['approach','retreat','flank'].includes(a.ai);
  if(moving&&a.crawling&&!this.human)return 'Crawl';if(moving)return !this.human&&a.classId===2?'Run':'Walk';return this.human?'Aim':'Idle';
 }
 update(a,time,attacks,kind){
  const r=this.rig;let dt=this.lastTime===null?0:Math.max(0,time-this.lastTime);if(dt>.4){this.feet.clear();this.hands.clear();this.tail.reset();dt=.0833}this.lastTime=time;
  const face=a.face===-1?-1:1,target=face===-1?Math.PI:0;
  if(this.state===''){this.turn=target;this.previousFace=face}
  if(face!==this.previousFace){this.feet.clear();this.hands.clear();this.tail.reset();this.previousFace=face}
  const angular=Math.atan2(Math.sin(target-this.turn),Math.cos(target-this.turn));this.turn+=angular*(dt>0?1-Math.exp(-dt*24):0);
  r.root.position.set(a.x,a.z||0,(a.y-217)*2);r.root.rotation.set(0,this.turn,0);
  const state=this.choose(a,kind),next=this.actions.get(state)||this.actions.get('Idle');
  if(state!==this.state){this.previousAction=this.active;this.active=next;this.active.reset();this.active.setEffectiveWeight(1);this.active.play();const blend=a.attack?.055:state==='Hurt'?.05:.16;this.previousAction?.fadeOut(blend);this.active.fadeIn(blend);this.state=state;this.poseTime=0;this.feet.clear();this.hands.clear();if(state==='Reload')this.reloadStart=a.reload;}
  this.poseTime+=dt;
  const moving=state==='Walk'||state==='Run'||state==='Crawl';const distance=Number.isFinite(a.travel)?a.travel:(a.walking||a.walk||0)*9.66;
  const cycle=distance/Math.max(1,this.profile.stride*2*(r.unitScale||44)*(r.modelScale||1));
  if(moving)this.active.time=(cycle%1)*this.active.getClip().duration;
  else if(a.attack){const atk=attacks[a.attack],n=atk.startup+atk.active+atk.recovery-(a.recoveryHaste||0);this.active.time=clamp(a.attackT/n,0,.999)*this.active.getClip().duration;}
  else if(a.motionClip&&(a.wind>0||a.motionRecover>0)){const phase=a.wind>0?(1-a.wind/Math.max(1,a.motionWind||a.wind))*.40:.40+(1-a.motionRecover/(kind==='boss'?24:18))*.599;this.active.time=clamp(phase,0,.999)*this.active.getClip().duration;}
  else if(state==='Reload')this.active.time=(1-(a.reload||0)/this.reloadStart)*this.active.getClip().duration;
  else if(state==='Fire')this.active.time=(1-(a.fire||0)/8)*this.active.getClip().duration;
  else if(state==='Hurt')this.active.time=Math.min(this.poseTime,this.active.getClip().duration*.999);
  else if(state==='Death')this.active.time=clamp((a.deathT||a.downT||0)/70,0,.999)*this.active.getClip().duration;
  else this.active.time=(this.poseTime%this.active.getClip().duration);
  // Evaluate exactly at simulation time, including repeated reflection/capture renders.
  const goalTime=this.active.time;this.mixer.update(dt);this.active.time=goalTime;this.mixer.update(0);
  r.root.updateMatrixWorld(true);
  const grounded=!a.airborne&&(a.z||0)<.5&&!a.dead;
  this.footErrors=[];
  if(grounded&&!['Dash','Hurt','Death','Jump','Air'].includes(state)){
   const direction=new T.Vector3(a.motionVX||a.moveX||0,0,(a.motionVY||a.moveY||0)*2);if(direction.lengthSq()<.01)direction.set(face,0,0);direction.normalize();
   const scale=(r.unitScale||44)*(r.modelScale||1),stride=this.profile.stride*scale;
   for(const [side,{hip,knee,ankle}] of this.legLengths){
    if(!hip||!knee||!ankle)continue;
    const phase=(cycle+(side==='L'?0:.5))%1,stanceLength=state==='Run'?.40:this.human?.54:.50,stance=!moving||phase<stanceLength;let plant=this.feet.get(side),now=point(ankle);
    const floor=(this.human?.125:.21)*scale;
    if(stance){if(!plant||!plant.stance){plant={position:now.clone().setY(floor),stance:true};this.feet.set(side,plant)}
     const target=plant.position.clone();target.y=floor;
     if(Math.hypot(target.x-a.x,target.z-(a.y-217)*2)>stride*.95){plant.position.copy(now).setY(floor);target.copy(plant.position)}
     this.footErrors.push(solveLeg(hip,knee,ankle,target,point(hip).add(new T.Vector3(face*25,0,0))));
    }else{
     if(!plant)plant={position:now.clone(),stance:false};plant.stance=false;this.feet.set(side,plant);
     const swing=(phase-stanceLength)/(1-stanceLength);const target=new T.Vector3(a.x, floor, (a.y-217)*2).addScaledVector(direction,(swing-.5)*stride*.6);target.z+=(side==='L'?-1:1)*face*scale*.15;target.y+=Math.sin(swing*Math.PI)*scale*(this.human?.11:.18);
     this.footErrors.push(solveLeg(hip,knee,ankle,target,point(hip).add(new T.Vector3(face*25,0,0))));
    }
   }
  }else {this.feet.clear();this.hands.clear();}
  r.root.updateMatrixWorld(true);
  // Diagonal quadruped support: forelegs alternate against the opposite hind legs.
  if(!this.human&&grounded&&moving){
   const scale=(r.unitScale||44)*(r.modelScale||1),stride=this.profile.stride*scale*.65;
   for(const side of ['L','R']){const phase=(cycle+(side==='L'?.5:0))%1,b=r.bones,arm=b.get('upperArm_'+side),elbow=b.get('forearm_'+side),hand=b.get('hand_'+side),key=side;let plant=this.hands.get(key);
    const center=new T.Vector3(a.x+face*scale*.85,.23*scale,(a.y-217)*2+(side==='L'?-1:1)*face*scale*.24);
    let target;
    if(phase<.55){if(!plant||!plant.stance){plant={position:point(hand).setY(.23*scale),stance:true};this.hands.set(key,plant)}target=plant.position.clone();if(target.distanceTo(center)>scale*.7){target.copy(center);plant.position.copy(target)}}
    else{const u=(phase-.55)/.45;target=center.add(new T.Vector3(face*(u-.5)*stride,Math.sin(u*Math.PI)*scale*.13,0));this.hands.set(key,{position:target.clone(),stance:false})}
    solveLeg(arm,elbow,hand,target,point(arm).add(new T.Vector3(-face*10,0,side==='L'?-15:15)));
   }
  }else this.hands.clear();
  r.root.updateMatrixWorld(true);if(r.tail.length)this.tail.update(dt,state==='Heavy'||state==='Ultimate');
  if(r.flash)r.flash.visible=!!a.fire;
  if(r.slash){r.slash.visible=!!a.attack&&a.attackT>=attacks[a.attack].startup&&a.attackT<attacks[a.attack].startup+attacks[a.attack].active;r.slash.scale.setScalar(16);r.slash.position.set(25,35,0)}
  this.debug={clip:state,phase:cycle%1,feet:this.footErrors,tail:this.tail.diagnostic,clips:this.actions.size,skinned:true};
 }
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.rig.model);}
}
