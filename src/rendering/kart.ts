import * as THREE from 'three';

export interface KartModel { root: THREE.Group; body: THREE.Group; wheels: THREE.Group[]; frontWheels: THREE.Group[] }

export function createKart(color = '#ef6b43'): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.48 });
  const cream = new THREE.MeshStandardMaterial({ color: '#ffedcc', roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#253f3e', roughness: 0.8 });
  const teal = new THREE.MeshStandardMaterial({ color: '#277e77', roughness: 0.55 });
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; body.add(mesh); return mesh;
  };
  box(1.65, 0.37, 2.6, paint, 0, 0.55, 0);
  box(1.15, 0.25, 1, paint, 0, 0.8, 0.85);
  box(0.18, 0.27, 0.96, cream, 0, 0.82, 0.87);
  box(1.8, 0.17, 0.25, dark, 0, 0.47, 1.45);
  box(1.8, 0.17, 0.25, dark, 0, 0.47, -1.4);
  box(1, 0.6, 0.3, dark, 0, 1.04, -0.62);
  // Original little helmeted driver: a jacket, helmet and a dark visor.
  box(0.65, 0.62, 0.65, teal, 0, 1.12, -0.15);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), cream);
  helmet.position.set(0, 1.8, -0.11); helmet.castShadow = true; body.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.39, 16, 8, 0, Math.PI * 2, 0.8, 0.65), dark);
  visor.rotation.x = Math.PI / 2; visor.position.set(0, 1.83, 0.04); body.add(visor);
  box(0.13, 0.08, 0.56, paint, 0, 2.22, -0.12);
  box(0.16, 0.45, 0.16, dark, 0, 1, 0.5);
  const wheelGeometry = new THREE.CylinderGeometry(0.43, 0.43, 0.35, 12);
  const tyre = new THREE.MeshStandardMaterial({ color: '#203331', roughness: 1 });
  const hub = new THREE.MeshStandardMaterial({ color: '#f5d794', metalness: 0.25, roughness: 0.4 });
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  for (const x of [-1, 1]) for (const z of [-0.87, 0.87]) {
    const group = new THREE.Group(); group.position.set(x, 0.44, z);
    const mesh = new THREE.Mesh(wheelGeometry, tyre); mesh.rotation.z = Math.PI / 2; mesh.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.37, 12), hub); cap.rotation.z = Math.PI / 2;
    group.add(mesh, cap); root.add(group); wheels.push(group);
    if (z > 0) frontWheels.push(group);
  }
  return { root, body, wheels, frontWheels };
}
