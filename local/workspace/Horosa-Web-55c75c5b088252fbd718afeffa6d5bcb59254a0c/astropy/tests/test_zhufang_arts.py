import json
import os

import pytest
import swisseph

from astrostudy import zhufang_arts as Z

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20', hsys=3)


def test_gate_wheel_starts_with_41_at_aquarius_2():
    assert sorted(Z.GATE_WHEEL) == list(range(1, 65))
    assert Z.gate_line(302.0) == (41, 1)
    assert Z.gate_line(302.0 + 5.625 - 1e-9) == (41, 6)
    assert Z.gate_line(302.0 + 5.625) == (19, 1)
    assert Z.gate_line(301.999) == (60, 6)


def test_every_channel_gate_belongs_to_a_center_and_centers_cover_64_gates():
    assert sorted(g for gates in Z.CENTERS.values() for g in gates) == list(range(1, 65))
    assert len(Z.CHANNELS) == 36
    for a, b in Z.CHANNELS:
        assert Z.CENTER_OF[a] != Z.CENTER_OF[b]


def test_design_time_is_88_degrees_of_sun_before_birth():
    hd = Z.human_design(BASE)
    sun_birth = swisseph.calc_ut(hd['birthJd'], swisseph.SUN, swisseph.FLG_SWIEPH)[0][0]
    sun_design = swisseph.calc_ut(hd['designJd'], swisseph.SUN, swisseph.FLG_SWIEPH)[0][0]
    assert (sun_birth - sun_design) % 360 == pytest.approx(88.0, abs=1e-6)
    assert 85 < hd['birthJd'] - hd['designJd'] < 93


def test_profile_and_cross_come_from_the_suns_and_earths():
    hd = Z.human_design(BASE)
    p = {r['id']: r for r in hd['personality']}
    d = {r['id']: r for r in hd['design']}
    assert hd['profile'] == [p['Sun']['line'], d['Sun']['line']]
    assert hd['cross'] == [p['Sun']['gate'], p['Earth']['gate'], d['Sun']['gate'], d['Earth']['gate']]
    assert p['Earth']['lon'] == pytest.approx((p['Sun']['lon'] + 180) % 360)
    assert p['South Node']['lon'] == pytest.approx((p['North Node']['lon'] + 180) % 360)
    assert len(hd['personality']) == 13 and len(hd['design']) == 13


def test_channels_are_exactly_the_pairs_both_activated():
    hd = Z.human_design(BASE)
    gates = set(hd['gates'])
    expect = [[a, b] for a, b in Z.CHANNELS if a in gates and b in gates]
    assert [c['gates'] for c in hd['channels']] == expect
    assert set(hd['defined']) == {c for ch in hd['channels'] for c in ch['centers']}


def test_mean_node_option_changes_only_the_nodes():
    a = Z.human_design(dict(BASE, hdTrueNode=True))
    b = Z.human_design(dict(BASE, hdTrueNode=False))
    for ra, rb in zip(a['personality'], b['personality']):
        if 'Node' in ra['id']:
            continue
        assert ra['lon'] == pytest.approx(rb['lon'])
    assert a['personality'][2]['lon'] != pytest.approx(b['personality'][2]['lon'])


@pytest.mark.parametrize('defined_channels, expected', [
    ([], 'reflector'),
    ([(34, 20)], 'manifestingGenerator'),      # 荐骨直连喉
    ([(5, 15)], 'generator'),                   # 荐骨有定义、不连喉
    ([(21, 45)], 'manifestor'),                 # 心直连喉,荐骨无定义
    ([(1, 8)], 'projector'),                    # G 连喉,无动力中心
])
def test_type_rules(monkeypatch, defined_channels, expected):
    gates = [g for ch in defined_channels for g in ch]
    rows = [{'id': n, 'lon': 0.0, 'gate': gates[i] if i < len(gates) else 999, 'line': 1, 'center': None} for i, n in enumerate(Z.HD_POINTS)]
    monkeypatch.setattr(Z, '_activations', lambda lons: rows)
    assert Z.human_design(BASE)['type'] == expected


def test_letter_cycle_counts_degrees_from_the_ascendant():
    assert Z.letter_index(10.5, 10.2) == 22            # 同度 → 0 → 22
    assert Z.letter_index(11.0, 10.9) == 1
    assert Z.letter_index(5.0, 350.0) == (15 % 22)      # 跨 0° 白羊:从上升起数 15 度
    assert Z.letter(1)['name'] == 'Aleph' and Z.letter(22)['name'] == 'Tav'


def test_degree_almuten_scores():
    # 白羊 1°:守火 1、旺日 1、三分主日木土各 1、埃及界木 2 → 木 3、日 2
    planet, score = Z.degree_almuten(1.0)
    assert (planet, score) == ('Jupiter', 3)


GOLDEN = json.load(open(os.path.join(HERE, 'data', 'golden_spirit_names.json'), encoding='utf-8'))


@pytest.mark.parametrize('case', GOLDEN['cases'], ids=lambda c: c['datetime'] + c['lon'])
def test_spirit_names_golden(case):
    date, time = case['datetime'].split(' ')
    result = Z.spirit_names(dict(date=date, time=time, zone=GOLDEN['zone'], lat=GOLDEN['lat'], lon=case['lon'],
                                 hsys=GOLDEN['hsys'], spiritQuadrant=case['quadrant']))
    if 'ibnEzra' in case:
        assert [row['letter']['index'] for row in result['ibnEzra']] == case['ibnEzra']
    if 'quadrantLetters' in case:
        assert [row['letter']['index'] for row in result['quadrantRows']] == case['quadrantLetters']


def test_endpoint_survives_bad_input():
    out = Z.build_zhufang({'date': 'bogus'})
    assert out['humanDesign'] is None and out['spiritNames'] is None
