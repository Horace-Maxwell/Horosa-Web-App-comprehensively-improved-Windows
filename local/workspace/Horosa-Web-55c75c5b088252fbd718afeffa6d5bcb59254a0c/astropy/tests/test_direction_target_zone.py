# -*- coding: utf-8 -*-
"""[Q-173/T-113 2026-09-18] 太阳弧 / 行星弧 / 波斯向运 的目标时刻按推运页所选时区(dirZone)解释;
   此前三端点恒按本命时区 → 前端时区下拉拨东8↔东0 回包逐字节相同(死开关)。缺省(不传)仍按本命时区,零回归。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from astrostudy.perchart import PerChart  # noqa: E402

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1}


def _get(o, key):
    if isinstance(o, dict):
        return o.get(key)
    return getattr(o, key, None)


def _sun_lon(res):
    objs = res['chart']['objects']
    for o in objs:
        if _get(o, 'id') == 'Sun' or _get(o, 'name') == 'Sun':
            return float(_get(o, 'lon'))
    return float(_get(objs[0], 'lon'))


def test_solar_arc_target_follows_dir_zone():
    predict = PerChart(dict(BASE)).getPredict()
    same = predict.getSolarArcByDate('2020/05/18 10:00', 1, False)
    default = predict.getSolarArcByDate('2020/05/18 10:00', 1, False, zone=None)
    east8 = predict.getSolarArcByDate('2020/05/18 10:00', 1, False, zone='+08:00')
    utc = predict.getSolarArcByDate('2020/05/18 10:00', 1, False, zone='+00:00')
    assert _sun_lon(same) == _sun_lon(default) == _sun_lon(east8)   # 缺省 = 本命时区,逐字不变
    assert abs(_sun_lon(utc) - _sun_lon(east8)) > 1e-4               # 目标时刻差 8 小时 → 弧不同


def test_persian_directed_target_follows_dir_zone():
    predict = PerChart(dict(BASE)).getPredict()
    east8 = predict.getPersianDirectedByDate('2020/05/18 10:00', zone='+08:00')
    utc = predict.getPersianDirectedByDate('2020/05/18 10:00', zone='+00:00')
    default = predict.getPersianDirectedByDate('2020/05/18 10:00')
    assert _sun_lon(default) == _sun_lon(east8)
    assert abs(_sun_lon(utc) - _sun_lon(east8)) > 1e-6
