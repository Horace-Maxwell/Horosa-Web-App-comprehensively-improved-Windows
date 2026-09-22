# -*- coding: utf-8 -*-
"""[Q-130/T-38][Q-131/T-39][Q-232/T-196] 印占三处:
  · 敌座豁免开关此前只进判读卡,基础视图两处 haraṇa 恒按缺省 → 引擎两处调用须透传(源码哨兵);
  · 「AK 优先」× 「7 卡拉卡」:AK 须剔罗睺 → _atmakaraka_of(seven=True);
  · rasi_drishti 受照座按黄道序输出(此前 set 迭代随进程哈希漂移)。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from flatlib import const  # noqa: E402
from astrostudy.india.primitives import rasi_drishti, SIGNS  # noqa: E402
from astrostudy.india.rasi_dasha import _atmakaraka_of, planet_strength_compare  # noqa: E402


def test_rasi_drishti_is_zodiac_ordered_and_content_unchanged():
    for sign in SIGNS:
        out = rasi_drishti(sign)
        assert out == sorted(out, key=SIGNS.index)         # 黄道序
        assert len(out) == 3 and sign not in out
    # 动→定(除相邻定):白羊 → 狮子/天蝎/水瓶(排除相邻金牛)
    assert rasi_drishti(const.ARIES) == [const.LEO, const.SCORPIO, const.AQUARIUS]


def _chart():
    # 罗睺推进度最大(宫内 28°),七政里火星最大(20°)。
    signs = {const.SUN: 0, const.MOON: 1, const.MARS: 2, const.MERCURY: 3, const.JUPITER: 4,
             const.VENUS: 5, const.SATURN: 6, const.NORTH_NODE: 7, const.SOUTH_NODE: 1}
    lons = {const.SUN: 5.0, const.MOON: 35.0, const.MARS: 80.0, const.MERCURY: 95.0, const.JUPITER: 125.0,
            const.VENUS: 152.0, const.SATURN: 190.0, const.NORTH_NODE: 212.0, const.SOUTH_NODE: 32.0}
    return signs, lons


def test_atmakaraka_scheme_seven_excludes_rahu():
    signs, lons = _chart()
    ak8 = _atmakaraka_of(signs, lons)
    ak7 = _atmakaraka_of(signs, lons, seven=True)
    assert ak7 != const.NORTH_NODE
    assert ak7 == const.MARS
    # 8 曜方案下罗睺以「宫末量起」参与,结果由推进度决定;两方案至少在含罗睺与否上不同口径
    assert ak8 in (const.NORTH_NODE, const.MARS)


def test_ak_first_7_order_is_accepted_by_strength_compare():
    signs, lons = _chart()
    # 火星是 7 卡拉卡 AK → ak_first_7 下火星径强于水星
    assert planet_strength_compare(const.MARS, const.MERCURY, signs, lons, order='ak_first_7') == 1
    assert planet_strength_compare(const.MERCURY, const.MARS, signs, lons, order='ak_first_7') == -1


def test_engine_passes_satruksetra_to_both_base_haranas():
    src = open(os.path.join(_ASTRO, 'astrostudy', 'india', 'jyotish_engine.py'), encoding='utf-8').read()
    i = src.find("'harana': self._ayurdaya_harana(")
    j = src.find("'haranaNisarga': self._ayurdaya_harana(", i)
    assert i > 0 and j > 0
    assert 'satruksetra_exemption=' in src[i:src.find('\n', i)]
    assert 'satruksetra_exemption=' in src[j:j + 260]
    assert "inputs['karakaScheme'] = self.karaka_scheme" in src
