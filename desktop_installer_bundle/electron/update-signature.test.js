// P0-1: unit tests for the Ed25519 update-signature verifier. Uses an EPHEMERAL keypair (via the
// publicKeyPem override) so the test doesn't need the real offline private key.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { verifyUpdateSignature, canonicalUpdateMessage } = require('./update-signature');

// Make a {payload, publicKeyPem} signed with a fresh ephemeral Ed25519 key.
function makeSigned({ version, sha512 }) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const message = Buffer.from(canonicalUpdateMessage(version, sha512), 'utf8');
  const sig = crypto.sign(null, message, privateKey).toString('base64');
  return {
    payload: { v: 1, version: String(version), alg: 'ed25519', sha512, sig },
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

const VER = '2.5.4';
const SHA = crypto.createHash('sha512').update('the-real-installer-bytes').digest('base64');

test('valid signature verifies', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  const r = verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: payload, publicKeyPem });
  assert.strictEqual(r.ok, true, r.reason);
});

test('valid signature also verifies from JSON string', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  const r = verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: JSON.stringify(payload), publicKeyPem });
  assert.strictEqual(r.ok, true, r.reason);
});

test('downloaded-file hash mismatch is rejected (tampered binary)', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  const otherSha = crypto.createHash('sha512').update('a-malicious-installer').digest('base64');
  const r = verifyUpdateSignature({ version: VER, fileSha512Base64: otherSha, signature: payload, publicKeyPem });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /sha512 mismatch/);
});

test('version mismatch is rejected', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  const r = verifyUpdateSignature({ version: '2.5.5', fileSha512Base64: SHA, signature: payload, publicKeyPem });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /version mismatch/);
});

test('signature forged with a different key is rejected', () => {
  const { payload } = makeSigned({ version: VER, sha512: SHA });
  const attacker = crypto.generateKeyPairSync('ed25519');
  const r = verifyUpdateSignature({
    version: VER, fileSha512Base64: SHA, signature: payload,
    publicKeyPem: attacker.publicKey.export({ type: 'spki', format: 'pem' }),
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /verification failed/);
});

test('flipped signature bytes are rejected', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  const bad = Buffer.from(payload.sig, 'base64');
  bad[0] ^= 0xff;
  const r = verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: { ...payload, sig: bad.toString('base64') }, publicKeyPem });
  assert.strictEqual(r.ok, false);
});

test('unsupported schema / alg is rejected', () => {
  const { payload, publicKeyPem } = makeSigned({ version: VER, sha512: SHA });
  assert.strictEqual(verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: { ...payload, v: 2 }, publicKeyPem }).ok, false);
  assert.strictEqual(verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: { ...payload, alg: 'rsa' }, publicKeyPem }).ok, false);
});

test('missing fields / garbage never throw, always fail closed', () => {
  for (const bad of [null, {}, 'not json', { v: 1, alg: 'ed25519' }, { v: 1, alg: 'ed25519', version: VER, sha512: SHA }]) {
    const r = verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: bad });
    assert.strictEqual(r.ok, false);
  }
});

test('default embedded public key does not validate a foreign-key signature', () => {
  // Sanity: a signature from a random key must NOT pass against the real embedded pubkey.
  const { payload } = makeSigned({ version: VER, sha512: SHA });
  const r = verifyUpdateSignature({ version: VER, fileSha512Base64: SHA, signature: payload }); // no override -> embedded key
  assert.strictEqual(r.ok, false);
});
