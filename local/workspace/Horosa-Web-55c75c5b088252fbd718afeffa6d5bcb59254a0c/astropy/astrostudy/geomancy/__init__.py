# -*- coding: utf-8 -*-
"""地占(十六图二进制占卜家族)纯内核:16 图不可变内核 + 可插拔流派 Profile。
覆盖 盾牌盘 / 宫位盘(图形入宫)/ 占星定局 / 可计算读法 / Sikidy 异或表盘 / 多流派对应。
数据走 data/*.json 真值源,内核只读不硬编码。"""
from __future__ import annotations

from . import (chart, correspondences, figures, hakata, house, planetary, random_source,
               reading, sikidy, traditions)
from .chart import compute_reading
from .hakata import cast_hakata
from .figures import (
    FIG_BY_INT, FIG_BY_NAME, VALID_JUDGES, ZODIAC_SYSTEMS,
    add, converse, data, inverse, name, opposite, planet, points, reverse, rotate, zodiac_of,
)
from .house import (
    ascendant_sign, astro_place_planets_bytwelves, astro_place_planets_from_chart,
    derived_house, house_chart, house_chart_angular, house_chart_golden_dawn,
    house_chart_sequential, HOUSE_PLACEMENTS, PLANET_ORDER,
)
from .planetary import planetary_chart
from .reading import (aspect, company, court_verdict, element_supply, greek_points,
                      natural_cosignificator, paternitas, perfection, perfection_by_aspect,
                      perfection_direction, points_parity, prohibition, reconciler_parity,
                      shield_triangles, success, tenancy, tenancy_grade, time_flow, timing,
                      tone_class, triplicities, validity, via_elements, via_puncti)
from .shield import (Shield, cast_shield, cast_shield_from_mothers, cast_shield_from_numbers,
                     daughters_from_mothers)
from .sikidy import (SIKIDY_COL_NAMES, cast_sikidy, col_to_figure, column_compare,
                     princes_slaves, red_sikidy, sikidy_valid)
from .traditions import DEFAULT_PROFILE, PROFILES, get_profile

__all__ = [
    "figures", "shield", "house", "reading", "sikidy", "correspondences", "traditions", "planetary",
    "FIG_BY_INT", "FIG_BY_NAME", "VALID_JUDGES", "add", "converse", "data", "inverse",
    "name", "planet", "points", "reverse", "Shield", "cast_shield", "cast_shield_from_mothers",
    "daughters_from_mothers", "house_chart_sequential", "ascendant_sign",
    "astro_place_planets_from_chart", "astro_place_planets_bytwelves", "derived_house", "PLANET_ORDER",
    "perfection", "aspect", "company", "prohibition", "points_parity", "timing", "triplicities",
    "cast_sikidy", "sikidy_valid", "SIKIDY_COL_NAMES", "PROFILES", "DEFAULT_PROFILE", "get_profile",
    # 传本对齐补齐
    "ZODIAC_SYSTEMS", "opposite", "rotate", "zodiac_of", "HOUSE_PLACEMENTS", "house_chart",
    "house_chart_angular", "house_chart_golden_dawn", "planetary_chart",
    "cast_shield_from_numbers", "court_verdict", "time_flow", "validity", "tenancy",
    "tenancy_grade", "tone_class", "via_elements", "element_supply", "success",
    "greek_points", "shield_triangles", "reconciler_parity", "perfection_direction",
]
