#!/usr/bin/env python3
"""PERF-R9 逐字节黄金台架 —— 证明性能改动零功能降级。

用法(从仓库根目录跑):
    python windows-adaptations/golden/verify_golden.py --capture      # 改动**之前**抓基线
    python windows-adaptations/golden/verify_golden.py --verify       # 改动**之后**比对,任何漂移即非零退出
    python windows-adaptations/golden/verify_golden.py --verify --quick
    python windows-adaptations/golden/verify_golden.py --verify --groups qimen
    python windows-adaptations/golden/verify_golden.py --verify --case qimen.base.hour.zhirun.zhuan.11

设计要点(改之前先读):
  * **存哈希不存载荷** —— 3700 例 × 8KB ≈ 25MB 不可能进 git;× 80B ≈ 300KB 可以。
    失配时才把完整载荷写到 gitignored 的 tmp/golden/ 供人眼比对。
  * **每例两个哈希**:raw_sha256 = 响应字节;canon_sha256 = json.dumps(sort_keys) 后的字节。
    raw 变而 canon 不变 ⇒ 「内容相同、键序改变」,是字典构造重构的正常副作用,与真回归区分开。
  * **自带隔离服务** —— 用 free_port(18898+) 起自己的实例,**永不碰 :8899**
    (owner 的 app 常驻 :8899;历史上 hostile smoke 就因为硬编码 8899 而假 PASS)。
  * **环境钉死** —— PYTHONHASHSEED=0 + 内嵌解释器 + 固定 swefiles;基线头记录启动模式,
    跨模式(自启 vs --base)拒绝比对,因为两者的服务端状态不可比。

失败即非零退出码,可直接接进 release_selfcheck。
"""

import argparse
import hashlib
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BASELINE = os.path.join(HERE, "baseline.json")
MATRIX_PY = os.path.join(HERE, "matrix.py")
DUMP_DIR = os.path.join(REPO, "tmp", "golden")

sys.path.insert(0, HERE)
import matrix  # noqa: E402

DEFAULT_WS = os.path.join(
    REPO, "local", "workspace",
    "Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c")
DEFAULT_PY = os.path.join(REPO, "local", "workspace", "runtime", "windows", "python", "python.exe")


# ---------------------------------------------------------------------------
# 服务启动(与 desktop_installer_bundle/scripts/verify_all_services.py 同配方)
# ---------------------------------------------------------------------------

def free_port(base=18898):
    for p in range(base, base + 80):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError("no free port in [%d, %d)" % (base, base + 80))


def launch_service(project, python_exe, verbose=False):
    """起一个隔离的排盘服务,返回 (port, proc, stop_fn)。"""
    port = free_port()
    boot = (
        "import os, runpy, sys; os.chdir(%r); "
        "sys.path[:] = [p for p in sys.path if p not in ('', os.getcwd())]; "
        "sys.path[0:0]=[%r, %r, %r]; "
        "runpy.run_path(%r, run_name='__main__')"
    ) % (project,
         os.path.join(project, "astropy"),
         os.path.join(project, "flatlib-ctrad2"),
         os.path.join(project, "vendor"),
         os.path.join(project, "astropy", "websrv", "webchartsrv.py"))
    sweph = os.path.join(project, "flatlib-ctrad2", "flatlib", "resources", "swefiles")
    env = dict(os.environ)
    env.update({
        "HOROSA_CHART_PORT": str(port),
        "HOROSA_SWISSEPH_PATH": sweph, "HOROSA_SWEPH_PATH": sweph, "SE_EPHE_PATH": sweph,
        "PYTHONNOUSERSITE": "1", "PYTHONUTF8": "1",
        # ⚠️ PYTHONHASHSEED 在这里是**无效的** —— 下面的启动用了 `-E`,而 `-E` 的语义正是
        # 「忽略所有 PYTHON* 环境变量」。留着它只会误导下一个人以为确定性有保障。
        # 保留 `-E` 是刻意的(它承担真正的环境隔离:毒化的 PYTHONHOME/PYTHONPATH 不得渗入)。
        # ⇒ 确定性必须来自**产品代码本身**,而不是靠外部钉种子。这也正是发货 app 的真实处境:
        #    它同样不设 PYTHONHASHSEED,哈希随机化默认开启。本轮据此修掉了
        #    perchart.getParallel 的 set-顺序不稳定(horosa_decl_parallel_stable_order_v1);
        #    今后 --verify 若报「纯顺序」差异,先怀疑又有哪里把 set/dict 直接吐进了响应。
        "PYTHONHASHSEED": "0",   # 记录意图;`-E` 下不生效,见上
        "HOROSA_REQUIRE_EMBEDDED_RUNTIME": "1", "HOROSA_TRUSTED_RUNTIME": "true",
        "HOROSA_SKIP_RUNTIME_WARMUP": "true", "HOROSA_DESKTOP_MONGO_OPTIONAL": "1",
        "HOROSA_DESKTOP_MONGO_SKIP_PING": "true",
    })
    proc = subprocess.Popen([python_exe, "-E", "-s", "-X", "utf8", "-c", boot],
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            cwd=project, env=env)
    ready = False
    t0 = time.time()
    tail = []
    while time.time() - t0 < 240:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                break
            continue
        text = line.decode("utf-8", "replace").rstrip()
        tail.append(text)
        if verbose:
            print("   | " + text)
        if "HOROSA_READY" in text:
            ready = True
            break
    if not ready:
        try:
            proc.kill()
        except Exception:
            pass
        print("[golden] FAIL: chart service never became ready. Last output:")
        for ln in tail[-25:]:
            print("   | " + ln)
        raise SystemExit(5)

    # CherryPy 每个请求写一行 access log 到 stdout;不持续排空,64KB 管道一满
    # 服务端就会卡在 log 写入里,所有后续请求超时 —— 看起来像服务坏了,其实是自伤。
    def _drain():
        try:
            while True:
                if not proc.stdout.readline():
                    return
        except Exception:
            return
    t = threading.Thread(target=_drain, daemon=True)
    t.start()

    def stop():
        # 只杀我们自己 spawn 的这一个进程,绝不扩大化。
        try:
            proc.kill()
            proc.wait(timeout=15)
        except Exception:
            pass

    print("[golden] service ready on 127.0.0.1:%d in %.1fs" % (port, time.time() - t0))
    return port, proc, stop


# ---------------------------------------------------------------------------
# 请求 + 哈希
# ---------------------------------------------------------------------------

# horosa_golden_now_field_norm_v1 —— 「今天派生」字段的哈希前外科归一。
#
# 事实(2026-07-22 跨日首暴):/india/chart 响应内嵌 gochara(行运)节,其 transitDate 与
# 参考月亮星座等全部按**服务器今天**取值 —— 功能语义正确(行运就该看今天),但金标按字节钉
# 会「昨钉今漂」:12 个 india 例在跨日后整族假红,而 --selftest(同进程同日)结构性测不出。
# 与 qizhengkin 缺年键 now() 兜底同类,是第二个被证实的「now 派生面」。
#
# 治理原则(#71:判据自身要有分辨力,但不能把功能钉死):
#   · 产品不动 —— gochara 按今天是功能,不是缺陷;
#   · 哈希前把 gochara 子树替换为哨兵串 "__HOROSA_GOLDEN_NOW_NORMALIZED__":
#     - 子树**存在性**仍被钉住(哪天上游把 gochara 整节删了,哈希照样变、照样红);
#     - 子树内容(逐日变化面)不再进钉;
#   · raw 与 canon 两个哈希都吃归一后的字节(raw 的「键序判别」价值保留:归一在 parse 之后、
#     dumps(保持原键序)之前完成);解析失败(非 JSON)时退回原始字节 —— 与旧行为一致。
#   · 只对声明了 now 派生面的案例族生效(白名单,绝不通配)。
NOW_FIELD_NORMALIZERS = {
    # 案例 id 前缀 -> 需归一的顶层子树键
    "astro.india.": ("gochara",),
}

# horosa_golden_now_field_norm_v2(2026-08-01 跨日第二次复发)—— **作用域内**键名归一。
#
# 事实:v3.6.0 的金标在 07-31 钉,08-01 跨日后 18 个 india 例整族假红。取证链(#71 纪律,
# 三步全做,不猜):①`git status` 证 astropy 与 HEAD 逐字节相同(本轮零 Python 改动);
# ②同日两跑逐字节相同(排除非确定性);③产品码直证 —— `astropy/astrostudy/india/
# jyotish_engine.py` 三处 `now = datetime.now()` 配 `is_active = start <= now < end`,产出
# `dasha.<系统>.current` 子树与各级 `active` 标志。⇒ 唯一变的输入是时钟,不是代码。
# 「当前大运」按今天算是功能(与 gochara 同性质),v1 的白名单只盖了 gochara,漏了 dasha。
#
# 治理:不整棵归一 dasha(那会把大运计算这一大块功能面从金标里挖掉),只归一 now 选出来的
# 那几个键 —— `current` / `currentYear` / `active` —— 且**仅在 dasha 子树内**生效:
#   · 起讫/年数/星主/年龄等出生派生字段继续逐字节钉(真回归照样红);
#   · 键的存在性仍被钉住(整节被删照样红);
#   · 实测响应里这三个键名在 dasha 之外只出现在 gochara(已被整节归一、不会递归进去),
#     作用域限定是「当下已足够 + 将来上游新增同名非 now 字段也不会被误归一」的双保险。
# horosa_golden_now_field_norm_v3(2026-08-02 跨日第三次复发)—— 规则升级为**每作用域独立键集**。
#
# 事实:v3.6.1 重钉(08-01)后次日 18 例 india 又整族假红。取证链(#71 三步,全做):
# ①git status 证 india 引擎零改动;②同日两跑 617,439B 逐字节相同(排除非确定性);
# ③响应内路径直证 —— 今天派生面共三处:/jyotish/gochara(v1 已整树归一)+
#   /jyotish/rasiDasha/kalachakra/dehachanchala(transitDate+hits 按今天行运)+
#   /jyotish/sarvatobhadra(SBC:transits=今日行星宿位 + hits + transitDate)。
# 后两处是 v3.6.0 印占扩容(KP/SBC/七大运)新增的行运面,v1/v2 白名单没盖到;
# 08-01 重钉当天与 08-02 前半段行运恰好未翻面,故 v3.6.2 轮零漂移是「同日窗口」的假稳定。
#
# 为什么不能把键集扁平合并进一条规则:'hits' 还出现在 /jyotish/sensitivePoints/gandanta/hits
# ——那是**出生派生**(本命行星落水火交界),归一它=把功能面从金标里挖掉。故 v3 改为
# 每作用域配自己的键集;各域内其余键(deha/jeeva/grid/layout/natalRefs/vedha*)继续逐字节钉,
# 键的存在性照旧被钉(整节被删照样红)。
SCOPED_NOW_FIELD_NORMALIZERS = {
    # 案例 id 前缀 -> ((作用域键, 该作用域内需归一的键集合), ...)
    "astro.india.": (
        (("dasha",), ("current", "currentYear", "active")),
        (("dehachanchala",), ("transitDate", "hits")),
        (("sarvatobhadra",), ("transitDate", "hits", "transits")),
    ),
}

# ⚠️ 已知状态敏感例(2026-07-22 记档,非回归):astro.chart.ancient 的响应字节
# 依赖「前置 qimen 流量」——全矩阵序(qimen→astro)下恒定并与钉一致;单例/纯 astro 组
# 冷跑会稳定复现另一形态(三进程字节全同;新旧两树逐字节一致=存量潜伏,不是本轮引入)。
# 发布门只跑全矩阵模式 ⇒ 判定有效;单例诊断该案时以全序结果为准。
# 根因(哪个 qimen 侧共享态改写了 BC 路径输出)列 PERF_INVENTORY 缺口表,下一轮定位。


def _normalize_now_fields(case_id, raw):
    rules = None
    for prefix, keys in NOW_FIELD_NORMALIZERS.items():
        if case_id.startswith(prefix):
            rules = keys
            break
    # horosa_golden_now_field_norm_v2/v3:作用域内键名规则(见上方注释;v3 起每域独立键集)。
    scoped_rules = ()
    for prefix, rule_list in SCOPED_NOW_FIELD_NORMALIZERS.items():
        if case_id.startswith(prefix):
            scoped_rules = rule_list
            break
    if not rules and not scoped_rules:
        return raw
    rules = rules or ()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return raw
    changed = False

    def scrub(node, active_scopes=()):
        # active_scopes = 已进入的作用域规则下标集合;各域只归一自己声明的键集,
        # 防止 'hits' 这类同名键在出生派生子树(如 gandanta)被误归一。
        nonlocal changed
        if isinstance(node, dict):
            for k in list(node.keys()):
                if k in rules:
                    node[k] = "__HOROSA_GOLDEN_NOW_NORMALIZED__"
                    changed = True
                    continue
                if any(k in scoped_rules[i][1] for i in active_scopes):
                    node[k] = "__HOROSA_GOLDEN_NOW_NORMALIZED__"
                    changed = True
                    continue
                entered = tuple(set(active_scopes) | {
                    i for i, (sk, _kk) in enumerate(scoped_rules) if k in sk
                })
                scrub(node[k], entered)
        elif isinstance(node, list):
            for item in node:
                scrub(item, active_scopes)

    scrub(payload)
    if not changed:
        return raw
    # 保持原键序 dumps(sort_keys=False):raw 哈希仍能分辨「键序改变」这一维。
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def canon_hash(raw):
    """内容规范化哈希:键序无关。解析失败则退回 raw 哈希(并标记)。"""
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    try:
        blob = json.dumps(payload, sort_keys=True, ensure_ascii=False,
                          separators=(",", ":")).encode("utf-8")
    except Exception:
        return None
    return hashlib.sha256(blob).hexdigest()


def result_code_of(raw):
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return "non-json"
    if isinstance(payload, dict) and "ResultCode" in payload:
        return payload.get("ResultCode")
    return None


def run_case(base_url, case, timeout=180):
    url = base_url + case["mount"] + case["subpath"]
    body = case.get("body")
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=case.get("method", "POST"))
    if data is not None:
        req.add_header("Content-Type", "application/json; charset=UTF-8")
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as rsp:
            raw = rsp.read()
            status = rsp.status
    except urllib.error.HTTPError as e:
        raw = e.read() or b""
        status = e.code
    except Exception as e:
        return {"error": "%s: %s" % (type(e).__name__, e),
                "ms": round((time.perf_counter() - t0) * 1000, 1)}
    # horosa_golden_now_field_norm_v1:哈希前归一「今天派生」子树(白名单案例族;见上)。
    hashed = _normalize_now_fields(case["id"], raw)
    return {
        "status": status,
        "bytes": len(raw),
        "raw_sha256": hashlib.sha256(hashed).hexdigest(),
        "canon_sha256": canon_hash(hashed),
        "result_code": result_code_of(raw),
        "ms": round((time.perf_counter() - t0) * 1000, 1),
        "_raw": raw,
    }


def matrix_sha256():
    with open(MATRIX_PY, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="PERF-R9 逐字节黄金台架")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--capture", action="store_true", help="抓基线(改动之前跑)")
    g.add_argument("--verify", action="store_true", help="比对基线(改动之后跑)")
    g.add_argument("--selftest", type=int, metavar="N", default=0,
                   help="同一进程内把矩阵连跑 N 遍,报告任何自身不稳定的用例。"
                        "抓基线之前必须先过这一关 —— 服务若非确定性,基线毫无意义")
    ap.add_argument("--quick", action="store_true", help="精简矩阵(每次提交跑)")
    ap.add_argument("--groups", nargs="*", default=None,
                    choices=["qimen", "astro", "kentang"], help="只跑指定族")
    ap.add_argument("--case", default=None, help="只跑单例并 dump 完整载荷")
    ap.add_argument("--project", default=DEFAULT_WS)
    ap.add_argument("--python", dest="python_exe", default=DEFAULT_PY)
    ap.add_argument("--base", default=None,
                    help="复用已在跑的服务(如 http://127.0.0.1:8899);"
                         "注意 capture 与 verify 必须同模式")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    cases = matrix.build_cases(quick=args.quick, groups=args.groups)
    if args.case:
        cases = [c for c in cases if c["id"] == args.case]
        if not cases:
            print("[golden] ERROR: no such case id: %s" % args.case)
            return 2
    mode = "external" if args.base else "spawned"

    stop = None
    if args.base:
        base_url = args.base.rstrip("/")
        print("[golden] using EXTERNAL service at %s" % base_url)
    else:
        if not os.path.isfile(args.python_exe) or not os.path.isdir(args.project):
            print("[golden] ERROR: runtime not found (python=%s project=%s)"
                  % (args.python_exe, args.project))
            return 2
        port, _proc, stop = launch_service(args.project, args.python_exe, args.verbose)
        base_url = "http://127.0.0.1:%d" % port

    try:
        if args.selftest:
            # 确定性自证:同一个服务进程内连跑 N 遍。任何用例的 raw 哈希在两遍之间变化,
            # 都说明响应里混进了非确定量(时间戳/集合序/随机数),那么整个黄金思路对它失效,
            # 必须先把它从矩阵里剔除并记录理由,而不是让基线去追一个动靶。
            runs = []
            for n in range(args.selftest):
                seen = {}
                for case in cases:
                    r = run_case(base_url, case)
                    r.pop("_raw", None)
                    seen[case["id"]] = r.get("raw_sha256") or ("ERR:" + str(r.get("error")))
                runs.append(seen)
                print("[golden] selftest pass %d/%d done (%d cases)" % (n + 1, args.selftest, len(cases)))
            unstable = [c["id"] for c in cases
                        if len({r[c["id"]] for r in runs}) != 1]
            print("")
            print("[golden] ===== SELFTEST =====")
            print("[golden] cases   : %d" % len(cases))
            print("[golden] passes  : %d" % args.selftest)
            print("[golden] unstable: %d" % len(unstable))
            for cid in unstable[:40]:
                print("   ! unstable : %s" % cid)
            return 1 if unstable else 0

        results = {}
        dumps = []
        t_all = time.time()
        for i, case in enumerate(cases, 1):
            r = run_case(base_url, case)
            raw = r.pop("_raw", None)
            results[case["id"]] = r
            if args.case and raw is not None:
                dumps.append((case["id"], raw))
            if args.verbose or i % 200 == 0 or i == len(cases):
                print("[golden] %d/%d  %s  %s" % (
                    i, len(cases), case["id"],
                    r.get("error") or ("%dB %.0fms rc=%s" % (r["bytes"], r["ms"], r["result_code"]))))
        print("[golden] %d cases in %.1fs" % (len(cases), time.time() - t_all))

        if dumps:
            os.makedirs(DUMP_DIR, exist_ok=True)
            for cid, raw in dumps:
                p = os.path.join(DUMP_DIR, cid + ".json")
                with open(p, "wb") as f:
                    f.write(raw)
                print("[golden] dumped %s" % p)

        if args.capture:
            if args.quick or args.groups or args.case:
                print("[golden] REFUSING to capture a partial baseline "
                      "(--quick/--groups/--case). Capture must be the FULL matrix, "
                      "otherwise --verify would silently pass on uncovered cases.")
                return 3
            errs = [cid for cid, r in results.items() if r.get("error")]
            if errs:
                print("[golden] FAIL: %d case(s) errored during capture; "
                      "a baseline with holes is worse than none:" % len(errs))
                for cid in errs[:20]:
                    print("   - %s: %s" % (cid, results[cid]["error"]))
                return 4
            doc = {
                "_header": {
                    "matrix_sha256": matrix_sha256(),
                    "mode": mode,
                    "case_count": len(cases),
                    "note": "PERF-R9 golden baseline. Regenerate with --capture whenever "
                            "matrix.py changes; release_selfcheck gates matrix_sha256.",
                },
                "cases": results,
            }
            with open(BASELINE, "w", encoding="utf-8", newline="\n") as f:
                json.dump(doc, f, indent=1, sort_keys=True, ensure_ascii=False)
                f.write("\n")
            print("[golden] baseline written: %s (%d cases)" % (BASELINE, len(cases)))
            return 0

        # --- verify ---
        if not os.path.isfile(BASELINE):
            print("[golden] FAIL: no baseline. Run --capture on unmodified code first.")
            return 6
        with open(BASELINE, "r", encoding="utf-8") as f:
            doc = json.load(f)
        head = doc.get("_header", {})
        base_cases = doc.get("cases", {})
        if head.get("matrix_sha256") != matrix_sha256():
            print("[golden] FAIL: matrix.py changed since the baseline was captured.")
            print("  baseline matrix_sha256 = %s" % head.get("matrix_sha256"))
            print("  current  matrix_sha256 = %s" % matrix_sha256())
            print("  -> re-capture on UNMODIFIED code, or you are comparing against a lie.")
            return 7
        if head.get("mode") != mode:
            print("[golden] FAIL: baseline was captured in %r mode, this run is %r. "
                  "Server state is not comparable across modes." % (head.get("mode"), mode))
            return 8

        raw_drift, canon_drift, rc_flip, errored, missing = [], [], [], [], []
        for case in cases:
            cid = case["id"]
            now = results[cid]
            was = base_cases.get(cid)
            if was is None:
                missing.append(cid)
                continue
            if now.get("error"):
                errored.append((cid, now["error"]))
                continue
            if now["raw_sha256"] == was["raw_sha256"]:
                continue
            if now.get("canon_sha256") and now["canon_sha256"] == was.get("canon_sha256"):
                canon_drift.append(cid)
            else:
                raw_drift.append(cid)
            if now.get("result_code") != was.get("result_code"):
                rc_flip.append((cid, was.get("result_code"), now.get("result_code")))

        print("")
        print("[golden] ===== VERDICT =====")
        print("[golden] cases compared : %d" % len(cases))
        print("[golden] raw drift      : %d" % len(raw_drift))
        print("[golden] key-order only : %d" % len(canon_drift))
        print("[golden] ResultCode flip: %d" % len(rc_flip))
        print("[golden] errored        : %d" % len(errored))
        print("[golden] missing in base: %d" % len(missing))

        for cid, was, now in rc_flip[:40]:
            print("   ! RC %s -> %s : %s" % (was, now, cid))
        for cid in raw_drift[:40]:
            print("   ! raw drift : %s" % cid)
        for cid in canon_drift[:20]:
            print("   ~ key order : %s" % cid)
        for cid, err in errored[:20]:
            print("   ! error     : %s  %s" % (cid, err))
        for cid in missing[:20]:
            print("   ! missing   : %s" % cid)

        if raw_drift or canon_drift or errored or missing:
            print("")
            print("[golden] re-run a single case with full payload dump:")
            worst = (raw_drift or canon_drift or [c for c, _ in errored] or missing)[0]
            print("    python windows-adaptations/golden/verify_golden.py --verify --case %s" % worst)
            return 1
        print("[golden] ZERO DRIFT.")
        return 0
    finally:
        if stop:
            stop()


if __name__ == "__main__":
    sys.exit(main())
