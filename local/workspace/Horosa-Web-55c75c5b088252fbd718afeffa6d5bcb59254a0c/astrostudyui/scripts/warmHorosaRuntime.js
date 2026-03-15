const { forge, RSA } = require('./loadCryptoDeps');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const SERVER = process.env.HOROSA_SERVER_ROOT || 'http://127.0.0.1:9999';
const CHART_SERVER = process.env.HOROSA_CHART_SERVER_ROOT || 'http://127.0.0.1:8899';
const QUICK_RETRY_COUNT = Number(process.env.HOROSA_WARM_QUICK_RETRY_COUNT || 90);
const FULL_RETRY_COUNT = Number(process.env.HOROSA_WARM_FULL_RETRY_COUNT || 20);
const QUICK_RETRY_DELAY_MS = Number(process.env.HOROSA_WARM_QUICK_RETRY_DELAY_MS || 80);
const FULL_RETRY_DELAY_MS = Number(process.env.HOROSA_WARM_FULL_RETRY_DELAY_MS || Number(process.env.HOROSA_WARM_RETRY_DELAY_MS || 500));

const SignatureKey = 'FE45AB6E29EF';
const ClientChannel = '1';
const ClientApp = '1';
const ClientVer = '1.0';
const Token = '';
const StartupChartCacheKey = 'horosa.startupChartCache.v1';

const modulus = '902563E4F9348E8366C0939BAB48D4403AA7CCD933EECF899265228512C4B72F2E30084B7CADF97132D0882A51FB814E5ADD82D676CFCFBC22ECDDCFACE8D4444BC60B5B30A53EB933321BA2FB9AA69727C03A5E6A90BDAB5895A8E179FF24CF9B0F66A4061E028EAB86FCE733254B5ED2D0CE47AF7A4CD1BB987702237F2A89FE8D86938ACD9D125CC6A1094AA291418D088D355A139E00C406045D38BD215F23F3D222352FD74AC914798FE3160B10A93C7F15319D5B44840850DF6A504E0299CD994F0A3133C7D58054AB19C43B6FEAA71AC0F61904665F345C2D99A25BD56D1CBFFFD08BE699D6FA53E1AD2ED812B8710DBA86D4CC43FF6389DEDD2888B9';
const publicexp = '10001';
const keypair = new RSA.RSAKeyPair(publicexp, publicexp, modulus, 2048);
const KeyLen = 16;

function pad2(num) {
  return `${num}`.padStart(2, '0');
}

function buildWarmStartupPayload() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  return {
    date: process.env.HOROSA_WARM_DATE || `${year}/${pad2(month)}/${pad2(day)}`,
    time: process.env.HOROSA_WARM_TIME || `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    zone: process.env.HOROSA_WARM_ZONE || '+08:00',
    lat: process.env.HOROSA_WARM_LAT || '26n04',
    lon: process.env.HOROSA_WARM_LON || '119e19',
    gpsLat: Number(process.env.HOROSA_WARM_GPS_LAT || 26.076417371316914),
    gpsLon: Number(process.env.HOROSA_WARM_GPS_LON || 119.31516153077507),
  };
}

const STARTUP_PAYLOAD = buildWarmStartupPayload();

const STARTUP_BASE_PAYLOAD = {
  date: STARTUP_PAYLOAD.date,
  time: STARTUP_PAYLOAD.time,
  zone: STARTUP_PAYLOAD.zone,
  lat: STARTUP_PAYLOAD.lat,
  lon: STARTUP_PAYLOAD.lon,
  gpsLat: STARTUP_PAYLOAD.gpsLat,
  gpsLon: STARTUP_PAYLOAD.gpsLon,
  hsys: Number(process.env.HOROSA_WARM_HSYS || 0),
  tradition: false,
  predictive: true,
  zodiacal: 0,
  simpleAsp: false,
  strongRecption: false,
  virtualPointReceiveAsp: true,
  southchart: false,
  ad: 1,
  name: 'Horosa Warmup',
  pos: 'Launch',
};

const BASE_PAYLOAD = {
  date: '2028/04/06',
  time: '09:33:00',
  zone: '+00:00',
  lat: '41n26',
  lon: '174w30',
  gpsLat: -41.433333,
  gpsLon: 174.5,
  hsys: 1,
  tradition: false,
  predictive: true,
  zodiacal: 0,
  simpleAsp: false,
  strongRecption: false,
  virtualPointReceiveAsp: true,
  southchart: false,
  ad: 1,
  name: 'Horosa Warmup',
  pos: 'Shanghai',
};

function getBasePayloadForMode(mode = 'full') {
  return mode === 'quick' ? STARTUP_BASE_PAYLOAD : BASE_PAYLOAD;
}

function getJieqiYearForMode(mode = 'full') {
  if (mode === 'quick') {
    const match = `${STARTUP_BASE_PAYLOAD.date || ''}`.match(/^(\d{4})[\/-]/);
    if (match) {
      return match[1];
    }
    return `${new Date().getFullYear()}`;
  }
  return '2032';
}

function randomKeyStr(len) {
  const txt = 'abcdefghijklmnopqrstuvwxyz0123456789_';
  const arr = [];
  for (let i = 0; i < len; i += 1) {
    arr.push(txt[Math.floor(Math.random() * txt.length)]);
  }
  return arr.join('');
}

function extractKey(data) {
  let key = '';
  for (let i = KeyLen - 1; i >= 0; i -= 1) {
    key += data[i];
  }
  return key;
}

function encryptRSA(txt, tm) {
  const txtkey = randomKeyStr(KeyLen);
  const cipher = forge.cipher.createCipher('AES-ECB', txtkey);
  cipher.start();
  cipher.update(forge.util.createBuffer(txt, 'utf8'));
  cipher.finish();
  const encoded = forge.util.encode64(cipher.output.bytes());
  const rsakeyraw = RSA.encryptedString(keypair, txtkey, RSA.RSAAPP.PKCS1Padding, RSA.RSAAPP.RawEncoding);
  const rsakey = forge.util.encode64(rsakeyraw);
  let res = `${encoded},${rsakey}`;
  if (tm) {
    const tmcipher = forge.cipher.createCipher('AES-ECB', txtkey);
    tmcipher.start();
    tmcipher.update(forge.util.createBuffer(`${tm}`, 'utf8'));
    tmcipher.finish();
    res = `${res},${forge.util.encode64(tmcipher.output.bytes())}`;
  }
  return res;
}

function decryptRSA(txt) {
  const parts = txt.split(',');
  const keyWordAry = forge.util.decode64(parts[1]);
  const keycoded = forge.util.createBuffer(keyWordAry).toHex();
  const txtkeyStr = RSA.decryptedString(keypair, keycoded);
  const txtkey = extractKey(txtkeyStr);
  const coded = forge.util.decode64(parts[0]);
  const decipher = forge.cipher.createDecipher('AES-ECB', txtkey);
  decipher.start();
  decipher.update(forge.util.createBuffer(coded));
  decipher.finish();
  return forge.util.decodeUtf8(decipher.output.bytes());
}

function sign(bodyPlain) {
  const data = `${Token}${SignatureKey}${ClientChannel}${ClientApp}${ClientVer}${bodyPlain}`;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureParentDir(filePath) {
  if (!filePath) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildSerializedDateTime(basePayload) {
  const [year, month, date] = `${basePayload.date || ''}`.split(/[/-]/).map((item) => parseInt(item, 10));
  const [hour, minute, secondRaw] = `${basePayload.time || ''}`.split(':').map((item) => parseInt(item, 10));
  const second = Number.isFinite(secondRaw) ? secondRaw : 0;
  return {
    __type: 'DateTime',
    ad: Number.isFinite(basePayload.ad) ? basePayload.ad : 1,
    year,
    month,
    date,
    hour,
    minute,
    second,
    zone: basePayload.zone || '+08:00',
  };
}

function buildStartupSerializedFields(basePayload) {
  const serializedDateTime = buildSerializedDateTime(basePayload);
  return {
    cid: { value: null, name: ['cid'] },
    ad: { value: serializedDateTime.ad, name: ['ad'] },
    date: { value: serializedDateTime, name: ['date'] },
    time: { value: serializedDateTime, name: ['time'] },
    zone: { value: basePayload.zone || '+08:00', name: ['zone'] },
    lat: { value: basePayload.lat || '26n04', name: ['lat'] },
    lon: { value: basePayload.lon || '119e19', name: ['lon'] },
    gpsLat: { value: basePayload.gpsLat, name: ['gpsLat'] },
    gpsLon: { value: basePayload.gpsLon, name: ['gpsLon'] },
    name: { value: basePayload.name || 'Horosa Warmup', name: ['name'] },
    pos: { value: basePayload.pos || 'Launch', name: ['pos'] },
    hsys: { value: Number.isFinite(basePayload.hsys) ? basePayload.hsys : 0, name: ['hsys'] },
    zodiacal: { value: basePayload.zodiacal || 0, name: ['zodiacal'] },
    tradition: { value: basePayload.tradition ? 1 : 0, name: ['tradition'] },
    strongRecption: { value: basePayload.strongRecption ? 1 : 0, name: ['strongRecption'] },
    simpleAsp: { value: basePayload.simpleAsp ? 1 : 0, name: ['simpleAsp'] },
    virtualPointReceiveAsp: { value: basePayload.virtualPointReceiveAsp ? 1 : 0, name: ['virtualPointReceiveAsp'] },
    doubingSu28: { value: basePayload.doubingSu28 ? 1 : 0, name: ['doubingSu28'] },
    houseStartMode: { value: 0, name: ['houseStartMode'] },
    predictive: { value: basePayload.predictive ? 1 : 0, name: ['predictive'] },
    showPdBounds: { value: 1, name: ['showPdBounds'] },
    pdtype: { value: 0, name: ['pdtype'] },
    pdMethod: { value: 'astroapp_alchabitius', name: ['pdMethod'] },
    pdTimeKey: { value: 'Ptolemy', name: ['pdTimeKey'] },
    pdaspects: { value: [0, 60, 90, 120, 180], name: ['pdaspects'] },
    timeAlg: { value: 0, name: ['timeAlg'] },
    phaseType: { value: 0, name: ['phaseType'] },
    gender: { value: 1, name: ['gender'] },
    southchart: { value: basePayload.southchart ? 1 : 0, name: ['southchart'] },
    group: { value: null, name: ['group'] },
  };
}

function writeStartupCacheArtifact(result, basePayload) {
  const targetJs = `${process.env.HOROSA_STARTUP_CACHE_JS || ''}`.trim()
    || path.resolve(__dirname, '..', 'dist-file', 'startup-cache.js');
  if (!targetJs) {
    return;
  }
  const payload = {
    savedAt: Date.now(),
    chartObj: result,
    fields: buildStartupSerializedFields(basePayload),
  };
  const script = `window.__HOROSA_STARTUP_CACHE = ${JSON.stringify(payload)};\n`;
  ensureParentDir(targetJs);
  fs.writeFileSync(targetJs, script, 'utf8');
}

function writeEmptyStartupCacheArtifact() {
  const targetJs = `${process.env.HOROSA_STARTUP_CACHE_JS || ''}`.trim()
    || path.resolve(__dirname, '..', 'dist-file', 'startup-cache.js');
  if (!targetJs) {
    return;
  }
  ensureParentDir(targetJs);
  fs.writeFileSync(targetJs, 'window.__HOROSA_STARTUP_CACHE = null;\n', 'utf8');
}

function isRetryableError(err) {
  const message = `${(err && err.message) || err || ''}`.toLowerCase();
  return (
    message.includes('fetch failed')
    || message.includes('ecconnrefused')
    || message.includes('econnreset')
    || message.includes('socket hang up')
    || message.includes('status=500')
    || message.includes('status=502')
    || message.includes('status=503')
    || message.includes('status=504')
    || message.includes('timed out')
    || message.includes('plain parse error')
  );
}

async function call(pathname, bodyObj) {
  const bodyPlain = JSON.stringify(bodyObj || {});
  const encodedBody = encryptRSA(bodyPlain, Date.now());
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    Token,
    ClientChannel,
    ClientApp,
    ClientVer,
    Signature: sign(bodyPlain),
  };
  const resp = await fetch(`${SERVER}${pathname}`, {
    method: 'POST',
    headers,
    body: encodedBody,
  });
  let text = await resp.text();
  if (resp.headers.get('Encrypted') === '1') {
    text = decryptRSA(text);
  }
  const json = JSON.parse(text);
  if (json && json.ResultCode && json.ResultCode !== 0) {
    throw new Error(`api error ${pathname} code=${json.ResultCode} result=${json.Result}`);
  }
  return json && json.Result !== undefined ? json.Result : json;
}

async function callPlain(pathname, bodyObj) {
  const resp = await fetch(`${CHART_SERVER}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(bodyObj || {}),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`plain api error ${pathname} status=${resp.status} body=${text.slice(0, 400)}`);
  }
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`plain parse error for ${pathname}: ${text.slice(0, 400)}`);
  }
}

async function warmOne(label, pathname, payloadInput, transport = 'encrypted', mode = 'full', initialDelayMs = 0, captureResult = false) {
  const start = performance.now();
  const retryCount = mode === 'quick' ? QUICK_RETRY_COUNT : FULL_RETRY_COUNT;
  const retryDelayMs = mode === 'quick' ? QUICK_RETRY_DELAY_MS : FULL_RETRY_DELAY_MS;
  const resolvePayload = typeof payloadInput === 'function'
    ? payloadInput
    : async () => payloadInput;
  let lastError = null;

  if (initialDelayMs > 0) {
    await wait(initialDelayMs);
  }

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const payload = await resolvePayload();
      let result;
      if (transport === 'plain') {
        result = await callPlain(pathname, payload);
      } else {
        result = await call(pathname, payload);
      }
      const elapsed = Number((performance.now() - start).toFixed(3));
      const attemptSuffix = attempt > 0 ? ` (retry ${attempt})` : '';
      console.log(`${label}: ${elapsed}ms${attemptSuffix}`);
      return captureResult ? result : undefined;
    } catch (err) {
      lastError = err;
      if (attempt >= retryCount || !isRetryableError(err)) {
        break;
      }
      await wait(retryDelayMs);
    }
  }

  throw lastError;
}

async function buildLiurengRunyearPayload(basePayload = BASE_PAYLOAD) {
  const source = basePayload || BASE_PAYLOAD;
  const runyearDate = source === BASE_PAYLOAD ? '2020-04-06' : source.date.replaceAll('/', '-');
  const liureng = await call('/liureng/gods', {
    date: source.date.replaceAll('/', '-'),
    time: source.time,
    zone: source.zone,
    lon: source.lon,
    lat: source.lat,
    ad: source.ad || 1,
    after23NewDay: false,
  });
  const guaYearGanZi = `${(
    (liureng.liureng && liureng.liureng.nongli && (
      liureng.liureng.nongli.yearGanZi
      || liureng.liureng.nongli.yearJieqi
      || liureng.liureng.nongli.year
    ))
    || ''
  )}`.trim();
  if (!guaYearGanZi) {
    throw new Error('/liureng/gods missing guaYearGanZi source during warmup');
  }
  return {
    date: runyearDate,
    time: source.time,
    zone: source.zone,
    lon: source.lon,
    lat: source.lat,
    ad: source.ad || 1,
    gender: true,
    after23NewDay: false,
    guaDate: source.date.replaceAll('/', '-'),
    guaTime: source.time,
    guaZone: source.zone,
    guaLat: source.lat,
    guaLon: source.lon,
    guaAd: source.ad || 1,
    guaAfter23NewDay: false,
    guaYearGanZi,
  };
}

const SCENARIOS = [
  {
    label: 'chart-direct',
    pathname: '/',
    modes: ['startup', 'quick', 'full'],
    transport: 'plain',
    payload: async (mode) => ({
      ...getBasePayloadForMode(mode),
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
  },
  {
    label: 'chart-backend',
    pathname: '/chart',
    modes: ['quick', 'full'],
    initialDelayMs: 900,
    payload: async (mode) => ({
      ...getBasePayloadForMode(mode),
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
  },
  {
    label: 'chart-backend-base',
    pathname: '/chart',
    modes: ['full'],
    initialDelayMs: 1200,
    payload: async () => ({
      ...BASE_PAYLOAD,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
  },
  {
    label: 'predict-zr',
    pathname: '/predict/zr',
    modes: ['quick', 'full'],
    transport: 'plain',
    initialDelayMs: 820,
    payload: async (mode) => ({
      date: getBasePayloadForMode(mode).date,
      time: getBasePayloadForMode(mode).time,
      zone: getBasePayloadForMode(mode).zone,
      lon: getBasePayloadForMode(mode).lon,
      lat: getBasePayloadForMode(mode).lat,
      hsys: getBasePayloadForMode(mode).hsys,
      tradition: getBasePayloadForMode(mode).tradition,
      birth: `${getBasePayloadForMode(mode).date} ${getBasePayloadForMode(mode).time}`,
      zodiacal: getBasePayloadForMode(mode).zodiacal,
      stopLevelIdx: 3,
      startSign: null,
    }),
  },
  {
    label: 'guolao-chart',
    pathname: '/chart',
    modes: ['full'],
    initialDelayMs: 1700,
    payload: async () => ({
      date: '2028/04/06',
      time: '09:33:00',
      zone: '+08:00',
      lat: '31n13',
      lon: '121e28',
      gpsLat: 31.2167,
      gpsLon: 121.4667,
      hsys: 0,
      tradition: 1,
      zodiacal: 0,
      doubingSu28: 1,
      strongRecption: 0,
      simpleAsp: 0,
      virtualPointReceiveAsp: 0,
      predictive: 0,
      ad: 1,
      name: 'Guolao Warmup',
      pos: 'Shanghai',
    }),
  },
  {
    label: 'predict-pd',
    pathname: '/predict/pd',
    modes: ['quick', 'full'],
    transport: 'plain',
    initialDelayMs: 980,
    payload: async (mode) => ({
      ...getBasePayloadForMode(mode),
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
  },
  {
    label: 'predict-pd-base',
    pathname: '/predict/pd',
    modes: ['full'],
    transport: 'plain',
    initialDelayMs: 1100,
    payload: async () => ({
      ...BASE_PAYLOAD,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
  },
  {
    label: 'predict-pdchart',
    pathname: '/predict/pdchart',
    modes: ['quick', 'full'],
      transport: 'plain',
    initialDelayMs: 980,
    payload: async (mode) => ({
      date: getBasePayloadForMode(mode).date,
      time: getBasePayloadForMode(mode).time,
      ad: getBasePayloadForMode(mode).ad,
      zone: getBasePayloadForMode(mode).zone,
      dirZone: '+00:00',
      lon: getBasePayloadForMode(mode).lon,
      lat: getBasePayloadForMode(mode).lat,
      gpsLat: getBasePayloadForMode(mode).gpsLat,
      gpsLon: getBasePayloadForMode(mode).gpsLon,
      hsys: getBasePayloadForMode(mode).hsys,
      zodiacal: getBasePayloadForMode(mode).zodiacal,
      tradition: getBasePayloadForMode(mode).tradition,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      showPdBounds: 1,
      datetime: '2031-04-06 09:33:00',
    }),
  },
  {
    label: 'predict-pdchart-base',
    pathname: '/predict/pdchart',
    modes: ['full'],
    transport: 'plain',
    initialDelayMs: 1100,
    payload: async () => ({
      date: BASE_PAYLOAD.date,
      time: BASE_PAYLOAD.time,
      ad: BASE_PAYLOAD.ad,
      zone: BASE_PAYLOAD.zone,
      dirZone: '+00:00',
      lon: BASE_PAYLOAD.lon,
      lat: BASE_PAYLOAD.lat,
      gpsLat: BASE_PAYLOAD.gpsLat,
      gpsLon: BASE_PAYLOAD.gpsLon,
      hsys: BASE_PAYLOAD.hsys,
      zodiacal: BASE_PAYLOAD.zodiacal,
      tradition: BASE_PAYLOAD.tradition,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      showPdBounds: 1,
      datetime: '2031-04-06 09:33:00',
    }),
  },
  {
    label: 'predict-zr-base',
    pathname: '/predict/zr',
    modes: ['full'],
    transport: 'plain',
    initialDelayMs: 1100,
    payload: async () => ({
      date: BASE_PAYLOAD.date,
      time: BASE_PAYLOAD.time,
      zone: BASE_PAYLOAD.zone,
      lon: BASE_PAYLOAD.lon,
      lat: BASE_PAYLOAD.lat,
      hsys: BASE_PAYLOAD.hsys,
      tradition: BASE_PAYLOAD.tradition,
      birth: `${BASE_PAYLOAD.date} ${BASE_PAYLOAD.time}`,
      zodiacal: BASE_PAYLOAD.zodiacal,
      stopLevelIdx: 3,
      startSign: null,
    }),
  },
  { label: 'predict-profection', pathname: '/predict/profection', modes: ['full'], transport: 'plain', payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }) },
  { label: 'predict-solararc', pathname: '/predict/solararc', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 240, payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }) },
  { label: 'predict-solarreturn', pathname: '/predict/solarreturn', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 80, payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'predict-lunarreturn', pathname: '/predict/lunarreturn', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 340, payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'predict-givenyear', pathname: '/predict/givenyear', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 1100, payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'chart13', pathname: '/chart13', modes: ['quick', 'full'], transport: 'plain', payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'india-chart', pathname: '/india/chart', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 320, payload: async () => ({ ...BASE_PAYLOAD, zodiacal: 1, predictive: 1, pdtype: 0, pdMethod: 'astroapp_alchabitius', pdTimeKey: 'Ptolemy', pdaspects: [0, 60, 90, 120, 180] }) },
  { label: 'jieqi24', pathname: '/jieqi/year', modes: ['full'], transport: 'plain', payload: async (mode) => ({ year: getJieqiYearForMode(mode), ad: getBasePayloadForMode(mode).ad, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, gpsLat: getBasePayloadForMode(mode).gpsLat, gpsLon: getBasePayloadForMode(mode).gpsLon, hsys: getBasePayloadForMode(mode).hsys, zodiacal: getBasePayloadForMode(mode).zodiacal, doubingSu28: false }) },
  { label: 'jieqi24-backend', pathname: '/jieqi/year', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 60, payload: async (mode) => ({ year: getJieqiYearForMode(mode), ad: getBasePayloadForMode(mode).ad, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, gpsLat: getBasePayloadForMode(mode).gpsLat, gpsLon: getBasePayloadForMode(mode).gpsLon, hsys: getBasePayloadForMode(mode).hsys, zodiacal: getBasePayloadForMode(mode).zodiacal, doubingSu28: false }) },
  { label: 'jieqi24-backend-base', pathname: '/jieqi/year', modes: ['full'], transport: 'plain', initialDelayMs: 90, payload: async () => ({ year: '2032', ad: BASE_PAYLOAD.ad, zone: BASE_PAYLOAD.zone, lon: BASE_PAYLOAD.lon, lat: BASE_PAYLOAD.lat, gpsLat: BASE_PAYLOAD.gpsLat, gpsLon: BASE_PAYLOAD.gpsLon, hsys: BASE_PAYLOAD.hsys, zodiacal: BASE_PAYLOAD.zodiacal, doubingSu28: false }) },
  { label: 'jieqi24-java', pathname: '/jieqi/year', modes: ['full'], initialDelayMs: 1700, payload: async (mode) => ({ year: getJieqiYearForMode(mode), ad: getBasePayloadForMode(mode).ad, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, gpsLat: getBasePayloadForMode(mode).gpsLat, gpsLon: getBasePayloadForMode(mode).gpsLon, hsys: getBasePayloadForMode(mode).hsys, zodiacal: getBasePayloadForMode(mode).zodiacal, doubingSu28: false }) },
  { label: 'relative-chart', pathname: '/modern/relative', modes: ['full'], payload: async () => ({ inner: { date: '2028/04/06', time: '09:33:00', zone: '+00:00', lat: '41n26', lon: '174w30', ad: 1 }, outer: { date: '2029/09/16', time: '18:45:00', zone: '+08:00', lat: '31n13', lon: '121e28', ad: 1 }, hsys: 1, zodiacal: 0, relative: 0 }) },
{ label: 'acg', pathname: '/location/acg', modes: ['quick', 'full'], transport: 'plain', initialDelayMs: 420, payload: async (mode) => ({ ...getBasePayloadForMode(mode), predictive: 0 }) },
{ label: 'acg-base', pathname: '/location/acg', modes: ['full'], transport: 'plain', initialDelayMs: 180, payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'germany-midpoint', pathname: '/germany/midpoint', modes: ['full'], transport: 'plain', payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'nongli-time', pathname: '/nongli/time', modes: ['full'], initialDelayMs: 260, payload: async (mode) => ({ date: getBasePayloadForMode(mode).date.replaceAll('/', '-'), time: getBasePayloadForMode(mode).time, zone: getBasePayloadForMode(mode).zone, lat: getBasePayloadForMode(mode).lat, lon: getBasePayloadForMode(mode).lon, gpsLat: getBasePayloadForMode(mode).gpsLat, gpsLon: getBasePayloadForMode(mode).gpsLon, gender: true, ad: getBasePayloadForMode(mode).ad, after23NewDay: 0, timeAlg: 0 }) },
  { label: 'jieqi-seed', pathname: '/jieqi/year', modes: ['full'], payload: async () => ({ year: 2028, ad: 1, zone: '+08:00', lon: '121e28', lat: '31n13', gpsLat: 31.2167, gpsLon: 121.4667, timeAlg: 0, jieqis: ['大雪', '芒种'], seedOnly: true }) },
  { label: 'liureng-gods', pathname: '/liureng/gods', modes: ['quick', 'full'], initialDelayMs: 520, payload: async (mode) => ({ date: getBasePayloadForMode(mode).date.replaceAll('/', '-'), time: getBasePayloadForMode(mode).time, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, ad: getBasePayloadForMode(mode).ad, after23NewDay: false }) },
  { label: 'gua-desc', pathname: '/gua/desc', modes: ['full'], payload: async () => ({ name: ['111111', '000000', '101010'] }) },
  { label: 'bazi-direct', pathname: '/bazi/direct', modes: ['full'], initialDelayMs: 3200, payload: async (mode) => ({ date: getBasePayloadForMode(mode).date.replaceAll('/', '-'), time: getBasePayloadForMode(mode).time, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, gpsLat: getBasePayloadForMode(mode).gpsLat, gpsLon: getBasePayloadForMode(mode).gpsLon, gender: true, ad: getBasePayloadForMode(mode).ad, after23NewDay: false, timeAlg: 0, byLon: false, phaseType: 0 }) },
  { label: 'ziwei-birth', pathname: '/ziwei/birth', modes: ['full'], initialDelayMs: 3800, payload: async (mode) => ({ date: getBasePayloadForMode(mode).date.replaceAll('/', '-'), time: getBasePayloadForMode(mode).time, zone: getBasePayloadForMode(mode).zone, lon: getBasePayloadForMode(mode).lon, lat: getBasePayloadForMode(mode).lat, ad: getBasePayloadForMode(mode).ad, gender: true, after23NewDay: false, timeAlg: 0 }) },
  { label: 'calendar-month', pathname: '/calendar/month', modes: ['full'], payload: async () => ({ date: '2028-04-01', zone: '+08:00', lon: '121e28', ad: 1 }) },
{ label: 'liureng-runyear', pathname: '/liureng/runyear', modes: ['quick', 'full'], initialDelayMs: 650, payload: async (mode) => buildLiurengRunyearPayload(getBasePayloadForMode(mode)) },
{ label: 'liureng-runyear-base', pathname: '/liureng/runyear', modes: ['full'], initialDelayMs: 1750, payload: async () => buildLiurengRunyearPayload(BASE_PAYLOAD) },
  {
    label: 'jieqi-legacy',
    pathname: '/jieqi/year',
    modes: ['full'],
    transport: 'plain',
    payload: async () => ({
      year: 2028,
      ad: 1,
      zone: '+08:00',
      lon: '121e28',
      lat: '31n13',
      gpsLat: 31.2167,
      gpsLon: 121.4667,
      timeAlg: 0,
      hsys: 1,
      zodiacal: 0,
      doubingSu28: false,
      jieqis: ['春分', '夏至', '秋分', '冬至'],
    }),
  },
];

function resolveMode() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--mode=')) {
      return arg.split('=', 2)[1].trim().toLowerCase();
    }
  }
  const envMode = `${process.env.HOROSA_WARM_MODE || ''}`.trim().toLowerCase();
  if (envMode) {
    return envMode;
  }
  return 'full';
}

async function runWithConcurrency(selected, mode, limit) {
  const queue = [...selected];
  const failures = [];
  const workerCount = Math.max(1, Math.min(limit, queue.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const scenario = queue.shift();
      if (!scenario) {
        break;
      }
      try {
        await warmOne(
          scenario.label,
          scenario.pathname,
          () => scenario.payload(mode),
          scenario.transport || 'encrypted',
          mode,
          scenario.initialDelayMs || 0,
        );
      } catch (error) {
        failures.push({
          label: scenario.label,
          message: error && error.message ? error.message : String(error),
        });
        console.log(`[warmup-warning] ${scenario.label}: ${error && error.message ? error.message : String(error)}`);
      }
    }
  });
  await Promise.all(workers);
  return failures;
}

function buildScenarioRunner(label, modeOverride = null) {
  const scenario = SCENARIOS.find((item) => item.label === label);
  if (!scenario) {
    return null;
  }
  return {
    ...scenario,
    payload: async () => scenario.payload(modeOverride || 'full'),
    warmMode: modeOverride || 'full',
  };
}

async function run(mode) {
  const selected = SCENARIOS.filter((scenario) => scenario.modes.includes(mode));
  if (selected.length === 0) {
    throw new Error(`unknown warmup mode: ${mode}`);
  }

  if (mode === 'startup') {
    const failures = await runWithConcurrency(selected, mode, 2);
    if (failures.length > 0) {
      console.warn(`[warmup-summary] ${mode} failures=${failures.length}`);
    }
    return;
  }

  if (mode === 'quick') {
    const quickCritical = [
      'chart-direct',
      'chart-backend',
      'predict-pd',
      'predict-zr',
      'india-chart',
      'acg',
      'jieqi24-backend',
      'liureng-gods',
      'liureng-runyear',
      'predict-solarreturn',
      'chart13',
    ];
    const quickFollowup = [
      'predict-pdchart',
      'predict-lunarreturn',
      'predict-givenyear',
      'predict-solararc',
    ];
    const orderedCritical = [];
    for (const label of quickCritical) {
      const scenario = selected.find((item) => item.label === label);
      if (scenario) {
        orderedCritical.push(scenario);
      }
    }
    const orderedFollowup = [];
    for (const label of quickFollowup) {
      const scenario = selected.find((item) => item.label === label);
      if (scenario) {
        orderedFollowup.push(scenario);
      }
    }
    const tail = selected.filter((item) => !quickCritical.includes(item.label) && !quickFollowup.includes(item.label));
    const failures = [];
      const criticalFailures = await runWithConcurrency(orderedCritical, mode, 1);
      failures.push(...criticalFailures);
      const followupFailures = await runWithConcurrency([...orderedFollowup, ...tail], mode, 2);
    failures.push(...followupFailures);
    if (failures.length > 0) {
      console.warn(`[warmup-summary] ${mode} failures=${failures.length}`);
    }
    return;
  }

  if (mode === 'full') {
    const fullCritical = [
      'guolao-chart',
      'chart13',
      'india-chart',
      'acg',
      'acg-base',
      'liureng-gods',
      'liureng-runyear-base',
      'liureng-runyear',
      'predict-solarreturn',
      'predict-solararc',
      'predict-lunarreturn',
      'predict-givenyear',
      'predict-pd',
      'predict-pd-base',
      'predict-pdchart',
      'predict-pdchart-base',
      'predict-zr',
      'predict-zr-base',
      'chart-backend',
      'chart-backend-base',
      'jieqi24-backend',
      'jieqi24-backend-base',
      'jieqi24-java',
      'nongli-time',
    ];
    const orderedCritical = [];
    for (const label of fullCritical) {
      const scenario = selected.find((item) => item.label === label);
      if (scenario) {
        orderedCritical.push(scenario);
      }
    }
    const tail = selected.filter((item) => !fullCritical.includes(item.label));
    const failures = [];
    failures.push(...await runWithConcurrency(orderedCritical, mode, 3));
    failures.push(...await runWithConcurrency(tail, mode, 2));
    if (failures.length > 0) {
      console.warn(`[warmup-summary] ${mode} failures=${failures.length}`);
    }
    return;
  }

  const failures = [];
  for (const scenario of selected) {
    try {
      await warmOne(
        scenario.label,
        scenario.pathname,
        () => scenario.payload(),
        scenario.transport || 'encrypted',
        mode,
        scenario.initialDelayMs || 0,
      );
    } catch (error) {
      failures.push({
        label: scenario.label,
        message: error && error.message ? error.message : String(error),
      });
      console.log(`[warmup-warning] ${scenario.label}: ${error && error.message ? error.message : String(error)}`);
    }
  }
  if (failures.length > 0) {
    console.warn(`[warmup-summary] ${mode} failures=${failures.length}`);
  }
}

async function main() {
  const mode = resolveMode();
  const start = performance.now();
  console.log(`warmup-mode: ${mode}`);
  if (mode === 'startup') {
    const chartDirectScenario = SCENARIOS.find((item) => item.label === 'chart-direct');
    if (!chartDirectScenario) {
      throw new Error('startup warmup missing chart-direct scenario');
    }
    const payload = await chartDirectScenario.payload(mode);
    try {
      const result = await warmOne(
        chartDirectScenario.label,
        chartDirectScenario.pathname,
        payload,
        chartDirectScenario.transport || 'plain',
        mode,
        0,
        true,
      );
      if (!result || typeof result !== 'object') {
        throw new Error('startup chart-direct returned empty result');
      }
      writeStartupCacheArtifact(result, payload);
    } catch (error) {
      writeEmptyStartupCacheArtifact();
      throw error;
    }
    console.log(`warmup-total: ${Number((performance.now() - start).toFixed(3))}ms`);
    return;
  }
  await run(mode);
  console.log(`warmup-total: ${Number((performance.now() - start).toFixed(3))}ms`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
