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

  const cacheRoot = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
  if (!fs.existsSync(cacheRoot)) {
    return null;
  }

  let newest = null;
  for (const entry of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(cacheRoot, entry.name, "rcedit-x64.exe");
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (!newest || stat.mtimeMs > newest.mtimeMs) {
      newest = { file: candidate, mtimeMs: stat.mtimeMs };
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
    throw new Error("未找到 rcedit-x64.exe，请先运行一次 electron-builder 或设置 RCEDIT_PATH。");
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
