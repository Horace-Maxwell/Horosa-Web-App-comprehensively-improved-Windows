# -*- coding: utf-8 -*-
"""[Q-184/T-103] 年龄推进点「关键岁数(合本命)」连续解:每宫 6 年线性插值求精确穿越岁数,不再只在整岁 ±1° 判合。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.agepoint import crossings_of  # noqa: E402


def test_equal_houses_exact_ages():
    kc = [i * 30.0 for i in range(12)]            # 等宫 30°,年龄点 5°/年
    natal = {'Sun': 17.0, 'Moon': 100.0, 'Mars': 359.0}
    cs = crossings_of(kc, natal, 72)
    by = {c['aspectTo']: c['age'] for c in cs}
    assert abs(by['Sun'] - 3.4) < 1e-9
    assert abs(by['Moon'] - 20.0) < 1e-9
    assert abs(by['Mars'] - 71.8) < 1e-9
    assert len(cs) == 3


def test_cycle_repeats_beyond_72_and_unequal_houses():
    kc = [0.0, 60.0, 90.0, 120.0, 150.0, 180.0, 210.0, 240.0, 270.0, 300.0, 330.0, 345.0]   # 第 1 宫 60°、第 12 宫 15°
    natal = {'Sun': 30.0, 'Moon': 352.5}
    cs = crossings_of(kc, natal, 150)
    sun = [c['age'] for c in cs if c['aspectTo'] == 'Sun']
    moon = [c['age'] for c in cs if c['aspectTo'] == 'Moon']
    assert sun == [3.0, 75.0, 147.0]        # 第 1 宫 60° 跨 6 年 → 30° 处 3 岁
    assert moon == [69.0, 141.0]           # 第 12 宫 15° 跨 6 年 → 7.5° 处 3 岁 → 66+3
    # 旧口径(整岁 ±1°):等宫 5°/年下 3.4 岁穿越在 3 岁点差 2° → 漏报;新口径必报
    kc2 = [i * 30.0 for i in range(12)]
    assert any(abs(c['age'] - 3.4) < 1e-9 for c in crossings_of(kc2, {'Sun': 17.0}, 72))


def test_sidereal_chart_age_point_uses_chart_zodiac():
    """[Q-361/T-342] 恒星黄道盘:年龄点起于盘上升点(恒星黄经),合本命岁数与回归盘一致(整体平移不改几何);
    此前宫头恒回归黄经、本命星恒星黄经互比 → 0 岁 AP 仍 124.05、合本命集合全错。"""
    from astrostudy.perchart import PerChart
    from astrostudy import agepoint
    base = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1}
    trop = agepoint.compute(PerChart(dict(base)))
    sid = agepoint.compute(PerChart(dict(base, zodiacal=1, siderealAyanamsa='lahiri')))
    assert abs(trop['asc'] - 124.05) < 0.05
    assert abs(sid['asc'] - 100.32) < 0.05                  # 盘上升点(lahiri 恒星黄经),非回归 124.05
    assert sid['points'][0]['apLon'] == sid['asc']
    assert [(c['age'], c['aspectTo']) for c in sid['crossings']] == [(c['age'], c['aspectTo']) for c in trop['crossings']]
