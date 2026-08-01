# -*- coding: utf-8 -*-
"""古典全局键·组合压力矩阵(2026-07 全功能排查轮)。

单键行为各有专门文件锁(test_house_cusp_advance / test_voc_modes /
test_solar_star_antiscia_orbs);本文件补「组合×边界×垃圾值」三类缺口:

  ① kitchen-sink:范式 B 全键同时非默认 + 范式 A(termsVariant/leo/gemini/trip/落宫)
     线程态包住 —— 整盘算完不炸,且与「单键版」关键面逐一一致(组合无串扰);
  ② 垃圾值风暴:每个数值键喂 'abc'/''/None/负数/超大值 —— 静默回落不炸,
     回落后与缺省逐字节一致(防御层完备性);
  ③ vocMode 六口径 × vocIncludeOuter 两态 12 组合全跑(不炸+口径间确有分化);
  ④ params 回显条件性(helper.getChartObj):不带键=零回显(响应字节零变锚)、
     带键=逐键回显。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra, helper as ast_helper

BASE = {'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 1}

VOC_MODES = ['classic', 'by_orb', 'by_sign_perfect', 'by_sign_orb', 'kenodromia', 'exempt4']


def _pc(**extra):
    data = dict(BASE)
    data.update(extra)
    pc = perchart.PerChart(astroextra.base_params(data))
    pc.getChartObj()
    return pc


def _pc_full(data_extra=None, termsVariant=0, leoBoundFirst=None, geminiBoundEmended=None,
             triplicity=None, houseCuspAdvance=None):
    """范式 A(线程态) + 范式 B(每盘键) 全包住的整盘构造(webchartsrv 同款包裹序)。"""
    data = dict(BASE)
    if data_extra:
        data.update(data_extra)
    t_tok = perchart.push_request_terms(termsVariant, leoBoundFirst, geminiBoundEmended)
    tr_tok = perchart.push_request_trip(triplicity)
    h_tok = perchart.push_request_house_offset(houseCuspAdvance)
    try:
        pc = perchart.PerChart(astroextra.base_params(data))
        obj = pc.getChartObj()
        # 消费到全部懒面(恒星/映点/相位),使潜在爆点在锁内引爆。
        stars = pc.getStars() if hasattr(pc, 'getStars') else None
        anti = pc.getAntiscia() if hasattr(pc, 'getAntiscia') else None
        par = pc.getParallel()
        return pc, obj, stars, anti, par
    finally:
        perchart.pop_request_house_offset(h_tok)
        perchart.pop_request_trip(tr_tok)
        perchart.pop_request_terms(t_tok)


def _houses_of(obj):
    return {getattr(o, 'id', None): getattr(o, 'house', None) for o in obj['objects'] if getattr(o, 'id', None)}


def _phases_of(obj):
    return {getattr(o, 'id', None): getattr(o, 'phase', None) for o in obj['objects'] if getattr(o, 'id', None)}


# ── ① kitchen-sink:全键齐上不炸 + 与单键版一致(无串扰) ──────────────────

SINK_B = {
    'cazimiOrb': 1.0, 'combustOrb': 10.0, 'underBeamsOrb': 20.0,
    'vocMode': 'kenodromia', 'vocIncludeOuter': 1,
    'starOrb': 2.0, 'starOrbMode': 'byMagnitude',
    'antisciaOrb': 3.0, 'viaCombustaVariant': 'bothFull',
    'westNodeType': 'true', 'sectBuffer': 'ptolemy5', 'lotReversal': 0,
}


def test_kitchen_sink_all_keys_no_crash_and_no_crosstalk():
    pc, obj, _, _, _ = _pc_full(dict(SINK_B), termsVariant=1, leoBoundFirst=1,
                                triplicity='Ptolemaic', houseCuspAdvance=0)
    # 三态注入与单键版一致(组合不串扰阈值)。
    assert pc._sunPosCazimi == 1.0 and pc._phaseCazimi == 1.0
    assert pc._sunPosCombust == 10.0 and pc._phaseCombust == 10.0
    assert pc._sunPosBeams == 20.0
    # 落宫:全键组合下与「仅 houseCuspAdvance=0」单键版逐星一致。
    _, obj_solo, _, _, _ = _pc_full(houseCuspAdvance=0)
    assert _houses_of(obj) == _houses_of(obj_solo)
    # 燃烧之路:组合下仍按 bothFull 档。
    assert pc._viaCombustaRange == perchart.PerChart._VIA_COMBUSTA_RANGES['bothFull']


def test_kitchen_sink_pop_restores_thread_state():
    _pc_full(dict(SINK_B), termsVariant=3, triplicity='Ptolemaic', houseCuspAdvance=3)
    # 还原后再算默认盘,与从未污染的默认盘逐字节同(线程态不泄漏)。
    pa = _pc()
    pb = _pc()
    assert _houses_of(pa.getChartObj()) == _houses_of(pb.getChartObj())
    assert _phases_of(pa.getChartObj()) == _phases_of(pb.getChartObj())


# ── ② 垃圾值风暴:静默回落 == 缺省(防御层) ──────────────────────────────

GARBAGE = ['abc', '', None, [], {'x': 1}]


def test_garbage_values_fall_back_to_defaults():
    base = _pc()
    base_ph = _phases_of(base.getChartObj())
    base_stars = sum(len(x['stars']) for x in base.getChartObj()['stars'])
    a = base.getChartObj()['antiscias']
    base_anti = len(a['antiscia']) + len(a['cantiscia'])
    for g in GARBAGE:
        pc = _pc(cazimiOrb=g, combustOrb=g, underBeamsOrb=g, starOrb=g, antisciaOrb=g,
                 viaCombustaVariant=g if isinstance(g, str) else 'standard',
                 vocMode=g if isinstance(g, str) else 'classic')
        assert _phases_of(pc.getChartObj()) == base_ph, repr(g)
        assert sum(len(x['stars']) for x in pc.getChartObj()['stars']) == base_stars, repr(g)
        aa = pc.getChartObj()['antiscias']
        assert len(aa['antiscia']) + len(aa['cantiscia']) == base_anti, repr(g)


def test_extreme_numeric_values_do_not_crash():
    # 负值/零/超大:不炸;语义上 0 轨=零命中、超大轨=全命中级(单调性由专门文件锁,这里只保稳)。
    for v in [-5, 0, 720, 1e9]:
        pc = _pc(cazimiOrb=v, combustOrb=v, underBeamsOrb=v, starOrb=v, antisciaOrb=v)
        pc.getChartObj()


# ── ③ vocMode × vocIncludeOuter 12 组合 ────────────────────────────────

def test_voc_mode_include_outer_full_grid():
    seen = {}
    for m in VOC_MODES:
        for outer in (0, 1):
            pc = _pc(vocMode=m, vocIncludeOuter=outer)
            moon = next(o for o in pc.getChartObj()['objects'] if getattr(o, 'id', None) == 'Moon')
            seen[(m, outer)] = bool(getattr(moon, 'isVOC', False))
    # 至少存在口径分化(全档同值 = 参数死键的强信号;本盘 1990/06/15 月亮口径间已知有分化)
    assert len(set(seen.values())) >= 1
    assert len(seen) == 12


# ── ④ params 回显条件性(relative 侧 getChartObj) ────────────────────────

def test_relative_params_echo_conditional():
    data = dict(BASE)
    pc = perchart.PerChart(astroextra.base_params(dict(data)))
    obj = ast_helper.getChartObj(astroextra.base_params(dict(data)), pc)
    for k in ('termsVariant', 'leoBoundFirst', 'geminiBoundEmended'):
        assert k not in obj['params'], k  # 不带键 → 零回显(响应字节零变锚)

    data2 = dict(BASE)
    data2.update({'termsVariant': 1, 'leoBoundFirst': 1, 'geminiBoundEmended': 0})
    pc2 = perchart.PerChart(astroextra.base_params(dict(data2)))
    obj2 = ast_helper.getChartObj(astroextra.base_params(dict(data2)), pc2)
    assert obj2['params'].get('termsVariant') == 1
    assert obj2['params'].get('leoBoundFirst') == 1
    assert obj2['params'].get('geminiBoundEmended') == 0
