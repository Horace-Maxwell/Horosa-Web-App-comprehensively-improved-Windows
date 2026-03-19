const fs = require('fs');
const path = require('path');

function isHorosaProjectDir(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return false;
  }

  const requiredDirs = ['astrostudyui', 'astrostudysrv', 'astropy'];
  return requiredDirs.every((segment) => fs.existsSync(path.join(dirPath, segment)));
}

function resolveProjectDir(workspaceRoot) {
  const fromEnv = process.env.HOROSA_PROJECT_DIR;
  if (fromEnv) {
    const absolute = path.isAbsolute(fromEnv) ? fromEnv : path.join(workspaceRoot, fromEnv);
    if (isHorosaProjectDir(absolute)) {
      return path.resolve(absolute);
    }
  }

  const pointerFiles = [
    path.join(workspaceRoot, 'HOROSA_PROJECT_DIR.txt'),
    path.join(workspaceRoot, '.horosa-project-dir.txt'),
  ];

  for (const pointerFile of pointerFiles) {
    if (!fs.existsSync(pointerFile)) {
      continue;
    }
    const lines = fs.readFileSync(pointerFile, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      const absolute = path.isAbsolute(line) ? line : path.join(workspaceRoot, line);
      if (isHorosaProjectDir(absolute)) {
        return path.resolve(absolute);
      }
    }
  }

  const preferredNames = [
    'Horosa-Web',
    'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c',
  ];
  for (const name of preferredNames) {
    const absolute = path.join(workspaceRoot, name);
    if (isHorosaProjectDir(absolute)) {
      return path.resolve(absolute);
    }
  }

  const candidates = fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((absolute) => isHorosaProjectDir(absolute))
    .sort((left, right) => left.localeCompare(right));

  if (candidates.length > 0) {
    return path.resolve(candidates[0]);
  }

  throw new Error(`Horosa project folder not found under ${workspaceRoot}`);
}

module.exports = {
  isHorosaProjectDir,
  resolveProjectDir,
};
