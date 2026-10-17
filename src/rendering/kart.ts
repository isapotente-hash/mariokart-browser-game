import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { defaultSettings } from '../data/options';
import type { VehicleBuild } from '../data/options';
import { drivers } from '../data/content';

export interface KartModel {root:THREE.Group;body:THREE.Group;wheels:THREE.Group[];rollers:THREE.Group[];frontWheels:THREE.Group[];glider:THREE.Group;build:VehicleBuild}
function batchParts(group:THREE.Group):void {
  const batches=new Map<THREE.Material,THREE.Mesh[]>();
  for(const child of group.children)if(child instanceof THREE.Mesh&&!Array.isArray(child.material)){const meshes=batches.get(child.material)??[];meshes.push(child);batches.set(child.material,meshes);}
  for(const[material,meshes]of batches){
    if(meshes.length<2)continue;
    const geometries=meshes.map((mesh)=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);return geometry;});
    const geometry=mergeGeometries(geometries);geometries.forEach((entry)=>entry.dispose());if(!geometry)continue;
    const merged=new THREE.Mesh(geometry,material);merged.castShadow=meshes.some((mesh)=>mesh.castShadow);merged.receiveShadow=meshes.some((mesh)=>mesh.receiveShadow);
    for(const mesh of meshes){group.remove(mesh);mesh.geometry.dispose();}group.add(merged);
  }
}
export function createKart(value:string|VehicleBuild=defaultSettings().builds[0],ghost=false):KartModel {
  const build=typeof value==='string'?defaultSettings().builds[0]:value,driver=drivers.find((entry)=>entry.id===build.driver)??drivers[0]!;
  const color=typeof value==='string'?value:driver.color;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const material=(color:string,roughness=.6)=>new THREE.MeshStandardMaterial({color,roughness,transparent:ghost,opacity:ghost?.3:1,depthWrite:!ghost});
  const paint=material(ghost?'#7be5e2':color,.48),cream=material('#ffedcc'),dark=material('#253f3e'),jacket=material(color);
  const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,parent=body)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=!ghost;parent.add(mesh);return mesh;};
  const rover=build.chassis==='rover',comet=build.chassis==='comet';
  box(rover?1.9:comet?1.45:1.65,rover?.5:comet?.28:.37,comet?2.9:2.6,paint,0,rover?.65:.55,0);
  box(comet?.95:1.15,.25,1,paint,0,.8,.85);box(.18,.27,.96,cream,0,.82,.87);
  box(1.8,.17,.25,dark,0,.47,1.45);box(1.8,.17,.25,dark,0,.47,-1.4);box(1,.6,.3,dark,0,1.04,-.62);
  if(comet){box(2,.14,.5,paint,0,1,-1.5);box(.12,.5,.12,dark,-.65,.75,-1.4);box(.12,.5,.12,dark,.65,.75,-1.4);}
  if(rover)box(1.4,.2,.3,cream,0,1.03,1.2);
  const size=driver.weight==='heavy'?1.12:driver.weight==='light'?.88:1;
  box(.65*size,.62*size,.65,jacket,0,1.12,-.15);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.46*size,14,10),cream);helmet.position.set(0,1.8,-.11);helmet.castShadow=!ghost;body.add(helmet);
  box(.66*size,.2,.13,dark,0,1.84,.28);
  const detail=driver.detail;
  if(detail==='ears'||detail==='horns'||detail==='bow')for(const side of[-1,1]){
    const shape=new THREE.Mesh(detail==='horns'?new THREE.ConeGeometry(.13,.45,6):new THREE.SphereGeometry(.18,8,6),paint);
    shape.position.set(side*.32,2.2,-.13);if(detail==='bow')shape.scale.set(1.3,.7,.5);body.add(shape);
  }
  else if(detail==='antenna'||detail==='flower'){
    box(.06,.44,.06,dark,0,2.35,-.12);
    const tip=new THREE.Mesh(detail==='flower'?new THREE.TorusGeometry(.16,.08,5,7):new THREE.SphereGeometry(.14,8,6),paint);tip.position.set(0,2.6,-.12);body.add(tip);
  }else if(detail==='goggles')for(const side of[-1,1]){
    const lens=new THREE.Mesh(new THREE.TorusGeometry(.17,.06,5,10),paint);lens.position.set(side*.2,1.85,.38);body.add(lens);
  }else box(.13,detail==='fin'?.3:.08,.56,paint,0,2.22,-.12);
  box(.16,.45,.16,dark,0,1,.5);
  const radius=build.tyres==='grip'?.5:build.tyres==='slick'?.45:.43,width=build.tyres==='slick'?.45:.35;
  const geometry=new THREE.CylinderGeometry(radius,radius,width,12),tyre=material(build.tyres==='grip'?'#4d5143':'#203331',1),hub=material('#f5d794',.4);
  const wheels:THREE.Group[]=[],rollers:THREE.Group[]=[],frontWheels:THREE.Group[]=[];
  for(const x of[-1,1])for(const z of[-.87,.87]){
    const group=new THREE.Group(),roller=new THREE.Group();group.position.set(x,radius,z);group.add(roller);rollers.push(roller);
    const mesh=new THREE.Mesh(geometry,tyre);mesh.rotation.z=Math.PI/2;mesh.castShadow=!ghost;
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,width+.02,12),hub);cap.rotation.z=Math.PI/2;roller.add(mesh,cap);root.add(group);wheels.push(group);if(z>0)frontWheels.push(group);
    if(build.tyres==='grip')for(let i=0;i<8;i++){const tread=new THREE.Mesh(new THREE.BoxGeometry(width+.02,.08,.15),dark);const angle=i/8*Math.PI*2;tread.position.set(0,Math.sin(angle)*radius,Math.cos(angle)*radius);tread.rotation.x=-angle;roller.add(tread);}batchParts(roller);
  }
  const glider=new THREE.Group(),span=build.glider==='cloth'?3.3:2.7;
  const canopy=new THREE.BufferGeometry();canopy.setAttribute('position',new THREE.Float32BufferAttribute([-span,2.5,-.4,0,3.1,1.5,span,2.5,-.4,-span,2.5,-.4,span,2.5,-.4,0,2.6,-1.4],3));canopy.computeVertexNormals();
  const canopyMat=material(build.glider==='cloth'?'#f3cf73':color);canopyMat.side=THREE.DoubleSide;
  glider.add(new THREE.Mesh(canopy,canopyMat));box(.08,1.2,.08,dark,-.6,1.9,-.2,glider);box(.08,1.2,.08,dark,.6,1.9,-.2,glider);glider.visible=false;root.add(glider);
  batchParts(body);batchParts(glider);
  return{root,body,wheels,rollers,frontWheels,glider,build:{...build}};
}
