# -*- coding: utf-8 -*-
"""六力(Shadbala，六源全量)+ 八分点 Sodhana / Kakshya。

独立纯函数模块——只取行星位置 / 星座 / 宫等简单数据(dict)，**不耦合排盘引擎内部状态**，
便于单测与对拍。坐标系：rasi Ar=1..Pi=12，经度均为 sidereal 黄经(0-360)。

六力(Shadbala 六源)：
  1. Sthana(位置力)  = Uchcha + Saptavargaja + Ojayugma + Kendradi + Drekkana
  2. Dig(方向力)
  3. Kala(时间力)    = Nathonnatha + Paksha + Tribhaga + (年/月/日/时主) + Ayana + (战力 Yuddha)
  4. Cheshta(运动力)  逆 / 反退 / 留 / 缓 / 平 / 速 / 超速 八态
  5. Naisargika(自然力)  固定 virupa 定值(标准):日60 > 月51.43 > 金42.86 > 木34.29 > 水25.71 > 火17.14 > 土8.57
  6. Drik(相位力)     吉照(+) / 凶照(−) 净虚拉
合 → Rupas(总 virupa ÷ 60) + 所需强度比 + Ishta/Kashta phala 框架。

精确 virupa 子项均按标准计算口径直接实现：Saptavargaja 七盘尊贵档累加、Kala 各子项
(三分时/年月日时主/赤纬)、Cheshta 八态档值、Drik 分段虚拉式。仍需外部输入(如年/月主曜的
确切历法时刻)才能精确化的子项，缺输入时按 pending 计 0 并标注。所有标识符 / 注释 / 测试名
均为中性技术描述，不出现任何来源专名。
"""

from flatlib import const

# ── 基础常量(与 primitives 对齐，但本模块自带一份以保持独立可单测)──────────
SIGNS = [
    const.ARIES, const.TAURUS, const.GEMINI, const.CANCER, const.LEO, const.VIRGO,
    const.LIBRA, const.SCORPIO, const.SAGITTARIUS, const.CAPRICORN, const.AQUARIUS, const.PISCES,
]
SIGN_INDEX = {s: i for i, s in enumerate(SIGNS)}          # 0-based

ODD_SIGNS = {const.ARIES, const.GEMINI, const.LEO, const.LIBRA, const.SAGITTARIUS, const.AQUARIUS}

# 七实体力主曜(六力只算七实曜，不含罗/计——节点无 own/exalt，传统不入 Shadbala)
SHADBALA_PLANETS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY,
    const.JUPITER, const.VENUS, const.SATURN,
]

# 一 Rupa = 60 virupa。
VIRUPA_PER_RUPA = 60.0


def _sign_index(sign):
    return SIGN_INDEX.get(sign, 0)


def _house_distance(from_sign, to_sign):
    """to_sign 在 from_sign 的第几宫(1-12，本宫=1)。"""
    return ((_sign_index(to_sign) - _sign_index(from_sign)) % 12) + 1


def _ang_sep(a, b):
    """两黄经最短角距(0-180)。"""
    return abs((float(a) - float(b) + 180.0) % 360.0 - 180.0)


# ════════════════════════════════════════════════════════════════════════════
# 5. Naisargika Bala(自然力)——固定 virupa 定值(标准，可直接写)
# ════════════════════════════════════════════════════════════════════════════
# 七曜亮度序固定值(virupa)。等价 60×(7..1)/7：日60 月51.43 金42.86 木34.29 水25.71 火17.14 土8.57。
NAISARGIKA_VIRUPA = {
    const.SUN: 60.0,
    const.MOON: 60.0 * 6.0 / 7.0,      # 51.4286
    const.VENUS: 60.0 * 5.0 / 7.0,     # 42.8571
    const.JUPITER: 60.0 * 4.0 / 7.0,   # 34.2857
    const.MERCURY: 60.0 * 3.0 / 7.0,   # 25.7143
    const.MARS: 60.0 * 2.0 / 7.0,      # 17.1429
    const.SATURN: 60.0 * 1.0 / 7.0,    # 8.5714
}


def naisargika_bala(planet):
    """自然力(virupa 固定值)。非七实曜 → 0.0。"""
    return float(NAISARGIKA_VIRUPA.get(planet, 0.0))


# ════════════════════════════════════════════════════════════════════════════
# 1. Sthana Bala(位置力)= Uchcha + Saptavargaja + Ojayugma + Kendradi + Drekkana
# ════════════════════════════════════════════════════════════════════════════

# ── 1a Uchcha Bala(旺度力)——线性式，直接实现 ────────────────────────────
# 深旺点(rasi, 度)；落点为对宫同度。距深落点的角距 /3 = virupa(0 落点 ~ 60 旺点)。
DEEP_EXALT = {
    const.SUN: (const.ARIES, 10.0),
    const.MOON: (const.TAURUS, 3.0),
    const.MARS: (const.CAPRICORN, 28.0),
    const.MERCURY: (const.VIRGO, 15.0),
    const.JUPITER: (const.CANCER, 5.0),
    const.VENUS: (const.PISCES, 27.0),
    const.SATURN: (const.LIBRA, 20.0),
}


def _deep_exalt_lon(planet):
    sign, deg = DEEP_EXALT[planet]
    return _sign_index(sign) * 30.0 + deg


def uchcha_bala(planet, lon):
    """旺度力：距深落点角距 ÷ 3 → virupa。深旺=60、深落=0。"""
    if planet not in DEEP_EXALT:
        return 0.0
    exalt_lon = _deep_exalt_lon(planet)
    debil_lon = (exalt_lon + 180.0) % 360.0
    sep_from_debil = _ang_sep(lon, debil_lon)      # 0(在落点)…180(在旺点)
    return sep_from_debil / 3.0


# ── 1b Saptavargaja Bala(七分位尊贵力)——七盘尊贵档累加，直接实现 ──────────
# 七分位组(7 盘){D1,D2,D3,D7,D9,D12,D30}：逐盘按该曜在所落星座的尊贵态给一档 virupa，七盘累加。
# 尊贵档 → virupa：本垣三角(仅 D1)45 / 自庙 30 / 至友 22.5 / 友 15 / 中 7.5 / 敌 3.75 / 至敌 1.875。
SAPTAVARGA_CHARTS = [1, 2, 3, 7, 9, 12, 30]        # D1,D2,D3,D7,D9,D12,D30

# 尊贵档 → virupa（标准计算口径）。moolatrikona 仅在 D1 计入(其余盘退回 own/friend 等)。
SAPTAVARGAJA_VIRUPA_BY_DIGNITY = {
    'moolatrikona': 45.0,
    'own_sign': 30.0,
    'adhimitra': 22.5,     # 至友(great friend)
    'friend': 15.0,        # 友(mitra)
    'neutral': 7.5,        # 中(sama)
    'enemy': 3.75,         # 敌(satru)
    'adhisatru': 1.875,    # 至敌(great enemy)
}


def saptavargaja_bala(per_varga_dignity=None):
    """七分位力：per_varga_dignity = {chartnum: dignity_key}(七盘各自尊贵态)，七盘累加。

    dignity_key ∈ {moolatrikona, own_sign, adhimitra, friend, neutral, enemy, adhisatru}。
    缺七盘尊贵字典 → 0.0 + pending(引擎未传分盘尊贵态)；给齐则按档值累加、不再 pending。
    """
    if not per_varga_dignity:
        return {'virupa': 0.0, 'pending': True}
    total = 0.0
    for _chart, dignity in per_varga_dignity.items():
        total += float(SAPTAVARGAJA_VIRUPA_BY_DIGNITY.get(dignity, 0.0))
    return {'virupa': total, 'pending': False}


# ── Saptavargaja 自给型尊贵分类(模块自含，便于单测/对拍，不依赖引擎)──────────
# 输入 D1 黄经 + 全七曜 D1 星座，逐盘算该曜在所落星座的尊贵档(moolatrikona 仅 D1)。
_OWN_SIGNS = {
    const.SUN: {const.LEO},
    const.MOON: {const.CANCER},
    const.MARS: {const.ARIES, const.SCORPIO},
    const.MERCURY: {const.GEMINI, const.VIRGO},
    const.JUPITER: {const.SAGITTARIUS, const.PISCES},
    const.VENUS: {const.TAURUS, const.LIBRA},
    const.SATURN: {const.CAPRICORN, const.AQUARIUS},
}
# 本垣三角(Moolatrikona)：星座 + 度区间(仅 D1 按度判)。
_MOOLATRIKONA = {
    const.SUN: (const.LEO, 0.0, 20.0),
    const.MOON: (const.TAURUS, 4.0, 30.0),
    const.MARS: (const.ARIES, 0.0, 12.0),
    const.MERCURY: (const.VIRGO, 16.0, 20.0),
    const.JUPITER: (const.SAGITTARIUS, 0.0, 10.0),
    const.VENUS: (const.LIBRA, 0.0, 15.0),
    const.SATURN: (const.AQUARIUS, 0.0, 20.0),
}
# 星座主曜(用于「该曜在某星座 → 看与该星座主的复合友谊」)。
_SIGN_LORD = {}
for _p, _signs in _OWN_SIGNS.items():
    for _s in _signs:
        _SIGN_LORD[_s] = _p


def _sign_of_lon(lon):
    return SIGNS[int(float(lon) // 30.0) % 12]


def saptavargaja_dignity_map(planet, d1_lon, planet_signs, signlon=None, variants=None):
    """七盘 {chartnum: dignity_key}：逐盘按该曜在所落星座的尊贵态分类。

    planet_signs = {planet_id: D1 星座} (复合友谊用，含全七曜 D1 星座)。
    各盘星座由 D1 经度经 varga_position 算。moolatrikona 仅 D1 且按度判，其余盘退回 own/友谊。
    """
    from astrostudy.india.varga import varga_position
    out = {}
    for chart in SAPTAVARGA_CHARTS:
        if chart == 1:
            vlon = float(d1_lon)
            vsign = _sign_of_lon(vlon)
            # 🔴 D1 座内度恒由 d1_lon 自身导出:曾接受调用方传入的「当前显示分盘」signlon
            # → D1 星座 × 分盘座内度 跨基准判 moolatrikona(切分盘时档位漂移,同 dasha 四系锚同型)。
            # signlon 参数仅当调用方明确给的是 D1 域度数时才允许覆盖——现有调用已全部改传 D1 域。
            deg = float(signlon) if signlon is not None else (vlon % 30.0)
        else:
            vlon = varga_position(float(d1_lon), chart, (variants or {}).get(chart))
            vsign = _sign_of_lon(vlon)
            deg = vlon % 30.0
        out[chart] = _classify_dignity(planet, vsign, deg, planet_signs, allow_mt=(chart == 1))
    return out


def _classify_dignity(planet, sign, deg, planet_signs, allow_mt=True):
    """该曜在 sign(内度 deg)的尊贵档：moolatrikona/own_sign/adhimitra/friend/neutral/enemy/adhisatru。"""
    from astrostudy.india.primitives import compound_relation
    if allow_mt and planet in _MOOLATRIKONA:
        mt_sign, lo, hi = _MOOLATRIKONA[planet]
        if sign == mt_sign and lo <= deg <= hi:
            return 'moolatrikona'
    if sign in _OWN_SIGNS.get(planet, set()):
        return 'own_sign'
    lord = _SIGN_LORD.get(sign)
    if lord is None or lord == planet:
        return 'own_sign'
    rel = compound_relation(planet, lord, planet_signs)
    # compound_relation 返回 adhimitra/mitra/sama/satru/adhisatru（或 None）。
    return {
        'adhimitra': 'adhimitra', 'mitra': 'friend', 'sama': 'neutral',
        'satru': 'enemy', 'adhisatru': 'adhisatru',
    }.get(rel, 'neutral')


# ── Vimsopaka Bala（分盘 20 分力）——四组权重表（各组和 = 20，已核验）─────────
# 折算法：fraction = 18.1 同尊位 Virupa / 45（Moolatrikona 满），contribution = 权重 × fraction。
VIMSOPAKA_WEIGHTS = {
    'shadvarga':    {1: 6, 2: 2, 3: 4, 9: 5, 12: 2, 30: 1},
    'saptavarga':   {1: 5, 2: 2, 3: 3, 7: 2.5, 9: 4.5, 12: 2, 30: 1},
    'dasavarga':    {1: 3, 2: 1.5, 3: 1.5, 7: 1.5, 9: 1.5, 10: 1.5, 12: 1.5, 16: 1.5, 30: 1.5, 60: 5},
    'shodasavarga': {1: 3.5, 2: 1, 3: 1, 4: 0.5, 7: 0.5, 9: 3, 10: 0.5, 12: 0.5, 16: 2,
                     20: 0.5, 24: 0.5, 27: 0.5, 30: 1, 40: 0.5, 45: 0.5, 60: 4},
}


def vimsopaka_bala(planet, d1_lon, planet_signs, signlon=None, variants=None):
    """Vimsopaka 四组（Shad/Sapta/Dasa/Shodasa-varga）20 分力。某曜在每组各分盘按尊位
    （§18.1 同尊位比例，folded：fraction = Virupa/45）× 该盘权重求和，每组满分 20。
    复用 _classify_dignity（D1 允许 moolatrikona 按度，余盘 own/友谊）。返回逐组 total + perChart。"""
    from astrostudy.india.varga import varga_position
    out = {}
    for group, weights in VIMSOPAKA_WEIGHTS.items():
        total = 0.0
        per_chart = {}
        for chart, w in weights.items():
            if chart == 1:
                vsign = _sign_of_lon(float(d1_lon))
                deg = float(signlon) if signlon is not None else (float(d1_lon) % 30.0)
            else:
                vlon = varga_position(float(d1_lon), chart, (variants or {}).get(chart))
                vsign = _sign_of_lon(vlon)
                deg = vlon % 30.0
            dignity = _classify_dignity(planet, vsign, deg, planet_signs, allow_mt=(chart == 1))
            frac = SAPTAVARGAJA_VIRUPA_BY_DIGNITY.get(dignity, 0.0) / 45.0
            contrib = w * frac
            total += contrib
            per_chart[chart] = {'dignity': dignity, 'contribution': round(contrib, 4)}
        out[group] = {'total': round(total, 4), 'max': 20, 'perChart': per_chart}
    return out


# ── 1c Ojayugma Bala(奇偶力)——结构分，直接实现 ──────────────────────────
# 月/金 在偶 rasi 与偶 navamsa 各得 15；其余五曜在奇 rasi 与奇 navamsa 各得 15。每项满 15。
OJAYUGMA_EACH = 15.0
_EVEN_PREFER = {const.MOON, const.VENUS}      # 月/金喜偶；余喜奇


def _navamsa_sign(lon):
    """该黄经的 navamsa(D9)星座(纯算，自带最小实现以保持独立)。"""
    sign_i = int(float(lon) // 30.0) % 12
    deg_in = float(lon) % 30.0
    nav_i = int(deg_in // (30.0 / 9.0))           # 0..8
    # 标准 D9：动 rasi 从本宫起、定从第9、双从第5(每 rasi 起点循环)。
    starts = {'movable': sign_i, 'fixed': (sign_i + 8) % 12, 'dual': (sign_i + 4) % 12}
    if sign_i in (0, 3, 6, 9):
        q = 'movable'
    elif sign_i in (1, 4, 7, 10):
        q = 'fixed'
    else:
        q = 'dual'
    return SIGNS[(starts[q] + nav_i) % 12]


def ojayugma_bala(planet, lon):
    """奇偶力：rasi 与 navamsa 各按「喜奇/喜偶」匹配各得 15(满 30)。"""
    if planet not in SHADBALA_PLANETS:
        return 0.0
    rasi = SIGNS[int(float(lon) // 30.0) % 12]
    nav = _navamsa_sign(lon)
    prefer_even = planet in _EVEN_PREFER
    out = 0.0
    for s in (rasi, nav):
        is_odd = s in ODD_SIGNS
        if (prefer_even and not is_odd) or (not prefer_even and is_odd):
            out += OJAYUGMA_EACH
    return out


# ── 1d Kendradi Bala(宫位类别力)——结构分，直接实现 ────────────────────────
# 居 kendra(1/4/7/10)=60，panaphara(2/5/8/11)=30，apoklima(3/6/9/12)=15。从 lagna 起算。
KENDRA = {1, 4, 7, 10}
PANAPHARA = {2, 5, 8, 11}


def kendradi_bala(house_from_lagna):
    """宫位类别力：kendra 60 / panaphara 30 / apoklima 15。house 为从 lagna 起的宫号(1-12)。"""
    h = ((int(house_from_lagna) - 1) % 12) + 1
    if h in KENDRA:
        return 60.0
    if h in PANAPHARA:
        return 30.0
    return 15.0


# ── 1e Drekkana Bala(旬力)——结构分，直接实现 ─────────────────────────────
# rasi 三旬(0-10/10-20/20-30°)：阳曜(日火木)第一旬、阴曜(月金)第二旬、中性(水土)第三旬 得 15。
DREKKANA_EACH = 15.0
_DREKKANA_BAND = {           # planet → 得力旬序(0/1/2)
    const.SUN: 0, const.MARS: 0, const.JUPITER: 0,
    const.MOON: 1, const.VENUS: 1,
    const.MERCURY: 2, const.SATURN: 2,
}


def drekkana_bala(planet, signlon):
    """旬力：行星所在旬命中其「得力旬」→ 15，否则 0。signlon 为 rasi 内度(0-30)。"""
    if planet not in _DREKKANA_BAND:
        return 0.0
    band = min(2, int(float(signlon) // 10.0))
    return DREKKANA_EACH if band == _DREKKANA_BAND[planet] else 0.0


def sthana_bala(planet, lon, signlon, house_from_lagna, per_varga_dignity=None):
    """位置力合 = Uchcha + Saptavargaja + Ojayugma + Kendradi + Drekkana。

    返回各分量 + 合计；缺七盘尊贵态(per_varga_dignity)时 Saptavargaja pending=True、其分量计 0。
    """
    uc = uchcha_bala(planet, lon)
    sv = saptavargaja_bala(per_varga_dignity)
    oj = ojayugma_bala(planet, lon)
    kd = kendradi_bala(house_from_lagna)
    dk = drekkana_bala(planet, signlon)
    total = uc + sv['virupa'] + oj + kd + dk
    return {
        'uchcha': round(uc, 4),
        'saptavargaja': round(sv['virupa'], 4),
        'saptavargajaPending': sv['pending'],
        'ojayugma': round(oj, 4),
        'kendradi': round(kd, 4),
        'drekkana': round(dk, 4),
        'virupa': round(total, 4),
    }


# ════════════════════════════════════════════════════════════════════════════
# 2. Dig Bala(方向力)——线性式，直接实现
# ════════════════════════════════════════════════════════════════════════════
# 各曜在某「方向之宫」最强(60)、对宫最弱(0)，按宫距线性。
# 强向宫(从 lagna 起的宫号)：日/火=10(南)、木/水=1(东)、月/金=4(北)、土=7(西)。
DIG_STRONG_HOUSE = {
    const.SUN: 10, const.MARS: 10,
    const.JUPITER: 1, const.MERCURY: 1,
    const.MOON: 4, const.VENUS: 4,
    const.SATURN: 7,
}


def dig_bala(planet, house_from_lagna):
    """方向力：距「最弱宫(强向宫对宫)」的宫距(0-6)×10 → 0..60。"""
    strong = DIG_STRONG_HOUSE.get(planet)
    if strong is None:
        return 0.0
    h = ((int(house_from_lagna) - 1) % 12) + 1
    weak = ((strong + 6 - 1) % 12) + 1
    # 与最弱宫的环形宫距(0..6)，×10 → 满 60 在强向宫。
    dist_from_weak = min((h - weak) % 12, (weak - h) % 12)
    return dist_from_weak * 10.0


# ════════════════════════════════════════════════════════════════════════════
# 3. Kala Bala(时间力)= Nathonnatha + Paksha + Tribhaga + (年月日时主) + Ayana + Yuddha
# ════════════════════════════════════════════════════════════════════════════

# ── 3a Nathonnatha Bala(昼夜力)——结构式，直接实现 ────────────────────────
# 距午夜/正午的时间比例给 0..60。月火土(夜强)在午夜满、日水木(昼强)在正午满、水恒满。
# fraction_from_midnight ∈ [0,1]：0=午夜,0.5=正午,1=次午夜。
_NIGHT_STRONG = {const.MOON, const.MARS, const.SATURN}
_DAY_STRONG = {const.SUN, const.JUPITER, const.VENUS}


def nathonnatha_bala(planet, fraction_from_midnight):
    """昼夜力：水恒 60；夜强曜午夜满→正午 0；昼强曜正午满→午夜 0。线性。"""
    if planet == const.MERCURY:
        return 60.0
    f = float(fraction_from_midnight) % 1.0
    # 距正午(0.5)的对称度：day_strength 正午=60、午夜=0。
    day_strength = (1.0 - abs(f - 0.5) / 0.5) * 60.0
    if planet in _DAY_STRONG:
        return day_strength
    if planet in _NIGHT_STRONG:
        return 60.0 - day_strength
    return 0.0


# ── 3b Paksha Bala(月相力)——线性式，直接实现 ─────────────────────────────
# benefic 随月距日(0..180)增强(满月 60)、malefic 反之；月相 benefic 力另×2(标准)。
# 净 benefic 阵营按权威列(此处吉:月水木金;凶:日火土)；Paksha 用日月黄经差。
_PAKSHA_BENEFIC = {const.MOON, const.MERCURY, const.JUPITER, const.VENUS}


def paksha_bala(planet, sun_lon, moon_lon, moon_double=True):
    """月相力：吉曜 = sep/180×60、凶曜 = 60−该值；月(及吉曜)可加倍(moon_double)。"""
    sep = _ang_sep(sun_lon, moon_lon)             # 0(新月)…180(满月)
    benefic_val = sep / 180.0 * 60.0
    val = benefic_val if planet in _PAKSHA_BENEFIC else (60.0 - benefic_val)
    if moon_double and planet == const.MOON:
        val *= 2.0
    return val


# ── 3c Tribhaga Bala(三分时力)——昼/夜各三分段主曜，直接实现 ───────────────
# 昼(日出→日落)与夜各等分三段；出生所落段之主曜得 60。木恒得 60(每盘)。其余曜 0。
# 昼三段主：水/日/土；夜三段主：月/金/火。
TRIBHAGA_LORDS_DAY = [const.MERCURY, const.SUN, const.SATURN]
TRIBHAGA_LORDS_NIGHT = [const.MOON, const.VENUS, const.MARS]


def tribhaga_bala(planet, is_day=True, tribhaga_index=0):
    """三分时力：木恒 60；出生所落段主曜得 60，否则 0。

    is_day = 出生在昼(日出→日落)否；tribhaga_index = 0/1/2 三段序。
    """
    if planet == const.JUPITER:
        return {'virupa': 60.0, 'pending': False}
    lords = TRIBHAGA_LORDS_DAY if is_day else TRIBHAGA_LORDS_NIGHT
    seg = max(0, min(2, int(tribhaga_index)))
    return {'virupa': 60.0 if lords[seg] == planet else 0.0, 'pending': False}


# ── 3d 年/月/日/时主力(Abda/Masa/Vara/Hora Bala)──────────────────────────
# 年主 15、月主 30、日主 45、时主 60。
#   时主(Hora)= 出生所在行星时之主曜(行星时序固定:从该日 vara 主起，按日序循环七曜)。
#   日主(Vara)= 星期主曜 = 当日日出时的 hora 主。
#   月主(Masa)= 太阳进入当前星座之时刻的 hora 主；年主(Abda)= 太阳入白羊之时刻的 hora 主。
#     —— Masa/Abda 需该两时刻的精确历法换算(ephemeris)；引擎未传其主曜时本子项按 pending 计 0。
ABDA_VIRUPA = 15.0
MASA_VIRUPA = 30.0
VARA_VIRUPA = 45.0
HORA_VIRUPA = 60.0

# 行星时(hora)序：自日出后第 1 时起，按 土→木→火→日→金→水→月 的逆喜悦顺序(Chaldean)循环。
# 一昼夜 24 时；某日日出时的 hora 主即该日 vara 主(星期主)。
_HORA_CHALDEAN = [
    const.SATURN, const.JUPITER, const.MARS, const.SUN,
    const.VENUS, const.MERCURY, const.MOON,
]
# 七星期主(idx 0=周日…6=周六)。
WEEKDAY_LORDS = [
    const.SUN, const.MOON, const.MARS, const.MERCURY,
    const.JUPITER, const.VENUS, const.SATURN,
]


def hora_lord_at(weekday_index, hora_seq_index):
    """第 weekday_index 星期(0=周日)日出后第 hora_seq_index(0 起) 个行星时的主曜。

    日出 hora 主 = 当日 vara 主；之后按 Chaldean 逆喜悦序循环。
    """
    vara = WEEKDAY_LORDS[int(weekday_index) % 7]
    start = _HORA_CHALDEAN.index(vara)
    return _HORA_CHALDEAN[(start + int(hora_seq_index)) % 7]


def vara_bala(planet, weekday_lord):
    """日主力：星期主曜得 45(= 日出 hora 主)。"""
    return VARA_VIRUPA if planet == weekday_lord else 0.0


def hora_bala(planet, hora_lord):
    """时主力：出生所在行星时之主曜得 60(由引擎传入当时 hora 主)。"""
    return HORA_VIRUPA if planet == hora_lord else 0.0


def abda_masa_bala(planet, year_lord=None, month_lord=None):
    """年/月主力：年主 15 + 月主 30。年/月主曜需太阳入白羊/入当前星座时刻的 hora 主。

    引擎未传该两主曜时 → 0 + pending(精确化需 ephemeris 时刻)；传入则按命中累加、不再 pending。
    """
    pending = year_lord is None or month_lord is None
    val = 0.0
    if year_lord is not None and planet == year_lord:
        val += ABDA_VIRUPA
    if month_lord is not None and planet == month_lord:
        val += MASA_VIRUPA
    return {'virupa': val, 'pending': pending}


# ── 3e Ayana Bala(赤纬力)——Kranti 精确式，直接实现 ──────────────────────
# Kranti = 行星赤纬(最大约 24°)。Ayana = (24 ± Kranti)/48 × 60 virupa(赤纬 0 → 30)。
# 符号：日/火/木/金 北纬取「+」、南纬取「−」；月/土相反；水恒取「+」。太阳 Ayana 再 ×2。
_AYANA_MAX_KRANTI = 24.0
_AYANA_NORTH_PLUS = {const.SUN, const.MARS, const.JUPITER, const.VENUS}   # 北纬取 +
_AYANA_NORTH_MINUS = {const.MOON, const.SATURN}                          # 北纬取 −(南纬取 +)


def ayana_bala(planet, declination=None):
    """赤纬力：Ayana = (24 ± Kranti)/48 × 60。

    declination = 赤纬度(北正南负)。符号按曜分组(水恒 +)；太阳结果再 ×2。
    缺赤纬 → 0 + pending(需星历赤纬)；给齐则精确、不再 pending。
    """
    if declination is None:
        return {'virupa': 0.0, 'pending': True}
    d = float(declination)
    if planet == const.MERCURY:
        sign = 1.0                                 # 水恒取 +
    elif planet in _AYANA_NORTH_MINUS:
        sign = -1.0                                # 月/土：北纬取 −
    else:
        sign = 1.0                                 # 日/火/木/金：北纬取 +
    val = (_AYANA_MAX_KRANTI + sign * d) / (2.0 * _AYANA_MAX_KRANTI) * 60.0
    if planet == const.SUN:
        val *= 2.0
    val = max(0.0, min(120.0, val))                # 一般 0..60；太阳 ×2 → 0..120
    return {'virupa': val, 'pending': False}


def kala_bala(planet, sun_lon, moon_lon, fraction_from_midnight=0.5,
              is_day=True, tribhaga_index=0, weekday_lord=None, hora_lord=None,
              year_lord=None, month_lord=None, declination=None, yuddha_virupa=0.0):
    """时间力合 = Nathonnatha + Paksha + Tribhaga + Vara + Hora + (Abda+Masa) + Ayana + Yuddha。

    Tribhaga/Ayana/Vara/Hora 为精确式;仅 Abda·Masa 主曜未传 或 赤纬缺(Ayana) 或 hora 主缺时
    整体 pending=True(该分量计 0)。
    """
    nn = nathonnatha_bala(planet, fraction_from_midnight)
    pk = paksha_bala(planet, sun_lon, moon_lon)
    tb = tribhaga_bala(planet, is_day, tribhaga_index)
    va = vara_bala(planet, weekday_lord) if weekday_lord else 0.0
    ho = hora_bala(planet, hora_lord) if hora_lord else 0.0
    am = abda_masa_bala(planet, year_lord, month_lord)
    ay = ayana_bala(planet, declination)
    total = nn + pk + tb['virupa'] + va + ho + am['virupa'] + ay['virupa'] + float(yuddha_virupa)
    # Tribhaga/Ayana 现为精确式;余 pending 源:Abda·Masa 主曜未传、或 hora 主未传(时主缺)。
    pending = am['pending'] or ay['pending'] or (hora_lord is None)
    return {
        'nathonnatha': round(nn, 4),
        'paksha': round(pk, 4),
        'tribhaga': round(tb['virupa'], 4),
        'vara': round(va, 4),
        'hora': round(ho, 4),
        'abdaMasa': round(am['virupa'], 4),
        'ayana': round(ay['virupa'], 4),
        'yuddha': round(float(yuddha_virupa), 4),
        'virupa': round(total, 4),
        'pending': pending,
    }


# ════════════════════════════════════════════════════════════════════════════
# 4. Cheshta Bala(运动力)——离散八态表，直接实现
# ════════════════════════════════════════════════════════════════════════════
# 八态各给一档 virupa：逆(Vakra)60 / 反退(Anuvakra，逆入前宫)30 / 留(Vikala)15 /
# 缓(Manda，慢于均速)30 / 更缓(Mandatara)15 / 平(Sama，约均速)7.5 / 速(Chara，正常顺行)45 /
# 超速(Atichara，疾)30。日恒以 Ayana 力代、月恒以 Paksha 力代(合算时已含于 Kala)。
CHESHTA_STATES = [
    'vakra', 'anuvakra', 'vikala', 'manda',
    'mandatara', 'sama', 'chara', 'atichara',
]
CHESHTA_VIRUPA_BY_STATE = {
    'vakra': 60.0,       # 逆行
    'anuvakra': 30.0,    # 反退(逆行退入前一星座)
    'vikala': 15.0,      # 留(stationary)
    'manda': 30.0,       # 缓(慢于均速)
    'mandatara': 15.0,   # 更缓(远慢于均速)
    'sama': 7.5,         # 平(约均速)
    'chara': 45.0,       # 速(正常顺行)
    'atichara': 30.0,    # 超速(疾/快速顺行)
}
_VAKRA_VIRUPA = CHESHTA_VIRUPA_BY_STATE['vakra']


def _cheshta_state(retrograde, stationary, speed, mean_speed, entered_prev_sign):
    """由运动量判八态之一。

    优先级：留 → 反退/逆 → (顺行内)超速/速/平/缓/更缓(按 speed 与 mean_speed 比)。
    speed/mean_speed 缺时退化为 retro/stationary 布尔:逆→vakra、留→vikala、顺→chara。
    """
    if stationary:
        return 'vikala'
    if retrograde:
        return 'anuvakra' if entered_prev_sign else 'vakra'
    # 顺行:有均速可比 → 按比值分速/平/缓档;否则正常顺行=chara。
    if speed is None or mean_speed is None or mean_speed <= 0:
        return 'chara'
    r = float(speed) / float(mean_speed)
    if r >= 1.5:
        return 'atichara'      # 远快于均速
    if r >= 1.0:
        return 'chara'         # 快于(或约)均速
    if r >= 0.85:
        return 'sama'          # 约均速
    if r >= 0.5:
        return 'manda'         # 慢于均速
    return 'mandatara'         # 远慢于均速


def cheshta_bala(planet, retrograde=False, stationary=False, speed=None,
                 mean_speed=None, entered_prev_sign=False):
    """运动力：离散八态查表。

    日/月各以 Ayana / Paksha 力代 Cheshta — 本函数对日月返回 substitute 占位(虚拉 0,
    合算时其 Ayana/Paksha 已计入 Kala，故对日月不重复计 Cheshta)。
    五星(火/水/木/金/土)按八态查表得确定 virupa(不再 pending)。
    """
    if planet in (const.SUN, const.MOON):
        # 日/月本就以 Ayana/Paksha 力代 Cheshta(已计入 Kala)，此处 0 为正确口径、非待补。
        return {'virupa': 0.0, 'state': 'substitute', 'pending': False}
    state = _cheshta_state(retrograde, stationary, speed, mean_speed, entered_prev_sign)
    return {'virupa': CHESHTA_VIRUPA_BY_STATE[state], 'state': state, 'pending': False}


# ════════════════════════════════════════════════════════════════════════════
# 6. Drik Bala(相位力)——分段 Sphuta Drishti 虚拉式，直接实现
# ════════════════════════════════════════════════════════════════════════════
# 对每一(照者→被照者)有序对，按顺黄道夹角 a(0-360)的分段式算 Sphuta Drishti 虚拉(上限 60)。
# 吉曜之照计 +、凶曜之照计 −，净和 = Drishti Pinda；Drik Bala = Drishti Pinda / 4。
DRIK_NATURAL_BENEFIC = {const.MOON, const.MERCURY, const.JUPITER, const.VENUS}
DRIK_NATURAL_MALEFIC = {const.SUN, const.MARS, const.SATURN}


def _drishti_general(a):
    """通用列(日/月/水/金)分段 Sphuta Drishti(a = 顺黄道夹角 0-360)。"""
    if a < 30.0:
        return 0.0
    if a < 60.0:
        return (a - 30.0) / 2.0
    if a < 90.0:
        return a - 45.0
    if a < 120.0:
        return 30.0 + (120.0 - a) / 2.0
    if a < 150.0:
        return 150.0 - a
    if a < 180.0:
        return 2.0 * (a - 150.0)          # ⚠️ a=180 → 60(关键:非 2×(150−a))
    if a < 300.0:
        return (300.0 - a) / 2.0    # 180°–300° 单段;🔴 上界曾误写 330 → a∈(300,330) 出负值(照力按定义非负)
    return 0.0


def _drishti_saturn(a):
    """土星专列(其余段同通用列)。"""
    if 30.0 <= a < 60.0:
        return (a - 30.0) * 2.0
    if 60.0 <= a < 90.0:
        return 45.0 + (90.0 - a) / 2.0
    if 240.0 <= a < 270.0:
        return a - 210.0
    if 270.0 <= a < 300.0:
        return 2.0 * (300.0 - a)    # 🔴 上界曾误写 330 → 负值加倍(同通用列同根笔误)
    return _drishti_general(a)


def _drishti_mars(a):
    """火星专列(其余段同通用列)。"""
    if 90.0 <= a < 120.0:
        return 45.0 + (a - 90.0) / 2.0
    if 120.0 <= a < 150.0:
        return 2.0 * (150.0 - a)
    if 180.0 <= a < 210.0:
        return 60.0
    if 210.0 <= a < 240.0:
        return 270.0 - a
    return _drishti_general(a)


def _drishti_jupiter(a):
    """木星专列(其余段同通用列)。"""
    if 90.0 <= a < 120.0:
        return 45.0 + (a - 90.0) / 2.0
    if 120.0 <= a < 150.0:
        return 2.0 * (150.0 - a)
    if 210.0 <= a < 240.0:
        return 45.0 + (a - 210.0) / 2.0
    if 240.0 <= a < 270.0:
        return 15.0 + 2.0 * (270.0 - a) / 3.0
    return _drishti_general(a)


def sphuta_drishti(aspecting_planet, a):
    """照者 aspecting_planet 对顺黄道夹角 a(0-360,照者→被照者)处的 Sphuta Drishti 虚拉。"""
    a = float(a) % 360.0
    if aspecting_planet == const.SATURN:
        return _drishti_saturn(a)
    if aspecting_planet == const.MARS:
        return _drishti_mars(a)
    if aspecting_planet == const.JUPITER:
        return _drishti_jupiter(a)
    return _drishti_general(a)


def drik_bala(aspecting=None, target_lon=None):
    """相位力。两种入参形态:

      (1) aspecting = [(planet, aspecting_lon), …] + target_lon:
          逐照者按顺黄道夹角 a=(target_lon − aspecting_lon) mod360 算 Sphuta Drishti,
          吉曜 +、凶曜 −,净和/4。
      (2) aspecting = [(planet, drishti_value), …] (已预算虚拉,无 target_lon):
          直接吉 +/凶 − 净和/4。
    无照者 → 0(无相位,非 pending)。
    """
    if not aspecting:
        return {'virupa': 0.0, 'pending': False}
    net = 0.0
    for planet, val in aspecting:
        if target_lon is not None:
            a = (float(target_lon) - float(val)) % 360.0
            d = sphuta_drishti(planet, a)
        else:
            d = float(val)
        sign = 1.0 if planet in DRIK_NATURAL_BENEFIC else -1.0
        net += sign * d
    return {'virupa': round(net / 4.0, 4), 'pending': False}


# ════════════════════════════════════════════════════════════════════════════
# 合算：Shadbala 六源 → 总 virupa / Rupas / 所需强度比
# ════════════════════════════════════════════════════════════════════════════
# 所需 Rupas(及格线，标准)：日5 月6 火5 水7 木6 金8 土5(Rupa)。比值 = 总Rupa / 所需Rupa。
# 经典 BPHS 达标线(Rupa):Sun5/Moon6/Mars5/Mer7/Jup6.5/Ven5.5/Sat5(Santhanam/Phaladeepika)。
# 原 Jupiter6.0/Venus8.0 系转录误 → 按经典订正(plan 决策 #7)。
REQUIRED_RUPAS = {
    const.SUN: 5.0, const.MOON: 6.0, const.MARS: 5.0, const.MERCURY: 7.0,
    const.JUPITER: 6.5, const.VENUS: 5.5, const.SATURN: 5.0,
}


def compute_shadbala(planet, ctx):
    """单曜六力合算。ctx 为该曜简单数据 dict，键(均可缺，缺→对应分量 0 + pending)：

      lon            : sidereal 黄经(0-360)            —— Uchcha/Ojayugma 必需
      signlon        : rasi 内度(0-30)                 —— Drekkana 必需
      houseFromLagna : 从 lagna 起的宫号(1-12)          —— Kendradi/Dig 必需
      perVargaDignity: {chartnum: dignity_key}          —— Saptavargaja(优先直传)
      d1Lon, planetSigns: D1 黄经 + 全曜 D1 星座          —— 缺 perVargaDignity 时自算七盘
      sunLon, moonLon: 日/月黄经                         —— Paksha
      fractionFromMidnight, isDay, tribhagaIndex,
      weekdayLord, horaLord, yearLord, monthLord,
      declination, yuddhaVirupa                         —— Kala 子项
      retrograde, stationary, speed, meanSpeed,
      enteredPrevSign                                   —— Cheshta 八态
      aspecting      : [(planet, aspecting_lon), …]      —— Drik(配 lon 作被照点)

    返回各源 virupa + 总 virupa + Rupas + 所需比 + pending 标志集。
    """
    lon = ctx.get('lon', 0.0)
    signlon = ctx.get('signlon', float(lon) % 30.0)
    house = ctx.get('houseFromLagna', 1)

    # Saptavargaja:优先用引擎直传的七盘尊贵字典;否则用 d1Lon+planetSigns 自算七盘。
    per_varga = ctx.get('perVargaDignity')
    if per_varga is None and ctx.get('planetSigns') and planet in SHADBALA_PLANETS:
        # signlon 必须与 d1Lon 同基准(D1):优先 ctx.d1Signlon,缺则由 d1Lon 求;
        # 🔴 曾传当前显示分盘的 signlon → 跨基准泄漏(见 saptavargaja_dignity_map 注)。
        _d1lon = ctx.get('d1Lon', lon)
        _d1deg = ctx.get('d1Signlon')
        if _d1deg is None:
            _d1deg = float(_d1lon) % 30.0
        per_varga = saptavargaja_dignity_map(
            planet, _d1lon, ctx['planetSigns'], signlon=_d1deg,
            variants=ctx.get('vargaVariants'))
    sthana = sthana_bala(planet, lon, signlon, house, per_varga)
    dig = dig_bala(planet, house)
    kala = kala_bala(
        planet, ctx.get('sunLon', 0.0), ctx.get('moonLon', 0.0),
        fraction_from_midnight=ctx.get('fractionFromMidnight', 0.5),
        is_day=ctx.get('isDay', True),
        tribhaga_index=ctx.get('tribhagaIndex', 0),
        weekday_lord=ctx.get('weekdayLord'),
        hora_lord=ctx.get('horaLord'),
        year_lord=ctx.get('yearLord'),
        month_lord=ctx.get('monthLord'),
        declination=ctx.get('declination'),
        yuddha_virupa=ctx.get('yuddhaVirupa', 0.0),
    )
    cheshta = cheshta_bala(
        planet, retrograde=ctx.get('retrograde', False),
        stationary=ctx.get('stationary', False), speed=ctx.get('speed'),
        mean_speed=ctx.get('meanSpeed'), entered_prev_sign=ctx.get('enteredPrevSign', False),
    )
    naisargika = naisargika_bala(planet)
    drik = drik_bala(ctx.get('aspecting'), target_lon=ctx.get('lon'))

    # 日以 Ayana 代 Cheshta、月以 Paksha 代——此处 Cheshta 分量对日月计 0(已 substitute)；
    # 其 Ayana/Paksha 已含于 Kala，符合「日/月 Cheshta 用替」标准口径。
    total = round(sthana['virupa'] + dig + kala['virupa']
                  + cheshta['virupa'] + naisargika + drik['virupa'], 4)
    rupas = round(total / VIRUPA_PER_RUPA, 4)        # 由四舍后总值导出，显示值内部自洽
    required = REQUIRED_RUPAS.get(planet)
    ratio = (rupas / required) if required else None

    pending = {
        'saptavargaja': sthana['saptavargajaPending'],
        'kala': kala['pending'],
        'cheshta': cheshta['pending'],
        'drik': drik['pending'],
    }
    return {
        'planet': planet,
        'sthana': sthana,
        'dig': round(dig, 4),
        'kala': kala,
        'cheshta': cheshta,
        'naisargika': round(naisargika, 4),
        'drik': drik,
        'totalVirupa': total,
        'rupas': rupas,
        'requiredRupas': required,
        'strengthRatio': round(ratio, 4) if ratio is not None else None,
        'sufficient': (ratio is not None and ratio >= 1.0),
        'pending': pending,
        'anyPending': any(pending.values()),
    }


# ── Ishta / Kashta Phala(吉凶果)框架 ─────────────────────────────────────
# Ishta = sqrt(Uchcha × Cheshta)、Kashta = sqrt((60−Uchcha) × (60−Cheshta))(标准式)。
# Cheshta pending 时 Ishta/Kashta 同 pending(依赖 Cheshta virupa)。
def ishta_kashta_phala(uchcha_virupa, cheshta_virupa, cheshta_pending=False):
    """吉凶果(virupa)：Ishta=√(Uchcha×Cheshta)、Kashta=√((60−Uchcha)×(60−Cheshta))。"""
    uc = max(0.0, min(60.0, float(uchcha_virupa)))
    ch = max(0.0, min(60.0, float(cheshta_virupa)))
    ishta = (uc * ch) ** 0.5
    kashta = ((60.0 - uc) * (60.0 - ch)) ** 0.5
    return {
        'ishta': round(ishta, 4),
        'kashta': round(kashta, 4),
        'pending': bool(cheshta_pending),
    }


def compute_all(contexts):
    """全七曜六力。contexts = {planet: ctx}。返回 {planet: result, 'anyPending': bool}。"""
    out = {}
    any_pending = False
    for planet in SHADBALA_PLANETS:
        ctx = contexts.get(planet)
        if ctx is None:
            continue
        res = compute_shadbala(planet, ctx)
        # 附 Ishta/Kashta(依赖 Uchcha 与 Cheshta)。日/月 Cheshta 以 Ayana/Paksha 代,
        # 故 Ishta/Kashta 的 Cheshta 项对日取 Ayana、对月取 Paksha(其余曜用本身 Cheshta)。
        # 🔴 替代量必须用「未加倍」基准:Ayana(日恒×2,0..120)/Paksha(月×2,0..120)是
        # Kala 合计口径,直接喂给 60 量纲的 Ishta/Kashta 会被 clamp 到 60 →
        # 约半数盘(日:赤纬≥0;月:距日≥90°)Kashta 恒等于精确 0。
        if planet == const.SUN:
            cheshta_for_ik = float(res['kala']['ayana']) / 2.0
        elif planet == const.MOON:
            # 未加倍 Paksha:走 paksha_bala(moon_double=False) 单源(同式同输入,字节恒等)——
            # 吉凶归列若日后改 _PAKSHA_BENEFIC,此处自动跟随,不再是第二份平行实现。
            cheshta_for_ik = paksha_bala(
                const.MOON, float(ctx.get('sunLon', 0.0)), float(ctx.get('moonLon', 0.0)),
                moon_double=False)
        else:
            cheshta_for_ik = res['cheshta']['virupa']
        ik = ishta_kashta_phala(
            res['sthana']['uchcha'], cheshta_for_ik,
            cheshta_pending=res['cheshta']['pending'],
        )
        res['ishtaKashta'] = ik
        # 顶层亦平铺 ishta/kashta(便于下游直取);ishtaKashta 保留以兼容既有读取。
        res['ishta'] = ik['ishta']
        res['kashta'] = ik['kashta']
        # Vimsopaka 四组 20 分力(P0-8):用 ctx 的 D1 经度/全曜星座/D1 内度。
        try:
            _vl = ctx.get('d1Lon', ctx.get('lon'))
            _vd = ctx.get('d1Signlon')
            if _vd is None and _vl is not None:
                _vd = float(_vl) % 30.0            # D1 自洽(勿用当前分盘 signlon)
            res['vimsopaka'] = vimsopaka_bala(
                planet, _vl,
                ctx.get('planetSigns', {}) or {}, _vd,
                variants=ctx.get('vargaVariants'))
        except Exception:
            res['vimsopaka'] = None
        out[planet] = res
        any_pending = any_pending or res['anyPending']
    out['anyPending'] = any_pending
    out['method'] = 'six_source'
    out['note'] = ('六源六力(Sthana/Dig/Kala/Cheshta/Naisargika/Drik)，按标准计算口径全量实现:'
                   'Saptavargaja 七盘尊贵档累加、Tribhaga 段主、Ayana 赤纬式、Cheshta 八态、'
                   'Drik 分段虚拉。仅 Abda/Masa(年/月主曜需太阳入宫/入白羊时刻的 hora 主)在引擎'
                   '未传该主曜时按 pending 计 0。')
    return out


# ════════════════════════════════════════════════════════════════════════════
# 八分点 Sodhana(缩减)+ Kakshya
# ════════════════════════════════════════════════════════════════════════════
# bav: {sign_index_0_based: bindu} 或 {sign_name: bindu}；统一转 12-长 list(idx 0=Ar)。

def _bav_to_list(bav):
    """BAV(dict by sign_name 或 sign_index，或已是 12-list)→ 12-长 list(idx 0=Ar)。"""
    if isinstance(bav, (list, tuple)):
        return [int(bav[i]) for i in range(12)]
    out = [0] * 12
    for k, v in bav.items():
        if isinstance(k, str):
            idx = SIGN_INDEX.get(k)
            if idx is None:
                # 容错：传入 const.LIST_SIGNS 名
                try:
                    idx = const.LIST_SIGNS.index(k)
                except ValueError:
                    idx = None
        else:
            idx = int(k) % 12
        if idx is not None:
            out[idx] = int(v)
    return out


# ── Trikona Sodhana(三角缩减)─────────────────────────────────────────────
# 4 组三角(各含相隔 4 宫的 3 宫，即 {0,4,8}{1,5,9}{2,6,10}{3,7,11})。
# 标准口径：三宫各减组内最小值(min)。若组内有 0，则 min=0、三宫不变(其余宫仍减各自组 min)。
# 三宫相等 → 全归 0。该法天然幂等(二次 min 必为 0)。
# (不采用「有 0 → 全归 0」变体——其非幂等且非 Parasara 口径。)
def trikona_sodhana(bav):
    """三角缩减：对 4 组三角，组内各宫减去该组最小 bindu(幂等)。"""
    vals = _bav_to_list(bav)
    out = list(vals)
    seen = [False] * 12
    for start in range(12):
        if seen[start]:
            continue
        trio = [start, (start + 4) % 12, (start + 8) % 12]
        for t in trio:
            seen[t] = True
        m = min(out[t] for t in trio)
        for t in trio:
            out[t] -= m
    return out


# ── Ekadhipatya Sodhana(同主双宫缩减)──────────────────────────────────────
# 同一主曜的两 own-rasi 对(火 Ar/Sc、金 Ta/Li、水 Ge/Vi、月日 Cn/Le 自有单宫不配对、
# 木 Sg/Pi、土 Cp/Aq)：按两宫 bindu 与「是否含行星」做缩减(Parasara 口径)。
# 主曜 own 对(0-based idx)。Cn(月)/Le(日)各单宫，不入 Ekadhipatya 对。
_EKADHIPATYA_PAIRS = [
    (0, 7),    # Ar / Sc  (火)
    (1, 6),    # Ta / Li  (金)
    (2, 5),    # Ge / Vi  (水)
    (8, 11),   # Sg / Pi  (木)
    (9, 10),   # Cp / Aq  (土)
]


def ekadhipatya_sodhana(bav, occupied_signs=None):
    """同主双宫缩减(Parasara 口径)。occupied_signs = 含行星的 0-based 星座集合。

    规则(Parasara)：对每对同主 own-rasi (P,Q)，记两宫 bindu p,q、是否有行星 op,oq：
      - 两宫皆无行星：两宫均置二者中较小值 min(p,q)；若 min==0 则两宫皆 0。
      - 恰一宫有行星：无行星之宫置 0；有行星之宫保留。
      - 两宫皆有行星：两宫不变。
    (拒「两 0 → 第三 0」变体——本实现不做该变体。)
    """
    vals = _bav_to_list(bav)
    out = list(vals)
    occ = set() if occupied_signs is None else {int(s) % 12 for s in occupied_signs}
    for a, b in _EKADHIPATYA_PAIRS:
        p, q = out[a], out[b]
        oa, ob = (a in occ), (b in occ)
        if oa and ob:
            continue                       # 两宫皆占 → 不变
        if oa and not ob:
            out[b] = 0                      # 仅 a 占 → b 归 0
        elif ob and not oa:
            out[a] = 0                      # 仅 b 占 → a 归 0
        else:
            m = min(p, q)                   # 皆空 → 取较小
            out[a] = out[b] = m
    return out


def sodhana(bav, occupied_signs=None):
    """全缩减 = Trikona 后接 Ekadhipatya。返回 12-长 list(idx 0=Ar)。"""
    return ekadhipatya_sodhana(trikona_sodhana(bav), occupied_signs)


def sodhya_pinda(reduced_bav, sign_pinda=None, graha_pinda=None):
    """Sodhya Pinda(择时用)：rasi pinda + graha pinda 加权和。

    sign_pinda/graha_pinda 各为 12-长权重 list；缺则按缩减后 bindu 直和(占位 + pending)。
    """
    vals = _bav_to_list(reduced_bav)
    if sign_pinda is None or graha_pinda is None:
        return {'pinda': sum(vals), 'pending': True}
    rp = sum(vals[i] * float(sign_pinda[i]) for i in range(12))
    gp = sum(vals[i] * float(graha_pinda[i]) for i in range(12))
    return {'rasiPinda': round(rp, 4), 'grahaPinda': round(gp, 4),
            'pinda': round(rp + gp, 4), 'pending': False}


# ── Kakshya(每宫 8 档，各 3°45′)──────────────────────────────────────────
# 每 rasi 30° 分 8 档(3.75°)，档主固定序(从 0°起)：土/木/火/日/金/水/月/Lagna。
KAKSHYA_SPAN = 30.0 / 8.0      # 3.75° = 3°45′
KAKSHYA_LORDS = [
    const.SATURN, const.JUPITER, const.MARS, const.SUN,
    const.VENUS, const.MERCURY, const.MOON, 'Lagna',
]


def kakshya_index(signlon):
    """rasi 内度(0-30)落第几档(0-7)。"""
    return max(0, min(7, int(float(signlon) // KAKSHYA_SPAN)))


def kakshya_lord(signlon):
    """该 rasi 内度所在档的档主。"""
    return KAKSHYA_LORDS[kakshya_index(signlon)]


def prastara_av(bav_by_planet, transit_signlon, transit_sign_index):
    """PAV(Prastara Ashtakavarga)：过境点所在档的档主在该过境星座是否有 rekha(bindu)。

    bav_by_planet: {planet_or_'Lagna': BAV(12-list/dict)}。
    返回 {kakshyaLord, hasRekha, signIndex, kakshyaIndex}。
    """
    lord = kakshya_lord(transit_signlon)
    bav = bav_by_planet.get(lord)
    has = False
    if bav is not None:
        has = bool(_bav_to_list(bav)[int(transit_sign_index) % 12] > 0)
    return {
        'kakshyaLord': lord,
        'kakshyaIndex': kakshya_index(transit_signlon),
        'signIndex': int(transit_sign_index) % 12,
        'hasRekha': has,
    }
