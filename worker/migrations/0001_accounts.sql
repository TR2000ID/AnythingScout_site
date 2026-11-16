-- Accounts (project 2 of the combined site): username only for now, no password.
-- Locally: npm run db:local (wrangler's own test copy). Online: wrangler d1 migrations apply anything-scout --remote

-- One row per person. password_hash stays empty until passwords come (one filled-in column, nothing moved).
-- rev goes up by one on every sync that changes something; each saved row remembers the rev it was written in,
-- so a device asks "what changed since rev N?" and downloads only that.
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- exactly as created after NFKC: capitals count (Ken and ken are two accounts)
  created_at TEXT NOT NULL,
  password_hash TEXT,
  rev INTEGER NOT NULL DEFAULT 0,
  picture BLOB,                       -- 128x128 WebP/JPEG, at most 50 KB
  picture_type TEXT,
  picture_at TEXT
);

-- Signed-in browsers. Only the SHA-256 of each token is kept, never the token itself.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- One row per rating. rating NULL = removed at `at` (so a removal can beat an older rating on another device).
CREATE TABLE items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('anime', 'games')),
  item TEXT NOT NULL,                 -- "mal:5114", "steam:730"
  rating TEXT,
  at TEXT NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, section, item)
);
CREATE INDEX items_rev ON items(user_id, rev);

-- Settings and the Watch together list: each saved whole, as the browser's JSON text; the newer block wins.
CREATE TABLE blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name IN ('anime.settings', 'games.settings', 'anime.friends')),
  value TEXT NOT NULL,
  at TEXT NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, name)
);
CREATE INDEX blocks_rev ON blocks(user_id, rev);

-- The guessing limit: misses per address per time window ("signin:<10-minute slot>", "create:<hour>").
CREATE TABLE misses (
  ip TEXT NOT NULL,
  window TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (ip, window)
);
