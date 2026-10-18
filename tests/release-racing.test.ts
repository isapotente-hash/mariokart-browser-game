import assert from 'node:assert/strict';
import test from 'node:test';
import { Race } from '../src/gameplay/Race';
import { AiDriver } from '../src/ai/AiDriver';
import { createCourse, poseAt } from '../src/tracks/course';
import { cupCourseIds, defaultSettings } from '../src/data/options';
import { itemKinds, drawItem } from '../src/data/items';
import type { DrivingInput, ItemKind } from '../src/data/types';

const idle:DrivingInput={throttle:false,brake:false,steering:0};
const dt=1/60;
function grant(race:Race,item:ItemKind){race.player.inventory.add(item);race.player.inventory.update(1);return race.items.use(race.player,false,race.racers);}

test('release roster contains twelve racers, two independent human inputs and Time Trial exactly three boosts',()=>{
  const normal=new Race(createCourse(true));assert.equal(normal.racers.length,12);assert.equal(normal.brains.size,11);
  const split=new Race(createCourse(true),4782,{players:2,items:'none'});split.state='racing';
  for(const ai of split.racers.filter((racer)=>!racer.player))ai.finishTime=0;
  for(let i=0;i<60;i++)split.update([{...idle,throttle:true},idle],dt);
  assert.ok(split.humans[0]!.controller.state.speed>5);assert.ok(Math.abs(split.humans[1]!.controller.state.speed)<1);
  const trial=new Race(createCourse(true),4782,{mode:'time-trial',players:2});trial.state='racing';
  assert.equal(trial.racers.length,1);assert.equal(trial.brains.size,0);assert.equal(trial.options.players,1);
  assert.equal(trial.items.pickups.filter((pickup)=>pickup.kind==='box'&&pickup.enabled).length,0);
  for(let i=0;i<4;i++)trial.update({...idle,useItem:true},dt);
  assert.equal(trial.items.usage.mushroom,3);assert.equal(trial.player.trialBoosts,0);assert.equal(trial.player.inventory.active,null);
});

test('all eight item definitions draw only when eligible and leader strikes stay rare',()=>{
  assert.equal(itemKinds.length,8);
  for(let i=0;i<1000;i++){
    assert.notEqual(drawItem(1,0,20,()=>i/1000),'leader');
    assert.ok(!['leader','homing'].includes(drawItem(8,100,20,()=>i/1000,'all',false)));
    assert.ok(['banana','mushroom','shield'].includes(drawItem(8,100,1,()=>i/1000)));
  }
  const draws=Array.from({length:1000},(_,i)=>drawItem(8,100,20,()=>i/1000));
  for(const kind of itemKinds)assert.ok(draws.includes(kind),`missing ${kind}`);
  assert.ok(draws.filter((kind)=>kind==='leader').length<50);
});

test('shield clears threats and blocks hits; invincibility grants timed speed and immunity',()=>{
  const race=new Race(createCourse(true));race.state='racing';
  const other=race.racers[1]!;other.inventory.add('shell');other.inventory.update(1);race.items.use(other,false,race.racers);
  const shell=race.items.objects.find((object)=>object.active)!;shell.x=race.player.controller.state.x;shell.z=race.player.controller.state.z;shell.y=race.player.controller.state.y;
  grant(race,'shield');assert.equal(race.items.objects.some((object)=>object.active&&object.kind==='shell'),false);assert.equal(race.player.controller.state.shield,3);assert.equal(race.player.controller.hit(),false);
  race.player.controller.state.shield=0;grant(race,'invincibility');assert.equal(race.player.controller.state.invincible,7);assert.equal(race.player.controller.hit(),false);
  for(let i=0;i<60*8;i++)race.player.controller.update(idle,dt);
  assert.equal(race.player.controller.state.invincible,0);assert.equal(race.player.controller.state.immunity,0);
});

test('timed explosive arms visibly and hits each racer at most once',()=>{
  const race=new Race(createCourse(true)),victim=race.racers[1]!;
  grant(race,'explosive');const bomb=race.items.objects.find((object)=>object.active)!;
  bomb.vx=0;bomb.vz=0;victim.controller.state.x=bomb.x;victim.controller.state.z=bomb.z;victim.controller.state.y=bomb.y;
  race.items.update(1.5,[victim],10);assert.equal(race.items.hits,0);assert.equal(bomb.exploded,false);
  race.items.update(.15,[victim],10.15);assert.equal(bomb.exploded,true);assert.equal(race.items.hits,1);
  victim.controller.state.immunity=0;race.items.update(.1,[victim],10.25);assert.equal(race.items.hits,1);
});

test('homing follows a turn-limited course target; leader warnings precede a counterable strike',()=>{
  const course=createCourse(true),race=new Race(course),owner=race.player,target=race.racers[1]!;
  const pose=poseAt(course,20);target.controller.reset(pose);target.distance=20;owner.distance=0;
  grant(race,'homing');const homing=race.items.objects.find((object)=>object.active)!;
  assert.equal(homing.target,target.id);const before=Math.atan2(homing.vx,homing.vz);
  race.items.update(dt,race.racers,10);
  const turn=Math.atan2(Math.sin(Math.atan2(homing.vx,homing.vz)-before),Math.cos(Math.atan2(homing.vx,homing.vz)-before));
  assert.ok(Math.abs(turn)<=3.2*dt+.0001);assert.equal(target.warning,'homing');
  homing.active=false;grant(race,'leader');const strike=race.items.objects.find((object)=>object.active)!;
  strike.x=target.controller.state.x;strike.z=target.controller.state.z;strike.y=target.controller.state.y+3;
  race.items.update(.2,race.racers,11);assert.equal(target.warning,'leader');assert.equal(target.controller.state.spin,0);
  target.inventory.add('shield');target.inventory.update(1);race.items.use(target,false,race.racers);
  assert.equal(race.items.objects.some((object)=>object.active&&object.kind==='leader'),false);assert.equal(target.controller.state.spin,0);
});

for(const id of cupCourseIds)test(`twelve-racer physical one-lap route validation: ${id}`,()=>{
  const course=createCourse(id),race=new Race(course,4782,{...defaultSettings(),laps:1,items:'none'}),driver=new AiDriver(2026);
  const traversal=new Set<string>();
  for(let i=0;i<60*180&&race.state!=='results';i++){
    race.update(driver.read(course,race.player,race.racers,dt),dt);
    for(const racer of race.racers)traversal.add(racer.controller.state.traversal);
  }
  console.log(id,race.time.toFixed(1),race.racers.map((r)=>`${r.name}:${r.progress.laps}/${r.progress.nextCheckpoint} rescues=${r.rescues}`).join(' '),[...traversal]);
  assert.equal(race.state,'results');assert.equal(race.results.length,12);assert.equal(race.player.progress.laps,1);
  assert.equal(race.racers.filter((r)=>r.progress.laps===1).length,12,'every AI must validate the route');
  if(id==='harbour-run')assert.ok(traversal.has('underwater'));
  if(id==='sky-foundry'){assert.ok(traversal.has('anti-gravity'));assert.ok(traversal.has('gliding'));}
});

test('finished human racers retain independent held rear-view input while the shared race continues',()=>{
  const race=new Race(createCourse(true),4782,{players:2});race.state='finished';race.humans[1]!.finishTime=30;
  race.update([idle,{...idle,rearView:true}],dt);assert.equal(race.humans[0]!.input.rearView,undefined);assert.equal(race.humans[1]!.input.rearView,true);
  race.update([idle,{...idle,rearView:false}],dt);assert.equal(race.humans[1]!.input.rearView,false);
});
