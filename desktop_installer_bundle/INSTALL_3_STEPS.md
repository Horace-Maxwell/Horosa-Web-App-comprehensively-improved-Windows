# 星阙 Windows 桌面版三步安装

## 普通用户下载哪个

- 请到 GitHub Release 下载 `Horosa-Setup-1.0.7.exe`
- Release 页面只保留离线安装器，不提供 portable zip 或源码快照类文件

## 三步完成安装

1. 下载 `Horosa-Setup-1.0.7.exe`
2. 双击安装器，按中文向导完成安装
3. 从桌面或开始菜单打开 `Horosa`（应用窗口标题仍显示“星阙”）

## 补充说明

- 安装包已经包含 Electron、Java、Python 和前后端资源
- 安装完成后可在本地**离线运行**
- 若要升级，请重新下载最新 `Horosa-Setup-*.exe` 覆盖安装
- 默认安装到 `%LocalAppData%\\Programs\\Horosa`
- 用户数据保存在 `%LocalAppData%\\HorosaDesktop`
- 如果机器上已安装星阙，安装器会进入维护页，可选择 `替换 / 修复 / 取消`
- 升级默认保留用户数据
- 桌面快捷方式会按 Windows Shell 的真实桌面目录创建，包含 OneDrive 桌面场景
- 双击 `Horosa.exe` 或桌面 `Horosa` 快捷方式后会先出现“星阙启动中”窗口，再继续后台启动本地服务
- 点击右上角 `X` 会彻底退出应用与本地后台服务，不会把旧实例残留到下次启动
