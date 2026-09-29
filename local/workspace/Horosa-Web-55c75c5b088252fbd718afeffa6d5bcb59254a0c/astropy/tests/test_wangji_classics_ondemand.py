# -*- coding: utf-8 -*-
"""皇极经世典籍按需(horosa_wangji_classics_ondemand_v1)。

钉三件事:① 不带 slimClassics 的调用方拿到的典籍对象形状与旧盘相同(meta / selectedKey / sections,节含正文);
② 精简盘只省正文,目录(level / title)逐节相同并标 contentOmitted;③「精简盘 + /wangji/classic 合并」与全文盘逐字节相同。
"""
import json

import pytest

KEY = "huangji_jingshi_shu"
BODY = {
    "year": 2026, "month": 9, "day": 26, "hour": 10, "minute": 30,
    "date": "2026-09-26", "time": "10:30:00", "historyYear": 2026,
    "classicKey": KEY, "after23NewDay": 1, "lateZiHourUseNextDay": 1,
}


@pytest.fixture(scope="module")
def mod():
    import cherrypy
    from websrv import webwangjisrv

    class _Req:
        method = "POST"
        params = {}
        json = None
        headers = {}

    cherrypy.serving.request = _Req()
    return webwangjisrv


def _call(mod, method, body):
    import cherrypy
    cherrypy.serving.request.json = dict(body)
    raw = getattr(mod.WangJiSrv(), method)()
    data = json.loads(raw)
    assert data.get("ResultCode") == 0, data
    return data["Result"]


def _merge(slim, full):
    # 与前端 HuangJiMain.mergeClassicsFull 同口径:逐节核对后产出三键同序的旧形状
    assert slim["selectedKey"] == full["selectedKey"]
    assert [(x["level"], x["title"]) for x in slim["sections"]] == [(x["level"], x["title"]) for x in full["sections"]]
    return {"meta": slim["meta"], "selectedKey": slim["selectedKey"], "sections": list(full["sections"])}


def test_default_classics_shape_unchanged(mod):
    c = mod._classic_payload(KEY)
    assert list(c.keys()) == ["meta", "selectedKey", "sections"]
    assert c["sections"] and all(list(x.keys()) == ["level", "title", "content"] for x in c["sections"])


def test_slim_classics_only_drops_content(mod):
    full = mod._classic_payload(KEY)
    slim = mod._classic_payload(KEY, with_content=False)
    assert slim["contentOmitted"] is True
    assert all("content" not in x for x in slim["sections"])
    assert [(x["level"], x["title"]) for x in slim["sections"]] == [(x["level"], x["title"]) for x in full["sections"]]
    assert slim["meta"] == full["meta"] and slim["selectedKey"] == full["selectedKey"]


def test_slim_pan_plus_classic_equals_full_pan(mod):
    full_pan = _call(mod, "pan", BODY)
    slim_pan = _call(mod, "pan", {**BODY, "slimClassics": 1})
    classic = _call(mod, "classic", {"classicKey": KEY})
    assert "contentOmitted" not in full_pan["classics"]
    assert slim_pan["classics"]["contentOmitted"] is True
    merged = dict(slim_pan)
    merged["classics"] = _merge(slim_pan["classics"], classic)
    assert json.dumps(merged, ensure_ascii=False) == json.dumps(full_pan, ensure_ascii=False)
    assert len(json.dumps(slim_pan)) * 20 < len(json.dumps(full_pan))


def test_classic_endpoint_unknown_key_falls_back_like_pan(mod):
    classic = _call(mod, "classic", {"classicKey": "no-such-classic"})
    pan = _call(mod, "pan", {**BODY, "classicKey": "no-such-classic"})
    assert classic["selectedKey"] == pan["classics"]["selectedKey"]
    assert json.dumps(classic, ensure_ascii=False) == json.dumps(pan["classics"], ensure_ascii=False)
