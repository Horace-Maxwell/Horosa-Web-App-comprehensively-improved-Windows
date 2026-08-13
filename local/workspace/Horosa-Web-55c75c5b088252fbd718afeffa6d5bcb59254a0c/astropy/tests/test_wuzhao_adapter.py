# -*- coding: utf-8 -*-
"""五兆适配层回归锁 —— 起兆八法、参数归一、全年份域、段契约。

不起 HTTP：直接调适配层的纯函数与 _calculate/_build_classic/_build_sections，
故可在 CI 无服务时跑。真跑 HTTP 的全组合矩阵另在压测脚本中。
"""

import os
import random
import sys

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ASTROPY = os.path.abspath(os.path.join(_HERE, ".."))
if _ASTROPY not in sys.path:
    sys.path.insert(0, _ASTROPY)

from websrv import webwuzhaosrv as S  # noqa: E402

LEGACY9 = ["起盘", "揲筮", "兆", "木乡", "火乡", "土乡", "金乡", "水乡", "特殊标记"]
NEW6 = ["断辞", "君子小人", "纳甲", "神煞", "行神", "类占"]
LEGACY_KEYS = ["qipan", "shishi", "zhao", "muxiang", "huoxiang", "tuxiang",
               "jinxiang", "shuixiang", "flags"]


def _pan(**data):
    """跑一遍适配层主流程，返回 normalized（不经 HTTP）。"""
    year = S._to_int(data.get("year"), 2026)
    month = S._to_int(data.get("month"), 8)
    day = S._to_int(data.get("day"), 11)
    hour = S._to_int(data.get("hour"), 10)
    minute = S._to_int(data.get("minute"), 30)
    mode = S._clean_text(data.get("mode"), "ganzhi")
    if mode not in S.MODE_LABELS:
        mode = "ganzhi"
    number = max(0, min(90, S._to_int(data.get("number"), 0)))
    if number > 9:
        number = number % 9
    manual_splits = S._manual_splits(data)
    extras = S._extras(data)
    ganzhi = S._json_safe(S.wuzhao_config.gangzhi(year, month, day, hour, minute, 1, 1))
    solar_term = S.wuzhao_jieqi.jq(year, month, day, hour, minute)
    lunar = S._json_safe(S.wuzhao_config.lunar_date_d(year, month, day))
    lunar_month = S._clean_text(lunar.get("農曆月", ""))[0] if lunar.get("農曆月") else "正"
    raw, upper, lower, detail = S._calculate(
        mode, ganzhi, number, solar_term, lunar_month, manual_splits, extras)
    raw = S._json_safe(raw)
    positions = S._normalize_positions(raw)
    payload = {
        "ganzhi": {"year": ganzhi[0], "month": ganzhi[1], "day": ganzhi[2],
                   "hour": ganzhi[3], "minute": ganzhi[4]},
        "dateStr": "", "timeStr": "", "modeLabel": S.MODE_LABELS[mode], "number": number,
        "solarTerm": solar_term, "lunarDate": {"text": ""},
        "manual": bool(manual_splits), "manualSplits": manual_splits or [],
        "upperGanzhi": upper, "lowerGanzhi": lower,
    }
    classic = S._build_classic(payload, raw, ganzhi, solar_term, lunar, extras)
    sections = S._build_sections(payload, positions)
    sections.extend(S._classic_rows(classic))
    payload["sections"] = sections
    payload["snapshot"] = S._build_snapshot(payload)
    payload["positions"] = positions
    payload["classic"] = classic
    payload["shifaDetail"] = detail
    payload.update(extras)
    return payload


# ---------------------------------------------------------------------------
# 一、起兆八法
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mode", list(S.MODE_LABELS.keys()))
def test_all_modes_produce_six_positions(mode):
    """八法皆出六位，五行合法、卜数 1-5。"""
    extra = {}
    if mode == "zhushu":
        extra["zhaoNums"] = [4, 3, 2, 2, 2, 1]
    if mode == "qian":
        extra["qianAuto"] = False
        extra["qianThrows"] = [1, 2, 3, 3, 3, 4]
    p = _pan(mode=mode, **extra)
    assert len(p["positions"]) == 6
    for item in p["positions"]:
        assert item["element"] in ("水", "火", "木", "金", "土")
        assert 1 <= int(item["number"]) <= 5


def test_qian_ke_mapping_matches_document_example():
    """以钱代筮：撒币木土金金金火 → 成卦金木火火火水（今传操作法例）。"""
    nums, rows = S._qian_shifa([1, 2, 3, 3, 3, 4], False, random.Random(0))
    assert [r["coinElement"] for r in rows] == ["木", "土", "金", "金", "金", "火"]
    assert [r["element"] for r in rows] == ["金", "木", "火", "火", "火", "水"]


@pytest.mark.parametrize("variant,expect", [
    ("guayi", {0: 1, 5: 2, 10: 3, 15: 4, 20: 5}),      # 挂一回加：0策水…20策土
    ("jiaolu", {0: 5, 5: 1, 10: 2, 15: 3, 20: 4}),     # 校录原案：0策土…20策金
])
def test_dunhuang_two_variants(variant, expect):
    """敦煌校录揲筮：剩策域恒 {0,5,10,15,20}，两派映射各如其表。"""
    seen = {}
    for seed in range(200):
        _, rows = S._dunhuang_shifa(variant, random.Random(seed))
        for r in rows:
            seen.setdefault(r["remain"], set()).add(r["num"])
    assert set(seen.keys()) <= {0, 5, 10, 15, 20}
    for remain, num in expect.items():
        if remain in seen:
            assert seen[remain] == {num}, (variant, remain)


def test_zhushu_direct_input():
    p = _pan(mode="zhushu", zhaoNums=[4, 3, 2, 2, 2, 1])
    assert [x["element"] for x in p["positions"]] == ["金", "木", "火", "火", "火", "水"]


# ---------------------------------------------------------------------------
# 二、参数归一（非法/越界/空值一律归默认，绝不抛）
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("data,key,want", [
    ({"shifaVariant": "bogus"}, "shifaVariant", "guayi"),
    ({"shifaVariant": ""}, "shifaVariant", "guayi"),
    ({"shifaVariant": "jiaolu"}, "shifaVariant", "jiaolu"),
    ({"xingshenMonth": "bogus"}, "xingshenMonth", "lunar"),
    ({"xingshenMonth": "jieqi"}, "xingshenMonth", "jieqi"),
    ({"mingZhi": "甲"}, "mingZhi", ""),
    ({"mingZhi": "亥"}, "mingZhi", "亥"),
    ({"gender": "other"}, "gender", ""),
    ({"gender": "female"}, "gender", "female"),
])
def test_extras_normalization(data, key, want):
    assert S._extras(data)[key] == want


@pytest.mark.parametrize("raw,want", [
    ([0, 9, 3, 3, 3, 3], [1, 5, 3, 3, 3, 3]),   # 越界钳位
    ([3, 3], [3, 3]),                            # 短数组原样（消费端补齐）
    ([], []),
    ("x", []),                                   # 非数组：不逐字符切
    ({"a": 1}, []),
    (None, []),
])
def test_zhao_nums_clamp(raw, want):
    assert S._extras({"zhaoNums": raw})["zhaoNums"] == want


@pytest.mark.parametrize("raw,want", [
    ([9, -3, 2, 2, 2, 2], [4, 0, 2, 2, 2, 2]),
    ([], []),
    ("x", []),
    ({"a": 1}, []),
])
def test_qian_throws_clamp(raw, want):
    assert S._extras({"qianThrows": raw})["qianThrows"] == want


def test_manual_splits_rejects_non_list():
    """非列表(字符串/字典)不得被逐字符切片,一律视作未给。"""
    assert S._manual_splits({"manual": True, "manualSplits": "abc"}) == [1] * 6
    assert S._manual_splits({"manual": True, "manualSplits": {"a": 1}}) == [1] * 6
    assert S._manual_splits({"manual": False, "manualSplits": [1] * 6}) is None


def test_short_arrays_do_not_crash():
    """短数组/空数组下六位仍完整（消费端补默认）。"""
    for data in ({"mode": "zhushu", "zhaoNums": [3, 3]},
                 {"mode": "zhushu", "zhaoNums": []},
                 {"mode": "qian", "qianAuto": False, "qianThrows": []},
                 {"mode": "tang", "manual": True, "manualSplits": [1, 2]}):
        p = _pan(**data)
        assert len(p["positions"]) == 6


# ---------------------------------------------------------------------------
# 三、全年份域（🔴 BC 曾因 kin_year_domain 不在 path 而整盘 500）
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("year", [-3000, -500, -1, 1, 1900, 2026, 9999])
def test_full_year_domain(year):
    """公元前与极端年皆出完整盘：vendor 在 year<1/>9999 时延迟 import
    kin_year_domain，适配层须预载之，否则请求期 ModuleNotFoundError。"""
    p = _pan(year=year, month=6, day=15, mode="zhushu", zhaoNums=[3] * 6)
    assert len(p["positions"]) == 6
    assert p["classic"] is not None
    for pillar in ("year", "month", "day", "hour"):
        assert len(p["ganzhi"][pillar]) == 2, (year, pillar)


def test_year_domain_module_preloaded():
    assert "kin_year_domain" in sys.modules


# ---------------------------------------------------------------------------
# 四、段契约（既有九段只增不改 + 逐段带 key + 快照洁净）
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mode", ["ganzhi", "zhushu", "qian", "dunhuang", "tang", "day"])
def test_section_contract(mode):
    extra = {}
    if mode == "zhushu":
        extra["zhaoNums"] = [4, 3, 2, 2, 2, 1]
    if mode == "qian":
        extra["qianAuto"] = False
        extra["qianThrows"] = [1, 2, 3, 3, 3, 4]
    p = _pan(mode=mode, **extra)
    titles = [s["title"] for s in p["sections"]]
    assert titles[:9] == LEGACY9
    assert [s["key"] for s in p["sections"][:9]] == LEGACY_KEYS
    for t in NEW6:
        assert t in titles
    for s in p["sections"]:
        assert s.get("key")
    snap = p["snapshot"]
    for t in LEGACY9 + NEW6:
        assert "[%s]" % t in snap
    assert "undefined" not in snap
    assert "NaN" not in snap


def test_shifa_detail_only_for_new_modes():
    assert _pan(mode="ganzhi")["shifaDetail"] is None
    assert _pan(mode="tang")["shifaDetail"] is None
    assert _pan(mode="qian", qianAuto=False,
                qianThrows=[1, 2, 3, 3, 3, 4])["shifaDetail"]["kind"] == "qian"
    assert _pan(mode="dunhuang")["shifaDetail"]["kind"] == "dunhuang"
    assert _pan(mode="zhushu", zhaoNums=[3] * 6)["shifaDetail"]["kind"] == "zhushu"


# ---------------------------------------------------------------------------
# 五、断法档位真实生效（死开关实证）
# ---------------------------------------------------------------------------

def test_xingshen_month_changes_rows():
    a = _pan(mode="zhushu", zhaoNums=[4, 3, 2, 2, 2, 1], xingshenMonth="lunar")
    b = _pan(mode="zhushu", zhaoNums=[4, 3, 2, 2, 2, 1], xingshenMonth="jieqi")
    ra = [(r["beast"], r["branch"]) for r in a["classic"]["xingshen"]["rows"]]
    rb = [(r["beast"], r["branch"]) for r in b["classic"]["xingshen"]["rows"]]
    assert ra != rb or a["classic"]["monthNum"] == b["classic"]["monthNum"]


def test_ming_zhi_and_gender_gate_xingnian():
    """年命支留空则不出行年年立；给了则出，且男女异。"""
    base = dict(mode="zhushu", zhaoNums=[4, 3, 2, 2, 2, 1])
    none = _pan(**base)
    names = [i["name"] for i in none["classic"]["shensha"]["items"]]
    assert "行年" not in names and "年立" not in names

    male = _pan(**base, mingZhi="亥", gender="male")
    female = _pan(**base, mingZhi="亥", gender="female")
    for p in (male, female):
        n = [i["name"] for i in p["classic"]["shensha"]["items"]]
        assert "行年" in n and "年立" in n
    get = lambda p, k: [i["branch"] for i in p["classic"]["shensha"]["items"] if i["name"] == k][0]
    assert get(male, "行年") != get(female, "行年")


def test_number_equivalence_classes():
    """干支法对总和取五为模 → 报数 0-9 恰得五个相异之盘（n ≡ n+5）。"""
    sigs = {}
    for n in range(10):
        p = _pan(mode="ganzhi", number=n)
        sigs[n] = "".join(x["element"] for x in p["positions"])
    for n in range(5):
        assert sigs[n] == sigs[n + 5], n
    assert len(set(sigs.values())) == 5
