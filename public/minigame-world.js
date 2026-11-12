import {jegiHeight,JEGI_CATCH_LATE,JEGI_FLIGHT_MS,minigameById,minigameFrame,minigameTarget,TUHO_RIM_MS,tuhoProjectile,tuhoScores} from "./traditional-games.js";

const limit=value=>Math.max(0,Math.min(1,value));
const actionKey=action=>action.id??[action.game,action.player,action.beat].join("/");
const near=(a,b,range)=>a&&b&&(a.x-b.x)**2+(a.y-b.y)**2<=range**2;
const jegiWindow=JEGI_FLIGHT_MS+JEGI_CATCH_LATE;
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
  const assets=new Map(),games=new Map(),recent=new Map(),shots=new Map(),free=new Map(),confirmedThrows=new Map(),arrows=[],shuttles=[];
  const up=new T.Vector3(0,1,0),from=new T.Vector3(),to=new T.Vector3(),direction=new T.Vector3();
  const cloth=[0xb94437,0xe8b558,0x457d70,0xefdfad,0x99748a];
  const mats=new Map();
  let clock=0,aimDots=null,viewer=null,predictedThrow=null;
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
  function arrow(index){
    if(arrows[index])return arrows[index];
    const item=new T.Group();item.name="live-tuho-arrow";
    mesh(item,new T.CylinderGeometry(.015,.015,.67,6),0xc5985f);
    mesh(item,new T.ConeGeometry(.040,.12,6),0xe1ceaa,0,.39);
    for(let i=0;i<3;i++)mesh(item,new T.BoxGeometry(.009,.14,.085),i%2?0xc99a53:0xb75642,0,-.27).rotation.y=i*Math.PI/3;
    scene.add(item);arrows.push(item);return item;
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
  function assetsFor(game){
    if(assets.has(game.id))return assets.get(game.id);
    const group=new T.Group(),item=new T.Group(),baseline=strip(game);
    group.name="minigame-"+game.id;item.name="live-"+game.id;
    kite(item);group.add(item,baseline);scene.add(group);
    const positions=new T.BufferAttribute(new Float32Array(16*3),3).setUsage(T.DynamicDrawUsage);
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",positions);
    const cord=new T.Line(geometry,new T.LineBasicMaterial({color:0xf6df9d}));cord.name="live-kite-cord";
    cord.frustumCulled=false;group.add(cord);
    const asset={group,item,cord,positions};assets.set(game.id,asset);return asset;
  }
  function begin(now,anchor,rounds,localAction,freeActions){
    clock=now;games.clear();recent.clear();shots.clear();free.clear();
    if(viewer!==anchor?.id){viewer=anchor?.id;confirmedThrows.clear();}
    predictedThrow=null;
    function recentThrow(action){
      return action?.game==="tuho"&&action.action==="throw"&&action.id&&near(anchor,action,62)&&
        clock-action.at<1900&&action.at-clock<160;
    }
    for(const [id,action] of confirmedThrows)if(!recentThrow(action))confirmedThrows.delete(id);
    if(recentThrow(localAction))predictedThrow=localAction;
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
      if(!game||game.id==="kite"||!near(anchor,game.point,62)||!Number.isFinite(action.at))return;
      const key=action.game+"/"+action.player,existing=free.get(key);
      if(!existing||action.at>=existing.at||action.id===existing.id)free.set(key,action);
    }
    take(localAction);takeFree(localAction);
    for(const {round} of games.values())for(const action of round.actions??[])take(action);
    for(const action of freeActions??[]){
      takeFree(action);
      if(recentThrow(action))confirmedThrows.set(action.id,action);
    }
    if(confirmedThrows.size>48){
      const expired=[...confirmedThrows.values()].sort((a,b)=>b.at-a.at).slice(48);
      for(const action of expired)confirmedThrows.delete(action.id);
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
    const fade=action?.game==="jegi"?1-limit((age-jegiWindow+180)/180):
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
    if(!action)return;
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
    for(const item of shuttles)item.visible=false;
    drawAim(preview);
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
      asset.cord.visible=Boolean(owner);
      if(owner){
        owner.arms[1].end.getWorldPosition(from);
        asset.item.localToWorld(to.set(0,-.18,.02));
        for(let i=0;i<asset.positions.count;i++){
          const t=i/(asset.positions.count-1),sag=.35*Math.sin(Math.PI*t);
          asset.positions.setXYZ(i,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t-sag,from.z+(to.z-from.z)*t);
        }
        asset.positions.needsUpdate=true;
      }
    }
    let arrowCount=0,shuttleCount=0;
    const flights=[...confirmedThrows.values()];
    if(predictedThrow&&!confirmedThrows.has(predictedThrow.id))flights.push(predictedThrow);
    for(const action of flights.sort((a,b)=>b.at-a.at)){
      const age=clock-action.at,impact=action.points?TUHO_RIM_MS:tuhoGroundMs;
      if(age<0||age>=impact+700)continue;
      const t=Math.min(age,impact),tip=tuhoProjectile(action,action.angle,action.power,t),
        behind=tuhoProjectile(action,action.angle,action.power,t-10);
      const item=arrow(arrowCount++);item.visible=true;
      item.position.set(wx(tip.x),floorHeight(action)+tip.height,wz(tip.y));
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
      if(action.game==="jegi"&&action.action==="kick"&&age<=(action.points?jegiWindow:420)&&shuttleCount<12){
        const item=shuttle(shuttleCount++),point={x:action.x,y:action.y-.45};
        const height=action.points?jegiHeight(age):Math.max(.044,.18-age*.0011);
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
