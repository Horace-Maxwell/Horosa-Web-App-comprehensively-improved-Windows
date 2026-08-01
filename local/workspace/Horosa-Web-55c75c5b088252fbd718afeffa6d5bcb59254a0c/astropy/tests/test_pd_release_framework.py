# -*- coding: utf-8 -*-
"""主限法 · 框架维守卫(P0-4:hyleg 选定 / anareta 集 / 界行主表)。

  release:hyleg 自动定(五释放位置 1>10>11>7>9 × 昼夜 sect 候选序)→ S=hyleg、
          P=anareta(凶星本体+全相射线;其余行星仅刑/冲);强制免责,不出寿命年数。
  bounds:S=ASC、P=埃及界分界线(到 ASC 轴闭式=上升时间同源)。
  默认 pdFramework='aspect' → 主表路径字节零回归(golden 另行看守)。
"""
import json

import pytest

from astrostudy import perchart, perpredict
from astrostudy.pd_release import (
    APHETIC_HOUSES, RELEASE_DISCLAIMER, house_of, hyleg_candidate_order,
    select_hyleg, anareta_promissors,
)


BASE = {
    'date': '1990/03/15', 'time': '12:30:00', 'zone': '+08:00',
    'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 'PLACIDUS',
    'pdTimeKey': 'Ptolemy', 'pdYears': 100,
    'pdtype': 0, 'pdaspects': [0, 60, 90, 120, 180],
}


def _rows(**over):
    cd = dict(BASE)
    cd.update(over)
    return perpredict.PerPredict(perchart.PerChart(cd)).getPrimaryDirection()


def test_default_aspect_framework_byte_identical():
    a = json.dumps(_rows(), default=str)
    b = json.dumps(_rows(pdFramework='aspect'), default=str)
    assert a == b


def test_aphetic_priority_and_sect_order():
    assert APHETIC_HOUSES == (1, 10, 11, 7, 9)
    assert hyleg_candidate_order(True)[:3] == ('Sun', 'Moon', 'Asc')
    assert hyleg_candidate_order(False)[:3] == ('Moon', 'Sun', 'Asc')


def test_select_hyleg_unit():
    cusps = [i * 30.0 for i in range(12)]   # 白羊起等宫
    # 昼生:Sun 落 2 宫(非释放)→ Moon 落 10 宫(释放)被选
    sel = select_hyleg({'Sun': 45.0, 'Moon': 275.0, 'Asc': 5.0}, cusps, True)
    assert sel['hyleg']['name'] == 'Moon' and sel['hyleg']['house'] == 10
    # 日月都不合格 → ASC 兜底(恒 1 宫)
    sel2 = select_hyleg({'Sun': 45.0, 'Moon': 75.0, 'Asc': 5.0}, cusps, True)
    assert sel2['hyleg']['name'] == 'Asc' and sel2['hyleg']['house'] == 1
    # 夜生序:Moon 合格即优先于 Sun
    sel3 = select_hyleg({'Sun': 275.0, 'Moon': 280.0, 'Asc': 5.0}, cusps, False)
    assert sel3['hyleg']['name'] == 'Moon'


def test_house_of_boundaries():
    cusps = [i * 30.0 for i in range(12)]
    assert house_of(0.0, cusps) == 1
    assert house_of(29.999, cusps) == 1
    assert house_of(30.0, cusps) == 2
    assert house_of(359.9, cusps) == 12


def test_anareta_promissor_semantics():
    pts = {'Saturn': {'lon': 10.0, 'lat': 1.0}, 'Venus': {'lon': 100.0, 'lat': -1.0}}
    proms = anareta_promissors(pts)
    ids = {p['id'] for p in proms}
    # 凶星:本体+全相
    assert 'N_Saturn_0' in ids and 'D_Saturn_60' in ids and 'S_Saturn_120' in ids and 'N_Saturn_180' in ids
    # 吉星:仅刑/冲
    assert 'D_Venus_90' in ids and 'N_Venus_180' in ids
    assert 'N_Venus_0' not in ids and 'D_Venus_60' not in ids and 'D_Venus_120' not in ids


def test_release_rows_all_sig_hyleg_and_disclaimer():
    cd = dict(BASE)
    cd['pdFramework'] = 'release'
    pp = perpredict.PerPredict(perchart.PerChart(cd))
    info = pp.getPdReleaseInfo()
    rows = pp.getPrimaryDirection()
    assert info['hyleg'] and info['hyleg']['house'] in APHETIC_HOUSES
    assert '不应据以预测真实寿命' in info['disclaimer']
    assert '预测寿命' not in json.dumps([r[1] for r in rows], ensure_ascii=False)
    assert rows and all(r[2] == 'N_%s_0' % info['hyleg']['name'] for r in rows)
    for r in rows:
        assert len(r) == 5


def test_release_nocturnal_prefers_moon_first():
    cd = dict(BASE)
    cd.update({'time': '23:30:00', 'pdFramework': 'release'})
    info = perpredict.PerPredict(perchart.PerChart(cd)).getPdReleaseInfo()
    assert info['candidates'][0]['name'] == 'Moon'


def test_bounds_rows_all_terms_to_asc():
    rows = _rows(pdFramework='bounds')
    assert rows
    assert all(r[1].startswith('T_') and r[2] == 'N_Asc_0' and len(r) == 5 for r in rows)


def test_disclaimer_constant_wording():
    assert '技术的还原' in RELEASE_DISCLAIMER and '不应据以预测真实寿命' in RELEASE_DISCLAIMER
