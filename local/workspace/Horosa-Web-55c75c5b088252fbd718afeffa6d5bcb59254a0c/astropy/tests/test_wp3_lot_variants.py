# [WP-3] 希腊点变体批双向量锚(perchart._applyLotVariants 一体后处理)。
import pytest
from astrostudy.perchart import PerChart
from flatlib import const
from flatlib.tools import arabicparts as ap

NIGHT = {'date': '1991/08/21', 'time': '02:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}
DAY = {'date': '1991/08/21', 'time': '12:00:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}


def test_schmidt_hermetic_same_formula():
    base = PerChart(dict(NIGHT))
    assert base.isDiurnal is False
    sch = PerChart({**NIGHT, 'hermeticLotsReversal': 0})
    # 夜盘:六点全部换昼式(至少精神点必变;昼式手算锚)
    sp0 = base.chart.get(ap.PARS_SPIRIT).lon
    sp1 = sch.chart.get(ap.PARS_SPIRIT).lon
    assert abs(sp0 - sp1) > 0.01
    asc = sch.chart.getAngle(const.ASC).lon
    sun = sch.chart.getObject(const.SUN).lon
    moon = sch.chart.getObject(const.MOON).lon
    assert abs(((asc + sun - moon) % 360.0) - sp1) < 1e-6   # 精神点昼式=Asc+Sun−Moon
    # 昼盘:开关零效果
    d0 = PerChart(dict(DAY))
    d1 = PerChart({**DAY, 'hermeticLotsReversal': 0})
    assert d0.chart.get(ap.PARS_SPIRIT).lon == d1.chart.get(ap.PARS_SPIRIT).lon


def test_valens_eros_necessity():
    va = PerChart({**NIGHT, 'erosConstruction': 'valens'})
    asc = va.chart.getAngle(const.ASC).lon
    pf = va.chart.getObject(const.PARS_FORTUNA).lon
    sp = va.chart.get(ap.PARS_SPIRIT).lon
    eros = va.chart.get(ap.PARS_EROS).lon
    nec = va.chart.get(ap.PARS_NECESSITY).lon
    assert abs(((asc + pf - sp) % 360.0) - eros) < 1e-6   # 夜:Eros=Asc+(福点−精神)
    assert abs(((asc + sp - pf) % 360.0) - nec) < 1e-6
    # 昼盘方向反转
    vd = PerChart({**DAY, 'erosConstruction': 'valens'})
    asc_d = vd.chart.getAngle(const.ASC).lon
    pf_d = vd.chart.getObject(const.PARS_FORTUNA).lon
    sp_d = vd.chart.get(ap.PARS_SPIRIT).lon
    assert abs(((asc_d + sp_d - pf_d) % 360.0) - vd.chart.get(ap.PARS_EROS).lon) < 1e-6


def test_fortune_moon_above_night_variant():
    # 找「夜盘且月在地平上」例:凌晨 2:30 月常在地平上(不保证,扫几个时刻)
    hit = None
    for t in ('00:30:00', '02:30:00', '04:00:00', '22:00:00', '23:30:00'):
        pc = PerChart({**NIGHT, 'time': t})
        if pc.isDiurnal:
            continue
        va = PerChart({**NIGHT, 'time': t, 'lotFortuneVariant': 'moonAboveNight'})
        pf0 = pc.chart.getObject(const.PARS_FORTUNA).lon
        pf1 = va.chart.getObject(const.PARS_FORTUNA).lon
        if abs(pf0 - pf1) > 0.01:
            hit = (pc, va)
            break
    if hit is None:
        pytest.skip('样本时刻月均在地平下(变体=夜式与默认同值,无判别力)')
    pc, va = hit
    # 夜盘默认已是夜式——变体只在「月在地平上」时改用夜式,夜盘月在地平上=默认夜式,应零变!
    # 若真变了说明找到的是「夜盘 flatlib 默认夜式 vs 变体夜式」不可能——重审语义:
    # 变体语义=月上恒夜式;夜盘本就夜式 → 变体只在【昼盘且月在地平上】有判别力。
    assert False, '夜盘出现福点变化=实现语义错(夜盘默认即夜式)'


def test_fortune_moon_above_night_daytime_discriminator():
    # 真判别向量:昼盘+月在地平上 → 变体福点=夜式(与默认昼式差=2×|月日弧差|)
    hit = None
    for d in range(1, 28, 3):
        base = {**DAY, 'date': '1991/08/%02d' % d}
        pc = PerChart(dict(base))
        if not pc.isDiurnal:
            continue
        va = PerChart({**base, 'lotFortuneVariant': 'moonAboveNight'})
        pf0 = pc.chart.getObject(const.PARS_FORTUNA).lon
        pf1 = va.chart.getObject(const.PARS_FORTUNA).lon
        if abs(pf0 - pf1) > 0.01:
            hit = (pc, va)
            break
    assert hit is not None, '1991-08 正午样本无「月在地平上」日(异常:该月必有)'
    pc, va = hit
    asc = va.chart.getAngle(const.ASC).lon
    sun = va.chart.getObject(const.SUN).lon
    moon = va.chart.getObject(const.MOON).lon
    assert abs(((asc + sun - moon) % 360.0) - va.chart.getObject(const.PARS_FORTUNA).lon) < 1e-6


def test_father_combust_alt():
    # 扫月份找土星距日 < 17°(默认束界)的时点
    hit = None
    for m in range(1, 13):
        base = {'date': '1991/%02d/15' % m, 'time': '12:00:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}
        pc = PerChart(dict(base))
        sun = pc.chart.getObject(const.SUN).lon
        sat = pc.chart.getObject(const.SATURN).lon
        d = abs(((sat - sun + 180.0) % 360.0) - 180.0)
        if d < 17.0:
            hit = base
            break
    assert hit is not None, '1991 全年土星必有合日窗'
    off = PerChart(dict(hit))
    on = PerChart({**hit, 'lotFatherCombustAlt': 1})
    f0 = off.chart.get(ap.PARS_FATHER).lon
    f1 = on.chart.get(ap.PARS_FATHER).lon
    assert abs(f0 - f1) > 0.01
    asc = on.chart.getAngle(const.ASC).lon
    jup = on.chart.getObject(const.JUPITER).lon
    mars = on.chart.getObject(const.MARS).lon
    expect = (asc + jup - mars) if on.isDiurnal else (asc + mars - jup)
    assert abs((expect % 360.0) - f1) < 1e-6


def test_lot_projection_sign():
    sg = PerChart({**DAY, 'lotProjection': 'sign'})
    assert sg.chart.getObject(const.PARS_FORTUNA).lon % 30 == 0
    for p in sg.chart.pars:
        assert p.lon % 30 == 0, (p.id, p.lon)


def test_wp3_default_vector_parity():
    a = PerChart(dict(NIGHT))
    b = PerChart({**NIGHT, 'hermeticLotsReversal': 1, 'erosConstruction': 'paulus',
                  'lotFortuneVariant': 'standard', 'lotFatherCombustAlt': 0, 'lotProjection': 'portion'})
    assert a.chart.getObject(const.PARS_FORTUNA).lon == b.chart.getObject(const.PARS_FORTUNA).lon
    for pid in (ap.PARS_SPIRIT, ap.PARS_EROS, ap.PARS_NECESSITY, ap.PARS_FATHER):
        assert a.chart.get(pid).lon == b.chart.get(pid).lon, pid
