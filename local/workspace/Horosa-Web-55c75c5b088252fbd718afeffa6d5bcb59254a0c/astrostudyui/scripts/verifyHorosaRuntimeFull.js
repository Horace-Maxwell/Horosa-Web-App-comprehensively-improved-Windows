const { forge, RSA } = require('./loadCryptoDeps');
const crypto = require('crypto');

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
  name: 'Horosa Smoke',
  pos: 'Wellington',
};

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
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
    const tmencoded = forge.util.encode64(tmcipher.output.bytes());
    res = `${res},${tmencoded}`;
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
  const plainraw = decipher.output.bytes();
  return forge.util.decodeUtf8(plainraw);
}

function sign(bodyPlain) {
  const data = `${Token}${SignatureKey}${ClientChannel}${ClientApp}${ClientVer}${bodyPlain}`;
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

async function call(path, bodyObj) {
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
  const resp = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers,
    body: encodedBody,
  });
  let text = await resp.text();
  if (resp.headers.get('Encrypted') === '1') {
    text = decryptRSA(text);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`parse error for ${path}: ${text.slice(0, 400)}`);
  }
  if (json && json.ResultCode && json.ResultCode !== 0) {
    throw new Error(`api error ${path} code=${json.ResultCode} result=${json.Result}`);
  }
  return json && json.Result !== undefined ? json.Result : json;
}

function objectKeys(obj) {
  return obj && typeof obj === 'object' ? Object.keys(obj) : [];
}

function ensureObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} is not an object`);
}

function ensureArray(value, label) {
  assert(Array.isArray(value), `${label} is not an array`);
}

function ensureNonEmptyArray(value, label) {
  ensureArray(value, label);
  assert(value.length > 0, `${label} is empty`);
}

function ensureNonEmptyObject(value, label) {
  ensureObject(value, label);
  assert(objectKeys(value).length > 0, `${label} is empty`);
}

async function run() {
  const summary = {};

  const chart = await call('/chart', {
    ...BASE_PAYLOAD,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
  });
  ensureObject(chart.params, '/chart params');
  ensureObject(chart.chart, '/chart chart');
  ensureNonEmptyArray(chart.predictives && chart.predictives.firdaria, '/chart predictives.firdaria');
  assert(!(chart.predictives && Array.isArray(chart.predictives.primaryDirection)), '/chart unexpectedly returned primaryDirection without includePrimaryDirection');
  const chartWithPd = await call('/chart', {
    ...BASE_PAYLOAD,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
    includePrimaryDirection: true,
  });
  ensureNonEmptyArray(chartWithPd.predictives && chartWithPd.predictives.primaryDirection, '/chart includePrimaryDirection predictives.primaryDirection');
  summary.chart = {
    birth: chart.params.birth,
    firdariaRows: chart.predictives.firdaria.length,
    primaryDirectionRows: chartWithPd.predictives.primaryDirection.length,
  };

  const chart13 = await call('/chart13', {
    ...BASE_PAYLOAD,
    predictive: 0,
  });
  ensureObject(chart13.params, '/chart13 params');
  ensureObject(chart13.chart, '/chart13 chart');
  summary.chart13 = {
    birth: chart13.params.birth,
    chartKeys: objectKeys(chart13.chart).length,
  };

  const india = await call('/india/chart', {
    ...BASE_PAYLOAD,
    zodiacal: 1,
    predictive: 1,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
  });
  ensureObject(india.params, '/india/chart params');
  ensureObject(india.chart, '/india/chart chart');
  summary.indiachart = {
    birth: india.params.birth,
    chartKeys: objectKeys(india.chart).length,
  };

  const acg = await call('/location/acg', {
    ...BASE_PAYLOAD,
    predictive: 0,
  });
  ensureNonEmptyObject(acg, '/location/acg result');
  const firstAcgKey = objectKeys(acg)[0];
  const firstAcgVal = acg[firstAcgKey];
  ensureObject(firstAcgVal, '/location/acg first planet');
  ensureNonEmptyArray(firstAcgVal.asc, '/location/acg asc');
  ensureNonEmptyArray(firstAcgVal.mc, '/location/acg mc');
  summary.locastro = {
    firstPlanet: firstAcgKey,
    lines: firstAcgVal.asc.length + firstAcgVal.mc.length,
  };

  const relative = await call('/modern/relative', {
    inner: {
      date: '2028/04/06',
      time: '09:33:00',
      zone: '+00:00',
      lat: '41n26',
      lon: '174w30',
      ad: 1,
    },
    outer: {
      date: '2029/09/16',
      time: '18:45:00',
      zone: '+08:00',
      lat: '31n13',
      lon: '121e28',
      ad: 1,
    },
    hsys: 1,
    zodiacal: 0,
    relative: 0,
  });
  ensureObject(relative.inner, '/modern/relative inner');
  ensureObject(relative.outer, '/modern/relative outer');
  ensureArray(relative.inToOutAsp, '/modern/relative inToOutAsp');
  ensureArray(relative.outToInAsp, '/modern/relative outToInAsp');
  summary.relative = {
    inToOutAsp: relative.inToOutAsp.length,
    outToInAsp: relative.outToInAsp.length,
  };

  const germany = await call('/germany/midpoint', {
    ...BASE_PAYLOAD,
    predictive: 0,
  });
  ensureNonEmptyArray(germany.midpoints, '/germany/midpoint midpoints');
  ensureNonEmptyObject(germany.aspects, '/germany/midpoint aspects');
  summary.germany = {
    midpoints: germany.midpoints.length,
    aspectGroups: objectKeys(germany.aspects).length,
  };

  const pd = await call('/predict/pd', {
    ...BASE_PAYLOAD,
    pdtype: 0,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
    pdaspects: [0, 60, 90, 120, 180],
  });
  ensureNonEmptyArray(pd.pd, '/predict/pd pd');
  summary.primarydirect = { rows: pd.pd.length };

  const profection = await call('/predict/profection', {
    ...BASE_PAYLOAD,
    datetime: '2031-04-06 09:33:00',
    dirZone: '+00:00',
  });
  ensureObject(profection.chart, '/predict/profection chart');
  ensureArray(profection.chart.aspects, '/predict/profection chart.aspects');
  summary.profection = { aspects: profection.chart.aspects.length };

  const solarArc = await call('/predict/solararc', {
    ...BASE_PAYLOAD,
    datetime: '2031-04-06 09:33:00',
    dirZone: '+00:00',
  });
  ensureObject(solarArc.chart, '/predict/solararc chart');
  ensureArray(solarArc.chart.aspects, '/predict/solararc chart.aspects');
  summary.solararc = { aspects: solarArc.chart.aspects.length };

  const solarReturn = await call('/predict/solarreturn', {
    ...BASE_PAYLOAD,
    datetime: '2031-04-06 09:33:00',
    dirZone: '+08:00',
    dirLat: '31n13',
    dirLon: '121e28',
  });
  ensureObject(solarReturn.chart, '/predict/solarreturn chart');
  ensureArray(solarReturn.chart.aspects, '/predict/solarreturn chart.aspects');
  summary.solarreturn = { aspects: solarReturn.chart.aspects.length };

  const lunarReturn = await call('/predict/lunarreturn', {
    ...BASE_PAYLOAD,
    datetime: '2031-04-06 09:33:00',
    dirZone: '+08:00',
    dirLat: '31n13',
    dirLon: '121e28',
  });
  ensureObject(lunarReturn.chart, '/predict/lunarreturn chart');
  ensureArray(lunarReturn.chart.aspects, '/predict/lunarreturn chart.aspects');
  summary.lunarreturn = {
    aspects: lunarReturn.chart.aspects.length,
    hasSecondary: !!lunarReturn.secLuneReturn,
  };

  const givenYear = await call('/predict/givenyear', {
    ...BASE_PAYLOAD,
    datetime: '2031-04-06 09:33:00',
    dirZone: '+08:00',
    dirLat: '31n13',
    dirLon: '121e28',
  });
  ensureObject(givenYear.chart, '/predict/givenyear chart');
  ensureArray(givenYear.chart.aspects, '/predict/givenyear chart.aspects');
  summary.givenyear = { aspects: givenYear.chart.aspects.length };

  const zrBirth = `${chart.params.birth || ''}`.trim().split(/\s+/);
  const zr = await call('/predict/zr', {
    date: chart.params.date || zrBirth[0] || BASE_PAYLOAD.date,
    time: chart.params.time || zrBirth[1] || BASE_PAYLOAD.time,
    zone: chart.params.zone || BASE_PAYLOAD.zone,
    lon: chart.params.lon || BASE_PAYLOAD.lon,
    lat: chart.params.lat || BASE_PAYLOAD.lat,
    hsys: chart.params.hsys !== undefined ? chart.params.hsys : BASE_PAYLOAD.hsys,
    tradition: chart.params.tradition !== undefined ? chart.params.tradition : BASE_PAYLOAD.tradition,
    birth: chart.params.birth || `${BASE_PAYLOAD.date} ${BASE_PAYLOAD.time}`,
    zodiacal: chart.params.zodiacal !== undefined ? chart.params.zodiacal : BASE_PAYLOAD.zodiacal,
    stopLevelIdx: 3,
    startSign: null,
  });
  ensureArray(zr.zr, '/predict/zr zr');
  summary.zodialrelease = { levels: zr.zr.length };

  const nongli = await call('/nongli/time', {
    date: '2028-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lat: '31n13',
    lon: '121e28',
    gpsLat: 31.2167,
    gpsLon: 121.4667,
    gender: true,
    ad: 1,
    after23NewDay: 0,
    timeAlg: 0,
  });
  ensureNonEmptyObject(nongli, '/nongli/time result');
  summary.nongli = {
    keys: objectKeys(nongli).length,
    hasBazi: !!nongli.bazi,
  };

  const jieqi = await call('/jieqi/year', {
    year: 2028,
    ad: 1,
    zone: '+08:00',
    lon: '121e28',
    lat: '31n13',
    gpsLat: 31.2167,
    gpsLon: 121.4667,
    hsys: 1,
    zodiacal: 0,
    doubingSu28: false,
    jieqis: ['春分', '夏至', '秋分', '冬至'],
  });
  ensureNonEmptyArray(jieqi.jieqi24, '/jieqi/year jieqi24');
  ensureNonEmptyObject(jieqi.charts, '/jieqi/year charts');
  summary.jieqi = {
    jieqi24: jieqi.jieqi24.length,
    charts: objectKeys(jieqi.charts).length,
  };

  const bazi = await call('/bazi/direct', {
    date: '2028-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lat: '31n13',
    lon: '121e28',
    ad: 1,
    gender: true,
    timeAlg: 0,
    after23NewDay: 0,
    adjustJieqi: false,
    byLon: false,
    phaseType: 0,
  });
  ensureObject(bazi.bazi, '/bazi/direct bazi');
  summary.bazi = { keys: objectKeys(bazi.bazi).length };

  const ziwei = await call('/ziwei/birth', {
    date: '2028-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lat: '31n13',
    lon: '121e28',
    ad: 1,
    gender: true,
    after23NewDay: false,
    timeAlg: 0,
  });
  ensureObject(ziwei.chart, '/ziwei/birth chart');
  const ziweiRules = await call('/ziwei/rules', {});
  ensureNonEmptyObject(ziweiRules, '/ziwei/rules');
  summary.ziwei = {
    chartKeys: objectKeys(ziwei.chart).length,
    rulesKeys: objectKeys(ziweiRules).length,
  };

  const liureng = await call('/liureng/gods', {
    date: '2028-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lat: '31n13',
    lon: '121e28',
    ad: 1,
    after23NewDay: false,
  });
  ensureObject(liureng.liureng, '/liureng/gods liureng');
  summary.liureng = { keys: objectKeys(liureng.liureng).length };

  const guaYearGanZi = `${(
    (liureng.liureng && liureng.liureng.nongli && (
      liureng.liureng.nongli.yearGanZi
      || liureng.liureng.nongli.yearJieqi
      || liureng.liureng.nongli.year
    ))
    || ''
  )}`.trim();
  assert(guaYearGanZi.length > 0, '/liureng/gods missing guaYearGanZi source');

  const runyear = await call('/liureng/runyear', {
    date: '2020-04-06',
    time: '09:33:00',
    zone: '+08:00',
    lat: '31n13',
    lon: '121e28',
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
  });
  assert(`${runyear.year || ''}`.length > 0, '/liureng/runyear year missing');
  assert(Number.isFinite(Number(runyear.age)), '/liureng/runyear age missing');
  summary.runyear = {
    year: runyear.year,
    age: Number(runyear.age),
  };

  const gua = await call('/gua/desc', {
    name: ['111111', '000000', '101010'],
  });
  ensureObject(gua['111111'], '/gua/desc 111111');
  ensureObject(gua['000000'], '/gua/desc 000000');
  summary.gua = { count: objectKeys(gua).length };

  const pithy = await call('/common/pithy', {});
  ensureNonEmptyObject(pithy.pithy, '/common/pithy pithy');
  summary.pithy = { keys: objectKeys(pithy.pithy).length };

  const gong12 = await call('/common/gong12', {
    干支: '甲',
  });
  ensureNonEmptyObject(gong12.gong12, '/common/gong12 gong12');
  summary.gong12 = { keys: objectKeys(gong12.gong12).length };

  const calendar = await call('/calendar/month', {
    date: '2028-04-01',
    zone: '+08:00',
    lon: '121e28',
    ad: 1,
  });
  ensureArray(calendar.days, '/calendar/month days');
  ensureArray(calendar.prevDays, '/calendar/month prevDays');
  summary.calendar = {
    days: calendar.days.length,
    prevDays: calendar.prevDays.length,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log('verify ok: major Horosa runtime modules responded with valid shapes');
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
