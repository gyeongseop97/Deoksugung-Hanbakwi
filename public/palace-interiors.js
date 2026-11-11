// Furnishings for the halls people can walk into. Each style is a sketch of the real room:
// throne halls with the dais, Sun-Moon-Five-Peaks screen, canopy and twin dragons overhead;
// living quarters with a central wooden hall between two ondol rooms; Gojong's library with
// book stacks and a full-moon window; and Deokhongjeon's western reception room with its
// chandelier. Coordinates are the hall's own: x across, z toward the door, y up from the floor.
const textures=new Map();
function painted(T,key,width,height,draw){
  if(!textures.has(key)){
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    draw(canvas.getContext("2d"),width,height);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    textures.set(key,new T.MeshStandardMaterial({map,roughness:.85}));
  }
  return textures.get(key);
}
// Irworobongdo: red sun and white moon over five peaks, waves below, pines at the sides.
function sunMoonPeaks(ctx,w,h){
  ctx.fillStyle="#1f3a5f";ctx.fillRect(0,0,w,h);
  const disc=(x,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,h*.2,h*.075,0,7);ctx.fill();};
  disc(w*.72,"#d43a2a");disc(w*.28,"#f3efe2");
  const peak=(x,top,half,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-half,h*.78);
    ctx.quadraticCurveTo(x-half*.3,h*top,x,h*top);ctx.quadraticCurveTo(x+half*.3,h*top,x+half,h*.78);ctx.fill();};
  peak(w*.14,.44,w*.16,"#2f7a63");peak(w*.86,.44,w*.16,"#2f7a63");
  peak(w*.31,.34,w*.17,"#2a6fa0");peak(w*.69,.34,w*.17,"#2a6fa0");peak(w*.5,.2,w*.2,"#2f7a63");
  ctx.strokeStyle="#e9dfc4";ctx.lineWidth=2;
  for(let row=0;row<4;row++)for(let x=0;x<w;x+=w/14){
    ctx.beginPath();ctx.arc(x+(row%2)*w/28,h*(.82+row*.05),w/28,Math.PI,0);ctx.stroke();
  }
  for(const x of [w*.06,w*.94]){
    ctx.fillStyle="#8a3b2a";ctx.fillRect(x-4,h*.4,8,h*.42);
    ctx.fillStyle="#1f5a3c";
    for(const [dx,dy] of [[-18,0],[14,-16],[-6,-34],[16,-48]]){ctx.beginPath();ctx.ellipse(x+dx,h*.42+dy,26,10,0,0,7);ctx.fill();}
  }
}
// Two golden dragons circling a pearl, as on the ceilings of the throne halls.
function twinDragons(ctx,w,h){
  ctx.fillStyle="#1f5247";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#c9a64a";ctx.lineWidth=10;ctx.strokeRect(8,8,w-16,h-16);
  ctx.fillStyle="#b7402f";ctx.beginPath();ctx.arc(w/2,h/2,w*.4,0,7);ctx.fill();
  ctx.fillStyle="#24476b";ctx.beginPath();ctx.arc(w/2,h/2,w*.36,0,7);ctx.fill();
  ctx.lineCap="round";
  for(const turn of [0,Math.PI]){
    ctx.strokeStyle="#e2b43c";ctx.lineWidth=17;ctx.beginPath();
    for(let i=0;i<=40;i++){
      const a=turn+i*.105,r=w*(.3-i*.0042)+Math.sin(i*.9)*7;
      ctx[i?"lineTo":"moveTo"](w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);
    }
    ctx.stroke();
    ctx.fillStyle="#f1cf5a";ctx.beginPath();ctx.arc(w/2+Math.cos(turn)*w*.3,h/2+Math.sin(turn)*w*.3,15,0,7);ctx.fill();
  }
  ctx.fillStyle="#f3efe2";ctx.beginPath();ctx.arc(w/2,h/2,13,0,7);ctx.fill();
}
// One leaf of a folding screen: peonies on silk.
function peonyPanel(ctx,w,h){
  ctx.fillStyle="#e7dcc0";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#5a3a26";ctx.lineWidth=8;ctx.strokeRect(4,4,w-8,h-8);
  ctx.strokeStyle="#4f7a4c";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(w*.5,h*.94);ctx.bezierCurveTo(w*.2,h*.7,w*.8,h*.5,w*.45,h*.2);ctx.stroke();
  for(const [x,y,color] of [[.45,.22,"#c8452f"],[.62,.42,"#e08a9a"],[.36,.6,"#c8452f"],[.58,.76,"#f1e6d0"]]){
    ctx.fillStyle=color;
    for(let petal=0;petal<6;petal++){ctx.beginPath();ctx.arc(w*x+Math.cos(petal)*11,h*y+Math.sin(petal)*11,12,0,7);ctx.fill();}
    ctx.fillStyle="#e2b43c";ctx.beginPath();ctx.arc(w*x,h*y,6,0,7);ctx.fill();
  }
}
function bookRows(ctx,w,h){
  ctx.fillStyle="#4a2f20";ctx.fillRect(0,0,w,h);
  const tones=["#d9cfb4","#c9b98f","#a9b7a0","#b78f72","#8fa2b3","#d2c3a0"];
  for(let row=0;row<5;row++){
    let x=6;
    for(let i=0;x<w-10;i++){
      const thick=8+(i*7+row*5)%9;
      ctx.fillStyle=tones[(i+row*2)%tones.length];ctx.fillRect(x,row*h/5+8,thick,h/5-16);
      x+=thick+2;
    }
  }
}
function carpetPattern(ctx,w,h){
  ctx.fillStyle="#7a1f24";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#c9a64a";ctx.lineWidth=10;ctx.strokeRect(14,14,w-28,h-28);
  ctx.lineWidth=3;ctx.strokeRect(34,34,w-68,h-68);
  ctx.fillStyle="#c9a64a";
  for(let x=70;x<w-50;x+=44)for(let y=70;y<h-50;y+=44){ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.fill();}
  ctx.fillStyle="#24476b";ctx.beginPath();ctx.ellipse(w/2,h/2,w*.16,h*.2,0,0,7);ctx.fill();
  ctx.strokeStyle="#c9a64a";ctx.lineWidth=5;ctx.stroke();
}
function portrait(ctx,w,h){
  ctx.fillStyle="#d8ccb0";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#b3261e";ctx.beginPath();ctx.moveTo(w*.2,h);ctx.lineTo(w*.3,h*.5);ctx.lineTo(w*.7,h*.5);ctx.lineTo(w*.8,h);ctx.fill();
  ctx.fillStyle="#e2b43c";ctx.fillRect(w*.42,h*.6,w*.16,h*.14);
  ctx.fillStyle="#e3c4a3";ctx.beginPath();ctx.arc(w/2,h*.38,w*.13,0,7);ctx.fill();
  ctx.fillStyle="#1c1c1f";ctx.fillRect(w*.34,h*.2,w*.32,h*.1);ctx.fillRect(w*.4,h*.1,w*.2,h*.12);
}

export function furnishHall(T,group,kit,{style,name,w,d,floor,height,glow,solid}){
  const {box,cylinder}=kit,gold=0xc9a64a,lacquer=0x8c2f24,wood=0x5a3a26,paper=0xe2dac4;
  const put=(color,x,y,z,sx,sy,sz)=>box(color,x,floor+y,z,sx,sy,sz,group);
  const post=(color,x,y,z,radius,tall,sides=10,top=1)=>cylinder(color,x,floor+y,z,radius,tall,sides,group,top);
  const panel=(material,x,y,z,sx,sy,turn=0)=>{
    const mesh=new T.Mesh(new T.PlaneGeometry(sx,sy),material);
    mesh.position.set(x,floor+y,z);mesh.rotation.y=turn;group.add(mesh);return mesh;
  };
  const flame=(x,y,z,size=.05)=>{
    const mesh=new T.Mesh(new T.SphereGeometry(1,8,6),glow);
    mesh.position.set(x,floor+y,z);mesh.scale.set(size,size*1.6,size);group.add(mesh);
  };
  const candle=(x,z)=>{post(0x4b4a40,x,.02,z,.14,.04);post(0x4b4a40,x,.45,z,.025,.86);post(0xf0e6cf,x,.95,z,.03,.14);flame(x,1.06,z);};
  const back=-d/2;

  function throne(scale){
    const s=Math.min(scale,(height-.6)/4.4),z=back+2.3*s+.2,top=.8*s;
    put(0x74716a,0,.012,0,w,.024,d);
    put(lacquer,0,top/2,z,6.4*s,top,4*s);put(gold,0,top,z,6.5*s,.07,4.1*s);
    solid(0,z,6.4*s,4*s,top);
    for(let k=1;k<=3;k++){
      const tall=top*(4-k)/4,front=z+2*s+(k-.5)*.34;
      put(0x7a2a21,0,tall/2,front,2.2*s,tall,.34);solid(0,front,2.2*s,.34,tall);
    }
    // Throne chair before the screen.
    put(0x9a2a22,0,top+.3*s,z-.2*s,1.5*s,.6*s,1*s);put(0x9a2a22,0,top+1.05*s,z-.68*s,1.7*s,1.5*s,.12);
    for(const side of [-1,1]){
      put(0x7a2a21,side*.8*s,top+.75*s,z-.2*s,.1,.3*s,1*s);
      put(gold,side*.85*s,top+1.84*s,z-.68*s,.14,.14,.14);
    }
    put(gold,0,top+1.82*s,z-.68*s,1.74*s,.06,.14);
    solid(0,z-.3*s,1.8*s,1.3*s);
    put(0x2a1c16,0,top+1.7*s,z-1.52*s,5*s,2.9*s,.1);
    panel(painted(T,"peaks",512,288,sunMoonPeaks),0,top+1.72*s,z-1.52*s+.065,4.8*s,2.7*s);
    // Canopy on four slender posts.
    const roof=Math.min(height-.45,top+3.5*s);
    put(lacquer,0,roof,z-.3*s,5.6*s,.42,3.3*s);put(gold,0,roof-.26,z-.3*s,5.7*s,.1,3.4*s);
    put(0x356c56,0,roof+.26,z-.3*s,5.2*s,.1,2.9*s);
    for(const sx of [-1,1])for(const sz of [-1,1])post(lacquer,sx*2.6*s,(top+roof)/2,z-.3*s+sz*1.5*s,.09,roof-top,8);
    for(const side of [-1,1]){
      post(0x4b4a40,side*4.2*s,.45,z+1.2*s,.3,.5,12,1.25);post(0x4b4a40,side*4.2*s,.1,z+1.2*s,.2,.2,8);
      solid(side*4.2*s,z+1.2*s,.7,.7,.9);
      for(const depth of [-.2,.22]){
        post(0x8f4936,side*w*.3,height/2,depth*d,.3,height,12);put(0xb7ab95,side*w*.3,.1,depth*d,.8,.2,.8);
        solid(side*w*.3,depth*d,.7,.7);
      }
    }
    const dragons=panel(painted(T,"dragons",384,384,twinDragons),0,height-.03,z+1.6*s,4.4*s,4.4*s);
    dragons.rotation.x=Math.PI/2;
  }
  // Folding screen of eight leaves standing in a zigzag.
  function screen(x,z,leaf=.62,tall=1.9,material=painted(T,"peony",128,384,peonyPanel)){
    for(let i=0;i<8;i++){
      const fold=panel(material,x+(i-3.5)*leaf*.94,tall/2+.06,z+(i%2?.07:-.07),leaf,tall,(i%2?-1:1)*.28);
      fold.material.side=T.DoubleSide;
    }
    solid(x,z,leaf*7.6,.4,tall);
  }
  function seat(x,z){
    put(0xa8322a,x,.07,z,2.2,.14,1.5);put(0x2f4f9a,x,.15,z,1.9,.03,1.2);
    put(0xa8322a,x,.42,z-.66,1.5,.56,.2);put(0xc9a64a,x-.8,.26,z,.3,.24,.3);
    put(wood,x,.22,z+1.15,1.0,.05,.42);
    for(const side of [-1,1])put(wood,x+side*.44,.1,z+1.15,.06,.2,.4);
    put(0xf0e6cf,x-.15,.26,z+1.15,.36,.02,.26);
    solid(x,z+1.15,1.0,.42,.25);
  }
  function chest(x,z,turn,tiers=3,tone=0x6a3f2a){
    const wide=turn?.56:1.15,deep=turn?1.15:.56;
    put(tone,x,tiers*.28,z,wide,tiers*.56,deep);
    for(let tier=0;tier<tiers;tier++){
      put(0x4a2a1c,x,tier*.56+.03,z,wide+.03,.05,deep+.03);
      put(gold,x+(turn?turn*.29:0),tier*.56+.3,z+(turn?0:.29),turn?.02:.14,.14,turn?.14:.02);
    }
    solid(x,z,wide,deep);
  }
  function livingQuarters(){
    const wall=w*.24,third=w/2-wall;
    for(const side of [-1,1]){
      // Paper partitions with a doorway between the hall and each ondol room.
      for(const [from,to] of [[back,-.9],[.9,d/2]]){
        put(paper,side*wall,height/2,(from+to)/2,.1,height,to-from);
        for(let bar=1;bar<4;bar++)put(wood,side*wall,height*bar/4,(from+to)/2,.13,.06,to-from);
        solid(side*wall,(from+to)/2,.3,to-from);
      }
      put(wood,side*wall,height-.2,0,.14,.4,1.8);
      put(0xd3b56a,side*(wall+third/2),.016,0,third-.1,.03,d-.1);
    }
    screen(0,back+.7);seat(0,back+2.2);
    candle(-1.7,back+2.6);candle(1.7,back+2.6);
    const left=-(wall+third/2),right=wall+third/2;
    chest(left-third*.25,back+.5,0);chest(left+third*.25,back+.5,0,2,0x7a4a30);
    put(0xc8452f,left,.16,back+2.2,1.5,.12,1.9);put(0x2f4f9a,left,.27,back+2.2,1.5,.1,1.9);put(0xf0e6cf,left,.38,back+1.5,1.2,.16,.42);
    post(0xd9d0b6,left+third*.3,.32,d*.2,.16,.5,6);flame(left+third*.3,.34,d*.2,.07);
    put(wood,right,.2,back+.42,Math.min(2.4,third*.7),.4,.42);solid(right,back+.42,Math.min(2.4,third*.7),.42,.45);
    put(0xf0e6cf,right-.5,.46,back+.42,.3,.12,.24);post(0x6b8fa3,right+.5,.55,back+.42,.11,.3,10,.6);
    put(0xb7a26a,right,.05,.6,1.6,.06,1.2);put(wood,right,.3,.6,.8,.05,.5);
    post(0x4b4a40,right-third*.3,.22,d*.22,.26,.36,10,1.2);flame(right-third*.3,.44,d*.22,.08);
    solid(right-third*.3,d*.22,.6,.6,.5);
  }
  function library(){
    const stack=painted(T,"books",256,256,bookRows),tall=Math.min(2.7,height-.4);
    for(const side of [-1,1]){
      const count=Math.max(2,Math.floor((d-1.4)/2.3));
      for(let i=0;i<count;i++){
        const z=back+1.5+i*(d-2.6)/Math.max(1,count-1)-.3,x=side*(w/2-.3);
        put(0x4a2f20,x,tall/2,z,.5,tall,2.0);
        panel(stack,x-side*.26,tall/2,z,1.9,tall-.16,-side*Math.PI/2);
        solid(x,z,.6,2.0);
      }
    }
    put(wood,0,.72,-.4,Math.min(3.4,w*.3),.08,1.3);
    for(const sx of [-1,1])for(const sz of [-1,1])put(wood,sx*Math.min(1.5,w*.13),.36,-.4+sz*.5,.1,.72,.1);
    solid(0,-.4,Math.min(3.4,w*.3),1.3,.8);
    put(0xf0e6cf,-.5,.78,-.4,.5,.05,.36);put(0x8fa2b3,.4,.8,-.3,.3,.08,.4);post(0x6b8fa3,.9,.9,-.6,.07,.24,8);
    for(const side of [-1,1]){put(0x7a4a30,side*.9,.24,.75,.42,.48,.42);solid(side*.9,.75,.42,.42,.5);}
    // The full-moon window in the north wall, and a portrait of the emperor beside it.
    const moon=new T.Mesh(new T.CircleGeometry(1.05,32),glow);
    moon.position.set(0,floor+Math.min(1.9,height*.5),back+.03);group.add(moon);
    const ring=new T.Mesh(new T.TorusGeometry(1.08,.08,8,36),new T.MeshStandardMaterial({color:wood,roughness:.8}));
    ring.position.copy(moon.position);group.add(ring);
    for(let bar=-2;bar<=2;bar++){put(wood,bar*.36,Math.min(1.9,height*.5),back+.05,.04,2*Math.sqrt(1.1-bar*bar*.13),.03);}
    put(0x2a1c16,-w*.3,1.7,back+.05,1.1,1.5,.06);panel(painted(T,"portrait",128,176,portrait),-w*.3,1.7,back+.09,.95,1.34);
  }
  function reception(){
    const rug=panel(painted(T,"carpet",512,384,carpetPattern),0,.02,0,Math.min(w-1.6,9),Math.min(d-1.6,7));
    rug.rotation.x=-Math.PI/2;
    // Chandelier of gilt arms and glass globes.
    const hang=height-.1;
    post(gold,0,hang-.5,0,.03,1.0,6);post(gold,0,hang-1.0,0,.34,.1,16);post(gold,0,hang-1.25,0,.12,.4,10,.4);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      put(gold,Math.cos(a)*.42,hang-1.0,Math.sin(a)*.42,.5,.03,.03).rotation.y=-a;
      flame(Math.cos(a)*.7,hang-.92,Math.sin(a)*.7,.1);
    }
    post(0x5a3a26,0,.4,0,.9,.06,20);post(0x5a3a26,0,.2,0,.12,.4,8);post(0x5a3a26,0,.03,0,.42,.06,12);
    solid(0,0,1.7,1.7,.85);
    post(0x6b8fa3,0,.56,0,.12,.26,10,.5);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+.3,x=Math.cos(a)*1.55,z=Math.sin(a)*1.55;
      put(0x7a1f24,x,.24,z,.5,.48,.5);put(0x5a3a26,x+Math.cos(a)*.26,.62,z+Math.sin(a)*.26,.5,.76,.08).rotation.y=-a+Math.PI/2;
      solid(x,z,.5,.5,.5);
    }
    for(const side of [-1,1])for(const part of [-.28,.28]){
      put(0x6e1f2a,side*(w/2-.12),height*.5,part*d,.14,height*.86,1.5);put(gold,side*(w/2-.14),height-.3,part*d,.2,.1,1.7);
    }
    for(const side of [-1,1]){
      put(0x4a2f20,side*w*.3,.4,back+.4,1.5,.8,.5);solid(side*w*.3,back+.4,1.5,.5,.85);
      post(0x6b8fa3,side*w*.3,.98,back+.4,.14,.36,10,.5);
    }
    put(gold,0,height*.6,back+.04,Math.min(3,w*.3),Math.min(1.8,height*.4),.04);
    put(0x24476b,0,height*.6,back+.07,Math.min(2.7,w*.27),Math.min(1.5,height*.33),.03);
  }
  function plainHall(){
    screen(0,back+.7,.6,1.7,painted(T,"plainscreen",64,192,(ctx,cw,ch)=>{ctx.fillStyle="#d8ccb0";ctx.fillRect(0,0,cw,ch);
      ctx.strokeStyle="#5a3a26";ctx.lineWidth=6;ctx.strokeRect(3,3,cw-6,ch-6);ctx.fillStyle="#3b3a33";
      for(let i=0;i<7;i++)ctx.fillRect(cw*.3+(i%2)*cw*.2,ch*(.12+i*.11),cw*.2,ch*.07);}));
    put(wood,0,.26,back+2.3,1.5,.06,.8);for(const sx of [-1,1])put(wood,sx*.65,.13,back+2.3,.08,.26,.7);
    solid(0,back+2.3,1.5,.8,.3);
    for(const [x,z,color] of [[-1.3,back+2.3,0xa8322a],[1.3,back+2.3,0x2f4f9a],[0,back+3.5,0xb7a26a]])put(color,x,.06,z,.7,.1,.7);
    post(0x8fa2b3,.3,.39,back+2.3,.09,.2,10,.6);
    candle(-w*.3,back+1.2);candle(w*.3,back+1.2);
    chest(-w/2+.5,0,-1,2,0x7a5a3c);chest(w/2-.5,0,1,3,0x7a5a3c);
  }
  if(style==="throne")throne(Math.min(1.25,w/22));
  else if(style==="council")throne(Math.min(.82,w/24));
  else if(style==="library")library();
  else if(style==="reception")reception();
  else if(style==="plain")plainHall();
  else livingQuarters();
}
