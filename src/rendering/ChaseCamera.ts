import * as THREE from 'three';
import { config } from '../data/config';
import type { KartState } from '../data/types';

export class ChaseCamera {
  private look = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private target = new THREE.Vector3();
  constructor(readonly camera: THREE.PerspectiveCamera) {}

  update(kart: KartState, dt: number, menu: boolean, rearView: boolean, snap = false): void {
    const forwardX = Math.sin(kart.heading);
    const forwardZ = Math.cos(kart.heading);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const direction = rearView && !menu ? -1 : 1;
    const distance = menu ? 16 : config.camera.distance + Math.min(3, Math.abs(kart.speed) * 0.07);
    this.desired.set(kart.x - forwardX * distance * direction + (menu ? rightX * 11 : 0), menu ? 11 : config.camera.height, kart.z - forwardZ * distance * direction + (menu ? rightZ * 11 : 0));
    this.target.set(kart.x + forwardX * (menu ? 2 : config.camera.lookAhead) * direction - (menu ? rightX * 5 : 0), 0.9, kart.z + forwardZ * (menu ? 2 : config.camera.lookAhead) * direction - (menu ? rightZ * 5 : 0));
    const blend = snap ? 1 : 1 - Math.exp(-config.camera.smoothing * dt);
    this.camera.position.lerp(this.desired, blend);
    // Terrain is flat in this milestone; this floor prevents ground penetration.
    this.camera.position.y = Math.max(2.2, this.camera.position.y);
    this.look.lerp(this.target, blend);
    this.camera.lookAt(this.look);
    const fov = menu ? 43 : 54 + Math.min(8, Math.abs(kart.speed) * 0.26);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * blend;
      this.camera.updateProjectionMatrix();
    }
  }
}
