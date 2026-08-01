# -*- coding: utf-8 -*-
"""Pushkara Navamsa / Pushkara Bhaga 吉度表(可插拔留空骨架)。

🔴 铁律「不臆造数表」:授权文档仅有概念句(每星座中两个特别吉的 navāṃśa 点),
**无具体度数**,故两表留空;留空时分盘 Tab 的 Pushkara 标注不渲染(优雅降级)。

待录入形状(拿到原典表页后单点录入即生效):
    PUSHKARA_NAVAMSA: dict[int, tuple[int, int]]
        键 = 星座号 1-12;值 = 该座内两个 Pushkara Navamsa 的 navamsa 序号(1-9,座内)。
    PUSHKARA_BHAGA: dict[int, float]
        键 = 星座号 1-12;值 = 该座 Pushkara Bhaga 特吉度(座内度数,0-30,单位度)。
来源要求:古典原表(如 Jataka Parijata / 相应 Nadi 文献)原表页;录入时行内注明出处页码。
"""

PUSHKARA_NAVAMSA = {}  # 待录入:座号 → (navamsa 序号, navamsa 序号)
PUSHKARA_BHAGA = {}    # 待录入:座号 → 座内特吉度数


def pushkara_flags(sign_no, lon_in_sign):
    """(座号 1-12, 座内经度 0-30)→ {'navamsa': bool|None, 'bhaga': bool|None}。
    表空 → 对应键为 None(前端据 None 不渲染标注)。"""
    out = {'navamsa': None, 'bhaga': None}
    if PUSHKARA_NAVAMSA:
        pair = PUSHKARA_NAVAMSA.get(int(sign_no))
        if pair:
            nav_idx = int(float(lon_in_sign) // (30.0 / 9.0)) + 1
            out['navamsa'] = nav_idx in pair
    if PUSHKARA_BHAGA:
        deg = PUSHKARA_BHAGA.get(int(sign_no))
        if deg is not None:
            out['bhaga'] = abs(float(lon_in_sign) - float(deg)) < 1.0
    return out
