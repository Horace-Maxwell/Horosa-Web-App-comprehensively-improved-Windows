"""龙盘宫位口径两家:whole(缺省)= 按龙盘上升所在整座等分;shift = 本命宫头随交点平移(保留分宫制)。
shift 的定义性质:每颗星的落宫与本命完全一致,只换星座;宫头 = 本命宫头 − 北交点黄经。"""
import pytest

from astrostudy.astroextra import base_params
from astrostudy.astroextra_parts.progressions import build_draconic
from astrostudy.perchart import PerChart

IDS = ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn')
CASES = [
    ('1975/02/03', '23:10:00', 0),
    ('2001/11/21', '14:05:00', 1),
    ('1988/08/08', '04:44:00', 2),
    ('1966/03/30', '19:20:00', 1),
]


def _houses(chart):
    return {o.id: getattr(o, 'house', None) for o in chart['objects'] if o.id in IDS}


def _base(d, t, hsys):
    return {'date': d, 'time': t, 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28', 'hsys': hsys}


@pytest.mark.parametrize('d,t,hsys', CASES)
def test_shift_keeps_natal_houses(d, t, hsys):
    base = _base(d, t, hsys)
    natal = PerChart(base_params(dict(base))).getChartObj()
    res = build_draconic(dict(base, draconicHouses='shift'))
    assert res['chart']['params']['draconicHouses'] == 'shift'
    assert _houses(res['chart']['chart']) == _houses(natal)
    # 宫头 = 本命宫头 − 交点黄经
    nat_cusp = {h.id: h.lon for h in natal['houses']}
    for h in res['chart']['chart']['houses']:
        assert abs(((nat_cusp[h.id] - res['nodeLon']) % 360) - h.lon) < 1e-6


def test_whole_is_default_and_differs_somewhere():
    """缺省整宫:不传 / 传错值都按整宫;样本里至少有一张盘落宫与本命不同(两档确有区别)。"""
    diffs = 0
    for d, t, hsys in CASES:
        base = _base(d, t, hsys)
        natal = _houses(PerChart(base_params(dict(base))).getChartObj())
        w = build_draconic(dict(base))
        bogus = build_draconic(dict(base, draconicHouses='xx'))
        assert w['chart']['params']['draconicHouses'] == 'whole'
        assert bogus['chart']['params']['draconicHouses'] == 'whole'
        diffs += sum(1 for k, v in _houses(w['chart']['chart']).items() if natal.get(k) != v)
    assert diffs > 0
