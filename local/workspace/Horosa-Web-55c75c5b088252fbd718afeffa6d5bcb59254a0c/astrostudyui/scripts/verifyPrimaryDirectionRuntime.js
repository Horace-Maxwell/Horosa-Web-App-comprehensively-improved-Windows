const forge = require('node-forge');
const RSA = require('js-rsa');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
  time: '09:33',
  zone: '+00:00',
  lat: '41n26',
  lon: '174w30',
  hsys: 1,
  tradition: false,
  predictive: true,
  zodiacal: 0,
  pdtype: 0,
  pdaspects: [0, 60, 90, 120, 180],
  virtualPointReceiveAsp: true,
};

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function verifyFrontendBinding() {
  const pdTablePath = path.resolve(__dirname, '../src/components/astro/AstroPrimaryDirection.js');
  const src = fs.readFileSync(pdTablePath, 'utf8');
  for (const needle of [
    "let pds = predictives.primaryDirection ? predictives.primaryDirection : [];",
    'Degree: pd[0],',
    'Promittor: pd[1],',
    'Significator: pd[2],',
    'Date: pd[4],',
  ]) {
    assert(src.includes(needle), `frontend PD table binding missing: ${needle}`);
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
  const bodyPlain = JSON.stringify(bodyObj);
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
    throw new Error(`parse error for ${path}: ${text.slice(0, 300)}`);
  }
  if (json && json.ResultCode && json.ResultCode !== 0) {
    throw new Error(`api error ${path} code=${json.ResultCode} result=${json.Result}`);
  }
  return json && json.Result !== undefined ? json.Result : json;
}

function normalizeRow(row) {
  return [
    Number(Number(row[0]).toFixed(12)),
    `${row[1] || ''}`,
    `${row[2] || ''}`,
    `${row[3] || ''}`,
    `${row[4] || ''}`,
  ];
}

function rowSignature(rows, limit = 40) {
  return rows.slice(0, limit).map(normalizeRow);
}

function verifyChartResult(result, method) {
  assert(result && result.params, `/chart missing params for ${method}`);
  assert(result.params.pdMethod === method, `/chart params.pdMethod mismatch for ${method}: ${result.params.pdMethod}`);
  assert(result.params.pdTimeKey === 'Ptolemy', `/chart params.pdTimeKey mismatch for ${method}: ${result.params.pdTimeKey}`);
  assert(result.predictives && Array.isArray(result.predictives.primaryDirection), `/chart missing predictives.primaryDirection for ${method}`);
  assert(result.predictives.primaryDirection.length > 0, `/chart empty primaryDirection for ${method}`);
}

function verifyPdResult(result, method) {
  assert(result && Array.isArray(result.pd), `/predict/pd missing pd list for ${method}`);
  assert(result.pd.length > 0, `/predict/pd empty pd list for ${method}`);
}

async function run() {
  verifyFrontendBinding();
  const chartAstro = await call('/chart', {
    ...BASE_PAYLOAD,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
  });
  const chartLegacy = await call('/chart', {
    ...BASE_PAYLOAD,
    pdMethod: 'horosa_legacy',
    pdTimeKey: 'Ptolemy',
  });
  verifyChartResult(chartAstro, 'astroapp_alchabitius');
  verifyChartResult(chartLegacy, 'horosa_legacy');

  const pdAstro = await call('/predict/pd', {
    ...BASE_PAYLOAD,
    pdMethod: 'astroapp_alchabitius',
    pdTimeKey: 'Ptolemy',
  });
  const pdLegacy = await call('/predict/pd', {
    ...BASE_PAYLOAD,
    pdMethod: 'horosa_legacy',
    pdTimeKey: 'Ptolemy',
  });
  verifyPdResult(pdAstro, 'astroapp_alchabitius');
  verifyPdResult(pdLegacy, 'horosa_legacy');

  const chartAstroRows = chartAstro.predictives.primaryDirection;
  const chartLegacyRows = chartLegacy.predictives.primaryDirection;
  const pdAstroRows = pdAstro.pd;
  const pdLegacyRows = pdLegacy.pd;

  assert(
    JSON.stringify(rowSignature(chartAstroRows)) === JSON.stringify(rowSignature(pdAstroRows)),
    'astroapp_alchabitius /chart and /predict/pd rows are not aligned',
  );
  assert(
    JSON.stringify(rowSignature(chartLegacyRows)) === JSON.stringify(rowSignature(pdLegacyRows)),
    'horosa_legacy /chart and /predict/pd rows are not aligned',
  );
  assert(
    JSON.stringify(rowSignature(chartAstroRows)) !== JSON.stringify(rowSignature(chartLegacyRows)),
    'astroapp_alchabitius and horosa_legacy rows are unexpectedly identical',
  );

  console.log(JSON.stringify({
    chart_astroapp_rows: chartAstroRows.length,
    chart_legacy_rows: chartLegacyRows.length,
    pd_astroapp_rows: pdAstroRows.length,
    pd_legacy_rows: pdLegacyRows.length,
    chart_astroapp_first: normalizeRow(chartAstroRows[0]),
    chart_legacy_first: normalizeRow(chartLegacyRows[0]),
  }, null, 2));
  console.log('verify ok: primary direction runtime wiring is active for /chart and /predict/pd');
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
