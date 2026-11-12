import {hanbokRental} from "./passport-data.js";
import {standBatcher,standSign} from "./regional-stands.js";

function lathe(T,points,sides=24){return new T.LatheGeometry(points.map(([x,y])=>new T.Vector2(x,y)),sides);}
function mesh(T,parent,geometry,material,x=0,y=0,z=0){
  const object=new T.Mesh(geometry,material);object.position.set(x,y,z);parent.add(object);return object;
}
function materials(T){
  return (color,options={})=>new T.MeshStandardMaterial({color,roughness:.78,...options});
}

export function makeWearables(T){
  const mat=materials(T),black=mat(0x272729),gold=mat(0xe9b762,{metalness:.28,roughness:.45});
  const red=mat(0xa83649),jade=mat(0x467e73),ivory=mat(0xf2d6a0);
  const bead=new T.SphereGeometry(1,8,6);
  const gat=new T.Group();
  const gauze=mat(0x212527,{transparent:true,opacity:.87,depthWrite:false,side:T.DoubleSide});
  mesh(T,gat,lathe(T,[[.194,.282],[.36,.254],[.50,.22],[.53,.222],[.51,.232],[.36,.266],[.194,.294]],36),gauze);
  mesh(T,gat,lathe(T,[[.207,.282],[.216,.37],[.202,.485],[.184,.539],[0,.543]],30),black);
  const rim=new T.TorusGeometry(.525,.013,7,36);rim.rotateX(Math.PI/2);
  mesh(T,gat,rim,black,0,.224);
  const band=new T.TorusGeometry(.209,.015,7,28);band.rotateX(Math.PI/2);
  mesh(T,gat,band,black,0,.295);
  for(const side of [-1,1]){
    const curve=new T.CatmullRomCurve3([[side*.28,.25,.09],[side*.291,.025,.16],[side*.15,-.229,.205],[0,-.251,.217]]
      .map(([x,y,z])=>new T.Vector3(x,y,z)));
    mesh(T,gat,new T.TubeGeometry(curve,12,.007,5),black);
  }

  const jokduri=new T.Group();
  const crown=mesh(T,jokduri,lathe(T,[[0,.305],[.151,.305],[.185,.357],[.177,.465],[.124,.515],[0,.515]],8),black);
  crown.scale.z=.83;
  mesh(T,jokduri,lathe(T,[[0,.495],[.102,.495],[.105,.514],[.08,.527],[0,.527]],12),red);
  const medallion=mesh(T,jokduri,bead,gold,0,.42,.146);medallion.scale.set(.036,.055,.011);
  for(let i=-2;i<=2;i++){
    const piece=mesh(T,jokduri,bead,i%2?jade:red,i*.036,.486-Math.abs(i)*.009,.135);
    piece.scale.set(.019,.021,.014);
  }
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const piece=mesh(T,jokduri,bead,i===3?red:ivory,side*.117,.351-i*.019,.111+i*.009);
    piece.scale.set(.012,.013,.011);
  }

  const circlet=new T.Group();
  const goldRing=new T.TorusGeometry(.289,.018,7,34);goldRing.rotateX(Math.PI/2);
  mesh(T,circlet,goldRing,gold,0,.285).scale.z=.82;
  for(let i=-3;i<=3;i++){
    const angle=i*.29,x=Math.sin(angle)*.26,z=Math.cos(angle)*.25;
    const flower=mesh(T,circlet,bead,gold,x,.316+(.069-Math.abs(i)*.013),z);
    flower.scale.set(.034,.070-Math.abs(i)*.009,.027);flower.rotation.z=-angle*.42;
    const jewel=mesh(T,circlet,bead,i%2?jade:red,x,.350-Math.abs(i)*.004,z+.021);
    jewel.scale.set(.019,.024,.012);
  }

  const maple=new T.Group();
  const leaf=new T.Shape([[0,.081],[.024,.039],[.064,.063],[.053,.017],[.087,.007],[.052,-.018],
    [.026,-.016],[.006,-.063],[-.006,-.063],[-.026,-.016],[-.052,-.018],[-.087,.007],[-.053,.017],[-.064,.063],[-.024,.039]]
    .map(([x,y])=>new T.Vector2(x,y)));
  const leafGeo=new T.ExtrudeGeometry(leaf,{depth:.014,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:1});
  mesh(T,maple,leafGeo,gold).scale.setScalar(1.05);
  mesh(T,maple,leafGeo,mat(0xbe513d),0,0,.012).scale.setScalar(.87);
  const stem=mesh(T,maple,new T.BoxGeometry(.010,.085,.009),gold,0,-.013,.032);stem.rotation.z=-.16;
  maple.position.set(.176,.362,.254);maple.rotation.z=-.33;

  const fan=new T.Group(),sector=new T.Shape();
  for(let i=0;i<=20;i++){
    const theta=-1.1+i*.11,x=Math.sin(theta)*.244,y=Math.cos(theta)*.244;
    if(!i)sector.moveTo(x,y);else sector.lineTo(x,y);
  }
  for(let i=20;i>=0;i--){const theta=-1.1+i*.11;sector.lineTo(Math.sin(theta)*.088,Math.cos(theta)*.088);}
  const fanPaper=new T.ExtrudeGeometry(sector,{depth:.008,bevelEnabled:false});
  mesh(T,fan,fanPaper,mat(0x3c8f87,{side:T.DoubleSide}));
  const ribs=new T.BoxGeometry(.008,.238,.014);
  for(let i=-5;i<=5;i++){
    const angle=i*.22;
    mesh(T,fan,ribs,i%2?ivory:gold,Math.sin(angle)*.118,Math.cos(angle)*.118,.010).rotation.z=-angle;
  }
  mesh(T,fan,bead,gold,0,.005,.017).scale.set(.025,.025,.016);
  fan.position.set(-.259,-.066,.173);fan.rotation.set(.12,-.18,-.80);
  return {headwear:{gat,jokduri,"golden-headpiece":circlet},keepsakes:{"maple-pin":maple,"folding-fan":fan}};
}

export function makeUmbrella(T){
  const group=new T.Group(),mat=materials(T),pole=mat(0x7f7667,{metalness:.45,roughness:.48});
  const panels=[mat(0x426b65,{side:T.DoubleSide}),mat(0x63847a,{side:T.DoubleSide})];
  const canopy=t=>1.18-.19*t*t;
  const ribs=new T.CylinderGeometry(.009,.010,1,7),axis=new T.Vector3(0,1,0);
  for(let i=0;i<8;i++){
    const first=i*Math.PI/4,last=(i+1)*Math.PI/4;
    const points=[],faces=[];
    for(let j=0;j<=5;j++)for(let k=0;k<=5;k++){
      const t=j/5,angle=first+(last-first)*k/5,r=t*.74;
      points.push(Math.sin(angle)*r,canopy(t),Math.cos(angle)*r);
      if(j<5&&k<5){const a=j*6+k;faces.push(a,a+6,a+1,a+1,a+6,a+7);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(points,3));
    geometry.setIndex(faces);geometry.computeVertexNormals();mesh(T,group,geometry,panels[i%2]);
    const a=new T.Vector3(0,1.12,0),b=new T.Vector3(Math.sin(first)*.741,.988,Math.cos(first)*.741);
    const mid=a.clone().lerp(b,.5),heading=b.clone().sub(a);
    const rib=mesh(T,group,ribs,pole,mid.x,mid.y,mid.z);
    rib.scale.y=heading.length();rib.quaternion.setFromUnitVectors(axis,heading.normalize());
  }
  mesh(T,group,new T.CylinderGeometry(.014,.014,1.16,10),pole,0,.584);
  mesh(T,group,new T.CylinderGeometry(.025,.025,.11,10),mat(0x6a4a3c),0,.053);
  mesh(T,group,new T.CylinderGeometry(.023,.031,.060,10),pole,0,1.196);
  const hook=new T.TorusGeometry(.051,.017,6,14,Math.PI);
  const grip=mesh(T,group,hook,mat(0x6a4a3c),.049,.015);
  grip.rotation.z=Math.PI;
  return group;
}

export function addHanbokRental(T,root,{wx,wz,box,cylinder}){
  const stand=hanbokRental.stand,group=new T.Group();
  group.name=hanbokRental.name;group.position.set(wx(stand.x),.04,wz(stand.y));group.rotation.y=stand.angle;root.add(group);
  const trim=0x6d513f,green=0x526b5a,cream=0xe0c69f;
  box(0xb6af9d,0,.062,0,7.5,.12,4.85,group);
  box(cream,0,1.37,-1.96,6.78,2.38,.22,group);
  box(green,0,.71,1.73,5.86,1.04,.58,group);
  box(0xbc9163,0,1.28,1.73,6.0,.14,.72,group);
  for(const x of [-3.32,3.32])for(const z of [-1.94,1.97])box(trim,x,1.52,z,.22,2.78,.21,group);
  for(const x of [-2.46,-1.23,0,1.23,2.46])box(trim,x,1.49,-1.819,.075,2.03,.053,group);
  box(green,0,2.79,1.95,7.29,.22,.26,group);
  for(const side of [-1,1]){
    const roof=box(0x505552,0,3.16,side*1.25,7.87,.19,2.63,group);roof.rotation.x=side*.31;
    for(let i=0;i<23;i++){
      const tile=box(i%3?0x606660:0x4b534e,(i-11)*.337,3.235,side*1.26,.110,.064,2.61,group);
      tile.rotation.x=side*.31;
    }
  }
  box(0x424942,0,3.60,0,7.98,.17,.30,group);
  standSign(T,group,"기와 한복 대여소","HANBOK",3.85,0,2.57,2.11,"#3d584e","#fae5bb",.63);
  for(const [x,top,skirt] of [[-1.73,0xe2bc9d,0xb65e69],[1.68,0x97af9e,0x655663]]){
    const display=new T.Group();display.position.set(x,1.38,-.20);group.add(display);
    cylinder(skirt,0,.255,0,.33,.50,16,display,.47);
    cylinder(top,0,.61,0,.179,.29,14,display,.97);
    for(const side of [-1,1])box(top,side*.21,.62,0,.22,.14,.16,display).rotation.z=-side*.25;
    box(0xf4ead0,0,.678,.15,.074,.166,.024,display).rotation.z=.38;
    box(0xe8c17c,.06,.586,.171,.15,.035,.026,display).rotation.z=-.20;
  }
  cylinder(0x252829,0,1.47,1.23,.30,.039,20,group);
  cylinder(0x252829,0,1.58,1.23,.108,.195,16,group,.84);
  standBatcher(T)(group);
  return group;
}
