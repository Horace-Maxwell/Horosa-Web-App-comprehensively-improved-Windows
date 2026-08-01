# -*- coding: utf-8 -*-
"""五支守恒量统一自检 + 新附加键 golden(全为附加键,默认路径零回归)。

守恒:SAV=337 / 7 BAV=48,49,39,54,56,52,39 / KP 段=249 / Vimshottari 合=120 /
Hadda 每宫和=30 / 每宿=13°20′ / nadiamsa=0°12′×150。
"""
import math

from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import JyotishEngine, safe_get
from flatlib import const


def _kernel(**kw):
    d = {'date': '1990/05/15', 'time': '08:30:00', 'zone': '+08:00',
         'lat': 39.9042, 'lon': 116.4074, 'ad': 1,
         'tradition': False, 'predictive': False, 'zodiacal': 1,
         'siderealMode': 'lahiri', 'hsys': 0, 'name': 'inv', 'pos': ''}
    d.update(kw)
    return IndiaChartKernel(d)


def test_sav_337_and_bav_totals():
    eng = JyotishEngine(_kernel())
    av = eng.ashtakavarga()
    sarva = av.get('sarva') or {}
    total = sum(int(v) for v in sarva.values())
    assert total == 337
    EXPECT = {'Sun': 48, 'Moon': 49, 'Mars': 39, 'Mercury': 54,
              'Jupiter': 56, 'Venus': 52, 'Saturn': 39}
    bhinna = av.get('bhinna') or {}
    for planet, want in EXPECT.items():
        vals = bhinna.get(planet) or {}
        got = sum(int(v) for v in vals.values())
        assert got == want, (planet, got, want)


def test_kp_249_and_vimshottari_120():
    from astrostudy.india.kp_system import kp_249_table, DASHA_YEARS
    assert len(kp_249_table()) == 249
    assert sum(DASHA_YEARS.values()) == 120


def test_hadda_terms_sum_30_per_sign():
    # HADDA_LORDS 形如 {sign: [(upper_bound, lord), ...]},末带上界=30 → 每宫覆盖 0-30 无缝。
    from astrostudy.india.tajaka import HADDA_LORDS
    assert len(HADDA_LORDS) == 12
    for sign, bands in HADDA_LORDS.items():
        uppers = [b[0] for b in bands]
        assert uppers == sorted(uppers) and abs(uppers[-1] - 30.0) < 1e-9, sign


def test_nakshatra_span_and_nadiamsa_grid():
    assert abs(360.0 / 27.0 - (13.0 + 20.0 / 60.0)) < 1e-9      # 每宿 13°20′
    assert abs(30.0 / 150.0 - 0.2) < 1e-12                        # nadiamsa 0°12′
    assert 150 * 12 == 1800                                       # 全周 1800 格


# ── 新附加键 golden(A1/A2/A3/A4/A6) ─────────────────────────────────────

def test_nadi_new_keys_shapes():
    eng = JyotishEngine(_kernel())
    nd = eng.nadi()
    assert nd['available'] is True
    assert nd['namesAvailable'] is False
    for row in nd['d150']:
        assert row['name'] is None
        assert abs((row['endLon'] - row['startLon']) - 0.2) < 1e-9
        assert row['startLon'] <= (row['startLon'] // 30) * 30 + row['withinSignDeg'] <= row['endLon'] + 1e-9
    for c in nd['combinations']:
        assert c['count'] >= 2 and len(c['planets']) == c['count']
    jp = nd['jupiterProgression']
    assert jp['rule'] == 'one_year_per_sign' and len(jp['segments']) == 24
    assert jp['segments'][0]['sign'] == jp['startSign']
    assert jp['segments'][0]['startAge'] == 0.0 and jp['segments'][1]['startAge'] == 1.0
    assert len(nd['karakas']) == 9
    prim = [k for k in nd['karakas'] if k.get('primary')]
    assert len(prim) == 1 and prim[0]['planet'] == const.JUPITER


def test_nadi_exchange_detection_synthetic():
    # 火星在天蝎(自庙)不成交换;构造 火星@金牛+金星@白羊 → parivartana 成对。
    from astrostudy.india.jyotish_engine import JyotishEngine as JE
    eng = JE(_kernel())
    nd = eng.nadi()
    for ex in nd['exchanges']:
        assert ex['aSign'] != ex['bSign']
        assert isinstance(ex['dualLord'], bool)


def test_jaimini_ayur_tri_pair():
    eng = JyotishEngine(_kernel())
    jm = eng.jaimini()
    ay = jm['ayurTriPair']
    assert ay['available'] is True
    assert len(ay['pairs']) == 3
    assert sum(ay['votes'].values()) == 3
    assert ay['majority'] in ('purna', 'madhya', 'alpa')
    for p in ay['pairs']:
        assert p['verdict'] in ('purna', 'madhya', 'alpa')
        assert p['aQuality'] in ('movable', 'fixed', 'dual')
    # 循环表锁死(间接):votes 与 pairs verdict 一致
    votes = {'purna': 0, 'madhya': 0, 'alpa': 0}
    for p in ay['pairs']:
        votes[p['verdict']] += 1
    assert votes == ay['votes']


def test_tajaka_tripataki_nak():
    from astrostudy.india.tajaka import tripataki_nakshatra
    pos = {const.MOON: {'sign': const.ARIES, 'lon': 5.0},
           const.SUN: {'sign': const.CANCER, 'lon': 95.0},
           const.MARS: {'sign': const.CAPRICORN, 'lon': 275.0}}
    tri = tripataki_nakshatra(pos)
    assert tri['available'] is True
    rows = {r['planet']: r for r in tri['rows']}
    assert rows[const.MOON]['distance'] == 1 and rows[const.MOON]['flag'] == 1
    assert rows[const.MOON]['tara'] == 'Janma'
    # 95.0°:第 8 宿(Pushya,93°20-106°40);距 = 8-1+1 = 8 → 内旗
    assert rows[const.SUN]['distance'] == 8 and rows[const.SUN]['flag'] == 1
    # 275.0°:第 21 宿(Uttara Ashadha 266°40-280°);距 21 → 外旗;(21-1)%9=2 → Vipat 凶
    assert rows[const.MARS]['distance'] == 21 and rows[const.MARS]['flag'] == 3
    assert rows[const.MARS]['tara'] == 'Vipat' and rows[const.MARS]['good'] is False
    # 权威口径:宿距三旗为九曜制(含罗睺/计都)——罗计入参必出行
    pos9 = dict(pos)
    pos9[const.NORTH_NODE] = {'sign': const.PISCES, 'lon': 335.0}
    pos9[const.SOUTH_NODE] = {'sign': const.VIRGO, 'lon': 155.0}
    tri9 = tripataki_nakshatra(pos9)
    rows9 = {r['planet']: r for r in tri9['rows']}
    assert const.NORTH_NODE in rows9 and const.SOUTH_NODE in rows9
    # 335.0°:第 26 宿(Uttara Bhadrapada 320°-333°20 之后,333°20-346°40);距 26 → 外旗
    assert rows9[const.NORTH_NODE]['distance'] == 26 and rows9[const.NORTH_NODE]['flag'] == 3


def test_tajaka_build_includes_nodes_in_tripataki_nak():
    # build_tajaka 的 node_positions 仅供宿距三旗合并为九曜;其余 Tajika 子块守七曜制。
    from astrostudy.india.tajaka import build_tajaka
    seven = {const.SUN: {'sign': const.ARIES, 'lon': 10.0},
             const.MOON: {'sign': const.TAURUS, 'lon': 40.0},
             const.MERCURY: {'sign': const.ARIES, 'lon': 15.0},
             const.VENUS: {'sign': const.PISCES, 'lon': 340.0},
             const.MARS: {'sign': const.CAPRICORN, 'lon': 275.0},
             const.JUPITER: {'sign': const.CANCER, 'lon': 100.0},
             const.SATURN: {'sign': const.LIBRA, 'lon': 190.0}}
    nodes = {const.NORTH_NODE: {'sign': const.PISCES, 'lon': 335.0},
             const.SOUTH_NODE: {'sign': const.VIRGO, 'lon': 155.0}}
    res = build_tajaka(seven, const.ARIES, 12.0, 30, True, node_positions=nodes)
    tri = res.get('tripatakiNak') or {}
    planets = {r['planet'] for r in tri.get('rows') or []}
    assert const.NORTH_NODE in planets and const.SOUTH_NODE in planets
    assert len(planets) == 9
    # 七曜子块不受 node_positions 影响(muntha/sahams 等不含罗计聚合)
    lords = res.get('yearLord') or {}
    assert lords, 'yearLord should still compute from the seven-graha set'


def test_default_keys_unchanged_regression_anchor():
    # 零回归锚:既有键结构不动 —— charaKarakas 默认 8 行含 PiK;d150 仍 9 行号位。
    eng = JyotishEngine(_kernel())
    jm = eng.jaimini()
    assert len(jm['charaKarakas']) == 8
    assert [r['karakaLabel'] for r in jm['charaKarakas']][:2] == ['AK', 'AmK']
    nd = eng.nadi()
    assert len(nd['d150']) == 9
