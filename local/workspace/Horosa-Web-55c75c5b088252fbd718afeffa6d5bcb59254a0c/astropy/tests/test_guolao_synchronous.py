# 七政四余 同步宇宙补全 后端 golden:赤道恒星制(G3/G4)/四余真平(G10/G11)/报时星太阳时(G6)。
# 全部默认零回归 + 各选项产出真实差异(避免假选项)。
import os
import pytest
from astrostudy.perchart import PerChart
from astrostudy.jieqi.realsuntime import getOffsetByJd, equationOfTimeMinutes
from flatlib import const

BASE = {'date': '1990/08/15', 'time': '12:30:00', 'zone': '8',
        'lat': '39n54', 'lon': '116e24', 'gpsLat': '39n54', 'gpsLon': '116e24',
        'hsys': 0, 'zodiacal': 0, 'tradition': 0, 'doubingSu28': 2, 'guolaoLifeMode': 'asc'}


def _su(data):
    pc = PerChart(dict(data))
    pc.getFixedStarSu28()
    return {o.id: getattr(o, 'su28', '') for o in pc.chart.objects
            if o.id in (const.SUN, const.MOON, const.MARS, const.JUPITER)}


def _lons(data, ids):
    pc = PerChart(dict(data))
    return {o.id: round(o.lon, 3) for o in pc.chart.objects if o.id in ids}


def test_g6_solar_time_modes():
    # 真(经度+均时差) ≠ 平(仅经度) ≠ 关(0);默认=真(零回归)
    jd = 2448118.6875   # 1990-08-15 04:30 UT
    t = getOffsetByJd(jd, '8', 116.4, 'true')
    m = getOffsetByJd(jd, '8', 116.4, 'mean')
    o = getOffsetByJd(jd, '8', 116.4, 'off')
    d = getOffsetByJd(jd, '8', 116.4)
    assert o == 0
    assert d == t                          # 默认零回归
    assert m == int((116.4 - 120) * 240)   # 仅经度
    assert t != m                          # 均时差非零


def test_g6_equation_of_time_same_as_ui_and_backend():
    # 全软件同一式:取 Java RealSunTimeOffsetTest / 前端 baziLunarLocal 共用的 NOAA 级数,与星历库差在几秒内,跨年份也成立
    import swisseph as swe
    for y, mo, d in ((1990, 8, 31), (1990, 9, 7), (2026, 8, 31), (2026, 11, 4), (1900, 2, 11), (2100, 7, 26)):
        jd = swe.julday(y, mo, d, 4.0)
        assert abs(equationOfTimeMinutes(jd) * 60 - swe.time_equ(jd) * 86400) < 4.5


def test_g10_g11_siyu_true_vs_mean():
    mean = _lons(BASE, (const.NORTH_NODE, const.DARKMOON, const.SUN))
    true = _lons(dict(BASE, guolaoNodeType='true', guolaoLilithType='true'),
                 (const.NORTH_NODE, const.DARKMOON, const.SUN))
    # 默认平;真交点/真远地点 偏移;太阳不变(零全局污染)
    assert mean[const.SUN] == true[const.SUN]
    assert mean[const.NORTH_NODE] != true[const.NORTH_NODE]
    assert mean[const.DARKMOON] != true[const.DARKMOON]


def test_g3_g4_equatorial_sidereal():
    huangdao = _su(dict(BASE, doubingSu28=2))   # 回归今制(黄道·按黄经)
    chidao = _su(dict(BASE, doubingSu28=5))      # 现代天赤恒星制(赤道·按赤经)
    xunshuang = _su(dict(BASE, doubingSu28=0))   # 荀爽(赤道实测·含危鬼改正)
    assert all(chidao.values())                  # 全出宿
    assert chidao != huangdao                    # 赤道≠黄道(按赤经 vs 按黄经,真选项)
    # WP-B 真修后:mode5 改用与荀爽同一份正确赤道距星活体源(去 mode0 荀爽的危/鬼改正),
    # 故与荀爽逐宿一致(本盘七政无星近危/鬼边界);旧实现(MOIRA_DISTAR_J2000 的 RA)曾使二者各异且偏 10–44°。
    assert chidao == xunshuang


def test_default_su28_zero_regression():
    # 默认回归今制(2)出宿稳定(护栏:任何改动不动默认盘宿度)
    su = _su(dict(BASE, doubingSu28=2))
    assert su[const.SUN] == '柳'
    assert su[const.MARS] == '胃'
