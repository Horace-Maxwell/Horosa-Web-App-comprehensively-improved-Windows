# Horosa Windows 目录说明

根目录已经尽量收干净，普通用户只需要看到一个启动入口。

## 根目录给普通用户看的主要是这些

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

### `local/`

真正的 Horosa 项目、Windows 启动链路、Python/Java/runtime、前端构建产物都在这里。普通用户不要改它。

- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：当前实际使用的 Horosa 工作区
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroDecennials.js`：十年大运页面组件
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/decennials.js`：十年大运时间算法工具
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`：AI 导出与 AI 导出设置接线
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist/` 与 `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist-file/`：构建产物

### `prepareruntime/`

给维护人整理交付包和刷新 runtime 用的脚本目录。普通用户不用进。

### `log/`

存放能直接发给维护人看的运行问题说明和日志汇总。

## 额外说明

- 十年大运的临时复现参考包已经完成使命，未保留在当前交付根目录
- 如需复查十年大运实现，请直接查看 `local/` 中已经落地的正式源码与测试文件

## 一句话记住

- 普通用户：只点 `START_HERE.bat`
- 完全不会的人：再看 `docs/给完全不会的人看的启动说明.txt`
- 维护人：主要看 `local/`、`prepareruntime/`、`log/`
