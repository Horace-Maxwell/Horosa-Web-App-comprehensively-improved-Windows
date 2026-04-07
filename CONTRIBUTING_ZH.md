# 贡献说明

感谢你为星阙 Horosa Windows 版做贡献。

## 提 Issue 之前

- 一般使用问题请优先发到 [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
- GitHub Issue 用于确认过的缺陷、回归或范围明确的新功能请求
- 请尽量附上模块、平台、版本号和复现步骤

## Pull Request 流程

1. 先同步最新 `main`
2. 新建聚焦分支，建议使用 `codex/<topic>` 或 `feature/<topic>`
3. 控制改动范围，并明确写出影响的模块
4. 提交 PR 前完成最少本地检查
5. 如果改动影响文档、契约或发布行为，必须同 PR 一起更新

## 提交前最少检查

前端工作区：

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm test -- --runInBand src/utils/__tests__/aiAnalysisContext.test.js src/utils/__tests__/aiAnalysisRetrieval.test.js src/utils/__tests__/aiAnalysisStore.test.js src/utils/__tests__/aiProviderAdapters.test.js
npm run build:file
```

桌面打包：

```bash
cd desktop_installer_bundle
npm ci
npm run pack:win
```

## 必须同步的文档

如果改动涉及以下内容，请在同一个 PR 里一起更新：

- README / 入门说明 / 发布可见行为
- License 或仓库治理文件
- API 契约或 provider 兼容说明
- AIAnalysis 数据结构、备份格式、迁移逻辑或导出格式

## AI分析 专项要求

如果改动影响 `AI分析`，必须同步更新：

- README 里的功能说明
- release 说明或 release body 草稿
- 必要的迁移或兼容性说明

如果改动影响 provider、存储结构、备份恢复格式，请明确写清：

- 是否存在迁移风险
- 是否会影响旧工作区兼容
- 导出的备份是否仍然前后兼容

## Commit 风格

建议保持小而清晰的提交，使用祈使句，例如：

- `Add Windows AIAnalysis backup zip support`
- `Fix AIAnalysis layout gap under default scale`


## 许可证说明

Horosa 现已明确采用 [AGPL-3.0](LICENSE) 作为仓库级源码许可证，这次调整与公开发布栈中集成 Swiss Ephemeris / `pyswisseph` 的实际情况保持一致。第三方子目录仍可能保留各自上游原始许可证说明，提交时不要把这些上游文件强行改写成仓库级许可证。

## 安全问题

安全相关问题不要开公开 issue。请按 [SECURITY_ZH.md](SECURITY_ZH.md) 中的方式私下报告。
