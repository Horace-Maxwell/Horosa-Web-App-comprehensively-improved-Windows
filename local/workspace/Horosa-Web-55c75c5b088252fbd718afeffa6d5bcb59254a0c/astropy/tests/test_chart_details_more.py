# -*- coding: utf-8 -*-
"""盘面细节续表:月亮日、成相表、世俗相位、宫头相位、恒星相位、行星细节、AstroDynes、部分相位、度数性质、中点、统计。

期望值取自西雅图盘(1975-02-10 21:15 −08:00)手算或独立星历核对过的结果。
"""
import math

import pytest

from astrostudy import chart_details as C
from astrostudy import chart_details_more as M
from astrostudy.directed_figures import _natal_from_request

SEATTLE = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'gpsLat': 47.6, 'gpsLon': -122.333, 'hsys': 3}
POLAR_NIGHT = dict(SEATTLE, date='1975/12/21', lat='78n00', gpsLat=78.0)


@pytest.fixture(scope='module')
def seattle():
    frame = _natal_from_request(SEATTLE)
    return frame, C.ChartView(frame, 'chaldean')


def minutes(a, b):
    """两个 'YYYY-MM-DD HH:MM:SS' 相差的分钟数。"""
    from datetime import datetime
    fmt = '%Y-%m-%d %H:%M:%S'
    return abs((datetime.strptime(a, fmt) - datetime.strptime(b, fmt)).total_seconds()) / 60.0


# ---------------------------------------------------------------- 月亮日
def test_new_moon_bracket(seattle):
    frame, _ = seattle
    prev_nm, next_nm = M.new_moon_near(frame['jd'])
    assert prev_nm <= frame['jd'] < next_nm
    assert 29.2 < next_nm - prev_nm < 29.9
    for t in (prev_nm, next_nm):
        assert abs(M.fold180(M._elong(t))) < 1e-6


@pytest.mark.parametrize('method, day2', [('traditional', '1975-01-12 07:48:00'), ('tithi', '1975-01-13 04:25:16'), ('equal', '1975-01-13 02:33:45')])
def test_lunar_day_methods(seattle, method, day2):
    frame, _ = seattle
    table = M.lunar_days(frame, method)
    rows = table['rows']
    assert rows[0]['start'].startswith('1975-01-12 02:19')         # 出生前一次朔
    assert minutes(rows[1]['start'], day2) < 1.5
    assert sum(1 for row in rows if row['current']) == 1
    assert rows[-1]['current']                                     # 出生在朔前两分钟,落在最后一日
    for a, b in zip(rows, rows[1:]):
        assert a['end'] == b['start']


def test_tithi_is_twelve_degrees(seattle):
    frame, _ = seattle
    prev_nm, next_nm = M.new_moon_near(frame['jd'])
    bounds = M.lunar_day_bounds('tithi', prev_nm, next_nm, None)
    assert len(bounds) == 31
    for k, t in enumerate(bounds[1:-1], start=1):
        assert abs(M._elong(t) - 12.0 * k) < 1e-5


def test_equal_days_split_the_month(seattle):
    frame, _ = seattle
    prev_nm, next_nm = M.new_moon_near(frame['jd'])
    bounds = M.lunar_day_bounds('equal', prev_nm, next_nm, None)
    spans = [b - a for a, b in zip(bounds, bounds[1:])]
    assert all(abs(x - spans[0]) < 1e-9 for x in spans[:-1])
    assert abs(spans[-1] - spans[0] / 2.0) < 1e-9                  # 末日是半日


def test_angle_days_step_illumination(seattle):
    frame, _ = seattle
    prev_nm, next_nm = M.new_moon_near(frame['jd'])
    bounds = M.lunar_day_bounds('angle', prev_nm, next_nm, None)
    assert len(bounds) == 31
    lit = [(1.0 - math.cos(math.radians(M._elong(t)))) / 2.0 for t in bounds[1:-1]]
    expected = [k / 15.0 for k in range(1, 16)] + [(15 - k) / 15.0 for k in range(1, 15)]
    assert max(abs(a - b) for a, b in zip(lit, expected)) < 1e-6


def test_centered_windows(seattle):
    frame, _ = seattle
    rows = M.lunar_days(frame, 'centered')['rows']
    assert len(rows) == 30
    assert rows[0]['phase'] == '朔' and rows[15]['phase'] == '望' and rows[16]['phase'] == '亏'
    assert minutes(rows[0]['start'], '1975-02-10 08:02:30') < 1.5   # 角距 354°
    assert rows[0]['current']
    bounds = M.centered_bounds(frame['jd'])
    assert abs(M._elong(bounds[0]) - 354.0) < 1e-5 and abs(M._elong(bounds[1]) - 6.0) < 1e-5
    assert abs(M._elong(bounds[-1]) - 354.0) < 1e-5 and bounds[-1] - bounds[0] > 29.0


def test_traditional_needs_moonrise():
    frame = _natal_from_request(POLAR_NIGHT)
    table = M.lunar_days(frame, 'traditional')
    assert table['note'] == 'polar' and table['rows'] == []
    assert len(M.lunar_days(frame, 'tithi')['rows']) == 30         # 其他算法不受极区影响


# ---------------------------------------------------------------- 成相表
def test_perfections_known_dates(seattle):
    frame, view = seattle
    rows = {(row['a'], row['b'], row['aspect']): row for row in M.perfections(frame, view)}
    assert minutes(rows[('Venus', 'Jupiter', 0)]['datetime'], '1975-02-17 12:22:51') < 2
    assert minutes(rows[('Mars', 'Saturn', 180)]['datetime'], '1977-02-24 06:49:00') < 2
    sun_moon = rows[('Sun', 'Moon', 0)]
    assert sun_moon['applying'] and minutes(sun_moon['datetime'], '1975-02-10 21:16:51') < 1
    # 金火六合 7 小时后就成相,不能跳到下一轮
    assert minutes(rows[('Venus', 'Mars', 60)]['datetime'], '1975-02-11 04:28:56') < 2
    # 木土三分在离相:要等过了合相的下一个三分
    jup_sat = rows[('Jupiter', 'Saturn', 120)]
    assert not jup_sat['applying'] and jup_sat['datetime'].startswith('1987-')


def test_perfection_is_exact(seattle):
    frame, view = seattle
    fixed = {'Asc': view.asc, 'MC': view.mc}
    rows = M.perfections(frame, view)
    assert rows == sorted(rows, key=lambda row: row['jd'])
    # 北交跟盘上同一个交点(缺省平交点),行里仍叫 North Node
    node = 'North Node' if abs(M.fold180(view.node - M._lon(frame['jd'], 'North Node'))) < 1e-6 else 'Mean Node'
    assert node == 'Mean Node'
    used = lambda name: node if name == 'North Node' else name
    for row in rows:
        assert M._gap_now(row['jd'], used(row['a']), used(row['b']), row['aspect'], fixed) < 1e-4
        assert row['gap'] <= M.RADII[row['a']] + M.RADII[row['b']]


# ---------------------------------------------------------------- 世俗相位
def test_mundo_proportional_positions(seattle):
    frame, view = seattle
    res = M.in_mundo(frame, view, 'proportional')
    pos = {row['point']: row['position'] for row in res['positions']}
    assert pos['Asc'] == 0.0 and pos['MC'] == 270.0
    i = M._house_index(view.lons['Sun'], view.cusps)
    width = (view.cusps[(i + 1) % 12] - view.cusps[i]) % 360.0
    assert abs(pos['Sun'] - 30.0 * (i + ((view.lons['Sun'] - view.cusps[i]) % 360.0) / width)) < 1e-9
    for row in res['aspects']:
        assert abs(M.sep(pos[row['a']], pos[row['b']]) - row['aspect']) == pytest.approx(row['orb'])
        assert row['orb'] <= M.RADII[row['a']] + M.RADII[row['b']]


@pytest.mark.parametrize('system', sorted(M.MUNDO_SYSTEMS))
def test_mundo_systems_place_cusp_points_on_cusps(seattle, system):
    frame, view = seattle
    res = M.in_mundo(frame, view, system)
    assert res['system'] == system
    assert all(0.0 <= row['position'] < 360.0 for row in res['positions'])


def test_mundo_unknown_system_falls_back(seattle):
    frame, view = seattle
    assert M.in_mundo(frame, view, 'nope')['system'] == 'proportional'


# ---------------------------------------------------------------- 宫头 / 恒星 / 行星细节
def test_cusp_aspects_orbs(seattle):
    frame, view = seattle
    rows = M.cusp_aspects(frame, view)
    asc_first = [row for row in rows if row['planet'] == 'Asc' and row['house'] == 1]
    assert asc_first and asc_first[0]['orb'] < 1e-9 and asc_first[0]['applying'] is None
    for row in rows:
        assert row['orb'] <= M.CUSP_ORBS[row['aspect']]


def test_star_aspects(seattle):
    frame, view = seattle
    rows = M.star_aspects(frame, view)
    assert ('Sun', 'Capella', 120) in {(row['planet'], row['star'], row['aspect']) for row in rows}
    assert all(row['orb'] <= M.STAR_ORB for row in rows)


def test_planet_details(seattle):
    frame, _ = seattle
    rows = {row['planet']: row for row in M.planet_details(frame)}
    assert rows['Sun']['azimuth'] == pytest.approx(294.315, abs=0.002)
    assert rows['Sun']['altitude'] == pytest.approx(-38.754, abs=0.002)
    assert rows['Moon']['speedPct'] == pytest.approx(3.58, abs=0.01)
    assert rows['Jupiter']['speedMeanPct'] == pytest.approx(165.28, abs=0.05)
    assert rows['Mars']['accelerating'] and not rows['Saturn']['accelerating']
    assert rows['Pluto']['apparentAltitude'] > rows['Pluto']['altitude']     # 折射抬高


# ---------------------------------------------------------------- AstroDynes
def test_dyne_closest_boundary():
    assert M._dyne_closest(0.0, 129.5)[0] == 120
    assert M._dyne_closest(0.0, 130.5)[0] == 135


def test_dyne_house_power_formula():
    s, a = M.DYNE_HOUSE[10]
    assert s - a * 30.0 * 0.0 == 15.0


def test_astrodynes_symmetric(seattle):
    frame, view = seattle
    res = M.astrodynes(frame, view)
    rows = {row['planet']: row for row in res['rows']}
    # 日、冥两星没有非对称取表的歧义,与独立复算一致
    assert rows['Sun']['power'] == pytest.approx(40.684, abs=0.01)
    assert rows['Pluto']['power'] == pytest.approx(68.60, abs=0.01)
    for aspect in res['aspects']:
        assert aspect['power'] > 0
    total_aspect = sum(a['power'] for a in res['aspects'] if a['a'] in rows and a['b'] in rows) * 2
    total_aspect += sum(a['power'] for a in res['aspects'] if (a['a'] in rows) != (a['b'] in rows))
    assert sum(row['aspectPower'] for row in rows.values()) == pytest.approx(total_aspect)
    assert len(res['houses']) == 12 and len(res['signs']) == 12


def test_dyne_dignity_exact_degree():
    assert M._dyne_dignity('Sun', 18.5) == 4          # 白羊旺 3 + 正 19 度再 +1
    assert M._dyne_dignity('Sun', 198.5) == -4        # 天秤落 −3 + 正落度 −1
    assert M._dyne_dignity('Uranus', 305.0) == 2


# ---------------------------------------------------------------- 部分相位 / 度数 / 中点 / 统计
def test_bindhu():
    rows = {row['point']: row for row in M.bindhu_rows(dict({n: 0.0 for n in M.BINDHU_POINTS}, Sun=321.85))}
    sun = rows['Sun']
    assert sun['sign'] == 10 and sun['degree'] == 22
    assert sun['a60'] == [0, 8] and sun['a90'] == [1, 7] and sun['a120'] == [2, 6] and sun['a180'] == [4]


def test_degree_quality_table():
    assert len(M.DEGREE_CODES) == 360
    assert M.degree_quality(5.5)['deep'] and M.degree_quality(5.5)['wells'] == 2     # 白羊 6°
    assert M.degree_quality(35.2)['lame']                                            # 金牛 6°
    assert M.degree_quality(44.0)['fortune'] == 2                                    # 金牛 15°
    assert M.degree_quality(0.0) == {'sex': 'masculine', 'lightA': 'smoky', 'lightB': 'smoky', 'wells': 0, 'fortune': 0, 'lame': False, 'deep': False}
    assert M._duodecimal(2.4) == 0 and M._duodecimal(2.6) == 1 and M._duodecimal(359.0) == 10
    assert M._novenaria(0.0) == 0 and M._novenaria(30.0) == 9 and M._novenaria(4.0) == 1


@pytest.mark.parametrize('coord', M.MIDPOINT_COORDS)
def test_midpoints(seattle, coord):
    frame, view = seattle
    res = M.midpoints(frame, view, coord)
    assert len(res['rows']) == 78
    values = M._coord_values(frame, view, coord)
    for row in res['rows']:
        a, b = values[row['a']], values[row['b']]
        if coord in ('declination', 'latitude'):
            assert row['midpoint'] == pytest.approx((a + b) / 2.0)
        else:
            assert M.sep(row['midpoint'], a) == pytest.approx(M.sep(row['midpoint'], b), abs=1e-9)
            assert M.sep(row['midpoint'], a) <= 90.0 + 1e-9


def test_stats_counts(seattle):
    frame, view = seattle
    st = M.chart_stats(frame, view)
    assert sum(len(v) for v in st['element'].values()) == 15
    assert sum(len(v) for v in st['house'].values()) == 13         # 上升、天顶不计宫
    assert set(st['dignity']) == {'ruler', 'exalt', 'detriment', 'fall'}


def test_anatomy(seattle):
    frame, view = seattle
    res = M.anatomy_rows(M.detail_points(frame, view), view.cusps)
    rows = {row['point']: row for row in res['rows']}
    assert rows['Sun']['sign'] == 10 and rows['Sun']['region'] == '小腿、踝'      # 太阳在水瓶
    assert rows['Saturn']['organs'].startswith('右耳') and rows['Asc']['organs'] == ''
    assert len(res['signs']) == 12 and res['signs'][0]['region'] == '头、面' and res['signs'][11]['region'] == '足'
    assert res['sixthCusp']['region'] == M.ANATOMY_SIGNS[int(view.cusps[5] // 30)]


@pytest.mark.parametrize('jd, a, b, angle, days', [
    (2428787.526, 'Moon', 'Sun', 60, 18.55), (2442650.23, 'Moon', 'Mars', 60, 9.03),
    (2450036.716, 'Moon', 'Jupiter', 120, 17.62), (2464623.951, 'Moon', 'Venus', 120, 20.46),
])
def test_perfection_does_not_skip_the_nearest_exact(jd, a, b, angle, days):
    t = M._perfection(jd, a, b, angle, {})
    assert t - jd == pytest.approx(days, abs=0.02)
    assert M._gap_now(t, a, b, angle, {}) < 1e-5


def test_mundo_house_pos_failure_is_skipped():
    frame = _natal_from_request(dict(SEATTLE, lat='70s00', gpsLat=-70.0))
    res = M.in_mundo(frame, C.ChartView(frame, 'chaldean'), 'koch')
    assert all(row['orb'] > 1e-9 or row['a'] in ('North Node', 'South Node') for row in res['aspects'][:3]) or not res['aspects']
    assert not any(row['position'] < 0 for row in res['positions'])


def test_mundo_angles_follow_the_house_system(seattle):
    frame, view = seattle
    pos = {row['point']: row['position'] for row in M.in_mundo(frame, view, 'horizontal')['positions']}
    assert abs(M.fold180(pos['Asc'] - 0.0)) > 0.5          # 地平制的第 1 宫头不在上升
    pos = {row['point']: row['position'] for row in M.in_mundo(frame, view, 'placidus')['positions']}
    assert pos['Asc'] == pytest.approx(0.0, abs=1e-6) or pos['Asc'] == pytest.approx(360.0, abs=1e-6)
    assert pos['MC'] == pytest.approx(270.0, abs=1e-6)


def test_lunar_days_current_at_exact_new_moon():
    nm = M.new_moon_near(2451550.0)[0]
    frame = _natal_from_request(SEATTLE)
    frame = dict(frame, jd=nm)
    for method in ('tithi', 'equal', 'angle'):
        rows = M.lunar_days(frame, method)['rows']
        assert sum(1 for row in rows if row['current']) == 1


def test_dyne_house_power_scales_with_width_squared():
    s, k = M.DYNE_HOUSE[2]
    # 宽 60° 的宫,离宫头 30°:s − k·30·30/60² = s − k/4
    assert s - k * 30.0 * 30.0 / (60.0 * 60.0) == pytest.approx(s - k / 4.0)


def test_koch_retries_on_ecliptic_when_latitude_fails():
    frame = _natal_from_request(dict(SEATTLE, date='1940/06/01', lat='47n00', gpsLat=47.0, lon='122w00', gpsLon=-122.0))
    view = C.ChartView(frame, 'chaldean')
    names = {row['point'] for row in M.in_mundo(frame, view, 'koch')['positions']}
    assert 'Moon' in names and len(names) == len(M.MUNDO_POINTS)


def test_mansion_and_novenaria_boundaries_round_up():
    assert int(90.0 * 28.0 / 360.0) % 28 + 1 == 8
    assert M._novenaria(20.0) == M._novenaria(20.5) and M._novenaria(19.99) != M._novenaria(20.0)


def test_improved_degree_qualities_follow_lilly():
    # Lilly 星座度数表:白羊第 1–3 度暗、第 4–8 度明、第 9 度阴;金牛第 6–10 度残缺;人马第 13 度增运;天蝎第 28 度残缺
    q = M.degree_quality
    assert q(1.5, classic=False)['lightA'] == 'dark' and q(5.0, classic=False)['lightA'] == 'bright'
    assert q(8.5, classic=False)['sex'] == 'feminine' and q(7.5, classic=False)['sex'] == 'masculine'
    assert all(q(30.0 + d - 0.5, classic=False)['lame'] for d in (6, 7, 8, 9, 10))
    assert q(240.0 + 12.5, classic=False)['fortune'] == 1
    assert q(210.0 + 27.5, classic=False)['lame'] and not q(210.0 + 28.5, classic=False)['lame']
    assert q(1.5, classic=False)['lightB'] is None and q(1.5)['lightB'] is not None     # 经典档两派并列
