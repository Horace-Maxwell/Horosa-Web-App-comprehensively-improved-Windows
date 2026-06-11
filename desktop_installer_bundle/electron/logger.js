const fs = require('fs');
const path = require('path');

function isBrokenConsolePipe(error) {
  return Boolean(error && (error.code === 'EPIPE' || error.code === 'EBADF'));
}

function attachConsolePipeGuard(stream) {
  if (!stream || stream.__horosaPipeGuarded) {
    return;
  }
  stream.__horosaPipeGuarded = true;
  stream.on('error', (error) => {
    if (!isBrokenConsolePipe(error)) {
      throw error;
    }
  });
}

attachConsolePipeGuard(process.stdout);
attachConsolePipeGuard(process.stderr);

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

// Size-capped single-generation rotation: <file> -> <file>.1 (replacing any
// previous .1). Both the desktop log and the python/java service logs are
// opened in append mode with no cap, so a long-lived install otherwise grows
// them without bound (multi-GB after a year of daily use). One rotated
// generation bounds total disk while keeping the tail that explains the
// previous session/crash. Contract: NEVER throws — logging hygiene must not
// be able to break startup.
function rotateLogIfLarge(filePath, maxBytes) {
  try {
    const stats = fs.statSync(filePath); // ENOENT -> outer catch -> false
    if (!stats.isFile() || stats.size <= maxBytes) {
      return false;
    }
    const rotatedPath = `${filePath}.1`;
    try {
      fs.rmSync(rotatedPath, { force: true });
    } catch (_error) {
      // rename below replaces the target anyway on most failures
    }
    try {
      fs.renameSync(filePath, rotatedPath);
      return true;
    } catch (_error) {
      // EPERM/EBUSY (AV scan or a lingering handle): keep the history via
      // copy, then empty the live file in place — truncate works where
      // rename is blocked.
      fs.copyFileSync(filePath, rotatedPath);
      fs.truncateSync(filePath, 0);
      return true;
    }
  } catch (_error) {
    return false;
  }
}

const MAX_MAIN_LOG_BYTES = 20 * 1024 * 1024;

function formatMessage(level, scope, args) {
  const text = args
    .map((item) => {
      if (item instanceof Error) {
        return `${item.message}\n${item.stack || ''}`.trim();
      }
      if (typeof item === 'object') {
        try {
          return JSON.stringify(item);
        } catch (_error) {
          return String(item);
        }
      }
      return String(item);
    })
    .join(' ');
  return `[${new Date().toISOString()}] [${level}] [${scope}] ${text}`;
}

function createLogger(logDir, scope = 'main') {
  ensureDir(logDir);
  const logFile = path.join(logDir, 'horosa-desktop.log');
  if (scope === 'main') {
    // Root logger only — child() recurses through createLogger and must not
    // re-rotate mid-session. Safe here: writes go through appendFileSync (no
    // held stream), and the root logger is created in bootstrap() strictly
    // after the single-instance lock, so no concurrent writer exists.
    rotateLogIfLarge(logFile, MAX_MAIN_LOG_BYTES);
  }

  function write(level, args) {
    const line = formatMessage(level, scope, args);
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
    const sink = level === 'ERROR' ? console.error : console.log;
    try {
      sink(line);
    } catch (error) {
      if (!isBrokenConsolePipe(error)) {
        throw error;
      }
    }
  }

  return {
    logFile,
    child(childScope) {
      return createLogger(logDir, `${scope}:${childScope}`);
    },
    info(...args) {
      write('INFO', args);
    },
    warn(...args) {
      write('WARN', args);
    },
    error(...args) {
      write('ERROR', args);
    },
  };
}

module.exports = {
  createLogger,
  rotateLogIfLarge,
};
