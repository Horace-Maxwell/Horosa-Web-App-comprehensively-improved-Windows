# astrostudy/agepoint.py
# Huber 年龄推进点（Age Point）：年龄点自上升点起，沿 12 个 Koch 宫顺行，每宫 6 年、72 年一周，
# 宫内按黄道跨度线性插值。报每岁 AP 落座/落宫 + 与本命星合相(orb 1°)。
import swisseph
from flatlib import const

PLANET_POINTS = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]


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


def crossings_of(kc, natal, max_age=72):
    """[Q-184/T-103] 关键岁数(合本命)连续解:年龄点在每宫内按黄道跨度线性插值,对每颗本命星求其被穿越的精确岁数
    (age = 6·宫序 + 6·宫内弧比),72 年一周后按周期外推至 max_age。此前只在整岁取点、±1° 判合 → 穿越时刻不在整岁
    邻域即漏报(种子盘报 3 次实际 7 次)。返回按岁数升序的 [{age, aspectTo, apLon}]。"""
    out = []
    for houseIdx in range(12):
        startCusp = kc[houseIdx]
        endCusp = kc[(houseIdx + 1) % 12]
        span = _norm360(endCusp - startCusp)
        if span <= 0.0:
            continue
        for pid, plon in natal.items():
            rel = _norm360(plon - startCusp)
            if rel >= span:
                continue
            base_age = houseIdx * 6 + 6.0 * rel / span
            k = 0
            while True:
                age = base_age + 72 * k
                if age > max_age:
                    break
                out.append({'age': round(age, 2), 'aspectTo': pid, 'apLon': round(_norm360(plon), 2)})
                k += 1
    out.sort(key=lambda c: (c['age'], c['aspectTo']))
    return out


def compute(perchart, max_age=72):
    chart = perchart.getChart()
    jd = chart.date.jd
    asc, kc = _koch_cusps(jd, perchart.pos.lat, perchart.pos.lon)
    # [Q-361/T-342] 恒星黄道盘:houses_ex2 出的 Koch 宫头恒为回归黄经,而本命星取自 PerChart(恒星黄经)→ 两组经度相差岁差值
    # 互比,合本命岁数与落座全部失真。以盘上升点(与盘同黄道)对回归上升点之差作偏移,把宫头/上升点/年龄点整体换到盘黄道;
    # 回归盘偏移≈0(仅浮点噪声),结果逐字同旧。
    try:
        asc_chart = chart.getAngle(const.ASC)
        offset = _norm360(asc - float(asc_chart.lon)) if asc_chart is not None else 0.0
    except Exception:
        offset = 0.0
    if offset > 180.0:
        offset -= 360.0
    if abs(offset) > 1e-6:
        asc = _norm360(asc - offset)
        kc = [_norm360(c - offset) for c in kc]

    natal = {}
    for pid in PLANET_POINTS:
        try:
            o = chart.getObject(pid)
            if o is not None:
                natal[pid] = o.lon
        except Exception:
            pass

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
            'apLon': round(apLon, 2),
            'sign': const.LIST_SIGNS[int(apLon / 30) % 12],
            'signlon': round(apLon % 30, 2),
            'house': houseIdx + 1,
            'aspectTo': None,
            'aspect': None,
            'cuspCrossing': frac == 0.0,        # 进入新宫的整岁
        })
    # [Q-184/T-103] 合本命按连续穿越解标到所在整岁行(aspectAge=精确岁数;同一岁多颗 → aspects 列表,aspectTo 取首颗)
    crossings = crossings_of(kc, natal, max_age)
    for c in crossings:
        idx = int(c['age'])
        if idx < 0 or idx >= len(points):
            continue
        row = points[idx]
        row.setdefault('aspects', []).append({'aspectTo': c['aspectTo'], 'aspectAge': c['age']})
        if not row['aspectTo']:
            row['aspectTo'] = c['aspectTo']
            row['aspect'] = '合'
            row['aspectAge'] = c['age']
    return {
        'asc': round(asc, 2),
        'kochCusps': [round(c, 2) for c in kc],
        'maxAge': max_age,
        'points': points,
        'crossings': crossings,
    }
