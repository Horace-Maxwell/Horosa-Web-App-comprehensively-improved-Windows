# -*- coding: utf-8 -*-
"""[Q-199/T-126] 报时星(行星时)跨子夜修正。

旧码:太阳时校正把出生推过子夜(23:50 → 00:06)时,出生小时回卷而星期 / 日出不回卷 → 日出法差值少一整天
(7 星循环下等价 +3 星),真 / 平两档子夜前后算错;真机实抓 1990-11-03 23:50 东经 120°:真太阳时档 Saturn、
钟表时档 Sun。修后:日出法出生与日出同加偏移(儒略日差,不回卷)→ 三档恒同;等长 24 时制星期随校正后日期。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra


def _timer(extra):
    data = astroextra.base_params({
        'date': '1990/11/03', 'time': '23:50:00', 'zone': '+08:00',
        'lat': '30N00', 'lon': '120E00', 'ad': 1,
    })
    data.update(extra)
    pc = perchart.PerChart(data)
    return pc.getTimerStar()


def test_sunrise_method_three_solar_modes_agree_across_midnight():
    # 1990-11-03 = 周六(日主土星);日出约 06:2x;23:50 距日出 17 时余 → 迦勒底序 (土+17)%7 = 太阳。
    stars = {m: _timer({'trueSolarTime': m}) for m in ('true', 'mean', 'off')}
    assert stars['off'] == 'Sun'
    assert stars['true'] == stars['mean'] == stars['off'], stars


def test_equal24_weekday_follows_corrected_date():
    # 等长 24 时制:钟表时 23:50 周六 → 第 23 时 → (土+23)%7 = 火星;真太阳时 +16 分推到周日 00:06 → 日主太阳第 0 时 → 太阳。
    assert _timer({'planetaryHourMethod': 'equal24', 'trueSolarTime': 'off'}) == 'Mars'
    assert _timer({'planetaryHourMethod': 'equal24', 'trueSolarTime': 'true'}) == 'Sun'


def test_daytime_birth_unchanged():
    # 10:00 生辰远离子夜:三档恒同(与旧口径一致的回归锚)。
    data = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '30N00', 'lon': '120E00', 'ad': 1}
    outs = set()
    for m in ('true', 'mean', 'off'):
        d = astroextra.base_params(dict(data))
        d['trueSolarTime'] = m
        outs.add(perchart.PerChart(d).getTimerStar())
    assert len(outs) == 1
