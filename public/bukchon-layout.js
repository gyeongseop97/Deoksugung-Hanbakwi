import {addLandmarks,addZone,project} from "./layout.js";
import {at,gbSite,folkMuseumEastOpening} from "./gyeongbok-layout.js";

// Read in the common map projection. The street bends and ridgeline follow the Seoul
// Hanok Portal walking map and Google Earth. Individual residential lots are interpreted.
export const bukchonBounds={minX:555,maxX:1160,minY:-1885,maxY:-844};
const point=([x,y,level=0])=>({x,y,level});
export const folkMuseumEastDoor=at(250,(folkMuseumEastOpening.south+folkMuseumEastOpening.north)/2,"국립민속박물관 동쪽 출입구");
export const dongsipjagak=project("동십자각",37.5761083333,126.9794222222);
const museumY=folkMuseumEastDoor.y;
const geonchunY=gbSite.geonchunmun.y+8;

function makePath(name,kind,width,vertices){
  const points=vertices.map(point),half=width/2;
  function edge(side){
    return points.map((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      return {...p,x:p.x-side*dy/length*half,y:p.y+side*dx/length*half};
    });
  }
  const left=edge(-1),right=edge(1);
  const segments=points.slice(1).map((b,i)=>{
    const a=points[i],dx=b.x-a.x,dy=b.y-a.y;
    return {a,b,dx,dy,squared:dx*dx+dy*dy};
  });
  return {name,kind,width,points,left,right,outline:[...left,...right.slice().reverse()],segments,
    minX:Math.min(...points.map(p=>p.x))-half-3,maxX:Math.max(...points.map(p=>p.x))+half+3,
    minY:Math.min(...points.map(p=>p.y))-half-3,maxY:Math.max(...points.map(p=>p.y))+half+3};
}

// The palace wall in the existing model is rectilinear. The west pavement follows that
// wall and uses the same transition height at the public Folk Museum visitor opening.
const avenue=[
  [745,-897,0],[743,-933,.16],[741,-986,.35],[743,-1050,.65],[746,-1130,.82],
  [748,geonchunY,.94],[752,-1300,1.19],[758,-1370,1.45],[767,-1455,1.75],
  [774,museumY,2],[781,-1550,2.3],[795,-1612,2.7],[819,-1668,3.2],
  [850,-1724,3.65],[891,-1767,4.25],[921,-1814,4.95],[929,-1839,5.2],[933,-1858,5.4]
];
const westPavement=avenue.map(([x,y,h],i)=>[x-(i<10?10.6:9.4),y,h+.14]);
const eastPavement=avenue.map(([x,y,h])=>[x+10,y,h+.14]);
const northLanding=[941,-1839,5.34],stoneStepsTop=[952,-1834,10.4];
const ridgeNorth=[970,-1820,12.5],ridgeJunction=[1009,-1792,13.2];
const ridgeSouth=[988,-1700,10.7],libraryNorth=[958,-1606,7.4];
const westLink=[769,-1370,1.59],libraryLink=[881,-1465,4.9],gamgodangTop=[914,-1414,4.1];
const angukJunction=[1059,-938,.35];

export const bukchonPaths=[
  makePath("삼청로","road",13.8,avenue),
  makePath("경복궁 동쪽 담장길","pavement",6.3,westPavement),
  makePath("삼청로 동편 인도","pavement",6.3,eastPavement),
  makePath("광화문 동편 인도","pavement",7.4,[
    [555.2,-878,0],[592,-878,0],[624,-880,0],[669,-883,0],[701,-890,0],[718,-894,.06],[735,-897,.14]
  ]),
  makePath("율곡로 북쪽 인도","pavement",8.1,[
    [735,-896,.14],[753,-894,.14],[778,-915,.14],[807,-932,.22],[847,-946,.29],
    [889,-952,.31],[937,-951,.34],[984,-948,.35],[1020,-943,.35],angukJunction,
    [1095,-929,.35],[1138,-925,.35],[1150,-925,.35]
  ]),
  makePath("건춘문 앞 횡단보도","crosswalk",5.3,[[737.4,geonchunY,1.08],[748,geonchunY,.94],[758,geonchunY,1.08]]),
  makePath("국립민속박물관 동쪽 출입구","entrance",6.6,[
    [694,museumY,0],[712,museumY,0],[727,museumY,.66],[741,museumY,1.18],[763.4,museumY,2.14]
  ]),
  makePath("민속박물관 앞 횡단보도","crosswalk",5.1,[[763.4,museumY,2.14],[774,museumY,2],[784,museumY,2.14]]),
  makePath("삼청로 위쪽 횡단보도","crosswalk",5.1,[[919.6,-1839,5.34],[929,-1839,5.2],northLanding]),
  makePath("삼청동 돌계단길","stairs",3.3,[
    [937,-1839,5.34],northLanding,[945,-1841,6.9],[947.2,-1840.1,6.9],[950,-1838,8.52],stoneStepsTop,[957,-1832,10.4]
  ]),
  makePath("북촌로5나길","alley",5.2,[
    stoneStepsTop,[957,-1832,10.4],[963,-1825,11.6],ridgeNorth,[984,-1811,13],
    [997,-1804,13.3],ridgeJunction,[1007,-1765,13],[998,-1734,12],ridgeSouth,[980,-1660,9.1],libraryNorth,
    [936,-1583,6.5],[908,-1562,5.7],libraryLink
  ]),
  makePath("북촌로11나길","alley",4,[
    ridgeNorth,[977,-1831,13],[987,-1832,13.2],[1002,-1829,13.5],[1015,-1819,13.55],[1027,-1808,13.6]
  ]),
  makePath("북촌로11가길","alley",4.5,[
    ridgeJunction,[1023,-1792,13.55],[1035,-1794,13.85],[1043,-1786,14.05],[1046,-1766,13.75],[1049,-1746,13.12],
    [1048,-1731,12.6],[1040,-1718,12.1],[1028,-1715,11.75],[1008,-1713,11.45],ridgeSouth
  ]),
  makePath("가회동 한옥 골목","alley",3.8,[
    [1027,-1808,13.6],[1043,-1805,13.95],[1049,-1799,14.2],[1064,-1795,13.8],[1074,-1788,13.55],
    [1077,-1767,13.15],[1073,-1745,12.55],[1060,-1731,12.2],[1048,-1731,12.6]
  ]),
  makePath("화개길","lane",5.5,[
    [767.5,-1370,1.59],westLink,[789,-1399,2.1],[819,-1430,2.9],[850,-1446,3.8],libraryLink,
    [903,-1478,5.2],[926,-1493,5.2],[944,-1507,5.2]
  ]),
  makePath("팔판길","lane",5.1,[
    [860,-1724,3.79],[868,-1692,4],[865,-1658,3.8],[846,-1624,3.25],[821,-1589,2.9],[791,-1550,2.44]
  ]),
  makePath("감고당길","lane",6,[
    angukJunction,[1037,-987,.6],[1016,-1045,1],[996,-1102,1.5],[978,-1160,2.05],[959,-1221,2.55],
    [946,-1280,2.95],[929,-1340,3.4],gamgodangTop,[902,-1434,4.4],libraryLink
  ])
];

function inPath(x,y,path){
  if(x<path.minX||x>path.maxX||y<path.minY||y>path.maxY)return false;
  const vertices=path.outline;
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[i],b=vertices[j];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function inBukchon(x,y){
  return x>=bukchonBounds.minX&&x<=bukchonBounds.maxX&&y>=bukchonBounds.minY&&y<=bukchonBounds.maxY;
}
// Broad Samcheong-ro is crossed at the marked crossings. Narrower mixed-use lanes are
// continuous pedestrian space; stairs are a signed public link between the two levels.
export function bukchonWalkable(x,y){
  return bukchonPaths.some(path=>path.kind!=="road"&&inPath(x,y,path));
}
function samplePath(x,y,path){
  let nearest=Infinity,level=0;
  for(const {a,b,dx,dy,squared} of path.segments){
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/squared));
    const gap=(x-a.x-dx*t)**2+(y-a.y-dy*t)**2;
    if(gap>=nearest)continue;
    nearest=gap;level=a.level+(b.level-a.level)*t;
  }
  return {nearest,level};
}
export function bukchonGroundHeight({x,y}){
  let nearest=Infinity,height=null;
  for(const path of bukchonPaths){
    if(!inPath(x,y,path))continue;
    if(path.kind==="stairs")return stairLevel(x,y,path);
    const sample=samplePath(x,y,path);
    const gap=sample.nearest/(path.width*path.width);
    if(gap>=nearest)continue;
    nearest=gap;height=sample.level;
  }
  return height;
}
// The two edges turn together at landings. Sampling the same quadrilateral as the
// renderer keeps the player's feet on its individual stone treads, even on a bend.
function stairLevel(x,y,path){
  for(const [i,{a,b}] of path.segments.entries()){
    const l0=path.left[i],r0=path.right[i],l1=path.left[i+1],r1=path.right[i+1];
    const uX=r0.x-l0.x,uY=r0.y-l0.y,vX=l1.x-l0.x,vY=l1.y-l0.y;
    const twistX=r1.x-l1.x-uX,twistY=r1.y-l1.y-uY;
    let u=.5,v=.5;
    for(let step=0;step<4;step++){
      const errX=l0.x+uX*u+vX*v+twistX*u*v-x,errY=l0.y+uY*u+vY*v+twistY*u*v-y;
      const acrossX=uX+twistX*v,acrossY=uY+twistY*v,alongX=vX+twistX*u,alongY=vY+twistY*u;
      const det=acrossX*alongY-acrossY*alongX;
      if(Math.abs(det)<.001)break;
      u-=(errX*alongY-errY*alongX)/det;
      v-=(acrossX*errY-acrossY*errX)/det;
    }
    if(u<-.001||u>1.001||v<-.001||v>1.001)continue;
    const count=Math.max(1,Math.ceil(Math.abs(a.level-b.level)/.16));
    const step=Math.max(0,Math.min(count-1,Math.floor(v*count)));
    return a.level+(b.level-a.level)*(step+.5)/count;
  }
  return samplePath(x,y,path).level;
}
// Keep property bases and sloped ground just below the nearby street. Down the west side
// the road is a valley and the palace terrain remains at its established zero level.
export function bukchonTerrain(x,y){
  let nearest=Infinity,height=0;
  for(const path of bukchonPaths){
    if(x<path.minX-100||x>path.maxX+100||y<path.minY-100||y>path.maxY+100)continue;
    const sample=samplePath(x,y,path);
    if(sample.nearest>=nearest)continue;
    nearest=sample.nearest;height=sample.level;
  }
  return height;
}
export const bukchonLandmarks=[
  {...point([701,-890]),name:"동십자각 앞"},
  {...point([738.2,geonchunY]),name:"건춘문 앞 횡단보도"},
  {...point([761,geonchunY]),name:"국립현대미술관 서울 앞"},
  {...folkMuseumEastDoor},
  {...point([785,museumY]),name:"국립민속박물관 앞 삼청로"},
  {...point([791,-1550]),name:"팔판길"},
  {...point([940,-1839]),name:"삼청동 돌계단길 아래"},
  {...point([955,-1832]),name:"삼청동 돌계단길 · 북촌 8경"},
  {...point([1009,-1791]),name:"북촌로5나길"},
  {...point([1050,-1746]),name:"가회동 한옥 골목"},
  {...point([914,-1414]),name:"감고당길"},
  {...point([1136,-925]),name:"안국역 1번 출구 앞"}
];
export const bukchonShortcuts=[
  {label:"삼청로",aria:"삼청로로 순간이동",...bukchonLandmarks[4],heading:0},
  {label:"북촌 8경",aria:"삼청동 돌계단길로 순간이동",...bukchonLandmarks[7],heading:144},
  {label:"한옥 골목",aria:"가회동 한옥 골목으로 순간이동",...bukchonLandmarks[9],heading:20}
];
// These fronts are fictional shops. Their door thresholds are on the corresponding lane.
export const bukchonShopPlots={
  churu:{x:758.4354,y:-959.2121,w:7.8,d:5.7,angle:4.7501,level:.3931},
  coffee:{x:799.7099,y:-1418.6517,w:7.8,d:5.6,angle:.8018,level:2.5},
  crepe:{x:872.1877,y:-1673.8129,w:7.8,d:5.6,angle:-1.6588,level:3.896},
  beer:{x:989.1470,y:-1676.0586,w:7.8,d:5.6,angle:-1.7682,level:9.788}
};

addZone({name:"삼청동 · 북촌",contains:inBukchon,walkable:bukchonWalkable});
addLandmarks(bukchonLandmarks);
