# -*- coding: utf-8 -*-
"""起卦随机源:rng / time / manual + dice/sand/coins/tablets 视觉皮肤(同一 RNG,不同呈现,非物理模拟)。
确定性:manual seed 复现同盘。"""
from __future__ import annotations

import random
from typing import Optional

# numbers = 报数起卦(真收十六数、奇偶定爻,盾牌不由 RNG 出;此处收其名以便如实回传所用之法)
CAST_METHODS = ("rng", "time", "manual", "dice", "sand", "coins", "tablets", "numbers")
MARK_STYLES = ("dots", "lines", "bindu", "tablets")
# 记号样式别名:某流派档以「点线」连称,归一到既有 bindu(否则静默回落 dots,该档记号形同虚设)
MARK_STYLE_ALIASES = {"bindu_rekha": "bindu", "bindu-rekha": "bindu", "rekha": "bindu"}


def make_rng(cast_method: str = "rng", seed: Optional[int] = None,
             time_seed: Optional[int] = None) -> random.Random:
    """返回可重现的 random.Random。manual→用 seed;time→用 time_seed(上游传入,内核不取系统时间);
    其余皮肤(dice/sand/coins/tablets)=同一 RNG 不同呈现。seed 缺省时退普通随机。"""
    if cast_method == "manual" and seed is not None:
        return random.Random(int(seed))
    if cast_method == "time" and time_seed is not None:
        return random.Random(int(time_seed))
    if seed is not None:
        return random.Random(int(seed))
    return random.Random()


def normalize_cast_method(v: str) -> str:
    return v if v in CAST_METHODS else "rng"


def normalize_mark_style(v: str) -> str:
    v = MARK_STYLE_ALIASES.get(v, v)
    return v if v in MARK_STYLES else "dots"
