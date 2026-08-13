# -*- coding: utf-8 -*-
"""行星地占盘(以图形起七政、按报数落宫的十二宫盘)。

传本之法:先起首图,查其黄道对应定上升,顺序排列黄道十二宫;再为七政各起报数,
每星四数求和、除十二取余定其落宫(余零入十二宫)。若须交点则北交同法、南交取其对宫。
月孛与三王星为传本明许之可选加项。

⚠️ 与「占星定局落星」(house.astro_place_planets_*)是两回事:落星是把行星落进**盾牌所出的十二宫图**,
本盘则是自成一盘、宫中并无盾牌图形。二者可并存,互不覆盖。
纯标准库、无副作用、可单测。"""
from __future__ import annotations

import random
from typing import Dict, List, Optional

from .figures import name, zodiac_of
from .house import SIGN_ORDER, SIGN_ZH

# 报数取数域:传本示例以单位数报数(如 6+5+7+1=19 → 七宫),故每星取四个 1..9 之数。
PCHART_DRAW_LO, PCHART_DRAW_HI, PCHART_DRAW_COUNT = 1, 9, 4

# 七政按传本所列之序:日月水金火土木
PCHART_PLANETS: List[str] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Saturn", "Jupiter"]
PCHART_PLANETS_ZH = {
    "Sun": "太阳", "Moon": "太阴", "Mercury": "水星", "Venus": "金星", "Mars": "火星",
    "Saturn": "土星", "Jupiter": "木星", "NorthNode": "北交", "SouthNode": "南交",
    "Lilith": "月孛", "Uranus": "天王", "Neptune": "海王", "Pluto": "冥王",
}
# 三王星与月孛:传本「愿意的话也可加入」之可选加项
PCHART_EXTRAS: List[str] = ["Lilith", "Uranus", "Neptune", "Pluto"]

PCHART_ZODIAC_TABLES = ("classical", "planetary_alt")


def draw_house(rng: random.Random) -> Dict[str, object]:
    """一星之报数:取四数求和,除十二取余定宫(余零入十二宫)。留档 draws 以便复核。"""
    draws = [rng.randint(PCHART_DRAW_LO, PCHART_DRAW_HI) for _ in range(PCHART_DRAW_COUNT)]
    total = sum(draws)
    h = total % 12
    return {"draws": draws, "total": total, "house": 12 if h == 0 else h}


def opposite_house(house: int) -> int:
    """对宫(相距一百八十度)。"""
    return ((house - 1 + 6) % 12) + 1


def planetary_chart(first_figure: int, rng: Optional[random.Random] = None,
                    zodiac_table: str = "classical",
                    include_nodes: bool = False,
                    include_extras: bool = False) -> dict:
    """行星地占盘。first_figure = 所起首图(定上升);zodiac_table 二式:
    classical 古典行星地占对应表(缺省)/ planetary_alt 另一传本对应表。"""
    r = rng or random
    table = zodiac_table if zodiac_table in PCHART_ZODIAC_TABLES else "classical"
    asc_sign = zodiac_of(first_figure, table)
    try:
        i0 = SIGN_ORDER.index(asc_sign)
    except ValueError:
        i0 = 0
    houses = [{"house": k + 1, "sign": SIGN_ORDER[(i0 + k) % 12],
               "sign_zh": SIGN_ZH.get(SIGN_ORDER[(i0 + k) % 12], SIGN_ORDER[(i0 + k) % 12])}
              for k in range(12)]

    planets = []
    for p in PCHART_PLANETS:
        d = draw_house(r)
        planets.append({"planet": p, "planet_zh": PCHART_PLANETS_ZH[p], **d})

    nodes = None
    if include_nodes:
        north = draw_house(r)
        south_house = opposite_house(int(north["house"]))
        nodes = {
            "north": {"planet": "NorthNode", "planet_zh": PCHART_PLANETS_ZH["NorthNode"], **north},
            "south": {"planet": "SouthNode", "planet_zh": PCHART_PLANETS_ZH["SouthNode"],
                      "house": south_house, "derived_from": "north_opposite"},
        }

    extras = None
    if include_extras:
        extras = []
        for p in PCHART_EXTRAS:
            d = draw_house(r)
            extras.append({"planet": p, "planet_zh": PCHART_PLANETS_ZH[p], **d})

    return {
        "zodiac_table": table,
        "first_figure": name(first_figure),
        "asc_sign": asc_sign,
        "asc_sign_zh": SIGN_ZH.get(asc_sign, asc_sign),
        "houses": houses,
        "planets": planets,
        "nodes": nodes,
        "extras": extras,
        "draw_domain": [PCHART_DRAW_LO, PCHART_DRAW_HI, PCHART_DRAW_COUNT],
    }
