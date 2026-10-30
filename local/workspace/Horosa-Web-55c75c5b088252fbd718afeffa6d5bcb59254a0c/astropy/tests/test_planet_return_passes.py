# -*- coding: utf-8 -*-
"""多重回归:同一回内列全逆行三过(此前遇首个过零即 break,土木逆行的三次回归只报第一次)。
   T-345 复现向量:1990-01-05 10:00 +08:00 本命土星 286.08°,2019 年实际过本命度三次(02-12 / 07-25 / 11-10),旧码只报 02-11。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('swisseph')
from astrostudy.astroextra import compute_planet_return  # noqa: E402


def _run(date, count=1):
    return compute_planet_return({'date': date, 'time': '10:00:00', 'zone': '+08:00', 'body': 'Saturn', 'count': count})


def test_saturn_first_return_lists_all_three_passes():
    res = _run('1990-01-05')
    r = res['returns'][0]
    assert r['which'] == 1
    passes = r['passes']
    assert [p['pass'] for p in passes] == [1, 2, 3]
    dates = [p['date'] for p in passes]
    assert dates[0].startswith('2019-02'), dates
    assert dates[1].startswith('2019-07'), dates
    assert dates[2].startswith('2019-11'), dates
    # 首过仍在顶层(旧消费方零变);中间那过是逆行
    assert r['date'] == passes[0]['date'] and r['jd'] == passes[0]['jd']
    assert passes[1]['retrograde'] is True
    assert passes[0]['retrograde'] is False and passes[2]['retrograde'] is False


def test_single_pass_return_has_one_pass():
    # T-345:1990-11-20 单过一致
    res = _run('1990-11-20')
    r = res['returns'][0]
    assert len(r['passes']) == 1 and r['passes'][0]['jd'] == r['jd']


# ---- 定义层:第 n 回 = 黄经走满 n 圈回到本命黄经;框架(黄道 / 交点)随盘 ----
import swisseph  # noqa: E402
from astrostudy.astroextra_parts import cycles  # noqa: E402

BASE = {'date': '1990/01/01', 'time': '07:12:00', 'zone': '+00:00', 'lat': '40n43', 'lon': '74w00'}


def _lon_at(jd, swid, flags=swisseph.FLG_SWIEPH | swisseph.FLG_SPEED):
    return swisseph.calc_ut(jd, swid, flags)[0][0] % 360.0


@pytest.mark.parametrize('body,swid', [('Sun', swisseph.SUN), ('Moon', swisseph.MOON), ('Mercury', swisseph.MERCURY),
                                       ('Venus', swisseph.VENUS), ('Mars', swisseph.MARS), ('Saturn', swisseph.SATURN)])
def test_every_pass_is_back_at_natal_longitude(body, swid):
    res = compute_planet_return(dict(BASE, body=body, count=4))
    natal = _lon_at(2447892.8, swid)
    assert abs(res['natalLon'] - natal) < 1e-3
    for r in res['returns']:
        assert r['found'] is True
        for p in r['passes']:
            d = ((_lon_at(p['jd'], swid) - natal + 180.0) % 360.0) - 180.0
            # 输出 JD 保留 4 位小数(±5e-5 天):容差 = 该时刻速度 × 舍入误差
            speed = abs(swisseph.calc_ut(p['jd'], swid, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][3])
            assert abs(d) < speed * 5e-5 + 1e-6, (body, r['which'], p, d)


def test_inner_planets_return_about_once_a_year():
    # 地心水金平均与太阳同为一年一回(日心周期 88 / 225 天不是地心回归)
    for body in ('Mercury', 'Venus'):
        jds = [r['jd'] for r in compute_planet_return(dict(BASE, body=body, count=4))['returns']]
        gaps = [b - a for a, b in zip(jds, jds[1:])]
        assert all(250 < g < 480 for g in gaps), (body, gaps)


def test_node_follows_chart_node_type():
    mean = compute_planet_return(dict(BASE, body='Node', count=1))
    true = compute_planet_return(dict(BASE, body='Node', count=1, westNodeType='true'))
    assert abs(mean['natalLon'] - _lon_at(2447892.8, swisseph.MEAN_NODE)) < 1e-3
    assert abs(true['natalLon'] - _lon_at(2447892.8, swisseph.TRUE_NODE)) < 1e-3
    assert abs(mean['returns'][0]['jd'] - true['returns'][0]['jd']) > 1.0


def test_sidereal_chart_returns_follow_precession():
    # 恒星黄道:太阳要多走岁差那一段,第 n 回比回归黄道晚约 n×20 分钟
    trop = compute_planet_return(dict(BASE, body='Sun', count=10))['returns']
    sid = compute_planet_return(dict(BASE, body='Sun', count=10, zodiacal=1))['returns']
    for n in (1, 5, 10):
        lag_min = (sid[n - 1]['jd'] - trop[n - 1]['jd']) * 1440.0
        assert 15 * n < lag_min < 26 * n, (n, lag_min)


def test_retrograde_natal_still_counts_forward_revolutions():
    # 本命土星逆行(1990-05-18):圈数按平均运动方向数,不按本命瞬时速度
    res = compute_planet_return({'date': '1990/05/18', 'time': '12:00:00', 'zone': '+08:00',
                                 'lat': '31n14', 'lon': '121e28', 'body': 'Saturn', 'count': 2})
    assert [r['found'] for r in res['returns']] == [True, True]
    assert res['returns'][0]['date'].startswith('2020-')


def test_beyond_ephemeris_marks_not_found_without_inventing_dates(monkeypatch):
    real = swisseph.calc_ut
    limit = 2447892.8 + 2.5 * 10759.22

    def fake(jd, body, flags=swisseph.FLG_SWIEPH | swisseph.FLG_SPEED):
        if jd > limit:
            raise swisseph.Error('out of range')
        return real(jd, body, flags)
    monkeypatch.setattr(cycles.swisseph, 'calc_ut', fake)
    res = compute_planet_return(dict(BASE, body='Saturn', count=4))
    found = [r['found'] for r in res['returns']]
    assert found[:2] == [True, True] and found[3] is False
    assert 'date' not in res['returns'][3]
