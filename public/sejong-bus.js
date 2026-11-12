import {at as palaceAt} from "./gyeongbok-layout.js";
import {eastCurb, eastRoadWidth, plazaAt} from "./plaza-layout.js";

export const BUS_COUNT=5;
export const BUS_SEATS=8;
export const BUS_DWELL_MS=20_000;
export const BUS_CYCLE_MS=300_000;
export const BUS_DEPARTURE_MS=BUS_CYCLE_MS/BUS_COUNT;
export const BUS_BOARD_REACH=4.2;
export const BUS_FLOOR=.71;
export const BUS_WIDTH=2.55;
export const BUS_LENGTH=10.66;
const epoch=Date.UTC(2026,0,1);

const pose=(x,y,heading)=>({x,y,heading});
const point=(x,y)=>({x,y});
const plazaEast=(north,margin=3.45)=>plazaAt(eastCurb(north)+eastRoadWidth-margin,north);
const plazaWest=(north,margin=3.45)=>plazaAt(eastCurb(north)+margin,north);
const midpoint=358;
const north=plazaEast(midpoint,1.78),south=plazaWest(midpoint,1.78);
const eastIsland=palaceAt(175,-76.1);

// Shelter and passenger positions are on the pavement, offset from the front right door.
// Opposite-direction plaza stops are separate berths on the two sides of the avenue.
export const busStops=[
  {id:"deoksugung",name:"시청앞·덕수궁 정류장",direction:"광화문광장 · 경복궁 방면",
    berth:pose(484.0,205,180),board:pose(480.4,208.2,90),exit:pose(478.4,208.7,270),shelter:pose(476.9,204.5,90)},
  {id:"plaza-north",name:"세종문화회관 정류장 건너편",direction:"경복궁 방면",
    berth:pose(north.x,north.y,0),board:pose(north.x+3.7,north.y-3.25,270),
    exit:pose(north.x+5.7,north.y-3.7,90),shelter:pose(north.x+6.1,north.y+.7,270)},
  {id:"gyeongbokgung",name:"경복궁 정류장",direction:"광화문광장 · 덕수궁 방면",
    berth:pose(eastIsland.x,eastIsland.y,90),board:pose(eastIsland.x+3.26,eastIsland.y+4.15,0),
    exit:pose(eastIsland.x+3.85,eastIsland.y+6.2,180),shelter:pose(eastIsland.x-.8,eastIsland.y+5.65,0)},
  {id:"plaza-south",name:"세종문화회관 정류장",direction:"덕수궁 방면",
    berth:pose(south.x,south.y,180),board:pose(south.x-3.5,south.y+3.25,90),
    exit:pose(south.x-5.6,south.y+3.7,270),shelter:pose(south.x-6.1,south.y-.7,90)}
];
const [deoksugung,plazaNorth,gyeongbokgung,plazaSouth]=busStops;
const stopIndex=new Map(busStops.map(stop=>[stop.id,stop]));
export const busStopById=id=>stopIndex.get(id)??null;

// The south-end turn stays within the Sejong-daero lanes. The north-end turn uses the
// Sajik-ro pullout by Dongsipjagak, leaving the pedestrian island on the bus's right.
const itineraries=[
  {travelMs:83_000,points:[deoksugung.berth,point(484,222),point(487.4,247),point(490.3,278),point(490.7,297),
    point(493.4,305.2),point(502.8,309),point(511.6,306.6),point(516.3,299.1),point(516.1,285),point(513.4,256),
    point(513.3,135),point(512.5,-70),point(512.2,-240),point(513.6,-292),point(515.3,-301),plazaEast(16),plazaEast(131),
    plazaEast(239),plazaEast(290),plazaEast(335),point(north.x,north.y+10),plazaNorth.berth]},
  {travelMs:35_000,points:[plazaNorth.berth,point(north.x,north.y-11),plazaEast(386),plazaEast(440),plazaEast(476,5.8),
    plazaEast(505,7.0),plazaEast(518,5.1),plazaEast(532),point(524,-832.3),point(536,-834.4),point(592,-834.4),
    point(625,-834),point(634,-829.2),point(639,eastIsland.y),gyeongbokgung.berth]},
  {travelMs:34_000,points:[gyeongbokgung.berth,point(660,eastIsland.y),point(667.5,eastIsland.y-.9),point(672,-833),
    point(671.7,-840.6),point(665.4,-844.4),point(652,-844.7),point(583,-844.7),point(528,-844.7),
    point(511,-844.5),point(499.2,-842.9),point(495,-836.5),point(494.7,-827.4),
    plazaWest(513),plazaWest(481),plazaWest(441),plazaWest(397),point(south.x,south.y-11),plazaSouth.berth]},
  {travelMs:68_000,points:[plazaSouth.berth,point(south.x,south.y+11),plazaWest(329),plazaWest(285),plazaWest(238),
    plazaWest(125),plazaWest(22),point(493.2,-286),point(486.9,-247),point(484.1,-176),point(484.4,-110),
    point(485.9,-34),point(488.7,61),point(489.6,113),point(488.3,150),point(484.8,180),point(484,194),deoksugung.berth]}
];

const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const interpolate=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const heading=(a,b)=>(Math.atan2(b.x-a.x,a.y-b.y)*180/Math.PI+360)%360;

// Short quadratic corner segments keep turns rounded while maintaining the street lane.
// The length table gives server and clients the same arc-length position and heading.
function buildPath(points){
  const path=[{...points[0],distance:0}];
  function append(p){
    const previous=path.at(-1),length=distance(previous,p);
    if(length>.001)path.push({...p,distance:previous.distance+length});
  }
  for(let i=1;i<points.length-1;i++){
    const from=points[i-1],centre=points[i],to=points[i+1];
    const previous=distance(from,centre),next=distance(centre,to);
    const cut=Math.min(5.4,previous*.28,next*.28);
    const approach=interpolate(centre,from,cut/previous),leave=interpolate(centre,to,cut/next);
    append(approach);
    for(let j=1;j<=8;j++){
      const t=j/8;
      append(interpolate(interpolate(approach,centre,t),interpolate(centre,leave,t),t));
    }
  }
  append(points.at(-1));
  return path;
}

let stopOffset=0;
const route=itineraries.map(leg=>{
  const offset=stopOffset;
  stopOffset+=BUS_DWELL_MS+leg.travelMs;
  return {...leg,offset,path:buildPath(leg.points)};
});
const cyclePhase=(time,offset,period)=>((time-epoch-offset)%period+period)%period;
function pointAtDistance(path,target){
  if(target<=0)return path[0];
  if(target>=path.at(-1).distance)return path.at(-1);
  let low=1,high=path.length-1;
  while(low<high){
    const middle=(low+high)>>1;
    if(path[middle].distance<target)low=middle+1;else high=middle;
  }
  const from=path[low-1],to=path[low];
  return interpolate(from,to,(target-from.distance)/(to.distance-from.distance));
}

function traveled(elapsed,duration){
  const ramp=Math.min(4_100,duration*.18),cruise=duration-ramp;
  if(elapsed<=ramp)return elapsed*elapsed/(2*ramp*cruise);
  const left=duration-elapsed;
  if(left<ramp)return 1-left*left/(2*ramp*cruise);
  return (elapsed-ramp*.5)/cruise;
}

export function busAt(index,time){
  if(!Number.isInteger(index)||index<0||index>=BUS_COUNT||!Number.isFinite(time))return null;
  let phase=cyclePhase(time,-index*BUS_DEPARTURE_MS,BUS_CYCLE_MS);
  const id=`sejong-bus-${index+1}`;
  for(const [legIndex,leg] of route.entries()){
    const stop=busStops[legIndex],nextStopId=busStops[(legIndex+1)%busStops.length].id;
    if(phase<BUS_DWELL_MS){
      return {id,index,...stop.berth,stopId:stop.id,remaining:BUS_DWELL_MS-phase,elapsed:phase,
        traveling:false,nextStopId,eta:0};
    }
    phase-=BUS_DWELL_MS;
    if(phase<leg.travelMs){
      const length=leg.path.at(-1).distance,metres=length*traveled(phase,leg.travelMs);
      const p=pointAtDistance(leg.path,metres);
      const a=pointAtDistance(leg.path,Math.max(0,metres-.94));
      const b=pointAtDistance(leg.path,Math.min(length,metres+.94));
      return {id,index,...p,heading:heading(a,b),stopId:null,remaining:0,elapsed:phase,
        traveling:true,nextStopId,eta:leg.travelMs-phase};
    }
    phase-=leg.travelMs;
  }
  return null;
}

export function busStopTimes(stopId,time){
  const index=busStops.findIndex(stop=>stop.id===stopId);
  if(index<0||!Number.isFinite(time))return null;
  const phase=cyclePhase(time,route[index].offset,BUS_DEPARTURE_MS);
  return {
    arrivalMs:BUS_DEPARTURE_MS-phase,
    departureMs:phase<BUS_DWELL_MS?BUS_DWELL_MS-phase:null
  };
}

export function busWait(stopId,time){
  const schedule=busStopTimes(stopId,time);
  if(!schedule)return null;
  return schedule.departureMs===null?schedule.arrivalMs:0;
}

// +Z faces forward in the bus model; negative local X is the curb side in right-hand traffic.
export function busLocalPose(bus,side,forward){
  const theta=(180-bus.heading)*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
  return pose(bus.x+side*c+forward*s,bus.y-side*s+forward*c,bus.heading);
}

export function busSeatOffset(seat){
  if(!Number.isInteger(seat)||seat<0||seat>=BUS_SEATS)return null;
  return {side:seat%2===0?.66:-.66,forward:1.32-Math.floor(seat/2)*1.15};
}

export function busSeatPose(bus,seat){
  const offset=busSeatOffset(seat);
  return bus&&offset?busLocalPose(bus,offset.side,offset.forward):null;
}

export function nearBus(position,time,reach=BUS_BOARD_REACH){
  if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y)||!Number.isFinite(reach)||reach<=0)return null;
  let nearest=null,minimum=reach;
  for(let index=0;index<BUS_COUNT;index++){
    const bus=busAt(index,time),stop=busStopById(bus?.stopId);
    if(!stop)continue;
    const gap=distance(position,stop.board);
    if(gap<=minimum){nearest={bus,stop};minimum=gap;}
  }
  return nearest;
}
