const { forge, RSA } = require('./loadCryptoDeps');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const SERVER = process.env.HOROSA_SERVER_ROOT || 'http://127.0.0.1:9999';
const THRESHOLD_MS = Number(process.env.HOROSA_PERF_THRESHOLD_MS || 1000);
const OUTPUT_PATH = process.env.HOROSA_PERF_JSON
  || path.resolve(__dirname, '../../../runtime/horosa_runtime_perf_check.json');

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
  name: 'Horosa Perf',
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
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`parse error for ${pathname}: ${text.slice(0, 400)}`);
  }
  if (json && json.ResultCode && json.ResultCode !== 0) {
    throw new Error(`api error ${pathname} code=${json.ResultCode} result=${json.Result}`);
  }
  return json && json.Result !== undefined ? json.Result : json;
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
  assert(Object.keys(value).length > 0, `${label} is empty`);
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function buildPdChartPayload() {
  return {
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
  };
}

function buildJieqi24Payload() {
  return {
    year: '2032',
    ad: BASE_PAYLOAD.ad,
    zone: BASE_PAYLOAD.zone,
    lon: BASE_PAYLOAD.lon,
    lat: BASE_PAYLOAD.lat,
    gpsLat: BASE_PAYLOAD.gpsLat,
    gpsLon: BASE_PAYLOAD.gpsLon,
    hsys: BASE_PAYLOAD.hsys,
    zodiacal: BASE_PAYLOAD.zodiacal,
    doubingSu28: false,
  };
}

const SCENARIOS = [
  {
    key: 'astro_chart',
    label: '星盘/3D盘/节气单盘共用 /chart',
    covers: ['星盘', '3D盘', '节气盘'],
    path: '/chart',
    payload: () => ({
      ...BASE_PAYLOAD,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
    validate: (result) => {
      ensureObject(result.params, '/chart params');
      ensureObject(result.chart, '/chart chart');
      ensureNonEmptyArray(result.predictives && result.predictives.firdaria, '/chart predictives.firdaria');
      assert(!(result.predictives && Array.isArray(result.predictives.primaryDirection)), '/chart should not eager-load primaryDirection');
    },
    summarize: (result) => ({
      birth: result.params.birth,
      firdariaRows: result.predictives.firdaria.length,
    }),
  },
  {
    key: 'primary_direction_rows',
    label: '推运盘 /predict/pd',
    covers: ['推运盘'],
    path: '/predict/pd',
    payload: () => ({
      ...BASE_PAYLOAD,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
    validate: (result) => {
      ensureNonEmptyArray(result.pd, '/predict/pd pd');
    },
    summarize: (result) => ({
      rows: result.pd.length,
      firstRow: result.pd[0],
    }),
  },
  {
    key: 'primary_direction_chart',
    label: '推运盘 /predict/pdchart',
    covers: ['推运盘'],
    path: '/predict/pdchart',
    payload: () => buildPdChartPayload(),
    validate: (result) => {
      ensureObject(result, '/predict/pdchart result');
      assert(!result.err, '/predict/pdchart returned err');
      assert(Number.isFinite(Number(result.arc)), '/predict/pdchart missing arc');
    },
    summarize: (result) => ({
      arc: Number(result.arc),
      keys: Object.keys(result).length,
    }),
  },
  {
    key: 'profection',
    label: '推运盘 /predict/profection',
    covers: ['推运盘'],
    path: '/predict/profection',
    payload: () => ({
      ...BASE_PAYLOAD,
      datetime: '2031-04-06 09:33:00',
      dirZone: '+00:00',
    }),
    validate: (result) => {
      ensureObject(result.chart, '/predict/profection chart');
      ensureArray(result.chart.aspects, '/predict/profection chart.aspects');
    },
    summarize: (result) => ({
      aspects: result.chart.aspects.length,
    }),
  },
  {
    key: 'solar_arc',
    label: '推运盘 /predict/solararc',
    covers: ['推运盘'],
    path: '/predict/solararc',
    payload: () => ({
      ...BASE_PAYLOAD,
      datetime: '2031-04-06 09:33:00',
      dirZone: '+00:00',
    }),
    validate: (result) => {
      ensureObject(result.chart, '/predict/solararc chart');
      ensureArray(result.chart.aspects, '/predict/solararc chart.aspects');
    },
    summarize: (result) => ({
      aspects: result.chart.aspects.length,
    }),
  },
  {
    key: 'solar_return',
    label: '推运盘 /predict/solarreturn',
    covers: ['推运盘'],
    path: '/predict/solarreturn',
    payload: () => ({
      ...BASE_PAYLOAD,
      datetime: '2031-04-06 09:33:00',
      dirZone: '+08:00',
      dirLat: '31n13',
      dirLon: '121e28',
    }),
    validate: (result) => {
      ensureObject(result.chart, '/predict/solarreturn chart');
      ensureArray(result.chart.aspects, '/predict/solarreturn chart.aspects');
    },
    summarize: (result) => ({
      aspects: result.chart.aspects.length,
    }),
  },
  {
    key: 'lunar_return',
    label: '推运盘 /predict/lunarreturn',
    covers: ['推运盘'],
    path: '/predict/lunarreturn',
    payload: () => ({
      ...BASE_PAYLOAD,
      datetime: '2031-04-06 09:33:00',
      dirZone: '+08:00',
      dirLat: '31n13',
      dirLon: '121e28',
    }),
    validate: (result) => {
      ensureObject(result.chart, '/predict/lunarreturn chart');
      ensureArray(result.chart.aspects, '/predict/lunarreturn chart.aspects');
    },
    summarize: (result) => ({
      aspects: result.chart.aspects.length,
      hasSecondary: !!result.secLuneReturn,
    }),
  },
  {
    key: 'given_year',
    label: '推运盘 /predict/givenyear',
    covers: ['推运盘'],
    path: '/predict/givenyear',
    payload: () => ({
      ...BASE_PAYLOAD,
      datetime: '2031-04-06 09:33:00',
      dirZone: '+08:00',
      dirLat: '31n13',
      dirLon: '121e28',
    }),
    validate: (result) => {
      ensureObject(result.chart, '/predict/givenyear chart');
      ensureArray(result.chart.aspects, '/predict/givenyear chart.aspects');
    },
    summarize: (result) => ({
      aspects: result.chart.aspects.length,
    }),
  },
  {
    key: 'zodiacal_release',
    label: '推运盘 /predict/zr',
    covers: ['推运盘'],
    path: '/predict/zr',
    payload: () => ({
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
    validate: (result) => {
      ensureArray(result.zr, '/predict/zr zr');
    },
    summarize: (result) => ({
      levels: result.zr.length,
    }),
  },
  {
    key: 'guolao_chart',
    label: '七政四余 /chart',
    covers: ['七政四余'],
    path: '/chart',
    payload: () => ({
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
      name: 'Guolao Perf',
      pos: 'Shanghai',
    }),
    validate: (result) => {
      ensureObject(result.params, '/chart guolao params');
      ensureObject(result.chart, '/chart guolao chart');
      ensureNonEmptyArray(result.chart.objects, '/chart guolao chart.objects');
    },
    summarize: (result) => ({
      objects: result.chart.objects.length,
      houses: result.chart.houses ? result.chart.houses.length : 0,
    }),
  },
  {
    key: 'chart13',
    label: '希腊星术 /chart13',
    covers: ['希腊星术'],
    path: '/chart13',
    payload: () => ({
      ...BASE_PAYLOAD,
      predictive: 0,
    }),
    validate: (result) => {
      ensureObject(result.params, '/chart13 params');
      ensureObject(result.chart, '/chart13 chart');
    },
    summarize: (result) => ({
      chartKeys: Object.keys(result.chart).length,
    }),
  },
  {
    key: 'india_chart',
    label: '印度律盘 /india/chart',
    covers: ['印度律盘'],
    path: '/india/chart',
    payload: () => ({
      ...BASE_PAYLOAD,
      zodiacal: 1,
      predictive: 1,
      pdtype: 0,
      pdMethod: 'astroapp_alchabitius',
      pdTimeKey: 'Ptolemy',
      pdaspects: [0, 60, 90, 120, 180],
    }),
    validate: (result) => {
      ensureObject(result.params, '/india/chart params');
      ensureObject(result.chart, '/india/chart chart');
    },
    summarize: (result) => ({
      chartKeys: Object.keys(result.chart).length,
    }),
  },
  {
    key: 'jieqi_year_24',
    label: '节气盘 /jieqi/year 二十四节气首屏',
    covers: ['节气盘'],
    path: '/jieqi/year',
    payload: () => buildJieqi24Payload(),
    validate: (result) => {
      ensureNonEmptyArray(result.jieqi24, '/jieqi/year 24 jieqi24');
      assert(result.jieqi24.length === 24, '/jieqi/year 24 should return 24 terms');
      assert(result.jieqi24.every((item) => item && item.jieqi && item.time), '/jieqi/year 24 has incomplete rows');
      assert(
        result.jieqi24.every((item) => item && item.bazi && item.bazi.fourColumns),
        '/jieqi/year 24 missing bazi four columns'
      );
    },
    summarize: (result) => ({
      jieqi24: result.jieqi24.length,
      firstTerm: result.jieqi24[0] && result.jieqi24[0].jieqi,
      lastTerm: result.jieqi24[result.jieqi24.length - 1] && result.jieqi24[result.jieqi24.length - 1].jieqi,
    }),
  },
  {
    key: 'jieqi_year',
    label: '节气盘 /jieqi/year legacy批量图',
    covers: ['节气盘'],
    path: '/jieqi/year',
    payload: () => ({
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
    validate: (result) => {
      ensureNonEmptyArray(result.jieqi24, '/jieqi/year jieqi24');
      ensureNonEmptyObject(result.charts, '/jieqi/year charts');
    },
    summarize: (result) => ({
      jieqi24: result.jieqi24.length,
      charts: Object.keys(result.charts).length,
    }),
    // 节气页图盘现已改为按标签懒加载单盘 /chart；legacy 批量接口仅保留为兼容性观察项。
    enforceThreshold: false,
  },
  {
    key: 'relative_chart',
    label: '关系盘 /modern/relative',
    covers: ['关系盘'],
    path: '/modern/relative',
    payload: () => ({
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
    }),
    validate: (result) => {
      ensureObject(result.inner, '/modern/relative inner');
      ensureObject(result.outer, '/modern/relative outer');
      ensureArray(result.inToOutAsp, '/modern/relative inToOutAsp');
      ensureArray(result.outToInAsp, '/modern/relative outToInAsp');
    },
    summarize: (result) => ({
      inToOutAsp: result.inToOutAsp.length,
      outToInAsp: result.outToInAsp.length,
    }),
  },
  {
    key: 'acg',
    label: '星体地图 /location/acg',
    covers: ['星体地图'],
    path: '/location/acg',
    payload: () => ({
      ...BASE_PAYLOAD,
      predictive: 0,
    }),
    validate: (result) => {
      ensureNonEmptyObject(result, '/location/acg result');
      const firstKey = Object.keys(result)[0];
      ensureObject(result[firstKey], '/location/acg first planet');
      ensureNonEmptyArray(result[firstKey].asc, '/location/acg asc');
      ensureNonEmptyArray(result[firstKey].mc, '/location/acg mc');
    },
    summarize: (result) => {
      const firstKey = Object.keys(result)[0];
      return {
        firstPlanet: firstKey,
        lines: result[firstKey].asc.length + result[firstKey].mc.length,
      };
    },
  },
  {
    key: 'germany_midpoint',
    label: '量化盘 /germany/midpoint',
    covers: ['量化盘'],
    path: '/germany/midpoint',
    payload: () => ({
      ...BASE_PAYLOAD,
      predictive: 0,
    }),
    validate: (result) => {
      ensureNonEmptyArray(result.midpoints, '/germany/midpoint midpoints');
      ensureNonEmptyObject(result.aspects, '/germany/midpoint aspects');
    },
    summarize: (result) => ({
      midpoints: result.midpoints.length,
      aspectGroups: Object.keys(result.aspects).length,
    }),
  },
  {
    key: 'nongli_time',
    label: '三式合一/易与三式 /nongli/time',
    covers: ['三式合一', '易与三式', '八字紫微'],
    path: '/nongli/time',
    payload: () => ({
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
    }),
    validate: (result) => {
      ensureNonEmptyObject(result, '/nongli/time result');
      assert(!!result.bazi, '/nongli/time missing bazi');
    },
    summarize: (result) => ({
      keys: Object.keys(result).length,
      hasBazi: !!result.bazi,
    }),
  },
  {
    key: 'jieqi_seed',
    label: '三式合一/易与三式 /jieqi/year seedOnly',
    covers: ['三式合一', '易与三式'],
    path: '/jieqi/year',
    payload: () => ({
      year: 2028,
      ad: 1,
      zone: '+08:00',
      lon: '121e28',
      lat: '31n13',
      gpsLat: 31.2167,
      gpsLon: 121.4667,
      timeAlg: 0,
      jieqis: ['大雪', '芒种'],
      seedOnly: true,
    }),
    validate: (result) => {
      ensureObject(result, '/jieqi/year seedOnly result');
      ensureNonEmptyArray(result.jieqi24, '/jieqi/year seedOnly jieqi24');
      const names = result.jieqi24.map((item) => item && item.jieqi).filter(Boolean);
      assert(names.includes('大雪'), '/jieqi/year seedOnly missing 大雪');
      assert(names.includes('芒种'), '/jieqi/year seedOnly missing 芒种');
    },
    summarize: (result) => ({
      jieqis: result.jieqi24.map((item) => item.jieqi),
    }),
  },
  {
    key: 'liureng_gods',
    label: '三式合一/易与三式 /liureng/gods',
    covers: ['三式合一', '易与三式'],
    path: '/liureng/gods',
    payload: () => ({
      date: '2028-04-06',
      time: '09:33:00',
      zone: '+08:00',
      lon: '121e28',
      lat: '31n13',
      ad: 1,
      after23NewDay: false,
    }),
    validate: (result) => {
      ensureObject(result.liureng, '/liureng/gods liureng');
    },
    summarize: (result) => ({
      keys: Object.keys(result.liureng).length,
    }),
  },
  {
    key: 'liureng_runyear',
    label: '易与三式 /liureng/runyear',
    covers: ['易与三式'],
    path: '/liureng/runyear',
    payload: async () => {
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
      assert(guaYearGanZi.length > 0, '/liureng/gods missing guaYearGanZi source');
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
    },
    validate: (result) => {
      ensureObject(result, '/liureng/runyear result');
      assert(result.year !== undefined, '/liureng/runyear missing year');
      assert(result.age !== undefined, '/liureng/runyear missing age');
    },
    summarize: (result) => ({
      year: result.year,
      age: Number(result.age),
    }),
  },
  {
    key: 'gua_desc',
    label: '易与三式 /gua/desc',
    covers: ['易与三式'],
    path: '/gua/desc',
    payload: () => ({
      name: ['111111', '000000', '101010'],
    }),
    validate: (result) => {
      ensureObject(result['111111'], '/gua/desc 111111');
      ensureObject(result['000000'], '/gua/desc 000000');
    },
    summarize: (result) => ({
      count: Object.keys(result).length,
    }),
  },
  {
    key: 'bazi_direct',
    label: '八字紫微 /bazi/direct',
    covers: ['八字紫微'],
    path: '/bazi/direct',
    payload: () => ({
      date: '2028-04-06',
      time: '09:33:00',
      zone: '+08:00',
      lon: '121e28',
      lat: '31n13',
      gpsLat: 31.2167,
      gpsLon: 121.4667,
      gender: true,
      ad: 1,
      after23NewDay: false,
      timeAlg: 0,
      byLon: false,
      phaseType: 0,
    }),
    validate: (result) => {
      ensureObject(result.bazi, '/bazi/direct bazi');
    },
    summarize: (result) => ({
      keys: Object.keys(result.bazi).length,
    }),
  },
  {
    key: 'ziwei_birth',
    label: '八字紫微 /ziwei/birth',
    covers: ['八字紫微'],
    path: '/ziwei/birth',
    payload: () => ({
      date: '2028-04-06',
      time: '09:33:00',
      zone: '+08:00',
      lon: '121e28',
      lat: '31n13',
      ad: 1,
      gender: true,
      after23NewDay: false,
      timeAlg: 0,
    }),
    validate: (result) => {
      ensureObject(result.chart, '/ziwei/birth chart');
    },
    summarize: (result) => ({
      chartKeys: Object.keys(result.chart).length,
    }),
  },
  {
    key: 'calendar_month',
    label: '万年历 /calendar/month',
    covers: ['万年历'],
    path: '/calendar/month',
    payload: () => ({
      date: '2028-04-01',
      zone: '+08:00',
      lon: '121e28',
      ad: 1,
    }),
    validate: (result) => {
      ensureArray(result.days, '/calendar/month days');
      ensureArray(result.prevDays, '/calendar/month prevDays');
    },
    summarize: (result) => ({
      days: result.days.length,
      prevDays: result.prevDays.length,
    }),
  },
];

async function measureScenario(scenario) {
  const payload = await Promise.resolve(scenario.payload());
  const start1 = performance.now();
  const first = await call(scenario.path, payload);
  const firstMs = roundMs(performance.now() - start1);
  scenario.validate(first);

  const start2 = performance.now();
  const second = await call(scenario.path, payload);
  const secondMs = roundMs(performance.now() - start2);
  scenario.validate(second);

  return {
    key: scenario.key,
    label: scenario.label,
    path: scenario.path,
    covers: scenario.covers,
    firstMs,
    secondMs,
    maxMs: roundMs(Math.max(firstMs, secondMs)),
    summary: scenario.summarize ? scenario.summarize(second) : undefined,
  };
}

async function run() {
  const scenarioResults = [];
  for (const scenario of SCENARIOS) {
    // Keep the max of two identical requests so the report reflects first-hit cost.
    const measured = await measureScenario(scenario);
    measured.enforceThreshold = scenario.enforceThreshold !== false;
    scenarioResults.push(measured);
  }

  const techniqueModuleMaxMs = {};
  const auxiliaryModuleMaxMs = {};
  scenarioResults.forEach((item) => {
    const moduleTarget = item.enforceThreshold ? techniqueModuleMaxMs : auxiliaryModuleMaxMs;
    item.covers.forEach((moduleName) => {
      const prev = moduleTarget[moduleName];
      moduleTarget[moduleName] = prev === undefined ? item.maxMs : Math.max(prev, item.maxMs);
    });
  });

  const techniqueScenarios = scenarioResults.filter((item) => item.enforceThreshold);
  const auxiliaryScenarios = scenarioResults.filter((item) => !item.enforceThreshold);

  const slowestScenario = techniqueScenarios.reduce((best, item) => {
    if (!best || item.maxMs > best.maxMs) {
      return item;
    }
    return best;
  }, null);

  const failingScenarios = techniqueScenarios
    .filter((item) => item.maxMs > THRESHOLD_MS)
    .map((item) => ({
      key: item.key,
      label: item.label,
      maxMs: item.maxMs,
    }));

  const failingModules = Object.entries(techniqueModuleMaxMs)
    .filter(([, maxMs]) => maxMs > THRESHOLD_MS)
    .map(([moduleName, maxMs]) => ({ module: moduleName, maxMs }));

  const report = {
    status: failingScenarios.length || failingModules.length ? 'error' : 'ok',
    thresholdMs: THRESHOLD_MS,
    server: SERVER,
    slowestScenario: slowestScenario ? {
      key: slowestScenario.key,
      label: slowestScenario.label,
      maxMs: slowestScenario.maxMs,
    } : null,
    modules: Object.keys(techniqueModuleMaxMs).sort().map((moduleName) => ({
      module: moduleName,
      maxMs: roundMs(techniqueModuleMaxMs[moduleName]),
    })),
    scenarios: techniqueScenarios,
    auxiliaryModules: Object.keys(auxiliaryModuleMaxMs).sort().map((moduleName) => ({
      module: moduleName,
      maxMs: roundMs(auxiliaryModuleMaxMs[moduleName]),
    })),
    auxiliaryScenarios,
    failingScenarios,
    failingModules,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'ok') {
    throw new Error(`runtime performance threshold exceeded: ${THRESHOLD_MS}ms`);
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
