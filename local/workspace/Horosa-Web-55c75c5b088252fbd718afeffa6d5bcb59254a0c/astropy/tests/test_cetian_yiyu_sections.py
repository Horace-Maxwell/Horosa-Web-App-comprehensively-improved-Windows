# -*- coding: utf-8 -*-
"""策天飞星·移语本服务层段组装冒烟(离线直调 _build_sections 管线,不起 CherryPy)。

覆盖:书法新段全集/开关过滤/僧道宫名显示层替换/kentang 零触碰。
"""

import json

import pytest

from astrostudy.cetian_ziwei import compute_cetian_ziwei_chart
from astrostudy.cetian_yiyu import (
    collect_xingge_verses, compute_bianyao, compute_huizhao, compute_liunian,
    compute_nayin, compute_shensha, compute_xiu, compute_yinyang_gong,
    compute_yunxian, compute_zayao, match_duanjue, ruyuan_month_row,
)
from astrostudy.cetian_ziwei import CETIAN_STAR_LORE
from websrv.webcetiansrv import MONK_PALACE_NAMES, _build_sections, _build_yiyu_sections


def _mk_pan(method="book", **kw):
    chart_obj = compute_cetian_ziwei_chart(
        1975, 12, 29, 20, 0, 8.0, 26.0667, 119.3167, "x", "男", method=method, **kw)
    chart = json.loads(json.dumps(chart_obj, default=lambda o: o.__dict__))
    pan = {"cetian": chart, "lunar": {"text": "乙卯冬月廿七"}, "hourBranch": "戌時",
           "mingGong": "未宫", "shenGong": "卯宫", "ziwei": "戌宫",
           "dateStr": "1975-12-29", "timeStr": "20:00:00", "timezone": 8.0,
           "longitude": 119.3167, "latitude": 26.0667, "location": "x"}
    return pan, chart


def _mk_yiyu(chart, liunian_year=2026, qisha_mode="shengshi", tianluo_mode="benshu"):
    palaces = chart["palaces"]
    ming_b, shen_b = chart["ming_gong_branch"], chart["shen_gong_branch"]
    year_b, year_s, hour_b = chart["lunar_year_branch"], chart["lunar_year_stem"], chart["hour_branch"]
    zayao, notes = compute_zayao(year_b, year_s, chart["lunar_month"], chart["lunar_day"],
                                 hour_b, shen_b, tianluo_mode=tianluo_mode)
    liunian = compute_liunian(liunian_year, chart["lunar_year"], hour_b, qisha_mode=qisha_mode)
    shensha = compute_shensha(liunian["branch"], liunian["stem"], year_s, chart["lunar_month"])
    huizhao = compute_huizhao(ming_b, shen_b)
    xiu = compute_xiu(chart["julian_day"], ming_b, shen_b)
    yunxian = compute_yunxian(palaces, ming_b, shen_b, year_b, False, shen_b)
    bianyao = compute_bianyao(year_s, liunian["stem"])
    duanjue = match_duanjue(palaces, ming_b, shen_b, zayao)
    return {"zayao": zayao, "zayao_notes": notes, "liunian": liunian, "shensha": shensha,
            "huizhao": huizhao, "xiu": xiu, "yunxian": yunxian, "bianyao": bianyao,
            "duanjue": duanjue, "ruyuan_month": ruyuan_month_row(chart["lunar_month"]),
            "yinyang_gong": compute_yinyang_gong(palaces, CETIAN_STAR_LORE),
            "nayin": compute_nayin(year_s, year_b),
            "xingge_verses": collect_xingge_verses(palaces)}


ALL_ON = {"liunian": True, "shensha": True, "zayao": True, "duanjue": True, "xiu": True, "bianyao": True}


def test_book_sections_full():
    pan, chart = _mk_pan()
    yiyu = _mk_yiyu(chart)
    sections = _build_sections(pan, yiyu=yiyu, show_yiyu=ALL_ON)
    titles = [s["title"] for s in sections]
    for need in ["起盘", "农历与命身", "运限", "童限", "凶限提示", "会照", "流年飞星", "流年七煞",
                 "十七飞星", "神煞·岁前", "神煞·岁后", "神煞·年干", "神煞·月煞", "三日宫",
                 "廿八宿分野", "十干变曜", "杂曜", "断诀", "星曜别名", "命宮", "三合组",
                 "阴阳宫", "星解与运限歌"]:
        assert need in titles, f"缺段:{need}"
    # 运限段 12 限行+步位诀。
    yx = next(s for s in sections if s["title"] == "运限")
    assert len(yx["rows"]) == 13
    assert any("禄限" in str(r.get("value")) for r in yx["rows"])  # row() 层繁→简归一


def test_book_sections_switch_filter():
    pan, chart = _mk_pan()
    yiyu = _mk_yiyu(chart)
    off = dict(ALL_ON, liunian=False, shensha=False, bianyao=False, xiu=False, zayao=False, duanjue=False)
    sections = _build_sections(pan, yiyu=yiyu, show_yiyu=off)
    titles = [s["title"] for s in sections]
    for gone in ["流年飞星", "流年七煞", "十七飞星", "神煞·岁前", "神煞·月煞", "三日宫",
                 "廿八宿分野", "十干变曜", "杂曜", "断诀"]:
        assert gone not in titles, f"开关未生效:{gone}"
    # 恒出段不受影响。
    for keep in ["运限", "童限", "会照", "星曜别名"]:
        assert keep in titles


def test_palace_rows_carry_yiyu_extra():
    pan, chart = _mk_pan()
    yiyu = _mk_yiyu(chart)
    zayao_by_branch = {}
    for name, b in yiyu["zayao"].items():
        zayao_by_branch.setdefault(b, []).append(name)
    liunian_by_branch = {}
    for name, b in list(yiyu["liunian"]["zhuxu"].items()) + list(yiyu["liunian"]["qisha"].items()):
        liunian_by_branch.setdefault(b, []).append(name)
    extra = {"zayao_by_branch": zayao_by_branch, "liunian_by_branch": liunian_by_branch,
             "huizhao_per_palace": yiyu["huizhao"]["per_palace"],
             "xian_by_branch": {d["branch"]: d for d in yiyu["yunxian"]["daxian"]}}
    sections = _build_sections(pan, yiyu=yiyu, palace_extra=extra, show_yiyu=ALL_ON)
    ming = next(s for s in sections if s["title"] == "命宮")
    labels = [r.get("label") for r in ming["rows"]]
    assert "杂曜" in labels and "流年" in labels and "会照" in labels
    daxian_row = next(r for r in ming["rows"] if r.get("label") == "大限")
    assert "限" in str(daxian_row.get("value")) and "步位" in str(daxian_row.get("value"))


def test_kentang_untouched():
    pan, chart = _mk_pan(method="kentang")
    sections = _build_sections(pan, yiyu=None, palace_extra=None, show_yiyu=None)
    titles = [s["title"] for s in sections]
    assert "四化" in titles and "飞星" in titles
    for absent in ["运限", "杂曜", "断诀", "流年飞星", "星曜别名"]:
        assert absent not in titles
    ming = next(s for s in sections if s["title"] == "命宮")
    assert not any(r.get("label") in ("杂曜", "流年", "会照") for r in ming["rows"])


def test_monk_palace_names_mapping():
    assert MONK_PALACE_NAMES[0] == "命宮" and MONK_PALACE_NAMES[1] == "衣鉢宮"
    assert MONK_PALACE_NAMES[7] == "疾厄宮" and MONK_PALACE_NAMES[11] == "相品宮"
    assert len(MONK_PALACE_NAMES) == 12


def test_yiyu_sections_duanjue_texts_present():
    pan, chart = _mk_pan()
    yiyu = _mk_yiyu(chart)
    secs = _build_yiyu_sections(chart, yiyu, ALL_ON)
    dj = next(s for s in secs if s["title"] == "断诀")
    assert len(dj["rows"]) >= 20
    lore = next(s for s in secs if s["title"] == "星曜别名")
    assert len(lore["rows"]) == 19


def test_yiyu_gap_closure_yinyang_nayin_verses():
    """计划 gap A8/A9/C7 补齐:阴阳宫判定 / 生年纳音 / 诸星格星解与运限歌。"""
    pan, chart = _mk_pan()
    yiyu = _mk_yiyu(chart)
    sections = _build_sections(pan, yiyu=yiyu, show_yiyu=ALL_ON)
    titles = [s["title"] for s in sections]
    assert "阴阳宫" in titles and "星解与运限歌" in titles
    # A8:十九星逐星判定,同阴阳=福重灾轻
    yy = yiyu["yinyang_gong"]
    assert len(yy["items"]) == 19
    for it in yy["items"]:
        same = it["yinyang"] == it["gong_yinyang"]
        assert it["verdict"] == ("福重災輕" if same else "福輕災重")
    # A9:乙卯年纳音=水(原书 p11)
    assert yiyu["nayin"] == {"ganzhi": "乙卯", "wuxing": "水"}
    ms = next(s for s in sections if s["title"] == "农历与命身")
    assert any(r.get("label") == "纳音" for r in ms["rows"])
    # C7:诸星格 19 格的星解/运限歌按落宫取出
    assert len(yiyu["xingge_verses"]) == 19
    assert all(v["jie"] for v in yiyu["xingge_verses"])
