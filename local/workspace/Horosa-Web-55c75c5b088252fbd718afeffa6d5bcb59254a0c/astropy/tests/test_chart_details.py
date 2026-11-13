# -*- coding: utf-8 -*-
"""盘面细节表:手算值、构造的星位,以及几张固定盘的全表金标。"""
import json
import os

import pytest

from astrostudy import chart_details as C
from astrostudy import directed_figures as D
from astrostudy.directed_figures import SEVEN, norm360
from win_float_golden import golden_equal   # horosa_win_float_golden_v1

CHART = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'gpsLat': 47.6, 'gpsLon': -122.333, 'hsys': 3}
DAY_CHART = dict(CHART, time='12:00:00')
POLAR = dict(CHART, lat='70n00', gpsLat=70.0)
POLAR_NIGHT = dict(CHART, date='1975/12/21', lat='78n00', gpsLat=78.0)
EQUAL_CUSPS = [i * 30.0 for i in range(12)]


def view(lons=None, speeds=None, asc=0.0, mc=270.0, day=True, faces='chaldean', cusps=None):
    """构造盘:未给的星放在互不成相位的位置。"""
    item = C.ChartView.__new__(C.ChartView)
    item.faces = faces
    item.lons = dict(zip(SEVEN, (10.0, 41.0, 70.0, 95.0, 131.0, 163.0, 197.0)))
    item.lons.update(lons or {})
    item.speeds = dict.fromkeys(SEVEN, 1.0)
    item.speeds.update(speeds or {})
    item.asc = asc
    item.mc = mc
    item.cusps = cusps or EQUAL_CUSPS
    item.day = day
    item.fortune = norm360(asc + item.lons['Moon'] - item.lons['Sun']) if day else norm360(asc + item.lons['Sun'] - item.lons['Moon'])
    item.spirit = norm360(2.0 * asc - item.fortune)
    item.frame = {'jd': 2451545.0, 'points': {'North Node': {'lon': 222.0}}}
    item.node = 222.0
    item.sect_light = 'Sun' if day else 'Moon'
    item.other_light = 'Moon' if day else 'Sun'
    return item


def row_of(rows, name, key='planet'):
    return next(row for row in rows if row[key] == name)


def test_faces_chaldean_and_element():
    assert C.face_of(5.0, 'chaldean') == 'Mars' and C.face_of(25.0, 'chaldean') == 'Venus'
    assert C.face_of(25.0, 'element') == 'Jupiter'
    assert C.face_of(135.0, 'element') == 'Sun'       # 狮子第二面,四火象同一组
    assert C.face_of(95.0, 'element') == 'Moon'


def test_house_ahead_moves_the_cusp_back_five_degrees():
    assert C.house_of(27.0, EQUAL_CUSPS) == 1 and C.house_ahead(27.0, EQUAL_CUSPS) == 2
    assert C.house_ahead(24.0, EQUAL_CUSPS) == 1


def test_eminence_lists_twenty_tests_in_order():
    rows = C.eminence_rows(view())
    assert [row['id'] for row in rows] == list(range(1, 21))
    assert rows[0]['test'] == '福点主落福点起第十座' and rows[4]['test'] == '福点主入本座' and rows[5]['test'] == '福点主落灵点所在座'
    assert rows[-1]['test'] == '基点主落旺点所在座'


def test_eminence_points_follow_sect():
    day = C.eminence_points(view(asc=100.0, lons={'Sun': 300.0, 'Moon': 40.0}, day=True))
    night = C.eminence_points(view(asc=100.0, lons={'Sun': 300.0, 'Moon': 40.0}, day=False))
    assert day['E'] == norm360(100.0 + 19.0 - 300.0)
    assert night['E'] == norm360(100.0 + 33.0 - 40.0)
    assert day['F'] == night['S'] and day['S'] == night['F']


def test_eminence_hit_for_lord_in_tenth_from_fortune():
    item = view(lons={'Sun': 0.5, 'Moon': 10.5, 'Mars': 275.0})
    rows = C.eminence_rows(item)
    assert C.lord_of(item.fortune) == 'Mars' and rows[0]['hit'] is True


def test_persian_scores_by_hand():
    item = view(lons={'Sun': 5.0}, asc=0.0)       # 太阳白羊 5°:旺 4,三分 2,面 0,第 1 宫 12
    row = row_of(C.persian_rows(item), 'Sun')
    assert (row['ruler'], row['exalt'], row['term'], row['triplicity'], row['face'], row['place']) == (0, 4, 0, 2, 0, 12)
    assert row['sum'] == 18


def test_dispositor_chain_stops_at_a_self_ruler_and_writes_a_repeat():
    lons = dict(zip(SEVEN, (5.0, 95.0, 65.0, 35.0, 5.0, 245.0, 275.0)))
    assert C.dispositor_chain('Sun', lons) == (['Sun', 'Mars'], 'self')     # 火在白羊自守
    lons['Mars'] = 125.0
    assert C.dispositor_chain('Sun', lons) == (['Sun', 'Mars', 'Sun'], 'loop')
    assert C.dispositor_chain('Saturn', lons) == (['Saturn'], 'self')


def test_final_dispositor_needs_every_planet_to_end_on_one_self_ruler():
    same = [{'chain': ['Sun', 'Mars'], 'end': 'self'}, {'chain': ['Moon', 'Mars'], 'end': 'self'}]
    assert C.final_dispositor(same) == 'Mars'
    assert C.final_dispositor(same + [{'chain': ['Venus', 'Venus'], 'end': 'self'}]) is None
    assert C.final_dispositor(same + [{'chain': ['Sun', 'Mars', 'Sun'], 'end': 'loop'}]) is None


@pytest.mark.parametrize('name,elongation,ratio,hours,phase', [
    ('Mars', -5.0, 1.0, 1.0, 2), ('Mars', 10.0, 1.0, 1.0, 15), ('Mars', -30.0, 1.2, 2.0, 4), ('Mars', -60.0, 1.0, 5.0, 5), ('Mars', -90.0, 1.0, 7.0, 6),
    ('Mars', -130.0, 0.01, 8.0, 7), ('Mars', -150.0, -0.5, 9.0, 8), ('Mars', 179.9, -0.5, 12.0, 9), ('Mars', 150.0, -0.5, 9.0, 10), ('Mars', 130.0, 0.01, 8.0, 11),
    ('Mars', 90.0, 1.0, 7.0, 12), ('Mars', 60.0, 1.0, 5.0, 13), ('Mars', 30.0, 1.0, 2.0, 14), ('Mars', 0.1, 1.0, 0.1, 1),
    ('Venus', 0.1, -1.0, 0.1, 1), ('Venus', 0.1, 1.0, 0.1, 9), ('Venus', -5.0, -1.0, 1.0, 2), ('Venus', -30.0, -0.5, 2.0, 4), ('Venus', -30.0, 0.01, 2.0, 5),
    ('Venus', -30.0, 1.0, 2.0, 6), ('Venus', -10.0, 1.0, 1.0, 7), ('Venus', -5.0, 1.0, 1.0, 8), ('Venus', 5.0, 1.0, 1.0, 10), ('Venus', 10.0, 1.0, 1.0, 11),
    ('Venus', 30.0, 1.0, 2.0, 12), ('Venus', 30.0, 0.01, 2.0, 13), ('Venus', 30.0, -0.5, 2.0, 14), ('Venus', 10.0, -0.5, 1.0, 15), ('Venus', 5.0, -0.5, 1.0, 16),
])
def test_sun_phase(name, elongation, ratio, hours, phase):
    assert C.sun_phase(name, elongation, ratio, hours) == phase


def test_time_position_on_the_horizon_and_meridian():
    assert abs(C.time_position(100.0, 0.0, 100.0, 40.0) - 6.0) < 1e-9
    assert abs(C.time_position(100.0, 0.0, 10.0, 40.0) % 24.0) < 1e-9
    assert abs(C.time_position(100.0, 0.0, 190.0, 40.0) - 12.0) < 1e-9
    assert abs(C.time_position(100.0, 0.0, 280.0, 40.0) - 18.0) < 1e-9


def test_sun_phase_rows_carry_the_extras():
    rows = C.build_chart_details(CHART)['sunPhases']
    mercury = row_of(rows, 'Mercury')
    assert mercury['phase'] == 2 and mercury['grade'] == 'combust' and mercury['sacred'] == 'sacred' and mercury['beams'] == 'emerges'
    assert mercury['nextTurn'] == 'direct' and mercury['nextStation'].startswith('1975-02-2')
    saturn = row_of(rows, 'Saturn')
    assert saturn['phase'] == 10 and saturn['cardan'] == 4 and saturn['currens'] == 'recurrens'


def test_sect_columns():
    item = view(lons={'Sun': 280.0, 'Jupiter': 310.0, 'Saturn': 5.0, 'Moon': 100.0}, asc=0.0, day=True)
    rows = C.sect_rows(item)
    jupiter = row_of(rows, 'Jupiter')
    assert jupiter['horizon'] and jupiter['sign'] and jupiter['quadrant'] and jupiter['hayz'] and not jupiter['ex']
    assert row_of(rows, 'Sun')['east'] is True
    assert row_of(rows, 'Sun')['triplicity'] == ['Venus', 'Moon', 'Mars']


def test_almugea_counts_signs_across_aries_unless_classic():
    item = view(lons={'Sun': 350.0, 'Moon': 100.0, 'Mercury': 10.0})        # 水星白羊、太阳双鱼,隔一座
    assert C.almugea(item, 'Mercury', False) is True
    assert C.almugea(item, 'Mercury', True) is False


def test_dustoria_needs_a_night_chart_and_the_moon_four_houses_on():
    item = view(lons={'Mars': 5.0, 'Moon': 125.0}, day=False)
    assert C.dustoria(item, 'Mars') is True
    item.day = True
    assert C.dustoria(item, 'Mars') is False


def test_reception_types():
    item = view(lons={'Sun': 5.0, 'Mars': 125.0, 'Moon': 40.0, 'Venus': 100.0})
    rows = C.reception_rows(item)
    assert {'type': 1, 'name': '守护互容', 'a': 'Sun', 'b': 'Mars'} in rows
    assert any(row['type'] == 9 and {row['a'], row['b']} == {'Mercury', 'Jupiter'} for row in C.reception_rows(view(lons={'Mercury': 65.0, 'Jupiter': 95.0})))
    assert any(row['type'] == 10 and {row['a'], row['b']} == {'Mercury', 'Jupiter'} for row in C.reception_rows(view(lons={'Mercury': 5.0, 'Jupiter': 335.0})))


def test_exile_and_fall_receptions_are_separate():
    exile = C.reception_rows(view(lons={'Sun': 95.0, 'Saturn': 305.0}))      # 日在土星陷的巨蟹,土在太阳陷的宝瓶
    fall = C.reception_rows(view(lons={'Sun': 5.0, 'Saturn': 185.0}))        # 日在土星落的白羊,土在太阳落的天秤
    assert any(row['type'] == 6 and {row['a'], row['b']} == {'Sun', 'Saturn'} for row in exile)
    assert not any(row['type'] == 7 and {row['a'], row['b']} == {'Sun', 'Saturn'} for row in exile)
    assert any(row['type'] == 7 and {row['a'], row['b']} == {'Sun', 'Saturn'} for row in fall)
    assert not any(row['type'] == 6 and {row['a'], row['b']} == {'Sun', 'Saturn'} for row in fall)


def test_applying_follows_the_faster_body():
    item = view(lons={'Mars': 100.0, 'Saturn': 110.0}, speeds={'Mars': 0.5, 'Saturn': 0.1})
    assert C.approaching(item, 'Mars', 'Saturn', 0)
    assert not C.approaching(item, 'Saturn', 'Mars', 180)
    item.lons['Mars'] = 115.0
    assert not C.approaching(item, 'Mars', 'Saturn', 0)


def test_hayz_needs_all_three_conditions():
    item = view(lons={'Sun': 305.0, 'Jupiter': 310.0}, asc=0.0, day=True)
    assert C.in_hayz(item, 'Sun') and C.in_hayz(item, 'Jupiter')
    item.day = False
    assert not C.in_hayz(item, 'Sun') and not C.in_hayz(item, 'Jupiter')


def test_advance_and_retreat_cover_every_planet():
    rows = {row['id']: row['items'] for row in C.relation_rows(view())}
    assert sorted(rows[2] + rows[3]) == sorted(SEVEN) and sorted(rows[4] + rows[5]) == sorted(SEVEN)


def test_mutual_rulers_use_the_aspect_of_the_sign_distance():
    lons = {'Sun': 5.0, 'Mars': 125.0}                                  # 拱,差 0
    assert (('Sun', 'Mars') in C.mutual_ruler_pairs(view(lons=lons))[8])
    lons = {'Sun': 29.0, 'Mars': 121.0}                                 # 座差 4,实距 92°,离 120° 太远,不能按刑算
    assert (('Sun', 'Mars') in C.mutual_ruler_pairs(view(lons=lons))[9])
    item = {'Saturn': 5.0, 'Mars': 275.0}                               # 座差 3,不看容许度,算慷慨
    assert (('Mars', 'Saturn') in C.mutual_ruler_pairs(view(lons=item))[10])


def test_pushing_nature_records_only_applying_pairs():
    item = view(lons={'Mars': 200.0, 'Venus': 205.0}, speeds={'Mars': 0.7, 'Venus': 0.2})       # 火在天秤,金是座主
    assert ('Mars', 'Venus') in C.pushing_nature_pairs(item)
    item.speeds = dict(item.speeds, Mars=0.1, Venus=1.2)
    assert ('Mars', 'Venus') not in C.pushing_nature_pairs(item)


def test_pushing_power_needs_own_dignity_and_application():
    item = view(lons={'Mars': 5.0, 'Jupiter': 9.0}, speeds={'Mars': 0.7, 'Jupiter': 0.1})
    assert ('Mars', 'Jupiter') in C.pushing_power_pairs(item)
    item.lons['Mars'] = 65.0
    item.lons['Jupiter'] = 69.0
    assert ('Mars', 'Jupiter') not in C.pushing_power_pairs(item)


def test_consideration_hour_lord_relation():
    assert C.hour_lord_related('Mars', 'Mars', 5.0) and C.hour_lord_related('Jupiter', 'Mars', 5.0)
    assert C.hour_lord_related('Mercury', 'Venus', 40.0) and C.hour_lord_related('Sun', 'Mars', 5.0)
    assert not C.hour_lord_related('Venus', 'Mars', 5.0)


def test_considerations_by_construction():
    item = view(lons={'Moon': 205.0, 'Saturn': 2.0}, asc=2.0)
    hits = {row['id']: row['hit'] for row in C.consideration_rows(item, 'Mars')}
    assert hits[2] and hits[5] and hits[7]
    assert not hits[3] and not hits[4]


def test_moon_void_of_course():
    busy = view(lons={'Moon': 5.0, 'Sun': 15.0}, speeds={'Moon': 13.0, 'Sun': 1.0})
    assert C.moon_void(busy) is False
    lons = {'Moon': 29.5, 'Sun': 60.0, 'Mercury': 62.0, 'Venus': 64.0, 'Mars': 66.0, 'Jupiter': 68.0, 'Saturn': 69.0}
    assert C.moon_void(view(lons=lons, speeds={'Moon': 13.0})) is True


def test_slavery_rows():
    item = view(lons={'Sun': 65.0, 'Moon': 155.0, 'Saturn': 5.0, 'Mars': 275.0})
    rows = {row['id']: row['planets'] for row in C.slavery_rows(item)}
    assert rows[1] == ['Sun'] and rows[2] == ['Moon']       # 第 3、6 宫
    assert 'Saturn' in rows[4] and 'Mars' in rows[4]
    assert len(rows) == 9


def test_hellenistic_predominator_order():
    good = view(lons={'Sun': 280.0, 'Moon': 40.0}, day=True)        # 第 10 宫、第 2 宫
    assert C.hellenistic_row(good)['predominator'] == 'Sun'
    assert C.hellenistic_row(view(lons={'Sun': 65.0, 'Moon': 40.0}, day=True))['predominator'] == 'Moon'
    assert C.hellenistic_row(view(lons={'Sun': 65.0, 'Moon': 155.0}, day=True))['predominator'] == 'Asc'


def test_accidental_house_points_use_the_five_degree_rule():
    assert C.accidental_rows(view(lons={'Saturn': 27.0}))[6]['house'] == 3      # 提前 5° 落第 2 宫
    assert C.accidental_rows(view(lons={'Saturn': 24.0}))[6]['house'] == 5


def test_accidental_points_by_hand():
    item = view(lons={'Sun': 100.0, 'Venus': 105.0, 'Mars': 300.0}, speeds={'Mars': -0.5, 'Venus': 1.3, 'Sun': 1.0})
    rows = {row['planet']: row for row in C.accidental_rows(item)}
    assert rows['Mars']['retro'] == -5 and rows['Mars']['speed'] == -2
    assert rows['Venus']['sun'] == -5 and rows['Venus']['speed'] == 2
    assert rows['Sun']['retro'] == 0 and rows['Sun']['sun'] == 0
    assert rows['Moon']['moonlight'] == -2 if norm360(item.lons['Moon'] - 100.0) > 180.0 else 2


def test_sun_points():
    assert [C.sun_points(gap) for gap in (0.1, 0.3, 8.5, 8.6, 17.0, 17.1)] == [5, -5, -5, -4, -4, 0]


def test_partile_opposition_and_node_points():
    rows = {row['planet']: row for row in C.accidental_rows(view(lons={'Venus': 100.5, 'Saturn': 280.2}))}
    assert rows['Venus']['partile'] == -4
    item = view(lons={'Jupiter': 222.7})
    assert {row['planet']: row for row in C.accidental_rows(item)}['Jupiter']['partile'] == 4
    item.lons['Jupiter'] = 42.7
    assert {row['planet']: row for row in C.accidental_rows(item)}['Jupiter']['partile'] == -4


def test_royal_stars():
    item = view(lons={'Mars': 56.0})
    star = C.swisseph.fixstar2_ut('Regulus', item.frame['jd'], C.swisseph.FLG_SWIEPH)[0][0]
    assert C.royal_star_points(item, 'Mars') == -5                      # 大陵五 5° 内
    item.lons['Mars'] = star
    assert C.royal_star_points(item, 'Mars') == 6
    item.lons['Mars'] = star + 1.5
    assert C.royal_star_points(item, 'Mars') == 0                       # 轩辕十四要同度


def test_besieged_needs_the_nearer_malefic_in_orb():
    assert C.besieged(view(lons={'Venus': 100.0, 'Mars': 94.0, 'Saturn': 150.0}), 'Venus')
    assert not C.besieged(view(lons={'Venus': 100.0, 'Mars': 80.0, 'Saturn': 150.0}), 'Venus')
    assert not C.besieged(view(lons={'Venus': 100.0, 'Mars': 104.0, 'Saturn': 150.0}), 'Venus')
    assert not C.besieged(view(lons={'Mars': 94.0, 'Saturn': 150.0}), 'Mars')


def test_partile_needs_the_same_whole_degree():
    assert C.partile(95.2, 185.9, 90)
    assert not C.partile(95.2, 186.1, 90)
    assert not C.partile(29.5, 30.5, 0)


def test_direct_points_differ_only_in_classic():
    item = view(lons={'Mercury': 20.0, 'Sun': 22.0}, speeds={'Mercury': 2.0, 'Sun': 1.0})
    assert C.direct_points(item, 'Mercury', False) == 4
    assert C.direct_points(item, 'Mercury', True) == 0


def test_geniture_is_the_highest_total():
    assert C.lord_of_geniture([{'planet': 'Sun', 'sum': 3}, {'planet': 'Moon', 'sum': 9}]) == 'Moon'


def test_temperament_types_differ_between_the_two_rules():
    item = view(lons={'Sun': 100.0, 'Moon': 190.0, 'Mars': 5.0}, asc=5.0)       # 五票全是热干
    kind, votes = C.temperament_type(item, 'Mars', True)
    assert votes == [(1, -1)] * 5
    assert kind == 1                                                    # 经典比热对干:5 不小于 5,判多血
    assert C.temperament_type(item, 'Mars')[0] == 2                     # 缺省干多于湿:胆汁


def test_temperament_cusp_weight():
    plain = view(lons={'Mercury': 75.0}, asc=0.0)
    near = view(lons={'Mercury': 62.0}, asc=0.0)                        # 第 3 宫头 4.5° 内
    near.lons['Mercury'] = 60.5
    assert C.temperament_scores(near, 'Mars') != C.temperament_scores(plain, 'Mars')


def test_temperament_vote_fills_the_missing_quality_from_the_sign():
    item = view(lons={'Sun': 100.0, 'Venus': 130.0})        # 金星西入、狮子:只有湿,缺的热冷取火象
    assert C.planet_own_quality(item, 'Venus') == (0, 1)
    assert C.vote_quality(item, 'Venus') == (1, 1)


def test_topic_two_adds_house_points_and_the_day_and_hour_lords():
    item = view()
    syzygy = {'sun': 0.0, 'moon': 0.0}
    base = {row['id']: row for row in C.topical_rows(item, syzygy, 'Sun', 'Moon')}[2]['scores']
    swapped = {row['id']: row for row in C.topical_rows(item, syzygy, 'Moon', 'Sun')}[2]['scores']
    assert base['Sun'] - swapped['Sun'] == 7 - 6
    assert base['Moon'] - swapped['Moon'] == 6 - 7


def test_topics_moon_adds_two_to_the_third_triplicity_lord():
    item = view(lons={'Moon': 5.0})
    row = {r['id']: r for r in C.topical_rows(item, {'sun': 0.0, 'moon': 0.0}, 'Sun', 'Sun')}[14]
    assert row['scores'] == {'Sun': 2, 'Moon': 0, 'Mercury': 0, 'Venus': 0, 'Mars': 1, 'Jupiter': 2, 'Saturn': 3}


def test_topics_objects_subtract_exile_and_fall():
    item = view(lons={'Saturn': 5.0, 'Venus': 215.0})     # 土星落白羊,金星陷天蝎
    row = {r['id']: r for r in C.topical_rows(item, {'sun': 0.0, 'moon': 0.0}, 'Sun', 'Sun')}[19]['scores']
    assert row['Saturn'] == 3 - 4
    assert row['Venus'] == 3 - 5


def test_topics_score_the_five_dignities():
    item = view(lons={'Moon': 5.0, 'Mercury': 5.0}, asc=5.0)
    rows = C.topical_rows(item, {'sun': 0.0, 'moon': 0.0}, 'Sun', 'Sun')
    soul = rows[0]
    assert soul['id'] == 1 and soul['scores']['Mars'] == 3 * (5 + 1) and soul['scores']['Sun'] == 3 * (4 + 3)
    assert soul['winners'] == ['Sun']
    assert len(rows) == 19


def test_topic_lots_replace_the_zero_degree_term():
    item = view()
    plain = C.topical_rows(item, {'sun': 0.0, 'moon': 0.0}, 'Sun', 'Sun')
    classic = C.topical_rows(item, {'sun': 0.0, 'moon': 0.0}, 'Sun', 'Sun', classic=True)
    changed = {a['id'] for a, b in zip(plain, classic) if a['scores'] != b['scores']}
    assert {4, 5, 6, 7, 8, 9, 10, 11} <= changed
    assert 1 not in changed and 15 not in changed


def test_hyleg_house_is_equal_from_the_midheaven():
    assert C.hyleg_house(100.0, 100.0) == 10
    assert C.hyleg_house(96.0, 100.0) == 10
    assert C.hyleg_house(94.0, 100.0) == 9
    assert C.hyleg_house(130.0, 100.0) == 11


def test_zoroaster_exception_gives_the_sun_first():
    item = view(lons={'Sun': 15.0, 'Moon': 95.0, 'Mars': 130.0, 'Saturn': 160.0}, mc=310.0)
    assert C._above_mc(15.0, 310.0) and 60.0 <= (15.0 - 310.0) % 360.0 < 90.0
    assert C._zoroaster_exception(item, 100.0) is True
    assert C._sun_is_free(item, 197.0) is False                          # 南交在 17°,太近
    item.lons['Saturn'] = 105.0                                          # 土星刑太阳,受克
    assert C._sun_is_free(item, 100.0) is False


def test_zoroaster_exception_reaches_the_school_table():
    item = view(lons={'Sun': 15.0, 'Moon': 95.0, 'Mars': 130.0, 'Saturn': 160.0}, mc=310.0)
    assert C.hyleg_of(item, 'zoroaster', 50.0, True, 100.0, EQUAL_CUSPS) == 'Sun'
    assert C.hyleg_of(item, 'ptolemy', 50.0, True, 100.0, EQUAL_CUSPS) != 'Sun'


def test_witness_needs_a_lord_in_aspect():
    lons = dict(zip(SEVEN, (5.0, 40.0, 70.0, 100.0, 133.0, 160.0, 197.0)))
    item = view(lons=lons)
    assert C._witnessed(item, 77.0, None, C.WITNESS_ORBS_FIXED) is True      # 水星自守双子,七度内合
    far = dict(lons, Mercury=250.0, Mars=250.0, Jupiter=250.0, Saturn=250.0, Venus=250.0, Sun=250.0, Moon=250.0)
    assert C._witnessed(view(lons=far), 170.0, None, C.WITNESS_ORBS_FIXED) is False


def test_alcocoden_takes_the_best_own_dignity_and_keeps_away_from_combustion():
    lons = {'Sun': 280.0, 'Moon': 40.0, 'Mercury': 200.0, 'Venus': 130.0, 'Mars': 5.0, 'Jupiter': 95.0, 'Saturn': 210.0}
    item = view(lons=lons)
    assert C.alcocoden_of(item, 2.0) == 'Mars'
    assert C._alcocoden_tie(item, 'Sun') < C._alcocoden_tie(view(lons=dict(lons, Mars=283.0)), 'Mars')


def test_hyleg_schools_all_answer_and_alcocoden_comes_from_the_point():
    rows = C.build_chart_details(CHART)['hyleg']
    assert [row['school'] for row in rows] == [key for key, _label in C.HYLEG_SCHOOLS]
    for row in rows:
        if row['hyleg']:
            assert row['alcocoden'] in SEVEN


def test_patterns_grand_trine_and_conjunction_group():
    points = {'Sun': 0.0, 'Moon': 120.0, 'Mars': 240.0, 'Venus': 1.0}
    rows = C.aspect_patterns(points)
    assert [row['name'] for row in rows] == ['大三角']
    assert sorted(sorted(corner) for corner in rows[0]['corners']) == [['Mars'], ['Moon'], ['Sun', 'Venus']]


def test_patterns_use_the_two_point_radii_for_minor_angles_too():
    near = {'Sun': 0.0, 'Moon': 60.0, 'Mars': 215.0}        # 与日、月都差 5°,在半径和之内
    assert '上帝手指' in [row['name'] for row in C.aspect_patterns(near)]
    far = {'Mercury': 0.0, 'Venus': 60.0, 'Mars': 222.0}    # 与金星差 12°
    assert '上帝手指' not in [row['name'] for row in C.aspect_patterns(far)]


def test_patterns_read_a_conjunction_partner_as_the_same_corner():
    points = {'Saturn': 100.0, 'Pluto': 104.0, 'Mars': 164.0, 'Mercury': 44.0}      # 冥与土同角,只有冥与火、水成扇形
    rows = [row for row in C.aspect_patterns(points) if row['name'] == '扇形']
    assert rows and any('Pluto' in corner for corner in rows[0]['corners'])


def test_patterns_t_square_and_stellium():
    assert '大十字' in [row['name'] for row in C.aspect_patterns({'Sun': 0.0, 'Moon': 90.0, 'Mars': 180.0, 'Venus': 270.0})]
    names = [row['name'] for row in C.aspect_patterns({'Sun': 0.0, 'Moon': 2.0, 'Mars': 4.0, 'Venus': 90.0, 'Jupiter': 270.0})]
    assert '三星聚' in names and 'T 三角' in names


def test_close_pairs_need_three_groups():
    points = {'Sun': 0.0, 'Moon': 8.0, 'Mars': 100.0, 'Venus': 108.0, 'Jupiter': 200.0, 'Saturn': 205.0}
    assert len(C.close_pairs(points)) == 3
    assert '多组成对' in [row['name'] for row in C.aspect_patterns(points)]


@pytest.mark.parametrize('chart', [CHART, DAY_CHART, POLAR, POLAR_NIGHT, dict(CHART, hsys=0), dict(CHART, date='-0500/03/01', ad=-1)])
def test_every_table_answers(chart):
    result = C.build_chart_details(chart)
    for key in ('eminence', 'persian', 'sunPhases', 'sect', 'considerations', 'slavery', 'topics', 'hyleg'):
        assert result[key], key


def test_options_change_the_tables():
    plain = C.build_chart_details(CHART)
    element = C.build_chart_details(dict(CHART, detailFaces='element'))
    classic = C.build_chart_details(dict(CHART, variant='classic'))
    assert plain['faces'] == 'chaldean' and element['faces'] == 'element'
    assert plain['persian'] != element['persian']
    assert plain['topics'] != classic['topics']


def test_ptolemaic_triplicity_has_only_two_lords():
    for name in ('Ptolemaic', 'PtolemaicWaterVariant'):
        result = C.build_chart_details(dict(CHART, triplicity=name))
        assert all('' not in row['triplicity'] for row in result['sect'])
        assert '' not in result['hellenistic']['triplicity']
    assert C.sect_trip_lords({'dayTrip': 'Sun', 'nightTrip': 'Jupiter', 'partTrip': ''}, False) == ['Jupiter', 'Sun']
    assert C.sect_trip_lords({'dayTrip': 'Sun', 'nightTrip': 'Jupiter', 'partTrip': 'Saturn'}, True) == ['Sun', 'Jupiter', 'Saturn']


def test_polar_night_is_a_night_chart():
    item = C.ChartView(D._natal_from_request(dict(CHART, date='2017/12/20', time='08:50:00', zone='+00:00', lat='79n30', lon='9w49')), 'chaldean')
    assert item.day is False


def test_day_lord_falls_back_to_the_weekday_ruler_inside_the_polar_circle():
    result = C.build_chart_details(dict(CHART, date='2017/12/20', time='08:50:00', zone='+00:00', lat='79n30', lon='9w49'))
    assert result['dayLord'] == 'Mercury'


def test_terms_setting_reaches_the_tables():
    assert C.build_chart_details(CHART)['topics'] != C.build_chart_details(dict(CHART, termsVariant=2))['topics']


def test_lot_setting_reaches_the_fortune():
    night = dict(CHART, date='1975/02/17')
    plain = C.ChartView(D._natal_from_request(night), 'chaldean')
    fixed = C.ChartView(D._natal_from_request(dict(night, lotReversal=0)), 'chaldean')
    assert abs(plain.fortune - fixed.fortune) > 1.0


GOLDEN_CHARTS = {
    'seattle-night': CHART,
    'seattle-day': DAY_CHART,
    'sydney': dict(CHART, date='1990/07/15', time='06:30:00', zone='+10:00', lat='33s52', lon='151e12', gpsLat=-33.87, gpsLon=151.2,
                   lunarMethod='tithi', mundoSystem='horizontal', midpointCoord='mundane'),
    'tokyo-classic': dict(CHART, date='2004/11/02', time='18:05:00', zone='+09:00', lat='35n41', lon='139e41', gpsLat=35.68, gpsLon=139.68, variant='classic', detailFaces='element',
                          lunarMethod='centered', mundoSystem='regiomontanus', midpointCoord='ra'),
    'london-classic': dict(CHART, date='1963/03/21', time='03:40:00', zone='+00:00', lat='51n30', lon='0w07', gpsLat=51.5, gpsLon=-0.12, variant='classic', detailFaces='element',
                           lunarMethod='angle', mundoSystem='campanus', midpointCoord='declination'),
    'polar-koch': dict(POLAR, hsys=2),
}
GOLDEN_PATH = os.path.join(os.path.dirname(__file__), 'data', 'golden_chart_details.json')


@pytest.mark.parametrize('name', sorted(GOLDEN_CHARTS))
def test_golden_tables(name):
    with open(GOLDEN_PATH, encoding='utf-8') as handle:
        golden = json.load(handle)[name]
    # 受孕期从目标日起算一年:钉住目标日,金标不随今天变
    # horosa_win_float_golden_v1(Windows 侧移植适配):金标是在另一套数学库上录的,本机浮点末位与并列行次序不同;
    # 按 win_float_golden 的口径比(浮点差 1e-4 以内,整数、文字、布尔、键集合、行数仍须相等)。
    assert golden_equal(json.loads(json.dumps(C.build_chart_details(dict(GOLDEN_CHARTS[name], targetDate='2026/01/01')))), golden)


# ---------------------------------------------------------------- 口径细节
def test_accidental_improved_follows_lilly_classic_keeps_old_values():
    far = view(lons={'Saturn': 100.0, 'Sun': 10.0})
    sat_imp = row_of(C.accidental_rows(far, classic=False), 'Saturn')
    sat_cls = row_of(C.accidental_rows(far, classic=True), 'Saturn')
    assert sat_imp['sun'] == 5 and sat_cls['sun'] == 0           # 离日光以外:Lilly +5
    east = view(lons={'Sun': 100.0, 'Venus': 80.0})              # 金星黄经落后太阳 = 东出
    assert row_of(C.accidental_rows(east, classic=False), 'Venus')['orient'] == -2
    assert row_of(C.accidental_rows(east, classic=True), 'Venus')['orient'] == 0
    conj = view(lons={'Jupiter': 163.2, 'Saturn': 163.5})
    assert row_of(C.accidental_rows(conj, classic=False), 'Jupiter')['partile'] - row_of(C.accidental_rows(conj, classic=True), 'Jupiter')['partile'] == -5


def test_ptolemy_hyleg_improved_never_takes_a_light_below_the_horizon():
    # 夜盘:天顶 270,太阳 95(第 4 宫),月亮 160(第 6 宫)—— 经典档取太阳,改进档两光都不在放生之位
    item = view(lons={'Sun': 95.0, 'Moon': 160.0}, asc=0.0, mc=270.0, day=False)
    assert C.hyleg_of(item, 'ptolemy', 200.0, True, 100.0, EQUAL_CUSPS, classic=True) == 'Sun'
    assert C.hyleg_of(item, 'ptolemy', 200.0, True, 100.0, EQUAL_CUSPS, classic=False) not in ('Sun', 'Moon')


def test_whole_sign_houses_take_no_five_degree_lead():
    item = view(lons={'Saturn': 27.0})
    item.ahead = 0.0
    assert C.accidental_rows(item)[6]['house'] == C.HOUSE_POINTS[1]
    assert C.accidental_rows(view(lons={'Saturn': 27.0}))[6]['house'] == C.HOUSE_POINTS[2]
