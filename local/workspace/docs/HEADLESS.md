# 星阙无头模式(不开 App:终端 · MCP · REST)

星阙的全部 AI 工具(建档、起盘、合盘取数、各流派择日、名人库、玄学史、提案……)不需要打开桌面 App 也能用:
仓库里的 `./horosa` 在 Node 里直接跑同一套前端工具代码,连本机的 Java / Python 计算服务,对外提供 **终端命令**、**MCP**(stdio 与 HTTP)和 **REST `/api/v1`** 三种接法。
桌面 App 里的「外部连接」是同一套工具、同一组子命令;两边数据各自独立(App 的数据在 App 里,无头的数据在 `~/.horosa`)。

## 前置条件

- **仅 macOS**(12 及以上,Apple Silicon 优先)。部署脚本与计算服务都按 macOS 写;Linux 容器里的 AI 代理跑不起来 `./horosa setup`。
  例外:**批量验证**(`./horosa batch`)可以打成运行包拿到 Linux 服务器上跑(x86_64 / arm64,无图形界面,只要 Node + Python + 可选的 JDK),见下面「批量验证」。
- **第一次必须先 `./horosa setup`**:装 / 检查 Node 18+(推荐 20)、JDK 17、Python 3.11+、Maven,装前端依赖、建虚拟环境、打后端 jar。
  有 Homebrew 就用它装(会要管理员权限),没有就直接下载到仓库内 `.runtime/mac/`。需要联网(Adoptium、Maven Central、npm、PyPI 等);
  装完约占 5 GB(前端依赖约 3.6 GB、Python 依赖约 0.8 GB、Maven 仓约 0.8 GB),首次通常要十几分钟。已就绪的步骤会自动跳过。
- 没 setup 之前,`./horosa help` / `./horosa --version` / `./horosa doctor` 照样能用,别的子命令会提示先 setup。
- 版本号:源码检出里当前提交不在 `v<版本号>` 标签上(比该版本新,或开发中途)时,`--version`、`status` 与 MCP `initialize` 回的 `serverInfo.version` 都带 `+unreleased`(终端另写明「未发版」);发版包与不在 git 检出里的源码按发版算。

## 一分钟上手

```bash
./horosa setup      # 首次:装工具链(JDK17 / Node / Maven / Python 3.11+)并构建;已就绪的步骤自动跳过
./horosa start      # 起本机计算服务 + 无头接口服务(后台)
./horosa doctor     # 自检:哪里没就绪会直接说
./horosa records    # 列档案(简写 = call list_records)
```

不起服务也能用:没有无头服务在跑时,命令直接在本进程里跑工具(同一份数据,带数据锁)。**起盘、择日、调模型(`ai test` / `run_analysis`)都要本机计算服务在跑**:`./horosa start` 会起;`./horosa mcp` 在两个计算服务都没开时会在后台自动拉起(只开了一个时不动它,提示你 `./horosa start`)。自动拉起的计算服务会一直留着,不用了 `./horosa stop --all` 收掉。

## 交给 AI

先 `./horosa setup` 一次(见上),再接:

- **Claude Code**:在仓库根目录打开即可 —— 根目录的 `.mcp.json` 已登记 `horosa` 服务器(`./horosa mcp`),第一次会请你允许。
- **Claude Desktop / Cursor / Windsurf / Cline 等**:在各自的 MCP 配置里加

  ```json
  { "mcpServers": { "horosa": { "command": "/绝对路径/到/仓库/horosa", "args": ["mcp"] } } }
  ```

  图形界面客户端拉起命令时 PATH 往往只有系统目录。`./horosa` 会自己去 Homebrew / Volta / fnm / nvm 的常见位置找 Node;
  Node 装在别处时,在这段配置里加 `"env": { "HOROSA_NODE": "/绝对路径/node" }`。

- **Codex**:`codex mcp add horosa -- /绝对路径/到/仓库/horosa mcp`
- **任何能跑命令的 AI 代理**:直接用 `./horosa …`(`./horosa help` 看全部;加 `--json` 拿机器可读结果)。
- **任何能发 HTTP 的程序**:`./horosa start` 之后用 REST,地址与令牌在 `./horosa endpoint` 指的端点文件里。

连上之后先读提示 `guide:horosa`(`./horosa prompt guide:horosa`),里面写了常见流程该调哪件工具、读哪份资源。

## 终端命令

```
./horosa <子命令> [参数] [--json] [--timeout 秒] [--progress | --no-progress] [--app | --server | --local]
```

| 子命令 | 作用 |
|---|---|
| `setup` / `start` / `stop [--all]` / `serve` / `mcp` | 部署 / 后台起服务 / 停服务(`--all` 连计算服务)/ 前台跑服务 / stdio MCP |
| `doctor` / `selftest` / `status` / `endpoint` | 自检 / 全链路自测(临时数据目录、零窗口)/ 状态 / 端点文件路径 |
| `tools` / `describe <工具>` | 列工具 / 看某件工具的说明与参数结构 |
| `call <工具> [参数…]` | 调用任意工具。参数 = JSON 对象 / `k=v`(字符串,按参数结构自动转型)/ `k:=JSON`(数字、数组、对象)/ `-`(从标准输入读 JSON) |
| `records [关键词]` / `tasks` / `context` / `proposals` / `actions` / `materials [关键词]` | 常用读操作简写 |
| `resources` / `templates` / `read <地址>` / `prompts` / `prompt <名称>` | 资源与提示 |
| `config [键 [值]]` | 设置:`approval`(auto 全自动可撤销 / read-only 只读)· `headless-analysis`(on/off,无头分析出口)· `private-read`(on/off,私人内容可读)· `web-fetch`(on/off,网页读取) |
| `ai [status]` · `ai add` · `ai key` · `ai use` · `ai remove` · `ai test` | 模型接口(给 `run_analysis` 等要调模型的工具),见下节 |
| `export [文件] [--overwrite]` · `import <文件> [--dry-run] [--include-security]` | 整库导出 / 导入,与桌面「全量备份」同一格式,见下节 |
| `proposals accept\|reject\|revert <提案id>` | AI 提议的档案修改:只有人能采纳(交互确认;非交互要同时加 `--yes` 并设 `HOROSA_ALLOW_UNATTENDED_APPROVAL=1`) |
| `undo <动作id>`(或 `actions undo <动作id>`) | 撤销 AI 做过的一条写入(`./horosa actions` 列出最近的动作与 id;交互确认,非交互同时加 `--yes` 与 `HOROSA_ALLOW_UNATTENDED_APPROVAL=1`) |
| `start` / `serve` 的 `--port N` · `--no-rest` | 指定无头接口服务端口(缺省 39981 起,被占顺延)/ 不开 REST |
| `batch <命例文件> -t <技法,…>` · `batch-pack` | 批量验证:一批命例逐例逐技法起盘,一行一例写 JSONL + 汇总 / 打 Linux 用的批量运行包,见「批量验证」 |

例:

```bash
./horosa call create_chart_record name=张三 birth='1990-01-01 08:00' place=北京 gender=male
./horosa call cast_technique technique=bazi source:='{"kind":"record","cid":"local-…"}'
./horosa call search_zeri school=qimen start=2026-04-01 end=2026-04-30 place=北京 \
  conditions:='{"type":"door","params":{"values":["开"],"palaces":[2]}}'
./horosa call search_celebrities query=物理学家 scope=bio sun=双鱼 --json
echo '{"query":"张"}' | ./horosa call list_records -
```

退出码:0 成功 · 1 工具回报失败 · 2 用法错 · 3 服务没开(或运行环境没装好:缺 Node / 前端依赖)· 4 令牌不对(或端点地址不是本机)· 5 其它失败(含服务响应超时)· 130 Ctrl-C(会把正在跑的那次调用一起取消)。

## 批量验证(一批命例 × 一组技法;Linux 服务器上也能跑)

拿一批出生资料(几十到几万例)逐例按选定的技法起盘,结果一行一例写成 JSONL,另出一份汇总 —— 用来在大样本上验证技法。
每例每技法就是一次 `cast_technique`(与 `./horosa call cast_technique`、MCP、REST 同一个函数、同一份设置),
回包里的 `data` 原样落盘 = 单例 `--json` 时的 `structuredContent`,逐值相同(仓库里有对拍测试:随机名人 × 主要技法,批量 == 单例 == 先建档再按档案起盘)。

```bash
./horosa start                                                           # 或 bash scripts/linux/backends.sh start(见下)
./horosa batch cases.csv -t astrochart,bazi,ziwei -o out.jsonl            # CSV / JSONL / JSON 数组;- = 标准输入
./horosa batch --celebrities -t bazi,qizhengkin -o adb.jsonl -j 4         # 内置名人库(约 5.9 万例)当命例
./horosa batch cases.csv -t bazi -o out.jsonl --resume                   # 断了接着跑(已算完的跳过);--retry-failed 连失败的一起重算
./horosa batch --list-techniques                                         # 全部技法键与名称
```

**输入**

- 列名不分大小写,缺省认这些(`--map 字段=列名[,…]` 指定别的):
  `id`(cid / 编号;没有就按行号记)· `name`(姓名)· `birth`(birth_chart / 出生时间;或 `date` + `time` 两列)· `zone`(tz / timezone / 时区)·
  `lat` / `lon`(gpsLat / gpsLon / latitude / longitude / 纬度 / 经度)· `gender`(sex / 性别)· `place`(pos / 出生地)· `calendar`(solar / lunar)。
  名人库页复制出的命盘 JSON、命盘记录的字段名(`birth` · `zone` · `gpsLat` / `gpsLon` · `lat` / `lon` 罗盘串 · `gender` 1 / 0 / -1 · `pos`)直接认。
- 写法:经纬度十进制(北 / 东为正)或 `39n54` / `116e24:30` / `33°52'S`;时区 `+08:00` / `+00:09:21`(地方平时可带秒,原样采用)/ `8` / `-5.5` / `UTC+8`,
  不给就按经纬度与日期推算(含夏令时);性别 `男` / `女` / `M` / `F` / `1` / `0`(不给或看不懂 = 不明);给了经纬度时出生地名只作显示,没给经纬度才按地名查坐标。
- `--celebrities`:与「工具 · 数据库」页同一份离线库,出生资料原样(时区按库里原值、含秒;无时刻的按库里的正午);`--rodden AA,A` · `--with-time` 筛选。`--offset N` · `--limit N` 对任何输入都管用。
- 输入流式读取:几万行也不整表进内存。

**技法与设置**

- `-t a,b,…` 或 `-t all`(全部能按出生资料起盘的;要在技法页里操作才有内容的会在开跑前略过并写进汇总)。
- 设置:开跑那一刻本机无头数据目录(`HOROSA_HOME`)里的技法设置 / 新盘缺省 —— 与单例同一份;跑的过程中改设置不影响这一批。各技法另行覆盖:
  `--options '{"astrochart":{"hsys":1}}'`(键 / 值域同 `describe_settings(facet=mount)`,与单例的 `options` 同义);只要某几段:`--sections '{"astrochart":["行星","宫位"]}'`。
- 每技法正文缺省取单例的上限 60000 字(超出照单例口径截断并标 `truncated`);`--max-chars N` 调小。`--split-sections` 另附按段切开的正文。
- 开跑前先用一个固定的探针例照正式口径试一遍:明点的技法起不出来(计算服务没开、设置写错、段名不对)就直接停并说明,不会跑出整批错误行(`--no-probe` 关)。
- 正文里有两处取「此刻」(到分钟):推运类的「导出时刻」与小限 / 太阳弧缺省目标时刻的「推运时间」;返照 / 流年缺省取今年。要可复现,用 `--options` 给定目标时刻(如 `{"profection":{"datetime":"2030-06-01 12:00"}}`)。

**输出**

- `out.jsonl` 一行一例:`{"key","n","id","input":{…},"ok","results":{"技法":{"ok":true,"data":{…},"assumptions":[…]} | {"ok":false,"code","message"}},"ms"}`;
  输入本身有问题的行写 `{"ok":false,"error":{"code":"E_INPUT_INVALID",…}}`。行按完成先后写(`n` = 输入里的第几例)。
- `out.jsonl.summary.json`:例数、全部成功的例数、各技法成功 / 失败 / 截断计数、错误码分布、每秒例数、略过的技法与原因、各技法用到了哪个计算服务、用的设置与计算服务地址;开跑后每 30 秒刷新一次。
  `out.jsonl.log`:子进程的日志。
- 体积:全部技法全文每例约 0.6 MB(6 万例要几十 GB);只验几个技法或用 `--sections` 只取需要的段,能小一两个数量级。
- 退出码:0 全部成功 · 1 跑完但有失败行 · 2 用法错 · 3 本机计算服务没开 · 5 其它失败 · 130 Ctrl-C。

**稳与快**

- 单例失败(起不出来 / 超时 `--timeout 秒`,缺省 120)只落那一格,不中断整批;子进程崩了自动换新(那一例记 `E_WORKER_CRASHED`);每个子进程跑 `--recycle N`(缺省 2000)例后换新。
- 结果逐行追加、定期刷盘;断电 / 被杀后 `--resume` 会截掉末尾写了一半的那行再接着跑;Ctrl-C 一次 = 写完在算的几例就停,两次 = 立即停(被强停的几例不写进输出,`--resume` 照常把它们算回来)。
- 续跑按「键」认已算完的例:有 id 列时键 = id(重复的 id 从第二次出现起记 `id#行号`,行号是它在输入里的位置,与 `--offset` 无关;分片跑也一样);没有 id 列时键 = 行号,所以续跑前别调换行序。续跑不比对输入内容 —— 改了某例的出生时间等,要么换个 id,要么去掉 `--resume` 重跑。
- JSON / JSONL 输入加 `--map` 时,第一行就没有指定的键 = 列名写错(退 2);之后某一行缺这个键,只把这一行记成输入错误。
- 多套计算服务(`--backends`)跑到一半某套连不上了:不再往它上面分活,在它上面失败的例交给其它套重算;它恢复了自动接着用;全部连不上 60 秒 = 停(退 5,已写的行都在,服务起来后 `--resume`)。
- 计算服务的吞吐:一个 Python 排盘服务进程只吃满一个核,要快就起几套计算服务、并行子进程随之加:
  `bash scripts/linux/backends.sh start --pairs 3` 会打印 `--backends 9999:8899,10000:8900,10001:8901`,原样加到 `./horosa batch` 后面(并行数缺省 = 2 × 套数)。
  参考(一台 8 核以上的机器):主要 7 个技法 一套 ≈ 6 例 / 秒、两套 ≈ 10 例 / 秒(6 万例约 2–3 小时);全部约 50 个技法 一套 ≈ 0.8 例 / 秒、三套 ≈ 2 例 / 秒(6 万例约 8 小时)。
  内存:每个子进程约 0.5 GB,每套计算服务约 1 GB。

**哪些技法要 Java**

| 计算服务 | 技法 |
|---|---|
| 不要计算服务(纯本地算) | 八字 `bazi` · 邵子参评数 `canping` · 河洛理数 `heluo` · 神数正传 `zhengchuan` · 一掌经 `yizhangjing` |
| 只要 Python 排盘服务 | 演禽 `xianqin` · 策天飞星 `cetian` · 七政四余(七政)`qizhengkin` · 邵子神数 `shaozi` · 铁板神数 `tieban` · 鬼谷分定经 `fendjing` · 北极神数 `beiji` · 南极神数 `nanji` · 蠢子数 `chunzi` · 皇极经世 `huangji` |
| 要 Java 后端(它再调 Python) | 星盘 `astrochart` · 印度占星 `indiachart` · 七政四余 `guolao` · 量化盘 `germany` · 巴比伦占星 `babylon` · 紫微斗数 `ziwei` · 宿占 `suzhan` · 全部「星运-」推运类(主限法 / 黄道星释 / 法达 / 小限 / 太阳弧 / 返照 / 流年 / 二次推运 …) |

Java 后端没开时批量自动进入「只用 Python」(`--python-only` 也可手动指定):要 Java 的请求就地失败、不等连接重试,`-t all` 时这些技法开跑前略过。汇总里的 `backendsUsedByTechnique` 是这一批实测用到的服务。

**Linux 服务器(低配置)**

在有完整检出的机器上(本机 macOS 即可)打一个运行包,拷到服务器上解开就能跑 —— 服务器上不用装前端依赖、不用 Maven、不用桌面 App:

```bash
./horosa batch-pack horosa-batch.tar.gz          # 约 330 MB:无头运行时产物 + jsdom + Python 引擎源码与星历文件 + 后端 jar + 名人库
                                                 # --no-java(只算不要 Java 的技法,小约 120 MB)· --no-celebrities(小 50 MB)
# 服务器上(Debian 12 / Ubuntu 24.04 例;要 Node 18+、Python 3.11+、JDK 17 —— 发行版自带的 Node / Python 太旧就另装;只用 Python 的技法可以不装 JDK):
sudo apt-get install -y nodejs python3 python3-pip python3-venv openjdk-17-jre-headless build-essential
tar -xzf horosa-batch.tar.gz && cd horosa-batch-*/
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements/linux-python.txt
HOROSA_PYTHON=$PWD/.venv/bin/python3 bash scripts/linux/backends.sh start --pairs 2    # 只用 Python:加 --python-only
./horosa-batch cases.csv -t bazi,astrochart -o out.jsonl --backends 9999:8899,10000:8900
bash scripts/linux/backends.sh stop --pairs 2
```

- Python 依赖清单 `scripts/requirements/linux-python.txt`(与 macOS 同一份);个别包在没有预编译轮子的平台上要现编(装 `build-essential`)。
  星历文件(Swiss Ephemeris)随包在 `Horosa-Web/flatlib-ctrad2/flatlib/resources/swefiles/`,不用另下载。
- `scripts/linux/backends.sh start|stop|status [--pairs N] [--python-only]`:只用 bash / curl(没有就用 Python 探测)/ ps / kill;端口 `HOROSA_SERVER_PORT` / `HOROSA_CHART_PORT`(第 i 套 = 基准 + i),
  程序 `HOROSA_PYTHON` / `HOROSA_JAVA_BIN` / `HOROSA_JAR`,pid 与日志在 `$HOROSA_HOME/backends/`。macOS 上同样能用。
- 容器(可选):在解开的运行包目录里 `docker build -f scripts/linux/Dockerfile -t horosa-batch .`,
  `docker run --rm -v "$PWD/work:/work" -e HOROSA_BACKEND_PAIRS=2 horosa-batch /work/cases.csv -t bazi -o /work/out.jsonl`(镜像里起计算服务 → 跑批量 → 停服务)。
- 运行包里的 `HEADLESS.md` 就是本文。完整检出里同样可以直接 `bash scripts/linux/backends.sh start` + `./horosa batch …`(要先装前端依赖)。

## 模型接口(给 run_analysis 等要调模型的工具)

两种给法,任选其一:

- **环境变量(不落盘,优先)**:`HOROSA_AI_PROVIDER`(openai / anthropic / gemini / deepseek / openrouter / ollama / moonshot / zhipu / siliconflow / groq / xai / custom)· `HOROSA_AI_MODEL` · `HOROSA_AI_BASE_URL` · `HOROSA_AI_API_KEY`(不给就认各家常用名,如 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`)。只在这个进程的内存里,不写进数据目录、不进导出包。
- **存成档案**:

  ```bash
  ./horosa ai add anthropic --model claude-sonnet-5          # 交互:隐藏输入密钥
  ./horosa ai add openai --key-env OPENAI_API_KEY             # 从环境变量名取(值不出现在命令行)
  printf %s "$KEY" | ./horosa ai add deepseek --key-stdin      # 从标准输入取
  ./horosa ai add ollama --model llama3.1                     # 本机 Ollama 不要密钥
  ./horosa ai                                                 # 当前用哪个、有哪些档案(密钥只报有没有)
  ./horosa ai test                                            # 连通测试(只发一句)
  ./horosa ai use <档案> [模型] · ./horosa ai key <档案> · ./horosa ai remove <档案>
  ```

  密钥用 AES-256-GCM 加密后才落盘,主密钥另放在 `headless/master.key`(0600,与 `data/` 分开;拷走数据目录不带它)。命令行参数里给密钥(`--api-key`)一律拒收 —— 那会留在 shell 历史和进程表里。

`run_analysis` 还要打开出口:`./horosa config headless-analysis on`。不在预设表里的接口类型(openrouter / ollama / zhipu / siliconflow / groq / xai / custom)要给模型名(`--model` 或 `HOROSA_AI_MODEL`)。

## 导入 / 导出(与桌面 App 互通)

```bash
./horosa export                       # 当前目录生成 horosa-backup-<时间>.zip
./horosa import 备份.zip --dry-run    # 先看会写入什么
./horosa import 备份.zip              # 交互确认后导入(非交互:HOROSA_ALLOW_UNATTENDED_APPROVAL=1 ./horosa import 备份.zip --yes)
```

- 格式与桌面「数据管理 › 全量备份」相同:桌面导出的包能导进无头,无头导出的包能在桌面恢复。无头导出的包不带「设置面完整」标记(无头数据目录里几乎没有技法设置):在桌面恢复时只并进档案与带着的设置,不会把桌面的技法设置当「备份里为默认」复位。
- 同一 ID 的命盘 / 事盘:更新时间较新的那一份整条保留(本机较新或一样新的保留本机的;替换时置顶、星标、归档等列表状态留本机的),不按字段混合;本机在这份备份之后删掉的(还在回收站 / 删除日志里)不带回;预览里写明各几条。
- 密钥不随包走:导入后接口档案显示「密钥未设置」,用 `./horosa ai key <档案>` 补上。
- 导入的就是预览过的那一份:真导入时核对预览时的内容哈希,预览之后文件被换了就拒。备份解压后超过 512 MB 也拒(压缩包本身上限 200 MB)。
- **安全开关缺省每项取较严的一档**:审批档、私人内容可读、网页读取 / 联网检索、无头分析出口、按工具名放行 / 禁用、任务 / 自动化开关、命主实况按命盘发送(只留两边都开着的命盘)等,每项取本机与备份里较严的一档 —— 备份里较宽的不会放宽本机,本机还是缺省(最宽)时按备份收紧;预览里合成一行列出哪几项按备份收紧、哪几项保留本机的。要整值一并导入(可能放宽)加 `--include-security`。桌面「恢复全量备份」同一口径。
- 记录库内容坏了(解析不出)时:原内容另存成本机存储里的 `horosa.corrupt.<原键>.<时刻>` 留档后从空库开始;档案为空时 `list_records` 回包附一句提醒,`./horosa doctor` / `status` 列出这类留档。
- 导入前整份数据目录自动留快照(`headless/backups/pre-import-<时间>/`)。要撤销:先停掉持有数据的进程(`./horosa stop`;数据由某个 AI 客户端的 MCP 会话持有时,在那个客户端里关掉 horosa 会话),把 `headless/data/` 挪走,再把快照目录拷回成 `headless/data/`(直接拷回会留下导入时新增的文件)。
- 本机才有意义的键(无头自己写的后端地址)导出时剔掉、导入时不收;导出的「当前模型」按存下的档案写(环境变量档案只在内存,不进包)。

## MCP

- **stdio**:`./horosa mcp`(每行一条 JSON-RPC;标准输出只走协议)。已有无头服务在跑时自动转发给它(进度逐帧转发,请求 id 按会话改写、几个会话互不串);否则自己持有数据并顺带挂一个本机 HTTP 端点,终端命令可以同时用。
  几个 AI 客户端会话同时开:第一个持有数据,其余转发;持有数据的那个关掉后,其余会话自动改连或自己接管,不用重启客户端。
- **HTTP**:`./horosa start` 后 `POST http://127.0.0.1:<端口>/mcp`,`Authorization: Bearer <令牌>`(端点文件里)。握手回 `Mcp-Session-Id`,之后每条带上它:取消只作用于本会话的请求。带 `_meta.progressToken` 且 `Accept: text/event-stream` 时回事件流(进度 → 结果);`notifications/cancelled` 按请求 id 取消。请求体上限 1 MiB(超了回 413)。
- 协议版本 2024-11-05 / 2025-03-26 / 2025-06-18 / 2025-11-25;方法:`initialize` · `ping` · `tools/list` · `tools/call` · `resources/list` · `resources/templates/list` · `resources/read` · `prompts/list` · `prompts/get` · `completion/complete`。

## REST `/api/v1`

与 MCP 同一个服务、同一个令牌。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1` | 索引(版本 / 接口清单 / 简写) |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1,按工具目录现生成 |
| GET | `/api/v1/tools` | 工具清单 |
| POST | `/api/v1/tools/{name}` | 调用;请求体 = 参数;`?stream=1` 收进度(`event: progress` … `event: result`) |
| GET | `/api/v1/records` · `/tasks` · `/proposals` · `/context` · `/actions` · `/materials` | 常用读操作(查询串 = 参数) |
| GET | `/api/v1/resources` · `/resources/templates` · `/resources/read?uri=` | 资源 |
| GET / POST | `/api/v1/prompts` · `/api/v1/prompts/{name}` | 提示 |

成功 200 `{ok:true, text, data}`;工具失败 422 `{ok:false, text, error:{code, message}}`;无令牌 401;参数错 400;限流 429;超时 504。

```bash
EP=$(./horosa endpoint | head -1)
TOKEN=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['token'])" "$EP")
REST=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['restUrl'])" "$EP")
curl -s -H "Authorization: Bearer $TOKEN" "$REST/records?query=%E5%BC%A0"
```

## 安全与数据

- **重试不重复写**:写入类调用可以带幂等键 —— MCP 在 `tools/call` 的 `_meta.idempotencyKey`,REST 用 `Idempotency-Key` 请求头,终端命令 `call … --idempotency-key 键`;同键同参的重试回放第一次的结果(回包 `replayed: true`),参数不同报 `E_IDEMPOTENCY_CONFLICT`。调用已取消 / 超时的写入不开始执行。
- **接口密钥**:取不到主密钥(`headless/master.key` 读不了)时不收密钥、绝不明文落盘;改用环境变量 `HOROSA_AI_API_KEY`。

- 只听本机回环地址;Host / Origin 必须是本机(健康探针 `/healthz` 也是),令牌常量时间比对;端点文件权限 0600,服务退出(含被 SIGTERM / SIGHUP 结束)即删。终端命令只连本机回环地址,并先用健康探针核对端点文件里的进程号,对不上就不发令牌。
- 管理口(设置、模型接口、提案采纳、撤销、导入导出)用另一枚管理令牌(`headless/admin-token`,0600,不在端点文件里):只拿到接口令牌的 MCP / REST 客户端改不了设置、也采纳不了提案。
  但这道分隔挡不住能在你的账号下跑命令的程序(包括能执行终端命令的 AI 代理):它们读得到同一个数据目录,也能直接跑 `./horosa proposals accept`。所以非交互环境(标准输入不是终端 —— 脚本、定时任务、能跑命令的 AI 代理)里,人工子命令(采纳 / 拒绝 / 撤销采纳提案、撤销动作、删接口档案、导入)与放宽外部访问的设置(`config approval auto`、`private-read on`、`web-fetch on`、`headless-analysis on`)只加 `--yes` 不放行,还要显式设 `HOROSA_ALLOW_UNATTENDED_APPROVAL=1`;交互终端照旧。别把这个变量写进代理能读到的配置里。
- **这两道都不是安全边界**:人工确认与管理令牌是减速带,挡的是「只拿到接口令牌的客户端」和「顺手替你批准的自动化」。在伪终端里跑命令的 AI 代理(编辑器内终端、tmux、expect)看到的标准输入就是终端,`--yes` 直接放行,上面那个环境变量管不到;管理令牌文件与数据目录同属你的账户,能在你的账户下跑命令的程序都读得到,可以直接调管理口(含采纳提案),完全绕过终端确认。真正的边界是「谁能在你的账户下执行命令」:不受信的代理不要给它能跑命令的终端,要人把关的操作在桌面 App 里做。
- 工具只读或只增:不删档案、不覆盖已有档案;改设置在内的一切写入都记入账本、可撤销(`./horosa undo <动作id>`)。改档案 / 归档只能「提议」,要人用 `./horosa proposals accept` 采纳。限流:每分钟 60 次调用、每小时 100 次写入,所有无头入口共用一份额度。
- 数据文件读不了(写坏 / 截断)时,原样改名留档成 `<文件>.corrupt-<时刻>` 再从空开始,绝不拿空数据盖掉它;`./horosa doctor` / `status` 会列出这些留档文件,档案为空且有留档文件时 `list_records` 的回包附一句提示。对话 / 资料 / 任务 / 接口档案的文件读不了(权限 / I/O 错误)时,本进程里当空、改动不落盘(不拿新数据整份换掉原文件),标准错误与 `doctor` 都会报。落盘先写临时文件并 fsync 再改名;落盘失败会在日志里报并自动重试。数据目录只给本人(0700),日志 0600。
- 界面类工具(切技法页、合盘配对、设对话挂载、读当前页、载入工作区、反问用户)要操作界面,无头模式下不提供。改设置里的「当前盘口径」与「全局显示偏好」两面同样要界面:无头里 `describe_settings` 把这两面整面标只读(`writable: false` + `readOnlyReason`),写入如实拒绝(`E_BRIDGE_UNAVAILABLE`,原因与描述同一句,不记账本);建档时要求「载入工作区」回 `loaded: false`。其余设置面(技法本地设置 / 技法页设置 / 挂载默认 / 古典占星全局参数)照常可改、可撤销。
- 目标任务 / 定时任务 / 自动化规则要常驻的页面调度器,无头模式下也不提供:多步任务交给接入的 AI 自己编排,定时用系统定时(cron / launchd)调 `./horosa call …`。
- 数据目录 `HOROSA_HOME`(缺省 `~/.horosa`):`headless/data/`(档案与设置、对话 / 资料 / 任务、接口档案)、`headless/logs/`(`server.log` 无头服务、`backends.log` 自动拉起的计算服务)、`headless/endpoint.json`、`headless/admin-token`、`headless/master.key`、`headless/backups/`。计算服务自己的日志在仓库内 `Horosa-Web/.horosa-local-logs/`。
- 同一台机器上有几份仓库副本时,各设各的 `HOROSA_HOME`;不然它们共用一份数据与一个端点(`./horosa doctor` 会提示端点来自另一份副本)。

## 环境变量与端口

| 变量 / 端口 | 缺省 | 作用 |
|---|---|---|
| `HOROSA_HOME` | `~/.horosa` | 数据目录 |
| `HOROSA_SERVER_ROOT` | `http://127.0.0.1:9999` | 后端地址(Java 计算服务);`start` / `doctor` / 自动拉起 / 起服务脚本都按它的端口(只设它时脚本也起在这个口)。主机不是本机时不在本机起 / 停服务 |
| `HOROSA_SERVER_PORT` / `HOROSA_CHART_PORT` | 9999 / 8899 | Java / Python 计算服务端口;卜类、玄史等直连 Python 的请求按 `HOROSA_CHART_PORT` 发。与 `HOROSA_SERVER_ROOT` 的端口不一致、或不是 1–65535 的整数 = 用法错(退出码 2) |

三处(探测哪个口 / 起服务脚本起在哪个口 / 运行时发往哪个口)同一来源 `headless/ports.js`。两个服务只开了一个时,`./horosa start` 与自动拉起都**不跑起服务脚本**(它按端口回收再起,会把在跑的那个也重启、打断正在用它的桌面 App 或别的会话),只提示:确认可以重启就先 `./horosa stop --all` 再 `./horosa start`,或把两个端口都指到空闲端口。
| `HOROSA_HEADLESS_PORT` | 39981 | 无头接口服务首选端口,被占顺延 9 个 |
| `HOROSA_NODE` | 未设 | 指定 Node 可执行文件(图形界面客户端找不到 Node 时用) |
| `HOROSA_NO_AUTOSTART` | 未设 | `=1` 时 `./horosa mcp` 不自动拉起计算服务 |
| `HOROSA_MCP_ENDPOINT` | App 数据目录下 | `--app` 读桌面 App 端点文件的路径 |
| `HOROSA_AI_PROVIDER` / `HOROSA_AI_MODEL` / `HOROSA_AI_BASE_URL` / `HOROSA_AI_API_KEY` | 未设 | 模型接口(只在内存),见上 |
- 名人库资料来自 Astro-Databank(仅供非商业占星研究,保留 Rodden 评级与原页链接)与维基百科(CC BY-SA 4.0);引用时请保留来源。

## 排障

| 现象 | 处理 |
|---|---|
| `horosa: 找不到 Node.js 18+` / `前端依赖没装` | `./horosa setup`;Node 已装在别处就设 `HOROSA_NODE` |
| `./horosa setup` 装 Python 依赖失败 | 要 Python 3.11+;系统自带的 3.9 不行 —— setup 会改用 Homebrew 的 python@3.11 或下载一份 |
| 「无头端点由一个 MCP 会话托管,不停它」 | 数据由某个 AI 客户端的会话持有:在那个客户端里关掉 horosa 会话;`./horosa stop` 只停 `start` / `serve` 起的服务 |
| 启动时提示「数据文件读不了,已改名留档」 | 坏文件留在原处(`*.corrupt-<时刻>`;`./horosa doctor` 列出),可以手工排查 / 修好后改回原名 |
| 提示「stores/… 读不了,改动不落盘」 | 那个文件权限不对(如曾用 `sudo` 跑过,属主成了 root):改回本人属主与 0600 后重启;`./horosa doctor` 的「数据文件可读」一行列出是哪个 |
| 起盘 / 择日报「本机计算服务」相关错误 | `./horosa start`,再 `./horosa doctor` |
| 退出码 3「无头服务没在跑」 | `./horosa start`;或去掉 `--server` 让命令在本进程跑 |
| 「数据正被另一个星阙进程使用」 | 有别的 `./horosa` 进程持有数据:`./horosa start` 起服务后所有命令都经它并发使用 |
| 想连桌面 App 而不是无头 | 加 `--app`(App 里要先开「外部智能体连接」) |
| `batch` 退出码 3「Python 排盘服务没开」 | `./horosa start` 或 `bash scripts/linux/backends.sh start`;端口不是缺省的就设 `HOROSA_SERVER_PORT` / `HOROSA_CHART_PORT`,或加 `--backends` |
| `batch` 开跑前停在「探针例上起不出来」 | 按列出的原因改(起 Java 后端 / 改设置 / 段名);只用 Python 时去掉要 Java 的技法;确实要硬跑加 `--no-probe` |
| 批量很慢 | 一个 Python 排盘服务只吃一个核:`backends.sh start --pairs N` 多起几套再 `--backends …`;少选技法 / 用 `--sections` 也快 |
| `run_analysis` 报没有可用的接口配置 | `./horosa ai add …` 或设 `HOROSA_AI_PROVIDER`;再 `./horosa config headless-analysis on` |
| 接口档案「密钥解不开」 | 主密钥文件换过或丢了:`./horosa ai key <档案>` 重填(主密钥文件是空的会自动重新生成) |
| 报「主密钥文件损坏」 | `headless/master.key` 内容不是 32 字节的主密钥:先把它挪走(或删掉),再 `./horosa ai key <档案>` 重填各档案的密钥 |
