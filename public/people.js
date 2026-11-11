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
        view:{...row.view},samples:[{at,avatar}],interval:95,sampleAge:0};
      people.set(row.id,person);
    }
    const previous=person.samples.at(-1);
    if(at<previous.at)continue;
    if(at>previous.at){
      const interval=at-previous.at;
      if(distance(previous.avatar,avatar.x,avatar.y)>8){
        person.samples.length=0;
        Object.assign(person.position,{x:avatar.x,y:avatar.y,heading:avatar.heading??252});
        person.playbackAt=undefined;
      }else if(!moving(previous.avatar)&&!previous.avatar.blocked&&moving(avatar)&&interval>250){
        // Anchor the first step after a long idle period to the newest interval.
        person.samples.push({at:at-Math.min(100,person.interval),avatar:previous.avatar});
      }else if(interval<=450&&(moving(previous.avatar)||previous.avatar.blocked)){
        person.interval+=(Math.max(50,Math.min(240,interval))-person.interval)*.28;
      }
      person.samples.push({at,avatar});
      if(person.samples.length>10)person.samples.splice(0,person.samples.length-10);
    }
    const age=Math.max(0,Math.min(140,serverTime-at));
    person.sampleAge+=(age-person.sampleAge)*.3;
    person.avatar=avatar;
    person.targetView=row.view;
    person.nickname=row.nickname;
    person.coat=row.coat;
    person.signal=row.signal;
    person.available=row.handholdAvailable;
  }
  for(const id of people.keys())if(!present.has(id))people.delete(id);
}

export function smoothPeople(people,seconds,serverTime,roundTrip=65){
  const ease=1-Math.exp(-seconds*36),lookEase=1-Math.exp(-seconds*19);
  const frameMs=seconds*1000;
  for(const person of people.values()){
    const {avatar,position,view,targetView,samples}=person;
    const delay=Math.max(60,Math.min(185,person.interval*.64+roundTrip*.25+person.sampleAge*.36));
    const targetTime=serverTime-delay,previousTime=person.playbackAt;
    // Absorb timing changes without rewinding or jumping the rendered movement.
    const sampleTime=previousTime==null||targetTime-previousTime>500?targetTime:
      previousTime+Math.max(frameMs*.8,Math.min(frameMs*1.25,targetTime-previousTime));
    person.playbackAt=sampleTime;
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
      const linear=Math.min(.055,age);
      const lead=a.blocked?0:linear+.085*(1-Math.exp(-(age-linear)/.085));
      const guess={x:a.x+(a.vx||0)*lead,y:a.y+(a.vy||0)*lead};
      goal=clearSegment(a,guess)?guess:a;pose=a;facing=a.heading??targetView.pan;
    }
    const gap=distance(position,goal.x,goal.y);
    const step=seconds*(pose.running?9.5:6.4);
    const ratio=gap>6||gap<.008?1:Math.min(ease,step/gap);
    const next={x:position.x+(goal.x-position.x)*ratio,y:position.y+(goal.y-position.y)*ratio};
    const beforeX=position.x,beforeY=position.y;
    if(gap>6||clearSegment(position,next))Object.assign(position,next);
    else if(walkable(goal.x,goal.y)&&clearSegment(position,pose)){
      const turnRatio=Math.min(1,step/Math.max(.001,distance(position,pose.x,pose.y)));
      position.x+=(pose.x-position.x)*turnRatio;
      position.y+=(pose.y-position.y)*turnRatio;
    }
    const turn=angleDelta(position.heading,facing);
    position.heading=Math.abs(turn)<.04?facing:normalize(position.heading+turn*ease);
    view.pan=normalize(view.pan+angleDelta(view.pan,targetView.pan)*lookEase);
    view.tilt+=(targetView.tilt-view.tilt)*lookEase;
    view.zoom+=(targetView.zoom-view.zoom)*lookEase;
    view.night=targetView.night;
    const progressed=Math.hypot(position.x-beforeX,position.y-beforeY)>.003;
    person.stepping=Boolean(avatar.seat==null&&(sampleTime-last.at<300&&(pose.blocked||moving(pose))||progressed));
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
