import {validWishArt, WISH_FLIGHT_MS} from "./public/wish-art.js";
import {FEED_MS, ITEMS} from "./public/activities.js";
import {isInsideMuseum} from "./public/visit-layout.js";
import {BUS_COUNT,BUS_SEATS,BUS_BOARD_REACH,busAt,busStopById,busSeatPose} from "./public/sejong-bus.js";
import {bikeDockReach,bikeDocks} from "./public/sejong-bike.js";

const json = (data, status = 200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const validId = (value) => typeof value==="string" && /^[a-f0-9]{32}$/.test(value);
const finite = (value,min,max) => typeof value==="number" && value>=min && value<=max;
// The shared map keeps Deoksugung's original origin. The route and palace extend north of it.
const validPoint = (point) => point && finite(point.x,0,2100) && finite(point.y,-1900,1100);
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
  (a.jump===undefined || validTime(a.jump)) &&
  (a.emote==null || reactions.has(a.emote.emoji) && finite(a.emote.at,0,9999999999999)) &&
  (a.vx===undefined || finite(a.vx,-12,12)) && (a.vy===undefined || finite(a.vy,-12,12)) &&
  (a.blocked===undefined || typeof a.blocked==="boolean") &&
  (a.up===undefined || typeof a.up==="boolean") &&
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
const busIndex = index => Number.isInteger(index)&&index>=0&&index<BUS_COUNT;
const busSeat = seat => Number.isInteger(seat)&&seat>=0&&seat<BUS_SEATS;
const validBus = bus => bus?.action==="board"?busIndex(bus.index)&&busSeat(bus.seat):
  bus?.action==="exit"&&(bus.index==null||busIndex(bus.index));
const docksById=new Map(bikeDocks.map(dock=>[dock.id,dock]));
const validBike = bike => (bike?.action==="take"||bike?.action==="return")&&docksById.has(bike.dock);

const codeAlphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const openRoomId="00000000000000000000000000000001";
const lookPingLifetime=5000,lookPingDistance=40;
const chatLifetime=6000;
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
function cleanChat(chat){
  if(!validId(chat?.id)||!validTime(chat.at)||typeof chat.text!=="string")return null;
  const text=chat.text.normalize("NFC").trim().replace(/\s+/g," ");
  if(!text||[...text].length>80||/[\p{Cc}\p{Bidi_Control}]/u.test(text))return null;
  return {id:chat.id,text,sentAt:chat.at};
}
const expiredRidePatch=`CASE WHEN json_type(avatar,'$.bus.resume')='object'
  THEN json_patch(json_extract(avatar,'$.bus.resume'),json_object('vx',0,'vy',0,'jump',0,
    'running',json('false'),'blocked',json('false'),'up',json('false')))
  ELSE '{}' END`;
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
  const initialAvatar={...avatar,seat:null,seatSide:null,feed:null};
  delete initialAvatar.chat;
  delete initialAvatar.bus;
  delete initialAvatar.bike;
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
    ON CONFLICT(room,id) DO UPDATE SET updated=MAX(walkers.updated,excluded.updated),
      avatar=CASE WHEN walkers.updated<? THEN json_patch(json_remove(walkers.avatar,'$.bus','$.bike'), ${expiredRidePatch})
        ELSE walkers.avatar END
      WHERE walkers.player_key IS excluded.player_key
    RETURNING nickname,coat
  `).bind(target.id,id,now,JSON.stringify(initialAvatar),JSON.stringify(view),key,nickname,
    JSON.stringify(clothes),target.id,now-18000,target.id,now-18000,fallback,now-18000).all();
  if(!results[0])return json({error:"산책방에 다시 입장해 주세요."},409);
  return json({room:target.id,code:target.code,mode:action==="open"?"open":"private",profile:results[0],serverTime:now});
}

function avatarUpdate(db,room,id,key,avatar,view,now,active,pendingFeed=""){
  const {feed,chat,bus,bike,...snapshotData}=avatar;
  const snapshot=JSON.stringify(snapshotData);
  const inheritWish=avatar.wishArt===undefined&&avatar.wish>now-WISH_FLIGHT_MS?avatar.wish:null;
  const acknowledgedFeed=validId(feed?.claim)?feed.claim:null;
  const snapshotPatch=`json_patch(
    json_patch(
      CASE WHEN json_extract(avatar,'$.wish')=? AND json_type(avatar,'$.wishArt')='array'
        THEN json_object('wishArt',json_extract(avatar,'$.wishArt')) ELSE '{}' END,
      CASE WHEN json_type(avatar,'$.feed')='object' THEN
        CASE WHEN json_extract(avatar,'$.feed.claim') IS NOT ?
          THEN json_object('feed',json_extract(avatar,'$.feed'),'item',json_extract(avatar,'$.item'))
          ELSE json_object('feed',json_extract(avatar,'$.feed')) END
        ELSE '{}' END),
    CASE WHEN json_type(avatar,'$.chat')='object' THEN json_object('chat',json(
      CASE WHEN json_extract(avatar,'$.chat.at')>? THEN json_extract(avatar,'$.chat')
        ELSE json_remove(json_extract(avatar,'$.chat'),'$.text') END))
      ELSE '{}' END)`;
  // A regular avatar packet cannot reserve or release a vehicle. A lease that
  // expired while the player was disconnected must not reclaim its old seat.
  const transportPatch=`CASE WHEN updated<? THEN ${expiredRidePatch}
    WHEN json_type(avatar,'$.bus')='object' THEN json_object(
      'bus',json_extract(avatar,'$.bus'),'x',json_extract(avatar,'$.x'),'y',json_extract(avatar,'$.y'),
      'heading',json_extract(avatar,'$.heading'),'vx',0,'vy',0,'seat',NULL,'seatSide',NULL,
      'running',json('false'),'blocked',json('false'),'up',json('false'),'jump',0)
    WHEN json_type(avatar,'$.bike')='object' THEN json_object(
      'bike',json_extract(avatar,'$.bike'),'seat',NULL,'seatSide',NULL)
    ELSE '{}' END`;
  if(avatar.seat==null){
    return db.prepare(`
      UPDATE walkers SET updated=MAX(updated,?), avatar=json_patch(json_patch(?, ${snapshotPatch}), ${transportPatch}), view=?
      WHERE room=? AND id=? AND player_key IS ?
        AND json_extract(avatar,'$.feed.claim') IS NOT ?
    `).bind(now,snapshot,inheritWish,acknowledgedFeed,now-chatLifetime,active,JSON.stringify(view),room,id,key,pendingFeed);
  }
  const preferred=avatar.seatSide??0;
  return db.prepare(`
    UPDATE walkers SET updated=MAX(updated,?), avatar=json_patch(json_patch(COALESCE((
      SELECT json_set(?, '$.seatSide', slot) FROM (SELECT ? AS slot UNION ALL SELECT ?)
      WHERE NOT EXISTS (
        SELECT 1 FROM walkers peer
        WHERE peer.room=? AND peer.id<>? AND peer.updated>=?
        AND json_extract(peer.avatar,'$.seat')=?
        AND COALESCE(json_extract(peer.avatar,'$.seatSide'),0)=slot
      ) ORDER BY slot=? DESC LIMIT 1
    ), json_set(?, '$.seat', NULL, '$.seatSide', NULL)), ${snapshotPatch}), ${transportPatch}),
    view=?
    WHERE room=? AND id=? AND player_key IS ?
      AND json_extract(avatar,'$.feed.claim') IS NOT ?
  `).bind(now,snapshot,preferred,1-preferred,room,id,active,avatar.seat,preferred,snapshot,inheritWish,acknowledgedFeed,
    now-chatLifetime,active,JSON.stringify(view),room,id,key,pendingFeed);
}

function chatUpdate(db,room,id,key,chat,now,active){
  return db.prepare(`
    UPDATE walkers SET avatar=json_set(avatar,'$.chat',json(?))
    WHERE room=? AND id=? AND player_key=? AND updated>=?
      AND json_extract(avatar,'$.chat.id') IS NOT ?
      AND COALESCE(json_extract(avatar,'$.chat.sentAt'),-1)<?
  `).bind(JSON.stringify({...chat,at:now}),room,id,key,active,chat.id,chat.sentAt);
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
      AND json_extract(avatar,'$.bus') IS NULL AND json_extract(avatar,'$.bike') IS NULL
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

const nearVehicleAccess=`
  (json_extract(avatar,'$.x')-?) * (json_extract(avatar,'$.x')-?) +
  (json_extract(avatar,'$.y')-?) * (json_extract(avatar,'$.y')-?) <= ?
`;
const accessArguments=(point,reach)=>[point.x,point.x,point.y,point.y,reach**2];
const availableRider=`json_extract(avatar,'$.bus') IS NULL AND json_extract(avatar,'$.bike') IS NULL
  AND json_extract(avatar,'$.seat') IS NULL AND COALESCE(json_extract(avatar,'$.feed.at'),0)<=?`;

function busStatements(db,room,id,key,action,now,active){
  if(action.action==="board"){
    const bus=busAt(action.index,now),stop=busStopById(bus?.stopId);
    if(!stop||bus.traveling)return [];
    const {x,y,heading}=busSeatPose(bus,action.seat);
    return [db.prepare(`
      UPDATE walkers SET avatar=json_set(avatar,'$.bus',json(?),'$.x',?,'$.y',?,'$.heading',?,
        '$.vx',0,'$.vy',0,'$.jump',0,'$.running',json('false'),'$.blocked',json('false'),'$.up',json('false'))
      WHERE room=? AND id=? AND player_key=? AND updated>=?
        AND ${availableRider} AND ${nearVehicleAccess}
        AND NOT EXISTS (
          SELECT 1 FROM walkers peer WHERE peer.room=walkers.room AND peer.id<>walkers.id AND peer.updated>=?
            AND json_extract(peer.avatar,'$.bus.index')=? AND json_extract(peer.avatar,'$.bus.seat')=?
        )
    `).bind(JSON.stringify({index:action.index,seat:action.seat,resume:stop.exit}),x,y,heading,room,id,key,active,now-FEED_MS,
      ...accessArguments(stop.board,BUS_BOARD_REACH),active,action.index,action.seat)];
  }
  const buses=action.index==null?Array.from({length:BUS_COUNT},(_,index)=>index):[action.index];
  return buses.flatMap(index=>{
    const bus=busAt(index,now),stop=busStopById(bus?.stopId);
    if(!stop||bus.traveling)return [];
    const {x,y,heading}=stop.exit;
    return [db.prepare(`
      UPDATE walkers SET avatar=json_remove(json_set(avatar,'$.x',?,'$.y',?,'$.heading',?,
        '$.vx',0,'$.vy',0,'$.jump',0,'$.running',json('false'),'$.blocked',json('false'),'$.up',json('false')), '$.bus')
      WHERE room=? AND id=? AND player_key=? AND updated>=? AND json_extract(avatar,'$.bus.index')=?
    `).bind(x,y,heading,room,id,key,active,index)];
  });
}

function bikeStatement(db,room,id,key,action,now,active){
  const dock=docksById.get(action.dock),position=accessArguments(dock.access,bikeDockReach);
  if(action.action==="take")return db.prepare(`
    UPDATE walkers SET avatar=json_set(avatar,'$.bike',json(?))
    WHERE room=? AND id=? AND player_key=? AND updated>=?
      AND ${availableRider} AND ${nearVehicleAccess}
  `).bind(JSON.stringify({dock:action.dock}),room,id,key,active,now-FEED_MS,...position);
  return db.prepare(`
    UPDATE walkers SET avatar=json_remove(avatar,'$.bike')
    WHERE room=? AND id=? AND player_key=? AND updated>=?
      AND json_extract(avatar,'$.bike') IS NOT NULL AND ${nearVehicleAccess}
  `).bind(room,id,key,active,...position);
}

function releaseTransportHands(db,room,id,key){
  return db.prepare(`
    DELETE FROM handholds WHERE room=? AND (leader=? OR follower=?) AND EXISTS (
      SELECT 1 FROM walkers WHERE room=? AND id=? AND player_key=?
        AND (json_extract(avatar,'$.bus') IS NOT NULL OR json_extract(avatar,'$.bike') IS NOT NULL)
    )
  `).bind(room,id,id,room,id,key);
}

function transportAvatar(row,now){
  const avatar=JSON.parse(row.avatar);
  if(busIndex(avatar.bus?.index)&&busSeat(avatar.bus.seat)){
    const {index,seat}=avatar.bus;
    avatar.bus={index,seat};
    Object.assign(avatar,busSeatPose(busAt(index,now),seat));
  }else delete avatar.bus;
  if(!docksById.has(avatar.bike?.dock))delete avatar.bike;
  return avatar;
}

function transportResult(bus,bike,avatar,walkers,id,now){
  if(!bus&&!bike)return undefined;
  const result={};
  if(bus?.action==="board"){
    const matches=rider=>rider?.index===bus.index&&rider.seat===bus.seat;
    const stop=busStopById(busAt(bus.index,now)?.stopId);
    const atBerth=stop&&Math.hypot(avatar.x-stop.board.x,avatar.y-stop.board.y)<=BUS_BOARD_REACH;
    result.bus=matches(avatar.bus)?"boarded":atBerth&&walkers.some(peer=>peer.id!==id&&matches(peer.avatar.bus))?"occupied":"unavailable";
  }else if(bus)result.bus=avatar.bus?"unavailable":"exited";
  if(bike?.action==="take")result.bike=avatar.bike?.dock===bike.dock?"taken":"unavailable";
  else if(bike)result.bike=avatar.bike?"unavailable":"returned";
  return result;
}

const readyPair=`
  a.player_key IS NOT NULL AND b.player_key IS NOT NULL AND a.updated >= ? AND b.updated >= ?
  AND json_extract(a.avatar,'$.seat') IS NULL AND json_extract(b.avatar,'$.seat') IS NULL
  AND json_extract(a.avatar,'$.bus') IS NULL AND json_extract(b.avatar,'$.bus') IS NULL
  AND json_extract(a.avatar,'$.bike') IS NULL AND json_extract(b.avatar,'$.bike') IS NULL
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
  const {room,id,key=null,avatar,view,signal,hand,feed,bus,bike,leave,lookPings}=body;
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
  if(bus!=null&&(!key||avatar===undefined||!validBus(bus)))return json({error:"버스 요청을 읽을 수 없어요."},400);
  if(bike!=null&&(!key||avatar===undefined||!validBike(bike)))return json({error:"자전거 요청을 읽을 수 없어요."},400);
  if(signal!=null&&(avatar===undefined||!validSignal(signal,id)))return json({error:"‘여기 봐’ 위치를 읽을 수 없어요."},400);
  const now=Date.now(),active=now-18000,online=now-9000;
  const currentFeed=feed&&feed.at>=now-FEED_MS&&feed.at<=now+1500;
  const operations=[];
  if(avatar!==undefined){
    if(!validAvatar(avatar)||!validView(view)){
      return json({error:"산책 위치를 읽을 수 없어요."},400);
    }
    const chat=avatar.chat==null?null:cleanChat(avatar.chat);
    if(avatar.chat!=null&&(!key||!chat))return json({error:"말풍선은 1~80자로 입력해 주세요."},400);
    if(!feed||currentFeed)operations.push(avatarUpdate(db,room,id,key,avatar,view,now,active,feed?.claim));
    if(chat)operations.push(chatUpdate(db,room,id,key,chat,now,active));
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
  if(bike)operations.push(bikeStatement(db,room,id,key,bike,now,active));
  if(bus)operations.push(...busStatements(db,room,id,key,bus,now,active));
  if(bus||bike)operations.push(releaseTransportHands(db,room,id,key));
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
  const receiver={id,avatar:transportAvatar(ownRow,now)};
  const walkers=rows.map(row=>{
    const avatar=row===ownRow?receiver.avatar:transportAvatar(row,now);
    if(row.id===id||now-avatar.wish>=WISH_FLIGHT_MS)delete avatar.wishArt;
    const chat=avatar.chat;
    if(chat?.text&&chat.at>now-chatLifetime)avatar.chat={id:chat.id,text:chat.text,at:chat.at};
    else delete avatar.chat;
    return {id:row.id,updated:row.updated,avatar,view:JSON.parse(row.view),
      signal:visibleSignal(row,avatar,receiver,lookPings===true,room,now),
      nickname:row.nickname||"동행",coat:row.coat??0x397e70,handholdAvailable:Boolean(row.player_key)};
  });
  return json({
    serverTime:now,
    handholds:results.at(-1).results.map(link=>({
      id:link.id,leader:link.leader,follower:link.follower,side:link.side,active:link.accepted!==null
    })),
    transport:transportResult(bus,bike,receiver.avatar,walkers,id,now),walkers
  });
}
