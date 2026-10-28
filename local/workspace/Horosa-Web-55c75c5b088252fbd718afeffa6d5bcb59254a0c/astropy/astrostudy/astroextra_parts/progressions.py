"""推运与衍生盘一族:次限 / 赤纬推运 / 返照时间线 / 谐波盘 / 迁移盘 / 产前朔望盘 / 龙头盘(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
import traceback
import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from astrostudy.perchart import PerChart, parse_terms_variant, push_classical_request, pop_classical_request
from astrostudy.perpredict import dateSolarReturn, dateLunarReturn
from astrostudy.thirteenthchart import HarmonicChart, DraconicChart
from astrostudy.astroextra_parts.common import (
    PLANET_SWISS_IDS, DEFAULT_EVENT_PLANETS, norm360, norm180, angle_distance, safe_float, geo_to_degree, base_params,
    dt_from_data, date_time_from_jd, chart_params_from_jd, swe_lon, sign_name_from_lon, object_to_dict, chart_points,
)
from astrostudy.astroextra_parts.ephemeris import refine_crossing, moon_sun_elongation
from astrostudy.civil_calendar import astro_year, display_year, format_civil_date, parse_civil_date


def progression_date(base_dt, target_dt, method, minor_variant='synodic'):
    # 次要推运(minor)月长算法由前端「月长算法」选择(minorVariant)驱动:
    #   synodic  = 一个朔望月(29.530589d)对应一年(权威标准「a lunar month for a year」;起为缺省);
    #   sidereal = 一个月亮回归(恒星月 27.321661d)对应一年;
    #   engine   = 引擎历史取值(漏乘一次 /365.2425 → 推运天数仅应有值的 1/365,≈无推进),仅作可选档保留,不再缺省。
    age_days = target_dt.jd - base_dt.jd
    if method == 'secondary':
        delta_days = age_days / 365.2425
    elif method == 'tertiary':
        delta_days = age_days / 27.321661
    elif method == 'minor':
        if minor_variant == 'synodic':
            delta_days = age_days * 29.530589 / 365.2425
        elif minor_variant == 'sidereal':
            delta_days = age_days * 27.321661 / 365.2425
        elif minor_variant == 'engine':  # 历史值(≈无推进),显式选档才走
            delta_days = age_days / 12.3685 / 365.2425
        else:  # 未知档 → 标准朔望月
            delta_days = age_days * 29.530589 / 365.2425
    else:
        delta_days = age_days / 365.2425
    return base_dt.jd + delta_days


def aspects_between(points_a, points_b, asp_list=None, orb=1.5):
    asp_list = asp_list or [0, 60, 90, 120, 180]
    rows = []
    for pa in points_a:
        if pa['id'] not in DEFAULT_EVENT_PLANETS and pa['id'] not in (const.ASC, const.MC):
            continue
        for pb in points_b:
            if pb['id'] not in DEFAULT_EVENT_PLANETS and pb['id'] not in (const.ASC, const.MC):
                continue
            for asp in asp_list:
                delta = abs(angle_distance(pa['lon'], pb['lon']) - float(asp))
                if delta <= orb:
                    rows.append({'a': pa['id'], 'b': pb['id'], 'aspect': asp, 'orb': delta})
    return sorted(rows, key=lambda item: item['orb'])


def build_progressions(data):
    params = base_params(data)
    target_date = data.get('targetDate') or data.get('datetime') or data.get('date')
    target_time = data.get('targetTime') or '12:00:00'
    if ' ' in target_date:
        date_part, time_part = target_date.split(' ', 1)
        target_date = date_part
        target_time = time_part
    natal_dt = dt_from_data(params)
    target_dt = Datetime(target_date, target_time, params.get('zone', '+00:00'))
    natal_chart = PerChart(params)
    natal_points = chart_points(natal_chart, include_angles=True)
    minor_variant = data.get('minorVariant') or 'synodic'
    methods = []
    for method, label in (
        ('secondary', 'Secondary Progression'),
        ('tertiary', 'Tertiary Progression'),
        ('minor', 'Minor Progression'),
    ):
        jd = progression_date(natal_dt, target_dt, method, minor_variant)
        p_params = chart_params_from_jd(params, jd)
        p_chart = PerChart(p_params)
        p_points = chart_points(p_chart, include_angles=True)
        methods.append({
            'method': method,
            'label': label,
            'progressedDate': date_time_from_jd(jd, params.get('zone', '+00:00')),
            'positions': p_points,
            'aspectsToNatal': aspects_between(p_points, natal_points, data.get('aspects') or [0, 60, 90, 120, 180], safe_float(data.get('orb', 1.5), 1.5)),
        })
    return {
        'target': date_time_from_jd(target_dt.jd, params.get('zone', '+00:00')),
        'ageDays': target_dt.jd - natal_dt.jd,
        'methods': methods,
    }


# Charles Jayne 赤纬推运（Progressions in Declination）：推运后看赤纬平行/反平行。
DECLINATION_BODIES = [
    const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS,
    const.JUPITER, const.SATURN, const.URANUS, const.NEPTUNE, const.PLUTO,
]


def swe_decl(body, jd):
    xx, _ = swisseph.calc_ut(jd, PLANET_SWISS_IDS[body], swisseph.FLG_SWIEPH | swisseph.FLG_EQUATORIAL)
    return xx[1]


def _decls_at(jd):
    decls = []
    for b in DECLINATION_BODIES:
        try:
            decls.append({'id': b, 'decl': round(swe_decl(b, jd), 4)})
        except Exception:
            pass
    return decls


def decl_parallels(p_decls, n_decls, orb=1.0):
    rows = []
    for pa in p_decls:
        for nb in n_decls:
            d = abs(pa['decl'] - nb['decl'])
            if d <= orb:
                rows.append({'a': pa['id'], 'b': nb['id'], 'type': 'parallel', 'orb': round(d, 3)})
            dc = abs(pa['decl'] + nb['decl'])
            if dc <= orb:
                rows.append({'a': pa['id'], 'b': nb['id'], 'type': 'contraparallel', 'orb': round(dc, 3)})
    return sorted(rows, key=lambda item: item['orb'])


def build_declination_progressions(data):
    params = base_params(data)
    target_date = data.get('targetDate') or data.get('datetime') or data.get('date')
    target_time = data.get('targetTime') or '12:00:00'
    if ' ' in target_date:
        date_part, time_part = target_date.split(' ', 1)
        target_date = date_part
        target_time = time_part
    natal_dt = dt_from_data(params)
    target_dt = Datetime(target_date, target_time, params.get('zone', '+00:00'))
    natal_decls = _decls_at(natal_dt.jd)
    orb = safe_float(data.get('orb', 1.0), 1.0)
    minor_variant = data.get('minorVariant') or 'synodic'
    methods = []
    for method, label in (
        ('secondary', 'Secondary Progression'),
        ('tertiary', 'Tertiary Progression'),
        ('minor', 'Minor Progression'),
    ):
        jd = progression_date(natal_dt, target_dt, method, minor_variant)
        p_decls = _decls_at(jd)
        methods.append({
            'method': method,
            'label': label,
            'progressedDate': date_time_from_jd(jd, params.get('zone', '+00:00')),
            'declinations': p_decls,
            'parallels': decl_parallels(p_decls, natal_decls, orb),
        })
    return {
        'target': date_time_from_jd(target_dt.jd, params.get('zone', '+00:00')),
        'ageDays': target_dt.jd - natal_dt.jd,
        'natalDeclinations': natal_decls,
        'methods': methods,
    }


def build_return_timeline(data):
    params = base_params(data)
    count = max(1, min(int(data.get('count', 10)), 40))
    # 起始年按历史纪年读(公元前带负号或 ad=-1;没有公元 0 年),逐年按天文年递增再转回显示年。
    if data.get('startYear'):
        start_astro = astro_year(int(data.get('startYear')))
    else:
        start_astro = parse_civil_date(data.get('date', '2000/01/01'), data.get('ad', 1))[0]
    perchart = PerChart(params)
    sun = perchart.chart.getObject(const.SUN)
    moon = perchart.chart.getObject(const.MOON)
    rows = []
    for astro_y in range(start_astro, start_astro + count):
        year = display_year(astro_y)
        seed_date = format_civil_date(astro_y, 1, 1, '/')
        solar_seed = Datetime(seed_date, params.get('time', '12:00:00'), params.get('zone', '+00:00'))
        solar_dt = dateSolarReturn(solar_seed, sun.lon, perchart.zodiacal)
        lunar_seed = Datetime(seed_date, params.get('time', '12:00:00'), params.get('zone', '+00:00'))
        lunar_dt = dateLunarReturn(lunar_seed, moon.lon, perchart.zodiacal)
        solar_params = chart_params_from_jd(params, solar_dt.jd)
        lunar_params = chart_params_from_jd(params, lunar_dt.jd)
        try:
            solar_perchart = PerChart(solar_params)
            solar_asc = object_to_dict(solar_perchart.chart.getAngle(const.ASC))
        except Exception:
            solar_asc = None
        try:
            lunar_perchart = PerChart(lunar_params)
            lunar_asc = object_to_dict(lunar_perchart.chart.getAngle(const.ASC))
        except Exception:
            lunar_asc = None
        rows.append({
            'year': year,
            'solarReturn': date_time_from_jd(solar_dt.jd, params.get('zone', '+00:00')),
            'lunarReturn': date_time_from_jd(lunar_dt.jd, params.get('zone', '+00:00')),
            'solarAsc': solar_asc,
            'lunarAsc': lunar_asc,
        })
    return {'rows': rows}


def build_harmonic(data):
    params = base_params(data)
    harmonic = max(1, min(int(data.get('harmonic', 9)), 360))
    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = None
    try:
        _terms_orig = push_classical_request(data)   # 收编复合临界区:旧散 push 丢表体/双子/狮子且只 1/7 族(tv=4 静默回埃及)
        perchart = PerChart(params)
        positions = []
        for p in chart_points(perchart, include_angles=True):
            if p['id'] not in DEFAULT_EVENT_PLANETS and p['id'] not in (const.ASC, const.MC, const.PARS_FORTUNA):
                continue
            lon = norm360(p['lon'] * harmonic)
            positions.append({
                'id': p['id'],
                'natalLon': p['lon'],
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
                'harmonic': harmonic,
            })
        aspects = aspects_between(positions, positions, [0], safe_float(data.get('orb', 2.0), 2.0))
        aspects = [a for a in aspects if a['a'] != a['b']]

        # 调波盘本身：把命盘各点黄经乘以调波数，得到完整盘对象（与 /chart 同形），
        # 供前端复用量化盘的 AstroChart 直接绘制。纯 Python，无需重编 jar。
        chart_obj = None
        try:
            HarmonicChart(perchart, harmonic).apply()
            chart_obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                    'lat': params.get('lat'),
                    'lon': params.get('lon'),
                    'hsys': params.get('hsys'),
                    'zone': params.get('zone'),
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                    'harmonic': harmonic,
                },
                'chart': perchart.getChartObj(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects(),
                },
                'lots': perchart.getPars(perchart.chart),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
            }
        except Exception:
            traceback.print_exc()
            chart_obj = None

        return {'harmonic': harmonic, 'positions': positions, 'conjunctions': aspects[:120], 'chart': chart_obj}
    finally:
        pop_classical_request(_terms_orig)


def build_relocation(data):
    """重置盘(异地 relocation):保留出生 UT(date/time/zone 不变),仅用新经纬重算十二宫 + 上升/中天。
    行星黄经由 UT 决定 → 不变;宫位/角点随地点变。复用 PerChart 宫位计算管线,不另写星历调用。
    返回 {chart, relocLat, relocLon}(chart 与 /chart 同形,供前端 AstroChart 直接绘制)。"""
    base = base_params(data)
    natal_lat = base.get('lat')
    natal_lon = base.get('lon')
    reloc_lat = data.get('relocLat') or data.get('reloc_lat') or natal_lat
    reloc_lon = data.get('relocLon') or data.get('reloc_lon') or natal_lon

    params = dict(base)
    params['lat'] = reloc_lat
    params['lon'] = reloc_lon
    params['tradition'] = False
    params['predictive'] = False

    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = push_classical_request(data)   # 收编复合临界区:旧散 push 丢表体/双子/狮子且只 1/7 族(tv=4 静默回埃及)
    chart_obj = None
    try:
        perchart = PerChart(params)
        chart_obj = {
            'params': {
                'birth': perchart.getBirthStr(),
                'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                'lat': reloc_lat,
                'lon': reloc_lon,
                'hsys': params.get('hsys'),
                'zone': params.get('zone'),
                'tradition': perchart.tradition,
                'zodiacal': perchart.zodiacal,
                'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                'relocation': True,
                'natalLat': natal_lat,
                'natalLon': natal_lon,
            },
            'chart': perchart.getChartObj(),
            'aspects': {
                'normalAsp': perchart.getAspects(),
                'immediateAsp': perchart.getImmediateAspects(),
                'signAsp': perchart.getSignAspects(),
            },
            'lots': perchart.getPars(perchart.chart),
            'receptions': perchart.getReceptions(),
            'mutuals': perchart.getMutuals(),
            'declParallel': perchart.getParallel(),
        }
    except Exception:
        traceback.print_exc()
        chart_obj = None
    finally:
        pop_classical_request(_terms_orig)

    return {'chart': chart_obj, 'relocLat': reloc_lat, 'relocLon': reloc_lon, 'natalLat': natal_lat, 'natalLon': natal_lon}


def compute_prenatal_syzygy(data):
    """ G11 产前朔望:自出生时刻回溯,求最近的朔(日月合,elongation=0°)与望(日月冲,elongation=180°),
        取更晚(更接近出生)者为产前朔望。取度:朔→合相黄经;望→望时地平之上发光体黄经(无则取月)。
        params: date/time/zone/lat/lon。返回 {type, jd, datetime, date, time, sunLon, moonLon,
        daysBeforeBirth, hylegDegree, hylegBody, hylegSign, hylegSignlon}。 """
    date = data.get('date')
    time = data.get('time', '12:00:00')
    zone = data.get('zone', '+00:00')
    birth_jd = Datetime(date, time, zone).jd

    def find_back(target):
        # 自出生时刻起以 0.5 天步长向前(过去)扫,找 elongation 过 target 的最近一次,二分细化。
        # norm180 在 ±180 处回绕,真交叉 step~6°/12h、回绕 step≈360° → abs(cur-prev)<180 排除伪交叉。
        jd = birth_jd
        prev = norm180(moon_sun_elongation(jd) - target)
        # 步进 35 天足够覆盖一个朔望月(~29.53d);找不到则返回 None。
        steps = int(35.0 / 0.5) + 1
        for _ in range(steps):
            nxt = jd - 0.5
            cur = norm180(moon_sun_elongation(nxt) - target)
            if ((prev <= 0 <= cur) or (prev >= 0 >= cur)) and abs(cur - prev) < 180:
                def f(x):
                    return norm180(moon_sun_elongation(x) - target)
                return refine_crossing(f, nxt, jd)
            prev = cur
            jd = nxt
        return None

    new_jd = find_back(0.0)
    full_jd = find_back(180.0)
    # 取更晚(更大 jd、更接近出生)者;缺一取另一。
    if new_jd is None and full_jd is None:
        return {'type': None}
    if full_jd is None or (new_jd is not None and new_jd >= full_jd):
        syz_jd, syz_type = new_jd, 'new'
    else:
        syz_jd, syz_type = full_jd, 'full'

    sun_lon, _, _ = swe_lon(const.SUN, syz_jd)
    moon_lon, _, _ = swe_lon(const.MOON, syz_jd)

    # 取度:朔→合相黄经(日月同度,取日);望→望时地平之上的发光体黄经。
    if syz_type == 'new':
        hyleg_body = const.SUN
        hyleg_degree = sun_lon
    else:
        lat = geo_to_degree(data.get('lat', '0n00'), 'n', 's')
        lon = geo_to_degree(data.get('lon', '0e00'), 'e', 'w')
        # 望时日月对冲,判哪一发光体在地平之上(用赤道坐标 + MC 赤经 + 纬度)。
        hyleg_body = const.MOON
        hyleg_degree = moon_lon
        try:
            from flatlib import utils as _flutils
            # swisseph houses 取 MC 黄经(ascmc[1]);Placidus 仅用其 MC,与宫制无关。
            _cusps, ascmc = swisseph.houses(syz_jd, lat, lon, b'P')
            mc_lon = ascmc[1]
            mc_ra, _mc_decl = _flutils.eqCoords(mc_lon, 0.0)
            sun_ra, sun_decl = _flutils.eqCoords(sun_lon, 0.0)
            moon_ra, moon_decl = _flutils.eqCoords(moon_lon, 0.0)
            sun_above = _flutils.isAboveHorizon(sun_ra, sun_decl, mc_ra, lat)
            moon_above = _flutils.isAboveHorizon(moon_ra, moon_decl, mc_ra, lat)
            if sun_above and not moon_above:
                hyleg_body, hyleg_degree = const.SUN, sun_lon
            elif moon_above and not sun_above:
                hyleg_body, hyleg_degree = const.MOON, moon_lon
            else:
                # 两者同侧(罕见,贴地平):取地平之上者;都在下则取月(发光体默认)。
                hyleg_body = const.SUN if sun_above else const.MOON
                hyleg_degree = sun_lon if sun_above else moon_lon
        except Exception:
            hyleg_body, hyleg_degree = const.MOON, moon_lon

    det = date_time_from_jd(syz_jd, zone)
    return {
        'type': syz_type,
        'jd': round(syz_jd, 5),
        'datetime': det['datetime'],
        'date': det['date'],
        'time': det['time'],
        'sunLon': round(sun_lon, 4),
        'moonLon': round(moon_lon, 4),
        'daysBeforeBirth': round(birth_jd - syz_jd, 3),
        'hylegBody': hyleg_body,
        'hylegDegree': round(hyleg_degree, 4),
        'hylegSign': sign_name_from_lon(hyleg_degree),
        'hylegSignlon': round(hyleg_degree % 30.0, 4),
    }


def build_draconic(data):
    params = base_params(data)
    # 界系(termsVariant)请求级临界区:push 取锁+换 essential.TERMS,finally 必还原+释放锁。默认埃及=零回归。
    _terms_orig = None
    try:
        _terms_orig = push_classical_request(data)   # 收编复合临界区:旧散 push 丢表体/双子/狮子且只 1/7 族(tv=4 静默回埃及)
        perchart = PerChart(params)
        node = perchart.chart.getObject(const.NORTH_NODE)
        node_lon = norm360(node.lon)
        positions = []
        for p in chart_points(perchart, include_angles=True):
            if p['id'] not in DEFAULT_EVENT_PLANETS and p['id'] not in (const.ASC, const.MC, const.PARS_FORTUNA):
                continue
            lon = norm360(p['lon'] - node_lon)
            positions.append({
                'id': p['id'],
                'natalLon': p['lon'],
                'lon': lon,
                'sign': sign_name_from_lon(lon),
                'signlon': lon % 30,
            })
        aspects = aspects_between(positions, positions, [0], safe_float(data.get('orb', 2.0), 2.0))
        aspects = [a for a in aspects if a['a'] != a['b']]

        # 龙盘本身：把命盘各点黄经减去北交点黄经，得到完整盘对象（与 /chart 同形），
        # 供前端复用量化盘的 AstroChart 直接绘制。纯 Python，无需重编 jar 的计算逻辑。
        chart_obj = None
        try:
            DraconicChart(perchart).apply()
            chart_obj = {
                'params': {
                    'birth': perchart.getBirthStr(),
                    'ad': -1 if getattr(perchart, 'isBC', False) else 1,
                    'lat': params.get('lat'),
                    'lon': params.get('lon'),
                    'hsys': params.get('hsys'),
                    'zone': params.get('zone'),
                    'tradition': perchart.tradition,
                    'zodiacal': perchart.zodiacal,
                    'termsVariant': parse_terms_variant(data.get('termsVariant', 0)),
                },
                'chart': perchart.getChartObj(),
                'aspects': {
                    'normalAsp': perchart.getAspects(),
                    'immediateAsp': perchart.getImmediateAspects(),
                    'signAsp': perchart.getSignAspects(),
                },
                'lots': perchart.getPars(perchart.chart),
                'receptions': perchart.getReceptions(),
                'mutuals': perchart.getMutuals(),
                'declParallel': perchart.getParallel(),
            }
        except Exception:
            traceback.print_exc()
            chart_obj = None

        return {'nodeLon': node_lon, 'positions': positions, 'conjunctions': aspects[:120], 'chart': chart_obj}
    finally:
        pop_classical_request(_terms_orig)
