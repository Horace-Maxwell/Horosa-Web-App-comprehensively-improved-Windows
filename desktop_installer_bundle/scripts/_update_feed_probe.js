// Manual auto-update FEED probe (diagnostic, not part of the build).
// Runs the SAME electron-updater (NsisUpdater) the app uses against the REAL
// GitHub releases feed, with a forced-low currentVersion so the latest published
// release MUST be reported as an available update. Proves: feed reachable, the
// public repo needs no token, latest.yml parses, version/sha512/size are read.
//
//   node_modules\.bin\electron scripts\_update_feed_probe.js          # check only
//   $env:PROBE_DOWNLOAD=1; node_modules\.bin\electron scripts\_update_feed_probe.js   # also download + verify integrity
//
// Exit codes: 0 ok | 2 unexpected not-available | 3 download failed | 4 updater error | 5 check threw
const { app } = require('electron');
const { NsisUpdater } = require('electron-updater');

const PUBLISH = {
  provider: 'github',
  owner: 'Horace-Maxwell',
  repo: 'Horosa-Web-App-comprehensively-improved-Windows',
};

app.whenReady().then(async () => {
  const updater = new NsisUpdater(PUBLISH);
  updater.autoDownload = false;
  updater.forceDevUpdateConfig = true; // allow checking when not packaged
  updater.currentVersion = '0.0.1';    // force "an update is available"
  updater.logger = console;

  updater.on('update-available', (info) => {
    const files = (info.files || []).map((f) => ({ url: f.url, size: f.size, sha512Head: f.sha512 ? `${f.sha512.slice(0, 24)}...` : null }));
    console.log('PROBE_RESULT update-available', JSON.stringify({ version: info.version, files }));
    if (process.env.PROBE_DOWNLOAD === '1') {
      updater.on('download-progress', (p) => console.log('PROBE progress', `${Math.round(p.percent)}%`));
      updater.on('update-downloaded', (i) => { console.log('PROBE_RESULT update-downloaded OK', i.version); app.exit(0); });
      updater.downloadUpdate().catch((e) => { console.error('PROBE_RESULT download FAIL', e.message); app.exit(3); });
    } else {
      app.exit(0);
    }
  });
  updater.on('update-not-available', (info) => { console.log('PROBE_RESULT update-not-available (unexpected at v0.0.1)', info && info.version); app.exit(2); });
  updater.on('error', (e) => { console.error('PROBE_RESULT updater-error', e && e.message ? e.message : String(e)); app.exit(4); });

  try {
    await updater.checkForUpdates();
  } catch (e) {
    console.error('PROBE_RESULT checkForUpdates-threw', e && e.message ? e.message : String(e));
    app.exit(5);
  }
});

setTimeout(() => { console.error('PROBE_RESULT timeout'); app.exit(6); }, 120000);
