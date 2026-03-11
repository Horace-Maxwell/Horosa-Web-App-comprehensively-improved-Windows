const { forge, RSA } = require('./loadCryptoDeps');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const SERVER = process.env.HOROSA_SERVER_ROOT || 'http://127.0.0.1:9999';
const CHART_SERVER = process.env.HOROSA_CHART_SERVER_ROOT || 'http://127.0.0.1:8899';

const SignatureKey = 'FE45AB6E29EF';
const ClientChannel = '1';
const ClientApp = '1';
const ClientVer = '1.0';
const Token = '';

const modulus = '902563E4F9348E8366C0939BAB48D4403AA7CCD933EECF899265228512C4B72F2E30084B7CADF97132D0882A51FB814E5ADD82D676CFCFBC22ECDDCFACE8D4444BC60B5B30A53EB933321BA2FB9AA69727C03A5E6A90BDAB5895A8E179FF24CF9B0F66A4061E028EAB86FCE733254B5ED2D0CE47AF7A4CD1BB987702237F2A89FE8D86938ACD9D125CC6A1094AA291418D088D355A139E00C406045D38BD215F23F3D222352FD74AC914798FE3160B10A93C7F15319D5B44840850DF6A504E0299CD994F0A3133C7D58054AB19C43B6FEAA71AC0F61904665F345C2D99A25BD56D1CBFFFD08BE699D6FA53E1AD2ED812B8710DBA86D4CC43FF6389DEDD2888B9';
const publicexp = '10001';
const keypair = new RSA.RSAKeyPair(publicexp, publicexp, modulus, 2048);
const KeyLen = 16;

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
  pos: 'Wellington',
};

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

async function warmOne(label, pathname, payload, transport = 'encrypted') {
  const start = performance.now();
  if (transport === 'plain') {
    await callPlain(pathname, payload);
  } else {
    await call(pathname, payload);
  }
  const elapsed = Number((performance.now() - start).toFixed(3));
  console.log(`${label}: ${elapsed}ms`);
}

async function buildLiurengRunyearPayload() {
  const liureng = await call('/liureng/gods', {
    date: '2028-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lon: '121e28',
    lat: '31n13',
    ad: 1,
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
    date: '2020-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lon: '121e28',
    lat: '31n13',
    ad: 1,
    gender: true,
    after23NewDay: false,
    guaDate: '2028-04-06',
    guaTime: '09:33:00',
    guaZone: '+08:00',
    guaLat: '31n13',
    guaLon: '121e28',
    guaAd: 1,
    guaAfter23NewDay: false,
    guaYearGanZi,
  };
}

const SCENARIOS = [
  {
    label: 'chart',
    pathname: '/chart',
    modes: ['quick'],
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
  {
    label: 'guolao-chart',
    pathname: '/chart',
    modes: ['full'],
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
    modes: ['full'],
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
  { label: 'predict-profection', pathname: '/predict/profection', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }) },
  { label: 'predict-solararc', pathname: '/predict/solararc', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }) },
  { label: 'predict-solarreturn', pathname: '/predict/solarreturn', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'predict-lunarreturn', pathname: '/predict/lunarreturn', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'predict-givenyear', pathname: '/predict/givenyear', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }) },
  { label: 'chart13', pathname: '/chart13', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'india-chart', pathname: '/india/chart', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, zodiacal: 1, predictive: 1, pdtype: 0, pdMethod: 'astroapp_alchabitius', pdTimeKey: 'Ptolemy', pdaspects: [0, 60, 90, 120, 180] }) },
  { label: 'jieqi24', pathname: '/jieqi/year', modes: ['quick'], transport: 'plain', payload: async () => ({ year: '2032', ad: BASE_PAYLOAD.ad, zone: BASE_PAYLOAD.zone, lon: BASE_PAYLOAD.lon, lat: BASE_PAYLOAD.lat, gpsLat: BASE_PAYLOAD.gpsLat, gpsLon: BASE_PAYLOAD.gpsLon, hsys: BASE_PAYLOAD.hsys, zodiacal: BASE_PAYLOAD.zodiacal, doubingSu28: false }) },
  { label: 'jieqi24-backend', pathname: '/jieqi/year', modes: ['quick'], payload: async () => ({ year: '2032', ad: BASE_PAYLOAD.ad, zone: BASE_PAYLOAD.zone, lon: BASE_PAYLOAD.lon, lat: BASE_PAYLOAD.lat, gpsLat: BASE_PAYLOAD.gpsLat, gpsLon: BASE_PAYLOAD.gpsLon, hsys: BASE_PAYLOAD.hsys, zodiacal: BASE_PAYLOAD.zodiacal, doubingSu28: false }) },
  { label: 'relative-chart', pathname: '/modern/relative', modes: ['full'], payload: async () => ({ inner: { date: '2028/04/06', time: '09:33:00', zone: '+00:00', lat: '41n26', lon: '174w30', ad: 1 }, outer: { date: '2029/09/16', time: '18:45:00', zone: '+08:00', lat: '31n13', lon: '121e28', ad: 1 }, hsys: 1, zodiacal: 0, relative: 0 }) },
  { label: 'acg', pathname: '/location/acg', modes: ['quick', 'full'], payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'germany-midpoint', pathname: '/germany/midpoint', modes: ['full'], payload: async () => ({ ...BASE_PAYLOAD, predictive: 0 }) },
  { label: 'nongli-time', pathname: '/nongli/time', modes: ['full'], payload: async () => ({ date: '2028-04-06', time: '09:33:00', zone: '+08:00', lat: '31n13', lon: '121e28', gpsLat: 31.2167, gpsLon: 121.4667, gender: true, ad: 1, after23NewDay: 0, timeAlg: 0 }) },
  { label: 'jieqi-seed', pathname: '/jieqi/year', modes: ['quick', 'full'], payload: async () => ({ year: 2028, ad: 1, zone: '+08:00', lon: '121e28', lat: '31n13', gpsLat: 31.2167, gpsLon: 121.4667, timeAlg: 0, jieqis: ['大雪', '芒种'], seedOnly: true }) },
  { label: 'liureng-gods', pathname: '/liureng/gods', modes: ['full'], payload: async () => ({ date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', ad: 1, after23NewDay: false }) },
  { label: 'gua-desc', pathname: '/gua/desc', modes: ['full'], payload: async () => ({ name: ['111111', '000000', '101010'] }) },
  { label: 'bazi-direct', pathname: '/bazi/direct', modes: ['full'], payload: async () => ({ date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', gpsLat: 31.2167, gpsLon: 121.4667, gender: true, ad: 1, after23NewDay: false, timeAlg: 0, byLon: false, phaseType: 0 }) },
  { label: 'ziwei-birth', pathname: '/ziwei/birth', modes: ['full'], payload: async () => ({ date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', ad: 1, gender: true, after23NewDay: false, timeAlg: 0 }) },
  { label: 'calendar-month', pathname: '/calendar/month', modes: ['full'], payload: async () => ({ date: '2028-04-01', zone: '+08:00', lon: '121e28', ad: 1 }) },
  { label: 'liureng-runyear', pathname: '/liureng/runyear', modes: ['quick', 'full'], payload: async () => buildLiurengRunyearPayload() },
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

async function run(mode) {
  const selected = SCENARIOS.filter((scenario) => scenario.modes.includes(mode));
  if (selected.length === 0) {
    throw new Error(`unknown warmup mode: ${mode}`);
  }
  for (const scenario of selected) {
    await warmOne(
      scenario.label,
      scenario.pathname,
      await scenario.payload(),
      scenario.transport || 'encrypted',
    );
  }
}

async function main() {
  const mode = resolveMode();
  const start = performance.now();
  console.log(`warmup-mode: ${mode}`);
  await run(mode);
  console.log(`warmup-total: ${Number((performance.now() - start).toFixed(3))}ms`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
