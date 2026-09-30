#!/usr/bin/env python3
"""Horosa Windows release self-check gate (change-agnostic).

Philosophy: every vulnerability we have ever hit becomes a PERMANENT automated check here,
so it can never silently recur. The checks verify CLASSES of problems (staleness, version
drift, reverted fixes, asset/hash mismatch) rather than one release's specific change, so this
script does NOT need editing every release -- only when a NEW class of bug is discovered (then
add a new check / sentinel, per .claude/skills/horosa-dev/SKILL.md).

Run it as the final gate after `npm run dist:win` (it is also wired into the `dist:win` script):
    python scripts/release_selfcheck.py
Exit code 0 = all gates pass; non-zero = a release-blocking problem was found.

Past bugs encoded as gates:
- silent stale jar  -> staged astrostudyboot.jar must be newer than all astrostudysrv/**/*.java
- forgot rebuild FE -> staged dist-file must be newer than astrostudyui/src
- version-bump miss -> all download/badge/tag refs must equal package.json version
- reverted Win fix  -> Windows-ahead + ported-fix sentinels must still be present
- bad release set   -> 4 assets present, SHA256SUMS matches files, latest.yml version matches
- broken auto-update-> latest.yml sha512/size/path must match the shipped exe byte-for-byte
                       (a drifted latest.yml -- e.g. an overwrite-in-place re-release that forgot
                        to regenerate it -- silently fails every client's electron-updater check)
"""
import os, re, sys, glob, hashlib, base64, json, subprocess, time
# horosa_subprocess_utf8_v1(v3.11.0):text 模式的 subprocess.run 若不指定 encoding,Windows 会按控制台码页(cp1252/936)解码子进程输出;
# 任一门的 node/python 子进程打印中文即抛 UnicodeDecodeError(reader 线程死、stdout 丢、门可能假绿)。统一注入 utf-8 + replace。
_orig_subprocess_run = subprocess.run
def _subprocess_run_utf8(*args, **kwargs):
    if (kwargs.get('text') or kwargs.get('universal_newlines')) and 'encoding' not in kwargs:
        kwargs['encoding'] = 'utf-8'
        kwargs.setdefault('errors', 'replace')
    return _orig_subprocess_run(*args, **kwargs)
subprocess.run = _subprocess_run_utf8

# SELF-HEAL-R1:门禁文案含中文;stdout 被管道捕获时(npm/dist:win 下即如此)Windows 默认
# cp1252/cp936 编码会把"打印 FAIL 详情"本身炸成 UnicodeEncodeError traceback——门禁绝不能
# 因为报告失败而失败。双保险:UTF-8 + errors=replace。
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE = os.path.dirname(SCRIPT_DIR)                       # desktop_installer_bundle
REPO = os.path.dirname(BUNDLE)                             # repo root

def _ws():
    cands = glob.glob(os.path.join(REPO, "local", "workspace", "Horosa-Web-*"))
    cands = [c for c in cands if os.path.isdir(os.path.join(c, "astrostudyui"))]
    if not cands:
        raise RuntimeError("Cannot locate local/workspace/Horosa-Web-* workspace dir")
    return sorted(cands)[0]

WS = _ws()
UI = os.path.join(WS, "astrostudyui")
SRV = os.path.join(WS, "astrostudysrv")
PY_SRC = os.path.join(WS, "astropy")
BUNDLE_RUNTIME = os.path.join(REPO, "local", "workspace", "runtime", "windows", "bundle")

results = []  # (name, ok, detail)
def record(name, ok, detail=""):
    results.append((name, ok, detail))

def read(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()

def newest_mtime(root, exts, skip_substr=()):
    newest = 0.0
    newest_path = None
    for dirpath, _dirs, files in os.walk(root):
        if any(s in dirpath.replace("\\", "/") for s in skip_substr):
            continue
        for fn in files:
            if exts and not fn.lower().endswith(exts):
                continue
            p = os.path.join(dirpath, fn)
            try:
                m = os.path.getmtime(p)
            except OSError:
                continue
            if m > newest:
                newest, newest_path = m, p
    return newest, newest_path

def pkg_version():
    import json
    with open(os.path.join(BUNDLE, "package.json"), "r", encoding="utf-8") as f:
        return json.load(f)["version"]

# ---------------------------------------------------------------- checks
def check_no_duplicate_dict_keys():
    """PERF-R9:字典字面量重复键检测(gotcha #29 的永久性根治)。

    为什么必须是 AST 而不是 lint:本文件里 SENT 的 key 是
    ``os.path.join(UI, "src/...")`` 这样的**函数调用**,而 pyflakes / ruff 的重复键
    规则(F601/F602)只认 Constant 与 Name —— 2026-07-20 查出的两处真实事故
    (build-uber-jar.py 与 ChartController.java 的哨兵当时全是死钉)**任何 linter 都抓不到**。

    本门把 ``os.path.join(<已知根>, <字面量>…)`` **解析成真实路径**再比对,因此还能抓到
    「同一个文件用两种路径写法各写一次、只靠分隔符差异侥幸共存」的哑雷(perchart.py 就是)。
    换成 tuple 列表 + 长度断言的方案抓不到这一类。

    只用 stdlib ast,毫秒级,不依赖 win-unpacked / pwsh / Git-Bash ——
    因此它**永远不会**像 kentang / all-services 那两道门一样降级成 SKIP=PASS。
    """
    import ast
    name = "no duplicate dict keys (gotcha #29)"
    roots_self = {"UI": UI, "SRV": SRV, "PY_SRC": PY_SRC, "WS": WS,
                  "BUNDLE": BUNDLE, "REPO": REPO, "SCRIPT_DIR": SCRIPT_DIR,
                  "BUNDLE_RUNTIME": BUNDLE_RUNTIME}
    targets = [
        (os.path.abspath(__file__), roots_self),
        (os.path.join(REPO, "windows-adaptations", "update-harness-manifest.py"), {}),
        (os.path.join(SCRIPT_DIR, "verify_all_services.py"), {}),
    ]

    def canon(node, roots):
        if isinstance(node, ast.Constant):
            return ("const", repr(node.value))
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr == "join" and node.args
                and isinstance(node.args[0], ast.Name)
                and all(isinstance(a, ast.Constant) and isinstance(a.value, str)
                        for a in node.args[1:])):
            base = node.args[0].id
            parts = [a.value for a in node.args[1:]]
            if base in roots:
                p = os.path.join(roots[base], *parts)
                return ("path", os.path.normcase(os.path.normpath(p)))
            return ("join", base, tuple(parts))
        # 保守兜底:形状完全相同才算重复,绝不误报。
        return ("ast", ast.dump(node))

    dups, missing = [], []
    for path, roots in targets:
        if not os.path.isfile(path):
            missing.append(os.path.relpath(path, REPO))
            continue
        try:
            tree = ast.parse(read(path), filename=path)
        except SyntaxError as e:
            record(name, False, f"{os.path.basename(path)} does not parse: {e}")
            return
        for node in ast.walk(tree):
            if not isinstance(node, ast.Dict):
                continue
            seen = {}
            for k in node.keys:
                if k is None:            # {**spread}
                    continue
                c = canon(k, roots)
                if c in seen:
                    dups.append("%s:%d duplicate key %s (first at :%d)"
                                % (os.path.basename(path), getattr(k, "lineno", -1),
                                   c[1] if c[0] in ("const", "path") else c[0], seen[c]))
                else:
                    seen[c] = getattr(k, "lineno", -1)

    if dups:
        record(name, False,
               "%d duplicate dict key(s) — Python silently keeps the LAST, so the first "
               "entry's needles are DEAD. MERGE the value lists into one key. | %s"
               % (len(dups), " ; ".join(dups[:6])))
        return
    detail = "%d file(s) clean" % (len(targets) - len(missing))
    if missing:
        detail += " (not found: %s)" % ", ".join(missing)
    record(name, True, detail)


def check_no_random_react_keys():
    """PERF-R9 Ship 6:React key 里不得出现随机值。

    背景:仓库里曾有 **222 处** `key={randomStr(8)}`(41 个文件)。随机 key 每次渲染都变,
    React 无法 diff —— 它会把整棵子树**卸载重建**,而不是打补丁。在这个应用上这是交互预算里
    实打实的一大块(owner 的验收线是「任意单次操作 点击→中右栏画完 ≤ 1 秒」)。

    这一类回归**逐文件加哨兵不划算**(41 个文件、且以后新写的组件同样会犯),所以用一道
    仓库级扫描门:src/ 下任何 JSX 的 key 位置出现 randomStr / Math.random / Date.now 一律 FAIL。
    纯文本扫描,不依赖构建产物,**永远不会降级成 SKIP**。

    注意:`randomStr` 用于 element id / DOM id / state id / nonce 是**正当用途**,不在扫描面内 ——
    本门只匹配 `key={...}` 位置。
    """
    name = "no random React keys"
    src = os.path.join(UI, "src")
    if not os.path.isdir(src):
        record(name, False, f"frontend src missing: {src}")
        return
    pat = re.compile(r"key\s*=\s*\{[^}]*\b(randomStr|Math\.random|Date\.now)\s*\(")
    # 排除「名叫 key 的普通变量赋值」—— 例如测试里的 `const key = { t: `miss-${Date.now()}` }`。
    # 那不是 JSX 属性,误报会让这道门失去可信度(门一旦开始喊狼来了就会被绕过)。
    decl = re.compile(r"\b(?:const|let|var)\s+key\b")
    hits = []
    total = 0
    for dirpath, _dirs, files in os.walk(src):
        # [#109,v3.11.2] 测试目录不在扫描面:上游新 stableKeysRatchet.test.js 在注释与用例标题里原文写
        # `key={randomStr(`(它自己就是防回潮的棘轮),纯文本门会假红 —— 与 #92「负锚的探针陷阱」同型。
        _dirs[:] = [d for d in _dirs if d not in ("__tests__", "node_modules")]
        for fn in files:
            if not fn.endswith((".js", ".jsx")) or fn.endswith(".test.js"):
                continue
            p = os.path.join(dirpath, fn)
            try:
                lines = read(p).splitlines()
            except Exception:
                continue
            n = sum(1 for ln in lines if pat.search(ln) and not decl.search(ln))
            if n:
                total += n
                hits.append(f"{os.path.relpath(p, src).replace(os.sep, '/')}×{n}")
    if hits:
        record(name, False,
               f"{total} random React key(s) in {len(hits)} file(s) — 每次渲染整棵子树卸载重建,"
               f"React diff 完全失效;改成内容派生的稳定 key(兄弟间唯一)。 | "
               + ", ".join(sorted(hits)[:8]))
        return
    record(name, True, "0 random keys under astrostudyui/src")


def check_overlay_escape_integrity():
    """overlay 转义完整性(#109,v3.11.2 立):补丁新增行 / files/ 层里不得出现「单反斜杠字符字面量」。

    v3.11.0 起 `boundless__AppLoggers.logBasedir.java.patch` 带的是 `prop.replace('\\', '/')` 被吞成
    `prop.replace('\', '/')`(工具层吞掉一层转义,#104 课五同源)—— Java 里 `'\'` 是未闭合字符字面量,
    wholesale-replace 后 javac 必炸;但 ws 三版从未被重置过该文件(port 只写上游变了的文件,apply.sh
    见 marker 即跳),所以三版都是拿 HEAD 里正确的源码建的 jar,**零告警**。v3.11.2 把编排 round-trip
    从「本轮相交面」扩到「全部 overlay 目标」才首次命中。判据:引号+单个反斜杠+引号,后随 , ) ; 或行尾
    (排除 '\\'' 这种合法「转义引号」串);只扫补丁 `+` 行与 files/ 全文,纯文本、永不 SKIP。
    """
    name = "overlay escape integrity (lone backslash literal)"
    ov = os.path.join(REPO, "windows-adaptations")
    pat = re.compile(r"""(['"])\\\1\s*(?:[,);]|$)""")
    hits = []
    for sub, as_patch in (("patches", True), ("files", False)):
        base = os.path.join(ov, sub)
        if not os.path.isdir(base):
            continue
        for dirpath, _dirs, files in os.walk(base):
            _dirs[:] = [d for d in _dirs if d not in ("__pycache__", "node_modules")]
            for fn in files:
                p = os.path.join(dirpath, fn)
                try:
                    txt = read(p)
                except Exception:
                    continue
                for i, line in enumerate(txt.split("\n"), 1):
                    body = line
                    if as_patch:
                        if not line.startswith("+") or line.startswith("+++"):
                            continue
                        body = line[1:]
                    if pat.search(body):
                        hits.append(f"{sub}/{os.path.relpath(p, base).replace(os.sep, '/')}:{i}")
    if hits:
        record(name, False,
               f"{len(hits)} lone-backslash literal(s) — 工具层吞了一层转义,该补丁 wholesale-replace 后编译必炸;"
               f"用 Write 工具/regen_patch.py 重生成 | " + ", ".join(hits[:6]))
        return
    record(name, True, "0 lone-backslash literals in overlay patches/files")


def _overlay_contract_facts():
    """把五层契约的四个来源解析成可交叉核对的事实(供门与诊断复用)。

    patch → 目标路径是 100% 机器可推导的:regen_patch.py 会把每个补丁的头部重写成
    `--- a/<ws-relpath>` / `+++ b/<ws-relpath>`,所以取第一行 `+++ b/` 即可。
    """
    ov = os.path.join(REPO, "windows-adaptations")
    patches_dir = os.path.join(ov, "patches")
    facts = {"patch_target": {}, "apply": [], "ledger_text": "", "exempt": {}}

    for fn in sorted(os.listdir(patches_dir)) if os.path.isdir(patches_dir) else []:
        if not fn.endswith(".patch"):
            continue
        try:
            with open(os.path.join(patches_dir, fn), "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    if line.startswith("+++ b/"):
                        # 两个历史补丁的头部带尾注(如 "... (Windows-adapted)"),按第一个空格截断
                        facts["patch_target"][fn] = line[6:].strip().split(" ")[0]
                        break
        except Exception:
            pass

    ap = os.path.join(ov, "apply.sh")
    if os.path.isfile(ap):
        rx = re.compile(r'^apply_patch\s+(?:"([^"]*)"|(\S+))\s+(?:"([^"]*)"|(\S+))\s+(\S+)\s*$')
        for line in read(ap).splitlines():
            m = rx.match(line)
            if m:
                facts["apply"].append({
                    "marker": m.group(1) if m.group(1) is not None else m.group(2),
                    "target": m.group(3) if m.group(3) is not None else m.group(4),
                    "patch": m.group(5),
                })

    rd = os.path.join(ov, "README.md")
    facts["ledger_text"] = read(rd) if os.path.isfile(rd) else ""

    ex = os.path.join(ov, "CONTRACT_EXEMPTIONS.md")
    # 只认这几个 layer 名 —— 否则 markdown 的分隔行(|---|---|)与文末「耦合」表(列不同)
    # 都会被当成豁免条目解析出来(首跑实测踩到过)。
    _LAYERS = {"sentinel", "test-run", "manifest", "p5-observation", "p6-prefetch"}
    if os.path.isfile(ex):
        # 层名允许数字(p5-observation / p6-prefetch);白名单 _LAYERS 仍拦住分隔行与耦合表。
        for m in re.finditer(r"^\|\s*([a-z0-9-]+)\s*\|\s*`?([^|`]+?)`?\s*\|\s*(.+?)\s*\|\s*$",
                             read(ex), re.MULTILINE):
            layer = m.group(1).strip()
            if layer not in _LAYERS:
                continue
            facts["exempt"].setdefault(layer, {})[m.group(2).strip()] = m.group(3).strip()
    return facts


# ★ R7-b 登记表(v3.7.1 立):**已被 Mac 上游收编的 marker**。
# 判据来源不是推理而是实测:`git -C <clone> show <mac-ref>:Horosa-Web/<target>` 里含该 marker
# ⇒ 它由上游基线提供,我方补丁不该(也不可能)携带它。对照组自证(#71):同文件里我方独有的
# horosa_*_render_slice_v1 在 Mac 基线中不存在 —— 判据能分辨两者,不是一律放行。
# 🔴 加新条目前必须先跑这条实测,并在 why 里写清 Mac ref;登记表自身由下方两条断言自清。
UPSTREAM_OWNED_MARKERS = {
    "horosa_prefetch_registry_v1": {
        "why": "v3.7.1(Mac 7405ddfb)整体收编技法步进预取登记机制,注释里的 marker 文本一并进入"
               "上游基线;我方补丁只余具名函数化+反注册+P5 打点等增量,自然不含该 marker。"
               "实测:五个 target 在 7405ddfb 基线中均含该串,而同文件的我方 render_slice marker 不含。",
        "targets": (
            "astrostudyui/src/components/dunjia/DunJiaMain.js",
            "astrostudyui/src/components/guolao/GuoLaoChartMain.js",
            "astrostudyui/src/components/lrzhan/LiuRengMain.js",
            "astrostudyui/src/components/taiyi/TaiYiMain.js",
            "astrostudyui/src/components/ziwei/ZiWeiMain.js",
        ),
    },
    "horosa_step_prefetch_arm_v1": {
        "why": "v3.7.1 上游收编「选步长即武装」机制本体(stepPrefetchArm.js 成为上游文件),"
               "marker 随注释进入基线;我方补丁只余 W3a③ 偏斜台账与 models 侧接线增量。",
        "targets": (
            "astrostudyui/src/utils/stepPrefetchArm.js",
            "astrostudyui/src/utils/perfFlags.js",
            "astrostudyui/src/models/astro.js",
        ),
    },
    "horosa_option_prefetch_v1": {
        "why": "v3.7.1 上游逐字节收编选项 Hamming-1 投机(optionPrefetch.js 转上游文件),"
               "marker 在 perfFlags/models 的注释区随基线到达;我方 files/ 拷贝层同轮退役。",
        "targets": (
            "astrostudyui/src/utils/perfFlags.js",
            "astrostudyui/src/models/astro.js",
        ),
    },
    "horosa_boot_chart_restore_v1": {
        "why": "v3.7.1 上游收编温启现场恢复旗标行(perfFlags 注释区);v3.11.2(Mac 9cd9078f)再收编 "
               "bootChartRestore.js 本体 + 同名测试(带我方 marker 的超集),models/app.js 接线亦上游化 —— "
               "我方 files/ 层与 app.js 补丁退役(#109),marker 三处均由上游基线提供。",
        "targets": ("astrostudyui/src/utils/perfFlags.js",
                    "astrostudyui/src/utils/bootChartRestore.js",
                    "astrostudyui/src/utils/__tests__/bootChartRestore.test.js"),
    },
    "horosa_freeze_subtabs_v1": {
        "why": "v3.7.1 上游收编子页签冻结总闸行(perfFlags 注释区);FreezeInactive.js 本体亦已"
               "上游化(我方补丁退役为 no-op 安全网),组件侧接入点补丁各自携带自己的 marker。",
        "targets": ("astrostudyui/src/utils/perfFlags.js",),
    },
    "horosa_main_chain_abort_v1": {
        "why": "【上游自研,非我方首创】v3.7.1 Mac 新增 /chart 主链 AbortController。登记为上游资产,"
               "R7 不要求我方补丁携带;但 SENT 仍钉住它 —— owner 明令 Mac 优化不得在同步中遗漏。",
        "targets": ("astrostudyui/src/utils/perfFlags.js",),
    },
    "horosa_option_debounce_v1": {
        "why": "【上游自研,非我方首创】v3.7.1 Mac 新增古典参数派发并帧(optionDispatchScheduler)。"
               "同上:R7 豁免、SENT 钉住,防我方 merge 冲掉上游优化。",
        "targets": ("astrostudyui/src/utils/perfFlags.js",),
    },
    "horosa_convert_memo_v1": {
        "why": "【上游自研,非我方首创】v3.7.1 Mac 在 pages/index 做的五处 useMemo 化。"
               "同上:R7 豁免、SENT 钉住(冲掉即报红)。",
        "targets": ("astrostudyui/src/pages/index.js",),
    },
    "horosa_live_time_propagation_v1": {
        "why": "【上游自研,非我方首创】v3.7.3(Mac f8275b32)三式/遁甲「已起盘后改时间即刻重算、"
               "未起盘仍须显式起盘」语义。实测:两个 target 在 v3.7.3 基线中均含该串;对照组同文件的"
               "我方 horosa_sanshi_render_slice_v1 在基线中不存在 ⇒ 判据可分辨,非一律放行。"
               "R7 豁免、SENT 钉住(同步冲掉即报红)。",
        "targets": (
            "astrostudyui/src/components/dunjia/DunJiaMain.js",
            "astrostudyui/src/components/sanshi/SanShiUnitedMain.js",
        ),
    },
    "horosa_sanshi_outer_follow_time_v1": {
        "why": "【上游自研,非我方首创】v3.7.3(Mac f8275b32)三式外圈随时间校正 —— 用户实测三轮才"
               "定位的静默错值(外圈星度冻在起盘那一刻)。marker 同时出现在组件与 models/astro.js"
               "(后者的注释解释 epoch/abort 竞态是其下游病灶),两处实测均在基线中。",
        "targets": (
            "astrostudyui/src/components/sanshi/SanShiUnitedMain.js",
            "astrostudyui/src/models/astro.js",
        ),
    },
    "horosa_chart_epoch_abort_atomic_v1": {
        "why": "【上游自研,非我方首创】v3.7.3 Mac 把 ++fieldsEpoch 与 abort 旧 controller 合并为"
               "原子段(中间不得有 yield),根治两个并发 effect 互相残杀致 chartObj 永不更新。"
               "实测在 v3.7.3 的 models/astro.js 基线中;我方补丁只余 precomputeFetch 等增量。",
        "targets": ("astrostudyui/src/models/astro.js",),
    },
    "horosa_main_chain_abort_default_off_v1": {
        "why": "【上游自研,非我方首创】v3.7.3 Mac 把 mainChainAbort 由默认开改默认关 —— 它不是性能"
               "旗而是**正确性**旗(见 SENT 注)。实测在 v3.7.3 的 perfFlags.js 基线中;"
               "同文件我方 guolaoMergedPaintEnabled 仍由补丁携带,两者各归各。",
        "targets": ("astrostudyui/src/utils/perfFlags.js",),
    },
    "horosa_sanshi_corner_label_mirror_v1": {
        "why": "【上游自研,非我方首创】v3.7.3 Mac 六壬环角宫地支对角镜像(只移地支、宫位数字不动)。"
               "实测在 v3.7.3 的 SanShiUnitedMain.js 基线中。",
        "targets": ("astrostudyui/src/components/sanshi/SanShiUnitedMain.js",),
    },
    "horosa_zeri_idle_prerender_v1": {
        "why": "【上游自研,非我方首创】v3.7.3 Mac 奇门择日子页签空闲预挂载(requestIdleCallback + "
               "forceRender,带 localStorage kill-switch)。实测在 v3.7.3 的 ZeriMain.js 基线中;"
               "我方在该文件无补丁,登记此条是为将来若加补丁时不被误判 STALE。",
        "targets": ("astrostudyui/src/components/zeri/ZeriMain.js",),
    },
    "horosa_change_cond_no_mutate_v1": {
        "why": "v3.7.1 上游收编 changeCond 深拷贝止血(我方 R9 首创,渲染优化的前提条件),"
               "marker 随基线到达;我方补丁只余 ensureField 守卫与 lat 字串化等 Windows 增量。",
        "targets": ("astrostudyui/src/pages/index.js",),
    },
    "horosa_data_warm_registry_v1": {
        "why": "v3.7.1 上游整文件收编数据层预热注册表(dataWarmTasks.js 转上游文件,含前四条任务);"
               "我方补丁只余四条 Windows 增补任务(direction:pd/india:birth/germany:midpoint/jieqi:year)。",
        "targets": ("astrostudyui/src/utils/dataWarmTasks.js",),
    },
    "horosa_dedupe_l1_lru_v1": {
        "why": "v3.7.1 上游收编 L1 命中重插(真 LRU)修复,marker 随基线到达;"
               "我方补丁只余 '/chart3d' 落桶前缀这一条 Windows-ahead 增量。",
        "targets": ("astrostudyui/src/utils/requestDedupe.js",),
    },
    "horosa_prefetch_runtime_whitelist_v1": {
        "why": "v3.7.1 上游收编运行时白名单闸(含 request/chartFetch 两层纵深),marker 随基线到达;"
               "我方补丁只余 fast-first 快发与 '/chart3d' 白名单补位。",
        "targets": ("astrostudyui/src/utils/stepPrefetch.js",),
    },
    # —— v3.7.2 上游「三式合一连续进退大修」四条(全部上游自研,我方零首创)——
    # 判据同上,已实测:四个 marker 均在 Mac 7d8a93ef 基线的 SanShiUnitedMain.js 中。
    # 我方在同文件的独有资产(render_slice 三件套 / commitPatch / sanshi:jieqiseed)照常由补丁携带。
    "horosa_sanshi_step_prefetch_v1": {
        "why": "v3.7.2 上游新增三式步进预取链式单任务(nongli→奇门后端盘+太乙盘),GuoLao G6 同型超集,"
               "取代我方 R9 的多任务并列;marker 由上游基线提供。我方只余 sanshi:jieqiseed 增量任务。",
        "targets": ("astrostudyui/src/components/sanshi/SanShiUnitedMain.js",),
    },
    "horosa_sanshi_no_drop_step_v1": {
        "why": "【上游自研】v3.7.2 重算期起盘请求不再静默丢弃,改队列化 + trailing 静默期补发。"
               "R7 豁免、SENT 钉住:我方 merge 冲掉它 = 连续进退丢击回潮,必须当场报红。",
        "targets": ("astrostudyui/src/components/sanshi/SanShiUnitedMain.js",),
    },
    "horosa_sanshi_no_wait_chart_v1": {
        "why": "【上游自研】v3.7.2 撤掉等 /chart 回流的 1200ms 兜底 timer,立即用现值起算,"
               "靠 recalcSignature(含 isDiurnal/outerChartKey)自动校正。同上:R7 豁免、SENT 钉住。",
        "targets": ("astrostudyui/src/components/sanshi/SanShiUnitedMain.js",),
    },
    "horosa_sanshi_snapshot_idle_v1": {
        "why": "【上游自研】v3.7.2 把 ~950ms 的三盘快照大构建从 setTimeout(120) 挪到 requestIdleCallback"
               "(timeout 4000 兜底),连击期间逐次作废。同上:R7 豁免、SENT 钉住。",
        "targets": ("astrostudyui/src/components/sanshi/SanShiUnitedMain.js",),
    },
    "horosa_prefetch_pump_livelock_v1": {
        "why": "【上游自研,非我方首创】v3.7.1 Mac 修的泵活锁(排干旧代 + rIC 500ms 保底)。"
               "与我方 fast-first 互补(它保底、我方保首发),R7 豁免、SENT 钉住防冲掉。",
        "targets": ("astrostudyui/src/utils/stepPrefetch.js",),
    },
}


def check_overlay_contract_coverage():
    """PERF-R9:五层契约完整性交叉核对 —— owner「零上下文 session 也不能丢改进」的兑现物。

    单看任何一层都会漏:补丁在但没接进 apply.sh(重同步后不还原)、接了但没哨兵(被上游冲掉
    无人知)、有哨兵但 guard 串与钉的串不是同一个(任一侧改名即静默失效)、台账没登记
    (下一个人看不见它存在)。本门把四层交叉核对。

    ★ 全部输入都是仓库内文件 + 内存里的 SENT ⇒ **不依赖 win-unpacked / pwsh / Git-Bash,
      因此永远不会像 kentang / all-services 那两道门一样降级成 SKIP=PASS。**
    ★ R7(补丁新鲜度)是本轮补上的第七条,详见其就地注释:R1-R6 只验契约骨架在不在,
      **完全查不出"补丁内容没跟上产品源"** —— 而那正是本轮实测到 12 个补丁所处的状态,
      后果是下次同步静默丢改动且无任何信号。R7 判据刻意自足(不依赖 Mac clone 目录存在)。
    """
    name = "five-layer overlay contract coverage"
    f = _overlay_contract_facts()
    if not f["patch_target"] or not f["apply"]:
        record(name, False, "windows-adaptations/{patches,apply.sh} not readable")
        return

    sent = globals().get("_SENT_LAST")
    if not sent:
        record(name, False, "check_sentinels() must run BEFORE this gate (no SENT snapshot)")
        return

    bad = []
    patches = set(f["patch_target"])
    referenced = [a["patch"] for a in f["apply"]]

    # R1 补丁 ↔ apply.sh 双射
    for p in sorted(patches - set(referenced)):
        bad.append(f"R1 orphan patch (never applied): {p}")
    for p in sorted(set(referenced) - patches):
        bad.append(f"R1 apply.sh references a missing patch: {p}")
    for p in sorted({x for x in referenced if referenced.count(x) > 1}):
        bad.append(f"R1 patch referenced {referenced.count(p)}x: {p}")

    # R2 补丁头目标 == apply.sh 的 $2
    for a in f["apply"]:
        want = f["patch_target"].get(a["patch"])
        if want and want.replace("\\", "/") != a["target"].replace("\\", "/"):
            bad.append(f"R2 target mismatch: apply.sh says {a['target']}, patch header says {want}")

    # R3 每个补丁文件名在台账里字面出现(格式无关:只认文件名子串)
    for p in sorted(patches):
        if p not in f["ledger_text"]:
            bad.append(f"R3 not in README ledger: {p}")

    # R4 每个目标都有哨兵,且 apply.sh 的 guard 串必须是该条目的一个钉
    sent_by_rel = {}
    for k, needles in sent.items():
        try:
            rel = os.path.relpath(k, WS).replace(os.sep, "/")
        except Exception:
            continue
        if not rel.startswith(".."):
            sent_by_rel[rel] = needles
    exempt_sent = f["exempt"].get("sentinel", {})
    for a in f["apply"]:
        rel = a["target"].replace("\\", "/")
        if rel in exempt_sent:
            continue
        needles = sent_by_rel.get(rel)
        if needles is None:
            bad.append(f"R4 no sentinel for patched target: {rel}")
        elif not any(a["marker"] in n or n in a["marker"] for n in needles):
            bad.append(f"R4 apply.sh guard '{a['marker']}' is NOT a sentinel needle for {rel} "
                       f"— rename either side and the other silently no-ops")

    # ★ R8 守卫必须是补丁自己带的 marker(v3.10.0 立,#94 三连击的类修复)。
    #
    # 失效模式(TaiYiMain 实炸,潜伏三轮):apply.sh 守卫用了一个**上游已收编**的 marker
    # (v3.7.1 R7-b 在册),port 后目标文件天然含该串 ⇒ 守卫判「already has」⇒ 整补丁
    # 静默跳过,补丁残余的 FreezeSubTab/markPanelReady 双丢 —— R1-R7 全绿(R7 只查
    # 「文件里的 marker 在不在补丁里」,查不了「守卫这个 marker 早就不再由补丁供给」)。
    # 判据:每条 apply_patch 的 guard 串必须能在其补丁的**新增行**里找到 —— 守卫由补丁
    # 自己供给,wholesale-replace 后守卫必然缺席 ⇒ 补丁必然重打,永不静默跳过。
    # (#49 no-op 安全网也满足本判据:安全网补丁的内容就是把收编改动连 marker 一起打回去。)
    for a in f["apply"]:
        ptext = read(os.path.join(REPO, "windows-adaptations", "patches", a["patch"]))
        added = "\n".join(l for l in ptext.splitlines() if l.startswith("+") and not l.startswith("+++"))
        if a["marker"] not in added:
            bad.append(f"R8 guard '{a['marker']}' is NOT among added lines of {a['patch']} "
                       f"— after a wholesale-replace the guard can pre-exist (upstream-absorbed) "
                       f"and the whole patch silently skips (gotcha #94/#103)")

    # R6 台账头的数字 == 实际行数
    mh = re.search(r"## The adaptations \((\d+)\)", f["ledger_text"])
    rows = len(re.findall(r"(?m)^\|\s*\d+\s*\|", f["ledger_text"]))
    if mh and int(mh.group(1)) != rows:
        bad.append(f"R6 ledger header says {mh.group(1)} but there are {rows} rows")

    # ★ R7 补丁新鲜度 —— 本轮**咬中两次**才补上的一条,R1-R6 全都查不出它。
    #
    # 失效模式:产品源上又加了一处 Windows 改动,但**忘了重新 regen 累积补丁**。此时
    # R1(补丁存在)、R2(头部目标对)、R3(台账有名字)、R4(guard 是哨兵钉)、R6(行数对)
    # **全部通过** —— 因为它们只验"契约的骨架在不在",不验"补丁内容跟没跟上产品源"。
    # 后果:下次 Mac 同步 wholesale-replace 之后 apply.sh 照跑不误、[ok] 照样打印,
    # 而那处改动**已经永久消失**,且没有任何信号。本轮实测发现 12 个补丁处于这个状态。
    #
    # 判据(自足,不需要 Mac clone —— 那个目录不保证存在,依赖它会让门降级成 SKIP=PASS):
    #   产品源文件里出现的每个 `horosa_*_v<N>` marker,都必须能在它的补丁里作为**新增行**找到。
    #   marker 是本仓库给每处 Windows 改动打的记号,所以"文件里有、补丁里没有"精确等价于
    #   "这处改动不在补丁里" = 补丁陈旧。
    # 只查 marker 不查全文,是刻意的:补丁允许与产品源有格式层面的细微差异(LF 归一等),
    # 但**不允许少一处改动**。
    ws_root = os.path.join(REPO, "local", "workspace",
                           "Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c")
    mrx = re.compile(r"horosa_[a-z0-9_]+_v\d+")
    sent_now = globals().get("_SENT_LAST") or {}
    for fn, target in sorted(f["patch_target"].items()):
        src = os.path.join(ws_root, target.replace("/", os.sep))
        if not os.path.isfile(src):
            continue
        src_text = read(src)
        in_src = set(mrx.findall(src_text))
        if not in_src:
            continue
        ptext = read(os.path.join(REPO, "windows-adaptations", "patches", fn))
        in_patch = set()
        for line in ptext.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                in_patch.update(mrx.findall(line))
        # ★ R7-b(v3.7.1 新判例):**marker 被上游收编**后的假阳。
        # 上游采纳我方首创时,会把注释里的 marker 文本一并收编(v3.7.1 实测:
        # horosa_prefetch_registry_v1 进入 Mac 基线的四个技法主组件)。此后产品源里有该 marker
        # (**上游给的**),而我方补丁里没有(diff 不产生基线已有的行)—— R7 原判据精确命中
        # 「文件里有、补丁里没有」而报 STALE = 假阳。
        # 🔴 绝不用「补丁没有就算了」放宽判据(那会让**真陈旧**一起漏网,正是 R7 存在的理由)。
        # 改为**显式登记 + 双向自证**:登记精确到 (marker, target) 不放大到 marker 全域;
        # 且每条登记必须当场自证仍成立(见下方 UPSTREAM_OWNED_MARKERS 的两条断言)——
        # marker 若被上游将来删掉,SENT 哨兵门先红,豁免不制造盲区。
        upstreamed = {m for m in in_src
                      if target in UPSTREAM_OWNED_MARKERS.get(m, {}).get("targets", ())}
        missing = sorted(in_src - in_patch - upstreamed)
        if missing:
            bad.append(f"R7 patch '{fn}' is STALE — marker(s) {', '.join(missing[:3])} exist in "
                       f"{target} but are not in the patch; re-run regen_patch.py or the next "
                       f"Mac sync silently drops them")

    # R7-b 登记表自身的卫生(过期豁免 = 新盲区,必须自清):
    #   ① 登记的 target 现在确实含该 marker(否则本条登记已无意义,删之);
    #   ② SENT 仍钉着它(上游若删掉该 marker,由哨兵门报红而不是被本豁免吞掉)。
    for marker, meta in sorted(UPSTREAM_OWNED_MARKERS.items()):
        if len(meta.get("why", "")) < 40:
            bad.append(f"R7-b '{marker}' 豁免理由过薄({len(meta.get('why',''))} 字)= 占位理由等同未登记")
        for target in meta.get("targets", ()):
            src = os.path.join(ws_root, target.replace("/", os.sep))
            if not os.path.isfile(src) or marker not in read(src):
                bad.append(f"R7-b stale exemption: '{marker}' 已不在 {target} 里 —— 删除该登记")
                continue
            pinned = any(marker in needles
                         for path, needles in sent_now.items()
                         if os.path.normpath(path).endswith(os.path.normpath(target)))
            if not pinned:
                bad.append(f"R7-b '{marker}'@{target} 被豁免出 R7,但 SENT 未钉它 —— "
                           f"上游哪天删掉它将无人报警;先补哨兵针再谈豁免")

    # 豁免自身的卫生:理由必须实质化,且键必须还存在
    for layer, entries in f["exempt"].items():
        for key, why in entries.items():
            if len(why) < 40 or why.strip().lower() in ("todo", "tbd", "-", "n/a"):
                bad.append(f"EXEMPT[{layer}] '{key}' reason too thin ({len(why)} chars) — "
                           f"占位理由等同未登记")

    if bad:
        record(name, False, f"{len(bad)} contract hole(s) | " + " ; ".join(bad[:5]))
        return
    record(name, True,
           f"{len(patches)} patches x {len(f['apply'])} apply rows x {rows} ledger rows "
           f"— R1/R2/R3/R4/R6/R7/R8 clean")


def check_perf_inventory_sync():
    """PERF-R9:性能改进总账必须与代码同步 —— 否则它就是一份会腐烂的文档。

    P1 不许说谎:总账「哨兵」列里写的每个钉,必须在 `SENT` 里真实存在。**这条是这份文件值得
       存在的全部理由** —— 声称有覆盖而实际没有,比没有文档更危险。
    P2 开关必须真在(账→代码,PERF-R10 I4 才补上的实现):总账里写到名字的每个
       `horosa.perf.X` / `HOROSA_X`,必须在 perfFlags.js / 补丁新增行 / 壳层 / 台架里真实存在。
       ⚠️ 总账头部从建账第一天就**宣称**有 P2,实际两轮里从未实现 —— 上游同步悄悄删掉一个
          kill-switch、或账上笔误一个开关名,全都无声通过。「宣称的门」必须变成真门。
    P3 反向覆盖(三半,缺任何一半 = 门只是装饰):
       P3a `perfFlags.js` 里定义的每个 `horosa.perf.*`(前端 localStorage 开关);
       P3b **任何 overlay 补丁新增行里出现的 `HOROSA_*` 环境开关**(Python / Java 的
           kill-switch 全走这条路,一个都不经过 perfFlags.js);
       P3c **壳层(electron/*.js,排除 *.test.js)自己 `process.env.HOROSA_*` 读的开关**——
           壳层文件不是 overlay 补丁管的,early-nav / bg-throttle / V8 cache 这类纯壳层
           性能开关结构性地在 P3b 门外(本门首跑即抓出 44 个未登记开关:8 个真性能开关
           补了 JV-13/JV-14 行,其余非性能开关逐条豁免)。
       ⇒ **你没法加一个性能开关而不进总账。** 这正是 owner「零上下文 session 也要全面落实」的机械化。
       ⚠️ 本门最初只建了 P3a,于是整个后端开关族在门外 —— 门是绿的而覆盖是零。发现经过:
          新增两个 Python 开关后门居然不响。这类「看着有门、其实没查」比没有门更危险。
    """
    name = "perf inventory in sync"
    inv = os.path.join(REPO, "windows-adaptations", "PERF_INVENTORY.md")
    if not os.path.isfile(inv):
        record(name, False, "PERF_INVENTORY.md MISSING")
        return
    sent = globals().get("_SENT_LAST")
    if not sent:
        record(name, False, "check_sentinels() must run BEFORE this gate")
        return
    text = read(inv)
    all_needles = {n for needles in sent.values() for n in needles}

    bad = []
    # P1:总账里出现的每个 horosa_*_v1 记号,必须是某条哨兵真实钉住的串。
    for tok in sorted(set(re.findall(r"horosa_[a-z0-9_]+_v\d+", text))):
        if tok not in all_needles:
            bad.append(f"P1 inventory claims sentinel '{tok}' but no SENT entry pins it")

    # P3a:perfFlags.js 定义的每个 horosa.perf.* 都必须在总账里被提到。
    pf = os.path.join(UI, "src", "utils", "perfFlags.js")
    if os.path.isfile(pf):
        for flag in sorted(set(re.findall(r"horosa\.perf\.([A-Za-z0-9_]+)", read(pf)))):
            if ("horosa.perf." + flag) not in text and flag not in text:
                bad.append(f"P3a perf flag 'horosa.perf.{flag}' has no PERF_INVENTORY row")

    # P3b:**任何 overlay 补丁新引入的 HOROSA_* 环境开关**也必须有总账行。
    # 为什么必须有这一条:P3a 只看 perfFlags.js,那是前端 localStorage 开关的注册处;而
    # Python / Java / 壳层的 kill-switch 全是 `HOROSA_*` 环境变量,**一个都不经过 perfFlags.js**。
    # 只建 P3a 时,整个后端开关族在门外 —— 门看着是绿的,实际对本轮绝大多数开关零覆盖
    # (本条正是这样被发现的:新增两个 Python 开关而门不响)。这类「看着有门、其实没查」
    # 比没有门更危险,因为它让人停止检查。
    # 只扫**补丁新增行**(以 '+' 开头且非 '+++' 头),即「Windows 侧自己引入的开关」;
    # 上游 Mac 本就有的环境变量不在本表职责内。
    pdir = os.path.join(REPO, "windows-adaptations", "patches")
    seen_env = set()
    if os.path.isdir(pdir):
        for fn in sorted(os.listdir(pdir)):
            if not fn.endswith(".patch"):
                continue
            for line in read(os.path.join(pdir, fn)).splitlines():
                if not line.startswith("+") or line.startswith("+++"):
                    continue
                for env in re.findall(r"\bHOROSA_[A-Z0-9_]+\b", line):
                    seen_env.add((env, fn))
    # 豁免:**不是性能开关**的 HOROSA_*(运行时身份/账本/路径/冒烟钩子/配置注入)。
    # 逐条写明理由 —— 空豁免会随时间腐烂成「凡是麻烦的都塞进来」。新增条目必须说清
    # 「它改变的不是快慢,而是什么」。若某条将来确实获得了性能语义,应移出本表并补总账行。
    P3B_EXEMPT = {
        "HOROSA_LEDGER_FILE": "启动账本输出路径 —— 观测产物落点,不影响任何代码路径快慢",
        "HOROSA_RUN_TAG": "账本行的运行标签 —— 纯标注",
        "HOROSA_SWISSEPH_PATH": "星历文件目录注入 —— 决定去哪读,不决定读得快慢",
        "HOROSA_RUNTIME_OWNER": "运行时归属标记(Web 版/桌面版互不误杀的身份位)",
        "HOROSA_NO_BROWSER": "Web 启动器冒烟钩子:不自动开浏览器",
        "HOROSA_SMOKE_TEST": "Web 启动器冒烟钩子:就绪后自动停",
        "HOROSA_SMOKE_WAIT_SECONDS": "Web 启动器冒烟钩子:等待窗口秒数",
        "HOROSA_SHIP_FAT_JAR": "增量更新的紧急逃生开关 —— 改的是发货形态,不是运行快慢",
        "HOROSA_CHART_PORT": "排盘服务端口号 —— 配置项,与性能无关",
        "HOROSA_LOG_BASEDIR_REV": "日志根目录 —— 落点配置,与性能无关",
        "HOROSA_OFFICIAL_REPO": "「关于」面板里的官方仓库 URL —— 纯文案链接",
    }
    for env, fn in sorted(seen_env):
        if env in P3B_EXEMPT or env in text:
            continue
        bad.append(f"P3b env switch '{env}' (introduced by {fn}) has no PERF_INVENTORY row")

    # P3c:壳层 electron/*.js 自读的每个 HOROSA_*(排除 *.test.js —— 测试只消费既有开关,
    # 不引入)。豁免表与 P3B 同款卫生:只收「不是性能开关」的条目,逐条写明它改变的是什么;
    # 且豁免的开关必须仍在壳层存在(否则 = 陈旧豁免,FAIL —— 与 P5/P6 的陈旧豁免规则同源)。
    P3C_EXEMPT = {
        "HOROSA_BACKEND_WATCHDOG": "后台服务看门狗总闸 —— 崩溃自愈稳健性,不改任何热路径快慢",
        "HOROSA_WATCHDOG_CONFIRM": "看门狗重启前二次确认窗口 —— 稳健性参数",
        "HOROSA_BOOT_LOOP_BREAKER": "启动循环熔断 —— 连续崩溃时停止自动重启的故障保护",
        "HOROSA_CHART_PORT_BASE": "排盘服务端口基址 —— 端口配置,与快慢无关",
        "HOROSA_SERVER_PORT_BASE": "Java 服务端口基址 —— 端口配置",
        "HOROSA_CHART_PROBE_BLOCKING": "就绪探测的阻塞语义 —— 影响的是判定方式,不是业务路径速度",
        "HOROSA_CHART_PROBE_ESCALATE": "就绪探测升级策略 —— 稳健性",
        "HOROSA_CHILD_LOG_CAP": "子进程日志封顶开关 —— 日志治理(防日志把盘写满)",
        "HOROSA_CHILD_LOG_CAP_BYTES": "子进程日志封顶字节数 —— 日志治理参数",
        "HOROSA_CRASH_DUMPS": "崩溃转储收集 —— 诊断产物,不在业务路径上",
        "HOROSA_DESKTOP_RUNTIME_CACHE_DIR": "运行时缓存目录落点覆盖 —— 决定放哪,不决定快慢",
        "HOROSA_RUNTIME_CACHE_DIR": "运行时缓存目录落点(旧名兼容位)",
        "HOROSA_HEAL_HISTORY": "自愈历史账本 —— 观测产物落点",
        "HOROSA_HEAL_NOTICE": "自愈完成后的用户提示 —— 纯 UX 文案开关",
        "HOROSA_JAVA_EXIT_ON_OOM": "OOM 时退出而非挂死 —— 稳健性策略",
        "HOROSA_JAVA_XMX": "Java 堆上限 —— 容量参数;当前值即产品默认,未参与任何调优轮;"
                           "若未来做堆调优应移出本表并补总账行",
        "HOROSA_JVM_CDS_LOG": "CDS 命中日志 —— 观测钩子,开了只多写日志",
        "HOROSA_LEDGER_FILE": "启动账本输出路径 —— 观测产物落点(与 P3B 同条目)",
        "HOROSA_RUN_TAG": "账本行运行标签 —— 纯标注(与 P3B 同条目)",
        "HOROSA_STARTUP_LEDGER": "启动账本总闸 —— 观测本身,不改被观测路径",
        "HOROSA_PAYLOAD_COPY_RETRY": "载荷拷贝失败重试次数 —— 稳健性参数",
        "HOROSA_PERF_DEBUG_PORT": "验收台架的 CDP 调试端口 —— perf_acceptance.cjs 专用观测钩子,"
                                  "默认不设即完全不生效",
        "HOROSA_PRECHECK_SHA": "载荷预检 sha 校验 —— 完整性门,改的是安全性不是速度",
        "HOROSA_PREPARE_RUNTIME": "安装器调用的 prepareruntime 流程入口 —— 流程钩子;"
                                  "首启加速机制本身在安装流程行有账",
        "HOROSA_PY_CHART_TIMING": "Python 排盘逐段计时 —— 观测钩子",
        "HOROSA_QUARANTINE_GC": "隔离区(旧 payload)清理 —— 磁盘治理",
        "HOROSA_RENDERER_AUTO_RELOAD": "渲染进程崩溃自动重载 —— 稳健性",
        "HOROSA_RENDERER_PROXY": "渲染器走代理调试 —— 开发钩子",
        "HOROSA_RESTART_LOADING_SWAP": "重启时 loading 屏切换语义 —— UX 行为",
        "HOROSA_TASKKILL_ABS": "taskkill 用绝对路径 —— 敌意 PATH 加固(安全)",
        "HOROSA_UPDATE_FAIL_ATTRIBUTION": "更新失败归因上报 —— 更新链路诊断",
        "HOROSA_UPDATE_FAIL_NOTICE": "更新失败用户提示 —— UX 文案",
        "HOROSA_UPDATE_FEED_URL": "更新源 URL 覆盖 —— 更新链路配置",
        # v3.11.0 桌面桥 / 本机 MCP / 外部 MCP 客户端 / 定时心跳 / 通知钩(horosa_desktop_bridge_electron_v1):全是功能 kill-switch 或端口配置,
        # 与任何热路径快慢无关;上游 Tauri 侧同名(HOROSA_MCP_SERVER / HOROSA_MCP_CLIENT / HOROSA_SCHEDULER / HOROSA_NOTIFY_HOOK)
        "HOROSA_MCP_SERVER": "本机 MCP 服务总闸(=0 强制不起,覆盖偏好)—— 功能 kill-switch",
        "HOROSA_MCP_PORT": "本机 MCP 服务首选端口(缺省 39991,顺位试 +8)—— 端口配置",
        "HOROSA_MCP_MODERN": "MCP 2026-07-28 现代纪元车道开关(=0 只留旧纪元)—— 协议兼容位",
        "HOROSA_MCP_CLIENT": "外部 MCP 客户端总闸(=0 拒连一切外部服务器)—— 功能 kill-switch",
        "HOROSA_SCHEDULER": "定时任务哑心跳总闸(=0 零跳动)—— 功能 kill-switch",
        "HOROSA_NOTIFY_HOOK": "通知脚本钩总闸(=0 永不 spawn)—— 功能 kill-switch",
        "HOROSA_UPDATE_INTENT": "更新意图标记 —— 更新链路状态位",
        "HOROSA_UPDATE_SPLASH": "更新期间的过场屏 —— UX",
        "HOROSA_USERDATA_AUTORESTORE": "用户数据自动恢复 —— 稳健性(备份回灌)",
    }
    el_env = {}
    el_dir = os.path.join(BUNDLE, "electron")
    if os.path.isdir(el_dir):
        for fn in sorted(os.listdir(el_dir)):
            if not fn.endswith(".js") or fn.endswith(".test.js"):
                continue
            for env in re.findall(r"process\.env\.(HOROSA_[A-Z0-9_]+)", read(os.path.join(el_dir, fn))):
                el_env.setdefault(env, fn)
    for env in sorted(el_env):
        if env in P3C_EXEMPT or env in text:
            continue
        bad.append(f"P3c shell switch '{env}' ({el_env[env]}) has no PERF_INVENTORY row")
    for env in sorted(P3C_EXEMPT):
        if env not in el_env:
            bad.append(f"P3c stale exemption '{env}' — no longer read by any electron/*.js")

    # P2(账→代码):总账写到名字的每个开关必须真实存在。
    # 前端侧:每个 `horosa.perf.X` 必须在**前端产品源**里真实被读(排除 __tests__ —— 只有
    # 测试提到的开关等于不存在)。草堆是整个 UI src 而不只 perfFlags.js:perfMark.js 这类
    # 模块直读 localStorage,不经 perfFlags(首跑的 interactionMarks 误报教会的)。
    # 前缀命中也算 —— 总账里有 `horosa.perf.planetarium*` 家族写法;`horosa.perf.X` 是表头占位。
    ui_flags = set()
    for dirpath, dirs, files in os.walk(os.path.join(UI, "src")):
        dirs[:] = [x for x in dirs if x not in ("__tests__", "node_modules")]
        for fn in files:
            if fn.endswith(".js"):
                ui_flags |= set(re.findall(r"horosa\.perf\.([A-Za-z0-9_]+)", read(os.path.join(dirpath, fn))))
    for tok in sorted(set(re.findall(r"horosa\.perf\.([A-Za-z0-9_]+)", text))):
        if tok == "X":
            continue
        if tok not in ui_flags and not any(f.startswith(tok) for f in ui_flags):
            bad.append(f"P2 inventory names 'horosa.perf.{tok}' but no UI src file reads it")
    # env 侧:每个 `HOROSA_X` 必须在真实载体里存在 —— 补丁新增行(seen_env,产品源开关的唯一
    # 引入通道)∪ 壳层/打包脚本/黄金台架/files 层的代码文件。刻意不把 .md 收进草堆:
    # 文档互引会让门循环自证(总账写了 = 门就绿),那就不是门了。
    env_hay = {e for e, _ in seen_env} | set(el_env)
    _CODE_EXT = (".js", ".cjs", ".mjs", ".py", ".ps1", ".sh", ".bat", ".java")
    for d in (os.path.join(BUNDLE, "electron"), os.path.join(BUNDLE, "scripts"),
              os.path.join(REPO, "windows-adaptations", "golden"),
              os.path.join(REPO, "windows-adaptations", "files")):
        if not os.path.isdir(d):
            continue
        for dirpath, dirs, files in os.walk(d):
            dirs[:] = [x for x in dirs if x not in ("node_modules", "__pycache__")]
            for fn in files:
                if fn.endswith(_CODE_EXT):
                    env_hay |= set(re.findall(r"\bHOROSA_[A-Z0-9_]+\b", read(os.path.join(dirpath, fn))))
    p2_envs = sorted(set(re.findall(r"\bHOROSA_[A-Z0-9_]+\b", text)))
    for env in p2_envs:
        if env == "HOROSA_X":
            continue
        if env not in env_hay:
            bad.append(f"P2 inventory names '{env}' but it exists in no patch/shell/harness code file")

    if bad:
        record(name, False, f"{len(bad)} drift(s) | " + " ; ".join(bad[:6]))
        return
    rows = len(re.findall(r"(?m)^\| (PY|JV|FE)-\d+ \|", text))
    record(name, True, "%d inventory rows; P1 + P2 (%d flags + %d envs named all exist) + P3a (%d perf flags) "
                       "+ P3b (%d env switches from patches) + P3c (%d shell switches, %d exempt) clean"
           % (rows,
              len({t for t in re.findall(r"horosa\.perf\.([A-Za-z0-9_]+)", text) if t != "X"}),
              len([e for e in p2_envs if e != "HOROSA_X"]),
              len(set(re.findall(r"horosa\.perf\.([A-Za-z0-9_]+)", read(pf)))) if os.path.isfile(pf) else 0,
              len({e for e, _ in seen_env}),
              len(el_env), len(P3C_EXEMPT)))


def check_perf_observation_coverage():
    """PERF-R10 P5:观测覆盖门 —— navigationPages 的每个技法键必须「可测」。

    为什么非有不可:owner 的验收口径是「点击 → 中右栏画完」,量它的唯一手段是
    markPanelReady(<页签键>) 与捕获期起点配对。PERF-R9 的实测教训是**观测缺口静默存在**:
    ① shusuan/mingother 打的是 serviceKey('shaozi' 等)≠ 页签键 → perfMark 归属校验全丢,
       验收「恒零样本」却没有任何门报警(样本数为零既不算 PASS 也不算 FAIL,直接不可见);
    ② planetarium/xuanshi 整技法零打点 —— 优化了也无从验收。
    本门把「每个技法必须有终点打点(或显式豁免)」变成发布硬条件:
      · 字面覆盖:产品源(不含 __tests__)存在 markPanelReady('<key>');
      · 动态覆盖:CONTRACT_EXEMPTIONS.md p5-observation 层登记 `dynamic:<UI 相对路径>`,
        该文件必须同时含 `markPanelReady(` 与 `moduleKey: '<key>'`(KinAstroMain 形态 ——
        一个宿主组件按 config 分发多个页签键);
      · 豁免:同层普通行,理由 ≥40 字(契约门的卫生循环复用);键已不在 navigationPages
        的陈旧豁免 = FAIL。
    反向卫生:产品源里出现的**字面**归属键必须 ∈ navigationPages ∪ {yanqin}
    (yanqin = mingother 的伪页签,currentTab 可取它)—— typo 或 serviceKey 类打点在此现形。
    判据自检(#71):navigationPages 解析不出或键数 <20 一律 FAIL,不许静默降级成 PASS。
    全部输入 = 仓库内文件 ⇒ 永不 SKIP。
    """
    name = "P5 panel-ready observation coverage"
    idx_path = os.path.join(UI, "src", "pages", "index.js")
    if not os.path.isfile(idx_path):
        record(name, False, "pages/index.js missing")
        return
    m = re.search(r"const navigationPages = \[(.*?)\n\];", read(idx_path), re.S)
    if not m:
        record(name, False, "navigationPages block not found — 判据自身失真(#71),不许静默 PASS")
        return
    keys = re.findall(r"key:\s*'([A-Za-z0-9_]+)'", m.group(1))
    if len(keys) < 20:
        record(name, False, f"only {len(keys)} navigationPages keys parsed — 判据自身失真(#71)")
        return

    lit_rx = re.compile(r"markPanelReady\('([A-Za-z0-9_]+)'\)")
    covered = set()
    for dirpath, dirs, files in os.walk(os.path.join(UI, "src")):
        dirs[:] = [d for d in dirs if d not in ("__tests__", "node_modules")]
        for fn in files:
            if fn.endswith(".js"):
                covered |= set(lit_rx.findall(read(os.path.join(dirpath, fn))))

    ex = _overlay_contract_facts()["exempt"].get("p5-observation", {})
    bad = []
    allowed = set(keys) | {"yanqin"}
    for k in sorted(covered - allowed):
        bad.append(f"P5 stray literal markPanelReady('{k}') — not a navigationPages key (typo/serviceKey?)")
    dynamic_n = exempt_n = 0
    for k in keys:
        if k in covered:
            continue
        why = ex.get(k)
        if not why:
            bad.append(f"P5 '{k}' has NO markPanelReady('{k}') and NO p5-observation row")
            continue
        dm = re.match(r"dynamic:(\S+)", why)
        if not dm:
            exempt_n += 1
            continue
        dynamic_n += 1
        t_path = os.path.join(UI, dm.group(1).replace("/", os.sep))
        if not os.path.isfile(t_path):
            bad.append(f"P5 dynamic mapping for '{k}' points at missing file {dm.group(1)}")
            continue
        t = read(t_path)
        if "markPanelReady(" not in t or f"moduleKey: '{k}'" not in t:
            bad.append(f"P5 dynamic mapping for '{k}' broken in {dm.group(1)} "
                       f"(needs markPanelReady( AND moduleKey: '{k}')")
    for k in sorted(ex):
        if k not in keys:
            bad.append(f"P5 stale exemption '{k}' — key no longer in navigationPages")

    if bad:
        record(name, False, f"{len(bad)} hole(s) | " + " ; ".join(bad[:5]))
        return
    record(name, True, f"{len(keys)} technique keys — {len(covered & set(keys))} literal, "
                       f"{dynamic_n} dynamic, {exempt_n} exempt")


def check_prefetch_registry_coverage():
    """PERF-R10 P6:预取覆盖门 —— 每个技法键必须「有预取器」或「有显式豁免」。

    owner 主诉求是「选完步长第一下也不能卡」,兑现机制 = 武装(stepPrefetchArm)按当前技法
    从 REGISTRY 取该技法的端点预取器。**没登记的技法,武装只剩共享 /chart,技法端点照旧冷付**
    —— 而这在运行期零信号(预取是优化,缺了只是慢,不红)。本门把覆盖面变成发布硬条件:
      · 字面登记:产品源存在 registerStepPrefetcher('<key>');
      · 动态登记:p6-prefetch 层 `dynamic:<UI 相对路径>`,该文件须同时含
        `registerStepPrefetcher(` 与 `moduleKey: '<key>'`(KinAstroMain 按 config 分发多键);
      · 豁免:同层普通行 ≥40 字(随机起卦/纯本地引擎/双人不可预判/取现时等结构性理由)。
    反向卫生:字面登记键必须 ∈ navigationPages —— typo 键在此现形(注册进查不到的键 = 白登)。
    判据自检(#71)与陈旧豁免规则同 P5。全输入 = 仓库内文件 ⇒ 永不 SKIP。
    """
    name = "P6 step-prefetch registry coverage"
    idx_path = os.path.join(UI, "src", "pages", "index.js")
    if not os.path.isfile(idx_path):
        record(name, False, "pages/index.js missing")
        return
    m = re.search(r"const navigationPages = \[(.*?)\n\];", read(idx_path), re.S)
    if not m:
        record(name, False, "navigationPages block not found — 判据自身失真(#71)")
        return
    keys = re.findall(r"key:\s*'([A-Za-z0-9_]+)'", m.group(1))
    if len(keys) < 20:
        record(name, False, f"only {len(keys)} navigationPages keys parsed — 判据自身失真(#71)")
        return

    # (?<!un):unregisterStepPrefetcher('key') 不算登记 —— 负向自证首跑就抓到这条
    # (卸载行让键假性在册,门失去「缺登记」分辨力)。
    reg_rx = re.compile(r"(?<!un)registerStepPrefetcher\('([A-Za-z0-9_]+)'")
    registered = set()
    for dirpath, dirs, files in os.walk(os.path.join(UI, "src")):
        dirs[:] = [d for d in dirs if d not in ("__tests__", "node_modules")]
        for fn in files:
            if fn.endswith(".js"):
                registered |= set(reg_rx.findall(read(os.path.join(dirpath, fn))))

    ex = _overlay_contract_facts()["exempt"].get("p6-prefetch", {})
    bad = []
    for k in sorted(registered - set(keys)):
        bad.append(f"P6 stray registerStepPrefetcher('{k}') — not a navigationPages key (typo?)")
    dynamic_n = exempt_n = 0
    for k in keys:
        if k in registered:
            continue
        why = ex.get(k)
        if not why:
            bad.append(f"P6 '{k}' has NO registerStepPrefetcher('{k}') and NO p6-prefetch row")
            continue
        dm = re.match(r"dynamic:(\S+)", why)
        if not dm:
            exempt_n += 1
            continue
        dynamic_n += 1
        t_path = os.path.join(UI, dm.group(1).replace("/", os.sep))
        if not os.path.isfile(t_path):
            bad.append(f"P6 dynamic mapping for '{k}' points at missing file {dm.group(1)}")
            continue
        t = read(t_path)
        if "registerStepPrefetcher(" not in t or f"moduleKey: '{k}'" not in t:
            bad.append(f"P6 dynamic mapping for '{k}' broken in {dm.group(1)} "
                       f"(needs registerStepPrefetcher( AND moduleKey: '{k}')")
    for k in sorted(ex):
        if k not in keys:
            bad.append(f"P6 stale exemption '{k}' — key no longer in navigationPages")

    if bad:
        record(name, False, f"{len(bad)} hole(s) | " + " ; ".join(bad[:5]))
        return
    record(name, True, f"{len(keys)} technique keys — {len(registered & set(keys))} literal, "
                       f"{dynamic_n} dynamic, {exempt_n} exempt")


def check_perf_baseline_evidence(V):
    """PERF-R10 I3:验收证据门 —— 「发布前必跑性能验收」从口头纪律变成机器可核的硬条件。

    问题的形状:验收数字(PERF_BASELINE.md)是人跑出来的,门没法替人跑;但门**能**核三样:
      ① 新鲜度:文件头 `- version:` 必须 == package.json 的版本。bump 版本不重跑验收,
         旧版本号当场红 —— 这是「每次发布必更」的机械化;
      ② 口径锁步:预算三常量必须 == perf_acceptance.cjs 里的字面默认(budgetMs /
         budgetHitP50Ms / budgetHitP95Ms)。单边改脚本或单边改文档都红 —— 防「换把尺子」;
      ③ 结构完整:逐技法表必须覆盖 navigationPages 的每个键(多出的行 = 键改名后的陈旧行,
         同样红);行数 <20 = 判据失真(#71)。
    **明写的边界**(文件头同款声明,门核声明串在):数字本身的优劣与新鲜**不** CI 化 ——
    机器态(睿频压制/后台模拟器)会让同代码差 40%+,gotcha #64 的纪律是超标先做同机
    同后台旧版对照;把数字判定交给门 = 每次机器态波动都逼人改门,门两轮内必被绕过。
    全输入 = 仓库内文件 ⇒ 永不 SKIP。
    """
    name = "perf baseline evidence"
    bl_path = os.path.join(REPO, "windows-adaptations", "PERF_BASELINE.md")
    if not os.path.isfile(bl_path):
        record(name, False, "windows-adaptations/PERF_BASELINE.md MISSING — 验收证据文件被删")
        return
    bl = read(bl_path)
    bad = []

    m = re.search(r"(?m)^- version:\s*(\S+)", bl)
    if not m or m.group(1) != V:
        bad.append(f"version field = {m.group(1) if m else 'missing'} != package.json {V} "
                   f"(bump 了版本没重跑验收)")

    acc = read(os.path.join(BUNDLE, "scripts", "perf_acceptance.cjs"))
    for key in ("budgetMs", "budgetHitP50Ms", "budgetHitP95Ms"):
        am = re.search(rf"{key}:\s*(\d+)\s*,", acc)
        bm = re.search(rf"(?m)^- {key}:\s*(\d+)", bl)
        if not am:
            bad.append(f"perf_acceptance.cjs lost literal default '{key}'")
        elif not bm:
            bad.append(f"PERF_BASELINE.md lost '- {key}:' line")
        elif am.group(1) != bm.group(1):
            bad.append(f"budget mismatch: {key} acceptance={am.group(1)} vs baseline={bm.group(1)} "
                       f"(换尺子了 —— 两边必须同时改)")

    # R11-T5b horosa_startup_ab_v1:启动预算三元组与 startup_ab.cjs 的 DEFAULT_BUDGETS 字面锁步
    # (同一「防换尺子」模式;数字判定仍归人,#64 边界声明沿用上文)。
    ab = read(os.path.join(BUNDLE, "scripts", "startup_ab.cjs"))
    if not ab:
        bad.append("scripts/startup_ab.cjs MISSING — R11 启动台架被删(horosa_startup_ab_v1)")
    for key in ("warmReadyBudgetMs", "workspaceVisibleBudgetMs", "firstBootBudgetMs"):
        am = re.search(rf"{key}:\s*(\d+)\s*,", ab) if ab else None
        bm = re.search(rf"(?m)^- {key}:\s*(\d+)", bl)
        if ab and not am:
            bad.append(f"startup_ab.cjs lost literal default '{key}'")
        elif not bm:
            bad.append(f"PERF_BASELINE.md lost '- {key}:' line (启动预算三元组)")
        elif am and am.group(1) != bm.group(1):
            bad.append(f"startup budget mismatch: {key} startup_ab={am.group(1)} vs baseline={bm.group(1)} "
                       f"(换尺子了 —— 两边必须同时改)")

    if "#64" not in bl:
        bad.append("boundary prose lost — 文件头必须保留「数字不 CI 化,超标走 #64 对照法」声明")

    # horosa_warm_ab_stamp_v1(PERF-R12 W0,owner「类似问题制度化,发版永不出错」):温启节必须
    # 携带**当前版本**的对照戳「温启对照 v{V}」—— 每次发版被机械地逼着跑一轮同机温启对照并落笔。
    # 教训(v3.7.0 实证):敌意冒烟 warm 走 untrusted 并行档被 Java 墙遮蔽,+1.1s 的 trusted 串行
    # 回归它测不出来 —— 8.1s==8.1s 的「持平」是假绿;只有 trusted 温启 A/B 能抓这类。数字优劣
    # 仍归人(#64/#76 边界不动),门只逼「跑过并盖戳」这件事。
    if f"温启对照 v{V}" not in bl:
        bad.append(f"warm-start section lacks the current-version stamp '温启对照 v{V}' "
                   f"(horosa_warm_ab_stamp_v1 — 发版前必须跑同机温启对照并在温启节落笔)")

    idx_path = os.path.join(UI, "src", "pages", "index.js")
    nm = re.search(r"const navigationPages = \[(.*?)\n\];", read(idx_path), re.S) if os.path.isfile(idx_path) else None
    if not nm:
        record(name, False, "navigationPages block not found — 判据自身失真(#71)")
        return
    keys = set(re.findall(r"key:\s*'([A-Za-z0-9_]+)'", nm.group(1)))
    rows = set(re.findall(r"(?m)^\| ([A-Za-z][A-Za-z0-9_]*) \|", bl)) - {"ID"}
    if len(rows) < 20:
        bad.append(f"only {len(rows)} technique rows — 判据失真(#71)或表被腰斩")
    for k in sorted(keys - rows):
        bad.append(f"technique '{k}' has no PERF_BASELINE row")
    for k in sorted(rows - keys):
        bad.append(f"stale baseline row '{k}' — not a navigationPages key")

    if bad:
        record(name, False, f"{len(bad)} hole(s) | " + " ; ".join(bad[:5]))
        return
    record(name, True, f"version {V} locked, 3+3 budget literals in lockstep (acceptance + startup_ab), "
                       f"{len(rows)} technique rows == navigationPages")


def check_version_consistency(V):
    bad = []
    # CITATION.cff
    cff = read(os.path.join(REPO, "CITATION.cff"))
    m = re.search(r"^version:\s*(.+)$", cff, re.MULTILINE)
    if not m or m.group(1).strip() != V:
        bad.append(f"CITATION.cff version = {m.group(1).strip() if m else 'missing'} != {V}")
    # bundle README "当前发布版本：`X Beta`（安装器版本号为 `X`）"
    bre = read(os.path.join(BUNDLE, "README.md"))
    for mm in re.finditer(r"当前发布版本：`([\d.]+) Beta`（安装器版本号为 `([\d.]+)`）", bre):
        if mm.group(1) != V or mm.group(2) != V:
            bad.append(f"bundle README current-version = {mm.group(1)}/{mm.group(2)} != {V}")
    # README download / badge / tag refs must all == V (historical 'includes X' prose & docs/releases/X.md links are bare and untouched)
    pat = [(r"Horosa-Setup-([\d.]+)\.exe", "download exe"),
           (r"version-([\d.]+)%20beta", "version badge"),
           (r"releases/tag/v([\d.]+)", "tag link")]
    for fn in ("README.md", "README_ZH.md", "README_EN.md", os.path.join("desktop_installer_bundle", "README.md")):
        txt = read(os.path.join(REPO, fn))
        for rx, label in pat:
            for mm in re.finditer(rx, txt):
                if mm.group(1) != V:
                    bad.append(f"{fn}: stale {label} -> {mm.group(1)} (expect {V})")
    record("version consistency", not bad, "; ".join(bad) if bad else f"all refs == {V}")

def check_sentinels():
    # file (relative to WS unless absolute) -> required substrings (a reverted fix removes these)
    SENT = {
        # v2.2.0: Feng Shui was rewritten iframe -> React (fengshuiEngine canvas). The old
        # Windows-ahead relative-iframe fix is OBSOLETED by the rewrite (no iframe = no desktop
        # file:// path problem); guard that the React engine is wired (not a reverted iframe shell).
        # PERF-R9 Ship 7:本页此前连 hook 都没接(故「无从声明」chartFree),本轮补接 hook 只为
        # 承载 chartFree 声明(不注册 .fun)。声明 + techniqueChartFree 登记是一对,缺一即契约测试红。
        # 也是 apply.sh §31c 的 guard 串(R4:guard 串 == 哨兵钉)。⚠️ 并入既有键,绝不另开(gotcha #29)。
        # v3.11.1 覆盖补丁(issue #84 风水模块加载出错,gotcha #107):理气工作区不可用态守卫 + 罗盘盘径可视高度封顶;
        # 分段控件折行判据脱钩 + 滞回;两条 Windows-ahead 回归守卫随 overlay 落地。
        os.path.join(UI, "src/components/fengshui/LiqiWorkspace.js"): [
            "horosa_liqi_unavailable_guard_v1", "if (result.available === false) {", "参数不足,尚未起盘",
            "horosa_luopan_dial_viewport_cap_v1", "Math.min(chartBox.w, chartBox.h, viewportCap)", "getLayoutViewportHeight",
        ],
        os.path.join(UI, "src/components/xq-ui/index.js"): [
            "horosa_segmented_wrap_hysteresis_v1", "export function decideSegmentedWrap(", "const unwrappedPads = React.useRef(null)",
            "if(!isWrappedNow){ unwrappedPads.current = pads; }", "decideSegmentedWrap(need, avail, w)",
        ],
        os.path.join(UI, "src/components/fengshui/__tests__/liqiSchoolsMountSmoke.test.js"): [
            "horosa_liqi_schools_mount_smoke_v1", "LIQI_SCHOOLS", "参数不足", "issue #84",
        ],
        os.path.join(UI, "src/components/xq-ui/__tests__/xqSegmentedWrapDecision.test.js"): [
            "horosa_segmented_wrap_hysteresis_v1", "decideSegmentedWrap(285, 264, false)", "need += tw + (parseFloat(cs.paddingLeft)",
        ],
        os.path.join(UI, "src/components/fengshui/FengShuiMain.js"): [
            "fengshuiEngine",
            "horosa_chart_free_declared_v1", "hook.chartFree = true",
        ],
        os.path.join(UI, "src/utils/windowSizePersistence.js"): ["isDesktopShellWindow"],
        # [#109 收敛,v3.11.2] PERF-R11 T3c 桌面壳温启数字行(horosa_startupgate_desktop_elapsed_v1)被上游
        # [R5 S8] 超集收编:壳经 URL `boot=<壳启动 epoch ms>` + `firstLaunch=1` 送启动上下文(utils/backendBootGate
        # bootContext),StartupGate「已用时」从壳启动时刻起算、更新后首启从 t=0 给出明确文案 —— 我方桥读
        # readDesktopStartupCfg 的实现与 5 例金标退役(Electron 侧对位:main.js horosa_early_nav_post_update_v1)。
        # 哨兵迁钉上游形态(#101 课二):丢任一针 = 温启数字行 / 更新后首启文案回退,零报警。
        os.path.join(UI, "src/components/common/StartupGate.js"): [
            "bootContext", "firstLaunch", "已用时",
        ],
        # horosa_frontend_path_scrub_v1(v3.6.1):产品源 package.json 的 scripts 块是 Windows
        # 适配面(apply.sh §3 用 files/astrostudyui/package.name-scripts.json 整块覆盖 ——
        # Mac 的 bash `export VAR=1 &&` 在 cmd 下不成立,故走跨平台 umi-runner.js)。此前**从无
        # 哨兵**:整块覆盖意味着上游任何新增构建步骤都会被我方块静默吃掉。v3.6.1 上游新增的
        # 构建产物路径脱敏(scrub-build-paths.js,修 umi 把构建机绝对路径写进 bundle 的存量泄漏)
        # 必须在 Windows 链里同样存在 —— 丢了就是把用户名/仓目录名发出去。产物侧另有
        # `dev-path bake-in scan` 负向门兜底(字符串在≠产物干净)。
        os.path.join(UI, "package.json"): [
            "umi-runner.js", "scrub-build-paths.js dist-file", "write-build-info.js dist-file",
        ],
        os.path.join(UI, "src/components/ziwei/ZWHouse.js"): ["kinastroBorrowed"],
        os.path.join(UI, "src/pages/index.js"): [
            "ensureField",
            # v3.7.1 收敛:refresh-start/render-complete/markInteractionStart 三针退役 ——
            # 上游收编观测核后,交互起点改由 perfMark 的【捕获期手势监听】统一给出
            # (pointerdown/keydown capture,先于任何 React 防抖;见 perfMark.js 条目),
            # 页面层只需上报「当前技法」:
            "setCurrentTechnique", "scheduleDataWarmGroup",
            # [#109 收敛,v3.11.2] PERF-R10 S2 出盘 settle 落现场快照:上游收编后单一写点在页面层
            # (三参签名 +currentSubTab);models/astro.js 的我方三处二参写点退役(双写会以少一位的记录
            # 覆盖上游记录 → 温启恢复丢子页签)。退回二参 / 挪走 = 红。
            "saveBootChartSnapshot(fields, currentTab, currentSubTab)",
            # PERF-R10 Ship2:切技法页签后 300ms 按该技法档位武装 ±N。
            "armStepPrefetch(",
            # v3.11.1(镜像上游 [261]/[262]):render 站点只调 syncChartPalette;本命主页 seedNewCharts 标记「亲手改动记新盘种子」
            "syncChartPalette(resolvedAppearance)", "seedNewCharts",
            # PERF-R9 Ship 7:①预热清单从此处写死的 4 元素数组改为 utils/dataWarmTasks 注册表
            # (页面组件不再持有技法知识);②changeCond 的 `{...fields}` 只拷顶层 = 嵌套对象
            # 就地变异,任何按引用比较的 memo/SCU 都判错 —— 本轮渲染优化的前提。
            # horosa_change_cond_no_mutate_v1 同时是 apply.sh §5 累积补丁的 guard 串(gotcha #48 取最新)。
            "horosa_change_cond_no_mutate_v1", "buildDataWarmTasks",
            # PERF-R9 Ship 6:城市大库(citiesFull.json,3.85MB)登记进 idle 预载队列。改之前
            # GeoCoordSelector.componentDidMount 才 import ⇒ 「点开选地点」当场付取包 + JSON.parse,
            # 是全站最大的单次现付成本,而改出生地/事件地是首屏之后最常发生的操作之一。
            # 只改「何时付」,不改任何取数/匹配/渲染语义。kill-switch:horosa.perf.cityDbIdlePreload。
            "cityDbIdlePreloadEnabled",
            # PERF-R12 W3b-Z4:zeri 预载 order 3→2(主导航技法页非重可视化,提位吃 idle 队列早窗)。
            # 同时是 apply.sh §5 累积补丁的 guard 串(gotcha #48 取最新)。
            "horosa_zeri_render_slice_v1",
            # v3.7.1【上游自研,Windows 照抄不擅动】:pages/index 的五处 useMemo 化(convert 族)。
            # owner 明令「Mac 那边的优化也不能遗漏」—— 钉住它,下次同步若被我方 merge 冲掉当场报红。
            "horosa_convert_memo_v1",
        ],
        # v3.9.2「双保险副本」Electron 对位(horosa_shadow_mirror_electron_v1):上游 Tauri invoke,
        # Electron 不对位 = 该数据保险在 Windows 静默不存在(发布说明承诺的功能死件)。
        # 三件套缺一即死:本适配层 + preload 桥 + main.js IPC 原子写。
        # v3.9.2 存储键注册表:Windows-ahead 键 horosa.boot.lastChart.v1 必须在上游注册表登记,且形状快照
        # (.snap)成对携带 —— 任一缺失 = umi [V4] 哨兵红。[#109 收敛,v3.11.2] 上游随 bootChartRestore 本体
        # 收编一并登记了该键(带 label),我方 horosa_windows_storage_keys_v1 补丁与 .snap 补丁退役;
        # 哨兵改钉键本身(存在性钉)。
        os.path.join(UI, "src/utils/storageKeyRegistry.js"): [
            # v3.11.1(镜像上游 [261]):新盘种子存储键已登记(备份面缺它 = 迁机即丢)
            "'horosa.chart.newChartSeeds.v1'",
            "horosa.boot.lastChart.v1",
        ],
        os.path.join(UI, "src/utils/__tests__/__snapshots__/storageRegistryCompleteness.test.js.snap"): [
            "horosa.boot.lastChart.v1",
        ],
        # v3.9.3 horosa_ws_dirname_agnostic_v1(gotcha #100):上游 classicalParamSpec.contract 的
        # 「横向复制点」组以 REPO+'Horosa-Web/…' 硬编码仓库布局读后端源 —— Windows 工作区目录带
        # 哈希后缀 ⇒ 六个后端扫描测全 ENOENT。守卫 marker 同为本针(R4 成对);WSROOT 字面 =
        # 「测试文件→工作区根」相对定位的实现锚,布局无关(macOS 解析到同一文件)。
        os.path.join(UI, "src/utils/__tests__/classicalParamSpec.contract.test.js"): [
            "horosa_ws_dirname_agnostic_v1", "const WSROOT = path.join(__dirname, '../../../..')",
        ],
        os.path.join(UI, "src/utils/shadowMirror.js"): [
            "horosa_shadow_mirror_electron_v1", "electronShadowBridge", "shadowStoreWrite", "shadowStoreReadAll",
        ],
        # v3.11.0 护栏家族第 7 例(shell 引号 × 构建指纹,gotcha #104):判脏改 execFileSync 数组参数 + git 失败按脏。
        os.path.join(UI, "scripts/write-build-info.js"): [
            "horosa_buildinfo_shell_free_v1", "execFileSync('git', ['status', '--porcelain', '--']",
        ],
        # v3.11.0:上游 SS-19 源码扫描用例 × 我方六壬渲染切片(p.guireng 形)——两形皆认;丢针 = 该用例回潮成 Windows 恒红。
        os.path.join(UI, "src/utils/__tests__/sanshiQ164Misc.test.js"): [
            "horosa_win_slice_form_v1", "disabled={p.guireng !== 0}",
        ],
        # v3.11.0 同族第二例:上游 sanshiQijuAndVisibleControls 源码扫描用例 × 我方合一页渲染切片(this.props.* 形)——两形皆认。
        os.path.join(UI, "src/components/sanshi/__tests__/sanshiQijuAndVisibleControls.test.js"): [
            "horosa_win_slice_form_v1", "this.props.onAstroFieldOptionChange('hsys', v)", "this.props.onOuterCoordChange(v)",
        ],
        # v3.11.0:资料导入白名单合同测试 × Electron 壳(main.rs 缺席时读 desktop-bridge.js 同名常量);壳侧常量形必须保持该正则可解。
        os.path.join(UI, "src/utils/__tests__/aiMaterialImportGuard.test.js"): [
            "horosa_win_shell_const_v1", "desktop_installer_bundle/electron/desktop-bridge.js",
        ],
        os.path.join(BUNDLE, "electron", "desktop-bridge.js"): [
            'AI_ANALYSIS_IMPORT_EXTENSIONS = ["txt", "md", "markdown", "doc", "docx", "pdf"]',
            # v3.11.0 horosa_desktop_bridge_electron_v1(镜像上游 [226]):偏好默认关(agent/mcp)、status 令牌恒空 + reveal 按需、
            # 未知命令(含 plugin:*)拒绝、退出臂
            "agent_enabled: !!raw.agent_enabled", "mcp_server_enabled: !!raw.mcp_server_enabled",
            "mcp_server_reveal_token_command:", "throw new Error(`command not found:", "async stopOnExit()",
            "shadow_store_write_command:", "sid: str(st.launchNonce || '')",
        ],
        os.path.join(BUNDLE, "electron", "mcp-server.js"): [
            # [226] 回环绑定 / 门序(gate 在 Accept 之前)/ [236] SSE 首帧不丢 / 端点文件先删后关
            "server.listen(port, '127.0.0.1')", "if (!accept.includes('text/event-stream')) return textResponse(res, 406",
            "sub.pending = pending;", "removeEndpointFileIfOwned(this.endpointFile); this.endpointFile = null; }",
        ],
        os.path.join(BUNDLE, "electron", "mcp-core.js"): [
            "function constantTimeEq", "if (!hostAllowed(host)) return [403, 'forbidden host'];",
            "if (name.startsWith('ext_')) return false;", "return toolNameOk(name) && (level === 'read' || level === 'additive');",
            "capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true }, prompts: { listChanged: true }, logging: {} }",
        ],
        os.path.join(BUNDLE, "electron", "mcp-client.js"): [
            # [237] 外部客户端:kill-switch / stdio 子进程 stderr 丢弃 / 只读档准入 / 令牌脱敏
            "const MCP_CLIENT_KILL_ENV = 'HOROSA_MCP_CLIENT';", "stdio: ['pipe', 'pipe', 'ignore']",
            "if (spec.readOnlyOnly) throw new Error(`tool not admitted:", "function redactSpec(spec)",
        ],
        os.path.join(BUNDLE, "electron", "mcp-stdio.js"): [
            "const MCP_STDIO_FLAG = '--horosa-mcp-stdio';", "'subscriptions/listen is not available through the stdio proxy",
            "if (require.main === module) {",   # 直跑入口(ELECTRON_RUN_AS_NODE 复生 / node 直跑),丢了 = Claude Desktop 接入静默死
        ],
        os.path.join(BUNDLE, "package.json"): ['"asarUnpack"', '"electron/mcp-stdio.js"', '"electron/mcp-core.js"'],
        os.path.join(BUNDLE, "electron", "mcp.test.js"): [
            "test('desktop-bridge: 命令表 = 上游 Rust 命令面的页面子集", "test('mcp-stdio: 一行进一行出",
        ],
        os.path.join(BUNDLE, "scripts", "verify_mcp_smoke.cjs"): ["--expect-down", "subscriptions/listen"],
        # v3.11.0:合一页左栏切片里上游新落的太乙「盘式/古法公式/时间基准」三控件必须绑到 props 处理器(切片子组件自身无 onOptionChange;
        # 上游 `this.onOptionChange` 形在子组件里是 TypeError —— 用户一点即炸,渲染冒烟测不出)。三针 + 反针见 SENT_ABSENT。
        # v3.11.0:上游两套契约测试(aiToolsErrorCodes.contract / aiAgentRuntimeDoc.contract)按 Mac 仓布局读 docs/AI_AGENT_RUNTIME.md,
        # 在本仓落到 local/workspace/docs/(apply.sh §4b 每轮从 Mac 仓刷新);缺席 = ENOENT 假红。钉文档标题行。
        os.path.join(WS, "..", "docs", "AI_AGENT_RUNTIME.md"): [
            "# AI 助手行动能力 · 运行时与工具目录",
        ],
        os.path.join(UI, "src/utils/aiAnalysisContext.js"): [
            "compatible !== false", "regenerateChartTechniqueSnapshot",
            # v3.9.2 horosa_no_undef_fix_v1(check-no-undef 门抓获;上游同病)→ **v3.11.0 上游自修收编,补丁按 #49/#101 退役**:
            # 哨兵迁钉上游形态(DEFAULT_PD_TYPE 随 pdPairParamsFor 一并从 primaryDirectionSync 进 import);
            # 回归网 = check-no-undef 作用域门(该 ReferenceError 一回潮即红)。
            # ⚠ #29:本文件的哨兵针全部并在这一个 key,绝不再开第二个同名 key(dict 后者覆盖前者=前者针全死)。
            "DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE, pdPairParamsFor }",
        ],
        os.path.join(UI, "src/components/aianalysis/AIAnalysisMain.js"): [
            # v3.11.0:horosa_markdown_lru_v1(流式 markdown→HTML 结果 LRU)退役 —— 上游把助手正文改为
            # AssistantMarkdown 记忆化组件渲染(preflight [225] 钉),同目标(历史消息不随流式帧重渲)已由上游承接;
            # 负锚:LRU 函数名不得回潮(回潮 = 双缓存)。
            # v3.11.0:DOMPurify 消毒步随上游迁到 utils/aiMarkdownRender.js(下一条钉住),本文件只钉 markdown 渲染入口仍在。
            "renderMarkdownToHtml", "streamError", "horosa_freeze_subtabs_v1", "AssistantMarkdown", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        # 助手正文 markdown→HTML 的消毒步(SKILL「keep the sanitize step」不变量):上游 v3.11.0 把它收进 aiMarkdownRender.js
        os.path.join(UI, "src/utils/aiMarkdownRender.js"): ["DOMPurify.sanitize("],
        os.path.join(UI, "src/integrations/kentang/serviceRoot.js"): ["LOCAL_KENTANG_CHART_PORT"],
        os.path.join(UI, "src/utils/baziLunarLocal.js"): ["clockTime", "solarTime"],
        # v3.0.1 perf overlays (天文馆渲染门控 + echarts 模块化;纯前端、只动时机/打包,带 kill-switch);
        # Windows-ahead 适配,经 windows-adaptations/ 重打。reverting 任一会移除 needle -> 本门 FAIL。
        os.path.join(UI, "src/utils/perfFlags.js"): [
            "planetariumRenderGatingEnabled", "planetariumOnDemandRenderEnabled",
            "planetariumMetricsThrottleEnabled", "planetariumTimeEditDebounceEnabled",
            # v3.0.1 perf round-2: 确定性技法结果缓存开关(紫微/七政…同参复用)。
            "techniqueResultCacheEnabled",
            # v3.0.1 perf round-3: 首屏并行化开关(玄学史/占星首屏互不依赖请求并行发起)。
            "firstLoadParallelEnabled",
            # PERF-R7 T-6: 预测性预计算开关(表单编辑期防抖预发同参请求,只暖缓存)。
            "speculativePrecomputeEnabled",
            # PERF-R10 Ship2:「选步长即武装」总闸 + 深度(0..5,默认 3)。
            "stepPrefetchArmEnabled", "stepPrefetchDepth",
            # PERF-R10 S2:温启现场恢复。(kentangL3Enabled 已随 v3.5.1 收敛退役 —— 上游
            # utils/kentangCache.js 的 fetch 级三层缓存[同款 kt-v1|rv 信封]整体取代,见该文件条目。)
            "bootChartRestoreEnabled",
            # PERF-R8 P2/P3: 数据层预热细闸 + 邻位预取闸。
            "dataWarmTasksEnabled", "neighborPrefetchEnabled",
            # PERF-R9 G4:天文馆心跳闸此前漏钉 —— 它是 perfFlags 里唯一没被哨兵覆盖的开关,
            # Mac 同步若删掉它,发布照样绿。补上。
            "planetariumIdleHeartbeatEnabled",
            # PERF-R12 W3a/W3d:泵 fast-first + 同向偏斜 + 七政全命中中间帧合并 三闸。
            "stepPrefetchFastFirstEnabled", "stepPrefetchSkewEnabled", "guolaoMergedPaintEnabled",
            # v3.7.1:本文件的注释区随上游收编带进一批 marker。钉住它们有两个作用:
            # ① 我方首创被上游采纳后仍受守护(boot_chart_restore / freeze_subtabs / option_prefetch /
            #    step_prefetch_arm 四条,来源=Windows,勿在未来收敛里当上游噪音删掉);
            # ② **上游自研的两条(main_chain_abort / option_debounce)同样钉住** —— owner 明令
            #    「Mac 那边做的优化也要一并考虑不要遗漏」,同步时把它们冲掉必须当场报红。
            "horosa_boot_chart_restore_v1", "horosa_freeze_subtabs_v1", "horosa_option_prefetch_v1",
            "horosa_step_prefetch_arm_v1", "horosa_main_chain_abort_v1", "horosa_option_debounce_v1",
            # v3.7.3(镜像上游 [196]③):mainChainAbort **必须默认关**。它不是性能旗,是**正确性**旗 ——
            # 两个并发 /chart effect 在 `yield select` 处交错后,「持有活 controller 的」与「持有最大
            # epoch 的」会落到不同 effect ⇒ 活着的被 epoch 判过期丢弃、epoch 最大的被 abort ⇒
            # 两个都不落 store ⇒ chartObj 永不更新(三式外圈星度冻在起盘那一刻,用户实测三轮才定位)。
            # 钉「=== '1' 才开」的真代码形态;回潮成 flagEnabled(默认开)由下方 SENT_ABSENT 负锚拦。
            "horosa_main_chain_abort_default_off_v1",
            "window.localStorage.getItem('horosa.perf.mainChainAbort') === '1'",
        ],
        # PERF-R7 T-6 预测性预计算(windows-adaptations §22;跨平台,建议上游化 Mac):
        # 模型只暖缓存 effect + 表单防抖 + 挂线 + services 只缓存有效盘。丢任一 marker =
        # 「点击→显示体感瞬间」主武器被同步冲掉,发布前硬失败。
        os.path.join(UI, "src/models/astro.js"): [
            "precomputeFetch", "speculativePrecomputeEnabled",
            # v3.11.1(镜像上游 [261]):newEmptyFields 读新盘种子(schema 键)并展开 schema 外的种子键
            "...newChartSeedExtraEntries(),", "value: newChartSeedValue('",
            # v3.9.2 #94 判例:守卫 reportStepUnit 被上游收编 ⇒ apply.sh 曾静默跳过整条补丁;
            # 守卫已换成补丁独有 horosa_pump_skew_v1 —— R4 交叉门要求 guard ∈ 本针列表。
            "horosa_pump_skew_v1",
            # PERF-R8 P0:排盘 saga 成功后 refresh-end 打点(与 refresh-start/render-complete 配对)。
            "markChartRefreshEnd",
            # PERF-R9 Ship 0a:快车道(八字/紫微/数算)此前提前 return **从不打 refresh-end**,
            # 而 chartObj.chartId 变了 → render-complete 照样触发 → 三族一直报伪造的渲染时间。
            # 也是 apply.sh §22 累积补丁的 guard marker(guard 串 == 哨兵钉)。
            "horosa_interaction_span_v1",
            # PERF-R10 Ship2:武装构造器注入 + settle 兜底武装(unit 不再硬编码 'm')。
            # v3.5.1 收敛:上游触发线(registerStepSelectHandler,opt-in 宿主 + 5s 去重)
            # 接的是 Windows 武装引擎 —— handler 体调 reportStepUnit + ±stepPrefetchDepth 全窗。
            "registerArmPlanBuilder", "horosa_step_prefetch_arm_v1", "registerStepSelectHandler",
            # v3.7.3(上游自研,照抄不擅动):代际(++fieldsEpoch)与取消(abort 旧 ctl + 建新)
            # **必须原子**,中间不得有 yield —— 否则两个并发 effect 交错后两个响应都保不下来。
            # 丢 marker = 有人又把 abort 块挪回函数开头,盘不跟时间走的静默错值当场复活。
            # 第二针是该竞态的**上游病灶名**:此处注释指明它是三式外圈不跟时间走的真身,
            # 两针同去 = 这段来历不明,下一个人会以为可以随手把 abort 块挪回去。
            "horosa_chart_epoch_abort_atomic_v1", "horosa_sanshi_outer_follow_time_v1",
            # PERF-R9 Ship 7:步进预取任务的排序即价值 —— 旧序把 chart±1 排最前,非占星页
            # gate 面板的技法端点恒被预算砍掉;新序 [技法+1, chart+1, 技法-1, chart-1, chart+2]。
            # 且技法登记方收到的必须是【已步进】的 fields(旧版传基准 fields = 预取当前那张盘 = 白打)。
            "__buildStepPrefetchTasksForTest",
            # PERF-R12 W3a③:同向连击偏斜 —— settle 两落点喂 reportStepUnit,计划分支读 stepStreak
            # (streak≥3 且 <2s 才偏;翻向/换页/换档/dir=0 即重置)。丢针 = 偏斜静默失效回对称计划。
            "reportStepUnit", "stepStreak",
            # v3.7.1:选项投机的 /chart 变体构造器随上游收编进本文件注释区,一并钉住。
            "horosa_option_prefetch_v1",
        ],
        # PERF-R9 Ship 0a:交互跨度观测的载体。此前 perfMark.js **整个文件零调用点**,
        # window.__horosaPerf.summary() 永远返回 {} —— 接活它,「点击→中右栏画完」才有数可验收。
        os.path.join(UI, "src/utils/perfMark.js"): [
            "horosa_interaction_span_v1", "markInteractionStart", "markPanelReady",
            # 起点 mark 名必须含 ':refresh-start' —— markChartRefreshEnd 按该子串找最近一个 start
            # 来配 measure;改名会静默断链(量出的数会变成上一次切页签到现在的秒级垃圾)。
            "horosa:step:refresh-start",
            # PERF-R9 Ship 9:验收台架(scripts/perf_acceptance.cjs)靠 window.__horosaPerf.reset()
            # 在「切到该技法并稳定之后」清零,使随后 N 次步进的 p95 只反映稳态单次操作,
            # 不被切页签的一次性装载成本污染。丢它 = 验收数字被污染且无人察觉。
            # 同时是 apply.sh 该行的 guard 串。
            "horosa_perf_reset_v1", "perfReset",
            # PERF-R10 Ship1(v3.7.1 起随观测核上游化,marker 注释被上游改写 —— 语义锚改钉
            # 双 rAF 收尾行本身):消费后的样本不因双 rAF 窗内的新 pointerdown 作废,否则
            # 快节奏连点几乎每条样本报废(七政/印占恒零样本的机制之一)。
            "requestAnimationFrame(()=>{ requestAnimationFrame(finish); });",
            # 捕获期手势监听 = 交互起点的唯一来源(pages/index 三针退役的对价;丢它 = 全站配对断链)。
            "document.addEventListener('pointerdown', onGestureCapture, { capture: true, passive: true });",
        ],
        # PERF-R9 Ship 5:L1 命中必须重插,否则 Map 插入序 + 从头淘汰 == FIFO 而非 LRU,
        # 后台预取会挤掉用户正在反复访问的条目(预取扩到十几个技法后方向是反的)。
        os.path.join(UI, "src/utils/requestDedupe.js"): [
            "horosa_dedupe_l1_lru_v1",
            # PERF-R10 Ship2(v3.7.1 上游收编后清单形态换代):预取白名单里走 request() 的端点
            # 必须可缓存(否则白取);「取现时/随机」端点必须在 EXCLUDES(缓存即钉死)——
            # 上游把 /common/ 整族移出前缀清单,EXCLUDES 钉 dice+bazi/pattern 两条纵深。
            # [#100] horosa_dedupe_chart3d_v1 = apply.sh 该补丁的守卫(R4 成对):v3.9.3 上游把
            # L1-LRU 连旧守卫 marker 一起收编 ⇒ 补丁曾整体被跳过,'/chart3d' 实丢、本针接住。
            "horosa_dedupe_chart3d_v1",
            "'/nongli/time'", "'/chart3d'", "DEDUPE_PATH_EXCLUDES", "'/predict/dice'",
        ],
        os.path.join(UI, "src/utils/__tests__/requestDedupe.test.js"): [
            # 受控验证过:撤掉那两行则该断言变红(1/13),装回则 13/13 绿 —— 它真的能抓。
            "horosa_dedupe_l1_lru_v1",
        ],
        os.path.join(UI, "src/services/astro.js"): [
            "chartMem_valid_only_v1",
            # PERF-R8 P0:chartMem 命中打 cache-hit 打点。
            "markChartCacheHit",
            # PERF-R9 Ship 7:chartMem 容量 96→192。步进预取每 settle 最多灌 3 条 /chart,
            # 加技法族自有预取,96 条在「连点步进 + 来回拨」下会把用户刚看过的盘挤出去。
            "CHART_CACHE_MAX = 192",
        ],
        os.path.join(UI, "src/components/comp/ChartFormData.js"): [
            "scheduleLivePrecompute", "onLivePrecompute",
        ],
        os.path.join(UI, "src/components/astro/AstroFormComp.js"): [
            "onLivePrecompute", "precomputeFetch",
        ],
        # v3.0.1 perf round-2:紫微本盘 /ziwei/birth 走确定性缓存(cachedPost),切技法/来回访问秒回。
        os.path.join(UI, "src/components/ziwei/ZiWeiMain.js"): [
            "cachedPost", "techniqueResultCacheEnabled",
            # PERF-R9 Ship 7:/ziwei/birth 构参抽为模块级纯函数(预热/预取要在组件之外构出与
            # 首点逐字节同键的 body)+ 进预热注册表 + 步进预取登记。guard 串按 gotcha #48 取最新。
            "horosa_prefetch_registry_v1", "buildZiweiBirthParams", "warmZiweiBirth",
            # PERF-R10 Ship2(b′):紫微步进走本地漏斗不经 fetchByFields → settle 自武装。
            "armStepPrefetch(",
            # [gotcha #94] apply.sh 的守卫 marker 必须同时是本文件的哨兵针(R4 契约):
            # v3.8.0 起守卫由 horosa_prefetch_registry_v1 改为 horosa_ziwei_state_slice_v1
            # —— 上游收编了 prefetch_registry,旧守卫恒命中会让整条补丁静默跳过。
            # 两边同名才不会「改了一边、另一边悄悄失效」。
            "horosa_ziwei_state_slice_v1",
        ],
        # v3.0.1 perf round-3:玄学史首屏 4 请求并行(总览/玄典/名家/事件)。
        os.path.join(UI, "src/components/xuanshi/XuanShiMain.js"): [
            "firstLoadParallelEnabled",
            # PERF-R10 Ship1:summary 落定/失败终态打点(总览门控主体渲染)—— P5 门要求可测。
            "markPanelReady('xuanshi')",
        ],
        # v3.1.0 官方仓库链接平台化(windows-adaptations #23):「关于」的法律文档/官方下载渠道
        # 必须指向 Windows 仓库 —— 丢 marker = Mac 同步把 URL 冲回 Mac 仓库(用户会被带去错误
        # 平台的下载页),发布前硬失败。
        os.path.join(UI, "src/components/homepage/PageHeader.js"): [
            "comprehensively-improved-Windows",
            # v3.11.1(镜像上游 [261]/[262]):主题钮审计锚 + 全局「时间算法(新命盘的缺省)」入口写新盘种子
            'data-appearance-toggle="1"', "时间算法（新命盘的缺省）", "recordNewChartSeeds({ timeAlg",
        ],
        # v3.11.1 盘面随界面主题重画(镜像上游 [262] + jest chartThemeFollow.contract):调色板只在 utils/appearance.js 切,
        # 顺序 调色板 → 根属性 → 广播;宿主经 chartDrawGuard.watchChartAppearance 单源订阅(census 门另核宿主普查)。
        os.path.join(UI, "src/utils/appearance.js"): [
            "syncChartPalette(actual)", "APPEARANCE_APPLIED_EVENT = 'horosa:appearance-applied'", "export function subscribeAppearance(",
            "DARK_CHART_COLOR_THEME = 8", "dispatchEvent(new CustomEvent(APPEARANCE_APPLIED_EVENT",
        ],
        os.path.join(UI, "src/utils/chartDrawGuard.js"): [
            "export function watchChartAppearance(", "subscribeAppearance",
        ],
        os.path.join(UI, "src/layouts/app.js"): [
            "syncChartPalette(resolvedAppearance)",
        ],
        os.path.join(UI, "src/utils/__tests__/chartThemeFollow.contract.test.js"): [
            "🔴 ① 每个宿主组件都挂 watchChartAppearance(", "🔴 ② 组件里零私自观察 data-horosa-appearance", "🔴 applyAppearanceToDocument:调色板先到位",
            # 上游 [262] 锁「合同测试的宿主判据正则与 preflight 普查同文」—— 我方 census 门用同一正则,改判据须两处同改
            "const HOST_RE = /AstroColor\\.|d3\\.select\\(|getContext\\('2d'\\)|new [A-Z]\\w*Chart\\(|new FengShuiEngine\\(/;",
        ],
        # v3.11.1 「新盘种子」(镜像上游 [261]):单源件 + 模型/还原接线 + 合同测试 + 存储键登记
        os.path.join(UI, "src/utils/newChartSeeds.js"): [
            "NEW_CHART_SEEDS_STORAGE_KEY = 'horosa.chart.newChartSeeds.v1'", "export function resetNewChartSeedKeysToInternalDefaults(",
            "export function newChartSeedExtraEntries(", "export function recordNewChartSeeds(",
        ],
        os.path.join(UI, "src/utils/recordFieldsRestore.js"): [
            "fields = resetNewChartSeedKeysToInternalDefaults(fields);", "isNewChartSeedKey(key) ? newChartSeedInternalDefault(key)",
        ],
        os.path.join(UI, "src/utils/__tests__/newChartSeeds.test.js"): [
            "① 内建默认 ≡ schema 初值", "__resetNewChartSeedsForTest",
        ],
        # v3.0.1 perf round-3:QueueLog 每条日志的同步栈回溯默认关(BACKEND → jar rebuild)。
        os.path.join(SRV, "boundless/src/main/java/boundless/log/QueueLog.java"): [
            "horosa.queuelog.callerLocation", "LOG_CALLER_LOCATION",
        ],
        # v3.0.1 perf ROUND-3 R1 (jieqi/year 30s→2-3s):Chart-per-iteration → 直接 swe.sweObject(SUN)。
        # 逐 term 逐字段 byte-identical + 21-44× SPEEDUP,golden diff VERDICT=ALL_EQUAL 已自证。
        os.path.join(PY_SRC, "astrostudy/jieqi/YearJieQi.py"): [
            "HOROSA_JIEQI_FAST_APPROACH", "swe.sweObject", "_JIEQI_FAST_APPROACH",
        ],
        os.path.join(PY_SRC, "astrostudy/jieqi/BirthJieQi.py"): [
            # BirthJieQi 用 _ascChart(瘦 Chart 读 ASC)而非 swe.sweObject(那是 NongLi/YearJieQi 的直读日经);
            # Mac v3.5.0 把 fastApproach 上游化后按各自实现落地,BirthJieQi 段 needle 只钉 _ascChart 家族(swe.sweObject=0)。
            "HOROSA_JIEQI_FAST_APPROACH", "_JIEQI_FAST_APPROACH",
            # v3.0.1 perf ROUND-5:卯时/上升求解只读 ASC → 瘦 Chart(仅太阳、needpars=False),398-490→30-36ms。
            "_ascChart",
        ],
        # v3.0.1 perf ROUND-5:NongLi.approach 朔/节候选求解同款降维(swe.sweObject 直读日/月),
        # 整年农历表 1445-2460ms → 113-194ms;4 年(含 BC-500)golden 逐字节全等。同一开关。
        os.path.join(PY_SRC, "astrostudy/jieqi/NongLi.py"): [
            "HOROSA_JIEQI_FAST_APPROACH", "swe.sweObject", "_JIEQI_FAST_APPROACH",
        ],
        # v3.0.1 perf ROUND-5:同一 /chart 请求内重复计算的纯函数结果 memo(67 恒星批/28 宿批×2/
        # 日出/围攻/互容),缓存挂 chart 实例、reinit() 清零;golden 4 变体逐字节全等,重复盘 617-747→443-504ms。
        # perchart.py 的哨兵**只能有这一个条目**。历史上下方 v2.1.8 批次还有一个
        # os.path.join(WS, "astropy/astrostudy/perchart.py") —— 指向同一个文件,只因
        # 分隔符写法不同(...\astropy\astrostudy/perchart.py vs ...\astropy/astrostudy/perchart.py)
        # 才侥幸没有撞键。一次「统一路径写法」的整理就会让其中一条静默消失(gotcha #29)。
        # 2026-07-20 已把 pdYears 合并到此处并删除那个键。
        os.path.join(PY_SRC, "astrostudy/perchart.py"): [
            "HOROSA_PRIORITY_LANE",   # [#109] 上游请求优先级车道(预取带 X-Horosa-Priority: prefetch,用户请求先算;Mac 资产)
            # v3.6.0 收敛注(#49 上游化 SOP):ROUND-5 请求内 memo 六族(_fixedStars67Cache 等)与
            # PERF-R9 的 getParallel 稳定排序均已被上游原生吸收 —— memo 针改钉上游 accessor 串
            # (_computeMutuals / sorted 收尾),horosa_decl_parallel_stable_order_v1 marker 退役
            # (上游 sorted 收尾即其语义继任;丢 sorted = 顺序回抖,黄金矩阵按新基线兜底)。
            "_getFixedStars67Cached", "getRawFixedStarSu28Cached", "_computeAdjustFixedStarSu28",
            "_sunRiseCache", "_surroundAttacksCache", "_computeMutuals",
            "pdYears",
            "res['parallel'] = sorted",
            # [#109 撤回,v3.11.2] PERF-R10 B5 高纬度 heliacal 限界**已撤回**:上游差分 22834 例 687 不一致
            # (SEARCH_1_PERIOD 让偕日升首周期无事件即抛、外层 try 包整个循环 ⇒ 偕日没根本没查;预筛 azalt 传 2 元组
            # 恒 TypeError 被兜成「可行」从未生效;提速几乎全来自错误中止)。perchart 回到与 Mac 相同写法;三针撤除,
            # 不设负锚(上游本就没有这些符号;金标 north-hi 用例继续钉输出)。
            # v3.7.3 上游(镜像上游 [195]⑥):MOIRA 赤经定宿死代码停用守卫。
            # MOIRA_DISTAR_J2000 是自黄经反解 RA/Dec 而成,9 宿赤纬非物理 ⇒ 按赤经定宿偏 10–44°。
            # 上游改成**硬报错**而非静默返回,就是为了拦住「改回来试试」;丢掉 = 守卫失效。
            "_moira_distar_ra 已停用",
        ],
        # PERF-R9 输出确定性(印度占星侧):MOVABLE/FIXED/DUAL 与 NATURAL_BENEFICS/MALEFICS
        # 都是 set,直接遍历会让 rasiDrishti / yogas / modifiers 的排列随进程哈希变化。
        # 丢掉这两个 marker = 该回归静默复活,且一切逐字节黄金比对随之失效。
        # v3.11.0:horosa_rasi_drishti_stable_order_v1 被上游 [Q-232/T-196] 逐字收编(代码行完全相同,只差注释)→
        # 补丁按 #49/#101 退役,哨兵迁钉上游形态(注释标记 + 「按 SIGNS 过滤」的代码形)。回归网:上游
        # tests/test_india_q130_q131_q232.py + 我方黄金矩阵(顺序漂移即逐字节不等)。
        os.path.join(PY_SRC, "astrostudy/india/primitives.py"): [
            "[Q-232/T-196]", "return [s for s in SIGNS if s in FIXED and s != adjacent]",
        ],
        os.path.join(PY_SRC, "astrostudy/india/yoga_engine.py"): [
            "horosa_yoga_planet_order_v1",
        ],
        # PERF-R9 Ship 4:ensureEphePath 短路。applySiderealMode 每次 swe 调用都走一趟,而重设
        # 星历路径是幂等操作 —— 实测单次 BirthJieQi.compute() 调它 680 次、82ms(该端点的 61%),
        # 而 /jieqi/birth 又是 /chart 里 baziAssemble 的最大单项。丢掉 marker = 全局星历路径
        # 重设回到每次真调,整条链回退。注意此文件与 ephem.py(starLru)是不同文件,不构成同键。
        # [#109 收敛,v3.11.2] 上游 [R5 T1] 以同名开关收编星历路径短路(_guardedSetEphePath 守卫 +
        # _EPHE_PATH_ACTIVE 追踪),我方 PY-1 补丁与 test_india_ephemeris_degrade 扩测退役;哨兵迁钉上游形态。
        os.path.join(WS, "flatlib-ctrad2/flatlib/ephem/swe.py"): [
            "_guardedSetEphePath", "_EPHE_PATH_ACTIVE", "HOROSA_EPHE_PATH_FASTPATH",
        ],
        os.path.join(PY_SRC, "astrostudy/guostarsect/guo74.py"): [
            "getRawFixedStarSu28Cached",
        ],
        # v3.0.1 perf ROUND-5:flatlib 恒星批有界 LRU(8 条,线程安全,存取皆 deepcopy 防 relocate 串染)。
        # 「改设置重排同一盘」恒星段 379-480→183-236ms。kill HOROSA_STAR_LRU=0。注意此文件在 flatlib-ctrad2/。
        os.path.join(WS, "flatlib-ctrad2/flatlib/ephem/ephem.py"): [
            "HOROSA_STAR_LRU_FASTCLONE", "_cloneStarList",   # [#109] 上游恒星批 LRU 快克隆(Mac 资产)
            "HOROSA_STAR_LRU", "_starLruLookup", "_starLruStore", "_siderealCtxKey", "copy.deepcopy",
        ],
        # v3.0.1 perf ROUND-5 B-F3:农历「日级」外部缓存读写桌面停用(HOROSA_NONGLI_DAY_PERSIST=0 由壳注入;
        # env 缺省=原行为)。年表持久化(:336)不动。BACKEND → jar rebuild;env 字符串兼作 jar 内容哨兵。
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/helper/NongliHelper.java"): [
            "nongli_day_persist_v1", "HOROSA_NONGLI_DAY_PERSIST", "NONGLI_DAY_PERSIST",
        ],
        # forwardDirect 流水 println 删除:v3.0.1 Windows 首创(quiet_println_v1),Mac v3.2.2 上游化
        # 为 WS-3b 注释版 → 哨兵改守上游 marker(println 不回归;丢 marker=同步倒退,发布前硬失败)。
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/model/OnlyFourColumns.java"): [
            "WS-3b", "调试残留 println 移除",
        ],
        # v3.0.1 perf ROUND-3 R2 (paramhash 磁盘缓存永远 silent no-op 根治;BACKEND → jar rebuild)。
        # persistable() 抽出到 ParamHashCacheHelper,自动 round-trip Enum/POJO,所有 11 controller 免疫。
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/helper/ParamHashCacheHelper.java"): [
            "PARAMHASH_PERSISTABLE_REV", "public static Object persistable", "obj = persistable(obj)",
            # PERF-R9:LocalDir 必须走 resolveFlag(先读 -D)—— 原实现只走 PropertyPlaceholder,
            # 启动器无法把缓存目录移出 payload 树 ⇒ 每次更新换 payloadId 被清扫 ⇒ 用户全冷。
            # 同时是 apply.sh 该行的 guard 串(R4:guard 串必须就是哨兵钉)。
            "horosa_paramhash_localdir_sysprop_v1", "private static String resolveFlag",
        ],
        # kentang 惰性挂载/自愈/响亮失败:Windows 首创(v3.0.1 R3 → v3.2.0 热修 → v3.2.1 根治),
        # Mac v3.2.2 全量上游化并强化(净化白名单/回退旗/显式 prewarm)→ 文件与 Mac 逐字节一致,
        # 哨兵守上游 marker。丢任一 = 同步倒退到事故前形态,发布前硬失败。
        os.path.join(PY_SRC, "websrv/kentang/registry.py"): [
            "_LazyMountedService", "HOROSA_KENTANG_LAZY",
            "KENTANG_LAZY_MOUNT_SELF_HEAL", "_import_kentang_service_module",
            "KentangServiceLoadError", "_PURGE_PROTECT_PREFIXES", "prewarm_kentang_services",
            # PERF-R9:请求路径内惰性 import 的重模块预装(当前 kintaiyi.game_theory,793 行,
            # 实测冷导入 528.1ms / 温 0.001ms)。**必须与 prewarm_kentang_services 分开**——
            # 后者跑在 STARTUP_GATE 之前,并进去等于把启动门推迟 528ms。同时是 apply.sh 的 guard 串。
            "horosa_kentang_prewarm_modules_v1", "prewarm_kentang_modules", "KENTANG_PREWARM_MODULES",
        ],
        # v3.2.1 太乙事故根因:streamlit 桩对 dunder(含 __file__)返回函数 → 真 astropy 库导入期
        # inspect.getmodule 遍历 sys.modules 时炸 AttributeError → kintaiyi 永久导入失败 → 静默 404。
        # dunder 拒答修复;丢 marker = 桩回退成毒桩,太乙类事故复发,发布前硬失败。
        os.path.join(PY_SRC, "websrv/kentang/kinastro_common.py"): [
            "stub_dunder_guard_v1", "__horosa_slim_stub__",
            # PERF-R10 B4:translate 单遍 + 全单字守卫(等价条件被 test_kentang_display_fast 钉死)。
            # [#109,v3.11.2] PY-20 已上游化,kill-switch 成上游资产 —— 仍钉住(P2 账→代码成对)。
            "horosa_display_trans_v1", "_DISPLAY_TRANS_OK", "HOROSA_DISPLAY_TRANS",
        ],
        os.path.join(PY_SRC, "tests/test_kentang_display_fast.py"): [
            # 等价金标本体(不变量 + ~6 万例穷举);随 pytest 每次发布真跑。
            "horosa_display_trans_v1",
        ],
        # 太乙事故回归测试哨兵:Windows 首创的两组回归(自愈/响亮失败 + 桩卫生)被 Mac v3.2.2 的
        # 五文件套件取代(import_order/lazy_mount/registry/registry_selfheal/stub_guard)。哨兵改守
        # 上游套件在位——丢文件 = 回归防线被同步冲掉,发布前硬失败。
        os.path.join(PY_SRC, "tests/test_kentang_registry_selfheal.py"): [
            "KentangServiceLoadError",
        ],
        os.path.join(PY_SRC, "tests/test_kentang_stub_guard.py"): [
            "stub_dunder_guard",
        ],
        os.path.join(PY_SRC, "tests/test_kentang_import_order.py"): [
            "kentang",
        ],
        os.path.join(PY_SRC, "astrostudy/xuanshi/__init__.py"): [
            "xuanshi.lazyImport", "_LAZY_SUBS", "_resolve_lazy_sub", "HOROSA_XUANSHI_LAZY_IMPORT",
        ],
        os.path.join(PY_SRC, "websrv/webchartsrv.py"): [
            # v3.2.2 收敛后的预热面:Mac 上游 = _warm_real_astropy(真 astropy 先装,顺序免疫)+
            # prewarm_kentang_services(18 服务空闲补装,取代旧 Windows 错峰预热)+ 启动就绪门。
            # Windows 存活增强 = xuanshi_summary_warmup_v1(global_summary 门后物化,首点秒开)。
            # 丢任一 marker = 同步冲掉预热/门闸 → 首点回退卡顿/太乙顺序事故面重开,发布前硬失败。
            "_warm_real_astropy", "prewarm_kentang_services",
            "STARTUP_GATE", "_startup_gate_tool", "HOROSA_PY_WARMUP_SYNC",
            "xuanshi_summary_warmup_v1", "HOROSA_XUANSHI_WARMUP", "global_summary",
            # [#109 收敛,v3.11.2] PERF-R10 B6 fastjson shim 上游单源化(websrv/fastjson.py:install +
            # install_global;HOROSA_FAST_JSON_ENCODE=0 关),我方 PY-21 补丁退役;哨兵迁钉上游接线。
            "install_global as _install_fast_json_global",
            # v3.5.1(Windows-ahead,可上游化):trusted 值形跨启动器不统一('1' vs 'true')——
            # 并行预热梯按 truthy 家族解析,否则 Electron 温启被误判 untrusted → 并行与 Java
            # 抢核(上游实测双输)。丢针 = 温启回归 +250ms 级且零报警。
            "horosa_trusted_env_shape_v1",
            # Mac v3.2.2 启动账本(py 层)+ /chart 三段计时账本版:壳层注入 HOROSA_LEDGER_FILE/
            # HOROSA_RUN_TAG 才生效;丢 marker = 观测制度被同步冲掉。
            "ledger_mark", "_PY_CHART_TIMING", "HOROSA_PY_CHART_TIMING",
            # PERF-R9:①删掉每个 /chart 的 print(data)——它把整个请求字典(出生日期/时间/经纬度/
            # 地名)同步写 stdout,打包件里经管道回主进程并落盘 = 请求路径上的同步写盘,且把用户
            # 出生信息持续写进日志文件。[#109 收敛,v3.11.2] 上游 [R5 T2] 直接删除该 print(不再提供
            # HOROSA_CHART_DEBUG_DUMP 复现开关,PY-14 退役);哨兵改钉上游注释原文(正向替代物,#92)。
            # ②模块预热的**调用点**,刻意在 STARTUP_GATE.set() 之后(见 registry.py 条目)。
            # 后者同时是 apply.sh 该行的 guard 串。
            "horosa_chart_no_stdout_dump_v1", "此处原有 print(data)",
            "horosa_kentang_prewarm_modules_v1", "HOROSA_KENTANG_MODULE_PREWARM",
            # v3.3.0 python 侧身份端点(与 Java /horosaIdentity 同构)。
            "horosaIdentity", "HOROSA_LAUNCH_NONCE",
            # v3.7.0 覆盖修(W0d):门前预装集=预算表。electionscan 误入门前 tier-3 曾令同机
            # 温启 3937→5042ms(+1.1s,全体用户);POST_GATE 集合的键改门后空闲装载。丢任一针
            # = 回归原样复发且零报警;门前键集白名单断言另在 verify_all_services
            # (horosa_pregate_prewarm_budget_v1,新 CORE 键必须显式决定门前/门后)。
            "horosa_electionscan_postgate_prewarm_v1", "HOROSA_ELECTIONSCAN_POSTGATE",
            "POST_GATE_CORE_PREWARM_KEYS", "prewarm_postgate_core_services",
        ],
        # Mac v3.2.2 结构化启动账本:py 写入端 + Java 写入端(ApplicationReadyEvent → jvm_to_ctx_ready
        # + WS-3b 进程内自热身)。壳层(service-manager)注入账本 env;丢文件/marker = 四层账本断链。
        os.path.join(PY_SRC, "websrv/startup_ledger.py"): [
            "HOROSA_LEDGER_FILE", "HOROSA_RUN_TAG", "ledger_mark",
        ],
        os.path.join(SRV, "astrostudyboot/src/main/java/spacex/astrostudyboot/StartupLedgerListener.java"): [
            "java.jvm_to_ctx_ready", "HOROSA_LEDGER_FILE", "HOROSA_JAVA_SELF_WARMUP", "selfWarmupAsync",
            # [#109] 上游收编的 now 盘八字/农历预热(原 JV-7 AstroStudyProgram.baziAssembleWarmup)。
            "nowBirth", "\"121e28\", \"31n14\"",
            "HOROSA_JAVA_LAZY_PREWARM",   # [#109] 上游延迟 bean 就绪后预热(Mac 资产)
        ],
        # PERF-R8:bean 级启动计时观测器(默认关,HOROSA_BEAN_TIMING=1 开)——全局 lazy-init A/B
        # 不采纳后的定点惰化数据源。BACKEND → jar rebuild;env 串兼作 jar 内容哨兵。
        os.path.join(SRV, "astrostudyboot/src/main/java/spacex/astrostudyboot/BeanTimingPostProcessor.java"): [
            "HOROSA_BEAN_TIMING", "java.bean_top",
        ],
        # Mac v3.2.2 就绪后空闲预热队列(WS-3c,任意技法首点亚秒)+ 更新可视化 v2 纯 reducer。
        os.path.join(UI, "src/utils/idleWarmQueue.js"): [
            "startIdleWarmQueue", "ENGINE_WARM_IMPORTS", "idleWarmQueueEnabled",
            # PERF-R8 P2:组式数据预热 API(generation 作废旧组 + 泵可重 arm;修复注册即空转)。
            "scheduleDataWarmGroup", "dataWarmTasksEnabled",
            # PERF-R9 Ship 7:预热任务【注册表】(登记序 = 首点概率序 = 执行序)。丢它 = 清单
            # 退回 pages/index.js 里写死的 4 条数组,紫微/遁甲/太乙/分至四个漏项一并复活。
            # 也是 apply.sh §23 累积补丁的 guard 串(gotcha #48 取最新)。
            "horosa_data_warm_registry_v1", "registerDataWarmTask", "buildRegisteredDataWarmTasks",
        ],
        # PERF-R9 G3:预热队列的回归测试本身此前**零覆盖** —— 它是全部 41 个 apply_patch
        # 目标里唯一没有哨兵的一个,而 dist:win 又不跑 umi/jest(jest 冷启 >4min,曾与
        # dist:win 同跑到 889s,接进发布门两轮内必被绕过 → 见 CONTRACT_EXEMPTIONS.md)。
        # 因此这里用「文件在 + 关键断言在」做结构性钉死,运行期缺口显式记档而不粉饰。
        os.path.join(UI, "src/utils/__tests__/idleWarmQueue.test.js"): [
            "describe('scheduleDataWarmGroup'",
            "horosa.perf.dataWarmTasks",
            "泵可重 arm",
        ],
        # PERF-R8 P2/P3(windows-adaptations §23):排盘后数据层预热的各技法权威入口 + 邻位预取。
        # 参数一致性铁律:预热走各技法自己导出的 builder+缓存入口,key/body 与真实首点逐字节一致。
        # 丢任一 marker = 「首点即时」被同步冲掉,发布前硬失败。
        os.path.join(UI, "src/components/astro/IndiaChart.js"): [
            "buildIndiaWarmParams",
        ],
        os.path.join(UI, "src/components/guolao/GuoLaoChartMain.js"): [
            "warmGuolaoNatal",
            # PERF-R9 Ship 7:七政【本命盘】步进预取(Moira 流年默认过运时刻=「现在」,禁入)。
            "horosa_prefetch_registry_v1",
            # PERF-R12 W3d:G0 渲染期变异根除(getDerivedChart 单键引用缓存)/ G2 extraTabs 稳定化 /
            # G5 全命中中间帧合并(规则缓存同步窥探)。G6 双任务+精确豁免已随 v3.7.1 退役 ——
            # 上游链式单任务取代(natal→transit→rules 全在任务体内 await 续段,白名单只见声明
            # 路径 '/chart';warmAllStages=transit 时刻已物化才续段,时刻恒取组件 state)。
            "horosa_guolao_render_slice_v1", "getDerivedChart", "_extraTabsSig",
            "guolaoMergedPaintEnabled", "peekCachedPost", "warmAllStages", "'guolao:natal'",
        ],
        os.path.join(UI, "src/components/direction/AstroDirectMain.js"): [
            # [#103] R4 成对:apply.sh 守卫换代后新守卫入针(#95 规则)。
            "horosa_pdsphere_lazy_v1",
            "warmPrimaryDirection", "buildPrimaryDirectionRequestPure",
            # PERF-R9 Ship 7:/predict/pd 与主 /chart 并行发起(prewarmRequests)+ 步进预取登记。
            "horosa_prefetch_registry_v1", "prewarmRequests",
            # issue #59(v3.6.1 首修,v3.6.2 **上游超集收敛**):主限天球(three.js ≈860KB +
            # 引擎 ~90KB)必须懒加载 —— 星运页默认停「主限法」表格页,二十多个子页签只此一个用
            # 3D;静态 import 会把整个 3D 引擎拖进本页加载关键路径,慢机上主线程长时间不响应。
            # ★ 我方 v3.6.1 的 `horosa_pdsphere_lazy_v1`/`React.lazy` 实现已**退役**:上游 v3.6.2
            # 用共享 `utils/lazyBoundary.js` 做了超集(含空模块自愈 + 卸载时 cancel 预热,我方那版
            # 没有 cancel)。**哨兵随之迁到上游标记** —— 丢了它 = 有人把静态 import 改回来。
            "makeLazyBoundary", "idleWarm",
            # 上游 v3.6.0 扩容的 6 个主限法维度必须真的进请求体(pdProjection/pdFrame/
            # pdFramework/pdParallel/pdRaptParallel/termsVariant)—— 复制体漏产 = 工具条死开关,
            # 另有 `PD request builder completeness` 门按身份键做完备性核。
            "pdProjection: desired.pdProjection",
            "pdRaptParallel: desired.pdRaptParallel", "termsVariant: desired.termsVariant",
        ],
        os.path.join(UI, "src/components/germany/AstroMidpoint.js"): [
            "warmGermanyMidpoint",
            # PERF-R9 Ship 7:预热/预取一律显式零重试 —— 后端重启窗口里 N 个深度预取
            # 绝不能变成 N×10 次退避重试风暴。
            "retry: { retries: 0 }",
        ],
        os.path.join(UI, "src/utils/preciseCalcBridge.js"): [
            "prefetchJieqiYearNeighbors", "neighborPrefetchEnabled",
        ],
        os.path.join(UI, "src/components/jieqi/JieQiChartsMain.js"): [
            "prefetchJieqiYearNeighbors",
            # PERF-R9 Ship 7:分至 /jieqi/year 进预热组(本组唯一的重端点,排最后一位)。
            # 也是 apply.sh §23 该行的 guard 串(gotcha #48 取最新)。
            "warmJieqiYear",
        ],
        # Mac v3.3.1 新增 quickDockContract 契约测试跨平台修复(windows-adaptations §25):
        # path.relative 在 Windows 返回反斜杠 → 与正斜杠 WHITELIST/EXEMPT 比对恒失配 → 白名单页被误判
        # offender、契约两测假红。relPosix() 归一 POSIX 分隔符(macOS path.sep='/' 为 no-op,零行为变化)。
        # 丢 marker = 同步冲掉 → umi 契约测试在 Windows 假红,发布前哨兵硬失败。
        os.path.join(UI, "src/components/common/__tests__/quickDockContract.test.js"): [
            "horosa_win_pathsep_posix_v1", "relPosix",
        ],
        # Mac v3.5.0 新增 chartFreeContract 契约测试同类跨平台修复(windows-adaptations §25b):
        # path.relative 反斜杠 → 与正斜杠期望表 toEqual 假红;split(path.sep).join('/') 归一 POSIX(macOS no-op)。
        # 丢 marker = 同步冲掉 → umi「声明与期望表一一对应」在 Windows 假红,发布前哨兵硬失败。
        # v3.5.1 并入(#29 单键纪律,同一累积补丁承载):剥注释按 \r?\n 切行 —— JS `.` 不匹配 \r,
        # CRLF 工作树上旧正则剥不掉注释 ⇒ 哨兵被声明处自己的契约注释触发假红(#71 判据免疫环境)。
        os.path.join(UI, "src/utils/__tests__/chartFreeContract.test.js"): [
            "horosa_win_pathsep_posix_v1",
            "horosa_chartfree_strip_crlf_v1", "split(/\\r?\\n/)",
        ],
        # v3.6.2:上游新增的「重引擎不得进入页面静态 import 图」依赖图护栏 —— 其豁免表键是
        # POSIX 写法而 path.relative 在 Windows 返回反斜杠 ⇒ 引擎宿主豁免恒查不中、3D 星盘页
        # 假红(macOS 恒绿)。relPosix 归一后再查表;丢了它 = Windows 侧该护栏永远红,
        # 下一个人极可能顺手把护栏本身关掉(那才是真正的损失)。
        os.path.join(UI, "src/utils/__tests__/heavyEngineImportGraph.test.js"): [
            "horosa_win_pathsep_posix_v1", "relPosix", "ENGINE_HOSTS",
        ],
        # v3.8.1:上游盘面美术传链完备性总锁(wheelArtChart.test)—— CONSUMER_EXEMPT 键是 POSIX
        # 写法('components/astro/AstroZR.js')⇒ Windows path.relative 反斜杠 ⇒ 成文豁免失效 ⇒
        # AstroZR 假红(仓内 pathsep 第 4 例,macOS 恒绿)。relPosix 归一,豁免语义零放宽;
        # 丢了它 = 该总锁在 Windows 永远红,下一个人极可能把总锁本身豁免掉(真损失)。
        os.path.join(UI, "src/components/astro/__tests__/wheelArtChart.test.js"): [
            "horosa_win_pathsep_posix_v1", "relPosix", "CONSUMER_EXEMPT",
        ],
        # v3.9.0 pathsep 第 5 例:塔罗「王牌判据总锁」的 ALLOW 白名单与 `toBe('engine/arcana.js')`
        # 期望值均为 POSIX 写法 ⇒ Windows 反斜杠让 6 个合法豁免全被误报。丢针 = 该总锁在
        # Windows 永远红,下一个人极可能把总锁本身豁免掉(真损失)。
        # issue #68(gotcha #98):3D 全屏状态机。判据必须是 fullscreenElement(当前是否全屏),
        # 不是 fullscreenEnabled(允不允许 —— Electron 恒真);且必须有 fullscreenchange 订阅,
        # 否则用户按 Esc 退出后组件标志停在 true,此后双击再也进不去全屏(用户原话「就是没法全屏」)。
        # [#49 收敛,v3.9.4] fullscreenState 两补丁退役:上游以自有符号形重实现(checkFullScreen
        # 状态位判据 / fullscreenchange×4 订阅 / getBoundingClientRect 实测,注释引用 Issue#68)
        # 并扩到 BookReader。哨兵迁钉**上游形态**:上游哪天回退,这里先红(issue #68 会复现)。
        # 我方回归测试 fullscreenState.test.js 已同步改写为钉上游形(行为 + 源扫描 + 负锚)。
        os.path.join(UI, "src/utils/helper.js"): [
            "document.fullscreenElement", "webkitFullscreenElement",
        ],
        os.path.join(UI, "src/components/astro3d/AstroChart3D.js"): [
            "'fullscreenchange', 'webkitfullscreenchange'", "getBoundingClientRect",
        ],
        os.path.join(UI, "src/components/reader/BookReader.js"): [
            "'fullscreenchange', 'webkitfullscreenchange'",
        ],
        # issue #65/#68:三式打不开的直接回归守卫(该目录此前 6 个测试无一 mount 过组件)。
        os.path.join(UI, "src/components/sanshi/__tests__/sanshiRenderSmoke.test.js"): [
            "horosa_sanshi_render_smoke_v1", "issue #65/#68", "24 档",
        ],
        # issue #83(v3.11.0 大六壬打不开):全技法首屏挂载冒烟 —— 面板表从 pages/index.js 现读(上游新增技法页自动入覆盖面),
        # 数量下限钉死防「解析失效=空集假绿」;负向自证:换回未修的 LiuRengMain 即精确红在 liureng(同一 TypeError)。
        os.path.join(UI, "src/pages/__tests__/techniqueOpenSmoke.test.js"): [
            "horosa_technique_open_smoke_v1", "issue #83", "const MIN_PANES = 30", "readPanes(", "readImportMap(", "该面板.{0,40}加载出错",
        ],
        os.path.join(UI, "src/components/astro3d/__tests__/fullscreenState.test.js"): [
            "horosa_fullscreen_state_v1", "fullscreenEnabled",
        ],
        # v3.9.5:CSS-zoom 浮层两守卫的 shell-free 化(同族第 6 例,机制是 **shell 引号**不是 pathsep)。
        # 上游用 execSync 外壳调 grep/find:Windows 的 execSync 走 cmd.exe,JSON.stringify 的双引号
        # 不按 POSIX 处理反斜杠 ⇒ 正则被吃坏、grep 非零退出 ⇒ **扫描恒空集**(新增违规永远查不出,
        # 假绿方向);find 更是另一个命令直接抛错。丢了这两针 = 静态哨兵在 Windows 上等于不存在。
        os.path.join(UI, "src/utils/__tests__/popupAlignStaticGuard.test.js"): [
            "horosa_win_shell_free_scan_v1", "walkJs", "SCAN_RE",
        ],
        os.path.join(UI, "src/utils/__tests__/layoutDomainStaticGuard.test.js"): [
            # [v3.10.0] 上游新版面域静态守卫 —— execSync grep 家族第三例,同判例改纯 Node 扫描;
            # 丢针 = 同步把上游 shell 版带回来 ⇒ Windows 上 T1 自证红/扫描空集。
            "horosa_win_shell_free_scan_v1", "const SCAN_RE = /(clientHeight|clientWidth|innerHeight|innerWidth)",
        ],
        os.path.join(UI, "src/utils/__tests__/popupAlignZoomGuard.test.js"): [
            "horosa_win_shell_free_scan_v1", "realpathSync",
        ],
        os.path.join(UI, "src/components/tarot/__tests__/tarotTrumpJudgeLock.test.js"): [
            "horosa_win_pathsep_posix_v1", "relPosix", "ALLOW_IF_CORE78",
        ],
        # v3.9.0:上游 [XCT-2] 直取 pane 产物做内容断言,与我方 FreezeSubTab 的 render-prop
        # 相冲(取到空 div)。适配只改「怎么拿到内容」,断言一字未改;丢针 = 小成图右栏
        # 内容契约在 Windows 永远红。
        os.path.join(UI, "src/components/xiaochengtu/__tests__/xiaochengtuRender.test.js"): [
            "horosa_freeze_subtabs_v1", "typeof inner.props.children === 'function'",
        ],
        # v3.3.0 本地后端身份握手(反毒端口):前端校验模块 + Java/Python 双端点。
        os.path.join(UI, "src/utils/backendIdentity.js"): [
            "verifyBackendIdentity", "horosaIdentity", "LaunchSid",
        ],
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/HorosaIdentityController.java"): [
            "HOROSA_LAUNCH_NONCE", "horosa-backend",
        ],
        os.path.join(UI, "src/components/update/UpdateNotifier.js"): [
            "reduceUpdateEvent", "PHASE_APPLYING",
        ],
        # v3.0.1 perf ROUND-4 P0:log4j Windows 缺陷修复(程序化 appender 的 basedir 字面模板 → NTFS 拒绝)。
        # v3.11.0 上游「Java 日志落点根修」用 resolvedBaseDir()(StrSubstitutor 递归替换 + user.home 兜底)+
        # tailUnderDateDir() 取代了我方整段实现 = 等价超集;**#92 超集≠全集**:桌面壳传入的 -Dhorosa.log.basedir
        # 优先级是上游没有的残差(Java 日志要落到应用数据目录 logs/,诊断导出与「打开日志目录」都指向那里),
        # 补丁瘦身为 resolvedBaseDir() 开头的 sysprop 分支 + 常量;marker 常量 log_basedir_v1 兼作 jar 内容哨兵
        # (gotcha #5:该文件属 boundless,改动必须重建 astrostudyboot.jar 才生效)。
        os.path.join(WS, "astrostudysrv/boundless/src/main/java/boundless/log/AppLoggers.java"): [
            "log_basedir_v1", "resolvedBaseDir", "tailUnderDateDir", "horosa.log.basedir", "HOROSA_LOG_BASEDIR_REV",
        ],
        # v3.0.1 perf ROUND-4 P1:占星首盘 9.7s 的 80%(baziAssemble 7781ms 一次性冷成本)→ 启动后台
        # 以合成参数预跑一次 OnlyFourColumns 构造+getNongli(结果丢弃、失败静默)。
        # [#109 收敛,v3.11.2] 上游把同构预热(now 盘 / +08:00 / 121e28 / 31n14)收编进 StartupLedgerListener
        # (随启动账本时序跑),我方 JV-7 补丁与 HOROSA_CHART_WARMUP 开关退役;针并入下方 StartupLedgerListener
        # 条目(nowBirth + 坐标串;丢针 = 首盘冷成本回到用户自付,零报警)。
        # v3.0.1 perf round-3 ★ Windows Defender 排除内置运行时(压倒性主因:实测 ~500x on-access 扫描税)。
        # 这些文件 gitignore、随 exe 走(不进提交),但在盘上,selfcheck 校验其存在与关键内容不被回退。
        os.path.join(BUNDLE, "electron/defender-exclusion.js"): [
            "ensureDefenderExclusion", "Add-MpPreference", "HOROSA_DEFENDER_EXCLUDE", "RunAs",
            # PERF-R11 T2 排除失败闭环:分类器(suspect = marker 说 added:true 但带 lastError,
            # 2026-07-23 本机真实态 —— Access denied 未生效而 UI 全绿)/状态面/一键修复(显式用户
            # 意图绕 promptCount 短路)。成功授权必须显式清 lastError(sticky-merge 修复),否则
            # suspect 永不翻绿。丢任一 needle = 闭环回退,发布硬失败。
            "classifyDefenderExclusionState", "getDefenderExclusionState", "runDefenderExclusionRepair",
            "horosa_defender_state_surface_v1", "horosa_defender_repair_menu_v1", "lastError: null",
            # horosa_defender_autoprompt_v1(owner 2026-07-31「安装/更新后自动弹窗手动授权」):
            # 冷物化「每代一次」重弹判定(纯函数,豁免 MAX_PROMPTS 沉默但 optout 永远最终否决,
            # marker.autoOfferPayloadId 去重)+ loading 页按钮直通提权入口(点击即同意,免二次
            # 确认框)+ 四路授权流单飞闩。丢任一 needle = 自动弹窗/页内授权回退,发布硬失败。
            "shouldAutoOfferOnColdBoot", "autoOfferPayloadId", "authorizeDefenderExclusionDirect",
            "HOROSA_DEFENDER_AUTOPROMPT", "horosa_defender_autoprompt_v1", "exclusionFlowActive",
            # horosa_defender_bom_verdict_v1(issue #59 实报):子进程**绝不可**用
            # `Set-Content -Encoding UTF8`(PS 5.1 带 BOM)写裁决文件 —— 父进程 JSON.parse 会在
            # BOM 上抛错、被吞成 null ⇒ 排除即使真加成功也永远报「未生效」(成功分支不可达,
            # 自 v3.5.x 起的静默失效)。双保险:写侧 UTF8Encoding($false) + 读侧 stripBom。
            # 另分出 readbackOk 维:读不回排除表且添加零报错 = 「已下发无法核实」≠「被拒绝」。
            "horosa_defender_bom_verdict_v1", "stripBom", "UTF8Encoding($false)", "readbackOk",
            # horosa_defender_ps_abs_path_v1(2026-08-03 owner 实机:`spawn powershell.exe ENOENT`,
            # UAC 之前就死,被误归因「取消了管理员确认框」):powershell.exe 不在 System32 根而在
            # System32\WindowsPowerShell\v1.0\ 独立 PATH 条目 —— PATH 被精简的启动语境(敌意冒烟
            # 毒化 PATH 首暴;定制/精简 PATH 的用户环境同理)裸名 spawn 必 ENOENT。OS 二进制绝不
            # 赖 PATH(#12,与 main.js jcmd / update-splash 同惯用法)。丢针 = 回退裸名,发布硬失败。
            "horosa_defender_ps_abs_path_v1", "systemPowershellExe",
            # PERF-R12 W0b(owner 实机 2026-08-03「点了授权还是未完成」):提权异常分维 ——
            # 外层 catch 把 canceled(UAC 取消)/denied(策略或受限 token)/other 写进裁决文件,
            # promptCount 只为真取消递增;受限 token 语境(S-1-5-12)auto-offer 顺延。
            # 丢针 = 三病再被压成一个 exit-1 按「取消」猜。
            "horosa_defender_elev_verdict_v1", "buildElevFailureMarkerPatch",
            "horosa_defender_restricted_token_v1", "isElevationBlockedContext", "S-1-5-12",
        ],
        # PERF-R11 T2:分类器契约测试(node:test;含 2026-07-23 事故 marker → suspect 钉死)。
        # + autoprompt「每代一次」判定用例(capped 机型同代仅一次/新代恰一次/optout 终否决)。
        os.path.join(BUNDLE, "electron/defender-exclusion.test.js"): [
            "classifyDefenderExclusionState", "suspect",
            "shouldAutoOfferOnColdBoot", "autoOfferPayloadId",
        ],
        # PERF-R11 T5a horosa_startup_ab_v1:启动验收台架**入库**(隔离双臂/双口径/#64 机器态
        # 指纹/预算三元组)。此前「工作区可见 637ms」出自一次性临场脚本,复测无凭 —— 台架即制度。
        # 预算字面量另受 check_perf_baseline_evidence 双向锁;这里钉隔离与安全护栏本体
        # (沙箱标记门 + 只杀自家 PID 树 + 端口远离 owner 常驻 app)。
        os.path.join(BUNDLE, "scripts/startup_ab.cjs"): [
            "horosa_startup_ab_v1", "DEFAULT_BUDGETS", "warmReadyBudgetMs", ".horosa-ab-sandbox",
            "refusing to touch non-sandbox dir", "18899",
        ],
        # PERF-R11 T5c:clean_machine 检查器的相分+阶梯观测(阈值不动,纯增量字段)。
        os.path.join(BUNDLE, "scripts/clean_machine_cold_warm_check.py"): [
            "read_history_phases", "ladder_state", "horosa_startup_ab_v1",
        ],
        # NOTE: electron/main.js sentinels live in ONE entry only (further down, the update/
        # auto-restart batch) — a second dict key for the same path silently overrides the
        # earlier one (gotcha #29)。2026-07-05 在这里真实发生过一次:此处曾有一个 main.js 条目,
        # 被下方后出现的同键条目整体覆盖 —— launchNonce/&sid=、runtimeFlowPromise、
        # HOROSA_RENDERER_EAGER、purgeStaleUpdaterBlockmap 等哨兵一度全部失效而无人知晓。
        # 已把那批 needles 合并进下方唯一条目;绝不在此再开第二个 main.js 键。
        # DELTA-V2 stage-runtime:树载荷 + manifest v2 + 构建期 explode(确定性 classes jar)+ 路径预算
        # 断言 + HOROSA_SHIP_FAT_JAR 应急通道。还原任一项 = 差量结构回退,发布硬失败。
        os.path.join(BUNDLE, "scripts/stage-runtime.cjs"): [
            # horosa_devpath_bakein_gate_v1(2026-07-05):发货 payload-manifest 的 sourceManifest
            # 溯源块必须是脱敏版(零构建机绝对路径;完整版只留构建侧 stageRoot/manifest.json)。
            "shippedSourceManifest",
            "buildPayloadManifestV2",
            "writeExplodedBundle",
            "computeTreeFingerprint",
            "assertPayloadPathBudget",
            "linkOrCopyTree",
            "HOROSA_SHIP_FAT_JAR",
            "PAYLOAD_PATH_BUDGET = 135",
            "streamlit/.agents",
            "path.join(stageRoot, 'rt')",
            # PERF-R6 P-1:streamlit 依赖树裁包(dist-info 版本名扫除)+ Scripts 裁 + 载荷 pyc 禁运
            # (prunePythonCaches 必须同时作用于 runtime 树 —— 只作用 project 树曾让 7,640 个易变
            # .pyc 进包,把 3.0.1→3.1.0 差量复用打到 15%)。
            "pruneSitePackagesByPrefix",
            "python/Scripts",
            "prunePythonCaches(stageRuntimeDir)",
            # SELF-HEAL-R1:载荷内 marker 必须字节确定(.horosa-exploded.json 曾带 generatedAt
            # 时间戳 → 同输入三次构建三个 payloadId → 用户每次更新整代换新+温 CDS 作废)。
            "horosa_payload_deterministic_v1",
            # SELF-HEAL-R2 W2:最后两个 payloadId 漂移源(pip *.dist-info/RECORD + direct_url.json,
            # 以及 runtime.manifest.json 的 generatedAt)。回退 = 未变的 runtime 在更新时被判全新
            # → 整代重物化 + 旧代温 CDS 全废 → 更新后首启退化为冷启。第 23 门 check_payload_determinism
            # 复核发货结果;这些 marker 守住产生侧。
            "horosa_payload_determinism_v1",
            "prunePipMetadata",
            "normalizeStagedRuntimeManifest",
            "HOROSA_PRUNE_PIP_METADATA",
        ],
        # build-uber-jar.py 的哨兵**只能有这一个条目** —— 同一路径写第二个 dict key 会静默覆盖
        # 第一个(gotcha #29)。2026-07-20 排查发现:本条曾被下方 ROUND-4 UBER-CDS 批次覆盖,
        # DELTA-V2 的五条不变量当时全是**死钉**。两批已合并到此处。
        # DELTA-V2:extract(构建期 fat→树,确定性)/ merge-tree(用户机 树→uber,与 legacy
        # fat→uber 已证 CONTENT_EQUIVALENT)/ legacy 模式三合一 + \\?\ 长路径免疫。
        # ROUND-4 UBER-CDS:classpath.idx first-wins 类解析、Start-Class → Main-Class、
        # Spring factories/handlers/services 并集、原子写。
        os.path.join(BUNDLE, "electron/build-uber-jar.py"): [
            "def extract_tree",
            "def merge_from_tree",
            "DETERMINISTIC_ZIP",
            "def _lp",
            "write_dir_entries",
            "HOROSA_UBER_OK",
            "classpath.idx",
            "Start-Class",
            "spring.factories",
            "LINE_UNION_EXACT",
            "os.replace",
        ],
        # DELTA-V2 delta-report.py:blockmap 差量估算(校验和+等长,复现 updater 自身算法)+ manifest
        # 层真实变更对比(结构健康度判据的数据源)。selfcheck 差量门依赖本文件。
        os.path.join(SCRIPT_DIR, "delta-report.py"): [
            "def compute_delta",
            "def compute_manifest_diff",
            "structureHealthy",
            "downloadOps",
        ],
        # NOTE: installer.nsh sentinels live in ONE entry only (further down, the #18/#23/#25 batch)
        # — a second dict key for the same path silently overrides the first (gotcha #29). The
        # Defender markers below were merged into that entry on 2026-07-02 after this exact trap
        # made them dead needles.
        # ChartController.java 的哨兵**只能有这一个条目** —— 同一路径写第二个 dict key 会静默
        # 覆盖第一个(gotcha #29)。2026-07-20 排查发现:本条曾被下方 v2.4.0 批次里的
        # ["orbs","orbScale"] 覆盖,CHART_PERF_SEG_REV / "/chart seg ms" 当时是**死钉**,
        # 而 windows-adaptations/README 台账 #11 还声称它兼作「重建 jar 哨兵」。已合并到此处。
        # v3.0.1 perf round-2:/chart 逐段计时(B0,纯观测、不改结果;BACKEND → jar rebuild)。
        # v2.4.0:orbs/orbScale 进 astrostudycn 白名单(容许度随盘持久化)。
        # ★ QueueLog.info(AppLoggers.Performance 同时是 apply.sh §9 的幂等 guard marker ——
        #   guard 串必须同时是哨兵钉,否则任一侧改名会让另一侧静默失效(PERF-R9 G9)。
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java"): [
            "CHART_PERF_SEG_REV", "/chart seg ms",
            "QueueLog.info(AppLoggers.Performance",
            "orbs", "orbScale",
        ],
        os.path.join(UI, "src/components/planetarium/PlanetariumBabylon.js"): [
            "perf:planetariumRenderGating", "startRenderLoop", "stopRenderLoop",
            "_renderRequested", "_lastMetricEmit", "_timeEditDebounce",
            # PERF-R10 Ship1:天文馆终点打点(finishStateData 应用回调 + request-error 终态)——
            # P5 观测覆盖门要求每个技法键可测;丢它 = planetarium 回到「优化了也无从验收」。
            "markPanelReady('planetarium')",
        ],
        os.path.join(UI, "src/components/xuanshi/echartsCore.js"): [
            "echarts/core", "EffectScatterChart", "LegendScrollComponent",
            "AxisPointerComponent", "GeoComponent", "echarts.use(",
        ],
        os.path.join(UI, "src/components/xuanshi/XuanShiCelestial.js"): ["./echartsCore"],
        os.path.join(UI, "src/components/xuanshi/XuanShiMap.js"): ["./echartsCore"],
        # PERF-R12 W0d 制度门(v3.7.0 覆盖修):门前预装键集白名单断言 —— 新 CORE 服务必须显式
        # 决定门前/门后(误入门前=全体用户温启直付其冷 import 链,electionscan +1.1s 实证)。
        # manifest 钉文件哈希,这里钉判据存在性:重构删掉这道检查=发布硬失败。
        os.path.join(BUNDLE, "scripts/verify_all_services.py"): [
            "horosa_pregate_prewarm_budget_v1", "PRE_GATE_PREWARM_KEYS", "check_pregate_prewarm_budget",
        ],
        # PERF-R12 W3h:验收台架四修 —— 台架自身的判据必须有分辨力(#71),四针钉住:
        # ①三消费者共用一份扫描源(STEP_SCAN_BODY;各带私货过滤 = 读到的档位与点到的控件不是同一个);
        # ②穷尽扫描+inline 锚排序(首匹配会被左栏「年/月」设置 Select 误配);③结构化诊断
        # (零样本必须可归因);④选项面 xq-check-item 同构扩容 + calendar 按页档位映射。
        os.path.join(BUNDLE, "scripts/perf_acceptance.cjs"): [
            "STEP_SCAN_BODY", "stepControlDiag", "horosa-time-adjust-inline",
            "OPTION_TOGGLE_SELECTOR", "xq-check-item", "PAGE_STEP_PROFILE",
        ],
        os.path.join(BUNDLE, "electron/service-manager.js"): [
            # [#109,v3.11.2] 壳侧对位 Mac R5(JV-23):JVM R5 旗标三件 + 就绪探活 50ms + 页面账本 web 层。
            "horosa_jvm_r5_flags_v1", "-XX:-UsePerfData", "spring.mvc.servlet.load-on-startup", "HOROSA_JAVA_BOOT_LOGGING",
            "horosa_ready_fast_poll_v1", "HOROSA_READY_FAST_POLL", "webLedgerMark(",
            # PERF-R11 T1 CDS 阶梯激活闭环:T1.0 原子 dump(.tmp+尺寸校验+rename,dump 中被杀
            # 不毒档);T1a 跨进程阶梯锁(evaluateLadderLock 纯裁决 acquire/busy/reclaim —— 双
            # explode 同写 ${uberJar}.tmp 交错=损坏级,必须单写者);T1b 链式+空闲门+就绪延时
            # 60s→20s;T1a′ prepare 遇活 app 改 p2Only 共存(旧行为整体让位 —— 装机验证时 app
            # 恒活 ⇒ 全机一个 .jsa 都建不成的静默失效根源,每次温启白丢 ~2.2s)。
            "horosa_static_cds_atomic_v1", "horosa_ladder_lock_v1", "horosa_ladder_chain_v1",
            "horosa_prepare_p2_coexist_v1", "evaluateLadderLock", "acquireLadderLock",
            "HOROSA_LADDER_LOCK", "HOROSA_LADDER_CHAIN", "HOROSA_STATIC_CDS_DELAY_MS",
            "waitForIdleWindow", "isPayloadReadyNow",
            # PERF-R12 W0a②④(v3.7.0 覆盖修):P2 期 prepare **不再杀**(它在建的正是「更新后
            # ~6s 温启段」的解药;P1 相接管不变)+ prepare 锁 30min 陈旧上限只删锁绝不 taskkill
            # (PID 复用防误杀)。丢针 = 更新建档槽退化回「见 P2 即杀」,过渡态复发。
            "horosa_prepare_tolerate_v1", "HOROSA_APP_TOLERATE_PREPARE_P2",
            # PERF-R12 W0c:startup-history 每样本带**选挡时刻**的阶梯位快照(uber/static)——
            # 「这次为什么 6s/4s」在 history 里自解释;W1c 两面廉价旗(Mac 启动器已带)。
            "horosa_history_ladder_field_v1", "lastLaunchLadder",
            "horosa_cheap_jvm_flags_v1", "-Dlog4j2.statusLevel=WARN", "-Dspring.main.banner-mode=off",
            # PERF-R11 T3b 启动可视化字段族:物化结构化进度(message 原样保留=零破坏)+
            # 「以往通常约 X 秒」纯函数;T4′ 物化桶账(纯观测,分级物化决策线的数据源)。
            "horosa_payload_progress_struct_v1", "horosa_startup_expectation_v1", "horosa_loading_ux_v2",
            "computeStartupExpectation", "horosa_materialize_bucket_stats_v1", "bucketForManifestPath",
            "HOROSA_MATERIALIZE_STATS", "HOROSA_LOADING_UX",
            # v3.0.1 perf: AppCDS 主动落档(就绪后落 .jsa,强杀/任务管理器关闭也留暖缓存)。
            "scheduleEagerAppCdsDump",
            "APP_CDS_EAGER_DUMP_DELAY_MS",
            # v3.0.1 perf round-2(启动/交互):
            #   S1 整盘探针移出就绪关键路径 → 后台预热(chartProbeWarmupPromise);
            #   S2 静音 149K 条 CDS 告警刷屏(-Xlog:cds=off);
            #   B3 重开后端结果缓存(本地磁盘层、无 Redis)→ 重复/切回/来回秒回,kill-switch HOROSA_CHART_CACHE。
            "chartProbeWarmupPromise",
            "-Xlog:cds=off",
            "HOROSA_CHART_CACHE",
            "paramhash.cache.local.enable",
            # PERF-R10 Ship4:两条新 -D(comm 缓存豁免 + chart 家族内层跳过)。丢针 = Java 侧
            # 改动还在 jar 里,启动器却不再传旗标 —— 双双静默回退(B3 恒 miss 抛错、B7 撞键面重开)。
            "cachehelper.needcache=false",
            "astrohelper.skip.inner.cached.paths=true",
            # v3.5.1 对位:①LazyCacheFactory 桌面档启用(-D;缺省 false=服务器零变;上游实测
            # refresh −490ms);②Python 预热并行梯的现场覆盖透传(白名单 spawn env,不透传则
            # HOROSA_PY_WARMUP_PARALLEL 永远够不到产品;trusted 值形由产品侧 truthy 家族解析)。
            "horosa_cache_lazyinit_v1", "-Dhorosa.cache.lazyinit=true",
            "HOROSA_PY_WARMUP_PARALLEL",
            # PERF-R10 S1:starting-* 状态即发布端口对 + payloadId stash(渲染器 &rv= 的数据源)。
            "horosa_early_nav_v1", "horosa_l3_rev_wire_v1", "activePayloadId",
            # PERF-R9 Ship 1(horosa_paramhash_redis_kill_v1):关掉 Redis 必须走 **-D 系统属性**。
            # 只写 `--paramhash.cache.redis.enable=false` 是空操作(PropertyPlaceholder 不读 -D,
            # ProgArgsHelper 只能覆盖属性文件里已存在的键,而该键哪个文件里都没有)→ EnableRedis
            # 一直是 true → 机器上没有 Redis → 每次缓存读写都抛 → reconnect() 里的 System.gc()
            # → SerialGC 下 512MB 堆的 stop-the-world full GC,**每次缓存操作精确 2 次**,实测
            # 温请求 70-77% 的墙钟都耗在这里。丢掉这三个 marker = 该回归静默复活,发布前硬失败。
            "horosa_paramhash_redis_kill_v1",
            "-Dparamhash.cache.redis.enable=false",
            "-XX:+DisableExplicitGC",
            # PERF-R9:把 paramhash 磁盘缓存移出 payload 树(否则每次更新换 payloadId,
            # 启动清扫连缓存一起删 ⇒ 所有用户回到全冷)。必须是 -D:LocalDir 走 resolveFlag。
            "horosa_paramhash_localdir_sysprop_v1",
            "-Dparamhash.cache.local.dir=",
            # v3.0.1 perf round-3(启动残余):Tomcat 线程池收敛 + lazy-init 实测开关。
            "server.tomcat.threads.min-spare",
            "HOROSA_SPRING_LAZY_INIT",
            # v3.0.1 perf ROUND-4(暖启 ~8s):exploded 扁平 classpath 启动(避开 Spring Boot 嵌套 jar
            # classloader)。实测 fat-jar -jar 23.9s → exploded -cp 15.9s。首启后台解爆、次启用扁平 CP;
            # classpath.idx 有序 + @argfile 保证与 fat jar 逐类解析一致(功能零降级)。kill HOROSA_EXPLODED_LAUNCH=0。
            "HOROSA_EXPLODED_LAUNCH",
            "scheduleBackgroundExplode",
            "buildExplodedClasspath",
            "readClasspathIdxOrder",
            "writeClasspathArgfile",
            "isExplodedRuntimeReady",
            # v3.0.1 perf ROUND-4 UBER-CDS(暖启 Java 侧 ~11s→~7s):把 fat jar 的 342 nested lib jar 合并成
            # 单个 uber jar 作启动 classpath。单 jar 才能让 -Xshare:dump 在 ~15s 完成并生成覆盖 ~98% 启动类的
            # 静态归档(343-entry classpath 需 >600s 且产不出归档=旧静态 CDS 实际是死代码)。合并对类解析逐字节
            # 等价(classpath.idx 顺序 first-wins + Spring/SPI 资源合并,见 build-uber-jar.py)。kill 同 EXPLODED。
            "horosa-uber.jar",
            "build-uber-jar.py",
            "UBER_JAR_MIN_BYTES",
            "explodeJarRuntime",
            # v3.0.1 perf ROUND-4 P2 层叠 CDS:static 基档之上再链一层 dynamic 归档(jcmd dynamic_dump,
            # 收进静态清单漏掉的启动类 + 首盘计算类)。uber 单 jar 入口可安全用 RecordDynamicDumpInfo。
            # kill: HOROSA_UBER_DYNAMIC_CDS=0 → 退回 static-only。
            "HOROSA_UBER_DYNAMIC_CDS",
            "uber-dynamic",
            # v2.5.4 启动稳健化 ①: the trusted fast-path no longer uses 'Promise.resolve(...port probe...)' —
            # it now runs a REAL waitForBackendHeartbeat against trustedRuntimeServerRoot with short-timeout
            # then full-timeout fallback. The presence of this variable name is the marker that the trusted-path
            # probe goes through real HTTP /heartbeat (not just port-open) — reverting breaks the white-screen fix.
            "trustedRuntimeServerRoot",
            # issue #2 (Win11 won't run): embedded Python/Java must be spawned
            # with host PYTHON*/_JAVA_OPTIONS contamination stripped + Python run
            # isolated (-E -s -X utf8). Reverting any of these re-opens the bug.
            "sanitizeEmbeddedRuntimeEnv",
            "buildPythonRuntimeArgs",
            "_JAVA_OPTIONS",
            "'-E', '-s', '-X', 'utf8'",
            # v3.5.0: vendor/ root on the embedded chart-service sys.path so the shared module
            # `kin_year_domain` (全年份域四柱回退, imported top-level by kentang engines 太乙/奇门/
            # 金口/皇极/五兆/邵子/铁板/数算 on extreme years) resolves in the packaged app.
            # Reverting silently degrades BC/远古 four-pillars to the sxtwl out-of-domain fallback.
            "horosa_vendor_syspath_v1",
            "layout.vendorDir",
            # issue #7: payload extraction must resolve tar to an absolute path, not bare `tar`
            # (bare-tar PATH/PATHEXT resolution ENOENT'd on some machines -> app couldn't launch).
            "resolveTarExe",
            # v2.3.0 issue #9: the embedded JVM must honor the OS system proxy so AI providers
            # (OpenAI/Anthropic/etc.) are reachable behind a corporate/system proxy. This launcher
            # flag is the 3rd leg of the fix (with boundless+astrostudy ProxySelector); reverting it
            # re-breaks AI for proxied users. The flag is inert when no system proxy is configured.
            "useSystemProxies",
            # v2.5.0 startup hardening (mirror of macOS start_runtime_with_port_retry): on a port/bind
            # conflict the launcher retries with a fresh port pair (launchServicesWithPortRetry +
            # isPortConflictError gating the retry decision), and tags the embedded backend
            # (-Dhorosa.runtime.owner) so it is positively identifiable. Reverting these re-opens the
            # "端口被占用 / 后端未启动" symptom the release fixes.
            "launchServicesWithPortRetry",
            "isPortConflictError",
            "-Dhorosa.runtime.owner=horosa-desktop",
            # v2.5.4 启动稳健化 ③: Spring Boot must bind 127.0.0.1 only (NOT default 0.0.0.0)
            # otherwise Windows Firewall prompts on first launch / may block startup.
            # Mirror of macOS start_horosa_local.sh; see docs/windows-启动稳健化-镜像清单.md ③.
            "--server.address=127.0.0.1",
            # v2.5.4 启动稳健化 ①: even on trusted fast-path the backend probe must do a REAL
            # HTTP /heartbeat (not just port-open) — port open ≠ Java truly ready, otherwise UI
            # loads PRE-ready → 白屏. Falls back to full STARTUP_READY_TIMEOUT_MS wait on first
            # try failure (never short-circuits). See docs/windows-启动稳健化-镜像清单.md ①.
            "waitForBackendHeartbeat(trustedRuntimeServerRoot",
            # v2.5.4 启动稳健化 ②: Windows Job Object KILL_ON_JOB_CLOSE so children (python/java)
            # die with parent Electron on crash/OOM/external kill. Implemented in job-object.js,
            # wired at top-level of service-manager.js. Failure falls back to taskkill/findPort.
            "attachJobObject",
            # v2.6.6: concurrent-restart latch — the health-light popover / error modal /
            # offline banner each expose "重启后端"; without the latch a rapid double-trigger
            # interleaves stop()/start() (stop's finally nulls startPromise mid-start) and can
            # spawn + leak a duplicate python/java pair until app exit.
            "restartPromise",
            # v2.6.6+ hardening batch (local, ships with next release):
            # startup sweep of stale embedded-runtime payload caches — every update used to
            # leave the previous ~1.35GB extraction behind forever (10GB+ on long-term users).
            "sweepStalePayloadCaches",
            # python.log/java.log size cap (one .1 generation) — they were append-only
            # with no bound.
            "rotateLogIfLarge",
            # post-v2.6.6 local batch (ships with next release):
            # spawn 'error' (AV-quarantine ENOENT / CFA EACCES) → actionable runtime-error.
            "attachSpawnErrorHandler",
            # 全球健壮性轮(2026-07-05):
            # ① 数据目录写探针(杀软/权限把 %LOCALAPPDATA%\HorosaDesktop 锁只读时,最早点给出
            #    可行动根因,而不是一串下游超时谜团);
            # ② 物化前磁盘复检(缺口给真实 GB 数字,ENOSPC 不再化作「服务未就绪」);
            # ③ 首启冷物化就绪预算分级(120s 一刀切在慢盘首启假报未就绪;端口绑定相位同步放宽);
            # ④ 身份握手 nonce 会话化(「后端已重启、渲染器未重载」窗口里旧 &sid= 必须仍有效);
            # ⑤ JVM locale 钉扎 zh_CN(土耳其 İ/泰佛历 yyyy=25xx/小数逗号等系统区域设置不再能
            #    改变后端行为;对 zh_CN 机器按构造零变化;刻意不钉 timezone/file.encoding)。
            "horosa_userdata_writable_probe_v1",
            "horosa_materialize_disk_precheck_v1",
            "horosa_first_boot_timeout_v1",
            "FIRST_BOOT_READY_TIMEOUT_MS",
            "resolveReadyTimeoutMs",
            "horosa_nonce_per_session_v1",
            "ensureLaunchNonce",
            "horosa_java_locale_pin_v1",
            "-Duser.language=zh",
            # R2 全球健壮性轮(2026-07-05):
            # ⑥ 端口保留段免疫(EACCES/10013 也走换口重试;findPort 远端回退基址+可行动文案;
            #    HOROSA_*_PORT_BASE 逃生门);
            # ⑦ 物化后损坏静默自愈(确定性关键文件预检 → 失配即重同步,免用户点修复);
            # ⑧ 用户数据 3 代轮换快照(封死「损坏 store 被空态覆盖」唯一毁灭路径)。
            "horosa_port_reserved_range_v1",
            "FALLBACK_PORT_BASE_OFFSET",
            "HOROSA_CHART_PORT_BASE",
            "horosa_payload_integrity_precheck_v1",
            "payloadIntegrityPrecheckOk",
            "horosa_userdata_snapshot_v1",
            "rotateUserDataSnapshots",
            # reject a truncated/corrupt CDS archive instead of trusting size>0 forever.
            "APP_CDS_MIN_ARCHIVE_BYTES",
            # mongo-fallback dir creation wrapped in try/catch → surfaces disk-full/
            # permission errors as an actionable message instead of a cryptic mongo
            # init failure on constrained-disk machines. (round-6 coverage gap.)
            "无法创建本地数据目录",
            # v2.6.7 覆盖重发 — 非首次启动提速。真正的修复 = AppCDS dump 超时（1.5s→20s，让 .jsa 类缓存
            # 真正建立、下次启动经 -Xshare:auto 加载）；另保留无执行代价的纯收益项（跳过启动期 cron/transgroup
            # 扫描 + UseSerialGC + 512m 堆）。实测剔除 TieredStopAtLevel/lazy-init/-Xverify:none（拖慢就绪门控
            # 的排盘计算 / 无净收益 / 与 CDS 冲突）—— 详见 docs/SELFCHECK_LOG.md。还原任一项即回退慢启。
            "APP_CDS_DUMP_TIMEOUT_MS = 20000",
            "UseSerialGC",
            "-Xmx512m",
            "HOROSA_ENABLE_STARTUP_TRANSGROUP_INIT",
            # v3.0.1 perf ROUND-5(壳层启动挤压):
            #   E-2 java spawn 后立刻并行起 early-heartbeat 探测(Python 等待期把 Java 就绪也等掉);
            #   E-3 waitForPort 轮询 150ms;J-3a/J-3b Spring 启动横幅日志与 log4j2 JMX 注册关掉;
            #   PS-3 就绪后一次性后台 compileall(下次启动吃 .pyc);B-F3 农历日级持久化桌面停用。
            "earlyHeartbeat",
            "--spring.main.log-startup-info=false",
            "-Dlog4j2.disable.jmx=true",
            "schedulePycCompile",
            "PYC_PRECOMPILE_REV",
            "HOROSA_PYC_PRECOMPILE",
            "HOROSA_NONGLI_DAY_PERSIST",
            # DELTA-V2 增量更新契约(差量发布 v2):载荷=文件树按清单逐文件校验同步(去 tar)+
            # 后端 prebuilt exploded 出厂(fat jar 不进载荷)+ 一切缓存键改挂 bundleFingerprint +
            # 树 -cp 兜底。还原任一项 = 打包结构回退 → 差量失效(实测单 tar 时代复用率仅 16.8%)。
            # resolveTarExe 保留 = format-1 应急通道(HOROSA_SHIP_FAT_JAR)的读取路径。
            "PAYLOAD_MANIFEST_FORMAT",
            "syncPayloadTree",
            "findPreviousPayloadRoot",
            "copyFileWithHash",
            # PERF-R6:载荷物化=资源树 sha 校验后硬链接直挂(同卷零拷贝;HOROSA_PAYLOAD_LINK=0 回拷贝)。
            # 丢 marker = 首启回到二次全量写盘(1.18GB)慢路径。
            "PAYLOAD_LINK_ENABLED",
            "HOROSA_PAYLOAD_LINK",
            # v3.2.1 首启提速:载荷物化有界并发(12,852 文件的打开/哈希/链接 I/O 等待互相重叠)+
            # 进度提细到 1000 文件/百分比/复用数。丢 marker = 回到逐文件串行慢路径 + 黑盒进度。
            "PAYLOAD_SYNC_CONCURRENCY",
            "PAYLOAD_SYNC_PROGRESS_V2",
            "HOROSA_PAYLOAD_SYNC_CONCURRENCY",
            # PERF-R7 Phase2 安装期预热(红队 C1 协议):prepare 四步链 + 锁文件协作(P1 等待/
            # P2 接管)+ sweep pid 存活守卫(修复「持锁才安全」被 prepare 打破的不变量)。
            # 丢任一 marker = 预热与正常启动的互斥被回退 → 双物化撕活树类事故窗重开。
            "prepareRuntimeArtifacts",
            "coordinateWithInstallPrepare",
            ".prepare-runtime.lock",
            "PREPARE_SWEEP_PID_GUARD",
            # PERF-R7 P1 观测:启动分相计时持久化 + startup-history 滚动 + python /chart 三段计时
            # 常开 + classlist 跑批 astrosrv 显式回环(死主机名 DNS 停顿修复)。
            "STARTUP_PHASE_TIMINGS",
            "recordStartupHistory",
            "HOROSA_PY_CHART_TIMING",
            "--astrosrv=http://127.0.0.1:9",
            # v3.2.2 四层启动账本壳侧注入(Mac Rust/shell 层的 Windows 对位):HOROSA_LEDGER_FILE/
            # HOROSA_RUN_TAG 进 python+java env,py/java 写入端才生效;丢 marker = 账本断链。
            "HOROSA_LEDGER_FILE",
            "HOROSA_RUN_TAG",
            "startup-ledger.jsonl",
            # v3.3.0 身份握手壳侧对位:每启动 nonce 注入 HOROSA_LAUNCH_NONCE(python+java)+
            # state.launchNonce 交 main.js 附 &sid=。丢 marker = 反端口占用防线断链。
            "HOROSA_LAUNCH_NONCE",
            "launchNonce",
            # ★ 中文路径修复(实测:UTF-8 绝对路径 argfile 在中文用户名 C:\Users\芸\ 下被 JDK launcher
            # 按码页误解 → classpath 坏 → ClassNotFoundException: AstroStudyProgram → 后端起不来)。
            # 修=writeClasspathArgfile 发相对路径(BOOT-INF/…,纯 ASCII)+ Java/CDS spawn 用
            # cwd=explodedDir(镜像 Mac `cd boot-exploded && java -cp .`)。丢任一 marker = 中文路径回归。
            "path.relative(ctx.explodedDir, entry)",
            "this.explodedLaunch.ctx.explodedDir",
            "readPrebuiltMarker",
            "getBundleIdentity",
            "bundleFingerprint",
            "buildTreeClasspath",
            "merge-tree",
            # DELTA-V2 path-budget: runtime tree top = rt/ (rtShort resolution; legacy fallback kept)
            "rtShort",
            # SELF-HEAL-R1 F1/F5:就绪后存活看门狗(挂死≈100s 内升级 runtime-error → H-7 有界
            # 自动重启)+ chart 探针两轮失败闭环,共用单发闩锁 escalateRuntimeError。回退任一
            # = 挂死/引擎失能重新退化为"用户手点重试"。
            "horosa_backend_watchdog_v1",
            "HOROSA_BACKEND_WATCHDOG",
            "evaluateWatchdogTick",
            "escalateRuntimeError",
            "horosa_chart_probe_closure_v1",
            "HOROSA_CHART_PROBE_ESCALATE",
            # SELF-HEAL-R1 F4:用户数据快照自动还原(损坏 store 隔离 + 最新合法备份代拷回,
            # Java spawn 之前完成;隔离名故意不带 .json 尾防 glob 级联)。
            "horosa_userdata_autorestore_v1",
            "HOROSA_USERDATA_AUTORESTORE",
            "autoRestoreUserDataSnapshots",
            # SELF-HEAL-R1 F6a:pyc compileall spawn 也必须过 sanitizeEmbeddedRuntimeEnv(gotcha #9)。
            "horosa_pyc_env_sanitize_v1",
            "buildPycSpawnOptions",
            # SELF-HEAL-R1 F6b:完整性预检的 sha256 层(命名小件真哈希,抓同尺寸位翻转)。
            "horosa_precheck_sha_v1",
            "HOROSA_PRECHECK_SHA",
            # SELF-HEAL-R1 实况实证修复:就地重物化换代时旧代目录被瞬时锁(刚退出 JVM 的
            # .jsa section 残留/AV 扫新硬链)→ 裸 fs.rmSync EPERM 卡死整个自愈;抗锁版本
            # 清只读+退避重试骑过。回退=损坏自愈在跑过一次的机器上必死。
            "horosa_rmrf_resilient_v1",
            "removeDirResilient",
            # SELF-HEAL-R2 W1:物化「拷/链/读」侧的抗瞬时锁(R1 只加固了删侧)。12,852 文件首启
            # 逐个落盘,AV/索引器对任一文件的瞬时独占(EBUSY/EPERM)此前直接让整次同步硬失败
            # 落修复屏。回退 = AV 重的机器首启即高危。完整性失配仍必须 fail-closed(零重试)。
            "horosa_payload_copy_retry_v1",
            "runWithTransientFsRetry",
            "FS_TRANSIENT_CODE_RE",
            "HOROSA_PAYLOAD_COPY_RETRY",
            # SELF-HEAL-R2 W3:自愈档案(环形 50 条,原子写,损坏=空态绝不阻启动)+ 跨启动
            # 崩溃环断路器(三闩锁:稳定前才计数/每启动最多 +1/首 ready 后 45s 稳定即清零)。
            # 回退 = 启动崩溃环每次重开进程白拿全新 H-7 预算,慢性损坏机器被永远静默重愈。
            "horosa_heal_history_v1",
            "horosa_boot_loop_breaker_v1",
            "readSelfHealHistory",
            "writeSelfHealHistoryAtomic",
            "shouldTripBootLoopBreaker",
            "shouldNotifySameKindHeal",
            "recordHealEvent",
            "HOROSA_HEAL_HISTORY",
            # SELF-HEAL-R2 W5:看门狗升级前的长超时(15s)确认探针 —— 睡眠宽恕只看墙钟 gap,
            # 看不见 CPU 抖动;回退 = 100% CPU 下健康但慢的后端被无谓重启。
            "horosa_watchdog_confirm_probe_v1",
            "resolveWatchdogEscalation",
            "probeBackendsOnce",
            "HOROSA_WATCHDOG_CONFIRM",
            # SELF-HEAL-R2 W6:taskkill 绝对路径(全模块唯一裸名系统二进制,PATH 被剥空即静默
            # 失效)/ Java OOM 硬退出(卡死的 OOM JVM 让崩溃处理器与看门狗同时失明)/ 隔离件
            # GC(正则两端锚死 + 14 位时间戳,绝不可能吃掉真 store 或备份代)。
            "horosa_taskkill_abs_v1",
            "resolveTaskkillExe",
            "HOROSA_TASKKILL_ABS",
            "horosa_java_exit_on_oom_v1",
            "-XX:+ExitOnOutOfMemoryError",
            "resolveJavaMaxHeapMb",
            "HOROSA_JAVA_EXIT_ON_OOM",
            "horosa_quarantine_gc_v1",
            "selectQuarantineFilesToDelete",
            "HOROSA_QUARANTINE_GC",
            # SELF-HEAL-R2 W6:磁盘预检测必须探「已解析物化根」所在卷(长路径回退根可能在别的盘)。
            "pickStatfsProbePath",
            # SELF-HEAL-R3:updateState 是纯 merge —— 失败屏字段(releasesUrl/failureKind)若不
            # 作用域化会粘滞穿越 ready,下一次不相干的失败会错误复浮「更新失败」按钮。
            "horosa_repair_fields_scoped_v1",
            # SELF-HEAL-R3:渲染器崩溃恢复决策纯函数(有界 2 次/5 分钟窗;failed 态绝不自动重启)。
            "resolveRendererCrashAction",
            # SELF-HEAL-R3:minidump 回收纯选择器(只认 *.dmp,绝不碰 Crashpad 簿记文件)。
            "selectCrashDumpFilesToDelete",
            # SELF-HEAL-R3:子日志【会话内】封顶。★必须继续排水('data' 流动模式)——停止消费会
            # 填满 64KB OS 管道 → 阻塞子进程 print → 看门狗升级 → 日志封顶自己造出崩溃环。
            "horosa_child_log_cap_v1",
            "nextChildLogBudget",
            "HOROSA_CHILD_LOG_CAP",
        ],
        # v3.0.1 perf ROUND-4 UBER-CDS 的 build-uber-jar.py 哨兵已上移合并进 DELTA-V2 那一条
        # (本文件唯一的 build-uber-jar.py 条目)。此处**不得**再写同名 key —— 它会静默覆盖上面
        # 那条,DELTA-V2 的五条不变量就会重新变成死钉(gotcha #29,2026-07-20 第三次复发)。
        # v2.5.4 启动稳健化 ②: the Job Object module itself — KILL_ON_JOB_CLOSE flag + koffi binding
        # to CreateJobObjectW / SetInformationJobObject / AssignProcessToJobObject. Reverting breaks
        # the cleanup-on-crash guarantee that prevents 孤儿 python.exe/java.exe → port-occupied bugs.
        os.path.join(REPO, "desktop_installer_bundle/electron/job-object.js"): [
            "attachJobObject",
            "JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE",
            "CreateJobObjectW",
            "AssignProcessToJobObject",
        ],
        # In-app auto-update must stay ENABLED (it was once disabled wholesale as
        # "updater noise"), and the install handoff MUST stop the embedded Python/Java
        # sidecars BEFORE quitAndInstall -- otherwise NSIS fails to overwrite the
        # locked app-runtime files (the classic instability). Also guard that the
        # visible download-progress window stays wired (without it the user can't tell
        # the download is happening), and that the initial check is scheduled from
        # bootstrap (runtime-independent, so it fires on every app open).
        os.path.join(BUNDLE, "electron/main.js"): [
            # [#109,v3.11.2] 壳侧对位 Mac R5(PERF_INVENTORY JV-23):早导航 boot=/firstLaunch= · rv 就绪对比 ·
            # backend-confirmed 事件 · 缩放随窗宽封顶 · 启动/修复单飞。丢任一 = 「Mac 做了的优化」在 Windows 静默缺席。
            "horosa_early_nav_post_update_v1", "HOROSA_EARLY_NAV_POST_UPDATE", "firstLaunch",
            "horosa_rv_ready_compare_v1", "horosa:backend-confirmed", "horosa_zoom_cap_by_width_v1",
            "__HOROSA_SHELL_ZOOM_CAPPED", "refuseIfRuntimeBusy",
            # PERF-R11:T3a 冷启 early-nav 解锁(untrusted 首启也提前导航 —— starting-python 时
            # 物化必已完成,绝不与物化抢 IO,冷路径渲染器串行尾 -1.8s)+ T2 Defender 状态面/
            # 修复菜单接线 + T3b startupUx 种子(expectedTotalMs/runtimeStartedAtMs 经
            # bootstrapConfig 下发,页面永不碰磁盘)+ T1b idleTimeProvider 注入(SM 保持
            # electron-free,powerMonitor 依赖只在壳层)。
            "horosa_early_nav_cold_v1", "EARLY_NAV_COLD_ENABLED", "HOROSA_EARLY_NAV_COLD",
            "publishDefenderExclusionState", "runDefenderExclusionRepair", "HOROSA_DEFENDER_SURFACE",
            # horosa_defender_autoprompt_v1:授权弹窗与启动税时刻耦合(冷物化开始即弹/温启等
            # python 段;每启动恰一路)+ loading 页授权按钮的 IPC 端(直通提权,完成刷新状态面)。
            "maybeOfferDefenderExclusion", "desktop:defender-authorize", "authorizeDefenderExclusionDirect",
            # v3.9.2 双保险副本 IPC(白名单硬验 + tmp+fsync+rename 原子写)。
            "desktop:shadow-store-write", "SHADOW_ALLOWED_KEYS", "fsyncSync",
            "HOROSA_DEFENDER_AUTOPROMPT",
            "computeStartupUxSeed", "runtimeStartedAtMs", "idleTimeProvider",
            # T1a′ prepare 共存开关在 main.js(runPrepareRuntime 侧)读取。
            "HOROSA_PREPARE_P2_WITH_APP",
            # PERF-R12 W0a①③:更新建档槽 —— NSIS 更新分支传 `--p2-only`(决定性防 P1 竞态,
            # P1 永远归重启的 app)+ prepare 本体降 BELOW_NORMAL(子进程继承,补齐礼让缺口)。
            # PERF-R12 W0b:受限 token 语境(更新器拉起的实例,组带 S-1-5-12)auto-offer 顺延,
            # 不烧 promptCount。丢针 = 更新槽/顺延语义回退。
            "horosa_update_prepare_slot_v1", "IS_PREPARE_P2_ONLY", "PRIORITY_BELOW_NORMAL",
            "isElevationBlockedContext",
            "AUTO_UPDATE_ENABLED = true",
            "runtimeManager.stop('update-install')",
            "quitAndInstall",
            "showDownloadProgressWindow",
            # P0-1 (v2.5.4): fail-closed Ed25519 update-signature verification before install, and
            # autoInstallOnAppQuit OFF so an unverified update can never be silently applied on quit.
            # Reverting either re-opens the unsigned-auto-update RCE channel.
            "verifyDownloadedUpdate",
            "autoInstallOnAppQuit = false",
            # H-7 (v2.5.4): bounded auto-restart of a crashed backend before the manual repair UI.
            "MAX_RUNTIME_AUTO_RESTARTS",
            # P1-4: differential (delta) downloads kept ON explicitly.
            "disableDifferentialDownload = false",
            # v2.6.6 zoom persistence: resolveInitialWindowState must READ the persisted
            # window-state.json back (saveWindowState always wrote zoomFactor; without this
            # read-back the user's zoom silently reset to default on every launch — the
            # Windows mirror of the macOS shell's preferences.json zoom restore).
            "persistedState.zoomFactor",
            # v2.6.6+ hardening batch (local, ships with next release):
            # process-level safety net — without it an escaped async throw kills the
            # main process SILENTLY (app vanishes, zero diagnostics).
            "uncaughtException",
            # download-progress window runs hardened (contextIsolation:true) via this
            # preload instead of the old nodeIntegration:true renderer.
            "update-progress-preload.js",
            # PERF-R10 S1(horosa_early_nav_v1 / horosa_l3_rev_wire_v1):spawn 即导航渲染器 +
            # &rv= 掺 runtime 版本(此前壳从不发 rv ⇒ L3 陈果窗一直开着,正确性面)+ ready 注入
            # __horosaBackendConfirmed(boot 门免最后一轮探活)+ 端口重试重导航守卫。
            # 丢任一针 = 温启感知提速与陈果封窗一起静默消失。
            "horosa_early_nav_v1", "horosa_l3_rev_wire_v1",
            "HOROSA_RENDERER_EARLY_NAV", "reconcileRendererWithState", "__horosaBackendConfirmed",
            # PERF-R10 S3(horosa_bg_throttle_off_v1):后台不节流 —— 预取泵/双 rAF 打点的前提。
            "horosa_bg_throttle_off_v1", "backgroundThrottling",
            # concurrent update checks (15s bootstrap timer / 6h interval / manual menu)
            # are serialized — re-entrant calls join the in-flight check.
            "updateCheckInFlight",
            # post-v2.6.6 local batch (ships with next release):
            # auto-update download stall timeout (half-open TCP can't hang forever).
            "UPDATE_DOWNLOAD_TIMEOUT_MS",
            # GPU software-render fallback for VMs/RDP/old-GPU blank-window class:
            # persisted preference disables HW accel before ready; a GPU crash
            # relaunches once into software rendering.
            "disableHardwareAcceleration",
            "child-process-gone",
            # power suspend/resume + renderer-hang recovery.
            "powerMonitor",
            "unresponsive",
            # v3.2.1 update-visibility: post-download lifecycle phases in the progress window
            # (integrity verify / waiting-confirm / installing) + the detached install splash so
            # the silent-install minutes are never a blank screen. Reverting loses the "which
            # step is the update on" feedback the owner asked for.
            "sendDownloadPhase",
            "launchUpdateInstallSplash",
            # PERF-R7 Phase2:--prepare-runtime headless 入口必须在单实例锁之前分支(取锁会杀死
            # 用户启动或把运行中 app 弹前台 — 红队 C1)。丢 marker = 安装期预热失效或锁语义回退。
            "IS_PREPARE_RUNTIME_MODE",
            "runPrepareRuntime",
            # 装机实测抓到的真 bug:tasklist 数 Horosa.exe 会数到 prepare 自己的 Electron 子进程
            # (gpu/utility 同名)→ 永远自杀让位。修=CIM 排除自身 pid+直接子进程。丢 marker=回归。
            "ParentProcessId",
            # PERF-R7 W-2:渲染器 V8 code cache(umi.js 1.4MB 解析在暖启吃缓存)。
            "v8CacheOptions",
            # ── merged from the DUPLICATE electron/main.js dict key above(gotcha #29 再现,
            # 2026-07-05 修复):后键静默覆盖前键,下列哨兵曾整体失效。──
            # v3.3.0 身份握手:渲染器 URL 附 &sid=(与 HOROSA_LAUNCH_NONCE 同值)。
            "launchNonce",
            "'sid'",
            "ensureDefenderExclusion",
            # v3.0.1 perf ROUND-5 E-1:startRuntimeFlow 与窗口创建并行(还原=回退串行慢启)。
            "runtimeFlowPromise",
            # DELTA-V2:本地 feed 覆盖 + resources/rt 短前缀(装机 MAX_PATH 余量)。
            "HOROSA_UPDATE_FEED_URL",
            "process.resourcesPath, 'rt'",
            # PERF-R6 P-3b:渲染器提前加载(HOROSA_RENDERER_EAGER=0 回旧序)。
            "HOROSA_RENDERER_EAGER",
            "maybeEagerLoadRenderer",
            # PERF-R6 hotfix:差量旧图配对一致性(启动时清 stale current.blockmap)。
            "purgeStaleUpdaterBlockmap",
            # 全球健壮性轮(2026-07-05):渲染器网络封闭 —— 前端零外部请求(已全仓核实),
            # Chromium 直接 no-proxy-server;任何系统代理/PAC/VPN(含用户级 <-loopback>)
            # 都不可能劫持渲染器↔127.0.0.1 后端通路。kill-switch HOROSA_RENDERER_PROXY=1。
            "horosa_renderer_no_proxy_v1",
            "no-proxy-server",
            "HOROSA_RENDERER_PROXY",
            # R2(2026-07-05):备份导入护栏(64MB 上限+读取失败回 ok:false,绝不抛穿 IPC)。
            "horosa_import_guard_v1",
            # SELF-HEAL-R1 F2:更新安装闭环 —— quitAndInstall 前落盘更新意图,下次启动裁决
            # 成功(通知)/失败(可行动对话框:重下/发布页/忽略)。回退=更新中途失败重新
            # 变成"静默消失、用户零指引"(本轮唯一 P0)。
            "horosa_update_intent_v1",
            "pending-update-intent.json",
            "classifyUpdateIntent",
            "checkPendingUpdateIntent",
            "HOROSA_UPDATE_INTENT",
            # SELF-HEAL-R1 F6c:Ed25519 验签失败 → 清 updater 缓存坏件(下轮全新下载,不再
            # 每 6 小时对同一份坏字节重验重败)。
            "horosa_update_verify_purge_v1",
            "purgeFailedUpdateDownload",
            # SELF-HEAL-R1 F6d:后台更新检查健康计数(连续多日失败一次性提示;成功清零)。
            "horosa_update_check_health_v1",
            "recordUpdateCheckOutcome",
            "HOROSA_UPDATE_FAIL_NOTICE",
            # SELF-HEAL-R2 W3/W4:跨启动崩溃环断路器(壳侧三闩锁)+ 自愈事件的用户可见面
            # (每启动一条预算,慢性同类 → AV 白名单提示)+ 诊断导出附自愈档案尾。
            # 回退 = 启动崩溃环无跨启动记忆;静默自愈永远沉默,用户不知道机器在反复出问题。
            "horosa_boot_loop_breaker_v1",
            "armFirstReadyStabilityProbe",
            "firstStabilityAchievedThisLaunch",
            "bootCrashCountedThisLaunch",
            "HOROSA_BOOT_LOOP_BREAKER",
            "horosa_heal_notice_v1",
            "handleSelfHealEvent",
            "HOROSA_HEAL_NOTICE",
            "selfHealHistory",
            # SELF-HEAL-R2 W5:「更新装上了但首启就崩」的归因文案(盖过泛化熔断文案 + 完整
            # 安装包出口)。明确不做回滚(electron-updater 无原语)。
            "horosa_update_fail_attribution_v1",
            "shouldAttributeUpdateFailure",
            "post-update-first-boot",
            "HOROSA_UPDATE_FAIL_ATTRIBUTION",
            # SELF-HEAL-R3:修复屏的「下载完整安装包」真按钮(此前只有文字,用户得手打 URL)。
            # handler 不收任何参数 —— URL 是主进程常量,shell.openExternal 永不可能被喂任意串。
            "horosa_repair_screen_action_v1",
            "desktop:open-releases-page",
            # SELF-HEAL-R3:渲染器崩溃有界自动恢复(此前无人值守=死窗+活后端,须人点弹窗);
            # 顺带修既有死窗洞(启动流在飞时崩溃 → ensureMainWindowContent no-op → 永久白屏)。
            # 回退任一 = 崩溃恢复重新依赖人工。
            "horosa_renderer_auto_reload_v1",
            "handleRendererGone",
            "promptRendererReloadModal",
            "HOROSA_RENDERER_AUTO_RELOAD",
            # SELF-HEAL-R3:H-7 自动重启期间换 loading 屏(自愈可见)+ 子进程崩溃全类型留痕。
            "horosa_restart_loading_swap_v1",
            "HOROSA_RESTART_LOADING_SWAP",
            "horosa_child_gone_log_v1",
            # SELF-HEAL-R3:原生崩溃本地 minidump(不调 crashReporter.start 则 Crashpad 不落盘);
            # dump 含内存内容,仅本地、绝不上传,导出只带计数;Crashpad 不自清 → 开机 GC。
            "horosa_crash_dumps_v1",
            "uploadToServer",
            "crashDumps",
            "HOROSA_CRASH_DUMPS",

            # 桥接三针:ipc 唯一入口 / stdio 代理在单实例锁之前分派 / 退出臂;更新卡镜像
            "ipcMain.handle('desktop:tauri-invoke'", "mcpStdio.stdioFlagEndpoint(process.argv)", "desktopBridge.stopOnExit()",
            "desktopBridge = createDesktopBridge();", "function mapUpdateStateToPageEvent(", "async function startUpdateDownload(info)",
            # v3.11.0 真机冒烟两课:①Electron 主进程在 Windows GUI 子系统下 stdin 管道不可用 ⇒ stdio 代理必须以 ELECTRON_RUN_AS_NODE=1 复生自身
            #(从 app.asar.unpacked 取脚本);②真正的退出路径是 requestApplicationShutdown 的 finally→app.exit,will-quit 未必到 ⇒ 端点文件同步删
            "ELECTRON_RUN_AS_NODE: '1'", "'app.asar.unpacked$1'", "desktopBridge.removeMcpEndpointFileSync();",
        ],
        # v3.2.1 update-visibility: the detached PowerShell WPF "installing update" splash that
        # survives the NSIS taskkill of Horosa.exe and self-closes on relaunch. Pure best-effort,
        # fail-open, HOROSA_UPDATE_SPLASH=0 kill-switch.
        os.path.join(BUNDLE, "electron/update-splash.js"): [
            "launchUpdateInstallSplash",
            "horosa-update-splash-v1",
            "HOROSA_UPDATE_SPLASH",
            # SELF-HEAL-R1 F2c:超时不再静默消失 —— app 未重现则换双语失败指引 + 关闭按钮,
            # 继续监视(晚到的重启仍自动关)。回退=更新失败画面凭空消失(P0 的一半)。
            "horosa_update_splash_escalation_v1",
            "更新可能未完成",
        ],
        # SELF-HEAL-R1:更新流决策纯函数(意图裁决 + 检查健康计数;node --test 全覆盖)。
        os.path.join(BUNDLE, "electron/update-flow.js"): [
            "classifyUpdateIntent",
            "reduceUpdateCheckHealth",
            "shouldNotifyUpdateCheckFailure",
            # SELF-HEAL-R2 W5:更新后首启失败的归因谓词(纯函数)。
            "horosa_update_fail_attribution_v1",
            "shouldAttributeUpdateFailure",
        ],
        # P0-1 (v2.5.4): Ed25519 update-signature verifier (pure node crypto, shared by main.js +
        # scripts/sign-update.cjs). Must keep the verify primitive + the embedded public key.
        os.path.join(BUNDLE, "electron/update-signature.js"): [
            "verifyUpdateSignature",
            "crypto.verify",
            "UPDATE_PUBLIC_KEY_PEM",
            "ed25519",
        ],
        os.path.join(BUNDLE, "scripts/sign-update.cjs"): [
            "sign-release",
            "createPrivateKey",
        ],
        # The download-progress window's UI (loaded from this file). The IPC channel
        # names must match what main.js sends — if either side drifts, progress stops
        # displaying. Sentinel the unique channel strings.
        # SELF-HEAL-R3:修复屏本体。R2 把 releasesUrl/failureKind 广播到这里却无人渲染(「下载完整
        # 安装包」只是文字);这些哨兵守住那枚真按钮 + 'restarting' 状态映射(H-7 换屏后要有步进)。
        os.path.join(BUNDLE, "electron/loading.html"): [
            "horosa_repair_screen_action_v1",
            "downloadFull",
            "openReleasesPage",
            "failureKind",
            "releasesUrl",
            "'restarting'",
            # PERF-R11 T3b horosa_loading_ux_v2:实时钟(100ms)/真 <progress> 条(结构化 progress
            # 字段)/阶段时间线/「以往通常约」/ready 定格「本次启动 X 秒」/Defender 提示行。
            # kill:HOROSA_LOADING_UX=0(壳侧不发结构字段,页面自动退化为今日纯文本)。
            # e2e_loading_screen.cjs 31 断言全绿是本族的行为金标(7b 组=授权卡)。
            "horosa_loading_ux_v2", "progressWrap", "progressBar", "defenderHint",
            "phaseline", "本次启动",
            # horosa_defender_autoprompt_v1:提示行升级为可点授权卡(点击即同意 → 直通提权;
            # 成功转绿确认并跨受税段保留;pending 也入列)。e2e 7b 组断言是行为金标。
            "horosa_defender_autoprompt_v1", "defenderFix", "defenderAuthorize", "免检已生效",
            # PERF-R12 W0b horosa_defender_elev_verdict_v1:失败文案三分(真取消/策略拒绝/未知),
            # 不再把「策略拒绝」按「用户取消」猜。丢针 = 误导性文案回潮。
            "elevError", "已取消管理员确认", "阻止了提权",
        ],
        os.path.join(BUNDLE, "electron/preload.js"): [
            "horosa_repair_screen_action_v1",
            "openReleasesPage",
            "desktop:open-releases-page",
            # horosa_defender_autoprompt_v1:授权按钮的桥(零参数,渲染器无法喂路径/命令面)。
            "defenderAuthorize", "desktop:defender-authorize",
            # v3.9.2 双保险副本桥。
            "shadowStoreWrite", "shadowStoreReadAll",

            "contextBridge.exposeInMainWorld('__TAURI_INTERNALS__'", "ipcRenderer.invoke('desktop:tauri-invoke'",
        ],
        os.path.join(BUNDLE, "electron/update-progress.html"): [
            "update:init",
            "update:progress",
            "update:done",
            # v3.2.1 update-visibility: the post-download phase channel + its indeterminate sweep.
            "update:phase",
            # v3.2.2 可视化对齐:下载 ETA(约剩 N 分 N 秒,由 transferred/total/speed 纯推导,
            # 字段缺失静默退回旧样式)。丢 marker = 可视化回退。
            "约剩",
        ],
        # v2.6.6+ hardening: the progress window's contextBridge preload — the page no
        # longer has a Node-enabled context; these markers pin the bridge + channels.
        os.path.join(BUNDLE, "electron/update-progress-preload.js"): [
            "contextBridge",
            "horosaUpdateProgress",
            "update:progress",
            "update:phase",
        ],
        # Win issue #18 (升级安装从来都没有成功过，只能卸载后再装): the NSIS installer must
        # FORCE-terminate a running Horosa before the upgrade's uninstall-old/extract step.
        # electron-builder's default _CHECK_APP_RUNNING relies on a polite WM_CLOSE (which
        # main.js vetoes via event.preventDefault for async shutdown) + a $INSTDIR-path /
        # USERNAME-filtered taskkill (breaks on the Chinese "星阙" path) -> "无法关闭" ->
        # "Failed to uninstall old application files: 2". We override customCheckAppRunning
        # to (1) taskkill /F /IM Horosa.exe (image-direct, no /T, no path filter) and
        # (2) Stop-Process ONLY the embedded sidecars under the unique embedded-runtime dir.
        # Reverting any of these re-opens the "upgrade never succeeds" bug.
        #
        # #18 round 2: a reboot proves no process is alive yet the upgrade STILL fails with
        # "...files: 2" — that 2 is the OLD (pre-2.6.0, on-disk) uninstaller's exit code, which an
        # in-place upgrade is forced to run; app-builder-lib's handleUninstallResult then does
        # SetErrorLevel 2; Quit. customCheckAppRunning hardens only the NEW installer, never the OLD
        # uninstaller. The fix is customUnInstallCheck: it is inserted INSTEAD of that fatal default,
        # force-cleans the stale program dir ourselves, and continues the upgrade. Reverting it
        # re-opens "upgrade never succeeds even after reboot / on a Chinese Windows username".
        os.path.join(BUNDLE, "assets/installer.nsh"): [
            "customCheckAppRunning",
            'taskkill.exe" /F /IM',
            "embedded-runtime",
            "customUnInstallCheck",
            "horosa_unchk_clean",
            # v2.6.6+ hardening (local batch, ships with next release):
            # disk-space preflight — low-disk installs/first-boots used to fail midway
            # with a cryptic "服务未就绪" instead of the real cause.
            "CheckHorosaDiskSpace",
            # Windows 10+ gate — Electron 35 doesn't run below Win10; older systems
            # used to install fine then crash black on first launch.
            "AtLeastWin10",
            # TRUE-uninstall-only cache cleanup. The ${ifNot} ${isUpdated} guard is
            # load-bearing: without it every auto-update would delete the 1.35GB
            # runtime cache. (The pre-2.6.6 customUnInstall was dead code — defined
            # inside !ifndef BUILD_UNINSTALLER which the uninstaller pass never sees.)
            "${ifNot} ${isUpdated}",
            "HorosaDesktop\\embedded-runtime",
            # ROUND-3 Defender exclusion (merged here from a DUPLICATE dict key that was silently
            # overriding these needles — gotcha #29).
            "Add-MpPreference", "horosa-defender-excluded",
            # PERF-R6 hotfix:播种 installer.exe 的同时必须重置差量旧图缓存(current.blockmap +
            # pending)—— 陈旧旧图把 22MB 差量炸成 575MB 假计划 + sha 失配回退全量(实测)。
            "horosa-desktop-bundle-updater\\current.blockmap",
            # v3.2.1 install-visibility:details 默认展开(customHeader,覆盖模板 nevershow)+
            # customInstall 分阶段中文横幅。owner 报「进度条不够详细,不知道装到哪一步」。
            "horosa_show_details_v1",
            "horosa_install_banner_v1",
            # PERF-R7 Phase2:全新安装尾部以登录用户身份拉起后台预热(仅 ${ifNot} ${isUpdated};
            # 更新路径必然竞态故排除)。丢 marker = 首开回到 25-35s+阶梯期。
            "horosa_install_prepare_v1",
            "StdUtils.ExecShellAsUser",
            # PERF-R12 W0a①(v3.7.0 覆盖修):更新分支也拉 prepare,但强制 `--p2-only` —— P1 永远
            # 归重启的 app(决定性防 P1 竞态),prepare 只在阶梯锁下建 uber/static/pyc,活过用户
            # 快开快关。丢针 = 每次更新全体用户重熬 5-10 个 ~6s 温启段。
            "horosa_update_prepare_slot_v1", "--prepare-runtime --p2-only",
            # 全球安装健壮性轮(2026-07-05):危险安装目录+超长路径统一硬门(修复/替换/静默升级
            # 走一次性软模式,绝不 strand 既有用户)、ARM64 分流(Win10-ARM 硬拦/Win11-ARM 提示)、
            # 阻断类文案双语、locale 无关实现(StrCmp 天然大小写不敏感,不解析本地化命令输出)。
            "horosa_instdir_guard_v1",
            "HorosaGuardInstallDir",
            "HOROSA_INSTDIR_MAX_LEN",
            "horosa_maxpath_gate_v1",
            "horosa_arm64_gate_v1",
            "IsNativeARM64",
            "horosa_locale_agnostic_install_v1",
            # R2(2026-07-05):降级明确同意门(1638/ALLOWDOWNGRADE)、卸载清理 Defender 排除项、
            # 低内存非阻断提示。
            "horosa_downgrade_gate_v1",
            "HorosaCheckDowngrade",
            "/ALLOWDOWNGRADE",
            "horosa_defender_exclusion_cleanup_v1",
            "Remove-MpPreference",
            "horosa_low_ram_advisory_v1",
            # SELF-HEAL-R1 F6e/f/g/h:PS 单引号串撇号转义宏(O'Brien 类路径不再截断命令)、
            # 默认目录 Defender 排除残留清理、UNC 非阻断提示(#54 欠账)、TEMP 过长非阻断提示。
            "horosa_ps_quote_safe_v1",
            "HorosaPsQuoteDouble",
            "horosa_defender_pre_excl_cleanup_v1",
            "HorosaPreExclusionDir",
            "horosa_unc_advisory_v1",
            "horosa_temp_len_advisory_v1",
            # SELF-HEAL-R3:${DriveSpace} 测不出卷时磁盘门此前【静默放行】(subst/UNC/异常 FS/
            # 部分 USB)——补非阻断提示。★软模式副本必须在 HorosaGuardInstallDir 消费该一次性
            # Var 之前捕获,否则维护流会被误判为全新安装而弹窗。回退 = 怪盘静默绕过整道门。
            "horosa_diskgate_unmeasurable_advisory_v1",
            "HorosaAdviseUnmeasurableVolume",
            "HorosaVolAdvisorySoft",
            "HorosaVolAdvised",
            # issue #44(未签名 exe 被安全软件 SmartScreen/360/火绒/电脑管家 拦截隔离,更新/重装
            # v3.4.0 后无法启动、快捷方式「参数错误」)三层加固:①安装后清主程序 MOTW/Zone.Identifier
            # 消除 SmartScreen 拦截线;②预热 ExecShell 前 SetErrorMode 抑制「无法访问文件」系统模态框
            # (被拦不再弹框打断安装);③安装收尾自检 Horosa.exe 被隔离/锁定时给「加入信任」明确指引。
            # 丢 marker=回退到用户对着神秘报错一头雾水 + 预热失败弹框阻塞安装。
            "horosa_clear_motw_v1",
            "horosa_warmup_no_errorbox_v1",
            "horosa_exe_quarantine_guard_v1",
        ],
        # PERF-R7 I-1 安装提速:构建期受控补丁脚本本体(版本钉 + 精确锚 + 幂等)。
        os.path.join(BUNDLE, "scripts/patch-nsis-template.cjs"): [
            "horosa_movefirst_v1",
            "EXPECTED_ABL_VERSION",
            "HorosaMoveLoop",
        ],
        # v2.2.1 Issue #8 AI-streaming double-fix (Mac handoff requests the same grep sentinel on Windows):
        # catch MUST log the primary exception first (QueueLog.error), and all 3 stream paths MUST keep-alive
        # heartbeat so a slow local model (Ollama long first-token) isn't cut off by an idle-timeout disconnect.
        # v2.5.2 Windows issue #15: Ollama must use its NATIVE /api/chat + /api/embed endpoints (the OpenAI-compatible
        # /v1/... endpoints silently ignore num_ctx -> default 4096 truncation of long astrology context). The native
        # path puts num_ctx/num_predict/top_k/top_p/repeat_penalty under options:{} so Ollama actually honours them.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/service/AIAnalysisProxyService.java"): ["max_completion_tokens", "isOpenAIReasoningModel", "authHeaderName", "isEmbeddingModel", "keep-alive", "QueueLog.error(AppLoggers.ErrorLogger", "ProxySelector", "SseChannel", "streamOllamaNative", "embeddingsOllamaNative", "extractOllamaEmbedVectors", "ollamaNativeBase"],
        # v2.5.1 Windows issue #14: loopback (127.0.0.1 chart service) must NEVER be tunnelled through the system
        # proxy — doCmd skips the proxy for loopback targets (isLoopbackTarget) while external AI hosts keep it (#9).
        # See windows-adaptations/patches/boundless__HttpUriRequestHystrixCommand.java.patch (BACKEND -> jar rebuild).
        os.path.join(SRV, "boundless/src/main/java/boundless/net/http/HttpUriRequestHystrixCommand.java"): ["redactSensitiveHeaders", "stripQuery", "isLoopbackTarget"],
        os.path.join(UI, "src/services/aianalysis.js"): ["resolveRequestTimeout"],
        # v2.2.1 global day-boundary: the late-zi-hour 时柱 second switch field must stay wired through the model.
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/model/BaZi.java"): ["clockTime", "solarTime", "lateZiHourUseNextDay"],
        # v3.7.3 上游:紫微天才落宫双端同改的 **Java 侧**(镜像上游 [195]⑦)。
        # 与 astrostudyui/src/components/ziwei/ZiweiCalc.js 是**一对**,只改一侧 = 前后端分叉。
        # 🔴 本轮 RUNTIME_VERSION 也 bump(3.7.3-runtime1)⇒ 必 `mvn clean install`(#83):
        #    ChartController 以编译期常量内联引用 RuntimeWire,消费方源码没变时增量编译会跳过重编,
        #    jar 里会出现「RuntimeWire 新、ChartController 旧」的半态。锁步门读发货 class 会拦下。
        os.path.join(SRV, "astrostudycn/src/main/java/spacex/astrostudycn/model/ZiWeiChart.java"): [
            "int caiIdx = (this.lifeHouseIndex + yearziIdx0 + 24) % 12;",
        ],
        # v2.1.6 qimen 历法 fix (issue #4): month-pillar 交节 boundary + 置闰超神接气 ju-determination
        # in the vendored Python engine. Reverting these re-opens the calendar defect.
        # ⚠️ 这三个键**已经存在**,PERF-R9 的新钉必须**并入**这里,绝不能另开同名键(gotcha #29)。
        os.path.join(WS, "vendor/kinqimen/jieqi.py"): [
            "def zhirun_jieqi",
            # PERF-R9 ①:六十甲子提模块常量(原每请求重建 4,712 次)。
            "horosa_qimen_jiazi_const_v1", "_JIAZI_CONST",
            # [#109,v3.11.2] PY-18 请求级 memo 已上游化,开关随之成为上游资产 —— 仍钉住(owner:Mac 优化不许遗漏;
            # 同时满足总账 P2「写到名字的开关必须真在代码/哨兵里」)。
            "HOROSA_QIMEN_REQ_MEMO", "_REQ_MEMO_ON",
            # PERF-R10 B1:请求级 memo(机制宿主;模块尾重绑定)。丢针=同参跨函数重复全回来。
            "horosa_qimen_req_memo_v1", "begin_request_memo", "_req_memo",
        ],
        os.path.join(WS, "vendor/kinqimen/config.py"): [
            "def dingju_jieqi", "zhirun_jieqi",
            # PERF-R9 ②③:同参重复调用收敛 + 七处四路定局改惰性。
            # ★ _select_ju 刻意不给 .get 默认值 —— 保住 option 越界时的 ResultCode -1 语义。
            "horosa_qimen_cse_v1", "horosa_qimen_lazyju_v1", "def _select_ju",
            # PERF-R10 B1:尾部重绑定块(zhifu_n_zhishi 等 20 函数;pan_sky_minute 永不入的警示同在)。
            "horosa_qimen_req_memo_v1", "_memo_host._req_memo",
        ],
        # —— PERF-R10 B1:websrv 挂钩(设完两个日界开关之后 begin;_qm_jieqi 预初始化 None)——
        os.path.join(PY_SRC, "websrv/webqimensrv.py"): [
            "horosa_qimen_req_memo_v1", "begin_request_memo",
        ],
        # —— PERF-R10 B2:kin 常量 copy-return 全族(HOROSA_KIN_JIAZI_CONST 一把闸)——
        # 丢任一针 = 对应引擎悄悄回到「每请求重建六十甲子/分钟表」;八文件同 marker。
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/jieqi.py"): [
            "horosa_kin_jiazi_const_v1", "_JIAZI_CONST", "HOROSA_KIN_JIAZI_CONST",
            # v3.7.3 上游(镜像上游 [195]①/①'):distancejq 两修,缺一即静默错值或整服务 500。
            # ① 取【当前】节气起点(旧式 find_jq_date(year-1,...) 取到去年同名节气 ⇒ 所求节气在
            #    当日或之后时整整多 365 天;唯一调用方 starhouse 再环绕 ⇒ 二十八宿值日系统性错位);
            # ② now 必须走 ephem.Date —— datetime 只支持公元 1..9999,而本函数经 starhouse 服务于
            #    太乙**全年份域**;上游首版误用 datetime 直接 ValueError 炸掉整个 taiyi/pan
            #    (Windows 侧 kentang 极端年矩阵 BC12998/BC12026/AD16798 三例会当场转红)。
            "get_jieqi_start_date(year, month, day, hour, minute)",
            "now = Date(",
        ],
        # kintaiyi/config 与 kinwuzhao/jieqi 的针已并入下方 v2.1.8 既有键(gotcha #29,勿在此重建)。
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/kinliuren.py"): [
            "horosa_kin_jiazi_const_v1", "_JIAZI_BY_GZ",
        ],
        os.path.join(WS, "vendor/kinwuzhao/config.py"): [
            "horosa_kin_jiazi_const_v1", "_MINUTES_JIAZI_CACHE",
        ],
        os.path.join(WS, "vendor/shenyishu/shenyishu.py"): [
            "horosa_kin_jiazi_const_v1", "_JIAZI_CONST",
        ],
        os.path.join(WS, "vendor/kinjinkou/kinjinkou/jinkoujue/jinkoujue_api.py"): [
            # 注释同时警示:平铺 vendor/kinjinkou/jieqi.py 是 streamlit 死代码,勿在那边重复。
            "horosa_kin_jiazi_const_v1", "_JIAZI_CONST",
        ],
        os.path.join(WS, "vendor/kinastro/astro/fendjing/fendjing_calculator.py"): [
            "horosa_kin_jiazi_const_v1", "_jiazi_seq",
        ],
        # —— PERF-R10 B6:webpredictsrv fastjson shim(45 调用点全受益;/predict/zr 最大)——
        # [#109 收敛,v3.11.2] 上游单源化(websrv/fastjson.py),我方补丁退役;哨兵迁钉上游接线。
        os.path.join(PY_SRC, "websrv/webpredictsrv.py"): [
            "from websrv.fastjson import install as _install_fast_json", "HOROSA_FAST_JSON_ENCODE",
        ],
        # —— PERF-R10 Ship4:Java 双项(class 内属性串 = 编译哨兵,gotcha #45)——
        # AstroHelper 的针已并入下方 ACG 既有键(gotcha #29);CacheHelper 是全新键。
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/helper/CacheHelper.java"): [
            "horosa_cachehelper_needcache_sysprop_v1", "cachehelper.needcache", "resolveBoolFlag",
        ],
        os.path.join(WS, "vendor/kinqimen/kinqimen.py"): [
            "config.dingju_jieqi",
            # PERF-R9 ④:Qimen 实例级 memo(实例==请求),消 overall() 对 pan() 的重复求值。
            "horosa_qimen_pan_memo_v1", "_instance_memo", "HOROSA_QIMEN_PAN_MEMO",
        ],
        # v2.1.6 India chart map-pick fix (issue #3): flat changeGeo patch matching parent changeCond.
        # ⚠️ 本键**已存在**(v2.1.6 地图取点修复的正确性 needle);PERF-R9 Ship 7 的技法步进
        # 预取登记必须**并入这里**,绝不另开同名键(gotcha #29)。它同时是 apply.sh §31b 的 guard 串。
        os.path.join(UI, "src/components/astro/IndiaChartMain.js"): [
            # [#103] R4 成对:apply.sh 守卫换代后新守卫入针(#95 规则)。
            "horosa_india_settings_memo_v1",
            "patch.tm",
            "horosa_prefetch_registry_v1", "registerStepPrefetcher('indiachart'",
        ],
        # v2.1.7 qimen/sanshi true-solar-time fix: fetchQimenPan must run the time-basis correction
        # (resolveCalcDateTime) so 真太阳时 casts at the corrected time, not raw clock time.
        # ⚠️ 本键**已存在**(v2.1.7 真太阳时修复的正确性 needle);PERF-R9 的结果缓存 marker 必须
        # **并入这里**,绝不另开同名键(gotcha #29)。它同时是 apply.sh §30 的 guard 串。
        os.path.join(UI, "src/components/dunjia/DunJiaCalc.js"): [
            "resolveCalcDateTime(baseDt",
            "horosa_kentang_result_cache_v1",
        ],
        # v2.1.8 issue #6 (local Ollama stops mid-generation): the 120s AI-streaming hard cap
        # must stay removed (SseEmitter(0L)); + Predictive/perchart pdYears passthrough.
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/interceptor/SseHelper.java"): ["new SseEmitter(0L)"],
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java"): ["pdYears", "agepoint"],
        # perchart.py 的 pdYears 已上移合并进本文件唯一的 perchart.py 条目(PY_SRC 写法)。
        # 此处**不得**再写同名 key —— 它与上面那条只差路径分隔符写法,是个随时会引爆的哑雷。
        # v2.1.8 bazi month-pillar 交节 boundary across the other kentang engines (same class as 2.1.6 kinqimen).
        # ⚠️ 两键**已存在**(v2.1.8 交节 boundary needle);PERF-R10 B2 的 kin 常量针**并入这里**
        # (gotcha #29 —— 本轮 AST 门第一时间抓到第 4 次同类,merge 而非另开键)。
        os.path.join(WS, "vendor/kinwuzhao/jieqi.py"): ["getJieQiJD", "horosa_kin_jiazi_const_v1", "_KE_JIAZI_CACHE"],
        os.path.join(WS, "vendor/kinastro/astro/bazi/calculator.py"): ["MONTH_JIE_INDICES"],
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/config.py"): [
            "getJieQiJD", "horosa_kin_jiazi_const_v1", "_JIAZI_ACCUM_D",
            # v3.7.3 上游(镜像上游 [195]②③④⑤):starhouse 二十八宿值日四修。
            # ② 虛宿距度 25→10(汉书作 10、授时作 9,两独立史源皆远小于 25;全表 378→363);
            # ③ 环长按表长取模(旧写死 360,与表长 363 不符即静默混叠);
            # ④ 三处节气锚点(夏至 井1→井12、大雪 箕24→箕4、霜降/立冬 房氐→氐房)——
            #    判据是「24 步须等分周天、每步 13~17 度」,不依赖历元,故最可靠;
            # ⑤ 锚点缺失硬报错(旧路静默取首宿 = 把「节气名对不上」伪装成一个像样的宿名交出去)。
            "numlist = [13, 9, 16, 5, 5, 17, 10, 24, 7, 11, 10, 18,",
            "zhoutian = len(gensulist)",
            '["井", 12]',
            '["箕",4]',
            '["氐", 2],["房",1]',
            "starhouse: 节气",
        ],
        # ---------------- v2.3.0 sync (Mac e712784..a649287) ----------------
        # #9 AI system-proxy fix has THREE legs (all required; the launcher flag alone is inert):
        #   (1) boundless HttpClientUtility ProxySelector.getDefault() fallback (here),
        #   (2) streaming AIAnalysisProxyService .proxy(ProxySelector.getDefault()) (guarded above),
        #   (3) launcher -Djava.net.useSystemProxies=true (service-manager.js, guarded above).
        os.path.join(SRV, "boundless/src/main/java/boundless/net/http/HttpClientUtility.java"): ["ProxySelector"],
        # v2.3.1 issue #10 (服务不稳定): SSE streaming stability has TWO legs.
        # (A) AIAnalysisProxyService routes all emitter writes through a thread-safe `SseChannel`
        #     (guarded in the AIAnalysisProxyService needles above) so the keep-alive heartbeat thread
        #     and the read loop can't race a non-thread-safe SseEmitter into "already completed".
        # (B) RequestHeaderInterceptor must reset the SSE flag per request (setSSE(false)) and skip
        #     body-decode + signature re-check on a non-REQUEST (async) dispatch (DispatcherType.REQUEST).
        #     Else a prior AI stream's SSE flag leaks onto a pooled request object -> a later chart /
        #     predict / AI request is mishandled as SSE -> intermittent signature.error / "not ready".
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/interceptor/RequestHeaderInterceptor.java"): ["DispatcherType.REQUEST", "setSSE(false)"],
        # 占星地图 ACG: analytic RA/Dec rewrite (parans + click landing-point report) + the new
        # /location/acgpoint endpoint (controller + helper getAcgPoint w/ requestNoCache) + the D3 map FE.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/AcgController.java"): ["acgpoint", "clickLat"],
        # ⚠️ 本键**已存在**(ACG needles);PERF-R10 B7 的内层缓存跳过针**并入这里**(gotcha #29)。
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java"): [
            "getAcgPoint", "requestNoCache", "getAstroExtraGreatConj", "getAgePoint", "getDistribution",
            "horosa_astrohelper_skip_inner_v1", "astrohelper.skip.inner.cached.paths", "outerWrappedPaths",
        ],
        os.path.join(WS, "astropy/astrostudy/acg/ACGraph.py"): ["def pointReport", "_parans"],
        os.path.join(UI, "src/components/acg/AstroAcg.js"): [
            "AcgD3Map", "/location/acgpoint", "horosa_panel_ready_v1", "markPanelReady("
        ],
        # 六壬 / 三式合一 发三传: 八专 must be evaluated AFTER 遥克 (classics' 九法 order). The guard
        # comment documents why; reverting it reopens mis-classifying "八专结构 + 遥克" as 八专课.
        # v3.6.0 收敛注:六壬九法判定序修复(Windows #46)已被上游吸收并改写注释(措辞由
        # 「遥克必须在八专之前」勘正为「八专必须在遥克之前」+ 课经引文)。针迁上游措辞;
        # 语义不变量 = 八专先于遥克判定,丢针 = 该序修复被再次覆盖。
        os.path.join(UI, "src/components/liureng/ChuangChart.js"): ["必须在遥克之前"],
        # 卜卦盘 + 择日盘 (new auxiliary charts): case-type registration + sub-charts wired into AuxChart
        # with componentDidUpdate so applyCase can switch to the right sub-tab (else event-chart restore breaks).
        os.path.join(UI, "src/utils/localcases.js"): ["value: 'horary'", "value: 'election'"],
        # ⚠️ 本键**已存在**(卜卦/择日子盘接线);PERF-R9 Ship 7 的技法步进预取登记**并入这里**
        # (gotcha #29)。它同时是 apply.sh §31b 的 guard 串。
        os.path.join(UI, "src/components/auxchart/AuxChartMain.js"): [
            # [#103] R4 成对:apply.sh 守卫换代后新守卫入针(#95 规则)。
            "horosa_freeze_subtabs_v1",
            "HoraryMain", "ElectionMain", "componentDidUpdate",
            "horosa_prefetch_registry_v1", "registerStepPrefetcher('auxchart'",
        ],
        # ---------------- v2.4.0 sync (Mac fa6d9f3..d8fe575): western 6-technique full-AI + orbs persistence ----------------
        # Six Western techniques (dodecatemoria / dispositor / lifespan / distributions / age-point / mundane)
        # wired end-to-end into AI: AI-mount snapshot + AI-export registers + event-chart storage. New backend
        # routes (rebuilt jar): /predict/dist + /predict/agepoint (PredictiveController, guarded above),
        # /astroextra/greatconj + /astroextra/draconic (AstroExtraController + AstroHelper getters, above),
        # and orbs/orbScale passthrough in the astrostudycn ChartController whitelist. Reverting any of these
        # silently drops a shipped Western technique or the orb-tolerance persistence.
        os.path.join(SRV, "astrostudy/src/main/java/spacex/astrostudy/controller/AstroExtraController.java"): ["greatconj", "getGreatConjParams"],
        # orbs/orbScale 的 ChartController 哨兵已上移合并进本文件唯一的 ChartController.java 条目。
        # 此处**不得**再写同名 key(gotcha #29)。
        # orbs/orbScale persist with the chart (mirrors the after23NewDay 5-point passthrough); zero-regression default.
        os.path.join(UI, "src/utils/localcharts.js"): [
            "orbs",
            # PERF-R12 W3f-A3 配套:命盘库写版本号。v3.9.2 上游把写盘口收编进 localRecordStore
            # 内核 ⇒ 计数迁入内核 getWriteVersion(),shim 只转发(旧针 chartsWriteVersion 随迁退役)。
            # 断供 = 打开量化盘即「localChartsVersion is not a function」(#84 族,收敛时实发)。
            "horosa_aux_render_slice_v1", "localChartsVersion", "store.getWriteVersion",
        ],
        # v3.9.2:写版本号的内核端(writeRaw 是 upsert/remove/setPin/move/trash/import 唯一写口,
        # 先自增再落盘,含内存回退写)。与 localcharts shim 成对,缺一即量化盘 rings 签名断链。
        os.path.join(UI, "src/utils/localRecordStore.js"): [
            "horosa_aux_render_slice_v1", "getWriteVersion", "writeVersion += 1",
        ],
        # The six Western techniques' AI-export six-register audit matrix (AI-mount != AI-export are two systems).
        os.path.join(UI, "src/utils/aiExport.js"): ["getAIExportAuditMatrix"],
        os.path.join(UI, "src/components/mundane/MundaneMain.js"): [
            "MundaneMain", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        # ==== PERF-R9 鏂板瑕嗙洊(姣忔潯鐨?needle 閮藉惈 apply.sh 鐨?guard 涓?婊¤冻浜ゅ弶鏍稿闂?R4)====
        # marker: horosa_kentang_result_cache_v1
        os.path.join(UI, "src/components/calendar/HuangLiMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_panel_ready_v1", "horosa_panel_scu_v1", "markPanelReady(", "shouldComponentUpdate"
        ],
        # v3.6.0 收敛注:地占大改版(八派/八式/五页签)整体重写 —— v3.5.1 时代的
        # FreezeSubTab/markPanelReady 观测针随旧结构消亡(P5 义务由 cnyibu 顶层键承担,
        # 不受影响);缓存线由上游 cachedKentangFetch 原生承载(随机起卦保护在
        # kentangCache policy + stepPrefetch FORBIDDEN 双闸,另有条目钉)。
        # 观测缺口(panel-ready/冻结未接新结构)已入 PERF_INVENTORY 缺口表,下轮补接。
        os.path.join(UI, "src/components/geomancy/GeomancyMain.js"): [
            "cachedKentangFetch",
        ],
        os.path.join(UI, "src/components/jingjue/JingJueMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/jinkou/JinKouCalc.js"): ["horosa_kentang_result_cache_v1"],
        os.path.join(UI, "src/components/jinkou/JinKouMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/kinastro/KinAstroMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_freeze_subtabs_v1", "horosa_kinastro_center_memo_v1", "horosa_kinastro_render_memo_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            # PERF-R10 Ship1:归属键契约 —— 打点参数必须是 moduleKey(页签键),serviceKey 会被
            # perfMark 归属校验静默丢弃(shusuan/mingother 验收恒零样本的根因)。P5 门的动态映射
            # (CONTRACT_EXEMPTIONS p5-observation 层)也钉着同一形状。
            # v3.6.0:上游引入宿主嵌用(hostModuleKey)—— 归属键升级为 hostModuleKey||moduleKey
            # (嵌用时 currentTab=宿主键;perfMark 契约测试同步钉新形并禁旧单键形)。
            "horosa_panel_ready_attribution_key_v1", "markPanelReady(this.props.hostModuleKey || this.config.moduleKey)",
            # PERF-R10 Ship2(P6):登记键随换轨迁移(mingother↔yanqin),否则新键查不到预取器。
            "_syncStepPrefetcher",
            # PERF-R12 W2.5:裸 React.lazy → 自愈工厂(空模块坏结果不进缓存;v3.6.0 同类根)。
            "horosa_lazy_healing_wrap_v1", "makeHealingFactory",
        ],
        # PERF-R9 Ship 7 并入:/liureng/gods 的 prewarmRequests 并行发起 + 步进预取登记。
        # guard 串已按 gotcha #48 换成最新的 horosa_prefetch_registry_v1。
        os.path.join(UI, "src/components/lrzhan/LiuRengMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_prefetch_registry_v1", "prewarmRequests", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            # PERF-R12 W3e:L1 模块级选项常量 / L2 右栏 builder 进 thunk / L3 输入面板抽件 sCU /
            # L4 runyear∥birthGanZi 并行(外层 gods→runYear 是真数据依赖,保持串行 —— 注释即契约)。
            "horosa_liureng_render_slice_v1", "WUXING_OPTION_DOMS", "LiuRengInputPanel",
            # v3.11.0 覆盖补丁(issue #83,gotcha #105):上游「时间算法」控件落在我方切片子组件里必须走 props 形
            # (子组件 this.state 恒 null);主类把 timeAlg 状态与处理器透传给子组件。四针成对:子组件读 p.* / 主类传 this.*。
            "value={p.timeAlg}", "onChange={p.onTimeAlgChange}", "timeAlg={this.state.timeAlg}", "onTimeAlgChange={this.onTimeAlgChange}",
        ],
        os.path.join(UI, "src/components/shenyishu/ShenYiShuMain.js"): [
            "cachedKentangFetch", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            "getStepPrefetchTasks",
        ],
        os.path.join(UI, "src/components/taixuan/TaiXuanMain.js"): [
            "cachedKentangFetch", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            "getStepPrefetchTasks",
        ],
        os.path.join(UI, "src/components/taiyi/TaiYiCalc.js"): ["horosa_kentang_result_cache_v1"],
        os.path.join(UI, "src/components/wuzhao/WuZhaoMain.js"): [
            "horosa_kentang_result_cache_v1", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/services/xuanshi.js"): [
            "horosa_kentang_result_cache_v1", "horosa_xuanshi_longtext_ondemand_v1"
        ],
        # marker: horosa_stable_react_keys_v1
        # [#109 收敛,v3.11.2] 下列 11 个文件的随机 key 由上游 stableKeysRatchet(`s<N>-${i}` 形)全部转完,
        # 我方 perfR9 补丁退役 → 钉上游稳定键存在性(与 CaseList/ChartList 同法);其余 26 个文件上游只转了
        # 一部分,我方补丁按站点续转(仓库级 no-random-React-keys 门要求 0 残留,严于上游棘轮的 ≤85)。
        os.path.join(UI, "src/components/astro/AstroAspect.js"): ["key={`s"],
        os.path.join(UI, "src/components/astro/AstroFirdaria.js"): [
            "horosa_stable_react_keys_v1", "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroGivenYear.js"): [
            "horosa_stable_react_keys_v1", "horosa_aspect_dom_memo_v1", "horosa_freeze_subtabs_v1", "horosa_no_mutate_chart_params_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroInfo.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/astro/AstroLunarReturn.js"): [
            "horosa_stable_react_keys_v1", "horosa_aspect_dom_memo_v1", "horosa_freeze_subtabs_v1", "horosa_no_mutate_chart_params_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroProfection.js"): [
            "horosa_stable_react_keys_v1", "horosa_aspect_dom_memo_v1", "horosa_no_mutate_chart_params_v1", "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroSolarArc.js"): [
            "horosa_stable_react_keys_v1", "horosa_aspect_dom_memo_v1", "horosa_no_mutate_chart_params_v1", "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroSolarReturn.js"): [
            "horosa_stable_react_keys_v1", "horosa_aspect_dom_memo_v1", "horosa_freeze_subtabs_v1", "horosa_no_mutate_chart_params_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroYearSystem129.js"): [
            "horosa_stable_react_keys_v1", "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/cntradition/GanHeCong.js"): ["key={`s"],
        os.path.join(UI, "src/components/cntradition/Gods.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/MDSYear.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/MainDirection.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/MainDirectionSimple.js"): ["key={`s"],
        os.path.join(UI, "src/components/cntradition/PaiBaZi.js"): [
            "horosa_stable_react_keys_v1", "horosa_bazi_deadwork_v1"
        ],
        os.path.join(UI, "src/components/cntradition/SmallDirection.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/Zhu.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/ZhuMing12.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/cntradition/ZiHeCong.js"): ["key={`s"],
        os.path.join(UI, "src/components/commtools/BaziPattern.js"): [
            "key={`s", "horosa_no_state_mutation_v1"
        ],
        os.path.join(UI, "src/components/commtools/BaziPithy.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/commtools/Calculator.js"): ["key={`s"],
        os.path.join(UI, "src/components/commtools/CuanGong12Desc.js"): ["key={`s"],
        os.path.join(UI, "src/components/commtools/CuanGong12Query.js"): ["key={`s"],
        os.path.join(UI, "src/components/commtools/InverseBazi.js"): ["key={`s"],
        os.path.join(UI, "src/components/commtools/NaYing.js"): ["key={`s"],
        os.path.join(UI, "src/components/comp/EditableTags.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/comp/TipsBoard.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/germany/AspectToMidpoint.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/gua/GuaSym.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/gua/MeiyiGuaSym.js"): ["key={`s"],
        os.path.join(UI, "src/components/guazhan/GuaDesc.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/relative/AntisciaInfo.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/relative/AspectInfo.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/relative/MidpointInfo.js"): ["key={`s"],
        os.path.join(UI, "src/components/ruleziwei/RuleHouses.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/ruleziwei/RuleHuaDesc.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/ruleziwei/RuleSihua.js"): ["horosa_stable_react_keys_v1"],
        os.path.join(UI, "src/components/ruleziwei/RuleStars.js"): ["horosa_stable_react_keys_v1"],
        # v3.9.2 收敛:CaseList/ChartList 的稳定 key 补丁被上游超集收编(档案列表重写为
        # 内容派生 key,randomStr 全部消失)→ 补丁退役,哨兵迁到「上游稳定键仍在」的存在性钉
        # (丢了它们 = 有人把随机 key 改回来;全站另有 no-random-React-keys 门双保险)。
        os.path.join(UI, "src/components/user/CaseList.js"): ["<Option key={item}"],
        os.path.join(UI, "src/components/user/ChartList.js"): ["<Option key={item}"],
        # [#109 收敛,v3.11.2] 典籍正文按需取(horosa_wangji_classics_ondemand_v1)被上游 [#75] 超集收编:
        # /wangji/pan 带 slimClassics=1 只回目录并标 contentOmitted、正文 /wangji/classic 按需取 + 模块缓存;
        # 我方 PY-6 后端补丁与 HuangJiMain 的 CLASSIC_SECTION_CACHE 族退役,哨兵迁钉上游形态。
        os.path.join(PY_SRC, "websrv/webwangjisrv.py"): ["slimClassics", "contentOmitted", "HOROSA_WANGJI_SECTIONS_CACHE"],
        os.path.join(UI, "src/components/huangji/HuangJiMain.js"): [
            "withSlimClassics", "loadClassicFull", "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            # PERF-R10 Ship2 预取任务出口(构参走上游 buildPanPayload 单源 → 缓存键逐字节同键;
            # postWangJiCached 直通壳随 #109 退役,预取直接走 postWangJi = 上游 kentangCache 三层)。
            "getStepPrefetchTasks", "this.buildPanPayload(steppedFields)",
        ],
        # marker: horosa_web_java_env_sanitize_v1
        os.path.join(WS, "start_horosa_local.sh"): ["horosa_web_java_env_sanitize_v1"],
        # marker: horosa_web_portable_stat_v1
        os.path.join(WS, "verify_horosa_local.sh"): ["horosa_web_portable_stat_v1"],
        # [#109 收敛,v3.11.2] 玄史长文本按需(horosa_xuanshi_longtext_ondemand_v1)后端/微年表侧被上游收编
        # (celestial.MICRO_LIST_LIMIT=300 + webxuanshisrv horosa_xuanshi_micro_ondemand_v1 limit 透传 + 前端
        # horosa.perf.xuanshiMicroLimit 开关);services/xuanshi.js 的有界 LRU 仍为我方(见上条)。哨兵迁钉上游形态。
        os.path.join(PY_SRC, "astrostudy/xuanshi/celestial.py"): ["MICRO_LIST_LIMIT", "HOROSA_XUANSHI_MICRO_MEMO"],
        os.path.join(PY_SRC, "websrv/webxuanshisrv.py"): ["horosa_xuanshi_micro_ondemand_v1"],
        os.path.join(UI, "src/components/xuanshi/XuanShiMicro.js"): ["horosa.perf.xuanshiMicroLimit"],

        # ==== #109(v3.11.2):上游本轮新增的后端性能开关 —— Mac 资产,不是 Windows 首创(PERF_INVENTORY 三之二登记)。
        # 钉住的理由:owner 明令「Mac 的优化不许遗漏」—— 下轮同步若哪一处被冲掉/回退,发布前硬失败;
        # 同时满足总账 P2「写到名字的开关必须真在代码/哨兵里」。每根针都是 os.environ.get 的字面开关名或实现锚。
        os.path.join(PY_SRC, "websrv/webchunzisrv.py"): ["HOROSA_CHUNZI_DB_MEMO"],
        os.path.join(WS, "vendor/kinastro/astro/tieban/tieban_calculator.py"): ["HOROSA_TIEBAN_DB_MEMO"],
        os.path.join(PY_SRC, "astrostudy/astroextra.py"): ["HOROSA_SWE_LON_MEMO"],
        os.path.join(PY_SRC, "websrv/fastjson.py"): ["def install_global", "HOROSA_FAST_JSON_GLOBAL", "HOROSA_FAST_JSON_ITER_SCAN"],
        os.path.join(WS, "flatlib-ctrad2/flatlib/aspects.py"): ["HOROSA_ASPECT_MEMO"],
        os.path.join(PY_SRC, "astrostudy/xuanshi/period.py"): ["HOROSA_XUANSHI_ERA_INDEX"],
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/interceptor/TransData.java"): ["HOROSA_JAVA_ORDERED_RESPONSE"],
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/LazyInitXmlScanPostProcessor.java"): ["HOROSA_JAVA_XML_SCAN_LAZY"],
        os.path.join(SRV, "boundless/src/main/java/boundless/spring/help/springcomp/LegacyBroadScanCondition.java"): ["HOROSA_JAVA_LEGACY_BROAD_SCAN"],

        # ==== PERF-R9 Ship 7:预取与预热全覆盖(每条 needle 都含 apply.sh §31 的 guard 串,满足 R4)====
        # marker: horosa_prefetch_runtime_whitelist_v1 —— 白名单从「注释 + jest 快照」变成运行时闸。
        # 丢它 = submitStepPrefetch 重新对 URL 一无所知,任何登记方都能把【随机起卦 / 取现时 /
        # 流式】端点塞进预取队列 —— 预取它们 = 把随机结果或「此刻」钉死进缓存 = 功能性降级。
        # 三个文件是一套:stepPrefetch 提交层 + request/chartFetch 运行层(纵深防御,因为 path 是自述的)。
        os.path.join(UI, "src/utils/stepPrefetch.js"): [
            "horosa_prefetch_runtime_whitelist_v1",
            "isPrefetchPathAllowed", "guardPrefetchUrl", "prefetchRefusalCount",
            # 逐条枚举 kentang 的 /{key}/pan —— 通配 '/*/pan' 会把地占(随机)与五兆(random.randint)
            # 一并放进来。枚举是这里唯一安全的写法,丢掉即回到裸 '/pan'(匹配不到任何真实路径)。
            "'/qimen/pan'", "'/wuzhao/pan'", "'moira'",
            # PERF-R10 Ship2:预算 5→12(武装深度 ±3 = 6 目标×(chart+技法);串行泵即节流阀)。
            "BUDGET_PER_SETTLE = 12",
            # v3.7.1 政策收敛:G6 精确豁免表退役(上游链式单任务不经白名单);太玄按上游政策表
            # seedInBody 入禁词、五兆按 deterministic 入准(组件层判 ganzhi + kentangCache 随机档
            # 守卫仍在)。同时钉上游 livelock 修(排干旧代+500ms 保底)不被回冲。
            "'taixuan'", "horosa_prefetch_pump_livelock_v1",
            # PERF-R12 W3a①:泵首任务快发(rIC 饥饿下风暴期近零派发的解药;32ms 让帧)。
            "stepPrefetchFastFirstEnabled", "FAST_FIRST_DELAY_MS",
            # v3.9.0:灵棋经(卜·其他第 15 门,一掷成卦、起出即冻结)入禁词。今日它零端点,
            # 该条是**将来那条路的点名拦截**(#93 课三);上游哪天给它加后端,预取会把
            # 「一时掷之,不可再掷」的古法语义钉死。丢掉这一针 = 那天没有任何信号。
            "'lingqi'",
        ],
        # PERF-R10 Ship2(horosa_step_prefetch_arm_v1):「选步长即武装」的机制宿主。
        # Windows 原创新文件(files/ 全量拷贝层,apply.sh §33);丢任一针 = 武装链路被冲掉,
        # owner 点名的「选完步长第一下也不能卡」静默回退成第一下必 miss。
        os.path.join(UI, "src/utils/stepPrefetchArm.js"): [
            "horosa_step_prefetch_arm_v1", "notifyStepUnitSelected", "armStepPrefetch",
            "registerArmPlanBuilder", "NO_ARM_TABS", "__horosaPrefetch",
            # PERF-R12 W3a③:同向连击 streak 台账(reportStepUnit 写 / stepStreak 读;
            # 翻向/换页/换档/dir=0/间隔>2s 即重置)。丢针 = models/astro.js 的偏斜分支读到 0 恒不偏。
            "reportStepUnit", "stepStreak", "STREAK_GAP_MS",
        ],
        # v3.5.1 收敛:步长入口触发线换血为上游 fireStepSelectPrefetch(opt-in prop 宿主闸
        # + 5s 去重;PlusMinusTime/PD 已挂 prop)。Windows 武装引擎经 models/astro.js 的
        # registerStepSelectHandler 接管(见该条目)。丢针 = 「选完步长第一下」退回必 miss。
        os.path.join(UI, "src/components/comp/DateTimeSelector.js"): [
            "fireStepSelectPrefetch", "stepSelectPrefetch",
        ],
        # PERF-R10 S2(horosa_boot_chart_restore_v1):温启现场恢复。快照=fetchByChartData 的
        # record 口径(键清单单一事实源=RECORD_FIELDS_RESTORE_MANIFEST);7 天窗+桌面壳判定+
        # kill-switch 全在 loadBootChartSnapshot 内。丢针 = 温启退回空白默认态,零报警。
        # [#109 收敛,v3.11.2] bootChartRestore.js 与同名测试由上游自有实现承载(带我方 marker 的超集:签名
        # +currentSubTab,测试 4 例 ⊃ 3 例);models/app.js 接线补丁退役(上游 checkUser 二选一 + restoredSubTab 校验)。
        # 哨兵迁钉上游形态:退回旧签名 / 丢 restoredSubTab 校验即红(#101 课二:退役的真正风险是哨兵跟着补丁消失)。
        os.path.join(UI, "src/utils/bootChartRestore.js"): [
            "horosa_boot_chart_restore_v1", "buildBootChartRecord(fields, currentTab, currentSubTab)",
            "loadBootChartSnapshot", "RECORD_FIELDS_RESTORE_MANIFEST",
        ],
        os.path.join(UI, "src/models/app.js"): [
            "loadBootChartSnapshot", "restoredSubTab", "bootChartRestore: 'pending'",
        ],
        # 上游同名金标(4 例 ⊃ 我方 3 例):R7-b 豁免的 marker 必须有针,否则上游删掉它无人报警。
        os.path.join(UI, "src/utils/__tests__/bootChartRestore.test.js"): [
            "horosa_boot_chart_restore_v1", "currentSubTab",
        ],
        # v3.5.1 收敛:_kentangResultCache.js 整体退役(上游 utils/kentangCache.js 的
        # fetch 级 L1/L2/L3+在途去重全面取代,信封同款 kt-v1|rv)。Windows-ahead 残余职责
        # 迁至 kentangCache.js 的 wuzhao 随机守卫(下条)。
        # horosa_wuzhao_random_guard_v1(Windows-ahead,v3.5.1):五兆自动揲筮(无 seed、
        # 服务端 random.randint)不得入缓存 —— 上游覆盖矩阵误标 deterministic,fetch 级
        # 缓存会把随机揲筮钉死(同 body 重卦返回冻结旧卦)。丢针 = 随机起课语义静默破坏。
        os.path.join(UI, "src/utils/kentangCache.js"): [
            "horosa_wuzhao_random_guard_v1", "body.mode !== 'ganzhi'",
        ],
        # PERF-R10 Ship5(horosa_moira_stable_key_v1):同参重放救活 —— chartId 随机致键退化。
        os.path.join(UI, "src/services/qizheng.js"): [
            "horosa_moira_stable_key_v1", "stableMoiraKey",
        ],
        os.path.join(UI, "src/services/_requestCache.js"): [
            "horosa_moira_stable_key_v1", "cfg.key",
            # PERF-R12 W3d-G5:同步缓存窥探(命中路径中间帧合并的判据;窥探假 ⇒ 恒走旧两段式)。
            "peekCachedPost",
        ],
        # PERF-R10 Ship5-P2(horosa_option_prefetch_v1):选项二值轴 Hamming-1 投机(files/ 层)。
        os.path.join(UI, "src/utils/optionPrefetch.js"): [
            "horosa_option_prefetch_v1", "BINARY_CHART_AXES", "speculateChartOptions",
        ],
        os.path.join(UI, "src/utils/request.js"): [
            "horosa_prefetch_runtime_whitelist_v1", "guardPrefetchUrl",
        ],
        # ★ kentang 全族走 chartFetch 的裸 fetch(不经 utils/request)—— 没有这一闸整族在任何白名单之外。
        os.path.join(UI, "src/utils/chartFetch.js"): [
            "horosa_prefetch_runtime_whitelist_v1", "guardPrefetchUrl", "prefetch.blocked",
        ],
        # 运行时白名单的金标(Windows 原创新文件,走 files/ 全拷层)。七类禁区逐条断言零泄漏。
        os.path.join(UI, "src/utils/__tests__/stepPrefetchWhitelist.test.js"): [
            "horosa_prefetch_runtime_whitelist_v1", "prefetchRefusalCount",
            # v3.7.1 重钉:G6 豁免退役 → moira 全族恒拦;太玄入禁 + Windows-ahead /chart3d 在准。
            "'/taixuan/pan'", "'/chart3d/state'",
        ],

        # marker: horosa_prefetch_registry_v1 —— 各技法在自己的组件里登记步进预取。
        # 此前只有 /chart 一个端点进预取,非占星页 gate 面板的是**技法端点**,点下一步照样等冷计算。
        # 登记必须在组件内:构参吃组件态(流派/子页/引擎模式),模块级构不出与真点同键的 body。
        os.path.join(UI, "src/components/dunjia/DunJiaMain.js"): [
            "horosa_prefetch_registry_v1", "warmDunJiaStage1", "registerStepPrefetcher('dunjia'",
            # PERF-R10 Ship2(b′):未确认步进只落 localFields 不经 fetchByFields → settle 自武装。
            "armStepPrefetch(",
            # [gotcha #94] 同 ZiWeiMain:v3.8.0 起守卫改为 horosa_panel_ready_v1(上游已自带
            # prefetch_registry,旧守卫恒命中 ⇒ 整条补丁静默跳过)。守卫必须同时是哨兵针(R4)。
            "horosa_panel_ready_v1",
            # v3.7.3 上游双修(镜像上游 [194]/[196]④;**一处守两处** —— 奇门择日内嵌的正是本组件,
            # 故独立奇门页与择日页同源同修):
            # ① 时间即时传导(已起盘才随时间重算,未起盘只落草稿);
            # ② 满屏 <Spin> 遮罩撤为中栏右上角小徽标 —— 重算期旧盘 keep-stale 可见、左右栏可继续操作。
            #    徽标是 absolute,**必须**有 app.less 那侧的定位父,否则会飞到窗口角(见 app.less 条目)。
            "horosa_live_time_propagation_v1",
            "this.requestNongli(localFields, true);",
            "horosa-workspace-updating horosa-dunjia-updating",
        ],
        # v3.7.3 上游:遁甲重算小徽标的样式 + 中栏定位父(镜像上游 [196]④ 的 LESS 侧判据)。
        # 缺 position:relative ⇒ absolute 徽标脱离中栏飞到窗口右上角(上游初版即栽在这)。
        os.path.join(UI, "src/layouts/app.less"): [
            "horosa-dunjia-updating",
            "中栏内 absolute 小转圈徽标的定位父",
        ],
        # v3.7.3 上游:奇门择日子页签空闲预挂载(镜像上游 [194] 的 zeri 侧三判据)。
        # 丢 forceRender 接线 = 首次点开回到冷态建树(用户实报的那次卡顿原样复发);
        # kill-switch 必须在(localStorage['horosa.perf.zeriPrerender']='0' 退回点了才挂)。
        os.path.join(UI, "src/components/zeri/ZeriMain.js"): [
            "horosa_zeri_idle_prerender_v1",
            "forceRender={this.state.prerenderQimenZeri}",
            "horosa.perf.zeriPrerender",
        ],
        # v3.7.3 上游:紫微天才落宫双端同改的 **JS 侧**(镜像上游 [195]⑦)。
        # 旧式 HOUSE_NAMES[11-n] 宫名反查恒偏一位(仅子年因 if(idx>0) 保护而正确)。
        # 🔴 与 Java ZiWeiChart.setupTianCouCai 是**一对**:只改一侧 = 前后端分叉,
        #    且 Java 改后必须 mvn 全链重编 jar,否则发货 jar 里仍是旧式。
        os.path.join(UI, "src/components/ziwei/ZiweiCalc.js"): [
            "placeRec((lifeIdx + yearZiIdx) % 12, '天才', 3)",
            "tianmaBasisEarly",
        ],
        os.path.join(PY_SRC, "tests", "test_qizheng_election_scan.py"): [
            # [v3.10.0] 对冲断言圆距化(裸 (Δ-180)%360 在精确对冲时模界脆断,Windows libm 尾差实测);
            # 丢针 = 同步把上游脆形带回来 ⇒ pytest 平台性假红回潮。
            "horosa_circular_delta_assert_v1", "min(_ketu_delta, 360.0 - _ketu_delta)",
        ],
        # v3.11.0:上游新测在 numpy 2 下 float() 一维数组 TypeError(内嵌运行时 2.4.2 实撞);取 [0] 后两代同义。丢针 = 4 红回潮。
        os.path.join(PY_SRC, "tests/test_taiyi_game_theory_lp_fallback.py"): [
            "horosa_numpy2_scalar_assert_v1", "float((A_eq @ r2.x)[0])",
        ],
        # v3.11.2(#109):上游新测起子进程按 ensure_ascii=False 打印中文人名,subprocess.run(text=True) 未指定 encoding
        # ⇒ Windows 管道两端按 locale 码页编解码 ⇒ reader 线程 UnicodeDecodeError、stdout=None ⇒ AttributeError 假红
        # (#99/#102 同族:上游测试的 POSIX/UTF-8 环境假设)。两端显式 UTF-8;丢针 = 第二红回潮。
        os.path.join(PY_SRC, "tests/test_xuanshi_persons_graph_order.py"): [
            "horosa_subprocess_utf8_v1", "env['PYTHONIOENCODING'] = 'utf-8'", "encoding='utf-8', errors='replace'",
        ],
        os.path.join(UI, "src/components/taiyi/TaiyiBoardSvg.js"): [
            # [v3.10.0] 上游新共享盘用 shenMeaning 未 import(触发即 ReferenceError);我方补 import。
            # [v3.11.0] 上游自修(import 进基线 + taiyiBoardMark.test.js 回归)→ 补丁按 #49/#101 退役,
            # 针迁钉上游形态(丢 import = 上游回退,本针 + 绑定门双层拦)。
            "import { TAIYI_GONG_INFO, shenMeaning } from './core/taiyiDuanfa';",
        ],
        os.path.join(UI, "src/components/taiyi/TaiYiMain.js"): [
            "horosa_prefetch_registry_v1", "warmTaiYiStage1", "registerStepPrefetcher('taiyi'",
            # [#94 三连击,v3.10.0] 守卫收编致整补丁静默跳过、FreezeSubTab/markPanelReady 双丢 —— 
            # 新守卫 horosa_freeze_subtabs_v1 R4 成对入针,丢失面字面钉死(SENT 是这类丢失的最后防线,#100)。
            "horosa_freeze_subtabs_v1", "markPanelReady('taiyi')",
            "<FreezeSubTab active={activeKey === 'overview'}>",
        ],
        os.path.join(UI, "src/components/sanshi/SanShiUnitedMain.js"): [
            # v3.7.2 收敛:我方 R9 的「stage-1 多任务并列」被上游**链式单任务**取代(GuoLao G6 同型
            # 超集:任务体内 await nongli 后再续奇门后端盘 + 太乙盘,两端点本就在白名单内)。
            # marker 随之换代 horosa_prefetch_registry_v1 → horosa_sanshi_step_prefetch_v1(上游所有)。
            # 登记/反注册**成对**钉(镜像上游 [192]):只登记不反注册 = 卸载后登记表泄漏,
            # 闭包吃到死组件态;上游门与本门两侧同判据,任一侧漏都会在发布前拦下。
            "horosa_sanshi_step_prefetch_v1", "registerStepPrefetcher('sanshiunited'",
            "unregisterStepPrefetcher('sanshiunited'",
            # [Windows-only 增量] 链式任务只传现有年种子、不补缺失的 —— 跨年步进那一步仍现付
            # /jieqi/year。我方第二条任务补上它;丢针 = 跨年连续进退重新变慢,且无人报警。
            "'sanshi:jieqiseed'",
            # v3.7.2 上游连续进退大修四机制(**上游自研,照抄不擅动**;冲掉即报红):
            # 不丢击队列 / 不等 chart 回流 / 快照挪 idle / 撤满屏 Spin 改中栏小转圈。
            "horosa_sanshi_no_drop_step_v1", "horosa_sanshi_no_wait_chart_v1",
            "horosa_sanshi_snapshot_idle_v1", "horosa-sanshi-updating",
            # PERF-R12 W3c:渲染切片(S1 左栏 31 Select / S2 隐藏表单头)+ S5 提交并帧 + S6 同键短路。
            # [S4 已收敛 v3.10.0] 盘面层 SanShiBoardLayer 退役:上游把 renderTop/Middle/Bottom+五子绘制
            # 机械迁出为共享 SanshiUnitedBoard(择日概览同源);我方 sCU 隔离改由 MemoSanshiUnitedBoard
            # (React.memo 浅比,壳层 props 全引用稳定)承接 —— 哨兵随迁,退回裸组件即红(#101 课二)。
            "horosa_sanshi_render_slice_v1", "SanShiInputPanel", "MemoSanshiUnitedBoard",
            "<MemoSanshiUnitedBoard",
            # v3.7.3 上游连续进退三修(镜像上游 [194]/[196];**上游自研,照抄不擅动**):
            # ① 时间即时传导 —— 已起盘态改时间即刻重算(hasPlotted 决定算不算,confirmed 只表示
            #    「是不是显式提交」);未起盘仍须显式起盘,故首盘显式门的可见提示同为判据。
            # ② 外圈随时间校正 —— componentDidUpdate 的 chartObj 校正**不得**再带 awaitingChartSync
            #    前置条件(实时传导路径下它恒为 false ⇒ 校正整个被跳过 ⇒ 外圈星度冻在起盘那一刻)。
            # ③ 角宫地支对角镜像 —— 只移地支、宫位数字原地不动。
            "horosa_live_time_propagation_v1",
            "const liveReplot = !confirmed && !!this.state.hasPlotted;",
            "horosa_sanshi_outer_follow_time_v1",
            "if(this.state.hasPlotted && chartChanged){",
            "horosa_sanshi_corner_label_mirror_v1",

            "this.props.onOptionChange('taiyiStyle', v)", "this.props.onOptionChange('taiyiAccum', v)", "this.props.onOptionChange('taiyiTimeBasis', v)",
        ],
        # 步进预取金标(v3.7.1 起 Mac 收编重写为其契约面;Windows 追加两组 describe:
        # fast-first 风暴/首发延迟矩阵 + 偏斜计划形状矩阵,快照含 Windows-ahead '/chart3d')。
        os.path.join(UI, "src/utils/__tests__/stepPrefetch.test.js"): [
            "registerStepPrefetcher", "'/chart3d'",
            # PERF-R12 W3a(v3.7.1 重钉):关闸=40ms 窗内零派发+livelock 保底仍发;开闸=32ms 让帧即发。
            "horosa_pump_fastfirst_v1", "horosa_pump_skew_v1", "stepPrefetchFastFirst", "stepPrefetchSkew",
        ],

        # marker: horosa_chart_free_declared_v1 —— chartFree 快车道扩容(fields 立即提交、不等 /chart)。
        # 组件里的声明与 utils/techniqueChartFree.js 的登记是**一对**:只登记不声明 = 无效;
        # 只声明不登记 = chartFreeContract 契约测试红(它 grep 源文件核「零 props.value/chartObj 消费」)。
        os.path.join(UI, "src/utils/techniqueChartFree.js"): [
            "horosa_chart_free_declared_v1",
            "components/fengshui/FengShuiMain.js",
            "components/calendar/CalendarMain.js",
            "components/cntradition/CnTraditionMain.js",
        ],
        os.path.join(UI, "src/components/calendar/CalendarMain.js"): [
            "horosa_chart_free_declared_v1", "hook.chartFree = true",
        ],
        os.path.join(UI, "src/components/cntradition/CnTraditionMain.js"): [
            "horosa_chart_free_declared_v1", "hook.chartFree = true",
        ],

        # marker: horosa_data_warm_registry_v1 —— 排盘后数据层预热的任务注册表(Windows 原创新
        # 文件,走 files/ 全拷层)。丢它 = 清单退回 pages/index.js 里写死的 4 条数组,
        # 紫微 /ziwei/birth(首点概率最高)等四个漏项一并复活。
        os.path.join(UI, "src/utils/dataWarmTasks.js"): [
            "horosa_data_warm_registry_v1", "registerDataWarmTask", "buildDataWarmTasks",
            # 本轮补入的四条 —— 少任何一条都意味着一个技法的首点重新付冷成本。
            "ziwei:birth", "dunjia:stage1", "taiyi:stage1", "jieqi:year",
            # v3.7.1:本文件由 files/ 全拷层转 patches/ 层(上游收编了注册表本体与前四条任务)。
            # 下面四条是**我方增补**的预热任务,同时 warmGermanyMidpoint 是 apply.sh 该行的 guard 串
            # (R4 要求 guard ∈ 本条目;两侧任一改名都必须同步改另一侧,否则补丁静默 no-op)。
            "warmGermanyMidpoint", "direction:pd", "india:birth", "jieqi:year",
        ],
        os.path.join(UI, "src/utils/__tests__/dataWarmTasks.test.js"): [
            "horosa_data_warm_registry_v1", "__dataWarmRegistryKeys",
        ],

        # ==== PERF-R9 Ship 6:前端渲染优化(73 个目标;每条 needle 都含 apply.sh §32 的 guard 串,满足 R4)====
        # 三条主线:① horosa_panel_ready_v1(101 处 markPanelReady)= 「面板画完」的观测终点 —— 丢它,
        # owner 的验收口径「点击 → 中栏+右栏画完 ≤1s」立刻退回**量不出来**的状态(render-complete 只由
        # chartObj.chartId 变化触发,右栏面板自己那次 setState 后的重绘完全不在计内)。
        # ② sCU / React.memo 拆分(各族自己的 *_scu_v1 / *_memo_v1)—— 父组件的无关 state 抖动不再穿透到
        # 最重的那棵子树;一律走 utils/chartUpdateGuard,自身 state 变恒重渲,kill-switch horosa.perf.chartSCU。
        # ③ horosa_freeze_subtabs_v1 —— antd Tabs 默认把**全部**子页签常驻渲染,改受控 + FreezeSubTab 后
        # 只渲前台那一个(不卸载、不重发请求、不丢滚动位置)。
        # ★ 四个目标本轮改动不带 horosa_* marker(两个纯 sCU 壳 / 一个 useMemo+rowKey / 一个测试),
        #   其 apply.sh guard 取「补丁引入且改前不存在」的代码串,并原样钉在这里(R4 要求 guard == 钉)。
        # ---- 子页签冻结的基础设施:FreezeSubTab 本体。丢它,下面所有 freeze_subtabs 行一起失效 ----
        os.path.join(UI, "src/components/comp/FreezeInactive.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab", "shouldComponentUpdate", "perfFlags",
            # 两个 kill-switch 的消费点都在本文件 —— 丢任一个,对应的闸就静默恒开/恒关。
            "freezeSubTabsEnabled", "subTabDeferMountEnabled",
        ],

        # ---- 占星族(astro / astro3d / auxchart / hellenastro):markPanelReady 的主战场 ----
        # 多方法页(推运/回归/印度推运/星历)另叠 FreezeSubTab —— 一个方法一张盘 + 一套表,此前**全部**
        # 方法常驻重渲。chartSCU.test.js 是 ② 的金标:MidpointMain 因接入 FreezeSubTab 首次有了 state,
        # sCU 随之加 state 守卫,而旧测试**单参**调用 ⇒ nextState===undefined ⇒ 恒返 true ⇒ 一批期望 true
        # 的用例变**假绿**(不再检验 props 比较)。needle 钉的正是「统一经 scu(c,next) 传 c.state」这一改。
        os.path.join(UI, "src/components/astro/AstroAgePoint.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroBalbillus.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroChartMain.js"): [
            "horosa_panel_ready_v1", "horosa_freeze_subtabs_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/astro/AstroDecennials.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroDistributions.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroDoubleChartMain.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab", "wrapperPropsEqual", "chartUpdateGuard"
        ],
        os.path.join(UI, "src/components/astro/AstroEphemeris.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroExtraReturns.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroJaynesProgressions.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroKeypoints.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroLunationPhase.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroPersianDirected.js"): [
            "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroPlanetaryAges.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroPlanetaryArc.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroPrenatalSyzygy.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroPrimaryDirection.js"): [
            "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroPrimaryDirectionChart.js"): [
            "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroProgressions.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroRelative.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroReturnTimeline.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/astro/AstroTriplicityRulers.js"): [
            "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/AstroVedicProgressions.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/astro/AstroZR.js"): [
            "horosa_panel_ready_v1", "horosa_no_mutate_chart_params_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/astro/__tests__/chartSCU.test.js"): [
            "c.shouldComponentUpdate(nextProps,", "sideTab: '2'", "FreezeSubTab", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/astro3d/AstroChartMain3D.js"): [
            "horosa_freeze_subtabs_v1", "horosa_controlled_tab_clamp_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab",
            # PERF-R10 Ship2(P6):非地心中心盘的 /chart3d/state 步进预取登记。
            "registerStepPrefetcher('astrochart3D'",
        ],
        os.path.join(UI, "src/components/astro3d/AstroPDSphere.js"): [
            "horosa_shallow_scu_v1", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/auxchart/AstroDraconicLab.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/auxchart/AstroHarmonicLab.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/auxchart/AstroRelocationLab.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/hellenastro/AstroChart13.js"): ["horosa_panel_ready_v1", "markPanelReady("],

        # ---- 黄历族(calendar):「一次请求 → 一大片静态表格」,父页任何 state 抖动都全量重排 ----
        # YearAuspiciousPanel 无 marker:catOptions 提进 useMemo(只随「含丧葬」开关变)+ 给 antd List
        # 补 rowKey(否则退回下标键)。guard/needle 取 "rowKey="(改前该文件里不存在)。
        os.path.join(UI, "src/components/calendar/NongLiMain.js"): [
            "horosa_panel_scu_v1", "horosa_panel_ready_v1", "markPanelReady(", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/calendar/RiziMain.js"): [
            "horosa_panel_scu_v1", "horosa_panel_ready_v1", "markPanelReady(", "React.memo", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/calendar/TongshuMain.js"): [
            "horosa_panel_scu_v1", "horosa_kentang_result_cache_v1", "horosa_panel_ready_v1", "markPanelReady(", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/calendar/YearAuspiciousPanel.js"): [
            "rowKey=", "[includeBurial],", "useMemo("
        ],

        # ---- 八字族(cntradition):BaZi.js 是全站最重的壳之一 ----
        # BaZiLuckFlowPanel 的 buildLuckItems→buildYearItems→buildMonthItems→buildDayItems 这条链在
        # render / emitSelection / 四个点击回调里各算一遍,其中 buildDayItems 要走 lunar-javascript 取整月
        # 每日干支(最贵的一段)。memoDerive 按【全部输入】记忆 ⇒ 命中即输出逐字段相同,不可能陈旧。
        os.path.join(UI, "src/components/cntradition/BaZi.js"): [
            "horosa_panel_ready_v1", "horosa_bazi_chartbazi_memo_v1", "horosa_bazi_child_memo_v1", "horosa_bazi_param_memo_v1", "markPanelReady(", "memo("
        ],
        os.path.join(UI, "src/components/cntradition/BaZiAppInfoPanel.js"): [
            "horosa_bazi_info_split_v1", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/cntradition/BaZiFineChart.js"): [
            "horosa_bazi_finechart_scu_v1", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/cntradition/BaZiLegacyView.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/cntradition/BaZiLuckFlowPanel.js"): [
            "horosa_panel_ready_v1", "horosa_bazi_flow_derive_memo_v1", "memoDerive", "markInteractionStart"
        ],

        # ---- 紫微族(ziwei):一张盘 12 宫 × 上百星曜,本族最重的 DOM ----
        os.path.join(UI, "src/components/ziwei/ZWLuckPanel.js"): [
            "horosa_ziwei_luck_scu_v1", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/ziwei/ZWPatternPanel.js"): [
            "horosa_ziwei_pattern_scu_v1", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/ziwei/ZiWeiChart.js"): [
            "horosa_ziwei_chart_scu_v1", "shouldComponentUpdate", "perfFlags"
        ],
        os.path.join(UI, "src/components/ziwei/ZiWeiInput.js"): [
            "horosa_ziwei_input_scu_v1", "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],

        # ---- 数算族(shusuan / yizhangjing):四个原生壳的 wrapperPropsEqual sCU ----
        os.path.join(UI, "src/components/shusuan/CanPingMain.js"): [
            "horosa_shusuan_native_scu_v1", "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/shusuan/HeLuoMain.js"): [
            "horosa_shusuan_native_scu_v1", "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/shusuan/ZhengChuanMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_shusuan_native_scu_v1", "FreezeSubTab", "wrapperPropsEqual", "chartUpdateGuard"
        ],
        os.path.join(UI, "src/components/yizhangjing/YiZhangJingMain.js"): [
            "horosa_shusuan_native_scu_v1", "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],

        # ---- 汉堡学派(germany):右栏「一个刻度盘 + N 张表」此前全部常驻 ----
        # 转盘页另加右栏惰性挂载(horosa_lazy_right_panels_v1)与刻度盘/宫位框 sCU。
        os.path.join(UI, "src/components/germany/AstroGermany.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab",
            # PERF-R12 W3f-A1:宿主 sCU(wrapperPropsEqual 机械浅比,kill-switch chartSCU)。
            "horosa_aux_render_slice_v1", "wrapperPropsEqual",
        ],
        os.path.join(UI, "src/components/germany/MidpointMain.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/germany/UranianDialMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_dial_scu_v1", "horosa_lazy_right_panels_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "chartUpdateGuard",
            # PERF-R12 W3f-A3:rings/personList 签名记忆(19 键全真依赖 —— 缺异步落点键则
            # TNP/行运点到货后盘面冻结;命盘库写版本 localChartsVersion 编进键=写驱动失效)。
            "horosa_aux_render_slice_v1", "refSig", "localChartsVersion",
        ],
        os.path.join(UI, "src/components/germany/UranianGraphicEphemeris.js"): [
            "horosa_panel_ready_v1", "markPanelReady("
        ],
        os.path.join(UI, "src/components/germany/UranianHouseFrames.js"): [
            "horosa_panel_ready_v1", "horosa_frames_scu_v1", "markPanelReady(", "chartUpdateGuard", "shouldComponentUpdate"
        ],

        # ---- 其余技法壳与面板:形状一致(左表单 + 中盘 + 右栏多子页签)----
        # horosa_controlled_tab_clamp_v1:页签集合随结果变化时,选过的键仍在就保持、否则回落默认键,
        # 绝不停在不存在的键上显示空白 —— 受控化的正确性配件,丢它就会出现空白右栏。
        # AIAnalysisMain / AstroAcg / MundaneMain 三个目标的钉**并入了它们既有的条目**(见上文),此处不再列。
        # LiuRengChart / MingOtherMain 无 marker(纯 sCU 壳),guard/needle 取补丁引入的 wrapperPropsEqual。
        os.path.join(UI, "src/components/cnyibu/CnYiBuMain.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab",
            # PERF-R10 Ship2(P6):cnyibu 单键注册,按活跃子页转发到子组件 getStepPrefetchTasks;
            # 确定性子页显式枚举(随机起卦绝不入列)。
            "registerStepPrefetcher('cnyibu'", "CNYIBU_PREFETCH_TABS",
            # PERF-R12 W2.5:14 个子技法 chunk 的裸 React.lazy → 自愈工厂(v3.6.0 同类根)。
            "horosa_lazy_healing_wrap_v1", "makeHealingFactory",
        ],
        os.path.join(UI, "src/components/commtools/CommToolsMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_controlled_tab_clamp_v1", "horosa_panel_ready_v1", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/dice/DiceMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/election/ElectionMain.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        # v3.7.0 天星择日(navigationPages 新键 zeri):P5 观测终点 —— 归属键钉死成字面量,
        # 防止未来重构改键后 P5 门看似绿而样本归错(gotcha #75 归属键契约)。
        os.path.join(UI, "src/components/zeri/TianxingElectionMain.js"): [
            "horosa_panel_ready_v1", "markPanelReady('zeri')",
            # PERF-R12 W3b:Z2 右栏受控 Tabs+FreezeSubTab(7 面板惰渲)/ Z3 previewDisplay 四键缓存。
            "horosa_zeri_render_slice_v1", "FreezeSubTab", "getPreviewDisplay",
        ],
        # v3.7.1 奇门分册(上游新文件)的 Windows P5 观测钉:找局三终态(命中/取消/失败)都收口
        # markPanelReady('zeri')——与天星分册同键(观测按顶层页配对,分册切换不换键)。
        os.path.join(UI, "src/components/zeri/QimenZeriMain.js"): [
            "horosa_panel_ready_v1", "markPanelReady('zeri')",
        ],
        os.path.join(UI, "src/components/feigong/FeiGongMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/guazhan/GuaZhanMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab"
        ],
        os.path.join(UI, "src/components/guice/GuiceMain.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/guolao/GuoLaoMoiraPanel.js"): [
            "horosa_freeze_subtabs_v1", "FreezeSubTab",
            # PERF-R12 W3d:G3 props 侧 memo(wrapperPropsEqual 语义,开关 chartSCU)+ G4 五段重
            # 派生 lazyOnce 化(未激活 tab 一行不算)。丢针 = 面板回到每渲全算五段。
            "horosa_guolao_render_slice_v1", "memo(GuoLaoMoiraPanel, wrapperPropsEqual)", "lazyOnce",
        ],
        os.path.join(UI, "src/components/guolao/GuoLaoStarSectDoc.js"): [
            "horosa_guolao_doc_scu_v1", "horosa_guolao_doc_static_rows_v1", "shouldComponentUpdate"
        ],
        # ---- PERF-R12 Phase-2 净新钉(W3b/W3d/W3f/W3g 新触面;补丁=apply.sh §37)----
        os.path.join(UI, "src/components/guolao/GuoLaoInput.js"): [
            # W3d-G1:重输入面板 sCU(SanShiUnitedMain 范式;kill-switch chartSCU)。
            "horosa_guolao_render_slice_v1", "wrapperPropsEqual", "shouldComponentUpdate",
        ],
        os.path.join(UI, "src/components/zeri/ConditionBuilderModal.js"): [
            # W3b-Z1(v3.7.1 上游超集收敛):everOpenRef 粘滞短路 —— 首开前连元素都不建,
            # 开过之后整树常驻(保关闭动画与草稿)。我方 open=false 早退补丁退役,钉上游形。
            "everOpenRef",
        ],
        os.path.join(UI, "src/components/germany/UranianDialStyle.js"): [
            # W3f-A2:getStoredUranianDisplay 模块级解析缓存 + 写点失效(唯一写口 saveUranianDisplay)。
            "horosa_aux_render_slice_v1", "_dispCache", "memoEnabled",
        ],
        os.path.join(UI, "src/components/divination/DivinationChartShell.js"): [
            # W3b-Z5 否决线(在码注释常驻):didUpdate 轮询是同挂载期第二次「应用案例」的落地机制,
            # 加守卫 = 吞掉第二次应用 —— 丢了这段注释,下一轮优化者会再走同一条弯路。
            "W3b-Z5",
        ],
        os.path.join(UI, "src/components/astro3d/__tests__/astro3dMorph.test.js"): [
            # W3g:「纯时间步进必走补间」五针(needRecreate 首判/semanticKeys 三键封闭/无 date-time
            # 比较/三处 fields 同步/显示集合判据同口径)。丢针 = 步进静默退化全量重建无人察觉。
            "W3g", "纯时间步进必走补间",
        ],
        os.path.join(UI, "src/components/horary/HoraryMain.js"): ["horosa_panel_ready_v1", "markPanelReady("],
        os.path.join(UI, "src/components/lrzhan/LiuRengChart.js"): [
            "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/mingother/MingOtherMain.js"): [
            "wrapperPropsEqual", "chartUpdateGuard", "shouldComponentUpdate"
        ],
        os.path.join(UI, "src/components/suzhan/SuZhanMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/tarot/TarotMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/tongshefa/TongSheFaMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/xiaochengtu/XiaoChengTuMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
        os.path.join(UI, "src/components/xiaoliuren/XiaoLiuRenMain.js"): [
            "horosa_freeze_subtabs_v1", "horosa_panel_ready_v1", "markPanelReady(", "FreezeSubTab", "wrapperPropsEqual"
        ],
    }
    # PERF-R9 G5:**负向**哨兵 —— 有些 Windows 适配是「删掉某行」而不是「加上某标记」,
    # 正向 needle 表达不了它们,于是台账 #1–#5 长期零覆盖。
    # 其中 apply.sh §2 剥离 flatlib 钉是全部适配里**唯一运行期静默失效**的一条:
    # 钉一旦回来,pip 会去装 PyPI 上那个同名但不兼容的 flatlib,排盘服务直接起不来;
    # 而下游两道服务探针门(kentang / all-services)在没有 win-unpacked 时是 SKIP=PASS,
    # 根本兜不住。故必须在这里、用不依赖任何构建产物的方式硬断言。
    SENT_ABSENT = {
        # v3.11.0(镜像上游 [226]):本机 MCP 服务必须只绑回环;通知脚本钩零 shell
        os.path.join(BUNDLE, "electron", "mcp-server.js"): ["0.0.0.0"],
        os.path.join(BUNDLE, "electron", "desktop-bridge.js"): ["shell: true"],
        # v3.11.0 覆盖补丁(issue #83):六壬「时间算法」控件的主类形 `value={this.state.timeAlg}` 不得再出现在这个文件里 ——
        # 本文件唯一渲染它的宿主是切片子组件 LiuRengInputPanel(this.state 恒 null),该形一回来就是首屏 TypeError。
        os.path.join(UI, "src/components/lrzhan/LiuRengMain.js"): ["value={this.state.timeAlg}", "onChange={this.onTimeAlgChange}"],
        # v3.11.1 覆盖补丁(issue #84):旧折行判据(need 直接累加当前态 padding)与旧盘径式(不封顶)不得回潮
        os.path.join(UI, "src/components/xq-ui/index.js"): ["need += tw + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2;", "const next = avail > 0 && need > avail;"],
        os.path.join(UI, "src/components/fengshui/LiqiWorkspace.js"): ["Math.max(640, Math.floor(Math.min(chartBox.w, chartBox.h)) - 16)"],
        os.path.join(PY_SRC, "requirements.txt"): ["flatlib=="],
        # v3.11.0:write-build-info 的单引号 pathspec shell 串不得回潮(Windows 上 = 判脏恒假绿,gotcha #104)。
        os.path.join(UI, "scripts/write-build-info.js"): ["git status --porcelain -- ${srcPaths"],
        # v3.11.0:horosa_markdown_lru_v1 退役后的**回潮负锚** —— 上游改用 AssistantMarkdown 记忆化组件渲染助手正文,
        # 我方按内容做 LRU 的 renderMarkdownToHtmlCached 若被同步/合并重新带回 = 双缓存(正向针证不了「旧写法没回来」)。
        os.path.join(UI, "src/components/aianalysis/AIAnalysisMain.js"): [
            "function renderMarkdownToHtmlCached(",
            "horosa_markdown_lru_v1",
        ],
        # v3.7.2:镜像上游 preflight [192] 的**负锚**(正向针测不出「回潮」这一类):
        # 三式重算若又出现 `awaitingSyncTimer = setTimeout(`,说明「等 /chart 回流的 1200ms 兜底」
        # 被同步/合并重新带回 —— 每一步硬吃满 1.2s,正是 owner 实告「连续进退卡很久」的最大单项。
        # 正向针(horosa_sanshi_no_wait_chart_v1)只证注释在,证不了 timer 没回来,故必须配负锚。
        os.path.join(UI, "src/components/sanshi/SanShiUnitedMain.js"): [
            "awaitingSyncTimer = setTimeout(",
            # v3.7.3(镜像上游 [196]①②⑤):三条**回潮**负锚 —— 正向针证不了「旧写法没回来」。
            # ① awaitingChartSync 前置条件:实时传导路径下它恒为 false,加回去 = 外圈校正整个被
            #    跳过,外圈星度冻在起盘那一刻(用户实测三轮才定位的静默错值);
            # ② getOuterChartKey 纳入随机 chartId:同刻重复回流也判「变了」⇒ 每次全量重算(含
            #    /qimen/pan 与 /taiyi/pan 两条请求),性能白掉;钉「两制表符 + 独占一行」的真代码
            #    形态(裸 `chartId,` 在别处也出现,会假阳);
            # ③ 角宫径向外推回潮 3.1:角位字压出外框(用户实圈)。
            "if(this.awaitingChartSync && this.state.hasPlotted && chartChanged)",
            "\n\t\tchartId,\n",
            "const outerShift = 3.1;",
        ],
        # v3.7.3(镜像上游 [196]④):遁甲满屏遮罩回潮负锚。奇门择日内嵌的正是 DunJiaMain,
        # 一条负锚守两处页面;正向针(小徽标在位)证不了「旧 Spin 没被同步带回来」。
        os.path.join(UI, "src/components/dunjia/DunJiaMain.js"): [
            "<Spin spinning={this.state.loading}>",
        ],
        # v3.7.3(镜像上游 [196]③):mainChainAbort 回潮为默认开 = 两个并发 /chart 请求互相残杀,
        # chartObj 永不更新。正向针钉的是 `=== '1'`,本负锚钉旧的 flagEnabled(默认开)形态。
        os.path.join(UI, "src/utils/perfFlags.js"): [
            "return flagEnabled('horosa.perf.mainChainAbort')",
        ],
        # v3.7.3(镜像上游 [195]①):distancejq 的 year-1 回潮。**只认真代码形态** ——
        # 上游把旧写法原文写进了 docstring 作病史说明,拿裸 `find_jq_date(year-1` 当负锚会当场假阳
        # (上游哨兵初版即栽在这;我方 v3.7.2 也栽过同型的 `<Spin` 注释假阳,见 gotcha #92)。
        # 旧代码独有形态 = 同一行里 `return int( Date(` 与 `find_jq_date(year-1` 并存。
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/jieqi.py"): [
            "return int( Date(\"{}/{}/{} {}:{}:00.00\".format(str(year).zfill(4), str(month).zfill(2), "
            "str(day).zfill(2), str(hour).zfill(2), str(minute).zfill(2))) - find_jq_date(year-1,",
        ],
        # v3.7.3(镜像上游 [195]③):旧 -360 环绕回潮(表长 363 与 360 不符即静默混叠)。
        os.path.join(WS, "vendor/kintaiyi/src/kintaiyi/config.py"): [
            "new_num = num -360",
        ],
    }
    # 同一文件的正向底线:防止「过宽的 sed 把整份依赖清单洗掉」也悄悄通过。
    SENT_FLOOR = {
        os.path.join(PY_SRC, "requirements.txt"): ["cherrypy", "jsonpickle", "pyswisseph", "sxtwl"],
    }

    missing = []
    for path, needles in SENT.items():
        if not os.path.exists(path):
            missing.append(f"MISSING FILE {os.path.relpath(path, REPO)}")
            continue
        txt = read(path)
        for n in needles:
            if n not in txt:
                missing.append(f"{os.path.relpath(path, REPO)} lost '{n}'")
    for path, banned in SENT_ABSENT.items():
        if not os.path.exists(path):
            missing.append(f"MISSING FILE {os.path.relpath(path, REPO)}")
            continue
        txt = read(path)
        for n in banned:
            if n in txt:
                missing.append(
                    f"{os.path.relpath(path, REPO)} REGAINED '{n}' — apply.sh §2 的剥离没生效;"
                    f"装机时 pip 会拉到不兼容的同名包,排盘服务将静默起不来")
    for path, floor in SENT_FLOOR.items():
        if not os.path.exists(path):
            continue
        txt = read(path)
        for n in floor:
            if n not in txt:
                missing.append(f"{os.path.relpath(path, REPO)} lost baseline dep '{n}'")
    # PERF-R9:SENT 是本函数的局部变量。五层契约交叉核对门(check_overlay_contract_coverage)
    # 需要读它来核对「每个被打补丁的目标都有哨兵、且 apply.sh 的 guard 串就是其中一个钉」。
    # 留一份模块级快照而不是把 SENT 提到模块级 —— 后者是个上百行的大改动,而这个 dict 恰恰是
    # gotcha #29 反复出事的地方,能不动就不动。
    globals()["_SENT_LAST"] = SENT

    record("windows-ahead / ported-fix sentinels", not missing,
           "; ".join(missing) if missing else
           f"{len(SENT)} files OK (+{len(SENT_ABSENT)} negative, +{len(SENT_FLOOR)} floor)")

def check_jar_not_stale():
    jar = os.path.join(BUNDLE_RUNTIME, "astrostudyboot.jar")
    if not os.path.exists(jar):
        record("staged jar not stale", False, "bundle astrostudyboot.jar MISSING")
        return
    jar_m = os.path.getmtime(jar)
    src_m, src_p = newest_mtime(SRV, (".java",), skip_substr=("/target/",))
    ok = src_m <= jar_m
    detail = "jar newer than all .java" if ok else f"STALE: {os.path.relpath(src_p, REPO)} is newer than the staged jar (jar not rebuilt from current backend source)"
    record("staged jar not stale", ok, detail)

def check_runtime_version_lockstep(V):
    """SELF-HEAL-R1 F3: RUNTIME_VERSION 锁步门(v3.3.0 覆盖热修的教训制度化)。

    ChartController.RUNTIME_VERSION 是排盘 paramhash 持久缓存的版本闸:它不随产品版本推进时,
    升级用户会继续吃到旧算法算出的缓存盘面(v3.3.0 首发即中招,靠人眼在覆盖热修里救回)。
    Mac 侧有 preflight 比对 release_config.json;Windows 侧此前**无任何门**——本门补齐:
      ①源 ChartController.java 常量必须 == V 或 V-runtimeN(既有约定,如 3.3.2-runtime1);
      ②发货 jar(嵌套 astrostudycn-*.jar 的 ChartController.class 常量池)必须含同一字节串
        (改了源没重建 jar 同样拦下 —— gotcha #53/#57 双教训一门全收)。
    """
    name = "RUNTIME_VERSION lockstep"
    src = os.path.join(SRV, "astrostudycn", "src", "main", "java", "spacex",
                       "astrostudycn", "controller", "ChartController.java")
    if not os.path.exists(src):
        record(name, False, "ChartController.java MISSING at expected path")
        return
    m = re.search(r'RUNTIME_VERSION\s*=\s*"([^"]+)"', read(src))
    if not m:
        # v3.6.0 起上游把字面量收编进 basecomm RuntimeWire,ChartController 改为
        # `RUNTIME_VERSION = spacex.basecomm.constants.RuntimeWire.RUNTIME_VERSION`(编译期内联,
        # 发货 class 的常量池检查不受影响)。源侧跟随委托链读 RuntimeWire.java 的字面量;
        # 两处都找不到才红(防上游再挪家时静默放行)。
        if re.search(r'RUNTIME_VERSION\s*=\s*(?:spacex\.basecomm\.constants\.)?RuntimeWire\.RUNTIME_VERSION', read(src)):
            wire = os.path.join(SRV, "basecomm", "src", "main", "java", "spacex",
                                "basecomm", "constants", "RuntimeWire.java")
            if os.path.exists(wire):
                m = re.search(r'RUNTIME_VERSION\s*=\s*"([^"]+)"', read(wire))
        if not m:
            record(name, False, "RUNTIME_VERSION literal not found (ChartController delegation chain broken?)")
            return
    rv = m.group(1)
    if not re.fullmatch(re.escape(V) + r"(-runtime\d+)?", rv):
        record(name, False,
               f"ChartController RUNTIME_VERSION '{rv}' 未与 package.json {V} 锁步（应为 {V} 或 {V}-runtimeN）。"
               f"改法：bump ChartController.java 的 RUNTIME_VERSION → regen windows-adaptations overlay 补丁 → "
               f"重建 astrostudyboot.jar 并重新 stage（gotcha #53/#57：缓存版本闸不推进=升级用户吃到旧算法缓存盘）")
        return
    jar = os.path.join(BUNDLE_RUNTIME, "astrostudyboot.jar")
    if not os.path.exists(jar):
        record(name, False, "bundle astrostudyboot.jar MISSING")
        return
    import zipfile, io
    try:
        with zipfile.ZipFile(jar) as z:
            nested = [n for n in z.namelist() if re.match(r"BOOT-INF/lib/astrostudycn-.*\.jar$", n)]
            if not nested:
                record(name, False, "astrostudycn-*.jar not found inside astrostudyboot.jar")
                return
            with zipfile.ZipFile(io.BytesIO(z.read(nested[0]))) as nz:
                blob = nz.read("spacex/astrostudycn/controller/ChartController.class")
        if rv.encode("utf-8") not in blob:
            record(name, False,
                   f"发货 jar 内 ChartController.class 不含 RUNTIME_VERSION '{rv}' —— jar 未按当前源重建。"
                   f"改法：重建 astrostudyboot.jar（horosa-dev skill 的 jar 重建流程）并重新 stage-runtime")
            return
        record(name, True, f"'{rv}' consistent in source + shipped jar (lockstep with {V})")
    except Exception as e:
        record(name, False, f"jar scan failed: {e}")

def check_distfile_not_stale():
    idx = os.path.join(BUNDLE_RUNTIME, "dist-file", "index.html")
    if not os.path.exists(idx):
        record("staged dist-file not stale", False, "bundle dist-file/index.html MISSING")
        return
    idx_m = os.path.getmtime(idx)
    src_m, src_p = newest_mtime(os.path.join(UI, "src"), (".js", ".jsx", ".ts", ".tsx", ".less"), skip_substr=("/.umi/", "/.umi-production/"))
    ok = src_m <= idx_m
    detail = "dist-file newer than astrostudyui/src" if ok else f"STALE: {os.path.relpath(src_p, REPO)} newer than staged dist-file (frontend not rebuilt)"
    record("staged dist-file not stale", ok, detail)


def check_distfile_mirrors_source():
    """horosa_distfile_mirror_gate_v1(2026-08-01 v3.6.1 抓到的存量):发货位的 dist-file
    必须与产品源 dist-file **文件集合逐名相等**。

    病灶:SKILL 的入库步骤是 `cp -rf <src>/. <staged>/` —— 拷贝**不删**目标侧已不存在的旧文件。
    umi 的产物名带内容哈希,于是每轮构建换名后,上一轮的 umi.*.js/chunk 会永久留在发货位:
    ①白发几 MB 死重量(还进差量基线,污染增量口径);②更糟——**旧产物带着旧内容照样发货**,
    v3.6.1 实测发货树里同时躺着新旧两个 umi bundle,而旧的那个正含构建机绝对路径(本轮修的
    泄漏),index.html 根本不引用它,时间戳门也照样绿(它只比 index.html 与源码的新旧)。
    本门直接比文件名集合:发货位多 = 陈旧累积(改法:先 `rm -rf` 发货位 dist-file 再整拷),
    少 = 拷贝不完整。与 `dev-path bake-in scan` 互补(那门抓后果,本门抓成因)。
    """
    name = "staged dist-file mirrors source"
    staged = os.path.join(BUNDLE_RUNTIME, "dist-file")
    source = os.path.join(UI, "dist-file")
    if not os.path.isdir(staged) or not os.path.isdir(source):
        record(name, False, "dist-file dir missing (staged or product-source)")
        return
    def relset(root):
        out = set()
        for base, _dirs, files in os.walk(root):
            for fn in files:
                out.add(os.path.relpath(os.path.join(base, fn), root).replace("\\", "/"))
        return out
    s_set, p_set = relset(staged), relset(source)
    extra, missing = sorted(s_set - p_set), sorted(p_set - s_set)
    if extra or missing:
        bits = []
        if extra:
            bits.append(f"发货位多 {len(extra)} 个陈旧文件(先 rm -rf 再整拷): {', '.join(extra[:4])}")
        if missing:
            bits.append(f"发货位缺 {len(missing)} 个: {', '.join(missing[:4])}")
        record(name, False, "; ".join(bits))
        return
    record(name, True, f"{len(s_set)} files, staged == product-source (no stale accumulation)")

def check_pd_request_builder_complete():
    """horosa_pd_request_parity_gate_v1(2026-08-01 v3.6.1 抓到的 v3.6.0 存量回归)。

    事故:PERF-R8 把 AstroDirectMain 的「主限法请求构造」抽成模块级纯函数(预热与真实首点
    复用同一构造),类方法改为**纯委托**。此后上游 v3.6.0 把主限法大扩容(弧算法 13 法 +
    投影/定局/框架正交解耦 + 平行/急动平行 + 界系变体…),给类方法的返回对象加了 6 个新字段
    —— 而我方那份**复制体没跟上**,于是 Windows 侧每一次主限法请求都悄悄丢掉
    pdProjection/pdFrame/pdFramework/pdParallel/pdRaptParallel/termsVariant:
    用户在工具条上选「方向/盘面宫制/平行/急动/界系」全部**发不出去**(死开关,GitHub issue #59
    的现场截图里正是这排控件)。构建期零告警、umi 不 mount 该页也不炸 —— 与 #79 同族的静默类。

    判据(自洽,不依赖 Mac clone):`requestPrimaryDirectionRows` 里那把请求身份键 reqKey 逐个
    读 `req.X` —— **凡身份键读到的字段,构造器就必须产出**;否则该维度恒 undefined =
    「参数进了 key、却从没进过 body」。反过来也是真门:上游下次再加维度必然先进 reqKey
    (否则同参去重会误判),于是本门在复制体没跟上的那一刻就红。
    """
    name = "PD request builder completeness"
    src_path = os.path.join(UI, "src", "components", "direction", "AstroDirectMain.js")
    if not os.path.exists(src_path):
        record(name, False, "AstroDirectMain.js MISSING at expected path")
        return
    src = read(src_path)
    m = re.search(r"const reqKey = JSON\.stringify\(\{(.*?)\}\);", src, re.S)
    if not m:
        record(name, False, "reqKey 身份键块未找到(上游重构?本门锚点需人工复核)")
        return
    identity = set(re.findall(r"req\.([A-Za-z0-9_]+)", m.group(1)))
    b = re.search(r"function buildPrimaryDirectionRequestPure\(.*?\n\treturn \{(.*?)\n\t\};", src, re.S)
    if not b:
        record(name, False, "buildPrimaryDirectionRequestPure 返回对象未找到")
        return
    # 键可以出现在行首、也可以与前一键同行(上游就有 `zodiacal: …, siderealAyanamsa: …`),
    # 还可以在条件展开 `...(x ? { k: v } : {})` 里 —— 三形态都要认,否则本门自造假阳。
    produced = set(re.findall(r"(?:^\s*|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", b.group(1), re.M))
    missing = sorted(identity - produced)
    if missing:
        record(name, False,
               f"构造器漏产 {len(missing)} 个身份键字段(界面选了发不出去): {', '.join(missing)}。"
               f"改法:对照上游 AstroDirectMain 的 buildPrimaryDirectionRequest 补齐纯函数复制体")
        return
    record(name, True, f"{len(identity)} identity fields all produced by the builder")


def check_source_eol_matches_upstream():
    """horosa_source_eol_upstream_v1(gotcha #95):产品源换行风格必须与纯上游一致。

    病理:本仓 `core.autocrlf = true` ⇒ `git apply`(apply.sh 打 overlay 的首选路径)与
    `git checkout` **写 CRLF**,而 `port_from_mac.py` 是逐字节落盘(LF)。于是
    **凡被 overlay 打过补丁的文件都悄悄变成 CRLF**,与上游逐字节不同 —— 一路无人发现,因为
    `git status` 在 autocrlf 下比归一化内容(恒 clean)、port 的完整性校验也按 #35 做 LF 归一。

    v3.8.0 被上游一个**源码扫描型契约测试**当场抓出:`ziweiCenterPresetD4` 用
    `src.indexOf('\\n\\t}\\n')` 切 `applyDisplayPreset` 方法体 —— CRLF 下恒不命中,切出整个文件
    尾巴,`bumpZwDisplayRev(` 数出 13(期望 1)。修 EOL 后 9/9 全绿。存量一次性纠正 151 个文件。

    为什么必须常设门:上游这类源码扫描断言在持续增加,而 CRLF 化是**每次 patch 都会复发**的
    机械副作用;另外发货载荷拷的是工作区字节,CRLF 让这些文件与上游逐字节不同(差量白churn)。

    判据:「有 CRLF」不算错 —— 上游自己就有一批 CRLF 文件(geomancy/india/xuanshi 等);
    **与上游不一致**才算错。已知豁免 1 个:`comp/EditableTags.js` 上游是 MIXED(手工历史遗留)
    而我方是纯 LF 且内容因 overlay 而不同 —— 无法机械复原逐行混排,且全仓无测试扫描该文件。

    门只在**桥接 clone 存在**时运行(发布机恒有);缺 clone 时记为 SKIP-PASS 并说明,
    绝不因环境缺失而假红。
    """
    name = "source EOL matches upstream (gotcha #95)"
    script = os.path.join(REPO, "windows-adaptations", "normalize_eol_to_upstream.py")
    clone = os.path.join(REPO, "tmp", "mac-sync-2.6.7")
    if not os.path.isfile(script):
        record(name, False, "normalize_eol_to_upstream.py missing")
        return
    if not os.path.isdir(clone):
        record(name, True, "SKIP: bridge clone tmp/mac-sync-2.6.7 absent (EOL check needs upstream bytes)")
        return
    tag = None
    for cand in ("v" + pkg_version(),):
        r = subprocess.run(["git", "-C", clone, "rev-parse", "--verify", cand + "^{commit}"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            tag = cand
            break
    if not tag:
        record(name, True, "SKIP: upstream tag v%s not in the bridge clone" % pkg_version())
        return
    try:
        r = subprocess.run([sys.executable, script, tag],
                           cwd=REPO, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=1800)
    except Exception as e:  # noqa: BLE001
        record(name, False, "EOL check failed to run: %s" % e)
        return
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    diffs = [l.strip() for l in out.splitlines() if "upstream=" in l and "ours=" in l]
    # 已知豁免(上游 MIXED + 我方 overlay 改过 ⇒ 无法机械复原;全仓无测试扫描它)
    EXEMPT = ("astrostudyui/src/components/comp/EditableTags.js",)
    real = [d for d in diffs if not any(e in d for e in EXEMPT)]
    if not real:
        record(name, True, "all product-source files match upstream EOL style (%d exempt)" % len(EXEMPT))
        return
    record(name, False,
           "%d file(s) diverge from upstream EOL — %s%s  (fix: python windows-adaptations/"
           "normalize_eol_to_upstream.py %s --fix)"
           % (len(real), "; ".join(real[:4]),
              "" if len(real) <= 4 else " ... (+%d more)" % (len(real) - 4), tag))


def check_overlay_marker_inventory():
    """horosa_marker_inventory_gate_v1(gotcha #94):overlay marker 的**逐文件逐次数**总账。

    为什么哨兵门不够:`check_sentinels` 是「该 marker 在全仓至少出现一次」的字符串门。
    v3.8.0 同步实发的两条静默丢失,它一条都测不出 —— 而两条都以「装得上、点了就炸 /
    功能悄悄退化」收场:

    ① **守卫被上游收编 ⇒ 整个补丁静默跳过。** Mac 把我方接线收编进 ZiWeiMain.js /
       DunJiaMain.js,两文件遂自带 `horosa_prefetch_registry_v1` —— 而那正是 apply.sh 里
       这两条补丁的守卫。守卫命中 ⇒ apply.sh 打印 `[ok] already has …` ⇒ 补丁整体跳过 ⇒
       ZiWeiMain 少掉 freeze_subtabs×3 + panel_ready×6 + ziwei_state_slice×2 共 11 处。
       哨兵门全绿,因为 freeze_subtabs / panel_ready 在**另外 30 多个宿主**里还在。
    ② **局部应用 / fuzz 贴错位。** 部分 hunk 被拒而守卫那个 hunk 成功 ⇒ marker 在、用法在、
       绑定没有(#84 型 ReferenceError,本轮 ZiWeiInput 真中);或 patch 用 fuzz 把 hunk 贴进
       别的方法 / 贴出双份(#78 编译级炸弹,本轮 SanShi 真中,把暗干角标塞进 <Tabs> 属性区)。

    逐文件逐次数的总账把三种都变成机械 diff:LOSS(少了)/ DUP(多了)。
    总账文件 `windows-adaptations/MARKER_INVENTORY.json` 随 overlay 一起 tracked;
    刷新只能在人工复核 diff 之后跑 `gen_marker_inventory.py`(盲刷 = 把事故钉成新基线)。

    负向自证(v3.8.0 轮实做,两向):用纯上游覆盖 ZiWeiMain.js → 精确报 3 个 marker 共 11 处
    LOSS;把一行 marker 复制一份 → 报 DUP 2->3;还原 → OK 100 markers / 600 sites。
    """
    name = "overlay marker inventory (gotcha #94)"
    gen = os.path.join(REPO, "windows-adaptations", "gen_marker_inventory.py")
    if not os.path.isfile(gen):
        record(name, False, "gen_marker_inventory.py missing — the inventory gate cannot run")
        return
    try:
        r = subprocess.run([sys.executable, gen, "--check"],
                           cwd=REPO, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=900)
    except Exception as e:  # noqa: BLE001
        record(name, False, "inventory check failed to run: %s" % e)
        return
    out = ((r.stdout or "") + (r.stderr or "")).strip()
    if r.returncode == 0:
        record(name, True, out.splitlines()[-1] if out else "exact match")
        return
    drift = [l.strip() for l in out.splitlines() if l.strip().startswith(("[LOSS]", "[DUP "))]
    head = "; ".join(drift[:6]) or out[:400]
    record(name, False,
           "%d marker site(s) drifted — %s%s"
           % (len(drift), head, "" if len(drift) <= 6 else " ... (+%d more)" % (len(drift) - 6)))


def check_frontend_symbol_binding():
    """horosa_symbol_binding_gate_v1(issue #51 制度化):前端「utils 符号引用必有绑定」。

    事故类(v3.5.1 实发):同步/收敛把组件的 import 行删了、调用块留下 —— webpack 对自由
    标识符构建期零告警,umi 测试不 mount 该组件也不炸,发货后用户一开该页 ReferenceError
    白屏(遁甲/太乙/印占三页全灭,issue #51);更险的一环:overlay 补丁对着半删状态 regen,
    round-trip 把坏状态定格成"真理"。本门 = node + @babel/parser/traverse(取 astrostudyui
    自己的 node_modules,零新依赖)真作用域分析:任何文件裸引用 utils 导出符号而无
    import/解构/参数/本地声明绑定 → 列 file:line:symbol 即红。负向自证:对半删状态精确
    抓出 6 条违规(印占 3/遁甲 2/太乙 1)与事故一一对应。
    """
    name = "frontend utils symbol binding"
    script = os.path.join(SCRIPT_DIR, "check-symbol-binding.cjs")
    if not os.path.exists(script):
        record(name, False, "check-symbol-binding.cjs MISSING from scripts/")
        return
    try:
        r = subprocess.run(["node", script, os.path.join(WS, "astrostudyui")],
                           capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=300)
        if r.returncode == 0:
            record(name, True, (r.stdout or "").strip().splitlines()[-1] if r.stdout else "clean")
        else:
            tail = ((r.stderr or "") + (r.stdout or "")).strip().splitlines()
            record(name, False, "; ".join(tail[:6]) or f"exit {r.returncode}")
    except Exception as e:
        record(name, False, f"gate runner failed: {e}")

def check_zoom_domain_chain():
    """horosa_zoom_domain_chain_v1(镜像上游 preflight [220],7 项判据抄全 —— #92)。

    病理(上游 v3.9.5 根治):桌面壳缩放走 `documentElement.style.zoom`,页面因此有两个坐标域 ——
    rect 域(`getBoundingClientRect`,已被 zoom 缩放)与 CSS 域(`style.left/top`,未被缩放)。
    `dom-align@1.12.4` 的 `setLeftTop()` 把 rect 域位移直写 CSS 域 ⇒ **z≠1 时全站 antd 浮层
    (下拉/提示/气泡/日期面板,900+ 使用点)系统性错位**;z=1 时两项归零,所以默认档一直正常,
    只在非默认缩放档暴露。**Windows 侧风险更高**:壳层缩放 + 系统显示缩放都常用。

    修法四件、缺一即等于没修,故七项逐条钉:
      ① `src/utils/zoomDomain.js` 与 `scripts/patch-dom-align-zoom.js` 在,且前者导出四个函数;
      ② `node_modules/dom-align` 的 **dist-node 与 dist-web 两份产物都打了补丁**
         (jest 走 dist-node、webpack 走 dist-web —— 只打一份 = 「测的不是跑的」),
         且每份的两处写回补偿**各恰 1 处**(防半修);
      ③ dom-align 版本必须仍是 **1.12.4**(补丁锚点按它核对过;升级后必须重审锚点再放行);
      ④ `package.json` 的 build / build:file / postinstall **三处都挂载**该补丁
         —— Windows 侧此处由 `package.name-scripts.json` 承载,另有 `check_build_chain_parity` 专门看着;
      ⑤ `src/global.js` 调用 `installAlignHooks()`(钩子不装则补丁全程回落 1,等于没修);
      ⑥ 发货前端产物 `dist-file` 内必须出现 `__HOROSA_ALIGN_SCALE__`
         —— **这一项最关键:它证明「打包用的前端确实是补丁版」**,前五项都对而这项错,
         装到用户机上浮层照旧错位;
      ⑦ 两个守卫套件在位(`popupAlignZoomGuard` / `popupAlignStaticGuard`)。
    全部输入 = 仓库内文件 ⇒ 永不 SKIP(dist-file 尚未构建时该项按「未构建」跳过并说明,不假红)。
    """
    name = "CSS-zoom domain chain [220]"
    ui = UI
    bad = []
    zd = os.path.join(ui, "src", "utils", "zoomDomain.js")
    patch = os.path.join(ui, "scripts", "patch-dom-align-zoom.js")
    for p, label in ((zd, "zoomDomain.js"), (patch, "patch-dom-align-zoom.js")):
        if not os.path.isfile(p):
            bad.append(f"① 缺失 {label} —— 缩放域换算链断")
    if os.path.isfile(zd):
        src = read(zd)
        for fn in ("getEffectiveScale", "getFixedScale", "clientToFixed", "installAlignHooks"):
            if f"export function {fn}" not in src:
                bad.append(f"① zoomDomain 缺导出 {fn}")

    nm = os.path.join(ui, "node_modules", "dom-align")
    for d in ("dist-node", "dist-web"):
        f = os.path.join(nm, d, "index.js")
        if not os.path.isfile(f):
            bad.append(f"② dom-align/{d}/index.js 缺失(npm install 未跑?)")
            continue
        s = read(f)
        # v3.11.0:补丁升 v3(body overflow:hidden 分支的「文档尺寸」读数换到 rect 域)。postinstall 只在 npm install
        # 触发、不回溯已装产物(#102「挂上了≠跑过了」)⇒ 这里必须钉**当前版本**的标记,而不是「打过任一版」:
        # 带 v2 标记的产物照样能过「打过补丁」的粗判,但缩放档下拉的文档尺寸读数仍是错的。上游 [220] 同样钉 v3。
        if "horosa:dom-align-zoom v3" not in s:
            bad.append(f"② dom-align/{d} 未打 v3 补丁(缺 `horosa:dom-align-zoom v3` 标记;v1/v2 旧标记 = 半修)—— 先手工跑一次 "
                       f"`node scripts/patch-dom-align-zoom.js` 再打包;该份产物的浮层在缩放档全歪"
                       f"(测试走 dist-node、打包走 dist-web,两份都要打)")
        # 与上游 [220] 同口径:两处写回补偿各恰 1 处。
        # (`_off = _off / __hz` 不包含 `off = off / __hz` —— 中间隔着下划线,不会互相计数。)
        n1 = s.count("off = off / __hz")
        n2 = s.count("_off = _off / __hz")
        if n1 != 1 or n2 != 1:
            bad.append(f"② dom-align/{d} 写回补偿数异常(off={n1} 应 1, _off={n2} 应 1)—— 半修")
    pj = os.path.join(nm, "package.json")
    if os.path.isfile(pj):
        try:
            ver = json.loads(read(pj)).get("version")
        except Exception:
            ver = "?"
        if ver != "1.12.4":
            bad.append(f"③ dom-align 版本变为 {ver}(锚点按 1.12.4 核对过)—— 升级后必须重审补丁锚点再放行")

    pkg = os.path.join(ui, "package.json")
    if os.path.isfile(pkg):
        try:
            sc = json.loads(read(pkg)).get("scripts", {}) or {}
        except Exception:
            sc = {}
        for k in ("postinstall", "build", "build:file"):
            if "patch-dom-align-zoom" not in (sc.get(k) or ""):
                bad.append(f"④ package.json 的 {k} 未挂 patch-dom-align-zoom —— 构建产物会退回未补丁的 dom-align")

    g = os.path.join(ui, "src", "global.js")
    if os.path.isfile(g):
        body = re.sub(r"(?m)//.*$", "", read(g))
        if "installAlignHooks()" not in body:
            bad.append("⑤ global.js 未调用 installAlignHooks() —— 钩子不装则补丁全程回落 1,等于没修")

    df = os.path.join(ui, "dist-file")
    df_note = ""
    if os.path.isdir(df):
        hit = False
        for root, _dirs, files in os.walk(df):
            for fn in files:
                if not fn.endswith((".js", ".html")):
                    continue
                try:
                    if "__HOROSA_ALIGN_SCALE__" in open(os.path.join(root, fn), encoding="utf-8",
                                                       errors="replace").read():
                        hit = True
                        break
                except OSError:
                    pass
            if hit:
                break
        if not hit:
            bad.append("⑥ dist-file 产物内找不到 __HOROSA_ALIGN_SCALE__ —— "
                       "打包用的前端是未补丁版本,装到机器上浮层照旧错位")
    else:
        df_note = "(dist-file 尚未构建,⑥ 跳过)"

    for t in ("popupAlignZoomGuard", "popupAlignStaticGuard"):
        if not os.path.isfile(os.path.join(ui, "src", "utils", "__tests__", f"{t}.test.js")):
            bad.append(f"⑦ 守卫套件 {t}.test.js 缺失")

    ok = not bad
    record(name, ok,
           (f"zoomDomain 四导出 / dom-align 双产物已补丁(1.12.4)/ 三处挂载 / global 钩子 / "
            f"dist-file 含运行时钩子 / 两守卫套件 全在 {df_note}".strip()
            if ok else "; ".join(bad[:5])))


def check_build_chain_parity():
    """horosa_build_chain_parity_v1(gotcha #102):我方 scripts 覆盖块必须**涵盖上游的每个构建步骤**。

    这一类已实撞三次,形态完全一致 —— apply.sh §3 用
    `windows-adaptations/files/astrostudyui/package.name-scripts.json` **整块替换** `pkg.scripts`
    (因为 Windows 没有 `export VAR=… &&` 这种 POSIX 前缀写法,我方走 `node scripts/umi-runner.js`),
    于是**上游任何新增的构建链步骤都会被这块覆盖悄悄吃掉**:
      · #83:上游把 `check-chunk-dup.js` 与 `inject-preload.js` 编进 build 链 ⇒ Windows 侧一直缺席;
      · #86:同族再犯;
      · v3.9.5:上游新增 `patch-dom-align-zoom.js`(挂 build / build:file / postinstall 三处)——
        它 patch `node_modules/dom-align`,不跑就等于「缩放档全站浮层错位」这个修**在 Windows 不存在**。
        **同一次排查还顺带发现 `patch_quill_domnodeinserted.js` 从来没进过我方 postinstall**
        (上游至少自 v3.9.4 起就挂着它;我方块零命中 ⇒ quill 的 DOMNodeInserted 监听自首装起原封未动)。
    共同特征:**构建期零告警**(脚本没被调用而已)、**产物看起来正常**、只有用户在非默认档才踩到。

    本门分两半:前半判**接线**(上游步骤有没有进我方块),后半判**效果**(那一步到底跑没跑过)——
    因为 postinstall 只在 `npm install` 时触发,补进覆盖块不会回溯已装的 node_modules,
    否则会出现「门全绿、发货产物仍是未打补丁版」。

    判据(刻意只做「上游 ⊆ 我方」这一个方向,零假阳):
      对 build / build:file / postinstall 三个键,抽出上游 `package.json` 里引用的每个
      `scripts/<name>.js`,逐个断言我方覆盖块的**同名键**里也引用了它。
      我方多出的步骤(umi-runner)不报 —— 那是 Windows 形态差异,不是缺失。
      上游用的非脚本命令(`umi build` / `umi generate tmp`)不参与比对,它们由 umi-runner 承载。

    门只在**桥接 clone 存在**时运行(发布机恒有);缺 clone 记 SKIP-PASS,绝不因环境缺失假红。
    判据自检(#71):上游三个键里抽不到任何脚本 = 抽取失效,直接 FAIL,不许静默放行。
    """
    name = "build-chain parity vs upstream (gotcha #102)"
    win_p = os.path.join(REPO, "windows-adaptations", "files", "astrostudyui", "package.name-scripts.json")
    clone = os.path.join(REPO, "tmp", "mac-sync-2.6.7")
    if not os.path.isfile(win_p):
        record(name, False, "windows-adaptations/files/astrostudyui/package.name-scripts.json missing")
        return
    if not os.path.isdir(clone):
        record(name, True, "SKIP: bridge clone tmp/mac-sync-2.6.7 absent (parity needs upstream package.json)")
        return
    tag = "v" + pkg_version()
    r = subprocess.run(["git", "-C", clone, "show", f"{tag}:Horosa-Web/astrostudyui/package.json"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        record(name, True, f"SKIP: upstream tag {tag} not in bridge clone yet")
        return
    try:
        up = json.loads(r.stdout).get("scripts", {}) or {}
        win = json.load(open(win_p, encoding="utf-8")).get("scripts", {}) or {}
    except Exception as e:
        record(name, False, f"cannot parse package scripts: {e}")
        return

    KEYS = ("build", "build:file", "postinstall")
    step_re = re.compile(r"scripts/([A-Za-z0-9_.\-]+\.js)")
    missing, total_up = [], 0
    for k in KEYS:
        up_steps = set(step_re.findall(up.get(k, "") or ""))
        win_steps = set(step_re.findall(win.get(k, "") or ""))
        total_up += len(up_steps)
        for s in sorted(up_steps - win_steps):
            missing.append(f"{k} 缺 scripts/{s}")
    if total_up == 0:
        record(name, False, "判据失效(#71):上游 build/build:file/postinstall 里抽不到任何 scripts/*.js —— "
                            "上游改了写法?先核对抽取正则再放行,不许静默 PASS")
        return
    if missing:
        record(name, False,
               "; ".join(missing[:6]) + " —— 上游新增的构建步骤没进我方 scripts 覆盖块,"
                                        "该步骤在 Windows 侧会静默缺席(gotcha #102)")
        return

    # ---- 后半:「挂上了」≠「跑过了」(gotcha #102 课一补课) ---------------------
    # postinstall 只在 `npm install` 时触发。把缺失的步骤补进覆盖块**不会**回溯修改已经
    # 躺在 node_modules 里的那份代码 —— 于是会出现「门全绿、发货产物却仍是未打补丁版」。
    # 本轮实撞:补完 postinstall 后 quill 三个目标里的 DOMNodeInserted 仍在,必须手工跑一次
    # `node scripts/patch_quill_domnodeinserted.js` 才真正落地(dom-align 那一路由
    # check_zoom_domain_chain 的产物项把关,此处只补 quill 这一路)。
    # 判据取**效果面**而不是步骤面:三个目标文件里 `DOMNodeInserted` 必须一个不剩。
    # node_modules 缺席(纯 checkout)= SKIP,绝不因环境缺失假红。
    ui = os.path.join(WS, "astrostudyui")
    quill_targets = [os.path.join(ui, "node_modules", "quill", *p) for p in
                     (("blots", "scroll.js"), ("dist", "quill.js"), ("dist", "quill.core.js"))]
    present = [p for p in quill_targets if os.path.isfile(p)]
    if not present:
        record(name, True, f"upstream {total_up} build steps all present; "
                           f"quill effect check SKIPPED (node_modules/quill absent)")
        return
    dirty = []
    for p in present:
        try:
            n = open(p, encoding="utf-8", errors="replace").read().count("DOMNodeInserted")
        except Exception as e:
            dirty.append(f"{os.path.basename(p)} unreadable: {e}")
            continue
        if n:
            dirty.append(f"{os.path.basename(p)}×{n}")
    record(name, not dirty,
           (f"upstream {total_up} build steps across {len(KEYS)} keys all present in the Windows block; "
            f"quill effect verified clean in {len(present)}/3 targets"
            if not dirty else
            "步骤已挂但**没跑过**:node_modules/quill 仍带 DOMNodeInserted(" + ", ".join(dirty) + ")—— "
            "postinstall 不会回溯已装的包,先手工跑一次 "
            "`node scripts/patch_quill_domnodeinserted.js` 再打包(gotcha #102 课一)"))


def check_frontend_no_undef():
    """horosa_no_undef_gate_v1(issue #65/#68 制度化,gotcha #98):前端「不得有未声明标识符」。

    事故(线上,连发两版没人发现):三式页自 v3.8.0 起一打开就白屏 —— 主类 `render()` 里
    32 处 `opt.` 而该作用域**没有 `opt`**(我方渲染切片把左栏收编进子组件后,上游 v3.8.0
    新增的 24 个控件在同步时落进了错误宿主,声明留在了子组件里)。

    **为什么既有的门一个都没拦住**(这条最值得记):
      · `check_frontend_symbol_binding` 只在「引用了某个 **utils 导出名** 却没 import」时报 ——
        `opt` 不是任何 utils 的导出,**根本不在它的候选集里**;
      · 哨兵/marker/五层契约查「我方改动在不在」,不查代码能不能跑;
      · umi/jest 只有**被 mount 过**的组件才会执行到那一行 —— 该目录当时 6 个测试文件、
        没有一个渲染过这个组件;
      · `npm run build:file` 编译通过 —— 未声明变量语法完全合法,只在运行时炸;
      · 金标/pytest 是后端口径,与前端 ReferenceError 无关。
    所以补的是**作用域分析**这一维:任何文件里「被引用但在本文件任何作用域都无绑定」的标识符,
    减去真实全局量与文件级受限注入量(见脚本内 KNOWN_GLOBALS / SCOPED_GLOBALS),一律红。
    与 symbol-binding 门**互补不重叠**:那门管「utils 符号漏 import」,本门管「任何未声明」。
    负向自证(两向):删掉 SanShiUnitedMain 的 `const opt` → 精确报出 file:line:opt;还原即绿。
    """
    name = "frontend no-undef (scope analysis)"
    script = os.path.join(SCRIPT_DIR, "check-no-undef.cjs")
    if not os.path.exists(script):
        record(name, False, "check-no-undef.cjs MISSING from scripts/ (gotcha #98 的常设拦截点)")
        return
    try:
        r = subprocess.run(["node", script, os.path.join(WS, "astrostudyui")],
                           capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=600)
        if r.returncode == 0:
            record(name, True, (r.stdout or "").strip().splitlines()[-1] if r.stdout else "clean")
        else:
            tail = ((r.stderr or "") + (r.stdout or "")).strip().splitlines()
            record(name, False, "; ".join(tail[:6]) or f"exit {r.returncode}")
    except Exception as e:
        record(name, False, f"gate runner failed: {e}")


def check_frontend_this_member_binding():
    """horosa_this_member_binding_gate_v1(v3.11.0 制度化,gotcha #104):前端「类体内 this.x( 必须在本类可解」。

    事故(本轮,dist:win 前抓获):我方把三式合一主类的左栏切成子组件 SanShiInputPanel(处理器经 props 进入);
    上游 v3.11.0 往左栏新落太乙「盘式/古法公式/时间基准」三控件,hunk 打进了切片子组件却带着上游主类的
    `onChange={(v)=>this.onOptionChange('taiyiStyle', v)}` 形 —— 子组件根本没有 onOptionChange,用户一点即
    `TypeError: this.onOptionChange is not a function`。**为什么既有的门一个都没拦住**:
      · symbol-binding / no-undef 只看**自由标识符**,`this.x` 是 MemberExpression 属性,天然不在它们的维度;
      · 渲染冒烟只 render 不点;上游源码扫描测钉的正是错误的那个形(在上游主类里它是对的);
      · build 通过、umi 全绿、五层契约全绿 —— #98 的「维度缺失」再来一次,这次缺的是「成员可解」。
    本门对每个 class 做成员可解分析(本类方法/属性 ∪ 类体内 this.x= 赋值 ∪ React API ∪ 同文件父类链),
    判类体内经箭头/类方法可达的 `this.x(` 调用;被 `if(this.x)`/`typeof this.x==='function'`/`this.x &&` 自检守着的
    可选钩子豁免(PDSphereEngine.onPickPoint 即此型);父类不在本文件 ⇒ 跳过不判(未知面,宁缺毋滥)。
    负向自证:把三控件改回 `this.onOptionChange` 形的临时副本 → 精确报出 3 处 file:line;真树 0。

    **v2(v3.11.0 覆盖补丁,issue #83,gotcha #105)**:线上大六壬打不开 —— 同一事故类换了个形:上游「时间算法」控件 hunk
    落进切片子组件 LiuRengInputPanel,写法 `value={this.state.timeAlg} onChange={this.onTimeAlgChange}`;v1 只查「调用」,
    这里是 **读 this.state.x**(子组件 this.state 恒 null ⇒ 首屏 render 即炸)与 **this.x 作值引用**,两维都不在 v1 里。
    v2 补全三维:A `this.x(` 调用(所有父类可知的类)/ B `this.x` 值引用(只判 React 组件类;非 React 工具类字段由宿主外部注入)/
    C `this.state` **解引用**(`this.state.x` / 解构 / 展开;身份比较 `nextState !== this.state` 不算)且该类从未初始化 state。
    守卫探针本身(`typeof this.onPickPoint === 'function'` 里那次引用)与可选链 `this.x?.()` 不判。
    负向自证:未修的 LiuRengMain 副本 → 精确 2 处([state] + [value] 同一行);真树 381 个 React 类 0 违规。
    """
    name = "frontend this-member binding (class scope)"
    script = os.path.join(SCRIPT_DIR, "check-this-member-binding.cjs")
    if not os.path.exists(script):
        record(name, False, "check-this-member-binding.cjs MISSING from scripts/ (gotcha #104 的常设拦截点)")
        return
    try:
        r = subprocess.run(["node", script, os.path.join(WS, "astrostudyui")],
                           capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=600)
        if r.returncode == 0:
            record(name, True, (r.stdout or "").strip().splitlines()[-1] if r.stdout else "clean")
        else:
            tail = ((r.stderr or "") + (r.stdout or "")).strip().splitlines()
            record(name, False, "; ".join(tail[:6]) or f"exit {r.returncode}")
    except Exception as e:
        record(name, False, f"gate runner failed: {e}")


def check_chart_theme_follow_census():
    """horosa_chart_theme_follow_census_v1(v3.11.1,镜像上游 preflight [262] 的源码普查 —— 判据形状逐条同文):

    上游 v3.11.1「盘面随界面主题重画」:调色板(AstroConst.AstroColor,烘焙进 SVG/canvas)只许在 utils/appearance.js 切,顺序
    调色板 → 根属性 → 广播;每个「宿主组件」(挂 svg/canvas 命令式 draw 的类组件)在 componentDidMount 经 chartDrawGuard.watchChartAppearance
    单源订阅重画。本门 = 上游 [262] 的 python 普查逐字移植(HOST_RE 与 jest chartThemeFollow.contract 同文;豁免表同源):
      ① components/ 下凡 componentDidMount|useEffect( 且命中 HOST_RE 的文件必含 watchChartAppearance((豁免须带理由针且理由仍成立);
      ② 零私自 MutationObserver 观察 data-horosa-appearance;③ setColorTheme( 只在 utils/appearance.js / constants/AstroConst.js;
      ④ layouts/app.js 与 pages/index.js 只调 syncChartPalette(resolvedAppearance);⑤ applyAppearanceToDocument 顺序不变量;
      ⑥ 主题钮审计锚;⑦ 宿主普查数 ≥ 15(判据失效/目录被挪即红)。
    Windows 意义:我方渗染切片/overlay 若把 draw 宿主搬进新文件、或补丁把 AstroColor 读进模块级常量,上游 jest 会红,本门在 dist:win 末尾先拦。
    """
    name = "chart theme-follow census (hosts wired / palette single-source) [262]"
    import re as _re
    src = os.path.join(UI, "src")
    comp = os.path.join(src, "components")
    HOST_RE = _re.compile(r"AstroColor\.|d3\.select\(|getContext\('2d'\)|new [A-Z]\w*Chart\(|new FengShuiEngine\(")
    ALLOW = {
        "components/lrzhan/LiuRengMain.js": "owner: null",
        "components/sanshi/SanShiUnitedMain.js": "owner: null",
        "components/xuanshi/XuanShiPersons.js": "var(--horosa",
        "components/fengshui/FengShuiMain.js": "new FengShuiEngine(canvas",
    }
    def _read(p):
        try:
            return read(p)
        except Exception:
            return ""
    problems = []
    hosts = 0
    for root, dirs, files in os.walk(comp):
        dirs[:] = [d for d in dirs if d != "__tests__"]
        for fn in files:
            if not fn.endswith(".js"):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, src).replace(os.sep, "/")
            s = _read(p)
            if _re.search(r"attributeFilter:\s*\[[^\]]*data-horosa-appearance", s):
                problems.append("私自观察外观属性:" + rel)
            if ("componentDidMount" in s or "useEffect(" in s) and HOST_RE.search(s):
                hosts += 1
                if "watchChartAppearance(" in s:
                    continue
                if rel in ALLOW:
                    if ALLOW[rel] not in s:
                        problems.append("豁免理由已不成立:" + rel)
                    continue
                problems.append("宿主未挂 watchChartAppearance(:" + rel)
    for rel in ALLOW:
        p = os.path.join(src, rel)
        if os.path.isfile(p) and "watchChartAppearance(" in _read(p):
            problems.append("已接线却仍在豁免表:" + rel)
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in ("__tests__", ".umi", ".umi-production")]
        for fn in files:
            if not fn.endswith(".js"):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, src).replace(os.sep, "/")
            if rel in ("utils/appearance.js", "constants/AstroConst.js"):
                continue
            if "setColorTheme(" in _read(p):
                problems.append("调色板在单源之外被切:" + rel)
    for rel in ("layouts/app.js", "pages/index.js"):
        if "syncChartPalette(resolvedAppearance)" not in _read(os.path.join(src, rel)):
            problems.append("render 站点不再同步调色板:" + rel)
    ap = _read(os.path.join(src, "utils", "appearance.js"))
    i1 = ap.find("syncChartPalette(actual)")
    i2 = ap.find("setAttribute('data-horosa-appearance'")
    i3 = ap.find("dispatchEvent(new CustomEvent(APPEARANCE_APPLIED_EVENT")
    if not (0 <= i1 < i2 < i3):
        problems.append("applyAppearanceToDocument 顺序不再是 调色板 → 根属性 → 广播")
    if 'data-appearance-toggle="1"' not in _read(os.path.join(src, "components", "homepage", "PageHeader.js")):
        problems.append("主题钮审计锚缺失")
    if hosts < 15:
        problems.append("宿主普查只数到 %d 个(判据失效或目录被挪)" % hosts)
    if problems:
        record(name, False, "; ".join(problems)[:600])
    else:
        record(name, True, f"{hosts} hosts wired (or exempt with live reason); palette switched only in utils/appearance.js; order palette→attr→broadcast")


def check_new_chart_seeds_wiring():
    """horosa_new_chart_seeds_wiring_v1(v3.11.1,镜像上游 preflight [261]):随盘键「新盘种子」单源件 + 模型/还原接线 + 亲手改动入口 + 存储键登记。

    上游 v3.11.1:黄道/宫制/时间算法/八字长生·神煞/宿法/印占/主限法口径的「新命盘缺省 = 上次亲手设的值」,单源 utils/newChartSeeds.js;
    models/astro newEmptyFields 读种子(≥16 键)+ 展开 schema 外种子;recordFieldsRestore 载入记录复位种子键 / 捕获按内建默认;
    九处亲手改动入口记种子。Windows 相交面:AstroChartMain / BaZi / ZiWeiMain / SanShiUnitedMain / IndiaChartMain / AstroDirectMain /
    PageHeader / index.js / models 全是 overlay 目标 —— 上游 hunk 若被我方切片挤掉(#84/#86 同型「用法在绑定没有」或整段丢),这里逐条红。
    """
    name = "new-chart-seeds wiring (single source / model+restore / 9 entry points) [261]"
    src = os.path.join(UI, "src")
    bad = []
    for rel in ("utils/newChartSeeds.js", "utils/__tests__/newChartSeeds.test.js"):
        if not os.path.exists(os.path.join(src, rel)):
            bad.append("资产缺失:" + rel)
    def _has(rel, needle):
        p = os.path.join(src, rel)
        return os.path.exists(p) and needle in read(p)
    if not _has("models/astro.js", "...newChartSeedExtraEntries(),"):
        bad.append("newEmptyFields 不再展开种子")
    try:
        n = read(os.path.join(src, "models/astro.js")).count("value: newChartSeedValue('")
    except Exception:
        n = 0
    if n < 16:
        bad.append(f"newEmptyFields 读种子的键少于 16(现 {n})")
    for rel, needle in (
        ("utils/recordFieldsRestore.js", "fields = resetNewChartSeedKeysToInternalDefaults(fields);"),
        ("utils/recordFieldsRestore.js", "isNewChartSeedKey(key) ? newChartSeedInternalDefault(key)"),
        ("pages/index.js", "seedNewCharts"),
        ("components/astro/AstroChartMain.js", "if(this.props.seedNewCharts){ recordNewChartSeeds(patch); }"),
        ("components/cntradition/BaZi.js", "recordNewChartSeeds("),
        ("components/ziwei/ZiWeiMain.js", "!this.props.techniqueScope && patch.timeAlg !== undefined"),
        ("components/sanshi/SanShiUnitedMain.js", "if(this.usesSavedSettings()){ recordNewChartSeeds("),
        ("components/suzhan/SuZhanInput.js", "recordNewChartSeeds({ doubingSu28: val });"),
        ("components/astro/IndiaChartMain.js", "recordNewChartSeeds(patch);"),
        ("components/direction/AstroDirectMain.js", "pdMethod, pdTimeKey, pdtype: opt.pdtype === 1 ? 1 : 0,"),
        ("components/homepage/PageHeader.js", "时间算法（新命盘的缺省）"),
        ("utils/storageKeyRegistry.js", "'horosa.chart.newChartSeeds.v1'"),
    ):
        if not _has(rel, needle):
            bad.append(f"入口/接线缺失:{rel}:{needle[:40]}")
    # 每个记种子的宿主文件必须真的 import 了单源件(#84/#86 「用法在、绑定没有」的直接判据)
    for rel in ("components/astro/AstroChartMain.js", "components/cntradition/BaZi.js", "components/ziwei/ZiWeiMain.js",
                "components/sanshi/SanShiUnitedMain.js", "components/suzhan/SuZhanInput.js", "components/astro/IndiaChartMain.js",
                "components/direction/AstroDirectMain.js", "components/homepage/PageHeader.js", "models/astro.js", "models/app.js",
                "utils/recordFieldsRestore.js"):
        if not _has(rel, "/newChartSeeds'"):
            bad.append("用法在而 import 缺:" + rel)
    if bad:
        record(name, False, "; ".join(bad)[:600])
    else:
        record(name, True, f"single source + model({n} seeded keys) + restore + 9 entry points + storage key; imports present in 11 consumers")


def check_technique_open_smoke_jsdom():
    """horosa_technique_open_smoke_v1(v3.11.0 覆盖补丁制度化,issue #83,gotcha #105):全技法「打开就不能炸」首屏挂载冒烟。

    事故:v3.11.0 线上大六壬一打开即「该面板加载出错 · TypeError: Cannot read properties of null (reading 'timeAlg')」。
    44 门 selfcheck / umi 12,991 例 / 敌意冒烟 / MCP 真机冒烟全绿 —— 因为**全仓没有任何用例 mount 过技法主面板**
    (引用 LiuRengMain 的 15 个测试文件全是无头 builder;三式 #65/#68 与六壬 #83 两次线上事故是同一个洞)。
    本门跑 `src/pages/__tests__/techniqueOpenSmoke.test.js`(overlay 落地的 Windows-ahead 用例):从 pages/index.js 现读顶层
    `<TabPane key>` 面板表与 lazy/静态 import 映射(上游新增技法页自动入覆盖面;数量下限 30 钉死防「解析失效=空集假绿」),
    逐页在 jsdom 里 ReactDOM 真挂载(含 React.lazy 子块 / componentDidMount / 首轮 setState),断言边界零异常、window 零未捕获、
    首屏无技法错误边界回退卡片。负向自证:换回未修的 LiuRengMain 副本 → 精确红在 liureng,报同一 TypeError。
    与 check-this-member-binding(静态成员可解)/ check-no-undef(自由标识符)互补:它们看形,本门看「真的渲染一遍会不会炸」。
    """
    name = "technique first-render mount smoke (jsdom, every top-level pane)"
    import re as _re
    test_rel = "src/pages/__tests__/techniqueOpenSmoke.test.js"
    if not os.path.exists(os.path.join(UI, test_rel)):
        record(name, False, f"{test_rel} MISSING(overlay 未落地?apply.sh 的 cp 行 / windows-adaptations/files 是否在)")
        return
    runner = os.path.join(UI, "node_modules", ".bin", "umi-test.cmd" if os.name == "nt" else "umi-test")
    if not os.path.exists(runner):
        record(name, False, "umi-test 未安装(astrostudyui/node_modules/.bin)")
        return
    cmd = ["cmd.exe", "/d", "/c", runner, test_rel] if os.name == "nt" else [runner, test_rel]
    try:
        r = subprocess.run(cmd, cwd=UI, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1200)
    except Exception as e:
        record(name, False, f"gate runner failed: {e}")
        return
    out = (r.stdout or "") + (r.stderr or "")
    m = _re.search(r"^Tests:\s+(.+)$", out, _re.MULTILINE)
    tests_line = m.group(1).strip() if m else "(no jest summary)"
    mp = _re.search(r"(\d+) passed", tests_line)
    passed = int(mp.group(1)) if mp else 0
    failed = "failed" in tests_line
    # 30 个技法页 + 1 条面板表完整性用例 = 31;少于此数 = 面板表解析退化或用例被裁
    ok = r.returncode == 0 and not failed and passed >= 31
    if ok:
        record(name, True, f"Tests: {tests_line}")
    else:
        fails = [ln.strip() for ln in out.splitlines() if ln.strip().startswith("✕") or "● " in ln][:8]
        record(name, False, f"exit={r.returncode} Tests: {tests_line}; " + "; ".join(fails))


def check_technique_open_smoke_evidence(V):
    """horosa_technique_open_live_smoke_v1(v3.11.0 覆盖补丁制度化,issue #83):打包版真机「全技法逐页打开」证据门。

    `scripts/verify_technique_open_smoke.cjs` 用发货产物(release/win-unpacked/Horosa.exe)在隔离档案里真启动,经真实用户路径
    (头部技法按钮 → 导航模态)逐页打开每个顶层技法,断言无 pageerror / 无 React 错误日志 / 无回退卡片 / 头部文本==目标;
    产出 release/technique-open-smoke.json。本门核:证据 pass、failed==0、opened>=26、**app.asar 与 Setup exe 的 sha256 与
    当前发货产物逐字相同**(证据必须就是这份产物的,重建即失效)。阴性自证:对 v3.11.0 首发产物跑 → liureng 精确 FAIL(回退卡片)。
    安装器未构建时 SKIP;构建后未跑 = 发版前置项 FAIL(与 perf-baseline 证据门同一纪律)。
    """
    name = "technique open live smoke evidence (packaged app, every technique)"
    import json as _json
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    asar = os.path.join(rel, "win-unpacked", "resources", "app.asar")
    ev_path = os.path.join(rel, "technique-open-smoke.json")
    if not os.path.exists(exe) or not os.path.exists(asar):
        record(name, True, "SKIPPED (installer/win-unpacked not built yet)")
        return
    if not os.path.exists(ev_path):
        record(name, False, "release/technique-open-smoke.json MISSING —— 发版前置项:node scripts/verify_technique_open_smoke.cjs")
        return
    try:
        ev = _json.loads(read(ev_path))
    except Exception as e:
        record(name, False, f"evidence unreadable: {e}")
        return
    bad = []
    s = ev.get("summary") or {}
    if ev.get("pass") is not True:
        bad.append("pass != true" + (f" ({ev.get('error', '')[:120]})" if ev.get("error") else ""))
    if int(s.get("failed") or 0) != 0:
        bad.append(f"failed={s.get('failed')}: " + ", ".join(t.get("key", "?") for t in (ev.get("techniques") or []) if not t.get("ok"))[:200])
    if int(s.get("opened") or 0) < 26:
        bad.append(f"opened={s.get('opened')} < 26(导航/解析失效?)")
    # horosa_fengshui_school_sweep_v1(v3.11.1 覆盖补丁,issue #84):证据必须含风水流派逐派切换扫描,且零 FAIL、至少开出 15 派
    fsw = ev.get("fengshuiSchools")
    if not isinstance(fsw, dict):
        bad.append("evidence lacks fengshuiSchools sweep(用旧版脚本跑的证据 —— 重跑 verify_technique_open_smoke.cjs)")
    else:
        if int(fsw.get("failed") or 0) != 0:
            bad.append("fengshui schools failed=%s: %s" % (fsw.get("failed"), ", ".join(r.get("label", "?") for r in (fsw.get("rows") or []) if r.get("ok") is False)[:160]))
        if int(fsw.get("opened") or 0) < 15:
            bad.append("fengshui schools opened=%s < 15(下拉选不中 / 扫描中止:%s)" % (fsw.get("opened"), (fsw.get("error") or "-")[:80]))
    if ev.get("appAsarSha256") != sha256(asar):
        bad.append("app.asar sha256 != evidence(证据不是这份产物 —— 重建后必须重跑冒烟)")
    if ev.get("setupExeSha256") != sha256(exe):
        bad.append("Setup exe sha256 != evidence(证据不是这份产物 —— 重建后必须重跑冒烟)")
    if bad:
        record(name, False, "; ".join(bad))
    else:
        record(name, True, f"opened={s.get('opened')} passed={s.get('passed')} skipped={s.get('skipped')}; asar+exe sha256 bound; {ev.get('finishedAt', '')}")


def check_java_data_probes_evidence(V):
    """horosa_java_data_probes_v1(#109 收尾,v3.11.2):打包版真机「Java 数据级」证据门。

    technique-open 门只判「打开不报错」,金标只核 Python;Java 侧(八字四柱 / 紫微 / 六壬神将)与响应加解密 v2 在真机上
    「解出来且值对不对」此前没有门直接看。`scripts/verify_java_data_probes.cjs` 在隔离档案里真启动打包版,逐页打开
    紫微 / 八字 / 六壬(六壬按真实用户路径点「起课」),断言:自家端口零失败响应且 /chart /ziwei/birth /liureng/gods 全部
    Encrypted: 2;紫微四柱/农历/命局/12 宫上屏;八字四柱 == 紫微四柱 == 六壬盘面八字 == Python 太乙引擎同钟表时刻四柱
    (跨引擎 oracle);新 Python /jieqi/nongli 2033 唯一闰月 = 闰冬月;零 pageerror。产出 release/java-data-probes.json,
    证据绑 app.asar + Setup exe sha256(重建即失效,必重跑)。安装器未构建时 SKIP;构建后未跑 = 发版前置项 FAIL。
    """
    name = "java data probes evidence (packaged app: pillars cross-engine + crypto v2 live)"
    import json as _json
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    asar = os.path.join(rel, "win-unpacked", "resources", "app.asar")
    ev_path = os.path.join(rel, "java-data-probes.json")
    if not os.path.exists(exe) or not os.path.exists(asar):
        record(name, True, "SKIPPED (installer/win-unpacked not built yet)")
        return
    if not os.path.exists(ev_path):
        record(name, False, "release/java-data-probes.json MISSING —— 发版前置项:node scripts/verify_java_data_probes.cjs")
        return
    try:
        ev = _json.loads(read(ev_path))
    except Exception as e:
        record(name, False, f"evidence unreadable: {e}")
        return
    bad = []
    checks = ev.get("checks") or []
    failed = [c.get("name", "?") for c in checks if not c.get("ok")]
    if ev.get("pass") is not True:
        bad.append("pass != true" + (f" ({ev.get('error', '')[:120]})" if ev.get("error") else ""))
    if failed:
        bad.append("failed checks: " + "; ".join(failed)[:240])
    if len(checks) < 15:
        bad.append(f"only {len(checks)} checks(脚本被截断/判据缺失?)")
    if ev.get("appAsarSha256") != sha256(asar):
        bad.append("app.asar sha256 != evidence(证据不是这份产物 —— 重建后必须重跑探针)")
    if ev.get("setupExeSha256") != sha256(exe):
        bad.append("Setup exe sha256 != evidence(证据不是这份产物 —— 重建后必须重跑探针)")
    if bad:
        record(name, False, "; ".join(bad))
    else:
        record(name, True, f"{len(checks)}/{len(checks)} checks; pillars {' '.join(ev.get('baziPillars') or [])}; asar+exe sha256 bound; {ev.get('finishedAt', '')}")


def check_desktop_bridge_contract():
    """horosa_desktop_bridge_contract_gate_v1(v3.11.0,镜像上游 [248] 桥合同 + check_desktop_bridge_contract.js 判据形状):
    ① 产品源前端调用的每个壳命令 ⊆ Electron 命令表(desktop-bridge.js);② Vec 命令的 invokeOptional 包装消费点必须读 .value;
    命令表里不得出现上游 Rust 没有的名字;抽取失效(表 <40 / 调用 <30)直接红而非假绿。先跑 --self-test 六向量,判别力坏了当场红。
    与 electron/mcp.test.js(返回形态逐条同形、协议行为)和 verify_mcp_smoke.cjs(真机)三层互补。"""
    name = "desktop bridge contract (frontend commands ⊆ Electron table; Vec consumers read .value)"
    script = os.path.join(SCRIPT_DIR, "check-desktop-bridge-contract.cjs")
    if not os.path.exists(script):
        record(name, False, "check-desktop-bridge-contract.cjs MISSING from scripts/")
        return
    try:
        st = subprocess.run(["node", script, REPO, "--self-test"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
        if st.returncode != 0:
            record(name, False, "self-test failed: " + "; ".join(((st.stdout or "") + (st.stderr or "")).strip().splitlines()[-4:]))
            return
        r = subprocess.run(["node", script, REPO], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
        if r.returncode == 0:
            record(name, True, (r.stdout or "").strip().splitlines()[-1] if r.stdout else "clean")
        else:
            tail = ((r.stderr or "") + (r.stdout or "")).strip().splitlines()
            record(name, False, "; ".join(tail[:6]) or f"exit {r.returncode}")
    except Exception as e:
        record(name, False, f"gate runner failed: {e}")


def check_frontend_build_fingerprint():
    # 第 24 门(v3.3.4,镜像上游 preflight [122] + 打包产物冒烟锚):发布产物必须可追溯到干净 commit。
    # 根因事故(上游 v3.3.3 安装包):dist 曾由「工作树含未提交中间态」构建 → 推运双盘/择日控件/
    # 奇门封局 App 内静默坏、preview 恒好、无从追溯。防线 = build:file 末尾 write-build-info.js
    # 把 {commit,dirty,dirtyCount} 落进 dist-file/build-info.json;本门三判:
    #   ① 指纹在位且 dirty=false(脏树构建的产物无法对应任何 commit,禁止发布);
    #   ② commit 在本仓可解析,且(== HEAD 或 与 HEAD 之间前端源面零 diff —— 允许发布后补
    #      docs/无关 commit 再复跑 selfcheck 不假红);
    #   ③ 关键修复编译锚已入 staged 产物(技法页全走 React.lazy → 守卫串在 *.async.js 懒 chunk;
    #      中文串在压缩产物里可能是 \uXXXX 转义形态 → 双形态检测)。
    name = "frontend build fingerprint"
    dist = os.path.join(BUNDLE_RUNTIME, "dist-file")
    info_p = os.path.join(dist, "build-info.json")
    if not os.path.exists(info_p):
        record(name, False, "staged dist-file 缺 build-info.json —— 旧产物或未走 build:file(write-build-info)链,重跑 npm run build:file 并重新拷贝")
        return
    problems = []
    try:
        with open(info_p, encoding="utf-8") as f:
            info = json.load(f)
    except Exception as e:
        record(name, False, f"build-info.json unreadable: {e}")
        return
    commit = str(info.get("commit") or "")
    if info.get("dirty"):
        problems.append(f"dist 由脏工作树构建(dirtyCount={info.get('dirtyCount')})—— 先 commit 再重跑 build:file")
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        problems.append(f"指纹 commit 非法: {commit[:20]!r}")
    else:
        r = subprocess.run(["git", "-C", REPO, "rev-parse", "--verify", commit + "^{commit}"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            problems.append(f"指纹 commit {commit[:12]} 不在本仓历史")
        else:
            head = subprocess.run(["git", "-C", REPO, "rev-parse", "HEAD"],
                                  capture_output=True, text=True).stdout.strip()
            if head and head != commit:
                ui_rel = os.path.relpath(UI, REPO).replace("\\", "/")
                d = subprocess.run(["git", "-C", REPO, "diff", "--quiet", commit, "HEAD", "--",
                                    f"{ui_rel}/src", f"{ui_rel}/package.json",
                                    f"{ui_rel}/.umirc.js", f"{ui_rel}/public"],
                                   capture_output=True)
                if d.returncode != 0:
                    problems.append(f"built@{commit[:12]} ≠ HEAD@{head[:12]} 且前端源面有 diff —— 重跑 build:file")
    probe = "后端服务尚未就绪"
    esc = "".join("\\u%04x" % ord(c) for c in probe)
    hit_guard = hit_surface = hit_floating = False
    for root, _dirs, files in os.walk(dist):
        for fn in files:
            if not (fn.endswith(".js") or fn.endswith(".css")):
                continue
            try:
                with open(os.path.join(root, fn), encoding="utf-8", errors="ignore") as f:
                    s = f.read()
            except Exception:
                continue
            if fn.endswith(".js") and (probe in s or esc in s):
                hit_guard = True
            if "--horosa-surface-solid" in s:
                hit_surface = True
            if fn.endswith(".css") and "horosa-floating-surface" in s:
                hit_floating = True
    if not hit_guard:
        problems.append("产物缺会话投毒守卫编译锚(空载荷人话提示)—— dist-file 陈旧?")
    if not hit_surface:
        problems.append("产物缺浮层不透明变量 --horosa-surface-solid")
    if not hit_floating:
        problems.append("产物缺 floating-surface 基类(css)")
    # ④ 判脏**判别力自证**(v3.11.0,gotcha #104):①只读 build-info 里的 dirty 位,而写它的 write-build-info.js 上游改为
    #    「单引号 pathspec 拼 execSync 串」—— Windows 的 execSync 走 cmd.exe,单引号不是引号,git 一个都匹配不上,
    #    实测 908 个脏文件被判 dirty=false ⇒ ① 恒绿(假绿方向:脏树产物可发货)。overlay 已改 execFileSync 数组参数,
    #    但「补丁在不在」证不了「判脏在本平台看得见脏」:这里往 src/ 放一个临时未跟踪文件,让脚本写到临时目录,
    #    必须报 dirty=true;绝不碰真 dist-file,探针必还原。
    import tempfile, shutil
    probe_file = os.path.join(UI, "src", "__horosa_buildinfo_probe__.js")
    tmpd = tempfile.mkdtemp(prefix="horosa-buildinfo-probe-")
    try:
        with open(probe_file, "w", encoding="utf-8") as f:
            f.write("export default 1;\n")
        pr = subprocess.run(["node", os.path.join(UI, "scripts", "write-build-info.js"), tmpd],
                            cwd=os.path.join(UI, "scripts"), capture_output=True, text=True, timeout=120)
        pinfo_p = os.path.join(tmpd, "build-info.json")
        if pr.returncode != 0 or not os.path.exists(pinfo_p):
            problems.append("④ write-build-info 探针运行失败(判脏判别力无法自证)")
        else:
            with open(pinfo_p, encoding="utf-8") as f:
                pinfo = json.load(f)
            if not pinfo.get("dirty"):
                problems.append("④ write-build-info **判脏失效**:临时脏文件在位却报 dirty=false —— ① 的 dirty 位不可信"
                                "(Windows 单引号 pathspec 家族,gotcha #104;overlay horosa_buildinfo_shell_free_v1 丢了?)")
    except Exception as e:
        problems.append(f"④ write-build-info 探针异常: {e}")
    finally:
        try:
            os.remove(probe_file)
        except Exception:
            pass
        shutil.rmtree(tmpd, ignore_errors=True)
    ok = not problems
    record(name, ok, (f"clean@{commit[:12]} + 3 compiled anchors present + dirty-detector probe OK") if ok else "; ".join(problems[:4]))

def check_payload_slimmed():
    # Tier-1 payload slimming (docs/PACKAGING_SIZE_AUDIT.md): these build-only / duplicate /
    # regenerable dirs must NOT be in the staged runtime payload. If a future change re-includes
    # them (e.g. the prune list in stage-runtime.cjs is reverted), the installer balloons ~600 MB.
    # DELTA-V2: staged runtime top is rt/ (path budget); runtime/windows = legacy escape-hatch layout.
    stage = os.path.join(REPO, "desktop_installer_bundle", "build", "app-runtime", "rt")
    if not os.path.isdir(stage):
        stage = os.path.join(REPO, "desktop_installer_bundle", "build", "app-runtime", "runtime", "windows")
    if not os.path.isdir(stage):
        record("payload slimmed (Tier-1)", True, "SKIPPED (staged payload not built yet)")
        return
    must_be_absent = [
        "node", "maven", "maven-extract", "wheels",
        os.path.join("bundle", "wheels"), os.path.join("bundle", "dist"), "appcds",
        # PERF-R6 P-1 (upstream-paired runtime slimming): the streamlit UI dependency tree
        # (201.2 MB / 6,265 files) never runs in the desktop compute path — upstream v3.1.0 stubs
        # (cetian_ziwei + kinastro_common) + astropy/tests/test_runtime_deps_slim.py prove every
        # service entry imports WITHOUT them. Reappearance = prune list reverted.
        os.path.join("python", "Lib", "site-packages", "streamlit"),
        os.path.join("python", "Lib", "site-packages", "pyarrow"),
        os.path.join("python", "Lib", "site-packages", "plotly"),
        os.path.join("python", "Lib", "site-packages", "altair"),
        os.path.join("python", "Lib", "site-packages", "pydeck"),
        # PERF-R6: pip console shims — runtime spawns only python.exe; pip-volatile bytes poison the delta.
        # ★v3.9.0 追加的第二条理由(Mac preflight [210] 的 Windows 对位,实测取证而非推理):
        #   本机 python/Scripts 下 **36/36 个 .exe 启动器的 shebang 都嵌着构建机绝对路径**
        #   (`#!C:\\Users\\<用户名>\\...`,含用户名与完整构建树路径)。今天它们被整目录剪除,
        #   所以既不泄露也不影响功能;但**一旦有人解禁 Scripts,这些路径就随包发到用户机**
        #   —— 而 `check_devpath_bakein` 只扫 asar / payload-manifest / dist-file 三处,扫不到这里。
        #   本门是那条路上唯一的拦截点:解禁 = 本门红。改动此行前先读 gotcha #97。
        os.path.join("python", "Scripts"),
    ]
    present = [p.replace("\\", "/") for p in must_be_absent if os.path.exists(os.path.join(stage, p))]
    ok = not present
    # gotcha #82:dev 态启动(electron . —— startup_ab 温启臂/手动开发跑都算)会把动态 CDS 档案
    # 建进 build/app-runtime/rt/appcds(getAppCdsContext 的 cacheDir=runtimeWindowsDir/appcds)。
    # 发布后的测量/开发跑会重新弄脏本 staging ⇒ 本门红。这不是 prune 清单回退:发货树以
    # 「payload tree format」门(manifest 无 appcds)为准;删掉该目录(可再生)即恢复。
    # 只有 stage-runtime.cjs runtimePruneTargets 真被改动才是发布级失败。
    hint = " [若仅 appcds:多半是发布后 dev/台架启动再生的缓存,删 build/app-runtime/rt/appcds 即可;发货树以 payload-tree 门为准]"
    detail = "build-only/duplicate/regenerable dirs pruned from payload" if ok else \
        f"NOT pruned -> installer bloat + delta poison: {', '.join(present)} (see stage-runtime.cjs runtimePruneTargets){hint if present == ['appcds'] else ''}"
    record("payload slimmed (Tier-1)", ok, detail)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def sha512_base64(path):
    h = hashlib.sha512()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return base64.b64encode(h.digest()).decode("ascii")

def check_update_feed_consistency(V):
    # electron-updater downloads the exe named in latest.yml and verifies it against
    # latest.yml's sha512 + size. If latest.yml drifts from the actual exe (the classic
    # failure after an "overwrite-in-place" re-release that forgot to regenerate latest.yml,
    # since a rebuild always changes the exe hash), EVERY client's auto-update fails the
    # integrity check -- silently breaking the whole feature. Gate it byte-for-byte.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    ly = os.path.join(rel, "latest.yml")
    if not os.path.exists(exe) or not os.path.exists(ly):
        record("update feed (latest.yml) matches exe", True, "SKIPPED (installer/latest.yml not built yet)")
        return
    lytxt = read(ly)
    bad = []
    m_path = re.search(r"^path:\s*(.+?)\s*$", lytxt, re.MULTILINE)          # top-level path
    m_sha = re.search(r"^sha512:\s*(\S+)\s*$", lytxt, re.MULTILINE)         # top-level sha512 (column 0)
    m_size = re.search(r"^\s+size:\s*(\d+)\s*$", lytxt, re.MULTILINE)       # files[].size (indented)
    actual_sha = sha512_base64(exe)
    actual_size = os.path.getsize(exe)
    if not m_path or m_path.group(1).strip() != f"Horosa-Setup-{V}.exe":
        bad.append(f"latest.yml path = {m_path.group(1).strip() if m_path else 'missing'} != Horosa-Setup-{V}.exe")
    if not m_sha or m_sha.group(1).strip() != actual_sha:
        bad.append("latest.yml sha512 != exe sha512 (clients would fail the auto-update integrity check)")
    if not m_size or int(m_size.group(1)) != actual_size:
        bad.append(f"latest.yml size = {m_size.group(1) if m_size else 'missing'} != exe size {actual_size}")
    record("update feed (latest.yml) matches exe", not bad,
           "; ".join(bad) if bad else "latest.yml path/sha512/size match the shipped exe")

def check_update_signature(V):
    # P0-1 (v2.5.4): the release MUST ship `horosa-update.sig` (an Ed25519 signature of the exe) and it MUST
    # verify against the public key embedded in electron/update-signature.js. The shipped client is fail-closed:
    # it refuses any update without a valid signature, so publishing an unsigned/non-verifying release would
    # brick auto-update for every client. Verify via the SAME node verifier the client uses.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    sig = os.path.join(rel, "horosa-update.sig")
    if not os.path.exists(exe):
        record("update signature (Ed25519)", True, "SKIPPED (installer not built yet)")
        return
    if not os.path.exists(sig):
        record("update signature (Ed25519)", False,
               "horosa-update.sig MISSING -> run `npm run sign:update`; fail-closed clients would refuse this release")
        return
    try:
        r = subprocess.run(
            ["node", os.path.join(SCRIPT_DIR, "sign-update.cjs"), "verify", exe, V, sig],
            capture_output=True, text=True, cwd=BUNDLE, timeout=180)
        ok = (r.returncode == 0)
        detail = "horosa-update.sig verifies against the embedded public key" if ok else \
                 (r.stderr.strip() or r.stdout.strip() or "verify failed")[:200]
    except Exception as e:
        ok, detail = False, f"verify exec failed: {e}"
    record("update signature (Ed25519)", ok, detail)

def check_app_update_yml():
    # The packaged app MUST ship resources/app-update.yml so electron-updater can
    # resolve the GitHub feed. The `electron-builder --dir` + `--win nsis --prepackaged`
    # split skips electron-builder's own app-update.yml generation, so
    # scripts/write-app-update-yml.cjs writes it (wired into dist:win). This gate
    # ensures that step actually ran and the file matches package.json's publish config.
    # win-unpacked is a build output (gitignored) -> SKIP if not built yet.
    import json
    wu_res = os.path.join(BUNDLE, "release", "win-unpacked", "resources")
    if not os.path.isdir(wu_res):
        record("packaged app-update.yml present", True, "SKIPPED (win-unpacked not built yet)")
        return
    auy = os.path.join(wu_res, "app-update.yml")
    if not os.path.exists(auy):
        record("packaged app-update.yml present", False,
               "resources/app-update.yml MISSING -> electron-updater can't resolve the feed (write:update-config did not run)")
        return
    txt = read(auy)
    with open(os.path.join(BUNDLE, "package.json"), "r", encoding="utf-8") as f:
        pub = json.load(f).get("build", {}).get("publish", [])
    pub = (pub[0] if isinstance(pub, list) and pub else pub) or {}
    bad = []
    for key in ("provider", "owner", "repo"):
        want = pub.get(key, "")
        if f"{key}: {want}" not in txt:
            bad.append(f"app-update.yml {key} != package.json publish ({want!r})")
    record("packaged app-update.yml present", not bad,
           "; ".join(bad) if bad else "resources/app-update.yml present + matches publish config")

def check_release_assets(V):
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    if not os.path.exists(exe):
        record("release assets", True, "SKIPPED (installer not built yet for this version)")
        return
    bad = []
    assets = [f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml", "SHA256SUMS.txt"]
    for a in assets:
        if not os.path.exists(os.path.join(rel, a)):
            bad.append(f"missing asset {a}")
    ly = os.path.join(rel, "latest.yml")
    if os.path.exists(ly):
        lytxt = read(ly)
        m = re.search(r"^version:\s*(.+)$", lytxt, re.MULTILINE)
        if not m or m.group(1).strip() != V:
            bad.append(f"latest.yml version {m.group(1).strip() if m else '?'} != {V}")
        if f"Horosa-Setup-{V}.exe" not in lytxt:
            bad.append("latest.yml url != current exe")
    sums = os.path.join(rel, "SHA256SUMS.txt")
    if os.path.exists(sums):
        recorded = {}
        for line in read(sums).splitlines():
            parts = line.split()
            if len(parts) == 2:
                recorded[parts[1]] = parts[0].lower()
        if f"Horosa-Setup-{V}.exe" not in recorded:
            # SHA256SUMS.txt still lists a PREVIOUS version. This used to be an advisory
            # pass ("pending regen"), which opened a false-10/10 hole: fill the release-doc
            # hashes but forget to regenerate SHA256SUMS and every gate went green while a
            # stale SUMS shipped -- telling every verifying user their (correct) download is
            # corrupted. Phase 1 of dist:win already exits 1 on the release-doc gate, so
            # failing here too costs nothing mid-flow and makes the final selfcheck
            # operator-proof.
            bad.append(f"SHA256SUMS.txt not regenerated for v{V} (still lists a previous version)")
        else:
            for a in (f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml"):
                p = os.path.join(rel, a)
                if a not in recorded:
                    bad.append(f"SHA256SUMS missing {a}")
                elif os.path.exists(p) and sha256(p) != recorded[a]:
                    bad.append(f"SHA256 mismatch for {a}")
    detail = "; ".join(bad) if bad else "4 assets, hashes + latest.yml consistent"
    record("release assets + hashes", not bad, detail)

def check_release_doc_hashes(V):
    # The per-release doc (docs/releases/X.Y.Z.md) publishes the exe/blockmap/latest.yml SHA256 so
    # users can verify their download. In the v2.4.0 sync we nearly shipped PLACEHOLDER hashes: the
    # doc was drafted (with plausible-looking fake hex) BEFORE the build produced the real ones, and
    # nothing caught it -- the other asset gates only check SHA256SUMS.txt / latest.yml, never the prose
    # doc. A wrong/placeholder/stale hash in the release doc misleads every user who checks their
    # download. Gate: docs/releases/{V}.md MUST contain the REAL sha256 of each shipped asset.
    # Discipline: while drafting, use the literal token "TODO" (never fake hex) so this gate fails
    # loudly and obviously instead of a fabricated hash sneaking into a published release.
    rel = os.path.join(BUNDLE, "release")
    exe = os.path.join(rel, f"Horosa-Setup-{V}.exe")
    doc = os.path.join(REPO, "docs", "releases", f"{V}.md")
    if not os.path.exists(exe):
        record("release-doc hashes match assets", True, "SKIPPED (installer not built yet)")
        return
    if not os.path.exists(doc):
        record("release-doc hashes match assets", False, f"docs/releases/{V}.md MISSING (per-release doc required)")
        return
    txt = read(doc)
    bad = []
    for name in (f"Horosa-Setup-{V}.exe", f"Horosa-Setup-{V}.exe.blockmap", "latest.yml"):
        p = os.path.join(rel, name)
        if not os.path.exists(p):
            continue
        h = sha256(p)
        if h not in txt:
            bad.append(f"{name}: real sha256 {h[:12]}… absent from doc (placeholder/stale/missing TODO)")
    record("release-doc hashes match assets", not bad,
           "; ".join(bad) if bad else f"docs/releases/{V}.md carries the real sha256 of exe/blockmap/latest.yml")

# ── DELTA-V2 增量更新契约 gates ─────────────────────────────────────────────────────────────
# The differential-update machinery only works while the packaging structure stays delta-friendly.
# These gates make the contract self-enforcing for every future session/agent: a structural
# regression (monolithic archive back, fat jar back, determinism broken, paths too long, exe past
# the NSIS ceiling) hard-fails the release BEFORE it ships.

DELTA_EXE_CEILING_BYTES = int(1.6 * 1024 * 1024 * 1024)   # PE/NSIS ~2GB hard ceiling, with headroom
DELTA_PATH_BUDGET = 135                                    # chars; NSIS 3.0.4.1 + SHFileOperation MAX_PATH headroom
DELTA_MIN_REUSE_PCT = 60.0                                 # fallback criterion when no baseline manifest
DELTA_OPS_WARN = 2000                                      # merged ranged-GETs (GitHub throttles 1s/100 ops)

def _load_delta_report_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "horosa_delta_report", os.path.join(SCRIPT_DIR, "delta-report.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def _live_release_tag():
    try:
        out = subprocess.run(
            ["gh", "release", "view", "--json", "tagName", "-q", ".tagName"],
            capture_output=True, text=True, timeout=20, cwd=REPO, shell=False)
        tag = (out.stdout or "").strip()
        return tag if out.returncode == 0 and tag.startswith("v") else None
    except Exception:
        return None

def _download_live_blockmap(tag, version, dest):
    import urllib.request
    url = ("https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/"
           f"releases/download/{tag}/Horosa-Setup-{version}.exe.blockmap")
    try:
        with urllib.request.urlopen(url, timeout=30) as resp, open(dest, "wb") as f:
            f.write(resp.read())
        return True
    except Exception:
        return False

def check_payload_format_and_path_budget():
    manifest_path = os.path.join(BUNDLE, "build", "app-runtime-packed", "payload-manifest.json")
    if not os.path.exists(manifest_path):
        record("payload tree format + path budget", True, "SKIPPED (packed payload not staged yet)")
        return None
    import json
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    if manifest.get("format") != 2:
        ok = os.environ.get("HOROSA_SHIP_FAT_JAR") == "1"
        record("payload tree format + path budget", ok,
               "LEGACY tar format shipped" + (" via HOROSA_SHIP_FAT_JAR=1 (recorded emergency escape hatch)" if ok
                else " WITHOUT the escape-hatch env — the delta-friendly tree format has regressed"))
        return manifest
    files = manifest.get("files") or []
    over = [f for f in files if len(f.get("path", "")) > DELTA_PATH_BUDGET]
    longest = max((len(f.get("path", "")) for f in files), default=0)
    # PERF-R6 / delta contract: the payload must be .pyc-FREE. Bytecode caches are volatile —
    # any pip/compileall/pytest activity on the build machine rewrites thousands of them (measured:
    # 7,640 changed .pyc = 140.7 MB of phantom diff that collapsed 3.0.1→3.1.0 blockmap reuse to
    # 15%). Python regenerates them on demand in the user-writable extracted runtime, and
    # schedulePycCompile back-fills the full tree post-ready.
    pyc = [f for f in files if f.get("path", "").endswith(".pyc") or "__pycache__/" in f.get("path", "")]
    # horosa_payload_residue_free_v1(v3.8.0):同族但 .pyc 之外的**构建机残渣**,同样是幽灵差量。
    # 逐版实测(3.1.0…3.7.3 共 22 份归档 manifest):
    #   .pytest_cache/v/cache/nodeids 171,689 B —— sha **翻转 12 次**,凡构建机跑过 pytest 的那一版
    #     就换一次 168 KB,与产品变化毫无关系;
    #   webchartsrv.py.orig 37,095 B —— apply.sh 的 patch 以 fuzz 应用时写下的备份,自 v3.1.0 起
    #     一直在发货。这些文件**未被 git 跟踪**却照样进包:staging 是整树拷贝,不走 git ls-files。
    # 三者都不在运行时被读:.pyc 按需重生、.orig 不是模块、.pytest_cache 属于构建机。
    # 与 stage-runtime.cjs 的 RESIDUE_DIR_NAMES / RESIDUE_FILE_EXTS 成对,改一边必须改另一边。
    RESIDUE_SUFFIX = (".orig", ".rej", ".bak", ".swp")
    residue = [f for f in files
               if f.get("path", "").endswith(RESIDUE_SUFFIX) or ".pytest_cache/" in f.get("path", "")]
    ok = not over and not pyc and not residue
    if ok:
        detail = (f"format=2, {len(files)} files, longest path {longest}/{DELTA_PATH_BUDGET}, "
                  "pyc-free + residue-free")
    elif over:
        detail = f"{len(over)} paths exceed the {DELTA_PATH_BUDGET}-char budget (first: {over[0]['path']})"
    elif pyc:
        detail = (f"{len(pyc)} volatile .pyc/__pycache__ entries shipped (first: {pyc[0]['path']}) — "
                  "delta-poison; stage-runtime.cjs prunePythonCaches(stageRuntimeDir) regressed")
    else:
        detail = (f"{len(residue)} build-machine residue entries shipped "
                  f"(first: {residue[0]['path']}) — phantom delta churn; "
                  "stage-runtime.cjs RESIDUE_DIR_NAMES/RESIDUE_FILE_EXTS prune regressed")
    record("payload tree format + path budget", ok, detail)
    # horosa_maxpath_gate_v1 cross-check(全球健壮性轮 2026-07-05):installer.nsh 的 INSTDIR
    # 硬门必须与真实载荷深度联动 —— 载荷未来变深时这里先红,提醒同步收紧安装器上限,而不是让
    # 门静默失效。staged 布局:INSTDIR + "\resources\rt\" + <manifest path> ≤ 259(Win32 MAX_PATH)。
    try:
        import re as _re
        nsh_src = open(os.path.join(BUNDLE, "assets", "installer.nsh"), encoding="utf-8").read()
        m = _re.search(r"HOROSA_INSTDIR_MAX_LEN\s+(\d+)", nsh_src)
        instdir_max = int(m.group(1)) if m else None
        prefix = len(r"\resources\rt") + 1  # 14:INSTDIR 与载荷相对路径之间的固定段
        total = (instdir_max or 0) + prefix + longest
        ok2 = instdir_max is not None and total <= 259
        if instdir_max is None:
            detail2 = "HOROSA_INSTDIR_MAX_LEN define missing from installer.nsh (gate reverted?)"
        elif ok2:
            detail2 = f"INSTDIR_MAX {instdir_max} + prefix {prefix} + longest {longest} = {total} <= 259"
        else:
            detail2 = (f"OVER MAX_PATH: {instdir_max}+{prefix}+{longest} = {total} > 259 — "
                       "tighten HOROSA_INSTDIR_MAX_LEN or flatten the payload tree")
        record("installer MAX_PATH cross-check", ok2, detail2)
    except Exception as e:
        record("installer MAX_PATH cross-check", False, f"probe failed: {e}")
    return manifest

def check_payload_determinism(V):
    # horosa_payload_determinism_v1(SELF-HEAL-R2 第 23 门):payloadId 由全部载荷文件的
    # {path,size,sha256} 哈希而来,任何「构建即漂移」的字节都会让未变的 runtime 在更新时被判
    # 全新 → 整代重物化 + 旧代温 CDS(.jsa)全废 → 更新后首启退化为冷启。R1 已灭
    # .horosa-exploded.json 时间戳;本门钉死剩余两个漂移源,防静默回归:
    # ① pip 簿记 *.dist-info/RECORD 不得发货(pip 每跑整批重写=纯漂移;运行时零消费者——
    #    kentang 双向门 + 全服务 HTTP 门都在剪除后的载荷上实证);direct_url.json 同禁
    #    (漂移 + 潜在 file:///C:/Users/<dev> 开发机路径泄漏);
    # ② rt/bundle/runtime.manifest.json 不得携带 generatedAt(stage 期归一化剥除)。
    manifest_path = os.path.join(BUNDLE, "build", "app-runtime-packed", "payload-manifest.json")
    if not os.path.exists(manifest_path):
        record("payload determinism (id-stable)", True, "SKIPPED (packed payload not staged yet)")
        return
    import json
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    files = manifest.get("files") or []
    records_shipped = [f for f in files if f.get("path", "").endswith(".dist-info/RECORD")]
    direct_urls = [f for f in files
                   if f.get("path", "").endswith("/direct_url.json") or f.get("path", "") == "direct_url.json"]
    problems = []
    if records_shipped:
        problems.append(f"{len(records_shipped)} pip RECORD files shipped (first: {records_shipped[0]['path']}) "
                        "— stage-runtime prunePipMetadata regressed")
    if direct_urls:
        problems.append(f"{len(direct_urls)} direct_url.json shipped (first: {direct_urls[0]['path']}) "
                        "— dev-path leak + payloadId drift")
    rm_path = os.path.join(BUNDLE, "build", "app-runtime-packed", "rt", "bundle", "runtime.manifest.json")
    if os.path.exists(rm_path):
        try:
            with open(rm_path, encoding="utf-8") as f:
                rm = json.load(f)
            if "generatedAt" in rm:
                problems.append("runtime.manifest.json still carries generatedAt "
                                "(normalizeStagedRuntimeManifest regressed)")
        except Exception as e:
            problems.append(f"runtime.manifest.json unreadable: {e}")
    # ③ v3.7.3 新增(horosa_payload_jsa_stable_v1;Windows 对位 Mac [193] 修二):
    #    发货载荷里的 CDS 归档(rt/java/bin/server/classes*.jsa,合计 ~24MB)**必须逐版字节恒等**。
    #    背景:Mac 侧同款文件由 `java -Xshare:dump` 现场生成,CDS dump 天然不可复现(内含内存布局/
    #    指针)⇒ 28MB 部件每版被判「变了」全量重下,实测复用率一度只剩 14%。
    #    Windows 结构上没这病:我们发的是 **vendored JDK 自带的预建 classes.jsa**(只拷不生成),
    #    实测 3.5.0→3.7.2 八个版本 sha 逐字节恒等。但「恒等」此前无人断言 —— 将来换 JDK 发行版、
    #    或改成自建运行时(jlink/-Xshare:dump),24MB 会变成每版必下的随机块,而症状只会表现为
    #    差量门那句含糊的 STRUCTURAL REGRESSION。这里点名拦下,报错即指出真凶。
    #    判据:与上一版归档 manifest 逐项比 sha(首版/无归档时降级为「只记录不判死」)。
    #    Mac 的另两修在 Windows 无对应面:修一(mtime 归一)——payloadId 由 {path,size,sha256} 而来,
    #    与 mtime 无关,且运行时树是持久目录按需覆盖、非每次重生成;修三(签名缓存)——exe 未签名。
    cur_jsa = {f["path"]: f["sha256"] for f in files if f.get("path", "").endswith(".jsa")}
    jsa_note = f"{len(cur_jsa)} CDS archive(s)"
    prev_man = None
    man_dir = os.path.join(BUNDLE, "release", "manifests")
    if os.path.isdir(man_dir):
        import re as _re
        def _vkey(n):
            return [int(x) for x in _re.findall(r"\d+", n)] or [0]
        # 🔴 必须**严格早于**当前版本:check_differential_efficiency 每跑一次 selfcheck 都会把
        #    当前 staged manifest 归档成 release/manifests/<V>.json。若这里取「最高版本」,
        #    发版轮跑第二次 selfcheck 时 <V>.json 已是 staged 自身的副本 ⇒ 拿自己比自己,
        #    判据恒真、永远发现不了漂移(负向自证时实测到这个自愈行为,才揪出本坑)。
        cur_key = _vkey(V)
        cands = sorted((n for n in os.listdir(man_dir)
                        if n.endswith(".json") and _vkey(n) < cur_key), key=_vkey)
        if cands:
            prev_man = os.path.join(man_dir, cands[-1])
    if cur_jsa and prev_man and os.path.exists(prev_man):
        try:
            with open(prev_man, encoding="utf-8") as f:
                prev_files = json.load(f).get("files") or []
            prev_jsa = {x["path"]: x["sha256"] for x in prev_files if x.get("path", "").endswith(".jsa")}
            drifted = [p for p, s in cur_jsa.items() if p in prev_jsa and prev_jsa[p] != s]
            if drifted:
                problems.append(
                    f"CDS archive drifted vs {os.path.basename(prev_man)[:-5]}: {drifted} — "
                    "the shipped .jsa is no longer byte-stable (self-built runtime / -Xshare:dump / JDK "
                    "swap?). Every user now re-downloads ~24MB per release; either restore a prebuilt "
                    "CDS or exclude it from the payload (Mac [193] xiu-2 equivalent)")
            else:
                jsa_note += f", byte-identical vs {os.path.basename(prev_man)[:-5]}"
        except Exception as e:
            jsa_note += f" (prev-manifest compare skipped: {e})"
    elif cur_jsa:
        jsa_note += " (no archived manifest to compare — recorded only)"
    ok = not problems
    detail = (f"{len(files)} files: 0 pip RECORD, 0 direct_url.json, runtime.manifest timestamp-free; "
              f"{jsa_note}" if ok else "; ".join(problems))
    record("payload determinism (id-stable)", ok, detail)


def check_debug_probe_residue():
    # horosa_no_debug_probe_v1(v3.7.3;镜像上游 [197])——上游真机拆包抓出的一类事故:
    # 排查「三式改时间盘不动」时往组件里插了 console.log 探针,收尾撤除用的正则只覆盖
    # 「独占一行的 try{ console.log(...) }」,漏掉 `try{ if(cond) console.log(...) }catch(e){}`
    # 这种带条件的单行写法 ⇒ 一条 [D] 探针随前端进了已发布产物,是拆包搜字符串才发现的。
    # 教训不是「下次记得删」,而是「收尾时只按自己记得的形态搜」这件事本身不可靠 → 建门做全类扫。
    # 判据只认**真代码形态**(console.* 同行出现 [D]/[DBG]/[M<n>] 标记),故业务注释里
    # 说明日志门的 "[D] 调试日志门" 这类文字不会假阳。
    import re as _re
    src = os.path.join(UI, "src")
    pats = [
        (_re.compile(r"console\.(log|debug|info)\([^)]*\[(DBG|D|M)\d*\]"), "console debug probe"),
        (_re.compile(r"window\.__(EPOCHLOG|MARK|probe|netProbe)"), "window temp probe"),
    ]
    hits = []
    for root, _dirs, fnames in os.walk(src):
        for fn in fnames:
            if not fn.endswith((".js", ".jsx", ".ts", ".tsx")):
                continue
            p = os.path.join(root, fn)
            try:
                txt = read(p)
            except Exception:
                continue
            for rx, label in pats:
                for ln_no, ln in enumerate(txt.splitlines(), 1):
                    if rx.search(ln):
                        hits.append(f"{os.path.relpath(p, WS)}:{ln_no} ({label})")
    ok = not hits
    record("no debug-probe residue in shipped src", ok,
           f"{len(hits)} hit(s): " + "; ".join(hits[:4]) if hits
           else "src tree clean (console [D]/[DBG]/[M*] probes + window.__* temp probes)")


def check_installer_size_ceiling(V):
    exe = os.path.join(BUNDLE, "release", f"Horosa-Setup-{V}.exe")
    if not os.path.exists(exe):
        record("installer size ceiling", True, "SKIPPED (installer not built yet)")
        return
    size = os.path.getsize(exe)
    ok = size < DELTA_EXE_CEILING_BYTES
    record("installer size ceiling", ok,
           f"{size:,} bytes ({size/1024/1024:.0f} MB) " +
           ("< 1.6GB ceiling" if ok else ">= 1.6GB — approaching the NSIS 2GB hard limit; move to nsis-web (sanctioned escape hatch)"))

def _archive_release_manifest(V):
    src = os.path.join(BUNDLE, "build", "app-runtime-packed", "payload-manifest.json")
    if not os.path.exists(src):
        return None
    dest_dir = os.path.join(BUNDLE, "release", "manifests")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{V}.json")
    import shutil
    shutil.copyfile(src, dest)
    return dest

def check_differential_efficiency(V):
    new_bm = os.path.join(BUNDLE, "release", f"Horosa-Setup-{V}.exe.blockmap")
    if not os.path.exists(new_bm):
        record("differential efficiency", True, "SKIPPED (blockmap not built yet)")
        return
    _archive_release_manifest(V)  # every selfcheck run keeps release/manifests/<V>.json fresh
    if os.environ.get("HOROSA_DELTA_BASELINE_RESET") == "1":
        record("differential efficiency", True,
               "BASELINE RESET declared (format migration release — full download expected once; document it)")
        return
    tag = _live_release_tag()
    if not tag:
        record("differential efficiency", True,
               "WARN: live release tag unreachable (offline?) — delta NOT verified this run")
        return
    live_version = tag.lstrip("v")
    baseline_bm = os.environ.get("HOROSA_DELTA_BASELINE") or os.path.join(
        BUNDLE, "release", ".delta-baseline", f"Horosa-Setup-{live_version}.exe.blockmap")
    if not os.environ.get("HOROSA_DELTA_BASELINE"):
        # PERF-R6 fix: ALWAYS re-download the live baseline (unless explicitly pinned via env).
        # A same-version OVERWRITE replaces the live asset in place — a cached copy from before the
        # overwrite silently compares against the WRONG bytes (bitten for real: a ROUND-5-era cached
        # 3.0.1 blockmap made a genuinely-96.8%-reuse build read as 16.8% "STRUCTURAL REGRESSION").
        # The file is ~800KB; offline falls back to the cached copy with an explicit staleness note.
        os.makedirs(os.path.dirname(baseline_bm), exist_ok=True)
        fresh = baseline_bm + ".fresh"
        if _download_live_blockmap(tag, live_version, fresh):
            os.replace(fresh, baseline_bm)
        elif os.path.exists(baseline_bm):
            print(f"  [delta] WARN: live blockmap fetch failed — using CACHED baseline "
                  f"({time.strftime('%Y-%m-%d %H:%M', time.localtime(os.path.getmtime(baseline_bm)))}); "
                  f"a same-version overwrite since then would skew this check")
        else:
            record("differential efficiency", True,
                   f"WARN: could not fetch live blockmap for {tag} — delta NOT verified this run")
            return
    elif not os.path.exists(baseline_bm):
        record("differential efficiency", True,
               f"WARN: pinned baseline {baseline_bm} missing — delta NOT verified this run")
        return
    dr = _load_delta_report_module()
    try:
        report = dr.compute_delta(dr.load_blockmap(baseline_bm), dr.load_blockmap(new_bm))
    except Exception as e:
        record("differential efficiency", False, f"blockmap comparison failed: {e}")
        return
    ops_note = f", {report['downloadOps']} ranged GETs" + (" (WARN: scattered)" if report["downloadOps"] > DELTA_OPS_WARN else "")
    numbers = (f"vs live {tag}: download {report['downloadBytes']/1024/1024:.0f} MB "
               f"({report['downloadPct']:.1f}%), reuse {report['reusePct']:.1f}%{ops_note}")
    if live_version == V:
        # Same-version overwrite (align-with-Mac policy): never reaches the auto-updater → informational.
        record("differential efficiency", True, f"overwrite release (no updater traffic) — {numbers}")
        return
    # Version bump: the delta MUST track the true payload change (structure health), or at minimum
    # clear the reuse floor when no baseline manifest is available.
    old_manifest = os.path.join(BUNDLE, "release", "manifests", f"{live_version}.json")
    new_manifest = os.path.join(BUNDLE, "build", "app-runtime-packed", "payload-manifest.json")
    if os.path.exists(old_manifest) and os.path.exists(new_manifest):
        try:
            diff = dr.compute_manifest_diff(dr.load_manifest_files(old_manifest), dr.load_manifest_files(new_manifest))
            budget = diff["changedPayloadBytes"] * 1.5 + 50 * 1024 * 1024
            ok = report["downloadBytes"] <= budget
            record("differential efficiency", ok,
                   f"{numbers}; payload truly changed {diff['changedPayloadBytes']/1024/1024:.0f} MB → "
                   f"budget {budget/1024/1024:.0f} MB — " +
                   ("healthy (download tracks the real change)" if ok else
                    "STRUCTURAL REGRESSION: download does not track the real change (tar/fat-jar back? determinism broken?)"))
            return
        except Exception:
            pass  # fall through to reuse floor
    ok = report["reusePct"] >= DELTA_MIN_REUSE_PCT
    record("differential efficiency", ok,
           f"{numbers} — no baseline manifest; reuse floor {DELTA_MIN_REUSE_PCT:.0f}% " + ("met" if ok else "NOT met"))

def check_harness_manifest():
    # v3.0.1 ROUND-4 P5 制度化:构建骨架(electron/*, scripts/*, SKILL)按政策 gitignore、随 exe 走,
    # git 对其丢失/漂移不可见。windows-adaptations/HARNESS_MANIFEST.md(tracked)记录清单+sha256;
    # 本门重算哈希并比对 —— 缺文件/漂移即 FAIL,提示重跑 update-harness-manifest.py(有意为之:
    # 发布前强制刷新清单,让公开 repo 永远携带最新骨架指纹,骨架丢失可检测、可从线上 exe 的 asar 恢复)。
    import hashlib
    manifest = os.path.join(REPO, "windows-adaptations", "HARNESS_MANIFEST.md")
    if not os.path.isfile(manifest):
        record("harness manifest fresh", False, "HARNESS_MANIFEST.md MISSING -> run windows-adaptations/update-harness-manifest.py")
        return
    rows = re.findall(r"^\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|", read(manifest), re.MULTILINE)
    if not rows:
        record("harness manifest fresh", False, "no rows parsed from HARNESS_MANIFEST.md")
        return
    bad = []
    for rel, want in rows:
        p = os.path.join(REPO, rel.replace("/", os.sep))
        if not os.path.isfile(p):
            bad.append(f"{rel}: MISSING")
            continue
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        if h.hexdigest() != want:
            bad.append(f"{rel}: drift")
    # PERF-R9 G6:哈希门只能证明「已登记的文件没漂移」,证明不了「该登记的都登记了」。
    # 实际后果:desktop_installer_bundle/scripts/ 下 30 个文件里长期只有 14 个在册,漏掉的包括
    # resolve-project.cjs —— build-renderer.cjs 与 stage-runtime.cjs 都 require 它,丢了构建直接崩,
    # 而本门当时完全看不见。补上发现式核对:扫描面下的每个文件必须在 FILES 或 EXEMPT 里被解释。
    # 判据与生成器共用 audit_coverage(),避免两边规则漂移。
    try:
        import importlib.util as _ilu
        _gen = os.path.join(REPO, "windows-adaptations", "update-harness-manifest.py")
        _spec = _ilu.spec_from_file_location("_horosa_uhm", _gen)
        _mod = _ilu.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        unaccounted, stale_exempt = _mod.audit_coverage()
        if unaccounted:
            bad.append("NOT INVENTORIED: " + ", ".join(unaccounted[:6]))
        if stale_exempt:
            bad.append("STALE EXEMPTION (path gone): " + ", ".join(stale_exempt[:6]))
    except Exception as e:
        bad.append(f"coverage audit did not run: {type(e).__name__}: {e}")

    record(
        "harness manifest fresh",
        not bad,
        "; ".join(bad[:4]) + " -> run windows-adaptations/update-harness-manifest.py" if bad else f"{len(rows)} harness files match + coverage complete",
    )

def check_kentang_services():
    # Institutional gate born from the v3.2.0 太乙盘/三式合一太乙 `kintaiyi_unavailable` defect: a kentang
    # technique whose lazy-mount could not load 404'd its whole route, and nothing in the release exercised
    # the kentang load path so it shipped. This drives the packaged runtime + backend sys.path and asserts
    # EVERY KENTANG_SERVICE_SPECS adapter imports + resolves its class + instantiates (exactly what the mount
    # does). Reuses scripts/verify_kentang_services.py as the single source of truth.
    name = "kentang services load"
    win_unpacked = os.path.join(BUNDLE, "release", "win-unpacked")
    script = os.path.join(BUNDLE, "scripts", "verify_kentang_services.py")
    if not os.path.isdir(os.path.join(win_unpacked, "resources", "rt", "project")):
        record(name, True, "SKIP (no win-unpacked; run after dist:win)")
        return
    try:
        out = subprocess.run([sys.executable, script, "--win-unpacked", win_unpacked],
                             capture_output=True, text=True, timeout=900)
    except Exception as e:
        record(name, False, f"verify_kentang_services.py did not run: {e}")
        return
    summary = ""
    for line in (out.stdout or "").splitlines():
        if "kentang services load OK" in line:
            summary = line.split("]", 1)[-1].strip()
    if not summary:
        tail = ((out.stdout or "") + "\n" + (out.stderr or "")).strip().splitlines()
        summary = tail[-1].strip() if tail else ""
    record(name, out.returncode == 0, summary or ("all kentang backends load" if out.returncode == 0 else "verify failed"))


def check_nsis_template_patch():
    # PERF-R7 I-1:发布用的 NSIS 模板必须带 move-first 补丁(否则安装退回 3GB 双写慢路径),且
    # app-builder-lib 版本必须与补丁钉住的版本一致(升级依赖须人工复核锚文本后 bump 钉)。
    name = "nsis template move-first patch"
    tpl = os.path.join(BUNDLE, "node_modules", "app-builder-lib", "templates", "nsis", "include", "extractAppPackage.nsh")
    patcher = os.path.join(BUNDLE, "scripts", "patch-nsis-template.cjs")
    try:
        tpl_src = open(tpl, encoding="utf-8").read()
        patch_src = open(patcher, encoding="utf-8").read()
        import re as _re
        pin = _re.search(r"EXPECTED_ABL_VERSION\s*=\s*'([^']+)'", patch_src)
        installed = ""
        ablpkg = os.path.join(BUNDLE, "node_modules", "app-builder-lib", "package.json")
        import json as _json
        installed = _json.load(open(ablpkg, encoding="utf-8")).get("version", "")
        if "horosa_movefirst_v1" not in tpl_src:
            record(name, False, "template NOT patched (run npm run patch:nsis-template)")
            return
        if not pin or pin.group(1) != installed:
            record(name, False, f"version pin mismatch: pinned {pin.group(1) if pin else '?'} vs installed {installed}")
            return
        record(name, True, f"horosa_movefirst_v1 applied (app-builder-lib {installed})")
    except Exception as e:
        record(name, False, f"check failed: {e}")


def check_devpath_bakein():
    # horosa_devpath_bakein_gate_v1(全球健壮性轮 2026-07-05):构建机绝对路径绝不允许进入发货物。
    # app.asar 是明文拼接的 js(字节搜即可,无需解包);payload-manifest 的 path 域覆盖全部载荷
    # 相对路径。词表刻意特异化:裸 "OneDrive"/"maxwe" 会误中正常注释(main.js 的 OneDrive 占位符
    # 注释)与 package.json 作者邮箱 —— 只搜「构建机绝对路径」形态(单/双反斜杠 + 正斜杠变体)。
    name = "dev-path bake-in scan"
    win_unpacked = os.path.join(BUNDLE, "release", "win-unpacked")
    asar = os.path.join(win_unpacked, "resources", "app.asar")
    manifest_path = os.path.join(BUNDLE, "build", "app-runtime-packed", "payload-manifest.json")
    if not os.path.exists(asar):
        record(name, True, "SKIP (no win-unpacked; run after dist:win)")
        return
    needles = [
        b"C:\\Users\\maxwe", b"C:\\\\Users\\\\maxwe", b"C:/Users/maxwe",
        b"OneDrive\\Desktop", b"OneDrive\\\\Desktop", b"OneDrive/Desktop",
    ]
    hits = []
    try:
        blob = open(asar, "rb").read()
        for nd in needles:
            if nd in blob:
                hits.append("app.asar:" + nd.decode("ascii", errors="replace"))
        scanned = f"{len(blob):,}B asar"
        if os.path.exists(manifest_path):
            mblob = open(manifest_path, "rb").read()
            for nd in needles:
                if nd in mblob:
                    hits.append("payload-manifest:" + nd.decode("ascii", errors="replace"))
            scanned += " + payload-manifest"
        # horosa_frontend_path_scrub_v1(v3.6.1):**前端 bundle 此前是本门的盲区** —— umi 把插件
        # 注册的绝对路径原样写进 umi.*.js(实测 v3.6.0 发货件里躺着
        # `C:/Users/<用户名>/OneDrive/Desktop/<仓目录>/...`),而本门只扫 asar 与 manifest,漏了
        # 真正带路径的那一个。上游 v3.6.1 加了 scripts/scrub-build-paths.js,Windows 侧经
        # files/astrostudyui/package.name-scripts.json 接进 build:file 链;此处扫**发货态**产物
        # 兜底证明脱敏真发生(字符串哨兵只能证明脚本还在,证明不了产物干净)。
        for dist_root in (
            os.path.join(BUNDLE, "build", "app-runtime", "rt", "bundle", "dist-file"),
            os.path.join(REPO, "local", "workspace", "runtime", "windows", "bundle", "dist-file"),
        ):
            if not os.path.isdir(dist_root):
                continue
            n_files = 0
            for base, _dirs, files in os.walk(dist_root):
                for fn in files:
                    if not fn.endswith((".js", ".css", ".html", ".map")):
                        continue
                    n_files += 1
                    fblob = open(os.path.join(base, fn), "rb").read()
                    for nd in needles:
                        if nd in fblob:
                            hits.append(f"dist-file/{fn}:" + nd.decode("ascii", errors="replace"))
                            break
            scanned += f" + dist-file({n_files} files)"
            break
    except Exception as e:
        record(name, False, f"scan failed: {e}")
        return
    record(name, not hits, "; ".join(hits[:4]) if hits else f"clean ({scanned})")


def check_sweph_cjk_path():
    # horosa_sweph_cjk_gate_v1(全球健壮性轮 2026-07-05):星历库是 C 扩展,SE_EPHE_PATH 指向
    # 非 ASCII 路径(中文/日文 Windows 用户名 → %LOCALAPPDATA% 物化树)必须实测可用 ——
    # gotcha #49 修的是 Java @argfile 侧,swisseph C 侧此前从未有门。做法:把打包星历文件拷进
    # 带 CJK 段的临时目录,用打包 python(与产线同 -E -s -X utf8)设 SE_EPHE_PATH 算一次
    # 2028-04-06 太阳黄经,断言成功且数值在 [0,360)。红了 = 需要短路径(GetShortPathNameW)回退修复。
    name = "sweph CJK ephe path"
    win_unpacked = os.path.join(BUNDLE, "release", "win-unpacked")
    rt_root = os.path.join(win_unpacked, "resources", "rt")
    pyexe = os.path.join(rt_root, "rt", "python", "python.exe")
    if not os.path.exists(pyexe):
        record(name, True, "SKIP (no win-unpacked; run after dist:win)")
        return
    # 定位打包星历目录(与 service-manager resolveLayout 的 swephDir 同源数据):
    ephe_src = None
    for base, _dirs, files in os.walk(rt_root):
        if "sepl_18.se1" in files:
            ephe_src = base
            break
    if not ephe_src:
        record(name, False, "sepl_18.se1 not found anywhere under resources/rt — payload sweph data missing?")
        return
    import tempfile, shutil
    tmp = tempfile.mkdtemp(prefix="horosa-sweph-")
    cjk_dir = os.path.join(tmp, "星曆中文路径測試")
    os.makedirs(cjk_dir, exist_ok=True)
    try:
        copied = 0
        for fn in os.listdir(ephe_src):
            if fn.startswith(("sepl_18", "semo_18", "seas_18")) and fn.endswith(".se1"):
                shutil.copyfile(os.path.join(ephe_src, fn), os.path.join(cjk_dir, fn))
                copied += 1
        if copied == 0:
            record(name, False, f"no sepl/semo/seas se1 files to copy from {ephe_src}")
            return
        code = (
            "import os, sys\n"
            "base = os.getcwd()\n"
            "for d in ('astropy', 'flatlib', 'vendor'):\n"
            "    p = os.path.join(base, d)\n"
            "    if os.path.isdir(p):\n"
            "        sys.path.insert(0, p)\n"
            "import swisseph as swe\n"
            "swe.set_ephe_path(os.environ['SE_EPHE_PATH'])\n"
            "jd = swe.julday(2028, 4, 6, 9.55)\n"
            "r = swe.calc_ut(jd, swe.SUN)\n"
            "lon = r[0][0]\n"
            "assert 0.0 <= lon < 360.0, lon\n"
            "print('SWEPH_CJK_OK %.6f' % lon)\n"
        )
        env = {k: os.environ[k] for k in ("SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "PATH", "NUMBER_OF_PROCESSORS") if k in os.environ}
        env["SE_EPHE_PATH"] = cjk_dir
        env["PYTHONIOENCODING"] = "utf-8"
        project = os.path.join(rt_root, "project")
        out = subprocess.run(
            [pyexe, "-E", "-s", "-X", "utf8", "-c", code],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=180, env=env, cwd=project if os.path.isdir(project) else rt_root,
        )
        ok = out.returncode == 0 and "SWEPH_CJK_OK" in (out.stdout or "")
        if ok:
            lon = (out.stdout or "").strip().splitlines()[-1].split()[-1]
            record(name, True, f"sun lon {lon} computed with CJK SE_EPHE_PATH ({copied} se1 files)")
        else:
            tail = ((out.stdout or "") + " " + (out.stderr or "")).strip()
            record(name, False, f"packaged python failed under CJK ephe path: {tail[-300:]}")
    except Exception as e:
        record(name, False, f"gate did not run: {e}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check_local_launchers():
    # horosa_local_launchers_gate_v1(R3 2026-07-05):Web/本地版一键启停链路此前零制度覆盖 ——
    # Windows 原生 local/Horosa_Local_Windows.bat→.ps1(4,700+ 行核心)、prepareruntime 双件、
    # bash 三件套(Mac/Git-Bash 路径)都不在任何门里,坏了/被同步冲掉无人知晓。本门钉住:
    # ①四个 Windows 文件存在;②两个 ps1 双引擎(pwsh + WinPS 5.1)语法可解析 —— .bat 会回退
    # 5.1,PS7-only 语法或编码事故(hostile mojibake 同类)必须发布前爆;③编码不变量:纯 ASCII
    # 或带 UTF-8 BOM(无 BOM 的非 ASCII 内容在 5.1 按 ANSI 读=乱码源);④端口常量与桌面
    # service-manager 一致;⑤关键哨兵(安全杀/回环旁路/owner 标签/快启/看门狗/sha 钉扎/
    # bash 三件套 marker);⑥bash -n 三脚本(Git Bash 缺席则 SKIP)。
    name = "local launchers (web one-click)"
    launcher_ps1 = os.path.join(REPO, "local", "Horosa_Local_Windows.ps1")
    launcher_bat = os.path.join(REPO, "local", "Horosa_Local_Windows.bat")
    prepare_ps1 = os.path.join(REPO, "prepareruntime", "Prepare_Runtime_Windows.ps1")
    prepare_bat = os.path.join(REPO, "prepareruntime", "Prepare_Runtime_Windows.bat")
    problems = []
    for p in (launcher_ps1, launcher_bat, prepare_ps1, prepare_bat):
        if not os.path.exists(p):
            problems.append(f"missing: {os.path.relpath(p, REPO)}")
    if problems:
        record(name, False, "; ".join(problems))
        return

    # ② 双引擎 parse(经临时 -File 脚本,规避嵌套引号地狱)
    import tempfile
    parse_src = (
        "param([string]$Target)\n"
        "try {\n"
        "  $text = [System.IO.File]::ReadAllText($Target, [System.Text.Encoding]::UTF8)\n"
        "  $null = [scriptblock]::Create($text)\n"
        "  Write-Output 'PARSE-OK'\n"
        "} catch { Write-Output ('PARSE-FAIL: ' + $_.Exception.Message) }\n"
    )
    parse_path = None
    try:
        fd, parse_path = tempfile.mkstemp(suffix=".ps1", prefix="horosa-parsecheck-")
        with os.fdopen(fd, "w", encoding="ascii") as f:
            f.write(parse_src)
        engines = []
        winps = os.path.join(os.environ.get("SystemRoot", r"C:\\Windows"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
        if os.path.exists(winps):
            engines.append(("winps5.1", winps))
        engines.append(("pwsh", "pwsh"))
        for label, exe in engines:
            for target in (launcher_ps1, prepare_ps1):
                try:
                    out = subprocess.run([exe, "-NoProfile", "-File", parse_path, "-Target", target],
                                         capture_output=True, text=True, timeout=120)
                    text = (out.stdout or "") + (out.stderr or "")
                    if "PARSE-OK" not in text:
                        problems.append(f"{label} parse {os.path.basename(target)}: {text.strip()[:160]}")
                except FileNotFoundError:
                    if label == "pwsh":
                        problems.append("pwsh missing on build machine (needed to mirror the .bat's preferred engine)")
                except Exception as e:
                    problems.append(f"{label} parse {os.path.basename(target)} did not run: {e}")
    finally:
        if parse_path:
            try:
                os.remove(parse_path)
            except OSError:
                pass

    # ③ 编码不变量:纯 ASCII 或 UTF-8 BOM
    for target in (launcher_ps1, prepare_ps1):
        raw = open(target, "rb").read()
        has_bom = raw[:3] == b"\xef\xbb\xbf"
        if not has_bom and any(b > 127 for b in raw):
            problems.append(f"{os.path.basename(target)}: non-ASCII content WITHOUT UTF-8 BOM (WinPS 5.1 fallback reads ANSI → mojibake)")

    launcher_src = open(launcher_ps1, encoding="utf-8", errors="replace").read()
    prepare_src = open(prepare_ps1, encoding="utf-8", errors="replace").read()

    # ④ 端口常量对齐桌面(8899/9999;web 静态口 8000 为本启动器特有)
    import re as _re
    for pat, what in ((r"\$DefaultWebPort\s*=\s*8000", "DefaultWebPort=8000"),
                      (r"\$DefaultChartPort\s*=\s*8899", "DefaultChartPort=8899"),
                      (r"\$DefaultBackendPort\s*=\s*9999", "DefaultBackendPort=9999")):
        if not _re.search(pat, launcher_src):
            problems.append(f"launcher port constant drifted: {what}")

    # ⑤ 哨兵
    for needle in ("Enable-LocalLoopbackProxyBypass", "Test-ProcessOwnedByProject",
                   "horosa.runtime.owner=horosa-local-windows", "horosa_local_http_heartbeat_v1",
                   "horosa_local_jvm_fast_start_v1", "horosa_local_env_sanitize_v1",
                   "horosa_local_cds_dump_watchdog_v1", "'-X', 'utf8'",
                   # v3.5.1 launcher parity(镜像产品 start 脚本):LazyCacheFactory 桌面档。
                   "-Dhorosa.cache.lazyinit=true"):
        if needle not in launcher_src:
            problems.append(f"launcher sentinel missing: {needle}")
    for needle in ("$expectedSha256", "Get-FileHash -LiteralPath $tarPath -Algorithm SHA256"):
        if needle not in prepare_src:
            problems.append(f"prepare sentinel missing: {needle}")

    # ⑥ bash 三件套:哨兵 + bash -n(Mac 同步冲掉 overlay §24 → 这里先红)
    sh_dir = WS
    sh_specs = {
        "start_horosa_local.sh": ["horosa_web_java_env_sanitize_v1", "horosa_web_python_utf8_v1",
                                   "horosa_web_pyc_precompile_v1", "horosa_web_portable_stat_v1",
                                   "netstat -anv", "--noproxy '*'"],
        "stop_horosa_local.sh": ["kill"],
        "verify_horosa_local.sh": ["horosa_web_portable_stat_v1"],
    }
    git_bash = r"C:\\Program Files\\Git\\bin\\bash.exe"
    bash_note = ""
    for fn, needles in sh_specs.items():
        p = os.path.join(sh_dir, fn)
        if not os.path.exists(p):
            problems.append(f"missing: {fn}")
            continue
        src = open(p, encoding="utf-8", errors="replace").read()
        for nd in needles:
            if nd not in src:
                problems.append(f"{fn} sentinel missing: {nd} (apply.sh §24 dropped by a Mac sync?)")
        if os.path.exists(git_bash):
            r = subprocess.run([git_bash, "-n", p], capture_output=True, text=True, timeout=60)
            if r.returncode != 0:
                problems.append(f"bash -n {fn}: {(r.stderr or '').strip()[:160]}")
        else:
            bash_note = " (bash -n SKIPPED: Git Bash absent)"

    ok = not problems
    detail = ("4 win files + 3 sh files pinned; dual-engine parse OK; encoding invariant OK; ports/sentinels OK" + bash_note) if ok else "; ".join(problems[:6])
    record(name, ok, detail)


def check_election_condition_types_parity():
    # v3.7.0(镜像上游 preflight [184]):天星择日·征象搜索的「条件类型注册表」必须前↔后端恒等。
    # 前端多键 = 用户可选而后端 invalid_conditions(死开关);后端多键 = 功能藏而不露。
    # 键抓取契约:py 一键一行 "    'key': {" / js 一键一行 "\tkey: {"(两侧文件头均有注记);
    # jest 哨兵(conditionTypesSync.test.js)自带注错自证;R4 对齐资产(tab 对拍 ≥9 用例 +
    # explain 全类契约用例)不许缺席/缩水 ——「选了什么→搜出来→点开右栏严密符合」的机械保证。
    # 判据自检(#71):任一侧抓到 <10 键 = 键抓取塌缩,自 FAIL(一键一行格式被破 or regex 失配)。
    name = "election condition types parity"
    py_p = os.path.join(PY_SRC, "astrostudy", "election_scan.py")
    js_p = os.path.join(UI, "src", "divination", "zeri", "conditionTypes.js")
    jest_p = os.path.join(UI, "src", "divination", "zeri", "__tests__", "conditionTypesSync.test.js")
    parity_p = os.path.join(PY_SRC, "tests", "test_election_scan_tab_parity.py")
    endp_p = os.path.join(PY_SRC, "tests", "test_election_scan_endpoint.py")
    bad = []
    py_keys = js_keys = []
    n_par = 0
    for p in (py_p, js_p, jest_p, parity_p, endp_p):
        if not os.path.isfile(p):
            bad.append(f"missing {os.path.basename(p)}")
    if not bad:
        py_src = open(py_p, encoding="utf-8").read()
        js_src = open(js_p, encoding="utf-8").read()
        m = re.search(r"^CONDITION_TYPES = \{(.*?)^\}", py_src, re.S | re.M)
        py_keys = sorted(set(re.findall(r"^    '([a-z_]+)':", m.group(1), re.M))) if m else []
        mj = re.search(r"^export const CONDITION_TYPES = \{(.*?)^\};", js_src, re.S | re.M)
        js_keys = sorted(set(re.findall(r"^\t([a-z_]+):", mj.group(1), re.M))) if mj else []
        if len(py_keys) < 10 or len(js_keys) < 10:
            bad.append(f"key harvest collapsed (py={len(py_keys)}/js={len(js_keys)} <10) — one-key-per-line contract broken or regex mismatch")
        elif py_keys != js_keys:
            only_py = [k for k in py_keys if k not in js_keys]
            only_js = [k for k in js_keys if k not in py_keys]
            bad.append(f"condition-type key sets differ (frontend dead switch or hidden backend feature): only-py={only_py[:6]} only-js={only_js[:6]}")
        n_par = len(re.findall(r"^def test_", open(parity_p, encoding="utf-8").read(), re.M))
        if n_par < 9:
            bad.append(f"tab-parity assets shrunk ({n_par}<9 tests) — alignment guard deleted?")
        if "test_explain_contract_all_types_and_scan_agreement" not in open(endp_p, encoding="utf-8").read():
            bad.append("explain full-type contract test missing (new type could ship with a mute detail panel)")
        if "注错自证" not in open(jest_p, encoding="utf-8").read():
            bad.append("jest sentinel lacks its self-proof assertion (sentinel may be dead)")
    ok = not bad
    record(name, ok,
           (f"py==js {len(py_keys)} keys; tab-parity {n_par} tests + explain contract + jest self-proof in place"
            if ok else "; ".join(bad[:4])))


def check_wheel_art_chain():
    # v3.8.1(镜像上游 preflight [207],判据形状 8 针抄全 —— #92 课「镜像上游门要抄全判据形状」):
    # 盘面美术(wheelArt)五档全链。病灶预防:
    #   ①wheelArt 不进 AstroChart sCU 白名单 = 改档不重绘死开关;
    #   ②app model globalSetup 白名单漏键 = 跨会话保存静默失效;
    #   ③重绘签名缺维度 = 方盘切回圆盘白屏;
    #   ④两把源码扫描总锁(消费点完备性 / 宿主链断点)被拆 = 新增渲染点漏接无人拦。
    # Windows 特别关切:我方 overlay(FreezeSubTab/渲染切片)会改宿主的 <AstroChart 渲染点缩进与包裹,
    # 上游 wheelArtChart.test 的源码扫描断言必须对 overlay 后的工作区照样成立(umi 全量跑它;
    # 本门钉「测试文件与关键接线都在」,防的是 port/merge 把哪一环静默丢掉)。
    name = "wheel art chain [207]"
    chart_p = os.path.join(UI, "src", "components", "astro", "AstroChart.js")
    app_p = os.path.join(UI, "src", "models", "app.js")
    const_p = os.path.join(UI, "src", "constants", "AstroConst.js")
    main_p = os.path.join(UI, "src", "components", "astro", "AstroChartMain.js")
    test_p = os.path.join(UI, "src", "components", "astro", "__tests__", "wheelArtChart.test.js")
    bad = []
    for p in (chart_p, app_p, const_p, main_p, test_p):
        if not os.path.isfile(p):
            bad.append(f"missing {os.path.basename(p)}")
    if not bad:
        chart = read(chart_p)
        if "'wheelArt'," not in chart:
            bad.append("wheelArt 不在 AstroChart sCU 白名单(改档不重绘=死开关)")
        if "wheelArt: this.props.wheelArt" not in chart:
            bad.append("重绘签名缺 wheelArt 维度(方盘切回圆盘白屏)")
        if "wheelArt: st.wheelArt" not in read(app_p):
            bad.append("app model globalSetup 白名单缺 wheelArt(跨会话保存静默失效)")
        if "export function normalizeWheelArt" not in read(const_p):
            bad.append("wheelArt 归一函数缺失")
        if "renderWheelStyleGrid" not in read(main_p):
            bad.append("星盘样式双下拉单源方法被拆(外环样式+盘面美术)")
        test = read(test_p)
        if len(test) < 1000:
            bad.append("盘面美术金标缺失/缩水(中世纪几何校准规格失锁)")
        if "每个 <AstroChart 渲染点" not in test:
            bad.append("消费点完备性总锁被拆(新增 AstroChart 渲染点漏接 wheelArt 将无人拦截)")
        if "至少一个宿主渲染点传了 wheelArt" not in test:
            bad.append("宿主链断点总锁被拆(组件接了 props 宿主没传=选了无效死开关)")
    ok = not bad
    record(name, ok,
           ("sCU键/持久化白名单/归一/双下拉/几何金标/双总锁/签名维度 全在" if ok else "; ".join(bad[:4])))


def check_all_services_http():
    # v3.2.1 institutionalization (owner directive: 所有技法的可用性检查全部制度化,永不许发出去才发现用不了):
    # one level above the kentang import gate — launch the packaged chart service and POST a REAL request to
    # EVERY mounted route (12 eager + /cetian + 18 kentang), asserting non-404/5xx + valid JSON + min body
    # size, in the post-warmup production state where the v3.2.0 太乙 404 lived. Includes a mount-drift check
    # (a newly-mounted service without a probe row fails the release). Single source: verify_all_services.py.
    name = "all services answer (HTTP)"
    win_unpacked = os.path.join(BUNDLE, "release", "win-unpacked")
    script = os.path.join(BUNDLE, "scripts", "verify_all_services.py")
    if not os.path.isdir(os.path.join(win_unpacked, "resources", "rt", "project")):
        record(name, True, "SKIP (no win-unpacked; run after dist:win)")
        return
    try:
        out = subprocess.run([sys.executable, script, "--win-unpacked", win_unpacked],
                             capture_output=True, text=True, timeout=1200)
    except Exception as e:
        record(name, False, f"verify_all_services.py did not run: {e}")
        return
    summary = ""
    for line in (out.stdout or "").splitlines():
        if line.startswith("[verify-services] PASS") or line.startswith("[verify-services] FAIL"):
            summary = line.split("]", 1)[-1].strip()
    if not summary:
        tail = ((out.stdout or "") + "\n" + (out.stderr or "")).strip().splitlines()
        summary = tail[-1].strip() if tail else ""
    record(name, out.returncode == 0, summary or ("all services answer" if out.returncode == 0 else "verify failed"))


def check_docs_lockstep(V):
    """docs lockstep (pre-release) —— 指导性元文档实时同步门(gotcha #108,2026-09-29 立)。

    文档靠人记得去改,人会忘:v3.11.1 发完后普查出四处静默漂移(SELFCHECK_LOG 头行停两版、
    SKILL 头 gotcha 计数停 49、CLAUDE.md 门数/路由数/坑数三处陈旧、umi 稳态口径停两版)。
    判据全在 scripts/check_docs_lockstep.py(可独立 `--pre` 跑);本门是末位门,把「实际门数」
    (含自己)传进去核 SKILL 附节的声明 —— 会变的数字只许住一处,并由机器核。
    """
    name = "docs lockstep (pre-release)"
    try:
        sys.path.insert(0, SCRIPT_DIR)
        import check_docs_lockstep as cdl
        ok, detail = cdl.run_pre(expected_gates=len(results) + 1, ver=V)
    except Exception as exc:  # 门自身失效 = FAIL(#71:判据失真不许静默 PASS)
        ok, detail = False, "docs-lockstep checker crashed: %r" % (exc,)
    record(name, ok, detail)


def main():
    try:
        V = pkg_version()
    except Exception as e:
        print(f"[selfcheck] FATAL: {e}")
        return 2
    print(f"[selfcheck] Horosa Windows release self-check - version {V}\n")
    check_version_consistency(V)
    # PERF-R9:必须排在 check_sentinels 之前 —— 字典塌缩要作为它自己的失败被报出来,
    # 而不是伪装成「哨兵门莫名其妙通过了」。
    check_no_duplicate_dict_keys()
    # PERF-R9 Ship 6:随机 React key = 每次渲染整棵子树卸载重建(仓库级扫描,一道门覆盖全部文件)。
    check_no_random_react_keys()
    # #109:overlay 补丁里被吞掉的反斜杠 = wholesale-replace 后才炸的编译弹,ws 侧任何门都看不见。
    check_overlay_escape_integrity()
    check_sentinels()
    # PERF-R9:两者都必须排在 check_sentinels 之后(它们要读那里留下的 SENT 快照)。
    check_overlay_contract_coverage()
    check_perf_inventory_sync()
    # PERF-R10 P5:每个技法键必须有 markPanelReady 归属(或显式豁免)—— 观测缺口不再静默。
    check_perf_observation_coverage()
    # PERF-R10 P6:每个技法键必须有步进预取器登记(或显式豁免)—— 预取覆盖面不再靠人记。
    check_prefetch_registry_coverage()
    # PERF-R10 I3:验收证据必须存在且与版本/口径锁步 —— 「发布前必跑验收」的机械化。
    check_perf_baseline_evidence(V)
    check_jar_not_stale()
    # SELF-HEAL-R1:RUNTIME_VERSION 缓存闸必须与产品版本锁步(源+发货 jar 双验,gotcha #53/#57)。
    check_runtime_version_lockstep(V)
    check_distfile_not_stale()
    # horosa_distfile_mirror_gate_v1(v3.6.1):发货位 dist-file 与产品源文件集合必须逐名相等 ——
    # `cp -rf` 不删旧产物,哈希命名的 umi bundle 会永久累积(死重量 + 旧内容照发,时间戳门测不出)。
    check_distfile_mirrors_source()
    # gotcha #94:overlay marker 逐文件逐次数总账 —— 比哨兵门强一级,能抓「守卫被上游收编
    # ⇒ 整补丁静默跳过」与「局部应用 / fuzz 贴双份」。必须排在 check_sentinels 之后:
    # 哨兵门先报「整条 overlay 没了」这种粗粒度失败,本门再报逐处的增减。
    check_overlay_marker_inventory()
    # gotcha #95:产品源换行风格必须与纯上游一致(core.autocrlf=true 让 git apply 把 overlay
    # 打过的文件整篇 CRLF 化 ⇒ 上游的源码扫描型契约测试随机失效 + 发货字节与上游不同)。
    check_source_eol_matches_upstream()
    # issue #51 制度化:utils 符号引用必有绑定(半删 import 的 ReferenceError 类,构建期抓)。
    check_frontend_symbol_binding()
    check_zoom_domain_chain()
    check_build_chain_parity()
    check_frontend_no_undef()
    check_frontend_this_member_binding()
    check_desktop_bridge_contract()
    check_chart_theme_follow_census()
    check_new_chart_seeds_wiring()
    check_technique_open_smoke_jsdom()
    # issue #59 制度化(v3.6.1):主限法请求构造器必须产出身份键读到的每个字段 ——
    # 我方 PERF-R8 复制体没跟上上游 v3.6.0 扩容 ⇒ 6 个工具条维度成死开关(静默,构建期零告警)。
    check_pd_request_builder_complete()
    # v3.7.0:天星择日条件类型注册表前↔后端双向差空(镜像上游 preflight [184];jest 哨兵之外的
    # 零依赖秒级复核,防「前端死开关/后端藏功能」两向漂移)。
    check_election_condition_types_parity()
    check_wheel_art_chain()
    # v3.3.4:dist 构建指纹 + 编译锚(镜像上游 preflight [122];脏树构建的产物禁止发布)。
    check_frontend_build_fingerprint()
    check_payload_slimmed()
    check_release_assets(V)
    check_release_doc_hashes(V)
    check_update_feed_consistency(V)
    check_technique_open_smoke_evidence(V)
    # #109 收尾:真机 Java 数据级证据(四柱三路径互证 + Python 引擎 oracle + 加解密 v2 真在用)
    check_java_data_probes_evidence(V)
    check_update_signature(V)
    check_app_update_yml()
    check_harness_manifest()
    # DELTA-V2 增量更新契约 (self-enforcing packaging-structure gates)
    check_payload_format_and_path_budget()
    # SELF-HEAL-R2:payloadId 确定性契约(pip RECORD/direct_url 不发货 + runtime.manifest 无时间戳);
    # v3.7.3 起 +③ 发货 CDS 归档逐版字节恒等(Windows 对位 Mac [193] 修二,防 24MB 每版重下)。
    check_payload_determinism(V)
    # v3.7.3(镜像上游 [197]):调试插桩零残留 —— 探针混进发布产物是拆包才发现的一类事故。
    check_debug_probe_residue()
    check_installer_size_ceiling(V)
    check_differential_efficiency(V)
    check_nsis_template_patch()
    # 全球健壮性轮(2026-07-05):发货物 dev 路径扫描 + 非 ASCII 星历路径实测门。
    check_devpath_bakein()
    check_sweph_cjk_path()
    # R3:Web/本地版一键启停链路门(Windows 原生 ps1/bat + bash 三件套)。
    check_local_launchers()
    check_kentang_services()
    check_all_services_http()
    # 末位门(#108):指导性元文档与本次门数/版本/gotcha 存档锁步 —— 必须最后跑,它数前面的门。
    check_docs_lockstep(V)
    width = max(len(n) for n, _, _ in results)
    failed = 0
    for name, ok, detail in results:
        tag = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{tag}] {name.ljust(width)}  {detail}")
    print()
    if failed:
        print(f"[selfcheck] {failed} gate(s) FAILED - do not release.")
        return 1
    print("[selfcheck] OK - all release gates passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
