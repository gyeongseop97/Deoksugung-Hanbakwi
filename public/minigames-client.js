import {
  atMinigameLane,atTuhoLine,JEGI_KICK_COOLDOWN,MINIGAME_PICKUP_REACH,TUHO_ANGLE_LIMIT,jegiNextCount,
  minigameAim,minigameDuration,minigameFrame,minigamePickup,minigamePoints,nearbyMinigame,tuhoScores
} from "./traditional-games.js";
import {isCycling} from "./sejong-bike.js";

const token=()=>crypto.randomUUID().replaceAll("-","");
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
const chargeMs=960;
const angleStep=5;
const freePlay=game=>game.id!=="kite";
const timeLeft=ms=>{
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
};

export function makeMinigames({send,now,self,focusGame,getAvatar,mount}){
  const hud=document.createElement("section");
  hud.className="minigame-hud";hud.setAttribute("aria-labelledby","minigame-title");hud.hidden=true;
  hud.innerHTML=`
    <header class="minigame-header">
      <h2 id="minigame-title"></h2>
      <span data-timer></span>
      <button type="button" class="quiet minigame-close" data-close aria-label="민속놀이 나가기">×</button>
    </header>
    <p class="minigame-hint" data-hint></p>
    <div class="minigame-info"><strong data-stage></strong><span data-score></span></div>
    <div class="minigame-power" data-charge-meter hidden>
      <span data-power-value></span>
      <div class="minigame-power-track" aria-hidden="true"><i data-power-fill></i></div>
      <span data-target-value></span>
    </div>
    <div class="minigame-controls">
      <button type="button" class="primary" data-main>새 판 시작</button>
      <button type="button" class="quiet minigame-angle" data-aim-left aria-label="조준 방향 왼쪽으로" aria-keyshortcuts="Q" hidden>←</button>
      <button type="button" class="primary" data-action data-native-touch hidden><span data-action-label></span><kbd>Space</kbd></button>
      <button type="button" class="quiet minigame-angle" data-aim-right aria-label="조준 방향 오른쪽으로" aria-keyshortcuts="R" hidden>→</button>
      <details class="minigame-scoreboard" data-board hidden>
        <summary>방 점수</summary><ol data-players data-scroll-actions></ol>
      </details>
    </div>
    <p class="minigame-feedback" role="status" data-feedback hidden></p>`;
  mount.append(hud);
  const node=selector=>hud.querySelector(selector);
  const title=node("h2"),hint=node("[data-hint]"),stage=node("[data-stage]"),timer=node("[data-timer]"),score=node("[data-score]");
  const main=node("[data-main]"),action=node("[data-action]"),actionLabel=node("[data-action-label]"),meter=node("[data-charge-meter]");
  const powerLabel=node("[data-power-value]"),targetLabel=node("[data-target-value]"),powerFill=node("[data-power-fill]");
  const feedback=node("[data-feedback]"),board=node("[data-board]"),players=node("[data-players]");
  const aimLeft=node("[data-aim-left]"),aimRight=node("[data-aim-right]");
  let games=new Map(),rounds=[],freeStates=[],venue=null,pending=null,withdrawal=null,animation=0,shot=null;
  let charge=null,angle=0,boardKey="",boardRound=null,message="",keyboardAction=false;
  const roundAt=()=>venue&&games.get(venue.id);
  const activeSelf=round=>Boolean(round?.self&&!round.self.withdrawn);
  const connected=()=>navigator.onLine!==false;
  const ownRecord=game=>freeStates.find(event=>event.game===game&&event.player===self());
  const arrows=()=>ownRecord("tuho")?.arrows??0;

  function atBarrel(game,point){
    const pickup=minigamePickup(game);
    return Boolean(pickup&&point&&Math.hypot(point.x-pickup.x,point.y-pickup.y)<=MINIGAME_PICKUP_REACH);
  }

  function freeState(){
    const avatar=getAvatar(),tuho=venue.id==="tuho",inField=canStay(avatar),online=connected();
    const canAct=inField&&avatar.seat==null,ready=canAct&&online&&!pending;
    const inventory=tuho?arrows():0,atLine=tuho&&canAct&&atTuhoLine(venue,avatar);
    const lane=tuho?atLine:canAct&&atMinigameLane(venue,avatar);
    const pickup=tuho&&canAct&&!inventory&&atBarrel(venue,avatar);
    return {avatar,tuho,online,inventory,atLine,lane,pickup,canHit:ready&&lane&&(!tuho||inventory>0)};
  }

  function playState(time){
    const avatar=getAvatar(),round=roundAt(),frame=venue&&minigameFrame(venue,round,time);
    const participant=activeSelf(round),online=connected(),lane=Boolean(venue&&avatar&&atMinigameLane(venue,avatar));
    const done=Boolean(frame&&round.self?.hits?.some(hit=>hit.beat===frame.beat));
    const playing=Boolean(frame&&participant);
    return {avatar,round,frame,participant,online,lane,done,playing,
      canHit:Boolean(playing&&lane&&online&&!done&&!pending&&avatar.seat==null&&!avatar.bus&&!isCycling(avatar))};
  }
  function chargePower(time){return charge?Math.min(100,Math.max(0,Math.round((time-charge.at)*100/chargeMs))):0;}

  function scores(round){
    const key=round?JSON.stringify([round.id,round.players,self()]):"";
    if(boardKey===key)return;
    boardKey=key;players.replaceChildren();board.hidden=!round?.players.length;
    if(board.hidden)board.open=false;
    for(const person of round?.players??[]){
      const line=document.createElement("li"),name=document.createElement("span"),points=document.createElement("strong");
      setText(name,person.nickname+(person.id===self()?" · 나":"")+(person.withdrawn?" · 중단":person.online?"":" · 연결 끊김"));
      setText(points,person.score+"점");line.append(name,points);players.append(line);
    }
  }

  function updateFree(time){
    const {tuho,online,inventory,atLine,lane,pickup,canHit}=freeState();
    if(charge&&!canHit)charge=null;
    const aiming=tuho&&inventory>0&&atLine,power=chargePower(time);
    main.hidden=!pickup;main.disabled=!online||Boolean(pending);setText(main,"화살 10개 받기");
    action.hidden=tuho&&!aiming;action.disabled=!canHit;
    setText(actionLabel,pending?.game===venue.id?"확인 중":charge?"놓아서 던지기":venue.action);
    action.setAttribute("aria-pressed",String(Boolean(charge)));
    aimLeft.hidden=aimRight.hidden=!aiming;
    aimLeft.disabled=angle<=-TUHO_ANGLE_LIMIT;aimRight.disabled=angle>=TUHO_ANGLE_LIMIT;
    meter.hidden=!aiming;
    if(!meter.hidden){
      setText(powerLabel,"힘 "+power+"%");
      setText(targetLabel,angle<0?"왼쪽 "+(-angle)+"°":angle>0?"오른쪽 "+angle+"°":"정면 0°");
      powerFill.style.width=power+"%";
    }
    setText(hint,tuho?pickup?"화살통에서 화살을 챙겨요.":!inventory?"화살통으로 가서 화살을 챙기세요.":
      !atLine?"화살을 들고 바닥의 던지는 선으로 이동하세요.":"각도를 맞추고 던지기를 눌렀다 떼세요.":
      lane?"제기가 발 앞에 오면 다시 차세요.":"바닥의 제기차기 표시로 이동하세요.");
    setText(timer,tuho?"화살 "+inventory+"개":"");
    setText(stage,"");setText(score,"");hud.classList.remove("outside-lane");
    board.hidden=true;board.open=false;
  }

  function updateTimed(time){
    const {round,frame,participant,online,lane,done,playing,canHit}=playState(time);
    const lobby=round&&time<round.startsAt,ended=round&&time>=round.endsAt;
    const trying=Boolean(pending?.action==="hit"&&pending.game===venue.id&&pending.beat===frame?.beat);
    main.hidden=Boolean(frame);
    main.disabled=Boolean(pending||!online||lobby&&participant);
    setText(main,lobby?participant?"참가 완료":"참가하기":"새 판 시작");
    action.hidden=!playing;action.disabled=!canHit;
    setText(actionLabel,trying?"점수 확인 중":done?"다음 차례 대기":venue.action);
    action.setAttribute("aria-pressed","false");
    meter.hidden=aimLeft.hidden=aimRight.hidden=true;
    setText(hint,playing&&!lane?"아바타를 바닥에 표시된 놀이 구역으로 옮겨 주세요.":venue.hint);
    hud.classList.toggle("outside-lane",playing&&!lane);
    setText(stage,lobby?round.count+"명 준비 중":frame?participant?(frame.beat+1)+" / "+venue.beats:"관전 중":ended?"경기 종료":"");
    setText(timer,lobby?Math.ceil((round.startsAt-time)/1000)+"초 후 시작":frame?"남은 "+timeLeft(round.endsAt-time):
      "한 판 "+timeLeft(minigameDuration(venue)));
    setText(score,participant? "내 점수 "+round.self.score+"점":"");
    if(boardRound!==round){boardRound=round;scores(round);}
  }

  function update(time){
    if(freePlay(venue))updateFree(time);
    else updateTimed(time);
    const notice=!connected()?"연결이 돌아오면 다시 참여할 수 있어요.":
      pending&&time-pending.sentAt>2000?"산책방에 다시 연결 중이에요.":message;
    setText(feedback,notice);feedback.hidden=!notice;
  }

  function canStay(point){
    return point&&!point.bus&&!isCycling(point)&&nearbyMinigame(point)?.id===venue.id;
  }
  function tick(){
    if(!venue){animation=0;return;}
    if(!canStay(getAvatar())){close();return;}
    update(now());animation=requestAnimationFrame(tick);
  }

  function submit(action,game,round,details={}){
    if(pending||!connected())return null;
    const command={id:token(),game,action,...(round?{round}:{}),...details};
    pending={...command,sentAt:now()};
    if(send(command)===false){pending=null;return null;}
    return command;
  }

  function hit(){
    if(!venue)return;
    const time=Math.round(now()),{avatar,round,frame,canHit}=playState(time);
    if(!canHit)return;
    const move=frame.move??0,aim=minigameAim(venue,avatar),power=0,{x,y}=avatar;
    const command=submit("hit",venue.id,round.id,{beat:frame.beat,at:time,move,aim,power,x,y});
    if(!command)return;
    shot={game:venue.id,round:round.id,player:self(),id:command.id,at:time,beat:frame.beat,move,aim,power,
      points:minigamePoints(venue,round,time,move,aim,power),x,y};
    message="점수를 확인하고 있어요.";update(time);
  }

  function collect(){
    const {avatar,pickup}=freeState();
    if(pickup&&submit("collect",venue.id,null,{x:avatar.x,y:avatar.y,at:Math.round(now())})){
      message="화살을 챙기는 중이에요.";
    }
  }
  function actFree(power=0){
    const {avatar,tuho,canHit}=freeState();
    if(!canHit)return;
    const {x,y}=avatar,at=Math.round(now()),previous=ownRecord(venue.id);
    if(!tuho&&previous&&at-previous.at<JEGI_KICK_COOLDOWN)return;
    const details=tuho?{x,y,at,angle,power}:{x,y,at};
    const command=submit(tuho?"throw":"kick",venue.id,null,details);
    if(!command)return;
    const count=tuho?(previous?.count??0)+Number(tuhoScores(venue,avatar,angle,power)):jegiNextCount(previous,avatar,at);
    shot={...command,player:self(),count,points:tuho?count-(previous?.count??0):Number(count>0),arrows:tuho?arrows()-1:0};
    message="";update(at);
  }
  function beginAction(source){
    if(!venue)return false;
    if(freePlay(venue)){
      const {canHit,tuho}=freeState();
      if(!canHit||charge)return false;
      if(!tuho){actFree();return true;}
      charge={source,at:now()};update(now());return true;
    }
    const time=now(),{round,frame,canHit}=playState(time);
    if(!canHit)return false;
    hit();return true;
  }
  function finishAction(source,activate){
    if(charge?.source!==source)return;
    const power=chargePower(now());charge=null;
    if(activate&&venue?.id==="tuho")actFree(power);
  }

  main.addEventListener("click",()=>{
    if(!venue||!canStay(getAvatar()))return;
    if(freePlay(venue)){collect();update(now());focusGame?.();return;}
    const round=roundAt(),time=now();
    if(!round||time>=round.endsAt){if(submit("start",venue.id))message="새 판을 열고 있어요.";}
    else if(time<round.startsAt){if(submit("join",venue.id,round.id))message="참가를 확인하고 있어요.";}
    update(time);focusGame?.();
  });
  action.addEventListener("pointerdown",event=>{
    if(event.button!==0||!beginAction(event.pointerId))return;
    event.stopPropagation();event.preventDefault();
    if(venue.id==="tuho")action.setPointerCapture(event.pointerId);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])
    action.addEventListener(type,event=>finishAction(event.pointerId,type==="pointerup"));
  action.addEventListener("click",event=>{
    if(event.detail!==0||event.sourceCapabilities?.firesTouchEvents||!venue)return;
    if(freePlay(venue))actFree(venue.id==="tuho"?50:0);
    else hit();
  });
  function turnAim(step){
    if(venue?.id!=="tuho")return;
    const {atLine,inventory}=freeState();
    if(!atLine||!inventory)return;
    angle=Math.max(-TUHO_ANGLE_LIMIT,Math.min(TUHO_ANGLE_LIMIT,angle+step));update(now());
  }
  aimLeft.addEventListener("click",()=>turnAim(-angleStep));aimRight.addEventListener("click",()=>turnAim(angleStep));
  const control="input,textarea,select,[contenteditable],button,a,summary,dialog";
  document.addEventListener("keydown",event=>{
    if(!venue||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==="Escape"&&mount.contains(event.target)&&!event.target.closest?.("dialog")){
      event.preventDefault();event.stopPropagation();close(true);return;
    }
    if(event.target!==action&&event.target.closest?.(control))return;
    if(venue.id==="tuho"&&!aimLeft.hidden&&(event.code==="KeyQ"||event.code==="KeyR")){
      event.preventDefault();event.stopPropagation();turnAim(event.code==="KeyQ"?-angleStep:angleStep);return;
    }
    if(event.code!=="Space"||(freePlay(venue)?action.hidden:!playState(now()).playing))return;
    event.preventDefault();event.stopPropagation();
    if(!event.repeat){keyboardAction=true;beginAction("keyboard");}
  },true);
  document.addEventListener("keyup",event=>{
    if(event.code!=="Space"||!keyboardAction)return;
    keyboardAction=false;event.preventDefault();event.stopPropagation();
    finishAction("keyboard",event.target===action||!event.target.closest?.(control));
  },true);
  window.addEventListener("blur",()=>{charge=null;keyboardAction=false;});

  function flushWithdrawal(){
    if(!withdrawal||pending||!connected())return;
    const {game,round}=withdrawal,latest=games.get(game);
    withdrawal=null;
    if(latest?.id===round&&activeSelf(latest)&&now()<latest.endsAt)submit("leave",game,round);
  }
  function close(restoreFocus=hud.contains(document.activeElement)){
    if(!venue)return;
    const round=freePlay(venue)?null:roundAt();
    if(activeSelf(round)&&now()<round.endsAt)withdrawal={game:venue.id,round:round.id};
    else if(pending?.game===venue.id&&["start","join"].includes(pending.action)){
      withdrawal={game:venue.id,round:pending.action==="start"?pending.id:pending.round};
    }
    venue=charge=null;keyboardAction=false;hud.hidden=true;board.open=false;
    cancelAnimationFrame(animation);animation=0;
    flushWithdrawal();if(restoreFocus)focusGame?.();
  }
  node("[data-close]").addEventListener("click",()=>close(true));

  function receive(snapshot,sent,result,freeplay=[]){
    rounds=snapshot;games=new Map(rounds.map(round=>[round.game,round]));
    freeStates=freeplay;
    if(sent&&pending?.id===sent.id){
      pending=null;
      const round=games.get(sent.game),accepted=result==="accepted";
      const hit=accepted&&sent.action==="hit"?round?.self?.hits.find(item=>item.beat===sent.beat):null;
      if(shot?.id===sent.id){
        if(hit)shot={...shot,points:hit.points};
        else shot=null;
      }
      if(venue?.id===sent.game){
        if(freePlay(venue))message=!accepted?"놀이 구역에서 다시 시도해 주세요.":
          sent.action==="collect"?"화살을 챙겼어요. 던지는 선으로 이동하세요.":"";
        else if(!accepted)message=sent.action==="start"&&round&&now()<round.startsAt?
          "친구가 먼저 판을 열었어요. 참가하기를 눌러 주세요.":"시간이 지났거나 놀이 구역을 벗어났어요.";
        else if(sent.action==="hit")message=hit?.points===3?"정확해요 · +3점":hit?.points===1?"좋아요 · +1점":"이번에는 놓쳤어요.";
        else message="같은 방 친구도 시작 전에 참여할 수 있어요.";
      }
    }
    flushWithdrawal();
    if(venue)update(now());
  }
  function open(point){
    const nearby=nearbyMinigame(point);
    if(!nearby||venue||!mount.isConnected)return false;
    venue=nearby;charge=null;angle=0;boardRound=null;boardKey="";message="";
    players.replaceChildren();board.hidden=true;hud.hidden=false;
    setText(title,venue.name);focusGame?.();
    if(venue.id==="tuho")collect();
    tick();return Boolean(venue);
  }
  function reset(){
    venue=pending=withdrawal=shot=charge=null;games.clear();rounds=[];boardRound=null;keyboardAction=false;
    freeStates=[];
    cancelAnimationFrame(animation);animation=0;hud.hidden=true;board.open=false;
  }
  function aimPreview(){
    if(venue?.id!=="tuho")return null;
    const {avatar,inventory,atLine}=freeState();
    if(!inventory||!atLine)return null;
    return {x:avatar.x,y:avatar.y,angle,power:chargePower(now())};
  }
  return {
    nearby:nearbyMinigame,open,receive,reset,arrows,aimPreview,
    active:()=>venue,states:()=>rounds,freeStates:()=>freeStates,localAction:()=>shot
  };
}
