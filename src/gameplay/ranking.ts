import type { CourseDefinition } from '../data/types';
import type { Racer } from './Racer';
import { sampleTrack } from '../tracks/course';

export function validatedDistance(course: CourseDefinition, racer: Racer): number {
  const physical = sampleTrack(course, racer.controller.state).progress;
  if (!racer.progress.started) return physical > course.length / 2 ? physical - course.length : -course.length;
  const lastIndex = (racer.progress.nextCheckpoint + course.checkpoints.length - 1) % course.checkpoints.length;
  const last = course.checkpoints[lastIndex]!.distance??course.samples[lastIndex * 30]!.distance;
  const next = racer.progress.nextCheckpoint === 0 ? course.length : course.checkpoints[racer.progress.nextCheckpoint]!.distance??course.samples[racer.progress.nextCheckpoint * 30]!.distance;
  let delta = (physical - last + course.length) % course.length;
  if (delta > course.length / 2) delta = 0;
  return racer.progress.laps * course.length + last + Math.min(next - last, delta);
}

export function rankRacers(racers: readonly Racer[]): Racer[] {
  return [...racers].sort((a, b) => {
    if (a.finishPlace !== null && b.finishPlace !== null) return a.finishPlace - b.finishPlace;
    if (a.finishPlace !== null) return -1;
    if (b.finishPlace !== null) return 1;
    return b.distance - a.distance || a.id.localeCompare(b.id);
  });
}
