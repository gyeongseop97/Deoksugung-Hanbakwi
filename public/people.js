import {clearSegment,distance,walkable} from "./layout.js";

export const normalize = angle => ((angle % 360) + 360) % 360;
export const angleDelta = (from,to) => normalize(to-from+180)-180;
export const hexCoat = color => "#"+color.toString(16).padStart(6,"0");
export const moving = avatar => Math.hypot(avatar.vx||0,avatar.vy||0) > .04;

export function receivePeople(people,rows,self,serverTime){
  const present=new Set();
  for(const row of rows){
    if(row.id===self)continue;
    present.add(row.id);
    const {avatar}=row;
    const at=row.updated??serverTime;
    let person=people.get(row.id);
    if(!person){
      person={id:row.id,position:{x:avatar.x,y:avatar.y,heading:avatar.heading??252},
        view:{...row.view},samples:[{at,avatar}]};
      people.set(row.id,person);
    }
    const previous=person.samples.at(-1);
    if(at>previous.at){
      if(distance(previous.avatar,avatar.x,avatar.y)>8){
        person.samples.length=0;
        Object.assign(person.position,{x:avatar.x,y:avatar.y,heading:avatar.heading??252});
      }else if(!moving(previous.avatar)&&moving(avatar)&&at-previous.at>350){
        // Anchor the first step after a long idle period to the newest interval.
        person.samples.push({at:at-100,avatar:previous.avatar});
      }
      person.samples.push({at,avatar});
      if(person.samples.length>10)person.samples.splice(0,person.samples.length-10);
    }
    person.avatar=avatar;
    person.targetView=row.view;
    person.nickname=row.nickname;
    person.coat=row.coat;
    person.signal=row.signal;
    person.available=row.handholdAvailable;
  }
  for(const id of people.keys())if(!present.has(id))people.delete(id);
}

export function smoothPeople(people,seconds,serverTime,delay=185){
  const ease=1-Math.exp(-seconds*28),lookEase=1-Math.exp(-seconds*14);
  const sampleTime=serverTime-delay;
  for(const person of people.values()){
    const {avatar,position,view,targetView,samples}=person;
    const last=samples.at(-1);
    while(samples.length>2&&samples[1].at<=sampleTime)samples.shift();
    const first=samples[0],second=samples[1];
    let goal=first.avatar,pose=goal,facing=goal.heading??targetView.pan;
    if(avatar.seat!=null){
      goal=pose=avatar;facing=avatar.heading??targetView.pan;
    }else if(second&&sampleTime>first.at&&sampleTime<second.at){
      const a=first.avatar,b=second.avatar,ratio=(sampleTime-first.at)/(second.at-first.at);
      const blend={x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};
      goal=clearSegment(a,blend)?blend:a;
      pose=ratio>.5?b:a;
      facing=normalize(facing+angleDelta(facing,b.heading??facing)*ratio);
    }else if(sampleTime>=last.at){
      const a=last.avatar,age=(sampleTime-last.at)/1000;
      const lead=.165*(1-Math.exp(-age/.165));
      const guess={x:a.x+(a.vx||0)*lead,y:a.y+(a.vy||0)*lead};
      goal=clearSegment(a,guess)?guess:a;pose=a;facing=a.heading??targetView.pan;
    }
    const gap=distance(position,goal.x,goal.y),ratio=gap>6||gap<.008?1:ease;
    const next={x:position.x+(goal.x-position.x)*ratio,y:position.y+(goal.y-position.y)*ratio};
    if(gap>6||clearSegment(position,next))Object.assign(position,next);
    else if(walkable(goal.x,goal.y)&&clearSegment(position,pose))Object.assign(position,{x:pose.x,y:pose.y});
    const turn=angleDelta(position.heading,facing);
    position.heading=Math.abs(turn)<.04?facing:normalize(position.heading+turn*ease);
    view.pan=normalize(view.pan+angleDelta(view.pan,targetView.pan)*lookEase);
    view.tilt+=(targetView.tilt-view.tilt)*lookEase;
    view.zoom+=(targetView.zoom-view.zoom)*lookEase;
    view.night=targetView.night;
    person.stepping=Boolean(avatar.seat==null&&(serverTime-last.at<650&&(pose.blocked||moving(pose))||gap>.05));
    person.running=Boolean(person.stepping&&pose.running);
  }
}

export function handPosition(leader,side){
  const angle=(leader.heading??252)*Math.PI/180;
  return {x:leader.x+Math.cos(angle)*side*1.04,y:leader.y+Math.sin(angle)*side*1.04,heading:leader.heading??252};
}

export function handSide(leader,follower){
  if(leader.seat!=null||follower.seat!=null||distance(leader,follower.x,follower.y)>2.4||
     !clearSegment(leader,follower))return 0;
  const options=[-1,1].map(side=>({side,point:handPosition(leader,side)}))
    .filter(({point})=>clearSegment(leader,point)&&clearSegment(follower,point))
    .sort((a,b)=>distance(follower,a.point.x,a.point.y)-distance(follower,b.point.x,b.point.y));
  return options[0]?.side||0;
}

export function pairFits(from,to,side){
  const previous=handPosition(from,side),next=handPosition(to,side);
  return clearSegment(to,next)&&clearSegment(previous,next);
}
