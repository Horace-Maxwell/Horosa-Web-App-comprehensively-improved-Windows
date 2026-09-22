# -*- coding: utf-8 -*-
"""[Q-418/T-381][Q-464/T-426][Q-268/T-254] 天星择日扫描口径与主排盘同式:
福点反转 / 福点变体 / 赫尔墨斯反转;恒星黄道下宫头状态与整宫入宫按恒星座;自定义历元 'user' 档 ayanamsa。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import swisseph
from astrostudy import election_scan as es

BASE = {
    'startDate': '2024/04/07', 'startTime': '00:00:00',
    'endDate': '2024/04/10', 'endTime': '00:00:00',
    'zone': '+00:00', 'gpsLat': 39.9042, 'gpsLon': 116.4074,
    'hsys': 0, 'zodiacal': 0, 'ad': 1,
}


def _norm(x):
    return (x % 360.0 + 360.0) % 360.0


def _night_moment(ctx):
    # 2024-04-07 北京 20:00 当地(UTC 12:00):太阳在地平下 → 夜盘
    jd = swisseph.julday(2024, 4, 7, 12.0)
    m = ctx.moment(jd)
    assert not m.is_diurnal('geo')
    return m


def test_lot_reversal_off_uses_day_formula_at_night():
    ctx_def = es.ScanContext(dict(BASE))
    ctx_off = es.ScanContext(dict(BASE, lotReversal=0))
    m1 = _night_moment(ctx_def)
    m2 = _night_moment(ctx_off)
    asc, sun, moon = m1.asc(), m1.lon('Sun'), m1.lon('Moon')
    assert abs(m1.lot_lon('fortuna') - _norm(asc + sun - moon)) < 1e-6   # 缺省:夜式(旧口径逐字不变)
    assert abs(m2.lot_lon('fortuna') - _norm(asc + moon - sun)) < 1e-6   # 关反转:恒昼式
    assert abs(m1.lot_lon('fortuna') - m2.lot_lon('fortuna')) > 1.0


def test_hermetic_reversal_off_spirit_day_formula_at_night():
    ctx_def = es.ScanContext(dict(BASE))
    ctx_off = es.ScanContext(dict(BASE, hermeticLotsReversal=0))
    m1 = _night_moment(ctx_def)
    m2 = _night_moment(ctx_off)
    asc, sun, moon = m1.asc(), m1.lon('Sun'), m1.lon('Moon')
    assert abs(m1.lot_lon('spirit') - _norm(asc + moon - sun)) < 1e-6
    assert abs(m2.lot_lon('spirit') - _norm(asc + sun - moon)) < 1e-6


def test_user_ayanamsa_epoch_params():
    jd = swisseph.julday(2024, 4, 7, 12.0)
    # user 档:历元 J2000(2451545.0) 时 24.0°,岁差率 50.290966″/年 → 2024 年约 +0.339°
    ctx = es.ScanContext(dict(BASE, zodiacal=1, siderealAyanamsa='user', userAyanT0=2451545.0, userAyanDeg=24.0))
    v = ctx.ayanamsa_deg(jd)
    assert 24.30 < v < 24.37, v
    # 缺参 → 回落 normalize(默认 lahiri ≈ 24.2°),不炸
    ctx2 = es.ScanContext(dict(BASE, zodiacal=1, siderealAyanamsa='user'))
    v2 = ctx2.ayanamsa_deg(jd)
    assert 23.5 < v2 < 25.0, v2


def test_cusp_state_sidereal_uses_sidereal_sign():
    jd = swisseph.julday(2024, 4, 7, 12.0)
    trop = es.ScanContext(dict(BASE))
    sid = es.ScanContext(dict(BASE, zodiacal=1, siderealAyanamsa='lahiri'))
    asc_t = trop.moment(jd).asc()
    asc_s = _norm(asc_t - sid.ayanamsa_deg(jd))
    sign_t = int(asc_t // 30)
    sign_s = int(asc_s // 30)
    dom = (jd - 0.01, jd + 0.01)
    params = {'house': 1, 'mode': 'in_sign', 'signs': [sign_s]}
    ivs_sid = es._eval_cusp_state(params, sid, dom)
    assert ivs_sid, '恒星制下第 1 宫头应按恒星座命中'
    if sign_t != sign_s:
        ivs_trop_sign = es._eval_cusp_state({'house': 1, 'mode': 'in_sign', 'signs': [sign_t]}, sid, dom)
        assert not ivs_trop_sign, '恒星制不应再按回归座命中'


def test_in_house_whole_sign_sidereal_matches_engine_whole_sign_house():
    jd = swisseph.julday(2024, 4, 7, 12.0)
    # hsys 索引:perchart.hsys 列表里 Whole Sign 的下标
    from astrostudy import perchart
    idx = perchart.hsys.index('Whole Sign')
    sid = es.ScanContext(dict(BASE, zodiacal=1, siderealAyanamsa='lahiri', hsys=idx))
    assert sid.hsys_code == b'W'
    m = sid.moment(jd)
    h = m.whole_sign_house('Moon')
    dom = (jd - 0.01, jd + 0.01)
    assert es._eval_in_house({'planet': 'Moon', 'houses': [h]}, sid, dom)
    other = [x for x in range(1, 13) if x != h]
    assert not es._eval_in_house({'planet': 'Moon', 'houses': other}, sid, dom)
