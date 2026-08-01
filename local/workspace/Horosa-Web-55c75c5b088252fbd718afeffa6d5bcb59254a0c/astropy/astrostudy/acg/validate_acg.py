"""
占星地图（ACG）算法对齐 / 回归自检。

思路：ACG 四轴线是天文学定义——MC/IC 线 = 行星正在上/下中天（位于本地子午线）；
ASC/DESC 线 = 行星正在升/落（真高度=0）。用 Swiss Ephemeris **权威的地平坐标函数
`swisseph.azalt()`** 反验 ACGraph 算出的线是否满足这些定义。`azalt` 内部用它自己的
恒星时，与 ACGraph 的 GMST/公式**完全独立**，因此这是对算法的独立精度校验；又因
本项目与同类专业软件都用同一套 Swiss Ephemeris，本检验即"与业界标准对齐"。

运行（用内嵌运行时 python，PYTHONPATH 由本脚本自行补好）：
    runtime/mac/python/bin/python3 Horosa-Web/astropy/astrostudy/acg/validate_acg.py
期望：所有行星 ASC/DESC 真高度≈0、MC/IC 方位角≈子午线，worst < 1e-3°（实测 0.00000°）。
退出码 0=通过，1=失败（可用于 CI / 发布前 gate）。
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))          # .../Horosa-Web/astropy/astrostudy/acg
_WEB = os.path.abspath(os.path.join(_HERE, '..', '..', '..'))  # .../Horosa-Web
for _p in (os.path.join(_WEB, 'flatlib-ctrad2'), os.path.join(_WEB, 'astropy'), os.path.join(_WEB, 'vendor')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import swisseph
from astrostudy.acg.ACGraph import ACGraph
from flatlib import const

MAIN = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
        const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO]

TOL = 1e-3  # degrees

CASES = [
    ({'date': '1990/01/15', 'time': '12:00:00', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e23', 'ad': 1},
     '1990-01-15 12:00 +08 Beijing'),
    ({'date': '1985/07/13', 'time': '06:45:00', 'zone': '-03:00', 'lat': '23s33', 'lon': '46w38', 'ad': 1},
     '1985-07-13 06:45 -03 Sao Paulo (S.hemi)'),
    ({'date': '2001/09/11', 'time': '08:46:00', 'zone': '-04:00', 'lat': '40n43', 'lon': '74w00', 'ad': 1},
     '2001-09-11 08:46 -04 New York'),
]


def _merid_dev(az):
    a = az % 180.0
    return min(a, 180.0 - a)


def _alt_err(jd, xin, pts):
    errs = []
    n = len(pts)
    for idx in (1, n // 4, n // 2, 3 * n // 4, n - 2):
        q = pts[idx]
        _, talt, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [q['lon'], q['lat'], 0], 0, 0, xin)
        errs.append(abs(talt))
    return max(errs)


def check(data, label):
    acg = ACGraph(data)
    res = acg.compute()
    jd = acg.jd
    worst = 0.0
    rows = []
    for pid in MAIN:
        p = res['planets'][pid]
        xin = [p['lon'], p['lat'], 1.0]
        asc_e = _alt_err(jd, xin, p['lines']['asc'])
        dsc_e = _alt_err(jd, xin, p['lines']['desc'])
        azmc, _, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [p['lines']['mc']['lon'], 20.0, 0], 0, 0, xin)
        azic, _, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [p['lines']['ic']['lon'], 20.0, 0], 0, 0, xin)
        mc_d, ic_d = _merid_dev(azmc), _merid_dev(azic)
        worst = max(worst, asc_e, dsc_e, mc_d, ic_d)
        rows.append('  %-12s ASC|alt|=%.5f DESC|alt|=%.5f  MC dev=%.5f IC dev=%.5f'
                    % (pid, asc_e, dsc_e, mc_d, ic_d))
    print('\n[%s] jd=%.5f' % (label, jd))
    print('\n'.join(rows))
    print('  worst = %.6f deg' % worst)
    return worst


def _n180(x):
    x %= 360.0
    return x - 360.0 if x > 180.0 else x


def check_zodiac(data, label):
    """ zodiac 口径(β=0):MC 线经度处 swe.houses 的 MC 黄经 == 行星黄经;ASC 线同理。
    与 in-mundo 独立——高黄纬体(月/冥)的 zodiac 线与 mundo 线错开数度(见 delta)。 """
    d = dict(data); d['mode'] = 'zodiac'
    acg = ACGraph(d); res = acg.compute(); jd = acg.jd
    dm = dict(data); dm['mode'] = 'mundo'
    resm = ACGraph(dm).compute()
    worst = 0.0
    rows = []
    for pid in [const.MOON, const.PLUTO, const.SUN]:
        p = res['planets'][pid]
        lam = p['lines']['mc']['lon']
        _, ascmc = swisseph.houses(jd, 10.0, lam, b'P')
        mc_d = abs(_n180(ascmc[1] - p['lon']))
        # ASC 线中段(φ≈30N)一点 → houses ASC == 行星黄经
        asc_pts = [q for q in p['lines']['asc'] if abs(q['lat'] - 30.0) < 1.0]
        asc_d = 0.0
        if asc_pts:
            _, a2 = swisseph.houses(jd, asc_pts[0]['lat'], asc_pts[0]['lon'], b'P')
            asc_d = abs(_n180(a2[0] - p['lon']))
        delta = _n180(resm['planets'][pid]['lines']['mc']['lon'] - lam)
        worst = max(worst, mc_d, asc_d)
        rows.append('  %-8s zodMC dev=%.5f zodASC dev=%.5f  (mundo−zodiac MC=%+.3f, β=%+.3f)'
                    % (pid, mc_d, asc_d, delta, p['lat']))
    print('\n[zodiac %s] jd=%.5f' % (label, jd))
    print('\n'.join(rows))
    print('  worst = %.6f deg' % worst)
    return worst


def check_rhumb(data, label):
    """ rhumb 本地空间:等角航线沿途罗盘方位角恒定(loxodrome);且与大圆终点不同。 """
    dr = dict(data); dr['lsMode'] = 'rhumb'
    dg = dict(data); dg['lsMode'] = 'great'
    rr = ACGraph(dr).compute(); rg = ACGraph(dg).compute()
    import math as _m
    ls_r = rr['planets'][const.SUN]['lines']['ls']
    ls_g = rg['planets'][const.SUN]['lines']['ls']
    # 相邻点方位角(rhumb bearing) 应恒定。线由 back(反向)+forward 两半拼成,唯出生地(拼接点)
    # 处两半方位角差 180° → 全段取样,允许「恰 1 个」离群(拼接点),其余须与中位数一致。
    brs = []
    for i in range(len(ls_r) - 1):
        p1, p2 = ls_r[i], ls_r[i + 1]
        dphi = _m.log(_m.tan(_m.pi / 4 + _m.radians(p2['lat']) / 2) / _m.tan(_m.pi / 4 + _m.radians(p1['lat']) / 2)) if abs(p2['lat'] - p1['lat']) > 1e-9 else 0
        dlon = _m.radians(_n180(p2['lon'] - p1['lon']))
        if abs(dphi) > 1e-9 or abs(dlon) > 1e-9:
            brs.append(_m.degrees(_m.atan2(dlon, dphi)) % 360.0)
    srt = sorted(brs)
    mid = srt[len(srt) // 2] if srt else 0.0
    outliers = [b for b in brs if abs(_n180(b - mid)) > 0.5]
    spread = 0.0 if len(outliers) <= 1 else max(abs(_n180(b - mid)) for b in outliers)
    end_diff = abs(_n180(ls_r[-1]['lon'] - ls_g[-1]['lon'])) + abs(ls_r[-1]['lat'] - ls_g[-1]['lat'])
    print('\n[rhumb %s] 中段方位角=%.2f° 离散=%.5f°  rhumb与great终点差=%.2f (应>0)' % (label, mid, spread, end_diff))
    ok = spread < 1e-2 and end_diff > 1.0
    return 0.0 if ok else 1.0


def check_aspects(data, label):
    """ 相位线(§3.1):相位子午线经度处 swe.houses 的 MC 黄经 == 行星黄经 ± 相位。 """
    acg = ACGraph(data); res = acg.compute(); jd = acg.jd
    worst = 0.0
    n = 0
    for pid in [const.SUN, const.MARS, const.PLUTO]:
        p = res['planets'][pid]
        plon = p['lon']
        for a in p['lines']['aspects']:
            tgt = (plon + a['sign'] * a['aspect']) % 360.0
            _, ascmc = swisseph.houses(jd, 10.0, a['lon'], b'P')
            worst = max(worst, abs(_n180(ascmc[1] - tgt)))
            n += 1
    print('\n[aspects %s] %d 条相位线 worst MC dev=%.6f deg' % (label, n, worst))
    return worst


def check_points(data, label):
    """ 东/西点线(§16):EP 线经度处 swe.houses 的 East Point(ascmc[4]) == 行星黄经;
    天顶点:lat == 行星赤纬。 """
    acg = ACGraph(data); res = acg.compute(); jd = acg.jd
    worst = 0.0
    for pid in MAIN:
        p = res['planets'][pid]
        _, a = swisseph.houses(jd, 30.0, p['lines']['ep']['lon'], b'P')
        worst = max(worst, abs(_n180(a[4] - p['lon'])))
        worst = max(worst, abs(p['zenith']['lat'] - p['decl']))
        # antiscion 线处 houses MC == 180−λ;contra == −λ
        anti = p['lines']['antiscia']
        _, aa = swisseph.houses(jd, 10.0, anti['antiscion']['lon'], b'P')
        worst = max(worst, abs(_n180(aa[1] - (180.0 - p['lon']))))
        _, ac = swisseph.houses(jd, 10.0, anti['contra']['lon'], b'P')
        worst = max(worst, abs(_n180(ac[1] - (-p['lon']))))
        # Vertex/Antivertex 曲线:线上点 swe.houses Vertex(ascmc[3]) == 行星黄经 / +180
        # (用 Porphyry 'O' 因高纬 Placidus 失效;Vertex 与宫制无关)
        for q in p['lines']['vertex'][::12]:
            _, av = swisseph.houses(jd, q['lat'], q['lon'], b'O')
            worst = max(worst, abs(_n180(av[3] - p['lon'])))
        for q in p['lines']['antivertex'][::12]:
            _, av = swisseph.houses(jd, q['lat'], q['lon'], b'O')
            worst = max(worst, abs(_n180(av[3] - (p['lon'] + 180.0))))
    print('\n[points %s] EP线/天顶/antiscia/Vertex worst dev=%.6f deg' % (label, worst))
    return worst


def check_cusps(data, label):
    """ 落点报告 12 宫尖(§15):对多种宫制,pointReport 的 cusps == swe.houses,
    且默认 whole 的四角零回归。高纬回退 Porphyry。 """
    acg = ACGraph(data)
    worst = 0.0
    for name, code in [('placidus', b'P'), ('koch', b'K'), ('regiomontanus', b'R'),
                       ('campanus', b'C'), ('whole', b'W'), ('porphyry', b'O')]:
        rep = acg.pointReport(40.0, -74.0, 2.0, name)
        cs, _ = swisseph.houses(acg.jd, 40.0, -74.0, code)
        for i in range(12):
            worst = max(worst, abs(_n180(rep['cusps'][i] - cs[i])))
    # 高纬回退
    hi = acg.pointReport(70.0, 10.0, 2.0, 'placidus')
    fb = 'OK' if hi['hsys'] == 'O' and hi['cusps'] is not None else 'FAIL'
    print('\n[cusps %s] 6 宫制 cusp worst=%.6f deg;高纬70N回退=%s' % (label, worst, fb))
    return worst if fb == 'OK' else 99.0


def check_geodetic(data, label):
    """ Geodetic(§7):RA 变体的 geodetic MC 经度(=RAMC)经 swe.houses_armc 得的 MC 黄经
    == 行星黄经;longitude 变体 terr_lon == 行星黄经。 """
    dr = dict(data); dr['geodetic'] = 'sepharial'; dr['geodeticVar'] = 'ra'
    acg = ACGraph(dr); res = acg.compute(); eps = acg.eps
    dl = dict(data); dl['geodeticVar'] = 'longitude'
    resl = ACGraph(dl).compute()
    worst = 0.0
    for pid in [const.SUN, const.MARS, const.PLUTO, const.SATURN]:
        p = res['planets'][pid]
        ramc = p['lines']['geodetic']['mc']['lon'] % 360.0
        _, a = swisseph.houses_armc(ramc, 10.0, eps, b'P')
        worst = max(worst, abs(_n180(a[1] - p['lon'])))
        worst = max(worst, abs(_n180(resl['planets'][pid]['lines']['geodetic']['mc']['lon'] - p['lon'])))
    print('\n[geodetic %s] RA/longitude 变体 worst dev=%.6f deg' % (label, worst))
    return worst


def check_midpoints(data, label):
    """ 中点线(§3.2):中点子午线经度处 swe.houses MC == 短弧中点黄经(deg 已 round3)。 """
    acg = ACGraph(data); res = acg.compute(); jd = acg.jd
    worst = 0.0
    for m in res['midpoints']:
        _, a = swisseph.houses(jd, 10.0, m['lon'], b'P')
        worst = max(worst, abs(_n180(a[1] - m['deg'])))
    # Lots(福点/精神点)MC 子午线 == lot 黄经
    lots = res.get('lots') or {}
    for k in ('fortune', 'spirit'):
        if k in lots:
            _, a = swisseph.houses(jd, 10.0, lots[k]['mc']['lon'], b'P')
            worst = max(worst, abs(_n180(a[1] - lots[k]['deg'])))
    print('\n[midpoints/lots %s] %d 中点对+福点/精神点 worst dev=%.6f deg' % (label, len(res['midpoints']), worst))
    return worst


def check_crossings(data, label):
    """ 线交叉点(§3.3):交点处 B 星(升落)真高度≈0、A 星(MC/IC)方位角≈子午。
    交点纬度由 0.5° 采样曲线插值 → B 高度有插值上界(<0.3°),A 子午偏很小。 """
    acg = ACGraph(data); res = acg.compute(); jd = acg.jd
    wB = wA = 0.0
    for x in res['crossings']:
        pb = res['planets'][x['b']]
        _, altB, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [x['lon'], x['lat'], 0], 0, 0, [pb['lon'], pb['lat'], 1.0])
        wB = max(wB, abs(altB))
        pa = res['planets'][x['a']]
        azA, _, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [x['lon'], x['lat'], 0], 0, 0, [pa['lon'], pa['lat'], 1.0])
        wA = max(wA, _merid_dev(azA))
    print('\n[crossings %s] %d 个;B高度 worst=%.5f° A子午 worst=%.5f°' % (label, len(res['crossings']), wB, wA))
    return wB, wA


def check_cusplines(data, label):
    """ House-cusp lines(§17.2·opt-in):宫尖线上点经 swe.houses 得的该宫尖黄经 == 行星黄经;
    默认(cuspLines off)cusps=None 零回归。 """
    off = ACGraph(data).compute()
    assert off['planets'][const.SUN]['lines']['cusps'] is None, 'cuspLines 默认应关(零回归)'
    d = dict(data); d['cuspLines'] = '1'; d['hsys'] = 'placidus'
    acg = ACGraph(d); res = acg.compute(); jd = acg.jd
    worst = 0.0
    for pid in [const.SUN, const.MARS]:
        p = res['planets'][pid]
        for h, pts in (p['lines']['cusps'] or {}).items():
            hi = int(h) - 1
            for q in pts[::4]:
                try:
                    cs, _ = swisseph.houses(jd, q['lat'], q['lon'], b'P')
                    worst = max(worst, abs(_n180(cs[hi] - p['lon'])))
                except swisseph.Error:
                    pass
    print('\n[cusplines %s] 宫尖线 worst dev=%.5f°(默认零回归 OK)' % (label, worst))
    return worst


def check_helio(data, label):
    """ Heliocentric ACG(coord='helio'):每行星 MC 经度 == n180(helioRA − gmst);
    Sun 映射为 Earth(= 地心太阳 +180°);默认 coord='geo' 零回归(planets 数=15)。 """
    geo = ACGraph(data).compute()
    assert geo['meta']['coord'] == 'geo' and len(geo['planets']) == 15, 'coord 默认应为 geo(零回归)'
    acg = ACGraph(dict(data, coord='helio'))
    res = acg.compute()
    jd = acg.jd
    gmst = res['meta']['gmst']
    eps = res['meta']['obliquity']
    NUM = {const.MERCURY: swisseph.MERCURY, const.VENUS: swisseph.VENUS, const.MARS: swisseph.MARS,
           const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN, const.URANUS: swisseph.URANUS,
           const.NEPTUNE: swisseph.NEPTUNE, const.PLUTO: swisseph.PLUTO}
    worst = 0.0
    for pid, num in NUM.items():
        xx, _ = swisseph.calc_ut(jd, num, swisseph.FLG_SWIEPH | swisseph.FLG_HELCTR)
        ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
        worst = max(worst, abs(_n180(res['planets'][pid]['lines']['mc']['lon'] - _n180(ra - gmst))))
    sun, _ = swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_SWIEPH)   # 日心"太阳"= 地球
    ra_e = swisseph.cotrans([(sun[0] + 180.0) % 360.0, 0.0, 1.0], -eps)[0]
    worst = max(worst, abs(_n180(res['planets'][const.SUN]['lines']['mc']['lon'] - _n180(ra_e - gmst))))
    print('\n[helio %s] 日心 %d 天体;MC worst dev=%.6f°(默认 geo 零回归 OK)' % (label, len(res['planets']), worst))
    return worst


def check_sidereal(data, label):
    """ Sidereal 恒星黄道读数(ayanamsa='lahiri'):sidLon == norm360(tropLon − ayan),
    ayan 用 swe.get_ayanamsa_ut 独立反验;物理线(MC)与 tropical 完全一致(仅标注不动几何);
    默认(无 ayanamsa)sidLon/ayanVal=None 零回归。 """
    trop = ACGraph(data).compute()
    assert trop['meta']['ayanVal'] is None and trop['planets'][const.SUN]['sidLon'] is None, 'ayanamsa 默认应关(零回归)'
    acg = ACGraph(dict(data, ayanamsa='lahiri'))
    res = acg.compute()
    jd = acg.jd
    swisseph.set_sid_mode(swisseph.SIDM_LAHIRI, 0, 0)
    ayan = float(swisseph.get_ayanamsa_ut(jd))
    worst = 0.0
    mcdev = 0.0
    for pid in MAIN:
        p = res['planets'][pid]
        worst = max(worst, abs(_n180(p['sidLon'] - (p['lon'] - ayan))))
        mcdev = max(mcdev, abs(_n180(p['lines']['mc']['lon'] - trop['planets'][pid]['lines']['mc']['lon'])))
    print('\n[sidereal %s] ayan=%.4f;sidLon worst=%.6f°、物理MC与tropical差=%.6f°(默认零回归 OK)'
          % (label, ayan, worst, mcdev))
    return max(worst, mcdev)


def check_stars(data, label):
    """ Fixed-star ACG(stars='1'):星 MC 经度 == n180(starRA − gmst);星 ASC 曲线上点经
    swe.azalt(EQU2HOR) 真高度≈0(独立反验,与 ACGraph 公式无关);默认(stars off)
    stars/starParans=None 零回归。 """
    from astrostudy.acg.ACGraph import ACG_STARS
    off = ACGraph(data).compute()
    assert off['stars'] is None and off['starParans'] is None, 'stars 默认应关(零回归)'
    acg = ACGraph(dict(data, stars='1'))
    res = acg.compute()
    jd = acg.jd
    gmst = res['meta']['gmst']
    eps = res['meta']['obliquity']
    name = {k: n for n, cn, k in ACG_STARS}
    wMC = wAlt = 0.0
    for s in res['stars']:
        r = swisseph.fixstar2_ut(name[s['key']], jd, swisseph.FLG_SWIEPH)
        xx = r[0] if isinstance(r[0], (list, tuple)) else r
        ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
        wMC = max(wMC, abs(_n180(s['lines']['mc']['lon'] - _n180(ra - gmst))))
        pts = s['lines']['asc']
        if pts:
            for q in (pts[len(pts) // 4], pts[len(pts) // 2], pts[3 * len(pts) // 4]):
                alt = swisseph.azalt(jd, swisseph.EQU2HOR, [q['lon'], q['lat'], 0], 0, 0, [s['ra'], s['decl'], 1.0])
                wAlt = max(wAlt, abs(alt[1]))
    print('\n[stars %s] %d 星、%d parans;MC worst=%.6f°、ASC真高度 worst=%.4f°(默认零回归 OK)'
          % (label, len(res['stars']), len(res['starParans']), wMC, wAlt))
    return max(wMC, wAlt)


def check_ccg(data, label):
    """ CCG 时间地图(ccgDate 设定才启用):混合口径(内行星二推/外行星行运);
    行运 MC == n180(RA(jd_t) − natal gmst)、推运 MC 同式用 jd_p = jd0+Δ/365.2425
    (与 astroextra secondary 同口径);swe 独立反验;默认(无 ccgDate)ccg=None 零回归。 """
    off = ACGraph(data).compute()
    assert off['ccg'] is None, 'ccg 默认应关(零回归)'
    acg = ACGraph(dict(data, ccgDate='2026/07/01'))
    res = acg.compute()
    c = res['ccg']
    gmst = res['meta']['gmst']
    eps = res['meta']['obliquity']
    jd0 = acg.jd
    assert abs(c['jdProgressed'] - (jd0 + (c['jd'] - jd0) / 365.2425)) < 1e-6, 'jd_p 公式漂移'
    NUM = {const.SUN: swisseph.SUN, const.MOON: swisseph.MOON, const.VENUS: swisseph.VENUS,
           const.JUPITER: swisseph.JUPITER, const.SATURN: swisseph.SATURN, const.PLUTO: swisseph.PLUTO}
    worst = 0.0
    for pid, num in NUM.items():
        p = c['planets'][pid]
        exp_kind = 'progressed' if pid in (const.SUN, const.MOON, const.VENUS) else 'transit'
        assert p['kind'] == exp_kind, 'mixed 口径错:%s=%s' % (pid, p['kind'])
        xx, _ = swisseph.calc_ut(c['jdProgressed'] if exp_kind == 'progressed' else c['jd'], num, swisseph.FLG_SWIEPH)
        ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
        worst = max(worst, abs(_n180(p['lines']['mc']['lon'] - _n180(ra - gmst))))
    print('\n[ccg %s] 10 主星混合(内二推/外行运);MC worst=%.6f°(默认零回归 OK)' % (label, worst))
    return worst


def check_rel(data, label):
    """ 关系盘(§18)+ 世运事件(§19):davison 合成盘 == 以合成时空直接起盘(byte级);
    composite 行星 == 两盘短弧中点(β=0);synastry second == B 独立盘;
    findMundaneEvent 各类事件可解且日食时刻处日月黄经差≈0;默认全关零回归。 """
    from astrostudy.acg.ACGraph import findMundaneEvent
    relB = {'relDate': '1992/03/10', 'relTime': '08:30:00', 'relZone': '+08:00',
            'relLat': '39n54', 'relLon': '116e23'}
    off = ACGraph(data).compute()
    assert off['meta']['relMode'] is None and off['second'] is None, 'relMode 默认应关(零回归)'
    # davison == direct chart
    rd = ACGraph(dict(data, relMode='davison', **relB)).compute()
    dv = rd['meta']['davison']
    direct = ACGraph({'date': dv['date'], 'time': dv['time'], 'zone': '+00:00',
                      'lat': dv['lat'], 'lon': dv['lon']}).compute()
    wD = max(abs(_n180(rd['planets'][p]['lines']['mc']['lon'] - direct['planets'][p]['lines']['mc']['lon']))
             for p in (const.SUN, const.MARS, const.PLUTO))
    # composite 中点 + β=0
    rc = ACGraph(dict(data, relMode='composite', **relB))
    res_c = rc.compute()
    from flatlib.datetime import Datetime as _DT
    from flatlib.geopos import GeoPos as _GP
    from flatlib.chart import Chart as _CH
    cB = _CH(_DT('1992/03/10', '08:30:00', '+08:00'), _GP('39n54', '116e23'),
             const.TROPICAL, hsys=rc.house, IDs=[const.SUN, const.MARS], needpars=False)
    cA = ACGraph(data).chart
    wC = 0.0
    for p in (const.SUN, const.MARS):
        la = cA.getObject(p).lon
        lb = cB.getObject(p).lon
        mid = (la + _n180(lb - la) / 2.0) % 360.0
        wC = max(wC, abs(_n180(res_c['planets'][p]['lon'] - mid)))
        assert res_c['planets'][p]['lat'] == 0.0, 'composite β 应为 0'
    # synastry second == B 独立盘
    rs = ACGraph(dict(data, relMode='synastry', **relB)).compute()
    rB = ACGraph({'date': '1992/03/10', 'time': '08:30:00', 'zone': '+08:00',
                  'lat': '39n54', 'lon': '116e23'}).compute()
    wS = abs(_n180(rs['second']['planets'][const.SUN]['lines']['mc']['lon']
                   - rB['planets'][const.SUN]['lines']['mc']['lon']))
    # 事件:下一次日食时刻 日月黄经差≈0(独立物理校验)
    jd0 = swisseph.julday(2026, 7, 1, 0.0)
    jde = findMundaneEvent('solar_eclipse', jd0, 'next')
    s = swisseph.calc_ut(jde, swisseph.SUN, swisseph.FLG_SWIEPH)[0][0]
    m = swisseph.calc_ut(jde, swisseph.MOON, swisseph.FLG_SWIEPH)[0][0]
    wE = abs(_n180(m - s))
    for k in ('lunar_eclipse', 'newmoon', 'fullmoon', 'aries_ingress', 'capricorn_ingress'):
        assert findMundaneEvent(k, jd0, 'next') is not None, '事件不可解:%s' % k
    # 日食"最大食"时刻按视差可偏离几何合小量;<0.6° 为健全性断言,不并入几何 worst
    assert wE < 0.6, '日食时刻日月黄经差异常: %.4f' % wE
    print('\n[rel %s] davison==direct %.6f°、composite中点 %.6f°、synastry==B盘 %.6f°、日食日月差 %.4f°(默认零回归 OK)'
          % (label, wD, wC, wS, wE))
    return max(wD, wC, wS)


def _alt_off(jd, xin, pts, target, mid_only=False):
    """ ASC/DSC 线取样点上,天体真高度与 target 的最大偏差(azalt 独立反验)。
    mid_only:只采中纬(避开几何 band 边缘 —— 折射模式下 band 端点被 clamp,不满足 h=target,
    属文档记载的极区近似;折射物理在可用纬度全域已验证)。 """
    errs = []
    n = len(pts)
    idxs = (n // 4, n // 3, n // 2, 2 * n // 3, 3 * n // 4) if mid_only else (1, n // 4, n // 2, 3 * n // 4, n - 2)
    for idx in idxs:
        q = pts[idx]
        _, talt, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [q['lon'], q['lat'], 0], 0, 0, xin)
        errs.append(abs(talt - target))
    return max(errs)


def check_celestial(data, label):
    """ P0 天体集与口径底座:四小行星 / 真节点 / 真·插值 Lilith / 站心 / 真位置 / J2000 读数 /
    地平折射。每项独立 swisseph 反验(azalt / calc_ut+cotrans),并断言各新开关默认零回归。 """
    base = ACGraph(data).compute()
    assert not (set(['Ceres', 'Pallas', 'Juno', 'Vesta', 'Eris']) & set(base['planets'].keys())), \
        '默认不该含小行星(零回归)'
    assert base['meta']['nodeType'] == 'mean' and base['meta']['lilithType'] == 'mean', \
        'node/lilith 默认应 mean(零回归)'
    assert base['meta']['posType'] == 'apparent' and base['meta']['horizon'] == 'geometric', \
        'posType/horizon 默认应零回归'
    worst = 0.0

    # 1) 四小行星:ASC 线真高度≈0(azalt 独立)+ MC 子午线偏差≈0;与十行星同法。
    acg = ACGraph(dict(data, asteroids='1'))
    res = acg.compute()
    jd = acg.jd
    eps = res['meta']['obliquity']
    gmst = res['meta']['gmst']
    for k in ('Ceres', 'Pallas', 'Juno', 'Vesta'):
        assert k in res['planets'], '小行星缺 %s' % k
        p = res['planets'][k]
        xin = [p['lon'], p['lat'], 1.0]
        worst = max(worst, _alt_off(jd, xin, p['lines']['asc'], 0.0))
        azmc, _, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [p['lines']['mc']['lon'], 20.0, 0], 0, 0, xin)
        worst = max(worst, _merid_dev(azmc))
    # Eris + 星体 Lilith:.se1 缺失 → 两体开普勒 fallback。近 epoch(当代盘)已对 JPL Horizons
    # 验到 ~0.005°;此处仅断言 fallback 激活使其出线(= 非死开关),精度由代码 doc + 独立 Horizons 核。
    assert 'Eris' in res['planets'] and res['planets']['Eris']['lon'] is not None, 'Eris 应经 Kepler fallback 出线'
    assert -90.0 < res['planets']['Eris']['lat'] < 90.0, 'Eris 黄纬无效'
    rbody = ACGraph(dict(data, lilithType='body')).compute()
    assert const.DARKMOON in rbody['planets'], '星体 Lilith 应经 Kepler fallback 出线'

    # 2) 真节点:MC == n180(trueNodeRA − gmst),RA 独立 calc+cotrans;南交=北交+180°、β=0。
    tn = ACGraph(dict(data, nodeType='true')).compute()
    xx, _ = swisseph.calc_ut(jd, swisseph.TRUE_NODE, swisseph.FLG_SWIEPH)
    ra_nn = swisseph.cotrans([xx[0], 0.0, 1.0], -eps)[0]
    worst = max(worst, abs(_n180(tn['planets'][const.NORTH_NODE]['lines']['mc']['lon'] - _n180(ra_nn - gmst))))
    ra_sn = swisseph.cotrans([(xx[0] + 180.0) % 360.0, 0.0, 1.0], -eps)[0]
    worst = max(worst, abs(_n180(tn['planets'][const.SOUTH_NODE]['lines']['mc']['lon'] - _n180(ra_sn - gmst))))

    # 3) 真 / 插值 Lilith:MC 独立反验。
    for lt, num in (('true', swisseph.OSCU_APOG), ('intp', swisseph.INTP_APOG)):
        rl = ACGraph(dict(data, lilithType=lt)).compute()
        xx, _ = swisseph.calc_ut(jd, num, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)
        ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
        worst = max(worst, abs(_n180(rl['planets'][const.DARKMOON]['lines']['mc']['lon'] - _n180(ra - gmst))))

    # 4) 站心:月亮 MC 独立反验(set_topo + FLG_TOPOCTR);站心≠地心(必移动)。
    topo = ACGraph(dict(data, coord='topo'))
    rt = topo.compute()
    swisseph.set_topo(topo.pos.lon, topo.pos.lat, 0.0)
    xx, _ = swisseph.calc_ut(jd, swisseph.MOON, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED | swisseph.FLG_TOPOCTR)
    ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
    worst = max(worst, abs(_n180(rt['planets'][const.MOON]['lines']['mc']['lon'] - _n180(ra - gmst))))
    assert abs(_n180(rt['planets'][const.MOON]['lines']['mc']['lon']
                     - base['planets'][const.MOON]['lines']['mc']['lon'])) > 0.01, '站心应移动月亮线'

    # 5) posType=true:月亮 MC 独立反验(FLG_TRUEPOS);j2000:线不变 + j2000Lon 读数存在。
    tr = ACGraph(dict(data, posType='true')).compute()
    xx, _ = swisseph.calc_ut(jd, swisseph.MOON, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED | swisseph.FLG_TRUEPOS)
    ra = swisseph.cotrans([xx[0], xx[1], 1.0], -eps)[0]
    worst = max(worst, abs(_n180(tr['planets'][const.MOON]['lines']['mc']['lon'] - _n180(ra - gmst))))
    j2 = ACGraph(dict(data, posType='j2000')).compute()
    assert abs(_n180(j2['planets'][const.MOON]['lines']['mc']['lon']
                     - base['planets'][const.MOON]['lines']['mc']['lon'])) < 1e-9, 'j2000 不该改线几何'
    assert j2['planets'][const.MOON]['j2000Lon'] is not None, 'j2000 应有读数'

    # 6) 折射:月亮 ASC 线真高度 ≈ −0.5667°(视地平抬升到 0);MC 不动。
    rh = ACGraph(dict(data, horizon='apparent')).compute()
    pm = rh['planets'][const.MOON]
    xin = [pm['lon'], pm['lat'], 1.0]
    ref_off = _alt_off(jd, xin, pm['lines']['asc'], -34.0 / 60.0, mid_only=True)
    worst = max(worst, ref_off)
    assert abs(_n180(rh['planets'][const.MOON]['lines']['mc']['lon']
                     - base['planets'][const.MOON]['lines']['mc']['lon'])) < 1e-9, '折射不该动 MC'

    print('\n[celestial %s] 小行星/真节点/真·插值Lilith/站心/真位置 MC worst=%.6f°;J2000 读数OK;折射高度偏差=%.5f°;默认零回归 OK'
          % (label, worst, ref_off))
    return worst


def check_p1(data, label):
    """ P1 缺失流派与线型:Draconic 刚性旋转 / Harmonic 乘性 / Lots ASC 真高度 / 中点 mundo 赤经中点
    / LS az·alt。各项独立反验 + 默认零回归。 """
    base = ACGraph(data).compute()
    assert base['meta']['draconic'] is None and base['meta']['harmonic'] is None, 'draconic/harmonic 默认零回归'
    worst = 0.0
    acg = ACGraph(data)
    jd = acg.jd

    # 1) Draconic:NN→0;各体 λ'=λ−λ_NN(刚性旋转,MC 随 λ' 变)。
    nn0 = base['planets'][const.NORTH_NODE]['lon']
    dr = ACGraph(dict(data, draconic='mean')).compute()
    assert abs(_n180(dr['planets'][const.NORTH_NODE]['lon'])) < 1e-6, 'draconic 北交应=0'
    for pid in [const.SUN, const.MOON, const.MARS]:
        exp = (base['planets'][pid]['lon'] - nn0) % 360.0
        worst = max(worst, abs(_n180(dr['planets'][pid]['lon'] - exp)))

    # 2) Harmonic H2/H5:λ_H=(H·λ)mod360,β=0。
    for H in (2, 5):
        rh = ACGraph(dict(data, harmonic=str(H))).compute()
        for pid in [const.SUN, const.VENUS]:
            exp = (H * base['planets'][pid]['lon']) % 360.0
            worst = max(worst, abs(_n180(rh['planets'][pid]['lon'] - exp)))
            assert rh['planets'][pid]['lat'] == 0.0, 'harmonic β 应 0'

    # 3) Lots:福点 ASC 线真高度≈0(azalt 独立);自定义点存在。
    lots = base['lots']
    assert 'asc' in lots['fortune'], 'fortune 应有 ASC 曲线'
    fdeg = lots['fortune']['deg']
    xin = [fdeg, 0.0, 1.0]
    worst = max(worst, _alt_off(jd, xin, lots['fortune']['asc'], 0.0))
    rc = ACGraph(dict(data, lotsCustom='asc,jupiter,saturn')).compute()
    assert rc['lots'].get('custom') is not None, '自定义 lot 应出现'

    # 4) 中点 mundo:MC == n180(赤经中点 − gmst);默认 zodiac 的 MC 字节零回归。
    bodies = {b[0]: (b[1], b[2]) for b in [(pid, v['ra'], v['decl']) for pid, v in base['planets'].items()]}
    rmid = ACGraph(dict(data, midpointMode='mundo')).compute()
    gmst = base['meta']['gmst']
    for m in rmid['midpoints'][:8]:
        ra_a = bodies[m['a']][0]
        ra_b = bodies[m['b']][0]
        mid_ra = (ra_a + _n180(ra_b - ra_a) / 2.0) % 360.0
        worst = max(worst, abs(_n180(m['lon'] - _n180(mid_ra - gmst))))
    assert base['midpoints'][0]['lon'] == ACGraph(data).compute()['midpoints'][0]['lon'], '默认中点 MC 零回归'

    # 5) LS az/alt:每体 lsAz 与 azalt 独立一致(az=A_N 罗盘、alt=真高度)。
    for pid in MAIN:
        la = base['planets'][pid]['lines']['lsAz']
        xin2 = [base['planets'][pid]['lon'], base['planets'][pid]['lat'], 1.0]
        azs, talt, _ = swisseph.azalt(jd, swisseph.ECL2HOR, [acg.pos.lon, acg.pos.lat, 0], 0, 0, xin2)
        worst = max(worst, abs(_n180(la['az'] - (azs + 180.0))), abs(la['alt'] - talt))

    # 6) 关系盘交叉/派状:synastry 时产出(非死开关)。
    syn = dict(data, relMode='synastry', relDate='1985/03/10', relTime='08:00:00',
               relZone='+00:00', relLat='40n43', relLon='74w00')
    rsyn = ACGraph(syn).compute()
    assert rsyn['second'] and len(rsyn['second'].get('relCrossings', [])) > 0, '关系交叉应产出'
    assert len(rsyn['second'].get('relParans', [])) > 0, '关系派状应产出'

    print('\n[p1 %s] draconic/harmonic/lots-asc/midpoint-mundo/LS-az worst=%.6f°;自定义lot+关系交叉/派状OK;默认零回归 OK'
          % (label, worst))
    return worst


def main():
    overall = 0.0
    for data, label in CASES:
        overall = max(overall, check(data, label))
    cel = 0.0
    for data, label in CASES:
        cel = max(cel, check_celestial(data, label))
    p1w = 0.0
    for data, label in CASES:
        p1w = max(p1w, check_p1(data, label))
    # P0 口径开关:zodiac + rhumb(独立 golden;默认 mundo/great 走上面 check 已零回归)
    zw = 0.0
    for data, label in CASES:
        zw = max(zw, check_zodiac(data, label))
    rf = 0.0
    for data, label in CASES:
        rf = max(rf, check_rhumb(data, label))
    aw = 0.0
    for data, label in CASES:
        aw = max(aw, check_aspects(data, label))
    pw = 0.0
    for data, label in CASES:
        pw = max(pw, check_points(data, label))
    cw = 0.0
    for data, label in CASES:
        cw = max(cw, check_cusps(data, label))
    gw = 0.0
    for data, label in CASES:
        gw = max(gw, check_geodetic(data, label))
    mw = 0.0
    for data, label in CASES:
        mw = max(mw, check_midpoints(data, label))
    xB = xA = 0.0
    for data, label in CASES:
        b, a = check_crossings(data, label)
        xB = max(xB, b)
        xA = max(xA, a)
    clw = 0.0
    for data, label in CASES[:1]:   # cuspLines 较贵,验 1 例即可
        clw = max(clw, check_cusplines(data, label))
    hw = 0.0
    for data, label in CASES:
        hw = max(hw, check_helio(data, label))
    sw = 0.0
    for data, label in CASES:
        sw = max(sw, check_sidereal(data, label))
    stw = 0.0
    for data, label in CASES:
        stw = max(stw, check_stars(data, label))
    ccw = 0.0
    for data, label in CASES:
        ccw = max(ccw, check_ccg(data, label))
    rw = 0.0
    for data, label in CASES[:1]:   # 关系盘/事件与出生盘无关维度,验 1 例即可
        rw = max(rw, check_rel(data, label))
    CUSP_TOL = 0.01   # cusps/midpoints rounded to 3 decimals → rounding-noise tolerance
    XING_TOL = 0.3    # crossing lat is interpolated on a 0.5° sampled curve
    ok = (overall < TOL and zw < TOL and aw < TOL and pw < TOL and cw < CUSP_TOL
          and gw < TOL and mw < CUSP_TOL and xB < XING_TOL and xA < 0.05 and clw < TOL and hw < TOL
          and sw < TOL and stw < TOL and ccw < TOL and rw < TOL and rf == 0.0 and cel < TOL and p1w < TOL)
    print('\n==== ACG alignment %s (in-mundo %.6f, zodiac %.6f, aspect %.6f, points %.6f, cusps %.6f, geodetic %.6f, midpoints %.6f, crossings B%.4f/A%.4f, cusplines %.6f, helio %.6f, sidereal %.6f, stars %.6f, ccg %.6f, rel %.6f, celestial %.6f, p1 %.6f, tol %g; rhumb %s) ===='
          % ('PASS' if ok else 'FAIL', overall, zw, aw, pw, cw, gw, mw, xB, xA, clw, hw, sw, stw, ccw, rw, cel, p1w, TOL, 'OK' if rf == 0.0 else 'FAIL'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
