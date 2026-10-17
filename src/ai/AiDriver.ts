import { seededRandom } from '../core/random';
import type { CourseDefinition, DrivingInput, Point } from '../data/types';
import { config } from '../data/config';
import type { Difficulty } from '../data/options';
import type { Racer } from '../gameplay/Racer';
import { poseAt, sampleTrack } from '../tracks/course';

const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class AiDriver {
  readonly traits: { pace: number; reaction: number; aggression: number; lane: number; itemDelay: number; driftConfidence: number };
  behavior: 'normal' | 'overtaking' | 'recovering' | 'airborne' = 'normal';
  private reactionTimer = 0;
  private laneTimer = 0;
  private lane = 0;
  private targetLane = 0;
  private itemTimer = 0;
  private driftTimer = 0;
  private driftCooldown = 0;
  private noProgress = 0;
  private bestDistance = -Infinity;
  private cached: DrivingInput = { throttle: true, brake: false, steering: 0 };
  constructor(seed: number, difficulty: Difficulty = 'normal') {
    const random = seededRandom(seed);
    this.traits = { pace: 0.9 + random() * 0.15, reaction: 0.08 + random() * 0.07, aggression: random(), lane: (random() - 0.5) * 0.7, itemDelay: 1.2 + random() * 1.2, driftConfidence: 0.5 + random() * 0.5 };
    this.traits.pace *= difficulty === 'easy' ? 0.82 : difficulty === 'hard' ? 1.09 : 1;
    this.traits.reaction *= difficulty === 'easy' ? 1.5 : difficulty === 'hard' ? 0.7 : 1;
    this.itemTimer = this.traits.itemDelay;
  }
  read(course: CourseDefinition, racer: Racer, opponents: readonly Racer[], dt: number, hazards: readonly Point[] = []): DrivingInput {
    const state = racer.controller.state;
    this.itemTimer -= dt; this.laneTimer -= dt; this.driftCooldown -= dt;
    if (racer.distance > this.bestDistance + 0.7) { this.noProgress = 0; this.bestDistance = racer.distance; }
    else this.noProgress += dt;
    if (this.noProgress > 6) {
      this.noProgress = 0; this.bestDistance = -Infinity; this.behavior = 'recovering';
      return { throttle: false, brake: false, steering: 0, rescue: true };
    }
    const useItem = racer.inventory.active !== null && racer.inventory.drawRemaining === 0 && this.itemTimer <= 0 && state.spin === 0;
    if (useItem) this.itemTimer = this.traits.itemDelay;
    this.reactionTimer -= dt;
    if (this.reactionTimer <= 0) {
      this.reactionTimer = this.traits.reaction;
      const road = sampleTrack(course, state);
      const compact = course.compact;
      const lookAhead = (compact ? 1.8 : 3) + Math.abs(state.speed) * (compact ? 0.34 : 0.44);
      const stoppingDistance = state.speed ** 2 / (2 * config.kart.braking);
      const hazard = hazards.find((point) => {
        const dx = point.x - state.x, dz = point.z - state.z;
        const along = dx * road.tangent.x + dz * road.tangent.z;
        return along > 0 && along < lookAhead + stoppingDistance && Math.abs(dx * road.normal.x + dz * road.normal.z) < 1.8;
      });
      if (this.laneTimer <= 0) {
        const blocked = opponents.some((other) => {
          if (other.id === racer.id || other.finishTime !== null) return false;
          const dx = other.controller.state.x - state.x, dz = other.controller.state.z - state.z;
          const forward = dx * road.tangent.x + dz * road.tangent.z;
          const side = Math.abs(dx * road.normal.x + dz * road.normal.z);
          return forward > 0 && forward < lookAhead + 3 && side < 2.1;
        });
        this.behavior = blocked ? 'overtaking' : 'normal';
        this.targetLane = blocked ? (road.offset > 0 ? -1 : 1) * Math.min(2.2, course.width * 0.24) : this.traits.lane;
        this.laneTimer = 2.2 + this.traits.aggression;
      }
      if (hazard) {
        const side = (hazard.x - state.x) * road.normal.x + (hazard.z - state.z) * road.normal.z;
        this.targetLane = (side > 0 ? -1 : 1) * Math.min(2.2, course.width * 0.24);
        this.behavior = 'overtaking';
      }
      this.lane += Math.max(-0.2, Math.min(0.2, this.targetLane - this.lane));
      const target = poseAt(course, road.progress + lookAhead, road.route);
      const targetFrame = sampleTrack(course, target);
      target.x += targetFrame.right.x * this.lane; target.z += targetFrame.right.z * this.lane;
      const error = angleDifference(Math.atan2(target.x - state.x, target.z - state.z), state.heading);
      const near = poseAt(course, road.progress + lookAhead * 0.5);
      const far = poseAt(course, road.progress + lookAhead + (compact ? 3 : 7));
      const curvature = Math.abs(angleDifference(far.heading, near.heading)) / (lookAhead * 0.5 + (compact ? 3 : 7));
      // Maximum yaw speed bounds the corner speed; look farther ahead to brake in time.
      let targetSpeed = Math.min((compact ? 8.5 : 21) * this.traits.pace * racer.controller.speedScale * racer.controller.stats.speed, 0.95 / Math.max(0.01, curvature));
      if (Math.abs(error) > 0.6) targetSpeed *= 0.6;
      if (state.surface === 'grass') targetSpeed = Math.min(targetSpeed, 10);
      if (hazard) targetSpeed *= 0.85;
      if (Math.abs(error) > 0.17 && Math.abs(error) < 0.45 && state.speed > 7 && this.driftCooldown <= 0 && this.behavior === 'normal') {
        this.driftTimer = 0.85; this.driftCooldown = 5 / this.traits.driftConfidence;
      }
      this.cached = { throttle: state.speed < targetSpeed, brake: state.speed > targetSpeed + 0.6, steering: Math.max(-1, Math.min(1, error * 3.6)) };
    }
    this.driftTimer = Math.max(0, this.driftTimer - dt);
    const airborne = ['gliding', 'jumping', 'falling'].includes(state.traversal);
    if (airborne) this.behavior = 'airborne';
    let pitch = 0;
    if (state.traversal === 'gliding') {
      const road = sampleTrack(course, state);
      const zone = course.launches.find((entry) => entry.glider)!;
      const landing = poseAt(course, zone.landing);
      const remaining = Math.max(course.compact ? 2 : 10, zone.landing - road.progress);
      const desired = ((landing.y ?? 0) - state.y) / Math.max(0.5, remaining / Math.max(4, state.speed));
      pitch = Math.max(-1, Math.min(1, (desired - state.vy) * 0.14));
    }
    return { ...this.cached, pitch, drift: !airborne && this.driftTimer > 0, useItem, rearward: racer.inventory.active === 'banana' };
  }
}
