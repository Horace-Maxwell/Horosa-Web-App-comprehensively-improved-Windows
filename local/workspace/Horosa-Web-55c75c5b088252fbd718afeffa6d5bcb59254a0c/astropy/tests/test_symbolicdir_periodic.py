# -*- coding: utf-8 -*-
"""周期律向运的定义:每星一周期,走完一周回到本命;只推十星;宫头不动;年长四档;缺省路径不变。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from astrostudy import symbolicdir  # noqa: E402
from astrostudy.perchart import PerChart  # noqa: E402

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1}


def _chart():
    return PerChart(dict(BASE)).chart


def _lon_of(res, oid):
    return next(o.lon for o in res['objects'] if o.id == oid)


def _sep(a, b):
    return abs((a - b + 180) % 360 - 180)


@pytest.mark.parametrize('oid,years', sorted(symbolicdir.PERIODIC_YEARS.items()))
def test_each_planet_returns_after_its_period(oid, years):
    chart = _chart()
    natal = chart.objects.get(oid).lon
    assert _sep(_lon_of(symbolicdir.compute(chart, years, 'periodic'), oid), natal) < 1e-6
    half = symbolicdir.compute(chart, years / 2.0, 'periodic')
    assert abs(_sep(_lon_of(half, oid), natal) - 180) < 1e-6


def test_converse_is_the_mirror_of_direct():
    chart = _chart()
    d = symbolicdir.compute(chart, 7.3, 'periodic')
    c = symbolicdir.compute(chart, 7.3, 'periodic', direction='converse')
    for oid, years in symbolicdir.PERIODIC_YEARS.items():
        natal = chart.objects.get(oid).lon
        arc = 7.3 * 360.0 / years
        assert _sep(_lon_of(d, oid), natal + arc) < 1e-6
        assert _sep(_lon_of(c, oid), natal - arc) < 1e-6


def test_only_ten_planets_are_directed_and_natal_chart_is_untouched():
    chart = _chart()
    before = {o.id: o.lon for o in chart.objects}
    res = symbolicdir.compute(chart, 12.0, 'periodic')
    assert {o.id for o in res['objects']} == set(symbolicdir.PERIODIC_YEARS)
    assert {o.id: o.lon for o in chart.objects} == before


def test_uniform_rates_keep_all_points():
    chart = _chart()
    res = symbolicdir.compute(chart, 12.0, 'persian')
    assert len(res['objects']) == len(list(chart.objects))
    assert _sep(_lon_of(res, 'Moon'), chart.objects.get('Moon').lon + 12.0) < 1e-6


@pytest.mark.parametrize('key,days', [('solar', 365.2421904), ('sidereal', 365.256363), ('hellenistic', 360.0), ('bija', 365.258756), ('bijaClassic', 366.256399), ('nope', 365.2421904)])
def test_year_days(key, days):
    assert symbolicdir.yearDays(key) == days


def test_year_length_changes_the_age_and_default_stays():
    predict = PerChart(dict(BASE)).getPredict()
    solar = predict.getPersianDirectedByDate('2020/05/18 10:00', 'persian', 1, False, 'direct')
    same = predict.getPersianDirectedByDate('2020/05/18 10:00', 'persian', 1, False, 'direct', persianYear='solar')
    h360 = predict.getPersianDirectedByDate('2020/05/18 10:00', 'persian', 1, False, 'direct', persianYear='hellenistic')
    assert solar['ageYears'] == same['ageYears']
    assert h360['ageYears'] > solar['ageYears'] + 0.4
