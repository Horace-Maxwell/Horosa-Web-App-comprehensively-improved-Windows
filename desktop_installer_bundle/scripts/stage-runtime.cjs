const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { resolveProjectDir } = require('./resolve-project.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.join(repoRoot, 'local', 'workspace');
const projectDir = resolveProjectDir(workspaceRoot);
const runtimeWindowsDir = path.join(workspaceRoot, 'runtime', 'windows');
const stageRoot = path.join(repoRoot, 'desktop_installer_bundle', 'build', 'app-runtime');
const packedStageRoot = path.join(repoRoot, 'desktop_installer_bundle', 'build', 'app-runtime-packed');
const stageRuntimeDir = path.join(stageRoot, 'runtime', 'windows');
const stageProjectDir = path.join(stageRoot, 'project');
const packedPayloadDir = path.join(packedStageRoot, 'payload');
const sourceDistIndex = path.join(runtimeWindowsDir, 'bundle', 'dist-file', 'index.html');
const stagedDistIndex = path.join(stageRuntimeDir, 'bundle', 'dist-file', 'index.html');
const packedPayloadTar = path.join(packedPayloadDir, 'app-runtime.tar');
const runtimePruneTargets = [
  'python/Doc',
  'python/Tools',
  'python/Lib/test',
  'python/Lib/idlelib',
  'python/Lib/tkinter',
  'python/Lib/turtledemo',
  'python/tcl',
  'java/jmods',
  'java/include',
];

function rmrf(targetPath) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error && error.code === 'EPERM') {
      throw new Error(
        `Unable to refresh staged runtime because files are in use: ${targetPath}. ` +
        'Please close the running Horosa desktop window (or any process using desktop_installer_bundle/build/app-runtime) and retry.'
      );
    }
    throw error;
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyDir(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, {
    force: true,
    recursive: true,
  });
}

function collectPathStats(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return {
      files: 0,
      bytes: 0,
    };
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return {
      files: 1,
      bytes: stat.size,
    };
  }

  let files = 0;
  let bytes = 0;
  const stack = [targetPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      const entryStat = fs.statSync(entryPath);
      files += 1;
      bytes += entryStat.size;
    }
  }

  return { files, bytes };
}

function pruneRuntimePayload(rootDir) {
  const removed = [];
  for (const relativePath of runtimePruneTargets) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stats = collectPathStats(absolutePath);
    rmrf(absolutePath);
    removed.push({
      path: relativePath,
      files: stats.files,
      bytes: stats.bytes,
    });
  }
  return removed;
}

function prunePythonCaches(rootDir) {
  const removed = [];
  if (!fs.existsSync(rootDir)) {
    return removed;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__') {
          const stats = collectPathStats(entryPath);
          rmrf(entryPath);
          removed.push({
            path: path.relative(rootDir, entryPath).replace(/\\/g, '/'),
            files: stats.files,
            bytes: stats.bytes,
          });
          continue;
        }
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.pyc')) {
        const stats = collectPathStats(entryPath);
        fs.rmSync(entryPath, { force: true });
        removed.push({
          path: path.relative(rootDir, entryPath).replace(/\\/g, '/'),
          files: stats.files,
          bytes: stats.bytes,
        });
      }
    }
  }
  return removed;
}

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

function hashFile(targetPath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(targetPath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytesRead) {
        break;
      }
      hash.update(bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function createTarArchive(sourceRoot, outputPath, entries) {
  ensureDir(path.dirname(outputPath));
  const tarResult = spawnSync('tar', ['-cf', outputPath, '-C', sourceRoot, ...entries], {
    cwd: sourceRoot,
    windowsHide: true,
    encoding: 'utf8',
  });
  if (tarResult.status !== 0) {
    throw new Error(
      `Failed to create tar archive ${outputPath}: ${tarResult.stderr || tarResult.stdout || tarResult.error || 'unknown error'}`
    );
  }
}

function fmtMtime(targetPath) {
  try {
    return fs.statSync(targetPath).mtime.toISOString();
  } catch (error) {
    return 'missing';
  }
}

assertExists(runtimeWindowsDir, 'Runtime windows directory');

const requiredPaths = [
  [path.join(runtimeWindowsDir, 'bundle', 'astrostudyboot.jar'), 'Bundled backend jar'],
  [path.join(runtimeWindowsDir, 'bundle', 'dist-file', 'index.html'), 'Bundled frontend dist-file'],
  [path.join(runtimeWindowsDir, 'java', 'bin', 'java.exe'), 'Bundled Java runtime'],
  [path.join(runtimeWindowsDir, 'python', 'python.exe'), 'Bundled Python runtime'],
  [path.join(projectDir, 'astropy', 'websrv', 'webchartsrv.py'), 'Python chart service'],
  [path.join(projectDir, 'flatlib-ctrad2', 'flatlib', 'resources', 'swefiles'), 'Swiss ephemeris data'],
];

for (const [targetPath, label] of requiredPaths) {
  assertExists(targetPath, label);
}

console.log(`[stage:runtime] sourceDistIndex=${sourceDistIndex}`);
console.log(`[stage:runtime] sourceDistIndexMtime=${fmtMtime(sourceDistIndex)}`);

rmrf(stageRoot);
ensureDir(stageRoot);

copyDir(runtimeWindowsDir, stageRuntimeDir);
copyDir(path.join(projectDir, 'astropy'), path.join(stageProjectDir, 'astropy'));
copyDir(path.join(projectDir, 'flatlib-ctrad2'), path.join(stageProjectDir, 'flatlib-ctrad2'));
const prunedRuntimeEntries = pruneRuntimePayload(stageRuntimeDir);
const prunedProjectPyCaches = prunePythonCaches(stageProjectDir);

const manifest = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  projectDir,
  runtimeWindowsDir,
  sourceDistIndex,
  sourceDistIndexMtime: fmtMtime(sourceDistIndex),
  stagedDistIndex,
  prunedRuntimeEntries,
  prunedProjectPyCaches,
};

fs.writeFileSync(
  path.join(stageRoot, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

rmrf(packedStageRoot);
ensureDir(packedPayloadDir);
createTarArchive(stageRoot, packedPayloadTar, ['runtime', 'project']);
const packedPayloadStats = fs.statSync(packedPayloadTar);
const packedPayloadSha256 = hashFile(packedPayloadTar);
const packedManifest = {
  generatedAt: manifest.generatedAt,
  payloadId: crypto.createHash('sha1').update(`${packedPayloadSha256}:${packedPayloadStats.size}`).digest('hex'),
  sourceManifest: manifest,
  payload: {
    relativePath: path.relative(packedStageRoot, packedPayloadTar).replace(/\\/g, '/'),
    bytes: packedPayloadStats.size,
    sha256: packedPayloadSha256,
  },
};
fs.writeFileSync(
  path.join(packedStageRoot, 'payload-manifest.json'),
  JSON.stringify(packedManifest, null, 2),
  'utf8'
);

console.log(`[stage:runtime] stagedDistIndex=${stagedDistIndex}`);
console.log(`[stage:runtime] stagedDistIndexMtime=${fmtMtime(stagedDistIndex)}`);
if (prunedRuntimeEntries.length > 0) {
  const removedFiles = prunedRuntimeEntries.reduce((total, entry) => total + entry.files, 0);
  const removedBytes = prunedRuntimeEntries.reduce((total, entry) => total + entry.bytes, 0);
  console.log(
    `[stage:runtime] pruned ${prunedRuntimeEntries.length} dev-only payload paths, ${removedFiles} files, ${(removedBytes / (1024 * 1024)).toFixed(2)} MB`
  );
}
if (prunedProjectPyCaches.length > 0) {
  const removedFiles = prunedProjectPyCaches.reduce((total, entry) => total + entry.files, 0);
  const removedBytes = prunedProjectPyCaches.reduce((total, entry) => total + entry.bytes, 0);
  console.log(
    `[stage:runtime] pruned ${prunedProjectPyCaches.length} Python cache paths, ${removedFiles} files, ${(removedBytes / (1024 * 1024)).toFixed(2)} MB`
  );
}
console.log(
  `[stage:runtime] packedPayload=${packedPayloadTar} (${(packedPayloadStats.size / (1024 * 1024)).toFixed(2)} MB)`
);
console.log(`Staged desktop runtime at ${stageRoot}`);
