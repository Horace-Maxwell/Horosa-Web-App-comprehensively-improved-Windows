"""七政(kin)快照「年限」段的当前大限:写成一行人话,不再把字典字段名原样塞进快照。"""
from websrv.webqizhengkinsrv import _fmt_current_daxian


def test_snake_case_dict_formats_to_one_line():
    cur = {"palace_index": 1, "branch": 7, "branch_name": "未", "palace_name": "财帛宫", "lord": "太阴",
           "years": 25, "start_age": 20, "end_age": 44, "start_year": 2010, "end_year": 2034}
    assert _fmt_current_daxian(cur) == "财帛宫(未) · 限主太阴 · 20–44 岁(2010–2034)"


def test_camel_case_and_partial_fields():
    assert _fmt_current_daxian({"palaceName": "命宫", "branchName": "申", "startAge": 0, "endAge": 19}) == "命宫(申) · 0–19 岁"
    assert _fmt_current_daxian({"lord": "水星"}) == "限主水星"


def test_no_field_names_leak_and_non_dict_passthrough():
    out = _fmt_current_daxian({"palace_index": 3, "branch": 5, "palace_name": "田宅宫", "branch_name": "巳", "lord": "水星", "start_age": 64, "end_age": 83})
    assert "palace_index" not in out and "branch" not in out
    assert _fmt_current_daxian(None) is None
    assert _fmt_current_daxian("已过诸限") == "已过诸限"
    assert _fmt_current_daxian({}) == "—"
