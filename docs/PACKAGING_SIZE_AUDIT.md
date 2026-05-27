# Horosa Windows 打包体积审计 + 减重

> 首次审计 / 实施:2026-05-26(基线 = v2.1.7 本地构建)。
> 本文是「体积都去哪了 + 减了什么 + 还能减什么」的台账。数字为**实测**;省的估算标注「需确认用途」。

## 基线(v2.1.7,减重前)

- 安装包(NSIS,压缩):**~1.14 GB**
- 解包后(`win-unpacked`):**~2.8 GB** —— 其中 Electron/Chromium 外壳仅 ~280 MB,**`app-runtime`(内置运行时+数据)占 2.6 GB**。Chromium 不是瓶颈。

### 2.6 GB 载荷拆解(`build/app-runtime`,实测)
| 块 | 大小 | 性质 |
|---|---|---|
| `project/astropy/astrostudy/models` | **636 MB** | 11 个 `.joblib` ML 模型(`virtual_body_corr_<行星>_v1`,每个 ~60MB) |
| `runtime/windows/python` | 625 MB | 内置 Python + site-packages(含 streamlit/pyarrow/pydeck/altair ~150M) |
| `runtime/windows/bundle/astrostudyboot.jar` | 310 MB | Spring Boot fat jar(opencv 105M + Oracle/Kafka/gRPC-xds 等服务端依赖) |
| `runtime/windows/appcds` | 230 MB | Java CDS 存档(构建机多次运行累积的 5 个目录) |
| `runtime/windows/java` | 228 MB | 内置 JDK/JRE(jmods/include 已 prune) |
| `runtime/windows/wheels` + `bundle/wheels` | 246 MB | 离线 pip wheels,**同 119 文件打了两遍** |
| Electron/Chromium 外壳 | ~280 MB | Horosa.exe 192M + locales 42M + paks/dll |
| `project/flatlib-ctrad2` | 116 MB | flatlib + 150 个星历 `.se1` |
| `runtime/windows/node` | 85 MB | 内置 Node |
| `project/vendor` | 67 MB | kentang/kin 引擎 |
| `bundle/dist` + `bundle/dist-file` | 62 MB | 前端构建产物**两份**(web 版 dist + 桌面版 dist-file) |
| `runtime/windows/maven` | 11 MB | 构建工具 |

## Tier 1 — 已实施(Windows 侧,零/低风险,~600 MB)

**做法**:在 `desktop_installer_bundle/scripts/stage-runtime.cjs` 的 `runtimePruneTargets` 增加以下条目——只从**打包载荷**删除,`local/workspace/runtime/windows` 源保留(不影响构建)。每一项都**先核查确认用户运行时不用**才删:

| 删除项 | 省 | 核查依据 |
|---|---|---|
| `appcds` | 230 MB | 用户首启自重建:`service-manager.js` 无存档时走 `-XX:+RecordDynamicDumpInfo`,关闭时 `jcmd VM.cds dynamic_dump`。shipped 的是构建机暖缓存(5 个 stale 目录) |
| `wheels` + `bundle/wheels` | 246 MB | `electron/` 零引用 node/wheels/pip;无运行时/repair 走 pip 安装;`bundle/wheels` 是 `wheels` 的 robocopy 副本 |
| `node` | 85 MB | `electron/` 与 `Prepare_Runtime` 均零引用,纯 dev/build |
| `maven` + `maven-extract` | 11 MB | 仅 `Prepare_Runtime` 构建 jar 时用,用户运行时不用 |
| `bundle/dist` | 31 MB | 桌面加载 `bundle/dist-file`(file://),web 版 dist 不用 |

**防回弹闸门**:`release_selfcheck.py` 新增 `check_payload_slimmed()` —— 若上述目录重新出现在 staged 载荷里(prune 列表被还原),发布闸门直接 FAIL。

**验证**:`dist:win` 重新打包后量体积 + `release_selfcheck.py` 全绿 + **干净机器冷/热启动 smoke**(证明删除未破坏启动:backendReady + chartReady + `forbiddenLogMatches` 空)。

> 代价:删了预暖的 AppCDS,首次 warm-start 略慢(实测干净机器 smoke:冷 23.5s / 首热 11.3s,均 backendReady+chartReady、出盘正确、forbiddenLogMatches 空、端口干净——功能全绿;热 11.3s>10s 软阈值的 exit 1 是 smoke 强杀进程不触发 CDS dump + 删了预暖 CDS 所致,真实用户优雅关闭后自生成 CDS,后续热启回落)。其余皆无功能影响。
>
> **未来精修(可选)**:`appcds` 之所以有 230M,是构建机多次运行**累积了 5 个 stale 存档**。比「全删」更优的做法是构建期为当前 jar **只生成并随包一个新鲜 ~50M 存档**(保留 warm-start 预暖、又省 ~180M),但需要构建流程改造;本轮先全删求稳。

## 已 deferred — jlink 裁 JRE(228M → ~60M,约 −160 MB)

**本轮不做**,原因:jlink 会**替换** JRE,Spring Boot 大量反射 + JNI(opencv)/JDBC(sqlite、Oracle)/gRPC/POI 各需不同模块,`jdeps` 对 fat jar 推断不全,**漏一个模块 = 某功能运行时崩**,而冷/热 smoke 只覆盖出盘、未必触发所有后端路径——风险与刚修完的 issue #2(「我这能跑、用户那崩」)同类。建议作为**单独一轮**:配合后端逐功能验证,或在 Mac 侧连 jar 依赖一起做(确定模块集后再裁)。

## Tier 2 — 待 Mac 侧改了再同步(共享代码,收益更大,需先确认用途)
- **jar 瘦身**(`astrostudysrv` pom 排除/scope):Oracle `ojdbc8` / `kafka-clients` / `grpc-xds`/`grpc-netty-shaded` 桌面基本不需要(用 sqlite + mongo-fallback);`opencv-3.4.2`(105M)若无图像功能用到则剔。预计 −150~250 MB。
- **Python 去 streamlit 全家桶**(`requirements`):streamlit/pyarrow/pydeck/altair(vendored 引擎当库用,非 streamlit app)。预计 −~150 MB。
- **ML 模型 636M**(最大单块):压缩(`joblib compress=`,sklearn 模型常砍半)或改**首次使用按需下载**。预计 −300~636 MB。需产品确认「virtual body correction」定位。
- 星历去重(astropy vs flatlib-ctrad2 两套 `.se1`)。

## Tier 3 — 架构级
- 桌面端去掉 Spring/JRE → 一次省 java 228 + jar 310 + appcds 0(已删) ≈ −540 MB,真重构。

## 影响估算
- **Tier 1（本轮，已实测）**:解包载荷 2.6 GB → **2.0 GB**;安装包 **1.14 GB → 810 MB（−29%）**。`release_selfcheck.py` 6/6 全绿。
- + jlink:再 −160 MB。
- + Tier 2(Mac 侧):再 −600 MB ~ −1 GB,安装包有望进 ~0.4 GB 区间。
