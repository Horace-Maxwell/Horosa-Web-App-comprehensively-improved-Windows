# -*- coding: utf-8 -*-
"""世俗周期表:手算值与固定样本。"""
import json
import os

import pytest

from astrostudy import chart_details as C
from astrostudy import directed_figures as D
from astrostudy import mundane_cycles as M
from win_float_golden import golden_equal   # horosa_win_float_golden_v1

CHART = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'hsys': 3, 'targetDate': '2000/06/15'}


def test_great_conjunctions_of_the_last_century():
    rows = M.conjunction_rows('great', 1960, 2030)
    dates = [row['date'][:7] for row in rows]
    assert dates == ['1961-02', '1980-12', '1981-03', '1981-07', '2000-05', '2020-12']
    assert [row['repeat'] for row in rows] == [False, False, True, True, False, False]
    assert rows[1]['sign'] == 6 and rows[-1]['sign'] == 10


def test_classic_keeps_the_first_of_a_triple_conjunction():
    rows = M.conjunction_rows('great', 1960, 2030, classic=True)
    assert [row['date'][:7] for row in rows] == ['1961-02', '1980-12', '2000-05', '2020-12']


def test_element_change_is_flagged():
    rows = M.conjunction_rows('great', 1960, 2030, classic=True)
    assert [row['shift'] for row in rows] == [False, True, True, True]


def test_middle_and_lesser_use_their_own_pairs():
    assert M.conjunction_rows('middle', 2000, 2005) != M.conjunction_rows('lesser', 2000, 2005)
    assert len(M.conjunction_rows('lesser', 2000, 2010)) >= 4


def test_mean_conjunction_fixed_samples():
    rows = {row['id']: row for row in M.mean_conjunction_rows('table1', 114, 400)}
    assert rows[163]['date'].startswith('0114-06') and abs(rows[163]['lon'] - 22.0795) < 1e-3
    rows = M.mean_conjunction_rows('table1', 1000, 1100)
    assert all(b['id'] == a['id'] + 1 for a, b in zip(rows, rows[1:]))
    assert M.MEAN_TABLES['table1'][1] == 7252.5163 and M.MEAN_TABLES['table7'][0] == 791292.78


def test_mean_tables_differ():
    assert M.mean_conjunction_rows('table1', 1000, 1100) != M.mean_conjunction_rows('table7', 1000, 1100)


def test_turns_walk_cancer_and_the_chaldean_order():
    rows = M.turn_rows('a', M.SIDEREAL_YEAR, -2000)
    assert [(row['sign'], row['lord']) for row in rows[:3]] == [(3, 'Saturn'), (4, 'Jupiter'), (5, 'Mars')]
    assert rows[0]['date'].startswith('-3381-09-23')
    assert M.turn_rows('b', M.SIDEREAL_YEAR, -2000)[0]['date'].startswith('-3102-02-18')


def test_big_firdaria_years_run_from_eleven_down():
    steps = M.big_firdaria_steps(90)
    assert [step['years'] for step in steps[:13]] == [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 12, 11]
    assert [step['sign'] for step in steps[:3]] == [0, 1, 2]


def test_middle_firdaria_is_seventy_five_years_each():
    rows = M.mighty_firdaria_rows('middle', 2451545.0, 365.25, 200)
    assert [row['lord'] for row in rows[:3]] == ['Sun', 'Moon', 'North Node']
    assert all(row['years'] == 75 for row in rows)


def test_lesser_firdaria_standard_and_classic_sum_to_seventy_five():
    assert sum(M.FIRDARIA_YEARS.values()) == 75 and sum(M.LESSER_CLASSIC.values()) == 75
    plain = M.mighty_firdaria_rows('lesser', 2451545.0, 365.25, 75)
    classic = M.mighty_firdaria_rows('lesser', 2451545.0, 365.25, 75, classic=True)
    assert plain[0]['years'] == 10 and classic[0]['years'] == 9


def test_profection_first_row_is_one_step_after_the_anchor():
    result = M.mundane_profection_rows('annual', 'ingress', M.civil_julday(2000, 6, 15, 0.0), 40.0, 0.0)
    assert result['anchor'].startswith('2000-03-20')
    assert result['rows'][0]['date'].startswith('2001-03') and result['rows'][0]['sign'] == 1
    assert len(result['rows']) == M.PROFECTION_ROWS


def test_profection_classic_anchor_skips_ahead():
    jd = M.civil_julday(2000, 1, 1, 0.0)
    assert M.mundane_profection_rows('great', 'greatSign', jd, 40.0, 0.0, classic=True)['anchor'].startswith('2020-12')
    assert M.mundane_profection_rows('great', 'greatSign', jd, 40.0, 0.0)['anchor'].startswith('1980-12')


def test_profection_great_sign_walks_from_the_conjunction_degree():
    jd = M.civil_julday(2000, 1, 1, 0.0)
    classic = M.mundane_profection_rows('annual', 'greatSign', jd, 40.0, 0.0, classic=True)['rows'][0]
    assert classic['date'].startswith('2021-12-16') and classic['sign'] == 10
    plain = M.mundane_profection_rows('annual', 'greatSign', M.civil_julday(2022, 1, 1, 0.0), 40.0, 0.0)['rows'][0]
    assert plain['date'].startswith('2021-12-16') and plain['sign'] == 11


def test_profection_classic_anchors_from_three_target_dates():
    cases = (((1900, 1, 1), 'changeSign', '1981-09-07', 6), ((2000, 1, 1), 'changeSign', '2160-09-14', 7), ((2100, 6, 15), 'changeSign', '2160-09-14', 7),
             ((1900, 1, 1), 'changeAsc', '1982-01-01', 6), ((2000, 1, 1), 'greatAsc', '2021-12-22', 10), ((1900, 1, 1), 'greatSign', '1902-06-11', 9),
             ((2100, 6, 15), 'greatSign', '2120-01-16', 2), ((1900, 1, 1), 'ingress', '1902-03-21', 0))
    for day, base, date, sign in cases:
        row = M.mundane_profection_rows('annual', base, M.civil_julday(*day, 0.0), 47.6, -122.33, classic=True)['rows'][0]
        assert row['date'].startswith(date) and row['sign'] == sign, (day, base)


def test_profection_ascendant_follows_the_place_unless_classic():
    jd = M.civil_julday(2000, 1, 1, 0.0)
    near = M.mundane_profection_rows('annual', 'greatAsc', jd, 40.0, 0.0)['rows'][0]['sign']
    far = [M.mundane_profection_rows('annual', 'greatAsc', jd, 40.0, lon)['rows'][0]['sign'] for lon in (60.0, 120.0, 180.0)]
    assert any(sign != near for sign in far)
    assert len({M.mundane_profection_rows('annual', 'greatAsc', jd, 40.0, lon, classic=True)['rows'][0]['sign'] for lon in (0.0, 120.0)}) == 1


def test_profection_midheaven_ignores_classic():
    jd = M.civil_julday(2000, 1, 1, 0.0)
    assert M.mundane_profection_rows('annual', 'greatMc', jd, 40.0, 0.0) == M.mundane_profection_rows('annual', 'greatMc', jd, 40.0, 0.0, classic=True)


def test_rate_reaches_the_step():
    jd = M.civil_julday(2000, 1, 1, 0.0)
    rows = M.mundane_profection_rows('great', 'ingress', jd, 40.0, 0.0)['rows']
    first = M.mundane_profection_rows('monarchy', 'ingress', jd, 40.0, 0.0)['rows']
    assert rows[0]['date'][:4] == '2079' and first[0]['date'][:4] == '2004'


def test_thousands_row_fixed_sample():
    row = M.thousands_row(1701)
    assert (row['floodYear'], row['thousandLord'], row['turnLord'], row['quarterLord'], row['quarterYear']) == (5093, 'Mars', 'Saturn', 'Mars', 53)
    assert abs(row['division'] - 31.3) < 1e-9 and row['turn'] == 150.0


def test_world_year_row_fixed_sample():
    row = M.world_year_row(1701)
    assert (row['worldYear'], row['firdariaLord'], row['firdariaMiddle'], row['firdariaLesser'], row['governor'], row['governorNine'], row['quarterLord'], row['greatYear']) \
        == (184802, 'Mars', 'Mars', 'Mars', 'Mars', 'Venus', 'Sun', 1202)
    for key, value in (('dirMillennium', 184.802), ('dirCentury', 48.02), ('dirDecade', 120.2), ('dirYear', 122.0), ('profMillennium', 144.06), ('profCentury', 0.6), ('profDecade', 6.0),
                       ('profYear', 60.0), ('firdariaLon', 280.1666667), ('firdariaBig', 51.8181818), ('trepidation', 7.45)):
        assert abs(row[key] - value) < 1e-5, key


def test_big_progress_runs_twelve_down_to_one():
    assert M._big_progress(1759, 1759) == 0.0
    assert M._big_progress(1771, 1759) == 30.0
    assert M._big_progress(1782, 1759) == 60.0
    assert M._big_progress(1759 + 78, 1759) == 0.0


def test_dawr_row():
    row = M.dawr_row(1648, M.DAWR_STARTS['a'])
    assert (row['sign'], row['lord'], row['quarterLord']) == (6, 'Mercury', 'Mars')
    assert abs(row['lon'] - 317.3333333) < 1e-6
    assert M.dawr_row(1739, M.DAWR_STARTS['a'])['quarterLord'] == 'Sun'
    assert abs(M.dawr_row(1660, M.DAWR_STARTS['b'])['lon'] - 318.3333333) < 1e-6


def test_dawr_degree_does_not_reset_at_the_cycle_boundary():
    a, b = M.dawr_row(2007, M.DAWR_STARTS['a']), M.dawr_row(2008, M.DAWR_STARTS['a'])
    assert abs(b['lon'] - a['lon'] - 1.0 / 12.0) < 1e-9
    assert abs(M.dawr_row(2026, M.DAWR_STARTS['a'])['lon'] - (2026 + 2160) / 12.0 % 360.0) < 1e-9


def test_era_row_from_the_year_two_thousand():
    assert M.era_row('hijra', 2001) == {'year': 2001, 'asc': 0.0, 'turn': 120.0, 'conj': 270.0, 'flood': 343.0}
    assert M.era_row('change', 2000)['asc'] == 0.0


def test_mundane_parts():
    view = C.ChartView(D._natal_from_request(CHART), 'chaldean')
    rows = M.mundane_parts(view)
    assert all(row['formula'] for row in rows)
    parts = {row['id']: row['lon'] for row in rows}
    lons = view.lons
    table = {1: lons['Sun'] + lons['Moon'] - lons['Venus'], 3: lons['Sun'] + lons['Moon'] - lons['Saturn'], 4: lons['Moon'] + view.asc - lons['Mars'], 5: lons['Sun'] + lons['Jupiter'] - view.mc,
             6: lons['Sun'] + view.asc - lons['Saturn'], 7: lons['Sun'] + view.asc - 135.0, 8: lons['Moon'] + view.asc - 105.0, 9: lons['Jupiter'] + view.asc - lons['Saturn'],
             10: lons['Jupiter'] + view.asc - view.mc, 11: lons['Sun'] + 180.0, 12: lons['Sun'] + lons['Mars'] - lons['Moon'], 13: view.spirit + view.asc - lons['Jupiter'],
             14: lons['Saturn'] + lons['Jupiter'] - lons['Sun']}
    for key, value in table.items():
        assert abs(parts[key] - value % 360.0) < 1e-9, key
    k = M.MERCURY_TERM[C.sign_of(lons['Mercury'])]
    assert k == 6 and abs(parts[2] - (lons['Mercury'] + view.asc - k) % 360.0) < 1e-9


def test_revolution_lists_the_five_planets():
    result = M.revolution_rows(2020, 0.0)
    assert result['date'].startswith('2020-03-20')
    rows = {row['planet']: row for row in result['rows']}
    assert list(rows) == list(C.PHASE_PLANETS)
    assert rows['Jupiter']['relation'] == 'morning' and rows['Venus']['relation'] == 'evening'
    assert rows['Jupiter']['north'] is False and rows['Mars']['north'] is False and rows['Venus']['north'] is True
    assert rows['Mercury']['retrograde'] is False


def test_bce_years_stay_on_the_historical_calendar():
    assert M.revolution_rows(-300, 0.0)['date'].startswith('-0300-')
    assert M.conjunction_rows('great', -1000, -990)[0]['date'].startswith('-099')
    assert M._year_of(M.civil_julday_display(-300, 6, 1, 0.0)) == -300


def test_a_window_edge_keeps_the_triple_and_element_flags():
    rows = M.conjunction_rows('great', 1981, 2030)
    assert rows[0]['date'].startswith('1981-03') and rows[0]['repeat'] is True
    assert M.conjunction_rows('great', 1980, 2000)[0]['shift'] is True


def test_middle_triple_gap():
    assert M.TRIPLE_GAP['middle'] > 121.1


def test_revolution_point_changes_the_moment():
    assert M.revolution_rows(2020, 90.0)['date'].startswith('2020-06-20')


@pytest.mark.parametrize('table', M.TABLES)
def test_every_table_answers(table):
    result = M.build_mundane_cycles(dict(CHART, table=table))
    assert result['table'] == table and result['rows']


def test_unknown_table_and_options_fall_back():
    assert M.build_mundane_cycles(dict(CHART, table='nope'))['table'] == M.TABLES[0]
    assert M.build_mundane_cycles(dict(CHART, table='conjunctions', conjKind='x'))['kind'] == 'great'
    assert M.build_mundane_cycles(dict(CHART, table='profections', profRate='x'))['rate'] == 'great'


def test_missing_target_date_does_not_raise():
    assert M.build_mundane_cycles({'table': 'thousands'})['rows']


def test_year_inputs_reach_the_tables():
    assert M.build_mundane_cycles(dict(CHART, table='thousands', startYear=1701))['rows'][0]['year'] == 1701
    assert M.build_mundane_cycles(dict(CHART, table='revolution', startYear=2020))['date'].startswith('2020-03')
    assert M.build_mundane_cycles(dict(CHART, table='revolution', startYear=2020, ingressPoint=180))['date'].startswith('2020-09')


def test_only_great_conjunctions_have_a_classic_list():
    base = dict(CHART, table='conjunctions', conjKind='middle', startYear=1800, endYear=1900)
    assert M.build_mundane_cycles(base)['rows'] == M.build_mundane_cycles(dict(base, variant='classic'))['rows']


def test_options_reach_the_tables():
    base = dict(CHART, table='firdaria', firdariaLevel='lesser')
    assert M.build_mundane_cycles(base)['rows'] != M.build_mundane_cycles(dict(base, variant='classic'))['rows']
    assert M.build_mundane_cycles(base)['rows'] != M.build_mundane_cycles(dict(base, cycleYear='solar'))['rows']
    era = dict(CHART, table='era')
    assert M.build_mundane_cycles(era)['rows'] != M.build_mundane_cycles(dict(era, eraKind='change'))['rows']
    dawr = dict(CHART, table='dawr')
    assert M.build_mundane_cycles(dawr)['rows'] != M.build_mundane_cycles(dict(dawr, dawrStart='b'))['rows']
    span = dict(CHART, table='conjunctions')
    assert M.build_mundane_cycles(dict(span, startYear=1900, endYear=1950))['rows'] != M.build_mundane_cycles(span)['rows']


def test_range_is_capped():
    assert M._year_range({'startYear': 0, 'endYear': 9000}, 2000)[1] == M.MAX_RANGE_YEARS
    assert M._year_range({'startYear': 2100, 'endYear': 2000}, 2000) == (2000, 2100)


GOLDEN_PATH = os.path.join(os.path.dirname(__file__), 'data', 'golden_mundane_cycles.json')


def golden_cases():
    cases = {}
    for year in (-500, 1701, 1849, 1925, 2000, 2026, 2400):
        cases['world%d' % year] = M.world_year_row(year)
        cases['thousand%d' % year] = M.thousands_row(year)
    for start in M.DAWR_STARTS:
        cases['dawr' + start] = M.dawr_row(1800, M.DAWR_STARTS[start])
    for kind in M.ERA_BASE:
        cases['era' + kind] = M.era_row(kind, 2026)
    for flood in M.FLOODS:
        cases['turn' + flood] = M.turn_rows(flood, M.SIDEREAL_YEAR, 0)
    jd = M.civil_julday(2026, 1, 1, 0.0)
    for rate in M.PROFECTION_YEARS:
        cases['rate' + rate] = M.mundane_profection_rows(rate, 'greatSign', jd, 47.6, -122.33)['rows'][:2]
    for base in ('changeAsc', 'changeMc', 'changeSign', 'greatAsc', 'greatMc', 'greatSign', 'ingress'):
        cases['base' + base] = M.mundane_profection_rows('annual', base, jd, 47.6, -122.33)
        cases['classic' + base] = M.mundane_profection_rows('annual', base, jd, 47.6, -122.33, classic=True)
    return cases


def test_golden_samples():
    with open(GOLDEN_PATH, encoding='utf-8') as handle:
        # horosa_win_float_golden_v1(Windows 侧移植适配):金标是在另一套数学库上录的,本机浮点末位与并列行次序不同;
        # 按 win_float_golden 的口径比(浮点差 1e-4 以内,整数、文字、布尔、键集合、行数仍须相等)。
        assert golden_equal(json.loads(json.dumps(golden_cases())), json.load(handle))


ARIES_2025 = {'date': '2025/03/20', 'time': '09:01:00', 'zone': '+00:00', 'lat': '51n30', 'lon': '0w07', 'hsys': 3}


def test_lunation_family_spans_metonic_cycles():
    rows = M.build_mundane_cycles(dict(ARIES_2025, table='lunations', targetDate='2026/01/01'))['rows']
    assert [row['relative'] for row in rows] == [-2, -1, 0, 1, 2]
    assert rows[2]['new'].startswith('2025-12-20')
    for row in rows[1:]:
        assert 6939.2 < row["gap"] < 6940.1                 # 235 个朔望月(实测 6939.30–6940.04)
    for row in rows:
        assert row['new'] < row['firstQuarter'] < row['full'] < row['lastQuarter']
    assert max(abs(M.fold180(a['sunLon'] - b['sunLon'])) for a, b in zip(rows, rows[1:])) < 2.0


def test_lunation_phase_times_are_exact():
    jd = M._phase_time(90.0, 2461000.0)
    moon = M._lon('Moon', jd)
    sun = M._lon('Sun', jd)
    assert abs(M.fold180(moon - sun - 90.0)) < 1e-6


def test_mundane_directions_one_degree_a_day():
    res = M.build_mundane_cycles(dict(ARIES_2025, table='directions'))
    rows = res['rows']
    assert res['mpdKey'] == 'Ptolemy' and rows
    assert all(abs(row['days'] - row['arc']) < 1e-12 for row in rows)
    assert rows == sorted(rows, key=lambda row: row['days'])
    # 一度一日推满一年;弧过 360° 是同一条方向转回原处,不再列第二次
    assert rows[-1]['days'] <= 360.0 and rows[-1]['days'] > 350.0 and all(row['arc'] < 360.0 for row in rows)
    naibod = M.build_mundane_cycles(dict(ARIES_2025, table='directions', mpdKey='Naibod'))['rows']
    assert naibod[0]['days'] == pytest.approx(naibod[0]['arc'] / 0.9856473354)


def test_mundane_directions_unknown_key_falls_back():
    assert M.build_mundane_cycles(dict(ARIES_2025, table='directions', mpdKey='nope'))['mpdKey'] == 'Ptolemy'
