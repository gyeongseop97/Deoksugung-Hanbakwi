export const socialSchema=[
  `CREATE TABLE IF NOT EXISTS fountain_shows (
    room TEXT NOT NULL,
    id TEXT NOT NULL,
    fountain TEXT NOT NULL,
    host TEXT NOT NULL,
    started INTEGER NOT NULL,
    ends INTEGER NOT NULL,
    PRIMARY KEY (room,id)
  )`,
  "CREATE INDEX IF NOT EXISTS fountain_shows_room_ends ON fountain_shows(room,ends)",
  `CREATE TABLE IF NOT EXISTS clink_requests (
    room TEXT NOT NULL,
    id TEXT NOT NULL,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    state TEXT NOT NULL,
    created INTEGER NOT NULL,
    started INTEGER,
    expires INTEGER NOT NULL,
    PRIMARY KEY (room,id)
  )`,
  "CREATE INDEX IF NOT EXISTS clink_requests_room_expires ON clink_requests(room,expires)"
];

const readyDatabases=new WeakMap();
export function ensureSocialTables(db){
  let ready=readyDatabases.get(db);
  if(!ready){
    ready=db.batch(socialSchema.map(sql=>db.prepare(sql).bind())).catch(error=>{
      readyDatabases.delete(db);
      throw error;
    });
    readyDatabases.set(db,ready);
  }
  return ready;
}
