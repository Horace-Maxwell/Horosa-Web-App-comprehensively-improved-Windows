# -*- coding: utf-8 -*-
"""bug 修复回归:格局分析的相位容许度须与星图所绘一致(moiety,非固定 8°),
极区行星时须优雅返回 None。皆为 feral 同坑(固定容许度偏离 app 引擎)的延伸修复。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import astroextra

_FZ = {'zone': '+08:00', 'lat': '26N04', 'lon': '119E19', 'ad': 1, 'hsys': 1}


def _analyze(date, time, **kw):
    p = dict(_FZ); p.update(kw); p['date'] = date; p['time'] = time
    return astroextra.analyze_chart(p)


def test_aspect_dynamics_uses_wheel_orb_not_fixed_8():
    # 2026/01/03 00:00:月对日冲 10.5°、对金冲 9.5°、合水 0.6°(星图均绘,日15/月12 容许内)。
    # 旧固定 8° 漏掉日月宽相 → 传光/聚光假「未检出」。修复后须检出传光+聚光。
    ad = _analyze('2026/01/03', '00:00:00')['aspectDynamics']
    assert ad.get('translation'), 'translation 不应为空(月宽相被固定8°漏掉的回归)'
    assert ad.get('collection'), 'collection 不应为空(日聚水金之光)'
    # 聚光者=太阳(收水星、金星之光)
    assert any(c.get('collector') == 'Sun' for c in ad['collection']), ad['collection']


def test_accidental_dignity_luminary_conjunction_uses_wheel_orb():
    # 2025/02/24 12:00:日土合 14.31°(在日 15° 容许内,星图绘合)→ 偶然尊贵须计「会土-5」。
    # 旧固定 8° 会漏掉,导致太阳分值虚高。
    ac = _analyze('2025/02/24', '12:00:00')['accidentalDignity']
    sun = [r for r in ac if r['planet'] == 'Sun'][0]
    assert '会土-5' in sun['factors'], sun['factors']


def test_planetary_hours_polar_returns_none():
    # 极区(70N 夏至)太阳不升不落:rise_trans 返回 -2,不可静默取 0(否则昼夜弧塌缩成伪时段)→ None。
    ph = _analyze('1980/06/21', '12:00:00', zone='+01:00', lat='70N00', lon='18E57')['planetaryHours']
    assert ph is None, ph
    # 非极区正常返回时段表(回归守卫:别把所有盘都判成极区)。
    ph2 = _analyze('1990/05/15', '12:00:00')['planetaryHours']
    assert ph2 is not None and ph2.get('sunrise') != ph2.get('sunset')


def test_distribution_hemispheres_by_horizon_not_longitude():
    # 半球须按地平/子午轴(ASC-DSC/MC-IC),非黄经绝对值。回归:ASC 远离 0°白羊(本盘天秤)时旧黄经口径全错。
    from astrostudy.perchart import PerChart
    p = astroextra.base_params({'date': '1990/05/15', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E29', 'ad': 1, 'hsys': 1})
    pc = PerChart(p)
    asc = pc.chart.get('Asc').lon
    mc = pc.chart.get('MC').lon
    bodies = [q for q in astroextra.chart_points(pc, include_angles=False) if q['id'] in astroextra.DISTRIBUTION_BODIES]   # [Q-557] 只计七政
    exp_below = sum(1 for q in bodies if ((q['lon'] - asc) % 360.0) < 180.0)
    exp_east = sum(1 for q in bodies if ((q['lon'] - mc) % 360.0) < 180.0)
    d = astroextra.analyze_chart({'date': '1990/05/15', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E29', 'ad': 1, 'hsys': 1})['distribution']['hemispheres']
    assert d['below'] == exp_below and d['above'] == len(bodies) - exp_below, (d, exp_below)
    assert d['east'] == exp_east and d['west'] == len(bodies) - exp_east, (d, exp_east)
    # 证明确实改了:本盘按黄经口径 below 计数与按地平不同。
    lon_below = sum(1 for q in bodies if 0 <= q['lon'] < 180)
    assert exp_below != lon_below, '本盘地平口径应与旧黄经口径不同(否则测不出回归)'


def test_distribution_counts_classical_seven_only():
    # [Q-557/T-519] 分布权重三组各只计七政:总和恒 7(此前含天海冥=10);显式 ids 仍可扩。
    d = astroextra.analyze_chart({'date': '1990/05/15', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E29', 'ad': 1, 'hsys': 1})['distribution']
    assert sum(d['elements'].values()) == 7
    assert sum(d['modes'].values()) == 7
    assert d['hemispheres']['above'] + d['hemispheres']['below'] == 7
    from astrostudy.perchart import PerChart
    pc = PerChart(astroextra.base_params({'date': '1990/05/15', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E29', 'ad': 1, 'hsys': 1}))
    pts = astroextra.chart_points(pc, include_angles=True)
    d10 = astroextra.distribution(pts, None, None, ids=astroextra.DEFAULT_EVENT_PLANETS)
    assert sum(d10['elements'].values()) == 10
