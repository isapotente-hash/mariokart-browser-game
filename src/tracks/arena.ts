import type { ArenaDefinition,CourseDefinition,Point,Pose } from '../data/types';

export const battleRules={balloons:3,hitPoints:1,lossPenalty:2,respawnSeconds:3,protectionSeconds:3,duration:120,durations:[30,60,120,180]} as const;
export function createArena():CourseDefinition {
  const arena:ArenaDefinition={halfSize:44,obstacles:[],spawns:[],supplies:[]};
  for(const x of[-15,15])for(const z of[-15,15])arena.obstacles.push({x,z,halfWidth:4,halfDepth:4,height:2.8});
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;arena.spawns.push({x:Math.sin(angle)*33,y:0,z:Math.cos(angle)*33,heading:angle+Math.PI});}
  for(const sign of[-1,1]){arena.supplies.push({x:0,z:sign*10,double:true},{x:sign*10,z:0,double:true},{x:0,z:sign*32,double:false},{x:sign*32,z:0,double:false});
    for(const side of[-1,1])arena.supplies.push({x:sign*30,z:side*24,double:false},{x:sign*24,z:side*30,double:false});}
  const samples=Array.from({length:360},(_,i)=>{const t=i/360*4,side=Math.floor(t),u=t-side,h=arena.halfSize;const p=side===0?{x:-h+u*2*h,z:-h}:side===1?{x:h,z:-h+u*2*h}:side===2?{x:h-u*2*h,z:h}:{x:-h,z:h-u*2*h};return{...p,y:0,tangent:side===0?{x:1,z:0}:side===1?{x:0,z:1}:side===2?{x:-1,z:0}:{x:0,z:-1},distance:i/360*h*8,bank:0,slope:0,traversal:'grounded' as const,gap:false};});
  return{id:'switchyard-plaza',name:'Switchyard Plaza',description:'An open battle courtyard with four cover blocks, intersecting approaches and supply routes.',width:88,length:352,samples,checkpoints:arena.spawns.map(p=>({...p,halfWidth:4})),spawn:{...arena.spawns[0]!},theme:'garden',compact:false,mirrored:false,version:'switchyard-1',branches:[],hazards:[],launches:[],exposed:false,arena};
}
export function arenaContact(arena:ArenaDefinition,point:Point,radius:number):Point&{nx:number;nz:number;hit:boolean} {
  let x=point.x,z=point.z,nx=0,nz=0,hit=false;const edge=arena.halfSize-radius;
  if(Math.abs(x)>edge){nx=Math.sign(x);x=nx*edge;hit=true;}if(Math.abs(z)>edge){nz=Math.sign(z);z=nz*edge;hit=true;}
  for(const box of arena.obstacles){const left=box.x-box.halfWidth-radius,right=box.x+box.halfWidth+radius,near=box.z-box.halfDepth-radius,far=box.z+box.halfDepth+radius;
    if(x<=left||x>=right||z<=near||z>=far)continue;
    const distances=[x-left,right-x,z-near,far-z],side=distances.indexOf(Math.min(...distances));
    if(side===0){x=left;nx=1;nz=0;}else if(side===1){x=right;nx=-1;nz=0;}else if(side===2){z=near;nx=0;nz=1;}else{z=far;nx=0;nz=-1;}hit=true;
  }
  const magnitude=Math.hypot(nx,nz);if(magnitude>1){nx/=magnitude;nz/=magnitude;}
  return{x,z,nx,nz,hit};
}
export function arenaLineClear(arena:ArenaDefinition,a:Point,b:Point,margin=1.6):boolean {
  for(const box of arena.obstacles){let lo=0,hi=1;for(const axis of ['x','z'] as const){const size=(axis==='x'?box.halfWidth:box.halfDepth)+margin,min=box[axis]-size,max=box[axis]+size,d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max){lo=2;break;}}else{const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}}if(lo<=hi&&lo<=1&&hi>=0)return false;}
  return true;
}
const navigation=new WeakMap<ArenaDefinition,{nodes:Point[];edges:{index:number;cost:number}[][]}>();
export function arenaWaypoint(arena:ArenaDefinition,from:Point,to:Point):Point {
  if(arenaLineClear(arena,from,to))return to;
  let graph=navigation.get(arena);
  if(!graph){const nodes:Point[]=[];for(const box of arena.obstacles)for(const x of[-1,1])for(const z of[-1,1])nodes.push({x:box.x+x*(box.halfWidth+2.4),z:box.z+z*(box.halfDepth+2.4)});const edges=nodes.map((a,i)=>nodes.flatMap((b,j)=>i!==j&&arenaLineClear(arena,a,b)?[{index:j,cost:Math.hypot(a.x-b.x,a.z-b.z)}]:[]));graph={nodes,edges};navigation.set(arena,graph);}
  const nodes=[from,...graph.nodes,to],end=nodes.length-1,dist=nodes.map(()=>Infinity),parent=nodes.map(()=>-1),visited=new Set<number>();dist[0]=0;
  for(let iteration=0;iteration<nodes.length;iteration++){let at=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(at<0||dist[i]!<dist[at]!))at=i;if(at<0||!Number.isFinite(dist[at]!))break;if(at===end)break;visited.add(at);
    const edges=at===0?graph.nodes.flatMap((p,i)=>arenaLineClear(arena,from,p)?[{index:i+1,cost:Math.hypot(p.x-from.x,p.z-from.z)}]:[]):graph.edges[at-1]!.map(e=>({index:e.index+1,cost:e.cost}));if(at>0&&arenaLineClear(arena,nodes[at]!,to))edges.push({index:end,cost:Math.hypot(nodes[at]!.x-to.x,nodes[at]!.z-to.z)});
    for(const edge of edges)if(dist[at]!+edge.cost<dist[edge.index]!){dist[edge.index]=dist[at]!+edge.cost;parent[edge.index]=at;}
  }
  if(parent[end]===-1)return arena.spawns.reduce((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)<Math.hypot(b.x-from.x,b.z-from.z)?a:b);
  let next=end;while(parent[next]!>0)next=parent[next]!;return nodes[next]!;
}
export function arenaSpawn(arena:ArenaDefinition,index:number):Pose{return{...arena.spawns[index%arena.spawns.length]!};}
