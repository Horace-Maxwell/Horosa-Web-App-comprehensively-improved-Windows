# -*- coding: utf-8 -*-
"""主限法 P2 长尾守卫:恒星/阿拉伯点 S·P + placidus_under_pole + Pole 集 + alcocoden。

  恒星:四王星+比尼 15 星名录,坐标取 67 星缓存当日视位置(岁差已含),恒携真β。
  阿拉伯点:getPars 全目录(排 Pars Fortuna);under-pole=普氏位置半圆近似(略异严密半弧)。
  Pole 集:S 集逐应星极点(随 resolved projection);alcocoden 仅识别不出年数。
  默认全关 = 字节零回归(golden 另行看守)。
"""
import json
import re

import pytest
import swisseph as swe

from astrostudy import perchart, perpredict, pd_engine


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


def test_default_byte_identical():
    a = json.dumps(_rows(), default=str)
    b = json.dumps(_rows(pdSignificators=None, pdPromissorTypes=None), default=str)
    assert a == b


def test_star_significators_and_promissors():
    st = _rows(pdSignificators=['Stars'])
    royal_sigs = {r[2] for r in st if any(n in r[2] for n in ('Regulus', 'Antares', 'Aldebaran', 'Fomalhaut'))}
    assert len(royal_sigs) == 4
    pf = _rows(pdPromissorTypes=['stars'])
    assert sum(1 for r in pf if r[1].startswith('FS_')) > 0


def test_lot_significators_and_promissors():
    base = _rows()
    lt = _rows(pdSignificators=['Lots'])
    lot_sigs = {r[2] for r in lt if 'Pars ' in r[2]}
    assert len(lot_sigs) >= 20
    # 主集福点另有来源(N_Pars Fortuna_0 恒在);Lots 目录须排除它=开关不重复贡献福点行
    fortuna = lambda rs: sorted([tuple(r[:3]) for r in rs if 'Pars Fortuna' in r[2]])
    assert fortuna(base) == fortuna(lt)
    pf = _rows(pdPromissorTypes=['lots'])
    assert sum(1 for r in pf if r[1].startswith('LT_')) > 0


def test_placidus_under_pole_close_to_strict():
    # 丘吉尔 ☉→☿:under-pole 近似应贴近严密 24.424°(半圆近似「略异」,差 <0.5° 且非零)
    jd = swe.julday(1874, 11, 30, 1.5)
    lat = 51.85
    sun = swe.calc_ut(jd, swe.SUN)[0]
    mer = swe.calc_ut(jd, swe.MERCURY)[0]
    eps = swe.calc_ut(jd, swe.ECL_NUT)[0][0]
    ramc = swe.houses(jd, lat, -1.35, b'P')[1][2]
    up = pd_engine.arc_placidus_under_pole({'lon': mer[0], 'lat': mer[1]},
                                           {'lon': sun[0], 'lat': sun[1]},
                                           ramc, lat, eps, zodiacal=False)
    assert abs(up - 24.424) < 0.5
    assert abs(up - 24.424) > 1e-6
    rows = _rows(pdProjection='placidus_under_pole', pdFrame='placidus')
    assert rows and all(len(r) == 5 for r in rows)


def test_pd_poles_shape_and_axes():
    pp = perpredict.PerPredict(perchart.PerChart(dict(BASE, pdProjection='regiomontanus')))
    res = pp.getPdPoles()
    assert res['projection'] == 'regiomontanus'
    poles = res['poles']
    # 四轴是定义值(Asc/Desc=地理纬度、MC/IC=0),只作形状锚
    assert abs(poles['MC']) < 1e-9 and abs(poles['IC']) < 1e-9
    assert abs(poles['Asc'] - 39.9) < 0.2 and abs(poles['Desc'] - 39.9) < 0.2
    # 🔴 真计算断言(曾只断上面四个写死字面量——把 pole_regiomontanus 改成 return 0
    # 测试照绿):体极须 ①与引擎闭式逐点一致 ②落物理界(0<|p|<|φ|) ③非常量。
    import swisseph as swe
    from astrostudy import pd_engine
    chart = pp.perchart.getChart()
    eps = float(swe.calc_ut(chart.date.jd, swe.ECL_NUT)[0][1])
    armc = float(swe.houses(chart.date.jd, 39.9, 116.4667, b'P')[1][2])
    checked = 0
    for name in ('Sun', 'Moon', 'Saturn'):
        assert name in poles and isinstance(poles[name], float)
        o = chart.get(name)
        # pdtype 缺省=0(zodiacal) → getPdPoles 按黄纬 0 投影,复算须同口径
        ra, dec = pd_engine.ecl_to_eq(float(o.lon), 0.0, eps)
        expect = pd_engine.pole_regiomontanus(ra, dec, armc, 39.9)
        assert abs(poles[name] - expect) < 0.05, (name, poles[name], expect)
        assert 0.0 < abs(poles[name]) < 39.9, (name, poles[name])
        checked += 1
    assert checked == 3
    assert len({poles['Sun'], poles['Moon'], poles['Saturn']}) == 3   # 非常量


def test_alcocoden_identify_rule_and_discipline():
    cd = dict(BASE)
    cd['pdFramework'] = 'release'
    info = perpredict.PerPredict(perchart.PerChart(cd)).getPdReleaseInfo()
    al = info['alcocoden']
    assert al and al['candidates']
    # 寿主规则:winner = 与 hyleg 成相位者中得分最高(无相位的高分者被跳过)
    if al['winner']:
        assert al['winner']['hasAspect'] is True
        higher = [c for c in al['candidates'] if c['score'] > al['winner']['score']]
        assert all(not c['hasAspect'] for c in higher)
    # 🔴 不出寿命年数纪律
    assert '不输出行星年' in al['note']
    assert not re.search(r'寿命[为约=]\s*\d', json.dumps(al, ensure_ascii=False))
