const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('events');

const { RuntimeManager, classifyProcessExit } = require('./service-manager');

function createLogger() {
  const entries = {
    info: [],
    warn: [],
    error: [],
  };

  return {
    entries,
    child() {
      return this;
    },
    info(message, payload) {
      entries.info.push({ message, payload });
    },
    warn(message, payload) {
      entries.warn.push({ message, payload });
    },
    error(message, payload) {
      entries.error.push({ message, payload });
    },
  };
}

function createChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  return child;
}

test('classifyProcessExit treats planned stop metadata as non-unexpected', () => {
  const child = createChild(101);
  const result = classifyProcessExit({
    child,
    activeChild: child,
    shuttingDown: false,
    expectedExit: {
      reason: 'quit',
    },
  });

  assert.equal(result.unexpected, false);
  assert.equal(result.planned, true);
  assert.equal(result.reason, 'quit');
});

test('planned stop child exit does not emit runtime-error', () => {
  const logger = createLogger();
  const runtimeManager = new RuntimeManager({
    resourceRoot: 'unused',
    userDataDir: 'unused',
    logger,
  });
  const child = createChild(201);
  const javaChild = createChild(202);
  const runtimeErrors = [];

  runtimeManager.pythonProcess = child;
  runtimeManager.javaProcess = javaChild;
  runtimeManager.on('runtime-error', (error) => {
    runtimeErrors.push(error);
  });
  runtimeManager.attachUnexpectedExitHandlers('test-log-dir');
  runtimeManager.markExpectedProcessExit('python', child, 'quit');

  child.emit('exit', 1, null);

  assert.equal(runtimeErrors.length, 0);
  assert.equal(
    logger.entries.error.some((entry) => String(entry.message).includes('Python chart service exited unexpectedly')),
    false
  );
  assert.equal(
    logger.entries.info.some(
      (entry) =>
        entry.message === 'Child process exited during planned shutdown' && entry.payload && entry.payload.reason === 'quit'
    ),
    true
  );
});

test('stale child exit after process replacement does not emit runtime-error', () => {
  const logger = createLogger();
  const runtimeManager = new RuntimeManager({
    resourceRoot: 'unused',
    userDataDir: 'unused',
    logger,
  });
  const oldChild = createChild(301);
  const oldJavaChild = createChild(302);
  const newChild = createChild(302);
  const newJavaChild = createChild(303);
  const runtimeErrors = [];

  runtimeManager.pythonProcess = oldChild;
  runtimeManager.javaProcess = oldJavaChild;
  runtimeManager.on('runtime-error', (error) => {
    runtimeErrors.push(error);
  });
  runtimeManager.attachUnexpectedExitHandlers('test-log-dir');
  runtimeManager.pythonProcess = newChild;
  runtimeManager.javaProcess = newJavaChild;

  oldChild.emit('exit', 1, null);

  assert.equal(runtimeErrors.length, 0);
  assert.equal(
    logger.entries.info.some((entry) => entry.message === 'Ignoring stale child exit after process replacement'),
    true
  );
});

test('active child unexpected exit still emits runtime-error', () => {
  const logger = createLogger();
  const runtimeManager = new RuntimeManager({
    resourceRoot: 'unused',
    userDataDir: 'unused',
    logger,
  });
  const child = createChild(401);
  const javaChild = createChild(402);
  const runtimeErrors = [];

  runtimeManager.pythonProcess = child;
  runtimeManager.javaProcess = javaChild;
  runtimeManager.on('runtime-error', (error) => {
    runtimeErrors.push(error);
  });
  runtimeManager.attachUnexpectedExitHandlers('test-log-dir');

  child.emit('exit', 1, null);

  assert.equal(runtimeErrors.length, 1);
  assert.match(runtimeErrors[0].message, /Python chart service exited unexpectedly/);
  assert.equal(
    logger.entries.error.some((entry) => String(entry.message).includes('Python chart service exited unexpectedly')),
    true
  );
});

test('stop continues cleanup when AppCDS dump times out', async () => {
  const logger = createLogger();
  const runtimeManager = new RuntimeManager({
    resourceRoot: 'unused',
    userDataDir: 'unused',
    logger,
  });
  const pythonChild = createChild(501);
  const javaChild = createChild(502);
  const callOrder = [];

  runtimeManager.pythonProcess = pythonChild;
  runtimeManager.javaProcess = javaChild;
  runtimeManager.layout = { javaExe: 'unused' };
  runtimeManager.appCdsContext = { archivePath: 'unused' };
  runtimeManager.performAppCdsDynamicDump = async () => {
    callOrder.push('dump');
    return { status: 'timeout' };
  };
  runtimeManager.cleanupProcesses = async () => {
    callOrder.push('cleanup');
    runtimeManager.pythonProcess = null;
    runtimeManager.javaProcess = null;
  };

  await runtimeManager.stop('quit');

  assert.deepEqual(callOrder, ['dump', 'cleanup']);
  assert.equal(runtimeManager.pythonProcess, null);
  assert.equal(runtimeManager.javaProcess, null);
  assert.equal(runtimeManager.getState().status, 'stopped');
});

test('stop still cleans up when AppCDS dump throws', async () => {
  const logger = createLogger();
  const runtimeManager = new RuntimeManager({
    resourceRoot: 'unused',
    userDataDir: 'unused',
    logger,
  });
  const pythonChild = createChild(601);
  const javaChild = createChild(602);
  let cleanupCalled = false;

  runtimeManager.pythonProcess = pythonChild;
  runtimeManager.javaProcess = javaChild;
  runtimeManager.layout = { javaExe: 'unused' };
  runtimeManager.appCdsContext = { archivePath: 'unused' };
  runtimeManager.performAppCdsDynamicDump = async () => {
    throw new Error('jcmd hung');
  };
  runtimeManager.cleanupProcesses = async () => {
    cleanupCalled = true;
    runtimeManager.pythonProcess = null;
    runtimeManager.javaProcess = null;
  };

  await runtimeManager.stop('quit');

  assert.equal(cleanupCalled, true);
  assert.equal(runtimeManager.pythonProcess, null);
  assert.equal(runtimeManager.javaProcess, null);
  assert.equal(
    logger.entries.warn.some((entry) => entry.message === 'AppCDS dynamic dump failed before shutdown cleanup'),
    true
  );
});
