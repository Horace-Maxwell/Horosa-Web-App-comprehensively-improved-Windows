"""儒略日 ⇄ 民用日期串:全年份域往返锁 + 推运 / 返照语义锁 + 1582-10-15 以后逐位不变。

口径(与起盘引擎 flatlib.datetime.dateJDN 同):1582-10-15 起格里历,此前儒略历;年份为历史纪年(没有 0 年),
串形与前端 formatSignedDate 同('-0300-04-09'、'0999-01-01'、'12000-01-01')。
"""
import math
import random

import pytest
import swisseph

from flatlib import const
from flatlib.datetime import Datetime

from astrostudy import civil_calendar as cc
from astrostudy.astroextra_parts import common
from astrostudy.astroextra_parts.common import base_params, chart_params_from_jd, date_time_from_jd
from astrostudy.astroextra_parts import progressions as pr
from astrostudy.perchart import PerChart


def _legacy_date_time_from_jd(jd, zone):
    """改动前的实现(格里历 + 天文年);只用来证明 1582-10-15 以后逐位不变。"""
    local_jd = jd + common.zone_value(zone) / 24.0
    year, month, day, hour_float = swisseph.revjul(local_jd, swisseph.GREG_CAL)
    hour = int(hour_float)
    minute_float = (hour_float - hour) * 60.0
    minute = int(minute_float)
    second = int(round((minute_float - minute) * 60.0))
    if second >= 60:
        second -= 60
        minute += 1
    if minute >= 60:
        minute -= 60
        hour += 1
    date_text = '{0:04d}-{1:02d}-{2:02d}'.format(year, month, day)
    time_text = '{0:02d}:{1:02d}:{2:02d}'.format(hour, minute, second)
    return {'jd': jd, 'datetime': '{0} {1}'.format(date_text, time_text), 'date': date_text, 'time': time_text}


# (起盘入参日期串, 前端 formatSignedDate 同形的期望串)
DOMAIN_DATES = [
    ('-3000/06/15', '-3000-06-15'),
    ('-0300/03/10', '-0300-03-10'),
    ('-0001/12/31', '-0001-12-31'),
    ('0001/01/01', '0001-01-01'),
    ('0999/07/04', '0999-07-04'),
    ('1500/03/10', '1500-03-10'),
    ('1582/10/04', '1582-10-04'),
    ('1582/10/15', '1582-10-15'),
    ('1600/02/29', '1600-02-29'),
    ('2000/01/01', '2000-01-01'),
    ('9999/12/31', '9999-12-31'),
    ('12000/05/05', '12000-05-05'),
]

BASE = {'time': '12:34:56', 'zone': '+01:00', 'lat': '41n54', 'lon': '12e30', 'hsys': 0}


@pytest.mark.parametrize('date_in,expected', DOMAIN_DATES)
def test_round_trip_through_chart_engine(date_in, expected):
    jd = Datetime(date_in, BASE['time'], BASE['zone']).jd
    rec = date_time_from_jd(jd, BASE['zone'])
    assert rec['date'] == expected
    assert rec['time'] == BASE['time']
    params = chart_params_from_jd(base_params(dict(BASE, date=date_in)), jd)
    chart = PerChart(params)
    assert abs(chart.dateTime.jd - jd) * 86400.0 < 1.0


def test_switch_day_is_contiguous():
    # 1582-10-04(儒略)的次日就是 1582-10-15(格里)
    jd = Datetime('1582/10/04', '12:00:00', '+00:00').jd
    assert date_time_from_jd(jd + 1.0, '+00:00')['date'] == '1582-10-15'
    assert cc.civil_julday(1582, 10, 15, 12.0) - cc.civil_julday(1582, 10, 4, 12.0) == 1.0


def test_random_round_trip_matches_flatlib_reader():
    rnd = random.Random(20261024)
    lo = Datetime('-12998/01/01', '00:00', '+00:00').jd
    hi = Datetime('16798/12/31', '00:00', '+00:00').jd
    for _ in range(400):
        jd = rnd.uniform(lo, hi)
        zone = rnd.choice(['+00:00', '+08:00', '-05:30', '+13:45'])
        rec = date_time_from_jd(jd, zone)
        back = Datetime(rec['date'], rec['time'], zone).jd
        assert abs(back - jd) * 86400.0 < 0.51, (jd, rec)


def test_post_switch_bytes_unchanged():
    rnd = random.Random(7)
    lo = cc.GREG_START_JD + 1.0
    hi = Datetime('9999/12/31', '00:00', '+00:00').jd
    samples = [rnd.uniform(lo, hi) for _ in range(3000)]
    samples += [Datetime('1990/03/10', '12:00:00', '+00:00').jd + k / 86400.0 for k in range(-90, 90)]
    for jd in samples:
        for zone in ('+00:00', '+08:00', '-05:00'):
            new = date_time_from_jd(jd, zone)
            old = _legacy_date_time_from_jd(jd, zone)
            if old['time'].startswith('24:'):
                continue   # 旧实现会写出 '24:00:00';新实现进位到次日,只这一种差别
            assert new == old
            base = base_params({'date': '2000/01/01', 'ad': 1, 'zone': zone})
            p = chart_params_from_jd(base, jd)
            assert (p['date'], p['time']) == (old['date'], old['time'])


def test_hour_carry_rolls_date():
    # 23:59:59.6 → 次日 00:00:00(不写 '24:00:00')
    jd = Datetime('2020/12/31', '00:00:00', '+00:00').jd + (86399.6 / 86400.0)
    rec = date_time_from_jd(jd, '+00:00')
    assert rec['datetime'] == '2021-01-01 00:00:00'


def test_chart_params_reset_era_flag():
    # 公元前的本命、推到公元后:ad 不能沿用 -1(否则起盘把公元后日期当公元前)
    base = base_params({'date': '0010/01/01', 'ad': -1, 'time': '12:00:00', 'zone': '+00:00'})
    jd = Datetime('0002/06/01', '12:00:00', '+00:00').jd
    p = chart_params_from_jd(base, jd)
    assert p['date'] == '0002-06-01' and p['ad'] == 1
    assert abs(PerChart(p).dateTime.jd - jd) < 1e-6


# ---------- 语义锁:推运盘太阳 = 推运时刻真太阳;返照盘太阳 = 本命太阳 ----------
NATALS = [('1500/03/10', '1530/03/10'), ('-0300/03/10', '-0270/03/10'), ('1990/03/10', '2020/03/10')]


@pytest.mark.parametrize('natal,target', NATALS)
def test_secondary_progression_sun_is_true_sun(natal, target):
    d = {'date': natal, 'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30', 'ad': 1, 'hsys': 0,
         'targetDate': target}
    res = pr.build_progressions(d)
    for m in res['methods']:
        sun = [x for x in m['positions'] if x['id'] == const.SUN][0]['lon']
        true_sun = swisseph.calc_ut(m['progressedDate']['jd'], swisseph.SUN)[0][0]
        diff = abs(((sun - true_sun) + 180.0) % 360.0 - 180.0)
        assert diff < 0.01, (natal, m['method'], sun, true_sun)


@pytest.mark.parametrize('natal,start_year', [('1500/03/10', 1530), ('-0300/03/10', -270), ('1990/03/10', 2020)])
def test_solar_return_chart_sun_equals_natal(natal, start_year):
    p = base_params({'date': natal, 'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30', 'ad': 1})
    natal_sun = PerChart(p).chart.getObject(const.SUN).lon
    rows = pr.build_return_timeline(dict(p, count=2, startYear=start_year))['rows']
    assert [r['year'] for r in rows] == [start_year, start_year + 1]
    for r in rows:
        sr = r['solarReturn']
        chart = PerChart(chart_params_from_jd(p, sr['jd']))
        diff = abs(((chart.chart.getObject(const.SUN).lon - natal_sun) + 180.0) % 360.0 - 180.0)
        assert diff < 0.01, (natal, r['year'], sr)
        assert abs(chart.dateTime.jd - sr['jd']) * 86400.0 < 1.0


def test_return_timeline_start_year_from_bc_date_and_no_year_zero():
    p = base_params({'date': '-0002/03/10', 'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30'})
    rows = pr.build_return_timeline(dict(p, count=3))['rows']
    assert [r['year'] for r in rows] == [-2, -1, 1]


# ---------- 其它同口径位点 ----------
def test_cetian_solar_term_uses_civil_julian_date():
    from astrostudy.cetian_ziwei import compute_cetian_ziwei_chart, CETIAN_SOLAR_TERMS
    for (y, m, d) in ((1500, 3, 10), (2006, 10, 4)):
        chart = compute_cetian_ziwei_chart(y, m, d, 12, 0, 8.0, 30.0, 120.0, 'x', '男')
        jd = cc.civil_julday(y, m, d, 12.0 - 8.0)
        sun = swisseph.calc_ut(jd, swisseph.SUN)[0][0] % 360.0
        best = min(CETIAN_SOLAR_TERMS.items(), key=lambda kv: min(abs(sun - kv[1]), 360 - abs(sun - kv[1])))[0]
        text = str(chart.get('solar_term_influence') if isinstance(chart, dict) else getattr(chart, 'solar_term_influence', ''))
        assert text.startswith(best), (y, m, d, text, best)


def test_middle_date_across_switch():
    from astrostudy.helper import getMiddleDate
    r = getMiddleDate('1582/10/01', '00:00', '1582/10/21', '00:00', '+00:00', '+00:00')
    # 儒略 10-01 与格里 10-21 相隔 10 天(中间缺 05..14),中点 = 10-06 儒略 = 10-16 格里
    jd1 = Datetime('1582/10/01', '00:00', '+00:00').jd
    jd2 = Datetime('1582/10/21', '00:00', '+00:00').jd
    assert jd2 - jd1 == 10.0
    assert r['date'] == '1582/10/16' and r['time'] == '00:00'
    bc = getMiddleDate('-0300/01/01', '00:00', '-0300/01/03', '00:00', '+00:00', '+00:00')
    assert bc['date'] == '-0300/01/02'


def test_sirius_year_is_display_year():
    from astrostudy.astroextra_parts.calendars import compute_egyptian_calendar
    p = base_params({'date': '-0300/03/10', 'time': '12:00:00', 'zone': '+02:00', 'lat': '30n03', 'lon': '31e14'})
    out = compute_egyptian_calendar(PerChart(p), p)
    assert out.get('siriusRising', '').startswith('-0300-')
    assert out['siriusYear'] == -300


def test_parse_and_format_helpers():
    assert cc.parse_civil_date('-0300-04-09') == (-299, 4, 9)
    assert cc.parse_civil_date('0300/04/09', ad=-1) == (-299, 4, 9)
    assert cc.parse_civil_date('-0300/04/09 12:00:00', ad=-1) == (-299, 4, 9)
    assert cc.format_civil_date(0, 12, 31) == '-0001-12-31'
    assert cc.format_civil_date(12000, 1, 1, '/') == '12000/01/01'
    assert cc.display_year(cc.astro_year(-1)) == -1 and cc.astro_year(-1) == 0
    assert math.isclose(cc.civil_julday(2000, 1, 1, 12.0), 2451545.0)
