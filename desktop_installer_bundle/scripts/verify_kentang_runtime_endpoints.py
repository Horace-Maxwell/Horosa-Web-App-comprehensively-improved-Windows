#!/usr/bin/env python3
"""Smoke-test every bundled kentang/kin runtime endpoint.

Release rule: every packaged technique exposed by the kentang/kin chart service
must be represented here before publishing. The installed-app release checks run
this before the generic chart smoke to catch shared runtime state pollution.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


ENDPOINTS = [
    "taiyi",
    "jinkou",
    "qimen",
    "wangji",
    "wuzhao",
    "taixuan",
    "jingjue",
    "shenyishu",
    "shaozi",
    "tieban",
    "fendjing",
    "beiji",
    "nanji",
    "chunzi",
    "xianqin",
    "cetian",
    "qizhengkin",
]

SMOKE_PAYLOAD = {
    "year": 2026,
    "month": 5,
    "day": 24,
    "hour": 9,
    "minute": 30,
    "date": "2026/05/24",
    "time": "09:30:00",
    "zone": "+08:00",
    "timezone": 8,
    "lat": "31n14",
    "lon": "121e28",
    "gpsLat": 31.2304,
    "gpsLon": 121.4737,
    "pos": "上海",
    "location": "上海",
    "locationName": "上海",
    "gender": "male",
    "sex": "男",
    "question": "测试",
    "seed": 123456,
    "style": 3,
    "tn": 0,
    "method": "auto",
}

CHART_SMOKE_BASE_PAYLOAD = {
    "date": "2026/05/24",
    "time": "09:30:00",
    "zone": "+08:00",
    "lat": "31n14",
    "lon": "121e28",
    "gpsLat": 31.2304,
    "gpsLon": 121.4737,
    "pos": "上海",
    "hsys": 1,
    "tradition": False,
    "predictive": True,
    "zodiacal": 0,
    "simpleAsp": False,
    "strongRecption": False,
    "virtualPointReceiveAsp": False,
    "southchart": False,
    "ad": 1,
    "pdtype": 0,
    "pdMethod": "core_alchabitius",
    "pdTimeKey": "Ptolemy",
    "pdaspects": [0, 60, 90, 120, 180],
    "doubingSu28": 2,
}

CHART_SMOKE_VARIANTS = [
    {
        "label": "modern-shanghai",
        "date": "2026/05/24",
        "time": "09:30:00",
        "zone": "+08:00",
        "lat": "31n14",
        "lon": "121e28",
        "gpsLat": 31.2304,
        "gpsLon": 121.4737,
    },
    {
        "label": "past-fuzhou",
        "date": "2023/05/24",
        "time": "08:41:55",
        "zone": "+08:00",
        "lat": "26n04",
        "lon": "119e19",
        "gpsLat": 26.0666,
        "gpsLon": 119.3166,
    },
    {
        "label": "future-fuzhou",
        "date": "2027/05/24",
        "time": "20:41:55",
        "zone": "+08:00",
        "lat": "26n04",
        "lon": "119e19",
        "gpsLat": 26.0666,
        "gpsLon": 119.3166,
    },
    {
        "label": "utc-west",
        "date": "1994/01/17",
        "time": "23:15:00",
        "zone": "-08:00",
        "lat": "34n03",
        "lon": "118w15",
        "gpsLat": 34.05,
        "gpsLon": -118.25,
    },
]


def post_json(url: str, payload: dict, timeout: float) -> tuple[int, dict]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", "replace")
        return response.status, json.loads(body)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Chart service root, for example http://127.0.0.1:8899")
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args()

    root = args.root.rstrip("/")
    failures = []
    for endpoint in ENDPOINTS:
        url = f"{root}/{endpoint}/pan"
        try:
            status, payload = post_json(url, SMOKE_PAYLOAD, args.timeout)
            result_code = payload.get("ResultCode")
            result = payload.get("Result")
            ok = status < 500 and result_code in (0, "0") and result is not None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            failures.append((endpoint, repr(exc)))
            print(f"kentang endpoint FAIL {endpoint}: {exc}", file=sys.stderr)
            continue

        result_type = type(result).__name__
        print(f"kentang endpoint OK {endpoint}: http={status} resultCode={result_code} resultType={result_type}")
        if not ok:
            failures.append((endpoint, json.dumps(payload, ensure_ascii=False)[:500]))

    for variant in CHART_SMOKE_VARIANTS:
        label = variant["label"]
        payload_in = dict(CHART_SMOKE_BASE_PAYLOAD)
        payload_in.update(variant)
        payload_in.pop("label", None)
        try:
            status, payload = post_json(f"{root}/", payload_in, args.timeout)
            chart_ok = status < 500 and not payload.get("err") and payload.get("chart") and payload.get("params")
            print(
                "chart endpoint after kentang smoke "
                f"{'OK' if chart_ok else 'FAIL'} {label}: http={status} "
                f"birth={payload.get('params', {}).get('birth')}"
            )
            if not chart_ok:
                failures.append((f"chart-after-kentang:{label}", json.dumps(payload, ensure_ascii=False)[:500]))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            failures.append((f"chart-after-kentang:{label}", repr(exc)))
            print(f"chart endpoint after kentang smoke FAIL {label}: {exc}", file=sys.stderr)

    if failures:
        print("kentang endpoint smoke failed:", failures[:5], file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
