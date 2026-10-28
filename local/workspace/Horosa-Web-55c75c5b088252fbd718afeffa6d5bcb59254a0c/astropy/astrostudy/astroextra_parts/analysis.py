"""/astroextra/analysis 一族:格局 / 元素模式分布 / 宫主星表 / 希腊点 / 恒星 / 古典格局 / 偶然尊贵 / 吉凶化 / 相位动态 / 逐题主星 / 汇总分析(由 astroextra.py 整段搬出,astrostudy.astroextra 照旧可取这些名字)。"""
import traceback
from flatlib import const
from flatlib.dignities import essential
from flatlib.protocols.temperament import Temperament
from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request
from astrostudy.astroextra_parts.common import (
    DEFAULT_EVENT_PLANETS, MAJOR_ASPECTS, SIGN_ELEMENTS, SIGN_MODES, HOUSE_SCORES, DIGNITY_SCORES, angle_distance,
    safe_float, to_bool, base_params, sign_name_from_lon, object_to_dict, chart_points, find_aspect,
)
from astrostudy.astroextra_parts.calendars import (
    compute_planetary_hours, compute_babylonian_stars, compute_egyptian_calendar,
)


def detect_patterns(points):
    ids = [p['id'] for p in points if p['id'] in DEFAULT_EVENT_PLANETS or p['id'] in (const.ASC, const.MC)]
    patterns = []
    aspects = {}
    for i, ida in enumerate(ids):
        for idb in ids[i + 1:]:
            for asp in MAJOR_ASPECTS:
                hit = find_aspect(points, ida, idb, asp['angle'], asp['orb'])
                if hit:
                    aspects[(ida, idb, asp['angle'])] = hit
                    aspects[(idb, ida, asp['angle'])] = hit

    def has(a, b, deg):
        return aspects.get((a, b, deg))

    for i, a in enumerate(ids):
        for j, b in enumerate(ids[i + 1:], i + 1):
            for c in ids[j + 1:]:
                if has(a, b, 120) and has(a, c, 120) and has(b, c, 120):
                    patterns.append({'type': 'grand_trine', 'label': 'Grand Trine', 'points': [a, b, c]})
                if has(a, b, 60) and has(a, c, 150) and has(b, c, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [a, b, c], 'apex': c})
                if has(a, c, 60) and has(a, b, 150) and has(c, b, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [a, c, b], 'apex': b})
                if has(b, c, 60) and has(b, a, 150) and has(c, a, 150):
                    patterns.append({'type': 'yod', 'label': 'Yod', 'points': [b, c, a], 'apex': a})
                for apex, left, right in ((a, b, c), (b, a, c), (c, a, b)):
                    if has(left, right, 180) and has(apex, left, 90) and has(apex, right, 90):
                        patterns.append({'type': 't_square', 'label': 'T-Square', 'points': [apex, left, right], 'apex': apex})

    n = len(ids)
    for a in range(n):
        for b in range(a + 1, n):
            for c in range(b + 1, n):
                for d in range(c + 1, n):
                    quad = [ids[a], ids[b], ids[c], ids[d]]
                    opps = 0
                    squares = 0
                    sextiles = 0
                    trines = 0
                    for i in range(4):
                        for j in range(i + 1, 4):
                            opps += 1 if has(quad[i], quad[j], 180) else 0
                            squares += 1 if has(quad[i], quad[j], 90) else 0
                            sextiles += 1 if has(quad[i], quad[j], 60) else 0
                            trines += 1 if has(quad[i], quad[j], 120) else 0
                    if opps >= 2 and squares >= 4:
                        patterns.append({'type': 'grand_cross', 'label': 'Grand Cross', 'points': quad})
                    if opps >= 2 and sextiles >= 2 and trines >= 2:
                        patterns.append({'type': 'mystic_rectangle', 'label': 'Mystic Rectangle', 'points': quad})
                    for tri in ((0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)):
                        rest = next(idx for idx in range(4) if idx not in tri)
                        tri_ids = [quad[idx] for idx in tri]
                        rest_id = quad[rest]
                        if has(tri_ids[0], tri_ids[1], 120) and has(tri_ids[0], tri_ids[2], 120) and has(tri_ids[1], tri_ids[2], 120):
                            if any(has(rest_id, t, 180) for t in tri_ids) and sum(1 for t in tri_ids if has(rest_id, t, 60)) >= 2:
                                patterns.append({'type': 'kite', 'label': 'Kite', 'points': quad, 'tail': rest_id})
                    # Cradle 摇篮:四星链 a-b-c-d 三段连续 60° + 首尾 a-d 180°(半盘弧上的缓冲结构)。
                    # 枚举 quad 的链排列(首尾无序、链向无序 → 12 种有向排列/4=3 种本质链×首尾 2 向,直接全排列去重)。
                    import itertools as _it
                    for perm in _it.permutations(quad):
                        pa, pb, pc, pd = perm
                        if pa > pd:
                            continue   # 链反向等价,半序去重
                        if has(pa, pb, 60) and has(pb, pc, 60) and has(pc, pd, 60) and has(pa, pd, 180):
                            patterns.append({'type': 'cradle', 'label': 'Cradle', 'points': [pa, pb, pc, pd]})
                            break

    # Grand Sextile 大六角:六星按黄经环序相邻皆 60°(两套大三角嵌套的六芒星,极罕见)。
    lon_of = {p['id']: p['lon'] for p in points if p['id'] in ids}
    import itertools as _it6
    for combo in _it6.combinations(ids, 6):
        if any(pid not in lon_of for pid in combo):
            continue
        ring = sorted(combo, key=lambda pid: lon_of[pid])
        ok = True
        for i in range(6):
            if not has(ring[i], ring[(i + 1) % 6], 60):
                ok = False
                break
        if ok:
            patterns.append({'type': 'grand_sextile', 'label': 'Grand Sextile', 'points': list(ring)})

    by_sign = {}
    for p in points:
        if p['id'] in ids:
            by_sign.setdefault(p['sign'], []).append(p['id'])
    for sign, members in by_sign.items():
        if len(members) >= 3:
            patterns.append({'type': 'stellium_sign', 'label': 'Sign Stellium', 'sign': sign, 'points': members})

    sorted_points = sorted([p for p in points if p['id'] in ids], key=lambda item: item['lon'])
    doubled = sorted_points + [{**p, 'lon': p['lon'] + 360} for p in sorted_points]
    seen = set()
    for i in range(len(sorted_points)):
        cluster = [doubled[i]]
        j = i + 1
        while j < i + len(sorted_points) and doubled[j]['lon'] - doubled[i]['lon'] <= 10:
            cluster.append(doubled[j])
            j += 1
        if len(cluster) >= 3:
            key = tuple(sorted(p['id'] for p in cluster))
            if key not in seen:
                seen.add(key)
                patterns.append({'type': 'stellium_orb', 'label': 'Tight Stellium', 'span': cluster[-1]['lon'] - cluster[0]['lon'], 'points': list(key)})

    unique = []
    keys = set()
    for item in patterns:
        key = (item['type'], tuple(sorted(item.get('points', []))), item.get('sign'))
        if key not in keys:
            unique.append(item)
            keys.add(key)
    return unique


def _angle_lon(perchart, angle_id):
    try:
        return perchart.chart.get(angle_id).lon
    except Exception:
        return None


# 分布权重只计七政(日月五星):帮助与格局页「只计七政」如是说,此前按 DEFAULT_EVENT_PLANETS(含天海冥)计 10 体,
# 元素/模式/半球三组总和恒 10。ids 可显式传(择日扫描等另有口径时用),缺省=七政。
DISTRIBUTION_BODIES = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]


def distribution(points, asc_lon=None, mc_lon=None, ids=None):
    allow = set(ids) if ids else set(DISTRIBUTION_BODIES)
    res = {
        'elements': {'Fire': 0, 'Earth': 0, 'Air': 0, 'Water': 0},
        'modes': {'Cardinal': 0, 'Fixed': 0, 'Mutable': 0},
        'hemispheres': {'east': 0, 'west': 0, 'above': 0, 'below': 0},
    }
    for p in points:
        if p['id'] not in allow:
            continue
        sign = p['sign']
        if sign in SIGN_ELEMENTS:
            res['elements'][SIGN_ELEMENTS[sign]] += 1
        if sign in SIGN_MODES:
            res['modes'][SIGN_MODES[sign]] += 1
        lon = p['lon']
        # 半球须按地平/子午轴(ASC-DSC / MC-IC),非黄经绝对值。地平下=自 ASC 增黄经 180°(经 IC 到 DSC,
        # 即 1-6 宫);东半=自 MC 增 180°(经 ASC 到 IC,即 10/11/12/1/2/3 宫)。缺 ASC/MC 时退化旧黄经口径。
        if asc_lon is not None and mc_lon is not None:
            rel_h = (lon - asc_lon) % 360.0
            res['hemispheres']['below' if rel_h < 180.0 else 'above'] += 1
            rel_v = (lon - mc_lon) % 360.0
            res['hemispheres']['east' if rel_v < 180.0 else 'west'] += 1
        else:
            res['hemispheres']['below' if 0 <= lon < 180 else 'above'] += 1
            res['hemispheres']['west' if 90 <= lon < 270 else 'east'] += 1
    return res


def almuten_table(perchart):
    rows = []
    totals = {obj: 0 for obj in const.LIST_SEVEN_PLANETS}
    hylegic = [
        perchart.chart.getObject(const.SUN),
        perchart.chart.getObject(const.MOON),
        perchart.chart.getAngle(const.ASC),
        perchart.chart.getObject(const.PARS_FORTUNA),
        perchart.chart.getObject(const.SYZYGY),
    ]
    # almuten 三分计分口径:'all'(默认=现状,day/night/part 三主各 +3)/'sectRulerOnly'
    # (只计当值主:昼盘 dayTrip/夜盘 nightTrip,partTrip 与非当值主不计——文献另一派口径)。
    trip_mode = None
    try:
        trip_mode = (perchart.data or {}).get('almutenTripMode')
    except Exception:
        trip_mode = None
    sect_trip_key = 'dayTrip' if getattr(perchart, 'isDiurnal', True) else 'nightTrip'
    for point in hylegic:
        row = {'point': point.id, 'scores': {obj: 0 for obj in const.LIST_SEVEN_PLANETS}}
        dig = essential.getInfo(point.sign, point.signlon)
        for key, score in DIGNITY_SCORES.items():
            if trip_mode == 'sectRulerOnly' and key in ('dayTrip', 'nightTrip', 'partTrip') and key != sect_trip_key:
                continue
            obj_id = dig.get(key)
            if obj_id in row['scores']:
                row['scores'][obj_id] += score
                totals[obj_id] += score
        rows.append(row)

    house_row = {'point': 'Houses', 'scores': {obj: 0 for obj in const.LIST_SEVEN_PLANETS}}
    for obj_id in const.LIST_SEVEN_PLANETS:
        obj = perchart.chart.getObject(obj_id)
        try:
            house = perchart.chart.houses.getObjectHouse(obj)
            score = HOUSE_SCORES.get(house.id, 0)
        except Exception:
            score = 0
        house_row['scores'][obj_id] += score
        totals[obj_id] += score
    rows.append(house_row)
    return {
        'rows': rows,
        'totals': totals,
        'winner': max(totals.items(), key=lambda item: item[1])[0] if totals else None,
    }


def extra_lots(perchart):
    """阿拉伯点目录:单一来源(各点专属公式,昼夜反转已内置),按题归类,无重复。"""
    res = []
    for lot in perchart.getPars(perchart.chart):
        obj = object_to_dict(lot)
        res.append({
            'id': obj['id'],
            'label': obj['id'],
            'lon': obj['lon'],
            'sign': obj['sign'],
            'signlon': obj['signlon'],
            'category': _lot_category(obj['id']),
        })
    return res


# 点的题别归类(中性词);未列入者归「其它」。
_LOT_CATEGORY = {
    'Pars Spirit': '核心', 'Pars Fortuna': '核心', 'Pars Faith': '核心', 'Pars Substance': '财帛',
    'Pars Father': '亲属', 'Pars Mother': '亲属', 'Pars Brothers': '亲属', 'Pars Sons': '亲属',
    'Pars Wedding [Male]': '婚配', 'Pars Wedding [Female]': '婚配',
    'Pars Diseases': '疾厄', 'Pars Death': '疾厄', 'Pars Travel': '行旅', 'Pars Friends': '人际',
    'Pars Enemies': '人际', 'Pars Saturn': '行星点', 'Pars Jupiter': '行星点', 'Pars Mars': '行星点',
    'Pars Venus': '行星点', 'Pars Mercury': '行星点', 'Pars Horsemanship': '事务', 'Pars Life': '核心',
    'Pars Radix': '核心', 'Pars Eros': '七点', 'Pars Necessity': '七点', 'Pars Courage': '七点',
    'Pars Victory': '七点', 'Pars Nemesis': '七点',
}


def _lot_category(lot_id):
    return _LOT_CATEGORY.get(lot_id, '其它')


# WI-22 比尼/王者恒星:15 比尼星名录 + 四王者星(守望者);性质取托勒密行星对应(中性行星字标,
# 土=Saturn 木=Jupiter 火=Mars 金=Venus 水=Mercury 日=Sun 月=Moon)。坐标/中文名由星历单一来源,此处仅作分类标注。
_BEHENIAN_NATURE = {
    'Algol': '土·木', 'Alcyone': '月·火', 'Aldebaran': '火', 'Capella': '火·水',
    'Sirius': '木·火', 'Procyon': '水·火', 'Regulus': '火·木', 'Algorab': '火·土',
    'Spica': '金·水', 'Arcturus': '火·木', 'Alphecca': '金·水', 'Antares': '火·木',
    'Vega': '金·水', 'Deneb Algedi': '土·木', 'Fomalhaut': '金·水',
}
_ROYAL_WATCHER = {'Aldebaran': '东', 'Regulus': '北', 'Antares': '西', 'Fomalhaut': '南'}


def fixed_star_hits(perchart, orb=1.0, by_magnitude=False):
    """by_magnitude=True 时逐星取 FixedStar.orb()(星等表,与 /chart 汇合恒星的 starOrbMode='byMagnitude' 同表),
    否则用统一平轨 orb;此前只认单一平轨值,「按星等」档对恒星触发无效。"""
    stars = perchart.getFixedStars()
    points = [p for p in chart_points(perchart, include_angles=True) if p['id'] in DEFAULT_EVENT_PLANETS or p['id'] in (const.ASC, const.MC, const.DESC, const.IC)]
    hits = []
    for star in stars:
        slon = safe_float(getattr(star, 'lon', 0))
        sid = getattr(star, 'id', '')
        mag = getattr(star, 'mag', None)
        watcher = _ROYAL_WATCHER.get(sid, '')
        star_orb = orb
        if by_magnitude:
            try:
                _o = star.orb()
                if _o is not None and float(_o) > 0:
                    star_orb = float(_o)
            except Exception:
                star_orb = orb
        for p in points:
            delta = angle_distance(slon, p['lon'])
            if delta <= star_orb:
                hits.append({
                    'star': sid,
                    'cn': getattr(star, 'name', ''),
                    'mag': safe_float(mag[0] if isinstance(mag, (tuple, list)) else mag, None),
                    'point': p['id'],
                    'orb': delta,
                    'starLon': slon,
                    'pointLon': p['lon'],
                    'sign': sign_name_from_lon(slon),
                    'signlon': slon % 30,
                    'behenian': sid in _BEHENIAN_NATURE,
                    'royal': watcher,
                    'nature': _BEHENIAN_NATURE.get(sid, ''),
                })
    # 去重(星历名录含个别重名星条目,如 Alcyone),同一 星-点 取最紧容许度;
    # 再按"王者→比尼→其余",同档容许度升序排序,凸显择时要星。
    seen = {}
    for h in hits:
        k = (h['star'], h['point'])
        if k not in seen or h['orb'] < seen[k]['orb']:
            seen[k] = h

    def _rank(h):
        return (0 if h['royal'] else (1 if h['behenian'] else 2), h['orb'])
    return sorted(seen.values(), key=_rank)


def compute_classical_patterns(perchart):
    """WI-08 古典格局:护卫 doryphory / 优势相位 overcoming(右旋三分四分六分) / 度数围攻 besieging-by-degree。"""
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    try:
        is_diurnal = bool(perchart.chart.isDiurnal())
    except Exception:
        is_diurnal = True
    out = {'doryphory': [], 'overcoming': [], 'besieging': []}

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    sun = pts.get(const.SUN)
    merc_oriental = bool(sun and const.MERCURY in pts and signed(pts[const.MERCURY]['lon'], sun['lon']) < 0)
    diurnal_planets = [const.SUN, const.JUPITER, const.SATURN] + ([const.MERCURY] if merc_oriental else [])
    nocturnal_planets = [const.MOON, const.VENUS, const.MARS] + ([] if merc_oriental else [const.MERCURY])
    sect_planets = diurnal_planets if is_diurnal else nocturnal_planets
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]

    # 护卫 doryphory:同宗行星于宗派光之前 7–15°(晨升侧)护卫。
    light = const.SUN if is_diurnal else const.MOON
    if light in pts:
        ll = pts[light]['lon']
        for pid in sect_planets:
            if pid == light or pid not in pts:
                continue
            el = signed(pts[pid]['lon'], ll)
            if -15.0 <= el <= -7.0:
                out['doryphory'].append({'planet': pid, 'light': light, 'elong': round(el, 2)})

    # 优势相位 overcoming:A 处 B 上方(右旋)第 9/10/11 座(三分/四分/六分压制)。
    SIGNS = const.LIST_SIGNS
    OVR = {8: 'trine', 9: 'square', 10: 'sextile'}
    for a in seven:
        for b in seven:
            if a == b or a not in pts or b not in pts:
                continue
            try:
                off = (SIGNS.index(pts[a]['sign']) - SIGNS.index(pts[b]['sign'])) % 12
            except Exception:
                continue
            if off in OVR:
                out['overcoming'].append({'over': a, 'under': b, 'aspect': OVR[off],
                                          'overSign': pts[a]['sign'], 'underSign': pts[b]['sign']})

    # 度数围攻 besieging-by-degree:目标被两凶星天体在 ±7° 内夹,其间无他星(区别于整宫围攻)。
    malefics = [const.MARS, const.SATURN]
    for tid in seven:
        if tid in malefics or tid not in pts:
            continue
        t = pts[tid]['lon']
        left = right = None
        for mid in malefics:
            if mid not in pts:
                continue
            el = signed(pts[mid]['lon'], t)
            if -7.0 <= el < 0.0:
                left = (mid, el)
            elif 0.0 < el <= 7.0:
                right = (mid, el)
        if left and right:
            between = any(
                oid not in (tid, left[0], right[0]) and oid in pts and left[1] < signed(pts[oid]['lon'], t) < right[1]
                for oid in seven)
            if not between:
                out['besieging'].append({'planet': tid, 'left': left[0], 'right': right[0],
                                         'leftOrb': round(abs(left[1]), 2), 'rightOrb': round(abs(right[1]), 2)})
    return out


def _wheel_orb(perchart, id_a, id_b, fallback=8.0):
    """与星图所绘/相位tab 一致的相位容许度:取两星 orb 较大者(双向并集——任一方容许度够到即成相;
    日15/月12/水7/金火8/木土9…)。修复 feral 同坑:固定 8° 会漏掉日月宽相(如月对日冲 10.5°)。"""
    try:
        return max(perchart.chart.getObject(id_a).orb(), perchart.chart.getObject(id_b).orb())
    except Exception:
        return fallback


def compute_accidental_dignity(perchart):
    """WI-16 偶然尊贵评分:角续果宫 / 行速 / 东西向 / 日下相 / 月相增减 / 会吉凶 / 喜乐 / 度数围攻 加权汇总。
    标准权重(可入设置);与必然尊贵得分并列。返回每星 {planet, score, factors[]},降序。"""
    SEVEN = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    ANGULAR = {1, 4, 7, 10}
    SUCCEDENT = {2, 5, 8, 11}
    INNER = {const.MERCURY, const.VENUS}
    OUTER = {const.MARS, const.JUPITER, const.SATURN}
    MALEFICS = [const.MARS, const.SATURN]
    objs = {o.id: o for o in perchart.chart.objects if getattr(o, 'id', None) in SEVEN}
    sun = objs.get(const.SUN)

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    rows = []
    for pid in SEVEN:
        o = objs.get(pid)
        if not o:
            continue
        score = 0
        parts = []
        try:
            hn = int(str(getattr(o, 'house', '') or '').replace('House', ''))
        except Exception:
            hn = 0
        if hn in ANGULAR:
            score += 5; parts.append('角宫+5')
        elif hn in SUCCEDENT:
            score += 3; parts.append('续宫+3')
        elif hn:
            score -= 2; parts.append('果宫-2')
        ms = getattr(o, 'meanSpeed', None)
        sp = getattr(o, 'lonspeed', None)
        if ms is not None and sp is not None and pid not in (const.SUN, const.MOON):
            if abs(sp) > abs(ms):
                score += 2; parts.append('行速+2')
            else:
                score -= 2; parts.append('行迟-2')
        if sun is not None and pid != const.SUN:
            el = signed(o.lon, sun.lon)
            if pid in OUTER and el < 0:
                score += 2; parts.append('东出+2')
            elif pid in INNER and el > 0:
                score += 2; parts.append('西入+2')
        ph = getattr(o, 'phase', None)
        if ph == 'free':
            score += 5; parts.append('自由光+5')
        elif ph == 'combust':
            score -= 5; parts.append('焦伤-5')
        elif ph == 'cazimi':
            score += 5; parts.append('核心+5')
        if pid == const.MOON and sun is not None:
            me = (o.lon - sun.lon) % 360.0
            if 0 < me < 180:
                score += 2; parts.append('增光+2')
            else:
                score -= 2; parts.append('减光-2')
        for bid, w, lbl in ((const.JUPITER, 5, '会木+5'), (const.VENUS, 4, '会金+4'), (const.SATURN, -5, '会土-5'), (const.MARS, -4, '会火-4')):
            if bid != pid and bid in objs and abs(signed(o.lon, objs[bid].lon)) <= _wheel_orb(perchart, pid, bid):
                score += w; parts.append(lbl)
        if getattr(o, 'joy', False):
            score += 5; parts.append('喜乐+5')
        if pid not in MALEFICS:
            left = right = False
            for mid in MALEFICS:
                if mid in objs:
                    el = signed(objs[mid].lon, o.lon)
                    if -7.0 <= el < 0.0:
                        left = True
                    elif 0.0 < el <= 7.0:
                        right = True
            if left and right:
                score -= 5; parts.append('围攻-5')
        rows.append({'planet': pid, 'score': score, 'factors': parts})
    rows.sort(key=lambda r: r['score'], reverse=True)
    return rows


def compute_bonification(perchart):
    """WI-12 吉化/凶化:被同类吉星(木/金)会合·凌驾·夹 = 吉化;被凶星(土/火) = 凶化。逐关键星汇总受处置。"""
    pts = {p['id']: p for p in chart_points(perchart, include_angles=False)}
    BEN = [const.JUPITER, const.VENUS]
    MAL = [const.SATURN, const.MARS]
    SIGNS = const.LIST_SIGNS
    seven = [const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN]
    OVR = {8: '三分压制', 9: '四分压制', 10: '六分压制'}

    def signed(a, b):
        return ((a - b + 180.0) % 360.0) - 180.0

    out = []
    for tid in seven:
        if tid not in pts:
            continue
        t = pts[tid]
        bon = []
        mal = []
        for src in BEN + MAL:
            if src == tid or src not in pts:
                continue
            rel = None
            if abs(signed(t['lon'], pts[src]['lon'])) <= _wheel_orb(perchart, tid, src):
                rel = '会合'
            else:
                try:
                    off = (SIGNS.index(pts[src]['sign']) - SIGNS.index(t['sign'])) % 12
                except Exception:
                    off = -1
                if off in OVR:
                    rel = OVR[off]
            if rel:
                (bon if src in BEN else mal).append({'by': src, 'rel': rel})
        if bon or mal:
            out.append({'planet': tid, 'bonified': bon, 'maltreated': mal})
    return out


_PTOL = [0, 60, 90, 120, 180]
_PTOL_CN = {0: '合', 60: '六分', 90: '四分', 120: '三分', 180: '冲'}


def compute_aspect_dynamics(perchart, void_classical=False):
    """WI-10 入相/出相 · 传光 · 聚光 + WI-11 左右相位 · 不合意 · 交点弯曲
    + G10 空亡 void · 阻止 prohibition · 挫败 frustration · 收回 refranation。七政两两托勒密相位为底。"""
    objs = {o.id: o for o in perchart.chart.objects if getattr(o, 'id', None) in
            (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN)}
    ids = [i for i in (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN) if i in objs]
    SIGNS = const.LIST_SIGNS

    def diff(la, lb):
        return abs(((la - lb + 180.0) % 360.0) - 180.0)

    def applying(a, b, asp):
        la, lb = objs[a].lon, objs[b].lon
        sa = getattr(objs[a], 'lonspeed', 0.0) or 0.0
        sb = getattr(objs[b], 'lonspeed', 0.0) or 0.0
        now = abs(diff(la, lb) - asp)
        nxt = abs(diff(la + sa * 0.02, lb + sb * 0.02) - asp)
        return nxt < now

    aspects = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            for asp in _PTOL:
                d = diff(objs[a].lon, objs[b].lon)
                if abs(d - asp) <= _wheel_orb(perchart, a, b):
                    # 左右相位:发出星(慢者发向快者)在黄道序「之前」为右旋(dexter),「之后」为左旋(sinister)。
                    off = (SIGNS.index(objs[a].sign) - SIGNS.index(objs[b].sign)) % 12
                    hand = 'dexter' if off in (9, 10, 11, 8) else 'sinister'
                    aspects.append({'a': a, 'b': b, 'aspect': asp, 'orb': round(abs(d - asp), 2),
                                    'applying': applying(a, b, asp), 'hand': hand})
                    break

    # 传光 translation:某快星先出相于一星、再入相于另一星(两被连星彼此可无相)。
    translation = []
    speeds = {i: abs(getattr(objs[i], 'lonspeed', 0.0) or 0.0) for i in ids}
    for mover in ids:
        seps = [x for x in aspects if mover in (x['a'], x['b']) and not x['applying']]
        apps = [x for x in aspects if mover in (x['a'], x['b']) and x['applying']]
        for s in seps:
            other_s = s['b'] if s['a'] == mover else s['a']
            for ap in apps:
                other_a = ap['b'] if ap['a'] == mover else ap['a']
                if other_s != other_a and speeds.get(mover, 0) >= speeds.get(other_s, 0) and speeds.get(mover, 0) >= speeds.get(other_a, 0):
                    translation.append({'mover': mover, 'from': other_s, 'to': other_a})
    # 聚光 collection:某慢星同时被两更快星入相,而该两快星彼此不成相。
    collection = []
    aspect_set = {(x['a'], x['b']) for x in aspects} | {(x['b'], x['a']) for x in aspects}
    for collector in ids:
        incoming = [x for x in aspects if collector in (x['a'], x['b']) and x['applying']]
        fasters = [(x['b'] if x['a'] == collector else x['a']) for x in incoming
                   if speeds.get(x['b'] if x['a'] == collector else x['a'], 0) > speeds.get(collector, 0)]
        for m in range(len(fasters)):
            for n in range(m + 1, len(fasters)):
                if (fasters[m], fasters[n]) not in aspect_set:
                    collection.append({'collector': collector, 'p1': fasters[m], 'p2': fasters[n]})

    # 不合意 aversion:星座相距 2/6/8/12(无托勒密相位)。
    aversion = []
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            off = (SIGNS.index(objs[a].sign) - SIGNS.index(objs[b].sign)) % 12
            if off in (1, 5, 7, 11):
                aversion.append({'a': a, 'b': b})

    # 交点弯曲 bending:行星距北/南交点 90°(±3°)处。
    bending = []
    try:
        node = perchart.chart.getObject(const.NORTH_NODE)
        nlon = node.lon
        for i in ids:
            for tgt, tag in ((nlon + 90.0, '北弯'), (nlon - 90.0, '南弯')):
                if diff(objs[i].lon, tgt % 360.0) <= 3.0:
                    bending.append({'planet': i, 'at': tag})
    except Exception:
        pass

    # ===== G10 连接学说后四式(度数级;快星施动、慢星受者) =====
    # 入相相位列表(施动星 = 该对中更快者)与「剩余度数 r」查表:r 取当前到精确的角差(aspects[*].orb)。
    applying_list = []
    for x in aspects:
        if not x['applying']:
            continue
        sa = speeds.get(x['a'], 0.0)
        sb = speeds.get(x['b'], 0.0)
        mover = x['a'] if sa >= sb else x['b']
        target = x['b'] if mover == x['a'] else x['a']
        applying_list.append({'mover': mover, 'target': target, 'aspect': x['aspect'], 'r': x['orb']})

    # 空亡 void:指定星(默认月)在离开本座前不再完成任何精确相位。
    # 默认本座义:以当前黄经到本座末(30°)的度数为窗口,看是否还有入相且在窗口内完成的精确相位。
    # 空亡古典义(30°内,void_classical):窗口固定 30°,不限本座。默认 OFF。
    void = []
    void_id = const.MOON if const.MOON in objs else (ids[0] if ids else None)
    if void_id is not None and void_id in objs:
        vo = objs[void_id]
        vspeed = speeds.get(void_id, 0.0)
        # 离座窗口:本座义 = 30 - 本座度数;古典义 = 30。逆行则窗口为已走过的本座度数。
        signlon = getattr(vo, 'signlon', vo.lon % 30.0)
        raw_speed = getattr(vo, 'lonspeed', 0.0) or 0.0
        if void_classical:
            window = 30.0
        else:
            window = (signlon if raw_speed < 0 else (30.0 - signlon))
        will_perfect = False
        next_within = None
        for x in applying_list:
            if void_id not in (x['mover'], x['target']):
                continue
            # 完成该入相还需移动 r 度(近似:施动星主导闭合);r<=窗口 ⇒ 离座前可成。
            if x['r'] <= window:
                will_perfect = True
                if next_within is None or x['r'] < next_within:
                    next_within = x['r']
        if not will_perfect:
            void.append({'planet': void_id, 'window': round(window, 2),
                         'mode': 'classical' if void_classical else 'sign'})

    # 阻止 prohibition:甲→乙入相(剩余 r_AB),丙→乙入相 r_CB<r_AB 且丙更快 → 丙先到、截断甲。
    prohibition = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for cb in applying_list:
            if cb['target'] != b or cb['mover'] == a:
                continue
            c = cb['mover']
            if cb['r'] < ab['r'] and speeds.get(c, 0.0) > speeds.get(a, 0.0):
                prohibition.append({'blocker': c, 'between': a, 'to': b,
                                    'rBlocker': round(cb['r'], 2), 'rOriginal': round(ab['r'], 2)})

    # 挫败 frustration:甲→乙 applying;乙又→丁 applying 且剩余 orb 更小(乙先到丁移情)→ 甲落空。
    frustration = []
    for ab in applying_list:
        a, b = ab['mover'], ab['target']
        for bd in applying_list:
            if b not in (bd['mover'], bd['target']):
                continue
            d = bd['target'] if bd['mover'] == b else bd['mover']
            if d in (a, b):
                continue
            if bd['r'] < ab['r']:
                frustration.append({'frustrated': a, 'via': b, 'to': d,
                                    'rOriginal': round(ab['r'], 2), 'rDefect': round(bd['r'], 2)})

    # 收回 refranation:甲→乙 applying,但甲速度趋零/将变号(扩 0.02 天投影 speed*speed_future<0)→ 撤离。
    refranation = []
    seen_refran = set()
    for ab in applying_list:
        a = ab['mover']
        if a in seen_refran:
            continue
        try:
            o = objs[a]
            sp = getattr(o, 'lonspeed', 0.0) or 0.0
            ms = getattr(o, 'meanSpeed', None)
            # 留点临界(将变号/趋零):速率极小相对平均速率(< 4%),或绝对值近零 → 入相中途撤离。
            # lonspeed 在 0.02 天内近恒,无独立未来采样;以「趋零」为留点的自洽判据。
            tiny = (ms is not None and abs(ms) > 0 and abs(sp) < abs(ms) * 0.04) or abs(sp) < 0.0005
            if tiny:
                refranation.append({'planet': a, 'to': ab['target'], 'r': round(ab['r'], 2)})
                seen_refran.add(a)
        except Exception:
            pass

    return {'aspects': aspects, 'translation': translation, 'collection': collection,
            'aversion': aversion, 'bending': bending,
            'void': void, 'prohibition': prohibition,
            'frustration': frustration, 'refranation': refranation}


# 题别 → (宫位, 自然象征星, 中文)。逐题复合主星 = 该宫起始星座的必然尊贵胜出星 + 自然象征星。
_TOPIC_HOUSES = [
    ('父亲', 4, const.SATURN), ('母亲', 10, const.VENUS), ('兄弟', 3, const.MARS),
    ('婚配', 7, const.VENUS), ('子女', 5, const.JUPITER), ('事业', 10, const.SUN),
    ('财帛', 2, const.JUPITER), ('疾厄', 6, const.MARS), ('死亡', 8, const.SATURN),
]


def compute_topic_almuten(perchart):
    """WI-13 逐题复合主星:每题取相关宫起始星座的必然尊贵积分胜出星 + 自然象征星。"""
    out = []
    for label, house_num, sig in _TOPIC_HOUSES:
        winner = None
        try:
            house = perchart.chart.getHouse(const.LIST_HOUSES[house_num - 1])
            dig = essential.getInfo(house.sign, house.signlon)
            scores = {}
            for key, sc in DIGNITY_SCORES.items():
                oid = dig.get(key)
                if oid:
                    scores[oid] = scores.get(oid, 0) + sc
            winner = max(scores.items(), key=lambda x: x[1])[0] if scores else None
        except Exception:
            winner = None
        out.append({'topic': label, 'house': house_num, 'significator': sig, 'almuten': winner})
    return out


def analyze_chart(data):
    params = base_params(data)
    # analysis 族接入古典复合临界区:此前唯本端点裸建 PerChart(harmonic/relocation/
    # draconic 均已 push),almuten_table/compute_topic_almuten 的 essential.getInfo 恒用默认
    # 界表/三分表/计分表——右栏 Almuten/逐题主星对界系/三分制/宫头前移全档空转。
    _cls_tok = push_classical_request(params)
    try:
        return _analyze_chart_inner(params, data)
    finally:
        pop_classical_request(_cls_tok)


def _analyze_chart_inner(params, data):
    perchart = PerChart(params)
    points = chart_points(perchart, include_angles=True)
    try:
        temperament = Temperament(perchart.chart).getScore()
    except Exception:
        traceback.print_exc()
        temperament = None
    return {
        'patterns': detect_patterns(points),
        'distribution': distribution(points, _angle_lon(perchart, const.ASC), _angle_lon(perchart, const.MC)),
        'almutem': almuten_table(perchart),
        'temperament': temperament,
        'extraLots': extra_lots(perchart),
        # 轨值优先取请求显式 fixedStarOrb,否则取随盘 starOrb(chart 级回显键);档位 byMagnitude 两名皆认。
        'fixedStarHits': fixed_star_hits(
            perchart,
            safe_float(data.get('fixedStarOrb', data.get('starOrb', 1.0)), 1.0),
            (data.get('fixedStarOrbMode') == 'byMagnitude') or (data.get('starOrbMode') == 'byMagnitude'),
        ),
        'classicalPatterns': compute_classical_patterns(perchart),
        'accidentalDignity': compute_accidental_dignity(perchart),
        'bonification': compute_bonification(perchart),
        'aspectDynamics': compute_aspect_dynamics(perchart, to_bool(data.get('voidClassical'), False)),
        'topicAlmuten': compute_topic_almuten(perchart),
        'planetaryHours': compute_planetary_hours(params),
        'egyptianCalendar': compute_egyptian_calendar(perchart, params),
        'babylonianStars': compute_babylonian_stars(perchart),
    }
