# -*- coding: utf-8 -*-
"""年份钳位登记表(全年份域承诺 × 某一层历表有年份上下限)。

`max(下限, min(上限, 年))` 这种钳位一旦用到显示或计算上,域外年份就会被悄悄当成边界年(公元前显示成 1900 年)
或在边界年本身越界(2100 年 cnlunar 失败)。服务与计算层里每一处年份钳位都必须登记:只影响哪些输出、域外怎么显示。
新增未登记即红;登记了但代码里已没有即红(过期)。
"""
import ast
from pathlib import Path

_ASTROPY = Path(__file__).resolve().parent.parent
_SCAN_DIRS = ["websrv", "astrostudy"]

# 「相对路径::被钳的表达式源码」→ 理由
REGISTRY = {
    "websrv/webtaixuansrv.py::raw_year": "只作 Taixuan 构造器的占位年(起卦只吃种子);农历 / 冬至 / 四柱 / 种子都按原始年,域外农历走全年份域件",
    "astrostudy/perchart.py::int(round(float(data['pdYears'])))": "主限推运年数(时长,不是历年)",
    "astrostudy/india/rasi_dasha.py::years": "星座大运年数 1–12(时长,不是历年)",
    "astrostudy/india/dasha_extended.py::years": "星座大运年数 1–12(时长,不是历年)",
}


def _is_name_call(node, name):
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == name and len(node.args) == 2


def _clamps(path):
    text = path.read_text(encoding="utf-8")
    out = []
    for node in ast.walk(ast.parse(text)):
        if not _is_name_call(node, "max"):
            continue
        inner = node.args[1]
        if not _is_name_call(inner, "min"):
            continue
        target = ast.get_source_segment(text, inner.args[1]) or ""
        if "year" in target.lower():
            out.append(target)
    return out


def _scan():
    found = set()
    for d in _SCAN_DIRS:
        for p in sorted((_ASTROPY / d).rglob("*.py")):
            rel = p.relative_to(_ASTROPY).as_posix()
            for target in _clamps(p):
                found.add(f"{rel}::{target}")
    return found


def test_every_year_clamp_is_registered():
    found = _scan()
    assert sorted(found - set(REGISTRY)) == []


def test_registry_has_no_stale_entries():
    found = _scan()
    assert sorted(set(REGISTRY) - found) == []


def test_detector_sees_a_clamp(tmp_path):
    p = tmp_path / "x.py"
    p.write_text("raw_year = 3\nyear = max(1900, min(2100, raw_year))\nn = max(8, min(1024, n))\n", encoding="utf-8")
    assert _clamps(p) == ["raw_year"]
