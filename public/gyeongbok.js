import {
  gwanghwamun,gbSites,gbSite,gbCourts,gbLake,gbPond,gbPaths,gbLawns,gbStation,cityHallStation,subwayStops,
  wallHalf,wallNorth,at
} from "./gyeongbok-layout.js";
import {solidAt} from "./layout.js";

// Survey models can replace these hand-built halls later: drop "<id>.glb" into public/ and
// add the id here. world3d loads each file and hides the modeled group when it arrives.
export const gbSurveyModels=[];

export function buildGyeongbok(T,scene,kit,tools){
  const {box,cylinder,shape,wx,wz,rand,matte}=kit;
  const {pavilion,roof,wall,coveredWall,plot,ribbon,tree,treeMix,treeFits,bench,nameplate,block,flat,uvScale,
    treeKit,treeClearance,waterMaterial,pathClear,materials}=tools;
  const world=(east,north)=>({x:wx(gwanghwamun.x+east),z:wz(gwanghwamun.y-north)});
  const rect=(west,east,south,north)=>[at(west,south),at(east,south),at(east,north),at(west,north)];
  const stoneTint=0xb7ae99,groups=new Map();
  // Solid box in palace coordinates; top defaults to a full-height wall.
  function solid(east,north,width,depth,top){
    const p=world(east,north);
    block(p.x,p.z,width,depth,0,top);
  }
  function slab(color,east,north,width,depth,height,base=0){
    const p=world(east,north);
    return box(color,p.x,base+height/2,p.z,width,height,depth);
  }
  function masonry(east,north,width,depth,height,base=0){
    const p=world(east,north);
    const mesh=flat(new T.BoxGeometry(width,height,depth),materials.stone,p.x,base+height/2,p.z);
    return uvScale(mesh,Math.max(width,depth)/5.1,height/2.55);
  }

  // ---- Ground -------------------------------------------------------------------------
  const centre=world(0,410);
  box(0x677253,centre.x,-.36,centre.z,900,.65,1280);
  const road=world(0,-74);
  flat(new T.BoxGeometry(620,.05,30),materials.road,road.x,.012,road.z);
  plot(rect(-wallHalf,wallHalf,0,wallNorth),materials.earth,.008);
  plot(rect(-92,92,-58,0),materials.paving,.02);
  for(const {kind,west,east,south,north} of gbLawns)plot(rect(west,east,south,north),materials.garden[kind],.017);
  for(const court of [gbCourts.heungnye,gbCourts.geunjeong]){
    plot(rect(court.west+1,court.east-1,court.south+1,court.north-1),materials.court,.022);
  }
  for(const [i,{points,width,surface}] of gbPaths.entries()){
    ribbon(points,-width/2,width/2,surface==="stone"?materials.paving:materials.gravel,.03+i*.0004);
  }

  // ---- Palace wall and its gates ---------------------------------------------------------
  const wallHeight=4.7;
  const corner=(east,north)=>at(east,north);
  wall(corner(-wallHalf,0),corner(-15.6,0),wallHeight,false,false);
  wall(corner(15.6,0),corner(wallHalf,0),wallHeight,false,false);
  for(const side of [-1,1]){
    wall(corner(side*wallHalf,0),corner(side*wallHalf,323),wallHeight,false,false);
    wall(corner(side*wallHalf,337),corner(side*wallHalf,wallNorth),wallHeight,false,false);
  }
  wall(corner(-wallHalf,wallNorth),corner(-7,wallNorth),wallHeight,false,false);
  wall(corner(7,wallNorth),corner(wallHalf,wallNorth),wallHeight,false,false);

  // Gwanghwamun: a stone base with three arched passages carrying a two-storey gatehouse.
  const baseHeight=6.6,piers=[[-15.6,-10.6],[-6.2,-2.9],[2.9,6.2],[10.6,15.6]];
  for(const [west,east] of piers){
    masonry((west+east)/2,0,east-west,11.4,baseHeight);
    solid((west+east)/2,0,east-west,11.4);
  }
  for(const [west,east] of [[-10.6,-6.2],[-2.9,2.9],[6.2,10.6]]){
    const span=east-west,spring=west===-2.9?4.5:3.9;
    masonry((west+east)/2,0,span,11.4,baseHeight-spring-span*.28,spring+span*.28);
    // Rounded head of the passage.
    const arch=world((west+east)/2,0);
    const shell=new T.CylinderGeometry(span/2,span/2,11.2,18,1,true,0,Math.PI);
    shell.rotateZ(Math.PI/2);shell.rotateY(Math.PI/2);
    const vault=flat(shell,matte(0x8d897c),arch.x,spring,arch.z);
    vault.material.side=T.DoubleSide;
    slab(0x6f6a5e,(west+east)/2,0,span,11.2,.05,spring+span*.28-.03);
  }
  for(const north of [-5.5,5.5])slab(stoneTint,0,north,31.6,.42,.95,baseHeight);
  slab(0xa7a091,0,0,31.4,11.6,.2,baseHeight-.1);
  const gateSpec=gbSite.gwanghwamun;
  const gatehouse=pavilion({...gateSpec,h:6.6,raised:.3,rise:3.1,hip:true,noCollision:true});
  gatehouse.position.y=baseHeight;groups.set("gwanghwamun",gatehouse);
  // Haetae statues guard the square.
  const lump=new T.IcosahedronGeometry(1,1);
  for(const side of [-1,1]){
    slab(0xaaa598,side*27,-22,2.6,3.4,1.0);
    solid(side*27,-22,2.6,3.4,2.6);
    const p=world(side*27,-22);
    const body=shape(lump,0xb9b3a4,p.x,1.72,p.z);body.scale.set(.86,.78,1.25);
    const head=shape(lump,0xc2bcad,p.x,2.38,p.z+.86);head.scale.set(.62,.6,.6);
  }

  // ---- Buildings ------------------------------------------------------------------------
  const built=spec=>{groups.set(spec.id,pavilion(spec));return groups.get(spec.id);};
  for(const spec of gbSites){
    if(spec.kind==="gate")built({...spec,gate:true,raised:.12,h:spec.stories===2?spec.h*1.9:spec.h,rise:spec.stories===2?2.9:2.0});
    else if(spec.kind==="hall")built({...spec,raised:.55,rise:2.0+spec.w*.02});
    else if(spec.kind==="sideGate"){
      const g=built({...spec,raised:.3,rise:2.1,noCollision:true});
      const p=world(spec.east,spec.north);
      block(p.x,p.z,spec.w+1.6,spec.d+1.4,spec.angle);
      g.position.y=0;
    }else if(spec.kind==="museum"){
      const g=built({...spec,raised:1.1,rise:4.6,hip:true});
      g.name=spec.name;
    }
  }

  // Throne hall on a two-tier stone terrace. The terrace and its steps are low boxes, so
  // walkers climb them a step at a time (or hop up the side).
  const throne=gbSite.geunjeongjeon,tier=.85,riser=.17,tread=.38;
  const tiers=[{half:29,south:276,north:323,top:tier,base:0},{half:22.6,south:283,north:317,top:tier*2,base:tier}];
  for(const {half,south,north,top,base} of tiers){
    slab(stoneTint,0,(south+north)/2,half*2,north-south,top-base,base);
    solid(0,(south+north)/2,half*2,north-south,top);
    // Steps: front (wide, on the royal road), back and both sides.
    const flights=[[0,south,0,-1,9],[0,north,0,1,5],[-half,300,-1,0,5],[half,300,1,0,5]];
    for(const [east,northAt,dx,dn,width] of flights)for(let step=0;step<5;step++){
      const height=base+(step+1)*riser,out=(4.5-step)*tread;
      const e=east+dx*out,n=northAt+dn*out;
      const w=dx?tread:width,d=dx?width:tread;
      slab(0xb0ab9a,e,n,w,d,height-base,base);
      solid(e,n,w,d,height);
    }
    // Stone balustrade posts along the edge.
    for(let i=-6;i<=6;i++){
      if(Math.abs(i)<2)continue;
      for(const n of [south+.3,north-.3])slab(0xc1b9a6,i*half/6.2,n,.3,.3,.8,top);
    }
  }
  const hallGroup=pavilion({...throne,h:12.4,raised:.5,rise:4.1,hip:true});
  hallGroup.position.y=tier*2;groups.set(throne.id,hallGroup);
  // Rank stones line the royal road in the court.
  for(const side of [-1,1])for(let i=0;i<12;i++){
    slab(0x9d9e91,side*6.4,242+i*2.7,.34,.28,.62);
    solid(side*6.4,242+i*2.7,.34,.28,.62);
  }

  // Covered corridors around the courts, with gateways left open.
  function corridor(a,b,gaps=[]){
    const vertical=a[0]===b[0],from=vertical?a[1]:a[0],to=vertical?b[1]:b[0];
    let cursor=Math.min(from,to);
    const end=Math.max(from,to);
    for(const [low,high] of [...gaps].sort((p,q)=>p[0]-q[0]).concat([[end,end]])){
      if(low-cursor>.6)coveredWall(vertical?at(a[0],cursor):at(cursor,a[1]),vertical?at(a[0],low):at(low,a[1]),3.5);
      cursor=Math.max(cursor,high);
    }
  }
  const {heungnye,geunjeong,sajeong}=gbCourts;
  corridor([heungnye.west,heungnye.south],[heungnye.east,heungnye.south],[[-10,10]]);
  for(const east of [heungnye.west,heungnye.east])corridor([east,heungnye.south],[east,heungnye.north],[[190,198]]);
  corridor([heungnye.west,geunjeong.south],[heungnye.east,geunjeong.south],[[-9.6,9.6]]);
  for(const east of [geunjeong.west,geunjeong.east])corridor([east,geunjeong.south],[east,geunjeong.north],[[244,251],[330,337]]);
  corridor([geunjeong.west,geunjeong.north],[geunjeong.east,geunjeong.north],[[-6.4,6.4]]);
  for(const east of [sajeong.west,sajeong.east])corridor([east,sajeong.south],[east,sajeong.north],[[366,372]]);
  corridor([sajeong.west,sajeong.north],[sajeong.east,sajeong.north],[[-14,-9],[9,14]]);

  // Yeongjegyo: the stone bridge over the stream that crosses the first court.
  const streamNorth=180,streamWidth=5.2,bridgeHalf=5.2;
  for(const side of [-1,1]){
    const length=heungnye.east-1.2-bridgeHalf,east=side*(bridgeHalf+length/2);
    slab(0x4f7377,east,streamNorth,length,streamWidth,.05,.02);
    for(const edge of [-1,1])slab(0xa5a79e,east,streamNorth+edge*(streamWidth/2+.2),length,.4,.36);
    solid(east,streamNorth,length,streamWidth+.8,.36);
    slab(0xa2a49a,side*bridgeHalf,streamNorth,.34,streamWidth+2.2,.95);
    solid(side*bridgeHalf,streamNorth,.34,streamWidth+2.2,.95);
  }
  slab(0xb1b1a4,0,streamNorth,bridgeHalf*2,streamWidth+2.4,.08);

  // ---- Gyeonghoeru and its pond ----------------------------------------------------------
  const lake=gbLake;
  plot(rect(lake.west,lake.east,lake.south,lake.north),waterMaterial,.043);
  for(const [a,b] of [[[lake.west,lake.south],[lake.east,lake.south]],[[lake.west,lake.north],[lake.east,lake.north]],
    [[lake.west,lake.south],[lake.west,lake.north]],[[lake.east,lake.south],[lake.east,lake.north]]]){
    const length=Math.hypot(b[0]-a[0],b[1]-a[1])+.6,vertical=a[0]===b[0];
    slab(0xa9a698,(a[0]+b[0])/2,(a[1]+b[1])/2,vertical?.6:length,vertical?length:.6,.3);
  }
  const {island}=lake;
  slab(0xb3ad9d,(island.west+island.east)/2,(island.south+island.north)/2,island.east-island.west,island.north-island.south,.09);
  for(const bridge of lake.bridges){
    slab(0xb8b2a2,(bridge.west+bridge.east)/2,bridge.north,bridge.east-bridge.west+1.2,bridge.width,.1);
    for(const edge of [-1,1]){
      const n=bridge.north+edge*(bridge.width/2+.12);
      slab(0xa7a394,(bridge.west+bridge.east)/2,n,bridge.east-bridge.west,.22,.8);
      solid((bridge.west+bridge.east)/2,n,bridge.east-bridge.west,.22,.8);
    }
  }
  const lakeHall=gbSite.gyeonghoeru;
  groups.set(lakeHall.id,pavilion({...lakeHall,h:11.2,raised:.4,rise:4.2,open:true,hollow:true,hip:true}));
  // Inner rows of stone pillars carry the upper floor.
  for(let i=1;i<lakeHall.bays;i++)for(const row of [-.2,.2]){
    const east=lakeHall.east-lakeHall.w/2+i*lakeHall.w/lakeHall.bays;
    const p=world(east,lakeHall.north+row*lakeHall.d);
    cylinder(0xa9a394,p.x,2.9,p.z,.34,5.4,10);
  }
  for(const isle of lake.isles){
    const ring=Array.from({length:14},(_,i)=>at(isle.east+Math.cos(i*Math.PI/7)*isle.radius,isle.north+Math.sin(i*Math.PI/7)*isle.radius));
    plot(ring,materials.garden.lawn,.11);
  }

  // ---- Hyangwonjeong ---------------------------------------------------------------------
  const pond=gbPond;
  const ring=(radius,sides=28)=>Array.from({length:sides},(_,i)=>
    at(pond.east+Math.cos(i*2*Math.PI/sides)*radius,pond.north+Math.sin(i*2*Math.PI/sides)*radius));
  plot(ring(pond.radius+.8),matte(0x8a8878),.03);
  plot(ring(pond.radius),waterMaterial,.043);
  plot(ring(pond.island),materials.garden.lawn,.1);
  const {bridge}=pond;
  slab(0xb8a48c,bridge.east,(bridge.south+bridge.north)/2,bridge.width,bridge.north-bridge.south+1,.1,.06);
  for(const edge of [-1,1]){
    const east=bridge.east+edge*(bridge.width/2+.1);
    slab(0x7b4b38,east,(bridge.south+bridge.north)/2,.14,bridge.north-bridge.south,.85,.1);
    solid(east,(bridge.south+bridge.north)/2,.14,bridge.north-bridge.south,.95);
  }
  const hex=world(pond.east,pond.north),tower=new T.Group();
  tower.position.set(hex.x,0,hex.z);scene.add(tower);
  const tile=0x384344,timber=0x864d39;
  cylinder(0xb4ae9e,0,.35,0,5.0,.7,6,tower);
  cylinder(timber,0,2.4,0,3.5,3.4,6,tower);
  cylinder(0x476e5b,0,2.5,0,3.56,1.5,6,tower);
  cylinder(tile,0,4.75,0,5.9,1.3,6,tower,.52);
  cylinder(timber,0,6.6,0,2.7,2.5,6,tower);
  cylinder(0x476e5b,0,6.7,0,2.76,1.1,6,tower);
  cylinder(tile,0,9.0,0,5.0,2.4,6,tower,.04);
  cylinder(0x9c8a52,0,10.5,0,.22,.9,8,tower);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+Math.PI/6;
    cylinder(0x8f4936,Math.cos(a)*4.3,2.1,Math.sin(a)*4.3,.17,3.6,8,tower);
  }
  block(hex.x,hex.z,7.6,7.6);
  groups.set("hyangwonjeong",tower);

  // ---- Subway exits ----------------------------------------------------------------------
  function subwayExit(station,title,stripe){
    const x=wx(station.x),z=wz(station.y),g=new T.Group();
    g.position.set(x,0,z);g.rotation.y=station.angle;scene.add(g);g.name=station.name;
    const steel=0x56646a,glass=0x9cc2c2;
    box(0x23282b,0,.03,0,2.3,.06,5.2,g);
    for(let step=0;step<6;step++)box(step%2?0x30373a:0x3a4246,0,.04+step*.012,1.9-step*.62,2.1,.03,.6,g);
    for(const side of [-1,1]){
      box(steel,side*1.28,.14,0,.2,.28,5.5,g);
      box(glass,side*1.28,.72,0,.07,.92,5.4,g);
      box(steel,side*1.28,1.2,0,.12,.08,5.5,g);
      for(const end of [-2.65,0,2.65])box(steel,side*1.28,1.3,end,.11,2.6,.11,g);
    }
    box(steel,0,.14,-2.7,2.7,.28,.2,g);
    box(glass,0,.72,-2.7,2.5,.92,.07,g);
    box(0xd8dfdc,0,2.66,-.05,3.1,.1,5.9,g);
    box(steel,0,2.58,-.05,3.2,.09,6.0,g);
    box(stripe,0,2.3,2.86,2.9,.42,.1,g);
    nameplate(title,g,0,2.3,2.92,2.6,.36,"#f4f4ee","#1e2a30");
    // Pole sign beside the entrance.
    box(steel,1.9,1.8,2.6,.14,3.6,.14,g);
    box(stripe,1.9,3.5,2.6,1.05,.5,.16,g);
    nameplate("지하철",g,1.9,3.5,2.69,.95,.36,"#fbfbf6","#1e2a30");
    block(x,z,2.9,5.7,station.angle);
    g.updateMatrixWorld(true);
    const pole=g.localToWorld(new T.Vector3(1.9,0,2.6));
    block(pole.x,pole.z,.2,.2,0,3.7);
  }
  scene.updateMatrixWorld(true);
  subwayExit(cityHallStation,"시청 City Hall",0x00a84d);
  subwayExit(gbStation,"경복궁 Gyeongbokgung",0xef7c1c);

  // ---- Planting --------------------------------------------------------------------------
  for(const group of groups.values())treeClearance.addModel(group);
  const awayFromRoads=(x,y)=>gbPaths.every(({points,width})=>pathClear(points,x,y,width/2+1.6));
  function plant(east,north,height,choice){
    const point=at(east,north),x=wx(point.x),z=wz(point.y);
    if(solidAt(point.x,point.y)||!awayFromRoads(point.x,point.y)||!treeFits(x,z,height))return false;
    return Boolean(tree(x,z,height,choice));
  }
  for(const {kind,west,east,south,north} of gbLawns){
    if(kind==="parterre"){
      for(let i=0;i<26;i++){
        const p=world(west+rand()*(east-west),south+rand()*(north-south));
        treeKit.shrub(p.x,p.z,.5+rand()*.5,["deep","fresh","olive","maple","amber"][Math.floor(rand()*5)]);
      }
      continue;
    }
    const area=(east-west)*(north-south);
    const wanted=Math.min(22,Math.round(area/(kind==="grove"?330:900)));
    for(let attempt=0,planted=0;attempt<wanted*5&&planted<wanted;attempt++){
      if(plant(west+rand()*(east-west),south+rand()*(north-south),6+rand()*6.5,treeMix.garden()))planted++;
    }
  }
  for(const isle of gbLake.isles)plant(isle.east,isle.north,6.5,{style:"branchy",palette:"pine"});
  for(const [east,north] of [[-48,60],[48,60],[-40,110],[40,110],[-150,240],[150,360],[-44,520],[44,540],[70,446],[-70,360]]){
    plant(east,north,8+rand()*4,rand()<.5?{style:"round",palette:"ginkgo"}:treeMix.garden());
  }
  for(const [east,north,turn] of [[-88,48,Math.PI/2],[-30,104,0],[30,104,0],[-62,470,-Math.PI/2],[-30,690,0],[52,690,0]]){
    const p=world(east,north);
    if(!solidAt(p.x+300,p.z+225))bench(p.x,p.z,turn);
  }
  return {stops:subwayStops,groups};
}
