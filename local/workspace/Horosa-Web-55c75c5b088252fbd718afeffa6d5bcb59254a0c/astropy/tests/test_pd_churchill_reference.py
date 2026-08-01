# -*- coding: utf-8 -*-
"""主限法引擎 · 权威算例对拍守卫(丘吉尔盘,数值与外部专业排盘软件核验一致)。

盘:1874-11-30 01:30 UT,经 −1.35°,φ=+51.85°,RAMC≈89.907°。
锁三类权威值(角分级):
  ① ☉(P)→☿(S) 合相(in mundo 真β):Placidus 24.424° / Regiomontanus=Campanus 25.622°
     / Topocentric(Marr) 24.073°。
  ② 四轴(各投影法一致):☉→MC 156.025 / ☉→IC −23.975 / ☉→ASC 96.316 / ☉→DESC −144.266。
  ③ 钥匙:Regio 25.622° ÷ Naibod(0.9856473354) = 26.00 年。
🔴 曾抓出既有缺陷:arc_placidus/pole_topocentric 对地平下的点以上子午距错配夜半弧
(6.7°/5.8° vs 24.4°/24.1°),本文件防回潮。
"""
import pytest
import swisseph as swe

from astrostudy import pd_engine as e


@pytest.fixture(scope='module')
def churchill():
    jd = swe.julday(1874, 11, 30, 1.5)
    lat, lon = 51.85, -1.35
    sun = swe.calc_ut(jd, swe.SUN)[0]
    mer = swe.calc_ut(jd, swe.MERCURY)[0]
    eps = swe.calc_ut(jd, swe.ECL_NUT)[0][0]
    ramc = swe.houses(jd, lat, lon, b'P')[1][2]
    return {
        'S': {'lon': mer[0], 'lat': mer[1]},   # ☿ 主限星(固定)
        'P': {'lon': sun[0], 'lat': sun[1]},   # ☉ 被限星
        'ramc': ramc, 'phi': lat, 'eps': eps,
    }


@pytest.mark.parametrize('fn_name,want', [
    ('arc_placidus', 24.424),
    ('arc_regiomontanus', 25.622),
    ('arc_campanus', 25.622),
    ('arc_topocentric', 24.073),
])
def test_sun_to_mercury_by_projection(churchill, fn_name, want):
    fn = getattr(e, fn_name)
    a = fn(churchill['S'], churchill['P'], churchill['ramc'],
           churchill['phi'], churchill['eps'], zodiacal=False)
    assert abs(a - want) < 0.02, (fn_name, a, want)   # 角分级(<1.2′)


@pytest.mark.parametrize('axis,want', [
    ('MC', 156.025), ('IC', -23.975), ('ASC', 96.316), ('DESC', -144.266),
])
def test_sun_to_angles_all_systems_agree(churchill, axis, want):
    a = e.arc_to_angle(churchill['P'], churchill['ramc'], churchill['phi'],
                       churchill['eps'], axis, zodiacal=False)
    assert abs(a - want) < 0.02, (axis, a, want)


def test_naibod_key_conversion():
    assert abs(25.622 / 0.9856473354 - 26.00) < 0.01


def test_new_projection_closed_forms_available(churchill):
    # 新增两投影(纯黄道斜升差 / 赤经直推)可算且互不相同、亦异于 placidus
    az = e.arc_zodiacal_oa(churchill['S'], churchill['P'], churchill['ramc'],
                           churchill['phi'], churchill['eps'])
    ar = e.arc_ra_direct(churchill['S'], churchill['P'], churchill['ramc'],
                         churchill['phi'], churchill['eps'])
    ap = e.arc_placidus(churchill['S'], churchill['P'], churchill['ramc'],
                        churchill['phi'], churchill['eps'], zodiacal=False)
    assert abs(az - ar) > 0.01 and abs(az - ap) > 0.01
