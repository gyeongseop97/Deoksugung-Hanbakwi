import {subwayStops} from "./gyeongbok-layout.js";
import {plazaTransitStops} from "./plaza-layout.js";

export const transitStops=[...subwayStops,...plazaTransitStops];
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

export function transitRoutes(stop){
  const plaza=plazaByMode.get(stop.mode);
  const direct=byId.get(stop.to);
  const targets=stop===plaza?stopsByMode[stop.mode].map(id=>byId.get(id)):[direct,plaza];
  return targets.filter(Boolean).map(target=>({target,area:areas[target.id],
    line:target===direct&&stop.line?stop.line:stop.name+" → "+target.name}));
}
