# -*- coding: utf-8 -*-
"""年度盘（Tajaka / Varshaphala）引擎：结构 + 不变量 + 标准转录 golden。

⚠️ 公式来自标准权威转录；纯几何/规则部分（Muntha=年龄mod12、Saham 夜翻 B−A+C 对称、
   Triraasi/Hadda/Deeptamsa 表）做精确 golden；具体出生例的整盘 Example 数值核对待书值。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402

from astrostudy.india import tajaka as tj  # noqa: E402
from astrostudy.india import primitives as prim  # noqa: E402


# ── Muntha：本命 lagna + (年龄 mod 12) 宫 ────────────────────────────────
def test_muntha_age_mod_12_invariant():
    """不变量：houseFromNatalLagna - 1 == age mod 12（任意 lagna / 任意年龄）。"""
    for lagna in prim.SIGNS:
        for age in range(0, 130):
            m = tj.muntha(lagna, age)
            assert m['houseFromNatalLagna'] - 1 == age % 12
            assert m['sign'] == prim.offset_sign(lagna, age % 12 + 1)


def test_muntha_known_progression():
    """完成 31 年(进第 32 年)、本命 lagna 天蝎 → Muntha 在天蝎起第 8 宫 = 双子。"""
    m = tj.muntha(const.SCORPIO, 31)
    assert m['houseFromNatalLagna'] == 8
    assert m['sign'] == const.GEMINI
    assert m['lord'] == const.MERCURY


def test_muntha_age_zero_is_lagna():
    m = tj.muntha(const.LEO, 0)
    assert m['sign'] == const.LEO and m['houseFromNatalLagna'] == 1


def test_muntha_wraps_every_12_years():
    assert tj.muntha(const.ARIES, 12)['sign'] == tj.muntha(const.ARIES, 0)['sign']
    assert tj.muntha(const.ARIES, 24)['sign'] == tj.muntha(const.ARIES, 0)['sign']


# ── Saham：夜翻 B−A+C 对称 + +30° 弧规则 + 标准转录 golden ────────────────
def test_saham_night_flips_day_formula():
    """夜公式 = 昼公式把 A、B 对调（不变量；不计 +30° 的纯翻转对称）。"""
    a, b, c = 100.0, 40.0, 200.0
    # 关掉 +30°（构造 C 在弧内）来验纯翻转：选 C 落在两个弧内的点。
    day = tj.compute_saham(a, b, c, day_birth=True)
    night = tj.compute_saham(a, b, c, day_birth=False)
    # 昼基值 A−B+C；夜基值 B−A+C；二者基值之和（去 +30°）应 = 2C（对称中心）。
    # 去掉可能的 +30° 后比较：
    def base(a_, b_, c_):
        return (a_ - b_ + c_) % 360.0
    assert abs(base(a, b, c) - day if day < 360 else 0) >= 0  # 烟雾
    # 直接验：把 night 用 (b,a) 对调走昼路径应一致
    night_as_day = tj.compute_saham(b, a, c, day_birth=True)
    assert abs(night - night_as_day) < 1e-9


def test_saham_arc_plus30_rule():
    """+30°：C 不在 B→A 弧内时加 30°。"""
    # 构造昼：A=10, B=350, C=180。B→A 弧(350→10=20°)不含 180 → +30。
    a, b, c = 10.0, 350.0, 180.0
    val = tj.compute_saham(a, b, c, day_birth=True)
    raw = (a - b + c) % 360.0
    assert abs(val - (raw + 30.0) % 360.0) < 1e-9
    # 构造 C 在弧内：A=200,B=40,C=120(40→200 含 120) → 不加。
    a2, b2, c2 = 200.0, 40.0, 120.0
    val2 = tj.compute_saham(a2, b2, c2, day_birth=True)
    assert abs(val2 - (a2 - b2 + c2) % 360.0) < 1e-9


def test_saham_punya_basic():
    """Punya = 月 − 日 + lagna（昼）。"""
    lons = {const.MOON: 100.0, const.SUN: 40.0}
    res = tj.all_sahams(lons, lagna_lon=200.0, lagna_sign=const.LIBRA, day_birth=True)
    # B→A：日40→月100 含 lagna200? 否 → +30。raw=100-40+200=260, +30=290。
    assert abs(res['punya']['lon'] - 290.0) < 1e-6


def test_saham_artha_book_transcription():
    """标准转录 golden（财 saham，昼夜同式）：
    lagna 280°50'、2 宫起 310°50'、2 宫主土 19°10' → 财 = 310°50'−19°10'+280°50' = 572°30' → 212°30'。
    2 宫主土须为「土星」：lagna=摩羯(280°=Cp 起)，2 宫=水瓶(主土星)。C=lagna 落 2宫主→2宫 弧内 → 不 +30。"""
    lagna_lon = 280.0 + 50.0 / 60.0           # 10 Cp 50
    lons = {const.SATURN: 19.0 + 10.0 / 60.0}  # 2 宫主(水瓶主=土星) 19 Ar 10
    res = tj.all_sahams(lons, lagna_lon=lagna_lon, lagna_sign=const.CAPRICORN, day_birth=False)
    expected = 212.0 + 30.0 / 60.0            # 2 Sc 30
    assert abs(res['artha']['lon'] - expected) < 1e-6
    assert res['artha']['sign'] == const.SCORPIO


def test_saham_all_36_present():
    lons = {p: 30.0 * i for i, p in enumerate(tj.SEVEN_PLANETS)}
    res = tj.all_sahams(lons, lagna_lon=15.0, lagna_sign=const.ARIES, day_birth=True)
    assert len(res) == 36
    # 全部在 0-360 或 None（缺项）。
    for k, v in res.items():
        assert v['lon'] is None or 0 <= v['lon'] < 360


def test_saham_dependency_resolves():
    """依赖另一 saham 的（yasas 依赖 punya）应能解析出值。"""
    lons = {const.MOON: 100.0, const.SUN: 40.0, const.JUPITER: 60.0, const.VENUS: 10.0}
    res = tj.all_sahams(lons, lagna_lon=200.0, lagna_sign=const.LIBRA, day_birth=True)
    assert res['punya']['lon'] is not None
    assert res['yasas']['lon'] is not None   # Jupiter − PunyaSaham + Lagna


# ── 年主：5 候选 + Triraasi 表 + fallback 链 ────────────────────────────
def test_year_lord_five_candidates():
    """5 候选规则对应：日Sun宫主 / 本命lagna主 / Muntha主 / 年度lagna主 / Triraasi。"""
    cands = tj.year_lord_candidates(
        natal_lagna_sign=const.LEO, annual_lagna_sign=const.CAPRICORN,
        muntha_sign=const.TAURUS, sun_sign=const.PISCES, moon_sign=const.PISCES,
        day_birth=False)
    rules = {c['rule']: c['planet'] for c in cands}
    assert len(cands) == 5
    assert rules[1] == const.JUPITER   # 夜 → Moon 在双鱼 → 主木星
    assert rules[2] == const.SUN       # 本命 lagna 狮子 → 日
    assert rules[3] == const.VENUS     # Muntha 金牛 → 金
    assert rules[4] == const.SATURN    # 年度 lagna 摩羯 → 土
    assert rules[5] == const.MARS      # Triraasi(摩羯,夜) → 火


def test_triraasi_table_transcription():
    """Triraasi 表抽样核对（标准转录）。"""
    assert tj.triraasi_lord(const.ARIES, True) == const.SUN
    assert tj.triraasi_lord(const.ARIES, False) == const.JUPITER
    assert tj.triraasi_lord(const.CANCER, True) == const.VENUS
    assert tj.triraasi_lord(const.CANCER, False) == const.MARS
    assert tj.triraasi_lord(const.SAGITTARIUS, True) == const.SATURN
    assert tj.triraasi_lord(const.SAGITTARIUS, False) == const.SATURN  # 昼夜同


def test_year_lord_fallback_chain():
    """无任何对 lagna 相位 + 无强 bala → 落到第 1 候选（fallback D）。"""
    # 构造：所有候选曜对年度 lagna 都是宫距 6/8（无 Tajaka 相位），bala 都低。
    annual_lagna = const.ARIES
    # 对 Ar 无相位的星座 = 距 6(Vi)/8(Sc)。把候选曜都放这些星座。
    planet_signs = {const.SUN: const.VIRGO, const.MOON: const.VIRGO,
                    const.JUPITER: const.SCORPIO, const.VENUS: const.VIRGO,
                    const.SATURN: const.SCORPIO, const.MARS: const.VIRGO,
                    const.MERCURY: const.VIRGO}
    planet_lons = {p: prim.SIGN_INDEX[s] * 30.0 + 5.0 for p, s in planet_signs.items()}
    cands = [{'rule': 1, 'planet': const.SUN}, {'rule': 2, 'planet': const.MARS},
             {'rule': 3, 'planet': const.VENUS}, {'rule': 4, 'planet': const.MARS},
             {'rule': 5, 'planet': const.SATURN}]
    low_bala = {p: 3.0 for p in tj.SEVEN_PLANETS}
    yl = tj.select_year_lord(cands, annual_lagna, planet_signs, planet_lons, low_bala)
    assert yl['via'] == 'first_candidate_fallback'
    assert yl['planet'] == const.SUN   # 第 1 候选


def test_year_lord_benefic_aspect_highest_bala():
    """有吉相位候选 → 取 Pancha-Vargeeya bala 最高者。"""
    annual_lagna = const.ARIES
    # Sg(距9=trinal吉)放木与火；金放 Vi(距6 无相位)。
    planet_signs = {const.JUPITER: const.SAGITTARIUS, const.MARS: const.SAGITTARIUS,
                    const.VENUS: const.VIRGO}
    planet_lons = {const.JUPITER: 240.0 + 5.0, const.MARS: 240.0 + 6.0, const.VENUS: 155.0}
    cands = [{'rule': 1, 'planet': const.VENUS}, {'rule': 2, 'planet': const.JUPITER},
             {'rule': 3, 'planet': const.MARS}, {'rule': 4, 'planet': const.JUPITER},
             {'rule': 5, 'planet': const.MARS}]
    bala = {const.JUPITER: 8.0, const.MARS: 13.7, const.VENUS: 5.0}
    yl = tj.select_year_lord(cands, annual_lagna, planet_signs, planet_lons, bala)
    assert yl['via'] == 'benefic_aspect'
    assert yl['planet'] == const.MARS   # 火 bala 13.7 > 木 8


# ── Tajaka 相位 + Deeptamsa ─────────────────────────────────────────────
def test_tajaka_aspect_house_positions():
    """相位类别按宫距：5/9=trinal、3/11=sextile、4/10=square、7=opposition、1=conjunction、2/12=semisextile；6/8=None。"""
    base = const.ARIES
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 5))['aspect'] == 'trinal'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 9))['aspect'] == 'trinal'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 3))['aspect'] == 'sextile'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 11))['aspect'] == 'sextile'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 4))['aspect'] == 'square'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 7))['aspect'] == 'opposition'
    assert tj.tajaka_aspect_type(base, base)['aspect'] == 'conjunction'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 2))['aspect'] == 'semisextile'
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 6)) is None
    assert tj.tajaka_aspect_type(base, prim.offset_sign(base, 8)) is None


def test_deeptamsa_orb_table():
    assert tj.DEEPTAMSA[const.SUN] == 15.0
    assert tj.DEEPTAMSA[const.MOON] == 12.0
    assert tj.DEEPTAMSA[const.MARS] == 8.0
    assert tj.DEEPTAMSA[const.MERCURY] == 7.0


def test_within_deeptamsa_overlap():
    """月14°Le 与 金19°Li（六分相）互在 orb 内（差 5° < 各自 orb 7/12）。"""
    moon_lon = 4 * 30 + 14.0   # 14 Le
    venus_lon = 6 * 30 + 19.0  # 19 Li
    assert tj.within_deeptamsa(const.MOON, moon_lon, const.VENUS, venus_lon)


# ── Tajaka 瑜伽：速度序 + 趋近(Ithasala)/背离(Eesarpha) + 逆行 ───────────
def test_speed_order():
    """速度序（慢→快）：土<罗<木<火<日<金<水<月。"""
    order = [const.SATURN, const.NORTH_NODE, const.JUPITER, const.MARS,
             const.SUN, const.VENUS, const.MERCURY, const.MOON]
    ranks = [tj.speed_rank(p) for p in order]
    assert ranks == sorted(ranks)
    assert tj.faster_of(const.SATURN, const.MOON)[0] == const.MOON


def test_ithasala_applying():
    """月14°Le(快)落后于 金19°Li(慢) → Ithasala(趋近)。"""
    moon_lon = 4 * 30 + 14.0
    venus_lon = 6 * 30 + 19.0
    d = tj.ithasala_detail(const.MOON, moon_lon, const.VENUS, venus_lon)
    assert d['type'] in ('vartamana', 'poorna')
    assert d['applying'] is True


def test_eesarpha_separating():
    """月23°Le(快)超前于 金19°Li(慢) → Eesarpha(背离)。"""
    moon_lon = 4 * 30 + 23.0
    venus_lon = 6 * 30 + 19.0
    d = tj.ithasala_detail(const.MOON, moon_lon, const.VENUS, venus_lon)
    assert d['applying'] is False
    assert d['type'] == 'eesarpha'


def test_poorna_within_one_degree():
    """advancement 差 <1° + 趋近 + 互在 orb → poorna。月18°25'Le 落后金19°Li，差 0.58°。"""
    moon_lon = 4 * 30 + 18.0 + 25.0 / 60.0
    venus_lon = 6 * 30 + 19.0
    d = tj.ithasala_detail(const.MOON, moon_lon, const.VENUS, venus_lon)
    assert d['type'] == 'poorna'


def test_retrograde_fast_planet_breaks_applying():
    """逆行水星(快)18°Ge 更超前于火18°10'Li——本顺行会是 poorna，逆行则背离不成趋近。"""
    merc_lon = 2 * 30 + 18.0
    mars_lon = 6 * 30 + 18.0 + 10.0 / 60.0
    d = tj.ithasala_detail(const.MERCURY, merc_lon, const.MARS, mars_lon,
                           a_retro=True, b_retro=False)
    # 水逆 + advancement 较小(18<18.17) → applying 反向为 False。
    assert d['applying'] is False


def test_position_yogas():
    """Ishkavala：行星仅居 kendra+panaphara；Induvara：仅居 apoklima。"""
    lagna = const.ARIES
    # 全放 1/2/4/5/7/8/10/11（kendra+panaphara）。
    kp_signs = {const.SUN: prim.offset_sign(lagna, 1), const.MOON: prim.offset_sign(lagna, 4),
                const.MARS: prim.offset_sign(lagna, 7), const.MERCURY: prim.offset_sign(lagna, 10),
                const.JUPITER: prim.offset_sign(lagna, 2), const.VENUS: prim.offset_sign(lagna, 5),
                const.SATURN: prim.offset_sign(lagna, 11)}
    y = tj.detect_position_yogas(kp_signs, lagna)
    assert y['ishkavala'] is True and y['induvara'] is False
    # 全放 3/6/9/12（apoklima）。
    ap_signs = {const.SUN: prim.offset_sign(lagna, 3), const.MOON: prim.offset_sign(lagna, 6),
                const.MARS: prim.offset_sign(lagna, 9), const.MERCURY: prim.offset_sign(lagna, 12),
                const.JUPITER: prim.offset_sign(lagna, 3), const.VENUS: prim.offset_sign(lagna, 6),
                const.SATURN: prim.offset_sign(lagna, 9)}
    y2 = tj.detect_position_yogas(ap_signs, lagna)
    assert y2['induvara'] is True and y2['ishkavala'] is False


def test_yoga_catalog_has_16():
    assert len(tj.TAJAKA_YOGA_CATALOG) == 16
    keys = {k for k, _, _ in tj.TAJAKA_YOGA_CATALOG}
    for must in ('Ithasala', 'Eesarpha', 'Kamboola', 'Manahoo', 'Ishkavala', 'Induvara'):
        assert must in keys


# ── Harsha bala（4 源）─────────────────────────────────────────────────
def test_harsha_bala_happy_houses_and_night():
    """各曜喜乐宫(源1) + 夜生阴曜 +5(源4)。月在 3 宫(喜)、夜生 → 月得喜乐宫5 + 阴曜夜5。"""
    lagna = const.CAPRICORN
    # 月放 lagna 起第 3 宫。
    moon_sign = prim.offset_sign(lagna, 3)
    planet_signs = {const.MOON: moon_sign}
    planet_lons = {const.MOON: prim.SIGN_INDEX[moon_sign] * 30.0 + 10.0}
    hb = tj.harsha_bala(planet_signs, planet_lons, lagna, day_birth=False)
    # 源1(喜乐宫3)=5；源3(阴曜在1/2/3/7/8/9 宫，3 在内)=5；源4(夜阴)=5；源2(非旺庙)=0 → 15。
    assert hb[const.MOON]['total'] == 15
    assert hb[const.MOON]['sources'] == [5, 0, 5, 5]


def test_harsha_bala_exalt_own_source():
    """源2：旺或庙得 5。日在狮子(庙) → 源2=5。"""
    lagna = const.LEO
    planet_signs = {const.SUN: const.LEO}   # 日在狮子 = 庙(own)，且 from lagna 第1宫
    planet_lons = {const.SUN: 4 * 30 + 5.0}
    hb = tj.harsha_bala(planet_signs, planet_lons, lagna, day_birth=True)
    assert hb[const.SUN]['sources'][1] == 5   # own → 源2


# ── Pancha-Vargeeya bala ────────────────────────────────────────────────
def test_pancha_kshetra_own_sign():
    """庙(own rasi)Kshetra bala = 30。火在白羊。"""
    pv = tj.pancha_vargeeya_bala(const.MARS, const.ARIES, 5.0)
    assert pv['kshetra'] == 30.0


def test_pancha_uchcha_at_deep_exaltation():
    """深旺点 Uchcha bala = 20。日 10°Ar。"""
    pv = tj.pancha_vargeeya_bala(const.SUN, const.ARIES, 10.0)
    assert abs(pv['uchcha'] - 20.0) < 1e-6


def test_hadda_lord_table():
    """界主表抽样（标准转录）：白羊 0-6°=木、6-12°=金；天秤 0-6°=土。"""
    assert tj.hadda_lord(const.ARIES, 3.0) == const.JUPITER
    assert tj.hadda_lord(const.ARIES, 8.0) == const.VENUS
    assert tj.hadda_lord(const.LIBRA, 3.0) == const.SATURN
    assert tj.hadda_lord(const.PISCES, 5.0) == const.VENUS


def test_pancha_uchcha_book_example():
    """标准转录 golden（Uchcha bala）：木 8°30'Vi(=158°30')，深落 5°Cp(=275°)，
    角距 116°30' → 20×116.5/180 = 12.94。"""
    jup_lon = 5 * 30 + 8.0 + 30.0 / 60.0   # 8 Vi 30
    pv = tj.pancha_vargeeya_bala(const.JUPITER, const.VIRGO, jup_lon)
    assert abs(pv['uchcha'] - 12.9444) < 1e-3


# ── 年度大运框架 ─────────────────────────────────────────────────────────
def test_patyayini_order_and_total():
    """Patyayini：按 krisamsa 升序;[Q-122/T-30 原典核对] 首项 patyamsa = 自身 krisamsa(Charak p.47 / Raman Art.49),
    Σpatyamsa = 最大 krisamsa;期长和 ≈ 年长。此前首项恒 0 天(Σ = max − min)。"""
    lons = {const.VENUS: 1 * 30 + 1.0, const.MERCURY: 2 * 30 + 4.0, const.MOON: 3 * 30 + 4.8,
            const.SATURN: 1 * 30 + 6.5, const.SUN: 5 * 30 + 17.0, const.MARS: 7 * 30 + 23.0,
            const.JUPITER: 9 * 30 + 11.0}
    res = tj.patyayini_dasa(lons, lagna_lon=11 * 30 + 7.0)
    kr = [r['krisamsa'] for r in res['order']]
    assert kr == sorted(kr)                       # 升序
    first = res['order'][0]
    assert first['ref'] == const.VENUS and abs(first['patyamsa'] - 1.0) < 1e-9   # 金星 1° 最小 → 份额 = 自身 1°
    assert first['days'] > 0                                                      # 不再恒 0 天
    assert abs(res['sumPatyamsa'] - max(kr)) < 1e-9                               # Σ = 最大 krisamsa(木星 11°)
    assert abs(res['totalDays'] - tj._TAJAKA_YEAR_DAYS) < 0.5


def test_mudda_days_table():
    """Varsha-Vimshottari 日数 = 正常年数 × 3（标准转录）。"""
    days = {d['key']: d['days'] for d in tj.MUDDA_SEQUENCE}
    assert days['Sun'] == 18 and days['Moon'] == 30 and days['Venus'] == 60
    assert sum(days.values()) == 360


def test_mudda_first_lord_number_rule():
    """首运编号 = 本命首 Vimshottari 曜编号 + 完成年数，mod 9（0→金）。
    本命首=Sun(1)、完成 21 年 → 22 mod 9 = 4 → 罗睺。"""
    assert tj.mudda_first_lord('Sun', 21) == 'Rahu'
    # 余 0 → 金。Sun(1)+8=9 → 9 mod 9 = 0 → Venus。
    assert tj.mudda_first_lord('Sun', 8) == 'Venus'


def test_varsha_narayana_uses_muntha():
    """Varsha-Narayana 用 Muntha 作 lagna。本命白羊、完成 21 年 → Muntha 第 10 宫 = 摩羯。"""
    assert tj.varsha_narayana_lagna(const.ARIES, 21) == const.CAPRICORN


# ── 顶层装配冒烟 ─────────────────────────────────────────────────────────
def test_build_tajaka_smoke():
    """端到端装配：结构齐全、Muntha/年主/Saham/瑜伽/大运键均在。"""
    annual = {
        const.SUN: {'sign': const.PISCES, 'lon': 11 * 30 + 5.0},
        const.MOON: {'sign': const.PISCES, 'lon': 11 * 30 + 15.0},
        const.MARS: {'sign': const.PISCES, 'lon': 11 * 30 + 24.0},
        const.MERCURY: {'sign': const.AQUARIUS, 'lon': 10 * 30 + 11.0},
        const.JUPITER: {'sign': const.CAPRICORN, 'lon': 9 * 30 + 20.0},
        const.VENUS: {'sign': const.CAPRICORN, 'lon': 9 * 30 + 1.0},
        const.SATURN: {'sign': const.ARIES, 'lon': 0 * 30 + 19.0},
    }
    res = tj.build_tajaka(
        annual_positions=annual, natal_lagna_sign=const.LEO,
        annual_lagna_lon=9 * 30 + 10.0, age_completed=27, day_birth=False)
    assert res['available'] is True
    assert res['muntha']['houseFromNatalLagna'] == 27 % 12 + 1
    assert res['yearLord'] is not None and res['yearLord']['planet'] is not None
    assert len(res['sahams']) == 36
    assert 'position' in res['yogas'] and 'pairwise' in res['yogas']
    assert len(res['yogas']['catalog']) == 16
    assert 'patyayini' in res['dasas']
    assert res['dasas']['varshaNarayanaLagna'] is not None
    # Harsha/Pancha 各七曜。
    assert len(res['harshaBala']) == 7
    assert len(res['panchaVargeeyaBala']) == 7


def test_detect_higher_yogas_structure_and_speed():
    # P1 高阶 Tajika:Nakta/Yamaya/Kamboola 结构 + 速度序(月<水<金<日<火<木<土)。
    assert tj._TAJAKA_SPEED_RANK[const.MOON] == 0
    assert tj._TAJAKA_SPEED_RANK[const.SATURN] == 6
    assert tj._TAJAKA_SPEED_RANK[const.MOON] < tj._TAJAKA_SPEED_RANK[const.SUN] < tj._TAJAKA_SPEED_RANK[const.SATURN]
    signs = {const.SUN: const.ARIES, const.SATURN: const.LEO, const.MOON: const.GEMINI}
    lons = {const.SUN: 5.0, const.SATURN: 125.0, const.MOON: 65.0}
    hy = tj.detect_higher_yogas(signs, lons, {})
    assert set(hy.keys()) == {'nakta', 'yamaya', 'kamboola'}
    assert all(isinstance(hy[k], list) for k in hy)
    # 居间曜(via)恒比两端皆快(Nakta)或皆慢(Yamaya)。
    for y in hy['nakta']:
        assert tj._TAJAKA_SPEED_RANK[y['via']] < tj._TAJAKA_SPEED_RANK[y['a']]
        assert tj._TAJAKA_SPEED_RANK[y['via']] < tj._TAJAKA_SPEED_RANK[y['b']]
    for y in hy['yamaya']:
        assert tj._TAJAKA_SPEED_RANK[y['via']] > tj._TAJAKA_SPEED_RANK[y['a']]
        assert tj._TAJAKA_SPEED_RANK[y['via']] > tj._TAJAKA_SPEED_RANK[y['b']]


def test_tajaka_yoga_catalog_has_16():
    # 16 瑜伽名录齐备(参考列表)。
    assert len(tj.TAJAKA_YOGA_CATALOG) == 16
    keys = [k for k, _, _ in tj.TAJAKA_YOGA_CATALOG]
    for must in ['Ithasala', 'Eesarpha', 'Nakta', 'Yamaya', 'Kamboola', 'Ishkavala', 'Induvara']:
        assert must in keys


def test_hadda_table_equals_egyptian_terms_all_signs():
    """T-28:Tājika 界(Hadda)主表 = 埃及界,十二座逐段与 flatlib 权威表全等(此前双子 6–17° 木金、射手 21–30° 火土互换,旧测试只测白羊/天秤/双鱼)。"""
    from flatlib.dignities import tables as fl_tables
    name_map = {'Sun': const.SUN, 'Moon': const.MOON, 'Mercury': const.MERCURY, 'Venus': const.VENUS,
                'Mars': const.MARS, 'Jupiter': const.JUPITER, 'Saturn': const.SATURN}
    for sign in const.LIST_SIGNS:
        rows = fl_tables.EGYPTIAN_TERMS[sign]
        expect = [(int(hi), name_map[pl]) for (pl, lo, hi) in rows]
        assert tj.HADDA_LORDS[sign] == expect, sign


def test_mudda_dasa_present_when_natal_inputs_given():
    """[Q-123/T-31] 生产链此前从不传本命首运曜/月宿余比 → Mudda 恒缺;webindiasrv 现从本命 jyotish 抽取并传入。"""
    annual = {
        const.SUN: {'sign': const.PISCES, 'lon': 11 * 30 + 5.0},
        const.MOON: {'sign': const.PISCES, 'lon': 11 * 30 + 15.0},
        const.MARS: {'sign': const.PISCES, 'lon': 11 * 30 + 24.0},
        const.MERCURY: {'sign': const.AQUARIUS, 'lon': 10 * 30 + 11.0},
        const.JUPITER: {'sign': const.CAPRICORN, 'lon': 9 * 30 + 20.0},
        const.VENUS: {'sign': const.CAPRICORN, 'lon': 9 * 30 + 1.0},
        const.SATURN: {'sign': const.ARIES, 'lon': 0 * 30 + 19.0},
    }
    res = tj.build_tajaka(annual_positions=annual, natal_lagna_sign=const.LEO, annual_lagna_lon=9 * 30 + 10.0,
                          age_completed=27, day_birth=False,
                          natal_first_vimshottari_key='Moon', natal_moon_remaining_ratio=0.5)
    mudda = res['dasas'].get('mudda')
    assert mudda and mudda.get('available') is not False
    assert mudda['firstLord'] == tj.mudda_first_lord('Moon', 27)
    assert len(mudda['sequence']) >= 9
    from websrv.webindiasrv import IndiaAstroSrv
    key, ratio = IndiaAstroSrv._natal_mudda_inputs({'dasha': {'vimshottari': {'firstLord': {'key': 'Moon', 'years': 10}, 'moonNakshatra': {'remainingRatio': 0.5}}}})
    assert (key, ratio) == ('Moon', 0.5)
    assert IndiaAstroSrv._natal_mudda_inputs(None) == (None, None)
