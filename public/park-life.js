import {clearSegment,palacePaths,route,solidAt,spawn,walkable} from "./layout.js";
import {PET_MS} from "./activities.js";

const cats=[
  {id:"cheese",name:"치즈태비",home:spawn,habit:"bench",size:1.04,coat:0xd5914b,mark:0x98521f,paw:0xf0d5aa,eyes:[0xa8a953,0xa8a953],pattern:"tabby"},
  {id:"angora",name:"터키시 앙고라",home:palacePaths[14].points[0],habit:"bench",size:1.08,coat:0xf5efe4,paw:0xfff6ed,eyes:[0x77adce,0xc9a057],pattern:"white"},
  {id:"calico",name:"삼색이",home:palacePaths[4].points[5],size:.96,coat:0xf0e6d5,mark:0xc87737,paw:0xf6eee0,eyes:[0x9baf64,0x9baf64],pattern:"calico"},
  {id:"silver",name:"실버태비",home:route[3],habit:"wall",size:.94,coat:0x8c9297,mark:0x42494f,paw:0xaeb5b7,eyes:[0xb4bf73,0xb4bf73],pattern:"tabby"},
  {id:"tuxedo",name:"턱시도",home:route[6],size:1.04,coat:0x292e35,paw:0xebe7d8,eyes:[0xbcc878,0xbcc878],pattern:"tuxedo"},
  {id:"brown",name:"고등어태비",home:palacePaths[20].points[7],size:.99,coat:0x8b765d,mark:0x40362d,paw:0xb2a18b,eyes:[0xadbb70,0xadbb70],pattern:"tabby"},
  {id:"blue",name:"러시안 블루",home:palacePaths[12].points.at(-1),habit:"wall",size:1.01,coat:0x697c89,paw:0x82949e,eyes:[0x93ba77,0x93ba77],pattern:"solid"},
  {id:"black",name:"검정 고양이",home:route[9],size:.95,coat:0x33373b,paw:0x42464a,eyes:[0xd5af5a,0xd5af5a],pattern:"solid"}
];

function randomSequence(seed){
  return ()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
}

function findHome(point){
  if(walkable(point.x,point.y))return point;
  for(let radius=.8;radius<=8;radius+=.8){
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6,x=point.x+radius*Math.cos(angle),y=point.y+radius*Math.sin(angle);
      if(walkable(x,y))return {x,y};
    }
  }
  return null;
}

function jumpHeight(from,to,arc,progress){
  return from+(to-from)*progress+arc*4*progress*(1-progress);
}

function jumpClear(a,b,arc,bench=false){
  const from=a.height??0,to=b.height??0;
  for(let step=1;step<=24;step++){
    const t=step/24,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    const height=jumpHeight(from,to,arc,t);
    // The player's bench collider includes its backrest. A cat arrives over the front of the seat.
    if(solidAt(x,y,bench?Math.max(1.01,height):height+.02))return false;
  }
  return true;
}

function benchExcursion(origin,benches,used){
  const options=benches.map(bench=>bench.catPerch).filter(point=>point&&!used.has(point));
  options.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  for(const seat of options){
    const home=seat.approach;
    if(Math.hypot(home.x-origin.x,home.y-origin.y)>36||!walkable(home.x,home.y)||!jumpClear(home,seat,.39,true))continue;
    used.add(seat);
    const perch={...seat,surface:"bench"};
    return {home,legs:[
      {a:home,b:perch,travel:.59,pause:12.5,arc:.39},
      {a:perch,b:home,travel:.57,pause:1.2,arc:.39}
    ]};
  }
  return null;
}

function wallExcursion(origin,walls,used){
  const options=walls.filter(wall=>!used.has(wall)).map(wall=>({wall,
    distance:Math.hypot((wall.a.x+wall.b.x)/2-origin.x,(wall.a.y+wall.b.y)/2-origin.y)}));
  options.sort((a,b)=>a.distance-b.distance);
  for(const {wall,distance} of options){
    if(distance>35)break;
    const {a,b,height,sides}=wall,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    const span=Math.min(4.8,length*.30)/length;
    const cap=t=>({x:a.x+dx*t,y:a.y+dy*t,height,surface:"wall"});
    for(const t of [.24,.45,.68]){
      const start=cap(t),end=cap(t<.5?t+span:t-span);
      if(Array.from({length:13},(_,i)=>i/12).some(k=>
        solidAt(start.x+(end.x-start.x)*k,start.y+(end.y-start.y)*k,height+.02)))continue;
      for(const side of sides){
        const reach=height>2?2.05:1.52,arc=height>2?1.70:.79;
        const home={x:start.x+dy/length*reach*side,y:start.y-dx/length*reach*side};
        if(!walkable(home.x,home.y)||!jumpClear(home,start,arc))continue;
        used.add(wall);
        return {home,legs:[
          {a:home,b:start,travel:height>2?1.02:.76,pause:.85,arc},
          {a:start,b:end,travel:span*length/.63,pause:1.75},
          {a:end,b:start,travel:span*length/.63,pause:.6},
          {a:start,b:home,travel:height>2?.94:.74,pause:1.3,arc}
        ]};
      }
    }
  }
  return null;
}

function makeRoute(home,random,excursion){
  const path=[home];
  for(let stop=0;stop<(excursion?3:8);stop++){
    const from=path.at(-1);
    for(let attempt=0;attempt<24;attempt++){
      const angle=random()*Math.PI*2,radius=2+random()*7.5;
      const x=from.x+Math.sin(angle)*radius,y=from.y+Math.cos(angle)*radius;
      if(Math.hypot(x-home.x,y-home.y)>19||!clearSegment(from,{x,y},.22))continue;
      path.push({x,y});break;
    }
  }
  // Backtrack along known clear legs when a direct return crosses a wall.
  if(!clearSegment(path.at(-1),home,.22))path.push(...path.slice(1,-1).reverse());
  const legs=[];
  let duration=0;
  function addLeg(a,b,travel,pause,arc=0){
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
    legs.push({a,b,dx,dy,distance,travel,arc,start:duration,end:duration+pause+travel,
      heading:distance?Math.atan2(dx,dy):0});
    duration+=pause+travel;
  }
  for(let i=0;i<path.length;i++){
    const a=path[i],b=path[(i+1)%path.length],distance=Math.hypot(b.x-a.x,b.y-a.y);
    const travel=distance/(.52+random()*.25);
    const pause=2+random()*4.1;
    addLeg(a,b,travel,pause);
  }
  for(const {a,b,travel,pause,arc} of excursion?.legs??[]){
    addLeg(a,b,travel,pause,arc);
  }
  return {legs,duration,offset:random()*duration};
}

function approachingRunner(point,runners){
  let closest=null,best=3.7;
  for(const runner of runners){
    const dx=point.x-runner.x,dy=point.y-runner.y;
    const gap=Math.hypot(dx,dy);
    if(gap>best||(gap===best&&(!closest||runner.id>=closest.id)))continue;
    if(gap>.25&&dx*runner.vx+dy*runner.vy<gap*Math.hypot(runner.vx,runner.vy)*.32)continue;
    if(!clearSegment(runner,point.approach??point))continue;
    closest=runner;best=gap;
  }
  return closest;
}

function shortestTurn(from,to,amount){
  const angle=to-from;
  return from+Math.atan2(Math.sin(angle),Math.cos(angle))*amount;
}

function scareFrom(pose,runner,time){
  const origin={x:pose.x,y:pose.y,height:pose.height,heading:pose.heading};
  const ground=pose.approach??origin;
  const gap=Math.hypot(ground.x-runner.x,ground.y-runner.y);
  const away=gap>.05?Math.atan2(ground.x-runner.x,ground.y-runner.y):Math.atan2(runner.vx,runner.vy);
  for(const distance of [5.2,3.7,2.25,1.3]){
    for(const offset of [0,.44,-.44,.86,-.86,1.24,-1.24,1.57,-1.57]){
      const angle=away+offset;
      const hideout={x:ground.x+Math.sin(angle)*distance,y:ground.y+Math.cos(angle)*distance};
      if(Math.hypot(hideout.x-runner.x,hideout.y-runner.y)<gap+.25||
        !clearSegment(ground,hideout,.25))continue;
      const jump=pose.approach?570:0;
      const dash=distance/6.8*1000;
      return {origin,ground,hideout,angle,time,jump,dash,returnAt:0,walk:distance/1.85*1000};
    }
  }
  return null;
}

function retreatLeg(from,to,progress,initialHeading,sprint=false,arc=0){
  const dx=to.x-from.x,dy=to.y-from.y;
  const heading=shortestTurn(initialHeading,Math.atan2(dx,dy),Math.min(1,progress*3.2));
  return {
    x:from.x+dx*progress,y:from.y+dy*progress,heading,
    stride:Math.hypot(dx,dy)*progress*2*Math.PI/(sprint?.96:.56),
    moving:!arc,sprint,leap:arc?Math.sin(Math.PI*progress):0,
    jump:arc?{from,to,arc,progress}:null
  };
}

function retreatPose(escape,time,runners){
  const {origin,ground,hideout,angle,jump,dash,walk}=escape;
  const elapsed=time-escape.time;
  if(elapsed<jump)return retreatLeg(origin,ground,elapsed/jump,origin.heading,false,.39);
  if(elapsed<jump+dash)return retreatLeg(ground,hideout,(elapsed-jump)/dash,origin.heading,true);
  if(!escape.returnAt){
    if(elapsed<jump+dash+1500||approachingRunner(hideout,runners)){
      return {...hideout,heading:angle,stride:0,moving:false,sprint:false,leap:0,jump:null};
    }
    escape.returnAt=time;
  }
  const recovery=time-escape.returnAt;
  if(recovery<walk)return retreatLeg(hideout,ground,recovery/walk,angle+Math.PI);
  if(recovery<walk+jump)return retreatLeg(ground,origin,(recovery-walk)/jump,angle+Math.PI,false,.39);
  return null;
}

function paintCoat(cat,x,y,z,section){
  if(cat.pattern==="calico"){
    if(section==="head"){
      if(x<-.027&&y>.008)return cat.mark;
      if(x>.042&&y>.025)return 0x3a3739;
      return cat.coat;
    }
    if(section==="tail")return z<-.32?0x464047:cat.mark;
    if(y>.24&&Math.sin(16*x+12*z)+Math.cos(20*z-8*y)>.43)return cat.mark;
    if(y>.21&&Math.cos(18*x-19*z)+Math.sin(12*y+14*z)>.50)return 0x423b3c;
  }else if(cat.pattern==="tuxedo"){
    if(section==="head"&&y<-.026&&Math.abs(x)<.074)return cat.paw;
    if(section==="body"&&(y<.235||z>.165&&Math.abs(x)<.092))return cat.paw;
  }else if(cat.pattern==="tabby"){
    if(section==="body"&&y<.215)return cat.paw;
    const stripe=section==="head"?Math.cos(64*x+12*z)*.7+Math.sin(51*y-11*z)*.3:
      Math.cos(z*43+Math.cos(y*13)*1.7+x*4);
    if(stripe>.63)return cat.mark;
  }
  return cat.coat;
}

function batchParts(T,parts,material){
  const positions=[],normals=[],colors=[];
  const transform=new T.Matrix4(),normalMatrix=new T.Matrix3(),object=new T.Object3D();
  const point=new T.Vector3(),normal=new T.Vector3(),tint=new T.Color();
  for(const {geometry,position,scale,rotation,color} of parts){
    object.position.set(...position);object.scale.set(...scale);
    object.rotation.set(...(rotation??[0,0,0]));object.updateMatrix();
    transform.copy(object.matrix);normalMatrix.getNormalMatrix(transform);
    const vertices=geometry.attributes.position,vertexNormals=geometry.attributes.normal;
    for(let i=0;i<vertices.count;i++){
      point.fromBufferAttribute(vertices,i).applyMatrix4(transform);
      normal.fromBufferAttribute(vertexNormals,i).applyMatrix3(normalMatrix).normalize();
      tint.setHex(typeof color==="function"?color(point.x,point.y,point.z):color);
      positions.push(point.x,point.y,point.z);
      normals.push(normal.x,normal.y,normal.z);
      colors.push(tint.r,tint.g,tint.b);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));
  return new T.Mesh(geometry,material);
}

function catModel(T,scene,cat,meshes){
  const {sphere,detail,ear,tailShape,fluffyTail,fur,plain,shadowGeometry,shadowMaterial}=meshes;
  const group=new T.Group(),upper=new T.Group(),head=new T.Group(),tail=new T.Group();
  group.name=cat.name;group.visible=false;group.scale.setScalar(cat.size);scene.add(group);
  group.add(upper);upper.add(head,tail);
  const part=(geometry,color,position,scale,rotation)=>({geometry,color,position,scale,rotation});
  const bodyCoat=(x,y,z)=>paintCoat(cat,x,y,z,"body");
  const headCoat=(x,y,z)=>paintCoat(cat,x,y,z,"head");
  const tailCoat=(x,y,z)=>paintCoat(cat,x,y,z,"tail");
  upper.add(batchParts(T,[
    part(sphere,bodyCoat,[0,.315,-.015],[.144,.134,.257]),
    part(sphere,bodyCoat,[0,.309,-.16],[.151,.144,.141]),
    part(sphere,bodyCoat,[0,.335,.145],[.121,.147,.141]),
    part(sphere,bodyCoat,[0,.392,.215],[.093,.109,.114])
  ],fur));

  const face=[part(sphere,headCoat,[0,0,0],[.122,.106,.109])],eyeParts=[];
  const white=cat.pattern==="calico"||cat.pattern==="tuxedo"||cat.pattern==="white";
  const muzzle=white?cat.paw:cat.pattern==="tabby"?0xe0c6a3:cat.coat;
  const nose=cat.pattern==="solid"||cat.pattern==="tuxedo"?0x44303b:0xb97877;
  for(const [i,side] of [-1,1].entries()){
    const tilt=[-.09,0,-side*.27],earColor=cat.pattern==="calico"?(side<0?cat.mark:0x423b3c):cat.coat;
    face.push(
      part(ear,earColor,[side*.081,.057,-.022],[.059,.131,.050],tilt),
      part(ear,cat.pattern==="solid"?0xa47c83:0xd69897,[side*.084,.071,.015],[.041,.093,.014],tilt),
      part(detail,muzzle,[side*.027,-.039,.092],[.044,.030,.037])
    );
    eyeParts.push(
      part(detail,0x34272b,[side*.052,.010,.086],[.031,.027,.019],[0,side*.25,0]),
      part(detail,cat.eyes[i],[side*.052,.011,.100],[.025,.021,.010],[0,side*.25,0]),
      part(detail,0x27252a,[side*.052,.012,.108],[.007,.017,.004],[0,side*.25,0]),
      part(detail,0xfff8ee,[side*.052-.006,.021,.109],[.005,.005,.003])
    );
    if(cat.pattern==="white"){
      face.push(part(detail,0xf5efe4,[side*.104,-.025,-.008],[.045,.041,.059],[0,0,side*.45]));
    }
    for(let line=0;line<2;line++){
      face.push(part(detail,0xe5dccc,[side*.079,-.037+line*.013,.105],[.041,.0018,.002],[0,-side*.18,side*(.07+line*.17)]));
    }
  }
  face.push(part(detail,nose,[0,-.023,.122],[.022,.015,.013]));
  const eyes=batchParts(T,eyeParts,fur);
  head.add(batchParts(T,face,fur),eyes);
  head.position.set(0,.454,.243);

  tail.add(batchParts(T,[
    part(cat.pattern==="white"?fluffyTail:tailShape,tailCoat,[0,0,0],[1,1,1])
  ],fur));
  tail.position.set(0,.312,-.240);

  const paws=new T.InstancedMesh(detail,plain,8),tint=new T.Color();
  paws.frustumCulled=false;
  paws.instanceMatrix.setUsage(T.DynamicDrawUsage);
  for(let i=0;i<8;i++)paws.setColorAt(i,tint.setHex(i%2===0?cat.coat:cat.paw));
  group.add(paws);
  const shadow=new T.Mesh(shadowGeometry,shadowMaterial);
  shadow.position.y=.023;shadow.rotation.x=-Math.PI/2;shadow.scale.set(.28,.46,1);group.add(shadow);
  return {group,upper,head,eyes,tail,paws,shadow};
}

function sharedCatMeshes(T){
  const ear=new T.BufferGeometry();
  ear.setAttribute("position",new T.Float32BufferAttribute([
    -1,0,.64, 1,0,.64, 0,1,0,
    1,0,.64, 0,0,-.70, 0,1,0,
    0,0,-.70, -1,0,.64, 0,1,0
  ],3));
  ear.computeVertexNormals();
  function makeTail(fluffy){
    const segments=14,sides=7,curve=new T.CatmullRomCurve3([
      new T.Vector3(0,0,0),new T.Vector3(.012,.075,-.124),
      new T.Vector3(.028,.20,-.234),new T.Vector3(.054,.344,-.256),
      new T.Vector3(.085,.420,-.192)
    ]);
    const geometry=new T.TubeGeometry(curve,segments,fluffy?.074:.044,sides,false);
    const positions=geometry.attributes.position;
    for(let i=0;i<=segments;i++){
      const fraction=i/segments,center=curve.getPointAt(fraction);
      const taper=fluffy ? (.70+.43*Math.sin(fraction*Math.PI))*(1-.97*fraction**7) : 1-.97*fraction**2.2;
      for(let j=0;j<=sides;j++){
        const k=i*(sides+1)+j;
        positions.setXYZ(k,center.x+(positions.getX(k)-center.x)*taper,
          center.y+(positions.getY(k)-center.y)*taper,center.z+(positions.getZ(k)-center.z)*taper);
      }
    }
    geometry.computeVertexNormals();
    return geometry.toNonIndexed();
  }
  return {
    sphere:new T.SphereGeometry(1,13,9).toNonIndexed(),
    detail:new T.SphereGeometry(1,8,6).toNonIndexed(),
    ear,tailShape:makeTail(false),fluffyTail:makeTail(true),
    fur:new T.MeshStandardMaterial({vertexColors:true,roughness:.94}),
    plain:new T.MeshStandardMaterial({roughness:.95}),
    shadowGeometry:new T.CircleGeometry(1,14),
    shadowMaterial:new T.MeshBasicMaterial({color:0x202417,transparent:true,opacity:.23,depthWrite:false})
  };
}

function fallingLeaves(T,scene,kit){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute([
    0,.055,0, -.028,.016,.004, -.033,-.016,0, 0,-.047,-.006, .033,-.012,0, .026,.025,.003, 0,0,.012
  ],3));
  geometry.setIndex([6,0,1,6,1,2,6,2,3,6,3,4,6,4,5,6,5,0]);geometry.computeVertexNormals();
  const material=new T.MeshStandardMaterial({side:T.DoubleSide,roughness:1});
  const active=[],palette=[0xd68532,0xb97432,0xecaf44,0xb15438,0xe3bd54,0xb58d41];
  const mesh=new T.InstancedMesh(geometry,material,12),object=new T.Object3D(),color=new T.Color();
  mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
  const random=randomSequence(642179);
  let nextDrop=0;
  return (now,anchor)=>{
    if(!anchor){
      mesh.count=0;active.length=0;nextDrop=0;
      return;
    }
    const x=kit.wx(anchor.x),z=kit.wz(anchor.y);
    if(now>=nextDrop){
      const nearby=(kit.trees??[]).filter(tree=>(tree.x-x)**2+(tree.z-z)**2<28**2);
      if(active.length<12&&nearby.length){
        const tree=nearby[Math.floor(random()*nearby.length)];
        const angle=random()*Math.PI*2,radius=tree.height*(.08+random()*.16);
        active.push({at:now,x:tree.x+Math.cos(angle)*radius,z:tree.z+Math.sin(angle)*radius,
          height:tree.height*(.70+random()*.21),speed:.79+random()*.39,
          phase:random()*Math.PI*2,size:.75+random()*.68,tone:palette[Math.floor(random()*palette.length)]});
      }
      nextDrop=now+1150+random()*950;
    }
    let count=0;
    for(let i=active.length-1;i>=0;i--){
      const leaf=active[i],age=(now-leaf.at)/1000,height=leaf.height-age*leaf.speed;
      if(height<=.03||(leaf.x-x)**2+(leaf.z-z)**2>42**2){active.splice(i,1);continue;}
      const wave=leaf.phase+age*1.43;
      object.position.set(leaf.x+age*.38+Math.sin(wave)*.59,height,leaf.z+Math.cos(wave*.87)*.34);
      object.rotation.set(wave*.76,wave*.49,Math.sin(wave)*.58);
      object.scale.setScalar(leaf.size*Math.min(1,height/.40));
      object.updateMatrix();mesh.setMatrixAt(count,object.matrix);mesh.setColorAt(count++,color.setHex(leaf.tone));
    }
    mesh.count=count;
    if(count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
  };
}

export function addParkLife(T,scene,kit){
  const meshes=sharedCatMeshes(T),leg=new T.Object3D(),live=[];
  const perches=new Set();
  for(const [i,spec] of cats.entries()){
    const excursion=spec.habit==="wall"?wallExcursion(spec.home,kit.catWalls??[],perches):
      spec.habit==="bench"?benchExcursion(spec.home,kit.benches??[],perches):null;
    const home=excursion?.home??findHome(spec.home);
    if(!home)continue;
    const path=makeRoute(home,randomSequence(130581+i*7919),excursion);
    live.push({...spec,...path,...catModel(T,scene,spec,meshes),x:home.x,y:home.y,
      routeAt:null,updatedAt:null,petFrom:0,petUntil:0,canPet:true,escape:null,checkAt:0});
  }
  const leaves=fallingLeaves(T,scene,kit);
  const heightAt=point=>point.height??kit.floorHeight?.(point)??0;
  function update(now,anchor,walkers=[]){
    const runners=walkers.filter(actor=>actor.running&&actor.stepping&&!actor.blocked&&
      actor.seat==null&&Math.hypot(actor.vx,actor.vy)>2.65);
    for(const cat of live){
      const previousTime=cat.updatedAt??now,time=Math.max(now,previousTime);
      const held=Math.max(0,Math.min(time,cat.petUntil)-Math.max(previousTime,cat.petFrom));
      const elapsed=time-previousTime-held;
      // Hold the shared route during interactions, then regain its phase without jumping.
      if(!cat.escape)cat.routeAt=Math.min(time,(cat.routeAt??time)+elapsed*1.28);
      cat.updatedAt=time;
      const paused=time>=cat.petFrom&&time<cat.petUntil;
      const seconds=(cat.routeAt/1000+cat.offset)%cat.duration;
      const found=cat.legs.findIndex(leg=>seconds<leg.end),index=found<0?cat.legs.length-1:found;
      const current=cat.legs[index];
      const phase=seconds-current.start,progress=Math.min(1,phase/(current.travel||1));
      const jumping=current.arc>0&&progress<1;
      const surface=progress<1?current.a:current.b;
      const onBench=!jumping&&surface.surface==="bench";
      const previousLeg=cat.legs[(index+cat.legs.length-1)%cat.legs.length];
      const previous=previousLeg.b.heading??previousLeg.heading;
      const landTime=phase-current.travel;
      const patrol={
        x:current.a.x+current.dx*progress,y:current.a.y+current.dy*progress,
        height:surface.height,approach:onBench?surface.approach:null,
        heading:shortestTurn(onBench?current.heading:previous,onBench?surface.heading:current.heading,
          Math.min(1,(onBench?landTime:phase)/.36)),
        stride:progress*current.distance*2*Math.PI/.56,
        moving:!paused&&!jumping&&progress<1&&current.travel>0,
        leap:jumping?Math.sin(Math.PI*progress):0,
        jump:jumping?{from:current.a,to:current.b,arc:current.arc,progress}:null
      };
      const reachable=!jumping&&surface.surface!=="wall";
      if(!cat.escape&&reachable&&!paused&&runners.length&&time>=cat.checkAt){
        cat.checkAt=time+110;
        const runner=approachingRunner(patrol,runners);
        if(runner)cat.escape=scareFrom(patrol,runner,time);
      }
      const retreat=cat.escape?retreatPose(cat.escape,time,runners):null;
      if(cat.escape&&!retreat){
        cat.escape=null;
        cat.checkAt=time+400;
      }
      const pose=retreat??patrol;
      const {x,y,heading,stride,jump,leap,moving,sprint}=pose;
      cat.x=x;cat.y=y;cat.canPet=reachable&&!retreat;
      cat.approach=pose.approach??null;
      cat.group.visible=Boolean(anchor&&Math.hypot(anchor.x-x,anchor.y-y)<39);
      if(!cat.group.visible)continue;
      const ground=jump?jumpHeight(heightAt(jump.from),heightAt(jump.to),jump.arc,jump.progress):heightAt(pose);
      cat.group.position.set(kit.wx(x),ground,kit.wz(y));
      cat.group.rotation.y=heading;
      const breath=Math.sin(time*.003+cat.offset);
      const petting=paused?Math.min(1,(time-cat.petFrom)/160,(cat.petUntil-time)/270):0;
      const gait=moving?Math.min(1,(time-cat.petUntil)/180)*(sprint?1.18:1):0;
      const loaf=onBench&&!retreat?Math.max(0,Math.min(1,(landTime-.20)/.44,(current.end-seconds)/.38)):0;
      const tuck=Math.max(loaf,leap*.72);
      cat.upper.position.y=Math.sin(stride*2)*.009*gait+breath*.005+petting*.023-loaf*.165;
      cat.upper.scale.set(1+loaf*.05,1-loaf*.07,1);
      cat.upper.rotation.x=jump?leap*(heightAt(jump.to)>heightAt(jump.from)?-.34:.32):sprint?.075:0;
      cat.head.rotation.x=petting*(-.27+Math.sin(time*.007)*.07)+(moving?.030:breath*.032);
      cat.head.rotation.z=petting*.16;
      cat.eyes.scale.y=1-Math.max(petting*.89,loaf*.58);
      const wag=Math.sin(time*.005+cat.offset)*(.25+petting*.12-loaf*.17);
      const lift=-.06+Math.cos(time*.004)*.08+petting*.14-loaf*.99;
      cat.tail.position.set(loaf*.08,.312,-.240+loaf*.08);
      cat.tail.scale.setScalar(1-loaf*.27);
      cat.tail.rotation.set(lift,wag+loaf*2.45,0,"YXZ");
      cat.shadow.visible=!jump&&(!onBench||Boolean(retreat));
      cat.paws.visible=loaf<.96;
      if(!cat.paws.visible)continue;
      for(let i=0;i<4;i++){
        const side=i%2===0?-1:1,front=i<2,angle=stride+((front&&side<0)||(!front&&side>0)?Math.PI:0);
        const swing=Math.sin(angle)*.085*gait,lift=Math.max(0,Math.cos(angle))*.043*gait;
        const x=side*.104,z=front?.157:-.160;
        leg.rotation.set(-swing*2+tuck*.47,0,0);leg.position.set(x,.164+lift*.46-tuck*.035,z+swing*.47);
        leg.scale.set(.048,.116-tuck*.062,.055);
        leg.updateMatrix();cat.paws.setMatrixAt(i*2,leg.matrix);
        leg.rotation.x=tuck*.47;leg.position.set(x,.048+lift+tuck*.095,z+swing+.025);leg.scale.set(.051,.043,.073);
        leg.updateMatrix();cat.paws.setMatrixAt(i*2+1,leg.matrix);
      }
      cat.paws.instanceMatrix.needsUpdate=true;
    }
    leaves(now,anchor);
  }
  function nearestCat(x,y){
    let nearest=null,best=2.2;
    for(const cat of live){
      const gap=Math.hypot(cat.x-x,cat.y-y);
      if(!cat.canPet||gap>=best||!clearSegment({x,y},cat.approach??cat))continue;
      nearest=cat;best=gap;
    }
    return nearest&&{id:nearest.id,x:nearest.x,y:nearest.y,name:nearest.name};
  }
  function pet(id,at){
    const cat=live.find(candidate=>candidate.id===id);
    const until=at+PET_MS;
    if(!cat?.canPet||!Number.isFinite(at)||until<cat.petFrom)return;
    cat.petFrom=at>cat.petUntil?at:Math.min(cat.petFrom,at);
    cat.petUntil=Math.max(cat.petUntil,until);
  }
  return {update,nearestCat,pet};
}
