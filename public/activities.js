export const PET_MS=1450;
export const FEED_MS=5000;
export const JUMP_MS=740;
export const JUMP_HEIGHT=.88;
export function jumpLift(avatar,clock){
  const age=clock-avatar.jump;
  if(!avatar.jump||age<=0||age>=JUMP_MS)return 0;
  const phase=age/JUMP_MS;
  return JUMP_HEIGHT*4*phase*(1-phase);
}
const crepe={name:"크레페",verb:"먹기",uses:3,duration:1300};
export const ITEMS={
  sparkler:{name:"스파클",verb:"사용하기",uses:1,duration:8000},
  coffee:{name:"커피",verb:"마시기",uses:3,duration:1150},
  crepe,parfait:crepe,
  beer:{name:"맥주",verb:"마시기",uses:3,duration:1350,alcohol:true},
  yakgwa:{name:"약과",verb:"먹기",uses:3,duration:1300},
  cake:{name:"조각 케이크",verb:"먹기",uses:3,duration:1300},
  makgeolli:{name:"막걸리",verb:"마시기",uses:3,duration:1350,alcohol:true},
  wine:{name:"와인",verb:"마시기",uses:3,duration:1350,alcohol:true},
  churu:{name:"츄르",verb:"간식 주기",uses:3,duration:FEED_MS}
};

export function avatarHands(avatar,clock,{riding,seated,walking}){
  const claspSide=!riding&&(avatar.hand===-1||avatar.hand===1)?avatar.hand:0;
  const item=avatar.item,spec=ITEMS[item?.kind];
  const itemAge=item?.started?Math.max(0,clock-item.started):Infinity;
  const carrying=Boolean(!riding&&spec&&(item.remaining>0||itemAge<spec.duration));
  const feedAge=clock-avatar.feed?.at,petAge=clock-avatar.pet?.at;
  const canInteract=!seated&&!riding&&!walking&&!claspSide;
  const feeding=canInteract&&item?.kind==="churu"&&feedAge>=0&&feedAge<FEED_MS;
  const petting=canInteract&&!feeding&&petAge>=0&&petAge<PET_MS;
  // The avatar faces local +Z, so local +X is the avatar's left hand.
  const itemSide=claspSide?-claspSide:petting?-1:1;
  const waveSide=claspSide?-claspSide:carrying?-1:1;
  return {claspSide,item,spec,itemAge,carrying,feedAge,feeding,petAge,petting,itemSide,waveSide};
}
