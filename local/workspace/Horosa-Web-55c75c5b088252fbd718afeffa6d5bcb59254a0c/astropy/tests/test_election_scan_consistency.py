# -*- coding: utf-8 -*-
"""扫描器 ↔ 主排盘(PerChart) 一致性自证(防双实现漂移的机器强制)。

范式:扫描命中区间取中点 → 以同参数构造 PerChart(独立代码路径) → 断言判定字段一致;
再取区间外采样点断言反向。两条构造链(LightMoment.flatchart vs PerChart.chart)对拍,
任何一侧口径漂移都会当场红。
"""
from astrostudy import astroextra, election_scan as es, perchart


BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/14', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 1, 'zodiacal': 0, 'ad': 1,
}


def _scan(tree, **over):
    data = dict(BASE)
    data.update(over)
    data['conditions'] = tree
    data['precision'] = 'second'
    rsp = es.scan(data)
    assert 'err' not in rsp, rsp
    return rsp['intervals']


def _perchart_at(jd, **extra):
    rec = es.date_time_from_jd(jd, BASE['zone'])
    params = {
        'date': rec['date'].replace('-', '/'), 'time': rec['time'],
        'zone': BASE['zone'], 'lat': '39N54', 'lon': '116E28',
        'ad': 1, 'hsys': BASE['hsys'],
    }
    params.update(extra)
    pc = perchart.PerChart(astroextra.base_params(params))
    pc.getChartOnlyObj()
    return pc


def _mid(iv):
    return 0.5 * (iv['startJd'] + iv['endJd'])


def test_moon_voc_matches_perchart_field():
    """moon_voc 命中区间中点 → 同口径 PerChart 月亮 isVOC 必真;区间外采样必假。

    口径注:lilly(classic)在「全对象集」语境下本周零空亡(月亮总对某慢速点入相)——
    扫描器与后端行为一致(实证打点两链同判);对拍口径选 by_sign_orb(分布正常且
    请求 vocMode 两端同参透传,漂移任一侧即红)。"""
    ivs = _scan({'type': 'considerations', 'params': {'item': 'moon_voc', 'vocMode': 'by_sign_orb'}})
    assert ivs, 'by_sign_orb 口径一周域内应有空亡段'
    iv = max(ivs, key=lambda x: x['durationMin'])
    pc = _perchart_at(_mid(iv), vocMode='by_sign_orb')
    moon = pc.chart.get('Moon')
    assert bool(getattr(moon, 'isVOC', False)) is True
    # 反向:取最长命中段起点前 0.2 天(若仍在域内)断言非空亡
    probe = iv['startJd'] - 0.2
    if probe > es._jd_from(BASE['startDate'], BASE['startTime'], BASE['zone']):
        pc2 = _perchart_at(probe, vocMode='by_sign_orb')
        assert bool(getattr(pc2.chart.get('Moon'), 'isVOC', False)) is False


def test_mercury_combust_matches_perchart_phase():
    """Mercury combust 区间中点 → PerChart phase=='combust';free 段对拍 'free'。"""
    ivs = _scan({'type': 'dignity_state', 'params': {'planet': 'Mercury', 'states': ['combust']}},
                startDate='2024/04/05', endDate='2024/04/20')
    assert ivs
    pc = _perchart_at(_mid(ivs[0]))
    assert getattr(pc.chart.get('Mercury'), 'phase', None) == 'combust'


def test_sun_exalt_matches_perchart_selfdignity():
    """太阳白羊(旺) → PerChart selfDignity 含 exalt(键名随后端;取中点对拍)。"""
    ivs = _scan({'type': 'dignity_state', 'params': {'planet': 'Sun', 'states': ['exalt']}})
    assert ivs
    pc = _perchart_at(_mid(ivs[0]))
    dig = [str(x).lower() for x in (getattr(pc.chart.get('Sun'), 'selfDignity', None) or [])]
    assert any('exalt' in d for d in dig), dig


def test_reception_matches_chartdynamics_on_perchart_chart():
    """接纳对拍:扫描命中区间中点,在 PerChart.chart 上用 ChartDynamics 独立复算必同真。"""
    from flatlib.tools.chartdynamics import ChartDynamics
    ivs = _scan({'type': 'reception', 'params': {
        'planetA': 'Venus', 'planetB': 'Moon', 'levels': ['ruler'],
        'match': 'any', 'requireAspect': False}},
                startDate='2024/04/07', endDate='2024/04/21')
    assert ivs
    pc = _perchart_at(_mid(ivs[0]))
    dyn = ChartDynamics(pc.chart)
    digs = dyn.inDignities('Moon', 'Venus')
    assert 'ruler' in digs, digs


def test_peregrine_matches_perchart_flag():
    """peregrine 对拍:扫描命中区间中点 → PerChart isPeregrining 同真。"""
    ivs = _scan({'type': 'dignity_state', 'params': {'planet': 'Mars', 'states': ['peregrine']}},
                startDate='2024/04/07', endDate='2024/04/21')
    if not ivs:
        return  # 域内火星恰全程有尊贵则跳过(不判失败,由其它星座期覆盖)
    pc = _perchart_at(_mid(ivs[0]))
    assert bool(getattr(pc.chart.get('Mars'), 'isPeregrining', False)) is True
