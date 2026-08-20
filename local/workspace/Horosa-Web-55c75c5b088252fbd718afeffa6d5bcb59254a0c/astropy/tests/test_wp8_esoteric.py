# [WP-8] 灵学扩展双向量锚(祝融星两法)。
from astrostudy.perchart import PerChart

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def test_vulcan_off_default():
    assert PerChart(dict(BASE)).getVulcan() is None
    assert PerChart({**BASE, 'vulcanCalc': 'off'}).getVulcan() is None


def test_vulcan_baker_geometry():
    v = PerChart({**BASE, 'vulcanCalc': 'baker'}).getVulcan()
    assert v and v['method'] == 'baker'
    assert 0 <= v['distToSun'] <= 3.0
    # 水星距日 <3° 时合日(扫月份找一例)
    for m in range(1, 13):
        d = {**BASE, 'date': '1991/%02d/10' % m, 'vulcanCalc': 'baker'}
        pc = PerChart(dict(d))
        from flatlib import const
        sun = pc.chart.getObject(const.SUN).lon
        mer = pc.chart.getObject(const.MERCURY).lon
        gap = abs(((mer - sun + 180) % 360) - 180)
        vv = pc.getVulcan()
        if gap < 3.0:
            assert abs(vv['distToSun'] - gap) < 1e-6   # 合水星位
            break


def test_vulcan_weston_or_honest_fallback():
    v = PerChart({**BASE, 'vulcanCalc': 'weston'}).getVulcan()
    assert v and v['method'] in ('weston', 'baker(fallback)')
    if v['method'] == 'weston':
        # 轨道根数法距日上限约 8°20′(文献口径;留余量断 ≤10°)
        assert v['distToSun'] <= 10.0
