const { contextBridge, ipcRenderer } = require('electron');

const bootstrapConfig = ipcRenderer.sendSync('desktop:get-bootstrap-config-sync');
window.__HOROSA_DESKTOP_CONFIG__ = bootstrapConfig;

window.addEventListener('error', (event) => {
  ipcRenderer.send('desktop:renderer-error', {
    type: 'error',
    message: event && event.message ? event.message : 'Unknown renderer error',
    filename: event && event.filename ? event.filename : '',
    lineno: event && event.lineno ? event.lineno : 0,
    colno: event && event.colno ? event.colno : 0,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event && event.reason;
  ipcRenderer.send('desktop:renderer-error', {
    type: 'unhandledrejection',
    message: reason && reason.message ? reason.message : `${reason || 'Unhandled promise rejection'}`,
  });
});

function subscribe(channel, callback) {
  const listener = (_event, payload) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('horosaDesktop', {
  getBootstrapConfig() {
    return bootstrapConfig;
  },
  getAppInfo() {
    return ipcRenderer.invoke('desktop:get-app-info');
  },
  checkForUpdates() {
    return ipcRenderer.invoke('desktop:check-for-updates');
  },
  installDownloadedUpdate() {
    return ipcRenderer.invoke('desktop:install-downloaded-update');
  },
  exportDiagnostics(snapshotPayload) {
    return ipcRenderer.invoke('desktop:export-diagnostics', snapshotPayload);
  },
  openLogsDirectory() {
    return ipcRenderer.invoke('desktop:open-logs-directory');
  },
  retryRuntime() {
    return ipcRenderer.invoke('desktop:retry-runtime');
  },
  getZoomFactor() {
    return ipcRenderer.invoke('desktop:get-zoom-factor');
  },
  setZoomFactor(zoomFactor) {
    return ipcRenderer.invoke('desktop:set-zoom-factor', zoomFactor);
  },
  zoomIn() {
    return ipcRenderer.invoke('desktop:zoom-in');
  },
  zoomOut() {
    return ipcRenderer.invoke('desktop:zoom-out');
  },
  resetZoom() {
    return ipcRenderer.invoke('desktop:reset-zoom');
  },
  onUpdateState(callback) {
    return subscribe('desktop:update-state', callback);
  },
  onRuntimeState(callback) {
    return subscribe('desktop:runtime-state', callback);
  },
});
