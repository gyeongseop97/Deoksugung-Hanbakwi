import {at as palaceAt} from "./gyeongbok-layout.js";
import {plazaAt} from "./plaza-layout.js";

export const MINIGAME_LOBBY_MS=9000;
export const MINIGAME_RESULT_MS=24000;
export const MINIGAME_REACH=9;
export const KITE_GUSTS=[-1,1,1,-1,1,-1];

const games=[
  {id:"tuho",name:"투호",place:"경복궁 근정전 마당 서쪽",point:palaceAt(-23,262),beats:12,beatMs:5500,targetMs:2690,perfect:220,good:525,
    hint:"조준 표시가 가운데에 들어오면 화살을 던져요. 한 박자에 한 발씩 던집니다.",action:"화살 던지기"},
  {id:"jegi",name:"제기차기",place:"경복궁 근정전 마당 동쪽",point:palaceAt(23,262),beats:32,beatMs:2000,targetMs:1310,perfect:140,good:320,
    hint:"제기가 발 앞까지 내려오면 차 보세요. 친구와 같은 박자에 도전합니다.",action:"제기 차기"},
  {id:"kite",name:"연날리기",place:"광화문광장 육조마당",point:plazaAt(-19,477),beats:24,beatMs:3000,targetMs:1760,perfect:195,good:440,
    hint:"바람 화살표가 가리키는 쪽으로 줄을 당겨요. 표시가 가운데에 올 때 당기면 높은 점수를 받아요."}
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

export function minigameFrame(game,round,time){
  if(!round||time<round.startsAt||time>=round.endsAt)return null;
  const elapsed=time-round.startsAt,beat=Math.floor(elapsed/game.beatMs),at=elapsed-beat*game.beatMs;
  if(beat>=game.beats)return null;
  return {beat,at,progress:at/game.beatMs,move:game.id==="kite"?KITE_GUSTS[(beat+round.seed)%KITE_GUSTS.length]:0};
}

export function minigamePoints(game,round,time,move=0){
  const frame=minigameFrame(game,round,time);
  if(!frame||frame.move!==move)return 0;
  const offset=Math.abs(frame.at-game.targetMs);
  return offset<=game.perfect?3:offset<=game.good?1:0;
}
