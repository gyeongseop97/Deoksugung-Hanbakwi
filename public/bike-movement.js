import {clearSegment} from "./layout.js";
import {gbWoldae,onWoldaeApproach} from "./gyeongbok-layout.js";

export function canRideBikeSegment(from,to){
  // The low Woldae terraces lead straight through the gate arches.
  const clearance=onWoldaeApproach(from)||onWoldaeApproach(to)?gbWoldae.tier*2:.18;
  return clearSegment(from,to,.28,clearance);
}
