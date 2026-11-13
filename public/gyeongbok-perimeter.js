import {project} from "./layout.js";
import {plazaSites} from "./plaza-layout.js";

const gate=plazaSites.gate;
const toMap=([east,north])=>({x:gate.x+east,y:gate.y-north});

// Metres in the world's existing projection, traced from the outer ways of
// OpenStreetMap relation 5501517. The wall along Samcheong-ro encloses the
// National Folk Museum frontage as well as the paid palace grounds.
export const gbSouthEastWall=[
  [15.6,0],[17.5,-2.5],[98.3,-.6],[119.4,.1],[134.1,1.1]
].map(toMap);
export const gbEastWall=[
  [134.1,1.1],[157.1,5.1],[180.1,8.6],[203.5,40.6],[220.4,58.6],
  [220.4,64.1],[220.2,70.4],[218.5,70.3],[218.5,72.1],[215.9,72.1],
  [216.1,91.4],[218.4,91.3],[218.4,93.3],[221.3,93.3],
  [223.6,222.6],[223.1,237.6],[223.9,252],[228.6,342.3],[229.9,396],
  [221.4,396.3],[220.9,417],[231.5,417.6],[233.1,450.3],[253.2,449.5],
  [282.2,566.8],[285,692.7]
].map(toMap);
const northEast=[
  [285,692.7],[277.8,742.1],[261.2,778.3],[218.7,816.9],
  [52.3,847.5],[-9.2,858.8],[-33,857.1],[-61.2,855],[-107,846]
];
const northWest=[
  [-122.5,842.8],[-203.8,823.7],[-238.5,815.5],[-253.8,809.9],
  [-254.6,784.9],[-270.6,775],[-270.5,756.3],[-267.8,671.1],
  [-264.7,570.6],[-263.6,536.2],[-256.9,431.4],[-247.6,329.7],[-247,321.9]
];
const southWestNorth=[
  [-245.8,306.3],[-242.5,271.6],[-239.1,235.7],[-228.2,152],
  [-222.4,114.5],[-214.8,55.2],[-210,20.7]
];
const southWestSouth=[
  [-208.6,16.8],[-196.7,8.5],[-187.4,8.3],[-183.5,8.2],[-148.4,6],
  [-121.1,4.7],[-55.1,1.2],[-15.6,0]
];
export const gbOuterWallRuns=[gbSouthEastWall,...[northEast,northWest,southWestNorth,southWestSouth].map(run=>run.map(toMap))];
export const gbMuseumWestGate={
  entrance:toMap([-209.7,18.5]),
  jambs:[southWestNorth.at(-1),southWestSouth[0]].map(toMap)
};

// The ring includes gates even though the corresponding wall runs stop at them.
export const gbWallOutline=[
  ...gbSouthEastWall.slice(0,-1),...gbEastWall.slice(0,-1),
  ...gbOuterWallRuns.slice(1,-1).flat(),gbMuseumWestGate.entrance,...gbOuterWallRuns.at(-1)
];
export const gbBoundaryGates={
  yeongchumun:{east:-247.7,north:313.9,angle:Math.PI/2+.077},
  sinmumun:{east:-114.75,north:844.4,angle:Math.atan2(3.2,15.5)}
};
export const gbWestPaths=[
  {name:"효자로 경복궁 담장길",width:5.2,surface:"stone",points:[
    [-180,10.5],[-196.7,12.8],[-207.7,17.4],[-214.4,21.8],[-219.3,55.2],
    [-226.9,114.5],[-232.7,152],[-243.6,235.7],[-247,271.6],[-250.3,306.3],
    [-251.7,313.6],[-252.7,324.5]
  ].map(toMap)},
  {name:"영추문 통행로",width:4.4,surface:"stone",points:[
    [-251.7,313.6],[-247.7,313.9],[-238.2,314.8],[-229.5,313.9],[-217.8,309.8]
  ].map(toMap)},
  {name:"국립고궁박물관 서쪽 출입길",width:3.6,surface:"stone",points:[
    [-213.9,22.3],[-211.9,18.6],[-209.7,18.5],[-205,20]
  ].map(toMap)}
];

export function onGbWestPath(x,y){
  return gbWestPaths.some(({width,points})=>{
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
      if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<width/2)return true;
    }
    return false;
  });
}

export function gbEastWallX(y){
  let edge=null;
  for(let index=1;index<gbEastWall.length;index++){
    const a=gbEastWall[index-1],b=gbEastWall[index];
    if(y>Math.max(a.y,b.y)||y<Math.min(a.y,b.y)||a.y===b.y)continue;
    const x=a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
    edge=edge==null?x:Math.max(edge,x);
  }
  return edge;
}

// The parkade access, east palace gate and Folk Museum entrance share the same wall.
export const gbEastOpenings=[
  {id:"palace-parking",name:"경복궁 동문 주차장 출입구",lat:37.576666,lon:126.97927,width:18},
  {id:"geonchunmun",name:"건춘문",lat:37.578136,lon:126.97935,width:14.3,angle:Math.PI/2-.052},
  {id:"folk-museum",name:"국립민속박물관 동쪽 출입구",lat:37.57965,lon:126.979325,width:8.3}
].map(({id,name,lat,lon,width,angle})=>{
  const {y}=project(name,lat,lon),x=gbEastWallX(y);
  return {id,name,x,y,width,angle};
});

const wallBands=new Map(),bandHeight=20;
const wallBand=y=>Math.floor(y/bandHeight);
for(let i=0,j=gbWallOutline.length-1;i<gbWallOutline.length;j=i++){
  const a=gbWallOutline[i],b=gbWallOutline[j];
  if(a.y===b.y)continue;
  const edge={a,b,slope:(b.x-a.x)/(b.y-a.y)};
  for(let band=wallBand(Math.min(a.y,b.y));band<=wallBand(Math.max(a.y,b.y));band++){
    if(!wallBands.has(band))wallBands.set(band,[]);
    wallBands.get(band).push(edge);
  }
}
export function insideGbWall(x,y){
  const edges=wallBands.get(wallBand(y));
  if(!edges)return false;
  let inside=false;
  for(const {a,b,slope} of edges){
    if((a.y>y)!==(b.y>y)&&x<(y-a.y)*slope+a.x)inside=!inside;
  }
  return inside;
}

export function clipGbGround(west,east,south,north){
  let polygon=gbWallOutline;
  const edges=[["x",gate.x+west,1],["x",gate.x+east,-1],["y",gate.y-north,1],["y",gate.y-south,-1]];
  for(const [axis,value,side] of edges){
    polygon=polygon.flatMap((point,index)=>{
      const previous=polygon[(index+polygon.length-1)%polygon.length];
      const inside=side*(point[axis]-value)>=0,wasInside=side*(previous[axis]-value)>=0;
      if(inside===wasInside)return inside?[point]:[];
      const t=(value-previous[axis])/(point[axis]-previous[axis]);
      const boundary={x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t};
      return inside?[boundary,point]:[boundary];
    });
  }
  return polygon;
}
