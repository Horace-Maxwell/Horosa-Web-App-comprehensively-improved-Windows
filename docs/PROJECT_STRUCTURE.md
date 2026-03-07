# Horosa Windows 目录说明

根目录已经尽量收干净，普通用户只需要看到一个启动入口。

## 根目录给普通用户看的只有这些

- `START_HERE.bat`：唯一的一键启动入口
- `README.md`：最简总说明
- `docs/`：补充说明，不懂就按里面写的做
- `log/`：启动失败时给维护人看的日志说明

## 主要文件夹用途

### `docs/`

放普通用户和维护人可能会看的说明文档：

- `docs/给完全不会的人看的启动说明.txt`
- `docs/SELFCHECK_LOG.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/reference-kit/`：归档的复现参考包

### `local/`

真正的 Horosa 项目、Windows 启动链路、Python/Java/runtime、前端构建产物都在这里。普通用户不要改它。

### `prepareruntime/`

给维护人整理交付包和刷新 runtime 用的脚本目录。普通用户不用进。

### `runtime/`

存放截图、自检图片、浏览器巡检产物等验证材料。

### `log/`

存放能直接发给维护人看的运行问题说明和日志汇总。

## 一句话记住

- 普通用户：只点 `START_HERE.bat`
- 完全不会的人：再看 `docs/给完全不会的人看的启动说明.txt`
- 维护人：主要看 `local/`、`prepareruntime/`、`runtime/`、`docs/reference-kit/`
