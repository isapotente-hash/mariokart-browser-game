import { config } from '../data/config';
import { drawItem, itemKinds } from '../data/items';
import type { ItemSetting } from '../data/options';
import type { CourseDefinition, GameEvent, ItemKind, Point } from '../data/types';
import type { Racer } from '../gameplay/Racer';
import { poseAt, sampleTrack } from '../tracks/course';

export interface Pickup extends Point { id:string;kind:'box'|'coin';y:number;cooldown:number;double:boolean;enabled:boolean }
export type WorldKind = 'banana'|'shell'|'homing'|'explosive'|'leader'|'burst';
export interface WorldItem extends Point {
  id:number;active:boolean;kind:WorldKind;owner:string;y:number;vx:number;vz:number;age:number;life:number;bounces:number;
  target:string;direction:number;exploded:boolean;radius:number;hitIds:Set<string>;
}
export function sweptDistance(point:Point,from:Point,to:Point):number {
  const dx=to.x-from.x,dz=to.z-from.z;
  const t=Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.z-from.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(point.x-from.x-t*dx,point.z-from.z-t*dz);
}
export class ItemWorld {
  readonly pickups:Pickup[]=[];
  readonly objects:WorldItem[]=Array.from({length:config.items.poolSize},(_,id)=>({id,active:false,kind:'banana',owner:'',x:0,y:0,z:0,vx:0,vz:0,age:0,life:0,bounces:0,target:'',direction:1,exploded:false,radius:0,hitIds:new Set()}));
  readonly usage:Record<ItemKind,number>=Object.fromEntries(itemKinds.map((kind)=>[kind,0])) as Record<ItemKind,number>;
  hits=0;
  constructor(readonly course:CourseDefinition,private readonly random:()=>number,readonly setting:ItemSetting='all',readonly trial=false){
    for(let group=0;group<5;group++)for(let lane=-1;lane<=1;lane++){
      const p=poseAt(course,course.length*(.1+group*.175)),road=sampleTrack(course,p),offset=lane*course.width*.25;
      this.pickups.push({id:`box-${group}-${lane}`,kind:'box',x:p.x+road.right.x*offset,y:road.height+road.right.y*offset,z:p.z+road.right.z*offset,cooldown:0,double:lane===0,enabled:!trial&&setting!=='none'&&!road.gap});
    }
    for(let i=0;i<30;i++){
      const p=poseAt(course,course.length*(i+.5)/30),road=sampleTrack(course,p),offset=Math.sin(i*.7)*course.width*.18;
      this.pickups.push({id:`coin-${i}`,kind:'coin',x:p.x+road.right.x*offset,y:road.height+road.right.y*offset,z:p.z+road.right.z*offset,cooldown:0,double:false,enabled:!road.gap});
    }
  }
  private allocate(kind:WorldKind,owner:Racer):WorldItem {
    const object=this.objects.find((entry)=>!entry.active)??this.objects.reduce((a,b)=>a.life<b.life?a:b);
    Object.assign(object,{active:true,kind,owner:owner.id,x:owner.controller.state.x,y:owner.controller.state.y,z:owner.controller.state.z,vx:0,vz:0,age:0,life:8,bounces:0,target:'',direction:1,exploded:false,radius:0});object.hitIds.clear();return object;
  }
  private target(owner:Racer,racers:readonly Racer[],leader=false,rearward=false):Racer|undefined {
    const eligible=racers.filter((r)=>r.id!==owner.id&&r.finishTime===null);
    if(leader)return eligible.sort((a,b)=>b.distance-a.distance)[0];
    const ahead=eligible.filter((r)=>rearward?r.distance<owner.distance:r.distance>owner.distance);
    return (ahead.length?ahead:eligible).sort((a,b)=>Math.abs(a.distance-owner.distance)-Math.abs(b.distance-owner.distance))[0];
  }
  use(racer:Racer,rearward:boolean,racers:readonly Racer[]=[racer]):GameEvent[]{
    const item=racer.inventory.use();if(!item)return[];
    this.usage[item]++;
    const events:GameEvent[]=[{type:'use',racerId:racer.id,item}];
    const state=racer.controller.state;
    if(item==='mushroom'){racer.controller.boost(config.items.mushroomTime);return[...events,{type:'boost',racerId:racer.id}];}
    if(item==='invincibility'){state.invincible=7;state.spin=0;state.immunity=Math.max(state.immunity,7);return events;}
    if(item==='shield'){
      state.shield=3;
      for(const threat of this.objects)if(threat.active&&threat.owner!==racer.id&&Math.hypot(threat.x-state.x,threat.y-state.y,threat.z-state.z)<7)threat.active=false;
      const burst=this.allocate('burst',racer);burst.life=.55;burst.radius=7;return events;
    }
    const target=item==='homing'||item==='leader'?this.target(racer,racers,item==='leader',rearward):undefined;
    // A consumed targeting item with no remaining eligible opponent becomes a useful recovery boost.
    if((item==='homing'||item==='leader')&&!target){racer.controller.boost(1);return[...events,{type:'boost',racerId:racer.id}];}
    const object=this.allocate(item,racer),direction=rearward&&item!=='leader'?-1:1;
    const fx=Math.sin(state.heading)*direction,fz=Math.cos(state.heading)*direction;
    const speed=item==='shell'?config.items.shellSpeed:item==='explosive'?16:this.course.compact?14:48;
    Object.assign(object,{x:state.x+fx*2.2,z:state.z+fz*2.2,y:state.y+.4,vx:item==='banana'?0:fx*speed,vz:item==='banana'?0:fz*speed,life:item==='banana'?config.items.trapLife:item==='leader'?30:item==='homing'?20:item==='explosive'?2.2:config.items.shellLife,target:target?.id??'',direction});
    return events;
  }
  private hit(racer:Racer,object:WorldItem,consume=true):GameEvent[]{
    if(racer.finishTime!==null||racer.rescueRemaining>0||object.hitIds.has(racer.id)||(object.owner===racer.id&&object.age<config.items.ownerGrace))return[];
    if(racer.controller.state.shield>0||racer.controller.state.invincible>0){object.hitIds.add(racer.id);if(consume)object.active=false;return[];}
    if(!racer.controller.hit())return[];
    object.hitIds.add(racer.id);racer.coins=Math.max(0,racer.coins-3);if(consume)object.active=false;this.hits++;
    return[{type:'hit',racerId:racer.id,ownerId:object.owner}];
  }
  private guide(object:WorldItem,racers:readonly Racer[],dt:number):Racer|undefined {
    let target=racers.find((r)=>r.id===object.target&&r.finishTime===null);
    if(!target){const owner=racers.find((r)=>r.id===object.owner);target=owner?this.target(owner,racers,object.kind==='leader',object.direction<0):undefined;object.target=target?.id??'';}
    if(!target){object.active=false;return;}
    const road=sampleTrack(this.course,object),targetRoad=sampleTrack(this.course,target.controller.state);
    const remaining=((targetRoad.progress-road.progress)*object.direction+this.course.length)%this.course.length;
    const aim=remaining<10?target.controller.state:poseAt(this.course,road.progress+object.direction*Math.min(10,remaining),road.route);
    const current=Math.atan2(object.vx,object.vz),desired=Math.atan2(aim.x-object.x,aim.z-object.z);
    const delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
    const angle=current+Math.max(-3.2*dt,Math.min(3.2*dt,delta));
    const speed=object.kind==='leader'?(this.course.compact?18:60):(this.course.compact?14:48);
    object.vx=Math.sin(angle)*speed;object.vz=Math.cos(angle)*speed;
    if(object.kind==='leader')target.warning='leader';else if(target.warning!=='leader'&&Math.hypot(target.controller.state.x-object.x,target.controller.state.z-object.z)<65)target.warning='homing';
    return target;
  }
  update(dt:number,racers:readonly Racer[],time:number):GameEvent[]{
    const events:GameEvent[]=[];
    for(const racer of racers)racer.warning='';
    for(const pickup of this.pickups)pickup.cooldown=Math.max(0,pickup.cooldown-dt);
    const leaderDistance=Math.max(0,...racers.map((r)=>r.distance));
    for(const racer of racers){
      if(racer.finishTime!==null||racer.rescueRemaining>0)continue;
      for(const pickup of this.pickups){
        if(!pickup.enabled||pickup.cooldown>0||Math.abs(racer.controller.state.y-pickup.y)>3||sweptDistance(pickup,racer.previous,racer.controller.state)>(pickup.kind==='coin'?1.1:1.5))continue;
        if(pickup.kind==='coin'){
          if(racer.coins>=config.race.coinCap)continue;
          racer.coins++;pickup.cooldown=config.items.coinRespawn;events.push({type:'pickup',racerId:racer.id,item:'coin'});
        }else if(racer.pickupCooldown<=0&&!racer.inventory.full){
          const position=1+racers.filter((other)=>other.distance>racer.distance).length;
          for(let slot=0;slot<(pickup.double?2:1);slot++){
            if(racer.inventory.full)break;
            const item=drawItem(position,leaderDistance-racer.distance,time,this.random,this.setting,racers.some((other)=>other.id!==racer.id&&other.finishTime===null));
            racer.inventory.add(item);events.push({type:'pickup',racerId:racer.id,item});
          }
          pickup.cooldown=config.items.boxRespawn;racer.pickupCooldown=config.items.pickupCooldown;
        }
      }
    }
    for(const object of this.objects){
      if(!object.active)continue;
      object.age+=dt;object.life-=dt;if(object.life<=0){object.active=false;continue;}
      if(object.kind==='burst'){object.radius=Math.min(7,object.age*20);continue;}
      if(object.kind==='explosive'){
        if(object.age<1.6){object.x+=object.vx*dt;object.z+=object.vz*dt;object.vx*=Math.exp(-1.6*dt);object.vz*=Math.exp(-1.6*dt);object.y=sampleTrack(this.course,object).height+.4+Math.sin(object.age/1.6*Math.PI)*2;}
        else{object.exploded=true;object.radius=6;object.y=sampleTrack(this.course,object).height;for(const racer of racers)if(Math.hypot(racer.controller.state.x-object.x,racer.controller.state.y-object.y,racer.controller.state.z-object.z)<6)events.push(...this.hit(racer,object,false));}
        continue;
      }
      if(object.kind==='banana'){
        object.y=sampleTrack(this.course,object).height;
        if(object.age<config.items.armTime)continue;
        for(const racer of racers){if(Math.abs(racer.controller.state.y-object.y)<2&&sweptDistance(object,racer.previous,racer.controller.state)<1.25)events.push(...this.hit(racer,object));if(!object.active)break;}
        continue;
      }
      const target=object.kind==='homing'||object.kind==='leader'?this.guide(object,racers,dt):undefined;
      if(!object.active)continue;
      if(object.kind==='leader'&&target&&Math.hypot(target.controller.state.x-object.x,target.controller.state.z-object.z)<4){
        if(object.age>=1.2){events.push(...this.hit(target,object));object.active=false;}continue;
      }
      const steps=Math.max(1,Math.ceil(Math.hypot(object.vx,object.vz)*dt/.4));
      for(let i=0;i<steps&&object.active;i++){
        const from={x:object.x,z:object.z};object.x+=object.vx*dt/steps;object.z+=object.vz*dt/steps;
        const road=sampleTrack(this.course,object);object.y=road.height+(object.kind==='leader'?3:.4);
        const boundary=road.width/2+2.4-.45;
        if(object.kind!=='leader'&&road.distance>boundary){
          const sign=Math.sign(road.offset)||1,nx=road.normal.x*sign,nz=road.normal.z*sign;
          object.x=road.x+nx*boundary*Math.cos(road.bank);object.z=road.z+nz*boundary*Math.cos(road.bank);
          const outward=object.vx*nx+object.vz*nz;
          if(outward>0){object.vx-=2*outward*nx;object.vz-=2*outward*nz;object.bounces++;}
          if(object.bounces>=config.items.shellBounces)object.active=false;
        }
        if(object.kind!=='leader')for(const racer of racers){if(Math.abs(racer.controller.state.y-object.y)<2&&sweptDistance(racer.controller.state,from,object)<1.2)events.push(...this.hit(racer,object));if(!object.active)break;}
      }
    }
    return events;
  }
}
