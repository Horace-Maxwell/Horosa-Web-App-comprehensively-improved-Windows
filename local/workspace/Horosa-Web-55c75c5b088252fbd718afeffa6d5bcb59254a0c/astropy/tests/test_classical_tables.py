# -*- coding: utf-8 -*-
"""WI-07 28月站 / WI-09 阳阴度数 数据表测试。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import classical_tables as ctab


def test_mansions_count_and_width():
    assert len(ctab.LUNAR_MANSIONS) == 28
    assert abs(ctab.LUNAR_MANSION_WIDTH - 360.0 / 28.0) < 1e-9


def test_mansion_index_boundaries():
    # 0°白羊起首宿;每宿宽 12.857°;跨界正确。
    assert ctab.mansion_index(0.0) == 0
    assert ctab.mansion_index(12.85) == 0        # 仍在第1宿
    assert ctab.mansion_index(12.86) == 1        # 跨入第2宿
    assert ctab.mansion_index(359.999) == 27     # 末宿
    assert ctab.mansion_of(0.0)['idx'] == 1
    assert ctab.mansion_of(0.0)['name'] == 'Al-Sharatain'
    assert ctab.mansion_of(359.0)['idx'] == 28


def test_degree_gender_verbatim_ranges():
    # 白羊阳性 1-7,16-22,30:deg1(signlon0)阳、deg8(signlon7)阴、deg16(signlon15)阳、deg30(signlon29)阳。
    assert ctab.degree_gender('Aries', 0.0) == 'masculine'    # 第1度
    assert ctab.degree_gender('Aries', 7.0) == 'feminine'     # 第8度
    assert ctab.degree_gender('Aries', 15.0) == 'masculine'   # 第16度
    assert ctab.degree_gender('Aries', 29.0) == 'masculine'   # 第30度
    # 金牛阳性 8-22:deg1阴、deg8阳、deg23阴。
    assert ctab.degree_gender('Taurus', 0.0) == 'feminine'
    assert ctab.degree_gender('Taurus', 7.0) == 'masculine'
    assert ctab.degree_gender('Taurus', 22.0) == 'feminine'
    # 全 12 座皆有定义。
    for sign in ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']:
        assert ctab.degree_gender(sign, 5.0) in ('masculine', 'feminine')


def test_monomoiria_chaldean_continuous():
    # 连续迦勒底,0°白羊第1度=土星;每 7° 循环。
    assert ctab.monomoiria_ruler(0) == 'Saturn'
    assert ctab.monomoiria_ruler(1) == 'Jupiter'
    assert ctab.monomoiria_ruler(6) == 'Moon'
    assert ctab.monomoiria_ruler(7) == 'Saturn'
    assert ctab.monomoiria_ruler(30) == ctab.CHALDEAN_ORDER[30 % 7]


def test_ninth_part_triplicity_start():
    # 动象始本座 / 固定始本三分性第10季宫 / 变动始第6季宫(navamsa 连续式)。
    assert ctab.ninth_part_sign(0) == 'Aries'      # 白羊(动火)始白羊
    assert ctab.ninth_part_sign(30) == 'Capricorn'  # 金牛(固土)始摩羯
    assert ctab.ninth_part_sign(60) == 'Libra'      # 双子(变风)始天秤
    assert ctab.ninth_part_sign(120) == 'Aries'     # 狮子(固火)始白羊


def test_darijan_indian_decan():
    # 白羊:本座 Mars / 第5座(狮)Sun / 第9座(射)Jupiter。
    assert ctab.darijan_ruler('Aries', 5) == 'Mars'
    assert ctab.darijan_ruler('Aries', 15) == 'Sun'
    assert ctab.darijan_ruler('Aries', 25) == 'Jupiter'
    # 巨蟹(水):本座 Moon / 第5座(天蝎)Mars / 第9座(双鱼)Jupiter。
    assert ctab.darijan_ruler('Cancer', 5) == 'Moon'
    assert ctab.darijan_ruler('Cancer', 25) == 'Jupiter'


def test_degree_quality_all_sum_30():
    # WI-05:每星座 明/暗/空/烟 run-length 必累加=30(转录自检铁律)。
    for sign, runs in ctab.DEGREE_QUALITY.items():
        assert sum(n for _, n in runs) == 30, '{0} sum != 30'.format(sign)


def test_degree_quality_aries_anchor():
    # 白羊正文锚:0-3暗,3-8明,8-16暗,16-20明,20-24空,24-29明,29-30空。
    assert ctab.degree_quality('Aries', 0.5) == 'D'
    assert ctab.degree_quality('Aries', 5) == 'B'
    assert ctab.degree_quality('Aries', 10) == 'D'
    assert ctab.degree_quality('Aries', 18) == 'B'
    assert ctab.degree_quality('Aries', 22) == 'E'
    assert ctab.degree_quality('Aries', 26) == 'B'
    assert ctab.degree_quality('Aries', 29.5) == 'E'


def test_special_degree_lookups():
    # WI-09:陷度/慢病/增福(1基度序 = int(signlon)+1)。
    assert ctab.special_degree('Aries', 5.2) == {'pitted': True}      # 第6度 陷
    assert ctab.special_degree('Taurus', 5.0) == {'azemene': True}    # 第6度 慢病
    assert ctab.special_degree('Cancer', 0.3) == {'fortune': True}    # 第1度 增福
    assert ctab.special_degree('Sagittarius', 6.5) == {'pitted': True, 'azemene': True}  # 第7度 陷+慢病
    assert ctab.special_degree('Aries', 1.0) is None                 # 第2度 无


def test_gemini_bound_emended_switch():
    # 卜卦 2b:经典传本(termsVariant=2)双子界4/5 口径开关——默认忠原书 ♄21–25/♂25–30;
    # geminiBoundEmended 时换校勘对调 ♂21–25/♄25–30;还原令牌配对后全局表复位(防串请求)。
    from astrostudy import perchart
    from flatlib.dignities import essential, tables
    tok = perchart.push_request_terms(2)
    try:
        assert essential.TERMS['Gemini'][3][0] == 'Saturn'
        assert essential.TERMS['Gemini'][4][0] == 'Mars'
    finally:
        perchart.pop_request_terms(tok)
    tok = perchart.push_request_terms(2, geminiBoundEmended=True)
    try:
        gem = essential.TERMS['Gemini']
        assert gem[3] == ['Mars', 21, 25]
        assert gem[4] == ['Saturn', 25, 30]
        # 其余座与经典传本逐字一致(只动双子)
        assert essential.TERMS['Libra'] == tables.LILLY_TERMS['Libra']
    finally:
        perchart.pop_request_terms(tok)
    assert essential.TERMS is not None


def test_gemini_bound_emended_only_applies_to_variant2():
    # 校勘开关不外溢:埃及(0)/校勘本(1)/迦勒底(3) 下开关无效。
    from astrostudy import perchart
    from flatlib.dignities import tables
    for tv, expect_tbl in [(0, tables.EGYPTIAN_TERMS), (1, tables.TETRABIBLOS_TERMS)]:
        tok = perchart.push_request_terms(tv, geminiBoundEmended=True)
        try:
            from flatlib.dignities import essential
            assert essential.TERMS['Gemini'] == expect_tbl['Gemini']
        finally:
            perchart.pop_request_terms(tok)
