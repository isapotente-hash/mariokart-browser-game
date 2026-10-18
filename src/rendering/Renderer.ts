import * as THREE from 'three';
import type { CourseDefinition, KartState } from '../data/types';
import { createKart } from './kart';
import { createCourseScene } from './courseScene';
import { ChaseCamera } from './ChaseCamera';
import { RaceVisuals } from './RaceVisuals';
import type { Race } from '../gameplay/Race';
import { defaultSettings,qualityProfiles } from '../data/options';
import type { Settings,VehicleBuild } from '../data/options';
import { disposeGroup,orient } from './resources';
import { sampleGhost } from '../platform/Ghosts';
import type { GhostRecord } from '../platform/Ghosts';
import {disposeImportedCourse} from './importedCourse';

export interface Viewport {x:number;top:number;width:number;height:number}
export function computeViewports(width:number,height:number,players:number,layout:Settings['split']='auto'):Viewport[]{
  if(players<2)return[{x:0,top:0,width,height}];
  const side=layout==='side'||(layout==='auto'&&width/height>=1.35);
  if(side){const half=Math.floor(width/2);return[{x:0,top:0,width:half,height},{x:half,top:0,width:width-half,height}];}
  const half=Math.floor(height/2);return[{x:0,top:0,width,height:half},{x:0,top:half,width,height:height-half}];
}
export class Renderer {
  readonly renderer:THREE.WebGLRenderer;
  private readonly scene=new THREE.Scene();
  private readonly cameras=[new THREE.PerspectiveCamera(54,1,.25,480),new THREE.PerspectiveCamera(54,1,.25,480)];
  private readonly chases=this.cameras.map((camera)=>new ChaseCamera(camera));
  private menuModel=createKart();private menuKey='';
  private readonly raceVisuals=new RaceVisuals();
  private course:THREE.Group;private courseData:CourseDefinition;private settings:Settings=defaultSettings();
  private ghost:GhostRecord|null=null;private blockers:THREE.Object3D[]=[];
  private readonly size=new THREE.Vector2();
  private readonly sun=new THREE.DirectionalLight('#fff0cb',3.1);
  private readonly ambient=new THREE.HemisphereLight('#fff8de','#718f60',2.5);
  private readonly ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:'#92b975',roughness:1}));
  constructor(container:HTMLElement,course:CourseDefinition){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate=false;this.renderer.domElement.setAttribute('aria-label','3D kart racing course');container.append(this.renderer.domElement);
    this.courseData=course;this.scene.add(this.ambient,this.sun,this.sun.target);
    Object.assign(this.sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:220});this.sun.shadow.normalBias=.05;this.sun.shadow.bias=-.0004;
    this.ground.rotation.x=-Math.PI/2;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.course=createCourseScene(course);this.scene.add(this.course,this.menuModel.root,this.raceVisuals.root);this.collectBlockers();this.applySettings(this.settings);this.resize();
  }
  private collectBlockers():void {this.course.updateMatrixWorld(true);this.blockers=[];this.course.traverse((object)=>{if(object.userData.cameraBlocker)this.blockers.push(object);});}
  setCourse(course:CourseDefinition):void {this.scene.remove(this.course);disposeGroup(this.course);this.courseData=course;this.course=createCourseScene(course,this.settings.quality);this.scene.add(this.course);this.collectBlockers();}
  applySettings(settings:Settings):void {
    const changed=this.settings.quality!==settings.quality;this.settings=structuredClone(settings);const profile=qualityProfiles[settings.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,profile.pixelRatio));this.renderer.shadowMap.enabled=profile.shadowSize>0;
    this.sun.castShadow=profile.shadowSize>0;const shadow=settings.players===2?Math.min(profile.shadowSize,1024):profile.shadowSize,shadowChanged=this.sun.shadow.mapSize.x!==Math.max(1,shadow);
    this.sun.shadow.mapSize.set(Math.max(1,shadow),Math.max(1,shadow));
    if(changed||shadowChanged){this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}if(changed)this.setCourse(this.courseData);this.resize();
  }
  previewBuild(build:VehicleBuild):void {
    const key=JSON.stringify(build);if(this.menuKey===key)return;this.scene.remove(this.menuModel.root);disposeGroup(this.menuModel.root);this.menuModel=createKart(build);this.menuKey=key;this.scene.add(this.menuModel.root);
  }
  setGhost(record:GhostRecord|null):void{this.ghost=record;}
  getViewports(players=1):Viewport[]{return computeViewports(window.innerWidth,window.innerHeight,players,this.settings.split);}
  resize():void{this.renderer.getSize(this.size);if(this.size.x!==window.innerWidth||this.size.y!==window.innerHeight)this.renderer.setSize(window.innerWidth,window.innerHeight);}
  private atmosphere(state:KartState):void {
    const theme=this.courseData.theme,underwater=state.traversal==='underwater';
    const sky=underwater?'#357c91':theme==='starlight'?'#171c39':theme==='foundry'?'#d5c5af':theme==='harbour'?'#b3dae0':'#c4dfd3';
    this.scene.background=new THREE.Color(sky);const distance=qualityProfiles[this.settings.quality].drawDistance;
    this.scene.fog=new THREE.Fog(sky,underwater?12:distance*.45,underwater?Math.min(100,distance*.4):distance);
    this.ambient.intensity=theme==='starlight'?1.8:2.5;this.sun.intensity=theme==='starlight'?1.4:3.1;
    this.ground.position.y=theme==='starlight'?-60:theme==='foundry'?-18:theme==='harbour'?-20:-.03;
    this.ground.material.color.set(theme==='starlight'?'#11182f':theme==='foundry'?'#706759':theme==='harbour'?'#597c78':'#92b975');
  }
  draw(state:KartState,dt:number,menu:boolean,rear:boolean,steering:number,snap=false,race?:Race,alpha=1):void {
    const movingQuality=race&&race.humans.length===2&&this.settings.quality==='high'?'medium':this.settings.quality;
    if(race)this.raceVisuals.sync(race,alpha,!menu,dt,movingQuality,this.ghost&&this.settings.ghost?sampleGhost(this.ghost,race.time):null);
    this.menuModel.root.visible=menu;this.menuModel.root.position.set(state.x,state.y+.09,state.z);orient(this.menuModel.root,state.heading,state.up,0,state.forward);this.menuModel.body.rotation.z=-steering*.02;
    const humans=menu?[]:race?.humans??[],views=this.getViewports(Math.max(1,humans.length));
    this.sun.position.set(state.x+45,state.y+85,state.z+30);this.sun.target.position.set(state.x,state.y,state.z);this.sun.target.updateMatrixWorld();
    this.renderer.setScissorTest(true);this.renderer.shadowMap.needsUpdate=true;
    for(let i=0;i<views.length;i++){
      const viewport=views[i]!,camera=this.cameras[i]!,chase=this.chases[i]!;
      const racer=humans[i];
      const follow=i===0||!racer?state:{...racer.controller.state,x:THREE.MathUtils.lerp(racer.previous.x,racer.controller.state.x,alpha),y:THREE.MathUtils.lerp(racer.previous.y,racer.controller.state.y,alpha),z:THREE.MathUtils.lerp(racer.previous.z,racer.controller.state.z,alpha)};
      this.atmosphere(follow);camera.aspect=viewport.width/viewport.height;camera.far=qualityProfiles[this.settings.quality].drawDistance;camera.updateProjectionMatrix();
      chase.update(follow,dt,menu,i===0?rear:!!racer?.input.rearView,snap,this.courseData,this.blockers,this.settings.reducedMotion);
      const bottom=window.innerHeight-viewport.top-viewport.height;this.renderer.setViewport(viewport.x,bottom,viewport.width,viewport.height);this.renderer.setScissor(viewport.x,bottom,viewport.width,viewport.height);
      this.renderer.render(this.scene,camera);this.renderer.shadowMap.needsUpdate=false;
    }
    this.renderer.setScissorTest(false);
  }
  dispose():void {disposeGroup(this.scene);disposeImportedCourse();this.sun.shadow.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
