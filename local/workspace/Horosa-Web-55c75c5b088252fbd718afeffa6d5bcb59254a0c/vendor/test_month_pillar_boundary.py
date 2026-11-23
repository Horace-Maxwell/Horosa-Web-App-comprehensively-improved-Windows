# -*- coding: utf-8 -*-
"""
月柱交節邊界回歸測試（v2.1.8）：kinwuzhao / kinastro / kintaiyi；後補五兆服務取柱、皇極、神易數。

背景：這三個 vendored 引擎與 kinqimen 一樣，原本用 sxtwl 日級 getMonthGZ 取月柱，
交節當日、交節時刻之前會被誤算進新月。各自照搬 kinqimen 修法（精確交節 + 立春兼年柱）。
（kinqimen 另有 vendor/kinqimen/test_qimen_calendar.py；前端八字頁走 lunar-javascript，本就精確。）

各引擎模組名衝突（都有 jieqi/config），無法同進程 import，故用 subprocess 逐一驗。
執行：python3 vendor/test_month_pillar_boundary.py   （在 Horosa-Web/vendor 下）
"""
import os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# (label, cwd, python-snippet that prints "月柱|年柱" for given y,mo,d,h,mi)
ENGINES = {
    "kinwuzhao": (
        os.path.join(HERE, "kinwuzhao"),
        "import jieqi as J\n"
        "def f(y,mo,d,h,mi):\n"
        "    g=J.gangzhi(y,mo,d,h,mi); print(g[1]+'|'+g[0])\n",
    ),
    "kinastro": (
        os.path.join(HERE, "kinastro"),
        "from astro.bazi.calculator import _compute_four_pillars as C\n"
        "def f(y,mo,d,h,mi):\n"
        "    p=C(y,mo,d,h,mi); print(p[1][0]+p[1][1]+'|'+p[0][0]+p[0][1])\n",
    ),
    "kintaiyi": (
        os.path.join(HERE, "kintaiyi", "src"),
        "from kintaiyi import config as C\n"
        "def f(y,mo,d,h,mi):\n"
        "    g=C.gangzhi(y,mo,d,h,mi); print(g[1]+'|'+g[0])\n",
    ),
    # 五兆服務實際取柱用的是 config.gangzhi(不是上面的 jieqi.gangzhi),皇極取 wanji.gangzhi,神易數取類內 gangzhi:
    # 三者原為 sxtwl 日級,交節時刻校正走共享件 kin_year_domain.jie_exact_year_month
    "kinwuzhao.config": (
        os.path.join(HERE, "kinwuzhao"),
        "import config as J\n"
        "def f(y,mo,d,h,mi):\n"
        "    g=J.gangzhi(y,mo,d,h,mi); print(g[1]+'|'+g[0])\n",
    ),
    "kinwangji": (
        os.path.join(HERE, "kinwangji"),
        "from kinwangji import wanji as W\n"
        "def f(y,mo,d,h,mi):\n"
        "    g=W.gangzhi(y,mo,d,h,mi); print(g[1]+'|'+g[0])\n",
    ),
    "shenyishu": (
        os.path.join(HERE, "shenyishu"),
        "import shenyishu as S\n"
        "def f(y,mo,d,h,mi):\n"
        "    g=S.Shenyishu(y,mo,d,h,minute=mi).gangzhi(); print(g['月']+'|'+g['年'])\n",
    ),
}

# (y,mo,d,h,mi, expected 月柱, expected 年柱 or None)
CASES = [
    (2005, 5, 5, 16, 30, "庚辰", None),   # 立夏 17:52 前 → 庚辰（修前誤作辛巳）
    (2005, 5, 5, 18, 0,  "辛巳", None),   # 立夏後 → 辛巳（不回歸）
    (2005, 4, 20, 10, 0, "庚辰", None),   # 辰月內（非交節日）
    (2005, 2, 4, 0, 0,   "丁丑", "甲申"),  # 立春 01:43 前 → 前一年丁丑月
    (2005, 2, 4, 23, 0,  "戊寅", "乙酉"),  # 立春後 → 乙酉年戊寅月
    (2027, 2, 4, 3, 15,  "辛丑", "丙午"),  # 立春 09:46 前(當日凌晨)→ 仍丙午年辛丑月
    (2027, 2, 4, 10, 0,  "壬寅", "丁未"),  # 立春後 → 丁未年壬寅月
    (2027, 2, 3, 23, 40, "辛丑", "丙午"),  # 立春前夜晚子時:日柱進位次日,年月柱不跟著提前進新年
]


def run_engine(label, cwd, snippet):
    calls = "".join(
        f"f({y},{mo},{d},{h},{mi})\n" for (y, mo, d, h, mi, _, _) in CASES
    )
    env = dict(os.environ)
    env["PYTHONPATH"] = HERE + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")   # 共享件 kin_year_domain 在 vendor 根
    out = subprocess.check_output(
        [sys.executable, "-c", snippet + calls], cwd=cwd, text=True, stderr=subprocess.STDOUT, env=env
    )
    return [line.strip() for line in out.strip().splitlines() if "|" in line]


def main():
    failures = 0
    for label, (cwd, snippet) in ENGINES.items():
        if not os.path.isdir(cwd):
            print(f"SKIP {label} (missing {cwd})"); continue
        try:
            results = run_engine(label, cwd, snippet)
        except subprocess.CalledProcessError as e:
            print(f"FAIL {label}: subprocess error\n{e.output}"); failures += 1; continue
        for (y, mo, d, h, mi, em, ey), got in zip(CASES, results):
            gm, gy = got.split("|")
            ok = (gm == em) and (ey is None or gy == ey)
            failures += 0 if ok else 1
            tag = "OK" if ok else "<<< FAIL"
            exp = f"月{em}" + (f" 年{ey}" if ey else "")
            print(f"  [{label}] {y}-{mo:02d}-{d:02d} {h:02d}:{mi:02d} -> 月{gm} 年{gy}  期望{exp}  {tag}")
    print("\n" + ("ALL PASS" if failures == 0 else f"{failures} FAILURES"))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
