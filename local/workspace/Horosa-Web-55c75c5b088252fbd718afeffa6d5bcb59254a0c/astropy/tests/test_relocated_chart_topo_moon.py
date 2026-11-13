"""搬过点的盘(组合盘 / 合盘 / 骰子盘 / 推运图 / 南半球盘)开站心月后,reinit 不许把月亮盖回本命站心月位。

站心月按出生时刻与测站重算月亮,并把福点与全部希腊点按新月位重投,是起盘时算一次的事。
起盘之后的 reinit 都发生在搬过点的盘上:再算一遍,搬好的月亮回到本命站心月位,希腊点按混合位置重投。
判据:① 起盘之后的 reinit 不改任何星体 / 希腊点的黄经(开不开站心月都一样);② 各类盘的月亮 = 该类变换作用在本命站心月上。
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy import directed_figures  # noqa: E402
from astrostudy.modern.chartcomposite import ChartComposite  # noqa: E402
from astrostudy.modern.chartsynastry import ChartSynastry  # noqa: E402
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request  # noqa: E402

A = {"date": "1975/02/10", "time": "21:15:00", "zone": "-08:00", "lat": "47n36", "lon": "122w20",
     "hsys": 3, "zodiacal": 0, "tradition": False, "predictive": False}
B = dict(A, date='1968/11/20', time='00:30:00')
SOUTH = dict(A, date='2001/09/11', time='05:50:00', zone='+10:00', lat='33s52', lon='151e12')
TARGET = {'targetDate': '2010/06/01', 'targetTime': '12:00:00'}


def _diff(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


def _pushed(data, fn):
    token = push_classical_request(data)
    try:
        return fn()
    finally:
        pop_classical_request(token)


def _points(pc):
    out = {o.id: o.lon for o in pc.chart.objects}
    out.update({o.id: o.lon for o in (getattr(pc.chart, 'pars', None) or [])})
    return out


def _natal_points(data):
    d = copy.deepcopy(data)
    return _pushed(d, lambda: _points(PerChart(d)))


@pytest.fixture
def reinit_moves(monkeypatch):
    """记下每次 reinit 前后黄经变了的点。每张盘的第一次 reinit 是起盘(站心月在这里生效),之后的才是被查对象。"""
    calls = []
    original = PerChart.reinit

    def wrapped(self):
        first = not getattr(self, '_seenReinit', False)
        self._seenReinit = True
        before = _points(self)
        original(self)
        after = _points(self)
        moved = {k: (round(before[k], 3), round(after[k], 3)) for k in before if _diff(before[k], after[k]) > 1e-9}
        calls.append({'first': first, 'moved': moved})

    monkeypatch.setattr(PerChart, 'reinit', wrapped)
    return calls


def _composite(a, b):
    return _pushed(a, lambda: ChartComposite(copy.deepcopy(a), copy.deepcopy(b)).compute())


def _synastry(a, b):
    return _pushed(a, lambda: ChartSynastry(copy.deepcopy(a), copy.deepcopy(b)).compute())


def _dice(a, b):
    return _pushed(a, lambda: PerChart(copy.deepcopy(a)).getPredict().getDiceChart(const.MOON, const.LEO, 1))


def _directed(builder):
    # 这几个入口自己进临界区,外面不再包一层
    def run(a, b):
        out = builder(dict(copy.deepcopy(a), **TARGET))
        assert out.get('chart'), '推运图没有出盘'
        return out
    return run


def _south(a, b):
    d = dict(SOUTH, southchart=True, topocentricMoon=a.get('topocentricMoon', 0))
    return _pushed(d, lambda: PerChart(copy.deepcopy(d)))


RELOCATED = {
    'composite': _composite,
    'synastry': _synastry,
    'dice': _dice,
    'neroman': _directed(directed_figures.build_neroman),
    'bezza': _directed(directed_figures.build_bezza),
    'jay': _directed(directed_figures.build_jay),
}


@pytest.mark.parametrize('kind', sorted(RELOCATED))
@pytest.mark.parametrize('topo', [0, 1])
def test_later_reinit_moves_no_point(kind, topo, reinit_moves):
    a, b = dict(A, topocentricMoon=topo), dict(B, topocentricMoon=topo)
    RELOCATED[kind](a, b)
    first = [c for c in reinit_moves if c['first']]
    later = [c for c in reinit_moves if not c['first']]
    assert later, '这类盘没有走到起盘之后的 reinit,本条测不到要测的东西'
    if topo:
        # 判别力自证:站心月确实在起盘那次生效了(月亮被挪动),否则「之后不许动」是空话
        assert any(const.MOON in c['moved'] for c in first)
    assert [c['moved'] for c in later if c['moved']] == []


@pytest.mark.parametrize('topo', [0, 1])
def test_south_chart_is_the_plain_chart_turned_half_a_circle(topo):
    """南半球盘 = 同一张盘各点加 180°。翻转在首次 reinit 之前,站心月要先算再随各点一起翻。"""
    plain = _natal_points(dict(SOUTH, topocentricMoon=topo))
    south = _points(_south({'topocentricMoon': topo}, None))
    wrong = {k: (round(v, 3), round(south[k], 3)) for k, v in plain.items() if _diff(south[k], (v + 180.0) % 360.0) > 1e-6}
    assert not wrong, wrong


def test_topocentric_moon_differs_from_the_geocentric_one():
    """判别力自证:取的例子里站心月与地心月确实差得出来(差 0 的话下面几条分不出修没修)。"""
    for data in (A, B, SOUTH):
        geo = _natal_points(data)[const.MOON]
        topo = _natal_points(dict(data, topocentricMoon=1))[const.MOON]
        assert _diff(geo, topo) > 0.05


def test_composite_moon_is_the_midpoint_of_the_two_topocentric_moons():
    a, b = dict(A, topocentricMoon=1), dict(B, topocentricMoon=1)
    ma, mb = _natal_points(a)[const.MOON], _natal_points(b)[const.MOON]
    res = _composite(a, b)
    moon = [o for o in res['chart']['objects'] if o.id == const.MOON][0]
    assert _diff(moon.lon, ChartComposite.shortArcMid(ma, mb)) < 1e-6
    assert _diff(moon.lon, ma) > 1.0          # 不是星盘 A 的本命站心月


def test_synastry_inner_wheel_carries_the_other_charts_topocentric_moon():
    a, b = dict(A, topocentricMoon=1), dict(B, topocentricMoon=1)
    ma, mb = _natal_points(a)[const.MOON], _natal_points(b)[const.MOON]
    res = _synastry(a, b)
    inner = [o for o in res['inner']['chart']['objects'] if o.id == const.MOON][0]
    outer = [o for o in res['outer']['chart']['objects'] if o.id == const.MOON][0]
    assert _diff(inner.lon, mb) < 1e-6        # 内盘放的是对方的星
    assert _diff(outer.lon, ma) < 1e-6


def test_dice_moon_lands_in_the_thrown_sign():
    a = dict(A, topocentricMoon=1)
    natal_moon = _natal_points(a)[const.MOON]
    dice = _dice(a, None)
    moon = dice.chart.getObject(const.MOON)
    assert moon.sign == const.LEO
    assert _diff(moon.lon, 120.0 + natal_moon % 30.0) < 1e-6
