import json
import os

import pytest
import swisseph

from flatlib import const

from astrostudy.india import extra_tables as E
from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import build_jyotish
from win_float_golden import golden_equal   # horosa_win_float_golden_v1

CHART = dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20', hsys=5,
             zodiacal=1, tradition=False, predictive=False, siderealMode='lahiri')
IDS = dict(zip(E.TEN, (swisseph.SUN, swisseph.MOON, swisseph.MERCURY, swisseph.VENUS, swisseph.MARS, swisseph.JUPITER, swisseph.SATURN,
                       swisseph.URANUS, swisseph.NEPTUNE, swisseph.PLUTO)))


def tropical_view(jd, lat, lon):
    lons, speeds = {}, {}
    for name, body in IDS.items():
        row = swisseph.calc_ut(jd, body, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        lons[name], speeds[name] = row[0], row[3]
    node = swisseph.calc_ut(jd, swisseph.TRUE_NODE, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
    lons[const.NORTH_NODE], speeds[const.NORTH_NODE] = node[0], node[3]
    lons[const.SOUTH_NODE], speeds[const.SOUTH_NODE] = (node[0] + 180.0) % 360.0, node[3]
    _, angles = swisseph.houses_ex(jd, lat, lon, b'P')
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    return E.VedicView(lons, speeds, angles[0], angles[1], angles[2], lat, eps)


def jyotish():
    return build_jyotish(IndiaChartKernel(dict(CHART)))


def test_samaya_formula_for_a_known_placement():
    lons = {name: 0.0 for name in E.TEN}
    lons[const.NORTH_NODE] = lons[const.SOUTH_NODE] = 0.0
    speeds = {name: 1.0 for name in lons}
    view = E.VedicView(lons, speeds, 30.0, 0.0, 0.0, 0.0, 23.4)
    rows = {row['planet']: row['value'] for row in E.graha_samaya_rows(view)}
    # 上升金牛 A=1,星在白羊 s=0:(a × (1 + 11) + c) mod 27
    assert rows[const.SUN] == (12 * 12 + 24) % 27
    assert rows[const.MOON] == (20 * 12 + 13) % 27


def test_sphuta_sums():
    view = tropical_view(2442454.71875, 47.6, -122.333)
    rows = {row['name']: row['lon'] for row in E.sphuta_rows(view, 100.0)}
    sun, moon, asc = view.lons[const.SUN], view.lons[const.MOON], view.asc
    assert rows['Trisphuta'] == pytest.approx((asc + moon + 100.0) % 360.0)
    assert rows['Chatusphuta'] == pytest.approx((asc + moon + 100.0 + sun) % 360.0)
    assert rows['Prana'] == pytest.approx((5 * asc + 100.0) % 360.0)
    assert rows['Deha'] == pytest.approx((8 * moon + 100.0) % 360.0)
    assert rows['Mrityu'] == pytest.approx((700.0 + sun) % 360.0)
    assert rows['Sookshma'] == pytest.approx((5 * asc + 8 * moon + 7 * 100.0 + 200.0 + sun) % 360.0)
    assert len(rows) == 7


@pytest.mark.parametrize('elongation, expected', [(10, -22), (40, -7), (100, 0), (140, 7), (170, 22), (200, -22), (260, -7), (300, 0), (320, 7), (350, 22)])
def test_moon_phase_bands(elongation, expected):
    assert E.moon_phase_points(elongation) == expected


def test_dirah_variants_differ_only_where_documented():
    view = tropical_view(2442454.71875, 47.6, -122.333)
    improved = E.dirah_bala_row(view, const.SUN, view.lons[const.SUN])
    classic = E.dirah_bala_row(view, const.SUN, view.lons[const.SUN], classic=True)
    assert set(improved) - set(classic) <= {8, 15}


def test_dirah_sum_is_the_row_total():
    table = jyotish()['extraTables']
    for row in table['dirah'] + table['dirahClassic']:
        assert row['sum'] == sum(row['scores'].values())


def test_western_dirah_counts_jupiter_for_every_planet():
    view = tropical_view(2442454.71875, 47.6, -122.333)
    jupiter = view.lons[const.JUPITER]
    for name in (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS):
        row = E.dirah_western_row(view, name, view.lons)
        in_aspect = E._in_aspect(view.lons[name], jupiter, E.WESTERN_RADII[name] + E.WESTERN_RADII[const.JUPITER])
        assert (8 in row) is in_aspect


def test_engine_block_has_every_table():
    table = jyotish()['extraTables']
    assert table['available'] is True
    assert [len(table[key]) for key in ('samaya', 'dirah', 'dirahClassic', 'dirahWestern', 'sphuta')] == [7, 7, 7, 10, 7]
    assert all(0 <= row['value'] <= 26 for row in table['samaya'])


def test_polar_chart_keeps_the_other_tables():
    table = build_jyotish(IndiaChartKernel(dict(CHART, date='2024/06/21', time='12:00:00', zone='+00:00', lat='80n00', lon='0e00')))['extraTables']
    assert table['available'] is True and len(table['dirah']) == 7


def test_extra_tables_stay_on_the_birth_chart_in_a_varga():
    from astrostudy.india.varga import apply_varga_chart
    natal = IndiaChartKernel(dict(CHART))
    d1 = IndiaChartKernel(dict(CHART))
    apply_varga_chart(natal, 9)
    assert build_jyotish(natal, 9, d1)['extraTables']['samaya'] == jyotish()['extraTables']['samaya']


def test_ashtakoota_same_moon():
    result = E.ashtakoota(10.0, 10.0)
    rows = {row['name']: row for row in result['rows']}
    assert rows['Nadi']['score'] == 0.0
    assert rows['Bhakoot']['score'] == 7.0
    assert rows['Graha Maitri']['score'] == 5.0 and rows['Graha Maitri']['classic'] == 3.0
    assert result['max'] == 36 and sum(row['max'] for row in result['rows']) == 36


@pytest.mark.parametrize('gap, expected', [(30, 0.0), (330, 0.0), (120, 0.0), (240, 0.0), (150, 0.0), (210, 0.0), (0, 7.0), (60, 7.0), (90, 7.0), (180, 7.0)])
def test_bhakoot_bad_distances(gap, expected):
    rows = {row['name']: row for row in E.ashtakoota(5.0, (5.0 + gap) % 360.0)['rows']}
    assert rows['Bhakoot']['score'] == expected


def test_ashtakoota_only_three_rows_change_in_the_older_table():
    for groom in range(0, 360, 37):
        for bride in range(5, 360, 41):
            result = E.ashtakoota(float(groom), float(bride))
            changed = {row['name'] for row in result['rows'] if row['score'] != row['classic']}
            assert changed <= {'Varna', 'Graha Maitri', 'Gana'}


def test_ashtakoota_uses_sidereal_moons_and_male_side():
    # 两张盘的月亮不同座不同宿,男方换边才测得出
    other = dict(CHART, date='1980/07/05', time='10:00:00')
    forward = E.build_ashtakoota({'inner': dict(CHART), 'outer': other})
    swapped = E.build_ashtakoota({'inner': dict(CHART), 'outer': other, 'maleSide': 'outer'})
    assert forward['maleSide'] == 'inner' and swapped['maleSide'] == 'outer'
    assert forward['groomNakshatra'] != forward['brideNakshatra']
    assert forward['groomSign'] != forward['brideSign']
    assert forward['groomNakshatra'] == swapped['brideNakshatra']
    assert forward['brideNakshatra'] == swapped['groomNakshatra']
    moon = IndiaChartKernel(dict(CHART)).chart.get(const.MOON).lon
    bride = IndiaChartKernel(dict(other)).chart.get(const.MOON).lon
    assert forward['groomSign'] == E.sign_of(moon)
    assert forward['brideSign'] == E.sign_of(bride)
    assert forward['brideNakshatra'] == E.nakshatra_of(bride) + 1


def test_ashtakoota_follows_the_ayanamsa():
    # Raman 与 Lahiri 差约 1.4°,这对盘的月亮因此换宿,总分要跟着变
    other = dict(CHART, date='1980/07/01', time='10:00:00')
    lahiri = E.build_ashtakoota({'inner': dict(CHART), 'outer': other})
    raman = E.build_ashtakoota({'inner': dict(CHART), 'outer': other, 'siderealAyanamsa': 'raman'})
    assert raman['total'] != lahiri['total']
    assert raman['ayanamsa'] != lahiri['ayanamsa']


def view_with(lons=None, speeds=None, asc=0.0, phi=47.6):
    base = {name: 10.0 for name in E.TEN}
    base[const.NORTH_NODE] = base[const.SOUTH_NODE] = 10.0
    base.update(lons or {})
    rates = {name: 1.0 for name in base}
    rates.update(speeds or {})
    return E.VedicView(base, rates, asc, (asc + 270.0) % 360.0, 90.0, phi, 23.44)


def real_view():
    return E.view_of(IndiaChartKernel(dict(CHART)))


def test_dirah_reads_the_compound_relation_toward_the_sign_lord():
    view, tropical = real_view()
    # 这张盘的火星在射手,座主木星:天然友 + 临时友
    assert view.signs[const.MARS] == 8
    assert E.dirah_bala_row(view, const.MARS, tropical[const.MARS]).get(4) == 20


def test_dirah_relation_columns_show_up_across_charts():
    seen = set()
    for year in range(1950, 2030, 3):
        view, tropical = E.view_of(IndiaChartKernel(dict(CHART, date='{0}/03/10'.format(year))))
        for name in E.SEVEN:
            seen |= set(E.dirah_bala_row(view, name, tropical[name]))
    assert {4, 5, 7, 8} <= seen


def test_great_enemy_scores_by_variant():
    # 水星在巨蟹:月亮是水星的天然敌;月亮在水星后第 7 座,临时敌
    view = view_with({const.MERCURY: 95.0, const.MOON: 275.0})
    assert E.compound_relation(const.MERCURY, const.MOON, view.sign_names) == 'adhisatru'
    improved = E.dirah_bala_row(view, const.MERCURY, 95.0)
    classic = E.dirah_bala_row(view, const.MERCURY, 95.0, classic=True)
    assert improved.get(8) == -20 and 7 not in improved
    assert classic.get(7) == -10 and 8 not in classic


def test_directional_strength_wraps_past_the_twelfth_house(monkeypatch):
    view = view_with()
    monkeypatch.setattr(view, 'placidus', lambda name, lon: 12.7)
    assert E.dirah_bala_row(view, const.MERCURY, 10.0).get(10) == 15
    monkeypatch.setattr(view, 'placidus', lambda name, lon: 3.0)
    assert 10 not in E.dirah_bala_row(view, const.MERCURY, 10.0)


@pytest.mark.parametrize('speed, slow', [(0.045, True), (0.05, False), (-0.02, True), (-0.03, False)])
def test_slow_motion_bound_differs_when_retrograde(speed, slow):
    view = view_with(speeds={const.JUPITER: speed})
    assert (12 in E.dirah_bala_row(view, const.JUPITER, 10.0)) is slow


def test_polar_houses_stay_ordered():
    params = dict(CHART, date='2000/12/21', time='12:00:00', zone='+01:00', lat='78n13', lon='15e39')
    view, _ = E.view_of(IndiaChartKernel(params))
    assert view.polar is True
    samples = [view.placidus(const.SUN, float(lon)) for lon in range(0, 360, 5)]
    # 黄经走一圈,宫位值也恰好单调走一圈:乱序的宫头哪怕只有一处回跳,这里的和就不是 12
    steps = [(b - a) % 12.0 for a, b in zip(samples, samples[1:] + samples[:1])]
    assert abs(sum(steps) - 12.0) < 1e-6
    assert build_jyotish(IndiaChartKernel(params))['extraTables']['polar'] is True


def test_ordinary_chart_is_not_polar():
    assert jyotish()['extraTables']['polar'] is False


def test_missing_outer_planets_keep_the_tables(monkeypatch):
    kernel = IndiaChartKernel(dict(CHART))
    chart = kernel.chart
    original = chart.get

    def only_inner(name):
        if name in (const.URANUS, const.NEPTUNE, const.PLUTO):
            raise KeyError(name)
        return original(name)

    monkeypatch.setattr(chart, 'get', only_inner)
    table = E.build_extra_tables(kernel, 100.0)
    assert len(table['dirah']) == 7 and len(table['dirahWestern']) == 7


def test_ashtakoota_reports_the_ayanamsa_used():
    other = dict(CHART, date='1980/07/01', time='10:00:00')
    assert E.build_ashtakoota({'inner': dict(CHART), 'outer': other})['ayanamsa'].startswith('Lahiri')
    assert E.build_ashtakoota({'inner': dict(CHART), 'outer': other, 'siderealAyanamsa': 'user'})['ayanamsa'].startswith('Lahiri')
    assert E.build_ashtakoota({'inner': dict(CHART), 'outer': other, 'siderealAyanamsa': 'raman'})['ayanamsa'] == 'Raman'


def test_western_classic_only_drops_uranus_in_aquarius():
    # 2006 年天王星在恒星水瓶
    params = dict(CHART, date='2006/03/01', time='12:00:00')
    table = build_jyotish(IndiaChartKernel(params))['extraTables']
    improved = {row['planet']: row['scores'] for row in table['dirahWestern']}
    classic = {row['planet']: row['scores'] for row in table['dirahWesternClassic']}
    assert improved[const.URANUS].get('1') == 1
    assert '1' not in classic[const.URANUS]
    assert {k: v for k, v in improved.items() if k != const.URANUS} == {k: v for k, v in classic.items() if k != const.URANUS}


GOLDEN_PATH = os.path.join(os.path.dirname(__file__), 'data', 'golden_india_tables.json')
GOLDEN_CHARTS = {
    'seattle-1975': CHART,
    'beijing-1990': dict(CHART, date='1990/05/15', time='12:00:00', zone='+08:00', lat='39n54', lon='116e24'),
    'sydney-1962': dict(CHART, date='1962/11/03', time='05:40:00', zone='+10:00', lat='33s52', lon='151e13'),
    'delhi-2004': dict(CHART, date='2004/08/21', time='23:10:00', zone='+05:30', lat='28n37', lon='77e13'),
    'london-1941': dict(CHART, date='1941/01/30', time='03:25:00', zone='+00:00', lat='51n30', lon='0w07'),
    'quito-2018': dict(CHART, date='2018/09/09', time='17:55:00', zone='-05:00', lat='0s13', lon='78w31'),
}
GOLDEN_PAIRS = {
    'a': ('seattle-1975', 'beijing-1990'), 'b': ('sydney-1962', 'delhi-2004'), 'c': ('london-1941', 'quito-2018'), 'd': ('delhi-2004', 'seattle-1975'),
}


def golden_snapshot():
    charts = {}
    for name, params in GOLDEN_CHARTS.items():
        jyotish = build_jyotish(IndiaChartKernel(dict(params)))
        charts[name] = {'extra': jyotish['extraTables'], 'yoga': [[row['id'], row['hit'], row['classicHit']] for row in jyotish['yogaTable']['rows']]}
    pairs = {}
    for name, (inner, outer) in GOLDEN_PAIRS.items():
        pairs[name] = E.build_ashtakoota({'inner': GOLDEN_CHARTS[inner], 'outer': GOLDEN_CHARTS[outer]})
    return json.loads(json.dumps({'charts': charts, 'pairs': pairs}))


@pytest.mark.parametrize('name', sorted(GOLDEN_CHARTS))
def test_tables_match_the_golden_chart(name):
    with open(GOLDEN_PATH, encoding='utf-8') as handle:
        golden = json.load(handle)
    # horosa_win_float_golden_v1(Windows 侧移植适配):金标是在另一套数学库上录的,本机浮点末位与并列行次序不同;
    # 按 win_float_golden 的口径比(浮点差 1e-4 以内,整数、文字、布尔、键集合、行数仍须相等)。
    assert golden_equal(golden_snapshot()['charts'][name], golden['charts'][name])


def test_ashtakoota_pairs_match_the_golden():
    with open(GOLDEN_PATH, encoding='utf-8') as handle:
        golden = json.load(handle)
    assert golden_snapshot()['pairs'] == golden['pairs']


def test_western_retrograde_only_counts_the_inner_three():
    # 2023-10-15 木星、土星都在逆行
    params = dict(CHART, date='2023/10/15', time='12:00:00')
    kernel = IndiaChartKernel(params)
    assert kernel.chart.get(const.JUPITER).lonspeed < 0 and kernel.chart.get(const.SATURN).lonspeed < 0
    scores = {row['planet']: row['scores'] for row in build_jyotish(kernel)['extraTables']['dirahWestern']}
    assert '10' not in scores[const.JUPITER] and '10' not in scores[const.SATURN]


def test_dosha_cancellations_are_flagged_without_changing_the_score():
    from astrostudy.india.extra_tables import ashtakoota
    res = ashtakoota(40.0, 190.0)            # 金牛、天秤:6/8 落 Bhakoot 0 分,两座同属金星
    bhakoot = next(d for d in res['doshas'] if d['koota'] == 'Bhakoot')
    assert bhakoot['present'] and 'sameSignLord' in bhakoot['cancel']
    assert next(r for r in res['rows'] if r['name'] == 'Bhakoot')['score'] == 0.0
    nadi = next(d for d in ashtakoota(5.0, 12.0)['doshas'] if d['koota'] == 'Nadi')
    assert nadi['present'] and 'sameNakshatraDifferentPada' in nadi['cancel']
