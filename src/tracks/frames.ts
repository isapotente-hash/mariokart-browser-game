import type { CourseSample, Vec3 } from '../data/types';

export function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}
export function cross(a: Vec3, b: Vec3): Vec3 { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
export function trackFrame(sample: Pick<CourseSample, 'tangent' | 'slope' | 'bank'>): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward = normalize({ ...sample.tangent, y: sample.slope });
  const flatRight = { x: sample.tangent.z, y: 0, z: -sample.tangent.x };
  const flatUp = normalize(cross(forward, flatRight));
  const c = Math.cos(sample.bank), s = Math.sin(sample.bank);
  return {
    forward,
    right: { x: flatRight.x * c + flatUp.x * s, y: flatUp.y * s, z: flatRight.z * c + flatUp.z * s },
    up: { x: flatUp.x * c - flatRight.x * s, y: flatUp.y * c, z: flatUp.z * c - flatRight.z * s },
  };
}
export function offsetSample(sample: CourseSample, offset: number, above = 0): Vec3 {
  const { right, up } = trackFrame(sample);
  return { x: sample.x + right.x * offset + up.x * above, y: sample.y + right.y * offset + up.y * above, z: sample.z + right.z * offset + up.z * above };
}
