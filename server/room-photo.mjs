import {isInsideMuseum,museumBounds} from "../public/visit-layout.js";
import {PHOTO_REACH} from "../public/photo-mode.js";

const sessions=new WeakMap();
const PHOTO_COUNTDOWN=8000;
const PHOTO_WINDOW=2200;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inRange=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;

export function validPhoto(photo){
  const c=photo?.camera;
  return typeof photo?.id==="string"&&/^[a-f0-9]{32}$/.test(photo.id)&&c&&
    inRange(c.x,0,810)&&inRange(c.y,-1820,450)&&inRange(c.height,.65,5.5)&&
    inRange(c.pan,0,360)&&inRange(c.tilt,-70,70)&&inRange(c.fov,32,82);
}
export function ensureRoomPhotos(db){
  let ready=sessions.get(db);
  if(!ready){
    ready=db.batch([db.prepare(`CREATE TABLE IF NOT EXISTS room_photo_sessions (
      room TEXT PRIMARY KEY, event_id TEXT NOT NULL, host TEXT NOT NULL,
      shoot_at INTEGER NOT NULL, expires INTEGER NOT NULL, camera TEXT NOT NULL
    )`).bind()]).catch(error=>{sessions.delete(db);throw error;});
    sessions.set(db,ready);
  }
  return ready;
}

const coord=(alias,axis)=>`CAST(json_extract(${alias}.avatar,'$.${axis}') AS REAL)`;
const galleryPredicate=alias=>`${coord(alias,"x")}>${museumBounds.minX} AND ${coord(alias,"x")}<${museumBounds.maxX}
  AND ${coord(alias,"y")}>${museumBounds.minY} AND ${coord(alias,"y")}<${museumBounds.maxY}`;

export function writeRoomPhoto(db,{room,id,key,now,online,photo}){
  const {x,y,height,pan,tilt,fov}=photo.camera,camera={x,y,height,pan,tilt,fov};
  const xdiff=`${coord("p","x")}-?`,ydiff=`${coord("p","y")}-?`;
  const nearbyX=`${coord("p","x")}-${coord("other","x")}`,nearbyY=`${coord("p","y")}-${coord("other","y")}`;
  const shootAt=now+PHOTO_COUNTDOWN;
  return db.prepare(`
    INSERT INTO room_photo_sessions (room,event_id,host,shoot_at,expires,camera)
    SELECT ?,?,?,?,?,? FROM walkers p
    WHERE p.room=? AND p.id=? AND p.player_key=? AND p.updated>=?
      AND (${xdiff})*(${xdiff})+(${ydiff})*(${ydiff})<=?
      AND (${galleryPredicate("p")})=?
      AND EXISTS (SELECT 1 FROM walkers other WHERE other.room=p.room AND other.id<>p.id AND other.updated>=?
        AND (${galleryPredicate("other")})=(${galleryPredicate("p")})
        AND (${nearbyX})*(${nearbyX})+(${nearbyY})*(${nearbyY})<=?)
    ON CONFLICT(room) DO UPDATE SET event_id=excluded.event_id,host=excluded.host,
      shoot_at=excluded.shoot_at,expires=excluded.expires,camera=excluded.camera
    WHERE room_photo_sessions.expires<=? AND room_photo_sessions.event_id<>excluded.event_id
  `).bind(room,photo.id,id,shootAt,shootAt+PHOTO_WINDOW,JSON.stringify(camera),
    room,id,key,online,x,x,y,y,PHOTO_REACH**2,Number(isInsideMuseum(x,y)),online,PHOTO_REACH**2,now);
}

export function selectRoomPhoto(db,room,now){
  return db.prepare("SELECT event_id,host,shoot_at,camera FROM room_photo_sessions WHERE room=? AND expires>?").bind(room,now);
}
export function roomPhotoPayload(result,avatar){
  const row=result?.results[0];
  if(!row)return null;
  const camera=JSON.parse(row.camera);
  if(distance(avatar,camera)>PHOTO_REACH*2||isInsideMuseum(avatar.x,avatar.y)!==isInsideMuseum(camera.x,camera.y))return null;
  return {id:row.event_id,host:row.host,shootAt:row.shoot_at,camera};
}
