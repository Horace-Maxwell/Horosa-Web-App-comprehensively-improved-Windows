# [SURF 制度化] 条件性键「特殊时刻场景库」引擎差分套件(用户明令:所有特殊时刻全检+制度化)。
# 每个此前「条件未触发」的键,绑定一个固定历史时刻(扫描实找,可复现),断言双档结果可分辨。
# 判据走 getChartObj() 序列化面=与响应同构;objects 元素为 flatlib 对象,统一 gv() 双形态访问。
import pytest

from astrostudy.perchart import PerChart, push_classical_request, pop_classical_request

BJ = {'zone': '+08:00', 'lat': '39n54', 'lon': '116e28', 'hsys': 5}


def chartobj(date, time, **extra):
    data = {'date': date, 'time': time, **BJ, **extra}
    tok = push_classical_request(data)
    try:
        pc = PerChart(data)
        pc.getAspects()   # sunPos(太阳三态)在相位分类阶段赋值,响应链同序
        return pc.getChartObj()
    finally:
        pop_classical_request(tok)


def gv(o, k, d=None):
    if o is None:
        return d
    return o.get(k, d) if isinstance(o, dict) else getattr(o, k, d)


def obj(co, oid):
    for o in gv(co, 'objects') or []:
        if gv(o, 'id') == oid:
            return o
    return None


def test_voc_modes_disagree_at_scanned_moment():
    # 2026-08-20 14:00 北京:classic=False / kenodromia=True / by_sign_perfect=True(扫描实找)。
    va = bool(gv(obj(chartobj('2026/08/20', '14:00:00'), 'Moon'), 'isVOC'))
    vb = bool(gv(obj(chartobj('2026/08/20', '14:00:00', vocMode='kenodromia'), 'Moon'), 'isVOC'))
    vc = bool(gv(obj(chartobj('2026/08/20', '14:00:00', vocMode='by_sign_perfect'), 'Moon'), 'isVOC'))
    assert va is False and vb is True and vc is True


def test_via_combusta_narrow_vs_standard_at_libra16():
    # 2026-09-13 14:00 月亮 196.7°(天秤 16.7°):standard 在凶区内 / narrow(天秤28°-天蝎7°)在外。
    v_std = bool(gv(obj(chartobj('2026/09/13', '14:00:00'), 'Moon'), 'isViaCombust'))
    v_nar = bool(gv(obj(chartobj('2026/09/13', '14:00:00', viaCombustaVariant='narrow'), 'Moon'), 'isViaCombust'))
    assert v_std is True and v_nar is False


def test_cazimi_orb_flips_state_at_mercury_conjunction():
    # 2026-08-27 08:00 水星距日 0.71°(42.6′):17′ 档=Combust / 1° 档=Cazimi。
    s_t = str(gv(obj(chartobj('2026/08/27', '08:00:00'), 'Mercury'), 'sunPos'))
    s_w = str(gv(obj(chartobj('2026/08/27', '08:00:00', cazimiOrb=1), 'Mercury'), 'sunPos'))
    assert s_t == 'Combust' and s_w == 'Cazimi'


def test_under_beams_orb_flips_father_lot_at_saturn_16deg():
    # 2027-03-20 土星距日 16.03°(15°<d<17°)。sunPos 面在默认容许度体系下罩不到 15-17° 带
    # (合相分类 orb 上限≈日轨 15°,实现语义);underBeamsOrb 的可判面=父点土星伏替代式:
    # 17° 档触发替代公式(父点=ASC+木-火系),15° 档不触发 → 父点位置必分岔。
    from flatlib.tools import arabicparts as ap

    def father_lon(**extra):
        data = {'date': '2027/03/20', 'time': '12:00:00', **BJ, 'lotFatherCombustAlt': 1, **extra}
        tok = push_classical_request(data)
        try:
            return PerChart(data).chart.get(ap.PARS_FATHER).lon   # 父点在 chart 对象层(不进 objects 序列化)
        finally:
            pop_classical_request(tok)
    f17 = father_lon()
    f15 = father_lon(underBeamsOrb=15)
    assert abs(((f17 - f15) + 180) % 360 - 180) > 1.0   # 实测 20.04° 分岔


def test_lot_fortune_variant_diverges_daytime_moon_up():
    # 2026-08-19 14:00 昼盘+月在地平上:标准昼式 vs 「月上恒夜式」福点必分岔。
    co_std = chartobj('2026/08/19', '14:00:00')
    co_var = chartobj('2026/08/19', '14:00:00', lotFortuneVariant='moonAboveNight')
    assert bool(gv(co_std, 'isDiurnal')) is True
    assert bool(gv(obj(co_std, 'Moon'), 'aboveHorizon')) is True
    f_std = gv(obj(co_std, 'Pars Fortuna'), 'lon')
    f_var = gv(obj(co_var, 'Pars Fortuna'), 'lon')
    assert abs(f_std - f_var) > 1.0


def test_own_chariot_exempts_combust_mercury_in_own_term():
    # 2026-08-20 08:00 水星 Combust 且落自己界(term=Mercury):开 own chariot 后免燃烧。
    s_b = str(gv(obj(chartobj('2026/08/20', '08:00:00'), 'Mercury'), 'sunPos'))
    s_e = str(gv(obj(chartobj('2026/08/20', '08:00:00', combustOwnChariotExempt=1), 'Mercury'), 'sunPos'))
    assert s_b == 'Combust'
    assert s_e != 'Combust'


def test_sect_buffer_flips_at_dawn_window():
    # 日出前 ~16 分钟(2026-08-19 北京日出 05:36):geo=夜盘 / ptolemy5=昼盘。
    d_geo = bool(gv(chartobj('2026/08/19', '05:20:00'), 'isDiurnal'))
    d_p5 = bool(gv(chartobj('2026/08/19', '05:20:00', sectBuffer='ptolemy5'), 'isDiurnal'))
    assert d_geo is False and d_p5 is True


def test_topocentric_moon_shifts_lon():
    # 站心月:该时刻月黄经修正 >0.2°(近地月可达 ~1°)。
    g = gv(obj(chartobj('2026/08/19', '14:00:00'), 'Moon'), 'lon')
    t = gv(obj(chartobj('2026/08/19', '14:00:00', topocentricMoon=1), 'Moon'), 'lon')
    assert abs(g - t) > 0.2


def test_outer_trio_conjunction_1993():
    # 1993-02-01 天海合 0.02°:三王星间相位线的可见场景锚。
    co = chartobj('1993/02/01', '12:00:00')
    sep = abs((gv(obj(co, 'Uranus'), 'lon') - gv(obj(co, 'Neptune'), 'lon') + 180) % 360 - 180)
    assert sep < 1.0
