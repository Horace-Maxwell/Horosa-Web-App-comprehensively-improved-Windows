"""「第 N 个周年日」取在连续太阳年轴上(外推格里历):主限法弧 → 日期、小限 / 太阳弧 / 行星弧年表同一函数。

病理:周年日按民用历月日取(1582 年以前儒略历)时,1582 年以前出生、推到 1582-10 以后的日期整体比太阳年
早约 10 天,跨改历那一「年」只有 355 天;小限年表 1583 年以后各行只转 29.17°(本命点近座首的落到前一座)。
主限 key 把弧映射成「人生的年」,改历并没有让人少活 10 天。
判据:
- 1500..1580 每 10 年一例、弧 0..120:每弧度对应 365 / 366 天,与回归年常数的偏差 < 1.5 天;公元前同一口径;
- 1582-10-15 以后出生:与「按民用历月日取周年日」的参照实现逐位相同(主限 540 例金标另锁);
- 小限年表第 k 行转角 = 30k(1570 年出生跨改历、公元前出生、现代随机出生,k = 1..99);
- 2 月 29 日生、平年两种口径并存且各有出处:主限取 2 月 28 日(Core),年表取 3 月 1 日(起盘引擎读法)。
"""
import datetime as _dt
import random

import pytest

from astrostudy.civil_calendar import (
    LEAP_DAY_FEB28, LEAP_DAY_MAR1, civil_jdn_display, greg_jdn_of_ymd, greg_ymd_of_jdn, solar_anniversary_jdn,
)
from astrostudy.signasctime import SignAscTime

TROPICAL_YEAR = 365.2421904


def _sat(date, time='12:00:00', zone='+01:00'):
    return SignAscTime(date, time, 1, 40.0, zone)


@pytest.mark.parametrize('year', list(range(1500, 1581, 10)) + [-300, 1200])
def test_primary_direction_year_length_is_a_solar_year(year):
    sat = _sat('{0}/05/10'.format(year))
    for arc in range(0, 121):
        a, b = sat.getJDFromPDArc(arc), sat.getJDFromPDArc(arc + 1)
        assert b - a in (365.0, 366.0), (year, arc, b - a)
        assert abs(a - (sat.birth.jd + arc * TROPICAL_YEAR)) < 1.5, (year, arc)


def test_reform_crossing_dates():
    assert _sat('1570/05/10').getDateFromPDArc(30.0).startswith('1600-05-20')
    assert _sat('1581/11/01').getDateFromPDArc(1.0).startswith('1582-11-11')
    assert _sat('1500/05/10').getDateFromPDArc(83.0).startswith('1583-05-20')
    # 1582 年以前:周年日的民用历标签就是出生月日(太阳年轴与儒略历在百年内只差 1 天以内)
    assert _sat('1500/05/10').getDateFromPDArc(30.0).startswith('1530-05-10')
    # 儒略闰日出生不抛错
    assert _sat('1500/02/29').getDateFromPDArc(30.0).startswith('1530-02-28')


def _civil_anniversary_reference(y, m, d, years):
    """参照实现(1582-10-15 以后出生):按民用历月日取周年日,2 月 29 日生、平年取 2 月 28 日。"""
    ty = y + years
    try:
        return _dt.date(ty, m, d)
    except ValueError:
        return _dt.date(ty, 2, 28)


def test_modern_births_identical_to_civil_anniversary_reference():
    rnd = random.Random(1582)
    zones = ['+08:00', '-05:00', '+05:30', '+00:00', '-03:30']
    for i in range(200):
        y = rnd.randint(1930, 2089)
        m, d = rnd.randint(1, 12), rnd.randint(1, 28)
        if i % 20 == 0:
            y, m, d = 1932 + 4 * rnd.randint(0, 39), 2, 29
        tm = '%02d:%02d:%02d' % (rnd.randint(0, 23), rnd.randint(0, 59), rnd.randint(0, 59))
        sat = _sat('%04d/%02d/%02d' % (y, m, d), tm, rnd.choice(zones))
        birth = _dt.date(y, m, d)
        for arc in (0.0, 0.5, 1.0, 12.3456, 30.0, 59.99, 88.1, 99.5):
            whole = int(arc)
            cur = _civil_anniversary_reference(y, m, d, whole)
            nxt = _civil_anniversary_reference(y, m, d, whole + 1)
            expect = sat.birth.jd + float((cur - birth).days) + (arc - whole) * float((nxt - cur).days)
            assert sat.getJDFromPDArc(arc) == expect, (y, m, d, tm, arc)


def test_axis_is_civil_after_reform_and_continuous_before():
    # 1582-10-15 以后:外推格里历就是民用历
    for y, m, d in [(1582, 10, 15), (1600, 2, 29), (1990, 5, 18), (2400, 12, 31)]:
        assert greg_jdn_of_ymd(y, m, d) == civil_jdn_display(y, m, d)
        assert greg_ymd_of_jdn(civil_jdn_display(y, m, d)) == (y, m, d)
    # 跨改历的周年:民用历月日会少 10 天,太阳年轴不会
    j = civil_jdn_display(1582, 5, 1)
    assert solar_anniversary_jdn(j, 1) - j == 365


def test_leap_day_two_rules_side_by_side():
    """2 月 29 日生、平年:主限取 2 月 28 日(Core 口径,主限金标锁定),年表取 3 月 1 日(起盘引擎把
    不存在的 2-29 读作 3-01)。两边都经 solar_anniversary_jdn,只是规则参数不同;改任一边必须同时决定另一边。"""
    from astrostudy.perchart import PerChart
    j = civil_jdn_display(2000, 2, 29)
    assert solar_anniversary_jdn(j, 1, LEAP_DAY_FEB28) == civil_jdn_display(2001, 2, 28)
    assert solar_anniversary_jdn(j, 1, LEAP_DAY_MAR1) == civil_jdn_display(2001, 3, 1)
    assert solar_anniversary_jdn(j, 4, LEAP_DAY_MAR1) == civil_jdn_display(2004, 2, 29)
    assert _sat('2000/02/29').getDateFromPDArc(1.0).startswith('2001-02-28')
    pc = PerChart({'date': '2000/02/29', 'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30',
                   'hsys': 'PLACIDUS', 'ad': 1})
    assert [r['date'] for r in pc.getPredict().getProfection()[:4]] == \
        ['2001-03-01', '2002-03-01', '2003-03-01', '2004-02-29']
    with pytest.raises(ValueError):
        solar_anniversary_jdn(j, 1, 'mar2')


def _sun_lon(obj_list):
    from flatlib import const
    for o in obj_list:
        oid = o.get('id') if isinstance(o, dict) else o.id
        if oid == const.SUN:
            return o.get('lon') if isinstance(o, dict) else o.lon
    raise AssertionError('no sun')


@pytest.mark.parametrize('birth', ['1570/05/10', '-300/03/10', '1953/11/30', '2012/12/31'])
def test_profection_rows_turn_thirty_degrees_per_year(birth):
    from astrostudy.perchart import PerChart
    pc = PerChart({'date': birth, 'time': '12:00:00', 'zone': '+00:00', 'lat': '41n54', 'lon': '12e30',
                   'hsys': 'PLACIDUS', 'ad': 1})
    sun0 = _sun_lon(pc.getChart().objects)
    rows = pc.getPredict().getProfection()
    assert len(rows) == 99
    for k, row in enumerate(rows, 1):
        rot = (_sun_lon(row['chart']['objects']) - sun0) % 360.0
        dev = abs(rot - (30.0 * k) % 360.0)
        assert min(dev, 360.0 - dev) < 0.15, (birth, k, row['date'], rot)


def test_profection_age_counts_solar_returns():
    """小限「已过整年」按本命到上一次回归的回归次数数:周年日恰在回归前后数分钟时(约 1% 的行)
    平均年长 floor 与 prevSr 各按各的界,整盘差 30°。随机现代出生 × 99 行无一例外。"""
    from flatlib import const
    from flatlib.chart import Chart
    from flatlib.datetime import Datetime
    from flatlib.geopos import GeoPos
    from flatlib.predictives import profections
    from astrostudy.perpredict import _anniversary_rows
    rnd = random.Random(7)
    for _ in range(12):
        y, m, d = rnd.randint(1900, 2030), rnd.randint(1, 12), rnd.randint(1, 28)
        tm = '%02d:%02d' % (rnd.randint(0, 23), rnd.randint(0, 59))
        ch = Chart(Datetime('%d/%02d/%02d' % (y, m, d), tm, '+08:00'), GeoPos('39n54', '116e24'))
        s0 = ch.getObject(const.SUN).lon
        for k, (ds, _label) in enumerate(_anniversary_rows(y, m, d, 99), 1):
            rot = (profections.compute(ch, Datetime(ds, tm, '+08:00')).getObject(const.SUN).lon - s0) % 360.0
            dev = abs(rot - (30.0 * k) % 360.0)
            assert min(dev, 360.0 - dev) < 1.0, (y, m, d, tm, k, rot)
