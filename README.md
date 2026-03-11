# 星阙 Windows 下载与安装

普通用户先看这里，不需要先看源码。

## 一键安装包下载位置

- [点击直接下载最新版 Windows 一键安装包](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/download/2026.03.10.24/HorosaPortableWindows-2026.03.10.24.zip)
- [打开最新版 Release 页面](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

请注意：

- 普通用户要下载的是 `HorosaPortableWindows-版本.zip`
- 不要下载同页里的 `.manifest.json`，那个不是给手动安装用的
- 同页里的 `HorosaRuntimeWindows-版本.zip` 也是安装器内部使用的支持资产，普通用户不用单独下载
- 这个 zip 虽然文件名里写的是 `PortableWindows`，但它就是目前给普通用户发布的一键安装包
- 如果上面的当前直链以后失效，直接打开 `releases/latest` 页面下载最新同名格式的 zip 即可

## 安装只做这 3 步

1. 下载 `HorosaPortableWindows-版本.zip`
2. 先解压 zip，再打开解压后的 `desktop_installer_bundle` 文件夹
3. 双击 `Install_Horosa_Desktop.vbs`，按中文安装向导完成安装

安装完成后：

- 桌面或开始菜单里会出现 `星阙`
- 以后直接打开 `星阙` 就可以，不需要重复安装
- 第一次安装时，安装器会自动联网下载较大的 Windows 运行时组件，所以会比后续启动慢一些

## 下载后不要点错

- 正确入口是 `Install_Horosa_Desktop.vbs`
- 不要手动去点 `.ps1` 脚本
- 不要直接点 `.manifest.json`
- 第一次安装如果 Windows 弹出安全提示，按系统提示选择允许继续即可

## 更新怎么收

- 安装后的应用里可以使用 `更新 -> 检查更新`
- 软件会显示当前版本、是否已是最新版本，以及 GitHub Release 里的更新日志
- 如果有新版本，可以直接在弹窗里继续更新
- 用户数据会保留在 `%LocalAppData%\HorosaDesktop`，更新不会清空这些内容

## 如果你是开发者

这个仓库同时保留了 Windows 桌面包装、源码运行环境和发布脚本，所以普通用户只需要看上面的 Release 下载说明。

开发相关内容主要在这些位置：

- `desktop_installer_bundle/`：Windows 桌面壳、安装器、打包与更新脚本
- `local/`：本地运行环境和主项目工作区
- `desktop_installer_bundle/UPDATE_RELEASE_GUIDE.md`：发布更新流程
- `desktop_installer_bundle/INSTALL_3_STEPS.md`：给终端用户的三步安装说明
