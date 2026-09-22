# -*- coding: utf-8 -*-
"""[Q-263/T-243/T-251] 南极神数手动古法:空值按本命自出(不再写死 2026·节月 1·子时);日干「自出」按出生时刻精算,时支不依赖手填日干。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest

try:
    from websrv import webnanjisrv as srv
    from websrv.kentang.kinastro_common import parse_datetime
except Exception as e:   # pragma: no cover
    pytest.skip('webnanjisrv unavailable: %s' % e, allow_module_level=True)


DATA = {'date': '1990-05-18', 'time': '10:30:00', 'zone': '+08:00', 'gender': 1}


def test_manual_empty_falls_back_to_birth_derived_values():
    dt = parse_datetime(dict(DATA))
    base = srv.NanJiShenShu.from_solar_datetime(dt.year, dt.month, dt.day, dt.hour, dt.minute, gender='男')
    njs = srv._build_manual_chart(dict(DATA, nanjiMode='manual'), '男', dt)
    assert njs.lunar_year == base.lunar_year
    assert njs.solar_month == base.solar_month
    assert njs.hour_zhi == base.hour_zhi
    assert njs.year_pillar == base.year_pillar
    assert njs.day_gan == base.day_gan and njs.day_zhi == base.day_zhi
    assert njs.hour_pillar == base.hour_pillar
    assert njs.lunar_year != 2026 or base.lunar_year == 2026


def test_manual_hour_zhi_without_day_gan_still_yields_hour_pillar():
    dt = parse_datetime(dict(DATA))
    njs = srv._build_manual_chart(dict(DATA, nanjiMode='manual', nanjiHourZhi='午'), '男', dt)
    assert njs.hour_zhi == '午'
    assert njs.day_gan
    assert njs.hour_pillar and njs.hour_pillar.endswith('午')


def test_manual_explicit_values_win():
    dt = parse_datetime(dict(DATA))
    njs = srv._build_manual_chart(dict(DATA, nanjiMode='manual', nanjiLunarYear=1984, nanjiSolarMonth=3, nanjiDayGan='甲', nanjiDayZhi='子', nanjiHourZhi='子'), '男', dt)
    assert njs.lunar_year == 1984 and njs.solar_month == 3
    assert njs.day_pillar == '甲子'
    assert njs.hour_pillar == '甲子'
