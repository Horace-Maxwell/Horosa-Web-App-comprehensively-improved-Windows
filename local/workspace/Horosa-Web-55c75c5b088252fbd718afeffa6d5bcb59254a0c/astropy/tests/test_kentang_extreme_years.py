# -*- coding: utf-8 -*-
"""全年份域金标(kentang HTTP 层):极端年份 × 卜/数算引擎端点。

制度化最小必测集(用户拍板口径):**域两顶点 + 公元 0 界两侧** + 现代基线。
- 顶点:BC 12998 / AD 16798(历法承诺域两端各让 1 年)
- 公元 0 界:BC 1 / AD 1(无公元 0 年,进位最易错)
- 基线:AD 2026(现代回归哨兵——极端年修复绝不许改动现代输出可用性)

需本地 :8899(websrv.webchartsrv)在线——与 dev/CI 环境一致(Java 金标同约定);
不在线时 skip 而非假绿。
"""
import json
import urllib.request

import os
import pytest

BASE = "http://127.0.0.1:8899"

# 两顶点 + 公元 0 界 + 现代基线(EXTREME_YEARS 最小必测集)
YEARS = [(-12998, 12, 29), (-1, 6, 15), (1, 6, 15), (2026, 7, 19), (16798, 6, 15)]

# kentang 系「year/month/day/hour/minute」明文 JSON 端点(本轮全域修复面)
ENDPOINTS = [
    "qimen", "taiyi", "jinkou", "wuzhao", "wangji",
    "cetian", "nanji", "beiji", "chunzi", "fendjing", "shaozi", "tieban", "xianqin",
]


def _post(path, body, timeout=90):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def _srv_online():
    try:
        return _post("/healthz", {}, timeout=3).get("ok") is True
    except Exception:
        try:
            urllib.request.urlopen(BASE + "/healthz", timeout=3)
            return True
        except Exception:
            return False


# 假绿闸:干净机上 :8899 未起会静默 skip 87 例而不飘红 —— 发版基线跑法必须
# HOROSA_REQUIRE_SRV=1(此时不再 skip,离线即连接错误红给你看)。日常本地无服务仍可 skip。
pytestmark = pytest.mark.skipif(
    (not _srv_online()) and os.environ.get('HOROSA_REQUIRE_SRV') != '1',
    reason="local :8899 not online (set HOROSA_REQUIRE_SRV=1 to fail loudly instead of skip)")


@pytest.mark.parametrize("year,month,day", YEARS)
@pytest.mark.parametrize("key", ENDPOINTS)
def test_kentang_endpoint_extreme_years(key, year, month, day):
    body = {
        "year": year, "month": month, "day": day, "hour": 10, "minute": 30, "second": 0,
        "date": "%s%04d-%02d-%02d" % ("-" if year < 0 else "", abs(year), month, day),
        "time": "10:30:00", "zone": "+08:00", "gender": 1,
    }
    if key == "qimen":
        body["option"] = 2
    if key == "wangji":
        body["historyYear"] = year
        body["classic"] = "huangji_jingshi_shu"
    rsp = _post("/%s/pan" % key, body)
    assert rsp.get("ResultCode") == 0, "%s @ %s -> %s" % (key, year, str(rsp)[:200])


def test_jdn_roundtrip_bc_tip():
    """jdn num↔date 往返自洽(真太阳时链的根基;BC 顶点减 6 分钟不许跨日)。"""
    r = _post("/jdn/num", {"date": "-12998-12-29", "time": "18:49:00", "zone": "8"})
    jd = r.get("jdn")
    assert jd is not None
    back = _post("/jdn/date", {"jdn": jd, "zone": "8"}).get("date", "")
    assert back.startswith("-12998-12-29"), back
    back2 = _post("/jdn/date", {"jdn": jd - 6 / 1440.0, "zone": "8"}).get("date", "")
    assert back2.startswith("-12998-12-29"), back2
