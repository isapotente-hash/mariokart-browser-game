import type { CourseDefinition, CourseSample, Point, Pose } from '../data/types';

const controlPoints: Point[] = [
  { x: 0, z: 60 }, { x: 33, z: 60 }, { x: 53, z: 39 },
  { x: 50, z: 6 }, { x: 40, z: -20 }, { x: 43, z: -46 },
  { x: 20, z: -63 }, { x: -12, z: -62 }, { x: -39, z: -46 },
  { x: -49, z: -14 }, { x: -46, z: 24 }, { x: -29, z: 52 },
];

function spline(a: number, b: number, c: number, d: number, t: number): number {
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}

export function createCourse(short = false): CourseDefinition {
  const scale = short ? 0.35 : 1;
  const points: Point[] = [];
  for (let i = 0; i < 360; i++) {
    const u = i / 360 * controlPoints.length;
    const index = Math.floor(u);
    const at = (offset: number) => controlPoints[(index + offset + controlPoints.length) % controlPoints.length]!;
    points.push({
      x: spline(at(-1).x, at(0).x, at(1).x, at(2).x, u - index) * scale,
      z: spline(at(-1).z, at(0).z, at(1).z, at(2).z, u - index) * scale,
    });
  }
  let length = 0;
  const samples: CourseSample[] = points.map((point, i) => {
    if (i > 0) length += Math.hypot(point.x - points[i - 1]!.x, point.z - points[i - 1]!.z);
    const next = points[(i + 1) % points.length]!;
    const previous = points[(i - 1 + points.length) % points.length]!;
    const distance = Math.hypot(next.x - previous.x, next.z - previous.z);
    return { ...point, distance: length, tangent: { x: (next.x - previous.x) / distance, z: (next.z - previous.z) / distance } };
  });
  length += Math.hypot(points[0]!.x - points.at(-1)!.x, points[0]!.z - points.at(-1)!.z);
  const width = short ? 6 : 12;
  const checkpoints = Array.from({ length: 12 }, (_, i) => {
    const p = samples[i * 30]!;
    return { x: p.x, z: p.z, heading: Math.atan2(p.tangent.x, p.tangent.z), halfWidth: width / 2 + 2.2 };
  });
  const spawn = samples[short ? 25 : 22]!;
  return {
    id: short ? 'pocket-loop' : 'garden-circuit',
    name: short ? 'Pocket Loop' : 'Garden Circuit',
    description: short ? 'A compact loop for quick test laps.' : 'Open skies. Sweeping turns. Your first racing line.',
    width, length, samples, checkpoints,
    spawn: { x: spawn.x, z: spawn.z, heading: Math.atan2(spawn.tangent.x, spawn.tangent.z) },
  };
}

export interface TrackQuery extends Point {
  tangent: Point;
  distance: number;
  offset: number;
  normal: Point;
  progress: number;
}

export function sampleTrack(course: CourseDefinition, point: Point): TrackQuery {
  let bestDistance = Infinity;
  let result: TrackQuery | undefined;
  for (let i = 0; i < course.samples.length; i++) {
    const a = course.samples[i]!;
    const b = course.samples[(i + 1) % course.samples.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segmentLength2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / segmentLength2));
    const x = a.x + t * dx;
    const z = a.z + t * dz;
    const d2 = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (d2 >= bestDistance) continue;
    bestDistance = d2;
    const segmentLength = Math.sqrt(segmentLength2);
    const tangent = { x: dx / segmentLength, z: dz / segmentLength };
    const normal = { x: tangent.z, z: -tangent.x };
    result = { x, z, tangent, normal, distance: Math.sqrt(d2), offset: (point.x - x) * normal.x + (point.z - z) * normal.z, progress: a.distance + t * segmentLength };
  }
  return result!;
}

export function poseAt(course: CourseDefinition, distance: number): Pose {
  const d = ((distance % course.length) + course.length) % course.length;
  let i = course.samples.findIndex((p) => p.distance > d) - 1;
  if (i < 0) i = course.samples.length - 1;
  const a = course.samples[i]!;
  const b = course.samples[(i + 1) % course.samples.length]!;
  const span = i === course.samples.length - 1 ? course.length - a.distance : b.distance - a.distance;
  const t = (d - a.distance) / span;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}
