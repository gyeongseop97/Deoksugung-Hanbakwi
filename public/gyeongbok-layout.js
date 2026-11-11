import {addLandmarks,addZone,addLoft,spawn} from "./layout.js";

// Gyeongbokgung is a second map reached by subway. It lives in the same coordinate
// space as Deoksugung, 1.2 km to the east, so position sync, the minimap and
// collision all keep working without a separate mode.
//
// Positions are metres east of the palace's central axis and north of Gwanghwamun,
// taken from the published site plan and map coordinates of each building. The
// palace measures roughly 500 m east-west and 880 m north-south. Building sizes are
// rounded from survey figures and photographs; heights are approximate.
export const gwanghwamun={x:1700,y:930};
export const at=(east,north,name="")=>({name,x:gwanghwamun.x+east,y:gwanghwamun.y-north});
export const gbBounds={minX:1400,maxX:2000,minY:30,maxY:1100};
export const inGyeongbok=(x,y)=>x>=gbBounds.minX;

export const wallHalf=250,wallNorth=875;

// kind: gate (walk through the centre bay), hall, open (pillared pavilion), plain (side building)
const site=(id,name,sign,east,north,w,d,h,bays,extra={})=>({id,name,sign,...at(east,north,name),east,north,w,d,h,bays,angle:0,...extra});
export const gbSites=[
  site("gwanghwamun","광화문","光化門",0,0,23.6,8.6,4.3,3,{kind:"mainGate",stories:2}),
  site("heungnyemun","흥례문","興禮門",0,135,18.4,9.0,5.0,3,{kind:"gate",stories:2}),
  site("geunjeongmun","근정문","勤政門",0,232,17.4,8.6,4.8,3,{kind:"gate",stories:2}),
  site("geunjeongjeon","근정전","勤政殿",0,300,30.2,21.1,8.4,5,{kind:"throne",stories:2}),
  site("sajeongmun","사정문","思政門",0,350,11.2,5.2,3.4,3,{kind:"gate"}),
  site("sajeongjeon","사정전","思政殿",0,374,22.0,13.4,4.9,5,{kind:"hall"}),
  site("manchunjeon","만춘전","萬春殿",34,374,17.6,8.6,3.7,6,{kind:"hall"}),
  site("cheonchujeon","천추전","千秋殿",-34,374,17.6,8.6,3.7,6,{kind:"hall"}),
  site("gangnyeongjeon","강녕전","康寧殿",0,414,37.6,14.8,4.6,11,{kind:"hall"}),
  site("gyotaejeon","교태전","交泰殿",0,456,30.6,12.6,4.3,9,{kind:"hall"}),
  site("gyeonghoeru","경회루","慶會樓",-93,428,28.5,34.4,5.6,5,{kind:"lake",stories:2}),
  site("sujeongjeon","수정전","修政殿",-86,338,35.2,13.6,4.4,10,{kind:"hall"}),
  site("jaseondang","자선당","資善堂",96,322,19.6,10.4,3.8,7,{kind:"hall"}),
  site("bihyeongak","비현각","丕顯閣",126,322,14.2,9.2,3.6,5,{kind:"hall"}),
  site("jagyeongjeon","자경전","慈慶殿",108,472,31.4,12.2,4.2,10,{kind:"hall"}),
  site("hyangwonjeong","향원정","香遠亭",12,706,8.4,8.4,6.4,6,{kind:"hexagon"}),
  site("geoncheonggung","건청궁","乾淸宮",22,782,26.4,11.6,3.9,8,{kind:"hall"}),
  site("jibokjae","집옥재","集玉齋",-72,806,18.6,13.2,5.2,5,{kind:"hall",brick:true}),
  site("geonchunmun","건춘문","建春門",wallHalf,330,13.4,8.4,3.8,3,{kind:"sideGate",angle:Math.PI/2}),
  site("yeongchumun","영추문","迎秋門",-wallHalf,330,13.4,8.4,3.8,3,{kind:"sideGate",angle:Math.PI/2}),
  site("sinmumun","신무문","神武門",0,wallNorth,13.4,8.4,3.8,3,{kind:"sideGate"}),
  site("palace-museum","국립고궁박물관","國立古宮博物館",-164,64,96,44,11.5,12,{kind:"museum"}),
  site("folk-museum","국립민속박물관","",168,566,74,46,13,10,{kind:"museum"})
];
export const gbSite=Object.fromEntries(gbSites.map(spec=>[spec.id,spec]));

// Covered corridors (haenggak) that frame the two outer courts. Gaps are gateways.
const frame=(west,east,south,north)=>({west,east,south,north});
export const gbCourts={
  heungnye:frame(-53,53,135,232),
  geunjeong:frame(-50,50,232,350),
  sajeong:frame(-52,52,350,392)
};

// Gyeonghoeru stands on a stone island at the east side of its square pond, joined to
// the bank by three bridges. Hyangwonjeong is a hexagonal pavilion on a round island.
export const gbLake={west:-192,east:-64,south:368,north:482,
  island:{west:-116,east:-70,south:408,north:448},
  bridges:[416,428,440].map(north=>({west:-70,east:-64,north,width:3.4})),
  isles:[{east:-160,north:446,radius:9},{east:-166,north:404,radius:7}]};
export const gbPond={east:12,north:706,radius:39,island:9.5,
  bridge:{east:12,south:715,north:746,width:3.2}};

export const gbStation={
  name:"경복궁역 5번 출구",...at(-104,36,"경복궁역 5번 출구"),angle:Math.PI/2,
  door:at(-100.4,36),arrive:{...at(-96.5,36),heading:60}
};
// City Hall station exit 2 is on the avenue pavement outside the east wall, level with the
// palace pond and about ninety metres north of Daehanmun; the Deoksugung bus stops line the
// same pavement between exits 2 and 3.
export const cityHallStation={
  name:"시청역 2번 출구",x:472.0,y:233,angle:0,
  door:{x:472.0,y:236.6},arrive:{x:473.4,y:239.4,heading:180}
};
export const cityHallBusStop={
  name:"시청앞·덕수궁 정류장",x:476.4,y:205,angle:Math.PI/2,
  door:{x:474.6,y:205},arrive:{x:474.2,y:207.4,heading:180}
};
// Across the road from Gwanghwamun: the Uijeongbu site plaza, the pedestrian crossings and
// the traffic island by Dongsipjagak where the Gyeongbokgung bus stop stands.
export const gbUijeongbu={west:36,east:156,south:-165,north:-93};
export const gbBusIsland={west:163,east:187,south:-106,north:-78};
// Each crossing overlaps the pavements it joins by a step, so routes can be planned across.
export const gbCrossings=[{west:43,east:53,south:-94.5,north:-54.5},{west:154.5,east:164.5,south:-103,north:-95}];
export const gbBusStop={
  name:"경복궁 정류장",...at(175,-80.6,"경복궁 정류장"),angle:Math.PI,
  door:at(175,-82.5),arrive:{...at(172.5,-86),heading:250}
};
export const subwayStops=[
  {...cityHallStation,id:"city-hall",mode:"subway",to:"gyeongbokgung",destination:"경복궁역",line:"시청역 → 경복궁역"},
  {...gbStation,id:"gyeongbokgung",mode:"subway",to:"city-hall",destination:"시청역",line:"경복궁역 → 시청역"},
  {...cityHallBusStop,id:"bus-city-hall",mode:"bus",to:"bus-gyeongbokgung",destination:"경복궁 정류장",line:"시청앞·덕수궁 → 경복궁"},
  {...gbBusStop,id:"bus-gyeongbokgung",mode:"bus",to:"bus-city-hall",destination:"시청앞·덕수궁 정류장",line:"경복궁 → 시청앞·덕수궁"}
];

// Stone-paved royal road along the axis and the main visitor paths (for ground and map).
export const gbPaths=[
  {name:"광화문에서 근정전까지",width:8.2,surface:"stone",points:[at(0,-50),at(0,0),at(0,135),at(0,232),at(0,276)]},
  {name:"사정전에서 교태전까지",width:4.6,surface:"stone",points:[at(0,318),at(0,350),at(0,404),at(0,446)]},
  {name:"경복궁역에서 흥례문 앞까지",width:6.0,surface:"gravel",points:[at(-96,36),at(-70,60),at(-36,96),at(0,112)]},
  {name:"경회루 가는 길",width:4.8,surface:"gravel",points:[at(-56,246),at(-58,300),at(-56,356),at(-58,400),at(-60,428)]},
  {name:"동궁 가는 길",width:4.4,surface:"gravel",points:[at(58,246),at(62,300),at(66,350),at(78,420),at(88,452)]},
  {name:"향원정 가는 길",width:5.0,surface:"gravel",points:[at(0,476),at(-6,540),at(-10,610),at(-30,650),at(-44,706),at(-30,756),at(12,762)]},
  {name:"향원지 동쪽 길",width:4.0,surface:"gravel",points:[at(-10,610),at(40,650),at(60,706),at(46,752),at(12,762)]},
  {name:"건청궁에서 신무문까지",width:4.4,surface:"gravel",points:[at(12,762),at(-14,790),at(-30,830),at(0,858),at(0,868)]}
];

export const gbLawns=[
  {name:"고궁박물관 앞 숲",kind:"grove",west:-236,east:-116,south:100,north:210},
  {name:"수정전 남쪽 잔디",kind:"lawn",west:-150,east:-68,south:250,north:314},
  {name:"경회루 북쪽 숲",kind:"grove",west:-236,east:-70,south:496,north:660},
  {name:"서쪽 담장 숲",kind:"grove",west:-240,east:-200,south:230,north:480},
  {name:"동궁 남쪽 잔디",kind:"lawn",west:70,east:150,south:246,north:300},
  {name:"동쪽 숲",kind:"grove",west:150,east:238,south:120,north:300},
  {name:"자경전 북쪽 숲",kind:"grove",west:60,east:120,south:500,north:640},
  {name:"향원지 둘레 숲",kind:"grove",west:-110,east:110,south:660,north:756},
  {name:"북쪽 숲",kind:"grove",west:-236,east:-110,south:680,north:860},
  {name:"동북쪽 숲",kind:"grove",west:70,east:236,south:660,north:860},
  {name:"아미산",kind:"parterre",west:-22,east:22,south:470,north:486}
];

function inLake(east,north){
  const {west,east:right,south,north:top,island,bridges,isles}=gbLake;
  if(east<=west||east>=right||north<=south||north>=top)return false;
  if(isles.some(isle=>Math.hypot(east-isle.east,north-isle.north)<isle.radius))return false;
  if(east>island.west&&east<island.east&&north>island.south&&north<island.north)return false;
  return !bridges.some(bridge=>east>=bridge.west-1&&east<=bridge.east+1&&Math.abs(north-bridge.north)<bridge.width/2);
}
function inPond(east,north){
  const gap=Math.hypot(east-gbPond.east,north-gbPond.north);
  if(gap>=gbPond.radius||gap<gbPond.island)return false;
  const {bridge}=gbPond;
  return !(Math.abs(east-bridge.east)<bridge.width/2&&north>=bridge.south-1&&north<=bridge.north+1);
}
// Cats wander along these lines. They are routes through open ground, not drawn paths;
// trails share end points so the whole palace forms one connected network.
const trail=points=>points.map(([east,north])=>at(east,north));
export const gbCatTrails=[
  [[0,0],[0,60],[0,112],[0,135],[0,160],[0,205],[0,232],[0,262]],
  [[-96,36],[-70,60],[-36,96],[0,112]],
  [[-70,60],[-110,110],[-180,120],[-210,140],[-220,180],[-170,220],[-120,240],[-56,246]],
  [[0,112],[40,116],[100,110],[150,150],[190,200],[160,260],[110,280],[62,300]],
  [[0,205],[-30,200],[-46,194],[-60,194],[-56,246]],
  [[0,205],[30,200],[46,194],[60,194],[58,246],[62,300],[66,350],[78,420],[88,452],[60,500],[30,492]],
  [[0,262],[-40,262],[-40,330],[-44,333.5],[-56,333.5],[-56,356]],
  [[0,262],[40,262],[40,330],[44,333.5],[56,333.5],[66,350]],
  [[-40,330],[0,340],[40,330]],
  [[0,340],[0,350],[0,358],[-16,360],[-16,386],[-11.5,392],[-11.5,398],[-26,400],[-26,430],[0,436],[26,430],[26,400],[11.5,398],[11.5,392],[16,386],[16,360],[0,358]],
  [[-56,246],[-56,356],[-58,362],[-58,430],[-26,430]],
  [[-58,430],[-58,488],[-128,488],[-198,488],[-198,430],[-198,362],[-128,362],[-58,362]],
  [[-58,362],[-86,352],[-120,350],[-150,300],[-120,240]],
  [[26,430],[40,470],[30,492],[0,500],[-6,540],[-10,610],[-30,650],[-50,706],[-30,756],[12,762],[46,752],[62,706],[40,650],[-10,610]],
  [[12,762],[12,735]],
  [[12,762],[-14,790],[-30,830],[0,858]],
  [[46,752],[110,760],[150,700],[140,640],[100,610],[40,650]],
  [[-50,706],[-120,700],[-170,760],[-120,830],[-30,830]],
  [[-58,488],[-60,560],[-120,640],[-120,700]]
].map(trail);
// The square outside the gate has its own few cats; the terrace steps keep them out of the palace.
export const gbPlazaCatTrails=[
  [[-60,-30],[-24,-30],[-24,-54],[0,-54],[24,-54],[24,-30],[60,-30],[60,-50],[24,-54]],
  [[-24,-54],[-60,-50],[-60,-30]]
].map(trail);
// Places where flocks of pigeons and magpies gather.
export const gbBirdGrounds=[
  [40,-30],[100,-122],[0,70],[-30,160],[30,206],[0,256],[-36,300],[36,300],[-58,446],[-120,300],[0,436],
  [100,280],[150,180],[-150,160],[0,540],[12,772],[-64,700],[84,700],[-90,56],[-150,236],[60,560],
  [-128,494],[-200,400],[120,470],[0,846],[-150,780],[150,790]
].map(([east,north])=>at(east,north));
// Woldae: the ceremonial stone terrace that runs south from Gwanghwamun.
export const gbWoldae={half:14.7,south:-50,north:-5.7,tier:.19};
export const gbHaetae=[-1,1].map(side=>({side,east:side*19.6,north:-48}));
// Standing here offers a souvenir photograph in front of the throne hall.
export const gbPhotoZone={...at(0,263,"근정전 포토존"),heading:180,reach:3.4,
  tripod:at(1.7,255.7),shot:{from:{...at(1.7,256.5),height:1.3},to:{...at(-.5,300),height:4.6},fov:52}};
// Night floodlights: the nearest three are lit while a walker is in the palace.
export const gbLightSpots=[
  [0,-12,5,620,60],[0,128,4.5,520,55],[0,226,4.5,520,55],[0,281,5.5,900,75],[0,360,4,420,50],[0,404,4,420,50],
  [0,446,4,420,50],[-64,428,5,900,80],[-86,330,4,420,50],[104,330,4,380,48],[108,464,4,420,50],
  [12,722,4.5,700,70],[22,774,4,420,50],[-72,797,4,380,48]
].map(([east,north,height,power,range])=>({...at(east,north),height,power,range}));
export const sparklerStall={...at(-50,402,"경회루 스파클 좌판")};
export const wishPond={...at(gbPond.east,gbPond.north,"향원정"),reach:gbPond.radius+12};
// Shortcut buttons while in Gyeongbokgung.
export const gbShortcuts=[
  {label:"경복궁역",aria:"경복궁역으로 순간이동",...at(-96.5,36,"경복궁역 5번 출구"),heading:60},
  {label:"근정전",aria:"근정전으로 순간이동",...at(0,258,"근정전 마당"),heading:0},
  {label:"향원정",aria:"향원정으로 순간이동",...at(12,752,"향원정"),heading:180},
  {label:"정류장",aria:"경복궁 정류장으로 순간이동",...gbBusStop.arrive,name:gbBusStop.name}
];

export function gyeongbokWalkable(x,y){
  const east=x-gwanghwamun.x,north=gwanghwamun.y-y;
  // The square in front of Gwanghwamun, then everything inside the palace wall.
  if(north<1.2){
    if(north>-56&&Math.abs(east)<92)return true;
    const inside=area=>east>area.west&&east<area.east&&north>area.south&&north<area.north;
    return inside(gbUijeongbu)||inside(gbBusIsland)||gbCrossings.some(inside);
  }
  if(north>wallNorth-1.6||Math.abs(east)>wallHalf-1.6)return false;
  return !inLake(east,north)&&!inPond(east,north);
}

// Gyeonghoeru: seven bays by five on 48 stone pillars, its long side facing the bridges.
// People walk among the pillars and climb either timber stair to the banquet floor.
export const gbRoyalPavilion=(()=>{
  const centre={east:-93,north:428},long=34.4,short=28.5,floor=5.5,base=.38;
  const norths=Array.from({length:8},(_,i)=>centre.north-long/2+i*long/7);
  const easts=Array.from({length:6},(_,i)=>centre.east-short/2+i*short/5);
  const stairs=[{south:412.05,north:414.45,foot:-87.3,head:-97.5},{south:441.55,north:443.95,foot:-98.7,head:-88.5}];
  // Columns of the upper floor that stand inside the walking area.
  const columns=norths.slice(1,7).flatMap((north,i)=>easts.slice(1,5).filter((east,j)=>i===0||i===5||j===0||j===3).map(east=>({east,north})));
  return {centre,long,short,floor,base,norths,easts,stairs,columns};
})();
addLoft({
  height:gbRoyalPavilion.floor,
  stair(x,y){
    const east=x-gwanghwamun.x,north=gwanghwamun.y-y,{stairs,floor,base}=gbRoyalPavilion;
    for(const {south,north:top,foot,head} of stairs){
      const along=(east-foot)/(head-foot);
      if(north>=south&&north<=top&&along>=0&&along<=1)return base+(floor-base)*along;
    }
    return null;
  },
  deck(x,y){
    const east=x-gwanghwamun.x,north=gwanghwamun.y-y,{centre,long,short,columns}=gbRoyalPavilion;
    if(Math.abs(north-centre.north)>long/2+.5||Math.abs(east-centre.east)>short/2+.5)return false;
    return !columns.some(column=>Math.hypot(east-column.east,north-column.north)<.5);
  }
});
// Both ponds are shallow enough to wade: people sink to the waist and move slowly.
export const gbWaterDepth=.45;
export function gyeongbokWater(x,y){
  const east=x-gwanghwamun.x,north=gwanghwamun.y-y;
  return inLake(east,north)||inPond(east,north)?gbWaterDepth:0;
}
addZone({
  name:"경복궁",contains:inGyeongbok,walkable:gyeongbokWalkable,water:gyeongbokWater,
  grid:{ox:gbBounds.minX,oy:gbBounds.minY,cols:301,rows:536}
});
addLandmarks([
  ...gbSites,gbStation,cityHallStation,cityHallBusStop,gbBusStop,
  at(0,-28,"광화문 월대"),at(96,-128,"의정부지 역사유적광장"),at(48,-74,"광화문 앞 횡단보도"),at(-50,-36,"광화문 광장"),at(50,-36,"광화문 광장"),at(0,70,"흥례문 앞마당"),at(0,180,"영제교"),at(0,262,"근정전 마당"),
  at(-128,428,"경회루 연못"),at(12,706,"향원정"),at(0,480,"아미산"),
  ...gbPaths.flatMap(path=>path.points.slice(1,-1).map(point=>({...point,name:path.name})))
]);
