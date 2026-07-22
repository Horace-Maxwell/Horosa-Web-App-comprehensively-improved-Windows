# -*- coding: utf-8 -*-
"""马达加斯加 Sikidy(异或表盘):16 列 toetry。列1-4 随机母 → 列5-8 转置 → 列9-16 XOR 级联;附三道一致性校验。"""
from __future__ import annotations

import random
from typing import Dict, Optional, Tuple

SIKIDY_COL_NAMES = {
    1: "Tale", 2: "Maly", 3: "Fahatelo", 4: "Bilady", 5: "Fianahana", 6: "Abidy",
    7: "Betsimisay", 8: "Fahavalo", 9: "Fahasivy", 10: "Omasina", 11: "Haja",
    12: "Haky", 13: "Sorotany", 14: "Saily", 15: "Safary", 16: "Akiba",
}


def _xorcol(a: Tuple[int, ...], b: Tuple[int, ...]) -> Tuple[int, ...]:
    return tuple(1 if a[i] != b[i] else 0 for i in range(4))


def cast_sikidy(rng: Optional[random.Random] = None) -> Dict[int, Tuple[int, int, int, int]]:
    r = rng or random
    col: Dict[int, Tuple[int, ...]] = {}
    for c in range(1, 5):
        col[c] = tuple(r.randint(0, 1) for _ in range(4))
    for k in range(4):
        col[5 + k] = tuple(col[c][k] for c in range(1, 5))   # 列5-8 = 转置
    col[9] = _xorcol(col[7], col[8])
    col[10] = _xorcol(col[5], col[6])
    col[11] = _xorcol(col[3], col[4])
    col[12] = _xorcol(col[1], col[2])
    col[13] = _xorcol(col[9], col[10])
    col[14] = _xorcol(col[11], col[12])
    col[15] = _xorcol(col[13], col[14])
    col[16] = _xorcol(col[15], col[1])
    return col


def sikidy_valid(col: Dict[int, Tuple[int, ...]]) -> bool:
    """三道一致性校验(全部应成立)。"""
    cols = [col[i] for i in range(1, 17)]
    chk1 = any(cols[i] == cols[j] for i in range(16) for j in range(i + 1, 16))
    chk2 = (_xorcol(col[13], col[16]) == _xorcol(col[14], col[1]) == _xorcol(col[11], col[2]))
    chk3 = (sum(col[15]) % 2 == 0)
    return chk1 and chk2 and chk3


def col_to_figure(c: Tuple[int, ...]) -> int:
    """一列 4 行(火气水地,自上而下)→ 图形 int(bit3=火)。"""
    return (c[0] << 3) | (c[1] << 2) | (c[2] << 1) | c[3]


def col_points(c: Tuple[int, ...]) -> int:
    """一列点数:单点(1)计1、双点(0)计2。"""
    return sum(1 if v else 2 for v in c)


def princes_slaves(col: Dict[int, Tuple[int, ...]]) -> dict:
    """诸侯/奴隶:列点数为偶=诸侯(princes,8列)、奇=奴隶(slaves,8列)。返回列号分组。"""
    princes, slaves = [], []
    for i in range(1, 17):
        (princes if col_points(col[i]) % 2 == 0 else slaves).append(i)
    return {"princes": princes, "slaves": slaves}


def red_sikidy(col: Dict[int, Tuple[int, ...]]) -> bool:
    """红 sikidy(最凶兆):前 4 列(母)皆全双(全 0=Populus)。"""
    return all(all(v == 0 for v in col[c]) for c in range(1, 5))


def column_compare(col: Dict[int, Tuple[int, ...]], a: int, b: int) -> dict:
    """两列比对(判读用):是否相等、XOR 结果列、各自图形/点数。"""
    return {
        "equal": col[a] == col[b],
        "xor": _xorcol(col[a], col[b]),
        "figure_a": col_to_figure(col[a]), "figure_b": col_to_figure(col[b]),
        "points_a": col_points(col[a]), "points_b": col_points(col[b]),
    }


def check2b(col: Dict[int, Tuple[int, ...]]) -> bool:
    """第二组「三不可分」:(2,16)(11,13)(12,15) 三对之异或应彼此相等。
    与第一组同为结构必然,两组任取其一即可作断言,此处并出以便双重自证。"""
    a = _xorcol(col[2], col[16])
    b = _xorcol(col[11], col[13])
    c = _xorcol(col[12], col[15])
    return a == b == c


# 四方位:所据基准只言「东南为贵地、西北为奴地」而未载十六列之逐列配属,
# 故此处按四列一方均分作参考划分并标 synthesized,绝不冒充定说。
QUADRANTS = {
    "east": {"cols": [1, 2, 3, 4], "zh": "东", "valence": "noble"},
    "south": {"cols": [5, 6, 7, 8], "zh": "南", "valence": "noble"},
    "west": {"cols": [9, 10, 11, 12], "zh": "西", "valence": "servile"},
    "north": {"cols": [13, 14, 15, 16], "zh": "北", "valence": "servile"},
}


def quadrants(col: Dict[int, Tuple[int, ...]]) -> dict:
    """四方位分野:东南为贵地、西北为奴地。并出各方之诸侯(偶点)数以判强弱。
    ⚠️ 逐列配属为合成参考(基准未载),仅供分野观势,不作定说。"""
    ps = princes_slaves(col)
    prince_set = set(ps.get("princes") or [])
    out = {}
    for k, v in QUADRANTS.items():
        cols = v["cols"]
        n_prince = sum(1 for c in cols if c in prince_set)
        out[k] = {"zh": v["zh"], "valence": v["valence"], "cols": cols,
                  "princes": n_prince, "slaves": len(cols) - n_prince}
    return {"synthesized": True, "note": "逐列配属为合成参考,基准仅载东南为贵地、西北为奴地。",
            "quadrants": out}


def tokan_sikidy(col: Dict[int, Tuple[int, ...]]) -> dict:
    """独座之局:四方俱有代表、且某方仅得一位代表者,最具洞见之力,为占者所究。
    判据:以列之图分组,四方皆有诸侯在场,而某一方仅一列为诸侯。"""
    q = quadrants(col)["quadrants"]
    counts = {k: v["princes"] for k, v in q.items()}
    all_present = all(c >= 1 for c in counts.values())
    singles = [k for k, c in counts.items() if c == 1]
    return {"is_tokan": bool(all_present and singles),
            "singleton_quadrants": singles, "prince_counts": counts,
            "note": "四方俱全且有方仅一代表 → 独座之局"}
