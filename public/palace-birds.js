import {clearSegment,court,fountain,route,solidAt,stoneFountain,ticketApproach,walkable} from "./layout.js";
import {isInsideMuseum} from "./visit-layout.js";

const species={
  pigeon:{body:0x9296a4,belly:0xadb0bb,head:0x626b7a,neck:0x528076,throat:0x776481,
    wing:0x727d90,bar:0x373d48,tail:0x515967,feet:0xb57770,bill:0x454650,eye:0xd08a4f,size:1},
  magpie:{body:0x233038,belly:0xf0eee4,head:0x1c2629,neck:0x253033,throat:0x202b2d,
    wing:0x314f65,bar:0xeeeae0,tail:0x254351,feet:0x3a3c40,bill:0x313439,eye:0x625441,size:1.08}
};
const spots=[
  [ticketApproach,4,-2,"pigeon"],[ticketApproach,5,1,"pigeon"],[ticketApproach,1,4,"magpie"],
  [fountain,-4,-3,"pigeon"],[fountain,1,5,"pigeon"],[fountain,5,-1,"magpie"],
  [stoneFountain,5.7,3,"pigeon"],[stoneFountain,1.5,7.1,"pigeon"],[stoneFountain,-5,1,"magpie"],
  [court,5,-2,"pigeon"],[court,-5,4,"magpie"],[route[4],0,0,"pigeon"],
  [route[6],2,1,"magpie"],[route[8],0,0,"pigeon"]
];
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const mix=(a,b,t)=>a+(b-a)*t;
const heading=(from,to)=>Math.atan2(to.x-from.x,to.y-from.y);
const modulo=(value,n)=>((value%n)+n)%n;
const ground=(x,y)=>walkable(x,y)&&!isInsideMuseum(x,y);

function rng(seed){
  let state=2166136261;
  for(const c of seed)state=Math.imul(state^c.codePointAt(0),16777619);
  return ()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
}

function flight(from,to,speed){
  const length=distance(from,to);
  for(const arch of [2.5,3.8,5.2,6.6]){
    const steps=Math.max(12,Math.ceil(length/.42));
    let safe=true;
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const height=mix(from.height,to.height,t)+arch*Math.sin(Math.PI*t);
      if(!solidAt(mix(from.x,to.x,t),mix(from.y,to.y,t),height-.07))continue;
      safe=false;break;
    }
    if(safe)return {from,to,arch,time:Math.max(1050,length/speed*1000+410),mode:"flight"};
  }
  return null;
}

function sample(leg,t){
  t=Math.max(0,Math.min(1,t));
  const {from,to,arch=0,mode}=leg;
  const turn=leg.turn??heading(from,to);
  const spread=mode==="flight"?Math.min(1,t*7,(1-t)*7):0;
  return {x:mix(from.x,to.x,t),y:mix(from.y,to.y,t),height:mix(from.height,to.height,t)+arch*Math.sin(Math.PI*t),
    turn,mode,spread};
}

function perchSites(T,parent,kit,trees,walls){
  const sites=[];
  for(const {a,b,height} of walls)for(const t of [.28,.62]){
    const x=mix(a.x,b.x,t),y=mix(a.y,b.y,t),top=height+.025;
    if(!solidAt(x,y,top))sites.push({x,y,height:top,kind:"wall"});
  }
  const crowns=new Map(),bucket=(col,row)=>col+row*1000;
  parent.traverse(mesh=>{
    if(mesh.name!=="Tree crown"&&mesh.name!=="Palace tree crown")return;
    mesh.updateWorldMatrix(true,false);
    const position=new T.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const key=bucket(Math.floor(position.x/8),Math.floor(position.z/8));
    if(!crowns.has(key))crowns.set(key,[]);
    crowns.get(key).push({mesh,position});
  });
  const ray=new T.Raycaster(),from=new T.Vector3(),down=new T.Vector3(0,-1,0);
  const originX=kit.wx(0),originZ=kit.wz(0);
  for(const tree of trees){
    const col=Math.floor(tree.x/8),row=Math.floor(tree.z/8),reach=tree.height*.22;
    let crown;
    for(let x=col-1;x<=col+1;x++)for(let z=row-1;z<=row+1;z++){
      for(const candidate of crowns.get(bucket(x,z))??[]){
        const {position}=candidate,dx=position.x-tree.x,dz=position.z-tree.z;
        if(position.y<tree.height*.65||position.y>tree.height*1.20||dx*dx+dz*dz>reach*reach)continue;
        if(!crown||position.y>crown.position.y)crown=candidate;
      }
    }
    if(!crown)continue;
    const {position,mesh}=crown;
    ray.set(from.set(position.x,position.y+5,position.z),down);
    const top=ray.intersectObject(mesh,false)[0]?.point;
    if(!top)continue;
    const x=top.x-originX,y=top.z-originZ,height=top.y+.015;
    if(!solidAt(x,y,height))sites.push({x,y,height,kind:"tree"});
  }
  return sites;
}

function makePatrol(home,random,sites,used,kind,floor){
  const legs=[],points=[home];
  for(let i=0;i<3;i++)for(let attempt=0;attempt<12;attempt++){
    const angle=random()*Math.PI*2,radius=1.25+random()*3.6;
    const x=home.x+Math.sin(angle)*radius,y=home.y+Math.cos(angle)*radius;
    const point={x,y,height:floor({x,y})},previous=points.at(-1);
    if(distance(previous,point)<.75||!ground(x,y)||!clearSegment(previous,point,.24)||!clearSegment(point,home,.24))continue;
    points.push(point);break;
  }
  points.push(home);
  let time=0;
  function add(leg){legs.push({...leg,start:time});time+=leg.time;}
  for(let i=1;i<points.length;i++){
    const from=points[i-1],to=points[i],turn=heading(from,to),length=distance(from,to);
    add({from,to:from,time:1300+random()*2800,mode:"peck",turn});
    if(length>.1)add({from,to,time:length/(.58+random()*.27)*1000,mode:"walk",turn});
  }
  const candidates=sites.filter(site=>!used.has(site)&&distance(home,site)>3&&distance(home,site)<25);
  candidates.sort((a,b)=>distance(home,a)-distance(home,b)+(a.kind===b.kind?0:
    a.kind===(kind==="magpie"?"tree":"wall")?-5:5));
  for(const site of candidates){
    const outbound=flight(home,site,4.2);
    if(!outbound)continue;
    used.add(site);add(outbound);
    add({from:site,to:site,time:4300+random()*7200,mode:"perch",turn:heading(site,home)});
    add({...outbound,from:site,to:home});break;
  }
  return {legs,time};
}

function wingGeometry(T,side){
  const geometry=new T.BufferGeometry();
  const outline=[[0,0,.12],[.23,.035,.08],[.44,.004,-.08],[.52,-.014,-.21],
    [.33,-.022,-.255],[.11,-.035,-.21],[0,-.026,-.12]];
  geometry.setAttribute("position",new T.Float32BufferAttribute(outline.flatMap(([x,y,z])=>[x*side,y,z]),3));
  geometry.setIndex([0,1,6,1,5,6,1,2,5,2,4,5,2,3,4]);
  geometry.computeVertexNormals();
  return geometry;
}

export function addPalaceBirds(T,parent,kit,{trees=[],walls=[],seed}={}){
  const perches=perchSites(T,parent,kit,trees,walls),birds=[];
  const floor=point=>kit.floorHeight?.(point)??0;
  const group=new T.Group();group.name="궁의 까치와 비둘기";parent.add(group);
  const material=new T.MeshStandardMaterial({roughness:.8,flatShading:true});
  function batch(geometry,capacity,name,surface=material){
    const mesh=new T.InstancedMesh(geometry,surface,capacity);mesh.name=name;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
    group.add(mesh);return mesh;
  }
  const body=batch(new T.IcosahedronGeometry(1,1),spots.length*22,"Bird bodies");
  const bill=batch(new T.ConeGeometry(1,1,5),spots.length,"Bird beaks");
  const feather=new T.MeshStandardMaterial({roughness:.92,flatShading:true,side:T.DoubleSide});
  const wings=[batch(wingGeometry(T,-1),spots.length,"Bird left wings",feather),
    batch(wingGeometry(T,1),spots.length,"Bird right wings",feather)];
  const batches=[body,bill,...wings],part=new T.Object3D(),root=new T.Object3D(),joint=new T.Object3D();
  const matrix=new T.Matrix4(),attached=new T.Matrix4(),color=new T.Color();
  let roomSeed,checkAt=0,walkers=[];

  function setSeed(value){
    const next=String(value??"preview");
    if(next===roomSeed)return;
    roomSeed=next;birds.length=0;checkAt=0;walkers=[];
    const random=rng(next+":palace birds"),used=new Set();
    for(const [anchor,dx,dy,kind] of spots){
      for(let attempt=0;attempt<20;attempt++){
        const radius=attempt?1+attempt*.24:0,angle=random()*Math.PI*2;
        const x=anchor.x+dx+Math.cos(angle)*radius,y=anchor.y+dy+Math.sin(angle)*radius;
        if(!ground(x,y)||birds.some(bird=>distance(bird.home,{x,y})<.9))continue;
        const home={x,y,height:floor({x,y})},patrol=makePatrol(home,random,perches,used,kind,floor);
        birds.push({kind,home,patrol,offset:random()*patrol.time,size:species[kind].size*(.89+random()*.18),angle:null});
        break;
      }
    }
  }
  setSeed(seed);

  function nearestWalker(position){
    let threat=null,best=Infinity;
    for(const player of walkers){
      const range=player.running?5.25:2.65,dx=player.x-position.x,dy=player.y-position.y;
      const height=Math.max(0,position.height-player.height-.75);
      const gap=dx*dx+dy*dy+height*height;
      if(gap>range*range||gap>=best)continue;
      threat=player;best=gap;
    }
    return threat;
  }
  function scare(bird,position,player,clock,phase){
    const away=distance(position,player)<.12?position.turn:heading(player,position);
    const candidates=perches.filter(site=>distance(position,site)>3&&distance(position,site)<24);
    for(const turn of [0,-.42,.42,-.84,.84,-1.25,1.25])for(const length of [8,5]){
      const x=position.x+Math.sin(away+turn)*length,y=position.y+Math.cos(away+turn)*length;
      if(ground(x,y))candidates.push({x,y,height:floor({x,y}),kind:"ground"});
    }
    const score=site=>Math.sin(away)*(site.x-position.x)+Math.cos(away)*(site.y-position.y);
    candidates.sort((a,b)=>score(b)-score(a)+(a.kind==="ground"?2:0)-(b.kind==="ground"?2:0));
    for(const site of candidates){
      if(score(site)<1.6||distance(site,player)<5.5)continue;
      const outbound=flight(position,site,bird.kind==="magpie"?6.2:7.5);
      if(!outbound)continue;
      bird.escape={outbound,site,clock,phase,returnAt:clock+outbound.time+(site.kind==="ground"?4200:6400)};
      return;
    }
    bird.calmUntil=clock+650;
  }
  function escapePose(bird,clock){
    const {outbound,site,clock:start,phase}=bird.escape;
    const since=clock-start;
    if(since<outbound.time)return sample(outbound,since/outbound.time);
    if(clock>=bird.escape.returnAt&&!bird.escape.returning){
      if(nearestWalker(outbound.from))bird.escape.returnAt=clock+1600;
      else bird.escape.returning=true;
    }
    const elapsed=clock-bird.escape.returnAt;
    if(elapsed<0)return {...site,mode:site.kind==="ground"?"peck":"perch",turn:heading(site,outbound.from),spread:0};
    if(elapsed<outbound.time)return sample({...outbound,from:site,to:outbound.from},elapsed/outbound.time);
    bird.offset=phase-(bird.escape.returnAt+outbound.time);
    bird.escape=null;bird.calmUntil=clock+1100;
    return null;
  }

  function instance(mesh,base,tint,x,y,z,sx,sy,sz,pitch=0,yaw=0,roll=0){
    part.position.set(x,y,z);part.rotation.set(pitch,yaw,roll);part.scale.set(sx,sy,sz);part.updateMatrix();
    matrix.multiplyMatrices(base,part.matrix);
    const index=mesh.count++;
    mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,color.setHex(tint));
  }
  function jointAt(x,y,z,pitch,yaw,roll){
    joint.position.set(x,y,z);joint.rotation.set(pitch,yaw,roll);joint.updateMatrix();
    return attached.multiplyMatrices(root.matrix,joint.matrix);
  }
  function paint(bird,pose,clock,seconds){
    const coat=species[bird.kind],magpie=bird.kind==="magpie",walk=pose.mode==="walk",air=pose.mode==="flight";
    const stride=clock*.012+bird.home.x,peck=pose.mode==="peck"?Math.max(0,Math.sin(clock*.008+bird.home.y))**8:0;
    const step=walk?Math.sin(stride):0,flap=air?Math.sin(clock*(magpie?.036:.048)+bird.home.y)*pose.spread:0;
    const turn=bird.angle==null?0:modulo(pose.turn-bird.angle+Math.PI,Math.PI*2)-Math.PI;
    bird.angle=bird.angle==null?pose.turn:bird.angle+turn*(1-Math.exp(-14*seconds));
    root.position.set(kit.wx(pose.x),pose.height+(walk?Math.abs(step)*.018:0)-peck*.045,kit.wz(pose.y));
    root.rotation.set(air?-.055+flap*.035:0,bird.angle,air?flap*.07:0);
    root.scale.setScalar(bird.size);root.updateMatrix();
    const base=root.matrix;
    instance(body,base,coat.body,0,.191,-.025,magpie?.113:.151,.128,.209);
    instance(body,base,coat.belly,0,.159,.028,magpie?.111:.13,.104,.169);
    instance(body,base,coat.neck,0,.253,.113,.084,.116,.079,-.35);
    instance(body,base,coat.throat,0,.231,.163,.071,.087,.045);
    instance(body,base,coat.tail,0,.158,magpie?-.30:-.248,.058,.027,magpie?.225:.13,.20);
    if(magpie)instance(body,base,0x376068,0,.172,-.36,.025,.019,.163,.19);
    const head=jointAt(0,.286,.126,.98*peck+.11*step,0,0);
    instance(body,head,coat.head,0,.032,.039,.078,.082,.087);
    instance(bill,head,coat.bill,0,.017,.135,.021,magpie?.112:.074,.023,Math.PI/2);
    if(!magpie)instance(body,head,0xbab3a8,0,.027,.115,.025,.017,.025);
    for(const side of [-1,1]){
      instance(body,head,coat.eye,side*.068,.057,.075,.014,.013,.015);
      instance(body,head,0x1b1818,side*.077,.058,.077,.007,.009,.009);
    }
    for(const side of [-1,1]){
      const offset=step*side*.058,fold=1-pose.spread;
      if(!air||pose.spread<.65){
        instance(body,base,coat.feet,side*.060,.065,-.018+offset,.011,.052,.011);
        instance(body,base,coat.feet,side*.060,.019,.016+offset,.024,.010,.039);
      }
      const wing=jointAt(side*.090,.224,-.017,0,side*(.12+fold*1.18),side*(-.31*fold+flap*.91));
      const width=.61+pose.spread*.39;
      instance(wings[(side+1)/2],wing,coat.wing,0,0,0,width,1,1);
      const strips=magpie?1:2;
      for(let i=0;i<strips;i++)instance(body,wing,coat.bar,side*(.098+i*.091)*width,.008,-.047-i*.04,
        magpie?.104:.027,.014,magpie?.102:.093,0,side*.25);
    }
  }

  function update(clock,seconds,actors=[]){
    if(!parent.visible)return;
    const check=clock>=checkAt;
    if(check){
      checkAt=clock+135;
      walkers=actors.filter(player=>!isInsideMuseum(player.x,player.y))
        .map(player=>({x:player.x,y:player.y,height:floor(player),running:player.running}));
    }
    for(const mesh of batches)mesh.count=0;
    for(const bird of birds){
      let pose=bird.escape?escapePose(bird,clock):null;
      if(!pose){
        const phase=modulo(clock+bird.offset,bird.patrol.time);
        const leg=bird.patrol.legs.find(item=>phase<item.start+item.time)??bird.patrol.legs.at(-1);
        pose=sample(leg,(phase-leg.start)/leg.time);
        if(check&&pose.mode!=="flight"&&clock>=(bird.calmUntil??0)){
          const player=nearestWalker(pose);
          if(player)scare(bird,pose,player,clock,phase);
        }
      }
      paint(bird,pose,clock,seconds);
    }
    for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  return {update,setSeed};
}
