import * as THREE from 'three';
import type { Race } from '../gameplay/Race';
import { createKart } from './kart';
import type { KartModel } from './kart';
import { config } from '../data/config';
import type { Quality, VehicleBuild } from '../data/options';
import { qualityProfiles } from '../data/options';
import { hazardPose, sampleTrack } from '../tracks/course';
import { orient, disposeGroup } from './resources';
import type { GhostFrame } from '../platform/Ghosts';

export class RaceVisuals {
  readonly root=new THREE.Group();
  private models:KartModel[]=[];private modelKeys:string[]=[];private angles:number[]=[];
  private pickups:THREE.Object3D[]=[];private objects:THREE.Group[]=[];private effects:THREE.Group[]=[];private bubbles:THREE.Group[]=[];private hazards:THREE.Mesh[]=[];
  private ghost:KartModel|null=null;private ghostKey='';
  private balloons:THREE.Group[]=[];
  private readonly kinds=['banana','shell','homing','explosive','leader','burst'];
  constructor(){
    const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.6});
    const banana=new THREE.Group(),yellow=mat('#ffcf43'),peel=new THREE.TorusGeometry(.42,.12,5,9,Math.PI*.8);
    for(let i=0;i<3;i++){const mesh=new THREE.Mesh(peel,yellow);mesh.rotation.set(Math.PI/2,0,i*Math.PI*2/3);mesh.position.y=.35;banana.add(mesh);}
    const projectile=(color:string,wings=false)=>{const group=new THREE.Group();const cap=new THREE.Mesh(new THREE.SphereGeometry(.65,10,8),mat(color));cap.scale.y=.6;const rim=new THREE.Mesh(new THREE.TorusGeometry(.58,.12,5,12),mat('#fff0ca'));rim.rotation.x=Math.PI/2;group.add(cap,rim);group.position.y=.1;if(wings)for(const side of[-1,1]){const wing=new THREE.Mesh(new THREE.BoxGeometry(1,.12,.5),mat('#f4e9ce'));wing.position.set(side*.85,.2,0);wing.rotation.z=side*.3;group.add(wing);}return group;};
    const bomb=new THREE.Group();bomb.add(new THREE.Mesh(new THREE.SphereGeometry(.55,10,8),mat('#343d4a')));const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.5,5),mat('#e7ab5b'));fuse.position.y=.7;bomb.add(fuse);
    const explosion=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:'#efa05b',transparent:true,opacity:.22,depthWrite:false}));bomb.add(explosion);
    const burst=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(1,.06,5,32),new THREE.MeshBasicMaterial({color:'#a1e2f4',transparent:true,opacity:.75,depthWrite:false}));ring.rotation.x=Math.PI/2;burst.add(ring);
    const prototypes=[banana,projectile('#55bb71'),projectile('#d46d55'),bomb,projectile('#6c8bdd',true),burst];
    for(let i=0;i<config.items.poolSize;i++){const group=new THREE.Group();group.add(...prototypes.map((object)=>object.clone()));group.visible=false;this.objects.push(group);this.root.add(group);}
    const box=new THREE.Mesh(new THREE.OctahedronGeometry(.85),new THREE.MeshStandardMaterial({color:'#a7dce8',emissive:'#397b88',emissiveIntensity:.35,metalness:.15,roughness:.3}));
    const coin=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.15,12),new THREE.MeshStandardMaterial({color:'#ffcf43',metalness:.4,roughness:.45}));coin.rotation.x=Math.PI/2;
    for(let i=0;i<45;i++){const pickup=new THREE.Group();pickup.add(box.clone(),coin.clone());this.pickups.push(pickup);this.root.add(pickup);}
    const balloonGeometry=new THREE.SphereGeometry(.48,10,8),stringGeometry=new THREE.CylinderGeometry(.012,.012,1.4,4),stringMaterial=mat('#e6efeb');
    const balloonMaterials=['#ff9a70','#78d4dd','#f6d56e'].map(mat);
    const bubbleGeometry=new THREE.SphereGeometry(.12,6,4),bubbleMaterial=new THREE.MeshBasicMaterial({color:'#caeff2',transparent:true,opacity:.45,depthWrite:false});
    for(let i=0;i<12;i++){
      const balloons=new THREE.Group();balloons.name=`battle-balloons-${i}`;for(let j=0;j<3;j++){const balloon=new THREE.Group(),sphere=new THREE.Mesh(balloonGeometry,balloonMaterials[j]!);sphere.scale.y=1.2;sphere.position.y=.7;const string=new THREE.Mesh(stringGeometry,stringMaterial);string.position.y=-.55;balloon.add(sphere,string);balloon.position.set((j-1)*.85,j===1?.35:0,0);balloons.add(balloon);}this.balloons.push(balloons);this.root.add(balloons);
      const group=new THREE.Group(),trail=new THREE.Mesh(new THREE.ConeGeometry(.3,2.5,5),new THREE.MeshBasicMaterial({color:'#ffc24b'}));trail.rotation.x=-Math.PI/2;trail.position.set(0,.4,-2.3);
      const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.23),new THREE.MeshBasicMaterial({color:'#65c9ff'}));spark.position.set(-1,.3,-1);const other=spark.clone();other.position.x=1;
      const halo=new THREE.Mesh(new THREE.TorusGeometry(1.35,.06,4,20),new THREE.MeshBasicMaterial({color:'#e5fbf4',transparent:true,opacity:.65}));halo.rotation.x=Math.PI/2;halo.position.y=.15;
      const shield=new THREE.Mesh(new THREE.SphereGeometry(1.65,12,8),new THREE.MeshBasicMaterial({color:'#71cee0',transparent:true,opacity:.15,depthWrite:false,wireframe:true}));shield.position.y=.8;
      const star=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5,0),new THREE.MeshBasicMaterial({color:'#ffe396',wireframe:true}));star.position.y=.8;
      group.add(trail,spark,other,halo,shield,star);this.effects.push(group);this.root.add(group);
      const bubbles=new THREE.Group();for(let j=0;j<16;j++)bubbles.add(new THREE.Mesh(bubbleGeometry,bubbleMaterial));this.bubbles.push(bubbles);this.root.add(bubbles);
    }
  }
  private model(index:number,build:VehicleBuild):KartModel {
    const key=[build.driver,build.chassis,build.tyres,build.glider].join(':');
    if(this.modelKeys[index]!==key){const previous=this.models[index];if(previous){this.root.remove(previous.root);disposeGroup(previous.root);}const next=createKart(build);this.models[index]=next;this.modelKeys[index]=key;this.angles[index]=0;this.root.add(next.root);}
    return this.models[index]!;
  }
  sync(race:Race,alpha:number,visible:boolean,dt=0,quality:Quality='medium',ghostFrame:GhostFrame|null=null):void {
    this.root.visible=visible;if(!visible)return;const particles=qualityProfiles[quality].particles;
    for(let i=0;i<12;i++){
      const racer=race.racers[i];
      if(!racer){if(this.models[i])this.models[i]!.root.visible=false;this.effects[i]!.visible=false;this.bubbles[i]!.visible=false;this.balloons[i]!.visible=false;continue;}
      const state=racer.controller.state,previous=racer.previous,model=this.model(i,racer.controller.build);
      const x=THREE.MathUtils.lerp(previous.x,state.x,alpha),y=THREE.MathUtils.lerp(previous.y,state.y,alpha),z=THREE.MathUtils.lerp(previous.z,state.z,alpha);
      const heading=THREE.MathUtils.lerp(previous.heading,state.heading,alpha),up={x:THREE.MathUtils.lerp(previous.up.x,state.up.x,alpha),y:THREE.MathUtils.lerp(previous.up.y,state.up.y,alpha),z:THREE.MathUtils.lerp(previous.up.z,state.up.z,alpha)};
      const balloons=this.balloons[i]!;balloons.visible=!!race.battle;balloons.position.set(x,y+3.1+Math.sin(race.time*2+i)*.08,z);balloons.rotation.y=heading;for(let j=0;j<3;j++)balloons.children[j]!.visible=j<(race.battle?.stats[racer.id]?.balloons??0);
      model.root.visible=true;model.root.position.set(x,y+.09+state.hop+(racer.rescueRemaining>0?1.5:0),z);
      orient(model.root,heading+(state.spin>0?(1-state.spin/config.race.hitSpin)*Math.PI*4:0),up,state.traversal==='gliding'?state.pitch:0);
      model.body.rotation.z=racer.finishTime!==null?Math.sin(race.time*6)*.04:-racer.input.steering*Math.min(.07,Math.abs(state.speed)*.003);
      model.body.position.y=racer.finishTime!==null?.05+Math.sin(race.time*7)*.04:0;
      this.angles[i]=(this.angles[i]??0)+state.speed*dt/.43;
      for(const roller of model.rollers)roller.rotation.x=this.angles[i]!;
      for(const wheel of model.wheels)wheel.rotation.z=state.traversal==='anti-gravity'?(wheel.position.x>0?-1:1)*Math.PI/2:0;
      for(const wheel of model.frontWheels)wheel.rotation.y=racer.input.steering*.35;
      model.glider.visible=state.traversal==='gliding';
      const effects=this.effects[i]!;effects.visible=true;effects.position.set(x,y+.1,z);orient(effects,heading,up);
      effects.children[0]!.visible=state.boost>0;
      for(let j=1;j<=2;j++){const spark=effects.children[j] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;spark.visible=state.driftStage>0&&particles>0;spark.material.color.set(['#65c9ff','#65c9ff','#f2a33b','#c781f5'][state.driftStage]!);spark.scale.setScalar(1+state.driftStage*.3);}
      effects.children[3]!.visible=state.immunity>0||racer.rescueRemaining>0;effects.children[4]!.visible=state.shield>0;effects.children[5]!.visible=state.invincible>0;
      const bubbles=this.bubbles[i]!;bubbles.visible=state.traversal==='underwater'&&particles>0;bubbles.position.set(x,y,z);
      for(let j=0;j<bubbles.children.length;j++){const bubble=bubbles.children[j]!;bubble.visible=j<(particles===2?16:7);bubble.position.set(Math.sin(j*4.7+race.time)*1.2,(j*.3+race.time*1.5)%4,Math.cos(j*3.1+race.time)*1.2);}
    }
    for(let i=0;i<this.pickups.length;i++){const model=this.pickups[i]!,pickup=race.items.pickups[i];model.visible=!!pickup&&pickup.enabled&&pickup.cooldown<=0;if(!pickup)continue;model.children[0]!.visible=pickup.kind==='box';model.children[1]!.visible=pickup.kind==='coin';model.position.set(pickup.x,pickup.y+(pickup.kind==='box'?1.25:.95),pickup.z);model.rotation.y=race.time*1.3;model.scale.setScalar(pickup.double?1.12:1);}
    for(let i=0;i<this.objects.length;i++){
      const model=this.objects[i]!,item=race.items.objects[i]!;model.visible=item.active;if(!item.active)continue;model.position.set(item.x,item.y+.12,item.z);
      const kind=this.kinds.indexOf(item.kind);for(let j=0;j<model.children.length;j++)model.children[j]!.visible=j===kind;
      const up=sampleTrack(race.course,item).up;orient(model,item.kind==='banana'?0:item.age*7,up);
      model.scale.setScalar(item.kind==='burst'?Math.max(.1,item.radius):item.kind==='banana'&&item.age<config.items.armTime?.6:1);
      if(item.kind==='explosive'){
        const bomb=model.children[3]!;bomb.children[0]!.visible=!item.exploded;bomb.children[1]!.visible=!item.exploded;bomb.children[2]!.visible=item.exploded;bomb.children[2]!.scale.setScalar(item.radius);
      }
    }
    while(this.hazards.length<race.course.hazards.length){const hazard=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.8,1.8),new THREE.MeshStandardMaterial({color:'#e99d51',emissive:'#563010'}));hazard.castShadow=true;this.hazards.push(hazard);this.root.add(hazard);}
    for(let i=0;i<this.hazards.length;i++){const model=this.hazards[i]!,hazard=race.course.hazards[i];model.visible=!!hazard;if(hazard){const pose=hazardPose(race.course,hazard,race.time);model.position.set(pose.x,pose.y+.9,pose.z);}}
    if(ghostFrame){
      const build=race.player.controller.build,key=JSON.stringify(build);
      if(!this.ghost||key!==this.ghostKey){if(this.ghost){this.root.remove(this.ghost.root);disposeGroup(this.ghost.root);}this.ghost=createKart(build,true);this.ghostKey=key;this.root.add(this.ghost.root);}
      this.ghost.root.visible=true;this.ghost.root.position.set(ghostFrame.x,ghostFrame.y+.1,ghostFrame.z);orient(this.ghost.root,ghostFrame.heading,{x:ghostFrame.upX,y:ghostFrame.upY,z:ghostFrame.upZ},ghostFrame.pitch);this.ghost.glider.visible=ghostFrame.gliding;
    }else if(this.ghost)this.ghost.root.visible=false;
  }
}
