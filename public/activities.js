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
  beer:{name:"맥주",verb:"마시기",uses:3,duration:1350},
  churu:{name:"츄르",verb:"간식 주기",uses:3,duration:FEED_MS}
};
