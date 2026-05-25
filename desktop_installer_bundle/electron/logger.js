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
};
