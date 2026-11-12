// The game racks sit on public sidewalks next to the real neighbourhoods they serve.
export const bikeDocks=[
  {id:"city-hall",name:"시청역 앞 따릉이",x:470.5,y:271,heading:270,access:{x:474,y:271}},
  {id:"cheonggye",name:"청계광장 옆 따릉이",x:548,y:-156,heading:90,access:{x:545,y:-156}},
  {id:"gwanghwamun",name:"광화문광장 따릉이",x:436.8,y:-305,heading:270,access:{x:440,y:-305}},
  {id:"gyeongbokgung",name:"경복궁 앞 따릉이",x:398.8,y:-862.4,heading:270,access:{x:402,y:-862.4}}
];

export const bikeDockReach=3.2;

export function nearBikeDock(point){
  if(!point)return null;
  return bikeDocks.find(({access})=>Math.hypot(point.x-access.x,point.y-access.y)<=bikeDockReach)??null;
}
