import {minigameDuration,minigameFrame,minigamePoints,nearbyMinigame} from "./traditional-games.js";
import {makeMinigameScene} from "./minigame-scenes.js";

const token=()=>crypto.randomUUID().replaceAll("-","");
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
const timeLeft=ms=>{
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
};

export function makeMinigames({send,now,self,focusGame}){
  const dialog=document.createElement("dialog");
  dialog.className="minigame-dialog";dialog.setAttribute("aria-labelledby","minigame-title");
  dialog.innerHTML=`
    <header class="minigame-header">
      <div><span data-place></span><h2 id="minigame-title"></h2></div>
      <button type="button" class="quiet minigame-close" data-close aria-label="닫기">×</button>
    </header>
    <p class="minigame-hint" data-hint></p>
    <div class="minigame-info"><strong data-stage></strong><span data-timer></span><span data-score></span></div>
    <canvas width="640" height="292" data-scene tabindex="0" aria-label="민속놀이 타이밍 화면"></canvas>
    <div class="minigame-controls">
      <button type="button" class="primary" data-main>새 판 시작</button>
      <button type="button" class="primary" data-left hidden>← 왼쪽 줄 당기기</button>
      <button type="button" class="primary" data-right hidden>오른쪽 줄 당기기 →</button>
    </div>
    <p class="minigame-feedback" role="status" data-feedback></p>
    <div class="minigame-scoreboard" data-board hidden><h3>같은 방 점수</h3><ol data-players></ol></div>`;
  document.body.append(dialog);
  const node=selector=>dialog.querySelector(selector),canvas=node("[data-scene]"),paint=makeMinigameScene(canvas);
  const place=node("[data-place]"),title=node("h2"),hint=node("[data-hint]"),stage=node("[data-stage]"),timer=node("[data-timer]"),score=node("[data-score]");
  const main=node("[data-main]"),left=node("[data-left]"),right=node("[data-right]"),feedback=node("[data-feedback]"),board=node("[data-board]"),players=node("[data-players]");
  let games=new Map(),venue=null,pending=null,withdrawal=null,animation=0,shot=null,boardKey="",boardRound=null,wasOffline=false;
  const roundAt=()=>venue&&games.get(venue.id);
  const activeSelf=round=>Boolean(round?.self&&!round.self.withdrawn);
  const connected=()=>navigator.onLine!==false;

  function scores(round){
    const key=round?JSON.stringify([round.id,round.players,self()]):"";
    if(boardKey===key)return;
    boardKey=key;players.replaceChildren();board.hidden=!round?.players.length;
    for(const person of round?.players??[]){
      const line=document.createElement("li"),name=document.createElement("span"),points=document.createElement("strong");
      name.textContent=person.nickname+(person.id===self()?" · 나":"")+(person.withdrawn?" · 중단":person.online?"":" · 연결 끊김");
      points.textContent=`${person.score}점`;line.append(name,points);players.append(line);
    }
  }

  function update(time){
    const round=roundAt(),frame=minigameFrame(venue,round,time),participant=activeSelf(round);
    const lobby=round&&time<round.startsAt,ended=round&&time>=round.endsAt;
    const done=frame&&round.self?.hits.some(hit=>hit.beat===frame.beat);
    const online=connected(),canHit=Boolean(frame&&participant&&!done&&!pending&&online);
    const arrows=Boolean(frame&&venue.id==="kite");
    const trying=Boolean(pending&&pending.action==="hit"&&pending.game===venue.id&&pending.beat===frame?.beat);
    main.hidden=arrows;left.hidden=right.hidden=!arrows;
    left.disabled=right.disabled=!canHit;
    main.disabled=Boolean(pending||!online||(lobby?participant:frame&&!canHit));
    setText(main,frame?trying?"점수 확인 중":done?"다음 차례 대기":participant?venue.action??"줄 당기기":"관전 중":
      lobby?participant?"참가 완료":"참가하기":"새 판 시작");
    setText(stage,lobby?`${round.count}명 준비 중`:frame?participant?`${frame.beat+1} / ${venue.beats}`:"관전 중":ended?"경기 종료":"혼자 또는 같은 방 친구와 함께");
    setText(timer,lobby?`시작까지 ${Math.ceil((round.startsAt-time)/1000)}초`:frame?`남은 시간 ${timeLeft(round.endsAt-time)}`:
      `한 판 ${timeLeft(minigameDuration(venue))}`);
    setText(score,participant||ended&&round?.self?`내 점수 ${round.self.score}점`:"");
    if(boardRound!==round){boardRound=round;scores(round);}
    if(!online)setText(feedback,"연결이 돌아오면 다시 참여할 수 있어요.");
    else if(pending&&time-pending.sentAt>2000)setText(feedback,"산책방에 다시 연결 중이에요.");
    else if(wasOffline)setText(feedback,"");
    wasOffline=!online;
    paint(venue,frame,shot,time);
  }

  function tick(){
    if(!dialog.open||!venue){animation=0;return;}
    update(now());animation=requestAnimationFrame(tick);
  }

  function submit(action,game,round,details={}){
    if(pending||!connected())return false;
    const command={id:token(),game,action,...(round?{round}:{}),...details};
    pending={...command,sentAt:now()};
    if(send(command)===false){pending=null;return false;}
    return true;
  }

  function hit(move){
    if(!dialog.open||!venue)return;
    const round=roundAt(),time=Math.round(now()),frame=minigameFrame(venue,round,time);
    if(!frame||!activeSelf(round)||round.self.hits.some(result=>result.beat===frame.beat))return;
    if(submit("hit",venue.id,round.id,{beat:frame.beat,at:time,move})){
      shot={at:time,move,points:minigamePoints(venue,round,time,move)};
      setText(feedback,"점수를 확인하고 있어요.");update(time);
    }
  }

  main.addEventListener("click",()=>{
    if(!venue)return;
    const round=roundAt(),time=now();
    if(!round||time>=round.endsAt){if(submit("start",venue.id))setText(feedback,"새 판을 열고 있어요.");}
    else if(time<round.startsAt){if(submit("join",venue.id,round.id))setText(feedback,"참가를 확인하고 있어요.");}
    else hit(0);
    update(time);
  });
  left.addEventListener("click",()=>hit(-1));right.addEventListener("click",()=>hit(1));
  canvas.addEventListener("click",event=>{
    const bounds=canvas.getBoundingClientRect();
    hit(venue?.id==="kite"?event.clientX<bounds.left+bounds.width/2?-1:1:0);
  });
  document.addEventListener("keydown",event=>{
    if(!dialog.open||!venue||event.altKey||event.ctrlKey||event.metaKey)return;
    const key=event.key.toLowerCase(),kite=venue.id==="kite";
    if(![" ","arrowleft","arrowright","a","d"].includes(key))return;
    event.stopPropagation();
    if(!minigameFrame(venue,roundAt(),now())||event.target===node("[data-close]"))return;
    const move=kite?key==="arrowleft"||key==="a"?-1:key==="arrowright"||key==="d"?1:null:key===" "?0:null;
    if(move===null)return;
    event.preventDefault();if(!event.repeat)hit(move);
  },true);

  function flushWithdrawal(){
    if(!withdrawal||pending||!connected())return;
    const {game,round}=withdrawal,latest=games.get(game);
    withdrawal=null;
    if(latest?.id===round&&activeSelf(latest)&&now()<latest.endsAt)submit("leave",game,round);
  }
  node("[data-close]").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{
    if(dialog.open||!venue)return;
    const round=roundAt();
    if(activeSelf(round)&&now()<round.endsAt)withdrawal={game:venue.id,round:round.id};
    else if(pending?.game===venue.id&&["start","join"].includes(pending.action)){
      withdrawal={game:venue.id,round:pending.action==="start"?pending.id:pending.round};
    }
    venue=null;shot=null;cancelAnimationFrame(animation);animation=0;
    flushWithdrawal();focusGame?.();
  });

  function receive(rounds,sent,result){
    games=new Map(rounds.map(round=>[round.game,round]));
    if(sent&&pending?.id===sent.id){
      pending=null;
      if(dialog.open&&venue?.id===sent.game){
        const round=games.get(sent.game);
        if(result!=="accepted")setText(feedback,sent.action==="start"&&round&&now()<round.startsAt?
          "친구가 먼저 새 판을 열었어요. 참가하기를 눌러 함께 시작해 보세요.":"시간이 지나거나 자리를 벗어나 등록하지 못했어요.");
        else if(sent.action==="hit"){
          const hit=round?.self?.hits.find(item=>item.beat===sent.beat);
          setText(feedback,hit?.points===3?"정확해요 · +3점":hit?.points===1?"좋아요 · +1점":"이번에는 놓쳤어요.");
        }else setText(feedback,"같은 방 친구도 시작 전에 참가할 수 있어요.");
      }
    }
    flushWithdrawal();
    if(dialog.open&&venue)update(now());
  }
  function open(point){
    const nearby=nearbyMinigame(point);
    if(!nearby||dialog.open)return false;
    venue=nearby;shot=null;boardRound=null;boardKey="";wasOffline=false;players.replaceChildren();board.hidden=true;
    setText(place,venue.place);setText(title,venue.name);
    setText(hint,venue.hint+(venue.id==="kite"?" 터치 또는 방향키를 사용하세요.":" 화면을 터치하거나 Space 키를 사용하세요."));
    setText(feedback,"");dialog.showModal();canvas.focus({preventScroll:true});tick();return true;
  }
  function reset(){
    venue=pending=withdrawal=shot=null;games.clear();boardRound=null;
    cancelAnimationFrame(animation);animation=0;
    if(dialog.open)dialog.close();
  }
  return {nearby:nearbyMinigame,open,receive,reset};
}
