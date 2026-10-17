import * as THREE from 'three';
import type { CourseDefinition } from '../data/types';
import { seededRandom } from '../core/random';
import { sampleTrack } from '../tracks/course';

function strip(course: CourseDefinition, from: number, to: number, y: number, color: string, alternate?: string): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < course.samples.length; i++) {
    const a = course.samples[i]!;
    const b = course.samples[(i + 1) % course.samples.length]!;
    const p = (sample: typeof a, offset: number) => [sample.x + sample.tangent.z * offset, y, sample.z - sample.tangent.x * offset];
    positions.push(...p(a, from), ...p(b, from), ...p(b, to), ...p(a, from), ...p(b, to), ...p(a, to));
    const c = new THREE.Color(alternate && Math.floor(i / 3) % 2 ? alternate : color);
    for (let v = 0; v < 6; v++) colors.push(c.r, c.g, c.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

export function createCourseScene(course: CourseDefinition): THREE.Group {
  const root = new THREE.Group();
  const half = course.width / 2;
  root.add(strip(course, -half - 2.7, half + 2.7, 0.015, '#b2c97b'));
  root.add(strip(course, -half, half, 0.05, '#546762'));
  for (const side of [-1, 1]) {
    root.add(strip(course, side * half, side * (half + 0.65), 0.07, '#f9ecd4', '#e27653'));
    root.add(strip(course, side * (half - 0.3), side * (half - 0.16), 0.075, '#e1e6ce'));
    root.add(strip(course, side * (half + 2.5), side * (half + 2.7), 0.5, '#efcb8e', '#f7e7c8'));
  }
  const white = new THREE.MeshStandardMaterial({ color: '#f3e9cf', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#29463f', roughness: 0.8 });
  const orange = new THREE.MeshStandardMaterial({ color: '#f0794f', roughness: 0.8 });
  const start = course.samples[0]!;
  const gate = new THREE.Group(); gate.position.set(start.x, 0.08, start.z); gate.rotation.y = Math.atan2(start.tangent.x, start.tangent.z);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) {
    const square = new THREE.Mesh(new THREE.BoxGeometry(course.width / 12, 0.02, 0.6), (i + row) % 2 ? dark : white);
    square.position.set(-half + (i + 0.5) * course.width / 12, 0, row * 0.6); gate.add(square);
  }
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 6, 8), orange);
    pole.position.set(side * (half + 1.1), 3, 0); pole.castShadow = true; gate.add(pole);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(course.width + 2.6, 0.85, 0.5), dark);
  arch.position.y = 6; gate.add(arch);
  for (let i = 0; i < 15; i++) {
    const square = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.52), i % 2 ? white : orange);
    square.position.set((i - 7) * (course.width + 2) / 15, 6, 0); gate.add(square);
  }
  root.add(gate);

  const random = seededRandom(4782);
  const foliageColors = ['#397a50', '#569052', '#7b9c52'];
  const trunkGeometry = new THREE.CylinderGeometry(0.23, 0.36, 2.7, 6);
  const crownGeometry = new THREE.IcosahedronGeometry(2.3, 1);
  const trees = 100;
  const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: '#886947' }), trees);
  const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshStandardMaterial({ roughness: 1 }), trees);
  const dummy = new THREE.Object3D();
  const radius = course.id === 'pocket-loop' ? 45 : 100;
  let count = 0;
  for (let attempt = 0; count < trees && attempt < 1500; attempt++) {
    const x = (random() - 0.5) * radius * 2;
    const z = (random() - 0.5) * radius * 2;
    if (sampleTrack(course, { x, z }).distance < half + 6 || Math.hypot(x - course.spawn.x, z - course.spawn.z) < 15) continue;
    const scale = 0.65 + random() * 0.8;
    dummy.position.set(x, 1.35 * scale, z); dummy.scale.setScalar(scale); dummy.updateMatrix(); trunks.setMatrixAt(count, dummy.matrix);
    dummy.position.y = 3.7 * scale; dummy.scale.set(scale, scale * (1.1 + random() * 0.3), scale); dummy.updateMatrix(); crowns.setMatrixAt(count, dummy.matrix);
    crowns.setColorAt(count, new THREE.Color(foliageColors[count % foliageColors.length]!));
    count++;
  }
  trunks.count = count; crowns.count = count; trunks.castShadow = true; crowns.castShadow = true; root.add(trunks, crowns);
  // Distant landmarks and clouds keep the road itself visually quiet.
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(30 + random() * 20, 30 + random() * 30, 5), new THREE.MeshStandardMaterial({ color: i % 2 ? '#9cb79c' : '#b3c8a8', flatShading: true }));
    mountain.position.set(Math.sin(angle) * 185, 11, Math.cos(angle) * 185); root.add(mountain);
  }
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#f9f4dc' });
  const cloudGeometry = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 15; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(cloudGeometry, cloudMaterial); puff.position.set(j * 4, j === 1 ? 1.2 : 0, 0); puff.scale.set(4.5, 2.1 + random(), 2.8); cloud.add(puff);
    }
    cloud.position.set((random() - 0.5) * 350, 37 + random() * 18, (random() - 0.5) * 350); root.add(cloud);
  }
  // Small spectator stand, all original procedural geometry.
  const stand = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 1.8), i % 2 ? white : orange);
    step.position.set(0, 0.5 + i * 0.7, i * -1.4); stand.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 7), dark); roof.position.set(0, 5, -1.5); stand.add(roof);
  for (const x of [-8, 8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), white); pole.position.set(x, 2.5, -2); stand.add(pole);
  }
  stand.position.set(start.x - start.tangent.z * (half + 9), 0, start.z + start.tangent.x * (half + 9));
  stand.rotation.y = gate.rotation.y; root.add(stand);
  return root;
}
