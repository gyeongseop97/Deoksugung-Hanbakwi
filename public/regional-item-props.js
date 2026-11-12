export function makeRegionalItemProps(T,{box,cylinder,shape}){
  const berryGeometry=new T.SphereGeometry(1,10,7);
  const sliceFootprint=new T.Shape([[-.100,.074],[.100,.074],[.012,-.111],[-.010,-.111]]
    .map(([x,z])=>new T.Vector2(x,-z)));
  const sliceGeometry=new T.ExtrudeGeometry(sliceFootprint,{depth:1,bevelEnabled:false});
  sliceGeometry.rotateX(-Math.PI/2);
  const flower=new T.Shape(Array.from({length:56},(_,i)=>{
    const angle=i*Math.PI/28,radius=.080+Math.cos(angle*8)*.010;
    return new T.Vector2(Math.cos(angle)*radius,Math.sin(angle)*radius);
  }));
  const pastryGeometry=new T.ExtrudeGeometry(flower,{depth:.019,bevelEnabled:true,bevelSegments:1,bevelThickness:.004,bevelSize:.004});
  pastryGeometry.rotateX(-Math.PI/2);
  const flowerStamp=new T.TorusGeometry(.024,.0035,5,20);flowerStamp.rotateX(-Math.PI/2);
  const bowlProfile=[[0,-.059],[.060,-.059],[.073,-.046],[.096,-.023],[.116,.025],[.119,.046],[.115,.050],
    [.109,.047],[.108,.027],[.089,-.013],[.067,-.032],[0,-.038]];
  const bowlGeometry=new T.LatheGeometry(bowlProfile.map(([radius,y])=>new T.Vector2(radius,y)),24);
  const bowlHandle=new T.TorusGeometry(.034,.009,7,16);
  const wineProfile=[[0,.019],[.034,.020],[.062,.043],[.075,.080],[.070,.125],[.056,.166],
    [.053,.166],[.067,.125],[.072,.080],[.059,.044],[.031,.023],[0,.022]];
  const glassGeometry=new T.LatheGeometry(wineProfile.map(([radius,y])=>new T.Vector2(radius,y)),24);
  const wineGeometry=new T.LatheGeometry([[0,.025],[.035,.026],[.060,.047],[.070,.079],[.069,.103],[0,.103]]
    .map(([radius,y])=>new T.Vector2(radius,y)),24);
  const wineRim=new T.TorusGeometry(.054,.002,6,20);wineRim.rotateX(-Math.PI/2);
  const glassMaterial=new T.MeshStandardMaterial({color:0xf6cfd6,roughness:.15,transparent:true,opacity:.32,depthWrite:false});

  function berry(parent,color,x,y,z,w,h,d){
    const mesh=shape(berryGeometry,color,x,y,z,parent);
    mesh.scale.set(w,h,d);return mesh;
  }
  return {
    yakgwa(parent){
      const wrap=box(0xf4ddab,0,-.041,0,.21,.012,.182,parent);wrap.rotation.y=.12;
      box(0xe8c799,0,-.031,-.080,.20,.024,.017,parent);
      const pastry=shape(pastryGeometry,0xb5632a,0,-.025,0,parent);pastry.rotation.y=.20;
      shape(flowerStamp,0x8d441e,0,-.001,0,parent);
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4;
        berry(parent,i%2?0xf0c581:0xe2a260,Math.cos(angle)*.049,-.002,Math.sin(angle)*.049,.007,.004,.005);
      }
    },
    cake(parent){
      cylinder(0xead9cb,0,-.055,0,.137,.017,20,parent,.90);
      for(const [color,y,h] of [[0xf4b979,-.046,.043],[0xf4e8cc,-.003,.021],[0xf0ad73,.018,.036],[0xedaaae,.054,.018]]){
        shape(sliceGeometry,color,0,y,0,parent).scale.y=h;
      }
      for(const [x,z,radius] of [[-.049,.039,.024],[.018,.021,.025],[.054,.045,.021]]){
        berry(parent,0xc73552,x,.084,z,radius,radius*.80,radius*.76).rotation.z=.18;
        berry(parent,0x5d7851,x,.101,z,.014,.004,.009);
      }
      berry(parent,0xffe7d9,.005,.081,-.059,.018,.012,.017);
    },
    makgeolli(parent){
      shape(bowlGeometry,0xc99755,0,0,0,parent);
      cylinder(0xf8eccc,0,.037,0,.109,.008,24,parent);
      shape(bowlHandle,0xbc8847,.132,.014,0,parent).scale.x=.75;
      for(const [x,z,radius] of [[-.032,.061,.009],[.045,.016,.007],[-.061,-.020,.006],[.025,-.052,.006]]){
        cylinder(0xfff6dd,x,.042,z,radius,.002,8,parent);
      }
    },
    wine(parent){
      cylinder(0xd6c1bc,0,-.087,0,.061,.010,20,parent,1.04);
      cylinder(0xf4e2d9,0,-.034,0,.009,.104,12,parent);
      shape(wineGeometry,0x7b1f3e,0,0,0,parent);
      const glass=new T.Mesh(glassGeometry,glassMaterial);glass.renderOrder=1;parent.add(glass);
      shape(wineRim,0xe6bfc3,0,.166,0,parent);
    }
  };
}
