const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveProjectDir } = require('./resolve-project.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.join(repoRoot, 'local', 'workspace');
const projectDir = resolveProjectDir(workspaceRoot);
const uiDir = path.join(projectDir, 'astrostudyui');
const uiDistDir = path.join(uiDir, 'dist-file');
const runtimeDistDir = path.join(workspaceRoot, 'runtime', 'windows', 'bundle', 'dist-file');
const srcEntry = path.join(uiDir, 'src', 'pages', 'index.js');

function fmtMtime(targetPath) {
  try {
    return fs.statSync(targetPath).mtime.toISOString();
  } catch (error) {
    return 'missing';
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function syncDir(sourcePath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, {
    force: true,
    recursive: true,
  });
}

console.log(`[build:renderer] uiDir=${uiDir}`);
console.log(`[build:renderer] sourceEntry=${srcEntry}`);
console.log(`[build:renderer] sourceMtime=${fmtMtime(srcEntry)}`);

const result = spawnSync('npm', ['run', 'build:file'], {
  cwd: uiDir,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

syncDir(uiDistDir, runtimeDistDir);

console.log(`[build:renderer] uiDistDir=${uiDistDir}`);
console.log(`[build:renderer] uiDistIndexMtime=${fmtMtime(path.join(uiDistDir, 'index.html'))}`);
console.log(`[build:renderer] runtimeDistDir=${runtimeDistDir}`);
console.log(`[build:renderer] distIndexMtime=${fmtMtime(path.join(runtimeDistDir, 'index.html'))}`);
