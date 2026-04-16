const fs = require('fs');
const os = require('os');
const path = require('path');
const { RuntimeManager } = require('../electron/service-manager');

function readArg(name, fallback = '') {
  const prefix = `${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function createLogger(scope = 'runtime') {
  const prefix = `[${scope}]`;
  const logger = {
    child(childScope) {
      return createLogger(`${scope}:${childScope}`);
    },
    info(...args) {
      console.log(prefix, ...args);
    },
    warn(...args) {
      console.warn(prefix, ...args);
    },
    error(...args) {
      console.error(prefix, ...args);
    },
  };
  return logger;
}

async function main() {
  const resourceRoot = path.resolve(
    readArg('--resource-root', path.join(__dirname, '..', 'build', 'app-runtime'))
  );
  const userDataDir = path.resolve(
    readArg('--user-data-dir', path.join(os.tmpdir(), `horosa-runtime-${Date.now()}`))
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const logger = createLogger('standalone-runtime');
  const manager = new RuntimeManager({
    resourceRoot,
    userDataDir,
    logger,
  });

  let stopping = false;
  const stopAndExit = async (reason, code) => {
    if (stopping) {
      return;
    }
    stopping = true;
    try {
      await manager.stop(reason);
    } catch (error) {
      logger.warn('runtime stop failed', error && error.message ? error.message : error);
    } finally {
      process.exit(code);
    }
  };

  process.on('SIGINT', () => {
    stopAndExit('sigint', 0);
  });
  process.on('SIGTERM', () => {
    stopAndExit('sigterm', 0);
  });
  process.on('uncaughtException', (error) => {
    logger.error('uncaught exception', error && error.stack ? error.stack : error);
    stopAndExit('uncaughtException', 1);
  });
  process.on('unhandledRejection', (error) => {
    logger.error('unhandled rejection', error && error.stack ? error.stack : error);
    stopAndExit('unhandledRejection', 1);
  });

  const state = await manager.start();
  console.log(`HOROSA_RUNTIME_READY ${JSON.stringify(state)}`);

  setInterval(() => {
    const current = manager.getState();
    if (current && current.status === 'ready') {
      return;
    }
    logger.warn('runtime state changed', current);
  }, 10000).unref();
}

main().catch((error) => {
  console.error('[standalone-runtime] failed', error && error.stack ? error.stack : error);
  process.exit(1);
});
