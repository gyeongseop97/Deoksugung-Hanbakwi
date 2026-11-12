// The game racks sit on public sidewalks next to the real neighbourhoods they serve.
export const bikeDocks=[
  {id:"city-hall",name:"시청역 앞 따릉이",x:470.5,y:271,heading:270,access:{x:474,y:271}},
  {id:"cheonggye",name:"청계광장 옆 따릉이",x:548,y:-156,heading:90,access:{x:545,y:-156}},
  {id:"gwanghwamun",name:"광화문광장 따릉이",x:436.8,y:-305,heading:270,access:{x:440,y:-305}},
  {id:"gyeongbokgung",name:"경복궁 앞 따릉이",x:398.8,y:-862.4,heading:270,access:{x:402,y:-862.4}},
  {id:"jeongdong-fountain",name:"정동 분수대 옆 따릉이",x:154,y:275,heading:205,access:{x:152.6,y:278}},
  {id:"seoul-plaza",name:"서울광장 북쪽 따릉이",x:550,y:213,heading:90,access:{x:553.35,y:213}},
  {id:"city-council",name:"서울시의회 앞 따릉이",x:480,y:22,heading:270,access:{x:476.65,y:22}},
  {id:"culture-shelter",name:"문화쉼터 옆 따릉이",x:436,y:-504,heading:90,access:{x:439.35,y:-504}},
  {id:"plaza-east",name:"광화문광장 동편 따릉이",x:529,y:-570,heading:270,access:{x:525.65,y:-570}},
  {id:"palace-museum",name:"국립고궁박물관 앞 따릉이",x:360,y:-957,heading:270,access:{x:356.65,y:-957}},
  {id:"folk-museum",name:"국립민속박물관 앞 따릉이",x:588,y:-1470,heading:90,access:{x:591.35,y:-1470}}
];

export const bikeDockReach=3.2;
export const bikeMountReach=2.7;
export const bikeParkDuration=10*60_000;
export const isCycling=position=>Boolean(position.bike&&!position.bike.parked);

export function nearBikeDock(point){
  if(!point)return null;
  return bikeDocks.find(({access})=>Math.hypot(point.x-access.x,point.y-access.y)<=bikeDockReach)??null;
}
