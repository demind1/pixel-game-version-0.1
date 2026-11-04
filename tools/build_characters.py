"""Author reproducible, skinned biomechanical creatures and a colonial marine.
Blender 4.3+: blender -b --factory-startup --python tools/build_characters.py
All surfaces, armatures and key poses are authored here; no downloaded models.
"""
import bpy,math,json,sys,argparse
from mathutils import Vector,Matrix,Quaternion
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets'
args=argparse.ArgumentParser();args.add_argument('--only');opts=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
FPS=30;TAU=math.tau
PROFILES={
 'drone':dict(width=1,bulk=1,head=1,low=.16,stride=.86,step=.88,tail=2.15),
 'warrior':dict(width=1.22,bulk=1.2,head=1.04,low=.08,stride=.82,step=1.05,tail=2.0),
 'runner':dict(width=.83,bulk=.83,head=.94,low=.30,stride=1.18,step=.62,tail=2.4),
 'praetorian':dict(width=1.36,bulk=1.28,head=1.16,low=-.09,stride=.78,step=1.18,tail=2.0),
 'queen':dict(width=1.50,bulk=1.4,head=1.30,low=-.02,stride=.80,step=1.2,tail=2.55),
 'marine':dict(width=1,bulk=1,head=1,low=0,stride=.76,step=.94,tail=0)
}

def mat(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if name in ['Dark blue chitin','Olive combat fabric','Organic undercarapace']:
  im=bpy.data.images.new(name+' normal detail',width=256,height=256,alpha=False);pixels=[]
  for y in range(256):
   for x in range(256):
    if 'fabric' in name:dx=.14*math.sin(x*math.pi/2);dy=.14*math.sin(y*math.pi/2)
    else:dx=.065*math.sin(x*.61+y*.17);dy=.065*math.cos(y*.57-x*.13)
    pixels.extend((.5+dx,.5+dy,.99,1))
  im.pixels=pixels;im.pack();im.colorspace_settings.name='Non-Color';tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.35;m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
 return m

def mesh(name,vertices,faces,material):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for f in o.data.polygons:f.use_smooth=True
 return o

def catmull(a,b,c,d,t):return (b*2+(c-a)*t+(a*2-b*5+c*4-d)*t*t+(-a+b*3-c*3+d)*t*t*t)*.5

def loft(name,sections,material,radial=12,steps=3):
 # Swept anatomical cross-sections, not scaled primitive meshes.
 values=[(Vector(c),float(a),float(b)) for c,a,b in sections];samples=[]
 for i in range(len(values)-1):
  for j in range(steps):
   t=j/steps;p0=values[max(0,i-1)];p1=values[i];p2=values[i+1];p3=values[min(len(values)-1,i+2)]
   samples.append((catmull(p0[0],p1[0],p2[0],p3[0],t),max(.001,catmull(p0[1],p1[1],p2[1],p3[1],t)),max(.001,catmull(p0[2],p1[2],p2[2],p3[2],t))))
 samples.append(values[-1]);verts=[];faces=[]
 for i,(c,a,b) in enumerate(samples):
  tangent=(samples[min(i+1,len(samples)-1)][0]-samples[max(i-1,0)][0]).normalized()
  u=Vector((0,1,0));u-=tangent*u.dot(tangent)
  if u.length<.1:u=Vector((1,0,0));u-=tangent*u.dot(tangent)
  u.normalize();v=tangent.cross(u).normalized()
  for k in range(radial):verts.append(c+u*math.cos(k/radial*TAU)*a+v*math.sin(k/radial*TAU)*b)
  if i:
   for k in range(radial):faces.append(((i-1)*radial+k,(i-1)*radial+(k+1)%radial,i*radial+(k+1)%radial,i*radial+k))
 faces.append(tuple(reversed(range(radial))));faces.append(tuple((len(samples)-1)*radial+k for k in range(radial)))
 return mesh(name,verts,faces,material)

def tube(name,points,radii,material,radial=8):return loft(name,[(p,r,r) for p,r in zip(points,radii)],material,radial,2)

def bevel_box(name,center,size,material,bevel=.012):
 x,y,z=center;a,b,c=[v/2 for v in size]
 vs=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
 o=mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],material)
 bpy.context.view_layer.objects.active=o;o.select_set(True);m=o.modifiers.new('Tailored beveled edges','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)
 return o

def make_skeleton(human,cfg):
 data=bpy.data.armatures.new('AnatomicalSkeleton');rig=bpy.data.objects.new('CharacterRig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 defs={}
 def bone(n,a,b,parent=None):
  e=data.edit_bones.new(n);e.head=a;e.tail=b
  if parent:e.parent=data.edit_bones[parent]
  defs[n]=(Vector(a),Vector(b),parent)
 bone('root',(0,0,0),(0,0,.15))
 low=cfg['low'];w=cfg['width']
 if human:
  hip=Vector((0,0,.96));ch=Vector((0,0,1.43));neck=Vector((.005,0,1.58));head=Vector((.015,0,1.72))
 else:
  hip=Vector((-.10,0,.95-low));ch=Vector((.18+low*.5,0,1.38-low));neck=Vector((.32+low*.6,0,1.54-low));head=Vector((.43+low*.6,0,1.70-low))
 bone('hips',hip,(hip+ch)/2,'root');bone('spine',(hip+ch)/2,ch,'hips');bone('chest',ch,neck,'spine');bone('neck',neck,head,'chest');bone('head',head,head+Vector((.38,0,0)),'neck')
 bone('jaw',head+Vector((.25,0,-.14)),head+Vector((.48,0,-.14)),'head');bone('innerJaw',head+Vector((.35,0,-.13)),head+Vector((.53,0,-.13)),'head')
 for side,sign in [('L',1),('R',-1)]:
  shoulder=ch+Vector((-.01,sign*(.225 if human else .215*w),-.005));elbow=shoulder+Vector((.02 if human else .16,sign*.09,-.28 if human else -.29));hand=elbow+Vector((.07 if human else .28,sign*.035,-.24 if human else -.15))
  bone('shoulder_'+side,ch,shoulder,'chest');bone('upperArm_'+side,shoulder,elbow,'shoulder_'+side);bone('forearm_'+side,elbow,hand,'upperArm_'+side);bone('hand_'+side,hand,hand+Vector((.10,0,-.06)),'forearm_'+side)
  for f in range(4 if human else 3):
   p=hand+Vector((.06,(f-1.5 if human else f-1)*.026,-.035));q=p+Vector((.085 if human else .115,0,-.035));tip=q+Vector((.06 if human else .10,0,-.04))
   bone(f'finger{f}a_'+side,p,q,'hand_'+side);bone(f'finger{f}b_'+side,q,tip,f'finger{f}a_'+side)
  h=hip+Vector((0,sign*.12*w,0));knee=Vector((.025 if human else .16,sign*.14*w,.53-low*.45));ankle=Vector((-.005 if human else -.12,sign*.15*w,.115 if human else .23));toe=ankle+Vector((.19 if human else .32,0,-(.085 if human else .175)))
  bone('thigh_'+side,h,knee,'hips');bone('shin_'+side,knee,ankle,'thigh_'+side);bone('foot_'+side,ankle,toe,'shin_'+side);bone('toe_'+side,toe,toe+Vector((.13,0,-.02)),'foot_'+side)
 if human:
  p=defs['hand_R'][0];bone('weapon',p,p+Vector((.62,0,0)),'hand_R');bone('muzzle',p+Vector((.64,0,0)),p+Vector((.69,0,0)),'weapon')
 else:
  points=[hip+Vector((-.09-i*cfg['tail']/16,math.sin(i*.22)*.025,i*.037)) for i in range(18)]
  for i in range(17):bone(f'tail{i:02}',points[i],points[i+1],'hips' if i==0 else f'tail{i-1:02}')
 bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
 return rig,defs

def weighted(o,rig,defs,bone=None):
 if bone:
  g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
 else:
  candidates=[n for n in defs if n!='root' and not n.startswith(('finger','tail','jaw','inner','weapon','muzzle','toe'))]
  groups={n:o.vertex_groups.new(name=n) for n in candidates}
  for vertex in o.data.vertices:
   v=vertex.co;dist=[]
   for n in candidates:
    a,b,_=defs[n];d=b-a;t=max(0,min(1,(v-a).dot(d)/max(1e-8,d.length_squared)));dist.append(((v-(a+d*t)).length,n))
   nearest=sorted(dist)[:3];vals=[1/(d+.045)**4 for d,n in nearest];total=sum(vals)
   for (d,n),weight in zip(nearest,vals):groups[n].add([vertex.index],weight/total,'REPLACE')
 o.parent=rig;mod=o.modifiers.new('Smooth skeletal deformation','ARMATURE');mod.object=rig
 return o

def make_surface(rig,defs,human,cfg,mats):
 flesh=[];parts=[];skin,plate,rib,edge,tooth,cloth,face=mats
 def add(o,b=None):weighted(o,rig,defs,b);parts.append(o);return o
 hip,ch,neck,head=[defs[n][0] for n in ['hips','chest','neck','head']];w=cfg['width'];bulk=cfg['bulk']
 # The body, shoulders, upper/lower limbs and pelvis are voxel-fused before skinning.
 flesh.append(loft('Connected torso',[(hip+Vector((-.02,0,-.07)),.10*w,.10),(hip,.16*w,.13),(hip.lerp(ch,.35),.145*w,.105),(hip.lerp(ch,.75),.23*w,.14*bulk),(ch,.245*w,.15*bulk),(neck,.09,.085)],cloth if human else skin,16,3))
 flesh.append(tube('Sinuous neck',[ch,neck,head],[.12,.09,.10],face if human else skin,12))
 for side in ['L','R']:
  a,b,_=defs['upperArm_'+side];c=defs['hand_'+side][0]
  flesh.append(loft('Deltoid and arm',[(a,.105*bulk,.11*bulk),(a.lerp(b,.35),.095*bulk,.09*bulk),(b,.067,.065),(b.lerp(c,.5),.075*bulk,.07*bulk),(c,.044,.043)],face if human else skin,12,3))
  a,b,_=defs['thigh_'+side];c=defs['foot_'+side][0]
  flesh.append(loft('Hip thigh knee calf',[(a,.115*w,.13*bulk),(a.lerp(b,.35),.11*w,.115*bulk),(b,.073,.071),(b.lerp(c,.4),.087,.082),(c,.045,.05)],cloth if human else skin,12,3))
 bpy.ops.object.select_all(action='DESELECT')
 for o in flesh:o.select_set(True)
 bpy.context.view_layer.objects.active=flesh[0];bpy.ops.object.join();body=bpy.context.object;body.name='ContinuousAnatomicalSkin'
 body.data.remesh_voxel_size=.022 if human else .024;bpy.ops.object.voxel_remesh()
 sm=body.modifiers.new('Organic junction blending','SMOOTH');sm.factor=.55;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
 de=body.modifiers.new('Game topology budget','DECIMATE');de.ratio=.72;bpy.ops.object.modifier_apply(modifier=de.name)
 # Voxel remesh uses the base suit/skin material; face regions are separate detailed surfaces.
 body.data.materials.clear();body.data.materials.append(cloth if human else skin)
 for f in body.data.polygons:f.use_smooth=True
 weighted(body,rig,defs);parts.append(body);body.select_set(False)
 if human:
  # Sculpted seven-and-a-half-head proportions, jaw/chin profile and facial planes.
  add(loft('Face cheekbones jaw and brow',[(head+Vector((0,0,-.15)),.055,.06),(head+Vector((.015,0,-.10)),.084,.077),(head,.101,.094),(head+Vector((0,0,.09)),.093,.092),(head+Vector((-.015,0,.15)),.048,.04)],face,16,3),'head')
  add(loft('Nose bridge',[(head+Vector((.084,0,.06)),.019,.019),(head+Vector((.14,0,0)),.026,.022),(head+Vector((.119,0,-.025)),.022,.013)],face,10,2),'head')
  for sign in [-1,1]:
   add(tube('Brow ridge',[head+Vector((.085,sign*.024,.047)),head+Vector((.09,sign*.075,.04))],[.014,.01],face),'head')
   add(bevel_box('Goggle lens',head+Vector((.105,sign*.049,.033)),(.018,.065,.035),rib,.006),'head')
   add(loft('Helmet earpiece',[(head+Vector((-.02,sign*.11,-.015)),.02,.03),(head+Vector((-.02,sign*.12,.05)),.035,.047)],plate,10,2),'head')
  add(tube('Mouth line',[head+Vector((.101,-.035,-.075)),head+Vector((.109,0,-.081)),head+Vector((.101,.035,-.075))],[.004,.004,.004],rib,6),'head')
  add(loft('Helmet shaped shell',[(head+Vector((-.015,0,.03)),.11,.105),(head+Vector((-.02,0,.12)),.11,.105),(head+Vector((-.03,0,.19)),.04,.038)],plate,20,3),'head')
  add(bevel_box('Helmet visor brim',head+Vector((.09,0,.093)),(.10,.25,.026),plate,.008),'head')
  # Front breastplates are curved anatomical panels, not a rectangular torso.
  add(loft('Contoured chest armor',[(ch+Vector((.105,0,-.22)),.17,.035),(ch+Vector((.15,0,-.10)),.22,.045),(ch+Vector((.14,0,.06)),.22,.048),(ch+Vector((.11,0,.11)),.13,.025)],plate,16,2),'chest')
  for sign in [-1,1]:
   add(tube('Shoulder webbing',[hip+Vector((.13,sign*.11,.14)),ch+Vector((.17,sign*.16,.02)),ch+Vector((-.07,sign*.15,.10))],[.019,.019,.019],rib,8),'chest')
   add(bevel_box('Shoulder armor',defs['upperArm_'+('L' if sign==1 else 'R')][0]+Vector((.01,sign*.035,0)),(.20,.16,.15),plate,.035),'upperArm_'+('L' if sign==1 else 'R'))
   add(bevel_box('Ammo pouch',hip+Vector((.14,sign*.115,.08)),(.075,.09,.13),rib,.009),'hips')
  for n in range(3):add(bevel_box('Chest magazine',ch+Vector((.20,(n-1)*.105,-.13)),(.065,.08,.12),rib,.009),'chest')
  add(bevel_box('Back field pack',ch+Vector((-.19,0,-.07)),(.18,.32,.36),plate,.035),'chest')
 else:
  # Swept asymmetrical elongated carapace: tall cranial dome, narrow facial muzzle.
  h=cfg['head'];sections=[]
  for x,a,b,z in [(-.78,.008,.008,.09),(-.62,.13,.14,.12),(-.37,.18,.19,.13),(0,.185,.19,.11),(.29,.16,.16,.05),(.49,.115,.105,-.015),(.61,.045,.042,-.05)]:sections.append((head+Vector((x*h,0,z*h)),a*w**.25,b*h))
  add(loft('Elongated cranial carapace',sections,plate,24,3),'head')
  for sign in [-1,1]:
   add(tube('Cranial ridge',[head+Vector((-.65,sign*.095,.13)),head+Vector((-.29,sign*.18,.10)),head+Vector((.20,sign*.15,.005)),head+Vector((.54,sign*.07,-.075))],[.012,.018,.018,.009],rib,8),'head')
   add(tube('Zygomatic tendon',[head+Vector((-.06,sign*.12,-.08)),head+Vector((.25,sign*.135,-.17)),head+Vector((.56,sign*.07,-.13))],[.026,.035,.018],skin,8),'head')
  j=defs['jaw'][0];add(loft('Articulated lower mandible',[(j+Vector((-.1,0,.01)),.08,.035),(j+Vector((.1,0,-.025)),.09,.042),(j+Vector((.30,0,-.005)),.052,.03)],rib,14,2),'jaw')
  for n in range(8):
   for sign in [-1,1]:
    x=.24+n*.035
    add(tube('Upper tooth',[head+Vector((x,sign*.07,-.11)),head+Vector((x+.007,sign*.065,-.16))],[.008,.001],tooth,5),'head')
    add(tube('Lower tooth',[j+Vector((n*.033,sign*.061,-.005)),j+Vector((n*.033+.005,sign*.06,.03))],[.007,.001],tooth,5),'jaw')
  ij=defs['innerJaw'][0];add(tube('Inner jaw piston',[ij,ij+Vector((.18,0,0))],[.035,.03],rib,10),'innerJaw');add(bevel_box('Inner bite',ij+Vector((.2,0,0)),(.06,.07,.045),tooth,.007),'innerJaw')
  # Layered rib plates follow the fused torso and leave darker organic junctions.
  for n in range(8):
   z=hip.z+.12+n*.055;u=(z-hip.z)/(ch.z-hip.z);x=hip.x+(ch.x-hip.x)*u
   for sign in [-1,1]:add(tube('Biomechanical costal arch',[(x-.08,sign*.17*w,z+.02),(x+.02,sign*.21*w,z),(x+.15,sign*.12*w,z-.025)],[.018,.022,.013],rib,8),'spine' if n<4 else 'chest')
  for n in range(6):add(loft('Ventral exoskeleton segment',[(hip+Vector((.13,0,.03+n*.045)),.09*w,.018),(hip+Vector((.145,0,.055+n*.045)),.105*w,.023)],plate,10,1),'hips' if n<3 else 'spine')
  for n in range(4):
   for sign in [-1,1]:add(tube('Dorsal respiratory spine',[ch+Vector((-.12,sign*.08,-.12+n*.065)),ch+Vector((-.28,sign*.13,.03+n*.06)),ch+Vector((-.35,sign*.14,.12+n*.05))],[.04,.035,.022],rib,10),'chest')
  if cfg['bulk']>1.1:
   for sign in [-1,1]:add(loft('Heavy shoulder shield',[(ch+Vector((.01,sign*.20*w,-.10)),.10,.08),(ch+Vector((-.01,sign*.25*w,.07)),.16,.09),(ch+Vector((-.06,sign*.26*w,.17)),.025,.02)],plate,12,2),'upperArm_'+('L' if sign==1 else 'R'))
  if cfg['width']>1.3:
   for sign in [-1,1]:
    for n in range(5):add(tube('Praetorian crown blade',[head+Vector((-.5+n*.16,sign*.10,.16)),head+Vector((-.58+n*.13,sign*(.24+n*.012),.31)),head+Vector((-.7+n*.11,sign*.25,.37))],[.035,.022,.002],plate,8),'head')
  tail=[defs[f'tail{i:02}'][0] for i in range(17)]+[defs['tail16'][1]]
  o=tube('Continuous segmented tail skin',tail,[.088*(1-i/20) for i in range(18)],skin,12)
  for i,vert in enumerate(o.data.vertices):
   near=sorted(((vert.co-defs[f'tail{k:02}'][0]).length,k) for k in range(17))[:2];weights=[1/(d+.02)**3 for d,k in near];total=sum(weights)
   for (d,k),v in zip(near,weights):
    name=f'tail{k:02}';g=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);g.add([vert.index],v/total,'REPLACE')
  o.parent=rig;mod=o.modifiers.new('Tail skin binding','ARMATURE');mod.object=rig;parts.append(o)
  for i in range(17):
   a,b,_=defs[f'tail{i:02}'];r=.09*(1-i/20)
   add(tube('Tail dorsal serration',[a+Vector((-.015,0,r*.55)),a+Vector((-.07,0,r+(.085 if i<13 else .05)))],[.022,.001],plate,6),f'tail{i:02}')
   for sign in [-1,1]:add(tube('Tail annular plating',[a+Vector((.01,sign*r,0)),a+Vector((-.04,sign*r,.04))],[.012,.008],rib,6),f'tail{i:02}')
  tip=defs['tail16'][1];add(loft('Lance shaped tail blade',[(tip+Vector((.05,0,0)),.04,.012),(tip+Vector((-.07,0,.02)),.105,.018),(tip+Vector((-.26,0,.03)),.001,.001)],plate,10,2),'tail16')
 # Articulated hands and toes: each phalanx has its own skin weights.
 for side in ['L','R']:
  hand=defs['hand_'+side][0];add(loft('Palm',[(hand,.05 if human else .062,.035),(hand+Vector((.1,0,-.04)),.06,.03)],face if human else skin,12,2),'hand_'+side)
  for f in range(4 if human else 3):
   for letter in ['a','b']:
    n=f'finger{f}{letter}_'+side;a,b,_=defs[n];add(tube('Finger phalanx',[a,a.lerp(b,.5),b],[.012 if human else .018,.014 if human else .019,.01],face if human else skin,8),n)
   if not human:
    a=defs[f'finger{f}b_'+side][1];add(tube('Curved talon',[a,a+Vector((.07,0,-.025)),a+Vector((.09,0,-.09))],[.012,.009,.001],tooth,7),f'finger{f}b_'+side)
  ankle=defs['foot_'+side][0];toe=defs['toe_'+side][0]
  if human:
   add(loft('Anatomical combat boot',[(ankle+Vector((0,0,-.05)),.074,.075),(toe+Vector((-.02,0,.01)),.08,.055),(toe+Vector((.13,0,0)),.065,.035)],rib,14,3),'foot_'+side)
   add(bevel_box('Knee guard',defs['shin_'+side][0]+Vector((.07,0,0)),(.055,.14,.16),plate,.02),'shin_'+side)
  else:
   add(loft('Digitigrade instep',[(ankle,.06,.05),(ankle.lerp(toe,.65),.075,.05),(toe,.09,.03)],skin,12,2),'foot_'+side)
   for f in range(3):add(tube('Raptorial toe',[toe+Vector((0,(f-1)*.047,0)),toe+Vector((.16,(f-1)*.064,-.015)),toe+Vector((.21,(f-1)*.067,-.035))],[.023,.014,.001],tooth,7),'toe_'+side)
 if human:
  origin=defs['weapon'][0]
  add(bevel_box('Pulse rifle receiver',origin+Vector((.17,0,.04)),(.42,.075,.12),rib,.014),'weapon')
  add(bevel_box('Rifle stock',origin+Vector((-.12,0,.06)),(.17,.065,.10),plate,.014),'weapon')
  add(bevel_box('Magazine',origin+Vector((.15,0,-.065)),(.09,.065,.15),plate,.008),'weapon')
  add(tube('Rifle barrel',[origin+Vector((.35,0,.06)),origin+Vector((.65,0,.06))],[.021,.018],edge,10),'weapon')
  add(bevel_box('Fore grip',origin+Vector((.36,0,-.025)),(.09,.065,.10),plate,.01),'weapon')
  add(bevel_box('Optic',origin+Vector((.12,0,.13)),(.105,.05,.05),rib,.01),'weapon')
 return parts

def ik(a,c,l1,l2,pole):
 delta=c-a;dist=max(.001,min(delta.length,l1+l2-.001));axis=delta.normalized();u=(pole-a)-axis*(pole-a).dot(axis)
 if u.length<.001:u=Vector((1,0,0))
 u.normalize();along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));return a+axis*along+u*height

def author_clips(rig,defs,human,cfg):
 clips={'Idle':2.4,'Walk':cfg['step'],'Crawl':1.4,'Run':.62 if not human else .72,'Light1':.36,'Light2':.39,'Light3':.52,'Heavy':.65,'Launcher':.48,'Air':.48,'Jump':.8,'Dash':.30,'Landing':.24,'Parry':.35,'Special':.70,'Ultimate':.85,'Grab':.55,'Throw':.52,'Hurt':.40,'Death':1.25,'Victory':1.8}
 if human:clips.update({'Aim':2.0,'Fire':.17,'Reload':1.45})
 rig.animation_data_create();base_rest={b.name:b.matrix_local.copy() for b in rig.data.bones};base={n:(a.copy(),b.copy(),parent) for n,(a,b,parent) in defs.items()}
 def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
 for state,duration in clips.items():
  action=bpy.data.actions.new(state);action.use_fake_user=True;rig.animation_data.action=action
  frames=max(4,round(duration*FPS));times=list(range(0,frames+1,2))
  if times[-1]!=frames:times.append(frames)
  for frame in times:
   t=frame/frames;phase=t*TAU;pos={n:(a.copy(),b.copy()) for n,(a,b,_) in base.items()}
   hip0=base['hips'][0];hip=hip0.copy();forward=Vector((1,0,0));strike=0;torso_twist=0
   moving=state in ['Walk','Run','Crawl'];attack=state in ['Light1','Light2','Light3','Heavy','Launcher','Air','Special','Ultimate','Grab','Throw']
   # Five key portions: anticipation, acceleration, contact, follow-through, recovery.
   strike=smooth(t/.32)*(1-smooth((t-.47)/.53)) if attack else 0
   wind=math.sin(min(1,t/.27)*math.pi)*.12 if attack and t<.27 else 0
   if moving:hip.x+=math.sin(phase)*.015;hip.z+=abs(math.sin(phase))*(.025 if human else .035)
   else:hip.z+=math.sin(phase)*.008
   if state in ['Dash','Landing']:hip.z-=math.sin(math.pi*t)*(.15 if human else .23);hip.x+=math.sin(math.pi*t)*.10
   if attack:hip.x+=strike*.075-wind;hip.z-=strike*.03;torso_twist=(.45 if state in ['Light2','Heavy'] else -.25)*strike
   if state=='Hurt':hip.x-=math.sin(math.pi*t)*.14;hip.z-=math.sin(math.pi*t)*.08
   if state=='Death':hip.z-=smooth(t)*(.72 if human else .74);hip.x-=smooth(t)*.20
   if human and state not in ['Death','Jump']:hip.z-=.14
   if not human and moving:hip.z-=.03
   shift=hip-hip0;ch=base['chest'][0]+shift;ne=base['neck'][0]+shift;he=base['head'][0]+shift
   if moving and not human:
    hip.z-=.13 if state=='Crawl' else .07;ch=hip+Vector((.40,0,-.16 if state=='Crawl' else -.08));ne=ch+Vector((.18,0,.12));he=ne+Vector((.10,0,.12))
   if human and moving:
    ch.y+=math.sin(phase)*.018;ne.y-=math.sin(phase)*.009;he.y-=math.sin(phase)*.012
   if attack:ch.x+=strike*.07;ne.x+=strike*.08;he.x+=strike*.10
   if state=='Hurt':ch.x-=.13*math.sin(math.pi*t);he.x-=.2*math.sin(math.pi*t)
   if state=='Death':
    ch.z-=smooth(t)*.34;he.z-=smooth(t)*.56;he.x+=smooth(t)*.24
    if human:
     fall=smooth(t);hip.z=hip.z*(1-fall)+.14*fall;ch=ch.lerp(hip+Vector((.34,.03,.015)),fall);ne=ne.lerp(ch+Vector((.12,.02,0)),fall);he=he.lerp(ne+Vector((.15,0,-.02)),fall)
   pos['hips']=(hip,(hip+ch)/2);pos['spine']=((hip+ch)/2,ch);pos['chest']=(ch,ne);pos['neck']=(ne,he);pos['head']=(he,he+Vector((.38,0,-.03*strike)))
   for side,sign in [('L',1),('R',-1)]:
    shoulder=ch+Vector((-.01,sign*(.225 if human else .215*cfg['width']),-.005));shoulder.x+=sign*torso_twist*.13
    if human:
     hand=ch+Vector((.34 if sign==-1 else .57,sign*.13,-.12));elbow_pole=shoulder+Vector((-.10,sign*.22,-.20))
     if state=='Reload' and side=='L':hand=ch+Vector((.24+math.sin(t*TAU)*.08,.09,-.20-abs(math.sin(t*math.pi*2))*.16))
     if state=='Fire':hand.x-=math.sin(math.pi*t)*.045
     if attack:
      if state in ['Heavy','Ultimate']:hand=shoulder+Vector((.20+strike*.28,sign*.15,.22-strike*.63))
      elif state=='Light2':hand=shoulder+Vector((.23+strike*.30,sign*.10,.15-strike*.32))
      elif state=='Launcher':hand=shoulder+Vector((.24+strike*.32,sign*.12,-.38+strike*.55))
      else:hand=shoulder+Vector((.20+strike*.36,sign*.11,-.13))
      hand.x-=wind
     if moving:hand.z-=.04;hand.x-=.03
     if state=='Death':hand=hand.lerp(shoulder+Vector((.12,sign*.24,-.02)),smooth(t))
    else:
     hand=shoulder+Vector((.43,sign*.09,-.43));elbow_pole=shoulder+Vector((-.10,sign*.16,-.25))
     if moving:hand.x+=math.sin(phase+sign*math.pi/2)*.16;hand.z+=math.cos(phase+sign*math.pi/2)*.035
     if moving:
      ph=(t+(0.5 if side=='L' else 0))%1
      hand=Vector((hip.x+.55+(.5-ph)*cfg['stride']*.65,sign*.24,.23+max(0,math.sin(ph*TAU))*.13))
     if attack:
      if state=='Light1':hand=shoulder+Vector((.28+strike*.43,sign*(.22-.26*strike),-.13-.10*strike));hand.x-=wind*2
      elif state=='Light2':hand=shoulder+Vector((.24+strike*.42,sign*(.15-.20*strike),.17-.48*strike));hand.x-=wind
      elif state in ['Light3','Ultimate']:hand=shoulder+Vector((.22+strike*.47,sign*.10,.13-.35*strike))
      elif state=='Launcher':hand=shoulder+Vector((.26+strike*.36,sign*.11,-.46+.65*strike))
      elif state=='Heavy':hand=shoulder+Vector((.18,sign*.24,-.23));he.x-=strike*.08
      elif state=='Throw':hand=shoulder+Vector((.25+strike*.48,sign*.08,-.08+.1*strike))
      else:hand=shoulder+Vector((.26+strike*.37,sign*.1,-.20))
     if state=='Parry':hand=ch+Vector((.32,sign*.08,.08))
     if state=='Jump':hand.z+=math.sin(math.pi*t)*.23
     if state=='Victory':hand=shoulder+Vector((.10,sign*.40,.35))
     if state=='Death':hand=shoulder+Vector((.15,sign*.25,-.35))
    l1=(base['upperArm_'+side][1]-base['upperArm_'+side][0]).length;l2=(base['forearm_'+side][1]-base['forearm_'+side][0]).length
    # Keep hands inside the anatomically reachable sphere.
    delta=hand-shoulder
    if delta.length>l1+l2-.008:hand=shoulder+delta.normalized()*(l1+l2-.008)
    elbow=ik(shoulder,hand,l1,l2,elbow_pole)
    pos['shoulder_'+side]=(ch,shoulder);pos['upperArm_'+side]=(shoulder,elbow);pos['forearm_'+side]=(elbow,hand);pos['hand_'+side]=(hand,hand+Vector((.1,0,-.06 if human else -.08)))
    for f in range(4 if human else 3):
     start=hand+Vector((.06,(f-1.5 if human else f-1)*.026,-.035));curl=(.45 if human else .08)+(.45*strike if attack else 0)
     middle=start+Vector((.085 if human else .115,0,-.035-curl*.04));end=middle+Vector((.04 if human else .10,0,-.04-curl*.035))
     pos[f'finger{f}a_'+side]=(start,middle);pos[f'finger{f}b_'+side]=(middle,end)
    h=hip+Vector((0,sign*.12*cfg['width'],0));ankle=base['foot_'+side][0].copy()
    if moving:
     ph=(t+(0 if side=='L' else .5))%1
     ankle.x+=(.5-ph)*cfg['stride'];ankle.z+=max(0,math.sin(ph*TAU))*(.12 if human else .18)
    if state=='Dash':ankle.z+=math.sin(math.pi*t)*.18;ankle.x+=math.sin(math.pi*t)*(.18 if side=='L' else -.16)
    if state in ['Jump','Air']:ankle=hip+Vector((.16 if side=='L' else -.18,sign*.15,-.55))
    if state=='Death':ankle.x-=smooth(t)*.15
    l1=(base['thigh_'+side][1]-base['thigh_'+side][0]).length;l2=(base['shin_'+side][1]-base['shin_'+side][0]).length
    delta=ankle-h
    if delta.length>l1+l2-.002:ankle=h+delta.normalized()*(l1+l2-.002)
    knee=ik(h,ankle,l1,l2,h+Vector((.5,sign*.08,-.3)))
    toe=ankle+Vector((.19 if human else .32,0,-(.085 if human else .175)))
    pos['thigh_'+side]=(h,knee);pos['shin_'+side]=(knee,ankle);pos['foot_'+side]=(ankle,toe);pos['toe_'+side]=(toe,toe+Vector((.13,0,-.02)))
   ja=base['jaw'][0]+(he-base['head'][0]);open_jaw=(strike*.35 if attack else .04+.02*math.sin(phase)) if not human else 0
   pos['jaw']=(ja,ja+Vector((.23,0,-open_jaw)));ij=base['innerJaw'][0]+(he-base['head'][0])+Vector((strike*.22 if state in ['Grab','Ultimate'] else 0,0,0));pos['innerJaw']=(ij,ij+Vector((.18,0,0)))
   if human:
    grip=pos['hand_R'][0];pos['weapon']=(grip,grip+Vector((.62,0,.012)));pos['muzzle']=(grip+Vector((.64,0,.06)),grip+Vector((.69,0,.06)))
   else:
    a=hip+Vector((-.09,0,0))
    for i in range(17):
     length=(base[f'tail{i:02}'][1]-base[f'tail{i:02}'][0]).length
     yaw=math.sin(phase*.6-i*.25)*.10;pitch=1.05-i*.095+math.sin(phase*.6-i*.25)*.055
     if moving:yaw=math.sin(phase-i*.3)*.17;pitch=.12+math.sin(phase-i*.25)*.10
     if state=='Heavy':yaw=math.sin((t-i*.012)*math.pi)*3.0*strike;pitch=.10+math.sin(i*.2)*.06
     if state=='Dash':pitch=.03;yaw=.04*math.sin(i*.3)
     b=a+Vector((-math.cos(yaw)*math.cos(pitch),math.sin(yaw)*math.cos(pitch),math.sin(pitch)))*length
     pos[f'tail{i:02}']=(a,b);a=b
   # Armature-space transforms are baked into standard translation/quaternion tracks.
   pose_mats={}
   for n,(rest_a,rest_b,parent) in base.items():
    a,b=pos[n];pb=rig.pose.bones[n];pb.rotation_mode='QUATERNION';direction=(b-a).normalized()
    delta=(rest_b-rest_a).normalized().rotation_difference(direction);rotation=delta@rig.data.bones[n].matrix_local.to_quaternion();desired=Matrix.Translation(a)@rotation.to_matrix().to_4x4();pose_mats[n]=desired
    bone=rig.data.bones[n];rest_local=base_rest[parent].inverted()@base_rest[n] if parent else base_rest[n];posed_local=pose_mats[parent].inverted()@desired if parent else desired;pb.matrix_basis=rest_local.inverted()@posed_local
    pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame)
  for fc in action.fcurves:
   for key in fc.keyframe_points:key.interpolation='BEZIER';key.handle_left_type='AUTO_CLAMPED';key.handle_right_type='AUTO_CLAMPED'
  track=rig.animation_data.nla_tracks.new();track.name=state;strip=track.strips.new(state,0,action);strip.name=state;track.mute=True
 rig.animation_data.action=None
 return list(clips)

def build(name,cfg):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for a in list(bpy.data.actions):bpy.data.actions.remove(a)
 bpy.context.scene.render.fps=FPS
 human=name=='marine'
 mats=[mat('Organic undercarapace',(.018,.026,.030),.12,.48),mat('Dark blue chitin',(.025,.044,.057),.38,.24),mat('Ribbed tendon',(.008,.012,.016),.18,.42),mat('Raised graphite ridges',(.10,.14,.16),.45,.36),mat('Ivory claws',(.14,.19,.18),.4,.27),mat('Olive combat fabric',(.075,.105,.065),.02,.84),mat('Human skin',(.37,.235,.155),0,.61)]
 if human:mats[1]=mat('Olive composite armor',(.115,.15,.095),.24,.48);mats[2]=mat('Dark weapon steel',(.025,.034,.037),.55,.38)
 rig,defs=make_skeleton(human,cfg);parts=make_surface(rig,defs,human,cfg,mats)
 # Join skinned surfaces so glTF contains a handful of material primitives, not hundreds of draw calls.
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();character=bpy.context.object;character.name='MarineSkinnedSurface' if human else name.title()+'SkinnedSurface'
 while len(character.modifiers)>1:character.modifiers.remove(character.modifiers[-1])
 if not character.modifiers:mod=character.modifiers.new('Skeleton','ARMATURE');mod.object=rig
 bpy.context.view_layer.objects.active=character;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
 animations=author_clips(rig,defs,human,cfg)
 bpy.ops.object.select_all(action='DESELECT');character.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.context.scene.frame_set(0)
 out=OUT/f'character_{name}.glb'
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_all_influences=False,export_optimize_animation_size=True,export_anim_single_armature=True)
 if not human:
  rig.animation_data.action=bpy.data.actions.get('Idle');bpy.context.scene.frame_set(10)
  scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False;scene.render.resolution_x=320;scene.render.resolution_y=256;scene.render.resolution_percentage=100
  world=bpy.data.worlds.new('Portrait studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.055,.075,1);world.node_tree.nodes['Background'].inputs[1].default_value=.4;scene.world=world
  for location,power,color,size in [((2,-3,4),450,(.45,.85,1),3),((-2,2,3),650,(.12,1,.85),2),((3,2,2),180,(1,.65,.3),2)]:
   data=bpy.data.lights.new('Studio softbox','AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size;o=bpy.data.objects.new('Studio softbox',data);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
  data=bpy.data.cameras.new('PortraitCamera');camera=bpy.data.objects.new('PortraitCamera',data);scene.collection.objects.link(camera);camera.location=(3,-4,2.5);camera.rotation_euler=(Vector((.1,0,1.25))-camera.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=2.25;scene.camera=camera
  scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/f'portrait_{name}.png');bpy.ops.render.render(write_still=True)
  rig.animation_data.action=None
 print('CHARACTER_EXPORT',name,out.stat().st_size,'vertices',len(character.data.vertices),'polygons',len(character.data.polygons),'bones',len(defs),'clips',animations,flush=True)
 return dict(file=out.name,vertices=len(character.data.vertices),polygons=len(character.data.polygons),bones=len(defs),clips=animations,profile=cfg,scale=44)

report=json.loads((OUT/'character_manifest.json').read_text())['characters'] if opts.only and (OUT/'character_manifest.json').exists() else {}
for name,cfg in PROFILES.items():
 if not opts.only or opts.only==name:report[name]=build(name,cfg)
(OUT/'character_manifest.json').write_text(json.dumps({'generator':'tools/build_characters.py','blender':bpy.app.version_string,'characters':report},ensure_ascii=False,indent=2)+'\n')
