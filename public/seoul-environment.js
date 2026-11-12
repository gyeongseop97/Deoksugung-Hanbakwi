const SEOUL_OFFSET = 9 * 60 * 60 * 1000;
const RAD = Math.PI / 180;
const LATITUDE = 37.5665 * RAD;
const SOLAR_OFFSET = 4 * (126.978 - 135);
export const WEATHER_INTERVAL = 10 * 60 * 1000;
export const WEATHER_TYPES = Object.freeze(["clear", "cloudy", "rain", "snow", "fog"]);
export const SEASONS = Object.freeze(["spring", "summer", "autumn", "winter"]);
export const WEATHER_SOURCE = "https://open-meteo.com/en/docs";

const referenceDay = { spring: 105, summer: 190, autumn: 288, winter: 15 };
const cloudDefaults = { clear: .13, cloudy: .82, rain: .95, snow: .86, fog: .71 };
const clamp = (number, min = 0, max = 1) => Math.max(min, Math.min(max, number));
const smooth = (min, max, number) => {
  const t = clamp((number - min) / (max - min));
  return t * t * (3 - 2 * t);
};
const dayOfYear = date => Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
  Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
export const weatherBucket = clock => Math.floor(clock / WEATHER_INTERVAL) * WEATHER_INTERVAL;

function seasonAt(date) {
  return SEASONS[Math.floor(((date.getUTCMonth() + 10) % 12) / 3)];
}

export function fallbackSeoulWeather(clock) {
  const date = new Date(clock + SEOUL_OFFSET);
  const season = seasonAt(date);
  const shift = (date.getUTCFullYear() * 23 + dayOfYear(date) * 31 + Math.floor(date.getUTCHours() / 3)) % 12;
  const weather = season === "winter" && shift < 2 ? "snow" :
    shift < (season === "summer" ? 4 : 2) ? "rain" : shift < 6 ? "cloudy" : "clear";
  return { source: "fallback", weather, cloud: cloudDefaults[weather],
    rain: weather === "rain" ? .43 + shift * .055 : 0, snow: weather === "snow" ? .40 + shift * .08 : 0,
    windX: .23, windZ: -.12, validFrom: weatherBucket(clock) };
}

function solarTerms(day, hour) {
  const gamma = 2 * Math.PI / 365 * (day - 1 + (hour - 12) / 24);
  const c = Math.cos(gamma), s = Math.sin(gamma), c2 = Math.cos(2 * gamma), s2 = Math.sin(2 * gamma);
  return {
    equation: 229.18 * (.000075 + .001868 * c - .032077 * s - .014615 * c2 - .040849 * s2),
    declination: .006918 - .399912 * c + .070257 * s - .006758 * c2 + .000907 * s2 -
      .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma)
  };
}

function sunPosition(day, hour) {
  const { equation, declination } = solarTerms(day, hour);
  const angle = (hour * 15 + (equation + SOLAR_OFFSET) / 4 - 180) * RAD;
  const dayLength = Math.cos(declination), polar = Math.sin(declination);
  const south = Math.sin(LATITUDE) * dayLength * Math.cos(angle) - Math.cos(LATITUDE) * polar;
  return {
    x: -dayLength * Math.sin(angle),
    y: Math.sin(LATITUDE) * polar + Math.cos(LATITUDE) * dayLength * Math.cos(angle),
    z: south
  };
}

function duskHour(day, evening) {
  const { equation, declination } = solarTerms(day, 12);
  // At two degrees the solar disk stays above the skyline and the ground still catches warm light.
  const angle = Math.acos((Math.sin(2 * RAD) - Math.sin(LATITUDE) * Math.sin(declination)) /
    (Math.cos(LATITUDE) * Math.cos(declination)));
  return 12 - (equation + SOLAR_OFFSET) / 60 + (evening ? angle : -angle) / (15 * RAD);
}

export function resolveSeoulEnvironment(environment = {}, clock = Date.now()) {
  const date = new Date(clock + SEOUL_OFFSET);
  const season = SEASONS.includes(environment.season) ? environment.season : seasonAt(date);
  const day = season === seasonAt(date) ? dayOfYear(date) : referenceDay[season];
  const time = environment.time;
  let hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  if (Number.isFinite(time)) hour = ((time % 24) + 24) % 24;
  if (time === "day") hour = 13;
  if (time === "night") hour = 22;
  if (time === "sunrise" || time === "sunset") hour = duskHour(day, time === "sunset");
  const sun = sunPosition(day, hour);
  const elevation = Math.asin(clamp(sun.y, -1, 1)) / RAD;
  const night = 1 - smooth(-9, 4, elevation);
  const twilight = smooth(-10, 0, elevation) * (1 - smooth(3, 17, elevation));
  const manual = WEATHER_TYPES.includes(environment.weather) ? environment.weather : null;
  const snapshot = environment.liveWeather;
  const usable = WEATHER_TYPES.includes(snapshot?.weather) &&
    (snapshot.source === "live" || snapshot.source === "fallback") &&
    Number.isFinite(snapshot.validFrom) && Math.abs(clock - snapshot.validFrom) < WEATHER_INTERVAL * 2;
  const weather = manual ? {
    weather: manual, source: "manual", cloud: cloudDefaults[manual],
    rain: manual === "rain" ? .68 : 0, snow: manual === "snow" ? .56 : 0, windX: .47, windZ: -.24
  } : usable ? snapshot : fallbackSeoulWeather(clock);
  return { ...weather, type: weather.weather, season, hour, sun, night, twilight, elevation,
    fog: weather.weather === "fog" ? .82 : weather.weather === "snow" ? .22 : weather.weather === "rain" ? .24 : 0 };
}

export function readSeoulWeather(current, clock) {
  if (!Number.isFinite(current?.time) || !Number.isInteger(current.weather_code) ||
    !Number.isFinite(current.cloud_cover) || Math.abs(current.time * 1000 - clock) > 90 * 60000) return null;
  const { weather_code: code, cloud_cover: cover, rain, snowfall, precipitation,
    wind_speed_10m: speed, wind_direction_10m: direction } = current;
  const frozen = [71, 73, 75, 77, 85, 86].includes(code) || snowfall > .04;
  const wet = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code) || rain > .07;
  const weather = frozen ? "snow" : wet ? "rain" : code === 45 || code === 48 ? "fog" :
    code >= 2 || cover >= 55 ? "cloudy" : "clear";
  const heading = (Number.isFinite(direction) ? direction : 295) * RAD;
  const breeze = clamp(Number.isFinite(speed) ? speed / 16 : .5, .12, 2);
  return {
    source: "live", weather, cloud: clamp(cover / 100, weather === "rain" ? .68 : weather === "snow" ? .55 : .08),
    rain: wet && !frozen ? clamp(.33 + Math.max(0, rain || precipitation || 0) * .22, .32, 1) : 0,
    snow: frozen ? clamp(.34 + Math.max(0, snowfall || 0) * .56, .34, 1) : 0,
    windX: -Math.sin(heading) * breeze, windZ: Math.cos(heading) * breeze,
    observedAt: current.time * 1000, validFrom: weatherBucket(clock)
  };
}
