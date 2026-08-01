# -*- coding: utf-8 -*-
"""权威文档确定性参考锚(格林尼治 J2000):四项一致即起盘内核正确。

输入:2000-01-01 12:00 UT(zone +00:00)、lon 0°、lat 51.4769°N,Lahiri/整宫/平交点。
锚:JD_UT==2451545.0 / GMST≈280.4606° / Ayanāṃśa(Lahiri)≈23.8532° / ε≈23.4393°
   / 太阳恒星黄经≈256.4°(射手~16.4°) / SAV 合计==337(全曜 BAV 总和恒等)。
这是唯一的跨体系回归网:任何动到时间基/岁差/黄赤交角/BAV 表的改动在此翻红。
"""
import math

from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import JyotishEngine, safe_get
from flatlib import const


def _kernel():
    return IndiaChartKernel({
        'date': '2000/01/01', 'time': '12:00:00', 'zone': '+00:00',
        'lat': 51.4769, 'lon': 0.0, 'ad': 1,
        'tradition': False, 'predictive': False, 'zodiacal': 1,
        'siderealMode': 'lahiri', 'hsys': 0, 'nodeType': 'mean',
        'name': 'anchor', 'pos': '',
    })


def test_jd_ut_is_j2000_epoch():
    k = _kernel()
    assert abs(float(k.dateTime.jd) - 2451545.0) < 1e-6


def test_gmst_matches_reference():
    # swe.sidtime 出视恒星时(GAST);文档锚 280.4606° 是教科书 GMST——两者差=章动量级(~0.004°)。
    # 锚意义(时间基没漂)不变,容差放到 0.01° 同时钉住 GAST 实值。
    from flatlib.ephem import swe as fswe
    gast_deg = (fswe.swisseph.sidtime(2451545.0) * 15.0) % 360.0
    assert abs(gast_deg - 280.4606) < 0.01
    assert abs(gast_deg - 280.457072) < 1e-4


def test_lahiri_ayanamsa_matches_reference():
    from flatlib.ephem import swe as fswe
    sw = fswe.swisseph
    k = _kernel()
    with k.chart._siderealContext():
        ay = sw.get_ayanamsa_ut(2451545.0)
    # swe SIDM_LAHIRI 与文档表值差 ~14″(分派微差);带宽 0.01° 内钉双值。
    assert abs(ay - 23.8532) < 0.01
    assert abs(ay - 23.857092) < 1e-4


def test_obliquity_matches_reference():
    from flatlib.ephem import swe as fswe
    sw = fswe.swisseph
    res = sw.calc_ut(2451545.0, sw.ECL_NUT)[0]
    # ECL_NUT: [0]=真赤交角(含章动) [1]=平赤交角;文档锚 23.4393°=J2000 平赤交角。
    eps_mean = float(res[1])
    assert abs(eps_mean - 23.4393) < 1e-3


def test_sun_sidereal_longitude_sagittarius():
    k = _kernel()
    sun = safe_get(k.chart, const.SUN)
    lon = float(sun.lon) % 360.0
    assert abs(lon - 256.4) < 0.2          # 文档「约 256.4°」;实值 256.5157(Lahiri 微差内)
    assert int(lon // 30.0) == 8           # 第 9 座(0 基 8)= 射手


def test_sav_total_is_337():
    eng = JyotishEngine(_kernel())
    av = eng.ashtakavarga()
    sarva = av.get('sarva') or av.get('sarvaBySign') or []
    if isinstance(sarva, dict):
        total = sum(int(v) for v in sarva.values())
    else:
        total = sum(int(x['total'] if isinstance(x, dict) else x) for x in sarva)
    assert total == 337


def test_bhava_chalit_alias_is_sripati():
    # 术语一致性:Bhāva Chalit = Śrīpati(弧三分中点)= 索引 7;旧值 5(Equal)与定义不符已订正。
    from astrostudy.india.india_chart_kernel import INDIA_HOUSE_ALIASES
    assert INDIA_HOUSE_ALIASES['bhava_chalit'] == 7
    assert INDIA_HOUSE_ALIASES['sripati'] == 7
    assert INDIA_HOUSE_ALIASES['equal'] == 5
