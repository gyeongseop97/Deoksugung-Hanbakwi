const species={
  pine:{wood:0x57473a,colors:[0x43583a,0x4f6540,0x5d7145,0x697c4e],width:.23,depth:.14,flat:.43},
  ginkgo:{wood:0x746653,colors:[0xc98b29,0xe3a931,0xefb83c,0xf3c753],width:.23,depth:.17,flat:.98},
  zelkova:{wood:0x69604d,colors:[0x6d7749,0x7f804e,0x939155,0x9e975f],width:.25,depth:.19,flat:.71},
  maple:{wood:0x665143,colors:[0x7e3c36,0x9d4c34,0xba633e,0xc87844],width:.24,depth:.18,flat:.66}
};

// Local mesh bounds of the bundled surveys, split by height so the broad
// foundations do not displace a tree whose crown clears the walls and eaves.
// Each row is [bottom, top, west, east, north, south] in model metres.
const surveyBounds={
  hamnyeongjeon:[[-.35,1.25,-17.4,16.2,-11.9,12.2],[1.25,3.25,-15.5,16.2,-9.6,9.6],
    [3.25,5.75,-15.6,16.3,-9.5,9.9],[5.75,8.25,-16.6,15.8,-10.7,10.7],[8.25,11.5,-13.9,13.2,-8.3,7.8],[11.5,15,-13.6,13,2.6,2.9]],
  jeonggwanheon:[[-.35,1.25,-11.9,11.8,-7.8,10.6],[1.25,3.25,-9.9,10,-5.9,8.3],
    [3.25,5.75,-10.2,10.2,-6.2,8.5],[5.75,8.25,-7.1,7.1,-5.1,5],[8.25,11.5,-5.2,5.1,-.3,.3]],
  junghwajeon:[[-.35,1.25,-20.5,20,-15.7,30.6],[1.25,3.25,-20.3,20,-15.7,24],
    [3.25,5.75,-14,13.5,-9.1,11.1],[5.75,8.25,-12.8,12.5,-10,10.3],[8.25,11.5,-16.8,16.7,-14,14.1],
    [11.5,15,-16.3,16.4,-13.5,13.6],[15,18.6,-11.9,11.7,-4.2,4.1]],
  junghwamun:[[-.35,1.25,-11.4,11.4,-7.9,7.9],[1.25,3.25,-6.9,6.9,-3.3,3.5],
    [3.25,5.75,-7.4,7.4,-3.9,3.9],[5.75,8.25,-10.9,10.8,-7.3,7.3],[8.25,11.5,-10.7,10.7,-7.1,7.2],[11.5,15,-6.8,6.8,-.4,.3]],
  seogeodang:[[-.35,1.25,-13.1,12.7,-6.7,7.3],[1.25,3.25,-10.4,10.2,-4.9,4],
    [3.25,5.75,-12.6,12.4,-6.1,5.9],[5.75,8.25,-12.3,12.2,-4.9,5.8],[8.25,11.5,-10.5,10.5,-4.1,4.1]],
  seokjojeon:[[-.35,1.25,-30.3,30.3,-21.7,21.7],[1.25,3.25,-30.3,27.8,-19.5,19.6],
    [3.25,5.75,-30.3,27.6,-19.3,12.3],[5.75,8.25,-30.3,27.6,-19.4,12.3],[8.25,11.5,-26.5,27.8,-19.5,12.5],
    [11.5,15,-27,28.3,-20,13],[15,18.6,-17.9,17.7,-14.3,13]]
};

export function makePalaceClearance(T){
  const levels=[-.35,1.25,3.25,5.75,8.25,11.5,15,Infinity],plots=[];
  const clearance=.14;
  const box=new T.Box3(),local=new T.Matrix4(),inverse=new T.Matrix4(),center=new T.Vector3();
  function addBounds(x,z,angle,bounds){
    const cos=Math.cos(angle),sin=Math.sin(angle);
    for(const [low,high,west,east,north,south] of bounds)plots.push({x,z,cos,sin,
      low:low-clearance,high:high+clearance,west:west-clearance,east:east+clearance,
      north:north-clearance,south:south+clearance});
  }
  function addSurvey(name,x,z,angle){addBounds(x,z,angle,surveyBounds[name]);}
  function addModel(group){
    group.updateWorldMatrix(true,true);
    inverse.copy(group.matrixWorld).invert();
    const bands=levels.slice(1).map(()=>[Infinity,-Infinity,Infinity,-Infinity,Infinity,-Infinity]);
    group.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(mesh.isInstancedMesh){if(!mesh.boundingBox)mesh.computeBoundingBox();}
      else if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      local.multiplyMatrices(inverse,mesh.matrixWorld);
      box.copy(mesh.isInstancedMesh?mesh.boundingBox:mesh.geometry.boundingBox).applyMatrix4(local);
      for(let i=0;i<bands.length;i++){
        const bottom=Math.max(levels[i],box.min.y),top=Math.min(levels[i+1],box.max.y);
        if(top<bottom)continue;
        const row=bands[i];
        row[0]=Math.min(row[0],bottom);row[1]=Math.max(row[1],top);
        row[2]=Math.min(row[2],box.min.x);row[3]=Math.max(row[3],box.max.x);
        row[4]=Math.min(row[4],box.min.z);row[5]=Math.max(row[5],box.max.z);
      }
    });
    addBounds(group.position.x,group.position.z,group.rotation.y,bands.filter(row=>row[1]>=row[0]));
  }
  function rootFits(x,z,radius){
    return plots.every(plot=>{
      if(plot.low>.38||plot.high<0)return true;
      const dx=x-plot.x,dz=z-plot.z,lx=dx*plot.cos-dz*plot.sin,lz=dx*plot.sin+dz*plot.cos;
      const gapX=Math.max(0,plot.west-lx,lx-plot.east),gapZ=Math.max(0,plot.north-lz,lz-plot.south);
      return gapX*gapX+gapZ*gapZ>=radius*radius;
    });
  }
  function meshFits(mesh){
    const geometry=mesh.geometry;
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox,hx=(max.x-min.x)*.5,hy=(max.y-min.y)*.5,hz=(max.z-min.z)*.5;
    mesh.updateMatrix();
    const m=mesh.matrix.elements;
    geometry.boundingBox.getCenter(center).applyMatrix4(mesh.matrix);
    const height=hx*Math.abs(m[1])+hy*Math.abs(m[5])+hz*Math.abs(m[9]);
    const bottom=center.y-height,top=center.y+height;
    return plots.every(({x,z,cos,sin,low,high,west,east,north,south})=>{
      if(top<=low||bottom>=high)return true;
      const dx=center.x-x,dz=center.z-z,lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;
      const width=hx*Math.abs(m[0]*cos-m[2]*sin)+hy*Math.abs(m[4]*cos-m[6]*sin)+hz*Math.abs(m[8]*cos-m[10]*sin);
      if(lx+width<=west||lx-width>=east)return true;
      const depth=hx*Math.abs(m[0]*sin+m[2]*cos)+hy*Math.abs(m[4]*sin+m[6]*cos)+hz*Math.abs(m[8]*sin+m[10]*cos);
      return lz+depth<=north||lz-depth>=south;
    });
  }
  function trim(mesh){
    if(meshFits(mesh))return true;
    mesh.scale.multiplyScalar(.74);
    if(meshFits(mesh))return true;
    mesh.removeFromParent();return false;
  }
  return {addModel,addSurvey,rootFits,meshFits,trim};
}

export function makePalaceTree(T,shape,clearance){
  const branch=new T.CylinderGeometry(.48,1,1,7);
  const leaf=new T.IcosahedronGeometry(1,2);
  const axis=new T.Vector3(),up=new T.Vector3(0,1,0);

  function limb(from,to,radius,color){
    axis.set(to.x-from.x,to.y-from.y,to.z-from.z);
    const mesh=shape(branch,color,(to.x+from.x)/2,(to.y+from.y)/2,(to.z+from.z)/2);
    mesh.scale.set(radius,axis.length(),radius);
    mesh.quaternion.setFromUnitVectors(up,axis.normalize());
    if(clearance.meshFits(mesh)){mesh.name="Palace tree limb";return mesh;}
    mesh.removeFromParent();return null;
  }

  return function plant(x,z,{kind,height,spread,phase}){
    const {wood,colors,width,depth,flat}=species[kind];
    const pine=kind==="pine",ginkgo=kind==="ginkgo";
    const trunkRadius=Math.max(.15,height*(pine ? .048 : ginkgo ? .028 : .036));
    const drift=spread*(pine ? .18 : .076);
    const bendX=Math.cos(phase)*drift,bendZ=Math.sin(phase)*drift;
    const trunk=[{x,y:0,z},{x:x+bendX*.38,y:height*.32,z:z+bendZ*.38},
      {x:x+bendX,y:height*.61,z:z+bendZ},{x:x+bendX*.70,y:height*.89,z:z+bendZ*.70}];
    const trunkMeshes=[];
    for(let i=1;i<trunk.length;i++){
      const mesh=limb(trunk[i-1],trunk[i],trunkRadius*(1-(i-1)*.32),wood);
      if(!mesh){for(const part of trunkMeshes)part.removeFromParent();return 0;}
      trunkMeshes.push(mesh);
    }

    for(let i=0;i<7;i++){
      const heading=phase+i*2.39996,layer=i/6;
      const length=spread*(pine ? .43-layer*.15 : ginkgo ? .34-layer*.19 : .43-layer*.055);
      const base={x:x+bendX*.74,y:height*((pine ? .35 : .42)+layer*.26),z:z+bendZ*.74};
      let angle,tip;
      for(const turn of [0,-.52,.52]){
        angle=heading+turn;
        tip={x:base.x+Math.cos(angle)*length,y:height*((pine ? .51 : .67)+layer*.25),z:base.z+Math.sin(angle)*length};
        if(limb(base,tip,trunkRadius*(.54-layer*.24),wood))break;
        tip=null;
      }
      if(!tip)continue;
      for(let j=0;j<2;j++){
        const crownAngle=angle+(j?-.83:.60);
        const offset=j?spread*.11:spread*.036;
        const crown=shape(leaf,colors[(i+j*2)%colors.length],tip.x+Math.cos(crownAngle)*offset,
          tip.y+height*(j?.025:.052),tip.z+Math.sin(crownAngle)*offset);
        crown.name="Palace tree crown";
        const size=(j?.79:1)*(1-layer*.14);
        crown.scale.set(spread*width*size,spread*width*flat*size,spread*depth*size);
        crown.rotation.set(j*.11,angle*.87,Math.sin(angle)*.12);
        clearance.trim(crown);
      }
    }
    const tip=trunk.at(-1),crown=shape(leaf,colors[3],tip.x,tip.y+height*.035,tip.z);
    crown.name="Palace tree crown";
    crown.scale.set(spread*(pine?.18:.20),spread*width*flat,spread*depth);
    crown.rotation.y=phase;
    clearance.trim(crown);
    return trunkRadius;
  };
}
