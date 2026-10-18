import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ChaseCamera} from '../src/rendering/ChaseCamera';
import {interpolateHeading,disposeGroup} from '../src/rendering/resources';
import {KartController} from '../src/gameplay/KartController';
import {Race} from '../src/gameplay/Race';
import {createCourse,poseAt,sampleTrack} from '../src/tracks/course';
import {validateGhost,GhostRecorder} from '../src/platform/Ghosts';
import {RaceVisuals} from '../src/rendering/RaceVisuals';

test('camera retracts before smoothing can carry it through a wall, including close obstructions',()=>{
  for(const wallZ of[-4,-.7]){
    const camera=new THREE.PerspectiveCamera(54,1,.25,480),chase=new ChaseCamera(camera),kart=new KartController(createCourse()).state;
    Object.assign(kart,{x:0,y:0,z:0,heading:0,up:{x:0,y:1,z:0},speed:0});camera.position.set(0,5,-12);
    const wall=new THREE.Mesh(new THREE.BoxGeometry(20,20,.1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,4,wallZ);wall.updateMatrixWorld(true);
    for(let frame=0;frame<30;frame++){chase.update(kart,1/60,false,false,false,undefined,[wall]);assert.ok(camera.position.z>wallZ+.05,`camera behind wall at ${wallZ}`);assert.ok([...camera.position,...camera.quaternion,...camera.up].every(Number.isFinite));}
    disposeGroup(wall);
  }
});
test('camera magnetic frame eases across an abrupt inverted normal without zero up vectors',()=>{
  const course=createCourse('electrodrome'),kart=new KartController(course).state,camera=new THREE.PerspectiveCamera(),chase=new ChaseCamera(camera);
  Object.assign(kart,{x:0,y:0,z:0,heading:0,up:{x:0,y:1,z:0},forward:{x:0,y:0,z:1}});chase.update(kart,1/60,false,false,true,course);
  kart.up={x:0,y:-1,z:0};let previous=camera.quaternion.clone();
  for(let i=0;i<90;i++){chase.update(kart,1/60,false,false,false,course);assert.ok(camera.up.length()>.999);assert.ok(camera.quaternion.angleTo(previous)<.8);previous.copy(camera.quaternion);}
  assert.ok(camera.up.y<-.9);
});
test('heading interpolation crosses the 180 degree seam along the short arc',()=>{
  const a=Math.PI-.02,b=-Math.PI+.02;assert.ok(Math.abs(interpolateHeading(a,b,.5)-Math.PI)<1e-8);
  assert.ok(Math.abs(interpolateHeading(b,a,.5)+Math.PI)<1e-8);
});
test('magnetic kart render rotation eases toward the new direction rather than freezing',()=>{
  const race=new Race(createCourse('electrodrome'),4782,{mode:'time-trial'}),visuals=new RaceVisuals(),s=race.player.controller.state;
  Object.assign(s,{x:0,y:0,z:0,heading:0,forward:{x:0,y:0,z:1},up:{x:0,y:1,z:0}});visuals.sync(race,1,true,0,'low');const kart=visuals.root.getObjectByName('player-1')!,start=kart.quaternion.clone();
  s.heading=1;s.forward={x:Math.sin(1),y:0,z:Math.cos(1)};visuals.sync(race,1,true,1/60,'low');const first=start.angleTo(kart.quaternion);assert.ok(first>.05&&first<.5);
  for(let i=0;i<60;i++)visuals.sync(race,1,true,1/60,'low');const direction=new THREE.Vector3(0,0,1).applyQuaternion(kart.quaternion);assert.ok(direction.distanceTo(new THREE.Vector3(s.forward.x,0,s.forward.z))<1e-5);disposeGroup(visuals.root);
});
test('banked kart contacts resolve in 3D and keep both karts on the magnetic surface',()=>{
  class ContactRace extends Race {contact(){return this.collisions();}}
  const course=createCourse('electrodrome'),race=new ContactRace(course),a=race.player,b=race.racers[1]!;
  for(const other of race.racers.slice(2))other.finishTime=0;
  const sample=course.samples.find(s=>{const q=sampleTrack(course,s);return Math.abs(q.right.y)>.96&&!q.gap&&q.width>5;})!,pose=poseAt(course,sample.distance+.05);
  a.controller.reset(pose);b.controller.reset(pose);const road=sampleTrack(course,a.controller.state),s=b.controller.state;
  s.x+=road.right.x*1.62;s.y+=road.right.y*1.62;s.z+=road.right.z*1.62;
  const distance=()=>Math.hypot(s.x-a.controller.state.x,s.y-a.controller.state.y,s.z-a.controller.state.z),before=distance();assert.ok(Math.abs(s.y-a.controller.state.y)>1.5);
  race.contact();assert.ok(distance()>before);
  for(const racer of[a,b]){const p=racer.controller.state,q=sampleTrack(course,p),normalDistance=(p.x-q.center!.x)*q.up.x+(p.y-q.center!.y)*q.up.y+(p.z-q.center!.z)*q.up.z;assert.ok(Math.abs(normalDistance)<.01);}
  a.controller.reset(pose);b.controller.reset(pose);for(let i=0;i<5;i++)race.contact();assert.ok(distance()>1.6,'coincident magnetic respawns separate along the road');
});
test('damaged ghost frames are rejected without throwing during course loading',()=>{
  const state=new KartController(createCourse()).state,recorder=new GhostRecorder();recorder.sample(0,state);recorder.sample(1,state);const ghost=recorder.finish('audit','1',1);
  for(const broken of[null,42,[],{...ghost.frames[0],time:-.5}])assert.equal(validateGhost({...ghost,frames:[broken,ghost.frames[1]]},'audit','1'),null);
});
