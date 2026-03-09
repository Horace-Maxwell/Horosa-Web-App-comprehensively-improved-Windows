const forge = require('node-forge');
const RSA = require('js-rsa');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const SERVER = process.env.HOROSA_SERVER_ROOT || 'http://127.0.0.1:9999';

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

async function warmOne(label, pathname, payload) {
  const start = performance.now();
  await call(pathname, payload);
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

async function run() {
  await warmOne('chart', '/chart', {
    ...BASE_PAYLOAD,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
  });

  await warmOne('predict-pd', '/predict/pd', {
    ...BASE_PAYLOAD,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
  });

  await warmOne('predict-pdchart', '/predict/pdchart', {
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
  });

  for (const [label, path, payload] of [
    ['predict-profection', '/predict/profection', { ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }],
    ['predict-solararc', '/predict/solararc', { ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+00:00' }],
    ['predict-solarreturn', '/predict/solarreturn', { ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }],
    ['predict-lunarreturn', '/predict/lunarreturn', { ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }],
    ['predict-givenyear', '/predict/givenyear', { ...BASE_PAYLOAD, datetime: '2031-04-06 09:33:00', dirZone: '+08:00', dirLat: '31n13', dirLon: '121e28' }],
    ['predict-zr', '/predict/zr', { date: BASE_PAYLOAD.date, time: BASE_PAYLOAD.time, zone: BASE_PAYLOAD.zone, lon: BASE_PAYLOAD.lon, lat: BASE_PAYLOAD.lat, hsys: BASE_PAYLOAD.hsys, tradition: BASE_PAYLOAD.tradition, birth: `${BASE_PAYLOAD.date} ${BASE_PAYLOAD.time}`, zodiacal: BASE_PAYLOAD.zodiacal, stopLevelIdx: 3, startSign: null }],
    ['guolao-chart', '/chart', { date: '2028/04/06', time: '09:33:00', zone: '+08:00', lat: '31n13', lon: '121e28', gpsLat: 31.2167, gpsLon: 121.4667, hsys: 0, tradition: 1, zodiacal: 0, doubingSu28: 1, strongRecption: 0, simpleAsp: 0, virtualPointReceiveAsp: 0, predictive: 0, ad: 1, name: 'Guolao Warmup', pos: 'Shanghai' }],
    ['chart13', '/chart13', { ...BASE_PAYLOAD, predictive: 0 }],
    ['india-chart', '/india/chart', { ...BASE_PAYLOAD, zodiacal: 1, predictive: 1, pdtype: 0, pdMethod: 'astroapp_alchabitius', pdTimeKey: 'Ptolemy', pdaspects: [0, 60, 90, 120, 180] }],
    ['jieqi24', '/jieqi/year', { year: '2032', ad: BASE_PAYLOAD.ad, zone: BASE_PAYLOAD.zone, lon: BASE_PAYLOAD.lon, lat: BASE_PAYLOAD.lat, gpsLat: BASE_PAYLOAD.gpsLat, gpsLon: BASE_PAYLOAD.gpsLon, hsys: BASE_PAYLOAD.hsys, zodiacal: BASE_PAYLOAD.zodiacal, doubingSu28: false }],
    ['relative-chart', '/modern/relative', { inner: { date: '2028/04/06', time: '09:33:00', zone: '+00:00', lat: '41n26', lon: '174w30', ad: 1 }, outer: { date: '2029/09/16', time: '18:45:00', zone: '+08:00', lat: '31n13', lon: '121e28', ad: 1 }, hsys: 1, zodiacal: 0, relative: 0 }],
    ['acg', '/location/acg', { ...BASE_PAYLOAD, predictive: 0 }],
    ['germany-midpoint', '/germany/midpoint', { ...BASE_PAYLOAD, predictive: 0 }],
    ['nongli-time', '/nongli/time', { date: '2028-04-06', time: '09:33:00', zone: '+08:00', lat: '31n13', lon: '121e28', gpsLat: 31.2167, gpsLon: 121.4667, gender: true, ad: 1, after23NewDay: 0, timeAlg: 0 }],
    ['jieqi-seed', '/jieqi/year', { year: 2028, ad: 1, zone: '+08:00', lon: '121e28', lat: '31n13', gpsLat: 31.2167, gpsLon: 121.4667, timeAlg: 0, jieqis: ['大雪', '芒种'], seedOnly: true }],
    ['liureng-gods', '/liureng/gods', { date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', ad: 1, after23NewDay: false }],
    ['gua-desc', '/gua/desc', { name: ['111111', '000000', '101010'] }],
    ['bazi-direct', '/bazi/direct', { date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', gpsLat: 31.2167, gpsLon: 121.4667, gender: true, ad: 1, after23NewDay: false, timeAlg: 0, byLon: false, phaseType: 0 }],
    ['ziwei-birth', '/ziwei/birth', { date: '2028-04-06', time: '09:33:00', zone: '+08:00', lon: '121e28', lat: '31n13', ad: 1, gender: true, after23NewDay: false, timeAlg: 0 }],
    ['calendar-month', '/calendar/month', { date: '2028-04-01', zone: '+08:00', lon: '121e28', ad: 1 }],
  ]) {
    await warmOne(label, path, payload);
  }

  await warmOne('liureng-runyear', '/liureng/runyear', await buildLiurengRunyearPayload());

  await warmOne('jieqi-legacy', '/jieqi/year', {
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
  });
}

async function main() {
  const start = performance.now();
  await run();
  console.log(`warmup-total: ${Number((performance.now() - start).toFixed(3))}ms`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
