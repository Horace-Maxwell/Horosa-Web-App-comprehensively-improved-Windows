#!/usr/bin/env node
// P1-3 (v2.5.4 hardening): staged-rollout helper.
//
// electron-updater reads an OPTIONAL `stagingPercentage: <0-100>` field from the published latest.yml and
// self-buckets each client by a stable per-install id — only clients whose bucket is below the threshold
// take the update. This lets you ship to 10% -> 25% -> 50% -> 100% and watch for regressions before
// everyone gets it (the v2.5.0..v2.5.4 spree shipped 100% each time; the #14/#15/dial issues would have hit
// a subset first under a staged rollout).
//
// USAGE (RELEASE-TIME, NOT wired into dist:win):
//   node scripts/set-staging.cjs <percent>            # edit release/latest.yml in place (0-100)
//   node scripts/set-staging.cjs <percent> <yml-path> # explicit latest.yml
//   node scripts/set-staging.cjs none                 # remove the field (= 100% / full rollout)
//
// AFTER editing latest.yml you MUST re-upload it (+ regenerate SHA256SUMS, which includes latest.yml's hash):
//   node scripts/set-staging.cjs 25
//   (regenerate SHA256SUMS.txt for the 4 assets)
//   gh release upload v<ver> release/latest.yml release/SHA256SUMS.txt --clobber
// To ramp: re-run with a higher percent and re-upload. To pull a bad staged release: BUMP the version
// (electron-updater won't move a client off a version by lowering the percentage).
//
// NOTE: editing only `stagingPercentage` does NOT touch the exe path/sha512/size in latest.yml, so the
// `update feed (latest.yml) matches exe` selfcheck gate stays green.

'use strict';

const fs = require('fs');
const path = require('path');

function defaultYml() {
  return path.join(__dirname, '..', 'release', 'latest.yml');
}

function main() {
  const arg = process.argv[2];
  if (arg === undefined) {
    console.error('usage: set-staging.cjs <0-100|none> [latest.yml]');
    process.exit(2);
  }
  const ymlPath = process.argv[3] || defaultYml();
  if (!fs.existsSync(ymlPath)) {
    console.error(`[set-staging] latest.yml not found: ${ymlPath}`);
    process.exit(2);
  }
  let yml = fs.readFileSync(ymlPath, 'utf8');
  // Strip any existing stagingPercentage line(s).
  yml = yml.replace(/^stagingPercentage:.*\r?\n/gm, '');

  if (arg === 'none' || arg === 'remove') {
    fs.writeFileSync(ymlPath, yml);
    console.log(`[set-staging] removed stagingPercentage from ${ymlPath} (= full 100% rollout).`);
    return;
  }

  const pct = Number(arg);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    console.error(`[set-staging] percent must be 0-100 (or "none"); got: ${arg}`);
    process.exit(2);
  }
  // electron-updater wants the field at the top level. Append (YAML is order-insensitive here).
  if (!yml.endsWith('\n')) yml += '\n';
  yml += `stagingPercentage: ${pct}\n`;
  fs.writeFileSync(ymlPath, yml);
  console.log(`[set-staging] set stagingPercentage: ${pct} in ${ymlPath}`);
  console.log('  -> regenerate SHA256SUMS.txt, then: gh release upload v<ver> release/latest.yml release/SHA256SUMS.txt --clobber');
}

main();
