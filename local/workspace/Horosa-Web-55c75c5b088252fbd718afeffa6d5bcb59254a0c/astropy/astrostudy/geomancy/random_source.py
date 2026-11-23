# -*- coding: utf-8 -*-
"""起卦随机源:rng / time / manual + dice/sand/coins/tablets 视觉皮肤(同一随机源,不同呈现,非物理模拟)。
随机起卦 = 真随机:种子是一段「真随机记录」(见 astrostudy/truerandom.py)时按顺序直接读记录里的系统随机位,
没给种子时当场向系统随机源取;手动整数种子 / 时间种子是确定性起法,照旧按种子复现同盘。"""
from __future__ import annotations

import random
from typing import Optional

from ..truerandom import TapeRandom, is_entropy_seed, system_random

# numbers = 报数起卦(真收十六数、奇偶定爻,盾牌不由 RNG 出;此处收其名以便如实回传所用之法)
CAST_METHODS = ("rng", "time", "manual", "dice", "sand", "coins", "tablets", "numbers")
MARK_STYLES = ("dots", "lines", "bindu", "tablets")
# 记号样式别名:某流派档以「点线」连称,归一到既有 bindu(否则静默回落 dots,该档记号形同虚设)
MARK_STYLE_ALIASES = {"bindu_rekha": "bindu", "bindu-rekha": "bindu", "rekha": "bindu"}


# 子过程各从主记录里切一段固定长度的子记录:用多用少都不挪动主记录后面的读取位置。
# 长度按各自最费的情形留足余量(逐星起点定宫:每星四次 1–16 定数,不丢弃;上升取法:四枚钱;
# 行星地占盘:每宫四次 1–9 报数,越界重读,实测均值约 43 字节、标准差约 4 字节)。
SUB_TAPE_BYTES = {"bytwelves": 32, "ascendant": 8, "planetary": 96}
# 随机起一盘要取的真随机记录总长(字节):三段子记录 + 主序(盾牌十六爻与各传本附加起法,实测不到 20 字节)。
GEOMANCY_ENTROPY_BYTES = 192


def make_rng(cast_method: str = "rng", seed=None,
             time_seed: Optional[int] = None) -> random.Random:
    """返回本盘的随机源。真随机记录 → 回放记录;manual→用 seed;time→用 time_seed(上游传入,内核不取系统时间);
    其余皮肤(dice/sand/coins/tablets)=同一随机源不同呈现。seed 缺省时当场向系统随机源取(不可复现)。"""
    if is_entropy_seed(seed):
        return TapeRandom.from_seed(seed)
    if cast_method == "manual" and seed is not None:
        return random.Random(int(seed))
    if cast_method == "time" and time_seed is not None:
        return random.Random(int(time_seed))
    if seed is not None:
        return random.Random(int(seed))
    return system_random()


def sub_rng(rng, part: str) -> random.Random:
    """给子过程一个独立的随机源(不污染盘序)。整数种子的旧盘仍按原法由主序取 64 位播种,逐字节照旧。"""
    if isinstance(rng, TapeRandom):
        return rng.fork(SUB_TAPE_BYTES[part])
    if isinstance(rng, random.SystemRandom):
        return system_random()
    return random.Random(rng.getrandbits(64))


def normalize_cast_method(v: str) -> str:
    return v if v in CAST_METHODS else "rng"


def normalize_mark_style(v: str) -> str:
    v = MARK_STYLE_ALIASES.get(v, v)
    return v if v in MARK_STYLES else "dots"
