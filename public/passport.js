import {nearbyPassportStamps,nearHanbokRental,passportRegions,passportStamps} from "./passport-data.js";
import {isFriendlyCat,makePassportProgress} from "./passport-state.js";
import {drawPassportStamp} from "./passport-stamp.js";
import {exportWalkProfile,importWalkProfile} from "./profile-transfer.js";

export const passportMarkup=`
  <dialog class="passport-dialog" id="passport-dialog" aria-labelledby="passport-title">
    <header class="passport-heading">
      <div><h2 id="passport-title">산책 여권</h2><p id="passport-count"></p></div>
      <button class="quiet passport-close" type="button" aria-label="산책 여권 닫기" data-passport-close>×</button>
    </header>
    <nav class="passport-tabs" aria-label="산책 여권">
      <button class="quiet" type="button" data-passport-tab="stamps" aria-controls="passport-stamps" aria-pressed="true">도장</button>
      <button class="quiet" type="button" data-passport-tab="rewards" aria-controls="passport-rewards" aria-pressed="false">장신구</button>
      <button class="quiet" type="button" data-passport-tab="cats" aria-controls="passport-cats" aria-pressed="false">친해진 고양이</button>
      <button class="quiet" id="passport-album" type="button" data-open-photo-album>사진첩</button>
    </nav>
    <div class="passport-pages">
      <div id="passport-stamps" data-passport-page="stamps"></div>
      <div id="passport-rewards" data-passport-page="rewards" hidden></div>
      <div id="passport-cats" data-passport-page="cats" hidden></div>
    </div>
    <footer class="passport-footer"><button class="quiet" id="passport-transfer" type="button">이어하기 코드</button></footer>
  </dialog>
  <dialog class="passport-dialog passport-small" id="hanbok-dialog" aria-labelledby="hanbok-title">
    <header class="passport-heading"><h2 id="hanbok-title">기와 한복 대여소</h2>
      <button class="quiet passport-close" type="button" aria-label="한복 대여소 닫기" data-passport-close>×</button></header>
    <p class="passport-description">한복과 함께 쓸 모자를 골라 주세요.</p>
    <div class="passport-rental-options">
      <button class="quiet" type="button" data-hanbok="gat">한복과 갓</button>
      <button class="quiet" type="button" data-hanbok="jokduri">한복과 족두리</button>
      <button class="quiet" type="button" data-hanbok="none">한복만 입기</button>
    </div>
    <button class="quiet" id="return-hanbok" type="button" hidden>반납하고 이전 복장 입기</button>
  </dialog>
  <dialog class="passport-dialog passport-small" id="continue-dialog" aria-labelledby="continue-title">
    <header class="passport-heading"><h2 id="continue-title">이어하기 코드</h2>
      <button class="quiet passport-close" type="button" aria-label="이어하기 닫기" data-passport-close>×</button></header>
    <section class="passport-transfer-section">
      <p class="passport-description">코드를 만들면 닉네임, 복장, 도장, 고양이 기록과 사진을 서버에 저장해요. 코드를 가진 사람은 이 기록을 불러올 수 있어요.</p>
      <button class="primary" id="continue-export" type="button">기록을 저장하고 코드 만들기</button>
      <div class="passport-copy-code" id="continue-code-row" hidden>
        <input id="continue-code" readonly aria-label="생성된 이어하기 코드" spellcheck="false">
        <button class="quiet" id="continue-copy" type="button">복사</button>
      </div>
    </section>
    <form id="continue-import-form" class="passport-transfer-section">
      <label for="continue-input">다른 기기에서 만든 코드</label>
      <input id="continue-input" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="80" placeholder="이어하기 코드 입력">
      <button class="quiet" id="continue-import" type="submit">이 코드의 기록으로 이어하기</button>
    </form>
    <p id="continue-status" class="passport-status" role="status"></p>
  </dialog>`;

const stampById=new Map(passportStamps.map(stamp=>[stamp.id,stamp]));
const stampCount=passportStamps.length;
const formatDate=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"short",day:"numeric"});
const gotAll=(data,region)=>region.stamps.every(stamp=>Boolean(data.stamps[stamp.id]));

export function bindPassport({getLook,applyLook,getProfile,applyProfile,listPhotos,importPhotos,focusGame,onNotice=()=>{}}){
  const mount=document.getElementById("passport-mount");
  mount.innerHTML=passportMarkup;
  const $=id=>document.getElementById(id);
  const journal=$("passport-dialog"),rental=$("hanbok-dialog"),transfer=$("continue-dialog");
  const transferStatus=$("continue-status"),exportButton=$("continue-export"),importButton=$("continue-import");
  let storage;
  try{storage=localStorage;}catch{}
  const progress=makePassportProgress(storage);
  let room=null,tab="stamps",busy=false;
  const element=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const button=(text,className="quiet")=>Object.assign(element("button",className,text),{type:"button"});
  function show(dialog){if(!dialog.open)dialog.showModal();}
  function picture(motif,ink){const canvas=element("canvas","passport-mark");canvas.setAttribute("aria-hidden","true");drawPassportStamp(canvas,motif,ink);return canvas;}
  function selectTab(next){
    tab=next;
    for(const option of journal.querySelectorAll("[data-passport-tab]"))option.setAttribute("aria-pressed",String(option.dataset.passportTab===tab));
    for(const page of journal.querySelectorAll("[data-passport-page]"))page.hidden=page.dataset.passportPage!==tab;
    render();
  }
  function render(){
    const data=progress.data();
    $("passport-count").textContent=`도장 ${Object.keys(data.stamps).length} / ${stampCount}`;
    if(tab==="stamps"){
      const groups=passportRegions.map(region=>{
        const group=element("section","passport-region");
        const head=element("div","passport-region-heading");
        const count=region.stamps.filter(stamp=>data.stamps[stamp.id]).length;
        head.append(element("h3",null,region.name),element("span",null,`${count} / ${region.stamps.length}`));
        const grid=element("ul","passport-stamp-grid");
        for(const stamp of region.stamps){
          const at=data.stamps[stamp.id],entry=element("li",at?"passport-site stamped":"passport-site");
          entry.append(picture(stamp.motif,region.ink),element("strong",null,stamp.name),
            element("small",null,at?formatDate.format(at):"미방문"));
          grid.append(entry);
        }
        group.append(head,grid);return group;
      });
      $("passport-stamps").replaceChildren(...groups);
    }else if(tab==="rewards"){
      const look=getLook();
      const rewards=passportRegions.map(region=>{
        const reward=region.reward,unlocked=gotAll(data,region),wearing=look[reward.field]===reward.value;
        const card=element("article","passport-reward"),copy=element("div");
        copy.append(element("strong",null,reward.name),element("small",null,unlocked?region.name:`${region.name} 도장 ${region.stamps.length}개`));
        const wear=button(wearing?"벗기":unlocked?"착용":"잠김");wear.disabled=!unlocked;
        wear.addEventListener("click",()=>{applyLook({[reward.field]:wearing?"none":reward.value});render();});
        card.append(picture(reward.motif,region.ink),copy,wear);return card;
      });
      if(data.rental){const restore=button("한복 반납하고 이전 복장 입기");restore.addEventListener("click",returnRental);rewards.push(restore);}
      $("passport-rewards").replaceChildren(...rewards);
    }else{
      const cats=data.cats.toSorted((a,b)=>Number(b.favorite)-Number(a.favorite)||Number(isFriendlyCat(b))-Number(isFriendlyCat(a))||b.at-a.at);
      const rows=cats.map(cat=>{
        const card=element("article","passport-cat"),copy=element("div"),friendly=isFriendlyCat(cat);
        copy.append(element("strong",null,cat.name),element("small",null,`쓰다듬기 ${cat.pets}회 · 간식 ${cat.treats}회`));
        const star=button(cat.favorite?"★":"☆");star.disabled=!friendly;
        star.setAttribute("aria-label",cat.name+" 즐겨찾기");star.setAttribute("aria-pressed",String(cat.favorite));
        star.addEventListener("click",()=>{progress.toggleFavorite(cat.room,cat.id);render();});
        card.append(copy,element("span","passport-cat-badge",friendly?"친구":"친해지는 중"),star);return card;
      });
      if(!rows.length)rows.push(element("p","passport-description","같은 고양이를 세 번 쓰다듬거나 간식을 한 번 주면 친구가 돼요."));
      $("passport-cats").replaceChildren(...rows);
    }
  }
  function recordCat(id,name,action,token){
    const result=progress.record(room,id,name,action,token);
    if(result?.newFriend)onNotice(result.cat.name+"와 친해졌어요.");
    if(result&&journal.open)render();
  }
  function visit(point){
    const found=nearbyPassportStamps(point);
    if(!found.length)return [];
    const before=passportRegions.filter(region=>gotAll(progress.data(),region));
    const added=progress.visit(found.map(stamp=>stamp.id));
    if(!added.length)return added;
    const unlocked=passportRegions.filter(region=>!before.includes(region)&&gotAll(progress.data(),region));
    const names=added.map(id=>stampById.get(id).name);
    onNotice(`${names.join(" · ")} 도장을 받았어요.${unlocked.length?` ${unlocked.map(region=>region.reward.name).join(" · ")}을 받았어요.`:""}`);
    if(journal.open)render();
    return added;
  }
  function returnRental(){
    const previous=progress.data().rental;
    if(!previous)return;
    applyLook(previous);progress.setRental(null);
    $("return-hanbok").hidden=true;
    if(journal.open)render();
    rental.close();onNotice("한복을 반납하고 이전 복장으로 돌아왔어요.");
  }
  function openTransfer(){if(journal.open)journal.close();show(transfer);}
  for(const dialog of [journal,rental,transfer]){
    dialog.querySelector("[data-passport-close]").addEventListener("click",()=>dialog.close());
    dialog.addEventListener("close",()=>{if(!document.querySelector("dialog[open]"))focusGame?.();});
  }
  journal.querySelector(".passport-tabs").addEventListener("click",event=>{
    const tabButton=event.target.closest("[data-passport-tab]");if(tabButton)selectTab(tabButton.dataset.passportTab);
  });
  $("passport-album").addEventListener("click",()=>journal.close());
  $("passport-transfer").addEventListener("click",openTransfer);
  rental.querySelector(".passport-rental-options").addEventListener("click",event=>{
    const headwear=event.target.closest("[data-hanbok]")?.dataset.hanbok;
    if(!headwear)return;
    if(!progress.data().rental)progress.setRental(getLook());
    applyLook({outfit:"hanbok",headwear});rental.close();onNotice("한복을 빌렸어요.");
  });
  $("return-hanbok").addEventListener("click",returnRental);
  function setBusy(value){busy=value;exportButton.disabled=importButton.disabled=value;}
  const status=message=>{transferStatus.textContent=message;};
  const photoProgress=(done,total)=>{if(total)status(`사진 전송 중 · ${done} / ${total}`);};
  exportButton.addEventListener("click",async()=>{
    if(busy)return;
    const profile=getProfile();
    if(!profile?.nickname?.trim()){status("닉네임을 입력한 뒤 코드를 만들어 주세요.");return;}
    setBusy(true);$("continue-code-row").hidden=true;status("산책 기록을 저장하고 있어요.");
    try{
      const code=await exportWalkProfile({...profile,progress:progress.data()},await listPhotos(),photoProgress);
      $("continue-code").value=code;$("continue-code-row").hidden=false;status("다른 기기에서 이 코드를 입력해 주세요.");
    }catch(error){status(error.message||"코드를 만들지 못했어요.");}finally{setBusy(false);}
  });
  $("continue-copy").addEventListener("click",async()=>{
    const output=$("continue-code");
    try{await navigator.clipboard.writeText(output.value);status("코드를 복사했어요.");}
    catch{output.focus();output.select();status("선택한 코드를 복사해 주세요.");}
  });
  $("continue-import-form").addEventListener("submit",async event=>{
    event.preventDefault();if(busy)return;
    setBusy(true);status("산책 기록을 불러오고 있어요.");
    try{
      const {profile,photos}=await importWalkProfile($("continue-input").value,photoProgress);
      await importPhotos(photos);await applyProfile(profile);progress.replace(profile.progress);
      $("continue-input").value="";status("산책 기록을 불러왔어요.");onNotice("이어하기 기록을 불러왔어요.");
    }catch(error){status(error.message||"기록을 불러오지 못했어요.");}finally{setBusy(false);}
  });
  return {
    visit,visited:id=>Boolean(progress.data().stamps[id]),visitedIds:()=>Object.keys(progress.data().stamps),
    setRoom:value=>{room=value;},petCat:(id,name,token)=>recordCat(id,name,"pet",token),feedCat:(id,name,token)=>recordCat(id,name,"feed",token),
    open(){selectTab("stamps");show(journal);},nearRental:nearHanbokRental,openRental(){
      $("return-hanbok").hidden=!progress.data().rental;show(rental);
    },returnRental,openTransfer
  };
}
