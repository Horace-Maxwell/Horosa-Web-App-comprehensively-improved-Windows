# -*- coding: utf-8 -*-
"""地占纯内核 golden(astrostudy.geomancy,WP-1)。算法逐位锚点 + 法官恒偶/Sikidy 校验压测 + 192 宫断语 + 对应字段。
(旧 vendor 引擎测试见 test_geomancy.py,WP-3 退役后合并。)
运行: PYTHONPATH=Horosa-Web/astropy python3 -m pytest Horosa-Web/astropy/tests/test_geomancy_kernel.py -q"""
import random

from astrostudy import geomancy as g
from astrostudy.geomancy import correspondences as corr


N = g.FIG_BY_NAME


# ---- 图形 ----
def test_16_unique_full_set():
    assert set(g.FIG_BY_INT.keys()) == set(range(16))
    assert len(g.FIG_BY_NAME) == 16


def test_valid_judges_8_even():
    names = {g.name(i) for i in g.VALID_JUDGES}
    assert names == {"Via", "Populus", "Carcer", "Coniunctio",
                     "Amissio", "Acquisitio", "Fortuna Maior", "Fortuna Minor"}
    assert len(g.VALID_JUDGES) == 8


def test_palindromes():
    pal = {g.name(i) for i in g.FIG_BY_INT if g.reverse(i) == i}
    assert pal == {"Via", "Populus", "Carcer", "Coniunctio"}


def test_algebra():
    assert g.inverse(N["Via"]) == N["Populus"]
    assert g.reverse(N["Puer"]) == N["Puella"]
    assert g.inverse(N["Puer"]) == N["Albus"]
    for i in range(16):
        assert g.add(i, i) == 0
        assert g.add(i, 0) == i
        assert g.converse(i) == g.reverse(g.inverse(i))


def test_points():
    expect = {"Via": 4, "Populus": 8, "Cauda Draconis": 5, "Caput Draconis": 5,
              "Fortuna Maior": 6, "Fortuna Minor": 6, "Laetitia": 7, "Tristitia": 7,
              "Albus": 7, "Rubeus": 7, "Puer": 5, "Puella": 5,
              "Amissio": 6, "Acquisitio": 6, "Carcer": 6, "Coniunctio": 6}
    for nm, p in expect.items():
        assert g.points(N[nm]) == p, nm


# ---- 盾牌 ----
def test_worked_example():
    M = [N[x] for x in ["Puella", "Albus", "Fortuna Minor", "Caput Draconis"]]
    s = g.cast_shield_from_mothers(M)
    assert [g.name(x) for x in s.daughters] == ["Amissio", "Fortuna Maior", "Puer", "Carcer"]
    assert [g.name(x) for x in s.nieces] == ["Carcer", "Puella", "Carcer", "Rubeus"]
    assert g.name(s.right_witness) == "Albus"
    assert g.name(s.left_witness) == "Puer"
    assert g.name(s.judge) == "Via"
    assert g.name(s.reconciler) == "Rubeus"


def test_judge_always_even_stress():
    rng = random.Random(0)
    for _ in range(50000):
        s = g.cast_shield(rng)
        assert g.points(s.judge) % 2 == 0
        assert s.judge in g.VALID_JUDGES


def test_daughters_transpose():
    rng = random.Random(2)
    for _ in range(2000):
        M = [rng.randint(0, 15) for _ in range(4)]
        D = g.daughters_from_mothers(M)
        for j in range(4):
            for k in range(4):
                assert g.figures.row(D[j], 3 - k) == g.figures.row(M[k], 3 - j)


# ---- 宫位盘 + 占星定局 ----
def test_sequential_projection():
    M = [N[x] for x in ["Puella", "Albus", "Fortuna Minor", "Caput Draconis"]]
    hc = g.house_chart_sequential(g.cast_shield_from_mothers(M))
    assert g.name(hc[1]) == "Puella"
    assert g.name(hc[5]) == "Amissio"
    assert g.name(hc[9]) == "Carcer"
    assert g.name(hc[12]) == "Rubeus"


def test_ascendant_and_planets():
    M = [N[x] for x in ["Puella", "Albus", "Fortuna Minor", "Caput Draconis"]]
    hc = g.house_chart_sequential(g.cast_shield_from_mothers(M))
    assert g.ascendant_sign(hc, "classical") == "Libra"
    assert g.ascendant_sign(hc, "planetary") == "Libra"
    place = g.astro_place_planets_from_chart(hc)
    for p in g.PLANET_ORDER:
        assert p in place
        for h in place[p]:
            assert 1 <= h <= 12


def test_bytwelves_in_range():
    out = g.astro_place_planets_bytwelves(random.Random(3))
    for p in g.PLANET_ORDER:
        assert 1 <= out[p] <= 12


def test_derived_house():
    assert g.derived_house(3, 6) == 8
    assert g.derived_house(1, 7) == 7


# ---- 解读 ----
def _chart(mapping, filler="Via"):
    hc = {h: N[filler] for h in range(1, 13)}
    for h, nm in mapping.items():
        hc[h] = N[nm]
    return hc


def test_perfection_modes():
    assert g.perfection(_chart({1: "Acquisitio", 7: "Acquisitio"}), 1, 7) == "occupation"
    assert g.perfection(_chart({1: "Acquisitio", 7: "Tristitia", 6: "Acquisitio"}, "Populus"), 1, 7) == "conjunction"
    assert g.perfection(_chart({1: "Acquisitio", 7: "Tristitia", 3: "Acquisitio", 4: "Tristitia"}, "Populus"), 1, 7) == "mutation"
    assert g.perfection(_chart({1: "Acquisitio", 7: "Tristitia", 2: "Laetitia", 6: "Laetitia"}, "Populus"), 1, 7) == "translation"
    assert g.perfection(_chart({1: "Acquisitio", 7: "Tristitia", 2: "Albus", 6: "Puella", 8: "Carcer"}, "Populus"), 1, 7) == "none"


def test_aspect():
    assert [g.aspect(1, x) for x in (1, 3, 4, 5, 7, 2, 6)] == \
        ["conjunction", "sextile", "square", "trine", "opposition", "none", "none"]


def test_company_types():
    assert g.company(_chart({1: "Acquisitio", 2: "Acquisitio"}), 1, 2) == "simple"
    assert g.company(_chart({1: "Acquisitio", 2: "Laetitia"}), 1, 2) == "demi_simple"
    assert g.company(_chart({1: "Puer", 2: "Albus"}), 1, 2) == "compound"
    assert g.company(_chart({1: "Puella", 2: "Carcer"}), 1, 2) == "capitular"


# ---- 新补技法 ----
def test_prohibition():
    assert g.prohibition(_chart({1: "Acquisitio", 7: "Acquisitio", 4: "Rubeus"}, "Populus"), 1, 7) == 4
    assert g.prohibition(_chart({1: "Acquisitio", 7: "Acquisitio"}, "Populus"), 1, 7) is None


def test_points_parity():
    r = g.points_parity(_chart({}, "Populus"))   # 全 Populus(8点)×12 = 96 偶
    assert r["parity"] == "even" and r["bias"] == "yes"
    r2 = g.points_parity(_chart({1: "Via"}, "Populus"))   # 96-8+4=92 偶
    assert r2["total"] == 92


def test_timing_and_triplicities():
    t = g.timing(_chart({7: "Laetitia"}, "Populus"), 7)   # Laetitia 动·火
    assert t["speed"] == "fast" and t["unit"] == "日"
    assert sorted(g.triplicities(1)) == [1, 5, 9]
    assert sorted(g.triplicities(8)) == [4, 8, 12]


# ---- Sikidy ----
def test_sikidy_validity_stress():
    rng = random.Random(5)
    for _ in range(5000):
        col = g.cast_sikidy(rng)
        assert g.sikidy_valid(col)
        for k in range(4):
            assert col[5 + k] == tuple(col[c][k] for c in range(1, 5))


def test_sikidy_16_columns():
    col = g.cast_sikidy(random.Random(6))
    assert set(col.keys()) == set(range(1, 17))
    assert g.SIKIDY_COL_NAMES[1] == "Tale" and g.SIKIDY_COL_NAMES[16] == "Akiba"


# ---- 流派 + 对应 ----
def test_profiles():
    for k in ("european_classical", "european_planetary", "arabic_raml", "india_ramal", "sikidy", "hakata"):
        assert k in g.PROFILES
    assert g.PROFILES["arabic_raml"]["direction"] == "RTL"
    assert g.DEFAULT_PROFILE == "european_classical"


def test_correspondences_figure_fields():
    fm = corr.figure_full("Fortuna Maior")
    for key in ("element_inner", "element_outer", "body_part", "color", "humor", "tone", "unicode", "zodiac_classical", "zodiac_planetary"):
        assert key in fm and fm[key]
    assert fm["tone"] == "good"
    assert len(corr.catalog()) == 16


def test_house_readings_192():
    for fig in g.FIG_BY_NAME:
        for h in range(1, 13):
            r = corr.house_reading(fig, h)
            assert r is not None, f"{fig} 宫{h}"
            assert r["reading"]
    assert corr.question_house("marriage") == 7
    assert corr.house_meaning(10)["latin"] == "Regnum"


# ---- WP-2 读法补全 ----
def test_perfection_by_aspect():
    # 1↔5 三分、其间无强凶 + 常规完美 none → 借相位
    hc = _chart({1: "Acquisitio", 5: "Laetitia"}, "Albus")
    if g.perfection(hc, 1, 5) == "none":
        assert g.perfection_by_aspect(hc, 1, 5) == "trine"


def test_paternitas_tree():
    M = [N[x] for x in ["Puella", "Albus", "Fortuna Minor", "Caput Draconis"]]
    s = g.cast_shield_from_mothers(M)
    tree = g.paternitas(s)
    assert tree["name"] == "Via"                      # 判官
    assert [c["name"] for c in tree["children"]] == ["Albus", "Puer"]   # 右证/左证
    # 右证 Albus ← 甥1/甥2 ← 母
    assert tree["children"][0]["children"][0]["children"][0]["name"] == "Puella"   # M1


def test_via_puncti():
    M = [N[x] for x in ["Puella", "Albus", "Fortuna Minor", "Caput Draconis"]]
    s = g.cast_shield_from_mothers(M)
    vp = g.via_puncti(s)
    assert isinstance(vp["path"], list) and vp["path"][0] == "Via"
    assert "through" in vp


def test_natural_cosignificator():
    assert g.natural_cosignificator(N["Populus"]) == "Moon"
    assert g.natural_cosignificator(N["Via"]) == "Moon"
    assert g.natural_cosignificator(N["Acquisitio"]) is None


def test_sikidy_princes_slaves_red():
    rng = random.Random(11)
    col = g.cast_sikidy(rng)
    ps = g.princes_slaves(col)
    assert len(ps["princes"]) + len(ps["slaves"]) == 16
    assert isinstance(g.red_sikidy(col), bool)
    cc = g.column_compare(col, 1, 2)
    assert "equal" in cc and "xor" in cc


# ---- 整盘聚合(WP-3 服务入口) ----
def test_compute_reading_deterministic():
    a = g.compute_reading(question_type="marriage", cast_method="manual", seed=777)
    b = g.compute_reading(question_type="marriage", cast_method="manual", seed=777)
    assert a["judge"]["latin"] == b["judge"]["latin"]
    assert [h["figure"]["latin"] for h in a["houses"]] == [h["figure"]["latin"] for h in b["houses"]]


def test_compute_reading_shape():
    r = g.compute_reading(question_type="career", profile_id="european_classical", cast_method="manual", seed=42)
    assert r["quesited_house"] == 10                  # career→10
    assert len(r["houses"]) == 12
    assert all("figure" in h and "reading" in h for h in r["houses"])   # 图形入宫 + 192 断语
    assert r["judge"]["points"] % 2 == 0              # 判官偶
    assert "perfection" in r["reading"] and "via_puncti" in r["reading"]
    assert r["right_witness"]["latin"] and r["reconciler"]["latin"]


def test_compute_reading_sikidy_profile():
    r = g.compute_reading(profile_id="sikidy", cast_method="manual", seed=5)
    assert "sikidy" in r and r["sikidy"]["valid"] is True
    assert len(r["sikidy"]["columns"]) == 16
    assert r["sikidy"]["columns"]["1"]["meaning"]   # 列指代义已挂


# ---- 数据层(figure_meanings / 希腊希伯来名 / Hakata)----
def test_figure_meanings_16x10():
    TOPICS = ["总性", "爱情", "财富", "事业", "健康", "诉讼", "旅行", "失物", "是否", "时机"]
    for lat in g.FIG_BY_NAME:
        m = corr.figure_meaning(lat)
        assert m is not None, lat
        for t in TOPICS:
            assert t in m and m[t], f"{lat}.{t}"


def test_alt_names_greek_hebrew():
    for lat in g.FIG_BY_NAME:
        alt = corr.figure_alt_names(lat)
        assert alt["greek"] and alt["hebrew"], lat
    assert corr.figure_alt_names("Via")["greek"] == "Hodós"
    assert corr.figure_alt_names("Carcer")["hebrew"] == "Maʾasar"


def test_hakata_cast():
    h = g.cast_hakata(__import__("random").Random(3))
    assert len(h["tablets"]) == 4
    assert h["figure"] in g.FIG_BY_NAME
    assert h["reading"]
    # 4 片正反 → 4bit → 对应 int
    n = (h["bits"][0] << 3) | (h["bits"][1] << 2) | (h["bits"][2] << 1) | h["bits"][3]
    assert n == h["int"]


def test_compute_reading_hakata_profile():
    r = g.compute_reading(profile_id="hakata", cast_method="manual", seed=7)
    assert "hakata" in r and r["hakata"]["figure"] in g.FIG_BY_NAME


def test_catalog_enriched():
    cat = corr.catalog()
    fm = cat["Fortuna Maior"]
    assert fm["meanings"] and fm["name_greek"] and fm["name_hebrew"]


# ---- 压力测试:全流派 × 全问类 × 多种子 → compute_reading 不抛 + 合法 ----
def test_compute_reading_cartesian_stress():
    QTYPES = ["life", "health", "wealth", "marriage", "career", "children",
              "journey", "religion", "enemy", "death", "custom"]
    fail = []
    n = 0
    for pid in g.PROFILES:
        for qt in QTYPES:
            for seed in (1, 7, 42, 123, 9999):
                n += 1
                try:
                    r = g.compute_reading(question_type=qt, profile_id=pid, cast_method="manual", seed=seed)
                except Exception as e:  # noqa: BLE001
                    fail.append(f"{pid}/{qt}/{seed}: 抛 {e}")
                    continue
                if not (len(r["mothers"]) == 4 and len(r["daughters"]) == 4 and len(r["nieces"]) == 4):
                    fail.append(f"{pid}/{qt}/{seed}: 母女甥数不对")
                if g.points(r["judge"]["int"]) % 2 != 0:
                    fail.append(f"{pid}/{qt}/{seed}: 判官非偶")
                if len(r["houses"]) != 12:
                    fail.append(f"{pid}/{qt}/{seed}: houses={len(r['houses'])}")
                if any(h.get("reading") is None for h in r["houses"]):
                    fail.append(f"{pid}/{qt}/{seed}: 宫缺断语")
    assert fail == [], f"({n} 组) 失败样本: {fail[:8]}"


def test_compute_reading_determinism_across_profiles():
    # 同 profile+seed 两次完全一致(判官+十二宫图)
    for pid in g.PROFILES:
        a = g.compute_reading(profile_id=pid, cast_method="manual", seed=55)
        b = g.compute_reading(profile_id=pid, cast_method="manual", seed=55)
        assert a["judge"]["latin"] == b["judge"]["latin"]
        assert [h["figure"]["latin"] for h in a["houses"]] == [h["figure"]["latin"] for h in b["houses"]]


# ── 全流派补齐断言(钉死本批修复,防「死代码」回潮)──
def test_ifa_bijection_and_no_divination():
    """主形↔图形为双射,且结构对照层不产出任何占断内容。"""
    from astrostudy.geomancy import ifa
    assert ifa.bijection_ok()
    import random as _r
    c = ifa.cast_ifa(_r.Random(1), 'opele')
    assert c['cultural_notice']
    assert len(c['meji_reference']) == 16
    # 只出结构,不得混入吉凶/判读字段
    for k in ('perfection', 'aspect', 'judge', 'reading'):
        assert k not in c


def test_bytwelves_wired_and_isolated():
    """定局乙必须真出参;且其取随机不得污染盘序(同 seed 的护盾盘恒同)。"""
    from astrostudy.geomancy.chart import compute_reading
    a = compute_reading('wealth', 'european_classical', cast_method='manual', seed=7)
    b = compute_reading('wealth', 'european_classical', cast_method='manual', seed=7,
                        house_projection='astro_bytwelves')
    assert b['planet_placement_by_twelves']
    assert len(b['planet_placement_by_twelves']) == 9
    assert [f['int'] for f in a['mothers']] == [f['int'] for f in b['mothers']]
    assert a['judge']['int'] == b['judge']['int']


def test_wrap_houses_actually_consumed():
    """环宫形参必须真改变判定(此前声明了却从不传=死参)。"""
    import random
    from astrostudy.geomancy import reading as R
    from astrostudy.geomancy.shield import cast_shield
    from astrostudy.geomancy.house import house_chart_sequential
    diff = 0
    for sd in range(1500):
        hc = house_chart_sequential(cast_shield(random.Random(sd)))
        if R.perfection(hc, 1, 7, True) != R.perfection(hc, 1, 7, False):
            diff += 1
    assert diff > 0


def test_sikidy_column_compare_emitted():
    from astrostudy.geomancy.chart import compute_reading
    r = compute_reading('health', 'sikidy', cast_method='manual', seed=11)
    assert len(r['sikidy']['compare']) == 15


def test_figure_numbers_three_systems():
    from astrostudy.geomancy.numbers import figure_number
    assert figure_number(15, 'points')['value'] == 4
    assert figure_number(15, 'abjad')['value'] == 319          # 路之阿拉伯名字母值和
    assert figure_number(0, 'planetary')['value'] == 9         # 月序
    assert figure_number(7, 'planetary')['fallback'] is True   # 交点无行星序,回落点数


def test_figure_meanings_are_per_figure():
    """逐图含义必须逐图相异(此前按吉凶基调合成,同调各图逐字雷同)。"""
    from astrostudy.geomancy import correspondences as corr
    cat = corr.catalog()
    for k in ('爱情', '财富', '事业', '健康', '诉讼', '旅行', '失物'):
        vals = [v['meanings'][k] for v in cat.values()]
        assert len(set(vals)) == 16, k
    # 内容正确性抽样:路主变动,于行旅为大吉
    assert '大吉' in cat['Via']['meanings']['旅行']


def test_granular_defaults_are_zero_regression():
    """不传任何传本参数 = 与显式传入该流派默认值逐字段等同。"""
    from astrostudy.geomancy.chart import compute_reading
    a = compute_reading('career', 'european_classical', cast_method='manual', seed=99)
    b = compute_reading('career', 'european_classical', cast_method='manual', seed=99,
                        wrap_houses=False, compound_mode='inverse', number_system='points',
                        reconciler=True, halt_enabled=True, house_projection='sequential')
    assert a['reading'] == b['reading']
    assert a['judge']['int'] == b['judge']['int']
    assert a['reconciler']['int'] == b['reconciler']['int']


# ── 收尾补齐断言 ──
def test_locus_and_motus():
    import random
    from astrostudy.geomancy import reading as R
    from astrostudy.geomancy.shield import cast_shield
    from astrostudy.geomancy.house import house_chart_sequential
    hc = house_chart_sequential(cast_shield(random.Random(42)))
    assert R.locus(hc, 1)['band'] == 'fortunate'
    assert R.locus(hc, 8)['band'] == 'unfortunate'
    assert R.locus(hc, 2)['band'] == 'neutral'
    for h in (0, 13, -5):          # 越界须夹紧不抛
        assert 1 <= R.locus(hc, h)['house'] <= 12
    m = R.motus(hc)
    assert sum(len(r['houses']) for r in m['recurring']) + \
           (m['distinct_figures'] - len(m['recurring'])) == 12


def test_shield_triads_exactly_seven():
    """盾牌生成三元组恰七组,且每组之子确为两父之异或(结构自证)。"""
    import random
    from astrostudy.geomancy import reading as R
    from astrostudy.geomancy.shield import cast_shield
    from astrostudy.geomancy.figures import add
    for sd in range(200):
        tri = R.shield_triads(cast_shield(random.Random(sd)))
        assert len(tri) == 7
        for g in tri:
            a, b = g['parent_ints']
            assert add(a, b) == g['child_int'], g['label']


def test_perfection_detail_keeps_type_and_finds_mediator():
    """完美细情须留 type 键(前端/AI 在读),且传递式须能指出中介之图与其宫。"""
    import random
    from astrostudy.geomancy import reading as R
    from astrostudy.geomancy.shield import cast_shield
    from astrostudy.geomancy.house import house_chart_sequential
    found_translation = False
    for sd in range(600):
        hc = house_chart_sequential(cast_shield(random.Random(sd)))
        d = R.perfection_detail(hc, 1, 7)
        assert 'type' in d and d['type'] == R.perfection(hc, 1, 7)
        if d['type'] == 'translation':
            found_translation = True
            assert d['via_figure'] and d['via_house']
        if d['type'] == 'conjunction':
            assert d['mover'] in ('querent', 'quesited')
    assert found_translation, '600 盘中未见传递式,样本不足以证中介人可定'


def test_sikidy_check2b_and_quadrants():
    import random
    from astrostudy.geomancy.sikidy import cast_sikidy, check2b, quadrants, tokan_sikidy
    for sd in range(300):
        col = cast_sikidy(random.Random(sd))
        assert check2b(col), '第二组三不可分应为结构必然'
        q = quadrants(col)
        assert q['synthesized'] is True          # 逐列配属为合成,须如实标注
        assert sum(v['princes'] + v['slaves'] for v in q['quadrants'].values()) == 16
        assert isinstance(tokan_sikidy(col)['is_tokan'], bool)


def test_house_system_and_asc_source():
    """两式上升皆可取;象限无度数须如实标退化,绝不伪造宫头。"""
    from astrostudy.geomancy.chart import compute_reading
    a = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42,
                        asc_source='h1_figure', house_system='whole_sign')
    b = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42,
                        asc_source='fresh_points', house_system='quadrant')
    assert a['astro_erection']['degenerate_to_whole_sign'] is False
    assert b['astro_erection']['degenerate_to_whole_sign'] is True
    assert b['astro_erection']['note']
    assert len(a['astro_erection']['signs']) == 12
    # 另起点数取上升须用独立子 rng,不得污染盘序
    assert [f['int'] for f in a['mothers']] == [f['int'] for f in b['mothers']]
    assert a['judge']['int'] == b['judge']['int']


def test_palindromes_and_active_elements():
    from astrostudy.geomancy.figures import PALINDROME_FIGURES, active_elements, name, FIG_BY_INT
    assert {name(i) for i in PALINDROME_FIGURES} == {'Via', 'Populus', 'Carcer', 'Coniunctio'}
    assert active_elements(15)['count'] == 4      # 全单点 → 四元素俱在场
    assert active_elements(0)['count'] == 0       # 全双点 → 无元素在场
    for i in FIG_BY_INT:                          # 在场数须等于单点行数
        assert active_elements(i)['count'] == bin(i).count('1')


def test_vedic_overlay_covers_all_sixteen():
    """东传叠加须十六图全覆盖九曜(交点天然对应),且为纯显示不改判读。"""
    from astrostudy.geomancy.vedic import vedic_overlay, graha_table
    from astrostudy.geomancy.figures import FIG_BY_INT
    assert len(graha_table()) == 9
    for i in FIG_BY_INT:
        v = vedic_overlay(i, house=7)
        assert v['graha_sanskrit'] and v['rashi'] and v['bhava_zh']


def test_names_system_switch():
    from astrostudy.geomancy.chart import compute_reading, NAME_SYSTEMS
    seen = set()
    for ns in NAME_SYSTEMS:
        r = compute_reading('wealth', 'european_classical', cast_method='manual', seed=42,
                            names_system=ns)
        assert r['settings']['names_system'] == ns
        assert r['judge']['display_name']       # 缺名须回落拉丁,绝不留空
        seen.add(r['judge']['display_name'])
    assert len(seen) > 1, '名表切换未改变主名'
    # 希腊档须自带希腊名表
    assert compute_reading('wealth', 'greek', cast_method='manual',
                           seed=42)['settings']['names_system'] == 'greek'


# ── R0 回归守:十二宫星座须自上升起顺铺,不得退回写死的自然星座 ──
def test_house_signs_rotate_with_ascendant():
    """定局星座序 = 自上升起的黄道连续序;宫一星座恒等于上升星座。
    此前后端错取 house_meanings 里写死的自然星座(1=白羊…12=双鱼),
    与盘心「上升 X」自相矛盾 —— 本例为该 bug 的可自证不变量。"""
    from astrostudy.geomancy.chart import compute_reading
    from astrostudy.geomancy.house import SIGN_ORDER
    for seed in (1, 42, 777, 20260721):
        for asc_src in ('h1_figure', 'fresh_points'):
            for hsys in ('whole_sign', 'quadrant'):
                r = compute_reading('marriage', 'european_classical', cast_method='manual',
                                    seed=seed, asc_source=asc_src, house_system=hsys)
                er = r['astro_erection']
                signs = er['signs']
                assert len(signs) == 12
                assert [s['house'] for s in signs] == list(range(1, 13))
                # ① 宫一 = 上升
                assert signs[0]['sign'] == er['sign'], (seed, asc_src, hsys)
                # ② 黄道连续:第 k 宫 = 上升后第 k-1 个星座
                i0 = SIGN_ORDER.index(er['sign'])
                assert [s['sign'] for s in signs] == [SIGN_ORDER[(i0 + k) % 12] for k in range(12)]
                # ③ 象限族无度数时如实退化,绝不伪造宫头度数
                assert er['degenerate_to_whole_sign'] is (hsys == 'quadrant')


def test_house_signs_not_natural_fallback():
    """反证:定局星座不得恒为自然星座序(白羊起)—— 若恒等于它,说明又退回写死数据。"""
    from astrostudy.geomancy.chart import compute_reading
    natural = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
               'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
    non_aries = 0
    for seed in range(1, 61):
        r = compute_reading('wealth', 'european_classical', cast_method='manual', seed=seed)
        got = [s['sign'] for s in r['astro_erection']['signs']]
        if got != natural:
            non_aries += 1
    assert non_aries >= 40, f'60 盘中仅 {non_aries} 盘星座序非自然序,疑似未随上升旋转'


# ── R2 数据完备守 ──
def test_person_house_complete():
    """人物宫别表:条目齐全、宫号 ∈ 1..12,且关键人物配属合古法
    (父4/母10/子5/兄弟3/仆役6/配偶·合伙7/医者7/明敌7/暗敌12)。"""
    import json
    from pathlib import Path
    p = Path(__file__).resolve().parents[1] / 'astrostudy' / 'geomancy' / 'data' / 'house_meanings.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    ph = (d.get('person_house') or {}).get('map') or []
    assert len(ph) >= 12, len(ph)
    for row in ph:
        assert isinstance(row.get('house'), int) and 1 <= row['house'] <= 12, row
        assert row.get('person'), row
    by = {row['person']: row['house'] for row in ph}
    assert len(by) == len(ph), '人物条目重名'
    for who, h in (('父', 4), ('母', 10), ('子女', 5), ('兄弟姊妹', 3), ('仆役·下属', 6),
                   ('配偶·合伙人', 7), ('医者', 7), ('对手·暗敌', 7),
                   ('师长·尊长', 9), ('上司·当权', 10), ('友朋', 11), ('隐秘之敌', 12)):
        assert by.get(who) == h, (who, by.get(who), h)


def test_names_shakal_honest_no_pairing():
    """东传名录:十六相齐全、名唯一,且**显式标注无配属**。
    ⚠️ 此处刻意**不**断言「相↔图双射」—— 所据基准未载相与图的配属,
    断言双射等同于要求代码去杜撰配对。故反向守:`attested_pairing` 必须为 False,
    且该名录不得被接进名表体系选择器(NAME_SYSTEMS),防日后有人偷偷补一份臆造配对。"""
    import json
    from pathlib import Path
    from astrostudy.geomancy.chart import NAME_SYSTEMS
    from astrostudy.geomancy.figures import FIG_BY_INT
    base = Path(__file__).resolve().parents[1] / 'astrostudy' / 'geomancy' / 'data'
    d = json.loads((base / 'names_shakal.json').read_text(encoding='utf-8'))
    assert d.get('attested_pairing') is False, '无据配属被改成了 True'
    kala = d.get('kala') or []
    assert len(kala) == 16, len(kala)
    assert [k['n'] for k in kala] == list(range(1, 17))
    assert len({k['name'] for k in kala}) == 16, '相名重复'
    assert all(k.get('zh') for k in kala), '相名缺中文'
    assert 'shakal' not in NAME_SYSTEMS, '无配属名录不得进名表体系选择器'
    # 同类:马语名录亦无配属,同守
    dm = json.loads((base / 'names_malagasy.json').read_text(encoding='utf-8'))
    assert dm.get('attested_pairing') is False
    assert 'malagasy' not in NAME_SYSTEMS
    assert len(FIG_BY_INT) == 16


# ── B0 死开关守:落星法三态必两两互异 ──
def test_projection_three_states_distinct():
    """「落星法」三态(不落星/甲/乙)输出必两两不同 —— 曾经三态指纹全同,是彻底的死开关。
    两处旁路合谋:甲法**无条件**计算(不看所选之法),且 L4 档 `or scope=='L4'` 无视用户选择恒算乙。"""
    from astrostudy.geomancy.chart import compute_reading, HOUSE_PROJECTIONS
    import hashlib, json
    assert HOUSE_PROJECTIONS == ('sequential', 'astro_from_chart', 'astro_bytwelves')
    for scope in ('L3', 'L4'):
        for seed in (1, 42, 777, 20260721):
            fps = {}
            for proj in HOUSE_PROJECTIONS:
                r = compute_reading('marriage', 'european_classical', cast_method='manual',
                                    seed=seed, house_projection=proj, reading_scope=scope)
                key = {'a': r['planet_placement'], 'b': r['planet_placement_by_twelves']}
                fps[proj] = hashlib.sha1(json.dumps(key, sort_keys=True, default=str).encode()).hexdigest()
            assert len(set(fps.values())) == 3, (scope, seed, fps)
            # 语义:各法只产其所属之落星,不越俎代庖
            assert fps  # 上行已断言互异,此处再逐条验语义
        r_seq = compute_reading('marriage', 'european_classical', cast_method='manual', seed=42,
                                house_projection='sequential', reading_scope=scope)
        assert r_seq['planet_placement'] is None and r_seq['planet_placement_by_twelves'] is None
        r_a = compute_reading('marriage', 'european_classical', cast_method='manual', seed=42,
                              house_projection='astro_from_chart', reading_scope=scope)
        assert r_a['planet_placement'] and r_a['planet_placement_by_twelves'] is None
        r_b = compute_reading('marriage', 'european_classical', cast_method='manual', seed=42,
                              house_projection='astro_bytwelves', reading_scope=scope)
        assert r_b['planet_placement'] is None and r_b['planet_placement_by_twelves']
    # L4 档而用户**未显式指定**时,给主流甲法兜底(免得该档空无落星)
    r_l4 = compute_reading('marriage', 'european_classical', cast_method='manual', seed=42,
                           reading_scope='L4')
    assert r_l4['planet_placement'] and r_l4['planet_placement_by_twelves'] is None
    r_l3 = compute_reading('marriage', 'european_classical', cast_method='manual', seed=42,
                           reading_scope='L3')
    assert r_l3['planet_placement'] is None      # L3 缺省=顺铺=不落星


# ── B1 守:东传叠加层三表(graha/rashi/bhava)须齐全且宫位那份真挂到宫上 ──
def test_vedic_bhava_on_every_house():
    """AI 口径承诺「盘面已随图给出其曜名、星座之该支名与**宫位之该支名**」。
    此前图对象的 vedic 只带曜与星座(vedic_overlay 不给宫则无 bhava),宫对象上更是一个字都没有
    —— 承诺了却拿不到,等于让模型据不存在的字段臆造。"""
    import json
    from pathlib import Path
    from astrostudy.geomancy.chart import compute_reading
    from astrostudy.geomancy.vedic import BHAVA, GRAHA, RASHI
    # 三表齐全
    assert len(BHAVA) == 12 and set(BHAVA.keys()) == {str(i) for i in range(1, 13)}
    assert len(GRAHA) == 9 and len(RASHI) == 12
    for k, v in BHAVA.items():
        assert v.get('sanskrit') and v.get('zh'), (k, v)
    # 数据文件三表并存(缺一则叠加层残废)
    p = Path(__file__).resolve().parents[1] / 'astrostudy' / 'geomancy' / 'data' / 'vedic_overlay.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    for key in ('graha', 'bhava', 'rashi'):
        assert d.get(key), key
    # 每宫都真带上了宫位之支名
    r = compute_reading('marriage', 'india_ramal', cast_method='manual', seed=42)
    assert len(r['houses']) == 12
    for h in r['houses']:
        v = h.get('vedic') or {}
        assert v.get('bhava') == h['house'], (h['house'], v.get('bhava'))
        assert v.get('bhava_sanskrit') == BHAVA[str(h['house'])]['sanskrit']
        assert v.get('bhava_zh') == BHAVA[str(h['house'])]['zh']
        assert v.get('graha_sanskrit') and v.get('rashi')


# ── B2 守:调和者二式「何时恒等、何时分野」两面都锁死 ──
def test_reconciler_modes_identity_and_divergence():
    """结论须两面都锁,否则日后无从判断「切了没变」是 bug 还是数学必然:
    ① **未转宫时二式恒等是数学事实**——顺铺下 hc[1] 即首母,故 J⊕M1 与 J⊕问者指示星同值;
       引擎须如实回传 reconciler_modes_coincide=True 供界面说明,而不是假装有差异。
    ② **转宫后必须真分野**——转宫后问者指示星本就应随之易主,否则该选项确是死开关。"""
    from astrostudy.geomancy.chart import compute_reading
    RE = lambda s, m, t=None: compute_reading(          # noqa: E731
        'marriage', 'european_classical', cast_method='manual', seed=s,
        reconciler_mode=m, turn_to=t)
    # ① 顺铺下宫一之图恒为首母(此即二式恒等之根)
    for s in range(1, 121):
        r = RE(s, 'judge_first_mother')
        assert r['houses'][0]['figure']['int'] == r['mothers'][0]['int'], s
    # ② 未转宫:二式恒等,且引擎如实标注
    for s in range(1, 121):
        a = RE(s, 'judge_first_mother')
        b = RE(s, 'judge_querent_significator')
        assert a['reconciler']['int'] == b['reconciler']['int'], s
        assert b['settings']['reconciler_modes_coincide'] is True, s
        assert a['settings']['reconciler_modes_coincide'] is False, s   # 首母法不涉此问题
    # ③ 转宫后必须真分野(允许偶合,但不得恒等)
    for turn in (4, 7, 10):
        diff = sum(1 for s in range(1, 201)
                   if RE(s, 'judge_first_mother', turn)['reconciler']['int']
                   != RE(s, 'judge_querent_significator', turn)['reconciler']['int'])
        assert diff >= 150, (turn, diff)
        # 分野时不得再标恒等
        assert RE(1, 'judge_querent_significator', turn)['settings']['reconciler_house'] == turn


# ── B4 守:所问宫是一等真值源;问者宫与所问宫重合时须如实标注退化 ──
def test_quesited_house_first_class_and_degeneracy():
    """🔴 此前所问宫**只能**由问类查表得出,而表里 custom→1、life→1 与问者宫(恒一)撞车:
    q==t ⇒ hc[1]==hc[1] 恒真 → 完美恒「入主」;宫距 0 → 相位恒「合」。
    前端默认问类正是 custom,故**开箱即坏**(实测 300 盘全同)。
    正法是「取与问题主题对应之宫的图」,问类只是快捷预设。今许显式指定所问宫。"""
    from collections import Counter
    from astrostudy.geomancy.chart import compute_reading
    from astrostudy.geomancy import correspondences as corr
    RE = lambda s, **kw: compute_reading('custom', 'european_classical',      # noqa: E731
                                         cast_method='manual', seed=s, **kw)
    # ① 显式所问宫必须覆盖查表值
    for qh in range(1, 13):
        r = RE(1, quesited_house=qh)
        assert r['quesited_house'] == qh, qh
        assert r['settings']['quesited_house'] == qh
        assert r['settings']['quesited_house_explicit'] is True
    # ② 非法值静默忽略、回落查表(不得抛,也不得写入越界宫)
    for bad in (0, 13, -1, 'x', None):
        r = RE(1, quesited_house=bad)
        assert r['quesited_house'] == corr.question_house('custom')
    # ③ 退化标注两面都对
    assert RE(1, quesited_house=1)['settings']['indicators_coincide'] is True
    assert RE(1, quesited_house=7)['settings']['indicators_coincide'] is False
    # ④ 退化宫下完美/相位恒定(这正是 bug 的数学本体,锁死以防日后误判为"修好了")
    perf1 = {RE(s, quesited_house=1)['reading']['perfection'] for s in range(1, 121)}
    assert perf1 == {'occupation'}, perf1
    # ⑤ 非退化宫下完美取值种数 ≥3 —— 真正有判别力
    for qh in (2, 7, 10):
        c = Counter(RE(s, quesited_house=qh)['reading']['perfection'] for s in range(1, 301))
        assert len(c) >= 3, (qh, dict(c))
    # ⑥ 缺省(不传)仍走问类查表 → 既有路径零回归
    assert compute_reading('marriage', 'european_classical', cast_method='manual',
                           seed=1)['quesited_house'] == 7
    assert compute_reading('marriage', 'european_classical', cast_method='manual',
                           seed=1)['settings']['quesited_house_explicit'] is False


# ── B5 守:「点数是否」取样不得落在结构退化的范围上 ──
def test_points_parity_scope_not_degenerate():
    """🔴 十二宫总点数**奇偶被结构锁死为偶**,故该取样下此技法恒答「是」(实测 3000 盘 even 3000)。
    数学本体:十二宫 = 四母 + 四女 + 四甥;四女是四母的**转置**,单点总数与四母恒等 ⇒ 母+女恒偶;
    四甥各由两图异或而成,成对之单点和亦恒偶 ⇒ 总和恒偶(同「判官点数恒偶」之理)。
    基准所载为「统计全盘(或四母、或某些关键图)」—— 十二宫恰是唯一退化取样。"""
    from collections import Counter
    from astrostudy.geomancy.chart import compute_reading
    from astrostudy.geomancy.reading import PARITY_SCOPES
    assert PARITY_SCOPES == ('shield16', 'mothers', 'houses12')
    RE = lambda s, sc=None: compute_reading(                                  # noqa: E731
        'marriage', 'european_classical', cast_method='manual', seed=s,
        **({'parity_scope': sc} if sc else {}))['reading']['points_parity']
    # ① 默认必须是不退化的全盘取样(默认曾经就是那个死的)
    d = RE(1)
    assert d['scope'] == 'shield16' and d['degenerate'] is False
    # ② 全盘与四母:1000 盘内 odd/even **双方都要出现**,方为有判别力
    for sc in ('shield16', 'mothers'):
        c = Counter(RE(s, sc)['parity'] for s in range(1, 1001))
        assert c['odd'] > 0 and c['even'] > 0, (sc, dict(c))
        assert min(c.values()) > 300, (sc, dict(c))     # 大致均衡,不是偶发一两次
    # ③ 十二宫:恒偶是数学事实,须锁死并如实标 degenerate(不是"修好它",是"别拿它当判据")
    c12 = Counter(RE(s, 'houses12')['parity'] for s in range(1, 1001))
    assert c12 == Counter({'even': 1000}), dict(c12)
    assert RE(1, 'houses12')['degenerate'] is True
    assert RE(1, 'houses12')['degenerate_note']
    # ④ 取样数如实
    assert RE(1, 'shield16')['sampled'] == 16
    assert RE(1, 'mothers')['sampled'] == 4
    assert RE(1, 'houses12')['sampled'] == 12
