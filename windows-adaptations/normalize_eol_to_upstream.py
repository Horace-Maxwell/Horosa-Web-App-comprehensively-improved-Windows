#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""产品源换行风格必须与**纯上游同名文件**一致(gotcha #95)。

## 病理

本仓 `core.autocrlf = true`。于是:
  * `port_from_mac.py` 逐字节落盘 → **LF**(与上游一致);
  * `git apply`(apply.sh 打 overlay 补丁的首选路径)与 `git checkout` → **CRLF**。
⇒ **凡被 overlay 打过补丁的文件,都会悄悄变成 CRLF**,与上游逐字节不同。

为什么长期没人发现:
  * `git status` 恒 clean —— autocrlf 下 git 比较的是归一化内容;
  * `port_from_mac.py` 的完整性校验本身就做 LF 归一(#35 的规矩,那是对的);
  * 直到 v3.8.0 上游加了**源码扫描型契约测试** `ziweiCenterPresetD4`,用
    `src.indexOf('\\n\\t}\\n')` 切方法体 —— CRLF 下恒不命中,切出整个文件尾巴,
    `bumpZwDisplayRev(` 数出 13(期望 1)当场炸。

真实代价有三层:
  ① 上游任何逐行/逐字节的源码扫描断言都可能随机失效(这类测试上游在持续增加);
  ② **发货载荷拷的是工作区字节** —— CRLF 让这些文件与上游逐字节不同;
  ③ 每次 patch 重新 CRLF 化 ⇒ 差量看到「整文件每行都变」。

## 判据

「有 CRLF」不是问题 —— 上游自己就有一批 CRLF 文件(geomancy/india/xuanshi 等,作者本来就那么写)。
**与上游不一致**才是问题。本脚本逐文件比对工作区与上游 tag 的换行风格。

## 用法

    python windows-adaptations/normalize_eol_to_upstream.py <upstream-tag> [--fix]

不带 `--fix` = 只报告(门用这个,非零退出即红)。`--fix` 就地纠正:
  * 内容(LF 归一后)与上游相同 → 直接写上游字节,恢复逐字节一致;
  * 内容不同(= 我方 overlay 改过)→ 只改换行风格为上游风格,内容一字不动。
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CLONE = os.path.join(REPO, "tmp", "mac-sync-2.6.7")
EXT = (".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".less", ".css", ".json", ".xml", ".sh", ".md")


def workspace():
    import glob
    cands = [c for c in glob.glob(os.path.join(REPO, "local", "workspace", "Horosa-Web-*"))
             if os.path.isdir(os.path.join(c, "astrostudyui"))]
    if not cands:
        raise SystemExit("cannot locate local/workspace/Horosa-Web-*")
    return sorted(cands)[0]


def eol_style(raw):
    crlf = raw.count(b"\r\n")
    lf = raw.count(b"\n")
    if lf == 0:
        return "none"
    if crlf == 0:
        return "LF"
    if crlf == lf:
        return "CRLF"
    return "MIXED"


def to_style(raw, style):
    flat = raw.replace(b"\r\n", b"\n")
    return flat.replace(b"\n", b"\r\n") if style == "CRLF" else flat


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    tag = sys.argv[1]
    fix = "--fix" in sys.argv
    ws = workspace()

    listing = subprocess.run(
        ["git", "-C", CLONE, "ls-tree", "-r", "--name-only", tag, "Horosa-Web/"],
        capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    rels = [p[len("Horosa-Web/"):] for p in listing
            if p.startswith("Horosa-Web/") and p.endswith(EXT)]

    bad, fixed, skipped = [], 0, []
    for rel in rels:
        p = os.path.join(ws, rel.replace("/", os.sep))
        if not os.path.isfile(p):
            continue
        up = subprocess.run(["git", "-C", CLONE, "show", "%s:Horosa-Web/%s" % (tag, rel)],
                            capture_output=True).stdout
        ours = io.open(p, "rb").read()
        ue, oe = eol_style(up), eol_style(ours)
        if ue == oe:
            continue
        bad.append((rel, ue, oe))
        if not fix:
            continue
        if ue == "MIXED":
            # 上游自己就是混排(手工编辑的历史遗留);无法机械复原逐行风格 ——
            # 只有在内容完全相同时才能安全地整份还原,否则跳过并报出来由人处置。
            if up.replace(b"\r\n", b"\n") == ours.replace(b"\r\n", b"\n"):
                io.open(p, "wb").write(up)
                fixed += 1
            else:
                skipped.append(rel)
            continue
        if up.replace(b"\r\n", b"\n") == ours.replace(b"\r\n", b"\n"):
            io.open(p, "wb").write(up)          # 纯 EOL 差异 → 逐字节还原上游
        else:
            io.open(p, "wb").write(to_style(ours, ue))   # 我方改过 → 只换风格,内容不动
        fixed += 1

    print("upstream product-source files scanned: %d" % len(rels))
    print("EOL style differing from upstream    : %d" % len(bad))
    for rel, ue, oe in bad[:40]:
        print("   upstream=%-5s ours=%-5s  %s" % (ue, oe, rel))
    if len(bad) > 40:
        print("   ... +%d more" % (len(bad) - 40))
    if fix:
        print("\nfixed: %d" % fixed)
        if skipped:
            print("SKIPPED (upstream MIXED + content differs — decide by hand): %d" % len(skipped))
            for r in skipped:
                print("   %s" % r)
        return 1 if skipped else 0
    if bad:
        print("\n根因:本仓 core.autocrlf=true ⇒ `git apply`/`git checkout` 写 CRLF,"
              "而 port_from_mac 逐字节写 LF。apply.sh 已改用 `git -c core.autocrlf=false apply`;"
              "存量用本脚本 --fix 纠正。")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
