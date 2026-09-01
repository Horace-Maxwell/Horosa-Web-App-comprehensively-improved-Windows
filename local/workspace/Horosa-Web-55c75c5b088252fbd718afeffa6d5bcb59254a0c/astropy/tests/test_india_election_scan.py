# -*- coding: utf-8 -*-
"""[Z8] 印度择日(Muhurta)扫描引擎金标。锚=2026-01-01 12:30 北京(tithi13/vara4 周四/
月宿4 Rohini/yoga23——vara 差一实抓修正:jd 整数取模法把周四判 vara3,改当地日出日期
直算 weekday)。判别:ayanamsa lahiri/raman 两制月宿差+nodeType 罗喉位差+natal 组必填守卫。
运行: PYTHONPATH=Horosa-Web/astropy python3 -m pytest Horosa-Web/astropy/tests/test_india_election_scan.py -q
"""
import pytest

from astrostudy.india_election_scan import (
    scan, explain_at, IndiaScanContext, CONDITION_TYPES, _EVALUATORS,
)
from astrostudy.election_scan import _jd_from

GEO = {'gpsLat': 39.9, 'gpsLon': 116.46, 'zone': '+08:00'}


def _ctx(extra=None):
    d = dict(GEO)
    if extra:
        d.update(extra)
    return IndiaScanContext(d)


JD = _jd_from('2026-01-01', '12:30:00', '+08:00', 1)


def test_registry_contract():
    assert set(CONDITION_TYPES.keys()) == set(_EVALUATORS.keys())
    assert len(CONDITION_TYPES) >= 11


def test_anchor_panchanga():
    m = _ctx().moment(JD)
    assert m.tithi() == 13
    assert m.vara() == 4          # 2026-01-01=周四(vara 差一修正锚)
    assert m.nak('Moon') == 4     # Rohini
    assert m.yoga() == 23
    # 罗计对宫
    assert abs((m.sid_lon('Rahu') - m.sid_lon('Ketu')) % 360.0 - 180.0) < 1e-9


def test_vara_sunrise_boundary():
    """日出界换日:周四日出(07:36)前仍属周三 vara。"""
    m_before = _ctx().moment(_jd_from('2026-01-01', '06:30:00', '+08:00', 1))
    m_after = _ctx().moment(_jd_from('2026-01-01', '08:30:00', '+08:00', 1))
    assert m_before.vara() == 3
    assert m_after.vara() == 4


def test_rahu_kalam_thursday():
    """周四 Rahu Kalam=八分日第 6 段(标准 6-18 制 13:30-15:00;真日出制随日长伸缩)。"""
    r = scan(dict(GEO, startDate='2026-01-01', endDate='2026-01-01',
                  conditions={'type': 'day_kalam', 'params': {'kind': 'rahu', 'mode': 'in'}}))
    assert 'err' not in r
    assert len(r['intervals']) == 1
    seg = r['intervals'][0]
    assert seg['start'].startswith('2026-01-01 13:')
    assert seg['end'].startswith('2026-01-01 14:')


def test_ayanamsa_discriminates():
    """判别:lahiri vs raman 月宿在制差 ~1.4° 时确可不同(锚日月在宿内深处则座必判别)。"""
    a = _ctx({'ayanamsa': 'lahiri'}).moment(JD)
    b = _ctx({'ayanamsa': 'raman'}).moment(JD)
    assert abs(a.sid_lon('Moon') - b.sid_lon('Moon')) > 0.5


def test_node_type_discriminates():
    a = _ctx({'nodeType': 'mean'}).moment(JD).sid_lon('Rahu')
    b = _ctx({'nodeType': 'true'}).moment(JD).sid_lon('Rahu')
    assert abs(a - b) > 0.01


def test_tithi_scan_pointwise():
    r = scan(dict(GEO, startDate='2026-01-01', endDate='2026-01-01',
                  conditions={'type': 'tithi', 'params': {'values': [13]}}))
    assert 'err' not in r
    ivs = r['intervals']
    ctx = _ctx()
    jd0 = _jd_from('2026-01-01', '00:00:00', '+08:00', 1)
    mism = 0
    for k in range(48):
        jd = jd0 + k * (30.0 / 1440.0)
        truth = ctx.moment(jd).tithi() == 13
        from astrostudy.election_scan import date_time_from_jd
        t = date_time_from_jd(jd, '+08:00')['datetime'][:16]
        rec_in = any(s <= t <= e for s, e in [(iv['start'], iv['end']) for iv in ivs])
        if truth != rec_in:
            mism += 1
    assert mism == 0


def test_natal_group_guard_and_discriminate():
    """本命组:未设 natal=invalid_conditions;设 natal 后 Tara 判定随 natal 变。"""
    bad = scan(dict(GEO, startDate='2026-01-01', endDate='2026-01-01',
                    conditions={'type': 'tara_bala', 'params': {}}))
    assert bad.get('err') == 'invalid_conditions'
    r1 = scan(dict(GEO, natal={'moonNak': 4}, startDate='2026-01-01', endDate='2026-01-01',
                   conditions={'type': 'tara_bala', 'params': {'values': [1]}}))
    r2 = scan(dict(GEO, natal={'moonNak': 5}, startDate='2026-01-01', endDate='2026-01-01',
                   conditions={'type': 'tara_bala', 'params': {'values': [1]}}))
    assert 'err' not in r1 and 'err' not in r2
    assert [(_i['start'], _i['end']) for _i in r1['intervals']] != [(_i['start'], _i['end']) for _i in r2['intervals']]


def test_explain_same_source():
    e = explain_at(dict(GEO, t='2026-01-01 12:30', conditions={
        'type': 'all', 'conditions': [
            {'type': 'tithi', 'params': {'values': [13]}},
            {'type': 'vara', 'params': {'values': [4]}},
        ]}))
    assert 'err' not in e
    assert e['tree']['pass'] is True
    assert 'tithi13' in e['tree']['children'][0]['actual']


# ── 前端契约判别锚(2026-08-29 审查实抓防回潮) ──

def test_lagna_frontend_one_based():
    """前端 numOpt 发 values=1..12,谓词侧须 -1(曾漏换算整体错一座):
    2026-01-01 12:30 北京恒星上升=白羊 → [1] pass、[2] fail;explain actual 仍 1 基。"""
    e1 = explain_at(dict(GEO, t='2026-01-01 12:30',
                         conditions={'type': 'lagna', 'params': {'values': [1]}}))
    e2 = explain_at(dict(GEO, t='2026-01-01 12:30',
                         conditions={'type': 'lagna', 'params': {'values': [2]}}))
    assert e1['tree']['pass'] is True
    assert e2['tree']['pass'] is False
    assert 'lagna1' in e1['tree']['actual']
    # planet_sign 同契约:木星该日恒星双子(0 基 2=1 基 3)→ [3] pass、[4] fail
    p3 = explain_at(dict(GEO, t='2026-01-01 12:30',
                         conditions={'type': 'planet_sign', 'params': {'body': 'Jupiter', 'values': [3]}}))
    p4 = explain_at(dict(GEO, t='2026-01-01 12:30',
                         conditions={'type': 'planet_sign', 'params': {'body': 'Jupiter', 'values': [4]}}))
    assert p3['tree']['pass'] is True
    assert p4['tree']['pass'] is False


def test_tara_default_excludes_janma():
    """默认吉集=2/4/6/8/9(主流五吉);Janma(1) 不入默认:候选月宿=本命月宿时默认判 False。"""
    e = explain_at(dict(GEO, t='2026-01-01 12:30', natal={'moonNak': 4},
                        conditions={'type': 'tara_bala', 'params': {}}))
    # 2026-01-01 12:30 月宿=4(Rohini,test_anchor_panchanga 同锚)→ Tara=1(Janma)
    assert e['tree']['pass'] is False
    e1 = explain_at(dict(GEO, t='2026-01-01 12:30', natal={'moonNak': 4},
                         conditions={'type': 'tara_bala', 'params': {'values': [1]}}))
    assert e1['tree']['pass'] is True


def test_bc_era_sunrise_types_rejected():
    """BC 域 vara/day_kalam 诚实拒扫(datetime.date 拒 y≤0,曾报成空串 int 解析错)。"""
    r = scan(dict(GEO, ad=-1, startDate='0044-03-01', endDate='0044-03-02',
                  conditions={'type': 'vara', 'params': {'values': [4]}}))
    assert r.get('err') == 'invalid_conditions'
    assert 'BC era' in (r.get('detail') or '')
    # 非日出界条件 BC 域照常可扫
    r2 = scan(dict(GEO, ad=-1, startDate='0044-03-01', endDate='0044-03-02',
                   conditions={'type': 'planet_sign',
                               'params': {'body': 'Jupiter', 'values': list(range(1, 13))}}))
    assert 'err' not in r2 and r2['intervals']

def test_w8_new_segment_types_registered_and_wellformed():
    """[W8 全谱轮] 七新类注册齐+实弹良构(Abhijit 每日恰一段~48分;昼夜互补)。"""
    from astrostudy.india_election_scan import CONDITION_TYPES as CT, _EVALUATORS as EV, IndiaScanContext
    from astrostudy.election_scan import _jd_from
    for k in ('muhurta_seg', 'choghadia', 'hora_vedic', 'panchaka', 'nak_pada', 'bhava_from_lagna', 'day_night_in'):
        assert k in CT and k in EV
    ctx = IndiaScanContext({'zone': '+05:30', 'lat': '28n36', 'lon': '77e12', 'gpsLat': 28.61, 'gpsLon': 77.21, 'ayanamsa': 'lahiri'})
    jd0 = _jd_from('2026-01-01', '06:00:00', '+05:30', 1)
    dom = (jd0, jd0 + 1.0)
    ab = EV['muhurta_seg']({'pick': 'abhijit'}, ctx, dom)
    assert len(ab) == 1 and 0.02 < (ab[0][1] - ab[0][0]) < 0.05   # 一日恰一段,~30-70 分钟
    day = EV['day_night_in']({'value': 'day'}, ctx, dom)
    night = EV['day_night_in']({'value': 'night'}, ctx, dom)
    total = sum(b - a for a, b in day) + sum(b - a for a, b in night)
    assert 0.95 < total <= 1.0 + 1e-6   # 昼+夜 ≈ 全窗(边界日出裁剪容差)
    good = EV['choghadia']({'natures': ['good']}, ctx, dom)
    bad = EV['choghadia']({'natures': ['bad']}, ctx, dom)
    assert good and bad and abs((sum(b - a for a, b in good) + sum(b - a for a, b in bad)) - total) < 0.02

