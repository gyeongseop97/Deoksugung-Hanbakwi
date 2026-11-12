import {gameApiUrl} from "./hosting.js";

export const PHOTO_CHUNK_BYTES=144*1024;
export const normalizeContinueCode=value=>String(value??"").replace(/[\s-]+/g,"").toLowerCase();
export const displayContinueCode=code=>code.match(/.{1,4}/g)?.join("-")??code;

async function request(body){
  const response=await fetch(gameApiUrl("/api/profile"),{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30_000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error??"이어하기 코드를 처리하지 못했어요.");
  return result;
}

function base64(bytes){
  let text="";
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}

async function parallel(tasks,run){
  let next=0,failed=false;
  async function worker(){
    while(!failed&&next<tasks.length){
      const index=next++;
      try{await run(tasks[index],index);}catch(error){failed=true;throw error;}
    }
  }
  await Promise.all(Array.from({length:Math.min(3,tasks.length)},worker));
}

export async function exportWalkProfile(profile,photos,onProgress=()=>{}){
  const manifest=photos.map(({id,date,place,mode,blob})=>({id,date,place,mode,size:blob.size,mime:blob.type||"image/jpeg"}));
  const {code,uploadKey}=await request({action:"create",profile,photos:manifest});
  const tasks=photos.flatMap(photo=>Array.from({length:Math.ceil(photo.blob.size/PHOTO_CHUNK_BYTES)},(_,part)=>({photo,part})));
  let completed=0;onProgress(0,tasks.length);
  await parallel(tasks,async({photo,part})=>{
    const start=part*PHOTO_CHUNK_BYTES,buffer=await photo.blob.slice(start,start+PHOTO_CHUNK_BYTES).arrayBuffer();
    await request({action:"upload",code,uploadKey,id:photo.id,part,data:base64(new Uint8Array(buffer))});
    onProgress(++completed,tasks.length);
  });
  await request({action:"finish",code,uploadKey});
  return displayContinueCode(code);
}

export async function importWalkProfile(value,onProgress=()=>{}){
  const code=normalizeContinueCode(value);
  if(!/^[a-f0-9]{32}$/.test(code))throw Error("이어하기 코드 32자리를 확인해 주세요.");
  const {profile,photos}=await request({action:"read",code});
  const chunks=photos.map(photo=>Array(Math.ceil(photo.size/PHOTO_CHUNK_BYTES)));
  const tasks=chunks.flatMap((parts,index)=>Array.from({length:parts.length},(_,part)=>({index,part})));
  let completed=0;onProgress(0,tasks.length);
  await parallel(tasks,async({index,part})=>{
    const {data}=await request({action:"download",code,id:photos[index].id,part});
    chunks[index][part]=Uint8Array.from(atob(data),character=>character.charCodeAt(0));
    onProgress(++completed,tasks.length);
  });
  return {profile,photos:photos.map(({id,date,place,mode,mime},index)=>({id,date,place,mode,blob:new Blob(chunks[index],{type:mime})}))};
}
