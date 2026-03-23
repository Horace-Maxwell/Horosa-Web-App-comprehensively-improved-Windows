const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const exePath = path.join(rootDir, "release", "win-unpacked", "Horosa.exe");
const iconPath = path.join(rootDir, "assets", "horosa_setup.ico");

function findRcedit() {
  if (process.env.RCEDIT_PATH && fs.existsSync(process.env.RCEDIT_PATH)) {
    return process.env.RCEDIT_PATH;
  }

  const directCandidates = [
    path.join(rootDir, "node_modules", "electron-winstaller", "vendor", "rcedit.exe"),
    path.join(rootDir, "node_modules", "rcedit", "bin", "rcedit.exe"),
    path.join(rootDir, "node_modules", "rcedit", "bin", "rcedit-x64.exe"),
  ];
  for (const candidate of directCandidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const candidateRoots = new Set();
  if (process.env.LOCALAPPDATA) {
    candidateRoots.add(path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "winCodeSign"));
  }
  if (process.env.USERPROFILE) {
    candidateRoots.add(path.join(process.env.USERPROFILE, "AppData", "Local", "electron-builder", "Cache", "winCodeSign"));
  }
  if (process.env.ELECTRON_BUILDER_CACHE) {
    candidateRoots.add(path.join(process.env.ELECTRON_BUILDER_CACHE, "winCodeSign"));
    candidateRoots.add(process.env.ELECTRON_BUILDER_CACHE);
  }

  const targetNames = new Set(["rcedit-x64.exe", "rcedit.exe"]);
  let newest = null;

  for (const root of candidateRoots) {
    if (!root || !fs.existsSync(root)) {
      continue;
    }

    const queue = [root];
    while (queue.length) {
      const current = queue.shift();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (_error) {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }
        if (!targetNames.has(entry.name.toLowerCase())) {
          continue;
        }
        const stat = fs.statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtimeMs) {
          newest = { file: fullPath, mtimeMs: stat.mtimeMs };
        }
      }
    }
  }

  return newest ? newest.file : null;
}

function main() {
  if (!fs.existsSync(exePath)) {
    throw new Error(`未找到待修补 EXE：${exePath}`);
  }
  if (!fs.existsSync(iconPath)) {
    throw new Error(`未找到图标文件：${iconPath}`);
  }

  const rcedit = findRcedit();
  if (!rcedit) {
    throw new Error("未找到 rcedit.exe，请先安装依赖、运行 electron-builder，或设置 RCEDIT_PATH。");
  }

  console.log(`[patch:win-icon] exe=${exePath}`);
  console.log(`[patch:win-icon] icon=${iconPath}`);
  console.log(`[patch:win-icon] rcedit=${rcedit}`);

  const result = spawnSync(rcedit, [exePath, "--set-icon", iconPath], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`rcedit 执行失败，退出码：${result.status}`);
  }

  console.log("[patch:win-icon] 已完成 Horosa.exe 图标写入");
}

try {
  main();
} catch (error) {
  console.error(`[patch:win-icon] ${error.message}`);
  process.exit(1);
}
