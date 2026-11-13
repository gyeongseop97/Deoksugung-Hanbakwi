import {ITEMS} from "./activities.js";

export const ITEM_SLOTS=["item","secondItem"];
export const validItemSlot=slot=>ITEM_SLOTS.includes(slot);
export const handLabel=slot=>slot==="secondItem"?"오른손":"왼손";

export function itemAnimating(item,time){
  return Boolean(item&&time-item.started<ITEMS[item.kind].duration);
}
export function freeItemSlot(avatar,time){
  return ITEM_SLOTS.find(slot=>!avatar[slot]?.remaining&&!itemAnimating(avatar[slot],time));
}
