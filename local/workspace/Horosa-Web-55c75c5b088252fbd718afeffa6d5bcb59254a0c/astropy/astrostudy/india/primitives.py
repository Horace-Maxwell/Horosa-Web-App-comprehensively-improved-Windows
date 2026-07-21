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
    # horosa_rasi_drishti_stable_order_v1(PERF-R9;跨平台,建议上游化 Mac):
    # MOVABLE/FIXED/DUAL 是 **set**,直接 `for s in FIXED` 会继承集合的哈希迭代顺序;
    # 而 CPython 默认开启哈希随机化(发货 app 不设 PYTHONHASHSEED)⇒ 同一张盘每次启动后
    # rasiDrishti 的 aspects/aspectLabels 排列都可能不同(实测跨进程 17/205 例仅顺序有别)。
    # 改为遍历 SIGNS(黄道十二宫规范次序)再过滤:成员逐元素不变,顺序从「任意且不稳定」
    # 变为「确定且符合星座次序」。集合本身保留 —— 其它地方靠它做 O(1) 归属判断。
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


def chara_karakas(planet_lons):
    """8 曜含罗睺逆量，按卡拉卡用度降序 → AK..DK。

    planet_lons: {planet_id: 黄经}。返回 [{'planet','label','full','degree'} …] 长度 8。
    tie：用度更高者在前(浮点已含分秒精度)。
    """
    rows = []
    for p in KARAKA_PLANETS:
        if p not in planet_lons:
            continue
        rows.append({'planet': p, 'degree': _karaka_degree(p, planet_lons[p])})
    rows.sort(key=lambda r: r['degree'], reverse=True)
    out = []
    for i, r in enumerate(rows):
        out.append({
            'planet': r['planet'],
            'label': KARAKA_LABELS_8[i] if i < len(KARAKA_LABELS_8) else '',
            'full': KARAKA_FULL_8[i] if i < len(KARAKA_FULL_8) else '',
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
# Abhijit(织女 Vega)= sidereal 276°40′–280°53′20″，由 Uttara Ashadha 末 pada(3°20′)
# + Shravana 前 1/15(0°53′20″) 组成，跨度 4°13′20″。插入后仅这两宿缩短，28 宿和仍 360°。
# Vimshottari / 月宿 / navamsa 恒用 27 宿、不含 Abhijit；28 宿主要用于择吉/显示口径。
ABHIJIT_START = 276.0 + 40.0 / 60.0                  # 276°40′ = 276.66667°
ABHIJIT_END = 280.0 + 53.0 / 60.0 + 20.0 / 3600.0    # 280°53′20″ = 280.88889°
ABHIJIT_NAME = 'Abhijit'
ABHIJIT_LABEL = '织女'                                # Vega/Abhijit(28 宿，唯一阳性宿)
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
