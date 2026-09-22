"""[Q-254/T-226] 空亡口径:by_sign_perfect 按黄经几何前推(不受容许度);kenodromia 用月亮前方 30° 窗;lilly/by_orb/by_sign_orb/exempt4 不变。"""
from astrostudy.perchart import PerChart

VEC = {'zone': '+08:00', 'lat': '31n14', 'lon': '121e28', 'hsys': 1, 'zodiacal': 0, 'date': '1990/01/22', 'time': '01:00:00'}


def _pc(**kw):
    d = dict(VEC); d.update(kw)
    pc = PerChart(d); pc.getChartObj(); return pc


def test_in_sign_perfection_ignores_orb():
    # 月亮 射手 2.14°(本座余 27.86°),火星在其前 22.2° 成合(本座内可完成,但超出容许度) → 非空(此前误判空)
    pc = _pc()
    assert pc.dynchart.isVOC('Moon', 'by_sign_perfect') is False
    arcs = pc.dynchart._vocAheadArcs('Moon', False)
    assert any(abs(x - 22.2) < 0.5 for x in arcs)


def test_kenodromia_uses_30_degree_window_not_orb():
    pc = _pc()
    assert pc.dynchart.isVOC('Moon', 'kenodromia') is False
    # 判别:窗口法与「本座内入容许度」分叉——后者仍按已入容许度判(该盘无入相 → 空)
    assert pc.dynchart.isVOC('Moon', 'by_sign_orb') is True


def test_legacy_modes_untouched():
    pc = _pc()
    assert pc.dynchart.isVOC('Moon', 'lilly') is False
    assert pc.dynchart.isVOC('Moon', 'by_orb') is True
    assert pc.dynchart.isVOC('Moon', 'exempt4') is False
