"""周期一族:大会合 / 行星周期 / 循环指数 / 行星返照(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
import swisseph
from flatlib.datetime import Datetime
from astrostudy.astroextra_parts.common import date_time_from_jd, center_flag
# 起止年 / 结果的 year 字段按天文年(公元前 1 年 = 0,与世俗页年份输入同口径);月日按民用历(1582-10-15 以前儒略历)。
from astrostudy.civil_calendar import civil_julday, civil_revjul


def _int_arg(data, key, default):
    """请求参数转 int;缺键取 default,转不动也回 default。"""
    try:
        return int(data.get(key, default))
    except Exception:
        return default


def _float_arg(data, key, default):
    """请求参数转 float;缺键取 default,转不动也回 default。"""
    try:
        return float(data.get(key, default))
    except Exception:
        return default


def compute_great_conjunctions(data):
    """ 木土大合相精算：扫描 [startYear, endYear] 区间内木星-土星黄经合相（含三重合相分列）。 """
    start_year = _int_arg(data, 'startYear', 1900)
    end_year = _int_arg(data, 'endYear', 2100)
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 3400:
        end_year = start_year + 3400

    def _lon(jd_, planet):
        return swisseph.calc_ut(jd_, planet)[0][0]

    def _signed_diff(jd_):
        d = _lon(jd_, swisseph.JUPITER) - _lon(jd_, swisseph.SATURN)
        return ((d + 180.0) % 360.0) - 180.0

    jd = civil_julday(start_year, 1, 1, 0.0)
    end_jd = civil_julday(end_year, 12, 31, 0.0)
    step = 8.0
    prev_jd = jd
    prev_d = _signed_diff(jd)
    results = []
    cur = jd + step
    while cur <= end_jd:
        d = _signed_diff(cur)
        # 合相 = 带符号黄经差过零（排除冲相 ±180 的环绕跳变）
        if (prev_d < 0) != (d < 0) and abs(prev_d - d) < 180.0:
            lo, hi, dlo = prev_jd, cur, prev_d
            for _ in range(50):
                mid = (lo + hi) / 2.0
                dm = _signed_diff(mid)
                if (dm < 0) == (dlo < 0):
                    lo, dlo = mid, dm
                else:
                    hi = mid
            cjd = (lo + hi) / 2.0
            jl = _lon(cjd, swisseph.JUPITER) % 360.0
            y, m, dd, hh = civil_revjul(cjd)
            results.append({
                'jd': round(cjd, 4),
                'year': int(y), 'month': int(m), 'day': int(dd), 'hour': round(hh, 4),
                'lon': round(jl, 2),
                'sign': int(jl / 30.0) % 12,
            })
        prev_jd, prev_d = cur, d
        cur += step
    return {'conjunctions': results, 'startYear': start_year, 'endYear': end_year}


_SWE_PLANET_BY_NAME = {
    'Sun': swisseph.SUN, 'Moon': swisseph.MOON, 'Mercury': swisseph.MERCURY,
    'Venus': swisseph.VENUS, 'Mars': swisseph.MARS, 'Jupiter': swisseph.JUPITER,
    'Saturn': swisseph.SATURN, 'Uranus': swisseph.URANUS, 'Neptune': swisseph.NEPTUNE,
    'Pluto': swisseph.PLUTO, 'Node': swisseph.TRUE_NODE,
}

# 各体平均回归周期（天），仅用于步进定位返照点。
_MEAN_PERIOD_DAYS = {
    swisseph.SUN: 365.2422, swisseph.MOON: 27.3217, swisseph.MERCURY: 87.969,
    swisseph.VENUS: 224.701, swisseph.MARS: 686.980, swisseph.JUPITER: 4332.59,
    swisseph.SATURN: 10759.22, swisseph.URANUS: 30688.5, swisseph.NEPTUNE: 60182.0,
    swisseph.PLUTO: 90560.0, swisseph.TRUE_NODE: 6793.48,
}


def compute_planet_cycles(data):
    """ 任意两慢星的合/冲时间轴（A4b 外行星周期）：泛化 compute_great_conjunctions。
        params: startYear,endYear,p1,p2(星名),aspect(0 合 / 180 冲)。 """
    start_year = _int_arg(data, 'startYear', 1900)
    end_year = _int_arg(data, 'endYear', 2100)
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 3400:
        end_year = start_year + 3400
    p1 = _SWE_PLANET_BY_NAME.get(str(data.get('p1', 'Jupiter')), swisseph.JUPITER)
    p2 = _SWE_PLANET_BY_NAME.get(str(data.get('p2', 'Saturn')), swisseph.SATURN)
    aspect = _float_arg(data, 'aspect', 0.0)
    # 中心透传:地心走原调用(golden 字节级不变);日心/站心加 center 旗标(全局周期,topo 无经纬≈geo)。
    center = str(data.get('center', 'geo') or 'geo').lower()
    _extra_flag = center_flag(center) if center in ('helio', 'topo') else 0
    if center == 'topo':
        # 站心必须先显式置观测点(与 swe_lon 同口径):否则冷启进程抛「geographic position has not been set」,
        # 或沿用上一次请求的站点(跨请求泄漏、不可 golden)。无坐标 → (0,0,0) 确定性兜底。
        def _f(key):
            try:
                return float(data.get(key))
            except (TypeError, ValueError):
                return 0.0
        try:
            swisseph.set_topo(_f('gpsLon'), _f('gpsLat'), 0.0)
        except Exception:
            pass

    def _lon(jd_, planet):
        if _extra_flag:
            return swisseph.calc_ut(jd_, planet, swisseph.FLG_SWIEPH | _extra_flag)[0][0]
        return swisseph.calc_ut(jd_, planet)[0][0]

    def _signed_diff(jd_):
        d = _lon(jd_, p1) - _lon(jd_, p2) - aspect
        return ((d + 180.0) % 360.0) - 180.0

    jd = civil_julday(start_year, 1, 1, 0.0)
    end_jd = civil_julday(end_year, 12, 31, 0.0)
    step = 6.0
    prev_jd = jd
    prev_d = _signed_diff(jd)
    results = []
    cur = jd + step
    while cur <= end_jd:
        d = _signed_diff(cur)
        if (prev_d < 0) != (d < 0) and abs(prev_d - d) < 180.0:
            lo, hi, dlo = prev_jd, cur, prev_d
            for _ in range(50):
                mid = (lo + hi) / 2.0
                dm = _signed_diff(mid)
                if (dm < 0) == (dlo < 0):
                    lo, dlo = mid, dm
                else:
                    hi = mid
            cjd = (lo + hi) / 2.0
            jl = _lon(cjd, p1) % 360.0
            y, m, dd, hh = civil_revjul(cjd)
            results.append({
                'jd': round(cjd, 4),
                'year': int(y), 'month': int(m), 'day': int(dd), 'hour': round(hh, 4),
                'lon': round(jl, 2), 'sign': int(jl / 30.0) % 12,
            })
        prev_jd, prev_d = cur, d
        cur += step
    return {
        'events': results,
        'startYear': start_year, 'endYear': end_year,
        'p1': str(data.get('p1', 'Jupiter')), 'p2': str(data.get('p2', 'Saturn')),
        'aspect': aspect, 'center': center,
    }


def compute_barbault(data):
    """ Barbault 行星周期指数(§9.3 Indice Cyclique):取慢星两两角距和成「行星聚散」曲线。
        默认 5 慢星 ♃♄♅♆♇ → C(5,2)=10 对;每对 d=min(|λi−λj|,360−) ∈[0,180];Index=Σ ∈[0,1800]。
        低(→0,聚集)=危机/战争(史上 1914、1939-40 极小与两次大战吻合);高(→1800,四散)=扩张繁荣。
        params: startYear,endYear,stepMonths(默认1),planets(名表,可配「仅外三星」等变体),center。 """
    start_year = _int_arg(data, 'startYear', 1900)
    end_year = _int_arg(data, 'endYear', 2050)
    if end_year < start_year:
        start_year, end_year = end_year, start_year
    if end_year - start_year > 300:          # 上限 300 年(逐月 ~3600 点),防超大请求
        end_year = start_year + 300
    step_months = _int_arg(data, 'stepMonths', 1)
    if step_months < 1:
        step_months = 1
    if step_months > 12:
        step_months = 12
    DEFAULT = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
    names = data.get('planets')
    ids = []
    if isinstance(names, list):
        for n in names:
            pid = _SWE_PLANET_BY_NAME.get(str(n))
            if pid is not None:
                ids.append((str(n), pid))
    if len(ids) < 2:
        ids = [(n, _SWE_PLANET_BY_NAME[n]) for n in DEFAULT]
    center = str(data.get('center', 'geo') or 'geo').lower()
    extra_flag = center_flag(center) if center in ('helio', 'topo') else 0

    def _lon(jd_, planet):
        if extra_flag:
            return swisseph.calc_ut(jd_, planet, swisseph.FLG_SWIEPH | extra_flag)[0][0]
        return swisseph.calc_ut(jd_, planet)[0][0]

    n_pairs = len(ids) * (len(ids) - 1) // 2
    max_index = round(180.0 * n_pairs, 2)
    points = []
    y, m = start_year, 1
    while y < end_year or (y == end_year and m <= 12):
        jd = civil_julday(y, m, 1, 0.0)
        lons = [_lon(jd, pid) % 360.0 for _, pid in ids]
        total = 0.0
        for i in range(len(lons)):
            for j in range(i + 1, len(lons)):
                d = abs(lons[i] - lons[j]) % 360.0
                if d > 180.0:
                    d = 360.0 - d
                total += d
        points.append({'year': y, 'month': m, 'index': round(total, 2)})
        m += step_months
        while m > 12:
            m -= 12
            y += 1
    # 局部极小/极大(拐点候选)
    extrema = []
    for k in range(1, len(points) - 1):
        a, b, c2 = points[k - 1]['index'], points[k]['index'], points[k + 1]['index']
        if b < a and b <= c2:
            extrema.append({'year': points[k]['year'], 'month': points[k]['month'], 'index': b, 'kind': 'min'})
        elif b > a and b >= c2:
            extrema.append({'year': points[k]['year'], 'month': points[k]['month'], 'index': b, 'kind': 'max'})
    return {
        'points': points,
        'extrema': extrema,
        'maxIndex': max_index,
        'planets': [n for n, _ in ids],
        'startYear': start_year, 'endYear': end_year, 'stepMonths': step_months, 'center': center,
    }


# 回归扫描:各体地心「回到本命黄经」的平均间隔(天,只用于定扫描终点;水金地心平均也是一年)
# 与采样步长(天,须短于两次留之间的最短间隔,留点由步长内速度变号再二分精确定)。
_RETURN_SPAN_DAYS = {
    swisseph.SUN: 365.2422, swisseph.MOON: 27.3216, swisseph.MERCURY: 365.2422, swisseph.VENUS: 365.2422,
    swisseph.MARS: 686.98, swisseph.JUPITER: 4332.59, swisseph.SATURN: 10759.22, swisseph.URANUS: 30688.5,
    swisseph.NEPTUNE: 60182.0, swisseph.PLUTO: 90560.0, swisseph.TRUE_NODE: 6798.38, swisseph.MEAN_NODE: 6798.38,
}
_RETURN_STEP_DAYS = {
    swisseph.SUN: 2.0, swisseph.MOON: 0.25, swisseph.MERCURY: 0.5, swisseph.VENUS: 1.0, swisseph.MARS: 1.0,
    swisseph.JUPITER: 3.0, swisseph.SATURN: 4.0, swisseph.URANUS: 5.0, swisseph.NEPTUNE: 5.0, swisseph.PLUTO: 5.0,
    swisseph.TRUE_NODE: 0.25, swisseph.MEAN_NODE: 5.0,
}


def compute_planet_return(data):
    """ 多重回归（C5）：行星回到本命黄经的时刻,第 n 回 = 黄经走满 n 圈(逆行体反向走满)那一次。
        params: date/time/zone/lat/lon(本命) + body(星名) + count(几回),盘的黄道(回归 / 恒星 + 岁差)
        与月交点真平(westNodeType / guolaoNodeType,缺省平交点)随盘 —— 本命黄经与扫描同一框架。
        算法:按步长采样黄经与速度,速度变号处二分出留点,把时间切成单调段;每段内黄经展开后
        对每个「本命黄经 + 360°·k」二分求解(单调段内唯一)。同一圈 k 的各次经过(逆行三过)归为同一回,
        顶层日期取首过,全部经过放 passes。扫到终点仍没齐的回不编造日期(found=False)。 """
    from astrostudy.perchart import PerChart
    from astrostudy.astroextra_parts.common import base_params
    from flatlib import const as fconst
    params = base_params(data)
    body_name = str(params.get('body', 'Saturn'))
    count = max(1, min(12, _int_arg(params, 'count', 3)))
    perchart = PerChart(params)
    chart = perchart.getChart()
    flags = getattr(chart, 'flags', swisseph.FLG_SWIEPH | swisseph.FLG_SPEED) | swisseph.FLG_SPEED
    if body_name == 'Node':
        node_true = (params.get('westNodeType', 'mean') == 'true' or params.get('guolaoNodeType', 'mean') == 'true')
        body = swisseph.TRUE_NODE if node_true else swisseph.MEAN_NODE
    else:
        body = _SWE_PLANET_BY_NAME.get(body_name, swisseph.SATURN)
    zone = params.get('zone', '+00:00')
    natal_jd = perchart.dateTime.jd

    def calc(jd_):
        with chart._siderealContext():
            r = swisseph.calc_ut(jd_, body, flags)[0]
        return float(r[0]) % 360.0, float(r[3])

    natal_lon, _natal_speed = calc(natal_jd)
    span = _RETURN_SPAN_DAYS.get(body, 4332.59)
    step = _RETURN_STEP_DAYS.get(body, 2.0)
    end_jd = natal_jd + (count + 0.6) * span
    # 采样 + 黄经展开(相邻步长内位移恒 < 180°)
    samples = []
    jd, prev_lon, unwrapped = natal_jd, None, None
    while True:
        try:
            lon, spd = calc(jd)
        except Exception:   # 超出星历范围:算到这里为止,后面的回标 found=False
            break
        if prev_lon is None:
            unwrapped = lon
        else:
            unwrapped += ((lon - prev_lon + 180.0) % 360.0) - 180.0
        samples.append((jd, unwrapped, spd))
        prev_lon = lon
        if jd >= end_jd:
            break
        jd = min(end_jd, jd + step)

    def unwrapped_at(jd_, ref_jd, ref_unw):
        lon, _ = calc(jd_)
        return ref_unw + ((lon - (ref_unw % 360.0) + 180.0) % 360.0) - 180.0

    # 单调段端点:采样点 + 速度变号处二分出的留点
    knots = [samples[0]]
    for (j0, u0, s0), (j1, u1, s1) in zip(samples, samples[1:]):
        if (s0 < 0) != (s1 < 0):
            lo, hi = j0, j1
            for _ in range(60):
                mid = (lo + hi) / 2.0
                if (calc(mid)[1] < 0) == (s0 < 0):
                    lo = mid
                else:
                    hi = mid
            js = (lo + hi) / 2.0
            knots.append((js, unwrapped_at(js, j0, u0), 0.0))
        knots.append((j1, u1, s1))
    # 圈数方向按平均运动(行星顺行、交点逆行),不按本命瞬时速度:本命正逆行时同样是往后数圈
    direction = -1.0 if body in (swisseph.TRUE_NODE, swisseph.MEAN_NODE) else 1.0
    passes_by_k = {}
    for (j0, u0, _s0), (j1, u1, _s1) in zip(knots, knots[1:]):
        lo_u, hi_u = min(u0, u1), max(u0, u1)
        k_lo = int((lo_u - natal_lon) // 360.0)
        for k in range(k_lo, k_lo + 3):
            target = natal_lon + 360.0 * k
            if not (lo_u < target <= hi_u) or k == 0:
                continue
            a, b = j0, j1
            for _ in range(60):
                mid = (a + b) / 2.0
                um = unwrapped_at(mid, j0, u0)
                if (um < target) == (u0 < target):
                    a = mid
                else:
                    b = mid
            jc = (a + b) / 2.0
            passes_by_k.setdefault(int(round(k * direction)), []).append(jc)
    results = []
    for which in range(1, count + 1):
        ps = sorted(passes_by_k.get(which, []))
        if not ps:
            results.append({'which': which, 'found': False})
            continue
        det = date_time_from_jd(ps[0], zone)
        det['which'] = which
        det['jd'] = round(ps[0], 4)
        det['found'] = True
        passes = []
        for i, cj in enumerate(ps):
            p = date_time_from_jd(cj, zone)
            p['jd'] = round(cj, 4)
            p['pass'] = i + 1
            p['retrograde'] = bool(calc(cj)[1] < 0)
            passes.append(p)
        det['passes'] = passes
        results.append(det)
    return {'returns': results, 'natalLon': round(natal_lon, 3), 'body': body_name}
