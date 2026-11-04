# -*- coding: utf-8 -*-
"""directed_figures.py — 四种「推运图」类星运:演进推运(Néroman)/ 推运图(Bezza)/ 周日小限(Jay)/ 双黄道(Michon)。

四者共用一套积木:本命底盘(出生儒略日 / 地理纬度 / 赤经中天 / 黄赤交角 / 各点黄经黄纬)+ Placidus 世俗时位。

世俗时位(hours)= 点在 Placidus 框架里的位置,以「时」计:天顶 0、下降 6、天底 12、上升 18,24 时一周;
每时 = 点所在半弧(地平上用昼半弧、地平下用夜半弧,按点自身赤纬)的六分之一。即 swisseph.house_pos(Placidus)
换算 (10 − 宫位位置) × 2(模 24);这里用球面三角闭式直接算(与 house_pos 同值,免去迭代台阶)。

约定:角度一律用度;年龄一律按回归年(365.2422 日)计;黄道一律回归黄道(双黄道里的恒星黄道单独算)。
变换部分都写成纯函数(输入本命坐标,输出推进后的坐标),页面 / AI 快照 / 导出共用同一出口。
"""

import math

import swisseph

from astrostudy.pd_engine import ecl_to_eq, eq_to_ecl, ascensional_difference, solar_arc_for_years, key_placidus_true_solar_arc

TROPICAL_YEAR = 365.2422

# 推运图里的点:七政 + 三王星 + 北交(真)+ 上升 / 天顶;编号沿用 swisseph(上升 / 天顶另给字符串编号)
BODY_IDS = [
    ('Sun', swisseph.SUN), ('Moon', swisseph.MOON), ('Mercury', swisseph.MERCURY), ('Venus', swisseph.VENUS),
    ('Mars', swisseph.MARS), ('Jupiter', swisseph.JUPITER), ('Saturn', swisseph.SATURN),
    ('Uranus', swisseph.URANUS), ('Neptune', swisseph.NEPTUNE), ('Pluto', swisseph.PLUTO),
    ('North Node', swisseph.TRUE_NODE),
]
SEVEN = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
ANGLES = ['Asc', 'MC']


def norm360(x):
    return x % 360.0


def norm24(x):
    return x % 24.0


def signed180(x):
    return (x + 180.0) % 360.0 - 180.0


def signed12(x):
    return (x + 12.0) % 24.0 - 12.0


def ang_dist(a, b):
    """两黄经的角距(0..180)。"""
    return abs(signed180(a - b))


# ---------------------------------------------------------------------------
# 本命底盘
# ---------------------------------------------------------------------------
def natal_frame(jd, phi, geolon):
    """出生时刻(UT 儒略日)+ 地理纬经 → 底盘:赤经中天 / 真 · 平黄赤交角 / 上升 / 天顶 / 各点黄经黄纬日速。"""
    nut = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0]
    eps_true, eps_mean = nut[0], nut[1]
    _cusps, ascmc = swisseph.houses_ex(jd, phi, geolon, b'P')
    armc = ascmc[2]
    points = {}
    for name, sid in BODY_IDS:
        xx = swisseph.calc_ut(jd, sid, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0]
        points[name] = {'lon': norm360(xx[0]), 'lat': xx[1], 'speed': xx[3]}
    points['Asc'] = {'lon': norm360(ascmc[0]), 'lat': 0.0, 'speed': 0.0}
    points['MC'] = {'lon': norm360(ascmc[1]), 'lat': 0.0, 'speed': 0.0}
    return {'jd': jd, 'phi': phi, 'geolon': geolon, 'armc': armc, 'epsTrue': eps_true, 'epsMean': eps_mean,
            'points': points}


def angles_at_armc(armc, phi, eps):
    """给定赤经中天的上升 / 天顶(Placidus 框架,极区退回 Porphyry 只为取轴)。"""
    try:
        cusps, ascmc = swisseph.houses_armc(armc, phi, eps, b'P')
    except Exception:
        cusps, ascmc = swisseph.houses_armc(armc, phi, eps, b'O')
    return norm360(ascmc[0]), norm360(ascmc[1])


def mc_from_armc(armc, eps):
    """天顶黄经 = 赤经中天在黄道上的投影(纬度无关)。"""
    return norm360(math.degrees(math.atan2(math.sin(math.radians(armc)), math.cos(math.radians(armc)) * math.cos(math.radians(eps)))))


# ---------------------------------------------------------------------------
# Placidus 世俗时位(时)
# ---------------------------------------------------------------------------
def mundane_hours_eq(ra, dec, armc, phi):
    """赤道坐标点的世俗时位(时,0..24):天顶 0 → 下降 6 → 天底 12 → 上升 18。"""
    ad = ascensional_difference(dec, phi)
    dsa = 90.0 + ad
    nsa = 90.0 - ad
    h = signed180(armc - ra)  # 时角,向西为正
    if abs(h) <= dsa:
        if dsa <= 0:
            return 0.0
        return norm24(6.0 * h / dsa)
    if nsa <= 0:
        return 12.0
    if h > 0:
        return 6.0 + 6.0 * (h - dsa) / nsa
    return 12.0 + 6.0 * (h + 180.0) / nsa


def mundane_hours(lon, lat, armc, phi, eps):
    ra, dec = ecl_to_eq(lon, lat, eps)
    return mundane_hours_eq(ra, dec, armc, phi)


def ecliptic_point_at_hours(target, armc, phi, eps):
    """世俗时位恰为 target 的黄道点(黄纬 0)的黄经。时位随黄经单调转一周,逐度扫描找跨越再二分。"""
    def f(lon):
        return signed12(mundane_hours(lon, 0.0, armc, phi, eps) - target)
    prev_lon, prev = 0.0, f(0.0)
    for i in range(1, 361):
        lon = float(i)
        cur = f(lon)
        if prev == 0.0:
            return norm360(prev_lon)
        if prev * cur < 0 and abs(cur - prev) < 6.0:
            a, b, fa = prev_lon, lon, prev
            for _ in range(60):
                m = 0.5 * (a + b)
                fm = f(m)
                if fa * fm <= 0:
                    b = m
                else:
                    a, fa = m, fm
            return norm360(0.5 * (a + b))
        prev_lon, prev = lon, cur
    return None


def fortune_hours(hp_sun, hp_moon):
    """世俗时位上的福点 / 精神点:福点 = 上升(18 时)+ 月 − 日,精神点 = 上升 −(月 − 日)。"""
    diff = hp_moon - hp_sun
    return norm24(18.0 + diff), norm24(18.0 - diff)


# ---------------------------------------------------------------------------
# 年龄 / 日期
# ---------------------------------------------------------------------------
def age_years(natal_jd, target_jd):
    return (float(target_jd) - float(natal_jd)) / TROPICAL_YEAR


def jd_at_age(natal_jd, age):
    return float(natal_jd) + float(age) * TROPICAL_YEAR


# ===========================================================================
# 1. 演进推运(Néroman):弧 A = K · ln(1 + t / t0),所有点赤经减 A(逆行),换回黄道
# ===========================================================================
NEROMAN_K = 273.18
NEROMAN_T0 = 0.75


def neroman_arc(age, k=NEROMAN_K, t0=NEROMAN_T0):
    t = max(float(age), 0.0)
    return float(k) * math.log(1.0 + t / float(t0))


def neroman_age_for_arc(arc, k=NEROMAN_K, t0=NEROMAN_T0):
    return float(t0) * (math.exp(float(arc) / float(k)) - 1.0)


def ecliptic_lon_of_ra(ra, eps):
    """赤经 ra 的黄道点(黄纬 0)黄经。"""
    r = math.radians(ra)
    return norm360(math.degrees(math.atan2(math.sin(r), math.cos(r) * math.cos(math.radians(eps)))))


def neroman_point(lon, lat, arc, eps, keep_declination=False):
    """单点演进:keep_declination=False「按黄经度数」= 把点当黄道度数(黄纬 0)取赤经,减弧换回黄经,黄纬留本命值;
    True「保留本命赤纬」= 真实赤经赤纬,赤经减弧、赤纬不变,换回黄经黄纬。"""
    if keep_declination:
        ra, dec = ecl_to_eq(lon, lat, eps)
        lon2, lat2 = eq_to_ecl(norm360(ra - arc), dec, eps)
        return norm360(lon2), lat2
    ra, _dec = ecl_to_eq(lon, 0.0, eps)
    return ecliptic_lon_of_ra(norm360(ra - arc), eps), lat


def neroman_positions(points, arc, eps, keep_declination=False):
    out = {}
    for name, p in points.items():
        kd = keep_declination and name not in ANGLES  # 上升 / 天顶两档都按黄经度数
        lon2, lat2 = neroman_point(p['lon'], p['lat'], arc, eps, kd)
        out[name] = {'lon': lon2, 'lat': lat2}
    return out


# ===========================================================================
# 2. 推运图(Bezza):真太阳弧(赤经)推进;每点随自身半弧周日运动走;对本命的黄道 / 世俗 / 映点接触
# ===========================================================================
MUNDANE_ASPECT_HOURS = [0, 4, 6, 8, 12]  # 合 / 六合 / 刑 / 拱 / 冲,以时计
ZODIAC_ASPECTS = [0, 60, 90, 120, 180]


def bezza_movers(points, armc, phi, eps):
    """各点「推进 arc 后的世俗时位」函数:星体与上升 / 天顶按自身赤经赤纬随周日运动走;
    福点 / 精神点是世俗时位上的点(福点 = 18 + 月 − 日,精神点 = 18 −(月 − 日),按本命时位取),
    推进时按天赤道上的点走(半弧 90°,每时 15°)。"""
    movers = {}
    for name, p in points.items():
        ra, dec = ecl_to_eq(p['lon'], p['lat'], eps)
        movers[name] = (lambda r, d: (lambda arc: mundane_hours_eq(r, d, norm360(armc + arc), phi)))(ra, dec)
    ty, da = fortune_hours(movers['Sun'](0.0), movers['Moon'](0.0))
    movers['Tyche'] = lambda arc: norm24(ty + arc / 15.0)
    movers['Daimon'] = lambda arc: norm24(da + arc / 15.0)
    return movers


def bezza_point_rows(points, armc, phi, eps, arc):
    """各点本命时位 hp0、推进后时位 hp1、推进后位置对应的黄道点 dp(本命框架里同一世俗时位的黄道点,黄纬 0)。"""
    movers = bezza_movers(points, armc, phi, eps)
    rows = []
    for name, fn in movers.items():
        hp0 = fn(0.0)
        hp1 = fn(arc)
        lon = points[name]['lon'] if name in points else ecliptic_point_at_hours(hp0, armc, phi, eps)
        rows.append({'id': name, 'lon': lon, 'hp0': hp0, 'hp1': hp1,
                     'dp': ecliptic_point_at_hours(hp1, armc, phi, eps)})
    return rows, movers


def _arc_roots(f, lo_arc, hi_arc, step=0.25):
    """f(arc) 在 [lo_arc, hi_arc] 的根(f 以时计、已折到 ±12;跨 ±12 的跳变不算根)。"""
    roots = []
    span = max(hi_arc - lo_arc, 0.0)
    n = max(int(math.ceil(span / step)), 1)
    a0 = lo_arc
    f0 = f(a0)
    for i in range(1, n + 1):
        a1 = lo_arc + span * i / n
        f1 = f(a1)
        if f0 == 0.0:
            roots.append(a0)
        elif f0 * f1 < 0 and abs(f1 - f0) < 6.0:
            lo, hi, flo = a0, a1, f0
            for _ in range(60):
                m = 0.5 * (lo + hi)
                fm = f(m)
                if flo * fm <= 0:
                    hi = m
                else:
                    lo, flo = m, fm
            roots.append(0.5 * (lo + hi))
        a0, f0 = a1, f1
    if f0 == 0.0 and (not roots or roots[-1] != a0):
        roots.append(a0)
    return roots


def bezza_contacts(movers, points, armc, phi, eps, lo_arc, hi_arc, promissors=SEVEN):
    """弧 lo_arc..hi_arc 内的全部接触。四类(动 / 静角色照传统写法,不统一):
    mun  世俗相位:pid 推进 arc 后时位 − prm 本命时位 = 相位时数(两侧);
    par  子午映点:pid 推进后时位 + prm 本命时位 ≡ 0(模 24,对子午轴对称);
    apar 地平映点:pid 推进后时位 + prm 本命时位 ≡ 12(模 24,对地平轴对称);
    zod  黄道相位:prm 的黄道相位点(黄纬 0,自身赤纬取半弧)推进 arc 后落到 pid 本命时位。"""
    hp0 = {name: fn(0.0) for name, fn in movers.items()}
    out = []
    for pid, fn in movers.items():
        for prm in promissors:
            if prm == pid:
                continue
            for asp in MUNDANE_ASPECT_HOURS:
                for side in ((1,) if asp in (0, 12) else (1, -1)):
                    tgt = norm24(hp0[prm] + side * asp)
                    for a in _arc_roots(lambda x: signed12(fn(x) - tgt), lo_arc, hi_arc):
                        out.append({'kind': 'mun', 'pid': pid, 'prm': prm, 'asp': asp, 'arc': a})
            for kind, s in (('par', 0.0), ('apar', 12.0)):
                tgt = norm24(s - hp0[prm])
                for a in _arc_roots(lambda x: signed12(fn(x) - tgt), lo_arc, hi_arc):
                    out.append({'kind': kind, 'pid': pid, 'prm': prm, 'asp': 0, 'arc': a})
            plon = points[prm]['lon']
            for asp in ZODIAC_ASPECTS:
                for side in ((1,) if asp in (0, 180) else (1, -1)):
                    ara, adec = ecl_to_eq(norm360(plon + side * asp), 0.0, eps)
                    tgt = hp0[pid]
                    for a in _arc_roots(lambda x: signed12(mundane_hours_eq(ara, adec, norm360(armc + x), phi) - tgt), lo_arc, hi_arc):
                        out.append({'kind': 'zod', 'pid': pid, 'prm': prm, 'asp': asp, 'arc': a})
    out.sort(key=lambda c: (c['arc'], c['kind'], c['pid'], c['prm'], c['asp']))
    return out


# ===========================================================================
# 3. 周日小限(Jay):赤经中天每年 +30°(一年一宫);诸星保持本命 Placidus 世俗位置随天球转
# ===========================================================================
def jay_row(points, armc0, phi, eps, age):
    armc = norm360(armc0 + 30.0 * float(age))
    asc, mc = angles_at_armc(armc, phi, eps)
    row = {'age': float(age), 'armc': armc, 'Asc': asc, 'MC': mc}
    hp = {}
    for name in points:
        if name in ANGLES:
            continue
        p = points[name]
        hp[name] = mundane_hours(p['lon'], p['lat'], armc0, phi, eps)
        row[name] = ecliptic_point_at_hours(hp[name], armc, phi, eps)
    ty, _da = fortune_hours(hp['Sun'], hp['Moon'])
    row['Tyche'] = ecliptic_point_at_hours(ty, armc, phi, eps)
    return row


def house_of(lon, cusps):
    """黄经落在第几宫(cusps = 12 个宫头黄经,第 1 宫起)。"""
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if norm360(lon - a) < norm360(b - a):
            return i + 1
    return 1


# ===========================================================================
# 4. 双黄道(Michon):回归第 k 座 ↔ 恒星第 k−1 座叠合;两颗守护星的距角落在五类谐波族
# ===========================================================================
MICHON_AYAN_T0 = 2451545.0
MICHON_AYAN_DEG = 26.0 + 37.0 / 60.0 + 18.0 / 3600.0
# 现代守护:白羊火 金牛金 双子水 巨蟹月 狮子日 处女水 天秤金 天蝎冥 射手木 摩羯土 宝瓶天 双鱼海
MODERN_RULERS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Pluto', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
MERCURY_VENUS_SIGNS = (1, 2, 5, 6)  # 金牛 双子 处女 天秤(0 起)
# 五族:代码 / 步长 / 是否只取奇数倍
MICHON_FAMILIES = [
    ('en', 30.0, False),          # 12 谐(合 / 半六合 / 冲 …)
    ('re', 20.0, False),          # 18 谐
    ('ta', 18.0, False),          # 20 谐
    ('mi', 360.0 / 14.0, False),  # 14 谐
    ('bl', 15.0, True),           # 24 谐去掉 12 谐(15° 的奇数倍)
]


def michon_ayanamsa(jd):
    """J2000.0 时 26°37′18″、其余时刻随标准岁差(Swiss Ephemeris 自定义恒星黄道)。
    set_sid_mode → get_ayanamsa_ut 相邻两行(sid_mode 是进程级全局态,并发纪律见 tests/test_swe_concurrency.py)。"""
    swisseph.set_sid_mode(swisseph.SIDM_USER, MICHON_AYAN_T0, MICHON_AYAN_DEG)
    return swisseph.get_ayanamsa_ut(jd)


def michon_rulers(swap_mercury_venus=False):
    rulers = list(MODERN_RULERS)
    if swap_mercury_venus:
        for i in MERCURY_VENUS_SIGNS:
            rulers[i] = 'Mercury' if rulers[i] == 'Venus' else 'Venus'
    return rulers


def michon_family(sep, orb):
    """距角 → (族代码, 该族精确角, 偏差);不在任何族容许内 → ('no', None, None)。多族同中取偏差最小,再按族序。"""
    best = None
    for rank, (code, step, odd) in enumerate(MICHON_FAMILIES):
        if odd:
            k = round((sep / step - 1.0) / 2.0) * 2 + 1
            k = max(k, 1)
        else:
            k = round(sep / step)
        exact = k * step
        d = sep - exact
        if abs(d) <= orb + 1e-9:
            cand = (abs(d), rank, code, exact, d)
            if best is None or cand[:2] < best[:2]:
                best = cand
    if best is None:
        return 'no', None, None
    return best[2], best[3], best[4]


def equal_cusps_centered(asc):
    """等宫且上升居第一宫正中:第 k 宫起于 上升 − 15° + 30°·(k − 1)。"""
    return [norm360(asc - 15.0 + 30.0 * k) for k in range(12)]


def michon_tables(natal_lons, orb=1.0, swap_mercury_venus=False, cusps=None):
    """叠合 12 行 + 互动 66 行。natal_lons = {星名: 黄经};cusps = 本命 12 宫头(叠合所在宫 = 回归星座起点所在宫,
    下一宫即其恒星伴座所叠的宫);不给宫头时按星座序号编宫。"""
    rulers = michon_rulers(swap_mercury_venus)
    sups = []
    for n in range(12):
        ts = n
        ss = (n - 1) % 12
        p1, p2 = rulers[ts], rulers[ss]
        sep = ang_dist(natal_lons[p1], natal_lons[p2])
        f, exact, d = michon_family(sep, orb)
        h0 = house_of(30.0 * ts, cusps) if cusps else n + 1
        sups.append({'n': n + 1, 'tropicalSign': ts, 'siderealSign': ss, 'p1': p1, 'p2': p2, 'sep': sep,
                     'family': f, 'exact': exact, 'dev': d, 'house0': h0, 'house1': h0 % 12 + 1,
                     'mercuryVenus': ts in MERCURY_VENUS_SIGNS or ss in MERCURY_VENUS_SIGNS})
    inters = []
    for a in range(12):
        for b in range(a + 1, 12):
            ta, tb = sups[a]['p1'], sups[b]['p1']
            sa, sb = sups[a]['p2'], sups[b]['p2']
            tsep = ang_dist(natal_lons[ta], natal_lons[tb])
            ssep = ang_dist(natal_lons[sa], natal_lons[sb])
            tf, tex, td = michon_family(tsep, orb)
            sf, sex, sd = michon_family(ssep, orb)
            inters.append({'a': a + 1, 'b': b + 1, 'tropical': [ta, tb], 'sidereal': [sa, sb],
                           'tropicalSep': tsep, 'tropicalFamily': tf, 'tropicalExact': tex, 'tropicalDev': td, 'tropicalSame': ta == tb,
                           'siderealSep': ssep, 'siderealFamily': sf, 'siderealExact': sex, 'siderealDev': sd, 'siderealSame': sa == sb})
    return sups, inters


# ===========================================================================
# 出口:请求体 → 结果(页面 / AI 快照 / 导出共用)
# ===========================================================================
def _num(v, default):
    try:
        x = float(v)
        return x if math.isfinite(x) else default
    except (TypeError, ValueError):
        return default


def _flag(v):
    return str(v).strip().lower() in ('1', 'true', 'yes', 'on')


def _natal_from_request(data):
    """请求体(与起盘同形)→ 本命底盘 + 盘面宫头(按盘面宫制)+ 目标时刻年龄。回归黄道。"""
    from flatlib.datetime import Datetime
    from astrostudy.perchart import PerChart
    from astrostudy.astroextra_parts.common import base_params, date_time_from_jd
    params = base_params(data)
    params['zodiacal'] = 0
    perchart = PerChart(params)
    chart = perchart.chart
    frame = natal_frame(chart.date.jd, chart.pos.lat, chart.pos.lon)
    houses = sorted(chart.houses.content.values(), key=lambda h: int(str(h.id).replace('House', '') or 0))
    frame['cusps'] = [norm360(h.lon) for h in houses][:12]
    zone = params.get('zone', '+00:00')
    if data.get('targetDate'):
        target_jd = Datetime(str(data['targetDate']), str(data.get('targetTime') or '12:00:00'), zone).jd
    else:
        import time
        target_jd = 2440587.5 + time.time() / 86400.0
    frame['targetJd'] = target_jd
    frame['age'] = age_years(frame['jd'], target_jd)
    frame['zone'] = zone
    frame['birth'] = perchart.getBirthStr()
    frame['dateOf'] = lambda jd: date_time_from_jd(jd, zone)['datetime']
    return frame


def _relocated_chart(data, obj_fn, angle_fn, cusps=None):
    """在本命盘上搬点,出一张与 /chart 同形的盘面对象(双盘外圈用):
    obj_fn(lon, lat) → (lon, lat) 作用于全部星体与虚点;angle_fn(id, lon) → lon 作用于上升 / 天顶(下降 / 天底随之对冲);
    cusps = 12 个宫头黄经(None = 宫位不动)。失败返回 None(表格不受影响)。"""
    from flatlib import const
    from astrostudy.perchart import PerChart, parse_terms_variant, push_classical_request, pop_classical_request
    from astrostudy.astroextra_parts.common import base_params
    params = base_params(data)
    params['zodiacal'] = 0
    token = None
    try:
        token = push_classical_request(data)
        pc = PerChart(params)
        for group in (pc.chart.objects, pc.chart.pars):
            for obj in group:
                lon, lat = obj_fn(obj.lon, getattr(obj, 'lat', 0.0) or 0.0)
                obj.relocate(lon)
                obj.lat = lat
        asc = pc.chart.getAngle(const.ASC)
        mc = pc.chart.getAngle(const.MC)
        asc_lon = angle_fn('Asc', asc.lon)
        mc_lon = angle_fn('MC', mc.lon)
        asc.relocate(asc_lon)
        mc.relocate(mc_lon)
        pc.chart.getAngle(const.DESC).relocate(norm360(asc_lon + 180.0))
        pc.chart.getAngle(const.IC).relocate(norm360(mc_lon + 180.0))
        if cusps:
            for h in pc.chart.houses:
                i = int(str(h.id)[5:7]) - 1
                h.relocate(cusps[i])
                h.size = norm360(cusps[(i + 1) % 12] - cusps[i])
        pc.reinit()
        return {
            'params': {'birth': pc.getBirthStr(), 'ad': -1 if getattr(pc, 'isBC', False) else 1,
                       'lat': params.get('lat'), 'lon': params.get('lon'), 'hsys': params.get('hsys'),
                       'zone': params.get('zone'), 'tradition': pc.tradition, 'zodiacal': pc.zodiacal,
                       'termsVariant': parse_terms_variant(data.get('termsVariant', 0))},
            'chart': pc.getChartObj(),
            'aspects': {'normalAsp': pc.getAspects(), 'immediateAsp': pc.getImmediateAspects(), 'signAsp': pc.getSignAspects()},
            'lots': pc.getPars(pc.chart),
            'receptions': pc.getReceptions(),
            'mutuals': pc.getMutuals(),
            'declParallel': pc.getParallel(),
        }
    except Exception:
        import traceback
        traceback.print_exc()
        return None
    finally:
        pop_classical_request(token)


def _common_head(frame):
    return {'birth': frame['birth'], 'targetJd': frame['targetJd'], 'target': frame['dateOf'](frame['targetJd']),
            'age': frame['age'], 'armc': frame['armc'], 'epsTrue': frame['epsTrue'], 'epsMean': frame['epsMean']}


def _natal_rows(frame):
    return [{'id': k, 'lon': v['lon'], 'lat': v['lat'], 'speed': v['speed']} for k, v in frame['points'].items()]


def neroman_angle_events(frame, k, t0, max_age, aspects=(0, 90, 180)):
    """演进天顶(Fatum)/ 上升(Sensitif)按黄经度数逆行,与本命各点成相位的年龄表(闭式:A = 赤经差 + 360°·n)。"""
    eps = frame['epsMean']
    max_arc = neroman_arc(max_age, k, t0)
    out = []
    for mover in ANGLES:
        ra0, _ = ecl_to_eq(frame['points'][mover]['lon'], 0.0, eps)
        for target, p in frame['points'].items():
            for asp in aspects:
                for side in ((1,) if asp in (0, 180) else (1, -1)):
                    tlon = norm360(p['lon'] + side * asp)
                    rat, _ = ecl_to_eq(tlon, 0.0, eps)
                    a = norm360(ra0 - rat)
                    while a <= max_arc:
                        if a > 1e-9 or target != mover:
                            age = neroman_age_for_arc(a, k, t0)
                            out.append({'mover': mover, 'target': target, 'asp': asp, 'arc': a, 'age': age,
                                        'date': frame['dateOf'](jd_at_age(frame['jd'], age))})
                        a += 360.0
    out.sort(key=lambda e: (e['age'], e['mover'], e['target'], e['asp']))
    return out


def build_neroman(data):
    frame = _natal_from_request(data)
    k = _num(data.get('nerK'), NEROMAN_K)
    t0 = _num(data.get('nerT0'), NEROMAN_T0)
    if k <= 0:
        k = NEROMAN_K
    if t0 <= 0:
        t0 = NEROMAN_T0
    keep = _flag(data.get('nerKeepDec'))
    orb = max(_num(data.get('orb'), 1.0), 0.0)
    max_age = min(max(_num(data.get('maxAge'), 100.0), 1.0), 150.0)
    age = max(frame['age'], 0.0)
    arc = neroman_arc(age, k, t0)
    eps = frame['epsMean']
    evolved = neroman_positions(frame['points'], arc, eps, keep)
    cusps = [neroman_point(c, 0.0, arc, eps, False)[0] for c in frame['cusps']]
    contacts = []
    for a, pa in evolved.items():
        for b, pb in frame['points'].items():
            for asp in ZODIAC_ASPECTS:
                dev = ang_dist(pa['lon'], pb['lon']) - asp
                if abs(dev) <= orb:
                    contacts.append({'evolved': a, 'natal': b, 'asp': asp, 'orb': dev})
    contacts.sort(key=lambda c: abs(c['orb']))
    out = _common_head(frame)
    out.update({'technique': 'neroman', 'k': k, 't0': t0, 'keepDeclination': keep, 'orb': orb, 'arc': arc,
                'natal': _natal_rows(frame), 'natalCusps': frame['cusps'],
                'evolved': [{'id': n, 'lon': v['lon'], 'lat': v['lat'], 'natalLon': frame['points'][n]['lon']} for n, v in evolved.items()],
                'evolvedCusps': cusps, 'contacts': contacts,
                'events': neroman_angle_events(frame, k, t0, max_age), 'maxAge': max_age})
    if _flag(data.get('withChart', 1)):
        out['chart'] = _relocated_chart(
            data, lambda lon, lat: neroman_point(lon, lat, arc, eps, keep),
            lambda _id, lon: neroman_point(lon, 0.0, arc, eps, False)[0], cusps)
    return out


def build_bezza(data):
    frame = _natal_from_request(data)
    orb = min(max(_num(data.get('orb'), 1.0), 0.05), 10.0)
    age = frame['age']
    arc = solar_arc_for_years(max(age, 0.0), frame['jd'])
    pts = {n: frame['points'][n] for n in SEVEN + ANGLES}
    rows, movers = bezza_point_rows(pts, frame['armc'], frame['phi'], frame['epsTrue'], arc)
    cons = bezza_contacts(movers, pts, frame['armc'], frame['phi'], frame['epsTrue'], max(arc - orb, 0.0), arc + orb)
    contacts = []
    for c in cons:
        c_age = key_placidus_true_solar_arc(c['arc'], frame['jd'])
        c.update({'d': c['arc'] - arc, 'age': c_age, 'date': frame['dateOf'](jd_at_age(frame['jd'], c_age))})
        contacts.append(c)
    out = _common_head(frame)
    out.update({'technique': 'bezza', 'orb': orb, 'arc': arc, 'points': rows, 'contacts': contacts})
    if _flag(data.get('withChart', 1)):
        armc, phi, eps = frame['armc'], frame['phi'], frame['epsTrue']

        def directed(lon, lat):
            ra, dec = ecl_to_eq(lon, lat, eps)
            hp1 = mundane_hours_eq(ra, dec, norm360(armc + arc), phi)
            d = ecliptic_point_at_hours(hp1, armc, phi, eps)
            return (d if d is not None else lon), 0.0
        out['chart'] = _relocated_chart(data, directed, lambda _id, lon: directed(lon, 0.0)[0], None)
    return out


def build_jay(data):
    frame = _natal_from_request(data)
    start = int(round(_num(data.get('jayFrom'), -1)))
    age = frame['age']
    if start < 0:
        start = int(math.floor(max(age, 0.0) / 12.0)) * 12
    pts = {n: frame['points'][n] for n in SEVEN}
    eps = frame['epsTrue']

    def row_at(a, cur=False):
        r = jay_row(pts, frame['armc'], frame['phi'], eps, a)
        r['house'] = house_of(r['Asc'], frame['cusps'])
        r['date'] = frame['dateOf'](jd_at_age(frame['jd'], a))
        r['current'] = cur
        return r

    rows = [row_at(float(n)) for n in range(start, start + 12)]
    out = _common_head(frame)
    cur = row_at(max(age, 0.0), True)
    # 本命位置(对照用):七政 / 上升 / 天顶取本命黄经,福点取本命世俗时位上的黄道点
    hp_sun = mundane_hours(pts['Sun']['lon'], pts['Sun']['lat'], frame['armc'], frame['phi'], eps)
    hp_moon = mundane_hours(pts['Moon']['lon'], pts['Moon']['lat'], frame['armc'], frame['phi'], eps)
    natal = {n: frame['points'][n]['lon'] for n in SEVEN + ANGLES}
    natal['Tyche'] = ecliptic_point_at_hours(fortune_hours(hp_sun, hp_moon)[0], frame['armc'], frame['phi'], eps)
    out.update({'technique': 'jay', 'from': start, 'current': cur, 'rows': rows, 'natal': natal, 'natalCusps': frame['cusps']})
    if _flag(data.get('withChart', 1)):
        armc0, phi = frame['armc'], frame['phi']
        armc1 = cur['armc']

        def profected(lon, lat):
            d = ecliptic_point_at_hours(mundane_hours(lon, lat, armc0, phi, eps), armc1, phi, eps)
            return (d if d is not None else lon), 0.0
        try:
            cusps1 = [norm360(c) for c in swisseph.houses_armc(armc1, phi, eps, b'P')[0][:12]]
        except Exception:
            cusps1 = None
        out['chart'] = _relocated_chart(data, profected, lambda name, _lon: cur[name], cusps1)
    return out


def build_michon(data):
    frame = _natal_from_request(data)
    orb = min(max(_num(data.get('orb'), 1.0), 0.1), 5.0)
    swap = _flag(data.get('mzSwap'))
    equal = _flag(data.get('mzEqual'))
    lons = {n: v['lon'] for n, v in frame['points'].items() if n in MODERN_RULERS}
    cusps = equal_cusps_centered(frame['points']['Asc']['lon']) if equal else frame['cusps']
    ayan = michon_ayanamsa(frame['jd'])
    sups, inters = michon_tables(lons, orb, swap, cusps)
    planets = [{'id': n, 'lon': v['lon'], 'sidLon': norm360(v['lon'] - ayan)} for n, v in frame['points'].items() if n in MODERN_RULERS]
    out = _common_head(frame)
    out.update({'technique': 'michon', 'orb': orb, 'swapMercuryVenus': swap, 'equalHouses': equal, 'ayanamsa': ayan,
                'cusps': cusps, 'planets': planets, 'superpositions': sups, 'interactions': inters})
    return out
