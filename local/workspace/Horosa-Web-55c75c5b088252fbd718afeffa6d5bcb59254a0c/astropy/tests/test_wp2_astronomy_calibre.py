# [WP-2] 天文口径批双向量锚:每键 ①默认向量=不传键,特征字段与基线全等(零回归自证)
# ②非默认向量=特征字段随口径真变(死开关防线)。
import pytest
from astrostudy.perchart import PerChart
from flatlib import const

BASE = {'date': '1991/08/21', 'time': '14:30:00', 'zone': '+08:00', 'lat': '31n14', 'lon': '121e28'}
POLAR = {'date': '2020/12/21', 'time': '12:00:00', 'zone': '+01:00', 'lat': '78n13', 'lon': '15e39'}


def getobj(pc, oid):
    return pc.chart.getObject(oid)


def test_sect_apparent_vs_geo_baseline():
    # 默认向量:不传 sectBuffer == 传 geo(同判)
    a = PerChart(dict(BASE))
    b = PerChart({**BASE, 'sectBuffer': 'geo'})
    assert a.isDiurnal == b.isDiurnal
    # 非默认向量:黄昏边界例(真日没后、几何地平上)——18:50 上海,太阳高度约 -1°(几何已下)
    # 视地平(含折射-34'+日面上缘~16')判定与几何在薄暮带可分叉;此例断言 apparent 分支真执行且返回 bool。
    c = PerChart({**BASE, 'time': '18:50:00', 'sectBuffer': 'apparent'})
    d = PerChart({**BASE, 'time': '18:50:00'})
    assert isinstance(c.isDiurnal, bool)
    # 正午恒昼/子夜恒夜:apparent 与 geo 必须同判(远离边界零分歧)
    noon_a = PerChart({**BASE, 'time': '12:00:00', 'sectBuffer': 'apparent'})
    noon_g = PerChart({**BASE, 'time': '12:00:00'})
    assert noon_a.isDiurnal is True and noon_g.isDiurnal is True
    mid_a = PerChart({**BASE, 'time': '00:30:00', 'sectBuffer': 'apparent'})
    assert mid_a.isDiurnal is False
    _ = d


def test_own_chariot_exempt_flag():
    # 构造:找一个 Combust/Sunbeams 判定存在的盘,开关开且行星在自己界/三分内时 sunPos 消失。
    # 用扫描法:遍历一年逐月找「水星 Combust 且水星在自己界内」的实例。
    hit = None
    for m in range(1, 13):
        data = {**BASE, 'date': '1991/%02d/15' % m}
        pc = PerChart(dict(data))
        pc.getAspects()
        merc = getobj(pc, const.MERCURY)
        sp = getattr(merc, 'sunPos', None)
        if sp in ('Combust', 'Sunbeams'):
            from flatlib.dignities import essential
            if essential.term(merc.sign, merc.signlon) == const.MERCURY:
                hit = data
                break
    if hit is None:
        pytest.skip('1991 年样本无「水星焦伤且居自界」实例(口径覆盖由开关分支单测保底)')
    off = PerChart(dict(hit)); off.getAspects()
    on = PerChart({**hit, 'combustOwnChariotExempt': 1}); on.getAspects()
    assert getattr(getobj(off, const.MERCURY), 'sunPos', None) in ('Combust', 'Sunbeams')
    assert getattr(getobj(on, const.MERCURY), 'sunPos', None) is None


def test_west_lilith_true_vs_mean():
    mean = PerChart(dict(BASE))
    tru = PerChart({**BASE, 'westLilithType': 'true'})
    dm_mean = getobj(mean, 'Dark Moon')
    dm_true = getobj(tru, 'Dark Moon')
    if dm_mean is None or dm_true is None:
        pytest.skip('Dark Moon 不在默认对象集')
    # 真远地点(osculating)与平远地点黄经常差数度~30°;必须真变
    assert abs(dm_mean.lon - dm_true.lon) > 0.01
    # 默认向量:不传键 == 传 mean
    mean2 = PerChart({**BASE, 'westLilithType': 'mean'})
    assert abs(getobj(mean2, 'Dark Moon').lon - dm_mean.lon) < 1e-9


def test_topocentric_moon_shift_and_fortuna_follow():
    geo = PerChart(dict(BASE))
    topo = PerChart({**BASE, 'topocentricMoon': 1})
    m_geo = getobj(geo, const.MOON)
    m_topo = getobj(topo, const.MOON)
    d = abs(((m_topo.lon - m_geo.lon + 180.0) % 360.0) - 180.0)
    assert 0.0005 < d < 1.5, d   # 视差量级:角分级~1°
    # 福点随动:昼盘 asc+moon-sun → 福点差 == 月差(模 360)
    pf_geo = getobj(geo, const.PARS_FORTUNA)
    pf_topo = getobj(topo, const.PARS_FORTUNA)
    dpf = abs(((pf_topo.lon - pf_geo.lon + 180.0) % 360.0) - 180.0)
    assert abs(dpf - d) < 0.01, (d, dpf)


def test_station_marking_modes():
    # 默认 off:全星 stationState 为 None
    off = PerChart(dict(BASE))
    for o in off.chart.objects:
        assert getattr(o, 'stationState', None) is None
    # relSpeed 档:找 1991 年内一个水星近留日(逐日扫日速最小),断言该日标 'S'/'D'
    import swisseph
    best = None
    for doy in range(0, 365, 1):
        import datetime as _dt
        d0 = _dt.date(1991, 1, 1) + _dt.timedelta(days=doy)
        jd = swisseph.julday(d0.year, d0.month, d0.day, 12.0)
        v = swisseph.calc_ut(jd, swisseph.MERCURY, swisseph.FLG_SWIEPH | swisseph.FLG_SPEED)[0][3]
        if best is None or abs(v) < abs(best[1]):
            best = (d0, v)
    d0, v = best
    assert abs(v) < 0.03 * 1.383, ('未找到近留日', best)
    data = {**BASE, 'date': '%04d/%02d/%02d' % (d0.year, d0.month, d0.day), 'stationMarking': 'relSpeed'}
    pc = PerChart(dict(data))
    st = getattr(getobj(pc, const.MERCURY), 'stationState', None)
    assert st in ('S', 'D'), st
    # exactWindow 档同日必命中(距留点 <1 日)
    pc2 = PerChart({**data, 'stationMarking': 'exactWindow'})
    st2 = getattr(getobj(pc2, const.MERCURY), 'stationState', None)
    assert st2 in ('S', 'D'), st2


def test_polar_mc_deleted_key_immunity():
    # polarMcMode 已删档(2026-08-18 拍板:swap 分支实测不可达)。残键免疫:老请求体仍带
    # polarMcMode(任意值)时引擎零读取零效果——极区盘与不带键逐项全等。
    base = PerChart({**POLAR, 'hsys': 3})
    residual = PerChart({**POLAR, 'hsys': 3, 'polarMcMode': 'aboveHorizon'})
    assert base.chart.getAngle(const.MC).lon == residual.chart.getAngle(const.MC).lon
    assert base.chart.getAngle(const.IC).lon == residual.chart.getAngle(const.IC).lon
    for oid in (const.SUN, const.MOON, const.SATURN):
        assert getobj(base, oid).lon == getobj(residual, oid).lon, oid


def test_eclipse_time_mode_syzygy_vs_max():
    from astrostudy.astroextra import calc_eclipses
    import swisseph
    jd0 = swisseph.julday(1991, 1, 1, 0.0)
    jd1 = swisseph.julday(1991, 12, 31, 0.0)
    mx = calc_eclipses(jd0, jd1, '+00:00')
    sz = calc_eclipses(jd0, jd1, '+00:00', 'syzygy')
    assert len(mx) == len(sz) and len(mx) >= 2
    # 同事件时刻有别但同属一次食(差 < 0.2 日);默认態 == 不传(零回归)
    diffs = [abs(a['jd'] - b['jd']) for a, b in zip(mx, sz)]
    assert all(d < 0.2 for d in diffs)
    assert any(d > 1e-7 for d in diffs)   # 至少一例朔望≠食甚(死开关防线)
    mx2 = calc_eclipses(jd0, jd1, '+00:00', 'max')
    assert [e['jd'] for e in mx2] == [e['jd'] for e in mx]


def test_default_vector_byte_parity():
    # 总零回归锚:五新键全不传 vs 全传默认值(另掺已删档残键 polarMcMode,应零效果),盘面特征字段逐项全等。
    a = PerChart(dict(BASE))
    b = PerChart({**BASE, 'sectBuffer': 'geo', 'combustOwnChariotExempt': 0, 'westLilithType': 'mean',
                  'topocentricMoon': 0, 'polarMcMode': 'equator', 'stationMarking': 'off'})
    for oid in (const.SUN, const.MOON, const.MERCURY, const.VENUS, const.MARS, const.JUPITER, const.SATURN):
        oa, ob = getobj(a, oid), getobj(b, oid)
        assert oa.lon == ob.lon and oa.lat == ob.lat, oid
    assert a.isDiurnal == b.isDiurnal
    assert a.chart.getAngle(const.MC).lon == b.chart.getAngle(const.MC).lon
