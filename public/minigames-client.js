import {
  atMinigameLane,atTuhoLine,JEGI_KICK_COOLDOWN,MINIGAME_PICKUP_REACH,jegiNextCount,kiteFlying,
  minigamePickup,nearbyMinigame,tuhoScores
} from "./traditional-games.js";
import {isCycling} from "./sejong-bike.js";

const token=()=>crypto.randomUUID().replaceAll("-","");
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
const chargeMs=960;
const restPower=50;
const control="input,textarea,select,[contenteditable],button,a,summary,dialog";

export function makeMinigames({send,now,self,focusGame,getAvatar,getView,mount}){
  const button=document.createElement("button");
  button.type="button";button.className="primary free-play-action";button.hidden=true;
  button.dataset.nativeTouch="";
  button.setAttribute("aria-keyshortcuts","Space");
  button.innerHTML=`<span data-free-label></span><small data-arrows></small><i aria-hidden="true"></i>`;
  const kiteControls=document.createElement("div");
  kiteControls.className="kite-controls";kiteControls.hidden=true;
  kiteControls.setAttribute("role","group");kiteControls.setAttribute("aria-label","연줄 조작");
  kiteControls.innerHTML=`
    <button class="quiet" type="button" data-rope="unspool" data-native-touch aria-keyshortcuts="Space Enter">줄 풀기</button>
    <button class="quiet" type="button" data-rope="reel" data-native-touch aria-keyshortcuts="Space Enter">줄 당기기</button>
    <button class="quiet" type="button" data-cut data-native-touch>연 끊기</button>`;
  mount.querySelector(".game-hud").append(button,kiteControls);
  const label=button.querySelector("[data-free-label]"),arrowCount=button.querySelector("[data-arrows]");
  const ropeButtons=[...kiteControls.querySelectorAll("[data-rope]")],cutButton=kiteControls.querySelector("[data-cut]");
  let rounds=[],freeStates=[],venue=null,pending=null,animation=0,shot=null;
  let charge=null,keyboardAction=false,landOnExit=false,ropeWanted=null,ropeInput=null;
  const connected=()=>navigator.onLine!==false;
  const ownRecord=game=>freeStates.find(event=>event.game===game&&event.player===self());
  const arrows=()=>ownRecord("tuho")?.arrows??0;
  const ownKiteFlying=()=>kiteFlying(ownRecord("kite"));
  const cameraAngle=()=>{
    const pan=getView()?.pan;
    return Number.isFinite(pan)?Math.round(((pan%360+540)%360)-180):0;
  };
  const canStay=point=>Boolean(point&&!point.bus&&!isCycling(point)&&nearbyMinigame(point)?.id===venue?.id);

  function freeState(){
    const avatar=getAvatar(),tuho=venue.id==="tuho",canAct=canStay(avatar)&&avatar.seat==null;
    const online=connected(),ready=canAct&&online&&!pending;
    const inventory=tuho?arrows():0;
    const lane=canAct&&(tuho?atTuhoLine(venue,avatar):venue.id==="jegi"?atMinigameLane(venue,avatar):true);
    const pickupPoint=tuho&&!inventory&&minigamePickup(venue);
    const pickup=Boolean(canAct&&pickupPoint&&Math.hypot(avatar.x-pickupPoint.x,avatar.y-pickupPoint.y)<=MINIGAME_PICKUP_REACH);
    return {avatar,tuho,online,inventory,lane,pickup,canHit:ready&&lane&&(!tuho||inventory>0)};
  }
  function chargePower(time){return charge?Math.min(100,Math.max(0,Math.round((time-charge.at)*100/chargeMs))):0;}

  function update(time){
    const {tuho,online,inventory,lane,pickup,canHit}=freeState();
    if(charge&&!canHit)charge=null;
    const busy=pending?.game===venue.id?pending.action:null;
    const flying=venue.id==="kite"&&ownKiteFlying()&&!landOnExit;
    button.hidden=flying;kiteControls.hidden=!flying;
    for(const ropeButton of ropeButtons){
      ropeButton.disabled=!online||busy==="cut";
      ropeButton.setAttribute("aria-pressed",String(ropeInput?.action===ropeButton.dataset.rope));
    }
    cutButton.disabled=!online||busy==="cut";
    button.disabled=!(canHit||pickup&&online&&!pending);
    if(tuho&&canHit)button.setAttribute("aria-pressed",String(Boolean(charge)));
    else button.removeAttribute("aria-pressed");
    button.style.setProperty("--tuho-charge",chargePower(time)+"%");
    setText(arrowCount,tuho?"화살 "+inventory+"개":"");
    if(!online){setText(label,"연결 대기");return;}
    if(tuho){
      setText(label,busy==="collect"?"화살 받는 중":busy==="throw"?"화살 던지는 중":pickup?"화살 받기":
        !inventory?"화살통으로 이동":!lane?"던지는 선으로 이동":charge?"놓아서 던지기":"꾹 눌러 던지기");
    }else if(venue.id==="jegi"){
      setText(label,lane?"제기차기":"제기차기 자리로 이동");
    }else{
      setText(label,busy==="fly"?"연 띄우는 중":"연 띄우기");
    }
  }

  function tick(){
    if(!venue){animation=0;return;}
    if(!canStay(getAvatar())){close();return;}
    update(now());animation=requestAnimationFrame(tick);
  }

  function submit(action,game,details={}){
    if(pending||!connected())return null;
    const command={id:token(),game,action,...details};
    pending=command;
    if(send(command)===false){pending=null;return null;}
    return command;
  }

  function collect(){
    const {avatar,pickup}=freeState();
    if(pickup)submit("collect",venue.id,{x:avatar.x,y:avatar.y,at:Math.round(now())});
  }

  function actFree(power=0){
    const {avatar,tuho,canHit}=freeState();
    if(!canHit)return;
    const {x,y}=avatar,at=Math.round(now());
    if(venue.id==="kite"){
      if(!ownKiteFlying())submit("fly",venue.id,{x,y});
      update(at);return;
    }
    const previous=ownRecord(venue.id),angle=tuho?cameraAngle():0;
    if(!tuho&&previous&&at-previous.at<JEGI_KICK_COOLDOWN)return;
    const details=tuho?{x,y,at,angle,power}:{x,y,at};
    const command=submit(tuho?"throw":"kick",venue.id,details);
    if(!command)return;
    const count=tuho?(previous?.count??0)+Number(tuhoScores(venue,avatar,angle,power)):jegiNextCount(previous,avatar,at);
    shot={...command,player:self(),count,points:tuho?count-(previous?.count??0):Number(count>0),arrows:tuho?arrows()-1:0};
    update(at);
  }

  function beginAction(source){
    if(!venue)return false;
    const {canHit,tuho}=freeState();
    if(!canHit||charge)return false;
    if(!tuho){actFree();return true;}
    const time=now();charge={source,at:time};update(time);return true;
  }
  function finishAction(source,activate){
    if(charge?.source!==source)return;
    const power=chargePower(now());charge=null;
    if(activate&&venue?.id==="tuho")actFree(power);
  }
  function startRope(action,source){
    if(ropeInput||venue?.id!=="kite"||!ownKiteFlying()||!connected()||!canStay(getAvatar()))return false;
    ropeInput={source,action};ropeWanted=action;flushKite();update(now());return true;
  }
  function finishRope(source){
    if(!ropeInput||ropeInput.source!==source)return false;
    ropeInput=null;ropeWanted="hold";flushKite();
    if(venue)update(now());
    return true;
  }
  for(const ropeButton of ropeButtons){
    ropeButton.addEventListener("pointerdown",event=>{
      if(event.button!==0||!startRope(ropeButton.dataset.rope,event.pointerId))return;
      event.preventDefault();event.stopPropagation();ropeButton.setPointerCapture(event.pointerId);
    });
    for(const type of ["pointerup","pointercancel","lostpointercapture"])
      ropeButton.addEventListener(type,event=>finishRope(event.pointerId));
  }
  cutButton.addEventListener("click",()=>{
    if(venue?.id!=="kite"||!ownKiteFlying()||!connected())return;
    ropeInput=null;ropeWanted="cut";flushKite();update(now());focusGame?.();
  });
  button.addEventListener("pointerdown",event=>{
    if(event.button!==0||!venue||venue.id==="kite"||!beginAction(event.pointerId))return;
    event.preventDefault();event.stopPropagation();
    if(venue.id==="tuho")button.setPointerCapture(event.pointerId);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])
    button.addEventListener(type,event=>finishAction(event.pointerId,type==="pointerup"));
  button.addEventListener("click",event=>{
    if(!venue)return;
    if(venue.id==="kite"){actFree();return;}
    if(freeState().pickup){collect();update(now());focusGame?.();}
    else if(event.detail===0&&!event.sourceCapabilities?.firesTouchEvents)actFree(venue.id==="tuho"?restPower:0);
  });
  document.addEventListener("keydown",event=>{
    if(!venue||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==="Escape"&&mount.contains(event.target)){
      event.preventDefault();event.stopPropagation();close(true);return;
    }
    if((event.code==="Space"||event.code==="Enter")&&ropeButtons.includes(event.target)){
      event.preventDefault();event.stopPropagation();
      if(!event.repeat)startRope(event.target.dataset.rope,event.code);
      return;
    }
    if(event.code!=="Space"||event.target!==button&&event.target.closest?.(control)||venue.id==="kite"&&ownKiteFlying())return;
    const {tuho,inventory,lane}=freeState();
    if(!lane||tuho&&!inventory)return;
    event.preventDefault();event.stopPropagation();
    if(!event.repeat){keyboardAction=true;beginAction("keyboard");}
  },true);
  document.addEventListener("keyup",event=>{
    if(finishRope(event.code)){event.preventDefault();event.stopPropagation();return;}
    if(event.code!=="Space"||!keyboardAction)return;
    keyboardAction=false;event.preventDefault();event.stopPropagation();
    finishAction("keyboard",event.target===button||!event.target.closest?.(control));
  },true);
  window.addEventListener("blur",()=>{
    charge=null;keyboardAction=false;
    if(ropeInput)finishRope(ropeInput.source);
  });

  function flushKite(){
    if(pending||!connected())return;
    if(landOnExit){
      if(ownKiteFlying())submit("land","kite");
      else landOnExit=false;
      return;
    }
    if(!ropeWanted)return;
    if(!ownKiteFlying()){ropeWanted=ropeInput=null;return;}
    const action=ropeWanted,avatar=getAvatar();
    const moving=action==="unspool"||action==="reel";
    if(moving&&!canStay(avatar))return;
    if(submit(action,"kite",moving?{x:avatar.x,y:avatar.y}:{}))ropeWanted=null;
  }
  function close(restoreFocus=button===document.activeElement||kiteControls.contains(document.activeElement)){
    if(!venue)return;
    if(venue.id==="kite"&&(ownKiteFlying()||pending?.game==="kite"&&pending.action==="fly"))landOnExit=true;
    venue=charge=ropeWanted=ropeInput=null;keyboardAction=false;button.hidden=kiteControls.hidden=true;
    cancelAnimationFrame(animation);animation=0;
    flushKite();if(restoreFocus)focusGame?.();
  }

  function receive(snapshot,sent,result,freeplay=[]){
    rounds=snapshot;freeStates=freeplay;
    if(sent&&pending?.id===sent.id){
      pending=null;
      if(shot?.id===sent.id)shot=null;
      if(sent.action==="land"&&result==="accepted")landOnExit=false;
    }
    flushKite();
    if(venue)update(now());
  }
  function open(point){
    const nearby=nearbyMinigame(point);
    if(!nearby||venue||!mount.isConnected)return false;
    venue=nearby;charge=null;
    button.dataset.game=venue.id;arrowCount.hidden=venue.id!=="tuho";button.hidden=false;
    focusGame?.();
    if(venue.id==="tuho")collect();
    if(venue.id==="kite"&&!ownKiteFlying())actFree();
    tick();return Boolean(venue);
  }
  function reset(){
    venue=pending=shot=charge=ropeWanted=ropeInput=null;rounds=[];freeStates=[];keyboardAction=landOnExit=false;
    cancelAnimationFrame(animation);animation=0;button.hidden=kiteControls.hidden=true;
  }
  function aimPreview(){
    if(venue?.id!=="tuho")return null;
    const {avatar,inventory,lane}=freeState();
    if(!inventory||!lane)return null;
    return {x:avatar.x,y:avatar.y,angle:cameraAngle(),power:charge?chargePower(now()):restPower};
  }
  function visibleFreeStates(){
    if(!landOnExit&&pending?.action!=="land")return freeStates;
    return freeStates.filter(event=>event.game!=="kite"||event.player!==self());
  }
  return {
    nearby:nearbyMinigame,open,receive,reset,arrows,aimPreview,
    active:()=>venue,states:()=>rounds,freeStates:visibleFreeStates,localAction:()=>shot
  };
}
