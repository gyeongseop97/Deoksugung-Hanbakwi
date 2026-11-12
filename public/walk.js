import {
  route,palacePaths,palaceCourts,palaceGardens,palacePond,palaceWalls,fountain,ticket,ticketApproach,ticketGuide,gate,bridge,court,spawn,
  middle,hall,stoneHall,stoneFountain,city,pavilions,estateOutline,nearest,distance as near,walkable,clearSegment,wadeSegment,waterDepth,loftStep,loftHeight,loftStair,planWalk,platformAt
} from "./layout.js";
import {normalize,angleDelta,hexCoat,moving,receivePeople,smoothPeople,handPosition,handSide,pairFits} from "./people.js";
import {ITEMS,PET_MS,FEED_MS,JUMP_MS,jumpLift} from "./activities.js";
import {makeWishDrawing} from "./wish-drawing.js";
import {WISH_FLIGHT_MS} from "./wish-art.js";
import {isInsideMuseum,museumBounds,museumGalleries,museumGalleryAt,museumHall} from "./visit-layout.js";
import {museumExhibits} from "./museum-catalog.js";
import {nearbyPalaceGuide} from "./palace-guide.js";
import {bindSceneTouch} from "./scene-touch.js";
import {bindMapGestures} from "./map-gestures.js";
import {makeSound} from "./sound.js";
import {ceremonyAt} from "./palace-people.js";
import {cityHallStation,gbSites,gbBounds,gbLake,gbPond,gbPaths,gbCourts,gbLawns,gbShortcuts,wishPond,gbPhotoZone,gbUijeongbu,gbCrossings,gbBusIsland,inGyeongbok,wallHalf,wallNorth,at as palaceAt} from "./gyeongbok-layout.js";
import {inGwanghwamunPlaza,plazaAt,plazaBounds,plazaSites,plazaOutline,plazaPaths,plazaShortcuts,plazaBeds,plazaRoadProfile,eastRoadWidth,sajikRoad} from "./plaza-layout.js";
import {corridorBounds,corridorLandmarks,corridorSidewalks,corridorCrossings,corridorWalkSpine,corridorMainRoad,inSejongCorridor} from "./sejong-corridor-layout.js";
import {transitRoutes,transitStops} from "./transit-routes.js";
import {BUS_SEATS,busAt,busSeatPose,busStopById,busStops,busStopTimes,nearBus} from "./sejong-bus.js";
import {bikeDocks,bikeMountReach,bikeParkDuration,isCycling,nearBikeDock} from "./sejong-bike.js";

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
  return {x:ticketApproach.x+1,y:ticketApproach.y-2.4,heading:entranceHeading,vx:0,vy:0,wish:0,wishOrigin:null,wishHeading:0,wishArt:null,wave:0,jump:0,emote:null,chat:null,
    seat:null,seatSide:null,bus:null,bike:null,item:null,blushUntil:0,blushLevel:0,pet:null,feed:null,running:false,blocked:false,character,look};
}
const me=initialAvatar(),people=new Map(),markers=new Map(),seenSignals=new Map(),lookPings=new Map(),formations=new Map();
let ownView=initialView(),trackedPersonId=null,world,worldLoading,worldFailed=false;
let firstPerson=localStorage.getItem("jeongdong-first-person")==="true";
let session=null,active=true,joining=false,lastPost=0,lastWishSynced=0,dirty=true;
let syncTimer,syncDue=Infinity,syncInFlight=null,syncStarted=-Infinity,syncFailures=0;
let links=[],queuedSignal=null,queuedHand=null,queuedFeed=null,queuedChat=null,toastTimer;
let queuedBus=null,queuedBike=null,lastBusHeading=null;
let parkedBikes=[];
let lastChatAt=0;
let course=[],pendingSeat=null,seatClaim=null,thumb=[0,0],thumbId,manualInputAt=-Infinity;
let clockOffset=null,roundTrip=65;
let runToggled=false,shiftHeld=false,sentHeading=0,jumpBase=0;
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
// Sound: footsteps follow the walker's stride; birds, crickets and the guard drum fill the air.
const sound=makeSound();
let strideLeft=0,nextAmbient=0,nextDrum=0,ceremonyAnnounced=-1;
$("sound").setAttribute("aria-pressed",String(sound.enabled));
$("sound").addEventListener("click",()=>{$("sound").setAttribute("aria-pressed",String(sound.toggle()));focusGame();});
for(const kind of ["pointerdown","keydown"])window.addEventListener(kind,()=>sound.wake(),{passive:true});
function soundscape(time,travelled,wading){
  if(!session||!world||riding)return;
  if(travelled>0){
    strideLeft-=travelled;
    if(strideLeft<=0){
      strideLeft=wading?.55:me.running?1.0:.64;
      sound.step(wading?"water":me.up||loftStair(me.x,me.y)!=null?"wood":"stone");
    }
  }
  if(time>=nextAmbient&&!isInsideMuseum(me.x,me.y)){
    nextAmbient=time+2600+Math.random()*7000;
    if(ownView.night)sound.cricket();else sound.chirp();
  }
  // Changing of the guard at Gwanghwamun: announce it once and beat the drum while it lasts.
  const gate=palaceAt(0,-10),ceremony=ceremonyAt(time);
  if(ceremony.active&&inGyeongbok(me.x,me.y)&&near(gate,me.x,me.y)<130){
    const round=Math.floor(time/600000);
    if(round!==ceremonyAnnounced&&ceremony.phase<20){ceremonyAnnounced=round;toast("광화문에서 수문장 교대식이 시작됐어요.");}
    if(time>=nextDrum&&near(gate,me.x,me.y)<90){nextDrum=time+1500;sound.drum();}
  }
}
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
const zoomLimit=3,zoomStep=.75;
function updateZoomButtons(){
  $("zoom-out").disabled=ownView.zoom<=-zoomLimit;
  $("zoom-in").disabled=ownView.zoom>=zoomLimit;
}
function adjustZoom(change){
  if(!session)return;
  const zoom=Math.max(-zoomLimit,Math.min(zoomLimit,ownView.zoom+change));
  if(zoom===ownView.zoom)return;
  ownView={...ownView,zoom};dirty=true;updateZoomButtons();
}
$("zoom-in").addEventListener("click",()=>{adjustZoom(zoomStep);focusGame();});
$("zoom-out").addEventListener("click",()=>{adjustZoom(-zoomStep);focusGame();});
$("game").addEventListener("wheel",event=>{
  if(!session||!event.deltaY||event.target.closest("button"))return;
  event.preventDefault();adjustZoom(-Math.sign(event.deltaY)*zoomStep);
},{passive:false});

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
const sceneTitle=document.querySelector(".scene-title");
function outdoorMap({x,y}){
  if(inGyeongbok(x,y))return "경복궁";
  if(inGwanghwamunPlaza(x,y))return "광화문광장";
  return y<179&&inSejongCorridor(x,y)?"세종대로":"덕수궁";
}
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
  if(isInsideMuseum(point.x,point.y)===indoors){
    const area=outdoorMap(point);
    return {point,prefix:!indoors&&area!==outdoorMap(me)?area:""};
  }
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
  if(!world||!session||me.seat!=null||me.bus||isCycling(me)||myLink()||feedingLocked(gameTime()))return [];
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
  if(wadeSegment(follower,next))return next;
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
  // Other walkers predict my motion between reports, so ten updates a second is plenty.
  return session.mode==="open"?110+Math.min(60,Math.max(0,people.size-5)*6):
    90+Math.min(40,Math.max(0,people.size-8)*3);
}
function wakeSync(){
  if(!session||document.hidden||syncFailures)return;
  scheduleSync(Math.max(0,syncStarted+movingCadence()-performance.now()));
}
function syncCadence(){
  const fast=dirty||myLink()||queuedHand||queuedSignal||queuedFeed||queuedChat||queuedBus||queuedBike||seatClaim||moving(me)||me.blocked||
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
  const bus=queuedBus,bike=queuedBike;
  syncStarted=sent;
  const post=dirty||signal||hand||claim||feed||chat||bus||bike||Date.now()-lastPost>=3800;
  const base={room:visit.room,id:visit.id,key:visit.key,lookPings:true};
  const avatar=post?{...me}:null;
  if(avatar&&claim)Object.assign(avatar,{seat:claim.bench,seatSide:claim.side});
  if(avatar){if(chat)avatar.chat=chat;else delete avatar.chat;}
  if(avatar&&(avatar.wish===lastWishSynced||gameTime(sent)-avatar.wish>=WISH_FLIGHT_MS))delete avatar.wishArt;
  const body=post?{...base,avatar,view:{...ownView},signal,hand,feed,bus,bike}:base;
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
    confirmTransport(confirmed,data.transport,bus,bike);
    parkedBikes=data.parkedBikes??[];
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
  queuedBus=queuedBike=lastBusHeading=selectedBus=null;
  parkedBikes=[];
  busStatus.hidden=true;
  chatInput.value="";composingChat=false;lastChatAt=0;updateChatSend();
  $("invite").disabled=$("look").disabled=$("look-target").disabled=true;
  world?.clearChat();
  clearTransit();
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
    ownView=view;applyNight(view);updateZoomButtons();dirty=true;lastWishSynced=0;lastPost=Date.now();
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
    world?.birds.setSeed(session.room);
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
  if(document.hidden)clearManualInput();
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
  if(amFollowingHands()||me.bus||isCycling(me))return;
  runToggled=!runToggled;markPace();$("game").focus({preventScroll:true});
});
function jump(){
  const time=gameTime();
  if(!session||!world||me.bus||isCycling(me)||queuedBus||queuedBike||feedingLocked(time)||time-me.jump<JUMP_MS)return;
  if(pendingSeat)course=[];
  pendingSeat=seatClaim=null;stand();
  jumpBase=standingHeight();
  me.jump=time;dirty=true;wakeSync();focusGame();
}
$("jump").addEventListener("click",jump);
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
  if(me.bus||isCycling(me)||queuedBus||queuedBike||myLink()?.active||pendingSeat||seatClaim)return;
  if(me.seat!=null){stand();return;}
  const {choice}=benchNearby();
  if(choice)walkTo(choice.approach,choice);
}
$("sit").addEventListener("click",interactBench);
function setMap(open){
  $("map-panel").classList.toggle("expanded",open);
  $("map-toggle").setAttribute("aria-expanded",String(open));
  if(!open){clearMapGestures();setOverview(false);}
  if(!open&&$("map-panel").contains(document.activeElement))$("map-toggle").focus();
}
$("map-toggle").addEventListener("click",()=>setMap($("map-toggle").getAttribute("aria-expanded")!=="true"));
$("close-map").addEventListener("click",()=>setMap(false));
function walkTo(target,seat=null){
  if(!target||!session||riding||me.bus||queuedBus||queuedBike||amFollowingHands()||!world&&!worldFailed)return;
  stand();
  // Routes keep to dry ground unless the walker is already in a pond or taps one.
  const feet=feetHeight(gameTime()),wet=waterDepth(me.x,me.y)>0||waterDepth(target.x,target.y)>0;
  // Upstairs there is no route grid: head straight for the spot and let each step be checked.
  const aloft=me.up||loftStair(me.x,me.y)!=null;
  let steps=aloft?[target]:wet?[]:planWalk(me,target,feet);
  if(!steps.length&&!isCycling(me))steps=planWalk(me,target,feet,true);
  if(!steps.length){toast("걸을 수 있는 길을 터치해 주세요.");return;}
  course=steps;seatClaim=null;pendingSeat=seat;
}
function busShortcut(id,label){
  const stop=busStopById(id);
  return {label,aria:`${stop.name}으로 순간이동`,...stop.board,name:stop.name};
}
const shortcutButtons=["entrance-target","fountain-target","palace-target","stop-target","plaza-bus-target"];
const mapDestinations=[
  {label:"매표소",aria:"매표소로 순간이동",...ticketApproach,x:ticketApproach.x+1,y:ticketApproach.y-2.4,heading:entranceHeading},
  {label:"분수대",aria:"정동 분수대로 순간이동",name:"정동 분수대",x:fountain.x+4.8,y:fountain.y+5.3,heading:318},
  {label:"중화전",aria:"중화전으로 순간이동",...court,heading:normalize(Math.atan2(hall.x-court.x,court.y-hall.y)*180/Math.PI)},
  {label:"교통편",aria:"시청역 2번 출구로 순간이동",...cityHallStation.arrive,name:cityHallStation.name},
  busShortcut("deoksugung","정류장")
];
const plazaDestinations=[
  {label:"광화문역",aria:"광화문역으로 순간이동",...plazaShortcuts.station},
  {label:"이순신",aria:"이순신장군 동상으로 순간이동",...plazaShortcuts.yi},
  {label:"세종대왕",aria:"세종대왕 동상으로 순간이동",...plazaShortcuts.sejong},
  {label:"광화문 앞",aria:"광화문 앞으로 순간이동",...plazaShortcuts.north},
  busShortcut("plaza-south","정류장")
];
const gyeongbokDestinations=[...gbShortcuts.slice(0,3),busShortcut("gyeongbokgung","정류장")];
const shortcutsHere=()=>inGyeongbok(me.x,me.y)?gyeongbokDestinations:inGwanghwamunPlaza(me.x,me.y)?plazaDestinations:mapDestinations;
let shownShortcuts=null;
function refreshShortcuts(){
  const shortcuts=shortcutsHere();
  if(shortcuts===shownShortcuts)return;
  shownShortcuts=shortcuts;
  // A map may offer fewer shortcuts than there are buttons; the spare ones stay hidden.
  shortcutButtons.forEach((id,index)=>{
    const shortcut=shortcuts[index];
    $(id).hidden=!shortcut;
    if(!shortcut)return;
    $(id).textContent=shortcut.label;
    $(id).setAttribute("aria-label",shortcut.aria);
  });
}
shortcutButtons.forEach((id,index)=>$(id).addEventListener("click",()=>{
  const destination=shortcutsHere()[index];
  if(!session||riding||!destination||!walkable(destination.x,destination.y))return;
  if(me.bus||isCycling(me)||queuedBus||queuedBike){
    toast(isCycling(me)?"따릉이에서 내린 뒤 순간이동할 수 있어요.":"버스에서 내린 뒤 순간이동할 수 있어요.");return;
  }
  const linkId=myLink()?.id??(queuedHand?.action==="offer"?queuedHand.id:null);
  if(linkId){queuedHand={action:"release",id:linkId};changeLinks(links);}
  movePlayerTo(destination,destination.name);
  setMap(false);focusGame();
}));

const joystick=$("joystick");
function beginManualMove(){
  manualInputAt=performance.now();
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
  event.preventDefault();
  thumbId=event.pointerId;beginManualMove();
  $("game").focus({preventScroll:true});
  joystick.setPointerCapture(thumbId);moveThumb(event);
});
joystick.addEventListener("pointermove",event=>{if(event.pointerId===thumbId)moveThumb(event);});
function releaseThumb(){
  const id=thumbId;
  thumbId=undefined;thumb=[0,0];
  joystick.style.setProperty("--jx","0px");joystick.style.setProperty("--jy","0px");
  if(id!==undefined&&joystick.hasPointerCapture(id))joystick.releasePointerCapture(id);
}
for(const type of ["pointerup","pointercancel","lostpointercapture"]){
  joystick.addEventListener(type,event=>{if(event.pointerId===thumbId)releaseThumb();});
}
function clearManualInput(){keys.clear();shiftHeld=false;releaseThumb();clearSceneTouch();}
function resetInput(){clearManualInput();course=[];pendingSeat=seatClaim=null;}
window.addEventListener("blur",clearManualInput);
window.addEventListener("keydown",event=>{
  if(event.target.closest("dialog"))return;
  if(event.key==="Escape"){setMap(false);setEmotes(false);}
  if(!session||riding||event.target.closest("input"))return;
  if(event.code==="Space"&&!event.target.closest("button,a")&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();if(!event.repeat)jump();return;
  }
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
function walkFromMap(event,source=event.target){
  const target=source.closest("[data-walk-x]"),matrix=$("world").getScreenCTM();
  if(!matrix)return;
  const point=target?{x:Number(target.dataset.walkX),y:Number(target.dataset.walkY)}:
    new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  walkTo(point);setMap(false);
}
$("world").addEventListener("click",walkFromMap);
const clearSceneTouch=bindSceneTouch($("game"),gameShell,{
  canTap:started=>Boolean(session&&thumbId===undefined&&!keys.size&&started>manualInputAt),
  onBegin:()=>{setEmotes(false);focusGame();},
  onTap:(x,y)=>{
    const target=world?.pick(x,y);
    if(target?.guide&&nearVisitorGuide())openVisitorGuide();
    else walkTo(target);
  },
  onDrag:(dx,dy)=>{
    ownView={...ownView,pan:normalize(ownView.pan+dx*.34),
      tilt:Math.max(-87,Math.min(firstPerson?65:48,ownView.tilt+dy*.26))};
    dirty=true;
  },
  onPinch:adjustZoom
});

// Absolute height of my feet while airborne or perched on a low structure. On plain ground it
// stays 0 so kerbs, benches and railings block as usual until I jump.
const stepUp=.19;
function standingHeight(){return Math.max(world?.groundHeight(me)??0,platformAt(me.x,me.y));}
function feetHeight(time){
  const lift=jumpLift(me,time),platform=Math.max(platformAt(me.x,me.y),loftHeight(me));
  // A jump rises from where it started; landing on something lower or level ends it there.
  // On foot a walker still climbs anything a step high, which is what makes stone stairs work.
  return lift?Math.max(jumpBase+lift,platform):platform+stepUp;
}
function move(x,y){
  if(!session||me.bus||queuedBus||queuedBike||(x===me.x&&y===me.y))return false;
  // Stairs and upper floors follow their own rules; everywhere else the ground decides.
  const loft=loftStep(me,x,y);
  if(isCycling(me)){
    if(loft!==undefined||!clearSegment(me,{x,y},.28,.18))return false;
  }else if(loft===null||loft===undefined&&!wadeSegment(me,{x,y},.36,feetHeight(gameTime())))return false;
  const aim=normalize(Math.atan2(x-me.x,me.y-y)*180/Math.PI);
  const link=myLink();
  const heading=link?.active?normalize(me.heading+angleDelta(me.heading,aim)*.26):aim;
  if(link?.active&&!loft&&!pairFits(me,{x,y,heading},link.side))return false;
  stand();Object.assign(me,{x,y,heading,up:Boolean(loft?.up)});
  dirty=true;return true;
}
function nearWishFountain(){
  // Lanterns rise from the Jeongdong fountain and from the pond around Hyangwonjeong.
  return Boolean(world&&session&&me.seat==null&&!me.bus&&!isCycling(me)&&
    (near(fountain,me.x,me.y)<13||near(wishPond,me.x,me.y)<wishPond.reach));
}
const wishDrawing=makeWishDrawing(art=>{
  const time=gameTime();
  const message=!nearWishFountain()?"정동 분수나 향원정 연못 가까이에서 소원등을 날릴 수 있어요.":
    time-me.wish<2800?"잠시 뒤에 다시 날려 주세요.":"";
  const status=$("wish-status");
  status.textContent=message;status.hidden=!message;
  if(message)return false;
  me.wish=time;me.wishOrigin={x:me.x,y:me.y};
  me.wishHeading=normalize(ownView.pan);
  me.wishArt=art?.some(Boolean)?art:null;
  dirty=true;toast("소원등을 띄웠어요.");
});
// Souvenir photo in the throne-hall court: face the camera, wave, and save the picture.
let photoBusy=false,lastScene=null;
function nearPhotoZone(){
  return Boolean(world&&session&&me.seat==null&&near(gbPhotoZone,me.x,me.y)<gbPhotoZone.reach);
}
function savePhoto(picture){
  const image=new Image();
  image.onload=()=>{
    const canvas=document.createElement("canvas"),bar=Math.round(image.height*.11),day=new Date();
    canvas.width=image.width;canvas.height=image.height+bar;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#f4efe2";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0);
    ctx.fillStyle="#26322b";ctx.textBaseline="middle";
    ctx.font=`bold ${Math.round(bar*.42)}px "Malgun Gothic", sans-serif`;
    ctx.fillText("경복궁 근정전",bar*.4,image.height+bar*.52);
    ctx.textAlign="right";ctx.font=`${Math.round(bar*.3)}px "Malgun Gothic", sans-serif`;
    ctx.fillText(`${session?.nickname??""} · ${day.getFullYear()}.${day.getMonth()+1}.${day.getDate()} · 덕수궁 한바퀴`,
      canvas.width-bar*.4,image.height+bar*.52);
    const link=document.createElement("a"),two=value=>String(value).padStart(2,"0");
    link.download=`gyeongbokgung-${day.getFullYear()}${two(day.getMonth()+1)}${two(day.getDate())}.jpg`;
    link.href=canvas.toDataURL("image/jpeg",.92);
    link.click();
    toast("기념사진을 저장했어요.");
  };
  image.src=picture;
}
$("photo").addEventListener("click",()=>{
  if(photoBusy||!nearPhotoZone()||!lastScene)return;
  photoBusy=true;resetInput();
  Object.assign(me,{x:gbPhotoZone.x,y:gbPhotoZone.y,heading:gbPhotoZone.heading,vx:0,vy:0,up:false,wave:gameTime()});
  dirty=true;toast("하나, 둘, 셋!");
  setTimeout(()=>{
    photoBusy=false;
    if(world&&lastScene&&nearPhotoZone())savePhoto(world.snapshot(lastScene,gbPhotoZone.shot));
  },1100);
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
  return Boolean(!me.bus&&!isCycling(me)&&me.item?.remaining&&time-me.item.started>=ITEMS[me.item.kind].duration);
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
  if(!museum||me.bus||isCycling(me)||queuedBus||queuedBike)return null;
  const inside=museum.isInside(me.x,me.y);
  const door=inside?museum.insideDoor:museum.outsideDoor;
  return near(door,me.x,me.y)<2.25&&clearSegment(me,door)?{inside,museum}:null;
}
const busDialog=$("bus-seat-dialog"),travelStatus=$("travel-status"),busStatus=$("bus-status");
const busArrival=$("bus-status-arrival"),busDeparture=$("bus-status-departure");
const BUS_STOP_INFO_REACH=20;
let selectedBus=null;
const seatButtons=Array.from({length:BUS_SEATS},(_,seat)=>{
  const button=document.createElement("button");
  button.type="button";button.className="quiet";
  button.addEventListener("click",()=>{
    const context=boardableBus(gameTime());
    if(!context||context.bus.index!==selectedBus?.index||context.stop.id!==selectedBus.stop.id||seatTaken(context.bus.index,seat))return;
    queuedBus={action:"board",index:context.bus.index,seat};
    busDialog.close();setMap(false);resetInput();wakeSync();focusGame();
  });
  $("bus-seats").append(button);return button;
});
function seatTaken(index,seat){
  return [...people.values()].some(({avatar})=>avatar.bus?.index===index&&avatar.bus.seat===seat);
}
function transportReady(time){
  const item=me.item&&ITEMS[me.item.kind];
  return Boolean(session&&world&&!riding&&!me.bus&&!queuedBus&&!queuedBike&&!myLink()&&!queuedHand&&
    me.seat==null&&!me.up&&time-me.jump>=JUMP_MS&&!feedingLocked(time)&&time-(me.pet?.at??0)>=PET_MS&&
    (!item||time-me.item.started>=item.duration));
}
function travelTime(ms){
  const seconds=Math.max(0,Math.ceil(ms/1000)),minutes=Math.floor(seconds/60);
  return minutes?`${minutes}분 ${seconds%60}초`:`${seconds}초`;
}
function refreshBusSeats(time){
  if(!busDialog.open||!selectedBus)return;
  const {index,stop}=selectedBus,bus=busAt(index,time),here=bus?.stopId===stop.id;
  const {arrivalMs,departureMs}=busStopTimes(stop.id,time);
  const status=here?`${stop.direction} · ${travelTime(bus.remaining)} 뒤 출발`:
    departureMs===null?"선택한 버스가 출발했어요.":"다른 버스가 정차했어요. 창을 닫고 좌석을 다시 골라 주세요.";
  setText($("bus-seat-time"),`${status} · 다음 버스 ${travelTime(arrivalMs)} 뒤 도착`);
  seatButtons.forEach((button,seat)=>{
    const occupied=here&&seatTaken(index,seat);
    button.disabled=!here||occupied;
    setText(button,`${seat+1}번${occupied?" · 이용 중":""}`);
  });
}
function nearbyBikeDock(){
  const dock=nearBikeDock(me);
  return dock&&clearSegment(me,dock.access,.32,.18)?dock:null;
}
function nearbyParkedBike(){
  const bike=me.bike?.parked;
  return bike&&near(bike,me.x,me.y)<=bikeMountReach&&clearSegment(me,bike,.32,.18);
}
function nearbyBusStop(){
  let closest=null,range=BUS_STOP_INFO_REACH;
  for(const stop of busStops){
    const distance=near(stop.board,me.x,me.y);
    if(distance<=range){closest=stop;range=distance;}
  }
  return closest;
}
function boardableBus(time,ready=transportReady(time)){
  if(!ready||isCycling(me))return null;
  const context=nearBus(me,time);
  return context&&clearSegment(me,context.stop.board,.32,.22)?context:null;
}
function showCountdown(row,ms){
  row.hidden=ms==null;
  if(ms!=null)setText(row.lastElementChild,travelTime(ms));
}
function updateBusStatus(bus,stop,time){
  const next=bus?.traveling?busStopById(bus.nextStopId):null;
  const shown=stop??next;
  busStatus.hidden=!shown;
  if(!shown)return;
  const schedule=bus?null:busStopTimes(shown.id,time);
  setText($("bus-status-stop"),shown.name);
  setText($("bus-status-direction"),bus?"세종대로 순환버스 · 탑승 중":shown.direction);
  setText($("bus-status-arrival-label"),bus?"다음 정류장 도착":"다음 버스 도착");
  showCountdown(busArrival,next?bus.eta:schedule?.arrivalMs);
  showCountdown(busDeparture,bus?.stopId?bus.remaining:schedule?.departureMs);
}
function updateTransport(time){
  const bus=me.bus&&busAt(me.bus.index,time),ready=transportReady(time);
  const stop=bus?busStopById(bus.stopId):world&&!riding?nearbyBusStop():null;
  const dock=ready&&nearbyBikeDock();
  const boarding=boardableBus(time,ready);
  const parked=me.bike?.parked,cycling=isCycling(me);
  setActivity("bike-action",queuedBike?"따릉이 확인 중":dock&&(!me.bike||cycling)?cycling?"따릉이 반납하기":"따릉이 빌리기":null,Boolean(queuedBike));
  setActivity("bike-park",ready?cycling?"따릉이에서 내리기":nearbyParkedBike()?"따릉이 다시 타기":null:null);
  const button=$("bus-action");
  setActivity("bus-action",queuedBus?"버스 확인 중":bus&&stop?"버스 내리기":boarding?"버스 타기":null,Boolean(queuedBus));
  if(boarding)attr(button,"aria-haspopup","dialog");else button.removeAttribute("aria-haspopup");
  const label=cycling?"따릉이 이용 중 · 지정 대여소에서 반납":parked&&(dock||nearbyParkedBike())?
    `세워둔 따릉이 · ${travelTime(parked.at+bikeParkDuration-time)} 뒤 회수`:"";
  travelStatus.hidden=!label;setText(travelStatus,label);
  updateBusStatus(bus,stop,time);
  refreshBusSeats(time);
}
$("bus-action").addEventListener("click",()=>{
  if(queuedBus)return;
  const time=gameTime();
  if(me.bus){
    if(!busAt(me.bus.index,time)?.stopId)return;
    queuedBus={action:"exit",index:me.bus.index};wakeSync();focusGame();return;
  }
  const context=boardableBus(time);
  if(!context)return;
  selectedBus={index:context.bus.index,stop:context.stop};
  resetInput();busDialog.showModal();refreshBusSeats(time);
});
$("bike-action").addEventListener("click",()=>{
  const dock=transportReady(gameTime())&&nearbyBikeDock();
  if(!dock||me.bike?.parked)return;
  queuedBike={action:isCycling(me)?"return":"take",dock:dock.id};resetInput();wakeSync();focusGame();
});
$("bike-park").addEventListener("click",()=>{
  if(!transportReady(gameTime()))return;
  if(isCycling(me))queuedBike={action:"park"};
  else if(nearbyParkedBike())queuedBike={action:"mount"};
  else return;
  resetInput();wakeSync();focusGame();
});
function confirmTransport(avatar,result,bus,bike){
  if(!avatar)return;
  const ridingBus=me.bus;
  me.bus=avatar.bus??null;me.bike=avatar.bike??null;
  if(ridingBus?.index!==me.bus?.index||ridingBus?.seat!==me.bus?.seat){
    resetInput();
    Object.assign(me,{x:avatar.x,y:avatar.y,heading:avatar.heading,vx:0,vy:0,jump:0,blocked:false,running:false,up:false});
    lastBusHeading=me.bus?avatar.heading:null;
    ownView={...ownView,pan:avatar.heading,tilt:0};
    setText($("location"),me.bus?"세종대로 순환버스":placeName(me));
  }
  if(bus&&queuedBus===bus){
    queuedBus=null;
    if(result?.bus==="occupied")toast("이미 앉은 사람이 있어요. 다른 좌석을 골라 주세요.");
    else if(result?.bus==="unavailable")toast(bus.action==="board"?"버스가 정차한 곳에서 다시 타 주세요.":"다음 정류장에 도착한 뒤 내릴 수 있어요.");
  }
  if(bike&&queuedBike===bike){
    queuedBike=null;
    const outcome=result?.bike;
    if(outcome==="parked"||outcome==="mounted"){
      resetInput();Object.assign(me,{x:avatar.x,y:avatar.y,heading:avatar.heading,vx:0,vy:0,blocked:false,running:false});
      setText($("location"),placeName(me));
    }
    if(outcome==="taken")toast("따릉이를 빌렸어요. 평소처럼 움직이면 자전거가 달려요.");
    else if(outcome==="returned")toast("따릉이를 반납했어요.");
    else if(outcome==="parked")toast("따릉이를 세웠어요. 10분 안에 돌아와 다시 탈 수 있어요.");
    else if(outcome==="unavailable")toast(bike.action==="mount"?"세워둔 따릉이 가까이에서 다시 타 주세요.":"지금은 따릉이를 이용할 수 없어요.");
  }
}
const transitDialog=$("transit-dialog"),transitOptions=$("transit-options");
let riding=false,rideArrival,rideEnd;
function nearbyTransit(){
  if(!world||!session||me.seat!=null||me.bus||isCycling(me)||queuedBus||queuedBike)return null;
  let closest=null,distance=4.5;
  for(const stop of transitStops){
    if(stop.mode!=="subway")continue;
    const gap=near(stop.door,me.x,me.y);
    if(gap<distance&&clearSegment(me,stop.door)){closest=stop;distance=gap;}
  }
  return closest;
}
const subwayScene=`<svg viewBox="0 0 320 120" role="img" aria-label="지하철"><rect width="320" height="120" fill="#10181c"/>
    <g class="ride-tunnel"><path d="M-40 26H400" stroke="#f4d98a" stroke-width="3" stroke-dasharray="14 46"/><path d="M-40 14H400" stroke="#2b3a41" stroke-width="6"/></g>
    <rect y="92" width="320" height="28" fill="#2a343a"/><rect y="92" width="320" height="3" fill="#f0c94a"/>
    <g class="ride-train"><rect x="20" y="40" width="280" height="54" rx="10" fill="#d7dde0"/><rect x="20" y="70" width="280" height="8" fill="#ef7c1c"/>
      <rect x="20" y="82" width="280" height="12" rx="4" fill="#8f999e"/>
      <g fill="#1e2b33"><rect x="34" y="48" width="38" height="18" rx="3"/><rect x="140" y="48" width="40" height="18" rx="3"/><rect x="248" y="48" width="38" height="18" rx="3"/></g>
      <g class="ride-doors"><rect class="ride-door-left" x="84" y="46" width="22" height="42" fill="#b9c2c6" stroke="#6d777c"/><rect class="ride-door-right" x="106" y="46" width="22" height="42" fill="#b9c2c6" stroke="#6d777c"/>
        <rect class="ride-door-left" x="192" y="46" width="22" height="42" fill="#b9c2c6" stroke="#6d777c"/><rect class="ride-door-right" x="214" y="46" width="22" height="42" fill="#b9c2c6" stroke="#6d777c"/></g>
      <circle cx="292" cy="62" r="4" fill="#fff3c2"/></g></svg>`;
function clearTransit(){
  clearTimeout(rideArrival);clearTimeout(rideEnd);
  $("transit").hidden=true;riding=false;$("transit-scene").replaceChildren();
}
function rideTransit(stop,{target,area,line}){
  if(riding||myLink()?.active||feedingLocked(gameTime())||nearbyTransit()!==stop||!walkable(target.arrive.x,target.arrive.y))return;
  const linkId=myLink()?.id??(queuedHand?.action==="offer"?queuedHand.id:null);
  if(linkId){queuedHand={action:"release",id:linkId};changeLinks(links);}
  transitDialog.close();setMap(false);riding=true;resetInput();
  Object.assign(me,{vx:0,vy:0,blocked:false,running:false});dirty=true;wakeSync();
  $("transit-title").textContent=area;
  $("transit-line").textContent=line;
  $("transit").dataset.mode=stop.mode;sound.chime(stop.mode);
  $("transit-scene").innerHTML=subwayScene;
  $("transit").hidden=false;
  const visit=session;
  rideArrival=setTimeout(()=>{if(session===visit)movePlayerTo(target.arrive,target.name);},2300);
  rideEnd=setTimeout(()=>{
    if(session!==visit)return;
    clearTransit();toast(target.name+"에 도착했어요.");focusGame();
  },4600);
}
$("subway").addEventListener("click",()=>{
  const stop=nearbyTransit();
  if(!stop||riding||myLink()?.active||feedingLocked(gameTime()))return;
  resetInput();
  $("transit-from").textContent=stop.name;
  transitOptions.replaceChildren(...transitRoutes(stop).map(route=>{
    const button=document.createElement("button"),area=document.createElement("strong"),place=document.createElement("span");
    button.type="button";button.className="quiet";
    area.textContent=route.area;place.textContent=route.target.name;
    button.append(area,place);
    button.addEventListener("click",()=>rideTransit(stop,route));
    return button;
  }));
  transitDialog.showModal();
});
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
$("landmark-guide").addEventListener("click",()=>{
  const guide=session&&world&&nearbyPalaceGuide(me);
  if(!guide)return;
  resetInput();
  $("landmark-guide-title").textContent=guide.title;
  $("landmark-guide-description").textContent=guide.description;
  $("landmark-guide-source").href=guide.source;
  $("landmark-guide-dialog").showModal();
});
$("pet-cat").addEventListener("click",()=>{
  if(!session||myLink()?.active||me.seat!=null)return;
  const time=gameTime(),cat=world?.parkLife.nearestCat(me.x,me.y);
  if(!cat||time-(me.pet?.at??0)<PET_MS||feedingLocked(time))return;
  resetInput();
  me.heading=normalize(Math.atan2(cat.x-me.x,me.y-cat.y)*180/Math.PI);
  me.pet={id:cat.id,at:time};dirty=true;sound.meow();focusGame();
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
  Object.assign(me,{x:destination.x,y:destination.y,heading:destination.heading,vx:0,vy:0,blocked:false,running:false,jump:0,up:false});
  ownView={...ownView,pan:destination.heading,tilt:destination.tilt??0};
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
  const eligible=world&&session&&!me.bus&&!isCycling(me)&&!queuedBus&&!queuedBike;
  const feeding=feedingLocked(time);
  setActivity("visitor-guide",guideNearby?"관람 안내 읽기":null);
  const landmark=eligible&&nearbyPalaceGuide(me);
  setActivity("landmark-guide",landmark?"설명 읽기":null);
  if(landmark)attr($("landmark-guide"),"aria-label",landmark.title+" 설명 읽기");
  $("jump").hidden=Boolean(me.bus||isCycling(me));
  $("jump").disabled=!eligible||feeding||time-me.jump<JUMP_MS;
  const atFountain=nearWishFountain();
  if($("wish").hidden===Boolean(atFountain))$("wish").hidden=$("wish").disabled=!atFountain;
  const cat=eligible&&me.seat==null&&!myLink()?.active&&world.parkLife.nearestCat(me.x,me.y);
  setActivity("pet-cat",cat?"쓰다듬기":null,feeding||time-(me.pet?.at??0)<PET_MS);
  if(cat)attr($("pet-cat"),"title",cat.name+" 쓰다듬기");
  const station=eligible&&me.seat==null&&nearbyStation();
  const busy=Boolean(queuedFeed||me.item&&time-me.item.started<ITEMS[me.item.kind].duration);
  const pickup=station&&station.kind!==me.item?.kind?(station.kind==="churu"?"츄르 사기":ITEMS[station.kind].name+" 받기"):null;
  setActivity("take-item",pickup,busy);
  setActivity("photo",eligible&&nearPhotoZone()?"사진 찍기":null,photoBusy);
  const spec=eligible&&me.item&&ITEMS[me.item.kind];
  if(spec&&me.item.kind==="churu"){
    const cat=feedCatNearby();
    const label=feeding?(queuedFeed?"간식 주는 중":"간식 먹는 중"):cat?spec.verb+" · "+me.item.remaining+"회":null;
    setActivity("use-item",label,feeding||Boolean(queuedFeed)||!canUseItem(time)||time-(me.pet?.at??0)<PET_MS);
  }else{
    setActivity("use-item",spec?(me.item.kind==="sparkler"?spec.verb:spec.verb+" · "+me.item.remaining+"회"):null,!canUseItem(time));
  }
  const stop=eligible&&nearbyTransit();
  setActivity("subway",stop?"지하철 타기":null,riding||feeding||Boolean(myLink()?.active));
  const portal=eligible&&portalNearby();
  setActivity("museum-door",portal?(portal.inside?"나가기":"입장하기"):null,feeding||Boolean(myLink()?.active));
  const exhibit=eligible&&nearbyExhibit();
  setActivity("museum-exhibit",exhibit?"작품 설명":null);
  if(exhibit)attr($("museum-exhibit"),"aria-label",exhibit.title+" 작품 설명");
}
function moveWithInput(dx,dy,speed,link,cameraRelative){
  if(me.bus||queuedBus||queuedBike)return false;
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
  if(riding)return false;
  if(me.bus){
    const bus=busAt(me.bus.index,gameTime(now)),seat=busSeatPose(bus,me.bus.seat);
    if(!seat)return false;
    Object.assign(me,seat,{vx:0,vy:0,blocked:false,running:false});
    if(lastBusHeading!=null)ownView.pan=normalize(ownView.pan+angleDelta(lastBusHeading,bus.heading));
    lastBusHeading=bus.heading;
    setText($("location"),busStopById(bus.stopId)?.name??"세종대로 순환버스");
    soundscape(gameTime(now),0,false);return false;
  }
  const oldX=me.x,oldY=me.y,link=myLink(),follower=amFollowingHands();
  const wasMoving=moving(me)||me.blocked,wasBlocked=me.blocked,wasRunning=me.running;
  const leader=follower&&people.get(link.leader);
  // Wading through a pond is slow going, and there is no running in the water.
  const wading=waterDepth(me.x,me.y)>0,pace=(runToggled||shiftHeld)&&!wading;
  const speed=elapsed*(isCycling(me)?9.4:wading?1.1:pace?6.675:2.58);
  let blocked=false;
  if(leader){
    const next=pairedPose(link,leader.position,me,now);
    if(me.heading!==next.heading){me.heading=next.heading;dirty=true;}
    if(next.x!==me.x||next.y!==me.y){me.x=next.x;me.y=next.y;dirty=true;}
    blocked=Boolean(leader.avatar.blocked);
  }else if(session&&elapsed>0&&!queuedBus&&!queuedBike&&!feedingLocked(gameTime(now))){
    if(keys.size||thumbId!==undefined){
      const [dx,dy]=Array.from(keys,key=>vectors[key]).reduce(([x,y],[vx,vy])=>[x+vx,y+vy],thumb);
      blocked=moveWithInput(dx,dy,speed,link,!worldFailed&&(thumbId!==undefined||document.activeElement!==$("world")));
    }else walkCourse(speed);
  }
  const moved=oldX!==me.x||oldY!==me.y;
  soundscape(gameTime(now),moved&&!isCycling(me)&&me.seat==null?Math.min(1.2,Math.hypot(me.x-oldX,me.y-oldY)):0,wading);
  if(moved){
    const location=placeName(me);
    if($("location").textContent!==location)$("location").textContent=location;
  }
  const cap=isCycling(me)?12:8;
  const vx=moved&&elapsed?Math.max(-cap,Math.min(cap,(me.x-oldX)/elapsed)):0;
  const vy=moved&&elapsed?Math.max(-cap,Math.min(cap,(me.y-oldY)/elapsed)):0;
  const running=leader?Boolean(leader.avatar.running):!isCycling(me)&&(moved||blocked)&&pace;
  if(me.vx!==vx||me.vy!==vy||me.blocked!==blocked||me.running!==running){
    Object.assign(me,{vx,vy,blocked,running});dirty=true;
  }
  // Starts, stops and sharp turns are what prediction cannot guess, so send those at once.
  const turned=Math.abs(angleDelta(sentHeading,me.heading))>28;
  if(wasMoving!==(moving(me)||blocked)||wasBlocked!==blocked||wasRunning!==running||turned&&moved){
    sentHeading=me.heading;wakeSync();
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
    if(!leader||!follower||leader.bus||follower.bus||isCycling(leader)||isCycling(follower))continue;
    if(follower!==self)Object.assign(follower,pairedPose(link,leader,follower,now));
    leader.hand=-link.side;follower.hand=link.side;
    follower.stepping=leader.stepping;follower.running=leader.running;
  }
  return {self,others};
}
let lastFrame=performance.now(),interfaceAt=0,guideNearby=false;
function frame(now){
  const elapsed=Math.max(0,Math.min(56,now-lastFrame))/1000;lastFrame=now;
  requestAnimationFrame(frame);
  if(!session)return;
  const time=gameTime(now);
  smoothPeople(people,elapsed,time,roundTrip);
  const stepping=motion(now,elapsed);
  const {self,others}=actors(now,stepping);
  // Buttons, the map and guides do not need every frame; updating them about ten times a
  // second leaves the rest of each frame for drawing.
  if(now>=interfaceAt){
    interfaceAt=now+95;
    guideNearby=!me.bus&&!isCycling(me)&&nearVisitorGuide();
    updateActivities(time,guideNearby);
    updateTransport(time);
    $("run").hidden=Boolean(me.bus||isCycling(me));
    const seatEnabled=world&&session&&!me.bus&&!isCycling(me)&&!queuedBus&&!queuedBike&&!myLink()?.active&&!feedingLocked(time);
    const bench=seatEnabled&&me.seat==null&&!pendingSeat&&!seatClaim?benchNearby():null;
    const seatLabel=me.seat!=null?"일어나기":seatClaim?"자리 확인 중":pendingSeat?"벤치로 이동 중":
      bench?.choice?"앉기":bench?.nearby?"빈자리 없음":null;
    setActivity("sit",seatEnabled?seatLabel:null,me.seat==null&&!bench?.choice);
    attr($("sit"),"aria-pressed",me.seat!=null);
    setText($("game-place"),$("location").textContent);
    const area=outdoorMap(me),jeongdong=area==="덕수궁";
    setText($("game-season"),(jeongdong?"정동":area)+"의 가을");
    setText(sceneTitle,jeongdong?"덕수궁 돌담길":area);
    setText(sceneTitle.previousElementSibling,jeongdong?"SEOUL · JEONGDONG":"SEOUL · JONGNO");
    refreshShortcuts();
    updateHandControls();updateLocationGuides(time);updateMaps(self,others);
  }
  lastScene={me:self,peers:[...others.values()],parkedBikes,view:ownView,firstPerson,guideNearby,destination:course.at(-1),clock:time};
  world?.render(lastScene,now);
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
let overviewOpen=false,overviewLayer;
let mapViewport=null;
const overviewButton=$("overview-map");
function setOverview(open){
  if(overviewOpen===open)return;
  overviewOpen=open;
  overviewButton.setAttribute("aria-pressed",String(overviewOpen));
  overviewButton.textContent=overviewOpen?"주변 지도":"전체 지도";
}
overviewButton.addEventListener("click",()=>setOverview(!overviewOpen));
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
  drawCorridor(base,mini);
  drawGyeongbok(base,mini);
  drawPlaza(base,mini);
  drawTransport(base,mini);
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
function drawTransport(base,mini){
  for(const [points,color] of [[bikeDocks.map(dock=>({...dock.access,name:dock.name})),"#8ed7a2"],
    [busStops.map(stop=>({...stop.board,name:`${stop.name} · ${stop.direction}`})),"#91c9f2"]]){
    for(const point of points){
      const mark=svg(base,"g",mini?{}:{"data-walk-x":point.x,"data-walk-y":point.y});
      svg(mark,"circle",{cx:point.x,cy:point.y,r:mini?2.8:5.8,fill:color,stroke:"#18291f","stroke-width":mini?.65:1.5});
      if(!mini)svg(mark,"title",{},point.name);
    }
  }
}
function drawCorridor(base,mini){
  svg(base,"polygon",{points:outline(corridorMainRoad),fill:"#4e5351"});
  for(const points of corridorSidewalks)svg(base,"polygon",{points:outline(points),fill:"#847c62"});
  for(const crossing of corridorCrossings)svg(base,"polygon",{points:outline(crossing.outline),fill:"#c7c0aa"});
  svg(base,"polyline",{points:outline(corridorWalkSpine),fill:"none",stroke:"#d7c291","stroke-width":mini?1.15:2.6,
    "stroke-linejoin":"round","stroke-dasharray":"3 3"});
  for(const [index,point] of corridorLandmarks.entries()){
    const side=index%2?1:-1;
    svg(base,"circle",{cx:point.x,cy:point.y,r:mini?1.5:3,fill:"#e1c790"});
    svg(base,"text",{x:point.x+(mini?0:side*10),y:point.y+(mini?-3.5:4),class:mini?"mini-landmark":"map-label plaza-map-label",
      "text-anchor":mini?"middle":side===1?"start":"end"},point.shortName??point.name);
  }
}
function drawOverview(base){
  const layer=svg(base,"g",{visibility:"hidden"});
  const path=[spawn,...corridorWalkSpine,...plazaPaths[0].points,palaceAt(0,-37),palaceAt(0,260)];
  svg(layer,"polyline",{points:outline(path),fill:"none",stroke:"#f1d18b","stroke-width":9,"stroke-linejoin":"round",
    "stroke-linecap":"round","stroke-dasharray":"14 9",opacity:.9});
  for(const [point,name,side] of [[spawn,"덕수궁",-1],[plazaAt(-12,240),"광화문광장",1],[palaceAt(0,245),"경복궁",1]]){
    const destination=svg(layer,"g",{"data-walk-x":point.x,"data-walk-y":point.y});
    svg(destination,"circle",{cx:point.x,cy:point.y,r:16,fill:"#f2d59b",stroke:"#40392c","stroke-width":5});
    svg(destination,"text",{x:point.x+side*47,y:point.y+20,class:"map-label overview-label","text-anchor":side<0?"end":"start"},name);
  }
  return layer;
}

// The detailed views crop the same continuous world around each district.
function drawGyeongbok(base,mini){
  const box=(west,east,south,north)=>{
    const a=palaceAt(west,north),b=palaceAt(east,south);
    return {x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};
  };
  svg(base,"rect",{...box(-92,92,-52,0),fill:"#766c5a"});
  // Across the road: the Uijeongbu site plaza, the crossings and the bus-stop island.
  svg(base,"rect",{...box(gbUijeongbu.west,gbUijeongbu.east,gbUijeongbu.south,gbUijeongbu.north),fill:"#55704c",stroke:"#929283","stroke-width":1.6,rx:4});
  svg(base,"rect",{...box(gbBusIsland.west,gbBusIsland.east,gbBusIsland.south,gbBusIsland.north),fill:"#766c5a",rx:3});
  for(const crossing of gbCrossings)svg(base,"rect",{...box(crossing.west,crossing.east,crossing.south,crossing.north),fill:"#d8d2bf",opacity:.85});
  if(!mini){
    const label=palaceAt((gbUijeongbu.west+gbUijeongbu.east)/2,(gbUijeongbu.south+gbUijeongbu.north)/2);
    svg(base,"text",{x:label.x,y:label.y+4,class:"map-label gyeongbok-label","text-anchor":"middle"},"의정부지 광장");
  }
  svg(base,"rect",{...box(-wallHalf,wallHalf,0,wallNorth),fill:"#465248",stroke:"#929283","stroke-width":2.6});
  for(const {kind,west,east,south,north} of gbLawns){
    svg(base,"rect",{...box(west,east,south,north),fill:kind==="grove"?"#314938":"#607651",rx:3});
  }
  for(const court of Object.values(gbCourts)){
    svg(base,"rect",{...box(court.west,court.east,court.south,court.north),fill:"#766c5a",stroke:"#a07d62","stroke-width":1.6});
  }
  for(const {points,width,surface} of gbPaths){
    svg(base,"polyline",{points:outline(points),fill:"none",stroke:surface==="stone"?"#c9b899":"#a29e7d","stroke-opacity":.6,
      "stroke-width":width,"stroke-linecap":"round","stroke-linejoin":"round"});
  }
  svg(base,"rect",{...box(gbLake.west,gbLake.east,gbLake.south,gbLake.north),fill:"#3b777d",stroke:"#739595","stroke-width":1.4});
  svg(base,"rect",{...box(gbLake.island.west,gbLake.island.east,gbLake.island.south,gbLake.island.north),fill:"#766c5a"});
  const pond=palaceAt(gbPond.east,gbPond.north);
  svg(base,"circle",{cx:pond.x,cy:pond.y,r:gbPond.radius,fill:"#3b777d",stroke:"#739595","stroke-width":1.4});
  svg(base,"circle",{cx:pond.x,cy:pond.y,r:gbPond.island,fill:"#607651"});
  for(const building of gbSites){
    svg(base,"rect",{x:building.x-building.w/2,y:building.y-building.d/2,width:building.w,height:building.d,
      fill:building.kind==="museum"?"#6f7468":"#827659",stroke:"#aa9774","stroke-width":1,rx:2,
      transform:"rotate("+(-(building.angle||0)*180/Math.PI)+" "+building.x+" "+building.y+")"});
  }
  const labels=mini?["광화문","흥례문","근정전","사정전","강녕전","교태전","경회루","수정전","자경전","향원정","건청궁","집옥재","국립고궁박물관"]:
    ["광화문","흥례문","근정전","강녕전","교태전","경회루","자경전","향원정","건청궁","국립고궁박물관","국립민속박물관"];
  for(const building of gbSites.filter(spec=>labels.includes(spec.name))){
    svg(base,"text",{x:building.x,y:building.y+(mini?building.d/2+6:building.d/2+22),class:mini?"mini-landmark":"map-label gyeongbok-label",
      "text-anchor":"middle"},building.name);
  }
  for(const stop of transitStops){
    if(stop.mode!=="subway"||inGwanghwamunPlaza(stop.x,stop.y))continue;
    const big=!mini&&inGyeongbok(stop.x,stop.y);
    svg(base,"circle",{cx:stop.x,cy:stop.y,r:mini?1.9:big?7:3,fill:"#f1d8a6",stroke:"#513e32","stroke-width":mini?.6:big?2:.9});
    svg(base,"text",{x:stop.x,y:stop.y-(mini?3.2:big?12:5),class:mini?"mini-landmark":big?"map-label gyeongbok-label":"map-label","text-anchor":"middle",
      ...(mini||big?{}:{style:"font-size:8.5px;stroke-width:2.2px"})},mini?"지하철":stop.name);
  }
}
function drawPlaza(base,mini){
  const northRoad=plazaAt(-310,sajikRoad.north),crosswalk=plazaAt(sajikRoad.crossX-sajikRoad.crossWidth/2,sajikRoad.north);
  svg(base,"rect",{x:northRoad.x,y:northRoad.y,width:620,height:sajikRoad.north-sajikRoad.south,fill:"#3a4240"});
  svg(base,"rect",{x:crosswalk.x,y:crosswalk.y,width:sajikRoad.crossWidth,height:sajikRoad.north-sajikRoad.south,fill:"#c7c0aa"});
  const road=plazaRoadProfile.map(([n,e])=>plazaAt(e+eastRoadWidth/2,n));
  svg(base,"polyline",{points:outline(road),fill:"none",stroke:"#4e5351","stroke-width":eastRoadWidth});
  svg(base,"polygon",{points:outline(plazaOutline),fill:"#6a6c56",stroke:"#9f977b","stroke-width":1.5});
  for(const bed of plazaBeds)svg(base,"polygon",{points:outline(bed.outline),fill:bed.kind==="lawn"?"#849465":"#4d684f"});
  for(const {points,width,surface} of plazaPaths){
    svg(base,"polyline",{points:outline(points),fill:"none",stroke:surface==="stone"?"#b9ad90":"#9f9679",
      "stroke-width":width,"stroke-linecap":"round","stroke-linejoin":"round"});
  }
  const labels=[["gate","광화문",1],["woldae","월대",-1],["lawn","육조마당",-1],["pine","소나무정원",-1],
    ["time","시간의 정원",1],["gratitude","감사의 정원",-1],["sejong","세종대왕",1],
    ["play","놀이마당",-1],["haechi","해치마당",1],["hangeul","한글분수",-1],
    ["yi","이순신",1],["myeongnyang","명량분수",1]];
  for(const [key,label,side] of labels){
    const point=plazaSites[key];
    svg(base,"circle",{cx:point.x,cy:point.y,r:mini?1.7:3.6,fill:"#e1c790"});
    if(!mini)svg(base,"line",{x1:point.x+side*4,y1:point.y,x2:point.x+side*11,y2:point.y,stroke:"#c2b58c","stroke-width":1});
    svg(base,"text",{x:point.x+(mini?0:side*14),y:point.y+(mini?-4:4),class:mini?"mini-landmark":"map-label plaza-map-label",
      "text-anchor":mini?"middle":side===1?"start":"end"},label);
  }
  for(const stop of transitStops){
    if(stop.mode!=="subway"||!inGwanghwamunPlaza(stop.x,stop.y))continue;
    svg(base,"circle",{cx:stop.x,cy:stop.y,r:mini?2:4.8,fill:"#f1d8a6",stroke:"#293c35","stroke-width":mini?.7:1.2});
    svg(base,"text",{x:stop.x,y:stop.y+(mini?7:16),class:mini?"mini-landmark":"map-label plaza-map-label",
      "text-anchor":"middle"},"광화문역");
  }
}
const gyeongbokViewBox=[gbBounds.minX+18,gbBounds.minY-24,564,1098].join(" ");
const plazaViewBox=[plazaBounds.minX,plazaBounds.minY,plazaBounds.maxX-plazaBounds.minX,plazaBounds.maxY-plazaBounds.minY].join(" ");
const southViewBox="58 28 520 397",southApproachBox="58 -60 520 485";
const plazaApproachBox=[plazaBounds.minX-18,plazaBounds.minY+210,Math.max(plazaBounds.maxX,corridorBounds.maxX)-plazaBounds.minX+36,
  -58-(plazaBounds.minY+210)].join(" ");
const fieldViewBox=[38,gbBounds.minY-28,Math.max(gbBounds.maxX,corridorBounds.maxX)-10,450-gbBounds.minY].join(" ");
function attr(node,key,value){if(node.getAttribute(key)!==String(value))node.setAttribute(key,value);}
function setMapView(view){
  const {base}=mapViewport;
  const x=Math.min(base.x+base.w*.96,Math.max(base.x-base.w*.66,view.x));
  const y=Math.min(base.y+base.h*.96,Math.max(base.y-base.h*.66,view.y));
  mapViewport.view={...view,x,y};
  attr($("world"),"viewBox",[x,y,view.w,view.h].join(" "));
}
const clearMapGestures=bindMapGestures($("world"),{getView:()=>mapViewport,setView:setMapView,onTap:walkFromMap});
function showMapRegion(box){
  if(mapViewport?.key===box)return;
  clearMapGestures();
  const [x,y,w,h]=box.split(" ").map(Number),base={x,y,w,h};
  mapViewport={key:box,base,view:base};setMapView(base);
}
function drawDestinations(world){
  const layer=$("map-landscape");
  const doors=[...world.stations,{...world.museum.outsideDoor,name:"전시관 입구"}];
  for(const point of doors){
    svg(layer,"circle",{cx:point.x,cy:point.y,r:2.6,fill:"#f1d8a6",stroke:"#513e32","stroke-width":.9});
    svg(layer,"text",{x:point.x,y:point.y-4.6,class:"map-label","text-anchor":"middle",style:"font-size:8.5px;stroke-width:2.2px"},point.name);
  }
}
function updateMaps(self,others){
  const indoors=isInsideMuseum(self.x,self.y),palace=inGyeongbok(self.x,self.y),plaza=inGwanghwamunPlaza(self.x,self.y);
  const corridor=outdoorMap(self)==="세종대로",overview=overviewOpen&&!indoors;
  const mapArea=palace?"경복궁":plaza||corridor&&self.y<-58?"광화문광장":"덕수궁";
  setText($("map-panel").querySelector("h2"),indoors?"전시관 지도":overview?"전체 지도":mapArea+" 지도");
  $("world").classList.toggle("overview-map",overview);
  attr(overviewLayer,"visibility",overview?"visible":"hidden");
  overviewButton.hidden=indoors;
  attr($("my-avatar"),"transform","translate("+self.x+" "+self.y+")"+(indoors?" scale(.18)":overview?" scale(2.8)":palace?" scale(2.2)":plaza||corridor?" scale(1.55)":""));
  const coat=hexCoat(self.coat??0xe5b672);
  const parked=self.bike?.parked,parkedPin=$("parked-bike-pin");
  attr(parkedPin,"visibility",parked&&!indoors?"visible":"hidden");
  if(parked){
    attr(parkedPin,"cx",parked.x);attr(parkedPin,"cy",parked.y);
    attr(parkedPin,"data-walk-x",parked.x);attr(parkedPin,"data-walk-y",parked.y);
    attr(parkedPin,"r",overview?16:palace?10:6);
  }
  $("my-avatar").querySelector("circle").style.fill=coat;
  attr($("mini-my"),"fill",coat);
  attr($("mini-my"),"transform","translate("+self.x+" "+self.y+") rotate("+self.heading+")"+(indoors?" scale(.47)":""));
  for(const map of museumMaps)attr(map,"visibility",indoors?"visible":"hidden");
  $("world").classList.toggle("museum-map",indoors);
  $("mini-world").classList.toggle("museum-map",indoors);
  showMapRegion(indoors?museumViewBox:overview?fieldViewBox:palace?gyeongbokViewBox:plaza?plazaViewBox:
    corridor&&self.y<28?self.y<-58?plazaApproachBox:southApproachBox:southViewBox);
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
    attr(mark.big,"r",indoors?1.45:overview?20:palace?17:plaza||corridor?12:8);
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
drawMap($("map-landscape"));overviewLayer=drawOverview($("map-landscape"));
drawMap($("mini-landscape"),true);applyNight(ownView);
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
