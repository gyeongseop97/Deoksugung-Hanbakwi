import {at as palaceAt} from "./gyeongbok-layout.js";
import {plazaAt} from "./plaza-layout.js";

export const MINIGAME_LOBBY_MS=9000;
export const MINIGAME_RESULT_MS=24000;
export const MINIGAME_REACH=9;
export const MINIGAME_AIM_METRES=.045;
export const MINIGAME_LANE_DEPTH=1.55;
export const MINIGAME_PICKUP_REACH=2.25;
export const TUHO_ARROWS=10;
export const TUHO_ANGLE_LIMIT=55;
export const JEGI_FLIGHT_MS=1100;
export const JEGI_CATCH_EARLY=190;
export const JEGI_CATCH_LATE=240;
export const JEGI_CATCH_REACH=1.35;
export const JEGI_KICK_COOLDOWN=260;
const gravity=9.81,throwHeight=1.35,throwLift=4.55,rimHeight=.79;
const rimTime=(throwLift+Math.sqrt(throwLift**2+2*gravity*(throwHeight-rimHeight)))/gravity;
export const TUHO_RIM_MS=rimTime*1000;
export const KITE_GUSTS=[-1,1,1,-1,1,-1];
const throwAims=[-42,28,-18,47,-31,9],throwPowers=[49,58,44,54,63,48];
const kickLanes=[-47,0,47,-24,31,12];

export const aimTolerance={
  tuho:{perfect:9,good:18,powerPerfect:10,powerGood:19},
  jegi:{perfect:13,good:24},
  kite:{perfect:14,good:27}
};

const games=[
  {id:"tuho",name:"투호",place:"경복궁 근정전 마당 서쪽",point:palaceAt(-23,262),beats:12,beatMs:5500,targetMs:2690,perfect:220,good:525,
    hint:"화살통에서 화살 10개를 받아요. 던지는 선에 서서 방향을 맞추고, 던지기를 꾹 눌렀다 떼세요.",action:"화살 던지기"},
  {id:"jegi",name:"제기차기",place:"경복궁 근정전 마당 동쪽",point:palaceAt(23,262),beats:32,beatMs:2000,targetMs:1310,perfect:140,good:320,
    hint:"제기를 올려 차고, 발 앞까지 다시 내려올 때 이어서 차세요.",action:"제기 차기"},
  {id:"kite",name:"연날리기",place:"광화문광장 육조마당",point:plazaAt(-19,477),beats:24,beatMs:3000,targetMs:1760,perfect:195,good:440,
    hint:"아바타를 움직여 연이 떠밀리는 쪽을 따라가세요. 줄이 팽팽해질 때 당기면 연이 높이 올라가요.",action:"줄 당기기"}
];
export const traditionalGames=games;
export const minigameById=id=>games.find(game=>game.id===id)??null;
export const minigameDuration=game=>game.beats*game.beatMs;

export function nearbyMinigame(point){
  if(!point)return null;
  let nearest=null,gap=MINIGAME_REACH;
  for(const game of games){
    const distance=Math.hypot(point.x-game.point.x,point.y-game.point.y);
    if(distance<=gap){nearest=game;gap=distance;}
  }
  return nearest;
}

export function atMinigameLane(game,point){
  return Boolean(point&&Math.abs(point.x-game.point.x)<=100*MINIGAME_AIM_METRES&&
    Math.abs(point.y-game.point.y)<=MINIGAME_LANE_DEPTH);
}

export function minigameAim(game,point){
  return Math.max(-100,Math.min(100,Math.round((point.x-game.point.x)/MINIGAME_AIM_METRES)));
}

export function minigamePickup(game){
  return {x:game.point.x-2.48,y:game.point.y+.25};
}

export function atTuhoLine(game,point){
  return Boolean(point&&Math.abs(point.x-game.point.x)<=4.5&&Math.abs(point.y-game.point.y)<=.72);
}

export function minigameTuhoJar(game){
  return {x:game.point.x,y:game.point.y-4.6,height:rimHeight};
}

export function tuhoProjectile(point,angle,power,elapsedMs){
  const time=Math.max(0,elapsedMs)/1000,direction=angle*Math.PI/180;
  const travel=(1.25+power*.085)*time;
  return {x:point.x+Math.sin(direction)*travel,y:point.y-Math.cos(direction)*travel,
    height:throwHeight+throwLift*time-gravity*time*time/2};
}

export function tuhoLanding(point,angle,power){
  return tuhoProjectile(point,angle,power,TUHO_RIM_MS);
}

export function tuhoScores(game,point,angle,power){
  const landing=tuhoLanding(point,angle,power),jar=minigameTuhoJar(game);
  return Math.hypot(landing.x-jar.x,landing.y-jar.y)<=.36;
}

export function jegiHeight(elapsedMs){
  const time=Math.max(0,elapsedMs)/1000,flight=JEGI_FLIGHT_MS/1000;
  return Math.max(.18,.18+gravity*time*(flight-time)/2);
}

export function jegiNextCount(previous,point,at){
  if(!previous?.count||at-previous.at>JEGI_FLIGHT_MS+JEGI_CATCH_LATE)return 1;
  const landed=at-previous.at>=JEGI_FLIGHT_MS-JEGI_CATCH_EARLY;
  const close=Math.hypot(point.x-previous.x,point.y-previous.y)<=JEGI_CATCH_REACH;
  return landed&&close?previous.count+1:0;
}

export function minigameLanding(game,aim,power){
  return {x:game.point.x+aim*MINIGAME_AIM_METRES,y:game.point.y-1.4-power*.057};
}

export function minigameTarget(game,frame){
  const aim=frame?.targetAim??0;
  if(game.id==="tuho")return {...minigameLanding(game,aim,frame?.targetPower??52),height:.78};
  const x=game.point.x+aim*MINIGAME_AIM_METRES,progress=Math.min(1,(frame?.at??0)/game.targetMs);
  if(game.id==="jegi")return {x,y:game.point.y-.55,height:.12+1.82*(1-progress**2)};
  return {x:x-(frame?.move??0)*.56*(1-progress),y:game.point.y-2.5,
    height:3.8+.22*Math.sin((frame?.progress??0)*Math.PI*2)};
}

export function minigameChallenge(game,seed,beat){
  const index=(seed+beat)%KITE_GUSTS.length,move=game.id==="kite"?KITE_GUSTS[index]:0;
  const targetAim=game.id==="tuho"?throwAims[index]:game.id==="jegi"?kickLanes[index]:move*53;
  return {move,targetAim,targetPower:game.id==="tuho"?throwPowers[index]:0};
}

export function minigameFrame(game,round,time){
  if(!round||time<round.startsAt||time>=round.endsAt)return null;
  const elapsed=time-round.startsAt,beat=Math.floor(elapsed/game.beatMs),at=elapsed-beat*game.beatMs;
  if(beat>=game.beats)return null;
  return {beat,at,progress:at/game.beatMs,...minigameChallenge(game,round.seed,beat)};
}

export function minigamePoints(game,round,time,move=0,aim,power){
  const frame=minigameFrame(game,round,time);
  if(!frame||frame.move!==move)return 0;
  const offset=Math.abs(frame.at-game.targetMs);
  if(aim!==undefined){
    const tolerance=aimTolerance[game.id],deviation=Math.abs(aim-frame.targetAim);
    if(game.id==="tuho"){
      const force=Math.abs(power-frame.targetPower);
      return deviation<=tolerance.perfect&&force<=tolerance.powerPerfect?3:
        deviation<=tolerance.good&&force<=tolerance.powerGood?1:0;
    }
    return deviation<=tolerance.perfect&&offset<=game.perfect?3:
      deviation<=tolerance.good&&offset<=game.good?1:0;
  }
  return offset<=game.perfect?3:offset<=game.good?1:0;
}
