# -*- coding: utf-8 -*-
"""收集范围外的测试纳入基线门(每套在独立子进程里跑)。

基线 `pytest tests/` 只收集 astropy/tests;放在 vendor / flatlib 目录里的测试从不在任何一道门里,成了从不跑的死测试。
这些引擎各自带同名顶层模块(config / jieqi / astro …),不能与本进程或彼此同进程 import,故每套在自己的目录里起子进程跑。
入选口径:项目自写的回归测试一律入门;第三方原样带来的测试,只挑「引擎被本仓改过、且整套在本仓裁剪后的副本上全绿」的入门。
不入门的登记在 test_test_collection_completeness.py 的表里并写理由。
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

_ASTROPY = Path(__file__).resolve().parent.parent
_WEB = _ASTROPY.parent

# (名, 工作目录, 参数) —— 参数里的路径相对工作目录
SUITES = [
    ("kinqimen 奇门历法回归(项目自写)", _WEB / "vendor" / "kinqimen", ["-m", "pytest", "test_qimen_calendar.py"]),
    ("三引擎月柱交节边界回归(项目自写)", _WEB / "vendor", ["test_month_pillar_boundary.py"]),
    ("kinwangji 皇极(上游套件,本仓改过引擎)", _WEB / "vendor" / "kinwangji", ["-m", "pytest", "tests"]),
    ("kinwuzhao 五兆(上游套件,本仓改过引擎)", _WEB / "vendor" / "kinwuzhao", ["-m", "pytest", "tests"]),
    ("kinastro 铁板(上游套件,本仓改过引擎)", _WEB / "vendor" / "kinastro", ["-m", "pytest", "astro/tieban/tests"]),
    ("flatlib-ctrad2(上游套件,本仓分叉)", _WEB / "flatlib-ctrad2", ["-m", "pytest", "tests"]),
]


@pytest.mark.parametrize("name,cwd,args", SUITES, ids=[s[0] for s in SUITES])
def test_vendor_suite_passes(name, cwd, args):
    assert cwd.is_dir(), f"{name}: 目录不在 {cwd}"
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    # 相对路径的 PYTHONPATH 项按本进程工作目录转成绝对路径(子进程换了工作目录)
    if env.get("PYTHONPATH"):
        env["PYTHONPATH"] = os.pathsep.join(os.path.abspath(p) for p in env["PYTHONPATH"].split(os.pathsep) if p)
    # horosa_subprocess_utf8_v1(Windows 侧移植适配;#109 row 90 同族):子进程打印中文(用例名、月柱 / 年柱),Windows 管道按
    # locale 码页(cp1252 / GBK)编解码 ⇒ 父进程读线程 UnicodeDecodeError、输出变空;月柱交节回归自己再起引擎子进程同样解码失败而红。
    # 子进程按 UTF-8 模式跑(与发货运行时的 -X utf8 同口径,孙进程随环境继承),父进程按 UTF-8 解码;macOS 上本就 UTF-8,行为不变。
    env["PYTHONUTF8"] = "1"
    cmd = [sys.executable, "-B"] + args
    if args[:2] == ["-m", "pytest"]:
        cmd += ["-q", "-p", "no:cacheprovider"]
    proc = subprocess.run(cmd, cwd=str(cwd), env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    out = (proc.stdout or "") + (proc.stderr or "")
    assert proc.returncode == 0, f"{name} 失败:\n{out[-4000:]}"
    assert "SKIP" not in out, f"{name} 有整套跳过:\n{out[-2000:]}"
