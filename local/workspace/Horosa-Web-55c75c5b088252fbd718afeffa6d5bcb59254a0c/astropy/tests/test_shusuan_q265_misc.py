# -*- coding: utf-8 -*-
"""[Q-265/T-250] 数算杂项后端侧:南极密码简体归一(SO-21③)/ 蠢子宿名简体归一(SO-21②)/ 演禽手动档空值自出(SO-24)/ 策天地点行(SO-13)。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest

try:
    from websrv import webnanjisrv as nanji
    from websrv import webchunzisrv as chunzi
except Exception as e:   # pragma: no cover
    pytest.skip('kinastro websrv unavailable: %s' % e, allow_module_level=True)


def test_nanji_password_simplified_normalizes_to_traditional_key():
    assert nanji._normalize_password_code('海异山同') == '海異山同'
    assert nanji._normalize_password_code('海異山同') == '海異山同'
    assert nanji._normalize_password_code('则要荆茨') == '則要荊茨'
    assert nanji._normalize_password_code('天地局') == '天地局'
    assert nanji._normalize_password_code('') == ''
    assert nanji._normalize_password_code('不存在的码') == '不存在的码'


def test_chunzi_mansion_simplified_aliases_cover_all_simplified_forms():
    for simp, trad in chunzi.MANSION_ALIASES.items():
        assert trad in chunzi.MANSIONS_28, trad
    assert chunzi.MANSION_ALIASES['虚'] == '虛'
    assert chunzi.MANSION_ALIASES['参'] == '參'


def test_xianqin_manual_lunar_empty_falls_back_to_accurate_lunar():
    sxtwl = pytest.importorskip('sxtwl')
    from websrv import webxianqinsrv as xq
    import inspect
    src = inspect.getsource(xq)
    assert '_auto_y, _auto_m, _auto_d, _auto_leap = _lunar_from_solar(dt, timezone)' in src
    assert 'to_int(data.get("lunarYear"), _auto_y)' in src
    assert 'to_int(data.get("lunarYear"), dt.year)' not in src


def test_cetian_location_row_omitted_when_no_name():
    from websrv import webcetiansrv as ct
    import inspect
    src = inspect.getsource(ct)
    assert '"星阙地点"' not in src
    assert '*([row("地点", pan.get("location"))] if pan.get("location") else [])' in src
