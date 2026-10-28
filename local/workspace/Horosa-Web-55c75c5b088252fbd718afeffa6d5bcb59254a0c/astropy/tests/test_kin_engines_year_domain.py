"""kinastro 七政引擎的全年份域口径:适配层把民用日期(1582-10-15 以前儒略历、历史纪年)换成
「同一天的格里历」再交给 vendor 引擎,引擎回写的日期再换回民用历。

- 四档(1200 / 1500 / 公元前 300 / 1990)+ 五位年:太阳黄经与起盘主链(flatlib 同输入)差 < 0.05°,儒略日相同;
- 1582-10-15 以后:换算恒等,整盘与直接调 vendor 引擎逐位相同;
- 日期串只发不足 4 位年 / 公元前 / 五位年(不带年月日字段)时不再落到缺省日期;
- 择日 / 流时回写的日期是民用历,且与引擎按儒略日算出的日干支一致。
"""
import pytest

import flatlib.ephem.swe  # noqa: F401  副作用:激活打包星历路径(vendor 的 set_ephe_path("") 由它守住)
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.ephem import ephem
from flatlib.geopos import GeoPos

from astrostudy.civil_calendar import civil_julday_display
from websrv.kentang.kinastro_common import (
    parse_datetime,
    vendor_civil_date,
    vendor_civil_ymd,
    vendor_greg_ymd,
)
from websrv.webqizhengkinsrv import compute_qizheng_kin_pan

LAT, LON = '39n54', '116e23'
SUN_NAMES = ('太阳', '太陽')
STEMS = '甲乙丙丁戊己庚辛壬癸'
BRANCHES = '子丑寅卯辰巳午未申酉戌亥'


def _req(date, ad=1, **extra):
    body = {'date': date, 'time': '12:00:00', 'ad': ad, 'zone': '+00:00', 'lat': LAT, 'lon': LON}
    body.update(extra)
    return body


def _sun(pan):
    for p in pan['qizheng']['planets']:
        if p.get('name') in SUN_NAMES:
            return p['longitude']
    raise AssertionError('盘里没有太阳')


def _main_chain(date):
    dt = Datetime(date, '12:00:00', '+00:00')
    return dt.jd, ephem.getObject(const.SUN, dt, GeoPos(LAT, LON)).lon


@pytest.mark.parametrize('date,ad', [
    ('1200/06/01', 1),
    ('1500/01/10', 1),
    ('-300/07/05', -1),
    ('1990/03/10', 1),
    ('300/07/05', 1),
    ('12000/01/01', 1),
])
def test_sun_and_julian_day_match_main_chain(date, ad):
    pan = compute_qizheng_kin_pan(_req(date, ad, qizhengKinTransitMode='same'))
    jd, sun = _main_chain(date)
    assert pan['qizheng']['chart']['julianDay'] == pytest.approx(jd, abs=1e-6)
    assert pan['qizheng']['transit']['julianDay'] == pytest.approx(jd, abs=1e-6)
    diff = abs((_sun(pan) - sun + 180.0) % 360.0 - 180.0)
    assert diff < 0.05, '{0}: 七政引擎太阳 {1} vs 主链 {2}'.format(date, _sun(pan), sun)
    assert pan['dateStr'] == date.replace('/', '-')


@pytest.mark.parametrize('y,m,d', [
    (1582, 10, 15), (1600, 2, 29), (1990, 3, 10), (2026, 12, 31), (9999, 12, 31),
])
def test_conversion_is_identity_after_gregorian_reform(y, m, d):
    assert vendor_greg_ymd(y, m, d) == (y, m, d)
    assert vendor_civil_ymd(y, m, d) == (y, m, d)
    s = '{0:04d}-{1:02d}-{2:02d}'.format(y, m, d)
    assert vendor_civil_date(s) == s


def test_modern_pan_identical_to_direct_vendor_call():
    from astro.qizheng.calculator import compute_chart
    from astro.qizheng.qizheng_electional import find_auspicious_dates
    pan = compute_qizheng_kin_pan(_req('1990/03/10', qizhengKinElectionalStartDate='1990-12-20', qizhengKinElectionalDays=20))
    raw = compute_chart(1990, 3, 10, 12, 0, 0.0, 39.9, 116.383333, location_name='x', gender='male')
    assert pan['qizheng']['chart']['julianDay'] == raw.julian_day
    assert [p['longitude'] for p in pan['qizheng']['planets']] == [p.longitude for p in raw.planets]
    el = find_auspicious_dates(1990, 12, 20, 1991, 1, 8, timezone=0.0, criteria='general')
    assert pan['qizheng']['electional']['startDate'] == el.start_date
    assert pan['qizheng']['electional']['endDate'] == el.end_date
    assert [x['date'] for x in pan['qizheng']['electional']['ratedDates']] == [x.date for x in el.rated_dates[:30]]


def _day_pillar(civil_date):
    neg = civil_date.startswith('-')
    y, m, d = (int(x) for x in civil_date.lstrip('-').split('-'))
    jd = civil_julday_display(-y if neg else y, m, d, 12.0)
    n = int(jd + 0.5) - int(2451911.0 + 0.5)   # 2001-01-07 甲子日
    return STEMS[n % 10] + BRANCHES[n % 12]


@pytest.mark.parametrize('start,expect_end', [
    ('1500-12-25', '1501-01-13'),
    ('-0300-12-28', '-0299-01-16'),
    ('1582-10-01', '1582-10-30'),
])
def test_electional_dates_come_back_as_civil_and_match_day_pillar(start, expect_end):
    pan = compute_qizheng_kin_pan(_req('1500/01/10', qizhengKinElectionalStartDate=start, qizhengKinElectionalDays=20))
    el = pan['qizheng']['electional']
    assert el['startDate'] == start
    assert el['endDate'] == expect_end
    for item in el['ratedDates']:
        assert _day_pillar(item['date']) == item['stemBranch'], item


def test_custom_transit_date_is_civil():
    pan = compute_qizheng_kin_pan(_req('1990/03/10', qizhengKinTransitMode='custom',
                                       qizhengKinTransitDate='1500-01-10', qizhengKinTransitTime='12:00'))
    tr = pan['qizheng']['transit']
    assert (tr['year'], tr['month'], tr['day']) == (1500, 1, 10)
    jd, _sun_lon = _main_chain('1500/01/10')
    assert tr['julianDay'] == pytest.approx(jd, abs=1e-6)


@pytest.mark.parametrize('body,expect', [
    ({'date': '300-07-05', 'time': '08:30:15'}, (300, 7, 5, 8, 30, 15)),
    ({'date': '-300-07-05', 'time': '08:30:00'}, (-300, 7, 5, 8, 30, 0)),
    ({'date': '300/07/05', 'time': '08:30:00', 'ad': -1}, (-300, 7, 5, 8, 30, 0)),
    ({'date': '12000-01-01', 'time': '00:00:00'}, (12000, 1, 1, 0, 0, 0)),
    ({'date': '1990-03-10', 'time': '12:00:00'}, (1990, 3, 10, 12, 0, 0)),
    # 日期串读不出时仍按年月日字段(与原先一致)
    ({'date': '', 'year': -300, 'month': 7, 'day': 5, 'hour': 8}, (-300, 7, 5, 8, 0, 0)),
])
def test_parse_datetime_reads_signed_and_short_year_strings(body, expect):
    dt = parse_datetime(body)
    assert (dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second) == expect
