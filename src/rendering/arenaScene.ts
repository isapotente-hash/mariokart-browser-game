import * as THREE from 'three';
import type { CourseDefinition } from '../data/types';

/** Every solid uses the same dimensions as the arena's collision data. */
export function createArenaScene(course:CourseDefinition):THREE.Group {
  const arena=course.arena!,root=new THREE.Group();root.name='Switchyard Plaza';
  const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.85});
  const pavement=material('#527b80'),road=material('#355b65'),cream=material('#f8e6bc'),coral=material('#ed795d'),teal=material('#55b9ae'),navy=material('#243e54');
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,solid=false)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=h>.2;mesh.userData.cameraBlocker=solid;root.add(mesh);return mesh;};
  const ring=(x:number,z:number,r:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(r-.12,r,32),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.07,z);root.add(mesh);};
  box(arena.halfSize*2,.2,arena.halfSize*2,0,-.1,0,pavement);
  // An exposed central cross and a supply route around the cover islands.
  box(18,.025,88,0,.02,0,road);box(88,.025,18,0,.025,0,road);
  for(const side of[-1,1]){box(8,.025,76,side*32,.02,0,road);box(76,.025,8,0,.02,side*32,road);}
  for(let i=-7;i<=7;i++)for(const side of[-1,1]){box(.13,.025,1.4,side*9,.05,i*5,cream);box(1.4,.025,.13,i*5,.05,side*9,cream);}
  ring(0,0,5,cream);ring(0,0,4.6,coral);
  for(const [index,cover] of arena.obstacles.entries()){
    const color=index%2?coral:teal;
    box(cover.halfWidth*2,cover.height,cover.halfDepth*2,cover.x,cover.height/2,cover.z,navy,true);
    box(cover.halfWidth*2+.06,.18,cover.halfDepth*2+.06,cover.x,cover.height-.1,cover.z,color);
    for(let j=-2;j<=2;j++)box(.5,1.4,.035,cover.x+j*1.3,1.45,cover.z+cover.halfDepth+.02,cream);
    ring(cover.x,cover.z,6.8,color);
  }
  for(const spawn of arena.spawns){ring(spawn.x,spawn.z,1.8,teal);const marker=box(.6,.03,1.6,spawn.x,.06,spawn.z,cream);marker.rotation.y=spawn.heading;}
  for(const supply of arena.supplies){ring(supply.x,supply.z,supply.double?1.7:1.25,supply.double?coral:cream);if(supply.double)ring(supply.x,supply.z,2,coral);}
  for(const side of[-1,1]){
    box(89,1.1,1,0,.55,side*44.5,cream,true);box(1,1.1,89,side*44.5,.55,0,cream,true);
    for(let j=-3;j<=3;j++){box(2,1.16,1.02,j*12,.58,side*44.5,coral);box(1.02,1.16,2,side*44.5,.58,j*12,coral);}
  }
  // Small spectator stands stay outside the playable bounds.
  for(const side of[-1,1])for(let row=0;row<3;row++)box(27,1,2.2,0,.5+row,side*(49+row*2.2),row%2?teal:coral);
  return root;
}
