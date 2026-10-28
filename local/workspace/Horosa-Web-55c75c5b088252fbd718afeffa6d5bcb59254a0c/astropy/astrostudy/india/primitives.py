"""共享引擎原语（Jyotish primitives）—— 一次实现、多处依赖。

纯函数：输入为行星位置等简单数据(sign / lon 字典)，不耦合排盘引擎内部状态，便于单测。
每条公式落到权威书 Table/Example（附录 T 已转录），坐标系：rasi Ar=1..Pi=12。

包含：
  P-a 行星友谊(自然 Table7 + 临时 tatkalika + 复合 Table8)
  P-b Rasi Drishti(动→定/定→动[除邻]/双→双)
  P-c 8 卡拉卡(Chara karakas，含罗睺逆量)
  P-d Vargottama(D1 星座 == 分盘星座)
  P-e Varga 组 + Amsa-bala(Ch6.6 Table7：Shad/Sapta/Dasa/Shodasavarga 命中计数→amsa 名)
  P-f 长寿前置(Ch14：Rudra 用 Table32 特殊 8 宫 / Trishoola = Rudra 三角)
  P-g Abhijit(28 宿口径开关，默认 27 不含)
"""

from flatlib import const

# ── T0 基础常量 ──────────────────────────────────────────────────────────
SIGNS = [
    const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
    const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES,
]
SIGN_INDEX = {sign: i for i, sign in enumerate(SIGNS)}  # 0-based

# 星座主(传统单主,节点不持单主)。各子模块以 `import … as 原名` 取用,勿再各持一份。
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

# 中文座名 / 九曜中文名。
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

PLANET_CN = {
    const.SUN: '太阳',
    const.MOON: '月亮',
    const.MARS: '火星',
    const.MERCURY: '水星',
    const.JUPITER: '木星',
    const.VENUS: '金星',
    const.SATURN: '土星',
    const.NORTH_NODE: '罗睺',
    const.SOUTH_NODE: '计都',
}

# 根本三方(Moolatrikona):曜 → (星座, 起度, 止度)。
MOOLATRIKONA = {
    const.SUN: (const.LEO, 0, 20),
    const.MOON: (const.TAURUS, 4, 30),
    const.MARS: (const.ARIES, 0, 12),
    const.MERCURY: (const.VIRGO, 16, 20),
    const.JUPITER: (const.SAGITTARIUS, 0, 10),
    const.VENUS: (const.LIBRA, 0, 15),
    const.SATURN: (const.AQUARIUS, 0, 20),
}

MOVABLE = {const.ARIES, const.CANCER, const.LIBRA, const.CAPRICORN}          # 动 (chara)
FIXED = {const.TAURUS, const.LEO, const.SCORPIO, const.AQUARIUS}             # 定 (sthira)
DUAL = {const.GEMINI, const.VIRGO, const.SAGITTARIUS, const.PISCES}          # 双 (dvisvabhava)

ODD_SIGNS = {const.ARIES, const.GEMINI, const.LEO, const.LIBRA, const.SAGITTARIUS, const.AQUARIUS}
EVEN_SIGNS = {const.TAURUS, const.CANCER, const.VIRGO, const.SCORPIO, const.CAPRICORN, const.PISCES}

# 奇足/偶足(Narayana 方向用)：奇足 Ar/Ta/Ge + Li/Sc/Sg；偶足 Cn/Le/Vi + Cp/Aq/Pi
ODD_FOOTED = {const.ARIES, const.TAURUS, const.GEMINI, const.LIBRA, const.SCORPIO, const.SAGITTARIUS}
EVEN_FOOTED = {const.CANCER, const.LEO, const.VIRGO, const.CAPRICORN, const.AQUARIUS, const.PISCES}

KARAKA_PLANETS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY,
    const.JUPITER, const.VENUS, const.SATURN, const.NORTH_NODE,
]  # 8 曜(含罗睺、不含计都)，Jaimini chara karaka
# 8 卡拉卡降序：AK / AmK / BK / MK / PiK / PK / GK / DK
# PiK=Pitṛkāraka(父,第5)、PK=Putrakāraka(子,第6)——标签缩写与全名一致(原 PiK↔Putra/PK↔Pitri 错位已修,从 plan 默认)。
KARAKA_LABELS_8 = ['AK', 'AmK', 'BK', 'MK', 'PiK', 'PK', 'GK', 'DK']
KARAKA_FULL_8 = [
    'Atmakaraka', 'Amatyakaraka', 'Bhratrikaraka', 'Matrikaraka',
    'Pitrikaraka', 'Putrakaraka', 'Gnatikaraka', 'Darakaraka',
]
# 7 卡拉卡(古典):不含罗睺、无 PiK;序 AK>AmK>BK>MK>PK>GK>DK。
KARAKA_LABELS_7 = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK']
KARAKA_FULL_7 = [
    'Atmakaraka', 'Amatyakaraka', 'Bhratrikaraka', 'Matrikaraka',
    'Putrakaraka', 'Gnatikaraka', 'Darakaraka',
]


def quality(sign):
    if sign in MOVABLE:
        return 'movable'
    if sign in FIXED:
        return 'fixed'
    return 'dual'


def is_odd(sign):
    return sign in ODD_SIGNS


def index_of(sign):
    return SIGN_INDEX.get(sign, 0)


def sign_at(idx):
    return SIGNS[idx % 12]


def offset_sign(sign, n):
    """从 sign 顺黄道走 n 宫(n>=1，n=1 即本宫)的 rasi。"""
    return SIGNS[(SIGN_INDEX.get(sign, 0) + (n - 1)) % 12]


def house_distance(from_sign, to_sign):
    """to_sign 在 from_sign 的第几宫(1-12，含本宫=1)。"""
    return ((SIGN_INDEX.get(to_sign, 0) - SIGN_INDEX.get(from_sign, 0)) % 12) + 1


# ── P-a 行星友谊（Ch3.4 Table7/8）────────────────────────────────────────
# 自然关系(Table7)：friend / neutral / enemy（节点书表未列 → 默认 neutral，不臆造）。
_NATURAL_FRIENDS = {
    const.SUN: {const.MOON, const.MARS, const.JUPITER},
    const.MOON: {const.SUN, const.MERCURY},
    const.MARS: {const.SUN, const.MOON, const.JUPITER},
    const.MERCURY: {const.SUN, const.VENUS},
    const.JUPITER: {const.SUN, const.MOON, const.MARS},
    const.VENUS: {const.MERCURY, const.SATURN},
    const.SATURN: {const.MERCURY, const.VENUS},
}
_NATURAL_ENEMIES = {
    const.SUN: {const.VENUS, const.SATURN},
    const.MOON: set(),
    const.MARS: {const.MERCURY},
    const.MERCURY: {const.MOON},
    const.JUPITER: {const.MERCURY, const.VENUS},
    const.VENUS: {const.SUN, const.MOON},
    const.SATURN: {const.SUN, const.MOON, const.MARS},
}


def natural_relation(a, b):
    """a 看 b 的自然关系：'friend'/'neutral'/'enemy'（不对称无所谓，Table7 对称）。"""
    if a == b:
        return 'self'
    if b in _NATURAL_FRIENDS.get(a, set()):
        return 'friend'
    if b in _NATURAL_ENEMIES.get(a, set()):
        return 'enemy'
    return 'neutral'


def tatkalika_relation(a, b, planet_signs):
    """临时关系：b 在 a 所在宫起的 2/3/4/10/11/12 宫内 = 临时友，其余 = 临时敌。"""
    sa = planet_signs.get(a)
    sb = planet_signs.get(b)
    if sa is None or sb is None or a == b:
        return None
    dist = house_distance(sa, sb)
    return 'friend' if dist in (2, 3, 4, 10, 11, 12) else 'enemy'


# 复合(Table8)：自然×临时 → 五级
_COMPOUND = {
    ('friend', 'friend'): 'adhimitra',
    ('friend', 'enemy'): 'sama',
    ('neutral', 'friend'): 'mitra',
    ('neutral', 'enemy'): 'satru',
    ('enemy', 'friend'): 'sama',
    ('enemy', 'enemy'): 'adhisatru',
}


def compound_relation(a, b, planet_signs):
    """复合关系(Table8)：返回 adhimitra/mitra/sama/satru/adhisatru（或 None）。"""
    nat = natural_relation(a, b)
    if nat in ('self', None):
        return None
    tat = tatkalika_relation(a, b, planet_signs)
    if tat is None:
        return None
    return _COMPOUND.get((nat, tat))


_FRIENDLY = {'adhimitra', 'mitra'}
_HOSTILE = {'satru', 'adhisatru'}


def compound_friendly(a, b, planet_signs):
    """复合是否「友」(adhimitra/mitra)。"""
    return compound_relation(a, b, planet_signs) in _FRIENDLY


def friend_signs(planet, planet_signs):
    """planet 的「友宫」= 复合为 mitra/adhimitra 的行星所拥有的星座(用 OWN_SIGNS)。"""
    from astrostudy.india.jyotish_engine import OWN_SIGNS
    out = set()
    for other, signs in OWN_SIGNS.items():
        if other == planet:
            continue
        if compound_friendly(planet, other, planet_signs):
            out.update(signs)
    return out


# ── P-b Rasi Drishti（Ch10.3）────────────────────────────────────────────
def rasi_drishti(sign):
    """该 rasi 照见的 rasi 列表：动→所有定(除相邻定)、定→所有动(除相邻动)、双→所有其它双。"""
    # 受照座此前按 set 迭代:字符串哈希按进程随机 → 同一盘重启后端后行序不同,
    # AI 快照/导出 [节点主照] 行序随每次启动漂移。改按黄道序(SIGNS)输出,内容集合不变。
    q = quality(sign)
    if q == 'movable':
        adjacent = offset_sign(sign, 2)  # 下一宫(必为定)
        return [s for s in SIGNS if s in FIXED and s != adjacent]
    if q == 'fixed':
        prev = offset_sign(sign, 12)  # 上一宫(必为动)
        return [s for s in SIGNS if s in MOVABLE and s != prev]
    # dual → 其它三个 dual
    return [s for s in SIGNS if s in DUAL and s != sign]


def rasi_aspects(from_sign, to_sign):
    return to_sign in rasi_drishti(from_sign)


# ── P-c 8 卡拉卡（Ch8.2 Table13）─────────────────────────────────────────
def _karaka_degree(planet, lon):
    """卡拉卡用度 = 行星在其 rasi 内的度(0-30)；罗睺取逆量 30−度。"""
    deg = float(lon) % 30.0
    if planet == const.NORTH_NODE:
        deg = 30.0 - deg
    return deg


def chara_karakas(planet_lons, scheme='8'):
    """按卡拉卡用度降序取 Chara Kāraka。

    scheme='8'(默认,现状):8 曜含罗睺(逆量 30−宿内度),序 AK..PiK..DK;
    scheme='7'(古典):剔除罗睺,7 名序 AK>AmK>BK>MK>PK>GK>DK(无 PiK)。
    planet_lons: {planet_id: 黄经}。tie:用度更高者在前(浮点已含分秒精度)。
    """
    seven = str(scheme) == '7'
    labels = KARAKA_LABELS_7 if seven else KARAKA_LABELS_8
    fulls = KARAKA_FULL_7 if seven else KARAKA_FULL_8
    rows = []
    for p in KARAKA_PLANETS:
        if p not in planet_lons:
            continue
        if seven and p == const.NORTH_NODE:
            continue
        rows.append({'planet': p, 'degree': _karaka_degree(p, planet_lons[p])})
    rows.sort(key=lambda r: r['degree'], reverse=True)
    out = []
    for i, r in enumerate(rows):
        out.append({
            'planet': r['planet'],
            'label': labels[i] if i < len(labels) else '',
            'full': fulls[i] if i < len(fulls) else '',
            'degree': round(r['degree'], 4),
        })
    return out


# ── P-d Vargottama（D1 星座 == 分盘星座）──────────────────────────────────
def sign_of_lon(lon):
    """黄经(0-360)落在的 rasi。"""
    return SIGNS[int(float(lon) // 30.0) % 12]


def varga_sign(d1_lon, varga):
    """该 D1 黄经在指定分盘(varga=chartnum)的 rasi(纯算，复用排盘 varga_position)。"""
    from astrostudy.india.varga import varga_position
    return sign_of_lon(varga_position(float(d1_lon), varga))


def is_vargottama(d1_lon, varga=9):
    """vargottama：D1 星座与分盘(默认 D9 navamsa)星座相同。"""
    return sign_of_lon(d1_lon) == varga_sign(d1_lon, varga)


# ── P-e Varga 组 + Amsa-bala（Ch6.6 Table7）──────────────────────────────
# 组成员(chartnum)：计数 = 该组内行星居 MT/own/旺 的分盘数。
SHADVARGA = [1, 2, 3, 9, 12, 30]
SAPTAVARGA = [1, 2, 3, 7, 9, 12, 30]
DASAVARGA = [1, 2, 3, 7, 9, 10, 12, 16, 30, 60]
SHODASAVARGA = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]
VARGA_GROUPS = {
    'shadvarga': SHADVARGA,
    'saptavarga': SAPTAVARGA,
    'dasavarga': DASAVARGA,
    'shodasavarga': SHODASAVARGA,
}
# 命中数(count≥2) → amsa 名（Ch6.6 Table7，逐组）。
AMSA_NAMES = {
    'shadvarga': {2: 'Kimsuka', 3: 'Vyanjana', 4: 'Chamara', 5: 'Chatra', 6: 'Kundala'},
    'saptavarga': {2: 'Kimsuka', 3: 'Vyanjana', 4: 'Chamara', 5: 'Chatra', 6: 'Kundala',
                   7: 'Mukuta'},
    'dasavarga': {2: 'Parijata', 3: 'Uttama', 4: 'Gopura', 5: 'Simhasana', 6: 'Paravata',
                  7: 'Devaloka', 8: 'Brahmaloka', 9: 'Airavata', 10: 'Sridhama'},
    'shodasavarga': {2: 'Bhedaka', 3: 'Kusuma', 4: 'Nagapurusha', 5: 'Kanduka', 6: 'Kerala',
                     7: 'Kalpavriksha', 8: 'Chandanavana', 9: 'Poornachandra', 10: 'Uchchaisrava',
                     11: 'Dhanvantari', 12: 'Suryakanta', 13: 'Vidruma', 14: 'Indrasana',
                     15: 'Goloka', 16: 'SreeVallabha'},
}


def amsa_name(group, count):
    """命中盘数 count → amsa 名（count<2 无名 → None）。"""
    return AMSA_NAMES.get(group, {}).get(int(count))


def varga_signs(d1_lon, group):
    """该 D1 黄经在某 varga 组各分盘的 rasi：{chartnum: sign}（纯算）。"""
    return {v: varga_sign(d1_lon, v) for v in VARGA_GROUPS.get(group, [])}


def amsa_bala(dignified_vargas, group):
    """Amsa-bala：dignified_vargas = 行星「居 MT/own/旺」的分盘号集合(由引擎按 dignity 表算出)。

    返回 {'group','count','amsa'}：count = 该组成员里命中的分盘数；amsa = 对应名(或 None)。
    """
    members = set(VARGA_GROUPS.get(group, []))
    count = len(set(dignified_vargas) & members)
    return {'group': group, 'count': count, 'amsa': amsa_name(group, count)}


# ── P-f 长寿前置（Ch14：Rudra / Trishoola）────────────────────────────────
# Table32：求 Rudra 所用的特殊「8 宫」rasi（奇宫顺/偶宫逆构成，书表直录、非简单第8宫）。
_RUDRA_TABLE32 = {
    const.ARIES: const.SCORPIO, const.TAURUS: const.GEMINI, const.GEMINI: const.CAPRICORN,
    const.CANCER: const.SAGITTARIUS, const.LEO: const.CANCER, const.VIRGO: const.AQUARIUS,
    const.LIBRA: const.TAURUS, const.SCORPIO: const.SAGITTARIUS, const.SAGITTARIUS: const.CANCER,
    const.CAPRICORN: const.GEMINI, const.AQUARIUS: const.CAPRICORN, const.PISCES: const.LEO,
}


def rudra_8th(sign):
    """Table32：sign 对应的「求 Rudra 用 8 宫」rasi。"""
    return _RUDRA_TABLE32.get(sign)


def rudra_candidate_signs(lagna_sign):
    """Rudra 两候选 rasi = lagna 的 Table32 与 7 宫的 Table32；较强者之主为 Rudra(强弱由引擎判)。"""
    seventh = offset_sign(lagna_sign, 7)
    return (rudra_8th(lagna_sign), rudra_8th(seventh))


def trishoola(rudra_sign):
    """Trishoola = Rudra 所在 rasi 的三个三角(本/5/9 宫)。"""
    return [rudra_sign, offset_sign(rudra_sign, 5), offset_sign(rudra_sign, 9)]


# ── P-g Abhijit（28 宿口径）───────────────────────────────────────────────
# Abhijit(宿曜 28 宿名「牛」;主星织女 Vega)= sidereal 276°40′–280°53′20″，由 Uttara Ashadha 末 pada(3°20′)
# + Shravana 前 1/15(0°53′20″) 组成，跨度 4°13′20″。插入后仅这两宿缩短，28 宿和仍 360°。
# Vimshottari / 月宿 / navamsa 恒用 27 宿、不含 Abhijit；28 宿主要用于择吉/显示口径。
ABHIJIT_START = 276.0 + 40.0 / 60.0                  # 276°40′ = 276.66667°
ABHIJIT_END = 280.0 + 53.0 / 60.0 + 20.0 / 3600.0    # 280°53′20″ = 280.88889°
ABHIJIT_NAME = 'Abhijit'
ABHIJIT_LABEL = '牛'                                  # 宿名(与表中斗 / 女 / 虚 … 同为宿名);主星 Vega(织女)是星名不是宿名
ABHIJIT_NAK_NUMBER_28 = 22                            # 28 宿体系中 Abhijit 为第 22 宿


def is_abhijit(lon):
    """该 sidereal 经度是否落在 Abhijit 区间 [276°40′, 280°53′20″)。"""
    return ABHIJIT_START <= (float(lon) % 360.0) < ABHIJIT_END


def nakshatra_number_28(lon, nak27_index):
    """27 宿编号(1-27) → 28 宿编号：Abhijit 区内=22；UA 及之前(≤21)不变；Shravana 起(≥22)+1。
    仅编号/口径转换，27 宿名表不变(Vimshottari 等仍按 27 宿)。"""
    if is_abhijit(lon):
        return ABHIJIT_NAK_NUMBER_28
    return nak27_index if nak27_index <= 21 else nak27_index + 1


# ── 星曜状态支撑：燃烧(combust/asta) + Baladi avastha ─────────────────────
# BPHS 标准燃烧距日度数(asta orb)；水/金逆行用更小 orb。日与节点不判燃烧。
_COMBUST_ORB = {
    const.MOON: 12.0, const.MARS: 17.0, const.MERCURY: 14.0,
    const.JUPITER: 11.0, const.VENUS: 10.0, const.SATURN: 15.0,
}
_COMBUST_ORB_RETRO = {const.MERCURY: 12.0, const.VENUS: 8.0}


def is_combust(planet, planet_lon, sun_lon, retrograde=False):
    """行星是否燃烧(asta)：与太阳黄经角距 < BPHS orb(水/金逆行用更小 orb)。日/节点恒 False。"""
    if planet not in _COMBUST_ORB:
        return False
    orb = _COMBUST_ORB_RETRO[planet] if (retrograde and planet in _COMBUST_ORB_RETRO) else _COMBUST_ORB[planet]
    diff = abs((float(planet_lon) - float(sun_lon) + 180.0) % 360.0 - 180.0)
    return diff < orb


# Baladi avastha(5 态，按行星在本宫度数，每 6° 一态)：奇宫顺 Bala..Mrita、偶宫逆。
_BALADI = ['Bala', 'Kumara', 'Yuva', 'Vriddha', 'Mrita']
_BALADI_CN = ['婴儿', '少年', '青年', '老年', '死亡']


def baladi_avastha(sign, signlon):
    """Baladi avastha：奇宫 0-6°=Bala … 24-30°=Mrita；偶宫反序。返回 {key,label,index}。"""
    band = min(4, max(0, int(float(signlon) // 6.0)))
    if sign in EVEN_SIGNS:
        band = 4 - band
    return {'key': _BALADI[band], 'label': _BALADI_CN[band], 'index': band + 1}


# ── 边界安全取段(宿 / 步 / 分盘段 / KP 段共用)─────────────────────────────
# 精确落在段界的浮点值(如 93.333…=7×13°20′、20°=6×3°20′)做 value/span 会得 6.9999999999999
# → int() 判到前一段。统一加 1e-9 段宽容差再取整,并钳到 [0, count-1]。
_SEG_EPS = 1e-9


def segment_index(value, span, count):
    """value 落在第几段(0 起;每段宽 span,共 count 段)。精确段界归后一段。"""
    import math as _m
    idx = int(_m.floor(float(value) / float(span) + _SEG_EPS))   # segment-ok: 单源定义本身
    return max(0, min(int(count) - 1, idx))


# ── 尊贵档(单一实现;盘面因子 / 瑜伽引擎共用)────────────────────────────
# 旺宫与本三角同座的两曜(月:金牛;水:处女)按度段分:旺度段 = [0, 本三角起度),
# 本三角 = 本三角度段,其后 = 自宫(水星处女 20-30°;月亮金牛非自宫 → 旺座内余度归旺)。
# 其余五曜旺座整座为旺。判定序:旺度段 → 落陷 → 本三角 → 自宫 → 中性。
EXALTATION_POINTS = {
    const.SUN: (const.ARIES, 10),
    const.MOON: (const.TAURUS, 3),
    const.MARS: (const.CAPRICORN, 28),
    const.MERCURY: (const.VIRGO, 15),
    const.JUPITER: (const.CANCER, 5),
    const.VENUS: (const.PISCES, 27),
    const.SATURN: (const.LIBRA, 20),
    const.NORTH_NODE: (const.TAURUS, 20),
    const.SOUTH_NODE: (const.SCORPIO, 20),
}
OWN_SIGN_TABLE = {
    const.SUN: (const.LEO,),
    const.MOON: (const.CANCER,),
    const.MARS: (const.ARIES, const.SCORPIO),
    const.MERCURY: (const.GEMINI, const.VIRGO),
    const.JUPITER: (const.SAGITTARIUS, const.PISCES),
    const.VENUS: (const.TAURUS, const.LIBRA),
    const.SATURN: (const.CAPRICORN, const.AQUARIUS),
}


def classify_dignity(planet, sign, signlon, include_nodes=True):
    """尊贵档:deep_exaltation / exaltation / debilitation / moolatrikona / own_sign / neutral。

    include_nodes=False 时罗计不判旺落(瑜伽引擎口径:节点无旺落)。"""
    deg = float(signlon)
    ex = EXALTATION_POINTS.get(planet)
    if ex is not None and (include_nodes or planet not in (const.NORTH_NODE, const.SOUTH_NODE)):
        exalt_sign, exalt_deg = ex
        deb_sign = SIGNS[(SIGN_INDEX[exalt_sign] + 6) % 12]
        if sign == exalt_sign:
            mt = MOOLATRIKONA.get(planet)
            band_end = mt[1] if (mt is not None and mt[0] == exalt_sign) else 30.0
            if deg < band_end:
                return 'deep_exaltation' if abs(deg - exalt_deg) < 1 else 'exaltation'
        elif sign == deb_sign:
            return 'debilitation'
    mt = MOOLATRIKONA.get(planet)
    if mt is not None and sign == mt[0] and mt[1] <= deg <= mt[2]:
        return 'moolatrikona'
    if sign in OWN_SIGN_TABLE.get(planet, ()):
        return 'own_sign'
    return 'neutral'


def relation_to_sign_lord(planet, sign, planet_signs):
    """本曜对所在座主的复合友敌(adhimitra/mitra/sama/satru/adhisatru);
    座主即本曜 → 'self';节点或无座主 → None。临时友敌按 planet_signs(D1)判。"""
    lord = SIGN_LORDS.get(sign)
    if lord is None or planet not in _NATURAL_FRIENDS:
        return None
    if lord == planet:
        return 'self'
    return compound_relation(planet, lord, planet_signs)


# ── 吠陀日(日界 = 日出)星期:本命 / 问事 / 校时 / 六力 / KP RP 单一来源 ───────
def local_weekday(jd, utcoffset):
    """jd(UT)在当地(utcoffset:时区串 '+05:30' 或小时数)的民用日星期,0=周日。"""
    from flatlib.datetime import Datetime
    return Datetime.fromJD(float(jd), utcoffset).date.dayofweek()


def vedic_weekday(jd, lat, lon, utcoffset):
    """吠陀日星期(0=周日):出生 / 起卦时刻之前最近一次日出所在的当地日期 → 星期。

    返回 (weekday, sunrise_jd)。日出求不出(极昼 / 极夜)→ (民用日星期, None)。"""
    try:
        from flatlib.ephem import eph
        sr = eph.lastSunrise(float(jd), lat, lon)
        if sr is None or not (float(jd) - 1.5 < float(sr) <= float(jd) + 1e-9):
            raise ValueError('no sunrise')
        return local_weekday(sr, utcoffset), float(sr)
    except Exception:
        return local_weekday(jd, utcoffset), None


# ── Abhijit 须臾(第 8 昼须臾)吉否:唯吠陀日周三不取(本命面板 / 出生须臾 / 择日两种取法单一来源)──
ABHIJIT_EXCLUDED_WEEKDAY_SUN0 = 3      # 0=周日 → 3=周三


def abhijit_auspicious(vedic_weekday_sun0):
    """吠陀日(日界 = 日出;0=周日)当天的 Abhijit 须臾是否取吉。唯周三不取。"""
    return int(vedic_weekday_sun0) % 7 != ABHIJIT_EXCLUDED_WEEKDAY_SUN0


def muhurta_effective_nature(row, vedic_weekday_sun0):
    """须臾表行 → 当天实际吉凶档:Abhijit 在周三不取吉 → 记 'mixed'(不取吉、亦不另判凶);
    其余行按表。row 为 muhurta_day 表行(含 isAbhijit / nature)。"""
    nature = str((row or {}).get('nature', '')).lower()
    if (row or {}).get('isAbhijit') and vedic_weekday_sun0 is not None \
            and not abhijit_auspicious(vedic_weekday_sun0):
        return 'mixed'
    return nature


def weekday_mon0(weekday_sun0):
    """星期序换域:0=周日(flatlib / 本模块)→ 0=周一(kp_system.WEEKDAY_LORDS)。"""
    return (int(weekday_sun0) - 1) % 7


# ── Panchaka 五忌(Muhūrta 古法)单一公式:页面 / 择日条件共用 ──────────────
# (Tithi 1..30 + Vāra 周日=1..周六=7 + Nakṣatra 1..27 + Lagna 白羊=1..双鱼=12) mod 9:
# 余 1 死 / 2 火 / 4 王 / 6 盗 / 8 病 为忌,余 0 / 3 / 5 / 7 无忌。
PANCHAKA_TYPES = {1: ('Mrityu', '死忌'), 2: ('Agni', '火忌'), 4: ('Raja', '王忌'),
                  6: ('Chora', '盗忌'), 8: ('Roga', '病忌')}


def panchaka_remainder(tithi, vara_sun0, nakshatra, lagna_sign_no):
    """vara_sun0 为 0=周日 的星期序(内部 +1 成 周日=1)。"""
    return (int(tithi) + (int(vara_sun0) + 1) + int(nakshatra) + int(lagna_sign_no)) % 9
