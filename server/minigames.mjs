import {JUMP_MS} from "../public/activities.js";
import {KITE_GUSTS,MINIGAME_LOBBY_MS,MINIGAME_REACH,MINIGAME_RESULT_MS,minigameById,minigameDuration} from "../public/traditional-games.js";

const validId=value=>typeof value==="string"&&/^[a-f0-9]{32}$/.test(value);
const hitGrace=1100,clockLead=260;

export function validMinigame(command){
  const game=minigameById(command?.game);
  if(!game||!validId(command.id))return false;
  if(command.action==="start")return true;
  if(!validId(command.round))return false;
  if(command.action==="join"||command.action==="leave")return true;
  return command.action==="hit"&&Number.isInteger(command.beat)&&command.beat>=0&&command.beat<game.beats&&
    Number.isSafeInteger(command.at)&&command.at>=0&&command.at<1e13&&
    (game.id==="kite"?command.move===-1||command.move===1:command.move===0);
}

const squared=term=>`(${term})*(${term})`;
const walkerAtVenue=`w.room=? AND w.id=? AND w.player_key=? AND w.updated>=?
  AND json_extract(w.avatar,'$.seat') IS NULL AND json_extract(w.avatar,'$.bus') IS NULL
  AND (json_extract(w.avatar,'$.bike') IS NULL OR json_type(w.avatar,'$.bike.parked') IS 'object')
  AND COALESCE(json_extract(w.avatar,'$.jump'),0)<=?
  AND ${squared("json_extract(w.avatar,'$.x')-?")} + ${squared("json_extract(w.avatar,'$.y')-?")}<=?`;
const venueArguments=({room,id,key,online,now},game)=>[
  room,id,key,online,now-JUMP_MS,game.point.x,game.point.x,game.point.y,game.point.y,MINIGAME_REACH**2
];
const matchFor=command=>command.action==="start"?command.id:command.round;

function addParticipant(db,context,game,round){
  return db.prepare(`
    INSERT INTO minigame_players (room,round_id,player,nickname,joined)
    SELECT r.room,r.id,w.id,w.nickname,? FROM minigame_rounds r JOIN walkers w ON w.room=r.room
    WHERE r.room=? AND r.id=? AND r.game=? AND r.starts>? AND ${walkerAtVenue}
    ON CONFLICT(room,round_id,player) DO UPDATE SET withdrawn=NULL
  `).bind(context.now,context.room,round,game.id,context.now,...venueArguments(context,game));
}

export function minigameStatements(db,context){
  const {room,id,key,now,minigame:command}=context,game=minigameById(command.game),round=matchFor(command);
  if(command.action==="start"){
    const starts=now+MINIGAME_LOBBY_MS,ends=starts+minigameDuration(game);
    return [db.prepare(`
      INSERT INTO minigame_rounds (room,id,game,seed,starts,ends,closes)
      SELECT ?,?,?,?,?,?,? FROM walkers w
      WHERE ${walkerAtVenue} AND NOT EXISTS (
        SELECT 1 FROM minigame_rounds WHERE room=? AND game=? AND ends>?
      ) ON CONFLICT(room,id) DO NOTHING
    `).bind(room,round,game.id,now%KITE_GUSTS.length,starts,ends,ends+MINIGAME_RESULT_MS,
      ...venueArguments(context,game),room,game.id,now),addParticipant(db,context,game,round)];
  }
  if(command.action==="join")return [addParticipant(db,context,game,round)];
  if(command.action==="leave")return [db.prepare(`
    UPDATE minigame_players SET withdrawn=?
    WHERE room=? AND round_id=? AND player=? AND withdrawn IS NULL
      AND EXISTS (SELECT 1 FROM minigame_rounds WHERE room=? AND id=? AND game=? AND ends>?)
      AND EXISTS (SELECT 1 FROM walkers WHERE room=? AND id=? AND player_key=?)
  `).bind(now,room,round,id,room,round,game.id,now,room,id,key)];
  if(command.at<now-hitGrace||command.at>now+clockLead)return [];
  const {at,beat,move}=command;
  const deviation=`ABS(? - (r.starts + ${beat*game.beatMs+game.targetMs}))`;
  const direction=game.id==="kite"?`CAST(json_extract('${JSON.stringify(KITE_GUSTS)}','$[' || ((r.seed+${beat}) % ${KITE_GUSTS.length}) || ']') AS INTEGER)`:
    "0";
  return [db.prepare(`
    INSERT INTO minigame_hits (room,round_id,player,beat,request,points)
    SELECT r.room,r.id,p.player,?,?,CASE
      WHEN ${direction}<>? THEN 0
      WHEN ${deviation}<=${game.perfect} THEN 3
      WHEN ${deviation}<=${game.good} THEN 1 ELSE 0 END
    FROM minigame_rounds r JOIN minigame_players p ON p.room=r.room AND p.round_id=r.id
    JOIN walkers w ON w.room=p.room AND w.id=p.player
    WHERE r.room=? AND r.id=? AND r.game=? AND p.player=? AND p.withdrawn IS NULL
      AND ? >= r.starts+? AND ? < r.starts+? AND ?<r.ends AND ?<r.ends+${hitGrace}
      AND ${walkerAtVenue}
    ON CONFLICT(room,round_id,player,beat) DO NOTHING
  `).bind(beat,command.id,move,at,at,room,round,game.id,id,at,beat*game.beatMs,
    at,(beat+1)*game.beatMs,at,now,...venueArguments(context,game))];
}

export function leaveMinigames(db,{room,id,key,now}){
  return db.prepare(`
    UPDATE minigame_players SET withdrawn=? WHERE room=? AND player=? AND withdrawn IS NULL
      AND EXISTS (SELECT 1 FROM minigame_rounds r WHERE r.room=minigame_players.room AND r.id=minigame_players.round_id AND r.ends>?)
      AND EXISTS (SELECT 1 FROM walkers WHERE room=? AND id=? AND player_key IS ?)
  `).bind(now,room,id,now,room,id,key);
}

export function cleanupMinigames(db,room,before){
  const expired="SELECT id FROM minigame_rounds WHERE room=? AND closes<?";
  return [db.prepare(`DELETE FROM minigame_hits WHERE room=? AND round_id IN (${expired})`).bind(room,room,before),
    db.prepare(`DELETE FROM minigame_players WHERE room=? AND round_id IN (${expired})`).bind(room,room,before),
    db.prepare("DELETE FROM minigame_rounds WHERE room=? AND closes<?").bind(room,before)];
}

const scoreFor=`COALESCE((SELECT SUM(h.points) FROM minigame_hits h
  WHERE h.room=p.room AND h.round_id=p.round_id AND h.player=p.player),0)`;
function recognize(command,room,id){
  if(!command)return {sql:"0",args:[]};
  const round=matchFor(command);
  if(command.action==="hit")return {sql:`EXISTS (SELECT 1 FROM minigame_hits WHERE room=? AND round_id=? AND player=? AND beat=? AND request=?)`,
    args:[room,round,id,command.beat,command.id]};
  const withdrawal=command.action==="leave"?"IS NOT NULL":"IS NULL";
  return {sql:`EXISTS (SELECT 1 FROM minigame_players p JOIN minigame_rounds r ON r.room=p.room AND r.id=p.round_id
    WHERE p.room=? AND p.round_id=? AND p.player=? AND r.game=? AND p.withdrawn ${withdrawal})`,
    args:[room,round,id,command.game]};
}

export function selectMinigames(db,{room,id,now,online,minigame}){
  const command=recognize(minigame,room,id);
  return db.prepare(`
    SELECT (SELECT json_group_array(json_object('game',r.game,'id',r.id,'startsAt',r.starts,'endsAt',r.ends,'seed',r.seed,
      'count',(SELECT COUNT(*) FROM minigame_players p WHERE p.room=r.room AND p.round_id=r.id AND p.withdrawn IS NULL),
      'players',json((SELECT json_group_array(json_object('id',player,'nickname',nickname,'score',score,'withdrawn',withdrawn,'online',online)) FROM (
        SELECT p.player,p.nickname,p.withdrawn,${scoreFor} AS score,
          EXISTS(SELECT 1 FROM walkers w WHERE w.room=p.room AND w.id=p.player AND w.updated>=?) AS online
        FROM minigame_players p WHERE p.room=r.room AND p.round_id=r.id
        ORDER BY p.withdrawn IS NOT NULL,score DESC,p.joined,p.player LIMIT 12
      ))),
      'self',json((SELECT json_object('score',${scoreFor},'withdrawn',p.withdrawn,'hits',json((
        SELECT json_group_array(json_object('beat',h.beat,'points',h.points)) FROM minigame_hits h
        WHERE h.room=p.room AND h.round_id=p.round_id AND h.player=p.player
      ))) FROM minigame_players p WHERE p.room=r.room AND p.round_id=r.id AND p.player=?)
      ))) FROM minigame_rounds r WHERE r.room=? AND r.closes>? AND NOT EXISTS (
        SELECT 1 FROM minigame_rounds latest WHERE latest.room=r.room AND latest.game=r.game AND latest.starts>r.starts
      )) AS games, (${command.sql}) AS recognized
  `).bind(online,id,room,now,...command.args);
}

export function minigamePayload(row,command){
  return {minigames:JSON.parse(row.games),...(command?{minigameResult:row.recognized?"accepted":"unavailable"}:{})};
}
