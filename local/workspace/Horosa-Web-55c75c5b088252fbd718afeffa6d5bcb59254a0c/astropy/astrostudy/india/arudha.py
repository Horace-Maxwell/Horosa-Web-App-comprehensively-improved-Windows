# -*- coding: utf-8 -*-
"""Arudha pada（指示点）+ Argala（干涉）—— 独立纯函数模块。

输入皆为简单数据(行星→星座 dict / lagna 星座 / 可选黄经)，不耦合排盘引擎内部状态，便于单测。
坐标系：rasi 序 Ar=1..Pi=12；宫 = 从参照点起顺黄道数(本宫=1)。

包含：
  A-a 12 宫 Arudha pada(含 AL=第1宫 arudha、UL=第12宫 arudha)
  A-b graha pada(行星 arudha，可选)
  A-c Argala(干涉)/Virodhargala(反干涉)

Arudha 算法(rasi pada)：
  ①取参照宫所在 rasi；②取其主星所在 rasi；③顺黄道数 宫 rasi → 主星 rasi 得 n；
  ④从主星 rasi 再顺数 n 宫 → 落 rasi；⑤例外：落 rasi 若为原 rasi 的第 1 或第 7 宫 → 改取其第 10 rasi。
  双主宫(天蝎 Sc=火/计、水瓶 Aq=土/罗)取较强者(强弱口径见 _stronger_ruler，可由调用方覆盖)。

Argala / Virodhargala：
  以某 rasi 为参照，其第 2/4/11 宫成主 argala、第 5 宫成次 argala(干涉)；
  第 12/10/3 宫分别反制(virodha)第 2/4/11 宫的 argala，第 9 宫反制第 5 宫。
  特例：参照 rasi 含 Ketu(南交点) → argala/virodha 改逆黄道数。
"""

from flatlib import const

from astrostudy.india.primitives import (
    SIGNS, SIGN_INDEX, offset_sign, house_distance, index_of,
)


# ── 星座主星(rasi lord)──────────────────────────────────────────────────
# 单主：日Le/月Cn/水Ge,Vi/金Ta,Li/火Ar/木Sg,Pi/土Cp。
# 双主古典口径：天蝎 Sc=火(Mars)+计都(Ketu)；水瓶 Aq=土(Saturn)+罗睺(Rahu)。
# 节点字符串：Rahu=北交点、Ketu=南交点。
RAHU = const.NORTH_NODE   # 罗睺
KETU = const.SOUTH_NODE   # 计都

SIGN_LORDS = {
    const.ARIES: const.MARS,
    const.TAURUS: const.VENUS,
    const.GEMINI: const.MERCURY,
    const.CANCER: const.MOON,
    const.LEO: const.SUN,
    const.VIRGO: const.MERCURY,
    const.LIBRA: const.VENUS,
    const.SCORPIO: const.MARS,
    const.SAGITTARIUS: const.JUPITER,
    const.CAPRICORN: const.SATURN,
    const.AQUARIUS: const.SATURN,
    const.PISCES: const.JUPITER,
}

# 双主宫的「副主星」(co-lord)：天蝎→计都、水瓶→罗睺。主+副两候选取强。
SIGN_COLORDS = {
    const.SCORPIO: KETU,
    const.AQUARIUS: RAHU,
}

# 双主取强默认口径用的简单尊贵表(own / 旺星座)——仅本模块默认强弱用，不引排盘引擎。
# 完整尊贵/强弱另由引擎权威表负责；此处只为「无外部 ruler_strength 时」给确定结果。
_OWN_SIGNS = {
    const.SUN: (const.LEO,),
    const.MOON: (const.CANCER,),
    const.MARS: (const.ARIES, const.SCORPIO),
    const.MERCURY: (const.GEMINI, const.VIRGO),
    const.JUPITER: (const.SAGITTARIUS, const.PISCES),
    const.VENUS: (const.TAURUS, const.LIBRA),
    const.SATURN: (const.CAPRICORN, const.AQUARIUS),
    RAHU: (),
    KETU: (),
}
_EXALT_SIGN = {
    const.SUN: const.ARIES, const.MOON: const.TAURUS, const.MARS: const.CAPRICORN,
    const.MERCURY: const.VIRGO, const.JUPITER: const.CANCER, const.VENUS: const.PISCES,
    const.SATURN: const.LIBRA, RAHU: const.TAURUS, KETU: const.SCORPIO,
}


def sign_lords(sign):
    """该 rasi 的主星列表：单主宫 1 个；双主宫(Sc/Aq)2 个(传统主 + 节点副主)。"""
    lords = [SIGN_LORDS[sign]]
    co = SIGN_COLORDS.get(sign)
    if co is not None:
        lords.append(co)
    return lords


# ── A-a/A-b Arudha 落宫 ──────────────────────────────────────────────────
def _stronger_ruler(lords, planet_signs, planet_lons=None):
    """双主宫取较强者(default 口径，可被 ruler_strength 覆盖)。

    规则(逐级，弱者居后)：
      1. 居自身旺/own 星座者更强；
      2. 否则在本星座度数更高者更强(planet_lons 给黄经时)；
      3. 仍不可分 → 取列表首个(传统主星)，保证确定性。
    注意：这是「简单度数/尊贵」口径；完整 P-a/长寿章强弱序(合相曜数/受照数等)
    需更多上下文，由调用方经 ruler_strength 回调注入，本模块不臆造完整序。
    """
    if len(lords) == 1:
        return lords[0]

    def own_or_exalt(p):
        s = planet_signs.get(p)
        if s is None:
            return False
        own = _OWN_SIGNS.get(p, ())
        ex = _EXALT_SIGN.get(p)
        return s in own or s == ex

    ranked = [p for p in lords if own_or_exalt(p)]
    if len(ranked) == 1:
        return ranked[0]
    pool = ranked if len(ranked) >= 1 else list(lords)

    if planet_lons:
        def sign_deg(p):
            lon = planet_lons.get(p)
            return (float(lon) % 30.0) if lon is not None else -1.0
        pool = sorted(pool, key=sign_deg, reverse=True)

    return pool[0]


def _resolve_lord(sign, planet_signs, planet_lons=None, ruler_strength=None):
    """取参照 rasi 的「有效主星」：单主直接给；双主用 ruler_strength 或默认强弱选。"""
    lords = sign_lords(sign)
    if len(lords) == 1:
        return lords[0]
    if ruler_strength is not None:
        # 调用方口径：返回值应为 lords 中较强的那个 planet id。
        chosen = ruler_strength(lords, sign, planet_signs)
        if chosen in lords:
            return chosen
    return _stronger_ruler(lords, planet_signs, planet_lons)


def _pada_from_signs(ref_sign, lord_sign):
    """给定参照 rasi 与其主星所在 rasi，按「同数」规则求落 rasi(含 1/7→第10 例外)。"""
    n = house_distance(ref_sign, lord_sign)        # 参照→主星 的宫数(1-12)
    landed = offset_sign(lord_sign, n)             # 从主星 rasi 再顺数 n 宫
    d = house_distance(ref_sign, landed)           # 落宫相对参照宫的位置
    if d == 1 or d == 7:
        # 例外:落本宫/第 7 宫 → 取「自该落宫」起数第 10 座。
        # 🔴 曾自参照宫数第 10:d==1 时两解相同掩盖了错;d==7 时正解=参照第 4 座
        # (主星居参照第 4/10 宫必踩此支,每宫约 1/6 概率,AL/UL/全宫 pada 全链受染)。
        landed = offset_sign(landed, 10)
    return landed


def arudha_of_sign(ref_sign, planet_signs, planet_lons=None, ruler_strength=None):
    """单个参照 rasi 的 arudha pada 落 rasi。

    ref_sign: 参照星座(如某宫所在星座)。
    planet_signs: {planet_id: sign}(rasi 占位，用于定位主星与判双主强弱)。
    planet_lons / ruler_strength: 见 _resolve_lord。
    """
    lord = _resolve_lord(ref_sign, planet_signs, planet_lons, ruler_strength)
    lord_sign = planet_signs.get(lord)
    if lord_sign is None:
        return None                                # 主星位置缺失 → 无法定 pada
    return _pada_from_signs(ref_sign, lord_sign)


# 12 宫 arudha 的标准标签：A1..A12，其中 A1=AL(Arudha Lagna)、A12=UL(Upapada Lagna)。
ARUDHA_LABELS = ['A%d' % i for i in range(1, 13)]
AL_INDEX = 1     # 第 1 宫 arudha = Arudha Lagna(AL)
UL_INDEX = 12    # 第 12 宫 arudha = Upapada Lagna(UL)


def house_arudhas(lagna_sign, planet_signs, planet_lons=None, ruler_strength=None):
    """12 宫全 arudha pada：以 lagna 为第 1 宫顺数 12 宫，逐宫求 arudha。

    返回 [{'house','label','sign','signIndex'} …] 长度 12；
    house=宫序(1-12)，label=A1..A12(A1=AL/A12=UL)，sign=落 rasi。
    """
    out = []
    for h in range(1, 13):
        ref_sign = offset_sign(lagna_sign, h)      # 第 h 宫所在 rasi
        pada = arudha_of_sign(ref_sign, planet_signs, planet_lons, ruler_strength)
        out.append({
            'house': h,
            'label': ARUDHA_LABELS[h - 1],   # A1=AL、A12=UL
            'refSign': ref_sign,
            'sign': pada,
            'signIndex': (index_of(pada) + 1) if pada else None,
        })
    return out


def arudha_lagna(lagna_sign, planet_signs, planet_lons=None, ruler_strength=None):
    """AL(Arudha Lagna)= 第 1 宫(lagna 所在 rasi)的 arudha pada。"""
    return arudha_of_sign(lagna_sign, planet_signs, planet_lons, ruler_strength)


def upapada_lagna(lagna_sign, planet_signs, planet_lons=None, ruler_strength=None):
    """UL(Upapada Lagna)= 第 12 宫的 arudha pada。"""
    twelfth = offset_sign(lagna_sign, 12)
    return arudha_of_sign(twelfth, planet_signs, planet_lons, ruler_strength)


def graha_padas(planet_signs, lagna_sign=None, planet_lons=None, ruler_strength=None,
                planets=None):
    """graha pada(行星 arudha)：以每颗行星「所在 rasi」为参照 rasi 求 arudha pada。

    与宫 arudha 同算法，只是参照 rasi 取自行星当前所居星座。
    planets: 限定参与的行星 id 列表(默认 planet_signs 全键)。
    返回 {planet_id: {'planet','refSign','sign','signIndex'}}。
    """
    keys = planets if planets is not None else list(planet_signs.keys())
    out = {}
    for p in keys:
        ref_sign = planet_signs.get(p)
        if ref_sign is None:
            continue
        pada = arudha_of_sign(ref_sign, planet_signs, planet_lons, ruler_strength)
        out[p] = {
            'planet': p,
            'refSign': ref_sign,
            'sign': pada,
            'signIndex': (index_of(pada) + 1) if pada else None,
        }
    return out


# ── A-c Argala / Virodhargala ─────────────────────────────────────────────
# 顺黄道口径：主 argala = 第 2/4/11 宫，次 argala = 第 5 宫；
# 反制(virodha)：第 12/10/3 宫分别阻第 2/4/11 宫，第 9 宫阻第 5 宫。
# 配对(argala 宫距 → 对应 virodha 宫距)。
ARGALA_PRIMARY = (2, 4, 11)        # 主 argala 宫距
ARGALA_SECONDARY = 5               # 次 argala 宫距
_VIRODHA_PAIR = {2: 12, 4: 10, 11: 3, 5: 9}   # argala 宫距 → 反制宫距


def _signed_offset_sign(ref_sign, n, reverse=False):
    """从 ref_sign 数 n 宫的 rasi；reverse=True 则逆黄道数(Ketu 特例)。"""
    step = -(n - 1) if reverse else (n - 1)
    return SIGNS[(SIGN_INDEX.get(ref_sign, 0) + step) % 12]


def argala_signs(ref_sign, reverse=False):
    """参照 rasi 的 argala / virodha 各落在哪个 rasi(纯几何，不看占据)。

    返回 {'argala': {dist: sign}, 'virodha': {dist: sign}}；
    argala dist ∈ {2,4,11,5}；virodha dist ∈ {12,10,3,9}。
    reverse=True → 逆黄道数(参照 rasi 含 Ketu 时)。
    """
    argala = {}
    virodha = {}
    for d in (2, 4, 11, ARGALA_SECONDARY):
        argala[d] = _signed_offset_sign(ref_sign, d, reverse)
    for a, v in _VIRODHA_PAIR.items():
        virodha[v] = _signed_offset_sign(ref_sign, v, reverse)
    return {'argala': argala, 'virodha': virodha}


# 自然吉凶(用于 subhargala/papargala 与「3 宫多 malefic」判定)。
# 月、木、金、(无凶合的)水 = 吉；日、火、土、罗、计 = 凶(基线自然凶星)。
_NATURAL_BENEFICS = {const.MOON, const.JUPITER, const.VENUS, const.MERCURY}
_NATURAL_MALEFICS = {const.SUN, const.MARS, const.SATURN, RAHU, KETU}


def _planets_in_sign(sign, planet_signs):
    return [p for p, s in planet_signs.items() if s == sign]


def argala_for_sign(ref_sign, planet_signs, malefic_set=None, benefic_set=None):
    """参照 rasi 的 argala / virodha 完整评估(含占据该位的行星)。

    特例：
      ①参照 rasi 含 Ketu(南交点) → argala/virodha 逆黄道数；
      ②第 3 宫若多 malefic(≥2 凶且凶多于吉) → 该位由 virodha 反转成 argala。
    benefic/papa：argala 位行星为吉=subhargala、为凶=papargala。

    返回:
      {'ref': ref_sign, 'reverse': bool,
       'argala': [{'dist','sign','planets','count','subha','papa'} …],
       'virodha': [{'dist','sign','planets','count'} …],
       'argalaCount': int, 'virodhaCount': int,
       'netStronger': 'argala'|'virodha'|'equal'}
    """
    mal = malefic_set if malefic_set is not None else _NATURAL_MALEFICS
    ben = benefic_set if benefic_set is not None else _NATURAL_BENEFICS

    reverse = KETU in _planets_in_sign(ref_sign, planet_signs)
    geo = argala_signs(ref_sign, reverse=reverse)

    # 第 3 宫 malefic 反转：统计第 3 宫的吉/凶占据。
    third_sign = _signed_offset_sign(ref_sign, 3, reverse)
    third_planets = _planets_in_sign(third_sign, planet_signs)
    third_mal = [p for p in third_planets if p in mal]
    third_ben = [p for p in third_planets if p in ben]
    third_flip = len(third_mal) >= 2 and len(third_mal) > len(third_ben)

    argala_rows = []
    for d in (2, 4, 11, ARGALA_SECONDARY):
        sign = geo['argala'][d]
        ps = _planets_in_sign(sign, planet_signs)
        argala_rows.append({
            'dist': d,
            'sign': sign,
            'planets': ps,
            'count': len(ps),
            'subha': [p for p in ps if p in ben],   # subhargala(吉干涉)
            'papa': [p for p in ps if p in mal],     # papargala(凶干涉)
        })

    virodha_rows = []
    for v in (12, 10, 3, 9):
        sign = geo['virodha'][v]
        ps = _planets_in_sign(sign, planet_signs)
        # 第 3 宫(反制第 11 宫)若被多 malefic 占据 → 转为 argala，不计入 virodha。
        if v == 3 and third_flip:
            argala_rows.append({
                'dist': 3, 'sign': sign, 'planets': ps, 'count': len(ps),
                'subha': [p for p in ps if p in ben],
                'papa': [p for p in ps if p in mal],
                'flippedFromVirodha': True,
            })
            continue
        virodha_rows.append({'dist': v, 'sign': sign, 'planets': ps, 'count': len(ps)})

    argala_count = sum(r['count'] for r in argala_rows)
    virodha_count = sum(r['count'] for r in virodha_rows)
    if argala_count > virodha_count:
        net = 'argala'
    elif virodha_count > argala_count:
        net = 'virodha'
    else:
        net = 'equal'

    return {
        'ref': ref_sign,
        'reverse': reverse,
        'thirdFlip': third_flip,
        'argala': argala_rows,
        'virodha': virodha_rows,
        'argalaCount': argala_count,
        'virodhaCount': virodha_count,
        'netStronger': net,
    }


def argala_all_houses(lagna_sign, planet_signs, malefic_set=None, benefic_set=None):
    """12 宫各自的 argala 评估(以每宫所在 rasi 为参照)。返回 {house(1-12): argala_for_sign(...)}。"""
    out = {}
    for h in range(1, 13):
        ref_sign = offset_sign(lagna_sign, h)
        out[h] = argala_for_sign(ref_sign, planet_signs, malefic_set, benefic_set)
    return out


def compute_arudha(lagna_sign, planet_signs, planet_lons=None, ruler_strength=None,
                   malefic_set=None, benefic_set=None, include_graha_pada=True):
    """聚合：12 宫 arudha pada(含 AL/UL)+ graha pada + 12 宫 argala。

    单一入口，供引擎挂到 compute() 的 'arudha' 键。
    """
    houses = house_arudhas(lagna_sign, planet_signs, planet_lons, ruler_strength)
    al = arudha_lagna(lagna_sign, planet_signs, planet_lons, ruler_strength)
    ul = upapada_lagna(lagna_sign, planet_signs, planet_lons, ruler_strength)
    result = {
        'lagnaSign': lagna_sign,
        'houseArudhas': houses,
        'arudhaLagna': al,        # AL = A1
        'upapadaLagna': ul,       # UL = A12
        'argala': argala_all_houses(lagna_sign, planet_signs, malefic_set, benefic_set),
    }
    if include_graha_pada:
        result['grahaPadas'] = graha_padas(planet_signs, lagna_sign, planet_lons, ruler_strength)
    return result
