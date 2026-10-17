import { Race } from './Race';
import type { Racer } from './Racer';
import type { CourseDefinition,DrivingInput,GameEvent,Pose } from '../data/types';
import type { RaceOptions } from '../data/options';
import { ArenaDriver } from '../ai/ArenaDriver';
import { battleRules,arenaContact } from '../tracks/arena';

export interface BattleRacer {balloons:number;score:number;hits:number;losses:number;respawns:number;lastScoreTime:number}
export interface BattleStatus {duration:number;remaining:number;stats:Record<string,BattleRacer>;winnerId:string|null;tieBreak:string}
const idle:DrivingInput={throttle:false,brake:false,steering:0};
export class Battle extends Race {
  constructor(course:CourseDefinition,seed=4782,options:Partial<RaceOptions>={}){
    super(course,seed,{...options,mode:'balloon-battle',items:'all',mirrored:false});
    const duration=battleRules.durations.includes(options.battleDuration as 30|60|120|180)?options.battleDuration!:battleRules.duration;
    this.battle={duration,remaining:duration,stats:Object.fromEntries(this.racers.map(r=>[r.id,{balloons:3,score:0,hits:0,losses:0,respawns:0,lastScoreTime:Infinity}])),winnerId:null,tieBreak:'Score, successful hits, fewer balloons lost, earliest scoring hit, then grid order.'};
    for(const racer of this.racers){racer.distance=0;racer.controller.steeringAssist=false;racer.controller.state.immunity=battleRules.protectionSeconds;if(!racer.player)this.brains.set(racer.id,new ArenaDriver(seed+this.racers.indexOf(racer)*101,this.options.difficulty,this.items.pickups));}
  }
  override get ranked():Racer[]{const stats=this.battle?.stats;if(!stats)return this.racers;return[...this.racers].sort((a,b)=>{const x=stats[a.id]!,y=stats[b.id]!;return y.score-x.score||y.hits-x.hits||x.losses-y.losses||x.lastScoreTime-y.lastScoreTime||this.racers.indexOf(a)-this.racers.indexOf(b);});}
  private safeSpawn(racer:Racer):Pose {
    const arena=this.course.arena!;
    const threats=[...this.racers.filter(other=>other.id!==racer.id&&other.rescueRemaining===0).map(r=>r.controller.state),...this.items.objects.filter(o=>o.active&&o.kind!=='burst')];
    return{...arena.spawns.reduce((best,pose)=>{
      const safety=(p:Pose)=>Math.min(100,...threats.map(other=>Math.hypot(other.x-p.x,other.z-p.z)));
      return safety(pose)>safety(best)?pose:best;
    },arena.spawns[this.racers.indexOf(racer)]!)};
  }
  override rescue(racer:Racer):GameEvent[]{
    if(racer.rescueRemaining>0||this.state==='results')return[];
    const stat=this.battle!.stats[racer.id]!;stat.score=Math.max(0,stat.score-battleRules.lossPenalty);stat.balloons=0;stat.respawns++;racer.distance=stat.score;
    racer.inventory.clear();racer.pickupCooldown=0;racer.warning='';racer.controller.reset(racer.controller.state);racer.rescueRemaining=battleRules.respawnSeconds;racer.rescues++;
    return[{type:'rescue',racerId:racer.id}];
  }
  private registerHits(events:readonly GameEvent[]):void {
    for(const event of events){if(event.type!=='hit')continue;const victim=this.racers.find(r=>r.id===event.racerId)!;const stat=this.battle!.stats[victim.id]!;if(stat.balloons<=0||victim.rescueRemaining>0)continue;
      stat.balloons--;stat.losses++;this.stats.hits++;
      const owner=this.battle!.stats[event.ownerId];if(owner&&event.ownerId!==victim.id){owner.score+=battleRules.hitPoints;owner.hits++;owner.lastScoreTime=Math.min(owner.lastScoreTime,this.time);}else if(event.ownerId===victim.id)stat.score=Math.max(0,stat.score-1);
      if(stat.balloons===0)this.rescue(victim);
    }
    for(const racer of this.racers)racer.distance=this.battle!.stats[racer.id]!.score;
  }
  override update(source:DrivingInput|readonly DrivingInput[],dt:number):GameEvent[]{
    if(this.state==='countdown')return super.update(source,dt);
    if(this.state!=='racing')return[];
    const battle=this.battle!,step=Math.min(dt,battle.remaining);this.time+=step;battle.remaining=Math.max(0,battle.duration-this.time);const events:GameEvent[]=[],humans=this.humans,inputs=Array.isArray(source)?source:[source as DrivingInput];
    const hazards=this.items.objects.filter(o=>o.active&&o.kind!=='burst'&&o.kind!=='leader');
    for(const racer of this.racers){Object.assign(racer.previous,racer.controller.state);
      if(racer.rescueRemaining>0){racer.rescueRemaining=Math.max(0,racer.rescueRemaining-step);if(racer.rescueRemaining<1e-8){racer.rescueRemaining=0;racer.controller.reset(this.safeSpawn(racer));racer.controller.state.immunity=battleRules.protectionSeconds;battle.stats[racer.id]!.balloons=battleRules.balloons;(this.brains.get(racer.id) as ArenaDriver|undefined)?.reset();Object.assign(racer.previous,racer.controller.state);racer.input={...idle};}continue;}
      racer.inventory.update(step);racer.pickupCooldown=Math.max(0,racer.pickupCooldown-step);
      racer.input=racer.player?inputs[humans.indexOf(racer)]??idle:this.brains.get(racer.id)!.read(this.course,racer,this.racers,step,hazards);
      if(racer.input.rescue){events.push(...this.rescue(racer));continue;}
      const state=racer.controller.state;if(![state.x,state.z,state.y,state.heading,state.vx,state.vz].every(Number.isFinite)){racer.controller.reset(this.safeSpawn(racer));events.push(...this.rescue(racer));continue;}
      const contact=arenaContact(this.course.arena!,state,.85);if(Math.hypot(contact.x-state.x,contact.z-state.z)>10){events.push(...this.rescue(racer));continue;}
      racer.controller.update(racer.input,step);if(racer.input.useItem)events.push(...this.items.use(racer,!!racer.input.rearward,this.racers));
    }
    events.push(...this.collisions(),...this.items.update(step,this.racers,this.time));this.registerHits(events);
    for(const event of events){if(event.type==='pickup')this.stats.pickups++;if(event.type==='boost')this.stats.boosts++;if(event.type==='use'){this.usesByRacer[event.racerId]=(this.usesByRacer[event.racerId]??0)+1;if(event.racerId.startsWith('player-'))this.stats.playerUses++;}}
    if(battle.remaining<=1e-8){battle.remaining=0;this.time=battle.duration;battle.winnerId=this.ranked[0]!.id;this.results=Object.freeze(this.ranked.map((r,index)=>Object.freeze({id:r.id,name:r.name,place:index+1,time:this.time,coins:0,finished:true,score:battle.stats[r.id]!.score,hits:battle.stats[r.id]!.hits,losses:battle.stats[r.id]!.losses,respawns:battle.stats[r.id]!.respawns})));this.state='results';events.push({type:'finish',racerId:battle.winnerId,place:1,time:this.time},{type:'state',state:'results'});}
    return events;
  }
}
