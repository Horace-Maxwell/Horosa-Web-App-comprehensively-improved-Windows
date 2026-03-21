const fs = require('fs');
const os = require('os');
const path = require('path');
const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } = require('electron');
const packageMetadata = require('../package.json');
const { createLogger } = require('./logger');
const { RuntimeManager } = require('./service-manager');

const localAppDataRoot = process.env.LOCALAPPDATA || app.getPath('appData');
const horosaDataRoot = path.join(localAppDataRoot, 'HorosaDesktop');
const windowStateFile = path.join(horosaDataRoot, 'window-state.json');
const loadingPagePath = path.join(__dirname, 'loading.html');
const WINDOW_STATE_VERSION = 7;
const DEFAULT_ZOOM_FACTOR = 0.8;
const MIN_ZOOM_FACTOR = 0.6;
const MAX_ZOOM_FACTOR = 1.6;
const ZOOM_STEP = 0.1;
const FOREGROUND_RESET_DELAY_MS = 150;
const APP_QUIT_TIMEOUT_MS = 15000;
const LATEST_RELEASE_URL = 'https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest';
const MANUAL_INSTALLER_UPDATE_MESSAGE = '当前版本改为通过 GitHub Releases 下载完整安装器更新，请下载最新 Horosa-Setup 安装包后覆盖安装。';

app.setPath('userData', horosaDataRoot);

let mainWindow = null;
let runtimeManager = null;
let logger = null;
let runtimeBootPromise = null;
let currentWindowBoundsMode = 'default-maximized-80';
let currentPage = 'loading';
let windowStateSaveTimer = null;
let initialWindowNormalizationTimers = [];
let hasAppliedInitialWindowState = false;
let lastNormalWindowBounds = null;
let currentZoomFactor = DEFAULT_ZOOM_FACTOR;
let quitRequested = false;
let isForceExiting = false;
let quitFlowPromise = null;
let pendingRelaunch = false;
let quitForceExitTimer = null;
let suppressWindowCloseQuit = false;
let windowRecreationInProgress = false;
let updateState = {
  status: app.isPackaged ? 'manual-installer-only' : 'unsupported',
  message: app.isPackaged ? MANUAL_INSTALLER_UPDATE_MESSAGE : '开发模式下不启用安装器更新',
  latestReleaseUrl: app.isPackaged ? LATEST_RELEASE_URL : null,
};

function buildManualInstallerUpdateState(options = {}) {
  const { opened = false } = options;
  return {
    status: 'manual-installer-only',
    message: opened
      ? '已打开 GitHub Releases 下载页，请下载安装最新 Horosa-Setup 安装包。'
      : MANUAL_INSTALLER_UPDATE_MESSAGE,
    latestReleaseUrl: LATEST_RELEASE_URL,
  };
}

async function runUpdateCheck({ manual = false } = {}) {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'unsupported',
      message: '开发模式下不启用安装器更新',
      latestReleaseUrl: null,
    });
    return updateState;
  }

  try {
    if (manual) {
      await shell.openExternal(LATEST_RELEASE_URL);
    }
    setUpdateState(buildManualInstallerUpdateState({ opened: manual }));
  } catch (error) {
    if (logger) {
      logger.warn('Failed to open installer release page', error && error.message ? error.message : String(error));
    }
    setUpdateState({
      status: 'manual-installer-only',
      message: `请手动打开 GitHub Releases 下载最新 Horosa-Setup 安装包：${LATEST_RELEASE_URL}`,
      latestReleaseUrl: LATEST_RELEASE_URL,
    });
  }

  return updateState;
}

function getResourceRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app-runtime');
  }
  return path.join(__dirname, '..', 'build', 'app-runtime');
}

function getRendererIndexPath() {
  const resourceRoot = getResourceRoot();
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

function getBootstrapConfig() {
  const runtimeState = runtimeManager ? runtimeManager.getState() : {};
  return {
    desktop: true,
    windowBoundsMode: currentWindowBoundsMode,
    zoomFactor: currentZoomFactor,
    runtimeStatus: runtimeState,
    serverRoot: runtimeState.serverRoot || 'http://127.0.0.1:9999',
    userDataPath: app.getPath('userData'),
  };
}

function setMainWindowTitle(nextTitle) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    mainWindow.setTitle(nextTitle);
  } catch (_error) {
    // Ignore title sync failures on platforms that do not support it consistently.
  }
}

function clearQuitForceExitTimer() {
  if (!quitForceExitTimer) {
    return;
  }
  clearTimeout(quitForceExitTimer);
  quitForceExitTimer = null;
}

function getMainWindowDiagnostics() {
  const browserWindowCount = BrowserWindow.getAllWindows().length;
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      exists: false,
      browserWindowCount,
    };
  }

  const webContents = mainWindow.webContents;
  return {
    exists: true,
    browserWindowCount,
    isDestroyed: mainWindow.isDestroyed(),
    isVisible: mainWindow.isVisible(),
    isMinimized: mainWindow.isMinimized(),
    isFocused: mainWindow.isFocused(),
    currentPage,
    webContentsDestroyed: !webContents || webContents.isDestroyed(),
    webContentsCrashed: webContents && typeof webContents.isCrashed === 'function' ? webContents.isCrashed() : false,
    url: webContents && !webContents.isDestroyed() ? webContents.getURL() : null,
  };
}

function hasUsableMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  const webContents = mainWindow.webContents;
  if (!webContents || webContents.isDestroyed()) {
    return false;
  }
  if (typeof webContents.isCrashed === 'function' && webContents.isCrashed()) {
    return false;
  }

  return true;
}

function bringWindowToFront(reason = 'unknown') {
  if (!hasUsableMainWindow()) {
    return;
  }

  const wasMinimized = mainWindow.isMinimized();
  const wasVisible = mainWindow.isVisible();

  try {
    if (wasMinimized) {
      mainWindow.restore();
    }
    if (!wasVisible) {
      mainWindow.show();
    }

    if (typeof mainWindow.moveTop === 'function') {
      mainWindow.moveTop();
    }
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.focus();
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.setAlwaysOnTop(false);
    }, FOREGROUND_RESET_DELAY_MS);
  } catch (error) {
    if (logger) {
      logger.warn('Failed to bring window to front', {
        reason,
        message: error && error.message ? error.message : String(error),
      });
    }
    return;
  }

  if (logger) {
    logger.info('Foreground activation path', {
      reason,
      page: currentPage,
      wasMinimized,
      wasVisible,
    });
  }
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

  return {
    bounds: defaultBounds,
    mode: 'default-maximized-80',
    maximizeAfterShow: true,
    zoomFactor: getDefaultZoomFactor(),
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
  if (!hasUsableMainWindow()) {
    return;
  }

  currentPage = 'loading';
  setMainWindowTitle('星阙启动中');
  await mainWindow.loadFile(loadingPagePath);
  publishCurrentStates();
}

async function loadRendererApp() {
  if (!hasUsableMainWindow()) {
    return;
  }

  currentPage = 'renderer';
  setMainWindowTitle('星阙');
  await mainWindow.loadFile(getRendererIndexPath(), {
    hash: '/',
  });
  publishCurrentStates();
}

function showBootstrapWindow(bounds, reason = 'bootstrap') {
  if (!hasUsableMainWindow()) {
    return;
  }

  applyStartupMaximizedWindowState(bounds, reason);
  lastNormalWindowBounds = normalizeBounds(bounds);
  if (!hasAppliedInitialWindowState) {
    hasAppliedInitialWindowState = true;
    scheduleInitialWindowNormalization(bounds);
    queueWindowStateSave();
  }

  bringWindowToFront(reason);
  if (logger) {
    logger.info('Bootstrap window shown', {
      reason,
      bounds,
      page: currentPage,
    });
  }
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
    title: '星阙启动中',
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
          app.quit();
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
    bringWindowToFront('ready-to-show');
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
    saveWindowState();
    if (suppressWindowCloseQuit) {
      suppressWindowCloseQuit = false;
      return;
    }
    if (!quitRequested && !isForceExiting) {
      event.preventDefault();
      requestAppQuit('window-close');
    }
  });
  mainWindow.on('closed', () => {
    clearInitialWindowNormalizationTimers();
    if (logger) {
      logger.info('Main window closed');
    }
    mainWindow = null;
  });

  showBootstrapWindow(initialState.bounds, 'initial-create');
  return showLoadingScreen();
}

async function recreateMainWindow(reason) {
  if (logger) {
    logger.warn('Recreating main window from existing instance', {
      reason,
      diagnostics: getMainWindowDiagnostics(),
    });
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      windowRecreationInProgress = true;
      suppressWindowCloseQuit = true;
      mainWindow.destroy();
    } catch (_error) {
      windowRecreationInProgress = false;
      suppressWindowCloseQuit = false;
      // Ignore best-effort teardown failures before we recreate the window.
    }
  }
  mainWindow = null;
  try {
    await createMainWindow();

    if (!runtimeManager) {
      return;
    }

    const runtimeState = runtimeManager.getState();
    if (runtimeState.status === 'ready') {
      await loadRendererApp();
      bringWindowToFront(`${reason}-renderer-ready`);
      return;
    }

    if (!runtimeBootPromise) {
      startRuntimeFlow({
        restart: runtimeState.status === 'failed' || runtimeState.status === 'stopped',
      }).catch((error) => {
        if (logger) {
          logger.error('Failed to restart runtime while recreating window', error);
        }
      });
    } else {
      runtimeBootPromise.catch(() => {});
    }

    bringWindowToFront(`${reason}-loading`);
  } finally {
    windowRecreationInProgress = false;
  }
}

async function ensureHealthyMainWindow(reason) {
  if (hasUsableMainWindow()) {
    bringWindowToFront(reason);
    return true;
  }

  if (logger) {
    logger.warn('Second-instance received but no healthy window found', {
      reason,
      diagnostics: getMainWindowDiagnostics(),
    });
  }

  try {
    await recreateMainWindow(reason);
    return hasUsableMainWindow();
  } catch (error) {
    if (logger) {
      logger.error('Failed to recover stale window state', error);
    }
    return false;
  }
}

function requestAppQuit(reason, options = {}) {
  const { relaunch = false } = options;
  if (relaunch) {
    pendingRelaunch = true;
  }

  if (!quitRequested) {
    quitRequested = true;
    if (logger) {
      logger.info('Quit requested', {
        reason,
        relaunch: pendingRelaunch,
      });
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.hide();
    } catch (_error) {
      // Ignore visibility sync failures during shutdown.
    }
  }

  app.quit();
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
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => requestAppQuit('menu-exit'),
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
          label: '最大化窗口',
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
          label: '下载最新安装包',
          click: () => {
            runUpdateCheck({ manual: true }).catch(() => {});
          },
        },
        {
          label: '打开日志目录',
          click: () => {
            shell.openPath(path.join(app.getPath('userData'), 'logs')).catch(() => {});
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function configureAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }
  setUpdateState(buildManualInstallerUpdateState());
}

function queueUpdateCheck() {
  return;
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
    return {
      ok: false,
      message: '当前发布渠道只提供完整安装器更新，请到 GitHub Releases 下载最新 Horosa-Setup 安装包后覆盖安装。',
      latestReleaseUrl: LATEST_RELEASE_URL,
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
    const runtimeState = runtimeManager ? runtimeManager.getState() : {};
    const defaultPath = path.join(
      app.getPath('documents'),
      `Horosa-Diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );

    const saveResult = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return {
        ok: false,
        canceled: true,
        message: '已取消导出诊断报告',
      };
    }

    const payload = {
      appInfo: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        userDataPath: app.getPath('userData'),
        resourceRoot: getResourceRoot(),
      },
      runtimeState,
      updateState,
      rendererSnapshot: snapshotPayload || {},
      exportedAt: new Date().toISOString(),
    };

    fs.writeFileSync(saveResult.filePath, JSON.stringify(payload, null, 2), 'utf8');
    return {
      ok: true,
      message: `诊断报告已导出到 ${saveResult.filePath}`,
      filePath: saveResult.filePath,
    };
  });
}

async function startRuntimeFlow({ restart = false } = {}) {
  if (!runtimeManager) {
    throw new Error('Runtime manager not initialized');
  }

  if (runtimeBootPromise) {
    return runtimeBootPromise;
  }

  runtimeBootPromise = (async () => {
    try {
      const runtimeState = restart ? await runtimeManager.restart() : await runtimeManager.start();
      await loadRendererApp();
      queueUpdateCheck();
      return runtimeState;
    } catch (error) {
      if (logger) {
        logger.error('Runtime bootstrap failed', error);
      }
      await showLoadingScreen();
      bringWindowToFront(restart ? 'runtime-restart-failed' : 'runtime-start-failed');
      publishCurrentStates();
      return runtimeManager.getState();
    } finally {
      runtimeBootPromise = null;
    }
  })();

  return runtimeBootPromise;
}

async function performQuitFlow() {
  if (quitFlowPromise) {
    return quitFlowPromise;
  }

  quitFlowPromise = (async () => {
    clearQuitForceExitTimer();
    quitForceExitTimer = setTimeout(() => {
      if (logger) {
        logger.error('Quit flow timed out, forcing app exit', {
          timeoutMs: APP_QUIT_TIMEOUT_MS,
        });
      }
      if (pendingRelaunch) {
        app.relaunch();
      }
      isForceExiting = true;
      app.exit(0);
    }, APP_QUIT_TIMEOUT_MS);
    if (typeof quitForceExitTimer.unref === 'function') {
      quitForceExitTimer.unref();
    }

    try {
      if (windowStateSaveTimer) {
        clearTimeout(windowStateSaveTimer);
        windowStateSaveTimer = null;
      }
      saveWindowState();

      if (runtimeManager) {
        await runtimeManager.stop().catch((error) => {
          if (logger) {
            logger.error('Runtime stop failed during quit flow', error);
          }
        });
      }

      if (pendingRelaunch) {
        app.relaunch();
      }

      if (logger) {
        logger.info('App exiting', {
          relaunch: pendingRelaunch,
        });
      }
    } finally {
      clearQuitForceExitTimer();
      isForceExiting = true;
      app.exit(0);
    }
  })();

  return quitFlowPromise;
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
    if (logger) {
      logger.error('Runtime error', error);
    }
    await showLoadingScreen();
    bringWindowToFront('runtime-error');
    publishCurrentStates();
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
  publishCurrentStates();
  await startRuntimeFlow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    app.whenReady().then(async () => {
      const recovered = await ensureHealthyMainWindow('second-instance');
      if (!recovered) {
        if (logger) {
          logger.error('Escalating to app relaunch after stale instance state', getMainWindowDiagnostics());
        }
        requestAppQuit('stale-instance-relaunch', { relaunch: true });
      }
    }).catch((error) => {
      if (logger) {
        logger.error('Failed to process second-instance activation', error);
      }
      requestAppQuit('second-instance-recovery-failed', { relaunch: true });
    });
  });

  app.whenReady().then(bootstrap).catch((error) => {
    dialog.showErrorBox('星阙启动失败', error.message);
    app.quit();
  });
}

app.on('activate', () => {
  if (quitRequested || isForceExiting) {
    return;
  }
  ensureHealthyMainWindow('activate').catch((error) => {
    if (logger) {
      logger.error('Failed to recover window on activate', error);
    }
  });
});

app.on('window-all-closed', () => {
  if (windowRecreationInProgress) {
    if (logger) {
      logger.info('Ignoring window-all-closed during window recreation');
    }
    return;
  }
  if (!quitRequested && !isForceExiting) {
    requestAppQuit('window-all-closed');
  }
});

app.on('before-quit', (event) => {
  if (isForceExiting) {
    return;
  }

  event.preventDefault();
  if (!quitRequested) {
    quitRequested = true;
    if (logger) {
      logger.info('Quit requested', {
        reason: 'before-quit',
        relaunch: pendingRelaunch,
      });
    }
  }

  performQuitFlow().catch((error) => {
    if (logger) {
      logger.error('Quit flow failed unexpectedly', error);
    }
    clearQuitForceExitTimer();
    if (pendingRelaunch) {
      app.relaunch();
    }
    isForceExiting = true;
    app.exit(1);
  });
});
