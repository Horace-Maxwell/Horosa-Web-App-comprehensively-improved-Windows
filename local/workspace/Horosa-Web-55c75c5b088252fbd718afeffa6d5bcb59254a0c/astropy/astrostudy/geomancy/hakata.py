# -*- coding: utf-8 -*-
"""四片占 Hakata:4 片(老男/老女/少男/少女)各正反(开=1/合=0)→ 4bit → 16 图家族。
D1 占位:断语取 16 图吉凶 + 诊断病因/祖灵取向,断语 JSON 见 data/hakata.json(预留补正宗)。"""
from __future__ import annotations

import json
import os
import random
from typing import Optional

from ..truerandom import system_random

_DATA = os.path.join(os.path.dirname(__file__), "data", "hakata.json")


def _load():
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)


_RAW = _load()
TABLETS = _RAW["tablets"]
_CASTS = _RAW["casts"]


def cast_hakata(rng: Optional[random.Random] = None) -> dict:
    """掷 4 片(各 open=1/closed=0)→ 4bit → 局。返回 {tablets:[{label,open}], figure, reading, ...}。"""
    r = rng or system_random()
    flips = [r.randint(0, 1) for _ in range(4)]
    n = (flips[0] << 3) | (flips[1] << 2) | (flips[2] << 1) | flips[3]
    cast = _CASTS[str(n)]
    return {
        "tablets": [{"id": TABLETS[i]["id"], "label": TABLETS[i]["label"], "open": bool(flips[i])} for i in range(4)],
        "bits": flips, "int": n,
        "figure": cast["figure"], "figure_zh": cast["figure_zh"],
        "tone": cast["tone"], "reading": cast["reading"],
        "orientation": _RAW.get("orientation", ""),
    }
