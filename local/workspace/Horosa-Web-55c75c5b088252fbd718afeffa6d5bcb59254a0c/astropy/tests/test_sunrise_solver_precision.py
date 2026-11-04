# -*- coding: utf-8 -*-
"""日出 / 日没迭代求解精度:日心落上升点(下降点)、不计折射——与 swisseph rise_trans
(BIT_DISC_CENTER | BIT_NO_REFRACTION)同一定义,差须在 5 秒内。
旧停步阈值 0.5(半角距)= 差到 1° 就停,中纬实测差 1~2.5 分钟;七政「日出安命」按日出时刻定命宫,
出生近两小时界会落错宫。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import swisseph as swe

from astrostudy import perchart, astroextra


# (日期, 纬, 经, 纬°, 经°, 时区):时区与经度相配,两边取同一民用日的事件
CASES = [
    ('2024/06/21', '31N14', '121E28', 31.2333, 121.4667, 8),
    ('2024/12/21', '45N45', '126E38', 45.75, 126.6333, 8),
    ('2024/06/21', '60N00', '030E00', 60.0, 30.0, 3),
    ('2024/12/21', '33S52', '151E12', -33.8667, 151.2, 11),
]


def _pc(date, lat, lon, tz):
    return perchart.PerChart(astroextra.base_params({
        'date': date, 'time': '12:00:00', 'zone': '+%02d:00' % tz, 'lat': lat, 'lon': lon, 'ad': 1,
    }))


def _swe(date, la, lo, tz, flag):
    y, m, d = map(int, date.split('/'))
    jd0 = swe.julday(y, m, d, 0) - tz / 24.0
    res = swe.rise_trans(jd0, swe.SUN, flag | swe.BIT_DISC_CENTER | swe.BIT_NO_REFRACTION, (lo, la, 0))
    return res[1][0]


@pytest.mark.parametrize('date,lat,lon,la,lo,tz', CASES)
def test_sunrise_matches_geometric_center(date, lat, lon, la, lo, tz):
    got = _pc(date, lat, lon, tz).getSunRiseTime()['datetime']
    ref = _swe(date, la, lo, tz, swe.CALC_RISE)
    assert abs(got.jd - ref) * 86400 < 5, (date, lat, (got.jd - ref) * 86400)


@pytest.mark.parametrize('date,lat,lon,la,lo,tz', CASES)
def test_sunset_matches_geometric_center(date, lat, lon, la, lo, tz):
    got = _pc(date, lat, lon, tz).getSunSetTime()['datetime']
    ref = _swe(date, la, lo, tz, swe.CALC_SET)
    assert abs(got.jd - ref) * 86400 < 5, (date, lat, (got.jd - ref) * 86400)


# ── 日出 / 日没口径 sunriseMode='apparent':日面上缘 + 大气折射(swisseph rise_trans 缺省口径、历书通行)──
def _pc_mode(date, lat, lon, tz, mode):
    return perchart.PerChart(astroextra.base_params({
        'date': date, 'time': '12:00:00', 'zone': '+%02d:00' % tz, 'lat': lat, 'lon': lon, 'ad': 1, 'sunriseMode': mode,
    }))


def _swe_apparent(date, la, lo, tz, flag):
    y, m, d = map(int, date.split('/'))
    jd0 = swe.julday(y, m, d, 0) - tz / 24.0
    return swe.rise_trans(jd0, swe.SUN, flag, (lo, la, 0))[1][0]


@pytest.mark.parametrize('date,lat,lon,la,lo,tz', CASES)
def test_apparent_sunrise_sunset_match_swisseph_upper_limb_refraction(date, lat, lon, la, lo, tz):
    pc = _pc_mode(date, lat, lon, tz, 'apparent')
    rise = pc.getSunRiseTime()['datetime'].jd
    ref_rise = _swe_apparent(date, la, lo, tz, swe.CALC_RISE)
    assert abs(rise - ref_rise) * 86400 < 1.5
    ref_set = swe.rise_trans(ref_rise, swe.SUN, swe.CALC_SET, (lo, la, 0))[1][0]
    assert abs(pc.getSunSetTime()['datetime'].jd - ref_set) * 86400 < 1.5


@pytest.mark.parametrize('date,lat,lon,la,lo,tz', CASES)
def test_apparent_is_earlier_rise_later_set_than_center(date, lat, lon, la, lo, tz):
    """上缘 + 折射:日出早于日心口径、日没晚于日心口径(中纬约 5 分钟)。"""
    c = _pc_mode(date, lat, lon, tz, 'center')
    a = _pc_mode(date, lat, lon, tz, 'apparent')
    assert a.getSunRiseTime()['datetime'].jd < c.getSunRiseTime()['datetime'].jd
    assert a.getSunSetTime()['datetime'].jd > c.getSunSetTime()['datetime'].jd


def test_default_and_unknown_mode_keep_center():
    """缺键 / 未知值 = 日心口径(逐秒不变,零回归)。"""
    date, lat, lon, tz = CASES[0][0], CASES[0][1], CASES[0][2], CASES[0][5]
    base = _pc(date, lat, lon, tz).getSunRiseTime()['timeStr']
    assert _pc_mode(date, lat, lon, tz, 'center').getSunRiseTime()['timeStr'] == base
    assert _pc_mode(date, lat, lon, tz, 'bogus').getSunRiseTime()['timeStr'] == base
