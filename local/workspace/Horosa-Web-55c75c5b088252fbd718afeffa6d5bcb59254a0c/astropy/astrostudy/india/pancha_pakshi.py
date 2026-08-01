# -*- coding: utf-8 -*-
"""Pancha-Pakshi 五鸟择时活动表(可插拔留空骨架)。

🔴 铁律「不臆造数表」:授权文档树全 grep 无五鸟活动表,故留空;
留空时择时 Tab 不渲染该卡(优雅降级,不以模型知识替代原典)。

待录入形状(拿到南印 Pancha-Pakshi 原典表页后单点录入即生效):
    BIRDS: tuple[str, ...] 五鸟名固定序(秃鹫/猫头鹰/乌鸦/公鸡/孔雀的原典转写)。
    BIRD_ACTIVITY_TABLE: dict[str, dict]
        键 = 鸟名;值 = {
            'paksha': 'shukla'|'krishna',   # 白分/黑分两套各一份
            'day':   { 星期序 0-6: (五段活动序 tuple,每段 ∈ ACTIVITIES) },
            'night': { 星期序 0-6: (五段活动序 tuple) },
        }
    ACTIVITIES: tuple[str, ...] 五活动名固定序(统治/进食/行走/睡眠/死亡的原典转写)。
    出生鸟规则(出生宿+paksha → 鸟)另以 BIRTH_BIRD_RULE: dict 录入。
来源要求:南印 Pancha-Pakshi Shastra 原表;录入时行内注明版本/页码。
"""

BIRDS = ()               # 待录入:五鸟名(固定序)
ACTIVITIES = ()          # 待录入:五活动名(固定序)
BIRD_ACTIVITY_TABLE = {}  # 待录入:鸟 × 昼/夜 × 星期 → 五段活动序
BIRTH_BIRD_RULE = {}     # 待录入:出生宿 × paksha → 出生鸟


def bird_card_available():
    """择时 Tab 据此决定是否渲染五鸟卡(表空=不渲染)。"""
    return bool(BIRDS) and bool(ACTIVITIES) and bool(BIRD_ACTIVITY_TABLE)
