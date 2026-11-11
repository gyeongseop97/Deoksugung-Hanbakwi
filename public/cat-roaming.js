import {clearSegment,entranceWalk,palace,palacePaths,planWalk,route,spawn,walkable} from "./layout.js";

const trails=new Map(palacePaths.map(({name,points})=>[name,points]));
const palaceTrail=name=>trails.get(name);
const southernGarden=palaceTrail("남쪽 정원길");
const pondEast=palaceTrail("연못 동쪽 산책길");
const pondWest=palaceTrail("연못 서쪽 산책길");
const pavilionWalk=palaceTrail("정관헌 동쪽 산책길");
const fountainGarden=palaceTrail("석조전 정원 외곽");
const northWalk=palaceTrail("석조전 북쪽에서 정관헌까지");
const dondeokjeon=palaceTrail("돈덕전에서 평성문까지");
const dondeokjeonDoor=palaceTrail("돈덕전 입구");
const corridors=[
  [...entranceWalk,...route.slice(1)],palace.slice(0,10),southernGarden,pondEast,pondWest,
  pavilionWalk,fountainGarden,northWalk,dondeokjeon,dondeokjeonDoor,
  ...["금천교에서 중화문까지","대한문 안길","정관헌에서 함녕전까지","융안문 앞길","즉조당에서 중화전까지",
    "중화전 동쪽","중화전 마당 서쪽 둘레","서쪽 산책길","석조전 서관과 정원","평성문에서 석조전으로"].map(palaceTrail)
];
const metres=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const keyOf=point=>point.x+","+point.y;
const close=(a,b)=>metres(a,b)<.001;
const onGround=point=>walkable(point.x,point.y);
const choose=(values,random)=>values[Math.floor(random()*values.length)];

function findGround(point){
  if(onGround(point))return point;
  for(const radius of [.8,1.6,2.4,3.2]){
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      const candidate={x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius};
      if(onGround(candidate))return candidate;
    }
  }
  return null;
}

function exactWalk(from,to,plan=true){
  if(clearSegment(from,to,.24))return [from,to];
  if(!plan)return [];
  const planned=planWalk(from,to);
  if(!planned.length||!close(planned.at(-1),to))return [];
  const points=[from,...planned.slice(0,-1),to];
  return points.every((point,i)=>!i||clearSegment(points[i-1],point,.24))?points:[];
}

function makeNetwork(corridors,origin,plan){
  const nodes=[],byLocation=new Map();
  function nodeFor(point){
    const key=keyOf(point);
    if(byLocation.has(key))return byLocation.get(key);
    const ground=findGround(point);
    const node=ground?{point:ground,index:nodes.length,edges:[]}:null;
    if(node)nodes.push(node);
    byLocation.set(key,node);
    return node;
  }
  function link(a,b,points){
    if(!points.length)return;
    const distance=points.reduce((length,point,i)=>i?length+metres(points[i-1],point):length,0);
    if(distance>metres(a.point,b.point)*2.5+10)return;
    a.edges.push({to:b,points,distance});
    b.edges.push({to:a,points:points.slice().reverse(),distance});
  }
  for(const trail of corridors){
    const stops=trail.map(nodeFor).filter(Boolean);
    for(let i=1;i<stops.length;i++){
      const a=stops[i-1],b=stops[i];
      if(a!==b&&!a.edges.some(edge=>edge.to===b))link(a,b,exactWalk(a.point,b.point,plan));
    }
  }
  // Paths drawn independently can meet a metre or two apart. Connect their real walkable junctions.
  for(const a of nodes)for(const b of nodes){
    if(b.index<=a.index||metres(a.point,b.point)>5.5||a.edges.some(edge=>edge.to===b))continue;
    if(clearSegment(a.point,b.point,.24))link(a,b,[a.point,b.point]);
  }
  // The origin may sit beside the trails rather than on one; begin from the nearest linked stop.
  const reachable=new Set(),first=nodeFor(origin);
  const start=first?.edges.length?first:nodes.reduce((best,node)=>
    node.edges.length&&(!best||metres(node.point,origin)<metres(best.point,origin))?node:best,null)??first;
  if(start){
    const queue=[start];reachable.add(start);
    for(let i=0;i<queue.length;i++)for(const {to} of queue[i].edges){
      if(!reachable.has(to)){reachable.add(to);queue.push(to);}
    }
  }
  return {nodes:[...reachable],byLocation};
}

function networkPath(from,to){
  if(from===to)return [from.point];
  const distances=new Map([[from,0]]),previous=new Map(),frontier=new Set([from]);
  while(frontier.size){
    let current=null,best=Infinity;
    for(const node of frontier){
      const distance=distances.get(node);
      if(distance<best){current=node;best=distance;}
    }
    if(current===to)break;
    frontier.delete(current);
    for(const edge of current.edges){
      const distance=best+edge.distance;
      if(distance>=(distances.get(edge.to)??Infinity))continue;
      distances.set(edge.to,distance);previous.set(edge.to,{current,edge});frontier.add(edge.to);
    }
  }
  if(!previous.has(to))return [];
  const steps=[];
  for(let at=to;at!==from;){
    const {current,edge}=previous.get(at);
    steps.push(edge.points.slice(1));at=current;
  }
  return [from.point,...steps.reverse().flat()];
}

// Each map has its own trail network. plan=false links only stops in plain sight of each
// other, which keeps start-up quick on the much larger Gyeongbokgung grid.
export function makeCatRoaming({trails=corridors,origin=spawn,plan=true}={}){
  let network;
  const graph=()=>network??=makeNetwork(trails,origin,plan);
  const cachedPaths=new Map();
  function between(from,to){
    if(!onGround(from)||!onGround(to))return [];
    if(clearSegment(from,to,.24))return [from,to];
    const key=keyOf(from)+"/"+keyOf(to);
    if(!cachedPaths.has(key)){
      if(cachedPaths.size>=192)cachedPaths.clear();
      cachedPaths.set(key,exactWalk(from,to,plan));
    }
    const path=cachedPaths.get(key);
    return path.length?[from,...path.slice(1,-1),to]:[];
  }
  function access(point){
    const {nodes,byLocation}=graph();
    const exact=byLocation.get(keyOf(point));
    if(exact&&nodes.includes(exact)&&close(point,exact.point))return {node:exact,path:[point]};
    const options=nodes.map(node=>({node,distance:metres(point,node.point)})).filter(option=>option.distance<35);
    options.sort((a,b)=>a.distance-b.distance);
    for(const {node} of options){
      if(clearSegment(point,node.point,.24))return {node,path:[point,node.point]};
    }
    for(const {node} of options.slice(0,3)){
      const path=between(point,node.point);
      if(path.length)return {node,path};
    }
    return null;
  }
  // Shift a few waypoints off the centre of the path so cats do not all trace the same line.
  function meander(points,random){
    const result=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const point=points[i],previous=result.at(-1),next=points[i+1];
      let chosen=point;
      if(random()<.5){
        const angle=random()*Math.PI*2,radius=.5+random()*1.5;
        const shifted={x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius};
        if(onGround(shifted)&&clearSegment(previous,shifted,.24)&&clearSegment(shifted,next,.24))chosen=shifted;
      }
      result.push(chosen);
    }
    if(points.length>1)result.push(points.at(-1));
    return result;
  }
  // A short detour onto the grass or courtyard beside a stop, then back to it.
  function stray(origin,random){
    const points=[origin];
    const hops=1+Math.floor(random()*3);
    for(let hop=0;hop<hops;hop++){
      const from=points.at(-1);
      for(let attempt=0;attempt<6;attempt++){
        const angle=random()*Math.PI*2,radius=2.2+random()*6.5;
        const to={x:from.x+Math.cos(angle)*radius,y:from.y+Math.sin(angle)*radius};
        if(!onGround(to)||!clearSegment(from,to,.24)||!clearSegment(to,origin,.24))continue;
        points.push(to);break;
      }
    }
    if(points.length>1)points.push(origin);
    return points;
  }
  // Cats wander the whole grounds: each one strings together far-apart stops chosen from
  // every reachable path junction, strays off the path at some of them and naps at others.
  function roam(home,random){
    const {nodes}=graph(),entry=access(home);
    const legs=[];
    let untilRest=24+random()*24;
    const add=(points,rest,pace=.69+random()*.26,everyStop=0)=>{
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],distance=metres(a,b);
        if(distance<=.001)continue;
        untilRest-=distance;
        const last=i===points.length-1;
        const pause=last&&rest?rest:everyStop?everyStop*(.5+random()):untilRest<=0?1.2+random()*2.8:0;
        if(pause)untilRest=24+random()*24;
        legs.push({a,b,travel:distance/(pace*(.92+random()*.16)),pause});
      }
    };
    if(entry&&nodes.length>1){
      add(entry.path,0);
      let current=entry.node;
      const visited=new Set([current]);
      const stops=6+Math.floor(random()*4);
      for(let stop=0;stop<stops;stop++){
        const options=nodes.filter(node=>{
          const distance=metres(node.point,current.point);
          return !visited.has(node)&&distance>20&&distance<170;
        });
        const next=choose(options.length?options:nodes,random);
        if(!next||next===current)continue;
        const path=networkPath(current,next);
        if(!path.length)continue;
        // Mostly an unhurried walk, sometimes a purposeful trot across the grounds.
        const pace=random()<.22?1.35+random()*.5:.62+random()*.34;
        add(meander(path,random),1.5+random()*7.5,pace);
        current=next;visited.add(next);
        if(random()<.7)add(stray(current.point,random),.8+random()*2.4,.55+random()*.25,2.6);
      }
      add(meander(networkPath(current,entry.node),random),0);
      add(entry.path.slice().reverse(),4+random()*9);
    }
    if(!legs.length){
      // A blocked optional perch must not strand the cat or invalidate the patrol clock.
      const angle=random()*Math.PI*2;
      for(let i=0;i<8;i++){
        const heading=angle+i*Math.PI/4,point={x:home.x+3*Math.cos(heading),y:home.y+3*Math.sin(heading)};
        if(!clearSegment(home,point,.24))continue;
        add([home,point,home],3);break;
      }
    }
    if(!legs.length)legs.push({a:home,b:home,travel:0,pause:6});
    return legs;
  }
  roam.start=(random,index=0,used=new Set())=>{
    const {nodes}=graph();
    const unused=node=>!used.has(keyOf(node.point));
    // Spread starting points over the whole map instead of a few named areas.
    const free=nodes.filter(unused);
    const point=(free.length?free[(Math.floor(random()*free.length)+index*7)%free.length]:null)?.point??findGround(origin);
    if(point)used.add(keyOf(point));
    return point;
  };
  roam.between=between;
  return roam;
}
