# -*- coding: utf-8 -*-
"""策天飞星·移语本流年飞星/神煞金标。

岁数法金标出自「起外缠诸星例」四十四岁全套实例:杖酉异卯耗子刃午刑寅姚午。
"""

from astrostudy.cetian_yiyu import compute_liunian, compute_shensha, compute_bianyao

B = "子丑寅卯辰巳午未申酉戌亥"


def test_qisha_suishu_44_golden():
    # 生年使虚岁=44:流年-生年+1=44 → 生年=流年-43。取流年 2003(未),生年 1960。
    r = compute_liunian(2003, 1960, hour_branch=0, qisha_mode="suishu")
    assert r["xu_sui"] == 44
    q = r["qisha"]
    assert B[q["天杖"]] == "酉"
    assert B[q["天異"]] == "卯"
    assert B[q["毛頭"]] == "子"
    assert B[q["天刃"]] == "午"
    assert B[q["天刑"]] == "寅"
    assert B[q["天姚"]] == "午"


def test_qisha_shengshi_self_consistent():
    # 生时法:杖异对冲、耗刃对冲(飞星赋「对冲安异/对冲安刃」)。
    r = compute_liunian(2026, 1990, hour_branch=7, qisha_mode="shengshi")
    q = r["qisha"]
    assert (q["天杖"] + 6) % 12 == q["天異"]
    assert (q["毛頭"] + 6) % 12 == q["天刃"]
    # 生时=流年支时:步数0,杖在寅、耗在巳、刑在酉、姚在丑(本位)。
    lyb = r["branch"]
    r0 = compute_liunian(2026, 1990, hour_branch=lyb, qisha_mode="shengshi")
    assert B[r0["qisha"]["天杖"]] == "寅"
    assert B[r0["qisha"]["毛頭"]] == "巳"
    assert B[r0["qisha"]["天刑"]] == "酉"
    assert B[r0["qisha"]["天姚"]] == "丑"


def test_zhuxu_liunian_from_taisui_next():
    # 主序:流年太岁前一宫(顺次一位)起库逆布。子年(如 2020):库丑贯子文亥福戌禄酉紫申虚未贵午印巳寿辰空卯红寅。
    r = compute_liunian(2020, 1990, hour_branch=0)
    assert B[r["branch"]] == "子"
    z = r["zhuxu"]
    assert B[z["天庫"]] == "丑" and B[z["天貫"]] == "子" and B[z["文昌"]] == "亥"
    assert B[z["紫微"]] == "申" and B[z["紅鸞"]] == "寅"


def test_liunian_hongluan_tianxi_santai_bazuo():
    # 子年:红鸾卯天喜酉(卯头起子逆流行,对照天喜);三台辰起子顺=辰,八座戌起子逆=戌。
    r = compute_liunian(2020, 1990, hour_branch=0)
    assert B[r["hongluan"]] == "卯" and B[r["tianxi"]] == "酉"
    assert B[r["santai"]] == "辰" and B[r["bazuo"]] == "戌"
    # 小哭=流年太岁六合:子丑合 → 丑。
    assert B[r["xiaoku"]] == "丑"


def test_shiqi_feixing_order():
    # 十七飞星从太岁宫逆推一宫一位:第1天刑在太岁,第2天库在太岁-1。
    r = compute_liunian(2020, 1990, hour_branch=0)
    s = r["shiqi"]
    assert s[0]["star"] == "天刑" and s[0]["branch"] == r["branch"]
    assert s[1]["star"] == "天庫" and s[1]["branch"] == (r["branch"] - 1) % 12
    assert len(s) == 18


def test_shensha_tables():
    # 子年流年:岁前太岁剑锋在子、病符陌越在亥;岁后红鸾卯。甲年干:禄存寅羊刃卯飞刃酉。生月正月:官符午。
    s = compute_shensha(liunian_branch=0, liunian_stem=0, year_stem=0, lunar_month=1)
    sq = {it["name"]: it["branch"] for it in s["suiqian"]}
    assert B[sq["太歲劍鋒"]] == "子" and B[sq["病符陌越"]] == "亥"
    sh = {it["name"]: it["branch"] for it in s["suihou"]}
    assert B[sh["紅鸞"]] == "卯" and B[sh["天喜"]] == "酉"
    ng = {it["name"]: it["branch"] for it in s["niangan_benming"]}
    assert B[ng["祿存"]] == "寅" and B[ng["羊刃"]] == "卯" and B[ng["飛刃"]] == "酉"
    ys = {it["name"]: it["branch"] for it in s["yuesha"]}
    assert B[ys["官符"]] == "午"


def test_bianyao_jia_year():
    # 甲年:禄=火;推贵:禄起数至贵第六,火起数至第六是阴 → 阴(太阴)化贵。
    b = compute_bianyao(year_stem=0, liunian_stem=1)
    ben = {it["bianyao"]: it["yao"] for it in b["benming"]}
    assert ben["祿"] == "火" and ben["貴"] == "陰"
    assert {it["bianyao"] for it in b["benming"] if it["xiong"]} == {"暗", "耗", "刑", "囚"}
    assert len(b["guanxing"]) == 12
