import { config } from '../data/config';
import { calculateStats, gliders } from '../data/content';
import type { VehicleStats } from '../data/content';
import { defaultSettings, speedProfiles } from '../data/options';
import type { SpeedClass, VehicleBuild } from '../data/options';
import type { CourseDefinition, DrivingInput, KartState, Pose } from '../data/types';
import { sampleTrack } from '../tracks/course';
import { cross } from '../tracks/frames';
import { surfaceForward, TraversalSystem } from './TraversalSystem';

export class KartController {
  readonly state: KartState;
  readonly stats: VehicleStats;
  readonly speedScale: number;
  readonly build: VehicleBuild;
  private readonly traversal = new TraversalSystem();
  private reverseWait = 0;
  private driftHeld = false;
  private hopRemaining = 0;
  coinBonus = 0;
  autoAccelerate = false;
  steeringAssist = false;
  constructor(private readonly course: CourseDefinition, pose: Pose = course.spawn, build = defaultSettings().builds[0], readonly speedClass: SpeedClass = '150cc') {
    this.build = {...build}; this.stats = calculateStats(build); this.speedScale = speedProfiles[speedClass].speed;
    const road = sampleTrack(course, pose);
    this.state = { ...pose, y: pose.y ?? road.height, vy: 0, up: road.up, gravity: {x:-road.up.x*9.8,y:-road.up.y*9.8,z:-road.up.z*9.8}, traversal: road.traversal, pitch:0, shield:0, invincible:0,trickReady:0,
      vx: 0, vz: 0, speed: 0, surface: 'road', boost: 0, spin: 0, immunity: 0, hop: 0, driftCharge: 0, driftSide: 0, driftStage: 0 };
  }
  reset(pose: Pose = this.course.spawn): void {
    const road = sampleTrack(this.course, pose);
    Object.assign(this.state, pose, { y: pose.y ?? road.height, vy:0, up:road.up, gravity:{x:-road.up.x*9.8,y:-road.up.y*9.8,z:-road.up.z*9.8}, traversal:road.traversal, pitch:0, shield:0,invincible:0,trickReady:0,
      vx: 0, vz: 0, speed: 0, surface: 'road', boost: 0, spin: 0, immunity: 0, hop: 0 });
    this.cancelDrift(); this.reverseWait = 0; this.driftHeld = false; this.hopRemaining = 0; this.traversal.reset();
  }
  cancelDrift(): void { this.state.driftCharge = 0; this.state.driftSide = 0; this.state.driftStage = 0; }
  boost(duration: number): void { this.state.boost = Math.min(3, Math.max(this.state.boost, duration)); }
  hit(): boolean {
    if (this.state.immunity > 0 || this.state.shield > 0 || this.state.invincible > 0) return false;
    this.state.spin = config.race.hitSpin; this.state.immunity = config.race.hitImmunity;
    this.state.vx *= 0.28; this.state.vy *= 0.28; this.state.vz *= 0.28; this.state.boost = 0; this.cancelDrift(); return true;
  }
  update(source: DrivingInput, dt: number): void {
    const s = this.state, k = config.kart;
    s.immunity = Math.max(0, s.immunity - dt); s.boost = Math.max(0, s.boost - dt); s.spin = Math.max(0, s.spin - dt);
    s.shield = Math.max(0,s.shield-dt); s.invincible = Math.max(0,s.invincible-dt);
    const input = {...source, throttle:source.throttle || this.autoAccelerate};
    const lift = gliders.find((part)=>part.id===this.build.glider)?.lift ?? 1;
    const maxSpeed = k.maxSpeed*this.stats.speed*this.speedScale;
    if (this.traversal.airborne) {
      this.cancelDrift();
      if(this.traversal.update(this.course,s,s.spin>0?{...input,steering:0,pitch:0}:input,dt,lift,maxSpeed*1.2))this.boost(1);
      return;
    }
    const road = sampleTrack(this.course, s);
    this.traversal.align(s,road,dt);
    s.surface = road.distance > road.width / 2 || road.surface==='grass' ? 'grass' : road.traversal==='underwater'?'underwater':road.traversal==='anti-gravity'?'anti-gravity':road.surface==='boost'?'boost':'road';
    const water = s.surface==='underwater';
    let forward = surfaceForward(s.heading,s.up);
    let speed = s.vx*forward.x+s.vy*forward.y+s.vz*forward.z;
    const held = !!input.drift;
    if (held && !this.driftHeld && s.spin === 0) {
      this.hopRemaining = config.drift.hopTime;
      if (speed >= config.drift.minimumSpeed && Math.abs(input.steering) > 0.1) s.driftSide = Math.sign(input.steering);
    }
    if (s.driftSide && held && speed >= config.drift.minimumSpeed && s.surface !== 'grass' && s.spin === 0) {
      s.driftCharge += dt*this.stats.drift;
      s.driftStage = config.drift.thresholds.filter((threshold) => s.driftCharge >= threshold).length;
    } else if (s.driftSide) {
      if (!held && s.driftStage > 0) this.boost(config.drift.durations[s.driftStage - 1]!);
      this.cancelDrift();
    }
    this.driftHeld = held; this.hopRemaining = Math.max(0, this.hopRemaining - dt);
    s.hop = Math.sin(this.hopRemaining / config.drift.hopTime * Math.PI) * 0.6;
    const boosted = s.boost > 0;
    const cap = ((s.surface === 'grass' && !boosted) ? k.offRoadSpeed : maxSpeed*(water?.84:1)) * (1 + this.coinBonus) + (boosted ? 8 : 0) + (s.invincible>0?3:0);
    const acceleration=k.acceleration*this.stats.acceleration*speedProfiles[this.speedClass].acceleration*(water?.82:1);
    let force = 0;
    if (s.spin > 0) { this.cancelDrift(); speed *= Math.exp(-4 * dt); }
    else if (input.brake) {
      if (speed > 0.2) { force = -k.braking; this.reverseWait = 0; }
      else { this.reverseWait += dt; if (this.reverseWait >= k.reverseDelay) force = -acceleration * 0.7; }
    } else {
      this.reverseWait = 0;
      if (input.throttle) force = speed < -0.2 ? k.braking : acceleration * (1 - 0.2 * Math.max(0, speed) / maxSpeed);
    }
    if (boosted && s.spin === 0) force += 18;
    if (s.invincible>0 && s.spin===0)force+=3;
    speed += (force - speed * k.drag*(water?2.1:1)) * dt;
    if (input.brake && force === -k.braking && speed < 0) speed = 0;
    speed = Math.max(-k.reverseSpeed, Math.min(cap, speed));
    if (!input.throttle && !input.brake && !boosted && Math.abs(speed) < 0.08) speed = 0;
    const moving = Math.min(1, Math.abs(speed) / 4);
    const steering = k.steering * this.stats.handling * (1 - 0.35 * Math.min(1, Math.abs(speed) / maxSpeed));
    let turn = s.driftSide ? s.driftSide * 0.18 + input.steering * 0.82 : input.steering;
    if(this.steeringAssist && Math.abs(road.offset)>road.width*.32){
      const desired=Math.atan2(road.tangent.x,road.tangent.z)-Math.sign(road.offset)*.3;
      const error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
      turn=Math.max(-1,Math.min(1,turn+Math.max(-.4,Math.min(.4,error))));
    }
    const oldRight=cross(s.up,forward);
    const sideSpeed=(s.vx*oldRight.x+s.vy*oldRight.y+s.vz*oldRight.z)*Math.exp(-(s.driftSide?6:k.grip)*this.stats.grip*(water?.72:1)*dt);
    if (s.spin === 0) s.heading += turn * steering * moving * Math.sign(speed) * dt;
    forward=surfaceForward(s.heading,s.up);const right=cross(s.up,forward);
    s.vx=forward.x*speed+right.x*sideSpeed;s.vy=forward.y*speed+right.y*sideSpeed;s.vz=forward.z*speed+right.z*sideSpeed;
    s.x+=s.vx*dt;s.z+=s.vz*dt;
    const contact=sampleTrack(this.course,s);
    const boundary=contact.width/2+2.4-k.radius;
    if(!this.course.exposed && contact.distance>boundary){
      const sign=Math.sign(contact.offset)||1, nx=contact.normal.x*sign,nz=contact.normal.z*sign;
      const horizontal=boundary*Math.cos(contact.bank);
      s.x=contact.x+nx*horizontal;s.z=contact.z+nz*horizontal;
      const outward=Math.max(0,s.vx*nx+s.vz*nz);
      s.vx=(s.vx-nx*outward)*.94;s.vz=(s.vz-nz*outward)*.94;
      if(outward>8)this.cancelDrift();
    }
    s.speed=s.vx*forward.x+s.vy*forward.y+s.vz*forward.z;
    if(this.traversal.update(this.course,s,input,dt,lift,maxSpeed*1.2))this.boost(1);
    if(![s.x,s.y,s.z,s.vx,s.vy,s.vz,s.heading].every(Number.isFinite))this.reset();
  }
}
