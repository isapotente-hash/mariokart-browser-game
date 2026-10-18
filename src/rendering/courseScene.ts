import * as THREE from 'three';
import type { CourseDefinition, CourseSample } from '../data/types';
import { seededRandom } from '../core/random';
import { gridPose, sampleTrack, offsetSample } from '../tracks/course';
import { trackFrame } from '../tracks/frames';
import type { Quality } from '../data/options';
import { qualityProfiles } from '../data/options';
import { orient } from './resources';
import { createArenaScene } from './arenaScene';
import { createImportedCourseScene } from './importedCourse';

function strip(samples:CourseSample[],from:number,to:number,above:number,color:string,alternate?:string,closed=true):THREE.Mesh {
  const positions:number[]=[],colors:number[]=[];
  for(let i=0;i<(closed?samples.length:samples.length-1);i++){
    const a=samples[i]!,b=samples[(i+1)%samples.length]!;if(a.gap)continue;
    const p=(sample:CourseSample,offset:number)=>{const point=offsetSample(sample,offset,above);return[point.x,point.y,point.z];};
    positions.push(...p(a,from),...p(b,from),...p(b,to),...p(a,from),...p(b,to),...p(a,to));
    const c=new THREE.Color(alternate&&Math.floor(i/3)%2?alternate:color);for(let j=0;j<6;j++)colors.push(c.r,c.g,c.b);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));mesh.receiveShadow=true;return mesh;
}
export function createCourseScene(course:CourseDefinition,quality:Quality='medium'):THREE.Group {
  if(course.arena)return createArenaScene(course);
  if(course.imported)return createImportedCourseScene(course,quality);
  const root=new THREE.Group(),half=course.width/2,night=course.theme==='starlight',harbour=course.theme==='harbour',foundry=course.theme==='foundry';
  const profile=qualityProfiles[quality];
  const white=new THREE.MeshStandardMaterial({color:'#f3e9cf'}),dark=new THREE.MeshStandardMaterial({color:night?'#222e5c':'#29463f'}),accent=new THREE.MeshStandardMaterial({color:night?'#65d9dc':harbour?'#e9b969':'#f0794f',emissive:night?'#183d51':'#000000'});
  const box=(w:number,h:number,d:number,material:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  root.add(strip(course.samples,-half-2.7,half+2.7,.01,night?'#4d4973':harbour?'#b9b394':foundry?'#b19373':'#b2c97b'));
  root.add(strip(course.samples,-half,half,.05,night?'#35436b':harbour?'#526b70':foundry?'#62696a':'#546762'));
  for(const side of[-1,1]){
    root.add(strip(course.samples,side*half,side*(half+.65),.07,'#f9ecd4',night?'#8b7bcf':'#e27653'));
    root.add(strip(course.samples,side*(half-.3),side*(half-.16),.085,night?'#7de6e8':'#e1e6ce'));
    if(!course.exposed)root.add(strip(course.samples,side*(half+2.5),side*(half+2.7),.5,'#efcb8e','#f7e7c8'));
  }
  for(const branch of course.branches){
    const color=branch.surface==='grass'?'#91aa6f':branch.surface==='boost'?'#bb7ab4':foundry?'#7c8275':'#a29378';
    root.add(strip(branch.samples,-branch.width/2,branch.width/2,.06,color,undefined,false));
    for(const side of[-1,1])root.add(strip(branch.samples,side*(branch.width/2-.15),side*branch.width/2,.08,'#f3e1b5',undefined,false));
    const p=branch.samples[4]!,frame=trackFrame(p),arrow=new THREE.Mesh(new THREE.ConeGeometry(.7,2,3),white);arrow.rotation.x=Math.PI/2;const marker=new THREE.Group();marker.add(arrow);marker.position.set(p.x,p.y+.15,p.z);orient(marker,Math.atan2(p.tangent.x,p.tangent.z),frame.up);root.add(marker);
  }
  const start=course.samples[0]!,gate=new THREE.Group();gate.position.set(start.x,start.y+.08,start.z);orient(gate,Math.atan2(start.tangent.x,start.tangent.z),trackFrame(start).up);
  for(let row=0;row<2;row++)for(let i=0;i<12;i++)box(course.width/12,.02,.6,(i+row)%2?dark:white,-half+(i+.5)*course.width/12,0,row*.6,gate);
  for(const side of[-1,1]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.25,6,8),accent);pole.position.set(side*(half+1.1),3,0);gate.add(pole);}
  const beam=box(course.width+2.6,.85,.5,dark,0,6,0,gate);beam.userData.cameraBlocker=true;
  for(let i=0;i<15;i++)box(.46,.45,.52,i%2?white:accent,(i-7)*(course.width+2)/15,6,0,gate);
  root.add(gate);
  for(let i=0;i<12;i++){
    const pose=gridPose(course,i),mark=new THREE.Group();mark.position.set(pose.x,(pose.y??0)+.085,pose.z);orient(mark,pose.heading,sampleTrack(course,pose).up);
    for(const side of[-1,1])box(.1,.015,2.8,white,side*1.05,0,0,mark);box(2.2,.015,.1,white,0,0,1.4,mark);root.add(mark);
  }
  for(let i=0;i<12;i++){
    const sample=course.samples[i*30]!,frame=trackFrame(sample);
    for(const side of[-1,1]){
      const p=offsetSample(sample,side*(half+1.2),.2);const cone=new THREE.Mesh(new THREE.ConeGeometry(.35,.8,5),accent);cone.position.set(p.x,p.y+.4,p.z);root.add(cone);
    }
    if(sample.traversal==='anti-gravity'){
      const p=offsetSample(sample,0,.1);const marking=new THREE.Mesh(new THREE.BoxGeometry(course.width*.7,.04,.5),accent);marking.position.set(p.x,p.y,p.z);orient(marking,Math.atan2(sample.tangent.x,sample.tangent.z),frame.up);root.add(marking);
    }
  }
  const random=seededRandom(4782+course.theme.length),trees=Math.round(120*profile.decoration),radius=Math.max(...course.samples.map((p)=>Math.max(Math.abs(p.x),Math.abs(p.z))))+40;
  if(!foundry&&!night){
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.23,.36,2.7,6),new THREE.MeshStandardMaterial({color:harbour?'#7e6b4d':'#886947'}),trees);
    const crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.3,1),new THREE.MeshStandardMaterial({roughness:1}),trees);const dummy=new THREE.Object3D();
    let count=0;
    for(let attempt=0;count<trees&&attempt<3000;attempt++){
      const x=(random()-.5)*radius*2,z=(random()-.5)*radius*2;
      if(sampleTrack(course,{x,z}).distance<half+7||Math.hypot(x-course.spawn.x,z-course.spawn.z)<16)continue;
      const scale=.7+random()*.8,base=harbour?-1:0;
      dummy.position.set(x,base+1.35*scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();trunks.setMatrixAt(count,dummy.matrix);
      dummy.position.y=base+3.7*scale;dummy.scale.set(scale,scale*(1.1+random()*.3),scale);dummy.updateMatrix();crowns.setMatrixAt(count,dummy.matrix);crowns.setColorAt(count,new THREE.Color(['#397a50','#569052','#7b9c52'][count%3]!));count++;
    }
    trunks.count=count;crowns.count=count;trunks.castShadow=true;crowns.castShadow=true;root.add(trunks,crowns);
  }
  if(harbour){
    const water=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),new THREE.MeshStandardMaterial({color:'#5aa9b9',transparent:true,opacity:.25,depthWrite:false,roughness:.3,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.y=-.5;root.add(water);
    const glassPositions:number[]=[];
    const rings=course.samples.filter((p)=>p.traversal==='underwater');
    for(let i=0;i<rings.length;i++){
      const sample=rings[i]!,frame=trackFrame(sample),heading=Math.atan2(sample.tangent.x,sample.tangent.z);
      if(i%10===0){const ring=new THREE.Mesh(new THREE.TorusGeometry(half+1,.15,4,16,Math.PI),accent);ring.position.set(sample.x,sample.y,sample.z);orient(ring,heading,frame.up);root.add(ring);}
      if(i===rings.length-1)continue;const next=rings[i+1]!;
      for(let j=0;j<12;j++){
        const vertex=(p:CourseSample,angle:number)=>{const q=offsetSample(p,Math.cos(angle)*(half+1));return[q.x,q.y+Math.sin(angle)*(half+1),q.z];};
        const a=j/12*Math.PI,b=(j+1)/12*Math.PI;
        glassPositions.push(...vertex(sample,a),...vertex(next,a),...vertex(next,b),...vertex(sample,a),...vertex(next,b),...vertex(sample,b));
      }
    }
    const glass=new THREE.BufferGeometry();glass.setAttribute('position',new THREE.Float32BufferAttribute(glassPositions,3));glass.computeVertexNormals();root.add(new THREE.Mesh(glass,new THREE.MeshStandardMaterial({color:'#88c8c8',transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide})));
    const lighthouse=new THREE.Group();for(let i=0;i<4;i++){const part=new THREE.Mesh(new THREE.CylinderGeometry(2.8-i*.2,3-i*.2,5,10),i%2?accent:white);part.position.y=2.5+i*5;lighthouse.add(part);}
    box(5.5,2.5,5.5,dark,0,21,0,lighthouse);const light=new THREE.Mesh(new THREE.SphereGeometry(1.7,8,6),new THREE.MeshBasicMaterial({color:'#fff0b3'}));light.position.y=23;lighthouse.add(light);lighthouse.position.set(-radius*.35,0,0);root.add(lighthouse);
    for(let i=0;i<12;i++){const p=course.samples[170+i*3]!;box(2,2,2,i%2?accent:dark,p.x+Math.cos(Math.atan2(p.tangent.x,p.tangent.z))*(half+4),1,p.z-Math.sin(Math.atan2(p.tangent.x,p.tangent.z))*(half+4));}
    const crane=course.samples[190]!;box(.5,13,.5,accent,crane.x+half+4,6,crane.z);box(half*2+8,.5,.5,accent,crane.x,12,crane.z);
  }else if(foundry){
    for(let i=0;i<360;i+=18){const p=course.samples[i]!;if(p.gap)continue;const column=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.1,p.y+18,7),dark);column.position.set(p.x,(p.y-18)/2,p.z);root.add(column);}
    const tower=new THREE.Group();for(let i=0;i<4;i++){box(12-i*2,6,12-i*2,i%2?accent:dark,0,3+i*6,0,tower);}
    const gear=new THREE.Mesh(new THREE.TorusGeometry(8,1.5,6,12),accent);gear.position.set(0,22,6);tower.add(gear);tower.position.set(0,-2,-10);root.add(tower);
    for(const launch of course.launches){const p=course.samples.find((p)=>p.distance>=launch.from)!;for(let j=0;j<3;j++){const marking=new THREE.Mesh(new THREE.BoxGeometry(course.width*.8,.06,.8),accent);const q=offsetSample(p,0,.12);marking.position.set(q.x+p.tangent.x*j*1.7,q.y,q.z+p.tangent.z*j*1.7);orient(marking,Math.atan2(p.tangent.x,p.tangent.z),trackFrame(p).up);root.add(marking);}}
  }else if(night){
    const stars=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5,0),new THREE.MeshBasicMaterial({color:'#f5e8be'}),80),dummy=new THREE.Object3D();
    for(let i=0;i<80;i++){dummy.position.set((random()-.5)*800,60+random()*130,(random()-.5)*800);dummy.updateMatrix();stars.setMatrixAt(i,dummy.matrix);}root.add(stars);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(15,16,12),new THREE.MeshBasicMaterial({color:'#dce6e6'}));moon.position.set(-110,95,-180);root.add(moon);
    for(let i=0;i<360;i+=12){const p=course.samples[i]!,q=offsetSample(p,half+.8);box(.12,4,.12,dark,q.x,q.y+2,q.z);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.28,7,5),new THREE.MeshBasicMaterial({color:'#a1f1ec'}));lamp.position.set(q.x,q.y+4,q.z);root.add(lamp);}
  }
  if(!night){
    const cloudMaterial=new THREE.MeshBasicMaterial({color:'#f9f4dc'}),cloudGeometry=new THREE.SphereGeometry(1,8,5);
    for(let i=0;i<Math.round(14*profile.decoration);i++){const cloud=new THREE.Group();for(let j=0;j<3;j++){const puff=new THREE.Mesh(cloudGeometry,cloudMaterial);puff.position.set(j*4,j===1?1.2:0,0);puff.scale.set(4.5,2.1+random(),2.8);cloud.add(puff);}cloud.position.set((random()-.5)*radius*3,40+random()*20,(random()-.5)*radius*3);root.add(cloud);}
  }
  if(course.theme==='garden'){
    const stand=new THREE.Group();for(let i=0;i<3;i++)box(18,.6,1.8,i%2?white:accent,0,.5+i*.7,i*-1.4,stand);
    const roof=box(20,.4,7,dark,0,5,-1.5,stand);roof.userData.cameraBlocker=true;
    for(const x of[-8,8])box(.15,5,.15,white,x,2.5,-2,stand);
    const p=offsetSample(start,-half-9);stand.position.set(p.x,p.y,p.z);stand.rotation.y=Math.atan2(start.tangent.x,start.tangent.z);root.add(stand);
  }
  return root;
}
