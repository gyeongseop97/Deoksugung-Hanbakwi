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
  // Haetae statues guard the square: seated granite beasts with a curled mane, bulging eyes,
  // a wide grin, a neck bell and scales, each on a stepped pedestal, heads turned to the road.
  const granite=new Map();
  // Large rounded masses are smooth; curls, scales and toes stay faceted like chiselled stone.
  const carved=(color,flatShading)=>{
    const key=color*2+(flatShading?1:0);
    if(!granite.has(key))granite.set(key,new T.MeshStandardMaterial({color,roughness:.95,flatShading}));
    return granite.get(key);
  };
  const ball=new T.SphereGeometry(1,20,14),bead=new T.SphereGeometry(1,7,5),cube=new T.BoxGeometry(1,1,1);
  const post=new T.CylinderGeometry(.8,1,1,12),curl=new T.TorusGeometry(.27,.1,8,16,Math.PI*1.55);
  const collar=new T.TorusGeometry(.45,.055,5,14);
  const stone={body:0xb7b1a2,light:0xc7c1b2,shade:0x9a9486,dark:0x625e55};
  function haetae(headTurn){
    const statue=new T.Group(),head=new T.Group(),aim=new T.Vector3();
    const part=(geometry,color,x,y,z,sx,sy=sx,sz=sx,parent=statue)=>{
      const mesh=new T.Mesh(geometry,carved(color,geometry===bead||geometry===cube));
      mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
    };
    // Flat discs laid on an ellipsoid in staggered rows read as scales.
    const scales=(cx,cy,cz,rx,ry,rz,rows)=>{
      rows.forEach(([polar,from,to,count],row)=>{
        for(let i=0;i<count;i++){
          const turn=(from+(to-from)*(i+(row%2)*.5)/count)*Math.PI/180,tilt=polar*Math.PI/180;
          const dx=Math.sin(tilt)*Math.sin(turn),dy=Math.cos(tilt),dz=Math.sin(tilt)*Math.cos(turn);
          const scale=part(bead,row%2?stone.light:stone.body,cx+dx*rx,cy+dy*ry,cz+dz*rz,.115,.115,.045);
          scale.lookAt(aim.set(cx+dx*rx+dx/rx,cy+dy*ry+dy/ry,cz+dz*rz+dz/rz));
        }
      });
    };
    // Haunches, torso and chest of a beast sitting upright.
    part(ball,stone.body,0,.52,-.5,.72,.56,.78);
    part(ball,stone.body,0,.84,-.04,.62,.6,.72).rotation.x=-.5;
    part(ball,stone.body,0,1.03,.36,.56,.58,.46);
    part(ball,stone.body,0,1.3,.4,.46,.4,.42);
    scales(0,.52,-.5,.72,.56,.78,[[28,70,290,7],[52,60,300,10],[76,55,305,11]]);
    scales(0,.84,-.04,.62,.6,.72,[[40,50,130,3],[40,230,310,3],[66,50,130,3],[66,230,310,3]]);
    for(let i=0;i<7;i++){
      const t=i/6;
      part(bead,stone.light,0,1.42-t*.36+Math.sin(t*Math.PI)*.1,.02-t*1.0,.09,.075,.12).rotation.x=.5-t*.9;
    }
    for(const side of [-1,1]){
      part(post,stone.body,side*.34,.5,.62,.2,.98,.22);
      part(ball,stone.body,side*.37,.98,.5,.24,.3,.26);
      part(ball,stone.light,side*.34,.11,.76,.22,.12,.3);
      part(ball,stone.body,side*.56,.44,-.36,.3,.45,.5);
      part(ball,stone.light,side*.6,.1,.16,.2,.11,.34);
      for(const toe of [-1,0,1]){
        part(bead,stone.light,side*.34+toe*.13,.085,1.0-Math.abs(toe)*.04,.075);
        part(bead,stone.light,side*.6+toe*.12,.08,.46-Math.abs(toe)*.04,.07);
      }
      // Flame-shaped tufts at the shoulders.
      part(bead,stone.light,side*.5,.98,.3,.1,.2,.16).rotation.x=-.5;
      part(bead,stone.light,side*.54,.84,.16,.08,.16,.13).rotation.x=-.7;
    }
    // Tail curled up against the back with a flame tuft.
    const tail=part(curl,stone.body,0,.98,-1.1,1);
    tail.rotation.set(0,Math.PI/2,0);tail.rotateZ(-.9);
    for(const [y,z,size] of [[1.3,-.92,.13],[1.44,-.84,.1],[1.26,-.74,.09]])part(bead,stone.light,0,y,z,size*.8,size*1.3,size);
    // Collar and bell.
    part(collar,stone.shade,0,1.2,.44,1).rotation.x=Math.PI/2-.45;
    part(ball,stone.light,0,.99,.86,.13);
    part(bead,stone.dark,0,.93,.96,.05,.03,.05);
    // Head.
    head.position.set(0,1.64,.56);statue.add(head);
    const face=(geometry,color,x,y,z,sx,sy,sz)=>part(geometry,color,x,y,z,sx,sy,sz,head);
    face(ball,stone.body,0,0,0,.56,.5,.52);
    face(ball,stone.light,0,-.14,.36,.44,.26,.3);
    face(ball,stone.shade,0,-.3,.3,.38,.14,.26);
    face(ball,stone.dark,0,-.235,.35,.452,.034,.312);
    for(let i=0;i<7;i++){
      const x=(i-3)*.085,z=.35+.3*Math.sqrt(Math.max(0,1-(x/.44)**2))-.012;
      face(cube,0xdad4c5,x,-.235,z,.06,.075,.045).rotation.y=x*1.9;
    }
    for(const side of [-1,1]){
      // Fangs at the corners of the grin.
      face(bead,0xdad4c5,side*.31,-.2,.55,.04,.085,.04);
      face(ball,stone.light,side*.25,.14,.38,.135);
      face(bead,stone.dark,side*.27,.14,.49,.062,.062,.04);
      face(ball,stone.shade,side*.25,.28,.36,.2,.07,.15).rotation.z=-side*.28;
      face(bead,stone.body,side*.47,.2,-.04,.1,.17,.2);
      face(bead,stone.dark,side*.085,-.05,.735,.038,.03,.03);
      face(bead,stone.light,side*.33,-.36,.14,.09,.15,.1);
    }
    face(ball,stone.body,0,-.02,.63,.2,.12,.12);
    face(bead,stone.light,0,.5,-.02,.11,.17,.13);
    face(bead,stone.light,0,-.44,.2,.13,.17,.11);
    // Mane: two rings of curls behind the face and a ridge down the neck.
    for(let i=0;i<12;i++){
      const angle=(-48+i*276/11)*Math.PI/180;
      face(bead,i%2?stone.light:stone.body,Math.cos(angle)*.56,Math.sin(angle)*.5+.02,-.1,.16,.16,.14);
    }
    for(let i=0;i<9;i++){
      const angle=(-36+i*252/8)*Math.PI/180;
      face(bead,i%2?stone.body:stone.light,Math.cos(angle)*.45,Math.sin(angle)*.41+.02,-.34,.15,.15,.14);
    }
    for(const [x,y,z] of [[0,.2,-.5],[-.2,.02,-.5],[.2,.02,-.5],[0,-.16,-.48],[-.17,-.32,-.4],[.17,-.32,-.4]])face(bead,stone.light,x,y,z,.14);
    head.rotation.set(.06,headTurn,0);
    return statue;
  }
  for(const side of [-1,1]){
    slab(0xa29c8e,side*27,-22,3.1,4.3,.4);
    slab(0xb1ab9c,side*27,-22,2.6,3.8,.72,.4);
    slab(0xbab4a5,side*27,-22,2.8,4.0,.14,1.12);
    solid(side*27,-22,3.1,4.3,3.4);
    const p=world(side*27,-22),statue=haetae(-side*.5);
    statue.position.set(p.x,1.26,p.z);statue.scale.setScalar(1.2);statue.name="광화문 해태상";
    scene.add(statue);
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
