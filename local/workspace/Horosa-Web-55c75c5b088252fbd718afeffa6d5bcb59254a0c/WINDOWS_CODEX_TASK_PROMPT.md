# 交给 Windows Codex 的任务提示

你现在拿到的是一份 **Mac 生产版 Horosa 主限法复现包**。  
你的任务不是重新发明主限法，而是把这份包里的现成实现 **准确搬到 Windows 上的 Horosa 仓库**，并保证算法、显示、设置、AI 导出都与这份包所描述的行为一致。

## 你的目标

在 Windows 仓库中准确复现 Horosa 当前生产版：

- `AstroAPP-Alchabitius`
- `Ptolemy`
- `In Zodiaco`
- shared-core 对象集
- 前端/后端/AI 导出/验证脚本全部同步

并保持：

- `Horosa原方法` 仍独立存在

## 你必须做的事

### 1. 先阅读

按顺序阅读：

1. `README_FIRST.md`
2. `reference_docs/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
3. `reference_docs/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
4. `FILE_MANIFEST.md`

### 2. 用 `snapshot/` 作为权威快照

把 `snapshot/` 下的文件同步到 Windows Horosa 仓库对应相对路径。

原则：

- 相对路径必须一致
- 语义必须一致
- 如果目标仓库已有差异，做谨慎合并
- 最终结果必须保留这份包里的主限法行为

### 3. 模型文件必须二进制原样复制

尤其是：

- `snapshot/Horosa-Web/astropy/astrostudy/models/*.joblib`

不要：

- 重训
- 重写
- 换模型
- 转文本

### 4. 不要漏掉 4 条链路

你必须同时完成：

1. Python 主限法核心
2. Java 控制器透传 `pdMethod / pdTimeKey`
3. 前端主限法设置、`pdtype` 透传、`cache: false` 重算与整表刷新
4. AI 导出 / AI 导出设置同步
5. `stop_horosa_local.sh` 的兜底端口回收只允许处理当前工作区副本的服务
6. `Horosa_Local.command` 在默认 `8000/8899/9999` 被其他副本占用时，必须自动切到空闲端口并打开新的 URL；不能让用户继续留在旧 `127.0.0.1:8000` 页面里测主限法
7. 前端本地模式必须支持通过页面 URL `srv` 参数切到实际 `ServerRoot`；否则替代端口启动后主限法页仍会打回旧的 `127.0.0.1:9999`
8. 前端本地模式还必须优先按当前网页端口推导 backend（`webPort + 1999`），不能盲信旧的 `localStorage.horosaLocalServerRoot`；否则用户在多副本环境下回到旧页面时，主限法“重新计算”会误连另一份 backend
9. `request.js` 必须把主限法重算链路里的布尔型 `cache` 规范化为浏览器原生 `fetch` 接受的字符串值；否则请求会在前端直接抛异常
10. 本地启动链路不能只做普通后台；必须用等价于 `nohup + setsid + disown` 的方式让 web/chart/backend 真正脱离父 shell
11. 最终验收不能只做接口 smoke；必须再做一轮浏览器级巡检，真实点击左侧主模块、AI 导出入口和主限法切方法重算

如果只改其中一两条，不算完成。

### 5. 不要篡改当前生产口径

特别不要动下面这些：

- `TRUE_NODE`
- `shared-core` 对象集限制
- 动态 `mean / true obliquity`
- `Asc` promissor-side `-0.0014°`
- 虚点行 body correction models
- promissor longitude fallback correction
- 显示窗与排序

## 你应该落地的关键文件

至少要处理这些：

### Python

- `Horosa-Web/astropy/astrostudy/perpredict.py`
- `Horosa-Web/astropy/astrostudy/perchart.py`
- `Horosa-Web/astropy/astrostudy/signasctime.py`
- `Horosa-Web/astropy/astrostudy/models/*`

### 前端

- `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
- `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
- `Horosa-Web/astrostudyui/src/models/app.js`
- `Horosa-Web/astrostudyui/src/models/astro.js`
- `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- `Horosa-Web/astrostudyui/src/utils/constants.js`
- `Horosa-Web/astrostudyui/src/utils/request.js`

### Java

- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`

### 验证

- `scripts/check_primary_direction_astroapp_integration.py`
- `scripts/check_horosa_full_integration.py`
- `scripts/compare_pd_backend_rows.py`
- `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
- `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
- `Horosa-Web/start_horosa_local.sh`
- `Horosa-Web/verify_horosa_local.sh`
- `scripts/browser_horosa_master_check.py`

## 完成后的验收

### 必做验收 1

主限法页面：

1. 选择 `AstroAPP-Alchabitius`
2. 点击 `计算`
3. 确认表格刷新
4. 切换 `Horosa原方法`
5. 再点 `计算`
6. 确认结果不是同一套 rows

### 必做验收 2

AI 导出：

1. 在主限法页面使用 `AstroAPP-Alchabitius` 计算
2. 执行 AI 导出
3. 确认导出的 `推运方法`、`度数换算`、`Arc / 迫星 / 应星 / 日期` 与页面一致

### 必做验收 3

跑主限法集成脚本：

```bash
python scripts/check_primary_direction_astroapp_integration.py
```

通过条件：

- `status = ok`
- `Asc / MC / North Node < 0.001°`

### 必做验收 4

如果服务可运行，再跑：

```bash
node Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js
node Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js
```

### 必做验收 5

广德盘人工复核：

1. 使用 `2006-10-04 09:58 / 30n53 / 119e25 / guangde`
2. 选择 `AstroAPP-Alchabitius`
3. 点击 `计算`
4. 确认第一页前几行接近：
   - `-0度4分 / 2006-10-25 10:54:14`
   - `0度21分 / 2007-02-11 16:06:12`
   - `-0度48分 / 2007-07-23 11:01:34`
   - `0度57分 / 2007-09-14 13:37:20`
   - `1度33分 / 2008-04-21 15:49:15`
5. 如果明显偏离，先检查是否已经把 `pd_method_sync_v4` 同步到 Python / Java / 前端三层

## 交付时你需要说明

你完成后需要明确说明：

1. 复制/合并了哪些文件
2. 是否保留了 `Horosa原方法`
3. 是否复制了所有 `joblib` 模型
4. 主限法页面是否能真实切换算法
5. AI 导出是否同步当前方法
6. 跑了哪些检查，结果是什么

## 失败时的优先排查顺序

如果你发现结果不对，优先检查：

1. `models/` 是否完整复制
2. `perpredict.py` 是否和快照一致
3. Java 控制器是否透传 `pdMethod / pdTimeKey`
4. 前端是否强制 `pdtype = 0` 重算
5. 前端是否显式绕过 chart 内存缓存
6. 表格是否直接显示后端 `pd[0]/pd[1]/pd[2]/pd[4]`
7. `start_horosa_local.sh` 是否保留了让 `8899/9999` 脱离父 shell 的启动方式
8. `Horosa_Local.command` 是否默认保持服务常驻，避免用户继续在浏览器里点“重新计算”时后端已被停掉
9. 是否新增了浏览器级巡检，并真实点击了主模块、AI 导出入口和主限法切方法重算
9. `stop_horosa_local.sh` 是否把兜底端口回收限制在当前工作区路径内
10. 自检脚本是否在默认 `8899/9999/8000` 被另一份副本占用时自动挑空闲端口继续验收
11. AI 导出是否刷新 `primarydirect`
12. `constants.js` 是否支持 `srv -> localStorage -> 默认9999` 的本地后端根地址解析
13. `request.js` 是否把布尔型 `cache` 规范化为原生 `fetch` 能接受的值

## 最重要的一句话

不要“理解后重写”，要“按快照准确复刻”。
