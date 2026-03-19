const fs = require('fs');
const path = require('path');
const { resolveProjectDir } = require('./resolve-project.cjs');

const repoRoot = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.join(repoRoot, 'local', 'workspace');
const projectDir = resolveProjectDir(workspaceRoot);
const runtimeWindowsDir = path.join(workspaceRoot, 'runtime', 'windows');
const stageRoot = path.join(repoRoot, 'desktop_installer_bundle', 'build', 'app-runtime');
const stageRuntimeDir = path.join(stageRoot, 'runtime', 'windows');
const stageProjectDir = path.join(stageRoot, 'project');
const sourceDistIndex = path.join(runtimeWindowsDir, 'bundle', 'dist-file', 'index.html');
const stagedDistIndex = path.join(stageRuntimeDir, 'bundle', 'dist-file', 'index.html');

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

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found: ${targetPath}`);
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

const manifest = {
  generatedAt: new Date().toISOString(),
  workspaceRoot,
  projectDir,
  runtimeWindowsDir,
  sourceDistIndex,
  sourceDistIndexMtime: fmtMtime(sourceDistIndex),
  stagedDistIndex,
};

fs.writeFileSync(
  path.join(stageRoot, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log(`[stage:runtime] stagedDistIndex=${stagedDistIndex}`);
console.log(`[stage:runtime] stagedDistIndexMtime=${fmtMtime(stagedDistIndex)}`);
console.log(`Staged desktop runtime at ${stageRoot}`);
