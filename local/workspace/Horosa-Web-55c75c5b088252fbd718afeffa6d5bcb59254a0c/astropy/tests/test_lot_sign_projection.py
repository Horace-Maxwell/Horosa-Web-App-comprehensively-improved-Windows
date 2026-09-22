# -*- coding: utf-8 -*-
"""[Q-259/T-222] lotProjection='sign' 真按座序计数(此前是度式投射后归座首);[Q-301/T-289] 胜利点昼式 = ASC + 木星 − 精神。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from flatlib import const  # noqa: E402
from flatlib.tools import arabicparts as ap  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1}


def _sign(lon):
    return int((lon % 360.0) // 30)


def test_sign_count_helper_valens_example():
    # Valens II 37:☉ 射手、☽ 巨蟹、ASC 水瓶 → 按座数:射手→巨蟹 7 座,自水瓶数 7 座 = 处女(按度可落狮子)
    lon = PerChart._signCountLon(8 * 30 + 20.0, 3 * 30 + 3.0, 10 * 30 + 5.0)
    assert _sign(lon) == 5 and abs(lon % 30.0 - 5.0) < 1e-9        # 处女,度 = ASC 座内度 5°
    # 同座 → 0 座 → 落上升座
    lon2 = PerChart._signCountLon(30.0 + 2.0, 30.0 + 28.0, 4 * 30 + 11.0)
    assert _sign(lon2) == 4 and abs(lon2 % 30.0 - 11.0) < 1e-9
    # Paulus 算例:日生 ☉ 29♓ ☽ 29♒ ASC 11♌ → 福点 11♋(与度式同)
    lon3 = PerChart._signCountLon(11 * 30 + 29.0, 10 * 30 + 29.0, 4 * 30 + 11.0)
    assert _sign(lon3) == 3 and abs(lon3 % 30.0 - 11.0) < 1e-9


def test_sign_projection_uses_sign_counting_and_asc_degree():
    pc = PerChart(dict(BASE, lotProjection='sign'))
    ch = pc.chart
    asc = ch.getAngle(const.ASC)
    sun = ch.getObject(const.SUN)
    moon = ch.getObject(const.MOON)
    pf = ch.getObject(const.PARS_FORTUNA)
    if pc.isDiurnal:
        expect = PerChart._signCountLon(sun.lon, moon.lon, asc.lon)
    else:
        expect = PerChart._signCountLon(moon.lon, sun.lon, asc.lon)
    assert abs(pf.lon - expect % 360.0) < 1e-6
    # 全部赫尔墨斯点座内度 = ASC 座内度
    for pid in (ap.PARS_SPIRIT, ap.PARS_EROS, ap.PARS_NECESSITY, ap.PARS_COURAGE, ap.PARS_VICTORY, ap.PARS_NEMESIS):
        p = ch.get(pid)
        assert abs((p.lon % 30.0) - (asc.lon % 30.0)) < 1e-6, pid
    # 精神 = 自月至日(昼)座数;胜利 = 自精神至木星座数
    spirit = ch.get(ap.PARS_SPIRIT)
    jup = ch.getObject(const.JUPITER)
    if pc.isDiurnal:
        assert abs(spirit.lon - PerChart._signCountLon(moon.lon, sun.lon, asc.lon) % 360.0) < 1e-6
        assert abs(ch.get(ap.PARS_VICTORY).lon - PerChart._signCountLon(spirit.lon, jup.lon, asc.lon) % 360.0) < 1e-6


def test_default_projection_unchanged_and_victory_day_formula():
    pc = PerChart(dict(BASE))
    ch = pc.chart
    asc = ch.getAngle(const.ASC)
    spirit = ch.get(ap.PARS_SPIRIT)
    jup = ch.getObject(const.JUPITER)
    victory = ch.get(ap.PARS_VICTORY)
    if pc.isDiurnal:
        expect = (asc.lon + jup.lon - spirit.lon) % 360.0      # Paulus ch.23:自精神数到木星,自 ASC 投同数(昼)
    else:
        expect = (asc.lon + spirit.lon - jup.lon) % 360.0
    assert abs(((victory.lon - expect + 180.0) % 360.0) - 180.0) < 1e-6
