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
    return {
        "status": status,
        "bytes": len(raw),
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "canon_sha256": canon_hash(raw),
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
