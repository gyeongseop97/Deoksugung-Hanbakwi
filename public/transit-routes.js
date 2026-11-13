import {subwayStops} from "./gyeongbok-layout.js";
import {plazaTransitStops} from "./plaza-layout.js";
import {expandedSubwayStops} from "./subway-expansion.js";

export const transitStops=[...subwayStops,...plazaTransitStops,...expandedSubwayStops];
const byId=new Map(transitStops.map(stop=>[stop.id,stop]));
const plazaByMode=new Map(plazaTransitStops.map(stop=>[stop.mode,stop]));
const stopsByMode={
  subway:["city-hall","gyeongbokgung"],
  bus:["bus-city-hall","bus-gyeongbokgung"]
};
const areas={
  "city-hall":"덕수궁","bus-city-hall":"덕수궁",
  "gyeongbokgung":"경복궁","bus-gyeongbokgung":"경복궁",
  "gwanghwamun-plaza":"광화문광장","bus-gwanghwamun-plaza":"광화문광장"
};
const subwayStation=stop=>stop.station??stop.name.split(" ")[0];

export function transitRoutes(stop){
  if(stop.mode==="subway"){
    const origin=subwayStation(stop);
    const targets=transitStops.filter(target=>target.mode==="subway"&&target!==stop);
    targets.sort((a,b)=>(subwayStation(a)!==origin)-(subwayStation(b)!==origin)||
      subwayStation(a).localeCompare(subwayStation(b),"ko")||a.name.localeCompare(b.name,"ko",{numeric:true}));
    return targets.map(target=>({target,area:target.name,station:subwayStation(target),
      line:subwayStation(target)===origin?"같은 역의 출구":origin+" → "+subwayStation(target)}));
  }
  const plaza=plazaByMode.get(stop.mode);
  const direct=byId.get(stop.to);
  const targets=stop===plaza?stopsByMode[stop.mode].map(id=>byId.get(id)):[direct,plaza];
  return targets.filter(Boolean).map(target=>({target,area:areas[target.id],
    line:target===direct&&stop.line?stop.line:stop.name+" → "+target.name}));
}
