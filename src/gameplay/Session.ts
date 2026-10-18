import { cupCourseIds,raceOptions } from '../data/options';
import type { RaceOptions } from '../data/options';
import { createCup,advanceCup,cupRanking } from './Cup';
import type { SaveStore } from '../platform/SaveStore';
import type { Race } from './Race';
import { ghostKey,physicsVersion } from '../platform/Ghosts';

export class Session {
  active:RaceOptions;
  private cupId='';private cupIndex=0;private accepted=new WeakSet<Race>();
  constructor(readonly saves:SaveStore){this.active=raceOptions(saves.data.settings);}
  begin(options:RaceOptions,resume=false):RaceOptions {
    let selected=raceOptions(options);
    if(selected.mode==='grand-prix'){
      if(!resume||!this.saves.data.cup||this.saves.data.cup.completed)this.saves.data.cup=createCup(selected);
      const cup=this.saves.data.cup!;this.cupId=cup.id;this.cupIndex=cup.nextRace;
      selected={...cup.options,course:cupCourseIds[cup.nextRace]!};
    }else{this.cupId='';this.cupIndex=0;}
    this.active=selected;this.saves.data.settings={...this.saves.data.settings,...selected};this.saves.save();return structuredClone(selected);
  }
  resumeCup():RaceOptions|null {
    const cup=this.saves.data.cup;if(!cup||cup.completed)return null;return this.begin(cup.options,true);
  }
  nextCupRace():RaceOptions {return this.begin({...this.active,mode:'grand-prix'},true);}
  abandonCup():void{this.saves.data.cup=null;this.cupId='';this.saves.save();}
  accept(race:Race):boolean {
    if(this.accepted.has(race)||race.state!=='results')return false;this.accepted.add(race);
    this.saves.data.coins+=race.humans.reduce((sum,racer)=>sum+racer.coins,0);
    const badges=new Set(this.saves.data.unlocks);if(race.humans.some((racer)=>racer.finishTime!==null))badges.add('first-finish');if(this.saves.data.coins>=50)badges.add('coin-collector');
    if(race.options.mode==='grand-prix'&&this.saves.data.cup?.id===this.cupId){
      this.saves.data.cup=advanceCup(this.saves.data.cup,race.results,this.cupIndex);
      if(this.saves.data.cup.completed&&cupRanking(this.saves.data.cup.standings)[0]?.id.startsWith('player-'))badges.add('cup-winner');
    }
    this.saves.data.unlocks=[...badges];this.saves.save();return true;
  }
  recordTrial(race:Race):{key:string;improved:boolean;best:number}|null {
    if(race.options.mode!=='time-trial'||race.player.finishTime===null)return null;
    const key=ghostKey(race.options,race.course.version),old=this.saves.data.bests[key],time=race.player.finishTime;
    const improved=!old||time<old.time;
    if(improved){this.saves.data.bests[key]={time,course:race.course.id,physicsVersion,trackVersion:race.course.version};this.saves.save();}
    return{key,improved,best:improved?time:old.time};
  }
}
