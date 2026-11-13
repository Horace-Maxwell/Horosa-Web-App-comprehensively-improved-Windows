import math

import pytest
import swisseph

import flatlib.ephem.swe  # noqa: F401  设星历路径
from astrostudy.acg import eclipse_path as E
from astrostudy.acg.ACGraph import ACGraph


def _jd(y, m, d, h=0.0):
    return swisseph.julday(y, m, d, h)


def _km(a, b):
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    dl = math.radians(b['lon'] - a['lon'])
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return E.EARTH_RADIUS_KM * math.acos(max(-1.0, min(1.0, c)))


def test_2017_total_eclipse_matches_the_published_greatest_point():
    # 2017-08-21 全食:食甚 18:25 UT,36°58′N 87°40′W,食甚处食带宽约 115 km
    result = E.eclipse_path(_jd(2017, 8, 22), 'prenatal')
    assert result['type'] == 'total' and result['central']
    assert result['greatest']['lat'] == pytest.approx(36.97, abs=0.05)
    assert result['greatest']['lon'] == pytest.approx(-87.67, abs=0.05)
    y, m, d, h = swisseph.revjul(result['jd'])
    assert (y, m, d) == (2017, 8, 21) and h == pytest.approx(18.43, abs=0.02)
    middle = len(result['north']) // 2
    assert 105 < _km(result['north'][middle], result['south'][middle]) < 125
    oregon = [p for p in result['track'] if -125 < p['lon'] < -123]
    assert oregon and oregon[0]['lat'] == pytest.approx(44.8, abs=0.3)


def test_edge_points_sit_on_the_boundary_of_totality():
    # 取食甚那一刻的中心点重算两侧边界:边界内侧 1 km 仍是全食,外侧 1 km 已不是
    result = E.eclipse_path(_jd(2017, 8, 22), 'prenatal')
    track = E._track(result['jd'] - 0.01, result['jd'] + 0.01)
    center = track[len(track) // 2]
    heading = E._bearing(track[len(track) // 2 - 1], track[len(track) // 2 + 1])
    for side in (-90.0, 90.0):
        edge = E._edge(center, heading + side)
        assert edge is not None
        distance = _km(center, {'lat': edge[0], 'lon': edge[1]})
        inner = E._destination(center['lat'], center['lon'], heading + side, distance - 1.0)
        outer = E._destination(center['lat'], center['lon'], heading + side, distance + 1.0)
        assert E._inside(center['jd'], *inner)
        assert not E._inside(center['jd'], *outer)


@pytest.mark.parametrize('day', [(2021, 6, 11), (2021, 12, 5), (2003, 11, 24)])
def test_polar_paths_keep_each_edge_on_one_side(day):
    # 极区路径:两条边界各自连续,不在中途换到对侧(换边时相邻两点会跳出几百公里)
    result = E.eclipse_path(_jd(*day), 'prenatal')
    for edge in (result['north'], result['south']):
        steps = [_km(edge[i - 1], edge[i]) for i in range(1, len(edge))]
        track_steps = [_km(result['track'][i - 1], result['track'][i]) for i in range(1, len(result['track']))]
        assert max(steps) < 3 * max(track_steps) + 50
    mean = lambda rows: sum(p['lat'] for p in rows) / len(rows)
    assert mean(result['north']) >= mean(result['south'])


def test_acg_zone_without_colon():
    out = ACGraph({'date': '1990/03/01', 'time': '12:00:00', 'zone': '+0800', 'lat': '30n00', 'lon': '120e00', 'eclipse': 'prenatal'}).compute()['eclipse']
    assert out['local'] == '1990/01/27 03:30'


def test_partial_eclipse_has_no_central_line():
    result = E.eclipse_path(_jd(1975, 2, 11, 5.25), 'prenatal')
    assert result['type'] == 'partial' and not result['central']
    assert result['north'] == [] and result['south'] == [] and result['widthKm'] is None
    assert len(result['track']) > 100


def test_central_filter_skips_partial_eclipses():
    result = E.eclipse_path(_jd(1975, 2, 11, 5.25), 'prenatal', 'central')
    y, m, d, _ = swisseph.revjul(result['jd'])
    assert (y, m, d) == (1974, 6, 20) and result['central']


def test_postnatal_and_unknown_modes():
    after = E.eclipse_path(_jd(2024, 1, 1), 'postnatal', 'central')
    y, m, d, _ = swisseph.revjul(after['jd'])
    assert (y, m, d) == (2024, 4, 8) and after['daysFromBirth'] > 0
    assert E.eclipse_path(_jd(2024, 1, 1), 'off') is None
    assert E.eclipse_path(_jd(2024, 1, 1), 'prenatal', 'bogus')['filter'] == 'any'


BASE = {'date': '2017/08/22', 'time': '00:00:00', 'zone': '-05:00', 'lat': '36n58', 'lon': '87w40'}


def test_acg_only_computes_the_eclipse_when_asked():
    assert ACGraph(dict(BASE)).compute()['eclipse'] is None
    result = ACGraph(dict(BASE, eclipse='prenatal')).compute()['eclipse']
    assert result['type'] == 'total'
    assert result['utc'] == '2017/08/21 18:25'
    assert result['local'] == '2017/08/21 13:25'


def test_acg_rejects_unknown_eclipse_values():
    assert ACGraph(dict(BASE, eclipse='sideways')).compute()['eclipse'] is None


@pytest.mark.parametrize('day', [(2021, 6, 9), (2021, 12, 3), (2017, 8, 20)])
def test_band_edges_are_the_envelope_seen_from_the_ground(day):
    """食带边界 = 影斑扫过地面的包络。用另一条路径(sol_eclipse_when_loc:该地这次日食见不见得到中心食)判:
    边界内侧 5 km 见得到,外侧 5 km 见不到。高纬、日出日没段尤其要对(瞬时横截线在那里窄一半以上)。"""
    result = E.eclipse_path(_jd(*day), 'postnatal', 'central')
    track = result['track']

    def central(lat, lon):
        flag, tret, _ = swisseph.sol_eclipse_when_loc(result['jd'] - 0.3, (lon, lat, 0.0), E.FLAG, False)
        return bool(flag & E.CENTRAL_KINDS) and abs(tret[0] - result['jd']) < 0.3

    checked = 0
    for side in ('north', 'south'):
        for p in result[side][::8]:
            if abs(p['lat']) > 86.0:
                continue        # 极点附近「最近中心点 → 边界点」的方位没有定义,取不出内外 5 km 两点
            c = min(track, key=lambda q: _km(q, p))
            bearing = E._bearing(c, p)
            inner = E._destination(p['lat'], p['lon'], bearing, -5.0)
            outer = E._destination(p['lat'], p['lon'], bearing, 5.0)
            assert central(*inner), (side, p)
            assert not central(*outer), (side, p)
            checked += 1
    assert checked >= 18
