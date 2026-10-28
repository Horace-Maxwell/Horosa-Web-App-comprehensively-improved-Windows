"""玄史检索:一个关键词带几种写法(q + q_any),任一写法命中即算。

库里简繁混存(史书原文多繁体,标题 / 白话多简体)。后端自己补全简体归一与繁体写法,前端也可另发写法
(q_any),两边取并集;后端按「任一写法」过滤。检索词没有简繁不同形的字时,行为与只按原词检索逐字节相同。
"""

import json

import pytest

from astrostudy.xuanshi import celestial as xs_celestial
from astrostudy.xuanshi import editorial as xs_editorial
from astrostudy.xuanshi import queries as xs_queries
from astrostudy.xuanshi import textquery


# ============================================================
# 纯函数
# ============================================================

def test_merge_without_convertible_chars_is_identity():
    # 检索词里没有简繁不同形的字:与只按原词检索逐字节相同
    assert textquery.merge("abc", None) == "abc"
    assert textquery.merge("abc", []) == "abc"
    assert textquery.merge("天干", None) == "天干"
    assert textquery.merge(None, None) is None
    assert textquery.merge("abc", ["abc", " "]) == "abc"


def test_merge_backend_completes_script_variants():
    # 只发 q 的客户端(无头 / 命令行 / 旧前端):后端自己补简体归一与繁体写法,与页面同口径
    assert textquery.merge("荧惑", None) == ("荧惑", "熒惑")
    assert textquery.merge("熒惑", None) == ("熒惑", "荧惑")
    assert textquery.merge("荧惑", []) == ("荧惑", "熒惑")
    assert textquery.merge(None, ["荧惑"]) == ("荧惑", "熒惑")
    assert "曆法" in textquery.merge("历法", None)
    assert textquery.script_variants("") == []
    assert textquery.script_variants("x" * (textquery.MAX_LEN + 1)) == []


def test_merge_page_and_backend_variants_union():
    # 页面已带 q_any 时:与后端补全取并集、去重,结果不因来源不同而变
    assert textquery.merge("熒惑", ["荧惑", "熒惑"]) == ("熒惑", "荧惑")
    assert textquery.merge("荧惑", ["熒惑"]) == textquery.merge("荧惑", None)


def test_merge_dedups_and_caps():
    many = textquery.merge("a", [f"b{i}" for i in range(20)])
    assert len(many) == textquery.MAX_ALTS
    assert textquery.merge("a", ["x" * (textquery.MAX_LEN + 1)]) == "a"


def test_like_any_single_matches_legacy_sql():
    clause, params = textquery.like_any(["name", "alt_names", "pinyin"], "李淳风")
    assert clause == "(name LIKE ? OR alt_names LIKE ? OR pinyin LIKE ?)"
    assert params == ["%李淳风%"] * 3


def test_like_any_alternatives():
    clause, params = textquery.like_any(["name", "pinyin"], ("李淳風", "李淳风"))
    assert clause == "((name LIKE ? OR pinyin LIKE ?) OR (name LIKE ? OR pinyin LIKE ?))"
    assert params == ["%李淳風%", "%李淳風%", "%李淳风%", "%李淳风%"]


def test_lowered_matches_legacy_normalisation():
    assert textquery.lowered("  ABC ") == ["abc"]
    assert textquery.lowered("") == []
    assert textquery.lowered(None) == []
    assert textquery.lowered(("A", " a ", "")) == ["a"]


# ============================================================
# 过滤:写法元组 = 各写法命中的并集;单个字符串 = 原先结果
# ============================================================

def _ids(rows, key="event_id"):
    return {r[key] for r in rows}


def test_events_union_of_alternatives():
    trad = _ids(xs_queries.filter_events(q="熒惑"))
    simp = _ids(xs_queries.filter_events(q="荧惑"))
    both = _ids(xs_queries.filter_events(q=("熒惑", "荧惑")))
    assert trad and simp and (trad - simp) and (simp - trad)   # 前提:两种写法各有对方搜不到的
    assert both == trad | simp


def test_celestial_union_of_alternatives():
    events = xs_celestial.load_events()
    trad = _ids(xs_celestial.filter_events(events, keyword="熒惑"))
    simp = _ids(xs_celestial.filter_events(events, keyword="荧惑"))
    both = _ids(xs_celestial.filter_events(events, keyword=("熒惑", "荧惑")))
    assert len(trad) > len(simp) > 0   # 史书原文多是繁体:只发简体会丢掉绝大多数
    assert both == trad | simp


def test_figures_alternatives():
    one = xs_editorial.list_figures(status=None, limit=500, q="淳风")
    alt = xs_editorial.list_figures(status=None, limit=500, q=("淳風", "淳风"))
    assert {r["slug"] for r in one} <= {r["slug"] for r in alt}
    assert xs_editorial.count_figures(status=None, q=("淳風", "淳风")) == len(alt)


def test_search_events_accepts_alternatives():
    assert xs_queries.search_events(("熒惑", "荧惑"), limit=5)
    assert xs_queries.search_events(("", " "), limit=5) == []


# ============================================================
# web 端点:q + q_any 合成写法;不带 q_any 原样
# ============================================================

@pytest.fixture(scope="module")
def srv():
    import cherrypy
    from websrv import webxuanshisrv

    class _Req:
        method = "POST"
        params = {}
        json = None

    cherrypy.serving.request = _Req()
    return webxuanshisrv.XuanShiSrv()


def _call(srv, name, body):
    import cherrypy
    cherrypy.serving.request.json = body
    try:
        data = json.loads(getattr(srv, name)())
    finally:
        cherrypy.serving.request.json = None
    assert not (isinstance(data, dict) and "err" in data), data
    return data


def test_query_param_merge():
    from websrv import webxuanshisrv as w
    assert w._query({"q": " abc "}, "q") == "abc"
    assert w._query({"keyword": "", "q": "荧惑"}, "keyword", "q") == ("荧惑", "熒惑")
    assert w._query({"q": "熒惑", "q_any": ["荧惑"]}, "q") == ("熒惑", "荧惑")
    assert w._query({}, "q") is None


def test_endpoint_celestial_q_only_matches_q_any(srv):
    # 只发 q(无头 / 命令行)与页面带 q_any 的结果相同,且多于只按简体一种写法的命中
    only = _call(srv, "celestial", {"q": "荧惑", "page_size": 1})["total"]
    both = _call(srv, "celestial", {"q": "荧惑", "q_any": ["熒惑"], "page_size": 1})["total"]
    events = xs_celestial.load_events()
    simp_only = len(xs_celestial.filter_events(events, keyword="荧惑"))
    assert only == both > simp_only


def test_endpoint_events_q_only_matches_q_any(srv):
    simp = _call(srv, "events", {"q": "荧惑", "page_size": 1})["total"]
    trad = _call(srv, "events", {"q": "熒惑", "page_size": 1})["total"]
    both = _call(srv, "events", {"q": "熒惑", "q_any": ["荧惑"], "page_size": 1})["total"]
    single = len(xs_queries.filter_events(q="熒惑"))
    assert simp == trad == both > single
