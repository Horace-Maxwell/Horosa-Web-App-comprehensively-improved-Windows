// Preload for the download-progress window (update-progress.html).
//
// The window previously ran with contextIsolation:false + nodeIntegration:true
// and required('electron') directly in the page — the only renderer in the app
// with a Node-capable context. It only ever needed three one-way channels, so
// this bridge exposes exactly those and nothing else, letting the window run
// with the same hardened webPreferences as the main window
// (contextIsolation:true, nodeIntegration:false).
//
// Channel names are load-bearing: 'update:init' / 'update:progress' /
// 'update:done' are what main.js sends AND what release_selfcheck.py sentinels
// pin in update-progress.html — do not rename.
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, handler) {
  const listener = (_event, payload) => {
    try {
      handler(payload);
    } catch (_error) {
      // a broken page callback must not take down the preload bridge
    }
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('horosaUpdateProgress', {
  onInit(handler) {
    return subscribe('update:init', handler);
  },
  onProgress(handler) {
    return subscribe('update:progress', handler);
  },
  onDone(handler) {
    return subscribe('update:done', handler);
  },
});
