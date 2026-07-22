# -*- coding: utf-8 -*-
"""东传印度一支的叠加层:十六图 × 九曜 / Rāśi / Bhāva。

十六图各有所主之行星,而九曜即七政加日月交点(交点即罗睺、计都)—— 两者天然一一对应,
故此层不假借、不杜撰,只把既有的行星归属改以该支之名呈现,并附宫位通义。
本层为**叠加显示**,不改任何起盘与判读:关掉即与原状逐字节相同。
"""
from __future__ import annotations

import json
import os
from typing import Dict, Optional

from .figures import data

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def _load() -> dict:
    with open(os.path.join(_DATA_DIR, "vedic_overlay.json"), encoding="utf-8") as f:
        return json.load(f)


_RAW = _load()
GRAHA: Dict[str, dict] = _RAW["graha"]
BHAVA: Dict[str, dict] = _RAW["bhava"]
RASHI: Dict[str, str] = _RAW["rashi"]


def vedic_overlay(fig: int, house: Optional[int] = None,
                  zodiac_system: str = "classical") -> dict:
    """图 → 所主之曜 + 其星座之该支名 + (若给宫)宫位之该支名与通义。"""
    fd = data(fig)
    p = fd.get("planet")
    g = GRAHA.get(p)
    sign = (fd.get("zodiac_classical") if zodiac_system == "classical"
            else fd.get("zodiac_planetary")) or ""
    sign = sign.rstrip("?")
    out = {
        "graha": p,
        "graha_sanskrit": (g or {}).get("sanskrit"),
        "graha_zh": (g or {}).get("vedic_zh"),
        "rashi": RASHI.get(sign),
        "rashi_sign": sign,
    }
    if house:
        b = BHAVA.get(str(int(house)))
        out["bhava"] = int(house)
        out["bhava_sanskrit"] = (b or {}).get("sanskrit")
        out["bhava_zh"] = (b or {}).get("zh")
    return out


def graha_table() -> list:
    """九曜全表(供目录与帮助页对照)。"""
    return [{"planet": k, **v} for k, v in GRAHA.items()]
