const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const { NsisUpdater } = require('electron-updater');
const packageMetadata = require('../package.json');
const { createLogger } = require('./logger');
const { RuntimeManager } = require('./service-manager');
const {
  formatUpdateErrorMessage,
  shouldPromptForAvailableUpdate,
  shouldAnnounceNoUpdate,
  shouldAnnounceUpdateError,
} = require('./update-flow');
const crypto = require('crypto');
const https = require('https');
const { verifyUpdateSignature } = require('./update-signature');

const localAppDataRoot = process.env.LOCALAPPDATA || app.getPath('appData');
const horosaDataRoot = path.join(localAppDataRoot, 'HorosaDesktop');
const windowStateFile = path.join(horosaDataRoot, 'window-state.json');
const loadingPagePath = path.join(__dirname, 'loading.html');
const WINDOW_STATE_VERSION = 7;
const DEFAULT_ZOOM_FACTOR = 0.65;
const MIN_ZOOM_FACTOR = 0.6;
const MAX_ZOOM_FACTOR = 1.6;
const ZOOM_STEP = 0.1;
const DEFAULT_UPDATE_PUBLISH_CONFIG = Object.freeze({
  provider: 'github',
  owner: 'Horace-Maxwell',
  repo: 'Horosa-Web-App-comprehensively-improved-Windows',
});
// H-7 (v2.5.4): bounded auto-restart of the local backend on an UNEXPECTED runtime crash, before falling
// back to the manual "自检修复并重试" repair UI. Mature supervised services self-heal; restart goes through
// startRuntimeFlow({restart}) which re-acquires ports AND reloads the renderer with the new ports.
const MAX_RUNTIME_AUTO_RESTARTS = 2;
const RUNTIME_AUTO_RESTART_BACKOFF_MS = [1500, 4000];
const RUNTIME_AUTO_RESTART_STABILITY_MS = 45000;
let runtimeAutoRestartAttempts = 0;
let runtimeAutoRestartStabilityTimer = null;
const AUTO_UPDATE_ENABLED = true;
const AUTO_UPDATE_DISABLED_MESSAGE = '开发模式下不启用自动更新（仅打包安装后可用）。';
const UPDATE_RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

app.setPath('userData', horosaDataRoot);

let mainWindow = null;
let runtimeManager = null;
let logger = null;
let autoUpdater = null;
let runtimeBootPromise = null;
let updateCheckTimer = null;
let updateCheckContext = 'idle';
let currentWindowBoundsMode = 'default-maximized-80';
let currentPage = 'loading';
let windowStateSaveTimer = null;
let initialWindowNormalizationTimers = [];
let hasAppliedInitialWindowState = false;
let lastNormalWindowBounds = null;
let currentZoomFactor = DEFAULT_ZOOM_FACTOR;
let isQuitting = false;
let isShuttingDown = false;
let shutdownPromise = null;
let updateState = {
  status: app.isPackaged && AUTO_UPDATE_ENABLED ? 'idle' : 'unsupported',
  message: app.isPackaged && AUTO_UPDATE_ENABLED ? '等待检查更新' : AUTO_UPDATE_DISABLED_MESSAGE,
};
let isInstallingUpdate = false;
let isUpdateDialogOpen = false;
let dismissedUpdateVersion = null;
let lastCheckWasManual = false;
let downloadedUpdateInfo = null;
let updateRecheckTimer = null;
let downloadProgressWindow = null;

function createUpdaterLogger() {
  return {
    info(...args) {
      if (logger) {
        logger.info('[updater]', ...args);
      }
    },
    warn(...args) {
      if (logger) {
        logger.warn('[updater]', ...args);
      }
    },
    error(...args) {
      if (logger) {
        logger.error('[updater]', ...args);
      }
    },
    debug(...args) {
      if (logger) {
        logger.info('[updater]', ...args);
      }
    },
  };
}

function logLifecycle(message, payload) {
  if (logger) {
    logger.info(message, payload || {});
  }
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function isNavigationAbortError(error) {
  const message = error && error.message ? String(error.message) : String(error || '');
  return message.includes('ERR_ABORTED') || message.includes('Error code: -3') || message.includes('(-3)');
}

function getConfiguredPublishOptions() {
  const publishConfig = packageMetadata && packageMetadata.build ? packageMetadata.build.publish : null;
  const firstPublishConfig = Array.isArray(publishConfig) ? publishConfig[0] : publishConfig;
  if (!firstPublishConfig || firstPublishConfig.provider !== 'github') {
    return { ...DEFAULT_UPDATE_PUBLISH_CONFIG };
  }

  return {
    ...DEFAULT_UPDATE_PUBLISH_CONFIG,
    ...firstPublishConfig,
  };
}

function ensureAutoUpdater() {
  if (!app.isPackaged || !AUTO_UPDATE_ENABLED) {
    return null;
  }

  if (autoUpdater) {
    return autoUpdater;
  }

  const publishConfig = getConfiguredPublishOptions();
  autoUpdater = new NsisUpdater(publishConfig);
  autoUpdater.logger = createUpdaterLogger();
  if (logger) {
    logger.info('Configured NSIS updater', publishConfig);
  }
  return autoUpdater;
}

function applyUpdateErrorState(error, { manual = false } = {}) {
  const rawMessage = error && error.message ? error.message : String(error || '检查更新失败');
  if (logger) {
    logger.warn('Auto update failed', {
      manual,
      message: rawMessage,
    });
  }
  setUpdateState({
    status: manual ? 'error' : 'unavailable',
    message: formatUpdateErrorMessage(error, { manual }),
  });
}

async function runUpdateCheck({ manual = false } = {}) {
  if (!app.isPackaged || !AUTO_UPDATE_ENABLED) {
    setUpdateState({
      status: 'unsupported',
      message: AUTO_UPDATE_DISABLED_MESSAGE,
    });
    return updateState;
  }

  const updater = ensureAutoUpdater();
  if (!updater) {
    setUpdateState({
      status: manual ? 'error' : 'unavailable',
      message: manual ? '自动更新未启用。' : '更新暂不可用，已跳过后台检查。',
    });
    return updateState;
  }

  const context = manual ? 'manual' : 'background';
  updateCheckContext = context;
  lastCheckWasManual = manual;

  try {
    await updater.checkForUpdates();
  } catch (error) {
    if (updateCheckContext === context) {
      updateCheckContext = 'idle';
      applyUpdateErrorState(error, { manual });
    }
  }

  return updateState;
}

function getResourceRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app-runtime');
  }
  return path.join(__dirname, '..', 'build', 'app-runtime');
}

function getActiveResourceRoot() {
  if (runtimeManager && typeof runtimeManager.getResolvedResourceRoot === 'function') {
    return runtimeManager.getResolvedResourceRoot();
  }
  return getResourceRoot();
}

function getRendererIndexPath() {
  const resourceRoot = getActiveResourceRoot();
  const bundleRoot = path.join(resourceRoot, 'runtime', 'windows', 'bundle');
  const distFileIndex = path.join(bundleRoot, 'dist-file', 'index.html');
  const distIndex = path.join(bundleRoot, 'dist', 'index.html');

  if (fs.existsSync(distFileIndex)) {
    return distFileIndex;
  }
  if (fs.existsSync(distIndex)) {
    return distIndex;
  }

  throw new Error(`Renderer entry not found under ${bundleRoot}`);
}

function getRendererIndexUrl() {
  const indexPath = getRendererIndexPath();
  const rendererUrl = pathToFileURL(indexPath);
  const runtimeState = runtimeManager ? runtimeManager.getState() : {};
  const serverRoot = runtimeState.serverRoot || 'http://127.0.0.1:9999';
  const chartRoot = runtimeState.chartPort
    ? `http://127.0.0.1:${runtimeState.chartPort}`
    : 'http://127.0.0.1:8899';
  rendererUrl.searchParams.set('srv', serverRoot);
  rendererUrl.searchParams.set('chartSrv', chartRoot);
  rendererUrl.searchParams.set('kentangSrv', chartRoot);
  rendererUrl.searchParams.set('v', String(Date.now()));
  rendererUrl.hash = '/';
  return {
    indexPath,
    url: rendererUrl.toString(),
  };
}

function getBootstrapConfig() {
  const runtimeState = runtimeManager ? runtimeManager.getState() : {};
  return {
    desktop: true,
    windowBoundsMode: currentWindowBoundsMode,
    zoomFactor: currentZoomFactor,
    runtimeStatus: runtimeState,
    serverRoot: runtimeState.serverRoot || 'http://127.0.0.1:9999',
    chartRoot: runtimeState.chartPort ? `http://127.0.0.1:${runtimeState.chartPort}` : 'http://127.0.0.1:8899',
    kentangRoot: runtimeState.chartPort ? `http://127.0.0.1:${runtimeState.chartPort}` : 'http://127.0.0.1:8899',
    backendPort: runtimeState.backendPort || 9999,
    chartPort: runtimeState.chartPort || 8899,
    userDataPath: app.getPath('userData'),
  };
}

function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function publishCurrentStates() {
  broadcast('desktop:runtime-state', runtimeManager ? runtimeManager.getState() : {});
  broadcast('desktop:update-state', updateState);
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (logger) {
    logger.info('Update state', updateState);
  }
  broadcast('desktop:update-state', updateState);
}

function migrateLegacyData() {
  fs.mkdirSync(horosaDataRoot, { recursive: true });
  const oldLocalAppData = path.join(localAppDataRoot, 'Horosa');
  const markerFile = path.join(horosaDataRoot, '.migration-complete.json');

  if (fs.existsSync(markerFile)) {
    return;
  }

  const filesInTarget = fs.readdirSync(horosaDataRoot).filter((entry) => entry !== '.migration-complete.json');
  if (filesInTarget.length === 0 && fs.existsSync(oldLocalAppData)) {
    fs.cpSync(oldLocalAppData, horosaDataRoot, { recursive: true, force: true });
  }

  fs.writeFileSync(
    markerFile,
    JSON.stringify(
      {
        migratedAt: new Date().toISOString(),
        source: fs.existsSync(oldLocalAppData) ? oldLocalAppData : null,
      },
      null,
      2
    ),
    'utf8'
  );
}

function readWindowState() {
  try {
    if (!fs.existsSync(windowStateFile)) {
      return null;
    }
    const raw = fs.readFileSync(windowStateFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (logger) {
      logger.warn('Failed to read window state', error.message);
    }
    return null;
  }
}

function normalizeBounds(bounds) {
  if (!bounds) {
    return null;
  }

  const width = Math.round(Number(bounds.width));
  const height = Math.round(Number(bounds.height));
  const x = Math.round(Number(bounds.x));
  const y = Math.round(Number(bounds.y));

  if (![width, height, x, y].every(Number.isFinite)) {
    return null;
  }

  return { x, y, width, height };
}

function boundsApproximatelyEqual(left, right, tolerance = 2) {
  const lhs = normalizeBounds(left);
  const rhs = normalizeBounds(right);
  if (!lhs || !rhs) {
    return false;
  }

  return Math.abs(lhs.x - rhs.x) <= tolerance
    && Math.abs(lhs.y - rhs.y) <= tolerance
    && Math.abs(lhs.width - rhs.width) <= tolerance
    && Math.abs(lhs.height - rhs.height) <= tolerance;
}

function normalizeZoomFactor(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ZOOM_FACTOR;
  }

  return Math.round(Math.min(Math.max(numericValue, MIN_ZOOM_FACTOR), MAX_ZOOM_FACTOR) * 100) / 100;
}

function getDefaultZoomFactor() {
  return DEFAULT_ZOOM_FACTOR;
}

function getPreferredDisplay() {
  try {
    const cursorPoint = screen.getCursorScreenPoint();
    return screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay();
  } catch (_error) {
    return screen.getPrimaryDisplay();
  }
}

function buildDefaultBounds(display) {
  const workArea = display.workArea || display.workAreaSize || { x: 0, y: 0, width: 1440, height: 900 };
  const width = Math.max(960, Math.floor(workArea.width * 0.8));
  const height = Math.max(640, Math.floor(workArea.height * 0.8));
  const x = workArea.x + Math.floor((workArea.width - width) / 2);
  const y = workArea.y + Math.floor((workArea.height - height) / 2);

  return {
    x,
    y,
    width,
    height,
  };
}

function clampBoundsToDisplay(bounds, display) {
  const workArea = display.workArea || { x: 0, y: 0, width: display.size.width, height: display.size.height };
  const width = Math.min(Math.max(bounds.width, 900), workArea.width);
  const height = Math.min(Math.max(bounds.height, 620), workArea.height);
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const x = Math.min(Math.max(bounds.x, workArea.x), maxX);
  const y = Math.min(Math.max(bounds.y, workArea.y), maxY);

  return {
    x,
    y,
    width,
    height,
  };
}

function isBoundsVisible(bounds, display) {
  if (!bounds || !display) {
    return false;
  }

  const workArea = display.workArea || { x: 0, y: 0, width: display.size.width, height: display.size.height };
  const left = Math.max(bounds.x, workArea.x);
  const top = Math.max(bounds.y, workArea.y);
  const right = Math.min(bounds.x + bounds.width, workArea.x + workArea.width);
  const bottom = Math.min(bounds.y + bounds.height, workArea.y + workArea.height);

  return right - left >= 160 && bottom - top >= 120;
}

function resolveInitialWindowState() {
  const preferredDisplay = getPreferredDisplay();
  const defaultBounds = buildDefaultBounds(preferredDisplay);

  // v2.6.6 zoom persistence: saveWindowState() has always written zoomFactor to
  // window-state.json (on every zoom change via applyZoomFactor -> queueWindowStateSave,
  // and on quit), but nothing ever read it back -- so the user's zoom reset to the
  // default on every launch. Mirror of the macOS shell's preferences.json zoom restore.
  // Window-bounds policy is intentionally unchanged (always open default-maximized-80);
  // normalizeZoomFactor clamps/defaults any corrupt persisted value, so this is fail-safe.
  const persistedState = readWindowState();
  const zoomFactor =
    persistedState && persistedState.zoomFactor !== undefined && persistedState.zoomFactor !== null
      ? normalizeZoomFactor(persistedState.zoomFactor)
      : getDefaultZoomFactor();

  return {
    bounds: defaultBounds,
    mode: 'default-maximized-80',
    maximizeAfterShow: true,
    zoomFactor,
  };
}

function writeWindowState(snapshot) {
  try {
    fs.mkdirSync(path.dirname(windowStateFile), { recursive: true });
    fs.writeFileSync(windowStateFile, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (error) {
    if (logger) {
      logger.warn('Failed to persist window state', error.message);
    }
  }
}

function clearInitialWindowNormalizationTimers() {
  if (initialWindowNormalizationTimers.length === 0) {
    return;
  }
  for (const timer of initialWindowNormalizationTimers) {
    clearTimeout(timer);
  }
  initialWindowNormalizationTimers = [];
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || !hasAppliedInitialWindowState) {
    return;
  }

  const isMaximized = mainWindow.isMaximized();
  const isFullScreen = mainWindow.isFullScreen();
  const bounds = normalizeBounds(
    isMaximized || isFullScreen
      ? lastNormalWindowBounds
      : mainWindow.getBounds()
  );
  if (!bounds) {
    return;
  }

  const display = screen.getDisplayMatching(bounds) || getPreferredDisplay();
  writeWindowState({
    version: WINDOW_STATE_VERSION,
    bounds,
    isMaximized: false,
    zoomFactor: currentZoomFactor,
    displayId: display ? display.id : null,
    displayScaleFactor: display ? display.scaleFactor : null,
    workArea: display ? display.workArea : null,
    updatedAt: new Date().toISOString(),
  });
}

function queueWindowStateSave() {
  if (!mainWindow || mainWindow.isDestroyed() || !hasAppliedInitialWindowState) {
    return;
  }
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
  }
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    saveWindowState();
  }, 250);
}

function syncLastNormalWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) {
    return;
  }

  const windowBounds = normalizeBounds(mainWindow.getBounds());
  if (windowBounds) {
    lastNormalWindowBounds = windowBounds;
  }
}

function applyNormalWindowBounds(bounds, reason = 'unknown') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    mainWindow.setBounds(bounds);
    lastNormalWindowBounds = normalizeBounds(bounds);
    if (logger) {
      logger.info('Applied normal startup window bounds', {
        reason,
        bounds,
      });
    }
  } catch (error) {
    if (logger) {
      logger.warn('Failed to apply normal startup window bounds', {
        reason,
        message: error && error.message ? error.message : String(error),
      });
    }
  }
}

function applyStartupMaximizedWindowState(bounds, reason = 'unknown') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const normalizedBounds = normalizeBounds(bounds);
    if (mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      if (normalizedBounds) {
        lastNormalWindowBounds = normalizedBounds;
      }
      if (boundsApproximatelyEqual(lastNormalWindowBounds, normalizedBounds)) {
        if (logger) {
          logger.info('Skipped redundant maximized startup window normalization', {
            reason,
            bounds: normalizedBounds,
          });
        }
        return;
      }
    }
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    mainWindow.setBounds(bounds);
    lastNormalWindowBounds = normalizeBounds(bounds);
    mainWindow.maximize();
    if (logger) {
      logger.info('Applied maximized startup window state', {
        reason,
        bounds,
      });
    }
  } catch (error) {
    if (logger) {
      logger.warn('Failed to apply maximized startup window state', {
        reason,
        message: error && error.message ? error.message : String(error),
      });
    }
  }
}

function scheduleInitialWindowNormalization(bounds) {
  clearInitialWindowNormalizationTimers();
  const delays = [0, 60, 180, 360, 720];
  initialWindowNormalizationTimers = delays.map((delay) => setTimeout(() => {
    applyStartupMaximizedWindowState(bounds, `startup-${delay}ms`);
    if (delay === delays[delays.length - 1]) {
      clearInitialWindowNormalizationTimers();
      queueWindowStateSave();
    }
  }, delay));
}

function applyZoomFactor(nextZoomFactor, options = {}) {
  const { persist = true } = options;
  currentZoomFactor = normalizeZoomFactor(nextZoomFactor);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(currentZoomFactor);
    publishCurrentStates();
  }

  if (persist) {
    queueWindowStateSave();
  }

  return currentZoomFactor;
}

function changeZoomFactor(delta) {
  return applyZoomFactor(currentZoomFactor + delta);
}

function resetZoomFactor() {
  return applyZoomFactor(getDefaultZoomFactor());
}

async function showLoadingScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  currentPage = 'loading';
  try {
    await mainWindow.loadFile(loadingPagePath);
  } catch (error) {
    if (!isNavigationAbortError(error)) {
      throw error;
    }
    if (logger) {
      logger.warn('Loading screen navigation was aborted during page switch; keeping current window alive', {
        message: error.message,
      });
    }
  }
  publishCurrentStates();
}

async function loadRendererApp() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const rendererEntry = getRendererIndexUrl();
  if (logger) {
    logger.info('Loading renderer app', {
      indexPath: rendererEntry.indexPath,
      url: rendererEntry.url,
    });
  }
  currentPage = 'renderer';
  await withTimeout(
    mainWindow.loadURL(rendererEntry.url),
    45000,
    `Timed out loading renderer app from ${rendererEntry.indexPath}`
  );
  if (logger) {
    logger.info('Renderer app load completed', {
      url: mainWindow.webContents.getURL(),
    });
  }
  publishCurrentStates();
}

async function ensureMainWindowContent() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const runtimeState = runtimeManager ? runtimeManager.getState() : {};
  if (runtimeState.status === 'ready') {
    if (currentPage !== 'renderer') {
      await loadRendererApp();
    }
    return;
  }

  if (currentPage !== 'loading') {
    await showLoadingScreen();
  }

  if (!runtimeBootPromise && runtimeManager) {
    startRuntimeFlow().catch((error) => {
      if (logger) {
        logger.error('Failed to restart runtime while restoring main window', error);
      }
    });
  }
}

async function restoreOrCreateMainWindow(reason) {
  logLifecycle('Main window activation requested', {
    reason,
    hasMainWindow: Boolean(mainWindow),
    isQuitting,
    isShuttingDown,
    currentPage,
  });

  if (isShuttingDown) {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow();
    await ensureMainWindowContent();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (!mainWindow.isFocused()) {
    mainWindow.focus();
  }
}

async function requestAppQuit(reason) {
  logLifecycle('Application shutdown requested', {
    reason,
    hasMainWindow: Boolean(mainWindow && !mainWindow.isDestroyed()),
    runtimePage: currentPage,
    runtimeStatus: runtimeManager ? runtimeManager.getState().status : 'uninitialized',
  });

  if (shutdownPromise) {
    return shutdownPromise;
  }

  isQuitting = true;
  isShuttingDown = true;

  shutdownPromise = (async () => {
    if (windowStateSaveTimer) {
      clearTimeout(windowStateSaveTimer);
      windowStateSaveTimer = null;
    }
    if (updateCheckTimer) {
      clearTimeout(updateCheckTimer);
      updateCheckTimer = null;
    }
    if (updateRecheckTimer) {
      clearInterval(updateRecheckTimer);
      updateRecheckTimer = null;
    }
    if (runtimeAutoRestartStabilityTimer) {
      clearTimeout(runtimeAutoRestartStabilityTimer);
      runtimeAutoRestartStabilityTimer = null;
    }
    saveWindowState();

    if (runtimeManager) {
      try {
        await withTimeout(
          runtimeManager.stop(reason === 'before-quit' ? 'quit' : reason),
          12000,
          'Timed out waiting for local runtime shutdown'
        );
      } catch (error) {
        if (logger) {
          logger.error('Runtime shutdown failed or timed out', {
            reason,
            message: error && error.message ? error.message : String(error),
          });
        }
      }
    }
  })()
    .finally(() => {
      logLifecycle('Finalizing application exit', { reason });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.removeAllListeners('close');
        mainWindow.destroy();
      }
      setImmediate(() => {
        app.exit(0);
      });
    });

  return shutdownPromise;
}

function createMainWindow() {
  const initialState = resolveInitialWindowState();
  currentWindowBoundsMode = initialState.mode;
  hasAppliedInitialWindowState = false;
  clearInitialWindowNormalizationTimers();
  lastNormalWindowBounds = normalizeBounds(initialState.bounds);
  currentZoomFactor = normalizeZoomFactor(initialState.zoomFactor);

  mainWindow = new BrowserWindow({
    ...initialState.bounds,
    minWidth: 900,
    minHeight: 620,
    show: false,
    center: false,
    autoHideMenuBar: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'assets', 'horosa_setup.ico'),
    useContentSize: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    title: '星阙',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (logger) {
      logger.info('Renderer console', {
        level,
        message,
        line,
        sourceId,
      });
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (logger) {
      logger.error('Renderer failed to load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const commandOrControl = input.control || input.meta;
    if (!commandOrControl || input.type !== 'keyDown') {
      return;
    }

    const key = String(input.key || '').toLowerCase();
    if (key === '=' || key === '+' || key === 'add') {
      event.preventDefault();
      changeZoomFactor(ZOOM_STEP);
      return;
    }
    if (key === '-' || key === '_' || key === 'subtract') {
      event.preventDefault();
      changeZoomFactor(-ZOOM_STEP);
      return;
    }
    if (key === '0' || key === ')' || key === 'num0') {
      event.preventDefault();
      resetZoomFactor();
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (logger) {
      logger.error('Renderer process gone', details);
    }
    dialog
      .showMessageBox(mainWindow, {
        type: 'error',
        title: '星阙发生错误',
        message: '界面进程异常退出，是否重新加载应用？',
        detail: JSON.stringify(details),
        buttons: ['重新加载', '退出'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0 && mainWindow && !mainWindow.isDestroyed()) {
          showLoadingScreen().catch(() => {});
          startRuntimeFlow({ restart: runtimeManager && runtimeManager.getState().status !== 'ready' }).catch(() => {});
        } else {
          requestAppQuit('render-process-gone').catch(() => {});
        }
      })
      .catch(() => {});
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(currentZoomFactor);
    if (logger) {
      logger.info('Renderer finished load', {
        url: mainWindow.webContents.getURL(),
      });
    }
    publishCurrentStates();
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    applyStartupMaximizedWindowState(initialState.bounds, 'ready-to-show');
    mainWindow.show();
    mainWindow.focus();
    lastNormalWindowBounds = normalizeBounds(initialState.bounds);
    hasAppliedInitialWindowState = true;
    scheduleInitialWindowNormalization(initialState.bounds);
    queueWindowStateSave();
  });

  mainWindow.on('move', () => {
    syncLastNormalWindowBounds();
    queueWindowStateSave();
  });
  mainWindow.on('resize', () => {
    syncLastNormalWindowBounds();
    queueWindowStateSave();
  });
  mainWindow.on('maximize', queueWindowStateSave);
  mainWindow.on('unmaximize', () => {
    syncLastNormalWindowBounds();
    queueWindowStateSave();
  });
  mainWindow.on('close', (event) => {
    logLifecycle('Main window close event', {
      isQuitting,
      isShuttingDown,
    });
    saveWindowState();
    if (!isQuitting) {
      event.preventDefault();
      requestAppQuit('window-close').catch(() => {});
    }
  });
  mainWindow.on('closed', () => {
    logLifecycle('Main window closed', {
      wasShuttingDown: isShuttingDown,
    });
    clearInitialWindowNormalizationTimers();
    mainWindow = null;
  });

  return showLoadingScreen();
}

const HOROSA_REPO_URL = 'https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows';
const HOROSA_ISSUES_URL = `${HOROSA_REPO_URL}/issues`;

// Shared by the Help menu and the renderer IPC, so diagnostics can be exported
// from either place (the renderer passes its snapshot; the menu passes null).
async function exportDiagnosticsReport(snapshotPayload) {
  const runtimeState = runtimeManager ? runtimeManager.getState() : {};
  const defaultPath = path.join(
    app.getPath('documents'),
    `Horosa-Diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  const saveResult = await dialog.showSaveDialog(
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    {
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    }
  );
  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, canceled: true, message: '已取消导出诊断报告' };
  }
  const payload = {
    appInfo: {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      userDataPath: app.getPath('userData'),
      packagedResourceRoot: getResourceRoot(),
      activeResourceRoot: getActiveResourceRoot(),
    },
    runtimeState,
    updateState,
    rendererSnapshot: snapshotPayload || {},
    exportedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(saveResult.filePath), { recursive: true });
    fs.writeFileSync(saveResult.filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (logger) {
      logger.warn('Diagnostics export failed', { filePath: saveResult.filePath, message });
    }
    return { ok: false, message: `导出诊断报告失败：${message}` };
  }
  return {
    ok: true,
    message: `诊断报告已导出到 ${saveResult.filePath}`,
    filePath: saveResult.filePath,
  };
}

function showAboutDialog() {
  showUpdateModal({
    type: 'info',
    title: '关于星阙',
    message: `星阙 Horosa 桌面版 v${app.getVersion()}`,
    detail: '十项全能玄学术数工作站：紫微斗数 · 八字 · 占星 · 六壬 · 遁甲 · 太乙 · 六爻 · 统摄法 · 风水 · 主流推运技法 · 内置 AI 分析。\n\n于旧星阙 Horosa 基础上改良制作。',
    buttons: ['访问项目主页', '确定'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  }).then((result) => {
    if (result && result.response === 0) {
      shell.openExternal(HOROSA_REPO_URL).catch(() => {});
    }
  }).catch(() => {});
}

function createAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '重试本地服务',
          click: () => {
            startRuntimeFlow({ restart: true }).catch(() => {});
          },
        },
        {
          label: '自检修复并重启服务',
          click: () => {
            startRuntimeFlow({ repair: true }).catch(() => {});
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => {
            requestAppQuit('menu-exit').catch(() => {});
          },
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大界面',
          accelerator: 'CommandOrControl+=',
          click: () => {
            changeZoomFactor(ZOOM_STEP);
          },
        },
        {
          label: '缩小界面',
          accelerator: 'CommandOrControl+-',
          click: () => {
            changeZoomFactor(-ZOOM_STEP);
          },
        },
        {
          label: '恢复默认缩放',
          accelerator: 'CommandOrControl+0',
          click: () => {
            resetZoomFactor();
          },
        },
        { type: 'separator' },
        {
          label: '最大化 / 还原窗口',
          accelerator: 'F11',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) {
              return;
            }
            if (mainWindow.isMaximized()) {
              mainWindow.unmaximize();
            } else {
              mainWindow.maximize();
            }
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新…',
          click: () => {
            runUpdateCheck({ manual: true }).catch(() => {});
          },
        },
        { type: 'separator' },
        {
          label: '打开日志目录',
          click: () => {
            shell.openPath(path.join(app.getPath('userData'), 'logs')).catch(() => {});
          },
        },
        {
          label: '导出诊断报告…',
          click: () => {
            exportDiagnosticsReport(null).catch(() => {});
          },
        },
        { type: 'separator' },
        {
          label: '反馈问题 / 提交 Issue',
          click: () => {
            shell.openExternal(HOROSA_ISSUES_URL).catch(() => {});
          },
        },
        {
          label: '访问项目主页',
          click: () => {
            shell.openExternal(HOROSA_REPO_URL).catch(() => {});
          },
        },
        { type: 'separator' },
        {
          label: '关于星阙',
          click: () => {
            showAboutDialog();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function logUpdaterWarn(message, error) {
  if (logger) {
    logger.warn(message, { message: error && error.message ? error.message : String(error || '') });
  }
}

function showUpdateModal(options) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return dialog.showMessageBox(mainWindow, options);
  }
  return dialog.showMessageBox(options);
}

function showUpdateInfoDialog(title, message, type = 'info') {
  showUpdateModal({
    type,
    title,
    message,
    buttons: ['确定'],
    defaultId: 0,
    noLink: true,
  }).catch(() => {});
}

// Best-effort taskbar progress; never throws on platforms/states that don't support it.
function setUpdateProgressBar(fraction) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  try {
    mainWindow.setProgressBar(fraction < 0 ? -1 : Math.min(Math.max(fraction, 0), 1));
  } catch (_error) {
    // ignore — progress bar is a non-critical convenience
  }
}

// Dedicated download-progress window. Non-modal so the user can keep using the
// app while it downloads ~800MB; closable (closing does NOT cancel the download
// — the taskbar progress + the "立即重启" dialog still notify them on completion).
function showDownloadProgressWindow(info) {
  if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
    downloadProgressWindow.focus();
    return;
  }
  downloadProgressWindow = new BrowserWindow({
    width: 440,
    height: 220,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    title: '正在下载更新 - 星阙',
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', 'assets', 'horosa_setup.ico'),
    skipTaskbar: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      spellcheck: false,
    },
  });
  downloadProgressWindow.removeMenu();
  downloadProgressWindow.loadFile(path.join(__dirname, 'update-progress.html')).catch((error) => {
    logUpdaterWarn('Failed to load update-progress.html', error);
  });
  downloadProgressWindow.once('ready-to-show', () => {
    if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
      downloadProgressWindow.show();
      downloadProgressWindow.webContents.send('update:init', { version: info && info.version });
    }
  });
  downloadProgressWindow.on('closed', () => {
    downloadProgressWindow = null;
  });
}

function sendDownloadProgress(progress) {
  if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
    try {
      downloadProgressWindow.webContents.send('update:progress', progress);
    } catch (_error) {
      // ignore — IPC to a closing window is best-effort
    }
  }
}

function closeDownloadProgressWindow() {
  if (downloadProgressWindow && !downloadProgressWindow.isDestroyed()) {
    try {
      downloadProgressWindow.webContents.send('update:done');
    } catch (_error) {
      // ignore
    }
    downloadProgressWindow.destroy();
  }
  downloadProgressWindow = null;
}

function configureAutoUpdater() {
  if (!app.isPackaged || !AUTO_UPDATE_ENABLED) {
    setUpdateState({
      status: 'unsupported',
      message: AUTO_UPDATE_DISABLED_MESSAGE,
    });
    return;
  }

  const updater = ensureAutoUpdater();
  if (!updater) {
    return;
  }

  // Prompt before downloading the ~800MB installer. P0-1: ALL installs flow through our verified
  // installUpdateNow() path, and autoInstallOnAppQuit is OFF — so a downloaded-but-UNVERIFIED update can
  // never be silently applied on quit (fail-closed; the app is not Authenticode-signed so the Ed25519
  // metadata signature is the only thing gating an auto-installed RCE — see verifyDownloadedUpdate).
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.disableWebInstaller = true;
  // P1-4: keep blockmap-based DIFFERENTIAL downloads ON (electron-updater default) — between versions the
  // Chromium runtime + most python wheels are unchanged, so clients fetch only the changed blocks of the
  // ~750MB installer. Set explicitly to document intent + prevent accidental disabling.
  updater.disableDifferentialDownload = false;
  // P1-3: channel stays 'latest' (all current builds are "Beta" on the latest channel); allowPrerelease can
  // be flipped to opt a user into a future `beta.yml` channel. Staged rollout is applied at RELEASE time by
  // injecting `stagingPercentage` into latest.yml (scripts/set-staging.cjs) — electron-updater reads it from
  // the feed and self-buckets by user id. allowDowngrade off so a pulled staged release can't roll users back.
  updater.allowDowngrade = false;

  updater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: '正在检查更新',
    });
  });

  updater.on('update-available', (info) => {
    updateCheckContext = 'idle';
    const version = info && info.version ? String(info.version) : '';
    setUpdateState({
      status: 'available',
      message: `发现新版本 ${version}`,
      info,
    });
    if (shouldPromptForAvailableUpdate({
      manual: lastCheckWasManual,
      version,
      dismissedVersion: dismissedUpdateVersion,
    })) {
      promptForDownload(info).catch((error) => logUpdaterWarn('Update download prompt failed', error));
    }
  });

  updater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      message: '正在下载更新',
      progress,
    });
    setUpdateProgressBar(progress && Number.isFinite(progress.percent) ? progress.percent / 100 : 0);
    sendDownloadProgress(progress);
  });

  updater.on('update-not-available', (info) => {
    updateCheckContext = 'idle';
    setUpdateState({
      status: 'not-available',
      message: '当前已是最新版本',
      info,
    });
    if (shouldAnnounceNoUpdate({ manual: lastCheckWasManual })) {
      showUpdateInfoDialog('检查更新', `当前已是最新版本（${app.getVersion()}）。`);
    }
  });

  updater.on('update-downloaded', (info) => {
    updateCheckContext = 'idle';
    setUpdateProgressBar(-1);
    closeDownloadProgressWindow();
    const version = info && info.version ? String(info.version) : '';
    // P0-1 fail-closed: verify the release's Ed25519 signature of the downloaded installer BEFORE marking
    // it installable. status becomes 'downloaded' (the precondition installUpdateNow requires, and with
    // autoInstallOnAppQuit off the ONLY install path) ONLY on a verified signature; a bad/unverifiable
    // update is dropped (downloadedUpdateInfo=null) and never installed.
    setUpdateState({ status: 'verifying-update', message: `正在校验更新 ${version}…`, info });
    verifyDownloadedUpdate(info).then((result) => {
      if (!result.ok) {
        downloadedUpdateInfo = null;
        logUpdaterWarn('Update signature verification FAILED — refusing to install', new Error(result.reason));
        setUpdateState({ status: 'error', message: `更新校验未通过，已暂停安装（${version}）。`, info });
        if (shouldAnnounceUpdateError({ manual: lastCheckWasManual })) {
          showUpdateInfoDialog(
            '更新校验失败',
            `下载的更新包未通过安全校验，为保护你的设备已暂停本次安装。\n原因：${result.reason}\n请到 GitHub Releases 手动下载最新完整安装包。`,
            'warning'
          );
        }
        return;
      }
      downloadedUpdateInfo = info;
      if (logger) { logger.info('[updater] Update signature verified — safe to install', { version }); }
      setUpdateState({ status: 'downloaded', message: `更新 ${version} 已下载完成，重启即可安装`, info });
      promptForInstall(info).catch((error) => logUpdaterWarn('Update install prompt failed', error));
    }).catch((error) => {
      downloadedUpdateInfo = null;
      logUpdaterWarn('Update signature verification threw — refusing to install', error);
      setUpdateState({ status: 'error', message: `更新校验异常，已暂停安装（${version}）。`, info });
    });
  });

  updater.on('error', (error) => {
    const manual = lastCheckWasManual;
    updateCheckContext = 'idle';
    setUpdateProgressBar(-1);
    closeDownloadProgressWindow();
    applyUpdateErrorState(error, { manual });
    if (shouldAnnounceUpdateError({ manual })) {
      showUpdateInfoDialog('检查更新失败', formatUpdateErrorMessage(error, { manual }), 'warning');
    }
  });

  startUpdateRecheckTimer();
}

async function promptForDownload(info) {
  if (isUpdateDialogOpen || isInstallingUpdate) {
    return;
  }
  // A download already in flight / finished must not spawn a second "download?" prompt
  // (e.g. a manual "检查更新" during an active download).
  if (updateState.status === 'downloading' || updateState.status === 'downloaded' || updateState.status === 'installing') {
    return;
  }
  const updater = ensureAutoUpdater();
  if (!updater) {
    return;
  }
  const version = info && info.version ? String(info.version) : '';

  isUpdateDialogOpen = true;
  let response = 1;
  try {
    const result = await showUpdateModal({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${version}`,
      detail: `当前版本 ${app.getVersion()}。是否现在下载并安装更新？\n下载完成后会提示您重启应用。`,
      buttons: ['下载并安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    response = result.response;
  } catch (error) {
    logUpdaterWarn('Update download prompt dialog failed', error);
    return;
  } finally {
    isUpdateDialogOpen = false;
  }

  if (response !== 0) {
    dismissedUpdateVersion = version || dismissedUpdateVersion;
    setUpdateState({
      status: 'available',
      message: `已发现新版本 ${version}（已暂缓下载）`,
      info,
    });
    return;
  }

  dismissedUpdateVersion = null;
  setUpdateState({ status: 'downloading', message: '正在下载更新', info });
  setUpdateProgressBar(0);
  showDownloadProgressWindow(info);
  try {
    await updater.downloadUpdate();
  } catch (error) {
    closeDownloadProgressWindow();
    setUpdateProgressBar(-1);
    applyUpdateErrorState(error, { manual: true });
    showUpdateInfoDialog('下载更新失败', formatUpdateErrorMessage(error, { manual: true }), 'warning');
  }
}

async function promptForInstall(info) {
  if (isUpdateDialogOpen || isInstallingUpdate) {
    return;
  }
  const version = info && info.version ? String(info.version) : '';

  isUpdateDialogOpen = true;
  let response = 1;
  try {
    const result = await showUpdateModal({
      type: 'info',
      title: '更新已就绪',
      message: `新版本 ${version} 已下载完成`,
      detail: '需要重启应用以完成安装。立即重启吗？\n（选择“稍后”将在下次退出应用时自动安装。）',
      buttons: ['立即重启并安装', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    response = result.response;
  } catch (error) {
    logUpdaterWarn('Update install prompt dialog failed', error);
    return;
  } finally {
    isUpdateDialogOpen = false;
  }

  if (response === 0) {
    await installUpdateNow();
  } else {
    setUpdateState({
      status: 'downloaded',
      message: `更新 ${version} 已就绪，下次退出时自动安装`,
      info,
    });
  }
}

// Quit and hand off to the NSIS updater. CRITICAL ordering for THIS app:
// the embedded Python/Java sidecars hold open handles on resources/app-runtime/**,
// so they MUST be fully stopped before the installer overwrites the install dir,
// otherwise the update fails on locked files (the classic instability here).
// ---- P0-1: Ed25519 update-signature verification (fail-closed) ----

// Stream the base64 SHA-512 of a (large, ~750MB) file without loading it into memory.
function sha512Base64OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('base64')));
  });
}

// GET text following GitHub's redirects (releases/download -> objects.githubusercontent.com). Capped 64KB / 15s.
function httpsGetText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Horosa-Updater' } }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) { reject(new Error('too many redirects')); return; }
        resolve(httpsGetText(res.headers.location, redirectsLeft - 1));
        return;
      }
      if (status !== 200) { res.resume(); reject(new Error(`HTTP ${status}`)); return; }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        data += c;
        if (data.length > 64 * 1024) { req.destroy(); reject(new Error('signature asset too large')); }
      });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('signature fetch timeout')));
  });
}

// Fetch the horosa-update.sig asset for <version> from the configured GitHub release.
async function fetchUpdateSignatureAsset(version) {
  const cfg = getConfiguredPublishOptions();
  const url = `https://github.com/${cfg.owner}/${cfg.repo}/releases/download/v${version}/horosa-update.sig`;
  return httpsGetText(url);
}

// Verify the DOWNLOADED installer against the release's Ed25519 signature. Fail-closed: ANY failure
// (missing sig, hash mismatch, fetch error, bad signature, missing downloadedFile) returns ok=false.
async function verifyDownloadedUpdate(info) {
  try {
    const file = info && info.downloadedFile;
    const version = info && info.version ? String(info.version) : '';
    if (!version) return { ok: false, reason: 'update version missing' };
    if (!file || !fs.existsSync(file)) {
      return { ok: false, reason: 'downloadedFile path not available from electron-updater' };
    }
    const fileSha512Base64 = await sha512Base64OfFile(file);
    let signatureText;
    try {
      signatureText = await fetchUpdateSignatureAsset(version);
    } catch (e) {
      return { ok: false, reason: `signature fetch failed: ${e && e.message ? e.message : e}` };
    }
    return verifyUpdateSignature({ version, fileSha512Base64, signature: signatureText });
  } catch (e) {
    return { ok: false, reason: `verify exception: ${e && e.message ? e.message : String(e)}` };
  }
}

async function installUpdateNow() {
  if (isInstallingUpdate) {
    return;
  }
  const updater = ensureAutoUpdater();
  if (!updater || updateState.status !== 'downloaded') {
    return;
  }

  isInstallingUpdate = true;
  // We are committed to quitting; make the window/quit handlers treat this as a
  // planned shutdown so they don't fight quitAndInstall's app.quit().
  isQuitting = true;
  isShuttingDown = true;
  setUpdateState({ status: 'installing', message: '正在准备安装更新' });

  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
  }
  saveWindowState();
  setUpdateProgressBar(-1);

  if (runtimeManager) {
    try {
      await withTimeout(
        runtimeManager.stop('update-install'),
        13000,
        'Timed out stopping local runtime before update install'
      );
    } catch (error) {
      logUpdaterWarn('Runtime stop before update install failed/timed out', error);
    }
  }

  // Brief settle so the OS releases the file handles freed by taskkill /F before
  // NSIS starts overwriting app-runtime.
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.destroy();
  }

  if (logger) {
    logger.info('Quitting to install downloaded update', {
      version: downloadedUpdateInfo && downloadedUpdateInfo.version,
    });
  }

  // isSilent=true → run the NSIS installer silently (no wizard); isForceRunAfter=true → relaunch after install.
  try {
    updater.quitAndInstall(true, true);
  } catch (error) {
    logUpdaterWarn('quitAndInstall failed', error);
    // P0-1: autoInstallOnAppQuit is OFF, so this fallback quit will NOT apply the update — the verified
    // download stays cached and re-prompts (after re-verification) on next launch; user can retry from the menu.
    requestAppQuit('update-install-fallback').catch(() => {});
  }
}

function startUpdateRecheckTimer() {
  if (!app.isPackaged || !AUTO_UPDATE_ENABLED || updateRecheckTimer) {
    return;
  }
  updateRecheckTimer = setInterval(() => {
    if (isInstallingUpdate || isShuttingDown) {
      return;
    }
    runUpdateCheck({ manual: false }).catch(() => {});
  }, UPDATE_RECHECK_INTERVAL_MS);
  if (updateRecheckTimer.unref) {
    updateRecheckTimer.unref();
  }
}

function queueUpdateCheck() {
  if (!app.isPackaged || !AUTO_UPDATE_ENABLED || updateCheckTimer) {
    return;
  }

  updateCheckTimer = setTimeout(() => {
    updateCheckTimer = null;
    runUpdateCheck({ manual: false }).catch(() => {});
  }, 15000);
}

function normalizeExtensionSet(extensions) {
  return new Set(
    (Array.isArray(extensions) ? extensions : [])
      .map((item) => `${item || ''}`.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item : `.${item}`))
  );
}

// One unreadable file must not abort a whole directory import: OneDrive
// offline placeholders, AV-quarantined files and permission-denied entries all
// throw on read, and a user-picked folder routinely contains a few of those.
// Oversized files are skipped too -- the whole batch is base64'd into renderer
// memory, so a stray video/archive would OOM the app.
const MAX_COLLECTED_FILE_BYTES = 64 * 1024 * 1024;

function readCollectableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_COLLECTED_FILE_BYTES) {
      if (logger && stat.isFile()) {
        logger.warn('Skipped oversized file during collection', { filePath, size: stat.size });
      }
      return null;
    }
    return fs.readFileSync(filePath);
  } catch (error) {
    if (logger) {
      logger.warn('Skipped unreadable file during collection', {
        filePath,
        message: error && error.message ? error.message : String(error),
      });
    }
    return null;
  }
}

function collectFilesRecursive(directoryPath, extensionSet, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (logger) {
      logger.warn('Skipped unreadable directory during collection', {
        directoryPath,
        message: error && error.message ? error.message : String(error),
      });
    }
    return results;
  }
  entries.forEach((entry) => {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, extensionSet, results);
      return;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (extensionSet.size && !extensionSet.has(extension)) {
      return;
    }
    const buffer = readCollectableFile(fullPath);
    if (!buffer) {
      return;
    }
    results.push({
      fileName: entry.name,
      name: entry.name,
      path: fullPath,
      extension,
      byteSize: buffer.length,
      mime:
        extension === '.pdf'
          ? 'application/pdf'
          : extension === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : extension === '.doc'
              ? 'application/msword'
              : extension === '.md'
                || extension === '.markdown'
                ? 'text/markdown'
                : 'text/plain',
      base64: buffer.toString('base64'),
    });
  });
  return results;
}

function collectSelectedFiles(filePaths, extensionSet) {
  const results = [];
  (Array.isArray(filePaths) ? filePaths : []).forEach((filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }
    const resolvedPath = path.resolve(filePath);
    const extension = path.extname(resolvedPath).toLowerCase();
    if (extensionSet.size && !extensionSet.has(extension)) {
      return;
    }
    const buffer = readCollectableFile(resolvedPath);
    if (!buffer) {
      return;
    }
    results.push({
      fileName: path.basename(resolvedPath),
      name: path.basename(resolvedPath),
      path: resolvedPath,
      extension,
      byteSize: buffer.length,
      mime:
        extension === '.pdf'
          ? 'application/pdf'
          : extension === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : extension === '.doc'
              ? 'application/msword'
              : extension === '.md' || extension === '.markdown'
                ? 'text/markdown'
                : 'text/plain',
      base64Data: buffer.toString('base64'),
      base64: buffer.toString('base64'),
    });
  });
  return results;
}

function buildBackupFilePayload(filePath) {
  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const buffer = fs.readFileSync(resolvedPath);
  const isZip = extension === '.zip';
  return {
    ok: true,
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    extension,
    mimeType: isZip ? 'application/zip' : 'application/json',
    base64Data: buffer.toString('base64'),
    content: isZip ? '' : buffer.toString('utf8'),
  };
}

function resolveBackupWritePayload(payload) {
  if (payload && payload.base64Data) {
    return Buffer.from(payload.base64Data, 'base64');
  }
  if (payload && payload.binaryBase64) {
    return Buffer.from(payload.binaryBase64, 'base64');
  }
  return Buffer.from(payload && payload.content ? payload.content : '{}', 'utf8');
}

const AI_ANALYSIS_WORKSPACE_STORES = [
  'providerConfigs',
  'materials',
  'templates',
  'bundles',
  'sessions',
  'materialFolders',
  'tagGroups',
  'materialChunks',
  'materialIndex',
  'templateVersions',
  'workspaceMeta',
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return value == null ? '' : `${value}`;
}

function asTimestamp(value) {
  const timestamp = new Date(asText(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function asVersion(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function shouldPreferIncomingAIRecord(current, incoming) {
  if (!current) {
    return true;
  }
  const incomingTime = asTimestamp(incoming && (incoming.updatedAt || incoming.createdAt));
  const currentTime = asTimestamp(current && (current.updatedAt || current.createdAt));
  if (incomingTime !== currentTime) {
    return incomingTime > currentTime;
  }
  const incomingSnapshotVersion = asVersion(incoming && (incoming.snapshotVersion || incoming.version));
  const currentSnapshotVersion = asVersion(current && (current.snapshotVersion || current.version));
  if (incomingSnapshotVersion !== currentSnapshotVersion) {
    return incomingSnapshotVersion > currentSnapshotVersion;
  }
  const incomingMigrationVersion = asVersion(incoming && incoming.migrationVersion);
  const currentMigrationVersion = asVersion(current && current.migrationVersion);
  if (incomingMigrationVersion !== currentMigrationVersion) {
    return incomingMigrationVersion > currentMigrationVersion;
  }
  return asText(incoming && incoming.updatedAt) >= asText(current && current.updatedAt);
}

function mergeAIWorkspaceStore(existingList, incomingList) {
  const map = new Map();
  asArray(existingList).forEach((item) => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });
  asArray(incomingList).forEach((item) => {
    if (!item || !item.id) {
      return;
    }
    const current = map.get(item.id);
    if (shouldPreferIncomingAIRecord(current, item)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function mergeAIAnalysisWorkspaces(existingWorkspace, incomingWorkspace) {
  const existing = existingWorkspace && typeof existingWorkspace === 'object' ? existingWorkspace : {};
  const incoming = incomingWorkspace && typeof incomingWorkspace === 'object' ? incomingWorkspace : {};
  const merged = {};
  AI_ANALYSIS_WORKSPACE_STORES.forEach((storeName) => {
    merged[storeName] = mergeAIWorkspaceStore(existing[storeName], incoming[storeName]);
  });
  merged.schemaVersion = Math.max(asVersion(existing.schemaVersion), asVersion(incoming.schemaVersion), 2);
  return merged;
}

function registerIpcHandlers() {
ipcMain.on('desktop:get-bootstrap-config-sync', (event) => {
  event.returnValue = getBootstrapConfig();
});

ipcMain.on('desktop:renderer-error', (_event, payload) => {
  if (logger) {
    logger.error('Renderer runtime error', payload || {});
  }
});

ipcMain.handle('desktop:get-app-info', async () => {
    const runtimeState = runtimeManager ? runtimeManager.getState() : {};
    return {
      appName: app.getName(),
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      arch: process.arch,
      userDataPath: app.getPath('userData'),
      logPath: path.join(app.getPath('userData'), 'logs'),
      runtimeState,
      updateState,
      zoomFactor: currentZoomFactor,
      bootstrapConfig: getBootstrapConfig(),
    };
  });

  ipcMain.handle('desktop:check-for-updates', async () => {
    return runUpdateCheck({ manual: true });
  });

  ipcMain.handle('desktop:install-downloaded-update', async () => {
    if (updateState.status !== 'downloaded') {
      return {
        ok: false,
        message: '当前没有可安装的已下载更新',
      };
    }

    installUpdateNow().catch((error) => logUpdaterWarn('Install downloaded update failed', error));
    return {
      ok: true,
      message: '即将退出并安装更新',
    };
  });

  ipcMain.handle('desktop:open-logs-directory', async () => {
    const result = await shell.openPath(path.join(app.getPath('userData'), 'logs'));
    return {
      ok: !result,
      message: result || '日志目录已打开',
    };
  });

  ipcMain.handle('desktop:retry-runtime', async () => {
    await showLoadingScreen();
    const runtimeState = await startRuntimeFlow({ restart: true });
    return runtimeState;
  });

  ipcMain.handle('desktop:repair-runtime', async () => {
    await showLoadingScreen();
    const runtimeState = await startRuntimeFlow({ repair: true });
    return runtimeState;
  });

  ipcMain.handle('desktop:get-zoom-factor', async () => currentZoomFactor);
  ipcMain.handle('desktop:set-zoom-factor', async (_event, nextZoomFactor) => ({
    zoomFactor: applyZoomFactor(nextZoomFactor),
  }));
  ipcMain.handle('desktop:zoom-in', async () => ({
    zoomFactor: changeZoomFactor(ZOOM_STEP),
  }));
  ipcMain.handle('desktop:zoom-out', async () => ({
    zoomFactor: changeZoomFactor(-ZOOM_STEP),
  }));
  ipcMain.handle('desktop:reset-zoom', async () => ({
    zoomFactor: resetZoomFactor(),
  }));

  ipcMain.handle('desktop:export-diagnostics', async (_event, snapshotPayload) => {
    return exportDiagnosticsReport(snapshotPayload);
  });

  ipcMain.handle('desktop:ai-analysis:pick-files', async (_event, payload) => {
    const extensionSet = normalizeExtensionSet(payload && payload.extensions);
    const filters = extensionSet.size
      ? [{ name: 'AI Analysis Files', extensions: Array.from(extensionSet).map((item) => item.replace(/^\./, '')) }]
      : [];
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    if (result.canceled) {
      return { ok: false, canceled: true, files: [] };
    }
    return {
      ok: true,
      files: collectSelectedFiles(result.filePaths, extensionSet),
    };
  });

  ipcMain.handle('desktop:ai-analysis:select-import-directory', async (_event, payload) => {
    const requestedPath = payload && payload.directoryPath ? path.resolve(payload.directoryPath) : '';
    if (requestedPath) {
      return {
        canceled: false,
        directoryPath: requestedPath,
      };
    }
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return {
      canceled: result.canceled,
      directoryPath: result.canceled ? '' : result.filePaths[0],
    };
  });

  ipcMain.handle('desktop:ai-analysis:import-directory', async (_event, payload) => {
    const directoryPath = payload && payload.directoryPath ? path.resolve(payload.directoryPath) : '';
    if (!directoryPath || !fs.existsSync(directoryPath)) {
      return { ok: false, files: [], message: '目录不存在' };
    }
    const files = collectFilesRecursive(directoryPath, normalizeExtensionSet(payload && payload.extensions));
    return {
      ok: true,
      files,
      directoryPath,
    };
  });

  ipcMain.handle('desktop:ai-analysis:export-backup', async (_event, payload) => {
    const directFilePath = payload && payload.filePath ? path.resolve(payload.filePath) : '';
    const writeBuffer = resolveBackupWritePayload(payload);
    if (directFilePath) {
      fs.mkdirSync(path.dirname(directFilePath), { recursive: true });
      fs.writeFileSync(directFilePath, writeBuffer);
      return { ok: true, filePath: directFilePath, bypassedDialog: true };
    }
    const defaultPath = path.join(app.getPath('documents'), payload && payload.fileName ? payload.fileName : `horosa-ai-backup-${Date.now()}.zip`);
    const saveResult = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'AI Analysis Backup', extensions: ['zip', 'json'] }],
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, canceled: true };
    }
    try {
      fs.mkdirSync(path.dirname(saveResult.filePath), { recursive: true });
      fs.writeFileSync(saveResult.filePath, writeBuffer);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (logger) {
        logger.warn('AI analysis backup export failed', { filePath: saveResult.filePath, message });
      }
      return { ok: false, message: `导出失败：${message}` };
    }
    return { ok: true, filePath: saveResult.filePath };
  });

  ipcMain.handle('desktop:ai-analysis:import-backup', async (_event, payload) => {
    const directFilePath = payload && payload.filePath ? path.resolve(payload.filePath) : '';
    if (directFilePath && fs.existsSync(directFilePath)) {
      return {
        ...buildBackupFilePayload(directFilePath),
        bypassedDialog: true,
      };
    }
    const openResult = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'AI Analysis Backup', extensions: ['zip', 'json'] }],
    });
    if (openResult.canceled || !openResult.filePaths[0]) {
      return { ok: false, canceled: true };
    }
    return buildBackupFilePayload(openResult.filePaths[0]);
  });

  ipcMain.handle('desktop:ai-analysis:select-sync-directory', async (_event, payload) => {
    const requestedPath = payload && payload.directoryPath ? path.resolve(payload.directoryPath) : '';
    if (requestedPath) {
      fs.mkdirSync(requestedPath, { recursive: true });
      return {
        canceled: false,
        directoryPath: requestedPath,
      };
    }
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return {
      canceled: result.canceled,
      directoryPath: result.canceled ? '' : result.filePaths[0],
    };
  });

  ipcMain.handle('desktop:ai-analysis:sync-workspace', async (_event, payload) => {
    const directoryPath = payload && payload.directoryPath ? path.resolve(payload.directoryPath) : '';
    if (!directoryPath) {
      return { ok: false, message: '未提供同步目录' };
    }
    fs.mkdirSync(directoryPath, { recursive: true });
    const filePath = path.join(directoryPath, 'horosa-ai-workspace.json');
    let existingWorkspace = {};
    if (fs.existsSync(filePath)) {
      try {
        existingWorkspace = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        return {
          ok: false,
          message: `同步目录中的工作区文件损坏：${error && error.message ? error.message : error}`,
          filePath,
        };
      }
    }
    const mergedWorkspace = mergeAIAnalysisWorkspaces(existingWorkspace, payload && payload.workspace ? payload.workspace : {});
    fs.writeFileSync(filePath, JSON.stringify(mergedWorkspace, null, 2), 'utf8');
    return {
      ok: true,
      filePath,
      directoryPath,
      merged: true,
      workspace: mergedWorkspace,
    };
  });
}

async function startRuntimeFlow({ restart = false, repair = false } = {}) {
  if (!runtimeManager) {
    throw new Error('Runtime manager not initialized');
  }

  if (runtimeBootPromise) {
    return runtimeBootPromise;
  }

  runtimeBootPromise = (async () => {
    try {
      const runtimeState = repair
        ? await runtimeManager.repairPreparedRuntime()
        : (restart ? await runtimeManager.restart() : await runtimeManager.start());
      await loadRendererApp();
      return runtimeState;
    } catch (error) {
      if (logger) {
        logger.error('Runtime bootstrap failed', error);
      }
      await showLoadingScreen();
      publishCurrentStates();
      return runtimeManager.getState();
    } finally {
      runtimeBootPromise = null;
    }
  })();

  return runtimeBootPromise;
}

async function bootstrap() {
  fs.mkdirSync(horosaDataRoot, { recursive: true });
  fs.mkdirSync(path.join(app.getPath('userData'), 'logs'), { recursive: true });
  logger = createLogger(path.join(app.getPath('userData'), 'logs'));
  logger.info('Starting Horosa desktop app');

  runtimeManager = new RuntimeManager({
    resourceRoot: getResourceRoot(),
    userDataDir: app.getPath('userData'),
    logger,
  });
  registerIpcHandlers();
  runtimeManager.updateState({
    status: 'starting-window',
    message: '正在准备桌面窗口',
  });

  runtimeManager.on('state', (state) => {
    broadcast('desktop:runtime-state', state);
  });

  runtimeManager.on('runtime-error', async (error) => {
    if (isQuitting || isShuttingDown) {
      if (logger) {
        logger.info('Ignoring runtime-error during planned app shutdown', {
          message: error && error.message ? error.message : String(error || ''),
        });
      }
      return;
    }
    if (logger) {
      logger.error('Runtime error', error);
    }

    // H-7: bounded auto-restart before surfacing the manual repair UI. A crashed backend (Python/Java
    // exiting after ready) is retried up to MAX_RUNTIME_AUTO_RESTARTS times with backoff. Restarting via
    // startRuntimeFlow({restart}) re-acquires ports + reloads the renderer with the new ports. If the
    // runtime stays up for the stability window the counter resets; if the budget is exhausted (or a
    // restart never reaches 'ready') we fall through to the manual loading/repair screen.
    if (runtimeAutoRestartAttempts < MAX_RUNTIME_AUTO_RESTARTS) {
      runtimeAutoRestartAttempts += 1;
      const attempt = runtimeAutoRestartAttempts;
      const backoff = RUNTIME_AUTO_RESTART_BACKOFF_MS[Math.min(attempt - 1, RUNTIME_AUTO_RESTART_BACKOFF_MS.length - 1)];
      if (logger) {
        logger.warn(`[runtime] auto-restart after crash (attempt ${attempt}/${MAX_RUNTIME_AUTO_RESTARTS}) in ${backoff}ms`);
      }
      try {
        runtimeManager.updateState({
          status: 'restarting',
          message: `本地服务异常，正在自动重启（${attempt}/${MAX_RUNTIME_AUTO_RESTARTS}）…`,
        });
        publishCurrentStates();
      } catch (stateError) { /* non-fatal */ }

      await new Promise((resolve) => setTimeout(resolve, backoff));
      if (isQuitting || isShuttingDown) { return; } // user quit during backoff

      let restartedState = null;
      try {
        restartedState = await startRuntimeFlow({ restart: true });
      } catch (restartError) {
        if (logger) { logger.error(`[runtime] auto-restart attempt ${attempt} threw`, restartError); }
      }
      if (restartedState && restartedState.status === 'ready') {
        if (logger) { logger.info(`[runtime] auto-restart attempt ${attempt} reached ready`); }
        // Stability window: if it stays up, forgive the attempt budget for the next independent crash.
        if (runtimeAutoRestartStabilityTimer) { clearTimeout(runtimeAutoRestartStabilityTimer); }
        runtimeAutoRestartStabilityTimer = setTimeout(() => {
          if (runtimeManager && runtimeManager.getState().status === 'ready') {
            runtimeAutoRestartAttempts = 0;
            if (logger) { logger.info('[runtime] stable after auto-restart — reset attempt counter'); }
          }
        }, RUNTIME_AUTO_RESTART_STABILITY_MS);
        return; // recovered — renderer already reloaded by startRuntimeFlow
      }
      if (logger) { logger.warn(`[runtime] auto-restart attempt ${attempt} did not reach ready — surfacing manual repair`); }
      // fall through to the manual repair UI
    } else if (logger) {
      logger.warn(`[runtime] auto-restart budget exhausted (${MAX_RUNTIME_AUTO_RESTARTS}) — surfacing manual repair`);
    }

    try {
      await showLoadingScreen();
      publishCurrentStates();
    } catch (loadError) {
      if (logger) {
        logger.error('Failed to show loading screen after runtime error', loadError);
      }
    }
  });

  createAppMenu();
  await createMainWindow();
  setImmediate(() => {
    try {
      migrateLegacyData();
    } catch (error) {
      if (logger) {
        logger.warn('Legacy data migration skipped', error.message);
      }
    }
  });
  configureAutoUpdater();
  // Schedule the initial update check EVERY app open, independent of runtime success
  // — if the runtime is broken, the user still gets the "new version" prompt (and the
  // update may itself fix the broken boot).
  queueUpdateCheck();
  publishCurrentStates();
  await startRuntimeFlow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    logLifecycle('second-instance received', {
      hasMainWindow: Boolean(mainWindow && !mainWindow.isDestroyed()),
      isShuttingDown,
    });
    restoreOrCreateMainWindow('second-instance').catch((error) => {
      if (logger) {
        logger.error('Failed to restore main window for second instance', error);
      }
    });
  });

  app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox('星阙启动失败', error.message);
    app.exit(1);
  });
}

app.on('activate', () => {
  logLifecycle('Application activate event', {
    hasMainWindow: Boolean(mainWindow && !mainWindow.isDestroyed()),
    isShuttingDown,
  });
  restoreOrCreateMainWindow('activate').catch((error) => {
    if (logger) {
      logger.error('Failed to handle activate event', error);
    }
  });
});

app.on('window-all-closed', () => {
  logLifecycle('window-all-closed event', {
    isQuitting,
    isShuttingDown,
  });
  if (!isQuitting) {
    requestAppQuit('window-all-closed').catch(() => {});
  }
});

app.on('before-quit', (event) => {
  logLifecycle('before-quit event', {
    isQuitting,
    isShuttingDown,
  });
  if (!isQuitting) {
    event.preventDefault();
    requestAppQuit('before-quit').catch(() => {});
  } else {
    isShuttingDown = true;
  }
});

app.on('will-quit', () => {
  logLifecycle('will-quit event', {
    isQuitting,
    isShuttingDown,
  });
});
