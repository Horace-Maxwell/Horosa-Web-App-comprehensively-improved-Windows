# -*- coding: utf-8 -*-
"""黄道制:各版本分段、88 星座判定、跨界时刻、银河黄道。"""
import json
import os

import pytest
import swisseph

from astrostudy import zodiac_systems as Z
from astrostudy.zodiac_data import IAU_BLOCKS, ZODIAC_VERSIONS

GOLD = json.load(open(os.path.join(os.path.dirname(__file__), 'data', 'golden_zodiac_systems.json'), encoding='utf-8'))
CHART = {'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'hsys': 0, 'zodiac': 0}


def test_every_version_closes_the_circle():
    for key, version in ZODIAC_VERSIONS.items():
        assert sum(version['lengths']) == pytest.approx(360.0, abs=0.01), key
        assert len(version['lengths']) == len(Z.GROUP_SIGNS[version['group']]), key


@pytest.mark.parametrize('lon, index, inside, equal', GOLD['z13a'])
def test_first_version_matches_the_golden(lon, index, inside, equal):
    got_index, got_inside, got_equal = Z.locate(ZODIAC_VERSIONS['z13a'], lon, GOLD['jd'])
    assert got_index == index
    assert got_inside == pytest.approx(inside, abs=0.02)
    assert got_equal == pytest.approx(equal, abs=0.02)


def test_start_moves_with_precession_only_when_flagged():
    moved = ZODIAC_VERSIONS['z13a']
    assert Z.version_start(moved, GOLD['jd']) == pytest.approx(29.0259, abs=0.0005)
    assert Z.version_start(moved, Z.J2000) == pytest.approx(moved['start'], abs=1e-9)
    fixed = ZODIAC_VERSIONS['z12a']
    assert Z.version_start(fixed, GOLD['jd']) == fixed['start'] == Z.version_start(fixed, Z.J2000)


def test_ophiuchus_owns_the_narrow_scorpio_gap():
    version = ZODIAC_VERSIONS['z13a']
    start = Z.version_start(version, GOLD['jd'])
    assert Z.GROUP_SIGNS['thirteen'][Z.locate(version, start + 215.0, GOLD['jd'])[0]] == '天蝎'
    assert Z.GROUP_SIGNS['thirteen'][Z.locate(version, start + 225.0, GOLD['jd'])[0]] == '蛇夫'


def test_last_degree_of_the_circle_stays_in_last_sign():
    version = ZODIAC_VERSIONS['z12a']
    assert Z.locate(version, 359.9999, Z.J2000)[0] == 11
    assert Z.locate(version, 0.0, Z.J2000)[0] == 0


@pytest.mark.parametrize('ra, dec, name', GOLD['iau'])
def test_constellation_matches_the_published_boundaries(ra, dec, name):
    assert Z.constellation_of(ra, dec) == name


def test_boundary_table_covers_all_88():
    assert len({row[3] for row in IAU_BLOCKS}) == 88
    assert set(Z.IAU_NAMES) == {row[3] for row in IAU_BLOCKS}


def test_each_crossing_really_changes_constellation():
    jd = swisseph.julday(1975, 2, 11, 5.25)
    rows = Z.around_crossings(jd, '-08:00')
    assert len(rows) == len(Z.BODY_IDS)
    for row in rows:
        assert row['last'] and row['next'], row['id']
        assert row['last']['to'] == row['con'] == row['next']['from'], row['id']
        assert row['last']['from'] != row['last']['to']
        assert row['lastDays'] > 0 and row['nextDays'] > 0


def test_year_crossings_are_sorted_and_skip_the_moon():
    jd = swisseph.julday(1975, 2, 11, 5.25)
    rows = Z.year_crossings(jd, '-08:00')
    assert rows and all(row['id'] != 'Moon' for row in rows)
    dates = [row['date'] for row in rows]
    assert dates == sorted(dates)


def test_galactic_center_is_near_the_known_longitude():
    assert Z.galactic_center_lon(Z.J2000) == pytest.approx(266.84, abs=0.05)
    assert Z.galactic_row(267.0, 267.0)['lon'] == 0.0
    assert Z.galactic_row(267.0 + 35.0, 267.0)['sign'] == '金牛'


def test_build_gives_rows_for_every_version():
    result = Z.build_zodiac_systems(dict(CHART, zodiacVersion='z14'))
    assert result['version'] == 'z14'
    assert len(result['wheel']) == 14
    sun = next(row for row in result['rows'] if row['id'] == 'Sun')
    assert set(sun['versions']) == set(ZODIAC_VERSIONS)
    assert sun['con'] == 'Cap' and sun['onZodiac'] is True


def test_unknown_version_falls_back():
    assert Z.build_zodiac_systems(dict(CHART, zodiacVersion='nope'))['version'] == 'z13a'


def test_sidereal_chart_is_segmented_on_tropical_longitude():
    tropical = Z.build_zodiac_systems(CHART)['rows'][0]
    sidereal = Z.build_zodiac_systems(dict(CHART, zodiacal=1, siderealAyanamsa='lahiri'))['rows'][0]
    assert sidereal['lon'] == pytest.approx(tropical['lon'], abs=0.01)
    assert sidereal['con'] == tropical['con']


def test_polar_chart_still_builds():
    result = Z.build_zodiac_systems(dict(CHART, lat='78n13', lon='15e39', zone='+01:00'))
    assert len(result['rows']) > 10


def test_version_tables_stay_put():
    # 19 个版本的座头、座长按 J2000 锁住,一段错位这里就红
    current = {key: [[row['sign'], round(row['start'], 4), round(row['length'], 4)] for row in Z.version_table(key, Z.J2000)] for key in ZODIAC_VERSIONS}
    assert current == GOLD['tables']


def test_version_labels_name_no_author():
    for version in ZODIAC_VERSIONS.values():
        assert version['label'].split(' · ')[0] in ('十二段', '十三星座', '十四星座')
        assert not any(ch.isascii() and ch.isalpha() for ch in version['label'])


def test_points_keep_their_latitude_for_the_constellation():
    # 1984-03-06 智神星黄经 326.55°、黄纬 +16.18°:带黄纬在飞马,丢黄纬在摩羯
    jd = swisseph.julday(1984, 3, 6, 0.0)
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    assert Z.constellation_of(*Z._point_equatorial(jd, 326.55, 16.18, eps)) == 'Peg'
    assert Z.constellation_of(*Z._point_equatorial(jd, 326.55, 0.0, eps)) == 'Cap'


def test_point_conversion_agrees_with_the_ephemeris():
    # 用火星的回归黄经黄纬走一遍,要和星历直接给的 J2000 赤道坐标相等(光行差约 20″)
    jd = swisseph.julday(1975, 2, 11, 5.25)
    eps = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
    lon, lat = swisseph.calc_ut(jd, swisseph.MARS, swisseph.FLG_SWIEPH | swisseph.FLG_NONUT)[0][:2]
    ra, dec = Z._point_equatorial(jd, lon, lat, swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1])
    want = swisseph.calc_ut(jd, swisseph.MARS, Z.EQ_J2000)[0][:2]
    assert ((ra - want[0] + 180.0) % 360.0 - 180.0) == pytest.approx(0.0, abs=0.02)
    assert dec == pytest.approx(want[1], abs=0.02)


def test_short_grazes_are_found():
    # 金星 JD 2435520.22 进鲸鱼,不到半天又回双鱼
    events = Z.year_crossings(2435510.0, '+00:00')
    venus = [row for row in events if row['id'] == 'Venus']
    assert ('Psc', 'Cet') in [(row['from'], row['to']) for row in venus]
    assert ('Cet', 'Psc') in [(row['from'], row['to']) for row in venus]


def test_crossings_land_on_a_real_constellation_change():
    events = Z.year_crossings(swisseph.julday(2024, 1, 1, 0.0), '+00:00')
    assert len(events) > 20
    assert all(row['id'] != 'Moon' and row['from'] != row['to'] for row in events)
    assert [row['date'] for row in events] == sorted(row['date'] for row in events)


def test_row_fields_are_consistent():
    result = Z.build_zodiac_systems(dict(CHART, zodiacVersion='z13iau'))
    assert result['version'] == 'z13iau' and len(result['versions']) == 19
    for row in result['rows']:
        assert row['conName'] == Z.IAU_NAMES[row['con']]
        assert row['onZodiac'] is (row['con'] in Z.ZODIAC_OF_IAU)
        assert row['galactic']['lon'] == pytest.approx((row['lon'] - result['galacticCenter']) % 360.0)
    for row in result['around']:
        assert row['last']['to'] == row['con'] and row['next']['from'] == row['con']
    # 银心在射手附近:2000 年前后回归黄经约 266.8°
    assert Z.galactic_center_lon(Z.J2000) == pytest.approx(266.84, abs=0.05)


def test_thirteen_houses_follow_thirteen_sign_lengths():
    from astrostudy.zodiac_systems import thirteen_house_cusps, thirteen_house, ZODIAC_VERSIONS
    cusps = thirteen_house_cusps(185.2242)
    # 西雅图盘上升 185.2242:宫头依次加十三星座甲本的座长
    assert [round(c, 4) for c in cusps[:6]] == [185.2242, 209.9542, 246.6772, 274.5252, 294.5752, 330.3882]
    assert len(cusps) == 13
    lengths = ZODIAC_VERSIONS['z13a']['lengths']
    assert abs(sum(lengths) - 360.0) < 1e-6
    sun = thirteen_house(321.8504, 185.2242)
    assert sun['house'] == 5 and sun['fraction'] * 30 == pytest.approx(22.848, abs=0.002)
    mars = thirteen_house(285.0474, 185.2242)
    assert mars['house'] == 4 and mars['fraction'] * 30 == pytest.approx(15.744, abs=0.002)
    assert thirteen_house(185.2242, 185.2242)['house'] == 1
    assert thirteen_house(185.2241, 185.2242)['house'] == 13


def test_thirteen_houses_in_payload():
    from astrostudy.zodiac_systems import build_zodiac_systems
    res = build_zodiac_systems({'date': '1975/02/10', 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20', 'hsys': 3})
    assert len(res['houses13Cusps']) == 13
    rows = {row['id']: row for row in res['rows']}
    assert rows['Asc']['houses13']['house'] == 1 and rows['Asc']['houses13']['deg'] == pytest.approx(0.0, abs=1e-9)
    assert [rows[n]['houses13']['house'] for n in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter')] == [5, 5, 5, 6, 4, 6]


def test_cancer_zero_puts_the_solstices_on_sign_heads():
    """「巨蟹零度起」:90° 是巨蟹座头、270° 是摩羯座头(J2000);经典档沿用白羊段从 90° 起的旧排法。"""
    rows = {row['sign']: row for row in Z.version_table('z13cancer', Z.J2000)}
    assert round(rows['巨蟹']['start'], 4) == 90.0 and round(rows['摩羯']['start'], 4) == 270.0
    old = Z.version_table('z13cancerClassic', Z.J2000)
    assert old[0]['sign'] == '白羊' and round(old[0]['start'], 4) == 90.0
