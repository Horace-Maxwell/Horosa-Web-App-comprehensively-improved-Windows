# -*- coding: utf-8 -*-
"""气象占:朔望关键度数、界主、次角、亮星、季节朔望。"""
import pytest

from astrostudy import meteorology as MT
from astrostudy.mundane_cycles import build_mundane_cycles

SEATTLE = (47.6, -(122 + 20 / 60))
START = 2464760.0          # 2036-03-08 前后,覆盖 3 月望(季节朔望)与 3 月朔


def rows(months=1.2):
    return MT.meteorology_rows(START, months, SEATTLE[0], SEATTLE[1], '+00:00')


def test_syzygies_are_exact_and_alternate():
    out = MT.syzygies(START, 3)
    assert [k for _, k in out][:4] in (['full', 'new', 'full', 'new'], ['new', 'full', 'new', 'full'])
    for jd, kind in out:
        el = MT._calc(jd, 'Moon')[0] - MT._calc(jd, 'Sun')[0]
        assert abs(MT.fold180(el - (0.0 if kind == 'new' else 180.0))) < 1e-6


def test_full_moon_takes_luminary_above_horizon():
    first = rows()[0]
    assert first['kind'] == 'full' and first['date'].startswith('2036-03-12 09:0')
    assert first['luminary'] == 'Moon' and first['lon'] == pytest.approx(172.3713, abs=0.02)
    above = MT._altitude(first['jd'], first['luminary'], *SEATTLE)
    other = MT._altitude(first['jd'], 'Sun', *SEATTLE)
    assert above > other


def test_first_case_matches_hand_reading():
    first = rows()[0]
    assert first['angle'] == 'MC' and first['angleRuler'] == 'Venus'
    assert first['lord']['planet'] == 'Mars' and first['lord']['sign'] == 1
    assert first['lord']['phase'] == 13
    assert set(first['lord']['conditions']) == {'SIGN', 'LAT_N', 'EVENING'}
    assert [x['star'] for x in first['stars']] == ['Denebola'] and first['stars'][0]['natures'] == ['Saturn', 'Venus']
    assert first['season']['point'] == 0.0 and first['season']['date'].startswith('2036-03-20')


def test_new_moon_uses_conjunction_point():
    new = [r for r in rows() if r['kind'] == 'new'][0]
    assert new['luminary'] is None
    assert new['lon'] == pytest.approx(7.7651, abs=0.02)
    assert new['lord']['planet'] == 'Venus'
    assert 'season' not in new


def test_egyptian_terms_boundaries():
    assert MT.egyptian_term(0.0) == 'Jupiter' and MT.egyptian_term(5.99) == 'Jupiter' and MT.egyptian_term(6.0) == 'Venus'
    assert MT.egyptian_term(359.99) == 'Saturn' and MT.egyptian_term(240.0) == 'Jupiter'
    for sign in MT.EGYPTIAN_TERMS:
        assert sign[-1][0] == 30


def test_star_names_all_resolve():
    assert len(MT._star_positions(START)) == len(MT.STAR_NATURES)


def test_weather_table_in_mundane_cycles():
    res = build_mundane_cycles({'date': '2025/03/20', 'time': '09:01:00', 'zone': '+00:00', 'lat': '51n30', 'lon': '0w07', 'hsys': 3,
                                'table': 'weather', 'weatherMonths': 6, 'targetDate': '2026/01/01'})
    assert res['weatherMonths'] == 6 and 11 <= len(res['rows']) <= 13
    assert build_mundane_cycles({'table': 'weather', 'weatherMonths': 99, 'date': '2025/03/20', 'time': '09:01:00', 'zone': '+00:00',
                                 'lat': '51n30', 'lon': '0w07'})['weatherMonths'] == 3


def test_near_greatest_elongation_is_judged_against_this_apparition():
    """2024-03-24 水星东大距只有 18.7°:改进档按本次大距判「近最大距角」,经典档按常数 27.8° 判不到。"""
    import swisseph
    from astrostudy import meteorology as W
    jd = swisseph.julday(2024, 3, 24, 12.0)
    assert 18.0 < W.apparition_max_elongation('Mercury', jd) < 19.5
    armc = swisseph.houses_ex(jd, 39.9, 116.4, b'W')[1][2]
    assert 'ELONG' in W.lord_conditions('Mercury', jd, 39.9, 116.4, armc)['conditions']
    assert 'ELONG' not in W.lord_conditions('Mercury', jd, 39.9, 116.4, armc, classic=True)['conditions']


def test_improved_star_table_adds_the_first_magnitude_stars():
    from astrostudy import meteorology as W
    improved, classic = W.star_natures(False), W.star_natures(True)
    assert {'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Sirius', 'Arcturus'} <= set(improved)
    assert 'Aldebaran' not in classic and len(classic) == 61
    assert improved['Alcyone'] == ('Moon', 'Jupiter')                  # 《四书》I.9:昴星团如月与木星
    assert improved['Algol'] == classic['Algol'] == ('Jupiter', 'Saturn')  # 英仙座整体如木星与土星,原表即是
