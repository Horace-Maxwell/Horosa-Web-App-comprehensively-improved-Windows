<div align="center">

# 星阙 Horosa Windows 桌面仓库

### 面向 Windows 的本地优先玄学工作站，随安装器交付完整运行时

[![Latest Release](https://img.shields.io/github/v/release/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?display_name=tag&sort=semver)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml/badge.svg)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows?style=social)](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/stargazers)

[入口页](README.md) | [英文说明](README_EN.md) | [最新 Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)

</div>

## 发布快照

- 当前正式版本：`v1.2.0`
- 主安装器：`Horosa-Setup-1.2.0.exe`
- 普通用户请直接从 GitHub Release 下载，不需要先克隆源码仓库

## Horosa 交付了什么

星阙 Windows 仓库不是一个只负责打包的外壳，它实际交付的是一套完整工作站，包括：

- 西方占星与推运工作流
- 关系盘与跨模块阅读
- 中国传统术数与三式纵深
- 新增的 `AI分析` 工作区，包含流式分析、历史、资料、模版、组合、provider 诊断与备份恢复
- Windows 桌面壳、runtime 启动链、安装器与更新路径

## 截图预览

<div align="center">
  <p><strong>Main Workspace / 主界面工作区</strong></p>
  <img src="docs/assets/screenshots/main-workspace.png" alt="Horosa Main Workspace" width="1200" />
</div>

<div align="center">
  <p><strong>Sanshi Workspace / 三式合一工作区</strong></p>
  <img src="docs/assets/screenshots/sanshi-workspace.png" alt="Horosa Sanshi Workspace" width="960" />
</div>

本次版本还重点覆盖这些界面：

- `AI分析 - 分析`
- `AI分析 - 历史`
- `AI分析 - 资料`
- `AI分析 - 模版`
- `AI分析 - 设置`
- Windows 安装 / 更新流程

## v1.2.0 更新重点

- 新增正式 `AI分析` 入口，并固定为 `分析 / 历史 / 资料 / 模版 / 设置` 五个右侧子页
- 分析链路升级为真正流式输出，支持停止、重新生成、编辑上一条与分支会话
- 资料库支持全文检索、拖拽上传、替换文件、备份恢复，以及大资料 RAG 路径
- 历史页支持搜索、筛选、批量导出、批量删除、收藏、归档和继续对话
- 设置页支持主流 provider 预设、拉取模型、测试连接、健康检查和诊断
- Windows App 保持共享前端，并补原生文件 / 文件夹 / 备份恢复 IPC 能力
- 修复默认缩放下 AI 工作区底部留白与滚动容器问题，同时不破坏既有主工作区

## AI分析 工作区

`AI分析` 是正式工作区，不是聊天弹窗。它现在覆盖：

- 流式分析：从命盘 / 事盘直接挂载案例上下文并发起流式输出
- 本地历史：继续对话、分支、搜索、导出、收藏、归档、批量操作
- 资料库：支持 `.txt/.md/.doc/.docx/.pdf` 的导入、全文检索、替换文件与提取文本管理
- 模版与组合：支持文字 / JSON 模版、变量、版本与默认组合能力
- Provider 设置：支持 OpenAI-compatible、DeepSeek、Anthropic、Gemini、Ollama / LM Studio 等主流协议族
- 备份恢复：工作区与资料库都支持本地导入导出

## 能力快照

### 西方占星

- 星盘、本命盘、三维盘、推运、返照、太阳弧、小限、法达
- 比较盘、组合盘、影响盘、时空中点盘、马克斯盘

### 中国传统体系

- 八字、紫微斗数、万年历、风水、易与三式
- 宿盘、易卦、六壬、金口诀、遁甲、太乙、统摄法、三式合一

### 桌面交付层

- 安装器优先的公开交付方式，运行时随安装器一并提供
- 桌面控制层、AI 导出、AI 导出设置和维护者验证脚本
- 同一仓库里既有桌面交付链，也有共享前端源码与回归脚本

## 安装

1. 打开 [Latest Release](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
2. 下载 `Horosa-Setup-1.2.0.exe`
3. 运行安装器并完成向导
4. 从桌面或开始菜单打开 `星阙`

补充说明：

- 安装器已经包含 Electron、Java、Python 与前后端运行资源
- 默认安装路径：`%LocalAppData%\\Programs\\Horosa`
- 用户数据目录：`%LocalAppData%\\HorosaDesktop`
- latest GitHub Release `v1.2.0` 是当前正式安装入口

## 推荐首次使用流程

1. 在 `设置` 中新增 Provider 并拉取模型
2. 在 `资料` 中导入本地资料
3. 在 `模版` 中创建回复模版或组合
4. 在 `分析` 中选择命盘 / 事盘案例并挂载资料或组合
5. 发起流式分析，并在 `历史` 中继续、导出、归档或分支

## 开发者入口

主要目录：

- `desktop_installer_bundle/`：Electron 桌面壳、安装器、发布脚本
- `prepareruntime/`：Windows runtime 准备脚本
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：主项目源码
- `docs/`：发布、自检与结构文档

常用入口：

- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`
- `https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.2.0`

## 验证

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci --legacy-peer-deps
npm test -- --runInBand src/utils/__tests__/aiAnalysisContext.test.js src/utils/__tests__/aiAnalysisRetrieval.test.js src/utils/__tests__/aiAnalysisStore.test.js src/utils/__tests__/aiProviderAdapters.test.js
npm run build:file
```

```bash
cd desktop_installer_bundle
npm ci
npm run pack:win
npm run dist:win
```

## 文档与治理

- 版本说明：[GitHub Release v1.2.0](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/tag/v1.2.0)
- 架构说明：[docs/architecture.zh.md](docs/architecture.zh.md)
- 进度快照：[docs/progress.zh.md](docs/progress.zh.md)
- 贡献说明：[CONTRIBUTING_ZH.md](CONTRIBUTING_ZH.md)
- 安全策略：[SECURITY_ZH.md](SECURITY_ZH.md)
- 获取支持：[SUPPORT_ZH.md](SUPPORT_ZH.md)
- 许可证：[LICENSE](LICENSE)

一般使用问题请优先使用 GitHub Discussions：

- [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
