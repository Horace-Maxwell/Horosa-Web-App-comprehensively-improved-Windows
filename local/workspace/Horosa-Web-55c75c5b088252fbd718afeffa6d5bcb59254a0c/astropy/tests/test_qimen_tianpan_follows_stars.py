# -*- coding: utf-8 -*-
"""转盘奇门:天盘干由九星带着各自本宫的地盘干走 —— 每一宫的天盘干,必等于临在该宫那颗星的本宫地盘干。

上游参考实现在一种情形下破了这条:时干就是中五宫的干(值符随时干入中、寄坤)而值符星的本宫正是坤宫(值符天芮)。
这时九星、八门、八神都排成伏吟,天盘干却从圈上最后一个干排起,转了两三宫,与它自己的星盘矛盾(全年约 1.1% 的时辰)。
本仓内置的这份已改为伏吟;这里在 2026 全年逐日十二个时辰上锁住「干随星走」。
"""
import datetime
import os
import sys

import pytest

_KINQIMEN_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "vendor", "kinqimen")
)
if _KINQIMEN_DIR not in sys.path:
    sys.path.insert(0, _KINQIMEN_DIR)

try:
    import kinqimen as kq  # noqa: E402
    _IMPORT_OK = True
except Exception:  # pragma: no cover - 依赖 vendor 可用
    _IMPORT_OK = False

pytestmark = pytest.mark.skipif(not _IMPORT_OK, reason="vendor/kinqimen 不可导入")

# 九星本宫(天禽寄坤,随天芮)
STAR_HOME = {"蓬": "坎", "任": "艮", "沖": "震", "輔": "巽", "英": "離", "芮": "坤", "禽": "坤", "柱": "兌", "心": "乾"}
RING = ["坎", "艮", "震", "巽", "離", "坤", "兌", "乾"]


def _pan(year, month, day, hour, option=1):
    return kq.Qimen(year, month, day, hour, 30).pan(option)


def _sky(pan):
    sky = pan["天盤"]
    return sky[0] if isinstance(sky, tuple) else sky


def test_reported_hour_is_stationary_on_all_layers():
    """2026-01-12 酉时:阳遁八局,丁酉时(甲午旬,遁辛)。辛在坤二 → 值符天芮;时干丁在中五(寄坤)→ 值符加坤 = 原地不动。"""
    pan = _pan(2026, 1, 12, 18)
    assert pan["排局"] == "陽遁八局中"
    assert pan["值符值使"]["值符星宮"] == ["芮", "中"]
    earth, sky = pan["地盤"], _sky(pan)
    assert [pan["星"][g] for g in RING] == ["蓬", "任", "沖", "輔", "英", "禽", "柱", "心"]   # 九星各在本宫
    assert [pan["門"][g] for g in RING] == ["休", "生", "傷", "杜", "景", "死", "驚", "開"]   # 八门各在本宫
    assert {g: sky[g] for g in RING} == {g: earth[g] for g in RING}                       # 天盘干 = 地盘干


# 拆补逐日;置闰每三日(两种定局法共用同一段排天盘的代码,只是局数来源不同)
@pytest.mark.parametrize("option,step", [(1, 1), (2, 3)])
def test_sky_stems_follow_the_stars_all_year(option, step):
    day = datetime.date(2026, 1, 1)
    checked = stationary = centre_hour = 0
    while day.year == 2026:
        for hour in range(0, 24, 2):
            pan = _pan(day.year, day.month, day.day, hour, option)
            earth, sky, stars = pan["地盤"], _sky(pan), pan["星"]
            for g in RING:
                assert sky[g] == earth[STAR_HOME[stars[g][0]]], (day.isoformat(), hour, pan["排局"], g)
            checked += 1
            if pan["值符值使"]["值符星宮"][1] == "中":
                centre_hour += 1
                if all(STAR_HOME[stars[g][0]] == g for g in RING):
                    stationary += 1
                    assert all(sky[g] == earth[g] for g in RING)
        day += datetime.timedelta(days=step)
    assert checked == len(range(0, 365, step)) * 12
    assert centre_hour > 300 // step      # 时干落中五宫的时辰
    assert stationary >= 40 // step       # 其中值符星本宫就是寄宫、整盘不动的时辰(原先错的就是这一类)
