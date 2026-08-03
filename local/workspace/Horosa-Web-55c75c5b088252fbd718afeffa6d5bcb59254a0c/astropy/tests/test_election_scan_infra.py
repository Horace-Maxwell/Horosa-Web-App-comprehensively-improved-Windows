# -*- coding: utf-8 -*-
"""R3 基建自证:LightMoment 新字段(lot/整宫/昼夜)与朔望缓存,逐项对拍 flatlib 权威实现。

对拍容差说明:flatchart 经 Datetime 字符串秒级截断,ASC 速 ~0.004°/s → lot 容差 0.05°;
朔望事件时刻同函数收敛,月 lon 容差 0.01°。昼夜 case 取远离晨昏界时刻
(flatlib chart.isDiurnal 是黄经半平面口径,与本引擎真地平口径仅在边界分钟级不同——
sect 单源=真地平,docstring 已声明)。
"""
import pytest
import swisseph

from astrostudy import election_scan as es
from astrostudy import election_scan_ext as ext
from astrostudy import election_scan_cores as cores


BASE = {
    'zone': '+08:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1,
}


def mk_ctx(**over):
    data = dict(BASE)
    data.update(over)
    ctx = es.ScanContext(data)
    ctx._syz_lo = swisseph.julday(2024, 4, 1, 0)
    ctx._syz_hi = swisseph.julday(2024, 5, 1, 0)
    return ctx


JD_DAY = swisseph.julday(2024, 4, 8, 4.0)     # 北京当地 12:00(正午,昼)
JD_NIGHT = swisseph.julday(2024, 4, 8, 16.5)  # 北京当地 00:30(深夜,夜)


def test_is_diurnal_geo_far_from_boundary():
    ctx = mk_ctx()
    assert ctx.moment(JD_DAY).is_diurnal('geo') is True
    assert ctx.moment(JD_NIGHT).is_diurnal('geo') is False


def test_is_diurnal_ptolemy5_dawn_buffer():
    """拂晓窗:存在太阳在地平下(geo=False)但距上升 ≤5°(ptolemy5=True)的时刻。"""
    ctx = mk_ctx()
    found = False
    jd = swisseph.julday(2024, 4, 7, 20.0)  # 北京当地 04:00 起扫 2.5h
    for i in range(75):
        m = ctx.moment(jd + i * (2.0 / 1440.0))
        if not m.is_diurnal('geo') and m.is_diurnal('ptolemy5'):
            found = True
            break
    assert found


@pytest.mark.parametrize('jd', [JD_DAY, JD_NIGHT])
@pytest.mark.parametrize('lot,fid', [
    ('fortuna', 'Pars Fortuna'),
    ('spirit', 'Pars Spirit'),
    ('basis', 'Pars Basis'),
    ('exaltation', 'Pars Exaltation'),
])
def test_lot_lon_vs_flatlib_arabicparts(jd, lot, fid):
    from flatlib.tools import arabicparts as ap
    ctx = mk_ctx()
    m = ctx.moment(jd)
    mine = m.lot_lon(lot)
    ref = ap.partLon(fid, m.flatchart()) % 360.0
    assert abs(cores._wrap180(mine - ref)) < 0.05, (lot, mine, ref)


def test_lot_lon_sidereal_consistency():
    """恒星制:lot 公式全回归框架(Asc/Sun/Moon 同减 ayanamsa 后差值不变)→ 与回归制恒等。"""
    ctx_t = mk_ctx()
    ctx_s = mk_ctx(zodiacal=1, siderealAyanamsa='lahiri')
    for lot in ('fortuna', 'spirit', 'basis', 'exaltation'):
        a = ctx_t.moment(JD_DAY).lot_lon(lot)
        b = ctx_s.moment(JD_DAY).lot_lon(lot)
        assert abs(cores._wrap180(a - b)) < 1e-9, lot


def test_syzygy_before_vs_flatlib_object():
    from flatlib import const as fc
    ctx = mk_ctx()
    for jd in (JD_DAY, swisseph.julday(2024, 4, 20, 8.0), swisseph.julday(2024, 4, 28, 2.0)):
        ev_jd, ev_lon = ctx.syzygy_before(jd)
        assert ev_jd <= jd
        chart = ctx.moment(jd).flatchart()
        ref = chart.getObject(fc.SYZYGY).lon
        assert abs(cores._wrap180(ev_lon - ref)) < 0.01, (jd, ev_lon, ref)
    # 2024/04 域内事件数:朔 4/8 + 望 4/23 (+域前一枚),全部升序
    evs = ctx._syzygies
    assert len(evs) >= 3
    assert all(evs[i][0] < evs[i + 1][0] for i in range(len(evs) - 1))


def test_whole_sign_house_manual():
    ctx = mk_ctx()
    m = ctx.moment(JD_DAY)
    for pid in ('Sun', 'Moon', 'Saturn'):
        p_sign = int(m.lon(pid) // 30)
        a_sign = int(m.asc() // 30)
        assert m.whole_sign_house(pid) == (p_sign - a_sign) % 12 + 1


def test_seven_snapshot_fields():
    ctx = mk_ctx()
    m = ctx.moment(JD_DAY)
    snap = ext._seven_snapshot(m, ctx, need=('node', 'houses', 'rules', 'above', 'sect'))
    assert set(snap['bodies']) == set(cores.SEVEN)
    sun = snap['bodies']['Sun']
    assert abs(sun['lon'] - m.lon('Sun')) < 1e-12
    assert sun['sign_idx'] == int(m.lon('Sun') // 30)
    assert sun['house'] == es._house_index(m.lon('Sun'), m.houses())
    assert sun['above'] is True and snap['is_day'] is True
    assert 'node_lon' in snap
    # rules:12 宫头庙主反查,七政主宰宫并集=12 宫全覆盖(七政庙主体系无缺口)
    all_ruled = sorted(h for pid in cores.SEVEN for h in snap['bodies'][pid]['rule_houses'])
    assert all_ruled == list(range(1, 13))
    # memo:同 need 二次取 = 同对象
    assert ext._seven_snapshot(m, ctx, need=('node', 'houses', 'rules', 'above', 'sect')) is snap


def test_b_step_width_bounds():
    assert ext._b_step_width('Moon', 1.0) == pytest.approx(0.35 / es._MAX_SPEED['Moon'], rel=1e-6)
    assert ext._b_step_width('Saturn', 30.0) == 3.0   # 封顶
    assert ext._b_step_width('Moon', 0.05) >= 0.02    # 保底
