# -*- coding: utf-8 -*-
"""界推运:发放点随周日运动顺黄道经过其后各界,从出生所在之界的余度起。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
import swisseph  # noqa: E402
from astrostudy import distributions as D  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402

BASE = {'date': '2026/10/28', 'time': '16:10:00', 'zone': '-07:00', 'lat': '37n46', 'lon': '122w25', 'predictive': True}
PHI = 37 + 46 / 60.0


def _run(**over):
    pr = PerChart(dict(BASE, **over)).getPredict()
    rows = pr.getDistributions()
    st, partners = pr.getDistributionsMeta()
    return rows, st, partners


def test_starts_at_releaser_bound_and_moves_forward_through_zodiac():
    rows, st, _ = _run()
    asc = st['releaserLon']
    bounds = D.terms_list(0)
    first = next(b for b in bounds if b[2] <= asc < b[3])
    assert rows[0]['distributor'] == first[0] and rows[0]['startYears'] == 0.0
    # 第一段 = 出生所在之界的余度 × 该星座每度年数
    eps = swisseph.calc_ut(PerChart(dict(BASE)).getChart().date.jd, swisseph.ECL_NUT)[0][1]
    rate = D.sign_rising_time(first[1], PHI, eps) / 30.0
    assert abs(rows[0]['years'] - (first[3] - asc) * rate) < 1e-3
    # 之后按黄经递增逐界,首尾相接
    seq = [(b[0], b[1]) for b in bounds]
    i = seq.index((first[0], first[1]))
    for k, r in enumerate(rows[1:6], 1):
        ruler, sign_idx = seq[(i + k) % len(seq)]
        assert (r['distributor'], r['sign']) == (ruler, D.const.LIST_SIGNS[sign_idx])
    for a, b in zip(rows, rows[1:]):
        assert abs(a['startYears'] + a['years'] - b['startYears']) < 2e-3


def test_qisma_is_one_year_per_degree():
    rows, st, _ = _run(distMethod='qisma')
    for r in rows[1:6]:
        b = next(x for x in D.terms_list(0) if x[0] == r['distributor'] and D.const.LIST_SIGNS[x[1]] == r['sign'])
        assert abs(r['years'] - (b[3] - b[2])) < 1e-3


def test_classical_rate_is_uniform_within_sign_and_exact_follows_oblique_ascension():
    eps = 23.4367
    p = D.Path(10.0, 'classical', PHI, eps)
    assert abs(p.years_to(10.0) - 2 * p.years_to(5.0)) < 1e-9          # 白羊内均匀
    e = D.Path(10.0, 'exact', PHI, eps)
    oa = lambda lon: D.oblique_ascension(lon, PHI, eps)
    assert abs(e.years_to(40.0) - (oa(50.0) - oa(10.0))) < 1e-9       # 逐度 = 斜升差
    # 一整座的两种算法相同(星座上升时间的定义)
    assert abs(D.Path(0.0, 'classical', PHI, eps).years_to(30.0) - D.Path(0.0, 'exact', PHI, eps).years_to(30.0)) < 1e-9


def test_partner_points_both_sides_excluding_releaser():
    _, st, partners = _run(distReleaser='Sun', distYears=150)
    assert all(p['planet'] != 'Sun' for p in partners)
    sides = {(p['planet'], p['aspect'], p['side']) for p in partners}
    # 同一星同一角左右两侧都可能在路上(射线两侧都真实存在)
    assert any((pl, a, 'D') in sides and (pl, a, 'S') in sides for (pl, a, _s) in sides if a in (60, 90, 120))
    for a, b in zip(partners, partners[1:]):
        assert abs(a['startYears'] + a['years'] - b['startYears']) < 2e-3


def test_year_length_option_converts_dates():
    rows_t, _, _ = _run(distYear='tropical')
    rows_e, _, _ = _run(distYear='egyptian')
    assert rows_t[3]['startYears'] == rows_e[3]['startYears']
    assert rows_t[3]['startDate'] != rows_e[3]['startDate']


@pytest.mark.parametrize('releaser', list(D.RELEASERS))
def test_every_releaser_produces_a_table(releaser):
    rows, st, _ = _run(distReleaser=releaser)
    assert st['distReleaser'] == releaser and rows and rows[0]['startYears'] == 0.0


def test_unknown_settings_fall_back_to_defaults():
    _, st, _ = _run(distReleaser='Nope', distMethod='x', distYear='y', distYears='abc')
    assert (st['distReleaser'], st['distMethod'], st['distYear'], st['distYears']) == ('Asc', 'classical', 'tropical', 100)


def _geo_lon():
    return -(122 + 25 / 60.0)


def test_releaser_longitude_matches_definition():
    """每个发放点档的黄经按定义:四轴 / 行星 / 北交 / 福点取盘上该点;精神点昼 ASC+☉−☽、夜 ASC+☽−☉;
    宿命点 = Placidus 宫位计算的 Vertex;产前朔望 = 产前朔望点。第一期的分配星 = 该点所在之界的界主。"""
    from astrostudy.astroextra import compute_prenatal_syzygy
    chart = PerChart(dict(BASE)).getChart()
    lon = lambda i: float(chart.get(i).lon)
    asc, sun, moon = lon('Asc'), lon('Sun'), lon('Moon')
    expect = {k: lon(k) for k in ('Asc', 'MC', 'Desc', 'IC', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
                                  'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'Pars Fortuna')}
    expect['Spirit'] = ((asc + sun - moon) if chart.isDiurnal() else (asc + moon - sun)) % 360.0
    expect['Vertex'] = float(swisseph.houses_ex(chart.date.jd, PHI, _geo_lon(), b'P')[1][3]) % 360.0
    syz = compute_prenatal_syzygy({'date': BASE['date'], 'time': BASE['time'], 'zone': BASE['zone'], 'lat': PHI, 'lon': _geo_lon()})
    expect['Syzygy'] = float(syz['hylegDegree']) % 360.0
    assert set(expect) == set(D.RELEASERS)
    bounds = D.terms_list(0)
    for releaser, want in expect.items():
        rows, st, _ = _run(distReleaser=releaser)
        d = (st['releaserLon'] - want) % 360.0
        assert min(d, 360.0 - d) < 1e-3, (releaser, st['releaserLon'], want)
        first = next(b for b in bounds if b[2] <= st['releaserLon'] < b[3])
        assert rows[0]['distributor'] == first[0], releaser


@pytest.mark.parametrize('year', list(D.YEAR_DAYS))
def test_year_option_dates_follow_year_length(year):
    """年长档:期起日期 = 出生时刻 + 起始年数 × 该年长(日);年数本身不随年长变。"""
    import datetime as _dt
    from astrostudy.astroextra_parts.common import date_time_from_jd
    rows, st, _ = _run(distYear=year)
    jd0 = PerChart(dict(BASE)).getChart().date.jd
    parse = lambda s: _dt.datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    for r in rows[1:6]:
        want = date_time_from_jd(jd0 + r['startYears'] * D.YEAR_DAYS[year], BASE['zone'])['datetime']
        assert abs((parse(r['startDate']) - parse(want)).total_seconds()) < 3600   # 起始年数回包只留 4 位小数
    assert st['distYear'] == year


@pytest.mark.parametrize('span', list(D.SPANS))
def test_span_option_limits_table(span):
    """年限档:分配星期 / 伙伴星期只列起点在年限内的期,最后一期跨过年限。"""
    rows, st, partners = _run(distYears=span)
    assert st['distYears'] == span
    assert all(r['startYears'] < span for r in rows) and all(p['startYears'] < span for p in partners)
    assert rows[-1]['startYears'] + rows[-1]['years'] >= span - 1e-3
