import {JUMP_MS} from "./activities.js";
import {isCycling} from "./sejong-bike.js";

const RECOGNITION_RANGE=6.2, CHECK_MS=250;
const empty=new Map();
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const heading=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);
const angle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const between=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const idle=(actor,now)=>!actor.running&&!actor.bus&&!isCycling(actor)&&!actor.up&&
  !(actor.jump>now-JUMP_MS)&&Math.hypot(actor.vx??0,actor.vy??0)<1;

function avoidsFeet(from,to,actor){
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  const closest=length?clamp(((actor.x-from.x)*dx+(actor.y-from.y)*dy)/length):0;
  return distance(between(from,to,closest),actor)>.43;
}

function plan(cat,actor,now,clearSegment){
  const origin=cat.pose,seated=actor.seat!=null;
  const h=(actor.heading??0)*Math.PI/180,forwardX=Math.sin(h),forwardY=-Math.cos(h);
  const rightX=Math.cos(h),rightY=Math.sin(h);
  const preferred=(origin.x-actor.x)*rightX+(origin.y-actor.y)*rightY<0?-1:1;
  for(const side of [preferred,-preferred]){
    const near={x:actor.x+side*rightX*.74+forwardX*(seated?.48:-.30),
      y:actor.y+side*rightY*.74+forwardY*(seated?.48:-.30)};
    const end=seated?near:{x:actor.x+side*rightX*.57+forwardX*.58,
      y:actor.y+side*rightY*.57+forwardY*.58};
    if(!avoidsFeet(origin,near,actor)||!clearSegment(origin,near,.22)||!clearSegment(near,end,.22))continue;
    if(!seated&&[.25,.5,.75,1].some(t=>{
      const point=between(near,end,t);
      return !avoidsFeet(origin,point,actor)||!clearSegment(origin,point,.22);
    }))continue;
    return {origin,near,end,actorId:actor.id,at:now,seated,side,
      companion:{x:actor.x,y:actor.y},walk:Math.max(450,distance(origin,near)*780),
      face:distance(origin,near)>.07?heading(origin,near):heading(origin,actor),
      rest:seated?5600:1240,leave:null,last:null};
  }
  return null;
}

function sample(visit,now,actor){
  const {origin,near,end,at,face,seated,side,walk,rest,companion}=visit;
  const pose=(point,direction,travel=0,extra={})=>({...point,heading:direction,moving:false,
    stride:travel*2*Math.PI/.56,leap:0,jump:null,tail:0,gaze:0,lift:0,lean:0,loaf:0,...extra});
  const age=now-at,notice=410,arrived=notice+walk;
  const friend=actor??companion;
  if(!visit.leave&&actor&&idle(actor,now)&&(actor.seat!=null)===seated&&distance(actor,companion)<.88){
    if(age<notice){
      const turn=ease(age/notice);
      return pose(origin,origin.heading+angle(origin.heading,face)*turn,0,{tail:turn,lift:turn});
    }
    if(age<arrived){
      const t=ease((age-notice)/walk),point=between(origin,near,t);
      return pose(point,face,distance(origin,point),{moving:true,tail:1,lift:.55});
    }
    if(age<arrived+rest){
      const t=(age-arrived)/rest,progress=ease(t);
      const point=between(near,end,progress);
      const direction=seated?face+angle(face,heading(point,friend))*ease(t*4):
        face+angle(face,heading(near,end))*ease(t*4);
      const greeting=Math.sin(t*Math.PI),look=angle(direction,heading(point,friend));
      return pose(point,direction,distance(origin,near)+distance(near,point),{
        moving:!seated&&t>.10&&t<.93,tail:seated?.32:1,
        lift:seated?.28:.55,gaze:Math.max(-.64,Math.min(.64,look))*.62,
        lean:seated?0:-side*greeting,loaf:seated?Math.min(ease(t*8),ease((1-t)*6)):0
      });
    }
  }
  if(!visit.leave){
    const from=visit.last??origin;
    visit.leave={from,at:now,walk:Math.max(280,distance(from,origin)*730)};
  }
  const from=visit.leave.from,back=visit.leave.walk,elapsed=now-visit.leave.at;
  if(elapsed>=back+230)return null;
  const progress=ease(elapsed/back),point=between(from,origin,progress);
  const reverse=distance(from,origin)>.025?heading(from,origin):from.heading;
  const direction=elapsed<back?from.heading+angle(from.heading,reverse)*ease(elapsed/255):
    reverse+angle(reverse,origin.heading)*ease((elapsed-back)/230);
  const settle=1-ease(elapsed/230);
  return pose(point,direction,distance(from,point),{
    moving:elapsed<back&&distance(from,origin)>.025,tail:(from.tail??0)*settle,
    lift:(from.lift??0)*settle,lean:(from.lean??0)*settle,loaf:(from.loaf??0)*settle
  });
}

export function createCatRecognition(clearSegment){
  const visits=new Map(),catCooldown=new Map(),walkerCooldown=new Map();
  let nextCheck=0;
  const available=cat=>cat.available&&cat.pose&&!cat.pose.jump&&!(cat.pose.height>.10)&&!cat.social&&!cat.hunt;
  function update(cats,walkers,now){
    const check=now>=nextCheck;
    if(check)nextCheck=(Math.floor(now/CHECK_MS)+1)*CHECK_MS;
    if(!check&&!visits.size)return empty;
    const people=walkers.filter(actor=>Array.isArray(actor.catFriends)&&actor.catFriends.length);
    if(!visits.size&&!people.length)return empty;
    const poses=new Map(),occupied=new Set();
    for(const cat of cats){
      const visit=visits.get(cat.id);
      if(!visit)continue;
      const actor=people.find(person=>person.id===visit.actorId);
      const familiar=actor?.catFriends.includes(cat.id)?actor:null;
      const pose=available(cat)?sample(visit,now,familiar):null;
      if(pose){
        visit.last=pose;
        occupied.add(visit.actorId);
        poses.set(cat.id,pose);
      }else visits.delete(cat.id);
    }
    if(poses.size<visits.size)for(const id of visits.keys())if(!poses.has(id))visits.delete(id);
    if(!check||visits.size>=4)return poses;
    const ready=people.filter(actor=>!occupied.has(actor.id)&&idle(actor,now)&&now>=(walkerCooldown.get(actor.id)??0));
    if(!ready.length)return poses;
    const pairs=[];
    for(const cat of cats){
      if(!available(cat)||visits.has(cat.id)||now<(catCooldown.get(cat.id)??0))continue;
      for(const actor of ready){
        const range=(actor.x-cat.pose.x)**2+(actor.y-cat.pose.y)**2;
        if(range>RECOGNITION_RANGE**2||!actor.catFriends.includes(cat.id))continue;
        pairs.push({cat,actor,range,key:cat.id+"/"+actor.id});
      }
    }
    pairs.sort((a,b)=>a.range-b.range||(a.key<b.key?-1:1));
    for(const {cat,actor} of pairs){
      if(visits.size>=4)break;
      if(occupied.has(actor.id)||visits.has(cat.id))continue;
      const visit=plan(cat,actor,now,clearSegment);
      if(!visit)continue;
      visits.set(cat.id,visit);
      catCooldown.set(cat.id,now+33000);
      walkerCooldown.set(actor.id,now+24000);
      occupied.add(actor.id);
      const pose=sample(visit,now,actor);
      visit.last=pose;
      poses.set(cat.id,pose);
    }
    for(const [id,at] of walkerCooldown)if(at<=now)walkerCooldown.delete(id);
    return poses;
  }
  function reset(){visits.clear();catCooldown.clear();walkerCooldown.clear();nextCheck=0;}
  return {update,reset};
}
