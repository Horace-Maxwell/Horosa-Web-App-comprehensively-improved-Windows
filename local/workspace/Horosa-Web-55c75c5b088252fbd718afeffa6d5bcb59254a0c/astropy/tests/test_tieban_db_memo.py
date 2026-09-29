# -*- coding: utf-8 -*-
"""铁板神数诗词库 / 足本条文库按进程只载一次 + 分类索引检索(HOROSA_TIEBAN_DB_MEMO)。

原每次排盘新建计算器都重读两份 JSON,分类检索每次全表线性扫。现共享只读的已载入数据与分类索引。
判据:分类索引检索与线性扫逐项相同(含不存在的分类 / None);/tieban/pan 多种请求形态缓存开 / 关逐字节同,
缓存开时正序、倒序各跑一遍也相同(无串染)且两份库各只载一次;足本条文 get 返回副本,改它不影响共享库。
"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

import cherrypy  # noqa: E402

from websrv.kentang.registry import KENTANG_SERVICE_SPECS, _load_service  # noqa: E402

_SVC = _load_service([s for s in KENTANG_SERVICE_SPECS if s['mount'] == '/tieban'][0])   # 载入即设好 kinastro 路径
import astro.tieban.tieban_calculator as TC  # noqa: E402

BASE = {
    'year': 1990, 'month': 5, 'day': 18, 'hour': 10, 'minute': 0, 'second': 0,
    'date': '1990-05-18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27',
    'gender': '1', 'after23NewDay': 1, 'lateZiHourUseNextDay': 1, 'method': 'kunji', 'startAge': 0, 'dayunSteps': 8,
}
VARIANTS = [
    {},
    {'gender': '0'},
    {'method': 'suanpan'},
    {'year': 1966, 'month': 11, 'day': 3, 'hour': 23, 'minute': 40, 'date': '1966-11-03', 'time': '23:40:00'},
    {'year': 2024, 'month': 2, 'day': 10, 'hour': 5, 'minute': 5, 'date': '2024-02-10', 'time': '05:05:00', 'gender': '0'},
    {'yearGz': '甲子', 'monthGz': '丙寅', 'dayGz': '戊辰', 'hourGz': '庚申'},
    {'fatherBirthYear': '1950', 'motherBirthYear': '1952', 'siblingsInfo': '兄弟二人', 'maritalStatus': '已婚', 'childrenInfo': '一子'},
    {'startAge': 10, 'dayunSteps': 12},
    {'year': 1900, 'month': 1, 'day': 1, 'hour': 0, 'minute': 0, 'date': '1900-01-01', 'time': '00:00:00'},
]


def _run(variants):
    outs = []
    for v in variants:
        payload = dict(BASE)
        payload.update(v)
        cherrypy.request.json = payload
        cherrypy.request.method = 'POST'
        cherrypy.request.headers = {}
        out = _SVC.pan()
        outs.append(out.decode('utf-8') if isinstance(out, bytes) else out)
    return outs


def test_category_index_matches_linear_scan(monkeypatch):
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO', {})
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO_ON', True)
    db = TC.VerseDatabase()
    assert getattr(db, '_cat_index', None) is not None
    cats = sorted({v.get('category') for v in db.verses.values()}, key=lambda x: (x is None, str(x)))
    assert len(cats) >= 3
    for cat in cats + ['不存在的分类', None]:
        fast = db.search_by_category(cat)
        saved = db._cat_index
        db._cat_index = None           # 同一实例走原线性扫
        slow = db.search_by_category(cat)
        db._cat_index = saved
        assert fast == slow, cat


def test_pan_identical_memo_on_off_no_bleed_and_loaded_once(monkeypatch):
    loads = []
    real_load = TC.json.load

    def counting_load(fp, *a, **kw):
        loads.append(os.path.basename(getattr(fp, 'name', '')))
        return real_load(fp, *a, **kw)

    monkeypatch.setattr(TC.json, 'load', counting_load)
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO', {})
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO_ON', True)
    on = _run(VARIANTS)
    on_rev = list(reversed(_run(list(reversed(VARIANTS)))))
    assert loads.count('verses.json') == 1
    assert loads.count('tiaowen_full_12000.json') == 1
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO_ON', False)
    off = _run(VARIANTS)
    assert loads.count('verses.json') > 1            # 关:每次各自载入(旧行为)
    for v, a, b, c in zip(VARIANTS, on, on_rev, off):
        assert a == c, v
        assert a == b, v
        assert '"err"' not in a[:60], v


def test_tiaowen_get_returns_copy(monkeypatch):
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO', {})
    monkeypatch.setattr(TC, '_TIEBAN_DB_MEMO_ON', True)
    first = TC.TiaowenDatabase().get(1001)
    assert first is not None
    first['text'] = '被改'
    first['tiangan'].append('X')
    again = TC.TiaowenDatabase().get(1001)    # 新实例、同一共享库
    assert again['text'] != '被改'
    assert 'X' not in again['tiangan']
