import {
  route,palacePaths,palaceCourts,palaceGardens,palacePond,palaceWalls,fountain,spawn,ticket,ticketApproach,gate,bridge,court,
  middle,hall,stoneHall,stoneFountain,city,pavilions,estateOutline,nearest,distance as near,walkable,clearSegment,planWalk
} from "./layout.js";
import {normalize,angleDelta,hexCoat,moving,receivePeople,smoothPeople,handPosition,handSide,pairFits} from "./people.js";
import {ITEMS,PET_MS} from "./activities.js";
import {makeWishDrawing} from "./wish-drawing.js";
import {WISH_FLIGHT_MS} from "./wish-art.js";
import {isInsideMuseum,museumBounds,museumGalleries,museumGalleryAt,museumHall} from "./visit-layout.js";
import {museumExhibits} from "./museum-catalog.js";

const $=id=>document.getElementById(id);
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,"0")).join("");
const initialView=()=>({pan:252,tilt:0,zoom:0,night:localStorage.getItem("jeongdong-night")==="true"});
const lookChoices={hair:["short","bob","long","bun"],eyes:["round","soft","bright"],outfit:["coat","puffer","tee","hanbok"]};
const defaultHair=character=>character==="woman"?"long":"short";
function initialAvatar(){
  const character=localStorage.getItem("jeongdong-character")==="woman"?"woman":"man";
  const look={hair:defaultHair(character),eyes:"round",outfit:"coat"};
  try{
    const saved=JSON.parse(localStorage.getItem("jeongdong-look"));
    if(saved?.outfit==="hoodie")saved.outfit="puffer";
    for(const [feature,choices] of Object.entries(lookChoices)){
      if(choices.includes(saved?.[feature]))look[feature]=saved[feature];
    }
  }catch{}
  return {x:spawn.x,y:spawn.y,heading:252,vx:0,vy:0,wish:0,wishOrigin:null,wishHeading:0,wishArt:null,wave:0,emote:null,
    seat:null,seatSide:null,item:null,blushUntil:0,blushLevel:0,pet:null,running:false,blocked:false,character,look};
}
const me=initialAvatar(),people=new Map(),markers=new Map(),seenSignals=new Map(),formations=new Map();
let ownView=initialView(),following=null,world,worldFailed=false;
let firstPerson=localStorage.getItem("jeongdong-first-person")==="true";
let session=null,active=true,joining=false,syncTimer,lastPost=0,lastSync=0,lastWishSynced=0,dirty=true;
let links=[],queuedSignal=null,queuedHand=null,lookDirection,toastTimer;
let course=[],pendingSeat=null,seatClaim=null,thumb=[0,0],thumbId,orbit=null;
let clockOffset=null,roundTrip=65,renderTime=0;
let runToggled=false,shiftHeld=false;
const keys=new Set();
const vectors={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
const fragments=new URLSearchParams(location.hash.slice(1));
const suppliedCode=(fragments.get("code")||"").toUpperCase();
const lobby=$("lobby"),nickname=$("nickname"),joinCode=$("join-code");
nickname.value=localStorage.getItem("jeongdong-nickname")||"";
joinCode.value=suppliedCode;

function toast(message){
  $("toast").textContent=message;$("toast").hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{$("toast").hidden=true;},3200);
}
function setPresence(text,count=0){
  $("presence").lastElementChild.textContent=text;
  $("presence").classList.toggle("live",count>1);
  $("game-presence").textContent=count>0?count+"명 접속":text;
  $("game-presence").classList.toggle("live",count>1);
}
function applyNight(view){
  $("night").setAttribute("aria-pressed",String(Boolean(view.night)));
  $("night").textContent=view.night?"☀ 낮":"☾ 밤";
}
function myLink(){return session&&links.find(link=>link.leader===session.id||link.follower===session.id);}
function amFollowingHands(){const link=myLink();return Boolean(link?.active&&link.follower===session.id);}
function closestPerson(predicate=()=>true){
  let result=null,best=Infinity;
  for(const person of people.values()){
    const distance=near(me,person.position.x,person.position.y);
    if(distance<best&&predicate(person,distance)){result=person;best=distance;}
  }
  return result;
}
function setFollowing(id){
  following=people.has(id)?id:null;
  if(following){course=[];pendingSeat=seatClaim=null;}
  $("camera").textContent=following?people.get(following).nickname+"의 시점":"내 시점";
  $("camera-hint").textContent=following?"아바타는 내 자리에 있어요":"‘여기 봐’로 이 풍경을 건네세요";
  $("follow").textContent=following?"내 시점":"동행 보기";
  $("follow").setAttribute("aria-pressed",String(Boolean(following)));
  $("follow-cover").hidden=!following;
  applyNight(following?people.get(following).view:ownView);
}
$("follow").addEventListener("click",()=>setFollowing(following?null:closestPerson()?.id));
$("follow-cover").addEventListener("click",()=>setFollowing(null));
$("perspective").setAttribute("aria-pressed",String(firstPerson));
$("perspective").addEventListener("click",()=>{
  firstPerson=!firstPerson;
  $("perspective").setAttribute("aria-pressed",String(firstPerson));
  localStorage.setItem("jeongdong-first-person",String(firstPerson));
  focusGame();
});
$("night").addEventListener("click",()=>{
  if(following)setFollowing(null);
  ownView={...ownView,night:!ownView.night};
  localStorage.setItem("jeongdong-night",String(ownView.night));dirty=true;applyNight(ownView);
});

const characterOptions=[...document.querySelectorAll("[data-character]")];
const appearanceOptions=[...document.querySelectorAll("[data-feature]")];
function refreshCharacterPreview(){
  for(const option of characterOptions)attr(option,"aria-pressed",option.dataset.character===me.character);
  for(const option of appearanceOptions){
    attr(option,"aria-pressed",me.look[option.dataset.feature]===option.dataset.option);
  }
  world?.previewWalker($("character-preview"),me);
}
function saveAppearance(){
  localStorage.setItem("jeongdong-character",me.character);
  localStorage.setItem("jeongdong-look",JSON.stringify(me.look));
  dirty=true;refreshCharacterPreview();
}
$("character").addEventListener("click",()=>{
  resetInput();
  $("character-dialog").showModal();
  refreshCharacterPreview();
  characterOptions.find(option=>option.dataset.character===me.character).focus();
});
characterOptions.forEach(option=>option.addEventListener("click",()=>{
  const character=option.dataset.character;
  if(me.look.hair===defaultHair(me.character))me.look={...me.look,hair:defaultHair(character)};
  me.character=character;saveAppearance();
}));
appearanceOptions.forEach(option=>option.addEventListener("click",()=>{
  const {feature,option:choice}=option.dataset;
  if(me.look[feature]===choice)return;
  me.look={...me.look,[feature]:choice};saveAppearance();
}));
$("wave").addEventListener("click",()=>{
  const time=gameTime();
  if(time-me.wave<600)return;
  me.wave=time;dirty=true;$("game").focus({preventScroll:true});
});
function setEmotes(open){
  $("emote-menu").hidden=!open;$("emote-open").setAttribute("aria-expanded",String(open));
}
$("emote-open").addEventListener("click",()=>setEmotes($("emote-menu").hidden));
document.querySelectorAll("[data-emoji]").forEach(button=>button.addEventListener("click",()=>{
  me.emote={emoji:button.dataset.emoji,at:gameTime()};dirty=true;
  setEmotes(false);$("game").focus({preventScroll:true});
}));

const directions=["앞","오른쪽 앞","오른쪽","오른쪽 뒤","뒤","왼쪽 뒤","왼쪽","왼쪽 앞"];
function setLookPin(point){
  $("look-pin").setAttribute("visibility",point?"visible":"hidden");
  $("mini-pin").setAttribute("visibility",point?"visible":"hidden");
  if(!point)return;
  $("look-pin").setAttribute("transform","translate("+point.x+" "+point.y+")");
  $("mini-pin").setAttribute("cx",point.x);$("mini-pin").setAttribute("cy",point.y);
}
function updateLookDirection(now){
  if(!lookDirection)return;
  if(now>=lookDirection.expires){
    lookDirection=null;$("look-direction").hidden=true;setLookPin(null);return;
  }
  const dx=lookDirection.x-me.x,dy=lookDirection.y-me.y,metres=Math.hypot(dx,dy);
  const angle=normalize(Math.atan2(dx,-dy)*180/Math.PI-ownView.pan);
  const arrow=$("look-arrow"),label=$("look-distance");
  const nearby=metres<1.5,word=nearby?"내 자리 바로 옆":directions[Math.round(angle/45)%8]+" · "+Math.round(metres)+"m";
  if(label.textContent!==word)label.textContent=word;
  arrow.textContent=nearby?"•":"↑";
  arrow.style.transform=nearby?"none":"rotate("+angle+"deg)";
}
$("look").addEventListener("click",()=>{
  if(!people.size)return;
  if(following)setFollowing(null);
  queuedSignal={id:token(),view:{...ownView},point:{x:me.x,y:me.y}};
  toast("친구들에게 이 지점을 보냈어요.");
});
function readLookSignals(serverTime){
  let newest;
  for(const person of people.values()){
    const signal=person.signal;
    if(!signal||seenSignals.get(person.id)===signal.id)continue;
    seenSignals.set(person.id,signal.id);
    if(signal.receivedAt&&serverTime-signal.receivedAt>=5000)continue;
    if(!newest||(signal.receivedAt||0)>(newest.signal.receivedAt||0))newest=person;
  }
  if(!newest)return;
  setFollowing(newest.id);
  const point=newest.signal.point??newest.avatar;
  lookDirection={x:point.x,y:point.y,expires:performance.now()+5000};
  $("look-direction").querySelector("strong").textContent=newest.nickname+" 님이 ‘여기 봐’를 보냈어요";
  $("look-direction").hidden=false;setLookPin(point);updateLookDirection(performance.now());
}

function handCandidates(){
  if(!world||!session||me.seat!=null||myLink())return [];
  const busy=new Set(links.flatMap(link=>[link.leader,link.follower]));
  return [...people.values()].filter(person=>person.available&&!busy.has(person.id)&&
    near(me,person.position.x,person.position.y)<=2.4&&handSide(me,{...person.avatar,...person.position})!==0)
    .sort((a,b)=>near(me,a.position.x,a.position.y)-near(me,b.position.x,b.position.y));
}
function updateHandControls(){
  const link=myLink(),incoming=link&&!link.active&&link.follower===session.id;
  const other=link&&people.get(link.leader===session.id?link.follower:link.leader);
  const button=$("hand"),status=$("hand-status"),request=$("hand-offer");
  button.hidden=!(link&&!incoming)&&!handCandidates().length;
  button.disabled=Boolean(queuedHand);
  const label=link?(link.active?"손 놓기":"요청 취소"):"손잡기";
  if(button.textContent!==label)button.textContent=label;
  request.hidden=!incoming;
  $("hand-accept").disabled=$("hand-decline").disabled=Boolean(queuedHand);
  if(incoming){
    const message=(other?.nickname||"친구")+" 님이 손을 내밀었어요.";
    if($("hand-message").textContent!==message)$("hand-message").textContent=message;
  }
  status.hidden=!link||Boolean(incoming);
  if(link&&!incoming){
    const message=link.active?(link.leader===session.id?"손잡고 함께 걷는 중 · 내가 앞장서요":(other?.nickname||"친구")+" 님의 걸음에 맞추는 중"):"손잡기 요청을 보냈어요.";
    if(status.textContent!==message)status.textContent=message;
  }
  const follower=amFollowingHands();
  $("game").classList.toggle("hand-following",follower);$("run").disabled=follower;
}
$("hand").addEventListener("click",()=>{
  const link=myLink();
  if(link){queuedHand={action:"release",id:link.id};return;}
  const candidates=handCandidates();
  if(candidates.length===1){offerHand(candidates[0]);return;}
  if(!candidates.length)return;
  $("hand-list").replaceChildren(...candidates.map(person=>{
    const button=document.createElement("button");
    button.type="button";button.className="quiet";button.textContent=person.nickname;
    button.style.setProperty("--player-color",hexCoat(person.coat));
    button.addEventListener("click",()=>{
      $("hand-people").close();
      offerHand(handCandidates().find(candidate=>candidate.id===person.id));
    });
    return button;
  }));
  $("hand-people").showModal();
});
function offerHand(person){
  if(!person){toast("친구에게 조금 더 가까이 가 주세요.");return;}
  queuedHand={action:"offer",id:token(),peer:person.id,side:handSide(me,{...person.avatar,...person.position})};
}
$("hand-decline").addEventListener("click",()=>{
  const link=myLink();if(link)queuedHand={action:"release",id:link.id};
});
$("hand-accept").addEventListener("click",()=>{
  const link=myLink(),leader=link&&people.get(link.leader);
  if(!leader||link.active||link.follower!==session.id)return;
  const side=handSide(leader.avatar,me);
  if(!side){toast("서로 가까운, 걸을 수 있는 곳에서 손을 잡아 주세요.");return;}
  queuedHand={action:"accept",id:link.id,side};
});

function changeLinks(next){
  const before=myLink(),priorIds=new Set(links.filter(link=>link.active).map(link=>link.id));
  links=next;
  const current=myLink();
  if(current?.active&&!priorIds.has(current.id)){
    resetInput();stand();
  }
  if(before?.active&&!current?.active)resetInput();
  const activeIds=new Set(links.filter(link=>link.active).map(link=>link.id));
  for(const key of formations.keys())if(!activeIds.has(key))formations.delete(key);
}
function pairedPose(link,leader,follower,now){
  if(!formations.has(link.id))formations.set(link.id,{x:follower.x,y:follower.y,started:now});
  const origin=formations.get(link.id),target=handPosition(leader,link.side);
  const age=Math.min(1,(now-origin.started)/410),blend=age*age*(3-2*age);
  const next={x:origin.x+(target.x-origin.x)*blend,y:origin.y+(target.y-origin.y)*blend,heading:target.heading};
  if(clearSegment(follower,next))return next;
  return {...follower,heading:target.heading};
}

function request(url,body){
  return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(4500)});
}
function gameTime(now=performance.now()){
  return clockOffset==null?Date.now():Math.round(now+clockOffset);
}
function placeName(point){
  if(isInsideMuseum(point.x,point.y))return museumGalleryAt(point.x,point.y)?.name??"덕수궁 전시관";
  return nearest(point.x,point.y).name;
}
function updateClock(serverTime,sent,received){
  if(!Number.isFinite(serverTime))return;
  const offset=serverTime-(sent+received)/2;
  clockOffset=clockOffset==null?offset:clockOffset+Math.max(-40,Math.min(40,offset-clockOffset))*.14;
  roundTrip+=(received-sent-roundTrip)*.14;
}
async function sync(){
  const visit=session;
  if(!active||!visit)return;
  const sent=performance.now(),signal=queuedSignal,hand=queuedHand,claim=seatClaim;
  const post=dirty||signal||hand||claim||Date.now()-lastPost>=3800;
  const base={room:visit.room,id:visit.id,key:visit.key};
  const avatar=post?{...me}:null;
  if(avatar&&claim)Object.assign(avatar,{seat:claim.bench,seatSide:claim.side});
  if(avatar&&(avatar.wish===lastWishSynced||gameTime(sent)-avatar.wish>=WISH_FLIGHT_MS))delete avatar.wishArt;
  const body=post?{...base,avatar,view:{...ownView},signal,hand}:base;
  if(post)dirty=false;
  try{
    const response=await request("/api/room",body),data=await response.json();
    if(!active||session!==visit)return;
    if(response.status===409){returnToLobby(data.error);return;}
    if(!response.ok)throw Error(data.error);
    const received=performance.now();
    updateClock(data.serverTime,sent,received);
    lastSync=Date.now();
    if(post){lastPost=lastSync;lastWishSynced=avatar.wish;}
    if(queuedSignal===signal)queuedSignal=null;
    if(queuedHand===hand)queuedHand=null;
    receivePeople(people,data.walkers,visit.id,data.serverTime);
    if(claim)confirmSeat(claim,data.walkers.find(row=>row.id===visit.id)?.avatar);
    changeLinks(data.handholds||[]);
    const link=myLink();
    if(hand?.action==="offer"&&!link)toast("가까이 있는 친구에게 다시 손을 내밀어 주세요.");
    if(hand?.action==="accept"&&!link?.active)toast("손잡기 요청이 끝났어요. 가까이에서 다시 요청해 주세요.");
    if(following&&!people.has(following))setFollowing(null);
    readLookSignals(data.serverTime);
    setPresence(data.walkers.length+"명 접속 중",data.walkers.length);
    $("follow").disabled=$("look").disabled=!people.size;
  }catch{
    if(!active||session!==visit)return;
    dirty=true;
    if(Date.now()-lastSync>2700){
      people.clear();changeLinks([]);setFollowing(null);
      $("follow").disabled=$("look").disabled=true;
    }
    setPresence("다시 연결 중");
  }finally{
    if(active&&session===visit){
      const fast=Boolean(myLink()||queuedHand||queuedSignal||seatClaim||moving(me)||[...people.values()].some(p=>moving(p.avatar)));
      const cadence=fast?85:people.size?150:320;
      syncTimer=setTimeout(sync,document.hidden?1150:Math.max(18,cadence-(performance.now()-sent)));
    }
  }
}

function leaveBeacon(){
  if(session)navigator.sendBeacon("/api/room",JSON.stringify({room:session.room,id:session.id,key:session.key,leave:true}));
}
function returnToLobby(message=""){
  const old=session;
  leaveBeacon();session=null;clearTimeout(syncTimer);resetInput();
  queuedSignal=queuedHand=null;people.clear();changeLinks([]);seenSignals.clear();setFollowing(null);
  lookDirection=null;$("look-direction").hidden=true;setLookPin(null);
  $("invite").disabled=$("look").disabled=$("follow").disabled=true;
  $("lobby-status").textContent=message;
  sessionStorage.removeItem("jeongdong-room-code");
  if(old)joinCode.value=old.code;
  history.replaceState(null,"",location.pathname+location.search);
  if(!lobby.open)lobby.showModal();
  setPresence("방을 선택해 주세요");
}
async function enterRoom(action,code){
  if(joining)return;
  const name=nickname.value.trim();
  if(!name){nickname.reportValidity();return;}
  if([...name].length>16){$("lobby-status").textContent="닉네임은 16자까지 입력할 수 있어요.";return;}
  joining=true;$("create-room").disabled=$("join-room").disabled=true;
  $("lobby-status").textContent="산책방에 들어가는 중이에요.";
  const id=token(),key=token(),avatar=initialAvatar(),view=initialView();
  const angle=parseInt(id.slice(0,8),16)/0x100000000*Math.PI*2;
  const offset=.38+parseInt(id.slice(8,12),16)/0x10000*.67;
  avatar.x+=Math.cos(angle)*offset;avatar.y+=Math.sin(angle)*offset;
  try{
    const sent=performance.now();
    const response=await request("/api/rooms",{action,code,nickname:name,id,key,avatar,view}),data=await response.json();
    if(!response.ok)throw Error(data.error);
    updateClock(data.serverTime,sent,performance.now());renderTime=0;
    session={room:data.room,code:data.code,id,key,...data.profile};
    Object.assign(me,avatar,{nickname:session.nickname,coat:session.coat});
    ownView=view;applyNight(view);dirty=true;lastWishSynced=0;lastPost=lastSync=Date.now();
    people.clear();links=[];seenSignals.clear();formations.clear();resetInput();
    $("location").textContent=spawn.name;
    localStorage.setItem("jeongdong-nickname",session.nickname);
    sessionStorage.setItem("jeongdong-room-code",session.code);
    history.replaceState(null,"","#code="+session.code);
    $("invite").disabled=false;
    $("lobby-status").textContent="";lobby.close();
    if(action==="create")openInvite();
    sync();
  }catch(error){
    $("lobby-status").textContent=error.message==="Failed to fetch"?"연결을 확인한 뒤 다시 시도해 주세요.":error.message;
  }finally{
    joining=false;$("create-room").disabled=$("join-room").disabled=false;
  }
}
$("lobby-form").addEventListener("submit",event=>{
  event.preventDefault();
  const action=event.submitter?.value||(joinCode.value.trim()?"join":"create");
  enterRoom(action,joinCode.value.trim().toUpperCase());
});
$("lobby-form").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&event.target.matches("input")&&joinCode.value.trim()){
    event.preventDefault();event.currentTarget.requestSubmit($("join-room"));
  }
});
lobby.addEventListener("cancel",event=>event.preventDefault());
joinCode.addEventListener("input",()=>{joinCode.value=joinCode.value.toUpperCase();});
function openInvite(){
  if(!session)return;
  $("invite-code").value=session.code;$("invite-dialog").showModal();
}
$("invite").addEventListener("click",openInvite);
$("leave-room").addEventListener("click",()=>{
  $("invite-dialog").close();returnToLobby();
});
async function copyInvite(link){
  if(!session)return;
  const value=link?location.origin+location.pathname+"#code="+session.code:session.code;
  try{
    await navigator.clipboard.writeText(value);toast(link?"초대 링크를 복사했어요.":"초대코드를 복사했어요.");
  }catch{
    $("invite-code").select();toast("선택한 초대코드를 복사해 주세요.");
  }
}
$("copy").addEventListener("click",()=>copyInvite(false));
$("copy-link").addEventListener("click",()=>copyInvite(true));
document.querySelectorAll("dialog .close").forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
$("model-credits").addEventListener("click",()=>$("credits-dialog").showModal());
window.addEventListener("pagehide",()=>{active=false;clearTimeout(syncTimer);leaveBeacon();});
window.addEventListener("pageshow",event=>{
  if(!event.persisted)return;
  active=true;
  if(session){const code=session.code;returnToLobby();enterRoom("join",code);}
});

function markPace(){
  $("run").setAttribute("aria-pressed",String(runToggled));$("run").firstChild.textContent=runToggled?"걷기 ":"달리기 ";
}
$("run").addEventListener("click",()=>{
  if(amFollowingHands())return;
  runToggled=!runToggled;markPace();$("game").focus({preventScroll:true});
});
function stand(){if(me.seat!=null){me.seat=me.seatSide=null;dirty=true;}}
function benchNearby(){
  let choice=null,nearby=false,gap=3.8;
  world?.benches.forEach((bench,index)=>{
    if(near(bench,me.x,me.y)>5)return;
    bench.slots.forEach((slot,side)=>{
      const distance=near(slot.approach,me.x,me.y);
      if(distance>=3.8||!walkable(slot.approach.x,slot.approach.y))return;
      nearby=true;
      if(distance>=gap)return;
      for(const {avatar} of people.values()){
        if(avatar.seat===index&&(avatar.seatSide??0)===side)return;
      }
      choice={bench:index,side,approach:slot.approach};gap=distance;
    });
  });
  return {choice,nearby};
}
function confirmSeat(claim,avatar){
  if(seatClaim!==claim){dirty=true;return;}
  seatClaim=null;
  const slot=avatar?.seat===claim.bench&&world.benches[claim.bench]?.slots[avatar.seatSide??0];
  if(!slot||!walkable(slot.approach.x,slot.approach.y)){
    dirty=true;toast("벤치에 빈자리가 없어요.");return;
  }
  Object.assign(me,slot.approach,{seat:claim.bench,seatSide:avatar.seatSide??0,heading:slot.heading});
  dirty=true;
}
function interactBench(){
  if(myLink()?.active||pendingSeat||seatClaim)return;
  if(me.seat!=null){stand();return;}
  const {choice}=benchNearby();
  if(choice)walkTo(choice.approach,choice);
}
$("sit").addEventListener("click",interactBench);
function setMap(open){
  $("map-panel").classList.toggle("expanded",open);
  $("map-toggle").setAttribute("aria-expanded",String(open));
  if(!open&&$("map-panel").contains(document.activeElement))$("map-toggle").focus();
}
$("map-toggle").addEventListener("click",()=>setMap($("map-toggle").getAttribute("aria-expanded")!=="true"));
$("close-map").addEventListener("click",()=>setMap(false));
function walkTo(target,seat=null,via=[]){
  if(!target||!session||amFollowingHands()||!world&&!worldFailed)return;
  stand();
  const steps=[];
  let start=me;
  for(const point of [...via,target]){
    const leg=planWalk(start,point);
    if(!leg.length||via.length&&near(point,leg.at(-1).x,leg.at(-1).y)>.75){
      toast("걸을 수 있는 길을 터치해 주세요.");return;
    }
    steps.push(...leg);start=leg.at(-1);
  }
  if(following)setFollowing(null);
  course=steps;seatClaim=null;pendingSeat=seat;
}
$("palace-target").addEventListener("click",()=>{
  const checkpoints=me.x>gate.x-4?[gate,bridge,middle]:me.y>middle.y+4?[middle]:[];
  walkTo(court,null,checkpoints);setMap(false);
});
$("entrance-target").addEventListener("click",()=>{walkTo(ticketApproach);setMap(false);});
$("museum-target").addEventListener("click",()=>{
  if(!world)return;
  walkTo(isInsideMuseum(me.x,me.y)?world.museum.insideDoor:world.museum.outsideDoor);setMap(false);
});

const joystick=$("joystick");
function beginManualMove(){
  if(following)setFollowing(null);
  course=[];pendingSeat=seatClaim=null;
}
function moveThumb(event){
  const rect=joystick.getBoundingClientRect();
  const radius=Math.min(rect.width,rect.height)*.30;
  const dx=(event.clientX-rect.left-rect.width/2)/radius;
  const dy=(event.clientY-rect.top-rect.height/2)/radius;
  const magnitude=Math.hypot(dx,dy),limit=Math.max(1,magnitude);
  const pace=Math.max(0,(Math.min(1,magnitude)-.12)/.88);
  thumb=magnitude?[dx/magnitude*pace,dy/magnitude*pace]:[0,0];
  joystick.style.setProperty("--jx",dx/limit*radius+"px");joystick.style.setProperty("--jy",dy/limit*radius+"px");
}
joystick.addEventListener("pointerdown",event=>{
  event.stopPropagation();
  if(event.button!==0||thumbId!==undefined||amFollowingHands())return;
  thumbId=event.pointerId;beginManualMove();
  $("game").focus({preventScroll:true});
  joystick.setPointerCapture(thumbId);moveThumb(event);
});
joystick.addEventListener("pointermove",event=>{if(event.pointerId===thumbId)moveThumb(event);});
function releaseThumb(){
  thumbId=undefined;thumb=[0,0];
  joystick.style.setProperty("--jx","0px");joystick.style.setProperty("--jy","0px");
}
for(const type of ["pointerup","pointercancel","lostpointercapture"]){
  joystick.addEventListener(type,event=>{if(event.pointerId===thumbId)releaseThumb();});
}
function clearManualInput(){keys.clear();shiftHeld=false;orbit=null;releaseThumb();}
function resetInput(){clearManualInput();course=[];pendingSeat=seatClaim=null;}
window.addEventListener("blur",clearManualInput);
window.addEventListener("keydown",event=>{
  if(event.key==="Escape"){setMap(false);setEmotes(false);}
  if(!session||event.target.closest("input, dialog"))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(event.key==="Shift")shiftHeld=true;
  if(key==="f"&&!event.repeat&&!$("sit").hidden){interactBench();return;}
  if(key==="e"&&!event.repeat&&!$("wish").disabled){openWish();return;}
  if(!vectors[key]||event.ctrlKey||event.metaKey||event.altKey)return;
  event.preventDefault();
  if(amFollowingHands())return;
  beginManualMove();keys.add(key);
});
window.addEventListener("keyup",event=>{
  if(event.key==="Shift")shiftHeld=false;
  keys.delete(event.key.length===1?event.key.toLowerCase():event.key);
});
document.querySelectorAll("[data-key]").forEach(button=>{
  button.addEventListener("pointerdown",event=>{
    if(event.button!==0||amFollowingHands())return;
    event.preventDefault();$("game").focus({preventScroll:true});
    button.setPointerCapture(event.pointerId);beginManualMove();keys.add(button.dataset.key);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"]){
    button.addEventListener(type,()=>keys.delete(button.dataset.key));
  }
  button.addEventListener("click",event=>{
    if(event.detail!==0||amFollowingHands())return;
    beginManualMove();
    const [dx,dy]=vectors[button.dataset.key];
    moveWithInput(dx,dy,.80,myLink(),!worldFailed);
  });
});
$("world").addEventListener("click",event=>{
  const point=new DOMPoint(event.clientX,event.clientY).matrixTransform($("world").getScreenCTM().inverse());
  walkTo(point);setMap(false);
});
$("game").addEventListener("pointerdown",event=>{
  if(orbit||(event.button!==0&&event.button!==2)||event.target.closest("button,#joystick,.emote-menu"))return;
  setEmotes(false);$("game").focus({preventScroll:true});
  orbit={x:event.clientX,y:event.clientY,id:event.pointerId,dragged:false,tap:event.button===0&&thumbId===undefined&&!keys.size};
  $("game").setPointerCapture(event.pointerId);
});
$("game").addEventListener("pointermove",event=>{
  if(!orbit||orbit.id!==event.pointerId)return;
  if(!orbit.dragged&&Math.hypot(event.clientX-orbit.x,event.clientY-orbit.y)<8)return;
  ownView={...ownView,pan:normalize(ownView.pan+(event.clientX-orbit.x)*.34),
    tilt:Math.max(firstPerson?-72:-24,Math.min(firstPerson?65:48,ownView.tilt+(event.clientY-orbit.y)*.26))};
  Object.assign(orbit,{x:event.clientX,y:event.clientY,dragged:true});dirty=true;
});
$("game").addEventListener("pointerup",event=>{
  if(!orbit||orbit.id!==event.pointerId)return;
  if(orbit.tap&&!orbit.dragged&&!keys.size&&thumbId===undefined)walkTo(world?.pick(event.clientX,event.clientY));
  orbit=null;
});
$("game").addEventListener("contextmenu",event=>{
  if(!event.target.closest("button,#joystick,.emote-menu"))event.preventDefault();
});
for(const type of ["pointercancel","lostpointercapture"]){
  $("game").addEventListener(type,event=>{if(orbit?.id===event.pointerId)orbit=null;});
}

function move(x,y){
  if(!session||(x===me.x&&y===me.y)||!clearSegment(me,{x,y}))return false;
  const aim=normalize(Math.atan2(x-me.x,me.y-y)*180/Math.PI);
  const link=myLink();
  const heading=link?.active?normalize(me.heading+angleDelta(me.heading,aim)*.26):aim;
  if(link?.active&&!pairFits(me,{x,y,heading},link.side))return false;
  stand();Object.assign(me,{x,y,heading});
  if(following)setFollowing(null);
  dirty=true;return true;
}
function nearWishFountain(){
  return Boolean(world&&session&&!following&&me.seat==null&&near(fountain,me.x,me.y)<13);
}
const wishDrawing=makeWishDrawing(art=>{
  const time=gameTime();
  const message=!nearWishFountain()?"분수 가까이에서 소원등을 날릴 수 있어요.":
    time-me.wish<2800?"잠시 뒤에 다시 날려 주세요.":"";
  const status=$("wish-status");
  status.textContent=message;status.hidden=!message;
  if(message)return false;
  me.wish=time;me.wishOrigin={x:me.x,y:me.y};
  me.wishHeading=normalize(ownView.pan);
  me.wishArt=art?.some(Boolean)?art:null;
  dirty=true;toast("소원등을 띄웠어요.");
});
function openWish(){
  if(!nearWishFountain())return;
  resetInput();$("wish-status").hidden=true;wishDrawing.open();
}
$("wish").addEventListener("click",openWish);

function nearbyStation(){
  let best=null,range=2.55;
  for(const station of world?.stations??[]){
    const distance=near(station,me.x,me.y);
    if(distance<range&&clearSegment(me,station)){best=station;range=distance;}
  }
  return best;
}
function canUseItem(time){
  return Boolean(me.item?.remaining&&time-me.item.started>=ITEMS[me.item.kind].duration);
}
function portalNearby(){
  const museum=world?.museum;
  if(!museum)return null;
  const inside=museum.isInside(me.x,me.y);
  const door=inside?museum.insideDoor:museum.outsideDoor;
  return near(door,me.x,me.y)<2.25&&clearSegment(me,door)?{inside,museum}:null;
}
function nearbyExhibit(){
  const gallery=museumGalleryAt(me.x,me.y);
  if(!gallery||!world)return null;
  let closest=null,gap=Infinity;
  for(const exhibit of world.museum.exhibits){
    if(exhibit.gallery!==gallery.id)continue;
    const distance=near(exhibit,me.x,me.y);
    if(distance<exhibit.radius&&distance<gap){closest=exhibit;gap=distance;}
  }
  return closest;
}
function focusGame(){$("game").focus({preventScroll:true});}
$("pet-cat").addEventListener("click",()=>{
  if(!session||following||myLink()?.active||me.seat!=null)return;
  const time=gameTime(),cat=world?.parkLife.nearestCat(me.x,me.y);
  if(!cat||time-(me.pet?.at??0)<PET_MS)return;
  resetInput();
  me.heading=normalize(Math.atan2(cat.x-me.x,me.y-cat.y)*180/Math.PI);
  me.pet={id:cat.id,at:time};dirty=true;focusGame();
});
$("take-item").addEventListener("click",()=>{
  if(!session||following||me.seat!=null)return;
  const station=nearbyStation(),time=gameTime();
  if(!station||station.kind===me.item?.kind||me.item&&time-me.item.started<ITEMS[me.item.kind].duration)return;
  const spec=ITEMS[station.kind];
  me.item={kind:station.kind,remaining:spec.uses,started:0};dirty=true;
  toast(spec.name+" 받았어요.");focusGame();
});
$("use-item").addEventListener("click",()=>{
  if(!session||following)return;
  const time=gameTime();
  if(!canUseItem(time))return;
  me.item={...me.item,remaining:me.item.remaining-1,started:time};
  if(me.item.kind==="beer"){
    const previous=time<me.blushUntil?me.blushLevel||1:0;
    me.blushLevel=Math.min(3,previous+1);
    me.blushUntil=time+120000;
  }
  dirty=true;focusGame();
});
$("museum-door").addEventListener("click",()=>{
  const portal=portalNearby();
  if(!session||following||myLink()?.active||!portal)return;
  const {inside,museum}=portal,destination=inside?museum.outsideDoor:museum.insideSpawn;
  resetInput();stand();
  Object.assign(me,{x:destination.x,y:destination.y,heading:destination.heading,vx:0,vy:0,blocked:false,running:false});
  ownView={...ownView,pan:destination.heading,tilt:0};
  $("location").textContent=inside?"석조전 서관":"덕수궁 전시관";
  dirty=true;focusGame();
});
$("museum-exhibit").addEventListener("click",()=>{
  const exhibit=session&&!following&&nearbyExhibit();
  if(!exhibit)return;
  resetInput();
  $("exhibit-gallery").textContent=placeName(me);
  $("exhibit-title").textContent=exhibit.title;
  $("exhibit-period").textContent=exhibit.credit+(exhibit.object?" · 확대 재현":"");
  $("exhibit-description").textContent=exhibit.description;
  $("exhibit-source").href=exhibit.source;
  $("exhibit-source").textContent=exhibit.sourceLabel+" ↗";
  const image=$("exhibit-image");
  image.hidden=!exhibit.file;
  image.alt=exhibit.file?exhibit.title:"";
  if(exhibit.file)image.src="/art/"+exhibit.file+".webp";
  else image.removeAttribute("src");
  $("exhibit-dialog").showModal();
});

function setActivity(id,label,disabled=false){
  const button=$(id);
  if(button.hidden===Boolean(label))button.hidden=!label;
  if(button.disabled!==disabled)button.disabled=disabled;
  if(label&&button.textContent!==label)button.textContent=label;
}
function updateActivities(time){
  if(me.item&&me.item.remaining===0&&time-me.item.started>=ITEMS[me.item.kind].duration){
    me.item=null;dirty=true;
  }
  const eligible=world&&session&&!following;
  const atFountain=nearWishFountain();
  if($("wish").hidden===Boolean(atFountain))$("wish").hidden=$("wish").disabled=!atFountain;
  const cat=eligible&&me.seat==null&&!myLink()?.active&&world.parkLife.nearestCat(me.x,me.y);
  setActivity("pet-cat",cat?"쓰다듬기":null,time-(me.pet?.at??0)<PET_MS);
  if(cat)attr($("pet-cat"),"title",cat.name+" 쓰다듬기");
  const station=eligible&&me.seat==null&&nearbyStation();
  const busy=Boolean(me.item&&time-me.item.started<ITEMS[me.item.kind].duration);
  setActivity("take-item",station&&station.kind!==me.item?.kind?ITEMS[station.kind].name+" 받기":null,busy);
  const spec=eligible&&me.item&&ITEMS[me.item.kind];
  setActivity("use-item",spec?(me.item.kind==="sparkler"?spec.verb:spec.verb+" · "+me.item.remaining+"회"):null,!canUseItem(time));
  const portal=eligible&&portalNearby();
  setActivity("museum-door",portal?(portal.inside?"나가기":"입장하기"):null,Boolean(myLink()?.active));
  const exhibit=eligible&&nearbyExhibit();
  setActivity("museum-exhibit",exhibit?"작품 설명":null);
  if(exhibit)attr($("museum-exhibit"),"aria-label",exhibit.title+" 작품 설명");
}
function moveWithInput(dx,dy,speed,link,cameraRelative){
  if(cameraRelative){
    const angle=ownView.pan*Math.PI/180;
    [dx,dy]=[dx*Math.cos(angle)-dy*Math.sin(angle),dx*Math.sin(angle)+dy*Math.cos(angle)];
  }
  if(!speed||(!dx&&!dy))return false;
  stand();
  const scale=speed/Math.max(1,Math.hypot(dx,dy));
  if(move(me.x+dx*scale,me.y+dy*scale))return false;
  const heading=normalize(Math.atan2(dx,-dy)*180/Math.PI);
  if(me.heading!==heading&&(!link?.active||pairFits(me,{...me,heading},link.side))){
    me.heading=heading;dirty=true;
  }
  return true;
}
function walkCourse(speed){
  const goal=course[0];
  if(!goal)return;
  const remaining=near(goal,me.x,me.y),arriving=remaining<=speed;
  const advanced=remaining<1e-6||(arriving?move(goal.x,goal.y):
    move(me.x+(goal.x-me.x)*speed/remaining,me.y+(goal.y-me.y)*speed/remaining));
  if(!advanced){course=[];pendingSeat=null;}
  else if(arriving)course.shift();
  if(!course.length&&pendingSeat!=null){
    if(near(pendingSeat.approach,me.x,me.y)<.4){seatClaim=pendingSeat;dirty=true;}
    pendingSeat=null;
  }
}
function motion(now,elapsed){
  const oldX=me.x,oldY=me.y,link=myLink(),follower=amFollowingHands();
  const leader=follower&&people.get(link.leader);
  const pace=runToggled||shiftHeld;
  const speed=elapsed*(pace?6.675:2.58);
  let blocked=false;
  if(leader){
    const next=pairedPose(link,leader.position,me,now);
    if(me.heading!==next.heading){me.heading=next.heading;dirty=true;}
    if(next.x!==me.x||next.y!==me.y){me.x=next.x;me.y=next.y;dirty=true;}
    blocked=Boolean(leader.avatar.blocked);
  }else if(session&&elapsed>0){
    if(keys.size||thumbId!==undefined){
      const [dx,dy]=Array.from(keys,key=>vectors[key]).reduce(([x,y],[vx,vy])=>[x+vx,y+vy],thumb);
      blocked=moveWithInput(dx,dy,speed,link,!worldFailed&&(thumbId!==undefined||document.activeElement!==$("world")));
    }else walkCourse(speed);
  }
  const moved=oldX!==me.x||oldY!==me.y;
  if(moved){
    const location=placeName(me);
    if($("location").textContent!==location)$("location").textContent=location;
  }
  const vx=moved&&elapsed?Math.max(-8,Math.min(8,(me.x-oldX)/elapsed)):0;
  const vy=moved&&elapsed?Math.max(-8,Math.min(8,(me.y-oldY)/elapsed)):0;
  const running=leader?Boolean(leader.avatar.running):(moved||blocked)&&pace;
  if(me.vx!==vx||me.vy!==vy||me.blocked!==blocked||me.running!==running){
    Object.assign(me,{vx,vy,blocked,running});dirty=true;
  }
  return leader?leader.stepping||moved:moved||blocked;
}
function actors(now,stepping){
  const self={...me,id:session?.id||"preview",stepping},others=new Map();
  for(const person of people.values()){
    others.set(person.id,{...person.avatar,...person.position,id:person.id,nickname:person.nickname,
      coat:person.coat,stepping:person.stepping,running:person.running});
  }
  function actor(id){return id===self.id?self:others.get(id);}
  for(const link of links){
    if(!link.active)continue;
    const leader=actor(link.leader),follower=actor(link.follower);
    if(!leader||!follower)continue;
    if(follower!==self)Object.assign(follower,pairedPose(link,leader,follower,now));
    leader.hand=-link.side;follower.hand=link.side;
    follower.stepping=leader.stepping;follower.running=leader.running;
  }
  return {self,others};
}
let lastFrame=performance.now();
function frame(now){
  const elapsed=Math.max(0,Math.min(56,now-lastFrame))/1000;lastFrame=now;
  const time=gameTime(now);
  renderTime=Math.max(renderTime,time-130-Math.min(170,roundTrip*.68));
  smoothPeople(people,elapsed,time,time-renderTime);
  const stepping=motion(now,elapsed);
  const {self,others}=actors(now,stepping);
  const focus=following?others.get(following):null;
  const view=focus?people.get(following).view:ownView;
  if(Boolean(view.night)!==($("night").getAttribute("aria-pressed")==="true"))applyNight(view);
  updateActivities(time);
  const seatEnabled=world&&session&&!following&&!myLink()?.active;
  const bench=seatEnabled&&me.seat==null&&!pendingSeat&&!seatClaim?benchNearby():null;
  const seatLabel=me.seat!=null?"일어나기":seatClaim?"자리 확인 중":pendingSeat?"벤치로 이동 중":
    bench?.choice?"앉기":bench?.nearby?"빈자리 없음":null;
  setActivity("sit",seatEnabled?seatLabel:null,me.seat==null&&!bench?.choice);
  attr($("sit"),"aria-pressed",me.seat!=null);
  const place=focus?placeName(focus):$("location").textContent;
  if($("game-place").textContent!==place)$("game-place").textContent=place;
  updateHandControls();updateLookDirection(now);updateMaps(self,others);
  world?.render({me:self,peers:[...others.values()],focus,view,firstPerson,destination:course.at(-1),clock:time},now);
  requestAnimationFrame(frame);
}

const svgNS="http://www.w3.org/2000/svg";
function svg(parent,type,attributes,text){
  const element=document.createElementNS(svgNS,type);
  for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
  if(text)element.textContent=text;
  parent.append(element);return element;
}
const outline=points=>points.map(p=>p.x.toFixed(1)+","+p.y.toFixed(1)).join(" ");
const museumMaps=[];
function drawMap(base,mini=false){
  svg(base,"rect",{width:600,height:450,fill:"#23302a"});
  if(!mini)svg(base,"rect",{width:600,height:450,fill:"url(#grid)"});
  svg(base,"polygon",{points:outline(estateOutline),fill:"#465248",stroke:"#7a8566","stroke-width":1.3});
  for(const garden of palaceGardens){
    const fill=garden.kind==="grove"?"#314938":garden.kind==="parterre"?"#607651":"#506649";
    svg(base,"polygon",{points:outline(garden.outline),fill});
  }
  for(const court of palaceCourts)svg(base,"polygon",{points:outline(court.outline),fill:court.kind==="stone"?"#766c5a":"#626452"});
  for(const [path,color,width] of [[route,"#ae9870",12],...palacePaths.map(p=>[p.points,p.surface==="stone"?"#c9b899":"#a29e7d",p.width])]){
    svg(base,"polyline",{points:outline(path),fill:"none",stroke:color,"stroke-opacity":.60,"stroke-width":width,"stroke-linecap":"round","stroke-linejoin":"round"});
    if(!mini&&path===route)svg(base,"polyline",{points:outline(path),fill:"none",stroke:color,"stroke-width":1.5,"stroke-dasharray":"2 5"});
  }
  svg(base,"polygon",{points:outline(palacePond.outline),fill:"#3b777d",stroke:"#739595","stroke-width":1});
  for(const {a,b,kind} of palaceWalls){
    svg(base,"line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:kind==="outer"?"#929283":"#a07d62","stroke-width":kind==="outer"?1.35:1.12});
  }
  for(const building of [...city,...pavilions,{...gate,w:14.2,d:8.1,angle:Math.PI/2},{...middle,w:10.9,d:6.9,angle:-.19},
      {...hall,w:24,d:23,angle:-.19},{...stoneHall,w:54.2,d:31}]){
    const style={fill:building===city[0]?"#556b4c":building.brick?"#82594c":"#827659",stroke:"#aa9774","stroke-width":.65};
    if(building.outline){
      svg(base,"polygon",{points:outline(building.outline),...style});
      continue;
    }
    svg(base,"rect",{x:building.x-building.w/2,y:building.y-building.d/2,width:building.w,height:building.d,
      ...style,
      transform:"rotate("+(-(building.angle||0)*180/Math.PI)+" "+building.x+" "+building.y+")",rx:2});
  }
  const palaceLabels=new Set(["돈덕전","정관헌","광명문","함녕전","석어당","덕홍전"]);
  for(const point of [...pavilions.filter(building=>palaceLabels.has(building.name)),palacePond]){
    svg(base,"text",{x:point.x,y:point.y+2.6,class:mini?"mini-landmark":"map-label","text-anchor":"middle",
      ...(mini?{}:{style:"font-size:9px;stroke-width:2.6px"})},point===palacePond?"연못":point.name);
  }
  const {minX,maxX,minY,maxY}=museumBounds;
  const interior=svg(base,"g",{visibility:"hidden"});
  museumMaps.push(interior);
  svg(interior,"rect",{x:minX,y:minY,width:maxX-minX,height:maxY-minY,fill:"#625a46",stroke:"#d3b684","stroke-width":.7});
  for(const gallery of museumGalleries){
    svg(interior,"rect",{x:gallery.minX,y:gallery.minY,width:gallery.maxX-gallery.minX,
      height:gallery.maxY-gallery.minY,fill:gallery.mapColor,stroke:"#c0a782","stroke-width":.62});
    svg(interior,"line",{x1:gallery.doorX,x2:gallery.doorX,
      y1:gallery.doorY-museumHall.doorWidth/2,y2:gallery.doorY+museumHall.doorWidth/2,stroke:"#625a46","stroke-width":1.15});
    svg(interior,"text",{x:(gallery.minX+gallery.maxX)/2,y:(gallery.minY+gallery.maxY)/2+1.4,
      fill:"#fff1d9","font-size":mini?5.1:3.1,"text-anchor":"middle"},mini?gallery.shortName:gallery.name);
  }
  svg(interior,"line",{x1:78.4,x2:81.6,y1:maxY,y2:maxY,stroke:"#d4b985","stroke-width":1.6});
  if(mini){
    for(const [point,label,dy] of [[ticket,"매표소",-4],[gate,"대한문",9],[bridge,"금천교",-4],
      [middle,"중화문",8],[hall,"중화전",-5],[stoneHall,"석조전",-5],[fountain,"정동 분수",8]]){
      svg(base,"circle",{cx:point.x,cy:point.y,r:1.7,fill:"#d9c28e"});
      svg(base,"text",{x:point.x,y:point.y+dy,class:"mini-landmark","text-anchor":"middle"},label);
    }
    return;
  }
  for(const [point,label,dx,dy] of [[ticket,"매표소",22,-10],[gate,"대한문",19,19],[bridge,"금천교",-12,-9],
    [middle,"중화문",0,18],[hall,"중화전",0,-17],[stoneHall,"석조전",0,-23],[stoneFountain,"분수 정원",3,-9],
    [fountain,"정동 분수",-11,16],[city[3],"정동제일교회",-14,-13],[route[4],"덕수궁 돌담길",15,24],[city[0],"서울광장",-15,-12]]){
    svg(base,"circle",{cx:point.x,cy:point.y,r:3.6,fill:"#e1c790"});
    svg(base,"text",{x:point.x+dx,y:point.y+dy,class:"map-label","text-anchor":"middle"},label);
  }
  svg(base,"text",{x:548,y:94,class:"map-faint","text-anchor":"middle"},"↑ N");
}
function attr(node,key,value){if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);}
function drawDestinations(world){
  const layer=$("map-landscape");
  const doors=[...world.stations,{...world.museum.outsideDoor,name:"전시관 입구"}];
  for(const point of doors){
    svg(layer,"circle",{cx:point.x,cy:point.y,r:2.6,fill:"#f1d8a6",stroke:"#513e32","stroke-width":.9});
    svg(layer,"text",{x:point.x,y:point.y-4.6,class:"map-label","text-anchor":"middle",style:"font-size:8.5px;stroke-width:2.2px"},point.name);
  }
}
function updateMaps(self,others){
  const indoors=isInsideMuseum(self.x,self.y);
  attr($("my-avatar"),"transform","translate("+self.x+" "+self.y+")"+(indoors?" scale(.18)":""));
  const coat=hexCoat(self.coat??0xe5b672);
  $("my-avatar").querySelector("circle").style.fill=coat;
  attr($("mini-my"),"fill",coat);
  attr($("mini-my"),"transform","translate("+self.x+" "+self.y+") rotate("+self.heading+")"+(indoors?" scale(.47)":""));
  const targetLabel=indoors?"출구 ↗":"전시관 ↗";
  if($("museum-target").textContent!==targetLabel)$("museum-target").textContent=targetLabel;
  for(const id of ["entrance-target","palace-target"])if($(id).hidden!==indoors)$(id).hidden=indoors;
  for(const map of museumMaps)attr(map,"visibility",indoors?"visible":"hidden");
  $("world").classList.toggle("museum-map",indoors);
  $("mini-world").classList.toggle("museum-map",indoors);
  attr($("world"),"viewBox",indoors?museumViewBox:"58 28 520 397");
  attr($("mini-world"),"viewBox",indoors?museumViewBox:(self.x-42).toFixed(1)+" "+(self.y-35).toFixed(1)+" 84 70");
  for(const actor of others.values()){
    let mark=markers.get(actor.id);
    if(!mark){
      const fill=hexCoat(actor.coat);
      const big=svg($("map-people"),"circle",{r:8,fill,class:"room-dot"});
      const mini=svg($("mini-people"),"circle",{r:2.5,fill,class:"room-dot-mini"});
      svg(big,"title",{},actor.nickname);
      mark={big,mini};markers.set(actor.id,mark);
    }
    for(const node of [mark.big,mark.mini]){attr(node,"cx",actor.x);attr(node,"cy",actor.y);}
    attr(mark.big,"r",indoors?1.45:8);
    attr(mark.mini,"r",indoors?1.1:2.5);
    const visible=isInsideMuseum(actor.x,actor.y)===indoors?"visible":"hidden";
    attr(mark.big,"visibility",visible);attr(mark.mini,"visibility",visible);
  }
  for(const [id,mark] of markers)if(!others.has(id)){mark.big.remove();mark.mini.remove();markers.delete(id);}
}

const {minX:galleryLeft,maxX:galleryRight,minY:galleryTop,maxY:galleryBottom}=museumBounds;
const museumViewBox=[galleryLeft-4,galleryTop-4,galleryRight-galleryLeft+8,galleryBottom-galleryTop+8].join(" ");
for(const exhibit of Object.values(museumExhibits)){
  const item=document.createElement("li"),link=document.createElement("a");
  link.href=exhibit.source;link.target="_blank";link.rel="noopener";
  link.textContent=exhibit.title+" · "+exhibit.sourceLabel;
  item.append(link);$("exhibit-credits").append(item);
}
drawMap($("map-landscape"));drawMap($("mini-landscape"),true);applyNight(ownView);
lobby.showModal();
const savedCode=sessionStorage.getItem("jeongdong-room-code");
if(savedCode&&nickname.value&&(!suppliedCode||suppliedCode===savedCode))enterRoom("join",savedCode);
import("/world3d.js").then(({makeWorld})=>{
  world=makeWorld($("game"));drawDestinations(world);$("loading-game").hidden=true;
  if($("character-dialog").open)refreshCharacterPreview();
})
  .catch(()=>{worldFailed=true;$("loading-game").textContent="이 브라우저에서 3D 산책을 열 수 없어요.";});
requestAnimationFrame(frame);
