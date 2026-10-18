import * as THREE from 'three';
import type { Vec3 } from '../data/types';

export function interpolateHeading(from:number,to:number,alpha:number):number {
  return from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*alpha;
}

export function disposeGroup(group: THREE.Object3D): void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  group.traverse((object)=>{
    if(object instanceof THREE.Mesh&&!object.userData.sharedAsset){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}
    if(object instanceof THREE.InstancedMesh)object.dispose();
  });
  geometries.forEach((geometry)=>geometry.dispose());materials.forEach((material)=>material.dispose());
}
const upVector=new THREE.Vector3(),forwardVector=new THREE.Vector3(),rightVector=new THREE.Vector3(),basis=new THREE.Matrix4();
export function orient(group:THREE.Object3D,heading:number,up:Vec3,pitch=0,direction?:Vec3):void {
  upVector.set(up.x,up.y,up.z).normalize();
  forwardVector.set(Math.sin(heading),-(up.x*Math.sin(heading)+up.z*Math.cos(heading))/Math.max(.2,up.y),Math.cos(heading)).normalize();
  if(direction)forwardVector.set(direction.x,direction.y,direction.z).normalize();
  rightVector.crossVectors(upVector,forwardVector).normalize();
  upVector.crossVectors(forwardVector,rightVector).normalize();
  basis.makeBasis(rightVector,upVector,forwardVector);group.quaternion.setFromRotationMatrix(basis);
  if(pitch)group.rotateX(-pitch);
}
