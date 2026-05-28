'use strict';

// Generate resources/app-update.yml for the packaged app.
//
// WHY THIS EXISTS: the build uses electron-builder's `--dir` then
// `--win nsis --prepackaged` split (so we can patch the exe icon in between).
// electron-builder only writes `app-update.yml` during a normal target build's
// app-preparation step, which `--prepackaged` SKIPS -- so the installed app
// would ship WITHOUT app-update.yml. electron-updater reads that file to resolve
// the GitHub feed; without it, the canonical flow throws "app-update.yml not
// found" (the historical "updater noise" that got auto-update disabled).
//
// main.js ALSO passes the publish config explicitly to NsisUpdater(), so the
// feed works even without this file -- but shipping app-update.yml restores the
// standard electron-updater contract (and a stable updater cache dir name).
// Single source of truth: package.json build.publish.

const fs = require('fs');
const path = require('path');

const BUNDLE = path.resolve(__dirname, '..');
const pkg = require(path.join(BUNDLE, 'package.json'));

function firstGithubPublish(build) {
  const publish = build && build.publish;
  const entry = Array.isArray(publish) ? publish[0] : publish;
  if (!entry || entry.provider !== 'github' || !entry.owner || !entry.repo) {
    throw new Error('package.json build.publish[0] must be a github provider with owner+repo');
  }
  return entry;
}

function updaterCacheDirName() {
  // Stable per-app cache dir under %LOCALAPPDATA%; must not change across versions
  // or in-progress downloads can't resume. Derived from the package name.
  return `${pkg.name}-updater`;
}

function main() {
  const gh = firstGithubPublish(pkg.build);
  const resourcesDir = path.join(BUNDLE, 'release', 'win-unpacked', 'resources');
  if (!fs.existsSync(resourcesDir)) {
    throw new Error(`win-unpacked resources dir not found at ${resourcesDir} (run electron-builder --dir first)`);
  }
  const lines = [
    'provider: github',
    `owner: ${gh.owner}`,
    `repo: ${gh.repo}`,
    `updaterCacheDirName: ${updaterCacheDirName()}`,
    '',
  ];
  const target = path.join(resourcesDir, 'app-update.yml');
  fs.writeFileSync(target, lines.join('\n'), 'utf8');
  console.log(`[write:update-config] wrote ${target}`);
  console.log(lines.join('\n'));
}

main();
