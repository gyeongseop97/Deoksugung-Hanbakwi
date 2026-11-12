import { fallbackSeoulWeather, readSeoulWeather, WEATHER_INTERVAL, weatherBucket } from "../public/seoul-environment.js";

const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
endpoint.search = new URLSearchParams({
  latitude: "37.5665", longitude: "126.9780", timeformat: "unixtime", timezone: "Asia/Seoul",
  current: "weather_code,cloud_cover,precipitation,rain,snowfall,wind_speed_10m,wind_direction_10m"
});
const schema = `CREATE TABLE IF NOT EXISTS seoul_weather (
  bucket INTEGER PRIMARY KEY, snapshot TEXT NOT NULL
)`;
const stateByDatabase = new WeakMap();

async function observe(clock, request) {
  try {
    const response = await request(endpoint, { signal: AbortSignal.timeout(1800) });
    if (response.ok) {
      const body = await response.json();
      return readSeoulWeather(body.current, clock) ?? fallbackSeoulWeather(clock);
    }
  } catch {
    // Every process proposes the same fallback for this interval.
  }
  return fallbackSeoulWeather(clock);
}

async function chooseWeather(db, state, bucket, request) {
  state.schema ??= db.prepare(schema).bind().all().catch(error => {
    state.schema = null;
    throw error;
  });
  await state.schema;
  const select = () => db.prepare("SELECT snapshot FROM seoul_weather WHERE bucket = ?").bind(bucket);
  const stored = (await select().all()).results[0];
  if (stored) return JSON.parse(stored.snapshot);
  const candidate = await observe(bucket, request);
  // The first committed observation (including fallback) holds through the interval across server instances.
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO seoul_weather (bucket,snapshot) VALUES (?,?)").bind(bucket, JSON.stringify(candidate)),
    select(),
    db.prepare("DELETE FROM seoul_weather WHERE bucket < ?").bind(bucket - WEATHER_INTERVAL * 6)
  ]);
  return JSON.parse(results[1].results[0].snapshot);
}

export function getRoomWeather(db, clock, request = fetch) {
  const bucket = weatherBucket(clock);
  let state = stateByDatabase.get(db);
  if (!state) {
    state = { buckets: new Map() };
    stateByDatabase.set(db, state);
  }
  if (!state.buckets.has(bucket)) {
    for (const cached of state.buckets.keys()) {
      if (cached < bucket - WEATHER_INTERVAL) state.buckets.delete(cached);
    }
    state.buckets.set(bucket, chooseWeather(db, state, bucket, request).catch(error => {
      // Keep the last authoritative snapshot if an isolated weather query fails.
      console.warn("Seoul weather snapshot unavailable", error.code ?? error.name);
      return state.buckets.get(bucket - WEATHER_INTERVAL);
    }));
  }
  return state.buckets.get(bucket);
}
