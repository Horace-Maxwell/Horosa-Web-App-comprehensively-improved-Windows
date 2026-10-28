# 行星状态 Avasthas + Sthira/Naisargika 卡拉卡 golden（以附录 T12/T4 为准，不钉实现）：
#   Jagradadi 3 态 · Deeptadi 9 态映射 · Naisargika 全 12 宫 · Sthira 父=日/金强者。
import os
import sys

# ⚠️ 只插仓根;绝不插 tests/../..(=Horosa-Web):会令本仓 astropy 目录遮蔽 PyPI astropy。
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flatlib import const  # noqa: E402

from astrostudy.india import avastha as A  # noqa: E402


# ── Jagradadi（3 态）— T12：旺/own=Jagrita · 中/友=Swapna · 落/敌=Sushupta ──
def test_jagradadi_three_tiers():
    # 旺/own → Jagrita(全力)
    assert A.jagradadi_avastha('exaltation')['key'] == 'Jagrita'
    assert A.jagradadi_avastha('deep_exaltation')['key'] == 'Jagrita'
    assert A.jagradadi_avastha('moolatrikona')['key'] == 'Jagrita'
    assert A.jagradadi_avastha('own_sign')['key'] == 'Jagrita'
    assert A.jagradadi_avastha('own_sign')['power'] == 'full'
    # 中/友 → Swapna(中力)
    assert A.jagradadi_avastha('neutral', relation='neutral')['key'] == 'Swapna'
    assert A.jagradadi_avastha('neutral', relation='friend')['key'] == 'Swapna'
    assert A.jagradadi_avastha('neutral')['key'] == 'Swapna'  # relation 缺省兜底
    assert A.jagradadi_avastha('neutral')['power'] == 'mid'
    # 落/敌 → Sushupta(微力)
    assert A.jagradadi_avastha('debilitation')['key'] == 'Sushupta'
    assert A.jagradadi_avastha('neutral', relation='enemy')['key'] == 'Sushupta'
    assert A.jagradadi_avastha('debilitation')['power'] == 'weak'


def test_jagradadi_shape_matches_baladi():
    # 与 baladi_avastha 同形(key/label/index)，便于前端统一渲染。
    r = A.jagradadi_avastha('own_sign')
    assert set(['key', 'label', 'index']).issubset(r.keys())
    assert isinstance(r['index'], int)


# ── Deeptadi（9 态映射）— T12 完整判定序 ──────────────────────────────────
def test_deeptadi_nine_states():
    # 1 旺 → Deepta
    assert A.deeptadi_avastha('exaltation')['key'] == 'Deepta'
    assert A.deeptadi_avastha('deep_exaltation')['key'] == 'Deepta'
    # 2 own(含 MT) → Swastha
    assert A.deeptadi_avastha('own_sign')['key'] == 'Swastha'
    assert A.deeptadi_avastha('moolatrikona')['key'] == 'Swastha'
    # 3 良友(复合 adhimitra) → Mudita
    assert A.deeptadi_avastha('neutral', compound='adhimitra')['key'] == 'Mudita'
    # 4 友(复合 mitra / 自然 friend) → Saanta
    assert A.deeptadi_avastha('neutral', compound='mitra')['key'] == 'Saanta'
    assert A.deeptadi_avastha('neutral', relation='friend')['key'] == 'Saanta'
    # 5 近合日(燃烧) → Kopita
    assert A.deeptadi_avastha('neutral', combust=True)['key'] == 'Kopita'
    # 6 合恶曜 → Vikala
    assert A.deeptadi_avastha('neutral', conjunct_malefic=True)['key'] == 'Vikala'
    # 7 在恶曜星座 → Khala
    assert A.deeptadi_avastha('neutral', in_malefic_sign=True)['key'] == 'Khala'
    # 8 敌(复合 satru/adhisatru / 自然 enemy) → Duhkhita
    assert A.deeptadi_avastha('neutral', compound='satru')['key'] == 'Duhkhita'
    assert A.deeptadi_avastha('neutral', compound='adhisatru')['key'] == 'Duhkhita'
    assert A.deeptadi_avastha('neutral', relation='enemy')['key'] == 'Duhkhita'
    # 9 中/落(无任何情境) → Deena(兜底)
    assert A.deeptadi_avastha('neutral')['key'] == 'Deena'
    assert A.deeptadi_avastha('debilitation')['key'] == 'Deena'


def test_deeptadi_priority_dignity_over_context():
    # 旺优先于情境态：旺 + 燃烧 仍 Deepta(dignity 最高优先)。
    assert A.deeptadi_avastha('exaltation', combust=True)['key'] == 'Deepta'
    # own 优先于敌关系。
    assert A.deeptadi_avastha('own_sign', relation='enemy')['key'] == 'Swastha'
    # 全 9 态键唯一。
    keys = {A._DEEPTADI[k]['key'] for k in A._DEEPTADI}
    assert len(keys) == 9


# ── Naisargika（全 12 宫）— T4 ────────────────────────────────────────────
def test_naisargika_table15_all_houses():
    # 1日/2木/3火/4月/5木/6火/7金/8土/9木/10水/11木/12土
    expected = {
        1: const.SUN, 2: const.JUPITER, 3: const.MARS, 4: const.MOON,
        5: const.JUPITER, 6: const.MARS, 7: const.VENUS, 8: const.SATURN,
        9: const.JUPITER, 10: const.MERCURY, 11: const.JUPITER, 12: const.SATURN,
    }
    for house, planet in expected.items():
        assert A.naisargika_karaka(house) == planet, 'house %d' % house
    assert A.naisargika_karaka_table() == expected


def test_naisargika_out_of_range():
    import pytest
    with pytest.raises(ValueError):
        A.naisargika_karaka(0)
    with pytest.raises(ValueError):
        A.naisargika_karaka(13)


# ── Sthira（固定卡拉卡）— T4：父=日/金强者，母=月/火强者 ──────────────────
def test_sthira_father_stronger_of_sun_venus():
    # 强者回调返回第二参时，父取金；返回第一参时父取日。
    take_a = lambda a, b: a
    take_b = lambda a, b: b
    rows_a = {r['key']: r for r in A.sthira_karaka(stronger_of=take_a)}
    rows_b = {r['key']: r for r in A.sthira_karaka(stronger_of=take_b)}
    # 父候选 = [日, 金]
    assert rows_a['pitri']['candidates'] == [const.SUN, const.VENUS]
    assert rows_a['pitri']['planet'] == const.SUN     # take_a → 日
    assert rows_b['pitri']['planet'] == const.VENUS   # take_b → 金
    # 母候选 = [月, 火]
    assert rows_a['matri']['candidates'] == [const.MOON, const.MARS]
    assert rows_a['matri']['planet'] == const.MOON
    assert rows_b['matri']['planet'] == const.MARS


def test_sthira_fixed_roles():
    rows = {r['key']: r for r in A.sthira_karaka()}
    # 固定项(单一行星)
    assert rows['sahaja']['planet'] == const.MARS       # 火 = 弟妹
    assert rows['matrula']['planet'] == const.MERCURY   # 水 = 母系亲
    assert rows['putra']['planet'] == const.JUPITER     # 木 = 夫/子/父系
    assert rows['kalatra']['planet'] == const.VENUS     # 金 = 妻
    assert rows['jyeshtha']['planet'] == const.SATURN   # 土 = 兄姐
    # 不传 stronger_of 时父/母保留双候选、无 planet。
    assert 'planet' not in rows['pitri']
    assert rows['pitri']['candidates'] == [const.SUN, const.VENUS]


# ── Sayanadi（活动 12 态 + 活动质量）— 权威表/对照算例 ─────────────────────
def test_sayanadi_case_gamana_cheshta():
    # 对照算例：水星 C=1,P=4,A=1,M=25,G=30,L=6
    #   raw = (1×4×1)+25+30+6 = 65；65 mod12 = 5 → Gamana
    #   name_value: C=1(Ashwini 首音节 a)→1；t = 5²+1 = 26；26 mod12 = 2；
    #   s = (2 + 3[水星]) mod3 = 5 mod3 = 2 → Cheshta
    r = A.sayanadi_avastha(
        nak_index=1, planet_key=const.MERCURY, navamsa_index=1,
        moon_nak_index=25, ghati=30, lagna_sign_index=6)
    assert r is not None
    assert r['index'] == 5
    assert r['stateKey'] == 'Gamana'
    assert r['activity'] == 'cheshta'


def test_sayanadi_shape():
    r = A.sayanadi_avastha(
        nak_index=1, planet_key='Mercury', navamsa_index=1,
        moon_nak_index=25, ghati=30, lagna_sign_index=6)
    assert r['key'] == 'sayanadi'
    assert set(['key', 'label', 'index', 'stateKey', 'stateLabel',
                'activity', 'activityLabel']).issubset(r.keys())
    assert 1 <= r['index'] <= 12
    assert r['activity'] in ('cheshta', 'drishti', 'vicheshta')


def test_sayanadi_planet_key_aliases_match():
    # flatlib const id 与缩写 key 同义（同入参 → 同结果）。
    a = A.sayanadi_avastha(1, const.MERCURY, 1, 25, 30, 6)
    b = A.sayanadi_avastha(1, 'Mercury', 1, 25, 30, 6)
    assert a == b
    # 节点别名：const.NORTH_NODE == 'Rahu'，const.SOUTH_NODE == 'Ketu'。
    assert (A.sayanadi_avastha(5, const.NORTH_NODE, 2, 10, 3, 4)
            == A.sayanadi_avastha(5, 'Rahu', 2, 10, 3, 4))


def test_sayanadi_index_zero_maps_to_twelve():
    # raw mod12 == 0 时取 12（Nidraa），不取 0。
    # 选一组使 (C×P×A)+M+G+L 为 12 倍数：C=1,P=1(日),A=1,M=1,G=9,L=1 → 12。
    r = A.sayanadi_avastha(1, const.SUN, 1, 1, 9, 1)
    assert r['index'] == 12
    assert r['stateKey'] == 'Nidraa'


def test_sayanadi_missing_input_degrades_to_none():
    # 任一入参缺失(None) → None（如极地日出不定 G=None）。
    assert A.sayanadi_avastha(1, const.MERCURY, 1, 25, None, 6) is None
    assert A.sayanadi_avastha(None, const.MERCURY, 1, 25, 30, 6) is None
    # 未知行星 key → None。
    assert A.sayanadi_avastha(1, 'NotAPlanet', 1, 25, 30, 6) is None


def test_sayanadi_name_value_table_27():
    # name_value 全表 1-27（覆盖每宿首音节定值）；Ashwini→1 为锚点。
    assert A._SAYANADI_NAME_VALUE[1] == 1
    assert len(A._SAYANADI_NAME_VALUE) == 27
    assert set(A._SAYANADI_NAME_VALUE.keys()) == set(range(1, 28))
    assert all(1 <= v <= 5 for v in A._SAYANADI_NAME_VALUE.values())


def test_lajjitadi_avastha_six_states():
    # P1 Lajjitādi 6 态(可并存):各条件命中对应态。
    from astrostudy.india.avastha import lajjitadi_avastha
    from flatlib import const
    keys = lambda lst: [s['key'] for s in lst]
    assert keys(lajjitadi_avastha(3, 'exaltation', const.LEO, set(), False, False)) == ['garvita']
    assert keys(lajjitadi_avastha(3, 'moolatrikona', const.LEO, set(), False, False)) == ['garvita']
    assert keys(lajjitadi_avastha(3, 'debilitation', const.LEO, set(), False, False)) == ['kshudita']
    assert keys(lajjitadi_avastha(5, 'neutral', const.LEO, {const.SUN}, False, False)) == ['lajjita']
    assert keys(lajjitadi_avastha(3, 'neutral', const.CANCER, set(), True, False)) == ['trishita']
    assert keys(lajjitadi_avastha(3, 'own_sign', const.LEO, set(), False, False)) == ['mudita']
    assert keys(lajjitadi_avastha(3, 'neutral', const.LEO, {const.JUPITER}, False, False)) == ['mudita']
    assert keys(lajjitadi_avastha(3, 'neutral', const.LEO, set(), True, True)) == ['kshobhita']
    # 水座但无凶照 → 不渴;5 宫但无凶曜同宫 → 不羞;并存:旺+吉伴。
    assert lajjitadi_avastha(3, 'neutral', const.CANCER, set(), False, False) == []
    assert lajjitadi_avastha(5, 'neutral', const.LEO, {const.MOON}, False, False) == []
    assert keys(lajjitadi_avastha(3, 'exaltation', const.LEO, {const.VENUS}, False, False)) == ['garvita', 'mudita']


def test_lajjitadi_in_engine_strengths():
    from astrostudy.india.india_chart_kernel import IndiaChartKernel
    from astrostudy.india.jyotish_engine import JyotishEngine
    data = {'date': '1990/3/15', 'time': '07:30:00', 'zone': '+05:30',
            'lat': '28n36', 'lon': '77e12', 'indiaHsys': 0, 'indiaAyanamsa': 'lahiri'}
    ps = JyotishEngine(IndiaChartKernel(data)).strengths()['planetaryStates']
    assert all('lajjitadi' in p and isinstance(p['lajjitadi'], list) for p in ps)


# ── Dīptādi Khala 归属:两种通行口径(流派开关 deeptadiKhala)──────────────────
def test_deeptadi_khala_rule_two_readings():
    from astrostudy.india import avastha as A
    # 缺省(现状):落恶曜之座 → Khala;落陷 / 中性 → Deena
    assert A.deeptadi_avastha('debilitation')['key'] == 'Deena'
    assert A.deeptadi_avastha('neutral', in_malefic_sign=True)['key'] == 'Khala'
    assert A.deeptadi_avastha('neutral')['key'] == 'Deena'
    # BPHS 通行:落陷 → Khala;中性座 → Deena;落恶曜之座不另成态
    R = 'debilitation'
    assert A.deeptadi_avastha('debilitation', khala_rule=R)['key'] == 'Khala'
    assert A.deeptadi_avastha('debilitation', compound='adhimitra', khala_rule=R)['key'] == 'Khala'
    assert A.deeptadi_avastha('neutral', in_malefic_sign=True, khala_rule=R)['key'] == 'Deena'
    assert A.deeptadi_avastha('neutral', in_malefic_sign=True, compound='satru', khala_rule=R)['key'] == 'Duhkhita'
    assert A.deeptadi_avastha('neutral', khala_rule=R)['key'] == 'Deena'
    # 两口径共有的各态不变
    for kw in ({}, {'khala_rule': R}):
        assert A.deeptadi_avastha('exaltation', **kw)['key'] == 'Deepta'
        assert A.deeptadi_avastha('own_sign', **kw)['key'] == 'Swastha'
        assert A.deeptadi_avastha('neutral', compound='mitra', **kw)['key'] == 'Saanta'
        assert A.deeptadi_avastha('neutral', combust=True, **kw)['key'] == 'Kopita'
        assert A.deeptadi_avastha('neutral', conjunct_malefic=True, **kw)['key'] == 'Vikala'
    assert A.DEEPTADI_KHALA_RULES == ('malefic_sign', 'debilitation')


def test_deeptadi_khala_switch_reaches_engine():
    """开关经 dashaVariants 白名单进引擎:落陷曜在 BPHS 口径下由 Deena 变 Khala,其余曜不受影响以外的态不乱。"""
    from astrostudy.india.jyotish_engine import JyotishEngine
    from astrostudy.india.dasha_variants import VARIANT_SPECS
    from websrv.webindiasrv import IndiaChartKernel
    assert VARIANT_SPECS['deeptadiKhala']['values'][0] == 'malefic_sign'
    found = None
    for y in range(1970, 2000):
        k = IndiaChartKernel({'date': '%d/03/12' % y, 'time': '14:30:00', 'zone': '+05:30', 'lat': '19n04',
                              'lon': '72e52', 'tradition': False, 'predictive': False, 'zodiacal': 1, 'hsys': 0,
                              'siderealMode': 'lahiri'})
        base = JyotishEngine(k).strengths()['planetaryStates']
        deb = [p for p in base if p.get('dignity') == 'debilitation']
        if deb:
            found = (k, base, deb[0]['id'])
            break
    assert found, '30 年内应有落陷曜'
    k, base, pid = found
    alt = JyotishEngine(k, dasha_variants={'deeptadiKhala': 'debilitation'}).strengths()['planetaryStates']
    b = {p['id']: p['deeptadi']['key'] for p in base}
    a = {p['id']: p['deeptadi']['key'] for p in alt}
    assert a[pid] == 'Khala'
    debil = {p['id'] for p in base if p.get('dignity') == 'debilitation'}
    for q in b:
        if q not in debil and b[q] != 'Khala':
            assert a[q] == b[q], q                    # 非落陷、缺省非 Khala 者两口径同态
