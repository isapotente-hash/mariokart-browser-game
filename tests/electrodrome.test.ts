import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCourse,poseAt,sampleTrack,gridPose,courseCatalog} from '../src/tracks/course';
import {trackFrame} from '../src/tracks/frames';
import {Race} from '../src/gameplay/Race';
import {AiDriver} from '../src/ai/AiDriver';
import {defaultSettings,cupCourseIds} from '../src/data/options';
import {validateSettings} from '../src/platform/SaveStore';
import {GhostRecorder,sampleGhost} from '../src/platform/Ghosts';
const dt=1/60,idle={throttle:false,brake:false,steering:0};
test('supplied GLB, selectable bonus course, safe grids, ordered checkpoints and independent cup roster',()=>{
  const bytes=fs.readFileSync('public/assets/tracks/electrodrome.glb');assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.length,15507476);
  assert.ok(courseCatalog.some(c=>c.id==='electrodrome'));assert.equal(cupCourseIds.length,4);assert.equal(validateSettings({...defaultSettings(),course:'electrodrome'}).course,'electrodrome');
  const c=createCourse('electrodrome');assert.ok(c.length>900&&c.length<1300);assert.ok(c.imported);assert.equal(c.checkpoints.length,12);assert.ok(c.checkpoints.every((p,i)=>i===0||p.distance!>c.checkpoints[i-1]!.distance!));assert.ok(c.checkpoints.every(p=>!sampleTrack(c,p).gap));
  for(let i=0;i<12;i++){const p=gridPose(c,i),q=sampleTrack(c,p);assert.ok(q.distance<q.width/2);assert.ok(p.forward);assert.ok(Math.abs(p.y!-q.height)<.01);}
  assert.ok(c.samples.some(p=>p.up!.y<0));assert.ok(c.samples.some(p=>p.connector));
  for(const s of c.samples){const f=trackFrame(s);assert.ok(Math.abs(f.forward.x*f.up.x+f.forward.y*f.up.y+f.forward.z*f.up.z)<1e-5);assert.ok([s.x,s.y,s.z,s.distance].every(Number.isFinite));}
});
for(const mirrored of[false,true])test(`physical imported lap, full 3D banking and glider landing (${mirrored?'mirror':'normal'})`,()=>{
  const course=createCourse('electrodrome',mirrored),race=new Race(course,4782,{mode:'time-trial'}),driver=new AiDriver(2026),states=new Set<string>();let inverted=false;
  for(let i=0;i<60*140&&race.player.progress.laps<1;i++){race.update(driver.read(course,race.player,race.racers,dt),dt);states.add(race.player.controller.state.traversal);inverted ||= race.player.controller.state.up.y<0;}
  assert.equal(race.player.progress.laps,1);assert.equal(race.player.rescues,0);assert.ok(states.has('gliding')&&states.has('anti-gravity'));assert.ok(inverted);assert.ok(race.time<100);
});
test('twelve real controllers complete the imported course and preserve ranking/results',()=>{
  const c=createCourse('electrodrome'),r=new Race(c,4782,{laps:1,items:'none'}),driver=new AiDriver(2026);
  for(let i=0;i<60*160&&r.state!=='results';i++)r.update(driver.read(c,r.player,r.racers,dt),dt);
  console.log('Electrodrome field',r.time,r.racers.map(p=>({id:p.id,time:p.finishTime,rescues:p.rescues})));
  assert.equal(r.state,'results');assert.equal(r.results.length,12);assert.ok(r.racers.every(p=>p.progress.laps===1));assert.equal(new Set(r.results.map(p=>p.place)).size,12);
});
test('magnetic surface projectiles follow 3D roads, hit, and ghosts retain full orientation',()=>{
  const c=createCourse('electrodrome'),r=new Race(c),owner=r.player,victim=r.racers[1]!,pose=poseAt(c,820);owner.controller.reset(pose);victim.controller.reset(poseAt(c,826));owner.inventory.add('shell');owner.inventory.update(1);r.items.use(owner,false,r.racers);const object=r.items.objects.find(o=>o.active)!;let hit=false;
  for(let i=0;i<90&&object.active;i++){const events=r.items.update(dt,[owner,victim],20+i*dt);hit ||= events.some(e=>e.type==='hit'&&e.racerId===victim.id);assert.ok([object.x,object.y,object.z].every(Number.isFinite));}assert.ok(hit);
  const recorder=new GhostRecorder();recorder.sample(0,owner.controller.state);owner.controller.update({...idle,throttle:true},.1);recorder.sample(.1,owner.controller.state);const ghost=recorder.finish('imported','1',1,owner.controller.state);assert.ok(sampleGhost(ghost,.05)!.forward);
});
