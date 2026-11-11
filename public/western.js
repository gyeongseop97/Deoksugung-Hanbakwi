function masonry(T,brick){
  const canvas=document.createElement("canvas");
  canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext("2d"),rows=brick?8:4;
  const colors=brick?["#a65343","#ae5d4a","#994936","#b66351","#a05848"]:
    ["#c8c4b8","#d4cfc0","#c0bcae","#cdc9bc","#d0c8b8"];
  ctx.fillStyle=brick?"#99817a":"#aaa698";
  ctx.fillRect(0,0,256,128);
  const span=64,rise=128/rows;
  for(let row=0;row<rows;row++)for(let col=-1;col<4;col++){
    const x=col*span+(row%2)*span/2,y=row*rise;
    ctx.fillStyle=colors[(col+1+row*3)%colors.length];
    ctx.fillRect(x+1,y+1,span-2,rise-2);
    ctx.fillStyle="#fff2d51c";ctx.fillRect(x+2,y+1,span-4,1);
    ctx.fillStyle="#24202320";ctx.fillRect(x+2,y+rise-2,span-4,1);
  }
  const map=new T.CanvasTexture(canvas);
  map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  return new T.MeshStandardMaterial({map,roughness:.94});
}

export function buildWestern(T,scene,kit,spec){
  const {x,y,w,d,h,angle=0,kind}=spec;
  const {wx,wz,matte,shape,cylinder}=kit;
  const group=new T.Group();
  group.name=spec.name||kind;
  group.position.set(wx(x),0,wz(y));group.rotation.y=angle;scene.add(group);
  const brick=kind==="redBrick",annex=kind==="westernAnnex",wall=masonry(T,brick);
  const blocks=new Map();
  const trim=brick?0xd2c4a6:0xd7d2c3,shadow=brick?0xa99d84:0xb8b3a6;
  const teal=brick?0x45817a:0x616861,glass=brick?0x314c4d:0x4c5856;
  const roof=brick?0x497977:0x777e79;
  const front=d*(brick?.33:annex?.44:.19),back=-d*(annex?.44:.46);
  const bodyDepth=front-back,center=(front+back)/2;
  const bodyWidth=w*.91;
  function block(color,x,y,z,width,height,depth,rotation=0){
    if(!blocks.has(color))blocks.set(color,[]);
    blocks.get(color).push({x,y,z,width,height,depth,rotation});
  }
  function body(x,y,z,width,height,depth){
    const geometry=new T.BoxGeometry(width,height,depth),uv=geometry.attributes.uv;
    const tileWidth=brick?1:3.4,tileHeight=brick?.7:1.8;
    for(let i=0;i<uv.count;i++){
      const face=Math.floor(i/4);
      uv.setXY(i,uv.getX(i)*(face<2?depth:width)/tileWidth,uv.getY(i)*(face===2||face===3?depth:height)/tileHeight);
    }
    const mesh=new T.Mesh(geometry,wall);
    mesh.position.set(x,y,z);mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
  }
  function cornice(y,height,projection,color=trim){
    block(color,0,y,center,bodyWidth+projection,height,bodyDepth+projection);
  }
  function hip(levels,color){
    const points=[],indices=[];
    for(const [y,width,depth] of levels){
      points.push(-width/2,y,depth/2,width/2,y,depth/2,width/2,y,-depth/2,-width/2,y,-depth/2);
    }
    for(let level=0;level<levels.length-1;level++)for(let i=0;i<4;i++){
      const a=level*4+i,b=level*4+(i+1)%4;
      indices.push(a,b,b+4,a,b+4,a+4);
    }
    const top=points.length/3-4;
    indices.push(top,top+1,top+2,top,top+2,top+3);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute("position",new T.Float32BufferAttribute(points,3));geometry.setIndex(indices);
    const surface=geometry.toNonIndexed();surface.computeVertexNormals();
    shape(surface,color,0,0,center,group);
  }
  function arch(width,height){
    const contour=new T.Shape(),radius=width/2;
    contour.moveTo(-radius,0);contour.lineTo(radius,0);
    contour.lineTo(radius,height-radius);contour.absarc(0,height-radius,radius,0,Math.PI,false);
    contour.closePath();
    return new T.ShapeGeometry(contour,10);
  }
  const windowGeometries=new Map();
  function windowAt(x,y,z,rotation,width,height,arched){
    const out=[Math.sin(rotation),Math.cos(rotation)],across=[out[1],-out[0]];
    const piece=(color,dx,dy,offset,ww,hh,dd)=>block(color,x+dx*across[0]+offset*out[0],y+dy,z+dx*across[1]+offset*out[1],ww,hh,dd,rotation);
    if(arched){
      for(const [color,inset,offset] of [[trim,0,.035],[teal,.13,.052],[glass,.26,.069]]){
        const key=[width,height,inset].join("/");
        if(!windowGeometries.has(key))windowGeometries.set(key,{geometry:arch(width-inset,height-inset),colors:new Map()});
        const {colors}=windowGeometries.get(key);
        if(!colors.has(color))colors.set(color,[]);
        colors.get(color).push({x:x+offset*out[0],y:y+inset*.38,z:z+offset*out[1],rotation,width:1,height:1,depth:1});
      }
      piece(trim,0,height-.14,.095,.19,.26,.18);
    }else{
      piece(shadow,0,height/2,.04,width+.22,height+.19,.16);
      piece(trim,0,height/2,.12,width+.14,height+.12,.14);
      piece(glass,0,height/2,.20,width-.16,height-.17,.06);
    }
    piece(trim,0,-.07,.09,width+.29,.13,.30);
    piece(teal,0,height*.45,.25,.066,height*.86,.045);
    piece(teal,0,height*.52,.25,width-.25,.068,.045);
    if(brick)piece(teal,0,height*.28,.25,width-.25,.047,.045);
  }
  function column(x,z,bottom,top,r){
    block(shadow,x,bottom+.13,z,r*2.85,.26,r*2.85);
    cylinder(trim,x,(bottom+top)/2,z,r,top-bottom-.35,16,group,.82);
    cylinder(trim,x,bottom+.31,z,r*1.23,.17,16,group);
    cylinder(trim,x,top-.23,z,r*1.22,.18,16,group,1.14);
    block(trim,x,top-.065,z,r*2.95,.13,r*2.95);
  }

  if(brick){
    const eaves=h*.70,base=h*.077;
    cornice(base/2,base,.20,shadow);
    body(0,(eaves+base)/2,center,bodyWidth,eaves-base,bodyDepth);
    for(const [height,rise,project,color] of [[base,.18,.28,trim],[h*.365,.20,.25,trim],[eaves-.21,.13,.26,shadow],[eaves,.26,.46,trim]]){
      cornice(height,rise,project,color);
    }
    hip([[eaves+.09,w*.95,bodyDepth+.50],[h*.83,w*.76,bodyDepth*.65],[h*.905,w*.61,bodyDepth*.47]],roof);
    block(0x6a8b81,0,h*.907,center,w*.62,.12,bodyDepth*.48);
    const winWidth=Math.min(1.42,w*.055),winHeight=h*.194;
    for(const floor of [h*.116,h*.417]){
      for(const fraction of [-.36,-.25,-.14,.14,.25,.36]){
        windowAt(w*fraction,floor,front,0,winWidth,winHeight,true);
        windowAt(w*fraction,floor,back,Math.PI,winWidth,winHeight,true);
      }
      for(const side of [-1,1])for(const position of [.14,.38,.62,.86]){
        windowAt(side*bodyWidth/2,floor,back+bodyDepth*position,side*Math.PI/2,winWidth,winHeight,true);
      }
    }
    const porchWidth=w*.24,porchDepth=d*.115,porchFront=front+porchDepth;
    block(shadow,0,base/2,front+porchDepth/2,porchWidth+.62,base,porchDepth);
    for(let step=0;step<5;step++){
      const depth=(5-step)*d*.009,rise=(step+1)*base/5;
      block(trim,0,rise/2,porchFront+depth/2,porchWidth+.40,rise,depth);
    }
    for(const bay of [-1,0,1]){
      windowAt(bay*porchWidth*.284,base,front,0,porchWidth*.23,h*.235,true);
      windowAt(bay*porchWidth*.284,h*.416,front,0,porchWidth*.23,h*.202,true);
    }
    for(const i of [-.45,-.15,.15,.45])column(i*porchWidth,porchFront-.19,base,h*.351,w*.009);
    block(trim,0,h*.357,front+porchDepth*.50,porchWidth+.48,.32,porchDepth+.25);
    const railBase=h*.371,railHeight=h*.066;
    for(const band of [0,railHeight])block(0x516959,0,railBase+band,porchFront,porchWidth,.08,.09);
    for(let i=0;i<=18;i++){
      const railX=porchWidth*(i/18-.5);
      block(0x52695a,railX,railBase+railHeight/2,porchFront,.062,railHeight,.063);
      if(i%3===0)for(let petal=0;petal<5;petal++){
        const angle=petal*Math.PI*2/5;
        block(0xb6a472,railX+Math.cos(angle)*.092,railBase+railHeight/2+Math.sin(angle)*.092,porchFront+.065,.096,.096,.052);
      }
    }
    for(const side of [-1,1]){
      const radius=w*.045,towerX=side*w*.405,towerZ=front-d*.02,towerTop=h*.766;
      cylinder(0xaa5b48,towerX,(towerTop+base)/2,towerZ,radius,towerTop-base,8,group);
      for(const floor of [base,h*.37,towerTop-.10])cylinder(trim,towerX,floor,towerZ,radius*1.06,.20,8,group);
      for(const floor of [h*.126,h*.432])windowAt(towerX,floor,towerZ+radius,0,radius*.9,h*.185,true);
      cylinder(roof,towerX,(towerTop+h*.968)/2,towerZ,radius*1.17,h*.968-towerTop,12,group,.035);
      shape(new T.SphereGeometry(.15,8,6),0xbaa16c,towerX,h-.15,towerZ,group);
    }
  }else if(annex){
    body(0,h*.45,center,bodyWidth,h*.90,bodyDepth);
    cornice(.23,.46,.20,shadow);
    cornice(h*.90,.25,.27);
    hip([[h*.92,w*.95,bodyDepth+.29],[h,w*.90,bodyDepth*.89]],roof);
    for(const part of [-.39,-.29,-.19,-.09,.09,.19,.29,.39]){
      windowAt(w*part,h*.20,front,0,1.08,h*.48,false);
      windowAt(w*part,h*.20,back,Math.PI,1.08,h*.48,false);
    }
  }else{
    const plinth=h*.231,eaves=h*.88,porticoWidth=Math.min(w*.33,15.5),porticoDepth=d*.13,landing=front+porticoDepth;
    cornice(plinth/2,plinth,.16,shadow);
    body(0,(plinth+eaves)/2,center,bodyWidth,eaves-plinth,bodyDepth);
    for(const [height,rise,project,color] of [[plinth,.20,.28,trim],[h*.605,.16,.20,trim],[eaves-.25,.19,.27,shadow],[eaves,.32,.47,trim]]){
      cornice(height,rise,project,color);
    }
    hip([[eaves+.12,w*.94,bodyDepth+.49],[h*.962,w*.82,bodyDepth*.72]],roof);
    cornice(h*.95,.28,.06,trim);
    const windows=Math.min(1.7,w*.045),wingSpan=(bodyWidth-porticoWidth)/2;
    const wingBays=Math.max(3,Math.round(wingSpan/5.1));
    for(const floor of [h*.313,h*.664]){
      for(const side of [-1,1])for(let bay=0;bay<wingBays;bay++){
        windowAt(side*(porticoWidth/2+(bay+.5)*wingSpan/wingBays),floor,front,0,windows,h*.151,false);
      }
      for(const part of [-.39,-.31,-.23,-.15,-.07,.07,.15,.23,.31,.39])windowAt(w*part,floor,back,Math.PI,windows,h*.151,false);
      for(const side of [-1,1])for(const part of [.14,.33,.52,.71,.90]){
        windowAt(side*bodyWidth/2,floor,back+bodyDepth*part,side*Math.PI/2,windows,h*.151,false);
      }
    }
    block(shadow,0,plinth/2,front+porticoDepth/2,porticoWidth,plinth,porticoDepth);
    const stairs=d*.174,stepRise=plinth/23;
    for(let i=0;i<23;i++){
      const rise=stepRise*(i+1),depth=stairs*(23-i)/23;
      block(i%2===0?trim:0xc9c5b7,0,rise/2,landing+depth/2,porticoWidth*.91,rise,depth);
    }
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const depth=stairs*(3-i)/3,rise=plinth*(i+1)/3;
      block(shadow,side*porticoWidth*.48,rise/2,landing+depth/2,w*.022,rise,depth);
    }
    for(const bay of [-1,0,1])windowAt(bay*porticoWidth*.26,plinth,front,0,porticoWidth*.195,h*.34,true);
    for(const fraction of [-.43,-.258,-.086,.086,.258,.43]){
      column(porticoWidth*fraction,landing-.38,plinth,h*.75,Math.min(.42,w*.012));
    }
    block(shadow,0,h*.767,front+porticoDepth*.5,porticoWidth+.32,h*.042,porticoDepth+.16);
    block(trim,0,h*.799,front+porticoDepth*.5,porticoWidth+.57,h*.031,porticoDepth+.23);
    const tympanum=new T.Shape();
    tympanum.moveTo(-porticoWidth*.53,0);tympanum.lineTo(porticoWidth*.53,0);
    tympanum.lineTo(0,h*.172);tympanum.closePath();
    shape(new T.ExtrudeGeometry(tympanum,{depth:porticoDepth+.25,bevelEnabled:false}),trim,0,h*.811,front-.10,group);
    for(const side of [-1,1]){
      const slope=Math.atan2(h*.172,porticoWidth*.53);
      const edge=shape(new T.BoxGeometry(Math.hypot(h*.172,porticoWidth*.53),.16,.21),shadow,
        side*porticoWidth*.265,h*.898,landing+.19,group);
      edge.rotation.z=-side*slope;
    }
  }

  const unitBox=new T.BoxGeometry(1,1,1),transform=new T.Object3D();
  function addInstances(geometry,color,parts,castShadow){
    const mesh=new T.InstancedMesh(geometry,matte(color),parts.length);
    parts.forEach((part,index)=>{
      transform.position.set(part.x,part.y,part.z);transform.rotation.y=part.rotation;
      transform.scale.set(part.width,part.height,part.depth);transform.updateMatrix();
      mesh.setMatrixAt(index,transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=castShadow;mesh.receiveShadow=true;group.add(mesh);
  }
  for(const [color,parts] of blocks)addInstances(unitBox,color,parts,true);
  for(const {geometry,colors} of windowGeometries.values())for(const [color,parts] of colors){
    addInstances(geometry,color,parts,false);
  }
  return group;
}
