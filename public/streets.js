import {
  route,entranceWalk,pavilions,city,estateOutline,palacePaths,palaceCourts,palaceGardens,palacePond,palaceWalls,
  gate,ticket,ticketGuide,bridge,middle,hall,stoneHall,stoneFountain,court,courtAngle,fountain,garden,spawn,addObstacle,solidAt
} from "./layout.js";
import {buildWestern} from "./western.js";
import {fromBuilding,pavilionStairAccess} from "./museum.js";

export function buildJeongdong(T,scene,kit) {
  const {box,cylinder,shape,wx,wz,rand,matte}=kit;
  const benches=[],trees=[],catWalls=[];
  const autumn=[0xe9b940,0xd6a736,0xc99728,0xffcb52,0xba8731,0xe5a943];
  const leaf=new T.IcosahedronGeometry(1,1);
  const branch=new T.CylinderGeometry(.67,1,1,7);
  const up=new T.Vector3(0,1,0);
  const stone=[0x939188,0xa19e92,0x807f76,0xb7b0a4,0x9e9b90];
  const placed=(point)=>({x:wx(point.x),z:wz(point.y)});
  const block=(x,z,w,d,angle=0,top)=>addObstacle(x+300,z+225,w,d,angle,top);
  function blockLocal(site,x,z,w,d,top){
    const position=fromBuilding(site,x,z);
    addObstacle(position.x,position.y,w,d,site.angle??0,top);
  }
  const orient=(object,angle)=>{object.rotation.y=angle;return object;};
  const flat=(geometry,material,x,y,z)=>{
    const mesh=new T.Mesh(geometry,material);
    mesh.position.set(x,y,z);scene.add(mesh);return mesh;
  };
  function grain(colors,{stones=false,red=false}={}) {
    const canvas=document.createElement("canvas");
    canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=colors[0];ctx.fillRect(0,0,512,256);
    if(stones){
      for(let row=0;row<6;row++)for(let j=-1;j<10;j++){
        const x=j*55+row%2*24,y=row*43;
        ctx.fillStyle=colors[1+(row*7+(j+10)*3)%(colors.length-1)];
        ctx.beginPath();
        ctx.moveTo(x+2,y+8);ctx.lineTo(x+10,y+2);ctx.lineTo(x+50,y+2);
        ctx.lineTo(x+54,y+8);ctx.lineTo(x+53,y+34);ctx.lineTo(x+48,y+40);
        ctx.lineTo(x+7,y+40);ctx.lineTo(x+2,y+34);ctx.fill();
        ctx.fillStyle=red?"#d49b822e":"#f9e5c449";ctx.fillRect(x+9,y+3,38,2);
        ctx.fillStyle="#24252648";ctx.fillRect(x+6,y+37,43,3);
      }
    }
    const pixels=ctx.getImageData(0,0,512,256);
    for(let i=0;i<pixels.data.length;i+=4){
      const variation=(rand()-.5)*(stones?29:22);
      for(let c=0;c<3;c++)pixels.data[i+c]+=variation;
    }
    ctx.putImageData(pixels,0,0);
    const tex=new T.CanvasTexture(canvas);
    tex.wrapS=tex.wrapT=T.RepeatWrapping;
    tex.colorSpace=T.SRGBColorSpace;
    tex.anisotropy=4;
    return tex;
  }
  const wallMap=grain(["#504c45","#9f9a89","#9b988d","#a5a194","#908b81","#817e74"],{stones:true});
  const brickMap=grain(["#82746a","#a1644d","#aa6b55","#9a5d48","#ac6c51"],{stones:true,red:true});
  const stoneFloor=grain(["#938d7b","#b5ad9a","#b9b09c","#b1ab9d","#bfb8a8"],{stones:true});
  const groundMap=grain(["#9b9688"]);
  const asphalt=grain(["#747670"]);
  const gardenMaterials={
    lawn:new T.MeshStandardMaterial({map:grain(["#677849"]),roughness:1}),
    grove:new T.MeshStandardMaterial({map:grain(["#656e4a"]),roughness:1}),
    parterre:new T.MeshStandardMaterial({map:grain(["#738254"]),roughness:1})
  };
  const stoneMaterial=new T.MeshStandardMaterial({map:wallMap,roughness:.93});
  const pavingMaterial=new T.MeshStandardMaterial({map:stoneFloor,roughness:.91});
  const roadMaterial=new T.MeshStandardMaterial({map:asphalt,roughness:1});
  const earthMaterial=new T.MeshStandardMaterial({map:groundMap,roughness:1});
  const brickMaterial=new T.MeshStandardMaterial({map:brickMap,roughness:.89});
  function uvScale(mesh,u,v){
    const uv=mesh.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);
    return mesh;
  }
  function paved(x,z,w,d,y=.024,angle=0,material=pavingMaterial){
    const surface=flat(new T.PlaneGeometry(w,d),material,x,y,z);
    surface.rotation.order="YXZ";surface.rotation.set(-Math.PI/2,angle,0);
    uvScale(surface,w/6,d/2.5);
    return surface;
  }
  const floor=box(0x677253,0,-.36,0,1320,.65,1140);
  floor.receiveShadow=true;
  function plot(points,material,height){
    const footprint=new T.Shape(points.map(point=>new T.Vector2(wx(point.x),-wz(point.y))));
    const geometry=new T.ShapeGeometry(footprint);
    uvScale({geometry},.19,.19);
    const surface=flat(geometry,material,0,height,0);
    surface.rotation.x=-Math.PI/2;
    return surface;
  }
  function ribbon(points,min,max,material,height){
    const coords=[],uv=[],indices=[];
    let metres=0;
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      if(i)metres+=Math.hypot(p.x-a.x,p.y-a.y);
      const length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=(b.y-a.y)/length,nz=-(b.x-a.x)/length;
      for(const offset of [min,max]){
        coords.push(wx(p.x)+nx*offset,height,wz(p.y)+nz*offset);
        uv.push(metres/5,(offset-min)/2.5);
      }
      if(i){const j=i*2;indices.push(j-2,j,j-1,j-1,j,j+1);}
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(coords,3));
    geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    if(geo.attributes.normal.getY(0)<0){geo.setIndex(indices.reverse());geo.computeVertexNormals();}
    return flat(geo,material,0,0,0);
  }
  const curb=matte(0xc5bcaa), gold=matte(0xc5a35a);
  ribbon(route,-2.85,2.85,roadMaterial,.012);
  ribbon(route,-5.30,-2.85,pavingMaterial,.044);
  ribbon(route,2.85,5.36,pavingMaterial,.045);
  ribbon(route,-2.95,-2.78,curb,.060);
  ribbon(route,2.78,2.95,curb,.060);
  ribbon(route,-2.65,-2.57,gold,.020);
  ribbon(route,2.57,2.65,gold,.020);
  ribbon(entranceWalk,-7.2,7.2,pavingMaterial,.039);
  plot(estateOutline,earthMaterial,.008);
  for(const {outline,kind} of palaceGardens)plot(outline,gardenMaterials[kind],.017);
  for(const {outline,kind} of palaceCourts)plot(outline,kind==="stone"?pavingMaterial:earthMaterial,.022);
  for(const [i,{points,width,surface}] of palacePaths.entries()){
    const half=width/2,height=.028+i*.0003;
    ribbon(points,-half,half,surface==="stone"?pavingMaterial:earthMaterial,height);
    if(surface==="gravel"){
      ribbon(points,-half-.12,-half+.02,curb,height+.022);
      ribbon(points,half-.02,half+.12,curb,height+.022);
    }
  }
  const s=placed(spawn);
  paved(s.x-1,s.z+4,39,39,.025);
  const avenue=[{x:gate.x+23,y:40},{x:gate.x+25,y:433}];
  ribbon(avenue,-5.7,-3.7,pavingMaterial,.040);
  ribbon(avenue,-3.7,18.0,roadMaterial,.013);
  ribbon(avenue,9.8,9.91,matte(0xe1c66d),.024);
  for(let i=0;i<17;i++)box(0xf1e4c6,s.x+6+i*.93,.029,s.z+23,.54,.014,3.6);
  const plaza=placed(city[0]);
  paved(plaza.x,plaza.z,city[0].w,city[0].d,.032);

  function line(a,b,offset=0){
    const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
    return {len,angle,at(t,o=offset){return{x:wx(a.x)+dx*t+dz/len*o,z:wz(a.y)+dz*t-dx/len*o};}};
  }
  function wall(a,b,offset=0,height=3.05,tiles=true,catAccess=false){
    const segment=line(a,b,offset),mid=segment.at(.5);
    const wallMesh=flat(new T.BoxGeometry(segment.len+.2,height,.55),stoneMaterial,mid.x,height/2,mid.z);
    uvScale(wallMesh,segment.len/5.1,height/2.55);
    orient(wallMesh,segment.angle);
    orient(box(0x898678,mid.x,.18,mid.z,segment.len+.28,.35,.72),segment.angle);
    orient(box(0x39413d,mid.x,height+.08,mid.z,segment.len+.26,.20,.85),segment.angle);
    orient(box(0x4e5554,mid.x,height+.22,mid.z,segment.len+.27,.13,.62),segment.angle);
    const capHeight=height+(tiles?.382:.285);
    block(mid.x,mid.z,segment.len+.2,.62,segment.angle,capHeight);
    if(catAccess&&segment.len>4){
      const toMap=({x,z})=>({x:x+300,y:z+225});
      catWalls.push({a:toMap(segment.at(0)),b:toMap(segment.at(1)),
        height:capHeight,sides:tiles?[1]:[1,-1]});
    }
    if(!tiles)return;
    const count=Math.ceil(segment.len/.46);
    for(let i=0;i<count;i++){
      const p=segment.at((i+.5)/count);
      const tile=cylinder(i%6===0?0x5d6663:0x3d494b,p.x,height+.28,p.z,.102,.91,6);
      tile.rotation.order="YXZ";tile.rotation.set(Math.PI/2,segment.angle,0);
    }
  }
  function coveredWall(a,b,height){
    const segment=line(a,b),mid=segment.at(.5),width=segment.len+.08;
    const support=flat(new T.BoxGeometry(width,.64,.63),stoneMaterial,mid.x,.32,mid.z);
    orient(uvScale(support,width/5.1,.28),segment.angle);
    orient(box(0x967458,mid.x,height/2+.23,mid.z,width,height-.43,.34),segment.angle);
    orient(box(0x80513c,mid.x,height-.30,mid.z,width,.19,.48),segment.angle);
    orient(box(0x485250,mid.x,height+.04,mid.z,width,.25,.92),segment.angle);
    orient(box(0x52615d,mid.x,height+.21,mid.z,width,.17,.51),segment.angle);
    const count=Math.max(2,Math.ceil(segment.len/2.6));
    for(let i=0;i<=count;i++){
      const {x,z}=segment.at(i/count);
      orient(box(0x86523c,x,height/2+.06,z,.18,height+.12,.49),segment.angle);
    }
    block(mid.x,mid.z,width,.62,segment.angle,height+.30);
  }
  for(let i=1;i<=9;i++)wall(route[i-1],route[i],-5.47,3.18,true,true);
  for(const {a,b,height,kind} of palaceWalls){
    if(kind==="corridor")coveredWall(a,b,height);
    else wall(a,b,0,height,false,kind==="court");
  }

  function shade(x,z,rx,rz){
    const canvas=shade.canvas||(shade.canvas=(()=>{
      const c=document.createElement("canvas");c.width=c.height=48;
      const c2=c.getContext("2d"),g=c2.createRadialGradient(24,24,3,24,24,24);
      g.addColorStop(0,"rgba(24,34,23,0.50)");g.addColorStop(.55,"rgba(30,39,28,0.23)");
      g.addColorStop(1,"rgba(30,39,28,0)");c2.fillStyle=g;c2.fillRect(0,0,48,48);return c;
    })());
    if(!shade.material)shade.material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false});
    const shadow=flat(new T.PlaneGeometry(rx*2,rz*2),shade.material,x+rx*.38,.081,z+rz*.34);
    shadow.rotation.x=-Math.PI/2;
  }
  function limb(x,y,z,dx,dy,dz,r){
    const axis=new T.Vector3(dx,dy,dz),mesh=shape(branch,0x6c5540,x+dx/2,y+dy/2,z+dz/2);
    mesh.scale.set(r,axis.length(),r);mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  }
  function tree(x,z,height,palette=autumn){
    trees.push({x,z,height});
    const sway=(rand()-.5)*.85;
    limb(x,0,z,sway,height*.73,.12,height*.043);
    block(x,z,height*.092,height*.092,0,height*.73);
    for(let i=0;i<5;i++){
      const a=i*1.256+rand()*.3;
      limb(x,.22,z,Math.cos(a)*height*.102,-.21,Math.sin(a)*height*.102,height*.03);
    }
    for(let i=0;i<7;i++){
      const a=i*.898+rand()*.4,r=height*(.17+rand()*.14),from=height*(.38+i*.041),rise=height*(.22+rand()*.15);
      const dx=Math.cos(a)*r,dz=Math.sin(a)*r;
      limb(x+sway*.65,from,z,dx,rise,dz,height*.020);
      for(let j=0;j<4;j++){
        const a2=a+(j-1.5)*.69,spread=height*(.047+rand()*.075);
        const tx=x+sway*.65+dx+Math.cos(a2)*spread,tz=z+dz+Math.sin(a2)*spread;
        const crown=shape(leaf,palette[(i*3+j)%palette.length],tx,from+rise+(rand()-.32)*height*.15,tz);
        const size=height*(.107+rand()*.071);
        crown.scale.set(size*1.17,size*.68,size*(.91+rand()*.33));
        crown.rotation.set(rand()*.45,rand()*6.28,rand()*.47);
      }
    }
    for(let j=0;j<5;j++){
      const crown=shape(leaf,palette[j%palette.length],x+sway+(rand()-.5)*height*.29,height*(.79+rand()*.16),z+(rand()-.5)*height*.25);
      crown.scale.set(height*.18,height*.117,height*.15);crown.rotation.y=rand()*6.28;
    }
    shade(x,z,height*.36,height*.30);
  }
  function contains(points,x,y){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }
  function awayFromPaths(x,y,clearance){
    return palacePaths.every(({points,width})=>{
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
        if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<width/2+clearance)return false;
      }
      return true;
    });
  }
  function plantGardens(){
    const foliage=[0x64734b,0x7e8c53,0x526740,0x879259];
    for(const {outline,kind} of palaceGardens){
      const xs=outline.map(p=>p.x),ys=outline.map(p=>p.y);
      const minX=Math.min(...xs),minY=Math.min(...ys);
      const w=Math.max(...xs)-minX,d=Math.max(...ys)-minY;
      const spots=[];
      const maxTrees=kind==="grove"?Math.min(5,Math.floor(w*d/180)):kind==="lawn"?1:0;
      for(let i=0;i<maxTrees*5&&spots.length<maxTrees;i++){
        const x=minX+rand()*w,y=minY+rand()*d;
        if(!contains(outline,x,y)||solidAt(x,y)||!awayFromPaths(x,y,1.4)||
           spots.some(spot=>Math.hypot(spot.x-x,spot.y-y)<5))continue;
        spots.push({x,y});
        tree(wx(x),wz(y),5.5+rand()*5,spots.length%3?foliage:autumn);
      }
      if(kind==="parterre"||kind==="grove"){
        for(let i=0;i<outline.length;i++){
          const a=outline[i],b=outline[(i+1)%outline.length],edge=line(a,b);
          const count=Math.floor(edge.len/(kind==="parterre"?1.7:3.2));
          for(let j=0;j<count;j++){
            const {x,z}=edge.at((j+.50)/count);
            if(solidAt(x+300,z+225)||!awayFromPaths(x+300,z+225,.47))continue;
            const r=.53+rand()*.45,shrub=shape(leaf,foliage[j%foliage.length],x,r*.38,z);
            shrub.scale.set(r,r*.62,r*.83);shrub.rotation.y=rand()*6.28;
          }
        }
      }
    }
  }
  function addPond(){
    const {outline,x,y}=palacePond;
    const bank=outline.map(p=>{
      const dx=p.x-x,dy=p.y-y,scale=1+.72/(Math.hypot(dx,dy)||1);
      return {x:x+dx*scale,y:y+dy*scale};
    });
    plot(bank,matte(0x7e8070),.026);
    const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{clock:{value:0},night:{value:0}}]);
    plot(outline,new T.ShaderMaterial({
      uniforms,fog:true,
      vertexShader:`
        varying vec2 lake;
        #include <fog_pars_vertex>
        void main() {
          lake=position.xy;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader:`
        varying vec2 lake;
        uniform float clock,night;
        #include <fog_pars_fragment>
        void main() {
          vec2 p=lake;
          float broad=sin(p.x*.48+p.y*.14+clock*.27)*sin(p.y*.39-p.x*.18-clock*.23);
          float narrow=sin(p.x*3.45+p.y*.73+sin(p.y*.89)*1.5+clock*.75);
          float ripple=pow(.5+.5*narrow,9.0)*(.5+.5*broad);
          vec3 depth=mix(vec3(.067,.185,.168),vec3(.019,.045,.075),night);
          vec3 reflectedSky=mix(vec3(.35,.53,.55),vec3(.10,.18,.28),night);
          gl_FragColor=vec4(mix(depth,reflectedSky,.31+broad*.13+ripple*.29),1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `
    }),.043);
    for(let i=0;i<bank.length;i++){
      const edge=line(bank[i],bank[(i+1)%bank.length]),count=Math.ceil(edge.len/.76);
      for(let j=0;j<count;j++){
        const point=edge.at((j+.5)/count,(rand()-.5)*.18);
        const rock=shape(leaf,stone[j%stone.length],point.x,.084,point.z);
        rock.scale.set(.38+rand()*.17,.115+rand()*.10,.27+rand()*.13);
        rock.rotation.y=rand()*6.28;
      }
    }
    return (clock,night)=>{uniforms.clock.value=clock;uniforms.night.value=night;};
  }
  const singleLeaf=new T.PlaneGeometry(1,1);
  for(let i=1;i<route.length;i++){
    const street=line(route[i-1],route[i]);
    const count=Math.ceil(street.len/12);
    for(let j=0;j<count;j++){
      const side=(i+j)%3===0?-1:1;
      const p=street.at((j+.40)/count,side<0?-6.5:5.6);
      tree(p.x,p.z,6.8+rand()*4.1,side<0?[0xd6a42d,0xe9bc4a,0xab8a37,0xcfa547]:autumn);
    }
    for(let j=0;j<Math.ceil(street.len*2.4);j++){
      const side=j%2===0?1:-1,p=street.at(rand(),side*(3.2+rand()*1.9));
      const item=shape(singleLeaf,autumn[j%autumn.length],p.x,.075,p.z);
      item.rotation.set(-Math.PI/2,0,rand()*6.28);
      item.scale.set(.053+rand()*.075,.037+rand()*.068,1);
    }
  }

  function bench(x,z,angle=0){
    const group=new T.Group();group.position.set(x,0,z);group.rotation.y=angle;scene.add(group);
    for(let i=0;i<4;i++)box(0x85593b,0,.47,(i-1.5)*.114,2.18,.075,.105,group);
    for(let i=0;i<3;i++)box(0x976648,0,.62+i*.116,-.24,2.18,.083,.077,group);
    for(const side of [-1,1]){
      box(0x384747,side*.83,.23,0,.088,.48,.58,group);
      box(0x43504b,side*.83,.66,-.25,.077,.71,.092,group);
      box(0x44514d,side*1.06,.66,.021,.071,.075,.44,group);
    }
    block(x,z,2.21,.61,angle,1);
    const xMap=x+300,yMap=z+225;
    const heading=(Math.atan2(Math.sin(angle),-Math.cos(angle))*180/Math.PI+360)%360;
    const slots=[-.50,.50].map(offset=>{
      const x=xMap+Math.cos(angle)*offset,y=yMap-Math.sin(angle)*offset;
      return {x,y,heading,approach:{x:x+Math.sin(angle)*.87,y:y+Math.cos(angle)*.87}};
    });
    const frontX=Math.sin(angle),frontY=Math.cos(angle);
    benches.push({x:xMap,y:yMap,slots,catPerch:{
      x:xMap+frontX*.132,y:yMap+frontY*.132,height:.5075,heading:angle,
      approach:{x:xMap+frontX*1.23,y:yMap+frontY*1.23}
    }});
  }
  const lampMaterial=new T.MeshStandardMaterial({color:0xf0d6a0,emissive:0xffae53,emissiveIntensity:.03,roughness:.64});
  function lamp(x,z,height=3.42){
    cylinder(0x3d4845,x,height*.465,z,.055,height*.93,8);
    cylinder(0x45534f,x,.15,z,.133,.29,8);
    flat(new T.BoxGeometry(.25,.34,.25),lampMaterial,x,height,z);
    box(0x344745,x,height+.21,z,.36,.11,.36);
    block(x,z,.23,.23,0,height+.27);
  }
  for(const [i,t] of [[1,.27],[2,.62],[4,.40],[6,.49],[8,.30],[10,.46]]){
    const street=line(route[i],route[i+1]),b=street.at(t,4.55),l=street.at(t+.16,4.94);
    bench(b.x,b.z,street.angle);
    lamp(l.x,l.z);
  }
  bench(s.x-5.5,s.z-3.9,-Math.PI/2);
  lamp(s.x-3.9,s.z-6.3);
  const gd=placed(garden);
  paved(gd.x,gd.z,12,10,.035);
  bench(gd.x-2.1,gd.z+2.2,Math.PI);
  bench(gd.x+2.1,gd.z+2.2,Math.PI);
  tree(gd.x+3.8,gd.z+3.3,8.9);

  function nameplate(text,parent,x,y,z,width,height,background="#26322b",color="#ead1a1"){
    const c=document.createElement("canvas");c.width=480;c.height=120;
    const ctx=c.getContext("2d");ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(8,8,464,104);
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=color;
    ctx.font='bold 59px "Malgun Gothic", sans-serif';ctx.fillText(text,240,61,430);
    const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
    const sign=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,side:T.DoubleSide}));
    sign.position.set(x,y,z);parent.add(sign);return sign;
  }

  function facade(spec){
    const {x,z}=placed(spec),group=new T.Group();
    const {w,d,h}=spec;
    group.position.set(x,0,z);scene.add(group);block(x,z,w,d);
    const primary=spec.brick?0x975c49:0xb5b3a8;
    const shell=box(primary,0,h/2,0,w,h,d,group);
    if(spec.brick){
      shell.geometry=new T.BoxGeometry(w,h,d);
      shell.scale.setScalar(1);shell.material=brickMaterial;uvScale(shell,w/7,h/2.7);
    }
    const trim=spec.brick?0xb98670:0xcec7b8;
    box(trim,0,.35,0,w+.22,.7,d+.24,group);
    box(trim,0,h-.46,0,w+.45,.38,d+.43,group);
    box(spec.brick?0x5b514b:0x6c7876,0,h-.08,0,w+.16,.31,d+.13,group);
    const floors=Math.max(2,Math.floor(h/3.35)),bays=Math.max(3,Math.round(w/3.0));
    const step=(h-1.0)/floors;
    for(const side of [-1,1])for(let floor=0;floor<floors;floor++){
      const y=1.35+floor*step;
      box(trim,0,y-.75,side*(d/2+.025),w,.075,.12,group);
      for(let i=0;i<bays;i++){
        const px=(i-(bays-1)/2)*w/bays;
        box(trim,px,y,side*(d/2+.06),1.51,1.93,.13,group);
        box((i+floor)%3===0?0x73919c:0x516e7a,px,y,side*(d/2+.14),1.23,1.66,.063,group);
        box(trim,px,y,side*(d/2+.183),.047,1.66,.035,group);
        box(trim,px,y+.15,side*(d/2+.184),1.23,.044,.036,group);
      }
    }
    if(spec.church){
      const towerX=-w*.25;
      box(0x9c604b,towerX,h-2,-d*.38,4.35,h+4.7,4.4,group);
      box(0xb6856d,towerX,h+3.9,-d*.38,4.59,.24,4.61,group);
      orient(cylinder(0x5c6267,towerX,h+6.25,-d*.38,3.25,4.45,4,group,0),Math.PI/4);
      box(0x5b4b44,towerX,h+8.75,-d*.38,.11,1.1,.11,group);
      box(0x5b4b44,towerX,h+8.82,-d*.38,.69,.09,.09,group);
    }
  }
  for(const spec of city.slice(1))facade(spec);
  for(let i=0;i<8;i++){
    const x=s.x+61+rand()*100,z=s.z-150+i*43;
    const w=17+rand()*19,h=22+rand()*36,d=16+rand()*22;
    box(i%2===0?0xa6b4bb:0x91a3ad,x,h/2,z,w,h,d);
    for(let row=0;row<Math.floor(h/3.8);row++)box(0x8198a4,x-w/2-.04,2.4+row*3.8,z,.085,1.5,d*.83);
  }

  function roof(group,w,d,y,rise,hip=true){
    const geometry=new T.BufferGeometry(),data=[];
    const levels=7,rows=13,ridge=w*(hip?.30:.42);
    function surface(face,t,u){
      const horizontal=face<2,side=face%2===0?-1:1;
      const lift=rise*(.36*t+.64*t*t)+Math.abs(u)**5*.43*(1-t)**2;
      if(horizontal)return [u*(w/2*(1-t)+ridge*t),y+lift,side*d/2*(1-t)];
      return [side*(w/2*(1-t)+ridge*t),y+lift,u*d/2*(1-t)];
    }
    for(let f=0;f<4;f++){
      for(let a=0;a<levels;a++)for(let b=0;b<rows;b++){
        const v1=surface(f,a/levels,2*b/rows-1),v2=surface(f,(a+1)/levels,2*b/rows-1);
        const v3=surface(f,(a+1)/levels,2*(b+1)/rows-1),v4=surface(f,a/levels,2*(b+1)/rows-1);
        data.push(...v1,...v2,...v3,...v1,...v3,...v4);
      }
      const count=Math.round((f<2?w:d)/.40);
      for(let b=0;b<=count;b++){
        const u=2*b/count-1;
        for(let a=0;a<4;a++){
          const start=surface(f,a*.23,u),end=surface(f,(a+1)*.23,u);
          const axis=new T.Vector3(end[0]-start[0],end[1]-start[1],end[2]-start[2]);
          const tile=cylinder(b%6===0?0x53615f:0x394543,(start[0]+end[0])/2,(start[1]+end[1])/2+.046,(start[2]+end[2])/2,.074,axis.length()+.04,6,group);
          tile.quaternion.setFromUnitVectors(up,axis.normalize());
        }
      }
    }
    geometry.setAttribute("position",new T.Float32BufferAttribute(data,3));geometry.computeVertexNormals();
    const roofMesh=shape(geometry,0x384344,0,0,0,group);roofMesh.material.side=T.DoubleSide;
    box(0x58605a,0,y+rise+.03,0,ridge*2+.18,.25,.32,group);
    for(const side of [-1,1])for(let i=0;i<Math.floor(w/.39);i++){
      const x=-w*.48+i*.39;
      box(i%3===0?0x915c42:0x31584b,x,y-.15,side*(d/2-.22),.17,.19,.66,group);
    }
  }
  function pavilion(spec){
    const {x,z}=placed(spec),g=new T.Group();
    const {w,d,h,bays,angle=0}=spec;
    g.position.set(x,0,z);g.rotation.y=angle;scene.add(g);
    const raised=spec.raised??.39,lo=(n)=>-w/2+n*w/bays;
    box(0xb4ae9e,0,raised/2,0,w+1.4,raised,d+1.1,g);
    if(!spec.gate){
      const access=pavilionStairAccess.get(spec.name);
      if(access){
        const width=w+1.40,depth=d+1.10,sideWidth=(width-access.width)/2;
        for(const side of [-1,1])blockLocal(spec,side*(access.width+sideWidth)/2,0,sideWidth,depth);
        blockLocal(spec,0,(access.front-depth/2)/2,access.width,access.front+depth/2);
      }else block(x,z,w+1.40,d+1.10,angle);
      const veranda=spec.open?.82:0;
      box(0x864d39,0,raised+h*.47,-veranda*.5,w-.55,h*.92,d-.55-veranda,g);
    }
    for(const side of [-1,1]){
      for(let i=0;i<=bays;i++){
        const px=lo(i),pz=side*(d*.45),rad=spec.gate?.24:.22;
        cylinder(spec.open?0x988a70:0x8f4936,px,raised+h*.48,pz,rad,h*.96,12,g,.91);
        box(0xb7ab95,px,raised+.13,pz,.79,.27,.80,g);
        box(0x35664f,px,raised+h-.13,pz,.88,.39,.88,g);
        const c=Math.cos(angle),sin=Math.sin(angle);
        if(spec.gate)block(x+px*c+pz*sin,z-px*sin+pz*c,rad*2+.15,rad*2+.15,angle,raised+h+.2);
      }
      for(let i=0;i<bays;i++){
        const px=(lo(i)+lo(i+1))/2,pz=side*(d*.50);
        if(spec.open){
          const width=w/bays;
          box(0x3c584a,px,raised+.86,pz,width,.075,.075,g);
          box(0x3c584a,px,raised+.32,pz,width,.065,.067,g);
          for(let j=1;j<=7;j++){
            box(j%2===0?0x697957:0x486753,px-width/2+j*width/8,raised+.60,pz,.039,.54,.06,g);
          }
        }else if(!spec.gate){
          const width=w/bays*.82;
          box(0x476e5b,px,raised+h*.46,pz,width,h*.72,.14,g);
          for(let j=1;j<=9;j++)box(0x285548,px-width/2+width*j/10,raised+h*.49,pz+side*.085,.045,h*.58,.043,g);
          for(let j=0;j<6;j++)box(0x4f7662,px,raised+h*.24+j*h*.101,pz+side*.085,width,.044,.043,g);
        }
        for(let j=-2;j<=2;j++){
          const xx=px+j*w/bays*.15;
          box(j%2===0?0x40745c:0x789675,xx,raised+h-.12,pz,.40,.25,.42,g);
          box(0xb87953,xx,raised+h+.095,pz,.34,.10,.39,g);
        }
      }
      box(0x884d37,0,raised+h*.90,side*d*.46,w+.22,.30,.29,g);
      box(0x356c56,0,raised+h+.20,side*d*.52,w+.68,.31,.36,g);
      box(0x9e6347,0,raised+h+.44,side*d*.55,w+.67,.12,.18,g);
    }
    if(spec.gate){
      // Timber wings are closed; the central bay remains a usable passage.
      for(const side of [-1,1]){
        const px=side*w*.325,wings=w*.292;
        box(0x754635,px,raised+h*.42,d*.44,wings,h*.78,.16,g);
        for(let i=0;i<9;i++)box(0x996047,px-wings*.44+i*wings*.11,raised+h*.42,d*.456,.035,h*.76,.035,g);
        for(const frac of [.21,.44,.67])box(0x5f4439,px,raised+h*frac,d*.478,wings,.080,.09,g);
        block(x+px*Math.cos(angle)+d*.44*Math.sin(angle),z-px*Math.sin(angle)+d*.44*Math.cos(angle),wings,.30,angle,raised+h*.81);
      }
    }
    if(spec.stories===2){
      box(0x815643,0,raised+h*.76,0,w*.87,h*.46,d*.80,g);
      roof(g,w+2.0,d+1.95,raised+h*.52,1.22,false);
      for(const side of [-1,1])for(let i=0;i<bays;i++){
        const x=(i+.5-bays/2)*w*.86/bays,z=side*d*.413;
        box(0x74503a,x,raised+h*.78,z,w*.75/bays,h*.24,.16,g);
        for(let j=-2;j<=2;j++)box(0xa18262,x+j*w*.097/bays,raised+h*.78,z+side*.10,.045,h*.22,.034,g);
      }
    }
    if(spec.mainHall){
      box(0xc1b8a5,0,.29,0,w+5.8,.56,d+5.2,g);
      for(let j=0;j<5;j++)box(0xb9b0a0,0,.075+j*.095,d/2+3.1-j*.47,6.1,.18,.66,g);
    }
    roof(g,w+(spec.open?3.2:2.5),d+2.36,raised+h+.54,spec.mainHall?3.05:spec.open?2.35:2.04,spec.gate||spec.mainHall);
    if(spec.sign||spec.name)nameplate(spec.sign||spec.name,g,0,raised+h-.24,d*.61,Math.min(3.5,w*.25),.79);
    return g;
  }

  const gp=placed(gate);
  const gateGroup=pavilion({...gate,w:14.2,d:8.1,h:4.35,bays:3,angle:Math.PI/2,gate:true,raised:.29,sign:"門漢大"});
  const plateau=box(0xb6afa0,5.1,.11,0,11.5,.22,16.4,gateGroup);
  plateau.position.set(0,.10,8.0);plateau.scale.set(17.5,.20,10.0);
  for(let j=0;j<3;j++)box(0xaaa69b,0,.055+j*.055,13.2-j*.47,8.0,.10,.61,gateGroup);
  for(const side of [-1,1]){
    for(let i=0;i<8;i++)box(0xaaa79a,side*7.38,.36,4.3+i*1.11,.31,.64,.31,gateGroup);
    box(0x9a9a91,side*7.38,.61,8.2,.33,.16,8.35,gateGroup);
    block(gp.x+8.2,gp.z-side*7.38,8.35,.38,0,.70);
  }
  const tp=placed(ticket);
  const kiosk=new T.Group();kiosk.name=ticket.name;kiosk.position.set(tp.x,0,tp.z);kiosk.rotation.y=ticket.angle;scene.add(kiosk);
  const front=ticket.d/2;
  const threshold=placed(fromBuilding(ticket,0,2.56));
  paved(threshold.x,threshold.z,9.4,5.1,.046,ticket.angle);
  const booth=new T.Mesh(new T.BoxGeometry(ticket.w,3.03,ticket.d),stoneMaterial);
  booth.position.y=1.54;kiosk.add(uvScale(booth,1.75,1.2));
  box(0x8b8c7e,0,.15,0,ticket.w+.11,.28,ticket.d+.12,kiosk);
  blockLocal(ticket,0,0,ticket.w+.11,ticket.d+.12,3.05);
  roof(kiosk,ticket.w+.82,ticket.d+.88,3.12,1.02);
  box(0x65766b,0,2.32,front+.10,7.21,.54,.18,kiosk);
  nameplate("덕수궁 매표소",kiosk,0,2.36,front+.205,4.18,.46,"#e9e6dc","#263e43");
  for(let i=-1;i<=1;i++){
    const x=i*2.28;
    box(0xc4c7bc,x,1.47,front+.09,1.94,1.18,.16,kiosk);
    box(0x536b72,x,1.51,front+.195,1.65,.91,.09,kiosk);
    box(0xe0d9c6,x,.97,front+.26,1.87,.11,.39,kiosk);
    box(0x415754,x,1.22,front+.25,.39,.16,.075,kiosk);
    box(0xb3c3bd,x,1.55,front+.249,.043,.77,.020,kiosk);
    blockLocal(ticket,x,front+.26,1.87,.39,1.03);
  }
  const guide=placed(ticketGuide);
  const board=new T.Group();board.position.set(guide.x,0,guide.z);board.rotation.y=ticket.angle;scene.add(board);
  box(0x4d5b50,0,.87,0,1.52,1.71,.09,board);
  nameplate("관람 안내",board,0,1.18,.053,1.39,.46,"#efe5cd","#263a3d");
  block(guide.x,guide.z,1.54,.16,ticket.angle,1.73);
  const b=placed(bridge);
  const channel=box(0x526f69,b.x,-.035,b.z,2.05,.045,16.5);
  channel.material=matte(0x526f69);
  box(0xa5a79e,b.x,.117,b.z,5.7,.25,6.7);
  for(const side of [-1,1]){
    box(0xa2a49a,b.x,.46,b.z+side*3.21,5.6,.53,.34);
    block(b.x,b.z+side*3.21,5.6,.34,0,1.07);
    for(let i=0;i<5;i++)box(0xb1b1a4,b.x-2.31+i*1.15,.80,b.z+side*3.21,.34,.53,.39);
  }
  for(const edge of [-1,1]){
    block(b.x,b.z+edge*6.1,2.4,4.9,0,.34);
    box(0x989d90,b.x,.16,b.z+edge*6.0,2.7,.34,4.6);
  }
  const middleModel=pavilion({...middle,w:10.9,d:6.9,h:3.72,bays:3,angle:courtAngle,gate:true,raised:.24,sign:"中和門"});
  for(const side of [-1,1]){
    const g=placed(middle),shift=side*6.4;
    block(g.x+shift*Math.cos(courtAngle),g.z-shift*Math.sin(courtAngle),8.6,10.0,courtAngle);
  }
  const hallModel=pavilion({...hall,w:18.6,d:17.6,h:5.0,bays:5,angle:courtAngle,raised:1.01,mainHall:true,sign:"殿和中"});
  const hallSite={...hall,angle:courtAngle};
  // Block the edges of each raised level and leave both stair openings clear.
  for(const [halfWidth,back,front,top] of [[19.85,-15.3,27.2,1.14],[13.55,-8.5,22.65,2.08]]){
    const halfStair=3.60,sideWidth=halfWidth-halfStair;
    blockLocal(hallSite,-.25,back,halfWidth*2,.28,top);
    for(const side of [-1,1]){
      blockLocal(hallSite,-.25+side*halfWidth,(back+front)/2,.29,front-back,top);
      blockLocal(hallSite,-.25+side*(halfStair+sideWidth/2),front,sideWidth,.29,top);
    }
  }
  for(const side of [-1,1]){
    blockLocal(hallSite,-.25+side*3.66,28.16,.22,1.80,.98);
    blockLocal(hallSite,-.25+side*3.66,23.34,.22,1.43,1.80);
  }
  for(const part of hallModel.children)part.position.y+=.81;
  box(0xaaa591,-.25,.50,5.95,39.7,1,42.5,hallModel);
  box(0xb7ae99,-.25,.91,7.075,27.10,1.82,31.15,hallModel);
  for(const [start,end,bottom,top] of [[29.06,27.2,0,1],[24.06,22.65,1.05,1.82]]){
    for(let step=0;step<5;step++){
      const depth=(start-end)/5,height=bottom+(top-bottom)*(step+1)/5;
      box(0xb0ab9a,-.25,height/2,start-(step+.5)*depth,7.2,height,depth+.025,hallModel);
    }
  }
  const c=placed(court);
  paved(c.x,c.z,4.2,37,.054,courtAngle);
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const dx=side*4.35,dz=10-i*2.93;
    const px=c.x+dx*Math.cos(courtAngle)+dz*Math.sin(courtAngle);
    const pz=c.z-dx*Math.sin(courtAngle)+dz*Math.cos(courtAngle);
    orient(box(0x9d9e91,px,.36,pz,.36,.72,.28),courtAngle);block(px,pz,.36,.29,courtAngle,.72);
  }
  const pavilionModels=new Map();
  for(const spec of pavilions){
    if(["redBrick","western","westernAnnex"].includes(spec.kind)){
      buildWestern(T,scene,kit,spec);
      if(spec.kind==="westernAnnex")blockLocal(spec,0,0,spec.w,spec.d);
      else{
        const brick=spec.kind==="redBrick",front=spec.d*(brick?.33:.19),back=-spec.d*.46;
        const porticoWidth=brick?spec.w*.24:Math.min(spec.w*.33,15.5);
        const landing=front+spec.d*(brick?.115:.13),stairs=spec.d*(brick?.045:.174);
        const base=spec.h*(brick?.077:.231);
        blockLocal(spec,0,(front+back)/2,spec.w*.91,front-back,spec.h);
        for(const side of [-1,1]){
          blockLocal(spec,side*porticoWidth*.5,(front+landing+stairs)/2,brick?.23:spec.w*.022,
            landing+stairs-front,base);
        }
        const columns=brick?[-.45,-.15,.15,.45]:[-.43,-.258,-.086,.086,.258,.43];
        for(const fraction of columns){
          const width=brick?spec.w*.022:.93;
          blockLocal(spec,porticoWidth*fraction,landing-(brick?.19:.38),width,width,spec.h*.75);
        }
      }
    }else if(spec.kind==="utility"){
      const {x,z}=placed(spec),g=new T.Group();
      g.position.set(x,0,z);g.rotation.y=spec.angle||0;scene.add(g);
      box(0xafa294,0,spec.h*.5,0,spec.w,spec.h,spec.d,g);
      box(0x5b685d,0,spec.h*.39,spec.d*.5+.035,spec.w*.22,spec.h*.73,.09,g);
      box(0x687e7a,-spec.w*.26,spec.h*.58,spec.d*.5+.035,spec.w*.19,spec.h*.32,.09,g);
      roof(g,spec.w+1.0,spec.d+.93,spec.h,1.12,false);
      block(x,z,spec.w,spec.d,spec.angle);
    }else if(spec.outline){
      // The sleeping hall has a short rear wing rather than a rectangular roof plan.
      const {x,y,angle}=spec,c=Math.cos(angle),s=Math.sin(angle);
      const wing=(dx,dz,w,d,bays,sign)=>pavilion({
        ...spec,x:x+dx*c+dz*s,y:y-dx*s+dz*c,w,d,bays,sign,name:""
      });
      pavilionModels.set(spec.name,{spec,groups:[
        wing(1.1,1.95,29.5,11.7,9,spec.sign),wing(-9.5,-5.84,8.4,4.0,3)
      ]});
    }else{
      pavilionModels.set(spec.name,{spec,groups:[pavilion(spec)]});
    }
  }
  const sh=placed(stoneHall),sf=placed(stoneFountain);
  const classical=new T.Group();classical.position.set(sh.x,0,sh.z);scene.add(classical);
  const cream=0xd6cbb8;
  const w=54.2,d=21;
  block(sh.x,sh.z-2.5,w,d+5);
  box(0xb3aea0,0,.54,0,w+1.0,1.08,d+.70,classical);
  box(cream,0,7.10,-.35,w,12.12,d-1.2,classical);
  box(0x90908a,0,13.39,0,w+.77,.48,d+.76,classical);
  for(let bay=0;bay<17;bay++){
    const x=(bay-8)*3.05;
    for(const y of [2.7,6.37,10.37]){
      box(0xb7ae9a,x,y,d/2-.75,1.54,2.63,.15,classical);
      box(0x667d82,x,y,d/2-.62,1.19,2.21,.082,classical);
      box(0xd2c7b1,x,y,d/2-.56,.055,2.2,.035,classical);
      box(0xd2c7b1,x,y+.18,d/2-.56,1.18,.055,.035,classical);
      box(0xe0d3b9,x,y-1.36,d/2-.54,1.82,.20,.32,classical);
    }
  }
  for(const z of [d/2-.53,-d/2+.49])for(const y of [4.42,8.63,12.72]){
    box(0xc8bda9,0,y,z,w+.32,.18,.26,classical);
  }
  for(let i=0;i<6;i++){
    const x=(i-2.5)*3.38;
    cylinder(0xe3d9c0,x,8.0,d/2+.34,.455,7.45,14,classical,.86);
    box(0xd9cdb3,x,11.82,d/2+.34,1.30,.41,1.33,classical);
    box(0xcac0aa,x,4.25,d/2+.34,1.25,.41,1.26,classical);
    for(const side of [-1,1])cylinder(0xd9cdb3,x+side*.37,11.52,d/2+.79,.21,.12,10,classical).rotation.x=Math.PI/2;
  }
  box(0xd5cbb7,0,12.24,d/2+.39,19.8,.61,2.48,classical);
  const triangle=new T.Shape();triangle.moveTo(-9.90,0);triangle.lineTo(9.90,0);triangle.lineTo(0,3.01);triangle.closePath();
  const pediment=new T.ExtrudeGeometry(triangle,{depth:.83,bevelEnabled:false});
  shape(pediment,cream,0,12.54,d/2+.12,classical);
  box(0xb8b2a3,0,1.425,11.51,14.35,2.85,2.02,classical);
  for(let i=0;i<16;i++){
    const height=(i+1)*2.85/16,z=19.2-(i+.5)*6.7/16;
    box(0xb8b2a3,0,height/2,z,13.3,height,.439,classical);
  }
  for(const side of [-1,1]){
    blockLocal(stoneHall,side*7.04,15.81,.52,6.88,2.88);
  }
  const drawPond=addPond();
  plantGardens();
  for(const {points,width} of palacePaths.filter(p=>p.surface==="gravel").filter((_,i)=>i%3===1)){
    const edge=line(points[0],points[1]),{x,z}=edge.at(.63,width/2+.85);
    if(edge.len>5&&!solidAt(x+300,z+225)&&awayFromPaths(x+300,z+225,.45))bench(x,z,edge.angle);
  }
  const fp=placed(fountain);
  paved(fp.x,fp.z,23,23,.029);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    lamp(fp.x+Math.cos(a)*7.8,fp.z+Math.sin(a)*7.8,2.73);
  }
  for(let i=0;i<9;i++){
    const point=estateOutline[Math.min(estateOutline.length-1,i+1)],at=placed(point);
    tree(at.x+7,at.z+3,9+rand()*5,[0x7f9458,0xb4a349,0x8f934d,0xb39c3e]);
  }
  return {benches,trees,catWalls,fountains:[{x:fp.x,z:fp.z,radius:2.32},{x:sf.x,z:sf.z,radius:4.2}],
    lampMaterial,classical,middleModel,hallModel,drawPond,pavilionModels};
}
