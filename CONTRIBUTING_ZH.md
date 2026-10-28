# 贡献说明

感谢你为星阙 Horosa Windows 版做贡献。

## 提 Issue 之前

- 一般使用问题请优先发到 [GitHub Discussions](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/discussions)
- GitHub Issue 用于确认过的缺陷、回归或范围明确的新功能请求
- 请尽量附上模块、平台、版本号和复现步骤

## Pull Request 流程

1. 先同步最新 `main`
2. 新建聚焦分支，建议使用 `fix/<topic>` 或 `feature/<topic>`
3. 控制改动范围，并明确写出影响的模块
4. 提交 PR 前完成最少本地检查
5. 如果改动影响文档、契约或发布行为，必须同 PR 一起更新

## 提交前最少检查

完整产品源码随仓库发布于 `local/workspace/Horosa-Web-…/`。前端改动请在其工作区构建 + 自检：

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
npm ci
npm run build:file
```

后端是由聚合 pom（`astrostudysrv/pom.xml`）管理的多模块 Maven 工程，模块清单只在它的 `<modules>` 里。一律从聚合 pom 构建与测试：

```bash
cd local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c
# 按依赖顺序从源码构建全部模块，产出 astrostudyboot/target/astrostudyboot.jar（全新环境也只需这一条）
mvn -f astrostudysrv/pom.xml -DskipTests clean install
# 只跑部分模块的单元测试（-am 让它们依赖的兄弟模块在同一次构建里一起编译）
mvn -f astrostudysrv/pom.xml test -pl boundless,astrostudy -am
```

不要进到单个模块目录里逐个 `install`：全新环境的本地仓库里没有父 pom 与兄弟模块，第二个模块就会解析失败；已有环境则会悄悄用到本地仓库里的旧版本。

文档 / 治理 / [`prepareruntime/`](prepareruntime/) / [`windows-adaptations/`](windows-adaptations/) 改动，核对链接与相对路径仍有效即可。（桌面打包工程 —— Electron + NSIS —— 私有维护、不在本仓库。）

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
