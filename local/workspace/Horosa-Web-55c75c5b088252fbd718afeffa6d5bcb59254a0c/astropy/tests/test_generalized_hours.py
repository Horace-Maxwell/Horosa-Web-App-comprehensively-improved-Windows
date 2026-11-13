# -*- coding: utf-8 -*-
"""广义行星时相位:两档时位、相位门限、整盘输出。"""
import json
import math
import os
import random

import pytest
import swisseph
from flatlib import const

from astrostudy import generalized_hours as G

GOLD = json.load(open(os.path.join(os.path.dirname(__file__), 'data', 'golden_generalized_hours.json'), encoding='utf-8'))


@pytest.mark.parametrize('h1, d1, h2, d2, lat, gap', GOLD)
def test_classic_gap_matches_the_golden(h1, d1, h2, d2, lat, gap):
    assert G.hour_gap(G.hour_classic(h1, d1, lat), G.hour_classic(h2, d2, lat)) == pytest.approx(gap, abs=0.01)


@pytest.mark.parametrize('hour_of', [G.hour_improved, G.hour_classic])
def test_meridian_points_are_six_and_eighteen(hour_of):
    assert hour_of(0.0, 10.0, 40.0) == pytest.approx(6.0, abs=1e-6)
    assert hour_of(180.0, 10.0, 40.0) == pytest.approx(18.0, abs=1e-6)


def test_improved_is_proportional_on_the_semi_arc():
    day = G._day_semi_arc(40.0, 10.0)
    assert G.hour_improved(day / 2.0, 10.0, 40.0) == pytest.approx(9.0, abs=1e-9)
    assert G.hour_improved(-day / 2.0, 10.0, 40.0) == pytest.approx(3.0, abs=1e-9)
    night = 180.0 - day
    assert G.hour_improved(180.0 - night / 2.0, 10.0, 40.0) == pytest.approx(15.0, abs=1e-9)
    assert G.hour_improved(-180.0 + night / 2.0, 10.0, 40.0) == pytest.approx(21.0, abs=1e-9)


@pytest.mark.parametrize('hour_of', [G.hour_improved, G.hour_classic])
def test_equator_is_uniform(hour_of):
    for angle in (-150.0, -60.0, 30.0, 120.0):
        assert hour_of(angle, 15.0, 0.0) == pytest.approx((6.0 + angle / 15.0) % 24.0, abs=1e-6)


def test_the_two_variants_really_differ_off_the_equator():
    assert abs(G.hour_improved(45.0, 20.0, 50.0) - G.hour_classic(45.0, 20.0, 50.0)) > 0.01


def test_gap_wraps_around_the_day():
    assert G.hour_gap(23.0, 1.0) == pytest.approx(2.0)
    assert G.hour_gap(1.0, 23.0) == pytest.approx(2.0)
    assert G.hour_gap(0.0, 12.0) == pytest.approx(12.0)


@pytest.mark.parametrize('gap, degrees', [(0.5, 0), (3.5, 60), (4.9, 60), (5.5, 90), (6.0, 90), (8.2, 120), (11.5, 180)])
def test_aspect_hits_inside_one_hour(gap, degrees):
    assert G.aspect_of(gap)[0] == degrees


@pytest.mark.parametrize('gap', [1.5, 2.5, 3.0, 9.5, 10.5])
def test_aspect_misses_outside_one_hour(gap):
    assert G.aspect_of(gap) is None


def test_build_lists_every_pair_once():
    jd = swisseph.julday(1975, 2, 11, 5.25)
    result = G.build_hour_aspects(jd, 47.6, -122.33)
    assert len(result['bodies']) == 11
    assert len(result['pairs']) == 55
    assert len({(row['a'], row['b']) for row in result['pairs']}) == 55
    assert all(0.0 <= row['gap'] <= 12.0 for row in result['pairs'])
    assert any(row['aspect'] is not None for row in result['pairs'])


def test_unknown_variant_falls_back():
    jd = swisseph.julday(1975, 2, 11, 5.25)
    assert G.build_hour_aspects(jd, 47.6, -122.33, 'nope')['variant'] == 'improved'


def test_polar_latitude_still_gives_numbers():
    jd = swisseph.julday(2000, 12, 21, 12.0)
    result = G.build_hour_aspects(jd, 78.2, 15.6, 'classic')
    assert all(0.0 <= row['hour'] < 24.0 for row in result['bodies'])
    assert all(row['hour'] == row['hour'] for row in G.build_hour_aspects(jd, 78.2, 15.6)['bodies'])


JD = swisseph.julday(1975, 2, 11, 5.25)


def _reduced(hour_angle, dec, lat):
    tan_dec = math.tan(math.radians(dec))
    if abs(hour_angle) < G._day_semi_arc(lat, dec):
        return 6.0, hour_angle, tan_dec
    return 18.0, G._wrap(hour_angle - 180.0), -tan_dec


@pytest.mark.parametrize('lat', [30.0, 47.6, 55.0, 60.0, 65.0, 70.0, 80.0, -60.0, -33.9])
def test_classic_is_a_root_inside_the_semi_arc(lat):
    state = random.Random(7)
    for _ in range(400):
        hour_angle, dec = state.uniform(-180.0, 180.0), state.uniform(-23.4, 23.4)
        base, reduced, tan_reduced = _reduced(hour_angle, dec, lat)
        estimate = G._wrap((G.hour_classic(hour_angle, dec, lat) - base) * 15.0)
        assert abs(estimate) <= 90.0 + 1e-6
        assert abs(estimate - reduced + G._clamped_asin(tan_reduced * math.tan(math.radians(lat) * estimate / 90.0))) < 1e-6


def test_classic_picks_the_physical_root_at_high_latitude():
    # 60.17°、时角 42.75、赤纬 −23.80:半弧外的假根是 5.84 时,真根约 12.07 时,改进档 12.13
    assert G.hour_classic(42.75, -23.80, 60.17) == pytest.approx(12.073, abs=0.01)


@pytest.mark.parametrize('lat', [0.0, 20.0, 47.6, 50.0, -47.6])
def test_classic_is_continuous_below_the_polar_band(lat):
    for dec in (-23.4, -10.0, 0.0, 10.0, 23.4):
        hours = [G.hour_classic(float(value), dec, lat) for value in range(-180, 181)]
        for first, second in zip(hours, hours[1:]):
            assert abs((first - second + 12.0) % 24.0 - 12.0) < 1.0


def _independent_row(name, body):
    armc = swisseph.houses_ex(JD, 47.6, -122.33, b'O')[1][2]
    ra, dec = swisseph.calc_ut(JD, body, swisseph.FLG_EQUATORIAL | swisseph.FLG_SWIEPH)[0][:2]
    hour_angle = (armc - ra + 180.0) % 360.0 - 180.0
    return hour_angle, dec


@pytest.mark.parametrize('variant, formula', [('improved', G.hour_improved), ('classic', G.hour_classic)])
def test_each_body_uses_its_real_hour_angle_and_the_chosen_variant(variant, formula):
    table = G.build_hour_aspects(JD, 47.6, -122.33, variant)
    assert table['variant'] == variant
    for row, (name, body) in zip(table['bodies'], G.BODIES):
        hour_angle, dec = _independent_row(name, body)
        assert row['id'] == name
        assert row['hourAngle'] == pytest.approx(hour_angle, abs=1e-6)
        assert row['dec'] == pytest.approx(dec, abs=1e-6)
        assert row['hour'] == pytest.approx(formula(hour_angle, dec, 47.6), abs=1e-9)


def test_variants_differ_on_a_real_chart():
    improved = G.build_hour_aspects(JD, 47.6, -122.33, 'improved')['bodies']
    classic = G.build_hour_aspects(JD, 47.6, -122.33, 'classic')['bodies']
    assert max(abs(a['hour'] - b['hour']) for a, b in zip(improved, classic)) > 0.01


def test_hour_runs_from_the_ascendant_through_the_midheaven():
    # 上中天时位 6;时角为负在东方,时位小于 6;过中天后大于 6
    assert G.hour_improved(0.0, 10.0, 47.6) == pytest.approx(6.0)
    assert G.hour_improved(-30.0, 10.0, 47.6) < 6.0 < G.hour_improved(30.0, 10.0, 47.6)
    assert G.hour_improved(180.0, 10.0, 47.6) == pytest.approx(18.0)


def test_pairs_report_gap_aspect_and_orb():
    table = G.build_hour_aspects(JD, 47.6, -122.33)
    hours = {row['id']: row['hour'] for row in table['bodies']}
    assert len(table['pairs']) == 55
    for pair in table['pairs']:
        gap = abs((hours[pair['a']] - hours[pair['b']] + 12.0) % 24.0 - 12.0)
        assert pair['gap'] == pytest.approx(gap)
        hit = G.aspect_of(gap)
        assert pair['aspect'] == (hit[0] if hit else None)
        assert pair['orb'] == (hit[1] if hit else None)


@pytest.mark.parametrize('gap, aspect, orb', [(0.5, 0, 0.5), (3.5, 60, 0.5), (6.9, 90, 0.9), (8.2, 120, 0.2), (11.5, 180, 0.5), (2.0, None, None), (10.0, None, None)])
def test_aspect_windows(gap, aspect, orb):
    hit = G.aspect_of(gap)
    if aspect is None:
        assert hit is None
    else:
        assert hit[0] == aspect and hit[1] == pytest.approx(orb)


def test_node_follows_the_requested_type():
    mean = G.build_hour_aspects(JD, 47.6, -122.33, true_node=False)['bodies'][-1]
    true = G.build_hour_aspects(JD, 47.6, -122.33, true_node=True)['bodies'][-1]
    assert mean['id'] == true['id'] == const.NORTH_NODE and mean['dec'] != true['dec']
    ra = swisseph.calc_ut(JD, swisseph.MEAN_NODE, swisseph.FLG_EQUATORIAL | swisseph.FLG_SWIEPH)[0][0]
    armc = swisseph.houses_ex(JD, 47.6, -122.33, b'O')[1][2]
    assert mean['hourAngle'] == pytest.approx((armc - ra + 180.0) % 360.0 - 180.0, abs=1e-6)
