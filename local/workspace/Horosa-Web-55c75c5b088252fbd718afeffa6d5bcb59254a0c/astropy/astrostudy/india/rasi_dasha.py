# -*- coding: utf-8 -*-
"""Jaimini 宫位大运族(rasi dasha)+ Kalachakra —— 独立纯函数引擎。

输入为简单数据(lagna 星座 / 行星星座 dict / 经度 dict / 强弱代理)，不耦合排盘引擎内部
状态，便于单测。返回各 rasi dasha 的序列 [{rasi, years, ...}]。

涵盖(算法口径与 primitives.py 同源)：
  - Narayana            (动定双 → Brahma/Shiva/Vishnu 序；方向由种子第 9 宫奇足/偶足)
  - Lagna Kendradi      (种子强者 L/7；kendra→panaphara→apoklima；方向由 lagna 奇偶宫)
  - Sudasa              (种子 = Sree Lagna 所在宫；首余 =(30−SL 宿内度)/30)
  - Drigdasa            (9 宫起；三组「9/10/11 宫 + 各自所照 3 宫」)
  - Niryana Shoola      (种子强者 2/8；奇顺偶逆；动定双 = 7/8/9 年；配 Trishoola/Rudra)
  - Shoola              (种子强者 L/7；恒顺；每运 9 年)
  - Kalachakra          (savya/apasavya + 9-rasi 序 + deha/jeeva/paramayush；27 宿×4 pada 全覆盖)

逐格序/数表均按权威源转录并配结构不变量自检：
  - Narayana 定/双宫(Shiva/Vishnu)逐格 12 元序 → `_NARAYANA_ORDER`(全 12 种子 ×
    normal/sat/ketu)，导入即自检(每列为 12 rasi 排列、首元 = 种子、sat 列 = 顺数 12 宫)。
  - Kalachakra 逐 pada 9-rasi 序 / deha / jeeva / paramayush → `KALACHAKRA_PADA_TABLE`
    (savya1/2 + apasavya1/2 共 4 子表 × 4 pada)，宿组划分覆盖全 27 宿；不变量：每行
    9 rasi 的宫主期长和 == paramayush。
极少数权威源亦未明确者保留 `# 待书值` + 优雅降级，绝不臆造。

「种子/双主强弱」按权威逐级判据：星座 6 级(种子 = lagna/7 取强)、行星 5 级(双主宫择
   强主)；逐级首决即止，全级未分则取首候选。末级「宫内推进度」需 planet_lons(可选)，
   缺则该级不决、退到下一处理。调用方仍可传 strength_proxy 用自定义打分覆盖(向后兼容)。
"""

from flatlib import const

from astrostudy.india.primitives import (
    SIGNS, SIGN_INDEX, MOVABLE, FIXED, DUAL,
    ODD_SIGNS, EVEN_SIGNS, ODD_FOOTED, EVEN_FOOTED,
    quality, offset_sign, house_distance, index_of, sign_at,
    rasi_drishti, rudra_candidate_signs, trishoola,
)
# 旺/落/own 表在 jyotish_engine(primitives.friend_signs 亦如此 import，沿用既有约定)。
from astrostudy.india.jyotish_engine import OWN_SIGNS, EXALTATION


# ════════════════════════════════════════════════════════════════════════
# 0. 星座主星 + 强弱代理
# ════════════════════════════════════════════════════════════════════════

# 各 rasi 的主星(用于「数到主星宫」)。双主宫(Sc=火/计, Aq=土/罗)在 SIGN_LORDS_DUAL。
# 这里取传统单主(节点不持单主)，双主在期长计算时按强弱择一(见 _stronger_lord)。
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
# 双主宫的第二主(Jaimini 取罗/计为 Sc/Aq 的协主)。
SIGN_LORDS_DUAL = {
    const.SCORPIO: const.SOUTH_NODE,   # Ketu
    const.AQUARIUS: const.NORTH_NODE,  # Rahu
}


def sign_lords(sign):
    """该 rasi 的主星列表(双主宫返回 2 个，单主返回 1 个)。"""
    out = [SIGN_LORDS[sign]]
    if sign in SIGN_LORDS_DUAL:
        out.append(SIGN_LORDS_DUAL[sign])
    return out


def is_exalted_in(planet, sign):
    return planet in EXALTATION and EXALTATION[planet][0] == sign


def is_debilitated_in(planet, sign):
    """落 = 旺的对宫(同度，这里仅判星座层面)。"""
    if planet not in EXALTATION:
        return False
    return offset_sign(EXALTATION[planet][0], 7) == sign


def is_own_sign(planet, sign):
    return sign in OWN_SIGNS.get(planet, [])


# ── 强弱判据底层量(供逐级判据复用)─────────────────────────────────────────
# 节点(罗/计)所拥宫位为空(OWN_SIGNS 节点为 [])，逐级判据里凡涉「own」对节点恒 False，
# 与既有约定一致(Jaimini 强弱里节点不持单主)。

def _occupants_of_sign(sign, planet_signs):
    """落在某 rasi 内的行星列表。"""
    return [p for p, s in planet_signs.items() if s == sign]


def _conjunct_planets(planet, planet_signs):
    """与某行星同宫(合相)的其它行星列表(不含自身)。"""
    s = planet_signs.get(planet)
    if s is None:
        return []
    return [p for p, ps in planet_signs.items() if p != planet and ps == s]


def _is_dignified(planet, sign):
    """旺 或 入庙(own)——逐级判据「旺/own」一档(MT 归入庙,不另立档)。"""
    if sign is None:
        return False
    return is_exalted_in(planet, sign) or is_own_sign(planet, sign)


def _rasi_aspect_count_to_sign(sign, planet_signs):
    """收到的 rasi-drishti 数 = 落在「能 rasi-照该 sign」的诸宫内的行星数。

    某行星照向 sign,当且仅当 sign 在该行星所在宫的 rasi_drishti 列表中。
    """
    cnt = 0
    for p, ps in planet_signs.items():
        if ps is None:
            continue
        try:
            if sign in rasi_drishti(ps):
                cnt += 1
        except Exception:
            pass
    return cnt


def _degree_advance(planet, planet_lons):
    """行星在其所在 rasi 内的「推进度」(0-30)；罗/计自宫末量起(30−宫内度)。

    planet_lons 缺该行星 → None(由调用方按「无法判定 → 不决」处理)。
    """
    if not planet_lons or planet not in planet_lons:
        return None
    deg = float(planet_lons[planet]) % 30.0
    if planet in (const.NORTH_NODE, const.SOUTH_NODE):
        deg = 30.0 - deg
    return deg


# ── 行星逐级强弱判据(5 级；双主宫择强主用)──────────────────────────────────
def _cmp(a, b):
    """a>b →1 / a<b →−1 / 相等 →0(逐级判据共用,某级 0 即「不决」转下一级)。"""
    return (a > b) - (a < b)


def _atmakaraka_of(planet_signs, planet_lons):
    """AK(Atmakaraka)= 宫内推进度最大者(8 曜方案:七政+罗睺;罗自宫末量起,与
    _degree_advance 同口径)。缺 lons → None(判据不决)。"""
    if not planet_lons:
        return None
    best, best_adv = None, None
    for pid in planet_signs:
        if pid == const.SOUTH_NODE:
            continue
        adv = _degree_advance(pid, planet_lons)
        if adv is None:
            continue
        if best_adv is None or adv > best_adv:
            best, best_adv = pid, adv
    return best


def planet_strength_compare(planet_a, planet_b, planet_signs, planet_lons=None, order='standard'):
    """两行星逐级强弱(返回 +1=a 强 / −1=b 强 / 0=全级未分)。逐级首决即止：

      1. 同宫合相曜数更多者强;
      2. 否则 旺/入庙者强;
      3. 否则 与一旺曜合相者强;
      4. 否则 收到 rasi-drishti 更多者强;
      5. 否则 宫内推进度更大者强(罗/计自宫末量起)。
    某级两边相等(或无数据可判)→ 转下一级;全级未分 → 0。
    """
    sa = planet_signs.get(planet_a)
    sb = planet_signs.get(planet_b)
    if order == 'ak_first':
        # 变体判据序:Atmakaraka 优先(是 AK 者径强),再落标准链。
        ak = _atmakaraka_of(planet_signs, planet_lons)
        if ak is not None:
            c = _cmp(int(planet_a == ak), int(planet_b == ak))
            if c:
                return c
    # L1 同宫合相曜数
    c = _cmp(len(_conjunct_planets(planet_a, planet_signs)),
             len(_conjunct_planets(planet_b, planet_signs)))
    if c:
        return c
    # L2 旺/入庙
    c = _cmp(int(_is_dignified(planet_a, sa)), int(_is_dignified(planet_b, sb)))
    if c:
        return c
    # L3 与旺曜合相
    a_with_exalt = any(is_exalted_in(p, planet_signs.get(p)) for p in _conjunct_planets(planet_a, planet_signs))
    b_with_exalt = any(is_exalted_in(p, planet_signs.get(p)) for p in _conjunct_planets(planet_b, planet_signs))
    c = _cmp(int(a_with_exalt), int(b_with_exalt))
    if c:
        return c
    # L4 收到 rasi-drishti 数
    if sa is not None and sb is not None:
        c = _cmp(_rasi_aspect_count_to_sign(sa, planet_signs),
                 _rasi_aspect_count_to_sign(sb, planet_signs))
        if c:
            return c
    # L5 宫内推进度(罗/计自宫末量起)
    da = _degree_advance(planet_a, planet_lons)
    db = _degree_advance(planet_b, planet_lons)
    if da is not None and db is not None:
        c = _cmp(da, db)
        if c:
            return c
    return 0


def _stronger_lord(sign, planet_signs, strength_proxy=None, planet_lons=None, order='standard'):
    """双主宫取强主(单主直接返回)。强主由 planet_strength_compare 逐级判据定。

    平(全级未分)→ 取 sign_lords 列首(传统主)。strength_proxy 形参保留向后兼容:
    若调用方传入自定义代理,则改用其在「主星所在 rasi」上的打分择强主。
    """
    lords = sign_lords(sign)
    if len(lords) == 1:
        return lords[0]
    if strength_proxy is not None:
        best, best_score = lords[0], None
        for lord in lords:
            ls = planet_signs.get(lord)
            sc = strength_proxy(ls, planet_signs) if ls is not None else -1e9
            if best_score is None or sc > best_score:
                best, best_score = lord, sc
        return best
    a, b = lords[0], lords[1]
    return a if planet_strength_compare(a, b, planet_signs, planet_lons, order=order) >= 0 else b


# ── 星座逐级强弱判据(6 级；种子 = lagna/7 取强用)───────────────────────────
_NATURAL_RANK = {'dual': 3, 'fixed': 2, 'movable': 1}   # 自然力：双 > 定 > 动


def _benefic_lord_support_count(sign, planet_signs):
    """{木、水、该 sign 之主} 中「占该 sign 或 rasi-照该 sign」的数目(0-3)。"""
    candidates = {const.JUPITER, const.MERCURY, SIGN_LORDS[sign]}
    cnt = 0
    for p in candidates:
        ps = planet_signs.get(p)
        if ps is None:
            continue
        if ps == sign:
            cnt += 1
        else:
            try:
                if sign in rasi_drishti(ps):
                    cnt += 1
            except Exception:
                pass
    return cnt


def _has_exalted_occupant(sign, planet_signs):
    return any(is_exalted_in(p, sign) for p in _occupants_of_sign(sign, planet_signs))


def _lord_sign_opposite_parity(sign, planet_signs):
    """该 sign 之主所在宫,与该 sign 的奇/偶相反 → True(主缺位 → False,不决)。"""
    lord = SIGN_LORDS[sign]
    ls = planet_signs.get(lord)
    if ls is None:
        return False
    sign_odd = sign in ODD_SIGNS
    lord_odd = ls in ODD_SIGNS
    return sign_odd != lord_odd


def sign_strength_compare(sign_a, sign_b, planet_signs, planet_lons=None, order='standard'):
    """两 rasi 逐级强弱(返回 +1=a 强 / −1=b 强 / 0=全级未分)。逐级首决即止：

      1. 占宫曜数更多者强;
      2. 否则 {木、水、本宫主} 中占/照本宫者更多者强;
      3. 否则 含一旺曜者强;
      4. 否则 其主所在宫与本宫奇偶相反者强;
      5. 否则 自然力大者强(双>定>动);
      6. 否则 两 sign 之主的宫内推进度更高者 → 该 sign 强(罗/计自宫末量起)。
    """
    if order == 'ak_first':
        # 变体判据序:含 Atmakaraka 之座径强,再落标准链。
        ak = _atmakaraka_of(planet_signs, planet_lons)
        if ak is not None:
            aks = planet_signs.get(ak)
            c = _cmp(int(aks == sign_a), int(aks == sign_b))
            if c:
                return c
    # L1 占宫曜数
    c = _cmp(len(_occupants_of_sign(sign_a, planet_signs)),
             len(_occupants_of_sign(sign_b, planet_signs)))
    if c:
        return c
    # L2 {木、水、本宫主} 占/照本宫数
    c = _cmp(_benefic_lord_support_count(sign_a, planet_signs),
             _benefic_lord_support_count(sign_b, planet_signs))
    if c:
        return c
    # L3 含旺曜
    c = _cmp(int(_has_exalted_occupant(sign_a, planet_signs)),
             int(_has_exalted_occupant(sign_b, planet_signs)))
    if c:
        return c
    # L4 主宫奇偶相反
    c = _cmp(int(_lord_sign_opposite_parity(sign_a, planet_signs)),
             int(_lord_sign_opposite_parity(sign_b, planet_signs)))
    if c:
        return c
    # L5 自然力(双>定>动)
    c = _cmp(_NATURAL_RANK[quality(sign_a)], _NATURAL_RANK[quality(sign_b)])
    if c:
        return c
    # L6 两 sign 之主的宫内推进度
    da = _degree_advance(SIGN_LORDS[sign_a], planet_lons)
    db = _degree_advance(SIGN_LORDS[sign_b], planet_lons)
    if da is not None and db is not None:
        c = _cmp(da, db)
        if c:
            return c
    return 0


def stronger_sign(sign_a, sign_b, planet_signs, strength_proxy=None, planet_lons=None, order='standard'):
    """两候选 rasi 取强者(逐级强弱判据;全级未分 → 取 sign_a)。

    strength_proxy 形参保留向后兼容:传入自定义代理则改用其打分比较(平 → sign_a)。
    """
    if strength_proxy is not None:
        return sign_a if strength_proxy(sign_a, planet_signs) >= strength_proxy(sign_b, planet_signs) else sign_b
    return sign_a if sign_strength_compare(sign_a, sign_b, planet_signs, planet_lons, order=order) >= 0 else sign_b


# ════════════════════════════════════════════════════════════════════════
# 1. 通用 Narayana 期长 + 方向 + 二轮
# ════════════════════════════════════════════════════════════════════════

def _planet_sign(planet, planet_signs):
    return planet_signs.get(planet)


def narayana_period_years(dasa_sign, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Narayana 法通用期长(年)：从 dasa rasi 数到「其主星所在宫」。

    规则：
      - 数法：dasa rasi 若 奇足 → 顺数到主星 rasi；偶足 → 逆数。距离 − 1 = 年。
      - = 1(主星在 dasa rasi 本宫，距离 = 1)→ 12 年。
      - 主星旺 → +1；落 → −1(钳在 [1,12])。
      - 双主宫 → 取强主算。
    返回 int 年(1..12)。
    """
    lord = _stronger_lord(dasa_sign, planet_signs, strength_proxy, planet_lons, order=strength_order)
    lord_sign = _planet_sign(lord, planet_signs)
    if lord_sign is None:
        # 主星位置缺失 → 退化为本宫(12 年)；调用方应保证有 sign。
        return 12
    if dasa_sign in ODD_FOOTED:
        dist = house_distance(dasa_sign, lord_sign)            # 顺数(含本宫 = 1)
    else:
        # 逆数：to 在 from 逆黄道的第几宫
        dist = ((index_of(dasa_sign) - index_of(lord_sign)) % 12) + 1
    years = dist - 1
    if years <= 0:
        years = 12                                            # 主在本宫 → 12
    if is_exalted_in(lord, lord_sign):
        years += 1
    elif is_debilitated_in(lord, lord_sign):
        years -= 1
    return max(1, min(12, years))


def second_cycle_years(first_years):
    """二轮期长 = 12 − 首轮(每 rasi 两轮，和恒 = 12)。"""
    return 12 - first_years


def _direction_oddfooted(seed_sign):
    """Narayana 方向：种子第 9 宫 奇足 → 顺(+1)；偶足 → 逆(−1)。"""
    ninth = offset_sign(seed_sign, 9)
    return 1 if ninth in ODD_FOOTED else -1


def _direction_lagna_oddeven(lagna_sign):
    """Lagna Kendradi/Sudasa 方向：lagna(或种子)奇宫 → 顺；偶宫 → 逆。"""
    return 1 if lagna_sign in ODD_SIGNS else -1


# ── Narayana 三神序(Brahma/Shiva/Vishnu)——权威序表(逐格转录)——————————————
# 动宫(Brahma)逐宫序由几何即可生成(从种子起 consecutive，方向由种子第 9 宫奇足/偶足)；
# 定宫(Shiva，每 6 宫跳)/双宫(Vishnu，三角跳)的逐格 12 元序无法由简单步进还原，须按
# 权威序表逐格转录。下表 `_NARAYANA_ORDER` 给全 12 种子 × 三列(normal/sat/ketu)的精确序：
#   normal : 该种子常规方向下的 12-rasi 序(种子第 9 宫奇足→顺/偶足→逆)。
#   sat    : Saturn 在种子 → 强制顺向逐宫(Brahma)；恒 = 从种子起黄道顺数 12 宫。
#   ketu   : Ketu 在种子 → 常规序方向反转后的逐格序。
# 自检(见 _validate_narayana_table)：每列必为 12 rasi 的排列、首元 = 种子、sat 列 =
#   从种子起顺数 12 宫。动宫种子(Ar/Cn/Li/Cp)的 normal 列与几何 Brahma 一致。
_NARAYANA_ORDER = {
    'Ar': {'normal': 'Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi',
           'sat':    'Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi',
           'ketu':   'Ar Pi Aq Cp Sg Sc Li Vi Le Cn Ge Ta'},
    'Ta': {'normal': 'Ta Sg Cn Aq Vi Ar Sc Ge Cp Le Pi Li',
           'sat':    'Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi Ar',
           'ketu':   'Ta Li Pi Le Cp Ge Sc Ar Vi Aq Cn Sg'},
    'Ge': {'normal': 'Ge Aq Li Vi Ta Cp Sg Le Ar Pi Sc Cn',
           'sat':    'Ge Cn Le Vi Li Sc Sg Cp Aq Pi Ar Ta',
           'ketu':   'Ge Li Aq Pi Cn Sc Sg Ar Le Vi Cp Ta'},
    'Cn': {'normal': 'Cn Ge Ta Ar Pi Aq Cp Sg Sc Li Vi Le',
           'sat':    'Cn Le Vi Li Sc Sg Cp Aq Pi Ar Ta Ge',
           'ketu':   'Cn Le Vi Li Sc Sg Cp Aq Pi Ar Ta Ge'},   # = sat(权威序表)
    'Le': {'normal': 'Le Cp Ge Sc Ar Vi Aq Cn Sg Ta Li Pi',
           'sat':    'Le Vi Li Sc Sg Cp Aq Pi Ar Ta Ge Cn',
           'ketu':   'Le Pi Li Ta Sg Cn Aq Vi Ar Sc Ge Cp'},
    'Vi': {'normal': 'Vi Cp Ta Ge Li Aq Pi Cn Sc Sg Ar Le',
           'sat':    'Vi Li Sc Sg Cp Aq Pi Ar Ta Ge Cn Le',
           'ketu':   'Vi Ta Cp Sg Le Ar Pi Sc Cn Ge Aq Li'},
    'Li': {'normal': 'Li Sc Sg Cp Aq Pi Ar Ta Ge Cn Le Vi',
           'sat':    'Li Sc Sg Cp Aq Pi Ar Ta Ge Cn Le Vi',
           'ketu':   'Li Vi Le Cn Ge Ta Ar Pi Aq Cp Sg Sc'},
    'Sc': {'normal': 'Sc Ge Cp Le Pi Li Ta Sg Cn Aq Vi Ar',
           'sat':    'Sc Sg Cp Aq Pi Ar Ta Ge Cn Le Vi Li',
           'ketu':   'Sc Ar Vi Aq Cn Sg Ta Li Pi Le Cp Ge'},
    'Sg': {'normal': 'Sg Le Ar Pi Sc Cn Ge Aq Li Vi Ta Cp',
           'sat':    'Sg Cp Aq Pi Ar Ta Ge Cn Le Vi Li Sc',
           'ketu':   'Sg Ar Le Vi Cp Ta Ge Li Aq Pi Cn Sc'},
    'Cp': {'normal': 'Cp Sg Sc Li Vi Le Cn Ge Ta Ar Pi Aq',
           'sat':    'Cp Aq Pi Ar Ta Ge Cn Le Vi Li Sc Sg',
           'ketu':   'Cp Aq Pi Ar Ta Ge Cn Le Vi Li Sc Sg'},   # = sat(权威序表)
    'Aq': {'normal': 'Aq Cn Sg Ta Li Pi Le Cp Ge Sc Ar Vi',
           'sat':    'Aq Pi Ar Ta Ge Cn Le Vi Li Sc Sg Cp',
           'ketu':   'Aq Vi Ar Sc Ge Cp Le Pi Li Ta Sg Cn'},
    'Pi': {'normal': 'Pi Cn Sc Sg Ar Le Vi Cp Ta Ge Li Aq',
           'sat':    'Pi Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq',
           'ketu':   'Pi Sc Cn Ge Aq Li Vi Ta Cp Sg Le Ar'},
}

# 两字 rasi 缩写 ↔ flatlib sign(Narayana 权威序表用)。
_NARAYANA_TOKEN = {
    'Ar': const.ARIES, 'Ta': const.TAURUS, 'Ge': const.GEMINI, 'Cn': const.CANCER,
    'Le': const.LEO, 'Vi': const.VIRGO, 'Li': const.LIBRA, 'Sc': const.SCORPIO,
    'Sg': const.SAGITTARIUS, 'Cp': const.CAPRICORN, 'Aq': const.AQUARIUS, 'Pi': const.PISCES,
}
_NARAYANA_TOKEN_REV = {v: k for k, v in _NARAYANA_TOKEN.items()}


def _narayana_table_order(seed_sign, column):
    """从权威序表取 seed 的某列(normal/sat/ketu)→ 12 个 flatlib sign。

    seed_sign 为 flatlib sign(如 const.ARIES)；内部用两字 token 索引序表。
    """
    row = _NARAYANA_ORDER[_NARAYANA_TOKEN_REV[seed_sign]]
    return [_NARAYANA_TOKEN[t] for t in row[column].split()]


def _brahma_order(seed_sign, direction):
    """动(chara)：从种子起逐宫(consecutive)，按 direction。

    权威序表里动宫种子(Ar/Cn/Li/Cp)的 normal 列与此几何序一致；保留几何实现供
    Saturn-强制顺(direction=1)等通用场景复用。
    """
    return [sign_at(index_of(seed_sign) + direction * i) for i in range(12)]


def _validate_narayana_table():
    """权威序表逐列自检：每列为 12 rasi 排列、首元 = 种子、sat 列 = 顺数 12 宫。

    模块导入即跑(末尾断言)。转录任一格错(重复/缺/首元错/sat 偏移错)立即 AssertionError。
    """
    full = set(SIGNS)
    for tok_seed, row in _NARAYANA_ORDER.items():
        seed = _NARAYANA_TOKEN[tok_seed]
        for col in ('normal', 'sat', 'ketu'):
            seq = _narayana_table_order(seed, col)
            assert len(seq) == 12, (tok_seed, col, 'len')
            assert set(seq) == full, (tok_seed, col, 'not a permutation')
            assert seq[0] == seed, (tok_seed, col, 'first != seed')
        # sat 列恒 = 从种子起黄道顺数 12 宫(Saturn 强制顺 Brahma)
        fwd = [sign_at(index_of(seed) + i) for i in range(12)]
        assert _narayana_table_order(seed, 'sat') == fwd, (tok_seed, 'sat != forward')


# ════════════════════════════════════════════════════════════════════════
# 2. Narayana dasha
# ════════════════════════════════════════════════════════════════════════

def narayana_dasha(lagna_sign, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Narayana(Padhanadhamsa)宫位大运。

    种子 = 强者(lagna 或 7 宫)；动定双 → Brahma/Shiva/Vishnu 序；
    方向由种子第 9 宫 奇足/偶足；异常：Saturn 在种子 → 强制顺 + Brahma；
    Ketu 在种子 → 方向反转。期长 = narayana_period_years；二轮 = 12 − 首。

    返回 {'system','seed','direction','order',
          'mahadashas':[{'rasi','rasiLabel','years','cycle','quality','lord'} …]}
    序列共 24 项(12 rasi × 2 轮)。
    逐格序取自权威序表 `_NARAYANA_ORDER`(全 12 种子 × normal/sat/ketu)；动/定/双宫
    (Brahma/Shiva/Vishnu)序均精确，含 Saturn/Ketu 在种子的两个异常列。
    """
    seventh = offset_sign(lagna_sign, 7)
    seed = stronger_sign(lagna_sign, seventh, planet_signs, strength_proxy, planet_lons, order=strength_order)
    q = quality(seed)

    # 方向(用于元数据；Saturn/Ketu 异常一并体现)
    direction = _direction_oddfooted(seed)
    sat_sign = _planet_sign(const.SATURN, planet_signs)
    ketu_sign = _planet_sign(const.SOUTH_NODE, planet_signs)
    force_brahma = (sat_sign == seed)
    if sat_sign == seed:
        direction = 1                                        # Saturn 在种子 → 强制顺
    if ketu_sign == seed:
        direction = -direction                               # Ketu 在种子 → 反向

    # 三神(动→Brahma / 定→Shiva / 双→Vishnu)；force_brahma 时一律 Brahma
    if force_brahma or q == 'movable':
        deity = 'Brahma'
    elif q == 'fixed':
        deity = 'Shiva'
    else:
        deity = 'Vishnu'

    # 逐格序由权威序表取列：Saturn 在种子→sat 列；否则 Ketu 在种子→ketu 列；否则 normal。
    if sat_sign == seed:
        column = 'sat'
    elif ketu_sign == seed:
        column = 'ketu'
    else:
        column = 'normal'
    order = _narayana_table_order(seed, column)

    first_years = {s: narayana_period_years(s, planet_signs, strength_proxy, planet_lons, strength_order=strength_order) for s in SIGNS}
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons, strength_order=strength_order)
    return {
        'system': 'Narayana',
        'seed': seed,
        'seventh': seventh,
        'deity': deity,
        'direction': 'forward' if direction == 1 else 'reverse',
        'order': list(order),
        'mahadashas': maha,
        'note': '逐格序取自权威序表(全 12 种子 × normal/sat/ketu)；动/定/双宫序均精确',
    }


def _assemble_two_cycles(order, first_years_map, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """把 12-rasi 序展开成两轮 mahadasha 列表(首轮 first_years，二轮 12−首)。"""
    out = []
    for cycle in (1, 2):
        for rasi in order:
            fy = first_years_map[rasi]
            years = fy if cycle == 1 else second_cycle_years(fy)
            out.append({
                'rasi': rasi,
                'years': years,
                'cycle': cycle,
                'quality': quality(rasi),
                'lord': _stronger_lord(rasi, planet_signs, strength_proxy, planet_lons, order=strength_order),
            })
    return out


# ════════════════════════════════════════════════════════════════════════
# 3. Lagna Kendradi dasha
# ════════════════════════════════════════════════════════════════════════

def _kendradi_order(seed_sign, direction):
    """Kendradi 序：kendra(1,4,7,10)→panaphara(2,5,8,11)→apoklima(3,6,9,12)，
    每组 4 宫内按 direction 自种子相对位置展开。

    取法：以种子为 1 宫起算，三组各取相对宫位 {1,4,7,10}/{2,5,8,11}/{3,6,9,12}，
    每组内相对宫位按 direction(顺/逆 黄道)折算成实际 rasi。
    """
    groups = [(1, 4, 7, 10), (2, 5, 8, 11), (3, 6, 9, 12)]
    seed_idx = index_of(seed_sign)
    order = []
    for grp in groups:
        for rel in grp:
            # 相对宫位 rel(1 = 种子本宫)沿 direction 折算：顺 = +(rel−1)，逆 = −(rel−1)。
            order.append(sign_at(seed_idx + direction * (rel - 1)))
    return order


def lagna_kendradi_dasha(lagna_sign, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Lagna Kendradi 宫位大运。

    种子 = 强者(L/7)；序 = kendra→panaphara→apoklima；方向由 lagna 奇/偶 **宫**
    (非奇足)，Saturn 在种子 → 顺 / Ketu → 逆；期长同 Narayana；二轮 = 12 − 首。
    """
    seventh = offset_sign(lagna_sign, 7)
    seed = stronger_sign(lagna_sign, seventh, planet_signs, strength_proxy, planet_lons, order=strength_order)
    direction = _direction_lagna_oddeven(lagna_sign)
    sat_sign = _planet_sign(const.SATURN, planet_signs)
    ketu_sign = _planet_sign(const.SOUTH_NODE, planet_signs)
    if sat_sign == seed:
        direction = 1
    if ketu_sign == seed:
        direction = -direction

    order = _kendradi_order(seed, direction)
    first_years = {s: narayana_period_years(s, planet_signs, strength_proxy, planet_lons, strength_order=strength_order) for s in SIGNS}
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons, strength_order=strength_order)
    return {
        'system': 'LagnaKendradi',
        'seed': seed,
        'seventh': seventh,
        'direction': 'forward' if direction == 1 else 'reverse',
        'order': list(order),
        'mahadashas': maha,
    }


def compute_brahma(lagna_sign, planet_signs, planet_lons=None, strength_order='standard'):
    """Brahma graha(§10.5 Jaimini 2-1-49 主流读法,印度占星大运体系_完整技术参考_中英对照.md:1966-1969):
    ①取 Lagna/7 强者 R;②在 R 之 6/8/12 宫主中取最强(以其所居 rāśi 之 Jaimini 强弱为代理);
    ③排除 Saturn/Rahu/Ketu;④平局偏奇象 viṣama(奇数座)。Brahma 座 = 所选 graha 所居 rāśi → Sthira 起座。
    缺 planet_signs / 候选全被排除 → None(不臆造)。"""
    if not planet_signs:
        return None
    seventh = offset_sign(lagna_sign, 7)
    ref = stronger_sign(lagna_sign, seventh, planet_signs, None, planet_lons, order=strength_order)
    excluded = {const.SATURN, const.NORTH_NODE, const.SOUTH_NODE}
    cands = []
    for house in (6, 8, 12):
        csign = offset_sign(ref, house)
        lord = SIGN_LORDS.get(csign)
        if lord is None or lord in excluded:
            continue
        lsign = _planet_sign(lord, planet_signs)
        if lsign is None:
            continue
        cands.append((lord, lsign, house, csign))
    if not cands:
        return None
    best = cands[0]
    for c in cands[1:]:
        cmpv = sign_strength_compare(c[1], best[1], planet_signs, planet_lons, order=strength_order)
        if cmpv > 0 or (cmpv == 0 and index_of(c[1]) % 2 == 0 and index_of(best[1]) % 2 != 0):
            best = c        # 更强;平局偏奇象(viṣama)
    lord, lsign, house, csign = best
    return {'planet': lord, 'sign': lsign, 'ref': ref, 'fromHouse': house,
            'lordSign': csign, 'candidateSigns': [offset_sign(ref, h) for h in (6, 8, 12)]}


def sthira_dasha(lagna_sign, brahma=None):
    """Sthira(固定)大运(§5.2):定长 rāśi 运,动7/固8/变9(总 96 年)。
    起座默认 Lagna(KN Rao 通行简法);方向 = 起座足性(奇足顺/偶足逆)。
    brahma 非空 → 自 Brahma 座起(BPHS,§5.2/§10.5);默认 None 时与原行为字节一致(零回归)。"""
    start_sign = lagna_sign
    start_mode = 'lagna'
    if brahma and brahma.get('sign') is not None:
        start_sign = brahma['sign']
        start_mode = 'brahma'
    direction = 1 if start_sign in ODD_FOOTED else -1
    seed_idx = index_of(start_sign)
    order = [sign_at(seed_idx + direction * i) for i in range(12)]
    years_by_modality = (7, 8, 9)        # movable(动)/fixed(固)/dual(变) = 座序 %3
    maha = []
    cum = 0
    for s in order:
        y = years_by_modality[index_of(s) % 3]
        maha.append({'rasi': s, 'years': y, 'startAge': cum, 'endAge': cum + y})
        cum += y
    res = {
        'system': 'Sthira',
        'startMode': start_mode,
        'startSign': start_sign,
        'direction': 'forward' if direction == 1 else 'reverse',
        'order': list(order),
        'totalYears': cum,
        'mahadashas': maha,
        'note': '起座默认 Lagna(通行简法);Brahma 起座为变体(BPHS:Lagna/7强者之6/8/12宫主,排除土罗计,取最强偏奇象)。',
    }
    if start_mode == 'brahma':
        res['brahma'] = brahma
    return res


def yogardha_dasha(lagna_sign, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Yogārdha(平均)大运(§5.5):每座年 =(Sthira 该座 + Narayana 该座)÷2;序随 Narayana(变动运)。"""
    nar = narayana_dasha(lagna_sign, planet_signs, strength_proxy, planet_lons,
                         strength_order=strength_order)   # 座序亦须随用户口径(曾漏传恒 standard)
    order = nar.get('order') or [m['rasi'] for m in nar.get('mahadashas', [])[:12]]
    sthira_y = (7, 8, 9)
    maha = []
    cum = 0.0
    for s in order:
        ny = narayana_period_years(s, planet_signs, strength_proxy, planet_lons, strength_order=strength_order)
        sy = sthira_y[index_of(s) % 3]
        y = (ny + sy) / 2.0
        maha.append({'rasi': s, 'years': y, 'startAge': cum, 'endAge': cum + y})
        cum += y
    return {
        'system': 'Yogardha',
        'base': 'narayana',
        'order': list(order),
        'totalYears': cum,
        'mahadashas': maha,
        'note': '每座年 =(Sthira+Narayana)/2;序随 Narayana 变动运。',
    }


def manduka_dasha(lagna_sign):
    """Maṇḍūka(蛙跳)大运(§5.5):Lagna 奇足→起 Lagna 顺;偶足→起第7逆。
    序 = kendra→panaphara→apoklima(每组 +3 蛙跳);年长 7/8/9 按类型(总 96)。"""
    odd = lagna_sign in ODD_FOOTED
    seed = lagna_sign if odd else offset_sign(lagna_sign, 7)
    direction = 1 if odd else -1
    order = _kendradi_order(seed, direction)
    sthira_y = (7, 8, 9)
    maha = []
    cum = 0
    for s in order:
        y = sthira_y[index_of(s) % 3]
        maha.append({'rasi': s, 'years': y, 'startAge': cum, 'endAge': cum + y})
        cum += y
    return {
        'system': 'Manduka',
        'seed': seed,
        'direction': 'forward' if direction == 1 else 'reverse',
        'order': list(order),
        'totalYears': cum,
        'mahadashas': maha,
        'note': '蛙跳序(kendra/+3);年长 7/8/9 按类型;奇足起 Lagna、偶足起第7逆。',
    }


# ════════════════════════════════════════════════════════════════════════
# 4. Sudasa dasha
# ════════════════════════════════════════════════════════════════════════

def sudasa_dasha(sree_lagna_sign, sree_lagna_signlon, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Sudasa(繁荣大运)。

    与 Lagna Kendradi 同骨架，但种子 = **Sree Lagna 所在 rasi**；方向由 SL 奇/偶宫；
    首运余比 =(30 − SL 宿内度)/30(SL 宿内度 = SL 在其 rasi 内的度，0-30)。
    首运实际年 = 首运期长 × 余比；其余同 Narayana 期长；二轮 = 12 − 首。

    sree_lagna_sign: SL 所在 rasi；sree_lagna_signlon: SL 在该 rasi 内度数(0-30)。
    """
    seed = sree_lagna_sign
    direction = _direction_lagna_oddeven(seed)
    sat_sign = _planet_sign(const.SATURN, planet_signs)
    ketu_sign = _planet_sign(const.SOUTH_NODE, planet_signs)
    if sat_sign == seed:
        direction = 1
    if ketu_sign == seed:
        direction = -direction

    order = _kendradi_order(seed, direction)
    first_years = {s: narayana_period_years(s, planet_signs, strength_proxy, planet_lons, strength_order=strength_order) for s in SIGNS}
    balance_ratio = (30.0 - (float(sree_lagna_signlon) % 30.0)) / 30.0
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons, strength_order=strength_order)
    # 首运按余比缩短(只影响第 0 项 years)
    if maha:
        maha[0] = dict(maha[0])
        maha[0]['fullYears'] = maha[0]['years']
        maha[0]['years'] = round(maha[0]['years'] * balance_ratio, 4)
        maha[0]['balanceRatio'] = round(balance_ratio, 4)
    return {
        'system': 'Sudasa',
        'seed': seed,
        'direction': 'forward' if direction == 1 else 'reverse',
        'sreeLagnaSignlon': round(float(sree_lagna_signlon) % 30.0, 4),
        'firstBalanceRatio': round(balance_ratio, 4),
        'order': list(order),
        'mahadashas': maha,
    }


# ════════════════════════════════════════════════════════════════════════
# 5. Drigdasa
# ════════════════════════════════════════════════════════════════════════

def drigdasa(lagna_sign, planet_signs, strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Drigdasa：自 9 宫起，三组「9/10/11 宫 + 各自 rasi-drishti 所照 3 宫」。

    每组 = [seed 宫] + [seed 所照的 3 rasi]，共 4 rasi；三组依 9→10→11 宫排。
    每组方向由该组 seed 奇足/偶足；期长同 Narayana；二轮 = 12 − 首。

    rasi_drishti 返回该 rasi 照见的 rasi 列表(动→定/定→动[除邻]/双→双)。一个动/定 rasi
    恰照 3 个，双 rasi 照 3 个 → 每组 1 seed + 3 照 = 4 rasi，三组共 12。
    组内 4 rasi 的先后次序(seed + 3 照)由该组 **seed 自身奇足/偶足** 定方向，非强弱：
      奇足种子(Ar/Ta/Ge/Li/Sc/Sg)→ 从种子起黄道顺序(forward)列 4 宫；
      偶足种子(Cn/Le/Vi/Cp/Aq/Pi)→ 逆黄道(backward)列 4 宫。
    对照算例核：9 宫 = Ge(奇足)→顺→ Ge,Vi,Sg,Pi；10 宫 = Cn(偶足)→逆→ Cn,Ta,Aq,Sc；
    11 宫 = Le(偶足)→逆→ Le,Ar,Cp,Li。
    """
    seeds = [offset_sign(lagna_sign, 9), offset_sign(lagna_sign, 10), offset_sign(lagna_sign, 11)]
    first_years = {s: narayana_period_years(s, planet_signs, strength_proxy, planet_lons, strength_order=strength_order) for s in SIGNS}
    groups = []
    order = []
    for seed in seeds:
        aspected = rasi_drishti(seed)                         # 该 rasi 所照(通常 3 个)
        # 方向由 seed 自身奇足/偶足(非种子第 9 宫)：奇足顺、偶足逆。
        direction = 1 if seed in ODD_FOOTED else -1
        grp = _sorted_by_direction([seed] + aspected, seed, direction)
        groups.append({
            'seed': seed,
            'direction': 'forward' if direction == 1 else 'reverse',
            'signs': grp,
        })
        order.extend(grp)
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons, strength_order=strength_order)
    return {
        'system': 'Drigdasa',
        'groups': groups,
        'order': list(order),
        'mahadashas': maha,
        'note': '组内 4 宫次序按种子自身奇足(顺)/偶足(逆)方向(权威对照算例核定)',
    }


def _sorted_by_direction(signs, seed, direction):
    """把 signs(含 seed)按从 seed 起的黄道方向(direction=+1 顺/−1 逆)的宫距排序。

    seed 距离恒 0 排首；direction=+1 → 顺黄道宫距升序；−1 → 逆黄道宫距升序。
    用于 Drigdasa 组内 4 宫排序(方向 = 种子奇足顺/偶足逆)。
    """
    def key(s):
        if direction == 1:
            return (index_of(s) - index_of(seed)) % 12
        return (index_of(seed) - index_of(s)) % 12
    return sorted(signs, key=key)


# ════════════════════════════════════════════════════════════════════════
# 6. Niryana Shoola
# ════════════════════════════════════════════════════════════════════════

# 动/定/双 → 7/8/9 年(首三和 = 24)。
_NIRYANA_YEARS = {'movable': 7, 'fixed': 8, 'dual': 9}


def niryana_shoola_dasha(lagna_sign, planet_signs, strength_proxy=None, hora_lagna_sign=None, planet_lons=None, strength_order='standard'):
    """Niryana Shoola 大运。

    种子 = 强者(2 宫 / 8 宫)；**奇 rasi 顺 / 偶 rasi 逆**(整序方向)；
    期长动/定/双 = 7/8/9 年(每连续 3 宫和 = 24)；
    死亡择时用 Trishoola / Rudra(maraka，primitives.rudra_candidate_signs/trishoola)。

    返回含 'maraka':{'rudraCandidates','trishoola'}(死亡择时参考 rasi)。
    """
    second = offset_sign(lagna_sign, 2)
    eighth = offset_sign(lagna_sign, 8)
    seed = stronger_sign(second, eighth, planet_signs, strength_proxy, planet_lons, order=strength_order)
    direction = 1 if seed in ODD_SIGNS else -1               # 奇顺偶逆(按 rasi 奇偶)

    order = [sign_at(index_of(seed) + direction * i) for i in range(12)]
    maha = []
    for rasi in order:
        maha.append({
            'rasi': rasi,
            'years': _NIRYANA_YEARS[quality(rasi)],
            'quality': quality(rasi),
            'lord': _stronger_lord(rasi, planet_signs, strength_proxy, planet_lons, order=strength_order),
        })

    # 死亡择时(P-f)：Rudra 两候选 + Trishoola 三角。强弱择一交调用方/UI。
    rudra_a, rudra_b = rudra_candidate_signs(lagna_sign)
    rudra = stronger_sign(rudra_a, rudra_b, planet_signs, strength_proxy, planet_lons, order=strength_order)
    return {
        'system': 'NiryanaShoola',
        'seed': seed,
        'second': second,
        'eighth': eighth,
        'direction': 'forward' if direction == 1 else 'reverse',
        'order': list(order),
        'mahadashas': maha,
        'maraka': {
            'rudraCandidates': [rudra_a, rudra_b],
            'rudra': rudra,
            'trishoola': trishoola(rudra),
        },
    }


# ════════════════════════════════════════════════════════════════════════
# 7. Shoola dasha + 亲属变体
# ════════════════════════════════════════════════════════════════════════

# 亲属变体起宫(相对 lagna)：本人 1/7；其余从对应宫起。
SHOOLA_VARIANTS = {
    'self': (1, 7),       # 命主(lagna/7 取强)
    'pitri': (9, 3),      # 父
    'bhratri': (3, 9),    # 兄弟
    'matri': (4, 10),     # 母
    'dara': (7, 1),       # 配偶
    'putra': (5, 11),     # 子
}


def shoola_dasha(lagna_sign, planet_signs, strength_proxy=None, variant='self', planet_lons=None, strength_order='standard'):
    """Shoola 大运。

    种子 = 强者(由 variant 决定的两宫，默认 self = L/7)；**恒黄道顺**；每运 9 年、
    12 子运各 9 月。亲属变体 Pitri/Bhratri/Matri/Dara/Putra 改种子两宫。

    返回 12 项 mahadasha，各 9 年(总 108)。
    """
    a, b = SHOOLA_VARIANTS.get(variant, (1, 7))
    sign_a = offset_sign(lagna_sign, a)
    sign_b = offset_sign(lagna_sign, b)
    seed = stronger_sign(sign_a, sign_b, planet_signs, strength_proxy, planet_lons, order=strength_order)
    order = [sign_at(index_of(seed) + i) for i in range(12)]  # 恒顺
    maha = [{
        'rasi': rasi,
        'years': 9,
        'quality': quality(rasi),
        'lord': _stronger_lord(rasi, planet_signs, strength_proxy, planet_lons, order=strength_order),
    } for rasi in order]
    return {
        'system': 'Shoola',
        'variant': variant,
        'seed': seed,
        'direction': 'forward',
        'order': list(order),
        'mahadashas': maha,
    }


def shoola_sub_periods(maha_rasi):
    """某 Shoola 主运(9 年)的 12 子运：自主运 rasi 起恒顺 12 rasi，各 9 月(= 0.75 年)。"""
    return [{
        'rasi': sign_at(index_of(maha_rasi) + i),
        'months': 9,
        'years': 0.75,
    } for i in range(12)]


# ════════════════════════════════════════════════════════════════════════
# 8. Kalachakra dasha —— 全表已转录(27 宿×4 pada)
# ════════════════════════════════════════════════════════════════════════
#
# Kalachakra 是最复杂的 rasi dasha。三组权威数表均已逐格转录：
#   - savya / apasavya 宿组划分(KALACHAKRA_GROUPS，覆盖全 27 宿)
#   - 每 nakshatra × pada 的 9-rasi 序 + deha + jeeva + paramayush(KALACHAKRA_PADA_TABLE，
#     按 4 子组 × 4 pada 组织；同子组各宿共享同一组 pada 表)
#   - 各宫主对应期长(KALACHAKRA_PERIOD_BY_LORD)
# 不变量自检：每 pada 9 rasi 的宫主期长和 == paramayush(见测试)。

# ── 期长表(按 dasa rasi 之主；已转录权威源)————————————————
KALACHAKRA_PERIOD_BY_LORD = {
    const.SUN: 5,       # Le
    const.MOON: 21,     # Cn
    const.MARS: 7,      # Ar & Sc
    const.MERCURY: 9,   # Ge & Vi
    const.JUPITER: 10,  # Sg & Pi
    const.VENUS: 16,    # Ta & Li
    const.SATURN: 4,    # Cp & Aq
}


def kalachakra_period_years(rasi):
    """某 dasa rasi 的 Kalachakra 期长(年)= 该 rasi 主星对应年数(宫主期长表)。

    双主宫(Sc=火/计, Aq=土/罗)：Kalachakra 用传统主(火/土)的年数(节点无独立年数)。
    """
    lord = SIGN_LORDS[rasi]
    return KALACHAKRA_PERIOD_BY_LORD.get(lord)


def kalachakra_paramayush(rasi_sequence):
    """某 pada 的 9-rasi 序的总寿(paramayush)= 9 rasi 期长之和。

    用作不变量自检：序内 9 rasi 的宫主期长之和应 = 该 pada 的 paramayush(权威值)。
    """
    return sum((kalachakra_period_years(r) or 0) for r in rasi_sequence)


# ── savya / apasavya 宿组(宿组划分表；按宿名归组)——————————————————————————
# 宿组划分(宿名与 astrostudy.nakshatra.NAKSHATRAS 一致)。savya/apasavya 大类由宿序按
# 「3 个 savya / 3 个 apasavya」交替块决定；每大类再分 1/2 子组(对应权威 pada 对照表的
# 两张子表)。子组归属是权威数表给定项，须逐项落表(权威对照算例核定，下表为正确划分)：
#   Savya-1   : Ashwini, Krittika, Punarvasu, Ashlesha, Hasta, Swati, Mula, U.Ashadha,
#               P.Bhadrapada, Revati
#   Savya-2   : Bharani, Pushya, Chitra, P.Ashadha, U.Bhadrapada
#   Apasavya-1: Rohini, Magha, Vishakha, Shravana
#   Apasavya-2: Mrigashira, Ardra, P.Phalguni, U.Phalguni, Anuradha, Jyeshtha, Dhanishta, Shatabhisha
#
# Revati 归属(权威依据)：Revati 用 Savya-1 的 pada 表(pada1 = Ar Ta Ge Cn Le Vi Li Sc Sg、
# deha Ar / jeeva Sg / paramayush 100)，故落 Savya-1。Uttara Bhadrapada 用 Savya-2 的
# pada 表(pada1 = Sc Li Vi Cn Le Ge Ta Ar Pi、deha Sc)，故落 Savya-2。两者经权威对照
# 算例逐格核定。补全后 _nak_group 覆盖全 27 宿。
KALACHAKRA_GROUPS = {
    'savya1': ['Ashwini', 'Krittika', 'Punarvasu', 'Ashlesha', 'Hasta', 'Swati', 'Mula',
               'Uttara Ashadha', 'Purva Bhadrapada', 'Revati'],
    'savya2': ['Bharani', 'Pushya', 'Chitra', 'Purva Ashadha', 'Uttara Bhadrapada'],
    'apasavya1': ['Rohini', 'Magha', 'Vishakha', 'Shravana'],
    'apasavya2': ['Mrigashira', 'Ardra', 'Purva Phalguni', 'Uttara Phalguni', 'Anuradha',
                  'Jyeshtha', 'Dhanishta', 'Shatabhisha'],
}
KALACHAKRA_SAVYA = {'savya1', 'savya2'}
KALACHAKRA_APASAVYA = {'apasavya1', 'apasavya2'}


def _kc_sign(token):
    """两字 rasi token → flatlib sign(如 'Ar'→Aries)。对照表用缩写填写，便于逐格转录。"""
    return _KC_TOKEN.get(token)


_KC_TOKEN = {
    'Ar': const.ARIES, 'Ta': const.TAURUS, 'Ge': const.GEMINI, 'Cn': const.CANCER,
    'Le': const.LEO, 'Vi': const.VIRGO, 'Li': const.LIBRA, 'Sc': const.SCORPIO,
    'Sg': const.SAGITTARIUS, 'Cp': const.CAPRICORN, 'Aq': const.AQUARIUS, 'Pi': const.PISCES,
}


# ── 逐 pada 9-rasi 序 + deha/jeeva/paramayush(4 子组 × 4 pada 全转录)──────
# 结构：{group: {pada(1-4): {'seq':[9 tokens], 'deha':token, 'jeeva':token, 'paramayush':int}}}
# 这 4 子组(savya1/2, apasavya1/2)的 pada 1-4 均按权威对照表逐格转录；同子组内各宿
# 共享同一组 pada 表(故 27 宿经 KALACHAKRA_GROUPS 归到 4 子组即得各自 pada 序)。
# 不变量：每行 9 rasi 的宫主期长(KALACHAKRA_PERIOD_BY_LORD)和 == paramayush。
KALACHAKRA_PADA_TABLE = {
    'savya1': {  # savya 第 1 组
        1: {'seq': ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg'],
            'deha': 'Ar', 'jeeva': 'Sg', 'paramayush': 100},
        2: {'seq': ['Cp', 'Aq', 'Pi', 'Sc', 'Li', 'Vi', 'Cn', 'Le', 'Ge'],
            'deha': 'Cp', 'jeeva': 'Ge', 'paramayush': 85},
        3: {'seq': ['Ta', 'Ar', 'Pi', 'Aq', 'Cp', 'Sg', 'Ar', 'Ta', 'Ge'],
            'deha': 'Ta', 'jeeva': 'Ge', 'paramayush': 83},
        4: {'seq': ['Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'],
            'deha': 'Cn', 'jeeva': 'Pi', 'paramayush': 86},
    },
    'savya2': {  # savya 第 2 组
        1: {'seq': ['Sc', 'Li', 'Vi', 'Cn', 'Le', 'Ge', 'Ta', 'Ar', 'Pi'],
            'deha': 'Sc', 'jeeva': 'Pi', 'paramayush': 100},
        2: {'seq': ['Aq', 'Cp', 'Sg', 'Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi'],
            'deha': 'Aq', 'jeeva': 'Vi', 'paramayush': 85},
        3: {'seq': ['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Sc', 'Li', 'Vi'],
            'deha': 'Li', 'jeeva': 'Vi', 'paramayush': 83},
        4: {'seq': ['Cn', 'Le', 'Ge', 'Ta', 'Ar', 'Pi', 'Aq', 'Cp', 'Sg'],
            'deha': 'Cn', 'jeeva': 'Sg', 'paramayush': 86},
    },
    'apasavya1': {  # apasavya 第 1 组
        1: {'seq': ['Sg', 'Cp', 'Aq', 'Pi', 'Ar', 'Ta', 'Ge', 'Le', 'Cn'],
            'deha': 'Cn', 'jeeva': 'Sg', 'paramayush': 86},
        2: {'seq': ['Vi', 'Li', 'Sc', 'Pi', 'Aq', 'Cp', 'Sg', 'Sc', 'Li'],
            'deha': 'Li', 'jeeva': 'Vi', 'paramayush': 83},
        3: {'seq': ['Vi', 'Le', 'Cn', 'Ge', 'Ta', 'Ar', 'Sg', 'Cp', 'Aq'],
            'deha': 'Aq', 'jeeva': 'Vi', 'paramayush': 85},
        4: {'seq': ['Pi', 'Ar', 'Ta', 'Ge', 'Le', 'Cn', 'Vi', 'Li', 'Sc'],
            'deha': 'Sc', 'jeeva': 'Pi', 'paramayush': 100},
    },
    'apasavya2': {  # apasavya 第 2 组
        1: {'seq': ['Pi', 'Aq', 'Cp', 'Sg', 'Sc', 'Li', 'Vi', 'Le', 'Cn'],
            'deha': 'Cn', 'jeeva': 'Pi', 'paramayush': 86},
        2: {'seq': ['Ge', 'Ta', 'Ar', 'Sg', 'Cp', 'Aq', 'Pi', 'Ar', 'Ta'],
            'deha': 'Ta', 'jeeva': 'Ge', 'paramayush': 83},
        3: {'seq': ['Ge', 'Le', 'Cn', 'Vi', 'Li', 'Sc', 'Pi', 'Aq', 'Cp'],
            'deha': 'Cp', 'jeeva': 'Ge', 'paramayush': 85},
        4: {'seq': ['Sg', 'Sc', 'Li', 'Vi', 'Le', 'Cn', 'Ge', 'Ta', 'Ar'],
            'deha': 'Ar', 'jeeva': 'Sg', 'paramayush': 100},
    },
}


def _nak_group(nak_name):
    """宿名 → KALACHAKRA_GROUPS 的组键(savya1/savya2/apasavya1/apasavya2)，无则 None。"""
    for group, names in KALACHAKRA_GROUPS.items():
        if nak_name in names:
            return group
    return None


def kalachakra_pada_sequence(nak_name, pada):
    """某宿某 pada 的 9-rasi 序 + deha/jeeva/paramayush(从已转录对照表取)。

    返回 {'group','savya','seq'(9 个 flatlib sign),'deha','jeeva','paramayush'}；
    宿名未知(非 27 宿之一)→ None(优雅降级)。
    """
    group = _nak_group(nak_name)
    if group is None:
        return None
    entry = KALACHAKRA_PADA_TABLE.get(group, {}).get(int(pada))
    if not entry:
        return None
    seq = [_kc_sign(t) for t in entry['seq']]
    return {
        'group': group,
        'savya': group in KALACHAKRA_SAVYA,
        'seq': seq,
        'deha': _kc_sign(entry['deha']),
        'jeeva': _kc_sign(entry['jeeva']),
        'paramayush': entry['paramayush'],
    }


def _within_pada_fraction(moon_lon):
    """从月 sidereal 黄经求「月在其所在 pada 内的进度比」(0-1)。

    一宿 = 360/27°，分 4 pada(各 1/4 宿)。Kalachakra 起运按「月在当前 pada 内已过比例」
    × paramayush 定出生前已过寿命(权威 Ex. 月 15°50′Ta = Rohini pada2 内 0.75)。
    注意：此与「月在整宿内进度」不同(整宿进度 ×4 取小数部分才是 pada 内进度)。
    """
    nak_span = 360.0 / 27.0
    val = float(moon_lon) % 360.0
    idx = min(26, int(val / nak_span))
    nak_prog = (val - idx * nak_span) / nak_span     # 整宿进度 0-1
    return (nak_prog * 4.0) % 1.0                     # pada 内进度 0-1


# Kalachakra 三 gati(pada 序列内的固有跳;BPHS 46.101-111 权威对):
#   蛙跳 Manduka:Savya Virgo→Cancer / Leo→Gemini;Apasavya Gemini→Leo / Cancer→Virgo
#   猴跳 Markata:Savya Cancer→Leo;Apasavya Leo→Cancer
#   狮顾 Simhavalokana(120°):Pisces→Scorpio / Sagittarius→Aries(savya↔apasavya 换向处)
_KC_GATI_SAVYA = {(const.VIRGO, const.CANCER): 'manduka', (const.LEO, const.GEMINI): 'manduka',
                  (const.CANCER, const.LEO): 'markata'}
_KC_GATI_APASAVYA = {(const.GEMINI, const.LEO): 'manduka', (const.CANCER, const.VIRGO): 'manduka',
                     (const.LEO, const.CANCER): 'markata'}
_KC_GATI_ANY = {(const.PISCES, const.SCORPIO): 'simhavalokana',
                (const.SAGITTARIUS, const.ARIES): 'simhavalokana'}
_KC_GATI_CN = {'manduka': '蛙跳', 'markata': '猴跳', 'simhavalokana': '狮顾'}


def _kc_gati_of(prev_rasi, rasi, savya):
    """相邻两大运座间的 gati 类型(无跳 → None)。按权威 pair 精确匹配。"""
    pair = (prev_rasi, rasi)
    g = _KC_GATI_ANY.get(pair)
    if g:
        return g
    return (_KC_GATI_SAVYA if savya else _KC_GATI_APASAVYA).get(pair)


def _kc_next_pada(nak_name, pada, cycle_method):
    """轮终换接:给出下一轮所用 (宿名, pada)。

    carry(法1,默认):同 savya/apasavya 组内推进——pada+1;宿末(pada4)→ 组内下一宿 pada1;
      组末宿 pada4 → 组首宿 pada1。🔴 绝不跨 savya↔apasavya 组。
    same_nak_carry(法3):同宿 pada+1(pada4→pada1,宿不变)。
    repeat(法2)/reset(法4):停留本 pada(两法在轮级延展下输出一致;细部权威未详,注明)。
    """
    if cycle_method == 'same_nak_carry':
        return nak_name, (int(pada) % 4) + 1
    if cycle_method in ('repeat', 'reset'):
        return nak_name, int(pada)
    # carry:组内 (宿, pada) 全序推进
    group = _nak_group(nak_name)
    if group is None:
        return nak_name, int(pada)
    names = list(KALACHAKRA_GROUPS[group])
    try:
        ni = names.index(nak_name)
    except ValueError:
        return nak_name, int(pada)
    pi = int(pada)
    if pi < 4:
        return nak_name, pi + 1
    return names[(ni + 1) % len(names)], 1


def kalachakra_dasha(moon_lon, nak_name, pada, nak_progress=None, cycle_method='carry',
                     applicability='universal', moon_rasi_sign=None, moon_d9_sign=None,
                     planet_signs=None, planet_lons=None):
    """Kalachakra 大运。

    程序：月宿 pada → 取该 pada 的 9-rasi 序 + paramayush → 月在 pada 内进度比 ×
    paramayush = 出生前已过 → 定起运 rasi + 余年；子运从 dasa rasi 起 9 个、按 宫主期长表
    比例。各 rasi 期长 = kalachakra_period_years(宫主期长表)。

    9-rasi 序 / deha / jeeva / paramayush 取自对照表(KALACHAKRA_PADA_TABLE，27 宿×4 pada
    全覆盖)；起运 rasi + 余年由 moon_lon 求出的「pada 内进度比」算(权威算例核对过)。

    moon_lon: 月 sidereal 黄经(0-360；用于求 pada 内进度+起运)；nak_name: 月宿名；
    pada: 1-4；nak_progress: 显式覆盖「pada 内进度比」(0-1，可选；缺省由 moon_lon 求)。
    """
    info = kalachakra_pada_sequence(nak_name, pada)
    if info is None:
        return {
            'available': False,
            'reason': 'kalachakra_pada_table_incomplete',  # 宿名非 27 宿之一(无效输入)→ 优雅降级
            'system': 'Kalachakra',
            'nakshatra': nak_name,
            'pada': pada,
        }
    seq = info['seq']
    paramayush = info['paramayush']
    maha = []
    prev = None
    for rasi in seq:
        gati = _kc_gati_of(prev, rasi, info['savya']) if prev is not None else None
        item = {
            'rasi': rasi,
            'years': kalachakra_period_years(rasi),
            'quality': quality(rasi),
            'lord': SIGN_LORDS[rasi],
        }
        if gati:
            item['gati'] = gati
            item['gatiCN'] = _KC_GATI_CN.get(gati)
        maha.append(item)
        prev = rasi

    result = {
        'available': True,
        'system': 'Kalachakra',
        'nakshatra': nak_name,
        'pada': pada,
        'group': info['group'],
        'savya': info['savya'],
        'sequence': list(seq),
        'deha': info['deha'],
        'jeeva': info['jeeva'],
        'paramayush': paramayush,
        'sumOfPeriods': kalachakra_paramayush(seq),    # 应 == paramayush(不变量)
        'mahadashas': maha,
        'note': '9-rasi 序/deha/jeeva/paramayush 取自对照表(27 宿×4 pada 全覆盖，已逐格核)',
        'cycleMethod': cycle_method,
    }
    # 轮终换接预览(法1 进位/法3 同宿进位/法2·法4 停留;差异仅首轮 ~83-100 年后显现)。
    nxt_nak, nxt_pada = _kc_next_pada(nak_name, int(pada), cycle_method)
    nxt_info = kalachakra_pada_sequence(nxt_nak, nxt_pada)
    if nxt_info:
        result['nextCycle'] = {
            'method': cycle_method,
            'nakshatra': nxt_nak,
            'pada': nxt_pada,
            'sequence': list(nxt_info['seq']),
            'paramayush': nxt_info['paramayush'],
        }
        if cycle_method in ('repeat', 'reset'):
            result['nextCycle']['note'] = '循环/归零两法在轮级延展下输出一致(细部权威未详)'
    # 适用条件(变体):月亮 navamsa 座强于 rasi 座才启用;判据用星座逐级强弱链。
    if applicability == 'navamsa_stronger':
        appl = None
        if moon_rasi_sign is not None and moon_d9_sign is not None and planet_signs:
            try:
                appl = sign_strength_compare(moon_d9_sign, moon_rasi_sign, planet_signs, planet_lons) > 0
            except Exception:
                appl = None
        result['applicability'] = {
            'mode': 'navamsa_stronger',
            'applicable': appl,
            'note': '月亮 navamsa 座强于 rasi 座才主用(判据不足时为 null;不禁算,仅标注)',
        }

    # 起运 rasi + 余年。pada 内进度优先用显式 nak_progress，否则由 moon_lon 求。
    pada_frac = nak_progress
    if pada_frac is None and moon_lon is not None:
        pada_frac = _within_pada_fraction(moon_lon)
    if pada_frac is not None and paramayush:
        elapsed_years = float(pada_frac) * paramayush        # 出生前已过的寿命量
        cursor = 0.0
        start_index = 0
        balance = 0.0
        for i, rasi in enumerate(seq):
            span = kalachakra_period_years(rasi) or 0
            if cursor + span > elapsed_years:
                start_index = i
                balance = (cursor + span) - elapsed_years    # 起运 rasi 剩余年
                break
            cursor += span
        result['startRasi'] = seq[start_index]
        result['startBalanceYears'] = round(balance, 4)
        result['elapsedYears'] = round(elapsed_years, 4)
        result['padaProgress'] = round(float(pada_frac), 4)

    return result


# ════════════════════════════════════════════════════════════════════════
# 9. 顶层聚合(供 compute() 接 'rasiDasha' 键)
# ════════════════════════════════════════════════════════════════════════

def tara_lagna_dasha(lagna_sign, moon_lon):
    """Tāra Lagna Daśā（Jaimini Nakṣatra Daśā，均匀 9 年/座 = 108）。
    Tāra Lagna：宿跨 13°20′÷12 = 1°6′40″；取月在本宿已行弧,商 = floor(已行÷单位);
    TL 宫 = 商+1(自本命 Lagna 数),该宫之座 = TL。方向:TL 奇象(动/固/变中奇序)→顺、偶象→逆。
    每座均匀 9 年,12 座绕一轮 = 108。"""
    if lagna_sign is None or moon_lon is None:
        return {'available': False, 'reason': 'missing_lagna_or_moon'}
    nak_span = 360.0 / 27.0           # 13°20′ = 13.3333°
    unit = nak_span / 12.0            # 1°6′40″ = 1.11111°
    arc = float(moon_lon) % nak_span
    quotient = min(11, max(0, int(arc / unit)))      # 0..11
    tl_sign = offset_sign(lagna_sign, quotient + 1)   # 自 Lagna 数第 (商+1) 宫
    tl_idx = SIGN_INDEX[tl_sign]
    direction = 1 if tl_sign in ODD_SIGNS else -1     # TL 奇象→顺、偶象→逆
    maha = []
    for i in range(12):
        s = SIGNS[(tl_idx + i * direction) % 12]
        maha.append({'rasi': s, 'years': 9, 'startYear': i * 9, 'endYear': (i + 1) * 9})
    return {
        'available': True,
        'system': 'TaraLagna',
        'taraLagna': tl_sign,
        'taraLagnaHouse': quotient + 1,
        'direction': 'forward' if direction == 1 else 'reverse',
        'totalYears': 108,
        'mahadashas': maha,
    }


# ════════════════════════════════════════════════════════════════════════
# 8b. 新增座运:Chakra(Parashara)/Trikona/Navamsa(D-9)/Varnada + Paryaya 二轮
# ════════════════════════════════════════════════════════════════════════

def chakra_dasha_parashara(lagna_sign, lagna_lord_sign, second_sign, moon_lord_sign=None,
                           is_day=None, lagna_signlon=None, day_start_rule='bphs'):
    """Chakra 大运(BPHS 46.50-51 逐字):每座恒 10 年、严格顺黄道无跳、总 120。

    起座(bphs 默认):夜生=Lagna 座 / 昼生=Lagna 主星所在座 / 黄昏=第 2 宫座。
    反转变体(流行一系):昼=月亮座主所在座 / 夜=Lagna 主所在座 / 黄昏=第 2 宫主所在座——
    此处黄昏窗定义权威未详,按昼/夜二分(is_day),黄昏态不判(note 注明)。
    首运余数(次源):上升座内未行弧,整度×4=月、余分×2=日。
    中运:每 10 年等分 12 座(首中运=大运座,顺行)。
    """
    if is_day is None:
        start = lagna_sign
        start_note = 'day_state_unknown_fallback_lagna'
    elif day_start_rule == 'reversed':
        start = (moon_lord_sign if is_day else lagna_lord_sign) or lagna_sign
        start_note = 'reversed(昼=月座主所在座/夜=Lagna主所在座)'
    else:
        start = (lagna_lord_sign if is_day else lagna_sign) or lagna_sign
        start_note = 'bphs(夜=Lagna座/昼=Lagna主座;黄昏窗未判,二分近似)'
    if start is None:
        return {'available': False, 'reason': 'missing_start_sign', 'system': 'Chakra'}
    seed_idx = index_of(start)
    maha = []
    for i in range(12):
        rasi = sign_at(seed_idx + i)
        item = {'rasi': rasi, 'years': 10,
                'quality': quality(rasi), 'lord': SIGN_LORDS[rasi],
                'antardashas': [{'rasi': sign_at(index_of(rasi) + k), 'years': 10.0 / 12.0}
                                for k in range(12)]}
        maha.append(item)
    out = {'available': True, 'system': 'Chakra', 'label': 'Chakra(每座 10 年·顺行)',
           'startRasi': start, 'startRule': day_start_rule, 'startNote': start_note,
           'totalYears': 120, 'mahadashas': maha}
    if lagna_signlon is not None:
        try:
            rem = 30.0 - (float(lagna_signlon) % 30.0)
            deg = int(rem)
            mins = (rem - deg) * 60.0
            out['startBalance'] = {'months': deg * 4, 'days': round(mins * 2.0, 2),
                                   'note': '上升座内未行弧:整度×4=月/余分×2=日(次源)'}
        except (TypeError, ValueError):
            pass
    return out


def trikona_dasha(lagna_sign, planet_signs, strength_proxy=None, planet_lons=None,
                  strength_order='standard'):
    """Trikona 大运:起 = Lagna/7 强者;方向按起座足性(奇足顺/偶足逆);
    序 = 三角三联组(起座组→沿方向逐组),组内按星座强度降序;期长同 Narayana(数到主−1)。
    二轮 = 12−首轮补足。"""
    seventh = offset_sign(lagna_sign, 7)
    seed = stronger_sign(lagna_sign, seventh, planet_signs, strength_proxy, planet_lons, order=strength_order)
    direction = 1 if seed in ODD_FOOTED else -1
    si = index_of(seed)
    order = []
    for g in range(4):                      # 4 个三角组:锚 = seed + direction*g
        grp = [sign_at(si + direction * g + direction * 4 * t) for t in range(3)]
        # 组内按星座强度降序(两两比较冒泡;平局保持三角序=稳定)
        ranked = list(grp)
        for i in range(2):
            for j in range(2 - i):
                if sign_strength_compare(ranked[j + 1], ranked[j], planet_signs, planet_lons,
                                         order=strength_order) > 0:
                    ranked[j], ranked[j + 1] = ranked[j + 1], ranked[j]
        order.extend(ranked)
    first_years = {r: narayana_period_years(r, planet_signs, strength_proxy, planet_lons,
                                            strength_order=strength_order) for r in order}
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons,
                                strength_order=strength_order)
    return {'available': True, 'system': 'Trikona', 'seed': seed,
            'direction': 'forward' if direction == 1 else 'reverse',
            'order': order, 'mahadashas': maha,
            'note': '三角三联组·组内强度序·期长同 Narayana(数到主−1)'}


def navamsa_dasha_d9(d9_lagna_sign, d9_planet_signs, d9_planet_lons=None,
                     strength_proxy=None, strength_order='standard'):
    """Navamsa 大运 = 在 D-9 盘上跑 Narayana(起 = D9 Lagna/7 强者;全部输入用 D9 位置)。"""
    res = narayana_dasha(d9_lagna_sign, d9_planet_signs, strength_proxy, d9_planet_lons,
                         strength_order=strength_order)
    if isinstance(res, dict):
        res['system'] = 'NavamsaDasha'
        res['label'] = 'Navamsa 大运(D-9 上跑 Narayana)'
        res['varga'] = 'D9'
    return res


def varnada_dasha(vl_sign, planet_signs, strength_proxy=None, planet_lons=None,
                  period_rule='count_to_lord', strength_order='standard'):
    """Varnada 大运:起 = Varnada Lagna 座;方向 = VL 奇象顺/偶象逆;
    期长 = 数到座主(Narayana 同核);等长变体期长权威未详 → 回落 count-to-lord 并注明。"""
    if vl_sign is None:
        return {'available': False, 'reason': 'missing_varnada_lagna', 'system': 'Varnada'}
    direction = 1 if vl_sign in ODD_SIGNS else -1
    si = index_of(vl_sign)
    order = [sign_at(si + direction * i) for i in range(12)]
    # 期长两派:count_to_lord=数至宫主(Narayana 同式);equal_nine=每座恒 9 年(等长派,
    # 首轮总 108、二轮 12−9=3)。🔴 曾为空开关:选 equal_nine 年数逐字不变、回显还写
    # count_to_lord —— 开关必须真改数,回显必须如实。
    rule = period_rule if period_rule in ('count_to_lord', 'equal_nine') else 'count_to_lord'
    if rule == 'equal_nine':
        first_years = {r: 9.0 for r in order}
    else:
        first_years = {r: narayana_period_years(r, planet_signs, strength_proxy, planet_lons,
                                                strength_order=strength_order) for r in order}
    maha = _assemble_two_cycles(order, first_years, planet_signs, strength_proxy, planet_lons,
                                strength_order=strength_order)
    out = {'available': True, 'system': 'Varnada', 'seed': vl_sign,
           'direction': 'forward' if direction == 1 else 'reverse',
           'order': order, 'periodRule': rule, 'mahadashas': maha}
    if rule == 'equal_nine':
        out['note'] = '等长变体:每座首轮恒 9 年(总 108),二轮 12−9=3'
    return out


def paryaya_extension(mahadashas):
    """Paryaya 二轮:每座二轮期长 = 12 − 首轮;自座 12 者仍 12(不塌 0)。
    双轮和:常规座恒 12(全盘 144);首轮 12 之特例座双轮 24(总和随特例座数抬高)。"""
    out = []
    for m in mahadashas or []:
        y = m.get('years')
        if y is None:
            continue
        y2 = 12 if y == 12 else (12 - y)
        row = dict(m)
        row['years'] = y2
        row['cycle'] = 2
        row.pop('antardashas', None)
        out.append(row)
    return out


def chara_sthira_paryaya(chara_result, sthira_result, lagna_sign, planet_signs,
                         strength_proxy=None, planet_lons=None, strength_order='standard'):
    """Chara/Sthira Paryaya(Sampat 富运,注疏系):
    Chara Paryaya:trikona(自 Lagna 1/5/9)无行星则废;成立时 = Chara 序二轮(12−首轮)。
    Sthira Paryaya:自 Lagna/7 强者起的 Sthira 序二轮(动7/固8/变9 恒值,二轮同值)。"""
    out = {}
    tri_signs = {offset_sign(lagna_sign, k) for k in (1, 5, 9)}
    tri_occupied = any(ps in tri_signs for ps in (planet_signs or {}).values())
    if not tri_occupied:
        out['charaParyaya'] = {'available': False, 'reason': 'trikona_unoccupied',
                               'note': '自 Lagna 三角(1/5/9)无行星 → Chara Paryaya 废(注疏规则)'}
    elif chara_result and chara_result.get('mahadashas'):
        out['charaParyaya'] = {'available': True, 'system': 'CharaParyaya',
                               'mahadashas': paryaya_extension(chara_result['mahadashas']),
                               'note': '二轮=12−首轮;常规座双轮和 12,自座 12 之特例座仍 12(双轮 24)'}
    else:
        out['charaParyaya'] = {'available': False, 'reason': 'missing_chara'}
    # Sthira Paryaya:起座 = Lagna/7 强者;7/8/9 定值二轮同值
    seventh = offset_sign(lagna_sign, 7)
    seed = stronger_sign(lagna_sign, seventh, planet_signs, strength_proxy, planet_lons, order=strength_order)
    st = sthira_dasha(seed)
    if st and st.get('mahadashas'):
        out['sthiraParyaya'] = {'available': True, 'system': 'SthiraParyaya', 'seed': seed,
                                'mahadashas': [dict(m, cycle=2) for m in st['mahadashas']],
                                'note': '自 Lagna/7 强者起;定值(动7/固8/变9)二轮同值'}
    else:
        out['sthiraParyaya'] = {'available': False, 'reason': 'sthira_unavailable'}
    return out


def build_rasi_dashas(inputs, strength_proxy=None):
    """聚合所有 rasi dasha。inputs 为简单 dict(由排盘引擎填)，键：

      lagna_sign          : ASC 所在 rasi(必填)
      planet_signs        : {planet_id: sign}(7 曜 + 罗计；用于种子/期长/强弱)
      planet_lons         : {planet_id: 黄经}(可选；逐级强弱判据末级「宫内推进度」用，
                            罗/计自宫末量起；缺则该末级不决、退到「取首候选」)
      sree_lagna_sign     : SL 所在 rasi(Sudasa 用；缺则跳过 Sudasa)
      sree_lagna_signlon  : SL 在该 rasi 内度数 0-30(Sudasa 用)
      moon_lon            : 月 sidereal 黄经(Kalachakra 记录)
      moon_nak_name       : 月宿名(Kalachakra 用)
      moon_pada           : 月所在 pada 1-4(Kalachakra 用)
      moon_nak_progress   : 月在 pada 内进度比 0-1(Kalachakra 起运用，可选)

    返回 {'narayana','lagnaKendradi','sudasa','drigdasa','niryanaShoola','shoola',
          'kalachakra'}。缺输入的项给 {'available': False}。
    """
    lagna = inputs.get('lagna_sign')
    planet_signs = inputs.get('planet_signs') or {}
    planet_lons = inputs.get('planet_lons')      # 可选；缺则逐级强弱判据末级(宫内推进度)不决
    if lagna is None:
        return {'available': False, 'reason': 'missing_lagna'}

    _dv = inputs.get('dashaVariants') or {}
    _order = _dv.get('jaiminiStrengthOrder', 'standard')
    _sthira_start = (inputs.get('sthira_start') or 'lagna')
    _brahma = compute_brahma(lagna, planet_signs, planet_lons, strength_order=_order) if _sthira_start == 'brahma' else None

    out = {
        'available': True,
        'narayana': narayana_dasha(lagna, planet_signs, strength_proxy, planet_lons, strength_order=_order),
        'lagnaKendradi': lagna_kendradi_dasha(lagna, planet_signs, strength_proxy, planet_lons, strength_order=_order),
        'drigdasa': drigdasa(lagna, planet_signs, strength_proxy, planet_lons, strength_order=_order),
        'niryanaShoola': niryana_shoola_dasha(lagna, planet_signs, strength_proxy, planet_lons=planet_lons, strength_order=_order),
        'shoola': shoola_dasha(lagna, planet_signs, strength_proxy, planet_lons=planet_lons, strength_order=_order),
        'taraLagna': tara_lagna_dasha(lagna, inputs.get('moon_lon')),
        'sthira': sthira_dasha(lagna, brahma=_brahma),
        'yogardha': yogardha_dasha(lagna, planet_signs, strength_proxy, planet_lons, strength_order=_order),
        'manduka': manduka_dasha(lagna),
    }

    sl_sign = inputs.get('sree_lagna_sign')
    sl_lon = inputs.get('sree_lagna_signlon')
    if sl_sign is not None and sl_lon is not None:
        out['sudasa'] = sudasa_dasha(sl_sign, sl_lon, planet_signs, strength_proxy, planet_lons, strength_order=_order)
    else:
        out['sudasa'] = {'available': False, 'reason': 'missing_sree_lagna'}

    # ── 新增座运(附加输出键;输入缺省即优雅降级)──────────────────────
    out['chakra'] = chakra_dasha_parashara(
        lagna, inputs.get('lagna_lord_sign'), offset_sign(lagna, 2),
        moon_lord_sign=inputs.get('moon_lord_sign'), is_day=inputs.get('is_day'),
        lagna_signlon=inputs.get('lagna_signlon'),
        day_start_rule=_dv.get('chakraDayStart', 'bphs'))
    out['trikona'] = trikona_dasha(lagna, planet_signs, strength_proxy, planet_lons,
                                   strength_order=_order)
    d9_lagna = inputs.get('d9_lagna_sign')
    d9_signs = inputs.get('d9_planet_signs')
    if d9_lagna and d9_signs:
        out['navamsaDasha'] = navamsa_dasha_d9(d9_lagna, d9_signs, inputs.get('d9_planet_lons'),
                                               strength_proxy, strength_order=_order)
    else:
        out['navamsaDasha'] = {'available': False, 'reason': 'missing_d9_inputs'}
    out['varnada'] = varnada_dasha(inputs.get('varnada_lagna_sign'), planet_signs,
                                   strength_proxy, planet_lons,
                                   period_rule=_dv.get('varnadaPeriodRule', 'count_to_lord'),
                                   strength_order=_order)
    out['paryaya'] = chara_sthira_paryaya(inputs.get('chara_result'), None, lagna, planet_signs,
                                          strength_proxy, planet_lons, strength_order=_order)

    nak_name = inputs.get('moon_nak_name')
    pada = inputs.get('moon_pada')
    if nak_name is not None and pada is not None:
        # 不转发 moon_nak_progress(那是「整宿进度」，非 Kalachakra 所需的「pada 内进度」)；
        # 让 kalachakra_dasha 从 moon_lon 求 pada 内进度，权威算例核对一致。
        out['kalachakra'] = kalachakra_dasha(
            inputs.get('moon_lon', 0.0), nak_name, pada,
            cycle_method=_dv.get('kalachakraCycle', 'carry'),
            applicability=_dv.get('kalachakraApplicability', 'universal'),
            moon_rasi_sign=(planet_signs or {}).get(const.MOON),
            moon_d9_sign=inputs.get('moon_d9_sign'),
            planet_signs=planet_signs, planet_lons=planet_lons)
    else:
        out['kalachakra'] = {'available': False, 'reason': 'missing_moon_nakshatra'}

    return out


# 模块导入即对权威序表做结构自检(转录错立即暴露，不拖到运行期)。
_validate_narayana_table()
