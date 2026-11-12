import {route,clearSegment,planWalk,walkable} from "./layout.js";

export const buskingSpot={x:216.9,y:333.8,name:"돌담길 버스킹"};
export const BUSKING_HEARING_METRES=36;
const BEAT_MS=550;
const notes=[67,71,74,76,74,71,69,null,67,69,71,74,71,69,64,null,67,71,76,79,76,74,71,null,69,67,64,62,64,67,null,null];
export function buskingBeat(clock){
  const beat=Math.floor(clock/BEAT_MS);
  return {beat,note:notes[(beat%notes.length+notes.length)%notes.length],
    phase:(clock-beat*BEAT_MS)/BEAT_MS};
}

function strollingRoute(){
  const points=[route[2]];
  for(const target of route.slice(3,9)){
    const from=points.at(-1);
    if(!walkable(target.x,target.y))continue;
    if(clearSegment(from,target)){points.push(target);continue;}
    const course=planWalk(from,target);
    if(course.length&&Math.hypot(course.at(-1).x-target.x,course.at(-1).y-target.y)<.05)points.push(...course);
  }
  const loop=[...points,...points.slice(1,-1).reverse(),points[0]];
  let seconds=0;
  const legs=loop.slice(1).map((to,index)=>{
    const from=loop[index],dx=to.x-from.x,dy=to.y-from.y,span=Math.hypot(dx,dy)/.9;
    const leg={from,dx,dy,start:seconds,span,heading:Math.atan2(dx,-dy)*180/Math.PI};
    seconds+=span;
    return leg;
  }).filter(leg=>leg.span>.01);
  return (clock,offset)=>{
    if(!legs.length)return null;
    const phase=(clock/1000+offset*seconds)%seconds;
    const leg=legs.find(leg=>phase<leg.start+leg.span)??legs.at(-1);
    const along=(phase-leg.start)/leg.span;
    return {x:leg.from.x+leg.dx*along,y:leg.from.y+leg.dy*along,heading:leg.heading,stepping:true};
  };
}

export function addStreetPeople(T,scene,kit,walkerModels,{floorHeight,labelSprite,handheld=false}){
  const {wx,wz,box,cylinder}=kit;
  const {x,y}=buskingSpot,stage=new T.Group();
  stage.name=buskingSpot.name;stage.position.set(wx(x),floorHeight(buskingSpot),wz(y));scene.add(stage);
  box(0x66513d,0,.025,0,2.7,.045,1.66,stage);
  box(0xc6a16d,0,.048,0,2.45,.01,1.44,stage);
  cylinder(0x483a2d,0,.19,0,.24,.38,10,stage);
  box(0x353a32,1.07,.23,.18,.34,.42,.28,stage);
  box(0x7b684b,-.91,.095,.39,.45,.14,.24,stage);
  box(0x443b31,-.91,.168,.39,.37,.014,.19,stage);

  const playerRoute=strollingRoute();
  const crowd=[
    {coat:0x8f5651,seat:true,x,y,heading:180,label:"돌담길 연주자"},
    {coat:0x709379,x:x-1.7,y:y+2.55,heading:32},
    {coat:0x9c7852,x:x+1.42,y:y+2.43,heading:329},
    {coat:0x576b8b,x:x-.55,y:y+3.16,heading:12},
    {coat:0xad6e57,offset:.07},{coat:0x5e876b,offset:.36},{coat:0x687e96,offset:.64},{coat:0xa08262,offset:.87}
  ].map((person,index)=>({...person,index,model:null}));
  function instrument(model){
    const guitar=new T.Group();guitar.position.set(.038,.195,.346);guitar.rotation.z=-.57;
    const body=new T.Mesh(new T.SphereGeometry(1,12,9),new T.MeshStandardMaterial({color:0xc78c54,roughness:.82}));
    body.scale.set(.226,.267,.063);guitar.add(body);
    cylinder(0x463527,0,.032,.061,.068,.008,16,guitar).rotation.x=Math.PI/2;
    box(0x544032,0,.259,0,.092,.42,.038,guitar);
    box(0x755438,0,.485,0,.14,.105,.05,guitar);
    box(0x5f4731,0,-.116,.059,.15,.037,.016,guitar);
    for(let i=-2;i<=2;i++)box(0xf1d6a7,i*.012,.178,.066,.004,.63,.005,guitar);
    model.chest.add(guitar);
    return guitar;
  }
  function update(clock,now,delta,anchor,sparse=false){
    const range=sparse?25:handheld?44:63;
    stage.visible=Boolean(anchor&&Math.hypot(anchor.x-x,anchor.y-y)<range+10);
    const cue=buskingBeat(clock);
    for(const person of crowd){
      const pose=anchor&&(person.offset===undefined?person:playerRoute(clock,person.offset));
      if(!pose||sparse&&person.index>=5||Math.hypot(pose.x-anchor.x,pose.y-anchor.y)>range){
        if(person.model)person.model.group.visible=false;
        continue;
      }
      if(!person.model){
        person.model=walkerModels.create(person.coat,person.label,person.label?labelSprite:null,"street-"+person.index);
        if(person.seat)person.guitar=instrument(person.model);
      }
      const seat=person.seat?{x,y,heading:180,base:floorHeight(person)+.12}:null;
      const character=person.index%2?"woman":"man";
      walkerModels.update(person.model,{...pose,character,look:{outfit:person.index%3?"coat":"puffer",
        hair:character==="woman"?"bob":"short",eyes:"soft"},running:false,wave:0,vx:0,vy:0},
        {now,clock,delta,seat,floor:floorHeight(pose),turnEase:1-Math.exp(-delta*9)});
      if(person.guitar){
        const strum=cue.note==null?0:Math.sin(cue.phase*Math.PI*2)*.24;
        person.model.arms[0].upper.rotation.x+=.36+strum;
        person.model.arms[0].lower.rotation.z-=.34+strum*.45;
        person.model.arms[1].upper.rotation.x+=.53;
        person.guitar.rotation.z=-.57+strum*.08;
      }
    }
  }
  return {update};
}
