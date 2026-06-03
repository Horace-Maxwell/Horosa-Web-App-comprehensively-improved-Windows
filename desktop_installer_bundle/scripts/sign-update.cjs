#!/usr/bin/env node
// P0-1 (v2.5.4 hardening): release-time Ed25519 signing of the Windows installer.
//
// Produces `horosa-update.sig` (a small JSON) to upload as a release asset alongside the .exe. The
// desktop client (electron/main.js) fetches it on `update-downloaded` and verifies BEFORE quitAndInstall.
// See electron/update-signature.js for the scheme + rationale.
//
// USAGE:
//   node scripts/sign-update.cjs sign   <exe-path> <version> [--out <sig-path>] [--key <private-pem-path>]
//   node scripts/sign-update.cjs verify <exe-path> <version> <sig-path>      # local self-test
//   node scripts/sign-update.cjs keygen [<private-pem-path>]                  # one-time, prints public PEM
//
// PRIVATE KEY: read from --key, else $HOROSA_UPDATE_KEY, else ~/.horosa-release/update-ed25519-private.pem.
//   NEVER commit the private key. NEVER put it in CI. The public key is embedded in update-signature.js.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  canonicalUpdateMessage,
  sha512Base64OfBuffer,
  verifyUpdateSignature,
  UPDATE_PUBLIC_KEY_PEM,
} = require('../electron/update-signature');

const DEFAULT_KEY_PATH = path.join(os.homedir(), '.horosa-release', 'update-ed25519-private.pem');

function resolveKeyPath(explicit) {
  return explicit || process.env.HOROSA_UPDATE_KEY || DEFAULT_KEY_PATH;
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function doSign(exePath, version) {
  const keyPath = resolveKeyPath(arg('--key'));
  if (!fs.existsSync(keyPath)) {
    console.error(`[sign-update] private key not found: ${keyPath}\n  Set --key / $HOROSA_UPDATE_KEY or run: node scripts/sign-update.cjs keygen`);
    process.exit(2);
  }
  if (!fs.existsSync(exePath)) {
    console.error(`[sign-update] exe not found: ${exePath}`);
    process.exit(2);
  }
  const buf = fs.readFileSync(exePath);
  const sha512 = sha512Base64OfBuffer(buf);
  const message = Buffer.from(canonicalUpdateMessage(version, sha512), 'utf8');
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const sig = crypto.sign(null, message, privateKey).toString('base64');
  const payload = { v: 1, version: String(version), alg: 'ed25519', sha512, sig };
  const outPath = arg('--out') || path.join(path.dirname(exePath), 'horosa-update.sig');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');

  // Immediately self-verify with the EMBEDDED public key — guarantees the shipped client will accept it.
  const check = verifyUpdateSignature({ version, fileSha512Base64: sha512, signature: payload, publicKeyPem: UPDATE_PUBLIC_KEY_PEM });
  if (!check.ok) {
    console.error(`[sign-update] FATAL: produced signature fails embedded-pubkey self-verify: ${check.reason}`);
    console.error('  -> the private key does NOT match the public key in electron/update-signature.js. Aborting.');
    process.exit(3);
  }
  console.log(`[sign-update] OK signed ${path.basename(exePath)} (v${version})`);
  console.log(`  sha512(b64) = ${sha512}`);
  console.log(`  wrote       = ${outPath}`);
  console.log('  self-verify against embedded public key: PASS');
}

function doVerify(exePath, version, sigPath) {
  const buf = fs.readFileSync(exePath);
  const sha512 = sha512Base64OfBuffer(buf);
  const signature = JSON.parse(fs.readFileSync(sigPath, 'utf8'));
  const r = verifyUpdateSignature({ version, fileSha512Base64: sha512, signature, publicKeyPem: UPDATE_PUBLIC_KEY_PEM });
  if (r.ok) {
    console.log(`[sign-update] VERIFY OK — ${path.basename(exePath)} (v${version}) signature is valid for the embedded public key.`);
    process.exit(0);
  } else {
    console.error(`[sign-update] VERIFY FAIL — ${r.reason}`);
    process.exit(1);
  }
}

function doKeygen(keyPath) {
  const p = keyPath || DEFAULT_KEY_PATH;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) {
    console.error(`[sign-update] refusing to overwrite existing key: ${p}`);
    process.exit(2);
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(p, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`[sign-update] wrote private key (0600) to ${p}`);
  console.log('  --> paste this PUBLIC key into electron/update-signature.js UPDATE_PUBLIC_KEY_PEM:\n');
  process.stdout.write(publicKey.export({ type: 'spki', format: 'pem' }));
}

// Release convenience: read version from package.json, sign release/Horosa-Setup-<version>.exe.
// Wired into `npm run dist:win` (sign:update) so every build auto-produces horosa-update.sig.
function doSignRelease() {
  const pkg = require('../package.json');
  const version = pkg.version;
  const exe = path.join(__dirname, '..', 'release', `Horosa-Setup-${version}.exe`);
  if (!fs.existsSync(exe)) {
    console.error(`[sign-update] release exe not found: ${exe}\n  (run dist:win first; sign:update runs after the NSIS build)`);
    process.exit(2);
  }
  doSign(exe, version);
}

function main() {
  const cmd = process.argv[2];
  if (cmd === 'sign-release') {
    doSignRelease();
    return;
  }
  if (cmd === 'sign') {
    const exe = process.argv[3], version = process.argv[4];
    if (!exe || !version) { console.error('usage: sign <exe> <version> [--out <sig>] [--key <pem>]'); process.exit(2); }
    doSign(exe, version);
  } else if (cmd === 'verify') {
    const exe = process.argv[3], version = process.argv[4], sig = process.argv[5];
    if (!exe || !version || !sig) { console.error('usage: verify <exe> <version> <sig>'); process.exit(2); }
    doVerify(exe, version, sig);
  } else if (cmd === 'keygen') {
    doKeygen(process.argv[3]);
  } else {
    console.error('usage: sign-update.cjs <sign|verify|keygen> ...');
    process.exit(2);
  }
}

main();
