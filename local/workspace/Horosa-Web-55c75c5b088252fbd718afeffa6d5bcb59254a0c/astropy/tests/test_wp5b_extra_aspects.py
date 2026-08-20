# [WP-5b] 相位参与对象扩展双向量锚。
from astrostudy.perchart import PerChart

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def test_default_off_returns_none():
    assert PerChart(dict(BASE)).getExtraAspects() is None
    # 显式 0 同 None(响应零字段零回归)
    assert PerChart({**BASE, 'aspectIncludeCusps': 0, 'aspectIncludeLots': 0, 'aspectIncludeMidpoints': 0}).getExtraAspects() is None


def test_groups_and_caps():
    pc = PerChart({**BASE, 'aspectIncludeCusps': 1, 'aspectIncludeLots': 1, 'aspectIncludeMidpoints': 1})
    ea = pc.getExtraAspects()
    assert set(ea.keys()) == {'cusps', 'lots', 'midpoints'}
    assert len(ea['cusps']) > 0 and len(ea['lots']) > 0
    for row in ea['cusps'] + ea['lots']:
        assert row['asp'] in (0, 60, 90, 120, 180) and 0 <= row['orb'] <= 3.0
    for row in ea['midpoints']:
        assert row['asp'] in (0, 90, 180) and 0 <= row['orb'] <= 1.5


def test_single_switch_isolation():
    pc = PerChart({**BASE, 'aspectIncludeCusps': 1})
    ea = pc.getExtraAspects()
    assert set(ea.keys()) == {'cusps'}
