"""派生盘(十三分 / 十二分 / 调波 / 龙盘)的 reinit 不许把变换结果盖回本命口径。

reinit → setupPlanets 会重跑站心月、希腊点变体与福点整宫;它们在起本命盘时已生效、随各点一起被变换过。
判据:派生盘上每个点 = 变换(同选项本命盘上的该点);宫头 = 变换后上升整宫(龙盘 shift 档 = 本命宫头平移)。
"""
import copy
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402
from astrostudy.thirteenthchart import (  # noqa: E402
    ThirteenthChart, DodecatemoriaChart, HarmonicChart, DraconicChart,
)
from websrv.webchartsrv import push_classical_request, pop_classical_request  # noqa: E402

BASE = {"date": "1975/02/10", "time": "21:15:00", "zone": "-08:00", "lat": "47n36", "lon": "122w20",
        "hsys": 3, "zodiacal": 0, "tradition": False, "predictive": False}

VARIANTS = {
    'default': {},
    'topocentricMoon': {'topocentricMoon': 1},
    'lotProjectionSign': {'lotProjection': 'sign'},
    'lotReversalOff': {'lotReversal': 0},
    'hermeticSame': {'hermeticLotsReversal': 0},
    'fortunaWhole': {'hsys': 24},
    'topoFortunaWhole': {'topocentricMoon': 1, 'hsys': 24},
}


def _with_chart(data, fn):
    d = copy.deepcopy(data)
    token = push_classical_request(d)
    try:
        return fn(PerChart(d))
    finally:
        pop_classical_request(token)


def _points(perchart):
    out = {o.id: o.lon for o in perchart.chart.objects}
    out.update({o.id: o.lon for o in perchart.chart.pars})
    return out


def _diff(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


def _expected(kind, natal_chart):
    natal = _points(natal_chart)
    if kind == 'thirteenth':
        c = ThirteenthChart(natal_chart)
        return {o.id: c.fractalObject(o.copy()) for o in list(natal_chart.chart.objects) + list(natal_chart.chart.pars)}
    if kind == 'dodecatemoria':
        return {k: DodecatemoriaChart.dodecatemoriaLon(v) for k, v in natal.items()}
    if kind == 'harmonic5':
        return {k: (v * 5) % 360 for k, v in natal.items()}
    node = natal_chart.chart.getObject(const.NORTH_NODE).lon
    return {k: (v - node) % 360 for k, v in natal.items()}


def _apply(kind, perchart):
    if kind == 'thirteenth':
        ThirteenthChart(perchart).fractal()
    elif kind == 'dodecatemoria':
        DodecatemoriaChart(perchart).apply()
    elif kind == 'harmonic5':
        HarmonicChart(perchart, 5).apply()
    else:
        DraconicChart(perchart, kind.split('-')[1]).apply()


@pytest.mark.parametrize('kind', ['thirteenth', 'dodecatemoria', 'harmonic5', 'draconic-whole', 'draconic-shift'])
@pytest.mark.parametrize('variant', sorted(VARIANTS))
def test_points_and_cusps_survive_reinit(kind, variant):
    data = dict(BASE)
    data.update(VARIANTS[variant])
    expected = _with_chart(data, lambda pc: _expected(kind, pc))
    natal_cusps = _with_chart(data, lambda pc: [h.lon for h in pc.chart.houses])
    node = _with_chart(data, lambda pc: pc.chart.getObject(const.NORTH_NODE).lon)

    def derived(pc):
        _apply(kind, pc)
        return _points(pc), [h.lon for h in pc.chart.houses], pc.chart.getAngle(const.ASC).lon

    got, cusps, asc = _with_chart(data, derived)
    wrong = [(k, round(v, 3), round(got[k], 3)) for k, v in expected.items() if k in got and _diff(got[k], v) > 1e-6]
    assert not wrong, wrong
    if kind == 'draconic-shift':
        want = [(c - node) % 360 for c in natal_cusps]
    else:
        first = (int(asc / 30) % 12) * 30
        want = [(first + 30 * i) % 360 for i in range(12)]
    assert all(_diff(a, b) < 1e-6 for a, b in zip(cusps, want)), (cusps, want)


def test_topocentric_moon_reported_case():
    """问题单原例:龙盘开站心月后,月亮与福点要按变换后的值出,不能回到本命站心月位。"""
    data = dict(BASE, topocentricMoon=1)

    def run(pc):
        node = pc.chart.getObject(const.NORTH_NODE).lon
        moon = pc.chart.getObject(const.MOON).lon
        pf = pc.chart.getObject(const.PARS_FORTUNA).lon
        DraconicChart(pc, 'whole').apply()
        return (moon - node) % 360, (pf - node) % 360, pc.chart.getObject(const.MOON).lon, pc.chart.getObject(const.PARS_FORTUNA).lon

    want_moon, want_pf, moon, pf = _with_chart(data, run)
    assert _diff(moon, want_moon) < 1e-6
    assert _diff(pf, want_pf) < 1e-6


@pytest.mark.parametrize('kind', ['thirteenth', 'dodecatemoria', 'harmonic5', 'draconic-whole'])
@pytest.mark.parametrize('sect', [{}, {'sectBuffer': 'ptolemy5'}, {'sectBuffer': 'apparent'}])
def test_derived_chart_keeps_the_natal_sect(kind, sect):
    """昼夜是出生事实:派生盘的昼夜固定成本命值(含日出缓冲口径)。"""
    data = dict(BASE, **sect)
    natal = _with_chart(data, lambda pc: pc.isDiurnal)

    natal_above = _with_chart(data, lambda pc: {o.id: pc.isAboveHorizon(o) for o in pc.chart.objects if o.id in SEVEN_IDS})

    def derived(pc):
        _apply(kind, pc)
        return pc.isDiurnal, {o.id: pc.isAboveHorizon(o) for o in pc.chart.objects if o.id in SEVEN_IDS}

    sect_after, above_after = _with_chart(data, derived)
    assert sect_after == natal
    assert above_after == natal_above          # 地平上下也取本命


SEVEN_IDS = (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)


@pytest.mark.parametrize('kind', ['thirteenth', 'dodecatemoria', 'harmonic5', 'draconic-whole', 'draconic-shift'])
@pytest.mark.parametrize('time', ['06:48:00', '17:24:00'])
def test_topocentric_moon_on_the_horizon_keeps_the_natal_side(kind, time):
    """站心月贴着地平:地心高度略高于 0,视差把站心月压到地平下。本命按站心位置判在地平下,
    派生盘不能拿地心高度(altitudeTrue)判回地平上 —— 地平上下与得时失时都跟本命。"""
    data = dict(BASE, time=time, topocentricMoon=1)

    def natal(pc):
        moon = pc.chart.getObject(const.MOON)
        return moon.altitudeTrue, pc.isAboveHorizon(moon), {o.id: (o.aboveHorizon, o.hayyiz) for o in pc.chart.objects
                                                           if hasattr(o, 'aboveHorizon')}

    geo_alt, natal_moon_above, natal_flags = _with_chart(data, natal)
    # 判别力自证:本例必须正好落在地心在上、站心在下的缝里,否则这条测不到要测的东西
    assert 0.0 < geo_alt < 1.0 and natal_moon_above is False

    def derived(pc):
        _apply(kind, pc)
        return pc.isAboveHorizon(pc.chart.getObject(const.MOON)), {o.id: o.aboveHorizon for o in pc.chart.objects
                                                                  if hasattr(o, 'aboveHorizon')}

    moon_above, flags = _with_chart(data, derived)
    assert moon_above is False
    assert flags == {k: v[0] for k, v in natal_flags.items()}


def test_relocated_chart_day_night_follows_its_current_positions():
    """组合盘这类搬点盘:昼夜按盘上此刻的太阳与天顶判,不沿用本命高度。"""
    def run(pc):
        natal = pc.chart.isDiurnal()
        sun = pc.chart.getObject(const.SUN)
        mc = pc.chart.getAngle(const.MC)
        sun.relocate(mc.lon)                    # 太阳搬到天顶:必在地平上
        up = pc.chart.isDiurnal()
        sun.relocate((mc.lon + 180.0) % 360.0)  # 搬到天底:必在地平下
        down = pc.chart.isDiurnal()
        return natal, up, down
    natal, up, down = _with_chart(BASE, run)
    assert up is True and down is False


def test_composite_apparent_sunrise_follows_composite_positions(monkeypatch):
    """视日出档:组合盘没有真实日出日没,昼夜按组合太阳在组合地平的上下判(同缺省档),不取星盘 A 的出生日出。
    取例:A 中午生(视日出判昼),组合盘太阳在地平下(夜)。"""
    from astrostudy.modern import chartcomposite as cc
    cap = {}
    original = cc.helper.getChartObj

    def grab(data, pc):
        cap['pc'] = pc
        return original(data, pc)

    monkeypatch.setattr(cc.helper, 'getChartObj', grab)
    a = dict(BASE, time='12:30:00', hsys=0)
    b = dict(a, date='1968/11/20', time='00:30:00')
    got = {}
    for sb in ('geo', 'apparent'):
        inner, outer = dict(a, sectBuffer=sb), dict(b, sectBuffer=sb)
        token = push_classical_request(inner)
        try:
            cc.ChartComposite(copy.deepcopy(inner), copy.deepcopy(outer)).compute()
        finally:
            pop_classical_request(token)
        got[sb] = cap['pc'].isDiurnal
    assert _with_chart(dict(a, sectBuffer='apparent'), lambda pc: pc.isDiurnal) is True
    assert got == {'geo': False, 'apparent': False}


def test_thirteenth_ratio_uses_the_geocentric_moon_speed():
    """十三分盘的比率 = 月速 / 日速,取地心月速度:开不开站心月同一个数(站心月的速度掺着测站随地球自转的分量)。"""
    plain = _with_chart(dict(BASE), lambda pc: ThirteenthChart(pc).ratio)
    topo = _with_chart(dict(BASE, topocentricMoon=1), lambda pc: (ThirteenthChart(pc).ratio, pc.chart.getObject(const.MOON).lonspeed,
                                                                  pc.chart.getObject(const.SUN).lonspeed))
    assert abs(topo[0] - plain) < 1e-9
    # 判别力:这张盘上站心月速度与地心月速度确实不同(否则本断言什么都没锁住)
    assert abs(topo[1] / topo[2] - plain) > 0.5
