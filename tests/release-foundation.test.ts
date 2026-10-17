import assert from 'node:assert/strict';
import test from 'node:test';
import { drivers, chassis, tyres, gliders, calculateStats } from '../src/data/content';
import { defaultSettings, courseIds } from '../src/data/options';
import { createCup, advanceCup, cupRanking } from '../src/gameplay/Cup';
import { SaveStore, validateSave, validateSettings } from '../src/platform/SaveStore';
import { GhostRecorder, GhostStore, ghostKey, sampleGhost, validateGhost } from '../src/platform/Ghosts';
import { createCourse, poseAt, sampleTrack } from '../src/tracks/course';
import { trackFrame } from '../src/tracks/frames';
import { KartController } from '../src/gameplay/KartController';

test('all 144 original driver and vehicle combinations have bounded usable stats', () => {
  assert.equal(drivers.length, 8); assert.equal(chassis.length, 3); assert.equal(tyres.length, 3); assert.equal(gliders.length, 2);
  let count = 0;
  for (const driver of drivers) for (const body of chassis) for (const tyre of tyres) for (const glider of gliders) {
    const stats = calculateStats({ driver: driver.id, chassis: body.id, tyres: tyre.id, glider: glider.id });
    for (const value of Object.values(stats)) assert.ok(Number.isFinite(value) && value >= 0.75 && value <= 1.3);
    count++;
  }
  assert.equal(count, 144);
  assert.notDeepEqual(calculateStats({ driver:'pip', chassis:'swift', tyres:'standard', glider:'cloth' }), calculateStats({driver:'ash',chassis:'comet',tyres:'slick',glider:'wing'}));
});

test('four course layouts, mirrored geometry, local frames and explicit traversal volumes', () => {
  const lengths: number[] = [];
  for (const id of courseIds) {
    const course = createCourse(id), mirrored = createCourse(id, true);
    lengths.push(course.length); assert.equal(course.checkpoints.length, 12);
    for (let i = 0; i < 360; i += 7) {
      const a = course.samples[i]!, b = mirrored.samples[i]!;
      assert.ok(Math.abs(a.x + b.x) < 1e-8); assert.equal(a.z, b.z); assert.equal(a.y, b.y);
      const frame = trackFrame(a);
      assert.ok(Math.abs(Math.hypot(frame.up.x, frame.up.y, frame.up.z) - 1) < 1e-8);
      assert.ok(Math.abs(frame.forward.x * frame.up.x + frame.forward.y * frame.up.y + frame.forward.z * frame.up.z) < 1e-8);
    }
    for (const gate of course.checkpoints) assert.ok(sampleTrack(course, gate).distance < 0.1);
  }
  assert.equal(new Set(lengths.map(Math.round)).size, 4);
  assert.ok(createCourse('harbour-run').samples.some((sample) => sample.traversal === 'underwater' && sample.y < -10));
  assert.ok(createCourse('sky-foundry').samples.some((sample) => sample.bank > 1 && sample.traversal === 'anti-gravity'));
  assert.ok(createCourse('sky-foundry').launches.some((zone) => zone.glider));
  assert.ok(createCourse('starlight-causeway').exposed);
});

test('underwater physics changes drag/grip, anti-gravity aligns gravity, glider only opens at a launch', () => {
  const water = createCourse('harbour-run'), waterPose = poseAt(water, water.samples[100]!.distance);
  const wet = new KartController(water, waterPose);
  for(let i=0;i<30;i++) wet.update({throttle:true,brake:false,steering:0},1/60);
  assert.equal(wet.state.traversal,'underwater'); assert.equal(wet.state.surface,'underwater');
  const sky = createCourse('sky-foundry'); const bankPose = poseAt(sky,sky.samples[105]!.distance);
  const bank = new KartController(sky,bankPose);
  for(let i=0;i<20;i++)bank.update({throttle:true,brake:false,steering:0},1/60);
  assert.equal(bank.state.traversal,'anti-gravity'); assert.ok(Math.abs(bank.state.up.x)+Math.abs(bank.state.up.z)>.5);
  assert.ok(bank.state.gravity.x*bank.state.up.x+bank.state.gravity.y*bank.state.up.y+bank.state.gravity.z*bank.state.up.z < -9.7);
  const ordinary = new KartController(sky,sky.spawn); ordinary.update({throttle:false,brake:false,steering:0,drift:true},1/60);
  assert.notEqual(ordinary.state.traversal,'gliding');
  const pose = poseAt(sky,sky.launches[0]!.from+0.1), flyer = new KartController(sky,pose);
  Object.assign(flyer.state,{vx:Math.sin(pose.heading)*20,vz:Math.cos(pose.heading)*20});
  flyer.update({throttle:true,brake:false,steering:0},1/60); assert.equal(flyer.state.traversal,'gliding');
  const before=flyer.state.heading;
  for(let i=0;i<10;i++)flyer.update({throttle:true,brake:false,steering:.3,pitch:1},1/60);
  assert.ok(flyer.state.y>pose.y!); assert.ok(flyer.state.heading>before); assert.ok(flyer.state.pitch>0);
});

test('versioned settings migrate and reject corruption; denial never blocks runtime settings', () => {
  assert.equal(validateSave({version:1,settings:{quality:'low',masterVolume:2,players:5}}).version,3);
  const migrated = validateSave({version:2,settings:{quality:'low',masterVolume:2,players:5}});
  assert.equal(migrated.settings.quality,'low');assert.equal(migrated.settings.masterVolume,1);assert.equal(migrated.settings.players,1);
  assert.equal(validateSave({version:99,settings:{quality:'bad'}}).settings.quality,'medium');
  const bad = validateSettings({builds:[{driver:'missing'}],controls:[{throttle:'KeyA',left:'KeyA'}]});
  assert.equal(bad.builds[0].driver,'nova');assert.equal(bad.controls[0].throttle,'KeyW');
  const denied = new SaveStore({getItem:()=>{throw new Error('denied');},setItem:()=>{throw new Error('denied');}});
  denied.data.settings.quality='high';denied.save();assert.equal(denied.available,false);assert.equal(denied.data.settings.quality,'high');
  assert.equal(denied.import('{not json'),false);assert.equal(denied.import('{"version":999}'),false);
});

test('cup scores all four courses once and resolves points ties by wins then final position', () => {
  let cup=createCup(defaultSettings());
  const rows=Array.from({length:12},(_,i)=>({id:i===0?'player-1':`ai-${i}`,name:`Racer ${i}`,place:i+1,time:100+i,coins:3,finished:true}));
  cup=advanceCup(cup,rows,0);assert.equal(cup.standings[0]!.points,15);
  assert.equal(advanceCup(cup,rows,0),cup);
  for(let i=1;i<4;i++)cup=advanceCup(cup,rows,i);
  assert.ok(cup.completed);assert.equal(cup.standings[0]!.points,60);
  const ranking=cupRanking([{id:'a',name:'A',points:20,wins:0,lastPlace:1},{id:'b',name:'B',points:20,wins:1,lastPlace:8},{id:'c',name:'C',points:20,wins:1,lastPlace:2}]);
  assert.deepEqual(ranking.map((row)=>row.id),['c','b','a']);
  const storage=new SaveStore(null);storage.data.cup=cup;assert.equal(validateSave(JSON.parse(storage.export())).cup!.nextRace,4);
});

test('local ghost is versioned, interpolated, bounded and available in memory if IndexedDB is denied', async () => {
  const options=defaultSettings(),course=createCourse(true),controller=new KartController(course);
  const recorder=new GhostRecorder();recorder.sample(0,controller.state);controller.state.x+=10;recorder.sample(1,controller.state);
  const key=ghostKey(options,course.version),record=recorder.finish(key,course.version,2);
  assert.ok(validateGhost(record,key,course.version));assert.equal(validateGhost(record,key,'old-track'),null);
  assert.ok(Math.abs(sampleGhost(record,.5)!.x-controller.state.x+5)<1e-8);
  assert.equal(sampleGhost(record,3),null);
  const store=new GhostStore();await store.put(record);assert.equal((await store.get(key,course.version))!.key,key);
});

test('a missed glider launch falls through the physical gap rather than driving on an invisible surface',()=>{
  const course=createCourse('sky-foundry'),pose=poseAt(course,course.samples[230]!.distance),controller=new KartController(course,pose);
  controller.update({throttle:false,brake:false,steering:0},1/60);assert.equal(controller.state.traversal,'falling');
  const height=controller.state.y;controller.update({throttle:false,brake:false,steering:0},1/60);assert.ok(controller.state.y<height);assert.notEqual(controller.state.traversal,'gliding');
});

test('cup import rejects impossible points, roster IDs and duplicate finishing places',()=>{
  const data=validateSave({version:3});const cup=createCup(defaultSettings()),rows=Array.from({length:12},(_,i)=>({id:i===0?'player-1':`ai-${i}`,name:`Racer ${i}`,place:i+1,time:90+i,coins:0,finished:true}));
  data.cup=advanceCup(cup,rows,0);const valid=JSON.parse(JSON.stringify(data));assert.ok(validateSave(valid).cup);
  valid.cup.standings[0].points=60;assert.equal(validateSave(valid).cup,null);
  const wrongId=JSON.parse(JSON.stringify(data));wrongId.cup.standings[0].id='ai-99';assert.equal(validateSave(wrongId).cup,null);
  const wrongPlace=JSON.parse(JSON.stringify(data));wrongPlace.cup.standings[1].lastPlace=1;assert.equal(validateSave(wrongPlace).cup,null);
});
