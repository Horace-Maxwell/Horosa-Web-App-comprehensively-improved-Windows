const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('events');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { RuntimeManager, classifyProcessExit, waitForBackendHeartbeat } = require('./service-manager');

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

function createPackedRuntimeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-packed-runtime-'));
  const payloadRoot = path.join(root, 'payload-src');
  const runtimeRoot = path.join(payloadRoot, 'runtime', 'windows');
  const projectRoot = path.join(payloadRoot, 'project');

  fs.mkdirSync(path.join(runtimeRoot, 'python'), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'java', 'bin'), { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'bundle'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'astropy', 'websrv'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'flatlib-ctrad2', 'flatlib', 'resources', 'swefiles'), { recursive: true });

  fs.writeFileSync(path.join(runtimeRoot, 'python', 'python.exe'), 'python');
  fs.writeFileSync(path.join(runtimeRoot, 'java', 'bin', 'java.exe'), 'java');
  fs.writeFileSync(path.join(runtimeRoot, 'bundle', 'astrostudyboot.jar'), 'jar');
  fs.writeFileSync(path.join(projectRoot, 'astropy', 'websrv', 'webchartsrv.py'), 'print("ok")');
  fs.writeFileSync(path.join(projectRoot, 'flatlib-ctrad2', 'flatlib', 'resources', 'swefiles', 'seas_18.se1'), 'ephe');

  const payloadDir = path.join(root, 'payload');
  fs.mkdirSync(payloadDir, { recursive: true });
  const archivePath = path.join(payloadDir, 'app-runtime.tar');
  const tarResult = spawnSync('tar', ['-cf', archivePath, '-C', payloadRoot, 'runtime', 'project'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  if (tarResult.status !== 0) {
    throw new Error(`failed to build tar fixture: ${tarResult.stderr || tarResult.stdout}`);
  }

  const payloadBuffer = fs.readFileSync(archivePath);
  const crypto = require('crypto');
  const sha256 = crypto.createHash('sha256').update(payloadBuffer).digest('hex');
  fs.writeFileSync(
    path.join(root, 'payload-manifest.json'),
    JSON.stringify(
      {
        payloadId: 'fixture-payload',
        payload: {
          relativePath: 'payload/app-runtime.tar',
          bytes: payloadBuffer.length,
          sha256,
        },
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    root,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function createHttpServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        port: server.address().port,
      });
    });
  });
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

test('waitForBackendHeartbeat accepts unsigned backend auth probe response', async () => {
  const { server, port } = await createHttpServer((_request, response) => {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end('{"ResultCode":9999,"Result":"no.register.app.in.sys.forapp%3A"}');
  });

  try {
    const result = await waitForBackendHeartbeat(`http://127.0.0.1:${port}`, 1000);
    assert.equal(result.ok, true);
    assert.equal(result.acceptedAuthProbe, true);
    assert.equal(result.statusCode, 500);
  } finally {
    server.close();
  }
});

test('ensurePackagedPayloadReady extracts the packed runtime into userData cache', async () => {
  const logger = createLogger();
  const fixture = createPackedRuntimeFixture();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-userdata-'));

  try {
    const runtimeManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });

    const prepared = await runtimeManager.ensurePackagedPayloadReady();
    assert.equal(prepared.mode, 'extracted');
    assert.equal(runtimeManager.getResolvedResourceRoot(), prepared.resourceRoot);
    assert.equal(fs.existsSync(path.join(prepared.resourceRoot, '.payload-ready.json')), true);
    assert.equal(fs.existsSync(path.join(prepared.resourceRoot, 'runtime', 'windows', 'bundle', 'astrostudyboot.jar')), true);
  } finally {
    fixture.cleanup();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('ensurePackagedPayloadReady reuses a prepared cache on the next launch', async () => {
  const logger = createLogger();
  const fixture = createPackedRuntimeFixture();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-userdata-'));

  try {
    const firstManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });
    const firstPrepared = await firstManager.ensurePackagedPayloadReady();
    assert.equal(firstPrepared.mode, 'extracted');

    const secondManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });
    const secondPrepared = await secondManager.ensurePackagedPayloadReady();
    assert.equal(secondPrepared.mode, 'cached');
    assert.equal(secondPrepared.resourceRoot, firstPrepared.resourceRoot);
  } finally {
    fixture.cleanup();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('ensurePackagedPayloadReady falls back to copy when Windows rename is locked', async () => {
  const logger = createLogger();
  const fixture = createPackedRuntimeFixture();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-userdata-'));
  const originalRenameSync = fs.renameSync;
  let renameCalls = 0;

  fs.renameSync = function renameSyncWithEpermOnce(sourcePath, targetPath) {
    renameCalls += 1;
    if (renameCalls <= 8) {
      const error = new Error(`EPERM: operation not permitted, rename '${sourcePath}' -> '${targetPath}'`);
      error.code = 'EPERM';
      throw error;
    }
    return originalRenameSync.apply(this, arguments);
  };

  try {
    const runtimeManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });

    const prepared = await runtimeManager.ensurePackagedPayloadReady();
    assert.equal(prepared.mode, 'extracted');
    assert.equal(prepared.installMove.mode, 'copy');
    assert.equal(fs.existsSync(path.join(prepared.resourceRoot, '.payload-ready.json')), true);
    assert.equal(fs.existsSync(path.join(prepared.resourceRoot, 'runtime', 'windows', 'bundle', 'astrostudyboot.jar')), true);
    assert.equal(
      logger.entries.warn.some((entry) => entry.message === 'Packed runtime rename failed; falling back to copy'),
      true
    );
  } finally {
    fs.renameSync = originalRenameSync;
    fixture.cleanup();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('getPackedPayloadCacheRoot uses short fallback when embedded Python path is long', () => {
  const logger = createLogger();
  const longUserDataDir = path.join(
    os.tmpdir(),
    'horosa-runtime-userdata-' + 'deep-path-segment-'.repeat(16)
  );
  const fallbackBase = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-short-cache-'));
  const previousFallback = process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR;
  process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR = fallbackBase;

  try {
    const runtimeManager = new RuntimeManager({
      resourceRoot: 'unused',
      userDataDir: longUserDataDir,
      logger,
    });
    const cacheRoot = runtimeManager.getPackedPayloadCacheRoot({ payloadId: 'fixture-payload' });
    assert.equal(cacheRoot, path.join(fallbackBase, 'fixture-payload'));
    assert.equal(
      logger.entries.warn.some((entry) => entry.message === 'Embedded runtime cache path is long; using short fallback path'),
      true
    );
  } finally {
    if (previousFallback === undefined) {
      delete process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR;
    } else {
      process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR = previousFallback;
    }
    fs.rmSync(fallbackBase, { recursive: true, force: true });
  }
});

test('trusted runtime cache markers are written and reused when the fingerprint matches', async () => {
  const logger = createLogger();
  const fixture = createPackedRuntimeFixture();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-userdata-'));

  try {
    const firstManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });
    const prepared = await firstManager.ensurePackagedPayloadReady();
    const layout = firstManager.resolveLayout();
    const trustContext = firstManager.getTrustedRuntimeContext(layout, prepared);
    assert.equal(trustContext.trusted, false);

    firstManager.persistRuntimeCaches({
      fingerprint: trustContext.fingerprint,
      readinessChecks: {
        backendHeartbeat: { ok: true, statusCode: 200 },
        chartProbe: { ok: true, statusCode: 200 },
      },
      resourcePreparation: prepared,
      startupDurationMs: 1234,
      trustedRuntime: true,
    });

    assert.equal(fs.existsSync(path.join(userDataDir, '.runtime-health-cache.json')), true);
    assert.equal(fs.existsSync(path.join(userDataDir, '.runtime-fast-path.json')), true);

    const secondManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });
    const secondPrepared = await secondManager.ensurePackagedPayloadReady();
    const secondLayout = secondManager.resolveLayout();
    const secondTrustContext = secondManager.getTrustedRuntimeContext(secondLayout, secondPrepared);
    assert.equal(secondTrustContext.trusted, true);
    assert.equal(secondTrustContext.healthCache.readinessChecks.backendHeartbeat.ok, true);
    assert.equal(secondTrustContext.fastPathCache.trusted, true);
  } finally {
    fixture.cleanup();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('trusted runtime cache markers are ignored when the runtime fingerprint changes', async () => {
  const logger = createLogger();
  const fixture = createPackedRuntimeFixture();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'horosa-runtime-userdata-'));

  try {
    const runtimeManager = new RuntimeManager({
      resourceRoot: fixture.root,
      userDataDir,
      logger,
    });
    const prepared = await runtimeManager.ensurePackagedPayloadReady();
    const layout = runtimeManager.resolveLayout();
    const trustContext = runtimeManager.getTrustedRuntimeContext(layout, prepared);

    runtimeManager.persistRuntimeCaches({
      fingerprint: trustContext.fingerprint,
      readinessChecks: {
        backendHeartbeat: { ok: true, statusCode: 200 },
        chartProbe: { ok: true, statusCode: 200 },
      },
      resourcePreparation: prepared,
      startupDurationMs: 1234,
      trustedRuntime: true,
    });

    fs.appendFileSync(path.join(prepared.resourceRoot, 'runtime', 'windows', 'bundle', 'astrostudyboot.jar'), 'changed');

    const changedLayout = runtimeManager.resolveLayout();
    const changedTrustContext = runtimeManager.getTrustedRuntimeContext(changedLayout, prepared);
    assert.equal(changedTrustContext.trusted, false);
    assert.equal(changedTrustContext.healthCache, null);
    assert.equal(changedTrustContext.fastPathCache, null);
  } finally {
    fixture.cleanup();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
