# -*- coding: utf-8 -*-
"""全年份域金标:星历承诺域(BC12999-04-24 ~ AD16799-12-29)内核心引擎必须可算且形态完整。

守住 2026-07 全年份域工程的九处根修(profection 除零/单星容错/PerChart 域表/
jyotish 逐键/chart3d 轨道容错/parse_datetime 大年/五位年格式化/主限 stdlib 回退),
任何回归(域外星整组丢/大年静默回落 2025/贴边整包炸)在此现形。
"""
import pytest

from astrostudy import perchart
from astrostudy import chart3d
from websrv.horosa_engine_common import parse_datetime

# 锚点年:BC 深古/干支纪元前/公元边界/儒略-格里切换/现代/远期/贴边
ANCHORS = [-12000, -5000, -722, -1, 1, 500, 1582, 2026, 5000, 9999, 12000, 16500]


def _chart_data(y):
    return {
        'date': '%04d/06/15' % abs(y), 'time': '10:30:00', 'ad': 1 if y > 0 else -1,
        'lat': '39N54', 'lon': '116E24', 'zone': '+08:00', 'hsys': 'PLACIDUS',
        'zodiacal': 'Tropical', 'tradition': False,
    }


@pytest.mark.parametrize('y', ANCHORS)
def test_perchart_constructs_with_correct_body_domains(y):
    pc = perchart.PerChart(_chart_data(y))
    ids = {o.id for o in pc.chart.objects}
    # 主行星全域必在
    for must in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
                 'Uranus', 'Neptune', 'Pluto'):
        assert must in ids, (y, must)
    # 全域四大主小行星必在(旧降级表曾整组误剔)
    for must in ('Ceres', 'Pallas', 'Juno', 'Vesta'):
        assert must in ids, (y, must)
    # 窄域星:域内必在、域外必缺(与 BODY_JD_DOMAIN 一致)
    jd = pc.dateTime.jd
    for bid, dom in perchart.BODY_JD_DOMAIN.items():
        inside = dom[0] <= jd <= dom[1]
        assert (bid in ids) == inside, (y, bid, inside)
    # 位置数值 sanity
    for o in pc.chart.objects:
        assert 0.0 <= o.lon < 360.0, (y, o.id, o.lon)


@pytest.mark.parametrize('y', ANCHORS)
def test_chart3d_state_full_domain(y):
    import swisseph as swe
    jd = swe.julday(abs(y) if y > 0 else y, 6, 15, 4.0)
    st = chart3d.state('geo', jd, with_orbits=True)
    assert st['bodies'], y
    assert 'orbits' in st, y  # 轨道容错:个别星可为 None,键必在


def test_parse_datetime_large_years_no_silent_fallback():
    # 大年绝不静默回落 2025(旧实现的错盘根源)
    for ds, yy in (('12000/06/15', 12000), ('16799/01/02', 16799), ('0500/06/15', 500)):
        dt = parse_datetime({'date': ds, 'time': '10:30:00'})
        assert dt.year == yy, (ds, dt)
    # 域内仍是 stdlib datetime(下游字节不变)
    import datetime as _dt
    assert isinstance(parse_datetime({'date': '2026/07/19', 'time': '00:00:00'}), _dt.datetime)


def test_profection_on_birthday_no_zero_division():
    from astrostudy import perpredict
    pc = perchart.PerChart(_chart_data(2026))
    pp = pc.getPredict()
    # 目标时刻=出生同刻(旧实现除零崩)
    res = pp.getProfectionByDate('2026-06-15 10:30:00', '+08:00', False, -1)
    assert res is not None
