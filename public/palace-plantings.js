const species={
  pine:{wood:0x57473a,colors:[0x43583a,0x4f6540,0x5d7145,0x697c4e],width:.23,depth:.14,flat:.43},
  ginkgo:{wood:0x746653,colors:[0xc98b29,0xe3a931,0xefb83c,0xf3c753],width:.23,depth:.17,flat:.98},
  zelkova:{wood:0x69604d,colors:[0x6d7749,0x7f804e,0x939155,0x9e975f],width:.25,depth:.19,flat:.71},
  maple:{wood:0x665143,colors:[0x7e3c36,0x9d4c34,0xba633e,0xc87844],width:.24,depth:.18,flat:.66}
};

export function makePalaceTree(T,shape){
  const branch=new T.CylinderGeometry(.48,1,1,7);
  const leaf=new T.IcosahedronGeometry(1,2);
  const axis=new T.Vector3(),up=new T.Vector3(0,1,0);

  function limb(from,to,radius,color){
    axis.set(to.x-from.x,to.y-from.y,to.z-from.z);
    const mesh=shape(branch,color,(to.x+from.x)/2,(to.y+from.y)/2,(to.z+from.z)/2);
    mesh.scale.set(radius,axis.length(),radius);
    mesh.quaternion.setFromUnitVectors(up,axis.normalize());
  }

  return function plant(x,z,{kind,height,spread,phase}){
    const {wood,colors,width,depth,flat}=species[kind];
    const pine=kind==="pine",ginkgo=kind==="ginkgo";
    const trunkRadius=Math.max(.15,height*(pine?.048:ginkgo?.028:.036));
    const drift=spread*(pine?.18:.076);
    const bendX=Math.cos(phase)*drift,bendZ=Math.sin(phase)*drift;
    const trunk=[{x,y:0,z},{x:x+bendX*.38,y:height*.32,z:z+bendZ*.38},
      {x:x+bendX,y:height*.61,z:z+bendZ},{x:x+bendX*.70,y:height*.89,z:z+bendZ*.70}];
    for(let i=1;i<trunk.length;i++)limb(trunk[i-1],trunk[i],trunkRadius*(1-(i-1)*.32),wood);

    for(let i=0;i<7;i++){
      const angle=phase+i*2.39996,layer=i/6;
      const length=spread*(pine?.43-layer*.15:ginkgo?.34-layer*.19:.43-layer*.055);
      const base={x:x+bendX*.74,y:height*((pine?.35:.42)+layer*.26),z:z+bendZ*.74};
      const tip={x:base.x+Math.cos(angle)*length,y:height*((pine?.51:.67)+layer*.25),z:base.z+Math.sin(angle)*length};
      limb(base,tip,trunkRadius*(.54-layer*.24),wood);
      for(let j=0;j<2;j++){
        const crownAngle=angle+(j?-.83:.60);
        const offset=j?spread*.11:spread*.036;
        const crown=shape(leaf,colors[(i+j*2)%colors.length],tip.x+Math.cos(crownAngle)*offset,
          tip.y+height*(j?.025:.052),tip.z+Math.sin(crownAngle)*offset);
        const size=(j?.79:1)*(1-layer*.14);
        crown.scale.set(spread*width*size,spread*width*flat*size,spread*depth*size);
        crown.rotation.set(j*.11,angle*.87,Math.sin(angle)*.12);
      }
    }
    const tip=trunk.at(-1),crown=shape(leaf,colors[3],tip.x,tip.y+height*.035,tip.z);
    crown.scale.set(spread*(pine?.18:.20),spread*width*flat,spread*depth);
    crown.rotation.y=phase;
    return trunkRadius;
  };
}
