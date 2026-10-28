# -*- coding: utf-8 -*-
"""「需本机 :8899 排盘服务在线」测试的单一判据。

凡打 :8899 的测试文件一律 `from srv_gate import BASE, post, require_srv_mark`,
写 `pytestmark = require_srv_mark()`;不许自己再写一份在线判据或读 HOROSA_REQUIRE_SRV。
发版基线(run_release_baseline.sh)与预检用同一判据(本文件的命令行入口),
二者口径不一致时,测试会整模块 skip 而闸门照样报「实跑通过」(假绿)。

- 在线 = POST /healthz 回 {"ok": true},超时 HEALTH_TIMEOUT 秒。
- HOROSA_REQUIRE_SRV=1:不再 skip,离线即连接错误红给你看(发版基线必须这样跑)。
- 日常本地无服务:整模块 skip。

命令行:`python3 tests/srv_gate.py` —— 在线退 0、不在线退 1(stdout 一行原因)。
"""
import json
import os
import sys
import urllib.request

# horosa_win_srv_base_env_v1:Windows 开发机上 :8899 常被已安装、常驻运行的星阙占着(版本可能比工作区旧,测到的是旧服务)——
# 允许 HOROSA_TEST_SRV_BASE 指向另起在别的端口的工作区排盘服务;不设 = 原样 :8899。
BASE = (os.environ.get("HOROSA_TEST_SRV_BASE") or "").strip().rstrip("/") or "http://127.0.0.1:8899"
HEALTH_TIMEOUT = 3
REQUIRE_ENV = "HOROSA_REQUIRE_SRV"


def post(path, body, timeout=60):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def probe():
    """(在线?, 原因)。"""
    try:
        rsp = post("/healthz", {}, timeout=HEALTH_TIMEOUT)
    except Exception as exc:  # noqa: BLE001 —— 连接拒绝 / 超时 / 非 JSON 一律算不在线
        return False, "POST %s/healthz 失败:%s" % (BASE, exc)
    if not isinstance(rsp, dict) or rsp.get("ok") is not True:
        return False, "POST %s/healthz 回包不是 ok:true(%s)" % (BASE, str(rsp)[:120])
    return True, "POST %s/healthz ok" % BASE


def srv_online():
    return probe()[0]


def require_srv():
    return os.environ.get(REQUIRE_ENV) == "1"


def require_srv_mark():
    import pytest
    return pytest.mark.skipif(
        (not require_srv()) and (not srv_online()),
        reason="local :8899 not online (set %s=1 to fail loudly instead of skip)" % REQUIRE_ENV)


if __name__ == "__main__":
    ok, why = probe()
    print(why)
    sys.exit(0 if ok else 1)
