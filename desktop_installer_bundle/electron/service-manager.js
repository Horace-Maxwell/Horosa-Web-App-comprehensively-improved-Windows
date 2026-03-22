const crypto = require('crypto');
const { EventEmitter } = require('events');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const STOP_WAIT_INTERVAL_MS = 250;
const STOP_WAIT_TIMEOUT_MS = 8000;
const APP_CDS_DUMP_TIMEOUT_MS = 2500;

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

function sleep(timeoutMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

function processExists(pid) {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

async function waitForProcessExit(pid, timeoutMs = STOP_WAIT_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (processExists(pid)) {
    if (Date.now() - startedAt >= timeoutMs) {
      return false;
    }
    await sleep(STOP_WAIT_INTERVAL_MS);
  }
  return true;
}

function killProcessTree(pid, logger) {
  if (!pid) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.once('exit', () => {
      (async () => {
        const stopped = await waitForProcessExit(pid);
        if (stopped) {
          logger.info('Stopped child process tree', { pid });
        } else {
          logger.warn('Process still present after taskkill timeout', { pid, timeoutMs: STOP_WAIT_TIMEOUT_MS });
        }
        resolve();
      })().catch(() => resolve());
    });
    killer.once('error', (error) => {
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
  return stream;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
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

function invokeAppCdsDynamicDump(processId, context, javaExe, logger) {
  if (!context || processId <= 0 || isAppCdsArchiveReady(context)) {
    return false;
  }

  const jcmdExe = getJcmdPath(javaExe);
  if (!jcmdExe) {
    logger.warn('AppCDS dynamic dump skipped because jcmd.exe is unavailable');
    return false;
  }

  if (!ensureAppCdsCacheDir(context, logger)) {
    return false;
  }

  let result;
  try {
    result = spawnSync(jcmdExe, [String(processId), 'VM.cds', 'dynamic_dump', context.archivePath], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: APP_CDS_DUMP_TIMEOUT_MS,
    });
  } catch (error) {
    logger.warn('AppCDS dynamic dump failed to execute', error.message);
    return false;
  }

  if (result.error) {
    logger.warn('AppCDS dynamic dump returned an execution error', {
      message: result.error.message,
      timedOut: result.error.code === 'ETIMEDOUT',
      timeoutMs: APP_CDS_DUMP_TIMEOUT_MS,
    });
    return false;
  }

  if (isAppCdsArchiveReady(context)) {
    logger.info('AppCDS dynamic dump completed', context.archivePath);
    return true;
  }

  const stderr = `${result.stderr || ''}`.trim();
  const stdout = `${result.stdout || ''}`.trim();
  logger.warn('AppCDS dynamic dump did not produce a usable archive', stdout || stderr || 'unknown result');
  return false;
}

function classifyProcessExit({ child, activeChild, shuttingDown, expectedExit }) {
  if (!child) {
    return {
      unexpected: false,
      planned: false,
      stale: false,
      reason: null,
    };
  }

  if (expectedExit) {
    return {
      unexpected: false,
      planned: true,
      stale: false,
      reason: expectedExit.reason || 'planned-stop',
    };
  }

  if (shuttingDown) {
    return {
      unexpected: false,
      planned: true,
      stale: false,
      reason: 'manager-shutting-down',
    };
  }

  if (!activeChild || activeChild !== child) {
    return {
      unexpected: false,
      planned: false,
      stale: true,
      reason: 'stale-process-exit',
    };
  }

  return {
    unexpected: true,
    planned: false,
    stale: false,
    reason: 'unexpected-process-exit',
  };
}

class RuntimeManager extends EventEmitter {
  constructor({ resourceRoot, userDataDir, logger }) {
    super();
    this.resourceRoot = resourceRoot;
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
    this.expectedProcessExits = new WeakMap();
    this.state = {
      status: 'idle',
      message: '等待启动本地服务',
    };
  }

  resolveLayout() {
    const runtimeWindowsDir = path.join(this.resourceRoot, 'runtime', 'windows');
    const bundleRoot = path.join(runtimeWindowsDir, 'bundle');
    const projectRoot = path.join(this.resourceRoot, 'project');

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

  updateState(nextState) {
    this.state = {
      ...this.state,
      ...nextState,
    };
    this.emit('state', this.state);
  }

  attachUnexpectedExitHandlers(logDir) {
    const attachChildExitHandler = (kind, name, attachedChild) => {
      attachedChild.once('exit', (code, signal) => {
        const child = kind === 'python' ? this.pythonProcess : this.javaProcess;
        const expectedExit = attachedChild ? this.expectedProcessExits.get(attachedChild) : null;
        if (attachedChild && expectedExit) {
          this.expectedProcessExits.delete(attachedChild);
        }

        const exitState = classifyProcessExit({
          child: attachedChild,
          activeChild: child,
          shuttingDown: this.shuttingDown,
          expectedExit,
        });

        if (exitState.planned) {
          this.logger.info('Child process exited during planned shutdown', {
            kind,
            pid: attachedChild && attachedChild.pid ? attachedChild.pid : null,
            code: code ?? null,
            signal: signal ?? null,
            reason: exitState.reason,
          });
          return;
        }

        if (exitState.stale) {
          this.logger.info('Ignoring stale child exit after process replacement', {
            kind,
            pid: attachedChild && attachedChild.pid ? attachedChild.pid : null,
            code: code ?? null,
            signal: signal ?? null,
          });
          return;
        }

        const message = `${name} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
        this.logger.error(message);
        this.running = false;
        this.startPromise = null;
        this.updateState({
          status: 'failed',
          message,
          error: message,
          logDir,
        });
        this.emit('runtime-error', new Error(message));
      });
    };
    attachChildExitHandler('python', 'Python chart service', this.pythonProcess);
    attachChildExitHandler('java', 'Java backend', this.javaProcess);
  }

  markExpectedProcessExit(kind, child, reason) {
    if (!child) {
      return;
    }

    this.expectedProcessExits.set(child, {
      kind,
      reason,
      markedAt: Date.now(),
      pid: child.pid || null,
    });
  }

  async cleanupProcesses(reason = 'stop') {
    const closeTasks = [];
    const pythonPid = this.pythonProcess && this.pythonProcess.pid ? this.pythonProcess.pid : null;
    const javaPid = this.javaProcess && this.javaProcess.pid ? this.javaProcess.pid : null;

    if (pythonPid) {
      this.markExpectedProcessExit('python', this.pythonProcess, reason);
      closeTasks.push(killProcessTree(pythonPid, this.logger));
    }
    if (javaPid) {
      this.markExpectedProcessExit('java', this.javaProcess, reason);
      closeTasks.push(killProcessTree(javaPid, this.logger));
    }

    await Promise.all(closeTasks);

    for (const stream of this.logStreams) {
      stream.end();
    }
    this.logStreams = [];
    this.pythonProcess = null;
    this.javaProcess = null;
  }

  buildJavaArgs(layout, backendPort, chartPort, javaLogBase) {
    const javaArgs = [
      `-Dhorosa.log.basedir=${javaLogBase}`,
      '-Dhorosa.mongo.serverSelectionTimeoutMS=180',
      '-Dhorosa.mongo.connectTimeoutMS=180',
      '-Dhorosa.mongo.readTimeoutMS=220',
    ];

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
      '--needtranslog=false',
      '--mongo.statement.log=false'
    );

    return javaArgs;
  }

  async start() {
    if (this.stopPromise) {
      await this.stopPromise;
    }

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
        const layout = this.resolveLayout();
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
        });

        const pythonBootstrap = [
          'import os, runpy, sys',
          `os.chdir(${JSON.stringify(layout.projectRoot)})`,
          `sys.path[0:0]=[${JSON.stringify(layout.astropyDir)}, ${JSON.stringify(layout.flatlibDir)}]`,
          `runpy.run_path(${JSON.stringify(layout.chartScript)}, run_name='__main__')`,
        ].join('; ');

        const pythonEnv = {
          ...process.env,
          HOROSA_CHART_PORT: String(chartPort),
          HOROSA_SWEPH_PATH: layout.swephDir,
          PYTHONPATH: [layout.astropyDir, layout.flatlibDir].join(path.delimiter),
          PYTHONUTF8: '1',
          SE_EPHE_PATH: layout.swephDir,
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
        });

        const javaArgs = this.buildJavaArgs(layout, backendPort, chartPort, javaLogBase);
        this.javaProcess = spawn(layout.javaExe, javaArgs, {
          cwd: layout.projectRoot,
          env: {
            ...process.env,
            HOROSA_CHART_PORT: String(chartPort),
            HOROSA_SERVER_PORT: String(backendPort),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        this.logStreams.push(pipeChildOutput(this.javaProcess, javaLog));

        this.attachUnexpectedExitHandlers(logDir);
        await Promise.all([waitForPort(chartPort, 60000), waitForPort(backendPort, 60000)]);

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
          resourceRoot: this.resourceRoot,
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
        await this.cleanupProcesses('startup-cleanup');
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
    await this.stop({ reason: 'restart' });
    this.updateState({
      status: 'starting-window',
      message: '正在重新准备本地服务',
    });
    return this.start();
  }

  async stop(options = {}) {
    const { reason = 'stop' } = options;
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = (async () => {
      this.shuttingDown = true;
      this.logger.info('Stopping runtime', {
        pythonPid: this.pythonProcess && this.pythonProcess.pid ? this.pythonProcess.pid : null,
        javaPid: this.javaProcess && this.javaProcess.pid ? this.javaProcess.pid : null,
      });
      this.updateState({ status: 'stopping', message: '正在关闭本地服务' });

      if (
        this.javaProcess &&
        this.javaProcess.pid &&
        this.appCdsContext &&
        this.layout &&
        !isAppCdsArchiveReady(this.appCdsContext)
      ) {
        invokeAppCdsDynamicDump(this.javaProcess.pid, this.appCdsContext, this.layout.javaExe, this.logger);
      }

      await this.cleanupProcesses(reason);
      this.running = false;
      this.startPromise = null;
      this.layout = null;
      this.updateState({
        status: 'stopped',
        message: '本地服务已停止',
      });
      this.logger.info('Runtime stopped');
    })();

    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
      this.shuttingDown = false;
    }
  }

  getState() {
    return {
      ...this.state,
    };
  }
}

module.exports = {
  classifyProcessExit,
  RuntimeManager,
};
