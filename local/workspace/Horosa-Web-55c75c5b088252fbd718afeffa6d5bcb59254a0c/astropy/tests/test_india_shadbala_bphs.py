# -*- coding: utf-8 -*-
"""六力 + 八分点 Sodhana / Kakshya 结构与不变量测试。

覆盖(可断言项)：
- Naisargika 固定 virupa 精确值(标准定值)。
- Rupas = 总 virupa ÷ 60。
- 六源 virupa 各非负。
- Sodhana(Trikona + Ekadhipatya)幂等：再 Sodhana 不变。
- Uchcha / Dig 线性式边界(深旺=60、对宫=0)。
- Kakshya 边界(3°45′ 倍数)。
- Saptavargaja 七盘尊贵档累加(含自给型尊贵分类)。
- Ayana 赤纬式符号规则(各曜分组 + 太阳 ×2)。
- Drik 分段虚拉式各接缝连续(尤其 a=180→60)。
- Cheshta 八态查表。
仅 Abda/Masa(年/月主曜需精确历法时刻)在引擎未传该主曜时按 pending 计 0。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'flatlib-ctrad2'))

from flatlib import const  # noqa: E402
from astrostudy.india import shadbala_bphs as sb  # noqa: E402


# ── Naisargika 固定值(标准定值)──────────────────────────────────────────
def test_naisargika_fixed_values():
    expected = {
        const.SUN: 60.0,
        const.MOON: 51.4286,
        const.VENUS: 42.8571,
        const.JUPITER: 34.2857,
        const.MERCURY: 25.7143,
        const.MARS: 17.1429,
        const.SATURN: 8.5714,
    }
    for planet, val in expected.items():
        assert abs(sb.naisargika_bala(planet) - val) < 1e-3, planet
    # 严格亮度降序：日 > 月 > 金 > 木 > 水 > 火 > 土
    order = [const.SUN, const.MOON, const.VENUS, const.JUPITER,
             const.MERCURY, const.MARS, const.SATURN]
    vals = [sb.naisargika_bala(p) for p in order]
    assert vals == sorted(vals, reverse=True)
    # 节点不入六力。
    assert sb.naisargika_bala(const.NORTH_NODE) == 0.0
    assert sb.naisargika_bala(const.SOUTH_NODE) == 0.0


# ── Uchcha 线性式边界 ────────────────────────────────────────────────────
def test_uchcha_bala_bounds():
    # 深旺点 → 60；对宫(深落)→ 0。
    for planet in sb.SHADBALA_PLANETS:
        exalt_lon = sb._deep_exalt_lon(planet)
        debil_lon = (exalt_lon + 180.0) % 360.0
        assert abs(sb.uchcha_bala(planet, exalt_lon) - 60.0) < 1e-6, planet
        assert abs(sb.uchcha_bala(planet, debil_lon) - 0.0) < 1e-6, planet
        # 90° 偏移 → 30(线性中点)。
        mid = (debil_lon + 90.0) % 360.0
        assert abs(sb.uchcha_bala(planet, mid) - 30.0) < 1e-6, planet


# ── Dig 线性式边界 ───────────────────────────────────────────────────────
def test_dig_bala_bounds():
    for planet, strong in sb.DIG_STRONG_HOUSE.items():
        weak = ((strong + 6 - 1) % 12) + 1
        assert abs(sb.dig_bala(planet, strong) - 60.0) < 1e-6, planet
        assert abs(sb.dig_bala(planet, weak) - 0.0) < 1e-6, planet


# ── Kendradi / Ojayugma / Drekkana 结构分 ────────────────────────────────
def test_kendradi_bala_categories():
    for h in (1, 4, 7, 10):
        assert sb.kendradi_bala(h) == 60.0
    for h in (2, 5, 8, 11):
        assert sb.kendradi_bala(h) == 30.0
    for h in (3, 6, 9, 12):
        assert sb.kendradi_bala(h) == 15.0


def test_ojayugma_bounds():
    # 各项 ∈ {0,15,30}。月/金喜偶、余喜奇。
    for planet in sb.SHADBALA_PLANETS:
        for lon in (5.0, 35.0, 65.0, 95.0, 185.0, 275.0):
            v = sb.ojayugma_bala(planet, lon)
            assert v in (0.0, 15.0, 30.0), (planet, lon, v)


def test_drekkana_bounds():
    for planet in sb.SHADBALA_PLANETS:
        for signlon in (3.0, 13.0, 23.0):
            v = sb.drekkana_bala(planet, signlon)
            assert v in (0.0, 15.0), (planet, signlon, v)


# ── 六力合算：Rupas = 总 virupa ÷ 60；六源非负 ───────────────────────────
def _sample_ctx(lon=15.0, house=1):
    return {
        'lon': lon,
        'signlon': lon % 30.0,
        'houseFromLagna': house,
        'sunLon': 100.0,
        'moonLon': 250.0,
        'fractionFromMidnight': 0.5,
        'isDay': True,
        'retrograde': False,
        'weekdayLord': const.SUN,
        'horaLord': const.MOON,
    }


def test_rupas_is_virupa_over_60():
    for planet in sb.SHADBALA_PLANETS:
        res = sb.compute_shadbala(planet, _sample_ctx(lon=10.0 + 30 * sb.SHADBALA_PLANETS.index(planet)))
        assert abs(res['rupas'] - res['totalVirupa'] / 60.0) < 1e-3, planet


def test_six_sources_non_negative():
    for planet in sb.SHADBALA_PLANETS:
        res = sb.compute_shadbala(planet, _sample_ctx(lon=12.0, house=(planet == const.SUN) and 4 or 7))
        assert res['sthana']['virupa'] >= 0.0
        assert res['dig'] >= 0.0
        assert res['kala']['virupa'] >= 0.0
        assert res['cheshta']['virupa'] >= 0.0
        assert res['naisargika'] >= 0.0
        assert res['totalVirupa'] >= 0.0
        # Drik 占位可为负(凶照)——只断言为数值。
        assert isinstance(res['drik']['virupa'], float)


def test_required_rupas_ratio():
    res = sb.compute_shadbala(const.SUN, _sample_ctx())
    assert res['requiredRupas'] == 5.0
    expected_ratio = res['rupas'] / res['requiredRupas']
    assert abs(res['strengthRatio'] - expected_ratio) < 1e-3


def test_required_rupas_classic_bphs():
    # 经典 BPHS 达标线订正(原 Venus8.0/Jupiter6.0 转录误):Venus5.5 / Jupiter6.5。
    assert sb.REQUIRED_RUPAS[const.VENUS] == 5.5
    assert sb.REQUIRED_RUPAS[const.JUPITER] == 6.5
    assert sb.REQUIRED_RUPAS[const.MERCURY] == 7.0
    assert sb.REQUIRED_RUPAS[const.SUN] == 5.0


def test_hora_lord_chaldean_sequence():
    # P0-7 Hora 表主曜约定:日出首段=当日 vara 主,之后 Chaldean 序循环。
    # 七 vara 首段各为该日主曜(周日起 0=日)。
    firsts = [sb.hora_lord_at(w, 0) for w in range(7)]
    assert firsts == [const.SUN, const.MOON, const.MARS, const.MERCURY,
                      const.JUPITER, const.VENUS, const.SATURN]
    # 周日第 25 段(=次日周一首段)= 月亮,周一首段亦月亮,自洽。
    assert sb.hora_lord_at(0, 24) == const.MOON
    assert sb.hora_lord_at(1, 0) == const.MOON
    # 循环周期 7:同 vara 内第 i 与第 i+7 段同主。
    for i in range(7):
        assert sb.hora_lord_at(3, i) == sb.hora_lord_at(3, i + 7)


def test_vimsopaka_weight_tables_sum_to_20():
    # P0-8 转录护栏:四组分盘权重各自和 = 20、成员数 6/7/10/16。
    counts = {'shadvarga': 6, 'saptavarga': 7, 'dasavarga': 10, 'shodasavarga': 16}
    for group, weights in sb.VIMSOPAKA_WEIGHTS.items():
        assert len(weights) == counts[group]
        assert abs(sum(weights.values()) - 20.0) < 1e-9, group
    # 关键单项(D60 在 Dasa/Shodasa 权重最大)。
    assert sb.VIMSOPAKA_WEIGHTS['dasavarga'][60] == 5
    assert sb.VIMSOPAKA_WEIGHTS['shodasavarga'][60] == 4
    assert sb.VIMSOPAKA_WEIGHTS['shadvarga'][1] == 6


def test_vimsopaka_bala_in_range_and_dignity_full():
    # 自占/旺满折算:own_sign → fraction=30/45;moolatrikona → 45/45=1。逐组 total ∈[0,20]。
    ps = {const.SUN: const.LEO}                  # 太阳在自庙狮子(D1)
    vp = sb.vimsopaka_bala(const.SUN, 130.0, ps, signlon=10.0)   # 狮 10°(MT 0-20 内)
    for group, d in vp.items():
        assert 0.0 <= d['total'] <= 20.0 + 1e-9
        assert d['max'] == 20
    # D1 落 MT(狮 0-20°) → fraction=1,贡献 = 该盘权重整额。
    assert abs(vp['shadvarga']['perChart'][1]['contribution'] - 6.0) < 1e-9
    assert vp['shadvarga']['perChart'][1]['dignity'] == 'moolatrikona'


def test_pending_flags_present():
    # pending 标志键齐全(防止误当已完成)。
    res = sb.compute_shadbala(const.MARS, _sample_ctx())
    assert set(res['pending'].keys()) == {'saptavargaja', 'kala', 'cheshta', 'drik'}
    # 无 planetSigns/perVargaDignity → Saptavargaja 仍 pending。
    assert res['pending']['saptavargaja'] is True
    # Cheshta 现为八态查表(顺行=chara 45)→ 不再 pending。
    assert res['pending']['cheshta'] is False
    assert res['cheshta']['virupa'] == 45.0 and res['cheshta']['state'] == 'chara'
    # 无 aspecting → Drik=0 且非 pending(无相位而非待补)。
    assert res['pending']['drik'] is False and res['drik']['virupa'] == 0.0
    # Kala 仍 pending:Abda/Masa 主曜未传 + 无赤纬(Ayana)。
    assert res['pending']['kala'] is True
    # 逆行 Mars → Cheshta = vakra 60。
    ctx_retro = _sample_ctx()
    ctx_retro['retrograde'] = True
    res2 = sb.compute_shadbala(const.MARS, ctx_retro)
    assert res2['cheshta']['pending'] is False
    assert res2['cheshta']['virupa'] == 60.0 and res2['cheshta']['state'] == 'vakra'
    # 给齐 planetSigns + 赤纬 + 年/月主 → saptavargaja/kala 均不再 pending。
    ctx_full = _sample_ctx()
    ctx_full['planetSigns'] = {p: const.ARIES for p in sb.SHADBALA_PLANETS}
    ctx_full['d1Lon'] = ctx_full['lon']
    ctx_full['declination'] = 12.0
    ctx_full['yearLord'] = const.MARS
    ctx_full['monthLord'] = const.MARS
    res3 = sb.compute_shadbala(const.MARS, ctx_full)
    assert res3['pending']['saptavargaja'] is False
    assert res3['pending']['kala'] is False
    assert res3['anyPending'] is False


def test_ishta_kashta_framework():
    ik = sb.ishta_kashta_phala(60.0, 60.0)
    assert abs(ik['ishta'] - 60.0) < 1e-6 and abs(ik['kashta'] - 0.0) < 1e-6
    ik2 = sb.ishta_kashta_phala(0.0, 0.0)
    assert abs(ik2['ishta'] - 0.0) < 1e-6 and abs(ik2['kashta'] - 60.0) < 1e-6
    ik3 = sb.ishta_kashta_phala(30.0, 30.0)
    assert abs(ik3['ishta'] - 30.0) < 1e-6 and abs(ik3['kashta'] - 30.0) < 1e-6


def test_compute_all_shape():
    contexts = {p: _sample_ctx(lon=10.0 + 30 * i) for i, p in enumerate(sb.SHADBALA_PLANETS)}
    out = sb.compute_all(contexts)
    assert out['method'] == 'six_source'
    assert 'anyPending' in out
    for p in sb.SHADBALA_PLANETS:
        assert p in out
        assert 'ishtaKashta' in out[p]
        assert 'rupas' in out[p]


# ── 日/月总分排除 Cheshta(其 Cheshta 实为 Ayana/Paksha，已含于 Kala) ─────────
def test_sun_moon_total_excludes_cheshta():
    # 日/月:总分 = Sthana + Dig + Kala + Naisargika + Drik(不含 Cheshta)。
    for planet in (const.SUN, const.MOON):
        res = sb.compute_shadbala(planet, _sample_ctx(lon=12.0, house=4))
        # 日/月 Cheshta 以 Ayana/Paksha 代 → 本项占位 0(state=substitute)。
        assert res['cheshta']['virupa'] == 0.0
        assert res['cheshta']['state'] == 'substitute'
        expected = (res['sthana']['virupa'] + res['dig'] + res['kala']['virupa']
                    + res['naisargika'] + res['drik']['virupa'])
        assert abs(res['totalVirupa'] - round(expected, 4)) < 1e-6, planet
    # 对照:五星之一(火)总分须确实含其 Cheshta 分量。
    ctx = _sample_ctx(lon=12.0, house=7)
    ctx['retrograde'] = True                     # 逆行 → Cheshta=60(非 0)
    rm = sb.compute_shadbala(const.MARS, ctx)
    assert rm['cheshta']['virupa'] == 60.0
    expected_no_ch = (rm['sthana']['virupa'] + rm['dig'] + rm['kala']['virupa']
                      + rm['naisargika'] + rm['drik']['virupa'])
    # 含 Cheshta 才对得上;若误排 Cheshta 则差 60。
    assert abs(rm['totalVirupa'] - round(expected_no_ch + rm['cheshta']['virupa'], 4)) < 1e-6


# ── VMDH(年/月/日/时主)只计一次:Kala 合 = 各分项之和，Abda/Masa/Vara/Hora 不重复 ──
def test_kala_vmdh_single_count():
    ctx = _sample_ctx(lon=20.0)
    ctx['weekdayLord'] = const.MARS              # Vara 命中 → 45
    ctx['horaLord'] = const.MARS                 # Hora 命中 → 60
    ctx['yearLord'] = const.MARS                 # Abda 命中 → 15
    ctx['monthLord'] = const.MARS                # Masa 命中 → 30
    ctx['declination'] = 12.0
    k = sb.compute_shadbala(const.MARS, ctx)['kala']
    # Kala 合 = Nathonnatha + Paksha + Tribhaga + (Abda+Masa+Vara+Hora) + Ayana + Yuddha。
    # abdaMasa 字段 = Abda+Masa(15+30=45);Vara/Hora 单列(45/60)。四项合计 = VMDH，各计一次。
    assert abs(k['abdaMasa'] - 45.0) < 1e-6      # Abda 15 + Masa 30，仅此一处
    assert abs(k['vara'] - 45.0) < 1e-6
    assert abs(k['hora'] - 60.0) < 1e-6
    parts = (k['nathonnatha'] + k['paksha'] + k['tribhaga']
             + k['abdaMasa'] + k['vara'] + k['hora'] + k['ayana'] + k['yuddha'])
    assert abs(k['virupa'] - round(parts, 4)) < 1e-3
    # VMDH 合计(年+月+日+时)= 45+45+60 = 150;若被重复累加(再加一份 150)则 virupa 会高 150。
    vmdh = k['abdaMasa'] + k['vara'] + k['hora']
    assert abs(vmdh - 150.0) < 1e-6


# ── Ishta/Kashta:顶层平铺 + = sqrt 式;日取 Ayana、月取 Paksha 作有效 Cheshta ─────
def test_ishta_kashta_per_planet_exposed_and_formula():
    contexts = {p: _sample_ctx(lon=10.0 + 30 * i, house=(i % 12) + 1)
                for i, p in enumerate(sb.SHADBALA_PLANETS)}
    # 给齐 Ayana(赤纬)以使日/月有效 Cheshta(Ayana/Paksha)非 0。
    for c in contexts.values():
        c['declination'] = 10.0
    out = sb.compute_all(contexts)
    for p in sb.SHADBALA_PLANETS:
        res = out[p]
        # 顶层须平铺 ishta/kashta，且与嵌套 ishtaKashta 一致。
        assert 'ishta' in res and 'kashta' in res
        assert abs(res['ishta'] - res['ishtaKashta']['ishta']) < 1e-9
        assert abs(res['kashta'] - res['ishtaKashta']['kashta']) < 1e-9
        # 有效 Cheshta:日=Ayana/2、月=未加倍 Paksha、五星=本身 Cheshta。
        # 🔴 加倍值(0..120)是 Kala 合计口径,直接喂 60 量纲会被 clamp → 约半数盘
        # Kashta 恒 0;守卫改锁未加倍基准。
        if p == const.SUN:
            ch = res['kala']['ayana'] / 2.0
        elif p == const.MOON:
            sep = abs((contexts[p]['moonLon'] - contexts[p]['sunLon'] + 180.0) % 360.0 - 180.0)
            ch = sep / 180.0 * 60.0
        else:
            ch = res['cheshta']['virupa']
        uc = max(0.0, min(60.0, res['sthana']['uchcha']))
        ch_c = max(0.0, min(60.0, ch))
        assert abs(res['ishta'] - (uc * ch_c) ** 0.5) < 1e-3, p
        assert abs(res['kashta'] - ((60.0 - uc) * (60.0 - ch_c)) ** 0.5) < 1e-3, p


# ════════════════════════════════════════════════════════════════════════════
# Saptavargaja(七盘尊贵档累加)
# ════════════════════════════════════════════════════════════════════════════
def test_saptavargaja_dignity_virupa_table():
    # 档值表(标准计算口径)。
    t = sb.SAPTAVARGAJA_VIRUPA_BY_DIGNITY
    assert t['moolatrikona'] == 45.0
    assert t['own_sign'] == 30.0
    assert t['adhimitra'] == 22.5
    assert t['friend'] == 15.0
    assert t['neutral'] == 7.5
    assert t['enemy'] == 3.75
    assert t['adhisatru'] == 1.875


def test_saptavargaja_sum_over_seven():
    # 人工七盘尊贵字典 → 累加。
    per = {1: 'moolatrikona', 2: 'own_sign', 3: 'friend',
           7: 'neutral', 9: 'enemy', 12: 'adhisatru', 30: 'adhimitra'}
    res = sb.saptavargaja_bala(per)
    expect = 45.0 + 30.0 + 15.0 + 7.5 + 3.75 + 1.875 + 22.5
    assert abs(res['virupa'] - expect) < 1e-6
    assert res['pending'] is False
    # 缺七盘字典 → pending。
    assert sb.saptavargaja_bala(None)['pending'] is True


def test_saptavargaja_self_classifier_own_and_mt():
    # 太阳在 Leo 5°(本垣三角区 0-20°)：D1=moolatrikona、D2/D3 own、余盘 neutral(空盘无友谊)。
    psigns = {const.SUN: const.LEO}
    lon = 4 * 30 + 5.0          # Leo 5°
    dm = sb.saptavargaja_dignity_map(const.SUN, lon, psigns, signlon=5.0)
    assert set(dm.keys()) == set(sb.SAPTAVARGA_CHARTS)
    assert dm[1] == 'moolatrikona'        # D1 按度判 MT
    # 七盘累加 = 135（45 + 30 + 30 + 7.5×4）。
    assert abs(sb.saptavargaja_bala(dm)['virupa'] - 135.0) < 1e-6
    # moolatrikona 仅 D1：太阳在 Leo 25°(MT 区外)→ D1 应退为 own_sign。
    dm2 = sb.saptavargaja_dignity_map(const.SUN, 4 * 30 + 25.0, psigns, signlon=25.0)
    assert dm2[1] == 'own_sign'


# ════════════════════════════════════════════════════════════════════════════
# Ayana(赤纬式 + 符号规则)
# ════════════════════════════════════════════════════════════════════════════
def test_ayana_zero_declination_is_30():
    # 赤纬 0 → 30 virupa(太阳 ×2 → 60)。
    for p in (const.MARS, const.JUPITER, const.VENUS, const.MOON, const.SATURN, const.MERCURY):
        assert abs(sb.ayana_bala(p, 0.0)['virupa'] - 30.0) < 1e-6, p
    assert abs(sb.ayana_bala(const.SUN, 0.0)['virupa'] - 60.0) < 1e-6


def test_ayana_sign_rules():
    # 北纬取「+」组(日/火/木/金):北纬增。月/土相反;水恒「+」。
    for p in (const.MARS, const.JUPITER, const.VENUS):
        assert abs(sb.ayana_bala(p, 24.0)['virupa'] - 60.0) < 1e-6, p     # 北 → 满
        assert abs(sb.ayana_bala(p, -24.0)['virupa'] - 0.0) < 1e-6, p     # 南 → 0
    # 太阳:北纬满 ×2 = 120;南纬 0。
    assert abs(sb.ayana_bala(const.SUN, 24.0)['virupa'] - 120.0) < 1e-6
    assert abs(sb.ayana_bala(const.SUN, -24.0)['virupa'] - 0.0) < 1e-6
    # 月/土:北纬取「−」→ 北纬反而 0、南纬满。
    for p in (const.MOON, const.SATURN):
        assert abs(sb.ayana_bala(p, 24.0)['virupa'] - 0.0) < 1e-6, p
        assert abs(sb.ayana_bala(p, -24.0)['virupa'] - 60.0) < 1e-6, p
    # 水恒「+」:北纬满、南纬 0。
    assert abs(sb.ayana_bala(const.MERCURY, 24.0)['virupa'] - 60.0) < 1e-6
    assert abs(sb.ayana_bala(const.MERCURY, -24.0)['virupa'] - 0.0) < 1e-6
    # 缺赤纬 → pending。
    assert sb.ayana_bala(const.MARS, None)['pending'] is True


# ════════════════════════════════════════════════════════════════════════════
# Drik(分段 Sphuta Drishti 虚拉式)
# ════════════════════════════════════════════════════════════════════════════
def test_drik_general_continuity_at_joins():
    # 通用列在各接缝两侧连续(330 处为定义性断点,不查)。
    joins = [30, 60, 90, 120, 150, 180, 210, 300]
    for a in joins:
        left = sb._drishti_general(a - 1e-7)
        right = sb._drishti_general(a + 1e-7)
        assert abs(left - right) < 1e-4, (a, left, right)


def test_drik_a180_is_60_critical():
    # ⚠️ 关键:150–180 段为 2×(a−150)，a=180 → 60(而非 0)。
    assert abs(sb._drishti_general(180.0) - 60.0) < 1e-6
    assert abs(sb.sphuta_drishti(const.SUN, 180.0) - 60.0) < 1e-6
    assert abs(sb.sphuta_drishti(const.MERCURY, 180.0) - 60.0) < 1e-6
    # 半程 a=165 → 2×15 = 30。
    assert abs(sb._drishti_general(165.0) - 30.0) < 1e-6


def test_drik_general_segment_values():
    # 各段端点采样(与分段式逐项核对)。
    assert sb._drishti_general(45.0) == 7.5       # (45-30)/2
    assert sb._drishti_general(75.0) == 30.0      # 75-45
    assert sb._drishti_general(105.0) == 37.5     # 30+(120-105)/2
    assert sb._drishti_general(135.0) == 15.0     # 150-135
    assert sb._drishti_general(195.0) == 52.5     # (300-195)/2


def test_drik_saturn_continuity():
    # 土星专列在 30/60/90/240/270 接缝连续(330 断点不查)。
    for a in [30, 60, 90, 240, 270]:
        left = sb._drishti_saturn(a - 1e-7)
        right = sb._drishti_saturn(a + 1e-7)
        assert abs(left - right) < 1e-4, (a, left, right)
    # 土星 60° 满 60(2×(60−30))。
    assert abs(sb._drishti_saturn(60.0) - 60.0) < 1e-6


def test_drik_benefic_malefic_sign_and_div4():
    # 吉曜照 +、凶曜照 −,净和 / 4。被照点 lon=180:照者在 0° → a=180 → 虚拉 60。
    # 木(吉)在 0、土(凶)在 0：净 = +60 − 60 = 0。
    res = sb.drik_bala([(const.JUPITER, 0.0), (const.SATURN, 0.0)], target_lon=180.0)
    assert abs(res['virupa'] - 0.0) < 1e-6
    # 仅木(吉)照：+60/4 = 15。
    res2 = sb.drik_bala([(const.JUPITER, 0.0)], target_lon=180.0)
    assert abs(res2['virupa'] - 15.0) < 1e-6
    # 仅土(凶)照：−60/4 = −15。
    res3 = sb.drik_bala([(const.SATURN, 0.0)], target_lon=180.0)
    assert abs(res3['virupa'] - (-15.0)) < 1e-6
    # 预算虚拉形态(无 target_lon)：直接吉+/凶− 净 / 4。
    res4 = sb.drik_bala([(const.MOON, 40.0), (const.MARS, 20.0)])
    assert abs(res4['virupa'] - (40.0 - 20.0) / 4.0) < 1e-6
    # 无相位 → 0 且非 pending。
    assert sb.drik_bala([])['virupa'] == 0.0 and sb.drik_bala([])['pending'] is False


# ════════════════════════════════════════════════════════════════════════════
# Cheshta(离散八态)
# ════════════════════════════════════════════════════════════════════════════
def test_cheshta_eight_states():
    t = sb.CHESHTA_VIRUPA_BY_STATE
    assert t['vakra'] == 60.0 and t['anuvakra'] == 30.0 and t['vikala'] == 15.0
    assert t['manda'] == 30.0 and t['mandatara'] == 15.0 and t['sama'] == 7.5
    assert t['chara'] == 45.0 and t['atichara'] == 30.0
    # 逆行 → vakra 60;逆入前宫 → anuvakra 30;留 → vikala 15。
    assert sb.cheshta_bala(const.MARS, retrograde=True)['state'] == 'vakra'
    assert sb.cheshta_bala(const.MARS, retrograde=True, entered_prev_sign=True)['state'] == 'anuvakra'
    assert sb.cheshta_bala(const.MARS, stationary=True)['state'] == 'vikala'
    # 顺行无均速 → chara 45。
    assert sb.cheshta_bala(const.MARS)['state'] == 'chara'
    # 按速度比分档。
    assert sb.cheshta_bala(const.MARS, speed=2.0, mean_speed=1.0)['state'] == 'atichara'
    assert sb.cheshta_bala(const.MARS, speed=0.9, mean_speed=1.0)['state'] == 'sama'
    assert sb.cheshta_bala(const.MARS, speed=0.6, mean_speed=1.0)['state'] == 'manda'
    assert sb.cheshta_bala(const.MARS, speed=0.2, mean_speed=1.0)['state'] == 'mandatara'
    # 日/月以 Ayana/Paksha 代 → substitute 占位。
    assert sb.cheshta_bala(const.SUN)['state'] == 'substitute'
    assert sb.cheshta_bala(const.MOON)['state'] == 'substitute'


# ════════════════════════════════════════════════════════════════════════════
# Tribhaga(三分时主曜)
# ════════════════════════════════════════════════════════════════════════════
def test_tribhaga_lords():
    # 木恒 60(每盘)。
    assert sb.tribhaga_bala(const.JUPITER)['virupa'] == 60.0
    # 昼三段主：水/日/土。
    assert sb.tribhaga_bala(const.MERCURY, is_day=True, tribhaga_index=0)['virupa'] == 60.0
    assert sb.tribhaga_bala(const.SUN, is_day=True, tribhaga_index=1)['virupa'] == 60.0
    assert sb.tribhaga_bala(const.SATURN, is_day=True, tribhaga_index=2)['virupa'] == 60.0
    # 夜三段主：月/金/火。
    assert sb.tribhaga_bala(const.MOON, is_day=False, tribhaga_index=0)['virupa'] == 60.0
    assert sb.tribhaga_bala(const.VENUS, is_day=False, tribhaga_index=1)['virupa'] == 60.0
    assert sb.tribhaga_bala(const.MARS, is_day=False, tribhaga_index=2)['virupa'] == 60.0
    # 非当段主 → 0。
    assert sb.tribhaga_bala(const.SUN, is_day=True, tribhaga_index=0)['virupa'] == 0.0
    assert sb.tribhaga_bala(const.JUPITER)['pending'] is False


# ════════════════════════════════════════════════════════════════════════════
# 年/月/日/时主(Vara/Hora 行星时序)
# ════════════════════════════════════════════════════════════════════════════
def test_hora_lord_sequence():
    # 周日(idx0)日出 hora 主 = 太阳;之后按 Chaldean 逆喜悦序:日→金→水→月→土→木→火。
    seq = [sb.hora_lord_at(0, i) for i in range(7)]
    assert seq == [const.SUN, const.VENUS, const.MERCURY, const.MOON,
                   const.SATURN, const.JUPITER, const.MARS]
    # 第 24 时(次日日出)主曜 = 次日 vara 主:周日 +24 → 周一日出 = 月。
    assert sb.hora_lord_at(0, 24) == const.MOON
    # 周二(idx2)日出主 = 火星。
    assert sb.hora_lord_at(2, 0) == const.MARS
    # Vara/Hora bala 命中。
    assert sb.vara_bala(const.SUN, const.SUN) == 45.0
    assert sb.vara_bala(const.MOON, const.SUN) == 0.0
    assert sb.hora_bala(const.MARS, const.MARS) == 60.0


# ════════════════════════════════════════════════════════════════════════════
# 八分点 Sodhana / Kakshya
# ════════════════════════════════════════════════════════════════════════════

# 一份示例 BAV(12 宫 bindu，和不限；用于结构 + 幂等)。
_SAMPLE_BAV = {
    const.ARIES: 4, const.TAURUS: 3, const.GEMINI: 5, const.CANCER: 2,
    const.LEO: 6, const.VIRGO: 1, const.LIBRA: 3, const.SCORPIO: 4,
    const.SAGITTARIUS: 5, const.CAPRICORN: 0, const.AQUARIUS: 7, const.PISCES: 3,
}


def test_bav_to_list_roundtrip():
    lst = sb._bav_to_list(_SAMPLE_BAV)
    assert len(lst) == 12
    assert lst[0] == 4 and lst[10] == 7
    # 已是 list → 原样。
    assert sb._bav_to_list(lst) == lst
    # 0-based index dict。
    assert sb._bav_to_list({0: 4, 10: 7}) == [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0]


def test_trikona_sodhana_idempotent():
    once = sb.trikona_sodhana(_SAMPLE_BAV)
    twice = sb.trikona_sodhana(once)
    assert once == twice, '三角缩减必须幂等'
    # 缩减不增点。
    orig = sb._bav_to_list(_SAMPLE_BAV)
    assert all(once[i] <= orig[i] for i in range(12))
    # 三角组 {3,7,11}: Cn=2,Sc=4,Pi=3 → min=2 → [0,2,1]。
    assert once[3] == 0 and once[7] == 2 and once[11] == 1
    # 三角组 {1,5,9}: Ta=3,Vi=1,Cp=0 → min=0 → 原样 [3,1,0]。
    assert once[1] == 3 and once[5] == 1 and once[9] == 0
    # 三角组 {0,4,8}: Ar=4,Le=6,Sg=5 → min=4 → [0,2,1]。
    assert once[0] == 0 and once[4] == 2 and once[8] == 1
    # 三角组 {2,6,10}: Ge=5,Li=3,Aq=7 → min=3 → [2,0,4]。
    assert once[2] == 2 and once[6] == 0 and once[10] == 4


def test_ekadhipatya_sodhana_idempotent():
    once = sb.ekadhipatya_sodhana(_SAMPLE_BAV)
    twice = sb.ekadhipatya_sodhana(once)
    assert once == twice, '同主双宫缩减必须幂等'


def test_full_sodhana_idempotent():
    once = sb.sodhana(_SAMPLE_BAV)
    twice = sb.sodhana(once)
    assert once == twice, '全缩减(Trikona+Ekadhipatya)必须幂等'
    assert len(once) == 12


def test_ekadhipatya_occupied_rules():
    # 简化 BAV：Ar/Sc 对(火 own)= (a,b)=(idx0,idx7)。
    bav = [0] * 12
    bav[0] = 5      # Ar
    bav[7] = 3      # Sc
    # 仅 Ar 有行星 → Sc 归 0、Ar 不变。
    out = sb.ekadhipatya_sodhana(bav, occupied_signs={0})
    assert out[0] == 5 and out[7] == 0
    # 仅 Sc 有行星 → Ar 归 0。
    out2 = sb.ekadhipatya_sodhana(bav, occupied_signs={7})
    assert out2[0] == 0 and out2[7] == 3
    # 两宫皆占 → 不变。
    out3 = sb.ekadhipatya_sodhana(bav, occupied_signs={0, 7})
    assert out3[0] == 5 and out3[7] == 3
    # 皆空 → 取较小(min(5,3)=3)。
    out4 = sb.ekadhipatya_sodhana(bav, occupied_signs=set())
    assert out4[0] == 3 and out4[7] == 3


def test_sodhya_pinda_framework():
    reduced = sb.sodhana(_SAMPLE_BAV)
    sp = sb.sodhya_pinda(reduced)
    assert sp['pending'] is True            # 权重表缺 → pending
    assert sp['pinda'] == sum(reduced)
    sp2 = sb.sodhya_pinda(reduced, sign_pinda=[1] * 12, graha_pinda=[1] * 12)
    assert sp2['pending'] is False
    assert abs(sp2['pinda'] - 2 * sum(reduced)) < 1e-6


# ── Kakshya(3°45′ 倍数边界)───────────────────────────────────────────────
def test_kakshya_boundaries():
    assert sb.KAKSHYA_SPAN == 30.0 / 8.0
    assert sb.kakshya_index(0.0) == 0
    assert sb.kakshya_index(3.74) == 0
    assert sb.kakshya_index(3.75) == 1          # 3°45′ 边界进档
    assert sb.kakshya_index(7.5) == 2
    assert sb.kakshya_index(29.99) == 7
    # 档主固定序：土/木/火/日/金/水/月/Lagna。
    assert sb.kakshya_lord(0.0) == const.SATURN
    assert sb.kakshya_lord(3.75) == const.JUPITER
    assert sb.kakshya_lord(7.5) == const.MARS
    assert sb.kakshya_lord(11.25) == const.SUN
    assert sb.kakshya_lord(15.0) == const.VENUS
    assert sb.kakshya_lord(18.75) == const.MERCURY
    assert sb.kakshya_lord(22.5) == const.MOON
    assert sb.kakshya_lord(26.25) == 'Lagna'


def test_prastara_av():
    bav_by_planet = {const.SATURN: _SAMPLE_BAV}
    # 过境点 0-3.75° → 档主土；过境星座 idx0(Ar) 土 BAV=4>0 → hasRekha True。
    pav = sb.prastara_av(bav_by_planet, transit_signlon=1.0, transit_sign_index=0)
    assert pav['kakshyaLord'] == const.SATURN and pav['hasRekha'] is True
    # 过境星座 idx9(Cp)土 BAV=0 → False。
    pav2 = sb.prastara_av(bav_by_planet, transit_signlon=1.0, transit_sign_index=9)
    assert pav2['hasRekha'] is False
