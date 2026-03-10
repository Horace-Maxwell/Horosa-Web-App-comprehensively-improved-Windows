# 星阙 Windows 桌面包说明

如果你是普通用户，先下载 Release 里的安装包，不需要自己拼这些文件。

## 去哪里下载一键安装包

- 最新 Release 页面：
  `https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest`
- 当前一键安装包直链：
  `https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/2026.03.10.9/HorosaPortableWindows-2026.03.10.9.zip`

请下载：

- `HorosaPortableWindows-版本.zip`

不要下载：

- `HorosaPortableWindows-版本.manifest.json`

说明：

- 当前给普通用户发布的完整 Windows 安装包就是这个 `HorosaPortableWindows-版本.zip`
- 如果当前直链以后过期，直接去 `releases/latest` 页面下载最新同名格式的 zip
- 下载后先解压，再双击 `Install_Horosa_Desktop.vbs`
- 安装完成后使用桌面或开始菜单里的 `星阙` 快捷方式启动

## 普通用户安装步骤

1. 下载并解压 `HorosaPortableWindows-版本.zip`
2. 双击 `Install_Horosa_Desktop.vbs`
3. 按中文安装向导安装，完成后启动 `星阙`

补充说明：

- 安装器会自动准备桌面运行环境
- 不要直接运行 PowerShell 脚本
- 应用内可以通过 `更新 -> 检查更新` 收到后续新版本
- 用户数据保存在 `%LocalAppData%\HorosaDesktop`，更新不会删除这些数据

## 这个目录里有什么

- `src/`：桌面应用源码、更新检查和更新辅助脚本
- `wheelhouse/`：离线 Python 依赖
- `pyinstaller/`：PyInstaller 打包配置
- `version.json`：当前桌面包版本
- `Install_Horosa_Desktop.vbs`：普通用户安装入口
- `Run_Horosa_Desktop.vbs`：无控制台启动桌面端
- `install_desktop_wizard.ps1`：中文安装向导界面
- `build_portable_release_zip.ps1`：构建 Release zip
- `publish_github_release.ps1`：发布到 GitHub Release
- `UPDATE_RELEASE_GUIDE.md`：后续发布与自动更新流程
- `INSTALL_3_STEPS.md`：面向普通用户的简版安装说明

## 开发者补充

这个目录的目标是：

- 正常使用时不弹 PowerShell 或 cmd 窗口
- 在原生桌面窗口里运行 Horosa
- 让 GitHub Release 更新链路可重复、可验证
- 把会随更新保留的数据放到安装目录之外
