import * as T from "three";
import { buildJeongdong } from "./streets.js";
import { addWater } from "./water.js";
import { solidAt, bridge, gate, middle, hall, stoneHall, courtAngle, ticketGuide } from "./layout.js";
import { addParkLife } from "./park-life.js";
import { addPalaceBirds } from "./palace-birds.js";
import { addPalaceSky } from "./palace-sky.js";
import { addStands, makeItemProps } from "./street-stands.js";
import { addMuseum, stairHeight } from "./museum.js";
import { PET_MS, FEED_MS, jumpLift } from "./activities.js";
import { makeWalkerModels } from "./walker-model.js";
import { decodeWishFace, WISH_WIDTH, WISH_HEIGHT, WISH_COLORS, WISH_FLIGHT_MS } from "./wish-art.js";

export function makeWorld(container,{onCatFlee,catSeed}={}) {
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(57,1,.15,1290);
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.07;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.45));
  const selfEmote=document.createElement("span");
  selfEmote.className="self-emote";selfEmote.hidden=true;selfEmote.setAttribute("aria-hidden","true");
  const selfChat=document.createElement("span");
  selfChat.className="self-chat";selfChat.hidden=true;selfChat.setAttribute("aria-hidden","true");
  container.append(renderer.domElement,selfEmote,selfChat);
  let baseFov=57;
  const resize=()=>{
    if(!container.clientWidth||!container.clientHeight)return;
    camera.aspect=container.clientWidth/container.clientHeight;
    baseFov=camera.aspect<.78?68:57;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth,container.clientHeight);
  };
  new ResizeObserver(resize).observe(container);
  resize();
  const skyUniforms={
    horizon:{value:new T.Color(0xcce4f0)},zenith:{value:new T.Color(0x367ec5)}
  };
  const sky=new T.Mesh(new T.SphereGeometry(705,32,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms:skyUniforms,
    vertexShader:`
      varying float elevation;
      void main(){
        elevation=normalize(position).y;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying float elevation;
      uniform vec3 horizon,zenith;
      void main(){
        gl_FragColor=vec4(mix(horizon,zenith,smoothstep(-.06,.54,elevation)),1.0);
        #include <colorspace_fragment>
      }
    `
  }));
  sky.renderOrder=-3;scene.add(sky);
  scene.fog=new T.FogExp2(0xc6dbe3,.0039);
  const hemi=new T.HemisphereLight(0xe8f0ff,0x75664e,1.98);
  const sun=new T.DirectionalLight(0xffe5b6,2.35);
  sun.position.set(-86,97,52);
  const moonLight=new T.DirectionalLight(0xabc9ff,0);
  moonLight.position.set(-145,94,33);
  scene.add(hemi,sun,moonLight);
  const drawPalaceSky=addPalaceSky(T,scene,{sunDirection:sun.position});
  const wx=x=>x-300,wz=y=>y-225;
  let seed=220621;
  function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const mat=new Map(),cylinders=new Map(),unit=new T.BoxGeometry(1,1,1);
  function matte(color){
    if(!mat.has(color))mat.set(color,new T.MeshStandardMaterial({color,roughness:.88}));
    return mat.get(color);
  }
  function shape(geometry,color,x,y,z,parent=scene){
    const object=new T.Mesh(geometry,matte(color));
    object.position.set(x,y,z);parent.add(object);return object;
  }
  function box(color,x,y,z,w,h,d,parent=scene){
    const object=shape(unit,color,x,y,z,parent);object.scale.set(w,h,d);return object;
  }
  function cylinder(color,x,y,z,r,h,sides=12,parent=scene,top=1){
    const key=sides+"/"+top;
    if(!cylinders.has(key))cylinders.set(key,new T.CylinderGeometry(top,1,1,sides));
    const object=shape(cylinders.get(key),color,x,y,z,parent);object.scale.set(r,h,r);return object;
  }

  const kit={wx,wz,rand,shape,box,cylinder,matte};
  const {benches,trees,catWalls,fountains,lampMaterial,classical,middleModel,hallModel,drawPond,pavilionModels}=buildJeongdong(T,scene,kit);
  const drawWater=addWater(T,scene,fountains,kit);
  const stations=addStands(T,scene,kit);
  const createItemProp=makeItemProps(T,kit);
  const walkerModels=makeWalkerModels(T,scene,kit,createItemProp);
  const spotLights=[gate,middle,stoneHall].map((point,i)=>{
    const light=new T.PointLight(0xffc47f,0,i===2?55:30,2);
    light.position.set(wx(point.x)+(i===0?7:0),i===2?4.5:2.6,wz(point.y)+(i===0?2:i===2?22:9));
    scene.add(light);
    return light;
  });
  const nightSky=addNightSky(T,scene,rand);
  const dayHorizon=new T.Color(0xcce4f0),nightHorizon=new T.Color(0x23384f);
  const dayZenith=new T.Color(0x367ec5),nightZenith=new T.Color(0x080e21);
  const dayFog=new T.Color(0xc6dbe3),nightFog=new T.Color(0x1b2b40);
  const ambientDay=new T.Color(0xe8f0ff),ambientNight=new T.Color(0xa7c1ff);
  let night=0;
  const lanterns=new Map();
  const lanternModel=makeWishLantern(kit);
  function removeLantern(id,entry){
    entry.light.removeFromParent();
    entry.paper?.map.dispose();
    entry.paper?.dispose();
    lanterns.delete(id);
  }

  scene.updateMatrixWorld(true);
  const surveyedPavilions=[["jeonggwanheon","정관헌"],["hamnyeongjeon","함녕전"],["seogeodang","석어당"]].map(([model,label])=>{
    const {spec,groups}=pavilionModels.get(label);
    return {model,point:spec,groups,angle:spec.angle};
  });
  const fallbackGroups=new Set([classical,middleModel,hallModel,...surveyedPavilions.flatMap(pavilion=>pavilion.groups)]);
  const groups=new Map(),inverse=new T.Matrix4(),transform=new T.Matrix4();
  scene.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||!object.material.isMeshStandardMaterial)return;
    const parent=fallbackGroups.has(object.parent)?object.parent:scene;
    const key=parent.id+"/"+object.geometry.id+"/"+object.material.id;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(object);
  });
  for(const objects of groups.values()){
    if(objects.length<4)continue;
    const parent=fallbackGroups.has(objects[0].parent)?objects[0].parent:scene;
    inverse.copy(parent.matrixWorld).invert();
    // Keep batches local so distant blocks can be culled on a phone.
    const chunks=new Map();
    for(const object of objects){
      const p=object.matrixWorld.elements,k=parent===scene?Math.floor(p[12]/45)+"/"+Math.floor(p[14]/45):"local";
      if(!chunks.has(k))chunks.set(k,[]);
      chunks.get(k).push(object);
    }
    for(const group of chunks.values()){
      if(group.length<4)continue;
      const batch=new T.InstancedMesh(group[0].geometry,group[0].material,group.length);
      group.forEach((object,i)=>{
        batch.setMatrixAt(i,transform.multiplyMatrices(inverse,object.matrixWorld));
        object.removeFromParent();
      });
      batch.computeBoundingSphere();parent.add(batch);
    }
  }

  const outdoors=new T.Group();
  for(const object of [...scene.children]){
    if(object!==hemi&&object!==sun&&object!==moonLight)outdoors.add(object);
  }
  scene.add(outdoors);
  const guideMarker=makeGuideMarker();
  guideMarker.position.set(wx(ticketGuide.x),2.42,wz(ticketGuide.y));
  outdoors.add(guideMarker);
  const museum=addMuseum(T,scene,kit);
  const birds=addPalaceBirds(T,outdoors,{...kit,floorHeight},{trees,walls:catWalls,seed:catSeed});
  const parkLife=addParkLife(T,outdoors,{...kit,trees,floorHeight,catWalls,benches,onCatFlee,catSeed,birds});

  const landmarkLoaders=Promise.all([
    import("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"),
    import("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/meshopt_decoder.module.js")
  ]);
  let scannedMiddle=false;
  async function loadLandmark(name,point,groups,angle=0){
    try{
      const [{GLTFLoader},{MeshoptDecoder}]=await landmarkLoaders;
      const asset=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync("/"+name+".glb");
      asset.scene.position.set(wx(point.x),0,wz(point.y));
      asset.scene.rotation.y=angle;
      outdoors.add(asset.scene);
      for(const group of groups)group.visible=false;
      container.dataset[name]="survey";
      return true;
    }catch{
      container.dataset[name]="modeled";
      return false;
    }
  }
  loadLandmark("seokjojeon",stoneHall,[classical]);
  loadLandmark("junghwamun",middle,[middleModel],courtAngle).then(loaded=>{scannedMiddle=loaded;});
  loadLandmark("junghwajeon",hall,[hallModel],courtAngle);
  for(const {model,point,groups,angle} of surveyedPavilions)loadLandmark(model,point,groups,angle);

  const models=new Map(),emojiMaps=new Map();
  function labelSprite(nickname,coat){
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
    const font='650 36px "Segoe UI","Malgun Gothic",sans-serif';
    ctx.font=font;
    canvas.width=Math.ceil(ctx.measureText(nickname).width+65);canvas.height=62;
    ctx.fillStyle="rgba(13,26,20,.68)";
    ctx.beginPath();ctx.roundRect(1,1,canvas.width-2,60,23);ctx.fill();
    ctx.strokeStyle="rgba(242,225,180,.32)";ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle="#"+coat.toString(16).padStart(6,"0");
    ctx.beginPath();ctx.arc(22,31,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff7e4";ctx.font=font;ctx.textBaseline="middle";ctx.fillText(nickname,40,32);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
    sprite.scale.set(Math.min(3.6,canvas.width/160),.38,1);sprite.position.y=2.20;
    return sprite;
  }
  function emojiTexture(emoji){
    if(!emojiMaps.has(emoji)){
      const canvas=document.createElement("canvas");canvas.width=canvas.height=112;
      const ctx=canvas.getContext("2d");
      ctx.beginPath();ctx.arc(56,56,52,0,Math.PI*2);
      ctx.fillStyle="rgba(246,229,188,.94)";ctx.fill();ctx.strokeStyle="#795c38";ctx.lineWidth=3;ctx.stroke();
      ctx.font='69px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign="left";ctx.textBaseline="alphabetic";
      const bounds=ctx.measureText(emoji);
      const x=56+(bounds.actualBoundingBoxLeft-bounds.actualBoundingBoxRight)/2;
      const y=56+(bounds.actualBoundingBoxAscent-bounds.actualBoundingBoxDescent)/2;
      ctx.fillText(emoji,Number.isFinite(x)?x:56-bounds.width/2,Number.isFinite(y)?y:79);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;emojiMaps.set(emoji,texture);
    }
    return emojiMaps.get(emoji);
  }
  const chatFont='600 28px "Segoe UI","Malgun Gothic","Apple SD Gothic Neo","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  const chatGraphemes=typeof Intl.Segmenter==="function"?new Intl.Segmenter("ko",{granularity:"grapheme"}):null;
  const chatText=text=>[...text].slice(0,80).join("").replace(/\s+/gu," ").trim();
  function chatTexture(message){
    const text=chatText(message);
    if(!text)return null;
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d"),lines=[];
    if(!ctx)return null;
    const units=chatGraphemes?Array.from(chatGraphemes.segment(text),part=>part.segment):Array.from(text);
    const maxWidth=392,lineHeight=36,padding=16;
    ctx.font=chatFont;
    let line="";
    for(const unit of units){
      if(line&&ctx.measureText(line+unit).width>maxWidth){
        const space=line.lastIndexOf(" ");
        if(space>line.length*.55){lines.push(line.slice(0,space));line=line.slice(space+1)+unit;}
        else{lines.push(line.trimEnd());line=unit.trimStart();}
      }else line+=unit;
    }
    if(line.trim())lines.push(line.trim());
    canvas.width=Math.ceil(Math.min(maxWidth,Math.max(...lines.map(row=>ctx.measureText(row).width)))+padding*2);
    const boxHeight=lines.length*lineHeight+padding*2,mid=canvas.width/2;
    canvas.height=boxHeight+13;
    ctx.fillStyle="#f7edda";ctx.strokeStyle="#504633";ctx.lineWidth=3;
    ctx.beginPath();ctx.roundRect(1.5,1.5,canvas.width-3,boxHeight-3,15);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(mid-10,boxHeight-2);ctx.lineTo(mid,boxHeight+9);ctx.lineTo(mid+10,boxHeight-2);ctx.fill();ctx.stroke();
    ctx.fillRect(mid-8,boxHeight-4,16,4);
    ctx.fillStyle="#25352a";ctx.font=chatFont;ctx.textAlign="center";ctx.textBaseline="middle";
    lines.forEach((row,index)=>ctx.fillText(row,mid,padding+lineHeight*(index+.5),maxWidth));
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    return map;
  }
  let walkerPreview;
  function previewWalker(canvas,appearance){
    const context=canvas.getContext("2d");
    if(!context)return;
    const {width,height}=canvas;
    if(!walkerPreview){
      const stage=new T.Scene(),camera=new T.PerspectiveCamera(33,width/height,.1,20);
      stage.background=new T.Color(0x26392d);
      camera.position.set(1.48,1.64,4.22);camera.lookAt(0,1.02,0);
      const key=new T.DirectionalLight(0xffe1ba,1.45);
      key.position.set(4,7,5);
      stage.add(new T.HemisphereLight(0xf5f1df,0x8b7863,2.05),key);
      const target=new T.WebGLRenderTarget(width,height);
      target.texture.colorSpace=T.SRGBColorSpace;
      walkerPreview={stage,camera,target,models:makeWalkerModels(T,stage,kit,createItemProp),
        model:null,coat:null,pixels:new Uint8Array(width*height*4),image:context.createImageData(width,height)};
    }
    const preview=walkerPreview,coat=appearance.coat??0xab5947;
    if(preview.coat!==coat){
      if(preview.model)preview.models.dispose(preview.model);
      preview.model=preview.models.create(coat,"",labelSprite);preview.coat=coat;
    }
    preview.models.update(preview.model,{x:300,y:225,heading:180,character:appearance.character,look:appearance.look},
      {now:performance.now(),clock:Date.now(),delta:.1,floor:0,turnEase:1,emojiTexture});
    const previous=renderer.getRenderTarget();
    try{
      renderer.setRenderTarget(preview.target);
      renderer.render(preview.stage,preview.camera);
      renderer.readRenderTargetPixels(preview.target,0,0,width,height,preview.pixels);
    }finally{renderer.setRenderTarget(previous);}
    const stride=width*4;
    for(let y=0;y<height;y++){
      const from=(height-1-y)*stride;
      preview.image.data.set(preview.pixels.subarray(from,from+stride),y*stride);
    }
    context.putImageData(preview.image,0,0);
  }
  function seatAt(position){return benches[position.seat]?.slots[position.seatSide??0];}
  function floorHeight(position) {
    const stair=stairHeight(position);
    if(stair!=null)return stair;
    if(Math.abs(position.y-bridge.y)<3.15&&Math.abs(position.x-bridge.x)<3.6)return Math.max(0,.23-(Math.abs(position.x-bridge.x)-2.70)*.34);
    if(Math.abs(position.y-gate.y)<2.0&&Math.abs(position.x-gate.x)<4.1)return .265;
    const dx=position.x-middle.x,dy=position.y-middle.y;
    const localX=dx*Math.cos(courtAngle)-dy*Math.sin(courtAngle),localZ=dx*Math.sin(courtAngle)+dy*Math.cos(courtAngle);
    if(Math.abs(localX)<2.0&&Math.abs(localZ)<7.2){
      if(!scannedMiddle)return Math.abs(localZ)<3.8?.24:0;
      return .69*Math.max(0,Math.min(1,(7.2-Math.abs(localZ))/2.6));
    }
    return 0;
  }
  const ring=new T.Mesh(new T.RingGeometry(.18,.25,28),new T.MeshBasicMaterial({color:0xffcf70,side:T.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
  const pivot=new T.Vector3(),anchorPoint=new T.Vector3(),arm=new T.Vector3(),gaze=new T.Vector3();
  const spriteScreen=new T.Vector3(),cameraUp=new T.Vector3();
  function spriteClipped(sprite){
    sprite.getWorldPosition(spriteScreen).applyMatrix4(camera.matrixWorldInverse);
    const depth=-spriteScreen.z;
    if(depth<=camera.near)return true;
    spriteScreen.applyMatrix4(camera.projectionMatrix);
    const width=sprite.scale.x*camera.projectionMatrix.elements[0]/depth;
    const height=sprite.scale.y*camera.projectionMatrix.elements[5]/depth;
    return spriteScreen.x-width*sprite.center.x<-.98||spriteScreen.x+width*(1-sprite.center.x)>.98||
      spriteScreen.y-height*sprite.center.y<-.98||spriteScreen.y+height*(1-sprite.center.y)>.98||spriteScreen.z>1;
  }
  function showLocalSprite(model,sprite,element,text){
    const show=Boolean(sprite?.visible&&(!model.group.visible||spriteClipped(sprite)));
    if(show){
      sprite.visible=false;
      if(element.textContent!==text)element.textContent=text;
      element.style.opacity=sprite.material.opacity;
    }else if(element.textContent){
      element.textContent="";
    }
    if(element.hidden===show)element.hidden=!show;
  }
  let cameraAnchor=null,cameraDistance=0,prevTime=0;
  function render(state,now){
    if(container.hidden)return;
    const {me,peers,view,firstPerson,clock=Date.now()}=state,delta=Math.min(.064,(now-(prevTime||now))/1000);
    prevTime=now;
    night+=(Number(Boolean(view.night))-night)*Math.min(1,delta*4.2);
    skyUniforms.horizon.value.copy(dayHorizon).lerp(nightHorizon,night);
    skyUniforms.zenith.value.copy(dayZenith).lerp(nightZenith,night);
    scene.fog.color.copy(dayFog).lerp(nightFog,night);
    hemi.color.copy(ambientDay).lerp(ambientNight,night);
    const anchor=me,angle=view.pan*Math.PI/180,indoors=museum.isInside(anchor.x,anchor.y);
    outdoors.visible=!indoors;museum.setVisible(indoors);
    guideMarker.visible=!indoors&&Math.hypot(anchor.x-ticketGuide.x,anchor.y-ticketGuide.y)<22;
    if(guideMarker.visible){
      const pulse=state.guideNearby?Math.sin(now*.004)*.045:0;
      guideMarker.scale.setScalar((state.guideNearby ? .88 : .78)+pulse);
      guideMarker.material.opacity=state.guideNearby?1:.82;
    }
    hemi.intensity=indoors?1.72:1.98-night*1.40;
    sun.intensity=indoors?0:2.35*(1-night);moonLight.intensity=indoors?0:night*.95;
    lampMaterial.emissiveIntensity=.03+night*2.15;
    spotLights.forEach((light,i)=>{light.intensity=night*(i===2?720:126);});
    const roster=[me,...peers],present=new Set(roster.map(player=>player.id));
    if(!indoors){drawWater(now*.001,night);drawPond(now*.001,night);nightSky(night);drawPalaceSky(now,night);birds.update(clock,delta,roster);}
    for(const {id,feed} of roster)if(feed&&feed.at<=clock&&feed.at+FEED_MS>clock)parkLife.feed(feed.id,feed.at,id);
    for(const {pet} of roster)if(pet&&pet.at<=clock&&pet.at+PET_MS>clock)parkLife.pet(pet.id,pet.at);
    parkLife.update(clock,indoors?null:anchor,roster);
    for(const [id,model] of models){
      if(present.has(id))continue;
      walkerModels.dispose(model);
      models.delete(id);
    }
    roster.forEach(player=>{
      let model=models.get(player.id);
      const visible=museum.isInside(player.x,player.y)===indoors&&Math.hypot(player.x-anchor.x,player.y-anchor.y)<135;
      if(!visible){if(model){model.group.visible=false;walkerModels.clearChat(model);}return;}
      if(!model){model=walkerModels.create(player.coat??0xab5947,player.nickname,labelSprite);models.set(player.id,model);}
      walkerModels.update(model,player,{now,clock,delta,seat:seatAt(player),floor:floorHeight(player),jump:jumpLift(player,clock),emojiTexture,chatTexture,
        turnEase:player===me?1-Math.exp(-delta*22):1});
    });
    const seat=seatAt(anchor);
    const eyeHeight=seat?(firstPerson?1.35:1.23):(firstPerson?1.74:1.57)+floorHeight(anchor)+jumpLift(anchor,clock);
    anchorPoint.set(wx(seat?.x??anchor.x),eyeHeight,wz(seat?.y??anchor.y));
    const changed=cameraAnchor!==anchor.id||pivot.distanceToSquared(anchorPoint)>144;
    if(changed)pivot.copy(anchorPoint);
    else pivot.lerp(anchorPoint,1-Math.exp(-delta*20));
    cameraAnchor=anchor.id;
    const zoomFov=baseFov-view.zoom*(firstPerson?6:1.7);
    if(Math.abs(zoomFov-camera.fov)>.01){
      camera.fov+=(zoomFov-camera.fov)*(1-Math.exp(-delta*12));
      camera.updateProjectionMatrix();
    }
    const pitch=firstPerson?Math.max(-72,Math.min(65,view.tilt)):Math.max(-10,Math.min(62,14+view.tilt));
    const elevation=pitch*Math.PI/180;
    const horizontal=Math.cos(elevation);
    arm.set(-Math.sin(angle)*horizontal,Math.sin(elevation),Math.cos(angle)*horizontal);
    if(firstPerson){
      camera.position.copy(pivot);
      camera.lookAt(gaze.copy(pivot).sub(arm));
      cameraDistance=0;
    }else{
      const distance=Math.min(5.25-view.zoom*.47,indoors&&arm.y>0?(4.97-pivot.y)/arm.y:Infinity);
      let available=distance;
      // Shorten the orbit arm at walls and let it ease back out as space opens.
      for(let sample=1,count=Math.ceil(distance/.20);sample<=count;sample++){
        const step=distance*sample/count;
        if(solidAt(pivot.x+300+arm.x*step,pivot.z+225+arm.z*step,pivot.y+arm.y*step-.17)){
          available=Math.max(.34,step-.24);break;
        }
      }
      if(changed||!cameraDistance||available<cameraDistance)cameraDistance=available;
      else cameraDistance+=(available-cameraDistance)*(1-Math.exp(-delta*8));
      camera.position.copy(pivot).addScaledVector(arm,cameraDistance);
      camera.lookAt(pivot);
    }
    cameraUp.set(0,1,0).applyQuaternion(camera.quaternion);
    for(const model of models.values())if(model.group.visible&&model.chatSprite)walkerModels.placeChat(model,cameraUp);
    const anchorModel=models.get(anchor.id);
    if(anchorModel&&cameraDistance<1.08)anchorModel.group.visible=false;
    if(anchorModel?.emote.visible||anchorModel?.chatSprite)camera.updateMatrixWorld();
    showLocalSprite(anchorModel,anchorModel?.emote,selfEmote,me.emote?.emoji);
    showLocalSprite(anchorModel,anchorModel?.chatSprite,selfChat,anchorModel?.chatSprite?chatText(me.chat.text):"");
    for(const player of roster){
      if(player.id===anchor.id)continue;
      const group=models.get(player.id)?.group;
      if(group?.visible&&Math.hypot(group.position.x-camera.position.x,group.position.z-camera.position.z)<.70&&
        camera.position.y>=group.position.y-.10&&camera.position.y<group.position.y+2.08)group.visible=false;
    }
    ring.visible=Boolean(state.destination);
    if(state.destination){
      ring.position.set(wx(state.destination.x),floorHeight(state.destination)+.10,wz(state.destination.y));
      ring.scale.setScalar(1+Math.sin(now*.0068)*.12);
    }
    const lit=new Set();
    roster.forEach(player=>{
      const age=(clock-player.wish)/1000,origin=player.wishOrigin;
      const duration=WISH_FLIGHT_MS/1000;
      if(indoors||age<0||age>=duration||!player.wish)return;
      lit.add(player.id);
      let entry=lanterns.get(player.id);
      if(entry?.wish!==player.wish){
        if(entry)removeLantern(player.id,entry);
        const light=lanternModel.clone();
        const phase=[...player.id].reduce((hash,letter)=>Math.imul(hash,31)+letter.charCodeAt(0)|0,0);
        let paper;
        if(player.wishArt?.some(Boolean)){
          const surface=light.getObjectByName("lantern-paper"),map=makeLanternPaper(player.wishArt);
          paper=surface.material.clone();paper.map=paper.emissiveMap=map;
          surface.material=paper;
        }
        const angle=(player.wishHeading??0)*Math.PI/180;
        const direction={x:Math.sin(angle),z:-Math.cos(angle),reach:0};
        if(origin){
          const height=floorHeight(origin)+1.87;
          for(let step=.25;step<=2.5;step+=.25){
            if(solidAt(origin.x+direction.x*step,origin.y+direction.z*step,height))break;
            direction.reach=step;
          }
        }
        entry={light,paper,phase,direction,yaw:-angle,wish:player.wish};
        scene.add(light);lanterns.set(player.id,entry);
      }
      const {light,phase,direction}=entry;
      const lane=((phase>>>0)%9-4)*.24,wave=age*1.7+phase%53;
      const rise=age*.48-.42*(1-Math.exp(-age*.87));
      const drift=Math.min(1,age*.8),fallback=fountains[0],forward=direction.reach*(1-Math.exp(-age*1.6));
      light.position.set((origin?wx(origin.x):fallback.x)+direction.x*forward+drift*(lane+Math.sin(wave*.44)*(.13+age*.065)),
        (origin?floorHeight(origin):0)+1.96+rise+Math.sin(wave)*.07,
        (origin?wz(origin.y):fallback.z+2.85)+direction.z*forward+drift*(lane*.47+age*.11));
      light.rotation.set(Math.cos(wave)*.073,entry.yaw+age*.54+lane*Math.min(1,age*.23),Math.sin(wave)*.095);
      light.scale.setScalar(Math.min(1,.26+age*1.3,(duration-age)/2.4));
    });
    for(const [id,entry] of lanterns)if(!lit.has(id))removeLantern(id,entry);
    renderer.render(scene,camera);
  }
  const ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3(),sample=new T.Vector3();
  function pick(clientX,clientY){
    const rect=renderer.domElement.getBoundingClientRect();
    if(cameraAnchor==null||!rect.width||!rect.height||
       clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
    ray.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),camera);
    if(guideMarker.visible&&ray.intersectObject(guideMarker,false).length)return {...ticketGuide.approach,guide:true};
    if(!ray.ray.intersectPlane(ground,hit)||hit.distanceTo(camera.position)>105)return null;
    const distance=hit.distanceTo(ray.ray.origin);
    for(let step=.25;step<distance;step+=.25){
      ray.ray.at(step,sample);
      if(sample.y>floorHeight({x:sample.x+300,y:sample.z+225}))continue;
      hit.copy(sample);break;
    }
    return {x:hit.x+300,y:hit.z+225};
  }
  function clearChat(){
    for(const model of models.values())walkerModels.clearChat(model);
    selfChat.hidden=true;selfChat.textContent="";
  }
  return {render,pick,previewWalker,clearChat,benches,stations,parkLife,birds,museum};
}

function makeGuideMarker(){
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=112;
  const ctx=canvas.getContext("2d");
  ctx.beginPath();ctx.arc(56,56,49,0,Math.PI*2);
  ctx.fillStyle="#453716";ctx.fill();
  ctx.beginPath();ctx.arc(56,56,43,0,Math.PI*2);
  ctx.fillStyle="#f1c650";ctx.fill();
  ctx.strokeStyle="#ffea9a";ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle="#342918";
  ctx.beginPath();ctx.roundRect(50,29,12,36,6);ctx.fill();
  ctx.beginPath();ctx.arc(56,78,6,0,Math.PI*2);ctx.fill();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
}

function makeWishLantern({box,cylinder,matte}){
  const lantern=new T.Group();
  const ribs=[[-.37,.27],[-.30,.35],[-.13,.43],[.13,.43],[.30,.35],[.37,.27]];
  const corners=[[-.574,.819],[.574,.819],[.819,.574],[.819,-.574],
    [.574,-.819],[-.574,-.819],[-.819,-.574],[-.819,.574]];
  const sides=corners.length,vertices=[],uv=[],indices=[];
  for(let side=0;side<sides;side++){
    const offset=vertices.length/3;
    for(const [row,[y,radius]] of ribs.entries()){
      for(let edge=0;edge<=1;edge++){
        const [x,z]=corners[(side+edge)%sides];
        vertices.push(x*radius,y,z*radius);
        uv.push((Math.floor(side/2)+(side%2?.985:.015+edge*.97))/4,(y-ribs[0][0])/.74);
      }
      if(row){
        const i=offset+2*row;
        indices.push(i-2,i-1,i,i-1,i+1,i);
      }
    }
  }
  const shade=new T.BufferGeometry();
  shade.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
  shade.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
  shade.setIndex(indices);shade.computeVertexNormals();

  const paperMap=makeLanternPaper();
  const surface=new T.Mesh(shade,new T.MeshStandardMaterial({
    map:paperMap,emissiveMap:paperMap,emissive:0xffdf9f,emissiveIntensity:.94,roughness:.96
  }));
  surface.name="lantern-paper";
  lantern.add(surface);

  for(const y of [-.38,.38]){
    cylinder(0x713d2b,0,y,0,.275,.055,sides,lantern);
    cylinder(0xc38043,0,y+Math.sign(y)*.034,0,.233,.023,sides,lantern);
  }
  const timber=matte(0x8d462b);
  for(let side=0;side<sides;side++){
    const [x,z]=corners[side];
    const curve=new T.CatmullRomCurve3(ribs.map(([y,r])=>
      new T.Vector3(x*(r+.008),y,z*(r+.008))));
    lantern.add(new T.Mesh(new T.TubeGeometry(curve,8,.009,4,false),timber));
  }
  const loop=new T.Mesh(new T.TorusGeometry(.079,.009,5,15,Math.PI),timber);
  loop.position.y=.416;lantern.add(loop);
  cylinder(0x8c402d,0,-.46,0,.015,.14,6,lantern);
  cylinder(0xc28c47,0,-.53,0,.046,.048,8,lantern);
  cylinder(0xae3e38,0,-.61,0,.044,.15,9,lantern,.53);
  for(let side=0;side<8;side++){
    const a=side*Math.PI/4;
    box(0xd8644a,Math.cos(a)*.03,-.63,Math.sin(a)*.03,.008,.12,.008,lantern);
  }

  const halo=document.createElement("canvas");halo.width=halo.height=64;
  const haloCtx=halo.getContext("2d"),gradient=haloCtx.createRadialGradient(32,32,3,32,32,32);
  gradient.addColorStop(0,"#ffd0887a");gradient.addColorStop(.48,"#ffae482b");gradient.addColorStop(1,"#ffae4800");
  haloCtx.fillStyle=gradient;haloCtx.fillRect(0,0,64,64);
  const haloMap=new T.CanvasTexture(halo);haloMap.colorSpace=T.SRGBColorSpace;
  const light=new T.Sprite(new T.SpriteMaterial({map:haloMap,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
  light.scale.set(1.72,1.72,1);lantern.add(light);
  return lantern;
}

function makeLanternPaper(faces){
  const paper=document.createElement("canvas");
  paper.width=512;paper.height=256;
  const ctx=paper.getContext("2d"),ink=document.createElement("canvas");
  ink.width=WISH_WIDTH;ink.height=WISH_HEIGHT;
  const brush=ink.getContext("2d");
  for(let side=0;side<4;side++){
    ctx.save();ctx.translate(side*128,0);
    const glow=ctx.createRadialGradient(64,125,6,64,124,132);
    glow.addColorStop(0,"#ffe3a2");glow.addColorStop(.52,"#fbc47d");glow.addColorStop(1,"#d57840");
    ctx.fillStyle=glow;ctx.fillRect(0,0,128,256);
    for(let i=0;i<160;i++){
      ctx.fillStyle=i%3?"#a05b311b":"#fff2be47";
      ctx.fillRect(i*47%128,i*83%256,1+(i%4),1);
    }
    ctx.strokeStyle="#a0422d";ctx.lineWidth=2;
    ctx.strokeRect(8,12,112,232);ctx.strokeRect(13,17,102,222);
    const pixels=decodeWishFace(faces?.[side]);
    if(pixels){
      brush.clearRect(0,0,WISH_WIDTH,WISH_HEIGHT);
      for(let i=0;i<pixels.length;i++){
        if(!pixels[i])continue;
        brush.fillStyle=WISH_COLORS[pixels[i]];
        brush.fillRect(i%WISH_WIDTH,Math.floor(i/WISH_WIDTH),1,1);
      }
      ctx.drawImage(ink,16,24,96,208);
    }else if(!faces){
      ctx.fillStyle="#9e412f";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font='bold 42px "Malgun Gothic", sans-serif';
      ctx.fillText("소",64,95);ctx.fillText("원",64,139);
      for(let i=-2;i<=2;i++){
        ctx.save();ctx.translate(64,206);ctx.rotate(i*.48);
        ctx.beginPath();ctx.ellipse(0,-12,4.3,13,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
    ctx.restore();
  }
  const map=new T.CanvasTexture(paper);map.colorSpace=T.SRGBColorSpace;
  return map;
}

function addNightSky(T,scene,rand){
  const vertices=[],color=[];
  for(let i=0;i<980;i++){
    const az=rand()*Math.PI*2,y=.056+rand()*.94,r=Math.sqrt(1-y*y)*530;
    vertices.push(Math.cos(az)*r,y*530,Math.sin(az)*r);
    const v=.26+rand()*.74;color.push(v*.84,v*.91,v);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("color",new T.Float32BufferAttribute(color,3));
  const stars=new T.Points(geometry,new T.PointsMaterial({size:1.18,vertexColors:true,opacity:0,transparent:true,depthWrite:false,fog:false}));
  scene.add(stars);
  const canvas=document.createElement("canvas");canvas.width=canvas.height=192;
  const ctx=canvas.getContext("2d"),halo=ctx.createRadialGradient(96,96,40,96,96,94);
  halo.addColorStop(0,"rgba(184,202,245,.27)");halo.addColorStop(1,"rgba(158,181,241,0)");
  ctx.fillStyle=halo;ctx.fillRect(0,0,192,192);
  ctx.save();ctx.beginPath();ctx.arc(96,96,49,0,Math.PI*2);ctx.clip();
  const disk=ctx.createLinearGradient(44,55,149,138);
  disk.addColorStop(0,"#aebcdb");disk.addColorStop(.56,"#f8edce");disk.addColorStop(1,"#f4eee2");
  ctx.fillStyle=disk;ctx.fillRect(43,43,106,106);
  for(let i=0;i<39;i++){
    const x=53+rand()*88,y=51+rand()*87,r=1+rand()*10;
    ctx.fillStyle=i%2===0?"rgba(91,110,146,.12)":"rgba(249,237,211,.21)";
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  const moon=new T.Sprite(new T.SpriteMaterial({map,opacity:0,transparent:true,depthWrite:false,fog:false,toneMapped:false}));
  moon.position.set(-427,135,154);moon.scale.set(34,34,1);scene.add(moon);
  return night=>{
    stars.visible=moon.visible=night>.022;
    stars.material.opacity=night*.93;
    moon.material.opacity=night;
  };
}
