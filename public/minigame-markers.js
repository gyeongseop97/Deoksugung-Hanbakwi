import {minigamePickup,minigameTuhoJar,traditionalGames} from "./traditional-games.js";
import {addObstacle} from "./layout.js";

const signs={
  tuho:{ink:"#9e5538",mark:"#ffdfa0"},
  jegi:{ink:"#3c7063",mark:"#ecdc94"},
  kite:{ink:"#567b89",mark:"#ffdfa0"}
};

function icon(ctx,id,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/44,size/44);
  ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";
  if(id==="tuho"){
    ctx.beginPath();ctx.moveTo(-14,-4);ctx.lineTo(-10,15);ctx.quadraticCurveTo(0,20,10,15);ctx.lineTo(14,-4);ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,-4,14,4,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-1,3);ctx.lineTo(9,-19);ctx.lineTo(3,-16);ctx.moveTo(9,-19);ctx.lineTo(11,-13);ctx.stroke();
  }else if(id==="jegi"){
    ctx.beginPath();ctx.ellipse(0,13,12,4,0,0,Math.PI*2);ctx.fill();
    for(const [a,b] of [[-15,-14],[-7,-19],[1,-15],[9,-19],[16,-11]]){
      ctx.beginPath();ctx.moveTo(0,10);ctx.quadraticCurveTo(a*.45,-1,a,b);ctx.stroke();
    }
  }else{
    ctx.beginPath();ctx.moveTo(1,-18);ctx.lineTo(18,-3);ctx.lineTo(1,14);ctx.lineTo(-16,-3);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-16,-3);ctx.lineTo(18,-3);ctx.moveTo(1,-18);ctx.lineTo(1,14);ctx.quadraticCurveTo(-7,19,-1,24);ctx.stroke();
  }
  ctx.restore();
}

function painted(T,width,height,draw){
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  draw(canvas.getContext("2d"));
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return map;
}

function propKit(T,group){
  const materials=new Map(),unitBox=new T.BoxGeometry(1,1,1);
  function mesh(geometry,color,x,y,z,parent=group){
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.86}));
    const part=new T.Mesh(geometry,materials.get(color));
    part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;parent.add(part);
    return part;
  }
  function box(color,x,y,z,w,h,d){
    const part=mesh(unitBox,color,x,y,z);part.scale.set(w,h,d);return part;
  }
  function band(color,x,y,z,radius,thickness){
    const part=mesh(new T.TorusGeometry(radius,thickness,6,22),color,x,y,z);part.rotation.x=Math.PI/2;
    return part;
  }
  return {mesh,box,band};
}

function tuhoJar(T,group){
  const {mesh,box,band}=propKit(T,group);
  const profile=[[0,0],[.24,0],[.32,.045],[.41,.26],[.43,.42],[.38,.60],[.35,.66],[.39,.73],
    [.41,.775],[.34,.778],[.32,.73],[.28,.66],[.33,.54],[.37,.42],[.34,.24],[.24,.064],[0,.062]];
  mesh(new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),24),0x794e39,0,0,0);
  for(const [y,r,color] of [[.08,.344,0xa77650],[.28,.412,0x926348],[.43,.426,0xbc8d5a],[.74,.400,0xa77d55],[.769,.388,0xc39965]])
    band(color,0,y,0,r,.017);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    const glaze=box(i%2?0xc59665:0xa3724e,Math.cos(a)*.426,.481,Math.sin(a)*.426,.067,.044,.015);
    glaze.rotation.y=Math.PI/2-a;glaze.rotation.z=Math.PI/4;
  }
}

function tuhoPickup(T,group){
  const {mesh,box,band}=propKit(T,group);
  mesh(new T.CylinderGeometry(.239,.194,.51,16,true),0x76543a,0,.255,0);
  mesh(new T.CylinderGeometry(.203,.194,.030,16),0x4c382d,0,.029,0);
  for(let i=0;i<15;i++){
    const a=i*Math.PI*2/15;
    const slat=box(i%2?0x8e6343:0x9f7048,Math.cos(a)*.221,.265,Math.sin(a)*.221,.063,.486,.028);
    slat.rotation.y=Math.PI/2-a;
  }
  band(0xb29161,0,.506,0,.236,.021);band(0xa78455,0,.109,0,.202,.017);
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,stick=new T.Group();
    stick.position.set(.138*Math.cos(a),.065,.138*Math.sin(a));
    stick.rotation.z=Math.cos(a)*.15;stick.rotation.x=Math.sin(a)*.14;group.add(stick);
    const h=.88+(i%3)*.075;
    mesh(new T.CylinderGeometry(.012,.012,h,6),0xd0ad75,0,h/2,0,stick);
    for(let side=0;side<3;side++){
      const feather=mesh(new T.BoxGeometry(.010,.17,.055),i%2?0xb4543c:0xd6b77b,0,h-.095,0,stick);
      feather.rotation.y=side*Math.PI/3;
    }
  }
}

function throwLine(T,root,game,{wx,wz},groundAt){
  const group=new T.Group();group.name="투호 던지는 선";
  const {box}=propKit(T,group);
  for(let i=-9;i<=9;i++){
    const point={x:game.point.x+i*.47,y:game.point.y};
    const mark=box(i===0?0xf0d29a:0xc9aa79,wx(point.x),groundAt(point)+.036,wz(point.y),i===0?.41:.30,.016,.09);
    mark.castShadow=false;
  }
  root.add(group);
}

function jegiSetup(T,group){
  const {mesh,box}=propKit(T,group);
  const bark=0x765236,wood=0xa0754c,edge=0x5e4634;
  for(const x of [-.56,.56])for(const z of [-.27,.27]){
    box(bark,x,.248,z,.115,.49,.113);
    box(edge,x,.070,z,.153,.102,.15);
  }
  for(const side of [-1,1]){
    box(bark,0,.273,side*.27,1.19,.10,.073);
    box(bark,side*.56,.273,0,.077,.10,.54);
  }
  for(let i=0;i<5;i++)box(i%2?wood:0xa97b4e,0,.50,(i-2)*.147,1.39,.088,.143);
  box(edge,0,.536,-.361,1.40,.092,.054);box(edge,0,.536,.361,1.40,.092,.054);
  for(const side of [-1,1])box(edge,side*.676,.536,0,.050,.092,.71);
  box(0xb58b57,0,.551,0,1.245,.024,.592);
  const ribbons=[0xc44e3c,0xe3aa56,0x477c71,0xdecaa1,0x7b6079];
  for(const [i,[x,z]] of [[-.42,-.12],[-.18,.15],[.03,-.13],[.29,.13],[.48,-.10]].entries()){
    const top=new T.Group();top.position.set(x,.566,z);top.rotation.y=i*.73;group.add(top);
    mesh(new T.CylinderGeometry(.066,.082,.034,10),0x715344,0,.023,0,top);
    for(let leaf=0;leaf<8;leaf++){
      const a=leaf*Math.PI/4,c=Math.cos(a),s=Math.sin(a);
      const curve=new T.CatmullRomCurve3([new T.Vector3(c*.017,.035,s*.017),
        new T.Vector3(c*.037,.123,s*.037),new T.Vector3(c*.077,.195,s*.077),new T.Vector3(c*.119,.211,s*.119)]);
      mesh(new T.TubeGeometry(curve,8,.015,5,false),ribbons[(i+leaf)%ribbons.length],0,0,0,top);
    }
  }
}

export function registerMinigameProps(groundAt){
  const anchors=new Map();
  for(const game of traditionalGames){
    const {id,point}=game;
    if(id==="kite")continue;
    const at=id==="tuho"?minigamePickup(game):{x:point.x+3.2,y:point.y};
    const floor=groundAt(at)+.02;
    if(id==="tuho"){
      const target=minigameTuhoJar(game),jar={...target,floor:groundAt(target)+.014};
      anchors.set(id,{...at,floor,jar});
      addObstacle(at.x,at.y,.51,.51,0,floor+.54);
      addObstacle(jar.x,jar.y,.86,.86,0,jar.floor+.79);
    }else{
      anchors.set(id,{...at,floor});
      addObstacle(at.x,at.y,1.40,.78,0,floor+.58);
    }
  }
  return anchors;
}

export function addMinigameMarkers(T,root,{wx,wz},gameIds,groundAt,propAnchors){
  for(const game of traditionalGames){
    const {id,name,point}=game;
    if(!gameIds.includes(id))continue;
    const {ink,mark}=signs[id],floor=groundAt(point),x=wx(point.x),z=wz(point.y);
    const display=propAnchors?.get(id),signAt=display??{x:point.x+2.7,y:point.y};
    const label=painted(T,400,108,ctx=>{
      ctx.fillStyle="#21342c";ctx.strokeStyle="#f2cd86";ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(5,5,390,98,23);ctx.fill();ctx.stroke();
      ctx.fillStyle=ink;ctx.beginPath();ctx.arc(60,54,33,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=ctx.strokeStyle=mark;icon(ctx,id,60,54,44);
      ctx.font='700 44px "Malgun Gothic","Apple SD Gothic Neo",sans-serif';
      ctx.textBaseline="middle";ctx.fillStyle="#fff2cc";ctx.fillText(name,112,55);
    });
    const sign=new T.Sprite(new T.SpriteMaterial({map:label,transparent:true,depthWrite:false,toneMapped:false}));
    sign.name=name;sign.position.set(wx(signAt.x),groundAt(signAt)+1.72,wz(signAt.y+.65));
    sign.scale.set(2.25,.61,1);root.add(sign);
    const medallion=painted(T,192,192,ctx=>{
      ctx.fillStyle=ink;ctx.strokeStyle=mark;ctx.lineWidth=6;
      ctx.beginPath();ctx.arc(96,96,83,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.arc(96,96,71,0,Math.PI*2);ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle=mark;icon(ctx,id,96,94,88);
    });
    const disk=new T.Mesh(new T.PlaneGeometry(2.25,2.25),new T.MeshBasicMaterial({
      map:medallion,transparent:true,opacity:.87,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,toneMapped:false
    }));
    disk.rotation.x=-Math.PI/2;disk.position.set(x,floor+.07,z);root.add(disk);
    if(!display)continue;
    const props=new T.Group();props.name=id==="tuho"?"투호 화살통":"제기 진열대";
    props.position.set(wx(display.x),display.floor,wz(display.y));
    if(id==="tuho"){
      tuhoPickup(T,props);
      const jar=new T.Group();jar.name="투호 항아리";
      jar.position.set(wx(display.jar.x),display.jar.floor,wz(display.jar.y));tuhoJar(T,jar);root.add(jar);
      throwLine(T,root,game,{wx,wz},groundAt);
    }
    else jegiSetup(T,props);
    root.add(props);
  }
}
