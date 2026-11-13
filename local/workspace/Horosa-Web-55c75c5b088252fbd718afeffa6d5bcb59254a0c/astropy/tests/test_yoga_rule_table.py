import math

import swisseph
import pytest

from flatlib import const

from astrostudy.india import yoga_rule_table as Y
from astrostudy.india.india_chart_kernel import IndiaChartKernel
from astrostudy.india.jyotish_engine import build_jyotish
from astrostudy.india.yoga_rule_table import MA, ME, JU, KE, MO, RA, SA, SU, VE, RuleChart, evaluate

BY_ID = {item['id']: item for item in Y.YOGA_RULES}
KEMADRUMA = next(item['id'] for item in Y.YOGA_RULES if item['name'].startswith('Kemadruma'))
CHART = dict(date='1975/02/10', time='21:15:00', zone='-08:00', lat='47n36', lon='122w20', hsys=5,
             zodiacal=1, tradition=False, predictive=False, siderealMode='lahiri')


def chart(signs, asc=0, diurnal=True):
    """signs 按 日月水金火木土 给星座序号,北交缺省落第 0 座。"""
    placed = dict(zip((SU, MO, ME, VE, MA, JU, SA), signs))
    placed.setdefault(RA, 0)
    placed.setdefault(KE, 6)
    return RuleChart(placed, asc, diurnal)


def hit(rule_id, rule_chart):
    return evaluate(BY_ID[rule_id]['cond'], rule_chart)


def classic(rule_id, rule_chart):
    item = BY_ID[rule_id]
    return evaluate(item['classic'] or item['cond'], rule_chart)


def test_table_is_complete():
    assert [item['id'] for item in Y.YOGA_RULES] == list(range(1, 112))
    assert all(item['group'] in Y.GROUPS for item in Y.YOGA_RULES)
    assert all(Y.describe(item['cond']) for item in Y.YOGA_RULES)
    assert all(Y.describe(item['classic']) for item in Y.YOGA_RULES if item['classic'])


def test_every_rule_can_run_on_any_lagna():
    for asc in range(12):
        rule_chart = chart((1, 2, 3, 4, 5, 6, 7), asc)
        for item in Y.YOGA_RULES:
            evaluate(item['cond'], rule_chart)
            if item['classic']:
                evaluate(item['classic'], rule_chart)


@pytest.mark.parametrize('jupiter, expected', [(0, True), (3, True), (6, True), (9, True), (1, False), (5, False)])
def test_gajakesari_counts_from_the_moon(jupiter, expected):
    assert hit(41, chart((4, 0, 4, 4, 4, jupiter, 4), asc=2)) is expected


def test_sunapha_ignores_the_sun_in_the_second():
    # 太阳和火星都在月后一座:通行定义成立,字面写法被太阳排除
    rule_chart = chart((1, 0, 5, 5, 1, 5, 5))
    assert hit(31, rule_chart) is True
    assert classic(31, rule_chart) is False


def test_durudhura_needs_both_sides():
    assert hit(33, chart((5, 0, 1, 5, 5, 5, 5))) is False
    assert hit(33, chart((5, 0, 1, 11, 5, 5, 5))) is True


def test_kemadruma_is_the_opposite_of_any_neighbour():
    assert hit(34, chart((1, 0, 5, 5, 5, 5, 5))) is True
    assert hit(34, chart((5, 0, 1, 5, 5, 5, 5))) is False


def test_rajju_is_all_movable():
    assert hit(21, chart((0, 3, 6, 9, 0, 3, 6))) is True
    assert hit(21, chart((2, 5, 8, 11, 2, 5, 8))) is False


def test_nala_classic_excludes_virgo():
    rule_chart = chart((2, 5, 8, 11, 2, 5, 8))
    assert hit(23, rule_chart) is True
    assert classic(23, rule_chart) is False


@pytest.mark.parametrize('signs', [(0, 0, 0, 0, 3, 3, 3), (3, 3, 3, 3, 6, 6, 6), (6, 6, 9, 9, 9, 9, 9), (9, 9, 0, 0, 0, 0, 0)])
def test_gada_needs_two_successive_kendras(signs):
    assert hit(12, chart(signs)) is True


def test_gada_rejects_opposite_kendras():
    assert hit(12, chart((0, 0, 0, 6, 6, 6, 6))) is False
    assert hit(10, chart((0, 0, 0, 6, 6, 6, 6))) is True


def test_sringataka_uses_the_trines():
    assert hit(13, chart((0, 4, 8, 0, 4, 8, 0))) is True
    assert hit(13, chart((0, 3, 8, 0, 3, 8, 0))) is False


def test_hala_takes_each_other_trine():
    assert hit(14, chart((1, 5, 9, 1, 5, 9, 1))) is True
    assert hit(14, chart((3, 7, 11, 3, 7, 11, 3))) is True
    assert hit(14, chart((0, 4, 8, 0, 4, 8, 0))) is False


def test_ardha_chandra_classic_has_two_starts():
    run = tuple(range(4, 11))     # 从第 5 宫起七宫
    assert hit(7, chart(run)) is True
    assert classic(7, chart(run)) is False


def test_mars_special_aspects_are_directional():
    # 火星照 4、8:火在白羊照巨蟹、天蝎;日在巨蟹不算火星座
    rule_chart = chart((7, 1, 1, 1, 0, 1, 1))
    assert hit(36, rule_chart) is True        # 日在天蝎,火在白羊照第 8 宫
    assert hit(36, chart((0, 1, 1, 1, 7, 1, 1))) is False   # 反过来日在白羊,火从天蝎数第 6 宫不照


def test_hamsa_needs_kendra_and_dignity():
    assert hit(48, chart((1, 1, 1, 1, 1, 3, 1), asc=0)) is True
    assert hit(48, chart((1, 1, 1, 1, 1, 3, 1), asc=1)) is False
    assert hit(48, chart((1, 1, 1, 1, 1, 6, 1), asc=0)) is False


def test_sasa_counts_own_and_exalted():
    for sign in (6, 9):
        assert hit(50, chart((1, 1, 1, 1, 1, 1, sign), asc=0)) is True


def test_mahabhagya_splits_day_and_sex():
    male = chart((0, 2, 5, 5, 5, 5, 5), asc=4, diurnal=True)
    female = chart((1, 3, 5, 5, 5, 5, 5), asc=5, diurnal=False)
    assert hit(53, male) is True and hit(52, male) is False
    assert hit(52, female) is True and hit(53, female) is False


def test_house_lords_follow_the_lagna():
    # 上升白羊,5 宫主太阳在第 5 宫
    assert hit(1, chart((4, 1, 1, 1, 1, 1, 1), asc=0)) is True
    # 上升金牛,5 宫主水星
    assert hit(1, chart((4, 1, 1, 1, 1, 1, 1), asc=1)) is True
    assert hit(1, chart((5, 2, 3, 3, 3, 3, 3), asc=1)) is False


def test_vidyut_improved_counts_kendra_from_the_lagna_lord():
    # 上升金牛:1 宫主金,11 宫主木。木入巨蟹旺并与金同座,金自己就是 1 宫主
    rule_chart = chart((1, 1, 1, 3, 1, 3, 1), asc=1)
    assert hit(60, rule_chart) is True


def test_satkalatra_either_side_versus_both():
    # 上升白羊,7 宫主金。水照金(两星对冲)。
    rule_chart = chart((5, 5, 6, 0, 5, 5, 5), asc=0)
    assert hit(110, rule_chart) is True
    assert classic(110, rule_chart) is True
    only_venus = chart((5, 5, 6, 0, 5, 5, 5), asc=4)     # 上升狮子,7 宫主土
    assert hit(110, only_venus) is True
    assert classic(110, only_venus) is False


def test_same_planet_is_not_a_conjunction_unless_allowed():
    # 上升白羊,1 宫主、8 宫主都是火星
    rule_chart = chart((5, 5, 5, 5, 0, 5, 5), asc=0)
    assert hit(70, rule_chart) is False


def test_condition_text_is_chinese_and_readable():
    assert Y.describe(BY_ID[41]['cond']) == '木星在月亮的角宫'
    assert Y.describe(BY_ID[42]['cond']) == '火星与月亮同座'
    assert '之一在月亮起第2宫' in Y.describe(BY_ID[31]['cond'])
    assert '宫主' in Y.describe(BY_ID[1]['cond'])


def test_table_on_a_real_chart_matches_its_totals():
    table = Y.build_yoga_table(IndiaChartKernel(dict(CHART)))
    assert table['available'] is True and len(table['rows']) == 111
    assert table['hits'] == sum(row['hit'] for row in table['rows'])
    assert table['classicHits'] == sum(row['classicHit'] for row in table['rows'])
    assert all('classicCond' in row for row in table['rows'] if BY_ID[row['id']]['classic'])


def test_engine_block_carries_the_table():
    jyotish = build_jyotish(IndiaChartKernel(dict(CHART)))
    assert jyotish['yogaTable']['available'] is True
    assert 'partialErrors' not in jyotish


def test_table_follows_the_displayed_varga():
    from astrostudy.india.varga import apply_varga_chart
    natal = IndiaChartKernel(dict(CHART))
    d1 = IndiaChartKernel(dict(CHART))
    apply_varga_chart(natal, 9)
    d9 = build_jyotish(natal, 9, d1)['yogaTable']
    plain = build_jyotish(IndiaChartKernel(dict(CHART)))['yogaTable']
    assert [row['hit'] for row in d9['rows']] != [row['hit'] for row in plain['rows']]


def test_day_and_night_use_the_real_sun():
    # 太阳高度 +4.9°:黄经反算会判成夜
    morning = IndiaChartKernel(dict(CHART, date='1958/10/27', time='10:12:00', zone='+00:00', lat='15s56', lon='65w29'))
    assert Y.sun_is_up(morning) is True


def test_day_night_stays_on_the_birth_moment_in_a_varga():
    from astrostudy.india.varga import apply_varga_chart
    params = dict(CHART, date='2027/12/27', time='21:16:00', zone='+00:00', lat='28s01', lon='150e00')
    natal = IndiaChartKernel(dict(params))
    d1 = IndiaChartKernel(dict(params))
    apply_varga_chart(natal, 9)
    table = Y.build_yoga_table(natal, d1)
    assert Y.sun_is_up(d1) is True
    assert {row['id']: row['hit'] for row in table['rows']}[52] is False


def test_nature_labels_follow_the_meaning():
    for rule_id in (34, 88, 103, 106):
        assert BY_ID[rule_id]['nature'] == 'bad'


def test_bahu_stree_classic_is_one_way():
    # 上升白羊:7 宫主金在巨蟹,1 宫主火在白羊。火照第 4 宫,金不照白羊
    rule_chart = chart((5, 5, 5, 3, 0, 5, 5), asc=0)
    assert hit(109, rule_chart) is True
    assert classic(109, rule_chart) is False


@pytest.mark.parametrize('body, distance, expected', [
    (SA, 3, True), (SA, 7, True), (SA, 10, True), (SA, 5, False), (SA, 4, False),
    (JU, 5, True), (JU, 7, True), (JU, 9, True), (JU, 4, False), (JU, 10, False),
    (MA, 4, True), (MA, 7, True), (MA, 8, True), (MA, 5, False),
    (VE, 7, True), (VE, 4, False),
])
def test_special_aspects_count_from_the_body(body, distance, expected):
    from astrostudy.india.yoga_rule_table import aspects
    signs = dict.fromkeys((SU, MO, ME, VE, MA, JU, SA), 11)
    signs[body] = 0
    signs[MO] = distance - 1
    placed = chart(tuple(signs[item] for item in (SU, MO, ME, VE, MA, JU, SA)))
    assert evaluate(aspects(body, MO), placed) is expected


def test_vahana_improved_drops_the_ninth():
    # 上升白羊,一宫主火星
    for sign, improved, literal in ((3, True, True), (8, False, True), (10, True, True), (1, False, False)):
        rule_chart = chart((1, 1, 1, 1, sign, 1, 1))
        assert hit(101, rule_chart) is improved and classic(101, rule_chart) is literal


def test_matrusapa_improved_is_moon_with_the_sixth_lord():
    # 上升白羊:八主火在狮子(5 宫)、五主日在天蝎(8 宫)、六主水与月同座
    together_only = chart((7, 2, 2, 1, 4, 1, 1))
    assert hit(104, together_only) is True and classic(104, together_only) is False
    # 字面:月在第 6 宫,四主(月)也在第 6 宫;六主水不在一起
    literal_only = chart((7, 5, 2, 1, 4, 1, 1))
    assert hit(104, literal_only) is False and classic(104, literal_only) is True


def test_gaja_classic_reads_the_moon_toward_the_eleventh_lord():
    # 上升白羊:七主金、月都在宝瓶(11 宫),十一主是土
    mutual = chart((0, 10, 1, 10, 1, 1, 4))           # 土在狮子:日月对照,两列都成立
    assert hit(56, mutual) is True and classic(56, mutual) is True
    saturn_only = chart((0, 10, 1, 10, 1, 1, 8))      # 土在射手特照第 3 宫;月只照第 7 宫,照不到土
    assert hit(56, saturn_only) is True and classic(56, saturn_only) is False


def test_pitrusapa_classic_stays_on_libra():
    # 字面的双子与定义相反,不保留
    assert BY_ID[103]['classic'] is None
    assert hit(103, chart((6, 1, 1, 1, 1, 1, 1), asc=2)) is True
    assert hit(103, chart((2, 1, 1, 1, 1, 1, 1), asc=9)) is False


def test_nodes_do_not_count_as_occupied():
    # Kemadruma 只看七曜:月两侧只有北交,仍然成立
    placed = dict(zip((SU, MO, ME, VE, MA, JU, SA), (6, 3, 6, 6, 6, 6, 6)))
    placed[RA], placed[KE] = 4, 10
    assert evaluate(BY_ID[KEMADRUMA]['cond'], RuleChart(placed, 0, True)) is True


def _independent_sun_is_up(params):
    kernel = IndiaChartKernel(dict(params))
    jd, lat, lon = kernel.dateTime.jd, kernel.pos.lat, kernel.pos.lon
    ra, dec = swisseph.calc_ut(jd, swisseph.SUN, swisseph.FLG_EQUATORIAL)[0][:2]
    hour_angle = math.radians(swisseph.sidtime(jd) * 15.0 + lon - ra)
    phi, delta = math.radians(lat), math.radians(dec)
    # 日面上缘含折射接地平:日心真高度 −50′
    return math.sin(phi) * math.sin(delta) + math.cos(phi) * math.cos(delta) * math.cos(hour_angle) > math.sin(math.radians(-50.0 / 60.0))


@pytest.mark.parametrize('date, time, zone, lat, lon', [
    ('1975/02/10', '07:45:00', '-08:00', '47n36', '122w20'),      # 西雅图日出前后
    ('1975/02/10', '17:40:00', '-08:00', '47n36', '122w20'),      # 西雅图日落前后
    ('2000/06/21', '04:50:00', '+05:30', '28n37', '77e13'),
    ('2000/12/21', '12:00:00', '+10:00', '33s52', '151e13'),
    ('1958/10/27', '10:12:00', '+00:00', '15s56', '65w29'),
    ('2020/03/20', '23:30:00', '+00:00', '0n10', '179e00'),
])
def test_sun_is_up_matches_an_independent_altitude(date, time, zone, lat, lon):
    params = dict(CHART, date=date, time=time, zone=zone, lat=lat, lon=lon)
    assert Y.sun_is_up(IndiaChartKernel(params)) is _independent_sun_is_up(params)


def test_some_chart_separates_the_classic_column():
    # 经典成立不能恒等于改进
    rule_chart = chart((1, 1, 1, 1, 8, 1, 1))
    assert hit(101, rule_chart) != classic(101, rule_chart)
    table = Y.build_yoga_table(IndiaChartKernel(dict(CHART, date='1990/05/15', time='12:00:00', zone='+08:00', lat='39n54', lon='116e24')))
    assert any('classicHit' in row for row in table['rows'])



def test_day_birth_agrees_with_the_sunrise_used_by_the_rest_of_the_page():
    """新德里 2026-03-21 日出后约 90 秒:按日面上缘 + 折射已是白天(与六力、大运同口径)。"""
    params = dict(CHART, date='2026/03/21', time='06:25:36', zone='+05:30', lat='28n37', lon='77e13')
    assert Y.sun_is_up(IndiaChartKernel(params)) is True
