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

// --- Embedded-runtime environment isolation ---------------------------------
// The bundled Python and Java are fully self-contained. If we let them inherit
// the host's ENTIRE environment, a machine that has its own Python/Java tooling
// configured will poison our interpreters: a user-set PYTHONHOME makes the
// embedded Python load the wrong stdlib and die instantly ("Fatal Python error:
// init_fs_encoding ... ModuleNotFoundError: No module named 'encodings'"), and a
// host _JAVA_OPTIONS / JAVA_TOOL_OPTIONS / JDK_JAVA_OPTIONS injects JVM flags
// that abort startup. The backend then crashes the moment it launches, so the
// desktop app never becomes usable -- but ONLY on that machine, which is exactly
// why it slips past clean-VM testing. (GitHub issue #2: "Windows 11 cannot run"
// reported on a box with system Python on PATH.)
//
// We therefore strip every host variable that can redirect/poison the embedded
// runtime before spawning it. The Python interpreter is ALSO launched with
// `-E -s` (see buildPythonRuntimeArgs) so it ignores PYTHON* at the C level even
// if some new variable is ever missed by this allow-list. Any future check for
// this class of bug lives in release_selfcheck.py + service-manager.test.js.
const HOST_JAVA_POISON_ENV_VARS = [
  '_JAVA_OPTIONS',
  'JAVA_TOOL_OPTIONS',
  'JDK_JAVA_OPTIONS',
  'JAVA_OPTS',
  'JAVA_COMPILER',
  'CLASSPATH',
  '_JAVA_SR_SIGNUM',
];

function sanitizeEmbeddedRuntimeEnv(overrides = {}, kind = 'python') {
  const env = { ...process.env };
  if (kind === 'python') {
    // Drop EVERY host PYTHON* variable (PYTHONHOME, PYTHONPATH, PYTHONSTARTUP,
    // PYTHONPLATLIBDIR, PYTHON_GIL, ...). The few we actually want
    // (PYTHONPATH / PYTHONNOUSERSITE / PYTHONUTF8) are re-applied via overrides.
    for (const key of Object.keys(env)) {
      if (/^PYTHON/i.test(key)) {
        delete env[key];
      }
    }
  } else if (kind === 'java') {
    // Env-var names are case-insensitive on Windows; match defensively.
    for (const key of Object.keys(env)) {
      if (HOST_JAVA_POISON_ENV_VARS.includes(key.toUpperCase())) {
        delete env[key];
      }
    }
  }
  return { ...env, ...overrides };
}

// Interpreter-level isolation flags for the embedded Python:
//   -E        ignore all PYTHON* env vars (incl. a host PYTHONHOME) during init
//   -s        skip the per-user site-packages dir (embedded site-packages still load)
//   -X utf8   force UTF-8 mode regardless of host locale / PYTHONUTF8
// These replace relying solely on env hygiene and make the interpreter immune to
// host contamination even if the env allow-list is ever incomplete.
function buildPythonRuntimeArgs(extraArgs = []) {
  return ['-E', '-s', '-X', 'utf8', ...extraArgs];
}

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

// GitHub issue #7 ("windows版安装运行不了" / "Embedded runtime prepare failed: spawn tar ENOENT"):
// the payload is extracted with the OS `tar` (Windows 10 1803+/11 ship bsdtar at System32\tar.exe).
// Spawning a bare `tar` relies on PATH/PATHEXT resolution, which fails on some machines (stripped or
// non-standard PATH, security tooling, etc.) -> ENOENT -> the runtime never prepares -> the app can't
// launch. Resolve the absolute path to the built-in tar first; only fall back to a PATH lookup.
function resolveTarExe() {
  const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const candidates = [
    path.join(sysRoot, 'System32', 'tar.exe'),
    path.join(sysRoot, 'Sysnative', 'tar.exe'), // 32-bit process on 64-bit Windows
    path.join(sysRoot, 'tar.exe'),
  ];
  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return 'tar'; // last resort: rely on PATH (and surface a clear error if it is missing)
}

async function extractTarArchive(archivePath, targetDir) {
  const tarExe = resolveTarExe();
  try {
    await runCommand(tarExe, ['-xf', archivePath, '-C', targetDir], {
      timeoutMs: RESOURCE_PREP_TIMEOUT_MS,
    });
  } catch (error) {
    if (error && (error.code === 'ENOENT' || /ENOENT/.test(String(error.message)))) {
      throw new Error(
        `Could not run the Windows archive tool (tar). Tried "${tarExe}". ` +
        'Windows 10 (1803+) and Windows 11 include it at %SystemRoot%\\System32\\tar.exe; ' +
        'ensure that file exists and System32 is on PATH. Original error: ' +
        (error && error.message ? error.message : String(error))
      );
    }
    throw error;
  }
}

function getJavaVersionText(javaExe) {
  const result = spawnSync(javaExe, ['-version'], {
    windowsHide: true,
    encoding: 'utf8',
    env: sanitizeEmbeddedRuntimeEnv({}, 'java'),
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
      env: sanitizeEmbeddedRuntimeEnv({}, 'java'),
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

function readLogTail(logPath, maxLines = 14) {
  try {
    if (!logPath || !fs.existsSync(logPath)) {
      return '';
    }
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return '';
    }
    return lines.slice(-maxLines).join('\n');
  } catch (error) {
    return '';
  }
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
    this.lastCrashMessage = null;
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
    const shortPayloadId = String(manifest.payloadId).slice(0, 16);
    const getRuntimePathProbes = (root) => [
      path.join(
        root,
        'runtime',
        'windows',
        'python',
        'Lib',
        'site-packages',
        'jaraco',
        'collections',
        '__init__.py'
      ),
      path.join(
        root,
        'runtime',
        'windows',
        'python',
        'Lib',
        'site-packages',
        'astropy',
        'coordinates',
        'builtin_frames',
        'intermediate_rotation_transforms.py'
      ),
    ];
    const getLongestProbe = (root) => getRuntimePathProbes(root).reduce((longest, probe) => (
      probe.length > longest.length ? probe : longest
    ), '');
    const isSafeRuntimeRoot = (root) => getRuntimePathProbes(root).every((probe) => (
      probe.length <= WINDOWS_SAFE_RUNTIME_PATH_LENGTH
    ));

    const defaultRoot = path.join(this.userDataDir, 'embedded-runtime', manifest.payloadId);
    if (isSafeRuntimeRoot(defaultRoot)) {
      return defaultRoot;
    }

    const fallbackCandidates = [
      process.env.HOROSA_DESKTOP_RUNTIME_CACHE_DIR,
      process.env.HOROSA_RUNTIME_CACHE_DIR,
      path.join(os.tmpdir(), 'HorosaRt'),
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'HorosaRt') : '',
      path.join(os.homedir(), '.horosa-rt'),
    ].filter(Boolean).map((cacheBase) => path.join(cacheBase, shortPayloadId));
    const fallbackRoot = fallbackCandidates.find(isSafeRuntimeRoot) || fallbackCandidates[0];
    const longestDefaultProbe = getLongestProbe(defaultRoot);
    const longestFallbackProbe = getLongestProbe(fallbackRoot);
    if (this.logger) {
      this.logger.warn('Embedded runtime cache path is long; using short fallback path', {
        defaultRoot,
        fallbackRoot,
        probeLength: longestDefaultProbe.length,
        fallbackProbeLength: longestFallbackProbe.length,
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

        // A service crashed on its own. Mark teardown so the sibling's forced
        // shutdown is treated as planned (not a second independent crash) — this
        // is why the same root cause previously surfaced sometimes as "Python
        // ... exited" and sometimes as "Java ... exited". Also surface the tail
        // of the crashed service's log so the real cause (e.g. an ImportError)
        // is visible instead of just an exit code.
        this.shuttingDown = true;
        const summary = `${name} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
        const logPath = path.join(logDir, serviceKey === 'python' ? 'python.log' : 'java.log');
        const tail = readLogTail(logPath);
        const message = tail ? `${summary}\n--- ${name} log tail ---\n${tail}` : summary;
        this.logger.error(summary);
        this.running = false;
        this.startPromise = null;
        this.expectedProcessExits[serviceKey] = null;
        this.lastCrashMessage = message;

        const sibling = serviceKey === 'python' ? this.javaProcess : this.pythonProcess;
        if (sibling && sibling.pid) {
          killProcessTree(sibling.pid, this.logger).catch(() => {});
        }

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
    // Killing the services always means we are tearing down; mark it so their
    // exit handlers classify the termination as planned rather than a crash.
    this.shuttingDown = true;
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
      '-Dhorosa.desktop.fastPath=true',
      '-Dhorosa.mongo.serverSelectionTimeoutMS=180',
      '-Dhorosa.mongo.connectTimeoutMS=180',
      '-Dhorosa.mongo.readTimeoutMS=220',
    ];

    if (trustedRuntime) {
      javaArgs.push('-Dhorosa.trustedRuntime=true');
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
      '--astrohelper.disable.request.cache=true',
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
        const runtimeHomeDir = process.env.HOME || process.env.USERPROFILE || this.userDataDir;
        ensureDir(runtimeHomeDir);
        this.appCdsContext = getAppCdsContext(layout.runtimeWindowsDir, layout.javaExe, layout.jarPath);
        this.shuttingDown = false;
        this.lastCrashMessage = null;
        this.updateState({
          status: 'starting-python',
          message: '正在启动 Python 本地服务',
          logDir,
          trustedRuntimeCandidate: trustedRuntime,
        });

        const pythonBootstrap = [
          'import os, runpy, sys',
          `os.chdir(${JSON.stringify(layout.projectRoot)})`,
          'sys.path[:] = [p for p in sys.path if p not in ("", os.getcwd())]',
          `sys.path[0:0]=[${JSON.stringify(layout.astropyDir)}, ${JSON.stringify(layout.flatlibDir)}]`,
          `runpy.run_path(${JSON.stringify(layout.chartScript)}, run_name='__main__')`,
        ].join('; ');
        const mongoFallbackDir = path.join(this.userDataDir, 'mongo-fallback');
        ensureDir(mongoFallbackDir);

        const pythonEnv = sanitizeEmbeddedRuntimeEnv(
          {
            HOME: runtimeHomeDir,
            HOROSA_CHART_PORT: String(chartPort),
            HOROSA_SWISSEPH_PATH: layout.swephDir,
            HOROSA_SWEPH_PATH: layout.swephDir,
            PYTHONPATH: [layout.astropyDir, layout.flatlibDir].join(path.delimiter),
            PYTHONNOUSERSITE: '1',
            PYTHONUTF8: '1',
            SE_EPHE_PATH: layout.swephDir,
            HOROSA_REQUIRE_EMBEDDED_RUNTIME: '1',
            HOROSA_TRUSTED_RUNTIME: trustedRuntime ? 'true' : 'false',
            HOROSA_SKIP_RUNTIME_WARMUP: trustedRuntime ? 'true' : 'false',
            HOROSA_DESKTOP_MONGO_OPTIONAL: '1',
            HOROSA_DESKTOP_MONGO_SKIP_PING: 'true',
            HOROSA_MONGO_FALLBACK_DIR: mongoFallbackDir,
          },
          'python'
        );

        this.pythonProcess = spawn(layout.pythonExe, buildPythonRuntimeArgs(['-c', pythonBootstrap]), {
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
          env: sanitizeEmbeddedRuntimeEnv(
            {
              HOME: runtimeHomeDir,
              HOROSA_CHART_PORT: String(chartPort),
              HOROSA_SERVER_PORT: String(backendPort),
              HOROSA_SWISSEPH_PATH: layout.swephDir,
              HOROSA_SWEPH_PATH: layout.swephDir,
              SE_EPHE_PATH: layout.swephDir,
              HOROSA_REQUIRE_EMBEDDED_RUNTIME: '1',
              HOROSA_TRUSTED_RUNTIME: trustedRuntime ? 'true' : 'false',
              HOROSA_SKIP_RUNTIME_WARMUP: trustedRuntime ? 'true' : 'false',
              HOROSA_DESKTOP_MONGO_OPTIONAL: '1',
              HOROSA_DESKTOP_MONGO_SKIP_PING: 'true',
              HOROSA_MONGO_FALLBACK_DIR: mongoFallbackDir,
            },
            'java'
          ),
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
        const backendProbePromise = Promise.resolve({
          ok: true,
          statusCode: 0,
          bodyExcerpt: trustedRuntime ? 'trusted runtime port probe' : 'desktop runtime port probe',
          acceptedPortProbe: true,
        });
        const [backendProbe, chartProbe] = await Promise.all([
          backendProbePromise,
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
        // Prefer the specific crash message (with log tail) captured by the
        // exit handler over the generic port/timeout error, so the UI shows the
        // real root cause instead of a downstream symptom.
        const crashMessage = this.lastCrashMessage;
        this.lastCrashMessage = null;
        this.updateState({
          status: 'failed',
          message: crashMessage || `本地服务启动失败：${error.message}`,
          error: crashMessage || error.message,
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
  sanitizeEmbeddedRuntimeEnv,
  buildPythonRuntimeArgs,
  resolveTarExe,
  RuntimeManager,
};
