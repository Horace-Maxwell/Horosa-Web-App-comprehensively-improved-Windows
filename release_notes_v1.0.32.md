## 下载说明

- 普通网络环境用户：下载 `XingqueSetup.exe`
- 中国大陆或弱网环境用户：下载 `XingqueSetupFull.exe`
- 普通用户不要手动下载 `HorosaPortableWindows-*.zip`、`HorosaRuntimeWindows-*.zip`、`.manifest.json`

## 本次修复

- 安装程序现在会在检测到电脑里已有星阙时，明确给出三种选择：
  - 修复当前安装
  - 用当前安装包替换现有版本
  - 取消安装
- 同版本已安装时，默认会走“修复当前安装”，自动重建桌面和开始菜单快捷方式
- 替换安装时会先清理旧程序文件，再写入当前安装包版本，避免用户误以为只能覆盖安装
