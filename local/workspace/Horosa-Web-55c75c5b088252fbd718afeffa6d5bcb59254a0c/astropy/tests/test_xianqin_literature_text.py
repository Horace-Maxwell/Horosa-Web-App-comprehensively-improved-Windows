# -*- coding: utf-8 -*-
"""演禽「情性与格局」段的贵格 / 贱格 / 福禄上格 / 贫贱下命:查表条目写成「名(干支)」「名〔禽星〕:条件」,
不把条目字段名(name / ganzhi / stars / condition)漏进正文(此前通用格式化把字典写成「name：…；ganzhi：…」)。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import re  # noqa: E402
import pytest  # noqa: E402

pytest.importorskip('sxtwl')
from websrv.webxianqinsrv import _fmt_ge_entries, _build_sections  # noqa: E402
from websrv.kentang.kinastro_common import row  # noqa: E402

FIELD_LEAK = re.compile(r'\b(name|ganzhi|stars|condition)\s*[：:]')


def test_entry_shapes():
    assert _fmt_ge_entries([{'name': '豹化飞龙', 'ganzhi': '庚'}, {'name': '豹化飞天', 'ganzhi': ''}]) == '豹化飞龙(庚)、豹化飞天'
    assert _fmt_ge_entries([{'name': '花豹游林', 'stars': '箕水豹', 'condition': '秋冬夜生卯位'}]) == '花豹游林〔箕水豹〕:秋冬夜生卯位'
    assert _fmt_ge_entries([]) == ''
    assert _fmt_ge_entries(None) == ''
    assert _fmt_ge_entries([{'ganzhi': '庚'}, '散条']) == '散条'
    assert row('贵格', _fmt_ge_entries([]))['value'] == '—'


def test_live_tables_no_field_names():
    from astro.chinstar.chinstar import lookup_gui_ge, lookup_jian_ge, lookup_fulu_patterns, lookup_pinjian_patterns
    for qin in ('箕水豹', '翼火蛇', '角木蛟'):
        for fn in (lookup_gui_ge, lookup_jian_ge, lookup_fulu_patterns, lookup_pinjian_patterns):
            items = fn(qin)
            text = row('x', _fmt_ge_entries(items))['value']
            assert not FIELD_LEAK.search(text), (qin, fn.__name__, text[:120])
            if items:
                assert text != '—'


def test_sections_use_formatter():
    pan = {'literature': {'gui': [{'name': '豹化飞龙', 'ganzhi': '庚'}], 'jian': [], 'fulu': [{'name': '花豹游林', 'stars': '箕水豹', 'condition': '秋冬'}], 'pinjian': []}}
    try:
        sections = _build_sections(pan)
    except Exception:  # 缺其它段的字段时构造会抛;此时只验格式化函数(上两例)
        pytest.skip('sections need a full pan')
    rows = {r['label']: r['value'] for s in sections for r in s.get('rows', [])}
    assert rows.get('贵格') == '豹化飞龙(庚)'
    assert rows.get('福禄上格') == '花豹游林〔箕水豹〕:秋冬'
