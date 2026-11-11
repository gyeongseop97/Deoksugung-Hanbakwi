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
const areas={
  plaza:entranceWalk.slice(0,2).concat(palace[1]),
  roadEast:route.slice(1,6),roadWest:route.slice(6,12),
  east:pondEast.slice(2,10).concat(pondWest.slice(2,7)),south:southernGarden.slice(1,6),
  west:fountainGarden.slice(2,12),north:dondeokjeon.slice(1,10).concat(dondeokjeonDoor.at(-1)),
  pavilion:pavilionWalk.slice(5,12)
};
const circuits=[
  ["plaza","roadEast","east"],
  ["roadEast","roadWest","plaza"],
  ["roadWest","roadEast","plaza"],
  ["east","pavilion","plaza"],
  ["south","west","east"],
  ["west","north","south"],
  ["north","pavilion","west"],
  ["pavilion","north","east"],
  ["plaza","pavilion","east"],
  ["roadEast","east","roadWest"],
  ["roadWest","plaza","roadEast"],
  ["east","west","north"],
  ["south","pavilion","west"],
  ["west","east","south"],
  ["north","west","pavilion"],
  ["pavilion","west","south"],
  ["plaza","east","roadEast"],
  ["roadEast","roadWest","east"],
  ["roadWest","roadEast","south"],
  ["east","plaza","pavilion"],
  ["south","north","east"],
  ["west","south","north"],
  ["north","pavilion","south"],
  ["pavilion","east","west"]
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

function exactWalk(from,to){
  if(clearSegment(from,to,.24))return [from,to];
  const planned=planWalk(from,to);
  if(!planned.length||!close(planned.at(-1),to))return [];
  const points=[from,...planned.slice(0,-1),to];
  return points.every((point,i)=>!i||clearSegment(points[i-1],point,.24))?points:[];
}

function makeNetwork(){
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
      if(a!==b&&!a.edges.some(edge=>edge.to===b))link(a,b,exactWalk(a.point,b.point));
    }
  }
  // Paths drawn independently can meet a metre or two apart. Connect their real walkable junctions.
  for(const a of nodes)for(const b of nodes){
    if(b.index<=a.index||metres(a.point,b.point)>5.5||a.edges.some(edge=>edge.to===b))continue;
    if(clearSegment(a.point,b.point,.24))link(a,b,[a.point,b.point]);
  }
  const reachable=new Set(),start=nodeFor(spawn);
  if(start){
    const queue=[start];reachable.add(start);
    for(let i=0;i<queue.length;i++)for(const {to} of queue[i].edges){
      if(!reachable.has(to)){reachable.add(to);queue.push(to);}
    }
  }
  const available=Object.fromEntries(Object.entries(areas).map(([area,points])=>
    [area,points.map(nodeFor).filter(node=>reachable.has(node))]));
  return {nodes:[...reachable],available,byLocation};
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

export function makeCatRoaming(){
  let network;
  const graph=()=>network??=makeNetwork();
  const cachedPaths=new Map();
  function between(from,to){
    if(!onGround(from)||!onGround(to))return [];
    if(clearSegment(from,to,.24))return [from,to];
    const key=keyOf(from)+"/"+keyOf(to);
    if(!cachedPaths.has(key)){
      if(cachedPaths.size>=192)cachedPaths.clear();
      cachedPaths.set(key,exactWalk(from,to));
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
  function roam(home,random,index=0){
    const {available}=graph(),entry=access(home);
    const circuit=circuits[index%circuits.length];
    const visits=random()<.5?circuit.slice(1):circuit.slice(1).reverse();
    const legs=[];
    let untilRest=24+random()*24;
    const add=(points,rest)=>{
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],distance=metres(a,b);
        if(distance<=.001)continue;
        untilRest-=distance;
        const pause=i===points.length-1&&rest?rest:untilRest<=0?1.2+random()*2.8:0;
        if(pause)untilRest=24+random()*24;
        legs.push({a,b,travel:distance/(.69+random()*.26),pause});
      }
    };
    if(entry){
      add(entry.path,0);
      let current=entry.node;
      for(const area of visits){
        const next=choose(available[area],random);
        if(!next||next===current)continue;
        const path=networkPath(current,next);
        if(!path.length)continue;
        add(path,2.8+random()*6.5);current=next;
      }
      add(networkPath(current,entry.node),0);
      add(entry.path.slice().reverse(),0);
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
    const {available,nodes}=graph(),area=circuits[index%circuits.length][0];
    const unused=node=>!used.has(keyOf(node.point));
    const point=(choose(available[area].filter(unused),random)??choose(nodes.filter(unused),random))?.point??findGround(spawn);
    if(point)used.add(keyOf(point));
    return point;
  };
  roam.between=between;
  return roam;
}
