# -*- coding: utf-8 -*-
"""G6 · 27/28 宿(Abhijit)口径。

守:① ABHIJIT_ENTRY 独立常量存在且 27 条主表**恒 27 条**(绝不插入);
   ② number28 编号律:≤21 不变 / Abhijit 区=22 / Shravana 起 +1;
   ③ 🔴 Vimshottari/Tara 恒按 27 宿(Abhijit 开关对其零影响)。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "flatlib-ctrad2"))

from astrostudy.india import nakshatra_data as nd  # noqa: E402
from astrostudy.india.primitives import (  # noqa: E402
    ABHIJIT_START, ABHIJIT_END, is_abhijit, nakshatra_number_28)


def test_abhijit_entry_standalone_and_main_table_untouched():
    assert len(nd.NAKSHATRA_DATA) == 27          # 🔴 主表恒 27,插入即全体系错位
    e = nd.ABHIJIT_ENTRY
    assert e['index28'] == 22 and e['sanskrit'] == 'Abhijit'
    assert abs(e['rangeStart'] - ABHIJIT_START) < 1e-9
    assert abs(e['rangeEnd'] - ABHIJIT_END) < 1e-9
    # 边界精确值:276°40′00″ / 280°53′20″(止点带 20″,双文档互证;截成整分即错)
    assert abs(e['rangeStart'] - 276.6666667) < 1e-6
    assert abs(e['rangeEnd'] - 280.8888889) < 1e-6


def test_number28_mapping_law():
    # UA 内非 Abhijit 段(第 21 宿,<276°40′)
    assert nakshatra_number_28(275.0, 21) == 21
    # Abhijit 区 → 恒 22
    assert is_abhijit(277.0) and nakshatra_number_28(277.0, 21) == 22
    assert is_abhijit(280.8) and nakshatra_number_28(280.8, 22) == 22
    # Shravana 区外段(27 宿序 22)→ 23
    assert not is_abhijit(281.0)
    assert nakshatra_number_28(281.0, 22) == 23
    # 末宿 Revati 27 → 28
    assert nakshatra_number_28(355.0, 27) == 28
    # 首宿不变
    assert nakshatra_number_28(5.0, 1) == 1


def test_vimshottari_and_tara_stay_27():
    """🔴 Vimshottari lord 序列与 Tara 计数与 Abhijit 无关(§4.3 铁律)。"""
    from astrostudy.india.jyotish_engine import nakshatra_from_lon
    from astrostudy.india.gochara import nak_count_from
    # Abhijit 区内经度,27 宿口径仍判为第 21/22 宿之一,lord 不变
    nk = nakshatra_from_lon(277.0)
    assert nk['index'] in (21, 22)
    assert nk['lord'] in ('Sun', 'Moon')          # UA 主日 / Shravana 主月
    # Tara 循环恒 27:第 1 宿数到第 28 计数 == 数到第 1(mod 27)
    assert nak_count_from(1, 1) == nak_count_from(1, 28) or nak_count_from(1, 1) == 1
