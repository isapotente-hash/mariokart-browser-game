import type { CourseDefinition, CourseSample, Point, Pose, Vec3 } from '../data/types';
import type { CourseId } from '../data/options';
import { offsetSample, trackFrame } from './frames';
import { createElectrodrome,sampleImported,importedPoseAt } from './electrodrome';

export const courseCatalog = [
  { id: 'garden-circuit', name: 'Garden Circuit', theme: 'garden', description: 'A gentle hill, a garden ramp and a grassy inside line.', color: '#548b5b' },
  { id: 'harbour-run', name: 'Harbour Run', theme: 'harbour', description: 'Dive below the docks, dodge the cargo and choose your pier.', color: '#458fa3' },
  { id: 'sky-foundry', name: 'Sky Foundry', theme: 'foundry', description: 'Ride the banked wall, launch your glider and stick the landing.', color: '#b37c53' },
  { id: 'starlight-causeway', name: 'Starlight Causeway', theme: 'starlight', description: 'Exposed night roads, chained corners and a risky boost line.', color: '#7668b2' },
  { id: 'electrodrome', name: 'Electrodrome', theme: 'starlight', description: 'Imported neon venue, magnetic roads and a long glider jump.', color: '#ef57cc' },
] as const;
const layouts: Record<Exclude<CourseId,'electrodrome'>, Point[]> = {
  'garden-circuit': [[0,60],[33,60],[53,39],[50,6],[40,-20],[43,-46],[20,-63],[-12,-62],[-39,-46],[-49,-14],[-46,24],[-29,52]].map(([x,z]) => ({x:x!,z:z!})),
  'harbour-run': [[0,65],[38,65],[62,45],[58,5],[28,-14],[53,-40],[31,-63],[-10,-62],[-55,-43],[-58,-3],[-29,12],[-38,49]].map(([x,z]) => ({x:x!,z:z!})),
  'sky-foundry': [[0,61],[36,61],[68,38],[62,0],[29,-31],[7,-66],[-34,-62],[-66,-30],[-53,2],[-22,5],[-40,35],[-25,57]].map(([x,z]) => ({x:x!,z:z!})),
  'starlight-causeway': [[0,68],[40,62],[50,30],[27,10],[53,-18],[37,-58],[2,-67],[-35,-52],[-23,-21],[-56,0],[-49,39],[-22,36]].map(([x,z]) => ({x:x!,z:z!})),
};
function spline(a:number,b:number,c:number,d:number,t:number):number { return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t); }
const smooth = (t:number) => { const x=Math.max(0,Math.min(1,t)); return x*x*(3-2*x); };
function window(u:number,from:number,to:number):number { return u<from || u>to ? 0 : Math.sin(Math.PI*smooth((u-from)/(to-from)))**2; }
function elevation(id:CourseId,u:number):number {
  if(id==='garden-circuit') return window(u,.13,.48)*4 + window(u,.54,.6)*1.6;
  if(id==='harbour-run') return -13*smooth((u-.13)/.08)*(1-smooth((u-.4)/.08));
  if(id==='sky-foundry') {
    if(u>=.5 && u<.6) return 4+14*smooth((u-.5)/.1);
    if(u>=.6 && u<.73) return 18-14*((u-.6)/.13);
    return 4+7*window(u,.12,.44);
  }
  return 12+4*Math.sin(u*Math.PI*4)**2;
}
export function createCourse(input:boolean|CourseId=false, mirrored=false, compact=false):CourseDefinition {
  const id:CourseId=typeof input==='boolean'?'garden-circuit':input;
  if(id==='electrodrome')return createElectrodrome(mirrored);
  const short=input===true || compact;
  const legacyPocket=input===true;
  const layout=layouts[id], scale=short?.35:2.1, heightScale=short?.2:1;
  const metadata=courseCatalog.find((entry)=>entry.id===id)!;
  let length=0;
  const samples:CourseSample[]=[];
  for(let i=0;i<360;i++) {
    const u=i/360, pos=u*layout.length, index=Math.floor(pos), t=pos-index;
    const at=(offset:number)=>layout[(index+offset+layout.length)%layout.length]!;
    const x=spline(at(-1).x,at(0).x,at(1).x,at(2).x,t)*scale*(mirrored?-1:1);
    const z=spline(at(-1).z,at(0).z,at(1).z,at(2).z,t)*scale;
    const previous=samples.at(-1);
    if(previous) length+=Math.hypot(x-previous.x,z-previous.z);
    samples.push({x,z,y:legacyPocket?0:elevation(id,u)*heightScale,tangent:{x:0,z:1},distance:length,bank:id==='sky-foundry'&&!legacyPocket?window(u,.15,.43)*1.25*(mirrored?-1:1):0,slope:0,traversal:id==='harbour-run'&&u>.18&&u<.445&&!legacyPocket?'underwater':id==='sky-foundry'&&u>.15&&u<.43&&!legacyPocket?'anti-gravity':'grounded',gap:id==='sky-foundry'&&u>.605&&u<.725&&!legacyPocket});
  }
  length+=Math.hypot(samples[0]!.x-samples.at(-1)!.x,samples[0]!.z-samples.at(-1)!.z);
  for(let i=0;i<samples.length;i++) {
    const p=samples[i]!,a=samples[(i+359)%360]!,b=samples[(i+1)%360]!;
    const span=Math.hypot(b.x-a.x,b.z-a.z);p.tangent={x:(b.x-a.x)/span,z:(b.z-a.z)/span};p.slope=(b.y-a.y)/span;
  }
  const width=short?7: id==='starlight-causeway'?10:14;
  const checkpoints=Array.from({length:12},(_,i)=>{const p=samples[i*30]!;return {x:p.x,y:p.y,z:p.z,heading:Math.atan2(p.tangent.x,p.tangent.z),halfWidth:width/2+2.2};});
  const spawn=samples[22]!;
  const course:CourseDefinition={id:legacyPocket?'pocket-loop':id,name:legacyPocket?'Pocket Loop':metadata.name,description:metadata.description,width,length,samples,checkpoints,spawn:{x:spawn.x,y:spawn.y,z:spawn.z,heading:Math.atan2(spawn.tangent.x,spawn.tangent.z)},theme:metadata.theme,compact:short,mirrored,version:`${id}-3-${short?'compact':'full'}-${mirrored?'mirror':'normal'}`,branches:[],hazards:[],launches:[],exposed:id==='starlight-causeway'};
  if(!legacyPocket) {
    if(id==='garden-circuit') {
      addBranch(course,'garden-cut',126,144,-width*.95,'grass');
      course.launches.push({from:samples[204]!.distance,to:samples[208]!.distance,landing:samples[226]!.distance,glider:false});
    }
    if(id==='harbour-run') {
      addBranch(course,'outer-pier',186,204,width*1.6,'road');
      course.hazards.push({id:'cargo-sweeper',progress:samples[190]!.distance,amplitude:width*.42,period:8,radius:.95});
    }
    if(id==='starlight-causeway') addBranch(course,'star-boost',186,204,-width*1.3,'boost');
    if(id==='sky-foundry') {
      course.launches.push({from:samples[214]!.distance,to:samples[219]!.distance,landing:samples[264]!.distance,glider:true});
      const recovery=samples.slice(218,263).map((sample)=>({...sample,y:2*heightScale,bank:0,slope:0,gap:false,traversal:'grounded' as const}));
      course.branches.push({id:'recovery',samples:recovery,width:width*1.65,surface:'road'});
    }
  }
  return course;
}
function addBranch(course:CourseDefinition,id:string,from:number,to:number,offset:number,surface:'road'|'grass'|'boost'):void {
  const a=course.samples[from]!,b=course.samples[to]!;
  const samples=Array.from({length:25},(_,i)=>{
    const t=i/24,main=poseAt(course,a.distance+(b.distance-a.distance)*t),p=course.samples[Math.round(from+(to-from)*t)]!;
    const side=Math.sin(t*Math.PI)*offset;
    return {...p,x:main.x+Math.cos(main.heading)*side,z:main.z-Math.sin(main.heading)*side,distance:a.distance+(b.distance-a.distance)*t,bank:0,gap:false};
  });
  for(let i=0;i<samples.length;i++){const p=samples[i]!,a=samples[Math.max(0,i-1)]!,b=samples[Math.min(samples.length-1,i+1)]!;const span=Math.hypot(b.x-a.x,b.z-a.z);p.tangent={x:(b.x-a.x)/span,z:(b.z-a.z)/span};p.slope=(b.y-a.y)/span;}
  course.branches.push({id,samples,width:surface==='boost'?course.width*.65:course.width*.8,surface});
}
export interface TrackQuery extends Point {
  center?:Vec3;
  tangent:Point;distance:number;offset:number;normal:Point;progress:number;
  height:number;right:Vec3;up:Vec3;forward:Vec3;bank:number;traversal:CourseSample['traversal'];route:string;width:number;surface:'road'|'grass'|'boost';gap:boolean;
}
interface Segment { a: CourseSample; b: CourseSample; route: { id: string; width: number; surface: 'road' | 'grass' | 'boost' }; last: boolean }
const spatialIndexes = new WeakMap<CourseDefinition, { all: Segment[]; cells: Map<string, Segment[]> }>();
function querySegments(course: CourseDefinition, point: Point): Segment[] {
  let index = spatialIndexes.get(course);
  if (!index) {
    index = { all: [], cells: new Map() };
    for (const route of [{ id: 'main', samples: course.samples, width: course.width, surface: 'road' as const }, ...course.branches]) {
      for (let i = 0; i < (route.id === 'main' ? route.samples.length : route.samples.length - 1); i++) {
        const a = route.samples[i]!, b = route.samples[(i + 1) % route.samples.length]!;
        const segment: Segment = { a, b, route, last: route.id === 'main' && i === route.samples.length - 1 };
        index.all.push(segment);
        const margin = route.width / 2 + 5;
        for (let x = Math.floor((Math.min(a.x, b.x) - margin) / 16); x <= Math.floor((Math.max(a.x, b.x) + margin) / 16); x++) {
          for (let z = Math.floor((Math.min(a.z, b.z) - margin) / 16); z <= Math.floor((Math.max(a.z, b.z) + margin) / 16); z++) {
            const key = `${x},${z}`; const bucket = index.cells.get(key) ?? []; bucket.push(segment); index.cells.set(key, bucket);
          }
        }
      }
    }
    spatialIndexes.set(course, index);
  }
  return index.cells.get(`${Math.floor(point.x / 16)},${Math.floor(point.z / 16)}`) ?? index.all;
}
export function sampleTrack(course:CourseDefinition,point:Point&{y?:number}):TrackQuery {
  if(course.imported)return sampleImported(course,point);
  if(course.arena)return{x:point.x,z:point.z,tangent:{x:0,z:1},normal:{x:1,z:0},offset:0,distance:Math.max(0,Math.abs(point.x)-course.arena.halfSize,Math.abs(point.z)-course.arena.halfSize),progress:0,height:0,right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},forward:{x:0,y:0,z:1},bank:0,traversal:'grounded',route:'arena',width:course.width,surface:'road',gap:false};
  let score=Infinity,result:TrackQuery|undefined;
  for(const segment of querySegments(course,point)) {
    const {a,b,route,last}=segment;
    const dx=b.x-a.x,dz=b.z-a.z,span2=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/span2));
    const x=a.x+t*dx,z=a.z+t*dz,d2=(point.x-x)**2+(point.z-z)**2;
    if(d2>=score)continue;
    const span=Math.sqrt(span2),tangent={x:dx/span,z:dz/span},normal={x:tangent.z,z:-tangent.x};
    const bank=a.bank+(b.bank-a.bank)*t,centerHeight=a.y+(b.y-a.y)*t;
    const frame=trackFrame({tangent,bank,slope:(b.y-a.y)/span});
    const offset=((point.x-x)*normal.x+(point.z-z)*normal.z)/Math.max(.3,Math.cos(bank));
    const height=centerHeight+frame.right.y*offset;
    const candidate=d2+(point.y===undefined?0:Math.min(100,(point.y-height)**2)*.05);
    if(candidate>=score)continue;
    score=candidate;
    const distanceB=last?course.length:b.distance;
    result={x,z,tangent,normal,offset,distance:Math.abs(offset),progress:a.distance+(distanceB-a.distance)*t,height,...frame,bank,traversal:a.traversal,route:route.id,width:route.width,surface:route.surface,gap:a.gap};
  }
  return result!;
}
export function poseAt(course:CourseDefinition,distance:number,routeId='main'):Pose {
  if(course.imported)return importedPoseAt(course,distance);
  const d=((distance%course.length)+course.length)%course.length;
  const route=course.branches.find((entry)=>entry.id===routeId);
  const samples=route?.samples??course.samples;
  let i=samples.findIndex((point)=>point.distance>d)-1;
  if(i<0)i=d<samples[0]!.distance?0:samples.length-1;
  const a=samples[i]!,b=samples[(i+1)%samples.length]!;
  const span=i===samples.length-1?(route?1:course.length-a.distance):b.distance-a.distance;
  const t=route&&i===samples.length-1?0:Math.max(0,Math.min(1,(d-a.distance)/span));
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)};
}
export function gridPose(course:CourseDefinition,index:number):Pose {
  if(course.arena)return{...course.arena.spawns[index%course.arena.spawns.length]!};
  const pose=poseAt(course,-4-Math.floor(index/2)*4.5);
  const lane=(index%2===0?-1:1)*Math.min(2.3,course.width*.23);
  if(course.imported){const road=sampleTrack(course,pose),side=(index%2===0?-1:1)*Math.min(1.2,road.width*.23);return{...pose,x:pose.x+road.right.x*side,y:pose.y!+road.right.y*side,z:pose.z+road.right.z*side};}
  return {...pose,x:pose.x+Math.cos(pose.heading)*lane,z:pose.z-Math.sin(pose.heading)*lane};
}
export function hazardPose(course:CourseDefinition,hazard:CourseDefinition['hazards'][number],time:number):Vec3 {
  const pose=poseAt(course,hazard.progress),road=sampleTrack(course,pose);
  const offset=Math.sin(time*Math.PI*2/hazard.period)*hazard.amplitude;
  return {x:pose.x+road.right.x*offset,y:road.height+road.right.y*offset,z:pose.z+road.right.z*offset};
}
export {offsetSample};
