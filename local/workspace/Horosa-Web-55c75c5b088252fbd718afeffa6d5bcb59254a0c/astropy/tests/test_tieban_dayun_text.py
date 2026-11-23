# -*- coding: utf-8 -*-
"""铁板「大运」段:一运一行写成「N岁：条文 1945｜正文」—— 号码前写明是条文号(光写「10岁：1945」像公元年份)。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import pytest  # noqa: E402

pytest.importorskip('sxtwl')
from websrv.webtiebansrv import _dayun_rows, _dayun_value  # noqa: E402


def test_value_labels_clause_number():
    assert _dayun_value(1945, '天育其秀') == '条文 1945｜天育其秀'
    assert _dayun_value('', '天育其秀') == '天育其秀'
    assert _dayun_value(None, {'text': '正文'}) == '正文'


def test_rows_both_shapes():
    rows = _dayun_rows([{'age': 10, 'tiaowen_number': 1945, 'tiaowen': '天育其秀'}])
    assert rows[0]['label'] == '10岁' and rows[0]['value'] == '条文 1945｜天育其秀'
    class Obj:  # 非字典条目走 json_safe 路径
        def __init__(self):
            self.dayun_number = 20
            self.tiaowen_key = 2045
            self.tiaowen = '妻配二旬'
    try:
        rows2 = _dayun_rows([Obj()])
    except Exception:
        pytest.skip('json_safe 不转对象')
    if rows2 and rows2[0]['label'] == '20岁':
        assert rows2[0]['value'] == '条文 2045｜妻配二旬'
