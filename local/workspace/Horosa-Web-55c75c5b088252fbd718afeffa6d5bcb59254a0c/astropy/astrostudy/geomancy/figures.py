# -*- coding: utf-8 -*-
"""地占 16 图形:基础代数 + 图形数据(读 data/figures.json 真值源)。
约定:图形=4 bit,bit3=火(MSB) bit2=气 bit1=水 bit0=地;单点 active=1、双点 passive=0;图形相加=按位异或。
纯标准库、无副作用、可单测。"""
from __future__ import annotations

import json
import os
from typing import Dict, List

FIRE, AIR, WATER, EARTH = 3, 2, 1, 0
ELEMENT_ROWS = [FIRE, AIR, WATER, EARTH]   # 自上而下 火气水地

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def _load_figures() -> Dict[int, dict]:
    with open(os.path.join(_DATA_DIR, "figures.json"), encoding="utf-8") as f:
        raw = json.load(f)["figures"]
    return {int(k): v for k, v in raw.items()}


FIG_BY_INT: Dict[int, dict] = _load_figures()
FIG_BY_NAME: Dict[str, int] = {v["latin"]: i for i, v in FIG_BY_INT.items()}


# ---- 代数 ----
def row(fig: int, element_bit: int) -> int:
    return (fig >> element_bit) & 1


def points(fig: int) -> int:
    """点数:单点行计 1、双点行计 2。"""
    return sum(1 if (fig >> b) & 1 else 2 for b in range(4))


def add(a: int, b: int) -> int:
    """地占相加 = 按位异或。"""
    return a ^ b


def reverse(fig: int) -> int:
    """逆转:上下翻转四行(火⇄地、气⇄水)。"""
    return ((fig & 1) << 3) | ((fig & 2) << 1) | ((fig & 4) >> 1) | ((fig & 8) >> 3)


def inverse(fig: int) -> int:
    """取反:单双互换(4 bit NOT)。"""
    return (~fig) & 0b1111


def converse(fig: int) -> int:
    """逆反 = reverse∘inverse。"""
    return reverse(inverse(fig))


def figure_rows(fig: int) -> List[int]:
    return [row(fig, b) for b in ELEMENT_ROWS]


def to_ascii(fig: int) -> str:
    return "\n".join(" *  " if row(fig, b) else "* * " for b in ELEMENT_ROWS)


# ---- 查询 ----
def name(fig: int) -> str:
    return FIG_BY_INT[fig]["latin"]


def data(fig: int) -> dict:
    return FIG_BY_INT[fig]


def planet(fig: int) -> str:
    """主管行星(用于 company demi-simple 判定)。"""
    return FIG_BY_INT[fig]["planet"]


VALID_JUDGES = {i for i in FIG_BY_INT if points(i) % 2 == 0}   # 8 个偶点图(合法法官)


# ── 结构属性(数学定义,无流派分歧)──
def is_palindrome(fig: int) -> bool:
    """自逆转:上下翻转四行后仍是自身。全十六图中恰四图如此(道/众/牢狱/会合),
    是若干技法(如某些证与判官之特性)的结构根源。"""
    return reverse(fig) == fig


PALINDROME_FIGURES = {i for i in FIG_BY_INT if reverse(i) == i}

_ELEM_ZH = {FIRE: "火", AIR: "气", WATER: "水", EARTH: "地"}
_ELEM_EN = {FIRE: "Fire", AIR: "Air", WATER: "Water", EARTH: "Earth"}


def active_elements(fig: int) -> dict:
    """在场元素:某行为单点即该元素在场。此为**结构事实**,与「单一元素主管」
    (传统另指派一主元素、各家规则不同)是两回事,勿混。"""
    on = [b for b in ELEMENT_ROWS if (fig >> b) & 1]
    return {"bits": [_ELEM_EN[b] for b in on], "zh": [_ELEM_ZH[b] for b in on],
            "count": len(on)}
