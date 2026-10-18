import data from './electrodrome-data.json' with {type:'json'};
import type {CourseDefinition,CourseSample,Pose,Vec3,Point} from '../data/types';
import type {TrackQuery} from './course';
import {normalize,cross,trackFrame} from './frames';

export function createElectrodrome(mirrored=false):CourseDefinition {
  const sign=mirrored?-1:1;let length=0;
  const samples:CourseSample[]=data.map((v,i)=>{const p={x:v[0]!*sign,y:v[1]!,z:v[2]!};if(i){const last=data[i-1]!;length+=Math.hypot(v[0]!-last[0]!,v[1]!-last[1]!,v[2]!-last[2]!);}return{...p,up:normalize({x:v[3]!*sign,y:v[4]!,z:v[5]!}),width:v[6]!,distance:length,tangent:{x:0,z:1},slope:0,bank:0,traversal:'anti-gravity',gap:!!v[7],connector:!!v[8]};});
  length+=Math.hypot(samples[0]!.x-samples.at(-1)!.x,samples[0]!.y-samples.at(-1)!.y,samples[0]!.z-samples.at(-1)!.z);
  for(let i=0;i<samples.length;i++){const p=samples[i]!,a=samples[(i+samples.length-1)%samples.length]!,b=samples[(i+1)%samples.length]!,span=Math.hypot(b.x-a.x,b.z-a.z)||1;p.tangent={x:(b.x-a.x)/span,z:(b.z-a.z)/span};p.slope=(b.y-a.y)/span;p.traversal=p.up!.y<.95?'anti-gravity':'grounded';}
  const course:CourseDefinition={id:'electrodrome',name:'Electrodrome',description:'The supplied neon venue: elevated magnetic roads, a lower loop and a long glider jump.',width:8,length,samples,checkpoints:[],spawn:{x:0,y:0,z:0,heading:0},theme:'starlight',compact:false,mirrored,version:`electrodrome-1-${mirrored?'mirror':'normal'}`,branches:[],hazards:[],launches:[],exposed:false,imported:{asset:'assets/tracks/electrodrome.glb'}};
  for(let i=0;i<12;i++){let index=samples.findIndex(s=>s.distance>=Math.max(i*length/12,i?course.checkpoints[i-1]!.distance!+20:0));if(samples[index]!.distance>=samples[samples.findIndex(s=>s.gap)]!.distance-30&&samples[index]!.distance<=samples[samples.findLastIndex(s=>s.gap)]!.distance+30){index=samples.findLastIndex(s=>s.gap);while(samples[index]!.gap)index=(index+1)%samples.length;const safe=samples[index]!.distance+30;index=samples.findIndex(s=>s.distance>=safe);}const s=samples[index]!,f=trackFrame(s);course.checkpoints.push({x:s.x,y:s.y,z:s.z,heading:Math.atan2(f.forward.x,f.forward.z),halfWidth:Math.max(4,s.width!/2+1),distance:s.distance,...f});}
  const first=samples.findIndex(s=>s.gap),last=samples.findLastIndex(s=>s.gap),launch=samples[first-1]!,end=samples[last+4]!;
  course.launches.push({from:launch.distance-10,to:samples[first+2]!.distance,landing:end.distance,glider:true});course.spawn=importedPoseAt(course,0);return course;
}
export function importedPoseAt(course:CourseDefinition,distance:number):Pose {
  const d=(distance%course.length+course.length)%course.length,samples=course.samples;let i=samples.findIndex(p=>p.distance>d)-1;if(i<0)i=d<samples[0]!.distance?0:samples.length-1;const a=samples[i]!,b=samples[(i+1)%samples.length]!,end=i===samples.length-1?course.length:b.distance,t=Math.max(0,Math.min(1,(d-a.distance)/(end-a.distance)));
    const forward=normalize({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(forward.x,forward.z),forward};
}
const segments=new WeakMap<CourseDefinition,Map<string,number[]>>();
function candidates(course:CourseDefinition,p:Point&{y?:number}):number[]{let cells=segments.get(course);if(!cells){cells=new Map();for(let i=0;i<course.samples.length;i++){const a=course.samples[i]!,b=course.samples[(i+1)%course.samples.length]!;for(let x=Math.floor((Math.min(a.x,b.x)-12)/16);x<=Math.floor((Math.max(a.x,b.x)+12)/16);x++)for(let z=Math.floor((Math.min(a.z,b.z)-12)/16);z<=Math.floor((Math.max(a.z,b.z)+12)/16);z++){const key=`${x},${z}`,bucket=cells.get(key)??[];bucket.push(i);cells.set(key,bucket);}}segments.set(course,cells);}return cells.get(`${Math.floor(p.x/16)},${Math.floor(p.z/16)}`)??course.samples.map((_,i)=>i);}
export function sampleImported(course:CourseDefinition,p:Point&{y?:number}):TrackQuery {
  let score=Infinity,result:TrackQuery|undefined;const samples=course.samples;
  for(const i of candidates(course,p)){const a=samples[i]!,b=samples[(i+1)%samples.length]!,delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},span2=delta.x**2+delta.y**2+delta.z**2;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*delta.x+(p.z-a.z)*delta.z+(p.y===undefined?0:(p.y-a.y)*delta.y))/(p.y===undefined?delta.x**2+delta.z**2:span2||1))),center={x:a.x+t*delta.x,y:a.y+t*delta.y,z:a.z+t*delta.z},distance=(p.x-center.x)**2+(p.z-center.z)**2+(p.y===undefined?0:(p.y-center.y)**2);
    const hint=(p as {trackProgress?:number}).trackProgress,progress=a.distance+((i===samples.length-1?course.length:b.distance)-a.distance)*t,arc=hint===undefined?0:Math.abs((progress-hint+course.length*1.5)%course.length-course.length/2),cost=distance+(arc>30?10000+arc*arc:0);if(cost>=score)continue;score=cost;const forward=normalize(delta),up=normalize({x:a.up!.x+(b.up!.x-a.up!.x)*t,y:a.up!.y+(b.up!.y-a.up!.y)*t,z:a.up!.z+(b.up!.z-a.up!.z)*t}),right=normalize(cross(up,forward)),normal=normalize(cross(forward,right));
    const offset=(p.x-center.x)*right.x+(p.z-center.z)*right.z+((p.y??center.y)-center.y)*right.y,width=a.width!+(b.width!-a.width!)*t;
    result={x:center.x,z:center.z,center,tangent:normalize({x:forward.x,y:0,z:forward.z}),normal:{x:right.x,z:right.z},offset,distance:Math.abs(offset),progress:a.distance+((i===samples.length-1?course.length:b.distance)-a.distance)*t,height:center.y+right.y*offset,right,forward,up:normal,bank:Math.acos(Math.max(-1,Math.min(1,normal.y))),traversal:normal.y<.95?'anti-gravity':'grounded',route:'main',width,surface:'road',gap:a.gap};
  }return result!;
}
export function dot(a:Vec3,b:Vec3):number{return a.x*b.x+a.y*b.y+a.z*b.z;}
