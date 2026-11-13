import json
import os

import pytest
import swisseph
from flatlib import const

from astrostudy import transform_charts as T
from win_float_golden import golden_equal   # horosa_win_float_golden_v1

HERE = os.path.dirname(os.path.abspath(__file__))
GOLDEN = json.load(open(os.path.join(HERE, 'data', 'golden_transform_charts.json'), encoding='utf-8'))
PLACES = {'A': dict(jd=2460406.004166667, lat=-(57 + 52 / 60), lon=-(124 + 46 / 60)), 'B': dict(jd=2442454.71875, lat=47 + 36 / 60, lon=-(122 + 20 / 60))}
BASE = dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20', hsys=0)


def frame_of(key):
    place = PLACES[key]
    jd = place['jd']
    lons, lats, speeds = {}, {}, {}
    for name, body in T.BODY_IDS.items():
        row = swisseph.calc_ut(jd, body, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        lons[name], lats[name], speeds[name] = row[0], row[1], row[3]
    lons[const.NORTH_NODE], lats[const.NORTH_NODE] = swisseph.calc_ut(jd, swisseph.TRUE_NODE, swisseph.FLG_SWIEPH)[0][0], 0.0
    cusps, angles = swisseph.houses_ex(jd, place['lat'], place['lon'], b'P')
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    return T.Frame(jd, place['lat'], place['lon'], lons, lats, speeds, angles[0], angles[1], cusps[:12], angles[2], eps)


def gap(a, b):
    return abs((a - b + 180.0) % 360.0 - 180.0)


def build(kind, **extra):
    return T.build_transform_chart(dict(BASE, transformKind=kind, **extra))


def rows(result):
    return {row['id']: row for row in result['positions']}


CASES = [(key, kind) for key in GOLDEN for kind in GOLDEN[key]]


@pytest.mark.parametrize('key, kind', CASES)
def test_bodies_match_the_golden(key, kind):
    frame = frame_of(key)
    result = T.TRANSFORMS[kind](frame, {})
    for index, name in enumerate(T.TEN):
        expected = GOLDEN[key][kind]['bodies'][index]
        if expected is not None:
            assert gap(result['move'](name, frame.lons[name], frame.lats[name]), expected) < 0.02, name


@pytest.mark.parametrize('key, kind', CASES)
def test_cusps_match_the_golden(key, kind):
    frame = frame_of(key)
    result = T.TRANSFORMS[kind](frame, {})
    cusps = result['cusps'] if result['cusps'] is not None else frame.cusps
    # 北交宫盘的宫是逆向走的,盘面段头比这一宫的起点少 30°
    shift = 30.0 if kind == 'nodeHouses' else 0.0
    for index in range(12):
        expected = GOLDEN[key][kind]['cusps'][index]
        if expected is not None:
            assert gap(cusps[index] + shift, expected) < 0.02


def test_every_kind_builds_a_chart():
    for kind in list(T.TRANSFORMS) + list(T.MOMENT_KINDS):
        result = build(kind)
        assert result['kind'] == kind and result['chart']['chart'] and len(result['positions']) >= 10


def test_unknown_kind_falls_back():
    assert build('nope')['kind'] == 'inverted'


def test_inverted_rotates_the_whole_chart():
    for row in rows(build('inverted')).values():
        assert gap(row['lon'], row['natalLon'] + 180.0) < 1e-6


def test_sun_rise_moves_the_sun_to_the_natal_ascendant():
    table = rows(build('sunRise'))
    assert gap(table[const.SUN]['lon'], table[const.ASC]['natalLon']) < 1e-6
    # 改进档四轴和星一起转,星与四轴的相对位置不变
    offset = (table[const.SUN]['lon'] - table[const.SUN]['natalLon']) % 360.0
    assert gap(table[const.ASC]['lon'], table[const.ASC]['natalLon'] + offset) < 1e-6
    assert gap(table[const.MC]['lon'], table[const.MC]['natalLon'] + offset) < 1e-6


@pytest.mark.parametrize('kind', ['inverted', 'sunRise', 'novien', 'nodeHouses'])
def test_classic_keeps_the_natal_angles(kind):
    table = rows(build(kind, transformVariant='classic'))
    assert gap(table[const.ASC]['lon'], table[const.ASC]['natalLon']) < 1e-6
    assert gap(table[const.MC]['lon'], table[const.MC]['natalLon']) < 1e-6


@pytest.mark.parametrize('kind, cusp', [('inverted', 0), ('sunRise', 0), ('novien', 0)])
def test_improved_angles_sit_on_the_first_cusp(kind, cusp):
    result = build(kind, hsys=3)
    assert gap(rows(result)[const.ASC]['lon'], house_lons(result)[cusp]) < 1e-6


def test_improved_node_houses_start_at_the_node():
    result = build('nodeHouses', hsys=3)
    table = rows(result)
    assert gap(table[const.ASC]['lon'], table[const.NORTH_NODE]['lon']) < 1e-6
    assert gap(house_lons(result)[0] + 30.0, table[const.NORTH_NODE]['lon']) < 1e-6


def _house_number(name):
    return int(name.replace('House', ''))


def house_lons(result):
    """盘对象里的宫按黄经排,这里按宫号取。"""
    return [house.lon for house in sorted(result['chart']['chart']['houses'], key=lambda house: _house_number(house.id))]


def _objects(result):
    return [item for item in result['chart']['chart']['objects'] if getattr(item, 'id', None) in T.TEN]


def test_node_houses_run_backwards_in_equal_steps():
    result = build('nodeHouses')
    houses = result['chart']['chart']['houses']
    assert all(house.size == pytest.approx(30.0) for house in houses)
    node = rows(result)[const.NORTH_NODE]['lon']
    placed = _objects(result)
    assert len({item.house for item in placed}) > 1
    for item in placed:
        assert _house_number(item.house) == int(((node - item.lon) % 360.0) // 30.0) + 1


def test_novien_places_bodies_in_equal_houses_without_the_lead():
    result = build('novien')
    first = house_lons(result)[0]
    assert all(house.size == pytest.approx(30.0) for house in result['chart']['chart']['houses'])
    for item in _objects(result):
        assert _house_number(item.house) == int(((item.lon - first) % 360.0) // 30.0) + 1


def test_equal_house_label_is_not_whole_sign():
    assert build('novien')['chart']['chart']['houses'][0].hsysDerived == T.EQUAL_HOUSE_MODE
    assert build('analogLatitude')['chart']['chart']['houses'][0].hsysDerived == T.DERIVED_HOUSE_MODE


@pytest.mark.parametrize('kind', ['geodeticLong', 'geodeticRa', 'localityArmc', 'localityMc'])
def test_local_charts_follow_the_chosen_house_system(kind):
    whole = build(kind, hsys=0)['chart']['chart']
    assert whole['hsys'] == 'Whole Sign'
    assert all(abs(house.lon % 30.0) < 1e-6 or abs(house.lon % 30.0 - 30.0) < 1e-6 for house in whole['houses'])
    second = {hsys: house_lons(build(kind, hsys=hsys))[1] for hsys in (0, 1, 2, 3)}
    assert len({round(value, 6) for value in second.values()}) == 4


def test_moment_failure_does_not_use_the_err_key():
    # Java 见 err 就整体抛错;这张高纬盘的受孕时刻两种步长都找不到
    found = None
    for lat in ('78n13', '75n00', '70n00'):
        for time in ('03:00:00', '09:00:00', '15:00:00', '21:00:00'):
            for day in range(1, 29, 3):
                result = T.build_transform_chart(dict(BASE, lat=lat, date='1975/02/%02d' % day, time=time, transformKind='epoch', zone='+01:00', lon='15e39'))
                if result.get('momentFailed'):
                    found = result
                    break
            if found:
                break
        if found:
            break
    assert found is not None
    assert 'err' not in found and 'chart' not in found
    assert found['rulers'] and found['golden']


def test_persona_of_the_sun_is_the_birth_moment():
    # 太阳对太阳的差是 -1.4e-14,不能被推迟一年
    frame_params = dict(date='1951/07/03', time='02:05:13', zone='+08:00', lat='39n54', lon='116e24', hsys=1, zodiacal=0)
    result = T.build_transform_chart(dict(frame_params, transformKind='persona', transformPlanet=const.SUN))
    assert result['moment'].startswith('1951-07-03 02:05')


def test_center_body_is_left_out_of_the_position_table():
    table = rows(build('planetCentered', transformPlanet=const.MOON))
    assert const.MOON not in table and const.SUN in table
    assert const.SUN not in rows(build('planetCentered', transformPlanet=const.SUN))


def test_shift_string_zero_is_false_and_bad_planet_falls_back():
    still = rows(build('superimposed', transformPlanet=const.MOON, transformShift='0'))
    assert gap(still[const.ASC]['lon'], still[const.ASC]['natalLon']) < 1e-6
    assert build('superimposed', transformPlanet='nope')['chart'] is not None
    assert build('planetCentered', transformPlanet=const.NORTH_NODE)['chart'] is not None


FULL_GOLDEN_PATH = os.path.join(os.path.dirname(__file__), 'data', 'golden_transform_full.json')
FULL_CHARTS = {
    'B': dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20', hsys=1, zodiacal=0),
    'S': dict(date='1962/11/03', time='05:40:00', zone='+10:00', lat='33s52', lon='151e13', hsys=1, zodiacal=0),
}


def full_snapshot():
    out = {}
    for chart_name, params in FULL_CHARTS.items():
        for kind in list(T.TRANSFORMS) + list(T.MOMENT_KINDS):
            for variant in ('improved', 'classic'):
                result = T.build_transform_chart(dict(params, transformKind=kind, transformVariant=variant, transformPlanet=const.MOON, transformHouse=4))
                chart = result['chart']['chart']
                row = {
                    'cusps': [round(lon, 6) for lon in house_lons(result)],
                    'derived': getattr(chart['houses'][0], 'hsysDerived', None),
                    'positions': [[item['id'], round(item['lon'], 6)] for item in result['positions']],
                    'moment': result.get('moment'), 'vertical': result.get('vertical'),
                }
                if kind == 'superimposed':       # 宫主和黄金分割跟变换种类无关,一处锁住就够
                    row.update(rulers=result['rulers'], golden=result['golden'])
                out['%s/%s/%s' % (chart_name, kind, variant)] = row
    return json.loads(json.dumps(out))


def test_everything_matches_the_full_golden():
    with open(FULL_GOLDEN_PATH, encoding='utf-8') as handle:
        golden = json.load(handle)
    current = full_snapshot()
    assert sorted(current) == sorted(golden)
    for key in golden:
        # horosa_win_float_golden_v1(Windows 侧移植适配):金标是在另一套数学库上录的,本机浮点末位与并列行次序不同;
        # 按 win_float_golden 的口径比(浮点差 1e-4 以内,整数、文字、布尔、键集合、行数仍须相等)。
        assert golden_equal(current[key], golden[key]), key


def test_superimposed_keeps_houses_unless_shifted():
    still = rows(build('superimposed', transformPlanet=const.MOON))
    assert gap(still[const.MOON]['lon'], still[const.ASC]['natalLon']) < 1e-6
    assert gap(still[const.ASC]['lon'], still[const.ASC]['natalLon']) < 1e-6
    moved = rows(build('superimposed', transformPlanet=const.MOON, transformShift=1))
    assert gap(moved[const.ASC]['lon'], still[const.MOON]['natalLon']) > 1.0


def test_sidereal_chart_uses_true_coordinates_for_analogs():
    tropical = rows(build('analogRightAscension'))[const.SUN]['lon']
    sidereal = rows(build('analogRightAscension', zodiacal=1))[const.SUN]['lon']
    assert gap(tropical, sidereal) < 0.01


def test_sidereal_chart_shows_elements_on_its_own_zodiac():
    tropical = rows(build('planetNodes'))[const.MARS]['lon']
    sidereal = rows(build('planetNodes', zodiacal=1))[const.MARS]['lon']
    assert gap(tropical, sidereal) > 20.0


def test_geodetic_keeps_planets_and_moves_angles():
    table = rows(build('geodeticLong'))
    assert gap(table[const.SUN]['lon'], table[const.SUN]['natalLon']) < 1e-6
    assert gap(table[const.ASC]['lon'], table[const.ASC]['natalLon']) > 1.0


def test_locality_ignores_east_or_west():
    west = rows(build('localityMc'))[const.MC]['lon']
    east = rows(build('localityMc', lon='122e20'))[const.MC]['lon']
    assert gap(west, east) < 1e-3


def test_planet_centered_on_the_sun_is_heliocentric():
    frame = frame_of('B')
    result = T.TRANSFORMS['planetCentered'](frame, {'planet': const.SUN})
    helio = swisseph.calc_ut(frame.jd, swisseph.MARS, swisseph.FLG_SWIEPH | swisseph.FLG_HELCTR)[0][0]
    assert gap(result['move'](const.MARS, frame.lons[const.MARS], frame.lats[const.MARS]), helio) < 0.02


def test_persona_reaches_the_natal_longitude():
    frame = frame_of('A')
    moment = T.persona_moment(frame, const.MOON)
    assert moment - frame.jd == pytest.approx(319.46, abs=0.02)
    assert gap(swisseph.calc_ut(moment, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0], frame.lons[const.MOON]) < 1e-4


def test_epoch_matches_the_golden():
    frame = frame_of('A')
    moment = T.epoch_moment(frame, 1)
    assert frame.jd - moment == pytest.approx(272.33, abs=0.02)
    assert gap(T._moon_lon(moment), frame.asc) == pytest.approx(3.28, abs=0.02)
    assert gap(T._asc_at(moment, frame), frame.lons[const.MOON]) < 0.01


def test_modern_rulers_structure():
    table = T.modern_house_rulers(frame_of('B'))
    assert [row['coRuler'] for row in table][:5] == [const.PLUTO, const.VENUS, const.MERCURY, const.MOON, const.SUN]
    frame = frame_of('B')
    for row, cusp in zip(table, frame.cusps):
        assert row['ruler'] == T.MODERN_RULERS[int(cusp // 30)]
    assert sorted(name for row in table for name in row['inside']) == sorted(T.TEN)


def test_co_ruler_only_when_retrograde():
    frame = frame_of('B')
    frame.speeds[const.PLUTO] = 1.0
    assert T.modern_house_rulers(frame)[1]['rulerRetro'] is None
    frame.speeds[const.PLUTO] = -1.0
    assert T.modern_house_rulers(frame)[1]['rulerRetro'] == const.PLUTO


def test_vertical_rows_give_two_solutions_or_outside():
    rows_ = T.vertical_rows(frame_of('B'))
    assert len(rows_) == 10
    for row in rows_:
        if row['outside']:
            assert 'first' not in row
        else:
            assert gap(row['first'] + row['second'], 180.0) < 1e-6


def test_golden_points_sit_at_the_ratio():
    table = T.golden_table(frame_of('B'), {})
    assert len(table) == 8
    assert table[0]['lon'] == pytest.approx(137.508, abs=0.01)
    assert table[4]['lon'] == pytest.approx(222.492, abs=0.01)


def test_polar_chart_still_builds():
    for kind in ('inverted', 'geodeticLong', 'analogAltitude', 'houseRegiomontanus'):
        assert build(kind, date='2000/12/21', time='12:00:00', zone='+01:00', lat='78n13', lon='15e39')['chart']['chart']


def test_bad_house_option_falls_back():
    assert T._house_option({'transformHouse': 'x'}) == 1
    assert T._house_option({'transformHouse': 13}) == 1
    assert T._house_option({'transformHouse': 7}) == 7


def test_golden_points_cover_both_ratios_and_all_quarters():
    table = build('superimposed', transformPlanet=const.MOON)['golden']
    assert {row['extra'] for row in table} == {0.0, 90.0, 180.0, 270.0}
    assert {round(row['ratio'], 3) for row in table} == {0.382, 0.618}
    moon = rows(build('superimposed', transformPlanet=const.MOON))[const.MOON]['natalLon']
    for row in table:
        assert gap(row['lon'], moon + 360.0 * row['ratio'] + row['extra']) < 1e-6
    plain = build('inverted')['golden']
    assert gap(plain[0]['lon'], 360.0 * plain[0]['ratio']) < 1e-6


def _house_of(result, name):
    for item in result['chart']['chart']['objects']:
        if getattr(item, 'id', None) == name:
            return _house_number(item.house)
    raise KeyError(name)


@pytest.mark.parametrize('hsys', [0, 3, 24])
@pytest.mark.parametrize('date', ['1975/02/10', '1990/05/15', '2004/08/21', '1962/11/03'])
def test_points_on_the_node_house_edges(hsys, date):
    result = build('nodeHouses', hsys=hsys, date=date)
    assert _house_of(result, const.ASC) == 1
    assert _house_of(result, const.IC) == 4
    assert _house_of(result, const.DESC) == 7
    assert _house_of(result, const.MC) == 10
    assert _house_of(result, const.SOUTH_NODE) == 7
    assert _house_of(result, const.NORTH_NODE) == 1


@pytest.mark.parametrize('hsys', [0, 3, 24])
@pytest.mark.parametrize('date', ['1975/02/10', '1990/05/15', '2004/08/21', '1962/11/03'])
def test_points_on_the_novien_edges(hsys, date):
    result = build('novien', hsys=hsys, date=date)
    assert _house_of(result, const.ASC) == 1
    assert _house_of(result, const.IC) == 4
    assert _house_of(result, const.DESC) == 7
    assert _house_of(result, const.MC) == 10


@pytest.mark.parametrize('kind', ['novien', 'nodeHouses', 'geodeticLong'])
def test_fortune_whole_houses_do_not_overwrite_the_transform(kind):
    plain = house_lons(build(kind, hsys=3))
    fortune = house_lons(build(kind, hsys=24))
    if kind != 'geodeticLong':
        assert [round(value, 6) for value in fortune] == [round(value, 6) for value in plain]
    else:
        assert fortune != house_lons(build('inverted', hsys=24))
        assert getattr(build(kind, hsys=24)['chart']['chart']['houses'][0], 'hsysDerived') == T.BASE_HOUSE_MODE


def test_superimposed_keeps_fortune_whole_houses_still():
    natal = T.build_transform_chart(dict(BASE, hsys=24, transformKind='antiscia'))
    moved = T.build_transform_chart(dict(BASE, hsys=24, transformKind='superimposed', transformPlanet=const.MOON))
    assert house_lons(moved) == house_lons(natal)


def test_topocentric_moon_turns_with_the_chart():
    plain = rows(build('inverted', topocentricMoon=1))
    assert gap(plain[const.MOON]['lon'], plain[const.MOON]['natalLon'] + 180.0) < 1e-6
    assert gap(plain[const.PARS_FORTUNA]['lon'], plain[const.PARS_FORTUNA]['natalLon'] + 180.0) < 1e-6


def test_lot_variants_turn_with_the_chart():
    for extra in ({'lotReversal': 0}, {'lotProjection': 'sign'}):
        table = rows(build('superimposed', transformPlanet=const.MOON, **extra))
        offset = table[const.MOON]['lon'] - table[const.MOON]['natalLon']
        assert gap(table[const.PARS_FORTUNA]['lon'], table[const.PARS_FORTUNA]['natalLon'] + offset) < 1e-6


def test_day_and_night_stay_on_the_birth():
    natal = T.PerChart(T.base_params(dict(BASE)))
    assert build('nodeHouses', hsys=3)['chart']['chart']['isDiurnal'] == natal.isDiurnal
    assert build('novien', hsys=3)['chart']['chart']['isDiurnal'] == natal.isDiurnal


def test_coordinates_follow_the_new_longitude():
    natal = T.PerChart(T.base_params(dict(BASE)))
    eps = swisseph.calc_ut(natal.dateTime.jd, swisseph.ECL_NUT)[0][0]
    result = build('inverted')
    for item in _objects(result):
        ra, dec = T.ecl_to_equ(item.lon, getattr(item, 'lat', 0.0) or 0.0, eps)
        assert gap(item.ra, ra) < 1e-6 and item.decl == pytest.approx(dec, abs=1e-6)
    sun = next(item for item in _objects(result) if item.id == const.SUN)
    natal_sun = natal.chart.get(const.SUN)
    assert sun.decl == pytest.approx(-natal_sun.decl, abs=0.05)


def test_vertical_keeps_nodes_opposite_and_leaves_points_alone():
    table = rows(build('vertical'))
    assert gap(table[const.SOUTH_NODE]['lon'], table[const.NORTH_NODE]['lon'] + 180.0) < 1e-6
    assert gap(table[const.PARS_FORTUNA]['lon'], table[const.PARS_FORTUNA]['natalLon']) < 1e-6
    assert gap(table[const.CHIRON]['lon'], table[const.CHIRON]['natalLon']) < 1e-6


def test_sunshine_houses_use_the_sun_declination():
    frame = frame_of('B')
    frame.house_system = b'I'
    with_sun = T._angles_from_armc(frame, frame.armc)[2]
    jd_dec = swisseph.calc_ut(frame.jd, swisseph.SUN, swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)[0][1]
    direct = swisseph.houses_armc(frame.armc, frame.geo_lat, frame.eps, b'I', jd_dec)[0]
    assert gap(with_sun[1], direct[1]) < 1e-6


@pytest.mark.parametrize('hsys', [2, 10, 17, 18, 22, 23])
@pytest.mark.parametrize('kind', ['geodeticLong', 'inverted', 'sunRise'])
def test_polar_charts_build_like_the_natal_does(hsys, kind):
    params = dict(BASE, lat='70n00', lon='15e00', date='1972/02/09', time='06:59:00', zone='+00:00', hsys=hsys)
    result = T.build_transform_chart(dict(params, transformKind=kind))
    assert result['chart'] is not None and len(result['positions']) > 10


def test_novien_ic_stays_on_the_fourth_house_for_a_rounding_case():
    result = T.build_transform_chart(dict(BASE, date='0743/09/18', time='04:02:30', ad=-1, zone='+05:00', lat='47n17', lon='69w03', hsys=8, transformKind='novien'))
    assert _house_of(result, const.IC) == 4 and _house_of(result, const.MC) == 10


@pytest.mark.parametrize('kind', ['vertical', 'analogAltitude', 'analogRightAscension', 'planetNodes', 'secondFocus', 'planetCentered', 'novien', 'decanate'])
def test_converted_longitudes_keep_the_natal_coordinates(kind):
    natal = T.PerChart(T.base_params(dict(BASE)))
    result = build(kind, transformPlanet=const.MOON)
    assert result['coordinatesMoved'] is False
    for item in _objects(result):
        twin = natal.chart.get(item.id)
        assert item.decl == pytest.approx(twin.decl) and item.ra == pytest.approx(twin.ra)
        assert item.altitudeTrue == pytest.approx(twin.altitudeTrue)


@pytest.mark.parametrize('kind', ['inverted', 'sunRise', 'superimposed', 'antiscia', 'contraAntiscia'])
def test_rigid_moves_recompute_the_coordinates(kind):
    assert build(kind, transformPlanet=const.MOON)['coordinatesMoved'] is True


@pytest.mark.parametrize('kind', ['analogLatitude', 'novien', 'decanate', 'vertical', 'nodeHouses', 'nodeHousesClassic'])
def test_horizon_facts_stay_natal_when_the_bodies_did_not_move_with_the_sky(kind):
    # 星的赤经赤纬没跟着动(或星根本不动)时,拿它比新天顶会得到两张盘的混合,地平上下与得时失时一律取本命
    natal = T.PerChart(T.base_params(dict(BASE)))
    extra = {'transformVariant': 'classic'} if kind == 'nodeHousesClassic' else {}
    result = build('nodeHouses' if kind == 'nodeHousesClassic' else kind, transformPlanet=const.MOON, **extra)
    assert result['natalHorizon'] is True
    checked = 0
    for item in _objects(result):
        if not hasattr(item, 'hayyiz'):
            continue
        twin = natal.chart.get(item.id)
        assert (item.aboveHorizon, item.hayyiz) == (twin.aboveHorizon, twin.hayyiz), item.id
        checked += 1
    assert checked >= 7


def test_refreshed_apparent_altitude_matches_the_natal_calibre():
    # 倒置盘里不动的点(或映点后恰好回到原位的点)也该和本命用同一套大气口径:拿本命星按本命位置重算一遍,视高度应逐颗一致
    params = T.base_params(dict(BASE))
    natal = T.PerChart(params)
    frame = T._frame_from(natal, params)
    for item in natal.chart.objects:
        if not hasattr(item, 'altitudeAppa') or item.id in (const.ASC, const.MC, const.DESC, const.IC):
            continue
        apparent = T._horizon(frame, item.lon, getattr(item, 'lat', 0.0) or 0.0, T.NATAL_REFRACTION)[2]
        assert apparent == pytest.approx(item.altitudeAppa, abs=2e-3), item.id


def test_node_houses_refresh_the_angles_on_the_node():
    result = build('nodeHouses')
    assert result['coordinatesMoved'] is True
    frame_params = T.base_params(dict(BASE))
    frame = T._frame_from(T.PerChart(frame_params), frame_params)
    for item in _objects(result):
        if item.id in (const.ASC, const.MC):
            ra, decl = T.ecl_to_equ(frame.tropical(item.lon), 0.0, frame.eps)
            assert item.decl == pytest.approx(decl) and item.ra == pytest.approx(ra)


@pytest.mark.parametrize('kind', ['inverted', 'sunRise', 'antiscia'])
def test_rigid_moves_recompute_the_horizon_facts(kind):
    assert build(kind)['natalHorizon'] is False


def test_horizon_values_are_refreshed_with_the_apparent_altitude():
    result = build('inverted')
    frame_params = T.base_params(dict(BASE))
    frame = T._frame_from(T.PerChart(frame_params), frame_params)
    for item in _objects(result):
        azimuth, true_altitude, apparent = T._horizon(frame, item.lon, getattr(item, 'lat', 0.0) or 0.0, T.NATAL_REFRACTION)
        assert item.azimuth == pytest.approx(azimuth) and item.altitudeTrue == pytest.approx(true_altitude)
        assert item.altitudeAppa == pytest.approx(apparent)


def test_coordinates_use_the_tropical_longitude_on_a_sidereal_chart():
    tropical = {item.id: item for item in _objects(build('inverted'))}
    sidereal = {item.id: item for item in _objects(build('inverted', zodiacal=1))}
    for name, item in sidereal.items():
        assert gap(item.ra, tropical[name].ra) < 0.05 and item.decl == pytest.approx(tropical[name].decl, abs=0.05)


def test_angles_refresh_on_the_ecliptic():
    natal = T.PerChart(T.base_params(dict(BASE)))
    eps = swisseph.calc_ut(natal.dateTime.jd, swisseph.ECL_NUT)[0][0]
    asc = next(item for item in build('inverted')['chart']['chart']['objects'] if item.id == const.ASC)
    ra, dec = T.ecl_to_equ(asc.lon, 0.0, eps)
    assert gap(asc.ra, ra) < 1e-6 and asc.decl == pytest.approx(dec)


def test_base_house_label_only_on_local_charts():
    assert build('geodeticLong', hsys=24)['chart']['chart']['houses'][0].hsysDerived == T.BASE_HOUSE_MODE
    assert getattr(build('inverted', hsys=24)['chart']['chart']['houses'][0], 'hsysDerived', None) is None


def test_modern_rulers_improved_put_mars_on_aries_and_pluto_on_scorpio():
    frame = frame_of('B')
    improved = T.modern_house_rulers(frame, classic=False)
    classic = T.modern_house_rulers(frame, classic=True)
    assert improved[0]['coRuler'] == const.MARS and improved[7]['coRuler'] == const.PLUTO
    assert classic[0]['coRuler'] == const.PLUTO and classic[7]['coRuler'] == const.MARS
    assert T.MODERN_CO_RULERS_IMPROVED[0] == const.PLUTO and T.MODERN_CO_RULERS_IMPROVED[7] == const.MARS
    for row, cusp in zip(improved, frame.cusps):
        assert row['ruler'] == T.MODERN_RULERS_IMPROVED[int(cusp // 30)]
