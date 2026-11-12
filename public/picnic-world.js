import {isPicnicItem,picnicGap,PICNIC_DEPTH,PICNIC_SLOTS,PICNIC_WIDTH} from "./picnic-data.js";

function clothTexture(T){
  const canvas=document.createElement("canvas");canvas.width=384;canvas.height=304;
  const ctx=canvas.getContext("2d");
  if(!ctx)return null;
  ctx.fillStyle="#d6a373";ctx.fillRect(0,0,384,304);
  for(let x=12;x<384;x+=58){
    ctx.fillStyle="#a95649a3";ctx.fillRect(x,0,24,304);
    ctx.fillStyle="#edc997cc";ctx.fillRect(x+30,0,5,304);
  }
  for(let y=8;y<304;y+=54){
    ctx.fillStyle="#913e3c86";ctx.fillRect(0,y,384,21);
    ctx.fillStyle="#f2d9aaaf";ctx.fillRect(0,y+27,384,4);
  }
  ctx.fillStyle="#f0d6aa2a";
  for(let y=2;y<304;y+=4)ctx.fillRect(0,y,384,1);
  ctx.strokeStyle="#7c3d36";ctx.lineWidth=10;ctx.strokeRect(5,5,374,294);
  ctx.strokeStyle="#f6dba8";ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(10,10,364,284);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}

export function makePicnicWorld(T,scene,{wx,wz},floorHeight,makeItemProp){
  const models=new Map(),cloth=new T.PlaneGeometry(PICNIC_WIDTH,PICNIC_DEPTH);
  const plate=new T.CylinderGeometry(.184,.158,.025,18),rim=new T.TorusGeometry(.17,.012,7,18);
  const porcelain=new T.MeshStandardMaterial({color:0xf1e1be,roughness:.56});
  const glaze=new T.MeshStandardMaterial({color:0x587c6e,roughness:.54});
  const threadGeometry=new T.BoxGeometry(.027,.011,.080);
  const threadMaterial=new T.MeshStandardMaterial({color:0xe8cea3,roughness:.98});
  const bounds=new T.Box3();
  let fabric=null;

  function makeMat(){
    fabric??=new T.MeshStandardMaterial({color:0xffffff,map:clothTexture(T),roughness:.99});
    const root=new T.Group();root.name="잔디밭 피크닉 돗자리";
    const rug=new T.Mesh(cloth,fabric);rug.rotation.x=-Math.PI/2;rug.receiveShadow=true;root.add(rug);
    const fringe=new T.InstancedMesh(threadGeometry,threadMaterial,60),strand=new T.Object3D();
    for(let i=0;i<60;i++){
      const side=i<30?-1:1,offset=i%30;
      strand.position.set((offset-14.5)*.083,.001,side*(PICNIC_DEPTH/2+.029));
      strand.rotation.y=((offset%5)-2)*.076;strand.updateMatrix();fringe.setMatrixAt(i,strand.matrix);
    }
    fringe.computeBoundingSphere();root.add(fringe);scene.add(root);
    return {root,items:new Map(),lastItems:null};
  }

  function addPortion(model,item){
    const slot=PICNIC_SLOTS[item.slot];
    if(!slot||!isPicnicItem(item.kind))return;
    const holder=new T.Group();holder.name="피크닉 "+item.kind;
    holder.position.set(slot[0],0,slot[1]);model.root.add(holder);
    const tray=new T.Mesh(plate,porcelain);tray.position.y=.021;tray.receiveShadow=true;holder.add(tray);
    const lip=new T.Mesh(rim,glaze);lip.rotation.x=-Math.PI/2;lip.position.y=.036;holder.add(lip);
    const serving=new T.Group();serving.rotation.y=item.slot*.63;holder.add(serving);
    if(item.kind==="crepe"||item.kind==="parfait")serving.rotateZ(.86);
    const prop=makeItemProp(serving);prop(item.kind);
    serving.updateWorldMatrix(true,false);
    const base=bounds.setFromObject(serving).min.y;
    if(Number.isFinite(base))serving.position.y+=model.root.position.y+.041-base;
    model.items.set(item.id,{holder,prop});
  }

  function discardPortion({holder,prop}){holder.removeFromParent();prop.dispose?.();}
  function discardMat(model){for(const item of model.items.values())discardPortion(item);model.root.removeFromParent();}

  function update(anchor,picnics=[]){
    const nearest=anchor?picnics.map(mat=>({mat,gap:picnicGap(anchor,mat)}))
      .filter(({gap})=>gap<=82).sort((a,b)=>a.gap-b.gap).slice(0,14):[];
    const keep=new Set();
    for(const {mat} of nearest){
      keep.add(mat.id);
      let model=models.get(mat.id);
      if(!model){
        model=makeMat();models.set(mat.id,model);
        model.root.position.set(wx(mat.x),Math.max(.064,floorHeight(mat)+.064),wz(mat.y));
      }
      const signature=mat.items.map(({id,slot,kind})=>id+"/"+slot+"/"+kind).join(",");
      if(signature===model.lastItems)continue;
      model.lastItems=signature;
      const present=new Set(mat.items.map(({id})=>id));
      for(const [id,item] of model.items)if(!present.has(id)){discardPortion(item);model.items.delete(id);}
      for(const item of mat.items)if(!model.items.has(item.id))addPortion(model,item);
    }
    for(const [id,model] of models)if(!keep.has(id)){discardMat(model);models.delete(id);}
  }
  return {update};
}
