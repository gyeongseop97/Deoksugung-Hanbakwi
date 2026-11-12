import {jegiFlightMs,jegiHeight,JEGI_CATCH_LATE,kiteFlying,kiteLineMetres,minigameById,minigameFrame,minigameTarget,TUHO_RIM_MS,tuhoProjectile,tuhoScores} from "./traditional-games.js";
import {inKiteLawn} from "./plaza-layout.js";

const limit=value=>Math.max(0,Math.min(1,value));
const actionKey=action=>action.id??[action.game,action.player,action.beat].join("/");
const near=(a,b,range)=>a&&b&&(a.x-b.x)**2+(a.y-b.y)**2<=range**2;
const jegiWindow=count=>jegiFlightMs(count)+JEGI_CATCH_LATE;
const trailSamples=12,trailDuration=300,trailFade=195;
const kiteLimit=12,kiteLaunchMs=1120,kiteCutMs=7000;
function groundImpact(){
  let low=TUHO_RIM_MS,high=1800;
  for(let i=0;i<16;i++){
    const middle=(low+high)/2;
    if(tuhoProjectile({x:0,y:0},0,0,middle).height>.025)low=middle;
    else high=middle;
  }
  return high;
}
const tuhoGroundMs=groundImpact();

export function makeMinigameWorld(T,scene,{wx,wz},floorHeight){
  const assets=new Map(),games=new Map(),recent=new Map(),shots=new Map(),free=new Map(),confirmedThrows=new Map(),arrows=[],trails=[],shuttles=[];
  const kiteFlyers=[],freeKites=[],kiteMotion=new Map(),cutKites=new Map();
  const up=new T.Vector3(0,1,0),from=new T.Vector3(),to=new T.Vector3(),direction=new T.Vector3();
  const cloth=[0xb94437,0xe8b558,0x457d70,0xefdfad,0x99748a];
  const mats=new Map();
  let clock=0,aimDots=null,viewer=null,predictedThrow=null,predictedCut=null,arrowModel=null,trailMaterial=null,kiteModel=null;
  function mesh(parent,geo,color,x=0,y=0,z=0){
    if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.80,side:T.DoubleSide}));
    const item=new T.Mesh(geo,mats.get(color));item.position.set(x,y,z);parent.add(item);return item;
  }
  function tube(parent,points,radius,color){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(parent,new T.TubeGeometry(curve,9,radius,5,false),color);
  }
  function jegi(group){
    mesh(group,new T.CylinderGeometry(.108,.135,.052,14),0x634535);
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5,c=Math.cos(a),s=Math.sin(a);
      tube(group,[[c*.03,0,s*.03],[c*.06,.13,s*.06],[c*.11,.23,s*.11],
        [c*.19,.29,s*.19]],.020,cloth[i%cloth.length]);
    }
  }
  function kite(group){
    const shield=new T.Shape(),corners=[[-.54,.60],[.54,.60],[.49,-.57],[-.49,-.57]];
    corners.forEach(([x,y],i)=>i?shield.lineTo(x,y):shield.moveTo(x,y));shield.closePath();
    const hole=new T.Path();hole.absarc(0,0,.115,0,Math.PI*2,true);shield.holes.push(hole);
    mesh(group,new T.ShapeGeometry(shield),0xc97654);
    for(const [i,[x,y]] of corners.entries()){
      const [nx,ny]=corners[(i+1)%4];tube(group,[[x,y,.018],[(x+nx)*.5,(y+ny)*.5,.025],[nx,ny,.018]],
        .034,i%2?0x648778:0xe9bd80);
    }
    tube(group,[[-.50,.48,.023],[0,.55,.023],[.50,.48,.023]],.016,0xe7cea0);
    for(const side of [-1,1])tube(group,[[side*.37,-.53,0],[side*.39,-.72,.06],[side*.47,-.88,-.03],
      [side*.37,-1.05,.045]],.035,side===-1?0xe4aa54:0xbd6348);
  }
  function makeArrow(){
    const vertices=[],colors=[];
    function part(geo,color,y=0,rotation=0){
      geo.rotateY(rotation);geo.translate(0,y,0);
      const flat=geo.index?geo.toNonIndexed():geo;
      const position=flat.attributes.position,tint=new T.Color(color);
      vertices.push(...position.array);
      for(let i=0;i<position.count;i++)colors.push(tint.r,tint.g,tint.b);
      if(flat!==geo)flat.dispose();
      geo.dispose();
    }
    function feather(points,depth){
      const shape=new T.Shape();
      points.forEach(([x,y],index)=>index?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      return new T.ShapeGeometry(shape).translate(0,0,depth);
    }
    part(new T.CylinderGeometry(.028,.028,.67,8),0xffdf97);
    part(new T.CylinderGeometry(.034,.034,.075,8),0x73343a,-.285);
    part(new T.CylinderGeometry(.034,.034,.035,8),0x9e5637,.315);
    part(new T.ConeGeometry(.056,.12,8),0xfff0c0,.39);
    const edge=[[.022,-.321],[.172,-.345],[.141,-.242],[.022,-.096]];
    const panel=[[.035,-.307],[.152,-.327],[.126,-.246],[.035,-.136]];
    for(let i=0;i<3;i++){
      const rotation=i*Math.PI*2/3;
      part(feather(edge,0),0x753038,0,rotation);
      for(const side of [-1,1])part(feather(panel,side*.002),i===1?0xff943c:0xf54b33,0,rotation);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));
    const material=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});
    return {geometry,material};
  }
  function arrow(index){
    if(arrows[index])return arrows[index];
    arrowModel??=makeArrow();
    const item=new T.Mesh(arrowModel.geometry,arrowModel.material);item.name="live-tuho-arrow";
    scene.add(item);arrows.push(item);return item;
  }
  function trail(index){
    if(trails[index])return trails[index];
    const vertices=trailSamples*4;
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.BufferAttribute(new Float32Array(vertices*3),3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute("color",new T.BufferAttribute(new Float32Array(vertices*4),4).setUsage(T.DynamicDrawUsage));
    const faces=[];
    for(let strip=0;strip<2;strip++)for(let i=0;i<trailSamples-1;i++){
      const a=(strip*trailSamples+i)*2;
      faces.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    geometry.setIndex(faces);
    trailMaterial??=new T.MeshBasicMaterial({
      vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,forceSinglePass:true
    });
    const item=new T.Mesh(geometry,trailMaterial);item.name="live-tuho-trail";
    item.frustumCulled=false;
    scene.add(item);trails[index]=item;return item;
  }
  function drawTrail(index,action,age,impact,floor){
    const end=Math.min(age,impact)-42,start=Math.max(0,end-trailDuration);
    const fade=1-limit((age-impact)/trailFade);
    if(end<=0||fade<=0)return;
    const item=trail(index),{position,color}=item.geometry.attributes;
    const yaw=action.angle*Math.PI/180,crossX=Math.cos(yaw),crossZ=Math.sin(yaw);
    const coverage=limit(end/135)*fade;
    // Crossed strips remain visible from directly behind the arrow and from overhead.
    for(let i=0;i<trailSamples;i++){
      const fraction=i/(trailSamples-1);
      const point=tuhoProjectile(action,action.angle,action.power,start+(end-start)*fraction);
      const x=wx(point.x),y=floor+point.height,z=wz(point.y),radius=.009+.029*fraction;
      const alpha=fraction*coverage*.83,green=.18+.48*fraction,blue=.062+.25*fraction;
      for(let strip=0;strip<2;strip++){
        const a=(strip*trailSamples+i)*2;
        const dx=strip?0:crossX*radius,dy=strip?radius:0,dz=strip?0:crossZ*radius;
        position.setXYZ(a,x-dx,y-dy,z-dz);position.setXYZ(a+1,x+dx,y+dy,z+dz);
        color.setXYZW(a,1,green,blue,alpha);color.setXYZW(a+1,1,green,blue,alpha);
      }
    }
    position.needsUpdate=color.needsUpdate=true;
    item.visible=true;
  }
  function shuttle(index){
    if(shuttles[index])return shuttles[index];
    const item=new T.Group();item.name="live-jegi";jegi(item);scene.add(item);shuttles.push(item);return item;
  }
  function drawAim(preview){
    if(!preview){if(aimDots)aimDots.visible=false;return;}
    if(!aimDots){
      const geometry=new T.BufferGeometry();
      geometry.setAttribute("position",new T.BufferAttribute(new Float32Array(24*3),3).setUsage(T.DynamicDrawUsage));
      aimDots=new T.Points(geometry,new T.PointsMaterial({color:0xf1d28d,size:.068,transparent:true,opacity:.86,depthWrite:false}));
      aimDots.name="tuho aiming arc";aimDots.frustumCulled=false;scene.add(aimDots);
    }
    const points=aimDots.geometry.attributes.position,floor=floorHeight(preview);
    for(let i=0;i<points.count;i++){
      const point=tuhoProjectile(preview,preview.angle,preview.power,85+(TUHO_RIM_MS-85)*i/(points.count-1));
      points.setXYZ(i,wx(point.x),floor+point.height,wz(point.y));
    }
    aimDots.material.color.setHex(tuhoScores(minigameById("tuho"),preview,preview.angle,preview.power)?0xb9e39c:0xf1d28d);
    points.needsUpdate=true;aimDots.visible=true;
  }
  function strip(game){
    const marks=[];
    for(let i=-9;i<=9;i++){
      const x=game.point.x+i*.47,z=game.point.y;
      const y=floorHeight({x,y:z})+.045;
      marks.push(wx(x-.13),y,wz(z),wx(x+.13),y,wz(z));
      if(i%3===0)marks.push(wx(x),y,wz(z-.13),wx(x),y,wz(z+.13));
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(marks,3));
    return new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xf7d288,transparent:true,opacity:.85}));
  }
  function kiteAsset(name){
    if(!kiteModel){kiteModel=new T.Group();kite(kiteModel);}
    const group=new T.Group(),item=kiteModel.clone(true);
    group.name="minigame-"+name;item.name="live-"+name;group.add(item);scene.add(group);
    const positions=new T.BufferAttribute(new Float32Array(16*3),3).setUsage(T.DynamicDrawUsage);
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",positions);
    const cord=new T.Line(geometry,new T.LineBasicMaterial({color:0xf6df9d}));cord.name="live-"+name+"-cord";
    cord.frustumCulled=false;group.add(cord);
    return {group,item,cord,positions};
  }
  function assetsFor(game){
    if(assets.has(game.id))return assets.get(game.id);
    const asset=kiteAsset(game.id);asset.group.add(strip(game));assets.set(game.id,asset);return asset;
  }
  function drawCord(asset,model,hand=1,tension=.5){
    asset.cord.visible=Boolean(model);
    if(!model)return;
    model.arms[hand].end.getWorldPosition(from);
    asset.item.localToWorld(to.set(0,-.18,.02));
    const length=from.distanceTo(to);
    for(let i=0;i<asset.positions.count;i++){
      const t=i/(asset.positions.count-1),sag=Math.min(.72,length*(.078-.060*tension))*Math.sin(Math.PI*t);
      asset.positions.setXYZ(i,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t-sag,from.z+(to.z-from.z)*t);
    }
    asset.positions.needsUpdate=true;
  }
  function kiteWind(id,time,run){
    let phase=0;
    for(const letter of String(id))phase=(phase*33+letter.charCodeAt(0))%997;
    phase*=.037;
    const gust=Math.sin(time*.00091+phase),roll=Math.sin(time*.00157+phase*.77);
    const heading=.19+.33*gust+.14*Math.sin(time*.00043+phase);
    const elevation=.43+.10*roll+.40*run;
    return {heading,elevation,roll,gust};
  }
  function drawFreeKites(){
    for(const asset of freeKites)asset.group.visible=false;
    let index=0;
    const visible=new Set();
    for(const {player,model,action,hand} of kiteFlyers){
      visible.add(player.id);
      let motion=kiteMotion.get(player.id);
      const launchAt=action.action==="fly"?action.at:motion?.launchAt??clock-kiteLaunchMs;
      if(!motion||motion.launchAt!==launchAt){
        motion={launchAt,time:clock,run:0};kiteMotion.set(player.id,motion);
      }
      const speed=limit(Math.hypot(player.vx??0,player.vy??0)/6.675);
      const running=player.running&&(speed>.07||player.stepping)?Math.max(.68,speed):speed*.28;
      const ease=1-Math.exp(-Math.max(0,Math.min(170,clock-motion.time))*.0048);
      motion.run+=(running-motion.run)*ease;motion.time=clock;
      const line=kiteLineMetres(action,clock),wind=kiteWind(player.id,clock,motion.run);
      const asset=freeKites[index]??(freeKites[index]=kiteAsset("free-kite"));index++;
      const lift=limit((clock-motion.launchAt)/kiteLaunchMs);
      const launch=lift*lift*(3-2*lift);
      model.arms[hand].end.getWorldPosition(from);
      const span=line*Math.cos(wind.elevation)*launch,climb=line*Math.sin(wind.elevation)*launch;
      asset.group.visible=true;
      asset.item.position.set(from.x+span*Math.sin(wind.heading),from.y+.34*(1-launch)+climb,
        from.z-span*Math.cos(wind.heading));
      asset.item.rotation.set(-.17+wind.roll*.16,-wind.heading*.6+wind.gust*.22,-.11+wind.roll*.19);
      asset.item.scale.setScalar(.66+.34*launch);
      drawCord(asset,model,hand,.34+.66*motion.run);
    }
    for(const player of kiteMotion.keys())if(!visible.has(player))kiteMotion.delete(player);
    const detached=[...cutKites.values()];
    if(predictedCut&&!cutKites.has(predictedCut.id))detached.push(predictedCut);
    for(const action of detached.sort((a,b)=>b.at-a.at)){
      if(index>=kiteLimit)break;
      const elapsed=(clock-action.at)/1000;
      if(elapsed<0||elapsed>=kiteCutMs/1000)continue;
      const line=kiteLineMetres(action,action.at),wind=kiteWind(action.player,action.at,action.points ? .84 : 0);
      const asset=freeKites[index]??(freeKites[index]=kiteAsset("free-kite"));index++;
      const span=line*Math.cos(wind.elevation)+elapsed*(2.8+.31*elapsed);
      const heading=wind.heading+Math.sin(elapsed*.61)*.18;
      const altitude=line*Math.sin(wind.elevation)+1.8*elapsed-.073*elapsed*elapsed;
      asset.group.visible=true;asset.cord.visible=false;
      asset.item.position.set(wx(action.x)+span*Math.sin(heading),
        floorHeight(action)+1.18+altitude,wz(action.y)-span*Math.cos(heading));
      asset.item.rotation.set(-.2+Math.sin(elapsed*1.7)*.46,-heading*.7,wind.roll*.18+Math.sin(elapsed*1.27)*.54);
      asset.item.scale.setScalar(1);
    }
  }
  function begin(now,anchor,rounds,localAction,freeActions){
    clock=now;games.clear();recent.clear();shots.clear();free.clear();
    kiteFlyers.length=0;
    if(viewer!==anchor?.id){
      viewer=anchor?.id;confirmedThrows.clear();cutKites.clear();kiteMotion.clear();
    }
    predictedThrow=predictedCut=null;
    function recentThrow(action){
      return action?.game==="tuho"&&action.action==="throw"&&action.id&&near(anchor,action,62)&&
        clock-action.at<1900&&action.at-clock<160;
    }
    function recentCut(action){
      return action?.game==="kite"&&action.action==="cut"&&action.id&&near(anchor,action,98)&&
        clock-action.at<kiteCutMs&&action.at-clock<160;
    }
    for(const [id,action] of confirmedThrows)if(!recentThrow(action))confirmedThrows.delete(id);
    for(const [id,action] of cutKites)if(!recentCut(action))cutKites.delete(id);
    if(recentThrow(localAction))predictedThrow=localAction;
    if(recentCut(localAction))predictedCut=localAction;
    for(const round of rounds??[]){
      const game=minigameById(round.game);
      if(game?.id!=="kite"||!near(anchor,game.point,62)||clock>=round.endsAt)continue;
      const frame=minigameFrame(game,round,Math.max(clock,round.startsAt));
      if(frame)games.set(game.id,{game,round,frame});
    }
    function take(action){
      const active=games.get(action?.game);
      if(!active||!Number.isFinite(action.at)||clock-action.at>1550||action.at-clock>160)return;
      const key=actionKey(action);shots.set(key,action);
    }
    function takeFree(action){
      const game=minigameById(action?.game);
      if(!game||!anchor||!Number.isFinite(action.at))return;
      if(game.id==="kite"){
        if(!kiteFlying(action)&&action.action!=="land"&&action.action!=="cut")return;
      }else if(!near(anchor,game.point,62))return;
      const key=action.game+"/"+action.player,existing=free.get(key);
      if(!existing||action.at>=existing.at||action.id===existing.id)free.set(key,action);
    }
    take(localAction);takeFree(localAction);
    for(const {round} of games.values())for(const action of round.actions??[])take(action);
    for(const action of freeActions??[]){
      takeFree(action);
      if(recentThrow(action))confirmedThrows.set(action.id,action);
      if(recentCut(action))cutKites.set(action.id,action);
    }
    if(confirmedThrows.size>48){
      const expired=[...confirmedThrows.values()].sort((a,b)=>b.at-a.at).slice(48);
      for(const action of expired)confirmedThrows.delete(action.id);
    }
    if(cutKites.size>24){
      const expired=[...cutKites.values()].sort((a,b)=>b.at-a.at).slice(24);
      for(const action of expired)cutKites.delete(action.id);
    }
    for(const action of [...shots.values(),...free.values()]){
      const previous=recent.get(action.player);
      if(!previous||previous.at<action.at)recent.set(action.player,action);
    }
  }
  function counter(model,action,player,hide){
    const available=action&&action.game!=="kite"&&!hide&&Number.isFinite(action.count)&&
      near(player,minigameById(action.game)?.point,13);
    const age=available?clock-action.at:Infinity;
    const fade=action?.game==="jegi"?1-limit((age-jegiWindow(action.count)+180)/180):
      action?.arrows>0?1:1-limit((age-3500)/750);
    if(!available||fade<=0){if(model.minigameCount)model.minigameCount.sprite.visible=false;return;}
    if(!model.minigameCount){
      const canvas=document.createElement("canvas");canvas.width=128;canvas.height=96;
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
      sprite.scale.set(.48,.36,1);model.group.add(sprite);
      model.minigameCount={canvas,texture,sprite,count:null};
    }
    const countLabel=model.minigameCount;
    const count=action.game==="tuho"&&action.action==="throw"&&age<TUHO_RIM_MS?
      Math.max(0,action.count-(action.points??0)):action.count;
    if(countLabel.count!==count){
      countLabel.count=count;
      const ctx=countLabel.canvas.getContext("2d");ctx.clearRect(0,0,128,96);
      ctx.fillStyle="#21342ae8";ctx.strokeStyle="#ecc67c";ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(14,12,100,72,30);ctx.fill();ctx.stroke();
      ctx.fillStyle="#fff0c4";ctx.font="bold 46px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(String(count),64,49,85);countLabel.texture.needsUpdate=true;
    }
    countLabel.sprite.visible=true;countLabel.sprite.material.opacity=fade;
    countLabel.sprite.position.set(0,(model.label?.position.y??1.84)+.31,0);
  }
  function remove(model){
    const label=model.minigameCount;
    if(!label)return;
    label.sprite.removeFromParent();label.texture.dispose();label.sprite.material.dispose();model.minigameCount=null;
  }
  function pose(player,model,hideCount=false){
    const action=recent.get(player.id);
    counter(model,action,player,hideCount);
    const flying=free.get("kite/"+player.id);
    if(kiteFlying(flying)&&inKiteLawn(player.x,player.y)&&kiteFlyers.length<kiteLimit){
      const hand=player.hand===1||(player.item&&player.hand!==-1)?0:1;
      kiteFlyers.push({player,model,action:flying,hand});
      if(!player.hand||!player.item){
        const arm=model.arms[hand];
        arm.upper.rotateX(-.65);arm.upper.rotateZ(hand===1?-.18:.18);arm.lower.rotateX(-.59);
      }
      return;
    }
    if(!action)return;
    if(action.game==="kite"&&!games.has("kite"))return;
    const age=clock-action.at;
    if(age<0||age>620)return;
    const weight=Math.sin(Math.PI*limit((age+33)/650));
    const active=games.get(action.game),frame=active&&minigameFrame(active.game,active.round,action.at);
    const target=frame&&minigameTarget(active.game,frame);
    const yaw=target?Math.atan2(target.x-action.x,target.y-action.y):
      action.action!=="collect"&&Number.isFinite(action.angle)?Math.PI-action.angle*Math.PI/180:model.group.rotation.y;
    const turn=yaw-model.group.rotation.y,ease=limit((age+65)/110)*limit((620-age)/170);
    model.group.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*ease;
    const arm=model.arms[1],other=model.arms[0],leg=model.legs[1];
    if(action.action==="collect"){
      arm.upper.rotateX(-.90*weight);arm.lower.rotateX(-.55*weight);
      return;
    }
    if(action.game==="tuho"){
      arm.upper.rotateX(-1.96*weight);arm.upper.rotateZ(-.36*weight);arm.lower.rotateX(-.73*weight);
      model.chest.rotateY(.23*weight);
    }else if(action.game==="jegi"){
      leg.upper.rotateX(-1.42*weight);leg.lower.rotateX(.84*weight);leg.end.rotateX(.26*weight);
      model.chest.rotateX(-.18*weight);
      arm.upper.rotateZ(-.36*weight);other.upper.rotateZ(.34*weight);
      if(model.skirt.visible&&weight>.1)leg.bottom.visible=true;
    }else{
      arm.upper.rotateX(-.72*weight);arm.lower.rotateX(-1.26*weight);
      other.upper.rotateX(-.42*weight);other.lower.rotateX(-1.20*weight);
      model.chest.rotateX(-.22*weight);model.headJoint.rotateX(-.22*weight);
    }
  }
  function live(models,preview){
    for(const asset of assets.values())asset.group.visible=false;
    for(const item of arrows)item.visible=false;
    for(const item of trails)if(item)item.visible=false;
    for(const item of shuttles)item.visible=false;
    drawAim(preview);
    drawFreeKites();
    for(const {game,round,frame} of games.values()){
      const asset=assetsFor(game),target=minigameTarget(game,frame),floor=floorHeight(target);
      asset.group.visible=true;
      let latest=null;
      for(const action of shots.values()){
        if(action.game!==game.id||action.beat!==frame.beat||action.points<=0||action.at>clock)continue;
        if(!latest||latest.at<action.at)latest=action;
      }
      const age=latest?clock-latest.at:Infinity;
      const lift=age<790?Math.sin(Math.PI*limit(age/790)):0;
      asset.item.position.set(wx(target.x),floor+target.height+lift*.42,wz(target.y));
      asset.item.rotation.set(-.19,Math.sin(clock*.005)*.21,frame.move*.14+Math.sin(clock*.006)*.12);
      const owners=[latest?.player,...(round.players??[]).filter(player=>!player.withdrawn).map(player=>player.id)];
      const owner=owners.map(id=>models.get(id)).find(model=>model?.group.visible);
      drawCord(asset,owner);
    }
    let arrowCount=0,shuttleCount=0;
    const flights=[...confirmedThrows.values()];
    if(predictedThrow&&!confirmedThrows.has(predictedThrow.id))flights.push(predictedThrow);
    for(const action of flights.sort((a,b)=>b.at-a.at)){
      const age=clock-action.at,impact=action.points?TUHO_RIM_MS:tuhoGroundMs;
      if(age<0||age>=impact+700)continue;
      const t=Math.min(age,impact),tip=tuhoProjectile(action,action.angle,action.power,t),
        behind=tuhoProjectile(action,action.angle,action.power,t-10);
      const floor=floorHeight(action);
      drawTrail(arrowCount,action,age,impact,floor);
      const item=arrow(arrowCount++);item.visible=true;
      item.position.set(wx(tip.x),floor+tip.height,wz(tip.y));
      direction.set(tip.x-behind.x,tip.height-behind.height,tip.y-behind.y);
      if(direction.lengthSq()>.000001)direction.normalize();
      else direction.set(Math.sin(action.angle*Math.PI/180),.55,-Math.cos(action.angle*Math.PI/180)).normalize();
      if(age>=impact&&!action.points){
        direction.y*=1-limit((age-impact)/160);
        direction.normalize();
      }
      item.position.addScaledVector(direction,-.45);
      item.quaternion.setFromUnitVectors(up,direction);
      if(arrowCount>=12)break;
    }
    for(const action of free.values()){
      const age=clock-action.at;
      if(age<0)continue;
      if(action.game==="jegi"&&action.action==="kick"&&age<=(action.points?jegiWindow(action.count):420)&&shuttleCount<12){
        const item=shuttle(shuttleCount++),point={x:action.x,y:action.y-.45};
        const height=action.points?jegiHeight(age,action.count):Math.max(.044,.18-age*.0011);
        item.visible=true;item.position.set(wx(point.x),floorHeight(point)+height,wz(point.y));
        item.rotation.set(Math.sin(age*.011)*.19,age*.014,Math.cos(age*.010)*.17);
        continue;
      }
      if(action.game!=="tuho"||arrowCount>=22)continue;
      const owner=models.get(action.player);
      if(action.arrows>0&&(action.action!=="throw"||age>620)&&owner?.group.visible){
        const target=minigameById("tuho").point;
        if((owner.group.position.x-wx(target.x))**2+(owner.group.position.z-wz(target.y))**2>13**2)continue;
        const item=arrow(arrowCount++),heading=owner.group.rotation.y;
        item.visible=true;owner.arms[1].end.getWorldPosition(item.position);item.position.y+=.14;
        direction.set(Math.sin(heading)*.48,.83,Math.cos(heading)*.48).normalize();
        item.quaternion.setFromUnitVectors(up,direction);
      }
    }
  }
  return {begin,pose,live,remove};
}
