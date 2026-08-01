# Jyotish 共享原语 回归测试（以书 Table/Example 为准，不钉实现）：
#   P-a 友谊 Table7/8 · P-b Rasi Drishti(Ch10.3，Li→Aq/Ta/Le) · P-c 8 卡拉卡(Ch8，罗逆量；Ex.28)
#   P-d Vargottama(D1=D9) · P-e Amsa-bala(Ch6.6 Table7；Ex.27 Gopura/Kalpavriksha) · P-f Rudra/Trishoola(Ch14 Table32)。
import os
import sys

# ⚠️ 只插仓根;绝不插 tests/../..(=Horosa-Web):会令本仓 astropy 目录遮蔽 PyPI astropy。
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flatlib import const  # noqa: E402

from astrostudy.india import primitives as P  # noqa: E402


# ── T0 基础 ──
def test_quality_and_footed():
    assert P.quality(const.ARIES) == 'movable'
    assert P.quality(const.TAURUS) == 'fixed'
    assert P.quality(const.GEMINI) == 'dual'
    assert const.ARIES in P.ODD_FOOTED and const.CANCER in P.EVEN_FOOTED


def test_house_distance():
    assert P.house_distance(const.ARIES, const.ARIES) == 1
    assert P.house_distance(const.ARIES, const.TAURUS) == 2
    assert P.house_distance(const.ARIES, const.PISCES) == 12
    assert P.house_distance(const.PISCES, const.ARIES) == 2


# ── P-a 友谊 ──
def test_natural_relation_table7():
    # 日 友 月火木 / 中 水 / 敌 金土
    assert P.natural_relation(const.SUN, const.MOON) == 'friend'
    assert P.natural_relation(const.SUN, const.JUPITER) == 'friend'
    assert P.natural_relation(const.SUN, const.MERCURY) == 'neutral'
    assert P.natural_relation(const.SUN, const.VENUS) == 'enemy'
    assert P.natural_relation(const.SUN, const.SATURN) == 'enemy'
    # 土 友 水金 / 中 木 / 敌 日月火
    assert P.natural_relation(const.SATURN, const.MERCURY) == 'friend'
    assert P.natural_relation(const.SATURN, const.JUPITER) == 'neutral'
    assert P.natural_relation(const.SATURN, const.MARS) == 'enemy'
    # 月 无自然敌
    for p in (const.SUN, const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN):
        assert P.natural_relation(const.MOON, p) != 'enemy'


def test_tatkalika_and_compound():
    # 日 Ar / 月 Ta(日的第2宫=临时友) / 金 Le(第5宫=临时敌)
    signs = {const.SUN: const.ARIES, const.MOON: const.TAURUS, const.VENUS: const.LEO}
    assert P.tatkalika_relation(const.SUN, const.MOON, signs) == 'friend'
    assert P.tatkalika_relation(const.SUN, const.VENUS, signs) == 'enemy'
    # 日↔月：自然友×临时友 = adhimitra(友)
    assert P.compound_relation(const.SUN, const.MOON, signs) == 'adhimitra'
    assert P.compound_friendly(const.SUN, const.MOON, signs) is True
    # 日↔金：自然敌×临时敌 = adhisatru
    assert P.compound_relation(const.SUN, const.VENUS, signs) == 'adhisatru'
    assert P.compound_friendly(const.SUN, const.VENUS, signs) is False


# ── P-b Rasi Drishti ──
def test_rasi_drishti_examples():
    # Li(动) 照 Aq/Ta/Le(定，除相邻 Sc)
    assert set(P.rasi_drishti(const.LIBRA)) == {const.AQUARIUS, const.TAURUS, const.LEO}
    # Ta(定) 照 Cn/Li/Cp(动，除相邻 Ar)
    assert set(P.rasi_drishti(const.TAURUS)) == {const.CANCER, const.LIBRA, const.CAPRICORN}
    # Ge(双) 照其余三双
    assert set(P.rasi_drishti(const.GEMINI)) == {const.VIRGO, const.SAGITTARIUS, const.PISCES}


def test_rasi_drishti_mutual_and_count():
    # 互照
    assert P.rasi_aspects(const.LIBRA, const.TAURUS) and P.rasi_aspects(const.TAURUS, const.LIBRA)
    # 每个 rasi 恰照 3 个 + 不照自身/相邻同类
    for s in P.SIGNS:
        d = P.rasi_drishti(s)
        assert len(d) == 3 and s not in d


# ── P-c 8 卡拉卡 ──
def test_chara_karakas_rahu_reverse_and_count():
    # 罗睺 1°43'Cn(=91.7167°) 逆量 = 30−1.7167 = 28.283° ≈ 28°17'
    lons = {
        const.SUN: 5.0, const.MOON: 95.0, const.MARS: 35.0, const.MERCURY: 65.0,
        const.JUPITER: 125.0, const.VENUS: 155.0, const.SATURN: 185.0,
        const.NORTH_NODE: 91.7167,
    }
    ks = P.chara_karakas(lons)
    assert len(ks) == 8
    # 罗睺逆量最高 → AK
    ak = ks[0]
    assert ak['planet'] == const.NORTH_NODE
    assert ak['label'] == 'AK'
    assert abs(ak['degree'] - 28.283) < 0.01
    # 降序
    degs = [k['degree'] for k in ks]
    assert degs == sorted(degs, reverse=True)
    # 标签齐全
    assert [k['label'] for k in ks] == ['AK', 'AmK', 'BK', 'MK', 'PiK', 'PK', 'GK', 'DK']
    # 标签↔全名一致(PiK=Pitrikaraka 父/第5、PK=Putrakaraka 子/第6;原 PiK↔Putra 错位已修)
    fullmap = dict(zip(P.KARAKA_LABELS_8, P.KARAKA_FULL_8))
    assert fullmap['PiK'] == 'Pitrikaraka'
    assert fullmap['PK'] == 'Putrakaraka'


# ── P-d Vargottama ──
def test_sign_of_lon():
    assert P.sign_of_lon(0.0) == const.ARIES
    assert P.sign_of_lon(35.0) == const.TAURUS
    assert P.sign_of_lon(359.9) == const.PISCES


def test_vargottama_d9():
    # 动象 Ar 第一 navamsa 即 Ar → 0°Ar D1=D9=Ar → vargottama。
    assert P.varga_sign(0.0, 1) == const.ARIES
    assert P.varga_sign(0.0, 9) == const.ARIES
    assert P.is_vargottama(0.0, 9) is True
    # 5°Ar 落第二 navamsa(Ta) → 非 vargottama。
    assert P.varga_sign(5.0, 9) == const.TAURUS
    assert P.is_vargottama(5.0, 9) is False


# ── P-e Varga 组 + Amsa-bala ──
def test_varga_group_membership():
    assert P.VARGA_GROUPS['shadvarga'] == [1, 2, 3, 9, 12, 30]
    assert P.VARGA_GROUPS['saptavarga'] == [1, 2, 3, 7, 9, 12, 30]
    assert len(P.VARGA_GROUPS['dasavarga']) == 10
    assert len(P.VARGA_GROUPS['shodasavarga']) == 16


def test_amsa_name_and_ex27():
    # Ex.27(Cosby 木星)：Dasavarga 命中4=Gopura / Shodasavarga 命中7=Kalpavriksha。
    assert P.amsa_name('dasavarga', 4) == 'Gopura'
    assert P.amsa_name('shodasavarga', 7) == 'Kalpavriksha'
    assert P.amsa_name('shadvarga', 6) == 'Kundala'
    assert P.amsa_name('saptavarga', 7) == 'Mukuta'
    assert P.amsa_name('shodasavarga', 16) == 'SreeVallabha'
    assert P.amsa_name('shadvarga', 1) is None  # <2 无名


def test_amsa_bala_counts_only_group_members():
    # {1,9,12} 全在 shadvarga → 3 = Vyanjana
    assert P.amsa_bala({1, 9, 12}, 'shadvarga') == \
        {'group': 'shadvarga', 'count': 3, 'amsa': 'Vyanjana'}
    # 5/8 不在 shadvarga → 仅 1,9 命中 → 2 = Kimsuka
    assert P.amsa_bala({1, 9, 5, 8}, 'shadvarga')['count'] == 2
    # varga_signs 键 = 组成员
    assert set(P.varga_signs(0.0, 'shadvarga').keys()) == {1, 2, 3, 9, 12, 30}
    assert P.varga_signs(0.0, 'shadvarga')[1] == const.ARIES


# ── P-f Rudra / Trishoola ──
def test_rudra_table32():
    assert P.rudra_8th(const.ARIES) == const.SCORPIO
    assert P.rudra_8th(const.TAURUS) == const.GEMINI
    assert P.rudra_8th(const.LEO) == const.CANCER
    assert P.rudra_8th(const.PISCES) == const.LEO
    # 两候选 = lagna 的 Table32 与 7 宫的 Table32
    # lagna=Ar → (Table32[Ar]=Sc, Table32[Li=7宫]=Ta)
    assert P.rudra_candidate_signs(const.ARIES) == (const.SCORPIO, const.TAURUS)


def test_trishoola_trines():
    # Sc 的三角(水三方) = Sc/Pi/Cn
    assert P.trishoola(const.SCORPIO) == [const.SCORPIO, const.PISCES, const.CANCER]
    # Ar 的三角(火三方) = Ar/Le/Sg
    assert P.trishoola(const.ARIES) == [const.ARIES, const.LEO, const.SAGITTARIUS]


# ── P-g Abhijit（28 宿口径）──
def test_abhijit_arc():
    # 弧 = 276°40′–280°53′20″，跨度 4°13′20″ ≈ 4.2222°
    assert abs(P.ABHIJIT_START - 276.66667) < 1e-4
    assert abs(P.ABHIJIT_END - 280.88889) < 1e-4
    assert abs((P.ABHIJIT_END - P.ABHIJIT_START) - (4 + 13 / 60 + 20 / 3600)) < 1e-6
    # 区间内/外
    assert P.is_abhijit(278.0) is True              # Abhijit 中段
    assert P.is_abhijit(280.0) is True              # 27 宿此处=Shravana，但属 Abhijit
    assert P.is_abhijit(276.0) is False             # 仍 Uttara Ashadha
    assert P.is_abhijit(281.0) is False             # 已进 Shravana
    assert P.is_abhijit(276.66667) is True          # 含起点
    assert P.is_abhijit(280.88889) is False         # 不含止点


def test_nakshatra_number_28():
    # 278°：27 宿=Uttara Ashadha(21)，28 宿口径=Abhijit(22)
    assert P.nakshatra_number_28(278.0, 21) == 22
    # 285°：27 宿=Shravana(22)，非 Abhijit → 28 宿=23
    assert P.nakshatra_number_28(285.0, 22) == 23
    # UA 之前不变(如 5 宿 → 5)
    assert P.nakshatra_number_28(60.0, 5) == 5
    # 28 宿总和守恒：UA(10°)+Abhijit(4°13′20″)+Shravana(12°26′40″) = 原 UA+Shravana(26°40′)
    ua = 276.66667 - 266.66667
    abh = P.ABHIJIT_END - P.ABHIJIT_START
    shr = 293.33333 - P.ABHIJIT_END
    assert abs((ua + abh + shr) - (2 * 360.0 / 27.0)) < 1e-3


def test_abhijit_in_engine_nakshatra():
    # 引擎 nakshatra_from_lon 附加 28 宿口径，但 27 宿主字段不变。
    from astrostudy.nakshatra import nakshatra_from_lon
    nk = nakshatra_from_lon(278.0)
    assert nk['name'] == 'Uttara Ashadha'           # 27 宿主字段不变
    assert nk['isAbhijit'] is True
    assert nk['nak28Name'] == 'Abhijit' and nk['nak28Index'] == 22
    nk2 = nakshatra_from_lon(100.0)                  # 非 Abhijit
    assert nk2['isAbhijit'] is False and nk2['nak28Name'] == nk2['name']


# ── 星曜状态：燃烧 + Baladi avastha ──
def test_combust():
    # 水星距日 5° < 14° → 燃烧；20° → 否
    assert P.is_combust(const.MERCURY, 100.0, 105.0, False) is True
    assert P.is_combust(const.MERCURY, 100.0, 120.0, False) is False
    # 逆行收紧 orb：13° 非逆<14 燃烧，逆行>12 不燃烧
    assert P.is_combust(const.MERCURY, 100.0, 113.0, False) is True
    assert P.is_combust(const.MERCURY, 100.0, 113.0, True) is False
    # 火星 orb 17°；日/节点不判
    assert P.is_combust(const.MARS, 100.0, 110.0, False) is True
    assert P.is_combust(const.SUN, 100.0, 100.0, False) is False
    assert P.is_combust(const.NORTH_NODE, 100.0, 100.0, False) is False
    # 跨 0° 角距：5° 与 359° 相差 6° < 12 → 月燃烧
    assert P.is_combust(const.MOON, 5.0, 359.0, False) is True


def test_baladi_avastha():
    # 奇宫顺：Ar 3°=Bala / 27°=Mrita
    assert P.baladi_avastha(const.ARIES, 3.0)['key'] == 'Bala'
    assert P.baladi_avastha(const.ARIES, 27.0)['key'] == 'Mrita'
    # 偶宫逆：Ta 3°=Mrita / 27°=Bala
    assert P.baladi_avastha(const.TAURUS, 3.0)['key'] == 'Mrita'
    assert P.baladi_avastha(const.TAURUS, 27.0)['key'] == 'Bala'
    # 中段
    assert P.baladi_avastha(const.ARIES, 15.0)['key'] == 'Yuva'
    assert P.baladi_avastha(const.ARIES, 15.0)['index'] == 3


# ── W1-B:Chara Karaka 7/8 方案 ────────────────────────────────────────────

def test_chara_karakas_default_scheme_unchanged():
    # 默认(不传/传'8')与既有 8 卡拉卡逐字节全等(零回归锚)。
    from astrostudy.india.primitives import chara_karakas
    lons = {'Sun': 10.5, 'Moon': 100.2, 'Mars': 250.9, 'Mercury': 33.3,
            'Jupiter': 199.8, 'Venus': 88.1, 'Saturn': 310.6, 'North Node': 155.4}
    assert chara_karakas(lons) == chara_karakas(lons, scheme='8')
    out = chara_karakas(lons)
    assert len(out) == 8
    assert [r['label'] for r in out] == ['AK', 'AmK', 'BK', 'MK', 'PiK', 'PK', 'GK', 'DK']


def test_chara_karakas_seven_scheme():
    # '7':长度 7、无罗睺、名序 AK..DK 无 PiK;AK 仍为(非罗睺)最高用度星。
    from astrostudy.india.primitives import chara_karakas
    lons = {'Sun': 10.5, 'Moon': 100.2, 'Mars': 250.9, 'Mercury': 33.3,
            'Jupiter': 199.8, 'Venus': 88.1, 'Saturn': 310.6, 'North Node': 155.4}
    out = chara_karakas(lons, scheme='7')
    assert len(out) == 7
    assert all(r['planet'] != 'North Node' for r in out)
    assert [r['label'] for r in out] == ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK']
    assert 'Pitrikaraka' not in [r['full'] for r in out]
    deg = {r['planet']: r['degree'] for r in out}
    assert out[0]['degree'] == max(deg.values())


def test_chara_karakas_seven_reranks_below_ak():
    # 罗睺剔除后,若罗睺原居中位,其后各星整体前移一名(BK/MK/PK 归属漂移的最小实证)。
    from astrostudy.india.primitives import chara_karakas
    lons = {'Sun': 20.0, 'Moon': 15.0, 'Mars': 12.0, 'Mercury': 10.0,
            'Jupiter': 8.0, 'Venus': 6.0, 'Saturn': 4.0, 'North Node': 344.0}  # 罗睺逆量=30-14=16 → 第2位
    e8 = chara_karakas(lons, scheme='8')
    e7 = chara_karakas(lons, scheme='7')
    assert e8[1]['planet'] == 'North Node' and e8[1]['label'] == 'AmK'
    assert e7[1]['planet'] == 'Moon' and e7[1]['label'] == 'AmK'   # 月亮从 BK 升 AmK
