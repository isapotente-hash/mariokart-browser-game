import * as THREE from 'three';
import { config } from '../data/config';
import type { CourseDefinition, KartState } from '../data/types';
import { surfaceForward } from '../gameplay/TraversalSystem';
import { sampleTrack } from '../tracks/course';

export class ChaseCamera {
  private look=new THREE.Vector3();private desired=new THREE.Vector3();private target=new THREE.Vector3();
  private up=new THREE.Vector3();private direction=new THREE.Vector3();private origin=new THREE.Vector3();private ray=new THREE.Raycaster();
  private lastFollow=new THREE.Vector3();private following=false;
  constructor(readonly camera:THREE.PerspectiveCamera){}
  update(kart:KartState,dt:number,menu:boolean,rear:boolean,snap=false,course?:CourseDefinition,blockers:THREE.Object3D[]=[],reducedMotion=false):void {
    if(course?.arena&&!menu&&this.following&&Math.hypot(kart.x-this.lastFollow.x,kart.z-this.lastFollow.z)>12)snap=true;
    this.lastFollow.set(kart.x,kart.y,kart.z);this.following=!menu;
    const forward=surfaceForward(kart.heading,kart.up),right={x:-forward.z,y:0,z:forward.x},sign=rear&&!menu?-1:1;
    this.up.set(kart.up.x,kart.up.y,kart.up.z).normalize();
    const distance=menu?16:config.camera.distance+Math.min(3,Math.abs(kart.speed)*.07),height=menu?11:config.camera.height;
    this.desired.set(kart.x-forward.x*distance*sign+this.up.x*height+(menu?right.x*11:0),kart.y-forward.y*distance*sign+this.up.y*height,kart.z-forward.z*distance*sign+this.up.z*height+(menu?right.z*11:0));
    const ahead=menu?2:kart.traversal==='gliding'?10:config.camera.lookAhead;
    this.target.set(kart.x+forward.x*ahead*sign+this.up.x*.9-(menu?right.x*5:0),kart.y+forward.y*ahead*sign+this.up.y*.9,kart.z+forward.z*ahead*sign+this.up.z*.9-(menu?right.z*5:0));
    this.origin.set(kart.x+this.up.x*1.2,kart.y+this.up.y*1.2,kart.z+this.up.z*1.2);this.direction.subVectors(this.desired,this.origin);
    const length=this.direction.length();this.direction.normalize();this.ray.set(this.origin,this.direction);this.ray.far=length;
    const collision=this.ray.intersectObjects(blockers,false)[0];
    if(collision)this.desired.copy(this.origin).addScaledVector(this.direction,Math.max(2,collision.distance-.5));
    if(course){const terrain=sampleTrack(course,{x:this.desired.x,z:this.desired.z});if(!terrain.gap&&terrain.distance<terrain.width/2+2)this.desired.y=Math.max(this.desired.y,terrain.height+.8);}
    const blend=snap?1:1-Math.exp(-(reducedMotion?11:config.camera.smoothing)*dt);
    this.camera.position.lerp(this.desired,blend);this.look.lerp(this.target,blend);this.camera.up.lerp(this.up,blend).normalize();this.camera.lookAt(this.look);
    const fov=menu?43:54+(reducedMotion?0:Math.min(8,Math.abs(kart.speed)*.26));
    if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov+=(fov-this.camera.fov)*blend;this.camera.updateProjectionMatrix();}
  }
}
