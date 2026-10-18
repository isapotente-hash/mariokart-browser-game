import { config } from '../data/config';
import { drivers } from '../data/content';
import { defaultSettings } from '../data/options';
import type { RaceOptions, VehicleBuild } from '../data/options';
import type { CourseDefinition, DrivingInput, GameEvent, RaceState } from '../data/types';
import { seededRandom } from '../core/random';
import { AiDriver } from '../ai/AiDriver';
import { Inventory } from '../items/Inventory';
import { ItemWorld } from '../items/ItemWorld';
import { gridPose, sampleTrack, hazardPose } from '../tracks/course';
import { KartController } from './KartController';
import { LapProgress } from './LapProgress';
import type { Racer, ResultRow } from './Racer';
import { rankRacers, validatedDistance } from './ranking';
import type { BattleStatus } from './Battle';

const idle:DrivingInput={throttle:false,brake:false,steering:0};
export class Race {
  battle:BattleStatus|null=null;
  state:RaceState='countdown';countdown:number=config.race.countdown;time=0;
  readonly racers:Racer[];readonly items:ItemWorld;readonly brains=new Map<string,AiDriver>();
  readonly options:RaceOptions;
  results:readonly ResultRow[]=[];
  private finishWait=0;private finishCount=0;private pausedState:RaceState='racing';
  readonly stats={pickups:0,boosts:0,hits:0,playerUses:0};
  readonly usesByRacer:Record<string,number>={};
  constructor(readonly course:CourseDefinition,readonly seed=4782,options:Partial<RaceOptions>={}){
    const defaults=defaultSettings();
    this.options={...defaults,...options,laps:Math.max(1,Math.min(5,Math.round(options.laps??3))),builds:structuredClone(options.builds??defaults.builds)};
    if(this.options.mode==='time-trial'){this.options.players=1;this.options.items='none';this.options.laps=3;}
    if(this.options.mode==='grand-prix')this.options.laps=3;
    const humans=this.options.players,count=this.options.mode==='time-trial'?1:12;
    this.racers=Array.from({length:count},(_,index)=>{
      const human=index<humans,aiIndex=index-humans+1;
      const build:VehicleBuild=human?this.options.builds[index]!:{driver:drivers[index%8]!.id,chassis:['swift','rover','comet'][index%3]!,tyres:['standard','grip','slick'][index%3]!,glider:index%2?'cloth':'wing'};
      const driver=drivers.find((entry)=>entry.id===build.driver)!;
      const id=human?`player-${index+1}`:`ai-${aiIndex}`;
      const name=human?`${driver.name} (P${index+1})`:`${driver.name}${index>=8?' 2':''}`;
      const grid=gridPose(course,index),controller=new KartController(course,grid,build,this.options.speed);
      if(human){controller.autoAccelerate=this.options.autoAccelerate;controller.steeringAssist=this.options.steeringAssist;}
      else this.brains.set(id,new AiDriver(seed+index*101,this.options.difficulty));
      const inventory=new Inventory();
      if(this.options.mode==='time-trial'){inventory.add('mushroom');inventory.add('mushroom');inventory.drawRemaining=0;}
      return {id,name,color:driver.color,player:human,controller,progress:new LapProgress(course,id,true),inventory,previous:{...controller.state},grid,input:{...idle},coins:0,pickupCooldown:0,rescueRemaining:0,rescues:0,wrongWayTime:0,finishTime:null,finishPlace:null,distance:-4-Math.floor(index/2)*4.5,warning:'' as const,trialBoosts:this.options.mode==='time-trial'?3:0};
    });
    this.items=new ItemWorld(course,seededRandom(seed),this.options.items,this.options.mode==='time-trial');
  }
  get player():Racer{return this.racers[0]!;}
  get humans():Racer[]{return this.racers.filter((racer)=>racer.player);}
  get ranked():Racer[]{return rankRacers(this.racers);}
  pause():void{if(['countdown','racing','finished'].includes(this.state)){this.pausedState=this.state;this.state='paused';}}
  resume():void{if(this.state==='paused')this.state=this.pausedState;}
  rescue(racer:Racer):GameEvent[]{
    if(racer.finishTime!==null||racer.rescueRemaining>0)return[];
    let pose=racer.grid;
    if(racer.progress.started){
      let last=(racer.progress.nextCheckpoint+11)%12;
      for(let i=0;i<12&&sampleTrack(this.course,this.course.checkpoints[last]!).gap;i++)last=(last+11)%12;
      const gate=this.course.checkpoints[last]!;
      pose={x:gate.x+Math.sin(gate.heading),z:gate.z+Math.cos(gate.heading),heading:gate.heading};pose.y=sampleTrack(this.course,pose).height;
      if(this.course.imported)pose={x:gate.x+gate.forward!.x,y:gate.y!+gate.forward!.y,z:gate.z+gate.forward!.z,heading:gate.heading,forward:gate.forward};
    }
    racer.controller.reset(pose);racer.controller.state.immunity=config.race.rescueImmunity;
    racer.rescueRemaining=config.race.rescueDelay;racer.rescues++;racer.wrongWayTime=0;
    Object.assign(racer.previous,racer.controller.state);racer.distance=validatedDistance(this.course,racer);
    return[{type:'rescue',racerId:racer.id}];
  }
  protected collisions():GameEvent[]{
    const events:GameEvent[]=[],contacts=new Set<Racer>();
    for(let i=0;i<this.racers.length;i++)for(let j=i+1;j<this.racers.length;j++){
      const a=this.racers[i]!,b=this.racers[j]!,sa=a.controller.state,sb=b.controller.state;
      if(a.finishTime!==null||b.finishTime!==null||a.rescueRemaining>0||b.rescueRemaining>0||(!this.course.imported&&Math.abs(sa.y-sb.y)>1.5))continue;
      const x=sa.x-sb.x,y=this.course.imported?sa.y-sb.y:0,z=sa.z-sb.z,distance=Math.hypot(x,y,z);
      if(distance>=config.kart.radius*2)continue;
      const fallback=this.course.imported&&distance<=.001?sampleTrack(this.course,sa).right:{x:1,y:0,z:0};
      const nx=distance>.001?x/distance:fallback.x,ny=distance>.001?y/distance:fallback.y,nz=distance>.001?z/distance:fallback.z,correction=Math.min(.4,(config.kart.radius*2-distance)*.5);
      contacts.add(a);contacts.add(b);
      sa.x+=nx*correction;sa.y+=ny*correction;sa.z+=nz*correction;sb.x-=nx*correction;sb.y-=ny*correction;sb.z-=nz*correction;
      const relative=(sa.vx-sb.vx)*nx+(sa.vy-sb.vy)*ny+(sa.vz-sb.vz)*nz;
      if(relative<0){const impulse=Math.min(2,-relative*.5);sa.vx+=nx*impulse;sa.vy+=ny*impulse;sa.vz+=nz*impulse;sb.vx-=nx*impulse;sb.vy-=ny*impulse;sb.vz-=nz*impulse;}
      if(relative<-.5&&sa.traversal==='anti-gravity'&&sb.traversal==='anti-gravity')for(const racer of[a,b]){racer.controller.boost(.45);events.push({type:'boost',racerId:racer.id});}
    }
    if(this.course.imported)for(const racer of contacts)racer.controller.constrainToRoad();
    for(const hazard of this.course.hazards){
      const pose=hazardPose(this.course,hazard,this.time);
      for(const racer of this.racers){const state=racer.controller.state;
        if(racer.finishTime===null&&racer.rescueRemaining===0&&Math.abs(state.y-pose.y)<2&&Math.hypot(state.x-pose.x,state.z-pose.z)<hazard.radius+config.kart.radius&&racer.controller.hit()){
          racer.coins=Math.max(0,racer.coins-3);events.push({type:'hit',racerId:racer.id,ownerId:hazard.id});
        }
      }
    }
    return events;
  }
  update(source:DrivingInput|readonly DrivingInput[],dt:number):GameEvent[]{
    const events:GameEvent[]=[];
    if(this.state==='countdown'){
      this.countdown=Math.max(0,this.countdown-dt);
      if(this.countdown<1e-8){this.countdown=0;this.state='racing';events.push({type:'state',state:'racing'});}return events;
    }
    if(this.state!=='racing'&&this.state!=='finished')return events;
    this.time+=dt;
    const inputs:readonly DrivingInput[]=Array.isArray(source)?source:[source as DrivingInput];
    const humans=this.humans;
    const hazards=[...this.items.objects.filter((object)=>object.active&&object.age>config.items.armTime),...this.course.hazards.map((hazard)=>hazardPose(this.course,hazard,this.time))];
    for(const racer of this.racers){
      Object.assign(racer.previous,racer.controller.state);if(racer.player)racer.input=inputs[humans.indexOf(racer)]??idle;if(racer.finishTime!==null)continue;
      racer.inventory.update(dt);racer.pickupCooldown=Math.max(0,racer.pickupCooldown-dt);
      if(racer.rescueRemaining>0){racer.rescueRemaining=Math.max(0,racer.rescueRemaining-dt);continue;}
      if(!racer.player)racer.input=this.brains.get(racer.id)!.read(this.course,racer,this.racers,dt,hazards);
      if(racer.input.rescue){events.push(...this.rescue(racer));continue;}
      const state=racer.controller.state,road=sampleTrack(this.course,state);
      if(![state.x,state.y,state.z,state.heading,state.vx,state.vy,state.vz].every(Number.isFinite)||(this.course.imported?(state.y< -80||(!['gliding','jumping','falling'].includes(state.traversal)&&road.distance>this.course.width+15)):road.distance>this.course.width+15||state.y<road.height-8)){events.push(...this.rescue(racer));continue;}
      const beforeBoost=state.boost;racer.controller.coinBonus=racer.coins*config.race.coinSpeed;racer.controller.update(racer.input,dt);
      if(state.boost>beforeBoost+.1)events.push({type:'boost',racerId:racer.id});
      if(racer.input.useItem){
        const used=this.items.use(racer,!!racer.input.rearward,this.racers);events.push(...used);
        if(this.options.mode==='time-trial'&&used.some((event)=>event.type==='use')){
          racer.trialBoosts=Math.max(0,racer.trialBoosts-1);
          if(racer.trialBoosts>Number(!!racer.inventory.active)+Number(!!racer.inventory.reserve)){racer.inventory.add('mushroom');racer.inventory.drawRemaining=0;}
        }
      }
      const along=this.course.imported?state.vx*road.forward.x+state.vy*road.forward.y+state.vz*road.forward.z:state.vx*road.tangent.x+state.vz*road.tangent.z;
      racer.wrongWayTime=along<-1.5?racer.wrongWayTime+dt:Math.max(0,racer.wrongWayTime-dt*2);
    }
    events.push(...this.collisions());
    const finishers:{racer:Racer;time:number}[]=[];
    for(const racer of this.racers){
      if(racer.finishTime!==null||racer.rescueRemaining>0)continue;
      events.push(...racer.progress.update(racer.previous,racer.controller.state,this.time));racer.distance=validatedDistance(this.course,racer);
      if(racer.progress.laps>=this.options.laps){
        const gate=this.course.checkpoints[0]!,along=(point:{x:number;y?:number;z:number})=>(point.x-gate.x)*(gate.forward?.x??Math.sin(gate.heading))+(point.z-gate.z)*(gate.forward?.z??Math.cos(gate.heading))+((point.y??0)-(gate.y??0))*(gate.forward?.y??0);
        const before=along(racer.previous),after=along(racer.controller.state),fraction=Math.max(0,Math.min(1,-before/(after-before)));
        finishers.push({racer,time:this.time-dt+fraction*dt});
      }
    }
    finishers.sort((a,b)=>a.time-b.time||a.racer.id.localeCompare(b.racer.id));
    for(const{racer,time}of finishers){
      racer.finishTime=time;racer.finishPlace=++this.finishCount;
      racer.controller.state.vx=0;racer.controller.state.vy=0;racer.controller.state.vz=0;racer.controller.state.speed=0;
      events.push({type:'finish',racerId:racer.id,place:racer.finishPlace,time});
      if(racer.player){this.state='finished';events.push({type:'state',state:'finished'});}
    }
    events.push(...this.items.update(dt,this.racers,this.time));
    for(const event of events){
      if(event.type==='pickup')this.stats.pickups++;if(event.type==='hit')this.stats.hits++;if(event.type==='boost')this.stats.boosts++;
      if(event.type==='use'&&event.racerId.startsWith('player-')){this.stats.playerUses++;this.usesByRacer[event.racerId]=(this.usesByRacer[event.racerId]??0)+1;}
    }
    if(this.state==='finished'&&humans.every((racer)=>racer.finishTime!==null)){
      this.finishWait+=dt;
      if(this.finishCount===this.racers.length||this.finishWait>=config.race.finishTimeout){
        this.results=Object.freeze(this.ranked.map((racer,index)=>Object.freeze({id:racer.id,name:racer.name,place:index+1,time:racer.finishTime,coins:racer.coins,finished:racer.finishTime!==null})));
        this.state='results';events.push({type:'state',state:'results'});
      }
    }
    return events;
  }
}
