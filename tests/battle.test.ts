import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Battle } from '../src/gameplay/Battle';
import { Race } from '../src/gameplay/Race';
import { ArenaDriver } from '../src/ai/ArenaDriver';
import { createArena,arenaContact,arenaLineClear,arenaWaypoint } from '../src/tracks/arena';
import { createCourse,sampleTrack } from '../src/tracks/course';
import { defaultSettings,raceOptions } from '../src/data/options';
import { validateSettings,SaveStore } from '../src/platform/SaveStore';
import { Session } from '../src/gameplay/Session';
import { RaceVisuals } from '../src/rendering/RaceVisuals';
import { createArenaScene } from '../src/rendering/arenaScene';
import { ChaseCamera } from '../src/rendering/ChaseCamera';
import { disposeGroup } from '../src/rendering/resources';
import type { Racer } from '../src/gameplay/Racer';
import type { GameEvent,ItemKind } from '../src/data/types';

const dt=1/60,idle={throttle:false,brake:false,steering:0};
function isolated(){const battle=new Battle(createArena(),4782,{players:2});battle.state='racing';for(const brain of battle.brains.values())brain.read=()=>idle;return battle;}
function grant(b:Battle,r:Racer,item:ItemKind){r.inventory.clear();r.inventory.add(item);r.inventory.update(1);return b.items.use(r,false,b.racers);}
function pop(b:Battle,victim:Racer,owner:Racer):GameEvent[]{
  for(const object of b.items.objects)object.active=false;
  victim.controller.reset({x:0,z:0,heading:0});Object.assign(victim.previous,victim.controller.state);
  grant(b,owner,'banana');const object=b.items.objects.find(o=>o.active)!;Object.assign(object,{x:0,z:0,y:0,age:2});return b.update([idle,idle],dt);
}
test('arena is open in every direction, has separated safe spawns, reachable item routes and solid cover',()=>{
  const c=createArena(),a=c.arena!;assert.equal(a.spawns.length,12);assert.equal(a.supplies.length,16);assert.equal(a.supplies.filter(p=>p.double).length,4);
  for(const p of [...a.spawns,...a.supplies])assert.equal(arenaContact(a,p,1).hit,false);
  for(const p of a.spawns)for(const q of a.spawns)if(p!==q)assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>10);
  for(const x of[-40,0,40])for(const z of[-40,0,40]){assert.equal(sampleTrack(c,{x,z}).surface,'road');assert.equal(sampleTrack(c,{x,z}).gap,false);}
  assert.equal(arenaContact(a,{x:45,z:0},.9).x,43.1);assert.equal(arenaContact(a,{x:15,z:15},.9).hit,true);
  const from={x:5,z:15},to={x:25,z:15};assert.equal(arenaLineClear(a,from,to),false);let current=from;
  for(let i=0;i<8&&!arenaLineClear(a,current,to);i++){const next=arenaWaypoint(a,current,to);assert.equal(arenaLineClear(a,current,next),true);assert.notDeepEqual(current,next);current=next;}
  assert.equal(arenaLineClear(a,current,to),true);
});
test('three physical hits score ownership, total loss penalty, item clearing and safe protected respawn',()=>{
  const b=isolated(),victim=b.player,owner=b.humans[1]!;b.battle!.stats[victim.id]!.score=5;owner.controller.reset({x:8,z:0,heading:Math.PI});
  victim.inventory.add('shell');for(let i=1;i<=3;i++){const events=pop(b,victim,owner);assert.ok(events.some(e=>e.type==='hit'&&e.racerId===victim.id));assert.equal(b.battle!.stats[victim.id]!.balloons,3-i);assert.equal(b.battle!.stats[owner.id]!.score,i);}
  assert.equal(b.battle!.stats[victim.id]!.score,3);assert.equal(victim.rescueRemaining,3);assert.equal(victim.inventory.active,null);assert.equal(b.battle!.stats[victim.id]!.respawns,1);
  const hold={...victim.controller.state};b.pause();b.update(idle,10);assert.equal(victim.rescueRemaining,3);b.resume();
  for(let i=0;i<179;i++)b.update([idle,idle],dt);assert.ok(victim.rescueRemaining>0);assert.equal(victim.controller.state.x,hold.x);
  b.update([idle,idle],dt);assert.equal(victim.rescueRemaining,0);assert.equal(b.battle!.stats[victim.id]!.balloons,3);assert.equal(victim.controller.state.immunity,3);assert.equal(victim.controller.hit(),false);
  const s=victim.controller.state;assert.ok(b.course.arena!.spawns.some(p=>Math.hypot(p.x-s.x,p.z-s.z)<.01));assert.ok(b.racers.filter(r=>r!==victim&&r.rescueRemaining===0).every(r=>Math.hypot(r.controller.state.x-s.x,r.controller.state.z-s.z)>10));
});
test('self-hit, immunity, one explosive hit per racer and manual rescue cannot farm score or escape penalties',()=>{
  const b=isolated(),p=b.player,other=b.humans[1]!;b.battle!.stats[p.id]!.score=5;pop(b,p,p);assert.equal(b.battle!.stats[p.id]!.score,4);assert.equal(b.battle!.stats[p.id]!.hits,0);
  p.controller.reset({x:0,z:0,heading:0});p.controller.state.immunity=3;grant(b,other,'banana');const trap=b.items.objects.find(o=>o.active)!;Object.assign(trap,{x:0,z:0,age:2});b.update([idle,idle],dt);assert.equal(b.battle!.stats[p.id]!.balloons,2);
  for(const o of b.items.objects)o.active=false;p.controller.state.immunity=0;grant(b,other,'explosive');const bomb=b.items.objects.find(o=>o.active)!;Object.assign(bomb,{x:0,z:0,vx:0,vz:0,age:1.61});b.update([idle,idle],dt);assert.equal(b.battle!.stats[p.id]!.balloons,1);p.controller.state.immunity=0;b.update([idle,idle],dt);assert.equal(b.battle!.stats[p.id]!.balloons,1);
  b.rescue(p);assert.equal(b.battle!.stats[p.id]!.score,2);b.rescue(p);assert.equal(b.battle!.stats[p.id]!.score,2);assert.equal(b.battle!.stats[p.id]!.respawns,1);
});
test('arena cover blocks thrown explosives and shells reflect from walls with bounded speeds',()=>{
  const b=isolated(),p=b.player;p.controller.reset({x:7,z:15,heading:Math.PI/2});grant(b,p,'explosive');for(let i=0;i<90;i++)b.items.update(dt,[],10+i*dt);const bomb=b.items.objects.find(o=>o.active)!;assert.ok(bomb.x<=10.5);assert.equal(bomb.vx,0);
  for(const o of b.items.objects)o.active=false;p.controller.reset({x:40,z:0,heading:Math.PI/2});grant(b,p,'shell');const shell=b.items.objects.find(o=>o.active)!;for(let i=0;i<15;i++)b.items.update(dt,[],10);assert.ok(shell.vx<0);assert.ok(shell.bounces>0);assert.ok(Math.hypot(shell.vx,shell.vz)<60);
});
test('arena AI retargets moving opponents and steers around spatial hazards without checkpoint progression',()=>{
  const b=isolated(),p=b.player,target=b.humans[1]!,driver=new ArenaDriver(22,'normal',b.items.pickups);p.controller.reset({x:0,z:0,heading:0});p.inventory.add('shell');p.inventory.update(1);target.controller.reset({x:0,z:18,heading:0});const opponents=[p,target];
  const straight=driver.read(b.course,p,opponents,dt);assert.equal(driver.targetId,target.id);assert.equal(driver.intent,'attack');assert.ok(Math.abs(straight.steering)<.01);
  const avoid=driver.read(b.course,p,opponents,dt,[{x:0,z:3}]);assert.equal(driver.intent,'avoid');assert.ok(Math.abs(avoid.steering)>.2);
  target.controller.reset({x:15,z:0,heading:0});const chase=driver.read(b.course,p,opponents,1);assert.ok(chase.steering>0);assert.equal(p.progress.laps,0);
  driver.reset();assert.equal(driver.targetId,'');
});
test('match countdown, pause, exact timer, frozen results, deterministic ties and settings persistence',()=>{
  const b=new Battle(createArena(),4782,{battleDuration:30});for(const brain of b.brains.values())brain.read=()=>idle;
  b.update(idle,1);assert.equal(b.time,0);assert.equal(b.battle!.remaining,30);b.pause();b.update(idle,10);assert.equal(b.countdown,2);b.resume();b.update(idle,2);assert.equal(b.state,'racing');
  b.battle!.stats['ai-1']!.hits=2;b.battle!.stats['ai-2']!.hits=2;b.battle!.stats['ai-1']!.lastScoreTime=8;b.battle!.stats['ai-2']!.lastScoreTime=5;assert.equal(b.ranked[0]!.id,'ai-2');
  b.update(idle,29.99);b.pause();const remaining=b.battle!.remaining;b.update(idle,5);assert.equal(b.battle!.remaining,remaining);b.resume();b.update(idle,.1);assert.equal(b.state,'results');assert.equal(b.time,30);assert.equal(b.battle!.remaining,0);assert.equal(b.battle!.winnerId,'ai-2');const results=JSON.stringify(b.results);b.update(idle,10);assert.equal(JSON.stringify(b.results),results);assert.ok(Object.isFrozen(b.results)&&Object.isFrozen(b.results[0]));
  const settings=validateSettings({...defaultSettings(),mode:'balloon-battle',battleDuration:60,mirrored:true,items:'none'});assert.equal(settings.battleDuration,60);assert.equal(settings.mirrored,false);assert.equal(settings.items,'all');assert.equal(validateSettings({...settings,battleDuration:-1}).battleDuration,120);
  const saves=new SaveStore(null),session=new Session(saves);session.begin(raceOptions(settings));session.accept(b);assert.equal(saves.data.cup,null);assert.deepEqual(saves.data.bests,{});const next=new Battle(createArena(),4782,session.active);assert.equal(next.battle!.remaining,60);assert.equal(next.battle!.stats[next.player.id]!.balloons,3);assert.equal(next.battle!.stats[next.player.id]!.score,0);
});
test('visible balloon pools match all twelve counters at low quality and race pickups survive mode switches',()=>{
  const b=new Battle(createArena()),visuals=new RaceVisuals();visuals.sync(b,1,true,0,'low');
  for(let i=0;i<12;i++){const group=visuals.root.getObjectByName(`battle-balloons-${i}`)!;assert.ok(group.visible);assert.equal(group.children.filter(o=>o.visible).length,3);}
  b.battle!.stats[b.player.id]!.balloons=1;visuals.sync(b,1,true,0,'low');assert.equal(visuals.root.getObjectByName('battle-balloons-0')!.children.filter(o=>o.visible).length,1);
  visuals.sync(new Race(createCourse(true)),1,true);assert.equal(visuals.root.getObjectByName('battle-balloons-0')!.visible,false);const scene=createArenaScene(b.course);let solids=0;scene.traverse(o=>{if(o.userData.cameraBlocker)solids++;if(o instanceof THREE.Mesh)assert.ok(o.geometry.getAttribute('position').count>0);});assert.equal(solids,8);disposeGroup(scene);disposeGroup(visuals.root);
});
test('chase camera snaps to a distant battle respawn so both viewports keep their own kart in view',()=>{
  const b=new Battle(createArena()),camera=new THREE.PerspectiveCamera(),chase=new ChaseCamera(camera),s=b.player.controller.state;
  chase.update(s,.1,false,false,true,b.course);b.player.controller.reset(b.course.arena!.spawns[6]!);chase.update(s,.1,false,false,false,b.course);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(s.x,s.y,s.z))<15);const forward=new THREE.Vector3();camera.getWorldDirection(forward);assert.ok(forward.dot(new THREE.Vector3(s.x-camera.position.x,0,s.z-camera.position.z))>0);
});
test('complete physical two-minute battle has active AI, all eight items, scoring, balloon losses, respawns and one winner',()=>{
  const b=new Battle(createArena()),positions=new Map(b.racers.map(r=>[r.id,new Set<string>()]));
  for(let i=0;i<7500&&b.state!=='results';i++){b.update(idle,dt);if(i%60===0)for(const r of b.racers)positions.get(r.id)!.add(`${Math.round(r.controller.state.x/5)},${Math.round(r.controller.state.z/5)}`);}
  console.log('Battle telemetry',JSON.stringify({hits:b.stats.hits,pickups:b.stats.pickups,usage:b.items.usage,results:b.results.map(r=>({id:r.id,score:r.score,hits:r.hits,losses:r.losses,respawns:r.respawns}))}));
  assert.equal(b.state,'results');assert.equal(b.time,120);assert.equal(b.results.length,12);assert.ok(b.stats.hits>=20);assert.ok(b.stats.pickups>=70);assert.ok(Object.values(b.items.usage).every(n=>n>0));assert.ok(b.results[0]!.score!>0);assert.ok(b.results.some(r=>r.respawns!>0));assert.ok(b.racers.filter(r=>!r.player).every(r=>positions.get(r.id)!.size>8));assert.ok(b.results.every(r=>r.score!>=0&&r.losses!>=0));assert.equal(b.battle!.winnerId,b.results[0]!.id);assert.ok(b.racers.every(r=>r.progress.laps===0));
});
