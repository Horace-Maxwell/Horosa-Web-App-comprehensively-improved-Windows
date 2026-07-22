# -*- coding: utf-8 -*-
"""西非同族体系(Ifá/Fa/Afa)结构对照层。

⚠️ 文化边界:此为**独立圣传体系**,与地占**仅十六个四行二元图形外形同构**;其起卦、含义、解读与
宗教语境自成体系、需经启蒙传承。本模块**只做结构与比特对照**(形的识别与显示),**不套用地占含义、
不载诗文、不产出占断**。上游必须把 cultural_notice 一并呈现给用户。

结构:一形 = 两列 × 每列四记号(单线 I / 双线 II)。两列相同者为主形(Meji「双」),共十六;
任取两列可组合出 256 形,命名为「右名-左名」(自右向左读,资深列在右)。
比特约定:单线 I = 单点 = 1、双线 II = 双点 = 0;自上而下 火→气→水→地 —— 与地占内核同一约定,
故两列各自即一个地占图形整数,对应关系由比特唯一确定(双射,已由单测钉死)。
"""
from __future__ import annotations

import json
import os
import random
from typing import Dict, List, Optional, Tuple

from .figures import FIG_BY_INT, name as fig_name

_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def _load() -> dict:
    with open(os.path.join(_DATA_DIR, "ifa_odu.json"), encoding="utf-8") as f:
        return json.load(f)


_RAW = _load()
CULTURAL_NOTICE: str = _RAW["cultural_notice"]
STRUCTURE: dict = _RAW["structure"]
CAST_METHODS: dict = _RAW["cast_methods"]
MEJI: List[dict] = _RAW["meji"]

# 地占图形整数 → 主形条目(双射:16 图 ↔ 16 主形)
MEJI_BY_INT: Dict[int, dict] = {int(e["int"]): e for e in MEJI}
MEJI_BY_NAME: Dict[str, dict] = {e["name"]: e for e in MEJI}


def odu_of(fig: int) -> Optional[dict]:
    """地占图形整数 → 对应主形(名/记号/资历)。未知整数返回 None。"""
    e = MEJI_BY_INT.get(int(fig))
    return dict(e) if e else None


def marks_of(fig: int) -> List[str]:
    """图形 → 四记号(自上而下 火→地):单点作单线 I、双点作双线 II。"""
    return ["I" if (fig >> b) & 1 else "II" for b in (3, 2, 1, 0)]


def cast_ifa_opele(rng: Optional[random.Random] = None) -> Tuple[int, int]:
    """占链起卦:一掷八枚半果 → 两列各四记号。返回 (右列, 左列) 两个图形整数。

    自右向左读、资深列在右 —— 故先落者为右列。每枚凹凸对应单/双,与地占同一比特约定。
    """
    r = rng or random
    bits = [r.randint(0, 1) for _ in range(8)]
    right = 0
    left = 0
    for k in range(4):
        right |= bits[k] << (3 - k)
        left |= bits[4 + k] << (3 - k)
    return right, left


def cast_ifa_ikin(rng: Optional[random.Random] = None) -> Tuple[int, int]:
    """圣果起卦:抓取十六果取余数,余二记单线、余一记双线(此约定与直觉相反,为其内部规矩);
    重复八次成一形。与占链同为八记号,仅取记方式不同。"""
    r = rng or random
    marks = []
    for _ in range(8):
        # 双手相抓后余数只可能为 1 或 2
        rem = r.choice((1, 2))
        marks.append(1 if rem == 2 else 0)
    right = 0
    left = 0
    for k in range(4):
        right |= marks[k] << (3 - k)
        left |= marks[4 + k] << (3 - k)
    return right, left


def _column(fig: int) -> dict:
    e = odu_of(fig)
    return {
        "figure_int": int(fig),
        "figure": fig_name(fig),
        "marks": marks_of(fig),
        "odu_name": (e or {}).get("name"),
        "odu_alt_name": (e or {}).get("alt_name"),
        "seniority": (e or {}).get("seniority"),
    }


def compose(right: int, left: int) -> dict:
    """两列 → 一形。左右相同=主形(Meji);否则为组合形,按「右名-左名」命名。"""
    rc = _column(right)
    lc = _column(left)
    is_meji = int(right) == int(left)
    if is_meji:
        label = rc["odu_name"]
    else:
        label = "%s-%s" % (rc["odu_name"], lc["odu_name"])
    return {
        "right": rc, "left": lc,
        "is_meji": is_meji,
        "label": label,
        "read_direction": STRUCTURE.get("read_direction", "RTL"),
    }


def cast_ifa(rng: Optional[random.Random] = None, method: str = "opele") -> dict:
    """完整起卦并组形。method: opele(占链,默认) / ikin(圣果)。

    返回结构对照块 —— 含两列记号、主形名、对应地占图形、以及必须随盘呈现的文化边界声明。
    **不含任何占断内容**。
    """
    m = method if method in ("opele", "ikin") else "opele"
    right, left = (cast_ifa_ikin(rng) if m == "ikin" else cast_ifa_opele(rng))
    out = compose(right, left)
    out["cast_method"] = m
    out["cast_method_note"] = CAST_METHODS.get(m)
    out["cultural_notice"] = CULTURAL_NOTICE
    out["structure"] = dict(STRUCTURE)
    out["meji_reference"] = [
        {"seniority": e["seniority"], "name": e["name"], "alt_name": e.get("alt_name"),
         "marks": list(e["marks"]), "bits": e["bits"], "figure": e["figure"], "int": e["int"]}
        for e in MEJI
    ]
    return out


def bijection_ok() -> bool:
    """自证:16 主形 ↔ 16 地占图形为双射,且每条 bits/int/figure 三者自洽。"""
    ints = set()
    for e in MEJI:
        i = int(e["int"])
        if int(e["bits"], 2) != i:
            return False
        if fig_name(i) != e["figure"]:
            return False
        ints.add(i)
    return len(ints) == 16 and ints == set(FIG_BY_INT)
