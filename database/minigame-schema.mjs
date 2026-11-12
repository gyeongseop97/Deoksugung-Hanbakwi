const schema=[
  `CREATE TABLE IF NOT EXISTS minigame_rounds (
    room TEXT NOT NULL, id TEXT NOT NULL, game TEXT NOT NULL, seed INTEGER NOT NULL,
    starts INTEGER NOT NULL, ends INTEGER NOT NULL, closes INTEGER NOT NULL,
    PRIMARY KEY (room,id)
  )`,
  "CREATE INDEX IF NOT EXISTS minigame_rounds_venue ON minigame_rounds(room,game,starts)",
  "CREATE INDEX IF NOT EXISTS minigame_rounds_recent ON minigame_rounds(room,closes)",
  `CREATE TABLE IF NOT EXISTS minigame_players (
    room TEXT NOT NULL, round_id TEXT NOT NULL, player TEXT NOT NULL, nickname TEXT NOT NULL,
    joined INTEGER NOT NULL, withdrawn INTEGER,
    PRIMARY KEY (room,round_id,player)
  )`,
  `CREATE TABLE IF NOT EXISTS minigame_hits (
    room TEXT NOT NULL, round_id TEXT NOT NULL, player TEXT NOT NULL, beat INTEGER NOT NULL,
    request TEXT NOT NULL, points INTEGER NOT NULL,
    PRIMARY KEY (room,round_id,player,beat)
  )`
];

const readyDatabases=new WeakMap();
export function ensureMinigameTables(db){
  let ready=readyDatabases.get(db);
  if(!ready){
    ready=db.batch(schema.map(sql=>db.prepare(sql).bind())).catch(error=>{
      readyDatabases.delete(db);
      throw error;
    });
    readyDatabases.set(db,ready);
  }
  return ready;
}
