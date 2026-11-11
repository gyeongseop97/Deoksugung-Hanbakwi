import {
  route,palacePaths,palaceCourts,palaceGardens,palacePond,palaceWalls,fountain,ticket,ticketApproach,ticketGuide,gate,bridge,court,
  middle,hall,stoneHall,stoneFountain,city,pavilions,estateOutline,nearest,distance as near,walkable,clearSegment,planWalk
} from "./layout.js";
import {normalize,angleDelta,hexCoat,moving,receivePeople,smoothPeople,handPosition,handSide,pairFits} from "./people.js";
import {ITEMS,PET_MS,FEED_MS} from "./activities.js";
import {makeWishDrawing} from "./wish-drawing.js";
import {WISH_FLIGHT_MS} from "./wish-art.js";
import {isInsideMuseum,museumBounds,museumGalleries,museumGalleryAt,museumHall} from "./visit-layout.js";
import {museumExhibits} from "./museum-catalog.js";

const $=id=>document.getElementById(id);
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,"0")).join("");
const entranceHeading=285;
const initialView=()=>({pan:entranceHeading,tilt:0,zoom:0,night:localStorage.getItem("jeongdong-night")==="true"});
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
  return {x:ticketApproach.x+1,y:ticketApproach.y-2.4,heading:entranceHeading,vx:0,vy:0,wish:0,wishOrigin:null,wishHeading:0,wishArt:null,wave:0,emote:null,chat:null,
    seat:null,seatSide:null,item:null,blushUntil:0,blushLevel:0,pet:null,feed:null,running:false,blocked:false,character,look};
}
const me=initialAvatar(),people=new Map(),markers=new Map(),seenSignals=new Map(),lookPings=new Map(),formations=new Map();
let ownView=initialView(),trackedPersonId=null,world,worldLoading,worldFailed=false;
let firstPerson=localStorage.getItem("jeongdong-first-person")==="true";
let session=null,active=true,joining=false,lastPost=0,lastWishSynced=0,dirty=true;
let syncTimer,syncDue=Infinity,syncInFlight=null,syncStarted=-Infinity,syncFailures=0;
let links=[],queuedSignal=null,queuedHand=null,queuedFeed=null,queuedChat=null,toastTimer;
let lastChatAt=0;
let course=[],pendingSeat=null,seatClaim=null,thumb=[0,0],thumbId,orbit=null;
let clockOffset=null,roundTrip=65;
let runToggled=false,shiftHeld=false;
const keys=new Set();
const vectors={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
const fragments=new URLSearchParams(location.hash.slice(1));
const suppliedCode=(fragments.get("code")||"").toUpperCase();
const entryFlow=$("entry-flow"),profileStep=$("profile-step"),serverStep=$("server-step"),gameShell=$("game-shell");
const nickname=$("nickname"),joinCode=$("join-code");
const chatInput=$("chat-input"),chatSend=$("chat-send");
const profileChoices=[...document.querySelectorAll("[name='entry-character']")];
const serverButtons=["open-server","create-room","join-room","server-back","invite-toggle"].map($);
nickname.value=localStorage.getItem("jeongdong-nickname")||"";
joinCode.value=suppliedCode;
profileChoices.find(option=>option.value===me.character).checked=true;

let catTipTimer;
let catTipDismissed=localStorage.getItem("jeongdong-cat-run-tip-hidden")==="true";
function hideCatRunTip(){
  clearTimeout(catTipTimer);
  $("cat-run-tip").hidden=true;
}
function onCatFlee(runnerId){
  if(!session||runnerId!==session.id||catTipDismissed||!$("cat-run-tip").hidden)return;
  $("cat-run-tip").hidden=false;
  catTipTimer=setTimeout(hideCatRunTip,6200);
}
$("cat-run-tip-dismiss").addEventListener("click",()=>{
  catTipDismissed=true;
  localStorage.setItem("jeongdong-cat-run-tip-hidden","true");
  hideCatRunTip();focusGame();
});

const mobileHeader=matchMedia("(max-width:810px), (orientation:landscape) and (max-height:560px)");
function placeViewControls(){
  $(mobileHeader.matches?"mobile-view-controls":"desktop-view-controls").append($("view-controls"));
}
mobileHeader.addEventListener("change",placeViewControls);
placeViewControls();

let composingChat=false;
function chatText(){return chatInput.value.normalize("NFC").replace(/\s+/gu," ").replace(/[\p{Cc}\p{Bidi_Control}]/gu,"").trim();}
function updateChatSend(){
  const text=chatText();
  chatInput.setCustomValidity([...text].length>80?"채팅은 80자까지 입력할 수 있어요.":"");
  chatSend.disabled=!session||!text||Boolean(queuedChat);
  chatSend.textContent=queuedChat?"전송 중":"전송";
}
chatInput.addEventListener("focus",resetInput);
chatInput.addEventListener("input",updateChatSend);
chatInput.addEventListener("compositionstart",()=>{composingChat=true;});
chatInput.addEventListener("compositionend",()=>{composingChat=false;updateChatSend();});
chatInput.addEventListener("keydown",event=>{
  if(event.key==="Enter"&&(event.isComposing||event.keyCode===229||composingChat))event.preventDefault();
});
$("chat-form").addEventListener("submit",event=>{
  event.preventDefault();
  const text=chatText();
  if(!session||!text||[...text].length>80||composingChat||queuedChat)return;
  lastChatAt=Math.max(gameTime(),lastChatAt+1);
  me.chat=queuedChat={id:token(),text,at:lastChatAt};
  dirty=true;wakeSync();
  chatInput.value="";updateChatSend();focusGame();
});

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
  for(const id of ["presence","game-presence"])attr($(id),"aria-label",text+" · 접속자 목록 열기");
}
function applyNight(view){
  $("night").setAttribute("aria-pressed",String(Boolean(view.night)));
  $("night").textContent=view.night?"☀ 낮":"☾ 밤";
}
function myLink(){return session&&links.find(link=>link.leader===session.id||link.follower===session.id);}
function amFollowingHands(){const link=myLink();return Boolean(link?.active&&link.follower===session.id);}
$("perspective").setAttribute("aria-pressed",String(firstPerson));
$("perspective").addEventListener("click",()=>{
  firstPerson=!firstPerson;
  $("perspective").setAttribute("aria-pressed",String(firstPerson));
  localStorage.setItem("jeongdong-first-person",String(firstPerson));
  focusGame();
});
$("night").addEventListener("click",()=>{
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
function chooseCharacter(character){
  if(me.look.hair===defaultHair(me.character))me.look={...me.look,hair:defaultHair(character)};
  me.character=character;saveAppearance();
}
characterOptions.forEach(option=>option.addEventListener("click",()=>chooseCharacter(option.dataset.character)));
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
  wakeSync();
  setEmotes(false);$("game").focus({preventScroll:true});
}));

const directions=["앞","오른쪽 앞","오른쪽","오른쪽 뒤","뒤","왼쪽 뒤","왼쪽","왼쪽 앞"];
const rosterDialog=$("roster-dialog"),targetDialog=$("look-target-dialog");
const trackPins=[$("track-pin"),$("mini-track-pin")];
function setText(node,value){if(node.textContent!==value)node.textContent=value;}
function shownPlace(point){
  const place=placeName(point);
  return isInsideMuseum(point.x,point.y)&&place!=="덕수궁 전시관"?"미술관 · "+place:place;
}
function updatePeopleList(list,includeSelf){
  const entries=[...people.values()].sort((a,b)=>a.nickname.localeCompare(b.nickname,"ko")||a.id.localeCompare(b.id));
  if(includeSelf)entries.unshift({id:session.id,nickname:session.nickname,coat:session.coat,position:me});
  const previous=new Map(Array.from(list.children,item=>[item.dataset.personId,item]));
  for(const [index,person] of entries.entries()){
    const self=person.id===session.id;
    let item=previous.get(person.id);
    previous.delete(person.id);
    if(!item){
      item=document.createElement("li");item.dataset.personId=person.id;
      const row=document.createElement(self?"div":"button");
      row.className=self?"roster-row roster-self":"roster-row";
      if(!self){row.type="button";row.dataset.personId=person.id;}
      const coat=document.createElement("i"),copy=document.createElement("span"),indicator=document.createElement("span");
      coat.className="roster-coat";coat.setAttribute("aria-hidden","true");
      coat.style.setProperty("--player-color",hexCoat(person.coat??0x397e70));
      copy.className="roster-person";copy.append(document.createElement("strong"),document.createElement("small"));
      indicator.className="roster-indicator";indicator.textContent=self?"나":includeSelf?"위치 보기":"보내기";
      row.append(coat,copy,indicator);item.append(row);
    }
    setText(item.querySelector("strong"),person.nickname);
    setText(item.querySelector("small"),shownPlace(person.position));
    if(list.children[index]!==item)list.insertBefore(item,list.children[index]??null);
  }
  for(const item of previous.values())item.remove();
}
function refreshPeopleDialogs(){
  if(rosterDialog.open){
    setText($("roster-count"),syncFailures?"다시 연결 중 · 마지막으로 확인한 위치":(people.size+1)+"명 접속 중");
    updatePeopleList($("roster-list"),true);
  }
  if(targetDialog.open)updatePeopleList($("look-target-people"),false);
}
for(const id of ["presence","game-presence"]){
  $(id).addEventListener("click",()=>{
    if(!session||rosterDialog.open)return;
    resetInput();rosterDialog.showModal();refreshPeopleDialogs();
  });
}
$("roster-list").addEventListener("click",event=>{
  const id=event.target.closest("button[data-person-id]")?.dataset.personId;
  if(!people.has(id))return;
  trackedPersonId=id;rosterDialog.close();focusGame();
  updateLocationGuides(gameTime());
});
$("clear-tracking").addEventListener("click",()=>{
  trackedPersonId=null;updateLocationGuides(gameTime());focusGame();
});
function sendLook(audience,target){
  if(!session||!people.size||(audience==="person"&&!people.has(target)))return;
  queuedSignal={id:token(),point:{x:me.x,y:me.y},audience,...(target?{target}:{})};
  wakeSync();
  if(targetDialog.open)targetDialog.close();
  toast(audience==="nearby"?"근처 동행에게 내 위치를 보냈어요.":
    audience==="room"?"방 전체에 내 위치를 보냈어요.":people.get(target).nickname+" 님에게 내 위치를 보냈어요.");
}
$("look").addEventListener("click",()=>sendLook(session?.mode==="open"?"nearby":"room"));
$("look-target").addEventListener("click",()=>{
  if(!people.size||targetDialog.open)return;
  resetInput();targetDialog.showModal();refreshPeopleDialogs();
});
targetDialog.addEventListener("click",event=>{
  const audience=event.target.closest("[data-look-audience]")?.dataset.lookAudience;
  const target=event.target.closest("button[data-person-id]")?.dataset.personId;
  if(audience)sendLook(audience);
  else if(target)sendLook("person",target);
});
function readLookSignals(serverTime){
  for(const id of seenSignals.keys())if(!people.has(id))seenSignals.delete(id);
  for(const person of people.values()){
    const signal=person.signal;
    if(!signal||seenSignals.get(person.id)===signal.id)continue;
    seenSignals.set(person.id,signal.id);
    const expires=(signal.receivedAt??serverTime)+5000;
    if(expires<=serverTime)continue;
    let pins=lookPings.get(person.id)?.pins;
    if(!pins)pins=["look-pins","mini-look-pins"].map(layer=>{
      const pin=svg($(layer),"g",{class:"look-map-pin"});
      svg(pin,"circle",{});svg(pin,"circle",{});return pin;
    });
    lookPings.set(person.id,{point:signal.point??person.avatar,expires,nickname:person.nickname,pins});
  }
}
function guideLocation(point,indoors){
  if(isInsideMuseum(point.x,point.y)===indoors)return {point,prefix:""};
  return indoors?{point:world?.museum.insideDoor,prefix:"전시관 출구까지"}:
    {point:world?.museum.outsideDoor,prefix:"전시관 입구까지"};
}
function positionGuidePins(pins,point,indoors){
  for(const [index,pin] of pins.entries()){
    attr(pin,"visibility",point?"visible":"hidden");
    if(!point)continue;
    const radius=indoors?(index?2.25:2.6):(index?4.8:11);
    attr(pin,"transform",`translate(${point.x} ${point.y})`);
    attr(pin.firstElementChild,"r",radius);attr(pin.lastElementChild,"r",radius*.32);
  }
}
function showGuide(kind,title,location){
  const {point,prefix}=location,arrow=$(kind+"-arrow");
  setText($(kind+"-title"),title);
  let label=prefix;
  if(point){
    const dx=point.x-me.x,dy=point.y-me.y,metres=Math.hypot(dx,dy);
    const angle=normalize(Math.atan2(dx,-dy)*180/Math.PI-ownView.pan);
    label=[prefix,metres<1.5?"바로 옆":directions[Math.round(angle/45)%8]+" · "+Math.round(metres)+"m"].filter(Boolean).join(" · ");
    setText(arrow,metres<1.5?"•":"↑");
    arrow.style.transform=metres<1.5?"none":`rotate(${angle}deg)`;
  }
  arrow.hidden=!point;setText($(kind+"-distance"),label);
}
function updateLocationGuides(time){
  const indoors=isInsideMuseum(me.x,me.y);
  let newest;
  for(const [id,ping] of lookPings){
    if(time>=ping.expires){ping.pins.forEach(pin=>pin.remove());lookPings.delete(id);continue;}
    positionGuidePins(ping.pins,guideLocation(ping.point,indoors).point,indoors);
    if(!newest||ping.expires>newest.expires)newest=ping;
  }
  $("look-direction").hidden=!newest;
  if(newest)showGuide("look",newest.nickname+" · "+shownPlace(newest.point),guideLocation(newest.point,indoors));
  const tracked=people.get(trackedPersonId);
  if(!tracked)trackedPersonId=null;
  $("tracked-direction").hidden=!tracked;
  const target=tracked&&guideLocation(tracked.position,indoors);
  positionGuidePins(trackPins,target?.point,indoors);
  if(tracked)showGuide("track",tracked.nickname+" · "+shownPlace(tracked.position),target);
}
function resetLocationGuides(){
  for(const ping of lookPings.values())ping.pins.forEach(pin=>pin.remove());
  lookPings.clear();seenSignals.clear();trackedPersonId=null;
  updateLocationGuides(gameTime());
}

function handCandidates(){
  if(!world||!session||me.seat!=null||myLink()||feedingLocked(gameTime()))return [];
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
  if(link){queuedHand={action:"release",id:link.id};wakeSync();return;}
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
  wakeSync();
}
$("hand-decline").addEventListener("click",()=>{
  const link=myLink();if(link){queuedHand={action:"release",id:link.id};wakeSync();}
});
$("hand-accept").addEventListener("click",()=>{
  const link=myLink(),leader=link&&people.get(link.leader);
  if(!leader||link.active||link.follower!==session.id||feedingLocked(gameTime()))return;
  const side=handSide(leader.avatar,me);
  if(!side){toast("서로 가까운, 걸을 수 있는 곳에서 손을 잡아 주세요.");return;}
  queuedHand={action:"accept",id:link.id,side};
  wakeSync();
});

function changeLinks(next){
  const before=myLink(),priorIds=new Set(links.filter(link=>link.active).map(link=>link.id));
  links=queuedHand?.action==="release"?next.filter(link=>link.id!==queuedHand.id):next;
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
function clearSyncTimer(){
  clearTimeout(syncTimer);syncTimer=undefined;syncDue=Infinity;
}
function scheduleSync(delay){
  if(!active||!session||syncInFlight===session)return;
  const due=performance.now()+delay;
  if(syncDue<=due)return;
  clearSyncTimer();syncDue=due;
  syncTimer=setTimeout(()=>{clearSyncTimer();sync();},delay);
}
function movingCadence(){
  // Keep busy public rooms from multiplying database traffic as people join.
  return session.mode==="open"?96+Math.min(44,Math.max(0,people.size-5)*5):
    68+Math.min(22,Math.max(0,people.size-8)*2);
}
function wakeSync(){
  if(!session||document.hidden||syncFailures)return;
  scheduleSync(Math.max(0,syncStarted+movingCadence()-performance.now()));
}
function syncCadence(){
  const fast=dirty||myLink()||queuedHand||queuedSignal||queuedFeed||queuedChat||seatClaim||moving(me)||me.blocked||
    [...people.values()].some(person=>moving(person.avatar)||person.avatar.blocked);
  if(fast)return movingCadence();
  return session.mode==="open"?(people.size?195+Math.min(55,Math.max(0,people.size-5)*5):330):
    (people.size?120:250);
}
async function sync(){
  const visit=session;
  if(!active||!visit||syncInFlight===visit)return;
  syncInFlight=visit;
  const sent=performance.now(),signal=queuedSignal,hand=queuedHand,claim=seatClaim,feed=queuedFeed,chat=queuedChat;
  syncStarted=sent;
  const post=dirty||signal||hand||claim||feed||chat||Date.now()-lastPost>=3800;
  const base={room:visit.room,id:visit.id,key:visit.key,lookPings:true};
  const avatar=post?{...me}:null;
  if(avatar&&claim)Object.assign(avatar,{seat:claim.bench,seatSide:claim.side});
  if(avatar){if(chat)avatar.chat=chat;else delete avatar.chat;}
  if(avatar&&(avatar.wish===lastWishSynced||gameTime(sent)-avatar.wish>=WISH_FLIGHT_MS))delete avatar.wishArt;
  const body=post?{...base,avatar,view:{...ownView},signal,hand,feed}:base;
  if(post)dirty=false;
  try{
    const response=await request("/api/room",body),data=await response.json();
    if(!active||session!==visit)return;
    if(response.status===409){returnToLobby(data.error);return;}
    if(!response.ok)throw Error(data.error);
    const received=performance.now();
    updateClock(data.serverTime,sent,received);
    syncFailures=0;
    if(post){lastPost=Date.now();lastWishSynced=avatar.wish;}
    if(queuedSignal===signal)queuedSignal=null;
    if(queuedHand===hand)queuedHand=null;
    const confirmed=data.walkers.find(row=>row.id===visit.id)?.avatar;
    if(chat&&queuedChat===chat){
      queuedChat=null;
      if(confirmed?.chat?.id===chat.id)me.chat=confirmed.chat;
      else{me.chat=null;toast("채팅을 보내지 못했어요. 다시 시도해 주세요.");}
      updateChatSend();
    }
    if(confirmed?.feed&&confirmed.feed.claim!==me.feed?.claim){
      me.feed=confirmed.feed;me.item=confirmed.item??null;
    }
    if(feed&&queuedFeed===feed){
      queuedFeed=null;
      if(confirmed?.feed?.claim!==feed.claim)toast("고양이에게 가까이 다가가 다시 간식을 주세요.");
    }
    receivePeople(people,data.walkers,visit.id,data.serverTime);
    if(claim)confirmSeat(claim,confirmed);
    changeLinks(data.handholds||[]);
    const link=myLink();
    if(hand?.action==="offer"&&!link)toast("가까이 있는 친구에게 다시 손을 내밀어 주세요.");
    if(hand?.action==="accept"&&!link?.active)toast("손잡기 요청이 끝났어요. 가까이에서 다시 요청해 주세요.");
    readLookSignals(data.serverTime);
    refreshPeopleDialogs();
    setPresence(data.walkers.length+"명 접속 중",data.walkers.length);
    $("look-target").disabled=$("look").disabled=!people.size;
  }catch{
    if(!active||session!==visit)return;
    dirty=true;syncFailures++;
    setPresence("다시 연결 중");
    refreshPeopleDialogs();
  }finally{
    if(syncInFlight===visit)syncInFlight=null;
    if(active&&session===visit){
      const delay=document.hidden?1150:syncFailures?Math.min(1500,200*2**Math.min(3,syncFailures-1)):
        Math.max(5,syncCadence()-(performance.now()-sent));
      scheduleSync(delay);
    }
  }
}

function leaveBeacon(){
  if(session)navigator.sendBeacon("/api/room",JSON.stringify({room:session.room,id:session.id,key:session.key,leave:true}));
}
function toggleInviteForm(open){
  $("invite-form").hidden=!open;
  attr($("invite-toggle"),"aria-expanded",open);
  if(open)joinCode.focus();
}
function showServers(showCode=false){
  entryFlow.hidden=false;gameShell.hidden=true;
  profileStep.hidden=true;serverStep.hidden=false;
  const summary=$("server-profile");
  summary.textContent=nickname.value.trim()+" · "+(me.character==="woman"?"여자":"남자");
  summary.hidden=false;
  $("server-title").focus({preventScroll:true});
  toggleInviteForm(showCode);
}
function showProfile(){
  serverStep.hidden=true;profileStep.hidden=false;
  profileChoices.find(option=>option.value===me.character).checked=true;
  nickname.focus({preventScroll:true});
}
function returnToLobby(message=""){
  const old=session;
  leaveBeacon();session=null;clearSyncTimer();resetInput();
  queuedSignal=queuedHand=queuedFeed=queuedChat=null;people.clear();changeLinks([]);resetLocationGuides();
  chatInput.value="";composingChat=false;lastChatAt=0;updateChatSend();
  $("invite").disabled=$("look").disabled=$("look-target").disabled=true;
  world?.clearChat();
  $("lobby-status").textContent=message;
  sessionStorage.removeItem("jeongdong-room-mode");
  sessionStorage.removeItem("jeongdong-room-code");
  if(old)joinCode.value=old.code??"";
  history.replaceState(null,"",location.pathname+location.search);
  document.querySelectorAll("dialog[open]").forEach(dialog=>dialog.close());
  hideCatRunTip();showServers();
  setPresence("방을 선택해 주세요");
}
async function enterRoom(action,code){
  if(joining)return;
  const name=nickname.value.trim();
  if(!name||[...name].length>16){
    showProfile();$("profile-status").textContent="닉네임은 1~16자로 입력해 주세요.";return;
  }
  joining=true;serverButtons.forEach(button=>{button.disabled=true;});
  $("lobby-status").textContent="산책방에 들어가는 중이에요.";
  const id=token(),key=token(),avatar=initialAvatar(),view=initialView();
  const angle=parseInt(id.slice(0,8),16)/0x100000000*Math.PI*2;
  const offset=.38+parseInt(id.slice(8,12),16)/0x10000*.67;
  avatar.x+=Math.cos(angle)*offset;avatar.y+=Math.sin(angle)*offset;
  try{
    const sent=performance.now();
    const response=await request("/api/rooms",{action,code,nickname:name,id,key,avatar,view}),data=await response.json();
    if(!response.ok)throw Error(data.error);
    clockOffset=null;roundTrip=65;
    updateClock(data.serverTime,sent,performance.now());
    session={room:data.room,code:data.code,mode:data.mode??"private",id,key,...data.profile};
    Object.assign(me,avatar,{nickname:session.nickname,coat:session.coat});
    ownView=view;applyNight(view);dirty=true;lastWishSynced=0;lastPost=Date.now();
    updateChatSend();
    syncStarted=-Infinity;syncFailures=0;
    people.clear();links=[];formations.clear();resetLocationGuides();resetInput();
    $("location").textContent=ticketApproach.name;
    localStorage.setItem("jeongdong-nickname",session.nickname);
    sessionStorage.setItem("jeongdong-room-mode",session.mode);
    if(session.code)sessionStorage.setItem("jeongdong-room-code",session.code);
    else sessionStorage.removeItem("jeongdong-room-code");
    history.replaceState(null,"",location.pathname+location.search+(session.code?"#code="+session.code:""));
    $("invite").disabled=false;
    $("invite").textContent=session.mode==="open"?"오픈서버":"↗ 초대코드";
    $("look-hint").textContent=(session.mode==="open"?"근처 동행에게":"방 전체에")+" 내 위치를 5초 동안 표시해요.";
    $("lobby-status").textContent="";entryFlow.hidden=true;gameShell.hidden=false;
    world?.parkLife.setSeed(session.room);
    world?.parkLife.resetInteractions();
    loadWorld();focusGame();
    if(action==="create")openInvite();
    scheduleSync(0);
  }catch(error){
    $("lobby-status").textContent=error.message==="Failed to fetch"?"연결을 확인한 뒤 다시 시도해 주세요.":error.message;
  }finally{
    joining=false;serverButtons.forEach(button=>{button.disabled=false;});
  }
}
$("profile-form").addEventListener("submit",event=>{
  event.preventDefault();
  const name=nickname.value.trim();
  if(!name||[...name].length>16){
    $("profile-status").textContent="닉네임은 1~16자로 입력해 주세요.";nickname.focus();return;
  }
  const character=profileChoices.find(option=>option.checked)?.value;
  if(!character){$("profile-status").textContent="캐릭터를 골라 주세요.";return;}
  $("profile-status").textContent="";localStorage.setItem("jeongdong-nickname",name);
  chooseCharacter(character);
  showServers(Boolean(joinCode.value));
});
$("open-server").addEventListener("click",()=>enterRoom("open"));
$("create-room").addEventListener("click",()=>enterRoom("create"));
$("server-back").addEventListener("click",showProfile);
$("invite-toggle").addEventListener("click",()=>toggleInviteForm($("invite-form").hidden));
$("invite-form").addEventListener("submit",event=>{
  event.preventDefault();enterRoom("join",joinCode.value.trim().toUpperCase());
});
joinCode.addEventListener("input",()=>{joinCode.value=joinCode.value.toUpperCase();});
function openInvite(){
  if(!session)return;
  if(session.mode==="open"){$("open-room-dialog").showModal();return;}
  $("invite-code").value=session.code;$("invite-dialog").showModal();
}
$("invite").addEventListener("click",openInvite);
$("leave-room").addEventListener("click",()=>returnToLobby());
$("leave-open-room").addEventListener("click",()=>returnToLobby());
async function copyInvite(link){
  if(!session?.code)return;
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
window.addEventListener("pagehide",()=>{active=false;clearSyncTimer();leaveBeacon();});
document.addEventListener("visibilitychange",()=>{
  clearSyncTimer();scheduleSync(document.hidden?1150:0);
});
window.addEventListener("online",()=>{if(!document.hidden)scheduleSync(0);});
window.addEventListener("pageshow",event=>{
  if(!event.persisted)return;
  active=true;
  if(session){const {code,mode}=session;returnToLobby();enterRoom(mode==="open"?"open":"join",code);}
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
function walkTo(target,seat=null){
  if(!target||!session||amFollowingHands()||!world&&!worldFailed)return;
  stand();
  const steps=planWalk(me,target);
  if(!steps.length){toast("걸을 수 있는 길을 터치해 주세요.");return;}
  course=steps;seatClaim=null;pendingSeat=seat;
}
const mapDestinations={
  "entrance-target":{...ticketApproach,x:ticketApproach.x+1,y:ticketApproach.y-2.4,heading:entranceHeading},
  "fountain-target":{name:"정동 분수대",x:fountain.x+4.8,y:fountain.y+5.3,heading:318},
  "palace-target":{...court,heading:normalize(Math.atan2(hall.x-court.x,court.y-hall.y)*180/Math.PI)}
};
for(const [id,destination] of Object.entries(mapDestinations))$(id).addEventListener("click",()=>{
  if(!session||!walkable(destination.x,destination.y))return;
  const linkId=myLink()?.id??(queuedHand?.action==="offer"?queuedHand.id:null);
  if(linkId){queuedHand={action:"release",id:linkId};changeLinks(links);}
  movePlayerTo(destination,destination.name);
  setMap(false);focusGame();
});

const joystick=$("joystick");
function beginManualMove(){
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
  if(event.target.closest("dialog"))return;
  if(event.key==="Escape"){setMap(false);setEmotes(false);}
  if(!session||event.target.closest("input"))return;
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
  if(orbit.tap&&!orbit.dragged&&!keys.size&&thumbId===undefined){
    const target=world?.pick(event.clientX,event.clientY);
    if(target?.guide&&nearVisitorGuide())openVisitorGuide();
    else walkTo(target);
  }
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
  dirty=true;return true;
}
function nearWishFountain(){
  return Boolean(world&&session&&me.seat==null&&near(fountain,me.x,me.y)<13);
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
function feedingLocked(time){
  return Boolean(queuedFeed&&time-queuedFeed.at<FEED_MS||me.feed&&time-me.feed.at<FEED_MS);
}
function feedCatNearby(){
  if(!session||me.seat!=null||myLink()?.active||me.running||me.item?.kind!=="churu")return null;
  return world?.parkLife.nearestFeedCat(me.x,me.y,session.id);
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
function nearVisitorGuide(){
  const point=ticketGuide.approach;
  return Boolean(world&&session&&near(point,me.x,me.y)<3&&clearSegment(me,point));
}
function openVisitorGuide(){
  if(!nearVisitorGuide())return;
  resetInput();
  $("visitor-guide-dialog").showModal();
}
$("visitor-guide").addEventListener("click",openVisitorGuide);
$("pet-cat").addEventListener("click",()=>{
  if(!session||myLink()?.active||me.seat!=null)return;
  const time=gameTime(),cat=world?.parkLife.nearestCat(me.x,me.y);
  if(!cat||time-(me.pet?.at??0)<PET_MS||feedingLocked(time))return;
  resetInput();
  me.heading=normalize(Math.atan2(cat.x-me.x,me.y-cat.y)*180/Math.PI);
  me.pet={id:cat.id,at:time};dirty=true;focusGame();
});
$("take-item").addEventListener("click",()=>{
  if(!session||me.seat!=null)return;
  const station=nearbyStation(),time=gameTime();
  if(!station||station.kind===me.item?.kind||queuedFeed||me.item&&time-me.item.started<ITEMS[me.item.kind].duration)return;
  const spec=ITEMS[station.kind];
  me.item={kind:station.kind,remaining:spec.uses,started:0};dirty=true;
  toast(station.kind==="churu"?"츄르를 샀어요. 고양이 가까이에서 잠시 기다려 보세요.":spec.name+" 받았어요.");
  focusGame();
});
$("use-item").addEventListener("click",()=>{
  if(!session)return;
  const time=gameTime();
  if(!canUseItem(time))return;
  if(me.item.kind==="churu"){
    const cat=feedCatNearby();
    if(!cat||queuedFeed||feedingLocked(time)||time-(me.pet?.at??0)<PET_MS)return;
    resetInput();
    me.heading=normalize(Math.atan2(cat.x-me.x,me.y-cat.y)*180/Math.PI);
    queuedFeed={id:cat.id,claim:token(),at:time};
    Object.assign(me,{vx:0,vy:0,running:false,blocked:false});dirty=true;wakeSync();focusGame();
    return;
  }
  me.item={...me.item,remaining:me.item.remaining-1,started:time};
  if(me.item.kind==="beer"){
    const previous=time<me.blushUntil?me.blushLevel||1:0;
    me.blushLevel=Math.min(3,previous+1);
    me.blushUntil=time+120000;
  }
  dirty=true;focusGame();
});
function movePlayerTo(destination,place){
  resetInput();stand();
  Object.assign(me,{x:destination.x,y:destination.y,heading:destination.heading,vx:0,vy:0,blocked:false,running:false});
  ownView={...ownView,pan:destination.heading,tilt:0};
  $("location").textContent=place;dirty=true;wakeSync();
}
$("museum-door").addEventListener("click",()=>{
  const portal=portalNearby();
  if(!session||myLink()?.active||feedingLocked(gameTime())||!portal)return;
  const {inside,museum}=portal,destination=inside?museum.outsideDoor:museum.insideSpawn;
  movePlayerTo(destination,inside?"석조전 서관":"덕수궁 전시관");focusGame();
});
$("museum-exhibit").addEventListener("click",()=>{
  const exhibit=session&&nearbyExhibit();
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
function updateActivities(time,guideNearby){
  if(me.item&&me.item.remaining===0&&time-me.item.started>=ITEMS[me.item.kind].duration){
    me.item=null;dirty=true;
  }
  const eligible=world&&session;
  const feeding=feedingLocked(time);
  setActivity("visitor-guide",guideNearby?"관람 안내 읽기":null);
  const atFountain=nearWishFountain();
  if($("wish").hidden===Boolean(atFountain))$("wish").hidden=$("wish").disabled=!atFountain;
  const cat=eligible&&me.seat==null&&!myLink()?.active&&world.parkLife.nearestCat(me.x,me.y);
  setActivity("pet-cat",cat?"쓰다듬기":null,feeding||time-(me.pet?.at??0)<PET_MS);
  if(cat)attr($("pet-cat"),"title",cat.name+" 쓰다듬기");
  const station=eligible&&me.seat==null&&nearbyStation();
  const busy=Boolean(queuedFeed||me.item&&time-me.item.started<ITEMS[me.item.kind].duration);
  const pickup=station&&station.kind!==me.item?.kind?(station.kind==="churu"?"츄르 사기":ITEMS[station.kind].name+" 받기"):null;
  setActivity("take-item",pickup,busy);
  const spec=eligible&&me.item&&ITEMS[me.item.kind];
  if(spec&&me.item.kind==="churu"){
    const cat=feedCatNearby();
    const label=feeding?(queuedFeed?"간식 주는 중":"간식 먹는 중"):cat?spec.verb+" · "+me.item.remaining+"회":null;
    setActivity("use-item",label,feeding||Boolean(queuedFeed)||!canUseItem(time)||time-(me.pet?.at??0)<PET_MS);
  }else{
    setActivity("use-item",spec?(me.item.kind==="sparkler"?spec.verb:spec.verb+" · "+me.item.remaining+"회"):null,!canUseItem(time));
  }
  const portal=eligible&&portalNearby();
  setActivity("museum-door",portal?(portal.inside?"나가기":"입장하기"):null,feeding||Boolean(myLink()?.active));
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
    if(near(pendingSeat.approach,me.x,me.y)<.4){seatClaim=pendingSeat;dirty=true;wakeSync();}
    pendingSeat=null;
  }
}
function motion(now,elapsed){
  const oldX=me.x,oldY=me.y,link=myLink(),follower=amFollowingHands();
  const wasMoving=moving(me)||me.blocked,wasBlocked=me.blocked,wasRunning=me.running;
  const leader=follower&&people.get(link.leader);
  const pace=runToggled||shiftHeld;
  const speed=elapsed*(pace?6.675:2.58);
  let blocked=false;
  if(leader){
    const next=pairedPose(link,leader.position,me,now);
    if(me.heading!==next.heading){me.heading=next.heading;dirty=true;}
    if(next.x!==me.x||next.y!==me.y){me.x=next.x;me.y=next.y;dirty=true;}
    blocked=Boolean(leader.avatar.blocked);
  }else if(session&&elapsed>0&&!feedingLocked(gameTime(now))){
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
  if(wasMoving!==(moving(me)||blocked)||wasBlocked!==blocked||wasRunning!==running)wakeSync();
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
  requestAnimationFrame(frame);
  if(!session)return;
  const time=gameTime(now);
  smoothPeople(people,elapsed,time,roundTrip);
  const stepping=motion(now,elapsed);
  const {self,others}=actors(now,stepping);
  const guideNearby=nearVisitorGuide();
  updateActivities(time,guideNearby);
  const seatEnabled=world&&session&&!myLink()?.active&&!feedingLocked(time);
  const bench=seatEnabled&&me.seat==null&&!pendingSeat&&!seatClaim?benchNearby():null;
  const seatLabel=me.seat!=null?"일어나기":seatClaim?"자리 확인 중":pendingSeat?"벤치로 이동 중":
    bench?.choice?"앉기":bench?.nearby?"빈자리 없음":null;
  setActivity("sit",seatEnabled?seatLabel:null,me.seat==null&&!bench?.choice);
  attr($("sit"),"aria-pressed",me.seat!=null);
  setText($("game-place"),$("location").textContent);
  updateHandControls();updateLocationGuides(time);updateMaps(self,others);
  world?.render({me:self,peers:[...others.values()],view:ownView,firstPerson,guideNearby,destination:course.at(-1),clock:time},now);
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
const savedCode=sessionStorage.getItem("jeongdong-room-code");
const savedOpen=sessionStorage.getItem("jeongdong-room-mode")==="open";
if(nickname.value&&(savedCode&&(!suppliedCode||suppliedCode===savedCode)||savedOpen&&!suppliedCode)){
  showServers();enterRoom(savedOpen&&!suppliedCode?"open":"join",savedCode);
}
function loadWorld(){
  if(world||worldLoading)return;
  worldLoading=import("/world3d.js").then(({makeWorld})=>{
    world=makeWorld($("game"),{onCatFlee,catSeed:session?.room});worldFailed=false;
    drawDestinations(world);$("loading-game").hidden=true;
    if($("character-dialog").open)refreshCharacterPreview();
  }).catch(()=>{
    worldFailed=true;$("loading-game").textContent="이 브라우저에서 3D 산책을 열 수 없어요.";
  }).finally(()=>{worldLoading=null;});
}
requestAnimationFrame(frame);
