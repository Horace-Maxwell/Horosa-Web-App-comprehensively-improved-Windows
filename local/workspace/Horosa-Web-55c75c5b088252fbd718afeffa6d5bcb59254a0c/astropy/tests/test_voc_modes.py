# -*- coding: utf-8 -*-
"""月亮空亡六口径请求级参数化哨兵(chartdynamics.isVOC(mode, includeOuter))。

判据:
  ① 缺省/classic/backend/lilly 四写法 == 历史实现逐字节(零回归锚);
  ② 新五口径与「入相 orb 列表」公式逐一对齐(与前端 moon.js 六模式同数学);
  ③ exempt4 = lilly 判空 ∧ 月座∉四豁免座;
  ④ includeOuter 单调性:目标星集扩三王星后「非空」只会更多不会更少;
  ⑤ perchart 集成:data.vocMode 透传 → obj.isVOC 随口径变。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra
from flatlib import const

BASE = {'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1, 'hsys': 1}
BASE2 = {'date': '2003/11/08', 'time': '21:15:00', 'zone': '+08:00', 'lat': '31N13', 'lon': '121E28', 'ad': 1, 'hsys': 1}


def _pc(base, **extra):
    data = dict(base)
    data.update(extra)
    pc = perchart.PerChart(astroextra.base_params(data))
    pc.getChartObj()
    return pc


def _moon_isvoc_from_chartobj(pc):
    for o in pc.getChartObj()['objects']:
        if getattr(o, 'id', None) == 'Moon':
            return bool(getattr(o, 'isVOC', False))
    raise AssertionError('no Moon')


def test_default_aliases_equal_legacy():
    pc = _pc(BASE)
    dyn = pc.dynchart
    legacy = dyn.isVOC(const.MOON)
    for alias in ('lilly', 'classic', 'backend', None, ''):
        assert dyn.isVOC(const.MOON, alias) == legacy, alias


def test_new_modes_match_orb_formula():
    for base in (BASE, BASE2):
        pc = _pc(base)
        dyn = pc.dynchart
        moon = pc.chart.get(const.MOON)
        for outer in (False, True):
            orbs = dyn._vocApplyingOrbs(const.MOON, outer)
            assert dyn.isVOC(const.MOON, 'by_sign_orb', outer) == (len(orbs) == 0)
            assert dyn.isVOC(const.MOON, 'kenodromia', outer) == (len(orbs) == 0)
            assert dyn.isVOC(const.MOON, 'by_orb', outer) == (not any(o <= 12.5 for o in orbs))
            remain = 30.0 - float(moon.signlon)
            assert dyn.isVOC(const.MOON, 'by_sign_perfect', outer) == (not any(o <= remain + 1e-9 for o in orbs))


def test_exempt4_relation():
    for base in (BASE, BASE2):
        pc = _pc(base)
        dyn = pc.dynchart
        moon = pc.chart.get(const.MOON)
        lilly = dyn.isVOC(const.MOON, 'lilly')
        exempt = dyn.isVOC(const.MOON, 'exempt4')
        if moon.sign in dyn._VOC_EXEMPT_SIGNS:
            assert exempt is False or lilly is False   # 判空则被豁免 → 恒非空
            if lilly:
                assert exempt is False
        else:
            assert exempt == lilly


def test_include_outer_monotone():
    for base in (BASE, BASE2):
        dyn = _pc(base).dynchart
        o7 = dyn._vocApplyingOrbs(const.MOON, False)
        o10 = dyn._vocApplyingOrbs(const.MOON, True)
        assert len(o10) >= len(o7)
        for mode in ('by_sign_orb', 'by_orb', 'by_sign_perfect', 'kenodromia'):
            if not dyn.isVOC(const.MOON, mode, False):
                assert not dyn.isVOC(const.MOON, mode, True), mode   # 七政已非空 → 加三王星仍非空


def test_perchart_integration_vocmode_passthrough():
    # ⑤:data.vocMode 进 obj.isVOC;classic 与缺省同值;某新口径与 dynchart 直算一致。
    a = _moon_isvoc_from_chartobj(_pc(BASE))
    b = _moon_isvoc_from_chartobj(_pc(BASE, vocMode='classic'))
    assert a == b
    pc_k = _pc(BASE, vocMode='kenodromia')
    assert _moon_isvoc_from_chartobj(pc_k) == pc_k.dynchart.isVOC(const.MOON, 'kenodromia', False)
    pc_o = _pc(BASE, vocMode='by_orb', vocIncludeOuter=1)
    assert _moon_isvoc_from_chartobj(pc_o) == pc_o.dynchart.isVOC(const.MOON, 'by_orb', True)
    # 未知口径防御:回落历史行为不抛。
    assert _moon_isvoc_from_chartobj(_pc(BASE, vocMode='__nope__')) == a
