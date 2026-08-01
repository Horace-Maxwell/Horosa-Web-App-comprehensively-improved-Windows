# -*- coding: utf-8 -*-
"""太阳三态阈值 / 恒星合相轨 / 映点接触容许度 请求级参数化哨兵。

判据:
  ① 缺省 == 显式默认 == 历史行为(零回归:phase/sunPos/stars/antiscias 全等);
  ② 三态属性注入:缺省两套各保现值(sunPos 17'/8.5/17,phase 16'/8),传键两套统一;
  ③ phase 实测随 combustOrb 变(探针:1990/06/15 水星距日 ~18.7°,combustOrb=20 → 'combust');
     日光束级恒逐星 arcus visionis(underBeamsOrb 不注入 phase 束级);
  ④ 恒星:starOrb 放宽命中单调不减;byMagnitude 与逐星 FixedStar.orb() 公式一致;
  ⑤ 映点:antisciaOrb 放宽接触对单调不减、收紧单调不增。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra

BASE = {'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 1}


def _pc(**extra):
    data = dict(BASE)
    data.update(extra)
    pc = perchart.PerChart(astroextra.base_params(data))
    pc.getChartObj()
    return pc


def _phase_map(pc):
    out = {}
    for o in pc.getChartObj()['objects']:
        oid = getattr(o, 'id', None)
        ph = getattr(o, 'phase', None)
        if oid and ph:
            out[oid] = ph
    return out


def _star_count(pc):
    return sum(len(x['stars']) for x in pc.getChartObj()['stars'])


def _anti_count(pc):
    a = pc.getChartObj()['antiscias']
    return len(a['antiscia']) + len(a['cantiscia'])


def test_defaults_are_byte_identical_to_legacy():
    pa = _pc()
    pb = _pc(cazimiOrb=None, starOrb=1, antisciaOrb=1)
    assert _phase_map(pa) == _phase_map(pb)
    assert _star_count(pa) == _star_count(pb)
    assert _anti_count(pa) == _anti_count(pb)
    # ② 属性口径:缺省两套各保现值。
    assert pa._sunPosCazimi == 17.0 / 60.0 and pa._phaseCazimi == 16.0 / 60.0
    assert pa._sunPosCombust == 8.5 and pa._phaseCombust == 8.0
    assert pa._sunPosBeams == 17.0
    p2 = _pc(cazimiOrb=1.0, combustOrb=10.0, underBeamsOrb=20.0)
    assert p2._sunPosCazimi == 1.0 and p2._phaseCazimi == 1.0
    assert p2._sunPosCombust == 10.0 and p2._phaseCombust == 10.0
    assert p2._sunPosBeams == 20.0


def test_phase_follows_combust_orb_probe():
    # ③:水星 1990/06/15 距日 ~18.74°:默认 arcus(水星 10°) → 'free';combustOrb=20 → 'combust'。
    ph_a = _phase_map(_pc())
    ph_b = _phase_map(_pc(combustOrb=20.0))
    assert ph_a.get('Mercury') == 'free'
    assert ph_b.get('Mercury') == 'combust'
    # 束级不吃 underBeamsOrb(恒逐星 arcus):只放大 underBeamsOrb 时水星 phase 不变。
    ph_c = _phase_map(_pc(underBeamsOrb=40.0))
    assert ph_c.get('Mercury') == 'free'


def test_star_orb_monotone_and_by_magnitude():
    c1 = _star_count(_pc())
    c3 = _star_count(_pc(starOrb=3))
    assert c3 >= c1
    # byMagnitude:与逐星星等轨公式重算一致。
    pcm = _pc(starOrbMode='byMagnitude')
    stars = pcm._getFixedStars67Cached()
    import flatlib.const as const
    # 星集与 getStars 同源(tradition=False 时是 objlists 大集,含小行星/虚点)。
    planets = (const.LIST_OBJECTS_TRADITIONAL if pcm.tradition else pcm.objlists).copy()
    planets.extend(const.LIST_ANGLES)
    expect = 0
    for planet in planets:
        try:
            plaObj = pcm.chart.get(planet)
        except Exception:
            continue
        for star in stars:
            delta = abs(plaObj.lon - star.lon)
            if delta > 180:
                delta = 360 - delta
            if delta < star.orb():
                expect += 1
    assert _star_count(pcm) == expect


def test_antiscia_orb_monotone():
    c_default = _anti_count(_pc())
    c_explicit = _anti_count(_pc(antisciaOrb=1))
    c_wide = _anti_count(_pc(antisciaOrb=2.5))
    c_narrow = _anti_count(_pc(antisciaOrb=0.3))
    assert c_default == c_explicit
    assert c_wide >= c_default >= c_narrow


def test_via_combusta_variant():
    # 2026-07 全局化+口径归正:默认 standard=195–225(传统,由旧窄口径 208–217 归正);
    # narrow=旧值档保留;探针用月亮所落黄经跨档对照(1990/06/15 月 340° 不在任何档 → 恒 False;
    # 换 2003/11/08 月天蝎约 213°:standard/narrow 皆命中;再取天秤 20°(约 200°)盘:standard 中/narrow 不中)。
    def moon_vc(date, time, **extra):
        data = dict({'date': date, 'time': time, 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 1})
        data.update(extra)
        pc = perchart.PerChart(astroextra.base_params(data))
        for o in pc.getChartObj()['objects']:
            if getattr(o, 'id', None) == 'Moon':
                return float(o.lon), bool(getattr(o, 'isViaCombust', False))
        raise AssertionError('no moon')

    lon_a, vc_a = moon_vc('2003/11/08', '21:15:00')                                   # 默认 standard
    lon_n, vc_n = moon_vc('2003/11/08', '21:15:00', viaCombustaVariant='narrow')      # 旧窄口径
    lon_b, vc_b = moon_vc('2003/11/08', '21:15:00', viaCombustaVariant='bothFull')
    assert vc_a == (195 <= lon_a < 225)
    assert vc_n == (208 <= lon_n < 217)
    assert vc_b == (180 <= lon_b < 240)
    # 畸形键回默认(防御)。
    lon_x, vc_x = moon_vc('2003/11/08', '21:15:00', viaCombustaVariant='__nope__')
    assert vc_x == vc_a
