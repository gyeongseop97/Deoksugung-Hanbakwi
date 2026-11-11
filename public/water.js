import {addObstacle} from "./layout.js";

export function addWater(T,scene,sources,{cylinder,rand}) {
  const state=[];
  const sprite=document.createElement("canvas");
  sprite.width=sprite.height=32;
  const ctx=sprite.getContext("2d"),fade=ctx.createRadialGradient(16,16,2,16,16,16);
  fade.addColorStop(0,"rgba(255,255,255,1)");fade.addColorStop(.55,"rgba(255,255,255,.68)");
  fade.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=fade;ctx.fillRect(0,0,32,32);
  const dropTexture=new T.CanvasTexture(sprite);
  for(const {x,z,radius:r} of sources) {
    cylinder(0x8e9087,x,.20,z,r,.41,36);
    cylinder(0xaba89b,x,.44,z,r*1.012,.15,36);
    const pool = new T.Mesh(new T.CircleGeometry(r*.91,42),new T.ShaderMaterial({
      uniforms:{clock:{value:0},night:{value:0}},
      vertexShader:`
        varying vec2 field;
        void main(){field=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
      `,
      fragmentShader:`
        uniform float clock,night;
        varying vec2 field;
        void main(){
          vec2 p=(field-.5)*2.0;float r=length(p);
          float ripples=pow(.5+.5*sin(r*35.0-clock*4.1),12.0)*exp(-r*1.2);
          float wave=.5+.5*sin(p.x*35.0+p.y*21.0+clock*1.1)*sin(p.y*28.0-p.x*17.0-clock*.9);
          vec3 deep=mix(vec3(.15,.35,.40),vec3(.025,.081,.14),night);
          vec3 highlight=mix(vec3(.52,.77,.82),vec3(.28,.50,.68),night);
          vec3 color=mix(deep,highlight,.22+wave*.26+ripples*.31+r*.11);
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }
      `
    }));
    pool.rotation.x=-Math.PI/2;pool.position.set(x,.531,z);scene.add(pool);
    cylinder(0x939b94,x,.76,z,r*.095,.49,16);
    cylinder(0xb6b1a0,x,1.028,z,r*.136,.13,16);
    // A dozen small colliders follow the round lip rather than blocking its corners.
    for(let i=0;i<14;i++){
      const angle=i*Math.PI*2/14;
      addObstacle(x+300+Math.cos(angle)*r*.79,z+225+Math.sin(angle)*r*.79,r*.60,r*.60,0,.53);
    }
    addObstacle(x+300,z+225,r*1.21,r*1.21,0,.53);
    const count=154,positions=new Float32Array(count*3),seeds=[];
    const geom=new T.BufferGeometry();
    const data=new T.BufferAttribute(positions,3);
    data.setUsage(T.DynamicDrawUsage);geom.setAttribute("position",data);
    for(let i=0;i<count;i++)seeds.push({phase:rand(),angle:rand()*Math.PI*2,amp:.65+rand()*.43,side:i%6!==0});
    const material=new T.PointsMaterial({color:0xdbf8ff,map:dropTexture,size:.19,transparent:true,opacity:.91,depthWrite:false,alphaTest:.035});
    const drops=new T.Points(geom,material);
    drops.position.set(x,0,z);drops.frustumCulled=false;scene.add(drops);
    const jets=9,segments=14,streams=new T.BufferGeometry();
    const streamData=new T.BufferAttribute(new Float32Array(jets*segments*6),3);
    streamData.setUsage(T.DynamicDrawUsage);streams.setAttribute("position",streamData);
    const plume=new T.LineSegments(streams,new T.LineBasicMaterial({
      color:0xd6f2fc,transparent:true,opacity:.72,depthWrite:false
    }));
    plume.position.set(x,0,z);plume.frustumCulled=false;scene.add(plume);
    state.push({pool,data,positions,seeds,r,material,streamData,jets,segments});
  }
  return (seconds,night)=>{
    for(const {pool,data,positions,seeds,r,material,streamData,jets,segments} of state){
      pool.material.uniforms.clock.value=seconds;
      pool.material.uniforms.night.value=night;
      material.color.set(night>.5?0xb0dbfb:0xdbf8ff);
      for(let i=0;i<seeds.length;i++){
        const jet=seeds[i],t=(seconds*(jet.side?.73:.63)+jet.phase)%1;
        const travel=jet.side?t*r*.69:(t*.32+.045)*jet.amp;
        const arc=(jet.side?1.17:2.33)*jet.amp*4*t*(1-t);
        positions[i*3]=Math.cos(jet.angle)*travel;
        positions[i*3+1]=.56+arc+(jet.side?.48:.51)*(1-t);
        positions[i*3+2]=Math.sin(jet.angle)*travel;
      }
      data.needsUpdate=true;
      let cursor=0;
      for(let jet=0;jet<jets;jet++){
        const a=jet*Math.PI*2/jets;
        const height=(jet%3===0?2.42:1.31)*(1+.062*Math.sin(seconds*3.5+jet));
        for(let segment=0;segment<segments;segment++){
          for(let sample=segment;sample<=segment+1;sample++){
            const t=sample/segments;
            const radius=.075+t*r*(jet%3===0?.20:.70);
            const bend=Math.sin(t*15-seconds*11+jet)*t*.038;
            streamData.setXYZ(cursor++,Math.cos(a+bend)*radius,.56+.44*(1-t)+4*height*t*(1-t),Math.sin(a+bend)*radius);
          }
        }
      }
      streamData.needsUpdate=true;
    }
  };
}
