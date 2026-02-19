# Horosa Runtime Bundle

把运行时放到以下路径可实现目标机免安装：

- mac Java: `runtime/mac/java/bin/java`
- mac Python: `runtime/mac/python/bin/python3`
- windows Java: `runtime/windows/java/bin/java.exe`
- windows Python: `runtime/windows/python/python.exe`
- windows backend jar bundle: `runtime/windows/bundle/astrostudyboot.jar`
- windows frontend bundle: `runtime/windows/bundle/dist-file/index.html` (or `runtime/windows/bundle/dist/index.html`)

打包时会自动把 `runtime/` 目录整体带入 App。

说明：
- Python 需包含运行 `astropy/websrv/webchartsrv.py` 所需依赖（至少 `cherrypy`）。
- Java 版本要求 17+。
