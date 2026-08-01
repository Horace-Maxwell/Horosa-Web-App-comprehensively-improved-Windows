# -*- coding: utf-8 -*-
"""数算/卜系全技法·标准四柱权威一致性金标(HTTP 层)。

铁律(用户拍板):凡展示标准「年柱/月柱/日柱/时柱」的技法,四柱必 = 全局权威 extreme_pillars
(天文年立春界/定气月/儒略 JDN),绝不用简化公式。真机根因:邵子神数简化四柱、太玄 year clamp
到 1900、神易数 sxtwl BC 崩——BC/立春前/节气边界四柱全错,跨技法不一致。

覆盖极端年:BC12026(用户实测)+ AD 立春前(2026-01-15,旧简化年柱错处)+ 立春后基线。
判据:权威四柱的 4 个干支全部出现在响应 JSON(简化算法会出现错误干支如庚子/甲午而非权威值)。
特色排布引擎(北极/先秦神数的内部命理干支非标准四柱)不在此列。需 :8899 在线,否则 skip。
"""
import json
import urllib.request

import os
import pytest

from kin_year_domain import extreme_pillars

BASE = "http://127.0.0.1:8899"

# 展示标准四柱(年月日时柱)的数算/卜系引擎 → 四柱必 = 权威
STANDARD_PILLAR_ENDPOINTS = [
    "shaozi", "tieban", "nanji", "chunzi", "fendjing", "taixuan", "shenyishu",
]

# (显示年, 月, 日, 时, 分):BC 顶点 / AD 立春前(旧简化错) / AD 立春后基线
CASES = [
    (-12026, 7, 19, 22, 6),
    (2026, 1, 15, 10, 0),
    (2026, 7, 19, 22, 6),
]


def _post(path, body, timeout=60):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def _online():
    try:
        return _post("/healthz", {}, timeout=3).get("ok") is True
    except Exception:
        return False


# 假绿闸:干净机上 :8899 未起会静默 skip 87 例而不飘红 —— 发版基线跑法必须
# HOROSA_REQUIRE_SRV=1(此时不再 skip,离线即连接错误红给你看)。日常本地无服务仍可 skip。
pytestmark = pytest.mark.skipif(
    (not _online()) and os.environ.get('HOROSA_REQUIRE_SRV') != '1',
    reason="local :8899 not online (set HOROSA_REQUIRE_SRV=1 to fail loudly instead of skip)")


@pytest.mark.parametrize("key", STANDARD_PILLAR_ENDPOINTS)
@pytest.mark.parametrize("y,mo,d,h,mi", CASES)
def test_shushu_pillars_authoritative(key, y, mo, d, h, mi):
    yTG, mTG, dTG, hTG, _zi = extreme_pillars(y, mo, d, h, mi)
    body = {
        "year": y, "month": mo, "day": d, "hour": h, "minute": mi,
        "date": "%s%04d-%02d-%02d" % ("-" if y < 0 else "", abs(y), mo, d),
        "time": "%02d:%02d:00" % (h, mi), "zone": "+08:00", "gender": 1,
    }
    rsp = _post("/%s/pan" % key, body)
    assert rsp.get("ResultCode") == 0, "%s @ %s -> %s" % (key, y, str(rsp)[:150])
    blob = json.dumps(rsp.get("Result", {}), ensure_ascii=False)
    # 权威四柱 4 干支须全部出现(简化算法会出现错误干支,不含全部权威值)
    missing = [gz for gz in (yTG, mTG, dTG, hTG) if gz not in blob]
    assert not missing, "%s @ %s 四柱缺权威值 %s (应含 %s/%s/%s/%s)" % (
        key, y, missing, yTG, mTG, dTG, hTG)
