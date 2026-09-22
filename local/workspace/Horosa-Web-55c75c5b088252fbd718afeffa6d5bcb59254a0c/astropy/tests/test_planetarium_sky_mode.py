# -*- coding: utf-8 -*-
"""[Q-372/T-351] 天文馆 sky.mode 昼夜阈值:后端此前拿**视高度**(altitudeAppa,已含折射)与 -0.833°
(几何高度用的折射+半径阈值)比 = 折射算两次 → 视高度落在 (-0.833°, 0°] 的数分钟里后端 day、前端与帮助
按视高度 > 0° 已入民用晨昏。现统一为视高度 0°。判别向量:太阳视高度 -0.5° → 后端此前 day,应 civil。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from websrv.webplanetariumsrv import _visibility_info  # noqa: E402


def _tw(sun_alt):
    return _visibility_info({"altitudeAppa": 30.0, "mag": 1.0}, sun_altitude=sun_alt).get("twilight")


def test_apparent_zero_is_the_day_boundary():
    assert _tw(0.1) == "day"
    assert _tw(-0.5) == "civil"      # 此前 day(-0.833 阈值)
    assert _tw(-0.8) == "civil"
    assert _tw(-5.9) == "civil"
    assert _tw(-6.1) == "nautical"
    assert _tw(-12.1) == "astronomical"


def test_source_has_no_double_refraction_threshold():
    src = open(os.path.join(_ASTRO, "websrv", "webplanetariumsrv.py"), encoding="utf-8").read()
    code = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))
    assert "> -0.833" not in code
