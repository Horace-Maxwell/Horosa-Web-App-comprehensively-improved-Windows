'use strict';

// Pure, testable helpers for the desktop auto-update flow. This module has NO
// electron / electron-updater imports so it can be unit-tested with `node --test`.
// The electron-updater wiring + native dialogs live in main.js and call into here.
//
// Design (mature electron-updater pattern, tuned for this app):
//   - autoDownload = false: we PROMPT before pulling the ~800MB installer.
//   - Background checks are non-intrusive: they only ever surface the
//     "发现新版/已下载" prompts, never "已是最新" or error dialogs (that was the
//     original "updater noise" that got the whole feature disabled).
//   - Manual checks (Help → 检查更新) surface every outcome, including
//     "already latest" and errors, because the user explicitly asked.
//   - A version the user dismissed ("稍后") is not re-prompted by background
//     checks for the rest of the session (anti-nag); a manual check always prompts.

const OFFLINE_UPDATE_ERROR_PATTERNS = [
  'enetunreach',
  'econnreset',
  'econnrefused',
  'etimedout',
  'err_internet_disconnected',
  'internet disconnected',
  'net::err_network_changed',
  'net::err_name_not_resolved',
  'enotfound',
  'network request failed',
  'socket hang up',
  'timeout',
];

function isOfflineUpdateError(message) {
  const normalizedMessage = String(message || '').toLowerCase();
  return OFFLINE_UPDATE_ERROR_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

function formatUpdateErrorMessage(error, { manual = false } = {}) {
  const rawMessage = error && error.message ? error.message : String(error || '');

  if (rawMessage.includes('app-update.yml')) {
    return manual
      ? '更新功能初始化失败，请安装最新完整安装包后重试。'
      : '更新暂不可用，已跳过后台检查。';
  }

  if (isOfflineUpdateError(rawMessage)) {
    return manual
      ? '网络不可用，暂时无法检查更新。'
      : '当前网络不可用，已跳过后台更新检查。';
  }

  // Downloading the ~760MB installer into the updater cache can hit a full
  // disk (ENOSPC); name the real cause instead of a generic failure.
  if (/ENOSPC|not enough space|no space left|disk full/i.test(rawMessage)) {
    return manual
      ? '磁盘空间不足，无法下载更新。请清理磁盘空间（建议预留至少 3 GB）后重试。'
      : '磁盘空间不足，已跳过后台更新下载。';
  }

  return manual
    ? `检查更新失败：${rawMessage || '请稍后重试。'}`
    : '更新暂不可用，已跳过后台检查。';
}

// Whether to surface the "发现新版" prompt for a discovered update.
// Manual checks always prompt. Background checks prompt unless the user already
// dismissed this exact version this session.
function shouldPromptForAvailableUpdate({ manual = false, version = null, dismissedVersion = null } = {}) {
  if (manual) {
    return true;
  }
  if (!version) {
    return false;
  }
  return version !== dismissedVersion;
}

// Whether a "checking found nothing" outcome should show a dialog.
// Only manual checks tell the user "already latest"; background stays silent.
function shouldAnnounceNoUpdate({ manual = false } = {}) {
  return Boolean(manual);
}

// Whether an updater error should be surfaced via a dialog.
// Only manual checks show errors; background errors are logged silently.
function shouldAnnounceUpdateError({ manual = false } = {}) {
  return Boolean(manual);
}

module.exports = {
  isOfflineUpdateError,
  formatUpdateErrorMessage,
  shouldPromptForAvailableUpdate,
  shouldAnnounceNoUpdate,
  shouldAnnounceUpdateError,
};
