# -*- coding: utf-8 -*-
"""盾牌盘 Shield:四母 → 四女(转置) → 四甥 → 二证 → 判官(偶校验) → 调和者。
右证 RW=N1⊕N2(母侧/过去/问者)、左证 LW=N3⊕N4;判官 J=RW⊕LW(点数必偶);调和者 R=J⊕M1。"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import List, Optional

from .figures import add, points


@dataclass
class Shield:
    mothers: List[int]
    daughters: List[int]
    nieces: List[int]
    right_witness: int
    left_witness: int
    judge: int
    reconciler: int


def daughters_from_mothers(M: List[int]) -> List[int]:
    """四女 = 四母转置:D[j].row(k) = M[k].row(j)。"""
    D = []
    for j in range(4):
        f = 0
        for k in range(4):
            bit = (M[k] >> (3 - j)) & 1
            f |= bit << (3 - k)
        D.append(f)
    return D


def cast_shield_from_mothers(M: List[int]) -> Shield:
    if len(M) != 4:
        raise ValueError("需 4 母")
    D = daughters_from_mothers(M)
    N = [add(M[0], M[1]), add(M[2], M[3]), add(D[0], D[1]), add(D[2], D[3])]
    rw = add(N[0], N[1])
    lw = add(N[2], N[3])
    judge = add(rw, lw)
    if points(judge) % 2 != 0:
        raise AssertionError("法官点数必为偶——算法/输入有误")
    return Shield(M, D, N, rw, lw, judge, add(judge, M[0]))


RECONCILER_MODES = ("judge_first_mother", "judge_querent_significator")


def reconciler_from(judge: int, other: int) -> int:
    """调和者 = 判官 ⊕ 另一图。另一图取谁,各家有别:
    主流取首母(judge_first_mother);另有取问者指示星者(judge_querent_significator)。
    两法同为异或,仅第二操作数不同 —— 故此处只收已定的另一图,选谁由上游按模式决定。"""
    return add(judge, other)


def cast_shield_from_numbers(numbers: List[int]) -> Shield:
    """报数起卦:十六数依序为母一至母四之火风水土四行 —— 奇数为阳爻(单点)、偶数为阴爻(双点)。
    传本所载报数、点点、抛硬币、掷骰子诸法,俱以奇偶定爻,故同归此一路。"""
    if len(numbers) != 16:
        raise ValueError("报数须十六个数")
    M = [0, 0, 0, 0]
    for i in range(4):
        f = 0
        for k in range(4):
            if int(numbers[i * 4 + k]) % 2 == 1:
                f |= 1 << (3 - k)
        M[i] = f
    return cast_shield_from_mothers(M)


def cast_shield(rng: Optional[random.Random] = None, fill: str = "top_down") -> Shield:
    """随机起盘:16 随机比特 → 四母 → 全盘。fill='top_down' 先火(主流);'bottom_up' 罕见变体先地。"""
    r = rng or random
    bits = [r.randint(0, 1) for _ in range(16)]
    M = [0, 0, 0, 0]
    for i in range(4):
        f = 0
        for k in range(4):
            b = bits[i * 4 + k]
            f |= b << ((3 - k) if fill == "top_down" else k)
        M[i] = f
    return cast_shield_from_mothers(M)
