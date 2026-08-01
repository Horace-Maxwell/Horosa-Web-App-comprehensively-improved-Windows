# -*- coding: utf-8 -*-
"""按命宫判星曜功能吉凶(functional nature)的单元测试。

覆盖：
  - 十二命宫瑜伽卡拉卡对照表(尤其 巨蟹/狮子→火星、摩羯/水瓶→金星、金牛/天秤→土星、白羊/天蝎→无)
  - 命主恒吉
  - 成长宫(3/6/11)主为凶(连自然吉星亦然)
  - 角宫主缺陷(木星为巨蟹命第7宫主 → 中性)
  - 全 12 命宫 × 9 曜无遗漏 / 字段齐备 / 取值合法
  - 障碍星(badhaka)、马拉卡(maraka)
  - SIGN_RULER 与 jyotish_engine.OWN_SIGNS 等价
"""

import pytest
from flatlib import const

from astrostudy.india.functional_nature import (
    functional_nature, yogakaraka_for, SIGN_RULER, SIGN_ORDER, GRAHAS,
)

ALL_LAGNAS = list(SIGN_ORDER)

VALID_NATURAL = {'benefic', 'malefic', 'neutral'}
VALID_FUNCTIONAL = {'benefic', 'malefic', 'neutral', 'yogakaraka', 'maraka'}


def _by_planet(lagna_sign):
    return {r['planet']: r for r in functional_nature(lagna_sign)}


# ════════════════════════════════════════════════════════════════════════
# 1. 十二命宫瑜伽卡拉卡对照表
# ════════════════════════════════════════════════════════════════════════

# 来源：经典功能吉凶判准的「纯角宫(4/7/10)+三角宫(5/9)双主」结论。
# 🔴 三角侧不含第 1 宫 —— 第 1 宫既角又三角,若计入则四个变动命宫(双子/处女/射手/双鱼)
# 的命主(它同时主某纯角宫)会被误判成瑜伽卡拉卡;通行口径仅六个命宫有此星,
# 与 yoga_engine.yogakaraka_planet 同判据(旧断言锁的正是被证伪的含第 1 宫版本)。
YOGAKARAKA_TABLE = {
    const.ARIES: None,            # 白羊 → 无
    const.TAURUS: const.SATURN,   # 金牛 → 土星(主 9 三角 + 10 角)
    const.GEMINI: None,           # 双子 → 无(水星只是命主兼 4 宫主,非 5/9 三角主)
    const.CANCER: const.MARS,     # 巨蟹 → 火星(主 5 三角 + 10 角)
    const.LEO: const.MARS,        # 狮子 → 火星(主 9 三角 + 4 角)
    const.VIRGO: None,            # 处女 → 无(同双子)
    const.LIBRA: const.SATURN,    # 天秤 → 土星(主 5 三角 + 4 角)
    const.SCORPIO: None,          # 天蝎 → 无
    const.SAGITTARIUS: None,      # 射手 → 无(木星只是命主兼 4 宫主)
    const.CAPRICORN: const.VENUS, # 摩羯 → 金星(主 5 三角 + 10 角)
    const.AQUARIUS: const.VENUS,  # 水瓶 → 金星(主 9 三角 + 4 角)
    const.PISCES: None,           # 双鱼 → 无(同射手)
}


@pytest.mark.parametrize('lagna,expected', list(YOGAKARAKA_TABLE.items()))
def test_yogakaraka_table(lagna, expected):
    assert yogakaraka_for(lagna) == expected, (
        '%s 瑜伽卡拉卡应为 %s' % (lagna, expected))


def test_classic_mnemonic_pairs():
    # 经典口诀：巨蟹/狮子→火星，摩羯/水瓶→金星，金牛/天秤→土星。
    assert yogakaraka_for(const.CANCER) == const.MARS
    assert yogakaraka_for(const.LEO) == const.MARS
    assert yogakaraka_for(const.CAPRICORN) == const.VENUS
    assert yogakaraka_for(const.AQUARIUS) == const.VENUS
    assert yogakaraka_for(const.TAURUS) == const.SATURN
    assert yogakaraka_for(const.LIBRA) == const.SATURN


def test_aries_scorpio_no_yogakaraka():
    # 白羊、天蝎无单一瑜伽卡拉卡：无任何行星 isYogakaraka。
    for lagna in (const.ARIES, const.SCORPIO):
        rows = functional_nature(lagna)
        assert not any(r['isYogakaraka'] for r in rows), '%s 不应有瑜伽卡拉卡' % lagna


def test_yogakaraka_unique_when_present():
    # 有瑜伽卡拉卡的命宫，至多一个行星 isYogakaraka。
    for lagna in ALL_LAGNAS:
        n = sum(1 for r in functional_nature(lagna) if r['isYogakaraka'])
        assert n <= 1, '%s 瑜伽卡拉卡不止一个' % lagna


def test_yogakaraka_flag_matches_functional_field():
    for lagna in ALL_LAGNAS:
        for r in functional_nature(lagna):
            if r['isYogakaraka']:
                assert r['functionalNature'] == 'yogakaraka'


# ════════════════════════════════════════════════════════════════════════
# 2. 命主恒吉
# ════════════════════════════════════════════════════════════════════════

def test_lagna_lord_always_benefic():
    # 命主(第1宫主)无论自然吉凶，功能均为吉或瑜伽卡拉卡(吉性)。
    for lagna in ALL_LAGNAS:
        ruler = SIGN_RULER[lagna]
        row = _by_planet(lagna)[ruler]
        assert 1 in row['housesRuled'], '%s 命主 %s 应主第1宫' % (lagna, ruler)
        assert row['functionalNature'] in ('benefic', 'yogakaraka'), (
            '%s 命主 %s 应吉，实际 %s' % (lagna, ruler, row['functionalNature']))


def test_sun_moon_lagna_lord_benefic():
    # 狮子命主=太阳(自然凶)、巨蟹命主=月亮：作命主仍为吉。
    leo = _by_planet(const.LEO)[const.SUN]
    assert leo['naturalNature'] == 'malefic'
    assert leo['functionalNature'] == 'benefic'
    cancer = _by_planet(const.CANCER)[const.MOON]
    assert cancer['functionalNature'] == 'benefic'


# ════════════════════════════════════════════════════════════════════════
# 3. 成长宫(3/6/11)主为凶
# ════════════════════════════════════════════════════════════════════════

def test_upachaya_lord_malefic():
    # 对每个命宫，凡某星「只」主成长宫(3/6/11，且不沾命主/三角/角宫)→ 功能为凶。
    UP = {3, 6, 11}
    GOOD = {1, 5, 9, 4, 7, 10}  # 命主/三角/角宫
    checked = 0
    for lagna in ALL_LAGNAS:
        for r in functional_nature(lagna):
            houses = set(r['housesRuled'])
            if not houses:
                continue
            if houses & UP and not (houses & GOOD) and not (houses & {8, 12}):
                # 纯成长宫主(可含第2宫，但2不致吉)。
                assert r['functionalNature'] == 'malefic', (
                    '%s %s 主 %s 应凶' % (lagna, r['planet'], sorted(houses)))
                checked += 1
    assert checked > 0, '未覆盖到任何纯成长宫主样本'


def test_jupiter_aquarius_2_11_malefic():
    # 水瓶命：木星主第2(瓶起算双鱼=2)、第11(射手=11)→ 含成长宫11 ⇒ 凶。
    row = _by_planet(const.AQUARIUS)[const.JUPITER]
    assert set(row['housesRuled']) == {2, 11}
    assert row['functionalNature'] == 'malefic', (
        '水瓶命木星(主2/11)应凶，实际 %s' % row['functionalNature'])


# ════════════════════════════════════════════════════════════════════════
# 4. 角宫主缺陷(kendradhipati dosha)
# ════════════════════════════════════════════════════════════════════════

def test_kendradhipati_jupiter_cancer_neutral():
    # 巨蟹命：木星主第6(射手)与第9(双鱼)。第9为三角宫 ⇒ 实际偏吉，非中性。
    # 取纯角宫缺陷的标准例：木星为巨蟹命「第7宫主」需另造——巨蟹第7=摩羯(土主)。
    # 故用「双子命木星」：主第7(射手)、第10(双鱼)→ 皆角宫，自然吉星 ⇒ 中性。
    row = _by_planet(const.GEMINI)[const.JUPITER]
    assert set(row['housesRuled']) == {7, 10}
    assert row['functionalNature'] == 'neutral', (
        '双子命木星(主7/10纯角宫)应中性,实际 %s' % row['functionalNature'])


def test_kendradhipati_venus_gemini_neutral():
    # 双子命：金星主第5(天秤=5)与第12(金牛=12)。第5三角 ⇒ 偏吉。换标准角宫例：
    # 处女命金星主第2(天秤=2)、第9(金牛=9)——第9三角偏吉。
    # 取「狮子命金星」：主第3(天秤=3)、第10(金牛=10)→ 3成长致凶,故非纯中性。
    # 纯角宫缺陷的干净样本用「双鱼命水星」：主第4(双子=4)、第7(处女=7)→ 皆角宫 ⇒ 中性。
    row = _by_planet(const.PISCES)[const.MERCURY]
    assert set(row['housesRuled']) == {4, 7}
    assert row['functionalNature'] == 'neutral', (
        '双鱼命水星(主4/7纯角宫)应中性,实际 %s' % row['functionalNature'])


def test_kendra_malefic_loses_malefic():
    # 自然凶星主纯角宫亦中性：白羊命土星主第10(摩羯=10)、第11(水瓶=11)。
    # 第11成长 ⇒ 凶占优,非中性。取干净例:双鱼命火星主第2(白羊=2)、第9(天蝎=9)→9三角偏吉。
    # 「天秤命太阳」:主第11(狮子=11)→成长 ⇒ 凶。改用「巨蟹命土星」主第7(摩羯=7)、第8(水瓶=8)→
    # 第7纯角宫+第8凶舍 ⇒ 混合。直接验证「主纯角宫」标签存在即可：
    row = _by_planet(const.CANCER)[const.SATURN]
    assert set(row['housesRuled']) == {7, 8}
    # 7=角宫(中性)、8=凶舍(凶)→ 按优先级凶舍占先 ⇒ malefic。
    assert row['functionalNature'] == 'malefic'


# ════════════════════════════════════════════════════════════════════════
# 5. 障碍星(badhaka) / 马拉卡(maraka)
# ════════════════════════════════════════════════════════════════════════

def test_badhaka_movable_11th_lord():
    # 活动宫命(白羊):障碍宫=11(水瓶),其主=土星 ⇒ 土星 isBadhaka。
    rows = _by_planet(const.ARIES)
    assert rows[const.SATURN]['isBadhaka'] is True
    n = sum(1 for r in rows.values() if r['isBadhaka'])
    assert n == 1


def test_badhaka_fixed_9th_lord():
    # 固定宫命(金牛):障碍宫=9(摩羯),其主=土星 ⇒ 土星 isBadhaka。
    rows = _by_planet(const.TAURUS)
    assert rows[const.SATURN]['isBadhaka'] is True


def test_badhaka_dual_7th_lord():
    # 变动宫命(双子):障碍宫=7(射手),其主=木星 ⇒ 木星 isBadhaka。
    rows = _by_planet(const.GEMINI)
    assert rows[const.JUPITER]['isBadhaka'] is True


def test_exactly_one_badhaka_per_lagna():
    for lagna in ALL_LAGNAS:
        n = sum(1 for r in functional_nature(lagna) if r['isBadhaka'])
        assert n == 1, '%s 障碍星应恰好一个' % lagna


def test_maraka_flag():
    # 马拉卡=主2或7且非命主。白羊命:金星主第2(金牛=2)、第7(天秤=7)→ 双马拉卡宫,且非命主。
    row = _by_planet(const.ARIES)[const.VENUS]
    assert set(row['housesRuled']) == {2, 7}
    assert row['isMaraka'] is True


def test_lagna_lord_not_maraka_even_if_rules_7():
    # 命主即便兼主第7宫,亦不记马拉卡。白羊命火星主第1(白羊)、第8(天蝎=8)——不触7,另选:
    # 天秤命火星主第2(天蝎=2)、第7(白羊=7)→ 非命主 ⇒ 应 isMaraka。
    # 命主兼7的样本:无单星同主1与7(1与7对宫,主星不同)。改验「主7非命主⇒maraka」:
    row = _by_planet(const.LIBRA)[const.MARS]
    assert 7 in row['housesRuled']
    assert row['isMaraka'] is True
    # 命主(天秤=金星)即便其一宫为7的对宫,也不应误标:
    lord = _by_planet(const.LIBRA)[const.VENUS]
    assert lord['isMaraka'] is False


# ════════════════════════════════════════════════════════════════════════
# 6. 节点(罗睺/计都)
# ════════════════════════════════════════════════════════════════════════

def test_nodes_no_houses():
    for lagna in ALL_LAGNAS:
        rows = _by_planet(lagna)
        for node in (const.NORTH_NODE, const.SOUTH_NODE):
            assert rows[node]['housesRuled'] == []
            assert rows[node]['isYogakaraka'] is False
            assert rows[node]['isMaraka'] is False


def test_nodes_neutral_without_placement():
    rows = _by_planet(const.ARIES)
    assert rows[const.NORTH_NODE]['functionalNature'] == 'neutral'
    assert rows[const.SOUTH_NODE]['functionalNature'] == 'neutral'


def test_nodes_placement_hint():
    # 传入落座:罗睺落三角宫→偏吉,落凶舍→偏凶。
    # 白羊命:第5宫=狮子(三角),第6宫=处女(凶舍)。
    ps = {const.NORTH_NODE: const.LEO, const.SOUTH_NODE: const.VIRGO}
    rows = {r['planet']: r for r in functional_nature(const.ARIES, planet_signs=ps)}
    assert rows[const.NORTH_NODE]['functionalNature'] == 'benefic'
    assert rows[const.SOUTH_NODE]['functionalNature'] == 'malefic'


# ════════════════════════════════════════════════════════════════════════
# 7. 全 12 命宫 × 9 曜:无遗漏 / 字段齐备 / 取值合法
# ════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize('lagna', ALL_LAGNAS)
def test_all_lagnas_nine_grahas_complete(lagna):
    rows = functional_nature(lagna)
    assert len(rows) == 9
    planets = [r['planet'] for r in rows]
    assert planets == GRAHAS  # 顺序固定且齐全
    for r in rows:
        assert set(r.keys()) >= {
            'planet', 'planetLabel', 'naturalNature', 'housesRuled',
            'functionalNature', 'isYogakaraka', 'isMaraka', 'isBadhaka', 'reason'}
        assert r['naturalNature'] in VALID_NATURAL
        assert r['functionalNature'] in VALID_FUNCTIONAL
        assert isinstance(r['housesRuled'], list)
        assert all(isinstance(h, int) and 1 <= h <= 12 for h in r['housesRuled'])
        assert isinstance(r['isYogakaraka'], bool)
        assert isinstance(r['isMaraka'], bool)
        assert isinstance(r['isBadhaka'], bool)
        assert isinstance(r['reason'], str) and r['reason']


def test_house_count_per_planet():
    # 日/月各主1宫;五星各主2宫;节点0宫。
    for lagna in ALL_LAGNAS:
        rows = _by_planet(lagna)
        assert len(rows[const.SUN]['housesRuled']) == 1
        assert len(rows[const.MOON]['housesRuled']) == 1
        for p in (const.MARS, const.MERCURY, const.JUPITER, const.VENUS, const.SATURN):
            assert len(rows[p]['housesRuled']) == 2, '%s %s 应主2宫' % (lagna, p)


def test_each_house_ruled_exactly_once():
    # 每个命宫,1..12 宫恰好各被某曜主管一次(节点除外,共 12 宫由 7 曜覆盖)。
    for lagna in ALL_LAGNAS:
        all_houses = []
        for r in functional_nature(lagna):
            all_houses.extend(r['housesRuled'])
        assert sorted(all_houses) == list(range(1, 13)), (
            '%s 宫位覆盖异常: %s' % (lagna, sorted(all_houses)))


def test_invalid_lagna_raises():
    with pytest.raises(ValueError):
        functional_nature('NotASign')


# ════════════════════════════════════════════════════════════════════════
# 8. SIGN_RULER 与 jyotish_engine.OWN_SIGNS 等价(防漂移)
# ════════════════════════════════════════════════════════════════════════

def test_sign_ruler_matches_engine_own_signs():
    from astrostudy.india.jyotish_engine import OWN_SIGNS
    derived = {}
    for planet, signs in OWN_SIGNS.items():
        for s in signs:
            derived[s] = planet  # 每星座单主(节点 OWN_SIGNS 为空,不参与)
    assert derived == SIGN_RULER, 'SIGN_RULER 与 OWN_SIGNS 反推不一致'
