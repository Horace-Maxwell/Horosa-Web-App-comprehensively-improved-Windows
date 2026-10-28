"""/astroextra/ephemeris 与食相一族:过零细化 / 换座 / 留 / 月相 / 食 / 逐日黄经 / 升没 / 天象 / 偕日 / 食相详情(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字;端点汇总 build_ephemeris 与行运触发留在门面)。"""
import math
import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from astrostudy.astroextra_parts.common import (
    PLANET_SWISS_IDS, norm360, norm180, safe_float, geo_to_degree, date_time_from_jd, swe_lon, sign_index,
    sign_name_from_lon,
)


def refine_crossing(func, a, b, iterations=24):
    fa = func(a)
    fb = func(b)
    if fa == 0:
        return a
    if fb == 0:
        return b
    for _ in range(iterations):
        mid = (a + b) / 2.0
        fm = func(mid)
        if (fa <= 0 <= fm) or (fa >= 0 >= fm):
            b = mid
            fb = fm
        else:
            a = mid
            fa = fm
    return (a + b) / 2.0


def calc_ingresses(start_jd, end_jd, zone, planets):
    events = []
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        step = 0.25 if body == const.MOON else 1.0
        jd = start_jd
        prev_lon, _, _ = swe_lon(body, jd)
        prev_sign = sign_index(prev_lon)
        while jd < end_jd:
            nxt = min(jd + step, end_jd)
            lon, speed, _ = swe_lon(body, nxt)
            cur_sign = sign_index(lon)
            if cur_sign != prev_sign:
                def f(x):
                    l, _, _ = swe_lon(body, x)
                    return norm180(l - cur_sign * 30.0)
                hit_jd = refine_crossing(f, jd, nxt)
                hit_lon, hit_speed, _ = swe_lon(body, hit_jd)
                # 入座符号取「已知的进入星座」cur_sign,而非由 hit_lon 反推:
                # 求根可能收敛到边界下侧(如 29.9999°),sign_name_from_lon 会误判成「离开的星座」。
                # cur_sign = nxt 时刻所在星座 = 实际进入星座(顺逆行皆然),不受浮点边界抖动影响。
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'ingress',
                    'body': body,
                    'toSign': const.LIST_SIGNS[cur_sign],
                    'lon': hit_lon,
                    'speed': hit_speed,
                })
                prev_sign = cur_sign
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def calc_stations(start_jd, end_jd, zone, planets):
    events = []
    for body in planets:
        if body not in PLANET_SWISS_IDS or body in (const.SUN, const.MOON):
            continue
        jd = start_jd
        _, prev_speed, _ = swe_lon(body, jd)
        while jd < end_jd:
            nxt = min(jd + 1.0, end_jd)
            lon, speed, _ = swe_lon(body, nxt)
            if (prev_speed <= 0 <= speed) or (prev_speed >= 0 >= speed):
                def f(x):
                    _, s, _ = swe_lon(body, x)
                    return s
                hit_jd = refine_crossing(f, jd, nxt)
                hit_lon, hit_speed, _ = swe_lon(body, hit_jd)
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'station',
                    'body': body,
                    'direction': 'Direct' if hit_speed >= 0 else 'Retrograde',
                    'lon': hit_lon,
                    'speed': hit_speed,
                    'sign': sign_name_from_lon(hit_lon),
                    'signlon': hit_lon % 30,
                })
            prev_speed = speed
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def moon_sun_elongation(jd):
    moon, _, _ = swe_lon(const.MOON, jd)
    sun, _, _ = swe_lon(const.SUN, jd)
    return norm360(moon - sun)


def calc_lunar_phases(start_jd, end_jd, zone):
    targets = [
        (0, 'New Moon'), (90, 'First Quarter'),
        (180, 'Full Moon'), (270, 'Last Quarter')
    ]
    events = []
    for target, label in targets:
        jd = start_jd
        prev = norm180(moon_sun_elongation(jd) - target)
        while jd < end_jd:
            nxt = min(jd + 0.5, end_jd)
            cur = norm180(moon_sun_elongation(nxt) - target)
            # ⚠️ 必须排除 norm180 在 ±180 处的回绕跳变(真交叉 step 仅~6°/12h、回绕 step≈360°)。
            # 否则 target=0(新月)会在 elong=180(对分)处 f 从 +179 跳到 −179 被误判成过零 →
            # 每个朔望时刻同时被标 New Moon + Full Moon,前端新月/满月列表全被串成对方。
            if ((prev <= 0 <= cur) or (prev >= 0 >= cur)) and abs(cur - prev) < 180:
                def f(x):
                    return norm180(moon_sun_elongation(x) - target)
                hit_jd = refine_crossing(f, jd, nxt)
                moon_lon, _, _ = swe_lon(const.MOON, hit_jd)
                sun_lon, _, _ = swe_lon(const.SUN, hit_jd)
                events.append({
                    **date_time_from_jd(hit_jd, zone),
                    'type': 'lunar_phase',
                    'phase': label,
                    'moonLon': moon_lon,
                    'sunLon': sun_lon,
                    'sign': sign_name_from_lon(moon_lon),
                    'signlon': moon_lon % 30,
                })
            prev = cur
            jd = nxt
    return sorted(events, key=lambda item: item['jd'])


def eclipse_type(retflag, lunar=False):
    types = []
    if retflag & swisseph.ECL_TOTAL:
        types.append('total')
    if retflag & swisseph.ECL_ANNULAR:
        types.append('annular')
    if retflag & getattr(swisseph, 'ECL_ANNULAR_TOTAL', 0):
        types.append('hybrid')
    if retflag & swisseph.ECL_PARTIAL:
        types.append('partial')
    if lunar and retflag & swisseph.ECL_PENUMBRAL:
        types.append('penumbral')
    return '/'.join(types) if types else 'eclipse'


def _eclipse_band(digit):
    # WI-23 食分分档:1–2 小 / 3–6 中 / 7–11 大 / ≥12 全(月食 umbral 可 >12 仍为全食)。
    if digit is None:
        return None
    if digit < 3.0:
        return '小'
    if digit < 7.0:
        return '中'
    if digit < 12.0:
        return '大'
    return '全'


def _syzygy_near(e_jd, target):
    """[WP-2] 食甚附近求精确朔望时刻:f(t)=日月黄经差−target(0=朔/180=望)在 ±1.5 日窗内二分。
    找不到变号(理论不应发生)回落食甚。"""
    def f(t):
        s, _, _ = swe_lon(const.SUN, t)
        m, _, _ = swe_lon(const.MOON, t)
        return ((m - s - target + 180.0) % 360.0) - 180.0
    try:
        lo, hi = e_jd - 1.5, e_jd + 1.5
        flo = f(lo)
        if (flo < 0) == (f(hi) < 0):
            return e_jd
        for _ in range(40):
            mid = (lo + hi) / 2.0
            if (flo < 0) == (f(mid) < 0):
                lo, flo = mid, f(mid)
            else:
                hi = mid
        return (lo + hi) / 2.0
    except Exception:
        return e_jd


def _calc_eclipses_inner(start_jd, end_jd, zone, time_mode='max'):
    # time_mode:'max'(默认=现状,tret[0] 食甚)/'syzygy'(精确朔望时刻——日食取朔/月食取望;
    # 搜索推进与事件身份仍按食甚,仅显示时刻换算)。
    events = []
    jd = start_jd - 1
    while True:
        ret, tret = swisseph.sol_eclipse_when_glob(jd, swisseph.FLG_SWIEPH, 0, False)
        e_jd = tret[0]
        if e_jd > end_jd:
            break
        if e_jd >= start_jd:
            sun_lon, _, _ = swe_lon(const.SUN, e_jd)
            try:
                _r, _geo, sattr = swisseph.sol_eclipse_where(e_jd, swisseph.FLG_SWIEPH)
                mag = float(sattr[0])
            except Exception:
                mag = None
            digit = round(mag * 12.0, 1) if mag is not None else None
            _show_jd = _syzygy_near(e_jd, 0.0) if time_mode == 'syzygy' else e_jd
            events.append({
                **date_time_from_jd(_show_jd, zone),
                'type': 'solar_eclipse',
                'eclipseType': eclipse_type(ret),
                'body': const.SUN,
                'lon': sun_lon,
                'sign': sign_name_from_lon(sun_lon),
                'signlon': sun_lon % 30,
                'magnitude': mag,
                'digit': digit,
                'band': _eclipse_band(digit),
            })
        jd = e_jd + 1
    jd = start_jd - 1
    while True:
        ret, tret = swisseph.lun_eclipse_when(jd, swisseph.FLG_SWIEPH, 0, False)
        e_jd = tret[0]
        if e_jd > end_jd:
            break
        if e_jd >= start_jd:
            moon_lon, _, _ = swe_lon(const.MOON, e_jd)
            try:
                _r, lattr = swisseph.lun_eclipse_how(e_jd, [0.0, 0.0, 0.0], swisseph.FLG_SWIEPH)
                mag = float(lattr[0])   # 本影食分(>1 即全食)
            except Exception:
                mag = None
            digit = round(mag * 12.0, 1) if mag is not None else None
            _show_jd = _syzygy_near(e_jd, 180.0) if time_mode == 'syzygy' else e_jd
            events.append({
                **date_time_from_jd(_show_jd, zone),
                'type': 'lunar_eclipse',
                'eclipseType': eclipse_type(ret, lunar=True),
                'body': const.MOON,
                'lon': moon_lon,
                'sign': sign_name_from_lon(moon_lon),
                'signlon': moon_lon % 30,
                'magnitude': mag,
                'digit': digit,
                'band': _eclipse_band(digit),
            })
        jd = e_jd + 1
    return sorted(events, key=lambda item: item['jd'])


def calc_eclipses(start_jd, end_jd, zone, time_mode='max'):
    """食相搜索:窗口贴近星历域上界时,前向搜索会越出数据尽头(如 16799 年末搜下一次
    月食需 16800 段)——此时返回已搜到的部分(域内事件不受影响),不拖垮整个星历页。
    [WP-2] time_mode 见 _calc_eclipses_inner(默认 'max'=食甚现状零回归)。"""
    try:
        return _calc_eclipses_inner(start_jd, end_jd, zone, time_mode)
    except Exception:
        return []


def calc_daily_positions(start_jd, end_jd, zone, planets, max_days=370):
    rows = []
    days = int(math.floor(end_jd - start_jd)) + 1
    if days > max_days:
        days = max_days
    for idx in range(days):
        jd = start_jd + idx
        row = date_time_from_jd(jd, zone)
        row['positions'] = {}
        for body in planets:
            if body not in PLANET_SWISS_IDS:
                continue
            lon, speed, xx = swe_lon(body, jd)
            row['positions'][body] = {
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
                'speed': speed,
                'retrograde': speed < 0,
                'lat': xx[1],
                'distance': xx[2],
            }
        rows.append(row)
    return rows


def calc_rise_set(start_jd, data, planets):
    geopos = [
        geo_to_degree(data.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(data.get('lat', '0n00'), 'n', 's'),
        safe_float(data.get('altitude', 0.0), 0.0),
    ]
    rows = []
    zero = math.floor(start_jd - 0.5) + 0.5
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        item = {'body': body}
        for key, flag in (
            ('rise', swisseph.CALC_RISE),
            ('set', swisseph.CALC_SET),
            ('upperTransit', swisseph.CALC_MTRANSIT),
            ('lowerTransit', swisseph.CALC_ITRANSIT),
        ):
            try:
                ret, tret = swisseph.rise_trans(zero, PLANET_SWISS_IDS[body], flag, geopos, 0.0, 0.0, swisseph.FLG_SWIEPH)
                item[key] = date_time_from_jd(tret[0], data.get('zone', '+00:00'))
                item[key]['retflag'] = ret
            except Exception as exc:
                item[key] = {'err': str(exc)}
        rows.append(item)
    return rows


def calc_phenomena(start_jd, planets):
    rows = []
    for body in planets:
        if body not in PLANET_SWISS_IDS:
            continue
        try:
            attr = swisseph.pheno_ut(start_jd, PLANET_SWISS_IDS[body], swisseph.FLG_SWIEPH)
            rows.append({
                'body': body,
                'phaseAngle': attr[0],
                'phase': attr[1],
                'elongation': attr[2],
                'apparentDiameter': attr[3],
                'magnitude': attr[4],
            })
        except Exception as exc:
            rows.append({'body': body, 'err': str(exc)})
    return rows


def calc_heliacal(start_jd, data, planets):
    geopos = [
        geo_to_degree(data.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(data.get('lat', '0n00'), 'n', 's'),
        safe_float(data.get('altitude', 0.0), 0.0),
    ]
    atmo = [1013.25, 15.0, 40.0, 0.25]
    observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
    rows = []
    for body in planets:
        if body not in (const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN):
            continue
        item = {'body': body}
        for key, event in (('rising', swisseph.HELIACAL_RISING), ('setting', swisseph.HELIACAL_SETTING)):
            try:
                tret = swisseph.heliacal_ut(start_jd, geopos, atmo, observer, body, event, swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION)
                jd = tret[0] if isinstance(tret, (list, tuple)) else tret
                item[key] = date_time_from_jd(jd, data.get('zone', '+00:00'))
            except Exception as exc:
                item[key] = {'err': str(exc)}
        rows.append(item)
    return rows


def compute_eclipse_detail(data):
    """ 食时长定则（A4b）：日食持续 N 小时 → 影响约 N 年；月食 N 小时 → N 月。
        params: date/time/zone(食时刻附近) + eclipseKind(solar/lunar)。返回 swe 全球食的初亏-复圆时长。 """
    date = data.get('date')
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    kind = str(data.get('eclipseKind', 'solar'))
    result = {'kind': kind, 'durationHours': 0.0, 'influence': 0.0, 'influenceUnit': ('年' if kind == 'solar' else '月')}
    try:
        dt = Datetime(date, time, zone)
        jd_search = dt.jd - 2.0
        if kind == 'lunar':
            _ret, tret = swisseph.lun_eclipse_when(jd_search, swisseph.FLG_SWIEPH, 0, False)
            begin = tret[2] if tret[2] else tret[6]
            end = tret[3] if tret[3] else tret[7]
        else:
            _ret, tret = swisseph.sol_eclipse_when_glob(jd_search, swisseph.FLG_SWIEPH, 0, False)
            begin = tret[2]
            end = tret[3]
        dur_h = (end - begin) * 24.0 if (begin and end and end > begin) else 0.0
        result['durationHours'] = round(dur_h, 2)
        result['influence'] = round(dur_h, 1)
    except Exception:
        pass
    return result
