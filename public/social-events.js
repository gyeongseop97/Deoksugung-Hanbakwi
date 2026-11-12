import {ITEMS,JUMP_MS} from "./activities.js";
import {isCycling} from "./sejong-bike.js";

export const CLINK_REACH=1.35;
export const CLINK_INVITE_MS=15_000;
export const CLINK_LEAD_MS=500;
export const CLINK_DURATION_MS=2_200;

export const CLINK_DRINKS=Object.fromEntries(Object.entries(ITEMS)
  .filter(([,item])=>item.verb==="마시기").map(([kind,item])=>[kind,item.duration]));

export function canClink(avatar,time){
  const item=avatar?.item;
  return Boolean(item?.remaining>0&&Object.hasOwn(CLINK_DRINKS,item.kind)&&
    time-item.started>=CLINK_DRINKS[item.kind]&&avatar.seat==null&&
    time-(avatar.jump??0)>=JUMP_MS&&!avatar.bus&&!isCycling(avatar));
}
