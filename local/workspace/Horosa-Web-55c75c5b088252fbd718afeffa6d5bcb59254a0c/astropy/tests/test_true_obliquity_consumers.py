"""三处黄道 → 赤道换算跟主盘走同一个出口:本日真黄赤交角(不是固定 23.44°)。

- 产前朔望(望):判日月谁在地平之上;
- 择日扫描的得时(hayyiz):半弧法判地平上下,天顶赤经 = ARMC;
- 量化盘赤纬接触:八颗虚星的赤纬。

判别例取公元 50 年:真交角约 23.69°,与 23.44° 差 0.25°,贴地平的判定和虚星赤纬都分得开。
判别器全走球面三角与 swisseph 的 ARMC,不经被测代码用的换算函数。
"""
import math
import os
import sys

import swisseph as swe

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const, utils  # noqa: E402
from flatlib.ephem import ephem as flatlib_ephem  # noqa: E402

FIXED = 23.44
LAT = 60.0


def _eps(jd):
    return swe.calc_ut(jd, swe.ECL_NUT, 0)[0][0]


def _eq(lon, lat, eps):
    """球面三角:黄道 → (赤经, 赤纬)。"""
    lam, beta, e = math.radians(lon), math.radians(lat), math.radians(eps)
    decl = math.asin(math.sin(beta) * math.cos(e) + math.cos(beta) * math.sin(e) * math.sin(lam))
    ra = math.atan2(math.sin(lam) * math.cos(e) - math.tan(beta) * math.sin(e), math.cos(lam))
    return math.degrees(ra) % 360.0, math.degrees(decl)


def _semi_arc(decl, lat):
    return 90.0 + math.degrees(math.asin(math.tan(math.radians(decl)) * math.tan(math.radians(lat))))


def _altitude(ra, decl, armc, lat):
    h, d, p = math.radians(armc - ra), math.radians(decl), math.radians(lat)
    return math.degrees(math.asin(math.sin(p) * math.sin(d) + math.cos(p) * math.cos(d) * math.cos(h)))


def _norm180(x):
    return (x + 180.0) % 360.0 - 180.0


def _armc(jd, lat, lon):
    return swe.houses(jd, lat, lon, b'P')[1][2]


# ── 产前朔望(望)──

def _full_moon_before(start_day):
    """公元 50 年夏至前后找一次产前望(太阳赤纬大,交角差最显)。"""
    from astrostudy.astroextra import compute_prenatal_syzygy
    for day in range(start_day, start_day + 40, 2):
        month, dom = (6, day) if day <= 30 else (7, day - 30)
        data = {'date': '0050/%02d/%02d' % (month, dom), 'time': '12:00:00', 'zone': '+00:00', 'lat': LAT, 'lon': 0.0}
        syz = compute_prenatal_syzygy(data)
        if syz.get('type') == 'full':
            return data, syz
    raise AssertionError('公元 50 年 6-7 月没找到产前望')


def test_prenatal_full_moon_luminary_above_horizon_uses_true_obliquity():
    from astrostudy.astroextra import compute_prenatal_syzygy
    data, syz = _full_moon_before(10)
    jd, sun_lon = syz['jd'], syz['sunLon']
    eps = _eps(jd)
    assert eps - FIXED > 0.2
    ra, decl = _eq(sun_lon, 0.0, eps)
    cases = 0
    # 太阳摆在真地平内侧 / 外侧各 0.3°(东、西两侧):固定交角的半弧小了约 0.8°,内侧那两例会判反
    for side in (1.0, -1.0):
        for inside in (0.3, -0.3):
            hour_angle = side * (_semi_arc(decl, LAT) - inside)
            geo_lon = _norm180(ra + hour_angle - _armc(jd, LAT, 0.0))
            armc = _armc(jd, LAT, geo_lon)
            sun_up = _altitude(ra, decl, armc, LAT) > 0
            assert sun_up == (inside > 0)
            got = compute_prenatal_syzygy(dict(data, lon=geo_lon))
            assert got['type'] == 'full' and abs(got['jd'] - jd) < 1e-4
            assert got['hylegBody'] == (const.SUN if sun_up else const.MOON), (side, inside, got['hylegBody'])
            # 判别力自证:这一例里固定 23.44° 的旧换算会得出相反结论
            o_ra, o_decl = utils.eqCoords(sun_lon, 0.0)
            o_mc = utils.eqCoords(swe.houses(jd, LAT, geo_lon, b'P')[1][1], 0.0)[0]
            if utils.isAboveHorizon(o_ra, o_decl, o_mc, LAT) != sun_up:
                cases += 1
    assert cases >= 2


# ── 择日扫描:得时的地平上下 ──

def _scan_moment(jd, geo_lon):
    from astrostudy import election_scan as es
    ctx = es.ScanContext({'zone': '+00:00', 'gpsLat': LAT, 'gpsLon': geo_lon, 'hsys': 0, 'zodiacal': 0, 'ad': 1})
    return es.LightMoment(jd, ctx)


def test_hayyiz_horizon_uses_armc_not_fixed_obliquity_mc():
    from astrostudy import election_scan  # noqa: F401  先载主模块,扩展模块才能注册
    from astrostudy import election_scan_ext as ext
    flips = 0
    start = swe.julday(50, 1, 1, 12.0, swe.JUL_CAL)
    for step in range(0, 365, 5):
        jd = start + step
        ra, decl = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_EQUATORIAL)[0][:2]
        half = _semi_arc(decl, LAT)
        for side in (1.0, -1.0):
            for inside in (0.02, -0.02):
                geo_lon = _norm180(ra + side * (half - inside) - _armc(jd, LAT, 0.0))
                armc = _armc(jd, LAT, geo_lon)
                want = _altitude(ra, decl, armc, LAT) > 0
                assert want == (inside > 0)
                m = _scan_moment(jd, geo_lon)
                assert bool(ext._above_horizon_semiarc(m, 'Sun')) == want, (step, side, inside)
                old_mc = utils.eqCoords(m.mc(), 0)[0]
                if utils.isAboveHorizon(ra, decl, old_mc, LAT) != want:
                    flips += 1
    assert flips >= 10   # 固定交角算出的天顶赤经偏到 0.05°,这批贴地平的例子里旧写法大量判反


def test_hayyiz_mc_right_ascension_is_armc_in_modern_years_too():
    from astrostudy import election_scan  # noqa: F401  先载主模块,扩展模块才能注册
    from astrostudy import election_scan_ext as ext
    jd = swe.julday(2024, 4, 8, 4.0)
    ra, decl = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH | swe.FLG_EQUATORIAL)[0][:2]
    half = _semi_arc(decl, LAT)
    for side in (1.0, -1.0):
        for inside in (0.0003, -0.0003):   # 约 1 角秒:现代年份的回归保护,贴地平内外都按 ARMC 判
            geo_lon = _norm180(ra + side * (half + 0.0003 - inside) - _armc(jd, LAT, 0.0))
            m = _scan_moment(jd, geo_lon)
            dist = abs(_norm180(_armc(jd, LAT, geo_lon) - ra))
            assert bool(ext._above_horizon_semiarc(m, 'Sun')) == (dist <= half + 0.0003)


# ── 量化盘:虚星赤纬 ──

def _tnp_chart(date):
    from astrostudy import perchart
    return perchart.PerChart({'date': date, 'time': '21:15:00', 'zone': '-08:00', 'lat': '47n36', 'lon': '122w20',
                              'hsys': 0, 'tradition': False, 'predictive': False, 'zodiacal': 0})


def test_tnp_declinations_use_true_obliquity():
    from astrostudy.germany.declination import _tnp_decls, compute_declination
    for date, min_gap in (('0050/02/10', 0.05), ('1975/02/10', 0.0)):
        pc = _tnp_chart(date)
        jd = pc.dateTime.jd
        eps = _eps(jd)
        got = _tnp_decls(pc)
        assert set(got) == set(const.LIST_URANIAN)
        worst_old = 0.0
        for oid in const.LIST_URANIAN:
            obj = flatlib_ephem.getObject(oid, pc.dateTime, pc.pos)
            want = _eq(obj.lon, obj.lat, eps)[1]
            assert abs(got[oid] - want) < 1e-6, (date, oid, got[oid], want)
            worst_old = max(worst_old, abs(utils.eqCoords(obj.lon, obj.lat)[1] - want))
        assert worst_old > min_gap, (date, worst_old)   # 公元 50 年:固定交角的旧值差到 0.2° 以上
        if min_gap == 0.0:
            assert worst_old < 0.002                    # 现代年份:差不到 0.002°
        # 接触表里虚星的赤纬就是这一份
        rows = compute_declination(pc, include_tnp=True)
        for row in rows['parallel'] + rows['contraParallel']:
            for key, dkey in (('a', 'decA'), ('b', 'decB')):
                if row[key] in got:
                    assert abs(row[dkey] - got[row[key]]) < 1e-3
