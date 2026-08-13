# -*- coding: utf-8 -*-
"""策天飞星·移语本引证图金标(全书唯一完整命例,乙卯年冬月廿七戌时=公历 1975-12-29 20:00)。

引证图盘面(逐宫):
  巳:天空(兄弟)  午:天寿(财帛)  未:天印天刑(命宫)  申:天贵凤阁(相貌,贵旺)
  辰:红鸾天罗(田宅,乐)          酉:天虚(福德)
  卯:天库(男女,身,乐)           戌:紫微天哭地网(官禄)
  寅:天贯天杖三台龙池(奴仆)  丑:文昌天异(夫妻,庙)  子:毛头天福八座(疾厄)  亥:天禄天刃天姚(迁移,乐)
运限(逆行):初限起身卯,12 岁入寅(贯),22 丑(文限),32 子(福限),42 亥(禄限),52 戌(紫限)。
安星依「立诸星」:太岁(卯)起库逆布贯文福禄紫虚贵印寿空红;太岁六合(戌)安哭;
杖=子起正月逆数至生月(冬月→寅),异/耗/刃由杖逆布一二三宫(丑/子/亥);刑=酉起正月顺(→未);姚=丑起正月顺(→亥)。
"""

import pytest

from astrostudy.cetian_ziwei import (
    CETIAN_BRIGHTNESS_TABLE,
    CETIAN_BRIGHTNESS_TABLE_YIYU,
    CETIAN_STAR_LORE,
    EARTHLY_BRANCHES,
    compute_cetian_ziwei_chart,
)

B = {name: idx for idx, name in enumerate(EARTHLY_BRANCHES)}


def _chart(**kw):
    args = dict(
        year=1975, month=12, day=29, hour=20, minute=0,
        timezone=8.0, latitude=26.0667, longitude=119.3167,
        location_name="引证图", gender="男", method="book",
    )
    args.update(kw)
    return compute_cetian_ziwei_chart(**args)


@pytest.fixture(scope="module")
def chart():
    return _chart()


def _stars_at(chart, branch_idx):
    for p in chart.palaces:
        if p.branch == branch_idx:
            return set(p.stars) | set(p.aux_stars)
    raise AssertionError("branch not found")


def test_lunar_anchor(chart):
    assert (chart.lunar_year, chart.lunar_month, chart.lunar_day) == (1975, 11, 27)
    assert chart.lunar_year_stem == 1 and chart.lunar_year_branch == 3  # 乙卯
    assert chart.hour_branch == B["戌"]
    assert chart.yin_yang == "陰"


def test_ming_shen_ziwei(chart):
    assert chart.ming_gong_branch == B["未"]
    assert chart.shen_gong_branch == B["卯"]   # 引证图口径(默认):廿七→逆行11宫→卯
    assert chart.ziwei_branch == B["戌"]
    assert chart.shen_gong_mode == "yizheng"


def test_shen_gong_literal_mode():
    c = _chart(shen_gong_mode="literal")
    assert c.shen_gong_branch == B["辰"]       # 正文直读(旧口径):floor((27-1)//2.5)=10→辰
    assert c.shen_gong_mode == "literal"
    assert c.ming_gong_branch == B["未"]       # 命宫不受身宫口径影响


def test_shen_gong_day1_anchor_both_modes():
    """🔴 双约束第二锚:原文「从杖星处起初一」——初一必落杖星宫(偏移 0),两口径皆然。

    仅用引证图廿七单点会过拟合(曾误用 ceil(日/2.5) 在廿七处巧合正确、初一却偏一宫,
    30 日中 12 日落宫错位)。此锚与引证图锚同时成立才能锁定唯一解 ceil((日-1)/2.5)。
    冬月初一戌时:天杖=(1-11)%12=寅 → 身宫必为寅。
    """
    for mode in ("yizheng", "literal"):
        c = _chart(year=1975, month=12, day=3, shen_gong_mode=mode)   # 乙卯冬月初一
        assert (c.lunar_month, c.lunar_day) == (11, 1)
        assert c.shen_gong_branch == B["寅"], f"{mode}: 初一未落杖星宫"


def test_shen_gong_two_modes_differ_at_most_one_palace():
    """两取整口径逐日只差 0 或 1 宫;出现差 2 宫 = 起点系统性偏移(旧 bug 的信号)。"""
    import math
    for day in range(1, 31):
        yz = math.ceil((day - 1) / 2.5)
        lit = int((day - 1) // 2.5)
        assert yz - lit in (0, 1), f"day{day} 两口径差 {yz - lit} 宫"
    # 边界日(初一/初四/初九…)两口径同宫,非边界日差一宫;引证图廿七为差一宫之例。
    assert math.ceil((1 - 1) / 2.5) == int((1 - 1) // 2.5)
    assert math.ceil((27 - 1) / 2.5) - int((27 - 1) // 2.5) == 1


def test_main_stars_placement(chart):
    expect = {
        "天庫": "卯", "天貫": "寅", "文昌": "丑", "天福": "子", "天祿": "亥",
        "紫微": "戌", "天虛": "酉", "天貴": "申", "天印": "未", "天壽": "午",
        "天空": "巳", "紅鸞": "辰",
    }
    for star, branch in expect.items():
        assert star in _stars_at(chart, B[branch]), f"{star} 应在 {branch}"


def test_aux_stars_placement(chart):
    expect = {
        "天杖": "寅", "天異": "丑", "毛頭": "子", "天刃": "亥",
        "天刑": "未", "天姚": "亥", "天哭": "戌",
    }
    for star, branch in expect.items():
        assert star in _stars_at(chart, B[branch]), f"{star} 应在 {branch}"


def test_daxian_yiyu_yinnan_from_shen_reverse(chart):
    # 乙卯阴年男命:移语本口径=从身(卯)起、逆行。引证图:12入寅/22丑/32子/42亥/52戌。
    start_by_branch = {p.branch: p.da_xian_start for p in chart.palaces}
    assert start_by_branch[B["卯"]] == 1
    assert start_by_branch[B["寅"]] == 11
    assert start_by_branch[B["丑"]] == 21
    assert start_by_branch[B["子"]] == 31
    assert start_by_branch[B["亥"]] == 41
    assert start_by_branch[B["戌"]] == 51
    assert chart.daxian_mode == "yiyu"


def test_daxian_legacy_mode():
    # 旧口径:逆行恒从身起——本例(阴男)起点同为身,与移语本口径重合(男命两口径同果)。
    c = _chart(daxian_mode="legacy")
    starts = {p.branch: p.da_xian_start for p in c.palaces}
    assert starts[B["卯"]] == 1 and starts[B["戌"]] == 51
    assert c.daxian_mode == "legacy"


def test_daxian_modes_differ_for_yin_female():
    # 阴年女命:移语本=从身(卯)顺行;旧口径=顺行恒从命(未)起——两口径必须分歧。
    yiyu = _chart(gender="女")
    legacy = _chart(gender="女", daxian_mode="legacy")
    yiyu_starts = {p.branch: p.da_xian_start for p in yiyu.palaces}
    legacy_starts = {p.branch: p.da_xian_start for p in legacy.palaces}
    assert yiyu_starts[B["卯"]] == 1          # 阴年从身起
    assert yiyu_starts[B["辰"]] == 11         # 顺行(阴女顺)
    assert legacy_starts[B["未"]] == 1        # 旧:顺行从命起
    assert legacy_starts[B["申"]] == 11


def test_brightness_yiyu_default(chart):
    # 移语本诸星格:天贵申庙、天库卯乐、文昌丑无亮度;引证图标注互证(贵申旺为图上双说,从诸星格庙)。
    by_branch = {p.branch: p for p in chart.palaces}
    assert by_branch[B["申"]].brightness.get("天貴") == "廟"
    assert by_branch[B["卯"]].brightness.get("天庫") == "樂"
    assert "文昌" not in by_branch[B["丑"]].brightness
    assert chart.brightness_school == "yiyu"


def test_brightness_quanji_switch():
    c = _chart(brightness_school="quanji")
    by_branch = {p.branch: p for p in c.palaces}
    # 全集本卷三诗诀:天贵申=旺(与移语本「庙」分歧,两口径必须可区分)
    assert by_branch[B["申"]].brightness.get("天貴") == "旺"
    assert c.brightness_school == "quanji"


def test_brightness_tables_disagree_as_documented():
    # 两古籍口径确有分歧(计划所记):天贵移语 7 庙 vs 全集 1 庙 2 旺;文昌移语寅午戌 vs 全集寅午。
    assert set(CETIAN_BRIGHTNESS_TABLE_YIYU["天貴"].keys()) == {0, 2, 3, 4, 5, 8, 11}
    assert set(CETIAN_BRIGHTNESS_TABLE["天貴"].keys()) == {4, 2, 8}
    assert set(CETIAN_BRIGHTNESS_TABLE_YIYU["文昌"].keys()) == {2, 6, 10}


def test_star_lore_complete():
    # 十九星志全覆盖:阴阳必为阴/阳,别名非空,统属两版齐备。
    assert len(CETIAN_STAR_LORE) == 19
    for star, lore in CETIAN_STAR_LORE.items():
        assert lore["yinyang"] in ("陰", "陽"), star
        assert lore["aliases"], star
        assert "subordinates" in lore and "subordinates_rev" in lore, star


def test_kentang_unaffected_by_book_modes():
    # 原法(kentang)对书法口径参数完全免疫:传什么口径结果都一致。
    a = _chart(method="kentang")
    b_ = _chart(method="kentang", shen_gong_mode="literal", daxian_mode="legacy",
                brightness_school="quanji")
    assert a.ming_gong_branch == b_.ming_gong_branch
    assert a.shen_gong_branch == b_.shen_gong_branch
    assert [p.da_xian for p in a.palaces] == [p.da_xian for p in b_.palaces]
    assert [p.brightness for p in a.palaces] == [p.brightness for p in b_.palaces]
    assert a.shen_gong_mode == "yizheng" and a.daxian_mode == "yiyu"
