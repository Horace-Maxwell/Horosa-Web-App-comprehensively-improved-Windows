const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isOfflineUpdateError,
  formatUpdateErrorMessage,
  shouldPromptForAvailableUpdate,
  shouldAnnounceNoUpdate,
  shouldAnnounceUpdateError,
} = require('./update-flow');

test('isOfflineUpdateError detects network failures and ignores unrelated errors', () => {
  assert.equal(isOfflineUpdateError('getaddrinfo ENOTFOUND github.com'), true);
  assert.equal(isOfflineUpdateError('net::ERR_NAME_NOT_RESOLVED'), true);
  assert.equal(isOfflineUpdateError('socket hang up'), true);
  assert.equal(isOfflineUpdateError('connect ETIMEDOUT 140.82.0.1:443'), true);
  assert.equal(isOfflineUpdateError('HTTP 404 not found'), false);
  assert.equal(isOfflineUpdateError(''), false);
  assert.equal(isOfflineUpdateError(null), false);
});

test('formatUpdateErrorMessage: missing app-update.yml is actionable only when manual', () => {
  const error = new Error('ENOENT: app-update.yml not found');
  assert.match(formatUpdateErrorMessage(error, { manual: true }), /更新功能初始化失败/);
  assert.match(formatUpdateErrorMessage(error, { manual: false }), /已跳过后台检查/);
});

test('formatUpdateErrorMessage: offline messaging differs by manual vs background', () => {
  const error = new Error('getaddrinfo ENOTFOUND github.com');
  assert.match(formatUpdateErrorMessage(error, { manual: true }), /网络不可用/);
  assert.match(formatUpdateErrorMessage(error, { manual: false }), /网络不可用，已跳过后台/);
});

test('formatUpdateErrorMessage: generic error surfaces raw reason only when manual', () => {
  const error = new Error('Boom 500');
  assert.match(formatUpdateErrorMessage(error, { manual: true }), /检查更新失败：Boom 500/);
  assert.match(formatUpdateErrorMessage(error, { manual: false }), /更新暂不可用/);
  // Tolerates a bare value with no message field.
  assert.match(formatUpdateErrorMessage(undefined, { manual: true }), /检查更新失败/);
});

test('shouldPromptForAvailableUpdate: manual always prompts', () => {
  assert.equal(shouldPromptForAvailableUpdate({ manual: true, version: '2.3.0', dismissedVersion: '2.3.0' }), true);
  assert.equal(shouldPromptForAvailableUpdate({ manual: true, version: null }), true);
});

test('shouldPromptForAvailableUpdate: background prompts for a new version, not a dismissed one', () => {
  assert.equal(shouldPromptForAvailableUpdate({ manual: false, version: '2.3.0', dismissedVersion: null }), true);
  assert.equal(shouldPromptForAvailableUpdate({ manual: false, version: '2.3.0', dismissedVersion: '2.2.0' }), true);
  assert.equal(shouldPromptForAvailableUpdate({ manual: false, version: '2.3.0', dismissedVersion: '2.3.0' }), false);
  assert.equal(shouldPromptForAvailableUpdate({ manual: false, version: null }), false);
});

test('no-update / error announcements are manual-only (keeps background silent)', () => {
  assert.equal(shouldAnnounceNoUpdate({ manual: true }), true);
  assert.equal(shouldAnnounceNoUpdate({ manual: false }), false);
  assert.equal(shouldAnnounceUpdateError({ manual: true }), true);
  assert.equal(shouldAnnounceUpdateError({ manual: false }), false);
});
