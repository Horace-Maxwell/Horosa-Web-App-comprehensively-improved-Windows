"""/astroextra/analysis 里的时与历:行星时 / 巴比伦距星 / 埃及历(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
import math
import swisseph
from flatlib import const
from flatlib.datetime import Datetime
from flatlib.dignities import essential
from astrostudy.astroextra_parts.common import (
    PLANET_SWISS_IDS, angle_distance, safe_float, zone_value, geo_to_degree, date_time_from_jd, chart_points,
)
from astrostudy.civil_calendar import civil_julday, display_year, parse_civil_date


# WI-18 行星时(不等时):昼弧/夜弧各12等分;首时主星=值日星(按日出civil星期),
# 其后逐时按迦勒底降序轮替;标出生所在时段。
_DAY_RULER_BY_DOW = {  # swisseph.day_of_week:0=周一..6=周日
    0: const.MOON, 1: const.MARS, 2: const.MERCURY, 3: const.JUPITER,
    4: const.VENUS, 5: const.SATURN, 6: const.SUN,
}
_CHALDEAN_DESC = [const.SATURN, const.JUPITER, const.MARS, const.SUN, const.VENUS, const.MERCURY, const.MOON]


def compute_planetary_hours(params):
    geopos = [
        geo_to_degree(params.get('lon', '0e00'), 'e', 'w'),
        geo_to_degree(params.get('lat', '0n00'), 'n', 's'),
        safe_float(params.get('altitude', 0.0), 0.0),
    ]
    zone = params.get('zone', '+00:00')
    try:
        birth = Datetime(params.get('date'), params.get('time', '12:00:00'), zone).jd
    except Exception:
        return None

    def nxt(jd, flag):
        _ret, tret = swisseph.rise_trans(jd, PLANET_SWISS_IDS[const.SUN], flag, geopos, 0.0, 0.0, swisseph.FLG_SWIEPH)
        if _ret < 0:   # -2 极区无升降 / -1 错误:不可静默取 tret[0]=0(否则昼夜弧塌缩成伪时段)→ 抛出由外层 except 兜成 None
            raise ValueError('no rise/set (circumpolar or error)')
        return tret[0]

    try:
        anchor = math.floor(birth - 0.5) + 0.5 - 1.0
        sr0 = nxt(anchor, swisseph.CALC_RISE)
        ss0 = nxt(sr0, swisseph.CALC_SET)
        sr1 = nxt(ss0, swisseph.CALC_RISE)
        ss1 = nxt(sr1, swisseph.CALC_SET)
        sr2 = nxt(ss1, swisseph.CALC_RISE)
    except Exception:
        return None  # 极区无升降等

    if sr1 <= birth < sr2:
        sr, ss, srn = sr1, ss1, sr2
    else:
        sr, ss, srn = sr0, ss0, sr1

    dow = swisseph.day_of_week(sr + zone_value(zone) / 24.0)
    day_ruler = _DAY_RULER_BY_DOW.get(dow, const.SUN)
    start_idx = _CHALDEAN_DESC.index(day_ruler)
    # 行星时制式三档(与 perchart.getTimerStar 同语义,修双实现分裂:此前本表恒
    # 昼夜不等时排法,而「时主星」按 sunrise 等长口径——同屏两口径互相矛盾):
    #   'sunrise'(键默认) = 日出起算·等长 60 分钟小时 ×24;
    #   'unequal'         = 真日出→日没 12 等分昼时 + 日没→次日出 12 等分夜时(本表旧排法);
    #   'equal24'         = 当地当日 0 时起 24 等分,时主序仍迦勒底降序从当日日主起。
    hour_mode = params.get('planetaryHourMethod') or 'sunrise'
    hours = []
    if hour_mode == 'equal24':
        local_midnight = math.floor(birth + zone_value(zone) / 24.0 - 0.5) + 0.5 - zone_value(zone) / 24.0
        dow0 = swisseph.day_of_week(local_midnight + 0.5 + zone_value(zone) / 24.0)
        ruler0 = _DAY_RULER_BY_DOW.get(dow0, const.SUN)
        idx0 = _CHALDEAN_DESC.index(ruler0)
        day_ruler = ruler0
        # 本表跨「出生民用日 00:00-24:00」,而外层 sr/ss 是「覆盖出生时刻的日出周期」
        # (凌晨生=前一日的日出日没)——凌晨盘用它判当日整点恒 diurnal=False。此处单独求
        # 当日日出日没(自当日 0 时起算),失败(极区)回落外层值,回显 sunrise/sunset 同步换。
        try:
            sr_d = nxt(local_midnight, swisseph.CALC_RISE)
            ss_d = nxt(sr_d, swisseph.CALC_SET)
        except Exception:
            sr_d, ss_d = sr, ss
        sr, ss = sr_d, ss_d
        for i in range(24):
            t0 = local_midnight + i / 24.0
            t1 = local_midnight + (i + 1) / 24.0
            hours.append({
                'index': i + 1,
                'ruler': _CHALDEAN_DESC[(idx0 + i) % 7],
                'diurnal': bool(sr <= t0 < ss),
                'start': date_time_from_jd(t0, zone)['time'],
                'end': date_time_from_jd(t1, zone)['time'],
                'current': bool(t0 <= birth < t1),
            })
    elif hour_mode == 'unequal':
        day_h = (ss - sr) / 12.0
        night_h = (srn - ss) / 12.0
        for i in range(24):
            if i < 12:
                t0, t1, diurnal = sr + day_h * i, sr + day_h * (i + 1), True
            else:
                j = i - 12
                t0, t1, diurnal = ss + night_h * j, ss + night_h * (j + 1), False
            hours.append({
                'index': i + 1,
                'ruler': _CHALDEAN_DESC[(start_idx + i) % 7],
                'diurnal': diurnal,
                'start': date_time_from_jd(t0, zone)['time'],
                'end': date_time_from_jd(t1, zone)['time'],
                'current': bool(t0 <= birth < t1),
            })
    else:   # 'sunrise' 默认:日出起算等长 60 分钟小时(与时主星口径一致)
        for i in range(24):
            t0 = sr + i / 24.0
            t1 = sr + (i + 1) / 24.0
            if i == 23 and srn > t1:
                # 行星日实长=sr→srn≠24h:秋季高纬日出逐日推迟时 srn>sr+24h,
                # 生于 [sr+24h, srn) 的盘 24 行皆无 current——末行右边界放宽到次日出。
                t1 = srn
            hours.append({
                'index': i + 1,
                'ruler': _CHALDEAN_DESC[(start_idx + i) % 7],
                'diurnal': bool(t0 < ss),
                'start': date_time_from_jd(t0, zone)['time'],
                'end': date_time_from_jd(t1, zone)['time'],
                'current': bool(t0 <= birth < t1),
            })
    return {
        'dayRuler': day_ruler,
        'hourMode': hour_mode,
        'sunrise': date_time_from_jd(sr, zone)['time'],
        'sunset': date_time_from_jd(ss, zone)['time'],
        'nextSunrise': date_time_from_jd(srn, zone)['time'],
        'hours': hours,
    }


# 巴比伦「计数之星」(距星)定名表:30 颗唯一星(楔文文献沿黄道参照星;蟹后南星与蟹前南星同标一星故不重列)。
# (swisseph 星名, 中文距星义, 现代星名)
_BABYLON_NORMAL_STARS = (
    ('Sheratan', '雇工头之前星', 'β Ari'), ('Hamal', '雇工头之后星', 'α Ari'),
    ('Alcyone', '星团', 'η Tau'), ('Aldebaran', '牛颚', 'α Tau'),
    ('Elnath', '战车北星', 'β Tau'), (',zeTau', '战车南星', 'ζ Tau'),
    ('Propus', '前双子', 'η Gem'), ('Alhena', '后双子', 'γ Gem'),
    ('Castor', '中双子', 'α Gem'), ('Pollux', '后双子星', 'β Gem'),
    (',gaCnc', '蟹前北星', 'γ Cnc'), (',deCnc', '蟹前南星', 'δ Cnc'),
    (',kaLeo', '狮头', 'κ Leo'), ('Regulus', '王星', 'α Leo'),
    (',rhLeo', '王后小星', 'ρ Leo'), (',thLeo', '狮心', 'θ Leo'),
    ('Denebola', '狮尾', 'β Leo'), ('Zavijava', '犁沟前星', 'β Vir'),
    ('Porrima', '犁沟前亮星', 'γ Vir'), ('Spica', '犁沟', 'α Vir'),
    ('Zuben Elgenubi', '南秤', 'α Lib'), ('Zuben Eschamali', '北秤', 'β Lib'),
    ('Dschubba', '蝎头上星', 'δ Sco'), ('Acrab', '蝎头中星', 'β Sco'),
    ('Antares', '蝎胸亮星', 'α Sco'), (',thOph', '山羊鱼角', 'θ Oph'),
    ('Dabih', '山羊鱼前星', 'β Cap'), ('Nashira', '山羊鱼后星', 'γ Cap'),
    ('Deneb Algedi', '山羊鱼尾', 'δ Cap'), (',etPsc', '鱼带亮星', 'η Psc'),
)

_BABYLON_CUBIT_DEG = 2.2   # 统计最佳值(古代规范 2°–2.5°);1 cubit = 24 finger


def _babylon_star_positions(perchart):
    """30 颗距星在本盘同框架(回归/恒星随盘)下的 (lon, lat);swisseph fixstar2_ut 直算。"""
    jd = perchart.dateTime.jd
    flag = swisseph.FLG_SWIEPH
    if getattr(perchart, 'zodiacal', None) == const.SIDEREAL:
        flag |= swisseph.FLG_SIDEREAL   # 盘链路刚 set_sid_mode,同全局模式
    out = []
    for (swname, cn, modern) in _BABYLON_NORMAL_STARS:
        try:
            (xx, retnm, _rf) = swisseph.fixstar2_ut(swname, jd, flag)
            out.append({'cn': cn, 'modern': modern, 'lon': xx[0] % 360.0, 'lat': xx[1]})
        except Exception:
            continue
    return out


def compute_babylonian_stars(perchart):
    """WI-27 参照星定位(巴比伦式,定名距星表):每七政最近的「计数之星」(30 颗楔文距星)+
    黄经距(<1°标合)+ 楔文式方位读法「在某星 上/下·前/后 X cubit Y finger」(1 cubit≈2.2°=24 finger)。"""
    stars = _babylon_star_positions(perchart)
    if not stars:
        return []
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    out = []
    for pid in seven:
        if pid not in pts:
            continue
        plon = pts[pid]['lon']
        plat = safe_float(pts[pid].get('lat', 0.0))
        best, bestd = None, 999.0
        for s in stars:
            d = angle_distance(s['lon'], plon)
            if d < bestd:
                bestd, best = d, s
        if best is None:
            continue
        # 楔文读法:黄纬差 → 上/下;黄经差(带向) → 前(黄经较小侧)/后
        lat_diff = plat - best['lat']
        lon_signed = ((plon - best['lon'] + 540.0) % 360.0) - 180.0
        total_cubits = bestd / _BABYLON_CUBIT_DEG
        cubits = int(total_cubits)
        fingers = int(round((total_cubits - cubits) * 24))
        if fingers == 24:
            cubits, fingers = cubits + 1, 0
        out.append({
            'planet': pid,
            'star': best['modern'],
            'cn': best['cn'],
            'dist': round(bestd, 2),
            'conj': bool(bestd < 1.0),
            'latDir': ('上' if lat_diff >= 0 else '下'),
            'lonDir': ('后' if lon_signed >= 0 else '前'),
            'latDiff': round(abs(lat_diff), 2),
            'lonDiff': round(abs(lon_signed), 2),
            'cubits': cubits,
            'fingers': fingers,
        })
    return out


def compute_egyptian_calendar(perchart, params):
    """WI-28 埃及历法:天狼偕日升(Sothic/wepet-renpet 埃及岁首标志,出生年) + 上升十分宫(36 旬·夜时主,迦勒底面主)。
    天狼升较贵故仅在格局分析按需算(非每次排盘)。"""
    out = {}
    try:
        geopos = [
            geo_to_degree(params.get('lon', '0e00'), 'e', 'w'),
            geo_to_degree(params.get('lat', '0n00'), 'n', 's'),
            safe_float(params.get('altitude', 0.0), 0.0),
        ]
        atmo = [1013.25, 15.0, 40.0, 0.25]
        observer = [36.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        flag = swisseph.FLG_SWIEPH | swisseph.HELFLAG_HIGH_PRECISION
        date = str(params.get('date', ''))
        # 出生年按历史纪年读(负号或 ad=-1 = 公元前),当年元旦按民用历(1582 以前儒略历)取儒略日。
        astro_y = parse_civil_date(date, params.get('ad', 1))[0]
        year = display_year(astro_y)
        jd0 = civil_julday(astro_y, 1, 1, 0.0)
        tret = swisseph.heliacal_ut(jd0, geopos, atmo, observer, 'Sirius', swisseph.HELIACAL_RISING, flag)
        sj = tret[0] if isinstance(tret, (list, tuple)) else tret
        rising = date_time_from_jd(sj, params.get('zone', '+00:00'))['date']
        out['siriusRising'] = rising
        # 高纬度该年天狼或不可见,heliacal_ut 顺推至次年 → siriusYear 取实际升起年(日期前4位),勿与 siriusRising 矛盾。
        out['siriusYear'] = display_year(parse_civil_date(rising)[0])
    except Exception:
        out['siriusRising'] = None
    try:
        asc = perchart.chart.getAngle(const.ASC)
        d = int(asc.lon // 10.0) % 36
        out['decanIndex'] = d + 1
        out['decanSign'] = asc.sign
        out['decanRuler'] = essential.getInfo(asc.sign, asc.signlon).get('face')
    except Exception:
        pass
    return out
