import {passportStamps} from "./passport-data.js";
import {HEADWEAR} from "./wearable-options.js";

const storageKey="jeongdong-passport-v1";
const knownStamps=new Set(passportStamps.map(stamp=>stamp.id));
const catId=/^[a-z0-9-]{1,32}$/;
const roomId=/^[a-f0-9]{32}$/;
const actionToken=/^[a-z0-9-]{1,40}$/;
const outfits=["coat","puffer","tee","hanbok"];
const time=value=>Number.isSafeInteger(value)&&value>=0&&value<=9_999_999_999_999?value:0;
const count=value=>Math.min(99_999,time(value));
const name=value=>typeof value==="string"?[...value.normalize("NFC").replace(/[\p{Cc}\p{Bidi_Control}]/gu,"").trim()].slice(0,40).join(""):"";
export const isFriendlyCat=cat=>cat.pets>=3||cat.treats>=1;

export function cleanPassport(value){
  const stamps=Object.fromEntries(Object.entries(value?.stamps??{}).filter(([id,at])=>knownStamps.has(id)&&time(at)>0));
  const cats=[],seen=new Set();
  for(const cat of Array.isArray(value?.cats)?value.cats:[]){
    if(!cat||typeof cat.id!=="string"||!catId.test(cat.id)||typeof cat.room!=="string"||!roomId.test(cat.room))continue;
    const key=cat.room+":"+cat.id;
    if(seen.has(key))continue;
    seen.add(key);
    cats.push({room:cat.room,id:cat.id,name:name(cat.name)||"고양이",pets:count(cat.pets),treats:count(cat.treats),
      at:time(cat.at),favorite:cat.favorite===true,petToken:typeof cat.petToken==="string"&&actionToken.test(cat.petToken)?cat.petToken:null,
      feedToken:typeof cat.feedToken==="string"&&actionToken.test(cat.feedToken)?cat.feedToken:null});
  }
  const rental=value?.rental;
  return {stamps,cats,rental:outfits.includes(rental?.outfit)&&HEADWEAR.includes(rental.headwear)?{
    outfit:rental.outfit,headwear:rental.headwear}:null};
}

export function makePassportProgress(storage){
  function read(){
    try{const saved=storage?.getItem(storageKey);return saved?cleanPassport(JSON.parse(saved)):null;}catch{return null;}
  }
  let data=read()??cleanPassport(null);
  function save(next){
    data=next;
    try{storage?.setItem(storageKey,JSON.stringify(data));}catch{}
  }
  function update(action){
    const next=read()??structuredClone(data),result=action(next);
    if(result)save(next);else data=next;
    return result;
  }
  return {
    data:()=>data,
    replace(value){save(cleanPassport(value));},
    visit(ids,at=Date.now()){
      if(!ids.some(id=>knownStamps.has(id)&&!data.stamps[id]))return [];
      return update(next=>{
        const added=[];
        for(const id of ids)if(knownStamps.has(id)&&!next.stamps[id]){next.stamps[id]=at;added.push(id);}
        return added;
      });
    },
    record(room,id,catName,action,token,at=Date.now()){
      if(!roomId.test(room??"")||!catId.test(id??"")||!actionToken.test(String(token??"")))return null;
      return update(next=>{
        let cat=next.cats.find(item=>item.room===room&&item.id===id);
        if(!cat){cat={room,id,name:name(catName)||"고양이",pets:0,treats:0,at,favorite:false,petToken:null,feedToken:null};next.cats.push(cat);}
        const field=action==="feed"?"feedToken":"petToken",counter=action==="feed"?"treats":"pets";
        if(cat[field]===String(token))return null;
        const friendly=isFriendlyCat(cat);
        cat[field]=String(token);cat[counter]=Math.min(99_999,cat[counter]+1);cat.at=at;
        cat.name=name(catName)||cat.name;
        return {cat,newFriend:!friendly&&isFriendlyCat(cat)};
      });
    },
    toggleFavorite(room,id){
      return update(next=>{
        const cat=next.cats.find(item=>item.room===room&&item.id===id);
        if(!cat||!isFriendlyCat(cat))return null;
        cat.favorite=!cat.favorite;return cat;
      });
    },
    setRental(look){
      return update(next=>{
        next.rental=look?{outfit:look.outfit,headwear:look.headwear??"none"}:null;
        return true;
      });
    }
  };
}
