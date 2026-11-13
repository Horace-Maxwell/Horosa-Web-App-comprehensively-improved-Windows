# -*- coding: utf-8 -*-
"""推运图族四技法的原理锁:演进推运 / 推运图 / 周日小限 / 双黄道(astrostudy/directed_figures.py)。

不依赖任何外部输出,全部由定义推得:世俗时位与 swisseph Placidus 宫位位置同值、反解互逆;
演进弧的闭式与天顶回本位年龄;推运图零弧不动、福点按天赤道走;周日小限十二年一周回本命;
双黄道恒星黄道原点与五族判定。
"""
import math
import random

import pytest
import swisseph

from astrostudy import directed_figures as df
from astrostudy.pd_engine import ecl_to_eq

JD = 2447892.7993055554  # 1990-01-01 07:11 UT
PHI, GEOLON = 40.71665, -73.7493
FRAME = df.natal_frame(JD, PHI, GEOLON)
EPS = FRAME['epsTrue']
ARMC = FRAME['armc']


def test_mundane_hours_equals_swisseph_placidus_house_position():
    rnd = random.Random(7)
    for _ in range(300):
        lon, lat = rnd.uniform(0, 360), rnd.uniform(-5, 5)
        hp = swisseph.house_pos(ARMC, PHI, EPS, (lon, lat), b'P')
        assert abs(df.signed12(df.mundane_hours(lon, lat, ARMC, PHI, EPS) - (10.0 - hp) * 2.0)) < 1e-6


def test_axes_hours_and_inverse_round_trip():
    pts = FRAME['points']
    assert abs(df.signed12(df.mundane_hours(pts['MC']['lon'], 0.0, ARMC, PHI, EPS))) < 1e-9
    assert abs(df.signed12(df.mundane_hours(pts['Asc']['lon'], 0.0, ARMC, PHI, EPS) - 18.0)) < 1e-6
    for h in [0.0, 3.3, 6.0, 9.9, 12.0, 15.5, 18.0, 21.7]:
        lon = df.ecliptic_point_at_hours(h, ARMC, PHI, EPS)
        assert abs(df.signed12(df.mundane_hours(lon, 0.0, ARMC, PHI, EPS) - h)) < 1e-7


def test_neroman_arc_closed_form_and_fatum_returns():
    k, t0 = df.NEROMAN_K, df.NEROMAN_T0
    for n, age in [(1, 2.05), (2, 9.71), (3, 38.34)]:  # 天顶回本位 = 弧为 360° 整数倍
        t = df.neroman_age_for_arc(360.0 * n, k, t0)
        assert abs(t - age) < 0.01
        assert abs(df.neroman_arc(t, k, t0) - 360.0 * n) < 1e-9
    assert df.neroman_arc(0.0) == 0.0
    # 出生时弧速 = K / t0(每年度数)
    assert abs((df.neroman_arc(1e-6) / 1e-6) - k / t0) < 1e-3


def test_neroman_two_modes():
    eps = FRAME['epsMean']
    lon, lat = 123.4, 4.5
    # 按黄经度数:黄纬不变,黄经 = 赤经减弧的黄道点
    l2, b2 = df.neroman_point(lon, lat, 30.0, eps, False)
    assert b2 == lat
    ra0, _ = ecl_to_eq(lon, 0.0, eps)
    ra2, _ = ecl_to_eq(l2, 0.0, eps)
    assert abs(df.signed180(ra0 - ra2 - 30.0)) < 1e-9
    # 保留本命赤纬:赤纬不变,赤经减弧
    l3, b3 = df.neroman_point(lon, lat, 30.0, eps, True)
    r0, d0 = ecl_to_eq(lon, lat, eps)
    r3, d3 = ecl_to_eq(l3, b3, eps)
    assert abs(d3 - d0) < 1e-9 and abs(df.signed180(r0 - r3 - 30.0)) < 1e-9
    # 弧 360° = 回到本位
    l4, _ = df.neroman_point(lon, lat, 360.0, eps, True)
    assert abs(df.signed180(l4 - lon)) < 1e-9


def test_bezza_zero_arc_and_fortune_motion():
    pts = {k: FRAME['points'][k] for k in df.SEVEN + df.ANGLES}
    rows, movers = df.bezza_point_rows(pts, ARMC, PHI, EPS, 0.0)
    for r in rows:
        assert abs(df.signed12(r['hp1'] - r['hp0'])) < 1e-12
    by = {r['id']: r for r in rows}
    # 福点 / 精神点在世俗时位上取,推进时每时 15°
    ty, da = df.fortune_hours(by['Sun']['hp0'], by['Moon']['hp0'])
    assert abs(df.signed12(by['Tyche']['hp0'] - ty)) < 1e-12 and abs(df.signed12(by['Daimon']['hp0'] - da)) < 1e-12
    assert abs(df.signed12(movers['Tyche'](30.0) - ty - 2.0)) < 1e-12
    # 地平以上的星推进整个昼半弧 = 走过 6 时
    sun = FRAME['points']['Sun']
    ra, dec = ecl_to_eq(sun['lon'], sun['lat'], EPS)
    from astrostudy.pd_engine import semiarc
    h0 = movers['Sun'](0.0)
    nxt = math.floor(h0 / 6.0) * 6.0 + 6.0  # 下一个轴(时位 6 的倍数)
    seg = semiarc(dec, PHI, h0 < 6.0 or h0 >= 18.0)  # 当前所在半弧
    assert abs(df.signed12(movers['Sun']((nxt - h0) * seg / 6.0) - nxt)) < 1e-6


def test_bezza_contacts_satisfy_their_definitions():
    pts = {k: FRAME['points'][k] for k in df.SEVEN + df.ANGLES}
    _rows, movers = df.bezza_point_rows(pts, ARMC, PHI, EPS, 0.0)
    hp0 = {k: f(0.0) for k, f in movers.items()}
    cons = df.bezza_contacts(movers, pts, ARMC, PHI, EPS, 0.0, 15.0)
    assert cons
    kinds = set()
    for c in cons:
        kinds.add(c['kind'])
        h = movers[c['pid']](c['arc'])
        if c['kind'] == 'mun':
            d = abs(df.signed12(h - hp0[c['prm']]))
            assert abs(d - c['asp']) < 1e-6
        elif c['kind'] == 'par':
            assert abs(df.signed12(h + hp0[c['prm']])) < 1e-6
        elif c['kind'] == 'apar':
            assert abs(df.signed12(h + hp0[c['prm']] - 12.0)) < 1e-6
    assert {'mun', 'zod'} <= kinds


def test_jay_twelve_year_cycle_returns_to_natal():
    pts = {k: FRAME['points'][k] for k in df.SEVEN}
    r12 = df.jay_row(pts, ARMC, PHI, EPS, 12.0)
    assert abs(df.signed180(r12['MC'] - FRAME['points']['MC']['lon'])) < 1e-6
    assert abs(df.signed180(r12['Asc'] - FRAME['points']['Asc']['lon'])) < 1e-6
    r0 = df.jay_row(pts, ARMC, PHI, EPS, 0.0)
    for k in df.SEVEN:
        assert abs(df.signed180(r12[k] - r0[k])) < 1e-6
    # 一年转一宫:天顶赤经每年 +30°
    r1 = df.jay_row(pts, ARMC, PHI, EPS, 1.0)
    assert abs(df.signed180(r1['armc'] - ARMC - 30.0)) < 1e-9
    # 没有黄纬的点在第 0 年就是本命位置
    assert abs(df.signed180(r0['Sun'] - FRAME['points']['Sun']['lon'])) < 1e-3


def test_michon_origin_and_families():
    assert abs(df.michon_ayanamsa(2451545.0) - (26 + 37 / 60 + 18 / 3600)) < 1e-6
    assert df.michon_ayanamsa(2451545.0 + 36525) > df.michon_ayanamsa(2451545.0)  # 随岁差增大
    assert df.michon_family(29.5, 1.0)[:2] == ('en', 30.0)
    assert df.michon_family(45.3, 1.0)[:2] == ('bl', 45.0)
    assert df.michon_family(80.2, 1.0)[:2] == ('re', 80.0)
    assert df.michon_family(36.4, 1.0)[:2] == ('ta', 36.0)
    assert df.michon_family(51.0, 1.0)[0] == 'mi'
    assert df.michon_family(10.0, 1.0)[0] == 'no'
    assert df.michon_family(30.0, 1.0)[0] == 'en'  # 偶数倍 15° 归 12 谐,不归奇数族


def test_michon_superposition_layout_and_swap():
    lons = {k: FRAME['points'][k]['lon'] for k in df.MODERN_RULERS}
    sups, inters = df.michon_tables(lons, 1.0, False)
    assert len(sups) == 12 and len(inters) == 66
    assert (sups[0]['tropicalSign'], sups[0]['siderealSign']) == (0, 11)  # 回归白羊 ↔ 恒星双鱼
    assert (sups[0]['p1'], sups[0]['p2']) == ('Mars', 'Neptune')
    sw, _ = df.michon_tables(lons, 1.0, True)
    assert sups[1]['p1'] == 'Venus' and sw[1]['p1'] == 'Mercury'  # 金牛守护水金互换
    assert [s['mercuryVenus'] for s in sups] == [False, True, True, True, False, True, True, True, False, False, False, False]
    # 叠合所在宫 = 回归星座起点所在宫,下一宫为恒星伴座
    cusps = df.equal_cusps_centered(FRAME['points']['Asc']['lon'])
    s2, _ = df.michon_tables(lons, 1.0, False, cusps)
    for s in s2:
        assert s['house0'] == df.house_of(30.0 * s['tropicalSign'], cusps) and s['house1'] == s['house0'] % 12 + 1


@pytest.mark.parametrize('fn', ['build_neroman', 'build_bezza', 'build_jay', 'build_michon'])
def test_builders_smoke(fn):
    data = {'date': '1990/01/01', 'time': '02:11:00', 'zone': '-05:00', 'lat': '40n43', 'lon': '73w45', 'hsys': 1,
            'targetDate': '2010/06/01', 'targetTime': '12:00:00'}
    out = getattr(df, fn)(data)
    assert out['technique'] in ('neroman', 'bezza', 'jay', 'michon')
    assert 20.0 < out['age'] < 20.6
    # 表里每行的日期 = 出生时刻 + 该行年龄(回归年),年份必须对得上
    rows = []
    if fn == 'build_bezza':
        rows = [(c['age'], c['date']) for c in out['contacts']]
    elif fn == 'build_jay':
        rows = [(r['age'], r['date']) for r in out['rows']]
    elif fn == 'build_neroman':
        rows = [(e['age'], e['date']) for e in out['events']]
    for age, date in rows:
        assert abs(int(date[:4]) - (1990 + age)) <= 1.01, (fn, age, date)
    import jsonpickle
    assert jsonpickle.encode(out, unpicklable=False)   # 与网服务同一编码(盘面对象含 flatlib 对象)
    assert out.get('chart', 'skip') is not None


@pytest.mark.parametrize('fn', ['build_neroman', 'build_bezza', 'build_jay'])
def test_south_reading_chart_is_the_plain_one_turned_half(fn):
    """南半球读法(全盘黄经 +180°,只换星座标签):搬点在真黄经上做,出的外圈盘 = 普通盘整体转 180°;表格(真黄经)两边相同。"""
    import jsonpickle
    import json
    data = {'date': '2001/09/11', 'time': '05:50:00', 'zone': '+10:00', 'lat': '33s52', 'lon': '151e12', 'hsys': 1,
            'targetDate': '2030/06/01', 'targetTime': '12:00:00'}
    plain = json.loads(jsonpickle.encode(getattr(df, fn)(dict(data)), unpicklable=False))
    south = json.loads(jsonpickle.encode(getattr(df, fn)(dict(data, southchart=True)), unpicklable=False))
    assert plain['chart'] and south['chart']

    def close(a, b):
        return abs(((a - b + 180.0) % 360.0) - 180.0) < 1e-6
    seen = 0
    for grp in ('objects', 'houses'):
        pa = {o['id']: o for o in plain['chart']['chart'][grp]}
        sa = {o['id']: o for o in south['chart']['chart'][grp]}
        assert pa.keys() == sa.keys()
        for k, o in pa.items():
            seen += 1
            assert close(sa[k]['lon'], o['lon'] + 180.0), (fn, grp, k, o['lon'], sa[k]['lon'])
    assert seen > 20
    # 表格一侧不带标签:两边逐项相同
    for key in ('arc', 'age', 'natalCusps', 'evolvedCusps'):
        if key in plain:
            assert plain[key] == pytest.approx(south[key]), key
