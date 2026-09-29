# -*- coding: utf-8 -*-
"""微年表按需(horosa_xuanshi_micro_ondemand_v1):截断 = 全量前 N 条、统计不变、memo、强制重载清 memo、端点透传 limit。"""
import json

import pytest

from astrostudy.xuanshi import celestial as C


@pytest.mark.parametrize("kw", [{}, {"omen_type": "日食"}, {"omen_type": "流星"}, {"decade": 1010}, {"omen_type": "彗"}])
def test_limit_is_prefix_of_full_and_summary_unchanged(kw):
    full = C.microchronology(**kw)
    lim = C.microchronology(**kw, limit=C.MICRO_LIST_LIMIT)
    assert lim["events"] == full["events"][:C.MICRO_LIST_LIMIT]
    assert json.dumps(lim["summary"], ensure_ascii=False) == json.dumps(full["summary"], ensure_ascii=False)
    assert lim["summary"]["total"] == len(full["events"])


def test_unfiltered_limited_payload_is_small():
    full = C.microchronology()
    lim = C.microchronology(limit=C.MICRO_LIST_LIMIT)
    assert len(full["events"]) > 20000
    assert len(json.dumps(lim, ensure_ascii=False)) * 30 < len(json.dumps(full, ensure_ascii=False))


def test_memo_and_force_reload():
    a = C.microchronology(decade=1500)
    again = C.microchronology(decade=1500)
    if C._MICRO_MEMO_ON:
        assert again is a          # 缺省:同参命中 memo
    else:
        assert again is not a      # HOROSA_XUANSHI_MICRO_MEMO=0:每次现算
    assert json.dumps(again, ensure_ascii=False) == json.dumps(a, ensure_ascii=False)
    C.load_events(force=True)
    b = C.microchronology(decade=1500)
    assert b is not a
    assert json.dumps(b, ensure_ascii=False) == json.dumps(a, ensure_ascii=False)


def test_endpoint_passes_limit_through():
    import cherrypy
    from websrv import webxuanshisrv

    class _Req:
        method = "POST"
        params = {}
        json = {"omen_type": "日食", "limit": 50}

    cherrypy.serving.request = _Req()
    data = json.loads(webxuanshisrv.XuanShiSrv().microchronology())
    full = C.microchronology(omen_type="日食")
    assert data["events"] == json.loads(json.dumps(full["events"][:50], ensure_ascii=False))
    assert data["summary"]["total"] == full["summary"]["total"]
