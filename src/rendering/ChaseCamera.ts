import * as THREE from 'three';
import { config } from '../data/config';
import type { CourseDefinition, KartState } from '../data/types';
import { surfaceForward } from '../gameplay/TraversalSystem';
import { sampleTrack } from '../tracks/course';
import {orient} from './resources';

export class ChaseCamera {
  private look=new THREE.Vector3();private desired=new THREE.Vector3();private target=new THREE.Vector3();
  private up=new THREE.Vector3();private direction=new THREE.Vector3();private origin=new THREE.Vector3();private ray=new THREE.Raycaster();
  private lastFollow=new THREE.Vector3();private following=false;
  private readonly castOrigin=new THREE.Vector3();private readonly probeRight=new THREE.Vector3();private readonly probeUp=new THREE.Vector3();
  private readonly rotation=new THREE.Quaternion();private readonly partialRotation=new THREE.Quaternion();
  private readonly frame=new THREE.Object3D();private readonly smoothFrame=new THREE.Quaternion();private readonly frameForward=new THREE.Vector3();
  constructor(readonly camera:THREE.PerspectiveCamera){}
  update(kart:KartState,dt:number,menu:boolean,rear:boolean,snap=false,course?:CourseDefinition,blockers:THREE.Object3D[]=[],reducedMotion=false):void {
    if(!menu&&this.following&&Math.hypot(kart.x-this.lastFollow.x,kart.y-this.lastFollow.y,kart.z-this.lastFollow.z)>12)snap=true;
    this.lastFollow.set(kart.x,kart.y,kart.z);this.following=!menu;
    let forward=kart.forward??surfaceForward(kart.heading,kart.up);
    this.up.set(kart.up.x,kart.up.y,kart.up.z).normalize();
    if(course?.imported){orient(this.frame,kart.heading,kart.up,0,forward);if(snap)this.smoothFrame.copy(this.frame.quaternion);else this.smoothFrame.slerp(this.frame.quaternion,1-Math.exp(-12*dt));this.up.set(0,1,0).applyQuaternion(this.smoothFrame);this.frameForward.set(0,0,1).applyQuaternion(this.smoothFrame);forward=this.frameForward;}
    const right={x:-forward.z,y:0,z:forward.x},sign=rear&&!menu?-1:1;
    const distance=menu?16:config.camera.distance+Math.min(3,Math.abs(kart.speed)*.07),height=menu?11:config.camera.height;
    this.desired.set(kart.x-forward.x*distance*sign+this.up.x*height+(menu?right.x*11:0),kart.y-forward.y*distance*sign+this.up.y*height,kart.z-forward.z*distance*sign+this.up.z*height+(menu?right.z*11:0));
    const ahead=menu?2:kart.traversal==='gliding'?10:config.camera.lookAhead;
    this.target.set(kart.x+forward.x*ahead*sign+this.up.x*.9-(menu?right.x*5:0),kart.y+forward.y*ahead*sign+this.up.y*.9,kart.z+forward.z*ahead*sign+this.up.z*.9-(menu?right.z*5:0));
    this.origin.set(kart.x+kart.up.x*1.2,kart.y+kart.up.y*1.2,kart.z+kart.up.z*1.2);
    if(course&&!course.imported){const terrain=sampleTrack(course,{x:this.desired.x,z:this.desired.z});if(!terrain.gap&&terrain.distance<terrain.width/2+2)this.desired.y=Math.max(this.desired.y,terrain.height+.8);}
    const blend=snap?1:1-Math.exp(-(reducedMotion?11:config.camera.smoothing)*dt);
    this.camera.position.lerp(this.desired,blend);
    // Smoothing an already safe destination can still leave the camera inside
    // a wall. Retract immediately; ease back out only after the path is clear.
    this.constrain(this.camera.position,blockers);
    if(course&&!course.imported){const terrain=sampleTrack(course,this.camera.position);if(!terrain.gap&&terrain.distance<terrain.width/2+2)this.camera.position.y=Math.max(this.camera.position.y,terrain.height+.8);}
    this.look.lerp(this.target,blend);
    this.rotation.setFromUnitVectors(this.camera.up,this.up);this.partialRotation.identity().slerp(this.rotation,blend);this.camera.up.applyQuaternion(this.partialRotation).normalize();this.camera.lookAt(this.look);
    const fov=menu?43:54+(reducedMotion?0:Math.min(8,Math.abs(kart.speed)*.26));
    if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov+=(fov-this.camera.fov)*blend;this.camera.updateProjectionMatrix();}
  }
  private constrain(position:THREE.Vector3,blockers:THREE.Object3D[]):void {
    if(!blockers.length)return;
    this.direction.subVectors(position,this.origin);const length=this.direction.length();if(length<.001)return;this.direction.divideScalar(length);
    this.probeRight.crossVectors(this.up,this.direction);if(this.probeRight.lengthSq()<.001)this.probeRight.set(1,0,0);this.probeRight.normalize().multiplyScalar(.3);
    this.probeUp.crossVectors(this.direction,this.probeRight).normalize().multiplyScalar(.3);
    let distance=length;
    // A small camera hull prevents the near-plane corners clipping through
    // scenery even when the central ray passes just beside a road edge.
    for(const [right,up] of [[0,0],[-1,-1],[-1,1],[1,-1],[1,1]]){
      this.castOrigin.copy(this.origin).addScaledVector(this.probeRight,right!).addScaledVector(this.probeUp,up!);this.ray.set(this.castOrigin,this.direction);this.ray.far=length;
      const hit=this.ray.intersectObjects(blockers,false)[0];if(hit)distance=Math.min(distance,Math.max(.05,hit.distance-.4));
    }
    if(distance<length)position.copy(this.origin).addScaledVector(this.direction,distance);
  }
}
