# -*- coding: utf-8 -*-
"""农历置闰:冬至所在月为十一月(冬月),按「日期」判定(朔日的日期不晚于冬至的日期,与判中气同一口径)。

此前按时刻取冬至前最后一个朔,再用「该月不是从 12 月起就后挪一个月」补正:冬至落在其所在月最后一两天时
错挪到下一个月,这一岁被数成 13 个月而凭空置闰 —— 2033 年误成闰七月(现行农历为闰十一月,且与 2034 年表
前后矛盾),1813 / 2185 年本无闰月却多出闰八月,1642 / 2128 年误成闰九月。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy.jieqi.NongLi import NongLi  # noqa: E402


def _months(year):
    res = NongLi({'year': str(year), 'zone': '+08:00', 'lat': '0n00', 'lon': '120e00'}).compute()
    return {m['date']: (m['name'], int(m.get('leap', 0))) for m in res['months']}


def test_2033_has_no_leap_before_the_eleventh_month():
    m = _months(2033)
    assert m['2033-08-25'] == ('八月', 0)
    assert m['2033-09-23'] == ('九月', 0)
    assert m['2033-11-22'] == ('冬月', 0)
    assert all(leap == 0 for _, leap in m.values())


def test_2034_table_starts_with_leap_eleventh_month_and_agrees_with_2033():
    m33 = _months(2033)
    m34 = _months(2034)
    assert m34['2033-11-22'] == ('冬月', 0)
    assert m34['2033-12-22'] == ('冬月', 1)      # 闰十一月
    assert m34['2034-01-20'] == ('腊月', 0)
    # 相邻两张年表对同一朔望月给同一叫法
    for d in set(m33) & set(m34):
        assert m33[d] == m34[d], d


def test_other_years_with_the_same_pattern():
    assert all(leap == 0 for _, leap in _months(1813).values())
    assert _months(1813)['1813-09-24'] == ('九月', 0)
    assert all(leap == 0 for _, leap in _months(2185).values())
    assert _months(2128)['2128-10-24'] == ('十月', 0)
    assert _months(2129)['2128-12-22'] == ('冬月', 1)


def test_ordinary_leap_years_unchanged():
    assert _months(2023)['2023-03-22'] == ('二月', 1)   # 2023 闰二月
    assert _months(2025)['2025-07-25'] == ('六月', 1)   # 2025 闰六月
    assert all(leap == 0 for _, leap in _months(2024).values())
