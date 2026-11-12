import {addLandmarks,addObstacle,bridge,clearSegment,courtAngle,fountain,gate,hall,pavilions,stoneFountain,stoneHall,walkable} from "./layout.js";
import {at as palaceAt} from "./gyeongbok-layout.js";
import {plazaAt} from "./plaza-layout.js";
import {isInsideMuseum} from "./visit-layout.js";
import {isCycling} from "./sejong-bike.js";

const local=(site,x,z,angle=site.angle??0)=>({x:site.x+x*Math.cos(angle)+z*Math.sin(angle),
  y:site.y-x*Math.sin(angle)+z*Math.cos(angle)});
const pavilion=name=>pavilions.find(place=>place.name===name);
const stamp=(id,name,motif,point,reach=6)=>({id,name,motif,x:point.x,y:point.y,reach});

export const passportRegions=[
  {id:"deoksugung",name:"덕수궁",ink:"#9c4939",reward:{field:"keepsake",value:"maple-pin",name:"단풍 브로치",motif:"leaf"},stamps:[
    stamp("daehanmun","대한문","gate",local(gate,0,6.5,Math.PI/2)),
    stamp("geumcheongyo","금천교","bridge",bridge,5),
    stamp("junghwajeon","중화전","hall",local(hall,0,30,courtAngle),8),
    stamp("seogeodang","석어당","hall",local(pavilion("석어당"),0,10.7),6),
    stamp("seokjojeon","석조전","columns",local(stoneHall,0,22),8),
    stamp("seokjojeon-garden","석조전 분수 정원","water",{x:stoneFountain.x+6.7,y:stoneFountain.y+1.3},6.5),
    stamp("jeonggwanheon","정관헌","pavilion",local(pavilion("정관헌"),0,pavilion("정관헌").d/2+3.5),6.5),
    stamp("dondeokjeon","돈덕전","tower",local(pavilion("돈덕전"),0,pavilion("돈덕전").d/2+4.5),7),
    stamp("jeongdong-fountain","정동 분수","water",{x:fountain.x+4.8,y:fountain.y+1.1},6)
  ]},
  {id:"gwanghwamun",name:"광화문광장",ink:"#31766f",reward:{field:"keepsake",value:"folding-fan",name:"청록 접부채",motif:"fan"},stamps:[
    stamp("myeongnyang-fountain","명량분수","water",plazaAt(-15,28),6),
    stamp("yi-statue","이순신 장군 동상","sword",plazaAt(-5,43),8),
    stamp("hangeul-fountain","한글분수","water",plazaAt(-34,66),6.5),
    stamp("haechi-square","해치마당","gate",plazaAt(-12,116),6.5),
    stamp("sejong-statue","세종대왕 동상","book",plazaAt(-7,258),8),
    stamp("gratitude-garden","감사의 정원","flower",plazaAt(-39,315),6),
    stamp("saheonbu","사헌부 문터","ruin",plazaAt(-29,362),7),
    stamp("time-garden","시간의 정원","ruin",plazaAt(-38,391),6),
    stamp("yukjo","육조마당","hills",plazaAt(-18,476),8)
  ]},
  {id:"gyeongbokgung",name:"경복궁",ink:"#77516e",reward:{field:"headwear",value:"golden-headpiece",name:"금빛 화관",motif:"crown"},stamps:[
    stamp("gwanghwamun","광화문","gate",palaceAt(0,13),8),
    stamp("heungnyemun","흥례문","gate",palaceAt(0,123),7),
    stamp("geunjeongjeon","근정전","hall",palaceAt(0,269),8),
    stamp("gyeonghoeru","경회루","pavilion",palaceAt(-57,424),8),
    stamp("jagyeongjeon","자경전","flower",palaceAt(99,453),7),
    stamp("amisan","아미산 굴뚝","tower",palaceAt(7,501),6.5),
    stamp("hyangwonjeong","향원정","pond",palaceAt(12,750),7),
    stamp("jibokjae","집옥재","book",palaceAt(-56,811),6.5),
    stamp("palace-museum","국립고궁박물관","columns",palaceAt(-164,37.5),7)
  ]}
];
export const passportStamps=passportRegions.flatMap(region=>region.stamps.map(site=>({...site,region:region.id,ink:region.ink})));
export const hanbokRental={...palaceAt(-113,29.2,"기와 한복 대여소"),reach:3.4,
  stand:{...palaceAt(-113,25),w:7.1,d:4.4,angle:Math.PI,h:3.8}};

export function registerHanbokRental(){
  const {stand,name,x,y}=hanbokRental;
  addObstacle(stand.x,stand.y,stand.w,stand.d,stand.angle,stand.h);
  addLandmarks([{name,x,y}]);
}

function atSite(point,site){
  return Math.hypot(point.x-site.x,point.y-site.y)<=site.reach&&
    walkable(site.x,site.y,.22)&&clearSegment(point,site,.32,.22);
}
export function nearHanbokRental(point){
  return Boolean(point&&!point.bus&&!isCycling(point)&&atSite(point,hanbokRental));
}
export function nearbyPassportStamps(point){
  if(!point||point.bus||isCycling(point)||isInsideMuseum(point.x,point.y))return [];
  return passportStamps.filter(site=>atSite(point,site));
}
