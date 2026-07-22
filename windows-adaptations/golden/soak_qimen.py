# -*- coding: utf-8 -*-
"""soak_qimen.py —— 奇门请求级 memo(horosa_qimen_req_memo_v1)的并发浸泡金标。

为什么单列一个脚本:请求级 memo 的唯一结构性风险是**跨请求/跨线程串染**(thread-local
容器泄漏、键漏掺开关、共享可变出参被改)。黄金矩阵是串行的,验不出这些;本脚本用
8 线程 × 各 200 请求、每步翻转 (after23NewDay, lateZiHourUseNextDay) × 4 定局 × 2 盘式,
断言每个响应的 sha256 == 该参数组合的**单线程参考哈希** —— 任何串染都会让某次响应
与参考失配,零容忍。

用法(repo 根;绝不碰 :8899,自起隔离服务):
    python windows-adaptations/golden/soak_qimen.py
    python windows-adaptations/golden/soak_qimen.py --threads 8 --per-thread 200
"""
import argparse
import hashlib
import json
import os
import sys
import threading
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import verify_golden as vg  # noqa: E402  (launch_service / free_port / DEFAULT_*)

# 两个敏感日期:立春夜 hour=23(日界/晚子时开关的唯一生效面)+ 一个平日午间对照。
DATES = [
    {"year": 2024, "month": 2, "day": 4, "hour": 23, "minute": 30},
    {"year": 2025, "month": 6, "day": 21, "hour": 12, "minute": 15},
]
QIJU = ["chaibu", "zhirun", "maoshan", "wurun"]
SCHOOLS = ["飞盘", "转盘"]


def build_params():
    out = []
    for d in DATES:
        for a23 in (0, 1):
            for lz in (0, 1):
                for qj in QIJU:
                    for sc in SCHOOLS:
                        p = dict(d)
                        p.update({
                            "after23NewDay": a23,
                            "lateZiHourUseNextDay": lz,
                            "qijuMethod": qj,
                            "school": sc,
                            "qimenMode": "hour",
                        })
                        out.append(p)
    return out


def post_pan(base_url, payload, timeout=120):
    req = urllib.request.Request(
        base_url + "/qimen/pan",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as rsp:
        return rsp.read()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--per-thread", type=int, default=200)
    ap.add_argument("--project", default=vg.DEFAULT_WS)
    ap.add_argument("--python", dest="python_exe", default=vg.DEFAULT_PY)
    args = ap.parse_args()

    if not os.path.isfile(args.python_exe) or not os.path.isdir(args.project):
        print("[soak] ERROR: runtime not found (python=%s project=%s)"
              % (args.python_exe, args.project))
        return 2

    params = build_params()
    port, _proc, stop = vg.launch_service(args.project, args.python_exe)
    base_url = "http://127.0.0.1:%d" % port
    try:
        # 单线程参考:每个参数组合先算一次基准哈希(与黄金台架同一 raw-sha 口径)。
        refs = []
        for p in params:
            raw = post_pan(base_url, p)
            refs.append(hashlib.sha256(raw).hexdigest())
        print("[soak] %d reference hashes captured" % len(refs))

        errors = []
        done = [0] * args.threads
        lock = threading.Lock()

        def worker(tid):
            # 确定性步长游走(素数步距 → 各线程翻转序互不相同,且无需 random)。
            n = len(params)
            idx = (tid * 31) % n
            step = 7 + (tid % 5)
            for i in range(args.per_thread):
                p = params[idx]
                try:
                    raw = post_pan(base_url, p)
                    h = hashlib.sha256(raw).hexdigest()
                    if h != refs[idx]:
                        with lock:
                            errors.append(
                                "thread %d iter %d param#%d hash %s != ref %s | %s"
                                % (tid, i, idx, h[:12], refs[idx][:12],
                                   json.dumps(p, ensure_ascii=False)))
                            if len(errors) >= 5:
                                return
                except Exception as e:  # noqa: BLE001 —— 失败也是失配,必须記帳
                    with lock:
                        errors.append("thread %d iter %d param#%d EXC %r" % (tid, i, idx, e))
                        if len(errors) >= 5:
                            return
                idx = (idx + step) % n
                done[tid] = i + 1

        threads = [threading.Thread(target=worker, args=(t,), daemon=True)
                   for t in range(args.threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        total = sum(done)
        if errors:
            print("[soak] FAIL — %d mismatch(es) in %d requests:" % (len(errors), total))
            for e in errors:
                print("   | " + e)
            return 1
        print("[soak] PASS — %d threads x %d params, %d requests, zero drift vs "
              "single-thread reference" % (args.threads, len(params), total))
        return 0
    finally:
        stop()


if __name__ == "__main__":
    sys.exit(main())
