# -*- coding: utf-8 -*-
"""组合盘(中点组合)宫制:左栏所选宫制真生效(此前后端恒整宫 = 死开关)。

  ① 整宫(0)= 旧口径逐位不变:组合上升所在星座起第一宫,每宫 30°;
  ② 象限制:组合宫头 = 两盘同号宫头的短弧中点;第一宫头 = 组合上升,宫宽为正、一周 360°,
     回显 hsys = 所选;不同宫制合出不同宫头(只对第一宫头即上升的象限制断言「第一宫头 = 组合上升」);
  ③ 整宫一类的自定义宫制(福点整宫制)→ 按组合上升起整宫(不是按福点),宫对象 / 盘头宫制名都是整宫,回显 0 并附说明;
  ④ 合不出合法宫头 → 用整宫制重建后回落:落宫与直接选整宫完全一致(不残留原宫制的 5° 前移),附说明。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from flatlib import const
from astrostudy import astroextra
from astrostudy.modern.chartcomposite import ChartComposite

A = {'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1}
B = {'date': '1985/02/03', 'time': '22:10:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '121E28', 'ad': 1}


def _comp(hsys, a=A, b=B):
    return ChartComposite(astroextra.base_params(dict(a, hsys=hsys)), astroextra.base_params(dict(b, hsys=hsys))).compute()


def _cusps(res):
    return {int(h.id[5:7]): h for h in res['chart']['houses']}


def _mid(x, y):
    d = (x + y) / 2
    if abs(d - x) > 90:
        d = (d + 180) % 360
    return d % 360


def test_whole_sign_unchanged():
    res = _comp(0)
    cs = _cusps(res)
    asc = _mid(_asc(A, 0), _asc(B, 0))
    first = (int(asc / 30) % 12) * 30
    for hid in range(1, 13):
        assert abs(cs[hid].lon - (first + 30 * (hid - 1)) % 360) < 1e-9
        assert cs[hid].size == 30
    assert res['params']['hsys'] == 0
    assert 'compositeHouseNote' not in res


def _asc(d, hsys):
    from astrostudy.perchart import PerChart
    return PerChart(astroextra.base_params(dict(d, hsys=hsys))).chart.getAngle(const.ASC).lon


def test_quadrant_systems_take_effect():
    asc = _mid(_asc(A, 3), _asc(B, 3))
    seen = {}
    for hsys in (1, 2, 3, 4, 9, 10):   # Alcabitius / Regiomontanus / Placidus / Koch / Porphyry / Campanus
        res = _comp(hsys)
        cs = _cusps(res)
        assert res['params']['hsys'] == hsys
        assert 'compositeHouseNote' not in res
        assert abs(cs[1].lon - asc) < 1e-6                 # 第一宫头 = 组合上升
        assert abs(((cs[7].lon - cs[1].lon) % 360) - 180) < 1e-6
        sizes = [cs[h].size for h in range(1, 13)]
        assert all(0 < s < 180 for s in sizes)
        assert abs(sum(sizes) - 360) < 1e-6
        seen[hsys] = tuple(round(cs[h].lon, 4) for h in range(1, 13))
    assert len(set(seen.values())) == len(seen)              # 不同宫制 → 不同宫头(不再恒整宫)
    assert seen[3] != tuple(round(((int(asc / 30) % 12) * 30 + 30 * i) % 360, 4) for i in range(12))


def _placement(res):
    ch = res['chart']
    out = {}
    for o in ch['objects']:
        for hs in ch['houses']:
            if hs.hasObject(o):
                out[o.id] = hs.id
    return out


def test_whole_sign_family_custom_echoes_actual():
    res = _comp(24)   # 福点整宫制
    whole = _comp(0)
    assert res['params']['hsys'] == 0
    assert '整宫' in res.get('compositeHouseNote', '')
    cs = _cusps(res)
    assert all(cs[h].size == 30 for h in range(1, 13))
    # 第一宫 = 组合上升所在星座(不是组合福点所在星座),与直接选整宫完全一致
    assert cs[1].lon == _cusps(whole)[1].lon
    assert res['chart']['hsys'] == whole['chart']['hsys']
    assert all(getattr(h, 'hsys', None) == const.HOUSES_WHOLE_SIGN for h in res['chart']['houses'])
    assert _placement(res) == _placement(whole)


# 这对盘在 Alcabitus 下两盘宫头合不出合法宫序(实测),走真实的回落路径
FB_A = {'date': '1992/08/09', 'time': '00:23:00', 'zone': '+08:00', 'lat': '22N17', 'lon': '116E28', 'ad': 1}
FB_B = {'date': '1959/11/20', 'time': '06:33:00', 'zone': '+08:00', 'lat': '31N14', 'lon': '116E28', 'ad': 1}


def test_fallback_is_true_whole_sign_placement():
    res = _comp(1, FB_A, FB_B)
    whole = _comp(0, FB_A, FB_B)
    assert '合不出' in res.get('compositeHouseNote', '')
    assert res['params']['hsys'] == 0
    assert res['chart']['hsys'] == whole['chart']['hsys']
    assert all(getattr(h, 'hsys', None) == const.HOUSES_WHOLE_SIGN for h in res['chart']['houses'])
    assert _placement(res) == _placement(whole)
    assert _placement(res)['Asc'] == 'House1'


def test_invalid_cusps_fall_back_to_whole_sign(monkeypatch):
    monkeypatch.setattr(ChartComposite, 'midpointCusps', lambda self, a, b: None)
    res = _comp(3)
    assert res['params']['hsys'] == 0
    assert '合不出' in res.get('compositeHouseNote', '')
    assert all(h.size == 30 for h in res['chart']['houses'])
    assert _placement(res) == _placement(_comp(0))


POLAR = {'date': '1990/12/20', 'time': '10:30:00', 'zone': '+01:00', 'lat': '78N13', 'lon': '15E38', 'ad': 1}


def test_whole_sign_family_marks_derived_houses():
    # 改按组合上升起整宫时逐宫带 hsysDerived(前端据此标「整宫(组合上升)」并折叠宫主表);直接选整宫 / 象限制不带
    res = _comp(24)
    assert all(getattr(h, 'hsysDerived', None) == 'compositeWholeFromAsc' for h in res['chart']['houses'])
    for hsys in (0, 3):
        assert all(getattr(h, 'hsysDerived', None) is None for h in _comp(hsys)['chart']['houses'])


def test_polar_fallback_checks_both_charts():
    # 只有 B 在极区:此前取中 = A 的 Placidus 宫头与 B 的 Porphyry 宫头混合、无标记;
    # 现两盘统一 Porphyry 重建再取中 —— 宫头与直接选 Porphyry 完全相同,逐宫标回退,说明写明是星盘B
    from astrostudy.perchart import PerChart
    pb = PerChart(astroextra.base_params(dict(POLAR, hsys=3)))
    assert getattr(list(pb.chart.houses)[0], 'hsysFallback', None) == 'Porphyry'   # 前提:B 真在极区无解
    pa = PerChart(astroextra.base_params(dict(A, hsys=3)))
    assert getattr(list(pa.chart.houses)[0], 'hsysFallback', None) is None
    res = _comp(3, A, POLAR)
    por = _comp(9, A, POLAR)
    note = res.get('compositeHouseNote', '')
    assert '星盘B' in note and 'Porphyry' in note
    cs, cp = _cusps(res), _cusps(por)
    for hid in range(1, 13):
        assert abs(cs[hid].lon - cp[hid].lon) < 1e-9
        assert getattr(cs[hid], 'hsysFallback', None) == 'Porphyry'
    # A 在极区同理,说明写星盘A
    res2 = _comp(3, POLAR, B)
    assert '星盘A' in res2.get('compositeHouseNote', '')
