const path = require('path');
const Database = require('better-sqlite3');

const dbPath =
  process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS gps_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy_m REAL,
    ts_ms INTEGER NOT NULL,
    place_name TEXT,
    city TEXT,
    locality TEXT,
    road TEXT,
    country TEXT,
    user_agent TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_gps_logs_ts ON gps_logs(ts_ms);
  CREATE INDEX IF NOT EXISTS idx_gps_logs_user_ts ON gps_logs(user_id, ts_ms);

  CREATE TABLE IF NOT EXISTS restaurant_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    restaurant_id TEXT,
    name TEXT,
    cuisine TEXT,
    ts_ms INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_restaurant_clicks_ts ON restaurant_clicks(ts_ms);
`);

const insertLogStmt = db.prepare(`
  INSERT INTO gps_logs (
    user_id, lat, lng, accuracy_m, ts_ms,
    place_name, city, locality, road, country,
    user_agent
  ) VALUES (
    @userId, @lat, @lng, @accuracyM, @tsMs,
    @placeName, @city, @locality, @road, @country,
    @userAgent
  )
`);

const listLogsStmt = db.prepare(`
  SELECT
    id,
    user_id AS userId,
    lat,
    lng,
    accuracy_m AS accuracyM,
    ts_ms AS tsMs,
    place_name AS placeName,
    city,
    locality,
    road,
    country,
    user_agent AS userAgent
  FROM gps_logs
  WHERE (@sinceMs IS NULL OR ts_ms >= @sinceMs)
    AND (@userId IS NULL OR user_id = @userId)
  ORDER BY ts_ms DESC
  LIMIT @limit
`);

const latestPerUserStmt = db.prepare(`
  SELECT
    t.id,
    t.user_id AS userId,
    t.lat,
    t.lng,
    t.accuracy_m AS accuracyM,
    t.ts_ms AS tsMs,
    t.place_name AS placeName,
    t.city,
    t.locality,
    t.road,
    t.country,
    t.user_agent AS userAgent
  FROM gps_logs t
  INNER JOIN (
    SELECT user_id, MAX(ts_ms) AS max_ts
    FROM gps_logs
    GROUP BY user_id
  ) x
  ON t.user_id = x.user_id AND t.ts_ms = x.max_ts
  ORDER BY t.ts_ms DESC
`);

const purgeStmt = db.prepare(`
  DELETE FROM gps_logs
  WHERE ts_ms < @cutoffMs
`);

const insertClickStmt = db.prepare(`
  INSERT INTO restaurant_clicks (user_id, restaurant_id, name, cuisine, ts_ms)
  VALUES (@userId, @restaurantId, @name, @cuisine, @tsMs)
`);

function insertGpsLog(row) {
  const info = insertLogStmt.run(row);
  return { id: info.lastInsertRowid };
}

function listGpsLogs({ limit = 200, sinceMs = null, userId = null }) {
  return listLogsStmt.all({
    limit: Math.max(1, Math.min(1000, Number(limit) || 200)),
    sinceMs: sinceMs == null ? null : Number(sinceMs),
    userId: userId ?? null,
  });
}

function listLatestPerUser() {
  return latestPerUserStmt.all();
}

function purgeGpsLogsOlderThanDays(days) {
  const d = Number(days);
  const safeDays = Number.isFinite(d) ? Math.max(1, Math.min(3650, d)) : 30;
  const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const info = purgeStmt.run({ cutoffMs });
  return { deleted: info.changes, cutoffMs, days: safeDays };
}

function insertRestaurantClick(row) {
  const info = insertClickStmt.run(row);
  return { id: info.lastInsertRowid };
}

function getAnalytics({ rangeDays = 7 }) {
  const days = Math.max(1, Math.min(365, Number(rangeDays) || 7));
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const pingsByDay = db
    .prepare(
      `
      SELECT
        date(datetime(ts_ms / 1000, 'unixepoch')) AS day,
        COUNT(*) AS count
      FROM gps_logs
      WHERE ts_ms >= @sinceMs
      GROUP BY day
      ORDER BY day ASC
    `
    )
    .all({ sinceMs });

  const topCities = db
    .prepare(
      `
      SELECT city, COUNT(*) AS count
      FROM gps_logs
      WHERE ts_ms >= @sinceMs AND city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `
    )
    .all({ sinceMs });

  const topCuisines = db
    .prepare(
      `
      SELECT cuisine, COUNT(*) AS count
      FROM restaurant_clicks
      WHERE ts_ms >= @sinceMs AND cuisine IS NOT NULL AND cuisine != ''
      GROUP BY cuisine
      ORDER BY count DESC
      LIMIT 15
    `
    )
    .all({ sinceMs });

  const topRestaurants = db
    .prepare(
      `
      SELECT name, COUNT(*) AS count
      FROM restaurant_clicks
      WHERE ts_ms >= @sinceMs AND name IS NOT NULL AND name != ''
      GROUP BY name
      ORDER BY count DESC
      LIMIT 15
    `
    )
    .all({ sinceMs });

  return { rangeDays: days, sinceMs, pingsByDay, topCities, topCuisines, topRestaurants };
}

module.exports = {
  db,
  insertGpsLog,
  listGpsLogs,
  listLatestPerUser,
  purgeGpsLogsOlderThanDays,
  insertRestaurantClick,
  getAnalytics,
};

