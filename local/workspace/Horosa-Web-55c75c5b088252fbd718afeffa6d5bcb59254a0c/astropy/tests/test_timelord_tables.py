# -*- coding: utf-8 -*-
"""时主轮转与匀速点:次序、段长、年龄换算的原理锁。golden 用手算值和裸星历。"""
import json
import math

import pytest
import swisseph

from astrostudy import directed_figures as D
from astrostudy import timelord_tables as T

LONS = {'Sun': 10.0, 'Moon': 330.5, 'Mercury': 40.0, 'Venus': 100.0, 'Mars': 150.0, 'Jupiter': 200.0, 'Saturn': 280.0}


def test_rings_start_where_asked():
    assert T.zodiac_ring('Mars', LONS) == ['Mars', 'Jupiter', 'Saturn', 'Moon', 'Sun', 'Mercury', 'Venus']
    assert T.turn_sequence('chaldean', 'Sun', LONS, 0)[:3] == ['Sun', 'Venus', 'Mercury']
    assert T.turn_sequence('astronomical', 'Mars', LONS, 0)[:3] == ['Mars', 'Jupiter', 'Saturn']


def test_house_ruler_ring_starts_at_the_first_house_ruled_by_the_start():
    # 上升天秤,土星最早管第 4 宫(摩羯)
    ring = T.house_ruler_ring(6, 'Saturn')
    assert ring[:3] == ['Saturn', 'Saturn', 'Jupiter']
    assert len(ring) == 12


def test_orb_cycle_restarts_after_24_years():
    lords = T.orb_lords('cycle', 0, 'Saturn', 49)
    assert lords[:8] == ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn']
    assert lords[24:32] == lords[:8]


def test_orb_single_walks_twelve_years():
    lords = T.orb_lords('single', 6, 'Saturn', 25)
    assert lords[12:24] == lords[:12]


def test_quarters_shift_three_places_each_cycle():
    rows = T.quarter_periods('Moon', LONS, 14)
    order = T.zodiac_ring('Moon', LONS)
    assert [r['lord'] for r in rows[:7]] == order
    assert rows[7]['lord'] == order[3] and rows[7]['cycle'] == 2
    assert rows[0]['days'] == 25 * 90.0


def test_monomoiria_first_degree_belongs_to_the_sign_ruler():
    assert T.monomoiria_start(330.5) == 'Jupiter'      # 双鱼第 1 度
    assert T.monomoiria_start(331.5) == 'Mars'         # 迦勒底序下一位
    rows = T.monomoiria_periods('Jupiter', LONS, 8)
    assert rows[0]['days'] == 6 * 360.0
    assert sum(r['days'] for r in rows[:7]) == 28 * 360.0
    assert rows[7]['lord'] == T.zodiac_ring('Jupiter', LONS)[1]


def test_moon_nine_first_period_uses_remaining_degrees_unless_classic():
    assert abs(T.moon_nine_periods(330.5, 2)[0]['days'] - 29.5 * 108.0) < 1e-9
    assert abs(T.moon_nine_periods(330.5, 2, True)[0]['days'] - 0.5 * 108.0) < 1e-9
    assert T.moon_nine_periods(330.5, 3)[1]['sign'] == 0


def test_nine_part_lords():
    assert T.navamsa_lord(0.5) == 'Mars'            # 白羊第一个九分度 = 白羊
    assert T.navamsa_lord(4.0) == 'Venus'           # 第二个 = 金牛
    assert T.navamsa_lord(95.0) == 'Sun'            # 水象从巨蟹起,第二个九分度是狮子
    assert T.nine_part(0.5) == ('Mars', 'Mars')
    assert T.nine_part(1.5) == ('Mars', 'Sun')
    assert T.nine_part(2.5) == ('Mars', 'Jupiter')
    assert T.nine_part(32.5) == ('Saturn', 'Mercury')


def test_nine_part_first_row_covers_only_the_remainder():
    rows = T.nine_part_rows(0.5, 40.0, 23.44, False, False, 5.0)
    assert abs(rows[0]['endAge'] - (10.0 / 9.0 - 0.5)) < 1e-9
    assert abs(rows[1]['endAge'] - rows[0]['endAge'] - 10.0 / 9.0) < 1e-9
    assert rows[0]['lord'] == 'Mars' and rows[0]['sub'] == 'Mars'
    assert rows[1]['sub'] == 'Sun'


def test_nine_part_reverse_stays_inside_the_first_navamsa():
    plain = T.nine_part_rows(1.5, 40.0, 23.44, False, False, 5.0)       # 第二子段起算
    turned = T.nine_part_rows(1.5, 40.0, 23.44, False, True, 5.0)
    assert [r['sub'] for r in plain[:3]] == ['Sun', 'Jupiter', 'Mars']
    assert [r['sub'] for r in turned[:3]] == ['Sun', 'Mars', 'Mars']
    assert [r['lord'] for r in turned[:3]] == [r['lord'] for r in plain[:3]]
    for start in (0.5, 2.5):                                            # 首子段、末子段起算:本九分度内无段可倒
        assert T.nine_part_rows(start, 40.0, 23.44, False, True, 5.0) == T.nine_part_rows(start, 40.0, 23.44, False, False, 5.0)


def test_nine_part_classic_birth_row_is_the_ascendant_cell():
    k = T.nine_cell(185.224)
    rows = T.nine_part_rows(185.224, 47.6, 23.44, True, False, 10.0, classic=True)
    assert rows[0]['startAge'] == 0.0
    assert (rows[0]['lord'], rows[0]['sub']) == T.nine_part((k + 0.5) * T.NINE_STEP)
    assert (rows[1]['lord'], rows[1]['sub']) == T.nine_part((k + 1.5) * T.NINE_STEP)
    assert all(a['endAge'] == b['startAge'] for a, b in zip(rows, rows[1:]))


def test_nine_part_classic_keeps_the_sign_at_a_sign_boundary():
    k = T.nine_cell(29.0)
    rows = T.nine_part_rows(29.0, 40.0, 23.44, True, False, 120.0, classic=True)
    for i, row in enumerate(rows[:60]):
        assert (row['lord'], row['sub']) == T.nine_part((k + i + 0.5) * T.NINE_STEP)


def test_nine_cell_treats_an_exact_boundary_as_the_next_cell():
    assert T.nine_cell(100.0) == 90
    assert T.nine_part_rows(100.0, 40.0, 23.44, False, False, 5.0)[0]['endAge'] > 1.0


def test_nine_part_ages_keep_growing_across_zero_aries():
    rows = T.nine_part_rows(359.5, 40.0, 23.44, False, False, 5.0)
    ages = [r['endAge'] for r in rows]
    assert ages == sorted(ages) and ages[-1] < 8.0


def test_moving_point_ages_are_arc_over_rate():
    points = {'Sun': 100.0}
    rows = T.moving_point_events(40.0, points, 30.0, 12.0)
    hits = {}
    for r in rows:
        hits.setdefault((r['aspect'], r['side']), r['age'])
    assert abs(hits[(0, None)] - 2.0) < 1e-9
    assert abs(hits[(60, 'S')] - 0.0) < 1e-9        # 100 − 60 = 40,正在起点
    assert abs(hits[(60, 'D')] - 4.0) < 1e-9
    assert abs(hits[(180, None)] - 8.0) < 1e-9


def test_opposite_pairs_do_not_repeat_the_same_point():
    points = {'North Node': 10.0, 'South Node': 190.0, 'House1': 41.0, 'House7': 221.0, 'Sun': 77.0}
    rows = list(T.aspect_points(points))
    seen = [(round(at, 6)) for _name, _angle, _side, at in rows if _name != 'Sun']
    assert len(seen) == len(set(seen)) == 16
    assert {angle for name, angle, _s, _a in rows if name == 'North Node'} == {0}
    assert 180 not in {angle for name, angle, _s, _a in rows if name == 'South Node'}
    assert sum(1 for name, *_rest in rows if name == 'Sun') == 8


def test_developmental_age_lengths_sum_to_ninety():
    assert sum(T.DEV_LENGTHS) == 90
    assert T.developmental_age(0.0) == 0.0
    assert abs(T.developmental_age(15.0) - 1.0) < 1e-9
    assert abs(T.developmental_age(30.0) - 2.0) < 1e-9
    assert abs(T.developmental_age(359.999) - 90.0) < 1e-3


def test_developmental_age_by_house_is_continuous():
    cusps = [i * 25.0 for i in range(6)] + [125.0 + i * 39.0 for i in range(6)]
    ages = [T.developmental_age(c + 0.01, cusps) for c in cusps]
    assert ages == sorted(ages) and ages[0] < 0.01 and ages[-1] < 90.0
    for a, b in ((cusps[1] - 1e-6, cusps[1] + 1e-6), (cusps[8] - 1e-6, cusps[8] + 1e-6)):
        assert abs(T.developmental_age(a, cusps) - T.developmental_age(b, cusps)) < 1e-3


def test_diurnal_moves_clockwise_from_the_ascendant():
    cusps = [i * 30.0 for i in range(12)]
    assert abs(T.diurnal_age(330.0, cusps, 'five') - 5.0) < 1e-9        # 第 12 宫走完
    assert abs(T.diurnal_age(345.0, cusps, 'five') - 2.5) < 1e-9
    assert abs(T.diurnal_age(0.5, cusps, 'five') - (60.0 - 5.0 / 60.0)) < 1e-9
    assert abs(T.diurnal_age(330.0, cusps, 'seven') - 7.0) < 1e-9


def test_quadrant_age_lengths_and_the_ascendant_closing_the_circle():
    asc, mc = 100.0, 10.0       # 四象限各 90°
    assert abs(T.quadrant_age(10.0, asc, mc) - 22.0) < 1e-9
    assert abs(T.quadrant_age(280.0, asc, mc) - 42.0) < 1e-9
    assert abs(T.quadrant_age(190.0, asc, mc) - 61.0) < 1e-9
    assert abs(T.quadrant_age(100.0, asc, mc) - 90.0) < 1e-9
    assert abs(T.quadrant_age(55.0, asc, mc) - 11.0) < 1e-9


def test_quadrant_age_scales_inside_a_short_quadrant():
    asc, mc = 100.0, 40.0       # 第一象限只有 60°
    assert abs(T.quadrant_age(70.0, asc, mc) - 11.0) < 1e-9
    assert abs(T.quadrant_age(39.9, asc, mc) - (22.0 + 20.0 * 0.1 / 120.0)) < 1e-9


def test_quadrant_age_classic_uses_fixed_rates():
    asc, mc = 185.2242, 96.4917
    first = (asc - mc) % 360.0
    assert abs(T.quadrant_age(asc - first / 2.0, asc, mc, True) - first / 2.0 * 21.0 / 90.0) < 1e-9
    assert abs(T.quadrant_age(asc - 200.0, asc, mc, True) - (42.0 + 20.0 * 18.0 / 90.0)) < 1e-9
    assert abs(T.quadrant_age(asc, asc, mc, True) - (61.0 + (360.0 - 180.0 - first) * 29.0 / 90.0)) < 1e-9


def test_lifetime_scale():
    days = T.lifetime_ages(120.0)
    assert abs(days[0] / 365.2422 - 6.89) < 0.01
    assert abs(T.lifetime_ages(240.0)[0] / 365.2422 - 75.83) < 0.05
    prenatal = T.lifetime_ages(300.0)
    assert len(prenatal) == 2 and prenatal[1] < 0


def test_moon_arrival_is_exact():
    jd = 2451545.0
    target = (swisseph.calc_ut(jd, swisseph.MOON)[0][0] + 90.0) % 360.0
    when = T.moon_arrival(jd, target)
    lon = swisseph.calc_ut(when, swisseph.MOON)[0][0]
    assert abs(((lon - target + 180.0) % 360.0) - 180.0) < 1e-6
    assert 5.0 < when - jd < 9.0


CHART = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'gpsLat': 47.6,
         'gpsLon': -122.333, 'hsys': 0, 'targetDate': '2026/01/01'}


def test_hour_lord_uses_seasonal_hours():
    res = T.build_timelords(dict(CHART, method='turn', turnStart='hour'))
    assert res['hourLord'] == 'Saturn'
    assert res['rows'][0]['lord'] == 'Saturn'


def test_turn_starts_from_the_ascendant_ruler_by_default():
    res = T.build_timelords(dict(CHART, method='turn'))
    assert res['rows'][0]['lord'] == 'Venus'
    assert res['rows'][1]['lord'] != 'Venus'
    assert res['kind'] == 'periods' and len(res['rows']) == 100


def test_current_index_points_at_the_target_date():
    res = T.build_timelords(dict(CHART, method='turn', targetDate='2000/06/01'))
    row = res['rows'][res['currentIndex']]
    assert row['start'] <= '2000-06-01' <= row['end'] or row['startAge'] <= 25.4 < row['endAge']


def test_year_type_changes_dates():
    solar = T.build_timelords(dict(CHART, method='turn', yearType='solar'))
    egypt = T.build_timelords(dict(CHART, method='turn', yearType='hellenistic'))
    assert solar['rows'][50]['start'] != egypt['rows'][50]['start']


def test_annual_divisions_cover_the_birth_year_then_solar_returns():
    res = T.build_timelords(dict(CHART, method='annual', maxAge=3))
    assert len(res['rows']) == 3
    first, second = res['rows'][:2]
    assert first['startAge'] == 0.0 and first['lord'] == T.SIGN_RULERS[res['ascSign']]
    assert second['lord'] == T.SIGN_RULERS[(res['ascSign'] + 1) % 12]
    assert abs(second['startAge'] - 1.0) < 0.01
    assert [c['days'] for c in second['children']] and len(second['children']) == 7
    assert sum(c['days'] for c in second['children']) == 328


def test_year_length_echoes_what_each_method_really_used():
    assert T.build_timelords(dict(CHART, method='moving'))['yearType'] == 'sidereal'
    assert T.build_timelords(dict(CHART, method='turn'))['yearType'] == T.DEFAULT_YEAR
    assert T.build_timelords(dict(CHART, method='turn', yearType='nope'))['yearType'] == T.DEFAULT_YEAR
    for method in ('annual', 'lifetime', 'moondays'):
        assert T.build_timelords(dict(CHART, method=method, yearType='hellenistic'))['yearType'] == 'solar'


POLAR = dict(CHART, lat='70n00', gpsLat=70.0, hsys=1)
POLAR_NIGHT = dict(CHART, date='1975/12/21', lat='78n00', gpsLat=78.0, hsys=1)


def test_every_method_answers_inside_the_polar_circle():
    for chart in (POLAR, POLAR_NIGHT):
        for method in T.METHODS:
            assert T.build_timelords(dict(chart, method=method, nineTime='ascension'))['rows'], method


def test_nine_parts_fall_back_to_degrees_inside_the_polar_circle():
    res = T.build_timelords(dict(POLAR, method='nineparts', nineTime='ascension'))
    assert res['polar'] is True and res['time'] == 'degree'
    assert max(r['endAge'] - r['startAge'] for r in res['rows']) < 1.2
    assert T.build_timelords(dict(CHART, method='nineparts', nineTime='ascension'))['polar'] is False


def test_hour_lord_is_only_worked_out_for_the_methods_that_read_it():
    assert T.build_timelords(dict(CHART, method='lifetime'))['hourLord'] is None
    assert T.build_timelords(dict(CHART, method='orb'))['hourLord'] in T.SEVEN


def test_releaser_points_start_from_the_next_planet():
    for name in T.RELEASER_POINTS:
        res = T.build_timelords(dict(CHART, method='quarters', releaser=name))
        assert res['releaser'] == name and res['startLord'] in T.SEVEN
        assert res['rows'][0]['lord'] == res['startLord']
    assert T.first_planet_after(5.0, LONS) == 'Sun'
    assert T.first_planet_after(350.0, LONS) == 'Sun'
    assert T.first_planet_after(281.0, LONS) == 'Moon'


def test_moving_point_can_start_at_the_prenatal_syzygy():
    res = T.build_timelords(dict(CHART, method='moving', movingStart='Syzygy'))
    assert res['startPoint'] == 'Syzygy'
    start = T.prenatal_syzygy_lon(CHART)
    row = res['rows'][0]
    assert abs((start + row['age'] * 30.0 - row['at'] + 180.0) % 360.0 - 180.0) < 1e-6


def test_diurnal_modes_differ_and_unknown_mode_falls_back():
    ages = {m: T.build_timelords(dict(CHART, method='diurnal', diurnalMode=m))['rows'][0]['age'] for m in ('five', 'seven', 'quadrant')}
    assert len(set(ages.values())) == 3
    assert T.build_timelords(dict(CHART, method='diurnal', diurnalMode='x'))['mode'] == 'five'


def _frame(chart):
    return D._natal_from_request(chart)


PLACIDUS = dict(CHART, hsys=3)
DAY_CHART = dict(PLACIDUS, time='12:00:00')


def _rows(**options):
    return json.dumps(T.build_timelords(dict(PLACIDUS, **options))['rows'], sort_keys=True, default=str)


def _ages(**options):
    return [r['age'] for r in T.build_timelords(dict(PLACIDUS, **options))['rows']]


@pytest.mark.parametrize('method,key,one,other', [
    ('turn', 'turnOrder', 'zodiac', 'chaldean'),
    ('turn', 'turnOrder', 'astronomical', 'house'),
    ('turn', 'turnStart', 'asc', 'hour'),
    ('turn', 'yearType', 'solar', 'hellenistic'),
    ('orb', 'orbMode', 'single', 'cycle'),
    ('annual', 'annualDays', 'tableA', 'tableB'),
    ('annual', 'annualOrder', 'natal', 'return'),
    ('quarters', 'releaser', 'Moon', 'Sun'),
    ('quarters', 'releaser', 'Moon', 'Pars Fortuna'),
    ('quarters', 'yearType', 'solar', 'hellenistic'),
    ('monomoiria', 'yearType', 'solar', 'hellenistic'),
    ('moonnine', 'variant', 'improved', 'classic'),
    ('moonnine', 'yearType', 'solar', 'hellenistic'),
    ('nineparts', 'nineTime', 'degree', 'ascension'),
    ('nineparts', 'nineReverse', 0, 1),
    ('nineparts', 'variant', 'improved', 'classic'),
    ('nineparts', 'yearType', 'solar', 'hellenistic'),
    ('moving', 'rateKind', 'condition', 'quadrant28'),
    ('moving', 'rateKind', 'condition', 'age72'),
    ('moving', 'movingStart', 'Asc', 'MC'),
    ('moving', 'movingStart', 'Asc', 'Sun'),
    ('moving', 'movingStart', 'Asc', 'Syzygy'),
    ('moving', 'yearType', 'sidereal', 'solar'),
    ('devages', 'devBasis', 'sign', 'house'),
    ('devages', 'yearType', 'solar', 'hellenistic'),
    ('diurnal', 'diurnalMode', 'five', 'seven'),
    ('diurnal', 'diurnalMode', 'five', 'quadrant'),
    ('diurnal', 'variant', 'improved', 'classic'),
    ('diurnal', 'yearType', 'solar', 'hellenistic'),
])
def test_every_option_changes_the_table(method, key, one, other):
    assert _rows(method=method, **{key: one}) != _rows(method=method, **{key: other})


def test_variant_also_reaches_the_house_based_developmental_ages():
    assert _rows(method='devages', devBasis='house', variant='classic') != _rows(method='devages', devBasis='house', variant='improved')


def test_quadrant_option_reaches_the_quadrant_formula():
    res = T.build_timelords(dict(PLACIDUS, method='diurnal', diurnalMode='quadrant', variant='classic'))
    asc = _frame(PLACIDUS)['points']['Asc']['lon']
    rows = [r for r in res['rows'] if r['point'] == 'Asc']
    assert len(rows) == 1 and rows[0]['age'] > 61.0
    assert abs(rows[0]['at'] - asc) < 1e-9


def test_rate_kind_is_the_rate_in_the_ages():
    start = _frame(PLACIDUS)['points']['Asc']['lon']
    for kind, rate in T.MOVING_RATES.items():
        res = T.build_timelords(dict(PLACIDUS, method='moving', rateKind=kind))
        row = res['rows'][5]
        assert abs((start + row['age'] * rate - row['at'] + 180.0) % 360.0 - 180.0) < 1e-6


def test_moving_start_is_where_the_point_leaves_from():
    frame = _frame(PLACIDUS)
    for name in ('MC', 'Sun', 'Saturn'):
        row = T.build_timelords(dict(PLACIDUS, method='moving', movingStart=name))['rows'][3]
        start = frame['points'][name]['lon']
        assert abs((start + row['age'] * 30.0 - row['at'] + 180.0) % 360.0 - 180.0) < 1e-6


def test_event_current_index_follows_the_target_date():
    early = T.build_timelords(dict(PLACIDUS, method='moving', targetDate='1980/01/01'))
    late = T.build_timelords(dict(PLACIDUS, method='moving', targetDate='2030/01/01'))
    assert 0 < early['currentIndex'] < late['currentIndex']
    rows = late['rows']
    i = late['currentIndex']
    age = (late['targetJd'] - _frame(PLACIDUS)['jd']) / T.YEAR_DAYS['sidereal']
    assert rows[i - 1]['age'] < age <= rows[i]['age']


def test_past_end_is_reported_on_the_table_year_length():
    inside = T.build_timelords(dict(PLACIDUS, method='turn', yearType='hellenistic', targetDate='2070/01/01'))
    assert inside['currentIndex'] >= 0 and inside['pastEnd'] is False
    after = T.build_timelords(dict(PLACIDUS, method='turn', yearType='hellenistic', targetDate='2074/03/01'))
    assert after['currentIndex'] == -1 and after['pastEnd'] is True
    before = T.build_timelords(dict(PLACIDUS, method='turn', targetDate='1970/01/01'))
    assert before['currentIndex'] == -1 and before['pastEnd'] is False


def test_child_lengths_fill_or_truncate_their_parent():
    quarters = T.build_timelords(dict(PLACIDUS, method='quarters', yearType='hellenistic'))['rows'][0]
    assert abs(sum(c['days'] for c in quarters['children']) - quarters['days']) < 1e-6
    assert [c['lord'] for c in quarters['children']][0] == quarters['lord']
    first = quarters['children'][0]
    assert abs(first['days'] - quarters['days'] * T.LESSER_YEARS[first['lord']] / 129.0) < 1e-9
    nine = T.build_timelords(dict(PLACIDUS, method='moonnine', yearType='hellenistic'))['rows'][1]
    assert [round(c['days'], 6) for c in nine['children']] == [360.0] * 9
    mono = T.build_timelords(dict(PLACIDUS, method='monomoiria', yearType='hellenistic'))['rows'][0]
    assert abs(sum(c['days'] for c in mono['children']) - mono['days']) < 1e-6
    assert all(c['days'] <= T.CHALDEAN_RANK[c['lord']] * 30.0 + 1e-9 for c in mono['children'])


def test_monomoiria_children_shift_one_place_after_each_round():
    row = T.build_timelords(dict(PLACIDUS, method='monomoiria', yearType='hellenistic'))['rows'][0]
    lons = {name: _frame(PLACIDUS)['points'][name]['lon'] for name in T.SEVEN}
    order = T.zodiac_ring(row['lord'], lons)
    lords = [c['lord'] for c in row['children']]
    assert lords[:7] == order
    assert lords[7:14] == (order[1:] + order[:1])[:len(lords[7:14])]


def test_quarters_scale_with_the_year_length():
    solar = T.build_timelords(dict(PLACIDUS, method='quarters', yearType='solar'))['rows'][1]
    flat = T.build_timelords(dict(PLACIDUS, method='quarters', yearType='hellenistic'))['rows'][1]
    assert solar['startAge'] == flat['startAge'] and solar['start'] != flat['start']


def test_prenatal_ages_are_dated_before_birth():
    res = T.build_timelords(dict(PLACIDUS, method='lifetime'))
    early = [r for r in res['rows'] if r['age'] < 0]
    assert early and all(r['date'] < res['birth'] for r in early)
    assert all(r['date'] > res['birth'] for r in res['rows'] if r['age'] > 0.01)


def test_sign_heads_are_listed():
    for method in ('diurnal', 'lifetime'):
        rows = T.build_timelords(dict(PLACIDUS, method=method))['rows']
        assert {'sign:%d' % i for i in range(12)} <= {r['point'] for r in rows}


def test_fortune_follows_the_chart_and_flips_at_night():
    for chart, day in ((DAY_CHART, True), (PLACIDUS, False)):
        points = _frame(chart)['points']
        asc, sun, moon = points['Asc']['lon'], points['Sun']['lon'], points['Moon']['lon']
        want = (asc + moon - sun) % 360.0 if day else (asc + sun - moon) % 360.0
        frame = _frame(chart)
        assert abs(T._fortune(frame) - want) < 1e-6
        assert abs((T._spirit(frame) + T._fortune(frame) - 2.0 * asc + 180.0) % 360.0 - 180.0) < 1e-6
    reversed_off = D._natal_from_request(dict(PLACIDUS, lotReversal=0))
    points = reversed_off['points']
    assert abs(T._fortune(reversed_off) - (points['Asc']['lon'] + points['Moon']['lon'] - points['Sun']['lon']) % 360.0) < 1e-6


def test_ascension_time_uses_the_oblique_ascension():
    frame = _frame(PLACIDUS)
    rows = T.build_timelords(dict(PLACIDUS, method='nineparts', nineTime='ascension', maxAge=10))['rows']
    asc = frame['points']['Asc']['lon']
    end = (T.nine_cell(asc) + 1) * T.NINE_STEP
    want = (T._oblique_ascension(end, frame['phi'], frame['epsTrue']) - T._oblique_ascension(asc, frame['phi'], frame['epsTrue'])) % 360.0
    assert abs(rows[0]['endAge'] - want) < 1e-9
    assert abs(rows[0]['endAge'] - (end - asc)) > 1e-3


def test_moon_days_reach_the_listed_arcs_from_the_natal_moon():
    res = T.build_timelords(dict(PLACIDUS, method='moondays'))
    frame = _frame(PLACIDUS)
    natal = frame['points']['Moon']['lon']
    assert [(r['day'], r['arc']) for r in res['rows']] == [(3, 30.0), (7, 90.0), (40, 180.0)]
    for row in res['rows']:
        moon = swisseph.calc_ut(frame['jd'] + row['afterDays'], swisseph.MOON, swisseph.FLG_SWIEPH)[0][0]
        assert abs((moon - natal - row['arc'] + 180.0) % 360.0 - 180.0) < 1e-6


def test_every_method_answers():
    for method in T.METHODS:
        res = T.build_timelords(dict(CHART, method=method, maxAge=30))
        assert res['technique'] == 'timelords' and res['method'] == method
        assert res['rows'], method
        assert res['kind'] in ('periods', 'events')


def test_unknown_method_falls_back():
    assert T.build_timelords(dict(CHART, method='nope'))['method'] == 'turn'


def test_bad_numbers_do_not_break_the_table():
    res = T.build_timelords(dict(CHART, method='turn', maxAge='inf'))
    assert len(res['rows']) == 100


def test_moon_day_forty_takes_the_arrival_nearest_the_fortieth_day():
    improved = T.build_timelords(dict(PLACIDUS, method='moondays'))['rows']
    classic = T.build_timelords(dict(PLACIDUS, method='moondays', variant='classic'))['rows']
    assert 38.0 < improved[2]['afterDays'] < 43.0          # 第二次到冲
    assert 12.0 < classic[2]['afterDays'] < 16.0           # 第一次到冲
    assert [r['afterDays'] for r in improved[:2]] == [r['afterDays'] for r in classic[:2]]


def test_lifetime_keeps_the_midheaven_and_lists_each_position_once():
    for hsys in (0, 3):
        rows = T.build_timelords(dict(PLACIDUS, method='lifetime', hsys=hsys))['rows']
        assert any(r['point'] == 'MC' for r in rows)
        keys = [(round(r['at'], 6) % 360.0, round(r['age'], 6)) for r in rows if r['point'].startswith(('House', 'sign:'))]
        assert len(keys) == len(set(keys))


def test_navamsa_lord_moves_on_at_twenty_degrees():
    assert T.navamsa_lord(20.0) != T.navamsa_lord(19.99)
    assert T.navamsa_lord(20.0) == T.navamsa_lord(20.5)


def test_nodes_follow_the_chart_node_setting():
    import swisseph as _swe
    mean = T.build_timelords(dict(PLACIDUS, method='moving', movingStart='North Node'))
    true = T.build_timelords(dict(PLACIDUS, method='moving', movingStart='North Node', westNodeType='true'))
    frame = _frame(PLACIDUS)
    mean_lon = _swe.calc_ut(frame['jd'], _swe.MEAN_NODE)[0][0]
    true_lon = _swe.calc_ut(frame['jd'], _swe.TRUE_NODE)[0][0]
    assert abs(((mean_lon - true_lon + 180) % 360) - 180) > 0.05
    assert mean['rows'] != true['rows']
