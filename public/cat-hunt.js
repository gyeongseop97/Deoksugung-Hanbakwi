const clamp=value=>Math.min(1,Math.max(0,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const heading=(a,b)=>Math.atan2(b.x-a.x,b.y-a.y);
const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*clamp(t);
const towards=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const stance=(pose,direction,travel,options={})=>({...pose,heading:direction,
  stride:travel*2*Math.PI/.56,moving:false,jump:null,leap:0,stage:"return",...options});

function score(key){
  let value=2166136261;
  for(let i=0;i<key.length;i++)value=Math.imul(value^key.charCodeAt(i),16777619);
  return value>>>0;
}

function start(cat,bird,now,variant){
  const origin={x:cat.pose.x,y:cat.pose.y,heading:cat.pose.heading};
  return {origin,point:origin,birdId:bird.id,stage:"stalk",since:now,last:now,
    wait:1180+variant%470,travel:0,trail:[origin],crouch:0};
}

function retreat(hunt,now){
  hunt.stage="return";
  hunt.since=now;
  hunt.returnCrouch=hunt.crouch;
}

function walk(hunt,to,length,step,clearSegment,remember){
  const next=towards(hunt.point,to,Math.min(1,step/length));
  if(!clearSegment(hunt.point,next,.20))return false;
  if(remember&&!clearSegment(hunt.trail.at(-1),next,.20))hunt.trail.push(hunt.point);
  const facing=heading(hunt.point,to);
  hunt.point={...next,heading:facing};
  hunt.travel+=Math.min(step,length);
  return true;
}

function advance(hunt,bird,now,birds,clearSegment){
  const elapsed=Math.min(75,Math.max(0,now-hunt.last)),age=now-hunt.since;
  hunt.last=now;
  if(hunt.stage==="stalk"||hunt.stage==="rush"){
    const gap=bird?distance(hunt.point,bird):Infinity;
    if(gap<.80||gap>7||!clearSegment(hunt.point,bird,.20)){
      retreat(hunt,now);
      return stance(hunt.point,hunt.point.heading,hunt.travel,{crouch:hunt.crouch});
    }
    const direction=heading(hunt.point,bird);
    if(hunt.stage==="stalk"){
      const crouch=smooth(age/340);
      const wiggle=crouch*Math.sin(age*.017)*smooth((age-260)/240);
      hunt.crouch=crouch;
      hunt.point={...hunt.point,heading:turn(hunt.origin.heading,direction,age/285)};
      if(age>=hunt.wait){hunt.stage="rush";hunt.since=now;}
      return stance(hunt.point,hunt.point.heading,hunt.travel,{stage:"stalk",crouch,wiggle});
    }
    if(gap<=1.77){
      const landing=towards(hunt.point,bird,Math.max(0,(gap-.84)/gap));
      if(!clearSegment(hunt.point,landing,.20)||!birds.scare(bird.id,now,hunt.point)){
        retreat(hunt,now);
      }else{
        hunt.stage="pounce";hunt.since=now;
        hunt.launch=hunt.point;
        hunt.landing={...landing,heading:direction};
        hunt.crouch=0;
      }
    }else if(age>1250||!walk(hunt,bird,gap,Math.min(gap-1.70,elapsed*.0066),clearSegment,true)){
      retreat(hunt,now);
    }
    if(hunt.stage!=="pounce"){
      hunt.crouch*=Math.max(0,1-elapsed/100);
      return stance(hunt.point,hunt.point.heading,hunt.travel,{stage:hunt.stage,crouch:hunt.crouch,
        moving:hunt.stage==="rush",sprint:hunt.stage==="rush"});
    }
  }
  if(hunt.stage==="pounce"){
    const progress=clamp((now-hunt.since)/375),lift=Math.sin(progress*Math.PI);
    const {launch,landing}=hunt;
    hunt.point={...towards(launch,landing,progress),heading:landing.heading};
    if(progress<1)return stance(hunt.point,landing.heading,hunt.travel,{stage:"pounce",pounce:lift,
      jump:{from:launch,to:landing,arc:.30,progress},leap:lift});
    if(!clearSegment(hunt.trail.at(-1),landing,.20))hunt.trail.push(launch);
    hunt.stage="settle";hunt.since=now;
    return stance(landing,landing.heading,hunt.travel,{stage:"settle",crouch:.45});
  }
  if(hunt.stage==="settle"){
    if(age>=470)retreat(hunt,now);
    return stance(hunt.point,hunt.point.heading,hunt.travel,{stage:"settle",
      scan:Math.sin(clamp(age/470)*Math.PI),crouch:.45*(1-clamp(age/470))});
  }
  const home=hunt.trail.at(-1),gap=distance(hunt.point,home);
  if(gap>.009){
    if(!walk(hunt,home,gap,elapsed*.00156,clearSegment,false))return null;
    if(hunt.trail.length>1&&distance(hunt.point,home)<.009)hunt.trail.pop();
    return stance(hunt.point,hunt.point.heading,hunt.travel,{moving:true});
  }
  if(hunt.trail.length>1)hunt.trail.pop();
  else if(age>=220){
    hunt.homeAt??=now;
    if(now-hunt.homeAt>=200)return null;
    hunt.homeHeading??=hunt.point.heading;
    hunt.point={...hunt.origin,heading:turn(hunt.homeHeading,hunt.origin.heading,(now-hunt.homeAt)/200)};
  }
  return stance(hunt.point,hunt.point.heading,hunt.travel,{crouch:hunt.returnCrouch*(1-clamp(age/190))});
}

export function createCatHunts(birds,clearSegment){
  const hunts=new Map(),cooldown=new Map();
  let checkAt=0,nextHunt=0;
  const canHunt=(cat,encounters)=>cat.available&&!cat.pose.jump&&!(cat.pose.height>.10)&&!encounters.has(cat.id);
  function update(cats,now,encounters){
    const poses=new Map(),canStart=now>=checkAt&&now>=nextHunt&&hunts.size<2;
    if(!hunts.size&&!canStart)return poses;
    if(canStart)checkAt=now+240;
    const targets=birds?.groundTargets(now)??[];
    for(const cat of cats){
      const hunt=hunts.get(cat.id);
      if(!hunt)continue;
      const prey=targets.find(bird=>bird.id===hunt.birdId);
      const pose=canHunt(cat,encounters)?advance(hunt,prey,now,birds,clearSegment):null;
      if(pose)poses.set(cat.id,pose);
      else hunts.delete(cat.id);
    }
    if(!canStart)return poses;
    const busyBirds=new Set([...hunts.values()].map(hunt=>hunt.birdId));
    const options=[];
    for(const cat of cats){
      if(!canHunt(cat,encounters)||poses.has(cat.id)||now<(cooldown.get(cat.id)??0))continue;
      for(const bird of targets){
        if(busyBirds.has(bird.id))continue;
        const dx=bird.x-cat.pose.x,dy=bird.y-cat.pose.y,range=dx*dx+dy*dy;
        if(range<2.45**2||range>5.8**2)continue;
        const variant=score(cat.id+"/"+bird.id+"/"+Math.floor(now/6200));
        if(variant%100>=62)continue;
        options.push({cat,bird,range,variant});
      }
    }
    options.sort((a,b)=>a.range-b.range||a.variant-b.variant);
    for(const {cat,bird,variant} of options){
      if(!clearSegment(cat.pose,bird,.20))continue;
      const hunt=start(cat,bird,now,variant);
      hunts.set(cat.id,hunt);
      cooldown.set(cat.id,now+47000+variant%31000);
      nextHunt=now+8700+variant%6200;
      poses.set(cat.id,stance(hunt.origin,hunt.origin.heading,0,{stage:"stalk",crouch:0,wiggle:0}));
      break;
    }
    return poses;
  }
  function reset(){hunts.clear();cooldown.clear();checkAt=nextHunt=0;}
  return {update,reset};
}
