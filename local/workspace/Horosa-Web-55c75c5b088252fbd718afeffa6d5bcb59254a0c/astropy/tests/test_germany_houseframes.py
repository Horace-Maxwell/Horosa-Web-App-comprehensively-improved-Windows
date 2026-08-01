# -*- coding: utf-8 -*-
"""量化盘 六大宫框(定局法 WP-2)金标测试。

核心断言:
  - 子午局 = swisseph.houses_ex(b'X') 赤道分宫;firstCusp=ascmc[4](东点)、tenthCusp=ascmc[1](MC)。
  - 子午局不等距(至少一宫 != 30°);其余五框严格等距(每宫整 30°)。
  - 各锚点正确:太阳局 ☉ 落 4 宫、月亮局 ☽ 落 10 宫、交点局 北交 落 1 宫、上升局 Asc 落 1 宫。
  - 地球局换生时不变(1 宫头固定 180°、placements 相同)。
  - 跨 0° 落宫正确(_house_of 弧长口径)。
"""

import swisseph
import pytest

from astrostudy.perchart import PerChart
from astrostudy.germany.midpoint import MidPoint
from astrostudy.germany.houseframes import (
    compute_house_frames, _meridian_cusps, _equal_cusps, _house_of,
)
from flatlib import const


def _make_perchart(date='2000/1/1', time='12:00:00', zone='+08:00', lat=39, lon=116):
    data = {'date': date, 'time': time, 'zone': zone, 'lat': lat, 'lon': lon}
    data['tradition'] = False
    data['predictive'] = False
    return PerChart(data)


def _pts(perchart):
    """复刻端点 pts 组装:midpoint.objects 口径 + 白羊点 0°。"""
    mp = MidPoint(perchart, orb=1.0, uranian=True, includeTnp=True)
    pts = [{'id': o.id, 'lon': o.lon} for o in mp.objects]
    pts.append({'id': 'AriesPoint', 'lon': 0.0})
    return pts, mp


# ── 纯函数层 ──────────────────────────────────────────────────────────
def test_equal_cusps_12_each_30():
    c = _equal_cusps(10)
    assert len(c) == 12
    assert c[0] == 10
    for i in range(12):
        # 相邻宫头差恒 30(跨 0° 用模 360)。
        assert round((c[(i + 1) % 12] - c[i]) % 360, 9) == 30


def test_equal_cusps_wraps_360():
    c = _equal_cusps(350)
    assert c[0] == 350
    assert c[1] == 20      # 350+30=380 → 20
    assert c[11] == 320    # 350+330=680 → 320


def test_house_of_basic():
    c = _equal_cusps(0)  # 宫头 0,30,60,...
    assert _house_of(0, c) == 1
    assert _house_of(29.9, c) == 1
    assert _house_of(30, c) == 2
    assert _house_of(359.9, c) == 12


def test_house_of_cross_zero():
    # 1 宫头=350 → 1 宫含 350..20。lon=5(跨 0°)应落 1 宫;lon=25 落 2 宫。
    c = _equal_cusps(350)
    assert _house_of(5, c) == 1
    assert _house_of(355, c) == 1
    assert _house_of(25, c) == 2
    assert _house_of(349, c) == 12  # 紧贴 1 宫头之前 = 12 宫


def test_house_of_nonequal_cusps():
    # 不等距(模拟子午局):宫头 [0,40,70,...] → lon=35 落 1 宫(0..40)、lon=50 落 2 宫(40..70)。
    cusps = [(i * 30 + (5 if i % 2 else 0)) % 360 for i in range(12)]
    # cusps = [0,35,60,95,120,155,180,215,240,275,300,335]
    assert _house_of(10, cusps) == 1
    assert _house_of(36, cusps) == 2
    assert _house_of(334, cusps) == 11  # 300..335 = 11 宫
    assert _house_of(336, cusps) == 12  # 335..360(回 0)= 12 宫


# ── 子午局赤道分宫 = houses_ex(b'X') ─────────────────────────────────
def test_meridian_equals_houses_ex_X():
    pc = _make_perchart()
    jd = pc.dateTime.jd
    cusps, ep, mc, vertex = _meridian_cusps(jd, pc.pos.lat, pc.pos.lon)
    raw_cusps, raw_ascmc = swisseph.houses_ex(jd, float(pc.pos.lat), float(pc.pos.lon), b'X')
    # firstCusp = ascmc[4](东点);tenthCusp = ascmc[1](MC);vertex = ascmc[3](B7 可选点,只增)。
    assert round(ep, 9) == round(raw_ascmc[4] % 360, 9)
    assert round(mc, 9) == round(raw_ascmc[1] % 360, 9)
    assert round(vertex, 9) == round(raw_ascmc[3] % 360, 9)
    # cusps[0] = 东点;cusps[9] = MC(b'X' 模式 1=东点、10=MC)。
    assert round(cusps[0], 9) == round(raw_ascmc[4] % 360, 9)
    assert round(cusps[9], 9) == round(raw_ascmc[1] % 360, 9)
    # 与裸 houses_ex 的 cusps 完全一致(只做 %360)。
    for i in range(12):
        assert round(cusps[i], 9) == round(raw_cusps[i] % 360, 9)


def test_meridian_first_is_east_point_not_asc():
    """🔴 铁律:1 宫头是东点 ascmc[4],绝非 ASC(黄道上升)。两者应不同(非极区一般有别)。"""
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    mer = res['frames']['meridian']
    asc = next(p['lon'] for p in pts if p['id'] == const.ASC)
    # 子午局 firstCusp = eastPoint(顶层同步),且 != 黄道 Asc。
    assert round(mer['firstCusp'], 6) == round(res['eastPoint'], 6)
    assert abs(((mer['firstCusp'] - asc + 180) % 360) - 180) > 1.0  # 东点与 Asc 明显不同


def test_meridian_not_equal_other_five_equal():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    frames = res['frames']
    # 子午局:equal=False 且至少一宫跨度 != 30°。
    mer = frames['meridian']
    assert mer['equal'] is False
    spans = [round((mer['cusps'][(i + 1) % 12] - mer['cusps'][i]) % 360, 6) for i in range(12)]
    assert any(abs(s - 30) > 0.01 for s in spans), spans
    # 其余五框:equal=True 且每宫恰 30°。
    for key in ('ascendant', 'sun', 'moon', 'node', 'earth'):
        f = frames[key]
        assert f['equal'] is True, key
        for i in range(12):
            assert round((f['cusps'][(i + 1) % 12] - f['cusps'][i]) % 360, 6) == 30, (key, i)


# ── 锚点定位正确 ──────────────────────────────────────────────────────
def test_ascendant_frame_asc_in_house1():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    asc_frame = res['frames']['ascendant']
    # Asc=1 宫头 ⇒ Asc 自身落 1 宫;firstCusp=Asc。
    assert asc_frame['placements'][const.ASC] == 1
    asc_lon = next(p['lon'] for p in pts if p['id'] == const.ASC)
    assert round(asc_frame['firstCusp'], 6) == round(asc_lon % 360, 6)


def test_sun_frame_sun_in_house4():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    sun_frame = res['frames']['sun']
    # ☉=4 宫(1 宫头=☉−90°)。
    assert sun_frame['placements'][const.SUN] == 4
    sun_lon = next(p['lon'] for p in pts if p['id'] == const.SUN)
    assert round(sun_frame['firstCusp'], 6) == round((sun_lon - 90) % 360, 6)


def test_moon_frame_moon_in_house10():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    moon_frame = res['frames']['moon']
    # ☽=10 宫(1 宫头=☽+90°)。
    assert moon_frame['placements'][const.MOON] == 10
    moon_lon = next(p['lon'] for p in pts if p['id'] == const.MOON)
    assert round(moon_frame['firstCusp'], 6) == round((moon_lon + 90) % 360, 6)


def test_node_frame_north_node_in_house1():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    node_frame = res['frames']['node']
    # 北交=1 宫头 ⇒ 北交落 1 宫。
    assert node_frame['placements'][const.NORTH_NODE] == 1
    node_lon = next(p['lon'] for p in pts if p['id'] == const.NORTH_NODE)
    assert round(node_frame['firstCusp'], 6) == round(node_lon % 360, 6)


# ── 地球局换生时不变 ──────────────────────────────────────────────────
def test_earth_frame_first_cusp_fixed_180():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    assert round(res['frames']['earth']['firstCusp'], 6) == 180.0


def test_earth_frame_invariant_across_birthtime():
    """地球局 1 宫头固定 180°、与生时无关 ⇒ 换时刻 firstCusp 与 cusps 不变。
    (落宫表会因行星动而变,但宫框骨架恒定。)"""
    pc1 = _make_perchart(time='03:00:00')
    pc2 = _make_perchart(time='21:30:00')
    pts1, _ = _pts(pc1)
    pts2, _ = _pts(pc2)
    e1 = compute_house_frames(pc1, pts1)['frames']['earth']
    e2 = compute_house_frames(pc2, pts2)['frames']['earth']
    assert round(e1['firstCusp'], 9) == round(e2['firstCusp'], 9) == 180.0
    assert [round(c, 9) for c in e1['cusps']] == [round(c, 9) for c in e2['cusps']]


# ── 跨 0° 落宫(节点局 firstCusp 接近 0° 时) ──────────────────────────
def test_cross_zero_placement_consistency():
    """构造 1 宫头≈355 的等宫框,验证 lon=5 的点落 1 宫(跨 0° 由弧长口径处理)。"""
    cusps = _equal_cusps(355)
    pts = [{'id': 'P', 'lon': 5.0}, {'id': 'Q', 'lon': 354.0}, {'id': 'R', 'lon': 26.0}]
    # P=5 在 [355,25) 内 = 1 宫;Q=354 紧贴前 = 12 宫;R=26 = 2 宫。
    assert _house_of(5.0, cusps) == 1
    assert _house_of(354.0, cusps) == 12
    assert _house_of(26.0, cusps) == 2


# ── 端点级:houseFrames 结构完整 ──────────────────────────────────────
def test_response_shape_complete():
    pc = _make_perchart()
    pts, _ = _pts(pc)
    res = compute_house_frames(pc, pts)
    assert set(res['frames'].keys()) == {'meridian', 'ascendant', 'sun', 'moon', 'node', 'earth'}
    for key, f in res['frames'].items():
        assert len(f['cusps']) == 12, key
        assert 'equal' in f and 'firstCusp' in f and 'tenthCusp' in f and 'placements' in f, key
        # 白羊点必在 placements(端点追加的 pts 含它)。
        assert 'AriesPoint' in f['placements'], key
    # 顶层锚点:eastPoint / mc / asc。
    assert 'eastPoint' in res and 'mc' in res and 'asc' in res


if __name__ == '__main__':
    pytest.main([__file__, '-q'])
