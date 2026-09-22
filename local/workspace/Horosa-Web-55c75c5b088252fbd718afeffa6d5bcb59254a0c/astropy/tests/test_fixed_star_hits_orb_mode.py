"""[Q-340/T-321] 格局页恒星触发(fixed_star_hits)接「按星等」档与随盘轨值:
此前只按单一平轨值,fixedStarOrbMode='byMagnitude' / 随盘 starOrb 对恒星触发无效(与 /chart 汇合恒星口径分离)。"""
from astrostudy.perchart import PerChart
from astrostudy.astroextra import fixed_star_hits, _analyze_chart_inner

BASE = {'date': '1990/05/18', 'time': '10:00:00', 'zone': '+08:00', 'lat': '31n38', 'lon': '118e27', 'hsys': 1, 'zodiacal': 0}


def test_by_magnitude_uses_per_star_orb_and_differs_from_flat():
    pc = PerChart(dict(BASE))
    flat = fixed_star_hits(pc, 1.0)
    bymag = fixed_star_hits(pc, 1.0, by_magnitude=True)
    # 星等表轨(亮星 7.5° … 暗星 0.5°)≠平轨 1°:命中集合必不同(判别向量)
    assert {(h['star'], h['point']) for h in flat} != {(h['star'], h['point']) for h in bymag}
    # 按星等档下每条命中的 orb 不超过该星自身星等轨
    stars = {getattr(s, 'id', ''): s for s in pc.getFixedStars()}
    for h in bymag:
        assert h['orb'] <= float(stars[h['star']].orb()) + 1e-9


def test_analyze_honours_request_mode_and_chart_level_orb():
    pc_data = dict(BASE)
    a = _analyze_chart_inner(pc_data, {'fixedStarOrb': 1.0})
    b = _analyze_chart_inner(pc_data, {'fixedStarOrb': 1.0, 'fixedStarOrbMode': 'byMagnitude'})
    c = _analyze_chart_inner(pc_data, {'starOrb': 3.0})          # 随盘 chart 级键(无显式 fixedStarOrb)
    d = _analyze_chart_inner(pc_data, {'starOrbMode': 'byMagnitude'})
    key = lambda r: {(h['star'], h['point']) for h in r['fixedStarHits']}
    assert key(a) != key(b)
    assert key(b) == key(d)
    assert key(c) >= key(a) and len(key(c)) > len(key(a))
