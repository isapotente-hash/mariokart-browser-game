import * as THREE from 'three';
import type { Race } from '../gameplay/Race';
import { createKart } from './kart';
import type { KartModel } from './kart';
import { config } from '../data/config';

export class RaceVisuals {
  readonly root = new THREE.Group();
  private readonly opponents: KartModel[] = [];
  private readonly pickups: THREE.Object3D[] = [];
  private readonly objects: THREE.Group[] = [];
  private readonly effects: THREE.Group[] = [];
  constructor() {
    const banana = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: '#ffcf43', roughness: 0.7 });
    const peel = new THREE.TorusGeometry(0.42, 0.12, 5, 9, Math.PI * 0.8);
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(peel, yellow); mesh.rotation.set(Math.PI / 2, 0, i * Math.PI * 2 / 3); mesh.position.y = 0.35; banana.add(mesh);
    }
    const shell = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), new THREE.MeshStandardMaterial({ color: '#55bb71' })); cap.scale.y = 0.6;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.12, 5, 12), new THREE.MeshStandardMaterial({ color: '#fff0ca' })); rim.rotation.x = Math.PI / 2;
    shell.add(cap, rim); shell.position.y = 0.4;
    for (let i = 0; i < config.items.poolSize; i++) {
      const object = new THREE.Group(); object.add(banana.clone(), shell.clone()); object.visible = false; this.objects.push(object); this.root.add(object);
    }
    const box = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), new THREE.MeshStandardMaterial({ color: '#a7dce8', emissive: '#397b88', emissiveIntensity: 0.35, metalness: 0.15, roughness: 0.3 }));
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), new THREE.MeshStandardMaterial({ color: '#ffcf43', metalness: 0.4, roughness: 0.45 })); coin.rotation.x = Math.PI / 2;
    for (let i = 0; i < 45; i++) {
      const pickup = (i < 15 ? box : coin).clone(); this.pickups.push(pickup); this.root.add(pickup);
    }
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const trail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.5, 5), new THREE.MeshBasicMaterial({ color: '#ffc24b' }));
      trail.rotation.x = -Math.PI / 2; trail.position.set(0, 0.4, -2.3);
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.23), new THREE.MeshBasicMaterial({ color: '#65c9ff' })); spark.position.set(-1, 0.3, -1);
      const other = spark.clone(); other.position.x = 1;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.06, 4, 20), new THREE.MeshBasicMaterial({ color: '#e5fbf4', transparent: true, opacity: 0.65 })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.15;
      group.add(trail, spark, other, halo); this.effects.push(group); this.root.add(group);
    }
  }
  sync(race: Race, alpha: number, visible: boolean): void {
    this.root.visible = visible;
    while (this.opponents.length < 7) {
      const racer = race.racers[this.opponents.length + 1]!;
      const model = createKart(racer.color); this.opponents.push(model); this.root.add(model.root);
    }
    for (let i = 0; i < race.racers.length; i++) {
      const racer = race.racers[i]!, state = racer.controller.state, previous = racer.previous;
      const x = THREE.MathUtils.lerp(previous.x, state.x, alpha), z = THREE.MathUtils.lerp(previous.z, state.z, alpha);
      const heading = THREE.MathUtils.lerp(previous.heading, state.heading, alpha);
      if (i > 0) {
        const model = this.opponents[i - 1]!;
        model.root.position.set(x, 0.09 + state.hop + (racer.rescueRemaining > 0 ? 1.5 : 0), z);
        model.root.rotation.y = heading + (state.spin > 0 ? (1 - state.spin / config.race.hitSpin) * Math.PI * 4 : 0);
        model.body.rotation.z = -racer.input.steering * Math.min(0.07, Math.abs(state.speed) * 0.003);
        for (const wheel of model.wheels) wheel.children.forEach((mesh) => { mesh.rotation.x = race.time * state.speed / 0.43; });
        for (const wheel of model.frontWheels) wheel.rotation.y = racer.input.steering * 0.35;
      }
      const effects = this.effects[i]!; effects.position.set(x, 0.1, z); effects.rotation.y = heading;
      effects.children[0]!.visible = state.boost > 0;
      for (let j = 1; j <= 2; j++) {
        const spark = effects.children[j] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
        spark.visible = state.driftStage > 0;
        spark.material.color.set(['#65c9ff', '#65c9ff', '#f2a33b', '#c781f5'][state.driftStage]!);
        spark.scale.setScalar(1 + state.driftStage * 0.3);
      }
      effects.children[3]!.visible = state.immunity > 0 || racer.rescueRemaining > 0;
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const model = this.pickups[i]!, pickup = race.items.pickups[i]!;
      model.visible = pickup.cooldown <= 0; model.position.set(pickup.x, pickup.kind === 'box' ? 1.25 : 0.95, pickup.z);
      model.rotation.y = race.time * 1.3;
      model.scale.setScalar(pickup.double ? 1.12 : 1);
    }
    for (let i = 0; i < this.objects.length; i++) {
      const model = this.objects[i]!, item = race.items.objects[i]!;
      model.visible = item.active; model.position.set(item.x, 0.1, item.z);
      model.children[0]!.visible = item.kind === 'banana'; model.children[1]!.visible = item.kind === 'shell';
      model.rotation.y = item.kind === 'shell' ? item.age * 7 : 0;
      model.scale.setScalar(item.kind === 'banana' && item.age < config.items.armTime ? 0.6 : 1);
    }
  }
}
