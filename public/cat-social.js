const NEARBY = 1.85;
const CHECK_MS = 160;
const STEP = 2 * Math.PI / .56;
const activityTime = {greet:960,rub:1370,play:1050};
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = n => Math.max(0,Math.min(1,n));
const smooth = n => {n=clamp(n);return n*n*(3-2*n);};
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));

function hash(key) {
  let value=2166136261;
  for(const ch of key)value=Math.imul(value^ch.charCodeAt(0),16777619);
  return value>>>0;
}

function blend(a,b,t) {
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,
    height:a.height??b.height,heading:a.heading+angleDelta(a.heading,b.heading)*t};
}

function sample(frames,at) {
  const index=frames.findIndex(frame=>frame.at>=at);
  if(index<=0)return index===0?frames[0].pose:frames.at(-1).pose;
  const {at:start,pose:a}=frames[index-1],{at:end,pose:b}=frames[index];
  return blend(a,b,smooth((at-start)/(end-start)));
}

function fromPose(pose) {
  return {x:pose.x,y:pose.y,height:pose.height,heading:pose.heading??0};
}

function tracksFor(kind,a,b,side) {
  const first=fromPose(a.pose),second=fromPose(b.pose),length=distance(first,second);
  const dx=(second.x-first.x)/length,dy=(second.y-first.y)/length;
  const cx=(first.x+second.x)/2,cy=(first.y+second.y)/2;
  const face=Math.atan2(dx,dy),back=face+Math.PI;
  const point=(along,cross,heading,height)=>({x:cx+dx*along+dy*cross*side,
    y:cy+dy*along-dx*cross*side,heading,height});
  const A=(along,cross=0,heading=face)=>point(along,cross,heading,first.height);
  const B=(along,cross=0,heading=back)=>point(along,cross,heading,second.height);
  if(kind==="rub")return [
    {start:first,action:[[0,A(-.44)],[.25,A(-.33,.31)],[.68,A(.085,.34)],[1,A(.32,.32)]],
      wayBack:[A(-.32,.34,back),A(-.44,.12,back)]},
    {start:second,action:[[0,B(.44)],[.36,B(.40,.004,face+Math.PI*.61)],[.73,B(.45,.013,face)],
      [1,B(.49,.015,face)]],wayBack:[]}
  ];
  if(kind==="play")return [
    {start:first,action:[[0,A(-.47)],[.24,A(-.52,.09)],[.49,A(-.39,.09)],[.78,A(-.53,-.035)],
      [1,A(-.49)]],wayBack:[]},
    {start:second,action:[[0,B(.47)],[.27,B(.49,-.05)],[.52,B(.55,-.15)],[.78,B(.63,-.13)],
      [1,B(.52,-.035)]],wayBack:[]}
  ];
  return [
    {start:first,action:[[0,A(-.435)],[.40,A(-.407,.025)],[.70,A(-.410,.016)],[1,A(-.435)]],wayBack:[]},
    {start:second,action:[[0,B(.435)],[.46,B(.410,-.012)],[.75,B(.415,-.022)],[1,B(.435)]],wayBack:[]}
  ];
}

function frameTracks(kind,a,b,side) {
  const tracks=tracksFor(kind,a,b,side);
  const intro=Math.max(480,...tracks.map(track=>distance(track.start,track.action[0][1])*1500));
  const actionEnd=intro+activityTime[kind];
  for(const track of tracks){
    track.frames=[{at:0,pose:track.start},...track.action.map(([phase,pose])=>({at:intro+phase*activityTime[kind],pose}))];
    let at=actionEnd;
    for(const pose of [...track.wayBack,track.start]){
      at+=Math.max(190,distance(track.frames.at(-1).pose,pose)*1300);
      track.frames.push({at,pose});
    }
    track.end=at;
  }
  return {tracks,intro,actionEnd,end:Math.max(...tracks.map(track=>track.end))};
}

function pathIsClear(frames,walkable,clearSegment) {
  return frames.every(({pose},i)=>walkable(pose.x,pose.y)&&(!i||clearSegment(frames[i-1].pose,pose,.20)));
}

function safeEncounter(encounter,walkable,clearSegment) {
  const [a,b]=encounter.tracks;
  if(!pathIsClear(a.frames,walkable,clearSegment)||!pathIsClear(b.frames,walkable,clearSegment))return false;
  for(let i=0;i<=24;i++){
    const at=encounter.end*i/24;
    if(distance(sample(a.frames,at),sample(b.frames,at))<.31)return false;
  }
  return true;
}

function canSocialize(cat) {
  const p=cat?.pose;
  return Boolean(cat?.available&&p&&!p.jump&&!(p.height>.10)&&Number.isFinite(p.x)&&Number.isFinite(p.y));
}

export function createCatSocial({walkable,clearSegment}) {
  const encounters=new Map(),returning=new Map(),cooldown=new Map(),pairCooldown=new Map();
  let nextCheck=0,lastTime=0;

  function recover(member,cat,at,time) {
    if(!canSocialize(cat)||!member.last)return;
    const home=fromPose(cat.pose),start=fromPose(member.last);
    if(distance(start,home)<.009&&Math.abs(angleDelta(start.heading,home.heading))<.025)return;
    const frames=[{at:0,pose:start}];
    let end=0;
    // The previously traversed waypoints provide a safe route if the direct return is blocked.
    for(const {pose} of member.frames.filter(frame=>frame.at<at).reverse()){
      const previous=frames.at(-1).pose;
      if(clearSegment(previous,home,.20))break;
      if(!clearSegment(previous,pose,.20))continue;
      end+=Math.max(150,distance(previous,pose)*1200);
      frames.push({at:end,pose});
    }
    if(!clearSegment(frames.at(-1).pose,home,.20))return;
    end+=Math.max(280,distance(frames.at(-1).pose,home)*1200);
    frames.push({at:end,pose:home});
    returning.set(member.id,{...member,frames,begin:time,end});
  }

  function render(member,at,stage,phase,poses) {
    const pose=sample(member.frames,at);
    const step=member.last?distance(member.last,pose):0;
    member.stride+=step*STEP;
    member.last=pose;
    poses.set(member.id,{...pose,kind:member.kind,stage,phase,side:member.side,
      initiator:member.initiator,moving:step>.0015,stride:member.stride});
  }

  function detect(cats,time,occupied) {
    const ready=cats.filter(cat=>canSocialize(cat)&&!occupied.has(cat.id)&&time>=(cooldown.get(cat.id)??0));
    ready.sort((a,b)=>a.id===b.id?0:a.id<b.id?-1:1);
    const near=[];
    for(let i=0;i<ready.length;i++)for(let j=i+1;j<ready.length;j++){
      const a=ready[i],b=ready[j],gap=distance(a.pose,b.pose),key=a.id+"/"+b.id;
      if(gap>=.31&&gap<=NEARBY&&time>=(pairCooldown.get(key)??0))near.push({a,b,gap,key});
    }
    near.sort((a,b)=>a.gap-b.gap);
    for(const {a,b,key} of near){
      if(!clearSegment(a.pose,b.pose,.20))continue;
      const variant=hash(key+"/"+Math.floor(time/18000)),roll=variant%100,side=variant&256?1:-1;
      const pair=variant&512?[b,a]:[a,b];
      let kind=roll<54?"greet":roll<94?"rub":"play";
      let encounter=frameTracks(kind,...pair,side);
      if(!safeEncounter(encounter,walkable,clearSegment)){
        if(kind==="greet")continue;
        kind="greet";
        encounter=frameTracks(kind,...pair,side);
        if(!safeEncounter(encounter,walkable,clearSegment))continue;
      }
      const members=encounter.tracks.map((track,i)=>({...track,id:pair[i].id,kind,
        side:i?-side:side,initiator:i===0,stride:pair[i].pose.stride??0,last:track.start}));
      encounters.set(key,{...encounter,members,begin:time});
      for(const member of members)cooldown.set(member.id,time+encounter.end+11500+variant%6300);
      pairCooldown.set(key,time+encounter.end+23000+variant%12000);
      return;
    }
  }

  function update(cats,now) {
    const time=Math.max(lastTime,now);
    lastTime=time;
    const byId=new Map(cats.map(cat=>[cat.id,cat])),occupied=new Set(),poses=new Map();
    for(const [key,event] of encounters){
      const at=time-event.begin;
      if(event.members.some(member=>!canSocialize(byId.get(member.id)))){
        for(const member of event.members)recover(member,byId.get(member.id),at,time);
        encounters.delete(key);
        continue;
      }
      if(at>=event.end){encounters.delete(key);continue;}
      const phase=clamp((at-event.intro)/(event.actionEnd-event.intro));
      const stage=at<event.intro?"approach":at<event.actionEnd?"interact":"return";
      for(const member of event.members){occupied.add(member.id);render(member,at,stage,phase,poses);}
    }
    for(const [id,member] of returning){
      const at=time-member.begin;
      if(at>=member.end||!canSocialize(byId.get(id))){returning.delete(id);continue;}
      occupied.add(id);
      render(member,at,"return",1,poses);
    }
    if(time>=nextCheck){
      nextCheck=time+CHECK_MS;
      detect(cats,time,occupied);
      for(const event of encounters.values())if(event.begin===time){
        for(const member of event.members)render(member,0,"approach",0,poses);
      }
    }
    return poses;
  }

  function reset() {
    encounters.clear();returning.clear();cooldown.clear();pairCooldown.clear();
    nextCheck=lastTime=0;
  }

  return {update,reset};
}
