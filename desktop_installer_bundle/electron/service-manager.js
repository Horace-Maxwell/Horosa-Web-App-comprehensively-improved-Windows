const crypto = require('crypto');
const { EventEmitter } = require('events');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PROCESS_KILL_TIMEOUT_MS = 10000;
const LOG_STREAM_CLOSE_TIMEOUT_MS = 4000;
const APP_CDS_DUMP_TIMEOUT_MS = 1500;
const STOP_TIMEOUT_MS = 12000;
const RESOURCE_PREP_TIMEOUT_MS = 15 * 60 * 1000;
const STARTUP_HTTP_TIMEOUT_MS = 5000;
const STARTUP_READY_TIMEOUT_MS = 120000;
const TRUSTED_FAST_PATH_READY_TIMEOUT_MS = 60000;
const STARTUP_RETRY_DELAY_MS = 500;
const PACKED_PAYLOAD_MANIFEST_FILE = 'payload-manifest.json';
const PACKED_PAYLOAD_READY_FILE = '.payload-ready.json';
const RUNTIME_HEALTH_CACHE_FILE = '.runtime-health-cache.json';
const RUNTIME_FAST_PATH_FILE = '.runtime-fast-path.json';
const WINDOWS_SAFE_RUNTIME_PATH_LENGTH = 220;
const STARTUP_CHART_PROBE_PAYLOAD = {
  date: '2028/04/06',
  time: '09:33:00',
  zone: '+00:00',
  lat: '41n26',
  lon: '174w30',
  gpsLat: -41.433333,
  gpsLon: 174.5,
  hsys: 1,
  tradition: false,
  predictive: true,
  zodiacal: 0,
  simpleAsp: false,
  strongRecption: false,
  virtualPointReceiveAsp: true,
  southchart: false,
  ad: 1,
  name: 'Horosa Startup Probe',
  pos: 'Wellington',
};

function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function canListen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

async function findPort(preferredPort, host = '127.0.0.1', attempts = 50) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = preferredPort + offset;
    if (await canListen(candidate, host)) {
      return candidate;
    }
  }
  throw new Error(`No free port available from ${preferredPort} within ${attempts} attempts`);
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function isRetryableMoveError(error) {
  return error && ['EPERM', 'EACCES', 'ENOTEMPTY'].includes(error.code);
}

async function moveDirectoryWithWindowsFallback(sourcePath, targetPath, logger) {
  let lastError = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      fs.renameSync(sourcePath, targetPath);
      return {
        mode: 'rename',
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableMoveError(error)) {
        throw error;
      }
      await delay(150 * attempt);
    }
  }

  if (logger) {
    logger.warn('Packed runtime rename failed; falling back to copy', {
      sourcePath,
      targetPath,
      code: lastError && lastError.code,
      message: lastError && lastError.message,
    });
  }
  rmrf(targetPath);
  fs.cpSync(sourcePath, targetPath, { recursive: true, force: true });
  rmrf(sourcePath);
  return {
    mode: 'copy',
    attempts: 8,
    fallbackReason: lastError ? lastError.code || lastError.message : 'unknown',
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requestHttp({ url, method = 'GET', headers = {}, body = null, timeoutMs = STARTUP_HTTP_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (error) {
      reject(error);
      return;
    }

    const request = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${url}`));
    });
    request.once('error', reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

function normalizeHttpBody(text, maxLength = 240) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function waitForBackendHeartbeat(serverRoot, timeoutMs = STARTUP_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'timeout';

  while (Date.now() < deadline) {
    try {
      const response = await requestHttp({
        url: `${serverRoot.replace(/\/$/, '')}/heartbeat`,
      });
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          ok: true,
          statusCode: response.statusCode,
          bodyExcerpt: normalizeHttpBody(response.body),
        };
      }
      const bodyExcerpt = normalizeHttpBody(response.body);
      if (bodyExcerpt.includes('no.register.app.in.sys.forapp')) {
        return {
          ok: true,
          statusCode: response.statusCode,
          bodyExcerpt,
          acceptedAuthProbe: true,
        };
      }
      lastError = `status=${response.statusCode} body=${bodyExcerpt}`;
    } catch (error) {
      lastError = error.message;
    }
    await delay(STARTUP_RETRY_DELAY_MS);
  }

  throw new Error(`Backend heartbeat probe failed: ${lastError}`);
}

async function waitForChartProbe(chartPort, timeoutMs = STARTUP_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  const body = JSON.stringify(STARTUP_CHART_PROBE_PAYLOAD);
  let lastError = 'timeout';

  while (Date.now() < deadline) {
    try {
      const response = await requestHttp({
        url: `http://127.0.0.1:${chartPort}/`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        },
        body,
        timeoutMs: STARTUP_HTTP_TIMEOUT_MS * 2,
      });
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const payload = JSON.parse(response.body || '{}');
        const birth = payload && payload.params && payload.params.birth;
        if (birth) {
          return {
            ok: true,
            statusCode: response.statusCode,
            birth,
          };
        }
        lastError = `missing params.birth body=${normalizeHttpBody(response.body)}`;
      } else {
        lastError = `status=${response.statusCode} body=${normalizeHttpBody(response.body)}`;
      }
    } catch (error) {
      lastError = error.message;
    }
    await delay(STARTUP_RETRY_DELAY_MS);
  }

  throw new Error(`Chart service probe failed: ${lastError}`);
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function killProcessTree(pid, logger, timeoutMs = PROCESS_KILL_TIMEOUT_MS) {
  if (!pid) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    const timeoutId = setTimeout(() => {
      logger.warn('Timed out stopping child process tree', pid);
      killer.kill();
      resolve();
    }, timeoutMs);
    killer.once('exit', () => {
      clearTimeout(timeoutId);
      logger.info('Stopped child process tree', pid);
      resolve();
    });
    killer.once('error', (error) => {
      clearTimeout(timeoutId);
      logger.warn('Failed to stop child process tree', pid, error.message);
      resolve();
    });
  });
}

function pipeChildOutput(child, outputFile) {
  const stream = fs.createWriteStream(outputFile, { flags: 'a' });
  if (child.stdout) {
    child.stdout.pipe(stream);
  }
  if (child.stderr) {
    child.stderr.pipe(stream);
  }
  return {
    close(timeoutMs = LOG_STREAM_CLOSE_TIMEOUT_MS) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        };

        const timeoutId = setTimeout(() => {
          finish();
        }, timeoutMs);

        stream.once('close', () => {
          clearTimeout(timeoutId);
          finish();
        });
        stream.once('error', () => {
          clearTimeout(timeoutId);
          finish();
        });

        if (child.stdout) {
          child.stdout.unpipe(stream);
        }
        if (child.stderr) {
          child.stderr.unpipe(stream);
        }

        stream.end(() => {
          clearTimeout(timeoutId);
          finish();
        });
      });
    },
  };
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function getFileSignature(filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
  };
}

function runCommand(command, args, { cwd = undefined, env = undefined, timeoutMs = RESOURCE_PREP_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutId = null;
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const finish = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    };

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.once('error', (error) => {
      finish(error);
    });

    child.once('exit', (code, signal) => {
      if (code === 0) {
        finish(null, { code, signal, stdout, stderr });
        return;
      }
      finish(
        new Error(
          `${command} ${args.join(' ')} failed with code=${code ?? 'null'} signal=${signal ?? 'null'}: ${(stderr || stdout || '').trim()}`
        )
      );
    });

    timeoutId = setTimeout(() => {
      if (child.pid) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        }).once('error', () => {});
      }
      finish(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function extractTarArchive(archivePath, targetDir) {
  await runCommand('tar', ['-xf', archivePath, '-C', targetDir], {
    timeoutMs: RESOURCE_PREP_TIMEOUT_MS,
  });
}

function getJavaVersionText(javaExe) {
  const result = spawnSync(javaExe, ['-version'], {
    windowsHide: true,
    encoding: 'utf8',
  });
  return `${result.stderr || ''}\n${result.stdout || ''}`.trim();
}

function getJcmdPath(javaExe) {
  const javaHome = path.dirname(path.dirname(javaExe));
  const jcmdExe = path.join(javaHome, 'bin', 'jcmd.exe');
  return fileExists(jcmdExe) ? jcmdExe : null;
}

function getAppCdsContext(runtimeWindowsDir, javaExe, jarPath) {
  if (!fileExists(jarPath) || !fileExists(javaExe)) {
    return null;
  }

  const jarStat = fs.statSync(jarPath);
  const javaVersion = getJavaVersionText(javaExe);
  const cacheKey = crypto
    .createHash('sha1')
    .update(`${jarPath}|${jarStat.size}|${jarStat.mtimeMs}|${javaVersion}`)
    .digest('hex')
    .slice(0, 20);
  const cacheDir = path.join(runtimeWindowsDir, 'appcds', `horosa-appcds-${cacheKey}`);

  return {
    cacheDir,
    archivePath: path.join(cacheDir, 'astrostudyboot-dynamic.jsa'),
    javaVersion,
  };
}

function ensureAppCdsCacheDir(context, logger) {
  if (!context) {
    return false;
  }

  try {
    ensureDir(context.cacheDir);
    return true;
  } catch (error) {
    logger.warn('AppCDS cache dir unavailable', error.message);
    return false;
  }
}

function isAppCdsArchiveReady(context) {
  if (!context || !fileExists(context.archivePath)) {
    return false;
  }

  try {
    return fs.statSync(context.archivePath).size > 0;
  } catch (_error) {
    return false;
  }
}

async function invokeAppCdsDynamicDump(processId, context, javaExe, logger, timeoutMs = APP_CDS_DUMP_TIMEOUT_MS) {
  if (!context || processId <= 0 || isAppCdsArchiveReady(context)) {
    return {
      status: 'skipped',
      reason: 'archive-ready-or-no-context',
    };
  }

  const jcmdExe = getJcmdPath(javaExe);
  if (!jcmdExe) {
    logger.warn('AppCDS dynamic dump skipped because jcmd.exe is unavailable');
    return {
      status: 'skipped',
      reason: 'jcmd-unavailable',
    };
  }

  if (!ensureAppCdsCacheDir(context, logger)) {
    return {
      status: 'skipped',
      reason: 'cache-dir-unavailable',
    };
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(jcmdExe, [String(processId), 'VM.cds', 'dynamic_dump', context.archivePath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.once('error', (error) => {
      logger.warn('AppCDS dynamic dump failed to start', error.message);
      finish({
        status: 'failed',
        reason: error.message,
      });
    });

    child.once('exit', (code, signal) => {
      if (isAppCdsArchiveReady(context)) {
        logger.info('AppCDS dynamic dump completed', context.archivePath);
        finish({
          status: 'completed',
          code,
          signal,
        });
        return;
      }

      const output = `${stdout || ''}\n${stderr || ''}`.trim();
      logger.warn(
        'AppCDS dynamic dump did not produce a usable archive',
        output || `exit code=${code ?? 'null'} signal=${signal ?? 'null'}`
      );
      finish({
        status: 'failed',
        code,
        signal,
        reason: output || 'archive-not-created',
      });
    });

    const timeoutId = setTimeout(() => {
      const output = `${stdout || ''}\n${stderr || ''}`.trim();
      logger.warn('AppCDS dynamic dump timed out during shutdown; continuing exit', {
        timeoutMs,
        archivePath: context.archivePath,
        output: output || undefined,
      });

      if (child.pid) {
        spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        }).once('error', () => {});
      }

      finish({
        status: 'timeout',
        reason: `timeout-${timeoutMs}ms`,
      });
    }, timeoutMs);
  });
}

function isSameChildProcess(expectedChild, actualChild) {
  if (!expectedChild || !actualChild) {
    return false;
  }
  if (expectedChild === actualChild) {
    return true;
  }
  return Boolean(expectedChild.pid && actualChild.pid && expectedChild.pid === actualChild.pid);
}

function classifyProcessExit({ child, activeChild, shuttingDown, expectedExit }) {
  if (expectedExit && (!expectedExit.child || isSameChildProcess(expectedExit.child, child))) {
    return {
      unexpected: false,
      planned: true,
      stale: false,
      reason: expectedExit.reason || 'stop',
    };
  }

  if (activeChild && !isSameChildProcess(activeChild, child)) {
    return {
      unexpected: false,
      planned: false,
      stale: true,
      reason: 'replaced',
    };
  }

  if (shuttingDown) {
    return {
      unexpected: false,
      planned: true,
      stale: false,
      reason: 'stop',
    };
  }

  return {
    unexpected: true,
    planned: false,
    stale: false,
    reason: null,
  };
}

class RuntimeManager extends EventEmitter {
  constructor({ resourceRoot, userDataDir, logger }) {
    super();
    this.resourceRoot = resourceRoot;
    this.resolvedResourceRoot = resourceRoot;
    this.userDataDir = userDataDir;
    this.logger = logger.child('runtime');
    this.running = false;
    this.shuttingDown = false;
    this.startPromise = null;
    this.stopPromise = null;
    this.pythonProcess = null;
    this.javaProcess = null;
    this.logStreams = [];
    this.appCdsContext = null;
    this.layout = null;
    this.expectedProcessExits = {
      python: null,
      java: null,
    };
    this.state = {
      status: 'idle',
      message: '等待启动本地服务',
    };
  }

  getResolvedResourceRoot() {
    return this.resolvedResourceRoot || this.resourceRoot;
  }

  getPackedPayloadManifestPath() {
    return path.join(this.resourceRoot, PACKED_PAYLOAD_MANIFEST_FILE);
  }

  readPackedPayloadManifest() {
    const manifestPath = this.getPackedPayloadManifestPath();
    if (!fileExists(manifestPath)) {
      return null;
    }

    const manifest = readJsonFile(manifestPath);
    const payload = manifest && manifest.payload;
    if (!manifest || !manifest.payloadId || !payload || !payload.relativePath) {
      throw new Error(`Invalid packed payload manifest: ${manifestPath}`);
    }

    const payloadPath = path.join(this.resourceRoot, ...String(payload.relativePath).split('/'));
    if (!fileExists(payloadPath)) {
      throw new Error(`Packed payload archive missing: ${payloadPath}`);
    }

    return {
      ...manifest,
      payloadPath,
    };
  }

  getPackedPayloadCacheRoot(manifest) {
    const defaultRoot = path.join(this.userDataDir, 'embedded-runtime', manifest.payloadId);
    const pythonImportProbe = path.join(
      defaultRoot,
      'runtime',
      'windows',
      'python',
      'Lib',
      'site-packages',
      'jaraco',
      'collections',
      '__init__.py'
    );
    if (pythonImportProbe.length <= WINDOWS_SAFE_RUNTIME_PATH_LENGTH) {
      return defaultRoot;
    }

    const cacheBase = process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR
      || process.env.HOROSA_RUNTIME_CACHE_DIR
      || path.join(os.tmpdir(), 'HorosaDesktop', 'embedded-runtime');
    const fallbackRoot = path.join(cacheBase, manifest.payloadId);
    if (this.logger) {
      this.logger.warn('Embedded runtime cache path is long; using short fallback path', {
        defaultRoot,
        fallbackRoot,
        probeLength: pythonImportProbe.length,
      });
    }
    return fallbackRoot;
  }

  isPackedPayloadReady(targetRoot, manifest) {
    try {
      const readyPath = path.join(targetRoot, PACKED_PAYLOAD_READY_FILE);
      if (!fileExists(readyPath)) {
        return false;
      }
      const ready = readJsonFile(readyPath);
      if (!ready || ready.payloadId !== manifest.payloadId || ready.sha256 !== manifest.payload.sha256) {
        return false;
      }
      this.resolveLayout(targetRoot);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async ensurePackagedPayloadReady() {
    this.resolvedResourceRoot = this.resourceRoot;
    const manifest = this.readPackedPayloadManifest();
    if (!manifest) {
      return {
        mode: 'direct',
        resourceRoot: this.resourceRoot,
      };
    }

    const targetRoot = this.getPackedPayloadCacheRoot(manifest);
    if (this.isPackedPayloadReady(targetRoot, manifest)) {
      this.resolvedResourceRoot = targetRoot;
      return {
        mode: 'cached',
        resourceRoot: targetRoot,
        payloadId: manifest.payloadId,
        payloadBytes: manifest.payload.bytes,
      };
    }

    const stagingRoot = `${targetRoot}.tmp-${process.pid}-${Date.now()}`;
    rmrf(stagingRoot);
    ensureDir(stagingRoot);
    const startedAt = Date.now();

    this.updateState({
      status: 'preparing-runtime-payload',
      message: '正在准备内置运行时（首次启动可能较慢）',
      packagedPayload: true,
      payloadId: manifest.payloadId,
    });

    try {
      await extractTarArchive(manifest.payloadPath, stagingRoot);
      this.resolveLayout(stagingRoot);
      fs.writeFileSync(
        path.join(stagingRoot, PACKED_PAYLOAD_READY_FILE),
        JSON.stringify(
          {
            payloadId: manifest.payloadId,
            sha256: manifest.payload.sha256,
            preparedAt: new Date().toISOString(),
            payloadBytes: manifest.payload.bytes,
          },
          null,
          2
        ),
        'utf8'
      );

      rmrf(targetRoot);
      ensureDir(path.dirname(targetRoot));
      const installMove = await moveDirectoryWithWindowsFallback(stagingRoot, targetRoot, this.logger);
      this.resolvedResourceRoot = targetRoot;

      return {
        mode: 'extracted',
        resourceRoot: targetRoot,
        payloadId: manifest.payloadId,
        payloadBytes: manifest.payload.bytes,
        extractionDurationMs: Date.now() - startedAt,
        installMove,
      };
    } catch (error) {
      rmrf(stagingRoot);
      throw new Error(`Embedded runtime prepare failed: ${error.message}`);
    }
  }

  resolveLayout(resourceRoot = this.getResolvedResourceRoot()) {
    const runtimeWindowsDir = path.join(resourceRoot, 'runtime', 'windows');
    const bundleRoot = path.join(runtimeWindowsDir, 'bundle');
    const projectRoot = path.join(resourceRoot, 'project');

    const layout = {
      runtimeWindowsDir,
      bundleRoot,
      projectRoot,
      pythonExe: path.join(runtimeWindowsDir, 'python', 'python.exe'),
      javaExe: path.join(runtimeWindowsDir, 'java', 'bin', 'java.exe'),
      jarPath: path.join(bundleRoot, 'astrostudyboot.jar'),
      chartScript: path.join(projectRoot, 'astropy', 'websrv', 'webchartsrv.py'),
      astropyDir: path.join(projectRoot, 'astropy'),
      flatlibDir: path.join(projectRoot, 'flatlib-ctrad2'),
      swephDir: path.join(projectRoot, 'flatlib-ctrad2', 'flatlib', 'resources', 'swefiles'),
    };

    const requiredPaths = [
      layout.pythonExe,
      layout.javaExe,
      layout.jarPath,
      layout.chartScript,
      layout.astropyDir,
      layout.flatlibDir,
    ];

    for (const requiredPath of requiredPaths) {
      if (!fileExists(requiredPath)) {
        throw new Error(`Required runtime asset missing: ${requiredPath}`);
      }
    }

    return layout;
  }

  getRuntimeHealthCachePath() {
    return path.join(this.userDataDir, RUNTIME_HEALTH_CACHE_FILE);
  }

  getRuntimeFastPathPath() {
    return path.join(this.userDataDir, RUNTIME_FAST_PATH_FILE);
  }

  readRuntimeCache(filePath) {
    try {
      if (!fileExists(filePath)) {
        return null;
      }
      return readJsonFile(filePath);
    } catch (_error) {
      return null;
    }
  }

  buildRuntimeFingerprint(layout, resourcePreparation = {}) {
    const stableResourceMode =
      resourcePreparation && resourcePreparation.mode === 'direct'
        ? 'direct'
        : 'packaged-payload';
    const manifestPath = this.getPackedPayloadManifestPath();
    const manifestSignature = fileExists(manifestPath) ? getFileSignature(manifestPath) : null;
    const payloadReadyPath = path.join(this.getResolvedResourceRoot(), PACKED_PAYLOAD_READY_FILE);
    const payloadReadySignature = fileExists(payloadReadyPath) ? getFileSignature(payloadReadyPath) : null;
    const manifest = this.readPackedPayloadManifest();
    const fingerprint = {
      resourceMode: stableResourceMode,
      resourceRoot: this.getResolvedResourceRoot(),
      packagedResourceRoot: this.resourceRoot,
      payloadId: manifest && manifest.payloadId ? manifest.payloadId : (resourcePreparation && resourcePreparation.payloadId) || '',
      payloadSha256:
        manifest && manifest.payload && manifest.payload.sha256
          ? manifest.payload.sha256
          : '',
      manifestSignature,
      payloadReadySignature,
      pythonSignature: getFileSignature(layout.pythonExe),
      javaSignature: getFileSignature(layout.javaExe),
      jarSignature: getFileSignature(layout.jarPath),
    };
    return {
      ...fingerprint,
      id: crypto.createHash('sha1').update(JSON.stringify(fingerprint)).digest('hex'),
    };
  }

  readRuntimeHealthCache(fingerprint = null) {
    const cache = this.readRuntimeCache(this.getRuntimeHealthCachePath());
    if (!cache) {
      return null;
    }
    if (fingerprint && cache.fingerprintId !== fingerprint.id) {
      return null;
    }
    return cache;
  }

  readRuntimeFastPath(fingerprint = null) {
    const cache = this.readRuntimeCache(this.getRuntimeFastPathPath());
    if (!cache) {
      return null;
    }
    if (fingerprint && cache.fingerprintId !== fingerprint.id) {
      return null;
    }
    return cache;
  }

  getTrustedRuntimeContext(layout, resourcePreparation = {}) {
    const fingerprint = this.buildRuntimeFingerprint(layout, resourcePreparation);
    const healthCache = this.readRuntimeHealthCache(fingerprint);
    const fastPathCache = this.readRuntimeFastPath(fingerprint);
    const trusted =
      Boolean(healthCache && fastPathCache && fastPathCache.trusted)
      && Boolean(healthCache.readinessChecks && healthCache.readinessChecks.backendHeartbeat && healthCache.readinessChecks.chartProbe);
    return {
      fingerprint,
      healthCache,
      fastPathCache,
      trusted,
    };
  }

  persistRuntimeCaches({ fingerprint, readinessChecks, resourcePreparation, startupDurationMs, trustedRuntime }) {
    if (!fingerprint) {
      return;
    }
    const updatedAt = new Date().toISOString();
    writeJsonFile(this.getRuntimeHealthCachePath(), {
      fingerprintId: fingerprint.id,
      fingerprint,
      updatedAt,
      readinessChecks,
      resourcePreparation,
      startupDurationMs,
    });
    writeJsonFile(this.getRuntimeFastPathPath(), {
      fingerprintId: fingerprint.id,
      trusted: Boolean(trustedRuntime),
      updatedAt,
      startupDurationMs,
      resourceMode: resourcePreparation && resourcePreparation.mode ? resourcePreparation.mode : 'direct',
      resourceRoot: this.getResolvedResourceRoot(),
    });
  }

  updateState(nextState) {
    this.state = {
      ...this.state,
      ...nextState,
    };
    this.emit('state', this.state);
  }

  markExpectedProcessExit(name, child, reason = 'stop') {
    if (!child) {
      return;
    }
    this.expectedProcessExits[name] = {
      child,
      pid: child.pid || null,
      reason,
      markedAt: Date.now(),
    };
  }

  clearExpectedProcessExit(name, child = null) {
    const current = this.expectedProcessExits[name];
    if (!current) {
      return;
    }
    if (!child || isSameChildProcess(current.child, child)) {
      this.expectedProcessExits[name] = null;
    }
  }

  attachUnexpectedExitHandlers(logDir) {
    const attachHandler = (serviceKey, child, name) => {
      if (!child) {
        return;
      }

      child.once('exit', (code, signal) => {
        const exitState = classifyProcessExit({
          child,
          activeChild: this[`${serviceKey}Process`],
          shuttingDown: this.shuttingDown,
          expectedExit: this.expectedProcessExits[serviceKey],
        });

        if (exitState.planned) {
          this.logger.info('Child process exited during planned shutdown', {
            name,
            code,
            signal,
            reason: exitState.reason,
          });
          this.clearExpectedProcessExit(serviceKey, child);
          return;
        }

        if (exitState.stale) {
          this.logger.info('Ignoring stale child exit after process replacement', {
            name,
            code,
            signal,
          });
          this.clearExpectedProcessExit(serviceKey, child);
          return;
        }

        const message = `${name} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
        this.logger.error(message);
        this.running = false;
        this.startPromise = null;
        this.expectedProcessExits[serviceKey] = null;
        this.updateState({
          status: 'failed',
          message,
          error: message,
          logDir,
        });
        this.emit('runtime-error', new Error(message));
      });
    };

    attachHandler('python', this.pythonProcess, 'Python chart service');
    attachHandler('java', this.javaProcess, 'Java backend');
  }

  async cleanupProcesses() {
    const pythonProcess = this.pythonProcess;
    const javaProcess = this.javaProcess;
    const logStreams = this.logStreams;

    this.logStreams = [];

    const closeTasks = [];
    if (pythonProcess && pythonProcess.pid) {
      closeTasks.push(killProcessTree(pythonProcess.pid, this.logger));
    }
    if (javaProcess && javaProcess.pid) {
      closeTasks.push(killProcessTree(javaProcess.pid, this.logger));
    }

    await Promise.all(closeTasks);

    for (const stream of logStreams) {
      await stream.close();
    }

    if (this.pythonProcess === pythonProcess) {
      this.pythonProcess = null;
    }
    if (this.javaProcess === javaProcess) {
      this.javaProcess = null;
    }
  }

  buildJavaArgs(layout, backendPort, chartPort, javaLogBase, options = {}) {
    const trustedRuntime = Boolean(options && options.trustedRuntime);
    const javaArgs = [
      `-Dhorosa.log.basedir=${javaLogBase}`,
      '-Dhorosa.mongo.serverSelectionTimeoutMS=180',
      '-Dhorosa.mongo.connectTimeoutMS=180',
      '-Dhorosa.mongo.readTimeoutMS=220',
    ];

    if (trustedRuntime) {
      javaArgs.push('-Dhorosa.trustedRuntime=true', '-Dhorosa.desktop.fastPath=true');
    }

    if (this.appCdsContext && ensureAppCdsCacheDir(this.appCdsContext, this.logger)) {
      if (isAppCdsArchiveReady(this.appCdsContext)) {
        javaArgs.push('-Xshare:auto', `-XX:SharedArchiveFile=${this.appCdsContext.archivePath}`);
      } else {
        javaArgs.push('-XX:+RecordDynamicDumpInfo');
      }
    }

    javaArgs.push(
      '-jar',
      layout.jarPath,
      `--server.port=${backendPort}`,
      `--astrosrv=http://127.0.0.1:${chartPort}`,
      '--mongodb.ip=127.0.0.1',
      '--mongodb.host=127.0.0.1',
      '--redis.ip=127.0.0.1',
      '--redis.pool.timeout=400',
      '--cachehelper.needcache=false',
      '--cachehelper.expireinsecond=300',
      '--paramhash.cache.enable=false',
      '--needtranslog=false',
      '--mongo.statement.log=false'
    );

    return javaArgs;
  }

  async start() {
    if (this.running) {
      return this.getState();
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = (async () => {
      const startupStartedAt = Date.now();
      let logDir = path.join(this.userDataDir, 'logs', 'runtime');

      try {
        const resourcePreparation = await this.ensurePackagedPayloadReady();
        const layout = this.resolveLayout();
        const runtimeTrustContext = this.getTrustedRuntimeContext(layout, resourcePreparation);
        const trustedRuntime = runtimeTrustContext.trusted;
        const readyTimeoutMs = trustedRuntime ? TRUSTED_FAST_PATH_READY_TIMEOUT_MS : STARTUP_READY_TIMEOUT_MS;
        this.layout = layout;
        const javaLogBase = path.join(logDir, 'java');
        ensureDir(logDir);
        ensureDir(javaLogBase);

        const pythonLog = path.join(logDir, 'python.log');
        const javaLog = path.join(logDir, 'java.log');
        const [chartPort, backendPort] = await Promise.all([findPort(8899), findPort(9999)]);
        this.appCdsContext = getAppCdsContext(layout.runtimeWindowsDir, layout.javaExe, layout.jarPath);
        this.shuttingDown = false;
        this.updateState({
          status: 'starting-python',
          message: '正在启动 Python 本地服务',
          logDir,
          trustedRuntimeCandidate: trustedRuntime,
        });

        const pythonBootstrap = [
          'import os, runpy, sys',
          `os.chdir(${JSON.stringify(layout.projectRoot)})`,
          `sys.path[0:0]=[${JSON.stringify(layout.astropyDir)}, ${JSON.stringify(layout.flatlibDir)}]`,
          `runpy.run_path(${JSON.stringify(layout.chartScript)}, run_name='__main__')`,
        ].join('; ');
        const mongoFallbackDir = path.join(this.userDataDir, 'mongo-fallback');
        ensureDir(mongoFallbackDir);

        const pythonEnv = {
          ...process.env,
          HOROSA_CHART_PORT: String(chartPort),
          HOROSA_SWEPH_PATH: layout.swephDir,
          PYTHONPATH: [layout.astropyDir, layout.flatlibDir].join(path.delimiter),
          PYTHONUTF8: '1',
          SE_EPHE_PATH: layout.swephDir,
          HOROSA_REQUIRE_EMBEDDED_RUNTIME: '1',
          HOROSA_TRUSTED_RUNTIME: trustedRuntime ? '1' : '0',
          HOROSA_SKIP_RUNTIME_WARMUP: trustedRuntime ? '1' : '0',
          HOROSA_DESKTOP_MONGO_OPTIONAL: '1',
          HOROSA_DESKTOP_MONGO_SKIP_PING: trustedRuntime ? '1' : '0',
          HOROSA_MONGO_FALLBACK_DIR: mongoFallbackDir,
        };

        this.pythonProcess = spawn(layout.pythonExe, ['-c', pythonBootstrap], {
          cwd: layout.projectRoot,
          env: pythonEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        this.logStreams.push(pipeChildOutput(this.pythonProcess, pythonLog));

        this.updateState({
          status: 'starting-java',
          message: '正在启动 Java 本地服务',
          chartPort,
          logDir,
          trustedRuntimeCandidate: trustedRuntime,
        });

        const javaArgs = this.buildJavaArgs(layout, backendPort, chartPort, javaLogBase, { trustedRuntime });
        this.javaProcess = spawn(layout.javaExe, javaArgs, {
          cwd: layout.projectRoot,
          env: {
            ...process.env,
            HOROSA_CHART_PORT: String(chartPort),
            HOROSA_SERVER_PORT: String(backendPort),
            HOROSA_REQUIRE_EMBEDDED_RUNTIME: '1',
            HOROSA_TRUSTED_RUNTIME: trustedRuntime ? '1' : '0',
            HOROSA_SKIP_RUNTIME_WARMUP: trustedRuntime ? '1' : '0',
            HOROSA_DESKTOP_MONGO_OPTIONAL: '1',
            HOROSA_DESKTOP_MONGO_SKIP_PING: trustedRuntime ? '1' : '0',
            HOROSA_MONGO_FALLBACK_DIR: mongoFallbackDir,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        this.logStreams.push(pipeChildOutput(this.javaProcess, javaLog));

        this.attachUnexpectedExitHandlers(logDir);
        await Promise.all([waitForPort(chartPort, 60000), waitForPort(backendPort, 60000)]);
        this.updateState({
          status: 'verifying-runtime',
          message: trustedRuntime ? '正在走可信 fast-path 验证本地服务' : '正在验证本地服务可用性',
          backendPort,
          chartPort,
          logDir,
          trustedRuntimeCandidate: trustedRuntime,
        });
        const [backendProbe, chartProbe] = await Promise.all([
          waitForBackendHeartbeat(`http://127.0.0.1:${backendPort}`, readyTimeoutMs),
          waitForChartProbe(chartPort, readyTimeoutMs),
        ]);
        this.persistRuntimeCaches({
          fingerprint: runtimeTrustContext.fingerprint,
          readinessChecks: {
            backendHeartbeat: backendProbe,
            chartProbe,
          },
          resourcePreparation,
          startupDurationMs: Date.now() - startupStartedAt,
          trustedRuntime: true,
        });

        this.running = true;
        this.updateState({
          status: 'ready',
          message: '本地服务已就绪',
          backendPort,
          chartPort,
          serverRoot: `http://127.0.0.1:${backendPort}`,
          logDir,
          logFiles: {
            python: pythonLog,
            java: javaLog,
          },
          readinessChecks: {
            backendHeartbeat: backendProbe,
            chartProbe,
          },
          resourceRoot: this.getResolvedResourceRoot(),
          packagedResourceRoot: this.resourceRoot,
          resourcePreparation,
          trustedRuntime,
          runtimeFingerprintId: runtimeTrustContext.fingerprint.id,
          runtimeCachePaths: {
            health: this.getRuntimeHealthCachePath(),
            fastPath: this.getRuntimeFastPathPath(),
          },
          startupDurationMs: Date.now() - startupStartedAt,
          appCds: this.appCdsContext
            ? {
                enabled: true,
                archivePath: this.appCdsContext.archivePath,
                state: isAppCdsArchiveReady(this.appCdsContext) ? 'ready' : 'recording',
              }
            : {
                enabled: false,
              },
        });
        this.logger.info('Local runtime ready', this.state);
        return this.getState();
      } catch (error) {
        await this.cleanupProcesses();
        this.running = false;
        this.updateState({
          status: 'failed',
          message: `本地服务启动失败：${error.message}`,
          error: error.message,
          logDir,
        });
        throw new Error(`Local runtime startup failed. Check logs in ${logDir}. ${error.message}`);
      }
    })();

    try {
      return await this.startPromise;
    } finally {
      if (!this.running) {
        this.startPromise = null;
      }
    }
  }

  async restart() {
    await this.stop('restart');
    this.updateState({
      status: 'starting-window',
      message: '正在重新准备本地服务',
    });
    return this.start();
  }

  async repairPreparedRuntime() {
    await this.stop('repair');

    const manifest = this.readPackedPayloadManifest();
    if (!manifest) {
      rmrf(this.getRuntimeHealthCachePath());
      rmrf(this.getRuntimeFastPathPath());
      this.updateState({
        status: 'starting-window',
        message: '已清理本地服务缓存，正在重新启动',
      });
      return this.start();
    }

    const targetRoot = this.getPackedPayloadCacheRoot(manifest);
    this.updateState({
      status: 'repairing-runtime',
      message: '正在自检并修复内置运行时缓存',
      packagedPayload: true,
      payloadId: manifest.payloadId,
      repairTarget: targetRoot,
    });

    if (this.logger) {
      this.logger.warn('Repairing embedded runtime cache before restart', {
        targetRoot,
        payloadId: manifest.payloadId,
      });
    }

    rmrf(targetRoot);
    rmrf(`${targetRoot}.repair`);
    rmrf(this.getRuntimeHealthCachePath());
    rmrf(this.getRuntimeFastPathPath());
    this.resolvedResourceRoot = this.resourceRoot;
    this.layout = null;
    this.appCdsContext = null;

    this.updateState({
      status: 'starting-window',
      message: '已完成运行时缓存修复，正在重新启动',
      packagedPayload: true,
      payloadId: manifest.payloadId,
    });

    return this.start();
  }

  async stop(reason = 'stop') {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.shuttingDown = true;
    this.updateState({ status: 'stopping', message: '正在关闭本地服务' });

    this.stopPromise = withTimeout(
      (async () => {
        this.markExpectedProcessExit('python', this.pythonProcess, reason);
        this.markExpectedProcessExit('java', this.javaProcess, reason);

        if (
          this.javaProcess &&
          this.javaProcess.pid &&
          this.appCdsContext &&
          this.layout &&
          !isAppCdsArchiveReady(this.appCdsContext)
        ) {
          try {
            await this.performAppCdsDynamicDump();
          } catch (error) {
            this.logger.warn('AppCDS dynamic dump failed before shutdown cleanup', error.message);
          }
        }

        await this.cleanupProcesses();
        this.running = false;
        this.startPromise = null;
        this.appCdsContext = null;
        this.layout = null;
        this.expectedProcessExits.python = null;
        this.expectedProcessExits.java = null;
        this.updateState({
          status: 'stopped',
          message: '本地服务已停止',
        });
      })(),
      STOP_TIMEOUT_MS,
      'Timed out while stopping local runtime'
    )
      .catch((error) => {
        this.logger.warn('Runtime stop timed out', error.message);
      })
      .finally(() => {
        this.running = false;
        this.startPromise = null;
        this.stopPromise = null;
      });

    return this.stopPromise;
  }

  getState() {
    return {
      ...this.state,
    };
  }

  async performAppCdsDynamicDump() {
    if (
      !this.javaProcess ||
      !this.javaProcess.pid ||
      !this.appCdsContext ||
      !this.layout ||
      isAppCdsArchiveReady(this.appCdsContext)
    ) {
      return {
        status: 'skipped',
        reason: 'not-applicable',
      };
    }

    return invokeAppCdsDynamicDump(
      this.javaProcess.pid,
      this.appCdsContext,
      this.layout.javaExe,
      this.logger
    );
  }
}

module.exports = {
  classifyProcessExit,
  waitForBackendHeartbeat,
  RuntimeManager,
};
