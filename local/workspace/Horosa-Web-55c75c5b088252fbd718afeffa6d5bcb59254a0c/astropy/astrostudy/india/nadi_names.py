# -*- coding: utf-8 -*-
"""D150 Nadiamsa 150 专名表(可插拔留空骨架)。

🔴 铁律「不臆造数表」:授权文档树全 grep 无 D150 名表(印占-KP 仅注「见 Nadi 原典」),
故本表**留空**;留空时引擎/前端保持现状——D150 只显段号位(现行为,零回归)。

待录入形状(拿到 Nadi 原典表页后单点录入即生效,无需改结构):
    D150_NAMES: tuple[str, ...],长度必须 == 150。
    - 下标 i(0-149)= 奇数座(白羊/双子/狮子/天秤/射手/水瓶)自段 1 起的第 i+1 段专名。
    - 偶数座按原典「奇顺偶逆」自动反序取用(消费方处理,本表只存一份正序)。
    - 名称用原典转写(IAST 拉丁化或原文),不混译名。
来源要求:Nadi 原典(如 Dhruva Nadi / Chandra Kala Nadi)原表页;录入时在行内注明卷/页。
"""

D150_NAMES = ()  # 待录入:Nadi 原典 150 名(奇座顺/偶座逆)


def nadiamsa_name(index_1based, sign_is_odd=True):
    """段号(1-150)→ 专名;表空或越界返回 None(调用方降级显示段号)。"""
    if not D150_NAMES or len(D150_NAMES) != 150:
        return None
    idx = int(index_1based) - 1
    if idx < 0 or idx >= 150:
        return None
    if not sign_is_odd:
        idx = 149 - idx
    return D150_NAMES[idx]
