# -*- coding: utf-8 -*-
"""图形之数:三套并存的「图→数」体系(择时、寻隐、寻人寻物等专门占法用)。

- points    :按点数(4–8),即内核 points()。
- planetary :按行星序(土3 木4 火5 日6 金7 水8 月9);交点无行星序,回落点数并标注。
- abjad     :取该图阿拉伯名各字母之数值和(标准 abjad 记数;定冠词与空格不计)。

各家取名不同则 abjad 之数亦不同,故本模块只据仓内所载阿拉伯名表计算,并把所用名一并回传以便复核。
"""
from __future__ import annotations

import json
import os
from typing import Dict, Optional

from .figures import FIG_BY_INT, data, points

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

NUMBER_SYSTEMS = ("points", "planetary", "abjad")

# 行星序数(土最外→月最内)。交点不入此序。
PLANET_NUMBER: Dict[str, int] = {
    "Saturn": 3, "Jupiter": 4, "Mars": 5, "Sun": 6,
    "Venus": 7, "Mercury": 8, "Moon": 9,
}


def _load_abjad() -> dict:
    with open(os.path.join(_DATA_DIR, "abjad.json"), encoding="utf-8") as f:
        return json.load(f)


_ABJAD = _load_abjad()
_LETTERS: Dict[str, int] = _ABJAD["letters"]
_IGNORE_CHARS = set(_ABJAD.get("ignore_chars", []))
_IGNORE_WORDS = list(_ABJAD.get("ignore_words", []))


def abjad_value(text: str) -> int:
    """阿拉伯文字串 → abjad 数值和。定冠词与空格不计;未知字符跳过(不抛)。"""
    s = f"{text or ''}"
    for w in _IGNORE_WORDS:
        s = s.replace(w, "")
    return sum(_LETTERS.get(ch, 0) for ch in s if ch not in _IGNORE_CHARS)


def normalize_number_system(v: Optional[str]) -> str:
    return v if v in NUMBER_SYSTEMS else "points"


def figure_number(fig: int, system: str = "points") -> dict:
    """图形之数。返回 {system, value, basis} —— basis 说明取数依据,供界面与真值核对。"""
    sysx = normalize_number_system(system)
    fd = data(fig)
    if sysx == "planetary":
        p = fd.get("planet")
        n = PLANET_NUMBER.get(p)
        if n is None:
            return {"system": "planetary", "value": points(fig),
                    "basis": "交点无行星序,回落点数", "fallback": True}
        return {"system": "planetary", "value": n, "basis": f"行星序:{p}", "fallback": False}
    if sysx == "abjad":
        ar = fd.get("name_arabic_script") or ""
        return {"system": "abjad", "value": abjad_value(ar),
                "basis": f"阿拉伯名字母值和:{ar}" if ar else "缺阿拉伯名", "fallback": not ar}
    return {"system": "points", "value": points(fig), "basis": "点数", "fallback": False}


def all_numbers(fig: int) -> Dict[str, dict]:
    """三系并出,便于界面同屏对照。"""
    return {s: figure_number(fig, s) for s in NUMBER_SYSTEMS}
