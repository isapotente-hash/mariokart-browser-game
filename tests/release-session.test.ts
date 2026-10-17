import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/gameplay/Session';
import { SaveStore,validateSettings } from '../src/platform/SaveStore';
import { Race } from '../src/gameplay/Race';
import { AiDriver } from '../src/ai/AiDriver';
import { createCourse } from '../src/tracks/course';
import { courseIds,defaultSettings,raceOptions } from '../src/data/options';

test('a physical four-race Grand Prix persists between courses, awards once, and can start another cup',()=>{
  let json='';const storage={getItem:()=>json||null,setItem:(_key:string,value:string)=>{json=value;}};
  let saves=new SaveStore(storage),session=new Session(saves),options=session.begin({...defaultSettings(),mode:'grand-prix'});
  for(const[index,id]of courseIds.entries()){
    assert.equal(options.course,id);assert.equal(options.laps,3);
    const course=createCourse(id,false,true),race=new Race(course,4782+index*901,options),driver=new AiDriver(2026);
    for(let frame=0;frame<60*240&&race.state!=='results';frame++)race.update(driver.read(course,race.player,race.racers,1/60),1/60);
    assert.equal(race.state,'results',`${id} must finish physically`);assert.equal(race.player.progress.laps,3);
    assert.ok(session.accept(race));assert.equal(session.accept(race),false);assert.equal(saves.data.cup!.nextRace,index+1);
    assert.equal(saves.data.cup!.standings.length,12);assert.equal(saves.data.cup!.standings.reduce((sum,row)=>sum+row.points,0),82*(index+1));
    saves=new SaveStore(storage);session=new Session(saves);
    if(index<3){options=session.resumeCup()!;assert.equal(options.course,courseIds[index+1]);}
  }
  assert.equal(saves.data.cup!.completed,true);assert.equal(session.resumeCup(),null);
  options=session.nextCupRace();assert.equal(options.course,'garden-circuit');assert.equal(saves.data.cup!.nextRace,0);
  session.abandonCup();assert.equal(new SaveStore(storage).data.cup,null);
});

test('mode validation and cross-player controls survive imported malformed settings',()=>{
  const trial=validateSettings({...defaultSettings(),mode:'time-trial',players:2,laps:5,items:'all'});
  assert.equal(trial.players,1);assert.equal(trial.laps,3);assert.equal(trial.items,'none');
  const overlapping=defaultSettings();overlapping.controls[1].throttle='KeyW';
  assert.deepEqual(validateSettings(overlapping).controls,defaultSettings().controls);
  const settings=validateSettings({...defaultSettings(),mode:'grand-prix',laps:1,items:'none'});
  assert.equal(settings.items,'all');assert.equal(raceOptions(settings).laps,3);
});
