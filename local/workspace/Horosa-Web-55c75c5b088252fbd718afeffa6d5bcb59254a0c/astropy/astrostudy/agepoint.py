# astrostudy/agepoint.py
# 年龄推进点（Age Point）：年龄点自上升点起逐宫顺行，每宫 6 年、72 年一周，宫内按黄道跨度线性插值。
# 推进方式两档:
#   koch    Koch 宫(原定义):宫越宽走得越快,同一年龄的黄经随宫头而变
#   equal5  等速:自上升起黄经匀速 5°/年(= 以上升为第一宫头的等宫 30°/6 年)
# 事件两档:
#   full    年龄点与本命全部点(日月五星、天王 / 海王 / 冥王、北交、福点、四轴)的合 / 六合 / 四分 / 三分 / 冲,六合四分三分取左右两侧
#   conj    只报合七星
# 年长(年龄 → 日期):回归年 365.2422 日 / 恒星年 365.2564 日。年限 72 / 100 / 120 / 144 岁(72 年后按周期续算)。
import swisseph
from flatlib import const

PLANET_POINTS = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
FULL_POINTS = PLANET_POINTS + [const.URANUS, const.NEPTUNE, const.PLUTO, const.NORTH_NODE, const.PARS_FORTUNA,
                               const.ASC, const.MC, const.DESC, const.IC]
# (相位角, 侧):右 = 点黄经减相位(右旋相位点),左 = 加相位;合 / 冲各只有一点
FULL_ASPECTS = ((0, ''), (60, 'D'), (60, 'S'), (90, 'D'), (90, 'S'), (120, 'D'), (120, 'S'), (180, ''))

METHODS = ('koch', 'equal5')
DEFAULT_METHOD = 'koch'
EVENTS = ('full', 'conj')
DEFAULT_EVENTS = 'full'
YEAR_DAYS = {'tropical': 365.2422, 'sidereal': 365.256363}
DEFAULT_YEAR = 'tropical'
SPANS = (72, 100, 120, 144)
DEFAULT_SPAN = 72
ASPECT_NAME = {0: '合', 60: '六合', 90: '四分', 120: '三分', 180: '冲'}


def normalize(settings):
    s = settings or {}
    try:
        span = int(s.get('apMaxAge'))
    except (TypeError, ValueError):
        span = DEFAULT_SPAN
    return {
        'apMethod': s.get('apMethod') if s.get('apMethod') in METHODS else DEFAULT_METHOD,
        'apEvents': s.get('apEvents') if s.get('apEvents') in EVENTS else DEFAULT_EVENTS,
        'apYear': s.get('apYear') if s.get('apYear') in YEAR_DAYS else DEFAULT_YEAR,
        'apMaxAge': span if span in SPANS else DEFAULT_SPAN,
    }


def _norm360(x):
    return (x % 360 + 360) % 360


def _koch_cusps(jd, lat, lon):
    """ 返回 (asc, [12 个 Koch 宫头黄经 house1..house12])。 """
    try:
        res = swisseph.houses_ex2(jd, float(lat), float(lon), b'K', 0)
    except swisseph.Error:
        # Koch 在极圈无解 → Porphyry 兜底(保四轴),年龄推进点照常可算。
        res = swisseph.houses_ex2(jd, float(lat), float(lon), b'O', 0)
    cusps = list(res[0])
    ascmc = list(res[1])
    if len(cusps) >= 13:
        kc = [float(cusps[i]) for i in range(1, 13)]   # 1-indexed [1..12]
    else:
        kc = [float(cusps[i]) for i in range(0, 12)]   # 0-indexed [0..11]
    asc = float(ascmc[0]) if ascmc else kc[0]
    return asc, kc


def crossings_of_targets(kc, targets, max_age=72):
    """年龄点经过各目标黄经的精确岁数:年龄点在每宫内按黄道跨度线性插值(age = 6·宫序 + 6·宫内弧比),
    72 年一周后按周期外推至 max_age。targets = [{'aspectTo', 'aspect', 'side', 'lon'}];0 岁恰在起点的目标(上升本身)不算事件。
    返回按岁数升序的 [{age, aspectTo, aspect, side, apLon}]。"""
    out = []
    for houseIdx in range(12):
        startCusp = kc[houseIdx]
        endCusp = kc[(houseIdx + 1) % 12]
        span = _norm360(endCusp - startCusp)
        if span <= 0.0:
            continue
        for t in targets:
            rel = _norm360(t['lon'] - startCusp)
            if rel > 360.0 - 1e-9:
                rel = 0.0                  # 恰在宫头(浮点落到宫头前一丝):归本宫起点
            if rel >= span - 1e-9:
                continue                   # 恰在下一宫头:归下一宫(同一事件只记一次)
            base_age = houseIdx * 6 + 6.0 * rel / span
            k = 0
            while True:
                age = base_age + 72 * k
                if age > max_age:
                    break
                if age > 1e-9:
                    out.append({'age': round(age, 2), 'aspectTo': t['aspectTo'], 'aspect': t['aspect'],
                                'side': t['side'], 'apLon': round(_norm360(t['lon']), 2)})
                k += 1
    out.sort(key=lambda c: (c['age'], c['aspectTo'], c['aspect'], c['side']))
    return out


def crossings_of(kc, natal, max_age=72):
    """合本命(只报合)的穿越岁数;natal = {星: 黄经}。"""
    targets = [{'aspectTo': pid, 'aspect': 0, 'side': '', 'lon': lon} for pid, lon in natal.items()]
    return [{'age': c['age'], 'aspectTo': c['aspectTo'], 'apLon': c['apLon']} for c in crossings_of_targets(kc, targets, max_age)]


def event_targets(points, events):
    """事件目标点:conj = 七星本体;full = 全部点 × 合 / 左右六合四分三分 / 冲。"""
    out = []
    for pid, lon in points.items():
        aspects = ((0, ''),) if events == 'conj' else FULL_ASPECTS
        for asp, side in aspects:
            delta = asp if (side == 'S' or asp == 180) else (-asp if side == 'D' else 0.0)
            out.append({'aspectTo': pid, 'aspect': asp, 'side': side, 'lon': _norm360(lon + delta)})
    return out


def compute(perchart, settings=None):
    """settings 缺省取起盘请求里的 apMethod / apEvents / apYear / apMaxAge(未带 = 出厂口径)。"""
    if settings is None:
        settings = perchart.data if isinstance(getattr(perchart, 'data', None), dict) else {}
    st = normalize(settings)
    max_age = st['apMaxAge']
    chart = perchart.getChart()
    jd = chart.date.jd
    asc, kc = _koch_cusps(jd, perchart.pos.lat, perchart.pos.lon)
    # 恒星黄道盘:houses_ex2 出的 Koch 宫头恒为回归黄经,而本命星取自 PerChart(恒星黄经)→ 两组经度相差岁差值
    # 互比,合本命岁数与落座全部失真。以盘上升点(与盘同黄道)对回归上升点之差作偏移,把宫头/上升点/年龄点整体换到盘黄道;
    # 回归盘偏移≈0(仅浮点噪声),结果逐字同旧。
    asc_chart = chart.getAngle(const.ASC)
    offset = _norm360(asc - float(asc_chart.lon)) if asc_chart is not None else 0.0
    if offset > 180.0:
        offset -= 360.0
    if abs(offset) > 1e-6:
        asc = _norm360(asc - offset)
        kc = [_norm360(c - offset) for c in kc]
    if st['apMethod'] == 'equal5':
        kc = [_norm360(asc + 30.0 * i) for i in range(12)]   # 等速 5°/年 = 上升起等宫

    point_ids = PLANET_POINTS if st['apEvents'] == 'conj' else FULL_POINTS
    natal = {pid: float(chart.get(pid).lon) for pid in point_ids}

    from astrostudy.astroextra_parts.common import date_time_from_jd
    zone = getattr(perchart, 'zone', '+00:00')
    year_days = YEAR_DAYS[st['apYear']]

    def date_of(age):
        return date_time_from_jd(jd + float(age) * year_days, zone)['date']

    points = []
    for age in range(0, max_age + 1):
        houseIdx = int(age // 6) % 12          # 0-based house index the AP is in
        frac = (age % 6) / 6.0                 # progress through that house
        startCusp = kc[houseIdx]
        endCusp = kc[(houseIdx + 1) % 12]
        span = _norm360(endCusp - startCusp)
        apLon = _norm360(startCusp + frac * span)
        points.append({
            'age': age,
            'date': date_of(age),
            'apLon': round(apLon, 2),
            'sign': const.LIST_SIGNS[int(apLon / 30) % 12],
            'signlon': round(apLon % 30, 2),
            'house': houseIdx + 1,
            'aspectTo': None,
            'aspect': None,
            'cuspCrossing': frac == 0.0,        # 进入新宫的整岁
        })
    # 事件按连续穿越解标到所在整岁行(aspectAge = 精确岁数;同一岁多个 → aspects 列表,aspectTo 取首个)
    crossings = crossings_of_targets(kc, event_targets(natal, st['apEvents']), max_age)
    for c in crossings:
        c['date'] = date_of(c['age'])
        idx = int(c['age'])
        if idx < 0 or idx >= len(points):
            continue
        row = points[idx]
        row.setdefault('aspects', []).append({'aspectTo': c['aspectTo'], 'aspectAge': c['age'], 'aspectType': c['aspect'], 'side': c['side']})
        if not row['aspectTo']:
            row['aspectTo'] = c['aspectTo']
            row['aspect'] = ASPECT_NAME[c['aspect']]
            row['aspectAge'] = c['age']
    return {
        'asc': round(asc, 2),
        'kochCusps': [round(c, 2) for c in kc],   # 推进所用宫头(等速档 = 上升起等宫)
        'houseSystem': 'Koch' if st['apMethod'] == 'koch' else 'Equal',
        'maxAge': max_age,
        'settings': st,
        'points': points,
        'crossings': crossings,
    }
