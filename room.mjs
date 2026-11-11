import {validWishArt, WISH_FLIGHT_MS} from "./public/wish-art.js";
import {FEED_MS, ITEMS} from "./public/activities.js";
import {isInsideMuseum} from "./public/visit-layout.js";

const json = (data, status = 200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const validId = (value) => typeof value==="string" && /^[a-f0-9]{32}$/.test(value);
const finite = (value,min,max) => typeof value==="number" && value>=min && value<=max;
const validPoint = (point) => point && finite(point.x,0,600) && finite(point.y,0,450);
const validTime = (value) => finite(value,0,9999999999999);
const reactions = new Set(["😊","😂","❤️","👍","😮","😢","😠","✨"]);
const hairStyles = new Set(["short","bob","long","bun"]);
const eyeStyles = new Set(["round","soft","bright"]);
const outfitStyles = new Set(["coat","hoodie","puffer","tee","hanbok"]);
const validLook = (look) => look==null ||
  hairStyles.has(look.hair) && eyeStyles.has(look.eyes) && outfitStyles.has(look.outfit);
const validAvatar = (a) => validPoint(a) &&
  (a.character===undefined || a.character==="man" || a.character==="woman") &&
  validLook(a.look) &&
  (a.wave===undefined || finite(a.wave,0,9999999999999)) &&
  (a.emote==null || reactions.has(a.emote.emoji) && finite(a.emote.at,0,9999999999999)) &&
  (a.vx===undefined || finite(a.vx,-8,8)) && (a.vy===undefined || finite(a.vy,-8,8)) &&
  (a.blocked===undefined || typeof a.blocked==="boolean") &&
  (a.heading===undefined || finite(a.heading,0,360)) &&
  (a.seat==null || Number.isInteger(a.seat) && finite(a.seat,0,80)) &&
  (a.seatSide==null || (a.seatSide===0 || a.seatSide===1) && a.seat!=null) &&
  (a.running===undefined || typeof a.running==="boolean") &&
  (a.wish===undefined || validTime(a.wish)) &&
  (a.wishOrigin==null || validPoint(a.wishOrigin)) &&
  (a.wishHeading===undefined || finite(a.wishHeading,0,360)) &&
  (a.wishArt==null || a.wish>0 && validPoint(a.wishOrigin) && validWishArt(a.wishArt)) &&
  (a.item==null || typeof a.item.kind==="string" && Object.hasOwn(ITEMS,a.item.kind) && Number.isInteger(a.item.remaining) &&
    finite(a.item.remaining,0,ITEMS[a.item.kind].uses) && validTime(a.item.started)) &&
  (a.blushUntil===undefined || validTime(a.blushUntil)) &&
  (a.blushLevel===undefined || Number.isInteger(a.blushLevel) && finite(a.blushLevel,0,3)) &&
  (a.pet==null || typeof a.pet.id==="string" && /^[a-z0-9-]{1,32}$/.test(a.pet.id) && validTime(a.pet.at));
const validView = (v) => v && finite(v.pan,-720,720) && finite(v.tilt,-90,90) &&
  finite(v.zoom,-3,3) && (v.night===undefined || typeof v.night==="boolean");
const validSignal = (signal,self) => validId(signal?.id) && (signal.audience===undefined?
  validView(signal.view)&&(signal.point===undefined||validPoint(signal.point)):
  validPoint(signal.point)&&(signal.audience==="nearby"||signal.audience==="room"||
    signal.audience==="person"&&validId(signal.target)&&signal.target!==self));
const validHand = (h) => h && validId(h.id) && (h.action==="release" ||
  (h.side===-1 || h.side===1) && (h.action==="accept" || h.action==="offer" && validId(h.peer)));
const validFeed = (feed) => feed && validId(feed.claim) && validTime(feed.at) &&
  typeof feed.id==="string" && /^[a-z0-9-]{1,32}$/.test(feed.id);

const codeAlphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const openRoomId="00000000000000000000000000000001";
const lookPingLifetime=5000,lookPingDistance=40;
const clothes=[
  0xb85545,0x308070,0x5f75bb,0xb77934,0xa2548c,0x6d8647,0x3084a2,0xb34762,
  0x9474bb,0x33716b,0xcc9250,0x5568a3,0x917249,0x8d4844,0x4f8858,0x8358a1,
  0xa15163,0x396c8e,0x70854a,0xb86c53,0x449b91,0x586d95,0xba734b,0xa25f8d,
  0x556f50,0x577bb4,0xa99646,0x8d5273,0x546fc4,0x478d74,0xb65b73,0x8c785f
];
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),
  byte=>codeAlphabet[byte%codeAlphabet.length]).join("");
const newId=()=>crypto.randomUUID().replaceAll("-","");
const validCode=(value)=>typeof value==="string" && /^[A-HJ-NP-Z2-9]{8}$/.test(value);
function cleanName(value){
  if(typeof value!=="string")return "";
  const name=value.normalize("NFC").trim().replace(/\s+/g," ");
  return [...name].length<=16 && !/[\p{Cc}\p{Bidi_Control}]/u.test(name) ? name : "";
}
async function enterRoom(db,body){
  const {action,id,key,avatar,view}=body||{};
  const nickname=cleanName(body?.nickname);
  if(!nickname||!validId(id)||!validId(key)||!validAvatar(avatar)||!validView(view)){
    return json({error:"닉네임과 산책방 정보를 확인해 주세요."},400);
  }
  let target;
  const now=Date.now();
  if(action==="open"){
    await db.prepare("INSERT OR IGNORE INTO rooms (id,code,created) VALUES (?,?,?) RETURNING id")
      .bind(openRoomId,"_open",now).all();
    target={id:openRoomId,code:null};
  }else if(action==="create"){
    for(let attempt=0;attempt<4&&!target;attempt++){
      const {results}=await db.prepare("INSERT OR IGNORE INTO rooms (id,code,created) VALUES (?,?,?) RETURNING id,code")
        .bind(newId(),roomCode(),now).all();
      target=results[0];
    }
    if(!target)return json({error:"초대코드를 다시 만들어 주세요."},503);
  }else if(action==="join"){
    const code=typeof body.code==="string"?body.code.trim().toUpperCase():"";
    if(!validCode(code))return json({error:"8자리 초대코드를 입력해 주세요."},400);
    const {results}=await db.prepare("SELECT id,code FROM rooms WHERE code = ?").bind(code).all();
    target=results[0];
    if(!target)return json({error:"이 초대코드에 해당하는 방을 찾을 수 없어요."},404);
  }else{
    return json({error:"서버에 들어가는 방법을 선택해 주세요."},400);
  }
  const fallback=0x445544+(crypto.getRandomValues(new Uint32Array(1))[0]%0x888888);
  const {results}=await db.prepare(`
    INSERT INTO walkers (room,id,updated,avatar,view,player_key,nickname,coat)
    VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((
      SELECT value FROM json_each(?) colors
      WHERE NOT EXISTS (SELECT 1 FROM walkers w WHERE w.room = ? AND w.updated >= ? AND w.coat = colors.value)
      ORDER BY MIN(10000, COALESCE((
        SELECT MIN(
          ((colors.value >> 16) - (w.coat >> 16)) * ((colors.value >> 16) - (w.coat >> 16)) +
          (((colors.value >> 8) & 255) - ((w.coat >> 8) & 255)) *
          (((colors.value >> 8) & 255) - ((w.coat >> 8) & 255)) +
          ((colors.value & 255) - (w.coat & 255)) * ((colors.value & 255) - (w.coat & 255))
        ) FROM walkers w WHERE w.room = ? AND w.updated >= ? AND w.coat IS NOT NULL
      ), 10000)) DESC, random() LIMIT 1
    ), ?))
    ON CONFLICT(room,id) DO UPDATE SET updated=excluded.updated WHERE walkers.player_key IS excluded.player_key
    RETURNING nickname,coat
  `).bind(target.id,id,now,JSON.stringify({...avatar,seat:null,seatSide:null,feed:null}),JSON.stringify(view),key,nickname,
    JSON.stringify(clothes),target.id,now-18000,target.id,now-18000,fallback).all();
  if(!results[0])return json({error:"산책방에 다시 입장해 주세요."},409);
  return json({room:target.id,code:target.code,mode:action==="open"?"open":"private",profile:results[0],serverTime:now});
}

function avatarUpdate(db,room,id,key,avatar,view,now,active,pendingFeed=""){
  const {feed,...snapshotData}=avatar;
  const snapshot=JSON.stringify(snapshotData);
  const inheritWish=avatar.wishArt===undefined&&avatar.wish>now-WISH_FLIGHT_MS?avatar.wish:null;
  const acknowledgedFeed=validId(feed?.claim)?feed.claim:null;
  const snapshotPatch=`json_patch(
    CASE WHEN json_extract(avatar,'$.wish')=? AND json_type(avatar,'$.wishArt')='array'
      THEN json_object('wishArt',json_extract(avatar,'$.wishArt')) ELSE '{}' END,
    CASE WHEN json_type(avatar,'$.feed')='object' THEN
      CASE WHEN json_extract(avatar,'$.feed.claim') IS NOT ?
        THEN json_object('feed',json_extract(avatar,'$.feed'),'item',json_extract(avatar,'$.item'))
        ELSE json_object('feed',json_extract(avatar,'$.feed')) END
      ELSE '{}' END)`;
  if(avatar.seat==null){
    return db.prepare(`
      UPDATE walkers SET updated=?, avatar=json_patch(?, ${snapshotPatch}), view=?
      WHERE room=? AND id=? AND player_key IS ?
        AND json_extract(avatar,'$.feed.claim') IS NOT ?
    `).bind(now,snapshot,inheritWish,acknowledgedFeed,JSON.stringify(view),room,id,key,pendingFeed);
  }
  const preferred=avatar.seatSide??0;
  return db.prepare(`
    UPDATE walkers SET updated=?, avatar=json_patch(COALESCE((
      SELECT json_set(?, '$.seatSide', slot) FROM (SELECT ? AS slot UNION ALL SELECT ?)
      WHERE NOT EXISTS (
        SELECT 1 FROM walkers peer
        WHERE peer.room=? AND peer.id<>? AND peer.updated>=?
        AND json_extract(peer.avatar,'$.seat')=?
        AND COALESCE(json_extract(peer.avatar,'$.seatSide'),0)=slot
      ) ORDER BY slot=? DESC LIMIT 1
    ), json_set(?, '$.seat', NULL, '$.seatSide', NULL)), ${snapshotPatch}),
    view=?
    WHERE room=? AND id=? AND player_key IS ?
      AND json_extract(avatar,'$.feed.claim') IS NOT ?
  `).bind(now,snapshot,preferred,1-preferred,room,id,active,avatar.seat,preferred,snapshot,inheritWish,acknowledgedFeed,
    JSON.stringify(view),room,id,key,pendingFeed);
}

function signalUpdate(db,room,id,key,signal,avatar,now,active){
  const location={x:avatar.x,y:avatar.y};
  const point=signal.point?{x:signal.point.x,y:signal.point.y}:location;
  const sameArea=isInsideMuseum(point.x,point.y)===isInsideMuseum(location.x,location.y);
  const payload={id:signal.id,point:sameArea&&Math.hypot(point.x-location.x,point.y-location.y)<=5?point:location,
    receivedAt:now};
  if(signal.audience===undefined)payload.view=signal.view;
  else{
    payload.audience=signal.audience;
    if(signal.audience==="person")payload.target=signal.target;
  }
  return db.prepare(`
    UPDATE walkers SET signal=? WHERE room=? AND id=? AND player_key IS ? AND updated>=?
      AND json_extract(signal,'$.id') IS NOT ?
  `).bind(JSON.stringify(payload),room,id,key,active,signal.id);
}

function visibleSignal(row,avatar,receiver,lookPings,room,now){
  if(!row.signal||row.id===receiver.id)return null;
  const signal=JSON.parse(row.signal);
  if(!signal?.receivedAt||now-signal.receivedAt>=lookPingLifetime)return null;
  // A cached client still changes camera for old broadcasts. Map pings are opt-in.
  if(!lookPings)return signal.audience===undefined?signal:null;
  const point=signal.point??{x:avatar.x,y:avatar.y};
  const audience=signal.audience??(room===openRoomId?"nearby":"room");
  if(audience==="person"&&signal.target!==receiver.id)return null;
  if(audience==="nearby"&&(
    isInsideMuseum(point.x,point.y)!==isInsideMuseum(receiver.avatar.x,receiver.avatar.y)||
    Math.hypot(point.x-receiver.avatar.x,point.y-receiver.avatar.y)>lookPingDistance))return null;
  return {id:signal.id,point,receivedAt:signal.receivedAt};
}

function feedUpdate(db,room,id,key,feed,now){
  const accepted=JSON.stringify({id:feed.id,claim:feed.claim,at:now});
  const cutoff=now-FEED_MS;
  return db.prepare(`
    UPDATE walkers SET avatar=json_set(avatar,'$.feed',json(?),
      '$.item.remaining',json_extract(avatar,'$.item.remaining')-1,'$.item.started',?)
    WHERE room=? AND id=? AND player_key=?
      AND json_extract(avatar,'$.seat') IS NULL
      AND COALESCE(json_extract(avatar,'$.running'),0)=0
      AND json_extract(avatar,'$.item.kind')='churu'
      AND json_extract(avatar,'$.item.remaining')>0
      AND json_extract(avatar,'$.item.started')<=?
      AND json_extract(avatar,'$.feed.claim') IS NOT ?
      AND NOT EXISTS (
        SELECT 1 FROM walkers peer
        WHERE peer.room=? AND json_extract(peer.avatar,'$.feed.id')=?
          AND json_extract(peer.avatar,'$.feed.at')>?
      )
  `).bind(accepted,now,room,id,key,cutoff,feed.claim,room,feed.id,cutoff);
}

const readyPair=`
  a.player_key IS NOT NULL AND b.player_key IS NOT NULL AND a.updated >= ? AND b.updated >= ?
  AND json_extract(a.avatar,'$.seat') IS NULL AND json_extract(b.avatar,'$.seat') IS NULL
  AND (json_extract(a.avatar,'$.x')-json_extract(b.avatar,'$.x')) *
      (json_extract(a.avatar,'$.x')-json_extract(b.avatar,'$.x')) +
      (json_extract(a.avatar,'$.y')-json_extract(b.avatar,'$.y')) *
      (json_extract(a.avatar,'$.y')-json_extract(b.avatar,'$.y')) <= 6.25
`;
function handStatements(db,room,id,key,hand,now,online){
  if(hand.action==="release")return [db.prepare(`
    DELETE FROM handholds WHERE room=? AND id=? AND (leader=? OR follower=?)
    AND EXISTS (SELECT 1 FROM walkers WHERE room=? AND id=? AND player_key=?)
  `).bind(room,hand.id,id,id,room,id,key)];
  if(hand.action==="accept")return [db.prepare(`
    UPDATE handholds SET accepted=?, side=?
    WHERE room=? AND id=? AND follower=? AND accepted IS NULL AND created>=?
    AND EXISTS (
      SELECT 1 FROM walkers a JOIN walkers b ON b.room=a.room
      WHERE a.room=handholds.room AND a.id=handholds.leader AND b.id=handholds.follower
        AND b.player_key=? AND ${readyPair}
    )
  `).bind(now,hand.side,room,hand.id,id,now-15000,key,online,online)];
  return [
    db.prepare(`
      DELETE FROM handholds WHERE room=? AND (
        (accepted IS NULL AND created < ?) OR
        (SELECT COUNT(*) FROM walkers WHERE room=handholds.room AND updated>=?
          AND id IN (handholds.leader,handholds.follower)) < 2
      )
    `).bind(room,now-15000,online),
    db.prepare(`
      INSERT INTO handholds (room,id,leader,follower,side,created)
      SELECT ?, ?, ?, ?, ?, ? FROM walkers a JOIN walkers b ON b.room=a.room
      WHERE a.room=? AND a.id=? AND a.player_key=? AND b.id=? AND a.id<>b.id AND ${readyPair}
      AND NOT EXISTS (SELECT 1 FROM handholds h WHERE h.room=a.room
        AND (h.leader IN (a.id,b.id) OR h.follower IN (a.id,b.id)))
      ON CONFLICT(room,id) DO NOTHING
    `).bind(room,hand.id,id,hand.peer,hand.side,now,room,id,key,hand.peer,online,online)
  ];
}

export async function api(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/api/room"&&url.pathname!=="/api/rooms")return json({error:"없는 페이지예요."},404);
  if(request.method!=="POST")return json({error:"지원하지 않는 요청이에요."},405);
  if(request.headers.get("origin")&&request.headers.get("origin")!==url.origin){
    return json({error:"이 사이트에서 다시 시도해 주세요."},403);
  }
  const raw=await request.text();
  if(raw.length>7300)return json({error:"요청이 너무 길어요."},413);
  let body;
  try{body=JSON.parse(raw);}catch{return json({error:"잘못된 요청이에요."},400);}
  const db=env.DB;
  if(url.pathname==="/api/rooms")return enterRoom(db,body);
  if(!validId(body?.room)||!validId(body.id)||(body.key!==undefined&&!validId(body.key))){
    return json({error:"잘못된 산책방 정보예요."},400);
  }
  const {room,id,key=null,avatar,view,signal,hand,feed,leave,lookPings}=body;
  if(leave===true){
    await db.batch([
      db.prepare(`
        DELETE FROM handholds WHERE room=? AND (leader=? OR follower=?)
        AND EXISTS (SELECT 1 FROM walkers WHERE room=? AND id=? AND player_key IS ?)
      `).bind(room,id,id,room,id,key),
      db.prepare("DELETE FROM walkers WHERE room=? AND id=? AND player_key IS ?").bind(room,id,key)
    ]);
    return json({ok:true});
  }
  if(hand!=null&&(!key||!validHand(hand)))return json({error:"손잡기 요청을 읽을 수 없어요."},400);
  if(feed!=null&&(!key||avatar===undefined||!validFeed(feed)))return json({error:"간식 주기 요청을 읽을 수 없어요."},400);
  if(signal!=null&&(avatar===undefined||!validSignal(signal,id)))return json({error:"‘여기 봐’ 위치를 읽을 수 없어요."},400);
  const now=Date.now(),active=now-18000,online=now-9000;
  const currentFeed=feed&&feed.at>=now-FEED_MS&&feed.at<=now+1500;
  const operations=[];
  if(avatar!==undefined){
    if(!validAvatar(avatar)||!validView(view)){
      return json({error:"산책 위치를 읽을 수 없어요."},400);
    }
    if(!feed||currentFeed)operations.push(avatarUpdate(db,room,id,key,avatar,view,now,active,feed?.claim));
    if(signal)operations.push(signalUpdate(db,room,id,key,signal,avatar,now,active));
    if(Math.random()<.004){
      operations.push(db.prepare("DELETE FROM walkers WHERE updated < ?").bind(now-86400000));
      operations.push(db.prepare(`
        DELETE FROM handholds WHERE created < ? AND
          (SELECT COUNT(*) FROM walkers WHERE room=handholds.room AND updated>=?
            AND id IN (handholds.leader,handholds.follower)) < 2
      `).bind(now-86400000,active));
    }
  }
  if(currentFeed)operations.push(feedUpdate(db,room,id,key,feed,now));
  if(hand)operations.push(...handStatements(db,room,id,key,hand,now,online));
  operations.push(db.prepare(
    "SELECT id,updated,avatar,view,signal,player_key,nickname,coat FROM walkers WHERE room=? AND updated>=? ORDER BY id"
  ).bind(room,active));
  operations.push(db.prepare(`
    SELECT h.id,h.leader,h.follower,h.side,h.accepted
    FROM handholds h JOIN walkers a ON a.room=h.room AND a.id=h.leader
    JOIN walkers b ON b.room=h.room AND b.id=h.follower
    WHERE h.room=? AND (h.accepted IS NOT NULL OR h.created>=?)
      AND a.updated>=? AND b.updated>=?
  `.trimStart()).bind(room,now-15000,online,online));
  const results=await db.batch(operations);
  const rows=results.at(-2).results;
  const ownRow=rows.find(row=>row.id===id&&row.player_key===key);
  if(!ownRow)return json({error:"산책방에 다시 입장해 주세요."},409);
  const receiver={id,avatar:JSON.parse(ownRow.avatar)};
  return json({
    serverTime:now,
    handholds:results.at(-1).results.map(link=>({
      id:link.id,leader:link.leader,follower:link.follower,side:link.side,active:link.accepted!==null
    })),
    walkers:rows.map(row=>{
      const avatar=row===ownRow?receiver.avatar:JSON.parse(row.avatar);
      if(row.id===id||now-avatar.wish>=WISH_FLIGHT_MS)delete avatar.wishArt;
      return {id:row.id,updated:row.updated,avatar,view:JSON.parse(row.view),
        signal:visibleSignal(row,avatar,receiver,lookPings===true,room,now),
        nickname:row.nickname||"동행",coat:row.coat??0x397e70,handholdAvailable:Boolean(row.player_key)};
    })
  });
}
