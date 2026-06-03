// P0-1 (v2.5.4 hardening): Ed25519-signed update metadata verification.
//
// WHY: the Windows app is NOT Authenticode-signed (`verifyUpdateCodeSignature: false`), so the ONLY
// integrity electron-updater enforces is the sha512 inside `latest.yml` over GitHub HTTPS — and
// `latest.yml` itself is unsigned. An Electron updater downloads + installs an executable with the
// user's privileges, so a compromised GitHub release or a rogue-CA HTTPS MITM = a remote-code-execution
// channel. Mature secure-update designs (Sparkle EdDSA, TUF, Doyensec SafeUpdater) sign the update
// metadata with an OFFLINE private key and verify with a public key baked into the app BEFORE install.
//
// THIS MODULE: pure Node `crypto` (Ed25519, built-in since Node 12) — no external dep, no Electron import,
// so it is shared by `electron/main.js` (client-side verify) and `scripts/sign-update.cjs` (release-side sign).
//
// SCHEME (v1): the release publishes `horosa-update.sig` (a small JSON) alongside the installer:
//   { "v": 1, "version": "2.5.4", "alg": "ed25519", "sha512": "<base64 sha512 of the exe>", "sig": "<base64 Ed25519 sig>" }
// The signed message is the canonical string below. The client recomputes sha512 of the DOWNLOADED installer,
// checks it equals `sha512` in the sig file (binding the sig to the exact bytes electron-updater already
// validated against latest.yml), then verifies the Ed25519 signature with the embedded public key.
//
// KEY MANAGEMENT: private key lives ONLY on the release machine (e.g. ~/.horosa-release/update-ed25519-private.pem,
// 0600, never committed / never in CI). If it is ever lost or rotated, ship a new public key in a normal
// version bump (old clients keep verifying with the old key until they update). One key, backed up by the owner.

'use strict';

const crypto = require('crypto');

// Ed25519 PUBLIC key (SPKI PEM). Private counterpart kept offline on the release machine.
// Generated 2026-06-03. To rotate: regenerate, replace this constant, ship in a version bump.
const UPDATE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADmDzTlQ97Y1KRh9OeYLqMFT3I/Ui+pddMFW6P/YwDv4=
-----END PUBLIC KEY-----
`;

const SIGNATURE_SCHEME = 'Horosa-Update-v1';

// Canonical signed message: scheme + version + base64 sha512 of the installer, newline-joined.
// sha512 alone uniquely identifies the exact bytes; version binds the artifact to its release.
function canonicalUpdateMessage(version, sha512Base64) {
  return `${SIGNATURE_SCHEME}\n${String(version)}\n${String(sha512Base64)}`;
}

// Compute the base64 SHA-512 of a file's bytes (same digest electron-updater records in latest.yml).
function sha512Base64OfBuffer(buf) {
  return crypto.createHash('sha512').update(buf).digest('base64');
}

// Verify a parsed signature object against an installer's actual sha512 + version.
// Returns { ok: boolean, reason?: string }. NEVER throws.
function verifyUpdateSignature({ version, fileSha512Base64, signature, publicKeyPem }) {
  try {
    const sig = (typeof signature === 'string') ? JSON.parse(signature) : signature;
    if (!sig || typeof sig !== 'object') return { ok: false, reason: 'signature payload missing/not-object' };
    if (sig.v !== 1) return { ok: false, reason: `unsupported signature schema v=${sig.v}` };
    if (sig.alg !== 'ed25519') return { ok: false, reason: `unsupported alg=${sig.alg}` };
    if (String(sig.version) !== String(version)) {
      return { ok: false, reason: `version mismatch sig=${sig.version} update=${version}` };
    }
    if (!sig.sha512 || typeof sig.sha512 !== 'string') return { ok: false, reason: 'sig.sha512 missing' };
    // Bind the signature to the EXACT downloaded bytes (which electron-updater already matched to latest.yml).
    if (fileSha512Base64 && sig.sha512 !== fileSha512Base64) {
      return { ok: false, reason: 'sha512 mismatch — signed hash != downloaded file hash' };
    }
    if (!sig.sig || typeof sig.sig !== 'string') return { ok: false, reason: 'sig.sig missing' };

    const message = Buffer.from(canonicalUpdateMessage(sig.version, sig.sha512), 'utf8');
    const signatureBytes = Buffer.from(sig.sig, 'base64');
    const pubKey = crypto.createPublicKey(publicKeyPem || UPDATE_PUBLIC_KEY_PEM);
    // Ed25519: algorithm MUST be null in crypto.verify.
    const ok = crypto.verify(null, message, pubKey, signatureBytes);
    return ok ? { ok: true } : { ok: false, reason: 'Ed25519 signature verification failed' };
  } catch (e) {
    return { ok: false, reason: `verify exception: ${e && e.message ? e.message : String(e)}` };
  }
}

module.exports = {
  UPDATE_PUBLIC_KEY_PEM,
  SIGNATURE_SCHEME,
  canonicalUpdateMessage,
  sha512Base64OfBuffer,
  verifyUpdateSignature,
};
