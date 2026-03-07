# Horosa Windows 使用说明

普通用户只需要记住一件事：

- 只双击根目录里的 `START_HERE.bat`

这份包已经带好了运行 Horosa 需要的内容。正常使用时，不需要你自己先装 Python、Java、Node 或别的软件。

## 只做这 3 步

1. 双击 `START_HERE.bat`
2. 等浏览器自己打开 Horosa 页面后再开始使用
3. 用完先关浏览器，再关启动窗口

## 不要乱点

- 根目录现在只保留了一个给用户点的脚本：`START_HERE.bat`
- 其他脚本已经收进子目录，普通用户不要去点 `local/`、`prepareruntime/` 里面的脚本
- 第一次启动可能稍慢，等它自己跑完，不要连续双击很多次
- `local`、`runtime`、`prepareruntime` 这些文件夹不要删、不要拆开、不要单独移动
- 如果 Windows 弹确认，就选“允许”或“仍要运行”

## 如果没打开成功

1. 先把已经开的浏览器和启动窗口全部关掉
2. 回到根目录，再双击一次 `START_HERE.bat`
3. 如果还不行，就打开 `log/HOROSA_RUN_ISSUES.md`
4. 还需要更详细说明时，再看 `docs/` 里的文档

## 你可能会用到的说明文件

- `docs/给完全不会的人看的启动说明.txt`：只有 3 步的超简版说明
- `docs/SELFCHECK_LOG.md`：最近一次自检记录
- `docs/PROJECT_STRUCTURE.md`：目录用途说明
- `log/HOROSA_RUN_ISSUES.md`：启动失败时先看的问题说明

## 给维护人的一句话

- 真正的项目、运行环境和打包内容都在 `local/` 里
- 打包脚本在 `prepareruntime/` 里
