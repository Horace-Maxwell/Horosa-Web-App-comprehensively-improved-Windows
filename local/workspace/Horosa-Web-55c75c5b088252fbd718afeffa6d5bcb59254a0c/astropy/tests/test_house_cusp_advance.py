# -*- coding: utf-8 -*-
"""落宫宫头前移(five-degree rule)请求级参数化哨兵。

flatlib House._OFFSET=-5.0(传统 5° 律)历史硬编码;本轮经 push_request_house_offset 参数化,
选项 5(默认)/3/1/0。判据:
  ① 全行星落宫恒等于「有效窗 [cusp-adv, cusp-adv+size)」公式值(逐档全星覆盖,不挑探针);
  ② 缺省/显式 5 与旧行为逐字节一致(零回归锚);
  ③ 整宫制天然豁免(0 与 5 两档落宫全同);
  ④ push/pop 令牌机制:还原后 House._OFFSET 回 -5,默认档不取锁(token=None);
  ⑤ 宫头随当前分宫制(Alcabitius/Regiomontanus 各按自家宫头前移——由 ① 公式对两宫制分别成立涵盖)。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from astrostudy import perchart, astroextra
from flatlib import object as flobject

BASE = {'date': '1990/06/15', 'time': '10:30:00', 'zone': '+08:00', 'lat': '39N54', 'lon': '116E28', 'ad': 1}


def _chart_houses_and_objects(hsys, advance=None):
    data = dict(BASE)
    data['hsys'] = hsys
    if advance is not None:
        data['houseCuspAdvance'] = advance
    token = perchart.push_request_house_offset(data.get('houseCuspAdvance'))
    try:
        pc = perchart.PerChart(astroextra.base_params(data))
        chartobj = pc.getChartObj()
    finally:
        perchart.pop_request_house_offset(token)
    houses = [(h.id, h.lon, h.size) for h in pc.chart.houses]
    placements = {}
    for o in chartobj['objects']:
        oid = getattr(o, 'id', None) or (o.get('id') if isinstance(o, dict) else None)
        oh = getattr(o, 'house', None) or (o.get('house') if isinstance(o, dict) else None)
        ol = getattr(o, 'lon', None) if not isinstance(o, dict) else o.get('lon')
        if oid and oh and ol is not None:
            placements[oid] = (float(ol), oh)
    return houses, placements


def _expected_house(lon, houses, adv):
    # 与 flatlib angle.distance 完全同式:单次 % 360(Python 负数取模已落 [0,360))。
    # 勿写 `(x%360+360)%360` 双模——+360 会引入 1ulp 浮点损失,把「rel==size 恰不命中」的
    # 边界(四角落在下一宫头精确同值)误判成命中上一宫(本测试首跑实抓)。
    for hid, clon, size in houses:
        rel = (lon - (clon - adv)) % 360.0
        if rel < size:
            return hid
    return None


def test_all_planets_match_window_formula_per_advance_and_hsys():
    # ① + ⑤:两种象限宫制 × 四档前移,全行星落宫 == 有效窗公式值(宫头取各自宫制自家宫表)。
    # hsys 用前端数字口径(getHSys:1=Alcabitius/2=Regiomontanus)——字符串 'ALCABITUS' 会被
    # getHSys 静默回落整宫(本测试首跑即抓到该坑),数字才是真象限制。
    for hsys in (1, 2):
        for adv in (5, 3, 1, 0):
            houses, placements = _chart_houses_and_objects(hsys, adv)
            assert placements, (hsys, adv)
            # 象限制自证:宫头不全在座首(整宫的 size 全 30 且 cusp%30==0)。
            assert any(abs(clon % 30.0) > 1e-6 for _, clon, _ in houses), houses
            for oid, (lon, oh) in placements.items():
                exp = _expected_house(lon, houses, float(adv))
                assert oh == exp, (hsys, adv, oid, lon, oh, exp)


def test_default_and_explicit_five_are_byte_identical():
    # ②:缺省(不带键) == 显式 5 == 旧硬编码行为(零回归锚)。
    houses_a, pa = _chart_houses_and_objects(1, None)
    houses_b, pb = _chart_houses_and_objects(1, 5)
    assert pa == pb
    assert houses_a == houses_b
    for oid, (lon, oh) in pa.items():
        assert oh == _expected_house(lon, houses_a, 5.0), (oid, lon, oh)


def test_whole_sign_immune():
    # ③:整宫制 inHouse 分支无偏移 → 0 与 5 两档全星落宫一致。
    _, p0 = _chart_houses_and_objects(0, 0)      # hsys=0 → 整宫(getHSys 前端 0 映射)
    _, p5 = _chart_houses_and_objects(0, 5)
    assert p0 == p5


def test_push_pop_token_and_restore():
    # ④:默认档不取锁(token None);非默认换值后 pop 必还原 -5;setOffset 修复后真改类属性。
    assert perchart.push_request_house_offset(None) is None
    assert perchart.push_request_house_offset('garbage') is None      # 畸形回默认,不取锁
    assert flobject.House._OFFSET == -5.0
    token = perchart.push_request_house_offset(3)
    try:
        assert flobject.House._OFFSET == -3.0
    finally:
        perchart.pop_request_house_offset(token)
    assert flobject.House._OFFSET == -5.0
    # setOffset 死 bug 修复自证:实例方法真改类属性。
    h = flobject.House()
    h.setOffset(-1.0)
    assert flobject.House._OFFSET == -1.0
    h.setOffset(-5.0)
    assert flobject.House._OFFSET == -5.0
