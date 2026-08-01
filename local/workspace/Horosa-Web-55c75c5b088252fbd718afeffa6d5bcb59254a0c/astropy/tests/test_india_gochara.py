# -*- coding: utf-8 -*-
"""印度过运(Gochara) + Sade Sati 结构/不变量 golden。

⚠️ 吉凶为标准过运口径；书 Example/Table 的精确逐曜结论未给者按骨架 + 结构测试。
覆盖：Sade Sati 在土星过月 12/1/2 宫触发、AV 过境吉凶阈值、
      罗睺~土星/计都~火星 代理映射、community_standard 标签存在。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from flatlib import const  # noqa: E402

from astrostudy.india.gochara import (  # noqa: E402
    GOCHARA_PLANETS, NODE_PROXY, COMMUNITY_SOURCE,
    good_houses_for, vedha_house_for, house_from, sign_at_house,
    av_transit_verdict, transit_from_reference, apply_vedha,
    saturn_moon_afflictions, compute_gochara,
    BAV_GOOD_MIN, BAV_BAD_MAX, SAV_GOOD_MIN, SAV_BAD_MAX,
    nak_count_from, nak_at_count,
    tara_bala, TARA_NAMES, special_nakshatras,
    nakshatra_aspects_from, latta_nakshatra, latta_afflicts,
    murthi_for_house, transit_nakshatra_rows, VEDHA_PAIRS,
)

SUN, MOON, MARS = const.SUN, const.MOON, const.MARS
MERCURY, JUPITER, VENUS, SATURN = const.MERCURY, const.JUPITER, const.VENUS, const.SATURN
RAHU, KETU = const.NORTH_NODE, const.SOUTH_NODE
S = const.LIST_SIGNS  # 0-based Aries..Pisces


# ── rasi 几何 ──────────────────────────────────────────────────────────────
def test_house_from_basics():
    assert house_from('Aries', 'Aries') == 1
    assert house_from('Aries', 'Taurus') == 2
    assert house_from('Aries', 'Pisces') == 12
    assert house_from('Pisces', 'Aries') == 2
    assert house_from('Leo', 'Cancer') == 12
    assert house_from(None, 'Aries') is None
    assert house_from('Aries', None) is None


def test_sign_at_house_roundtrip():
    for ref in S:
        for h in range(1, 13):
            sign = sign_at_house(ref, h)
            assert house_from(ref, sign) == h


# ── 罗睺~土星 / 计都~火星 代理映射 ─────────────────────────────────────────
def test_node_proxy_mapping():
    assert NODE_PROXY[RAHU] == SATURN
    assert NODE_PROXY[KETU] == MARS
    # 罗睺吉宫 == 土星吉宫；计都吉宫 == 火星吉宫
    assert good_houses_for(RAHU) == good_houses_for(SATURN)
    assert good_houses_for(KETU) == good_houses_for(MARS)
    # 节点 Vedha 也走代理
    assert vedha_house_for(RAHU, 3) == vedha_house_for(SATURN, 3)
    assert vedha_house_for(KETU, 6) == vedha_house_for(MARS, 6)


def test_good_houses_known_planets():
    # 7 实体曜均有吉宫表(非空)；节点经代理也非空。
    for p in (SUN, MOON, MARS, MERCURY, JUPITER, VENUS, SATURN, RAHU, KETU):
        assert len(good_houses_for(p)) >= 1
    # 标准值抽样
    assert good_houses_for(SUN) == [3, 6, 10, 11]
    assert good_houses_for(SATURN) == [3, 6, 11]
    assert good_houses_for(JUPITER) == [2, 5, 7, 9, 11]


# ── AV 过境吉凶阈值（BAV≥5 吉/≤3 凶；SAV>30 吉/<25 凶）───────────────────────
def test_av_bav_thresholds():
    assert av_transit_verdict(BAV_GOOD_MIN, None)['bav'] == 'good'      # 5 → 吉
    assert av_transit_verdict(6, None)['bav'] == 'good'
    assert av_transit_verdict(BAV_BAD_MAX, None)['bav'] == 'bad'        # 3 → 凶
    assert av_transit_verdict(0, None)['bav'] == 'bad'
    assert av_transit_verdict(4, None)['bav'] == 'neutral'             # 4 → 中
    assert av_transit_verdict(None, None)['bav'] is None


def test_av_sav_thresholds():
    # 严格不等：30/25 为中性边界。
    assert av_transit_verdict(None, SAV_GOOD_MIN + 1)['sav'] == 'good'  # 31 吉
    assert av_transit_verdict(None, SAV_GOOD_MIN)['sav'] == 'neutral'   # 30 非吉
    assert av_transit_verdict(None, SAV_BAD_MAX - 1)['sav'] == 'bad'    # 24 凶
    assert av_transit_verdict(None, SAV_BAD_MAX)['sav'] == 'neutral'    # 25 非凶
    assert av_transit_verdict(None, 28)['sav'] == 'neutral'


def test_av_passthrough_bindu_values():
    v = av_transit_verdict(7, 33)
    assert v['bavBindu'] == 7 and v['savBindu'] == 33
    assert v['bav'] == 'good' and v['sav'] == 'good'


# ── Sade Sati 在土星过月 12/1/2 宫触发 ─────────────────────────────────────
def test_sade_sati_triggers_on_12_1_2():
    moon = 'Cancer'  # 本命月在巨蟹
    # 12 宫(月前一宫=双子) / 1 宫(本宫=巨蟹) / 2 宫(后一宫=狮子)→ Sade Sati 三阶段
    for h, phase in ((12, 'rising'), (1, 'peak'), (2, 'setting')):
        sat_sign = sign_at_house(moon, h)
        res = saturn_moon_afflictions(moon, sat_sign)
        assert res['available'] is True
        assert res['saturnHouseFromMoon'] == h
        assert res['sadeSati']['active'] is True
        assert res['sadeSati']['phase'] == phase


def test_sade_sati_not_triggered_elsewhere():
    moon = 'Cancer'
    for h in (3, 5, 6, 7, 9, 10, 11):
        sat_sign = sign_at_house(moon, h)
        res = saturn_moon_afflictions(moon, sat_sign)
        assert res['sadeSati']['active'] is False


def test_kantaka_and_ashtama():
    moon = 'Aries'
    # Kantaka = 4/8 宫；Ashtama = 8 宫
    res4 = saturn_moon_afflictions(moon, sign_at_house(moon, 4))
    assert res4['kantaka']['active'] is True
    assert res4['ashtamaSani']['active'] is False
    res8 = saturn_moon_afflictions(moon, sign_at_house(moon, 8))
    assert res8['kantaka']['active'] is True       # 8 宫亦属 Kantaka 集
    assert res8['ashtamaSani']['active'] is True   # 且为 Ashtama


# ── community_standard 标签存在 + 免责 ─────────────────────────────────────
def test_community_standard_label_present():
    res = saturn_moon_afflictions('Leo', 'Cancer')  # 土星在月前一宫(12)
    assert res['source'] == COMMUNITY_SOURCE
    assert res['source'] == 'community_standard'
    assert res.get('sourceLabel')          # 非空标签
    assert res.get('disclaimer')           # 非空免责
    # 未知星座降级时也带 source(功能字段必须有)
    bad = saturn_moon_afflictions('Leo', None)
    assert bad['available'] is False
    assert bad['source'] == 'community_standard'


# ── 从月/从命逐曜 + Vedha ──────────────────────────────────────────────────
def test_transit_from_reference_shape():
    transit = {p: 'Aries' for p in GOCHARA_PLANETS}
    rows = transit_from_reference('Aries', transit, 'fromMoon')
    # 9 曜(7 实体 + 罗计)都在
    assert len(rows) == len(GOCHARA_PLANETS)
    for r in rows:
        assert r['house'] == 1
        assert r['reference'] == 'fromMoon'
        assert isinstance(r['goodHouses'], list)
        assert r['verdict'] in ('good', 'bad')


def test_transit_good_verdict():
    # 土星吉宫含 3：本命月 Aries → 土星在第 3 宫(Gemini)。
    transit = {SATURN: sign_at_house('Aries', 3)}
    rows = transit_from_reference('Aries', transit, 'fromMoon')
    sat = next(r for r in rows if r['planet'] == SATURN)
    assert sat['good'] is True
    assert sat['verdict'] == 'good'


def test_vedha_cancels_good_position():
    moon = 'Aries'
    # 土星在第 3 宫(吉) → 其 vedha 宫为 12；放木星到第 12 宫遮蔽之。
    vh = vedha_house_for(SATURN, 3)
    assert vh == 12
    transit = {
        SATURN: sign_at_house(moon, 3),
        JUPITER: sign_at_house(moon, 12),
    }
    rows = transit_from_reference(moon, transit, 'fromMoon')
    apply_vedha(rows, moon, transit)
    sat = next(r for r in rows if r['planet'] == SATURN)
    assert sat['good'] is True
    assert sat['vedhaHouse'] == 12
    assert sat['vedhaBy'] == JUPITER
    assert sat['effective'] is False   # 吉位被 Vedha 抵消


def test_vedha_father_son_pairs_exempt():
    # 父子对互不为 Vedha：日↔土、月↔水。
    # 太阳吉宫 3 的 vedha 宫=9；土星在 9 宫不应遮蔽太阳(日↔土例外)。
    moon = 'Aries'
    assert vedha_house_for(SUN, 3) == 9
    transit = {
        SUN: sign_at_house(moon, 3),
        SATURN: sign_at_house(moon, 9),
    }
    rows = transit_from_reference(moon, transit, 'fromMoon')
    apply_vedha(rows, moon, transit)
    sun = next(r for r in rows if r['planet'] == SUN)
    assert sun['good'] is True
    assert sun['vedhaBy'] is None       # 土不遮日(父子对)
    assert sun['effective'] is True

    # 月吉宫 1 的 vedha 宫=5；水星在 5 宫不应遮蔽月(月↔水例外)。
    assert vedha_house_for(MOON, 1) == 5
    transit2 = {
        MOON: sign_at_house(moon, 1),
        MERCURY: sign_at_house(moon, 5),
    }
    rows2 = transit_from_reference(moon, transit2, 'fromMoon')
    apply_vedha(rows2, moon, transit2)
    mo = next(r for r in rows2 if r['planet'] == MOON)
    assert mo['good'] is True
    assert mo['vedhaBy'] is None        # 水不遮月(父子对)
    assert mo['effective'] is True


def test_vedha_sun_moon_not_exempt():
    # 日↔月 不是父子例外对：月可遮太阳的吉位。
    moon = 'Aries'
    # 太阳吉宫 3 → vedha 宫 9；月落 9 宫应遮蔽太阳。
    transit = {
        SUN: sign_at_house(moon, 3),
        MOON: sign_at_house(moon, 9),
    }
    rows = transit_from_reference(moon, transit, 'fromMoon')
    apply_vedha(rows, moon, transit)
    sun = next(r for r in rows if r['planet'] == SUN)
    assert sun['vedhaHouse'] == 9
    assert sun['vedhaBy'] == MOON        # 月遮日(非父子对)
    assert sun['effective'] is False


# ── 顶层 compute_gochara ───────────────────────────────────────────────────
def _fake_av():
    """构造一个最小 ashtakavarga 结构：让某曜某宫 BAV/SAV 命中阈值。"""
    signs = list(S)
    sarva = {s: 28 for s in signs}
    sarva['Gemini'] = 33          # SAV>30 吉
    sarva['Scorpio'] = 20         # SAV<25 凶
    bhinna = {SATURN: {s: 4 for s in signs}}
    bhinna[SATURN]['Gemini'] = 6  # BAV≥5 吉
    return {'available': True, 'bhinna': bhinna, 'sarva': sarva}


def test_compute_gochara_full():
    moon = 'Aries'
    lagna = 'Leo'
    transit = {
        SATURN: 'Gemini',   # 从月第 3 宫(吉) + BAV6/SAV33(双吉)
        RAHU: 'Scorpio',    # 代理土星
        SUN: 'Cancer',
        MOON: 'Aries',
    }
    res = compute_gochara(moon, lagna, transit, ashtakavarga=_fake_av(), transit_date='2026-06-19')
    assert res['available'] is True
    assert res['source'] == 'gochara_standard'
    assert res['transitDate'] == '2026-06-19'
    assert res['reference']['moonSign'] == 'Aries'
    assert res['reference']['lagnaSign'] == 'Leo'
    # 从月行带 AV
    sat = next(r for r in res['fromMoon'] if r['planet'] == SATURN)
    assert sat['house'] == 3 and sat['good'] is True
    assert sat['av']['bav'] == 'good'
    assert sat['av']['sav'] == 'good'
    # 从命也算
    assert len(res['fromLagna']) >= 1
    # Sade Sati 区块带 community_standard
    assert res['saturnAfflictions']['source'] == 'community_standard'


def test_compute_gochara_degrades():
    # 缺本命月 → available False，但 source 字段在
    res = compute_gochara(None, 'Leo', {SATURN: 'Aries'})
    assert res['available'] is False
    assert res['source'] == 'gochara_standard'
    # 无过运 dict 同样降级
    res2 = compute_gochara('Aries', 'Leo', {})
    assert res2['available'] is False


def test_compute_gochara_no_av_no_lagna():
    # 不传 AV / 不传 lagna：仍出从月 + Sade Sati，AV 字段为 None 三元组。
    res = compute_gochara('Cancer', None, {SATURN: 'Gemini'})
    assert res['available'] is True
    assert res['fromLagna'] == []
    sat = next(r for r in res['fromMoon'] if r['planet'] == SATURN)
    assert sat['av']['bav'] is None and sat['av']['sav'] is None


# ── 外行星不入古典过运（仅 7 曜 + 罗计）────────────────────────────────────
def test_only_classical_bodies():
    assert set(GOCHARA_PLANETS) == {
        SUN, MOON, MARS, MERCURY, JUPITER, VENUS, SATURN, RAHU, KETU
    }
    # 天王/海王/冥王不在过运曜集
    for outer in ('Uranus', 'Neptune', 'Pluto'):
        assert outer not in GOCHARA_PLANETS


# ════════════════════════════════════════════════════════════════════════════
# 宿基扩充：Tara Bala / Latta / 特殊宿 / 宿相位 / Vedha 表订正
# ════════════════════════════════════════════════════════════════════════════
# 27 宿序参照(1-based)：1 Ashwini, 2 Bharani, 3 Krittika, 4 Rohini, 5 Mrigashira,
# 6 Ardra, 7 Punarvasu, 8 Pushya, 9 Ashlesha, 10 Magha, 11 P.Phalguni,
# 12 U.Phalguni, 13 Hasta, 14 Chitra, 15 Swati, 16 Vishakha, 17 Anuradha,
# 18 Jyeshtha, 19 Mula, 20 P.Ashadha, 21 U.Ashadha, 22 Shravana, 23 Dhanishta,
# 24 Shatabhisha, 25 P.Bhadrapada, 26 U.Bhadrapada, 27 Revati。


# ── 宿几何原语 ─────────────────────────────────────────────────────────────
def test_nak_count_from_basics():
    assert nak_count_from(1, 1) == 1        # 本宿
    assert nak_count_from(1, 2) == 2
    assert nak_count_from(1, 27) == 27
    assert nak_count_from(27, 1) == 2        # 跨 0
    # Makha(10) → Swati(15) 为第 6 宿(书 26.4.1 例)
    assert nak_count_from(10, 15) == 6
    assert nak_count_from(0, 5) is None      # 越界
    assert nak_count_from(None, 5) is None


def test_nak_at_count_directions():
    # 正向第 1 宿 = 本宿
    assert nak_at_count(5, 1, forward=True) == 5
    # Sun in Mrigashira(5) 正向第 12 宿 = Vishakha(16)(书 26.7 例)
    assert nak_at_count(5, 12, forward=True) == 16
    # Moon in Anuradha(17) 逆向第 22 宿 = Dhanishta(23)(书 26.7 例)
    assert nak_at_count(17, 22, forward=False) == 23
    # 跨 0 环绕
    assert nak_at_count(1, 2, forward=False) == 27


# ── Tara Bala：九态 mod9 循环（Table64）─────────────────────────────────────
def test_tara_bala_nine_states_cycle():
    moon = 1  # 本命月宿 Ashwini
    # 距 1..27 → 九态名按 (count-1)%9+1
    expected = [
        ('janma', 'mixed'), ('sampat', 'good'), ('vipat', 'bad'),
        ('kshema', 'good'), ('pratyak', 'bad'), ('sadhana', 'good'),
        ('naidhana', 'bad'), ('mitra', 'good'), ('paramaMitra', 'good'),
    ]
    for count in range(1, 28):
        transit_nak = nak_at_count(moon, count, forward=True)
        tara = tara_bala(moon, transit_nak)
        key, quality = expected[(count - 1) % 9]
        assert tara['count'] == count
        assert tara['taraNumber'] == ((count - 1) % 9) + 1
        assert tara['key'] == key
        assert tara['quality'] == quality


def test_tara_bala_specific_values():
    # 本命月 U.Bhadrapada(26)；Krittika(3) 距 = (3-26)%27+1 = 5 → Pratyak(阻,凶)
    assert nak_count_from(26, 3) == 5
    t = tara_bala(26, 3)
    assert t['key'] == 'pratyak' and t['quality'] == 'bad'
    # 同命月；Mrigashira(5) 距 = 7 → Naidhana(死,凶)
    assert nak_count_from(26, 5) == 7
    t2 = tara_bala(26, 5)
    assert t2['key'] == 'naidhana' and t2['quality'] == 'bad'


def test_tara_bala_quality_partition():
    # 九态吉/凶/混划分稳定
    goods = {2, 4, 6, 8, 9}
    bads = {3, 5, 7}
    for n, info in TARA_NAMES.items():
        if n == 1:
            assert info['quality'] == 'mixed'
        elif n in goods:
            assert info['quality'] == 'good'
        elif n in bads:
            assert info['quality'] == 'bad'


def test_tara_bala_degrades():
    assert tara_bala(None, 5) is None
    assert tara_bala(5, None) is None
    assert tara_bala(5, 99) is None


# ── 特殊宿（从本命月宿固定偏移）：Karma=第10宿 等 ───────────────────────────
def test_special_nakshatras_offsets():
    moon = 1  # Ashwini
    sn = special_nakshatras(moon)
    # Karma = 第 10 宿(从 janma) = Magha(10)
    assert sn['karma']['count'] == 10
    assert sn['karma']['nakIndex'] == 10
    # Naidhana = 第 7 宿 = Punarvasu(7)
    assert sn['naidhana']['count'] == 7
    assert sn['naidhana']['nakIndex'] == 7
    # Jaati = 第 4 宿 = Rohini(4)
    assert sn['jaati']['count'] == 4 and sn['jaati']['nakIndex'] == 4
    # 各项 count 与书一致
    assert sn['janma']['count'] == 1
    assert sn['saamudaayika']['count'] == 18
    assert sn['sanghatika']['count'] == 16
    assert sn['desa']['count'] == 12
    assert sn['abhisheka']['count'] == 13
    assert sn['abhisheka'].get('alias') == 'Rajya'
    assert sn['aadhana']['count'] == 19
    assert sn['vainasika']['count'] == 22
    assert sn['manasa']['count'] == 25


def test_special_nakshatras_bill_gates_example():
    # 书例：本命月 U.Bhadrapada(26)
    #   Jaati = 第4宿 = Bharani(2)；Karma = 第10宿 = Pushya(8)
    sn = special_nakshatras(26)
    assert sn['jaati']['nakIndex'] == 2     # Bharani
    assert sn['karma']['nakIndex'] == 8     # Pushya(柳/Pushyami)


def test_special_nakshatras_degrades():
    assert special_nakshatras(None) is None
    assert special_nakshatras(0) is None


# ── 宿相位（从过境曜所在宿正向所照）────────────────────────────────────────
def test_nakshatra_aspects_counts():
    # 各曜所照宿数 = 书 26.5 给的 count 数
    assert nakshatra_aspects_from(SUN, 1) == [nak_at_count(1, 14), nak_at_count(1, 15)]
    assert nakshatra_aspects_from(MARS, 1) == [
        nak_at_count(1, c) for c in (1, 3, 7, 8, 15)
    ]
    assert nakshatra_aspects_from(JUPITER, 1) == [nak_at_count(1, c) for c in (10, 15, 19)]
    assert nakshatra_aspects_from(SATURN, 1) == [nak_at_count(1, c) for c in (3, 5, 15, 19)]
    assert nakshatra_aspects_from(MERCURY, 1) == [nak_at_count(1, 1), nak_at_count(1, 15)]
    assert nakshatra_aspects_from(VENUS, 1) == [nak_at_count(1, 1), nak_at_count(1, 15)]
    # 罗计无宿相位定义
    assert nakshatra_aspects_from(RAHU, 1) == []
    assert nakshatra_aspects_from(KETU, 1) == []


def test_nakshatra_aspects_self_first():
    # 火/水/金 各含「第1宿=本宿」自照
    assert nakshatra_aspects_from(MARS, 5)[0] == 5
    assert nakshatra_aspects_from(MERCURY, 9)[0] == 9


# ── Latta（宿踢）：日12前 / 各曜 + 书例 Table70 逐曜 ─────────────────────────
def test_latta_nakshatra_authoritative_cases():
    # 权威逐曜算例
    assert latta_nakshatra(SUN, 5) == 16        # Sun Mrigashira(5)→Vishakha(16)
    assert latta_nakshatra(MARS, 5) == 7        # Mars Mrigashira(5)→Punarvasu(7)
    assert latta_nakshatra(JUPITER, 3) == 8     # Jupiter Krittika(3)→Pushya(8)
    assert latta_nakshatra(SATURN, 3) == 10     # Saturn Krittika(3)→Magha(10)
    assert latta_nakshatra(MOON, 17) == 23      # Moon Anuradha(17)→Dhanishta(23)
    assert latta_nakshatra(MERCURY, 7) == 1     # Mercury Punarvasu(7)→Ashwini(1)
    assert latta_nakshatra(VENUS, 5) == 1       # Venus Mrigashira(5)→Ashwini(1)
    assert latta_nakshatra(RAHU, 7) == 26       # Rahu Punarvasu(7)→U.Bhadrapada(26)
    assert latta_nakshatra(KETU, 7) == 26       # Ketu 同罗睺(第9宿逆踢)


def test_latta_authoritative_kick_targets():
    # 权威 Latta 对照：(过境宿) → (被踢到宿)
    assert latta_nakshatra(SUN, 18) == 2        # Jyeshtha(18) → Bharani(2)
    assert latta_nakshatra(MOON, 13) == 19      # Hasta(13) → Mula(19)
    assert latta_nakshatra(MARS, 11) == 13      # P.Phalguni(11) → Hasta(13)
    assert latta_nakshatra(MERCURY, 19) == 13   # Mula(19) → Hasta(13)
    assert latta_nakshatra(JUPITER, 20) == 25   # P.Ashadha(20) → P.Bhadrapada(25)
    assert latta_nakshatra(VENUS, 16) == 12     # Vishakha(16) → U.Phalguni(12)
    assert latta_nakshatra(SATURN, 26) == 6     # U.Bhadrapada(26) → Ardra(6)
    assert latta_nakshatra(RAHU, 13) == 5       # Hasta(13) → Mrigashira(5)
    # 计都书未给 latta
    assert latta_nakshatra(KETU, 5) == latta_nakshatra(RAHU, 5)  # Ketu 同罗睺(第9宿逆踢)


def test_latta_afflicts_sun_forward12():
    # 日 latta 第12前；Sun in Mrigashira(5)→踢 Vishakha(16)。
    # 本命月宿 = Vishakha(16) → 冲月宿。
    res = latta_afflicts(SUN, 5, 16)
    assert res['lattaNak'] == 16
    assert res['count'] == 12 and res['direction'] == 'forward'
    assert res['hitsMoon'] is True
    assert res['afflicts'] is True
    # 本命月宿换成别的(非16)→不冲月；lagna 宿=16→冲 lagna
    res2 = latta_afflicts(SUN, 5, 1, natal_lagna_nak_index=16)
    assert res2['hitsMoon'] is False
    assert res2['hitsLagna'] is True
    assert res2['afflicts'] is True


def test_latta_afflicts_example113_jupiter_hits_janma():
    # 权威算例：janma=P.Bhadrapada(25)、lagna=Hasta(13)。
    # Jupiter in P.Ashadha(20) → 踢 P.Bhadrapada(25) = janma 宿 → 冲月宿。
    res = latta_afflicts(JUPITER, 20, 25, natal_lagna_nak_index=13)
    assert res['lattaNak'] == 25
    assert res['hitsMoon'] is True
    assert res['hitsLagna'] is False
    # 同例：Mars(8 宫主) in P.Phalguni(11) → 踢 Hasta(13) = lagna 宿。
    res_m = latta_afflicts(MARS, 11, 25, natal_lagna_nak_index=13)
    assert res_m['lattaNak'] == 13
    assert res_m['hitsLagna'] is True
    assert res_m['hitsMoon'] is False


def test_latta_afflicts_degrades():
    assert latta_afflicts(KETU, 5, 10) is not None   # 计都(第9宿逆踢,与罗睺并列)
    assert latta_afflicts(SUN, None, 10) is None     # 宿未知
    # lagna 宿缺 → hitsLagna None，仍可判月
    res = latta_afflicts(SUN, 5, 16)
    assert res['hitsLagna'] is None


# ── Murthi（宫位→形）────────────────────────────────────────────────────────
def test_murthi_by_house():
    assert murthi_for_house(1)['key'] == 'swarna'
    assert murthi_for_house(6)['key'] == 'swarna'
    assert murthi_for_house(11)['key'] == 'swarna'
    assert murthi_for_house(2)['key'] == 'rajata'
    assert murthi_for_house(7)['key'] == 'taamra'   # 书例 Mercury Aq from Pi=12→loha
    assert murthi_for_house(12)['key'] == 'loha'
    # 书例：本命月 Aquarius、过境月 Aquarius(1 宫)→Swarna；Pisces→Aq 是 12 宫→Loha
    assert murthi_for_house(1)['quality'] == 'highly_favorable'
    assert murthi_for_house(12)['quality'] == 'highly_unfavorable'
    assert murthi_for_house(None) is None
    assert murthi_for_house(13) is None


# ── Vedha 表订正（Table63 逐格）─────────────────────────────────────────────
def test_vedha_table63_corrected_values():
    # Mercury 10 宫吉位 vedha = 8(原码误为 7)
    assert VEDHA_PAIRS[MERCURY][10] == 8
    assert vedha_house_for(MERCURY, 10) == 8
    # 🔴 金星 11→3、12→6:权威表两份文档互证之值。
    #    此处曾被一次「Table63 勘误」反向改成 11→6/12→3 —— 该表在全部提供文档中不存在,
    #    权威表(§8.3,双文档互证)作 11→3、12→6,按其为准;再要改此两值须先出示原典表页。
    assert VEDHA_PAIRS[VENUS][11] == 3
    assert VEDHA_PAIRS[VENUS][12] == 6
    # 其余抽样核 Table63
    assert VEDHA_PAIRS[SUN] == {3: 9, 6: 12, 10: 4, 11: 5}
    assert VEDHA_PAIRS[MOON] == {1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8}
    assert VEDHA_PAIRS[JUPITER] == {2: 12, 5: 4, 7: 3, 9: 10, 11: 8}
    assert VEDHA_PAIRS[SATURN] == {3: 12, 6: 9, 11: 5}


# ── 宿基逐曜聚合 ───────────────────────────────────────────────────────────
def test_transit_nakshatra_rows_shape():
    moon = 16  # Vishakha
    transit = {SUN: 5, JUPITER: 20, KETU: 9}  # KETU 有 latta(第9宿)、无宿相位
    rows = transit_nakshatra_rows(moon, transit, natal_lagna_nak_index=13)
    assert len(rows) == 3
    by_planet = {r['planet']: r for r in rows}
    # Sun: tara + latta(冲月,Mrigashira→Vishakha=16)
    assert by_planet[SUN]['tara'] is not None
    assert by_planet[SUN]['latta']['hitsMoon'] is True
    assert by_planet[SUN]['aspects'] == [nak_at_count(5, 14), nak_at_count(5, 15)]
    # Ketu: 有 latta(第9宿逆踢)、无宿相位，有 tara
    assert by_planet[KETU]['latta'] is not None
    assert by_planet[KETU]['aspects'] == []
    assert by_planet[KETU]['tara'] is not None


# ── compute_gochara 新宿基字段 ─────────────────────────────────────────────
def test_compute_gochara_emits_tara_and_special():
    moon = 'Aries'
    res = compute_gochara(
        moon, 'Leo', {SUN: 'Gemini', SATURN: 'Aries'},
        natal_moon_nak_index=1,           # Ashwini
        natal_lagna_nak_index=10,         # Magha
        transit_naks={SUN: 5, SATURN: 7},
    )
    assert res['available'] is True
    assert res['reference']['moonNak'] == 1
    assert res['reference']['lagnaNak'] == 10
    # 特殊宿：Karma=第10宿(Magha=10)
    assert res['specialNakshatras']['karma']['nakIndex'] == 10
    # taraBala 逐曜
    assert len(res['taraBala']) == 2
    sun_row = next(r for r in res['taraBala'] if r['planet'] == SUN)
    assert sun_row['tara']['count'] == nak_count_from(1, 5)


def test_compute_gochara_without_naks_omits_block():
    # 不传宿序 → taraBala 空、specialNakshatras None，不破坏旧字段。
    res = compute_gochara('Aries', 'Leo', {SATURN: 'Gemini'})
    assert res['available'] is True
    assert res['taraBala'] == []
    assert res['specialNakshatras'] is None
    # 旧字段仍在
    assert 'fromMoon' in res and 'saturnAfflictions' in res


def test_compute_gochara_special_only_when_moon_nak_present():
    # 有月宿但无 transit_naks → specialNakshatras 出、taraBala 空。
    res = compute_gochara(
        'Cancer', None, {SATURN: 'Gemini'},
        natal_moon_nak_index=4,           # Rohini
    )
    assert res['specialNakshatras'] is not None
    assert res['specialNakshatras']['janma']['nakIndex'] == 4
    assert res['taraBala'] == []


# ── G0 勘误锁值:七曜 Vedha 表逐项对权威表(§8.3 全文转录),防再漂移 ──
def test_vedha_pairs_locked_to_reference():
    """七曜 Vedha「吉位→阻碍宫」逐项锁死。
    🔴 金星 11/12 两对曾录入颠倒(11→6,12→3)而结构测试抓不到 —— 值表必须锁值,不能只测形状。"""
    expected = {
        SUN: {3: 9, 6: 12, 10: 4, 11: 5},
        MOON: {1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8},
        MARS: {3: 12, 6: 9, 11: 5},
        MERCURY: {2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12},
        JUPITER: {2: 12, 5: 4, 7: 3, 9: 10, 11: 8},
        VENUS: {1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 3, 12: 6},
        SATURN: {3: 12, 6: 9, 11: 5},
    }
    assert VEDHA_PAIRS == expected
    # 结构不变量:每曜的 Vedha 键集 ⊆ 其吉位集(Vedha 只遮吉位)
    for planet, pairs in expected.items():
        assert set(pairs.keys()) <= set(good_houses_for(planet)), planet
    # 代理:罗睺查土星表、计都查火星表
    assert vedha_house_for(RAHU, 3) == 12 and vedha_house_for(KETU, 6) == 9


# ── vedhaBlockers 流派开关(罗计是否作遮蔽者;默认 all=零回归) ──────────────────
def test_vedha_blockers_exclude_nodes_flips_effective():
    from astrostudy.india.gochara import (
        transit_from_reference, apply_vedha, vedha_house_for, RAHU, MOON,
        GOCHARA_PLANETS,
    )
    from astrostudy.india import gochara as G
    # 构造:某曜落吉位,其 vedha 宫恰被 Rahu 占据(且非豁免对)→ 默认被遮;exclude_nodes 后有效。
    ref = 'Aries'
    # 找一个(曜,吉宫,vedha宫)组合:取月亮的第一个吉位
    good = G.good_houses_for(MOON)
    gh = sorted(good)[0]
    vh = vedha_house_for(MOON, gh)
    assert vh is not None
    # 摆位:月亮在 ref 起第 gh 宫;Rahu 在 ref 起第 vh 宫;其余曜丢远处(第 12 宫外? 用一个非吉非 vedha 宫)
    def sign_of_house(h):
        order = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
        i = order.index(ref)
        return order[(i + h - 1) % 12]
    neutral = None
    for h in range(1, 13):
        if h != gh and h != vh and vedha_house_for(MOON, h) is None:
            neutral = sign_of_house(h)
            break
    transit = {p: neutral for p in GOCHARA_PLANETS}
    transit[MOON] = sign_of_house(gh)
    transit[RAHU] = sign_of_house(vh)

    rows_default = transit_from_reference(ref, transit, 'fromX')
    apply_vedha(rows_default, ref, transit)
    row_d = next(r for r in rows_default if r['planet'] == MOON)
    assert row_d['good'] is True
    assert row_d['vedhaBy'] == RAHU          # 默认:罗睺实施遮蔽
    assert row_d['effective'] is False

    rows_ex = transit_from_reference(ref, transit, 'fromX')
    apply_vedha(rows_ex, ref, transit, blocker_filter=lambda p: p not in (G.RAHU, G.KETU))
    row_e = next(r for r in rows_ex if r['planet'] == MOON)
    assert row_e['vedhaBy'] is None          # 罗计除名后无人遮蔽
    assert row_e['effective'] is True


def test_vedha_blockers_variant_registered_and_default_all():
    from astrostudy.india.dasha_variants import VARIANT_SPECS, resolve_variants
    spec = VARIANT_SPECS['vedhaBlockers']
    assert spec['default'] == 'all'
    assert set(spec['values']) == {'all', 'exclude_nodes'}
    assert resolve_variants(None)['vedhaBlockers'] == 'all'                       # 缺省零回归
    assert resolve_variants({'vedhaBlockers': 'exclude_nodes'})['vedhaBlockers'] == 'exclude_nodes'
    assert resolve_variants({'vedhaBlockers': '乱值'})['vedhaBlockers'] == 'all'  # 白名单挡乱值


def test_compute_gochara_vedha_blockers_threading():
    """compute_gochara(vedha_blockers=...) 真透传:同盘两档 fromMoon 的 effective 集合不同。"""
    from astrostudy.india.gochara import compute_gochara, MOON, RAHU, GOCHARA_PLANETS, good_houses_for, vedha_house_for
    from astrostudy.india import gochara as G
    order = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
    ref = 'Aries'
    gh = sorted(good_houses_for(MOON))[0]
    vh = vedha_house_for(MOON, gh)
    def sign_of_house(h):
        return order[(order.index(ref) + h - 1) % 12]
    neutral = next(sign_of_house(h) for h in range(1, 13)
                   if h != gh and h != vh and vedha_house_for(MOON, h) is None)
    transit = {p: neutral for p in GOCHARA_PLANETS}
    transit[MOON] = sign_of_house(gh)
    transit[RAHU] = sign_of_house(vh)
    a = compute_gochara(ref, None, transit)
    b = compute_gochara(ref, None, transit, vedha_blockers='exclude_nodes')
    ra = next(r for r in a['fromMoon'] if r['planet'] == MOON)
    rb = next(r for r in b['fromMoon'] if r['planet'] == MOON)
    assert ra['effective'] is False and rb['effective'] is True
