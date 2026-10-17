import * as THREE from 'three';
import type { CourseDefinition, KartState } from '../data/types';
import { createKart } from './kart';
import { createCourseScene } from './courseScene';
import { ChaseCamera } from './ChaseCamera';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(54, 1, 0.1, 360);
  private readonly chase = new ChaseCamera(this.camera);
  private readonly kart = createKart();
  private course: THREE.Group;
  private wheelAngle = 0;

  constructor(container: HTMLElement, course: CourseDefinition) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#c4dfd3');
    this.renderer.domElement.setAttribute('aria-label', '3D kart racing course');
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#c4dfd3');
    this.scene.fog = new THREE.Fog('#c4dfd3', 110, 295);
    this.scene.add(new THREE.HemisphereLight('#fff8de', '#718f60', 2.5));
    const sun = new THREE.DirectionalLight('#fff0cb', 3.1); sun.position.set(45, 85, 30);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 190 });
    sun.shadow.normalBias = 0.05; sun.shadow.bias = -0.0004; this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: '#92b975', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    this.course = createCourseScene(course); this.scene.add(this.course, this.kart.root);
    this.resize();
  }
  setCourse(course: CourseDefinition): void {
    this.scene.remove(this.course); this.disposeGroup(this.course);
    this.course = createCourseScene(course); this.scene.add(this.course);
  }
  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  draw(state: KartState, dt: number, menu: boolean, rear: boolean, steering: number, snap = false): void {
    this.kart.root.position.set(state.x, 0.09, state.z); this.kart.root.rotation.y = state.heading;
    this.kart.body.rotation.z = THREE.MathUtils.lerp(this.kart.body.rotation.z, -steering * Math.min(0.07, Math.abs(state.speed) * 0.003), 0.1);
    this.wheelAngle += state.speed * dt / 0.43;
    for (const wheel of this.kart.wheels) wheel.children.forEach((mesh) => { mesh.rotation.x = this.wheelAngle; });
    for (const wheel of this.kart.frontWheels) wheel.rotation.y = steering * 0.35;
    this.chase.update(state, dt, menu, rear, snap);
    this.renderer.render(this.scene, this.camera);
  }
  private disposeGroup(group: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
  }
  dispose(): void {
    this.disposeGroup(this.scene); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
