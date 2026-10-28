# -*- coding: utf-8 -*-
"""极圈内天顶口径锁:同一时刻、同一地点,MC 不随分宫制变。

极圈内子午线上中天交点落地平下时,swisseph 对 Regiomontanus / Campanus / Polich-Page / APC / Sunshine
把 MC 换成 IC,其余制不换。全站口径(flatlib swe.upperMeridianAscmc 单源):MC 一律取上中天交点,
宫头按所选制原样,houses[].polarMc 打徽记。非极区一律不经参照、逐位不变。
"""
import math
import os
import sys

import pytest
import swisseph

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402
from flatlib.ephem import swe as fswe  # noqa: E402

HSYS_ALL = list(range(0, 25))   # chart_tables.hsys 全部 25 档(含自定义等宫 / 福点整宫)


def _pc(date, time, lat, lon='0e00', hsys=1, **kw):
    from astrostudy.perchart import PerChart
    d = {'date': date, 'time': time, 'zone': '+00:00', 'lat': lat, 'lon': lon, 'hsys': hsys}
    d.update(kw)
    return PerChart(d)


def _upper_mc(jd, lat_deg, lon_deg):
    """上中天交点:黄道上赤经 = ARMC 的那一点(与地平无关的定义式)。"""
    _, a = swisseph.houses(jd, lat_deg, lon_deg, b'O')
    armc = math.radians(a[2])
    eps = math.radians(swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0])
    return math.degrees(math.atan2(math.sin(armc), math.cos(armc) * math.cos(eps))) % 360.0


def _gap(a, b):
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


# (日期, 时刻, 纬度, 经度) —— 极圈内、上中天交点在地平下(R/C/T 会换 IC)的时刻。
POLAR_BELOW = [
    ('2000/06/21', '12:00:00', '70s00', '0e00'),
    ('2000/06/21', '12:00:00', '67s00', '0e00'),
    ('2000/06/21', '12:00:00', '80s00', '0e00'),
    ('2000/12/21', '12:00:00', '70n00', '0e00'),
]


def test_premise_swisseph_swaps_for_some_systems():
    """前提(以前被当成「不可达」删过档):swisseph 在这些时刻确实对部分分宫制换了 IC。前提变了 → 本锁要重审。"""
    for date, time, lat, lon in POLAR_BELOW:
        jd = _pc(date, time, lat, lon).chart.date.jd
        la = -float(lat[:-3]) if lat.endswith('s00') else float(lat[:-3])
        _, ao = swisseph.houses(jd, la, 0.0, b'O')
        _, ar = swisseph.houses(jd, la, 0.0, b'R')
        assert _gap(ao[1], ar[1]) > 179.0, (date, lat)


@pytest.mark.parametrize('date,time,lat,lon', POLAR_BELOW)
def test_polar_mc_same_for_every_house_system(date, time, lat, lon):
    mcs, ics, marks = set(), set(), set()
    for hs in HSYS_ALL:
        pc = _pc(date, time, lat, lon, hsys=hs)
        mcs.add(round(pc.chart.getAngle(const.MC).lon, 9))
        ics.add(round(pc.chart.getAngle(const.IC).lon, 9))
        marks.add(getattr(list(pc.chart.houses)[0], 'polarMc', None))
    assert len(mcs) == 1, (date, lat, mcs)
    assert len(ics) == 1
    assert marks == {fswe.POLAR_MC_UPPER}
    mc = mcs.pop()
    pc = _pc(date, time, lat, lon)
    la = -float(lat[:-3]) if lat.endswith('s00') else float(lat[:-3])
    assert _gap(mc, _upper_mc(pc.chart.date.jd, la, 0.0)) < 1e-6     # 取的是上中天交点
    assert _gap(ics.pop(), (mc + 180.0) % 360.0) < 1e-9


def test_polar_mc_above_horizon_no_mark():
    """极圈内但上中天交点本就在地平上:不换、不打徽记。"""
    for hs in (1, 2, 10, 6):
        pc = _pc('2000/06/21', '12:00:00', '70n00', hsys=hs)
        assert getattr(list(pc.chart.houses)[0], 'polarMc', None) is None


@pytest.mark.parametrize('lat', ['39n54', '50n00', '33s52', '64n59'])
def test_non_polar_mc_bitwise_unchanged(lat):
    """非极区:MC / IC 与 swisseph 原值逐位相同,无徽记(参照根本不算)。"""
    la = (-1 if lat[-3] == 's' else 1) * (float(lat[:-3]) + float(lat[-2:]) / 60.0)
    for hs in HSYS_ALL:
        pc = _pc('1990/05/18', '10:00:00', lat, '116e23', hsys=hs)
        houses = list(pc.chart.houses)
        assert getattr(houses[0], 'polarMc', None) is None
    for code in (b'R', b'C', b'T', b'B', b'O'):
        jd = 2448030.0
        _, raw = swisseph.houses(jd, la, 116.38, code)
        out, mark = fswe.upperMeridianAscmc(lambda c: swisseph.houses(jd, la, 116.38, c), code, raw, la)
        assert out is raw and mark is None


def test_armc_form_and_election_moment_share_the_rule():
    """同口径的两个旁路:按 ARMC 取宫(主限法推运盘)与择日扫描时刻,极区 MC 与本命盘同值。"""
    jd = _pc('2000/06/21', '12:00:00', '70s00').chart.date.jd
    _, ao = swisseph.houses(jd, -70.0, 0.0, b'O')
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    _, ar = swisseph.houses_armc(ao[2], -70.0, eps, b'R')
    out, mark = fswe.upperMeridianAscmc(lambda c: swisseph.houses_armc(ao[2], -70.0, eps, c), b'R', ar, -70.0)
    assert mark == fswe.POLAR_MC_UPPER
    assert _gap(out[1], ao[1]) < 1e-9

    from astrostudy import election_scan as E
    mcs = set()
    for hs in (1, 2, 6, 9, 10, 22):   # Alcabitius / Regiomontanus / Polich-Page / Porphyry / Campanus / APC
        ctx = E.ScanContext({'gpsLat': -70.0, 'gpsLon': 0.0, 'zone': '+00:00', 'hsys': hs})
        mcs.add(round(E.LightMoment(jd, ctx).mc(), 9))
    assert len(mcs) == 1, mcs
