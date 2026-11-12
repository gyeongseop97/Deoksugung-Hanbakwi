import {addObstacle} from "./layout.js";
import {at as palaceAt} from "./gyeongbok-layout.js";
import {plazaAt} from "./plaza-layout.js";
import {makeRegionalItemProps} from "./regional-item-props.js";

// Fictional shops in the museum visitor forecourt and the gap between the east-side
// office buildings. The royal precincts and their ceremonial paths stay open.
const palaceShops=[
  {kind:"coffee",name:"기와 아래 커피",subtitle:"COFFEE",east:-181,north:25,paint:0x426052,sign:"#315046",ink:"#f8e7c4"},
  {kind:"yakgwa",name:"꽃담 한과",subtitle:"YAKGWA",east:-157,north:25,paint:0x9e624b,sign:"#7f483a",ink:"#fff0ce"},
  {kind:"makgeolli",name:"달항아리 주막",subtitle:"MAKGEOLLI",east:-133,north:25,paint:0x56716b,sign:"#405d58",ink:"#f0e7d1"}
].map(shop=>({...shop,...palaceAt(shop.east,shop.north,shop.name),area:"gyeongbokgung",angle:Math.PI,w:7.1,d:4.4,h:3.81}));
const avenueShops=[
  {kind:"coffee",name:"세종로 로스터리",subtitle:"COFFEE ROASTERS",north:103,wall:0x9c9686,paint:0x3d564a,
    counter:0xa17b56,glass:0xc5d1a4,sign:"#344c42",ink:"#fff2d0"},
  {kind:"cake",name:"오후 케이크",subtitle:"CAKE & PATISSERIE",north:119,wall:0xd8c2ac,paint:0xaa696e,
    counter:0xdcaaa0,glass:0xf7d1b4,sign:"#f3d9c9",ink:"#723f4a"},
  {kind:"wine",name:"와인 서가",subtitle:"WINE BAR",north:135,wall:0x957973,paint:0x543b45,
    counter:0x80574f,glass:0xe0b490,sign:"#573a48",ink:"#f8dba1"}
].map(shop=>({...shop,...plazaAt(52.10,shop.north,shop.name),area:"gwanghwamun",angle:-Math.PI/2,w:15.94,d:7.2,h:8.4}));
const shops=[...palaceShops,...avenueShops];

export const regionalStations=shops.map(({x,y,d,angle,name,kind})=>({kind,name,
  x:x+Math.sin(angle)*(d/2+1.75),y:y+Math.cos(angle)*(d/2+1.75)}));

export function registerRegionalStands(){
  for(const {x,y,w,d,angle,h} of shops)addObstacle(x,y,w,d,angle,h);
}

export function standSign(T,parent,text,subtitle,width,x,y,z,background,ink,height=width*160/512){
  if(typeof document==="undefined")return;
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=Math.round(512*height/width);
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  const scale=canvas.height/160;
  ctx.fillStyle=background;ctx.fillRect(0,0,512,canvas.height);
  ctx.strokeStyle=ink;ctx.lineWidth=3*scale;ctx.strokeRect(8,8*scale,496,144*scale);
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=ink;
  ctx.font=`bold ${Math.round(67*scale)}px "Malgun Gothic", sans-serif`;
  ctx.fillText(text,256,(subtitle?65:80)*scale,472);
  if(subtitle){
    ctx.font=`bold ${Math.round(19*scale)}px "Segoe UI", sans-serif`;ctx.fillText(subtitle,256,124*scale,462);
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const panel=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map}));
  panel.position.set(x,y,z);parent.add(panel);
}

export function standBatcher(T){
  const finish=new T.MeshStandardMaterial({roughness:.88});
  return function batchStand(group){
    const batches=new Map();
    for(const part of group.children){
      if(part.isInstancedMesh||!part.material?.isMeshStandardMaterial||part.material.transparent||part.material.emissiveIntensity>1)continue;
      if(!batches.has(part.geometry))batches.set(part.geometry,[]);
      batches.get(part.geometry).push(part);
    }
    for(const [geometry,parts] of batches){
      if(parts.length<3)continue;
      const batch=new T.InstancedMesh(geometry,finish,parts.length);
      parts.forEach((part,i)=>{
        part.updateMatrix();batch.setMatrixAt(i,part.matrix);batch.setColorAt(i,part.material.color);
      });
      batch.computeBoundingSphere();group.remove(...parts);group.add(batch);
    }
  };
}

function addBoothRoof(T,group,{matte},w,d){
  const width=w+.86,depth=d+.89,columns=24,rows=12;
  function roofHeight(x,z){
    const side=Math.abs(x)/(width/2),eave=Math.abs(z)/(depth/2);
    const pitch=Math.max(eave,Math.max(0,(side-.73)/.27)*.76);
    return 2.72+.89*(1-pitch)**1.6+.20*side**5*eave**2;
  }
  const positions=[],indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const x=width*(col/columns-.5),z=depth*(row/rows-.5);
    positions.push(x,roofHeight(x,z),z);
    if(row===rows||col===columns)continue;
    const i=row*(columns+1)+col,j=i+columns+1;
    indices.push(i,j,i+1,j,j+1,i+1);
  }
  const shell=new T.BufferGeometry();shell.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  shell.setIndex(indices);shell.computeVertexNormals();
  const cover=new T.Mesh(shell,matte(0x424944));cover.castShadow=true;cover.receiveShadow=true;group.add(cover);

  const seams=33,sections=10,colors=[0x575d56,0x515854,0x636760,0x4b534f];
  const tiles=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,7),matte(0xffffff),seams*sections);
  const tint=new T.Color(),axis=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),heading=new T.Vector3();
  const rib=new T.Object3D();
  for(let i=0;i<seams;i++)for(let j=0;j<sections;j++){
    const x=width*(i/(seams-1)-.5),z0=depth*(j/sections-.5),z1=depth*((j+1)/sections-.5);
    a.set(x,roofHeight(x,z0)+.035,z0);b.set(x,roofHeight(x,z1)+.035,z1);
    heading.subVectors(b,a);rib.position.copy(a).lerp(b,.5);
    rib.scale.set(.052,heading.length()+.022,.052);rib.quaternion.setFromUnitVectors(axis,heading.normalize());
    rib.updateMatrix();tiles.setMatrixAt(i*sections+j,rib.matrix);
    tiles.setColorAt(i*sections+j,tint.setHex(colors[(i+Math.floor(j*.5))%colors.length]));
  }
  tiles.computeBoundingSphere();group.add(tiles);
}

export function addRegionalStands(T,root,kit,area){
  const {wx,wz,box,cylinder}=kit;
  const group=new T.Group();group.name=area==="gyeongbokgung"?"고궁박물관 앞 좌판":"세종대로 동편 상가";root.add(group);
  const batch=standBatcher(T),props=makeRegionalItemProps(T,kit);
  if(area==="gyeongbokgung"){
    const court=new T.Group(),middle=palaceAt(-155,28.5);court.position.set(wx(middle.x),0,wz(middle.y));group.add(court);
    box(0xb6af9d,0,.024,0,72,.043,17,court);
    box(0xaea593,0,.047,7.8,72,.019,.42,court);
    box(0xaea593,0,.047,-7.8,72,.019,.42,court);
    for(let i=0;i<17;i++){
      const x=(i-8)*4.2;
      box(0x9d9586,x,.047,0,.031,.007,15.5,court);
    }
    for(const z of [-4.3,-.5,3.3])box(0x9d9586,0,.047,z,71,.007,.031,court);
    const connector=palaceAt(-110,34.6);
    box(0xb3a894,wx(connector.x),.024,wz(connector.y),18.2,.040,4.8,group);
    batch(court);
  }
  for(const shop of shops){
    if(shop.area!==area)continue;
    const building=new T.Group();building.name=shop.name;
    building.position.set(wx(shop.x),area==="gyeongbokgung"?.048:0,wz(shop.y));building.rotation.y=shop.angle;
    group.add(building);
    if(area==="gyeongbokgung")booth(shop,building);else avenue(shop,building);
    batch(building);
  }

  function sample(kind,parent,x,y,z,size=1){
    if(kind==="coffee"){
      cylinder(0xeee4c6,x,y-.096*size,z,.095*size,.026*size,14,parent);
      cylinder(0xece0be,x,y,z,.070*size,.166*size,14,parent,1.22);
      cylinder(0x7a4b33,x,y+.086*size,z,.078*size,.011*size,14,parent);
      return;
    }
    const display=new T.Group();display.position.set(x,y,z);display.scale.setScalar(size);parent.add(display);props[kind](display);
  }
  function clayJar(parent,x,z,scale=1){
    cylinder(0x8c644a,x,.23*scale,z,.31*scale,.46*scale,14,parent,1.23);
    cylinder(0x956b50,x,.53*scale,z,.38*scale,.19*scale,14,parent,.70);
    cylinder(0xb58c63,x,.64*scale,z,.27*scale,.045*scale,14,parent);
  }
  function booth(shop,parent){
    const {w,d,paint}=shop,front=d/2,wood=0x6a4936,lightWood=0xab7f53;
    box(0xb8ac94,0,.076,0,w,.15,d,parent);
    box(0x6a4a3b,0,.164,0,w-.32,.10,d-.31,parent);
    box(0xd6ba8d,0,1.48,-front+.24,w-.67,2.56,.19,parent);
    for(let i=0;i<7;i++){
      const x=(i-3)*.92;
      box(wood,x,1.50,-front+.35,.068,2.55,.072,parent);
      box(0xe8d5a6,x,1.80,-front+.37,.73,1.03,.043,parent);
      for(let k=-1;k<=1;k++)box(0xa07653,x+k*.17,1.80,-front+.4,.030,1.04,.034,parent);
    }
    for(const y of [.93,1.28,2.28])box(wood,0,y,-front+.39,w-.55,.066,.082,parent);
    for(const side of [-1,1]){
      const x=side*(w/2-.27);
      for(const z of [-front+.25,front-.30]){
        box(0x938373,x,.20,z,.36,.32,.35,parent);
        box(wood,x,1.52,z,.21,2.69,.20,parent);
        box(paint,x,2.57,z,.31,.22,.30,parent);
      }
      box(wood,x,2.62,0,.27,.21,d-.22,parent);
      box(0xc2a178,x,.82,-.82,.11,1.23,2.52,parent);
      for(let i=0;i<6;i++)box(lightWood,x-side*.07,.83,-1.90+i*.41,.036,1.19,.044,parent);
      box(wood,x,.38,-.82,.13,.065,2.56,parent);
      box(wood,x,1.40,-.82,.13,.070,2.56,parent);
      cylinder(0xf0ce89,side*2.54,2.12,front-.15,.15,.30,8,parent,1.05);
      for(const y of [1.96,2.27])cylinder(wood,side*2.54,y,front-.15,.145,.048,8,parent);
      box(wood,side*2.54,2.40,front-.15,.029,.24,.028,parent);
    }
    for(const z of [-front+.26,front-.22])box(paint,0,2.60,z,w+.12,.24,.27,parent);
    const counterFront=front-.26;
    box(paint,0,.57,counterFront-.30,w-1.13,.91,.78,parent);
    box(lightWood,0,1.08,counterFront-.31,w-.87,.14,.95,parent);
    for(let i=0;i<9;i++){
      const x=(i-4)*.61;
      box(wood,x,.58,counterFront+.108,.045,.64,.038,parent);
    }
    box(lightWood,0,.36,counterFront+.11,w-1.16,.095,.07,parent);
    box(wood,0,2.355,front-.09,3.34,.72,.12,parent);
    standSign(T,parent,shop.name,shop.subtitle,3.24,0,2.355,front-.018,shop.sign,shop.ink,.63);
    const trayColor=shop.kind==="yakgwa"?0xb47d4d:0xc3a370;
    for(const x of [-1.36,0,1.36]){
      box(trayColor,x,1.164,front-.50,.89,.035,.62,parent);
      for(const dx of [-.24,.24])sample(shop.kind,parent,x+dx,1.26,front-.52,1.16);
    }
    if(shop.kind==="makgeolli")for(const [x,z,s] of [[-2.65,.65,1.22],[2.47,.45,1.46],[2.88,-.51,1.08]])clayJar(parent,x,z,s);
    if(shop.kind==="yakgwa")for(const x of [-2.35,2.35]){
      box(0xb77f56,x,1.24,front-.64,.57,.19,.42,parent);
      box(0xdec49a,x,1.342,front-.64,.58,.037,.43,parent);
    }
    if(shop.kind==="coffee")for(const x of [-2.4,2.4]){
      box(0x574b3e,x,1.38,front-.77,.56,.43,.42,parent);
      cylinder(0xb3aaa0,x,1.63,front-.77,.16,.13,10,parent);
    }
    addBoothRoof(T,parent,kit,w,d);
    box(0x50554e,0,3.65,0,w*.74,.13,.26,parent);
  }

  function avenue(shop,parent){
    const {w,d,wall,paint,counter,glass}=shop,front=d/2,lintel=4.26;
    box(0xbcb2a0,0,.087,0,w,.17,d,parent);
    box(wall,0,2.24,-front+.15,w,4.2,.30,parent);
    for(const side of [-1,1])box(wall,side*(w/2-.205),2.24,0,.41,4.2,d,parent);
    box(wall,0,6.27,0,w,4.26,d,parent);
    box(0xb6ab9b,0,8.30,front+.06,w+.04,.21,.26,parent);
    box(0xa69b8a,0,4.35,front+.058,w,.18,.23,parent);
    for(const x of [-5.6,-2.8,0,2.8,5.6]){
      box(paint,x,6.38,front+.033,2.20,2.63,.075,parent);
      box(0x526867,x,6.38,front+.077,2.03,2.43,.027,parent);
      box(0x7c8e87,x,6.83,front+.096,1.98,1.45,.020,parent);
      box(wall,x,5.02,front+.11,2.32,.11,.24,parent);
      box(0x596867,x,6.38,front+.103,.075,2.44,.045,parent);
    }
    box(paint,0,3.84,front+.027,w-.35,.85,.16,parent);
    standSign(T,parent,shop.name,shop.subtitle,5.0,0,3.84,front+.113,shop.sign,shop.ink,.73);
    box(counter,0,.39,front+.055,w-.43,.45,.20,parent);
    for(const x of [-7.35,-5.25,-3.05,-1.14,1.14,3.05,5.25,7.35])box(paint,x,1.91,front+.07,.14,2.67,.17,parent);
    for(const x of [-4.30,0,4.30])box(paint,x,3.16,front+.07,x===0?2.29:5.9,.085,.17,parent);
    box(paint,0,1.88,front-.016,1.98,2.57,.14,parent);
    box(0x696f66,0,1.87,front+.063,1.73,2.38,.024,parent);
    box(0xd8b77a,0,1.35,front+.12,.24,.079,.075,parent);
    box(0xa79a83,0,.19,front+.08,2.29,.15,.25,parent);

    for(const side of [-1,1]){
      const x=side*4.32;
      box(glass,x,1.95,front-1.25,5.68,2.37,.065,parent);
      box(counter,x,.95,front-.67,5.37,.12,.82,parent);
      box(paint,x,.62,front-.85,5.25,.55,.62,parent);
      for(const dx of [-2,-1,0,1,2])sample(shop.kind,parent,x+dx,1.15,front-.46,1.24);
    }
    const awningColors=shop.kind==="cake"?[0xe0a2a3,0xf5dbcb]:[paint,counter];
    for(let i=0;i<18;i++){
      const x=(i-8.5)*.77,color=awningColors[shop.kind==="cake"?i%2:0];
      box(color,x,3.36,front+.48,.774,.07,1.08,parent).rotation.x=.19;
      if(shop.kind==="cake"){
        const trim=cylinder(color,x,3.26,front+1.02,.387,.052,12,parent);
        trim.rotation.x=Math.PI/2;trim.scale.z=.30;
      }else box(awningColors[1],x,3.25,front+.98,.774,.078,.085,parent);
    }
    if(shop.kind==="wine"){
      for(const y of [1.47,2.12,2.70])for(const side of [-1,1]){
        box(paint,side*4.26,y,front-.98,5.54,.052,.47,parent);
        for(let i=0;i<10;i++){
          const x=side*4.26+(i-4.5)*.52,color=[0x4d5440,0x694638,0x524238][i%3];
          cylinder(color,x,y+.15,front-.85,.081,.25,10,parent,.95);
          cylinder(color,x,y+.29,front-.85,.077,.054,10,parent,.41);
          cylinder(0xb8906b,x,y+.35,front-.85,.033,.085,8,parent);
          box(0xc3aa8a,x,y+.13,front-.763,.103,.092,.011,parent);
        }
      }
    }else if(shop.kind==="coffee"){
      box(0x6e6a5c,-4.46,1.42,front-.85,1.35,.75,.54,parent);
      box(0xa8aaa2,-4.46,1.51,front-.54,1.16,.43,.10,parent);
      for(const dx of [-.35,.35]){
        cylinder(0x463f37,-4.46+dx,1.28,front-.44,.096,.075,10,parent);
        box(0x4a3c31,-4.46+dx,1.30,front-.34,.062,.044,.18,parent);
      }
      for(const x of [3.05,4.30,5.55])box(paint,x,2.55,front-.93,1.03,.65,.043,parent);
    }else{
      for(const x of [-4.1,4.1]){
        box(0xf0d1c4,x,.96,front-.34,4.64,.12,.11,parent);
        box(0xd0a19a,x,1.29,front-.57,4.63,.045,.51,parent);
        box(0xdfb5a7,x,1.56,front-.72,4.63,.045,.40,parent);
      }
    }
    box(wall,0,lintel,front-.09,w-.20,.12,.48,parent);
  }
  return group;
}
