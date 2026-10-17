import { AiDriver } from './AiDriver';
import type { CourseDefinition,DrivingInput,Point } from '../data/types';
import type { Racer } from '../gameplay/Racer';
import type { Pickup } from '../items/ItemWorld';
import { arenaWaypoint,arenaLineClear } from '../tracks/arena';

export class ArenaDriver extends AiDriver {
  targetId='';intent:'supply'|'attack'|'avoid'|'recover'='supply';
  private timer=0;private itemCooldown=0;private stuck=0;private previous:Point|null=null;
  constructor(seed:number,difficulty:ConstructorParameters<typeof AiDriver>[1],private readonly supplies:readonly Pickup[]){super(seed,difficulty);}
  reset():void{this.stuck=0;this.previous=null;this.timer=0;this.targetId='';this.itemCooldown=0;}
  override read(course:CourseDefinition,racer:Racer,opponents:readonly Racer[],dt:number,hazards:readonly Point[]=[]):DrivingInput {
    const arena=course.arena!,state=racer.controller.state;this.timer-=dt;this.itemCooldown=Math.max(0,this.itemCooldown-dt);
    const moved=this.previous?Math.hypot(state.x-this.previous.x,state.z-this.previous.z):1;this.stuck=moved<.02?this.stuck+dt:Math.max(0,this.stuck-dt*3);this.previous={x:state.x,z:state.z};
    const eligible=opponents.filter(other=>other.id!==racer.id&&other.rescueRemaining===0&&other.finishTime===null);
    let target=eligible.find(other=>other.id===this.targetId);
    if(this.timer<=0||!target){target=eligible.sort((a,b)=>Math.hypot(a.controller.state.x-state.x,a.controller.state.z-state.z)+(a.controller.state.immunity>0?20:0)-Math.hypot(b.controller.state.x-state.x,b.controller.state.z-state.z)-(b.controller.state.immunity>0?20:0))[0];this.targetId=target?.id??'';this.timer=.8+this.traits.reaction;}
    let destination:Point=target?.controller.state??arena.spawns[0]!;const item=racer.inventory.active;
    this.intent=item?'attack':'supply';
    if(!item){const supply=[...this.supplies].filter(p=>p.enabled&&p.cooldown<=.4).sort((a,b)=>Math.hypot(a.x-state.x,a.z-state.z)-Math.hypot(b.x-state.x,b.z-state.z))[0];if(supply)destination=supply;}
    else if(target)destination={x:target.controller.state.x+target.controller.state.vx*.22,z:target.controller.state.z+target.controller.state.vz*.22};
    const waypoint=arenaWaypoint(arena,state,destination);let dx=waypoint.x-state.x,dz=waypoint.z-state.z;
    for(const hazard of hazards){const hx=state.x-hazard.x,hz=state.z-hazard.z,d=Math.hypot(hx,hz);if(d>0&&d<7&&(hazard.x-state.x)*Math.sin(state.heading)+(hazard.z-state.z)*Math.cos(state.heading)>-1){const side=Math.sign(hx*Math.cos(state.heading)-hz*Math.sin(state.heading))||1;dx+=Math.cos(state.heading)*side*(7-d)*3+hx/d*(7-d);dz-=Math.sin(state.heading)*side*(7-d)*3-hz/d*(7-d);this.intent='avoid';}}
    for(const other of eligible){const ox=state.x-other.controller.state.x,oz=state.z-other.controller.state.z,d=Math.hypot(ox,oz);if(d>.01&&d<3){dx+=ox/d*(3-d)*1.5;dz+=oz/d*(3-d)*1.5;}}
    const desired=Math.atan2(dx,dz),error=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
    const gap=target?Math.hypot(target.controller.state.x-state.x,target.controller.state.z-state.z):Infinity;
    const aim=target?Math.atan2(Math.sin(Math.atan2(target.controller.state.x-state.x,target.controller.state.z-state.z)-state.heading),Math.cos(Math.atan2(target.controller.state.x-state.x,target.controller.state.z-state.z)-state.heading)):Math.PI;
    const clear=!!target&&arenaLineClear(arena,state,target.controller.state,.5);
    let useItem=false,rearward=false;
    if(item&&this.itemCooldown===0&&racer.inventory.drawRemaining===0&&state.spin===0){
      useItem=item==='shield'?(!!racer.warning||hazards.some(p=>Math.hypot(p.x-state.x,p.z-state.z)<8)):item==='invincibility'?gap<20:item==='mushroom'?Math.abs(error)<.35&&gap>10:item==='leader'?!!target:item==='homing'?clear&&gap<35: item==='explosive'?clear&&gap>5&&gap<18&&Math.abs(aim)<.3:item==='banana'?gap<8:clear&&gap<30&&Math.abs(aim)<.22;
      rearward=item==='banana'&&Math.abs(aim)>Math.PI/2;if(useItem)this.itemCooldown=this.traits.itemDelay;
    }
    const speed=Math.max(4,(14*this.traits.pace*racer.controller.speedScale)*Math.max(.3,1-Math.abs(error)*.5));
    if(this.stuck>1.2){this.intent='recover';return{throttle:false,brake:true,steering:-Math.sign(error||1),useItem,rearward,rescue:this.stuck>5};}
    return{throttle:state.speed<speed,brake:state.speed>speed+1,steering:Math.max(-1,Math.min(1,error*2.7)),useItem,rearward};
  }
}
