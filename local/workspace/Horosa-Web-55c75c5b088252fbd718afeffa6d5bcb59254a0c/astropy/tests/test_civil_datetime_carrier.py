"""民用历时刻承载:1582 年以前的儒略历日期、公元前日期,从请求解析到排盘、年盘、问时、推运一路不落外推格里历。

病理(都是同一个根):stdlib datetime 是外推格里历、只到 1~9999 年。
- kin 系 / 卜类后端 parse_datetime 遇到 1500-02-29(儒略历闰日,格里历没有)抛错后改成当月 1 日:盘头写 1500-02-29,
  实际按 1500-02-01 排盘,四柱月柱、日柱差 28 天;
- 主限法周年插值用 stdlib datetime:1500-02-29 出生整张表炸(周年日的取法见 test_solar_year_anniversary_axis);
- 印占年盘 / 校时剥掉负号:公元前 300 年出生按公元 300 年算年龄,Muntha 错 11 座;派生盘(过运 / 年盘 / 问时)沿用本命 ad=-1,
  公元后的日期被当成公元前那一年;
- 策天 / 仙禽 / 蠢子把历史纪年当天文年交给 sxtwl 与儒略日换算:公元前整差一年。
判据:逐年锁 100..1500 百年非 400 倍年的 2 月 29 日;CivilDateTime 在 1582-10-15 以后与 stdlib datetime 逐位同算术;
公元前各派生量与权威口径一致。
"""
import datetime as _dt
import json
import random

import pytest

from astrostudy.civil_calendar import (
    CivilDateTime, astro_year, civil_datetime, civil_julday_display, civil_ymd_valid, reset_ad_for_date,
)
from websrv.horosa_engine_common import parse_datetime as engine_parse
from websrv.kentang.kinastro_common import authoritative_pillars, parse_datetime as kin_parse

JULIAN_ONLY_LEAP_YEARS = [y for y in range(100, 1501, 100) if y % 400 != 0]


def test_julian_only_leap_years_are_the_expected_twelve():
    assert JULIAN_ONLY_LEAP_YEARS == [100, 200, 300, 500, 600, 700, 900, 1000, 1100, 1300, 1400, 1500]


@pytest.mark.parametrize('year', JULIAN_ONLY_LEAP_YEARS + [1580, 1584, 2024])
def test_leap_day_parses_to_itself_in_both_parsers(year):
    body = {'date': '%04d-02-29' % year, 'time': '12:00:00'}
    for parse in (kin_parse, engine_parse):
        dt = parse(dict(body))
        assert (dt.year, dt.month, dt.day, dt.hour) == (year, 2, 29, 12)
        assert civil_julday_display(dt.year, dt.month, dt.day, 12.0) == civil_julday_display(year, 2, 29, 12.0)


@pytest.mark.parametrize('year', JULIAN_ONLY_LEAP_YEARS)
def test_leap_day_four_pillars_match_authority(year):
    from kin_year_domain import extreme_pillars
    dt = kin_parse({'date': '%04d-02-29' % year, 'time': '12:00:00'})
    got = authoritative_pillars(dt, {'zone': '+08:00', 'after23NewDay': 1, 'lateZiHourUseNextDay': 1})
    want = extreme_pillars(year, 2, 29, 12, 0, after23=1, hour_gan_next=1, zone_hours=8.0)
    assert (got['year'], got['month'], got['day'], got['hour']) == want[:4]
    # 与当月 1 日不同(旧实现静默改日后两者逐字相同)
    first = authoritative_pillars(kin_parse({'date': '%04d-02-01' % year, 'time': '12:00:00'}), {'zone': '+08:00'})
    assert got['day'] != first['day']


@pytest.mark.parametrize('date', ['1500-02-29', '1300-02-29', '1000-02-29'])
def test_qizheng_kin_julian_day_is_the_input_day(date):
    from websrv.webqizhengkinsrv import compute_qizheng_kin_pan
    pan = compute_qizheng_kin_pan({'date': date, 'time': '12:00:00', 'zone': '+08:00', 'lat': '30n00', 'lon': '120e00', 'gender': 1})
    s = json.dumps(pan, ensure_ascii=False)
    y, m, d = (int(x) for x in date.split('-'))
    want = civil_julday_display(y, m, d, 12.0 - 8.0)
    assert ('%r' % want) in s or ('%s' % want) in s, '七政 julian_day 不是输入那天'


@pytest.mark.parametrize('date', ['1582-10-10', '2023-02-29', '1500-02-30', '1900-02-29', '0000-01-01'])
def test_nonexistent_civil_date_raises_not_rewritten(date):
    for parse in (kin_parse, engine_parse):
        with pytest.raises(ValueError):
            parse({'date': date, 'time': '12:00:00'})


def test_civil_ymd_valid_single_source():
    assert civil_ymd_valid(1500, 2, 29) and civil_ymd_valid(1582, 10, 4) and civil_ymd_valid(1582, 10, 15)
    assert not civil_ymd_valid(1582, 10, 5) and not civil_ymd_valid(1700, 2, 29) and not civil_ymd_valid(0, 1, 1)
    assert civil_ymd_valid(-1, 2, 29)            # 公元前 1 年 = 天文年 0,儒略闰年
    assert not civil_ymd_valid(-2, 2, 29)


def test_carrier_factory_keeps_stdlib_after_reform_and_civil_before():
    assert type(civil_datetime(1582, 10, 15, 1, 2, 3)) is _dt.datetime
    assert type(civil_datetime(2026, 7, 19)) is _dt.datetime
    for args in ((1582, 10, 4), (1500, 2, 29), (-300, 3, 10), (12000, 1, 1)):
        assert isinstance(civil_datetime(*args), CivilDateTime)


def test_civil_datetime_arithmetic_identical_to_stdlib_after_reform():
    rnd = random.Random(20261024)
    for _ in range(400):
        y = rnd.randint(1600, 2600)   # ±4000 天内不跨回 1582 年以前
        m = rnd.randint(1, 12)
        d = rnd.randint(1, 28)
        args = (y, m, d, rnd.randint(0, 23), rnd.randint(0, 59), rnd.randint(0, 59))
        a, c = _dt.datetime(*args), CivilDateTime(*args)
        td = _dt.timedelta(days=rnd.uniform(-4000, 4000), hours=rnd.uniform(-30, 30))
        a2, c2 = a + td, c + td
        assert (a2.year, a2.month, a2.day, a2.hour, a2.minute, a2.second, a2.microsecond) == \
            (c2.year, c2.month, c2.day, c2.hour, c2.minute, c2.second, c2.microsecond)
        assert a2.strftime('%Y/%m/%d %H:%M:%S') == c2.strftime('%Y/%m/%d %H:%M:%S')
        assert a2.isoformat() == c2.isoformat()
        assert (a2 - a) == (c2 - c) and (a2 < a) == (c2 < c) and a2.weekday() == c2.weekday()


def test_civil_datetime_walks_the_julian_calendar_before_reform():
    one = _dt.timedelta(days=1)
    assert (CivilDateTime(1500, 2, 28) + one).strftime('%Y-%m-%d') == '1500-02-29'
    assert (CivilDateTime(1582, 10, 4) + one).strftime('%Y-%m-%d') == '1582-10-15'
    assert (CivilDateTime(-1, 12, 31) + one).strftime('%Y-%m-%d') == '0001-01-01'
    assert CivilDateTime(-300, 3, 10).strftime('%Y-%m-%d') == '-0300-03-10'
    assert (CivilDateTime(1582, 10, 15) - CivilDateTime(1582, 10, 4)).days == 1


def test_reset_ad_follows_the_new_date():
    assert reset_ad_for_date({'date': '2026/10/24', 'ad': -1})['ad'] == 1
    assert reset_ad_for_date({'date': '-0039/03/10', 'ad': 1})['ad'] == -1
    assert 'ad' not in reset_ad_for_date({'date': '2026/10/24'})


# ── 主限法周年插值(默认路径;1582-10-15 以后与旧实现逐位相同由 540 例金标锁定)──
def test_primary_direction_dates_before_reform():
    from astrostudy.signasctime import SignAscTime
    leap = SignAscTime('1500/02/29', '12:00:00', 1, 40.0, '+01:00')        # 旧实现:ValueError,整张主限表炸
    assert leap.getDateFromPDArc(30.0).startswith('1530-02-28')
    # 1570 年(儒略历)出生的 30 度:周年日取在连续太阳年轴上 → 1600-05-20(回归年常数给 1600-05-19 18:22,
    # 差 < 1 天)。按民用历周年日插值会落 1600-05-10:跨 1582 改历那一「年」只有 355 天,整体比太阳年早 10 天。
    assert SignAscTime('1570/05/10', '12:00:00', 1, 40.0, '+01:00').getDateFromPDArc(30.0).startswith('1600-05-20')
    assert SignAscTime('1990/05/18', '12:00:00', 1, 40.0, '+01:00').getDateFromPDArc(30.0).startswith('2020-05-18')


# ── 印占:年盘年龄 / 派生盘纪元标志 / 返照闰日 / 校时事件 / 问时 ──
def _india_chart(body):
    import cherrypy
    from websrv.webindiasrv import IndiaAstroSrv
    cherrypy.request.json = json.loads(json.dumps(body))
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = IndiaAstroSrv().chart()
    return json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)


def _india_base(date, ad):
    return {'date': date, 'time': '10:30:00', 'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'ad': ad,
            'transitDate': '2026/10/24', 'tajakaYear': 2026, 'indiaHsys': 0, 'indiaAyanamsa': 'lahiri',
            'zodiacal': 1, 'tradition': False, 'predictive': 0}


def _jyotish(res):
    return res.get('jyotish') or (res.get('Result') or {}).get('jyotish') or {}


def test_tajaka_age_counts_across_year_one_for_bc_birth():
    tj = _jyotish(_india_chart(_india_base('-300/03/10', -1))).get('tajaka') or {}
    assert tj.get('ageCompleted') == 2026 + 300 - 1          # 无公元 0 年
    assert tj['muntha']['houseFromNatalLagna'] == (2325 % 12) + 1


def test_derived_transit_chart_is_not_pushed_into_bc():
    """公元前本命 + 公元 2026 过运:过运盘与公元后本命同一天的过运盘九曜同座(旧实现沿用 ad=-1,算成公元前 2026 年)。"""
    bc = _jyotish(_india_chart(_india_base('-300/03/10', -1))).get('gochara') or {}
    ad = _jyotish(_india_chart(_india_base('1990/05/18', 1))).get('gochara') or {}
    sig = lambda g: sorted((r.get('planet'), r.get('transitSign') or r.get('sign')) for r in (g.get('fromMoon') or []))
    assert sig(bc) and sig(bc) == sig(ad)


def test_solar_return_seed_uses_civil_leap_rule():
    from websrv.webindiasrv import IndiaAstroSrv

    class _K:
        chart = None
    seen = []

    def build(ds, ts):
        seen.append(ds)
        return None                                        # safe_get(None) 不可得 → 首轮即返回种子
    cur, adj = IndiaAstroSrv._solar_return_moment(build, 1500, 2, 29, 0.0)
    assert (cur.year, cur.month, cur.day, adj) == (1500, 2, 29, False) and seen[0] == '1500/02/29'
    cur, adj = IndiaAstroSrv._solar_return_moment(build, 1501, 2, 29, 0.0)
    assert (cur.month, cur.day, adj) == (2, 28, True)
    cur, adj = IndiaAstroSrv._solar_return_moment(build, 2026, 5, 18, 0.0)
    assert type(cur) is CivilDateTime and cur.strftime('%Y/%m/%d %H:%M:%S') == '2026/05/18 12:00:00'


def test_rectify_reads_signed_dates_and_reports_skipped_events():
    from websrv.webindiasrv import rectify_core
    res = rectify_core({'date': '-300/03/10', 'time': '10:30:00', 'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'ad': -1,
                        'rectifyWindowMinutes': 2, 'rectifyStepSeconds': 60,
                        'rectifyEvents': [{'kind': 'marriage', 'date': '-0270-06-01'}, {'kind': 'career', 'date': '1500-02-30'}]})
    assert res['anchorTime'] == '-0300-03-10 10:30:00'
    assert 'events' in res['criteriaActive']
    assert [s['index'] for s in res['skippedEvents']] == [1]


def test_prashna_question_time_accepts_julian_leap_day():
    pr = _jyotish(_india_chart(dict(_india_base('1990/05/18', 1), prashnaTime='1500/02/29 10:30:00',
                                    prashnaSchools='kp', prashnaNumber=77))).get('prashna') or {}
    assert pr.get('questionTime') == '1500-02-29 10:30:00'


# ── 策天 / 仙禽 / 蠢子:历史纪年 → 天文年再交给 sxtwl 与儒略日 ──
def test_cetian_bc_year_pillar_matches_authority():
    from astrostudy.cetian_ziwei import compute_cetian_ziwei_chart
    from kin_year_domain import extreme_pillars
    from websrv.horosa_engine_common import json_safe
    stems, branches = '甲乙丙丁戊己庚辛壬癸', '子丑寅卯辰巳午未申酉戌亥'
    for y in (-300, -1, 1990):
        c = json_safe(compute_cetian_ziwei_chart(year=y, month=6, day=10, hour=10, minute=0, timezone=8, latitude=30, longitude=120))
        assert stems[c['lunar_year_stem']] + branches[c['lunar_year_branch']] == extreme_pillars(y, 6, 10, 10, 0)[0]
        assert c['lunar_year'] == y
        assert abs(c['julian_day'] - civil_julday_display(y, 6, 10, 10.0 - 8.0)) < 1e-9


def test_xianqin_bc_lunar_year_is_display_year():
    import cherrypy
    from websrv.webxianqinsrv import XianQinSrv
    cherrypy.request.json = {'date': '-0300-06-10', 'time': '10:30:00', 'zone': '+08:00', 'gender': '1'}
    cherrypy.request.method = 'POST'
    cherrypy.request.headers = {}
    out = XianQinSrv().pan()
    res = json.loads(out.decode('utf-8') if isinstance(out, bytes) else out)
    assert res['ResultCode'] == 0
    assert res['Result']['lunar']['year'] == -300
    assert astro_year(-300) == -299
