#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成/刷新 MARKER_INVENTORY.json —— overlay marker 的逐文件逐次数总账(gotcha #94)。

## 为什么需要它(两条实发的静默丢失路径,既有的门全测不出)

`release_selfcheck.py` 的哨兵门是「**至少出现一次**」的字符串门。它能抓「整条 overlay 没了」,
抓不到下面两类 —— 而这两类都在真机上表现为「装得上、点了就炸 / 功能悄悄退化」:

1. **守卫被上游收编 ⇒ 整个补丁静默跳过。** v3.8.0 同步实发:Mac 把我方接线收编进
   `ZiWeiMain.js` / `DunJiaMain.js`,两文件自带了 `horosa_prefetch_registry_v1`;而这正是
   apply.sh 里那两条补丁的守卫 marker。守卫命中 ⇒ apply.sh 打印 `[ok] already has …` ⇒
   补丁**整体跳过** ⇒ 其余 11 / 2 个 marker 的内容全丢。apply.sh 零告警,哨兵门因为
   那些 marker 在**别的文件**里还在(freeze_subtabs 共 32 个宿主)而照样全绿。
   共享守卫的暴露面极大:stable_react_keys / freeze_subtabs / panel_ready 各被 30+ 文件当守卫。

2. **补丁局部应用 / fuzz 贴错位。** 部分 hunk 被拒而守卫所在的 hunk 应用成功 ⇒
   marker 在、用法在、**绑定没有**(#84 型 ReferenceError);或 patch 以 fuzz 把 hunk 贴到
   错误的方法里、贴出双份(#78 编译级炸弹)。前者是「计数少了」,后者是「计数多了」。

**逐文件逐次数**的总账把这三种都变成机械可判的 diff:LOSS / DUP / MOVED。

## 用法

    python windows-adaptations/gen_marker_inventory.py            # 刷新总账
    python windows-adaptations/gen_marker_inventory.py --check    # 只校验,不写(门用这个)

刷新时机:**只在 overlay 或上游结构确实变了、且已人工复核过 diff 之后**。
盲目刷新 = 把事故当成新基线钉死,等于没有门。
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
INVENTORY = os.path.join(HERE, "MARKER_INVENTORY.json")

MARKER_RX = re.compile(r"horosa_[a-z0-9_]+_v\d+")
TEXT_EXT = (".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".less", ".css",
            ".json", ".sh", ".xml", ".cjs", ".mjs")
SKIP_DIRS = {"node_modules", "dist", "dist-file", ".git", "__pycache__",
             ".pytest_cache", "target", ".umi", ".umi-production"}


def workspace():
    import glob
    cands = [c for c in glob.glob(os.path.join(REPO, "local", "workspace", "Horosa-Web-*"))
             if os.path.isdir(os.path.join(c, "astrostudyui"))]
    if not cands:
        raise SystemExit("cannot locate local/workspace/Horosa-Web-*")
    return sorted(cands)[0]


def known_markers():
    """marker 的权威来源 = overlay 自己(patches/ 的新增行 + files/ 全拷贝层)。"""
    out = set()
    pdir = os.path.join(HERE, "patches")
    if os.path.isdir(pdir):
        for fn in os.listdir(pdir):
            try:
                txt = io.open(os.path.join(pdir, fn), encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            for ln in txt.splitlines():
                if ln.startswith("+") and not ln.startswith("+++"):
                    out.update(MARKER_RX.findall(ln))
    fdir = os.path.join(HERE, "files")
    if os.path.isdir(fdir):
        for dirpath, _d, files in os.walk(fdir):
            for fn in files:
                try:
                    txt = io.open(os.path.join(dirpath, fn), encoding="utf-8",
                                  errors="replace").read()
                except OSError:
                    continue
                out.update(MARKER_RX.findall(txt))
    return sorted(out)


def scan(ws, markers):
    counts = {m: {} for m in markers}
    mset = set(markers)
    for dirpath, dirs, files in os.walk(ws):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in files:
            if not fn.endswith(TEXT_EXT):
                continue
            p = os.path.join(dirpath, fn)
            try:
                txt = io.open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            if "horosa_" not in txt:
                continue
            rel = os.path.relpath(p, ws).replace("\\", "/")
            for m in mset.intersection(MARKER_RX.findall(txt)):
                n = txt.count(m)
                if n:
                    counts[m][rel] = n
    return counts


def diff(expected, actual):
    """返回 (loss, dup, missing_marker) 三类差异行。"""
    loss, dup = [], []
    for m in sorted(set(expected) | set(actual)):
        e, a = expected.get(m, {}), actual.get(m, {})
        for f in sorted(set(e) | set(a)):
            x, y = e.get(f, 0), a.get(f, 0)
            if y < x:
                loss.append("%s  %s  %d -> %d" % (m, f, x, y))
            elif y > x:
                dup.append("%s  %s  %d -> %d" % (m, f, x, y))
    return loss, dup


def main():
    check_only = "--check" in sys.argv
    ws = workspace()
    markers = known_markers()
    actual = scan(ws, markers)

    if check_only:
        if not os.path.isfile(INVENTORY):
            print("FAIL: %s missing — run gen_marker_inventory.py to create it" % INVENTORY)
            return 1
        expected = json.load(io.open(INVENTORY, encoding="utf-8"))["markers"]
        loss, dup = diff(expected, actual)
        if not loss and not dup:
            total = sum(sum(v.values()) for v in actual.values())
            print("OK marker-inventory: %d markers / %d sites, exact match" % (len(markers), total))
            return 0
        print("MARKER INVENTORY DRIFT — overlay 内容与总账不符")
        for r in loss:
            print("  [LOSS] %s" % r)
        for r in dup:
            print("  [DUP ] %s" % r)
        print("\nLOSS = 补丁被跳过/局部应用/被上游 wholesale-replace 冲掉(守卫收编坑,gotcha #94);")
        print("DUP  = patch fuzz 贴出双份(#78 编译级炸弹)。")
        print("先查明原因并修好;确认是**有意**的 overlay 变更后,再跑")
        print("  python windows-adaptations/gen_marker_inventory.py")
        print("刷新总账(盲刷 = 把事故钉成新基线)。")
        return 1

    payload = {
        "_comment": "overlay marker 逐文件逐次数总账(gotcha #94)。由 gen_marker_inventory.py 生成;"
                    "release_selfcheck 的 overlay marker inventory 门逐条比对。只在人工复核过 "
                    "diff 之后刷新。",
        "markers": {m: dict(sorted(actual[m].items())) for m in markers},
    }
    with io.open(INVENTORY, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")
    total = sum(sum(v.values()) for v in actual.values())
    empty = [m for m in markers if not actual[m]]
    print("wrote %s" % INVENTORY)
    print("  markers=%d  sites=%d  (markers with zero sites: %d)" % (len(markers), total, len(empty)))
    for m in empty:
        print("    ZERO-SITE: %s" % m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
