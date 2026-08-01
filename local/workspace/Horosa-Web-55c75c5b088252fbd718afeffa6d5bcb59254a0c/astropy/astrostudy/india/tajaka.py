# -*- coding: utf-8 -*-
"""印度占星 年度盘（Tajaka / Varshaphala）后端引擎。

> 设计：本模块**不做天文求根**。年度盘的天球求根（太阳回归 / solar return）由调用方
>       (websrv 接线层) 用 Swiss Ephemeris 精确求得，再把「已算数据」喂进本模块的纯函数：
>         - 年度盘各行星星座 + sidereal 黄经 dict
>         - 本命 lagna（用于 Muntha）+ 年度盘 lagna
>         - 目标年龄（完成年数）/ 是否日生（年首在昼）等
>       本模块只做**确定式 Jyotika 几何/规则**，便于纯单测、不耦合排盘内部状态。

包含（均落标准转录，公式来源见各节注释，坐标 rasi Ar=1..Pi=12，经度 sidereal 0-360）：
  - Muntha：本命 lagna 起、以 1 rasi/年 推进 →（年龄 mod 12）宫。
  - 年主（Varsheswara / lord of the year）：5 候选 + Triraasi 表 + Pancha-Vargeeya bala 取强。
  - Tajaka 相位（trinal/sextile/square/conjunction/opposition/semi-sextile）+ Deeptamsa orb。
  - Tajaka 16 瑜伽（Ithasala / Ishrafa(Eesarpha) 等，速度序 + 逆行规则）。
  - Harsha bala（4 源）。
  - Pancha-Vargeeya bala（Kshetra/Uchcha/Hadda/Drekkana/Navamsa；Hadda 界主表）。
  - Sahams（36 个；公式 A−B+C，**夜生翻转 B−A+C**，+30° 仅当 C 不在 B→A 弧内）。
  - 年度大运框架（Patyayini / Mudda[Varsha-Vimshottari] / Varsha-Narayana）——骨架 + 期长比例。

公共安全：注释/标识符/测试名不出现书名/作者/章节号；用中性「权威转录」描述。
"""

from astrostudy.india import primitives as prim

try:
    from flatlib import const
except Exception:  # pragma: no cover - flatlib 缺失时的退化路径（仅供静态导入）
    const = None


# ════════════════════════════════════════════════════════════════════════
# 0. 行星/星座基础（与 jyotish_engine 对齐，避免循环导入只取所需）
# ════════════════════════════════════════════════════════════════════════
# 七曜（Tajaka 只用七曜 + lagna；节点不参与 Harsha/Pancha-Vargeeya/年主）。
SEVEN_PLANETS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY,
    const.JUPITER, const.VENUS, const.SATURN,
] if const else []

# 星座主星（rasi lord）。
SIGN_LORD = {
    const.ARIES: const.MARS, const.TAURUS: const.VENUS, const.GEMINI: const.MERCURY,
    const.CANCER: const.MOON, const.LEO: const.SUN, const.VIRGO: const.MERCURY,
    const.LIBRA: const.VENUS, const.SCORPIO: const.MARS, const.SAGITTARIUS: const.JUPITER,
    const.CAPRICORN: const.SATURN, const.AQUARIUS: const.SATURN, const.PISCES: const.JUPITER,
} if const else {}

# 旺/落点（深旺：星座 + 度数）。深落 = 旺点对宫同度。
EXALTATION = {
    const.SUN: (const.ARIES, 10.0), const.MOON: (const.TAURUS, 3.0),
    const.MARS: (const.CAPRICORN, 28.0), const.MERCURY: (const.VIRGO, 15.0),
    const.JUPITER: (const.CANCER, 5.0), const.VENUS: (const.PISCES, 27.0),
    const.SATURN: (const.LIBRA, 20.0),
} if const else {}

# 阴阳曜（Harsha bala 第 3/4 源、年首昼夜）：阳 = 日/火/木；阴 = 月/水/金/土。
MASCULINE = {const.SUN, const.MARS, const.JUPITER} if const else set()
FEMININE = {const.MOON, const.MERCURY, const.VENUS, const.SATURN} if const else set()


def _lon(x):
    return float(x) % 360.0


def _signlon(lon):
    """行星在其所在 rasi 内的度数（0-30，advancement / krisamsa）。"""
    return float(lon) % 30.0


def _sign_of_lon(lon):
    return prim.SIGNS[int(_lon(lon) // 30.0) % 12]


def sign_lord(sign):
    return SIGN_LORD.get(sign)


# ════════════════════════════════════════════════════════════════════════
# 1. Muntha（本命 lagna 起，1 rasi/年）
# ════════════════════════════════════════════════════════════════════════
def muntha(natal_lagna_sign, age_completed):
    """Muntha = 本命 lagna 起、以 1 rasi/年 推进的星座。

    权威转录：完成 N 年（进入第 N+1 年）→ 年度盘 Muntha 在本命 lagna 起的「第 (N mod 12)+1 宫」。
    即推进宫数 = (age_completed mod 12)，本命 lagna 自身对应 age=0（第 1 宫）。

    返回 {'sign','houseFromNatalLagna'}。houseFromNatalLagna = 1..12。
    不变量：houseFromNatalLagna - 1 == age_completed mod 12。
    """
    steps = int(age_completed) % 12
    sign = prim.offset_sign(natal_lagna_sign, steps + 1)  # offset_sign n=1 即本宫
    return {
        'sign': sign,
        'lord': sign_lord(sign),
        'houseFromNatalLagna': steps + 1,
    }


def muntha_house_in_annual(muntha_sign, annual_lagna_sign):
    """Muntha 相对年度盘 lagna 的宫位（1..12）——书用此判吉凶（9/10/11 极佳…6/8/12 凶）。"""
    return prim.house_distance(annual_lagna_sign, muntha_sign)


# ════════════════════════════════════════════════════════════════════════
# 2. Tajaka 相位 + Deeptamsa（orb）
# ════════════════════════════════════════════════════════════════════════
# Deeptamsa（相位的 orb，单位度）——权威转录。
DEEPTAMSA = {
    const.SUN: 15.0, const.MOON: 12.0, const.MARS: 8.0, const.MERCURY: 7.0,
    const.JUPITER: 9.0, const.VENUS: 7.0, const.SATURN: 9.0,
} if const else {}

# Tajaka 6 类相位（按「目标宫距 from 行星」）：宫距 → (类别, 性质)。
# 三分(5/9)强吉、六分(3/11)弱吉、四分(4/10)弱凶、对冲(7)强凶、合(1)强凶、半六分(2/12)中性。
_ASPECT_BY_DISTANCE = {
    5: ('trinal', 'benefic_strong'), 9: ('trinal', 'benefic_strong'),
    3: ('sextile', 'benefic_weak'), 11: ('sextile', 'benefic_weak'),
    4: ('square', 'malefic_weak'), 10: ('square', 'malefic_weak'),
    7: ('opposition', 'malefic_strong'),
    1: ('conjunction', 'malefic_strong'),
    2: ('semisextile', 'neutral'), 12: ('semisextile', 'neutral'),
}


def tajaka_aspect_type(from_sign, to_sign):
    """两 rasi 间的 Tajaka 相位类别/性质（仅看宫距，不含 orb）。
    返回 {'distance','aspect','nature'} 或 None（宫距 6/8 无 Tajaka 相位）。"""
    dist = prim.house_distance(from_sign, to_sign)
    info = _ASPECT_BY_DISTANCE.get(dist)
    if info is None:
        return None
    return {'distance': dist, 'aspect': info[0], 'nature': info[1]}


def _aspect_arc_overlap(a_lon, b_lon):
    """A 对 B 所在 rasi 的相位若按 Deeptamsa 投影，A 投影到目标 rasi 的「中心度」
    = A 在本 rasi 的 advancement（书：度数相同位置投影）。返回 (a_adv, b_adv)。"""
    return _signlon(a_lon), _signlon(b_lon)


def within_deeptamsa(a_planet, a_lon, b_planet, b_lon):
    """A 与 B 是否互在对方 Deeptamsa（orb）内——按各自 advancement 差与两 orb 比较。
    书：相位 orb 投影到目标 rasi 同度数附近 ±Deeptamsa；互含 = 两曜 advancement 差 < 各自 orb。"""
    a_adv, b_adv = _aspect_arc_overlap(a_lon, b_lon)
    # advancement 差 = 距精确相位角的偏差(线性 0..30,不环绕)。
    # 🔴 曾写 min(diff, 30-diff):29° 与 1° 被折成「差 2°」——实际黄经差距精角 28°,
    #    环绕制造假命中(itthasala/短名单据此误产)。
    diff = abs(a_adv - b_adv)
    oa = DEEPTAMSA.get(a_planet)
    ob = DEEPTAMSA.get(b_planet)
    if oa is None or ob is None:
        return False
    # 互在对方 orb 内：A 在 B 的 orb 内 且 B 在 A 的 orb 内。
    return diff < ob and diff < oa


def planet_aspects(planet_signs, planet_lons):
    """全对七曜的 Tajaka 相位矩阵：[{'a','b','aspect','nature','distance','withinOrb'}]。
    withinOrb 仅在有相位类别且互在 Deeptamsa 内时 True（无相位类别时 None）。"""
    out = []
    planets = [p for p in SEVEN_PLANETS if p in planet_signs and p in planet_lons]
    for i, a in enumerate(planets):
        for b in planets[i + 1:]:
            info = tajaka_aspect_type(planet_signs[a], planet_signs[b])
            if info is None:
                continue
            row = dict(info)
            row['a'] = a
            row['b'] = b
            row['withinOrb'] = within_deeptamsa(a, planet_lons[a], b, planet_lons[b])
            out.append(row)
    return out


# ════════════════════════════════════════════════════════════════════════
# 3. Harsha bala（4 源；满分 20，各源 5）
# ════════════════════════════════════════════════════════════════════════
# 源 1：各曜「喜乐宫」（Harsha 专属位置，from 年度盘 lagna）。权威转录。
_HARSHA_HOUSE = {
    const.SUN: 9, const.MOON: 3, const.MARS: 6, const.MERCURY: 1,
    const.JUPITER: 11, const.VENUS: 5, const.SATURN: 12,
} if const else {}
# 源 3：阴曜喜 1/2/3/7/8/9 宫；阳曜喜 4/5/6/10/11/12 宫（from lagna）。
_FEMININE_HOUSES = {1, 2, 3, 7, 8, 9}
_MASCULINE_HOUSES = {4, 5, 6, 10, 11, 12}


def _is_exalted_or_own(planet, sign, signlon):
    """该曜在此星座是否「旺或庙」（Harsha 源 2 / 各处强弱用）。"""
    if planet in SIGN_LORD.values() and SIGN_LORD.get(sign) == planet:
        # own：该 rasi 主星即此曜（更稳妥：用 OWN 集合）
        pass
    own = (sign_lord(sign) == planet)
    exalt = False
    if planet in EXALTATION:
        ex_sign, _ = EXALTATION[planet]
        exalt = (sign == ex_sign)
    return own or exalt


def harsha_bala(planet_signs, planet_lons, annual_lagna_sign, day_birth):
    """七曜 Harsha bala（喜乐之力）。

    4 源各 5 分：
      (1) 在各曜「喜乐宫」(from lagna)。
      (2) 旺或庙。
      (3) 阴曜在 1/2/3/7/8/9 宫、阳曜在 4/5/6/10/11/12 宫(from lagna)。
      (4) 年首昼 → 阳曜各 +5；年首夜 → 阴曜各 +5。
    返回 {planet: {'total','sources':[s1,s2,s3,s4]}}。total≤20。
    """
    out = {}
    for p in SEVEN_PLANETS:
        if p not in planet_signs:
            continue
        sign = planet_signs[p]
        signlon = _signlon(planet_lons.get(p, 0.0))
        house = prim.house_distance(annual_lagna_sign, sign)
        s1 = 5 if _HARSHA_HOUSE.get(p) == house else 0
        s2 = 5 if _is_exalted_or_own(p, sign, signlon) else 0
        if p in FEMININE:
            s3 = 5 if house in _FEMININE_HOUSES else 0
        else:
            s3 = 5 if house in _MASCULINE_HOUSES else 0
        if day_birth:
            s4 = 5 if p in MASCULINE else 0
        else:
            s4 = 5 if p in FEMININE else 0
        out[p] = {'total': s1 + s2 + s3 + s4, 'sources': [s1, s2, s3, s4]}
    return out


# ════════════════════════════════════════════════════════════════════════
# 4. Pancha-Vargeeya bala（5 源 → 和/4）
# ════════════════════════════════════════════════════════════════════════
# Hadda（界）主表：每 rasi 5 段 (上界度, 主星)。权威转录（界主表）。
def _hl(*pairs):
    return list(pairs)


HADDA_LORDS = {
    const.ARIES: _hl((6, const.JUPITER), (12, const.VENUS), (20, const.MERCURY), (25, const.MARS), (30, const.SATURN)),
    const.TAURUS: _hl((8, const.VENUS), (14, const.MERCURY), (22, const.JUPITER), (27, const.SATURN), (30, const.MARS)),
    const.GEMINI: _hl((6, const.MERCURY), (12, const.VENUS), (17, const.JUPITER), (24, const.MARS), (30, const.SATURN)),
    const.CANCER: _hl((7, const.MARS), (13, const.VENUS), (19, const.MERCURY), (26, const.JUPITER), (30, const.SATURN)),
    const.LEO: _hl((6, const.JUPITER), (11, const.VENUS), (18, const.SATURN), (24, const.MERCURY), (30, const.MARS)),
    const.VIRGO: _hl((7, const.MERCURY), (17, const.VENUS), (21, const.JUPITER), (28, const.MARS), (30, const.SATURN)),
    const.LIBRA: _hl((6, const.SATURN), (14, const.MERCURY), (21, const.JUPITER), (28, const.VENUS), (30, const.MARS)),
    const.SCORPIO: _hl((7, const.MARS), (11, const.VENUS), (19, const.MERCURY), (24, const.JUPITER), (30, const.SATURN)),
    const.SAGITTARIUS: _hl((12, const.JUPITER), (17, const.VENUS), (21, const.MERCURY), (26, const.MARS), (30, const.SATURN)),
    const.CAPRICORN: _hl((7, const.MERCURY), (14, const.JUPITER), (22, const.VENUS), (26, const.SATURN), (30, const.MARS)),
    const.AQUARIUS: _hl((7, const.MERCURY), (13, const.VENUS), (20, const.JUPITER), (25, const.MARS), (30, const.SATURN)),
    const.PISCES: _hl((12, const.VENUS), (16, const.JUPITER), (19, const.MERCURY), (28, const.MARS), (30, const.SATURN)),
} if const else {}


# Hadda 学说B:等 6° 五分(少数注家,可选)。奇座 火/土/木/水/金,偶座反序;日月同样永不为界主。
HADDA_EQUAL6_ODD = ('Mars', 'Saturn', 'Jupiter', 'Mercury', 'Venus')
HADDA_EQUAL6_EVEN = tuple(reversed(HADDA_EQUAL6_ODD))
_ODD_SIGN_NAMES = {'Aries', 'Gemini', 'Leo', 'Libra', 'Sagittarius', 'Aquarius'}


def hadda_lord(sign, signlon, scheme='egyptian'):
    """该 rasi + advancement 落在的界主。"""
    if scheme == 'equal6':
        seq = HADDA_EQUAL6_ODD if sign in _ODD_SIGN_NAMES else HADDA_EQUAL6_EVEN
        seg = min(4, int(float(signlon) // 6.0))
        return seq[seg]
    for upper, lord in HADDA_LORDS.get(sign, []):
        if signlon < upper:
            return lord
    bands = HADDA_LORDS.get(sign)
    return bands[-1][1] if bands else None


def _relation_simple(viewer, target):
    """简化自然友谊（Pancha-Vargeeya bala 用 friend/enemy/neutral）。复合关系另由 primitives 提供。"""
    if viewer == target:
        return 'self'
    return prim.natural_relation(viewer, target)


def _kshetra_bala(planet, sign):
    """Kshetra bala（rasi 强度）：庙 30 / 友 15 / 敌 7.5；中性取友敌之间(11.25)。"""
    lord = sign_lord(sign)
    if lord == planet:
        return 30.0
    rel = _relation_simple(planet, lord)
    if rel == 'friend':
        return 15.0
    if rel == 'enemy':
        return 7.5
    return 11.25  # neutral：友敌中点（书未单列中性值 → 取友敌均值，结构性占位）  # 待书值


def _uchcha_bala(planet, lon):
    """Uchcha bala（旺力）：与深落点角距/180×20。深落 = 深旺对宫同度。"""
    if planet not in EXALTATION:
        return 0.0
    ex_sign, ex_deg = EXALTATION[planet]
    ex_lon = prim.SIGN_INDEX[ex_sign] * 30.0 + ex_deg
    deb_lon = (ex_lon + 180.0) % 360.0
    diff = abs(_lon(lon) - deb_lon)
    if diff > 180.0:
        diff = 360.0 - diff
    return 20.0 * (diff / 180.0)


def _hadda_bala(planet, sign, signlon, scheme='egyptian'):
    """Hadda bala：自界 15 / 友界 7.5 / 敌界 3.75。"""
    lord = hadda_lord(sign, signlon, scheme)
    if lord == planet:
        return 15.0
    rel = _relation_simple(planet, lord)
    if rel == 'friend':
        return 7.5
    if rel == 'enemy':
        return 3.75
    return (7.5 + 3.75) / 2.0  # neutral 占位  # 待书值


def _drekkana_bala(planet, d3_sign):
    """Drekkana bala（D-3）：自 10 / 友 5 / 敌 2.5。d3_sign 由调用方按 D-3 算法给出。"""
    lord = sign_lord(d3_sign)
    if lord == planet:
        return 10.0
    rel = _relation_simple(planet, lord)
    if rel == 'friend':
        return 5.0
    if rel == 'enemy':
        return 2.5
    return (5.0 + 2.5) / 2.0  # neutral 占位  # 待书值


def _navamsa_bala(planet, d9_sign):
    """Navamsa bala（D-9）：自 5 / 友 2.5 / 敌 1.25。d9_sign 由调用方按 D-9 算法给出。"""
    lord = sign_lord(d9_sign)
    if lord == planet:
        return 5.0
    rel = _relation_simple(planet, lord)
    if rel == 'friend':
        return 2.5
    if rel == 'enemy':
        return 1.25
    return (2.5 + 1.25) / 2.0  # neutral 占位  # 待书值


def pancha_vargeeya_bala(planet, sign, lon, d3_sign=None, d9_sign=None, hadda_scheme='egyptian'):
    """Pancha-Vargeeya bala = (Kshetra + Uchcha + Hadda + Drekkana + Navamsa) / 4。

    d3_sign/d9_sign 缺省时该子源记 0（调用方应传 D-3/D-9 星座以求全量）。
    返回 {'kshetra','uchcha','hadda','drekkana','navamsa','total'}。
    """
    signlon = _signlon(lon)
    k = _kshetra_bala(planet, sign)
    u = _uchcha_bala(planet, lon)
    h = _hadda_bala(planet, sign, signlon, hadda_scheme)
    dre = _drekkana_bala(planet, d3_sign) if d3_sign else 0.0
    nav = _navamsa_bala(planet, d9_sign) if d9_sign else 0.0
    total = (k + u + h + dre + nav) / 4.0
    return {'kshetra': k, 'uchcha': round(u, 4), 'hadda': h,
            'drekkana': dre, 'navamsa': nav, 'total': round(total, 4)}


# ════════════════════════════════════════════════════════════════════════
# 5. 年主（Varsheswara / lord of the year）
# ════════════════════════════════════════════════════════════════════════
# Triraasi 主表：lagna rasi × (昼,夜) → 主星。权威转录（三分主表）。
TRIRAASI_LORDS = {
    const.ARIES: (const.SUN, const.JUPITER), const.TAURUS: (const.VENUS, const.MOON),
    const.GEMINI: (const.SATURN, const.MERCURY), const.CANCER: (const.VENUS, const.MARS),
    const.LEO: (const.JUPITER, const.SUN), const.VIRGO: (const.MOON, const.VENUS),
    const.LIBRA: (const.MERCURY, const.SATURN), const.SCORPIO: (const.MARS, const.VENUS),
    const.SAGITTARIUS: (const.SATURN, const.SATURN), const.CAPRICORN: (const.MARS, const.MARS),
    const.AQUARIUS: (const.JUPITER, const.JUPITER), const.PISCES: (const.MOON, const.MOON),
} if const else {}


def triraasi_lord(lagna_sign, day_birth):
    pair = TRIRAASI_LORDS.get(lagna_sign)
    if not pair:
        return None
    return pair[0] if day_birth else pair[1]


def year_lord_candidates(natal_lagna_sign, annual_lagna_sign, muntha_sign,
                         sun_sign, moon_sign, day_birth):
    """年主 5 候选（权威转录）：
      (1) 年首昼取 Sun 所在 rasi 之主 / 夜取 Moon 所在 rasi 之主。
      (2) 本命 lagna 之主。
      (3) Muntha 之主。
      (4) 年度盘 lagna 之主。
      (5) 年度盘 lagna 的 Triraasi 主。
    返回有序 list（含重复曜则各候选独立计），每项 {'rule','planet'}。
    """
    luminary_sign = sun_sign if day_birth else moon_sign
    cands = [
        {'rule': 1, 'planet': sign_lord(luminary_sign)},
        {'rule': 2, 'planet': sign_lord(natal_lagna_sign)},
        {'rule': 3, 'planet': sign_lord(muntha_sign)},
        {'rule': 4, 'planet': sign_lord(annual_lagna_sign)},
        {'rule': 5, 'planet': triraasi_lord(annual_lagna_sign, day_birth)},
    ]
    return cands


def select_year_lord(candidates, annual_lagna_sign, planet_signs, planet_lons,
                     pancha_bala_by_planet, d3_signs=None, d9_signs=None):
    """从 5 候选选年主（fallback 链，权威转录）：
      A. 短名单 = 对年度盘 lagna 有「吉相位」类别(trinal/sextile)的候选(orb 细判需
         lagna 度数,本实现以座位类别为准,与 _aspect_to_lagna 一致)；
         其中 Pancha-Vargeeya bala 最高者胜；并列时「在更多候选类别中出现」者胜。
      B. 若无吉相位候选 → 接受有恶相位的候选（同样取最强）。
      C. 若全无对 lagna 的相位 → 取 Pancha-Vargeeya bala 极强者。
      D. 否则 → 取第 1 候选（日 Sun/夜 Moon 所在 rasi 之主）。

    pancha_bala_by_planet: {planet: float} 各曜 Pancha-Vargeeya bala（由调用方按其口径算）。
    返回 {'planet','via','candidacyCount','panchaBala'}。
    """
    # 候选去重统计（同一曜可在多类别出现 → candidacyCount）。
    by_planet = {}
    for c in candidates:
        p = c.get('planet')
        if p is None:
            continue
        by_planet.setdefault(p, {'rules': [], 'planet': p})
        by_planet[p]['rules'].append(c['rule'])
    if not by_planet:
        return None

    def _aspect_to_lagna(p):
        sign = planet_signs.get(p)
        if sign is None:
            return None
        info = tajaka_aspect_type(sign, annual_lagna_sign)
        if info is None:
            return None
        # orb：行星对 lagna rasi 的投影是否覆盖（用与 lagna 度数比对）——此处只判相位类别 + 自身 orb 投影存在。
        return info

    def _bala(p):
        return float(pancha_bala_by_planet.get(p, 0.0))

    def _count(p):
        return len(by_planet[p]['rules'])

    def _pick(pool, via):
        # 先 bala 降序，并列取 candidacyCount 多者。
        best = sorted(pool, key=lambda p: (_bala(p), _count(p)), reverse=True)[0]
        return {'planet': best, 'via': via, 'candidacyCount': _count(best),
                'panchaBala': round(_bala(best), 4)}

    planets = list(by_planet.keys())
    benefic = [p for p in planets
               if (_aspect_to_lagna(p) or {}).get('nature', '').startswith('benefic')]
    if benefic:
        return _pick(benefic, 'benefic_aspect')
    any_aspect = [p for p in planets if _aspect_to_lagna(p) is not None]
    if any_aspect:
        return _pick(any_aspect, 'malefic_aspect')
    # C：全无相位 → 取极强者（阈值“很强”=Pancha-Vargeeya bala>10，书的“strong”档）。
    strong = [p for p in planets if _bala(p) > 10.0]
    if strong:
        return _pick(strong, 'strong_no_aspect')
    # D：取第 1 候选。
    first = candidates[0].get('planet')
    if first is not None:
        return {'planet': first, 'via': 'first_candidate_fallback',
                'candidacyCount': _count(first), 'panchaBala': round(_bala(first), 4)}
    return None


# ════════════════════════════════════════════════════════════════════════
# 6. Sahams（36 个）
# ════════════════════════════════════════════════════════════════════════
# 每个 saham 公式形如 A − B + C（昼）。记 A/B/C 为「取值符号」：
#   行星 id；或 'lagna'/'lagnaLord'；或 ('houseCusp', n)=第 n 宫起点；
#   ('houseLord', n)=第 n 宫主；('fixedSignDeg', sign, deg)=某 rasi 固定度；
#   ('saham', key)=另一 saham 之经度（依赖在前者已算）；('signLord', planetRef)=某曜所在 rasi 之主。
# day_night_invariant=True 的 saham 昼夜同式（不翻转）。
# 权威转录（Saham 表）。
SAHAM_DEFS = [
    ('punya', '福德', const.MOON, const.SUN, 'lagna', False),
    ('vidya', '学识', const.SUN, const.MOON, 'lagna', False),
    ('yasas', '名声', const.JUPITER, ('saham', 'punya'), 'lagna', False),
    ('mitra', '友', const.JUPITER, ('saham', 'punya'), const.VENUS, False),
    ('mahatmya', '伟大', ('saham', 'punya'), const.MARS, 'lagna', False),
    ('asha', '欲望', const.SATURN, const.MARS, 'lagna', False),
    # samartha：火−lagna主+lagna；若火为lagna主则改用 木−火+lagna（特例由 _eval_saham 处理）。
    ('samartha', '能为', const.MARS, 'lagnaLord', 'lagna', False),
    ('bhratri', '兄弟', const.JUPITER, const.SATURN, 'lagna', True),
    ('gaurava', '尊荣', const.JUPITER, const.MOON, const.SUN, False),
    ('pitri', '父', const.SATURN, const.SUN, 'lagna', False),
    ('rajya', '权位', const.SATURN, const.SUN, 'lagna', False),
    ('matri', '母', const.MOON, const.VENUS, 'lagna', False),
    ('putra', '子女', const.JUPITER, const.MOON, 'lagna', False),
    ('jeeva', '寿命', const.SATURN, const.JUPITER, 'lagna', False),
    ('karma', '事业', const.MARS, const.MERCURY, 'lagna', False),
    ('roga', '疾病', 'lagna', const.MOON, 'lagna', False),
    ('kali', '大不幸', const.JUPITER, const.MARS, 'lagna', False),
    ('sastra', '学术', const.JUPITER, const.SATURN, const.MERCURY, False),
    ('bandhu', '亲属', const.MERCURY, const.MOON, 'lagna', False),
    ('mrityu', '死亡', ('houseCusp', 8), const.MOON, 'lagna', True),
    ('paradesa', '远方/出国', ('houseCusp', 9), ('houseLord', 9), 'lagna', True),
    ('artha', '财', ('houseCusp', 2), ('houseLord', 2), 'lagna', True),
    ('paradara', '私情', const.VENUS, const.SUN, 'lagna', False),
    ('vanik', '商贸', const.MOON, const.MERCURY, 'lagna', False),
    # karyasiddhi：昼 土−日+日之星座主；夜 土−月+月之星座主（C 随昼夜变，由 _eval_saham 处理）。
    ('karyasiddhi', '成事', const.SATURN, const.SUN, ('signLord', const.SUN), False),
    ('vivaha', '婚姻', const.VENUS, const.SATURN, 'lagna', False),
    ('santapa', '忧苦', const.SATURN, const.MOON, ('houseCusp', 6), False),
    ('sraddha', '虔信', const.VENUS, const.MARS, 'lagna', False),
    ('preeti', '爱慕', ('saham', 'sastra'), ('saham', 'punya'), 'lagna', False),
    ('jadya', '痼疾', const.MARS, const.SATURN, const.MERCURY, False),
    ('vyapara', '事务', const.MARS, const.SATURN, 'lagna', True),
    ('satru', '仇敌', const.MARS, const.SATURN, 'lagna', False),
    ('jalapatana', '渡海', ('fixedSignDeg', const.CANCER, 15.0), const.SATURN, 'lagna', False),
    ('bandhana', '囚禁', ('saham', 'punya'), const.SATURN, 'lagna', False),
    ('apamrityu', '横死', ('houseCusp', 8), const.MARS, 'lagna', False),
    ('labha', '所得', ('houseCusp', 11), ('houseLord', 11), 'lagna', True),
]

# Saham 依赖另一 saham 时的求值顺序（拓扑：punya/sastra 先于其依赖者）。
_SAHAM_ORDER = [d[0] for d in SAHAM_DEFS]


def _resolve_term(term, ctx):
    """把 saham 公式中的符号解析成经度（0-360）。ctx 提供已算数据 + 已得 saham 经度。"""
    planet_lons = ctx['planet_lons']
    if term == 'lagna':
        return _lon(ctx['lagna_lon'])
    if term == 'lagnaLord':
        lord = sign_lord(ctx['lagna_sign'])
        return _lon(planet_lons[lord]) if lord in planet_lons else None
    if isinstance(term, tuple):
        kind = term[0]
        if kind == 'saham':
            return ctx['saham_lons'].get(term[1])
        if kind == 'houseCusp':
            # 第 n 宫起点 = lagna 经度 + (n-1)×30（整宫制 / whole-sign，与书 Example 一致）。
            return _lon(ctx['lagna_lon'] + (term[1] - 1) * 30.0)
        if kind == 'houseLord':
            sign = prim.offset_sign(ctx['lagna_sign'], term[1])
            lord = sign_lord(sign)
            return _lon(planet_lons[lord]) if lord in planet_lons else None
        if kind == 'fixedSignDeg':
            return _lon(prim.SIGN_INDEX[term[1]] * 30.0 + term[2])
        if kind == 'signLord':
            ref = term[1]
            ref_sign = _sign_of_lon(planet_lons[ref]) if ref in planet_lons else None
            lord = sign_lord(ref_sign) if ref_sign else None
            return _lon(planet_lons[lord]) if lord in planet_lons else None
    # 其余即行星 id。
    return _lon(planet_lons[term]) if term in planet_lons else None


def _arc_contains(b_lon, a_lon, c_lon):
    """C 是否落在「从 B 顺黄道到 A」的弧内（用于决定是否 +30°）。"""
    span = (a_lon - b_lon) % 360.0
    pos = (c_lon - b_lon) % 360.0
    return pos <= span


def compute_saham(a, b, c, day_birth, day_night_invariant=False):
    """单个 saham 经度：

    昼（或昼夜同式）：val = A − B + C；夜：翻转为 B − A + C。
    再判：若 C 不在「B→A」弧内（按所用 A/B 顺序），+30°。最后归一 0-360。

    返回经度（float）或 None（任一项缺值）。
    不变量：dn_invariant=False 时，夜公式 = 昼公式把 A、B 对调。
    """
    if a is None or b is None or c is None:
        return None
    if day_birth or day_night_invariant:
        hi, lo = a, b           # A − B + C
    else:
        hi, lo = b, a           # 夜翻转：B − A + C
    val = (hi - lo + c) % 360.0
    # +30°：C 不在 lo→hi 弧内（lo=被减项 B，hi=A）。
    if not _arc_contains(lo, hi, c):
        val = (val + 30.0) % 360.0
    return val


def all_sahams(planet_lons, lagna_lon, lagna_sign, day_birth):
    """全 36 Saham 经度（按依赖顺序求值）。

    输入：年度盘各曜 sidereal 黄经 dict + 年度盘 lagna 经度/星座 + 是否昼生。
    返回 {key: {'label','lon','sign','signLon'}}。缺项（如某曜未提供）→ lon=None。
    """
    ctx = {
        'planet_lons': {k: _lon(v) for k, v in planet_lons.items()},
        'lagna_lon': _lon(lagna_lon),
        'lagna_sign': lagna_sign,
        'saham_lons': {},
    }
    out = {}
    label_by_key = {d[0]: d[1] for d in SAHAM_DEFS}
    # 特例覆盖（samartha 的 Mars-owns-lagna；karyasiddhi 的夜用月）。
    for key, label, a_term, b_term, c_term, dn_inv in SAHAM_DEFS:
        a_t, b_t, c_t = a_term, b_term, c_term
        if key == 'samartha':
            lord = sign_lord(lagna_sign)
            if lord == const.MARS:  # 火星即 lagna 主 → 木−火+lagna
                a_t, b_t = const.JUPITER, const.MARS
        if key == 'karyasiddhi' and not day_birth:
            # 夜：土−月+月之星座主
            a_t, b_t, c_t = const.SATURN, const.MOON, ('signLord', const.MOON)
        a = _resolve_term(a_t, ctx)
        b = _resolve_term(b_t, ctx)
        c = _resolve_term(c_t, ctx)
        lon = compute_saham(a, b, c, day_birth, day_night_invariant=dn_inv)
        ctx['saham_lons'][key] = lon
        entry = {'label': label, 'lon': lon}
        if lon is not None:
            entry['sign'] = _sign_of_lon(lon)
            entry['signLon'] = round(_signlon(lon), 4)
        out[key] = entry
    return out


# ════════════════════════════════════════════════════════════════════════
# 7. Tajaka 16 瑜伽（速度序 + 逆行规则）
# ════════════════════════════════════════════════════════════════════════
# 速度序（慢→快）：土 < 罗/计 < 木 < 火 < 日 < 金 < 水 < 月。权威转录。
_SPEED_RANK = {
    const.SATURN: 0, const.NORTH_NODE: 1, const.SOUTH_NODE: 1, const.JUPITER: 2,
    const.MARS: 3, const.SUN: 4, const.VENUS: 5, const.MERCURY: 6, const.MOON: 7,
} if const else {}


def speed_rank(planet):
    return _SPEED_RANK.get(planet, -1)


def faster_of(a, b):
    """返回 (faster, slower)（按速度序；并列时按传入序）。"""
    return (a, b) if speed_rank(a) >= speed_rank(b) else (b, a)


def is_applying_ithasala(a_planet, a_lon, b_planet, b_lon,
                         a_retro=False, b_retro=False):
    """Ithasala（趋近相位 / applying）：两曜有 Tajaka 相位且互在 orb，
    且「较快曜 advancement 较小（落后）」。逆行修正（权威转录）：
      - 较快曜逆行 → 通常不成 Ithasala（背离）；除非较快曜逆行且 advancement 较大（回退趋近）。
      - 较慢曜逆行 → 不妨碍（仍 Ithasala）。
    返回 bool（仅判 vartamana 在场；poorna/bhavishya 由 ithasala_detail 细分）。"""
    fast, slow = faster_of(a_planet, b_planet)
    fast_lon = a_lon if fast == a_planet else b_lon
    slow_lon = a_lon if slow == a_planet else b_lon
    fast_retro = a_retro if fast == a_planet else b_retro
    fast_adv = _signlon(fast_lon)
    slow_adv = _signlon(slow_lon)
    if not fast_retro:
        return fast_adv < slow_adv      # 快曜落后（advancement 较小）→ 趋近
    # 快曜逆行：回退，故「advancement 较大」才趋近。
    return fast_adv > slow_adv


def ithasala_detail(a_planet, a_lon, b_planet, b_lon, a_retro=False, b_retro=False):
    """Ithasala 细分（vartamana / poorna / bhavishya）与 Eesarpha 判定。

    返回 {'aspect','withinOrb','applying','type','advDiff'} 或 None（无相位）。
      type ∈ {'poorna','vartamana','bhavishya','eesarpha', None}
        - poorna：互在 orb + 趋近 + 两 advancement 差 < 1°。
        - vartamana：互在 orb + 趋近（差 ≥1°）。
        - bhavishya：不在 orb 但快曜再走 ≤1° 即入 orb（趋近方向）。
        - eesarpha：有相位但快曜更超前（背离 / applying=False）。
    """
    info = tajaka_aspect_type(_sign_of_lon(a_lon), _sign_of_lon(b_lon))
    if info is None:
        return None
    within = within_deeptamsa(a_planet, a_lon, b_planet, b_lon)
    applying = is_applying_ithasala(a_planet, a_lon, b_planet, b_lon, a_retro, b_retro)
    fast, slow = faster_of(a_planet, b_planet)
    fa = _signlon(a_lon if fast == a_planet else b_lon)
    sa = _signlon(a_lon if slow == a_planet else b_lon)
    adv_diff = abs(fa - sa)
    typ = None
    if within and applying:
        typ = 'poorna' if adv_diff < 1.0 else 'vartamana'
    elif within and not applying:
        typ = 'eesarpha'
    elif (not within) and applying and adv_diff <= 1.0:
        typ = 'bhavishya'
    return {'aspect': info['aspect'], 'nature': info['nature'],
            'withinOrb': within, 'applying': applying, 'type': typ,
            'advDiff': round(adv_diff, 4), 'faster': fast, 'slower': slow}


# 16 瑜伽名录（含中性试探注；判定细则见各函数 / 复合瑜伽需多曜上下文）。
TAJAKA_YOGA_CATALOG = [
    ('Ishkavala', '财福', '行星仅居 kendra(1/4/7/10)+panaphara(2/5/8/11)，apoklima(3/6/9/12)空'),
    ('Induvara', '失意', '行星仅居 apoklima，kendra+panaphara 空'),
    ('Ithasala', '趋近相位', '两曜有相位且较快曜落后(applying)'),
    ('Eesarpha', '背离相位', '两曜有相位且较快曜超前(separating)'),
    ('Nakta', '速曜居间助', '两曜无相位，更快第三曜与二者皆成 Ithasala'),
    ('Yamaya', '慢曜居间助', '两曜无相位，更慢第三曜与二者皆成 Ithasala'),
    ('Manahoo', '破 Ithasala(土火)', 'Ithasala 中较快曜被土或火合且在其 orb 内，吉转凶'),
    ('Kamboola', '月助 Ithasala', '月与 Ithasala 一方成 Ithasala，增力'),
    ('Gairi-Kamboola', '月候助', '月在 rasi 末度、入次 rasi 即与一方成 Ithasala'),
    ('Khallasara', '居间破义', 'lagna 主居月与某曜 X 之间且与二者皆无 Ithasala，毁 X 义'),
    ('Radda', 'Ithasala 落陷化凶', 'Ithasala 一方落/逆/燃/弱，转凶'),
    ('Duhphali-Kutta', '强凌弱遂愿', '较快曜旺/庙/强 bala 而较慢曜弱'),
    ('Duttota', '弱遇强转吉', '两弱曜 Ithasala 而其一与强曜成 Ithasala'),
    ('Thambira', '迟成', '某曜在 rasi 末度、入次 rasi 即与较慢曜成 Ithasala'),
    ('Kutta', '居命受照成愿', '居 lagna 之曜被 kendra/panaphara 中旺/庙曜所照'),
    ('Durupha', '凶位无力', '居 dusthana(6/8/12)且燃/逆/落的两曜之 Ithasala，无力'),
]


def detect_position_yogas(planet_signs, annual_lagna_sign):
    """Ishkavala / Induvara（按七曜所占宫类）。返回 {'ishkavala':bool,'induvara':bool}。
    kendra=1/4/7/10、panaphara=2/5/8/11、apoklima=3/6/9/12（from 年度盘 lagna）。"""
    kendra_pana = {1, 4, 7, 10, 2, 5, 8, 11}
    apoklima = {3, 6, 9, 12}
    houses = set()
    for p in SEVEN_PLANETS:
        s = planet_signs.get(p)
        if s is None:
            continue
        houses.add(prim.house_distance(annual_lagna_sign, s))
    occupied = houses
    ishkavala = bool(occupied) and occupied.issubset(kendra_pana)
    induvara = bool(occupied) and occupied.issubset(apoklima)
    return {'ishkavala': ishkavala, 'induvara': induvara}


def detect_pairwise_yogas(planet_signs, planet_lons, retro=None):
    """两两 Ithasala/Eesarpha 全表（七曜）。retro={planet:bool}。
    返回 [{'a','b', ...ithasala_detail}]（仅有相位的对）。"""
    retro = retro or {}
    out = []
    planets = [p for p in SEVEN_PLANETS if p in planet_signs and p in planet_lons]
    for i, a in enumerate(planets):
        for b in planets[i + 1:]:
            d = ithasala_detail(a, planet_lons[a], b, planet_lons[b],
                                retro.get(a, False), retro.get(b, False))
            if d is None:
                continue
            row = dict(d)
            row['a'] = a
            row['b'] = b
            out.append(row)
    return out


# Tajika 速度序(快→慢):月>水>金>日>火>木>土(用于 Nakta/Yamaya 居间曜快慢判)。
_TAJAKA_SPEED_RANK = {const.MOON: 0, const.MERCURY: 1, const.VENUS: 2, const.SUN: 3,
                      const.MARS: 4, const.JUPITER: 5, const.SATURN: 6}


def detect_higher_yogas(planet_signs, planet_lons, retro=None):
    """高阶 Tajika 瑜伽(基于两两 Ithasala):
      Nakta(速曜居间助):两曜无相位,更快第三曜与二者皆成 Ithasala → 传光成事;
      Yamaya(慢曜居间助):同上但居间曜更慢 → 集光;
      Kamboola(月助):月与既有 Ithasala 一方成 Ithasala → 增力。
    返回 {'nakta':[...], 'yamaya':[...], 'kamboola':[...]}。"""
    retro = retro or {}
    planets = [p for p in SEVEN_PLANETS if p in planet_lons]

    def _ith(a, b):
        return ithasala_detail(a, planet_lons[a], b, planet_lons[b],
                               retro.get(a, False), retro.get(b, False))

    def _is_ith(a, b):
        d = _ith(a, b)
        return bool(d) and d.get('type') in ('vartamana', 'poorna', 'bhavishya')

    out = {'nakta': [], 'yamaya': [], 'kamboola': []}
    for i, a in enumerate(planets):
        for b in planets[i + 1:]:
            dab = _ith(a, b)
            if dab and (dab.get('withinOrb') or dab.get('applying')):
                continue                                  # 两曜本已有相位,不取居间
            for c in planets:
                if c in (a, b):
                    continue
                if _is_ith(c, a) and _is_ith(c, b):
                    rc, ra, rb = _TAJAKA_SPEED_RANK[c], _TAJAKA_SPEED_RANK[a], _TAJAKA_SPEED_RANK[b]
                    if rc < ra and rc < rb:
                        out['nakta'].append({'a': a, 'b': b, 'via': c})
                    elif rc > ra and rc > rb:
                        out['yamaya'].append({'a': a, 'b': b, 'via': c})
    moon = const.MOON
    if moon in planets:
        for i, a in enumerate(planets):
            for b in planets[i + 1:]:
                if moon in (a, b):
                    continue
                if _is_ith(a, b) and (_is_ith(moon, a) or _is_ith(moon, b)):
                    out['kamboola'].append({'pair': [a, b],
                                            'moonWith': a if _is_ith(moon, a) else b})
    return out


# ════════════════════════════════════════════════════════════════════════
# 8. 年度大运框架（Patyayini / Mudda / Varsha-Narayana）—— 骨架
# ════════════════════════════════════════════════════════════════════════
_TAJAKA_YEAR_DAYS = 365.2425   # Tajaka 年长（权威转录）。


def patyayini_dasa(planet_lons, lagna_lon, year_days=None, lagna_point='degree'):
    """Patyayini dasa：以 lagna + 七曜 advancement(krisamsa) 升序，
    相邻差 = patyamsa，期长(日) = 年长 × patyamsa / Σpatyamsa（Σ = 最大 krisamsa）。

    输入：年度盘七曜黄经 + lagna 黄经。返回 {'order':[{ref,krisamsa,patyamsa,days}], 'totalDays'}。
    第一项（最小 krisamsa）无 patyamsa（不占期）。
    """
    year_len = _TAJAKA_YEAR_DAYS if year_days is None else float(year_days)
    lagna_kris = 0.0 if lagna_point == 'cusp' else _signlon(lagna_lon)
    rows = [{'ref': 'lagna', 'krisamsa': lagna_kris}]
    for p in SEVEN_PLANETS:
        if p in planet_lons:
            rows.append({'ref': p, 'krisamsa': _signlon(planet_lons[p])})
    rows.sort(key=lambda r: r['krisamsa'])
    total_patyamsa = rows[-1]['krisamsa'] - rows[0]['krisamsa'] if len(rows) > 1 else 0.0
    out = []
    prev = None
    for r in rows:
        if prev is None:
            patyamsa = 0.0
        else:
            patyamsa = r['krisamsa'] - prev
        prev = r['krisamsa']
        days = (year_len * patyamsa / total_patyamsa) if total_patyamsa else 0.0
        out.append({'ref': r['ref'], 'krisamsa': round(r['krisamsa'], 4),
                    'patyamsa': round(patyamsa, 4), 'days': round(days, 4)})
    return {'order': out, 'totalDays': round(sum(x['days'] for x in out), 4),
            'sumPatyamsa': round(total_patyamsa, 4)}


# Mudda（Varsha-Vimshottari）：120 年压成 360 日 → 各曜日数 = 正常年数 × 3。权威转录。
MUDDA_SEQUENCE = [
    {'key': 'Sun', 'id': const.SUN, 'days': 18}, {'key': 'Moon', 'id': const.MOON, 'days': 30},
    {'key': 'Mars', 'id': const.MARS, 'days': 21}, {'key': 'Rahu', 'id': const.NORTH_NODE, 'days': 54},
    {'key': 'Jupiter', 'id': const.JUPITER, 'days': 48}, {'key': 'Saturn', 'id': const.SATURN, 'days': 57},
    {'key': 'Mercury', 'id': const.MERCURY, 'days': 51}, {'key': 'Ketu', 'id': const.SOUTH_NODE, 'days': 21},
    {'key': 'Venus', 'id': const.VENUS, 'days': 60},
] if const else []
# 起运编号：日1 月2 火3 罗4 木5 土6 水7 计8 金9（余 0→9=金）。
_MUDDA_NUMBER = {'Sun': 1, 'Moon': 2, 'Mars': 3, 'Rahu': 4, 'Jupiter': 5,
                 'Saturn': 6, 'Mercury': 7, 'Ketu': 8, 'Venus': 9}
_MUDDA_BY_NUMBER = {v: k for k, v in _MUDDA_NUMBER.items()}


def mudda_first_lord(natal_first_vimshottari_key, years_completed):
    """Mudda 首运曜：取本命首 Vimshottari 大运曜编号 + 完成年数，mod 9（0→9=金）。
    返回首运 key（'Sun'..'Venus'）。"""
    base = _MUDDA_NUMBER.get(natal_first_vimshottari_key)
    if base is None:
        return None
    rem = (base + int(years_completed)) % 9
    if rem == 0:
        rem = 9
    return _MUDDA_BY_NUMBER[rem]


def mudda_dasa(natal_first_vimshottari_key, years_completed, natal_moon_remaining_ratio,
               year_basis_days=360.0):
    """Mudda（Varsha-Vimshottari）大运序 + 期长（骨架）。

    首运 = mudda_first_lord；首运余 = 本命月宿未走比 × 该曜日数；其后按正常 Vimshottari 序循环。
    返回 {'firstLord','sequence':[{key,days,balance}]}（balance 仅首运）。
    """
    first = mudda_first_lord(natal_first_vimshottari_key, years_completed)
    if first is None:
        return {'available': False, 'reason': 'unknown_natal_lord'}
    keys = [d['key'] for d in MUDDA_SEQUENCE]
    scale = float(year_basis_days) / 360.0
    days_by = {d['key']: (d['days'] * scale if abs(scale - 1.0) > 1e-12 else d['days'])
               for d in MUDDA_SEQUENCE}
    idx = keys.index(first)
    seq = []
    for i in range(len(keys)):
        k = keys[(idx + i) % len(keys)]
        entry = {'key': k, 'days': days_by[k]}
        if i == 0:
            entry['balance'] = round(days_by[k] * float(natal_moon_remaining_ratio), 4)
        seq.append(entry)
    return {'available': True, 'firstLord': first, 'totalDays': sum(days_by.values()),
            'sequence': seq}


def varsha_narayana_lagna(natal_lagna_sign, age_completed):
    """Varsha-Narayana 用 lagna = Muntha（本命 lagna 进 age 宫）。返回该 rasi。
    书：进 Narayana 时以 Muntha 作 lagna 起运。期长 = Narayana 年数 × 3（日）。"""
    return muntha(natal_lagna_sign, age_completed)['sign']


# ════════════════════════════════════════════════════════════════════════
# 9. 顶层装配（供 websrv 接线层调用）
# ════════════════════════════════════════════════════════════════════════
TARA_NAMES = ('Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Vadha', 'Mitra', 'Ati-Mitra')
TARA_CN = {'Janma': '本命', 'Sampat': '财', 'Vipat': '危', 'Kshema': '安', 'Pratyari': '障',
           'Sadhaka': '成', 'Vadha': '害', 'Mitra': '友', 'Ati-Mitra': '挚友'}
TARA_GOOD = {'Sampat', 'Kshema', 'Sadhaka', 'Mitra', 'Ati-Mitra'}


def tripataki_nakshatra(annual_positions):
    """Tripataki(宿距三旗,古籍诸本「规则随书」→ 只出可计算分档并标注):
    以年盘月亮宿为基准,九曜按「距月宿的宿数」1-27 落三层旗
    (1-9 内旗/10-18 中旗/19-27 外旗);逐曜附 27 宿通用 Tārā 九循环吉凶。"""
    moon = annual_positions.get(const.MOON)
    if not moon:
        return {'available': False, 'reason': 'missing_moon'}
    from astrostudy.nakshatra import nakshatra_from_lon
    m_nak = nakshatra_from_lon(_lon(moon['lon']))
    base_idx = int(m_nak['index'])              # 1-27
    rows = []
    for pid, v in annual_positions.items():
        nak = nakshatra_from_lon(_lon(v['lon']))
        d = ((int(nak['index']) - base_idx) % 27) + 1     # 1..27(含本宿=1)
        flag = 1 if d <= 9 else (2 if d <= 18 else 3)
        tara = TARA_NAMES[(d - 1) % 9]
        rows.append({'planet': pid, 'transitNak': nak.get('name'),
                     'transitNakIndex': int(nak['index']),
                     'distance': d, 'flag': flag,
                     'tara': tara, 'taraLabel': TARA_CN.get(tara, tara),
                     'good': tara in TARA_GOOD,
                     'verdict': ('吉' if tara in TARA_GOOD else ('平' if tara == 'Janma' else '凶'))})
    return {'available': True,
            'baseNak': m_nak.get('name'), 'baseNakIndex': base_idx,
            'rows': rows,
            'note': '宿距三旗:1-9 内旗/10-18 中旗/19-27 外旗;吉凶按 27 宿通用 Tārā 九循环。原典规则随书 → 本卡为可计算版并标注。'}


_PATYAYINI_YEAR_BY_KEY = {'gregorian365_2425': 365.2425, 'd365': 365.0,
                          'sidereal365_2563': 365.2563, 'savana360': 360.0}
_ANNUAL_NAK_BASIS_BY_KEY = {'classical360': 360.0, 'julian365_25': 365.25}


def build_tajaka(annual_positions, natal_lagna_sign, annual_lagna_lon,
                 age_completed, day_birth, *, retro=None,
                 d3_signs=None, d9_signs=None, natal_first_vimshottari_key=None,
                 natal_moon_remaining_ratio=None, node_positions=None, variants=None):
    """组装年度盘全量 Tajaka 结果（纯函数；天文求根由调用方完成）。

    参数（均为已算数据）：
      annual_positions: {planet_id: {'sign': rasi, 'lon': sidereal 黄经}} —— 年度盘七曜(+可选节点)。
      natal_lagna_sign: 本命 lagna rasi（Muntha 用）。
      annual_lagna_lon: 年度盘 lagna sidereal 黄经。
      age_completed:    完成年数（int；进入第 age+1 年）。
      day_birth:        年首是否在昼（True=昼/False=夜）；翻转 Saham、定 Triraasi 等。
      retro:            {planet_id: bool} 逆行标记（Tajaka 瑜伽用；缺省全 False）。
      d3_signs/d9_signs:{planet_id: rasi} D-3/D-9 星座（Pancha-Vargeeya 全量；缺则该子源 0）。
      natal_first_vimshottari_key / natal_moon_remaining_ratio：本命月宿首运曜 + 未走比（Mudda 用）。

    返回 dict（结构稳定，缺数据子项标 available=False / 值 None）。
    """
    from astrostudy.india.dasha_variants import resolve_variants as _rv_taj
    _dv = _rv_taj(variants)
    _hadda_scheme = _dv['haddaScheme']
    _paty_year = _PATYAYINI_YEAR_BY_KEY.get(_dv['patyayiniYearConstant'], _TAJAKA_YEAR_DAYS)
    _paty_point = _dv['patyayiniLagnaPoint']
    _nak_basis = _ANNUAL_NAK_BASIS_BY_KEY.get(_dv['annualNakYearBasis'], 360.0)

    retro = retro or {}
    d3_signs = d3_signs or {}
    d9_signs = d9_signs or {}
    planet_signs = {p: v['sign'] for p, v in annual_positions.items()}
    planet_lons = {p: _lon(v['lon']) for p, v in annual_positions.items()}
    annual_lagna_sign = _sign_of_lon(annual_lagna_lon)
    sun_sign = planet_signs.get(const.SUN)
    moon_sign = planet_signs.get(const.MOON)

    mun = muntha(natal_lagna_sign, age_completed)
    mun['houseInAnnual'] = muntha_house_in_annual(mun['sign'], annual_lagna_sign)

    # Pancha-Vargeeya bala（各曜）。
    pancha = {}
    for p in SEVEN_PLANETS:
        if p not in planet_signs:
            continue
        pancha[p] = pancha_vargeeya_bala(
            p, planet_signs[p], planet_lons[p],
            d3_sign=d3_signs.get(p), d9_sign=d9_signs.get(p),
            hadda_scheme=_hadda_scheme)
    pancha_total = {p: v['total'] for p, v in pancha.items()}

    candidates = year_lord_candidates(
        natal_lagna_sign, annual_lagna_sign, mun['sign'],
        sun_sign, moon_sign, day_birth)
    year_lord = select_year_lord(
        candidates, annual_lagna_sign, planet_signs, planet_lons, pancha_total,
        d3_signs=d3_signs, d9_signs=d9_signs)

    result = {
        'available': True,
        'ageCompleted': int(age_completed),
        'dayBirth': bool(day_birth),
        'annualLagnaSign': annual_lagna_sign,
        'muntha': mun,
        'yearLordCandidates': candidates,
        'yearLord': year_lord,
        'harshaBala': harsha_bala(planet_signs, planet_lons, annual_lagna_sign, day_birth),
        'panchaVargeeyaBala': pancha,
        'aspects': planet_aspects(planet_signs, planet_lons),
        'yogas': {
            'position': detect_position_yogas(planet_signs, annual_lagna_sign),
            'pairwise': detect_pairwise_yogas(planet_signs, planet_lons, retro),
            'higher': detect_higher_yogas(planet_signs, planet_lons, retro),
            'catalog': [{'key': k, 'label': lbl, 'note': note}
                        for k, lbl, note in TAJAKA_YOGA_CATALOG],
        },
        'sahams': all_sahams(planet_lons, annual_lagna_lon, annual_lagna_sign, day_birth),
        # 宿距三旗按手册九曜(七曜 + 罗/计);node_positions 仅供此块,其余 Tajika 子块守七曜制零回归。
        'tripatakiNak': tripataki_nakshatra(dict(annual_positions, **(node_positions or {}))),
        'dasas': {
            'patyayini': patyayini_dasa(planet_lons, annual_lagna_lon,
                                        year_days=_paty_year, lagna_point=_paty_point),
            'annualYogini': annual_yogini_dasa(
                (annual_positions.get(const.MOON) or {}).get('lon'), year_basis_days=_nak_basis),
            'varshaNarayanaLagna': varsha_narayana_lagna(natal_lagna_sign, age_completed),
        },
    }
    if natal_first_vimshottari_key is not None and natal_moon_remaining_ratio is not None:
        result['dasas']['mudda'] = mudda_dasa(
            natal_first_vimshottari_key, age_completed, natal_moon_remaining_ratio,
            year_basis_days=_nak_basis)
    return result


# ── 年 Yogini(Varsha Yogini)────────────────────────────────────────────
# 与本命 Yogini 同表同序(月1→日2→木3→火4→水5→土6→金7→罗8,Σ=36);起始由「年盘」月宿
# (宿序+3) mod 8 定;段日 = 年值 × (年基/36);首段余额 = (1−宿内已行比例) × 全段日。
# 年基可配:360(古典,默认) / 365.25 —— 比例 1:2:…:8 两基不变。
_ANNUAL_YOGINI_SEQ = (
    ('Mangala', 'Moon', 1), ('Pingala', 'Sun', 2), ('Dhanya', 'Jupiter', 3),
    ('Bhramari', 'Mars', 4), ('Bhadrika', 'Mercury', 5), ('Ulka', 'Saturn', 6),
    ('Siddha', 'Venus', 7), ('Sankata', 'Rahu', 8),
)
_YOGINI_CN = {'Moon': '月亮', 'Sun': '太阳', 'Jupiter': '木星', 'Mars': '火星',
              'Mercury': '水星', 'Saturn': '土星', 'Venus': '金星', 'Rahu': '罗睺'}
_NAK_SPAN = 360.0 / 27.0


def annual_yogini_dasa(annual_moon_lon, year_basis_days=360.0):
    """年 Yogini:年盘月宿播种,一年内跑满一轮 8 Yogini(Σ单位=36)。

    返回 {'available','startYogini','moonNakIndex','sequence':[{yogini,lordKey,lordCN,
    units,days,balance?}],'totalDays','yearBasisDays'}。首项 days 为余额(去已行)。
    """
    try:
        lon = float(annual_moon_lon) % 360.0
    except (TypeError, ValueError):
        return {'available': False, 'reason': 'moon_lon_invalid'}
    nak_index = int(lon // _NAK_SPAN) + 1                 # 1..27
    frac = (lon - (nak_index - 1) * _NAK_SPAN) / _NAK_SPAN
    start8 = (nak_index + 3) % 8
    start_idx = (start8 - 1) % 8                          # 0 基:0→Sankata? 不——(N+3)%8 的 0 对应 8=Sankata
    unit_days = float(year_basis_days) / 36.0
    seq = []
    for k in range(8):
        name, lord, units = _ANNUAL_YOGINI_SEQ[(start_idx + k) % 8]
        full_days = units * unit_days
        entry = {'yogini': name, 'lordKey': lord, 'lordCN': _YOGINI_CN[lord],
                 'units': units, 'days': round(full_days, 4)}
        if k == 0:
            entry['balance'] = round(full_days * (1.0 - frac), 4)
        seq.append(entry)
    return {'available': True, 'startYogini': seq[0]['yogini'], 'moonNakIndex': nak_index,
            'sequence': seq, 'totalDays': round(sum(x['days'] for x in seq), 4),
            'yearBasisDays': float(year_basis_days)}


# ── G13 · Tithi Pravesh(阴历返照年盘)时刻求解 ─────────────────────────────
# 权威 §15.3:「以本命同 Tithi 的回归立年盘」—— 求 (Moon−Sun) mod 360 回到本命
# elongation 的瞬间。一个太阳年内该回归约有 12–13 次(朔望月 ~29.53 日),权威未指明
# 取哪一次(歧义 A17)→ 已定案「取最接近生日那一次」,mode 预留其他口径。
_SYNODIC_MONTH_DAYS = 29.530588


def tithi_pravesh_moment(elong_fn, natal_elongation, anchor_jd,
                         mode='nearest_birthday', search_half_days=20.0):
    """解 elong_fn(jd) == natal_elongation 的最接近 anchor_jd 的时刻。

    elong_fn        : jd → (Moon−Sun) mod 360(由服务层注入,恒星/回归同减无别)。
    natal_elongation: 本命日月角距(0..360)。
    anchor_jd       : 目标年的「生日时刻」jd(取最接近它的一次回归 —— 定案口径)。
    mode            : 'nearest_birthday'(默认;其余口径预留,当前一律按默认)。
    search_half_days: 搜索半窗(默认 ±20 日 > 半个朔望月,必含至少一次回归)。

    月相角速 ≈ 12.19°/日且恒正(月恒快于日)→ f(jd)=wrap180(elong−target) 在每个
    朔望月内单调穿零一次。粗扫变号 → 二分。返回 (jd, err_deg) 或 (None, None)。
    """
    if natal_elongation is None or anchor_jd is None:
        return None, None
    target = float(natal_elongation) % 360.0

    def f(jd):
        e = elong_fn(jd)
        return None if e is None else ((float(e) - target + 180.0) % 360.0 - 180.0)

    lo = anchor_jd - float(search_half_days)
    hi = anchor_jd + float(search_half_days)
    n = max(64, int((hi - lo) * 8))           # ~3h 粗扫步长,远小于半日单调段
    roots = []
    prev_jd, prev_v = None, None
    for i in range(n + 1):
        jd = lo + (hi - lo) * i / n
        v = f(jd)
        if v is None:
            prev_jd, prev_v = None, None
            continue
        if prev_v is not None and (prev_v < 0) != (v < 0) and abs(v - prev_v) < 180.0:
            a, b, fa = prev_jd, jd, prev_v
            for _ in range(60):
                m = (a + b) / 2.0
                fm = f(m)
                if fm is None:
                    break
                if abs(fm) < 1e-7:
                    a = b = m
                    break
                if (fa < 0) != (fm < 0):
                    b = m
                else:
                    a, fa = m, fm
            root = (a + b) / 2.0
            fv = f(root)
            if fv is not None:
                roots.append((root, abs(fv)))
        prev_jd, prev_v = jd, v
    if not roots:
        return None, None
    best = min(roots, key=lambda r: abs(r[0] - anchor_jd))     # 最接近生日(定案)
    return best
