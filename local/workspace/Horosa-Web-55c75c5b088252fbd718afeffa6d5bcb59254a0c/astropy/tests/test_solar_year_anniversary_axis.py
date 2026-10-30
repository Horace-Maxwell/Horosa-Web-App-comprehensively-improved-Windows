"""「第 N 个周年日」取在连续太阳年轴上(外推格里历):主限法弧 → 日期、小限 / 太阳弧 / 行星弧年表同一函数。

病理:周年日按民用历月日取(1582 年以前儒略历)时,1582 年以前出生、推到 1582-10 以后的日期整体比太阳年
早约 10 天,跨改历那一「年」只有 355 天;小限年表 1583 年以后各行只转 29.17°(本命点近座首的落到前一座)。
主限 key 把弧映射成「人生的年」,改历并没有让人少活 10 天。
判据:
- 1500..1580 每 10 年一例、弧 0..120:每弧度对应 365 / 366 天,与回归年常数的偏差 < 1.5 天;公元前同一口径;
- 1582-10-15 以后出生:与「按民用历月日取周年日」的参照实现逐位相同(主限 540 例金标另锁);
- 小限年表第 k 行转角 = 30k(1570 年出生跨改历、公元前出生、现代随机出生,k = 1..99);
- 2 月 29 日生、平年两种口径并存且各有出处:主限取 2 月 28 日(Core),年表取 3 月 1 日(起盘引擎读法)。
主限法年内零头(设置项 pdYearDays):缺省 = 到下一周年日的实际天数(上面几条参照的就是这一档);另一档 365 / 366 定长年
(周年时刻按世界时、年长按日历写法,独立参照实现逐行比);两档最多差 1 天,反函数(主限法盘「日期 → 年」)与正向互逆。
"""
import datetime as _dt
import math
import random

import pytest

from astrostudy.civil_calendar import (
    LEAP_DAY_FEB28, LEAP_DAY_MAR1, civil_jdn_display, greg_jdn_of_ymd, greg_ymd_of_jdn, solar_anniversary_jdn,
)
from astrostudy.signasctime import SignAscTime, YEAR_DAYS_ACTUAL, YEAR_DAYS_CALENDAR, calendar_year_days

TROPICAL_YEAR = 365.2421904


def _sat(date, time='12:00:00', zone='+01:00', year_days=YEAR_DAYS_CALENDAR):
    return SignAscTime(date, time, 1, 40.0, zone, year_days=year_days)


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
        sat = _sat('%04d/%02d/%02d' % (y, m, d), tm, rnd.choice(zones), year_days=YEAR_DAYS_ACTUAL)
        birth = _dt.date(y, m, d)
        for arc in (0.0, 0.5, 1.0, 12.3456, 30.0, 59.99, 88.1, 99.5):
            whole = int(arc)
            cur = _civil_anniversary_reference(y, m, d, whole)
            nxt = _civil_anniversary_reference(y, m, d, whole + 1)
            expect = sat.birth.jd + float((cur - birth).days) + (arc - whole) * float((nxt - cur).days)
            assert sat.getJDFromPDArc(arc) == expect, (y, m, d, tm, arc)


# ── 年内零头 365 / 366 定长年(pdYearDays = 1)──
def _gleap(x):
    return x % 4 == 0 and (x % 100 != 0 or x % 400 == 0)


def _jd_ut(t):
    """世界时 datetime(外推格里历)→ 儒略日,Meeus 式,与引擎的整数算术无关。"""
    y, m = t.year, t.month
    if m <= 2:
        y, m = y - 1, m + 12
    a = y // 100
    b = 2 - a + a // 4
    day = t.day + (t.hour + t.minute / 60.0 + (t.second + t.microsecond / 1e6) / 3600.0) / 24.0
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + day + b - 1524.5


def _calendar_reference(birth_ut, years):
    """参照实现:出生世界时加 n 个公历年(2 月 29 日生、平年取 28 日)得周年时刻 a,J = ⌊a 的儒略日⌋,
    Y = a + 12 小时所在的公历年(= 儒略日数 J + 1 那天的年);J + Y 合格里历闰年判据则零头 × 366,否则 × 365。"""
    n = int(math.floor(years))
    try:
        a = birth_ut.replace(year=birth_ut.year + n)
    except ValueError:
        a = birth_ut.replace(year=birth_ut.year + n, day=28)
    ja = _jd_ut(a)
    length = 366 if _gleap(int(math.floor(ja)) + (a + _dt.timedelta(hours=12)).year) else 365
    return ja + (years - n) * length


def _random_births(seed, count):
    rnd = random.Random(seed)
    zones = ['+08:00', '-05:00', '+05:30', '+00:00', '-03:30', '+13:00', '-10:00']
    for i in range(count):
        y, m, d = rnd.randint(1800, 2090), rnd.randint(1, 12), rnd.randint(1, 28)
        if i % 25 == 0:
            y, m, d = 1804 + 4 * rnd.randint(0, 70), 2, 29
        zone = rnd.choice(zones)
        tm = '%02d:%02d:%02d' % (rnd.randint(0, 23), rnd.randint(0, 59), rnd.randint(0, 59))
        yield '%04d/%02d/%02d' % (y, m, d), tm, zone, rnd


def test_calendar_year_days_match_independent_reference():
    for date, tm, zone, rnd in _random_births(366, 300):
        sat = _sat(date, tm, zone)
        y, m, d, h = __import__('swisseph').revjul(sat.birth.jd, 1)
        birth_ut = _dt.datetime(y, m, d) + _dt.timedelta(hours=h)
        for years in [0.0, 1.0, 99.0] + [rnd.uniform(0, 110) for _ in range(12)]:
            assert abs(sat.getJDFromPDArc(years) - _calendar_reference(birth_ut, years)) < 1e-6, (date, tm, zone, years)
            assert sat.getJDFromPDArc(-years) == sat.getJDFromPDArc(years)


def test_calendar_year_length_is_not_the_feb29_rule():
    # 同一天差 0.1 天就换档(J 变了):2000-01-01 12:00 UT 起的一年按 365,之前 0.1 天起的按 366;
    # 这一年实际有 2 月 29 日。年长只看「J + 次日公历年」,与有没有闰日无关。
    assert calendar_year_days(2451545.0) == 365.0
    assert calendar_year_days(2451544.9) == 366.0
    sat = _sat('1990/05/18', '12:00:00', '+00:00')
    short = longer = 0
    for n in range(200):
        a = sat._calendar_anniversary_jd(n)
        actual = sat._calendar_anniversary_jd(n + 1) - a
        length = calendar_year_days(a)
        assert length in (365.0, 366.0) and actual in (365.0, 366.0)
        short += (length == 365.0 and actual == 366.0)
        longer += (length == 366.0 and actual == 365.0)
    assert short > 10 and longer > 10


def test_two_year_day_modes_differ_by_at_most_one_day():
    differ = 0
    for date, tm, zone, rnd in _random_births(29, 200):
        cal, act = _sat(date, tm, zone), _sat(date, tm, zone, year_days=YEAR_DAYS_ACTUAL)
        for years in [rnd.uniform(0, 100) for _ in range(10)]:
            gap = cal.getJDFromPDArc(years) - act.getJDFromPDArc(years)
            assert abs(gap) <= 1.0 + 1e-9, (date, tm, zone, years)
            differ += abs(gap) > 1e-6
        if not date.endswith(('/02/28', '/02/29', '/03/01')):
            for n in (1, 30, 77):
                assert cal.getJDFromPDArc(float(n)) == act.getJDFromPDArc(float(n))
    assert differ > 300


def test_calendar_inverse_round_trip():
    for date, tm, zone, rnd in _random_births(17, 120):
        sat = _sat(date, tm, zone)
        for _ in range(12):
            years = rnd.uniform(0, 100)
            jd = sat.getJDFromPDArc(years)
            back = sat.getPDArcFromDate(jd)
            # 正向不单调只在「定长 366、实际 365」那一天:日期同时落在下一周年后,反函数取下一周年那支
            assert abs(sat.getJDFromPDArc(back) - jd) < 1e-6, (date, tm, zone, years, back)
            assert abs(back - years) < 1e-9 or (math.floor(back) == math.floor(years) + 1 and back - years < 0.003)
            # 正向取不到的那一天(定长 365、实际 366):记为下一周年
            n = int(years)
            nxt = sat._calendar_anniversary_jd(n + 1)
            if calendar_year_days(sat._calendar_anniversary_jd(n)) == 365.0 and nxt - sat._calendar_anniversary_jd(n) == 366.0:
                assert sat.getPDArcFromDate(nxt - 0.5) == n + 1.0
    assert _sat('1990/05/18').getPDArcFromDate(0.0) == 0.0


def test_year_days_setting_reaches_table_and_dial():
    from astrostudy.perchart import PerChart, pd_extra_settings_echo
    from astrostudy.perpredict import PerPredict
    base = {'date': '1985/07/09', 'time': '06:40:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28',
            'hsys': 1, 'zodiacal': 0, 'pdYears': 100, 'pdaspects': [0, 60, 90, 120, 180]}
    rows = {}
    for mode in (None, 0, 1, '1', 'x', 7):
        data = dict(base) if mode is None else dict(base, pdYearDays=mode)
        pc = PerChart(data)
        rows[mode] = PerPredict(pc).getPrimaryDirection()
        assert pd_extra_settings_echo(pc)['pdYearDays'] == (1 if mode in (1, '1') else 0)
    assert rows[None] == rows[0] == rows['x'] == rows[7]
    assert rows[1] == rows['1']
    assert [r[:4] for r in rows[0]] == [r[:4] for r in rows[1]]
    assert any(a[4] != b[4] for a, b in zip(rows[0], rows[1]))
    from flatlib.datetime import Datetime
    for mode in (0, 1):
        pp = PerPredict(PerChart(dict(base, pdYearDays=mode)))
        sat = SignAscTime(base['date'], base['time'], 1, 31.0, base['zone'], year_days=mode)
        other = SignAscTime(base['date'], base['time'], 1, 31.0, base['zone'], year_days=1 - mode)
        checked = distinct = 0
        for r in rows[mode]:
            if r[0] <= 0.5 or r[0] > 80:
                continue
            # 主限法盘(日期 → 年 → 弧)对表格同一行的日期(UT 显示)回到同一个弧,且走的是本档的反函数
            day, clock = r[4].replace('-', '/').split(' ')
            jd = Datetime(day, clock, '+00:00').jd
            chart = pp.getPrimaryDirectionChartByDate(r[4].replace('-', '/'), zone='+00:00')
            assert abs(chart['arc'] - sat.getPDArcFromDate(jd)) < 1e-9, (mode, r)
            assert abs(chart['arc'] - r[0]) < 0.003, (mode, r)
            distinct += abs(other.getPDArcFromDate(jd) - chart['arc']) > 1e-5
            checked += 1
            if checked >= 40:
                break
        assert checked >= 40 and distinct >= 5


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
