import {ITEMS} from "./activities.js";
import {isPicnicItem,nearestPicnic,picnicBlanketFits,picnicGap,picnicHandReady,PICNIC_OFFER_MS,PICNIC_REACH,PICNIC_SLOTS} from "./picnic-data.js";

const token=()=>crypto.randomUUID().replaceAll("-","");
const notices={
  open:"돗자리를 펼쳤어요.",place:"돗자리에 한 몫을 올렸어요.",offer:"친구에게 한 몫을 건넸어요.",
  take:"한 몫을 받았어요. 산책 화면에서 먹거나 마실 수 있어요."
};
const unavailable={
  open:"이 자리에는 돗자리를 펼칠 수 없어요. 잔디 안쪽에서 다시 시도해 주세요.",
  place:"음식을 올리지 못했어요. 돗자리와 손에 든 음식을 확인해 주세요.",
  offer:"친구에게 건네지 못했어요. 가까이에서 다시 시도해 주세요.",
  take:"한 몫을 받지 못했어요. 돗자리와 손에 든 음식을 확인해 주세요.",
  close:"돗자리를 접으려면 올려 둔 음식을 먼저 나눠 주세요."
};

export function makePicnic({send,self,getAvatar,getPeople,focusGame,onOffer,now=Date.now}){
  const dialog=document.createElement("dialog");
  dialog.className="picnic-dialog";dialog.setAttribute("aria-labelledby","picnic-title");
  dialog.innerHTML=`
    <header class="picnic-header">
      <div><p data-place>육조마당</p><h2 id="picnic-title">잔디밭 피크닉</h2></div>
      <button type="button" class="quiet picnic-close" data-close aria-label="닫기">×</button>
    </header>
    <p class="picnic-status" role="status" data-status hidden></p>
    <button type="button" class="primary picnic-place" data-place-item hidden></button>
    <p class="picnic-hint" data-hint></p>
    <ul class="picnic-food" data-food aria-label="돗자리에 올린 음식"></ul>
    <form class="picnic-share" data-share hidden>
      <label for="picnic-friend">받을 친구</label>
      <div><select id="picnic-friend" name="target"></select>
        <button type="submit" class="primary">건네기</button>
        <button type="button" class="quiet" data-cancel>취소</button>
      </div>
    </form>
    <button type="button" class="quiet picnic-pack" data-pack hidden>돗자리 접기</button>`;
  document.body.append(dialog);
  const find=selector=>dialog.querySelector(selector);
  const place=find("[data-place]"),status=find("[data-status]"),hint=find("[data-hint]"),add=find("[data-place-item]"),
    food=find("[data-food]"),pack=find("[data-pack]"),share=find("[data-share]"),friend=find("#picnic-friend"),close=find("[data-close]");
  let mats=[],selected=null,pending=null,offering=null,notice="",foodsKey="",friendsKey="";
  const seenOffers=new Map();
  const current=()=>mats.find(mat=>mat.id===selected);
  const nearby=point=>nearestPicnic(point,mats);
  const online=()=>navigator.onLine!==false;

  function peersAt(point,mat){
    if(!point||!mat)return [];
    return (getPeople?.()??[]).filter(peer=>peer.id!==self()&&peer.nickname&&
      picnicGap(peer,mat)<=PICNIC_REACH&&picnicGap(peer,point)<=PICNIC_REACH)
      .map(({id,nickname})=>({id,nickname}));
  }

  function foodRows(mat,canTake,canOffer){
    const key=JSON.stringify([mat?.id,mat?.items,self(),canTake,canOffer,offering]);
    if(foodsKey===key)return;
    foodsKey=key;
    const focused=food.contains(document.activeElement)?document.activeElement:null;
    const fragment=document.createDocumentFragment(),names=new Map((getPeople?.()??[]).map(peer=>[peer.id,peer.nickname]));
    for(const item of [...(mat?.items??[])].sort((a,b)=>a.slot-b.slot)){
      const row=document.createElement("li"),description=document.createElement("div"),title=document.createElement("strong");
      const detail=document.createElement("small"),buttons=document.createElement("div"),own=item.owner===self();
      title.textContent=ITEMS[item.kind].name;
      detail.textContent=item.target===self()?item.nickname+"님이 건넨 음식":
        item.target?item.nickname+"님 · "+(names.get(item.target)??"친구")+"에게 건넴":item.nickname+"님이 올림";
      description.append(title,detail);buttons.className="picnic-food-actions";
      if(!item.target||item.target===self()||own){
        const take=document.createElement("button");take.type="button";take.className=item.target===self()?"primary":"quiet";
        take.dataset.take=item.id;take.textContent=own?"거두기":"한 몫 받기";take.disabled=!canTake;buttons.append(take);
      }
      if(own&&canOffer){
        const offer=document.createElement("button");offer.type="button";offer.className="quiet";
        offer.dataset.offer=item.id;offer.setAttribute("aria-expanded",String(offering===item.id));
        offer.textContent="친구에게 건네기";buttons.append(offer);
      }
      row.append(description,buttons);fragment.append(row);
    }
    food.replaceChildren(fragment);
    if(focused){
      const next=[...food.querySelectorAll("button:not([disabled])")].find(button=>
        focused.dataset.take&&button.dataset.take===focused.dataset.take||
        focused.dataset.offer&&button.dataset.offer===focused.dataset.offer);
      (next??close).focus({preventScroll:true});
    }
  }

  function render(){
    if(!dialog.open)return;
    const mat=current(),avatar=getAvatar(),item=avatar?.item,peers=peersAt(avatar,mat),time=now();
    const reachable=Boolean(avatar&&mat&&picnicGap(avatar,mat)<=PICNIC_REACH),busy=Boolean(pending||!online());
    const own=mat?.owner===self(),hasFood=isPicnicItem(item?.kind)&&item.remaining>0;
    const hasRoom=(mat?.items.length??0)<PICNIC_SLOTS.length,ready=picnicHandReady(avatar,time);
    const activeOffer=mat?.items.some(row=>row.id===offering&&row.owner===self())&&peers.length>0;
    if(!activeOffer)offering=null;
    place.textContent=mat?mat.nickname+"님의 돗자리 · 육조마당":"육조마당";
    const message=!online()?"연결이 돌아오면 다시 사용할 수 있어요.":
      pending?pending.action==="open"?"돗자리를 펴는 중이에요.":"친구와 동기화하고 있어요.":notice;
    status.textContent=message;status.hidden=!message;
    add.hidden=!mat||!hasFood||!hasRoom;
    if(!add.hidden)add.textContent=ITEMS[item.kind].name+" 한 몫 올리기";
    add.disabled=busy||!reachable||!hasFood||time-(item?.started??0)<(ITEMS[item?.kind]?.duration??0);
    hint.textContent=!mat?"":!reachable?"돗자리 가까이에서 음식을 나눌 수 있어요.":!hasRoom?"돗자리에 음식이 가득해요.":
      !ready&&mat.items.length?"받으려면 손에 든 음식을 먼저 사용해 주세요.":
      hasFood?"음식을 올리면 친구가 한 몫을 받을 수 있어요.":"음식이나 음료를 들고 오면 함께 나눌 수 있어요.";
    hint.hidden=!hint.textContent;
    foodRows(mat,reachable&&ready&&!busy,reachable&&peers.length>0&&!busy);
    pack.hidden=!mat||!own;pack.disabled=busy||!reachable||Boolean(mat?.items.length);
    share.hidden=!offering;friend.disabled=busy||!reachable;
    share.querySelector('button[type="submit"]').disabled=busy||!reachable;
    const peerKey=JSON.stringify(peers);
    if(friendsKey!==peerKey){
      const chosen=friend.value;
      friendsKey=peerKey;friend.replaceChildren();
      for(const peer of peers){
        const option=document.createElement("option");option.value=peer.id;option.textContent=peer.nickname;friend.append(option);
      }
      if(peers.some(peer=>peer.id===chosen))friend.value=chosen;
    }
  }

  function submit(action,details={}){
    if(pending||!online())return null;
    const command={id:token(),action,...details};
    pending=command;notice="";
    if(send(command)===false){pending=null;return null;}
    render();return command;
  }
  function label(point){
    if(!point)return null;
    if(nearby(point))return "피크닉 함께하기";
    return picnicBlanketFits(point)&&!mats.some(mat=>mat.owner===self())?"돗자리 펴기":null;
  }
  function open(point){
    const mat=nearby(point);
    if(dialog.open||!mat&&!label(point))return false;
    if(!mat&&(pending||!online()))return false;
    selected=mat?.id??null;offering=null;notice="";
    dialog.showModal();
    if(!mat){
      const command=submit("open",{x:point.x,y:point.y});
      if(!command){dialog.close();return false;}
      selected=command.id;
    }
    render();return true;
  }
  function receive(states,sent,result){
    mats=states;
    if(onOffer){
      const player=self(),time=now();
      for(const [key,at] of seenOffers)if(time-at>PICNIC_OFFER_MS)seenOffers.delete(key);
      for(const mat of mats)for(const item of mat.items){
        if(!player||item.target!==player||!item.offered)continue;
        const key=item.id+"/"+item.offered;
        if(seenOffers.has(key))continue;
        seenOffers.set(key,time);onOffer(item,mat);
      }
    }
    if(sent&&pending?.id===sent.id){
      pending=null;
      if(dialog.open&&(selected===sent.mat||selected===sent.id)){
        notice=result==="accepted"?notices[sent.action]??"":unavailable[sent.action];
        if(sent.action==="offer")offering=null;
        if(sent.action==="close"&&result==="accepted"){dialog.close();return;}
      }
    }
    if(dialog.open&&selected&&!current()&&!pending&&!notice)notice="이 돗자리는 접혔어요.";
    render();
  }
  function reset(){
    mats=[];selected=pending=offering=null;notice=foodsKey=friendsKey="";
    seenOffers.clear();
    if(dialog.open)dialog.close();
  }

  add.addEventListener("click",()=>{
    if(current()&&!add.disabled)submit("place",{mat:selected,kind:getAvatar().item?.kind});
  });
  pack.addEventListener("click",()=>{if(current()&&!pack.disabled)submit("close",{mat:selected});});
  food.addEventListener("click",event=>{
    const button=event.target.closest("button");
    if(!button||button.disabled||!current())return;
    if(button.dataset.take)submit("take",{mat:selected,item:button.dataset.take});
    if(button.dataset.offer){
      offering=offering===button.dataset.offer?null:button.dataset.offer;
      render();if(offering)friend.focus();
    }
  });
  share.addEventListener("submit",event=>{
    event.preventDefault();
    if(offering&&friend.value&&!friend.disabled)submit("offer",{mat:selected,item:offering,target:friend.value});
  });
  find("[data-cancel]").addEventListener("click",()=>{offering=null;render();});
  close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();dialog.close();}
  });
  dialog.addEventListener("close",()=>{
    if(dialog.open)return;
    selected=offering=null;notice="";focusGame?.();
  });
  window.addEventListener("online",render);window.addEventListener("offline",render);
  return {nearby,label,open,receive,reset,states:()=>mats};
}
