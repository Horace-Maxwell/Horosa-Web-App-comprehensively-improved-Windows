# -*- coding: utf-8 -*-
"""宫位盘 House + 占星定局。
P1 顺铺:宫1-12 = 四母+四女+四甥(12 图入 12 宫);占星定局:上升取第1宫图星座、行星落其所主图所在宫(甲)/点数定宫(乙)。"""
from __future__ import annotations

import random
from typing import Dict, List, Optional

from .figures import add, name, zodiac_of
from .shield import Shield

# 行星 → 所主图(昼/夜两图);交点各一图。
PLANET_FIGURES = {
    "Sun": ["Fortuna Maior", "Fortuna Minor"],
    "Moon": ["Populus", "Via"],
    "Mercury": ["Albus", "Coniunctio"],
    "Venus": ["Puella", "Amissio"],
    "Mars": ["Puer", "Rubeus"],
    "Jupiter": ["Acquisitio", "Laetitia"],
    "Saturn": ["Tristitia", "Carcer"],
    "NorthNode": ["Caput Draconis"],
    "SouthNode": ["Cauda Draconis"],
}
PLANET_ORDER = ["Sun", "Moon", "Venus", "Mercury", "Saturn", "Jupiter", "Mars", "NorthNode", "SouthNode"]


def house_chart_sequential(s: Shield) -> Dict[int, int]:
    """P1 顺铺:宫1-12 = M1..M4, D1..D4, N1..N4。"""
    order = s.mothers + s.daughters + s.nieces
    return {h + 1: order[h] for h in range(12)}


def house_chart_angular(s: Shield) -> Dict[int, int]:
    """四正入宫(传本二式):四母入四正、四女入其续宫,四果宫另取对位两图相加之合成图。
    母一→一宫、母二→十宫、母三→七宫、母四→四宫;女一→十一宫、女二→二宫、女三→八宫、女四→五宫;
    三宫=盾三⊕盾六、六宫=盾二⊕盾五、九宫=盾一⊕盾八、十二宫=盾四⊕盾七。"""
    M, D = s.mothers, s.daughters
    return {
        1: M[0], 10: M[1], 7: M[2], 4: M[3],
        11: D[0], 2: D[1], 8: D[2], 5: D[3],
        3: add(M[2], D[1]), 6: add(M[1], D[0]),
        9: add(M[0], D[3]), 12: add(M[3], D[2]),
    }


# 盾位 1-12(四母·四女·四甥)→ 宫位(传本三式之置换)
_GOLDEN_DAWN_HOUSES = [10, 1, 4, 7, 11, 2, 5, 8, 12, 3, 6, 9]


def house_chart_golden_dawn(s: Shield) -> Dict[int, int]:
    """近世学派入宫式:十二图按固定置换入宫(盾位一→十宫、盾位二→一宫、盾位三→四宫……)。"""
    order = s.mothers + s.daughters + s.nieces
    return {_GOLDEN_DAWN_HOUSES[i]: order[i] for i in range(12)}


HOUSE_PLACEMENTS = ("sequential", "angular", "golden_dawn")


def house_chart(s: Shield, placement: str = "sequential") -> Dict[int, int]:
    """图形入宫三式分派。缺省顺铺 = 收编前唯一路径(默认字节零回归)。"""
    if placement == "angular":
        return house_chart_angular(s)
    if placement == "golden_dawn":
        return house_chart_golden_dawn(s)
    return house_chart_sequential(s)


def ascendant_sign(house_chart: Dict[int, int], zodiac_system: str = "classical") -> str:
    """上升 = 第1宫图星座。zodiac_system: classical(古典定局体系) / planetary(行星归属体系) /
    planetary_alt(行星归属·乙)。"""
    return zodiac_of(house_chart[1], zodiac_system)


def astro_place_planets_from_chart(house_chart: Dict[int, int]) -> Dict[str, List[int]]:
    """甲:行星落入其所主图所在之宫(可能多宫或缺席)。"""
    figs_in_house = {h: name(f) for h, f in house_chart.items()}
    placement = {}
    for p in PLANET_ORDER:
        ruled = set(PLANET_FIGURES[p])
        placement[p] = [h for h, fn in figs_in_house.items() if fn in ruled]
    return placement


def astro_place_planets_bytwelves(rng: Optional[random.Random] = None) -> Dict[str, int]:
    """乙(by-twelves):每星另起 4 行点,点数和 mod12(1..12) 定宫。"""
    r = rng or random
    out = {}
    for p in PLANET_ORDER:
        total = sum(r.randint(1, 16) for _ in range(4))
        h = total % 12
        out[p] = 12 if h == 0 else h
    return out


# 二进制图序(圆排):十六图按比特值成一圈,自右向左读。
# 注:各地另有多套固定图序,权威基准未载具体抄本序列,故此处只用可自证的二进制序,不杜撰抄本专序。
DAIRA_ORDER: List[int] = list(range(16))


def house_chart_buyut(s: Shield) -> Dict[str, object]:
    """房屋盘(buyūt):前十二图入十二宫(含义近占星十二宫),余四图(二证+判官+调和者)作总览。
    与顺铺同用十二图,差别在**读序自右向左**并另出四图总览序列 —— 故十二宫本身零回归。"""
    hc = house_chart_sequential(s)
    order_rtl = [12 - i for i in range(12)]        # 宫序自右向左
    overview = [s.right_witness, s.left_witness, s.judge, s.reconciler]
    return {
        "houses": hc,
        "read_order": order_rtl,
        "overview": overview,
        "overview_roles": ["right_witness", "left_witness", "judge", "reconciler"],
        "daira_order": list(DAIRA_ORDER),
    }


def derived_house(self_house: int, topic_house: int) -> int:
    """转宫:派生宫 = ((self-1)+(topic-1)) mod 12 + 1。"""
    return ((self_house - 1) + (topic_house - 1)) % 12 + 1


# ── 占星定局配置:上升取法 与 宫制 ──
HOUSE_SYSTEMS = ("whole_sign", "quadrant")
ASC_SOURCES = ("h1_figure", "fresh_points", "judge_figure")

SIGN_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
              "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
SIGN_ZH = {"Aries": "白羊", "Taurus": "金牛", "Gemini": "双子", "Cancer": "巨蟹",
           "Leo": "狮子", "Virgo": "处女", "Libra": "天秤", "Scorpio": "天蝎",
           "Sagittarius": "射手", "Capricorn": "摩羯", "Aquarius": "水瓶", "Pisces": "双鱼"}


def ascendant_from_source(house_chart: Dict[int, int], zodiac_system: str = "classical",
                          asc_source: str = "h1_figure",
                          rng: Optional[random.Random] = None,
                          judge: Optional[int] = None) -> dict:
    """上升取法三式(均有传本依据,应并存):
    甲 h1_figure —— 取第一宫之图,按所选星座体系得其星座为上升(缺省)。
    乙 fresh_points —— 另起四行点成一图,取其星座为上升。
    丙 judge_figure —— 取法官之图定上升(传本自出之法,可免「一宫星体必入庙」之弊)。
    乙式须用**独立子 rng**,不得污染盘序;丙式未得法官时如实回落甲式。"""
    src = asc_source if asc_source in ASC_SOURCES else "h1_figure"
    if src == "fresh_points":
        r = rng or random
        f = 0
        for k in range(4):
            f |= (1 if r.randint(1, 2) == 1 else 0) << (3 - k)
        fig = f
    elif src == "judge_figure" and judge is not None:
        fig = judge
    else:
        if src == "judge_figure":
            src = "h1_figure"
        fig = house_chart[1]
    sign = zodiac_of(fig, zodiac_system)
    return {"asc_source": src, "figure": name(fig), "sign": sign,
            "sign_zh": SIGN_ZH.get(sign, sign)}


def house_signs(asc_sign: str, house_system: str = "whole_sign") -> dict:
    """十二宫之星座序。
    ⚠️ 诚实交代:地占定局只给出上升**星座**而无度数,而象限族(如四分宫制)须有宫头度数方能分宫;
    无度数时其必然退化为整宫制。故此处如实标 degenerate,绝不伪造宫头度数充数。"""
    hs = house_system if house_system in HOUSE_SYSTEMS else "whole_sign"
    try:
        i0 = SIGN_ORDER.index(asc_sign)
    except ValueError:
        i0 = 0
    signs = [SIGN_ORDER[(i0 + k) % 12] for k in range(12)]
    degenerate = (hs == "quadrant")
    return {
        "house_system": hs,
        "degenerate_to_whole_sign": degenerate,
        "note": ("地占定局只出上升星座而无度数,象限分宫须有宫头度数,故此处退化为整宫制"
                 if degenerate else None),
        "signs": [{"house": k + 1, "sign": s, "sign_zh": SIGN_ZH.get(s, s)}
                  for k, s in enumerate(signs)],
    }
