CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS walkers (
  room TEXT NOT NULL,
  id TEXT NOT NULL,
  updated INTEGER NOT NULL,
  avatar TEXT NOT NULL,
  view TEXT NOT NULL,
  signal TEXT,
  player_key TEXT,
  nickname TEXT,
  coat INTEGER,
  PRIMARY KEY (room, id)
);

CREATE INDEX IF NOT EXISTS walkers_updated ON walkers(updated);

CREATE TABLE IF NOT EXISTS handholds (
  room TEXT NOT NULL,
  id TEXT NOT NULL,
  leader TEXT NOT NULL,
  follower TEXT NOT NULL,
  side INTEGER NOT NULL,
  created INTEGER NOT NULL,
  accepted INTEGER,
  PRIMARY KEY (room, id)
);
