# -*- coding: utf-8 -*-
"""策天飞星·移语本杂曜/会照/运限/断诀金标(引证图命例:乙卯冬月廿七戌时=1975-12-29 20:00)。

引证图杂曜:龙池寅 凤阁申 三台寅 八座子 天罗辰 地网戌(盘面逐格可辨)。
身宫曰互证:「身宫库卯横…又坐男女宫」→宫坐星断(卯,天库)与身入男女宫论必须命中。
"""

import pytest

from astrostudy.cetian_ziwei import compute_cetian_ziwei_chart
from astrostudy.cetian_yiyu import (
    compute_huizhao,
    compute_xiu,
    compute_yunxian,
    compute_zayao,
    match_duanjue,
)

B = "子丑寅卯辰巳午未申酉戌亥"


@pytest.fixture(scope="module")
def chart():
    return compute_cetian_ziwei_chart(
        1975, 12, 29, 20, 0, 8.0, 26.0667, 119.3167, "引证图", "男")


@pytest.fixture(scope="module")
def palace_dicts(chart):
    return [{
        "branch": p.branch, "name": p.name, "stars": list(p.stars),
        "aux_stars": list(p.aux_stars), "da_xian_start": p.da_xian_start,
    } for p in chart.palaces]


@pytest.fixture(scope="module")
def zayao(chart):
    z, _notes = compute_zayao(
        chart.lunar_year_branch, chart.lunar_year_stem, chart.lunar_month,
        chart.lunar_day, chart.hour_branch, chart.shen_gong_branch)
    return z


def test_zayao_yizheng_golden(zayao):
    assert B[zayao["龍池"]] == "寅"
    assert B[zayao["鳳閣"]] == "申"
    assert B[zayao["三台"]] == "寅"
    assert B[zayao["八座"]] == "子"
    assert B[zayao["天羅"]] == "辰"
    assert B[zayao["地網"]] == "戌"


def test_zayao_others(zayao):
    # 乙卯年:驿马巳(亥卯未);天解未(戌起子逆至卯);天德子(酉起子顺至卯);禄存卯(乙)羊刃辰飞刃戌。
    assert B[zayao["驛馬"]] == "巳" and B[zayao["退方"]] == "午" and B[zayao["攀鞍"]] == "辰"
    assert B[zayao["天解"]] == "未" and B[zayao["天德"]] == "子" and B[zayao["月德"]] == "丑"
    assert B[zayao["祿存"]] == "卯" and B[zayao["羊刃"]] == "辰" and B[zayao["飛刃"]] == "戌"
    # 唐符=禄前第八位(卯+7=戌),国印第九位(亥);西没十一月=申。
    assert B[zayao["唐符"]] == "戌" and B[zayao["國印"]] == "亥"
    assert B[zayao["西沒"]] == "申"
    # 台辅=身(卯)前一宫辰,三日住=寅。
    assert B[zayao["台輔"]] == "辰" and B[zayao["三日住"]] == "寅"


def test_zayao_tianluo_zhongtian_mode(chart):
    # 中天太极法:天罗=辰+月+时(4+10+10=24%12=子),地网=(10-10-10)%12=(-10)%12=寅 → 与本书法必分歧。
    z2, _ = compute_zayao(
        chart.lunar_year_branch, chart.lunar_year_stem, chart.lunar_month,
        chart.lunar_day, chart.hour_branch, chart.shen_gong_branch,
        tianluo_mode="zhongtian")
    assert B[z2["天羅"]] == "子" and B[z2["地網"]] == "寅"
    assert z2["天羅"] != 4  # 与本书法(辰)分歧,选项必须可区分


def test_huizhao(chart):
    # 命未:四正=丑辰未戌,三合=卯未亥,对照=丑。
    h = compute_huizhao(chart.ming_gong_branch, chart.shen_gong_branch)
    assert sorted(B[x] for x in h["sizheng"]) == sorted(["丑", "辰", "未", "戌"])
    assert sorted(B[x] for x in h["sanhe"]) == sorted(["卯", "未", "亥"])
    assert B[h["duizhao"]] == "丑"
    assert "身宮所在" in h["per_palace"][3]


def test_xiu(chart):
    # 1975-12-29 太阳黄经约 276.8°(冬至后) → 斗木獬(275.24~300.19)。三日宫=命未±2:前酉后巳。
    x = compute_xiu(chart.julian_day, chart.ming_gong_branch, chart.shen_gong_branch)
    assert x["sun_xiu"] == "斗木獬"
    assert B[x["qian_sanri_gong"]] == "酉" and B[x["hou_sanri_gong"]] == "巳"
    assert x["ming_fenye"]["sign"] == "巨蟹" and x["shen_fenye"]["guo"] == "宋"


def test_yunxian_xian_names(chart, palace_dicts):
    # 阴年男从身(卯)逆行:12-21寅贯限、22-31丑文限、32-41子福限、42-51亥禄限、52-61戌紫限。
    y = compute_yunxian(palace_dicts, chart.ming_gong_branch, chart.shen_gong_branch,
                        chart.lunar_year_branch, is_shun=False,
                        start_branch=chart.shen_gong_branch)
    by_start = {d["start"]: d for d in y["daxian"]}
    assert by_start[11]["branch_name"] == "寅" and by_start[11]["xian_name"] == "貫限"
    assert by_start[21]["xian_name"] == "文限"
    assert by_start[31]["xian_name"] == "福限"
    assert by_start[41]["xian_name"] == "祿限"
    assert by_start[51]["xian_name"] == "紫限"
    # 五行步位(逆行):首限本位,二火三土四金五木六水。
    assert by_start[1]["buwei"] == "本位" and by_start[11]["buwei"] == "火"
    assert by_start[21]["buwei"] == "土" and by_start[51]["buwei"] == "水"


def test_yunxian_tongxian_and_jixian(chart, palace_dicts):
    y = compute_yunxian(palace_dicts, chart.ming_gong_branch, chart.shen_gong_branch,
                        chart.lunar_year_branch, is_shun=False,
                        start_branch=chart.shen_gong_branch)
    tong = {t["age"]: t for t in y["tongxian"]}
    # 命未:1命未 2财午 3疾子 4妻丑 5福酉;6官戌 7福酉 …15妻丑。
    assert tong[1]["branch_name"] == "未" and tong[2]["branch_name"] == "午"
    assert tong[3]["palace"] == "疾厄宮" and tong[3]["branch_name"] == "子"
    assert tong[6]["palace"] == "官祿宮" and tong[6]["branch_name"] == "戌"
    assert tong[15]["palace"] == "妻妾宮" and tong[15]["branch_name"] == "丑"
    # 卯生人忌巳限。
    assert [j["branch_name"] for j in y["jixian"]] == ["巳"]
    # 凶限歌:命未=刑刃条,刑坐命+刃在三合亥 → 会照命宫级命中。
    assert y["xiongxian"] and y["xiongxian"][0]["hit"] in ("坐命", "會照命宮")


def test_duanjue_hits(chart, palace_dicts, zayao):
    hits = match_duanjue(palace_dicts, chart.ming_gong_branch, chart.shen_gong_branch, zayao)
    keys = {(h["group"], h["title"]) for h in hits}
    # 引证图「身宫曰:身宫库卯横…又坐男女宫」→ 宫坐星断(身在卯·天库)与身宫吉凶论(男女宫)必中。
    assert ("宮坐星斷", "身在卯·天庫") in keys
    assert any(g == "身宮吉凶論" and "男女宮" in t for g, t in keys)
    # 命宫天印/天刑单星断(所临星论二·命宫)必中。
    assert any(g == "所臨星論" and t == "命宮·天印" for g, t in keys)
    assert any(g == "所臨星論" and t == "命宮·天刑" for g, t in keys)
    # 太元赋:天库在卯得宜(库贵宜卯巳午未亥)。
    assert any(g == "太元賦" and t.startswith("天庫·卯宮") for g, t in keys)
    # 诸星格:19 星中 17 星有宫断(姚哭缺),库卯断文含「纵横妙用」。
    ge_hits = [h for h in hits if h["group"] == "諸星格"]
    assert len(ge_hits) >= 15
    ku = next(h for h in ge_hits if h["title"].startswith("天庫"))
    assert "縱橫妙用" in ku["text"]
    # 反例:命宫无紫微,「命宫·紫微」不得命中;金镜图紫微条(申子亥)不得中(紫在戌)。
    assert not any(g == "所臨星論" and t == "命宮·紫微" for g, t in keys)
    assert not any(g == "金鏡圖" and "紫微" in t for g, t in keys)
