<div align="center">

# 星阙 Horosa for Windows

### A local-first metaphysics workstation for Windows
### 面向 Windows 的本地优先玄学工作站

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml/badge.svg)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=social)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[中文完整版](README_ZH.md) | [English Guide](README_EN.md) | [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

<p>Horosa for Windows delivers the full Horosa workspace as an installer-first desktop product, including mainstream charting workflows, Chinese traditional systems, and the new AIAnalysis workspace.</p>
<p>Horosa Windows 版把完整的星阙工作区作为正式桌面产品交付，既包含主工作面，也包含中国传统术数与本次正式落地的 AI分析 工作区。</p>

</div>

## Start Here / 先看这里

- Current public release: `v1.2.0`
- Primary installer: `Horosa-Setup-1.2.0.exe`
- End users should use the latest GitHub Release instead of cloning the source tree.
- 普通用户请直接从 GitHub Release 下载正式安装器，不需要先克隆源码。

## Preview / 截图预览

<div align="center">
  <p><strong>Main Workspace / 主界面工作区</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式合一工作区</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
</div>

当前版本新增并重点维护的界面还包括：

- `AI分析 - 分析`
- `AI分析 - 历史`
- `AI分析 - 资料`
- `AI分析 - 模版`
- `AI分析 - 设置`
- Windows 安装 / 更新流程

## Why This Repository Matters / 为什么这个仓库值得看

Horosa 不只是一个排盘器，也不是一个只负责打包的壳。这个仓库同时交付：

- 西方占星与推运工作流
- 中国传统术数与三式工作流
- `AI分析` 的流式分析、历史、资料、模版、组合与 provider 诊断
- Windows 桌面壳、安装器、更新与本地 runtime 启动链

换句话说，这里承载的是“可安装、可验证、可继续维护的工作站产品”，而不是一堆零散脚本。

## v1.2.0 Highlights / v1.2.0 重点

- 新增正式 `AI分析` 入口，并固定为 `分析 / 历史 / 资料 / 模版 / 设置` 五个右侧子页
- 分析链路升级为真正流式输出，支持停止、重新生成、编辑上一条与分支会话
- 资料库支持全文检索、拖拽上传、替换文件、备份恢复，以及大资料 RAG 路径
- 历史页支持搜索、筛选、批量导出、批量删除、收藏、归档和继续对话
- 设置页支持主流 provider 预设、拉取模型、测试连接、健康检查和诊断
- Windows App 保持共享前端，并补原生文件 / 文件夹 / 备份恢复 IPC 能力
- 修复默认缩放下 AI 工作区底部留白与滚动容器问题，同时不破坏既有主工作区

## AIAnalysis / AI分析

`AI分析` 是正式工作区，不是聊天弹窗。它覆盖：

- 流式分析：从命盘 / 事盘直接挂载案例上下文并发起流式输出
- 本地历史：继续对话、分支、搜索、导出、收藏、归档、批量操作
- 资料库：支持 `.txt/.md/.doc/.docx/.pdf` 的导入、全文检索、替换文件与提取文本管理
- 模版与组合：支持文字 / JSON 模版、变量、版本与默认组合能力
- Provider 设置：支持 OpenAI-compatible、DeepSeek、Anthropic、Gemini、Ollama / LM Studio 等主流协议族
- 备份恢复：工作区与资料库都支持本地导入导出

## Capability Snapshot / 能力快照

### Western Astrology / 西方占星

- natal chart, 3D chart, timing stack, returns, solar arc, profections, firdaria
- compare, composite, synastry, time-space midpoint, and Marks charts

### Chinese Traditional Systems / 中国传统体系

- Bazi, Ziwei, calendar, Feng Shui, Yi and Sanshi workflows
- Su Zhan, Yi Gua, Liu Ren, Jin Kou, Dun Jia, Tai Yi, Tong She Fa, and Sanshi United

### Desktop Workflow / 桌面工作流

- installer-first delivery with bundled runtime
- chart configuration, tools, AI export, and AI export settings
- local verification scripts and desktop smoke paths for maintainers

## Install / 安装

1. Open [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
2. Download `Horosa-Setup-1.2.0.exe`
3. Run the setup wizard and finish installation
4. Launch `星阙 / Horosa` from the desktop or Start Menu

补充说明：

- 安装器已包含 Electron、Java、Python 与前后端运行资源
- 默认安装路径：`%LocalAppData%\\Programs\\Horosa`
- 用户数据目录：`%LocalAppData%\\HorosaDesktop`
- latest GitHub Release `v1.2.0` 是当前正式安装入口

## Workspace Initialization / 工作区初始化

推荐首次使用 `AI分析` 时按这个顺序：

1. 在 `设置` 中新增 Provider 并拉取模型
2. 在 `资料` 中导入本地资料
3. 在 `模版` 中创建回复模版或组合
4. 在 `分析` 中选择命盘 / 事盘案例并挂载资料或组合
5. 发起流式分析，并在 `历史` 中继续、导出、归档或分支

## Developer Entry / 开发者入口

主要目录：

- `desktop_installer_bundle/`：Electron 桌面壳、安装器、发布脚本
- `prepareruntime/`：Windows runtime 准备脚本
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：主项目源码
- `docs/`：发布、自检与结构文档

常用入口：

- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`
- `https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.2.0`

## Verification / 验证

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm test -- --runInBand src/utils/__tests__/aiAnalysisContext.test.js src/utils/__tests__/aiAnalysisRetrieval.test.js src/utils/__tests__/aiAnalysisStore.test.js src/utils/__tests__/aiProviderAdapters.test.js
npm run build:file
```

```bash
cd desktop_installer_bundle
npm ci
npm run pack:win
npm run dist:win
```

## Release, Docs, and Governance / 发布、文档与治理

- Release notes: [GitHub Release v1.2.0](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.2.0)
- Architecture: [docs/architecture.zh.md](docs/architecture.zh.md)
- Progress: [docs/progress.zh.md](docs/progress.zh.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security: [SECURITY.md](SECURITY.md)
- Support: [SUPPORT.md](SUPPORT.md)
- License: [LICENSE](LICENSE)

一般使用问题请优先使用 GitHub Discussions：

- [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
