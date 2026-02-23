# Horosa Web 项目目录分类（2026-02-17）

## A. 根目录（仅保留一键部署相关）
以下文件固定在根目录，不再下沉：
- `Horosa_Local.command`
- `Horosa_Local_Windows.bat`
- `Horosa_Local_Windows.ps1`
- `Prepare_Runtime_Mac.command`
- `Prepare_Runtime_Windows.bat`
- `Prepare_Runtime_Windows.ps1`

## B. 主工程（运行代码）
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`
: 唯一运行中的业务工程（UI + Java API + Python 算法服务）。

### B1. 前端
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/`
: 所有技术页 UI（星盘/遁甲/太乙/六壬/易卦/风水入口）。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/models/`
: 状态管理、命盘/事盘本地存储读写逻辑。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/`
: AI 导出、请求层、离线本地缓存工具。

### B2. 后端
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudysrv/`
: Java 后端服务（9999）。
- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/`
: Python 图表服务（8899）。

## C. 运行时（部署辅助）
- `runtime/windows/bundle/`
: Windows 启动回填目录（`dist-file` / `wheels` / `astrostudyboot.jar` / URL 模板 / `runtime.manifest.json`）。
- `runtime/windows/maven/`
: 可选，Windows 缺少系统 Maven 时用于后端 jar 本地构建。

### C1. 弱网兜底 URL 列表（可选）
- `runtime/windows/bundle/java17.url.txt`
- `runtime/windows/bundle/python311.url.txt`
- `runtime/windows/bundle/astrostudyboot.url.txt`
: 每行一个 URL，启动器按顺序重试，首个成功即使用。

### C2. 验包清单
- `runtime/windows/bundle/runtime.manifest.json`
: 记录关键分发资产的路径、大小、SHA256、生成时间，用于部署前后快速核验。

## D. 快速检索建议
- 改主站功能：`Horosa-Web-55.../astrostudyui/src/`
- 改本地部署：根目录脚本 + `runtime/`
- 看离线运行日志：`Horosa-Web-55.../.horosa-local-logs-win/`

## E. 同步状态（2026-02-23）
- `统摄法` 已并入主工程：`Horosa-Web-55.../astrostudyui/src/components/tongshefa/`
- `易与三式` 已包含 `统摄法` 子页（位于 `太乙` 下方）。
- AI 导出与本地案例映射均已包含 `tongshefa`。
- 参考目录 `Horosa-Web+App (Mac)/` 已删除，当前运行仅依赖本目录现存文件与 `runtime/`。
- 仅 Git 工作树不保证可运行；发布包必须包含 `runtime/` 与 `runtime/windows/bundle/` 关键资产。
