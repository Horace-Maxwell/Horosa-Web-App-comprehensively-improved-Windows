# -*- coding: utf-8 -*-
"""chart3d 全行星中心盘引擎测试。

覆盖四层:
1. 黄经冻结:3 个固定历史时刻 × 全部 11 中心,容差 1e-6(期望值由引擎生成后
   经人工 sanity 固化:J2000 地心太阳 280.369/月亮 223.324 与公开天文值吻合,
   且日心地球=地心太阳镜像、行星心地球=地心该行星镜像两条独立交叉核对全过);
2. 结构不变式:中心体永不在 bodies / helio 无太阳 / 非地心必有地球 / 镜像关系
   / 闭合轨道首尾点距<步长 / 尾迹正中样本=当前时刻 / T_syn 推导值抽查;
3. ET/UT 负向钉死:把 jd_ut 直传 calc_pctr 必偏离,走 _to_et 唯一入口则逐位一致;
4. 源码级隔离守卫:禁 import perchart/perpredict/pd_engine,deltat 全文件仅一处。
"""

import ast
import math
import os

import pytest
import swisseph

from astrostudy import chart3d


# 3 个固定历史时刻(UT 儒略日直接冻结,不经历法/时区解析)
JD_1900 = 2415020.0    # 1899-12-31 12:00 UT(儒略纪元 1900.0)
JD_J2000 = 2451545.0   # 2000-01-01 12:00 UT(J2000.0)
JD_2024 = 2460310.5    # 2024-01-01 00:00 UT

EPOCHS = (JD_1900, JD_J2000, JD_2024)

# 平面中心行星心时地球出现、helio 默认无月:与 default_bodies 规则一致的冻结表
FROZEN_LON = {
    (JD_1900, 'geo'): {'Sun': 279.643439939, 'Moon': 265.297047294, 'Mercury': 258.362877511, 'Venus': 305.752645997, 'Mars': 283.482612280, 'Jupiter': 241.037993313, 'Saturn': 267.658595857, 'Uranus': 250.111585668, 'Neptune': 85.232335502, 'Pluto': 75.260109119},
    (JD_1900, 'helio'): {'Mercury': 199.679107385, 'Venus': 342.338275460, 'Earth': 99.643439939, 'Mars': 286.146576285, 'Jupiter': 234.499931935, 'Saturn': 266.502045326, 'Uranus': 248.654406877, 'Neptune': 85.696557880, 'Pluto': 75.757261259},
    (JD_1900, 'moon'): {'Sun': 279.679496807, 'Mercury': 258.347945072, 'Venus': 305.815699897, 'Earth': 85.297047188, 'Mars': 283.501280898, 'Jupiter': 241.028643654, 'Saturn': 267.659330537, 'Uranus': 250.109905750, 'Neptune': 85.232139001, 'Pluto': 75.260453518},
    (JD_1900, 'mercury'): {'Sun': 19.679002293, 'Moon': 78.347943778, 'Venus': 355.793592938, 'Earth': 78.362876167, 'Mars': 302.774609919, 'Jupiter': 237.213554949, 'Saturn': 268.724267541, 'Uranus': 249.622754570, 'Neptune': 84.966679876, 'Pluto': 75.327262910},
    (JD_1900, 'venus'): {'Sun': 162.338287756, 'Moon': 125.815699253, 'Mercury': 175.793590407, 'Earth': 125.752645510, 'Mars': 255.473304693, 'Jupiter': 227.468551103, 'Saturn': 262.429665507, 'Uranus': 246.473900784, 'Neptune': 87.042678042, 'Pluto': 76.652875954},
    (JD_1900, 'mars'): {'Sun': 106.146556691, 'Moon': 103.501261934, 'Mercury': 122.774604382, 'Venus': 75.473307476, 'Earth': 103.482593270, 'Jupiter': 220.596638049, 'Saturn': 263.371720237, 'Uranus': 245.885342849, 'Neptune': 86.604217981, 'Pluto': 76.619895406},
    (JD_1900, 'jupiter'): {'Sun': 54.499926467, 'Moon': 61.028645685, 'Mercury': 57.213552799, 'Venus': 47.468556704, 'Earth': 61.037994983, 'Mars': 40.596640920, 'Saturn': 293.928347034, 'Uranus': 254.117513183, 'Neptune': 81.068801964, 'Pluto': 73.576785624},
    (JD_1900, 'saturn'): {'Sun': 86.502041845, 'Moon': 87.659339772, 'Mercury': 88.724263352, 'Venus': 82.429677838, 'Earth': 87.658605111, 'Mars': 83.371727940, 'Jupiter': 113.928339149, 'Uranus': 230.509113123, 'Neptune': 85.898028636, 'Pluto': 77.668307115},
    (JD_1900, 'uranus'): {'Sun': 68.654403975, 'Moon': 70.109907831, 'Mercury': 69.622735860, 'Venus': 66.473915088, 'Earth': 70.111587037, 'Mars': 65.885348362, 'Jupiter': 74.117518115, 'Saturn': 50.509115898, 'Neptune': 79.083748383, 'Pluto': 73.691694808},
    (JD_1900, 'neptune'): {'Sun': 265.696551463, 'Moon': 265.232132161, 'Mercury': 264.966715500, 'Venus': 267.042652075, 'Earth': 265.232328589, 'Mars': 266.604206470, 'Jupiter': 261.068795094, 'Saturn': 265.898019105, 'Uranus': 259.083741909, 'Pluto': 58.784197569},
    (JD_1900, 'pluto'): {'Sun': 255.757259308, 'Moon': 255.260453220, 'Mercury': 255.327322404, 'Venus': 256.652845384, 'Earth': 255.260109770, 'Mars': 256.619886782, 'Jupiter': 253.576781044, 'Saturn': 257.668301591, 'Uranus': 253.691689843, 'Neptune': 238.784194538},
    (JD_J2000, 'geo'): {'Sun': 280.368918670, 'Moon': 223.323751446, 'Mercury': 271.889277046, 'Venus': 241.565788383, 'Mars': 327.963302526, 'Jupiter': 25.253087179, 'Saturn': 40.395663495, 'Uranus': 314.809187722, 'Neptune': 303.193013225, 'Pluto': 251.454779295},
    (JD_J2000, 'helio'): {'Mercury': 253.773615016, 'Venus': 182.593422792, 'Earth': 100.368918671, 'Mars': 359.438875097, 'Jupiter': 36.288191087, 'Saturn': 45.716480136, 'Uranus': 316.413528632, 'Neptune': 303.923960608, 'Pluto': 250.541223008},
    (JD_J2000, 'moon'): {'Sun': 280.500212116, 'Mercury': 271.970831853, 'Venus': 241.608342298, 'Earth': 43.323751211, 'Mars': 328.043535027, 'Jupiter': 25.263209823, 'Saturn': 40.396384471, 'Uranus': 314.816581131, 'Neptune': 303.197910920, 'Pluto': 251.457316188},
    (JD_J2000, 'mercury'): {'Sun': 73.773692037, 'Moon': 91.970835428, 'Venus': 144.809460597, 'Earth': 91.889280737, 'Mars': 15.910981569, 'Jupiter': 39.324604821, 'Saturn': 47.019220676, 'Uranus': 317.619211769, 'Neptune': 304.615571011, 'Pluto': 250.497082825},
    (JD_J2000, 'venus'): {'Sun': 2.593493625, 'Moon': 61.608341759, 'Mercury': 324.809463584, 'Earth': 61.565787873, 'Mars': 0.507721137, 'Jupiter': 32.181070044, 'Saturn': 42.811228528, 'Uranus': 317.864212116, 'Neptune': 305.074253934, 'Pluto': 251.842937948},
    (JD_J2000, 'mars'): {'Sun': 179.438846461, 'Moon': 148.043534362, 'Mercury': 195.910977572, 'Venus': 180.507719532, 'Earth': 147.963302087, 'Jupiter': 48.510245029, 'Saturn': 52.694425966, 'Uranus': 313.543473403, 'Neptune': 301.688607740, 'Pluto': 248.036665638},
    (JD_J2000, 'jupiter'): {'Sun': 216.288182665, 'Moon': 205.263209238, 'Mercury': 219.324598286, 'Venus': 212.181069815, 'Earth': 205.253086751, 'Mars': 228.510242286, 'Saturn': 56.478545388, 'Uranus': 302.025156186, 'Neptune': 294.634248286, 'Pluto': 245.807066134},
    (JD_J2000, 'saturn'): {'Sun': 225.716473699, 'Moon': 220.396384298, 'Mercury': 227.019212193, 'Venus': 222.811229846, 'Earth': 220.395663352, 'Mars': 232.694422209, 'Jupiter': 236.478542757, 'Uranus': 291.560979234, 'Neptune': 288.241157357, 'Pluto': 244.747313531},
    (JD_J2000, 'uranus'): {'Sun': 136.413527522, 'Moon': 134.816578473, 'Mercury': 137.619185219, 'Venus': 137.864200403, 'Earth': 134.809187515, 'Mars': 133.543471377, 'Jupiter': 122.025150584, 'Saturn': 111.560968180, 'Neptune': 281.934630130, 'Pluto': 210.330837375},
    (JD_J2000, 'neptune'): {'Sun': 123.923960427, 'Moon': 123.197905295, 'Mercury': 124.615535674, 'Venus': 125.074234369, 'Earth': 123.193011200, 'Mars': 121.688605265, 'Jupiter': 114.634239769, 'Saturn': 108.241141765, 'Uranus': 101.934597159, 'Pluto': 186.338946142},
    (JD_J2000, 'pluto'): {'Sun': 70.541226038, 'Moon': 71.457313936, 'Mercury': 70.497089053, 'Venus': 71.842926635, 'Earth': 71.454778861, 'Mars': 68.036673954, 'Jupiter': 65.807070161, 'Saturn': 64.747317326, 'Uranus': 30.330839841, 'Neptune': 6.338948460},
    (JD_2024, 'geo'): {'Sun': 280.038993302, 'Moon': 155.992188221, 'Mercury': 262.281705890, 'Venus': 242.612309688, 'Mars': 267.308354421, 'Jupiter': 35.582393204, 'Saturn': 333.243554972, 'Uranus': 49.383917349, 'Neptune': 355.076166825, 'Pluto': 299.357666773},
    (JD_2024, 'helio'): {'Mercury': 144.214492224, 'Venus': 186.439465123, 'Earth': 100.038993303, 'Mars': 258.900608523, 'Jupiter': 45.834236250, 'Saturn': 337.887213532, 'Uranus': 51.602543435, 'Neptune': 356.898538594, 'Pluto': 299.897516733},
    (JD_2024, 'moon'): {'Sun': 280.169025637, 'Mercury': 262.472689224, 'Venus': 242.743055435, 'Earth': 335.992188470, 'Mars': 267.367711889, 'Jupiter': 35.552533424, 'Saturn': 333.244089619, 'Uranus': 49.376054574, 'Neptune': 355.074314446, 'Pluto': 299.360094258},
    (JD_2024, 'mercury'): {'Sun': 324.214635658, 'Moon': 82.472687750, 'Venus': 212.481589479, 'Earth': 82.281704495, 'Mars': 269.673035502, 'Jupiter': 42.011321282, 'Saturn': 337.420553233, 'Uranus': 50.612481315, 'Neptune': 356.542535773, 'Pluto': 300.115563696},
    (JD_2024, 'venus'): {'Sun': 6.439544934, 'Moon': 62.743054827, 'Mercury': 32.481587829, 'Earth': 62.612309229, 'Mars': 287.391307339, 'Jupiter': 41.118235403, 'Saturn': 339.781276305, 'Uranus': 50.145613726, 'Neptune': 357.115236085, 'Pluto': 300.969746772},
    (JD_2024, 'mars'): {'Sun': 78.900624885, 'Moon': 87.367717473, 'Mercury': 89.673036172, 'Venus': 107.391300564, 'Earth': 87.308360253, 'Jupiter': 53.224410458, 'Saturn': 346.629685255, 'Uranus': 53.456828296, 'Neptune': 359.686351996, 'Pluto': 301.548898839},
    (JD_2024, 'jupiter'): {'Sun': 225.834227636, 'Moon': 215.552533142, 'Mercury': 222.011331381, 'Venus': 221.118235265, 'Earth': 215.582392457, 'Mars': 233.224407183, 'Saturn': 307.450752337, 'Uranus': 53.562422877, 'Neptune': 348.865551090, 'Pluto': 292.365113409},
    (JD_2024, 'saturn'): {'Sun': 157.887210249, 'Moon': 153.244089676, 'Mercury': 157.420556787, 'Venus': 159.781271106, 'Earth': 153.243555077, 'Mars': 166.629681633, 'Jupiter': 127.450748097, 'Uranus': 80.560983819, 'Neptune': 5.610830092, 'Pluto': 287.480627661},
    (JD_2024, 'uranus'): {'Sun': 231.602537805, 'Moon': 229.376058094, 'Mercury': 230.612525499, 'Venus': 230.145618740, 'Earth': 229.383918730, 'Mars': 233.456823971, 'Jupiter': 233.562419886, 'Saturn': 260.560977128, 'Neptune': 316.127527395, 'Pluto': 276.508295421},
    (JD_2024, 'neptune'): {'Sun': 176.898535195, 'Moon': 175.074321999, 'Mercury': 176.542573089, 'Venus': 177.115231048, 'Earth': 175.076173192, 'Mars': 179.686345808, 'Jupiter': 168.865548980, 'Saturn': 185.610827860, 'Uranus': 136.127523709, 'Pluto': 246.462159420},
    (JD_2024, 'pluto'): {'Sun': 119.897516740, 'Moon': 119.360088791, 'Mercury': 120.115522969, 'Venus': 120.969722963, 'Earth': 119.357663732, 'Mars': 121.548889987, 'Jupiter': 112.365103929, 'Saturn': 107.480613112, 'Uranus': 96.508323998, 'Neptune': 66.462163499},
}


def _lon_of(state_obj, body_id):
    for b in state_obj['bodies']:
        if b['id'] == body_id:
            return b['lon']
    raise AssertionError('body {0} not in bodies'.format(body_id))


def _ids_of(state_obj):
    return [b['id'] for b in state_obj['bodies']]


def _ang_diff(a, b):
    return abs((a - b + 180.0) % 360.0 - 180.0)


def _xyz(sample):
    lon = math.radians(sample['lon'])
    lat = math.radians(sample['lat'])
    r = sample['dist']
    return (r * math.cos(lat) * math.cos(lon),
            r * math.cos(lat) * math.sin(lon),
            r * math.sin(lat))


def _dist3(a, b):
    xa, ya, za = _xyz(a)
    xb, yb, zb = _xyz(b)
    return math.sqrt((xa - xb) ** 2 + (ya - yb) ** 2 + (za - zb) ** 2)


@pytest.fixture(scope='module')
def orbit_states():
    """带轨道的完整状态(覆盖闭合/尾迹全部形态类:日心/地心/月心/火星心)。"""
    return {c: chart3d.state(c, JD_2024) for c in ('helio', 'geo', 'moon', 'mars')}


# ---------------------------------------------------------------------------
# 1. 黄经冻结:3 时刻 × 11 中心,容差 1e-6
# ---------------------------------------------------------------------------

def test_frozen_longitudes_all_centers():
    for (jd, center), expected in FROZEN_LON.items():
        st = chart3d.state(center, jd, with_orbits=False)
        assert sorted(_ids_of(st)) == sorted(expected.keys()), (jd, center)
        for body_id, lon in expected.items():
            got = _lon_of(st, body_id)
            assert abs(got - lon) < 1e-6, (jd, center, body_id, got, lon)


# ---------------------------------------------------------------------------
# 2. 结构不变式
# ---------------------------------------------------------------------------

def test_center_body_never_in_bodies():
    for center in chart3d.VALID_CENTERS:
        st = chart3d.state(center, JD_J2000, with_orbits=False)
        assert chart3d.CENTER_BODY_NAME[center] not in _ids_of(st), center


def test_helio_has_no_sun_and_default_no_moon():
    st = chart3d.state('helio', JD_J2000, with_orbits=False)
    ids = _ids_of(st)
    assert 'Sun' not in ids
    assert 'Moon' not in ids
    assert st['includeMoon'] is False
    # 显式开月:日心盘也可单列月球
    st2 = chart3d.state('helio', JD_J2000, include_moon=True, with_orbits=False)
    assert 'Moon' in _ids_of(st2)


def test_earth_present_in_all_non_geo_centers():
    for center in chart3d.VALID_CENTERS:
        if center == 'geo':
            continue
        st = chart3d.state(center, JD_J2000, with_orbits=False)
        assert 'Earth' in _ids_of(st), center


def test_include_moon_default_true_outside_helio():
    for center in ('geo', 'mars', 'pluto'):
        st = chart3d.state(center, JD_J2000, with_orbits=False)
        assert st['includeMoon'] is True, center
        assert 'Moon' in _ids_of(st), center


def test_unknown_center_falls_back_to_geo():
    st = chart3d.state('vulcan', JD_J2000, with_orbits=False)
    assert st['center'] == 'geo'
    assert _lon_of(st, 'Sun') == pytest.approx(FROZEN_LON[(JD_J2000, 'geo')]['Sun'], abs=1e-9)


def test_helio_earth_mirrors_geo_sun():
    """日心地球 ≈ 地心太阳 + 180°(容差 0.02°):两条计算路径独立交叉核对。"""
    for jd in EPOCHS:
        geo = chart3d.state('geo', jd, with_orbits=False)
        helio = chart3d.state('helio', jd, with_orbits=False)
        assert _ang_diff(_lon_of(helio, 'Earth'),
                         _lon_of(geo, 'Sun') + 180.0) < 0.02, jd


def test_pctr_earth_mirrors_geo_center_planet():
    """行星心/月心的地球 ≈ 地心该天体 + 180°:calc_pctr 与 calc_ut 双路径互证。"""
    geo = chart3d.state('geo', JD_J2000, with_orbits=False)
    for center in chart3d.CENTER_SWE_ID:
        st = chart3d.state(center, JD_J2000, with_orbits=False)
        mirror = _lon_of(geo, chart3d.CENTER_BODY_NAME[center]) + 180.0
        assert _ang_diff(_lon_of(st, 'Earth'), mirror) < 0.001, center


def test_eps_is_true_value_of_date():
    """eps = 当日真黄赤交角(ECL_NUT 直取),且随历元漂移(证非写死常量)。"""
    st = chart3d.state('geo', JD_J2000, with_orbits=False)
    xx, _ = swisseph.calc_ut(JD_J2000, swisseph.ECL_NUT, 0)
    assert st['eps'] == pytest.approx(xx[0], abs=1e-12)
    eps_1900 = chart3d.state('geo', JD_1900, with_orbits=False)['eps']
    assert abs(eps_1900 - st['eps']) > 0.005


# ---------------------------------------------------------------------------
# 3. 轨道线不变式
# ---------------------------------------------------------------------------

def test_closed_orbits_close_within_step(orbit_states):
    """闭合轨道首尾点距 < 相邻步长(含日心全九星/太阳镜像/卫星整圈全部形态)。"""
    checked = 0
    for center, st in orbit_states.items():
        for body_id, orbit in st['orbits'].items():
            if not orbit['closed']:
                continue
            samples = orbit['samples']
            step = _dist3(samples[0], samples[1])
            gap = _dist3(samples[0], samples[-1])
            assert gap < step, (center, body_id, gap, step)
            checked += 1
    assert checked >= 12  # 日心 9 + 地心 2(日/月) + 月心 2(日/地) + 火心 1(日)中至少大半


def test_helio_orbits_all_closed(orbit_states):
    for body_id, orbit in orbit_states['helio']['orbits'].items():
        assert orbit['closed'] is True, body_id
        assert len(orbit['samples']) == chart3d.DEFAULT_ORBIT_SAMPLES


def test_sun_orbit_is_center_planet_mirror_closed(orbit_states):
    """行星心盘的太阳轨迹 = 中心行星自身轨道镜像:closed 且周期=中心体恒星周期。"""
    sun_mars = orbit_states['mars']['orbits']['Sun']
    assert sun_mars['closed'] is True
    assert sun_mars['periodDays'] == pytest.approx(
        chart3d.SIDEREAL_PERIOD_YEARS['Mars'] * chart3d.DAYS_PER_JULIAN_YEAR)
    sun_moon = orbit_states['moon']['orbits']['Sun']
    assert sun_moon['closed'] is True
    assert sun_moon['periodDays'] == pytest.approx(
        chart3d.SIDEREAL_PERIOD_YEARS['Earth'] * chart3d.DAYS_PER_JULIAN_YEAR)


def test_moon_follows_earth_window(orbit_states):
    """行星心盘的月球尾迹跟随地球窗口(同会合周期同形态)。"""
    orbits = orbit_states['mars']['orbits']
    assert orbits['Moon']['closed'] is False
    assert orbits['Earth']['closed'] is False
    assert orbits['Moon']['periodDays'] == pytest.approx(orbits['Earth']['periodDays'])


def test_trail_middle_sample_is_current_position(orbit_states):
    """尾迹点数为奇数,正中样本时刻=当前时刻(与 bodies 黄经逐位一致)。"""
    st = orbit_states['mars']
    for body_id, orbit in st['orbits'].items():
        if orbit['closed']:
            continue
        samples = orbit['samples']
        assert len(samples) % 2 == 1, body_id
        mid = samples[(len(samples) - 1) // 2]
        assert _ang_diff(mid['lon'], _lon_of(st, body_id)) < 1e-9, body_id
        assert 'dist' in mid and mid['dist'] > 0.0


def test_trail_default_sample_count(orbit_states):
    """默认 orbit_samples=128 → 尾迹 181 点(±1 会合周期窗口)。"""
    orbit = orbit_states['mars']['orbits']['Jupiter']
    assert orbit['closed'] is False
    assert len(orbit['samples']) == 181


def test_orbit_samples_param_adjustable():
    orbit = chart3d.orbit_for(JD_2024, 'helio', 'Mars', orbit_samples=64)
    assert len(orbit['samples']) == 64
    trail = chart3d.orbit_for(JD_2024, 'geo', 'Mars', orbit_samples=64)
    assert len(trail['samples']) % 2 == 1
    assert len(trail['samples']) == 91  # round(64*181/128)=91(取奇)


def test_synodic_period_derivation():
    """T_syn 由 1/T_syn=|1/T_a−1/T_c| 推导:火星/地心≈779.9 天,金星/地心≈583.9 天。"""
    assert chart3d.synodic_period_days('Mars', 'geo') == pytest.approx(779.9, abs=0.5)
    assert chart3d.synodic_period_days('Venus', 'geo') == pytest.approx(583.9, abs=0.5)
    # 地/月互看无会合周期(同日心周期)→ None,轨道走闭合分支
    assert chart3d.synodic_period_days('Earth', 'moon') is None
    assert chart3d._orbit_plan('moon', 'Earth') == (True, chart3d.MOON_SIDEREAL_DAYS)


# ---------------------------------------------------------------------------
# 4. 相位
# ---------------------------------------------------------------------------

def test_aspects_structure_and_orb():
    st = chart3d.state('geo', JD_J2000, with_orbits=False)
    ids = set(_ids_of(st))
    assert st['aspects'], '默认盘至少应有一条相位'
    for asp in st['aspects']:
        assert asp['a'] in ids and asp['b'] in ids
        assert asp['aspect'] in chart3d.DEFAULT_ASPECT_ANGLES
        assert 0.0 <= asp['orb'] <= chart3d.DEFAULT_ASPECT_ORB
        assert isinstance(asp['applying'], bool)


def test_aspects_orb_and_angles_adjustable():
    tight = chart3d.state('geo', JD_J2000, asporb=0.5, with_orbits=False)
    loose = chart3d.state('geo', JD_J2000, asporb=3.0, with_orbits=False)
    assert len(tight['aspects']) <= len(loose['aspects'])
    for asp in tight['aspects']:
        assert asp['orb'] <= 0.5
    only_opp = chart3d.state('geo', JD_J2000, aspect_angles=[180],
                             with_orbits=False)
    for asp in only_opp['aspects']:
        assert asp['aspect'] == 180.0


# ---------------------------------------------------------------------------
# 5. ET/UT 负向钉死 + 源码级隔离守卫
# ---------------------------------------------------------------------------

def test_jd_ut_direct_to_calc_pctr_must_deviate():
    """故意把 jd_ut 直传 calc_pctr(漏 ΔT)结果必偏离;走 _to_et 唯一入口则逐位一致。"""
    st = chart3d.state('moon', JD_2024, with_orbits=False)
    earth_lon = _lon_of(st, 'Earth')
    flags = swisseph.FLG_SWIEPH | swisseph.FLG_SPEED
    # 负向:漏 ΔT 必偏离(月心地球日行约 12°,ΔT≈70s → 偏差量级 1e-2°)
    wrong, _ = swisseph.calc_pctr(JD_2024, swisseph.EARTH, swisseph.MOON, flags)
    assert _ang_diff(wrong[0] % 360.0, earth_lon) > 1e-4
    # 正向:经唯一入口 _to_et 换算后与引擎输出逐位一致
    right, _ = swisseph.calc_pctr(chart3d._to_et(JD_2024), swisseph.EARTH,
                                  swisseph.MOON, flags)
    assert _ang_diff(right[0] % 360.0, earth_lon) < 1e-9


def test_source_isolation_and_single_deltat_entry():
    """源码守卫:chart3d 禁 import perchart/perpredict/pd_engine;deltat 全文件仅一处。"""
    src_path = os.path.join(os.path.dirname(chart3d.__file__), 'chart3d.py')
    with open(src_path, 'r', encoding='utf-8') as fh:
        src = fh.read()
    # AST 级检查真实 import(注释/docstring 提及不算)
    tree = ast.parse(src)
    banned = ('perchart', 'perpredict', 'pd_engine')
    for node in ast.walk(tree):
        modules = []
        if isinstance(node, ast.Import):
            modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            modules = [node.module or '']
        for mod in modules:
            for word in banned:
                assert word not in mod, '结构性隔离被破坏: import {0}'.format(mod)
    # UT→ET 换算唯一入口:swisseph.deltat 调用点全文件必须恰好 1 处(_to_et 内)
    assert src.count('swisseph.deltat(') == 1
