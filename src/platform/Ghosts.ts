import type { KartState } from '../data/types';
import type { RaceOptions } from '../data/options';

export const physicsVersion = 'release-3.0';
export interface GhostFrame { time: number; x: number; y: number; z: number; heading: number; upX: number; upY: number; upZ: number; pitch: number; gliding: boolean;forward?:{x:number;y:number;z:number} }
export interface GhostRecord { key: string; time: number; physicsVersion: string; trackVersion: string; frames: GhostFrame[] }
export function ghostKey(options: RaceOptions, trackVersion: string): string {
  const build = options.builds[0];
  return [options.course, trackVersion, physicsVersion, options.speed, options.mirrored ? 'mirror' : 'normal', build.driver, build.chassis, build.tyres, build.glider, options.autoAccelerate ? 'auto' : 'manual', options.steeringAssist ? 'assist' : 'free'].join('|');
}
export function validateGhost(value: unknown, key: string, trackVersion: string): GhostRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as GhostRecord;
  if (record.key !== key || record.trackVersion !== trackVersion || record.physicsVersion !== physicsVersion || !Number.isFinite(record.time) || record.time < 1 || record.time > 3600 || !Array.isArray(record.frames) || record.frames.length < 2 || record.frames.length > 12000) return null;
  let previous = -1;
  for (const frame of record.frames) {
    if(!frame||typeof frame!=='object'||Array.isArray(frame)||frame.time<0)return null;
    if(frame.forward&&![frame.forward.x,frame.forward.y,frame.forward.z].every(Number.isFinite))return null;
    if (![frame.time, frame.x, frame.y, frame.z, frame.heading, frame.upX, frame.upY, frame.upZ, frame.pitch].every(Number.isFinite) || frame.time <= previous || frame.time > record.time + 0.2 || Math.abs(frame.x) > 10000 || Math.abs(frame.y) > 10000 || Math.abs(frame.z) > 10000 || typeof frame.gliding !== 'boolean') return null;
    previous = frame.time;
  }
  return record;
}
export class GhostRecorder {
  readonly frames: GhostFrame[] = [];
  sample(time: number, state: KartState & { y?: number; pitch?: number; up?: { x: number; y: number; z: number }; traversal?: string }): void {
    if (this.frames.length >= 12000 || time - (this.frames.at(-1)?.time ?? -1) < 0.099) return;
    const up = state.up ?? { x: 0, y: 1, z: 0 };
    this.frames.push({ time, x: state.x, y: state.y ?? 0, z: state.z, heading: state.heading, upX: up.x, upY: up.y, upZ: up.z, pitch: state.pitch ?? 0, gliding: state.traversal === 'gliding',...(state.forward?{forward:{...state.forward}}:{}) });
  }
  finish(key: string, trackVersion: string, time: number, state?: KartState): GhostRecord {
    const frames = this.frames.filter((frame) => frame.time <= time);
    if (state && time > (frames.at(-1)?.time ?? -1)) frames.push({ time, x: state.x, y: state.y, z: state.z, heading: state.heading, upX: state.up.x, upY: state.up.y, upZ: state.up.z, pitch: state.pitch, gliding: state.traversal === 'gliding',...(state.forward?{forward:{...state.forward}}:{}) });
    return { key, trackVersion, physicsVersion, time, frames };
  }
}
export function sampleGhost(ghost: GhostRecord, time: number): GhostFrame | null {
  if (time > ghost.time || ghost.frames.length < 2) return null;
  let low = 0, high = ghost.frames.length - 1;
  while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (ghost.frames[mid]!.time <= time) low = mid; else high = mid; }
  const a = ghost.frames[low]!, b = ghost.frames[high]!;
  const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
  const blend = (x: number, y: number) => x + (y - x) * t;
  return { ...a, time, x: blend(a.x, b.x), y: blend(a.y, b.y), z: blend(a.z, b.z), heading: a.heading + Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)) * t, upX: blend(a.upX, b.upX), upY: blend(a.upY, b.upY), upZ: blend(a.upZ, b.upZ), pitch: blend(a.pitch, b.pitch),...(a.forward&&b.forward?{forward:{x:blend(a.forward.x,b.forward.x),y:blend(a.forward.y,b.forward.y),z:blend(a.forward.z,b.forward.z)}}:{}) };
}
export class GhostStore {
  private memory = new Map<string, GhostRecord>();
  status = 'Ghosts are stored locally on this device.';
  private async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('pocket-circuit-ghosts', 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('ghosts')) request.result.createObjectStore('ghosts', { keyPath: 'key' }); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error('Ghost database is blocked'));
      } catch (error) { reject(error); }
    });
  }
  async put(record: GhostRecord): Promise<boolean> {
    this.memory.set(record.key, record);
    let database: IDBDatabase | null = null;
    try {
      database = await this.database();
      await new Promise<void>((resolve, reject) => {
        const transaction = database!.transaction('ghosts', 'readwrite'); transaction.objectStore('ghosts').put(record);
        transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
      });
      this.status = 'Ghost saved locally to this device.'; return true;
    } catch { this.status = 'Ghost storage denied; this ghost is available in this session only.'; return false; }
    finally { database?.close(); }
  }
  async get(key: string, trackVersion: string): Promise<GhostRecord | null> {
    let database: IDBDatabase | null = null;
    try {
      database = await this.database();
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = database!.transaction('ghosts').objectStore('ghosts').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      return validateGhost(value, key, trackVersion) ?? this.memory.get(key) ?? null;
    } catch { return this.memory.get(key) ?? null; }
    finally { database?.close(); }
  }
  async clear(): Promise<void> {
    this.memory.clear(); let database: IDBDatabase | null = null;
    try { database = await this.database(); await new Promise<void>((resolve, reject) => { const transaction = database!.transaction('ghosts', 'readwrite'); transaction.objectStore('ghosts').clear(); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); }
    catch { this.status = 'Ghost storage is unavailable.'; } finally { database?.close(); }
  }
}
