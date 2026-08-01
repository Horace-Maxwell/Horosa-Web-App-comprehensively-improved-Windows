# -*- coding: utf-8 -*-
"""补充上升（参照上升点 / Jaimini 上升族）—— 独立纯函数模块。

输入皆为简单数据(lagna 星座 / 月星座 / AK 的 navamsa 星座 / 可选行星→星座 dict)，
不耦合排盘引擎内部状态，便于单测。坐标系：rasi 序 Ar=1..Pi=12；
宫 = 从参照点起顺黄道数(本宫=1)。各定义落到权威表/对照算例。

包含：
  Chandra Lagna  月所居星座(月作上升参照)。
  Paaka Lagna    上升主星所居星座(上升主作参照)。例：双鱼上升→木星→木星所居星座。
  Karakamsa      Atmakaraka(AK)在 navamsa(D9)所居星座(AK 的 D9 星座)。
  Swamsa         同 Karakamsa 星座，但作为「D9 上升参照」单列(命名区分、星座值同)。
  Graha Lagnas   行星参照点(权威对照表)：各行星为其自然指示宫的参照，
                 由「行星所居星座 + 该行星所司宫位列表」给出。
"""

from flatlib import const

# 复用 arudha 已定义的星座主星表(单一来源，避免重复维护)。
from astrostudy.india.arudha import SIGN_LORDS


# rasi 序：Ar=0..Pi=11(与 const.LIST_SIGNS 一致)。
SIGN_ORDER = list(const.LIST_SIGNS)
_SIGN_INDEX = {sign: i for i, sign in enumerate(SIGN_ORDER)}

SIGN_CN = {
    const.ARIES: '白羊',
    const.TAURUS: '金牛',
    const.GEMINI: '双子',
    const.CANCER: '巨蟹',
    const.LEO: '狮子',
    const.VIRGO: '处女',
    const.LIBRA: '天秤',
    const.SCORPIO: '天蝎',
    const.SAGITTARIUS: '射手',
    const.CAPRICORN: '摩羯',
    const.AQUARIUS: '水瓶',
    const.PISCES: '双鱼',
}

# ── Graha Lagnas 权威对照表 ───────────────────────────────────────────────
# 各行星为「其所司宫位」的自然参照点(逐字转录权威对照表，宫位 1-based)：
#   太阳 9/10/11 · 月亮 4/1/2/11/9 · 火星 3 · 水星 6 · 木星 5 · 金星 7 · 土星 8/12。
# 取行星所居星座为参照，列出的宫从该星座顺黄道数。节点(罗/计)表中未列 → 不臆造。
GRAHA_LAGNA_HOUSES = {
    const.SUN: [9, 10, 11],
    const.MOON: [4, 1, 2, 11, 9],
    const.MARS: [3],
    const.MERCURY: [6],
    const.JUPITER: [5],
    const.VENUS: [7],
    const.SATURN: [8, 12],
}

GRAHA_LABEL_CN = {
    const.SUN: '太阳',
    const.MOON: '月亮',
    const.MARS: '火星',
    const.MERCURY: '水星',
    const.JUPITER: '木星',
    const.VENUS: '金星',
    const.SATURN: '土星',
}


def sign_index(sign):
    """星座 → 0-based rasi 序(Ar=0..Pi=11)。未知星座返回 None。"""
    return _SIGN_INDEX.get(sign)


def offset_sign(sign, n):
    """从 sign 顺黄道走 n 宫(n>=1，n=1 即本宫)的 rasi。"""
    idx = _SIGN_INDEX.get(sign)
    if idx is None:
        return None
    return SIGN_ORDER[(idx + (n - 1)) % 12]


def lagna_lord(lagna_sign):
    """上升星座的主星(传统单主：天蝎=火、水瓶=土)。"""
    return SIGN_LORDS.get(lagna_sign)


def _entry(key, label, sign):
    """统一参照点条目：{key,label,sign,signIndex,signLabel}。sign 为 None 时各派生字段为 None。"""
    idx = sign_index(sign) if sign is not None else None
    return {
        'key': key,
        'label': label,
        'sign': sign,
        'signIndex': idx,
        'signLabel': SIGN_CN.get(sign) if sign is not None else None,
    }


def chandra_lagna(moon_sign):
    """月上升：月所居星座(月作上升参照)。"""
    return _entry('chandraLagna', '月上升', moon_sign)


def paaka_lagna(lagna_sign, lagna_lord_sign=None):
    """烹煮上升(Paaka)：上升主星所居星座。

    lagna_lord_sign 显式给出时直接用(引擎传上升主所居星座最稳)；
    缺省时退化为「上升星座本身」占位——但引擎恒应传 lagna_lord_sign。
    """
    sign = lagna_lord_sign if lagna_lord_sign is not None else lagna_sign
    return _entry('paakaLagna', '烹煮上升', sign)


def karakamsa(ak_navamsa_sign):
    """Karakamsa：Atmakaraka 在 navamsa(D9)所居星座。"""
    return _entry('karakamsa', 'Karakamsa', ak_navamsa_sign)


def swamsa(ak_navamsa_sign):
    """Swamsa：以 Karakamsa 为 D9 上升的参照(星座值同 Karakamsa，命名区分)。"""
    return _entry('swamsa', 'Swamsa', ak_navamsa_sign)


def graha_lagnas(planet_signs):
    """行星参照点(权威对照表)：{planet_id: 星座} → 各行星条目。

    每条目：行星所居星座为参照，列出其所司宫(houses)及各宫从该星座顺数得到的星座。
    planet_signs 为 None / 空 → 返回空表(不臆造)。表中未列的天体(节点等)忽略。
    """
    if not planet_signs:
        return []
    out = []
    for planet, houses in GRAHA_LAGNA_HOUSES.items():
        sign = planet_signs.get(planet)
        if sign is None:
            continue
        house_signs = []
        for h in houses:
            tgt = offset_sign(sign, h)
            house_signs.append({
                'house': h,
                'sign': tgt,
                'signIndex': sign_index(tgt) if tgt is not None else None,
                'signLabel': SIGN_CN.get(tgt) if tgt is not None else None,
            })
        out.append({
            'planet': planet,
            'label': GRAHA_LABEL_CN.get(planet, planet),
            'sign': sign,
            'signIndex': sign_index(sign),
            'signLabel': SIGN_CN.get(sign),
            'houses': houses,
            'houseSigns': house_signs,
        })
    return out


# Indu Lagna(财富点)Kala 值表(Sun30/Moon16/Mars6/Mercury8/Jupiter10/Venus12/Saturn1)。
INDU_KALA = {
    const.SUN: 30, const.MOON: 16, const.MARS: 6, const.MERCURY: 8,
    const.JUPITER: 10, const.VENUS: 12, const.SATURN: 1,
}


def indu_lagna(lagna_sign, moon_sign):
    """Indu Lagna(财富月宫,kala 法):取「从 Lagna 第 9 宫主」与「从 Moon 第 9 宫主」两星 Kala 相加,
    S=(kala1+kala2) mod 12(0 取 12),自 Moon 座起数第 S 座(含端)。缺主/缺座 → sign None(不臆造)。"""
    ninth_l = offset_sign(lagna_sign, 9) if lagna_sign else None
    ninth_m = offset_sign(moon_sign, 9) if moon_sign else None
    lord_l = SIGN_LORDS.get(ninth_l) if ninth_l else None
    lord_m = SIGN_LORDS.get(ninth_m) if ninth_m else None
    k1 = INDU_KALA.get(lord_l)
    k2 = INDU_KALA.get(lord_m)
    if k1 is None or k2 is None or moon_sign is None:
        return _entry('induLagna', 'Indu 财富上升', None)
    s = (k1 + k2) % 12 or 12
    entry = _entry('induLagna', 'Indu 财富上升', offset_sign(moon_sign, s))
    entry.update({'sumKala': k1 + k2, 'stepS': s,
                  'ninthFromLagnaLord': lord_l, 'ninthFromMoonLord': lord_m})
    return entry


# Varṇada 用奇座(自白羊顺数)集合。
_VARNADA_ODD_SIGNS = {const.ARIES, const.GEMINI, const.LEO, const.LIBRA, const.SAGITTARIUS, const.AQUARIUS}


def varnada_lagna(lagna_sign, hora_lagna_sign):
    """Varṇada Lagna(种姓上升,主品性;Jaimini)。Lagna/Horā-Lagna 各按「奇座自白羊顺数、偶座自双鱼逆数」
    得序号 A/B;A、B 同奇偶 → N=A+B,异 → N=|A−B|;N%12(0→12);Lagna 奇 → 自白羊顺数第 N 座、
    偶 → 自双鱼逆数第 N 座 = Varṇada。缺 Lagna/HL → None(不臆造)。"""
    if lagna_sign is None or hora_lagna_sign is None:
        return _entry('varnadaLagna', 'Varṇada 种姓上升', None)

    def _count(sign):
        idx = sign_index(sign)
        if idx is None:
            return None
        return (idx + 1) if sign in _VARNADA_ODD_SIGNS else (12 - idx)   # 顺(白羊起)/逆(双鱼起)
    a = _count(lagna_sign)
    b = _count(hora_lagna_sign)
    if a is None or b is None:
        return _entry('varnadaLagna', 'Varṇada 种姓上升', None)
    # 同向(Lagna 与 HL 同奇座/同偶座)→ 相加;异向 → 取差。判据是「座」奇偶(计数方向),非序号。
    same = (lagna_sign in _VARNADA_ODD_SIGNS) == (hora_lagna_sign in _VARNADA_ODD_SIGNS)
    n = (a + b) if same else abs(a - b)
    n = n % 12 or 12

    def _vl_idx(forward):
        return (n - 1) % 12 if forward else (11 - (n - 1)) % 12   # 顺(白羊起)/逆(双鱼起)第 n
    # Step-4 方向两派(§3.4 / _agentA_chartcasting.md:664-672):默认按 Lagna 奇偶(Rath/Raman);
    # 另派按积数 N 奇偶(Santhanam/Sharma)。奇 Lagna 盘两法可异;偶 Lagna 多同。主值取默认,altSign 并列另派。
    main_idx = _vl_idx(lagna_sign in _VARNADA_ODD_SIGNS)
    alt_idx = _vl_idx(n % 2 == 1)
    entry = _entry('varnadaLagna', 'Varṇada 种姓上升', SIGN_ORDER[main_idx])
    entry.update({'countLagna': a, 'countHora': b, 'step': n,
                  'altSign': SIGN_ORDER[alt_idx], 'altSignLabel': SIGN_CN.get(SIGN_ORDER[alt_idx]),
                  'altDiffers': alt_idx != main_idx,
                  'methodNote': '方向:默认 Lagna 奇偶(通行);altSign=积数 N 奇偶(译本变体)。'})
    return entry


def compute_supplementary_lagnas(lagna_sign, moon_sign, ak_navamsa_sign,
                                 planet_signs=None, lagna_lord_sign=None, hora_lagna_sign=None):
    """汇总补充上升族。

    入参：
      lagna_sign       上升星座(flatlib 英文名，如 'Aries')。
      moon_sign        月所居星座。
      ak_navamsa_sign  Atmakaraka 的 navamsa(D9)星座。
      planet_signs     {planet_id: 星座}(供 Graha Lagnas；None → 空表)。
      lagna_lord_sign  上升主星所居星座(供 Paaka Lagna；None 时由 lagna_sign 占位)。

    返回 dict：chandraLagna / paakaLagna / karakamsa / swamsa 各为
      {key,label,sign,signIndex,signLabel}；grahaLagnas 为列表(可能空)。
    """
    # 引擎未显式给上升主所居星座时，至少给出「上升主星」供参考(星座仍由引擎补)。
    return {
        'chandraLagna': chandra_lagna(moon_sign),
        'paakaLagna': paaka_lagna(lagna_sign, lagna_lord_sign),
        'lagnaLord': lagna_lord(lagna_sign),
        'karakamsa': karakamsa(ak_navamsa_sign),
        'swamsa': swamsa(ak_navamsa_sign),
        'induLagna': indu_lagna(lagna_sign, moon_sign),
        'varnadaLagna': varnada_lagna(lagna_sign, hora_lagna_sign),
        'grahaLagnas': graha_lagnas(planet_signs),
    }
