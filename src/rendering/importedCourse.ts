import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {CourseDefinition} from '../data/types';
import type {Quality} from '../data/options';
import {offsetSample,trackFrame} from '../tracks/frames';
import {orient} from './resources';

let model:THREE.Group|null=null,pending:Promise<void>|null=null;
const listeners=new Set<(progress:number)=>void>();
/** One decoded asset is shared across course swaps; clones never own its GPU resources. */
export async function prepareImportedCourse(course:CourseDefinition,onProgress:(progress:number)=>void=()=>{}):Promise<void>{
  if(!course.imported)return;if(model){onProgress(1);return;}listeners.add(onProgress);
  if(!pending)pending=(async()=>{
    const response=await fetch(`${import.meta.env.BASE_URL}${course.imported!.asset}`);if(!response.ok)throw Error(`Track model request failed (${response.status})`);
    const total=Number(response.headers.get('content-length'))||15_507_476,reader=response.body?.getReader();let bytes:ArrayBuffer;
    if(reader){const chunks:Uint8Array[]=[];let loaded=0;for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);loaded+=part.value.byteLength;for(const listener of listeners)listener(Math.min(.9,loaded/total*.9));}const joined=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}bytes=joined.buffer;}else bytes=await response.arrayBuffer();
    const gltf=await new GLTFLoader().parseAsync(bytes,'');model=gltf.scene;
    model.traverse(object=>{if(object instanceof THREE.Mesh){object.userData.sharedAsset=true;object.castShadow=false;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.side=THREE.DoubleSide;
      // The export contains overlapping road decals and transparent light
      // cones. Keep either from competing with the road in the depth buffer.
      if(material.transparent)material.depthWrite=false;
      if(['tc_startgrid','tc_startgridline','tc_road_movelight'].includes(material.name)){material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;}
      if(material instanceof THREE.MeshStandardMaterial){material.emissiveIntensity=.55;material.roughness=Math.max(.5,material.roughness);}if(material instanceof THREE.MeshPhysicalMaterial)material.transmission=0;}}});for(const listener of listeners)listener(1);
  })().catch(error=>{pending=null;throw error;});
  try{await pending;}finally{listeners.delete(onProgress);}
}
export function createImportedCourseScene(course:CourseDefinition,quality:Quality):THREE.Group{
  const root=new THREE.Group();root.name='Electrodrome';if(!model)return root;
  const clone=model.clone(true),sign=course.mirrored?-1:1;clone.scale.set(.04*sign,.04,.04);clone.position.set(66.52*sign,-65.72,-17.52);root.add(clone);
  clone.traverse(object=>{if(object instanceof THREE.Mesh){const material=Array.isArray(object.material)?object.material[0]!:object.material;if(quality==='low'&&['kh_buildingwindow2','tc_wall_tubu_enkei'].includes(material.name))object.visible=false;object.userData.cameraBlocker=object.visible&&(material.name.startsWith('tc_road')||['tc_wall_men','kh_buildingwindow2'].includes(material.name));}});
  const sections=course.samples.filter(s=>s.connector);
  const strip=(left:number,right:number,color:string)=>{const vertices:number[]=[];for(let i=0;i<sections.length-1;i++){const a=sections[i]!,b=sections[i+1]!,p=(s:typeof a,lane:number)=>{const v=offsetSample(s,lane,.03);return[v.x,v.y,v.z];};vertices.push(...p(a,left),...p(b,left),...p(b,right),...p(a,left),...p(b,right),...p(a,right));}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));root.add(mesh);};
  strip(-4,4,'#25243e');strip(-4,-3.78,'#82f3ee');strip(3.78,4,'#ed81e6');
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.4,0,-.6,.4,0,-.6,0,0,.8],3));const arrowMaterial=new THREE.MeshBasicMaterial({color:'#64e8ef',side:THREE.DoubleSide});
  for(let i=15;i<course.samples.length;i+=45){const s=course.samples[i]!;if(s.gap)continue;const f=trackFrame(s),marker=new THREE.Mesh(arrowGeometry,arrowMaterial);marker.position.set(s.x+f.up.x*.08,s.y+f.up.y*.08,s.z+f.up.z*.08);orient(marker,0,f.up,0,f.forward);root.add(marker);}
  root.updateMatrixWorld(true);return root;
}
export function disposeImportedCourse():void{
  if(!model)return;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();model.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});for(const texture of textures)texture.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();model=null;pending=null;
}
