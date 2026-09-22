# -*- coding: utf-8 -*-
"""[Q-179/T-94] 星历「行运触发」过零判据:旧式 |Δ|-aspect 对合(0°)恒 ≥0、冲(180°)恒 ≤0 → 永不出合/冲。
本测试用线性运动的假天体(monkeypatch swe_lon/PerChart/chart_points)扫描一整圈,断言每个相位恰各命中应有次数,
且合相式在冲位、冲相式在合位的 ±180 跳变不被误判为过零(无假命中)。"""
import os
import sys

_ASTRO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _ASTRO not in sys.path:
    sys.path.insert(0, _ASTRO)

from astrostudy import astroextra  # noqa: E402
from astrostudy.astroextra import signed_aspect_delta, norm180  # noqa: E402


def test_signed_aspect_delta_crosses_zero_at_conjunction_and_opposition():
    natal = 100.0
    # 合相:过 100° 变号;冲相:过 280° 变号;三分相 |Δ|-120 在 220°(=100+120)与 340°(=100-120)两处过零
    assert signed_aspect_delta(99.0, natal, 0) < 0 < signed_aspect_delta(101.0, natal, 0)
    assert signed_aspect_delta(279.0, natal, 180) < 0 < signed_aspect_delta(281.0, natal, 180)
    assert signed_aspect_delta(219.0, natal, 120) < 0 < signed_aspect_delta(221.0, natal, 120)
    assert abs(signed_aspect_delta(100.0, natal, 0)) < 1e-9
    assert abs(signed_aspect_delta(280.0, natal, 180)) < 1e-9
    # 返回值绝对值=误差度数(与 orb 口径一致)
    assert abs(abs(signed_aspect_delta(103.5, natal, 0)) - 3.5) < 1e-9
    assert abs(abs(signed_aspect_delta(276.0, natal, 180)) - 4.0) < 1e-9


def _scan(monkeypatch, speed_deg_per_day, start_lon, natal_lon, aspects, days, body='Mars'):
    class _Fake:
        pass

    monkeypatch.setattr(astroextra, 'PerChart', lambda base: _Fake())
    monkeypatch.setattr(astroextra, 'chart_points', lambda perchart, include_angles=True: [{'id': 'Sun', 'lon': natal_lon}])
    monkeypatch.setattr(astroextra, 'swe_lon', lambda b, jd: ((start_lon + speed_deg_per_day * (jd - 2451545.0)) % 360.0, speed_deg_per_day, 0.0))
    monkeypatch.setattr(astroextra, 'date_time_from_jd', lambda jd, zone: {'jd': jd, 'datetime': ''})
    monkeypatch.setattr(astroextra, 'sign_name_from_lon', lambda lon: '')
    return astroextra.calc_transit_aspects({}, 2451545.0, 2451545.0 + days, '+00:00', [body], ['Sun'], aspects)


def test_linear_body_hits_each_aspect_exactly_once_per_revolution(monkeypatch):
    # 火星 0.6°/日,起点在本命点后 1°,扫 600 日(恰一整圈),每个相位应各命中一次(60/90/120 两侧各一次)
    events = _scan(monkeypatch, 0.6, 101.0, 100.0, [0, 60, 90, 120, 180], 600)
    by_aspect = {}
    for ev in events:
        by_aspect.setdefault(ev['aspect'], []).append(ev)
    assert sorted(by_aspect.keys()) == [0.0, 60.0, 90.0, 120.0, 180.0]
    assert len(by_aspect[0.0]) == 1
    assert len(by_aspect[180.0]) == 1
    assert len(by_aspect[60.0]) == 2 and len(by_aspect[90.0]) == 2 and len(by_aspect[120.0]) == 2
    # 精确命中:合相在 lon=100,冲相在 lon=280,误差 < 1e-3°
    assert abs(norm180(by_aspect[0.0][0]['lon'] - 100.0)) < 1e-3
    assert abs(norm180(by_aspect[180.0][0]['lon'] - 280.0)) < 1e-3
    for ev in events:
        assert ev['orb'] < 1e-3


def test_moon_fast_body_no_false_hits_at_antipode(monkeypatch):
    # 月亮 13°/日、0.25 日步:一圈约 27.7 日;扫 90 日 ≈ 3.25 圈 → 合 3 次、冲 3 次(起点恰在冲位前 1°)
    events = _scan(monkeypatch, 13.0, 279.0, 100.0, [0, 180], 90, body='Moon')
    conj = [e for e in events if e['aspect'] == 0.0]
    opp = [e for e in events if e['aspect'] == 180.0]
    assert len(conj) == 3 and len(opp) == 4
    for e in conj:
        assert abs(norm180(e['lon'] - 100.0)) < 1e-3
    for e in opp:
        assert abs(norm180(e['lon'] - 280.0)) < 1e-3


def test_hits_sorted_by_time_then_truncated_with_stats(monkeypatch):
    # [Q-186/T-108 ②] 此前满 max_hits 即整体停扫(按星体嵌套序填满);现全量扫完按时间排序再截,stats 回填。
    class _Fake:
        pass

    monkeypatch.setattr(astroextra, 'PerChart', lambda base: _Fake())
    monkeypatch.setattr(astroextra, 'chart_points', lambda perchart, include_angles=True: [{'id': 'Sun', 'lon': 100.0}])
    speeds = {'Moon': 13.0, 'Mars': 0.6}
    monkeypatch.setattr(astroextra, 'swe_lon', lambda b, jd: ((101.0 + speeds[b] * (jd - 2451545.0)) % 360.0, speeds[b], 0.0))
    monkeypatch.setattr(astroextra, 'date_time_from_jd', lambda jd, zone: {'jd': jd, 'datetime': ''})
    monkeypatch.setattr(astroextra, 'sign_name_from_lon', lambda lon: '')
    stats = {}
    full = astroextra.calc_transit_aspects({}, 2451545.0, 2451545.0 + 600, '+00:00', ['Moon', 'Mars'], ['Sun'], [0, 180], max_hits=0, stats=stats)
    assert stats['truncated'] is False and stats['total'] == len(full)
    assert [e['jd'] for e in full] == sorted(e['jd'] for e in full)
    assert any(e['transitBody'] == 'Mars' for e in full)
    stats2 = {}
    cut = astroextra.calc_transit_aspects({}, 2451545.0, 2451545.0 + 600, '+00:00', ['Moon', 'Mars'], ['Sun'], [0, 180], max_hits=10, stats=stats2)
    assert len(cut) == 10 and stats2['truncated'] is True and stats2['total'] == len(full) and stats2['limit'] == 10
    assert cut == full[:10]   # 截的是时间序最早的 10 条,不是「月亮先填满」


def test_build_ephemeris_reports_limits(monkeypatch):
    # [Q-186/T-108 ①] 区间 >732 天 / 逐日 >370 天在 params.limits 明示(此前静默截断)。
    monkeypatch.setattr(astroextra, 'calc_transit_aspects', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_ingresses', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_stations', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_lunar_phases', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_eclipses', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_rise_set', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_phenomena', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_heliacal', lambda *a, **k: [])
    monkeypatch.setattr(astroextra, 'calc_daily_positions', lambda s, e, z, p, max_days=370: [{'jd': s + i} for i in range(min(int(e - s) + 1, max_days))])
    base = {'date': '2020/01/01', 'time': '12:00:00', 'zone': '+08:00', 'lat': '39n54', 'lon': '116e28', 'hsys': 0}
    short = astroextra.build_ephemeris({**base, 'startDate': '2020/01/01', 'endDate': '2020/04/01'})
    lim = short['params']['limits']
    assert lim['rangeTruncated'] is False and lim['dailyTruncated'] is False and lim['transitTruncated'] is False
    long = astroextra.build_ephemeris({**base, 'startDate': '2020/01/01', 'endDate': '2023/01/01'})
    lim = long['params']['limits']
    assert lim['rangeTruncated'] is True and lim['rangeDays'] == 732 and lim['dailyTruncated'] is True and lim['dailyDays'] == 370
    assert lim['requestedEndDate']['jd'] > long['params']['endDate']['jd']
    assert len(long['dailyPositions']) == 370
