#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pathsep 普查器 —— 「上游源码扫描型测试在 Windows 假红」这一类的分诊工具(**不是门**)。

## 为什么是普查器而不是门(2026-08-12,gotcha #97 记档)

这一类已复发 5 次(#57 quickDockContract · #69 chartFreeContract · #86 heavyEngineImportGraph ·
#96 wheelArtChart · #97 tarotTrumpJudgeLock),形态完全一致:上游写一个扫源码的契约测试,用
`path.relative()` 得相对路径,再拿去比 POSIX 写法的白名单/期望值 —— macOS 恒绿,Windows 恒红。

本轮试过把它做成**自动门**,失败并已放弃,理由是判据无法用纯文本分离两类:
  * 真病(必须归一):`path.relative` 的结果被拿去与 POSIX 字面量**比较**;
  * 假阳(不可报):同样是 `path.relative`,结果只进**消息串**(aiExportRoundtrip /
    jsxDuplicatePropsGuard),或路径字面量只用于 `path.join(...)` **构造**
    (caseRoundTripParityAll)—— 后者在 Windows 上完全正确。
  反向也有假阴:chartFreeContract 的期望表是**别处派生的列表**,本文件内一个 POSIX 字面量都没有。
区分需要数据流分析。**一个会假阳的门两轮内必被绕过,一个会假阴的门给的是虚假安心**
(gotcha #71/#72)—— 所以这里只提供事实,判断留给人。

## 真正的检测手段与防回归手段(都已到位,不要重复造门)

  * **检测** = 在 Windows 上跑 `npx umi-test`。5 次全部由它抓到,零遗漏。
  * **防回归** = 每个已修宿主在 `release_selfcheck.py` 的 SENT 里都钉了
    `horosa_win_pathsep_posix_v1` + `relPosix`(或等价内联式)—— 上游哪天整文件覆盖,哨兵门报红。

## 用法

    python windows-adaptations/pathsep_census.py

同步轮里 umi 一旦出现「白名单/期望值类」红,先跑本普查器:offender 串里带反斜杠 = 本类,
照既有五层化配方修(relPosix 归一 + 补丁 + apply.sh 行 + SENT 三针 + 台账行)。
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def workspace():
    import glob
    cands = [c for c in glob.glob(os.path.join(REPO, "local", "workspace", "Horosa-Web-*"))
             if os.path.isdir(os.path.join(c, "astrostudyui"))]
    if not cands:
        raise SystemExit("cannot locate local/workspace/Horosa-Web-*")
    return sorted(cands)[0]


REL_CALL = re.compile(r"path\.relative\s*\(")
# 归一的两种写法:命名 helper(relPosix)与就地 .split(path.sep).join('/')
NORMALIZED_INLINE = re.compile(r"path\.relative\s*\([^)]*\)\s*\.split\(\s*path\.sep\s*\)\s*\.join\(")
HAS_HELPER = re.compile(r"relPosix\s*=\s*\(")
# 无前导点、含斜杠、以源码后缀结尾的字面量 = 典型的「白名单/期望值」形状
POSIX_LIT = re.compile(r"['\"]([A-Za-z][A-Za-z0-9_\-]*(?:/[A-Za-z0-9_\-.]+)+\.(?:js|jsx|ts|tsx|less))['\"]")


def main():
    ui = os.path.join(workspace(), "astrostudyui", "src")
    rows = []
    for root, dirs, files in os.walk(ui):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".umi", ".umi-production")]
        for fn in files:
            if not fn.endswith((".js", ".jsx")):
                continue
            p = os.path.join(root, fn)
            try:
                src = open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            calls = len(REL_CALL.findall(src))
            if not calls:
                continue
            inline = len(NORMALIZED_INLINE.findall(src))
            helper = bool(HAS_HELPER.search(src))
            lits = sorted(set(POSIX_LIT.findall(src)))
            rel = os.path.relpath(p, ui).replace("\\", "/")
            rows.append((rel, calls, inline, helper, len(lits), lits[:3]))

    rows.sort()
    print(f"pathsep census — {len(rows)} file(s) call path.relative() under astrostudyui/src\n")
    print(f"  {'file':<64} {'calls':>5} {'inline':>6} {'helper':>6} {'posixLits':>9}  status")
    print("  " + "-" * 104)
    review = []
    for rel, calls, inline, helper, nlit, sample in rows:
        normalized = helper or inline >= calls
        if normalized:
            status = "normalized"
        elif nlit:
            status = "REVIEW (naked + POSIX literals present)"
            review.append((rel, sample))
        else:
            status = "naked (no POSIX literals here — usually message-only, verify by hand)"
        print(f"  {rel:<64} {calls:>5} {inline:>6} {str(helper):>6} {nlit:>9}  {status}")

    print("\n本工具**不判定对错**,只列事实(见文件头:判据无法用纯文本分离真病与假阳)。")
    if review:
        print("以下文件同时具备「裸 path.relative」与「POSIX 路径字面量」,是本类的高嫌疑形状,请人工确认:")
        for rel, sample in review:
            print(f"  · {rel}   e.g. {sample}")
    print("\n检测手段仍是 Windows 上跑 umi;防回归靠 SENT 里每个已修宿主的 relPosix 针。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
